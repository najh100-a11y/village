// 진숲 어린이 마을 — 이웃 마을 섬 (마을 섬 남서쪽, 비스듬한 나무 다리를 건넌다)
// 마을 아이들의 집이 모두 모여 있는 작은 마을이다. 가운데 분수 마당과 '이웃 마을 안내판'이 있고,
// 둥근 골목(반지름 15.2) 양쪽으로 집터 33곳이 마주 본다: 안쪽 둘레 10곳(바깥을 본다), 바깥 둘레 23곳(안쪽을 본다).
// 다리 쪽과 그 반대쪽은 마당과 골목을 잇는 길로 비워 둔다. 집은 마을 섬 '내 집'의 0.72배 크기로, 아이가 고른 집 모양과 지붕 색으로 짓는다.
// 집 앞에는 이름표와 우체통이 있다. 집은 가입한 차례로 집터에 들어가고(NB_FILL 차례), 빈 집터는 꽃밭과 '새 친구 자리' 팻말이 있다.
// 집을 누르면 그 집에 놀러 가고, 우체통을 누르면 다녀간 인사를 남긴다 (js/app.js, js/homeui.js).
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { NBR_ISLE, makeIsle, makeTree } from './isles.js';
import { mergeStatic, mergeColored } from './merge.js';
import { buildCottage } from './houses.js';
import { lookOf, roofColor } from './houses-data.js';

const I = NBR_ISLE;
const D2R = Math.PI / 180, TAU = Math.PI * 2;
const FONT = '"Maplestory Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const NB_BRIDGE_DEG = (I.deg + 180) % 360; // 섬 가운데에서 다리 쪽 각도 (동쪽 0도, 남쪽 90도)
export const NB_PLAZA_R = 6.2;
export const NB_STREET_R = 15.2, NB_STREET_W = 2.8;
const INNER_R = 10.5, OUTER_R = 20.2;
export const NB_HOUSE_S = 0.72; // 집 크기 (마을 섬 내 집의 0.72배)
export const NB_HW = 2.0, NB_HD = 1.7; // 집 반너비·반깊이 (장애물, 지도)
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });

// 집터 하나: 둘레 위 각도, 반지름, 앞(문)이 바깥을 보는지. door 문 앞, mail 우체통, mailDoor 우체통 앞, plate 이름표
function makeLot(deg, r, out, ring) {
  const a = deg * D2R, dx = Math.cos(a), dz = Math.sin(a);
  const x = I.x + dx * r, z = I.z + dz * r;
  const fx = out ? dx : -dx, fz = out ? dz : -dz;
  const rot = Math.atan2(fx, fz);
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  return { deg, r, ring, x, z, rot, fx, fz, door: P(-0.43, 2.45), mail: P(1.55, 2.05), mailDoor: P(1.55, 2.8), plate: P(-1.55, 2.05) };
}
export const NB_LOTS = [];
for (let k = 1; k < 12; k++) if (k !== 6) NB_LOTS.push(makeLot(NB_BRIDGE_DEG + k * 30, INNER_R, true, 0));
for (let k = 1; k < 24; k++) NB_LOTS.push(makeLot(NB_BRIDGE_DEG + k * 15, OUTER_R, false, 1));
NB_LOTS.forEach((l, i) => { l.i = i; });
// 집이 들어가는 차례: 섬 둘레에 고르게 퍼지도록 (황금비로 섞는다). 가입한 차례대로 이 차례의 집터에 들어간다
export const NB_FILL = (() => {
  const key = new Map();
  for (const ring of [0, 1]) {
    const list = NB_LOTS.filter((l) => l.ring === ring);
    list.forEach((l, j) => key.set(l.i, ((j + 0.5) * 0.6180339887 + ring * 0.31) % 1));
  }
  return NB_LOTS.map((l) => l.i).sort((a, b) => key.get(a) - key.get(b));
})();
// 안내판 (분수 마당의 다리 쪽, 다리를 본다)
const BA = NB_BRIDGE_DEG * D2R;
export const NB_BOARD = { x: I.x + Math.cos(BA) * 4.2, z: I.z + Math.sin(BA) * 4.2, rot: Math.atan2(Math.cos(BA), Math.sin(BA)) };
// 길 그물에 쓸 점들 (마당 둘레, 골목, 들어오는 길, 집 앞)
export function nbRoadPoints() {
  const out = [];
  const at = (deg, r) => [I.x + Math.cos(deg * D2R) * r, I.z + Math.sin(deg * D2R) * r];
  for (let k = 0; k < 10; k++) out.push(at(NB_BRIDGE_DEG + k * 36, 7.4));
  for (let k = 0; k < 32; k++) out.push(at(NB_BRIDGE_DEG + k * 11.25, NB_STREET_R));
  for (const r of [19, 22.5]) out.push(at(NB_BRIDGE_DEG, r));
  for (const r of [9, 12]) { out.push(at(NB_BRIDGE_DEG, r)); out.push(at(NB_BRIDGE_DEG + 180, r)); }
  for (const l of NB_LOTS) { out.push([l.door.x, l.door.z]); out.push([l.mailDoor.x, l.mailDoor.z]); }
  return out;
}

