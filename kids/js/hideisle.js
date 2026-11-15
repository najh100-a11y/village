// 진숲 어린이 마을 — 숨바꼭질 섬 (마을 섬 북쪽, 내 집 뒤로 나무 다리를 건넌다)
// 마을 섬만큼 넓은 섬이다. 가운데 마당에 큰 '술래 나무'가 있고, 숨을 곳 47군데가 세 겹 둘레(마당 둘레, 가운데 둘레, 바깥 둘레)에 흩어져 있다.
// 섬은 여섯 마당으로 나뉜다: 동쪽 골목(창고, 빨래, 상자, 나무통), 남동쪽 놀이터(놀이집, 터널, 텐트), 남서쪽 바닷가(뒤집힌 배, 텐트, 바위),
// 서쪽 숲속(나무 구멍, 덤불, 통나무 굴), 북쪽 언덕(흙 동굴, 바위), 북동쪽 농장(헛간, 짚더미, 닭장, 옥수수밭). 남쪽은 다리에서 들어오는 길이다.
// 숨을 곳 앞(섬 가운데 쪽)이 그곳에 숨거나 찾아보는 자리다. 술래는 나무 앞 발자국 자리에서 나무를 보고 눈을 가린다. 놀이 흐름은 js/hide.js가 맡는다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { HIDE_ISLE, makeIsle, makeTree } from './isles.js';
import { mergeStatic, mergeColored } from './merge.js';

