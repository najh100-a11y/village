// 진숲 어린이 마을 — 3D 마을
import * as THREE from './three.module.min.js';
import { Avatar, toon, toonGradient } from './avatar.js';
import { randomAvatar, colorOf, shade } from './face.js';
import { mergeStatic, Instancer } from './merge.js';
import { Park, PARK, RIDE_IDS, NO_TREE, resetLimbs } from './park.js';
import { Critters } from './critters.js';

const WALK_R = 30.2;
const PR = 0.42; // 사람 충돌 반지름
const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function rng(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const FRUIT_NAMES = ['사과', '감', '복숭아'];
const FRUIT_COLS = ['#EF6461', '#F49A4C', '#F6A2C4'];
// 벤치에 앉은 자세
const benchPose = (av) => {
  av.legs[0].rotation.x = av.legs[1].rotation.x = -1.45;
  av.arms[0].rotation.x = av.arms[1].rotation.x = -0.4;
};
// 손에 든 열매 (모양은 같이 쓴다)
let handFruitGeo = null;
function handFruit(c) {
  if (!handFruitGeo) handFruitGeo = { f: new THREE.SphereGeometry(0.13, 12, 10), stem: new THREE.CylinderGeometry(0.012, 0.012, 0.07, 5), leaf: new THREE.SphereGeometry(0.05, 8, 6) };
  const g = new THREE.Group();
  const fm = new THREE.Mesh(handFruitGeo.f, toon(FRUIT_COLS[c] || FRUIT_COLS[0]));
  fm.position.y = -0.06;
  g.add(fm);
  const st = new THREE.Mesh(handFruitGeo.stem, toon('#6B4429'));
  st.position.y = 0.03;
  g.add(st);
  const lf = new THREE.Mesh(handFruitGeo.leaf, toon('#6CC24A'));
  lf.scale.set(1.4, 0.4, 0.8);
  lf.position.set(0.04, 0.05, 0);
  g.add(lf);
  g.userData.isFruit = true;
  return g;
}
// 열매 먹는 자세: 위로 손을 뻗어 따고, 입 앞으로 가져와 냠냠 (e.t: 먹기 시작한 뒤 지난 시간)
function eatPose(e) {
  const f = (av) => {
    const k = e.t || 0;
    if (k < 0.45) { av.arms[1].rotation.x = -2.6; av.arms[1].rotation.z = 0.1; return; }
    const bite = Math.max(0, Math.sin(k * 11)) * 0.18;
    av.arms[1].rotation.x = -1.5 + bite;
    av.arms[1].rotation.z = -0.25;
    av.arms[0].rotation.x = -0.3;
    av.head.rotation.x = bite * 0.6;
  };
  f.eat = true;
  return f;
}
// 친구가 열매를 먹을 때 (내 화면에서는 같은 동작을 되풀이)
function remoteEatPose() {
  const e = { t: 0.5 };
  const pose = eatPose(e);
  const f = (av, dt) => { e.t += dt; if (e.t > 2.3) e.t = 0.5; pose(av); };
  f.eat = true;
  return f;
}
function m(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}
const box = (w, h, d, mat, x, y, z) => m(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (rt, rb, h, mat, x, y, z, seg = 20) => m(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const ball = (r, mat, x, y, z, seg = 18) => m(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.66 | 0)), mat, x, y, z);

function prism(width, height, depth, mat) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return m(g, mat);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(text, { bg = '#8B5E3C', fg = '#FFF6E0', border = '#6B4429', sub = '', w = 512, h = 144 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = border;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 34); ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(9, 9, w - 18, h - 18, 28); ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = sub ? 58 : 66;
    ctx.font = `${size}px ${FONT}`;
    while (ctx.measureText(text).width > w - 60 && size > 30) { size -= 2; ctx.font = `${size}px ${FONT}`; }
    ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 3);
    if (sub) {
      ctx.font = `30px ${FONT}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(sub, w / 2, h * 0.78);
    }
  });
}

function signMesh(text, width, opts) {
  const tex = signTexture(text, opts);
  const h = width * ((opts?.h || 144) / (opts?.w || 512));
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const o = m(new THREE.BoxGeometry(width, h, 0.08), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), mat, toon('#6B4429')]);
  o.userData.signMat = mat;
  return o;
}

// 길: 꺾은선 목록 (x, z)
const PATHS = [
  [[0, 16.9], [0, 6], [0, 1]], // 남쪽 끝은 놀이동산 입구
  [[-2.5, -5.5], [-6.5, -7.8], [-9.3, -9.4]],
  [[2.5, -5.5], [6.5, -7.8], [9.3, -9.4]],
  [[0, -7], [0, -12], [0, -17.4]],
  [[-4.5, -1.2], [-9, 1.2], [-13.6, 4.2]],
  [[4.5, -1.2], [9, 1.0], [13.7, 4.1]],
  [[0, 10.5], [-3, 11.7], [-5.4, 12.7]], // 연못 낚시터로
  [[0, 11], [5, 12.9], [9.4, 14.4]], // 놀이 마당으로
];
const PLAZA = { x: 0, z: -2.5, r: 5.4 };
const YARD = { x: 11.2, z: 16.4, r: 3.4 }; // 놀이 마당

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function inPark(x, z, pad = 0) {
  return ((x - PARK.x) / (PARK.rx + pad)) ** 2 + ((z - PARK.z) / (PARK.rz + pad)) ** 2 < 1;
}
function nearPath(x, z, pad) {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + pad) return true;
  if (inPark(x, z, pad)) return true;
  if (Math.hypot(x - YARD.x, z - YARD.z) < YARD.r + pad) return true;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
    if (distToSeg(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) < 1.2 + pad) return true;
  }
  return false;
}

function islandRadius(a) {
  return 32.6 + 1.1 * Math.sin(3 * a + 0.4) + 0.7 * Math.sin(7 * a + 1.3) + 0.4 * Math.sin(11 * a);
}

const SKY = {
  dawn: { sky: '#F7CFAE', hemiSky: '#FFE9D2', hemiGround: '#9CC772', hemi: 1.5, sun: '#FFD8B0', sunI: 1.8, glow: 0.3 },
  day: { sky: '#A6DDF6', hemiSky: '#FFFFFF', hemiGround: '#9CD07A', hemi: 1.75, sun: '#FFF4E0', sunI: 2.3, glow: 0 },
  dusk: { sky: '#F3A98C', hemiSky: '#FFD6C2', hemiGround: '#8DB46A', hemi: 1.35, sun: '#FFB98A', sunI: 1.6, glow: 0.6 },
  night: { sky: '#2E3E6E', hemiSky: '#9DB2F0', hemiGround: '#3E5A48', hemi: 0.95, sun: '#BFD0FF', sunI: 0.7, glow: 1 },
};
function phaseFor(h) {
  if (h >= 6 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 19.3) return 'dusk';
  return 'night';
}

export class Village {
  constructor(canvas, labelLayer, handlers = {}) {
    this.canvas = canvas;
    this.labels = labelLayer;
    this.on = handlers;
    this.mode = 'idle';
    this.paused = false;
    this.clock = new THREE.Clock();
    this.obstacles = [];
    this.doors = [];
    this.pickRoots = [];
    this.fadeables = [];
    this.glowMats = [];
    this.keys = new Set();
    this.target = null;
    // 시점: 마을(play)과 놀이(game) 따로. yaw는 옆으로 돈 각도, elev는 위아래로 더한 각도, zoom은 거리 배율
    this.view = { play: { yaw: 0, elev: 0, zoom: 1 }, game: { yaw: 0, elev: 0, zoom: 1 } };
    this.rotating = false;
    this.camPos = new THREE.Vector3(0, 30, 40);
    this.camLook = new THREE.Vector3(0, 0, -4);
    this.time = 0;
    this.remotes = new Map();
    this.net = { moving: false, sent: 0 };
    this.butterflies = [];
    this.benches = [];
    this.fruitTrees = [];
    this.fruits = [];
    this.noTree = [...NO_TREE];
    this.noFade = null;
    this.sitting = null;
    this.eating = null;
  }

  async init() {
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`60px "Maplestory Bold"`), document.fonts.load(`30px "Maplestory"`)]),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
    } catch (e) { /* 글꼴이 없어도 기본 글꼴로 그린다 */ }
    const coarse = matchMedia('(pointer: coarse)').matches;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.Fog('#A6DDF6', 55, 120);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#9CD07A', 1.75);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#FFF4E0', 2.3);
    this.sun.castShadow = true;
    const sz = coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.buildGround();
    this.buildWater();
    this.buildBuildings();
    this.buildPlaza();
    this.buildPlayground();
    this.buildBenches();
    this.park = new Park(this, { signMesh });
    this.buildNature();
    this.critters = new Critters(this);
    this.critters.onSound = (kind, soft) => this.on.onCritterSound && this.on.onCritterSound(kind, soft);
    this.buildNpcs();
    this.applyTimeOfDay();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- 땅과 바다 ----------
  buildGround() {
    const S = 2048, SPAN = 80;
    const px = (x) => ((x + SPAN / 2) / SPAN) * S;
    const tex = canvasTexture(S, S, (ctx) => {
      ctx.fillStyle = '#8DCC5F';
      ctx.fillRect(0, 0, S, S);
      const rnd = rng(11);
      const greens = ['#97D468', '#83C457', '#9BD971', '#7CBD52'];
      for (let i = 0; i < 1600; i++) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = greens[i % 4];
        ctx.beginPath();
        ctx.ellipse(rnd() * S, rnd() * S, 10 + rnd() * 40, 8 + rnd() * 26, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 잔디 무늬 (작은 v 모양)
      ctx.strokeStyle = 'rgba(70,140,60,.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 900; i++) {
        const x = rnd() * S, y = rnd() * S;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + 4, y - 5); ctx.stroke();
      }
      const u = S / SPAN;
      const drawPaths = (width, color) => {
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = width * u;
        for (const p of PATHS) {
          ctx.beginPath();
          p.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))));
          ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px(PLAZA.x), px(PLAZA.z), (PLAZA.r + (width - 2.3) / 2) * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px(YARD.x), px(YARD.z), (YARD.r + (width - 2.3) / 2) * u, 0, Math.PI * 2);
        ctx.fill();
      };
      drawPaths(2.7, '#CDB27C');
      drawPaths(2.3, '#EAD7A8');
      // 놀이동산 바닥: 따뜻한 빛깔 타일
      const ex = px(PARK.x), ez = px(PARK.z);
      ctx.fillStyle = '#D9B48C';
      ctx.beginPath(); ctx.ellipse(ex, ez, (PARK.rx + 0.25) * u, (PARK.rz + 0.25) * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F3DDBF';
      ctx.beginPath(); ctx.ellipse(ex, ez, PARK.rx * u, PARK.rz * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ez, PARK.rx * u, PARK.rz * u, 0, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(205,165,125,.45)';
      ctx.lineWidth = 2;
      for (let gx = -PARK.rx; gx <= PARK.rx; gx += 1.1) { ctx.beginPath(); ctx.moveTo(px(gx), px(PARK.z - PARK.rz)); ctx.lineTo(px(gx), px(PARK.z + PARK.rz)); ctx.stroke(); }
      for (let gz = PARK.z - PARK.rz; gz <= PARK.z + PARK.rz; gz += 1.1) { ctx.beginPath(); ctx.moveTo(px(-PARK.rx), px(gz)); ctx.lineTo(px(PARK.rx), px(gz)); ctx.stroke(); }
      // 색종이 같은 점
      const conf = ['#F6A2C4', '#7EC8F2', '#F6D55C', '#A8E0B5'];
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = conf[i % 4];
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(px(PARK.x + (rnd() - 0.5) * 2 * PARK.rx), px(PARK.z + (rnd() - 0.5) * 2 * PARK.rz), 3 + rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // 입구에서 들어오는 길
      ctx.fillStyle = '#EAD7A8';
      ctx.fillRect(px(-1.15), px(15), 2.3 * u, 2.4 * u);
      // 길 위 작은 돌
      for (let i = 0; i < 260; i++) {
        const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60;
        if (!nearPath(x, z, -0.4)) continue;
        ctx.fillStyle = rnd() < 0.5 ? '#DCC594' : '#F3E4BE';
        ctx.beginPath(); ctx.ellipse(px(x), px(z), 3 + rnd() * 5, 2 + rnd() * 4, rnd() * 3, 0, 7); ctx.fill();
      }
      // 광장 무늬
      ctx.strokeStyle = 'rgba(190,160,110,.6)';
      ctx.lineWidth = 5;
      for (const rr of [2.2, 4.0]) {
        ctx.beginPath(); ctx.arc(px(PLAZA.x), px(PLAZA.z), rr * u, 0, Math.PI * 2); ctx.stroke();
      }
      // 연못 둘레
      ctx.fillStyle = '#7DB85A';
      ctx.beginPath(); ctx.ellipse(px(-9.5), px(13), 4.6 * u, 3.9 * u, 0, 0, 7); ctx.fill();
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / SPAN, 1 / SPAN);
    tex.offset.set(0.5, 0.5);
    const shape = new THREE.Shape();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const r = islandRadius(a);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? shape.lineTo(x, y) : shape.moveTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 3, curveSegments: 4 });
    const top = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
    const side = toon('#B88A5C');
    const island = new THREE.Mesh(geo, [top, side]);
    island.rotation.x = -Math.PI / 2;
    island.position.y = -0.9 - 0.25;
    island.receiveShadow = true;
    this.scene.add(island);
    this.ground = island;
  }

  buildWater() {
    const sand = new THREE.Mesh(new THREE.RingGeometry(28, 39.5, 96), toon('#F3E2B4'));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.95;
    sand.receiveShadow = true;
    this.scene.add(sand);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 64), toon('#5FC3E6'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -1.15;
    this.scene.add(sea);
    const shallow = new THREE.Mesh(new THREE.RingGeometry(38.8, 47, 96), toon('#8FDDF0', { transparent: true, opacity: 0.85 }));
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.y = -1.1;
    this.scene.add(shallow);
    this.foam = new THREE.Mesh(new THREE.RingGeometry(39.2, 39.9, 96), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7 }));
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.y = -1.0;
    this.scene.add(this.foam);
  }

  // ---------- 건물 ----------
  addObstacleBox(x, z, hw, hd, rot = 0) {
    this.obstacles.push({ t: 'b', x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot) });
  }
  addObstacleCircle(x, z, r) { this.obstacles.push({ t: 'c', x, z, r }); }

  placeBuilding(id, group, { x, z, rot, hw, hd, doorZ, name, fade = 4.2 }) {
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    group.userData.pick = { type: 'building', id };
    mergeStatic(group);
    this.scene.add(group);
    this.pickRoots.push(group);
    this.addObstacleBox(x, z, hw, hd, rot);
    const dz = doorZ;
    const door = new THREE.Vector3(x + Math.sin(rot) * dz, 0, z + Math.cos(rot) * dz);
    this.doors.push({ id, name, pos: door, group });
    this.makeFadeable(group, x, z, fade);
    return door;
  }

  makeFadeable(group, x, z, r) {
    const mats = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = list.map((mt) => {
        const c = mt.clone();
        c.userData.base = mt.opacity;
        if (this.glowMats.includes(mt)) this.glowMats.push(c);
        mats.push(c);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    const f = { x, z, r, mats, op: 1 };
    this.fadeables.push(f);
    return f;
  }

  glow(color) {
    const mt = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0 });
    this.glowMats.push(mt);
    return mt;
  }

  windowMesh(w, h, x, y, z, frame = '#FFFDF7') {
    const g = new THREE.Group();
    g.add(box(w + 0.18, h + 0.18, 0.1, toon(frame), 0, 0, -0.01));
    g.add(box(w, h, 0.12, this.glow('#9FD8F0'), 0, 0, 0.01));
    g.add(box(w, 0.07, 0.14, toon(frame), 0, 0, 0.03));
    g.add(box(0.07, h, 0.14, toon(frame), 0, 0, 0.03));
    g.position.set(x, y, z);
    return g;
  }

  buildBuildings() {
    // 암송의 집
    {
      const g = new THREE.Group();
      g.add(box(6.4, 0.36, 5.2, toon('#D9C8A8'), 0, 0.18, 0));
      g.add(box(5.6, 3.0, 4.4, toon('#FFF3D9'), 0, 1.86, 0));
      g.add(box(5.72, 0.34, 4.52, toon('#E9C99E'), 0, 0.52, 0));
      const roof = prism(6.8, 2.5, 5.4, toon('#EC7A5C'));
      roof.position.y = 3.34;
      g.add(roof);
      const gable = prism(5.4, 2.0, 0.12, toon('#FFF3D9'));
      gable.position.set(0, 3.36, 2.16);
      g.add(gable);
      const round = cyl(0.42, 0.42, 0.12, this.glow('#9FD8F0'), 0, 4.15, 2.28, 24);
      round.rotation.x = Math.PI / 2;
      g.add(round);
      const ring = m(new THREE.TorusGeometry(0.44, 0.07, 8, 24), toon('#FFFDF7'), 0, 4.15, 2.3);
      g.add(ring);
      // 문
      g.add(box(1.6, 2.15, 0.12, toon('#E9C99E'), 0, 1.42, 2.22));
      g.add(box(1.3, 1.75, 0.16, toon('#A06E45'), 0, 1.25, 2.25));
      const arch = cyl(0.65, 0.65, 0.16, toon('#A06E45'), 0, 2.1, 2.25, 24);
      arch.rotation.x = Math.PI / 2;
      g.add(arch);
      g.add(ball(0.08, toon('#F4C542'), 0.42, 1.3, 2.36));
      g.add(this.windowMesh(1.1, 1.1, -1.85, 2.0, 2.24));
      g.add(this.windowMesh(1.1, 1.1, 1.85, 2.0, 2.24));
      for (const s of [-1, 1]) {
        g.add(box(1.3, 0.3, 0.4, toon('#A06E45'), s * 1.85, 1.3, 2.42));
        for (let i = 0; i < 4; i++) g.add(ball(0.11, toon(['#EF6461', '#F6D55C', '#F6A2C4', '#FAF6EC'][i]), s * 1.85 - 0.45 + i * 0.3, 1.5, 2.45, 10));
      }
      g.add(box(0.6, 1.3, 0.6, toon('#C9654F'), 1.7, 4.8, -0.9));
      const sign = signMesh('암송의 집', 2.6, { bg: '#FFF6E0', fg: '#8B4A2E', border: '#EC7A5C' });
      sign.position.set(0, 3.08, 2.42);
      g.add(sign);
      // 칠판
      const easel = new THREE.Group();
      easel.add(box(0.08, 1.5, 0.08, toon('#A06E45'), -0.55, 0.75, 0));
      easel.add(box(0.08, 1.5, 0.08, toon('#A06E45'), 0.55, 0.75, 0));
      const board = m(new THREE.BoxGeometry(1.4, 0.95, 0.06), [toon('#A06E45'), toon('#A06E45'), toon('#A06E45'), toon('#A06E45'),
        new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: canvasTexture(256, 176, (ctx, w, h) => {
          ctx.fillStyle = '#3F6B4E'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#A06E45'; ctx.lineWidth = 12; ctx.strokeRect(0, 0, w, h);
          ctx.fillStyle = '#FFFDF2'; ctx.textAlign = 'center'; ctx.font = `40px ${FONT}`;
          ctx.fillText('말씀', w / 2, 74); ctx.fillText('외워요!', w / 2, 126);
        }) }), toon('#A06E45')], 0, 1.25, 0.04);
      easel.add(board);
      easel.position.set(3.3, 0, 3.0);
      easel.rotation.y = -0.4;
      g.add(easel);
      this.placeBuilding('memory', g, { x: -10.6, z: -12.2, rot: 0.32, hw: 3.2, hd: 2.6, doorZ: 3.4, name: '암송의 집' });
    }

    // 필사 도서관
    {
      const g = new THREE.Group();
      g.add(box(6.8, 0.36, 5.2, toon('#D9D2C2'), 0, 0.18, 0));
      g.add(box(6.0, 3.3, 4.4, toon('#EAF2FF'), 0, 2.0, 0));
      const roof = prism(7.0, 2.3, 5.4, toon('#5B8BD9'));
      roof.position.y = 3.62;
      g.add(roof);
      const gable = prism(5.8, 1.8, 0.12, toon('#EAF2FF'));
      gable.position.set(0, 3.64, 2.16);
      g.add(gable);
      g.add(box(3.8, 0.25, 1.4, toon('#FFFDF7'), 0, 3.4, 2.75));
      for (const s of [-1, 1]) g.add(cyl(0.18, 0.2, 3.0, toon('#FFFDF7'), s * 1.55, 1.85, 3.2, 16));
      g.add(box(1.8, 2.3, 0.16, toon('#7C5235'), 0, 1.5, 2.25));
      g.add(box(0.05, 2.2, 0.2, toon('#5E3D27'), 0, 1.5, 2.28));
      g.add(this.windowMesh(0.9, 1.5, -2.2, 2.1, 2.24));
      g.add(this.windowMesh(0.9, 1.5, 2.2, 2.1, 2.24));
      const sign = signMesh('필사 도서관', 2.8, { bg: '#FFFDF7', fg: '#2F4A8A', border: '#5B8BD9' });
      sign.position.set(0, 4.35, 2.26);
      g.add(sign);
      // 연필 탑
      const pencil = new THREE.Group();
      pencil.add(cyl(0.6, 0.6, 5.6, toon('#F6D55C'), 0, 2.8, 0, 6));
      pencil.add(cyl(0.62, 0.62, 0.4, toon('#C9C9CF'), 0, 0.5, 0, 6));
      pencil.add(cyl(0.62, 0.62, 0.5, toon('#F6A2C4'), 0, 0.2, 0, 6));
      pencil.add(cyl(0.18, 0.6, 1.1, toon('#F3D2A2'), 0, 6.15, 0, 6));
      pencil.add(cyl(0.0, 0.18, 0.34, toon('#3B3B42'), 0, 6.87, 0, 6));
      pencil.position.set(3.7, 0, -0.9);
      g.add(pencil);
      // 책 더미
      const books = ['#EF6461', '#4FA36C', '#4D7DDB', '#F49A4C'];
      books.forEach((c, i) => g.add(box(1.0 - i * 0.06, 0.24, 0.7, toon(c), -2.9 + (i % 2) * 0.08, 0.48 + i * 0.25, 3.1)));
      this.placeBuilding('library', g, { x: 10.8, z: -12.2, rot: -0.32, hw: 3.5, hd: 2.6, doorZ: 3.6, name: '필사 도서관' });
    }

    // 열매 상점
    {
      const g = new THREE.Group();
      g.add(box(6.0, 0.36, 4.8, toon('#D9C8A8'), 0, 0.18, 0));
      g.add(box(5.4, 2.8, 4.2, toon('#FFE9C7'), 0, 1.76, 0));
      const roof = prism(6.2, 1.8, 5.0, toon('#B5774B'));
      roof.position.y = 3.14;
      g.add(roof);
      const gable = prism(5.2, 1.4, 0.12, toon('#FFE9C7'));
      gable.position.set(0, 3.16, 2.06);
      g.add(gable);
      const stripes = canvasTexture(256, 64, (ctx, w, h) => {
        for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#FFFDF7' : '#EF6461'; ctx.fillRect(i * 32, 0, 32, h); }
      });
      const awning = m(new THREE.BoxGeometry(5.6, 0.1, 1.7), new THREE.MeshToonMaterial({ map: stripes, gradientMap: toonGradient() }), 0, 2.85, 2.75);
      awning.rotation.x = 0.38;
      g.add(awning);
      for (let i = 0; i < 9; i++) g.add(ball(0.32, toon(i % 2 ? '#FFFDF7' : '#EF6461'), -2.5 + i * 0.625, 2.5, 3.5, 12));
      g.add(box(1.4, 2.0, 0.16, this.glow('#BFE6F2'), 0, 1.36, 2.15));
      g.add(box(1.5, 0.08, 0.2, toon('#A06E45'), 0, 2.38, 2.18));
      const apple = ball(0.85, toon('#EF6461'), 0, 5.35, 0, 24);
      g.add(apple);
      g.add(cyl(0.06, 0.08, 0.4, toon('#6B4429'), 0, 6.3, 0, 8));
      const leaf = ball(0.25, toon('#6CC24A'), 0.25, 6.3, 0, 12);
      leaf.scale.set(1, 0.4, 0.6);
      g.add(leaf);
      const fruitCols = [['#EF6461', '#F49A4C'], ['#F6D55C', '#A2D86E']];
      for (const [s, cols] of [[-1, fruitCols[0]], [1, fruitCols[1]]]) {
        g.add(box(1.2, 0.7, 0.9, toon('#C99B6A'), s * 2.0, 0.71, 3.0));
        for (let i = 0; i < 6; i++) g.add(ball(0.2, toon(cols[i % 2]), s * 2.0 - 0.4 + (i % 3) * 0.4, 1.16, 2.8 + Math.floor(i / 3) * 0.4, 12));
      }
      const sign = signMesh('열매 상점', 2.4, { bg: '#FFFDF7', fg: '#C2453A', border: '#B5774B' });
      sign.position.set(0, 3.55, 2.15);
      g.add(sign);
      const soon = signMesh('곧 열려요', 1.2, { bg: '#F6D55C', fg: '#6B4429', border: '#E2A93B', w: 320, h: 120 });
      soon.position.set(0, 1.55, 2.3);
      g.add(soon);
      this.placeBuilding('shop', g, { x: 16.6, z: 1.6, rot: -0.75, hw: 3.0, hd: 2.4, doorZ: 3.9, name: '열매 상점' });
    }

    // 묵상의 숲 (정자)
    {
      const g = new THREE.Group();
      g.add(cyl(3.0, 3.1, 0.4, toon('#C99B6A'), 0, 0.2, 0, 32));
      g.add(box(1.6, 0.2, 0.8, toon('#B88A5C'), 0, 0.1, 3.2));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        g.add(cyl(0.14, 0.16, 2.7, toon('#A06E45'), Math.sin(a) * 2.6, 1.7, Math.cos(a) * 2.6, 10));
      }
      g.add(cyl(0.2, 3.7, 1.5, toon('#6FAE5A'), 0, 3.75, 0, 28));
      g.add(cyl(0.1, 2.6, 1.3, toon('#82C46A'), 0, 4.6, 0, 24));
      g.add(ball(0.32, toon('#F6D55C'), 0, 5.35, 0, 12));
      const lantern = ball(0.26, this.glow('#FFE7A8'), 0, 2.55, 0, 14);
      g.add(lantern);
      g.add(box(2.2, 0.16, 0.6, toon('#A06E45'), 0, 0.85, -1.2));
      g.add(box(0.12, 0.45, 0.5, toon('#A06E45'), -0.9, 0.62, -1.2));
      g.add(box(0.12, 0.45, 0.5, toon('#A06E45'), 0.9, 0.62, -1.2));
      const post = new THREE.Group();
      post.add(box(0.14, 1.6, 0.14, toon('#A06E45'), 0, 0.8, 0));
      const sign = signMesh('묵상의 숲', 2.2, { bg: '#FFFDF7', fg: '#3F7A4A', border: '#6FAE5A', sub: '날마다 새 말씀' });
      sign.position.set(0, 1.75, 0.1);
      post.add(sign);
      post.position.set(1.8, 0, 3.6);
      post.rotation.y = -0.2;
      g.add(post);
      this.placeBuilding('qt', g, { x: -17, z: 1.8, rot: 0.85, hw: 2.9, hd: 2.9, doorZ: 4.2, name: '묵상의 숲', fade: 3.6 });
    }

    // 내 집
    {
      const g = new THREE.Group();
      this.home = g;
      g.add(box(5.0, 0.32, 4.4, toon('#D9C8A8'), 0, 0.16, 0));
      g.add(box(4.4, 2.5, 3.8, toon('#E2B47F'), 0, 1.57, 0));
      for (let i = 0; i < 6; i++) g.add(box(4.46, 0.06, 3.86, toon('#C99862'), 0, 0.55 + i * 0.4, 0));
      const roofMat = toon('#4FA36C').clone();
      roofMat.userData.isRoof = true;
      const roof = prism(5.4, 2.1, 4.6, roofMat);
      roof.position.y = 2.82;
      g.add(roof);
      const gable = prism(4.2, 1.7, 0.12, toon('#E2B47F'));
      gable.position.set(0, 2.84, 1.86);
      g.add(gable);
      g.add(box(1.2, 1.8, 0.14, toon('#8B5E3C'), -0.6, 1.22, 1.94));
      g.add(ball(0.07, toon('#F4C542'), -0.25, 1.2, 2.04));
      g.add(this.windowMesh(1.0, 0.9, 1.15, 1.6, 1.94));
      g.add(box(0.5, 0.9, 0.5, toon('#9C8F86'), 1.3, 4.0, -0.8));
      // 우체통
      g.add(box(0.1, 1.0, 0.1, toon('#8B5E3C'), -2.6, 0.5, 2.4));
      g.add(box(0.45, 0.35, 0.6, toon('#EF6461'), -2.6, 1.15, 2.4));
      // 울타리
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) g.add(box(0.12, 0.7, 0.12, toon('#FFFDF7'), s * (1.6 + i * 0.5), 0.35, 2.9));
        g.add(box(1.7, 0.1, 0.08, toon('#FFFDF7'), s * 2.35, 0.5, 2.9));
      }
      this.homeSign = signMesh('내 집', 2.2, { bg: '#FFFDF7', fg: '#6B4429', border: '#8B5E3C' });
      this.homeSign.position.set(0, 4.15, 2.0);
      g.add(this.homeSign);
      this.placeBuilding('home', g, { x: 0, z: -21, rot: 0, hw: 2.6, hd: 2.3, doorZ: 3.2, name: '내 집' });
    }
  }

  setHome(name, avatar) {
    const tex = signTexture(`${name}의 집`, { bg: '#FFFDF7', fg: '#6B4429', border: '#8B5E3C' });
    const mats = Array.isArray(this.homeSign.material) ? this.homeSign.material : [this.homeSign.material];
    for (const mt of mats) if (mt.map) { mt.map.dispose(); mt.map = tex; mt.needsUpdate = true; }
    const roofC = shade(colorOf(avatar, 'outfitColor'), 0.05);
    this.home.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.isRoof) o.material.color.set(roofC); });
    const d = this.doors.find((dd) => dd.id === 'home');
    if (d) d.name = `${name}의 집`;
  }

  // ---------- 광장 ----------
  buildPlaza() {
    const tree = new THREE.Group();
    tree.add(cyl(0.5, 0.75, 3.2, toon('#8A5A3B'), 0, 1.6, 0, 14));
    const leaf = [toon('#5FAE4E'), toon('#6DBE5A'), toon('#57A148')];
    tree.add(ball(2.4, leaf[0], 0, 4.6, 0, 22));
    tree.add(ball(1.8, leaf[1], -1.6, 4.0, 0.4, 18));
    tree.add(ball(1.8, leaf[2], 1.6, 4.1, -0.2, 18));
    tree.add(ball(1.6, leaf[1], 0.2, 6.0, -0.4, 18));
    const lights = ['#FFF2B3', '#FFD6E0', '#D8F0FF'];
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, y = 3.4 + r() * 3;
      const rr = 2.0 + r() * 0.5;
      tree.add(ball(0.12, this.glow(lights[i % 3]), Math.cos(a) * rr, y, Math.sin(a) * rr + 0.3, 8));
    }
    tree.position.set(0, 0, -4.4);
    mergeStatic(tree);
    this.scene.add(tree);
    this.addObstacleCircle(0, -4.4, 0.95);
    this.makeFadeable(tree, 0, -4.4, 3.2);
    // 둘레 의자 (앉을 수 있다)
    this.addBench(-3.6, -2.0, 1.2);
    this.addBench(3.6, -2.0, -1.2);
    // 게시판
    const board = new THREE.Group();
    board.add(box(0.16, 2.3, 0.16, toon('#8B5E3C'), -1.3, 1.15, 0));
    board.add(box(0.16, 2.3, 0.16, toon('#8B5E3C'), 1.3, 1.15, 0));
    board.add(box(2.9, 1.7, 0.14, toon('#A06E45'), 0, 1.75, 0));
    const roof = prism(3.3, 0.5, 0.6, toon('#EC7A5C'));
    roof.position.set(0, 2.65, 0);
    board.add(roof);
    this.boardMat = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: this.boardTexture('') });
    const paper = m(new THREE.PlaneGeometry(2.5, 1.38), this.boardMat, 0, 1.75, 0.08);
    paper.rotation.z = 0.015;
    board.add(paper);
    board.position.set(4.6, 0, -6.2);
    board.rotation.y = -0.35;
    board.userData.pick = { type: 'board' };
    this.scene.add(board);
    this.pickRoots.push(board);
    this.addObstacleBox(4.6, -6.2, 1.5, 0.3, -0.35);
    this.doors.push({ id: 'board', name: '마을 게시판', pos: new THREE.Vector3(4.6 + Math.sin(-0.35) * 1.4, 0, -6.2 + Math.cos(-0.35) * 1.4), group: board });
    // 가로등
    for (const [x, z] of [[-2.2, 9], [2.2, 4], [-6.4, -9], [6.4, -9], [-9, -1.6], [9, -1.6], [2, -14]]) {
      this.scene.add(cyl(0.09, 0.12, 2.6, toon('#4A4A55'), x, 1.3, z, 8));
      this.scene.add(ball(0.26, this.glow('#FFF4CF'), x, 2.75, z, 12));
      this.addObstacleCircle(x, z, 0.25);
    }
  }

  boardTexture(ref) {
    return canvasTexture(512, 284, (ctx, w, h) => {
      ctx.fillStyle = '#FFFBEF';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#EF6461';
      ctx.beginPath(); ctx.arc(w / 2, 22, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#6B4429';
      ctx.textAlign = 'center';
      ctx.font = `40px ${FONT}`;
      ctx.fillText('이번 주 말씀', w / 2, 92);
      ctx.fillStyle = '#3F7A4A';
      let size = 54;
      ctx.font = `${size}px ${FONT}`;
      const t = ref || '곧 올라와요';
      while (ctx.measureText(t).width > w - 50 && size > 28) { size -= 2; ctx.font = `${size}px ${FONT}`; }
      ctx.fillText(t, w / 2, 176);
      ctx.font = `26px ${FONT}`;
      ctx.fillStyle = '#9A7B5E';
      ctx.fillText('눌러서 읽어 보세요', w / 2, 238);
    });
  }

  setBoard(ref) {
    const t = this.boardTexture(ref);
    const old = this.boardMat.map;
    this.boardMat.map = t;
    this.boardMat.needsUpdate = true;
    if (old) old.dispose();
  }

  // ---------- 놀이 마당: 낚시터, 오목 탁자, 숲속 부엌, 그림 공방 ----------
  spot(id, name, group, { x, z, rot = 0, door, hw = 0, hd = 0 }) {
    this.spots = this.spots || {};
    this.spots[id] = { x, z, rot, group };
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    group.userData.pick = { type: 'building', id };
    mergeStatic(group);
    this.scene.add(group);
    this.pickRoots.push(group);
    if (hw) this.addObstacleBox(x, z, hw, hd, rot);
    this.doors.push({ id, name, pos: new THREE.Vector3(x + Math.sin(rot) * door, 0, z + Math.cos(rot) * door), group });
  }
  postSign(text, w = 1.6) {
    const g = new THREE.Group();
    g.add(box(0.12, 1.25, 0.12, toon('#8B5E3C'), 0, 0.62, 0));
    const sg = signMesh(text, w, { bg: '#FFFDF7', fg: '#6B4429', border: '#8B5E3C' });
    sg.position.set(0, 1.4, 0.07);
    g.add(sg);
    return g;
  }
  buildPlayground() {
    const wood = toon('#A06E45'), dark = toon('#7A5233'), cream = toon('#FFFDF7');
    // 낚시터: 연못 동쪽 나무 데크 (앞쪽이 +z, 돌려서 연못 쪽으로)
    {
      const g = new THREE.Group();
      g.add(box(1.4, 0.12, 2.6, wood, 0, 0.14, -1.0));
      for (let i = 0; i < 6; i++) g.add(box(1.42, 0.02, 0.05, dark, 0, 0.21, -2.2 + i * 0.45));
      for (const [dx, dz] of [[-0.6, -2.2], [0.6, -2.2], [-0.6, 0.1], [0.6, 0.1]]) g.add(cyl(0.08, 0.08, 0.55, dark, dx, -0.05, dz, 6));
      g.add(cyl(0.22, 0.17, 0.36, toon('#7EC8F2'), 0.85, 0.18, 0.55, 12));
      g.add(cyl(0.2, 0.2, 0.02, toon('#5FB0D8'), 0.85, 0.37, 0.55, 12));
      const sign = this.postSign('낚시터', 1.4);
      sign.position.set(-1.1, 0, 0.5);
      sign.rotation.y = -Math.PI / 2;
      g.add(sign);
      this.spot('fish', '반짝 연못 낚시터', g, { x: -5.6, z: 12.9, rot: Math.PI / 2, door: 1.3 });
    }
    // 오목 탁자
    {
      const g = new THREE.Group();
      g.add(box(1.9, 0.12, 1.15, wood, 0, 0.8, 0));
      for (const sx of [-0.8, 0.8]) for (const sz of [-0.42, 0.42]) g.add(box(0.12, 0.8, 0.12, dark, sx, 0.4, sz));
      for (const sz of [-1.0, 1.0]) {
        g.add(box(1.9, 0.1, 0.36, wood, 0, 0.46, sz));
        for (const sx of [-0.8, 0.8]) g.add(box(0.1, 0.45, 0.3, dark, sx, 0.22, sz));
      }
      const bmat = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: canvasTexture(256, 256, (ctx, w) => {
        ctx.fillStyle = '#E9C27D'; ctx.fillRect(0, 0, w, w);
        ctx.strokeStyle = '#7A5233'; ctx.lineWidth = 2;
        for (let i = 0; i < 13; i++) { const v = 18 + i * 18.4; ctx.beginPath(); ctx.moveTo(18, v); ctx.lineTo(238, v); ctx.stroke(); ctx.beginPath(); ctx.moveTo(v, 18); ctx.lineTo(v, 238); ctx.stroke(); }
        const st = [[6, 6, 1], [7, 6, 0], [7, 7, 1], [5, 7, 0], [8, 8, 1], [6, 8, 0]];
        for (const [i, j, b] of st) { ctx.fillStyle = b ? '#2E2A2A' : '#FFFDF7'; ctx.beginPath(); ctx.arc(18 + i * 18.4, 18 + j * 18.4, 7.5, 0, 7); ctx.fill(); }
      }) });
      const top = m(new THREE.PlaneGeometry(0.9, 0.9), bmat, 0, 0.865, 0, false);
      top.rotation.x = -Math.PI / 2;
      top.userData.noMerge = true;
      g.add(top);
      g.add(box(0.98, 0.04, 0.98, toon('#C99862'), 0, 0.85, 0));
      for (const [bx, c] of [[-0.75, '#2E2A2A'], [0.75, '#FFFDF7']]) g.add(cyl(0.16, 0.14, 0.12, toon(c === '#2E2A2A' ? '#5A4636' : '#E8D9BF'), bx, 0.92, 0, 12));
      const sign = this.postSign('오목 놀이터', 1.7);
      sign.position.set(-1.45, 0, 0.9);
      g.add(sign);
      this.spot('omok', '오목 놀이터', g, { x: 8.0, z: 17.6, rot: 0.15, door: 1.8, hw: 1.05, hd: 1.25 });
    }
    // 숲속 부엌
    {
      const g = new THREE.Group();
      g.add(box(2.6, 0.9, 0.8, toon('#E2B47F'), 0, 0.45, -0.35));
      g.add(box(2.7, 0.08, 0.9, cream, 0, 0.94, -0.35));
      for (const sx of [-1.25, 1.25]) g.add(box(0.12, 2.3, 0.12, dark, sx, 1.15, -0.75));
      for (let i = 0; i < 6; i++) g.add(box(0.46, 0.1, 1.1, toon(i % 2 ? '#FFFDF7' : '#EF6461'), -1.15 + i * 0.46, 2.35, -0.35));
      g.add(box(0.7, 0.05, 0.45, toon('#C99862'), -0.7, 1.0, -0.3));
      g.add(ball(0.18, toon('#D9A35C'), -0.85, 1.12, -0.32, 10));
      const fish = ball(0.13, toon('#9FC9E6'), -0.5, 1.08, -0.3, 10);
      fish.scale.set(2, 0.6, 0.8);
      g.add(fish);
      // 화덕과 냄비
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const st = ball(0.13, toon('#B7B4AC'), 1.85 + Math.cos(a) * 0.45, 0.1, 0.5 + Math.sin(a) * 0.45, 8);
        st.scale.y = 0.7;
        g.add(st);
      }
      g.add(cyl(0.38, 0.3, 0.42, toon('#4A4A55'), 1.85, 0.48, 0.5, 14));
      g.add(cyl(0.36, 0.36, 0.02, toon('#C9733F'), 1.85, 0.7, 0.5, 14));
      g.add(ball(0.16, this.glow('#F6A54C'), 1.85, 0.16, 0.5, 8));
      const sign = this.postSign('숲속 부엌', 1.6);
      sign.position.set(-1.75, 0, 0.6);
      g.add(sign);
      this.spot('cook', '숲속 부엌', g, { x: 14.7, z: 16.4, rot: -0.4, door: 1.9, hw: 1.5, hd: 0.9 });
    }
    // 그림 공방: 전시 벽과 이젤
    {
      const g = new THREE.Group();
      g.add(box(5.8, 2.6, 0.24, toon('#FFF3DA'), 0, 1.55, 0));
      g.add(box(6.0, 0.2, 0.34, wood, 0, 2.9, 0));
      g.add(box(6.0, 0.2, 0.34, wood, 0, 0.2, 0));
      for (const sx of [-2.95, 2.95]) g.add(box(0.2, 2.9, 0.34, wood, sx, 1.45, 0));
      const roof = prism(6.4, 0.7, 0.8, toon('#EC7A5C'));
      roof.position.set(0, 3.0, 0);
      g.add(roof);
      this.artFrames = [];
      [-1.85, 0, 1.85].forEach((fx) => {
        g.add(box(1.62, 1.42, 0.06, toon('#8B5E3C'), fx, 1.6, 0.14));
        const mat = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: this.artTexture(null) });
        const pic = m(new THREE.PlaneGeometry(1.46, 1.26), mat, fx, 1.6, 0.18, false);
        pic.userData.noMerge = true;
        g.add(pic);
        this.artFrames.push(mat);
      });
      // 이젤
      const e = new THREE.Group();
      for (const [lx, rz] of [[-0.35, 0.12], [0.35, -0.12]]) { const leg = box(0.08, 1.9, 0.08, dark, lx, 0.95, 0.15); leg.rotation.z = rz; e.add(leg); }
      e.add(box(0.08, 1.8, 0.08, dark, 0, 0.9, -0.3));
      e.add(box(1.0, 0.75, 0.05, cream, 0, 1.35, 0.2));
      this.easelMat = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), map: canvasTexture(64, 48, (ctx, w, hh) => { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(0, 0, w, hh); }) });
      const pic = m(new THREE.PlaneGeometry(0.9, 0.66), this.easelMat, 0, 1.35, 0.23, false);
      pic.userData.noMerge = true;
      e.add(pic);
      e.add(box(0.9, 0.06, 0.12, dark, 0, 0.95, 0.24));
      // 받침대 위 물감 통 (그림판은 아이 그림이 걸리도록 비워 둔다)
      for (let i = 0; i < 4; i++) e.add(cyl(0.045, 0.04, 0.06, toon(['#EF6461', '#F6D55C', '#5DB760', '#7EC8F2'][i]), -0.3 + i * 0.2, 1.01, 0.26, 10));
      e.position.set(3.7, 0, 0.6);
      e.rotation.y = -0.4;
      g.add(e);
      const sign = this.postSign('그림 공방', 1.6);
      sign.position.set(-3.6, 0, 0.6);
      g.add(sign);
      this.spot('art', '그림 공방', g, { x: 11.2, z: 11.5, rot: 0, door: 1.7, hw: 3.0, hd: 0.3 });
    }
    // 마을 식탁: 아이들이 마음대로 만든 요리 네 접시를 올려 둔다
    {
      const g = new THREE.Group();
      g.add(box(2.8, 0.08, 1.05, wood, 0, 0.76, 0));
      g.add(box(2.86, 0.02, 1.11, cream, 0, 0.81, 0));
      for (const sx of [-1.43, 1.43]) g.add(box(0.03, 0.12, 1.11, toon('#EF6461'), sx, 0.77, 0));
      for (const sx of [-1.25, 1.25]) for (const sz of [-0.4, 0.4]) g.add(box(0.1, 0.76, 0.1, dark, sx, 0.38, sz));
      const sign = this.postSign('마을 식탁', 1.5);
      sign.position.set(-1.9, 0, 0.3);
      g.add(sign);
      g.position.set(11.2, 0, 20.6);
      mergeStatic(g);
      this.scene.add(g);
      this.addObstacleBox(11.2, 20.6, 1.5, 0.62, 0);
      this.addObstacleBox(9.3, 20.9, 0.15, 0.15, 0);
      this.dishTable = new THREE.Group();
      this.dishTable.position.set(11.2, 0, 20.6);
      this.scene.add(this.dishTable);
    }
  }

  // 마을 식탁 접시 (items: [{id, name, kind, items, cook}] 최근 4개)
  setDishTable(list) {
    if (!this.dishTable || !this.buildDish) return;
    for (const c of [...this.dishTable.children]) {
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mt = o.material;
        if (mt && mt.userData && mt.userData.own) { if (mt.map) mt.map.dispose(); mt.dispose(); }
      });
      c.removeFromParent();
    }
    (list || []).slice(0, 4).forEach((d, i) => {
      const x = -1.0 + i * 0.67;
      const dish = this.buildDish(d.kind, d.items || [], d.id || i + 1);
      dish.scale.setScalar(1.25);
      dish.position.set(x, 0.84, -0.05);
      this.dishTable.add(dish);
      const tex = canvasTexture(256, 96, (ctx, w, hh) => {
        ctx.fillStyle = '#FFFDF7'; ctx.fillRect(0, 0, w, hh);
        ctx.strokeStyle = '#E8B04A'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, hh - 6);
        ctx.fillStyle = '#6B4429'; ctx.textAlign = 'center';
        let size = 30;
        ctx.font = `${size}px ${FONT}`;
        const name = String(d.name || '');
        while (ctx.measureText(name).width > w - 20 && size > 16) { size -= 1; ctx.font = `${size}px ${FONT}`; }
        ctx.fillText(name, w / 2, 44);
        ctx.font = `20px ${FONT}`;
        ctx.globalAlpha = 0.8;
        ctx.fillText(`${d.cook || '친구'}의 요리`, w / 2, 78);
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      mat.userData.own = true;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.22), mat);
      card.position.set(x, 0.95, 0.42);
      card.rotation.x = -0.55;
      this.dishTable.add(card);
    });
  }

  artTexture(item) {
    return canvasTexture(320, 276, (ctx, w, hh) => {
      ctx.fillStyle = '#FFFDF7';
      ctx.fillRect(0, 0, w, hh);
      if (item && item.img) {
        ctx.drawImage(item.img, 0, 0, w, 240);
      } else {
        ctx.fillStyle = '#E9DCC6';
        ctx.font = `30px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('그림을 기다려요', w / 2, 130);
      }
      ctx.fillStyle = '#6B4429';
      ctx.fillRect(0, 240, w, 36);
      if (item) {
        ctx.fillStyle = '#FFF6E0';
        ctx.textAlign = 'center';
        let size = 22;
        const label = item.title ? `${item.name} · ${item.title}` : item.name;
        ctx.font = `${size}px ${FONT}`;
        while (ctx.measureText(label).width > w - 20 && size > 13) { size -= 1; ctx.font = `${size}px ${FONT}`; }
        ctx.fillText(label, w / 2, 266);
      }
    });
  }

  // 이젤에 방금 그린 그림을 올려 둔다
  async setEasel(b64) {
    if (!this.easelMat || !b64) return;
    try {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const t = canvasTexture(320, 240, (ctx, w, hh) => ctx.drawImage(img, 0, 0, w, hh));
      const old = this.easelMat.map;
      this.easelMat.map = t;
      this.easelMat.needsUpdate = true;
      if (old) old.dispose();
    } catch (e) { /* 그대로 둔다 */ }
  }

  // items: [{name, title, thumb(base64 jpeg)}] 최근 3장
  async setArtWall(items) {
    if (!this.artFrames) return;
    const loaded = await Promise.all(this.artFrames.map(async (mat, i) => {
      const it = items && items[i];
      if (!it || !it.thumb) return null;
      try {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${it.thumb}`;
        await img.decode();
        return { ...it, img };
      } catch (e) { return { ...it, img: null }; }
    }));
    this.artFrames.forEach((mat, i) => {
      const old = mat.map;
      mat.map = this.artTexture(loaded[i]);
      mat.needsUpdate = true;
      if (old) old.dispose();
    });
  }

  // ---------- 벤치: 눌러서 앉는다 (한 벤치에 둘) ----------
  addBench(x, z, ry) {
    const b = new THREE.Group();
    b.add(box(1.8, 0.14, 0.55, toon('#A06E45'), 0, 0.55, 0));
    b.add(box(1.8, 0.5, 0.1, toon('#A06E45'), 0, 0.9, -0.25));
    b.add(box(0.12, 0.5, 0.5, toon('#6B4429'), -0.75, 0.28, 0));
    b.add(box(0.12, 0.5, 0.5, toon('#6B4429'), 0.75, 0.28, 0));
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    mergeStatic(b);
    const i = this.benches.length;
    b.userData.pick = { type: 'bench', i };
    this.scene.add(b);
    this.pickRoots.push(b);
    this.addObstacleBox(x, z, 0.95, 0.35, ry);
    this.benches.push({ x, z, ry });
  }
  buildBenches() {
    this.addBench(-6.9, 17.0, -2.565); // 연못을 보는 벤치
    this.addBench(-4.0, 18.6, 1.107); // 놀이동산: 회전목마를 본다
    this.addBench(4.0, 18.6, -1.107);
    this.addBench(-6.0, 27.4, Math.PI / 2); // 범퍼카를 본다
    this.addBench(-2.7, -14.6, Math.PI / 2); // 내 집 가는 길
  }
  // 벤치 i의 왼쪽(0)·오른쪽(1) 자리: 앉았을 때 발밑 위치와 방향
  benchSeat(i, side) {
    const b = this.benches[i];
    const lx = side ? 0.45 : -0.45, lz = 0.02;
    const c = Math.cos(b.ry), sn = Math.sin(b.ry);
    return { x: b.x + lx * c + lz * sn, y: 0.36, z: b.z - lx * sn + lz * c, rot: b.ry };
  }
  benchTaken(seat) {
    for (const r of this.remotes.values()) if (r.pin && r.pin.kind === 'bench' && r.pin.seat === seat) return true;
    return false;
  }
  walkToBench(i) {
    const b = this.benches[i];
    if (!b || !this.player) return;
    const p = this.player.root.position;
    // 비어 있는 자리 가운데 가까운 쪽
    const sides = [0, 1].filter((s) => !this.benchTaken(i * 2 + s));
    if (!sides.length) { if (this.on.onBenchFull) this.on.onBenchFull(); return; }
    sides.sort((a, c) => { const sa = this.benchSeat(i, a), sc = this.benchSeat(i, c); return Math.hypot(sa.x - p.x, sa.z - p.z) - Math.hypot(sc.x - p.x, sc.z - p.z); });
    const side = sides[0];
    const st = this.benchSeat(i, side);
    const pos = new THREE.Vector3(st.x + Math.sin(st.rot) * 0.8, 0, st.z + Math.cos(st.rot) * 0.8);
    this.resolve(pos);
    this.target = { pos, action: () => this.sit(i, side) };
    this.showTapMark(pos);
    this.reportMove(pos.x, pos.z);
  }
  sit(i, side) {
    if (this.mode !== 'play' || !this.player) return;
    this.cancelEat();
    const st = this.benchSeat(i, side);
    const pl = this.player;
    pl.root.position.set(st.x, st.y, st.z);
    pl.root.rotation.y = st.rot;
    pl.pose = benchPose;
    this.sitting = { i, side, seat: i * 2 + side };
    this.target = null;
    if (this.on.onLocalStop) this.on.onLocalStop({ x: +st.x.toFixed(2), z: +st.z.toFixed(2) });
    if (this.on.onSit) this.on.onSit(this.sitting.seat);
  }
  standUp(quiet = false) {
    if (!this.sitting || !this.player) return;
    const st = this.benchSeat(this.sitting.i, this.sitting.side);
    this.sitting = null;
    const pl = this.player;
    pl.pose = null;
    pl.root.position.set(st.x + Math.sin(st.rot) * 0.8, 0, st.z + Math.cos(st.rot) * 0.8);
    this.resolve(pl.root.position);
    if (!quiet && this.on.onSit) this.on.onSit(null);
  }
  pinBench(r, seat) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= this.benches.length * 2) return;
    if (r.pin && r.pin.kind === 'bench' && r.pin.seat === seat) return;
    this.unpinRemote(r.id);
    const st = this.benchSeat(seat >> 1, seat & 1);
    this.pinRemote(r.id, { kind: 'bench', seat, x: st.x, y: st.y, z: st.z, rot: st.rot, pose: benchPose, auto: true });
  }

  // ---------- 열매 나무: 눌러서 열매를 따 먹는다 (상점 열매와는 따로) ----------
  buildFruit(fruitGeo, fruitC) {
    const lists = [[], [], []];
    this.fruitTrees.forEach((t, ti) => {
      t.fruits = [];
      for (const p of t.pts) {
        const f = { tree: ti, c: t.c, pos: p, s: t.s, alive: true, grow: 1, idx: lists[t.c].length, regrowAt: 0 };
        lists[t.c].push(f);
        t.fruits.push(this.fruits.length);
        this.fruits.push(f);
      }
      // 나무 윗부분을 누르면 그 나무로 간다 (보이지 않는 공)
      const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(1.35 * t.s, 10, 8), proxyMat);
      proxy.position.set(t.x, 2.45 * t.s, t.z);
      proxy.userData.pick = { type: 'fruit', i: ti };
      this.scene.add(proxy);
      this.pickRoots.push(proxy);
    });
    this.fruitMeshes = lists.map((list, c) => {
      const im = new THREE.InstancedMesh(fruitGeo, fruitC[c], Math.max(1, list.length));
      im.count = list.length;
      im.castShadow = false;
      this.scene.add(im);
      return im;
    });
    for (const f of this.fruits) this.setFruit(f);
    for (const im of this.fruitMeshes) im.computeBoundingSphere();
  }
  setFruit(f) {
    const m4 = new THREE.Matrix4();
    const k = f.alive ? 1 : Math.max(0.0001, f.grow);
    m4.makeScale(f.s * k, f.s * k, f.s * k);
    m4.setPosition(f.pos);
    const im = this.fruitMeshes[f.c];
    im.setMatrixAt(f.idx, m4);
    im.instanceMatrix.needsUpdate = true;
  }
  walkToFruit(i) {
    const t = this.fruitTrees[i];
    if (!t || !this.player) return;
    const p = this.player.root.position;
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1;
    const pos = new THREE.Vector3(t.x + (dx / d) * (0.85 + 0.38 * t.s), 0, t.z + (dz / d) * (0.85 + 0.38 * t.s));
    this.resolve(pos);
    this.target = { pos, action: () => this.eatFrom(i) };
    this.showTapMark(pos);
    this.reportMove(pos.x, pos.z);
  }
  eatFrom(i) {
    if (this.mode !== 'play' || this.eating || !this.player) return;
    const t = this.fruitTrees[i];
    const p = this.player.root.position;
    let best = null, bd = Infinity;
    for (const fi of t.fruits) {
      const f = this.fruits[fi];
      if (!f.alive) continue;
      const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z) + f.pos.y * 0.3;
      if (d < bd) { bd = d; best = f; }
    }
    this.player.root.rotation.y = Math.atan2(t.x - p.x, t.z - p.z);
    if (!best) { if (this.on.onFruit) this.on.onFruit('empty', FRUIT_NAMES[t.c]); return; }
    best.alive = false;
    best.grow = 0;
    best.regrowAt = this.time + 75;
    this.setFruit(best);
    const held = handFruit(best.c);
    this.player.hold(held, 1);
    this.eating = { t: 0, f: best, held, bites: 0, c: best.c };
    this.player.pose = eatPose(this.eating);
    if (this.on.onFruit) this.on.onFruit('start', FRUIT_NAMES[best.c]);
  }
  tickEat(dt) {
    const e = this.eating;
    e.t += dt;
    const bites = [0.85, 1.35, 1.85];
    while (e.bites < 3 && e.t >= bites[e.bites]) {
      e.bites++;
      e.held.scale.setScalar(1 - e.bites * 0.3);
      if (this.on.onFruit) this.on.onFruit('bite', FRUIT_NAMES[e.c]);
    }
    if (e.t >= 2.3) this.finishEat();
  }
  finishEat() {
    const e = this.eating;
    if (!e) return;
    this.eating = null;
    this.player.drop();
    this.player.pose = null;
    resetLimbs(this.player);
    this.player.celebrate();
    if (this.on.onFruit) this.on.onFruit('done', FRUIT_NAMES[e.c]);
  }
  cancelEat() {
    if (!this.eating) return;
    const e = this.eating;
    this.eating = null;
    if (this.player) { this.player.drop(); if (this.player.pose && this.player.pose.eat) this.player.pose = null; resetLimbs(this.player); }
    // 다 못 먹은 열매는 나무로 돌아간다
    if (e.bites === 0) { e.f.alive = true; e.f.grow = 1; this.setFruit(e.f); }
    if (this.on.onFruit) this.on.onFruit('stop', FRUIT_NAMES[e.c]);
  }
  tickFruit(dt) {
    this.fruitClock = (this.fruitClock || 0) + dt;
    if (this.fruitClock < 0.1) return;
    this.fruitClock = 0;
    for (const f of this.fruits) {
      if (f.alive || this.time < f.regrowAt) continue;
      f.grow = Math.min(1, f.grow + 0.08);
      if (f.grow >= 1) f.alive = true;
      this.setFruit(f);
    }
  }

  // ---------- 나무, 꽃, 돌 ----------
  buildNature() {
    const r = rng(42);
    const trunk = toon('#8A5A3B');
    const leaves = [toon('#5FAE4E'), toon('#6DBE5A'), toon('#7ACB66'), toon('#57A148')];
    const pine = [toon('#3F8F55'), toon('#4A9C5F')];
    const fruitC = [toon('#EF6461'), toon('#F49A4C'), toon('#F6A2C4')];
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.5, 8);
    const crownGeo = new THREE.SphereGeometry(1.15, 16, 12);
    const crownGeo2 = new THREE.SphereGeometry(0.75, 14, 10);
    const coneGeo = [new THREE.ConeGeometry(1.3, 1.6, 10), new THREE.ConeGeometry(1.05, 1.4, 10), new THREE.ConeGeometry(0.75, 1.2, 10)];
    const fruitGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const blocked = (x, z, pad) => {
      if (Math.hypot(x, z) > 29.5) return true;
      if (nearPath(x, z, pad)) return true;
      for (const c of this.noTree) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
      if (Math.hypot(x + 9.5, z - 13) < 5.5) return true;
      if (Math.hypot(x, z - 9) < 4) return true;
      for (const o of this.obstacles) {
        if (o.t === 'b' && Math.hypot(x - o.x, z - o.z) < Math.max(o.hw, o.hd) + 2.6 + pad) return true;
        if (o.t === 'c' && Math.hypot(x - o.x, z - o.z) < o.r + 1.4 + pad) return true;
      }
      return false;
    };
    const inst = new Instancer(this.scene);
    const placed = [];
    const tooClose = (x, z, d) => placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < d);
    let made = 0, tries = 0;
    while (made < 78 && tries < 4000) {
      tries++;
      const a = r() * Math.PI * 2;
      const rad = 6 + Math.sqrt(r()) * 23.5;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (blocked(x, z, 1.2) || tooClose(x, z, 2.7)) continue;
      placed.push([x, z]);
      made++;
      const t = new THREE.Group();
      const s = 0.85 + r() * 0.4;
      const isPine = rad > 20 && r() < 0.45;
      let fruitLocal = null;
      if (isPine) {
        t.add(m(trunkGeo, trunk, 0, 0.75, 0));
        const pm = pine[made % 2];
        coneGeo.forEach((g, i) => t.add(m(g, pm, 0, 1.9 + i * 0.85, 0)));
      } else {
        t.add(m(trunkGeo, trunk, 0, 0.75, 0));
        const lm = leaves[made % 4];
        const c1 = m(crownGeo, lm, 0, 2.35, 0);
        c1.scale.set(1, 0.9, 1);
        t.add(c1);
        t.add(m(crownGeo2, lm, 0.55, 2.9, 0.2));
        t.add(m(crownGeo2, lm, -0.5, 2.75, -0.25));
        if (r() < 0.32) {
          // 열매는 따로 모아 그린다 (따 먹으면 사라졌다가 다시 열린다)
          fruitLocal = { c: made % 3, pts: [] };
          for (let i = 0; i < 6; i++) {
            const fa = r() * Math.PI * 2, fy = 1.9 + r() * 0.9;
            fruitLocal.pts.push([Math.cos(fa) * 1.08, fy, Math.sin(fa) * 1.08]);
          }
        }
      }
      t.position.set(x, 0, z);
      t.scale.setScalar(s);
      t.rotation.y = r() * Math.PI * 2;
      inst.addGroup(t);
      this.addObstacleCircle(x, z, 0.38 * s);
      if (fruitLocal) {
        t.updateMatrixWorld(true);
        this.fruitTrees.push({ x, z, s, c: fruitLocal.c, pts: fruitLocal.pts.map(([lx, ly, lz]) => new THREE.Vector3(lx, ly, lz).applyMatrix4(t.matrixWorld)) });
      }
    }
    // 덤불
    const bushGeo = new THREE.SphereGeometry(0.55, 12, 10);
    for (let i = 0, n = 0; i < 600 && n < 28; i++) {
      const x = (r() - 0.5) * 56, z = (r() - 0.5) * 56;
      if (blocked(x, z, 0.3)) continue;
      n++;
      const b = new THREE.Group();
      const lm = leaves[n % 4];
      b.add(m(bushGeo, lm, 0, 0.35, 0));
      b.add(m(bushGeo, lm, 0.5, 0.28, 0.1));
      b.children[1].scale.setScalar(0.75);
      if (n % 3 === 0) for (let k = 0; k < 4; k++) b.add(m(fruitGeo, toon('#F6A2C4'), Math.cos(k * 1.6) * 0.5, 0.55, Math.sin(k * 1.6) * 0.45));
      b.position.set(x, 0, z);
      inst.addGroup(b);
      this.addObstacleCircle(x, z, 0.6);
    }
    // 돌
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const rockM = toon('#B7B4AC');
    for (let i = 0, n = 0; i < 400 && n < 12; i++) {
      const x = (r() - 0.5) * 56, z = (r() - 0.5) * 56;
      if (blocked(x, z, 0.2)) continue;
      n++;
      const rk = m(rockGeo, rockM, x, 0.2, z);
      rk.scale.set(1 + r() * 0.6, 0.6 + r() * 0.4, 1 + r() * 0.5);
      rk.rotation.y = r() * 3;
      inst.addGroup(rk);
      this.addObstacleCircle(x, z, 0.55);
    }
    // 연못
    const pond = m(new THREE.CircleGeometry(3.6, 40), toon('#6FC9E9'), -9.5, 0.03, 13, false);
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(1, 0.85, 1);
    this.scene.add(pond);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const st = m(rockGeo, toon(i % 2 ? '#C8C3B8' : '#B7B4AC'), -9.5 + Math.cos(a) * 3.75, 0.08, 13 + Math.sin(a) * 3.2);
      st.scale.set(0.55, 0.35, 0.5);
      inst.addGroup(st);
    }
    inst.build();
    this.buildFruit(fruitGeo, fruitC);
    for (const [x, z] of [[-10.6, 12.2], [-8.3, 13.8], [-9.6, 14.4]]) {
      const pad = m(new THREE.CircleGeometry(0.45, 16, 0.3, Math.PI * 2 - 0.6), toon('#5FAE4E'), x, 0.06, z, false);
      pad.rotation.x = -Math.PI / 2;
      this.scene.add(pad);
    }
    this.scene.add(ball(0.12, toon('#F6A2C4'), -8.3, 0.14, 13.8, 10));
    this.addObstacleCircle(-9.5, 13, 3.3);
    // 꽃 (인스턴스)
    const petalGeo = new THREE.SphereGeometry(0.09, 8, 6);
    const centerGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const flowerCols = ['#EF6461', '#F6D55C', '#F6A2C4', '#FFFDF7', '#A07FE3', '#7EC8F2'];
    const spots = [];
    for (let i = 0; i < 4000 && spots.length < 190; i++) {
      const cx = (r() - 0.5) * 58, cz = (r() - 0.5) * 58;
      if (Math.hypot(cx, cz) > 28.5 || nearPath(cx, cz, 0.15) || Math.hypot(cx + 9.5, cz - 13) < 4.3) continue;
      if (this.obstacles.some((o) => Math.hypot(cx - o.x, cz - o.z) < (o.t === 'b' ? Math.max(o.hw, o.hd) + 0.6 : o.r + 0.3))) continue;
      const near = nearPath(cx, cz, 1.6);
      if (!near && r() < 0.65) continue;
      const col = flowerCols[Math.floor(r() * flowerCols.length)];
      const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) spots.push([cx + (r() - 0.5) * 1.2, cz + (r() - 0.5) * 1.2, col]);
    }
    const petals = new THREE.InstancedMesh(petalGeo, toon('#FFFFFF'), spots.length * 5);
    const centers = new THREE.InstancedMesh(centerGeo, toon('#F4C542'), spots.length);
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), toon('#4E9A45'), spots.length);
    const mat4 = new THREE.Matrix4();
    const col = new THREE.Color();
    spots.forEach(([x, z, c], i) => {
      const h = 0.28 + (i % 3) * 0.04;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        mat4.makeTranslation(x + Math.cos(a) * 0.1, h, z + Math.sin(a) * 0.1);
        petals.setMatrixAt(i * 5 + k, mat4);
        petals.setColorAt(i * 5 + k, col.set(c));
      }
      mat4.makeTranslation(x, h + 0.02, z);
      centers.setMatrixAt(i, mat4);
      mat4.makeTranslation(x, h / 2, z);
      stems.setMatrixAt(i, mat4);
    });
    petals.castShadow = false;
    this.scene.add(petals, centers, stems);
    // 풀포기
    const tuftGeo = new THREE.ConeGeometry(0.09, 0.32, 4);
    const tufts = new THREE.InstancedMesh(tuftGeo, toon('#5FA64A'), 500);
    let ti = 0;
    for (let i = 0; i < 3000 && ti < 500; i++) {
      const x = (r() - 0.5) * 58, z = (r() - 0.5) * 58;
      if (Math.hypot(x, z) > 29 || nearPath(x, z, 0.1)) continue;
      for (let k = 0; k < 3 && ti < 500; k++) {
        mat4.makeRotationZ((k - 1) * 0.35);
        mat4.setPosition(x + (k - 1) * 0.1, 0.12, z);
        tufts.setMatrixAt(ti++, mat4);
      }
    }
    tufts.count = ti;
    this.scene.add(tufts);
    // 나비
    const wingGeo = new THREE.CircleGeometry(0.16, 10);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group();
      const wm = new THREE.MeshBasicMaterial({ color: ['#F6D55C', '#FFFDF7', '#F6A2C4', '#7EC8F2', '#F49A4C'][i], side: THREE.DoubleSide });
      const lw = new THREE.Mesh(wingGeo, wm); lw.position.x = -0.14;
      const rw = new THREE.Mesh(wingGeo, wm); rw.position.x = 0.14;
      const lp = new THREE.Group(); lp.add(lw);
      const rp = new THREE.Group(); rp.add(rw);
      b.add(lp, rp);
      b.rotation.x = -Math.PI / 2.4;
      this.scene.add(b);
      this.butterflies.push({ g: b, l: lp, r: rp, cx: (r() - 0.5) * 30, cz: (r() - 0.5) * 30, ph: r() * 10, sp: 0.3 + r() * 0.3 });
    }
  }

  // ---------- 사람들 ----------
  buildNpcs() {
    const guide = new Avatar({
      skin: 2, eyes: 'smile', eyeColor: 1, brows: 'soft', nose: 'round', mouth: 'grin', cheek: 'pink',
      hair: 'short', hairColor: 2, outfit: 'overall', outfitColor: 4, bottomColor: 3, shoeColor: 5, hat: 'straw', hatColor: 4,
    });
    guide.root.position.set(2.2, 0, -3.6);
    guide.root.rotation.y = 0.2;
    this.scene.add(guide.root);
    guide.root.traverse((o) => { if (o.isMesh) o.userData.pick = null; });
    guide.root.userData.pick = { type: 'npc' };
    this.pickRoots.push(guide.root);
    this.guide = guide;
    this.addObstacleCircle(2.2, -3.6, 0.45);
    this.guideTag = this.makeLabel('숲지기 솔', 'kv-tag');

  }

  setPlayer(data) {
    if (!this.player) {
      this.player = new Avatar(data);
      this.player.root.position.set(0, 0, 11);
      this.player.root.rotation.y = 0;
      this.scene.add(this.player.root);
    } else {
      this.player.setData(data);
    }
  }

  // ---------- 함께 접속한 친구들 ----------
  addRemote(id, data, name) {
    let r = this.remotes.get(id);
    if (r) { r.av.setData(data); r.name = name; this.drawRemoteTag(r); return r; }
    const av = new Avatar(data);
    const start = new THREE.Vector3(0, 0, 11);
    av.root.position.copy(start);
    this.scene.add(av.root);
    r = { id, av, name, act: '', tag: this.makeLabel(name, 'kv-tag kv-friend'), target: null, stuck: 0 };
    this.remotes.set(id, r);
    return r;
  }
  drawRemoteTag(r) { r.tag.textContent = r.act ? `${r.act} ${r.name}` : r.name; }
  setRemoteActivity(id, icon, act = '', seat = -1) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.act = icon || '';
    r.actName = act || '';
    r.actSeat = Number.isInteger(seat) ? seat : -1;
    this.drawRemoteTag(r);
    this.applyAct(r);
  }
  // 친구가 하는 일에 맞게 내 화면의 친구 모습을 꾸민다 (놀이기구, 벤치, 열매 먹기는 마을이, 나머지는 놀이 쪽에서)
  applyAct(r, hint) {
    const act = r.actName || '';
    const av = r.av;
    if (act !== 'eat' && av.held && av.held.obj.userData.isFruit) { av.drop(); if (av.pose && av.pose.eat) { av.pose = null; resetLimbs(av); } }
    if (this.park && RIDE_IDS.includes(act)) {
      if (r.pin && r.pin.kind === act && (act === 'bumper' || r.pin.seat === r.actSeat)) return;
      if (this.decorateRemote) this.decorateRemote(r, '');
      this.park.decorate(r, act, r.actSeat);
      return;
    }
    if (act === 'bench') {
      if (r.pin && r.pin.kind === 'bench' && r.pin.seat === r.actSeat) return;
      if (this.decorateRemote) this.decorateRemote(r, '');
      this.pinBench(r, r.actSeat);
      return;
    }
    if (act === 'eat') {
      if (this.decorateRemote) this.decorateRemote(r, '');
      if (!av.held || !av.held.obj.userData.isFruit) av.hold(handFruit(0), 1);
      if (!av.pose || !av.pose.eat) av.pose = remoteEatPose();
      return;
    }
    if (this.decorateRemote) this.decorateRemote(r, act, hint);
    else if (r.pin && r.pin.auto) this.unpinRemote(r.id);
  }
  pinRemote(id, pin) {
    const r = this.remotes.get(id);
    if (!r) return null;
    r.pin = pin;
    if (pin && pin.pose !== undefined) r.av.pose = pin.pose;
    return r.av;
  }
  unpinRemote(id) {
    const r = this.remotes.get(id);
    if (!r || !r.pin) return;
    const pin = r.pin;
    r.pin = null;
    if (pin.car) pin.car.removeFromParent();
    r.av.pose = null;
    r.av.drop();
    resetLimbs(r.av);
    r.av.root.rotation.set(0, r.av.root.rotation.y, 0);
    r.av.root.position.y = 0;
    this.resolve(r.av.root.position);
  }
  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.av.root);
    r.av.dispose();
    r.tag.remove();
    if (r.bubble) r.bubble.el.remove();
    this.remotes.delete(id);
  }
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); }
  remoteMove(id, p) {
    const r = this.remotes.get(id);
    if (!r) return;
    const pos = r.av.root.position;
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    if (d > 2.5 || !r.seen) { pos.set(p.x, 0, p.z); r.seen = true; }
    r.target = (p.tx != null && Math.hypot(p.tx - pos.x, p.tz - pos.z) > 0.15) ? new THREE.Vector3(p.tx, 0, p.tz) : null;
    if (!r.target && !r.pin) this.resolve(pos);
    r.stuck = 0;
  }
  remoteStop(id, p) {
    const r = this.remotes.get(id);
    if (!r) return;
    const pos = r.av.root.position;
    if (Math.hypot(pos.x - p.x, pos.z - p.z) > 0.6) r.target = new THREE.Vector3(p.x, 0, p.z);
    else r.target = null;
    r.seen = true;
    // 놀이 중인 친구가 자리를 옮기면 그 자리(의자, 낚시터)에 다시 앉힌다
    if (r.actName) this.applyAct(r, { x: p.x, z: p.z });
  }
  remoteCelebrate(id) { const r = this.remotes.get(id); if (r) r.av.celebrate(); }
  say(id, text) {
    const holder = id === 'me' ? this.player : this.remotes.get(id);
    if (!holder) return;
    const av = id === 'me' ? this.player : holder.av;
    if (holder.bubble) holder.bubble.el.remove();
    const el = document.createElement('div');
    el.className = 'kv-bubble' + ([...text].length <= 2 ? ' emoji' : '');
    el.textContent = text;
    el.style.display = 'none';
    this.labels.appendChild(el);
    holder.bubble = { el, life: Math.min(9, 3.8 + [...text].length * 0.14) };
    av.celebrate();
  }
  // 내 머리 위 이름표
  setMyName(name) {
    if (!this.myTag) this.myTag = this.makeLabel(name || '', 'kv-tag kv-me');
    this.myTag.textContent = name || '';
  }
  playerPos() { return this.player ? { x: this.player.root.position.x, z: this.player.root.position.z } : null; }

  // 내 움직임을 친구들에게 알리기
  reportMove(tx, tz) {
    if (!this.on.onLocalMove || !this.player) return;
    const p = this.player.root.position;
    this.on.onLocalMove({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), tx: +tx.toFixed(2), tz: +tz.toFixed(2) });
    this.net = { moving: true, sent: this.time, tx, tz };
  }
  reportStop() {
    if (!this.on.onLocalStop || !this.player) return;
    const p = this.player.root.position;
    this.on.onLocalStop({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
    this.net = { moving: false, sent: this.time };
  }

  updateRemotes(dt) {
    for (const r of this.remotes.values()) {
      const pos = r.av.root.position;
      let moving = false;
      if (r.pin && r.pin.obj) {
        // 놀이기구에 탄 친구: 그 자리(곤돌라, 배, 말)를 따라 움직인다
        r.pin.obj.getWorldPosition(pos);
        r.pin.obj.getWorldQuaternion(r.av.root.quaternion);
      } else if (r.pin && r.pin.free) {
        // 범퍼카: 친구가 보낸 자리로 미끄러지듯 따라간다
        if (r.target) {
          const dx = r.target.x - pos.x, dz = r.target.z - pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.08) r.target = null; else {
            const step = Math.min(d, Math.max(3.2, d * 2.5) * dt);
            pos.x += (dx / d) * step;
            pos.z += (dz / d) * step;
            r.av.root.rotation.y = turn(r.av.root.rotation.y, Math.atan2(dx, dz), dt * 8);
          }
        }
        if (this.park) this.park.clampArena(pos);
        pos.y = r.pin.y;
      } else if (r.pin) {
        // 놀이 중인 친구는 내 화면에서 정해진 자리(맞은편 의자, 벤치 등)에 둔다
        pos.set(r.pin.x, r.pin.y || 0, r.pin.z);
        r.av.root.rotation.y = r.pin.rot;
      } else if (r.target) {
        const dx = r.target.x - pos.x, dz = r.target.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) r.target = null; else {
          const before = pos.clone();
          const step = Math.min(d, 5.2 * dt);
          pos.x += (dx / d) * step;
          pos.z += (dz / d) * step;
          this.resolve(pos);
          r.av.root.rotation.y = turn(r.av.root.rotation.y, Math.atan2(dx, dz), dt * 12);
          moving = before.distanceTo(pos) > step * 0.25;
          r.stuck = moving ? 0 : r.stuck + dt;
          if (r.stuck > 0.6) r.target = null;
        }
      }
      r.av.update(dt, moving, 1.2);
      this.placeLabel(r.tag, pos, 2.45);
      if (r.bubble) this.tickBubble(r, pos, 3.05, dt);
    }
    if (this.player && this.player.bubble) this.tickBubble(this.player, this.player.root.position, 3.05, dt);
  }
  tickBubble(owner, pos, y, dt) {
    const b = owner.bubble;
    b.life -= dt;
    if (b.life <= 0) { b.el.remove(); owner.bubble = null; return; }
    b.el.style.opacity = String(Math.min(1, b.life / 0.5));
    this.placeLabel(b.el, pos, y);
  }

  // ---------- 라벨 (HTML) ----------
  makeLabel(text, cls) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    el.style.display = 'none';
    this.labels.appendChild(el);
    return el;
  }
  placeLabel(el, pos, yOff) {
    const v = pos.clone();
    v.y += yOff;
    v.project(this.camera);
    if (v.z > 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    const x = (v.x * 0.5 + 0.5) * this.w;
    const y = (-v.y * 0.5 + 0.5) * this.h;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  // ---------- 입력 ----------
  bindInput() {
    const el = this.canvas;
    const pointers = new Map();
    let down = null, pinch = null, rot = null;
    // 한 손가락(마우스)으로 끌면 빙글 돌리고, 두 손가락으로 벌리거나 오므리면 가까이·멀리, 비틀면 돌린다
    const gameOwnsDrag = () => this.mode === 'game' && this.game && this.game.ownsDrag && this.game.ownsDrag();
    const toGame = (type, e) => { if (this.mode === 'game' && this.game && this.game.onPointer) this.game.onPointer(type, e.clientX, e.clientY, e); };
    el.addEventListener('pointerdown', (e) => {
      toGame('down', e);
      if (this.mode === 'game') el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const v = this.viewNow();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v ? v.zoom : 1, a: Math.atan2(b.y - a.y, b.x - a.x) };
        down = null;
        rot = null;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      toGame('move', e);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = this.viewNow();
      if (!v) return;
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom(pinch.z * (pinch.d / Math.max(1, d)));
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let da = ang - pinch.a;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        v.yaw -= da;
        pinch.a = ang;
        this.rotating = true;
        this.viewChanged();
      } else if (pointers.size === 1 && down) {
        if (!rot && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 && !gameOwnsDrag()) rot = { x: e.clientX, y: e.clientY };
        if (rot) {
          v.yaw -= (e.clientX - rot.x) * 0.0085;
          this.addElev((e.clientY - rot.y) * 0.006);
          rot = { x: e.clientX, y: e.clientY };
          this.rotating = true;
          this.viewChanged();
        }
      }
    });
    const up = (e) => {
      toGame('up', e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down && e.type === 'pointerup' && !rot) {
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (moved < 12 && performance.now() - down.t < 600) this.tap(e.clientX, e.clientY);
      }
      if (!pointers.size) { down = null; rot = null; this.rotating = false; }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const v = this.viewNow();
      if (v) this.setZoom(v.zoom * (e.deltaY > 0 ? 1.08 : 0.93));
    }, { passive: false });
    const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      // Q, E: 옆으로 돌리기 / R, F: 위아래 / +, -: 가까이·멀리
      const v = this.viewNow();
      if (v && !this.paused) {
        if (e.code === 'KeyQ') { v.yaw += 0.12; this.viewChanged(); }
        if (e.code === 'KeyE') { v.yaw -= 0.12; this.viewChanged(); }
        if (e.code === 'KeyR') this.addElev(0.08);
        if (e.code === 'KeyF') this.addElev(-0.08);
        if (e.code === 'Equal' || e.code === 'NumpadAdd') this.setZoom(v.zoom * 0.9);
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.setZoom(v.zoom * 1.1);
      }
      if (this.mode !== 'play' || this.paused) return;
      if (map[e.code]) { this.keys.add(map[e.code]); this.target = null; e.preventDefault(); }
      if ((e.code === 'Enter' || e.code === 'Space') && this.nearDoor) { e.preventDefault(); this.enter(this.nearDoor.id); }
    });
    window.addEventListener('keyup', (e) => { if (map[e.code]) this.keys.delete(map[e.code]); });
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ---------- 시점 ----------
  viewNow() { return this.mode === 'play' ? this.view.play : this.mode === 'game' ? this.view.game : null; }
  setZoom(z) {
    const v = this.viewNow();
    if (!v) return;
    v.zoom = THREE.MathUtils.clamp(z, this.mode === 'game' ? 0.45 : 0.35, this.mode === 'game' ? 2.4 : 1.6);
    this.viewChanged();
  }
  // 위아래 각도: 실제 높이각이 8도~84도 안에 있도록 더한다
  addElev(d) {
    const v = this.viewNow();
    if (!v) return;
    const base = this.baseElev == null ? 0.7 : this.baseElev;
    v.elev = THREE.MathUtils.clamp(v.elev + d, 0.14 - base, 1.47 - base);
    this.viewChanged();
  }
  isDefaultView(v = this.viewNow()) {
    return !v || (Math.abs(v.yaw) < 0.02 && Math.abs(v.elev) < 0.02 && Math.abs(v.zoom - 1) < 0.02);
  }
  viewChanged() { if (this.on.onViewChange) this.on.onViewChange(!this.isDefaultView()); }
  resetView() {
    const v = this.viewNow();
    if (!v) return;
    // 같은 방향으로 가장 가깝게 돌아오도록 yaw를 -π~π로 맞춘 뒤 0으로
    v.yaw = 0; v.elev = 0; v.zoom = 1;
    this.viewChanged();
  }
  // look을 중심으로 base 위치를 시점(v)만큼 돌리고 당긴 카메라 위치
  orbit(look, base, v, out) {
    const ox = base.x - look.x, oy = base.y - look.y, oz = base.z - look.z;
    const len = Math.hypot(ox, oy, oz) || 1;
    const el0 = Math.atan2(oy, Math.hypot(ox, oz));
    this.baseElev = el0;
    const yaw = Math.atan2(ox, oz) + v.yaw;
    const el = THREE.MathUtils.clamp(el0 + v.elev, 0.14, 1.47);
    const d = len * v.zoom;
    return out.set(look.x + Math.sin(yaw) * Math.cos(el) * d, look.y + Math.sin(el) * d, look.z + Math.cos(yaw) * Math.cos(el) * d);
  }

  rayAt(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  tap(cx, cy) {
    if (this.mode === 'game' && !this.paused) {
      if (this.game && this.game.onTap) this.game.onTap(this.rayAt(cx, cy), cx, cy);
      return;
    }
    if (this.mode !== 'play' || this.paused || !this.player) return;
    const ray = this.rayAt(cx, cy);
    const hits = ray.intersectObjects(this.pickRoots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o) continue;
      const p = o.userData.pick;
      if (p.type === 'building') { this.walkTo(p.id); return; }
      if (p.type === 'board') { this.walkTo('board'); return; }
      if (p.type === 'npc') { this.walkToNpc(); return; }
      if (p.type === 'bench') { this.walkToBench(p.i); return; }
      if (p.type === 'fruit') { this.walkToFruit(p.i); return; }
      if (p.type === 'pet') { this.petAnimal(p.i); return; }
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, pt)) {
      this.target = { pos: pt.setY(0), action: null };
      this.showTapMark(pt);
      this.reportMove(pt.x, pt.z);
    }
  }

  showTapMark(pt) {
    if (!this.tapMark) {
      this.tapMark = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 24), new THREE.MeshBasicMaterial({ color: '#FFFDF7', transparent: true, opacity: 0.9, depthWrite: false }));
      this.tapMark.rotation.x = -Math.PI / 2;
      this.scene.add(this.tapMark);
    }
    this.tapMark.position.set(pt.x, 0.05, pt.z);
    this.tapMark.userData.life = 0.6;
    this.tapMark.visible = true;
  }

  walkTo(id) {
    const d = this.doors.find((dd) => dd.id === id);
    if (!d || !this.player) return;
    this.target = { pos: d.pos.clone(), action: () => this.enter(id) };
    this.reportMove(d.pos.x, d.pos.z);
  }
  // 친구 옆으로 걸어가기
  walkToFriend(id) {
    const r = this.remotes.get(id);
    if (!r || !this.player || this.mode !== 'play') return;
    const q = r.av.root.position, p = this.player.root.position;
    const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz) || 1;
    const pos = new THREE.Vector3(q.x + (dx / d) * 1.3, 0, q.z + (dz / d) * 1.3);
    this.resolve(pos);
    this.target = { pos, action: () => { if (this.remotes.has(id)) this.player.root.rotation.y = Math.atan2(q.x - this.player.root.position.x, q.z - this.player.root.position.z); } };
    this.showTapMark(pos);
    this.reportMove(pos.x, pos.z);
  }
  // 강아지·고양이를 누르면 멈춰서 반기고, 나는 그 옆으로 간다
  petAnimal(i) {
    if (!this.critters || !this.player) return;
    const r = this.critters.pet(i);
    if (!r) return;
    if (this.on.onPet) this.on.onPet(r);
    const p = this.player.root.position;
    const dx = p.x - r.pos.x, dz = p.z - r.pos.z, d = Math.hypot(dx, dz) || 1;
    if (d < 1.4) return;
    const pos = new THREE.Vector3(r.pos.x + (dx / d) * 1.0, 0, r.pos.z + (dz / d) * 1.0);
    this.resolve(pos);
    this.target = { pos, action: () => { this.player.root.rotation.y = Math.atan2(r.pos.x - this.player.root.position.x, r.pos.z - this.player.root.position.z); } };
    this.reportMove(pos.x, pos.z);
  }
  walkToNpc() {
    const g = this.guide.root.position;
    const p = this.player.root.position;
    const dir = new THREE.Vector3(p.x - g.x, 0, p.z - g.z).normalize();
    this.target = { pos: g.clone().addScaledVector(dir, 1.3), action: () => this.on.onNpc && this.on.onNpc() };
    this.reportMove(this.target.pos.x, this.target.pos.z);
  }
  enter(id) {
    this.target = null;
    this.keys.clear();
    if (id === 'board') return this.on.onBoard && this.on.onBoard();
    this.on.onEnter && this.on.onEnter(id);
  }

  // ---------- 충돌 ----------
  resolve(p) {
    for (const o of this.obstacles) {
      if (o.t === 'c') {
        const dx = p.x - o.x, dz = p.z - o.z;
        const d = Math.hypot(dx, dz), min = o.r + PR;
        if (d < min && d > 1e-5) { p.x = o.x + (dx / d) * min; p.z = o.z + (dz / d) * min; }
      } else {
        const wx = p.x - o.x, wz = p.z - o.z;
        let lx = wx * o.c - wz * o.s;
        let lz = wx * o.s + wz * o.c;
        const cx = Math.max(-o.hw, Math.min(o.hw, lx));
        const cz = Math.max(-o.hd, Math.min(o.hd, lz));
        let dx = lx - cx, dz = lz - cz;
        const d = Math.hypot(dx, dz);
        if (d < PR) {
          if (d > 1e-5) { lx = cx + (dx / d) * PR; lz = cz + (dz / d) * PR; } else {
            const ex = o.hw - Math.abs(lx), ez = o.hd - Math.abs(lz);
            if (ex < ez) lx = Math.sign(lx || 1) * (o.hw + PR); else lz = Math.sign(lz || 1) * (o.hd + PR);
          }
          p.x = o.x + lx * o.c + lz * o.s;
          p.z = o.z - lx * o.s + lz * o.c;
        }
      }
    }
    const rr = Math.hypot(p.x, p.z);
    if (rr > WALK_R) { p.x *= WALK_R / rr; p.z *= WALK_R / rr; }
  }

  // ---------- 시간 ----------
  applyTimeOfDay(force) {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const ph = force || phaseFor(h);
    if (ph === this.phase) return;
    this.phase = ph;
    const s = SKY[ph];
    this.scene.background = new THREE.Color(s.sky);
    this.scene.fog.color.set(s.sky);
    this.hemi.color.set(s.hemiSky);
    this.hemi.groundColor.set(s.hemiGround);
    this.hemi.intensity = s.hemi;
    this.sun.color.set(s.sun);
    this.sun.intensity = s.sunI;
    for (const mt of this.glowMats) mt.emissiveIntensity = s.glow;
  }

  // ---------- 화면 ----------
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 48 : 38;
    this.camera.updateProjectionMatrix();
  }

  // ---------- 3D 놀이 ----------
  // ctrl: { cam: {pos: Vector3, look: Vector3}, update(dt, t), onTap(ray, x, y), stop() }
  enterGame(ctrl) {
    if (this.game && this.game !== ctrl && this.game.stop) this.game.stop();
    if (this.sitting) this.standUp(true);
    if (this.eating) this.cancelEat();
    this.game = ctrl;
    this.mode = 'game';
    this.view.game = { yaw: 0, elev: 0, zoom: 1 };
    this.viewChanged();
    this.target = null;
    this.keys.clear();
    this.nearDoor = null;
    if (this.on.onNearDoor) this.on.onNearDoor(null);
    if (this.net.moving) this.reportStop();
  }
  exitGame() {
    const g = this.game;
    this.game = null;
    if (this.mode === 'game') this.mode = 'play';
    this.viewChanged();
    if (this.player) {
      this.player.pose = null;
      this.player.drop();
      resetLimbs(this.player);
      this.player.root.rotation.set(0, this.player.root.rotation.y, 0);
      this.player.root.position.y = 0;
      this.resolve(this.player.root.position);
      this.reportStop();
    }
    return g;
  }
  // 놀이 중 내 주민을 정해진 자리에 세운다 (친구들에게도 알린다)
  placePlayer(x, z, rotY, y = 0) {
    const p = this.player.root.position;
    p.set(x, y, z);
    this.player.root.rotation.y = rotY;
    if (this.on.onLocalStop) this.on.onLocalStop({ x: +x.toFixed(2), z: +z.toFixed(2) });
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'play' && this.player) {
      const p = this.player.root.position;
      this.camPos.set(p.x, 30, p.z + 34);
    }
  }

  setPaused(p) {
    this.paused = p;
    if (!p) this.clock.getDelta();
  }

  loop() {
    requestAnimationFrame(this.loop);
    if (this.paused || document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const t = this.time;
    if (Math.floor(t) % 30 === 0 && Math.floor(t - dt) % 30 !== 0) this.applyTimeOfDay();
    this.foam.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.25;
    this.foam.scale.setScalar(1 + Math.sin(t * 1.4) * 0.006);

    // 나비
    for (const b of this.butterflies) {
      const k = t * b.sp + b.ph;
      b.g.position.set(b.cx + Math.sin(k) * 4, 1.1 + Math.sin(k * 3) * 0.3, b.cz + Math.sin(k * 1.7) * 3);
      b.g.rotation.z = Math.atan2(Math.cos(k * 1.7) * 1.7 * 3, Math.cos(k) * 4) - Math.PI / 2;
      const f = Math.sin(t * 18 + b.ph) * 0.9;
      b.l.rotation.y = f; b.r.rotation.y = -f;
    }

    // 놀이동산과 동물 (모든 기기가 같은 시계로 움직인다). 친구 자리보다 먼저 움직여야 탄 친구가 제자리에 붙는다
    if (this.park) {
      const T = this.park.now();
      this.park.update(T, dt);
      if (this.critters) this.critters.update(T, dt);
    }
    this.tickFruit(dt);

    this.updateRemotes(dt);

    // 숲지기
    const g = this.guide;
    g.update(dt, false);
    if (this.player && this.mode === 'play') {
      const p = this.player.root.position;
      const gp = g.root.position;
      if (Math.hypot(p.x - gp.x, p.z - gp.z) < 7) g.root.rotation.y = turn(g.root.rotation.y, Math.atan2(p.x - gp.x, p.z - gp.z), dt * 5);
    }
    this.placeLabel(this.guideTag, g.root.position, 2.45);
    if (this.myTag) {
      if (this.player && (this.mode === 'play' || this.mode === 'game') && this.myTag.textContent) this.placeLabel(this.myTag, this.player.root.position, 2.45);
      else this.myTag.style.display = 'none';
    }

    // 내 주민
    if (this.player && this.mode === 'play') this.updatePlayer(dt);
    else if (this.player) this.player.update(dt, false);
    if (this.mode === 'game' && this.game && this.game.update) this.game.update(dt, t);

    // 카메라
    if (!this.wantPos) { this.wantPos = new THREE.Vector3(); this.wantLook = new THREE.Vector3(); }
    if (this.mode === 'game' && this.game && this.game.cam) {
      const k = 1 - Math.exp(-dt * (this.rotating ? 14 : this.game.camSpeed || 3));
      this.orbit(this.game.cam.look, this.game.cam.pos, this.view.game, this.wantPos);
      this.camPos.lerp(this.wantPos, k);
      this.camLook.lerp(this.game.cam.look, k);
    } else if (this.mode === 'play' && this.player) {
      // 기본: 주민 뒤쪽 위(남쪽)에서 앞을 조금 넓게 내려다본다. 끌어서 돌리면 그 방향에서 본다.
      const p = this.player.root.position;
      const v = this.view.play;
      const near = Math.min(1, v.zoom);
      const ahead = 3.2 * near;
      this.wantLook.set(p.x - Math.sin(v.yaw) * ahead, 0.6 + (1 - near) * 0.9, p.z - Math.cos(v.yaw) * ahead);
      const dist = 23.83 * (this.camera.aspect < 1 ? 1.25 : 1);
      const base = this.wantPos.set(this.wantLook.x, this.wantLook.y + 15.4 / 23.83 * dist, this.wantLook.z + 18.2 / 23.83 * dist);
      this.orbit(this.wantLook, base.clone(), v, this.wantPos);
      const k = this.rotating ? 14 : 4;
      this.camPos.lerp(this.wantPos, 1 - Math.exp(-dt * k));
      this.camLook.lerp(this.wantLook, 1 - Math.exp(-dt * Math.max(6, k)));
    } else {
      const a = t * 0.05;
      this.camPos.set(Math.sin(a) * 30, 20, Math.cos(a) * 30 + 2);
      this.camLook.set(0, 0, -4);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    const focus = (this.mode === 'play' || this.mode === 'game') && this.player ? this.player.root.position : this.camLook;
    this.sun.position.set(focus.x + 14, 28, focus.z + 12);
    this.sun.target.position.set(focus.x, 0, focus.z);

    // 가리는 물체 흐리게
    // 카메라와 내 주민 사이에 있는 나무·집을 흐리게 (카메라를 어느 쪽으로 돌려도)
    const pp = (this.mode === 'play' || this.mode === 'game') && this.player ? this.player.root.position : null;
    let cdx = 0, cdz = 1, cdist = 20;
    if (pp) {
      cdx = this.camPos.x - pp.x; cdz = this.camPos.z - pp.z;
      cdist = Math.hypot(cdx, cdz) || 1;
      cdx /= cdist; cdz /= cdist;
    }
    for (const f of this.fadeables) {
      let want = 1;
      if (pp && f !== this.noFade) {
        const rx = f.x - pp.x, rz = f.z - pp.z;
        const along = rx * cdx + rz * cdz;
        const across = Math.abs(rx * cdz - rz * cdx);
        if (along > -0.5 && along < Math.min(cdist, f.r + 7) && across < f.r + 0.6) want = 0.32;
      }
      if (Math.abs(f.op - want) > 0.01) {
        f.op += (want - f.op) * Math.min(1, dt * 8);
        for (const mt of f.mats) {
          mt.transparent = f.op < 0.99 || mt.userData.base < 1;
          mt.opacity = f.op * (mt.userData.base ?? 1);
          mt.depthWrite = f.op > 0.99;
        }
      }
    }

    if (this.tapMark && this.tapMark.visible) {
      this.tapMark.userData.life -= dt;
      const l = Math.max(0, this.tapMark.userData.life);
      this.tapMark.material.opacity = l / 0.6;
      this.tapMark.scale.setScalar(1 + (0.6 - l));
      if (l <= 0) this.tapMark.visible = false;
    }
  }

  updatePlayer(dt) {
    const pl = this.player;
    const p = pl.root.position;
    // 벤치에 앉아 있거나 열매를 먹는 중: 움직이려고 하면 일어나서(그만 먹고) 간다
    if (this.sitting) {
      if (this.keys.size || this.target) this.standUp();
      else { pl.update(dt, false); return; }
    }
    if (this.eating) {
      if (this.keys.size || this.target) this.cancelEat();
      else { this.tickEat(dt); pl.update(dt, false); return; }
    }
    let dx = 0, dz = 0;
    if (this.keys.size) {
      let kx = 0, kz = 0;
      if (this.keys.has('u')) kz -= 1;
      if (this.keys.has('d')) kz += 1;
      if (this.keys.has('l')) kx -= 1;
      if (this.keys.has('r')) kx += 1;
      // 화살표는 지금 보는 방향 기준으로 움직인다
      const yw = this.view.play.yaw, c = Math.cos(yw), sn = Math.sin(yw);
      dx = kx * c + kz * sn;
      dz = -kx * sn + kz * c;
    } else if (this.target) {
      dx = this.target.pos.x - p.x;
      dz = this.target.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        const act = this.target.action;
        this.target = null;
        dx = dz = 0;
        if (act) act();
      }
    }
    const len = Math.hypot(dx, dz);
    let moving = false;
    if (len > 0.001) {
      const speed = 5.2;
      const before = p.clone();
      p.x += (dx / len) * speed * dt;
      p.z += (dz / len) * speed * dt;
      this.resolve(p);
      const moved = before.distanceTo(p);
      pl.root.rotation.y = turn(pl.root.rotation.y, Math.atan2(dx, dz), dt * 12);
      moving = moved > speed * dt * 0.25;
      if (this.target) {
        this.stuck = moving ? 0 : (this.stuck || 0) + dt;
        if (this.stuck > 0.5) {
          const act = this.target.action;
          const close = this.target.pos.distanceTo(p) < 2.2;
          this.target = null;
          this.stuck = 0;
          if (act && close) act();
        }
      }
      if (moving && this.on.onMove) this.on.onMove();
    }
    pl.update(dt, moving, 1.2);
    // 친구들에게 알리기: 자판으로 걸을 때는 조금 앞을 목표로 자주, 멈추면 한 번
    if (this.keys.size && len > 0.001) {
      if (!this.net.moving || this.time - this.net.sent > 0.4) this.reportMove(p.x + (dx / len) * 2.4, p.z + (dz / len) * 2.4);
    } else if (this.net.moving && !this.target) {
      this.reportStop();
    }

    // 가까운 문
    let best = null, bd = 2.6;
    for (const d of this.doors) {
      const dist = Math.hypot(d.pos.x - p.x, d.pos.z - p.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best !== this.nearDoor) {
      this.nearDoor = best;
      this.on.onNearDoor && this.on.onNearDoor(best);
    }
    if (best && this.on.placePrompt) {
      const v = best.pos.clone();
      v.y = 3.0;
      v.project(this.camera);
      this.on.placePrompt((v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h);
    }
  }

  celebrate() { if (this.player) this.player.celebrate(); }
}

function turn(cur, want, k) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
