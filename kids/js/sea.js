// 진숲 어린이 마을 — 바다 낚시 나루터
// 마을 섬 남동쪽 바닷가에서 바다로 뻗은 나무 다리(나루터) 끝에 작은 배가 묶여 있다.
// 배에 타면 노를 저어 바다로 나가 낚시를 한다. 놀이는 play3d.js의 낚시와 같고 바다 물고기가 나온다.
// 이 파일은 나루터와 배 모형, 배가 물 위를 오가는 움직임을 맡는다 (내 배와 친구 배 모두).
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { PIER, pierPoint } from './isles.js';

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
    Object.assign(boat.userData, { path: [], v: 0, row: 0, face: null, onArrive: null });
  }
  // 배를 pts 자리들을 거쳐 몬다. face: 마지막에 바라볼 방향, onArrive: 다 오면 한 번 부른다
  sail(boat, pts, { face = null, onArrive = null, speed = 2.4 } = {}) {
    Object.assign(boat.userData, { path: pts.map((p) => ({ x: p.x, z: p.z })), face, onArrive, vmax: speed });
  }
  // 지금 자리에서 goal까지 갈 길 (묶는 곳을 드나들 때는 나루터 끝 앞바다를 거친다)
  route(boat, goal) {
    const p = boat.position;
    const atMoor = (q) => Math.hypot(q.x - MOOR.x, q.z - MOOR.z) < 2.5;
    if (atMoor(goal) && !atMoor(p)) return [HARBOR, MOOR];
    if (atMoor(p) && !atMoor(goal)) return [HARBOR, goal];
    return [goal];
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
    if (u.path.length) {
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
