// 진숲 어린이 마을 — 놀이동산: 회전목마, 대관람차, 바이킹, 범퍼카
// 놀이기구는 모든 기기가 같은 시계(기기 시각)로 움직인다. 그래서 친구 화면에서도 내가 탄 자리가 같은 때에 같은 곳을 돈다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';

// 놀이동산 바닥(타원)과 입구
export const PARK = { x: 0, z: 23.2, rx: 12.6, rz: 6.6 };
export const GATE = { x: 0, z: 16.1 };
export const RIDES = {
  carousel: { x: 0, z: 20.6, name: '회전목마', door: [0, 17.2] },
  ferris: { x: -8.4, z: 22.6, name: '대관람차', door: [-8.4, 24.9] },
  viking: { x: 9.4, z: 25.2, name: '바이킹', door: [8.6, 21.45] },
  bumper: { x: 0, z: 27.0, name: '범퍼카', door: [0, 24.2] },
};
export const RIDE_IDS = Object.keys(RIDES);
// 범퍼카 장: 바닥 반너비, 반깊이, 차 반지름, 바닥 높이
export const ARENA = { hw: 4.0, hd: 1.9, car: 0.62, y: 0.12 };
export const CAR_SEAT = 0.39; // 차 바닥에서 앉은 아이 발밑(root)까지
// 나무가 자라면 안 되는 곳 (대관람차 곤돌라와 바이킹 배가 지나가는 하늘 아래)
export const NO_TREE = [
  { x: -8.4, z: 22.6, r: 6.4 },
  { x: 9.4, z: 25.2, r: 7.2 },
];

const EPOCH = Date.UTC(2026, 9, 1);
const TAU = Math.PI * 2;
// 부품 색을 꼭짓점 색으로 합쳐 한 번에 그리는 재질 (그림·빛나는 재질은 따로 합친다)
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
function merge(g) { mergeColored(g, VC); mergeStatic(g); }
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const FERRIS = { H: 7.85, R: 4.2, N: 6, period: 50 };
const VIKING = { P: 6.4, L: 5.8, period: 4.4 };
const CAROUSEL = { period: 18, r: 1.9, n: 6 };

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
const box = (w, h, d, mat, x, y, z, cast) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
const cyl = (rt, rb, h, mat, x, y, z, seg = 16, cast) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, cast);
const ball = (r, mat, x, y, z, seg = 14, cast) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, (seg * 0.66) | 0)), mat, x, y, z, cast);
// 두 점을 잇는 막대
function rod(a, b, r, mat, seg = 8, cast = true) {
  const d = V().subVectors(b, a);
  const o = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat, 0, 0, 0, cast);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
  return o;
}
// 세로 줄무늬 그림 (천막 지붕, 둘레). scallop이면 아래가 둥근 술 모양
function stripes(cols, n, { scallop = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const w = 512 / n;
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, 128); }
  if (scallop) {
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= n; i++) { g.beginPath(); g.arc(i * w, 128, w * 0.5, 0, TAU); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texMat = (map, opts = {}) => new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), ...opts });

// ---------- 자세 (내 주민과 친구 모두 같이 쓴다) ----------
export function resetLimbs(av) {
  for (const l of av.legs) l.rotation.z = 0;
  if (av.head) av.head.rotation.x = 0;
}
function seated(av) { av.legs[0].rotation.x = av.legs[1].rotation.x = -1.45; }
function waveArm(av, st, t) {
  if (!(st.wave > 0)) return false;
  av.arms[1].rotation.x = -2.75;
  av.arms[1].rotation.z = 0.2 + Math.sin(t * 14) * 0.35;
  return true;
}
// st: { wave } 손 흔들기 남은 시간 (내 주민만 쓴다)
export function ridePose(kind, park, st = {}) {
  if (kind === 'carousel') {
    return (av, dt, t) => {
      av.legs[0].rotation.x = av.legs[1].rotation.x = -0.45;
      av.legs[0].rotation.z = -0.5; av.legs[1].rotation.z = 0.5;
      av.arms[0].rotation.x = -1.0;
      if (!waveArm(av, st, t)) av.arms[1].rotation.x = -1.0;
    };
  }
  if (kind === 'viking') {
    return (av) => {
      seated(av);
      if ((park.vik && park.vik.peak) || st.wave > 0) {
        av.arms[0].rotation.x = av.arms[1].rotation.x = -2.9;
        av.arms[0].rotation.z = -0.3; av.arms[1].rotation.z = 0.3;
      } else {
        av.arms[0].rotation.x = av.arms[1].rotation.x = -1.25;
      }
    };
  }
  if (kind === 'bumper') {
    return (av, dt, t) => {
      seated(av);
      const s = Math.sin(t * 3) * 0.08;
      av.arms[0].rotation.x = -1.15 + s; av.arms[1].rotation.x = -1.15 - s;
      av.arms[0].rotation.z = 0.36; av.arms[1].rotation.z = -0.36;
      if (st.wave > 0) { av.arms[1].rotation.x = -2.75; av.arms[1].rotation.z = 0.2 + Math.sin(t * 14) * 0.35; }
    };
  }
  // 대관람차
  return (av, dt, t) => {
    seated(av);
    av.arms[0].rotation.x = -0.45;
    if (!waveArm(av, st, t)) av.arms[1].rotation.x = -0.45;
  };
}

