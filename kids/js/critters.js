// 진숲 어린이 마을 — 마을 동물들: 하늘을 나는 새, 길을 걷는 강아지와 고양이
// 동물도 기기 시각으로 움직여서 친구 화면에서도 거의 같은 자리를 걷는다. 누르면 쓰다듬을 수 있다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeGeos, mergeColored } from './merge.js';
import { inPool } from './pool.js';

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

function makePet(d) {
  const cat = d.kind === 'cat';
  const H = cat ? 0.32 : 0.38; // 엉덩이 높이
  const coat = toon(d.coat), dark = toon('#2E2A2A'), cream = toon('#FFF3DA');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoG = new THREE.Group();
  const torso = ball(1, coat, 0, H + 0.08, 0, 14);
  torso.scale.set(cat ? 0.17 : 0.2, cat ? 0.16 : 0.19, cat ? 0.34 : 0.36);
  torsoG.add(torso);
  if (d.collar) {
    const c = mesh(new THREE.TorusGeometry(0.12, 0.024, 6, 18), toon(d.collar), 0, H + 0.2, 0.27);
    c.rotation.x = Math.PI / 2 + 0.5;
    torsoG.add(c);
  }
  merge(torsoG);
  body.add(torsoG);
  // 머리
  const head = new THREE.Group();
  head.position.set(0, H + 0.3, cat ? 0.31 : 0.35);
  head.add(ball(cat ? 0.17 : 0.19, coat, 0, 0, 0, 14));
  for (const s of [-1, 1]) {
    if (cat) {
      const e = mesh(new THREE.ConeGeometry(0.07, 0.15, 4), coat, s * 0.1, 0.17, -0.01);
      e.rotation.z = -s * 0.25;
      head.add(e);
    } else {
      const e = ball(1, toon(d.ear), s * 0.17, 0.0, -0.02, 10);
      e.scale.set(0.06, 0.13, 0.045);
      e.rotation.z = s * 0.35;
      head.add(e);
    }
    head.add(ball(0.03, dark, s * 0.075, 0.05, cat ? 0.145 : 0.16, 8, false));
  }
  const snout = ball(1, cream, 0, -0.05, cat ? 0.13 : 0.16, 10);
  snout.scale.set(cat ? 0.075 : 0.095, cat ? 0.055 : 0.075, cat ? 0.06 : 0.11);
  head.add(snout);
  head.add(ball(0.032, dark, 0, -0.02, cat ? 0.19 : 0.265, 8, false));
  merge(head);
  body.add(head);
  // 다리: 대각선 두 짝씩 함께 움직인다 (앞왼+뒤오, 앞오+뒤왼)
  const legGeo = new THREE.CylinderGeometry(0.045, 0.04, H, 6);
  const pawGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const legs = [];
  for (const pair of [[[-1, 1], [1, -1]], [[1, 1], [-1, -1]]]) {
    const g = new THREE.Group();
    g.position.y = H;
    for (const [sx, sz] of pair) {
      g.add(mesh(legGeo, coat, sx * 0.1, -H / 2, sz * 0.2));
      g.add(mesh(pawGeo, coat, sx * 0.1, -H + 0.04, sz * 0.2 + 0.02));
    }
    merge(g);
    body.add(g);
    legs.push(g);
  }
  // 꼬리
  const tail = new THREE.Group();
  tail.position.set(0, H + 0.12, -0.33);
  if (cat) { tail.add(rod(V(0, 0, 0), V(0, 0.32, -0.1), 0.03, coat)); tail.add(ball(0.04, coat, 0, 0.33, -0.1, 8)); }
  else { tail.add(rod(V(0, 0, 0), V(0, 0.15, -0.15), 0.04, coat)); tail.add(ball(0.05, coat, 0, 0.16, -0.16, 8)); }
  merge(tail);
  body.add(tail);
  return { root, body, head, legs, tail, H };
}

// ---------- 열매 상점에서 데려오는 애완동물 ----------
export const PET_ITEMS = {
  pet_dog: { kind: 'dog', name: '강아지', desc: '꼬리를 흔들며 졸졸 따라와요.', coat: '#C98B4E', ear: '#8A5A33', collar: '#5FA9E0', price: 30 },
  pet_cat: { kind: 'cat', name: '고양이', desc: '살금살금 곁을 지켜 줘요.', coat: '#F2E2C4', ear: '#D9B98A', collar: '#EF6461', price: 30 },
  pet_rabbit: { kind: 'rabbit', name: '토끼', desc: '깡충깡충 뛰어서 따라와요.', coat: '#FFFFFF', ear: '#F6B8C8', price: 30 },
  pet_chick: { kind: 'chick', name: '병아리', desc: '삐약삐약 종종걸음으로 따라와요.', coat: '#FFD84D', price: 30 },
  pet_parrot: { kind: 'parrot', name: '앵무새', desc: '머리 위를 훨훨 날아 따라오고, 내가 한 말을 따라 해요.', coat: '#3DBB5C', ear: '#F6D55C', wing: '#3E8FE0', tail: '#E5484D', price: 30 },
};
// 눌렀을 때 하는 말
export const PET_SOUND = { dog: '멍멍!', cat: '야옹~', rabbit: '깡충!', chick: '삐약삐약!', parrot: '안녕! 안녕!' };
export const PET_IDS = Object.keys(PET_ITEMS);

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

