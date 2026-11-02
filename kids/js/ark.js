// 진숲 어린이 마을 — 노아의 방주 짝 맞추기 (수영장 섬 북쪽)
// 탁자 위에 엎어 둔 카드를 두 장씩 뒤집어 같은 동물 짝을 찾는다. 동물들이 짝지어 방주에 들어간 이야기(창세기 7장)에서 따왔다.
// 혼자: 쉬움(12장), 보통(16장), 어려움(20장) 가운데 골라 걸린 시간과 뒤집은 횟수를 잰다. 내 최고 기록은 이 기기에 남는다.
// 친구와: 20장으로 번갈아 뒤집는다. 짝을 찾으면 한 번 더, 못 찾으면 차례가 넘어간다. 짝을 더 많이 찾은 친구가 이긴다.
// 서버는 쓰지 않는다. 친구와 할 때는 초대한 쪽이 카드를 섞어 보내고, 뒤집은 카드 번호만 주고받는다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { h, josa, confetti, modal } from './ui.js';
import { sfx } from './sound.js';
import { store } from './api.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// 방주와 탁자 자리 (방주는 남쪽 수영장을 본다). 아이들은 탁자 남쪽 긴 의자에 나란히 앉아 북쪽(방주 쪽)을 본다
export const ARK = { x: 56, z: -13.4 };
export const TABLE = { x: 56, z: -11.3, y: 0.86, hw: 0.8, hd: 0.75 };
export const ARK_SEATS = [{ x: 55.45, z: -10.1, rot: Math.PI }, { x: 56.55, z: -10.1, rot: Math.PI }];

export const ARK_LEVELS = [
  ['easy', '쉬움', '카드 12장, 6쌍', 4, 3],
  ['normal', '보통', '카드 16장, 8쌍', 4, 4],
  ['hard', '어려움', '카드 20장, 10쌍', 5, 4],
];