// 바이킹: 36초마다 한 번 크게 흔들린다 (쉬기 5초, 오르기 6초, 크게 15초, 내려오기 6초, 쉬기 4초)
export function vikingState(T) {
  const c = ((T % 36) + 36) % 36;
  let A, phase;
  if (c < 5) { A = 0.04; phase = 'wait'; }
  else if (c < 11) { A = 0.04 + ((c - 5) / 6) * 0.81; phase = 'up'; }
  else if (c < 26) { A = 0.85; phase = 'full'; }
  else if (c < 32) { A = 0.85 - ((c - 26) / 6) * 0.81; phase = 'down'; }
  else { A = 0.04; phase = 'wait'; }
  const s = Math.sin((T * TAU) / VIKING.period);
  return { theta: A * s, A, phase, peak: A > 0.5 && Math.abs(s) > 0.82 };
}

// 아이디로 늘 같은 색을 고른다
function hashOf(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
export const CAR_COLORS = ['#EF6461', '#5FA9E0', '#F6D55C', '#F6A2C4', '#5DB760', '#A07FE3'];

function makeHorse(coatC, maneC, saddleC, gold) {
  const g = new THREE.Group();
  const coat = toon(coatC), mane = toon(maneC), saddle = toon(saddleC), dark = toon('#3A2E2A');
  const body = ball(1, coat, 0, 1.05, 0, 18);
  body.scale.set(0.27, 0.3, 0.62);
  g.add(body);
  const na = V(0, 1.2, 0.42), nb = V(0, 1.72, 0.78);
  g.add(rod(na, nb, 0.16, coat, 10));
  const head = ball(1, coat, 0, 1.82, 0.97, 14);
  head.scale.set(0.17, 0.19, 0.33);
  head.rotation.x = 0.55;
  g.add(head);
  for (const s of [-1, 1]) {
    g.add(ball(0.035, dark, s * 0.13, 1.9, 1.0, 8, false));
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.15, 6), coat, s * 0.08, 2.06, 0.8));
  }
  for (let i = 0; i < 4; i++) {
    const p = na.clone().lerp(nb, i / 3);
    g.add(ball(0.085, mane, 0, p.y + 0.11, p.z - 0.08, 8, false));
  }
  // 다리 (달리는 모양)
  const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8);
  for (const [x, z, rx] of [[-0.13, 0.4, -0.5], [0.13, 0.36, -0.22], [-0.13, -0.42, 0.45], [0.13, -0.38, 0.2]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.92, z);
    leg.rotation.x = rx;
    leg.add(mesh(legGeo, coat, 0, -0.31, 0));
    leg.add(cyl(0.065, 0.07, 0.08, gold, 0, -0.63, 0, 8));
    g.add(leg);
  }
  g.add(rod(V(0, 1.2, -0.58), V(0, 0.82, -0.95), 0.07, mane, 8));
  g.add(ball(0.1, mane, 0, 0.8, -0.98, 8));
  // 안장과 덮개
  g.add(box(0.62, 0.28, 0.46, saddle, 0, 1.22, -0.08));
  g.add(box(0.56, 0.08, 0.5, saddle, 0, 1.37, -0.08));
  g.add(box(0.5, 0.1, 0.06, gold, 0, 1.43, 0.17));
  merge(g);
  return g;
}

function makeBear(furC) {
  const g = new THREE.Group();
  const fur = toon(furC), light = toon('#F3E2C4'), dark = toon('#2E2A2A');
  g.add(ball(0.3, fur, 0, 0.95, -0.14, 14));
  g.add(ball(0.32, fur, 0, 1.45, -0.1, 16));
  for (const s of [-1, 1]) {
    g.add(ball(0.11, fur, s * 0.24, 1.72, -0.12, 10));
    g.add(ball(0.05, light, s * 0.24, 1.72, -0.05, 8, false));
    g.add(ball(0.04, dark, s * 0.11, 1.52, 0.19, 8, false));
    g.add(rod(V(s * 0.24, 1.05, -0.08), V(s * 0.13, 0.98, 0.22), 0.07, fur, 8));
  }
  g.add(ball(0.13, light, 0, 1.38, 0.18, 12));
  g.add(ball(0.045, dark, 0, 1.43, 0.3, 8, false));
  merge(g);
  return g;
}

export class Park {
  // v: Village, helpers: { signMesh }
  constructor(v, { signMesh }) {
    this.v = v;
    this.scene = v.scene;
    this.signMesh = signMesh;
    this.skew = 0; // 시험할 때 시간을 앞당기는 값
    this.seats = { carousel: [], ferris: [], viking: [] };
    this.fade = {};
    this.vik = vikingState(0);
    this.geo = {};
    this.buildGate();
    this.buildCarousel();
    this.buildFerris();
    this.buildViking();
    this.buildBumper();
    this.buildLamps();
    this.update(this.now(), 0);
  }

  now() { return (Date.now() - EPOCH) / 1000 + this.skew; }

