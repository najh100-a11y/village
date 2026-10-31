// 진숲 어린이 마을 — 마을 안에서 하는 3D 놀이 (낚시, 오목, 요리, 그림 이젤)
// 창을 따로 띄우지 않고 내 주민이 그 자리에 가서 직접 한다. 친구들 화면에도 그 모습이 보인다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { h, icon, modal, toast, confetti, josa } from './ui.js';
import { message } from './api.js';
import { sfx } from './sound.js';
import { fishById, SHADOW_LEN, RARITY, RECIPES, INGREDIENTS, FISH, FRIDGE, NO_CUT, COOK_KIND, ingInfo, dishName } from './play-data.js';
import { cleanChat } from './chatfilter.js';
import { aiMove, lineAt } from './omok.js';
import { friendPicker, waitInvite } from './play.js';
import { renderFishBook } from './fishing.js';

// ---------- 도우미 ----------
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ingName = (id) => (INGREDIENTS[id] || [id])[0];

function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function ownMat(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  m.userData.own = true;
  return m;
}
function basicMat(color, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  m.userData.own = true;
  return m;
}
function disposeTree(o) {
  if (!o) return;
  o.traverse((x) => {
    if (x.geometry) x.geometry.dispose();
    const m = x.material;
    if (m && m.userData && m.userData.own) { if (m.map) m.map.dispose(); m.dispose(); }
  });
  o.removeFromParent();
}
function canvasTex(w, hh, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  draw(c.getContext('2d'), w, hh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// 놀이 장소 기준 좌표 → 마을 좌표
function spotPoint(sp, lx, ly, lz) {
  const c = Math.cos(sp.rot), s = Math.sin(sp.rot);
  return V(sp.x + lx * c + lz * s, ly, sp.z - lx * s + lz * c);
}
const mixColor = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(k));

// ---------- 자세 ----------
const SEAT_Y = 0.25;
function seatPose(st) {
  return (av, dt) => {
    av.legs[0].rotation.x = av.legs[1].rotation.x = -1.45;
    av.body.position.y = 0;
    if (st.cheer > 0) {
      st.cheer = Math.max(0, st.cheer - dt);
      av.arms[0].rotation.x = av.arms[1].rotation.x = -2.9;
      av.arms[0].rotation.z = -0.3; av.arms[1].rotation.z = 0.3;
      return;
    }
    av.arms[0].rotation.x = -1.05;
    let a = -1.05;
    if (st.reach > 0) {
      st.reach = Math.max(0, st.reach - dt * 2.4);
      a -= Math.sin((1 - st.reach) * Math.PI) * 0.55;
    }
    av.arms[1].rotation.x = a;
  };
}
const cheerPose = (av, dt, t) => {
  av.arms[0].rotation.x = av.arms[1].rotation.x = -2.95;
  av.arms[0].rotation.z = -0.25; av.arms[1].rotation.z = 0.25;
  av.body.position.y = Math.abs(Math.sin(t * 6)) * 0.05;
};
// 잡은 것을 두 손으로 앞에 들어 보이기
const showPose = (av, dt, t) => {
  av.arms[0].rotation.x = av.arms[1].rotation.x = -1.3;
  av.arms[0].rotation.z = 0.42; av.arms[1].rotation.z = -0.42;
  av.body.position.y = Math.abs(Math.sin(t * 5)) * 0.04;
};
// 아바타 앞쪽 손 높이의 한 점
function handFront(av, fwd = 0.5, up = 1.0) {
  const r = av.root.rotation.y, p = av.root.position;
  return V(p.x + Math.sin(r) * fwd, p.y + up + av.body.position.y, p.z + Math.cos(r) * fwd);
}
const workPose = (av, dt, t) => {
  av.arms[0].rotation.x = -1.0 + Math.sin(t * 9) * 0.3;
  av.arms[1].rotation.x = -1.0 - Math.sin(t * 9) * 0.3;
};
const restPose = (av) => {
  av.arms[0].rotation.x = -0.35; av.arms[1].rotation.x = -0.35;
  av.arms[0].rotation.z = 0.25; av.arms[1].rotation.z = -0.25;
};
export const rodPose = (av) => {
  av.arms[1].rotation.x = -1.05; av.arms[1].rotation.z = 0.05;
  av.arms[0].rotation.x = -0.8; av.arms[0].rotation.z = 0.35;
};

// ---------- 화면 위 단추와 말풍선 ----------
class GameUI {
  constructor(village) {
    this.v = village;
    this.root = document.getElementById('gameUi');
  }
  open({ name, onExit, side = [] }) {
    document.body.classList.add('in-game');
    this.root.hidden = false;
    this.nameEl = h('span', { class: 'g-name' }, name);
    this.sayEl = h('div', { class: 'g-say', 'aria-live': 'polite' });
    this.main = h('button', { class: 'g-main', type: 'button', 'data-quiet': '' });
    this.main.addEventListener('click', () => { if (this.onMain && !this.main.disabled) this.onMain(); });
    this.bannerEl = h('div', { class: 'g-banner', role: 'status' });
    this.panel = h('div', { class: 'g-panel' });
    const exit = h('button', { class: 'round', type: 'button', onclick: onExit }, icon('door'), '그만');
    const sides = side.map(([ic, label, fn]) => h('button', { class: 'round', type: 'button', onclick: fn }, icon(ic), label));
    this.root.replaceChildren(h('div', { class: 'g-top' }, this.nameEl, this.sayEl), this.bannerEl, this.panel,
      h('div', { class: 'g-bottom' }, h('div', { class: 'g-side' }, ...sides), this.main, h('div', { class: 'g-side' }, exit)));
  }
  say(t, name) { this.sayEl.textContent = t; if (name) this.nameEl.textContent = name; }
  setMain(label, { disabled = false, pulse = false, hidden = false, onClick } = {}) {
    this.main.textContent = label;
    this.main.disabled = disabled;
    this.main.hidden = hidden;
    this.main.classList.toggle('pulse', pulse && !disabled);
    if (onClick !== undefined) this.onMain = onClick;
  }
  setPanel(...els) { this.panel.replaceChildren(...els.flat().filter(Boolean)); }
  banner(big, small = '', ms = 2600) {
    this.bannerEl.replaceChildren(h('b', {}, big), small ? h('span', {}, small) : '');
    this.bannerEl.classList.add('show');
    clearTimeout(this.bt);
    this.bt = setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }
  label(text) {
    const el = h('div', { class: 'g-label' }, text);
    el.style.display = 'none';
    this.root.append(el);
    return el;
  }
  place(el, pos, yOff = 0) { this.v.placeLabel(el, pos, yOff); }
  close() {
    clearTimeout(this.bt);
    document.body.classList.remove('in-game');
    this.root.hidden = true;
    this.root.replaceChildren();
    this.onMain = null;
  }
}

// ---------- 모형 ----------
export function makeRod() {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.011, 0.02, 1.5, 6), toon('#7A5233'), 0, 0.75, 0));
  g.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), toon('#EF6461'), 0, 0.05, 0));
  const reel = mk(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), toon('#B7B4AC'), 0.045, 0.2, 0);
  reel.rotation.z = Math.PI / 2;
  g.add(reel);
  const tip = new THREE.Object3D();
  tip.position.set(0, 1.5, 0);
  g.add(tip);
  g.rotation.x = 2.0;
  g.userData.tip = tip;
  g.userData.isRod = true;
  return g;
}
function makeSpoon() {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.018, 0.022, 0.7, 6), toon('#A06E45'), 0, 0.3, 0));
  const bowl = mk(new THREE.SphereGeometry(0.06, 10, 8), toon('#A06E45'), 0, -0.06, 0);
  bowl.scale.set(1, 0.5, 1.4);
  g.add(bowl);
  return g;
}
function makeBrush() {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.014, 0.018, 0.34, 6), toon('#E9B949'), 0, 0.17, 0));
  g.add(mk(new THREE.ConeGeometry(0.03, 0.08, 8), toon('#EF6461'), 0, 0.37, 0));
  g.rotation.x = 1.6;
  return g;
}

// 물고기 (머리가 -x, 꼬리가 +x)
function makeFish3D(f, len = 0.5) {
  const g = new THREE.Group();
  if (!f || f.rarity < 0) {
    if (f && f.id === 'can') {
      g.add(mk(new THREE.CylinderGeometry(len * 0.2, len * 0.2, len * 0.55, 14), toon('#A9B4BE')));
      g.add(mk(new THREE.CylinderGeometry(len * 0.205, len * 0.205, len * 0.18, 14), toon('#EF6461')));
      g.rotation.z = 0.5;
    } else {
      const boot = toon('#6B4B3A');
      g.add(mk(new THREE.BoxGeometry(len * 0.26, len * 0.55, len * 0.26), boot, 0, len * 0.1, 0));
      g.add(mk(new THREE.BoxGeometry(len * 0.5, len * 0.18, len * 0.27), boot, len * 0.12, -len * 0.18, 0));
      g.rotation.z = -0.3;
    }
    return g;
  }
  const L = f.long ? len * 1.15 : len;
  const H = f.long ? len * 0.17 : f.id === 'goldfish' ? len * 0.42 : len * 0.32;
  const body = mk(new THREE.SphereGeometry(0.5, 20, 14), f.mat || toon(f.body));
  body.scale.set(L * 0.84, H, H * 0.6);
  g.add(body);
  const finM = toon(f.fin);
  const tail = mk(new THREE.ConeGeometry(H * 0.55, L * 0.3, 4), finM, L * 0.5, 0, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.25;
  g.add(tail);
  const dorsal = mk(new THREE.ConeGeometry(H * 0.25, H * 0.5, 4), finM, -L * 0.02, H * 0.5, 0);
  dorsal.scale.z = 0.25;
  dorsal.rotation.z = -0.4;
  g.add(dorsal);
  if (f.stripe) { const st = mk(new THREE.SphereGeometry(0.5, 16, 8), toon(f.stripe)); st.scale.set(L * 0.7, H * 0.25, H * 0.62); g.add(st); }
  if (f.spots) for (let i = 0; i < 6; i++) g.add(mk(new THREE.SphereGeometry(H * 0.07, 6, 5), toon(f.spots), -L * 0.18 + i * L * 0.08, (i % 2 ? -1 : 1) * H * 0.12, H * 0.28));
  for (const s of [-1, 1]) {
    g.add(mk(new THREE.SphereGeometry(H * 0.13, 10, 8), toon('#FFFFFF'), -L * 0.28, H * 0.12, s * H * 0.24));
    g.add(mk(new THREE.SphereGeometry(H * 0.07, 8, 6), toon('#2E2A2A'), -L * 0.3, H * 0.12, s * H * 0.3));
  }
  if (f.whisker) for (const s of [-1, 1]) {
    const w = mk(new THREE.CylinderGeometry(0.006, 0.006, L * 0.3, 4), toon('#2E2A2A'), -L * 0.48, -H * 0.05, s * H * 0.15);
    w.rotation.z = Math.PI / 2 + s * 0.4;
    g.add(w);
  }
  return g;
}

// 요리 재료 모형 (조리대 위에 올려 놓는 크기)
function makeIngredient(id) {
  const g = new THREE.Group();
  const col = (INGREDIENTS[id] || ['', '#DDD'])[1];
  if (id && id.startsWith('fish_')) {
    const f = fishById(id.slice(5));
    const m = makeFish3D(f || fishById('crucian'), 0.3);
    m.position.y = 0.06;
    g.add(m);
    return g;
  }
  if (id === 'potato') {
    for (const [x, z, r] of [[0, 0, 0.08], [0.05, 0.03, 0.06], [-0.05, -0.02, 0.055]]) { const b = mk(new THREE.SphereGeometry(r, 10, 8), toon(col), x, r * 0.8, z); b.scale.set(1.2, 0.85, 1); g.add(b); }
    return g;
  }
  if (id === 'carrot') {
    const c = mk(new THREE.ConeGeometry(0.045, 0.26, 10), toon(col), 0, 0.045, 0);
    c.rotation.z = Math.PI / 2;
    g.add(c);
    for (const a of [-0.4, 0, 0.4]) { const l = mk(new THREE.ConeGeometry(0.015, 0.1, 5), toon('#5DB760'), -0.16, 0.05 + a * 0.05, a * 0.04); l.rotation.z = Math.PI / 2 + a; g.add(l); }
    return g;
  }
  if (id === 'onion') {
    const o = mk(new THREE.SphereGeometry(0.075, 14, 10), toon(col), 0, 0.075, 0);
    o.scale.y = 0.9;
    g.add(o);
    g.add(mk(new THREE.ConeGeometry(0.02, 0.06, 6), toon('#C9A87A'), 0, 0.16, 0));
    return g;
  }
  if (id === 'tomato') {
    const t = mk(new THREE.SphereGeometry(0.075, 14, 10), toon(col), 0, 0.07, 0);
    t.scale.y = 0.85;
    g.add(t);
    const star = mk(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 5), toon('#5DB760'), 0, 0.135, 0);
    g.add(star);
    return g;
  }
  if (id === 'mushroom') {
    g.add(mk(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 10), toon('#F1E3C4'), 0, 0.04, 0));
    g.add(mk(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(col), 0, 0.075, 0));
    return g;
  }
  if (id === 'cabbage') {
    g.add(mk(new THREE.SphereGeometry(0.09, 14, 10), toon(col), 0, 0.085, 0));
    for (let i = 0; i < 4; i++) { const l = mk(new THREE.SphereGeometry(0.06, 10, 6), toon('#8CC56E'), Math.cos(i * 1.6) * 0.05, 0.06, Math.sin(i * 1.6) * 0.05); l.scale.y = 0.5; g.add(l); }
    return g;
  }
  if (id === 'paprika') {
    for (const a of [0, 2.1, 4.2]) g.add(mk(new THREE.SphereGeometry(0.05, 10, 8), toon(col), Math.cos(a) * 0.025, 0.07, Math.sin(a) * 0.025));
    g.add(mk(new THREE.CylinderGeometry(0.01, 0.012, 0.04, 6), toon('#5DB760'), 0, 0.14, 0));
    return g;
  }
  if (id === 'rice' || id === 'manna') {
    g.add(mk(new THREE.CylinderGeometry(0.085, 0.06, 0.06, 16), toon(id === 'rice' ? '#8FCBEB' : '#E9C88F'), 0, 0.03, 0));
    const top = mk(new THREE.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(col), 0, 0.055, 0);
    top.scale.y = 0.5;
    g.add(top);
    return g;
  }
  if (id === 'apple') {
    g.add(mk(new THREE.SphereGeometry(0.08, 14, 10), toon(col), 0, 0.08, 0));
    g.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 5), toon('#6B4429'), 0, 0.17, 0));
    const leaf = mk(new THREE.SphereGeometry(0.03, 8, 6), toon('#6CC24A'), 0.03, 0.18, 0);
    leaf.scale.set(1.4, 0.4, 0.8);
    g.add(leaf);
  } else if (id === 'grape') {
    const rows = [[-0.06, 0, 0.06], [-0.03, 0.03], [0]];
    rows.forEach((row, ri) => row.forEach((x) => g.add(mk(new THREE.SphereGeometry(0.035, 10, 8), toon(col), x, 0.16 - ri * 0.05, 0))));
    g.add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 5), toon('#6B4429'), 0, 0.21, 0));
  } else if (id === 'egg') {
    const e = mk(new THREE.SphereGeometry(0.055, 14, 10), toon(col), 0, 0.07, 0);
    e.scale.y = 1.3;
    g.add(e);
  } else if (id === 'bread') {
    const b = mk(new THREE.SphereGeometry(0.09, 14, 10), toon(col), 0, 0.06, 0);
    b.scale.set(1.35, 0.7, 0.95);
    g.add(b);
    for (const dx of [-0.05, 0, 0.05]) g.add(mk(new THREE.BoxGeometry(0.012, 0.01, 0.08), toon('#B9803D'), dx, 0.122, 0));
  } else if (id === 'fish') {
    const f = makeFish3D({ id: 'food', rarity: 0, body: col, fin: '#7FAFD0' }, 0.24);
    f.position.y = 0.05;
    g.add(f);
  } else if (id === 'water' || id === 'honey') {
    g.add(mk(new THREE.CylinderGeometry(0.06, 0.07, 0.17, 14), toon(col), 0, 0.085, 0));
    g.add(mk(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), toon(id === 'honey' ? '#B9803D' : '#FFFDF7'), 0, 0.185, 0));
  } else if (id === 'yeast') {
    g.add(mk(new THREE.CylinderGeometry(0.08, 0.05, 0.06, 14), toon('#E8D9BF'), 0, 0.03, 0));
    const lump = mk(new THREE.SphereGeometry(0.06, 12, 8), toon(col), 0, 0.065, 0);
    lump.scale.y = 0.5;
    g.add(lump);
  } else {
    // 자루 (렌틸콩, 밀가루)
    const sackC = id === 'lentil' ? '#D8C3A0' : col;
    const sack = mk(new THREE.SphereGeometry(0.09, 14, 10), toon(sackC), 0, 0.09, 0);
    sack.scale.set(1, 1.15, 1);
    g.add(sack);
    g.add(mk(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 10), toon(sackC), 0, 0.2, 0));
    const tie = mk(new THREE.TorusGeometry(0.035, 0.008, 6, 12), toon('#A06E45'), 0, 0.19, 0);
    tie.rotation.x = Math.PI / 2;
    g.add(tie);
    if (id === 'lentil') for (let i = 0; i < 6; i++) g.add(mk(new THREE.SphereGeometry(0.017, 6, 5), toon(col), (i % 3 - 1) * 0.025, 0.215, (i < 3 ? -1 : 1) * 0.012));
  }
  return g;
}