// ---------- 동물 그림 ----------
export const ANIMALS = [
  { id: 'lion', name: '사자' }, { id: 'elephant', name: '코끼리' }, { id: 'giraffe', name: '기린' }, { id: 'sheep', name: '양' },
  { id: 'rabbit', name: '토끼' }, { id: 'dove', name: '비둘기' }, { id: 'zebra', name: '얼룩말' }, { id: 'bear', name: '곰' },
  { id: 'monkey', name: '원숭이' }, { id: 'pig', name: '돼지' },
];
function eyes(c, x1, x2, y, r = 7) {
  c.fillStyle = '#2E2A2A';
  for (const x of [x1, x2]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.fillStyle = '#fff';
  for (const x of [x1, x2]) { c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, 7); c.fill(); }
}
function circle(c, x, y, r, fill, stroke, lw = 5) {
  c.beginPath(); c.arc(x, y, r, 0, 7);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function ellipse(c, x, y, rx, ry, fill, stroke, lw = 5, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function smile(c, x, y, w = 14) {
  c.strokeStyle = '#2E2A2A'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.arc(x - w / 2, y, w / 2, 0.1, Math.PI - 0.1); c.stroke();
  c.beginPath(); c.arc(x + w / 2, y, w / 2, 0.1, Math.PI - 0.1); c.stroke();
}
const cheeks = (c, x1, x2, y) => { c.fillStyle = 'rgba(246,162,196,.75)'; for (const x of [x1, x2]) { c.beginPath(); c.ellipse(x, y, 12, 8, 0, 0, 7); c.fill(); } };
// 128 x 120 칸 가운데(64, 64)에 얼굴을 그린다
const DRAW = {
  lion(c) {
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; circle(c, 64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40, 17, k % 2 ? '#D9822B' : '#E99A3E'); }
    circle(c, 64, 64, 38, '#F6C945', '#C99A1E', 4);
    circle(c, 38, 34, 10, '#F6C945', '#C99A1E', 3); circle(c, 90, 34, 10, '#F6C945', '#C99A1E', 3);
    eyes(c, 50, 78, 58);
    ellipse(c, 64, 76, 14, 10, '#FFF1C9');
    ellipse(c, 64, 72, 6, 4, '#7A4A2A');
    smile(c, 64, 79, 10);
  },
  elephant(c) {
    ellipse(c, 26, 60, 22, 30, '#AEB6C2', '#7D8794', 4); ellipse(c, 102, 60, 22, 30, '#AEB6C2', '#7D8794', 4);
    ellipse(c, 26, 60, 12, 19, '#F2C3CF'); ellipse(c, 102, 60, 12, 19, '#F2C3CF');
    circle(c, 64, 58, 34, '#C2C9D3', '#7D8794', 4);
    c.strokeStyle = '#7D8794'; c.lineWidth = 16; c.lineCap = 'round';
    c.beginPath(); c.moveTo(64, 70); c.quadraticCurveTo(64, 104, 82, 104); c.stroke();
    c.strokeStyle = '#C2C9D3'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(64, 70); c.quadraticCurveTo(64, 104, 82, 104); c.stroke();
    eyes(c, 50, 78, 54, 6);
    cheeks(c, 42, 86, 70);
  },
  giraffe(c) {
    c.fillStyle = '#F2C35B'; c.fillRect(52, 84, 24, 40);
    c.strokeStyle = '#7A5233'; c.lineWidth = 4;
    for (const x of [52, 64]) { c.beginPath(); c.moveTo(x, 18); c.lineTo(x, 34); c.stroke(); }
    circle(c, 52, 16, 6, '#7A5233'); circle(c, 76, 16, 6, '#7A5233');
    c.beginPath(); c.moveTo(76, 18); c.lineTo(76, 34); c.stroke();
    ellipse(c, 64, 58, 32, 34, '#F6D16E', '#C99A1E', 4);
    ellipse(c, 34, 44, 12, 7, '#F6D16E', '#C99A1E', 3, -0.5); ellipse(c, 94, 44, 12, 7, '#F6D16E', '#C99A1E', 3, 0.5);
    for (const [x, y, r] of [[46, 38, 6], [82, 36, 5], [86, 66, 5], [42, 70, 4], [62, 98, 6]]) circle(c, x, y, r, '#C98A3A');
    ellipse(c, 64, 78, 20, 13, '#FBE3A6');
    circle(c, 57, 76, 3, '#7A5233'); circle(c, 71, 76, 3, '#7A5233');
    eyes(c, 52, 76, 54, 6);
  },
  sheep(c) {
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; circle(c, 64 + Math.cos(a) * 34, 62 + Math.sin(a) * 30, 18, '#FFFFFF', '#D8D2C6', 3); }
    circle(c, 64, 62, 34, '#FFFFFF');
    ellipse(c, 64, 70, 22, 26, '#6B5A4E');
    ellipse(c, 36, 64, 12, 6, '#6B5A4E', null, 0, 0.4); ellipse(c, 92, 64, 12, 6, '#6B5A4E', null, 0, -0.4);
    for (const x of [52, 64, 76]) circle(c, x, 40, 10, '#FFFFFF');
    c.fillStyle = '#fff'; for (const x of [56, 72]) { c.beginPath(); c.arc(x, 66, 6, 0, 7); c.fill(); }
    c.fillStyle = '#2E2A2A'; for (const x of [56, 72]) { c.beginPath(); c.arc(x, 67, 3.5, 0, 7); c.fill(); }
    ellipse(c, 64, 84, 6, 4, '#F2A7B8');
  },
  rabbit(c) {
    ellipse(c, 48, 30, 11, 28, '#FFFFFF', '#D8D2C6', 4); ellipse(c, 80, 30, 11, 28, '#FFFFFF', '#D8D2C6', 4);
    ellipse(c, 48, 32, 5, 19, '#F6B6C8'); ellipse(c, 80, 32, 5, 19, '#F6B6C8');
    circle(c, 64, 72, 34, '#FFFFFF', '#D8D2C6', 4);
    eyes(c, 52, 76, 68, 6);
    ellipse(c, 64, 80, 5, 4, '#F28AA8');
    smile(c, 64, 85, 9);
    cheeks(c, 42, 86, 82);
  },
  dove(c) {
    // 올리브 잎을 문 비둘기 (창세기 8장)
    ellipse(c, 60, 70, 38, 26, '#FFFFFF', '#C9D3DD', 4);
    ellipse(c, 52, 64, 22, 14, '#EEF3F8', '#C9D3DD', 3, -0.4);
    circle(c, 92, 50, 16, '#FFFFFF', '#C9D3DD', 4);
    c.fillStyle = '#F6A94C'; c.beginPath(); c.moveTo(106, 48); c.lineTo(120, 52); c.lineTo(106, 56); c.fill();
    circle(c, 95, 46, 3.5, '#2E2A2A');
    c.strokeStyle = '#6E8B3D'; c.lineWidth = 3; c.beginPath(); c.moveTo(116, 54); c.quadraticCurveTo(110, 74, 98, 82); c.stroke();
    for (const [x, y, r] of [[112, 64, 0.6], [104, 74, 0.9], [110, 78, 0.2]]) ellipse(c, x, y, 7, 3.5, '#7FA24A', null, 0, r);
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(24, 66); c.lineTo(6, 56); c.lineTo(10, 76); c.closePath(); c.fill();
  },
  zebra(c) {
    ellipse(c, 64, 62, 30, 38, '#FFFFFF', '#2E2A2A', 4);
    c.fillStyle = '#2E2A2A';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(64, 34 + k * 12, 26 - k * 2, 3.5, 0, 0, 7); c.fill(); }
    ellipse(c, 38, 30, 8, 14, '#FFFFFF', '#2E2A2A', 3, -0.4); ellipse(c, 90, 30, 8, 14, '#FFFFFF', '#2E2A2A', 3, 0.4);
    for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(56 + k * 4, 14); c.lineTo(58 + k * 4, 26); c.lineWidth = 5; c.strokeStyle = '#2E2A2A'; c.stroke(); }
    ellipse(c, 64, 86, 20, 13, '#8E8E8E');
    circle(c, 57, 86, 3, '#2E2A2A'); circle(c, 71, 86, 3, '#2E2A2A');
    c.fillStyle = '#fff'; for (const x of [50, 78]) { c.beginPath(); c.arc(x, 62, 8, 0, 7); c.fill(); }
    eyes(c, 50, 78, 62, 5);
  },
  bear(c) {
    circle(c, 34, 32, 14, '#A0704A', '#7A5233', 4); circle(c, 94, 32, 14, '#A0704A', '#7A5233', 4);
    circle(c, 34, 32, 7, '#E3B48A'); circle(c, 94, 32, 7, '#E3B48A');
    circle(c, 64, 64, 38, '#A0704A', '#7A5233', 4);
    ellipse(c, 64, 78, 17, 13, '#E3B48A');
    ellipse(c, 64, 73, 6, 4.5, '#3B2E25');
    smile(c, 64, 80, 9);
    eyes(c, 50, 78, 58, 6);
  },
  monkey(c) {
    circle(c, 26, 62, 14, '#E8B98C', '#8A5A3B', 4); circle(c, 102, 62, 14, '#E8B98C', '#8A5A3B', 4);
    circle(c, 64, 62, 36, '#8A5A3B');
    c.fillStyle = '#F2D2AE';
    c.beginPath(); c.ellipse(52, 56, 14, 16, 0, 0, 7); c.ellipse(76, 56, 14, 16, 0, 0, 7); c.fill();
    ellipse(c, 64, 78, 22, 16, '#F2D2AE');
    eyes(c, 52, 76, 56, 6);
    circle(c, 59, 74, 2.5, '#5A3A26'); circle(c, 69, 74, 2.5, '#5A3A26');
    smile(c, 64, 82, 12);
  },
  pig(c) {
    c.fillStyle = '#F4A9BE';
    c.beginPath(); c.moveTo(30, 40); c.lineTo(36, 14); c.lineTo(52, 32); c.fill();
    c.beginPath(); c.moveTo(98, 40); c.lineTo(92, 14); c.lineTo(76, 32); c.fill();
    circle(c, 64, 64, 38, '#F7BACB', '#E28AA4', 4);
    ellipse(c, 64, 76, 18, 13, '#F28AA8', '#D86F8E', 3);
    ellipse(c, 58, 76, 3.5, 5, '#B85574'); ellipse(c, 70, 76, 3.5, 5, '#B85574');
    eyes(c, 50, 78, 56, 6);
    cheeks(c, 40, 88, 70);
  },
};
// 카드 앞면: 동물 얼굴과 이름 (아래쪽)
function faceTexture(a) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#F2C35B'; g.lineWidth = 14; g.strokeRect(7, 7, 242, 306);
  g.save(); g.translate(0, 18); g.scale(2, 2); DRAW[a.id](g); g.restore();
  g.fillStyle = '#6B4429'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `40px ${FONT}`;
  g.fillText(a.name, 128, 286);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // 카메라는 방주 쪽(북쪽) 위에서 아이들 쪽을 내려다본다. 뒤집혀 올라온 아래 면이 그쪽에서 바로 보이게 그대로 둔다
  return t;
}
// 카드 뒷면: 나무 무늬와 무지개 아래 방주
function backTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#5FA8D3'; g.fillRect(0, 0, 128, 160);
  g.strokeStyle = '#FFFDF7'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 152);
  const cols = ['#EF6461', '#F49A4C', '#F6D55C', '#7CC46A', '#5FA8D3', '#9B7FD1'];
  cols.forEach((col, i) => { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.arc(64, 96, 44 - i * 6, Math.PI, 0); g.stroke(); });
  g.fillStyle = '#A06E45';
  g.beginPath(); g.moveTo(22, 104); g.lineTo(106, 104); g.lineTo(94, 126); g.lineTo(34, 126); g.closePath(); g.fill();
  g.fillStyle = '#C99862'; g.fillRect(44, 88, 40, 16);
  g.fillStyle = '#EF6461'; g.beginPath(); g.moveTo(40, 88); g.lineTo(64, 74); g.lineTo(88, 88); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // 북쪽에서 내려다볼 때 바로 서 보이게 반 바퀴 돌린다
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI;
  return t;
}

