// 진숲 어린이 마을 — 보드게임 섬 (마을 섬 서쪽, 나무 다리로 이어진다)
// 섬 가운데 큰 주사위와 말 조각이 있는 돌 마당을 두고, 둘레에 놀이 탁자 여섯 개를 둥글게 놓는다.
// 탁자마다 의자 넷(만칼라는 둘)이 둘러 있고, 탁자 위에 그 놀이 도구가 놓여 있다.
// 탁자마다 그 놀이 모습을 살린 작은 집(과일 가게, 정자, 카드 집, 해와 달 지붕, 퍼걸러, 연필 공방)을 지어 한눈에 구별되게 한다.
// 탁자나 집을 누르면 바깥 자리로 걸어가 그 놀이를 연다 (js/boardgames.js).
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { BOARD_ISLE, makeIsle, makeTree } from './isles.js';
import { mergeStatic, mergeColored } from './merge.js';

const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const RING = 7.4; // 탁자가 놓인 둘레 반지름
export const SEAT_Y = 0.25; // 의자에 앉은 높이 (다른 놀이와 같다)
const SEAT_D = 0.95; // 탁자 가운데에서 의자까지
export const PAD_R = 2.3; // 탁자 밑 둥근 자리 반지름 (지도에도 같은 값)
// 놀이 탁자: id, 이름, 둘레 위 각도(도, 동쪽 0, 남쪽 90). 만칼라만 두 사람, 나머지는 네 사람까지
export const BG_TABLES = [
  { id: 'fruit', name: '과일 종 치기', deg: 40, color: '#EF6461', pad: '#F5D2C6' },
  { id: 'yut', name: '윷놀이', deg: 92, color: '#C2453A', pad: '#E6C68C' },
  { id: 'n77', name: '77 피하기', deg: 144, color: '#4D7DDB', pad: '#CFDDF3' },
  { id: 'code', name: '숫자 암호', deg: 216, color: '#3B3B42', pad: '#DCD6EA' },
  { id: 'mancala', name: '만칼라', deg: 268, color: '#8E603E', pad: '#E1CDAE' },
  { id: 'dots', name: '땅따먹기', deg: 320, color: '#4FA36C', pad: '#D3EACB' },
].map((t, i) => {
  const a = (t.deg * Math.PI) / 180, dx = Math.cos(a), dz = Math.sin(a);
  const x = BOARD_ISLE.x + dx * RING, z = BOARD_ISLE.z + dz * RING;
  // 의자 넷을 차례대로 둘러 놓는다: 0 바깥, 1 오른쪽, 2 안쪽, 3 왼쪽 (모두 탁자 가운데를 본다)
  // 탁자 기준(+z가 섬 바깥, +x가 (dz, -dx)) 자리
  const rot = Math.atan2(dx, dz);
  const local = [[0, SEAT_D], [SEAT_D, 0], [0, -SEAT_D], [-SEAT_D, 0]];
  const seats = local.map(([lx, lz]) => {
    const wx = x + lx * Math.cos(rot) + lz * Math.sin(rot), wz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
    return { x: wx, z: wz, rot: Math.atan2(x - wx, z - wz), lx, lz };
  });
  return { ...t, i, x, z, dx, dz, rot, seats, stools: t.id === 'mancala' ? [0, 2] : [0, 1, 2, 3] };
});
// 함께하는 사람 수에 따라 앉는 의자 (차례 순서대로)
// 이웃한 두 집 사이 가운데 각도 (등불과 길 그물이 쓴다. 0도는 다리에서 들어오는 길)
export const BG_GAPS = [0, 66, 118, 180, 242, 294];
export const stoolsFor = (n) => (n >= 4 ? [0, 1, 2, 3] : n === 3 ? [0, 1, 3] : [0, 2]);
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

// 앞뒤 두 면에 이름을 쓴 팻말 (어느 쪽에서 봐도 읽힌다)
function signBoard(text, { w = 1.6, h = 0.44, d = 0.06, bg = '#FFFDF7', fg = '#4A3424', frame = '#6B4429', band = null } = {}) {
  const W = 512, H = Math.round((512 * h) / w);
  const t = tex(W, H, (c) => {
    const r = H * 0.2, bh = band ? Math.round(H * 0.16) : 0;
    c.fillStyle = frame; c.beginPath(); c.roundRect(0, 0, W, H, r); c.fill();
    c.fillStyle = bg; c.beginPath(); c.roundRect(8, 8, W - 16, H - 16, r * 0.8); c.fill();
    if (band) { c.fillStyle = band; c.beginPath(); c.roundRect(8, H - 8 - bh, W - 16, bh, [0, 0, r * 0.8, r * 0.8]); c.fill(); }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    let size = Math.round(H * 0.54);
    c.font = `${size}px ${FONT}`;
    while (c.measureText(text).width > W - 48 && size > 20) { size -= 2; c.font = `${size}px ${FONT}`; }
    c.fillText(text, W / 2, (H - bh) / 2 + 2);
  });
  const face = texMat(t), side = toon(frame);
  return mk(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, face]);
}

