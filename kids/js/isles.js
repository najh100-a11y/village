// 진숲 어린이 마을 — 섬과 다리
// 큰 마을 섬 남쪽에 놀이동산 섬, 동쪽에 수영장 섬이 있고 나무 다리로 이어진다.
// 걸을 수 있는 곳은 섬 셋과 다리 둘을 합친 곳이다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic } from './merge.js';

export const MAIN_WALK = 30.2; // 마을 섬에서 걸을 수 있는 반지름
export const PARK_ISLE = { x: 0, z: 62.5, r: 20.5, walk: 18.9, seed: 3 }; // 범퍼카 장이 넓어서 섬도 넉넉하게
export const POOL_ISLE = { x: 56, z: -4, r: 13.5, walk: 12.0, seed: 7 };
// 다리 (걷는 곳은 x0~x1, z0~z1 네모)
export const BRIDGES = [
  { id: 'park', x0: -1.1, x1: 1.1, z0: 29.0, z1: 44.2, deck: [32.2, 42.8], along: 'z' },
  { id: 'pool', x0: 29.0, x1: 44.6, z0: -5.1, z1: -2.9, deck: [33.4, 43.3], along: 'x' },
];
// 지도 전체를 볼 때 바라보는 가운데와 반 너비 (섬 셋과 둘레 얕은 물까지)
export const WORLD_CENTER = { x: 19, z: 27 };
export const WORLD_HALF = { w: 53, h: 61 };

// 섬과 다리를 한 줄로 놓으면: 놀이동산 섬 - 다리 - 마을 섬 - 다리 - 수영장 섬
// 서로 다른 곳으로 갈 때는 다리 끝을 거쳐 간다.
const CHAIN = ['park', 'b-park', 'main', 'b-pool', 'pool'];
const LINKS = [{ x: 0, z: 43.8 }, { x: 0, z: 29.6 }, { x: 29.6, z: -4 }, { x: 44.4, z: -4 }];
export function regionOf(x, z) {
  if (Math.hypot(x - PARK_ISLE.x, z - PARK_ISLE.z) <= PARK_ISLE.walk + 0.3) return 'park';
  if (Math.hypot(x - POOL_ISLE.x, z - POOL_ISLE.z) <= POOL_ISLE.walk + 0.3) return 'pool';
  if (Math.hypot(x, z) <= MAIN_WALK + 0.3) return 'main';
  for (const b of BRIDGES) if (x >= b.x0 - 0.3 && x <= b.x1 + 0.3 && z >= b.z0 - 0.3 && z <= b.z1 + 0.3) return 'b-' + b.id;
  return 'main';
}
// (fx, fz)에서 (tx, tz)로 갈 때 거쳐 갈 다리 끝들 (같은 곳이면 빈 목록)
export function route(fx, fz, tx, tz) {
  const i = CHAIN.indexOf(regionOf(fx, fz)), j = CHAIN.indexOf(regionOf(tx, tz));
  const out = [];
  if (i < j) for (let k = i; k < j; k++) out.push(LINKS[k]);
  else for (let k = i - 1; k >= j; k--) out.push(LINKS[k]);
  return out;
}

// p(x, z)를 걸을 수 있는 가장 가까운 곳으로 옮긴다
export function clampWalk(p) {
  const circles = [{ x: 0, z: 0, r: MAIN_WALK }, { x: PARK_ISLE.x, z: PARK_ISLE.z, r: PARK_ISLE.walk }, { x: POOL_ISLE.x, z: POOL_ISLE.z, r: POOL_ISLE.walk }];
  for (const c of circles) if (Math.hypot(p.x - c.x, p.z - c.z) <= c.r) return p;
  for (const b of BRIDGES) if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return p;
  let bx = p.x, bz = p.z, bd = Infinity;
  for (const c of circles) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
    const qx = c.x + (dx / d) * c.r, qz = c.z + (dz / d) * c.r;
    const e = Math.hypot(p.x - qx, p.z - qz);
    if (e < bd) { bd = e; bx = qx; bz = qz; }
  }
  for (const b of BRIDGES) {
    const qx = Math.max(b.x0, Math.min(b.x1, p.x)), qz = Math.max(b.z0, Math.min(b.z1, p.z));
    const e = Math.hypot(p.x - qx, p.z - qz);
    if (e < bd) { bd = e; bx = qx; bz = qz; }
  }
  p.x = bx;
  p.z = bz;
  return p;
}

