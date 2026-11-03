// 진숲 어린이 마을 — 바다 낚시 나루터
// 마을 섬 남동쪽 바닷가에서 바다로 뻗은 나무 다리(나루터) 끝에 작은 배가 묶여 있다.
// 배에 타면 노를 저어 바다로 나가 낚시를 한다. 놀이는 play3d.js의 낚시와 같고 바다 물고기가 나온다.
// 이 파일은 나루터와 배 모형, 배가 물 위를 오가는 움직임을 맡는다 (내 배와 친구 배 모두).
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored, mergeGeos } from './merge.js';
import { PIER, pierPoint, onPier, onJetty, PARK_ISLE, POOL_ISLE, BOARD_ISLE } from './isles.js';

export const SEA_Y = -1.15; // 바다 물 높이 (마을 둘레 바다 면)
const BOAT_Y = SEA_Y - 0.13; // 배 바닥 높이 (물에 0.13만큼 잠긴다)
const SEAT = { y: 0.24, z: -0.3 }; // 배 안에서 앉는 자리 (주민 발밑 높이, 앞뒤)
const HEAD0 = Math.atan2(PIER.ux, PIER.uz); // 바다 쪽을 보는 방향 (rotation.y)
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 배가 오가는 자리 (나루터 좌표 u, w로 정한다)
const at = (u, w) => { const p = pierPoint(u, w); return { x: p.x, z: p.z }; };
export const MOOR = at(PIER.len - 1.5, PIER.hw2 + 0.85); // 배를 묶어 두는 곳 (넓은 마당 오른쪽)
export const HARBOR = at(PIER.len + 3.5, PIER.hw2 + 0.85); // 나루터 끝 앞바다 (드나들 때 거쳐 간다)
export const BOARD = at(PIER.len - 1.5, PIER.hw2 - 0.55); // 배에 타고 내리는 곳 (마당 위)
// 낚시하는 바다 자리 셋. 배는 마을 섬 쪽을 바라보고 선다(face): 뒤에서 보면 섬과 나루터가 보인다
const spot = (u, w, turn) => { const p = at(u, w); return { ...p, face: Math.atan2(-p.x, -p.z) + turn }; };
export const SEA_SPOTS = [spot(PIER.len + 8, 3, 0.25), spot(PIER.len + 11, 9, 0.1), spot(PIER.len + 12, -4, -0.2)];
export const BOAT_FACE = HEAD0;

// ---------- 바닷길 ----------
// 배가 못 가는 곳: 섬 넷의 모래밭(놀이동산 섬은 롤러코스터 기둥까지)과 나루터. 모래밭에서 SEA_FAR보다 멀리는 나가지 않는다
const SHORES = [{ x: 0, z: 0, r: 39.5 }, { x: PARK_ISLE.x, z: PARK_ISLE.z, r: PARK_ISLE.r + 5.1 }, { x: POOL_ISLE.x, z: POOL_ISLE.z, r: POOL_ISLE.r + 4.5 },
  { x: BOARD_ISLE.x, z: BOARD_ISLE.z, r: BOARD_ISLE.r + 4.5 }];
