// 진숲 어린이 마을 — 내 집: 방, 마당, 밭을 꾸민다
// 내 집은 마을과 떨어진 따로 된 장면(scene)이다. 마을 섬과 겹치지 않게 멀리(HOME_O) 둔다.
// 들어가면 내 주민과 애완동물, 해와 하늘빛이 이 장면으로 옮겨 오고, 나가면 마을로 돌아간다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient, Avatar } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { makeTree } from './isles.js';
import {
  HOME_ITEMS, ROOM, GARDEN, ISLAND, footprint, centerOf, canPlace, cellZone, growStage, isSeed,
} from './homeitems.js';

export const HOME_O = { x: 1000, z: 1000 };
// 앉거나 누울 수 있는 가구: seats(물건 안 자리 x, z), y(뿌리 높이: 앉으면 발, 누우면 엉덩이), front(앞에 서는 곳 z), side(침대 옆),
// turn(앉아서 보는 쪽을 돌린다: 피아노 의자는 건반 쪽을 본다), swing(그네: 앉으면 발판과 함께 흔들린다)
const SWING_REST = 0.3, SWING_MAX = 1.0, SWING_W = 2.45; // 그네: 가만히 탈 때 흔들림, 가장 높이, 흔들리는 빠르기(라디안/초, 한 번 오가는 데 약 2.6초)
// 미끄럼틀: 미끄럼판 기울기(라디안)와 판 가운데 (물건 안 좌표)
export const SLIDE_TILT = Math.atan2(1.32, 2.15);
const SLIDE_C = { y: 0.8, z: 0.25 };
const REST = {
  h_bed: { lie: true, seats: [[0, -0.05]], y: 0.86, side: 1.45, front: 1.95 },
  h_sofa: { seats: [[-0.38, 0.06], [0.38, 0.06]], y: 0.3, front: 0.95 },
  h_chair: { seats: [[0, 0.02]], y: 0.29, front: 0.8 },
  y_bench: { seats: [[-0.45, 0.02], [0.45, 0.02]], y: 0.24, front: 0.85 },
  h_piano: { seats: [[0, 0.64]], y: 0.22, front: 1.25, turn: Math.PI },
  y_swing: { seats: [[0, 0.02]], y: 0.33, front: 1.4, swing: true },
};
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const DOOR_IN = { x: -2.7, z: -6.5 }, DOOR_OUT = { x: -1.0, z: -6.5 };
const GATE = { x: 0, z: 9.2 }, CLOSET = { x: -9.45, z: -8.55 };
const WALK = { x0: ISLAND.x0 + 0.6, x1: ISLAND.x1 - 0.6, z0: ISLAND.z0 + 0.6, z1: ISLAND.z1 - 0.7 };
const PR = 0.42;

