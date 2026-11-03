// 진숲 어린이 마을 — 3D 아바타 만들기
import * as THREE from './three.module.min.js';
import { PALETTE, normalizeAvatar, drawFace, colorOf, shade, isLight, FACE_TEX, ONE_PIECE } from './face.js';
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
// 상의와 하의는 따로 그린다 (상의는 허리 위, 하의는 엉덩이와 다리). 한 벌 옷(ONE_PIECE)은 몸통 하나로 그린다.
const SHORT_SLEEVE = new Set(['tee', 'plain', 'stripe', 'star', 'heart', 'cross', 'rainbow', 'dots', 'polo', 'soccer', 'overall', 'dress', 'sailor', 'blouse']);
const NO_SLEEVE = new Set(['tank']);
// 상의 아랫단 높이: 긴 옷은 엉덩이까지, 저고리는 짧게, 셔츠는 바지 속에 넣어 입는다
const TOP_HEM = { hoodie: 0.37, sweater: 0.38, turtle: 0.38, cardigan: 0.36, puffer: 0.35, jumper: 0.39, raincoat: 0.36, jeogori: 0.6, shirt: 0.47, tie: 0.47, blouse: 0.46, polo: 0.45 };
const SKIRTS = new Set(['skirt', 'pleated', 'long', 'tutu', 'chima']);
const BARE_LEGS = new Set(['shorts', 'skirt', 'pleated', 'tutu']);
// 몸통 옆모습 (아래에서 위로 [반지름, 높이])
const TORSO_PTS = [[0.001, 0.3], [0.3, 0.3], [0.345, 0.36], [0.355, 0.5], [0.335, 0.66], [0.29, 0.8], [0.21, 0.9], [0.11, 0.945], [0.001, 0.955]];
function torsoR(y) {
  for (let i = 1; i < TORSO_PTS.length - 1; i++) {
    const [r0, y0] = TORSO_PTS[i], [r1, y1] = TORSO_PTS[i + 1];
    if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0));
  }
  return 0.001;
}
// 돌림 모양의 무늬 좌표를 높이에 고르게 (위 끝 v=1, 아래 끝 v=0)
function lathe(pts, y0, y1) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36, Math.PI, Math.PI * 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0))));
  uv.needsUpdate = true;
  return g;
}
function topGeometry(hem, puff = 1) {
  const pts = [[torsoR(hem) + 0.016, hem - 0.006], [torsoR(hem) + 0.014, hem + 0.01]];
  for (const [x, y] of TORSO_PTS) if (y > hem + 0.02) pts.push([x < 0.01 ? x : x + 0.007, y]);
  const g = lathe(pts, hem - 0.006, 0.955);
  if (puff !== 1) g.scale(puff, 1, puff);
  return g;
}
function hipsGeometry(wide = 1) {
  const g = lathe([[0.001, 0.3], [0.3, 0.3], [0.345, 0.36], [0.354, 0.45], [torsoR(0.54), 0.54]], 0.3, 0.54);
  if (wide !== 1) g.scale(wide, 1, wide);
  return g;
}
// 치마 모양: 허리에서 아래로 퍼진다
const SKIRT_PTS = {
  skirt: [[0.35, 0.55], [0.37, 0.47], [0.43, 0.33], [0.47, 0.24]],
  pleated: [[0.35, 0.55], [0.38, 0.46], [0.46, 0.31], [0.5, 0.22]],
  long: [[0.35, 0.55], [0.38, 0.42], [0.42, 0.23], [0.45, 0.06]],
  tutu: [[0.35, 0.5], [0.5, 0.43], [0.58, 0.39], [0.6, 0.37]],
  chima: [[0.29, 0.74], [0.34, 0.63], [0.4, 0.46], [0.46, 0.26], [0.49, 0.06]],
};

