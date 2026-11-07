// 진숲 어린이 마을 — 마을 동물들: 하늘을 나는 새, 길을 걷는 강아지와 고양이
// 동물도 기기 시각으로 움직여서 친구 화면에서도 거의 같은 자리를 걷는다. 누르면 쓰다듬을 수 있다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeGeos, mergeColored } from './merge.js';
import { inPool } from './pool.js';
import { PET_ITEMS, PET_IDS } from './pets-data.js';

const TAU = Math.PI * 2;
// 부품 색을 꼭짓점 색으로 합쳐 한 번에 그리는 재질 (그림·빛나는 재질은 따로 합친다)
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
function merge(g) { mergeColored(g, VC); mergeStatic(g); }
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
const ball = (r, mat, x, y, z, seg = 12, cast) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, (seg * 0.66) | 0)), mat, x, y, z, cast);
function rod(a, b, r, mat, seg = 6) {
  const d = V().subVectors(b, a);
  const o = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}
function turn(cur, want, k) {
  let d = want - cur;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return cur + d * Math.min(1, k);
}

// 걷는 길: 닫힌 꺾은선. at(d)는 길을 따라 d만큼 간 자리와 방향
class Route {
  constructor(pts) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      this.cum.push(this.cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    this.total = this.cum[pts.length];
  }
  at(d, out) {
    d = ((d % this.total) + this.total) % this.total;
    let i = 0;
    while (i < this.pts.length - 1 && this.cum[i + 1] < d) i++;
    const a = this.pts[i], b = this.pts[(i + 1) % this.pts.length];
    const seg = this.cum[i + 1] - this.cum[i] || 1;
    const k = (d - this.cum[i]) / seg;
    out.x = a[0] + (b[0] - a[0]) * k;
    out.z = a[1] + (b[1] - a[1]) * k;
    out.h = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return out;
  }
}
const circle = (cx, cz, r, n = 28) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
const backAndForth = (pts) => [...pts, ...pts.slice(1, -1).reverse()];

const PETS = [
  { kind: 'dog', name: '누렁이', coat: '#E3B26B', ear: '#B9803D', collar: '#EF6461', route: circle(0, -2.5, 4.75, 32), speed: 1.0, ph: 0 },
  { kind: 'cat', name: '나비', coat: '#F4A65C', ear: '#E08A3C', route: backAndForth([[0.3, 3.5], [0.3, 10.3], [-3, 11.7], [-4.8, 12.5]]), speed: 0.8, ph: 7 },
  { kind: 'dog', name: '흰둥이', coat: '#FFF6E6', ear: '#C9A27A', collar: '#5FA9E0', route: circle(0, 52.5, 3.6, 30), speed: 1.15, ph: 3 },
  { kind: 'cat', name: '회색이', coat: '#A9AEB6', ear: '#8A8F98', route: backAndForth([[0.35, -7.4], [0.35, -17.0]]), speed: 0.75, ph: 11 },
];
const CYCLE = 15, WALK = 10; // 15초마다 10초 걷고 5초 쉰다

