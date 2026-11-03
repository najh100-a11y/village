// 진숲 어린이 마을 — 보드게임 섬 (마을 섬 서쪽, 나무 다리로 이어진다)
// 섬 가운데 큰 주사위와 말 조각이 있는 돌 마당을 두고, 둘레에 놀이 탁자 여섯 개를 둥글게 놓는다.
// 탁자마다 의자 둘(바깥 자리와 안쪽 자리)이 마주 보고, 탁자 위에 그 놀이 도구가 놓여 있다.
// 탁자를 누르면 바깥 자리로 걸어가 그 놀이를 연다 (js/boardgames.js).
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { BOARD_ISLE, makeIsle, makeTree } from './isles.js';
import { mergeStatic } from './merge.js';

const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const RING = 7.4; // 탁자가 놓인 둘레 반지름
export const SEAT_Y = 0.25; // 의자에 앉은 높이 (다른 놀이와 같다)
const SEAT_D = 0.95; // 탁자 가운데에서 의자까지
// 놀이 탁자: id, 이름, 둘레 위 각도(도, 동쪽 0, 남쪽 90)
export const BG_TABLES = [
  { id: 'fruit', name: '과일 종 치기', deg: 40, color: '#EF6461' },
  { id: 'yut', name: '윷놀이', deg: 92, color: '#C2453A' },
  { id: 'n77', name: '77 피하기', deg: 144, color: '#4D7DDB' },
  { id: 'code', name: '숫자 암호', deg: 216, color: '#3B3B42' },
  { id: 'mancala', name: '만칼라', deg: 268, color: '#8E603E' },
  { id: 'dots', name: '땅따먹기', deg: 320, color: '#4FA36C' },
].map((t, i) => {
  const a = (t.deg * Math.PI) / 180, dx = Math.cos(a), dz = Math.sin(a);
  const x = BOARD_ISLE.x + dx * RING, z = BOARD_ISLE.z + dz * RING;
  // 0: 바깥 자리(안쪽을 본다), 1: 안쪽 자리(바깥을 본다)
  const seats = [
    { x: x + dx * SEAT_D, z: z + dz * SEAT_D, rot: Math.atan2(-dx, -dz) },
    { x: x - dx * SEAT_D, z: z - dz * SEAT_D, rot: Math.atan2(dx, dz) },
  ];
  return { ...t, i, x, z, dx, dz, rot: Math.atan2(dx, dz), seats };
});
export const bgTable = (id) => BG_TABLES.find((t) => t.id === id);

function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texMat = (t) => new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() });

