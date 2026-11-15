// 진숲 어린이 마을 — 집 모양 (마을의 '○○의 집'과 내 집 섬의 바깥 모습)
// 나무 오두막과 빨간 벽돌집은 누구나 고르고, 한옥·통나무집·버섯집·작은 성은 열매 상점에서 산다(hs_ 물건, 서버 kids__item_price와 같은 값).
// 지붕 색은 '옷 색깔'(처음 값: 내 옷 색을 따른다) 또는 아래 여덟 가지에서 고른다.
// 내 집 섬에서는 마당에 있을 때만 지붕과 앞벽(껍데기)이 덮이고, 방에 들어가거나 꾸미기를 할 때는 걷혀서 안이 보인다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';

export { HOUSE_STYLES, HOUSE_IDS, houseItem, isFreeHouse, ROOF_COLORS, lookOf, roofColor, HOUSE_ITEMS, HOUSE_ITEM_IDS } from './houses-data.js';
import { HOUSE_STYLES, ROOF_COLORS, lookOf } from './houses-data.js';

// ---------- 무늬 (캔버스 그림을 되풀이) ----------
const texCache = new Map();
function patMat(kind, a, b, rx = 1, ry = 1) {
  const key = `${kind}|${a}|${b}|${rx}|${ry}`;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 128, 128);
  x.fillStyle = b; x.strokeStyle = b;
  if (kind === 'plank') { // 가로 판자 넷
    for (let i = 0; i < 4; i++) x.fillRect(0, i * 32, 128, 3);
    x.globalAlpha = 0.25; for (const [px, py] of [[20, 12], [80, 44], [50, 76], [104, 108]]) x.fillRect(px, py, 2, 12);
  } else if (kind === 'brick') { // 엇갈려 쌓은 벽돌 (줄눈 b)
    for (let r = 0; r < 4; r++) {
      x.fillRect(0, r * 32, 128, 4);
      for (let c = 0; c < 3; c++) x.fillRect(((r % 2) * 21 + c * 43) % 128, r * 32, 4, 32);
    }
    x.globalAlpha = 0.18; x.fillStyle = '#000'; for (let i = 0; i < 9; i++) x.fillRect((i * 37) % 120, (i * 53) % 120, 14, 9);
  } else if (kind === 'log') { // 둥근 통나무 셋: 위는 밝고 아래는 어둡게
    for (let r = 0; r < 3; r++) {
      const g = x.createLinearGradient(0, r * 42.7, 0, (r + 1) * 42.7);
      g.addColorStop(0, a); g.addColorStop(0.55, a); g.addColorStop(1, b);
      x.fillStyle = g; x.fillRect(0, r * 42.7, 128, 42.7);
      x.fillStyle = b; x.fillRect(0, (r + 1) * 42.7 - 3, 128, 3);
    }
  } else if (kind === 'stone') { // 돌 벽돌 (크기를 조금씩 다르게)
    const rows = [[0, 40], [40, 36], [76, 52]];
    rows.forEach(([y0, hh], r) => {
      x.fillRect(0, y0, 128, 3);
      let px = r * 19;
      while (px < 256) { x.fillRect(px % 128, y0, 3, hh); px += 34 + ((px * 7) % 17); }
    });
    x.globalAlpha = 0.12; x.fillStyle = '#000'; for (let i = 0; i < 12; i++) x.fillRect((i * 41) % 118, (i * 29) % 118, 10, 8);
  } else if (kind === 'plaster') { // 회벽: 고운 얼룩
    x.globalAlpha = 0.18; let s = 7;
    for (let i = 0; i < 160; i++) { s = (s * 16807) % 2147483647; const px = s % 128; s = (s * 16807) % 2147483647; x.fillRect(px, s % 128, 2, 2); }
  } else if (kind === 'shingle') { // 지붕 널: 가로줄과 엇갈린 이음매
    for (let r = 0; r < 4; r++) {
      x.fillRect(0, r * 32 + 29, 128, 3);
      for (let c = 0; c < 4; c++) x.fillRect(((r % 2) * 16 + c * 32) % 128, r * 32, 2, 32);
    }
  } else if (kind === 'giwa') { // 기와: 세로 골과 가로 줄
    for (let c = 0; c < 8; c++) { x.fillRect(c * 16, 0, 5, 128); }
    x.globalAlpha = 0.5; for (let r = 0; r < 4; r++) x.fillRect(0, r * 32 + 28, 128, 4);
  } else if (kind === 'lattice') { // 창살 (한옥 문)
    x.lineWidth = 5;
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); }
    x.lineWidth = 10; x.strokeRect(0, 0, 128, 128);
  } else if (kind === 'cream') {
    x.globalAlpha = 0.12; for (let i = 0; i < 6; i++) x.fillRect(0, i * 22 + 8, 128, 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  const mat = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() });
  texCache.set(key, mat);
  return mat;
}
const shadeHex = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - k))));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('');
};
// 모양마다 바깥 벽 (벽 길이 len, 높이 hh에 맞춰 무늬를 되풀이)
export function wallSkin(style, len, hh) {
  const rx = Math.max(1, Math.round(len)), ry = Math.max(1, Math.round(hh));
  switch (style) {
    case 'brick': return patMat('brick', '#C96F4E', '#EBDCCB', rx, ry);
    case 'hanok': return patMat('plaster', '#F4EFE6', '#C9BFAE', rx, ry);
    case 'log': return patMat('log', '#B5814F', '#7A5233', rx, ry);
    case 'mushroom': return patMat('cream', '#FFF4E2', '#E8D3B0', rx, ry);
    case 'castle': return patMat('stone', '#C9C2B6', '#9C948A', rx, ry);
    default: return patMat('plank', '#E2B47F', '#C99862', rx, ry);
  }
}
const roofMat = (style, c, rx, ry) => (style === 'hanok' ? patMat('giwa', c, shadeHex(c, 0.35), rx, ry) : patMat('shingle', c, shadeHex(c, 0.28), rx, ry));