// ---------- 놀이마다 작은 집 ----------
// 모두 탁자 기준 자리로 짓는다: +z가 섬 바깥(들어가는 쪽), 기둥은 네 모서리(±P), 바깥 소품까지 ±2.3 안.
// 돌려주는 obs: [x, z, r]은 둥근 장애물, { b: [x, z, hw, hd] }는 네모 장애물 (탁자 기준 자리)
const P = 1.45;
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const DS = THREE.DoubleSide;
// 색만 다른 부품은 꼭짓점 색으로 한 번에 그린다 (앞면만, 양면 따로)
const HVC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const HVC2 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: DS });
const flat = (geo) => { const f = geo.toNonIndexed(); f.computeVertexNormals(); geo.dispose(); return f; };
// a에서 b까지 이어진 네모 막대
function rod(a, b, t, mat) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const o = mk(new THREE.BoxGeometry(t, t, len), mat);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  return o;
}
function seeded(s) {
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// 과일 종 치기: 빨강·하양 줄무늬 차양을 친 과일 가게. 지붕 위 팻말에 큰 금빛 종, 앞에 과일 상자
function fruitHouse() {
  const g = new THREE.Group(), obs = [];
  const white = toon('#FFFDF7'), red = toon('#E5484D');
  for (const [sx, sz] of CORNERS) {
    g.add(mk(new THREE.BoxGeometry(0.13, 2.5, 0.13), white, sx * P, 1.25, sz * P));
    obs.push([sx * P, sz * P, 0.14]);
  }
  for (const s of [-1, 1]) {
    g.add(mk(new THREE.BoxGeometry(3.03, 0.1, 0.1), white, 0, 2.45, s * P));
    g.add(mk(new THREE.BoxGeometry(0.1, 0.09, 3.0), white, s * P, 2.45, 0));
  }
  const stripe = texMat(tex(256, 32, (c, w, h) => {
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#FFFDF7' : '#E5484D'; c.fillRect((k * w) / 8, 0, w / 8, h); }
  }));
  const RY = 3.0, EY = 2.42, D = 1.78, th = Math.atan2(RY - EY, D), L = Math.hypot(RY - EY, D);
  for (const s of [-1, 1]) {
    const m = mk(new THREE.BoxGeometry(3.52, 0.05, L), [red, red, stripe, stripe, red, red], 0, (RY + EY) / 2, (s * D) / 2);
    m.rotation.x = s * th;
    g.add(m);
    // 차양 끝 물결 모양 술
    for (let k = 0; k < 8; k++) g.add(mk(new THREE.CircleGeometry(0.22, 10, Math.PI, Math.PI), toon(k % 2 ? '#FFFDF7' : '#E5484D', { side: DS }), -1.54 + k * 0.44, EY + 0.01, s * (D + 0.01)));
  }
  const ridge = mk(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 10), red, 0, RY, 0);
  ridge.rotation.z = Math.PI / 2;
  g.add(ridge);
  const sg = signBoard('과일 종 치기', { w: 1.9, h: 0.5, band: '#E5484D' });
  sg.position.set(0, RY + 0.32, 0);
  g.add(sg);
  const by = RY + 0.57; // 팻말 위 큰 종
  g.add(mk(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), toon('#C98E2E'), 0, by + 0.025, 0));
  g.add(mk(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#F2C14E'), 0, by + 0.05, 0));
  g.add(mk(new THREE.SphereGeometry(0.07, 10, 8), toon('#E0A92E'), 0, by + 0.38, 0));
  // 과일 상자 둘: 사과, 감과 복숭아 (놀이의 과일과 같다)
  const crateM = toon('#C99862'), crateD = toon('#A9784A');
  const crate = (x, z, rot, cols) => {
    const c = new THREE.Group();
    c.add(mk(new THREE.BoxGeometry(0.66, 0.34, 0.46), crateM, 0, 0.17, 0));
    for (const s of [-1, 1]) c.add(mk(new THREE.BoxGeometry(0.68, 0.06, 0.04), crateD, 0, 0.25, s * 0.235));
    for (let i = 0; i < 6; i++) c.add(mk(new THREE.SphereGeometry(0.1, 12, 8), toon(cols[i % cols.length]), -0.2 + (i % 3) * 0.2, 0.4, i < 3 ? -0.1 : 0.1));
    c.add(mk(new THREE.SphereGeometry(0.1, 12, 8), toon(cols[0]), -0.1, 0.53, 0));
    c.add(mk(new THREE.SphereGeometry(0.1, 12, 8), toon(cols[1 % cols.length]), 0.1, 0.53, 0));
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    g.add(c);
    obs.push([x, z, 0.4]);
  };
  crate(-1.95, 1.05, 0.25, ['#EF6461']);
  crate(1.95, 1.05, -0.25, ['#F49A4C', '#F6A2C4']);
  return { g, obs };
}

// 윷놀이: 빨간 기둥과 단청 띠를 두른 기와 정자. 앞뒤에 현판, 처마 밑 청사초롱, 바닥에 멍석, 옆에 큰 윷가락
function yutHouse(v) {
  const g = new THREE.Group(), obs = [];
  const col = toon('#B5402F'), stone = toon('#BDB6A6');
  const dan = texMat(tex(512, 64, (c, w, h) => {
    c.fillStyle = '#2E8B6E'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1F5E4B'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
    for (let k = 0; k < 8; k++) {
      const x = 32 + k * 64;
      c.fillStyle = '#E26A3D'; c.beginPath(); c.arc(x, h / 2, 17, 0, 7); c.fill();
      c.fillStyle = '#F6D58A'; c.beginPath(); c.arc(x, h / 2, 8, 0, 7); c.fill();
      c.strokeStyle = '#FFFDF7'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 32, 12); c.lineTo(x + 32, h - 12); c.stroke();
    }
  }));
  for (const [sx, sz] of CORNERS) {
    g.add(mk(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 8), stone, sx * P, 0.07, sz * P));
    g.add(mk(new THREE.CylinderGeometry(0.11, 0.12, 2.3, 12), col, sx * P, 1.29, sz * P));
    obs.push([sx * P, sz * P, 0.22]);
  }
  for (const s of [-1, 1]) {
    g.add(mk(new THREE.BoxGeometry(3.14, 0.2, 0.16), dan, 0, 2.36, s * P));
    g.add(mk(new THREE.BoxGeometry(0.15, 0.18, 2.9), dan, s * P, 2.35, 0));
  }
  // 지붕: 처마가 살짝 펴지는 네모 기와지붕, 내림마루는 하얗게, 꼭대기에 절병통
  const roofM = toon('#4F5560', { side: DS }), hipM = toon('#E8E2D6'), fin = toon('#3B3F47');
  g.add(mk(new THREE.BoxGeometry(3.2, 0.2, 3.2), toon('#6E4A2A'), 0, 2.56, 0));
  const skirt = mk(flat(new THREE.CylinderGeometry(2.3, 2.95, 0.14, 4, 1, true)), roofM, 0, 2.62, 0);
  skirt.rotation.y = Math.PI / 4;
  const cone = mk(flat(new THREE.ConeGeometry(2.3, 1.05, 4)), roofM, 0, 2.69 + 0.525, 0);
  cone.rotation.y = Math.PI / 4;
  g.add(skirt, cone);
  const a = 2.3 * Math.SQRT1_2, b = 2.95 * Math.SQRT1_2;
  const apex = new THREE.Vector3(0, 3.74, 0);
  for (const [sx, sz] of CORNERS) {
    const mid = new THREE.Vector3(sx * a, 2.69, sz * a), end = new THREE.Vector3(sx * b, 2.55, sz * b);
    g.add(rod(apex, mid, 0.1, hipM), rod(mid, end, 0.1, hipM));
    const up = new THREE.Vector3(sx * 0.55, 0.83, sz * 0.55).normalize();
    const tip = mk(new THREE.ConeGeometry(0.09, 0.4, 6), hipM);
    tip.position.copy(end).addScaledVector(up, 0.14);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    g.add(tip);
  }
  g.add(mk(new THREE.CylinderGeometry(0.1, 0.15, 0.14, 8), fin, 0, 3.74, 0));
  g.add(mk(new THREE.SphereGeometry(0.13, 12, 10), fin, 0, 3.88, 0));
  g.add(mk(new THREE.SphereGeometry(0.07, 10, 8), fin, 0, 4.03, 0));
  for (const s of [-1, 1]) {
    const sg = signBoard('윷놀이', { w: 1.15, h: 0.4, bg: '#3A2A1E', fg: '#F6D58A', frame: '#8E2F28' });
    sg.position.set(0, 2.2, s * (P + 0.12));
    g.add(sg);
  }
  // 청사초롱 (밤에 빨간 등이 켜진다)
  const blue = toon('#3557B0'), lampRed = v.glow('#D8443A'), cord = toon('#3B3B42');
  for (const sx of [-1, 1]) {
    const x = sx * 1.08, z = P - 0.02;
    g.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), cord, x, 2.16, z));
    g.add(mk(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 12), blue, x, 2.05, z));
    g.add(mk(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12), blue, x, 1.965, z));
    g.add(mk(new THREE.CylinderGeometry(0.13, 0.13, 0.15, 12), lampRed, x, 1.83, z));
    g.add(mk(new THREE.CylinderGeometry(0.13, 0.1, 0.05, 12), blue, x, 1.73, z));
  }
  // 둥근 멍석
  const straw = texMat(tex(256, 256, (c, w) => {
    c.fillStyle = '#D9B46C'; c.fillRect(0, 0, w, w);
    c.strokeStyle = '#C29A52'; c.lineWidth = 3;
    for (let r = 12; r < 120; r += 10) { c.beginPath(); c.arc(w / 2, w / 2, r, 0, 7); c.stroke(); }
    c.strokeStyle = '#A97F3E'; c.lineWidth = 9; c.beginPath(); c.arc(w / 2, w / 2, 122, 0, 7); c.stroke();
  }));
  const rim = toon('#B48A48');
  g.add(mk(new THREE.CylinderGeometry(1.4, 1.4, 0.03, 40), [rim, straw, rim], 0, 0.015, 0));
  // 큰 윷가락 넷 (나무 받침에 부채처럼 꽂았다)
  const sb = new THREE.Group();
  sb.add(mk(new THREE.BoxGeometry(0.62, 0.12, 0.24), toon('#7A5233'), 0, 0.06, 0));
  const light = toon('#F1DDB0'), back = toon('#B98A57');
  [-0.27, -0.09, 0.09, 0.27].forEach((an, k) => {
    const st = mk(new THREE.CylinderGeometry(0.075, 0.075, 1.25, 12), k === 1 ? back : light);
    st.scale.set(1, 1, 0.55);
    st.position.set((k - 1.5) * 0.06 - Math.sin(an) * 0.625, 0.12 + Math.cos(an) * 0.625, 0);
    st.rotation.z = an;
    sb.add(st);
  });
  sb.position.set(1.98, 0, 0.75);
  sb.rotation.y = -0.35;
  g.add(sb);
  obs.push([1.98, 0.75, 0.35]);
  return { g, obs };
}

