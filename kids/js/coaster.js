// 진숲 어린이 마을 — 놀이동산 롤러코스터: 섬 둘레 바다 위를 한 바퀴 돌고, 남쪽에서 360도 한 바퀴(루프)를 돈다
// 기차는 모든 기기가 같은 시계로 움직인다. 승강장에서 9초 쉬었다가, 체인으로 꼭대기까지 올라간 뒤
// 높이에 따른 속도로 달린다(내려갈수록 빨라지고, 조금씩 느려진다). 그래서 친구 화면에서도 같은 때 같은 곳에 있다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeGeos, mergeColored, mergeStatic } from './merge.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UPW = V(0, 1, 0);
export const COASTER = {
  center: { x: 0, z: 62.5 },
  station: { x: -18.3, z: 63.3 }, // 승강장 가운데
  door: [-17.25, 63.3], // 타는 곳 (섬 안쪽)
  stopAt: V(-19.5, 0.75, 65.0), // 맨 앞 차가 서는 곳
  loop: { x: 2.0, z: 86.5, y: 1.4, R: 3.6, off: 1.8 }, // 360도 루프 (안쪽으로 1.8 비켜서 나온다)
  cars: 3, gap: 1.75, dwell: 9, lift: 2.5, g: 6.5, drag: 0.55, brake: 22,
};
const SEAT_X = 0.4;

// 루프를 뺀 선로가 지나가는 점 (루프 출구 → 동쪽 → 북쪽(다리 위) → 서쪽 승강장 → 오르막 → 내리막 → 루프 입구)
const PTS = [
  [2.0, 1.4, 84.7], [4.5, 1.6, 84.7], [7.6, 4.2, 83.8], [9.6, 6.0, 82.7], [11.0, 6.4, 81.6], [12.4, 6.0, 80.4], [14.4, 4.4, 78.4], [17.5, 2.6, 74.5],
  [20.5, 3.2, 69.0], [22.6, 5.2, 62.5], [21.5, 6.2, 54.5], [18.0, 6.8, 47.0], [11.5, 6.6, 41.6], [3.5, 6.2, 39.6],
  [-4.5, 6.0, 39.8], [-11.5, 5.4, 42.2], [-17.5, 4.2, 47.0], [-20.4, 2.6, 52.0], [-19.8, 1.4, 55.0],
  [-19.5, 0.75, 57.5], [-19.5, 0.75, 61.0], [-19.5, 0.75, 64.5], [-19.5, 0.75, 67.5],
  [-20.6, 2.6, 72.0], [-19.8, 6.5, 76.2], [-16.5, 10.5, 80.6], [-12.0, 13.5, 83.6], [-8.5, 13.6, 85.0],
  [-5.5, 9.0, 86.0], [-3.0, 3.0, 86.5], [-0.5, 1.4, 86.5], [2.0, 1.4, 86.5],
];

// 선로: 촘촘한 점(위치 p, 앞 t, 위 u, 옆 x)과 처음부터의 거리 s
export function buildTrack() {
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, y, z]) => V(x, y, z)), false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 0.2);
  const spl = curve.getSpacedPoints(n);
  spl.pop(); // 마지막 점은 루프 첫 점과 같다
  const L = COASTER.loop;
  const m = Math.ceil((TAU * L.R) / 0.2);
  const pts = spl.map((p) => ({ p, loop: false }));
  const loopStart = pts.length;
  for (let k = 0; k < m; k++) {
    const th = (k / m) * TAU;
    pts.push({ p: V(L.x + L.R * Math.sin(th), L.y + L.R * (1 - Math.cos(th)), L.z - L.off * (th - Math.sin(th)) / TAU), loop: true, th });
  }
  const N = pts.length;
  const s = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) s[i] = s[i - 1] + pts[i - 1].p.distanceTo(pts[i % N].p);
  // 앞쪽
  for (let i = 0; i < N; i++) pts[i].t = V().subVectors(pts[(i + 1) % N].p, pts[(i - 1 + N) % N].p).normalize();
  // 굽은 곳은 안쪽으로 조금 기울인다 (루프는 고리 가운데가 위)
  const bank = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (pts[i].loop) continue;
    const a = pts[(i - 3 + N) % N].t, b = pts[(i + 3) % N].t;
    let d = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    bank[i] = Math.max(-0.5, Math.min(0.5, (d / 1.2) * 8)); // 점 사이는 0.2m, 앞뒤 세 점씩이면 1.2m
  }
  const sm = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (pts[i].loop) continue;
    let sum = 0, c = 0;
    for (let k = -12; k <= 12; k++) { const j = (i + k + N) % N; if (!pts[j].loop) { sum += bank[j]; c++; } }
    const nearLoop = Math.min(i + 1, loopStart - i); // 루프 앞뒤에서는 기울기를 0으로 (루프와 이어지게)
    sm[i] = (sum / c) * Math.min(1, nearLoop / 25);
  }
  for (let i = 0; i < N; i++) {
    const q = pts[i];
    if (q.loop) q.u = V(-Math.sin(q.th), Math.cos(q.th), 0);
    else {
      const side = V().crossVectors(UPW, q.t).normalize();
      const up = V().crossVectors(q.t, side).normalize();
      q.u = up.addScaledVector(side, Math.tan(sm[i])).normalize();
    }
    q.x = V().crossVectors(q.u, q.t).normalize();
    q.u.crossVectors(q.t, q.x).normalize();
  }
  // 승강장 멈춤 자리와 꼭대기
  let st = 0, bd = Infinity;
  for (let i = 0; i < loopStart; i++) { const d = pts[i].p.distanceTo(COASTER.stopAt); if (d < bd) { bd = d; st = i; } }
  return { pts, s, N, L: s[N], loopStart, station: s[st], stationI: st };
}
const TAU = Math.PI * 2;