// 개와 고양이. d.look이 있으면 품종 모양 (값은 js/pets-data.js 맨 위 설명). 없으면 처음 모양 그대로
function makePet(d) {
  const cat = d.kind === 'cat';
  const L = d.look || {};
  const H = (cat ? 0.32 : 0.38) * (L.leg || 1); // 엉덩이 높이
  const len = L.len || 1, wide = L.wide || 1;
  const coat = toon(d.coat), dark = toon('#2E2A2A'), cream = toon(L.muzzle || '#FFF3DA');
  const headC = L.head ? toon(L.head) : coat;
  const pointC = L.points ? toon(L.points) : null; // 샴, 랙돌: 귀·얼굴·다리·꼬리가 진하다
  const legC = pointC || (L.legC ? toon(L.legC) : coat);
  const pawC = L.mitts ? toon(L.mitts) : legC;
  const tailC = pointC || (L.tailC ? toon(L.tailC) : coat);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bw = (cat ? 0.17 : 0.2) * wide, bh = (cat ? 0.16 : 0.19) * wide, bl = (cat ? 0.34 : 0.36) * len;
  const ty = H + 0.08;
  const torsoG = new THREE.Group();
  const torso = ball(1, coat, 0, ty, 0, 14);
  torso.scale.set(bw, bh, bl);
  torsoG.add(torso);
  const shell = (c, sx, sy, sz, x, y, z, g = torsoG) => { const m = ball(1, c, x, y, z, 12); m.scale.set(sx, sy, sz); g.add(m); return m; };
  if (L.saddle) shell(toon(L.saddle), bw * 1.04, bh * 0.72, bl * 0.82, 0, ty + bh * 0.32, -bl * 0.06); // 등 무늬
  if (L.chest) { // 가슴(과 고양이는 배) 무늬
    shell(toon(L.chest), bw * 0.8, bh * 0.78, bl * 0.42, 0, ty - bh * 0.15, bl * 0.62);
    if (cat) shell(toon(L.chest), bw * 0.86, bh * 0.6, bl * 0.72, 0, ty - bh * 0.45, bl * 0.08);
  }
  if (L.stripes) { // 태비 줄무늬: 등과 옆구리를 감싸는 띠
    const sc = toon(L.stripes);
    for (const k of [-0.62, -0.36, -0.1, 0.16, 0.42]) {
      const f = Math.sqrt(1 - k * k);
      shell(sc, bw * f * 1.04, bh * f * 0.88, 0.024, 0, ty + bh * f * 0.22, bl * k);
    }
  }
  if (L.fluff === 'skirt') { // 바닥까지 늘어진 긴 털 (말티즈, 요크셔테리어): 몸 가운데서 시작해 아래로 살짝 퍼진다
    const prof = [[0, 0], [0.86, 0], [1.02, 0.05], [1.07, 0.2], [1.0, 0.55], [0.93, 0.84], [0.62, 1], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y));
    const sk = mesh(new THREE.LatheGeometry(prof, 18), toon(L.skirt || d.coat), 0, 0.06, -bl * 0.04);
    sk.scale.set(bw * 1.02, ty - 0.06, bl * 0.93);
    torsoG.add(sk);
  }
  if (L.fluff === 'curly') { // 곱슬 털: 몸 위에 작은 털 뭉치
    const n = 18;
    for (let i = 0; i < n; i++) {
      const el = Math.asin(1 - (i + 0.5) / n * 1.55); // 위에서 옆구리 아래까지
      const az = i * 2.39996;
      const r = 0.07 * wide;
      shell(coat, r, r, r, Math.cos(el) * Math.sin(az) * bw * 0.92, ty + Math.sin(el) * bh * 0.92, Math.cos(el) * Math.cos(az) * bl * 0.92);
    }
  }
  if (L.fluff === 'mane') shell(coat, 0.23 * wide, 0.21, 0.17, 0, H + 0.2, bl * 0.62); // 목둘레 갈기 (포메라니안)
  if (L.fluff === 'puff') shell(coat, 0.16 * wide, 0.15, 0.12, 0, H + 0.18, bl * 0.66); // 목둘레 긴 털 (페르시안, 랙돌)
  if (L.fluff === 'puff' && L.chest) shell(toon(L.chest), 0.13 * wide, 0.12, 0.08, 0, H + 0.14, bl * 0.76);
  if (d.collar) {
    const c = mesh(new THREE.TorusGeometry(0.12 * wide, 0.024, 6, 18), toon(d.collar), 0, H + 0.2, 0.27 * len);
    c.rotation.x = Math.PI / 2 + 0.5;
    torsoG.add(c);
  }
  merge(torsoG);
  body.add(torsoG);
  // 머리
  const head = new THREE.Group();
  head.position.set(0, H + 0.3, bl * (cat ? 0.912 : 0.972));
  const hr = cat ? 0.17 : 0.19;
  const skull = ball(hr, headC, 0, 0, 0, 14);
  if (L.fluff === 'puff') skull.scale.set(1.14, 1, 1); // 볼이 통통
  head.add(skull);
  // 얼굴이 털에 묻히지 않게 눈·코를 앞으로 낸다 (비숑, 포메라니안)
  const fz = L.round ? 0.075 : L.fluff === 'mane' ? 0.02 : 0;
  if (L.round) shell(coat, 0.26, 0.25, 0.25, 0, 0.03, -0.02, head); // 솜뭉치 같은 둥근 머리
  if (L.fluff === 'mane') shell(coat, 0.22, 0.2, 0.17, 0, -0.03, -0.07, head);
  const earS = L.earS || 1;
  const earC = pointC || (cat ? headC : toon(d.ear));
  const ears = L.ears || (cat ? 'up' : 'drop');
  for (const s of [-1, 1]) {
    if (cat) {
      const e = mesh(new THREE.ConeGeometry(0.07 * earS, 0.15 * earS, 4), earC, s * 0.1, 0.17 + (earS - 1) * 0.05, -0.01);
      e.rotation.z = -s * 0.25;
      head.add(e);
    } else if (ears === 'up') { // 선 귀 (웰시코기, 진돗개, 요크셔테리어, 포메라니안)
      const e = mesh(new THREE.ConeGeometry(0.07 * earS, 0.16 * earS, 4), earC, s * 0.105, 0.15 + 0.07 * earS, -0.015);
      e.rotation.set(0.15, 0, -s * 0.3);
      head.add(e);
    } else if (ears === 'long') { // 길게 늘어진 귀 (비글, 닥스훈트, 골든 리트리버)
      shell(earC, 0.06, 0.19, 0.055, s * 0.178, -0.06, -0.01, head).rotation.z = s * 0.15;
    } else if (ears === 'fluff') { // 긴 털이 덮인 귀 (말티즈)
      shell(earC, 0.08, 0.2, 0.07, s * 0.17, -0.08, -0.02, head).rotation.z = s * 0.2;
    } else if (ears === 'curly') { // 곱슬 털 뭉치 귀 (푸들)
      for (const [x, y, z] of [[0.18, 0.0, -0.02], [0.2, -0.08, -0.01], [0.19, -0.16, 0]]) shell(earC, 0.065, 0.065, 0.065, s * x, y, z, head);
    } else if (ears !== 'hidden') {
      const e = ball(1, earC, s * 0.17, 0.0, -0.02, 10);
      e.scale.set(0.06, 0.13, 0.045);
      e.rotation.z = s * 0.35;
      head.add(e);
    }
    if (L.eye) { // 고양이 눈동자 색
      head.add(ball(0.036, toon(L.eye), s * 0.075, 0.05, 0.14 + fz, 8, false));
      shell(dark, 0.012, 0.024, 0.012, s * 0.075, 0.05, 0.172 + fz, head);
    } else head.add(ball(0.03, dark, s * 0.075, 0.05, (cat ? 0.145 : 0.16) + fz, 8, false));
  }
  if (pointC) shell(pointC, 0.13, 0.12, 0.09, 0, -0.03, 0.09, head); // 얼굴 가운데 진한 무늬
  if (L.blaze) shell(toon(L.blaze), 0.03, 0.1, 0.03, 0, 0.07, hr - 0.02, head).rotation.x = -0.5; // 이마의 흰 줄
  if (L.mark) for (const x of [-0.042, 0, 0.042]) shell(toon(L.stripes), 0.011, 0.045, 0.012, x, 0.11, 0.122, head).rotation.x = -0.75; // 이마 M자 무늬
  const sk = L.snout || 1;
  const snout = ball(1, cream, 0, -0.05, Math.max(hr * 0.72, (cat ? 0.13 + (sk - 1) * 0.04 : 0.16 + (sk - 1) * 0.06)) + fz, 10);
  snout.scale.set(cat ? 0.075 : 0.095, cat ? 0.055 : 0.075, (cat ? 0.06 : 0.11) * Math.max(0.6, sk));
  head.add(snout);
  const noseZ = Math.max(snout.position.z + snout.scale.z * (cat ? 1 : 0.95), hr * 0.98 + fz);
  head.add(ball(0.032, dark, 0, -0.02, noseZ, 8, false));
  if (L.bow) { // 머리 위 리본 (말티즈, 요크셔테리어)
    shell(headC, 0.06, 0.05, 0.06, 0, hr - 0.02, -0.01, head);
    const bc = toon(L.bow);
    for (const s of [-1, 1]) shell(bc, 0.045, 0.03, 0.022, s * 0.042, hr + 0.035, 0, head).rotation.z = s * 0.45;
    shell(bc, 0.02, 0.02, 0.02, 0, hr + 0.035, 0.005, head);
  }
  if (L.fluff === 'curly' && !L.round) shell(coat, 0.1, 0.09, 0.1, 0, 0.15, -0.02, head); // 푸들 머리 위 털 뭉치
  merge(head);
  body.add(head);
  // 다리: 대각선 두 짝씩 함께 움직인다 (앞왼+뒤오, 앞오+뒤왼)
  const lr = L.fluff === 'curly' ? 1.35 : L.fluff === 'puff' ? 1.3 : 1;
  const legGeo = new THREE.CylinderGeometry(0.045 * lr, 0.04 * lr, H, 6);
  const pawGeo = new THREE.SphereGeometry(0.05 * lr, 8, 6);
  const legs = [];
  for (const pair of [[[-1, 1], [1, -1]], [[1, 1], [-1, -1]]]) {
    const g = new THREE.Group();
    g.position.y = H;
    for (const [sx, sz] of pair) {
      g.add(mesh(legGeo, legC, sx * 0.1 * wide, -H / 2, sz * 0.2 * len));
      g.add(mesh(pawGeo, pawC, sx * 0.1 * wide, -H + 0.04, sz * 0.2 * len + 0.02));
    }
    merge(g);
    body.add(g);
    legs.push(g);
  }
  // 꼬리
  const tail = new THREE.Group();
  tail.position.set(0, H + 0.12, -bl * (cat ? 0.97 : 0.917));
  const tt = L.tail || (cat ? 'cat' : 'dog');
  if (tt === 'cat' || tt === 'fluffy') {
    const r = tt === 'fluffy' ? 0.055 : 0.03;
    tail.add(rod(V(0, 0, 0), V(0, 0.32, -0.1), r, tailC));
    tail.add(ball(r + 0.01, tailC, 0, 0.33, -0.1, 8));
    if (L.stripes) for (const k of [0.3, 0.55, 0.8]) tail.add(ball(r + 0.006, toon(L.stripes), 0, 0.32 * k, -0.1 * k, 8));
  } else if (tt === 'stub') tail.add(ball(0.06, tailC, 0, 0.02, -0.03, 8));
  else if (tt === 'curl') { // 등 위로 말아 올린 꼬리 (진돗개)
    const c = mesh(new THREE.TorusGeometry(0.1, 0.042, 6, 14, Math.PI * 1.35), tailC, 0, 0.1, 0.0);
    c.rotation.set(0, Math.PI / 2, -0.35);
    tail.add(c);
  } else if (tt === 'plume') { // 등에 얹은 풍성한 꼬리 (포메라니안, 비숑)
    tail.add(rod(V(0, 0, 0), V(0, 0.08, 0.02), 0.04, tailC));
    shell(tailC, 0.1, 0.075, 0.15, 0, 0.13, 0.09, tail).rotation.x = -0.25;
  } else if (tt === 'pom') { // 끝이 동그란 꼬리 (푸들)
    tail.add(rod(V(0, 0, 0), V(0, 0.16, -0.06), 0.03, tailC));
    tail.add(ball(0.075, tailC, 0, 0.18, -0.07, 10));
  } else if (tt === 'feather') { // 아래로 술 같은 털이 난 꼬리 (골든 리트리버)
    tail.add(rod(V(0, 0, 0), V(0, 0.06, -0.3), 0.04, tailC));
    shell(tailC, 0.028, 0.06, 0.15, 0, -0.02, -0.17, tail);
  } else if (tt === 'long') { // 가늘고 긴 꼬리 (닥스훈트, 비글)
    tail.add(rod(V(0, 0, 0), V(0, 0.2, -0.2), 0.032, tailC));
    tail.add(ball(0.04, L.tip ? toon(L.tip) : tailC, 0, 0.21, -0.21, 8));
  } else { tail.add(rod(V(0, 0, 0), V(0, 0.15, -0.15), 0.04, tailC)); tail.add(ball(0.05, tailC, 0, 0.16, -0.16, 8)); }
  merge(tail);
  body.add(tail);
  return { root, body, head, legs, tail, H };
}