function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (g, w, h, d, c, x, y, z) => { const o = mk(new THREE.BoxGeometry(w, h, d), c, x, y, z); g.add(o); return o; };
const cyl = (g, rt, rb, h, c, x, y, z, n = 12) => { const o = mk(new THREE.CylinderGeometry(rt, rb, h, n), c, x, y, z); g.add(o); return o; };
const ball = (g, r, c, x, y, z) => { const o = mk(new THREE.SphereGeometry(r, 12, 10), c, x, y, z); g.add(o); return o; };

// 이름표 그림 한 장에 여러 이름을 모아 그린다 (칸 256×72, 4줄 14칸 = 56칸). 0번 칸은 '새 친구 자리'
const CW = 256, CH = 72, AT = 1024, COLS = AT / CW;
function drawCell(ctx, i, text, { bg = '#FFFDF7', fg = '#6B4429', border = '#8B5E3C' } = {}) {
  const x0 = (i % COLS) * CW, y0 = Math.floor(i / COLS) * CH;
  ctx.clearRect(x0, y0, CW, CH);
  ctx.fillStyle = border;
  ctx.beginPath(); ctx.roundRect(x0 + 2, y0 + 2, CW - 4, CH - 4, 17); ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(x0 + 7, y0 + 7, CW - 14, CH - 14, 13); ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 33;
  ctx.font = `${size}px ${FONT}`;
  while (ctx.measureText(text).width > CW - 30 && size > 16) { size -= 1; ctx.font = `${size}px ${FONT}`; }
  ctx.fillText(text, x0 + CW / 2, y0 + CH / 2 + 2);
}
function cellGeo(i, w, h) {
  const geo = new THREE.PlaneGeometry(w, h);
  const u0 = ((i % COLS) * CW) / AT, v1 = 1 - (Math.floor(i / COLS) * CH) / AT, du = CW / AT, dv = CH / AT;
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * du, v1 - dv + uv.getY(k) * dv);
  return geo;
}

