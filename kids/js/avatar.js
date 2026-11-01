// 진숲 어린이 마을 — 3D 아바타 만들기
import * as THREE from './three.module.min.js';
import { PALETTE, normalizeAvatar, drawFace, colorOf, shade, isLight, FACE_TEX } from './face.js';
import { mergeStatic } from './merge.js';

const R = 0.6;
const HS = new THREE.Vector3(1, 0.94, 0.96);
const FRONT = Math.PI / 2;
const BACK = Math.PI * 1.5;
export const HEAD_Y = 1.42;

let gradTex = null;
export function toonGradient() {
  if (!gradTex) {
    gradTex = new THREE.DataTexture(new Uint8Array([120, 175, 220, 255]), 4, 1, THREE.RedFormat);
    gradTex.minFilter = THREE.NearestFilter;
    gradTex.magFilter = THREE.NearestFilter;
    gradTex.generateMipmaps = false;
    gradTex.needsUpdate = true;
  }
  return gradTex;
}

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + '|' + (opts.side || 0) + '|' + (opts.emissive || '') + '|' + (opts.transparent ? opts.opacity : '');
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  matCache.set(key, m);
  return m;
}

function sph(r, ws = 24, hs = 16, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) {
  return new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
}
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function onHead(a, theta, k) {
  return new THREE.Vector3(
    R * k * Math.sin(a) * Math.sin(theta) * HS.x,
    R * k * Math.cos(theta) * HS.y,
    R * k * Math.cos(a) * Math.sin(theta) * HS.z,
  );
}

// ---------- 머리카락 ----------
function buildHair(style, color) {
  const g = new THREE.Group();
  const top = [];
  const m = toon(color, { side: THREE.DoubleSide });
  const tieMat = toon('#EF6461');
  const add = (o, isTop = false) => { g.add(o); if (isTop) top.push(o); return o; };
  const piece = (k, ts, tl, ps = 0, pl = Math.PI * 2) => {
    const o = mesh(sph(R * k, 40, 24, ps, pl, ts, tl), m);
    o.scale.copy(HS);
    return add(o);
  };
  const capAll = (k, tl) => piece(k, 0, tl);
  const sides = (k, tl, gap) => piece(k, 0, tl, FRONT + gap, Math.PI * 2 - 2 * gap);
  const back = (k, tl, half) => piece(k, 0, tl, BACK - half, half * 2);
  const fringe = (k, t0, t1, half, offset = 0) => piece(k, t0, t1 - t0, FRONT - half + offset, half * 2);
  const blob = (rx, ry, rz, pos, rot = [0, 0, 0], isTop = false, mat = m) => {
    const o = mesh(sph(1, 20, 14), mat);
    o.position.copy(pos);
    o.scale.set(rx, ry, rz);
    o.rotation.set(rot[0], rot[1], rot[2]);
    return add(o, isTop);
  };
  const tuft = (a, th, rx, ry, rz, tilt = 0) => {
    const p = onHead(a, th, 1.05);
    return blob(rx, ry, rz, p, [-(Math.PI / 2 - th) * 0.9, a, tilt]);
  };
  const base = (gap = 0.95) => { capAll(1.07, 1.16); sides(1.07, 1.55, gap); back(1.07, 2.0, 1.2); };
  const blunt = () => fringe(1.085, 0.5, 1.32, 0.98);

  switch (style) {
    case 'buzz':
      capAll(1.025, 1.2); sides(1.025, 1.5, 0.95); back(1.025, 1.95, 1.2);
      break;
    case 'side':
      base(0.9);
      tuft(-0.28, 1.04, 0.38, 0.15, 0.2, 0.38);
      tuft(0.42, 1.1, 0.17, 0.1, 0.13, -0.3);
      break;
    case 'spiky': {
      base();
      const pts = [[-0.55, 0.98], [0, 0.9], [0.55, 0.98], [-1.25, 0.85], [1.25, 0.85], [-0.3, 0.45], [0.35, 0.48],
        [2.3, 0.62], [-2.3, 0.62], [3.14, 0.72], [0, 0.06], [1.9, 1.1], [-1.9, 1.1]];
      const cone = new THREE.ConeGeometry(0.13, 0.36, 10);
      for (const [a, th] of pts) {
        const p = onHead(a, th, 1.0);
        const o = mesh(cone, m);
        o.position.copy(p);
        o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
        o.position.addScaledVector(p.clone().normalize(), 0.12);
        add(o, th < 0.95);
      }
      break;
    }
    case 'curly': {
      capAll(1.06, 1.22); sides(1.06, 1.55, 0.95); back(1.06, 1.95, 1.2);
      const rings = [[0.12, 1], [0.45, 7], [0.78, 11], [1.08, 13], [1.45, 12], [1.8, 9]];
      const bump = sph(1, 14, 10);
      for (const [th, n] of rings) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + th;
          const wrapped = Math.atan2(Math.sin(a), Math.cos(a));
          if (th > 1.0 && Math.abs(wrapped) < 0.95) continue;
          const o = mesh(bump, m);
          o.position.copy(onHead(wrapped, th, 1.07));
          o.scale.setScalar(th > 1.4 ? 0.13 : 0.15);
          add(o, th < 0.9);
        }
      }
      for (const a of [-0.62, -0.21, 0.21, 0.62]) {
        const o = mesh(bump, m);
        o.position.copy(onHead(a, 1.14, 1.06));
        o.scale.setScalar(0.11);
        add(o);
      }
      break;
    }
    case 'bob':
      capAll(1.1, 1.05); sides(1.12, 2.15, 0.78); blunt();
      break;
    case 'long':
      capAll(1.1, 1.05); sides(1.12, 2.15, 0.78); blunt();
      blob(0.6, 0.56, 0.26, new THREE.Vector3(0, -0.52, -0.34));
      blob(0.14, 0.34, 0.13, new THREE.Vector3(-0.5, -0.44, 0.12), [0, 0, -0.1]);
      blob(0.14, 0.34, 0.13, new THREE.Vector3(0.5, -0.44, 0.12), [0, 0, 0.1]);
      break;
    case 'pigtails':
      base(); blunt();
      for (const s of [-1, 1]) {
        blob(0.24, 0.3, 0.24, new THREE.Vector3(s * 0.74, -0.1, -0.12));
        blob(0.075, 0.075, 0.075, new THREE.Vector3(s * 0.6, 0.0, -0.1), [0, 0, 0], false, tieMat);
      }
      break;
    case 'ponytail':
      base(0.9);
      tuft(-0.3, 1.05, 0.36, 0.15, 0.2, 0.38);
      tuft(0.4, 1.1, 0.17, 0.1, 0.13, -0.3);
      blob(0.2, 0.42, 0.22, new THREE.Vector3(0, -0.14, -0.74), [0.45, 0, 0]);
      blob(0.09, 0.09, 0.09, new THREE.Vector3(0, 0.17, -0.62), [0, 0, 0], false, tieMat);
      break;
    case 'bun': {
      base(); blunt();
      blob(0.27, 0.25, 0.27, new THREE.Vector3(0, 0.7, -0.14), [0, 0, 0], true);
      const ring = mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 20), tieMat, 0, 0.52, -0.12);
      ring.rotation.x = Math.PI / 2 - 0.2;
      add(ring, true);
      break;
    }
    case 'braids':
      capAll(1.07, 1.16); sides(1.07, 1.6, 0.95); back(1.07, 2.0, 1.2);
      fringe(1.085, 0.5, 1.3, 0.46, -0.52);
      fringe(1.085, 0.5, 1.3, 0.46, 0.52);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const r = 0.12 - i * 0.005;
          blob(r, r * 1.1, r, new THREE.Vector3(s * (0.54 - i * 0.02), -0.22 - i * 0.14, 0.06 + i * 0.03));
        }
        blob(0.06, 0.06, 0.06, new THREE.Vector3(s * 0.45, -0.9, 0.19), [0, 0, 0], false, tieMat);
      }
      break;
    default: // short
      base();
      tuft(-0.45, 1.1, 0.2, 0.13, 0.13, 0.3);
      tuft(-0.08, 1.08, 0.22, 0.14, 0.13, 0.05);
      tuft(0.3, 1.1, 0.18, 0.12, 0.12, -0.3);
  }
  return { group: g, top };
}