// ---------- 열매 상점에서 데려오는 애완동물 ----------
export { PET_ITEMS, PET_IDS };
// 눌렀을 때 하는 말
export const PET_SOUND = { dog: '멍멍!', cat: '야옹~', rabbit: '깡충!', chick: '삐약삐약!', parrot: '안녕! 안녕!' };
// 먹이 주기: 동물마다 주는 것 (그릇에 담아 바닥에 놓아 준다. 열매나 수확 바구니는 쓰지 않는다)
export const PET_FOOD = {
  dog: { icon: '🦴', name: '뼈다귀 간식', color: '#F3E2C4' },
  cat: { icon: '🐟', name: '생선 간식', color: '#8EC3E6' },
  rabbit: { icon: '🥕', name: '당근', color: '#F28C28' },
  chick: { icon: '🌾', name: '모이', color: '#E8C547' },
  parrot: { icon: '🌻', name: '해바라기씨', color: '#5B4632' },
};
// 돌보기 시간 (초)
export const CARE_SEC = { hug: 3.6, feed: 5.0 };
function petBowl(kind) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.09, 16), toon(kind === 'cat' ? '#F6A2C4' : kind === 'dog' ? '#5FA9E0' : '#FFFDF7'));
  bowl.position.y = 0.045;
  g.add(bowl);
  const food = new THREE.Group();
  const col = toon(PET_FOOD[kind].color);
  if (kind === 'rabbit') {
    for (const [x, z, r] of [[-0.05, 0.02, 0.5], [0.05, -0.03, -0.4]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 8), col);
      c.rotation.set(Math.PI / 2, 0, r);
      c.position.set(x, 0.1, z);
      food.add(c);
    }
  } else {
    const n = kind === 'dog' ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(kind === 'dog' ? 0.05 : 0.035, 8, 6), col);
      m.position.set(Math.cos(a) * 0.07, 0.1, Math.sin(a) * 0.07);
      if (kind === 'dog' || kind === 'cat') m.scale.set(1.5, 0.8, 0.9);
      food.add(m);
    }
  }
  g.add(food);
  g.userData.food = food;
  return g;
}
function disposeTree(o) { o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); o.removeFromParent(); }

function makeRabbit(d) {
  const H = 0.2;
  const coat = toon(d.coat), dark = toon('#2E2A2A'), pink = toon(d.ear);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoG = new THREE.Group();
  const torso = ball(1, coat, 0, H + 0.1, -0.02, 14);
  torso.scale.set(0.17, 0.17, 0.24);
  torsoG.add(torso);
  merge(torsoG);
  body.add(torsoG);
  const head = new THREE.Group();
  head.position.set(0, H + 0.27, 0.2);
  head.add(ball(0.14, coat, 0, 0, 0, 14));
  for (const s of [-1, 1]) {
    const ear = ball(1, coat, s * 0.055, 0.2, -0.03, 10);
    ear.scale.set(0.045, 0.17, 0.035);
    ear.rotation.z = -s * 0.12;
    ear.rotation.x = -0.15;
    head.add(ear);
    const inner = ball(1, pink, s * 0.055, 0.2, -0.0, 8, false);
    inner.scale.set(0.025, 0.13, 0.012);
    inner.rotation.z = -s * 0.12;
    inner.rotation.x = -0.15;
    head.add(inner);
    head.add(ball(0.025, dark, s * 0.065, 0.03, 0.115, 8, false));
  }
  head.add(ball(0.022, pink, 0, -0.02, 0.14, 8, false));
  merge(head);
  body.add(head);
  const legGeo = new THREE.CylinderGeometry(0.04, 0.035, H, 6);
  const pawGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const legs = [];
  for (const pair of [[[-1, 1], [1, 1]], [[-1, -1], [1, -1]]]) {
    const g = new THREE.Group();
    g.position.y = H;
    for (const [sx, sz] of pair) {
      g.add(mesh(legGeo, coat, sx * 0.08, -H / 2, sz * 0.13));
      const paw = mesh(pawGeo, coat, sx * 0.08, -H + 0.04, sz * 0.13 + 0.03);
      paw.scale.set(1, 0.7, sz < 0 ? 1.6 : 1);
      g.add(paw);
    }
    merge(g);
    body.add(g);
    legs.push(g);
  }
  const tail = new THREE.Group();
  tail.position.set(0, H + 0.12, -0.26);
  tail.add(ball(0.07, coat, 0, 0, 0, 10));
  merge(tail);
  body.add(tail);
  return { root, body, head, legs, tail, H };
}

function makeChick(d) {
  const H = 0.13;
  const coat = toon(d.coat), dark = toon('#2E2A2A'), orange = toon('#F49A4C');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoG = new THREE.Group();
  const torso = ball(0.16, coat, 0, H + 0.1, 0, 14);
  torso.scale.set(1, 0.95, 1.08);
  torsoG.add(torso);
  for (const s of [-1, 1]) {
    const w = ball(1, coat, s * 0.15, H + 0.12, -0.01, 8);
    w.scale.set(0.035, 0.08, 0.1);
    w.rotation.z = s * 0.3;
    torsoG.add(w);
  }
  merge(torsoG);
  body.add(torsoG);
  const head = new THREE.Group();
  head.position.set(0, H + 0.3, 0.06);
  head.add(ball(0.11, coat, 0, 0, 0, 12));
  const beak = mesh(new THREE.ConeGeometry(0.035, 0.08, 6), orange, 0, -0.01, 0.12);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  for (const s of [-1, 1]) head.add(ball(0.02, dark, s * 0.05, 0.03, 0.085, 8, false));
  head.add(ball(0.03, coat, 0, 0.11, -0.01, 8)); // 머리 위 솜털
  merge(head);
  body.add(head);
  const legGeo = new THREE.CylinderGeometry(0.014, 0.014, H, 5);
  const footGeo = new THREE.BoxGeometry(0.06, 0.015, 0.07);
  const legs = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.y = H;
    g.add(mesh(legGeo, orange, s * 0.06, -H / 2, 0));
    g.add(mesh(footGeo, orange, s * 0.06, -H + 0.008, 0.02));
    merge(g);
    body.add(g);
    legs.push(g);
  }
  const tail = new THREE.Group();
  tail.position.set(0, H + 0.14, -0.16);
  const t = mesh(new THREE.ConeGeometry(0.04, 0.08, 6), coat, 0, 0, 0);
  t.rotation.x = -2.2;
  tail.add(t);
  merge(tail);
  body.add(tail);
  return { root, body, head, legs, tail, H };
}