function makeBasket(r = 0.2) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshToonMaterial({ color: '#C99862', gradientMap: toonGradient(), side: THREE.DoubleSide });
  wallMat.userData.own = true;
  g.add(mk(new THREE.CylinderGeometry(r, r * 0.78, r * 0.75, 18, 1, true), wallMat, 0, r * 0.375, 0));
  const bottom = mk(new THREE.CircleGeometry(r * 0.78, 18), toon('#B07F4E'), 0, 0.01, 0);
  bottom.rotation.x = -Math.PI / 2;
  g.add(bottom);
  const rim = mk(new THREE.TorusGeometry(r, 0.018, 6, 24), toon('#A06E45'), 0, r * 0.75, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  g.add(mk(new THREE.TorusGeometry(r * 0.8, 0.014, 6, 20, Math.PI), toon('#A06E45'), 0, r * 0.75, 0));
  return g;
}

function makeDish(r) {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.27, 0.21, 0.045, 24), toon('#8FCBEB')));
  const rim = mk(new THREE.TorusGeometry(0.255, 0.014, 6, 28), toon('#FFFDF7'), 0, 0.022, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  if (r.id === 'barley') {
    g.add(makeBasket(0.2));
    for (let i = 0; i < 5; i++) { const br = makeIngredient('bread'); br.scale.setScalar(0.75); br.position.set(-0.1 + (i % 3) * 0.1, 0.06 + Math.floor(i / 3) * 0.06, (i % 2 ? 0.04 : -0.04)); g.add(br); }
    for (let i = 0; i < 2; i++) { const f = makeIngredient('fish'); f.scale.setScalar(0.7); f.position.set(-0.05 + i * 0.1, 0.15, 0); g.add(f); }
  } else if (r.id === 'fishbread') {
    const f = makeIngredient('fish'); f.position.set(-0.07, 0.02, 0); g.add(f);
    const b = makeIngredient('bread'); b.position.set(0.1, 0.02, 0.04); g.add(b);
  } else if (r.id === 'lentil') {
    g.add(mk(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 18), toon('#FFF3DA'), 0, 0.08, 0));
    g.add(mk(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 18), toon(r.color), 0, 0.13, 0));
  } else if (r.id === 'matzah') {
    g.add(mk(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20), toon(r.color), 0, 0.035, 0));
    for (let i = -2; i <= 2; i++) g.add(mk(new THREE.BoxGeometry(0.3, 0.004, 0.01), toon('#C9A060'), 0, 0.05, i * 0.06));
  } else {
    for (let i = 0; i < 6; i++) {
      const rr = i ? 0.12 : 0;
      g.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), toon(r.color), Math.cos(i) * rr, 0.04 + (i ? 0 : 0.03), Math.sin(i) * rr));
    }
  }
  return g;
}

// 마음대로 요리한 음식 (마을 식탁과 완성 화면에서 같이 쓴다)
function seeded(seed) { let x = (seed * 9301 + 49297) % 233280; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
function avgColor(cols) {
  const c = new THREE.Color(0, 0, 0);
  cols.forEach((h0) => c.add(new THREE.Color(h0)));
  return c.multiplyScalar(1 / Math.max(1, cols.length));
}
export function makeFreeDish(kind, items, seed = 1, done = 1) {
  const g = new THREE.Group();
  const rnd = seeded(Math.abs(Math.floor(seed)) % 233280 || 7);
  const infos = items.map(ingInfo).filter(Boolean);
  const brown = kind === 'grill' ? '#8A5A2B' : '#B9772F';
  const cookK = kind === 'fry' ? 0.32 * done : kind === 'grill' ? 0.45 * done : 0;
  if (kind === 'soup') {
    g.add(mk(new THREE.CylinderGeometry(0.2, 0.13, 0.13, 22), toon('#FFF3DA'), 0, 0.065, 0));
    const broth = avgColor(infos.map((i) => i.piece)).lerp(new THREE.Color('#E8C98F'), 0.45);
    const top = mk(new THREE.CylinderGeometry(0.18, 0.18, 0.01, 22), ownMat(broth), 0, 0.125, 0);
    g.add(top);
    infos.forEach((inf, k) => {
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2, r = rnd() * 0.12;
        const p = mk(new THREE.BoxGeometry(0.035, 0.02, 0.035), toon(inf.piece), Math.cos(a) * r, 0.132, Math.sin(a) * r);
        p.rotation.y = rnd() * 3;
        g.add(p);
      }
    });
    return g;
  }
  g.add(mk(new THREE.CylinderGeometry(0.27, 0.21, 0.045, 24), toon('#8FCBEB')));
  const rim = mk(new THREE.TorusGeometry(0.255, 0.014, 6, 28), toon('#FFFDF7'), 0, 0.022, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  if (kind === 'salad') g.add(mk(new THREE.CylinderGeometry(0.17, 0.12, 0.02, 18), toon('#B5D86A'), 0, 0.03, 0));
  let n = 0;
  infos.forEach((inf) => {
    const col = new THREE.Color(inf.piece).lerp(new THREE.Color(brown), cookK);
    const mat = ownMat(col);
    if (inf.fish) {
      const f = makeFish3D({ ...inf.fish, mat: ownMat(new THREE.Color(inf.fish.body).lerp(new THREE.Color(brown), cookK)) }, 0.26);
      f.position.set((rnd() - 0.5) * 0.12, 0.07, (rnd() - 0.5) * 0.1);
      f.rotation.y = rnd() * 3;
      g.add(f);
      n += 3;
      return;
    }
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.15;
      const p = mk(i % 2 ? new THREE.BoxGeometry(0.05, 0.03, 0.05) : new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), mat, Math.cos(a) * r, 0.045 + (n % 3) * 0.012 + rnd() * 0.02, Math.sin(a) * r);
      p.rotation.set(rnd() * 0.6, rnd() * 3, rnd() * 0.6);
      g.add(p);
      n++;
    }
  });
  return g;
}

// 화면 좌표 구하기
function screenOf(v, p) {
  const q = p.clone().project(v.camera);
  const r = v.canvas.getBoundingClientRect();
  return { x: r.left + (q.x * 0.5 + 0.5) * r.width, y: r.top + (-q.y * 0.5 + 0.5) * r.height };
}

