// 진숲 어린이 마을 — 숨바꼭질 섬 (마을 섬 북쪽, 내 집 뒤로 나무 다리를 건넌다)
// 섬 가운데에 큰 '술래 나무'가 있고, 둘레에 숨을 곳 16군데(덤불, 짚더미, 나무통, 상자 더미, 통나무 굴, 바위, 텐트, 짚 수레,
// 이불 빨래, 흙 동굴, 해바라기 밭, 작은 놀이집, 장작 더미)가 있다. 숨을 곳 앞(섬 가운데 쪽)이 그곳에 숨거나 찾아보는 자리다.
// 술래는 나무 앞 발자국 자리에서 나무를 보고 눈을 가린다. 놀이 흐름은 js/hide.js가 맡는다.
import * as THREE from './three.module.min.js';
import { toon } from './avatar.js';
import { HIDE_ISLE, makeIsle, makeTree } from './isles.js';
import { mergeStatic } from './merge.js';

const I = HIDE_ISLE;
const TAU = Math.PI * 2;
// 숨을 곳 종류: 이름, 장애물 반지름, 앞(문) 거리
export const HS_KINDS = {
  bush: { name: '덤불', r: 1.05, door: 1.75 },
  hay: { name: '짚더미', r: 0.95, door: 1.65 },
  barrel: { name: '큰 나무통', r: 0.72, door: 1.4 },
  crates: { name: '상자 더미', r: 1.05, door: 1.75 },
  log: { name: '통나무 굴', r: 1.0, door: 1.7 },
  rock: { name: '큰 바위', r: 1.05, door: 1.75 },
  tent: { name: '텐트', r: 1.1, door: 1.85 },
  cart: { name: '짚 수레', r: 1.05, door: 1.75 },
  laundry: { name: '이불 빨래', r: 0.5, door: 1.15 },
  cave: { name: '흙 동굴', r: 1.25, door: 1.95 },
  flowers: { name: '해바라기 밭', r: 1.0, door: 1.7 },
  playhouse: { name: '작은 놀이집', r: 1.15, door: 1.9 },
  woodpile: { name: '장작 더미', r: 1.0, door: 1.7 },
};
// 숨을 곳 16군데: 둘레 위 각도(도, 동쪽 0, 남쪽 90), 가운데에서 거리, 종류. 남쪽(다리에서 들어오는 길)은 비워 둔다.
// 같은 종류가 둘이면 서로 다른 방향(8방위)에 둔다
const LAYOUT = [
  [15, 12.0, 'bush'], [38, 8.5, 'hay'], [55, 12.8, 'barrel'], [125, 12.0, 'crates'], [145, 8.0, 'rock'], [160, 12.8, 'log'],
  [182, 9.8, 'tent'], [204, 12.8, 'cart'], [226, 8.4, 'barrel'], [240, 12.6, 'laundry'], [268, 11.6, 'cave'], [288, 7.6, 'flowers'],
  [300, 12.8, 'playhouse'], [318, 12.6, 'hay'], [340, 8.6, 'rock'], [358, 12.4, 'woodpile'],
];
// 같은 종류가 둘이면 방향을 붙여 부른다 (북쪽 덤불, 동쪽 덤불)
const DIR8 = ['동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽', '북쪽', '북동쪽'];
export const HS_SPOTS = LAYOUT.map(([deg, r, kind], k) => {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dz = Math.sin(a);
  const x = I.x + dx * r, z = I.z + dz * r;
  const K = HS_KINDS[kind];
  const twin = LAYOUT.filter((l) => l[2] === kind).length > 1;
  const name = twin ? `${DIR8[Math.round(((deg % 360) / 45)) % 8]} ${K.name}` : K.name;
  const rot = Math.atan2(-dx, -dz); // 앞(+z)이 섬 가운데를 본다
  return { k, kind, name, x, z, rot, door: K.door, dx, dz, door2: { x: x - dx * K.door, z: z - dz * K.door } };
});
export const hsSpot = (k) => HS_SPOTS[k] || null;
// 술래 나무와 술래가 서는 자리 (나무 남쪽, 나무를 본다)
export const HS_TREE = { x: I.x, z: I.z - 0.6, seekX: I.x, seekZ: I.z + 1.15, seekRot: Math.PI };
// 놀이를 시작하면 모이는 자리 (나무 둘레)
export function gatherPoint(i, n) {
  const a = Math.PI / 2 + ((i - (n - 1) / 2) * 0.42);
  return { x: I.x + Math.cos(a) * 3.6, z: I.z + Math.sin(a) * 3.6, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) };
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
const BUILD = { bush, hay, barrel, crates, log, rock, tent, cart, laundry, cave, flowers, playhouse, woodpile };

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