// 앵무새. 처음 앵무새: 초록 몸, 노란 얼굴, 파란 날개 끝, 빨간 꼬리. 품종은 d.look (js/pets-data.js)
// 날개(wings)는 따로 움직이고, 볏(crest)이 있으면 쓰다듬거나 날 때 선다
function makeParrot(d) {
  const H = 0.1;
  const L = d.look || {};
  const breed = !!d.look;
  const coat = toon(d.coat), face = toon(d.ear), red = toon(d.tail);
  const wingC = breed ? toon(d.wing) : coat, tipC = breed ? toon(L.wingTip || d.wing) : toon(d.wing);
  const tail2 = toon(L.tail2 || (breed ? d.tail : d.wing));
  const bellyC = toon(L.belly || d.ear);
  const dark = toon('#2E2A2A'), white = toon(L.ring || '#FFFFFF'), beakC = toon(L.beak || '#F3E6C8'), grey = toon('#8D8A86');
  const jawC = toon(L.jaw || (breed ? L.beak || '#8D8A86' : '#8D8A86'));
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = (g, c, sx, sy, sz, x, y, z) => { const m = ball(1, c, x, y, z, 10); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const torsoG = new THREE.Group();
  const cw = L.chubby ? 1.12 : 1;
  const torso = ball(1, coat, 0, H + 0.17, 0, 14);
  torso.scale.set(0.12 * cw, 0.17, 0.13 * cw);
  torso.rotation.x = 0.25;
  torsoG.add(torso);
  const belly = ball(1, bellyC, 0, H + 0.13, 0.06, 12);
  belly.scale.set(0.085 * cw, 0.12, 0.08 * cw);
  belly.rotation.x = 0.25;
  torsoG.add(belly);
  if (L.rump) shell(torsoG, toon(L.rump), 0.07, 0.06, 0.05, 0, H + 0.08, -0.1); // 허리 쪽 파란 깃털
  // 꼬리: 길고 가늘게 아래 뒤로 (길면 거의 바닥과 나란히)
  const tl0 = L.tailLen || 1;
  const tEnd = (k) => V(0, Math.max(0.03, H + 0.08 - 0.12 * tl0 * k), -0.08 - 0.26 * tl0 * k);
  const tl = rod(V(0, H + 0.08, -0.08), tEnd(1), 0.035, red);
  tl.scale.set(1.5, 1, 0.45);
  torsoG.add(tl);
  const t2 = tEnd(0.8);
  torsoG.add(rod(V(0.02, H + 0.08, -0.07), breed ? V(0.03, t2.y + 0.02, t2.z) : V(0.03, H - 0.02, -0.28), 0.022, tail2));
  merge(torsoG);
  body.add(torsoG);
  const head = new THREE.Group();
  head.position.set(0, H + 0.36, 0.05);
  head.add(ball(0.1, coat, 0, 0, 0, 14));
  const cheek = ball(1, face, 0, -0.02, 0.05, 12);
  cheek.scale.set(0.085, 0.07, 0.06);
  head.add(cheek);
  // 굽은 부리: 위는 아래로 굽은 원뿔, 아래는 작은 공
  const beak = mesh(new THREE.ConeGeometry(0.035, 0.09, 8), beakC, 0, -0.02, 0.12);
  beak.rotation.x = Math.PI / 2 + 0.7;
  head.add(beak);
  head.add(ball(0.022, jawC, 0, -0.05, 0.095, 8, false));
  for (const s of [-1, 1]) {
    if (L.bare) { const b = L.bareS || 1; shell(head, toon(L.bare), 0.045 * b, 0.042 * b, 0.03, s * 0.058, 0.005 - (b - 1) * 0.03, 0.06); } // 눈 둘레 맨살 (홍금강앵무, 회색앵무)
    head.add(ball(0.03, white, s * 0.06, 0.025, 0.065, 8, false));
    head.add(ball(0.016, dark, s * 0.066, 0.027, 0.085, 8, false));
    if (L.cheek) shell(head, toon(L.cheek), 0.022, 0.022, 0.012, s * 0.068, -0.032, 0.078).rotation.y = s * 0.7; // 볼 무늬
  }
  if (L.bars) { // 사랑앵무: 뒷머리 물결무늬와 목의 점
    const bc = toon(L.bars);
    for (let i = 0; i < 3; i++) shell(head, bc, 0.07 - i * 0.008, 0.008, 0.03, 0, 0.05 - i * 0.032, -0.082 + i * 0.006);
    for (const x of [-0.035, 0, 0.035]) shell(head, bc, 0.01, 0.01, 0.008, x, -0.075, 0.075);
  }
  if (!breed) head.add(rod(V(0, 0.08, -0.01), V(0, 0.15, -0.06), 0.018, coat)); // 머리 깃
  merge(head);
  body.add(head);
  // 볏: 머리 위에서 따로 움직인다 (왕관앵무, 큰유황앵무)
  let crest = null;
  if (L.crest) {
    crest = new THREE.Group();
    crest.position.set(0, 0.07, 0.0);
    const cc = toon(L.crest), ctip = toon(L.crestTip || L.crest);
    if (L.crestType === 'fan') {
      for (const [a, x] of [[-0.55, 0], [-0.25, -0.02], [-0.25, 0.02], [0.05, -0.03], [0.05, 0.03], [0.3, 0]]) {
        const f = shell(crest, cc, 0.022, 0.085, 0.012, x, Math.cos(a) * 0.075, -Math.sin(a) * 0.075);
        f.rotation.x = -a;
      }
    } else {
      for (const x of [-0.02, 0, 0.02]) {
        crest.add(rod(V(x, 0, 0.03), V(x * 1.3, 0.13, -0.02), 0.013, cc));
        crest.add(rod(V(x * 1.3, 0.13, -0.02), V(x * 1.5, 0.19, -0.08), 0.01, ctip));
      }
    }
    merge(crest);
    crest.rotation.x = L.crestType === 'fan' ? -1.3 : -0.35;
    head.add(crest);
  }
  // 날개: 어깨에서 돌아간다
  const wings = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * 0.11 * cw, H + 0.27, -0.01);
    const w = ball(1, wingC, s * 0.02, -0.1, -0.02, 10);
    w.scale.set(0.035, 0.13, 0.09);
    g.add(w);
    if (L.wingMid) shell(g, toon(L.wingMid), 0.033, 0.06, 0.07, s * 0.024, -0.16, -0.04);
    const tip = ball(1, tipC, s * 0.025, -0.2, -0.05, 8);
    tip.scale.set(0.03, 0.07, 0.06);
    g.add(tip);
    if (L.patch) shell(g, toon(L.patch), 0.02, 0.05, 0.055, s * 0.045, -0.07, 0.0); // 왕관앵무 날개의 흰 무늬
    if (L.bars) for (const y of [-0.04, -0.08, -0.12, -0.16]) { // 사랑앵무 날개의 검은 물결무늬
      const k = Math.sqrt(Math.max(0.05, 1 - ((y + 0.1) / 0.13) ** 2));
      shell(g, toon(L.bars), 0.017, 0.006, 0.075 * k, s * 0.041, y, -0.02);
    }
    merge(g);
    body.add(g);
    wings.push(g);
  }
  const legGeo = new THREE.CylinderGeometry(0.014, 0.014, H, 5);
  const footGeo = new THREE.BoxGeometry(0.05, 0.015, 0.06);
  const legs = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.y = H;
    g.add(mesh(legGeo, grey, s * 0.045, -H / 2, 0.01));
    g.add(mesh(footGeo, grey, s * 0.045, -H + 0.008, 0.025));
    merge(g);
    body.add(g);
    legs.push(g);
  }
  return { root, body, head, legs, tail: wings[0], wings, crest, H };
}