// 한 바퀴 시간표: 승강장을 떠난 뒤 거리마다 걸린 시간
export function buildTimeline(track) {
  const { pts, s, N, L, stationI } = track;
  const C = COASTER;
  // 승강장에서 한 바퀴 돌며 차례로 보는 점
  const order = [];
  for (let k = 0; k <= N; k++) order.push((stationI + k) % N);
  const dist = (k) => { let d = s[order[k]] - s[stationI]; if (d < 0 || (k === N && d === 0)) d += L; return d; };
  // 꼭대기: 승강장을 떠난 뒤 가장 높은 곳
  let top = 0, topY = -1;
  for (let k = 0; k < N; k++) { const y = pts[order[k]].p.y; if (y > topY) { topY = y; top = k; } }
  const ds = new Float64Array(N + 1), vs = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) ds[k] = dist(k);
  const E = C.lift * C.lift + 2 * C.g * topY;
  for (let k = 0; k <= N; k++) {
    const y = pts[order[k] % N].p.y;
    let v;
    if (k <= top) v = Math.min(C.lift, 0.9 + ds[k] * 0.9);
    else v = Math.sqrt(Math.max(4, E - 2 * C.g * y - C.drag * (ds[k] - ds[top])));
    const left = L - ds[k];
    if (left < C.brake) v = Math.min(v, 1.0 + (left / C.brake) * 4);
    if (left < 2.5) v = Math.min(v, 0.45 + left * 0.35);
    vs[k] = v;
  }
  const ts = new Float64Array(N + 1);
  for (let k = 1; k <= N; k++) ts[k] = ts[k - 1] + (ds[k] - ds[k - 1]) / ((vs[k] + vs[k - 1]) / 2);
  return { ds, vs, ts, run: ts[N], top: ds[top], topY, period: C.dwell + ts[N] };
}

// ---------- 모형 ----------
function mk(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });

function makeCar(color, front, glow) {
  const g = new THREE.Group();
  const add = (w, h, d, c, x, y, z) => { const o = mk(new THREE.BoxGeometry(w, h, d), toon(c), x, y, z); g.add(o); return o; };
  add(1.45, 0.42, 1.5, color, 0, 0.36, 0);
  add(1.5, 0.08, 1.56, '#FFFDF7', 0, 0.58, 0);
  for (const x of [-SEAT_X, SEAT_X]) {
    add(0.62, 0.1, 0.55, '#3E4A63', x, 0.42, -0.1); // 의자
    add(0.62, 0.62, 0.12, color, x, 0.78, -0.48); // 등받이
    add(0.62, 0.06, 0.06, '#F6D55C', x, 0.92, 0.28); // 안전바
  }
  for (const s of [-1, 1]) for (const z of [-0.5, 0.5]) {
    const w = mk(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), toon('#4A4A55'), s * 0.62, 0.11, z);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  if (front) {
    const nose = mk(new THREE.CylinderGeometry(0.0, 0.62, 0.7, 4, 1), toon(color), 0, 0.42, 1.02);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.scale.set(1.15, 1, 0.6);
    g.add(nose);
    for (const x of [-0.42, 0.42]) g.add(mk(new THREE.SphereGeometry(0.09, 10, 8), glow, x, 0.5, 0.78));
    add(0.2, 0.2, 0.06, '#FFFDF7', 0, 0.62, 0.75);
  }
  mergeColored(g, VC);
  mergeStatic(g);
  return g;
}