// 탁자 위 놀이 도구 (탁자 판 위 높이 y0에 놓는다)
function tableTop(id, y0) {
  const g = new THREE.Group();
  if (id === 'fruit') {
    // 가운데 금빛 종, 양쪽에 과일 카드 더미
    g.add(mk(new THREE.CylinderGeometry(0.13, 0.15, 0.03, 20), toon('#8B5E3C'), 0, y0 + 0.015, 0));
    const bell = mk(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#F2C14E'), 0, y0 + 0.03, 0);
    g.add(bell, mk(new THREE.SphereGeometry(0.025, 10, 8), toon('#E0A92E'), 0, y0 + 0.15, 0));
    const face = texMat(tex(64, 96, (c, w, h) => {
      c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#EF6461';
      for (const [x, y] of [[20, 26], [44, 26], [32, 50], [20, 74], [44, 74]]) { c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); }
    }));
    const back = toon('#4FA36C');
    for (const s of [-1, 1]) {
      g.add(mk(new THREE.BoxGeometry(0.15, 0.06, 0.21), back, s * 0.27, y0 + 0.03, 0));
      g.add(mk(new THREE.BoxGeometry(0.15, 0.006, 0.21), [back, back, face, back, back, back], s * 0.27, y0 + 0.064, s * 0.02));
    }
  } else if (id === 'n77') {
    // 부챗살처럼 펼친 숫자 카드와 칩
    const cols = ['#4D7DDB', '#EF6461', '#F6D55C', '#4FA36C', '#A07FE3'];
    cols.forEach((col, k) => {
      const card = mk(new THREE.BoxGeometry(0.12, 0.005, 0.17), toon(k === 2 ? '#FFFDF7' : col), -0.08 + k * 0.045, y0 + 0.004 + k * 0.004, 0.02);
      card.rotation.y = -0.5 + k * 0.25;
      g.add(card);
    });
    for (let k = 0; k < 4; k++) g.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 14), toon('#E5484D'), 0.22, y0 + 0.008 + k * 0.016, -0.12));
  } else if (id === 'code') {
    // 하얀 타일과 검은 타일이 줄지어 서 있다
    for (let k = 0; k < 5; k++) {
      for (const s of [-1, 1]) {
        const t = mk(new THREE.BoxGeometry(0.07, 0.1, 0.035), toon((k + (s > 0 ? 1 : 0)) % 2 ? '#2F3440' : '#FAF6EC'), -0.16 + k * 0.08, y0 + 0.05, s * 0.18);
        g.add(t);
      }
    }
  } else if (id === 'mancala') {
    // 길쭉한 나무 판에 구멍 열두 개와 양 끝 큰 구멍, 알록달록 돌
    g.add(mk(new THREE.BoxGeometry(0.72, 0.05, 0.26), toon('#A0703F'), 0, y0 + 0.025, 0));
    const pit = toon('#6E4A2A');
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) g.add(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 14), pit, -0.22 + k * 0.088, y0 + 0.052, s * 0.06));
    for (const s of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.06, 0.012, 0.18), pit, s * 0.32, y0 + 0.052, 0));
    const stones = ['#EF6461', '#4D7DDB', '#F6D55C', '#6FD3C0', '#F6A2C4'];
    for (let k = 0; k < 14; k++) g.add(mk(new THREE.SphereGeometry(0.014, 8, 6), toon(stones[k % 5]), -0.22 + (k % 6) * 0.088 + ((k * 7) % 3 - 1) * 0.01, y0 + 0.064, (k % 2 ? 1 : -1) * 0.06 + ((k * 5) % 3 - 1) * 0.008));
  } else if (id === 'yut') {
    // 윷판을 그린 멍석과 윷가락 넷
    const board = texMat(tex(256, 256, (c, w) => {
      c.fillStyle = '#C2453A'; c.fillRect(0, 0, w, w);
      c.strokeStyle = '#FFE7A8'; c.lineWidth = 6;
      c.strokeRect(36, 36, w - 72, w - 72);
      c.beginPath(); c.moveTo(36, 36); c.lineTo(w - 36, w - 36); c.moveTo(w - 36, 36); c.lineTo(36, w - 36); c.stroke();
      c.fillStyle = '#FFE7A8';
      for (let k = 0; k <= 5; k++) for (const [x, y] of [[36 + k * 36.8, 36], [36 + k * 36.8, w - 36], [36, 36 + k * 36.8], [w - 36, 36 + k * 36.8]]) { c.beginPath(); c.arc(x, y, k % 5 === 0 ? 13 : 8, 0, 7); c.fill(); }
      c.beginPath(); c.arc(w / 2, w / 2, 13, 0, 7); c.fill();
    }));
    const mat = mk(new THREE.BoxGeometry(0.5, 0.01, 0.5), [toon('#8E2F28'), toon('#8E2F28'), board, toon('#8E2F28'), toon('#8E2F28'), toon('#8E2F28')], 0, y0 + 0.005, 0);
    g.add(mat);
    for (let k = 0; k < 4; k++) {
      const st = mk(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10), toon(k % 2 ? '#E8C98E' : '#C99862'), 0.33, y0 + 0.02, -0.12 + k * 0.05);
      st.rotation.x = Math.PI / 2;
      st.rotation.z = 0.15 * (k - 1.5);
      g.add(st);
    }
  } else if (id === 'dots') {
    // 점을 찍은 종이와 연필
    const paper = texMat(tex(256, 256, (c, w) => {
      c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, w);
      c.fillStyle = '#5A4A3A';
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { c.beginPath(); c.arc(40 + i * 44, 40 + j * 44, 6, 0, 7); c.fill(); }
      c.strokeStyle = '#EF6461'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(40, 40); c.lineTo(84, 40); c.lineTo(84, 84); c.stroke();
      c.strokeStyle = '#4D7DDB';
      c.beginPath(); c.moveTo(128, 128); c.lineTo(128, 172); c.lineTo(172, 172); c.stroke();
      c.fillStyle = 'rgba(239,100,97,.3)'; c.fillRect(40, 40, 44, 44);
    }));
    const sheet = mk(new THREE.BoxGeometry(0.42, 0.004, 0.42), [toon('#EEE6D6'), toon('#EEE6D6'), paper, toon('#EEE6D6'), toon('#EEE6D6'), toon('#EEE6D6')], 0, y0 + 0.002, 0);
    sheet.rotation.y = 0.2;
    g.add(sheet);
    const pencil = mk(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), toon('#F6D55C'), 0.26, y0 + 0.014, 0.12);
    pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.6;
    g.add(pencil);
  }
  return g;
}

