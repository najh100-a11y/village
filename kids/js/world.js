// 진숲 어린이 마을 — 3D 마을
import * as THREE from './three.module.min.js';
import { Avatar, toon, toonGradient } from './avatar.js';
import { randomAvatar, colorOf, shade } from './face.js';
import { mergeStatic, Instancer } from './merge.js';

const WALK_R = 30.2;
const PR = 0.42; // 사람 충돌 반지름
const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function rng(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
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
  [[0, 15], [0, 6], [0, 1]],
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
function nearPath(x, z, pad) {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + pad) return true;
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
    this.zoom = 1;
    this.camPos = new THREE.Vector3(0, 30, 40);
    this.camLook = new THREE.Vector3(0, 0, -4);
    this.time = 0;
    this.remotes = new Map();
    this.net = { moving: false, sent: 0 };
    this.butterflies = [];
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
    this.buildNature();
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
    this.fadeables.push({ x, z, r, mats, op: 1 });
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
    // 둘레 의자
    for (const [x, z, ry] of [[-3.6, -2.0, 1.2], [3.6, -2.0, -1.2]]) {
      const b = new THREE.Group();
      b.add(box(1.8, 0.14, 0.55, toon('#A06E45'), 0, 0.55, 0));
      b.add(box(1.8, 0.5, 0.1, toon('#A06E45'), 0, 0.9, -0.25));
      b.add(box(0.12, 0.5, 0.5, toon('#6B4429'), -0.75, 0.28, 0));
      b.add(box(0.12, 0.5, 0.5, toon('#6B4429'), 0.75, 0.28, 0));
      b.position.set(x, 0, z);
      b.rotation.y = ry;
      this.scene.add(b);
      this.addObstacleBox(x, z, 0.95, 0.35, ry);
    }
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
          const fm = fruitC[made % 3];
          for (let i = 0; i < 6; i++) {
            const fa = r() * Math.PI * 2, fy = 1.9 + r() * 0.9;
            t.add(m(fruitGeo, fm, Math.cos(fa) * 1.08, fy, Math.sin(fa) * 1.08));
          }
        }
      }
      t.position.set(x, 0, z);
      t.scale.setScalar(s);
      t.rotation.y = r() * Math.PI * 2;
      inst.addGroup(t);
      this.addObstacleCircle(x, z, 0.38 * s);
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
  setRemoteActivity(id, icon, act = '') {
    const r = this.remotes.get(id);
    if (!r) return;
    r.act = icon || '';
    r.actName = act || '';
    this.drawRemoteTag(r);
    if (this.decorateRemote) this.decorateRemote(r, r.actName);
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
    r.pin = null;
    r.av.pose = null;
    r.av.drop();
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
    if (!r.target) this.resolve(pos);
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
    if (r.actName && this.decorateRemote) this.decorateRemote(r, r.actName, { x: p.x, z: p.z });
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
    holder.bubble = { el, life: 4.5 };
    av.celebrate();
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
      if (r.pin) {
        // 놀이 중인 친구는 내 화면에서 정해진 자리(맞은편 의자 등)에 둔다
        pos.set(r.pin.x, r.pin.y || 0, r.pin.z);
        r.av.root.rotation.y = r.pin.rot;
        r.target = null;
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
    if (this.player && this.player.bubble) this.tickBubble(this.player, this.player.root.position, 2.55, dt);
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
    let down = null, pinch = null;
    const toGame = (type, e) => { if (this.mode === 'game' && this.game && this.game.onPointer) this.game.onPointer(type, e.clientX, e.clientY, e); };
    el.addEventListener('pointerdown', (e) => {
      toGame('down', e);
      if (this.mode === 'game') el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom };
        down = null;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      toGame('move', e);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.mode !== 'game') this.zoom = THREE.MathUtils.clamp(pinch.z * (pinch.d / d), 0.62, 1.35);
      }
    });
    const up = (e) => {
      toGame('up', e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down && e.type === 'pointerup') {
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (moved < 12 && performance.now() - down.t < 600) this.tap(e.clientX, e.clientY);
      }
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.62, 1.35);
    }, { passive: false });
    const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'play' || this.paused) return;
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (map[e.code]) { this.keys.add(map[e.code]); this.target = null; e.preventDefault(); }
      if ((e.code === 'Enter' || e.code === 'Space') && this.nearDoor) { e.preventDefault(); this.enter(this.nearDoor.id); }
    });
    window.addEventListener('keyup', (e) => { if (map[e.code]) this.keys.delete(map[e.code]); });
    window.addEventListener('blur', () => this.keys.clear());
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
    this.game = ctrl;
    this.mode = 'game';
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
    if (this.player) {
      this.player.pose = null;
      this.player.drop();
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

    // 내 주민
    if (this.player && this.mode === 'play') this.updatePlayer(dt);
    else if (this.player) this.player.update(dt, false);
    if (this.mode === 'game' && this.game && this.game.update) this.game.update(dt, t);

    // 카메라
    if (this.mode === 'game' && this.game && this.game.cam) {
      const k = 1 - Math.exp(-dt * (this.game.camSpeed || 3));
      this.camPos.lerp(this.game.cam.pos, k);
      this.camLook.lerp(this.game.cam.look, k);
    } else if (this.mode === 'play' && this.player) {
      const p = this.player.root.position;
      const z = this.zoom * (this.camera.aspect < 1 ? 1.25 : 1);
      const want = new THREE.Vector3(p.x, 16 * z, p.z + 15 * z);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 4));
      this.camLook.lerp(new THREE.Vector3(p.x, 0.6, p.z - 3.2), 1 - Math.exp(-dt * 6));
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
    const pp = this.mode === 'play' && this.player ? this.player.root.position : null;
    for (const f of this.fadeables) {
      let want = 1;
      if (pp) {
        const dz = f.z - pp.z;
        if (dz > -0.5 && dz < f.r + 7 && Math.abs(f.x - pp.x) < f.r + 0.6) want = 0.32;
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
    let dx = 0, dz = 0;
    if (this.keys.size) {
      if (this.keys.has('u')) dz -= 1;
      if (this.keys.has('d')) dz += 1;
      if (this.keys.has('l')) dx -= 1;
      if (this.keys.has('r')) dx += 1;
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