// ---------- 모자 ----------
function buildHat(style, color) {
  const g = new THREE.Group();
  let covers = false;
  const m = toon(color);
  const dark = toon(shade(color, 0.18));
  const white = toon('#FFFDF7');
  switch (style) {
    case 'cap': {
      covers = true;
      const dome = mesh(sph(R * 1.12, 36, 18, 0, Math.PI * 2, 0, 1.3), m, 0, 0.02, -0.02);
      dome.scale.set(1, 0.92, 0.98);
      dome.rotation.x = -0.12;
      g.add(dome);
      const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), dark, 0, 0.24, 0.55);
      brim.scale.set(1, 1, 0.78);
      brim.rotation.x = 0.18;
      g.add(brim);
      g.add(mesh(sph(0.06), dark, 0, 0.6, -0.08));
      break;
    }
    case 'beanie': {
      covers = true;
      const dome = mesh(sph(R * 1.12, 36, 18, 0, Math.PI * 2, 0, 1.38), m, 0, 0.02, 0);
      dome.scale.copy(HS);
      g.add(dome);
      const band = mesh(new THREE.TorusGeometry(0.64, 0.075, 10, 36), dark, 0, 0.14, 0);
      band.rotation.x = Math.PI / 2;
      band.scale.set(1, 0.97, 1);
      g.add(band);
      g.add(mesh(sph(0.15, 16, 12), white, 0, 0.72, -0.02));
      break;
    }
    case 'straw': {
      covers = true;
      const straw = toon('#F1D27A');
      g.add(mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.34, 32), straw, 0, 0.58, 0));
      g.add(mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.045, 44), straw, 0, 0.42, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.585, 0.59, 0.1, 32), m, 0, 0.47, 0));
      g.rotation.x = -0.1;
      break;
    }
    case 'bucket': {
      covers = true;
      g.add(mesh(new THREE.CylinderGeometry(0.56, 0.66, 0.36, 32), m, 0, 0.52, 0));
      const top = mesh(sph(0.56, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.7, 0);
      top.scale.y = 0.25;
      g.add(top);
      const brim = mesh(new THREE.CylinderGeometry(0.66, 0.9, 0.16, 36, 1, true), toon(color, { side: THREE.DoubleSide }), 0, 0.3, 0);
      g.add(brim);
      g.rotation.x = -0.06;
      break;
    }
    case 'ribbon': {
      const bow = new THREE.Group();
      const cone = new THREE.ConeGeometry(0.17, 0.3, 14);
      const l = mesh(cone, m, -0.16, 0, 0); l.rotation.z = Math.PI / 2; l.scale.set(1, 1, 0.55);
      const r = mesh(cone, m, 0.16, 0, 0); r.rotation.z = -Math.PI / 2; r.scale.set(1, 1, 0.55);
      bow.add(l, r, mesh(sph(0.075), dark));
      bow.position.copy(onHead(0.55, 0.62, 1.12));
      bow.rotation.set(-0.3, 0.5, -0.35);
      g.add(bow);
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      const petal = sph(0.085, 12, 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = mesh(petal, m, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
        p.scale.z = 0.5;
        f.add(p);
      }
      f.add(mesh(sph(0.06), toon('#F6D55C'), 0, 0, 0.03));
      const pos = onHead(0.72, 1.05, 1.1);
      f.position.copy(pos);
      f.lookAt(pos.clone().multiplyScalar(2));
      g.add(f);
      break;
    }
    case 'bear': {
      const band = mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 40, Math.PI), m, 0, 0.02, 0.02);
      band.rotation.x = -0.25;
      g.add(band);
      for (const s of [-1, 1]) {
        const ear = mesh(sph(0.15, 16, 12), m, s * 0.4, 0.55, -0.05);
        ear.scale.z = 0.6;
        const inner = mesh(sph(0.09, 12, 10), toon('#FBD3D8'), s * 0.4, 0.55, 0.02);
        inner.scale.z = 0.4;
        g.add(ear, inner);
      }
      break;
    }
    case 'sprout': {
      const leaf = toon(color);
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8), toon('#5E8F3E'), 0, 0.65, 0));
      for (const s of [-1, 1]) {
        const l = mesh(sph(0.13, 14, 10), leaf, s * 0.12, 0.77, 0);
        l.scale.set(1, 0.35, 0.6);
        l.rotation.z = s * 0.45;
        g.add(l);
      }
      break;
    }
    case 'party': {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 128);
      ctx.fillStyle = isLight(color) ? '#EF6461' : '#FFFDF7';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 22 + 4, 64, 8);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
      const cone = mesh(new THREE.ConeGeometry(0.28, 0.64, 24), mat, 0.08, 0.86, 0);
      cone.rotation.z = -0.18;
      cone.userData.ownMaterial = true;
      g.add(cone);
      g.add(mesh(sph(0.08), toon('#F6D55C'), 0.14, 1.18, 0));
      break;
    }
    case 'halo': {
      // 천사 고리: 머리 위에 떠서 살짝 오르내린다 (update에서 bob)
      const gold = toon('#FFE68A', { emissive: '#F2B93B' });
      const ring = mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 36), gold, 0, 0.98, -0.03);
      ring.rotation.x = Math.PI / 2 - 0.18;
      ring.userData.bob = 0.98;
      g.add(ring);
      break;
    }
    case 'bunny': {
      const band = mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 40, Math.PI), m, 0, 0.02, 0.02);
      band.rotation.x = -0.25;
      g.add(band);
      const pink = toon('#FBD3D8');
      for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.2, 0.56, -0.06);
        ear.rotation.z = -s * 0.18;
        const outer = mesh(sph(1, 16, 12), m, 0, 0.3, 0);
        outer.scale.set(0.11, 0.33, 0.07);
        const inner = mesh(sph(1, 12, 10), pink, 0, 0.3, 0.04);
        inner.scale.set(0.06, 0.25, 0.04);
        ear.add(outer, inner);
        if (s > 0) ear.rotation.x = -0.35; // 한쪽 귀는 살짝 접힌다
        g.add(ear);
      }
      break;
    }
    case 'catband': {
      const band = mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 40, Math.PI), dark, 0, 0.02, 0.02);
      band.rotation.x = -0.25;
      g.add(band);
      const pink = toon('#FBD3D8');
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.16, 0.3, 4), m, s * 0.33, 0.66, -0.02);
        ear.rotation.set(0, Math.PI / 4, -s * 0.38);
        ear.scale.set(1, 1, 0.45);
        const inner = mesh(new THREE.ConeGeometry(0.09, 0.18, 4), pink, s * 0.325, 0.645, 0.03);
        inner.rotation.set(0, Math.PI / 4, -s * 0.38);
        inner.scale.set(1, 1, 0.3);
        g.add(ear, inner);
      }
      break;
    }
    case 'chef': {
      covers = true;
      g.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.3, 32), white, 0, 0.5, 0));
      const puff = sph(0.26, 18, 14);
      for (const [x, y, z] of [[0, 0.9, 0], [-0.24, 0.8, 0.05], [0.24, 0.8, 0.05], [0, 0.8, -0.24], [0, 0.82, 0.22]]) g.add(mesh(puff, white, x, y, z));
      break;
    }
    case 'crown': {
      const gold = toon('#F4C542');
      const ring = mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.2, 24, 1, true), toon('#F4C542', { side: THREE.DoubleSide }), 0, 0.62, 0);
      g.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.07, 0.16, 8), gold, Math.sin(a) * 0.38, 0.79, Math.cos(a) * 0.38));
        g.add(mesh(sph(0.04, 8, 6), gold, Math.sin(a) * 0.38, 0.88, Math.cos(a) * 0.38));
      }
      g.add(mesh(sph(0.06, 12, 8), m, 0, 0.62, 0.4));
      break;
    }
    default:
  }
  return { group: g, covers };
}