export const SEA_FAR = 24;
// 가장 가까운 모래밭 끝까지 거리 (땅 위면 0보다 작다)
export function shoreGap(x, z) {
  let g = Infinity;
  for (const L of SHORES) g = Math.min(g, Math.hypot(x - L.x, z - L.z) - L.r);
  return g;
}
// 배 가운데가 (x, z)에 있어도 되는지. 왜 안 되는지도 알려 준다 ('land', 'far', 'pier')
export function seaBlock(x, z, m = 1.0) {
  const g = shoreGap(x, z);
  if (g < m) return 'land';
  if (g > SEA_FAR) return 'far';
  if (onPier(x, z, 0.75) || onJetty(x, z, 0.75)) return 'pier';
  return null;
}
export const canSail = (x, z, m = 1.0) => !seaBlock(x, z, m);
function clearLine(a, b, m = 1.0) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 1; i <= n; i++) { const k = i / n; if (!canSail(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, m)) return false; }
  return true;
}
// 섬 넷 바깥을 한 바퀴 도는 바닷길 고리 (가운데에서 바깥으로 그은 줄마다, 마지막 땅에서 조금 더 나간 곳)
const RING = (() => {
  const C = { x: 15, z: 22 }, N = 96, out = [];
  const land = (x, z) => shoreGap(x, z) < 0 || onPier(x, z, 0.75) || onJetty(x, z, 0.75);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let last = 0;
    for (let r = 0; r < 110; r += 0.5) if (land(C.x + dx * r, C.z + dz * r)) last = r;
    let r = last;
    while (r < 140 && (shoreGap(C.x + dx * r, C.z + dz * r) < 4.5 || onPier(C.x + dx * r, C.z + dz * r, 2.5) || onJetty(C.x + dx * r, C.z + dz * r, 2.5))) r += 0.5;
    out.push({ x: C.x + dx * r, z: C.z + dz * r, dx, dz });
  }
  // 이웃한 점 사이 길이 땅을 스치면 두 점을 조금씩 바깥으로 민다
  for (let it = 0; it < 30; it++) {
    let moved = false;
    for (let i = 0; i < N; i++) {
      const p = out[i], q = out[(i + 1) % N];
      if (clearLine(p, q, 1.6)) continue;
      for (const o of [p, q]) if (shoreGap(o.x + o.dx * 0.5, o.z + o.dz * 0.5) <= SEA_FAR - 1) { o.x += o.dx * 0.5; o.z += o.dz * 0.5; moved = true; }
    }
    if (!moved) break;
  }
  return out.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) }));
})();
// from에서 to까지 땅에 닿지 않는 바닷길 (점 목록, 마지막이 to). 곧게 갈 수 있으면 [to]
export function seaRoute(from, to) {
  if (clearLine(from, to)) return [{ x: to.x, z: to.z }];
  const N = RING.length;
  const near = (p) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(RING[i].x - p.x, RING[i].z - p.z);
      if (d < bd && clearLine(p, RING[i], 0.9)) { bd = d; best = i; }
    }
    return best;
  };
  const i0 = near(from), i1 = near(to);
  if (i0 < 0 || i1 < 0) return [{ x: to.x, z: to.z }];
  const walk = (dir) => {
    const pts = [];
    let len = 0;
    for (let i = i0; ; i = (i + dir + N) % N) {
      pts.push(RING[i]);
      if (pts.length > 1) len += Math.hypot(RING[i].x - pts[pts.length - 2].x, RING[i].z - pts[pts.length - 2].z);
      if (i === i1) break;
    }
    return { pts, len };
  };
  const f = walk(1), b = walk(-1);
  const path = [...(f.len <= b.len ? f.pts : b.pts), { x: to.x, z: to.z }];
  // 곧게 보이는 점까지 건너뛰어 길을 줄인다
  const out = [];
  let cur = from, k = 0;
  while (k < path.length) {
    let j = path.length - 1;
    while (j > k && !clearLine(cur, path[j])) j--;
    out.push(path[j]);
    cur = path[j];
    k = j + 1;
  }
  return out;
}
export const SEA_RING = RING;

// ---------- 물고기 떼 ----------
// 바다 몇 곳에 물고기 떼가 천천히 맴돈다. 거품이 보글보글 오르고, 물고기가 가끔 뛰어오르고, 갈매기가 위를 돈다.
// 모든 기기가 같은 시계(Date.now)로 움직여서 친구 화면에서도 같은 곳에 있다. 물고기 떼 가까이에서 낚시하면 물고기가 더 많이, 빨리 온다
// (잡히는 물고기 종류와 확률은 서버가 정하고 어디서나 같다).
export const SCHOOLS = [
  { x: 40, z: 36, r: 4, T: 260, ph: 0.4 }, // 나루터 앞바다
  { x: -50, z: 8, r: 5, T: 300, ph: 2.1 }, // 마을 섬 서쪽
  { x: 8, z: -50, r: 5, T: 280, ph: 4.0 }, // 마을 섬 북쪽
  { x: -34, z: 44, r: 4, T: 240, ph: 1.2 }, // 놀이동산 섬 서쪽
  { x: 84, z: -6, r: 4, T: 320, ph: 5.3 }, // 수영장 섬 동쪽
];
export function schoolAt(i, tSec = Date.now() / 1000) {
  const S = SCHOOLS[i], a = S.ph + ((tSec % S.T) / S.T) * Math.PI * 2;
  return { x: S.x + Math.cos(a) * S.r, z: S.z + Math.sin(a) * S.r };
}
// (x, z) 가까이(within) 있는 물고기 떼 번호, 없으면 -1
export function nearSchool(x, z, within = 7) {
  for (let i = 0; i < SCHOOLS.length; i++) { const p = schoolAt(i); if (Math.hypot(p.x - x, p.z - z) < within) return i; }
  return -1;
}