// 77 피하기: 커다란 숫자 카드 두 장을 기대어 세우고 위에 한 장을 얹은 카드 집. 맨 위에 '77 금지' 표지, 앞에 칩 더미
function n77House() {
  const g = new THREE.Group(), obs = [];
  const B = 2.3, RH = 3.0, L = Math.hypot(B, RH), phi = Math.atan2(B, RH), W = 2.7;
  const cardFace = (num, col) => texMat(tex(256, 372, (c, w, h) => {
    c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, h);
    c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); c.roundRect(16, 16, w - 32, h - 32, 18); c.stroke();
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `220px ${FONT}`; c.fillText(num, w / 2, h / 2 + 8);
    c.font = `52px ${FONT}`; c.fillText(num, 50, 58);
    c.save(); c.translate(w - 50, h - 58); c.rotate(Math.PI); c.fillText(num, 0, 0); c.restore();
  }));
  const back = texMat(tex(256, 372, (c, w, h) => {
    c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4D7DDB'; c.beginPath(); c.roundRect(14, 14, w - 28, h - 28, 16); c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 5;
    for (let k = -h; k < w + h; k += 34) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke();
      c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke();
    }
    c.restore();
  }));
  const edge = toon('#F4EFE3');
  const left = mk(new THREE.BoxGeometry(0.07, L, W), [back, cardFace('7', '#E5484D'), edge, edge, edge, edge], -B / 2, RH / 2, 0);
  left.rotation.z = -phi;
  const right = mk(new THREE.BoxGeometry(0.07, L, W), [cardFace('7', '#4D7DDB'), back, edge, edge, edge, edge], B / 2, RH / 2, 0);
  right.rotation.z = phi;
  g.add(left, right);
  obs.push({ b: [-B + 0.12, 0, 0.14, W / 2] }, { b: [B - 0.12, 0, 0.14, W / 2] });
  // 용마루 위에 눕혀 얹은 카드 한 장 (뒷면 무늬가 위로)
  const topCard = mk(new THREE.BoxGeometry(2.3, 0.07, 2.9), [edge, edge, back, edge, edge, edge], 0, RH + 0.05, 0);
  topCard.rotation.y = 0.08;
  g.add(topCard);
  // 맨 위 '77 금지' 표지 (앞뒤 두 면)
  const noM = texMat(tex(256, 256, (c) => {
    c.fillStyle = '#FFFDF7'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
    c.fillStyle = '#3B3B42'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `112px ${FONT}`; c.fillText('77', 128, 134);
    c.strokeStyle = '#E5484D'; c.lineWidth = 24;
    c.beginPath(); c.arc(128, 128, 110, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(50, 50); c.lineTo(206, 206); c.stroke();
  }));
  const dy = RH + 0.6;
  for (const s of [1, -1]) {
    const d = mk(new THREE.CircleGeometry(0.46, 32), noM, 0, dy, s * 0.031);
    if (s < 0) d.rotation.y = Math.PI;
    g.add(d);
  }
  const rim = mk(new THREE.CylinderGeometry(0.47, 0.47, 0.056, 32), toon('#E5484D'), 0, dy, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  for (const s of [-1, 1]) {
    const sg = signBoard('77 피하기', { w: 1.5, h: 0.42, band: '#4D7DDB' });
    sg.position.set(0, 2.2, s * (W / 2 + 0.06));
    g.add(sg);
  }
  // 칩 더미
  const chip = ['#E5484D', '#FFFDF7', '#4D7DDB', '#F6D55C'];
  const stack = (x, z, n) => {
    for (let k = 0; k < n; k++) g.add(mk(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), toon(chip[(k + n) % 4]), x + (((k * 37) % 5) - 2) * 0.008, 0.035 + k * 0.072, z));
    obs.push([x, z, 0.24]);
  };
  stack(-1.95, 1.65, 5);
  stack(-1.5, 1.95, 3);
  stack(1.95, 1.65, 7);
  return { g, obs };
}