// ---------- 모양 도우미 ----------
function m(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (g, w, h, d, c, x, y, z) => { const o = m(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? toon(c) : c, x, y, z); g.add(o); return o; };
const cyl = (g, rt, rb, h, c, x, y, z, seg = 16) => { const o = m(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? toon(c) : c, x, y, z); g.add(o); return o; };
const ball = (g, r, c, x, y, z, seg = 12) => { const o = m(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)), typeof c === 'string' ? toon(c) : c, x, y, z); g.add(o); return o; };
function hash(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) | 0; return Math.abs(x); }
function prismGeo(width, height, depth) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, height); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ---------- 물건 모양 (가운데가 (0,0), 앞이 +z) ----------
// glow(c): 밤에 빛나는 재질. 반환: { g, anim } (anim: 움직이는 부분)
export function buildItem(id, glow) {
  const g = new THREE.Group();
  const anim = {};
  const W = '#B07F4E', WD = '#8B5E3C';
  switch (id) {
    case 'h_bed':
      box(g, 1.8, 0.32, 2.8, W, 0, 0.28, 0);
      box(g, 1.7, 0.2, 2.65, '#FFFDF7', 0, 0.54, 0.02);
      box(g, 1.74, 0.2, 1.8, '#5FA9E0', 0, 0.6, 0.45);
      box(g, 1.74, 0.05, 0.2, '#FFFDF7', 0, 0.71, -0.42);
      box(g, 0.95, 0.16, 0.45, '#FFF6E0', 0, 0.72, -1.05);
      box(g, 1.8, 1.0, 0.12, WD, 0, 0.6, -1.4);
      ball(g, 0.1, '#F6D55C', -0.7, 1.12, -1.4, 8); ball(g, 0.1, '#F6D55C', 0.7, 1.12, -1.4, 8);
      for (const x of [-0.8, 0.8]) box(g, 0.12, 0.18, 0.12, WD, x, 0.09, 1.3);
      break;
    case 'h_desk':
      box(g, 1.8, 0.08, 0.8, W, 0, 0.76, 0);
      for (const x of [-0.82, 0.82]) for (const z of [-0.32, 0.32]) box(g, 0.08, 0.72, 0.08, WD, x, 0.36, z);
      box(g, 0.6, 0.35, 0.7, W, 0.55, 0.52, 0);
      ball(g, 0.04, '#F6D55C', 0.55, 0.52, 0.37, 6);
      box(g, 0.5, 0.03, 0.36, '#FFFDF7', -0.3, 0.815, 0.05);
      box(g, 0.32, 0.03, 0.03, '#F6D55C', -0.3, 0.84, 0.2);
      cyl(g, 0.07, 0.06, 0.18, '#5FA9E0', 0.6, 0.89, -0.2, 10);
      break;
    case 'h_chair':
      box(g, 0.52, 0.08, 0.52, W, 0, 0.46, 0);
      for (const x of [-0.22, 0.22]) for (const z of [-0.22, 0.22]) box(g, 0.07, 0.45, 0.07, WD, x, 0.22, z);
      box(g, 0.52, 0.5, 0.07, W, 0, 0.74, -0.23);
      box(g, 0.44, 0.06, 0.44, '#EF8FA0', 0, 0.52, 0.01);
      break;
    case 'h_sofa':
      box(g, 1.8, 0.36, 0.8, '#EF8FA0', 0, 0.26, 0.02);
      box(g, 1.8, 0.55, 0.22, '#E07587', 0, 0.62, -0.3);
      for (const x of [-0.86, 0.86]) box(g, 0.2, 0.36, 0.8, '#E07587', x, 0.5, 0.02);
      for (const x of [-0.38, 0.38]) box(g, 0.74, 0.12, 0.6, '#F6A2C4', x, 0.5, 0.08);
      box(g, 0.34, 0.3, 0.1, '#FFE08A', -0.5, 0.72, -0.15);
      for (const x of [-0.8, 0.8]) box(g, 0.1, 0.08, 0.1, WD, x, 0.04, 0.3);
      break;
    case 'h_shelf': {
      box(g, 1.8, 1.9, 0.08, WD, 0, 0.95, -0.18);
      for (const x of [-0.87, 0.87]) box(g, 0.08, 1.9, 0.44, W, x, 0.95, 0);
      for (const y of [0.05, 0.62, 1.22, 1.86]) box(g, 1.8, 0.07, 0.44, W, 0, y, 0);
      const cols = ['#EF6461', '#5FA9E0', '#F6D55C', '#5DB760', '#A07FE3', '#F49A4C'];
      let k = 0;
      for (const y of [0.09, 0.66, 1.26]) {
        let x = -0.78;
        while (x < 0.7) {
          const w = 0.08 + ((k * 7) % 4) * 0.02, h = 0.34 + ((k * 5) % 3) * 0.06;
          box(g, w, h, 0.3, cols[k % cols.length], x + w / 2, y + h / 2, 0.02);
          x += w + 0.015; k++;
          if (k % 9 === 4) x += 0.18;
        }
      }
      break;
    }
    case 'h_table':
      cyl(g, 0.42, 0.42, 0.06, W, 0, 0.6, 0, 20);
      cyl(g, 0.05, 0.05, 0.58, WD, 0, 0.3, 0, 8);
      cyl(g, 0.22, 0.26, 0.04, WD, 0, 0.02, 0, 14);
      cyl(g, 0.12, 0.12, 0.02, '#FFFDF7', 0.1, 0.64, 0.05, 12);
      cyl(g, 0.06, 0.05, 0.09, '#FFFDF7', 0.1, 0.69, 0.05, 10);
      break;
    case 'h_rug':
      cyl(g, 0.95, 0.95, 0.02, '#F49A4C', 0, 0.012, 0, 32);
      cyl(g, 0.75, 0.75, 0.02, '#FFE08A', 0, 0.018, 0, 32);
      cyl(g, 0.52, 0.52, 0.02, '#5FA9E0', 0, 0.024, 0, 28);
      cyl(g, 0.28, 0.28, 0.02, '#F6A2C4', 0, 0.03, 0, 24);
      break;
    case 'h_lamp': {
      cyl(g, 0.18, 0.22, 0.06, '#6B6B78', 0, 0.03, 0, 14);
      cyl(g, 0.03, 0.03, 1.25, '#6B6B78', 0, 0.66, 0, 6);
      const shade = cyl(g, 0.16, 0.3, 0.34, '#FFE08A', 0, 1.36, 0, 16);
      shade.castShadow = false;
      ball(g, 0.11, glow('#FFF2B3'), 0, 1.24, 0, 10);
      break;
    }
    case 'h_pot':
      cyl(g, 0.24, 0.18, 0.36, '#D9784E', 0, 0.18, 0, 14);
      cyl(g, 0.26, 0.26, 0.06, '#C9683E', 0, 0.37, 0, 14);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const lf = ball(g, 0.2, i % 2 ? '#5DB760' : '#4FA64A', Math.cos(a) * 0.14, 0.62 + (i % 3) * 0.12, Math.sin(a) * 0.14, 10);
        lf.scale.set(0.6, 1.3, 0.6);
      }
      ball(g, 0.18, '#6DBE5A', 0, 0.86, 0, 10);
      break;
    case 'h_toys':
      box(g, 0.72, 0.42, 0.6, '#F6D55C', 0, 0.21, 0);
      box(g, 0.76, 0.06, 0.64, '#F49A4C', 0, 0.44, 0);
      ball(g, 0.18, '#C98B4E', -0.12, 0.6, -0.05, 12);
      ball(g, 0.07, '#C98B4E', -0.25, 0.74, -0.05, 8); ball(g, 0.07, '#C98B4E', 0.01, 0.74, -0.05, 8);
      ball(g, 0.06, '#FFF3DA', -0.12, 0.56, 0.11, 8);
      ball(g, 0.14, '#EF6461', 0.2, 0.56, 0.1, 12);
      break;
    case 'h_piano':
      box(g, 1.6, 1.05, 0.5, '#5A3D2B', 0, 0.55, -0.1);
      box(g, 1.6, 0.08, 0.32, '#5A3D2B', 0, 0.74, 0.28);
      box(g, 1.45, 0.04, 0.24, '#FFFDF7', 0, 0.8, 0.3);
      for (let i = 0; i < 9; i++) if (i % 7 !== 2 && i % 7 !== 6) box(g, 0.06, 0.04, 0.13, '#2E2A2A', -0.6 + i * 0.15, 0.83, 0.25);
      box(g, 0.6, 0.06, 0.32, '#EF6461', 0, 0.45, 0.62);
      for (const x of [-0.25, 0.25]) box(g, 0.06, 0.42, 0.06, '#5A3D2B', x, 0.21, 0.62);
      box(g, 0.5, 0.3, 0.02, '#FFFDF7', 0, 1.2, 0.16);
      break;
    // 마당
    case 'y_bench':
      for (const z of [-0.12, 0.06, 0.24]) box(g, 1.8, 0.07, 0.16, W, 0, 0.46, z);
      for (const y of [0.68, 0.86]) box(g, 1.8, 0.14, 0.06, W, 0, y, -0.3);
      for (const x of [-0.75, 0.75]) { box(g, 0.1, 0.46, 0.5, '#4A4A55', x, 0.23, 0); box(g, 0.08, 0.56, 0.08, '#4A4A55', x, 0.74, -0.3); }
      break;
    case 'y_lamp':
      cyl(g, 0.16, 0.2, 0.12, '#4A4A55', 0, 0.06, 0, 10);
      cyl(g, 0.05, 0.06, 1.55, '#4A4A55', 0, 0.85, 0, 8);
      ball(g, 0.22, glow('#FFF4CF'), 0, 1.78, 0, 14);
      cyl(g, 0.02, 0.2, 0.12, '#4A4A55', 0, 2.02, 0, 10);
      break;
    case 'y_swing': {
      for (const s of [-1, 1]) {
        for (const z of [-0.5, 0.5]) {
          const leg = cyl(g, 0.06, 0.07, 2.3, '#EF6461', s * 1.25, 1.1, z * 0.75, 8);
          leg.rotation.x = -z * 0.42;
        }
      }
      const bar = cyl(g, 0.07, 0.07, 2.7, '#EF6461', 0, 2.16, 0, 8);
      bar.rotation.z = Math.PI / 2;
      const seat = new THREE.Group();
      seat.position.set(0, 2.12, 0);
      for (const x of [-0.3, 0.3]) box(seat, 0.025, 1.55, 0.025, '#8A8F98', x, -0.78, 0);
      box(seat, 0.72, 0.06, 0.32, '#F6D55C', 0, -1.56, 0);
      g.add(seat);
      seat.traverse((o) => { if (o.isMesh) o.userData.noMerge = true; });
      anim.swing = seat;
      // 그네를 탄 주민이 붙는 자리 (발판 위에 앉은 뿌리 자리: 앉는 판 0.26 아래)
      const rider = new THREE.Object3D();
      rider.position.set(0, -1.79, 0.02);
      seat.add(rider);
      anim.rider = rider;
      break;
    }
    case 'y_fountain': {
      cyl(g, 0.92, 0.98, 0.36, '#B9B3A8', 0, 0.18, 0, 24);
      cyl(g, 0.8, 0.8, 0.04, '#7FD0EE', 0, 0.34, 0, 24);
      cyl(g, 0.14, 0.18, 0.75, '#B9B3A8', 0, 0.62, 0, 12);
      cyl(g, 0.38, 0.2, 0.14, '#B9B3A8', 0, 1.02, 0, 16);
      cyl(g, 0.32, 0.32, 0.03, '#7FD0EE', 0, 1.08, 0, 16);
      const drops = new THREE.Group();
      const dm = toon('#BFEAFB');
      for (let i = 0; i < 6; i++) { const d = ball(drops, 0.05, dm, 0, 1.2, 0, 6); d.userData.noMerge = true; d.castShadow = false; }
      g.add(drops);
      anim.drops = drops;
      break;
    }
    case 'y_birdhouse':
      cyl(g, 0.05, 0.06, 1.2, WD, 0, 0.6, 0, 8);
      box(g, 0.42, 0.42, 0.42, '#5FA9E0', 0, 1.4, 0);
      { const r = m(prismGeo(0.6, 0.3, 0.5), toon('#EF6461'), 0, 1.61, 0); g.add(r); }
      cyl(g, 0.08, 0.08, 0.02, '#2E2A2A', 0, 1.45, 0.21, 12).rotation.x = Math.PI / 2;
      box(g, 0.04, 0.04, 0.16, WD, 0, 1.33, 0.27);
      ball(g, 0.08, '#F6D55C', 0.08, 1.92, 0.05, 10);
      break;
    case 'y_picnic':
      box(g, 1.6, 0.08, 0.9, W, 0, 0.74, 0);
      for (const x of [-0.65, 0.65]) box(g, 0.08, 0.72, 0.7, WD, x, 0.37, 0);
      for (const z of [-0.72, 0.72]) {
        box(g, 1.6, 0.07, 0.3, W, 0, 0.44, z);
        for (const x of [-0.65, 0.65]) box(g, 0.07, 0.42, 0.07, WD, x, 0.21, z);
      }
      box(g, 0.7, 0.01, 0.5, '#EF6461', 0, 0.785, 0);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2) box(g, 0.23, 0.012, 0.16, '#FFFDF7', i * 0.233, 0.79, j * 0.166);
      ball(g, 0.08, '#EF6461', 0.4, 0.86, -0.15, 8);
      break;
    case 'y_tree': {
      const t = makeTree('round', 0.62);
      g.add(t);
      break;
    }
    case 'y_slide': {
      for (const x of [-0.3, 0.3]) box(g, 0.07, 1.6, 0.07, '#5FA9E0', x, 0.8, -1.35);
      for (let i = 0; i < 4; i++) box(g, 0.6, 0.05, 0.06, '#5FA9E0', 0, 0.3 + i * 0.36, -1.35);
      for (const x of [-0.3, 0.3]) box(g, 0.07, 1.4, 0.07, '#5FA9E0', x, 0.7, -0.85);
      box(g, 0.66, 0.08, 0.56, '#F6D55C', 0, 1.42, -1.1);
      const ch = box(g, 0.56, 0.06, 2.3, '#EF6461', 0, 0.8, 0.25);
      ch.rotation.x = SLIDE_TILT; // 사다리 쪽(뒤)이 높고 앞이 낮다
      for (const x of [-0.3, 0.3]) { const rl = box(g, 0.06, 0.16, 2.3, '#F49A4C', x, 0.88, 0.25); rl.rotation.x = ch.rotation.x; }
      break;
    }
    case 'y_mailbox':
      box(g, 0.08, 0.95, 0.08, WD, 0, 0.47, 0);
      box(g, 0.36, 0.3, 0.5, '#EF6461', 0, 1.06, 0);
      cyl(g, 0.18, 0.18, 0.5, '#EF6461', 0, 1.2, 0, 14).rotation.x = Math.PI / 2;
      box(g, 0.03, 0.22, 0.03, '#F6D55C', 0.2, 1.24, 0.1);
      box(g, 0.03, 0.08, 0.14, '#F6D55C', 0.2, 1.32, 0.16);
      break;
    default:
      if (isSeed(id)) return buildPlant(id, 3, 'thumb');
      box(g, 0.5, 0.5, 0.5, '#ccc', 0, 0.25, 0);
  }
  return { g, anim };
}

