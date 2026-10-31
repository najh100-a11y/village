// 진숲 어린이 마을 — 진숲 수영장: 걸어 들어가면 헤엄친다
// 땅에 그린 물빛 바닥 위에 반투명한 물을 깔고, 물에 들어간 주민은 머리와 어깨만 물 위로 나오게 낮춘다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { POOL_ISLE, makeIsle, makeTree } from './isles.js';

// 수영장 섬(마을 동쪽 다리 건너) 한가운데의 커다란 수영장
export const POOL = { x: 56, z: -3.6, hw: 6.5, hd: 3.4, deck: 1.3 };
export const SWIM_Y = -0.95; // 헤엄칠 때 발밑 높이 (머리와 어깨만 물 위)
const WATER_Y = 0.07;
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
function merge(g) { mergeColored(g, VC); mergeStatic(g); }

// 물 안인지 (가장자리에서 m만큼 안쪽)
export function inPool(x, z, m = 0.25) {
  return Math.abs(x - POOL.x) < POOL.hw - m && Math.abs(z - POOL.z) < POOL.hd - m;
}
// 수영장 둘레 바닥까지
export function nearPool(x, z, pad = 0) {
  return Math.abs(x - POOL.x) < POOL.hw + POOL.deck + pad && Math.abs(z - POOL.z) < POOL.hd + POOL.deck + pad;
}
// 헤엄치는 자세: 움직일 때는 자유형, 멈추면 손으로 물을 저으며 떠 있다 (av.swimMoving은 마을이 정한다)
export function swimPose(av, dt, t) {
  if (av.swimMoving) {
    av.arms[0].rotation.x = -1.6 + Math.sin(t * 5) * 1.4;
    av.arms[1].rotation.x = -1.6 + Math.sin(t * 5 + Math.PI) * 1.4;
    av.arms[0].rotation.z = -0.25; av.arms[1].rotation.z = 0.25;
  } else {
    const s = Math.sin(t * 3) * 0.35;
    av.arms[0].rotation.x = -1.1 + s; av.arms[1].rotation.x = -1.1 - s;
    av.arms[0].rotation.z = -0.7; av.arms[1].rotation.z = 0.7;
  }
  av.legs[0].rotation.x = Math.sin(t * 10) * 0.4;
  av.legs[1].rotation.x = -Math.sin(t * 10) * 0.4;
  av.body.position.y += Math.sin(t * 2.4) * 0.03;
}
swimPose.swim = true;

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
const box = (w, h, d, mat, x, y, z, cast) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
const cyl = (rt, rb, h, mat, x, y, z, seg = 12, cast) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, cast);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const stripeTex = (cols, n) => canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((i * w) / n, 0, w / n + 1, h); } });

export class Pool {
  constructor(v) {
    this.v = v;
    this.ripples = [];
    this.drops = [];
    this.build();
  }