// 숫자 암호: 하얀·검은 타일을 쌓은 기둥 위에 반은 낮(해), 반은 밤(달과 별)인 둥근 지붕. 앞에 큰 숫자 타일
function codeHouse(v) {
  const g = new THREE.Group(), obs = [];
  const lite = toon('#FAF6EC'), dark = toon('#2F3440');
  CORNERS.forEach(([sx, sz], i) => {
    for (let k = 0; k < 9; k++) {
      const t = mk(new THREE.BoxGeometry(0.32, 0.24, 0.18), (k + i) % 2 ? dark : lite, sx * P, 0.12 + k * 0.25, sz * P);
      t.rotation.y = (k % 2 ? 1 : -1) * 0.12 + i * 0.4;
      g.add(t);
    }
    obs.push([sx * P, sz * P, 0.22]);
  });
  const DY = 2.3, DR = 2.15, SQ = 0.55;
  const domeL = mk(new THREE.SphereGeometry(DR, 24, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2), toon('#F4EFE3', { side: DS }), 0, DY, 0);
  const domeD = mk(new THREE.SphereGeometry(DR, 24, 10, Math.PI / 2, Math.PI, 0, Math.PI / 2), toon('#343A48', { side: DS }), 0, DY, 0);
  domeL.scale.y = SQ;
  domeD.scale.y = SQ;
  g.add(domeL, domeD);
  const rim = mk(new THREE.TorusGeometry(DR, 0.07, 8, 56), toon('#E0B84A'), 0, DY, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  // 밤 쪽 별 (밤에 반짝인다)
  const star = v.glow('#FFE27A');
  for (const [ph, th] of [[2.0, 0.55], [2.5, 0.95], [3.05, 0.5], [3.5, 0.85], [4.0, 1.15], [2.3, 1.25], [3.95, 0.45], [2.95, 1.2]]) {
    const x = -DR * Math.cos(ph) * Math.sin(th), y = DY + DR * Math.cos(th) * SQ, z = DR * Math.sin(ph) * Math.sin(th);
    g.add(mk(new THREE.SphereGeometry(0.07, 8, 6), star, x * 1.01, y + 0.02, z * 1.01));
  }
  // 낮 쪽 꼭대기에 해
  const sunM = toon('#F6A54C', { emissive: '#9A5A16' }), rayM = toon('#F6C445', { emissive: '#8A6A10' });
  const sx0 = -0.85, sy0 = 3.72;
  g.add(mk(new THREE.SphereGeometry(0.3, 16, 12), sunM, sx0, sy0, 0));
  for (let k = 0; k < 8; k++) {
    const an = (k / 8) * Math.PI * 2;
    const r = mk(new THREE.ConeGeometry(0.08, 0.2, 6), rayM, sx0 + Math.cos(an) * 0.44, sy0 + Math.sin(an) * 0.44, 0);
    r.rotation.z = an - Math.PI / 2;
    g.add(r);
  }
  // 밤 쪽 꼭대기에 초승달 (두 원이 겹친 모양을 두께 있게)
  const R1 = 0.4, R2 = 0.34, dd = 0.2;
  const x0 = (dd * dd + R1 * R1 - R2 * R2) / (2 * dd), y0 = Math.sqrt(R1 * R1 - x0 * x0);
  const al = Math.atan2(y0, x0), be = Math.atan2(y0, x0 - dd);
  const sh = new THREE.Shape();
  sh.absarc(0, 0, R1, al, Math.PI * 2 - al, false);
  sh.absarc(dd, 0, R2, Math.PI * 2 - be, be, true);
  const mg = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 16 });
  mg.translate(0, 0, -0.05);
  const moon = mk(mg, v.glow('#F6E27A'), 0.85, 3.74, 0);
  moon.rotation.z = 0.35;
  g.add(moon);
  for (const s of [-1, 1]) {
    const sg = signBoard('숫자 암호', { w: 1.6, h: 0.44, fg: '#2F3440', frame: '#2F3440', band: '#E0B84A' });
    sg.position.set(0, DY + 0.2, s * (DR + 0.06));
    sg.rotation.x = -s * 0.18;
    g.add(sg);
  }
  // 큰 숫자 타일: 하얀 3, 숨은 검은 타일
  const bigTile = (x, z, rot, txt, isLite) => {
    const bg = isLite ? '#FAF6EC' : '#2F3440', fg = isLite ? '#2F3440' : '#FAF6EC';
    const f = texMat(tex(128, 192, (c, w, h) => {
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      c.globalAlpha = 0.25; c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); c.globalAlpha = 1;
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `120px ${FONT}`; c.fillText(txt, w / 2, h / 2 + 6);
    }));
    const e = isLite ? lite : dark;
    const t = mk(new THREE.BoxGeometry(0.62, 0.92, 0.2), [e, e, e, e, f, f], x, 0.46, z);
    t.rotation.y = rot;
    g.add(t);
    obs.push([x, z, 0.34]);
  };
  bigTile(-1.95, 1.6, 0.35, '3', true);
  bigTile(1.95, 1.6, -0.35, '?', false);
  return { g, obs };
}