// 밭의 식물 (stage 0: 씨앗 심은 흙, 1: 싹, 2: 자라는 중, 3: 다 자람)
// n: 열매를 딴 횟수 (토마토·딸기는 딴 뒤에도 잎이 다 자란 채로 남는다)
export function buildPlant(id, stage, seed = '', n = 0) {
  const g = new THREE.Group();
  const anim = {};
  const kind = id.slice(2);
  const L = '#5DB760', L2 = '#4FA64A';
  ball(g, 0.3, '#7A5233', 0, 0.02, 0, 10).scale.set(1, 0.32, 1);
  if (stage === 0) {
    for (const [x, z] of [[-0.08, 0.02], [0.07, -0.05], [0.02, 0.09]]) ball(g, 0.035, '#E9C88F', x, 0.11, z, 6);
    return { g, anim };
  }
  const leaf = (x, y, z, s, ry, c = L) => { const o = ball(g, 0.12 * s, c, x, y, z, 8); o.scale.set(1.5, 0.35, 0.8); o.rotation.y = ry; o.rotation.z = 0.3; return o; };
  if (stage === 1) {
    cyl(g, 0.015, 0.02, 0.18, L2, 0, 0.17, 0, 5);
    leaf(-0.07, 0.27, 0, 0.7, 0); leaf(0.07, 0.27, 0, 0.7, Math.PI);
    return { g, anim };
  }
  const grown = stage === 3;
  const s = grown || n > 0 ? 1 : 0.65;
  switch (kind) {
    case 'carrot':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const st = cyl(g, 0.012, 0.018, 0.45 * s, L, Math.cos(a) * 0.05, 0.25 * s + 0.05, Math.sin(a) * 0.05, 5); st.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); ball(g, 0.07 * s, L2, Math.cos(a) * 0.14 * s, 0.5 * s + 0.04, Math.sin(a) * 0.14 * s, 6); }
      if (grown) cyl(g, 0.11, 0.07, 0.12, '#F49A4C', 0, 0.1, 0, 10);
      break;
    case 'tomato':
      cyl(g, 0.02, 0.02, 0.9 * s, '#C9A06E', 0.12, 0.45 * s, -0.08, 5);
      cyl(g, 0.02, 0.025, 0.7 * s, L2, 0, 0.35 * s, 0, 5);
      for (let i = 0; i < 6; i++) leaf(Math.cos(i * 2.1) * 0.12, 0.2 + i * 0.1 * s, Math.sin(i * 2.1) * 0.12, 1 * s, i * 2.1);
      if (grown) for (const [x, y, z] of [[0.12, 0.42, 0.1], [-0.12, 0.55, 0.06], [0.05, 0.3, -0.12]]) ball(g, 0.09, '#EF4A3E', x, y, z, 10);
      break;
    case 'cabbage':
      ball(g, 0.26 * s, '#9BD971', 0, 0.2 * s, 0, 12).scale.set(1, 0.85, 1);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; leaf(Math.cos(a) * 0.22 * s, 0.12, Math.sin(a) * 0.22 * s, 1.6 * s, -a, '#7CC456'); }
      if (grown) ball(g, 0.18, '#C9EBA0', 0, 0.36, 0, 10);
      break;
    case 'strawberry':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; leaf(Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14, 1.2 * s, -a, L2); }
      if (grown) for (const [x, z] of [[0.18, 0.08], [-0.15, 0.14], [0.02, -0.2]]) { const b = ball(g, 0.07, '#E8394B', x, 0.08, z, 8); b.scale.set(1, 1.2, 1); ball(g, 0.03, L, x, 0.17, z, 5); }
      break;
    case 'sunflower': {
      const h = grown ? 1.5 : 0.7;
      cyl(g, 0.03, 0.04, h, L2, 0, h / 2, 0, 6);
      leaf(0.12, h * 0.4, 0, 1.3, 0); leaf(-0.12, h * 0.6, 0, 1.3, Math.PI);
      if (grown) {
        const head = new THREE.Group();
        head.position.set(0, h + 0.05, 0.05);
        head.rotation.x = 0.35;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const p = ball(head, 0.1, '#FFD23F', Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, 8); p.scale.set(0.5, 1.1, 0.25); p.rotation.z = a - Math.PI / 2; }
        ball(head, 0.14, '#7A5233', 0, 0, 0.03, 10).scale.set(1, 1, 0.4);
        g.add(head);
        anim.sway = head;
      }
      break;
    }
    case 'tulip': {
      const h = grown ? 0.6 : 0.3;
      cyl(g, 0.018, 0.022, h, L2, 0, h / 2, 0, 5);
      leaf(0.07, 0.12, 0, 1.2, 0.3); leaf(-0.07, 0.16, 0, 1.2, Math.PI - 0.3);
      if (grown) {
        const c = ['#EF4A6A', '#FFD23F', '#F6A2C4', '#A07FE3'][hash(seed) % 4];
        cyl(g, 0.12, 0.07, 0.2, c, 0, h + 0.08, 0, 6);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const p = ball(g, 0.07, c, Math.cos(a) * 0.07, h + 0.2, Math.sin(a) * 0.07, 6); p.scale.set(0.8, 1.3, 0.8); }
      }
      break;
    }
    default:
      leaf(0, 0.2, 0, 1.4, 0);
  }
  return { g, anim };
}