  // 모래섬: 둘레 바닥과 물빛 타일 바닥을 땅 그림에 그리고, 야자나무를 심는다
  buildIsland() {
    const v = this.v, P = POOL, I = POOL_ISLE;
    makeIsle(v.scene, I, {
      ground: '#EDCF92',
      layer: 2,
      draw: (ctx, px, u) => {
        const ox = P.x - I.x, oz = P.z - I.z;
        const dx = P.hw + P.deck, dz = P.hd + P.deck;
        ctx.fillStyle = '#CFC6B4';
        ctx.beginPath(); ctx.roundRect(px(ox - dx - 0.15), px(oz - dz - 0.15), (dx + 0.15) * 2 * u, (dz + 0.15) * 2 * u, 0.6 * u); ctx.fill();
        ctx.fillStyle = '#ECE7DC';
        ctx.beginPath(); ctx.roundRect(px(ox - dx), px(oz - dz), dx * 2 * u, dz * 2 * u, 0.5 * u); ctx.fill();
        ctx.fillStyle = '#2E9BD0';
        ctx.fillRect(px(ox - P.hw), px(oz - P.hd), P.hw * 2 * u, P.hd * 2 * u);
        ctx.strokeStyle = 'rgba(140,215,245,.7)';
        ctx.lineWidth = 2;
        for (let g = -P.hw; g <= P.hw + 0.01; g += 0.55) { ctx.beginPath(); ctx.moveTo(px(ox + g), px(oz - P.hd)); ctx.lineTo(px(ox + g), px(oz + P.hd)); ctx.stroke(); }
        for (let g = -P.hd; g <= P.hd + 0.01; g += 0.55) { ctx.beginPath(); ctx.moveTo(px(ox - P.hw), px(oz + g)); ctx.lineTo(px(ox + P.hw), px(oz + g)); ctx.stroke(); }
        ctx.strokeStyle = '#1F6FA0';
        ctx.lineWidth = 5;
        for (const lz of [-1.7, 1.7]) { ctx.beginPath(); ctx.moveTo(px(ox - P.hw + 0.8), px(oz + lz)); ctx.lineTo(px(ox + P.hw - 0.8), px(oz + lz)); ctx.stroke(); }
        // 다리에서 수영장까지 나무 길
        ctx.fillStyle = '#C99862';
        ctx.fillRect(px(-I.r - 1), px(-4 - I.z - 1.0), (I.r + ox - dx + 1.2) * u, 2.0 * u);
        ctx.strokeStyle = 'rgba(110,70,40,.5)';
        ctx.lineWidth = 2;
        for (let g = -I.r - 1; g < ox - dx; g += 0.45) { ctx.beginPath(); ctx.moveTo(px(g), px(-4 - I.z - 1.0)); ctx.lineTo(px(g), px(-4 - I.z + 1.0)); ctx.stroke(); }
      },
    });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.2;
      const x = I.x + Math.cos(a) * 11.3, z = I.z + Math.sin(a) * 11.3;
      if (Math.cos(a) < -0.85) continue; // 다리 쪽은 비운다
      const t = makeTree('palm', 0.95 + (k % 3) * 0.1);
      t.position.set(x, 0, z);
      t.rotation.y = a + Math.PI;
      v.scene.add(t);
      v.addObstacleCircle(x, z, 0.3);
      v.makeFadeable(t, x, z, 1.4); // 앞에 서면 흐리게
    }
  }

  build() {
    this.buildIsland();
    const v = this.v, P = POOL;
    const root = new THREE.Group();
    root.position.set(P.x, 0, P.z);
    // 물: 물결 무늬가 천천히 흐른다
    this.waterTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7FD3F0';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.55)';
      g.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const x = (i * 97) % w, y = (i * 53) % h, r = 14 + (i % 5) * 7;
        g.beginPath();
        g.moveTo(x - r, y);
        g.bezierCurveTo(x - r / 2, y - r / 2.5, x + r / 2, y + r / 2.5, x + r, y);
        g.stroke();
      }
    });
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(3, 1.7);
    const waterMat = new THREE.MeshToonMaterial({ map: this.waterTex, gradientMap: toonGradient(), transparent: true, opacity: 0.84, depthWrite: false });
    const water = mesh(new THREE.PlaneGeometry(P.hw * 2, P.hd * 2), waterMat, 0, WATER_Y, 0, false);
    water.rotation.x = -Math.PI / 2;
    water.renderOrder = 1;
    root.add(water);
    // 둘레 돌 (발로 넘어갈 수 있다)
    const rim = new THREE.Group();
    const white = toon('#F4F1EA'), blue = toon('#5FA9E0');
    rim.add(box(P.hw * 2 + 0.6, 0.12, 0.3, white, 0, 0.06, -P.hd - 0.15, false));
    rim.add(box(P.hw * 2 + 0.6, 0.12, 0.3, white, 0, 0.06, P.hd + 0.15, false));
    rim.add(box(0.3, 0.12, P.hd * 2, white, -P.hw - 0.15, 0.06, 0, false));
    rim.add(box(0.3, 0.12, P.hd * 2, white, P.hw + 0.15, 0.06, 0, false));
    // 사다리 (양쪽 끝)
    const steel = toon('#C9D3DD');
    for (const sx of [-1, 1]) {
      for (const dz of [-0.35, 0.35]) {
        const x0 = sx * (P.hw + 0.05);
        rim.add(cyl(0.035, 0.035, 0.9, steel, x0, 0.45, dz, 8));
        const top = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 12, Math.PI), steel);
        top.position.set(x0 - sx * 0.25, 0.9, dz);
        top.rotation.y = sx > 0 ? 0 : Math.PI;
        rim.add(top);
      }
    }
    // 레인 줄 (가운데)
    for (let i = 0; i < 14; i++) rim.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), i % 2 ? white : blue, -P.hw + 0.4 + i * ((P.hw * 2 - 0.8) / 13), WATER_Y + 0.02, 0, false));
    merge(rim);
    root.add(rim);
    // 북쪽 둘레: 파라솔과 선베드 (카메라 반대쪽이라 물을 가리지 않는다)
    const deckZ = -P.hd - 0.62;
    const furn = new THREE.Group();
    const umbrella = new THREE.MeshToonMaterial({ map: stripeTex(['#EF6461', '#FFFDF7'], 10), gradientMap: toonGradient() });
    for (const [x, col] of [[-4.4, '#F6D55C'], [0.2, '#7EC8F2'], [4.8, '#F6A2C4']]) {
      furn.add(cyl(0.04, 0.04, 2.3, toon('#8A8F98'), x - 0.9, 1.15, deckZ - 0.05, 6));
      const top = mesh(new THREE.ConeGeometry(1.05, 0.45, 20), umbrella, x - 0.9, 2.3, deckZ - 0.05);
      furn.add(top);
      // 선베드
      const bed = new THREE.Group();
      bed.add(box(0.62, 0.08, 1.5, white, 0, 0.32, 0));
      bed.add(box(0.56, 0.06, 1.0, toon(col), 0, 0.39, 0.22));
      const back = box(0.56, 0.06, 0.6, toon(col), 0, 0.58, -0.6);
      back.rotation.x = 0.85;
      bed.add(back);
      for (const sx of [-0.26, 0.26]) for (const sz of [-0.62, 0.62]) bed.add(box(0.05, 0.3, 0.05, white, sx, 0.15, sz));
      bed.position.set(x, 0, deckZ);
      bed.rotation.y = Math.PI / 2;
      furn.add(bed);
      v.addObstacleBox(P.x + x, P.z + deckZ, 0.78, 0.33, 0);
      v.addObstacleCircle(P.x + x - 0.9, P.z + deckZ - 0.05, 0.12);
    }
    merge(furn);
    root.add(furn);
    const sg = v.postSign('진숲 수영장', 1.7);
    sg.position.set(-P.hw - 0.9, 0, P.hd + 0.9);
    root.add(sg);
    v.addObstacleCircle(P.x - P.hw - 0.9, P.z + P.hd + 0.9, 0.12);
    v.scene.add(root);
    this.root = root;
    // 떠다니는 튜브 셋과 비치볼
    this.floats = [];
    const ringGeo = new THREE.TorusGeometry(0.42, 0.14, 10, 24);
    [['#EF6461', '#FFFDF7'], ['#F6D55C', '#5FA9E0'], ['#A8E0B5', '#F6A2C4']].forEach((cols, i) => {
      const m = new THREE.MeshToonMaterial({ map: stripeTex(cols, 8), gradientMap: toonGradient() });
      const r = mesh(ringGeo, m, 0, 0, 0, false);
      r.rotation.x = -Math.PI / 2;
      root.add(r);
      this.floats.push({ o: r, ph: i * 2.1, ax: 4.0 - i * 0.7, az: 2.0 - i * 0.4, sp: 0.07 + i * 0.02, y: WATER_Y + 0.05 });
    });
    const ball = mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshToonMaterial({ map: stripeTex(['#EF6461', '#FFFDF7', '#5FA9E0', '#FFFDF7', '#F6D55C', '#FFFDF7'], 6), gradientMap: toonGradient() }), 0, 0, 0, false);
    root.add(ball);
    this.floats.push({ o: ball, ph: 5, ax: 2.0, az: 1.2, sp: 0.05, y: WATER_Y + 0.22, ball: true });
    // 물결 고리와 물방울 (미리 만들어 돌려 쓴다)
    this.ringGeo = new THREE.RingGeometry(0.3, 0.38, 24);
    this.dropGeo = new THREE.SphereGeometry(0.04, 6, 4);
  }

  // 물결 고리 하나
  ripple(x, z, size = 1) {
    if (this.ripples.length > 24) return;
    const m = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false });
    const o = new THREE.Mesh(this.ringGeo, m);
    o.rotation.x = -Math.PI / 2;
    o.position.set(x, WATER_Y + 0.015, z);
    o.renderOrder = 2;
    this.v.scene.add(o);
    this.ripples.push({ o, life: 0, max: 1.1, size });
  }
  // 첨벙
  splash(x, z) {
    this.ripple(x, z, 1.8);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#E4F7FF', transparent: true, opacity: 0.95, depthWrite: false });
      const o = new THREE.Mesh(this.dropGeo, m);
      o.position.set(x, WATER_Y + 0.2, z);
      this.v.scene.add(o);
      const a = Math.random() * TAU, s = 0.8 + Math.random() * 1.2;
      this.drops.push({ o, life: 0, max: 0.7, vel: V(Math.cos(a) * s, 2.2 + Math.random() * 1.6, Math.sin(a) * s) });
    }
  }

  update(T, dt) {
    this.waterTex.offset.set((T * 0.02) % 1, (T * 0.013) % 1);
    for (const f of this.floats) {
      const a = T * f.sp + f.ph;
      f.o.position.set(Math.cos(a) * f.ax, f.y + Math.sin(T * 1.6 + f.ph) * 0.03, Math.sin(a * 1.3) * f.az);
      if (f.ball) f.o.rotation.set(T * 0.4, T * 0.25, 0);
      else f.o.rotation.z = T * 0.2 + f.ph;
    }
    this.ripples = this.ripples.filter((r) => {
      r.life += dt;
      const k = r.life / r.max;
      if (k >= 1) { r.o.removeFromParent(); r.o.material.dispose(); return false; }
      r.o.scale.setScalar(r.size * (1 + k * 2.2));
      r.o.material.opacity = 0.7 * (1 - k);
      return true;
    });
    this.drops = this.drops.filter((d) => {
      d.life += dt;
      if (d.life >= d.max || d.o.position.y < WATER_Y) { d.o.removeFromParent(); d.o.material.dispose(); return false; }
      d.vel.y -= 9 * dt;
      d.o.position.addScaledVector(d.vel, dt);
      return true;
    });
  }
}
