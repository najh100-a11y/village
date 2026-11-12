// 진숲 어린이 마을 — 내 집: 방, 마당, 밭을 꾸민다
// 내 집은 마을과 떨어진 따로 된 장면(scene)이다. 마을 섬과 겹치지 않게 멀리(HOME_O) 둔다.
// 들어가면 내 주민과 애완동물, 해와 하늘빛이 이 장면으로 옮겨 오고, 나가면 마을로 돌아간다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient, Avatar } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { makeTree } from './isles.js';
import {
  HOME_ITEMS, ROOM, GARDEN, ISLAND, footprint, centerOf, growStage, isSeed,
  WALLS, FLOORS, BUILD_IDS, LOT_X0, SLOT_W, setRooms, builtRooms, spaces, styleOf, frontDoorX, cookAt,
} from './homeitems.js';

export const HOME_O = { x: 1000, z: 1000 };
// 앉거나 누울 수 있는 가구: seats(물건 안 자리 x, z), y(뿌리 높이: 앉으면 발, 누우면 엉덩이), front(앞에 서는 곳 z), side(침대 옆),
// turn(앉아서 보는 쪽을 돌린다: 피아노 의자는 건반 쪽을 본다), swing(그네: 앉으면 발판과 함께 흔들린다)
const SWING_REST = 0.3, SWING_MAX = 1.0, SWING_W = 2.45; // 그네: 가만히 탈 때 흔들림, 가장 높이, 흔들리는 빠르기(라디안/초, 한 번 오가는 데 약 2.6초)
// 미끄럼틀: 미끄럼판 기울기(라디안)와 판 가운데 (물건 안 좌표)
export const SLIDE_TILT = Math.atan2(1.32, 2.15);
const SLIDE_C = { y: 0.8, z: 0.25 };
// seats의 [x, z] 뒤에 [보는 쪽, 일어서는 곳 z]를 더 줄 수 있다 (식탁 의자: 식탁을 마주 보고, 의자 뒤로 일어선다)
const REST = {
  h_bed: { lie: true, seats: [[0, -0.05]], y: 0.86, side: 1.45, front: 1.95 },
  h_bunk: { lie: true, seats: [[0, -0.05]], y: 0.77, side: 1.45, front: 1.95 },
  h_sofa: { seats: [[-0.38, 0.06], [0.38, 0.06]], y: 0.3, front: 0.95 },
  h_bigsofa: { seats: [[-0.88, 0.06], [0, 0.06], [0.88, 0.06]], y: 0.3, front: 0.95 },
  h_chair: { seats: [[0, 0.02]], y: 0.29, front: 0.8 },
  h_rocking: { seats: [[0, 0.02]], y: 0.3, front: 0.85 },
  h_beanbag: { seats: [[0, 0.06]], y: 0.2, front: 0.85 },
  h_dtable: { seats: [[-0.42, 1.04, Math.PI, 1.85], [0.42, 1.04, Math.PI, 1.85], [-0.42, -1.04, 0, -1.85], [0.42, -1.04, 0, -1.85]], y: 0.28, front: 1.85 },
  y_bench: { seats: [[-0.45, 0.02], [0.45, 0.02]], y: 0.24, front: 0.85 },
  h_piano: { seats: [[0, 0.64]], y: 0.22, front: 1.25, turn: Math.PI },
  y_swing: { seats: [[0, 0.02]], y: 0.33, front: 1.4, swing: true },
};
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const DOOR_IN = { x: -2.7, z: -6.5 }, DOOR_OUT = { x: -1.0, z: -6.5 };
const GATE = { x: 0, z: 9.2 }, CLOSET = { x: -9.45, z: -8.55 };
const WALK = { x0: ISLAND.x0 + 0.6, x1: ISLAND.x1 - 0.6, z0: ISLAND.z0 + 0.6, z1: ISLAND.z1 - 0.7 };
const PR = 0.42;
const PLANT_Y = 0.13; // 밭 식물의 뿌리 높이 (두둑 윗면 0.16보다 조금 아래)
const WH = 2.4, TRIM = '#C99862';

// 벽지와 바닥 그림 (같은 무늬는 한 번만 만든다)
const patTex = new Map();
function patternTex(kind, c, c2, rx, ry) {
  const key = `${kind}|${c}|${c2}|${rx}|${ry}`;
  if (patTex.has(key)) return patTex.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const x = cv.getContext('2d');
  x.fillStyle = c; x.fillRect(0, 0, 64, 64);
  x.fillStyle = c2;
  if (kind === 'plank') { x.fillRect(0, 0, 3, 64); x.globalAlpha = 0.35; x.fillRect(30, 20, 2, 18); x.fillRect(46, 44, 2, 14); }
  else if (kind === 'check') { x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); }
  else if (kind === 'soft') { let s = 3; for (let i = 0; i < 70; i++) { s = (s * 16807) % 2147483647; const px = s % 64; s = (s * 16807) % 2147483647; x.fillRect(px, s % 64, 2, 2); } }
  else if (kind === 'stripe') { x.fillRect(0, 0, 16, 64); x.fillRect(32, 0, 16, 64); }
  else if (kind === 'dots') { for (const [px, py] of [[16, 16], [48, 48]]) { x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); } }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  const mat = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() });
  patTex.set(key, mat);
  return mat;
}
// 방 바닥 (가로 8, 세로 6): 나무는 한 칸에 널빤지 하나, 타일은 반 칸씩, 카펫은 두 칸에 한 번
function floorMat(key) {
  const f = FLOORS[key] || FLOORS.wood;
  if (f.pat === 'plank') return patternTex('plank', f.c, f.c2, 8, 1);
  if (f.pat === 'check') return patternTex('check', f.c, f.c2, 8, 6);
  return patternTex('soft', f.c, f.c2, 4, 3);
}
// 벽: 무늬 없는 벽지는 색만 (꼭짓점 색으로 합친다), 무늬 벽지는 벽 길이에 맞춰 무늬를 되풀이한다
function wallMat(key, len) {
  const w = WALLS[key] || WALLS.cream;
  if (!w.pat) return w.c;
  return patternTex(w.pat, w.c, w.c2, Math.max(1, Math.round(len * 1.6)), 4);
}
const wallSolid = (key) => (WALLS[key] || WALLS.cream).c;

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