function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ---------- 배 ----------
// 위에서 본 배 모양 (z가 앞, 뱃머리는 뾰족하고 뒤는 판판하다). Shape의 y는 마을의 -z가 된다.
const HULL = [[-0.46, -1.15], [-0.58, -0.7], [-0.63, -0.1], [-0.57, 0.5], [-0.38, 1.0], [0, 1.42], [0.38, 1.0], [0.57, 0.5], [0.63, -0.1], [0.58, -0.7], [0.46, -1.15]];
function hullShape(k = 1, dz = 0) {
  const pts = HULL.map(([x, z]) => new THREE.Vector2(x * k, -(z * (k * 0.5 + 0.5) + dz)));
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  s.splineThru(pts.slice(1, 6));
  s.splineThru(pts.slice(6));
  s.closePath();
  return s;
}
let boatParts = null;
function parts() {
  if (boatParts) return boatParts;
  const H0 = 0.3, H1 = 0.26; // 아래 배 몸통 높이, 뱃전 높이
  const low = new THREE.ExtrudeGeometry(hullShape(), { depth: H0, bevelEnabled: false, curveSegments: 6 });
  low.rotateX(-Math.PI / 2);
  // 아래로 갈수록 좁아지게
  const P = low.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const k = 0.66 + 0.34 * Math.max(0, Math.min(1, P.getY(i) / H0));
    P.setX(i, P.getX(i) * k);
    P.setZ(i, P.getZ(i) * (0.82 + 0.18 * k));
  }
  low.computeVertexNormals();
  const rimS = hullShape();
  rimS.holes.push(hullShape(0.86, 0.04));
  const rim = new THREE.ExtrudeGeometry(rimS, { depth: H1, bevelEnabled: false, curveSegments: 6 });
  rim.rotateX(-Math.PI / 2);
  rim.translate(0, H0, 0);
  boatParts = {
    low, rim, H0, H1,
    mat: {
      floor: toon('#D6AE7B'), hull: toon('#5FA8D3'), rimTop: toon('#A06E45'), rimSide: toon('#FFFDF7'),
      wood: toon('#B07F4E'), dark: toon('#7A5233'), flag: toon('#EF6461'), rope: toon('#D9C7A0'), bucket: toon('#7EC8F2'),
    },
  };
  return boatParts;
}

