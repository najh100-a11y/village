// 진숲 어린이 마을 — 새벽 동굴의 3D 모형
// 동굴 방(마을과 따로 된 장면), 아이가 입는 하나님의 전신갑주, 시험마다 쓰는 것들(문, 징검돌, 그림자, 불화살, 방울, 양)을 만든다.
// 그림자는 무섭지 않게 동글동글한 모양이고, 말씀과 빛에 닿으면 빛 가루로 흩어진다.
import * as THREE from './three.module.min.js';
import { toon } from './avatar.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
export const ARENA_R = 8.4;

// 같은 씨앗이면 같은 차례 (친구와 함께 할 때 모두 같은 시험을 받는다)
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}
// 빛을 받지 않고 늘 환한 재질 (불꽃, 빛, 눈)
const glowCache = new Map();
export function glowMat(color, opacity = 1, add = false) {
  const key = `${color}|${opacity}|${add}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || add, opacity, depthWrite: opacity >= 1 && !add, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  glowCache.set(key, m);
  return m;
}
// 한 물건만 쓰는 재질 (투명도를 바꾸며 사라지게 할 때)
function ownGlow(color, opacity = 1, add = false) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.own = true;
  return m;
}
export function disposeObj(o) {
  if (!o) return;
  o.traverse((x) => {
    if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose();
    const m = x.material;
    if (m && m.userData && m.userData.own) { if (m.map) m.map.dispose(); m.dispose(); }
  });
  o.removeFromParent();
}
const G = {}; // 여러 번 쓰는 모양
function geo(key, make) { if (!G[key]) { G[key] = make(); G[key].userData.keep = true; } return G[key]; }

// ---------- 동굴 방 ----------
const NIGHT = { bg: '#1E1838', fog: '#1E1838', hemiSky: '#B4ACEC', hemiGround: '#3A3258', hemi: 2.4, sun: '#DCD6FF', sunI: 1.7 };
const DAWN = { bg: '#F7B98A', fog: '#F4C79A', hemiSky: '#FFE6C2', hemiGround: '#7A6A8E', hemi: 2.3, sun: '#FFE1B0', sunI: 2.0 };

export function buildCave() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT.bg);
  scene.fog = new THREE.Fog(NIGHT.fog, 24, 60);
  const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, NIGHT.hemi);
  const sun = new THREE.DirectionalLight(NIGHT.sun, NIGHT.sunI);
  sun.position.set(5, 16, 9);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun, sun.target);

  const fixed = new THREE.Group(); // 늘 있는 것: 바닥, 벽, 문, 횃불, 수정
  scene.add(fixed);
  // 바닥: 어두운 돌바닥과 조금 밝은 돌판
  const floor = mk(new THREE.CircleGeometry(ARENA_R + 6, 56), toon('#4A4368'), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;
  fixed.add(floor);
  const r = rngOf(7);
  const tileGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 6);
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * (ARENA_R - 0.6);
    const t = mk(tileGeo, toon(i % 3 ? '#544C78' : '#5E5684'), Math.cos(a) * d, 0.02, Math.sin(a) * d, false);
    t.scale.set(0.6 + r() * 0.9, 1, 0.6 + r() * 0.9);
    t.rotation.y = r() * 3;
    fixed.add(t);
  }
  // 벽: 둥글게 둘러선 바위 (카메라가 있는 남쪽은 낮게)
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMats = [toon('#3A3356'), toon('#453D66'), toon('#514877')];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + r() * 0.08;
    const south = Math.cos(a - Math.PI / 2); // 1이면 남쪽(+z)
    const low = south > 0.55;
    const d = ARENA_R + 1.4 + r() * 1.6 + (low ? 1.2 : 0);
    const s = low ? 0.7 + r() * 0.5 : 1.6 + r() * 1.6;
    const rk = mk(rockGeo, rockMats[i % 3], Math.cos(a) * d, s * 0.55, Math.sin(a) * d);
    rk.scale.set(s * (1 + r() * 0.5), s * (low ? 0.8 : 1.3 + r() * 0.8), s);
    rk.rotation.set(r() * 3, r() * 3, r() * 3);
    if (!(Math.abs(Math.cos(a) * d) < 4.2 && Math.sin(a) < 0)) fixed.add(rk); // 북쪽 문 자리는 비운다 (새벽에 해가 보이게)
  }
  // 위에 매달린 종유석 (북쪽 위로 살짝 보인다)
  const dripGeo = new THREE.ConeGeometry(0.4, 2.2, 6);
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + 0.25 + (i / 11) * (Math.PI - 0.5);
    const d = ARENA_R + 0.8 + r() * 1.5;
    const c = mk(dripGeo, rockMats[i % 3], Math.cos(a) * d, 6.2 + r() * 1.5, Math.sin(a) * d, false);
    c.rotation.x = Math.PI;
    c.scale.setScalar(0.7 + r() * 0.8);
    fixed.add(c);
  }
  // 북쪽 문: 바위 기둥 둘과 위 돌, 안쪽은 어둡다가 방을 통과하면 빛난다
  const gate = new THREE.Group();
  gate.position.set(0, 0, -ARENA_R - 0.6);
  for (const s of [-1, 1]) {
    const p = mk(new THREE.BoxGeometry(1.1, 4.2, 1.1), toon('#4A4266'), s * 1.9, 2.1, 0);
    p.rotation.y = s * 0.12;
    gate.add(p);
  }
  gate.add(mk(new THREE.BoxGeometry(5.0, 1.0, 1.3), toon('#524A70'), 0, 4.5, 0));
  const hole = mk(new THREE.PlaneGeometry(2.7, 4.0), glowMat('#0C0A18'), 0, 2.0, -0.2, false);
  gate.add(hole);
  const holeGlow = mk(new THREE.PlaneGeometry(2.7, 4.0), ownGlow('#FFF3C2', 0), 0, 2.0, -0.15, false);
  gate.add(holeGlow);
  fixed.add(gate);
  // 횃불: 문 양옆 둘, 앞쪽 양옆 둘
  const torches = [];
  const flameGeo = new THREE.ConeGeometry(0.16, 0.5, 8);
  const coreGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
  for (const [x, z, light] of [[-3.3, -ARENA_R + 0.2, true], [3.3, -ARENA_R + 0.2, true], [-ARENA_R + 0.6, 1.5, false], [ARENA_R - 0.6, 1.5, false]]) {
    const t = new THREE.Group();
    t.add(mk(new THREE.CylinderGeometry(0.07, 0.1, 1.9, 6), toon('#6B4429'), 0, 0.95, 0));
    t.add(mk(new THREE.CylinderGeometry(0.2, 0.12, 0.22, 8), toon('#4A3B2E'), 0, 1.95, 0));
    const fl = mk(flameGeo, glowMat('#FF9A3C'), 0, 2.3, 0, false);
    const core = mk(coreGeo, glowMat('#FFF3B0'), 0, 2.22, 0, false);
    t.add(fl, core);
    t.position.set(x, 0, z);
    fixed.add(t);
    let pl = null;
    if (light) { pl = new THREE.PointLight('#FFB066', 14, 11, 1.6); pl.position.set(x, 2.5, z + 0.4); fixed.add(pl); }
    torches.push({ fl, core, pl, ph: r() * 10 });
  }
  // 빛나는 수정 (벽 아래)
  const crysGeo = new THREE.OctahedronGeometry(0.35, 0);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + 0.35 + r() * (Math.PI - 0.7);
    const d = ARENA_R - 0.2 + r() * 0.6;
    const g = new THREE.Group();
    const col = i % 2 ? '#8FD8FF' : '#C9A6FF';
    for (let k = 0; k < 3; k++) {
      const c = mk(crysGeo, glowMat(col, 0.85), (k - 1) * 0.28, 0.35 + k * 0.08, (k % 2) * 0.15, false);
      c.scale.set(0.6, 1.4 + k * 0.3, 0.6);
      c.rotation.z = (k - 1) * 0.35;
      g.add(c);
    }
    g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    fixed.add(g);
  }
  // 새벽 해 (새벽의 방에서 북쪽 문 너머로 떠오른다)
  const dawnSun = mk(new THREE.CircleGeometry(3.2, 40), ownGlow('#FFD27A', 0), 0, -3, -ARENA_R - 6, false);
  fixed.add(dawnSun);
  const rays = mk(new THREE.RingGeometry(3.4, 6.5, 40), ownGlow('#FFE9B8', 0, true), 0, -3, -ARENA_R - 6.1, false);
  fixed.add(rays);

  const props = new THREE.Group(); // 시험마다 바뀌는 것
  scene.add(props);
  const cols = { bg: new THREE.Color(), fog: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() };
  let dawnK = 0, gateK = 0;
  function setDawn(k) {
    dawnK = Math.max(0, Math.min(1, k));
    const mix = (x, y) => cols.a.set(x).lerp(cols.b.set(y), dawnK);
    scene.background.copy(mix(NIGHT.bg, DAWN.bg));
    scene.fog.color.copy(mix(NIGHT.fog, DAWN.fog));
    hemi.color.copy(mix(NIGHT.hemiSky, DAWN.hemiSky));
    hemi.groundColor.copy(mix(NIGHT.hemiGround, DAWN.hemiGround));
    hemi.intensity = NIGHT.hemi + (DAWN.hemi - NIGHT.hemi) * dawnK;
    sun.color.copy(mix(NIGHT.sun, DAWN.sun));
    sun.intensity = NIGHT.sunI + (DAWN.sunI - NIGHT.sunI) * dawnK;
    dawnSun.position.y = -3 + dawnK * 11.5;
    rays.position.y = dawnSun.position.y;
    dawnSun.material.opacity = Math.min(1, dawnK * 1.6);
    rays.material.opacity = Math.max(0, dawnK - 0.4) * 0.8;
    holeGlow.material.opacity = Math.max(gateK, dawnK);
  }
  // 문이 빛난다 (방을 통과했을 때 0→1)
  function setGate(k) { gateK = Math.max(0, Math.min(1, k)); holeGlow.material.opacity = Math.max(gateK, dawnK); }
  function update(dt, t) {
    for (const tc of torches) {
      const f = 1 + Math.sin(t * 13 + tc.ph) * 0.08 + Math.sin(t * 7.3 + tc.ph * 2) * 0.06;
      tc.fl.scale.set(1, f, 1);
      tc.core.scale.set(1, 2 - f, 1);
      if (tc.pl) tc.pl.intensity = 14 * (0.9 + (f - 1) * 1.6);
    }
    rays.rotation.z += dt * 0.15;
  }
  function clearProps() { while (props.children.length) disposeObj(props.children[props.children.length - 1]); }
  return { scene, hemi, sun, props, gate, setDawn, setGate, update, clearProps, get dawn() { return dawnK; } };
}

// ---------- 하나님의 전신갑주 (아바타에 입힌다) ----------
const GOLD = '#F2C94C', GOLD_D = '#D9A63A';
function makePiece(id) {
  const g = new THREE.Group();
  g.userData.armor = id;
  if (id === 'belt') {
    const band = mk(geo('belt', () => new THREE.TorusGeometry(0.372, 0.05, 8, 32)), toon(GOLD), 0, 0, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
    g.add(mk(new THREE.BoxGeometry(0.16, 0.13, 0.05), toon('#FFF1B8', { emissive: '#5A4410' }), 0, 0, 0.38));
    g.position.y = 0.46;
  } else if (id === 'breast') {
    const plate = mk(geo('plate', () => new THREE.SphereGeometry(1, 20, 14)), toon('#FFF0C2', { emissive: '#6B5520' }), 0, 0, 0);
    plate.scale.set(0.27, 0.22, 0.1);
    g.add(plate);
    g.add(mk(new THREE.BoxGeometry(0.045, 0.2, 0.03), toon(GOLD_D), 0, 0.01, 0.095));
    g.add(mk(new THREE.BoxGeometry(0.14, 0.045, 0.03), toon(GOLD_D), 0, 0.045, 0.095));
    g.position.set(0, 0.68, 0.29);
  } else if (id === 'helmet') {
    const dome = mk(geo('helm', () => new THREE.SphereGeometry(0.665, 28, 14, 0, TAU, 0, Math.PI * 0.43)), toon('#CBD5DC'), 0, 0, 0);
    dome.scale.set(1, 0.94, 0.96);
    g.add(dome);
    const rim = mk(geo('helmRim', () => new THREE.TorusGeometry(0.64, 0.05, 8, 36)), toon(GOLD), 0, 0.15, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1, 0.96, 1);
    g.add(rim);
    g.add(mk(new THREE.BoxGeometry(0.07, 0.12, 0.7), toon(GOLD), 0, 0.62, 0)); // 가운데 볏
    g.position.y = 0.06;
  } else if (id === 'shield') {
    const face = mk(geo('shield', () => new THREE.CylinderGeometry(0.34, 0.34, 0.06, 28)), toon('#5BB8F5'), 0, 0, 0);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const rim = mk(geo('shieldRim', () => new THREE.TorusGeometry(0.34, 0.035, 8, 28)), toon(GOLD), 0, 0, 0);
    g.add(rim);
    g.add(mk(new THREE.BoxGeometry(0.07, 0.38, 0.03), toon('#FFFDF7'), 0, 0.02, 0.04));
    g.add(mk(new THREE.BoxGeometry(0.26, 0.07, 0.03), toon('#FFFDF7'), 0, 0.08, 0.04));
  } else if (id === 'sword') {
    g.add(mk(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 8), toon('#8B5E3C'), 0, 0, 0)); // 손잡이
    g.add(mk(new THREE.BoxGeometry(0.26, 0.04, 0.06), toon(GOLD), 0, -0.1, 0)); // 날밑
    const blade = mk(new THREE.BoxGeometry(0.07, 0.62, 0.025), toon('#F4F8FF', { emissive: '#4A5878' }), 0, -0.42, 0);
    g.add(blade);
    const tip = mk(geo('swTip', () => new THREE.ConeGeometry(0.05, 0.12, 4)), toon('#F4F8FF', { emissive: '#4A5878' }), 0, -0.79, 0);
    tip.rotation.x = Math.PI;
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
    g.userData.blade = blade;
  }
  return g;
}
// 평안의 복음의 신: 다리마다 하나씩
function makeShoe() {
  const g = new THREE.Group();
  const s = mk(geo('shoe', () => new THREE.SphereGeometry(1, 14, 10)), toon('#7CC46A', { emissive: '#1E3A14' }), 0, 0, 0);
  s.scale.set(0.14, 0.088, 0.188);
  g.add(s);
  const strap = mk(geo('strap', () => new THREE.TorusGeometry(0.105, 0.02, 6, 18)), toon('#FFFDF7'), 0, 0.05, -0.02);
  strap.rotation.x = Math.PI / 2;
  g.add(strap);
  const wing = mk(new THREE.BoxGeometry(0.02, 0.06, 0.12), toon('#FFFDF7'), 0, 0.06, -0.12);
  wing.rotation.x = -0.5;
  g.add(wing);
  g.position.set(0, -0.29, 0.04);
  return g;
}

// 아바타에 갑주를 입힌다. ids: 입은 갑주 id 목록. 돌려주는 것으로 방패를 들고 내리고, 예수님의 의(흰 옷)를 입힌다
export function dressAvatar(av) {
  const parts = new Map();
  let robe = null;
  const st = { guard: 0, guardTo: 0 }; // 방패를 앞으로 든 정도 (0 옆에 둠, 1 앞에 듦)
  function put(id) {
    if (parts.has(id)) return parts.get(id);
    let o;
    if (id === 'shoes') {
      o = av.legs.map((leg) => { const s = makeShoe(); leg.add(s); return s; });
    } else if (id === 'helmet') { o = makePiece(id); av.head.add(o); }
    else if (id === 'sword') { o = makePiece(id); o.position.set(0, -0.44, 0.06); av.arms[0].add(o); }
    else if (id === 'shield') { o = makePiece(id); av.body.add(o); placeShield(o, 0); }
    else { o = makePiece(id); av.body.add(o); }
    parts.set(id, o);
    return o;
  }
  // 방패: 옆(왼쪽 허리)에 매달려 있다가 막을 때 앞으로 든다
  function placeShield(o, k) {
    o.position.set(0.47 - k * 0.27, 0.62 + k * 0.32, 0.06 + k * 0.42);
    o.rotation.set(0, (1 - k) * 1.25, 0);
  }
  function remove() {
    for (const o of parts.values()) for (const x of [].concat(o)) disposeObj(x);
    parts.clear();
    if (robe) { robe.removeFromParent(); robe = null; }
  }
  // 예수님의 의를 입은 빛 (흰 옷처럼 몸을 감싸는 빛)
  function setRobe(on) {
    if (on && !robe) {
      robe = new THREE.Group();
      const shell = mk(geo('robe', () => new THREE.CylinderGeometry(0.44, 0.6, 1.05, 24, 1, true)), ownGlow('#FFFBEA', 0.32, true), 0, 0.5, 0, false);
      robe.add(shell);
      const halo = mk(geo('robeHalo', () => new THREE.RingGeometry(0.5, 0.78, 32)), ownGlow('#FFF3C2', 0.5, true), 0, 0.03, 0, false);
      halo.rotation.x = -Math.PI / 2;
      robe.add(halo);
      av.body.add(robe);
    } else if (!on && robe) { disposeObj(robe); robe = null; }
  }
  return {
    parts, st,
    put, remove, setRobe,
    has: (id) => parts.has(id),
    robeOn: () => !!robe,
    // 매 화면: 방패를 들고 내리는 것을 부드럽게
    update(dt) {
      st.guard += (st.guardTo - st.guard) * Math.min(1, dt * 16);
      const sh = parts.get('shield');
      if (sh) placeShield(sh, st.guard);
      if (robe) robe.children[0].rotation.y += dt * 0.8;
    },
    // 방패를 든 동안 팔도 앞으로
    armPose(a) {
      if (st.guard > 0.05 && parts.has('shield')) {
        a.arms[1].rotation.x = -1.2 * st.guard;
        a.arms[1].rotation.z = 0.2 - 0.55 * st.guard;
      }
    },
  };
}
// 갑주 받침대 위에 떠 있는 갑주 (갑주의 방)
export function armorDisplay(id) {
  const g = new THREE.Group();
  if (id === 'shoes') {
    const a = makeShoe(), b = makeShoe();
    a.position.set(-0.16, 0, 0); b.position.set(0.16, 0, 0);
    g.add(a, b);
    g.scale.setScalar(2.2);
  } else {
    const p = makePiece(id);
    p.position.set(0, 0, 0);
    if (id === 'sword') { p.rotation.z = Math.PI; p.position.y = -0.3; }
    if (id === 'helmet') p.position.y = -0.3;
    g.add(p);
    g.scale.setScalar(id === 'helmet' ? 1.1 : id === 'belt' ? 1.6 : 1.8);
  }
  return g;
}

// ---------- 받침대, 빛 가루, 문, 징검돌, 그림자 ----------
export function pedestal(color) {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 10), toon('#4B4468'), 0, 0.45, 0));
  g.add(mk(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 10), toon('#5A5280'), 0, 0.95, 0));
  const ring = mk(geo('pedRing', () => new THREE.RingGeometry(0.42, 0.56, 28)), ownGlow(color, 0.75, true), 0, 1.01, 0, false);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

// 빛 가루 (흩어지며 위로 떠올라 사라진다)
export function makeSparks(parent) {
  const list = [];
  const sGeo = geo('spark', () => new THREE.OctahedronGeometry(0.07, 0));
  return {
    burst(pos, color = '#FFF3B0', n = 14, spread = 1, up = 1.4) {
      for (let i = 0; i < n; i++) {
        const m = mk(sGeo, ownGlow(color, 1, true), pos.x, pos.y, pos.z, false);
        const a = Math.random() * TAU, sp = (0.6 + Math.random()) * spread;
        list.push({ m, v: V(Math.cos(a) * sp, up * (0.6 + Math.random()), Math.sin(a) * sp), life: 0.7 + Math.random() * 0.5, max: 1.2 });
        parent.add(m);
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { disposeObj(p.m); list.splice(i, 1); continue; }
        p.m.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(Math.exp(-dt * 1.8));
        p.m.rotation.y += dt * 6;
        p.m.material.opacity = Math.min(1, p.life / 0.4);
      }
    },
    clear() { for (const p of list) disposeObj(p.m); list.length = 0; },
  };
}

// 그림자 (동글동글, 눈이 큰 어둠 친구). kind: 'shadow' 기본, 'archer' 활을 든 그림자
export function makeShadow(kind = 'shadow', size = 1) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshToonMaterial({ color: '#3A2D5C', emissive: '#22163E', transparent: true, opacity: 1 });
  bodyMat.userData.own = true;
  const body = mk(geo('shBody', () => new THREE.SphereGeometry(0.55, 20, 16)), bodyMat, 0, 0.75, 0);
  body.scale.set(1, 1.12, 0.95);
  g.add(body);
  const skirt = mk(geo('shSkirt', () => new THREE.ConeGeometry(0.6, 0.7, 16, 1, true)), bodyMat, 0, 0.32, 0);
  skirt.rotation.x = Math.PI;
  g.add(skirt);
  for (const s of [-1, 1]) {
    const eye = mk(geo('shEye', () => new THREE.SphereGeometry(0.13, 12, 10)), glowMat('#FFFDF7'), s * 0.19, 0.88, 0.45, false);
    eye.scale.set(1, 1.2, 0.6);
    g.add(eye);
    const pup = mk(geo('shPup', () => new THREE.SphereGeometry(0.06, 10, 8)), glowMat('#1A1228'), s * 0.19, 0.86, 0.53, false);
    g.add(pup);
    const nub = mk(geo('shNub', () => new THREE.SphereGeometry(0.14, 10, 8)), bodyMat, s * 0.55, 0.62, 0.05);
    g.add(nub);
  }
  if (kind === 'archer') {
    const bow = mk(geo('bow', () => new THREE.TorusGeometry(0.42, 0.03, 6, 20, Math.PI)), toon('#6B4429'), 0.35, 0.75, 0.35);
    bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
    g.add(bow);
  }
  g.scale.setScalar(size);
  g.userData.body = body;
  g.userData.mat = bodyMat;
  return g;
}
// 그림자가 둥실둥실 (t: 시간)
export function bobShadow(g, t, ph = 0) {
  const b = g.userData.body;
  b.position.y = 0.75 + Math.sin(t * 3 + ph) * 0.05;
  b.scale.set(1 + Math.sin(t * 6 + ph) * 0.03, 1.12 - Math.sin(t * 6 + ph) * 0.03, 0.95);
}

// 갈림길 문 (돌 기둥 둘, 위 돌, 어두운 문 안)
export function makeDoor() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.4, 2.6, 0.5), toon('#5A5280'), s * 0.85, 1.3, 0));
  g.add(mk(new THREE.BoxGeometry(2.2, 0.45, 0.6), toon('#645B8C'), 0, 2.72, 0));
  const inMat = new THREE.MeshBasicMaterial({ color: '#141022', transparent: true, opacity: 1 });
  inMat.userData.own = true;
  const inner = mk(new THREE.PlaneGeometry(1.3, 2.5), inMat, 0, 1.25, -0.05, false);
  g.add(inner);
  g.userData.inner = inner;
  return g;
}
// 징검돌
export function makeStone() {
  const m = new THREE.MeshToonMaterial({ color: '#6E6690', emissive: '#000000' });
  m.userData.own = true;
  const s = mk(geo('stone', () => new THREE.CylinderGeometry(0.62, 0.7, 0.3, 10)), m, 0, 0.08, 0);
  return s;
}
// 불화살
export function makeArrow() {
  const g = new THREE.Group();
  const shaft = mk(geo('shaft', () => new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6)), toon('#7A5233'), 0, 0, 0, false);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const fire = mk(geo('fire', () => new THREE.SphereGeometry(0.2, 12, 10)), glowMat('#FF8A3C', 0.9, true), 0, 0, 0.45, false);
  fire.scale.set(1, 1, 1.6);
  g.add(fire);
  g.add(mk(geo('fireCore', () => new THREE.SphereGeometry(0.1, 10, 8)), glowMat('#FFF0A0'), 0, 0, 0.45, false));
  g.userData.fire = fire;
  return g;
}
// 의심 방울(어둡다)과 약속 방울(환하다)
export function makeBubble(good) {
  const m = good ? new THREE.MeshBasicMaterial({ color: '#FFE58A', transparent: true, opacity: 0.85 }) : new THREE.MeshToonMaterial({ color: '#4A3A72', emissive: '#1E1438', transparent: true, opacity: 0.92 });
  m.userData.own = true;
  const g = new THREE.Group();
  g.add(mk(geo('bub', () => new THREE.SphereGeometry(0.42, 18, 14)), m, 0, 0, 0, false));
  g.add(mk(geo('bubHi', () => new THREE.SphereGeometry(0.09, 8, 6)), glowMat('#FFFFFF', 0.8), -0.15, 0.16, 0.33, false));
  if (good) g.add(mk(geo('bubGlow', () => new THREE.SphereGeometry(0.6, 16, 12)), glowMat('#FFF3C2', 0.25, true), 0, 0, 0, false));
  g.userData.mat = m;
  return g;
}
// 길 잃은 양
export function makeLamb() {
  const g = new THREE.Group();
  const wool = toon('#FFFDF7'), dark = toon('#4A4452');
  const puff = geo('wool', () => new THREE.SphereGeometry(0.26, 12, 10));
  for (const [x, y, z] of [[0, 0.55, 0], [0.2, 0.6, 0.1], [-0.2, 0.6, 0.1], [0.15, 0.62, -0.2], [-0.15, 0.62, -0.2], [0, 0.75, 0]]) g.add(mk(puff, wool, x, y, z));
  const head = mk(new THREE.SphereGeometry(0.2, 12, 10), dark, 0, 0.72, 0.38);
  head.scale.set(0.9, 1, 1.1);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.SphereGeometry(0.08, 8, 6), dark, s * 0.2, 0.78, 0.33);
    ear.scale.set(1.6, 0.6, 0.8);
    g.add(ear);
    g.add(mk(new THREE.SphereGeometry(0.035, 8, 6), glowMat('#FFFFFF'), s * 0.08, 0.76, 0.55, false));
  }
  for (const [x, z] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.18], [-0.15, -0.18]]) g.add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), dark, x, 0.2, z));
  return g;
}
// 밝은 빛 기둥 (빛 가운데 서기): 바닥 빛 원과 위로 퍼지는 빛
export function makeLightPool(r) {
  const g = new THREE.Group();
  const disc = mk(new THREE.CircleGeometry(r, 40), ownGlow('#FFF4C2', 0.42, true), 0, 0.075, 0, false);
  disc.rotation.x = -Math.PI / 2;
  g.add(disc);
  const rim = mk(new THREE.RingGeometry(r * 0.94, r, 48), ownGlow('#FFFFFF', 0.85, true), 0, 0.085, 0, false);
  rim.rotation.x = -Math.PI / 2;
  g.add(rim);
  const col = mk(new THREE.CylinderGeometry(r * 0.75, r, 7, 32, 1, true), ownGlow('#FFF6D8', 0.13, true), 0, 3.5, 0, false);
  g.add(col);
  return g;
}
// 떨어지는 참소 덩어리와 바닥 경고 원
export function makeBlob() {
  const m = new THREE.MeshToonMaterial({ color: '#2B2240', emissive: '#1A1230', transparent: true, opacity: 0.95 });
  m.userData.own = true;
  const b = mk(geo('blob', () => new THREE.SphereGeometry(0.32, 14, 12)), m, 0, 0, 0);
  b.scale.set(1, 1.2, 1);
  return b;
}
export function makeWarn() {
  const w = mk(geo('warn', () => new THREE.RingGeometry(0.42, 0.55, 28)), ownGlow('#B04A7A', 0.7), 0, 0.08, 0, false);
  w.rotation.x = -Math.PI / 2;
  return w;
}
// 어둠의 물결 (새벽의 방): 옆으로 길게 늘어선 어둠 덩어리들
export function makeWave(width = 9) {
  const g = new THREE.Group();
  const m = new THREE.MeshToonMaterial({ color: '#251D3C', emissive: '#140E26', transparent: true, opacity: 0.92 });
  m.userData.own = true;
  const n = Math.round(width / 0.7);
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (i + 0.5) * (width / n);
    const s = mk(geo('waveBall', () => new THREE.SphereGeometry(0.55, 12, 10)), m, x, 0.5 + Math.sin(i * 1.7) * 0.15, Math.cos(i * 2.3) * 0.15);
    s.scale.set(1, 1.1 + (i % 3) * 0.2, 0.9);
    g.add(s);
  }
  g.userData.mat = m;
  return g;
}
// 펼친 성경이 놓인 말씀 받침 (갑주의 방 가운데)
export function makeBibleStand() {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), toon('#8B5E3C'), 0, 0.55, 0));
  const top = mk(new THREE.BoxGeometry(0.9, 0.06, 0.62), toon('#7A5233'), 0, 1.12, 0);
  top.rotation.x = -0.35;
  g.add(top);
  for (const s of [-1, 1]) {
    const page = mk(new THREE.BoxGeometry(0.38, 0.03, 0.5), toon('#FFFBEA', { emissive: '#4A4020' }), s * 0.2, 1.17, 0.01);
    page.rotation.x = -0.35;
    page.rotation.z = s * -0.06;
    g.add(page);
  }
  return g;
}