// 거둔 채소와 열매 하나 (나눔 수레, 먹을 때 손에 든 것). 바닥 가운데가 (0, 0, 0)
export function buildCrop(crop) {
  const g = new THREE.Group();
  const L = '#5DB760';
  if (crop === 'carrot') {
    const c = cyl(g, 0.055, 0.008, 0.24, '#F49A4C', 0, 0.12, 0, 8);
    c.rotation.z = Math.PI / 2;
    c.position.set(0.02, 0.055, 0);
    for (let i = 0; i < 3; i++) { const st = cyl(g, 0.008, 0.012, 0.13, L, -0.13, 0.08, (i - 1) * 0.025, 5); st.rotation.z = 1.2 + i * 0.12; }
  } else if (crop === 'tomato') {
    ball(g, 0.075, '#EF4A3E', 0, 0.07, 0, 12).scale.set(1, 0.85, 1);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const lf = ball(g, 0.025, L, Math.cos(a) * 0.025, 0.135, Math.sin(a) * 0.025, 6); lf.scale.set(1.4, 0.4, 0.6); lf.rotation.y = -a; }
  } else if (crop === 'cabbage') {
    ball(g, 0.11, '#C9EBA0', 0, 0.1, 0, 12).scale.set(1, 0.9, 1);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const lf = ball(g, 0.09, '#7CC456', Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06, 8); lf.scale.set(1, 0.9, 0.5); lf.rotation.y = -a + Math.PI / 2; }
  } else {
    const b = ball(g, 0.05, '#E8394B', 0, 0.06, 0, 10);
    b.scale.set(1, 1.25, 1);
    ball(g, 0.026, L, 0, 0.12, 0, 6).scale.set(1.6, 0.45, 1.6);
  }
  return g;
}

// ---------- 작은 그림 (상점과 꾸미기 판) ----------
const thumbs = new Map();
let thumbR = null, thumbScene = null, thumbCam = null;
function ensureThumbR() {
  if (thumbR) return;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  thumbR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbR.setPixelRatio(1);
  thumbR.setSize(128, 128, false);
  thumbScene = new THREE.Scene();
  thumbScene.add(new THREE.HemisphereLight('#ffffff', '#9CD07A', 1.9));
  const sun = new THREE.DirectionalLight('#FFF4E0', 1.6);
  sun.position.set(3, 6, 5);
  thumbScene.add(sun);
  thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
}
// 아무 3D 물건의 작은 그림 (애완동물 상점 칸 등). build()는 Group을 돌려준다. dir: 카메라가 보는 쪽
export function objThumb(key, build, dir = [0.15, 0.45, 1]) {
  if (thumbs.has(key)) return thumbs.get(key);
  try {
    ensureThumbR();
    const g = build();
    thumbScene.add(g);
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.5 + 0.03;
    const dist = r / Math.tan(THREE.MathUtils.degToRad(15));
    thumbCam.position.copy(ctr).addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
    thumbCam.lookAt(ctr);
    thumbR.setClearColor(0x000000, 0);
    thumbR.render(thumbScene, thumbCam);
    const url = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(g);
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    thumbs.set(key, url);
    return url;
  } catch (e) {
    return '';
  }
}
// 내 주민이 꾸미기 물건을 입은 작은 그림 (상점 목록). view: 'head' 머리, 'hair' 머리 모양(비스듬히 옆에서, 어깨까지), 'body' 앞모습, 'back' 뒷모습
export function avatarThumb(data, view = 'body') {
  const key = view + JSON.stringify(data);
  if (thumbs.has(key)) return thumbs.get(key);
  try {
    ensureThumbR();
    const av = new Avatar(data);
    av.update(0, false);
    av.body.position.y = 0;
    av.root.rotation.y = view === 'back' ? Math.PI - 0.6 : view === 'hair' ? 0.95 : 0.3;
    thumbScene.add(av.root);
    if (view === 'head') { thumbCam.position.set(0, 1.85, 3.7); thumbCam.lookAt(0, 1.5, 0); }
    else if (view === 'hair') { thumbCam.position.set(0, 1.75, 4.6); thumbCam.lookAt(0, 1.3, 0); }
    else { thumbCam.position.set(0, 1.45, 5.4); thumbCam.lookAt(0, 0.95, 0); }
    thumbR.setClearColor(0x000000, 0);
    thumbR.render(thumbScene, thumbCam);
    const url = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(av.root);
    av.dispose();
    thumbs.set(key, url);
    return url;
  } catch (e) {
    return '';
  }
}

export function itemThumb(id) {
  if (thumbs.has(id)) return thumbs.get(id);
  try {
    ensureThumbR();
    const glowM = new THREE.MeshToonMaterial({ color: '#FFF2B3', gradientMap: toonGradient(), emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.6 });
    const { g } = isSeed(id) ? buildPlant(id, 3, 'thumb') : buildItem(id, () => glowM);
    thumbScene.add(g);
    const bb = new THREE.Box3().setFromObject(g);
    const ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
    const dist = r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05;
    const dir = new THREE.Vector3(0.55, 0.62, 1).normalize();
    thumbCam.position.copy(ctr).addScaledVector(dir, dist);
    thumbCam.lookAt(ctr);
    thumbR.setClearColor(0x000000, 0);
    thumbR.render(thumbScene, thumbCam);
    const url = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(g);
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    thumbs.set(id, url);
    return url;
  } catch (e) {
    return '';
  }
}