// ---------- 등에 메는 것 (날개, 망토, 가방) ----------
// 몸통 뒤에 붙인다. anim: { wings: [왼쪽, 오른쪽] 날개(파닥), cape: 망토(펄럭) }
function buildBack(style, color) {
  const g = new THREE.Group();
  const anim = {};
  const m = toon(color, { side: THREE.DoubleSide });
  const dark = toon(shade(color, 0.22));
  const wingPair = (parts, mat2) => {
    const pair = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.1, 0.8, -0.3);
      for (const [rx, ry, x, y, rot, mat] of parts) {
        const f = mesh(sph(1, 18, 12), mat || mat2, s * x, y, -0.04);
        f.scale.set(rx, ry, 0.035);
        f.rotation.z = -s * rot;
        pivot.add(f);
      }
      pivot.userData.side = s;
      g.add(pivot);
      pair.push(pivot);
    }
    anim.wings = pair;
  };
  switch (style) {
    case 'angel': {
      const w = toon('#FFFFFF', { emissive: '#5A5A66' });
      const w2 = toon('#EAF2FF', { emissive: '#3A3F4A' });
      wingPair([[0.46, 0.2, 0.36, 0.2, -0.55, w], [0.39, 0.16, 0.44, 0.0, -0.25, w2], [0.3, 0.13, 0.42, -0.17, 0.05, w]]);
      break;
    }
    case 'butterfly': {
      const light = toon(shade(color, -0.45), { side: THREE.DoubleSide });
      wingPair([[0.44, 0.33, 0.36, 0.18, -0.45, m], [0.28, 0.24, 0.26, -0.22, 0.35, light]]);
      const dot = toon('#FFFDF7');
      for (const p of anim.wings) {
        const s = p.userData.side;
        for (const [x, y] of [[0.46, 0.24], [0.3, 0.08], [0.28, -0.24]]) {
          const d = mesh(sph(0.055, 10, 8), dot, s * x, y, -0.07);
          d.scale.z = 0.4;
          p.add(d);
        }
      }
      break;
    }
    case 'cape': {
      // 어깨에서 늘어지는 망토 (윗부분을 축으로 펄럭인다)
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.9, 0);
      const cloth = mesh(new THREE.CylinderGeometry(0.33, 0.56, 0.78, 28, 1, true, Math.PI / 2 + 0.25, Math.PI - 0.5), m, 0, -0.38, -0.02);
      pivot.add(cloth);
      const collar = mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 24), dark, 0, 0.01, 0);
      collar.rotation.x = Math.PI / 2;
      pivot.add(collar);
      g.add(pivot);
      anim.cape = pivot;
      break;
    }
    case 'backpack': {
      const bag = new THREE.Group();
      bag.position.set(0, 0.6, -0.47);
      const body = mesh(new THREE.BoxGeometry(0.46, 0.5, 0.22), toon(color), 0, 0, 0);
      const lid = mesh(sph(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(color), 0, 0.25, 0);
      lid.scale.set(0.23, 0.08, 0.11);
      const pocket = mesh(new THREE.BoxGeometry(0.32, 0.18, 0.06), dark, 0, -0.1, -0.13);
      const clasp = mesh(sph(0.03, 8, 6), toon('#F6D55C'), 0, 0.02, -0.165);
      bag.add(body, lid, pocket, clasp);
      g.add(bag);
      for (const s of [-1, 1]) {
        const strap = mesh(new THREE.TorusGeometry(0.2, 0.028, 6, 16, Math.PI), dark, s * 0.17, 0.66, -0.13);
        strap.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.15);
        g.add(strap);
      }
      break;
    }
    default:
  }
  return { group: g, anim };
}