// ---------- 작은 도우미 ----------
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (p, w, hh, d, mat, x, y, z) => { const o = mesh(new THREE.BoxGeometry(w, hh, d), mat, x, y, z); p.add(o); return o; };
const cyl = (p, rt, rb, hh, mat, x, y, z, seg = 12) => { const o = mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), mat, x, y, z); p.add(o); return o; };
const ball = (p, r, mat, x, y, z, seg = 10) => { const o = mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat, x, y, z); p.add(o); return o; };
// 세모 기둥 (밑변 w, 높이 hh, 두께 d): 박공(세모 벽)
function triGeo(w, hh, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, hh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  // 무늬가 벽 크기에 맞게 (가로 w칸, 세로 hh칸)
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / Math.max(1, w), pos.getY(i) / Math.max(1, hh));
  return g;
}
// 세모 지붕: 마루가 z 방향 (앞에서 보면 세모). 가로 w, 높이 hh, 깊이 d, 처마 두께 t
function gableRoof(p, mat, w, hh, d, y, z = 0, cx = 0) {
  const half = w / 2, len = Math.hypot(half, hh), ang = Math.atan2(hh, half);
  for (const s of [-1, 1]) {
    const o = box(p, len + 0.08, 0.14, d, mat, cx + s * half / 2, y + hh / 2, z);
    o.rotation.z = -s * ang;
  }
  box(p, 0.2, 0.2, d + 0.04, shadeMat(mat), cx, y + hh + 0.02, z); // 용마루
}
const shadeMat = (mat) => (mat.map ? '#5A4636' : mat);
// 우진각 지붕 (한옥): 밑이 (hx, hz) 반 크기 네모, 마루는 x 방향 (길이 2*(hx-hz))
function hipRoofGeo(hx, hz, hh) {
  const rx = Math.max(0.05, hx - hz);
  const P = [
    [-hx, 0, hz], [hx, 0, hz], [rx, hh, 0], [-rx, hh, 0], // 앞
    [hx, 0, -hz], [-hx, 0, -hz], [-rx, hh, 0], [rx, hh, 0], // 뒤
    [-hx, 0, -hz], [-hx, 0, hz], [-rx, hh, 0], // 왼쪽
    [hx, 0, hz], [hx, 0, -hz], [rx, hh, 0], // 오른쪽
  ];
  const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13];
  const pos = new Float32Array(P.flat());
  const uv = new Float32Array(P.flatMap(([x, y, z]) => [x * 0.9, (y + Math.abs(z)) * 0.9]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// 한옥 지붕 한 채: 처마 끝 네 귀가 살짝 들린다
function hanokRoof(p, c, hx, hz, hh, y, cx = 0, cz = 0) {
  const mat = roofMat('hanok', c, 1, 1); // 무늬 좌표가 이미 실제 길이라서 되풀이는 1
  const r = mesh(hipRoofGeo(hx, hz, hh), mat, cx, y, cz);
  r.material.side = THREE.DoubleSide;
  p.add(r);
  const dark = shadeHex(c, 0.4);
  box(p, Math.max(0.3, 2 * (hx - hz)) + 0.3, 0.22, 0.32, dark, cx, y + hh + 0.06, cz); // 용마루
  for (const s of [-1, 1]) { const e = box(p, 0.28, 0.2, 0.34, dark, cx + s * (hx - hz + 0.2), y + hh + 0.14, cz); e.rotation.z = s * 0.35; }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // 들린 귀
    const tip = mesh(new THREE.ConeGeometry(0.16, 0.7, 5), dark, cx + sx * (hx + 0.05), y + 0.18, cz + sz * (hz + 0.05));
    tip.rotation.set(sz * 1.0, 0, -sx * 1.0);
    p.add(tip);
  }
  box(p, hx * 2 + 0.1, 0.1, hz * 2 + 0.1, shadeHex(c, 0.2), cx, y - 0.03, cz); // 처마 밑
}
// 버섯 갓: 반쪽 공을 납작하게, 하얀 점
function mushroomCap(p, c, rx, rz, ry, y, cx = 0, cz = 0) {
  const cap = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), c, cx, y, cz);
  cap.scale.set(rx, ry, rz);
  p.add(cap);
  const rim = mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), shadeHex(c, 0.15), cx, y + 0.02, cz);
  rim.scale.set(rx, 1, rz);
  p.add(rim);
  const n = Math.max(6, Math.round((rx + rz) * 2.2));
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, t = 0.25 + ((i * 0.37) % 0.55); // 해바라기 씨 배열로 고르게
    const sx = Math.cos(a) * Math.sin(t * Math.PI / 2 + 0.3), sz = Math.sin(a) * Math.sin(t * Math.PI / 2 + 0.3), sy = Math.cos(t * Math.PI / 2 + 0.3);
    const d = ball(p, 0.22 + (i % 3) * 0.06, '#FFFDF7', cx + sx * rx, y + sy * ry, cz + sz * rz, 8);
    d.scale.set(1, 0.35, 1);
    d.lookAt(cx + sx * rx * 2, y + sy * ry * 2, cz + sz * rz * 2);
    d.rotateX(Math.PI / 2);
  }
}
// 성 꼭대기 성가퀴: (x0, z0)에서 (x1, z1)까지 한 줄
function merlons(p, mat, x0, z0, x1, z1, y, size = 0.34) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / (size * 2)));
  for (let i = 0; i <= n; i += 1) {
    if (i % 2) continue;
    const k = i / n;
    box(p, size, size * 1.1, size, mat, x0 + (x1 - x0) * k, y + size * 0.55, z0 + (z1 - z0) * k);
  }
}
// 성 탑 (지름 r, 높이 hh, 뾰족 지붕 색 c, 깃발)
function tower(p, x, z, r, hh, c, stone) {
  cyl(p, r, r * 1.05, hh, stone, x, hh / 2, z, 14);
  cyl(p, r + 0.08, r + 0.08, 0.14, '#9C948A', x, hh + 0.02, z, 14);
  cyl(p, 0, r + 0.18, r * 2.1, c, x, hh + r * 1.05 + 0.08, z, 14);
  cyl(p, 0.025, 0.025, 0.7, '#6B4429', x, hh + r * 2.1 + 0.4, z, 5);
  const flag = mesh(triGeo(0.32, 0.5, 0.02), '#F6D55C', x + 0.18, hh + r * 2.1 + 0.62, z);
  flag.rotation.z = -Math.PI / 2;
  p.add(flag);
  for (let i = 0; i < 3; i++) box(p, 0.12, 0.34, 0.06, '#4A4038', x + Math.sin(i * 2.1) * (r + 0.01), hh * 0.62, z + Math.cos(i * 2.1) * (r + 0.01)).rotation.y = i * 2.1;
}
// 창문 (앞을 보는 면에 붙인다)
function windowAt(p, style, x, y, z, w = 0.9, hh = 0.8) {
  if (style === 'mushroom') {
    const fr = cyl(p, 0.42, 0.42, 0.06, '#8B5E3C', x, y, z, 18); fr.rotation.x = Math.PI / 2;
    const gl = cyl(p, 0.34, 0.34, 0.07, '#BFE3F5', x, y, z + 0.01, 18); gl.rotation.x = Math.PI / 2;
    box(p, 0.05, 0.62, 0.08, '#8B5E3C', x, y, z + 0.02);
    return;
  }
  if (style === 'castle') { box(p, 0.24, 0.7, 0.06, '#3E3630', x, y, z); return; }
  const frame = style === 'hanok' ? '#8B5E3C' : style === 'log' ? '#6B4429' : '#FFFDF7';
  box(p, w + 0.14, hh + 0.14, 0.05, frame, x, y, z);
  if (style === 'hanok') box(p, w, hh, 0.06, patMat('lattice', '#FFF6E0', '#8B5E3C', 1, 1), x, y, z + 0.01);
  else { box(p, w, hh, 0.06, '#BFE3F5', x, y, z + 0.01); box(p, 0.05, hh, 0.08, frame, x, y, z + 0.02); box(p, w, 0.05, 0.08, frame, x, y, z + 0.02); }
  if (style === 'brick' || style === 'cabin') box(p, w + 0.24, 0.08, 0.16, frame, x, y - hh / 2 - 0.08, z + 0.05);
}
// 문 (앞을 보는 면에 붙인다). 반달 위는 버섯집과 성
function doorAt(p, style, x, y0, z, w = 1.0, hh = 1.7) {
  const wood = style === 'castle' ? '#5A3E2B' : style === 'brick' ? '#3F7D5B' : style === 'mushroom' ? '#B07F4E' : '#8B5E3C';
  if (style === 'hanok') {
    box(p, w + 0.16, hh + 0.12, 0.06, '#6B4429', x, y0 + hh / 2, z);
    for (const s of [-1, 1]) box(p, w / 2 - 0.04, hh - 0.04, 0.07, patMat('lattice', '#FFF6E0', '#8B5E3C', 1, 2), x + s * w / 4, y0 + hh / 2, z + 0.01);
    return;
  }
  const arch = style === 'mushroom' || style === 'castle';
  const body = arch ? hh - w / 2 : hh;
  box(p, w, body, 0.07, wood, x, y0 + body / 2, z);
  if (arch) { const top = cyl(p, w / 2, w / 2, 0.07, wood, x, y0 + body, z, 16); top.rotation.x = Math.PI / 2; }
  if (style === 'castle') for (let i = 0; i < 3; i++) box(p, w, 0.05, 0.09, '#8A8F98', x, y0 + 0.3 + i * 0.45, z + 0.01);
  ball(p, 0.06, '#F4C542', x + w * 0.3, y0 + hh * 0.5, z + 0.06, 6);
}