function signTex(text, sub = '') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 144;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6B4429'; ctx.beginPath(); ctx.roundRect(0, 0, 512, 144, 34); ctx.fill();
  ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.roundRect(9, 9, 494, 126, 28); ctx.fill();
  ctx.fillStyle = '#6B4429'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = sub ? 54 : 62;
  const F = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.font = `${size}px ${F}`;
  while (ctx.measureText(text).width > 450 && size > 28) { size -= 2; ctx.font = `${size}px ${F}`; }
  ctx.fillText(text, 256, sub ? 56 : 75);
  if (sub) { ctx.font = `30px ${F}`; ctx.globalAlpha = 0.8; ctx.fillText(sub, 256, 108); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- 내 집 ----------
export class HomeSpace {
  constructor(v) {
    this.v = v;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#A6DDF6', 45, 110);
    this.root = new THREE.Group();
    this.root.position.set(HOME_O.x, 0, HOME_O.z);
    this.scene.add(this.root);
    this.obstacles = [];
    this.itemObs = [];
    this.items = new Map(); // id → { e, obj, anim, stage }
    this.layout = [];
    this.pickRoots = [];
    this.ghost = null;
    this.sel = null;
    this.t = 0;
    this.build();
  }

  // 마을 좌표 ↔ 집 안 좌표
  toLocal(p) { return { x: p.x - HOME_O.x, z: p.z - HOME_O.z }; }
  toWorld(x, z) { return new THREE.Vector3(x + HOME_O.x, 0, z + HOME_O.z); }

  build() {
    const R = this.root, v = this.v;
    // 바다와 모래
    const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 48), toon('#5FC3E6'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -1.15;
    R.add(sea);
    const sand = new THREE.Mesh(new THREE.BoxGeometry(ISLAND.x1 - ISLAND.x0 + 3, 0.6, ISLAND.z1 - ISLAND.z0 + 3), toon('#F3E2B4'));
    sand.position.set((ISLAND.x0 + ISLAND.x1) / 2, -1.05, (ISLAND.z0 + ISLAND.z1) / 2);
    sand.receiveShadow = true;
    R.add(sand);
    // 땅 (잔디, 돌길)
    const S = 1024, SX = ISLAND.x1 - ISLAND.x0, SZ = ISLAND.z1 - ISLAND.z0;
    const c = document.createElement('canvas');
    c.width = S; c.height = Math.round(S * SZ / SX);
    const ctx = c.getContext('2d');
    const u = S / SX;
    const px = (x) => (x - ISLAND.x0) * u, pz = (z) => (z - ISLAND.z0) * u;
    ctx.fillStyle = '#8DCC5F'; ctx.fillRect(0, 0, c.width, c.height);
    let sd = 7;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = ['#97D468', '#83C457', '#9BD971'][i % 3];
      ctx.beginPath(); ctx.ellipse(rnd() * c.width, rnd() * c.height, 8 + rnd() * 26, 6 + rnd() * 16, rnd() * 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 돌길: 대문에서 방문까지
    ctx.fillStyle = '#EAD7A8';
    const step = (x, z, r = 0.42) => { ctx.beginPath(); ctx.ellipse(px(x), pz(z), r * u, r * 0.8 * u, rnd(), 0, 7); ctx.fill(); };
    for (let z = 9.6; z > -3.2; z -= 0.95) { step(-0.5 + Math.sin(z) * 0.12, z); step(0.45 + Math.cos(z) * 0.1, z - 0.45, 0.36); }
    for (let z = -3.4; z > -7.2; z -= 0.9) step(-0.5, z);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const shape = new THREE.Shape();
    const rr = 1.6, { x0, x1, z0, z1 } = ISLAND;
    shape.moveTo(x0 + rr, z0); shape.lineTo(x1 - rr, z0); shape.quadraticCurveTo(x1, z0, x1, z0 + rr);
    shape.lineTo(x1, z1 - rr); shape.quadraticCurveTo(x1, z1, x1 - rr, z1); shape.lineTo(x0 + rr, z1);
    shape.quadraticCurveTo(x0, z1, x0, z1 - rr); shape.lineTo(x0, z0 + rr); shape.quadraticCurveTo(x0, z0, x0 + rr, z0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.3, bevelSegments: 2 });
    // 그림 좌표: 모양의 (x, y=z)를 0~1로
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / SX, 1 - (pos.getY(i) - z0) / SZ);
    const top = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
    const ground = new THREE.Mesh(geo, [top, toon('#B88A5C')]);
    // ExtrudeGeometry는 +z로 두께가 생긴다. x축으로 90도 돌리면 모양의 y가 z로, 두께가 아래(-y)로 간다 (윗면은 모서리 둥글림만큼 위)
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    R.add(ground);
    this.ground = ground;

    // 방 바닥과 벽 (앞쪽 벽은 낮게 해서 안이 보이게)
    const fl = new THREE.Group();
    box(fl, ROOM.x1 - ROOM.x0, 0.06, ROOM.z1 - ROOM.z0, '#D9A86C', (ROOM.x0 + ROOM.x1) / 2, 0.03, (ROOM.z0 + ROOM.z1) / 2);
    for (let i = 1; i < 8; i++) box(fl, 0.02, 0.005, ROOM.z1 - ROOM.z0, '#C48F55', ROOM.x0 + i, 0.063, (ROOM.z0 + ROOM.z1) / 2);
    fl.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    mergeColored(fl, VC);
    R.add(fl);
    const WH = 2.4, WALL = '#F6E3C2', TRIM = '#C99862';
    const back = new THREE.Group();
    box(back, 8.4, WH, 0.2, WALL, -6, WH / 2, -10.1);
    box(back, 8.4, 0.12, 0.26, TRIM, -6, WH, -10.1);
    for (const x of [-8, -4]) {
      box(back, 1.2, 0.9, 0.05, '#BFE3F5', x, 1.45, -9.98);
      box(back, 1.32, 0.08, 0.1, '#FFFDF7', x, 0.98, -9.97); box(back, 0.06, 0.9, 0.08, '#FFFDF7', x, 1.45, -9.96);
    }
    mergeColored(back, VC); R.add(back);
    v.makeFadeable(back, HOME_O.x - 6, HOME_O.z - 10.1, 4.2);
    const left = new THREE.Group();
    box(left, 0.2, WH, 6.4, WALL, -10.1, WH / 2, -7);
    box(left, 0.26, 0.12, 6.4, TRIM, -10.1, WH, -7);
    box(left, 0.05, 0.9, 1.2, '#BFE3F5', -9.98, 1.45, -6.6);
    mergeColored(left, VC); R.add(left);
    v.makeFadeable(left, HOME_O.x - 10.1, HOME_O.z - 7, 3.2);
    const right = new THREE.Group();
    box(right, 0.2, WH, 2.9, WALL, -1.9, WH / 2, -8.65);
    box(right, 0.2, WH, 1.9, WALL, -1.9, WH / 2, -4.85);
    box(right, 0.2, 0.5, 1.4, WALL, -1.9, WH - 0.25, -6.5);
    box(right, 0.26, 0.12, 6.4, TRIM, -1.9, WH, -7);
    box(right, 0.28, 0.12, 1.5, '#8B5E3C', -1.9, WH - 0.52, -6.5);
    mergeColored(right, VC); R.add(right);
    v.makeFadeable(right, HOME_O.x - 1.9, HOME_O.z - 7, 3.2);
    const front = new THREE.Group();
    box(front, 8.4, 0.55, 0.2, WALL, -6, 0.275, -3.9);
    box(front, 8.4, 0.08, 0.28, TRIM, -6, 0.58, -3.9);
    for (let i = 0; i < 7; i++) ball(front, 0.12, ['#EF6461', '#F6D55C', '#F6A2C4'][i % 3], -9.4 + i * 1.15, 0.7, -3.86, 8);
    mergeColored(front, VC); R.add(front);
    this.obstacles.push(
      { x: -6, z: -10.1, hw: 4.2, hd: 0.1 }, { x: -10.1, z: -7, hw: 0.1, hd: 3.2 },
      { x: -1.9, z: -8.65, hw: 0.1, hd: 1.45 }, { x: -1.9, z: -4.85, hw: 0.1, hd: 0.95 }, { x: -6, z: -3.9, hw: 4.2, hd: 0.1 },
    );
    // 문패
    this.signMat = new THREE.MeshToonMaterial({ map: signTex('우리 집'), gradientMap: toonGradient() });
    const sign = m(new THREE.BoxGeometry(1.6, 0.45, 0.06), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), this.signMat], -1.76, 2.75, -6.5);
    sign.rotation.y = Math.PI / 2;
    R.add(sign);

    // 옷장 (누르면 꾸미기)
    const cl = new THREE.Group();
    box(cl, 0.95, 2.0, 0.62, '#B07F4E', 0, 1.0, 0);
    box(cl, 0.42, 1.5, 0.03, '#BFE3F5', -0.22, 1.1, 0.32);
    box(cl, 0.42, 1.5, 0.03, '#C99862', 0.22, 1.1, 0.32);
    ball(cl, 0.04, '#F6D55C', 0.04, 1.1, 0.35, 6); ball(cl, 0.04, '#F6D55C', 0.4 - 0.4, 1.1, 0.35, 6);
    box(cl, 1.0, 0.1, 0.66, '#8B5E3C', 0, 2.03, 0);
    mergeColored(cl, VC);
    cl.position.set(-9.45, 0, -9.6);
    cl.userData.pick = { type: 'building', id: 'home-closet' };
    R.add(cl);
    this.pickRoots.push(cl);
    this.obstacles.push({ x: -9.45, z: -9.6, hw: 0.5, hd: 0.35 });

    // 밭 (나무 테두리와 흙 두둑)
    const gd = new THREE.Group();
    const gw = GARDEN.x1 - GARDEN.x0, gdp = GARDEN.z1 - GARDEN.z0, gx = (GARDEN.x0 + GARDEN.x1) / 2, gz = (GARDEN.z0 + GARDEN.z1) / 2;
    box(gd, gw + 0.2, 0.08, gdp + 0.2, '#8A6440', gx, 0.04, gz);
    for (let z = GARDEN.z0; z < GARDEN.z1; z++) box(gd, gw - 0.1, 0.12, 0.7, '#7A5233', gx, 0.1, z + 0.5);
    for (const [xx, zz, w, d] of [[gx, GARDEN.z0 - 0.12, gw + 0.4, 0.16], [gx, GARDEN.z1 + 0.12, gw + 0.4, 0.16], [GARDEN.x0 - 0.12, gz, 0.16, gdp + 0.4], [GARDEN.x1 + 0.12, gz, 0.16, gdp + 0.4]]) box(gd, w, 0.22, d, '#B07F4E', xx, 0.11, zz);
    gd.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    mergeColored(gd, VC);
    R.add(gd);
    const gs = m(new THREE.BoxGeometry(1.5, 0.42, 0.06), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), new THREE.MeshToonMaterial({ map: signTex('우리 밭'), gradientMap: toonGradient() }), toon('#6B4429')], gx, 0.65, GARDEN.z1 + 0.35);
    R.add(gs);
    box(R, 0.06, 0.5, 0.06, '#6B4429', gx, 0.25, GARDEN.z1 + 0.33);

    // 대문 (마을로 가는 길)
    const gt = new THREE.Group();
    for (const x of [-1.25, 1.25]) { box(gt, 0.22, 2.3, 0.22, '#B07F4E', x, 1.15, 0); ball(gt, 0.16, '#F6D55C', x, 2.4, 0, 10); }
    box(gt, 2.8, 0.18, 0.26, '#8B5E3C', 0, 2.2, 0);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { box(gt, 0.1, 0.65, 0.1, '#FFFDF7', s * (1.65 + i * 0.45), 0.33, 0); }
    for (const s of [-1, 1]) box(gt, 1.5, 0.08, 0.06, '#FFFDF7', s * 2.3, 0.48, 0);
    mergeColored(gt, VC);
    const gsg = m(new THREE.BoxGeometry(2.2, 0.62, 0.06), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), new THREE.MeshToonMaterial({ map: signTex('마을로 가는 길', '눌러서 나가요'), gradientMap: toonGradient() }), toon('#6B4429')], 0, 2.62, 0.05);
    gt.add(gsg);
    gt.position.set(0, 0, 9.85);
    gt.userData.pick = { type: 'building', id: 'home-exit' };
    R.add(gt);
    this.pickRoots.push(gt);
    for (const x of [-1.25, 1.25]) this.obstacles.push({ x, z: 9.85, hw: 0.15, hd: 0.15 });
    // 둘레 덤불
    const hedge = new THREE.Group();
    for (let x = ISLAND.x0 + 0.8; x < ISLAND.x1 - 0.5; x += 1.1) {
      if (Math.abs(x) < 3.4) continue;
      ball(hedge, 0.55, '#5FAE4E', x, 0.35, ISLAND.z1 - 0.55, 10).scale.set(1, 0.8, 0.8);
    }
    for (let z = ISLAND.z0 + 0.8; z < ISLAND.z1 - 0.6; z += 1.1) for (const x of [ISLAND.x0 + 0.5, ISLAND.x1 - 0.5]) ball(hedge, 0.5, '#57A148', x, 0.32, z, 10).scale.set(0.8, 0.8, 1);
    for (let x = ISLAND.x0 + 0.8; x < ISLAND.x1 - 0.5; x += 1.1) if (x > -1.5) ball(hedge, 0.5, '#57A148', x, 0.32, ISLAND.z0 + 0.5, 10).scale.set(1, 0.8, 0.8);
    mergeColored(hedge, VC);
    R.add(hedge);
    mergeStatic(R, { shallow: true });

    // 마을 문 목록에 대문과 옷장을 더한다 (가까이 가면 '나가기' 안내가 뜬다)
    v.doors.push({ id: 'home-exit', name: '마을로 가는 길', pos: this.toWorld(GATE.x, GATE.z), group: gt });
    v.doors.push({ id: 'home-closet', name: '옷장', pos: this.toWorld(CLOSET.x, CLOSET.z), group: cl });
    // 놓은 물건들
    this.itemRoot = new THREE.Group();
    R.add(this.itemRoot);
  }

  setOwner(name) {
    const t = signTex(`${name || '우리'}의 집`);
    if (this.signMat.map) this.signMat.map.dispose();
    this.signMat.map = t;
    this.signMat.needsUpdate = true;
  }

  // ---------- 놓은 물건 ----------
  setLayout(list) {
    this.layout = list.map((e) => ({ ...e }));
    for (const it of this.items.values()) this.dropObj(it);
    this.items.clear();
    for (const e of this.layout) this.addObj(e);
    this.rebuildObs();
  }
  addObj(e) {
    const it = { e, obj: null, anim: {}, stage: -1 };
    this.items.set(e.id, it);
    this.refreshObj(it);
    return it;
  }
  refreshObj(it) {
    const e = it.e;
    const stage = isSeed(e.k) ? growStage(e) : -1;
    if (it.obj && it.stage === stage && it.n === (e.n || 0)) { this.placeObj(it); return; }
    if (it.obj) this.dropObj(it);
    // 밤에 켠 등은 지금 하늘빛에 맞춰 바로 빛나게
    const glow = (c) => { const mt = this.v.glow(c); mt.emissiveIntensity = (this.v.glowMats[0] || {}).emissiveIntensity || 0; return mt; };
    const made = isSeed(e.k) ? buildPlant(e.k, stage, e.id, e.n || 0) : buildItem(e.k, glow);
    const g = made.g;
    mergeColored(g, VC);
    mergeStatic(g);
    g.userData.pick = { type: isSeed(e.k) ? 'plant' : 'homeitem', id: e.id };
    it.obj = g;
    it.anim = made.anim;
    it.stage = stage;
    it.n = e.n || 0;
    this.itemRoot.add(g);
    this.pickRoots.push(g);
    this.placeObj(it);
  }
  placeObj(it) {
    const c = centerOf(it.e);
    it.obj.position.set(c.x, 0, c.z);
    it.obj.rotation.y = -(it.e.r || 0) * Math.PI / 2;
  }
  dropObj(it) {
    if (!it.obj) return;
    it.obj.removeFromParent();
    const i = this.pickRoots.indexOf(it.obj);
    if (i >= 0) this.pickRoots.splice(i, 1);
    it.obj.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    it.obj = null;
  }
  // 걸을 때 부딪히는 물건 (깔개와 식물은 지나갈 수 있다)
  rebuildObs() {
    this.itemObs = [];
    for (const e of this.layout) {
      const it = HOME_ITEMS[e.k];
      if (!it || it.floor || isSeed(e.k)) continue;
      const c = centerOf(e), f = footprint(e.k, e.r || 0);
      if (f.w * f.d === 1) this.itemObs.push({ c: true, x: c.x, z: c.z, r: 0.3 });
      else this.itemObs.push({ x: c.x, z: c.z, hw: f.w / 2 - 0.12, hd: f.d / 2 - 0.12 });
    }
  }
  // 놓기, 옮기기, 빼기
  put(e) {
    const ex = this.layout.find((o) => o.id === e.id);
    if (ex) { Object.assign(ex, e); const it = this.items.get(e.id); it.e = ex; this.refreshObj(it); }
    else { const n = { ...e }; this.layout.push(n); this.addObj(n); }
    this.rebuildObs();
  }
  take(id) {
    const i = this.layout.findIndex((o) => o.id === id);
    if (i < 0) return null;
    const [e] = this.layout.splice(i, 1);
    const it = this.items.get(id);
    if (it) { this.dropObj(it); this.items.delete(id); }
    this.rebuildObs();
    return e;
  }
  entry(id) { return this.layout.find((o) => o.id === id) || null; }
  // 식물이 자랐으면 모양을 바꾼다
  refreshPlants() {
    for (const it of this.items.values()) if (isSeed(it.e.k) && growStage(it.e) !== it.stage) this.refreshObj(it);
  }

  // ---------- 꾸미기: 놓을 자리 미리 보기 ----------
  showGhost(e, ok) {
    this.clearGhost();
    const made = isSeed(e.k) ? buildPlant(e.k, 3, e.id || 'g') : buildItem(e.k, (c) => toon(c));
    const g = made.g;
    const mat = new THREE.MeshBasicMaterial({ color: ok ? '#7CE07C' : '#FF7A7A', transparent: true, opacity: 0.55, depthWrite: false });
    g.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
    const f = footprint(e.k, e.r || 0);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.08, f.d - 0.08), new THREE.MeshBasicMaterial({ color: ok ? '#4CC24C' : '#E04848', transparent: true, opacity: 0.45, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.09;
    const wrap = new THREE.Group();
    wrap.add(g);
    const padWrap = new THREE.Group();
    padWrap.add(pad);
    const c = centerOf(e);
    wrap.position.set(c.x, 0, c.z);
    wrap.rotation.y = -(e.r || 0) * Math.PI / 2;
    padWrap.position.set(c.x, 0, c.z);
    this.root.add(wrap, padWrap);
    this.ghost = { wrap, padWrap, mat };
  }
  clearGhost() {
    if (!this.ghost) return;
    for (const o of [this.ghost.wrap, this.ghost.padWrap]) { o.removeFromParent(); o.traverse((q) => { if (q.isMesh) q.geometry.dispose(); }); }
    this.ghost = null;
  }
  // 고른 물건 밑에 노란 테두리
  showSel(id) {
    this.clearSel();
    const e = this.entry(id);
    if (!e) return;
    const f = footprint(e.k, e.r || 0), c = centerOf(e);
    const shape = new THREE.Shape();
    const hw = f.w / 2, hd = f.d / 2;
    shape.moveTo(-hw, -hd); shape.lineTo(hw, -hd); shape.lineTo(hw, hd); shape.lineTo(-hw, hd); shape.lineTo(-hw, -hd);
    const hole = new THREE.Path();
    hole.moveTo(-hw + 0.1, -hd + 0.1); hole.lineTo(-hw + 0.1, hd - 0.1); hole.lineTo(hw - 0.1, hd - 0.1); hole.lineTo(hw - 0.1, -hd + 0.1); hole.lineTo(-hw + 0.1, -hd + 0.1);
    shape.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#FFD23F', depthWrite: false, transparent: true, opacity: 0.95 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.1, c.z);
    this.root.add(ring);
    this.sel = ring;
  }
  clearSel() { if (this.sel) { this.sel.removeFromParent(); this.sel.geometry.dispose(); this.sel = null; } }

  // 화면을 누른 곳의 칸 (집 안 좌표, 정수)
  cellAt(ray) {
    const pt = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return null;
    const l = this.toLocal(pt);
    return { x: l.x, z: l.z, cx: Math.floor(l.x), cz: Math.floor(l.z) };
  }
  // 누른 곳의 놓은 물건
  pickAt(ray) {
    const hits = ray.intersectObjects(this.itemRoot.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return o.userData.pick;
    }
    return null;
  }

  // ---------- 걷기 ----------
  inRoom(x, z) { return x > ROOM.x0 - 0.2 && x < ROOM.x1 + 0.1 && z > ROOM.z0 - 0.2 && z < ROOM.z1 + 0.1; }
  resolve(p) {
    const l = this.toLocal(p);
    let { x, z } = l;
    for (const o of [...this.obstacles, ...this.itemObs]) {
      if (o.c) {
        const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), min = o.r + PR;
        if (d < min && d > 1e-5) { x = o.x + (dx / d) * min; z = o.z + (dz / d) * min; }
        continue;
      }
      const lx = x - o.x, lz = z - o.z;
      const cx = Math.max(-o.hw, Math.min(o.hw, lx)), cz = Math.max(-o.hd, Math.min(o.hd, lz));
      const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d < PR) {
        if (d > 1e-5) { x = o.x + cx + (dx / d) * PR; z = o.z + cz + (dz / d) * PR; }
        else if (o.hw - Math.abs(lx) < o.hd - Math.abs(lz)) x = o.x + Math.sign(lx || 1) * (o.hw + PR);
        else z = o.z + Math.sign(lz || 1) * (o.hd + PR);
      }
    }
    x = Math.max(WALK.x0, Math.min(WALK.x1, x));
    z = Math.max(WALK.z0, Math.min(WALK.z1, z));
    p.x = x + HOME_O.x;
    p.z = z + HOME_O.z;
    return p;
  }
  // 방 안과 밖을 오갈 때는 방문을 지나간다
  planRoute(from, to) {
    const a = this.toLocal(from), b = this.toLocal(to);
    const ia = this.inRoom(a.x, a.z), ib = this.inRoom(b.x, b.z);
    if (ia === ib) return [];
    const pts = ia ? [DOOR_IN, DOOR_OUT] : [DOOR_OUT, DOOR_IN];
    return pts.map((q) => ({ x: q.x + HOME_O.x, z: q.z + HOME_O.z }));
  }
  spawn() { return this.toWorld(0, 5.6); }
  // 물건 옆 설 자리 (앞쪽)
  standBy(id) {
    const e = this.entry(id);
    if (!e) return null;
    const c = centerOf(e), f = footprint(e.k, e.r || 0);
    const r = e.r || 0;
    const dir = [[0, 1], [1, 0], [0, -1], [-1, 0]][r];
    const reach = (r % 2 ? f.w : f.d) / 2 + 0.55;
    const p = this.toWorld(c.x + dir[0] * reach, c.z + dir[1] * reach);
    return { pos: p, face: this.toWorld(c.x, c.z) };
  }
  // 앉거나 눕는 가구: 침대(눕기), 소파·의자·마당 벤치(앉기). 물건 안 좌표(lx, y, lz)와 일어서는 자리들
  restSpot(id, from) {
    const e = this.entry(id);
    const R = REST[e && e.k];
    if (!R) return null;
    const c = centerOf(e), rotY = -(e.r || 0) * Math.PI / 2;
    const co = Math.cos(rotY), sn = Math.sin(rotY);
    const at = (lx, lz) => this.toWorld(c.x + lx * co + lz * sn, c.z - lx * sn + lz * co);
    const near = (list) => {
      // 벽이나 다른 물건에 막히지 않은 곳 가운데 가까운 곳
      const ok = list.filter((p) => { const q = p.clone(); this.resolve(q); return q.distanceTo(p) < 0.05; });
      const pool = ok.length ? ok : list;
      if (from) pool.sort((a, q) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(q.x - from.x, q.z - from.z));
      return pool[0];
    };
    const seats = R.seats.map(([lx, lz]) => ({ pos: at(lx, lz), lx, lz }));
    if (from) seats.sort((a, q) => Math.hypot(a.pos.x - from.x, a.pos.z - from.z) - Math.hypot(q.pos.x - from.x, q.pos.z - from.z));
    const seat = seats[0];
    const outs = R.lie ? [at(R.side, seat.lz), at(-R.side, seat.lz), at(seat.lx, R.front)] : [at(seat.lx, R.front)];
    return { x: seat.pos.x, y: R.y, z: seat.pos.z, rot: rotY + (R.turn || 0), lie: !!R.lie, out: near(outs), swing: R.swing ? id : null };
  }
  // 그네 타기: want는 흔들리는 크기(라디안, 0.25~1). null을 주면 내려서 다시 살랑살랑 흔들린다.
  // 지금 타는 상태({ amp, want, phase })를 돌려준다. 그네가 아니면 null
  ride(id, want) {
    const it = this.items.get(id);
    if (!it || !it.anim || !it.anim.swing) return null;
    if (want === null) { it.ride = null; return null; }
    if (want === undefined) return it.ride || null; // 지금 상태만 본다
    if (!it.ride) {
      const ang = it.anim.swing.rotation.x; // 지금 기운 데서 이어서 흔든다
      it.ride = { amp: Math.abs(ang), want: SWING_REST, phase: (Math.PI / 2) * (ang < 0 ? -1 : 1) };
    }
    it.ride.want = Math.max(SWING_REST, Math.min(SWING_MAX, want));
    return it.ride;
  }
  rider(id) { const it = this.items.get(id); return (it && it.anim && it.anim.rider) || null; }
  // 미끄럼틀 타는 길 (집 장면 좌표): 사다리 아래(foot), 사다리 위(top), 미끄럼판 위·아래에 앉은 뿌리 자리(s0, s1), 내려서는 곳(exit), 보는 쪽(rot)
  slidePath(id) {
    const e = this.entry(id);
    if (!e || e.k !== 'y_slide') return null;
    const c = centerOf(e), rotY = -(e.r || 0) * Math.PI / 2;
    const co = Math.cos(rotY), sn = Math.sin(rotY);
    const at = (lx, y, lz) => { const w = this.toWorld(c.x + lx * co + lz * sn, c.z - lx * sn + lz * co); w.y = y; return w; };
    // 판 위에 앉은 자리: 판 가운데 + 판을 따라 s만큼 + 판 바깥쪽(n)으로 판 두께 반, 뿌리는 앉는 면에서 0.26 아래
    const th = SLIDE_TILT, chute = (sAlong) => at(0, SLIDE_C.y - Math.sin(th) * sAlong - Math.cos(th) * 0.23, SLIDE_C.z + Math.cos(th) * sAlong - Math.sin(th) * 0.23);
    return { foot: at(0, 0, -1.95), bottom: at(0, 0, -1.62), top: at(0, 1.46, -1.12), s0: chute(-0.95), s1: chute(1.12), exit: at(0, 0, 1.95), rot: rotY, tilt: th };
  }
  // 사다리 아래까지 가는 길 (마지막 사다리 아래는 빼고): 방 안에서 오면 방문을 지나고, 미끄럼틀 앞이나 옆에서 오면 옆으로 돌아간다
  slideRoute(id, from) {
    const e = this.entry(id), P = this.slidePath(id);
    if (!P) return [];
    const pts = this.planRoute(from, P.foot);
    const c = centerOf(e), rotY = -(e.r || 0) * Math.PI / 2, co = Math.cos(rotY), sn = Math.sin(rotY);
    const at = (lx, lz) => this.toWorld(c.x + lx * co + lz * sn, c.z - lx * sn + lz * co);
    const l = this.toLocal(pts.length ? pts[pts.length - 1] : from), dx = l.x - c.x, dz = l.z - c.z;
    const lx = dx * co - dz * sn, lz = dx * sn + dz * co; // 미끄럼틀 안 좌표
    if (lz > -1.75 && !(Math.abs(lx) > 1.0 && lz < -1.2)) {
      const sx = lx >= 0 ? 1 : -1;
      if (Math.abs(lx) < 1.0) pts.push(at(sx * 1.2, Math.min(2.3, Math.max(-1.6, lz))));
      pts.push(at(sx * 1.2, -1.95));
    }
    return pts;
  }
  slideNear(x, z) {
    let best = null, bd = 2.6;
    for (const it of this.items.values()) {
      if (it.e.k !== 'y_slide') continue;
      const c = centerOf(it.e), d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = it.e.id; }
    }
    return best;
  }
  // 집 안 좌표 (x, z)에서 가장 가까운 그네 (2.5칸 안)
  swingNear(x, z) {
    let best = null, bd = 2.5;
    for (const it of this.items.values()) {
      if (!it.anim || !it.anim.swing) continue;
      const c = centerOf(it.e), d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = it.e.id; }
    }
    return best;
  }
  plantStand(id) {
    const e = this.entry(id);
    if (!e) return null;
    const c = centerOf(e);
    // 밭 아래쪽(남쪽) 길에서 본다
    return { pos: this.toWorld(c.x, GARDEN.z1 + 0.45), face: this.toWorld(c.x, c.z) };
  }

  // ---------- 움직임 ----------
  update(dt) {
    this.t += dt;
    for (const it of this.items.values()) {
      const a = it.anim;
      if (!a) continue;
      if (a.swing) {
        const rd = it.ride;
        if (rd) {
          // 누가 타고 있으면: 구를수록(want) 높이 흔들리고, 가만히 있으면 조금씩 낮아진다
          rd.want = Math.max(SWING_REST, rd.want - dt * 0.035);
          rd.amp += (rd.want - rd.amp) * Math.min(1, dt * 0.9);
          rd.phase += dt * SWING_W;
          a.swing.rotation.x = rd.amp * Math.sin(rd.phase);
        } else a.swing.rotation.x = Math.sin(this.t * 1.6 + it.e.x) * 0.28;
      }
      if (a.drops) a.drops.children.forEach((d, i) => {
        const k = ((this.t * 0.9 + i / 6) % 1);
        const ang = (i / 6) * Math.PI * 2;
        d.position.set(Math.cos(ang) * k * 0.45, 1.15 + Math.sin(k * Math.PI) * 0.35 - k * 0.6, Math.sin(ang) * k * 0.45);
      });
      if (a.sway) a.sway.rotation.z = Math.sin(this.t * 1.2 + it.e.x) * 0.08;
    }
    this.plantTick = (this.plantTick || 0) - dt;
    if (this.plantTick <= 0) { this.plantTick = 20; this.refreshPlants(); }
    if (this.ghost) this.ghost.mat.opacity = 0.45 + Math.sin(this.t * 6) * 0.12;
  }
}