// ---------- 방주와 탁자 ----------
export function buildArk(v) {
  const wood = toon('#A06E45'), dark = toon('#7A5233'), light = toon('#C99862'), roof = toon('#D2553F'), cream = toon('#FFF4DC');
  const g = new THREE.Group();
  // 배 몸통: 위에서 본 모양을 밀어 올린다 (앞뒤가 둥글게 뾰족하다). Shape의 y는 무리의 -z
  const L = 2.0, W = 0.78;
  const s = new THREE.Shape();
  s.moveTo(-L, 0);
  s.quadraticCurveTo(-L + 0.2, W, -L + 0.9, W);
  s.lineTo(L - 0.9, W);
  s.quadraticCurveTo(L - 0.2, W, L, 0);
  s.quadraticCurveTo(L - 0.2, -W, L - 0.9, -W);
  s.lineTo(-L + 0.9, -W);
  s.quadraticCurveTo(-L + 0.2, -W, -L, 0);
  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false, curveSegments: 8 });
  hullGeo.rotateX(-Math.PI / 2);
  // 아래로 갈수록 좁게
  const P = hullGeo.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 0.72 + 0.28 * clamp01(P.getY(i) / 1.0); P.setX(i, P.getX(i) * (0.9 + 0.1 * k)); P.setZ(i, P.getZ(i) * k); }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, [dark, wood]);
  hull.position.y = 0.05;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  // 뱃전 판자 줄
  for (const y of [0.35, 0.7]) g.add(mk(new THREE.BoxGeometry(L * 2 - 0.5, 0.05, W * 2 + 0.03), light, 0, y, 0));
  g.add(mk(new THREE.BoxGeometry(L * 2 - 0.3, 0.08, W * 2 - 0.1), light, 0, 1.06, 0));
  // 집: 창문과 빨간 지붕
  g.add(mk(new THREE.BoxGeometry(2.1, 0.85, 1.05), cream, 0, 1.52, 0));
  const roofGeo = new THREE.CylinderGeometry(0.01, 0.82, 0.6, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.scale(1.95, 1, 0.98);
  g.add(mk(roofGeo, roof, 0, 2.24, 0));
  for (const x of [-0.6, 0, 0.6]) {
    g.add(mk(new THREE.BoxGeometry(0.34, 0.3, 0.04), toon('#5FA8D3'), x, 1.56, 0.54));
    g.add(mk(new THREE.BoxGeometry(0.4, 0.05, 0.06), dark, x, 1.39, 0.55));
  }
  // 창밖을 내다보는 동물 친구: 기린 목과 사자 얼굴
  g.add(mk(new THREE.BoxGeometry(0.16, 0.9, 0.16), toon('#F2C35B'), 0.75, 2.25, 0.25));
  g.add(mk(new THREE.BoxGeometry(0.3, 0.2, 0.36), toon('#F2C35B'), 0.75, 2.75, 0.33));
  g.add(mk(new THREE.SphereGeometry(0.035, 6, 4), toon('#2E2A2A'), 0.68, 2.8, 0.5));
  g.add(mk(new THREE.SphereGeometry(0.035, 6, 4), toon('#2E2A2A'), 0.82, 2.8, 0.5));
  for (const sx of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), dark, 0.75 + sx * 0.08, 2.92, 0.3));
  // 비둘기 (지붕 위)
  const dove = new THREE.Group();
  dove.add(mk(new THREE.SphereGeometry(0.13, 10, 8), toon('#FFFFFF'), 0, 0, 0));
  dove.add(mk(new THREE.SphereGeometry(0.08, 10, 8), toon('#FFFFFF'), 0, 0.08, 0.12));
  const beak = mk(new THREE.ConeGeometry(0.03, 0.08, 6), toon('#F6A94C'), 0, 0.08, 0.22);
  beak.rotation.x = Math.PI / 2;
  dove.add(beak);
  dove.position.set(-0.55, 2.52, 0.1);
  g.add(dove);
  // 무지개 (방주 뒤)
  const cols = ['#EF6461', '#F49A4C', '#F6D55C', '#7CC46A', '#5FA8D3', '#9B7FD1'];
  cols.forEach((col, i) => {
    const arc = mk(new THREE.TorusGeometry(3.0 - i * 0.16, 0.09, 6, 40, Math.PI), toon(col), 0, 0.2, -1.2);
    arc.castShadow = false;
    g.add(arc);
  });
  for (const sx of [-1, 1]) g.add(mk(new THREE.SphereGeometry(0.55, 12, 8), toon('#FFFFFF'), sx * 2.6, 0.3, -1.2)); // 무지개 발 구름
  // 탁자와 긴 의자 (무리 기준: 방주 앞 +z)
  const tz = TABLE.z - ARK.z, sz = ARK_SEATS[0].z - ARK.z;
  g.add(mk(new THREE.BoxGeometry(TABLE.hw * 2, 0.08, TABLE.hd * 2), light, 0, TABLE.y - 0.04, tz));
  for (const sx of [-1, 1]) for (const s2 of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.1, TABLE.y - 0.08, 0.1), dark, sx * (TABLE.hw - 0.12), (TABLE.y - 0.08) / 2, tz + s2 * (TABLE.hd - 0.12)));
  g.add(mk(new THREE.BoxGeometry(1.8, 0.1, 0.36), wood, 0, 0.46, sz));
  for (const sx of [-0.75, 0.75]) g.add(mk(new THREE.BoxGeometry(0.1, 0.42, 0.3), dark, sx, 0.21, sz));
  // 표지판
  const sign = v.postSign('노아의 방주', 1.5);
  sign.position.set(-1.45, 0, sz + 0.25);
  g.add(sign);
  v.spot('ark', '노아의 방주 짝 맞추기', g, { x: ARK.x, z: ARK.z, rot: 0, door: 3.8, hw: 2.1, hd: 0.85 });
  v.addObstacleBox(TABLE.x, TABLE.z, TABLE.hw, TABLE.hd);
}