// 만칼라: 나무 퍼걸러에 덩굴이 얹힌 돌 정원. 양옆에 알록달록 돌을 담은 돌그릇이 세 개씩, 앞에 디딤돌
function mancalaHouse() {
  const g = new THREE.Group(), obs = [];
  const wood = toon('#8B5E3C'), wood2 = toon('#A9784A');
  for (const [sx, sz] of CORNERS) {
    g.add(mk(new THREE.BoxGeometry(0.17, 2.4, 0.17), wood, sx * P, 1.2, sz * P));
    obs.push([sx * P, sz * P, 0.16]);
  }
  for (const s of [-1, 1]) g.add(mk(new THREE.BoxGeometry(3.6, 0.17, 0.14), wood, 0, 2.4, s * P));
  for (let k = 0; k < 9; k++) g.add(mk(new THREE.BoxGeometry(0.09, 0.1, 3.5), wood2, -1.6 + k * 0.4, 2.535, 0));
  const leaf = [toon('#5DAF5A'), toon('#4A9A4E'), toon('#73BF5E')];
  const flower = [toon('#F6A2C4'), toon('#FFFDF7'), toon('#F6D55C')];
  const rr = seeded(7);
  for (let k = 0; k < 26; k++) {
    const x = -1.75 + rr() * 3.5, z = k < 16 ? (k % 2 ? 1 : -1) * P + (rr() - 0.5) * 0.3 : (rr() - 0.5) * 2.6;
    const r = 0.14 + rr() * 0.12, y = 2.6 + rr() * 0.05;
    const m = mk(new THREE.SphereGeometry(r, 10, 8), leaf[k % 3], x, y, z);
    m.scale.y = 0.7;
    g.add(m);
    if (k % 4 === 0) g.add(mk(new THREE.SphereGeometry(0.05, 8, 6), flower[(k / 4) % 3], x + 0.08, y + r * 0.7, z + 0.05));
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) g.add(mk(new THREE.SphereGeometry(0.11, 8, 6), leaf[k % 3], sx * P + Math.cos(k * 1.9) * 0.1, 2.25 - k * 0.38, P + Math.sin(k * 1.9) * 0.1));
  for (const s of [-1, 1]) {
    const sg = signBoard('만칼라', { w: 1.2, h: 0.4, band: '#8E603E' });
    sg.position.set(0, 2.32, s * (P + 0.1));
    g.add(sg);
  }
  const bowlM = toon('#9C9486'), bowlIn = toon('#6F685C');
  const stones = ['#EF6461', '#4D7DDB', '#F6D55C', '#6FD3C0', '#F6A2C4', '#FFFDF7'];
  let n = 0;
  for (const sx of [-1, 1]) for (const z of [-0.62, 0, 0.62]) {
    const x = sx * 1.82;
    g.add(mk(new THREE.CylinderGeometry(0.27, 0.21, 0.2, 16), bowlM, x, 0.1, z));
    g.add(mk(new THREE.CylinderGeometry(0.21, 0.21, 0.012, 16), bowlIn, x, 0.2, z));
    const c = 3 + (n % 3);
    for (let i = 0; i < c; i++) {
      const an = i * 2.4 + n, rd = i ? 0.1 : 0;
      g.add(mk(new THREE.SphereGeometry(0.055, 8, 6), toon(stones[(n + i) % 6]), x + Math.cos(an) * rd, 0.24, z + Math.sin(an) * rd));
    }
    obs.push([x, z, 0.28]);
    n++;
  }
  const step = toon('#B8B0A2');
  for (const [x, z] of [[-0.12, 1.85], [0.14, 2.25]]) g.add(mk(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 12), step, x, 0.015, z));
  return { g, obs };
}