// 이름표 (탁자 옆 작은 팻말)
function nameSign(text, color) {
  const t = tex(384, 128, (c, w, h) => {
    c.fillStyle = '#6B4429'; c.beginPath(); c.roundRect(0, 0, w, h, 26); c.fill();
    c.fillStyle = '#FFFDF7'; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 20); c.fill();
    c.fillStyle = color; c.beginPath(); c.roundRect(8, h - 30, w - 16, 22, [0, 0, 20, 20]); c.fill();
    c.fillStyle = '#4A3424'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let size = 54;
    c.font = `${size}px ${FONT}`;
    while (c.measureText(text).width > w - 40 && size > 28) { size -= 2; c.font = `${size}px ${FONT}`; }
    c.fillText(text, w / 2, h / 2 - 8);
  });
  const g = new THREE.Group();
  g.add(mk(new THREE.BoxGeometry(0.07, 0.85, 0.07), toon('#8B5E3C'), 0, 0.42, 0));
  const board = mk(new THREE.BoxGeometry(0.9, 0.3, 0.05), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), texMat(t), toon('#6B4429')], 0, 0.95, 0);
  g.add(board);
  return g;
}

// 큰 주사위 (여섯 면에 점)
function dice(size) {
  const face = (n) => texMat(tex(128, 128, (c, w) => {
    c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, w);
    c.strokeStyle = '#E8DCC6'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, w - 8);
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]],
      5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] }[n];
    c.fillStyle = n === 1 ? '#E5484D' : '#3B3B42';
    for (const [x, y] of P) { c.beginPath(); c.arc(x, y, n === 1 ? 16 : 11, 0, 7); c.fill(); }
  }));
  return mk(new THREE.BoxGeometry(size, size, size), [face(3), face(4), face(5), face(2), face(1), face(6)]);
}