const I = HIDE_ISLE;
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
// 숨을 곳 종류: 이름, 장애물 반지름(box면 네모 반너비·반깊이), 앞(문) 거리
export const HS_KINDS = {
  bush: { name: '덤불', r: 1.05, door: 1.75 },
  hay: { name: '짚더미', r: 0.95, door: 1.65 },
  barrel: { name: '큰 나무통', r: 0.72, door: 1.4 },
  crates: { name: '상자 더미', r: 1.05, door: 1.75 },
  log: { name: '통나무 굴', r: 1.0, door: 1.7, box: [1.15, 0.78] },
  rock: { name: '큰 바위', r: 1.05, door: 1.75 },
  tent: { name: '텐트', r: 1.1, door: 1.85 },
  cart: { name: '짚 수레', r: 1.05, door: 1.75 },
  laundry: { name: '이불 빨래', r: 0.5, door: 1.15 },
  cave: { name: '흙 동굴', r: 1.25, door: 1.95 },
  flowers: { name: '해바라기 밭', r: 1.0, door: 1.7 },
  playhouse: { name: '작은 놀이집', r: 1.15, door: 1.9 },
  woodpile: { name: '장작 더미', r: 1.0, door: 1.7 },
  tree: { name: '나무 구멍', r: 0.85, door: 1.55 },
  shed: { name: '작은 창고', r: 1.2, door: 1.85, box: [1.0, 0.9] },
  coop: { name: '닭장', r: 1.1, door: 1.8 },
  boat: { name: '뒤집힌 배', r: 1.1, door: 1.6, box: [1.35, 0.62] },
  tunnel: { name: '놀이 터널', r: 1.1, door: 1.55, box: [1.25, 0.62] },
  corn: { name: '옥수수밭', r: 1.15, door: 1.85 },
  barn: { name: '헛간', r: 2.3, door: 2.55, box: [2.2, 1.75] },
};
// 마당 이름 (각도: 동쪽 0, 남쪽 90). 가장 안쪽 둘레는 '마당'
const ZONES = [[345, 30, '골목'], [30, 82, '놀이터'], [82, 165, '바닷가'], [165, 238, '숲속'], [238, 296, '언덕'], [296, 345, '농장']];
export function zoneOf(deg) {
  const d = ((deg % 360) + 360) % 360;
  for (const [a, b, name] of ZONES) if (a < b ? d >= a && d < b : d >= a || d < b) return name;
  return '마당';
}
// 숨을 곳 47군데: 둘레 위 각도(도), 가운데에서 거리, 종류. 마당 둘레 9.5, 가운데 둘레 17.5, 바깥 둘레 25.5
const LAYOUT = [
  [0, 9.5, 'barrel'], [40, 9.5, 'flowers'], [135, 9.5, 'bush'], [170, 9.5, 'log'], [210, 9.5, 'bush'], [250, 9.5, 'rock'], [290, 9.5, 'hay'], [330, 9.5, 'crates'],
  [0, 17.5, 'laundry'], [24, 17.5, 'woodpile'], [48, 17.5, 'tunnel'], [72, 17.5, 'tent'], [120, 17.5, 'tent'], [144, 17.5, 'rock'], [168, 17.5, 'tree'],
  [192, 17.5, 'bush'], [216, 17.5, 'log'], [240, 17.5, 'tree'], [264, 17.5, 'cave'], [288, 17.5, 'rock'], [312, 17.5, 'hay'], [336, 17.5, 'cart'],
  [7.0, 25.5, 'shed'], [20.8, 25.5, 'barrel'], [34.7, 25.5, 'playhouse'], [48.5, 25.5, 'tunnel'], [62.4, 25.5, 'playhouse'], [76.2, 25.5, 'flowers'],
  [103.9, 25.5, 'boat'], [117.8, 25.5, 'tent'], [131.6, 25.5, 'boat'], [145.5, 25.5, 'bush'], [159.3, 25.5, 'rock'], [173.2, 25.5, 'tree'],
  [187.0, 25.5, 'bush'], [200.8, 25.5, 'tree'], [214.7, 25.5, 'woodpile'], [228.5, 25.5, 'tree'], [242.4, 25.5, 'bush'], [256.2, 25.5, 'cave'],
  [270.1, 25.5, 'rock'], [283.9, 25.5, 'tree'], [297.8, 25.5, 'corn'], [311.6, 25.5, 'barn'], [325.5, 25.5, 'coop'], [339.3, 25.5, 'corn'], [353.2, 25.5, 'shed'],
];
export const RINGS = [9.5, 17.5, 25.5]; // 숨을 곳 둘레
export const PATH_R = [13.5, 21.5]; // 둘레 길
// 이름은 '마당 이름 + 종류'. 같은 이름이 둘 넘으면 번호를 붙인다 (숲속 나무 구멍 1, 숲속 나무 구멍 2…)
const baseName = ([deg, r, kind]) => `${r < 12 ? '마당' : zoneOf(deg)} ${HS_KINDS[kind].name}`;
export const HS_SPOTS = LAYOUT.map((row, k) => {
  const [deg, r, kind] = row;
  const a = deg * D2R, dx = Math.cos(a), dz = Math.sin(a);
  const x = I.x + dx * r, z = I.z + dz * r;
  const K = HS_KINDS[kind];
  const base = baseName(row), same = LAYOUT.filter((q) => baseName(q) === base);
  const name = same.length > 1 ? `${base} ${same.indexOf(row) + 1}` : base;
  const rot = Math.atan2(-dx, -dz); // 앞(+z)이 섬 가운데를 본다
  return { k, kind, name, deg, ring: RINGS.indexOf(r), x, z, rot, door: K.door, dx, dz, door2: { x: x - dx * K.door, z: z - dz * K.door } };
});
export const hsSpot = (k) => HS_SPOTS[k] || null;
// 술래 나무와 술래가 서는 자리 (나무 남쪽, 나무를 본다)
export const HS_TREE = { x: I.x, z: I.z - 0.6, seekX: I.x, seekZ: I.z + 1.15, seekRot: Math.PI };
// 놀이를 시작하면 모이는 자리 (나무 둘레, 남쪽부터)
export function gatherPoint(i, n) {
  const a = Math.PI / 2 + ((i - (n - 1) / 2) * 0.4);
  return { x: I.x + Math.cos(a) * 3.8, z: I.z + Math.sin(a) * 3.8, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}

function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (g, w, h, d, c, x, y, z) => { const o = mk(new THREE.BoxGeometry(w, h, d), c, x, y, z); g.add(o); return o; };
const ball = (g, r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = mk(new THREE.SphereGeometry(r, 14, 10), c, x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
const cyl = (g, rt, rb, h, c, x, y, z, seg = 14) => { const o = mk(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z); g.add(o); return o; };

// ---------- 숨을 곳 모양 (앞 +z가 섬 가운데) ----------
function bush(g) {
  for (const [x, y, z, r, c] of [[-0.45, 0.55, 0.05, 0.72, '#4E9A45'], [0.42, 0.6, -0.08, 0.78, '#5AAB4E'], [0, 0.95, -0.2, 0.7, '#66B85A'], [0.05, 0.45, 0.4, 0.55, '#57A84C']]) ball(g, r, c, x, y, z);
  for (const [x, y, z, c] of [[-0.6, 0.95, 0.35, '#F7A1C4'], [0.5, 1.1, 0.3, '#FFFFFF'], [0.1, 1.45, 0.05, '#F7A1C4'], [-0.2, 0.7, 0.85, '#FFE08A']]) ball(g, 0.07, c, x, y, z);
}
function hay(g) {
  cyl(g, 0.82, 0.95, 0.9, '#E7C46A', 0, 0.45, 0, 16);
  const top = mk(new THREE.ConeGeometry(0.88, 0.75, 16), '#EFD07C', 0, 1.27, 0);
  g.add(top);
  for (const y of [0.25, 0.62]) { const band = mk(new THREE.TorusGeometry(0.9, 0.03, 6, 22), '#C59B45', 0, y, 0); band.rotation.x = Math.PI / 2; g.add(band); }
  for (let i = 0; i < 7; i++) { const a = i * 0.9; const s = mk(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), '#D7B055', Math.cos(a) * 0.86, 0.1, Math.sin(a) * 0.86); s.rotation.z = 0.5 * Math.cos(a * 2); g.add(s); }
}
function barrel(g) {
  cyl(g, 0.62, 0.62, 1.35, '#A8743F', 0, 0.68, 0, 18);
  for (const y of [0.18, 0.68, 1.18]) cyl(g, 0.64, 0.64, 0.07, '#5E5F66', 0, y, 0, 18);
  cyl(g, 0.66, 0.66, 0.06, '#C08A52', 0.06, 1.4, 0.1, 18).rotation.z = -0.18; // 살짝 열린 뚜껑
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; box(g, 0.02, 1.2, 0.05, '#8B5E34', Math.cos(a) * 0.62, 0.68, Math.sin(a) * 0.62).rotation.y = -a; }
}
function crates(g) {
  const plank = (x, y, z, s, c) => {
    box(g, s, s, s, c, x, y, z);
    for (const sx of [-1, 1]) box(g, 0.07, s + 0.01, 0.07, '#7A5233', x + sx * (s / 2 - 0.02), y, z + s / 2);
    const d = box(g, s * 1.25, 0.07, 0.04, '#7A5233', x, y, z + s / 2 + 0.01); d.rotation.z = 0.78;
  };
  plank(-0.48, 0.42, 0.05, 0.84, '#C8955C');
  plank(0.46, 0.38, -0.1, 0.76, '#B9844D');
  plank(-0.05, 1.18, -0.05, 0.7, '#D2A26A');
}
function log(g) {
  const L = 2.2;
  const shell = mk(new THREE.CylinderGeometry(0.72, 0.76, L, 18, 1, true), toon('#8A5A3B', { side: THREE.DoubleSide }), 0, 0.68, 0);
  shell.rotation.z = Math.PI / 2;
  g.add(shell);
  cyl(g, 0.5, 0.5, L - 0.02, '#3A2A22', 0, 0.68, 0, 14).rotation.z = Math.PI / 2; // 굴 안 어둠
  for (const sx of [-1, 1]) {
    const ring = mk(new THREE.RingGeometry(0.5, 0.74, 18), toon('#D9B07A', { side: THREE.DoubleSide }), sx * L / 2, 0.68, 0);
    ring.rotation.y = sx * Math.PI / 2;
    g.add(ring);
  }
  ball(g, 0.2, '#5AAB4E', -0.5, 1.38, 0.1, 1, 0.6, 1);
  ball(g, 0.14, '#66B85A', 0.35, 1.36, -0.15, 1, 0.6, 1);
  ball(g, 0.12, '#E85D4E', 0.75, 1.34, 0.2); // 버섯
  cyl(g, 0.03, 0.03, 0.12, '#FFF6E6', 0.75, 1.25, 0.2, 6);
}
function rock(g) {
  const r1 = mk(new THREE.DodecahedronGeometry(0.95, 0), '#9A9EA6', 0, 0.62, -0.05); r1.scale.set(1.2, 0.85, 1); r1.rotation.y = 0.6; g.add(r1);
  const r2 = mk(new THREE.DodecahedronGeometry(0.55, 0), '#AEB2BA', 0.75, 0.35, 0.35); r2.rotation.set(0.3, 1.1, 0); g.add(r2);
  ball(g, 0.18, '#6DBE5A', -0.6, 1.1, 0.2, 1.4, 0.4, 1); // 이끼
}
function tent(g) {
  const sh = new THREE.Shape();
  sh.moveTo(-1.05, 0); sh.lineTo(0, 1.55); sh.lineTo(1.05, 0); sh.lineTo(-1.05, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.9, bevelEnabled: false });
  geo.translate(0, 0, -0.95);
  g.add(mk(geo, '#E5675C'));
  for (const x of [-0.5, 0.5]) { const s = mk(new THREE.BoxGeometry(0.16, 1.2, 1.92), '#FFF4E6', x * 0.62, 0.62, 0); s.rotation.z = x > 0 ? -0.6 : 0.6; g.add(s); }
  // 앞 입구 (어두운 세모)와 걷어 올린 문
  const dsh = new THREE.Shape(); dsh.moveTo(-0.45, 0); dsh.lineTo(0, 0.95); dsh.lineTo(0.45, 0); dsh.lineTo(-0.45, 0);
  g.add(mk(new THREE.ShapeGeometry(dsh), '#4A2E2A', 0, 0.01, 0.96));
  cyl(g, 0.03, 0.03, 1.8, '#7A5233', 0, 0.9, 1.0, 6);
  ball(g, 0.08, '#FFE08A', 0, 1.82, 1.0);
}
function cart(g) {
  box(g, 1.7, 0.16, 1.05, '#B07F4E', 0, 0.62, 0);
  for (const sx of [-1, 1]) box(g, 1.7, 0.38, 0.08, '#9A6B3E', 0, 0.85, sx * 0.5);
  box(g, 0.08, 0.38, 1.05, '#9A6B3E', -0.82, 0.85, 0);
  for (const [x, z] of [[-0.45, 0.62], [-0.45, -0.62]]) {
    const w = mk(new THREE.TorusGeometry(0.42, 0.06, 6, 16), '#6B4429', x, 0.45, z); g.add(w);
    cyl(g, 0.06, 0.06, 0.1, '#6B4429', x, 0.45, z, 8).rotation.x = Math.PI / 2;
  }
  for (const sz of [-0.3, 0.3]) { const h = box(g, 1.0, 0.06, 0.06, '#9A6B3E', 1.25, 0.6, sz); h.rotation.z = -0.2; }
  ball(g, 0.78, '#E7C46A', -0.05, 1.05, 0, 1.05, 0.6, 0.66);
  ball(g, 0.5, '#EFD07C', 0.25, 1.35, 0.05, 1, 0.6, 0.8);
}
function laundry(g) {
  for (const sx of [-1, 1]) cyl(g, 0.06, 0.07, 2.2, '#8B5E3C', sx * 1.25, 1.1, -0.15, 8);
  cyl(g, 0.012, 0.012, 2.5, '#F5F0E6', 0, 2.1, -0.15, 4).rotation.z = Math.PI / 2;
  // 이불 둘 (땅 가까이까지 늘어진다), 빨래집게
  const q = (x, w, c1, c2) => {
    box(g, w, 1.9, 0.05, c1, x, 1.15, -0.15);
    for (let i = 0; i < 4; i++) box(g, w, 0.16, 0.055, c2, x, 0.5 + i * 0.42, -0.15);
    for (const px of [-w / 2 + 0.1, w / 2 - 0.1]) box(g, 0.04, 0.12, 0.08, '#E5675C', x + px, 2.08, -0.15);
  };
  q(-0.55, 1.05, '#8EC5F0', '#FFFFFF');
  q(0.58, 1.0, '#F6C26B', '#F08A5D');
}
function cave(g) {
  const m = mk(new THREE.SphereGeometry(1.35, 20, 12, 0, TAU, 0, Math.PI / 2), '#7FB860', 0, 0, -0.1);
  m.scale.set(1.15, 0.95, 1);
  g.add(m);
  const dsh = new THREE.Shape();
  dsh.moveTo(-0.42, 0); dsh.lineTo(-0.42, 0.55); dsh.absarc(0, 0.55, 0.42, Math.PI, 0, true); dsh.lineTo(0.42, 0); dsh.lineTo(-0.42, 0);
  g.add(mk(new THREE.ShapeGeometry(dsh, 12), '#3A2A22', 0, 0.01, 1.2));
  for (const [x, y, z] of [[-0.6, 0.12, 1.25], [0.62, 0.1, 1.22], [-0.35, 1.0, 0.85], [0.55, 0.85, 0.9]]) {
    const s = mk(new THREE.DodecahedronGeometry(0.16, 0), '#9A9EA6', x, y, z); s.rotation.set(x, y, 0); g.add(s);
  }
  ball(g, 0.1, '#F7A1C4', -0.3, 1.25, 0.3); ball(g, 0.1, '#FFE08A', 0.4, 1.15, 0.5);
}
function flowers(g) {
  const pts = [[-0.55, 0.1], [0, -0.35], [0.55, 0.05], [-0.25, 0.45], [0.3, 0.45], [0.05, 0.05], [-0.6, -0.4], [0.6, -0.4]];
  pts.forEach(([x, z], i) => {
    const hgt = 1.45 + (i % 3) * 0.22;
    cyl(g, 0.035, 0.05, hgt, '#4E9A45', x, hgt / 2, z, 6);
    for (const s of [-1, 1]) ball(g, 0.16, '#5AAB4E', x + s * 0.12, hgt * 0.55, z, 1, 0.25, 0.6);
    const head = mk(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14), '#F6C445', x, hgt + 0.05, z + 0.04);
    head.rotation.x = 1.25; g.add(head);
    const mid = mk(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), '#7A4E2D', x, hgt + 0.08, z + 0.08);
    mid.rotation.x = 1.25; g.add(mid);
  });
  ball(g, 0.75, '#5AAB4E', 0, 0.35, 0, 1.3, 0.5, 1.1);
}
function playhouse(g) {
  box(g, 1.7, 1.25, 1.5, '#F3E3C3', 0, 0.63, -0.05);
  const sh = new THREE.Shape(); sh.moveTo(-1.05, 0); sh.lineTo(0, 0.8); sh.lineTo(1.05, 0); sh.lineTo(-1.05, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: false });
  roof.translate(0, 0, -0.95);
  g.add(mk(roof, '#4FA36C', 0, 1.25, 0));
  box(g, 0.56, 0.9, 0.05, '#8B5E3C', -0.3, 0.46, 0.71); // 문 (살짝 열림)
  box(g, 0.5, 0.86, 0.02, '#2E2A2A', -0.3, 0.45, 0.705);
  box(g, 0.42, 0.36, 0.04, '#A8D8F0', 0.45, 0.8, 0.71);
  for (const sx of [-1, 1]) box(g, 0.05, 0.4, 0.05, '#FFFFFF', 0.45 + sx * 0.0, 0.8, 0.73);
  box(g, 0.42, 0.04, 0.05, '#FFFFFF', 0.45, 0.8, 0.73);
  ball(g, 0.2, '#F7A1C4', 0.5, 0.15, 0.85, 1, 0.6, 1); // 꽃 화분
}
// 장작 더미: 통나무를 세 줄로 쌓고 끈으로 묶었다
function woodpile(g) {
  const rows = [[4, 0.22, 0], [3, 0.6, 0.0], [2, 0.98, 0]];
  for (const [n, y] of rows) for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.46;
    const w = mk(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 10), '#9A6B3E', x, y, 0);
    w.rotation.x = Math.PI / 2; g.add(w);
    const end = mk(new THREE.CircleGeometry(0.2, 10), '#E2B97E', x, y, 0.76); g.add(end);
  }
  for (const z of [-0.4, 0.4]) { const band = mk(new THREE.TorusGeometry(0.75, 0.025, 6, 20, Math.PI), '#5E4632', 0, 0.2, z); g.add(band); }
  for (const sx of [-1, 1]) cyl(g, 0.06, 0.06, 1.3, '#7A5233', sx * 1.05, 0.65, 0, 6);
}
// 나무 구멍: 굵은 고목 앞쪽에 아이 하나 들어갈 어두운 구멍, 위에 둥근 잎
function tree(g) {
  cyl(g, 0.72, 0.92, 2.8, '#7E5236', 0, 1.4, 0, 14);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.6; const r = mk(new THREE.CylinderGeometry(0.1, 0.22, 0.9, 6), '#7E5236', Math.cos(a) * 0.85, 0.16, Math.sin(a) * 0.85); r.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(r); }
  const hole = mk(new THREE.CircleGeometry(0.4, 16), '#2A1E18', 0, 0.85, 0.885); hole.scale.set(0.85, 1.45, 1); g.add(hole);
  const lip = mk(new THREE.TorusGeometry(0.4, 0.06, 6, 18), '#5E3B25', 0, 0.85, 0.88); lip.scale.set(0.85, 1.45, 1); g.add(lip);
  for (const [x, y, z, r, c] of [[0, 3.4, 0, 1.7, '#4E9A45'], [1.1, 3.0, 0.3, 1.1, '#5AAB4E'], [-1.15, 3.1, -0.2, 1.15, '#66B85A'], [0.1, 4.2, -0.2, 1.15, '#5AAB4E']]) ball(g, r, c, x, y, z, 1, 0.8, 1);
}
// 작은 창고: 판자 벽, 함석지붕, 반쯤 열린 문
function shed(g) {
  box(g, 2.0, 1.7, 1.8, '#C9874E', 0, 0.85, 0);
  for (let i = 0; i < 5; i++) box(g, 2.02, 0.05, 1.82, '#A86E3C', 0, 0.2 + i * 0.34, 0);
  const sh = new THREE.Shape(); sh.moveTo(-1.2, 0); sh.lineTo(0, 0.85); sh.lineTo(1.2, 0); sh.lineTo(-1.2, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: 2.1, bevelEnabled: false });
  roof.translate(0, 0, -1.05);
  g.add(mk(roof, '#7F8A96', 0, 1.7, 0));
  box(g, 0.8, 1.3, 0.04, '#2E2420', 0.2, 0.65, 0.905); // 문 안 어둠
  const a = 0.7;
  box(g, 0.78, 1.3, 0.06, '#8B5E3C', 0.6 - 0.39 * Math.cos(a), 0.65, 0.93 + 0.39 * Math.sin(a)).rotation.y = a;
  box(g, 0.5, 0.4, 0.04, '#A8D8F0', -0.55, 1.1, 0.905);
}
// 닭장: 다리 위 작은 집, 경사로, 암탉 둘
function coop(g) {
  for (const [x, z] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) cyl(g, 0.06, 0.06, 0.5, '#7A5233', x, 0.25, z, 6);
  box(g, 1.7, 1.0, 1.3, '#F2E6CF', 0, 1.0, 0);
  const sh = new THREE.Shape(); sh.moveTo(-1.0, 0); sh.lineTo(0, 0.6); sh.lineTo(1.0, 0); sh.lineTo(-1.0, 0);
  const roof = new THREE.ExtrudeGeometry(sh, { depth: 1.55, bevelEnabled: false });
  roof.translate(0, 0, -0.775);
  g.add(mk(roof, '#C8553D', 0, 1.5, 0));
  box(g, 0.45, 0.55, 0.04, '#2E2420', 0.35, 0.85, 0.66);
  box(g, 0.4, 0.05, 1.0, '#A06E45', 0.35, 0.33, 1.05).rotation.x = 0.5;
  for (const [x, z, ry] of [[-0.55, 0.95, 0.4], [-1.05, 0.35, -0.6]]) {
    const hen = new THREE.Group();
    ball(hen, 0.2, '#FFFDF7', 0, 0.2, 0, 1.15, 0.9, 0.9);
    ball(hen, 0.12, '#FFFDF7', 0.17, 0.38, 0);
    ball(hen, 0.05, '#E5675C', 0.18, 0.5, 0);
    const bk = mk(new THREE.ConeGeometry(0.035, 0.09, 6), '#F6A03C', 0.3, 0.38, 0); bk.rotation.z = -Math.PI / 2; hen.add(bk);
    hen.position.set(x, 0, z); hen.rotation.y = ry;
    g.add(hen);
  }
}
// 뒤집힌 배: 앞쪽이 돌에 걸려 살짝 들려 있어 그 밑이 어둡다
function boat(g) {
  const hull = mk(new THREE.SphereGeometry(1, 20, 8, 0, TAU, 0, Math.PI / 2), '#3E7CB1', 0, 0.1, 0);
  hull.scale.set(1.4, 0.72, 0.66); hull.rotation.x = -0.22;
  g.add(hull);
  box(g, 2.4, 0.08, 0.1, '#2B5C88', 0, 0.8, -0.16).rotation.x = -0.22;
  box(g, 1.6, 0.24, 0.02, '#221A18', 0, 0.12, 0.6);
  const st = mk(new THREE.DodecahedronGeometry(0.2, 0), '#9A9EA6', 0.95, 0.12, 0.42); g.add(st);
  box(g, 0.08, 0.05, 1.6, '#B07F4E', -1.55, 0.04, 0.0);
  box(g, 0.22, 0.04, 0.45, '#B07F4E', -1.55, 0.04, 0.95);
}
// 놀이 터널: 빨강·노랑·파랑 천 터널, 가운데 동그란 창
function tunnel(g) {
  const cols = ['#E5675C', '#F6C445', '#5BA3E0'];
  for (let i = 0; i < 3; i++) {
    const seg = mk(new THREE.CylinderGeometry(0.62, 0.62, 0.8, 18, 1, true), toon(cols[i], { side: THREE.DoubleSide }), (i - 1) * 0.8, 0.62, 0);
    seg.rotation.z = Math.PI / 2;
    g.add(seg);
  }
  cyl(g, 0.5, 0.5, 2.38, '#2E2A2A', 0, 0.62, 0, 14).rotation.z = Math.PI / 2;
  for (const x of [-1.2, -0.4, 0.4, 1.2]) { const h = mk(new THREE.TorusGeometry(0.63, 0.045, 6, 20), '#FFFDF7', x, 0.62, 0); h.rotation.y = Math.PI / 2; g.add(h); }
  g.add(mk(new THREE.CircleGeometry(0.2, 14), '#2E2A2A', 0, 0.72, 0.625));
}
// 옥수수밭: 아이 키보다 큰 옥수숫대가 빽빽하다
function corn(g) {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 3; iz++) {
    const x = (ix - 1.5) * 0.62 + (rnd() - 0.5) * 0.2, z = (iz - 1) * 0.62 + (rnd() - 0.5) * 0.2;
    const h = 2.0 + rnd() * 0.5;
    cyl(g, 0.035, 0.06, h, '#6FA84A', x, h / 2, z, 6);
    for (let k = 0; k < 3; k++) { const a = rnd() * TAU; ball(g, 0.3, k % 2 ? '#7DBA55' : '#6FA84A', x + Math.cos(a) * 0.18, h * (0.35 + k * 0.2), z + Math.sin(a) * 0.18, 1, 0.12, 0.35).rotation.y = a; }
    g.add(mk(new THREE.ConeGeometry(0.1, 0.3, 6), '#E7C46A', x, h + 0.12, z));
    if (rnd() < 0.6) ball(g, 0.09, '#F6C445', x + 0.08, h * 0.55, z + 0.06, 1, 2.2, 1);
  }
  ball(g, 0.9, '#5AAB4E', 0, 0.2, 0, 1.5, 0.3, 1.2);
}
// 헛간: 빨간 벽, 꺾인 지붕, 한쪽 문이 열려 있다
function barn(g) {
  const W = 4.4, D = 3.5, H = 2.4;
  box(g, W, H, D, '#C8553D', 0, H / 2, 0);
  const P = [[-2.2, 0], [-1.85, 1.0], [0, 1.65], [1.85, 1.0], [2.2, 0]];
  const sh = new THREE.Shape();
  P.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.lineTo(P[0][0], P[0][1]);
  const gab = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false });
  gab.translate(0, 0, -D / 2);
  g.add(mk(gab, '#C8553D', 0, H, 0));
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(a) * 0.07, ny = Math.cos(a) * 0.07;
    box(g, L + 0.22, 0.12, D + 0.4, '#5E4A44', (x0 + x1) / 2 + nx, H + (y0 + y1) / 2 + ny, 0).rotation.z = a;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.14, H, 0.14, '#FFFDF7', sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02));
  // 큰 문 둘: 왼쪽은 닫혀 있고(하얀 X), 오른쪽은 열려 안이 어둡다
  box(g, 2.1, 2.0, 0.04, '#2A1E1A', 0, 1.0, D / 2 + 0.01);
  box(g, 1.02, 2.0, 0.06, '#B8473A', -0.52, 1.0, D / 2 + 0.03);
  for (const r of [0.95, -0.95]) box(g, 1.3, 0.08, 0.04, '#FFFDF7', -0.52, 1.0, D / 2 + 0.07).rotation.z = r * 0.95;
  const a = 1.1;
  box(g, 1.02, 2.0, 0.06, '#B8473A', 1.05 - 0.51 * Math.cos(a), 1.0, D / 2 + 0.03 + 0.51 * Math.sin(a)).rotation.y = a;
  box(g, 2.3, 0.1, 0.08, '#FFFDF7', 0, 2.05, D / 2 + 0.04);
  box(g, 0.7, 0.6, 0.04, '#2A1E1A', 0, H + 0.6, D / 2 + 0.01);
  box(g, 0.82, 0.08, 0.06, '#FFFDF7', 0, H + 0.92, D / 2 + 0.03);
  box(g, 0.82, 0.08, 0.06, '#FFFDF7', 0, H + 0.28, D / 2 + 0.03);
}
const BUILD = { bush, hay, barrel, crates, log, rock, tent, cart, laundry, cave, flowers, playhouse, woodpile, tree, shed, coop, boat, tunnel, corn, barn };
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });

// 술래 나무: 굵은 줄기와 뿌리, 세 겹 둥근 잎
function seekerTree() {
  const g = new THREE.Group();
  const bark = toon('#7E5236'), leaf = ['#4E9A45', '#5AAB4E', '#66B85A'];
  g.add(mk(new THREE.CylinderGeometry(0.42, 0.62, 3.4, 12), bark, 0, 1.7, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; const r = mk(new THREE.CylinderGeometry(0.1, 0.2, 1.0, 6), bark, Math.cos(a) * 0.62, 0.18, Math.sin(a) * 0.62); r.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(r); }
  for (const [x, z, a] of [[0.55, 0.1, -0.9], [-0.5, -0.15, 0.95]]) { const b = mk(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 8), bark, x, 3.5, z); b.rotation.z = a; g.add(b); }
  for (const [x, y, z, r, k] of [[0, 4.4, 0, 2.3, 0], [1.4, 3.9, 0.4, 1.5, 1], [-1.5, 3.95, -0.3, 1.55, 2], [0.2, 5.4, -0.3, 1.6, 1], [-0.4, 4.1, 1.3, 1.3, 2], [0.5, 4.2, -1.4, 1.3, 0]]) ball(g, r, leaf[k], x, y, z, 1, 0.82, 1);
  // 술래가 이마를 대는 줄기 앞 작은 표시 (하얀 손 그림 대신 동그란 나무 판)
  const plate = mk(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), '#F3E3C3', 0, 1.5, 0.6);
  plate.rotation.x = Math.PI / 2;
  g.add(plate);
  return g;
}