  // 놀이기구 하나를 마을에 세운다 (누르면 걸어가서 탄다)
  place(id, root, r, obstacles) {
    const R = RIDES[id];
    root.userData.pick = { type: 'building', id };
    this.scene.add(root);
    this.v.pickRoots.push(root);
    for (const o of obstacles) {
      if (o.r) this.v.addObstacleCircle(R.x + o.x, R.z + o.z, o.r);
      else this.v.addObstacleBox(R.x + o.x, R.z + o.z, o.hw, o.hd, 0);
    }
    this.v.doors.push({ id, name: R.name, pos: V(R.door[0], 0, R.door[1]), group: root });
    this.fade[id] = this.v.makeFadeable(root, R.x, R.z, r);
  }

  sign(text, w, opts) {
    const g = new THREE.Group();
    const front = this.signMesh(text, w, opts);
    const back = this.signMesh(text, w, opts);
    back.rotation.y = Math.PI;
    back.position.z = -0.09;
    g.add(front, back);
    return g;
  }

  // ---------- 입구 ----------
  buildGate() {
    const g = new THREE.Group();
    const cols = ['#EF6461', '#FFFDF7'];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) g.add(cyl(0.17, 0.17, 0.5, toon(cols[i % 2]), s * 1.75, 0.25 + i * 0.5, 0, 12));
      g.add(ball(0.26, toon('#F6D55C'), s * 1.75, 3.15, 0, 14));
      // 풍선
      const bcols = s < 0 ? ['#F6A2C4', '#7EC8F2', '#F6D55C'] : ['#A8E0B5', '#EF6461', '#C9B6F2'];
      bcols.forEach((c, k) => {
        const top = V(s * (1.75 + (k - 1) * 0.32), 3.75 + (k % 2) * 0.3, (k - 1) * 0.12);
        g.add(rod(V(s * 1.75, 3.3, 0), top, 0.008, toon('#FFFDF7'), 4, false));
        const b = ball(0.2, toon(c), top.x, top.y + 0.2, top.z, 12);
        b.scale.y = 1.18;
        g.add(b);
      });
    }
    const arch = mesh(new THREE.TorusGeometry(1.75, 0.1, 8, 28, Math.PI), toon('#F6D55C'), 0, 3.0, 0);
    g.add(arch);
    merge(g);
    const sg = this.sign('진숲 놀이동산', 2.6, { bg: '#EF6461', fg: '#FFFDF7', border: '#B94A48' });
    sg.position.set(0, 3.35, 0.04);
    g.add(sg);
    g.position.set(GATE.x, 0, GATE.z);
    this.scene.add(g);
    this.v.addObstacleCircle(GATE.x - 1.75, GATE.z, 0.25);
    this.v.addObstacleCircle(GATE.x + 1.75, GATE.z, 0.25);
  }

  // ---------- 회전목마 ----------
  buildCarousel() {
    const C = RIDES.carousel;
    const root = new THREE.Group();
    root.position.set(C.x, 0, C.z);
    const gold = toon('#E8B04A');
    const base = new THREE.Group();
    base.add(cyl(2.85, 2.95, 0.22, toon('#E9C27D'), 0, 0.11, 0, 40));
    base.add(cyl(2.98, 3.02, 0.08, toon('#C99862'), 0, 0.04, 0, 40, false));
    merge(base);
    root.add(base);
    const rot = new THREE.Group();
    root.add(rot);
    this.carRot = rot;
    const deck = new THREE.Group();
    deck.add(cyl(2.7, 2.7, 0.12, toon('#FFF3DA'), 0, 0.28, 0, 40));
    deck.add(mesh(new THREE.CylinderGeometry(2.72, 2.72, 0.16, 48, 1, true), texMat(stripes(['#EF6461', '#FFFDF7'], 24)), 0, 0.28, 0));
    deck.add(cyl(0.34, 0.4, 3.65, toon('#F6D55C'), 0, 0.34 + 1.825, 0, 18));
    deck.add(cyl(0.43, 0.43, 1.0, toon('#7EC8F2'), 0, 2.3, 0, 18));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      deck.add(cyl(0.045, 0.045, 3.6, gold, Math.cos(a) * 2.5, 0.34 + 1.8, Math.sin(a) * 2.5, 8));
    }
    deck.add(mesh(new THREE.ConeGeometry(3.3, 1.35, 32), texMat(stripes(['#EF6461', '#FFFDF7', '#F6A2C4', '#FFFDF7'], 16)), 0, 3.99 + 0.675, 0));
    deck.add(cyl(3.3, 3.3, 0.1, toon('#FFFDF7'), 0, 3.95, 0, 40));
    deck.add(mesh(new THREE.CylinderGeometry(3.32, 3.32, 0.5, 48, 1, true),
      texMat(stripes(['#5FA9E0', '#F6D55C'], 24, { scallop: true }), { side: THREE.DoubleSide, alphaTest: 0.5 }), 0, 3.72, 0, false));
    const bulb = this.v.glow('#FFF2B3');
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      deck.add(ball(0.08, bulb, Math.cos(a) * 3.36, 3.96, Math.sin(a) * 3.36, 8, false));
    }
    deck.add(ball(0.22, gold, 0, 5.42, 0, 14));
    deck.add(cyl(0.03, 0.03, 0.6, toon('#6B4429'), 0, 5.78, 0, 6));
    deck.add(box(0.34, 0.2, 0.02, toon('#EF6461'), 0.18, 5.96, 0));
    // 말 (말 앞쪽 목 자리에 막대가 지나간다)
    const coats = ['#FFFDF7', '#F6A2C4', '#9FD8F0', '#F6D55C', '#C9B6F2', '#A8E0B5'];
    const manes = ['#F6A2C4', '#FFFDF7', '#5FA9E0', '#E8A23A', '#8B6FD0', '#5DB760'];
    const saddles = ['#EF6461', '#5FA9E0', '#E8B04A'];
    this.horses = [];
    for (let k = 0; k < CAROUSEL.n; k++) {
      const a = ((k + 0.5) / CAROUSEL.n) * TAU;
      const yaw = Math.PI - a; // 도는 방향을 바라본다
      const x = Math.cos(a) * CAROUSEL.r, z = Math.sin(a) * CAROUSEL.r;
      deck.add(cyl(0.04, 0.04, 3.6, gold, x + Math.sin(yaw) * 0.64, 0.34 + 1.8, z + Math.cos(yaw) * 0.64, 8));
      const hg = makeHorse(coats[k], manes[k], saddles[k % 3], gold);
      hg.position.set(x, 0.4, z);
      hg.rotation.y = yaw;
      const seat = new THREE.Object3D();
      seat.position.set(0, 1.09, -0.1);
      hg.add(seat);
      rot.add(hg);
      this.horses.push({ g: hg, ph: k * 2.1 });
      this.seats.carousel.push(seat);
    }
    merge(deck);
    rot.add(deck);
    const sg = this.v.postSign('회전목마', 1.5);
    sg.position.set(-2.4, 0, -2.5);
    sg.rotation.y = -0.4;
    root.add(sg);
    this.place('carousel', root, 3.3, [{ x: 0, z: 0, r: 2.9 }]);
  }

  // ---------- 대관람차 ----------
  buildFerris() {
    const F = RIDES.ferris, { H, R, N } = FERRIS;
    const root = new THREE.Group();
    root.position.set(F.x, 0, F.z);
    const white = toon('#FFFDF7'), steel = toon('#9FB6CC'), wood = toon('#C99862'), grey = toon('#8A8F98');
    const frame = new THREE.Group();
    for (const zf of [-1.25, 1.25]) {
      const top = V(0, H, zf * 0.92);
      frame.add(rod(V(-2.9, 0, zf), top, 0.13, steel, 10));
      frame.add(rod(V(2.9, 0, zf), top, 0.13, steel, 10));
      frame.add(rod(V(-2.0, 2.6, zf * 0.98), V(2.0, 2.6, zf * 0.98), 0.07, steel));
      frame.add(rod(V(-1.05, 5.25, zf * 0.95), V(1.05, 5.25, zf * 0.95), 0.06, steel));
      for (const sx of [-2.9, 2.9]) frame.add(box(0.5, 0.2, 0.5, toon('#B7B4AC'), sx, 0.1, zf));
    }
    const axle = mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 12), grey, 0, H, 0);
    axle.rotation.x = Math.PI / 2;
    frame.add(axle);
    frame.add(box(3.4, 0.4, 2.0, wood, 0, 0.2, 0));
    frame.add(box(1.6, 0.2, 0.45, wood, 0, 0.1, 1.2));
    for (let i = -3; i <= 3; i++) frame.add(box(0.05, 0.02, 1.98, toon('#B07F4E'), i * 0.45, 0.41, 0, false));
    merge(frame);
    root.add(frame);
    // 바퀴 (z축으로 돈다)
    const wheel = new THREE.Group();
    wheel.position.set(0, H, 0);
    const rimMat = toon('#F6A2C4');
    for (const zs of [-0.95, 0.95]) {
      wheel.add(mesh(new THREE.TorusGeometry(R, 0.09, 8, 64), rimMat, 0, 0, zs));
      wheel.add(mesh(new THREE.TorusGeometry(R * 0.5, 0.06, 6, 40), rimMat, 0, 0, zs));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        wheel.add(rod(V(0, 0, zs), V(Math.cos(a) * R, Math.sin(a) * R, zs), 0.045, white, 6));
      }
      const hub = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 20), toon('#F6D55C'), 0, 0, zs);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
    }
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU - TAU / 4; // 곤돌라가 매달리는 자리 (gondolaAngle과 같은 기준)
      wheel.add(rod(V(Math.cos(a) * R, Math.sin(a) * R, -1.0), V(Math.cos(a) * R, Math.sin(a) * R, 1.0), 0.07, grey, 8));
    }
    const bulb = this.v.glow('#FFE7A0');
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      wheel.add(ball(0.09, bulb, Math.cos(a) * R, Math.sin(a) * R, 1.06, 8, false));
    }
    merge(wheel);
    root.add(wheel);
    this.wheel = wheel;
    // 곤돌라: 늘 아래로 매달려 있다. 두 사람이 나란히 앉는다
    const gcols = ['#EF6461', '#F6D55C', '#5DB760', '#5FA9E0', '#A07FE3', '#F49A4C'];
    this.gondolas = [];
    for (let k = 0; k < N; k++) {
      const g = new THREE.Group();
      const col = toon(gcols[k]);
      g.add(rod(V(0, 0, 0), V(0, -0.62, 0), 0.05, grey));
      const roof = mesh(new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI / 2), col, 0, -0.8, 0);
      roof.scale.set(1.3, 0.4, 0.78);
      g.add(roof);
      g.add(box(2.6, 0.08, 1.56, white, 0, -0.8, 0));
      g.add(box(2.4, 0.12, 1.4, wood, 0, -3.14, 0));
      for (const sz of [-0.66, 0.66]) g.add(box(2.4, 0.66, 0.08, col, 0, -2.78, sz));
      for (const sx of [-1.16, 1.16]) g.add(box(0.08, 0.66, 1.4, col, sx, -2.78, 0));
      for (const sx of [-1.16, 1.16]) for (const sz of [-0.66, 0.66]) g.add(cyl(0.045, 0.045, 1.65, white, sx, -1.625, sz, 6));
      g.add(box(2.2, 0.12, 0.5, wood, 0, -2.86, -0.32));
      g.add(box(2.2, 0.5, 0.08, wood, 0, -2.55, -0.58));
      merge(g);
      for (const s of [-1, 1]) {
        const seat = new THREE.Object3D();
        seat.position.set(s * 0.56, -3.06, -0.28);
        g.add(seat);
        this.seats.ferris.push(seat);
      }
      root.add(g);
      this.gondolas.push(g);
    }
    const sg = this.v.postSign('대관람차', 1.5);
    sg.position.set(-2.7, 0, 1.75);
    root.add(sg);
    this.place('ferris', root, 5.6, [{ x: 0, z: 0, hw: 3.1, hd: 1.45 }]);
  }
  // 대관람차 곤돌라 k가 지금 있는 각도 (맨 아래가 -π/2)
  gondolaAngle(k, T) { return (T * TAU) / FERRIS.period + (k * TAU) / FERRIS.N - TAU / 4; }

  // ---------- 바이킹 ----------
  buildViking() {
    const Vk = RIDES.viking, { P, L } = VIKING;
    const root = new THREE.Group();
    root.position.set(Vk.x, 0, Vk.z);
    const steel = toon('#7E8FA6'), wood = toon('#C99862'), red = toon('#EF6461'), gold = toon('#E8B04A');
    const frame = new THREE.Group();
    // 다리는 z ±1.95, 흔들리는 팔은 z ±1.62: 서로 다른 면이라 부딪히지 않는다
    for (const zf of [-1.95, 1.95]) {
      frame.add(rod(V(-3.6, 0, zf), V(0, P + 0.15, zf), 0.15, steel, 10));
      frame.add(rod(V(3.6, 0, zf), V(0, P + 0.15, zf), 0.15, steel, 10));
      frame.add(rod(V(-2.45, 2.15, zf), V(2.45, 2.15, zf), 0.08, steel));
      for (const sx of [-3.6, 3.6]) frame.add(box(0.55, 0.22, 0.55, toon('#B7B4AC'), sx, 0.11, zf));
    }
    const axle = mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.4, 12), toon('#8A8F98'), 0, P, 0);
    axle.rotation.x = Math.PI / 2;
    frame.add(axle);
    for (const zs of [-2.22, 2.22]) frame.add(ball(0.3, toon('#F6D55C'), 0, P, zs, 12));
    // 타는 곳 (북쪽): 아이들은 남쪽(카메라 쪽)을 보고 앉는다
    frame.add(box(5.6, 0.55, 0.9, wood, 0, 0.275, -2.35));
    frame.add(box(1.4, 0.26, 0.45, wood, -0.8, 0.13, -3.0));
    merge(frame);
    root.add(frame);
    const swing = new THREE.Group();
    swing.position.set(0, P, 0);
    root.add(swing);
    this.swing = swing;
    const ship = new THREE.Group();
    ship.position.y = -L;
    swing.add(ship);
    const shipStatic = new THREE.Group();
    for (const zs of [-1.62, 1.62]) {
      shipStatic.add(rod(V(0, L, zs), V(-1.8, 1.25, zs), 0.11, red, 8));
      shipStatic.add(rod(V(0, L, zs), V(1.8, 1.25, zs), 0.11, red, 8));
      for (const sx of [-1.8, 1.8]) shipStatic.add(box(0.3, 0.3, 0.34, toon('#8A8F98'), sx, 1.2, zs * 0.92));
    }
    const s = new THREE.Shape();
    s.moveTo(-2.0, 0);
    s.lineTo(2.0, 0);
    s.quadraticCurveTo(2.95, 0.05, 3.2, 1.65);
    s.lineTo(2.88, 1.65);
    s.quadraticCurveTo(2.7, 1.15, 2.3, 1.1);
    s.lineTo(-2.3, 1.1);
    s.quadraticCurveTo(-2.7, 1.15, -2.88, 1.65);
    s.lineTo(-3.2, 1.65);
    s.quadraticCurveTo(-2.95, 0.05, -2.0, 0);
    const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, curveSegments: 10 });
    hullGeo.translate(0, 0, -1.25);
    shipStatic.add(mesh(hullGeo, toon('#5FA9E0')));
    shipStatic.add(box(4.9, 0.14, 2.64, toon('#F6D55C'), 0, 0.75, 0));
    shipStatic.add(box(4.6, 0.05, 2.4, wood, 0, 1.17, 0, false));
    for (let i = 0; i < 4; i++) {
      for (const zs of [-1.33, 1.33]) {
        const sh = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 18), toon(i % 2 ? '#EF6461' : '#F6D55C'), -1.5 + i, 0.55, zs);
        sh.rotation.x = Math.PI / 2;
        shipStatic.add(sh);
        shipStatic.add(ball(0.07, toon('#8A8F98'), -1.5 + i, 0.55, zs * 1.03, 8, false));
      }
    }
    // 의자: 앞줄은 낮게, 뒷줄은 높게
    const yf = 1.5, yb = 2.15;
    shipStatic.add(box(4.9, yf - 1.12, 0.55, wood, 0, (1.12 + yf) / 2, 0.42));
    shipStatic.add(box(4.9, yb - 1.12, 0.6, wood, 0, (1.12 + yb) / 2, -0.82));
    shipStatic.add(box(4.9, 0.55, 0.1, red, 0, yb + 0.27, -1.12));
    shipStatic.add(rod(V(-2.45, 1.95, 0.86), V(2.45, 1.95, 0.86), 0.045, gold, 8));
    for (const sx of [-2.45, 2.45]) shipStatic.add(rod(V(sx, 1.5, 0.86), V(sx, 1.95, 0.86), 0.04, gold, 6));
    // 용머리와 꼬리
    const green = toon('#5DB760'), dark = toon('#2E2A2A');
    shipStatic.add(rod(V(3.0, 1.45, 0), V(3.45, 2.5, 0), 0.2, green, 10));
    const head = ball(0.34, green, 3.6, 2.65, 0, 14);
    head.scale.set(1.35, 0.95, 0.9);
    shipStatic.add(head);
    const snout = ball(0.2, green, 3.98, 2.56, 0, 12);
    snout.scale.set(1.3, 0.8, 0.9);
    shipStatic.add(snout);
    for (const zs of [-1, 1]) {
      shipStatic.add(ball(0.09, toon('#FFFDF7'), 3.7, 2.82, zs * 0.2, 10, false));
      shipStatic.add(ball(0.05, dark, 3.75, 2.83, zs * 0.25, 8, false));
      const horn = mesh(new THREE.ConeGeometry(0.06, 0.26, 8), gold, 3.42, 2.98, zs * 0.15);
      horn.rotation.z = 0.5;
      shipStatic.add(horn);
    }
    shipStatic.add(rod(V(-3.0, 1.45, 0), V(-3.35, 2.3, 0), 0.17, green, 10));
    shipStatic.add(ball(0.2, green, -3.38, 2.4, 0, 12));
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.07, 0.18, 6), gold, 3.15 + i * 0.14, 1.95 + i * 0.3, 0);
      sp.rotation.z = 0.45;
      shipStatic.add(sp);
    }
    merge(shipStatic);
    ship.add(shipStatic);
    for (const [z, y] of [[0.36, yf - 0.26], [-0.86, yb - 0.26]]) {
      for (const x of [-1.875, -0.625, 0.625, 1.875]) {
        const seat = new THREE.Object3D();
        seat.position.set(x, y, z);
        ship.add(seat);
        this.seats.viking.push(seat);
      }
    }
    const sg = this.v.postSign('바이킹', 1.4);
    sg.position.set(-3.1, 0, -2.6);
    root.add(sg);
    this.place('viking', root, 5.2, [{ x: 0, z: 0, hw: 3.9, hd: 2.15 }, { x: 0, z: -2.6, hw: 2.8, hd: 0.65 }]);
  }

  // ---------- 범퍼카 ----------
  makeCar(color) {
    const geo = this.geo;
    if (!geo.bumper) {
      geo.bumper = new THREE.TorusGeometry(0.66, 0.12, 8, 28);
      geo.body = new THREE.BoxGeometry(1.16, 0.34, 1.44);
      geo.hood = new THREE.BoxGeometry(1.0, 0.24, 0.42);
      geo.cushion = new THREE.BoxGeometry(0.8, 0.07, 0.5);
      geo.back = new THREE.BoxGeometry(0.9, 0.6, 0.14);
      geo.wheel = new THREE.TorusGeometry(0.15, 0.03, 6, 16);
      geo.col = new THREE.CylinderGeometry(0.03, 0.03, 0.36, 6);
      geo.pole = new THREE.CylinderGeometry(0.02, 0.02, 2.1, 5);
      geo.flag = new THREE.BoxGeometry(0.36, 0.22, 0.02);
    }
    const g = new THREE.Group();
    const body = toon(color), rub = toon('#3A3A44'), seat = toon('#2E2A2A');
    const bumper = mesh(geo.bumper, rub, 0, 0.2, 0);
    bumper.rotation.x = Math.PI / 2;
    bumper.scale.set(1, 1.2, 1);
    g.add(bumper);
    g.add(mesh(geo.body, body, 0, 0.42, 0));
    const hood = mesh(geo.hood, body, 0, 0.66, 0.5);
    hood.rotation.x = -0.25;
    g.add(hood);
    g.add(mesh(geo.cushion, seat, 0, 0.62, -0.12, false));
    g.add(mesh(geo.back, body, 0, 0.88, -0.6));
    const col = mesh(geo.col, seat, 0, 0.8, 0.36, false);
    col.rotation.x = 0.6;
    g.add(col);
    const wh = mesh(geo.wheel, seat, 0, 0.97, 0.27, false);
    wh.rotation.x = -0.95;
    g.add(wh);
    g.add(mesh(geo.pole, toon('#DDE3EA'), 0.55, 1.65, -0.76, false));
    g.add(mesh(geo.flag, toon(CAR_COLORS[(CAR_COLORS.indexOf(color) + 2) % CAR_COLORS.length] || '#F6D55C'), 0.74, 2.58, -0.76, false));
    if (!this.carLight) this.carLight = this.v.glow('#FFF4CF');
    for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), this.carLight, s * 0.35, 0.5, 0.73, false));
    merge(g);
    g.userData.car = true;
    return g;
  }

  buildBumper() {
    const B = RIDES.bumper, A = ARENA;
    const root = new THREE.Group();
    root.position.set(B.x, 0, B.z);
    const st = new THREE.Group();
    st.add(box(2 * A.hw + 0.5, A.y, 2 * A.hd + 0.5, toon('#6F7FA8'), 0, A.y / 2, 0, false));
    for (let i = -3; i <= 3; i++) st.add(box(0.06, 0.006, 2 * A.hd, toon('#7E8EB8'), i * 1.1, A.y + 0.003, 0, false));
    // 고무 벽 (빨강·흰색 번갈아)
    const wallH = 0.42, wy = A.y + wallH / 2;
    const cols = [toon('#EF6461'), toon('#FFFDF7')];
    const xs = 2 * A.hw + 0.3, zs = 2 * A.hd + 0.3;
    const nx = 10, nz = 5;
    for (let i = 0; i < nx; i++) {
      const x = -xs / 2 + (i + 0.5) * (xs / nx);
      for (const z of [-(A.hd + 0.12), A.hd + 0.12]) st.add(box(xs / nx, wallH, 0.2, cols[i % 2], x, wy, z));
    }
    for (let i = 0; i < nz; i++) {
      const z = -zs / 2 + (i + 0.5) * (zs / nz);
      for (const x of [-(A.hw + 0.12), A.hw + 0.12]) st.add(box(0.2, wallH, zs / nz, cols[(i + 1) % 2], x, wy, z));
    }
    const bulb = this.v.glow('#FFF2B3');
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => V(sx * (A.hw + 0.12), 0, sz * (A.hd + 0.12)));
    for (const c of corners) {
      st.add(cyl(0.11, 0.13, 3.1, toon('#F6D55C'), c.x, 1.55, c.z, 10));
      st.add(ball(0.2, bulb, c.x, 3.2, c.z, 12, false));
    }
    // 줄 전구 (앞뒤)
    for (const sz of [-1, 1]) {
      const a = corners[sz < 0 ? 0 : 3], b = corners[sz < 0 ? 1 : 2];
      for (let i = 1; i < 12; i++) {
        const k = i / 12;
        st.add(ball(0.07, bulb, a.x + (b.x - a.x) * k, 2.95 - Math.sin(k * Math.PI) * 0.45, a.z, 8, false));
      }
    }
    merge(st);
    root.add(st);
    const sg = this.sign('범퍼카', 2.0, { bg: '#5FA9E0', fg: '#FFFDF7', border: '#3F7FB8' });
    sg.position.set(0, 1.3, -(A.hd + 0.12));
    root.add(sg);
    // 곰 친구들이 모는 차 셋: 같은 길을 같은 빠르기로 돌아서 서로 부딪히지 않는다
    this.npc = [];
    const npcCols = ['#5DB760', '#F49A4C', '#A07FE3'];
    const bears = ['#B07F4E', '#E9C88F', '#8A8F98'];
    for (let i = 0; i < 3; i++) {
      const car = this.makeCar(npcCols[i]);
      const bear = makeBear(bears[i]);
      bear.position.y = -0.0;
      car.add(bear);
      car.position.y = A.y;
      root.add(car);
      this.npc.push({ g: car, ph: (i * TAU) / 3, spin: 0, x: 0, z: 0, wx: 0, wz: 0 });
    }
    this.bumperRoot = root;
    this.place('bumper', root, 4.2, [{ x: 0, z: 0, hw: A.hw + 0.25, hd: A.hd + 0.25 }]);
  }
  // 범퍼카 장 안으로 자리를 맞춘다
  clampArena(p) {
    const B = RIDES.bumper, A = ARENA;
    const mx = A.hw - A.car, mz = A.hd - A.car;
    p.x = Math.max(B.x - mx, Math.min(B.x + mx, p.x));
    p.z = Math.max(B.z - mz, Math.min(B.z + mz, p.z));
    return p;
  }
  // 범퍼카 장의 다른 차들 (곰 친구 차 + 범퍼카를 타는 친구들)
  otherCars() {
    const out = this.npc.map((n) => ({ x: n.wx, z: n.wz, npc: n }));
    for (const r of this.v.remotes.values()) if (r.pin && r.pin.kind === 'bumper') out.push({ x: r.av.root.position.x, z: r.av.root.position.z, remote: r });
    return out;
  }

  // ---------- 가로등 ----------
  buildLamps() {
    for (const [x, z] of [[-3.4, 17.0], [3.4, 17.0], [-5.6, 29.0], [5.0, 29.3]]) {
      const g = new THREE.Group();
      g.add(cyl(0.09, 0.12, 2.6, toon('#4A4A55'), 0, 1.3, 0, 8));
      g.add(ball(0.26, this.v.glow('#FFF4CF'), 0, 2.75, 0, 12));
      g.add(ball(0.12, toon('#EF6461'), 0, 3.02, 0, 8));
      g.position.set(x, 0, z);
      merge(g);
      this.scene.add(g);
      this.v.addObstacleCircle(x, z, 0.25);
    }
  }

  // ---------- 자리 ----------
  // 빈자리 고르기 (taken: 친구들이 앉은 자리 번호)
  pickSeat(kind, taken, T = this.now()) {
    const seats = this.seats[kind];
    if (!seats) return -1;
    const free = (i) => !taken.has(i);
    if (kind === 'ferris') {
      // 친구가 혼자 탄 곤돌라가 있으면 그 옆자리에 함께 탄다
      for (let k = 0; k < FERRIS.N; k++) {
        const a = k * 2, b = k * 2 + 1;
        if (taken.has(a) !== taken.has(b)) return taken.has(a) ? b : a;
      }
      // 아니면 맨 아래에 가까운 곤돌라부터
      const order = [...Array(FERRIS.N).keys()].sort((a, b) => {
        const da = Math.abs(Math.sin((this.gondolaAngle(a, T) + TAU / 4) / 2));
        const db = Math.abs(Math.sin((this.gondolaAngle(b, T) + TAU / 4) / 2));
        return da - db;
      });
      for (const k of order) for (const s of [0, 1]) if (free(k * 2 + s)) return k * 2 + s;
      return -1;
    }
    if (kind === 'viking') {
      for (const i of [1, 2, 5, 6, 0, 3, 4, 7]) if (free(i)) return i;
      return -1;
    }
    // 회전목마: 입구(북쪽)에 가까운 말부터
    const door = V(RIDES.carousel.door[0], 0, RIDES.carousel.door[1]);
    const p = V();
    const order = seats.map((s, i) => { s.getWorldPosition(p); return [i, p.distanceTo(door)]; }).sort((a, b) => a[1] - b[1]);
    for (const [i] of order) if (free(i)) return i;
    return -1;
  }

  // 친구가 놀이기구를 타고 있으면 내 화면에서도 그 자리에 앉힌다
  decorate(r, act, seat) {
    const v = this.v;
    if (act === 'bumper') {
      if (r.pin && r.pin.kind === 'bumper') return;
      v.unpinRemote(r.id);
      const car = this.makeCar(CAR_COLORS[hashOf(r.id) % CAR_COLORS.length]);
      car.position.y = -CAR_SEAT;
      r.av.root.add(car);
      this.clampArena(r.av.root.position);
      v.pinRemote(r.id, { kind: 'bumper', free: true, car, y: ARENA.y + CAR_SEAT, pose: ridePose('bumper', this), auto: true });
      return;
    }
    const list = this.seats[act];
    if (!list || !Number.isInteger(seat) || !list[seat]) return;
    if (r.pin && r.pin.kind === act && r.pin.seat === seat) return;
    v.unpinRemote(r.id);
    v.pinRemote(r.id, { kind: act, seat, obj: list[seat], pose: ridePose(act, this), auto: true });
  }

  // ---------- 움직이기 ----------
  update(T, dt) {
    // 회전목마
    this.carRot.rotation.y = (T * TAU) / CAROUSEL.period;
    for (const h of this.horses) h.g.position.y = 0.4 + 0.14 * Math.sin((T * TAU) / 2.6 + h.ph);
    // 대관람차
    this.wheel.rotation.z = (T * TAU) / FERRIS.period;
    this.gondolas.forEach((g, k) => {
      const a = this.gondolaAngle(k, T);
      g.position.set(Math.cos(a) * FERRIS.R, FERRIS.H + Math.sin(a) * FERRIS.R, 0);
      g.rotation.z = 0.035 * Math.sin(T * 1.3 + k);
    });
    // 바이킹
    this.vik = vikingState(T);
    this.swing.rotation.z = this.vik.theta;
    // 범퍼카 곰 친구들
    const B = RIDES.bumper, A = ARENA;
    for (const n of this.npc) {
      const u = T * 0.42 + n.ph;
      const x = Math.cos(u) * (A.hw - 1.0) + Math.sin(u * 3) * 0.12;
      const z = Math.sin(u) * (A.hd - 0.85);
      const dx = -Math.sin(u) * (A.hw - 1.0), dz = Math.cos(u) * (A.hd - 0.85);
      n.x = x; n.z = z;
      n.wx = B.x + x; n.wz = B.z + z;
      n.spin = Math.max(0, n.spin - dt * 1.4);
      n.g.position.set(x, A.y, z);
      n.g.rotation.y = Math.atan2(dx, dz) + Math.sin(n.spin * 14) * n.spin * 0.9;
    }
  }
}