// =====================================================================
// 놀이
// =====================================================================
export function createArkGame({ v, ui, begin, stopAll, portrait, live, hub, onlineFriends, friendPicker, waitInvite, menuTok, myId, seatPose, SEAT_Y, onCelebrate }) {
  let faces = null, backTex = null;
  const textures = () => {
    if (!faces) { faces = ANIMALS.map(faceTexture); backTex = backTexture(); }
    return { faces, backTex };
  };
  const bestKey = (lv) => `ark.best.${myId() || 'me'}.${lv}`;
  const readBest = (lv) => { try { return JSON.parse(store.get(bestKey(lv)) || 'null'); } catch (e) { return null; } };
  const arkLevel = () => store.get('ark.level') || 'easy';

  function arkMenu() {
    const tok = menuTok.next();
    const friends = onlineFriends();
    const fmt = (b) => (b ? `내 최고 ${b.sec}초 · ${b.flips}번 뒤집기` : '아직 기록이 없어요');
    const body = h('div', { class: 'mem game' },
      h('section', { class: 'guide compact' },
        h('h3', {}, '짝 맞추기는 이렇게 해요'),
        h('ol', { class: 'guide-steps' },
          h('li', {}, h('b', {}, '두 장을 뒤집어요'), h('span', {}, '탁자 위 카드를 눌러 두 장을 뒤집어요.')),
          h('li', {}, h('b', {}, '같은 동물이면 짝!'), h('span', {}, '동물들은 하나님 말씀대로 둘씩 짝지어 방주에 들어갔어요(창세기 7장). 같은 동물 두 마리를 찾으면 짝이에요.')),
          h('li', {}, h('b', {}, '다르면 다시 엎어요'), h('span', {}, '어디에 무슨 동물이 있었는지 잘 기억해 두세요.')))),
      h('div', { class: 'sub-head' }, h('h3', {}, '혼자 하기'), h('p', {}, '얼마나 빨리 다 찾는지 재요')),
      h('div', { class: 'mode-pick levels' }, ARK_LEVELS.map(([lv, name, desc]) => h('button', {
        class: 'mode' + (lv === arkLevel() ? ' last' : ''), type: 'button', 'data-level': lv,
        onclick: () => { menuTok.next(); store.set('ark.level', lv); modal.close(); ark({ level: lv }); },
      }, h('b', {}, `${{ easy: '🐣', normal: '🐑', hard: '🦁' }[lv]} ${name}`), h('span', {}, `${desc} · ${fmt(readBest(lv))}`)))),
      h('div', { class: 'sub-head' }, h('h3', {}, '마을 친구와 하기'), h('p', {}, friends.length ? `${friends.length}명 · 카드 20장` : '')),
      friendPicker(friends, (f) => {
        modal.setTitle('노아의 방주 짝 맞추기');
        waitInvite(hub, f, 'ark', null, { setBody: (b) => modal.setBody(b), onBack: arkMenu }).then((s) => {
          if (!s) return;
          if (!menuTok.is(tok) || !modal.isOpen) { s.close(); return; }
          menuTok.next();
          modal.close();
          ark({ session: s });
        });
      }, '지금 마을에 있는 친구가 없어요. 친구가 들어오면 여기에 보여요.'));
    modal.open('노아의 방주 짝 맞추기', body, { cls: 'game-sheet', onClose: () => { if (menuTok.is(tok)) menuTok.next(); } });
  }

  function ark({ session = null, level = 'easy' } = {}) {
    stopAll();
    const { faces: FACES, backTex: BACK } = textures();
    const LV = session ? ARK_LEVELS[2] : (ARK_LEVELS.find((l) => l[0] === level) || ARK_LEVELS[0]);
    const [lvId, lvName, , COLS, ROWS] = LV;
    const N = COLS * ROWS;
    const grp = new THREE.Group();
    v.scene.add(grp);
    // 카드 (상자 하나: 위는 뒷면, 아래는 앞면. z축으로 반 바퀴 돌면 앞면이 위로 온다)
    const CW = 0.21, CD = 0.27, PX = 0.265, PZ = 0.33;
    const cardGeo = new THREE.BoxGeometry(CW, 0.014, CD);
    const side = toon('#FFFDF7');
    const backMat = new THREE.MeshToonMaterial({ map: BACK, gradientMap: toonGradient() });
    const faceMats = FACES.map((t) => new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() }));
    const glowGeo = new THREE.PlaneGeometry(CW + 0.05, CD + 0.05);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#7CC46A', transparent: true, opacity: 0.9 });
    const cardPos = (i) => {
      const cx = i % COLS, cz = Math.floor(i / COLS);
      return V(TABLE.x + (cx - (COLS - 1) / 2) * PX, TABLE.y + 0.008, TABLE.z + (cz - (ROWS - 1) / 2) * PZ);
    };
    let cards = [];
    function layDeck(deck) {
      for (const c of cards) { c.m.removeFromParent(); c.glow.removeFromParent(); }
      cards = deck.map((a, i) => {
        // 앞면 그림이 아이들 쪽(남쪽)에서 바로 보이게: 아래 면에 그리고 z축으로 뒤집는다
        const m = new THREE.Mesh(cardGeo, [side, side, backMat, faceMats[a], side, side]);
        m.castShadow = true;
        m.position.copy(cardPos(i));
        m.userData.i = i;
        grp.add(m);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(cardPos(i)).setY(TABLE.y + 0.002);
        glow.visible = false;
        grp.add(glow);
        return { a, m, glow, up: false, k: 0, done: false, hop: 0 };
      });
    }

    // 자리: 혼자거나 초대한 쪽은 왼쪽, 초대받은 쪽은 오른쪽
    const mine = session && !session.host ? ARK_SEATS[1] : ARK_SEATS[0];
    const theirs = mine === ARK_SEATS[0] ? ARK_SEATS[1] : ARK_SEATS[0];
    const meSt = { reach: 0, cheer: 0 }, opSt = { reach: 0, cheer: 0 };
    const pl = v.player;
    v.placePlayer(mine.x, mine.z, mine.rot, SEAT_Y);
    pl.pose = seatPose(meSt);
    if (session) v.pinRemote(session.peer, { x: theirs.x, y: SEAT_Y, z: theirs.z, rot: theirs.rot, pose: seatPose(opSt) });
    // 아이 머리 위 조금 앞에서 탁자를 내려다본다 (머리가 카드를 가리지 않게). 세로 화면은 더 높이, 더 곧게 내려다본다
    // 카드가 많으면 더 높이 올라간다. 탁자 가운데보다 조금 아이들 쪽을 보아서 카드가 화면 아래 단추에 가리지 않게 한다
    // 가로로 납작한 휴대폰 화면(높이 520px 아래)은 위아래 단추 사이 좁은 띠에 카드가 다 들어오게 더 높이 올라간다
    const tall = portrait(), short = !tall && innerHeight < 520;
    const far = tall ? 1.7 * Math.max(1, COLS / 4) : Math.max(1, Math.max(COLS / 4, ROWS / 3) * 0.95) * (short ? 1.75 : 1.08);
    // 거의 바로 위에서 내려다본다(마을 카메라는 84도까지 기운다). 의자에 앉은 아이들 머리는 화면 아래 바깥으로 빠진다
    // 방주 쪽(북쪽) 위에서 아이들 쪽을 내려다본다. 아이들은 카드 너머(화면 위쪽)에 앉아 있어서 머리나 팔이 카드를 가리지 않는다
    const look = V(TABLE.x, TABLE.y, TABLE.z + (tall ? -0.08 : short ? -0.3 : -0.05));
    const cam = { pos: V(TABLE.x, TABLE.y + 2.25 * far, look.z - 0.22 * far), look };
    const game = { cam, camSpeed: 2.4 };
    const oppName = session ? session.peerName : '';

    let g = null, peerReady = false;
    let meLabel = null, opLabel = null;
    const timeChip = h('span', { class: 'g-chip' });
    function deal(seedDeck) {
      if (seedDeck) return seedDeck;
      const pairs = N / 2;
      const pick = [...ANIMALS.keys()].sort(() => Math.random() - 0.5).slice(0, pairs);
      const d = [...pick, ...pick];
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      return d;
    }
    // 판마다 먼저 하는 사람을 바꾼다 (홀수 판은 초대한 쪽, 짝수 판은 초대받은 쪽)
    function newRound(round, deck) {
      g = { round, deck: deal(deck), open: [], busy: 0, n: 0, flips: 0, found: 0, score: { 1: 0, 2: 0 },
        me: session && !session.host ? 2 : 1, turn: round % 2 === 1 ? 1 : 2, over: false, start: 0, wantAgain: false, peerAgain: false, peerLeft: g ? g.peerLeft : false, queue: [], seen: new Map() };
      layDeck(g.deck);
      // 초대받은 친구가 놀이를 연 뒤('ready')에 카드를 보낸다. 그 전에는 뒤집지 않는다
      if (session && session.host && !session.bot) { if (peerReady) session.send('deal', { r: round, d: g.deck }); else g.waiting = true; }
      if (meLabel) { meLabel.remove(); meLabel = null; }
      if (opLabel) { opLabel.remove(); opLabel = null; }
      if (session) { meLabel = ui.label(''); opLabel = ui.label(''); drawScore(); }
      ui.setPanel(session ? null : timeChip);
      ui.panel.classList.add('ghost'); // 시간 표시는 누르는 것이 아니라서 아래 카드를 누를 수 있게 한다
      turnText();
      if (session && session.bot && g.turn !== g.me) botTurn();
    }
    function drawScore() {
      if (!session || !g) return;
      meLabel.textContent = `나 ${g.score[g.me]}쌍`;
      opLabel.textContent = `${oppName} ${g.score[g.me === 1 ? 2 : 1]}쌍`;
    }
    function turnText() {
      if (!g || g.over) return;
      if (g.waiting) { ui.say(`${josa(oppName, '이', '가')} 탁자에 앉기를 기다리고 있어요…`); ui.setMain('기다려요', { disabled: true }); return; }
      if (!session) {
        ui.say(g.flips ? '같은 동물 두 마리를 찾아요!' : `${lvName}: 카드 ${N}장이에요. 아무 카드나 눌러 뒤집어요!`);
        ui.setMain('뒤집기', { disabled: true });
        return;
      }
      if (g.turn === g.me) { ui.say(g.open.length ? '한 장 더 뒤집어요!' : '내 차례예요. 카드 두 장을 뒤집어요!'); ui.setMain('내 차례', { disabled: true }); }
      else { ui.say(`${josa(oppName, '의', '의')} 차례예요. 어디를 뒤집는지 잘 봐 두세요!`); ui.setMain('기다려요', { disabled: true }); }
    }
    // 카드 i를 뒤집는다 (who: 1 또는 2)
    function flip(i, who, fromNet = false) {
      if (!g || g.over || g.waiting || i < 0 || i >= N) return false;
      const c = cards[i];
      // 앞의 두 장을 보여 주는 동안 누른 것은 잠깐 미뤄 두었다가 뒤집는다
      if (g.busy > 0) { if (g.queue.length < 4) g.queue.push([i, who, fromNet]); return false; }
      if (c.done || c.up || g.open.length >= 2) return false;
      if (session && who !== g.turn) return false;
      if (!g.start) g.start = performance.now();
      c.up = true;
      g.open.push(i);
      g.flips++;
      g.n++;
      sfx.tick();
      (who === g.me ? meSt : opSt).reach = 1;
      if (session && session.bot) { g.seen.set(i, c.a); }
      if (session && !session.bot && who === g.me && !fromNet) session.send('flip', { r: g.round, n: g.n - 1, i });
      if (g.open.length === 2) {
        const [a, b] = g.open;
        if (cards[a].a === cards[b].a) g.busy = 0.55; // 짝: 잠깐 보여 준 뒤 남겨 둔다
        else g.busy = 1.05; // 다르면 조금 더 보여 준 뒤 엎는다
        g.judge = cards[a].a === cards[b].a ? 'match' : 'miss';
      } else turnText();
      return true;
    }
    function judge() {
      const [a, b] = g.open;
      const who = g.turn;
      g.open = [];
      if (g.judge === 'match') {
        for (const i of [a, b]) { cards[i].done = true; cards[i].glow.visible = true; cards[i].hop = 1; g.seen.delete(i); }
        g.found++;
        if (session) g.score[who]++;
        sfx.success();
        const nm = ANIMALS[cards[a].a].name;
        if (session) ui.banner(`${nm} 짝!`, who === g.me ? '한 번 더 뒤집어요' : `${josa(oppName, '이', '가')} 찾았어요`, 1200);
        else ui.banner(`${nm} 짝!`, `${g.found} / ${N / 2}쌍`, 1100);
        (who === g.me ? meSt : opSt).cheer = 0.7;
        drawScore();
        if (g.found === N / 2) { finish(); return; }
      } else {
        for (const i of [a, b]) cards[i].up = false;
        if (session) g.turn = g.turn === 1 ? 2 : 1;
      }
      turnText();
      if (session && session.bot && g.turn !== g.me) botTurn();
    }
    function finish() {
      g.over = true;
      const sec = Math.max(1, Math.round((performance.now() - g.start) / 1000));
      if (!session) {
        const best = readBest(lvId);
        const better = !best || sec < best.sec || (sec === best.sec && g.flips < best.flips);
        if (better) try { store.set(bestKey(lvId), JSON.stringify({ sec, flips: g.flips })); } catch (e) { /* 그대로 */ }
        ui.banner('다 찾았어요!', `${sec}초 · ${g.flips}번 뒤집기${better ? ' · 내 최고 기록!' : ''}`, 3600);
        ui.say(better && best ? `예전 기록은 ${best.sec}초였어요. 정말 빨라졌어요!` : '모든 동물이 짝을 찾았어요. 방주에 들어갈 준비 끝!');
        confetti(); onCelebrate();
        meSt.cheer = 2;
        ui.setMain('한 판 더', { onClick: () => newRound(g.round + 1) });
        return;
      }
      const m = g.score[g.me], o = g.score[g.me === 1 ? 2 : 1];
      if (m > o) { ui.banner('내가 이겼어요!', `${m} : ${o}`, 3600); confetti(); onCelebrate(); meSt.cheer = 2; }
      else if (m < o) { ui.banner(`${josa(oppName, '이', '가')} 이겼어요!`, `${m} : ${o} · 다음엔 꼭!`, 3600); sfx.ding(); opSt.cheer = 2; }
      else { ui.banner('비겼어요!', `${m} : ${o}`, 3600); sfx.ding(); }
      ui.say('모든 동물이 짝을 찾았어요!');
      drawAgain();
    }
    function drawAgain() {
      if (!g.over) return;
      if (g.peerLeft) { ui.setMain('나가기', { onClick: () => stopAll() }); return; }
      if (session.bot) { ui.setMain('한 판 더', { onClick: () => newRound(g.round + 1) }); return; }
      ui.setMain(g.peerAgain ? '좋아, 한 판 더!' : g.wantAgain ? '기다려요' : '한 판 더', {
        disabled: g.wantAgain, pulse: g.peerAgain,
        onClick: () => {
          g.wantAgain = true;
          session.send('again');
          if (g.peerAgain) rematch();
          else { ui.say(`${josa(oppName, '을', '를')} 기다리고 있어요…`); drawAgain(); }
        },
      });
    }
    // 한 판 더: 초대한 쪽이 새로 섞어 보내고, 초대받은 쪽은 카드가 올 때까지 기다린다
    function rematch() {
      if (session.host) newRound(g.round + 1);
      else { g.waitDeal = g.round + 1; ui.say('카드를 섞고 있어요…'); ui.setMain('기다려요', { disabled: true }); }
    }
    // 체험판 친구(봇): 본 카드를 어느 정도 기억해 두었다가 짝을 찾는다
    function botTurn() {
      const round = g.round;
      const step = () => {
        if (!live(game) || !g || g.over || g.round !== round || g.turn === g.me) return;
        if (g.busy > 0) { setTimeout(step, 300); return; }
        const hidden = cards.map((c, i) => (!c.done && !c.up ? i : -1)).filter((i) => i >= 0);
        let pick = -1;
        const mem = [...g.seen.entries()].filter(([i]) => hidden.includes(i) && Math.random() < 0.75);
        if (g.open.length === 1) {
          const a = cards[g.open[0]].a;
          const known = mem.find(([i, x]) => x === a && i !== g.open[0]);
          pick = known ? known[0] : hidden[Math.floor(Math.random() * hidden.length)];
        } else {
          const byA = new Map();
          for (const [i, x] of mem) { if (byA.has(x)) { pick = byA.get(x); break; } byA.set(x, i); }
          if (pick < 0) pick = hidden[Math.floor(Math.random() * hidden.length)];
        }
        flip(pick, g.turn);
        if (g.open.length === 1) setTimeout(step, 700);
      };
      setTimeout(step, 900);
    }

    if (session && !session.bot) {
      session.on('msg', (m) => {
        if (!live(game)) return;
        if (m.t === 'ready') {
          peerReady = true;
          if (session.host && g) { g.waiting = false; session.send('deal', { r: g.round, d: g.deck }); turnText(); }
        } else if (m.t === 'deal') {
          if (!Array.isArray(m.d) || m.d.length !== N || m.d.some((x) => !Number.isInteger(x) || x < 0 || x >= ANIMALS.length)) return;
          if (g && m.r <= g.round && !g.waitDeal) return;
          newRound(m.r, m.d);
        } else if (m.t === 'flip') {
          if (!g || m.r !== g.round || !Number.isInteger(m.i)) return;
          flip(m.i, g.me === 1 ? 2 : 1, true);
        } else if (m.t === 'again') {
          if (!g) return;
          g.peerAgain = true;
          if (g.wantAgain) rematch();
          else { ui.say(`${josa(oppName, '이', '가')} 한 판 더 하재요!`); drawAgain(); }
        }
      }).on('left', () => {
        if (!g || !live(game)) return;
        g.peerLeft = true;
        if (!g.over) g.over = true;
        ui.say(`${josa(oppName, '이', '가')} 놀이를 마쳤어요.`);
        v.unpinRemote(session.peer);
        ui.setMain('나가기', { onClick: () => stopAll() });
      });
    }

    game.onTap = (ray) => {
      if (!g || g.over) return;
      if (session && g.turn !== g.me) { ui.say(`${josa(oppName, '의', '의')} 차례예요. 조금만 기다려요!`); return; }
      const hit = ray.intersectObjects(cards.map((c) => c.m), false)[0];
      if (!hit) return;
      flip(hit.object.userData.i, session ? g.me : 1);
    };
    game.update = (dt, time) => {
      if (!g) return;
      if (g.busy > 0) {
        g.busy -= dt;
        if (g.busy <= 0) {
          g.busy = 0;
          judge();
          // 기다리는 동안 친구가 뒤집은 카드
          while (g.queue.length && !g.busy && !g.over) { const [i, w, fn] = g.queue.shift(); flip(i, w, fn); }
        }
      }
      for (const c of cards) {
        c.k += ((c.up || c.done ? 1 : 0) - c.k) * Math.min(1, dt * 12);
        const base = cardPos(c.m.userData.i);
        c.hop = Math.max(0, c.hop - dt * 1.6);
        c.m.position.set(base.x, base.y + Math.sin(c.k * Math.PI) * 0.06 + Math.sin(c.hop * Math.PI) * 0.08, base.z);
        c.m.rotation.z = c.k * Math.PI;
      }
      if (!session && g.start && !g.over) timeChip.textContent = `⏱ ${Math.floor((performance.now() - g.start) / 1000)}초 · ${g.flips}번 뒤집기`;
      else if (!session && !g.start) timeChip.textContent = '⏱ 0초';
      if (meLabel) ui.place(meLabel, V(mine.x, 0, mine.z), 1.35);
      if (opLabel) ui.place(opLabel, V(theirs.x, 0, theirs.z), 1.35);
    };
    game.busy = () => !!(g && g.busy > 0);
    game.isDone = (i) => !!(cards[i] && cards[i].done);
    game.state = () => g && { n: N, open: [...g.open], found: g.found, turn: g.turn, me: g.me, over: g.over, score: { ...g.score }, deck: [...g.deck], round: g.round };
    game.cardScreen = (i) => { const p = cardPos(i); const q = p.clone().project(v.camera); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (q.x * 0.5 + 0.5) * r.width, y: r.top + (-q.y * 0.5 + 0.5) * r.height }; };
    game.stop = () => {
      if (session && !session.closed) session.close();
      if (session) v.unpinRemote(session.peer);
      if (meLabel) meLabel.remove();
      if (opLabel) opLabel.remove();
      for (const mt of [backMat, ...faceMats, glowMat]) mt.dispose();
      cardGeo.dispose(); glowGeo.dispose();
      grp.removeFromParent();
      g = null;
    };
    begin('ark', session ? `노아의 방주 · ${josa(oppName, '과', '와')} 한 판` : `노아의 방주 · ${lvName}`, game);
    if (!session || session.host) newRound(1);
    else { ui.say('카드를 섞고 있어요…'); ui.setMain('기다려요', { disabled: true }); g = null; session.send('ready'); }
  }
  return { arkMenu, ark };
}