// 숨바꼭질 섬을 짓는다. 돌려주는 것: { spots: [{ g, sp }], tree, update(dt, t), shake(k, s), rustle(k), puff(k), setRings(mode, checked) }
export function buildHideIsle(v, { signMesh } = {}) {
  const scene = v.scene;
  const ang = (deg) => deg * D2R;
  makeIsle(scene, I, {
    layer: 4,
    draw: (ctx, px, u) => {
      const P = (deg, r) => [px(Math.cos(ang(deg)) * r), px(Math.sin(ang(deg)) * r)];
      // 바닷가 모래 (남서쪽 바깥)
      ctx.fillStyle = '#EED9A6';
      ctx.beginPath(); ctx.arc(px(0), px(0), 31 * u, ang(84), ang(166)); ctx.arc(px(0), px(0), 23.2 * u, ang(166), ang(84), true); ctx.fill();
      ctx.fillStyle = '#F3E2B4';
      for (let i = 0; i < 40; i++) { const [x, y] = P(86 + i * 2, 24 + (i % 3)); ctx.beginPath(); ctx.arc(x, y, (0.6 + (i % 4) * 0.25) * u, 0, TAU); ctx.fill(); }
      // 숲속 짙은 풀, 언덕 둔덕
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#6DAE4A';
      ctx.beginPath(); ctx.arc(px(0), px(0), 29 * u, ang(166), ang(238)); ctx.arc(px(0), px(0), 15 * u, ang(238), ang(166), true); ctx.fill();
      ctx.fillStyle = '#A3D27A';
      for (const [d, r, k] of [[246, 20.5, 2.6], [262, 27, 2.2], [278, 20.6, 2.4], [292, 27.2, 1.8], [252, 13.2, 1.6]]) { const [x, y] = P(d, r); ctx.beginPath(); ctx.arc(x, y, k * u, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      // 농장 밭이랑
      ctx.strokeStyle = '#B58F5E'; ctx.lineWidth = 0.35 * u;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(px(0), px(0), (19.2 + k * 0.55) * u, ang(300), ang(342)); ctx.stroke(); }
      // 놀이터 모래판
      ctx.fillStyle = '#EED9A6';
      { const [x, y] = P(58, 21.5); ctx.beginPath(); ctx.ellipse(x, y, 3.2 * u, 2.2 * u, ang(58 + 90), 0, TAU); ctx.fill(); }
      // 길: 다리에서 나무까지, 둘레 길 둘
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#E9D2A6';
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.moveTo(px(0), px(I.r + 1)); ctx.lineTo(px(0), px(3.5)); ctx.stroke();
      ctx.lineWidth = 1.7 * u;
      for (const r of PATH_R) { ctx.beginPath(); ctx.arc(px(0), px(0), r * u, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#D9C9A8';
      ctx.beginPath(); ctx.arc(px(0), px(0), 4.5 * u, 0, TAU); ctx.fill(); // 나무 둘레 마당
      ctx.strokeStyle = '#C9B78F'; ctx.lineWidth = 0.14 * u;
      ctx.beginPath(); ctx.arc(px(0), px(0), 4.5 * u, 0, TAU); ctx.stroke();
      // 꽃밭 점들
      let s = 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 420; i++) {
        const a = rnd() * TAU, r = 5 + rnd() * 23;
        ctx.fillStyle = ['#F7A1C4', '#FFFFFF', '#FFE08A', '#B9A3F0'][i % 4];
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px(Math.cos(a) * r), px(Math.sin(a) * r), 0.09 * u, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  });
  // 술래 나무
  const tree = seekerTree();
  mergeStatic(tree);
  tree.position.set(HS_TREE.x, 0, HS_TREE.z);
  tree.userData.pick = { type: 'building', id: 'hs_tree' };
  scene.add(tree);
  v.pickRoots.push(tree);
  const tf = v.makeFadeable(tree, HS_TREE.x, HS_TREE.z, 2.4);
  tf.near = 2.6;
  v.addObstacleCircle(HS_TREE.x, HS_TREE.z, 0.72, true);
  v.doors.push({ id: 'hs_tree', name: '술래 나무', pos: new THREE.Vector3(HS_TREE.seekX, 0, HS_TREE.seekZ + 0.35), group: tree });
  // 술래가 서는 발자국 자리
  const foot = new THREE.Group();
  for (const sx of [-1, 1]) { const f = mk(new THREE.CircleGeometry(0.13, 12), '#B9A27A', sx * 0.16, 0.012, 0); f.rotation.x = -Math.PI / 2; f.scale.set(1, 1.6, 1); foot.add(f); }
  foot.position.set(HS_TREE.seekX, 0, HS_TREE.seekZ + 0.05);
  mergeStatic(foot);
  scene.add(foot);
  // 술래 나무 팻말과 섬 들어오는 곳 표지판
  if (signMesh) {
    const sg = new THREE.Group();
    sg.add(mk(new THREE.BoxGeometry(0.1, 1.3, 0.1), '#8B5E3C', 0, 0.65, 0));
    const s = signMesh('술래 나무', 1.25, { bg: '#FFFDF7', fg: '#3F7A4A', border: '#5DB760', sub: '숨바꼭질 하는 곳' });
    s.position.set(0, 1.45, 0.06);
    sg.add(s);
    sg.position.set(I.x + 2.3, 0, I.z + 1.9);
    sg.rotation.y = -0.35;
    mergeStatic(sg);
    scene.add(sg);
    v.addObstacleCircle(I.x + 2.3, I.z + 1.9, 0.12);
    const en = new THREE.Group();
    en.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), '#8B5E3C', -1.3, 0.95, 0));
    en.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), '#8B5E3C', 1.3, 0.95, 0));
    const es = signMesh('숨바꼭질 섬', 2.7, { bg: '#5DB760', fg: '#FFFDF7', border: '#3F7A4A' });
    es.position.set(0, 1.95, 0);
    en.add(es);
    en.position.set(I.x, 0, I.z + I.walk - 1.3);
    mergeStatic(en);
    scene.add(en);
    v.addObstacleCircle(I.x - 1.3, I.z + I.walk - 1.3, 0.12);
    v.addObstacleCircle(I.x + 1.3, I.z + I.walk - 1.3, 0.12);
  }
  // 숨을 곳 47군데 (흔들 수 있게 그룹마다 따로 두고, 색만 다른 부품은 하나로 합친다)
  const spots = HS_SPOTS.map((sp) => {
    const g = new THREE.Group();
    BUILD[sp.kind](g);
    mergeColored(g, VC);
    v.spot(`hs_${sp.k}`, sp.name, g, { x: sp.x, z: sp.z, rot: sp.rot, door: sp.door });
    const K = HS_KINDS[sp.kind];
    const c = Math.cos(sp.rot), s = Math.sin(sp.rot);
    if (sp.kind === 'laundry') { // 빨랫줄 기둥 둘만 막는다 (이불 뒤로 돌아갈 수 있다)
      for (const sx of [-1, 1]) v.addObstacleCircle(sp.x + sx * 1.25 * c - 0.15 * s, sp.z - sx * 1.25 * s - 0.15 * c, 0.12);
      v.addObstacleBox(sp.x - 0.15 * s, sp.z - 0.15 * c, 1.05, 0.12, sp.rot);
    } else if (K.box) v.addObstacleBox(sp.x, sp.z, K.box[0], K.box[1], sp.rot);
    else v.addObstacleCircle(sp.x, sp.z, K.r, true);
    if (sp.kind === 'barn' || sp.kind === 'shed' || sp.kind === 'tree') v.makeFadeable(g, sp.x, sp.z, sp.kind === 'barn' ? 2.6 : 1.5);
    return { sp, g, base: { x: g.rotation.x, z: g.rotation.z }, wob: 0, wobK: 0 };
  });
  // 땅의 둥근 표시 (놀이 중에만 보인다: 숨는 동안 노랑, 찾을 때는 찾아본 곳만 회색). 한 번에 그린다
  const ringGeo = new THREE.RingGeometry(0.84, 1, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, HS_SPOTS.length);
  rings.frustumCulled = false;
  rings.renderOrder = 2;
  rings.visible = false;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const ringAt = (k, on) => {
    const sp = HS_SPOTS[k], R = HS_KINDS[sp.kind].r + 0.45;
    m4.makeScale(on ? R : 0.0001, 1, on ? R : 0.0001).setPosition(sp.x, 0.03, sp.z);
    rings.setMatrixAt(k, m4);
  };
  HS_SPOTS.forEach((sp) => { ringAt(sp.k, false); rings.setColorAt(sp.k, col.set('#FFE08A')); });
  scene.add(rings);
  // 꾸미기: 숲속은 나무가 빽빽하고, 바닷가에는 야자나무, 농장에는 울타리, 길가에는 등불
  // 점 (x, z)에서 선분 (ax, az)–(bx, bz)까지 거리
  const segDist = (x, z, ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - ax - vx * t, z - az - vz * t);
  };
  const decoOk = (x, z, pad) => {
    for (const sp of HS_SPOTS) {
      const K = HS_KINDS[sp.kind];
      const R = K.box ? Math.hypot(K.box[0], K.box[1]) : K.r;
      if (Math.hypot(x - sp.x, z - sp.z) < R + pad) return false;
      if (Math.hypot(x - sp.door2.x, z - sp.door2.z) < pad + 0.9) return false;
      // 숨은 아이의 카메라(숨은 곳 뒤 위)에서 숨은 곳 앞까지 보이는 길은 비워 둔다
      if (segDist(x, z, sp.x - sp.dx * 3, sp.z - sp.dz * 3, sp.x + sp.dx * 5.5, sp.z + sp.dz * 5.5) < 2.0) return false;
    }
    const lx = x - I.x, lz = z - I.z, r = Math.hypot(lx, lz);
    if (r < 6 || r > 28) return false;
    if (Math.abs(lx) < 2.4 && lz > 0) return false; // 다리에서 나무까지 가는 길
    for (const pr of PATH_R) if (Math.abs(r - pr) < 1.35) return false;
    return true;
  };
  const decor = new THREE.Group(), placed = [];
  let seed = 29;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const plant = (from, to, rMin, rMax, n, make, gap = 2.8, pad = 1.6, obsR = 0.42) => {
    for (let tries = 0, got = 0; tries < n * 60 && got < n; tries++) {
      const d = from + rnd() * (to - from), r = rMin + rnd() * (rMax - rMin);
      const x = I.x + Math.cos(ang(d)) * r, z = I.z + Math.sin(ang(d)) * r;
      if (!decoOk(x, z, pad) || placed.some((q) => Math.hypot(q.x - x, q.z - z) < gap)) continue;
      const o = make(got);
      o.position.set(x, 0, z);
      o.rotation.y = rnd() * TAU;
      decor.add(o);
      placed.push({ x, z });
      if (obsR) v.addObstacleCircle(x, z, obsR);
      got++;
    }
  };
  const round = (k) => makeTree('round', 0.78 + (k % 4) * 0.1);
  plant(166, 238, 7, 28, 24, round, 2.6); // 숲속
  plant(84, 166, 23.5, 28, 7, () => makeTree('palm', 0.9), 3.2, 1.6, 0.3); // 바닷가
  plant(238, 296, 7, 28, 6, round, 3.4); // 언덕
  plant(296, 345, 7, 17, 3, round, 3.4); // 농장 안쪽
  plant(345, 390, 7, 28, 4, round, 3.4); // 골목
  plant(30, 84, 7, 28, 5, round, 3.4); // 놀이터
  // 언덕의 작은 돌
  plant(238, 296, 7, 28, 7, () => { const o = mk(new THREE.DodecahedronGeometry(0.32, 0), '#A7ABB2'); o.position.y = 0.18; const gg = new THREE.Group(); gg.add(o); return gg; }, 1.6, 1.2, 0.3);
  // 농장 울타리 (바깥 둘레)
  for (let d = 300; d < 342; d += 4) {
    const a0 = ang(d), a1 = ang(d + 4), R = 28.2;
    const x0 = I.x + Math.cos(a0) * R, z0 = I.z + Math.sin(a0) * R, x1 = I.x + Math.cos(a1) * R, z1 = I.z + Math.sin(a1) * R;
    const f = new THREE.Group(), L = Math.hypot(x1 - x0, z1 - z0);
    f.add(mk(new THREE.BoxGeometry(0.1, 0.9, 0.1), '#8B5E3C', -L / 2, 0.45, 0));
    for (const y of [0.35, 0.7]) f.add(mk(new THREE.BoxGeometry(L, 0.08, 0.05), '#C99862', 0, y, 0));
    f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    f.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    decor.add(f);
    v.addObstacleBox(f.position.x, f.position.z, L / 2, 0.08, f.rotation.y);
  }
  mergeStatic(decor);
  scene.add(decor);
  // 등불: 둘레 길 안쪽 가장자리를 따라
  const lamps = new THREE.Group();
  for (const [r, n, off] of [[12.4, 8, 22], [20.4, 10, 9]]) for (let k = 0; k < n; k++) {
    for (const nudge of [0, 4, -4, 8, -8]) {
      const d = off + (k * 360) / n + nudge, x = I.x + Math.cos(ang(d)) * r, z = I.z + Math.sin(ang(d)) * r;
      if (Math.abs(x - I.x) < 2.4 && z > I.z) continue;
      if (HS_SPOTS.some((sp) => Math.hypot(x - sp.x, z - sp.z) < HS_KINDS[sp.kind].r + 0.9 || Math.hypot(x - sp.door2.x, z - sp.door2.z) < 1.2)) continue;
      const lamp = new THREE.Group();
      lamp.add(mk(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 8), '#3B3B42', 0, 1.05, 0));
      lamp.add(mk(new THREE.SphereGeometry(0.2, 12, 10), v.glow('#FFF4CF'), 0, 2.2, 0));
      lamp.position.set(x, 0, z);
      lamps.add(lamp);
      v.addObstacleCircle(x, z, 0.12);
      break;
    }
  }
  mergeStatic(lamps);
  scene.add(lamps);
  // 잎사귀 날림 (부스럭, 찾아보기)
  const leafGeo = new THREE.PlaneGeometry(0.16, 0.1);
  const leafMats = ['#5AAB4E', '#7ACB66', '#E7C46A'].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true }));
  const bits = [];
  function burst(k, n = 9, up = 1) {
    const s = spots[k];
    if (!s) return;
    for (let i = 0; i < n; i++) {
      let b = bits.find((q) => !q.m.visible);
      if (!b) {
        if (bits.length > 60) return;
        b = { m: new THREE.Mesh(leafGeo, leafMats[bits.length % 3].clone()) };
        scene.add(b.m);
        bits.push(b);
      }
      const a = Math.random() * TAU;
      b.m.visible = true;
      b.m.position.set(s.sp.x + Math.cos(a) * 0.5, 1.0 + Math.random() * 0.6, s.sp.z + Math.sin(a) * 0.5);
      b.vx = Math.cos(a) * (0.6 + Math.random()); b.vz = Math.sin(a) * (0.6 + Math.random()); b.vy = (1.6 + Math.random() * 1.4) * up;
      b.rs = (Math.random() - 0.5) * 12;
      b.t = 0;
      b.m.material.opacity = 1;
    }
  }
  let ringMode = null;
  return {
    spots, tree,
    // 흔들기: s 세기 (1 보통, 0.5 살짝)
    shake(k, s = 1) { const q = spots[k]; if (q) { q.wob = 1; q.wobK = s; } },
    rustle(k) { this.shake(k, 0.55); burst(k, 6, 0.7); },
    puff(k) { this.shake(k, 1); burst(k, 10, 1); },
    // mode: null(감춤) | 'hide'(모든 곳 노랑) | 'seek'(찾아본 곳만 회색). checked: 찾아본 곳 번호 Set
    setRings(mode, checked = null) {
      ringMode = mode;
      rings.visible = !!mode;
      if (!mode) return;
      for (const sp of HS_SPOTS) {
        const done = !!(checked && checked.has(sp.k));
        ringAt(sp.k, mode === 'hide' || done);
        rings.setColorAt(sp.k, col.set(done ? '#B9B2A6' : '#FFE08A'));
      }
      rings.instanceMatrix.needsUpdate = true;
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    },
    update(dt, t) {
      if (rings.visible) ringMat.opacity = ringMode === 'hide' ? 0.55 + Math.sin(t * 3) * 0.2 : 0.55;
      for (const s of spots) {
        if (s.wob > 0) {
          s.wob = Math.max(0, s.wob - dt * 1.6);
          const w = Math.sin(s.wob * 26) * s.wob * 0.09 * s.wobK;
          s.g.rotation.z = s.base.z + w;
          s.g.rotation.x = s.base.x + w * 0.6;
        }
      }
      for (const b of bits) {
        if (!b.m.visible) continue;
        b.t += dt;
        b.vy -= 5.5 * dt;
        b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt;
        b.m.rotation.x += b.rs * dt; b.m.rotation.y += b.rs * 0.7 * dt;
        b.m.material.opacity = Math.max(0, 1 - b.t / 1.1);
        if (b.t > 1.1 || b.m.position.y < 0.02) b.m.visible = false;
      }
    },
  };
}