// 배 하나: group(배 전체), seat(앉는 자리), oars(노 둘)
export function makeBoat() {
  const P = parts(), M = P.mat;
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Group();
  g.add(body);
  const low = new THREE.Mesh(P.low, [M.floor, M.hull]);
  low.castShadow = true;
  low.receiveShadow = true;
  body.add(low);
  const rim = new THREE.Mesh(P.rim, [M.rimTop, M.rimSide]);
  rim.castShadow = true;
  body.add(rim);
  const top = P.H0 + P.H1;
  // 앉는 판 둘, 뒤쪽 깃발, 물고기 담는 양동이
  body.add(mk(new THREE.BoxGeometry(1.1, 0.06, 0.34), M.wood, 0, 0.47, SEAT.z));
  body.add(mk(new THREE.BoxGeometry(0.72, 0.05, 0.26), M.wood, 0, 0.44, 0.78));
  body.add(mk(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), M.dark, 0, top + 0.4, -1.02));
  const flag = mk(new THREE.BoxGeometry(0.02, 0.2, 0.32), M.flag, 0, top + 0.72, -1.18);
  body.add(flag);
  body.add(mk(new THREE.CylinderGeometry(0.11, 0.09, 0.18, 12), M.bucket, 0.28, 0.39, 0.3));
  // 노: 뱃전의 노걸이에서 돈다. 안쪽은 손잡이, 바깥 끝은 넓은 날
  const oars = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(s * 0.6, top + 0.02, -0.12);
    const shaft = mk(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 6), M.wood);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = s * 0.5;
    piv.add(shaft);
    piv.add(mk(new THREE.BoxGeometry(0.42, 0.03, 0.15), M.wood, s * 1.22, 0, 0));
    piv.add(mk(new THREE.BoxGeometry(0.05, 0.08, 0.05), M.dark, 0, -0.03, 0));
    piv.userData.s = s;
    body.add(piv);
    oars.push(piv);
  }
  const seat = new THREE.Object3D();
  seat.position.set(0, SEAT.y, SEAT.z);
  g.add(seat);
  g.userData = { seat, oars, body, path: [], v: 0, ph: Math.random() * 6, bob: Math.random() * 6, row: 0, face: null };
  setOars(g, 0);
  return g;
}
// 노 젓기 (row: 0 거둔 노 ~ 1 젓는 노, ph: 젓는 박자)
function setOars(boat, row, ph = 0) {
  for (const piv of boat.userData.oars) {
    const s = piv.userData.s;
    const sw = Math.sin(ph) * 0.55, dip = Math.cos(ph) * 0.12;
    // 거둔 노: 배 옆에 뒤쪽으로 눕힌다
    piv.rotation.y = s * ((1 - row) * (Math.PI / 2 - 0.12) + row * sw);
    piv.rotation.z = s * (row * (-0.24 - dip) + (1 - row) * 0.05);
  }
}
export function seatOf(boat) { return boat.userData.seat; }