// 앵무새: 초록 몸, 노란 얼굴, 파란 날개 끝, 빨간 꼬리. 날개(wings)는 따로 움직인다
function makeParrot(d) {
  const H = 0.1;
  const coat = toon(d.coat), face = toon(d.ear), blue = toon(d.wing), red = toon(d.tail);
  const dark = toon('#2E2A2A'), white = toon('#FFFFFF'), beakC = toon('#F3E6C8'), grey = toon('#8D8A86');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoG = new THREE.Group();
  const torso = ball(1, coat, 0, H + 0.17, 0, 14);
  torso.scale.set(0.12, 0.17, 0.13);
  torso.rotation.x = 0.25;
  torsoG.add(torso);
  const belly = ball(1, face, 0, H + 0.13, 0.06, 12);
  belly.scale.set(0.085, 0.12, 0.08);
  belly.rotation.x = 0.25;
  torsoG.add(belly);
  // 꼬리: 길고 가늘게 아래 뒤로
  const tl = rod(V(0, H + 0.08, -0.08), V(0, H - 0.04, -0.34), 0.035, red);
  tl.scale.set(1.5, 1, 0.45);
  torsoG.add(tl);
  torsoG.add(rod(V(0.02, H + 0.08, -0.07), V(0.03, H - 0.02, -0.28), 0.022, blue));
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
  head.add(ball(0.022, grey, 0, -0.05, 0.095, 8, false));
  for (const s of [-1, 1]) {
    head.add(ball(0.03, white, s * 0.06, 0.025, 0.065, 8, false));
    head.add(ball(0.016, dark, s * 0.066, 0.027, 0.085, 8, false));
  }
  head.add(rod(V(0, 0.08, -0.01), V(0, 0.15, -0.06), 0.018, coat)); // 머리 깃
  merge(head);
  body.add(head);
  // 날개: 어깨에서 돌아간다
  const wings = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * 0.11, H + 0.27, -0.01);
    const w = ball(1, coat, s * 0.02, -0.1, -0.02, 10);
    w.scale.set(0.035, 0.13, 0.09);
    g.add(w);
    const tip = ball(1, blue, s * 0.025, -0.2, -0.05, 8);
    tip.scale.set(0.03, 0.07, 0.06);
    g.add(tip);
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
  return { root, body, head, legs, tail: wings[0], wings, H };
}

function makeAnyPet(d) {
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
    if (this.def.kind === 'parrot') this.root.scale.setScalar(1.3); // 날아다니니 조금 크게
    this.root.userData.pick = { type: 'mypet', owner: ownerId };
    v.scene.add(this.root);
    v.pickRoots.push(this.root);
    this.walk = 0;
    this.idle = 0;
    this.hop = 0;
    this.react = 0;
    this.placed = false;
    this.side = Math.random() < 0.5 ? -1 : 1;
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
  }
  // 아이가 지어 준 이름 (머리 위 작은 이름표)
  setName(name) {
    this.name = name || '';
    if (!this.name) { if (this.tag) { this.tag.remove(); this.tag = null; } return; }
    if (!this.tag) this.tag = this.v.makeLabel('', 'kv-tag kv-pet' + (this.ownerId === 'me' ? ' home-ok' : ''));
    this.tag.textContent = this.name;
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
  // owner: 주인 root, wait: 주인이 놀이 중이면 그 자리에서 기다린다
  update(dt, owner, wait) {
    const v = this.v, r = this.root, pos = r.position;
    if (!owner) return;
    const o = owner.position;
    const yaw = owner.rotation.y;
    // 주인 뒤쪽 옆자리
    const bx = -Math.sin(yaw) * 1.0 + Math.cos(yaw) * 0.7 * this.side;
    const bz = -Math.cos(yaw) * 1.0 - Math.sin(yaw) * 0.7 * this.side;
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
    if (this.echoQ) {
      this.echoQ.at -= dt;
      if (this.echoQ.at <= 0) { this.say(this.echoQ.text); this.echoQ = null; this.hop = Math.max(this.hop, 0.6); }
    }
    if (this.bubble) {
      this.bubble.life -= dt;
      if (this.bubble.life <= 0) { this.bubble.el.remove(); this.bubble = null; }
      else { this.bubble.el.style.opacity = String(Math.min(1, this.bubble.life / 0.4)); v.placeLabel(this.bubble.el, pos, 1.0 + lift); }
    }
    if (this.tag) {
      // 이름표 (말풍선이 떠 있을 때와 1인칭으로 볼 때는 감춘다)
      const show = this.root.visible && !this.bubble && !v.fp;
      if (show) v.placeLabel(this.tag, pos, (k === 'parrot' ? 0.8 : k === 'chick' ? 0.62 : k === 'rabbit' ? 0.82 : 0.95) + lift);
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
