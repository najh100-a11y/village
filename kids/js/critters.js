// 진숲 어린이 마을 — 마을 동물들: 하늘을 나는 새, 길을 걷는 강아지와 고양이
// 동물도 기기 시각으로 움직여서 친구 화면에서도 거의 같은 자리를 걷는다. 누르면 쓰다듬을 수 있다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeGeos, mergeColored } from './merge.js';

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
    const el = this.v.makeLabel('💕', 'kv-heart');
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