export function makeAnyPet(d) {
  if (d.kind === 'parrot') return makeParrot(d);
  if (d.kind === 'rabbit') return makeRabbit(d);
  if (d.kind === 'chick') return makeChick(d);
  return makePet(d);
}

// 주인을 졸졸 따라다니는 애완동물 (내 것과 친구 것 모두)
export class Follower {
  constructor(v, item, ownerId) {
    this.v = v;
    this.item = item;
    this.def = PET_ITEMS[item];
    this.ownerId = ownerId;
    const p = makeAnyPet(this.def);
    Object.assign(this, p);
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.body.children[0].traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.size = (this.def.look && this.def.look.size) || 1; // 품종마다 크기가 다르다 (골든 리트리버는 크고 포메라니안은 작다)
    this.root.scale.setScalar(this.size * (this.def.kind === 'parrot' ? 1.3 : 1)); // 앵무새는 날아다니니 조금 크게
    this.root.userData.pick = { type: 'mypet', owner: ownerId, item };
    v.scene.add(this.root);
    v.pickRoots.push(this.root);
    this.walk = 0;
    this.idle = 0;
    this.hop = 0;
    this.react = 0;
    this.placed = false;
    this.setSlot(0);
    this.fly = 0; // 앵무새가 나는 정도 (0 앉음 ~ 1 날기)
    this.echoQ = null;
    this.tag = null;
  }
  dispose() {
    this.root.removeFromParent();
    const i = this.v.pickRoots.indexOf(this.root);
    if (i >= 0) this.v.pickRoots.splice(i, 1);
    if (this.bubble) this.bubble.el.remove();
    if (this.tag) this.tag.remove();
    if (this.hearts) for (const hh of this.hearts) hh.el.remove();
    if (this.care && this.care.bowl) disposeTree(this.care.bowl);
    this.care = null;
  }
  // 따라다니는 자리: 0 주인 왼쪽 뒤, 1 오른쪽 뒤, 2 가운데 조금 더 뒤 (세 마리가 겹치지 않게)
  setSlot(i) {
    this.slot = i;
    this.side = i === 1 ? 1 : -1; // 먹이 먹을 때 그릇 옆쪽
    this.back = i === 2 ? 1.75 : 1.0;
    this.lat = i === 2 ? 0 : 0.7 * this.side;
  }
  // 아이가 지어 준 이름 (머리 위 작은 이름표)
  setName(name) {
    this.name = name || '';
    if (!this.name) { if (this.tag) { this.tag.remove(); this.tag = null; } return; }
    if (!this.tag) this.tag = this.v.makeLabel('', 'kv-tag kv-pet' + (this.ownerId === 'me' ? ' home-ok' : ''));
    this.tag.textContent = this.name;
    this.tag._w = 0; // 이름표 너비를 다시 잰다 (겹침 막기)
  }
  // 앵무새는 주인이 한 말을 조금 뒤에 따라 한다
  echo(text) {
    if (this.def.kind !== 'parrot') return;
    const t = String(text || '').trim();
    if (!/[가-힣A-Za-z]/.test(t)) return;
    const chars = [...t];
    const short = chars.length > 12 ? chars.slice(0, 12).join('') + '…' : t;
    this.echoQ = { text: chars.length <= 4 ? `${short} ${short}` : short, at: 1.1 };
  }
  say(text) {
    if (this.bubble) this.bubble.el.remove();
    this.bubble = { el: this.v.makeLabel(text, 'kv-bubble pet-say' + (this.ownerId === 'me' ? ' home-ok' : '')), life: 1.8 };
  }
  // 눌렀을 때: 깡충 뛰고 하트
  pet() {
    this.react = 2.2;
    this.hop = 1;
    this.say(PET_SOUND[this.def.kind]);
    const el = this.v.makeLabel('💕', 'kv-heart' + (this.ownerId === 'me' ? ' home-ok' : ''));
    (this.hearts || (this.hearts = [])).push({ el, pos: this.root.position.clone(), life: 1.3 });
    return this.def.kind;
  }
  // ---------- 돌보기: 안아 주기(hug), 먹이 주기(feed) ----------
  // owner: 주인 root. 안아 주기는 주인 가슴 앞에 안기고, 먹이 주기는 주인 앞 바닥에 그릇을 놓으면 다가가서 먹는다
  startCare(what, owner) {
    if (!owner || !CARE_SEC[what]) return false;
    this.endCare(true);
    const k = this.def.kind, o = owner.position, yaw = owner.rotation.y;
    const c = { what, t: 0, dur: CARE_SEC[what], heartT: 0.2, said: false };
    if (what === 'feed') {
      const bowl = petBowl(k);
      const bx = o.x + Math.sin(yaw) * 0.85, bz = o.z + Math.cos(yaw) * 0.85;
      bowl.position.set(bx, 0, bz);
      bowl.visible = false; // 주인이 내려놓는 순간에 보인다
      (this.root.parent || this.v.scene).add(bowl);
      c.bowl = bowl;
      // 그릇 옆(주인이 보는 쪽에서 오른쪽)에서 그릇을 보고 먹는다. 옆모습이 보이게
      c.eatAt = { x: bx + Math.cos(yaw) * 0.42 * this.side, z: bz - Math.sin(yaw) * 0.42 * this.side };
    }
    this.care = c;
    this.react = 0;
    this.trail = [];
    return true;
  }
  // 그만 (quiet: 하트 없이). 안겨 있었으면 주인 옆에 내려온다
  endCare(quiet = false) {
    const c = this.care;
    if (!c) return;
    this.care = null;
    if (c.bowl) disposeTree(c.bowl);
    const r = this.root;
    if (c.what === 'hug') { r.position.y = 0; this.v.resolve(r.position); r.position.y = 0; } // 주인 앞에 내려온다
    this.legs[0].rotation.x = this.legs[1].rotation.x = 0;
    this.head.rotation.x = 0;
    this.body.position.y = 0;
    this.body.rotation.x = 0;
    if (!quiet) { this.hop = 1; this.react = 1.2; this.addHeart(); }
  }
  addHeart() {
    const el = this.v.makeLabel('💕', 'kv-heart' + (this.ownerId === 'me' ? ' home-ok' : ''));
    (this.hearts || (this.hearts = [])).push({ el, pos: this.root.position.clone(), life: 1.3 });
  }
  tickCare(dt, owner, wait) {
    const c = this.care, r = this.root, pos = r.position, k = this.def.kind, t = this.v.time;
    c.t += dt;
    const cb = this.v.on && this.v.on.onPetCare;
    const tell = (phase) => { if (cb) cb({ phase, what: c.what, kind: k, item: this.item, name: this.name || '', mine: this.ownerId === 'me' }); };
    if (wait && c.what === 'hug') { this.endCare(); return 0; } // 주인이 놀이를 시작하면 내려온다
    if (c.what === 'hug') {
      // 주인 가슴 앞, 주인과 같은 쪽을 본다 (화면 쪽으로 얼굴이 보이게)
      const o = owner.position, yaw = owner.rotation.y;
      pos.set(o.x + Math.sin(yaw) * 0.42, o.y + (k === 'parrot' ? 0.98 : k === 'chick' ? 0.95 : 0.82), o.z + Math.cos(yaw) * 0.42);
      r.rotation.y = yaw;
      this.body.position.y = 0;
      this.body.rotation.x = k === 'parrot' ? 0 : -0.25; // 살짝 기대어 안긴다
      this.legs[0].rotation.x = this.legs[1].rotation.x = k === 'parrot' ? 0 : 0.7; // 다리는 아래로
      this.head.rotation.x = Math.sin(t * 2.2) * 0.12;
      if (k === 'parrot') { this.fly = 0; this.wings[0].rotation.z = -0.1; this.wings[1].rotation.z = 0.1; }
      if (k === 'dog') this.tail.rotation.y = Math.sin(t * 18) * 0.6;
      else if (k === 'cat') this.tail.rotation.z = Math.sin(t * 2.5) * 0.4;
      c.heartT -= dt;
      if (c.heartT <= 0) { c.heartT = 1.1; this.addHeart(); }
      if (!c.said && c.t > 0.5) { c.said = true; tell('hug'); } // 말풍선 없이 소리만 (얼굴을 가리지 않게)
    } else {
      // 먹이: 주인이 그릇을 놓으면(0.6초) 그릇 옆으로 가서 먹는다
      if (c.t > 0.6 && c.bowl && !c.bowl.visible) c.bowl.visible = true;
      pos.y = 0;
      this.body.position.y = 0;
      if (k === 'parrot') { this.fly = 0; this.wings[0].rotation.z = -0.1; this.wings[1].rotation.z = 0.1; }
      const dx = c.eatAt.x - pos.x, dz = c.eatAt.z - pos.z, d = Math.hypot(dx, dz);
      if (c.t > 0.6 && d > 0.05) {
        const step = Math.min(d, 2.6 * dt);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        r.rotation.y = turn(r.rotation.y, Math.atan2(dx, dz), dt * 10);
        this.walk += dt * 16;
        const sw = Math.sin(this.walk) * 0.5;
        this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
      } else if (c.t > 0.6) {
        // 그릇을 보고 콕콕 (먹는 만큼 그릇이 빈다)
        const b = c.bowl.position;
        r.rotation.y = turn(r.rotation.y, Math.atan2(b.x - pos.x, b.z - pos.z), dt * 8);
        this.legs[0].rotation.x = this.legs[1].rotation.x = 0;
        this.head.rotation.x = 0.45 + Math.max(0, Math.sin(t * 11)) * 0.3;
        if (k === 'dog') this.tail.rotation.y = Math.sin(t * 16) * 0.6;
        if (!c.eatStart) { c.eatStart = c.t; tell('eat'); }
        const f = Math.min(1, (c.t - c.eatStart) / Math.max(0.5, c.dur - c.eatStart - 0.4));
        const food = c.bowl.userData.food;
        food.scale.setScalar(Math.max(0.05, 1 - f));
        if (!c.said && c.t - c.eatStart > 0.8) { c.said = true; this.say('냠냠!'); tell('bite'); }
      }
    }
    if (c.t >= c.dur) { const what = c.what; this.endCare(); if (cb) cb({ phase: 'done', what, kind: k, item: this.item, name: this.name || '', mine: this.ownerId === 'me' }); return 0; }
    return c.what === 'hug' ? 0.5 : 0; // 안겨 있으면 하트와 이름표를 주인 머리 위쪽에서 띄운다
  }