const TAP_LABEL = { mill: '갈기!', fire: '부채질!', dough: '반죽!', share: '나눠 주기!' };
const starsOf = (avg) => (avg >= 0.85 ? 3 : avg >= 0.6 ? 2 : 1);
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ======================================================================
export function createPlay3D(ctx) {
  const { village: v, rpc, getToken, onSessionLost, onCelebrate, setActivity, setScene, hub, onlineFriends } = ctx;
  const ui = new GameUI(v);
  v.buildDish = makeFreeDish; // 마을 식탁 접시 그리기
  let cur = null; // 지금 하는 놀이 { id, game }
  let menuTok = 0;

  const lost = (e) => {
    if (e && e.code === 'SESSION') { stopAll(); modal.close(); onSessionLost(); return true; }
    return false;
  };
  const portrait = () => v.camera.aspect < 1;
  function camAt(sp, pos, look, k = 1.35) {
    const P = spotPoint(sp, ...pos), L = spotPoint(sp, ...look);
    if (portrait()) P.sub(L).multiplyScalar(k).add(L);
    return { pos: P, look: L };
  }
  const live = (game) => !!cur && cur.game === game;

  function begin(id, name, game, side = []) {
    cur = { id, game };
    v.enterGame(game);
    ui.open({ name, onExit: () => stopAll(), side });
    setActivity(id);
    setScene('game');
  }
  function stopAll() {
    if (!cur) return;
    const g = cur;
    cur = null;
    try { g.game.stop(); } catch (e) { console.error(e); }
    v.exitGame();
    ui.close();
    setActivity('');
    setScene('village');
  }

  // 친구 화면 꾸미기: 낚시하는 친구는 낚싯대를 들고 데크에 서고, 오목 두는 친구는 의자에 앉는다
  function nearest(points, p) {
    let best = null, bd = Infinity;
    for (const q of points) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
    return best && { ...best, d: bd };
  }
  function decorateRemote(r, act, hint) {
    const av = r.av;
    if (r.pin && !r.pin.auto) return; // 나와 함께 노는 친구는 놀이가 자리를 정한다
    const p = hint || r.target || av.root.position;
    if (act === 'fish') {
      if (!av.held || !av.held.obj.userData.isRod) av.hold(makeRod());
      av.pose = rodPose;
      const s = nearest(fishStands(), p);
      if (s && s.d < 1.6) v.pinRemote(r.id, { x: s.x, y: 0.2, z: s.z, rot: -Math.PI / 2, pose: rodPose, auto: true });
      return;
    }
    if (act === 'omok') {
      const s = nearest(omokSeats(), p);
      if (s && s.d < 1.6) v.pinRemote(r.id, { x: s.x, y: SEAT_Y, z: s.z, rot: s.rot, pose: seatPose({}), auto: true });
      return;
    }
    if (r.pin && r.pin.auto) v.unpinRemote(r.id);
    if (av.held && av.held.obj.userData.isRod) { const o = av.held.obj; av.drop(); disposeTree(o); }
    if (av.pose === rodPose) av.pose = null;
  }

  // =====================================================================
  // 낚시
  // =====================================================================
  const POND = { x: -9.5, z: 13, rx: 3.6, rz: 3.06 };
  const CAM_F = [3.4, 6.4, 5.0]; // 낚시 카메라: 아이 뒤쪽 옆 높은 곳에서 연못을 내려다본다 (머리가 찌를 가리지 않게)
  function fishStands() {
    const sp = v.spots.fish;
    return [[0.36, -1.85], [-0.36, -1.85]].map(([lx, lz]) => spotPoint(sp, lx, 0.2, lz));
  }

  function fishing() {
    stopAll();
    const pl = v.player;
    const stands = fishStands();
    let stand = stands[0];
    for (const s of stands) {
      const busy = [...v.remotes.values()].some((r) => Math.hypot(r.av.root.position.x - s.x, r.av.root.position.z - s.z) < 0.5);
      if (!busy) { stand = s; break; }
    }
    const grp = new THREE.Group();
    v.scene.add(grp);
    v.placePlayer(stand.x, stand.z, -Math.PI / 2, 0.2);
    const rod = makeRod();
    pl.hold(rod, 1);
    let armA = -1.05, armTarget = -1.05;
    const holdPose = (av, dt) => {
      armA = lerp(armA, armTarget, 1 - Math.exp(-dt * 14));
      av.arms[1].rotation.x = armA; av.arms[1].rotation.z = 0.05;
      av.arms[0].rotation.x = armA * 0.78; av.arms[0].rotation.z = 0.35;
    };
    pl.pose = holdPose;
    const far = portrait() ? 1.3 : 1;
    const camNormal = { pos: V(stand.x + CAM_F[0] * far, CAM_F[1] * far, stand.z + CAM_F[2] * far), look: V(stand.x - 2.3, 0.2, stand.z - 0.15) };
    const camCatch = { pos: V(stand.x - 4.6 * far, 2.2, stand.z + 1.3 * far), look: V(stand.x, 1.35, stand.z) };
    const game = { cam: camNormal, camSpeed: 2.6 };

    // 찌와 낚싯줄
    const bob = new THREE.Group();
    bob.add(mk(new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#EF6461')));
    bob.add(mk(new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#FFFDF7')));
    bob.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 5), toon('#2E2A2A'), 0, 0.09, 0));
    bob.scale.setScalar(1.6); // 멀리서도 잘 보이게
    bob.visible = false;
    grp.add(bob);
    const LP = new Float32Array(18 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(LP, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: '#3B2E25' });
    lineMat.userData.own = true;
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    line.visible = false;
    grp.add(line);
    const tipPos = V();

    // 물결과 물방울
    const fx = [];
    function ripple(x, z, size = 1) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 28), basicMat('#FFFFFF', 0.85));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, z);
      grp.add(m);
      fx.push({ m, life: 0, max: 0.9, kind: 'ring', size });
    }
    function splash(x, z, n = 8) {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), basicMat('#DFF4FF', 0.95));
        m.position.set(x, 0.06, z);
        grp.add(m);
        const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.8;
        fx.push({ m, life: 0, max: 0.6, kind: 'drop', vel: V(Math.cos(a) * s * 0.6, 1.4 + Math.random(), Math.sin(a) * s * 0.6) });
      }
    }

    // 물고기 그림자
    const inPond = (x, z, m = 0) => ((x - POND.x) / (POND.rx - m)) ** 2 + ((z - POND.z) / (POND.rz - m)) ** 2 < 1 && !(x > -8.3 && Math.abs(z - 12.9) < 0.95);
    const SIZES = ['tiny', 'small', 'small', 'medium', 'medium', 'large'];
    const shadows = [];
    function placeShadow(s, nearX, nearZ, dist) {
      for (let i = 0; i < 60; i++) {
        let x, z;
        if (nearX != null) { const a = Math.random() * Math.PI * 2; x = nearX + Math.cos(a) * dist; z = nearZ + Math.sin(a) * dist; } else {
          x = POND.x + (Math.random() - 0.5) * POND.rx * 1.7;
          z = POND.z + (Math.random() - 0.5) * POND.rz * 1.7;
        }
        if (inPond(x, z, 0.45)) { s.x = x; s.z = z; return true; }
      }
      return false;
    }
    function spawnShadow(s) {
      placeShadow(s);
      s.a = Math.random() * Math.PI * 2;
      s.len = s.want = SHADOW_LEN[pick(SIZES)];
      s.state = 'wander'; s.t = 0; s.op = 0;
      s.speed = 0.22 + Math.random() * 0.18;
    }
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      const mat = basicMat('#163545', 0.001);
      const body = new THREE.Mesh(new THREE.CircleGeometry(0.5, 22), mat);
      body.rotation.x = -Math.PI / 2;
      holder.add(body);
      holder.position.y = 0.04;
      grp.add(holder);
      const s = { holder, body, mat };
      spawnShadow(s);
      shadows.push(s);
    }

    // 상태
    let st = 'idle', t = 0, active = null, pending = null, hooking = false, lastHook = 0;
    let nibbles = 0, nextNibble = 0, biteUntil = 0, waitT = 0, held = null, landed = null, showTimer = null;
    const target = V(), from = V();
    const say = (txt) => ui.say(txt);

    function setIdle(msg = '물고기 그림자 가까이 물을 누르거나 ‘던지기’를 눌러요!') {
      st = 'idle';
      bob.visible = false; line.visible = false;
      armTarget = -1.05;
      rod.visible = true;
      pl.pose = holdPose;
      game.cam = camNormal;
      say(msg);
      ui.setMain('던지기', { onClick: () => cast() });
    }

    function cast(pt) {
      if (st !== 'idle') return;
      if (!pt) {
        // 가장 가까운 그림자 쪽으로 던진다
        let best = null, bd = 9;
        for (const s of shadows) {
          if (s.state !== 'wander' || s.op < 0.4) continue;
          const d = Math.hypot(s.x - stand.x, s.z - stand.z);
          if (d < bd && d > 1.4 && d < 3.4) { bd = d; best = s; }
        }
        pt = best ? V(best.x + (Math.random() - 0.5) * 0.5, 0.05, best.z + (Math.random() - 0.5) * 0.5) : V(stand.x - 1.9 - Math.random() * 0.7, 0.05, stand.z + (Math.random() - 0.5) * 1.0);
        if (!inPond(pt.x, pt.z, 0.3)) pt.set(stand.x - 2.0, 0.05, stand.z);
      }
      target.copy(pt).setY(0.05);
      st = 'cast'; t = 0;
      armTarget = -2.8;
      ui.setMain('…', { disabled: true });
      say('휘익!');
      sfx.whoosh();
    }

    function startWait() {
      st = 'wait'; waitT = 0; active = null; pending = null; nibbles = 0;
      say('찌를 잘 보세요. 쏙 들어가면 그때 당겨요!');
      ui.setMain('당기기', { onClick: () => pull() });
    }

    async function hook() {
      if (hooking) return;
      hooking = true;
      const gap = 2150 - (performance.now() - lastHook);
      if (gap > 0) await new Promise((res) => setTimeout(res, gap));
      if (st !== 'approach' && st !== 'nibble') { hooking = false; return; }
      lastHook = performance.now();
      try {
        const res = await rpc('kids_fish_hook', { p_token: getToken() });
        if (st !== 'approach' && st !== 'nibble') return;
        pending = res;
        const f = fishById(res.fish);
        if (active && f) active.want = SHADOW_LEN[f.shadow] || active.len;
      } catch (e) {
        if (lost(e)) return;
        if (active) flee(active);
        reelIn(message(e));
      } finally { hooking = false; }
    }

    function flee(s) { s.state = 'flee'; s.t = 0; s.a = Math.atan2(s.x - target.x, s.z - target.z); }

    function reelIn(msg) {
      st = 'reel'; t = 0;
      from.copy(bob.position);
      armTarget = -1.6;
      ui.setMain('…', { disabled: true });
      if (msg) say(msg);
      setTimeout(() => { if (st === 'reel') setIdle(msg ? `${msg} 다시 던져 볼까요?` : undefined); }, 650);
    }

    function pull() {
      if (st === 'wait' || st === 'approach' || st === 'nibble') {
        sfx.fail();
        if (active) flee(active);
        reelIn(st === 'wait' ? '아직 아무것도 안 물었어요.' : '앗, 너무 일찍 당겼어요.');
        return;
      }
      if (st === 'bite') catchIt();
    }

    async function catchIt() {
      st = 'landing'; t = 0;
      armTarget = -2.6;
      ui.setMain('…', { disabled: true });
      say('영차!');
      splash(bob.position.x, bob.position.z, 12);
      sfx.splash();
      const f = pending ? fishById(pending.fish) : null;
      const len = f && f.rarity >= 0 ? Math.max(0.3, Math.min(0.8, 0.22 + (pending.size || 10) / 90)) : 0.38;
      held = makeFish3D(f || fishById('crucian'), len);
      held.position.copy(bob.position);
      grp.add(held);
      from.copy(bob.position);
      bob.visible = false; line.visible = false;
      if (active) { active.op = 0; active.state = 'gone'; active.t = 0; }
      landed = null;
      try { landed = await rpc('kids_fish_land', { p_token: getToken() }); } catch (e) {
        if (lost(e)) return;
        disposeTree(held); held = null;
        setIdle(message(e));
      }
    }

    function showCatch() {
      const r = landed;
      landed = null;
      const f = fishById(r.fish) || { name: r.name, rarity: r.rarity };
      st = 'show'; t = 0;
      rod.visible = false;
      pl.pose = showPose;
      game.cam = camCatch;
      if (f.rarity < 0) {
        ui.banner(`${josa(f.name, '을', '를')} 건졌다!`, '연못이 조금 깨끗해졌어요', 3000);
        sfx.blub();
        say('물고기는 아니지만 괜찮아요. 연못 청소를 했네요!');
      } else {
        const note = r.first ? '처음 잡았어요! 도감에 올랐어요' : r.best ? '내 기록보다 커요!' : RARITY[f.rarity];
        ui.banner(`${josa(f.name, '을', '를')} 잡았다!`, `${r.size}cm · ${note}`, 3000);
        if (r.first || f.rarity >= 2) { confetti(); onCelebrate(); } else sfx.success();
        if (f.rarity >= 2 && ctx.onRare) ctx.onRare(r.fish);
        say(`오늘 ${r.today}번째예요!`);
      }
      ui.setMain('…', { disabled: true });
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        if (st !== 'show') return;
        disposeTree(held); held = null;
        setIdle('또 던져 볼까요?');
      }, 3300);
    }

    game.onTap = (ray) => {
      if (st === 'idle') {
        const pt = V();
        const ok = ray.ray.intersectPlane(new THREE.Plane(V(0, 1, 0), -0.05), pt);
        if (ok && inPond(pt.x, pt.z, 0.15) && pt.x < stand.x - 0.6 && pt.distanceTo(V(stand.x, 0.05, stand.z)) < 3.8) cast(pt);
        else if (ok && inPond(pt.x, pt.z, 0)) say('조금 더 가까운 물을 눌러 봐요.');
      } else if (st === 'bite' || st === 'wait' || st === 'approach' || st === 'nibble') pull();
    };

    game.update = (dt, time) => {
      for (const s of shadows) {
        s.t += dt;
        if (s.state === 'gone') { s.op = 0; if (s.t > 2.5) spawnShadow(s); } else if (s.state === 'flee') {
          s.x += Math.sin(s.a) * 1.6 * dt; s.z += Math.cos(s.a) * 1.6 * dt;
          s.op = Math.max(0, s.op - dt * 1.4);
          if (s.op <= 0) { s.state = 'gone'; s.t = 0; }
        } else if (s.state === 'wander') {
          s.op = Math.min(1, s.op + dt * 0.8);
          s.a += (Math.sin(time * 0.7 + s.len * 9) * 0.6 + (Math.random() - 0.5)) * dt;
          const nx = s.x + Math.sin(s.a) * s.speed * dt, nz = s.z + Math.cos(s.a) * s.speed * dt;
          if (inPond(nx, nz, 0.3)) { s.x = nx; s.z = nz; } else s.a += Math.PI * (0.6 + Math.random() * 0.4);
        } else {
          s.op = Math.min(1, s.op + dt);
          const nose = s.len * 0.5 + 0.05;
          const dx = target.x - s.x, dz = target.z - s.z;
          const d = Math.hypot(dx, dz);
          s.a = Math.atan2(dx, dz);
          if (d > nose + 0.01) { const step = Math.min(d - nose, 0.45 * dt); s.x += (dx / d) * step; s.z += (dz / d) * step; } else if (s.state === 'approach') {
            s.state = 'nibble';
            nibbles = 1 + Math.floor(Math.random() * 3);
            nextNibble = 0.5 + Math.random() * 0.7;
            if (st === 'approach') st = 'nibble';
          }
        }
        const jig = s.state === 'nibble' ? Math.sin(time * 14) * 0.03 : 0;
        s.len = lerp(s.len, s.want, 1 - Math.exp(-dt * 1.5));
        s.holder.position.x = s.x + Math.sin(s.a) * jig;
        s.holder.position.z = s.z + Math.cos(s.a) * jig;
        s.holder.rotation.y = s.a;
        s.body.scale.set(s.len * 0.42, s.len, 1);
        s.mat.opacity = 0.32 * s.op;
      }

      rod.updateWorldMatrix(true, true);
      rod.userData.tip.getWorldPosition(tipPos);

      if (st === 'cast') {
        t += dt;
        if (t > 0.28 && armTarget < -2) armTarget = -0.95;
        if (t > 0.4) {
          if (!bob.visible) { bob.visible = true; line.visible = true; from.copy(tipPos); }
          const k = clamp01((t - 0.4) / 0.6);
          bob.position.lerpVectors(from, target, k);
          bob.position.y = lerp(from.y, target.y, k) + Math.sin(k * Math.PI) * 1.1;
          if (k >= 1) { ripple(target.x, target.z, 1.2); splash(target.x, target.z, 6); sfx.splash(); startWait(); }
        }
      } else if (st === 'reel') {
        t += dt;
        const k = clamp01(t / 0.45);
        bob.position.lerpVectors(from, tipPos, ease(k));
        bob.position.y += Math.sin(k * Math.PI) * 0.4;
      } else if (st === 'wait' || st === 'approach' || st === 'nibble' || st === 'bite') {
        waitT += dt;
        if (st === 'wait' && !active && waitT > 0.9) {
          let best = null, bd = 99;
          for (const s of shadows) {
            if (s.state !== 'wander' || s.op < 0.3) continue;
            const d = Math.hypot(s.x - target.x, s.z - target.z);
            if (d < bd) { bd = d; best = s; }
          }
          if (best && (bd < 2.2 || waitT > 2.6)) {
            if (bd > 1.5) { placeShadow(best, target.x, target.z, 1.3); best.op = 0; }
            active = best;
            active.state = 'approach';
            st = 'approach';
            hook();
          }
        } else if (st === 'nibble') {
          nextNibble -= dt;
          if (nextNibble <= 0) {
            if (nibbles > 0) {
              nibbles--;
              nextNibble = 0.6 + Math.random() * 0.8;
              ripple(target.x, target.z, 0.5);
              sfx.tick();
              bob.userData.dip = 0.035;
              say(pick(['톡… 톡…', '물고기가 찌를 건드려요.', '아직이에요, 조금만 기다려요.']));
            } else if (pending) {
              st = 'bite';
              if (active) active.state = 'bite';
              biteUntil = waitT + 1.3;
              bob.userData.dip = 0.14;
              ripple(target.x, target.z, 1.4);
              splash(target.x, target.z, 10);
              sfx.bite();
              say('지금이에요! 당겨요!');
              ui.setMain('당기기!', { pulse: true, onClick: () => pull() });
            } else nextNibble = 0.3; // 서버 대답을 조금 더 기다린다
          }
        } else if (st === 'bite') {
          bob.userData.dip = Math.max(bob.userData.dip || 0, 0.11);
          if (waitT > biteUntil) {
            sfx.fail();
            if (active) flee(active);
            reelIn('물고기가 도망갔어요.');
          }
        }
        if (st !== 'reel') {
          bob.userData.dip = Math.max(0, (bob.userData.dip || 0) - dt * 0.25);
          bob.position.set(target.x, 0.05 + Math.sin(time * 2.4) * 0.008 - bob.userData.dip, target.z);
        }
      } else if (st === 'landing') {
        t += dt;
        const head = handFront(pl, 0.5, 1.0);
        if (held) {
          const k = clamp01(t / 0.7);
          held.position.lerpVectors(from, head, ease(k));
          held.position.y += Math.sin(k * Math.PI) * 0.9;
          held.rotation.x += dt * 12 * (1 - k);
        }
        if (t > 0.7 && landed) showCatch();
      } else if (st === 'show') {
        t += dt;
        if (held) {
          held.position.copy(handFront(pl, 0.5, 1.0));
          held.rotation.set(0, pl.root.rotation.y, Math.sin(t * 9) * 0.12);
        }
      }

      if (line.visible) {
        const sag = st === 'bite' ? 0.02 : st === 'cast' ? 0.05 : 0.22;
        for (let i = 0; i < 18; i++) {
          const k = i / 17;
          LP[i * 3] = lerp(tipPos.x, bob.position.x, k);
          LP[i * 3 + 1] = lerp(tipPos.y, bob.position.y + 0.1, k) - Math.sin(k * Math.PI) * sag;
          LP[i * 3 + 2] = lerp(tipPos.z, bob.position.z, k);
        }
        lineGeo.attributes.position.needsUpdate = true;
      }

      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life += dt;
        const k = p.life / p.max;
        if (p.kind === 'ring') { p.m.scale.setScalar(1 + k * 5 * p.size); p.m.material.opacity = 0.85 * (1 - k); } else {
          p.vel.y -= 6 * dt;
          p.m.position.addScaledVector(p.vel, dt);
        }
        if (k >= 1) { disposeTree(p.m); fx.splice(i, 1); }
      }
    };

    game.stop = () => {
      st = 'stopped';
      clearTimeout(showTimer);
      disposeTree(grp);
      pl.drop();
      disposeTree(rod);
      pl.pose = null;
    };
    game.state = () => st;

    const book = () => {
      const box = h('div', { class: 'mem pond-tabs' }, h('p', { class: 'empty-big' }, '도감을 꺼내고 있어요…'));
      modal.open('물고기 도감', box, { cls: 'game-sheet' });
      renderFishBook(box, { rpc, getToken, onSessionLost: () => lost({ code: 'SESSION' }) });
    };
    begin('fish', '반짝 연못 낚시터', game, [['book', '도감', book]]);
    setIdle();
  }

  // =====================================================================
  // 오목
  // =====================================================================
  function omokSeats() {
    const sp = v.spots.omok;
    const a = spotPoint(sp, 0, SEAT_Y, 1.0), b = spotPoint(sp, 0, SEAT_Y, -1.0);
    return [{ x: a.x, z: a.z, rot: sp.rot + Math.PI, side: 1 }, { x: b.x, z: b.z, rot: sp.rot, side: -1 }];
  }

  function omokMenu() {
    const tok = ++menuTok;
    const friends = onlineFriends();
    const body = h('div', { class: 'mem game' },
      h('section', { class: 'guide compact' },
        h('h3', {}, '오목은 이렇게 해요'),
        h('ol', { class: 'guide-steps' },
          h('li', {}, h('b', {}, '번갈아 놓아요'), h('span', {}, '검은 돌이 먼저예요. 판에서 줄이 만나는 곳을 누르면 돌이 비쳐 보이고, 한 번 더 누르거나 ‘놓기’를 누르면 놓여요.')),
          h('li', {}, h('b', {}, '다섯 개를 한 줄로'), h('span', {}, '가로, 세로, 대각선 어느 쪽이든 내 돌 다섯 개를 먼저 이으면 이겨요.')),
          h('li', {}, h('b', {}, '친구를 막아요'), h('span', {}, '친구 돌이 셋이나 넷으로 이어지면 끝을 막아 줘요.')))),
      h('div', { class: 'mode-pick' },
        h('button', { class: 'mode', type: 'button', onclick: () => { menuTok++; modal.close(); omok({}); } },
          h('b', {}, '숲지기 솔과 두기'), h('span', {}, '컴퓨터와 연습해요. 내가 먼저 검은 돌이에요.'))),
      ...(() => {
        const games = ctx.watchable ? ctx.watchable() : [];
        if (!games.length) return [];
        return [h('div', { class: 'sub-head' }, h('h3', {}, '지금 두고 있는 판 구경하기')),
          h('div', { class: 'watch-list' }, games.map((gm) => h('button', { class: 'mode', type: 'button', onclick: () => { menuTok++; modal.close(); omokWatch(gm.id); } },
            h('b', {}, `👀 ${gm.name}의 판`), h('span', {}, gm.vs ? `${josa(gm.vs, '과', '와')} 두고 있어요` : '탁자 옆에서 응원하며 구경해요'))))];
      })(),
      h('div', { class: 'sub-head' }, h('h3', {}, '마을 친구와 두기'), h('p', {}, friends.length ? `${friends.length}명` : '')),
      friendPicker(friends, (f) => {
        modal.setTitle('오목 놀이터');
        waitInvite(hub, f, 'omok', null, { setBody: (b) => modal.setBody(b), onBack: omokMenu }).then((s) => {
          if (!s) return;
          if (tok !== menuTok || !modal.isOpen) { s.close(); return; }
          menuTok++;
          modal.close();
          omok({ session: s });
        });
      }, '지금 마을에 있는 친구가 없어요. 친구가 들어오면 여기에 보여요.'));
    modal.open('오목 놀이터', body, { cls: 'game-sheet', onClose: () => { if (tok === menuTok) menuTok++; } });
  }

  function omok({ session = null } = {}) {
    stopAll();
    const sp = v.spots.omok;
    const N = 13, BS = 1.08, C = BS / (N + 1);
    const idx = (x, y) => y * N + x;
    const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    const grp = new THREE.Group();
    grp.position.set(sp.x, 0, sp.z);
    grp.rotation.y = sp.rot;
    v.scene.add(grp);
    grp.updateMatrixWorld(true);
    grp.add(mk(new THREE.BoxGeometry(BS + 0.07, 0.03, BS + 0.07), toon('#C99862'), 0, 0.862, 0));
    const tex = canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#EBC889'; c.fillRect(0, 0, w, w);
      c.strokeStyle = '#7A5233'; c.lineWidth = 2.4;
      const u = w / (N + 1);
      for (let i = 1; i <= N; i++) {
        c.beginPath(); c.moveTo(u, i * u); c.lineTo(N * u, i * u); c.stroke();
        c.beginPath(); c.moveTo(i * u, u); c.lineTo(i * u, N * u); c.stroke();
      }
      c.fillStyle = '#7A5233';
      for (const [x, y] of [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]]) { c.beginPath(); c.arc((x + 1) * u, (y + 1) * u, 6, 0, 7); c.fill(); }
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(BS, BS), ownMat('#FFFFFF', { map: tex }));
    board.rotation.x = -Math.PI / 2;
    board.position.y = 0.879;
    board.receiveShadow = true;
    grp.add(board);
    const R = C * 0.45, SY = 0.879 + R * 0.42;
    const stoneGeo = new THREE.SphereGeometry(R, 20, 12);
    const stoneMat = { 1: toon('#2E2A2A'), 2: toon('#FFFDF7') };
    const cellPos = (x, y) => V((x - 6) * C, SY, (y - 6) * C);
    // 놓기 전에 비쳐 보이는 돌과 노란 고리
    const ghost = new THREE.Group();
    const ghostStone = new THREE.Mesh(stoneGeo, basicMat('#2E2A2A', 0.6));
    ghostStone.scale.y = 0.42;
    ghost.add(ghostStone);
    const ghostRing = new THREE.Mesh(new THREE.RingGeometry(R * 1.15, R * 1.6, 24), basicMat('#F6D55C', 0.95));
    ghostRing.rotation.x = -Math.PI / 2;
    ghostRing.position.y = 0.882 - SY;
    ghost.add(ghostRing);
    ghost.visible = false;
    grp.add(ghost);
    const mark = new THREE.Mesh(new THREE.SphereGeometry(R * 0.28, 10, 8), basicMat('#EF6461'));
    mark.visible = false;
    grp.add(mark);
    let stones = [], anims = [], winMesh = null;

    // 자리: 초대한 사람(또는 혼자)은 앞쪽 의자, 초대받은 사람은 맞은편
    const seats = omokSeats();
    const mine = session && !session.host ? seats[1] : seats[0];
    const theirs = mine === seats[0] ? seats[1] : seats[0];
    const meSt = { reach: 0, cheer: 0 }, opSt = { reach: 0, cheer: 0 };
    const pl = v.player;
    v.placePlayer(mine.x, mine.z, mine.rot, SEAT_Y);
    pl.pose = seatPose(meSt);
    let guideSave = null;
    if (!session) {
      const gd = v.guide;
      guideSave = { pos: gd.root.position.clone(), rot: gd.root.rotation.y, pose: gd.pose };
      gd.root.position.set(theirs.x, SEAT_Y, theirs.z);
      gd.root.rotation.y = theirs.rot;
      gd.pose = seatPose(opSt);
    } else {
      v.pinRemote(session.peer, { x: theirs.x, y: SEAT_Y, z: theirs.z, rot: theirs.rot, pose: seatPose(opSt) });
    }
    // 카메라는 탁자 옆에서 본다: 내 자리가 화면 왼쪽, 친구가 오른쪽. 내 차례에는 판 가까이 다가간다.
    const S = mine.side;
    const camWide = camAt(sp, [2.75 * S, 3.55, 0], [0, 1.05, 0], 1.25);
    const camClose = camAt(sp, [1.05 * S, 2.7, 0], [0, 0.86, 0], 1.2);
    const game = { cam: camWide, camSpeed: 2.2 };
    const oppName = session ? session.peerName : '숲지기 솔';

    let g = null;
    let meLabel = null, opLabel = null;
    const colorName = (c) => (c === 1 ? '검은 돌' : '흰 돌');
    // 구경하는 친구들에게 판을 알린다 (친구와 둘 때는 초대한 쪽만)
    const myId = ctx.myId ? ctx.myId() : null;
    const oppId = session ? session.peer : 'g';
    function broadcast() {
      if (!g || !myId || !ctx.onOmokState || (session && !session.host)) return;
      const last = g.moves.length ? g.moves[g.moves.length - 1][1] * N + g.moves[g.moves.length - 1][0] : -1;
      ctx.onOmokState({ b: Array.from(g.board).join(''), k: g.me === 1 ? myId : oppId, w: g.me === 1 ? oppId : myId, x: g.winner || 0, r: g.round, l: last });
    }
    const beat = setInterval(() => { if (live(game)) broadcast(); }, 8000);

    function newRound(me, round) {
      for (const s of stones) s.removeFromParent();
      stones = []; anims = [];
      if (winMesh) { disposeTree(winMesh); winMesh = null; }
      mark.visible = false; ghost.visible = false;
      const prevLeft = g ? g.peerLeft : false;
      g = { me, round, board: new Int8Array(N * N), moves: [], turn: 1, over: false, sel: null, wantAgain: false, peerAgain: false, peerLeft: prevLeft };
      ghostStone.material.color.set(me === 1 ? '#2E2A2A' : '#FFFDF7');
      setTimeout(broadcast, 50);
      if (meLabel) { meLabel.remove(); opLabel.remove(); }
      meLabel = ui.label(`나 · ${colorName(me)}`);
      opLabel = ui.label(`${oppName} · ${colorName(me === 1 ? 2 : 1)}`);
      turnText();
      if (g.turn !== g.me) opponentTurn();
    }

    function turnText() {
      if (!g || g.over) return;
      game.cam = g.turn === g.me ? camClose : camWide;
      if (g.turn === g.me) {
        ui.say(g.moves.length ? '내 차례예요. 놓을 곳을 눌러요!' : `내가 먼저예요 (${colorName(g.me)}). 판에서 놓을 곳을 눌러요!`);
        ui.setMain('놓기', { disabled: !g.sel, onClick: confirm });
      } else {
        ui.say(`${josa(oppName, '이', '가')} 생각하고 있어요…`);
        ui.setMain('기다려요', { disabled: true });
      }
    }

    function select(x, y) {
      if (g.sel && g.sel.x === x && g.sel.y === y) { confirm(); return; }
      g.sel = { x, y };
      ghost.position.copy(cellPos(x, y));
      ghost.visible = true;
      sfx.tick();
      ui.setMain('놓기', { disabled: false, pulse: true, onClick: confirm });
      ui.say('여기에 놓을까요? 한 번 더 누르거나 ‘놓기’를 눌러요.');
    }

    function confirm() {
      if (!g || g.over || g.turn !== g.me || !g.sel) return;
      const { x, y } = g.sel;
      if (g.board[idx(x, y)]) return;
      g.sel = null;
      ghost.visible = false;
      place(x, y, g.me);
      if (session && !session.bot) session.send('mv', { n: g.moves.length - 1, x, y, r: g.round });
      if (!g.over) opponentTurn();
    }

    function place(x, y, c) {
      const m = new THREE.Mesh(stoneGeo, stoneMat[c]);
      m.scale.y = 0.42;
      m.castShadow = true;
      const p = cellPos(x, y);
      m.position.set(p.x, p.y + 0.3, p.z);
      grp.add(m);
      stones.push(m);
      anims.push({ m, t: 0, y: p.y });
      (c === g.me ? meSt : opSt).reach = 1;
      setTimeout(() => sfx.stone(), 160);
      g.board[idx(x, y)] = c;
      g.moves.push([x, y]);
      g.turn = c === 1 ? 2 : 1;
      mark.position.set(p.x, p.y + R * 0.42, p.z);
      mark.visible = true;
      const ln = lineAt(g.board, x, y, c);
      if (ln) finish(c, ln);
      else if (g.moves.length === N * N) finish(0, null);
      else turnText();
      broadcast();
    }

    function finish(winner, ln) {
      g.over = true;
      g.winner = winner === 0 ? 3 : winner;
      ghost.visible = false;
      game.cam = camWide;
      if (ln) {
        const pts = [...ln].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const a = cellPos(...pts[0]), b = cellPos(...pts[pts.length - 1]);
        winMesh = new THREE.Mesh(new THREE.CapsuleGeometry(C * 0.13, a.distanceTo(b) + C * 0.5, 4, 8), basicMat('#EF6461', 0.85));
        winMesh.position.copy(a).add(b).multiplyScalar(0.5);
        winMesh.position.y = SY + R * 0.5;
        winMesh.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
        grp.add(winMesh);
      }
      if (winner === 0) { ui.banner('비겼어요!', '둘 다 정말 잘했어요'); ui.say('판이 꽉 찼어요. 한 판 더 할까요?'); } else if (winner === g.me) {
        meSt.cheer = 2.6;
        ui.banner('내가 이겼어요!', '다섯 개를 이었어요');
        ui.say('정말 잘했어요! 한 판 더 할까요?');
        confetti();
        onCelebrate();
      } else {
        opSt.cheer = 2.6;
        ui.banner(`${josa(oppName, '이', '가')} 이겼어요`, '다음 판에 다시 해 봐요!');
        ui.say('아쉬워요! 다음 판에는 끝을 잘 막아 봐요.');
        sfx.fail();
      }
      drawAgain();
    }

    function drawAgain() {
      if (!g.over) return;
      if (g.peerLeft) { ui.setMain('나가기', { onClick: () => stopAll() }); return; }
      if (!session || session.bot) {
        ui.setMain('한 판 더', { onClick: () => newRound(g.me === 1 ? 2 : 1, g.round + 1) });
        return;
      }
      ui.setMain(g.peerAgain ? '좋아, 한 판 더!' : g.wantAgain ? '기다려요' : '한 판 더', {
        disabled: g.wantAgain, pulse: g.peerAgain,
        onClick: () => {
          g.wantAgain = true;
          session.send('again');
          if (g.peerAgain) rematch();
          else { ui.say(`${josa(oppName, '을', '를')} 기다리고 있어요…`); drawAgain(); }
        },
      });
    }
    function rematch() { newRound(g.me === 1 ? 2 : 1, g.round + 1); }

    function opponentTurn() {
      if (session && !session.bot) return;
      const round = g.round;
      setTimeout(() => {
        if (!live(game) || !g || g.over || g.round !== round) return;
        const c = g.me === 1 ? 2 : 1;
        const [x, y] = aiMove(g.board, c);
        place(x, y, c);
      }, 700 + Math.random() * 800);
    }

    if (session) {
      session.on('msg', (m) => {
        if (!g || !live(game)) return;
        if (m.t === 'mv') {
          const c = g.me === 1 ? 2 : 1;
          if (g.over || m.r !== g.round || m.n !== g.moves.length || g.turn !== c || !inside(m.x, m.y) || g.board[idx(m.x, m.y)]) return;
          place(m.x, m.y, c);
        } else if (m.t === 'again') {
          g.peerAgain = true;
          if (g.wantAgain) rematch();
          else { ui.say(`${josa(oppName, '이', '가')} 한 판 더 하재요!`); drawAgain(); }
        }
      }).on('left', () => {
        if (!g || !live(game)) return;
        g.peerLeft = true;
        if (!g.over) { g.over = true; ghost.visible = false; }
        ui.say(`${josa(oppName, '이', '가')} 놀이를 마쳤어요.`);
        v.unpinRemote(session.peer);
        drawAgain();
      });
    }

    game.onTap = (ray) => {
      if (!g || g.over || g.turn !== g.me) return;
      const hit = ray.intersectObject(board, false)[0];
      if (!hit) return;
      const lp = grp.worldToLocal(hit.point.clone());
      const x = Math.round(lp.x / C) + 6, y = Math.round(lp.z / C) + 6;
      if (!inside(x, y) || g.board[idx(x, y)]) return;
      select(x, y);
    };

    game.update = (dt, time) => {
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i];
        a.t += dt;
        const k = clamp01(a.t / 0.28);
        a.m.position.y = a.y + (1 - ease(k)) * 0.3;
        if (k >= 1) anims.splice(i, 1);
      }
      if (ghost.visible) { const s = 1 + Math.sin(time * 6) * 0.08; ghostStone.scale.set(s, 0.42 * s, s); }
      if (meLabel) ui.place(meLabel, V(mine.x, 0, mine.z), 0.75);
      if (opLabel) ui.place(opLabel, V(theirs.x, 0, theirs.z), 0.75);
    };
    game.state = () => g && { moves: g.moves.map((m) => m.join(',')), turn: g.turn, me: g.me, over: g.over, round: g.round, sel: g.sel };
    game.cellScreen = (x, y) => screenOf(v, grp.localToWorld(cellPos(x, y)));

    game.stop = () => {
      clearInterval(beat);
      if (session && !session.closed) session.close();
      if (guideSave) {
        const gd = v.guide;
        gd.root.position.copy(guideSave.pos);
        gd.root.rotation.y = guideSave.rot;
        gd.pose = guideSave.pose;
      }
      if (session) v.unpinRemote(session.peer);
      stoneGeo.dispose();
      disposeTree(grp);
      g = null;
    };

    begin('omok', `오목 · ${josa(oppName, '과', '와')} 한 판`, game);
    newRound(session ? (session.host ? 1 : 2) : 1, 1);
  }

  // =====================================================================
  // 오목 구경하기: 친구가 두는 판을 탁자 옆에 서서 본다
  // =====================================================================
  let watchUpdate = null;
  function omokWatch(hostId) {
    stopAll();
    const sp = v.spots.omok;
    const N = 13, BS = 1.08, C = BS / (N + 1);
    const grp = new THREE.Group();
    grp.position.set(sp.x, 0, sp.z);
    grp.rotation.y = sp.rot;
    v.scene.add(grp);
    grp.updateMatrixWorld(true);
    grp.add(mk(new THREE.BoxGeometry(BS + 0.07, 0.03, BS + 0.07), toon('#C99862'), 0, 0.862, 0));
    const tex = canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#EBC889'; c.fillRect(0, 0, w, w);
      c.strokeStyle = '#7A5233'; c.lineWidth = 2.4;
      const u = w / (N + 1);
      for (let i = 1; i <= N; i++) {
        c.beginPath(); c.moveTo(u, i * u); c.lineTo(N * u, i * u); c.stroke();
        c.beginPath(); c.moveTo(i * u, u); c.lineTo(i * u, N * u); c.stroke();
      }
      c.fillStyle = '#7A5233';
      for (const [x, y] of [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]]) { c.beginPath(); c.arc((x + 1) * u, (y + 1) * u, 6, 0, 7); c.fill(); }
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(BS, BS), ownMat('#FFFFFF', { map: tex }));
    board.rotation.x = -Math.PI / 2;
    board.position.y = 0.879;
    grp.add(board);
    const R = C * 0.45, SY = 0.879 + R * 0.42;
    const stoneGeo = new THREE.SphereGeometry(R, 20, 12);
    const stoneMat = { 1: toon('#2E2A2A'), 2: toon('#FFFDF7') };
    const mark = new THREE.Mesh(new THREE.SphereGeometry(R * 0.28, 10, 8), basicMat('#EF6461'));
    mark.visible = false;
    grp.add(mark);
    const stones = new Map(); // 칸 번호 → 돌
    const anims = [];
    let shown = '0'.repeat(169), round = 0, winner = 0, lastAt = performance.now();
    const pl = v.player;
    const st = spotPoint(sp, 1.4, 0, -1.5);
    const ctr = spotPoint(sp, 0, 0, 0);
    v.placePlayer(st.x, st.z, Math.atan2(ctr.x - st.x, ctr.z - st.z), 0);
    pl.pose = restPose;
    const game = { cam: camAt(sp, [2.9, 3.5, 0.15], [0, 0.95, 0], 1.25), camSpeed: 2.6 };
    let guideSave = null;
    const labels = [];
    const nameOf = (id) => (id === 'g' ? '숲지기 솔' : (ctx.personName && ctx.personName(id)) || '친구');
    const seats = omokSeats();

    function apply(s) {
      lastAt = performance.now();
      if (s.r !== round) {
        for (const m of stones.values()) m.removeFromParent();
        stones.clear();
        shown = '0'.repeat(169);
        round = s.r;
        winner = 0;
        // 자리 이름표: 초대한 아이(또는 혼자 두는 아이)가 앞쪽 의자, 맞은편이 친구나 숲지기 솔
        const other = s.k === hostId ? s.w : s.k;
        for (const l of labels) l.remove();
        labels.length = 0;
        const a = ui.label(`${nameOf(hostId)} · ${s.k === hostId ? '검은 돌' : '흰 돌'}`);
        const b = ui.label(`${nameOf(other)} · ${s.k === hostId ? '흰 돌' : '검은 돌'}`);
        labels.push(a, b);
        if (other === 'g' && !guideSave) {
          const gd = v.guide;
          guideSave = { pos: gd.root.position.clone(), rot: gd.root.rotation.y, pose: gd.pose };
          gd.root.position.set(seats[1].x, SEAT_Y, seats[1].z);
          gd.root.rotation.y = seats[1].rot;
          gd.pose = seatPose({});
        }
      }
      for (let i = 0; i < 169; i++) {
        if (s.b[i] === shown[i]) continue;
        if (s.b[i] === '0') { const m = stones.get(i); if (m) { m.removeFromParent(); stones.delete(i); } continue; }
        const x = i % N, y = Math.floor(i / N);
        const m = new THREE.Mesh(stoneGeo, stoneMat[s.b[i]]);
        m.scale.y = 0.42;
        m.position.set((x - 6) * C, SY + 0.3, (y - 6) * C);
        grp.add(m);
        stones.set(i, m);
        anims.push({ m, t: 0 });
        sfx.stone();
      }
      shown = s.b;
      if (s.l >= 0) { mark.position.set((s.l % N - 6) * C, SY + R * 0.42, (Math.floor(s.l / N) - 6) * C); mark.visible = true; } else mark.visible = false;
      if (s.x && !winner) {
        winner = s.x;
        if (s.x === 3) ui.banner('비겼어요!', '둘 다 잘했어요');
        else ui.banner(`${josa(nameOf(s.x === 1 ? s.k : s.w), '이', '가')} 이겼어요!`, '다섯 개를 이었어요');
        sfx.success();
      }
      const turnB = (s.b.match(/[12]/g) || []).length % 2 === 0;
      ui.say(s.x ? '다음 판도 구경할 수 있어요.' : `${nameOf(turnB ? s.k : s.w)} 차례예요. (${turnB ? '검은 돌' : '흰 돌'})`, `오목 구경 · ${nameOf(hostId)}의 판`);
    }
    watchUpdate = (id, s) => { if (id === hostId && live(game)) apply(s); };
    game.update = (dt) => {
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i];
        a.t += dt;
        const k = clamp01(a.t / 0.28);
        a.m.position.y = SY + (1 - ease(k)) * 0.3;
        if (k >= 1) anims.splice(i, 1);
      }
      if (labels[0]) ui.place(labels[0], V(seats[0].x, 0, seats[0].z), 0.75);
      if (labels[1]) ui.place(labels[1], V(seats[1].x, 0, seats[1].z), 0.75);
      if (performance.now() - lastAt > 25000 && !game.ended) { game.ended = true; ui.say('친구가 오목을 마쳤나 봐요. ‘그만’을 눌러 마을로 돌아가요.'); }
    };
    game.stop = () => {
      watchUpdate = null;
      if (guideSave) { const gd = v.guide; gd.root.position.copy(guideSave.pos); gd.root.rotation.y = guideSave.rot; gd.pose = guideSave.pose; }
      stoneGeo.dispose();
      disposeTree(grp);
      pl.pose = null;
    };
    begin('watch', `오목 구경 · ${nameOf(hostId)}의 판`, game);
    ui.setMain('응원하기', { onClick: () => { pl.celebrate(); sfx.pop(); } });
    const s0 = ctx.getObserve ? ctx.getObserve(hostId) : null;
    if (s0) apply(s0); else ui.say('판을 불러오고 있어요…', `오목 구경 · ${nameOf(hostId)}의 판`);
  }

  // =====================================================================
  // 요리
  // =====================================================================
  let cookBook = {};
  let freeReady = false;
  async function cookMenu() {
    const tok = ++menuTok;
    modal.open('숲속 부엌', h('div', { class: 'mem game cook' }, h('p', { class: 'empty-big' }, '요리책을 펴고 있어요…')), { cls: 'game-sheet', onClose: () => { if (tok === menuTok) menuTok++; } });
    try { cookBook = await rpc('kids_cook_book', { p_token: getToken() }); } catch (e) { if (lost(e)) return; cookBook = {}; }
    // 서버에 '마음대로 요리' 기능이 준비되어 있을 때만 단추를 보인다
    if (!freeReady) { try { await rpc('kids_dish_table', { p_token: getToken() }); freeReady = true; } catch (e) { if (lost(e)) return; } }
    if (tok !== menuTok) return;
    const starRow = (n) => h('span', { class: 'stars', 'aria-label': `별 ${n}개` }, Array.from({ length: 3 }, (_, i) => h('i', { class: i < n ? 'on' : '' }, '★')));
    modal.setTitle('숲속 부엌');
    modal.setBody(h('div', { class: 'mem game cook' },
      !freeReady ? null : h('div', { class: 'mode-pick' },
        h('button', { class: 'mode free-cook', type: 'button', onclick: () => { menuTok++; modal.close(); cookFree(); } },
          h('b', {}, '🧑‍🍳 마음대로 요리하기'), h('span', {}, '냉장고에서 재료를 꺼내고, 내가 낚은 물고기도 넣어서 썰고, 끓이고, 볶아요. 다 만든 요리는 마을 식탁에 올려요.'))),
      h('p', { class: 'hint-line' }, '성경 이야기에 나오는 음식도 만들어 봐요. 요리법은 재미있게 꾸민 놀이예요.'),
      h('div', { class: 'recipe-list' }, RECIPES.map((r) => h('button', { class: 'recipe', type: 'button', onclick: () => cookDetail(r, tok) },
        h('i', { class: 'dish', style: `background:${r.color}` }),
        h('b', {}, r.name), h('span', {}, r.ref),
        starRow((cookBook[r.id] && cookBook[r.id].stars) || 0))))));
  }

  function cookDetail(r, tok) {
    const friends = onlineFriends();
    modal.setTitle(r.name);
    modal.setBody(h('div', { class: 'mem game cook' },
      h('article', { class: 'verse-card' },
        h('div', { class: 'verse-tags' }, h('span', { class: 'tag' }, '성경 이야기')),
        h('h3', { class: 'verse-ref' }, r.ref),
        h('p', { class: 'copy-intro' }, r.story)),
      h('ol', { class: 'cook-steps' }, r.steps.map((s) => h('li', {}, s.title))),
      h('div', { class: 'mode-pick' },
        h('button', { class: 'mode', type: 'button', onclick: () => { menuTok++; modal.close(); cook({ recipe: r }); } }, h('b', {}, '혼자 요리하기'), h('span', {}, '세 단계를 모두 내가 해요.'))),
      h('div', { class: 'sub-head' }, h('h3', {}, '친구와 번갈아 요리하기'), h('p', {}, friends.length ? `${friends.length}명` : '')),
      friendPicker(friends, (f) => {
        waitInvite(hub, f, 'cook', r.id, { setBody: (b) => modal.setBody(b), onBack: () => cookDetail(r, tok) }).then((s) => {
          if (!s) return;
          if (tok !== menuTok || !modal.isOpen) { s.close(); return; }
          menuTok++;
          modal.close();
          cook({ recipe: r, session: s });
        });
      }, '지금 마을에 있는 친구가 없어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: cookMenu }, '다른 요리 보기'))));
  }

  function cook({ recipe, session = null }) {
    stopAll();
    const r = recipe;
    const sp = v.spots.cook;
    const pl = v.player;
    const grp = new THREE.Group();
    grp.position.set(sp.x, 0, sp.z);
    grp.rotation.y = sp.rot;
    v.scene.add(grp);
    grp.updateMatrixWorld(true);
    const TOP = 0.98;
    const WORK = V(0.5, TOP, -0.32);
    const POT = V(1.85, 0.72, 0.5);
    const STATION = { work: [0.5, -1.2], side: [-0.6, -1.2], hearth: [1.85, -0.3] };
    const camCounter = camAt(sp, [0.75, 3.9, 5.2], [0.75, 0.55, 0.3], 1.45);
    const camHearth = camAt(sp, [1.85, 3.0, 2.75], [1.85, 0.75, 0.3], 1.25);
    const camWork = camAt(sp, [0.55, 2.8, 3.4], [0.5, 0.95, -0.4], 1.3);
    const game = { cam: camCounter, camSpeed: 2.6 };
    const local = (p) => grp.localToWorld(p.clone());
    const peerName = session ? session.peerName : '';
    const run = { i: 0, scores: [], alone: !session, over: false };
    let step = null; // 지금 단계 { update, tap, pointer, stop }
    const flying = [];
    const props = new THREE.Group();
    grp.add(props);

    function standAt(where, who, pose = null) {
      const [lx, lz] = STATION[where];
      const p = spotPoint(sp, lx, 0, lz);
      if (who === 'me') { v.placePlayer(p.x, p.z, sp.rot, 0); pl.pose = pose; } else if (session && !run.alone) v.pinRemote(session.peer, { x: p.x, y: 0, z: p.z, rot: sp.rot, pose });
    }

    function owner(i) {
      if (!session || run.alone) return 'me';
      return (i % 2 === 0) === session.host ? 'me' : 'peer';
    }

    // 날아가는 물건 (호를 그리며 목적지로)
    function fly(obj, to, { dur = 0.5, arc = 0.4, done, spin = 0 } = {}) {
      flying.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur, arc, done, spin });
    }
    function clearProps() {
      flying.length = 0;
      for (const c of [...props.children]) disposeTree(c);
    }

    function play() {
      if (!live(game)) return;
      if (step) { step.stop(); step = null; }
      clearProps();
      ui.setPanel();
      const i = run.i;
      if (i >= r.steps.length) { finish(); return; }
      const st = r.steps[i];
      const mineTurn = owner(i) === 'me';
      ui.say(st.hint, `${r.name} · ${i + 1}/${r.steps.length} ${st.title}${mineTurn || run.alone ? '' : ` (${peerName})`}`);
      const where = st.type === 'stir' ? 'hearth' : 'work';
      game.cam = where === 'hearth' ? camHearth : st.type === 'collect' || !mineTurn ? camCounter : camWork;
      if (mineTurn) {
        standAt(where, 'me', workPose);
        if (session && !run.alone) standAt(where === 'hearth' ? 'work' : 'side', 'peer', restPose);
        ui.setMain('…', { disabled: true });
        step = STEPS[st.type](st, (score) => {
          if (!live(game) || run.i !== i) return;
          run.scores[i] = score;
          if (session && !run.alone && !session.bot) session.send('step', { i, sc: Math.round(score * 100) });
          next();
        });
      } else {
        standAt(where === 'hearth' ? 'work' : 'side', 'me', restPose);
        standAt(where, 'peer', workPose);
        ui.say(`${josa(peerName, '이', '가')} ‘${st.title}’를 하고 있어요. 응원하며 기다려요!`);
        ui.setMain('응원하기', { onClick: () => { pl.celebrate(); sfx.pop(); } });
        if (session.bot) {
          const at = run.i;
          setTimeout(() => { if (live(game) && run.i === at && !run.alone) { run.scores[at] = 0.7 + Math.random() * 0.3; next(); } }, 2600 + Math.random() * 2000);
        }
      }
    }

    function next() {
      sfx.ding();
      run.i += 1;
      ui.setMain('…', { disabled: true });
      setTimeout(() => play(), 700);
    }

    if (session) {
      session.on('msg', (m) => {
        if (!live(game)) return;
        if (m.t === 'step' && m.i === run.i && owner(run.i) !== 'me') {
          run.scores[m.i] = Math.max(0, Math.min(100, m.sc | 0)) / 100;
          next();
        }
      }).on('left', () => {
        if (!live(game) || run.alone) return;
        const waiting = owner(run.i) !== 'me';
        run.alone = true;
        v.unpinRemote(session.peer);
        toast(`${josa(peerName, '이', '가')} 부엌을 떠났어요. 남은 단계는 내가 해요!`, 3600);
        if (waiting && !run.over) play();
      });
    }

    // ---------- 단계들 ----------
    const timerPanel = (need) => {
      const count = h('span', { class: 'g-chip' }, `0 / ${need}`);
      const bar = h('div', { class: 'timebar' }, h('i'));
      ui.setPanel(h('div', { class: 'g-row' }, count, bar));
      return { count, bar };
    };

    const STEPS = {
      collect(st, done) {
        const { count, bar } = timerPanel(st.need);
        const basket = makeBasket(0.18);
        basket.position.copy(WORK);
        props.add(basket);
        const items = [];
        let got = 0, over = false;
        const t0 = performance.now();
        const make = () => {
          const g = new THREE.Group();
          if (st.item === 'manna') {
            for (let k = 0; k < 3; k++) { const b = mk(new THREE.SphereGeometry(0.07, 10, 8), toon('#FFFDF7'), (k - 1) * 0.09, 0.05, (k % 2) * 0.06); b.scale.y = 0.55; g.add(b); }
          } else {
            for (let k = 0; k < 2; k++) { const b = mk(new THREE.BoxGeometry(0.09, 0.06, 0.07), toon('#D9A35C'), k * 0.08 - 0.04, 0.035, k * 0.03); b.rotation.y = k; g.add(b); }
          }
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.23, 24), basicMat('#F6D55C', 0.8));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.02;
          g.add(ring);
          g.userData.ring = ring;
          return g;
        };
        const spawn = setInterval(() => {
          if (over || items.length > 6) return;
          const g = make();
          let x = 0, z = 0;
          for (let k = 0; k < 20; k++) {
            x = -1.5 + Math.random() * 3.9; z = 0.45 + Math.random() * 0.8;
            if (Math.hypot(x - POT.x, z - POT.z) > 0.75 && !items.some((o) => Math.hypot(o.g.position.x - x, o.g.position.z - z) < 0.35)) break;
          }
          g.position.set(x, 0, z);
          g.scale.setScalar(0.01);
          props.add(g);
          items.push({ g, t: 0 });
        }, 520);
        const end = () => {
          if (over) return;
          over = true;
          clearInterval(spawn);
          const used = (performance.now() - t0) / (st.time * 1000);
          done(got >= st.need ? Math.min(1, 1.15 - used * 0.4) : (got / st.need) * 0.7);
        };
        return {
          update(dt) {
            const k = (performance.now() - t0) / (st.time * 1000);
            bar.firstChild.style.width = Math.max(0, 100 - k * 100) + '%';
            if (k >= 1) end();
            for (let i = items.length - 1; i >= 0; i--) {
              const it = items[i];
              it.t += dt;
              const s = it.t < 0.25 ? ease(it.t / 0.25) : it.t > 2.2 ? 1 - ease((it.t - 2.2) / 0.3) : 1;
              it.g.scale.setScalar(Math.max(0.01, s * 1.25));
              if (it.t > 2.5) { disposeTree(it.g); items.splice(i, 1); }
            }
          },
          tap(ray, x, y) {
            if (over) return;
            let best = -1, bd = 70;
            items.forEach((it, i) => {
              const s = screenOf(v, local(it.g.position.clone().setY(0.05)));
              const d = Math.hypot(s.x - x, s.y - y);
              if (d < bd) { bd = d; best = i; }
            });
            if (best < 0) return;
            const it = items.splice(best, 1)[0];
            it.g.userData.ring.visible = false;
            it.g.scale.setScalar(1);
            sfx.pop();
            got++;
            count.textContent = `${got} / ${st.need}`;
            fly(it.g, WORK.clone().setY(TOP + 0.12), { dur: 0.45, arc: 0.7, done: () => disposeTree(it.g) });
            if (got >= st.need) setTimeout(end, 300);
          },
          stop() { over = true; clearInterval(spawn); },
          targets: () => items.map((it) => screenOf(v, local(it.g.position.clone().setY(0.05)))),
        };
      },

      tap(st, done) {
        const { count, bar } = timerPanel(st.need);
        let got = 0, over = false;
        const t0 = performance.now();
        const tool = new THREE.Group();
        tool.position.copy(WORK);
        props.add(tool);
        let top = null, dough = null;
        const coals = [], flames = [];
        if (st.item === 'mill') {
          tool.add(mk(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 20), toon('#9C9A93'), 0, 0.04, 0));
          top = new THREE.Group();
          top.position.y = 0.12;
          top.add(mk(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), toon('#B7B4AC')));
          top.add(mk(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), toon('#A06E45'), 0.13, 0.1, 0));
          tool.add(top);
        } else if (st.item === 'dough') {
          tool.add(mk(new THREE.BoxGeometry(0.6, 0.03, 0.4), toon('#C99862'), 0, 0.015, 0));
          dough = mk(new THREE.SphereGeometry(0.15, 18, 12), toon('#F1E3C4'), 0, 0.1, 0);
          dough.scale.set(1.1, 0.6, 1);
          tool.add(dough);
        } else if (st.item === 'fire') {
          tool.add(mk(new THREE.CylinderGeometry(0.24, 0.18, 0.14, 16), toon('#4A4A55'), 0, 0.07, 0));
          for (let k = 0; k < 7; k++) {
            const rr = k ? 0.1 : 0;
            const c = mk(new THREE.DodecahedronGeometry(0.05), ownMat('#3B3B3B'), Math.cos(k) * rr, 0.15, Math.sin(k) * rr);
            tool.add(c); coals.push(c);
          }
          for (let k = 0; k < 3; k++) {
            const f = mk(new THREE.ConeGeometry(0.07, 0.22, 8), basicMat(k ? '#F6A54C' : '#F6D55C', 0.9), (k - 1) * 0.07, 0.25, 0);
            f.scale.setScalar(0.01);
            tool.add(f); flames.push(f);
          }
        } else {
          tool.add(makeBasket(0.2));
          for (let k = 0; k < 4; k++) { const b = makeIngredient('bread'); b.scale.setScalar(0.8); b.position.set((k % 2 - 0.5) * 0.12, 0.08 + Math.floor(k / 2) * 0.05, (k < 2 ? -1 : 1) * 0.04); tool.add(b); }
        }
        let squash = 0;
        const end = () => {
          if (over) return;
          over = true;
          const used = (performance.now() - t0) / (st.time * 1000);
          done(got >= st.need ? Math.min(1, 1.2 - used * 0.45) : (got / st.need) * 0.7);
        };
        const hit = () => {
          if (over) return;
          got++;
          sfx.tick();
          count.textContent = `${got} / ${st.need}`;
          squash = 1;
          if (st.item === 'mill') {
            for (let k = 0; k < 2; k++) {
              const p = mk(new THREE.SphereGeometry(0.02, 6, 4), toon('#FFFDF7'), WORK.x + (Math.random() - 0.5) * 0.3, TOP + 0.1, WORK.z + 0.18);
              props.add(p);
              fly(p, V(p.position.x, TOP + 0.01, WORK.z + 0.24), { dur: 0.4, arc: 0.1 });
            }
          } else if (st.item === 'share') {
            const b = makeIngredient('bread');
            b.position.copy(WORK).setY(TOP + 0.15);
            props.add(b);
            fly(b, V(WORK.x + (Math.random() - 0.5) * 3, 0.2, 2.6), { dur: 0.7, arc: 1.2, spin: 6, done: () => disposeTree(b) });
          }
          if (got >= st.need) end();
        };
        ui.setMain(TAP_LABEL[st.item] || '콕!', { pulse: true, onClick: hit });
        return {
          update(dt, time) {
            const k = (performance.now() - t0) / (st.time * 1000);
            bar.firstChild.style.width = Math.max(0, 100 - k * 100) + '%';
            if (k >= 1) end();
            squash = Math.max(0, squash - dt * 6);
            const prog = clamp01(got / st.need);
            if (top) top.rotation.y += dt * (1 + squash * 14);
            if (dough) dough.scale.set(1.1 + squash * 0.25 + prog * 0.15, 0.6 - squash * 0.2, 1 + squash * 0.2 + prog * 0.1);
            if (coals.length) {
              for (const c of coals) c.material.color.copy(mixColor('#3B3B3B', '#F2753A', prog * (0.8 + Math.sin(time * 8 + c.position.x * 30) * 0.2)));
              flames.forEach((f, i) => { const s = Math.max(0.01, prog * (0.9 + Math.sin(time * 12 + i * 2) * 0.15) + squash * 0.2); f.scale.set(s, s * (1 + Math.sin(time * 15 + i) * 0.15), s); });
            }
          },
          tap() { hit(); },
          stop() { over = true; },
        };
      },

      heat(st, done) {
        const zone = 0.32 + Math.random() * 0.36;
        const bar = h('div', { class: 'heat-bar' }, h('span', { class: 'heat-zone', style: `left:${(zone - 0.09) * 100}%;width:18%` }), h('i', { class: 'needle' }));
        ui.setPanel(bar);
        const tool = new THREE.Group();
        tool.position.copy(WORK);
        props.add(tool);
        tool.add(mk(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 16), toon('#4A4A55'), 0, 0.07, 0));
        for (let k = 0; k < 6; k++) tool.add(mk(new THREE.DodecahedronGeometry(0.045), basicMat('#F2753A'), Math.cos(k) * 0.12, 0.15, Math.sin(k) * 0.12));
        const foods = [];
        const raw = st.item === 'grill' ? '#C9D6E0' : r.id === 'matzah' ? '#F6F0E2' : '#FFF6E0';
        if (st.item === 'grill') {
          for (let k = -2; k <= 2; k++) tool.add(mk(new THREE.BoxGeometry(0.5, 0.012, 0.012), toon('#5A5A5A'), 0, 0.2, k * 0.06));
          const mat = ownMat(raw);
          const f = makeFish3D({ id: 'grill', rarity: 0, body: raw, fin: '#9FB3C0', mat }, 0.36);
          f.position.y = 0.25;
          tool.add(f);
          foods.push(mat);
        } else {
          tool.add(mk(new THREE.CylinderGeometry(0.28, 0.25, 0.04, 20), toon('#5A5A62'), 0, 0.19, 0));
          tool.add(mk(new THREE.BoxGeometry(0.3, 0.025, 0.05), toon('#6B4429'), 0.42, 0.2, 0));
          const mat = ownMat(raw);
          if (r.id === 'matzah') tool.add(mk(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 20), mat, 0, 0.225, 0));
          else for (let k = 0; k < 5; k++) tool.add(mk(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 12), mat, Math.cos(k * 1.26) * 0.13, 0.225, Math.sin(k * 1.26) * 0.13));
          foods.push(mat);
        }
        const smoke = [];
        let val = 0, dir = 1, over = false, smokeT = 0;
        const speed = 0.5 + Math.random() * 0.25;
        const golden = st.item === 'grill' ? '#D99A50' : '#E0A44A';
        ui.setMain('멈추기!', {
          pulse: true,
          onClick: () => {
            if (over) return;
            over = true;
            const d = Math.abs(val - zone);
            const txt = d < 0.09 ? '딱 좋아요!' : d < 0.2 ? '조금 아쉬워요' : val < zone ? '덜 익었어요' : '조금 탔어요';
            ui.say(txt);
            ui.setMain(txt, { disabled: true });
            if (d < 0.09) sfx.ding(); else sfx.fail();
            setTimeout(() => done(d < 0.09 ? 1 : Math.max(0.3, 1 - d * 2.2)), 900);
          },
        });
        return {
          update(dt) {
            if (!over) {
              val += dir * speed * dt;
              if (val > 1) { val = 1; dir = -1; } if (val < 0) { val = 0; dir = 1; }
              bar.lastChild.style.left = val * 100 + '%';
            }
            const c = val < zone ? mixColor(raw, golden, val / zone) : mixColor(golden, '#4E3424', (val - zone) / (1 - zone));
            for (const m of foods) m.color.copy(c);
            smokeT -= dt;
            if (val > zone + 0.12 && smokeT <= 0) {
              smokeT = 0.18;
              const s = mk(new THREE.SphereGeometry(0.05, 8, 6), basicMat('#8A8A8A', 0.5), WORK.x + (Math.random() - 0.5) * 0.2, TOP + 0.3, WORK.z);
              props.add(s);
              smoke.push({ m: s, t: 0 });
            }
            for (let i = smoke.length - 1; i >= 0; i--) {
              const s = smoke[i];
              s.t += dt;
              s.m.position.y += dt * 0.5;
              s.m.scale.setScalar(1 + s.t * 2);
              s.m.material.opacity = 0.5 * (1 - s.t);
              if (s.t >= 1) { disposeTree(s.m); smoke.splice(i, 1); }
            }
          },
          stop() { over = true; },
        };
      },

      pick(st, done) {
        const ids = shuffle([...st.want, ...st.decoy]);
        const chosen = new Set();
        const toPot = r.id === 'lentil' && st.title.includes('재료');
        if (!toPot) props.add(mk(new THREE.CylinderGeometry(0.22, 0.17, 0.03, 20), toon('#FFFDF7'), WORK.x, TOP + 0.015, -0.12));
        const objs = ids.map((id, k) => {
          const g = makeIngredient(id);
          const x = -0.25 + (k / Math.max(1, ids.length - 1)) * 1.5;
          g.position.set(x, TOP, -0.48);
          props.add(g);
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 20), basicMat('#F6D55C', 0.95));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(x, TOP + 0.005, -0.48);
          ring.visible = false;
          props.add(ring);
          return { id, g, ring, lb: ui.label(ingName(id)), home: g.position.clone(), lift: 0, shake: 0 };
        });
        let over = false;
        const label = () => ui.setMain(chosen.size ? `다 골랐어요 (${chosen.size})` : '다 골랐어요', { disabled: !chosen.size, onClick: submit });
        label();
        function submit() {
          if (over) return;
          over = true;
          ui.setMain('…', { disabled: true });
          const wrong = [...chosen].filter((id) => !st.want.includes(id)).length;
          const miss = st.want.filter((id) => !chosen.has(id)).length;
          const dest = toPot ? POT.clone().setY(POT.y + 0.05) : V(WORK.x, TOP + 0.04, -0.12);
          let n = 0;
          for (const o of objs) {
            o.ring.visible = false;
            if (st.want.includes(o.id)) {
              const d = dest.clone().add(V((n - 0.5) * 0.13, 0, 0));
              o.home = null;
              const delay = n * 180;
              n++;
              setTimeout(() => {
                if (!live(game)) return;
                fly(o.g, d, { dur: 0.6, arc: 0.55, done: () => { if (toPot) { o.g.visible = false; sfx.blub(); } else sfx.pop(); } });
              }, delay);
            } else if (chosen.has(o.id)) o.shake = 0.6;
          }
          if (wrong || miss) {
            sfx.fail();
            ui.say(`정답은 ${josa(st.want.map(ingName).join(', '), '이에요', '예요')}.`);
            setTimeout(() => done(Math.max(0.3, 1 - (wrong + miss) * 0.25)), 2000);
          } else { ui.say('딱 맞게 골랐어요!'); setTimeout(() => done(1), 1300); }
        }
        return {
          update(dt, time) {
            for (const o of objs) {
              const want = chosen.has(o.id) && !over ? 1 : 0;
              o.lift = lerp(o.lift, want, 1 - Math.exp(-dt * 10));
              if (o.home) {
                o.g.position.y = o.home.y + o.lift * 0.1 + (want ? Math.sin(time * 6) * 0.01 : 0);
                if (o.shake > 0) { o.shake = Math.max(0, o.shake - dt); o.g.position.x = o.home.x + Math.sin(o.shake * 40) * 0.025; }
              }
              if (!over) ui.place(o.lb, local(o.g.position), 0.3); else o.lb.style.display = 'none';
            }
          },
          tap(ray, x, y) {
            if (over) return;
            let best = null, bd = 80;
            for (const o of objs) {
              const s = screenOf(v, local(o.g.position.clone().setY(TOP + 0.09)));
              const d = Math.hypot(s.x - x, s.y - y);
              if (d < bd) { bd = d; best = o; }
            }
            if (!best) return;
            if (chosen.has(best.id)) chosen.delete(best.id); else chosen.add(best.id);
            best.ring.visible = chosen.has(best.id);
            best.lb.classList.toggle('on', chosen.has(best.id));
            sfx.pop();
            label();
          },
          stop() { over = true; for (const o of objs) o.lb.remove(); },
          targets: () => objs.map((o) => ({ id: o.id, want: st.want.includes(o.id), ...screenOf(v, local(o.g.position.clone().setY(TOP + 0.09))) })),
        };
      },

      stir(st, done) {
        const spoon = makeSpoon();
        const soupTex = canvasTex(256, 256, (c, w) => {
          c.fillStyle = r.color; c.fillRect(0, 0, w, w);
          c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 7;
          c.beginPath();
          for (let a = 0; a < Math.PI * 6; a += 0.1) { const rr = 10 + a * 6; c.lineTo(w / 2 + Math.cos(a) * rr, w / 2 + Math.sin(a) * rr); }
          c.stroke();
        });
        const soup = new THREE.Mesh(new THREE.CircleGeometry(0.34, 30), ownMat('#FFFFFF', { map: soupTex }));
        soup.rotation.x = -Math.PI / 2;
        soup.position.set(POT.x, POT.y + 0.006, POT.z);
        props.add(soup);
        props.add(spoon);
        const count = h('span', { class: 'g-chip' }, `0 / ${st.need}바퀴`);
        ui.setPanel(count, h('span', { class: 'g-chip' }, '냄비 둘레를 손가락으로 빙글빙글!'));
        let acc = 0, lastA = null, taps = 0, lastQ = 0, over = false, vis = 0;
        const bubbles = [];
        const t0 = performance.now();
        const angle = (x, y) => { const c = screenOf(v, local(POT)); return Math.atan2(y - c.y, x - c.x); };
        const update = () => {
          const turns = Math.min(st.need, Math.floor(Math.abs(acc) / (Math.PI * 2) + taps / 4));
          const quarter = Math.floor(Math.abs(acc) / (Math.PI / 2)) + taps;
          if (quarter !== lastQ) {
            lastQ = quarter;
            sfx.blub();
            const b = mk(new THREE.SphereGeometry(0.03, 8, 6), basicMat('#FFFFFF', 0.7), POT.x + (Math.random() - 0.5) * 0.4, POT.y + 0.01, POT.z + (Math.random() - 0.5) * 0.4);
            props.add(b);
            bubbles.push({ m: b, t: 0 });
          }
          count.textContent = `${turns} / ${st.need}바퀴`;
          if (turns >= st.need && !over) {
            over = true;
            const used = (performance.now() - t0) / 1000;
            ui.say('보글보글 잘 끓었어요!');
            ui.setMain('…', { disabled: true });
            setTimeout(() => done(Math.min(1, Math.max(0.6, 1.25 - used / 16))), 600);
          }
        };
        ui.setMain('젓기', { onClick: () => { if (!over) { taps++; update(); } } });
        return {
          update(dt) {
            vis = lerp(vis, acc + taps * (Math.PI / 2), 1 - Math.exp(-dt * 10));
            const a = vis;
            spoon.position.set(POT.x + Math.cos(a) * 0.2, POT.y + 0.32, POT.z + Math.sin(a) * 0.2);
            spoon.rotation.set(-Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35);
            soup.rotation.z = -vis * 0.6;
            for (let i = bubbles.length - 1; i >= 0; i--) {
              const b = bubbles[i];
              b.t += dt;
              b.m.scale.setScalar(1 + b.t * 2);
              b.m.material.opacity = 0.7 * (1 - b.t / 0.6);
              if (b.t > 0.6) { disposeTree(b.m); bubbles.splice(i, 1); }
            }
          },
          pointer(type, x, y) {
            if (over) return;
            if (type === 'down') { lastA = angle(x, y); taps++; update(); } else if (type === 'move' && lastA !== null) {
              const a = angle(x, y);
              let d = a - lastA;
              if (d > Math.PI) d -= Math.PI * 2;
              if (d < -Math.PI) d += Math.PI * 2;
              acc += d;
              lastA = a;
              update();
            } else if (type === 'up') lastA = null;
          },
          stop() { over = true; },
        };
      },

      count(st, done) {
        const basket = makeBasket(0.2);
        basket.position.set(WORK.x, TOP, -0.15);
        props.add(basket);
        const kinds = [...Object.keys(st.want), 'apple'];
        const xs = { bread: -0.2, fish: 1.15, apple: 0.85 };
        const piles = kinds.map((id) => {
          const g = new THREE.Group();
          g.position.set(xs[id] != null ? xs[id] : 0.2, TOP, -0.5);
          for (let k = 0; k < 4; k++) { const it = makeIngredient(id); it.scale.setScalar(0.85); it.position.set((k % 2 - 0.5) * 0.14, Math.floor(k / 2) * 0.07, (k % 3 - 1) * 0.05); g.add(it); }
          props.add(g);
          return { id, g, lb: ui.label(`${ingName(id)} +1`) };
        });
        const basketItems = [];
        const inBasket = {};
        const chips = h('span', { class: 'g-chip' }, '바구니가 비어 있어요');
        const draw = () => {
          const parts = Object.entries(inBasket).filter(([, n]) => n).map(([id, n]) => `${ingName(id)} ${n}`);
          chips.textContent = parts.length ? `바구니: ${parts.join(' · ')}` : '바구니가 비어 있어요';
        };
        let over = false;
        const empty = h('button', {
          class: 'g-chip', type: 'button',
          onclick: () => {
            if (over) return;
            for (const it of basketItems) disposeTree(it);
            basketItems.length = 0;
            for (const k of Object.keys(inBasket)) delete inBasket[k];
            draw();
          },
        }, '바구니 비우기');
        ui.setPanel(chips, empty);
        ui.setMain('다 담았어요', {
          onClick: () => {
            if (over) return;
            over = true;
            const exact = Object.entries(st.want).every(([id, n]) => inBasket[id] === n) && Object.keys(inBasket).every((id) => !inBasket[id] || st.want[id]);
            ui.setMain('…', { disabled: true });
            if (exact) { ui.say('보리빵 다섯 개와 물고기 두 마리, 딱 맞아요!'); setTimeout(() => done(1), 1000); } else {
              sfx.fail();
              ui.say('정답은 보리빵 다섯 개와 물고기 두 마리예요.');
              setTimeout(() => done(0.5), 2000);
            }
          },
        });
        return {
          update() { for (const p of piles) { if (over) p.lb.style.display = 'none'; else ui.place(p.lb, local(p.g.position), 0.36); } },
          tap(ray, x, y) {
            if (over) return;
            let best = null, bd = 85;
            for (const p of piles) {
              const s = screenOf(v, local(p.g.position.clone().setY(TOP + 0.08)));
              const d = Math.hypot(s.x - x, s.y - y);
              if (d < bd) { bd = d; best = p; }
            }
            if (!best) return;
            const n = basketItems.length;
            const it = makeIngredient(best.id);
            it.scale.setScalar(0.7);
            it.position.copy(best.g.position).setY(TOP + 0.12);
            props.add(it);
            basketItems.push(it);
            inBasket[best.id] = (inBasket[best.id] || 0) + 1;
            draw();
            sfx.pop();
            fly(it, V(WORK.x + ((n % 3) - 1) * 0.08, TOP + 0.05 + Math.floor(n / 3) * 0.05, -0.15 + ((n % 2) - 0.5) * 0.06), { dur: 0.4, arc: 0.35 });
          },
          stop() { over = true; for (const p of piles) p.lb.remove(); },
          targets: () => piles.map((p) => ({ id: p.id, ...screenOf(v, local(p.g.position.clone().setY(TOP + 0.08))) })),
        };
      },
    };

    let dish = null;
    async function finish() {
      run.over = true;
      clearProps();
      ui.setPanel();
      const avg = run.scores.reduce((a, b) => a + (b || 0), 0) / r.steps.length;
      const stars = starsOf(avg);
      const together = !!session && !run.alone;
      standAt('work', 'me', showPose);
      if (together) standAt('side', 'peer', cheerPose);
      game.cam = camAt(sp, [0.5, 2.5, 3.8], [0.5, 1.25, -0.9], 1.45);
      dish = makeDish(r);
      v.scene.add(dish);
      ui.banner(`${r.name} 완성!`, starText(stars), 3200);
      ui.say(together ? `${josa(peerName, '과', '와')} 함께 만들었어요. ${r.ref}에 나오는 음식이에요.` : `${r.ref}에 나오는 음식이에요.`, `숲속 부엌 · ${r.name}`);
      if (stars >= 2) { confetti(); onCelebrate(); } else sfx.success();
      ui.setMain('…', { disabled: true });
      try {
        const res = await rpc('kids_cook_done', { p_token: getToken(), p_recipe: r.id, p_stars: stars, p_together: together });
        if (res) cookBook = res;
      } catch (e) { if (lost(e)) return; toast(message(e)); }
      if (!live(game)) return;
      ui.setPanel(h('button', { class: 'g-chip', type: 'button', onclick: () => { stopAll(); cookMenu(); } }, '다른 요리 고르기'));
      ui.setMain('한 번 더', { onClick: () => { stopAll(); cook({ recipe: r }); } });
    }

    game.update = (dt, time) => {
      if (step && step.update) step.update(dt, time);
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt;
        const k = clamp01(f.t / f.dur);
        f.obj.position.lerpVectors(f.from, f.to, ease(k));
        f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
        if (f.spin) f.obj.rotation.x += f.spin * dt;
        if (k >= 1) { flying.splice(i, 1); if (f.done) f.done(); }
      }
      if (dish) {
        dish.position.copy(handFront(pl, 0.78, 1.02));
        dish.rotation.y = sp.rot;
      }
    };
    game.onTap = (ray, x, y) => { if (step && step.tap) step.tap(ray, x, y); };
    game.onPointer = (type, x, y) => { if (step && step.pointer) step.pointer(type, x, y); };
    game.ownsDrag = () => !!(step && step.pointer); // 냄비 젓기 중에는 끌어도 화면이 돌지 않는다
    game.state = () => ({ i: run.i, scores: run.scores, alone: run.alone, over: run.over, step: r.steps[run.i] && r.steps[run.i].type, owner: run.i < r.steps.length ? owner(run.i) : '' });
    game.screenOf = (lx, ly, lz) => screenOf(v, local(V(lx, ly, lz)));
    game.targets = () => (step && step.targets ? step.targets() : []);
    game.stop = () => {
      if (step) { step.stop(); step = null; }
      if (session && !session.closed) session.close();
      if (session) v.unpinRemote(session.peer);
      disposeTree(dish);
      dish = null;
      disposeTree(grp);
      pl.pose = null;
    };

    begin('cook', `숲속 부엌 · ${r.name}`, game);
    if (session) toast(owner(0) === 'me' ? `${josa(peerName, '과', '와')} 번갈아 만들어요. 1단계는 내 차례!` : `${josa(peerName, '과', '와')} 번갈아 만들어요. 2단계가 내 차례예요!`, 3400);
    play();
  }

  // =====================================================================
  // 마음대로 요리하기: 냉장고에서 꺼내고, 도마에서 썰고, 끓이거나 볶거나 굽고, 접시에 담아 마을 식탁에
  // =====================================================================
  async function cookFree() {
    stopAll();
    const sp = v.spots.cook;
    const pl = v.player;
    const grp = new THREE.Group();
    grp.position.set(sp.x, 0, sp.z);
    grp.rotation.y = sp.rot;
    v.scene.add(grp);
    grp.updateMatrixWorld(true);
    const TOP = 0.98;
    const BOARD = V(0.2, TOP, -0.32);
    const STOVE = V(0.95, TOP, -0.32);
    const POT = V(1.85, 0.72, 0.5);
    const local = (p) => grp.localToWorld(p.clone());
    const camWide = camAt(sp, [-1.0, 3.6, 4.6], [-0.4, 0.85, -0.5], 1.6);
    const camBoard = camAt(sp, [0.25, 2.35, 2.35], [0.22, 0.95, -0.38], 1.3);
    const camStove = camAt(sp, [0.95, 2.4, 2.4], [0.95, 0.98, -0.35], 1.3);
    const camPot = camAt(sp, [1.85, 3.0, 2.75], [1.85, 0.75, 0.3], 1.25);
    const camPlate = camAt(sp, [0.2, 2.5, 3.8], [0.2, 1.25, -0.9], 1.45);
    const game = { cam: camWide, camSpeed: 2.6 };
    const flying = [], fx = [];
    let phase = 'pick', dish = null, stepUpd = null, kind = null;
    const chosen = []; // { id, info, mesh, pieces: [] }

    // 냉장고 (조리대 왼쪽)
    const fridge = new THREE.Group();
    fridge.position.set(-2.2, 0, -1.25);
    fridge.add(mk(new THREE.BoxGeometry(0.78, 1.7, 0.62), toon('#EEF3F6'), 0, 0.85, 0));
    fridge.add(mk(new THREE.BoxGeometry(0.8, 0.04, 0.64), toon('#B7C3CB'), 0, 1.15, 0));
    const hinge = new THREE.Group();
    hinge.position.set(0.39, 0, 0.31);
    const door = mk(new THREE.BoxGeometry(0.78, 1.66, 0.05), toon('#F7FAFC'), -0.39, 0.85, 0.025);
    hinge.add(door);
    hinge.add(mk(new THREE.BoxGeometry(0.04, 0.4, 0.04), toon('#9AA7B0'), -0.7, 1.0, 0.07));
    fridge.add(hinge);
    for (const [y, c] of [[1.42, '#EF6461'], [1.32, '#F6D55C'], [0.55, '#5DB760']]) fridge.add(mk(new THREE.SphereGeometry(0.06, 10, 8), toon(c), -0.2 + (y % 0.2), y, 0.2));
    grp.add(fridge);
    let doorOpen = 0, doorWant = 0;
    // 도마와 칼
    grp.add(mk(new THREE.BoxGeometry(0.56, 0.035, 0.38), toon('#D8A869'), BOARD.x, TOP + 0.017, BOARD.z));
    const knife = new THREE.Group();
    knife.add(mk(new THREE.BoxGeometry(0.24, 0.07, 0.008), toon('#D7DEE3'), -0.12, 0, 0));
    knife.add(mk(new THREE.BoxGeometry(0.11, 0.035, 0.03), toon('#6B4429'), 0.055, 0.005, 0));
    knife.position.set(BOARD.x + 0.1, TOP + 0.22, BOARD.z + 0.02);
    knife.rotation.y = 0.2;
    grp.add(knife);
    let knifeT = 0;
    const pieceMats = new Map();
    const pieceMat = (col) => { if (!pieceMats.has(col)) pieceMats.set(col, ownMat(col)); return pieceMats.get(col); };

    function fly(obj, to, { dur = 0.5, arc = 0.4, done, spin = 0 } = {}) { flying.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur, arc, done, spin }); }
    const slot = (i) => V(0.62 + i * 0.17, TOP, -0.5);

    v.placePlayer(...(() => { const p = spotPoint(sp, 0.25, 0, -1.15); return [p.x, p.z]; })(), sp.rot, 0);
    pl.pose = restPose;

    // 내가 낚아 본 물고기
    let myFish = [];
    try {
      const b = await rpc('kids_fish_book', { p_token: getToken() });
      myFish = FISH.filter((f) => f.rarity >= 0 && b && b.mine && b.mine[f.id] && b.mine[f.id].count > 0).map((f) => `fish_${f.id}`);
    } catch (e) { if (lost(e)) return; }

    // ---------- 1. 재료 꺼내기 ----------
    function pickUi() {
      phase = 'pick';
      game.cam = camWide;
      ui.say(chosen.length ? `재료 ${chosen.length}가지. 더 꺼내거나 ‘썰기’를 눌러요.` : '냉장고에서 재료를 꺼내요. 4가지까지 고를 수 있어요.', '숲속 부엌 · 마음대로 요리');
      const chip = (id) => {
        const inf = ingInfo(id);
        const on = chosen.some((c) => c.id === id);
        return h('button', { class: 'g-chip ing-chip' + (on ? ' on' : ''), type: 'button', 'data-ing': id, onclick: () => toggle(id) },
          h('i', { style: `background:${inf.color}` }), inf.name);
      };
      ui.setPanel(h('div', { class: 'fridge-box' },
        h('div', { class: 'fridge-grid' }, FRIDGE.map(chip)),
        h('p', { class: 'fridge-sub' }, myFish.length ? '내가 낚은 물고기' : '연못에서 물고기를 낚으면 여기에 생겨요'),
        myFish.length ? h('div', { class: 'fridge-grid' }, myFish.map(chip)) : null));
      ui.setMain('썰기', { disabled: !chosen.length, pulse: chosen.length > 0, onClick: startChop });
    }
    function toggle(id) {
      const at = chosen.findIndex((c) => c.id === id);
      if (at >= 0) {
        const c = chosen.splice(at, 1)[0];
        disposeTree(c.mesh);
        chosen.forEach((cc, i) => fly(cc.mesh, slot(i), { dur: 0.3, arc: 0.1 }));
        sfx.pop(true);
        pickUi();
        return;
      }
      if (chosen.length >= 4) { toast('재료는 4가지까지예요.'); return; }
      const mesh = makeIngredient(id);
      mesh.position.set(fridge.position.x + 0.1, 1.0, fridge.position.z + 0.45);
      grp.add(mesh);
      const c = { id, info: ingInfo(id), mesh, pieces: [], chops: 0 };
      chosen.push(c);
      doorWant = 1;
      sfx.door();
      setTimeout(() => { doorWant = 0; }, 900);
      fly(mesh, slot(chosen.length - 1), { dur: 0.6, arc: 0.6, done: () => sfx.pop() });
      pickUi();
    }

    // ---------- 2. 썰기 ----------
    let cur = -1;
    function startChop() {
      phase = 'chop';
      game.cam = camBoard;
      pl.pose = workPose;
      cur = -1;
      nextIngredient();
    }
    function nextIngredient() {
      cur++;
      if (cur >= chosen.length) { methodUi(); return; }
      const c = chosen[cur];
      fly(c.mesh, V(BOARD.x - 0.02, TOP + 0.035, BOARD.z + 0.06), { dur: 0.35, arc: 0.2 });
      if (NO_CUT.includes(c.id)) {
        ui.say(`${josa(c.info.name, '은', '는')} 썰지 않고 그대로 넣어요.`, '숲속 부엌 · 썰기');
        ui.setMain('넣기', { pulse: true, onClick: () => { c.done = true; sfx.pop(); fly(c.mesh, V(BOARD.x - 0.18 + cur * 0.12, TOP + 0.035, BOARD.z - 0.1), { dur: 0.3, arc: 0.15 }); nextIngredient(); } });
      } else {
        ui.say(`${josa(c.info.name, '을', '를')} 싹둑싹둑 썰어요! ‘싹둑!’을 누르거나 도마를 눌러요.`, '숲속 부엌 · 썰기');
        ui.setMain('싹둑!', { pulse: true, onClick: chop });
      }
      ui.setPanel(h('button', { class: 'g-chip', type: 'button', onclick: () => { for (const cc of chosen) cc.done = true; cur = chosen.length; methodUi(); } }, '다 썰었어요'));
    }
    function chop() {
      if (phase !== 'chop' || cur < 0 || cur >= chosen.length) return;
      const c = chosen[cur];
      if (NO_CUT.includes(c.id) || c.done) return;
      c.chops++;
      knifeT = 1;
      sfx.chop();
      // 한 조각이 떨어져 나와 도마 뒤쪽으로
      const isFish = c.id.startsWith('fish_');
      const p = mk(isFish ? new THREE.BoxGeometry(0.06, 0.02, 0.04) : (c.chops % 2 ? new THREE.CylinderGeometry(0.03, 0.03, 0.018, 10) : new THREE.BoxGeometry(0.045, 0.03, 0.045)), pieceMat(c.info.piece), BOARD.x + 0.09, TOP + 0.05, BOARD.z + 0.06);
      grp.add(p);
      c.pieces.push(p);
      fly(p, V(BOARD.x - 0.2 + (c.pieces.length % 4) * 0.035 + cur * 0.1, TOP + 0.045 + Math.floor(c.pieces.length / 4) * 0.02, BOARD.z - 0.12 + (cur % 2) * 0.03), { dur: 0.3, arc: 0.12 });
      const k = Math.max(0.15, 1 - c.chops * 0.18);
      c.mesh.scale.set(k, 1, 1);
      for (let i = 0; i < 3; i++) {
        const d = mk(new THREE.SphereGeometry(0.008, 4, 3), pieceMat(c.info.piece), BOARD.x + 0.08, TOP + 0.06, BOARD.z + 0.06);
        grp.add(d);
        fx.push({ m: d, life: 0, max: 0.4, vel: V((Math.random() - 0.5) * 0.8, 1 + Math.random(), (Math.random() - 0.5) * 0.8) });
      }
      if (c.chops >= 5) {
        c.done = true;
        disposeTree(c.mesh);
        c.mesh = null;
        sfx.ding();
        setTimeout(() => { if (live(game) && phase === 'chop') nextIngredient(); }, 350);
      }
    }

    // ---------- 3. 요리 방법 ----------
    function methodUi() {
      phase = 'method';
      game.cam = camWide;
      pl.pose = restPose;
      ui.say('어떻게 요리할까요?', '숲속 부엌 · 요리하기');
      ui.setMain('…', { disabled: true, hidden: true });
      ui.setPanel(h('div', { class: 'g-row wrap' }, Object.entries(COOK_KIND).map(([k, [, label, ic]]) => h('button', { class: 'g-chip big', type: 'button', 'data-kind': k, onclick: () => startCook(k) }, `${ic} ${label}`))));
    }
    const allPieces = () => chosen.flatMap((c) => (c.pieces.length ? c.pieces : c.mesh ? [c.mesh] : []));

    function startCook(k) {
      kind = k;
      ui.setPanel();
      ui.setMain('…', { disabled: true });
      if (k === 'soup') return soup();
      if (k === 'salad') return salad();
      return pan(k);
    }

    // 냄비에 끓이기
    function soup() {
      phase = 'soup';
      game.cam = camPot;
      const p0 = spotPoint(sp, 1.85, 0, -0.3);
      v.placePlayer(p0.x, p0.z, sp.rot, 0);
      pl.pose = workPose;
      const spoon = makeSpoon();
      grp.add(spoon);
      const surface = mk(new THREE.CircleGeometry(0.34, 30), ownMat('#BFE3F2'), POT.x, POT.y + 0.006, POT.z);
      surface.rotation.x = -Math.PI / 2;
      grp.add(surface);
      const target = avgColor(chosen.map((c) => c.info.piece)).lerp(new THREE.Color('#E8C98F'), 0.45);
      const water = new THREE.Color('#BFE3F2');
      allPieces().forEach((p, i) => {
        const a = (i / 8) * Math.PI * 2, r = 0.08 + (i % 3) * 0.06;
        setTimeout(() => { if (live(game)) fly(p, V(POT.x + Math.cos(a) * r, POT.y + 0.02, POT.z + Math.sin(a) * r), { dur: 0.55, arc: 0.5, done: () => sfx.blub() }); }, i * 60);
      });
      let acc = 0, lastA = null, taps = 0, vis = 0, over = false, lastQ = 0;
      const need = 8;
      const count = h('span', { class: 'g-chip' }, '보글보글 0%');
      ui.setPanel(count, h('span', { class: 'g-chip' }, '냄비 둘레를 손가락으로 빙글빙글!'));
      ui.say('국자로 빙글빙글 저어 끓여요.', '숲속 부엌 · 끓이기');
      const update = () => {
        const q = Math.floor(Math.abs(acc) / (Math.PI / 2)) + taps;
        if (q !== lastQ) { lastQ = q; sfx.blub(); }
        const k = Math.min(1, q / need);
        count.textContent = `보글보글 ${Math.round(k * 100)}%`;
        surface.material.color.copy(water.clone().lerp(target, k));
        if (k >= 1 && !over) { over = true; ui.say('맛있게 끓었어요!'); setTimeout(() => plate(), 700); }
      };
      ui.setMain('젓기', { onClick: () => { if (!over) { taps++; update(); } } });
      const angle = (x, y) => { const c = screenOf(v, local(POT)); return Math.atan2(y - c.y, x - c.x); };
      game.ownsDrag = () => phase === 'soup';
      game.onPointer = (type, x, y) => {
        if (phase !== 'soup' || over) return;
        if (type === 'down') { lastA = angle(x, y); } else if (type === 'move' && lastA !== null) {
          const a = angle(x, y);
          let d = a - lastA;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          acc += d; lastA = a; update();
        } else if (type === 'up') lastA = null;
      };
      let bubbleT = 0;
      stepUpd = (dt, time) => {
        vis = lerp(vis, acc + taps * (Math.PI / 2), 1 - Math.exp(-dt * 10));
        spoon.position.set(POT.x + Math.cos(vis) * 0.2, POT.y + 0.32, POT.z + Math.sin(vis) * 0.2);
        spoon.rotation.set(-Math.sin(vis) * 0.35, 0, Math.cos(vis) * 0.35);
        for (const p of allPieces()) if (!flying.some((f) => f.obj === p)) p.position.y = POT.y + 0.02 + Math.sin(time * 4 + p.id) * 0.008;
        bubbleT -= dt;
        if (bubbleT <= 0) {
          bubbleT = 0.25;
          const b = mk(new THREE.SphereGeometry(0.025, 8, 6), basicMat('#FFFFFF', 0.7), POT.x + (Math.random() - 0.5) * 0.4, POT.y + 0.015, POT.z + (Math.random() - 0.5) * 0.4);
          grp.add(b);
          fx.push({ m: b, life: 0, max: 0.6, grow: true });
        }
      };
      stepUpd.cleanup = () => { disposeTree(spoon); disposeTree(surface); game.ownsDrag = null; game.onPointer = null; };
    }

    // 프라이팬에 볶기, 화로에 굽기
    function pan(k) {
      phase = k;
      game.cam = camStove;
      const p0 = spotPoint(sp, 0.95, 0, -1.15);
      v.placePlayer(p0.x, p0.z, sp.rot, 0);
      pl.pose = workPose;
      const stove = new THREE.Group();
      stove.position.copy(STOVE);
      stove.add(mk(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 16), toon('#4A4A55'), 0, 0.07, 0));
      for (let i = 0; i < 6; i++) stove.add(mk(new THREE.DodecahedronGeometry(0.045), basicMat('#F2753A'), Math.cos(i) * 0.12, 0.15, Math.sin(i) * 0.12));
      if (k === 'fry') {
        stove.add(mk(new THREE.CylinderGeometry(0.29, 0.25, 0.045, 22), toon('#3E3E46'), 0, 0.19, 0));
        stove.add(mk(new THREE.BoxGeometry(0.34, 0.03, 0.05), toon('#6B4429'), 0.45, 0.2, 0));
      } else {
        for (let i = -2; i <= 2; i++) stove.add(mk(new THREE.BoxGeometry(0.5, 0.012, 0.012), toon('#5A5A5A'), 0, 0.2, i * 0.06));
      }
      grp.add(stove);
      const base = k === 'fry' ? TOP + 0.235 : TOP + 0.225;
      const ps = allPieces();
      ps.forEach((p, i) => {
        const a = (i / Math.max(1, ps.length)) * Math.PI * 2 * 2.3, r = 0.04 + (i % 4) * 0.045;
        p.userData.home = V(STOVE.x + Math.cos(a) * r, base, STOVE.z + Math.sin(a) * r);
        p.userData.vy = 0; p.userData.y = 0;
        setTimeout(() => { if (live(game)) fly(p, p.userData.home, { dur: 0.5, arc: 0.45, done: () => sfx.sizzle() }); }, i * 50);
      });
      // 조각 색을 바꿀 수 있게 재료마다 따로 칠한다
      const mats = [];
      chosen.forEach((c) => {
        const list = c.pieces.length ? c.pieces : c.mesh ? [c.mesh] : [];
        list.forEach((p) => p.traverse((o) => {
          if (o.isMesh) { const m = ownMat(o.material.color ? o.material.color.clone() : new THREE.Color(c.info.piece)); m.userData.base = m.color.clone(); o.material = m; mats.push(m); }
        }));
      });
      const brown = new THREE.Color(k === 'fry' ? '#B9772F' : '#7A4A22');
      let tosses = 0;
      const need = 8;
      const verb = k === 'fry' ? '볶기!' : '뒤집기!';
      const count = h('span', { class: 'g-chip' }, `${k === 'fry' ? '볶기' : '굽기'} 0 / ${need}`);
      ui.setPanel(count);
      ui.say(k === 'fry' ? '지글지글! 프라이팬을 흔들어 골고루 볶아요.' : '화로에 올렸어요. 타지 않게 뒤집어 가며 구워요.', `숲속 부엌 · ${k === 'fry' ? '볶기' : '굽기'}`);
      const toss = () => {
        tosses++;
        sfx.sizzle();
        for (const p of ps) { p.userData.vy = 1.2 + Math.random() * 0.8; p.userData.spin = (Math.random() - 0.5) * 14; }
        const kk = Math.min(1, tosses / need) * (k === 'fry' ? 0.38 : 0.5) + Math.max(0, tosses - need * 1.6) * 0.04;
        for (const m of mats) m.color.copy(m.userData.base).lerp(brown, Math.min(0.85, kk));
        count.textContent = tosses >= need ? (tosses > need * 1.6 ? '바삭바삭! 이제 담아요' : '알맞게 익었어요!') : `${k === 'fry' ? '볶기' : '굽기'} ${tosses} / ${need}`;
        if (tosses === need) {
          sfx.ding();
          ui.setPanel(count, h('button', { class: 'g-chip', type: 'button', onclick: () => toss() }, k === 'fry' ? '조금 더 볶기' : '한 번 더 굽기'));
          ui.setMain('접시에 담기', { pulse: true, onClick: () => plate() });
        }
      };
      ui.setMain(verb, { pulse: true, onClick: toss });
      game.onTap = () => { if (phase === k) toss(); };
      let oilT = 0;
      stepUpd = (dt) => {
        for (const p of ps) {
          if (flying.some((f) => f.obj === p) || !p.userData.home) continue;
          const u = p.userData;
          u.y += u.vy * dt; u.vy -= 6 * dt;
          if (u.y < 0) { u.y = 0; u.vy = 0; u.spin = 0; }
          p.position.set(u.home.x, u.home.y + u.y, u.home.z);
          if (u.spin) p.rotation.x += u.spin * dt;
        }
        oilT -= dt;
        if (oilT <= 0) {
          oilT = 0.12;
          const d = mk(new THREE.SphereGeometry(0.01, 4, 3), basicMat('#FFF3B0', 0.9), STOVE.x + (Math.random() - 0.5) * 0.4, base + 0.02, STOVE.z + (Math.random() - 0.5) * 0.3);
          grp.add(d);
          fx.push({ m: d, life: 0, max: 0.35, vel: V((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6) });
        }
      };
      stepUpd.cleanup = () => { disposeTree(stove); game.onTap = (ray, x, y) => onTapBase(ray, x, y); };
    }

    // 그대로 접시에 (샐러드)
    function salad() {
      phase = 'salad';
      ui.say('싱싱한 그대로 담아요!', '숲속 부엌 · 샐러드');
      setTimeout(() => plate(), 400);
    }

    // ---------- 4. 접시에 담기 ----------
    function plate() {
      if (stepUpd && stepUpd.cleanup) stepUpd.cleanup();
      stepUpd = null;
      phase = 'plate';
      for (const c of chosen) { for (const p of c.pieces) disposeTree(p); if (c.mesh) disposeTree(c.mesh); c.pieces = []; c.mesh = null; }
      const items = chosen.map((c) => c.id);
      const p0 = spotPoint(sp, 0.25, 0, -1.15);
      v.placePlayer(p0.x, p0.z, sp.rot, 0);
      dish = makeFreeDish(kind, items, Date.now() % 10000);
      v.scene.add(dish);
      pl.pose = showPose;
      game.cam = camPlate;
      const name0 = dishName(items, kind);
      ui.banner(`${name0} 완성!`, '이름을 붙여 마을 식탁에 올려 봐요', 2800);
      confetti();
      onCelebrate();
      ui.say('요리 이름을 바꿔도 돼요. 다 되면 ‘식탁에 올리기’를 눌러요.', `숲속 부엌 · ${name0}`);
      const input = h('input', { class: 'dish-name', maxlength: 12, value: name0, 'aria-label': '요리 이름' });
      ui.setPanel(h('div', { class: 'g-row' }, input), h('div', { class: 'g-row wrap' },
        h('button', { class: 'g-chip', type: 'button', onclick: () => { stopAll(); cookFree(); } }, '처음부터 다시'),
        h('button', { class: 'g-chip', type: 'button', onclick: () => { stopAll(); cookMenu(); } }, '요리책 보기')));
      let saving = false;
      ui.setMain('식탁에 올리기', {
        pulse: true,
        onClick: async () => {
          if (saving) return;
          saving = true;
          ui.setMain('…', { disabled: true });
          try {
            const r = await rpc('kids_dish_save', { p_token: getToken(), p_name: cleanChat(input.value) || name0, p_kind: kind, p_items: items });
            if (!live(game)) return;
            ui.banner('마을 식탁에 올렸어요!', r && r.name ? r.name : '', 2600);
            sfx.success();
            if (ctx.onDishShared) ctx.onDishShared();
            ui.say('놀이 마당 남쪽 ‘마을 식탁’에 내 요리가 놓였어요. 친구들도 볼 수 있어요.');
            ui.setPanel(h('div', { class: 'g-row wrap' }, h('button', { class: 'g-chip', type: 'button', onclick: () => { stopAll(); cookMenu(); } }, '요리책 보기')));
            ui.setMain('또 만들기', { onClick: () => { stopAll(); cookFree(); } });
          } catch (e) {
            saving = false;
            if (lost(e)) return;
            toast(message(e));
            ui.setMain('식탁에 올리기', { pulse: true });
          }
        },
      });
    }

    const onTapBase = (ray, x, y) => {
      if (phase === 'chop') { chop(); return; }
      if (phase === 'pick') {
        // 냉장고를 누르면 문이 열렸다 닫힌다
        const s = screenOf(v, local(V(fridge.position.x, 1.0, fridge.position.z + 0.3)));
        if (Math.hypot(s.x - x, s.y - y) < 90) { doorWant = 1; sfx.door(); setTimeout(() => { doorWant = 0; }, 900); }
      }
    };
    game.onTap = onTapBase;
    game.update = (dt, time) => {
      doorOpen = lerp(doorOpen, doorWant, 1 - Math.exp(-dt * 8));
      hinge.rotation.y = doorOpen * 1.6;
      knifeT = Math.max(0, knifeT - dt * 6);
      knife.position.y = TOP + 0.06 + (1 - Math.sin(knifeT * Math.PI)) * 0.16 * (knifeT > 0 ? 1 : 1);
      knife.rotation.z = knifeT > 0 ? -Math.sin(knifeT * Math.PI) * 0.25 : 0;
      if (stepUpd) stepUpd(dt, time);
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.t += dt;
        const k = clamp01(f.t / f.dur);
        f.obj.position.lerpVectors(f.from, f.to, ease(k));
        f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
        if (f.spin) f.obj.rotation.x += f.spin * dt;
        if (k >= 1) { flying.splice(i, 1); if (f.done) f.done(); }
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life += dt;
        if (p.vel) { p.vel.y -= 6 * dt; p.m.position.addScaledVector(p.vel, dt); }
        if (p.grow) { p.m.scale.setScalar(1 + p.life * 2); p.m.material.opacity = 0.7 * (1 - p.life / p.max); }
        if (p.life >= p.max) { disposeTree(p.m); fx.splice(i, 1); }
      }
      if (dish) { dish.position.copy(handFront(pl, 0.78, 1.02)); dish.rotation.y = sp.rot; }
    };
    game.state = () => ({ phase, chosen: chosen.map((c) => c.id), kind, cur, chops: chosen.map((c) => c.chops), done: chosen.map((c) => !!c.done) });
    game.screenOf = (lx, ly, lz) => screenOf(v, local(V(lx, ly, lz)));
    game.stop = () => {
      if (stepUpd && stepUpd.cleanup) stepUpd.cleanup();
      disposeTree(dish);
      dish = null;
      for (const f of fx) disposeTree(f.m);
      disposeTree(grp);
      for (const m of pieceMats.values()) m.dispose();
      pl.pose = null;
    };
    begin('cook', '숲속 부엌 · 마음대로 요리', game);
    pickUi();
  }

  // =====================================================================
  // 그림 이젤
  // =====================================================================
  function easel() {
    stopAll();
    const sp = v.spots.art;
    const er = sp.rot - 0.4;
    const ep = spotPoint(sp, 3.7, 0, 0.6);
    const along = (lx, ly, lz) => V(ep.x + lx * Math.cos(er) + lz * Math.sin(er), ly, ep.z - lx * Math.sin(er) + lz * Math.cos(er));
    const pl = v.player;
    // 이젤 왼쪽 앞에 서서 그림판을 바라본다. 카메라는 오른쪽 앞에서 아이와 그림을 함께 비춘다.
    const stand = along(-0.9, 0, 0.7);
    v.placePlayer(stand.x, stand.z, er + Math.atan2(0.9, -0.47), 0);
    const brush = makeBrush();
    pl.hold(brush, 1);
    let painting = 0;
    pl.pose = (av, dt, t) => {
      av.arms[1].rotation.x = -1.6 + (painting > 0 ? Math.sin(t * 10) * 0.25 : 0);
      av.arms[1].rotation.z = 0.05 + (painting > 0 ? Math.cos(t * 7) * 0.15 : 0);
      av.arms[0].rotation.x = -0.5;
      painting = Math.max(0, painting - dt);
    };
    const far = portrait() ? 1.35 : 1;
    const game = { cam: { pos: along(1.7 * far, 2.0, 3.0 * far), look: portrait() ? along(0.05, 1.15, 0.3) : along(-0.25, 1.15, 0.3) }, camSpeed: 2.6 };
    let opener = null;
    const openStudio = (start = 'draw') => {
      painting = 999;
      ctx.openArt(start, () => {
        painting = 0;
        if (!live(game)) return;
        ui.say('또 그리고 싶으면 ‘그리기’를 눌러요. 그림은 마을 전시관에도 걸 수 있어요.');
      });
    };
    game.stop = () => { clearTimeout(opener); pl.drop(); disposeTree(brush); pl.pose = null; };
    game.onSaved = async (b64) => {
      await v.setEasel(b64);
      if (live(game)) { ui.banner('이젤에 그림을 올렸어요!', '', 2400); pl.celebrate(); }
    };
    begin('art', '그림 공방 이젤', game, [['star', '전시관', () => openStudio('gallery')]]);
    ui.say('이젤 앞에 섰어요! 무엇을 그려 볼까요?');
    ui.setMain('그리기', { onClick: () => openStudio('draw') });
    opener = setTimeout(() => { if (live(game)) openStudio('draw'); }, 900);
  }
  // 그림을 저장했을 때 (그림판에서 알려 준다)
  function artSaved(b64) {
    if (cur && cur.id === 'art' && cur.game.onSaved) cur.game.onSaved(b64);
    else v.setEasel(b64);
  }

  return {
    fishing, omokMenu, omok, omokWatch, cookMenu, cook, cookFree, easel, artSaved,
    observe(id, st) { if (watchUpdate) watchUpdate(id, st); },
    stop: stopAll, decorateRemote,
    get active() { return cur && cur.id; },
    get game() { return cur && cur.game; },
  };
}