export class Coaster {
  constructor(v, park) {
    this.v = v;
    this.park = park;
    this.track = buildTrack();
    this.time = buildTimeline(this.track);
    this.seats = [];
    this.cars = [];
    this.root = new THREE.Group();
    this.buildTrackMesh();
    this.buildStation();
    this.buildTrain();
    v.scene.add(this.root);
    this.st = this.state(park.now());
  }

  // 선로 위 거리 s의 자리와 방향 (점 사이를 고르게)
  frameAt(s, out) {
    const { pts, s: S, N, L } = this.track;
    s = ((s % L) + L) % L;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[(lo + 1) % N];
    const k = (s - S[lo]) / Math.max(1e-6, S[lo + 1] - S[lo]);
    out.p.lerpVectors(a.p, b.p, k);
    out.t.lerpVectors(a.t, b.t, k).normalize();
    out.u.lerpVectors(a.u, b.u, k).normalize();
    out.x.crossVectors(out.u, out.t).normalize();
    out.u.crossVectors(out.t, out.x).normalize();
    out.loop = a.loop && b.loop;
    return out;
  }

  // 지금 기차 상태 (T: 마을 시계 초)
  state(T) {
    const tl = this.time, C = COASTER;
    const lap = Math.floor(T / tl.period);
    const c = T - lap * tl.period;
    if (c < C.dwell) return { phase: 'dwell', lap, dwellLeft: C.dwell - c, untilDwell: 0, s: this.track.station, d: 0, v: 0, fast: false, loop: false };
    const rt = c - C.dwell;
    const { ts, ds, vs } = tl;
    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[mid] <= rt) lo = mid; else hi = mid; }
    const k = (rt - ts[lo]) / Math.max(1e-6, ts[lo + 1] - ts[lo]);
    const d = ds[lo] + (ds[lo + 1] - ds[lo]) * k;
    const v = vs[lo] + (vs[lo + 1] - vs[lo]) * k;
    const s = this.track.station + d;
    const left = this.track.L - d;
    const phase = d < tl.top ? 'lift' : left < C.brake ? 'brake' : 'run';
    const sl = ((s % this.track.L) + this.track.L) % this.track.L;
    const loopS = this.track.s[this.track.loopStart];
    const loop = sl >= loopS;
    return { phase, lap, dwellLeft: 0, untilDwell: tl.period - c, s, d, v, fast: v > 7 || loop, loop };
  }

  update(T) {
    const st = this.state(T);
    this.st = st;
    const f = { p: V(), t: V(), u: V(), x: V() };
    const m = new THREE.Matrix4();
    this.cars.forEach((car, i) => {
      this.frameAt(st.s - i * COASTER.gap, f);
      car.position.copy(f.p).addScaledVector(f.u, 0.12);
      m.makeBasis(f.x, f.u, f.t);
      car.quaternion.setFromRotationMatrix(m);
    });
    return st;
  }

  buildTrackMesh() {
    const { pts, N, s, L } = this.track;
    const rails = [[], [], []];
    for (let i = 0; i < N; i += 2) {
      const q = pts[i];
      rails[0].push(q.p.clone().addScaledVector(q.x, 0.42).addScaledVector(q.u, 0.05));
      rails[1].push(q.p.clone().addScaledVector(q.x, -0.42).addScaledVector(q.u, 0.05));
      rails[2].push(q.p.clone().addScaledVector(q.u, -0.2));
    }
    const segs = rails[0].length;
    const railMat = toon('#EF6461');
    for (let r = 0; r < 3; r++) {
      const c = new THREE.CatmullRomCurve3(rails[r], true);
      const tube = mk(new THREE.TubeGeometry(c, segs, r < 2 ? 0.065 : 0.13, 6, true), r < 2 ? railMat : toon('#F6D55C'), 0, 0, 0, r === 2);
      this.root.add(tube);
    }
    // 침목 (0.9m마다)
    const tieGeo = new THREE.BoxGeometry(1.0, 0.07, 0.16);
    const items = [];
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), f = { p: V(), t: V(), u: V(), x: V() };
    for (let d = 0; d < L; d += 0.9) {
      this.frameAt(d, f);
      mtx.makeBasis(f.x, f.u, f.t);
      q.setFromRotationMatrix(mtx);
      items.push({ geo: tieGeo, m: new THREE.Matrix4().compose(f.p.clone().addScaledVector(f.u, -0.04), q.clone(), V(1, 1, 1)) });
    }
    this.root.add(mk(mergeGeos(items), toon('#8A8F98'), 0, 0, 0, false));
    // 기둥: 높은 곳마다 아래(땅이나 바닷속)까지. 루프와 다리 위는 따로
    const pillars = [];
    const pg = new THREE.CylinderGeometry(0.13, 0.17, 1, 8);
    const C = COASTER.center;
    for (let d = 2; d < L; d += 5.5) {
      this.frameAt(d, f);
      if (f.loop) continue;
      const p = f.p;
      if (Math.abs(p.x) < 2.6 && p.z < 46) continue; // 다리 위
      const onIsle = Math.hypot(p.x - C.x, p.z - C.z) < 20.3;
      const y0 = onIsle ? 0 : -1.3, y1 = p.y - 0.28;
      if (y1 - y0 < 0.4) continue;
      pillars.push({ geo: pg, m: new THREE.Matrix4().compose(V(p.x, (y0 + y1) / 2, p.z), new THREE.Quaternion(), V(1, y1 - y0, 1)) });
    }
    // 루프 아래 받침 (고리 양쪽 발)
    const L2 = COASTER.loop;
    for (const [x, z] of [[L2.x - 1.2, L2.z - 0.2], [L2.x + 1.2, L2.z - L2.off + 0.2], [L2.x, L2.z - L2.off / 2]]) {
      pillars.push({ geo: pg, m: new THREE.Matrix4().compose(V(x, (L2.y - 0.3 - 1.3) / 2, z), new THREE.Quaternion(), V(1.3, L2.y - 0.3 + 1.3, 1.3)) });
    }
    // 루프 꼭대기를 받치는 큰 다리 둘 (양옆 바다에서 비스듬히)
    const top = V(L2.x, L2.y + 2 * L2.R + 0.2, L2.z - L2.off / 2);
    for (const sx of [-1, 1]) {
      const foot = V(L2.x + sx * 3.4, -1.3, L2.z - L2.off / 2 + 1.6);
      const d = V().subVectors(top, foot);
      const len = d.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(UPW, d.clone().normalize());
      pillars.push({ geo: pg, m: new THREE.Matrix4().compose(foot.clone().addScaledVector(d, 0.5), quat, V(0.8, len, 0.8)) });
    }
    this.root.add(mk(mergeGeos(pillars), toon('#FFFDF7'), 0, 0, 0, true));
  }

  buildStation() {
    const S = COASTER.station;
    const g = new THREE.Group();
    const add = (w, h, d, c, x, y, z) => g.add(mk(new THREE.BoxGeometry(w, h, d), toon(c), x, y, z));
    add(1.5, 0.5, 6.2, '#C99862', 0.15, 0.25, 0); // 승강장 바닥
    add(1.56, 0.06, 6.26, '#B07F4E', 0.15, 0.52, 0);
    for (const z of [-2.9, 2.9]) for (const x of [-0.5, 0.8]) add(0.12, 2.6, 0.12, '#FFFDF7', x, 1.8, z);
    add(2.4, 0.14, 6.6, '#EF6461', 0.0, 3.15, 0);
    for (let i = 0; i < 7; i++) add(2.42, 0.16, 0.45, i % 2 ? '#FFFDF7' : '#EF6461', 0.0, 3.3, -2.7 + i * 0.9);
    // 난간 (섬 쪽, 타는 곳만 비운다)
    for (const z of [-2.6, 2.6]) add(0.06, 0.7, 1.1, '#F6D55C', 0.85, 0.85, z);
    g.position.set(S.x, 0, S.z);
    mergeColored(g, VC);
    mergeStatic(g);
    const sg = this.park.sign('롤러코스터', 2.3, { bg: '#5FA9E0', fg: '#FFFDF7', border: '#3F7FB8' });
    sg.position.set(0.95, 3.95, 0);
    sg.rotation.y = Math.PI / 2;
    g.add(sg);
    this.station = g;
  }

  buildTrain() {
    const cols = ['#5FA9E0', '#F6D55C', '#5DB760'];
    const glow = this.v.glow('#FFF2B3');
    for (let i = 0; i < COASTER.cars; i++) {
      const car = makeCar(cols[i % cols.length], i === 0, glow);
      for (const x of [-SEAT_X, SEAT_X]) {
        const seat = new THREE.Object3D();
        seat.position.set(x, 0.2, -0.12);
        car.add(seat);
        this.seats.push(seat);
      }
      this.root.add(car);
      this.cars.push(car);
    }
  }
}