  // owner: 주인 root, wait: 주인이 놀이 중이면 그 자리에서 기다린다
  update(dt, owner, wait) {
    const v = this.v, r = this.root, pos = r.position;
    if (!owner) return;
    if (this.care) { const lift = this.tickCare(dt, owner, wait); this.tickLabels(dt, lift); return; }
    const o = owner.position;
    const yaw = owner.rotation.y;
    // 주인 뒤쪽 자리 (setSlot)
    const bx = -Math.sin(yaw) * this.back + Math.cos(yaw) * this.lat;
    const bz = -Math.cos(yaw) * this.back - Math.sin(yaw) * this.lat;
    let tx = o.x + bx, tz = o.z + bz;
    if (!this.placed || (!wait && Math.hypot(tx - pos.x, tz - pos.z) > 14)) {
      // 처음이거나 너무 멀어지면(다른 섬, 놀이기구에서 내림) 주인 곁으로 바로 온다
      pos.set(tx, 0, tz);
      v.resolve(pos);
      pos.y = 0;
      this.placed = true;
      this.trail = [];
    }
    // 주인이 걸어간 발자국을 따라간다 (나무, 다리 난간에 걸리지 않게)
    const tr = this.trail || (this.trail = []);
    const last = tr[tr.length - 1];
    if (!wait && (!last || Math.hypot(o.x - last.x, o.z - last.z) > 0.6)) { tr.push({ x: o.x, z: o.z }); if (tr.length > 40) tr.shift(); }
    let near = -1, nd = Infinity;
    tr.forEach((q, i) => { const dd = Math.hypot(q.x - pos.x, q.z - pos.z); if (dd < nd) { nd = dd; near = i; } });
    if (near > 0) tr.splice(0, near);
    while (tr.length && Math.hypot(tr[0].x - pos.x, tr[0].z - pos.z) < 0.5) tr.shift();
    const od = Math.hypot(o.x - pos.x, o.z - pos.z);
    if (od > 2.2 && tr.length) { tx = tr[0].x; tz = tr[0].z; }
    let moving = false;
    if (this.react > 0) this.react -= dt;
    const d = Math.hypot(tx - pos.x, tz - pos.z);
    if (!wait && d > 0.45 && this.react <= 0) {
      const sp = Math.min(10, Math.max(1.6, d * 2.4, (od - 1.2) * 3.4)) * (this.def.kind === 'chick' ? 0.9 : this.def.kind === 'parrot' ? 1.15 : 1);
      const step = Math.min(d, sp * dt);
      const nx = pos.x + ((tx - pos.x) / d) * step, nz = pos.z + ((tz - pos.z) / d) * step;
      if (!inPool(nx, nz)) {
        const before = pos.clone();
        pos.x = nx; pos.z = nz;
        v.resolve(pos);
        pos.y = 0;
        moving = before.distanceTo(pos) > step * 0.3;
        if (moving) r.rotation.y = turn(r.rotation.y, Math.atan2(tx - before.x, tz - before.z), dt * 10);
      }
      this.walk += dt * sp * (this.def.kind === 'chick' ? 14 : 8);
    }
    if (!moving) r.rotation.y = turn(r.rotation.y, Math.atan2(o.x - pos.x, o.z - pos.z), dt * 3);
    this.idle = moving ? 0 : this.idle + dt;
    const k = this.def.kind;
    const t = v.time;
    let lift = 0; // 앵무새가 날고 있는 높이 (말풍선, 이름표도 함께 올린다)
    if (k === 'parrot') {
      // 주인이 움직이면 날아올라 머리 위쪽을 따라오고, 멈추면 곁에 내려앉는다
      const want = moving || this.react > 0 || this.idle < 1.2 ? 1 : 0;
      this.fly += (want - this.fly) * Math.min(1, dt * (want ? 3 : 1.6));
      lift = this.fly * (1.4 + Math.sin(t * 3.1) * 0.06);
      const flap = this.fly > 0.05 ? Math.sin(t * 24) * 0.9 * Math.min(1, this.fly * 2) : 0;
      this.wings[0].rotation.z = -0.1 - flap;
      this.wings[1].rotation.z = 0.1 + flap;
      this.body.rotation.x = this.fly * 0.35;
      const hopW = !moving && this.fly < 0.1 ? Math.abs(Math.sin(t * 1.7)) > 0.97 : false;
      this.legs[0].rotation.x = this.legs[1].rotation.x = this.fly * -0.6;
      let y = lift + (hopW ? 0.04 : 0);
      if (this.hop > 0) { this.hop = Math.max(0, this.hop - dt * 2.4); y += Math.sin((1 - this.hop) * Math.PI) * 0.3; }
      this.body.position.y = y;
      lift *= this.root.scale.y; // 말풍선·이름표는 세상 높이로
      this.head.rotation.y = !moving && this.fly < 0.2 ? Math.sin(t * 0.9) * 0.5 : 0;
      this.head.rotation.x = 0;
      if (this.crest) { // 볏은 쓰다듬거나 날아오르면 서고, 쉴 때는 눕는다
        const fan = this.def.look.crestType === 'fan';
        const up = this.react > 0 || this.fly > 0.6 || (this.echoQ && this.echoQ.at < 0.6);
        const want = up ? (fan ? 0.05 : 0.15) : (fan ? -1.3 : -0.35);
        this.crest.rotation.x += (want - this.crest.rotation.x) * Math.min(1, dt * 7);
      }
    } else {
      const sw = moving ? Math.sin(this.walk) * (k === 'rabbit' ? 0.25 : 0.55) : 0;
      this.legs[0].rotation.x = sw;
      this.legs[1].rotation.x = -sw;
      let y = 0;
      if (moving) y = k === 'rabbit' ? Math.abs(Math.sin(this.walk * 0.5)) * 0.16 : Math.abs(Math.sin(this.walk)) * 0.03;
      if (this.hop > 0) { this.hop = Math.max(0, this.hop - dt * 2.4); y += Math.sin((1 - this.hop) * Math.PI) * 0.3; }
      const sit = !moving && this.idle > 1.5 && (k === 'dog' || k === 'cat');
      this.body.rotation.x += ((sit ? -0.32 : 0) - this.body.rotation.x) * Math.min(1, dt * 6);
      this.body.rotation.z = k === 'chick' && moving ? Math.sin(this.walk) * 0.12 : 0;
      this.body.position.y = y - (sit ? 0.09 : 0);
      if (k === 'dog') this.tail.rotation.y = Math.sin(t * (this.react > 0 || d < 1.6 ? 18 : 7)) * 0.6;
      else if (k === 'cat') this.tail.rotation.z = Math.sin(t * 1.8) * 0.35;
      // 병아리는 가끔 땅을 콕콕
      this.head.rotation.x = k === 'chick' && !moving && Math.sin(t * 1.3) > 0.85 ? 0.5 : (k === 'dog' && sit ? 0.15 : 0);
    }
    this.tickLabels(dt, lift);
  }
  // 따라 하는 말, 말풍선, 이름표, 하트
  tickLabels(dt, lift) {
    const v = this.v, pos = this.root.position, k = this.def.kind;
    if (this.echoQ) {
      this.echoQ.at -= dt;
      if (this.echoQ.at <= 0) { this.say(this.echoQ.text); this.echoQ = null; this.hop = Math.max(this.hop, 0.6); }
    }
    if (this.bubble) {
      this.bubble.life -= dt;
      if (this.bubble.life <= 0) { this.bubble.el.remove(); this.bubble = null; }
      else { this.bubble.el.style.opacity = String(Math.min(1, this.bubble.life / 0.4)); v.placeLabel(this.bubble.el, pos, 1.0 * (this.size || 1) + lift); }
    }
    if (this.tag) {
      // 이름표 (말풍선이 떠 있을 때와 1인칭으로 볼 때는 감춘다)
      const show = this.root.visible && !this.bubble && !v.fp && !(this.care && this.care.what === 'hug');
      if (show) v.placeLabel(this.tag, pos, (k === 'parrot' ? 0.8 : k === 'chick' ? 0.62 : k === 'rabbit' ? 0.82 : 0.95) * (this.size || 1) + lift);
      else this.tag.style.display = 'none';
    }
    if (this.hearts) {
      this.hearts = this.hearts.filter((hh) => {
        hh.life -= dt;
        if (hh.life <= 0) { hh.el.remove(); return false; }
        hh.el.style.opacity = String(Math.min(1, hh.life / 0.5));
        v.placeLabel(hh.el, pos, 0.8 + lift + (1.3 - hh.life) * 0.9);
        return true;
      });
    }
  }
}