// ---------- 나루터 ----------
export class Sea {
  constructor(world, { signMesh }) {
    this.v = world;
    this.signMesh = signMesh;
    this.boats = new Set(); // 친구 배
    this.buildPier();
    this.boat = makeBoat(); // 내가 타는 배 (평소에는 묶여 있다)
    this.dock(this.boat);
    this.boat.userData.pick = { type: 'building', id: 'sea' };
    world.scene.add(this.boat);
    world.pickRoots.push(this.boat);
    // 배를 묶은 밧줄
    const pos = new Float32Array(10 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#8B6B45' }));
    this.rope.frustumCulled = false;
    world.scene.add(this.rope);
    this.ropeFrom = (() => { const p = pierPoint(PIER.len - 0.6, PIER.hw2 - 0.15); return V(p.x, 0.32, p.z); })();
    this.buildSchools();
  }

  // 물고기 떼: 떼마다 어두운 물빛, 거품 8개, 뛰어오르는 물고기 1마리, 갈매기 2마리. 그리기 횟수를 줄이려고 같은 것끼리 한 덩어리(InstancedMesh)로 그린다
  buildSchools() {
    const n = SCHOOLS.length;
    const IM = (geo, mat, count) => { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.v.scene.add(m); return m; };
    // 물고기 떼 아래 어두운 물빛: 가운데는 진하고 가장자리로 갈수록 옅어진다
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d'), gr = g2.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(14,53,80,0.32)');
    gr.addColorStop(0.6, 'rgba(14,53,80,0.18)');
    gr.addColorStop(1, 'rgba(14,53,80,0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    const patchTex = new THREE.CanvasTexture(c);
    const patchGeo = new THREE.PlaneGeometry(6.4, 6.4);
    patchGeo.rotateX(-Math.PI / 2);
    this.sPatch = IM(patchGeo, new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, depthWrite: false }), n);
    this.sBub = IM(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 }), n * 8);
    const fishGeo = new THREE.SphereGeometry(0.2, 10, 8);
    fishGeo.scale(0.45, 0.6, 1.25);
    const tail = new THREE.ConeGeometry(0.16, 0.26, 4);
    tail.rotateX(-Math.PI / 2);
    tail.scale(0.3, 1, 1);
    tail.translate(0, 0, -0.32);
    this.sFish = IM(mergeGeos([{ geo: fishGeo, m: new THREE.Matrix4() }, { geo: tail, m: new THREE.Matrix4() }]), toon('#7FA9C9'), n);
    const gullBody = new THREE.SphereGeometry(0.16, 10, 8);
    gullBody.scale(0.8, 0.8, 1.6);
    this.sGull = IM(gullBody, toon('#FFFFFF'), n * 2);
    const wing = new THREE.BoxGeometry(0.62, 0.03, 0.22);
    wing.translate(0.31, 0, 0);
    this.sWing = IM(wing, toon('#F2F4F7'), n * 4);
    this.sRing = []; // 뛰어오른 물고기가 떨어진 자리 물결 (떼마다 하나)
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.v.scene.add(m);
      this.sRing.push(m);
    }
    this.sM = new THREE.Matrix4();
    this.sQ = new THREE.Quaternion();
    this.sE = new THREE.Euler();
    this.sS = new THREE.Vector3();
    this.sP = new THREE.Vector3();
  }
  updateSchools() {
    const tSec = Date.now() / 1000, M = this.sM, Q = this.sQ, E = this.sE, S = this.sS, P = this.sP;
    const put = (im, i, x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) => {
      E.set(rx, ry, rz, 'YXZ');
      Q.setFromEuler(E);
      M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz));
      im.setMatrixAt(i, M);
    };
    for (let i = 0; i < SCHOOLS.length; i++) {
      const c = schoolAt(i, tSec);
      put(this.sPatch, i, c.x, SEA_Y + 0.02, c.z, 0, 0, 0, 1 + Math.sin(tSec * 0.8 + i) * 0.06, 1, 1);
      // 거품: 떼 안 여기저기서 솟았다가 터진다
      for (let k = 0; k < 8; k++) {
        const ph = (tSec * 0.7 + k * 0.137 + i * 0.31) % 1;
        const a = k * 2.4 + i * 1.7 + Math.floor(tSec * 0.7 + k * 0.137 + i * 0.31) * 1.3;
        const rr = 0.4 + ((k * 37 + i * 11) % 10) * 0.18;
        const sc = ph < 0.8 ? 0.5 + ph * 0.9 : (1 - ph) * 5;
        put(this.sBub, i * 8 + k, c.x + Math.cos(a) * rr, SEA_Y + 0.03 + ph * 0.06, c.z + Math.sin(a) * rr, 0, 0, 0, sc, sc * 0.6, sc);
      }
      // 뛰어오르는 물고기: 떼마다 4.7초에 한 번, 0.9초 동안 둥글게
      const P0 = 4.7, q = (tSec + i * 1.3) % P0, J = 0.9;
      const ja = Math.floor((tSec + i * 1.3) / P0) * 2.3 + i;
      const jx = c.x + Math.cos(ja) * 1.0, jz = c.z + Math.sin(ja) * 1.0, dir = ja + Math.PI / 2;
      if (q < J) {
        const k = q / J, d = (k - 0.5) * 1.6;
        put(this.sFish, i, jx + Math.sin(dir) * d, SEA_Y + 0.05 + Math.sin(k * Math.PI) * 0.95, jz + Math.cos(dir) * d, -(k - 0.5) * 2.2, dir, 0);
      } else put(this.sFish, i, jx, SEA_Y - 2, jz, 0, 0, 0, 0.001, 0.001, 0.001);
      const ring = this.sRing[i];
      const rk = (q - J) / 1.1;
      if (rk >= 0 && rk < 1) {
        ring.position.set(jx + Math.sin(dir) * 0.8, SEA_Y + 0.04, jz + Math.cos(dir) * 0.8);
        ring.scale.setScalar(1 + rk * 4);
        ring.material.opacity = 0.8 * (1 - rk);
      } else ring.material.opacity = 0;
      // 갈매기 둘: 떼 위를 빙빙 돌며 날갯짓
      for (let g = 0; g < 2; g++) {
        const ga = tSec * (0.55 + g * 0.12) + g * Math.PI + i;
        const gr = 2.4 + g * 0.8, gy = SEA_Y + 3.4 + g * 0.7 + Math.sin(tSec * 0.9 + g) * 0.25;
        const gx = c.x + Math.cos(ga) * gr, gz = c.z + Math.sin(ga) * gr;
        const head = -ga; // 원을 따라 도는 쪽
        const j = i * 2 + g;
        put(this.sGull, j, gx, gy, gz, 0, head, 0.35);
        const flap = Math.sin(tSec * 7 + j) * 0.55;
        put(this.sWing, j * 2, gx, gy + 0.03, gz, 0, head, 0.35 + flap);
        put(this.sWing, j * 2 + 1, gx, gy + 0.03, gz, 0, head, Math.PI + 0.35 - flap);
      }
    }
    for (const im of [this.sPatch, this.sBub, this.sFish, this.sGull, this.sWing]) im.instanceMatrix.needsUpdate = true;
  }

  buildPier() {
    const v = this.v;
    const g = new THREE.Group();
    g.position.set(PIER.x, 0, PIER.z);
    g.rotation.y = HEAD0;
    // 이 무리 안에서는 +z가 바다 쪽(u), -x가 오른쪽(w)
    const wood = toon('#B07F4E'), light = toon('#C99862'), dark = toon('#7A5233'), pile = toon('#6B4A33');
    const add = (geo, mat, u, y, w, ry = 0) => { const o = mk(geo, mat, -w, y, u); o.rotation.y = ry; g.add(o); return o; };
    const L = PIER.len, E = PIER.len - PIER.end;
    const U0 = 4.0; // 땅 끝에서 조금 안쪽부터 나무 바닥을 깐다
    const W1 = PIER.hw + 0.2, W2 = PIER.hw2 + 0.2;
    // 바닥 판
    const plank = (u0, u1, hw) => {
      const n = Math.round((u1 - u0) / 0.5);
      for (let i = 0; i < n; i++) {
        const u = u0 + (i + 0.5) * ((u1 - u0) / n);
        add(new THREE.BoxGeometry(hw * 2, 0.06, (u1 - u0) / n - 0.06), i % 2 ? wood : light, u, 0.015, 0);
      }
      add(new THREE.BoxGeometry(hw * 2 - 0.2, 0.2, u1 - u0), dark, (u0 + u1) / 2, -0.12, 0);
    };
    plank(U0, E, W1);
    plank(E, L, W2);
    // 기둥(물속 말뚝)과 난간
    const post = (u, w, h = 0.95) => {
      add(new THREE.BoxGeometry(0.13, h, 0.13), dark, u, h / 2 - 0.02, w);
      add(new THREE.CylinderGeometry(0.11, 0.13, 1.9, 8), pile, u, -0.98, w);
    };
    const railAlong = (u0, u1, w) => {
      add(new THREE.BoxGeometry(0.09, 0.09, u1 - u0), wood, (u0 + u1) / 2, 0.88, w);
      add(new THREE.BoxGeometry(0.06, 0.06, u1 - u0), wood, (u0 + u1) / 2, 0.46, w);
    };
    const railAcross = (u, w0, w1) => {
      add(new THREE.BoxGeometry(Math.abs(w1 - w0), 0.09, 0.09), wood, u, 0.88, (w0 + w1) / 2);
      add(new THREE.BoxGeometry(Math.abs(w1 - w0), 0.06, 0.06), wood, u, 0.46, (w0 + w1) / 2);
    };
    for (const s of [-1, 1]) {
      railAlong(U0 + 0.2, E, s * (W1 - 0.05));
      const n = Math.round((E - U0) / 1.6);
      for (let i = 0; i <= n; i++) post(U0 + 0.2 + (i / n) * (E - U0 - 0.2), s * (W1 - 0.05));
    }
    // 넓은 마당: 왼쪽과 끝은 난간, 오른쪽(배 쪽)은 타고 내리는 곳만 열어 둔다
    const WE = W2 - 0.05; // 마당 난간 (걷는 곳보다 0.15 바깥)
    railAcross(E, -WE, -(W1 - 0.05));
    railAcross(E, W1 - 0.05, WE);
    railAlong(E, L - 0.05, -WE);
    railAcross(L - 0.05, -WE, WE);
    railAlong(E, E + 0.55, WE);
    railAlong(L - 0.55, L - 0.05, WE);
    for (const [u, w] of [[E, -WE], [E, WE], [L - 0.05, -WE], [L - 0.05, WE], [E + 0.55, WE], [L - 0.55, WE], [(E + L) / 2, -WE]]) post(u, w);
    // 사다리: 열린 곳에서 물까지
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 1.15, 0.06), dark, (E + L) / 2 + s * 0.28, -0.55, WE + 0.08);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.06, 0.05, 0.56), wood, (E + L) / 2, -0.15 - i * 0.28, WE + 0.08);
    // 배 묶는 말뚝
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.32, 10), dark, L - 0.6, 0.16, PIER.hw2 - 0.15);
    // 구명 튜브 (왼쪽 난간)
    const ringGeo = new THREE.TorusGeometry(0.26, 0.07, 8, 20);
    const ring = add(ringGeo, toon('#EF6461'), (E + L) / 2, 0.62, -WE - 0.07, Math.PI / 2);
    for (let k = 0; k < 4; k++) {
      const b = mk(new THREE.TorusGeometry(0.26, 0.075, 8, 4, 0.35), toon('#FFFDF7'));
      b.rotation.z = k * (Math.PI / 2) + 0.2;
      ring.add(b);
    }
    // 끝 모서리 등불 둘 (밤에 빛난다)
    const lampMat = v.glow('#FFE9A8');
    for (const w of [-WE, WE]) {
      add(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), dark, L - 0.05, 0.85, w);
      add(new THREE.BoxGeometry(0.26, 0.3, 0.26), lampMat, L - 0.05, 1.85, w);
      add(new THREE.ConeGeometry(0.22, 0.18, 4), dark, L - 0.05, 2.09, w, Math.PI / 4);
    }
    mergeColored(g, VC);
    mergeStatic(g);
    v.scene.add(g);
    this.pier = g;

    // 누르면 배 타는 곳으로 가는 것들: 나루터 들머리 문과 배 타는 곳 표지판
    const sg = new THREE.Group();
    // 이 무리는 배 타는 곳(BOARD)에 놓이고 바다 쪽을 본다: 나루터 자리 (u, w)는 무리 안에서 (-(w - BW), u - BU)
    const BU = PIER.len - 1.5, BW = PIER.hw2 - 0.55;
    const sAdd = (o, u, y, w) => { o.position.set(-(w - BW), y, u - BU); sg.add(o); return o; };
    for (const s of [-1, 1]) sAdd(mk(new THREE.BoxGeometry(0.16, 2.3, 0.16), dark), U0 + 0.1, 1.15, s * (W1 + 0.05));
    sAdd(mk(new THREE.BoxGeometry(W1 * 2 + 0.5, 0.14, 0.2), wood), U0 + 0.1, 2.3, 0);
    // 문 위 이름판: 섬 쪽과 바다 쪽 어디서 봐도 읽히게 앞뒤로 둘
    for (const back of [false, true]) {
      const gate = this.signMesh('바다 낚시 나루터', 2.2, { bg: '#EAF7FC', fg: '#1F6E94', border: '#5FA8D3' });
      sAdd(gate, U0 + (back ? -0.05 : 0.05), 2.0, 0);
      if (back) gate.rotation.y = Math.PI;
    }
    const board = v.postSign('배 타는 곳', 1.2);
    board.rotation.y = -Math.PI / 2;
    sAdd(board, E + 0.25, 0, WE - 0.15);
    // 배 타는 곳: 마당 위(BOARD), 바다 쪽을 보며 선다
    v.spot('sea', '바다 낚시 나루터', sg, { x: BOARD.x, z: BOARD.z, rot: HEAD0, door: 0 });
  }
  // 배를 묶어 둔 자리에 바로 둔다
  dock(boat) {
    boat.position.set(MOOR.x, BOAT_Y, MOOR.z);
    boat.rotation.y = HEAD0;
    Object.assign(boat.userData, { path: [], v: 0, row: 0, face: null, onArrive: null, manual: false });
  }
  // 배를 pts 자리들을 거쳐 몬다. face: 마지막에 바라볼 방향, onArrive: 다 오면 한 번 부른다
  sail(boat, pts, { face = null, onArrive = null, speed = 2.4 } = {}) {
    Object.assign(boat.userData, { path: pts.map((p) => ({ x: p.x, z: p.z })), face, onArrive, vmax: speed, manual: false });
  }
  // 지금 자리에서 goal까지 갈 길 (묶는 곳을 드나들 때는 나루터 끝 앞바다를 거친다)
  route(boat, goal) {
    const p = boat.position;
    const atMoor = (q) => Math.hypot(q.x - MOOR.x, q.z - MOOR.z) < 2.5;
    if (atMoor(goal) && !atMoor(p)) return [...seaRoute(p, HARBOR), MOOR];
    if (atMoor(p) && !atMoor(goal)) return [HARBOR, ...seaRoute(HARBOR, goal)];
    return seaRoute(p, goal);
  }
  moving(boat) { const u = boat.userData; return u.path.length > 0 || (u.face != null && Math.abs(wrapA(u.face - boat.rotation.y)) > 0.02); }

  // 친구 배 (놀이가 끝나면 친구 자리에서 떼어 낸다)
  friendBoat() {
    const b = makeBoat();
    this.dock(b);
    this.v.scene.add(b);
    this.boats.add(b);
    return b;
  }

  update(dt, t) {
    this.updateSchools();
    this.move(this.boat, dt, t);
    for (const b of this.boats) {
      if (!b.parent) { this.boats.delete(b); continue; }
      this.move(b, dt, t);
    }
    // 밧줄: 배가 묶여 있을 때만
    const b = this.boat, near = Math.hypot(b.position.x - MOOR.x, b.position.z - MOOR.z) < 0.4 && !b.userData.path.length;
    this.rope.visible = near;
    if (near) {
      b.updateMatrixWorld();
      const to = b.localToWorld(V(0.3, 0.6, 1.0)); // 뱃머리의 나루터 쪽
      const P = this.rope.geometry.attributes.position;
      for (let i = 0; i < 10; i++) {
        const k = i / 9;
        P.setXYZ(i, this.ropeFrom.x + (to.x - this.ropeFrom.x) * k, this.ropeFrom.y + (to.y - this.ropeFrom.y) * k - Math.sin(k * Math.PI) * 0.25, this.ropeFrom.z + (to.z - this.ropeFrom.z) * k);
      }
      P.needsUpdate = true;
    }
  }
  move(b, dt, t) {
    const u = b.userData, p = b.position;
    if (u.manual) {
      // 놀이(js/play3d.js)가 직접 노를 젓는다: 자리, 방향, 빠르기(v), 노(row, ph)를 거기서 정한다
    } else if (u.path.length) {
      const q = u.path[0];
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      let rem = d;
      for (let i = 1; i < u.path.length; i++) rem += Math.hypot(u.path[i].x - u.path[i - 1].x, u.path[i].z - u.path[i - 1].z);
      const want = Math.atan2(dx, dz);
      const diff = wrapA(want - b.rotation.y);
      b.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.2);
      const align = Math.max(0.25, Math.cos(diff));
      const vt = Math.min(u.vmax || 2.4, 0.35 + rem * 0.9) * align;
      u.v += Math.max(-dt * 3, Math.min(dt * 1.6, vt - u.v));
      const step = u.v * dt;
      if (d <= Math.max(step, 0.03)) { p.x = q.x; p.z = q.z; u.path.shift(); } else { p.x += (dx / d) * step; p.z += (dz / d) * step; }
      u.row = Math.min(1, u.row + dt * 2.5);
      u.ph += dt * 5.5;
    } else {
      u.v = 0;
      u.row = Math.max(0, u.row - dt * 1.5);
      if (u.face != null) {
        const diff = wrapA(u.face - b.rotation.y);
        b.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.4);
        if (Math.abs(diff) < 0.02) { b.rotation.y = u.face; u.face = null; }
      }
      if (u.face == null && u.onArrive) { const f = u.onArrive; u.onArrive = null; f(); }
    }
    // 물결에 살짝 흔들린다
    p.y = BOAT_Y + Math.sin(t * 1.6 + u.bob) * 0.025;
    b.rotation.z = Math.sin(t * 1.3 + u.bob) * 0.035;
    b.rotation.x = Math.sin(t * 1.1 + u.bob * 1.7) * 0.02 - u.v * 0.012;
    setOars(b, u.row, u.ph);
  }
}