// 숨바꼭질 섬을 짓는다. 돌려주는 것: { spots: [{ g, ring, base }], tree, update(dt), shake(k, s), rustle(k), puff(k), setRings(mode, checked) }
export function buildHideIsle(v, { signMesh } = {}) {
  const scene = v.scene;
  makeIsle(scene, I, {
    layer: 4,
    draw: (ctx, px, u) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#E9D2A6';
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); ctx.moveTo(px(0), px(I.r + 1)); ctx.lineTo(px(0), px(3.5)); ctx.stroke(); // 다리에서 나무까지
      ctx.lineWidth = 1.7 * u;
      ctx.beginPath(); ctx.arc(px(0), px(0), 10.2 * u, 0, TAU); ctx.stroke(); // 둘레 길
      ctx.fillStyle = '#D9C9A8';
      ctx.beginPath(); ctx.arc(px(0), px(0), 4.3 * u, 0, TAU); ctx.fill(); // 나무 둘레 마당
      ctx.strokeStyle = '#C9B78F'; ctx.lineWidth = 0.14 * u;
      ctx.beginPath(); ctx.arc(px(0), px(0), 4.3 * u, 0, TAU); ctx.stroke();
      // 꽃밭 점들
      let s = 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 160; i++) {
        const a = rnd() * TAU, r = 5 + rnd() * 9.5;
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
  // 술래 나무 팻말
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
    // 섬 들어오는 곳 표지판
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
  // 숨을 곳 16군데 (흔들 수 있게 그룹마다 따로 둔다)
  const spots = HS_SPOTS.map((sp) => {
    const g = new THREE.Group();
    BUILD[sp.kind](g);
    v.spot(`hs_${sp.k}`, sp.name, g, { x: sp.x, z: sp.z, rot: sp.rot, door: sp.door });
    const K = HS_KINDS[sp.kind];
    if (sp.kind === 'laundry') { // 빨랫줄 기둥 둘만 막는다 (이불 뒤로 돌아갈 수 있다)
      for (const sx of [-1, 1]) { const c = Math.cos(sp.rot), s = Math.sin(sp.rot); v.addObstacleCircle(sp.x + sx * 1.25 * c - 0.15 * s, sp.z - sx * 1.25 * s - 0.15 * c, 0.12); }
      v.addObstacleBox(sp.x - 0.15 * Math.sin(sp.rot), sp.z - 0.15 * Math.cos(sp.rot), 1.05, 0.12, sp.rot);
    } else v.addObstacleCircle(sp.x, sp.z, K.r, true);
    // 땅의 둥근 표시 (놀이 중에만 보인다: 숨을 때 노랑, 찾을 때 하늘색, 찾아본 곳은 회색)
    const rm = new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(K.r + 0.25, K.r + 0.45, 32), rm);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sp.x, 0.03, sp.z);
    ring.visible = false;
    ring.renderOrder = 2;
    scene.add(ring);
    return { sp, g, ring, rm, base: { x: g.rotation.x, z: g.rotation.z }, wob: 0, wobK: 0 };
  });
  // 둘레 나무와 등불 (숨을 곳 사이 빈 곳에)
  const trees = [[80, 14.3], [100, 14.3], [35, 14.6], [140, 14.6], [182, 14.5], [222, 14.6], [254, 14.4], [284, 14.6], [330, 14.5], [3, 14.6], [112, 5.6], [68, 5.8]];
  trees.forEach(([deg, r], k) => {
    const a = (deg * Math.PI) / 180, x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
    const tr = makeTree('round', 0.8 + (k % 3) * 0.12);
    tr.position.set(x, 0, z);
    scene.add(tr);
    v.addObstacleCircle(x, z, 0.42);
  });
  for (const deg of [70, 110, 200, 250, 320, 20]) {
    const a = (deg * Math.PI) / 180, x = I.x + Math.cos(a) * 6.0, z = I.z + Math.sin(a) * 6.0;
    const lamp = new THREE.Group();
    lamp.add(mk(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 8), '#3B3B42', 0, 1.05, 0));
    lamp.add(mk(new THREE.SphereGeometry(0.2, 12, 10), v.glow('#FFF4CF'), 0, 2.2, 0));
    lamp.position.set(x, 0, z);
    mergeStatic(lamp);
    scene.add(lamp);
    v.addObstacleCircle(x, z, 0.12);
  }
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
  return {
    spots, tree,
    // 흔들기: s 세기 (1 보통, 0.5 살짝)
    shake(k, s = 1) { const q = spots[k]; if (q) { q.wob = 1; q.wobK = s; } },
    rustle(k) { this.shake(k, 0.55); burst(k, 6, 0.7); },
    puff(k) { this.shake(k, 1); burst(k, 10, 1); },
    // mode: null(감춤) | 'hide' | 'seek'. checked: 찾아본 곳 번호 Set
    setRings(mode, checked = null) {
      for (const s of spots) {
        s.ring.visible = !!mode;
        if (!mode) continue;
        const done = checked && checked.has(s.sp.k);
        s.rm.color.set(done ? '#B9B2A6' : mode === 'hide' ? '#FFE08A' : '#8FD3F5');
        s.dim = done;
      }
    },
    update(dt, t) {
      for (const s of spots) {
        if (s.ring.visible) s.rm.opacity = s.dim ? 0.45 : 0.5 + Math.sin(t * 3 + s.sp.k) * 0.25;
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