// ---------- 새 ----------
const FLOCKS = [
  { cx: 0, cz: 2, r: 15, y: 10.5, w: 0.13, col: '#7EC8F2', n: 4, ph: 0 },
  { cx: -4, cz: -6, r: 21, y: 13, w: -0.1, col: '#FFFDF7', n: 4, ph: 2 },
  { cx: 3, cz: 16, r: 12, y: 8.8, w: 0.16, col: '#F6D55C', n: 4, ph: 4 },
];

export class Critters {
  constructor(v) {
    this.v = v;
    this.pets = [];
    this.buildPets();
    this.buildBirds();
  }

  buildPets() {
    PETS.forEach((d, i) => {
      const p = makePet(d);
      p.def = d;
      p.route = new Route(d.route);
      p.delay = 0; // 쓰다듬는 동안 멈춘 시간
      p.react = 0;
      p.walk = 0;
      p.near = false;
      p.saidAt = -99;
      p.hop = 0;
      // 그림자는 몸통만 (그리기 횟수 줄이기)
      p.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      p.body.children[0].traverse((o) => { if (o.isMesh) o.castShadow = true; });
      p.root.userData.pick = { type: 'pet', i };
      this.v.scene.add(p.root);
      this.v.pickRoots.push(p.root);
      this.pets.push(p);
    });
  }