// ---------- 옷 ----------
const SHORT_SLEEVE = new Set(['tee', 'stripe', 'star', 'overall', 'dress', 'sailor']);

function clothTexture(av) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const base = colorOf(av, 'outfitColor');
  const light = isLight(base);
  const accent = light ? shade(base, 0.35) : '#FFFDF7';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const frontX = 128;
  switch (av.outfit) {
    case 'tee': // 가슴에 새싹
      ctx.fillStyle = light ? '#4FA36C' : '#FFFDF7';
      ctx.save();
      ctx.translate(frontX + 18, 92);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 7, -4, 8, 4, s * -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(-1.5, -2, 3, 12);
      ctx.restore();
      break;
    case 'stripe':
      ctx.fillStyle = accent;
      for (let y = 8; y < 256; y += 32) ctx.fillRect(0, y, 256, 13);
      break;
    case 'star':
      for (let i = 0; i < 26; i++) {
        const x = (i * 97) % 256, y = (i * 61 + 13) % 230 + 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = accent;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) {
          const a = -Math.PI / 2 + (j * Math.PI) / 5;
          const r = j % 2 === 0 ? 7 : 3;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'check':
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = shade(base, 0.45);
      for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 14, 256);
      for (let y = 0; y < 256; y += 32) ctx.fillRect(0, y, 256, 14);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#FFFDF7';
      for (let x = 22; x < 256; x += 32) ctx.fillRect(x, 0, 2, 256);
      for (let y = 22; y < 256; y += 32) ctx.fillRect(0, y, 256, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(base, 0.25);
      ctx.fillRect(frontX - 2, 30, 4, 226);
      for (let y = 60; y < 240; y += 40) { ctx.beginPath(); ctx.arc(frontX + 8, y, 4, 0, 7); ctx.fillStyle = '#FFFDF7'; ctx.fill(); }
      break;
    case 'hoodie':
      ctx.fillStyle = shade(base, 0.12);
      ctx.beginPath();
      ctx.roundRect(frontX - 38, 150, 76, 52, 14);
      ctx.fill();
      ctx.strokeStyle = '#FFFDF7';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(frontX + s * 9, 10); ctx.lineTo(frontX + s * 11, 70); ctx.stroke();
      }
      ctx.fillStyle = shade(base, 0.15);
      ctx.fillRect(0, 236, 256, 20);
      break;
    case 'sweater':
      ctx.strokeStyle = shade(base, 0.16);
      ctx.lineWidth = 3;
      for (let x = 8; x < 256; x += 22) {
        for (let y = 0; y < 256; y += 14) {
          ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 5, y); ctx.stroke();
        }
      }
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(0, 232, 256, 24);
      break;
    case 'sporty':
      ctx.fillStyle = '#FFFDF7';
      for (const x of [64, 192]) { ctx.fillRect(x - 9, 0, 6, 256); ctx.fillRect(x + 3, 0, 6, 256); }
      ctx.fillStyle = shade(base, 0.3);
      ctx.fillRect(frontX - 2, 0, 4, 256);
      break;
    case 'overall': {
      const shirt = '#FFF6E6';
      ctx.fillStyle = shirt;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = shade(shirt, 0.08);
      for (let y = 0; y < 150; y += 18) ctx.fillRect(0, y, 256, 6);
      ctx.fillStyle = base;
      ctx.fillRect(0, 150, 256, 106);
      ctx.beginPath(); ctx.roundRect(frontX - 34, 74, 68, 90, 8); ctx.fill();
      for (const x of [frontX - 26, frontX + 18, 18, 230]) ctx.fillRect(x, 0, 9, 160);
      ctx.fillStyle = '#F6D55C';
      for (const x of [frontX - 22, frontX + 22]) { ctx.beginPath(); ctx.arc(x, 82, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade(base, 0.15);
      ctx.beginPath(); ctx.roundRect(frontX - 18, 108, 36, 28, 5); ctx.fill();
      break;
    }
    case 'dress':
      ctx.fillStyle = 'rgba(255,253,247,.85)';
      ctx.beginPath(); ctx.arc(frontX, -6, 34, 0, Math.PI); ctx.fill();
      for (let i = 0; i < 18; i++) {
        ctx.beginPath(); ctx.arc((i * 53) % 256, (i * 37) % 220 + 20, 4, 0, 7); ctx.fill();
      }
      break;
    case 'robe':
      ctx.fillStyle = light ? shade(base, 0.25) : shade(base, -0.35);
      for (const x of [frontX - 30, frontX + 22]) ctx.fillRect(x, 0, 8, 256);
      ctx.fillRect(frontX - 70, 0, 4, 256);
      ctx.fillRect(frontX + 66, 0, 4, 256);
      break;
    case 'pajama': { // 잠옷: 달과 별 무늬, 흰 테두리 깃과 단추
      const dot = light ? shade(base, 0.3) : '#FFF6D8';
      for (let i = 0; i < 22; i++) {
        const x = (i * 83 + 17) % 256, y = (i * 47 + 21) % 236 + 8;
        ctx.fillStyle = dot;
        if (i % 2) {
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = base;
          ctx.beginPath(); ctx.arc(x + 3.5, y - 2.5, 6, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath();
          for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, r = j % 2 ? 2.4 : 5.5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
          ctx.fill();
        }
      }
      ctx.strokeStyle = '#FFFDF7';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(frontX - 34, 0); ctx.lineTo(frontX, 52); ctx.lineTo(frontX + 34, 0); ctx.stroke();
      ctx.fillStyle = '#FFFDF7';
      for (const y of [82, 130, 178, 222]) { ctx.beginPath(); ctx.arc(frontX + 4, y, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,253,247,.9)';
      ctx.fillRect(0, 244, 256, 6);
      break;
    }
    case 'sailor': { // 세일러복: 흰 옷에 옷 색 깃과 빨간 리본
      ctx.fillStyle = '#FFFDF7';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.moveTo(frontX - 56, 0); ctx.lineTo(frontX, 116); ctx.lineTo(frontX + 56, 0); ctx.fill();
      ctx.fillRect(0, 0, 60, 92); ctx.fillRect(196, 0, 60, 92); // 등에 넓은 깃
      ctx.strokeStyle = '#FFFDF7';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(frontX - 45, 0); ctx.lineTo(frontX, 100); ctx.lineTo(frontX + 45, 0); ctx.stroke();
      ctx.strokeRect(-4, -4, 56, 88); ctx.strokeRect(204, -4, 56, 88);
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.moveTo(frontX - 26, 2); ctx.lineTo(frontX, 64); ctx.lineTo(frontX + 26, 2); ctx.fill();
      ctx.fillStyle = '#E5484D';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(frontX, 112); ctx.lineTo(frontX + s * 26, 98); ctx.lineTo(frontX + s * 26, 128); ctx.fill(); }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(frontX + s * 4, 116); ctx.lineTo(frontX + s * 16, 160); ctx.lineTo(frontX + s * 4, 154); ctx.fill(); }
      ctx.beginPath(); ctx.arc(frontX, 112, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = base;
      ctx.fillRect(0, 238, 256, 18);
      break;
    }
    case 'raincoat': { // 비옷: 반짝이는 줄, 큰 단추, 주머니 덮개
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (const x of [frontX - 58, frontX + 40, 30, 214]) ctx.fillRect(x, 10, 7, 236);
      ctx.fillStyle = shade(base, 0.2);
      ctx.fillRect(frontX - 3, 0, 6, 256);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(frontX + s * 30 - 22, 168, 44, 16, 6); ctx.fill(); }
      ctx.fillStyle = light ? '#5A4A3A' : '#FFFDF7';
      for (const y of [56, 104, 152, 200]) { ctx.beginPath(); ctx.ellipse(frontX + 12, y, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'hero': { // 영웅 옷: 가슴에 노란 별, 허리띠
      ctx.fillStyle = shade(base, 0.18);
      ctx.fillRect(frontX - 2, 150, 4, 70);
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.arc(frontX, 92, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F6C445';
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, r = j % 2 ? 12 : 28; ctx.lineTo(frontX + Math.cos(a) * r, 94 + Math.sin(a) * r); }
      ctx.fill();
      ctx.fillStyle = '#F6C445';
      ctx.fillRect(0, 222, 256, 18);
      ctx.fillStyle = '#E39B2D';
      ctx.fillRect(frontX - 14, 218, 28, 26);
      break;
    }
    default:
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function torsoGeometry() {
  const pts = [[0.001, 0.3], [0.3, 0.3], [0.345, 0.36], [0.355, 0.5], [0.335, 0.66], [0.29, 0.8], [0.21, 0.9],
    [0.11, 0.945], [0.001, 0.955]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 36, Math.PI, Math.PI * 2);
}
function skirtGeometry(long) {
  const pts = long
    ? [[0.33, 0.64], [0.37, 0.46], [0.41, 0.22], [0.43, 0.06]]
    : [[0.31, 0.66], [0.36, 0.52], [0.46, 0.32], [0.5, 0.24]];
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36, Math.PI, Math.PI * 2);
}

// ---------- 아바타 ----------
export class Avatar {
  constructor(data) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.walk = 0;
    this.time = Math.random() * 10;
    this.nextBlink = 1 + Math.random() * 3;
    this.blinkLeft = 0;
    this.hop = 0;
    this.pose = null; // (avatar, dt, t) => 매 프레임 기본 동작 뒤에 자세를 덮어쓴다 (낚시, 앉기 등)
    this.held = null;
    this.ownTextures = [];
    this.ownMaterials = [];
    this.setData(data);
  }

  setData(data) {
    const held = this.held;
    this.drop(); // 들고 있던 물건은 지우지 않고 새 팔에 다시 쥐여 준다
    this.data = normalizeAvatar(data);
    this.clear();
    this.build();
    if (held) this.hold(held.obj, held.arm);
  }

  clear() {
    this.body.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    while (this.body.children.length) this.body.remove(this.body.children[0]);
    for (const t of this.ownTextures) t.dispose();
    for (const m of this.ownMaterials) m.dispose();
    this.ownTextures = [];
    this.ownMaterials = [];
  }

  build() {
    const av = this.data;
    const skinC = colorOf(av, 'skin');
    const skin = toon(skinC);
    const clothC = colorOf(av, 'outfitColor');
    const clothTex = clothTexture(av);
    const clothMat = new THREE.MeshToonMaterial({ map: clothTex, gradientMap: toonGradient() });
    this.ownTextures.push(clothTex);
    this.ownMaterials.push(clothMat);
    const plain = toon(clothC);
    // 소매와 바지: 멜빵바지는 흰 소매, 세일러복은 흰 반소매, 잠옷은 위아래 같은 무늬, 영웅 옷은 옷 색 바지
    const sleeveMat = av.outfit === 'overall' ? toon('#FFF6E6') : av.outfit === 'sailor' ? toon('#FFFDF7') : av.outfit === 'pajama' ? clothMat : plain;
    const bottomC = ['overall', 'hero'].includes(av.outfit) ? clothC : colorOf(av, 'bottomColor');
    const legMat = ['dress', 'robe'].includes(av.outfit) ? skin : av.outfit === 'pajama' ? clothMat : toon(bottomC);
    const shoeMat = toon(av.outfit === 'robe' ? '#9A6A43' : colorOf(av, 'shoeColor'));

    // 다리
    this.legs = [];
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.12, 6, 12);
    const shoeGeo = sph(1, 16, 12);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.13, 0.36, 0);
      pivot.add(mesh(legGeo, legMat, 0, -0.12, 0));
      const shoe = mesh(shoeGeo, shoeMat, 0, -0.29, 0.035);
      shoe.scale.set(0.125, 0.075, 0.165);
      pivot.add(shoe);
      this.body.add(pivot);
      this.legs.push(pivot);
    }

    // 몸통
    const torso = mesh(torsoGeometry(), clothMat);
    this.body.add(torso);
    if (av.outfit === 'dress' || av.outfit === 'robe') {
      const skirt = mesh(skirtGeometry(av.outfit === 'robe'), new THREE.MeshToonMaterial({ map: clothTex, gradientMap: toonGradient(), side: THREE.DoubleSide }));
      this.ownMaterials.push(skirt.material);
      this.body.add(skirt);
      if (av.outfit === 'dress') {
        const hem = mesh(new THREE.TorusGeometry(0.5, 0.028, 6, 40), toon('#FFFDF7'), 0, 0.245, 0);
        hem.rotation.x = Math.PI / 2;
        this.body.add(hem);
      } else {
        const sashC = isLight(clothC) ? '#9A6A43' : '#E9B949';
        const sash = mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 36), toon(sashC), 0, 0.58, 0);
        sash.rotation.x = Math.PI / 2;
        this.body.add(sash);
        const tail = mesh(sph(1, 10, 8), toon(sashC), 0.18, 0.46, 0.3);
        tail.scale.set(0.05, 0.13, 0.03);
        tail.rotation.z = 0.2;
        this.body.add(tail);
      }
    }
    if (av.outfit === 'raincoat') {
      // 비옷 자락 (엉덩이까지 내려온다)
      const pts = [[0.335, 0.62], [0.37, 0.46], [0.405, 0.3], [0.415, 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
      const coat = mesh(new THREE.LatheGeometry(pts, 36, Math.PI, Math.PI * 2), new THREE.MeshToonMaterial({ map: clothTex, gradientMap: toonGradient(), side: THREE.DoubleSide }));
      this.ownMaterials.push(coat.material);
      this.body.add(coat);
    }
    if (av.outfit === 'hoodie' || av.outfit === 'raincoat') {
      const hood = mesh(new THREE.TorusGeometry(0.2, 0.09, 10, 24), plain, 0, 0.9, -0.2);
      hood.rotation.x = 1.15;
      this.body.add(hood);
    }
    if (av.outfit === 'sweater') {
      const collar = mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 20), toon(shade(clothC, -0.25)), 0, 0.93, 0);
      collar.rotation.x = Math.PI / 2;
      this.body.add(collar);
    }

    // 팔
    this.arms = [];
    const armGeo = new THREE.CapsuleGeometry(0.085, 0.26, 6, 12);
    const handGeo = sph(0.09, 14, 10);
    const short = SHORT_SLEEVE.has(av.outfit);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.33, 0.84, 0);
      pivot.rotation.z = s * 0.2;
      pivot.add(mesh(armGeo, short ? skin : sleeveMat, 0, -0.2, 0));
      if (short) pivot.add(mesh(new THREE.CylinderGeometry(0.112, 0.105, 0.16, 14), sleeveMat, 0, -0.05, 0));
      pivot.add(mesh(handGeo, skin, 0, -0.42, 0));
      this.body.add(pivot);
      this.arms.push(pivot);
    }

    // 머리
    const head = new THREE.Group();
    head.position.y = HEAD_Y;
    this.head = head;
    const skull = mesh(sph(R, 40, 28), skin);
    skull.scale.copy(HS);
    head.add(skull);
    for (const s of [-1, 1]) {
      const ear = mesh(sph(0.1, 12, 10), skin, s * 0.58, -0.04, 0);
      ear.scale.set(0.6, 1, 0.8);
      head.add(ear);
    }
    // 얼굴 텍스처 (뜬 눈 / 감은 눈)
    this.faceTex = [false, true].map((blink) => {
      const c = document.createElement('canvas');
      c.width = FACE_TEX.w; c.height = FACE_TEX.h;
      drawFace(c.getContext('2d'), av, { blink });
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.ownTextures.push(t);
      return t;
    });
    const faceMat = new THREE.MeshToonMaterial({ map: this.faceTex[0], transparent: true, gradientMap: toonGradient(), depthWrite: false });
    this.ownMaterials.push(faceMat);
    const face = new THREE.Mesh(
      sph(R * 1.004, 48, 32, FRONT - FACE_TEX.phiWidth / 2, FACE_TEX.phiWidth, FACE_TEX.thetaStart, FACE_TEX.thetaLength),
      faceMat,
    );
    face.scale.copy(HS);
    face.renderOrder = 2;
    face.userData.noMerge = true;
    head.add(face);
    this.faceMat = faceMat;

    const hair = buildHair(av.hair, colorOf(av, 'hairColor'));
    head.add(hair.group);
    const hat = buildHat(av.hat, colorOf(av, 'hatColor'));
    head.add(hat.group);
    hat.group.traverse((o) => { if (o.userData.ownMaterial) { this.ownMaterials.push(o.material); this.ownTextures.push(o.material.map); } });
    if (hat.covers) for (const o of hair.top) o.visible = false;
    this.halo = null;
    hat.group.traverse((o) => { if (o.userData.bob) { o.userData.noMerge = true; this.halo = o; } });
    this.body.add(head);
    // 등에 메는 것 (날개, 망토, 가방): 움직이는 부분마다 따로 합친다
    const back = buildBack(av.back, colorOf(av, 'backColor'));
    this.backAnim = back.anim;
    if (back.group.children.length) {
      this.body.add(back.group);
      const movers = [...(back.anim.wings || []), ...(back.anim.cape ? [back.anim.cape] : [])];
      for (const g of movers) mergeStatic(g);
      if (!movers.length) mergeStatic(back.group);
    }
    // 움직이지 않는 부분끼리 합쳐 그리기 횟수를 줄인다 (팔·다리·머리는 따로 움직이므로 묶음별로)
    for (const g of [...this.legs, ...this.arms, head]) mergeStatic(g);
    mergeStatic(this.body, { shallow: true });
  }

  celebrate() { this.hop = 1; }
  // 폴짝 뛰기: 몸이 높이 올라가고 팔을 번쩍 든다
  jump() { this.jumpT = 1; }

  // 손에 물건 들기 (낚싯대, 물고기, 접시). arm 1은 화면에서 볼 때 오른쪽 팔
  hold(obj, arm = 1) {
    this.drop();
    if (!obj) return;
    obj.position.set(0, -0.44, 0.02);
    this.arms[arm].add(obj);
    this.held = { obj, arm };
  }
  drop() {
    if (this.held) { this.held.obj.removeFromParent(); this.held = null; }
  }

  update(dt, moving = false, speed = 1) {
    this.time += dt;
    const t = this.time;
    if (moving) this.walk += dt * 9 * speed;
    const sw = moving ? Math.sin(this.walk) : 0;
    const k = moving ? 1 : 0;
    const runK = moving && speed > 1.6 ? 1.35 : 1; // 달리면 팔다리를 크게 흔든다
    this.legs[0].rotation.x = sw * 0.7 * k * runK;
    this.legs[1].rotation.x = -sw * 0.7 * k * runK;
    this.arms[0].rotation.x = -sw * 0.6 * k * runK;
    this.arms[1].rotation.x = sw * 0.6 * k * runK;
    const idle = Math.sin(t * 2.2) * 0.012;
    let y = moving ? Math.abs(Math.sin(this.walk)) * 0.07 : idle;
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 2.2);
      y += Math.sin((1 - this.hop) * Math.PI) * 0.45;
    }
    let jmp = 0;
    if (this.jumpT > 0) {
      this.jumpT = Math.max(0, this.jumpT - dt / 0.62);
      jmp = Math.sin((1 - this.jumpT) * Math.PI);
      y += jmp * 1.05;
      this.legs[0].rotation.x = -0.6 * jmp;
      this.legs[1].rotation.x = 0.35 * jmp;
    }
    this.body.position.y = y;
    this.body.rotation.x = moving ? (runK > 1 ? 0.17 : 0.06) : 0;
    this.head.rotation.z = moving ? 0 : Math.sin(t * 0.9) * 0.03;
    // 눈 깜빡임
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkLeft = 0.13;
      this.nextBlink = 2.5 + Math.random() * 3.5;
    }
    const blink = this.blinkLeft > 0;
    if (blink) this.blinkLeft -= dt;
    const want = this.faceTex[blink ? 1 : 0];
    if (this.faceMat.map !== want) this.faceMat.map = want;
    this.arms[0].rotation.z = -0.2;
    this.arms[1].rotation.z = 0.2;
    if (jmp > 0) {
      this.arms[0].rotation.x = this.arms[1].rotation.x = -2.7 * jmp;
      this.arms[0].rotation.z = -0.2 - 0.25 * jmp;
      this.arms[1].rotation.z = 0.2 + 0.25 * jmp;
    }
    // 천사 고리는 둥실, 날개는 파닥, 망토는 달리면 펄럭
    if (this.halo) this.halo.position.y = this.halo.userData.bob + Math.sin(t * 2.2) * 0.035;
    const ba = this.backAnim;
    if (ba && ba.wings) {
      const flap = 0.28 + Math.sin(t * (moving ? 9 : 3.2)) * (moving ? 0.28 : 0.12);
      for (const w of ba.wings) w.rotation.y = w.userData.side * flap;
    }
    if (ba && ba.cape) {
      const want = moving ? Math.min(1.1, 0.35 + 0.3 * speed) + Math.sin(t * 11) * 0.06 : 0.1 + Math.sin(t * 1.5) * 0.03;
      ba.cape.rotation.x += (want - ba.cape.rotation.x) * Math.min(1, dt * 6);
    }
    if (this.pose) this.pose(this, dt, t);
  }

  dispose() {
    this.drop();
    this.clear();
  }
}

export { PALETTE };