export function buildNbrIsle(v, { signMesh } = {}) {
  const scene = v.scene;
  const A = (deg) => deg * D2R;
  makeIsle(scene, I, {
    layer: 5,
    draw: (ctx, px, u) => {
      const P = (deg, r) => [px(Math.cos(A(deg)) * r), px(Math.sin(A(deg)) * r)];
      // 집터 마당 (밝은 풀)
      ctx.fillStyle = '#A3D27A';
      for (const l of NB_LOTS) {
        ctx.save();
        ctx.translate(px(l.x - I.x), px(l.z - I.z));
        ctx.rotate(-l.rot);
        ctx.beginPath(); ctx.roundRect(-2.55 * u, -2.2 * u, 5.1 * u, 4.9 * u, 0.6 * u); ctx.fill();
        ctx.restore();
      }
      // 길: 둥근 골목, 분수 마당, 다리에서 들어오는 길, 마당과 골목을 잇는 길 둘, 집마다 문 앞 길
      ctx.lineCap = 'round';
      const road = (w, c) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w * u;
        ctx.beginPath(); ctx.arc(px(0), px(0), NB_STREET_R * u, 0, TAU); ctx.stroke();
        for (const [d, r0, r1] of [[NB_BRIDGE_DEG, NB_STREET_R, I.r + 1], [NB_BRIDGE_DEG, NB_PLAZA_R, NB_STREET_R], [NB_BRIDGE_DEG + 180, NB_PLAZA_R, NB_STREET_R]]) {
          ctx.beginPath(); ctx.moveTo(...P(d, r0)); ctx.lineTo(...P(d, r1)); ctx.stroke();
        }
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px(0), px(0), (NB_PLAZA_R + (w - NB_STREET_W) / 2) * u, 0, TAU); ctx.fill();
      };
      road(NB_STREET_W + 0.5, '#CDB27C');
      road(NB_STREET_W, '#EAD7A8');
      ctx.strokeStyle = '#E2CC98';
      ctx.lineWidth = 0.9 * u;
      for (const l of NB_LOTS) {
        const sx = l.door.x - I.x, sz = l.door.z - I.z, e = l.ring === 0 ? 1.2 : 1.5;
        ctx.beginPath(); ctx.moveTo(px(sx - l.fx * 0.9), px(sz - l.fz * 0.9)); ctx.lineTo(px(sx + l.fx * e), px(sz + l.fz * e)); ctx.stroke();
      }
      // 분수 마당 무늬
      ctx.strokeStyle = 'rgba(190,160,110,.6)';
      ctx.lineWidth = 0.14 * u;
      for (const rr of [2.6, 4.6]) { ctx.beginPath(); ctx.arc(px(0), px(0), rr * u, 0, TAU); ctx.stroke(); }
      // 꽃 점
      let s = 5;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 360; i++) {
        const a = rnd() * TAU, r = 6.5 + rnd() * 17;
        if (Math.abs(r - NB_STREET_R) < 1.8) continue;
        ctx.fillStyle = ['#F7A1C4', '#FFFFFF', '#FFE08A', '#B9A3F0'][i % 4];
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px(Math.cos(a) * r), px(Math.sin(a) * r), 0.09 * u, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  });
  // ---------- 움직이지 않는 것: 분수, 안내판, 등불, 나무, 섬 들어오는 곳 표지판 ----------
  const deco = new THREE.Group();
  {
    const f = new THREE.Group();
    cyl(f, 1.45, 1.55, 0.5, '#C9C2B6', 0, 0.25, 0, 28);
    const water = mk(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 28), '#7EC8F2', 0, 0.48, 0); f.add(water);
    cyl(f, 0.22, 0.3, 1.2, '#C9C2B6', 0, 0.9, 0, 12);
    cyl(f, 0.6, 0.3, 0.22, '#C9C2B6', 0, 1.55, 0, 18);
    cyl(f, 0.5, 0.5, 0.05, '#9FD8F2', 0, 1.67, 0, 18);
    ball(f, 0.16, '#BFE8F8', 0, 1.82, 0);
    f.position.set(I.x, 0, I.z);
    deco.add(f);
    v.addObstacleCircle(I.x, I.z, 1.55, true);
  }
  // 안내판: 기둥 둘과 넓은 판 (판 그림은 signMesh)
  const board = new THREE.Group();
  for (const sx of [-1.25, 1.25]) cyl(board, 0.08, 0.1, 1.9, '#8B5E3C', sx, 0.95, 0, 8);
  if (signMesh) {
    const sg = signMesh('이웃 마을', 2.7, { bg: '#FFFDF7', fg: '#3F7A4A', border: '#5DB760', sub: '친구 집 찾기 · 눌러 보세요' });
    sg.position.set(0, 1.6, 0.06);
    board.add(sg);
  }
  board.position.set(NB_BOARD.x, 0, NB_BOARD.z);
  board.rotation.y = NB_BOARD.rot;
  board.userData.pick = { type: 'building', id: 'nb_board' };
  scene.add(board);
  mergeStatic(board);
  v.pickRoots.push(board);
  v.addObstacleBox(NB_BOARD.x, NB_BOARD.z, 1.4, 0.15, NB_BOARD.rot);
  v.doors.push({ id: 'nb_board', name: '이웃 마을 안내판', pos: new THREE.Vector3(NB_BOARD.x + Math.cos(BA) * 1.1, 0, NB_BOARD.z + Math.sin(BA) * 1.1), group: board });
  // 섬 들어오는 곳 표지판 (다리 끝, 길 오른쪽)
  if (signMesh) {
    const en = new THREE.Group();
    en.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), '#8B5E3C', -1.3, 0.95, 0));
    en.add(mk(new THREE.BoxGeometry(0.12, 1.9, 0.12), '#8B5E3C', 1.3, 0.95, 0));
    const es = signMesh('이웃 마을', 2.7, { bg: '#5DB760', fg: '#FFFDF7', border: '#3F7A4A' });
    es.position.set(0, 1.95, 0);
    en.add(es);
    const r = I.walk - 1.2;
    en.position.set(I.x + Math.cos(BA) * r, 0, I.z + Math.sin(BA) * r);
    en.rotation.y = Math.atan2(Math.cos(BA), Math.sin(BA));
    mergeStatic(en);
    scene.add(en);
    const c = Math.cos(en.rotation.y), s = Math.sin(en.rotation.y);
    for (const lx of [-1.3, 1.3]) v.addObstacleCircle(en.position.x + lx * c, en.position.z - lx * s, 0.12);
  }
  // 등불: 골목 바깥 가장자리, 바깥 둘레 집 사이마다 하나 건너
  const lamps = new THREE.Group();
  for (let k = 0; k < 24; k += 2) {
    const d = NB_BRIDGE_DEG + 7.5 + k * 15;
    const r = NB_STREET_R + NB_STREET_W / 2 + 0.35, x = I.x + Math.cos(A(d)) * r, z = I.z + Math.sin(A(d)) * r;
    const lamp = new THREE.Group();
    lamp.add(mk(new THREE.CylinderGeometry(0.06, 0.08, 2.1, 8), '#3B3B42', 0, 1.05, 0));
    lamp.add(mk(new THREE.SphereGeometry(0.2, 12, 10), v.glow('#FFF4CF'), 0, 2.2, 0));
    lamp.position.set(x, 0, z);
    lamps.add(lamp);
    v.addObstacleCircle(x, z, 0.12);
  }
  mergeStatic(lamps);
  scene.add(lamps);
  // 나무: 바깥 둘레 집 뒤 사이사이, 분수 마당 둘레 덤불
  const trees = new THREE.Group();
  for (let k = 0; k < 24; k++) {
    const d = NB_BRIDGE_DEG + 7.5 + k * 15;
    if (k === 0 || k === 23) continue; // 들어오는 길 양옆은 비운다
    const r = 22.6, x = I.x + Math.cos(A(d)) * r, z = I.z + Math.sin(A(d)) * r;
    const t = k % 3 === 0 ? makeTree('palm', 0.85) : makeTree('round', 0.8 + (k % 4) * 0.08);
    t.position.set(x, 0, z);
    t.rotation.y = k * 1.7;
    trees.add(t);
    v.addObstacleCircle(x, z, 0.38);
  }
  for (let k = 0; k < 12; k++) {
    const d = NB_BRIDGE_DEG + 15 + k * 30; // 안쪽 둘레 집 사이 (길 양옆 덤불도 길에서 2m쯤 떨어진다)
    const r = 8.0, x = I.x + Math.cos(A(d)) * r, z = I.z + Math.sin(A(d)) * r;
    const b = new THREE.Group();
    ball(b, 0.55, k % 2 ? '#5FAE4E' : '#6DBE5A', 0, 0.35, 0);
    ball(b, 0.4, k % 2 ? '#6DBE5A' : '#57A148', 0.45, 0.28, 0.1);
    if (k % 3 === 0) for (let q = 0; q < 4; q++) ball(b, 0.09, '#F6A2C4', Math.cos(q * 1.6) * 0.45, 0.55, Math.sin(q * 1.6) * 0.4);
    b.position.set(x, 0, z);
    trees.add(b);
    v.addObstacleCircle(x, z, 0.6);
  }
  mergeStatic(trees);
  scene.add(trees);
  mergeColored(deco, VC);
  mergeStatic(deco);
  scene.add(deco);
  // ---------- 집터마다: 장애물, 누를 자리(집, 우체통), 문 ----------
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const doorOf = [], mailOf = [];
  for (const l of NB_LOTS) {
    v.addObstacleBox(l.x, l.z, NB_HW, NB_HD, l.rot);
    v.addObstacleCircle(l.mail.x, l.mail.z, 0.2);
    v.addObstacleCircle(l.plate.x, l.plate.z, 0.12);
    const hp = new THREE.Mesh(new THREE.BoxGeometry(NB_HW * 2, 3.4, NB_HD * 2), pickMat);
    hp.position.set(l.x, 1.7, l.z);
    hp.rotation.y = l.rot;
    hp.userData.pick = { type: 'building', id: `nb_${l.i}` };
    const mp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.7), pickMat);
    mp.position.set(l.mail.x, 0.65, l.mail.z);
    mp.rotation.y = l.rot;
    mp.userData.pick = { type: 'building', id: `nbm_${l.i}` };
    scene.add(hp, mp);
    v.pickRoots.push(hp, mp);
    const d = { id: `nb_${l.i}`, name: '새 친구의 집 자리', pos: new THREE.Vector3(l.door.x, 0, l.door.z), group: hp };
    const m = { id: `nbm_${l.i}`, name: '우체통', pos: new THREE.Vector3(l.mailDoor.x, 0, l.mailDoor.z), group: mp };
    v.doors.push(d, m);
    doorOf.push(d);
    mailOf.push(m);
  }

  // ---------- 집 (서버에서 받은 목록으로 짓고, 바뀌면 다시 짓는다) ----------
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = AT;
  const actx = atlas.getContext('2d');
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  const plateMat = new THREE.MeshToonMaterial({ map: atlasTex, gradientMap: toonGradient() });
  let root = null, sig = '';
  const owners = new Array(NB_LOTS.length).fill(null); // 집터 → { id, name, t, look, roof }
  const lotOfId = new Map();

  function mailbox(g) {
    cyl(g, 0.05, 0.06, 0.95, '#7A5233', 0, 0.48, 0, 8);
    box(g, 0.42, 0.32, 0.55, '#E5675C', 0, 1.08, 0);
    cyl(g, 0.21, 0.21, 0.55, '#E5675C', 0, 1.24, 0, 14).rotation.x = Math.PI / 2;
    box(g, 0.04, 0.22, 0.06, '#F6D55C', 0.24, 1.22, -0.12);
    box(g, 0.3, 0.05, 0.02, '#3B3B42', 0, 1.14, 0.29);
  }
  function plate(g, cell) {
    cyl(g, 0.05, 0.06, 1.15, '#8B5E3C', 0, 0.58, 0, 8);
    box(g, 1.62, 0.5, 0.06, '#8B5E3C', 0, 1.3, 0);
    const p = new THREE.Mesh(cellGeo(cell, 1.54, 1.54 * (CH / CW)), plateMat);
    p.position.set(0, 1.3, 0.035);
    g.add(p);
  }
  function flowerbed(g) {
    box(g, 3.4, 0.22, 2.6, '#8D6E4E', 0, 0.11, 0);
    box(g, 3.2, 0.06, 2.4, '#6E5038', 0, 0.23, 0);
    const cols = ['#EF6461', '#F6D55C', '#F6A2C4', '#FFFDF7', '#A07FE3'];
    for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 3; iz++) {
      const x = -1.25 + ix * 0.62, z = -0.75 + iz * 0.75;
      cyl(g, 0.02, 0.02, 0.3, '#4E9A45', x, 0.4, z, 5);
      ball(g, 0.11, cols[(ix + iz * 2) % cols.length], x, 0.58, z);
    }
  }

  // list: [{ id, name, avatar, look, t }] (가입한 차례). auto(avatar): 지붕 '옷 색깔'일 때 쓸 색
  function setHouses(list, auto) {
    const rows = (list || []).slice(0, NB_FILL.length).map((p) => {
      const look = lookOf(p.look);
      return { id: p.id, name: p.name || '친구', t: !!p.t, look, roof: roofColor(look, p.avatar ? auto(p.avatar) : null) };
    });
    const nsig = JSON.stringify(rows.map((r) => [r.id, r.name, r.look.s, r.roof]));
    owners.fill(null);
    lotOfId.clear();
    rows.forEach((r, k) => { owners[NB_FILL[k]] = r; lotOfId.set(r.id, NB_FILL[k]); });
    for (const l of NB_LOTS) {
      const o = owners[l.i];
      doorOf[l.i].name = o ? `${o.name}의 집` : '새 친구의 집 자리';
      mailOf[l.i].name = o ? `${o.name}의 우체통` : '새 친구의 집 자리';
    }
    if (nsig === sig) return;
    sig = nsig;
    if (root) {
      root.removeFromParent();
      root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    root = new THREE.Group();
    drawCell(actx, 0, '새 친구 자리', { bg: '#F3FAEE', fg: '#3F7A4A', border: '#8CC981' });
    rows.forEach((r, k) => drawCell(actx, k + 1, `${r.name}의 집`, r.t ? { bg: '#FFF6E0', fg: '#8B4A2E', border: '#EC7A5C' } : undefined));
    atlasTex.needsUpdate = true;
    for (const l of NB_LOTS) {
      const o = owners[l.i];
      const g = new THREE.Group();
      if (o) {
        const house = buildCottage(o.look.s, o.roof);
        house.scale.setScalar(NB_HOUSE_S);
        g.add(house);
        const mb = new THREE.Group(); mailbox(mb); mb.position.set(1.55, 0, 2.05); g.add(mb);
        const pl = new THREE.Group(); plate(pl, rows.indexOf(o) + 1); pl.position.set(-1.55, 0, 2.05); g.add(pl);
      } else {
        flowerbed(g);
        const pl = new THREE.Group(); plate(pl, 0); pl.position.set(-1.55, 0, 2.05); g.add(pl);
      }
      g.position.set(l.x, 0, l.z);
      g.rotation.y = l.rot;
      root.add(g);
    }
    mergeStatic(root);
    scene.add(root);
  }
  return {
    setHouses,
    ownerOf: (i) => owners[i] || null,
    lotOf: (id) => (lotOfId.has(id) ? lotOfId.get(id) : -1),
    lot: (i) => NB_LOTS[i] || null,
  };
}