// 텔레비전 화면: 구름이 흘러가는 들판 그림 (모든 텔레비전이 같은 그림을 옆으로 흘려 보낸다)
let tvTex = null, tvOn = null;
const tvOff = new THREE.MeshBasicMaterial({ color: '#1E1E24' });
function tvMat(on) {
  if (!on) return tvOff;
  if (!tvTex) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, '#7EC8F2'); sky.addColorStop(1, '#CDEBF8');
    x.fillStyle = sky; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#FFE08A'; x.beginPath(); x.arc(400, 34, 16, 0, 7); x.fill();
    x.fillStyle = '#FFFFFF';
    for (const [cx, cy, s] of [[60, 30, 1], [230, 22, 0.8], [330, 44, 0.7], [470, 26, 0.9]]) {
      for (const [dx, dy, r] of [[0, 0, 14], [15, -5, 12], [28, 0, 11], [14, 5, 12]]) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); x.fill(); }
    }
    for (const [col, base, amp, f] of [['#9BD971', 88, 12, 2], ['#6DBE5A', 104, 10, 3]]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 128);
      for (let i = 0; i <= 512; i += 8) x.lineTo(i, base - Math.sin((i / 512) * Math.PI * 2 * f) * amp);
      x.lineTo(512, 128); x.fill();
    }
    for (let i = 0; i < 9; i++) { x.fillStyle = ['#EF6461', '#F6D55C', '#FFFFFF'][i % 3]; x.beginPath(); x.arc(30 + i * 56, 112 + (i % 2) * 6, 4, 0, 7); x.fill(); }
    tvTex = new THREE.CanvasTexture(c);
    tvTex.colorSpace = THREE.SRGBColorSpace;
    tvTex.wrapS = THREE.RepeatWrapping;
    tvTex.repeat.set(0.5, 1);
  }
  if (!tvOn) tvOn = new THREE.MeshBasicMaterial({ map: tvTex });
  return tvOn;
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
    case 'h_rug': {
      // 방 바닥 윗면이 0.06이라 그보다 위에 깐다 (겹마다 0.005씩 높여 무늬가 보이게)
      const rug = [[0.95, '#F49A4C', 0.07], [0.75, '#FFE08A', 0.075], [0.52, '#5FA9E0', 0.08], [0.28, '#F6A2C4', 0.085]];
      for (const [r, c, top] of rug) {
        const o = cyl(g, r, r, top - 0.058, c, 0, (top + 0.058) / 2, 0, 32);
        o.castShadow = false;
      }
      break;
    }
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
    case 'h_bunk': {
      // 2층 침대: 네 기둥, 아래 칸(누울 수 있다)과 위 칸, 오른쪽 앞 사다리
      for (const x of [-0.86, 0.86]) for (const z of [-1.36, 1.36]) box(g, 0.1, 2.0, 0.1, WD, x, 1.0, z);
      for (const [y, quilt] of [[0.3, '#5DB760'], [1.4, '#F49A4C']]) {
        box(g, 1.72, 0.2, 2.72, W, 0, y, 0);
        box(g, 1.64, 0.16, 2.6, '#FFFDF7', 0, y + 0.18, 0.02);
        box(g, 1.68, 0.16, 1.7, quilt, 0, y + 0.22, 0.48);
        box(g, 0.9, 0.14, 0.42, '#FFF6E0', 0, y + 0.32, -1.02);
      }
      box(g, 0.05, 0.22, 2.0, W, -0.88, 1.78, -0.3); // 위 칸 난간
      box(g, 1.72, 0.22, 0.05, W, 0, 1.78, -1.37);
      for (const z of [0.95, 1.33]) box(g, 0.05, 1.7, 0.05, '#C99862', 0.93, 0.85, z);
      for (let i = 0; i < 5; i++) box(g, 0.06, 0.04, 0.42, '#C99862', 0.93, 0.25 + i * 0.32, 1.14);
      break;
    }
    case 'h_drawer':
      box(g, 1.7, 0.96, 0.66, W, 0, 0.5, 0);
      box(g, 1.78, 0.05, 0.72, WD, 0, 1.0, 0);
      for (const y of [0.2, 0.5, 0.8]) {
        box(g, 1.56, 0.25, 0.04, '#E2B47F', 0, y, 0.34);
        for (const x of [-0.42, 0.42]) ball(g, 0.04, '#F6D55C', x, y, 0.37, 6);
      }
      box(g, 0.34, 0.4, 0.04, '#FFFDF7', -0.45, 1.24, -0.12); // 사진 액자
      box(g, 0.26, 0.3, 0.02, '#9FD8F0', -0.45, 1.25, -0.1);
      cyl(g, 0.08, 0.1, 0.22, '#7EC8E3', 0.45, 1.13, 0, 10);
      ball(g, 0.09, '#F6A2C4', 0.45, 1.3, 0, 8);
      break;
    case 'h_dresser': {
      box(g, 1.6, 0.06, 0.55, W, 0, 0.76, -0.12);
      for (const x of [-0.74, 0.74]) box(g, 0.08, 0.73, 0.5, WD, x, 0.37, -0.12);
      box(g, 0.5, 0.36, 0.48, W, 0.45, 0.55, -0.12);
      ball(g, 0.04, '#F6D55C', 0.45, 0.55, 0.13, 6);
      const fr = cyl(g, 0.44, 0.44, 0.05, '#F6A2C4', 0, 1.3, -0.36, 24); fr.rotation.x = Math.PI / 2;
      const mr = cyl(g, 0.37, 0.37, 0.06, '#D7EEF8', 0, 1.3, -0.35, 24); mr.rotation.x = Math.PI / 2;
      box(g, 0.08, 0.3, 0.08, WD, 0, 0.92, -0.36);
      cyl(g, 0.05, 0.05, 0.14, '#C9A0E8', -0.45, 0.86, -0.15, 8);
      ball(g, 0.06, '#FFE08A', -0.25, 0.83, -0.05, 8);
      cyl(g, 0.2, 0.2, 0.06, '#F6A2C4', 0, 0.42, 0.3, 14); // 작은 의자
      cyl(g, 0.04, 0.04, 0.4, WD, 0, 0.2, 0.3, 6);
      break;
    }
    case 'h_globe': {
      cyl(g, 0.2, 0.24, 0.05, WD, 0, 0.025, 0, 14);
      cyl(g, 0.03, 0.03, 0.62, '#C99862', 0, 0.34, 0, 6);
      const tilt = new THREE.Group();
      tilt.position.set(0, 0.92, 0);
      tilt.rotation.z = 0.41; // 지구는 23.4도 기울어 있다
      const arc = m(new THREE.TorusGeometry(0.31, 0.014, 6, 24, Math.PI), toon('#F6D55C')); // 지구본을 잡은 반원 테
      arc.rotation.z = -Math.PI / 2;
      tilt.add(arc);
      const spin = new THREE.Group();
      ball(spin, 0.26, '#5FA9E0', 0, 0, 0, 18);
      for (const [a, b, s] of [[0.4, 0.3, 0.13], [2.2, -0.2, 0.15], [3.6, 0.5, 0.1], [4.8, -0.4, 0.12], [1.3, 0.9, 0.08]]) {
        const lnd = ball(spin, s, '#6DBE5A', Math.cos(a) * Math.cos(b) * 0.24, Math.sin(b) * 0.24, Math.sin(a) * Math.cos(b) * 0.24, 8);
        lnd.scale.set(1, 0.7, 1);
      }
      tilt.add(spin);
      g.add(tilt);
      tilt.traverse((o) => { if (o.isMesh) o.userData.noMerge = true; });
      anim.spin = spin;
      break;
    }
    case 'h_bigsofa':
      box(g, 2.8, 0.36, 0.8, '#5FA9E0', 0, 0.26, 0.02);
      box(g, 2.8, 0.58, 0.22, '#4C8FC4', 0, 0.64, -0.3);
      for (const x of [-1.36, 1.36]) box(g, 0.2, 0.38, 0.8, '#4C8FC4', x, 0.5, 0.02);
      for (const x of [-0.88, 0, 0.88]) box(g, 0.84, 0.12, 0.6, '#8CC6EE', x, 0.5, 0.08);
      box(g, 0.36, 0.32, 0.1, '#FFE08A', -0.95, 0.74, -0.15);
      box(g, 0.36, 0.32, 0.1, '#F6A2C4', 0.95, 0.74, -0.15);
      for (const x of [-1.3, 1.3]) box(g, 0.1, 0.08, 0.1, WD, x, 0.04, 0.3);
      break;
    case 'h_coffee':
      box(g, 1.5, 0.06, 0.62, W, 0, 0.42, 0);
      for (const x of [-0.68, 0.68]) for (const z of [-0.24, 0.24]) box(g, 0.07, 0.39, 0.07, WD, x, 0.2, z);
      box(g, 1.36, 0.04, 0.5, WD, 0, 0.13, 0);
      cyl(g, 0.22, 0.17, 0.04, '#FFFDF7', -0.32, 0.47, 0, 16);
      ball(g, 0.08, '#EF4A3E', -0.38, 0.54, -0.04, 8); ball(g, 0.08, '#F49A4C', -0.24, 0.54, 0.03, 8);
      for (let i = 0; i < 5; i++) ball(g, 0.04, '#8E5BC4', -0.32 + (i % 3) * 0.05, 0.53 + (i > 2 ? 0.05 : 0), 0.1, 6);
      box(g, 0.34, 0.05, 0.25, '#5FA9E0', 0.38, 0.475, 0.04);
      box(g, 0.3, 0.04, 0.22, '#EF6461', 0.4, 0.52, 0.02);
      break;
    case 'h_tv': {
      box(g, 1.7, 0.5, 0.5, W, 0, 0.25, 0.05);
      for (const x of [-0.42, 0.42]) { box(g, 0.78, 0.38, 0.03, '#E2B47F', x, 0.26, 0.31); ball(g, 0.035, '#F6D55C', x + (x < 0 ? 0.3 : -0.3), 0.26, 0.34, 6); }
      box(g, 0.36, 0.04, 0.22, '#3B3B45', 0, 0.52, -0.05);
      box(g, 0.07, 0.14, 0.05, '#3B3B45', 0, 0.6, -0.08);
      box(g, 1.32, 0.8, 0.07, '#2E2E36', 0, 1.06, -0.08);
      // 화면: 구름이 흘러가는 들판 그림 (누르면 켜고 끈다)
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), tvMat(true));
      scr.position.set(0, 1.06, -0.04);
      scr.userData.noMerge = true;
      g.add(scr);
      anim.tv = scr;
      break;
    }
    case 'h_fishtank': {
      box(g, 1.7, 0.62, 0.58, WD, 0, 0.31, 0);
      box(g, 1.6, 0.06, 0.5, '#F3E2B4', 0, 0.65, 0);
      for (const [x, hh] of [[-0.6, 0.42], [-0.5, 0.3], [0.55, 0.5], [0.66, 0.34]]) box(g, 0.04, hh, 0.04, '#4FA64A', x, 0.68 + hh / 2, -0.08);
      ball(g, 0.1, '#B9B3A8', 0.2, 0.7, 0.05, 8).scale.set(1.4, 0.7, 1);
      const glass = new THREE.MeshBasicMaterial({ color: '#BFE8F7', transparent: true, opacity: 0.32, depthWrite: false });
      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.78, 0.54), glass);
      tank.position.set(0, 1.01, 0);
      tank.castShadow = false;
      tank.renderOrder = 2;
      g.add(tank);
      box(g, 1.7, 0.05, 0.58, '#3B3B45', 0, 1.42, 0);
      const fishes = [];
      for (const [col, y, z, sp] of [['#F49A4C', 0.95, 0.06, 0.5], ['#5FA9E0', 1.12, -0.08, 0.38], ['#F6D55C', 0.86, 0.12, 0.62]]) {
        const f = new THREE.Group();
        const body = ball(f, 0.07, col, 0, 0, 0, 8); body.scale.set(1.6, 1, 0.7);
        const tail = m(new THREE.ConeGeometry(0.06, 0.1, 4), toon(col), -0.14, 0, 0); tail.rotation.z = Math.PI / 2; f.add(tail);
        ball(f, 0.018, '#2E2A2A', 0.07, 0.025, 0.035, 5);
        f.position.set(0, y, z);
        f.userData = { y, sp, ph: fishes.length * 2.1 };
        f.traverse((o) => { if (o.isMesh) { o.userData.noMerge = true; o.castShadow = false; } });
        g.add(f);
        fishes.push(f);
      }
      anim.fish = fishes;
      const bub = new THREE.Group();
      const bm = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false });
      for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), bm); b.userData.noMerge = true; bub.add(b); }
      bub.position.set(0.2, 0, 0.05);
      g.add(bub);
      anim.bubbles = bub;
      break;
    }
    case 'h_clock': {
      box(g, 0.56, 1.95, 0.4, '#8B5E3C', 0, 0.98, 0);
      box(g, 0.64, 0.1, 0.46, '#6B4429', 0, 2.0, 0);
      { const r = m(prismGeo(0.64, 0.2, 0.44), toon('#6B4429'), 0, 2.05, 0); g.add(r); }
      box(g, 0.64, 0.1, 0.46, '#6B4429', 0, 0.05, 0);
      const face = cyl(g, 0.21, 0.21, 0.03, '#FFFDF7', 0, 1.62, 0.2, 20); face.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        box(g, 0.025, i % 3 ? 0.03 : 0.05, 0.01, '#3B3B45', Math.sin(a) * 0.17, 1.62 + Math.cos(a) * 0.17, 0.218).rotation.z = -a;
      }
      box(g, 0.32, 0.78, 0.02, '#F3E2B4', 0, 0.86, 0.205);
      const hand = (len, wd, col, z) => {
        const p = new THREE.Group();
        p.position.set(0, 1.62, z);
        const b = box(p, wd, len, 0.012, col, 0, len / 2 - 0.02, 0);
        b.userData.noMerge = true; b.castShadow = false;
        g.add(p);
        return p;
      };
      const hour = hand(0.11, 0.03, '#2E2A2A', 0.225), minute = hand(0.16, 0.02, '#2E2A2A', 0.232);
      ball(g, 0.018, '#F6D55C', 0, 1.62, 0.238, 6);
      const pend = new THREE.Group();
      pend.position.set(0, 1.22, 0.215);
      const rod = box(pend, 0.02, 0.5, 0.012, '#C99862', 0, -0.25, 0);
      const bob = cyl(pend, 0.08, 0.08, 0.02, '#F6D55C', 0, -0.52, 0, 14); bob.rotation.x = Math.PI / 2;
      for (const o of [rod, bob]) { o.userData.noMerge = true; o.castShadow = false; }
      g.add(pend);
      anim.clock = { hour, minute, pend };
      break;
    }
    case 'h_rocking': {
      for (const x of [-0.24, 0.24]) {
        box(g, 0.06, 0.06, 0.74, WD, x, 0.06, 0);
        for (const s of [-1, 1]) { const tip = box(g, 0.06, 0.06, 0.2, WD, x, 0.1, s * 0.44); tip.rotation.x = -s * 0.5; }
        for (const z of [-0.2, 0.2]) box(g, 0.06, 0.38, 0.06, WD, x, 0.27, z);
      }
      box(g, 0.56, 0.07, 0.52, W, 0, 0.47, 0);
      box(g, 0.48, 0.06, 0.44, '#F6D55C', 0, 0.53, 0.02);
      const back = box(g, 0.56, 0.72, 0.06, W, 0, 0.88, -0.28); back.rotation.x = -0.14;
      for (const x of [-0.29, 0.29]) box(g, 0.06, 0.06, 0.48, WD, x, 0.7, 0);
      break;
    }
    case 'h_beanbag':
      ball(g, 0.44, '#F49A4C', 0, 0.26, 0.04, 14).scale.set(1, 0.6, 1);
      ball(g, 0.36, '#E8853A', 0, 0.5, -0.2, 14).scale.set(1.05, 0.95, 0.6);
      break;
    case 'h_bigrug': {
      // 네모 러그: 바닥(0.06) 위로 겹마다 조금씩 높인다
      const lay = (w, d, c, top) => { const o = box(g, w, top - 0.058, d, c, 0, (top + 0.058) / 2, 0); o.castShadow = false; return o; };
      lay(2.86, 1.86, '#5FA9E0', 0.07);
      lay(2.6, 1.6, '#FFFDF7', 0.075);
      lay(2.4, 1.4, '#8CC6EE', 0.08);
      for (let i = -2; i <= 2; i++) { const o = box(g, 0.22, 0.03, 0.22, i % 2 ? '#F6D55C' : '#F6A2C4', i * 0.45, 0.07, 0); o.rotation.y = Math.PI / 4; o.castShadow = false; }
      break;
    }
    case 'h_tallplant': {
      cyl(g, 0.27, 0.2, 0.44, '#FFFDF7', 0, 0.22, 0, 14);
      cyl(g, 0.29, 0.29, 0.05, '#E5DCCB', 0, 0.45, 0, 14);
      cyl(g, 0.24, 0.24, 0.02, '#7A5233', 0, 0.47, 0, 14);
      cyl(g, 0.035, 0.045, 1.1, '#6B8E3A', 0, 1.0, 0, 6);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, y = 0.85 + i * 0.16, r = 0.22 + (i % 3) * 0.05;
        const lf = ball(g, 0.24, i % 2 ? '#4FA64A' : '#5DB760', Math.cos(a) * r, y, Math.sin(a) * r, 10);
        lf.scale.set(1.1, 0.25, 0.7);
        lf.rotation.set(0.35 * Math.sin(a), -a, 0.5 * Math.cos(a));
      }
      break;
    }
    case 'h_fireplace': {
      // 벽돌 몸통: 가운데가 뚫린 아궁이 (안쪽 벽은 검게)
      box(g, 1.9, 0.06, 0.7, '#B9B3A8', 0, 0.03, 0.05);
      for (const x of [-0.68, 0.68]) {
        box(g, 0.44, 1.3, 0.55, '#C96F4E', x, 0.71, -0.14);
        for (let r = 0; r < 6; r++) box(g, 0.45, 0.02, 0.56, '#A85A3E', x, 0.28 + r * 0.2, -0.14);
      }
      box(g, 0.92, 0.5, 0.55, '#C96F4E', 0, 1.11, -0.14);
      box(g, 0.93, 0.02, 0.56, '#A85A3E', 0, 1.08, -0.14);
      box(g, 0.92, 0.06, 0.55, '#B9B3A8', 0, 0.09, -0.14);
      box(g, 0.92, 0.7, 0.04, '#2E2622', 0, 0.47, -0.39);
      box(g, 1.96, 0.1, 0.66, '#FFFDF7', 0, 1.4, -0.1);
      for (const x of [-0.15, 0.15]) { const lg = cyl(g, 0.06, 0.06, 0.55, '#7A5233', x * 0.5, 0.2, 0.05 + x * 0.3, 8); lg.rotation.set(0, 0.3 + x, Math.PI / 2); }
      const flame = new THREE.Group();
      flame.position.set(0, 0.24, 0.05);
      for (const [x, s, c] of [[0, 1, '#F6A54C'], [-0.14, 0.7, '#F49A4C'], [0.14, 0.75, '#FFD27A'], [0, 0.5, '#FFF2B3']]) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.38 * s, 7), new THREE.MeshBasicMaterial({ color: c }));
        f.position.set(x, 0.17 * s, c === '#FFF2B3' ? 0.04 : 0);
        f.userData.noMerge = true; f.castShadow = false;
        flame.add(f);
      }
      g.add(flame);
      anim.flame = flame;
      cyl(g, 0.05, 0.05, 0.18, '#FFFDF7', -0.6, 1.5, -0.1, 8);
      ball(g, 0.03, glow('#FFE08A'), -0.6, 1.62, -0.1, 6);
      box(g, 0.32, 0.26, 0.04, '#F6D55C', 0.45, 1.55, -0.25);
      box(g, 0.24, 0.18, 0.02, '#9FD8F0', 0.45, 1.55, -0.22);
      break;
    }
    // 주방
    case 'h_dtable': {
      box(g, 1.6, 0.07, 1.0, W, 0, 0.76, 0);
      for (const x of [-0.7, 0.7]) for (const z of [-0.4, 0.4]) box(g, 0.08, 0.73, 0.08, WD, x, 0.365, z);
      box(g, 0.42, 0.01, 0.96, '#EF6461', 0, 0.8, 0);
      for (const x of [-0.42, 0.42]) for (const z of [-0.28, 0.28]) cyl(g, 0.14, 0.12, 0.02, '#FFFDF7', x, 0.81, z, 14);
      cyl(g, 0.06, 0.05, 0.16, '#7EC8E3', 0, 0.88, 0, 10);
      ball(g, 0.07, '#F6D55C', 0, 1.0, 0, 8);
      // 의자 넷: 앞뒤로 둘씩, 등받이가 바깥쪽
      for (const s of [-1, 1]) for (const x of [-0.42, 0.42]) {
        box(g, 0.46, 0.07, 0.44, W, x, 0.46, s * 1.02);
        box(g, 0.4, 0.05, 0.38, '#F6A2C4', x, 0.51, s * 1.02);
        for (const dx of [-0.19, 0.19]) for (const dz of [-0.18, 0.18]) box(g, 0.06, 0.45, 0.06, WD, x + dx, 0.22, s * 1.02 + dz);
        box(g, 0.46, 0.5, 0.06, W, x, 0.74, s * 1.22);
      }
      break;
    }
    case 'h_fridge': {
      box(g, 0.8, 0.62, 0.7, '#EEF3F6', 0, 1.5, 0);
      box(g, 0.78, 0.6, 0.05, '#F7FAFC', 0, 1.5, 0.37);
      box(g, 0.04, 0.3, 0.05, '#B7C3CB', 0.3, 1.45, 0.41);
      // 아래 칸: 안이 보이는 통 (문을 열면 보인다)
      box(g, 0.8, 1.18, 0.05, '#EEF3F6', 0, 0.6, -0.33);
      for (const x of [-0.38, 0.38]) box(g, 0.04, 1.18, 0.7, '#EEF3F6', x, 0.6, 0);
      box(g, 0.8, 0.04, 0.7, '#EEF3F6', 0, 0.02, 0);
      box(g, 0.8, 0.03, 0.7, '#B7C3CB', 0, 1.19, 0);
      box(g, 0.72, 1.1, 0.02, '#DDEEF5', 0, 0.6, -0.3);
      for (const y of [0.4, 0.78]) box(g, 0.72, 0.02, 0.6, '#FFFFFF', 0, y, 0);
      box(g, 0.12, 0.26, 0.12, '#FFFDF7', -0.2, 0.92, 0); box(g, 0.12, 0.05, 0.12, '#5FA9E0', -0.2, 1.06, 0);
      ball(g, 0.08, '#EF4A3E', 0.05, 0.88, 0.05, 8); ball(g, 0.08, '#9BD971', 0.2, 0.88, -0.05, 8);
      box(g, 0.3, 0.12, 0.2, '#F6A2C4', 0.1, 0.48, 0); box(g, 0.3, 0.03, 0.2, '#FFFDF7', 0.1, 0.555, 0);
      cyl(g, 0.05, 0.03, 0.22, '#F49A4C', -0.2, 0.5, 0.05, 6).rotation.z = Math.PI / 2;
      const hinge = new THREE.Group();
      hinge.position.set(0.4, 0, 0.35);
      const door = box(hinge, 0.8, 1.16, 0.05, '#F7FAFC', -0.4, 0.6, 0.025);
      const hd = box(hinge, 0.04, 0.4, 0.05, '#B7C3CB', -0.1, 0.8, 0.07);
      for (const o of [door, hd]) o.userData.noMerge = true;
      g.add(hinge);
      anim.door = hinge;
      break;
    }
    case 'h_sink': {
      box(g, 1.7, 0.85, 0.6, '#FFFDF7', 0, 0.425, 0);
      for (const x of [-0.42, 0.42]) { box(g, 0.78, 0.7, 0.03, '#CFE6F2', x, 0.42, 0.31); box(g, 0.04, 0.18, 0.04, '#B7C3CB', x + (x < 0 ? 0.3 : -0.3), 0.6, 0.34); }
      box(g, 1.8, 0.06, 0.66, '#B7C3CB', 0, 0.88, 0);
      box(g, 0.76, 0.012, 0.44, '#7F949F', -0.3, 0.915, 0.03);
      box(g, 0.66, 0.012, 0.34, '#AFC4CE', -0.3, 0.922, 0.03);
      cyl(g, 0.03, 0.03, 0.3, '#B7C3CB', -0.3, 1.06, -0.22, 8);
      box(g, 0.05, 0.05, 0.22, '#B7C3CB', -0.3, 1.2, -0.12);
      ball(g, 0.04, '#EF6461', -0.18, 1.0, -0.24, 6);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 6), new THREE.MeshBasicMaterial({ color: '#9FD8F0', transparent: true, opacity: 0.8 }));
      water.position.set(-0.3, 1.05, -0.02);
      water.visible = false;
      water.userData.noMerge = true;
      g.add(water);
      anim.water = water;
      for (let i = 0; i < 4; i++) cyl(g, 0.15, 0.13, 0.02, '#FFFDF7', 0.45, 0.93 + i * 0.025, 0.02, 14);
      cyl(g, 0.06, 0.05, 0.12, '#F6A2C4', 0.7, 0.97, -0.15, 8);
      break;
    }
    case 'h_cupboard': {
      box(g, 1.7, 0.85, 0.5, '#E2B47F', 0, 0.425, 0);
      for (const x of [-0.42, 0.42]) { box(g, 0.78, 0.72, 0.03, '#EBC995', x, 0.43, 0.26); ball(g, 0.035, '#F6D55C', x + (x < 0 ? 0.3 : -0.3), 0.6, 0.29, 6); }
      box(g, 1.76, 0.05, 0.54, '#C99862', 0, 0.87, 0);
      // 위칸: 앞이 트인 선반에 접시와 컵
      box(g, 1.7, 1.0, 0.04, '#E2B47F', 0, 1.4, -0.2);
      for (const x of [-0.83, 0.83]) box(g, 0.04, 1.0, 0.36, '#E2B47F', x, 1.4, -0.04);
      for (const y of [1.25, 1.62, 1.9]) box(g, 1.7, 0.04, 0.36, '#C99862', 0, y, -0.04);
      for (let i = 0; i < 4; i++) { const p = cyl(g, 0.14, 0.14, 0.02, ['#FFFDF7', '#BFE3F5', '#FFFDF7', '#F9D5E0'][i], -0.6 + i * 0.4, 1.42, -0.14, 16); p.rotation.x = Math.PI / 2 - 0.25; }
      for (let i = 0; i < 5; i++) cyl(g, 0.06, 0.05, 0.12, ['#EF6461', '#5FA9E0', '#F6D55C', '#5DB760', '#F6A2C4'][i], -0.64 + i * 0.32, 1.7, -0.02, 10);
      break;
    }
    case 'h_oven':
      box(g, 0.8, 0.9, 0.66, '#EDEDF0', 0, 0.45, 0);
      box(g, 0.78, 0.03, 0.64, '#2E2E36', 0, 0.915, 0);
      for (const x of [-0.18, 0.18]) for (const z of [-0.15, 0.15]) cyl(g, 0.1, 0.1, 0.012, '#55555F', x, 0.935, z, 12);
      box(g, 0.6, 0.38, 0.03, '#3B3B45', 0, 0.45, 0.33);
      box(g, 0.48, 0.26, 0.02, glow('#F6B26B'), 0, 0.45, 0.35);
      box(g, 0.56, 0.04, 0.05, '#B7C3CB', 0, 0.72, 0.37);
      for (let i = 0; i < 4; i++) ball(g, 0.03, '#3B3B45', -0.27 + i * 0.18, 0.83, 0.34, 6);
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
      // 다 자라면 잎 사이사이 바깥쪽에 빨간 딸기 네 알 (한 번에 거두는 수와 같다). 잎에 가리지 않게 잎과 잎 사이에 단다
      if (grown) for (let i = 0; i < 4; i++) {
        const a = ((i + 0.5) / 5) * Math.PI * 2, x = Math.cos(a) * 0.29, z = Math.sin(a) * 0.29;
        const b = ball(g, 0.085, '#E8394B', x, 0.11, z, 10); b.scale.set(1, 1.2, 1);
        const cap = ball(g, 0.045, L, x, 0.21, z, 6); cap.scale.set(1.5, 0.45, 1.5);
        for (const [dx, dz] of [[0.035, 0.045], [-0.045, 0.025], [0.01, -0.05]]) ball(g, 0.01, '#FFE08A', x + dx, 0.13, z + dz, 4); // 씨
      }
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
    this.baseObs = []; // 대문 기둥, 옷장
    this.houseObs = []; // 방 벽, 주방 조리대 (집을 넓히면 다시 만든다)
    this.itemObs = [];
    this.houseG = null;
    this.houseFades = [];
    this.housePicks = [];
    this.areaDoors = [];
    this.rooms = [];
    this.style = {};
    this.kitchenSpot = null;
    this.fx = null;
    this.items = new Map(); // id → { e, obj, anim, stage }
    this.layout = [];
    this.pickRoots = [];
    this.ghost = null;
    this.sel = null;
    this.t = 0;
    this.build();
    this.setPlan([], {});
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
    const S = 2048, SX = ISLAND.x1 - ISLAND.x0, SZ = ISLAND.z1 - ISLAND.z0;
    const c = document.createElement('canvas');
    c.width = S; c.height = Math.round(S * SZ / SX);
    const ctx = c.getContext('2d');
    const u = S / SX;
    const px = (x) => (x - ISLAND.x0) * u, pz = (z) => (z - ISLAND.z0) * u;
    ctx.fillStyle = '#8DCC5F'; ctx.fillRect(0, 0, c.width, c.height);
    let sd = 7;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < Math.round(SX * 20); i++) {
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

    // 방 바닥과 벽은 buildHouse가 지은 방 수에 맞춰 만든다
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
    this.baseObs.push({ x: -9.45, z: -9.6, hw: 0.5, hd: 0.35 });

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
    for (const x of [-1.25, 1.25]) this.baseObs.push({ x, z: 9.85, hw: 0.15, hd: 0.15 });
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

  // ---------- 집 모양: 지은 방(rooms: 지은 차례)과 방마다 벽지·바닥(style) ----------
  setPlan(rooms, style) {
    setRooms(rooms);
    this.rooms = builtRooms();
    this.style = style && typeof style === 'object' ? JSON.parse(JSON.stringify(style)) : {};
    this.buildHouse();
  }
  clearHouse() {
    const v = this.v;
    if (!this.houseG) return;
    this.houseG.removeFromParent();
    this.houseG.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    for (const f of this.houseFades) for (const mt of f.mats) mt.dispose();
    v.fadeables = v.fadeables.filter((f) => !this.houseFades.includes(f));
    this.pickRoots = this.pickRoots.filter((o) => !this.housePicks.includes(o));
    for (let i = v.doors.length - 1; i >= 0; i--) if (['home-build', 'home-cook'].includes(v.doors[i].id)) v.doors.splice(i, 1);
    this.houseG = null;
    this.houseFades = [];
    this.housePicks = [];
    this.houseObs = [];
    this.areaDoors = [];
    this.kitchenSpot = null;
  }
  buildHouse() {
    const v = this.v;
    this.clearHouse();
    const G = new THREE.Group();
    this.houseG = G;
    const list = spaces();
    const west = list[list.length - 1];
    const obs = (x, z, hw, hd) => this.houseObs.push({ x, z, hw, hd });
    // 벽 묶음: 합쳐서 그리고, 카메라와 나 사이에 오면 흐려진다
    const wallGroup = (grp, x, z, r) => {
      mergeColored(grp, VC);
      mergeStatic(grp);
      G.add(grp);
      this.houseFades.push(v.makeFadeable(grp, HOME_O.x + x, HOME_O.z + z, r));
    };
    const doorDefs = [{ a: 'room', b: 'yard', pa: DOOR_IN, pb: DOOR_OUT }];
    list.forEach((s, i) => {
      const st = styleOf(this.style, s.id);
      const isR1 = s.id === 'room', isWest = s === west;
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      // 바닥
      const fl = m(new THREE.BoxGeometry(s.x1 - s.x0, 0.06, s.z1 - s.z0), floorMat(st.f), cx, 0.03, cz);
      fl.castShadow = false;
      fl.userData.noMerge = true;
      G.add(fl);
      // 뒤 벽 (창문 둘, 주방은 조리대 뒤에 타일)
      const xa = s.x0 - (isWest ? 0.2 : 0), xb = s.x1 + (isR1 ? 0.2 : 0), len = xb - xa, bx = (xa + xb) / 2;
      const back = new THREE.Group();
      box(back, len, WH, 0.2, wallMat(st.w, len), bx, WH / 2, -10.1);
      box(back, len, 0.12, 0.26, TRIM, bx, WH, -10.1);
      const wins = isR1 ? [-8, -4] : s.id === 'kitchen' ? [s.x0 + 7] : [s.x0 + 2, s.x0 + 6];
      for (const x of wins) {
        box(back, 1.2, 0.9, 0.05, '#BFE3F5', x, 1.45, -9.98);
        box(back, 1.32, 0.08, 0.1, '#FFFDF7', x, 0.98, -9.97); box(back, 0.06, 0.9, 0.08, '#FFFDF7', x, 1.45, -9.96);
      }
      if (s.id === 'kitchen') {
        const kx = cookAt(s).x + 0.3;
        box(back, 3.9, 0.95, 0.03, '#FFFDF7', kx, 1.45, -9.985);
        for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) if ((r + k) % 2) box(back, 0.28, 0.21, 0.02, '#BFDDEB', kx - 1.8 + k * 0.3, 1.08 + r * 0.24, -9.97);
        box(back, 1.8, 0.05, 0.05, '#B7C3CB', kx - 0.6, 2.05, -9.95);
        for (let k = 0; k < 4; k++) { box(back, 0.03, 0.32, 0.03, '#8A8F98', kx - 1.25 + k * 0.42, 1.86, -9.93); cyl(back, 0.07, 0.07, 0.03, '#8A8F98', kx - 1.25 + k * 0.42, 1.7, -9.93, 10).rotation.x = Math.PI / 2; }
      }
      wallGroup(back, bx, -10.1, len / 2);
      obs(bx, -10.1, len / 2, 0.1);
      // 오른쪽(동쪽) 벽: 내 방은 마당으로 가는 문, 새 방은 오른쪽 방과 잇는 문 (벽 양쪽이 각 방 벽지)
      const side = new THREE.Group();
      if (isR1) {
        const c = wallSolid(st.w);
        box(side, 0.2, WH, 2.9, wallMat(st.w, 2.9), -1.9, WH / 2, -8.65);
        box(side, 0.2, WH, 1.9, wallMat(st.w, 1.9), -1.9, WH / 2, -4.85);
        box(side, 0.2, 0.5, 1.4, c, -1.9, WH - 0.25, -6.5);
        box(side, 0.26, 0.12, 6.4, TRIM, -1.9, WH, -7);
        box(side, 0.28, 0.12, 1.5, '#8B5E3C', -1.9, WH - 0.52, -6.5);
        wallGroup(side, -1.9, -7, 3.2);
        obs(-1.9, -8.65, 0.1, 1.45); obs(-1.9, -4.85, 0.1, 0.95);
      } else {
        const b = s.x1, east = list[i - 1], ste = styleOf(this.style, east.id);
        for (const [dx, wk] of [[0.05, ste.w], [-0.05, st.w]]) {
          box(side, 0.1, WH, 2.9, wallMat(wk, 2.9), b + dx, WH / 2, -8.65);
          box(side, 0.1, WH, 1.9, wallMat(wk, 1.9), b + dx, WH / 2, -4.85);
          box(side, 0.1, 0.5, 1.4, wallSolid(wk), b + dx, WH - 0.25, -6.5);
        }
        box(side, 0.26, 0.12, 6.4, TRIM, b, WH, -7);
        box(side, 0.28, 0.12, 1.5, '#8B5E3C', b, WH - 0.52, -6.5);
        wallGroup(side, b, -7, 3.2);
        obs(b, -8.65, 0.1, 1.45); obs(b, -4.85, 0.1, 0.95);
        doorDefs.push({ a: s.id, b: east.id, pa: { x: b - 0.75, z: -6.5 }, pb: { x: b + 0.75, z: -6.5 } });
      }
      // 맨 왼쪽 방의 왼쪽 벽 (창문 하나)
      if (isWest) {
        const lw = new THREE.Group();
        box(lw, 0.2, WH, 6.4, wallMat(st.w, 6.4), s.x0 - 0.1, WH / 2, -7);
        box(lw, 0.26, 0.12, 6.4, TRIM, s.x0 - 0.1, WH, -7);
        box(lw, 0.05, 0.9, 1.2, '#BFE3F5', s.x0 + 0.02, 1.45, -6.6);
        wallGroup(lw, s.x0 - 0.1, -7, 3.2);
        obs(s.x0 - 0.1, -7, 0.1, 3.2);
      }
      // 앞 벽 (낮게 해서 안이 보이게). 새 방은 가운데 앞문
      const front = new THREE.Group();
      const fc = wallSolid(st.w);
      const fa = s.x0 - (isWest ? 0.2 : 0), fb = s.x1 + (isR1 ? 0.2 : 0);
      const segs = isR1 ? [[fa, fb]] : [[fa, frontDoorX(s) - 0.7], [frontDoorX(s) + 0.7, fb]];
      for (const [a, b] of segs) {
        box(front, b - a, 0.55, 0.2, fc, (a + b) / 2, 0.275, -3.9);
        box(front, b - a, 0.08, 0.28, TRIM, (a + b) / 2, 0.58, -3.9);
        for (let x = a + 0.6, k = 0; x < b - 0.3; x += 1.15, k++) ball(front, 0.12, ['#EF6461', '#F6D55C', '#F6A2C4'][(k + i) % 3], x, 0.7, -3.86, 8);
        obs((a + b) / 2, -3.9, (b - a) / 2, 0.1);
      }
      if (!isR1) {
        const c = frontDoorX(s);
        for (const x of [c - 0.78, c + 0.78]) box(front, 0.16, 0.9, 0.28, TRIM, x, 0.45, -3.9);
        box(front, 1.3, 0.02, 0.62, '#C9733F', c, 0.012, -3.42); // 문 앞 발판
        for (let z = -2.9, k = 0; z < -0.3; z += 0.9, k++) cyl(front, 0.36, 0.36, 0.03, '#EAD7A8', c + (k % 2 ? 0.25 : -0.2), 0.015, z, 12);
        doorDefs.push({ a: s.id, b: 'yard', pa: { x: c, z: -4.75 }, pb: { x: c, z: -3.25 } });
      }
      front.traverse((o) => { if (o.isMesh && o.position.y < 0.05) o.castShadow = false; });
      mergeColored(front, VC);
      G.add(front);
      // 주방 조리대와 화덕 (요리 놀이 자리)
      if (s.id === 'kitchen') this.buildKitchen(G, s, obs);
    });
    // 공사 터: 아직 짓지 않은 자리
    if (this.lotOn !== false && this.rooms.length < BUILD_IDS.length) this.buildLot(G, west.x0);
    this.areaDoors = doorDefs;
    this.root.add(G);
  }
  // 주방 조리대: 숲속 부엌(요리 놀이)과 같은 크기와 자리 (조리대 윗면 0.98, 냄비는 오른쪽 앞)
  buildKitchen(G, s, obs) {
    const v = this.v, at = cookAt(s);
    const ks = new THREE.Group();
    box(ks, 2.6, 0.9, 0.8, '#FFFDF7', 0, 0.45, -0.35);
    for (const x of [-0.87, 0, 0.87]) { box(ks, 0.8, 0.7, 0.03, '#BFDDEB', x, 0.43, 0.06); ball(ks, 0.035, '#F6D55C', x, 0.66, 0.09, 6); }
    box(ks, 2.7, 0.08, 0.9, '#B7C3CB', 0, 0.94, -0.35);
    box(ks, 0.7, 0.05, 0.45, '#C99862', -0.7, 1.0, -0.3);
    cyl(ks, 0.09, 0.09, 0.2, '#F6D55C', -1.15, 1.08, -0.62, 10);
    cyl(ks, 0.07, 0.07, 0.16, '#EF6461', -0.95, 1.06, -0.66, 10);
    box(ks, 0.95, 0.27, 0.95, '#4A4A55', 1.85, 0.135, 0.5);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 18), new THREE.MeshBasicMaterial({ color: '#F6A54C' }));
    fire.position.set(1.85, 0.28, 0.5);
    fire.userData.noMerge = true;
    ks.add(fire);
    cyl(ks, 0.38, 0.3, 0.42, '#4A4A55', 1.85, 0.48, 0.5, 14);
    cyl(ks, 0.36, 0.36, 0.02, '#C9733F', 1.85, 0.7, 0.5, 14);
    mergeColored(ks, VC);
    mergeStatic(ks);
    ks.position.set(at.x, 0, at.z);
    ks.userData.pick = { type: 'building', id: 'home-cook' };
    G.add(ks);
    this.pickRoots.push(ks);
    this.housePicks.push(ks);
    obs(at.x, at.z - 0.35, 1.3, 0.4);
    obs(at.x + 1.85, at.z + 0.5, 0.48, 0.48);
    this.kitchenSpot = { x: HOME_O.x + at.x, z: HOME_O.z + at.z, rot: 0, scene: this.scene, group: ks, home: true, onUse: () => this.cookHide(true) };
    v.doors.push({ id: 'home-cook', name: '부엌 조리대', pos: this.toWorld(at.x, at.z + 1.05), group: ks });
  }
  // 공사 터: 흙바닥, 말뚝과 줄, 팻말 (누르면 집 넓히기)
  buildLot(G, xr) {
    const v = this.v;
    const lot = new THREE.Group();
    const w = xr - LOT_X0, cx = (LOT_X0 + xr) / 2;
    box(lot, w, 0.03, 6, '#D7C29B', cx, 0.015, -7).castShadow = false;
    const stakes = [];
    for (let x = LOT_X0; x <= xr - 0.6; x += 2) stakes.push([x, -3.95], [x, -10.05]);
    for (let z = -8; z < -4; z += 2) stakes.push([LOT_X0, z]);
    for (const [x, z] of stakes) { box(lot, 0.1, 0.62, 0.1, '#B07F4E', x, 0.31, z); box(lot, 0.12, 0.08, 0.12, '#EF6461', x, 0.64, z); }
    box(lot, w - 0.6, 0.03, 0.03, '#F6D55C', cx - 0.3, 0.46, -3.95);
    box(lot, w - 0.6, 0.03, 0.03, '#F6D55C', cx - 0.3, 0.46, -10.05);
    box(lot, 0.03, 0.03, 6.1, '#F6D55C', LOT_X0, 0.46, -7);
    // 쌓아 둔 나무판과 고깔
    for (let k = 0; k < 3; k++) box(lot, 1.6, 0.1, 0.32, ['#C99862', '#B07F4E', '#D9A86C'][k], LOT_X0 + 2.2, 0.08 + k * 0.1, -9 + k * 0.05);
    cyl(lot, 0.04, 0.22, 0.5, '#F49A4C', LOT_X0 + 4.4, 0.25, -8.6, 10);
    box(lot, 0.46, 0.04, 0.46, '#F49A4C', LOT_X0 + 4.4, 0.02, -8.6);
    mergeColored(lot, VC);
    G.add(lot);
    // 팻말
    const sx = xr - SLOT_W / 2;
    const sign = new THREE.Group();
    for (const x of [-0.75, 0.75]) box(sign, 0.1, 1.2, 0.1, '#8B5E3C', x, 0.6, 0);
    mergeColored(sign, VC);
    if (!this.lotMat) this.lotMat = new THREE.MeshToonMaterial({ map: signTex('집 넓히기 공사 터', '눌러서 방을 지어요'), gradientMap: toonGradient() });
    const bd = m(new THREE.BoxGeometry(1.9, 0.54, 0.06), [toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), toon('#6B4429'), this.lotMat, toon('#6B4429')], 0, 1.25, 0.06);
    bd.userData.noMerge = true;
    sign.add(bd);
    sign.position.set(sx, 0, -3.45);
    sign.userData.pick = { type: 'building', id: 'home-build' };
    G.add(sign);
    this.pickRoots.push(sign);
    this.housePicks.push(sign);
    v.doors.push({ id: 'home-build', name: '집 넓히기 공사 터', pos: this.toWorld(sx, -2.5), group: sign });
  }
  // 집 안 좌표 (x, z)가 어느 방인지 (방 밖이면 'yard')
  areaAt(x, z) {
    if (z <= -10.2 || z >= -3.9) return 'yard';
    const list = spaces();
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const lo = i === list.length - 1 ? s.x0 - 0.2 : s.x0, hi = i === 0 ? s.x1 + 0.1 : s.x1;
      if (x >= lo && x < hi) return s.id;
    }
    return 'yard';
  }
  // 집 넓히기 공사 장면: 비계와 먼지. mid에 새 방을 그리고, end에 끝낸다
  buildFx(rect, { onHit, onMid, onEnd } = {}) {
    this.endFx();
    const g = new THREE.Group();
    const cx = (rect.x0 + rect.x1) / 2;
    const pole = toon('#F6D55C'), plank = toon('#C99862');
    for (const x of [rect.x0 + 0.2, cx, rect.x1 - 0.2]) for (const z of [-10.3, -3.7]) g.add(m(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), pole, x, 1.4, z));
    for (const y of [0.9, 1.9, 2.75]) for (const z of [-10.3, -3.7]) g.add(m(new THREE.BoxGeometry(rect.x1 - rect.x0 - 0.2, 0.08, 0.3), plank, cx, y, z));
    const net = new THREE.Mesh(new THREE.PlaneGeometry(rect.x1 - rect.x0 - 0.3, 2.6), new THREE.MeshBasicMaterial({ color: '#7FC97A', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(cx, 1.4, -3.62);
    g.add(net);
    g.scale.y = 0.01;
    this.root.add(g);
    const puffMat = new THREE.MeshBasicMaterial({ color: '#F3E9D6', transparent: true, opacity: 0.8, depthWrite: false });
    this.fx = { t: 0, g, rect, puffs: [], puffMat, nextPuff: 0, nextHit: 0.3, mid: false, onHit, onMid, onEnd };
  }
  endFx() {
    const f = this.fx;
    if (!f) return;
    this.fx = null;
    f.g.removeFromParent();
    f.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const p of f.puffs) { p.removeFromParent(); p.geometry.dispose(); }
    f.puffMat.dispose();
  }
  tickFx(dt) {
    const f = this.fx;
    if (!f) return;
    f.t += dt;
    const T_MID = 2.6, T_END = 3.8;
    f.g.scale.y = Math.min(1, Math.max(0.01, f.t < T_MID ? f.t / 0.6 : 1 - (f.t - T_MID - 0.5) / 0.6));
    if (f.t < T_MID) {
      f.nextPuff -= dt;
      if (f.nextPuff <= 0) {
        f.nextPuff = 0.12;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), f.puffMat);
        p.position.set(f.rect.x0 + 0.6 + Math.random() * (f.rect.x1 - f.rect.x0 - 1.2), 0.3 + Math.random() * 0.8, -9.3 + Math.random() * 4.6);
        p.userData.life = 0;
        this.root.add(p);
        f.puffs.push(p);
      }
      f.nextHit -= dt;
      if (f.nextHit <= 0) { f.nextHit = 0.32; if (f.onHit) f.onHit(); }
    }
    for (let i = f.puffs.length - 1; i >= 0; i--) {
      const p = f.puffs[i];
      p.userData.life += dt;
      const k = p.userData.life / 0.9;
      p.scale.setScalar(0.5 + k * 1.4);
      p.position.y += dt * 0.6;
      if (k >= 1) { p.removeFromParent(); p.geometry.dispose(); f.puffs.splice(i, 1); }
    }
    if (!f.mid && f.t >= T_MID) { f.mid = true; if (f.onMid) f.onMid(); }
    if (f.t >= T_END) { const end = f.onEnd; this.endFx(); if (end) end(); }
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
    // 밭 식물은 흙 두둑(윗면 높이 0.16) 위에 심는다. 땅 높이에 두면 씨앗과 딸기, 당근 머리가 두둑 속에 묻혀 안 보인다
    it.obj.position.set(c.x, isSeed(it.e.k) ? PLANT_Y : 0, c.z);
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
    const c = centerOf(e), y = isSeed(e.k) ? PLANT_Y : 0; // 씨앗은 두둑 위에
    wrap.position.set(c.x, y, c.z);
    wrap.rotation.y = -(e.r || 0) * Math.PI / 2;
    padWrap.position.set(c.x, y, c.z);
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
  inRoom(x, z) { return this.areaAt(x, z) !== 'yard'; }
  resolve(p) {
    const l = this.toLocal(p);
    let { x, z } = l;
    for (const o of [...this.baseObs, ...this.houseObs, ...this.itemObs]) {
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
  // 다른 방이나 마당으로 갈 때는 방문을 지나간다 (방과 방 사이 문, 방 앞문, 내 방 옆문을 이은 길 가운데 가장 짧은 길)
  planRoute(from, to) {
    const A = this.toLocal(from), B = this.toLocal(to);
    const a = this.areaAt(A.x, A.z), b = this.areaAt(B.x, B.z);
    if (a === b) return [];
    const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
    const open = [{ area: a, p: A, cost: 0, path: [] }];
    const seen = new Map();
    let done = null;
    while (open.length) {
      open.sort((x, y) => x.cost - y.cost);
      const cur = open.shift();
      if (done && cur.cost >= done.total) break;
      if (cur.area === b) {
        const total = cur.cost + dist(cur.p, B);
        if (!done || total < done.total) done = { total, path: cur.path };
        continue;
      }
      const key = `${cur.area}|${cur.p.x}|${cur.p.z}`;
      if (seen.has(key) && seen.get(key) <= cur.cost) continue;
      seen.set(key, cur.cost);
      for (const d of this.areaDoors) {
        let p1, p2, nx;
        if (d.a === cur.area) { p1 = d.pa; p2 = d.pb; nx = d.b; } else if (d.b === cur.area) { p1 = d.pb; p2 = d.pa; nx = d.a; } else continue;
        open.push({ area: nx, p: p2, cost: cur.cost + dist(cur.p, p1) + dist(p1, p2), path: [...cur.path, p1, p2] });
      }
    }
    if (!done) return [];
    return done.path.map((p) => ({ x: p.x + HOME_O.x, z: p.z + HOME_O.z }));
  }
  // 집 주방에서 요리할 때: 조리대 앞을 가리는 주방 가구를 잠깐 감춘다 (요리를 마치면 다시 보인다)
  cookHide(on) {
    const ks = spaces().find((s) => s.id === 'kitchen');
    for (const it of this.items.values()) {
      if (!it.obj) continue;
      if (!on) { if (it.cookHidden) { it.obj.visible = true; it.cookHidden = false; } continue; }
      if (!ks) continue;
      const c = centerOf(it.e), at = cookAt(ks);
      const front = c.z > at.z - 0.2 && Math.abs(c.x - (at.x + 0.6)) < 3.4; // 카메라와 조리대 사이
      const fridge = c.x < ks.x0 + 1.6 && c.z < at.z - 0.7; // 마음대로 요리할 때 냉장고가 나오는 왼쪽 뒤
      if (c.x > ks.x0 && c.x < ks.x1 && (front || fridge) && it.obj.visible) { it.obj.visible = false; it.cookHidden = true; }
    }
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
    const seats = R.seats.map(([lx, lz, tn, oz]) => ({ pos: at(lx, lz), lx, lz, tn, oz }));
    if (from) seats.sort((a, q) => Math.hypot(a.pos.x - from.x, a.pos.z - from.z) - Math.hypot(q.pos.x - from.x, q.pos.z - from.z));
    const seat = seats[0];
    // 식탁 의자처럼 일어설 곳을 따로 준 자리는 의자 뒤, 막혔으면 식탁 바깥 옆으로
    const outs = R.lie ? [at(R.side, seat.lz), at(-R.side, seat.lz), at(seat.lx, R.front)]
      : seat.oz != null ? [at(seat.lx, seat.oz), at(Math.sign(seat.lx || 1) * 1.4, seat.lz)] : [at(seat.lx, R.front)];
    return { x: seat.pos.x, y: R.y, z: seat.pos.z, rot: rotY + (seat.tn ?? R.turn ?? 0), lie: !!R.lie, out: near(outs), swing: R.swing ? id : null };
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
  // 누르면 움직이는 가구: 냉장고 문, 싱크대 물, 텔레비전 켜고 끄기, 지구본 빨리 돌리기
  poke(id) {
    const it = this.items.get(id);
    if (!it || !it.anim) return null;
    const a = it.anim;
    if (a.door) { it.openT = 2.6; return 'fridge'; }
    if (a.water) { it.waterT = 2.2; return 'sink'; }
    if (a.tv) { it.tvOff = !it.tvOff; a.tv.material = tvMat(!it.tvOff); return it.tvOff ? 'tv-off' : 'tv-on'; }
    if (a.spin) { it.spinT = 2.5; return 'globe'; }
    return null;
  }
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
      if (a.spin) a.spin.rotation.y += dt * (it.spinT > 0 ? 3.5 : 0.45);
      if (it.spinT > 0) it.spinT -= dt;
      if (a.clock) {
        // 이 기기의 지금 시각
        const d = new Date();
        const mins = d.getMinutes() + d.getSeconds() / 60;
        a.clock.minute.rotation.z = -(mins / 60) * Math.PI * 2;
        a.clock.hour.rotation.z = -(((d.getHours() % 12) + mins / 60) / 12) * Math.PI * 2;
        a.clock.pend.rotation.z = Math.sin(this.t * Math.PI) * 0.22; // 한 번 오가는 데 2초
      }
      if (a.fish) a.fish.forEach((f) => {
        const u = f.userData, k = Math.sin(this.t * u.sp + u.ph);
        f.position.x = k * 0.58;
        f.position.y = u.y + Math.sin(this.t * 1.7 + u.ph) * 0.04;
        f.rotation.y = Math.cos(this.t * u.sp + u.ph) >= 0 ? 0 : Math.PI;
      });
      if (a.bubbles) a.bubbles.children.forEach((b, i) => {
        const k = ((this.t * 0.45 + i / 5) % 1);
        b.position.set(Math.sin(k * 9 + i) * 0.03, 0.72 + k * 0.62, 0);
      });
      if (a.flame) a.flame.children.forEach((f, i) => { f.scale.set(1, 0.85 + Math.abs(Math.sin(this.t * (7 + i * 2.3) + i)) * 0.35, 1); });
      if (a.door) {
        if (it.openT > 0) it.openT -= dt;
        const want = it.openT > 0 ? 1.7 : 0;
        a.door.rotation.y += (want - a.door.rotation.y) * Math.min(1, dt * 7);
      }
      if (a.water) {
        if (it.waterT > 0) it.waterT -= dt;
        a.water.visible = it.waterT > 0;
        if (a.water.visible) a.water.scale.x = a.water.scale.z = 0.85 + Math.random() * 0.3;
      }
    }
    if (tvTex) tvTex.offset.x = (this.t * 0.02) % 1;
    this.tickFx(dt);
    this.plantTick = (this.plantTick || 0) - dt;
    if (this.plantTick <= 0) { this.plantTick = 20; this.refreshPlants(); }
    if (this.ghost) this.ghost.mat.opacity = 0.45 + Math.sin(this.t * 6) * 0.12;
  }
}