// 땅따먹기: 네 색 연필(놀이의 네 자리 색) 기둥이 점과 선을 그린 모눈종이 지붕을 받친 공방. 앞에 큰 지우개와 크레파스
function dotsHouse() {
  const g = new THREE.Group(), obs = [];
  const pc = ['#E5484D', '#4D7DDB', '#3FA34D', '#DE9A12'];
  const eraser = toon('#F4A6B8'), metal = toon('#C9CDD3'), woodTip = toon('#F1D3A1'), lead = toon('#3B3B42');
  CORNERS.forEach(([sx, sz], i) => {
    const x = sx * P, z = sz * P;
    g.add(mk(flat(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 6)), eraser, x, 0.11, z));
    g.add(mk(new THREE.CylinderGeometry(0.158, 0.158, 0.14, 12), metal, x, 0.29, z));
    g.add(mk(flat(new THREE.CylinderGeometry(0.15, 0.15, 2.1, 6)), toon(pc[i]), x, 1.41, z));
    g.add(mk(flat(new THREE.ConeGeometry(0.15, 0.34, 6)), woodTip, x, 2.73, z));
    g.add(mk(flat(new THREE.ConeGeometry(0.06, 0.12, 6)), lead, x, 2.84, z));
    obs.push([x, z, 0.17]);
  });
  const paper = texMat(tex(512, 512, (c, w) => {
    c.fillStyle = '#FFFDF7'; c.fillRect(0, 0, w, w);
    c.strokeStyle = '#CFE3F2'; c.lineWidth = 2;
    for (let k = 0; k <= 32; k++) {
      c.beginPath(); c.moveTo(k * 16, 0); c.lineTo(k * 16, w); c.stroke();
      c.beginPath(); c.moveTo(0, k * 16); c.lineTo(w, k * 16); c.stroke();
    }
    const N = 6, m = 64, st = (w - 2 * m) / (N - 1), q = (i) => m + i * st;
    const box = (i, j, col) => { c.globalAlpha = 0.35; c.fillStyle = col; c.fillRect(q(i), q(j), st, st); c.globalAlpha = 1; };
    const line = (i1, j1, i2, j2, col) => { c.strokeStyle = col; c.beginPath(); c.moveTo(q(i1), q(j1)); c.lineTo(q(i2), q(j2)); c.stroke(); };
    const closed = (i, j, col) => { box(i, j, col); line(i, j, i + 1, j, col); line(i, j + 1, i + 1, j + 1, col); line(i, j, i, j + 1, col); line(i + 1, j, i + 1, j + 1, col); };
    c.lineCap = 'round'; c.lineWidth = 9;
    closed(0, 0, pc[0]); closed(1, 0, pc[0]); closed(3, 2, pc[1]); closed(1, 3, pc[2]); closed(4, 4, pc[3]);
    line(1, 2, 2, 2, pc[0]); line(0, 3, 0, 4, pc[1]); line(4, 0, 5, 0, pc[2]); line(5, 1, 5, 2, pc[3]); line(3, 0, 3, 1, pc[1]);
    c.fillStyle = '#4A3424';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { c.beginPath(); c.arc(q(i), q(j), 11, 0, 7); c.fill(); }
  }));
  const edgeM = toon('#E9E2D0'), under = toon('#F6F1E4');
  g.add(mk(new THREE.BoxGeometry(3.6, 0.1, 3.6), [edgeM, edgeM, paper, under, edgeM, edgeM], 0, 2.51, 0));
  for (const s of [-1, 1]) {
    const sg = signBoard('땅따먹기', { w: 1.5, h: 0.42, band: '#3FA34D' });
    sg.position.set(0, 2.24, s * 1.74);
    g.add(sg);
  }
  // 큰 지우개
  const er = new THREE.Group();
  er.add(mk(new THREE.BoxGeometry(0.34, 0.3, 0.3), toon('#FFFDF7'), 0, 0.15, -0.14));
  er.add(mk(new THREE.BoxGeometry(0.36, 0.32, 0.32), toon('#4D7DDB'), 0, 0.16, 0.14));
  er.position.set(-1.95, 0, 1.55);
  er.rotation.y = 0.5;
  g.add(er);
  obs.push([-1.95, 1.55, 0.34]);
  // 누워 있는 큰 크레파스
  const cr = new THREE.Group();
  cr.add(mk(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 12), toon('#E5484D'), 0, 0, 0));
  cr.add(mk(new THREE.CylinderGeometry(0.116, 0.116, 0.46, 12), toon('#FFFDF7'), 0, -0.06, 0));
  cr.add(mk(new THREE.ConeGeometry(0.11, 0.2, 12), toon('#E5484D'), 0, 0.5, 0));
  cr.position.set(1.9, 0.11, 1.55);
  cr.rotation.set(0, -0.4, Math.PI / 2);
  g.add(cr);
  obs.push([1.9, 1.55, 0.42]);
  return { g, obs };
}
const HOUSES = { fruit: fruitHouse, yut: yutHouse, n77: n77House, code: codeHouse, mancala: mancalaHouse, dots: dotsHouse };

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
      // 탁자 밑 둥근 자리 (놀이마다 색이 다르다)
      for (const t of BG_TABLES) {
        ctx.fillStyle = t.pad;
        ctx.beginPath(); ctx.arc(px(t.x - I.x), px(t.z - I.z), PAD_R * u, 0, Math.PI * 2); ctx.fill();
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
    // 의자 넷 (만칼라는 둘): 탁자 기준 +z가 섬 바깥
    for (const k of t.stools) {
      const { lx, lz } = t.seats[k];
      g.add(mk(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18), stoolTop, lx, 0.42 - 0.03, lz));
      g.add(mk(new THREE.CylinderGeometry(0.05, 0.07, 0.38, 10), dark, lx, 0.19, lz));
    }
    const top = tableTop(t.id, 0.775);
    g.add(top);
    mergeColored(g, HVC);
    v.spot('bg_' + t.id, t.name, g, { x: t.x, z: t.z, rot: t.rot, door: SEAT_D + 0.25 });
    v.addObstacleCircle(t.x, t.z, 0.66, true);
    // 그 놀이의 작은 집: 탁자와 따로 두어, 내가 안에 들어가거나 집이 나를 가릴 때 집만 흐려진다
    const { g: house, obs } = HOUSES[t.id](v);
    house.position.set(t.x, 0, t.z);
    house.rotation.y = t.rot;
    house.userData.pick = { type: 'building', id: 'bg_' + t.id };
    mergeColored(house, HVC);
    mergeColored(house, HVC2);
    mergeStatic(house);
    scene.add(house);
    v.pickRoots.push(house);
    const f = v.makeFadeable(house, t.x, t.z, 2.2);
    f.near = 2.4;
    const c = Math.cos(t.rot), s = Math.sin(t.rot);
    const wx = (lx, lz) => t.x + lx * c + lz * s, wz = (lx, lz) => t.z - lx * s + lz * c;
    for (const o of obs) {
      if (o.b) { const [lx, lz, hw, hd] = o.b; v.addObstacleBox(wx(lx, lz), wz(lx, lz), hw, hd, t.rot); }
      else { const [lx, lz, r] = o; v.addObstacleCircle(wx(lx, lz), wz(lx, lz), r, true); }
    }
  }
  // 섬 둘레 나무와 꽃
  const trees = [[-12.2, 1.5], [-11.4, -5.8], [-8.5, 9.4], [-3, 12.6], [3.5, 12.3], [9.2, 8.6], [-8.6, -10.1], [-2.6, -12.8], [3.6, -12.4], [9.4, -8.7]];
  trees.forEach(([dx, dz], k) => {
    const tr = makeTree(k % 3 ? 'round' : 'round', 0.85 + (k % 3) * 0.1);
    tr.position.set(I.x + dx, 0, I.z + dz);
    scene.add(tr);
    v.addObstacleCircle(I.x + dx, I.z + dz, 0.45);
  });
  // 길가 등불 (밤에 켜진다): 이웃한 두 집 사이 가운데, 다리 쪽 길은 비켜서
  for (const deg of BG_GAPS.map((d) => d || 10)) {
    const a = (deg * Math.PI) / 180;
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