// 하의 무늬 (엉덩이 둘레와 치마). 위가 허리
function bottomTexture(av) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const base = colorOf(av, 'bottomColor');
  const light = isLight(base);
  const dark = shade(base, 0.22);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 128);
  const F = 128; // 앞 가운데
  const band = (h, col = dark) => { ctx.fillStyle = col; ctx.fillRect(0, 0, 256, h); };
  switch (av.bottom) {
    case 'jeans': {
      band(16);
      ctx.strokeStyle = '#F2B05E';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(256, 17); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(F + 4, 18); ctx.lineTo(F + 4, 72); ctx.quadraticCurveTo(F + 4, 82, F - 6, 84); ctx.stroke(); // 앞 지퍼
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(F + s * 26, 18); ctx.quadraticCurveTo(F + s * 34, 40, F + s * 56, 44); ctx.stroke(); } // 앞 주머니
      for (const x of [26, 256 - 26]) { ctx.strokeRect(x - 16, 30, 32, 34); } // 뒷주머니
      ctx.setLineDash([]);
      ctx.fillStyle = '#E8C46A';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(F + s * 30, 22, 3, 0, 7); ctx.fill(); }
      break;
    }
    case 'jogger':
      band(18, light ? shade(base, 0.12) : shade(base, -0.15));
      ctx.fillStyle = '#FFFDF7';
      for (const x of [64, 192]) { ctx.fillRect(x - 7, 0, 5, 128); ctx.fillRect(x + 2, 0, 5, 128); }
      ctx.strokeStyle = '#FFFDF7'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(F + s * 5, 12); ctx.lineTo(F + s * 9, 40); ctx.stroke(); } // 허리끈
      break;
    case 'cargo':
      band(16, shade(base, 0.35));
      ctx.fillStyle = '#C9A44C';
      ctx.fillRect(F - 10, 2, 20, 12); // 허리띠 버클
      ctx.fillStyle = dark;
      for (const x of [64, 192]) ctx.fillRect(x - 18, 40, 36, 30);
      break;
    case 'baji':
      band(20, light ? shade(base, 0.18) : '#FFFDF7');
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 6;
      for (let x = 8; x < 256; x += 28) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x + 6, 128); ctx.stroke(); }
      break;
    case 'pleated':
      ctx.fillStyle = dark;
      for (let x = 0; x < 256; x += 16) ctx.fillRect(x, 10, 7, 118);
      band(10, shade(base, 0.3));
      if (!light) { ctx.fillStyle = 'rgba(255,253,247,.55)'; ctx.fillRect(0, 112, 256, 4); }
      break;
    case 'skirt':
      band(10);
      ctx.fillStyle = light ? shade(base, 0.18) : 'rgba(255,253,247,.7)';
      ctx.fillRect(0, 112, 256, 6);
      break;
    case 'long':
      band(10);
      ctx.fillStyle = light ? shade(base, 0.2) : 'rgba(255,253,247,.75)';
      for (let x = 6; x < 256; x += 16) { ctx.beginPath(); ctx.arc(x, 118, 4, 0, 7); ctx.fill(); }
      break;
    case 'tutu':
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 71) % 256, (i * 29) % 128, 3, 0, 7); ctx.fill(); }
      break;
    case 'chima':
      ctx.strokeStyle = light ? shade(base, 0.12) : 'rgba(255,253,247,.18)'; ctx.lineWidth = 3;
      for (let x = 10; x < 256; x += 22) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x - 6, 128); ctx.stroke(); }
      band(14, '#FFFDF7'); // 허리말기
      break;
    default: // 긴바지, 반바지
      band(14);
      ctx.fillStyle = dark;
      ctx.fillRect(F - 1, 14, 2, 56);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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
    case 'plain':
      ctx.fillStyle = shade(base, 0.1);
      ctx.fillRect(0, 240, 256, 16);
      break;
    case 'heart': // 가슴에 큰 하트
      ctx.fillStyle = light ? '#EF6461' : '#FFFDF7';
      ctx.beginPath();
      ctx.moveTo(frontX, 150);
      ctx.bezierCurveTo(frontX - 46, 118, frontX - 30, 72, frontX, 96);
      ctx.bezierCurveTo(frontX + 30, 72, frontX + 46, 118, frontX, 150);
      ctx.fill();
      break;
    case 'cross': // 가슴에 작은 십자가
      ctx.fillStyle = light ? '#8E603E' : '#FFF2B8';
      ctx.fillRect(frontX - 5, 66, 10, 56);
      ctx.fillRect(frontX - 20, 80, 40, 10);
      break;
    case 'rainbow': { // 무지개 (노아의 방주 약속)
      const cols = ['#EF6461', '#F49A4C', '#F6D55C', '#6CC24A', '#4D7DDB', '#A07FE3'];
      ctx.lineWidth = 7;
      cols.forEach((cl, i) => { ctx.strokeStyle = cl; ctx.beginPath(); ctx.arc(frontX, 140, 54 - i * 7, Math.PI, 0); ctx.stroke(); });
      ctx.fillStyle = '#FFFDF7';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(frontX + s * 40, 142, 11, 0, 7); ctx.arc(frontX + s * 28, 146, 9, 0, 7); ctx.fill(); }
      break;
    }
    case 'dots':
      ctx.fillStyle = accent;
      for (let y = 10, row = 0; y < 256; y += 26, row++) for (let x = (row % 2) * 13; x < 256; x += 26) { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fill(); }
      break;
    case 'tank':
      ctx.fillStyle = accent;
      ctx.fillRect(0, 244, 256, 12);
      ctx.strokeStyle = accent; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(frontX, 0, 30, 0, Math.PI); ctx.stroke();
      break;
    case 'polo':
      ctx.fillStyle = light ? shade(base, 0.22) : '#FFFDF7';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(frontX, 30); ctx.lineTo(frontX + s * 34, 0); ctx.lineTo(frontX + s * 8, 0); ctx.fill(); }
      ctx.fillStyle = shade(base, 0.2);
      ctx.fillRect(frontX - 7, 28, 14, 56);
      ctx.fillStyle = '#FFFDF7';
      for (const y of [44, 68]) { ctx.beginPath(); ctx.arc(frontX, y, 4, 0, 7); ctx.fill(); }
      break;
    case 'shirt':
    case 'tie': {
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(frontX - 2, 30, 4, 226);
      ctx.fillStyle = '#FFFDF7';
      if (av.outfit === 'shirt') for (let y = 50; y < 250; y += 36) { ctx.beginPath(); ctx.arc(frontX + 7, y, 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = light ? '#FFFDF7' : shade(base, -0.4);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(frontX, 34); ctx.lineTo(frontX + s * 40, 0); ctx.lineTo(frontX + s * 6, 0); ctx.fill(); }
      if (av.outfit === 'tie') {
        const tc = ['#EF6461', '#F6D55C'].includes(base) ? '#30477F' : base === '#30477F' || base === '#4D7DDB' ? '#EF6461' : '#30477F';
        ctx.fillStyle = tc;
        ctx.beginPath(); ctx.moveTo(frontX - 9, 26); ctx.lineTo(frontX + 9, 26); ctx.lineTo(frontX + 6, 40); ctx.lineTo(frontX - 6, 40); ctx.fill();
        ctx.beginPath(); ctx.moveTo(frontX - 6, 40); ctx.lineTo(frontX + 6, 40); ctx.lineTo(frontX + 13, 176); ctx.lineTo(frontX, 196); ctx.lineTo(frontX - 13, 176); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        for (let y = 60; y < 176; y += 26) ctx.fillRect(frontX - 10, y, 20, 6);
      }
      break;
    }
    case 'blouse':
      ctx.fillStyle = 'rgba(255,253,247,.5)';
      for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc((i * 61 + 20) % 256, (i * 43) % 200 + 40, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(0, 238, 256, 18);
      break;
    case 'turtle':
      ctx.strokeStyle = shade(base, 0.14); ctx.lineWidth = 6;
      for (let x = 6; x < 256; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(0, 232, 256, 24);
      break;
    case 'cardigan':
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.moveTo(frontX - 30, 0); ctx.lineTo(frontX - 14, 256); ctx.lineTo(frontX + 14, 256); ctx.lineTo(frontX + 30, 0); ctx.fill(); // 안에 입은 흰 티
      ctx.fillStyle = shade(base, 0.18);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(frontX + s * 30, 0); ctx.lineTo(frontX + s * 14, 256); ctx.lineTo(frontX + s * 22, 256); ctx.lineTo(frontX + s * 38, 0); ctx.fill(); }
      ctx.fillStyle = light ? '#8E603E' : '#FFF2B8';
      for (let y = 90; y < 250; y += 40) { ctx.beginPath(); ctx.arc(frontX - 20, y, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade(base, 0.18);
      ctx.fillRect(0, 238, frontX - 18, 18); ctx.fillRect(frontX + 18, 238, 256, 18);
      break;
    case 'vest': {
      // 흰 셔츠 위에 조끼
      ctx.fillStyle = '#FFFDF7';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(frontX - 34, 0); ctx.lineTo(frontX, 120); ctx.lineTo(frontX + 34, 0); ctx.lineTo(256, 0); ctx.lineTo(256, 256); ctx.lineTo(0, 256); ctx.fill();
      ctx.fillStyle = light ? shade(base, 0.35) : '#FFF2B8';
      for (let y = 140; y < 240; y += 30) { ctx.beginPath(); ctx.arc(frontX, y, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = shade(base, 0.2);
      for (const s of [-1, 1]) ctx.fillRect(frontX + s * 44 - 16, 168, 32, 6); // 주머니
      break;
    }
    case 'soccer': {
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.moveTo(frontX - 26, 0); ctx.lineTo(frontX, 40); ctx.lineTo(frontX + 26, 0); ctx.lineTo(frontX + 18, 0); ctx.lineTo(frontX, 28); ctx.lineTo(frontX - 18, 0); ctx.fill();
      for (const x of [40, 216]) ctx.fillRect(x - 4, 0, 8, 256); // 옆 줄
      ctx.fillStyle = light ? shade(base, 0.45) : '#FFFDF7';
      ctx.font = '700 64px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const x of [0, 256]) ctx.fillText('10', x, 116); // 등 번호 (등 가운데는 그림의 양 끝)
      ctx.font = '700 26px sans-serif';
      ctx.fillText('10', frontX + 40, 90);
      break;
    }
    case 'jumper': {
      // 야구 점퍼: 가슴에 '진' 글자, 줄무늬 시보리
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.arc(frontX - 44, 92, 24, 0, 7); ctx.fill();
      ctx.fillStyle = base;
      ctx.font = '700 30px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('진', frontX - 44, 94);
      ctx.fillStyle = shade(base, 0.25);
      ctx.fillRect(frontX - 3, 20, 6, 236);
      for (const y of [232, 246]) { ctx.fillStyle = y === 232 ? '#FFFDF7' : shade(base, 0.25); ctx.fillRect(0, y, 256, 8); }
      ctx.fillStyle = '#FFF2B8';
      for (let y = 50; y < 230; y += 36) { ctx.beginPath(); ctx.arc(frontX + 8, y, 4, 0, 7); ctx.fill(); }
      break;
    }
    case 'puffer':
      ctx.fillStyle = shade(base, 0.16);
      for (let y = 20; y < 256; y += 34) ctx.fillRect(0, y, 256, 5); // 누빈 줄
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      for (let y = 30; y < 256; y += 34) ctx.fillRect(0, y, 256, 8);
      ctx.fillStyle = shade(base, 0.3);
      ctx.fillRect(frontX - 2, 0, 4, 256); // 지퍼
      break;
    case 'jeogori': {
      // 한복 저고리: 흰 동정이 달린 깃
      ctx.fillStyle = shade(base, light ? 0.18 : -0.3);
      ctx.beginPath(); ctx.moveTo(frontX - 40, 0); ctx.lineTo(frontX + 18, 200); ctx.lineTo(frontX + 36, 200); ctx.lineTo(frontX - 22, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(frontX + 40, 0); ctx.lineTo(frontX + 4, 110); ctx.lineTo(frontX + 18, 116); ctx.lineTo(frontX + 56, 0); ctx.fill();
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath(); ctx.moveTo(frontX - 40, 0); ctx.lineTo(frontX - 30, 34); ctx.lineTo(frontX - 22, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(frontX + 40, 0); ctx.lineTo(frontX + 34, 22); ctx.lineTo(frontX + 56, 0); ctx.fill();
      ctx.fillStyle = shade(base, 0.14);
      ctx.fillRect(0, 236, 256, 20);
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
    const one = ONE_PIECE.has(av.outfit);
    const bot = one ? null : av.bottom;
    const bottomC = colorOf(av, 'bottomColor');
    // 소매: 멜빵바지는 흰 소매, 세일러복은 흰 반소매, 잠옷은 위아래 같은 무늬, 야구 점퍼는 크림색 소매, 조끼는 안에 입은 흰 셔츠 소매
    const sleeveMat = av.outfit === 'overall' || av.outfit === 'jumper' ? toon('#FFF6E6') : av.outfit === 'sailor' || av.outfit === 'vest' ? toon('#FFFDF7') : av.outfit === 'pajama' ? clothMat : plain;
    // 다리: 한 벌 옷은 예전 그대로, 따로 입으면 하의에 따라 (반바지·치마는 맨다리)
    let legMat;
    if (one) legMat = ['dress', 'robe'].includes(av.outfit) ? skin : av.outfit === 'pajama' ? clothMat : toon(['overall', 'hero'].includes(av.outfit) ? clothC : bottomC);
    else legMat = BARE_LEGS.has(bot) || bot === 'long' || bot === 'chima' ? skin : toon(bottomC);
    const shoeMat = toon(av.outfit === 'robe' ? '#9A6A43' : colorOf(av, 'shoeColor'));
    const botTex = one ? null : bottomTexture(av);
    const botMat = botTex ? new THREE.MeshToonMaterial({ map: botTex, gradientMap: toonGradient(), side: THREE.DoubleSide }) : null;
    if (botTex) { this.ownTextures.push(botTex); this.ownMaterials.push(botMat); }
    const botPlain = toon(bottomC);

    // 다리
    this.legs = [];
    const wideLeg = bot === 'baji';
    const legGeo = wideLeg ? new THREE.CapsuleGeometry(0.122, 0.1, 6, 12) : new THREE.CapsuleGeometry(0.1, 0.12, 6, 12);
    const shoeGeo = sph(1, 16, 12);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.13, 0.36, 0);
      pivot.add(mesh(legGeo, legMat, 0, -0.12, 0));
      const shoe = mesh(shoeGeo, shoeMat, 0, -0.29, 0.035);
      shoe.scale.set(0.125, 0.075, 0.165);
      pivot.add(shoe);
      if (bot === 'shorts') pivot.add(mesh(new THREE.CylinderGeometry(0.128, 0.122, 0.15, 14), botPlain, 0, -0.03, 0)); // 반바지 자락
      if (bot === 'jeans') pivot.add(mesh(new THREE.CylinderGeometry(0.107, 0.107, 0.05, 14), toon(shade(bottomC, -0.25)), 0, -0.215, 0)); // 걷어 올린 단
      if (bot === 'jogger') {
        pivot.add(mesh(new THREE.CylinderGeometry(0.104, 0.1, 0.06, 14), toon(shade(bottomC, 0.2)), 0, -0.22, 0)); // 발목 고무단
        pivot.add(mesh(new THREE.BoxGeometry(0.016, 0.24, 0.04), toon('#FFFDF7'), s * 0.098, -0.09, 0)); // 옆줄
      }
      if (bot === 'cargo') pivot.add(mesh(new THREE.BoxGeometry(0.03, 0.09, 0.1), toon(shade(bottomC, 0.2)), s * 0.1, -0.1, 0)); // 옆 주머니
      if (bot === 'baji') pivot.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), toon(shade(bottomC, isLight(bottomC) ? 0.35 : -0.4)), 0, -0.22, 0)); // 대님
      this.body.add(pivot);
      this.legs.push(pivot);
    }

    // 몸통
    if (one) {
      const torso = mesh(torsoGeometry(), clothMat);
      this.body.add(torso);
    } else {
      // 상의 (허리 위)와 하의 (엉덩이). 상의가 하의 위에 조금 겹친다
      const hem = TOP_HEM[av.outfit] || 0.42;
      this.body.add(mesh(topGeometry(hem, av.outfit === 'puffer' ? 1.08 : 1), clothMat));
      this.body.add(mesh(hipsGeometry(wideLeg ? 1.06 : 1), botMat));
      if (SKIRTS.has(bot)) {
        const k = SKIRT_PTS[bot];
        const g = lathe(k, k[k.length - 1][1], k[0][1]);
        this.body.add(mesh(g, botMat));
        if (bot === 'tutu') {
          // 발레 치마는 두 겹
          const g2 = lathe([[0.36, 0.47], [0.55, 0.4], [0.66, 0.35], [0.68, 0.33]], 0.33, 0.47);
          this.body.add(mesh(g2, toon(shade(bottomC, -0.3), { side: THREE.DoubleSide })));
        }
      }
    }
    if (av.outfit === 'dress' || av.outfit === 'robe') {
      const skirt = mesh(skirtGeometry(av.outfit === 'robe'), new THREE.MeshToonMaterial({ map: clothTex, gradientMap: toonGradient(), side: THREE.DoubleSide }));
      this.ownMaterials.push(skirt.material);
      this.body.add(skirt);
      if (av.outfit === 'dress') {
        const hemR = mesh(new THREE.TorusGeometry(0.5, 0.028, 6, 40), toon('#FFFDF7'), 0, 0.245, 0);
        hemR.rotation.x = Math.PI / 2;
        this.body.add(hemR);
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
      const pts = [[0.345, 0.62], [0.375, 0.46], [0.41, 0.3], [0.42, 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
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
    if (av.outfit === 'turtle') this.body.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 20), toon(shade(clothC, 0.08)), 0, 0.95, 0)); // 목까지 올라오는 깃
    if (av.outfit === 'puffer') this.body.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 20), toon(shade(clothC, 0.1)), 0, 0.94, 0));
    if (av.outfit === 'blouse') {
      const frill = mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 24), toon('#FFFDF7'), 0, 0.925, 0.01);
      frill.rotation.x = Math.PI / 2;
      frill.scale.set(1, 1, 0.55);
      this.body.add(frill);
    }
    if (av.outfit === 'jeogori') {
      // 고름: 오른쪽 가슴에서 길게 늘어진 두 가닥과 매듭
      const gc = ['#EF6461', '#9E3B4D', '#F6A2C4'].includes(clothC) ? '#30477F' : '#D6455A';
      const gm = toon(gc);
      const knot = mesh(sph(1, 10, 8), gm, 0.07, 0.72, 0.325);
      knot.scale.set(0.045, 0.035, 0.03);
      this.body.add(knot);
      for (const [dx, len, rz] of [[0.04, 0.26, 0.12], [0.1, 0.2, -0.1]]) {
        const r = mesh(new THREE.BoxGeometry(0.045, len, 0.012), gm, 0.07 + dx * 0.4, 0.72 - len / 2, 0.345);
        r.rotation.set(-0.12, 0, rz);
        this.body.add(r);
      }
    }

    // 팔
    this.arms = [];
    const puffy = av.outfit === 'puffer';
    const armGeo = puffy ? new THREE.CapsuleGeometry(0.105, 0.24, 6, 12) : new THREE.CapsuleGeometry(0.085, 0.26, 6, 12);
    const handGeo = sph(0.09, 14, 10);
    const short = SHORT_SLEEVE.has(av.outfit), bare = NO_SLEEVE.has(av.outfit);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.33, 0.84, 0);
      pivot.rotation.z = s * 0.2;
      pivot.add(mesh(armGeo, short || bare ? skin : sleeveMat, 0, -0.2, 0));
      if (av.outfit === 'blouse') { const puff = mesh(sph(1, 14, 10), sleeveMat, 0, -0.04, 0); puff.scale.set(0.135, 0.11, 0.135); pivot.add(puff); } // 퍼프 소매
      else if (short) pivot.add(mesh(new THREE.CylinderGeometry(0.112, 0.105, 0.16, 14), sleeveMat, 0, -0.05, 0));
      if (av.outfit === 'jeogori') pivot.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), toon(['#EF6461', '#9E3B4D', '#F6A2C4'].includes(clothC) ? '#30477F' : '#D6455A'), 0, -0.33, 0)); // 끝동
      if (av.outfit === 'jumper') pivot.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), toon(shade(clothC, 0.1)), 0, -0.33, 0)); // 소매 시보리
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