  buildBirds() {
    const n = FLOCKS.reduce((a, f) => a + f.n, 0);
    const m4 = new THREE.Matrix4();
    const bodyGeo = mergeGeos([
      { geo: new THREE.SphereGeometry(1, 12, 8), m: m4.clone().makeScale(0.11, 0.1, 0.22) },
      { geo: new THREE.SphereGeometry(0.085, 10, 8), m: m4.clone().makeTranslation(0, 0.07, 0.17) },
      { geo: new THREE.ConeGeometry(0.07, 0.18, 6), m: new THREE.Matrix4().makeTranslation(0, 0.02, -0.26).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)) },
    ]);
    const beakGeo = new THREE.ConeGeometry(0.028, 0.09, 6);
    beakGeo.rotateX(Math.PI / 2);
    beakGeo.translate(0, 0.06, 0.29);
    const wingGeo = new THREE.SphereGeometry(1, 10, 6);
    wingGeo.scale(0.2, 0.02, 0.09);
    wingGeo.translate(0.2, 0, 0);
    const white = new THREE.MeshToonMaterial({ color: '#FFFFFF', gradientMap: toonGradient() });
    const wingMat = new THREE.MeshToonMaterial({ color: '#FFFFFF', gradientMap: toonGradient(), side: THREE.DoubleSide });
    this.birdBody = new THREE.InstancedMesh(bodyGeo, white, n);
    this.birdBeak = new THREE.InstancedMesh(beakGeo, toon('#F49A4C'), n);
    this.birdWing = new THREE.InstancedMesh(wingGeo, wingMat, n * 2);
    const col = new THREE.Color();
    let k = 0;
    this.birds = [];
    FLOCKS.forEach((f, fi) => {
      for (let j = 0; j < f.n; j++) {
        col.set(f.col);
        this.birdBody.setColorAt(k, col);
        this.birdWing.setColorAt(k * 2, col);
        this.birdWing.setColorAt(k * 2 + 1, col);
        this.birds.push({ f: fi, j, k });
        k++;
      }
    });
    for (const im of [this.birdBody, this.birdBeak, this.birdWing]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.v.scene.add(im);
    }
    this.birdBody.castShadow = true;
    this.birdWing.castShadow = false;
    this.tmp = { m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), p: V(), s: V(1, 1, 1), mirror: new THREE.Matrix4().makeScale(-1, 1, 1), rz: new THREE.Matrix4(), out: new THREE.Matrix4() };
    this.chirpAt = 8 + Math.random() * 10;
  }

  // 누른 동물: 잠깐 멈춰서 나를 보고, 하트와 소리
  pet(i) {
    const p = this.pets[i];
    if (!p) return null;
    p.react = 3;
    p.hop = 1;
    this.bubble(p, p.def.kind === 'cat' ? '야옹~' : '멍멍!');
    this.heart(p);
    return { kind: p.def.kind, name: p.def.name, pos: p.root.position.clone() };
  }
  bubble(p, text) {
    if (p.bubble) p.bubble.el.remove();
    const el = this.v.makeLabel(text, 'kv-bubble pet-say');
    p.bubble = { el, life: 1.8 };
  }
  heart(p) {
    const el = this.v.makeLabel('💕', 'kv-heart' + (this.ownerId === 'me' ? ' home-ok' : ''));
    (this.hearts || (this.hearts = [])).push({ el, pos: p.root.position.clone(), life: 1.3 });
  }

  update(T, dt) {
    const v = this.v;
    const pl = v.player && (v.mode === 'play' || v.mode === 'game') ? v.player.root.position : null;
    const at = { x: 0, z: 0, h: 0 };
    for (const p of this.pets) {
      if (p.react > 0) { p.react -= dt; p.delay += dt; }
      const Tl = T + p.def.ph - p.delay;
      const cyc = Math.floor(Tl / CYCLE), c = Tl - cyc * CYCLE;
      const walking = c < WALK && p.react <= 0;
      const d = p.def.speed * (cyc * WALK + Math.min(c, WALK));
      p.route.at(d, at);
      const r = p.root;
      r.position.x = at.x; r.position.z = at.z;
      let want = at.h;
      const near = pl && Math.hypot(pl.x - at.x, pl.z - at.z) < 3.2;
      if ((p.react > 0 || (!walking && near)) && pl) want = Math.atan2(pl.x - at.x, pl.z - at.z);
      r.rotation.y = turn(r.rotation.y, want, dt * (walking ? 10 : 4));
      // 가까이 가면 한 번 인사
      if (near && !p.near && v.time - p.saidAt > 25) { p.saidAt = v.time; this.bubble(p, p.def.kind === 'cat' ? '야옹' : '멍!'); if (this.onSound) this.onSound(p.def.kind, true); }
      p.near = !!near;
      // 걷기와 앉기
      if (walking) p.walk += dt * p.def.speed * 9;
      const sw = walking ? Math.sin(p.walk) * 0.55 : 0;
      p.legs[0].rotation.x = sw;
      p.legs[1].rotation.x = -sw;
      const sit = !walking && p.react <= 0 && p.def.kind === 'cat';
      p.body.rotation.x += ((sit ? -0.32 : 0) - p.body.rotation.x) * Math.min(1, dt * 6);
      let y = walking ? Math.abs(Math.sin(p.walk)) * 0.03 : 0;
      if (p.hop > 0) { p.hop = Math.max(0, p.hop - dt * 2.4); y += Math.sin((1 - p.hop) * Math.PI) * 0.3; }
      p.body.position.y = y - (sit ? 0.09 : 0); // 앉으면 엉덩이를 낮춘다
      // 꼬리: 강아지는 반가우면 빨리 흔든다
      const happy = p.react > 0 || near;
      if (p.def.kind === 'dog') p.tail.rotation.y = Math.sin(v.time * (happy ? 20 : 7)) * (happy ? 0.7 : 0.35);
      else p.tail.rotation.z = Math.sin(v.time * 1.8 + p.def.ph) * 0.35;
      p.head.rotation.x = walking ? Math.sin(p.walk * 2) * 0.04 : (p.def.kind === 'dog' && !happy ? 0.25 : 0);
      if (p.bubble) {
        p.bubble.life -= dt;
        if (p.bubble.life <= 0) { p.bubble.el.remove(); p.bubble = null; }
        else { p.bubble.el.style.opacity = String(Math.min(1, p.bubble.life / 0.4)); v.placeLabel(p.bubble.el, r.position, 1.25); }
      }
    }
    if (this.hearts) {
      this.hearts = this.hearts.filter((hh) => {
        hh.life -= dt;
        if (hh.life <= 0) { hh.el.remove(); return false; }
        hh.el.style.opacity = String(Math.min(1, hh.life / 0.5));
        v.placeLabel(hh.el, hh.pos, 0.9 + (1.3 - hh.life) * 0.9);
        return true;
      });
    }
    this.updateBirds(T, pl, dt);
  }

  updateBirds(T, pl, dt) {
    const { m, w, q, e, p, s, mirror, rz, out } = this.tmp;
    let near = false;
    for (const b of this.birds) {
      const f = FLOCKS[b.f];
      const a = f.ph + f.w * T;
      const dir = Math.sign(f.w);
      const cx = f.cx + Math.cos(a) * f.r, cz = f.cz + Math.sin(a) * f.r;
      const hx = -Math.sin(a) * dir, hz = Math.cos(a) * dir;
      const h = Math.atan2(hx, hz);
      const rank = Math.ceil(b.j / 2), side = b.j === 0 ? 0 : (b.j % 2 ? 1 : -1);
      // 옆으로 벌어지고 뒤로 처지는 V자 모양
      const ox = side * rank * 0.75, oz = -rank * 0.8;
      const c = Math.cos(h), sn = Math.sin(h);
      p.set(cx + ox * c + oz * sn, f.y + Math.sin(T * 0.35 + b.f) * 0.8 + Math.sin(T * 1.7 + b.j) * 0.15, cz - ox * sn + oz * c);
      if (pl && Math.hypot(p.x - pl.x, p.z - pl.z) < 10) near = true;
      e.set(0, h, -dir * 0.3);
      q.setFromEuler(e);
      m.compose(p, q, s);
      this.birdBody.setMatrixAt(b.k, m);
      this.birdBeak.setMatrixAt(b.k, m);
      const glide = Math.sin(T * 0.6 + b.j * 1.3 + b.f) > 0.35;
      const ang = glide ? 0.12 + Math.sin(T * 3 + b.j) * 0.05 : Math.sin(T * 12 + b.j * 1.1) * 0.75;
      w.makeTranslation(0.07, 0.05, 0).multiply(rz.makeRotationZ(ang));
      this.birdWing.setMatrixAt(b.k * 2, out.multiplyMatrices(m, w));
      w.makeTranslation(-0.07, 0.05, 0).multiply(rz.makeRotationZ(-ang)).multiply(mirror);
      this.birdWing.setMatrixAt(b.k * 2 + 1, out.multiplyMatrices(m, w));
    }
    this.birdBody.instanceMatrix.needsUpdate = true;
    this.birdBeak.instanceMatrix.needsUpdate = true;
    this.birdWing.instanceMatrix.needsUpdate = true;
    // 가끔 짹짹
    this.chirpAt -= dt;
    if (near && this.chirpAt <= 0 && this.onSound) { this.chirpAt = 25 + Math.random() * 20; this.onSound('bird', true); }
  }
}