// ---------- 마을의 '○○의 집' 한 채 (바닥 가운데가 0, 앞이 +z, 받침 5.0 x 4.4) ----------
export function buildCottage(style, roofC) {
  const g = new THREE.Group();
  const S = HOUSE_STYLES[style] ? style : 'cabin';
  box(g, 5.0, 0.32, 4.4, '#D9C8A8', 0, 0.16, 0);
  const roofM = (rx, ry) => roofMat(S, roofC, rx, ry);
  if (S === 'mushroom') {
    cyl(g, 1.9, 2.0, 2.4, wallSkin('mushroom', 12, 2.4), 0, 1.52, 0, 24);
    mushroomCap(g, roofC, 2.75, 2.45, 1.75, 2.55);
    doorAt(g, S, -0.45, 0.32, 1.98, 1.0, 1.75);
    windowAt(g, S, 0.95, 1.65, 1.72);
    return g;
  }
  if (S === 'castle') {
    const st = wallSkin('castle', 4.2, 2.7);
    box(g, 4.2, 2.7, 3.4, st, 0, 1.67, -0.1);
    box(g, 4.3, 0.16, 3.5, '#B7AFA3', 0, 3.05, -0.1);
    merlons(g, '#C9C2B6', -2.05, 1.6, 2.05, 1.6, 3.1);
    merlons(g, '#C9C2B6', -2.05, -1.8, 2.05, -1.8, 3.1);
    merlons(g, '#C9C2B6', -2.05, -1.8, -2.05, 1.6, 3.1);
    merlons(g, '#C9C2B6', 2.05, -1.8, 2.05, 1.6, 3.1);
    for (const s of [-1, 1]) tower(g, s * 2.0, 1.55, 0.62, 3.6, roofC, st);
    doorAt(g, S, 0, 0.32, 1.62, 1.1, 1.9);
    windowAt(g, S, 0.9, 2.0, 1.62); windowAt(g, S, -0.9, 2.0, 1.62);
    return g;
  }
  const H0 = S === 'hanok' ? 0.62 : 0.32, WH = S === 'hanok' ? 2.2 : 2.5;
  if (S === 'hanok') box(g, 4.9, 0.3, 4.1, '#B9B3A8', 0, 0.47, 0); // 기단
  const wall = wallSkin(S, 4.4, WH);
  box(g, 4.4, WH, 3.8, wall, 0, H0 + WH / 2, 0);
  if (S === 'hanok') {
    for (const x of [-2.15, -0.7, 0.7, 2.15]) for (const z of [-1.85, 1.85]) box(g, 0.2, WH, 0.2, '#8B5E3C', x, H0 + WH / 2, z);
    for (const z of [-1.86, 1.86]) { box(g, 4.5, 0.2, 0.22, '#8B5E3C', 0, H0 + WH - 0.1, z); box(g, 4.5, 0.12, 0.22, '#8B5E3C', 0, H0 + 0.75, z); }
    hanokRoof(g, roofC, 3.05, 2.55, 1.35, H0 + WH);
    doorAt(g, S, -0.6, H0, 1.93, 1.1, 1.75);
    windowAt(g, S, 1.3, H0 + 1.35, 1.93, 0.8, 0.7);
    return g;
  }
  if (S === 'log') { // 모서리에 튀어나온 통나무 끝
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 7; i++) {
      const lg = cyl(g, 0.13, 0.13, 0.42, '#A8744A', sx * 2.2, H0 + 0.18 + i * 0.34, sz * 1.9 + sz * 0.05, 8);
      if (i % 2) lg.rotation.x = Math.PI / 2; else lg.rotation.z = Math.PI / 2;
    }
  }
  gableRoof(g, roofM(4, 2), 5.4, 2.0, 4.6, H0 + WH);
  const gab = mesh(triGeo(4.4, 1.62, 0.12), wallSkin(S, 4.4, 1.6), 0, H0 + WH, 1.86); g.add(gab);
  const gab2 = mesh(triGeo(4.4, 1.62, 0.12), wallSkin(S, 4.4, 1.6), 0, H0 + WH, -1.86); g.add(gab2);
  doorAt(g, S, -0.6, H0, 1.93, 1.1, 1.8);
  windowAt(g, S, 1.15, H0 + 1.3, 1.93);
  if (S !== 'log') { // 굴뚝
    const ch = S === 'brick' ? patMat('brick', '#B25F42', '#EBDCCB', 1, 2) : '#9C8F86';
    box(g, 0.5, 1.2, 0.5, ch, 1.3, H0 + WH + 1.0, -0.8);
    box(g, 0.62, 0.12, 0.62, '#6B6F7A', 1.3, H0 + WH + 1.62, -0.8);
  }
  return g;
}