export function buildBoardIsle(v, { signMesh } = {}) {
  const I = BOARD_ISLE;
  const scene = v.scene;
  // 땅: 가운데 돌 마당, 탁자 둘레 둥근 길, 다리에서 들어오는 길
  makeIsle(scene, I, {
    layer: 3,
    draw: (ctx, px, u) => {
      ctx.strokeStyle = '#E9D2A6'; ctx.lineCap = 'round';
      ctx.lineWidth = 2.6 * u;
      ctx.beginPath(); ctx.moveTo(px(4.5), px(0)); ctx.lineTo(px(I.r + 1), px(0)); ctx.stroke(); // 다리 쪽 길 (동쪽)
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath(); ctx.arc(px(0), px(0), RING * u, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#D9C9A8';
      ctx.beginPath(); ctx.arc(px(0), px(0), 3.4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#C6B48F'; ctx.lineWidth = 0.12 * u;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(px(Math.cos(a) * 1.7), px(Math.sin(a) * 1.7)); ctx.lineTo(px(Math.cos(a) * 3.4), px(Math.sin(a) * 3.4)); ctx.stroke(); }
      // 탁자 밑 둥근 자리
      for (const t of BG_TABLES) {
        ctx.fillStyle = '#E9D2A6';
        ctx.beginPath(); ctx.arc(px(t.x - I.x), px(t.z - I.z), 1.9 * u, 0, Math.PI * 2); ctx.fill();
      }
    },
  });
  // 가운데: 큰 주사위 둘과 말 조각
  const mid = new THREE.Group();
  mid.add(mk(new THREE.CylinderGeometry(1.55, 1.7, 0.3, 28), toon('#BFB39B'), 0, 0.15, 0));
  const d1 = dice(1.0); d1.position.set(-0.45, 0.8, 0.1); d1.rotation.set(0, 0.5, 0); mid.add(d1);
  const d2 = dice(0.7); d2.position.set(0.55, 0.65, 0.45); d2.rotation.set(0, -0.3, 0); mid.add(d2);
  const pawnMat = toon('#4D7DDB');
  mid.add(mk(new THREE.CylinderGeometry(0.22, 0.34, 0.9, 18), pawnMat, 0.45, 0.75, -0.55));
  mid.add(mk(new THREE.SphereGeometry(0.24, 16, 12), pawnMat, 0.45, 1.36, -0.55));
  mid.add(mk(new THREE.CylinderGeometry(0.36, 0.38, 0.1, 18), pawnMat, 0.45, 0.35, -0.55));
  mid.position.set(I.x, 0, I.z);
  mergeStatic(mid);
  scene.add(mid);
  v.addObstacleCircle(I.x, I.z, 1.75);
  // 놀이 탁자
  const wood = toon('#B98A57'), dark = toon('#7A5233'), stoolTop = toon('#E2B97E');
  for (const t of BG_TABLES) {
    const g = new THREE.Group();
    // 탁자 (둥근 판과 다리 하나)
    g.add(mk(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 28), wood, 0, 0.74, 0));
    g.add(mk(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 12), dark, 0, 0.37, 0));
    g.add(mk(new THREE.CylinderGeometry(0.34, 0.38, 0.05, 20), dark, 0, 0.025, 0));
    // 의자 둘 (탁자 바깥쪽과 안쪽): 탁자 기준 +z가 섬 바깥
    for (const s of [1, -1]) {
      g.add(mk(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18), stoolTop, 0, 0.42 - 0.03, s * SEAT_D));
      g.add(mk(new THREE.CylinderGeometry(0.05, 0.07, 0.38, 10), dark, 0, 0.19, s * SEAT_D));
    }
    const top = tableTop(t.id, 0.775);
    g.add(top);
    // 팻말: 탁자 옆 (둘레를 따라 조금 비켜서)
    const sg = nameSign(t.name, t.color);
    sg.position.set(0.95, 0, 0.35);
    sg.rotation.y = 0.25;
    g.add(sg);
    v.spot('bg_' + t.id, t.name, g, { x: t.x, z: t.z, rot: t.rot, door: SEAT_D + 0.25 });
    v.addObstacleCircle(t.x, t.z, 0.66);
    // 팻말 기둥
    const sx = t.x + Math.cos(t.rot) * 0.95 + Math.sin(t.rot) * 0.35, sz = t.z - Math.sin(t.rot) * 0.95 + Math.cos(t.rot) * 0.35;
    v.addObstacleCircle(sx, sz, 0.12);
  }
  // 섬 둘레 나무와 꽃
  const trees = [[-12.2, 1.5], [-11.4, -5.8], [-8.5, 9.4], [-3, 12.6], [3.5, 12.3], [9.2, 8.6], [-8.6, -10.1], [-2.6, -12.8], [3.6, -12.4], [9.4, -8.7]];
  trees.forEach(([dx, dz], k) => {
    const tr = makeTree(k % 3 ? 'round' : 'round', 0.85 + (k % 3) * 0.1);
    tr.position.set(I.x + dx, 0, I.z + dz);
    scene.add(tr);
    v.addObstacleCircle(I.x + dx, I.z + dz, 0.45);
  });
  // 길가 등불 (밤에 켜진다)
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * Math.PI * 2 + (40 * Math.PI) / 180;
    const x = I.x + Math.cos(a) * (RING + 2.1), z = I.z + Math.sin(a) * (RING + 2.1);
    const lamp = new THREE.Group();
    lamp.add(mk(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), toon('#3B3B42'), 0, 1.1, 0));
    lamp.add(mk(new THREE.SphereGeometry(0.2, 12, 10), v.glow('#FFF4CF'), 0, 2.3, 0));
    lamp.position.set(x, 0, z);
    mergeStatic(lamp);
    scene.add(lamp);
    v.addObstacleCircle(x, z, 0.12);
  }
  // 들어오는 곳 표지판
  if (signMesh) {
    const g = new THREE.Group();
    g.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), toon('#8B5E3C'), -1.3, 0.95, 0));
    g.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), toon('#8B5E3C'), 1.3, 0.95, 0));
    const sg = signMesh('보드게임 섬', 2.7, { bg: '#4D7DDB', fg: '#FFFDF7', border: '#30477F' });
    sg.position.set(0, 1.95, 0);
    g.add(sg);
    g.position.set(I.x + I.walk - 1.2, 0, I.z);
    g.rotation.y = Math.PI / 2;
    mergeStatic(g);
    scene.add(g);
    v.addObstacleCircle(I.x + I.walk - 1.2, I.z - 1.3, 0.12);
    v.addObstacleCircle(I.x + I.walk - 1.2, I.z + 1.3, 0.12);
  }
}