function canvasTex(S, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// 작은 섬 하나: 땅(그림), 모래, 얕은 물, 물거품. draw(ctx, px, u)로 땅 그림을 그린다 (px: 섬 기준 좌표 → 그림 좌표, u: 1만큼의 그림 크기)
export function makeIsle(scene, isle, { ground = '#8DCC5F', draw, layer = 1 } = {}) {
  const S = 1024, SPAN = isle.r * 2 + 6;
  const px = (v) => ((v + SPAN / 2) / SPAN) * S;
  const u = S / SPAN;
  const r = rng(isle.seed * 31 + 5);
  const tex = canvasTex(S, (ctx) => {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, S, S);
    const tones = ground === '#8DCC5F' ? ['#97D468', '#83C457', '#9BD971', '#7CBD52'] : ['#F2D9A2', '#E6C584', '#F5E1B4', '#DFBE7B'];
    for (let i = 0; i < 500; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = tones[i % 4];
      ctx.beginPath();
      ctx.ellipse(r() * S, r() * S, 6 + r() * 22, 5 + r() * 14, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (draw) draw(ctx, px, u);
  });
  tex.repeat.set(1 / SPAN, 1 / SPAN);
  tex.offset.set(0.5, 0.5);
  const shape = new THREE.Shape();
  const ph = isle.seed;
  const rad = (a) => isle.r + 0.6 * Math.sin(3 * a + ph) + 0.35 * Math.sin(7 * a + ph * 2);
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const rr = rad(a);
    i ? shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 3, curveSegments: 4 });
  const top = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const land = new THREE.Mesh(geo, [top, toon('#B88A5C')]);
  land.rotation.x = -Math.PI / 2;
  land.position.set(isle.x, -0.9 - 0.25, isle.z);
  land.receiveShadow = true;
  scene.add(land);
  // 모래, 얕은 물, 물거품 (섬마다 높이를 조금씩 달리해 겹쳐도 깜빡이지 않게)
  const dy = layer * 0.004;
  const sand = new THREE.Mesh(new THREE.CircleGeometry(isle.r + 4.5, 64), toon('#F3E2B4'));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(isle.x, -0.95 - dy, isle.z);
  sand.receiveShadow = true;
  scene.add(sand);
  const shallow = new THREE.Mesh(new THREE.RingGeometry(isle.r + 4.2, isle.r + 10, 64), toon('#8FDDF0', { transparent: true, opacity: 0.85 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(isle.x, -1.1 - dy, isle.z);
  scene.add(shallow);
  const foam = new THREE.Mesh(new THREE.RingGeometry(isle.r + 4.6, isle.r + 5.2, 64), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(isle.x, -1.0 - dy, isle.z);
  scene.add(foam);
  return { land, foam, tex };
}

// 나무 다리 (난간과 기둥)
export function makeBridge(scene, b) {
  const g = new THREE.Group();
  const wood = toon('#B07F4E'), dark = toon('#7A5233'), light = toon('#C99862');
  const [d0, d1] = b.deck;
  const len = d1 - d0, mid = (d0 + d1) / 2;
  const W = 2.6;
  const along = (a, c, y, w, h, dep, mat) => {
    const o = b.along === 'z'
      ? new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat)
      : new THREE.Mesh(new THREE.BoxGeometry(dep, h, w), mat);
    if (b.along === 'z') o.position.set(c, y, a); else o.position.set(a, y, c);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
  };
  const cx = b.along === 'z' ? (b.x0 + b.x1) / 2 : (b.z0 + b.z1) / 2;
  along(mid, cx, -0.12, W, 0.22, len, dark);
  const n = Math.round(len / 0.55);
  for (let i = 0; i < n; i++) along(d0 + (i + 0.5) * (len / n), cx, 0.0, W - 0.1, 0.06, len / n - 0.07, i % 2 ? wood : light);
  for (const s of [-1, 1]) {
    along(mid, cx + s * (W / 2 - 0.05), 0.85, 0.09, 0.09, len, wood);
    along(mid, cx + s * (W / 2 - 0.05), 0.45, 0.06, 0.06, len, wood);
    for (let i = 0; i <= Math.round(len / 1.6); i++) {
      const a = d0 + (i / Math.round(len / 1.6)) * len;
      along(a, cx + s * (W / 2 - 0.05), 0.42, 0.12, 0.9, 0.12, dark);
      along(a, cx + s * (W / 2 - 0.05), -0.75, 0.16, 1.1, 0.16, dark);
    }
  }
  mergeStatic(g);
  scene.add(g);
  return g;
}

// 섬 위 나무 한 그루 (놀이동산 섬, 수영장 섬 꾸미기)
export function makeTree(kind = 'round', s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.5, 8), toon('#8A5A3B'));
  trunk.position.y = 0.75;
  trunk.castShadow = true;
  if (kind === 'palm') {
    // 야자나무: 휘어진 줄기와 잎
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.19 - i * 0.012, 0.75, 8), toon(i % 2 ? '#A0764E' : '#8A6440'));
      seg.position.set(i * i * 0.025, 0.37 + i * 0.7, 0);
      seg.rotation.z = -i * 0.05;
      seg.castShadow = true;
      g.add(seg);
    }
    const top = new THREE.Vector3(0.42, 3.6, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), toon(k % 2 ? '#4FA64A' : '#5DB760'));
      leaf.scale.set(1.15, 0.08, 0.32);
      leaf.position.set(top.x + Math.cos(a) * 0.9, top.y - 0.25, top.z + Math.sin(a) * 0.9);
      leaf.rotation.y = -a;
      leaf.rotation.z = -0.35;
      leaf.castShadow = true;
      g.add(leaf);
    }
    for (let k = 0; k < 3; k++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon('#7A5233'));
      nut.position.set(top.x + Math.cos(k * 2.1) * 0.2, top.y - 0.3, Math.sin(k * 2.1) * 0.2);
      g.add(nut);
    }
  } else {
    g.add(trunk);
    const lm = toon(['#5FAE4E', '#6DBE5A', '#7ACB66'][Math.floor(s * 10) % 3]);
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), lm);
    c1.position.y = 2.35;
    c1.scale.set(1, 0.9, 1);
    c1.castShadow = true;
    g.add(c1);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), lm);
    c2.position.set(0.55, 2.9, 0.2);
    c2.castShadow = true;
    g.add(c2);
  }
  g.scale.setScalar(s);
  mergeStatic(g);
  return g;
}