// ---------- 내 집 섬의 껍데기: 지붕과 앞벽 (방마다) ----------
// list: [{ id, x0, x1 }] (내 방부터 서쪽으로), 방 앞벽 z = front, 뒤벽 z = back, 벽 높이 wh. doorX(s): 앞문 자리(없으면 null)
export function buildShell(style, roofC, list, { front = -3.8, back = -10.2, wh = 2.4, doorX = () => null } = {}) {
  const g = new THREE.Group();
  const S = HOUSE_STYLES[style] ? style : 'cabin';
  const west = list[list.length - 1], east = list[0];
  const fz = front + 0.05; // 앞벽 바깥 면
  const dep = front - back;
  list.forEach((s) => {
    const xa = s.x0 - (s === west ? 0.2 : 0), xb = s.x1 + (s === east ? 0.2 : 0), w = xb - xa, cx = (xa + xb) / 2;
    // 앞벽 (앞문 자리는 비운다)
    const c = doorX(s);
    const segs = c == null ? [[xa, xb]] : [[xa, c - 0.7], [c + 0.7, xb]];
    for (const [a, b] of segs) box(g, b - a, wh, 0.1, wallSkin(S, b - a, wh), (a + b) / 2, wh / 2, fz);
    if (c != null) {
      box(g, 1.4, wh - 1.9, 0.1, wallSkin(S, 1.4, wh - 1.9), c, 1.9 + (wh - 1.9) / 2, fz);
      const trim = S === 'castle' ? '#9C948A' : S === 'hanok' ? '#8B5E3C' : '#8B5E3C';
      for (const x of [c - 0.75, c + 0.75]) box(g, 0.12, 1.98, 0.16, trim, x, 0.99, fz + 0.02);
      box(g, 1.62, 0.14, 0.16, trim, c, 1.97, fz + 0.02);
    }
    // 창문 둘 (앞문과 겹치지 않게)
    const wins = c == null ? [xa + w * 0.28, xa + w * 0.72] : [c - 2.3, c + 2.3];
    for (const x of wins) if (x > xa + 0.6 && x < xb - 0.6) windowAt(g, S, x, 1.45, fz + 0.06);
    if (S === 'hanok') {
      for (let x = xa + 0.1; x <= xb - 0.05; x += w / 4) box(g, 0.18, wh, 0.2, '#8B5E3C', x, wh / 2, fz + 0.04);
      box(g, w + 0.1, 0.18, 0.2, '#8B5E3C', cx, wh - 0.09, fz + 0.05);
    }
    // 지붕
    if (S === 'mushroom') mushroomCap(g, roofC, w / 2 + 0.55, dep / 2 + 0.75, 1.9, wh - 0.05, cx, (front + back) / 2);
    else if (S === 'castle') {
      box(g, w + 0.05, 0.2, dep + 0.3, '#B7AFA3', cx, wh + 0.1, (front + back) / 2);
      merlons(g, '#C9C2B6', xa, fz, xb, fz, wh + 0.2);
      merlons(g, '#C9C2B6', xa, back - 0.05, xb, back - 0.05, wh + 0.2);
    } else if (S !== 'hanok') {
      gableRoof(g, roofMat(S, roofC, Math.round(w), 3), w + 0.5, 1.7, dep + 0.8, wh, (front + back) / 2, cx);
      for (const z of [fz - 0.02, back - 0.05]) g.add(mesh(triGeo(w, 1.45, 0.1), wallSkin(S, w, 1.45), cx, wh, z));
    }
  });
  const xa = west.x0 - 0.2, xb = east.x1 + 0.2;
  if (S === 'hanok') hanokRoof(g, roofC, (xb - xa) / 2 + 0.7, dep / 2 + 0.8, 1.7, wh, (xa + xb) / 2, (front + back) / 2);
  if (S === 'castle') {
    merlons(g, '#C9C2B6', xa, back, xa, fz, wh + 0.2);
    merlons(g, '#C9C2B6', xb, back, xb, fz, wh + 0.2);
    const st = wallSkin('castle', 3, 4);
    for (const x of [xa - 0.1, xb + 0.1]) tower(g, x, back + 0.1, 0.75, wh + 1.5, roofC, st); // 뒤 귀퉁이 탑 (앞마당 길을 막지 않게)
  }
  if (S === 'cabin' || S === 'brick') { // 내 방 지붕 위 굴뚝
    const ch = S === 'brick' ? patMat('brick', '#B25F42', '#EBDCCB', 1, 2) : '#9C8F86';
    box(g, 0.55, 1.6, 0.55, ch, east.x1 - 2.2, wh + 1.0, back + 1.6);
    box(g, 0.68, 0.12, 0.68, '#6B6F7A', east.x1 - 2.2, wh + 1.82, back + 1.6);
  }
  if (S === 'log') { // 집 끝 모서리 통나무
    for (const x of [xa, xb]) for (const z of [fz, back]) for (let i = 0; i < 7; i++) {
      const lg = cyl(g, 0.12, 0.12, 0.4, '#A8744A', x, 0.2 + i * 0.34, z, 8);
      if (i % 2) lg.rotation.x = Math.PI / 2; else lg.rotation.z = Math.PI / 2;
    }
  }
  return g;
}
