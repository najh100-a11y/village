// 진숲 어린이 마을 — 곤충 채집
// 곤충은 정해진 자리(꽃밭, 풀밭, 나무줄기, 물가) 열두 곳에 나타난다. 어느 자리에 어떤 곤충이 있을지는
// 마을 시계로 정해서 친구 화면에도 같은 곤충이 같은 곳에 있다. 누가 잡으면 그 곤충은 모두의 화면에서 사라진다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { POOL } from './pool.js';

// 설명은 어린이용으로 짧게 쓴 일반적인 사실이다
export const BUGS = [
  { id: 'cabbage_white', name: '배추흰나비', rarity: 0, habitat: 'flower', shape: 'butterfly', wing: '#FFFDF7', mark: '#3A3A3A', desc: '하얀 날개 끝이 까매요. 애벌레는 배추, 무 같은 채소 잎을 먹고 자라요.' },
  { id: 'swallowtail', name: '호랑나비', rarity: 1, habitat: 'flower', shape: 'butterfly', wing: '#F6D55C', mark: '#2E2A2A', desc: '노란 날개에 까만 줄무늬가 있어요. 애벌레는 귤나무, 산초나무 잎을 먹어요.' },
  { id: 'honeybee', name: '꿀벌', rarity: 0, habitat: 'flower', shape: 'bee', desc: '꽃에서 꿀과 꽃가루를 모아 벌집으로 가져가요.' },
  { id: 'ladybug', name: '칠성무당벌레', rarity: 0, habitat: 'grass', shape: 'ladybug', desc: '빨간 등에 까만 점이 일곱 개 있어요. 진딧물을 잡아먹어요.' },
  { id: 'grasshopper', name: '메뚜기', rarity: 0, habitat: 'grass', shape: 'hopper', desc: '긴 뒷다리로 폴짝 멀리 뛰어요. 풀잎을 먹어요.' },
  { id: 'red_dragonfly', name: '고추잠자리', rarity: 0, habitat: 'water', shape: 'dragonfly', desc: '다 자란 수컷은 몸이 고추처럼 빨개요. 날아다니는 작은 벌레를 잡아먹어요.' },
  { id: 'mantis', name: '사마귀', rarity: 1, habitat: 'grass', shape: 'mantis', desc: '낫처럼 생긴 앞다리로 다른 곤충을 잡아먹어요.' },
  { id: 'cicada', name: '매미', rarity: 1, habitat: 'tree', shape: 'cicada', desc: '수컷이 큰 소리로 울어요. 애벌레는 땅속에서 여러 해를 지내요.' },
  { id: 'stag_beetle', name: '사슴벌레', rarity: 2, habitat: 'tree', shape: 'stag', desc: '수컷의 큰턱이 사슴뿔처럼 생겼어요. 나무 수액을 먹어요.' },
  { id: 'rhino_beetle', name: '장수풍뎅이', rarity: 2, habitat: 'tree', shape: 'rhino', desc: '수컷 머리에 긴 뿔이 있어요. 참나무 수액을 좋아해요.' },
  { id: 'firefly', name: '반딧불이', rarity: 2, habitat: 'water', shape: 'firefly', night: true, desc: '배 끝에서 빛을 내요. 깨끗한 곳에서 살고, 밤에만 볼 수 있어요.' },
];
export const BUG_IDS = BUGS.map((b) => b.id);
export const bugById = (id) => BUGS.find((b) => b.id === id);
export const RARITY_TEXT = ['흔해요', '가끔 보여요', '아주 드물어요'];
const CATCH = [0.85, 0.7, 0.55]; // 그물질이 맞을 확률
export const catchChance = (b) => CATCH[b.rarity] || 0.7;

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const VC2 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: THREE.DoubleSide });
function merge(g) { mergeColored(g, VC); mergeStatic(g); }
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = false;
  o.receiveShadow = false;
  return o;
}
const ell = (rx, ry, rz, mat, x, y, z) => { const o = mesh(new THREE.SphereGeometry(1, 12, 8), mat, x, y, z); o.scale.set(rx, ry, rz); return o; };
function rod(a, b, r, mat) {
  const d = V().subVectors(b, a);
  const o = mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}
// 정수 두 개로 늘 같은 0~1 값
function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

// 날개 한 쪽 (몸 옆에서 바깥으로 뻗는 납작한 타원)
// 날개는 한 쪽씩 꼭짓점 색으로 합쳐 한 번에 그린다 (투명하게 하지 않는다)
function wing(rx, rz, color, side, x, z) {
  const o = mesh(new THREE.CircleGeometry(1, 16), toon(color, { side: THREE.DoubleSide }), side * (x + rx), 0, z);
  o.rotation.x = -Math.PI / 2;
  o.scale.set(rx, rz, 1);
  return o;
}

// 곤충 모형: 앞이 +z, 등이 +y. 날개 달린 것은 wings[0](왼쪽), wings[1](오른쪽)이 날갯짓한다
export function makeBug(def) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const dark = toon('#2E2A2A');
  const wings = [new THREE.Group(), new THREE.Group()];
  let glow = null;
  const k = { butterfly: 1.7, bee: 1.8, dragonfly: 1.35, firefly: 1.6, ladybug: 1.6, hopper: 1.7, mantis: 1.5, cicada: 1.7, stag: 1.8, rhino: 1.8 }[def.shape] || 1.6;
  switch (def.shape) {
    case 'butterfly': {
      body.add(ell(0.025, 0.025, 0.11, dark, 0, 0, 0));
      body.add(rod(V(0.01, 0.01, 0.1), V(0.05, 0.04, 0.17), 0.005, dark));
      body.add(rod(V(-0.01, 0.01, 0.1), V(-0.05, 0.04, 0.17), 0.005, dark));
      for (const s of [-1, 1]) {
        const wg = wings[s < 0 ? 0 : 1];
        wg.add(wing(0.15, 0.12, def.wing, s, 0.01, 0.04));
        wg.add(wing(0.1, 0.08, def.wing, s, 0.01, -0.07));
        const tip = wing(0.05, 0.04, def.mark, s, 0.15, 0.08);
        tip.position.y = 0.003;
        wg.add(tip);
        if (def.id === 'swallowtail') for (let i = 0; i < 3; i++) { const st = wing(0.012, 0.09, def.mark, s, 0.05 + i * 0.05, 0.03); st.position.y = 0.004; wg.add(st); }
      }
      break;
    }
    case 'bee': {
      const yellow = toon('#F6C344');
      body.add(ell(0.055, 0.05, 0.085, yellow, 0, 0, -0.02));
      for (const z of [-0.04, 0.0]) { const band = mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), dark, 0, 0, z); band.scale.set(1.05, 1, 1); body.add(band); }
      body.add(ell(0.04, 0.04, 0.04, dark, 0, 0.005, 0.075));
      for (const s of [-1, 1]) { const wg = wings[s < 0 ? 0 : 1]; const w = wing(0.07, 0.035, '#F4FBFF', s, 0.0, 0.0); w.position.y = 0.04; wg.add(w); }
      break;
    }
    case 'dragonfly': {
      const red = toon('#E5402F');
      body.add(rod(V(0, 0, -0.32), V(0, 0, 0.0), 0.02, red));
      body.add(ell(0.045, 0.045, 0.06, red, 0, 0, 0.04));
      body.add(ell(0.035, 0.035, 0.035, toon('#B8301F'), 0.025, 0.01, 0.1));
      body.add(ell(0.035, 0.035, 0.035, toon('#B8301F'), -0.025, 0.01, 0.1));
      for (const s of [-1, 1]) {
        const wg = wings[s < 0 ? 0 : 1];
        wg.add(wing(0.2, 0.035, '#EAF6FF', s, 0.01, 0.05));
        wg.add(wing(0.18, 0.035, '#EAF6FF', s, 0.01, -0.03));
      }
      break;
    }
    case 'firefly': {
      body.add(ell(0.035, 0.028, 0.06, dark, 0, 0, 0.02));
      body.add(ell(0.02, 0.02, 0.02, toon('#E86A3A'), 0, 0.01, 0.075));
      glow = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#E8FF8A' }), 0, 0, -0.06);
      g.add(glow);
      for (const s of [-1, 1]) { const wg = wings[s < 0 ? 0 : 1]; const w = wing(0.05, 0.025, '#5A4A3A', s, 0.0, 0.01); w.position.y = 0.03; wg.add(w); }
      break;
    }
    case 'ladybug': {
      const red = toon('#E5402F');
      const dome = mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, TAU, 0, Math.PI / 2), red, 0, 0, 0);
      dome.scale.set(1, 0.8, 1.15);
      body.add(dome);
      body.add(ell(0.035, 0.03, 0.03, dark, 0, 0.01, 0.08));
      body.add(mesh(new THREE.BoxGeometry(0.004, 0.062, 0.16), dark, 0, 0.0, 0));
      for (const [x, z] of [[0, 0.05], [0.035, 0.025], [-0.035, 0.025], [0.045, -0.025], [-0.045, -0.025], [0.025, -0.06], [-0.025, -0.06]]) {
        const y = Math.sqrt(Math.max(0, 1 - (x / 0.075) ** 2 - (z / 0.086) ** 2)) * 0.06;
        body.add(ell(0.013, 0.006, 0.013, dark, x, y, z));
      }
      break;
    }
    case 'hopper': {
      const green = toon('#7BBF4A'), deep = toon('#5E9A35');
      body.add(ell(0.035, 0.04, 0.12, green, 0, 0.04, 0));
      body.add(ell(0.035, 0.04, 0.04, green, 0, 0.055, 0.12));
      for (const s of [-1, 1]) {
        body.add(rod(V(s * 0.03, 0.05, -0.02), V(s * 0.05, 0.11, -0.1), 0.012, deep));
        body.add(rod(V(s * 0.05, 0.11, -0.1), V(s * 0.05, 0.0, -0.16), 0.009, deep));
        body.add(rod(V(s * 0.03, 0.03, 0.06), V(s * 0.05, 0.0, 0.08), 0.007, deep));
        body.add(ell(0.01, 0.01, 0.01, dark, s * 0.03, 0.07, 0.14));
      }
      break;
    }
    case 'mantis': {
      const green = toon('#8CCB5A'), deep = toon('#6BA543');
      body.add(rod(V(0, 0.08, -0.18), V(0, 0.09, 0.02), 0.03, green));
      body.add(rod(V(0, 0.09, 0.02), V(0, 0.16, 0.12), 0.016, green));
      const head = mesh(new THREE.ConeGeometry(0.04, 0.05, 3), green, 0, 0.18, 0.14);
      head.rotation.x = Math.PI;
      body.add(head);
      for (const s of [-1, 1]) {
        body.add(rod(V(s * 0.015, 0.14, 0.1), V(s * 0.03, 0.2, 0.17), 0.011, deep));
        body.add(rod(V(s * 0.03, 0.2, 0.17), V(s * 0.03, 0.13, 0.2), 0.009, deep));
        body.add(rod(V(s * 0.02, 0.08, -0.02), V(s * 0.09, 0.0, 0.0), 0.006, deep));
        body.add(rod(V(s * 0.02, 0.08, -0.09), V(s * 0.09, 0.0, -0.14), 0.006, deep));
        body.add(ell(0.012, 0.012, 0.012, toon('#C9E68C'), s * 0.03, 0.19, 0.15));
      }
      break;
    }
    case 'cicada': {
      const brown = toon('#6B5A3A');
      body.add(ell(0.05, 0.04, 0.1, brown, 0, 0.03, 0));
      body.add(ell(0.06, 0.035, 0.035, brown, 0, 0.035, 0.09));
      for (const s of [-1, 1]) {
        body.add(ell(0.015, 0.015, 0.015, toon('#3A3022'), s * 0.05, 0.045, 0.1));
        const w = mesh(new THREE.BoxGeometry(0.06, 0.006, 0.2), toon('#DCE8EE'), s * 0.035, 0.07, -0.04);
        w.rotation.z = s * 0.45;
        body.add(w);
      }
      break;
    }
    case 'stag': {
      const brown = toon('#4A2E1E'), shine = toon('#6B4429');
      body.add(ell(0.065, 0.035, 0.1, brown, 0, 0.03, -0.03));
      body.add(ell(0.055, 0.03, 0.04, shine, 0, 0.035, 0.07));
      for (const s of [-1, 1]) {
        body.add(rod(V(s * 0.03, 0.035, 0.1), V(s * 0.06, 0.045, 0.18), 0.012, brown));
        body.add(rod(V(s * 0.06, 0.045, 0.18), V(s * 0.02, 0.05, 0.24), 0.01, brown));
        body.add(rod(V(s * 0.04, 0.02, 0.0), V(s * 0.1, 0.0, 0.03), 0.007, dark));
        body.add(rod(V(s * 0.04, 0.02, -0.06), V(s * 0.1, 0.0, -0.1), 0.007, dark));
      }
      break;
    }
    case 'rhino': {
      const brown = toon('#3A2416'), shine = toon('#5A3A24');
      body.add(ell(0.075, 0.045, 0.11, brown, 0, 0.04, -0.03));
      body.add(ell(0.06, 0.04, 0.045, shine, 0, 0.045, 0.07));
      body.add(rod(V(0, 0.05, 0.1), V(0, 0.1, 0.19), 0.014, brown));
      body.add(rod(V(0, 0.1, 0.19), V(0, 0.15, 0.2), 0.011, brown));
      body.add(rod(V(0, 0.07, 0.07), V(0, 0.11, 0.11), 0.01, brown));
      for (const s of [-1, 1]) {
        body.add(rod(V(s * 0.05, 0.02, 0.0), V(s * 0.11, 0.0, 0.03), 0.008, dark));
        body.add(rod(V(s * 0.05, 0.02, -0.07), V(s * 0.11, 0.0, -0.11), 0.008, dark));
      }
      break;
    }
  }
  merge(body);
  if (wings[0].children.length) {
    for (const wg of wings) mergeColored(wg, VC2);
    g.add(wings[0], wings[1]);
  }
  g.scale.setScalar(k);
  return { g, wings: wings[0].children.length ? wings : null, glow, def };
}

// 도감과 잡은 순간에 쓰는 작은 그림 (못 잡은 곤충은 회색 그림자)
export function bugIcon(id, known = true) {
  const b = bugById(id);
  const c = (col) => (known ? col : '#CFC6B4');
  const dk = known ? '#2E2A2A' : '#B7A994';
  const svg = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
  switch (b && b.shape) {
    case 'butterfly':
      return svg(`<ellipse cx="20" cy="24" rx="15" ry="12" fill="${c(b.wing)}" stroke="${dk}" stroke-width="1.5"/><ellipse cx="44" cy="24" rx="15" ry="12" fill="${c(b.wing)}" stroke="${dk}" stroke-width="1.5"/><ellipse cx="23" cy="42" rx="10" ry="9" fill="${c(b.wing)}" stroke="${dk}" stroke-width="1.5"/><ellipse cx="41" cy="42" rx="10" ry="9" fill="${c(b.wing)}" stroke="${dk}" stroke-width="1.5"/><circle cx="10" cy="18" r="5" fill="${c(b.mark)}"/><circle cx="54" cy="18" r="5" fill="${c(b.mark)}"/>${b.id === 'swallowtail' ? `<path d="M14 26l10-6M40 20l10 6M18 34l8-6M38 28l8 6" stroke="${dk}" stroke-width="3"/>` : ''}<rect x="30" y="14" width="4" height="38" rx="2" fill="${dk}"/><path d="M31 15 26 6M33 15l5-9" stroke="${dk}" stroke-width="1.5" fill="none"/>`);
    case 'bee':
      return svg(`<ellipse cx="22" cy="20" rx="10" ry="7" fill="#fff" opacity=".85" stroke="${dk}" stroke-width="1.2"/><ellipse cx="42" cy="20" rx="10" ry="7" fill="#fff" opacity=".85" stroke="${dk}" stroke-width="1.2"/><ellipse cx="32" cy="36" rx="13" ry="17" fill="${c('#F6C344')}"/><rect x="19" y="32" width="26" height="5" fill="${dk}"/><rect x="21" y="42" width="22" height="5" fill="${dk}"/><circle cx="32" cy="17" r="7" fill="${dk}"/>`);
    case 'dragonfly':
      return svg(`<ellipse cx="18" cy="20" rx="15" ry="4" fill="#eaf6ff" stroke="${dk}" stroke-width="1"/><ellipse cx="46" cy="20" rx="15" ry="4" fill="#eaf6ff" stroke="${dk}" stroke-width="1"/><ellipse cx="18" cy="29" rx="14" ry="4" fill="#eaf6ff" stroke="${dk}" stroke-width="1"/><ellipse cx="46" cy="29" rx="14" ry="4" fill="#eaf6ff" stroke="${dk}" stroke-width="1"/><rect x="30" y="16" width="4" height="44" rx="2" fill="${c('#E5402F')}"/><circle cx="28" cy="13" r="4" fill="${c('#B8301F')}"/><circle cx="36" cy="13" r="4" fill="${c('#B8301F')}"/>`);
    case 'firefly':
      return svg(`<circle cx="32" cy="46" r="13" fill="${known ? '#E8FF8A' : '#E3DCCB'}" opacity=".6"/><circle cx="32" cy="46" r="7" fill="${c('#D8F25A')}"/><ellipse cx="32" cy="30" rx="8" ry="13" fill="${dk}"/><circle cx="32" cy="16" r="5" fill="${c('#E86A3A')}"/>`);
    case 'ladybug':
      return svg(`<circle cx="32" cy="15" r="7" fill="${dk}"/><circle cx="32" cy="36" r="20" fill="${c('#E5402F')}"/><path d="M32 16v40" stroke="${dk}" stroke-width="2"/><g fill="${dk}"><circle cx="32" cy="24" r="4"/><circle cx="22" cy="31" r="3.5"/><circle cx="42" cy="31" r="3.5"/><circle cx="20" cy="42" r="3.5"/><circle cx="44" cy="42" r="3.5"/><circle cx="27" cy="50" r="3"/><circle cx="37" cy="50" r="3"/></g>`);
    case 'hopper':
      return svg(`<ellipse cx="34" cy="34" rx="20" ry="7" fill="${c('#7BBF4A')}" transform="rotate(-15 34 34)"/><circle cx="52" cy="28" r="6" fill="${c('#7BBF4A')}"/><path d="M30 34 18 18 10 44M40 36l4 12M48 34l6 12" stroke="${c('#5E9A35')}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="54" cy="27" r="1.8" fill="${dk}"/>`);
    case 'mantis':
      return svg(`<path d="M14 50 34 34 44 18" stroke="${c('#8CCB5A')}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M40 12h10l-5 8z" fill="${c('#8CCB5A')}"/><path d="M40 24l10-8 2 10M36 28l12-4 0 10" stroke="${c('#6BA543')}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 42 16 56M30 38 30 56" stroke="${c('#6BA543')}" stroke-width="2.5" fill="none"/>`);
    case 'cicada':
      return svg(`<path d="M32 18 16 56 30 46zM32 18 48 56 34 46z" fill="#eef5f8" opacity=".9" stroke="${dk}" stroke-width="1"/><ellipse cx="32" cy="34" rx="9" ry="16" fill="${c('#6B5A3A')}"/><ellipse cx="32" cy="18" rx="11" ry="6" fill="${c('#6B5A3A')}"/><circle cx="23" cy="18" r="3" fill="${dk}"/><circle cx="41" cy="18" r="3" fill="${dk}"/>`);
    case 'stag':
      return svg(`<path d="M26 18 16 6 20 4 30 14M38 18l10-12-4-2-10 10" fill="${c('#4A2E1E')}"/><ellipse cx="32" cy="22" rx="10" ry="7" fill="${c('#6B4429')}"/><ellipse cx="32" cy="42" rx="14" ry="17" fill="${c('#4A2E1E')}"/><path d="M32 28v30" stroke="${dk}" stroke-width="1.5"/>`);
    case 'rhino':
      return svg(`<path d="M30 20 26 4 34 2 36 18z" fill="${c('#3A2416')}"/><ellipse cx="32" cy="24" rx="11" ry="7" fill="${c('#5A3A24')}"/><ellipse cx="32" cy="43" rx="15" ry="17" fill="${c('#3A2416')}"/><path d="M32 30v28" stroke="${known ? '#1E130B' : '#B7A994'}" stroke-width="1.5"/><ellipse cx="27" cy="38" rx="3" ry="7" fill="#fff" opacity="${known ? 0.2 : 0}"/>`);
    default:
      return svg('');
  }
}

// ---------- 마을에 사는 곤충 ----------
const SLOTS = ['flower', 'flower', 'flower', 'flower', 'grass', 'grass', 'grass', 'tree', 'tree', 'tree', 'water', 'water'];
const WINDOW = 90, PRESENT = 75; // 90초마다 자리마다 새 곤충, 75초 동안 머문다
const WEIGHT = [10, 5, 2];

export class Bugs {
  constructor(v) {
    this.v = v;
    this.caught = new Set(); // `${slot}:${window}` 잡혔거나 날아간 곤충
    this.models = new Map();
    this.spots = this.collectSpots();
    this.slots = SLOTS.map((habitat, i) => {
      const g = new THREE.Group();
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      g.add(hit);
      g.userData.pick = { type: 'bug', i };
      g.visible = false;
      v.scene.add(g);
      v.pickRoots.push(g);
      return { i, habitat, g, model: null, key: '', kind: null, w: -1, pos: V(), ground: V(), label: null };
    });
  }

  // 곤충이 나타날 자리 (마을이 만든 꽃밭, 나무, 풀밭 목록에서 갈 수 있는 곳만)
  collectSpots() {
    const v = this.v;
    const free = (x, z, pad) => {
      if (Math.hypot(x, z) > 28) return false;
      for (const o of v.obstacles) {
        if (o.t === 'c' && Math.hypot(x - o.x, z - o.z) < o.r + pad) return false;
        if (o.t === 'b' && Math.hypot(x - o.x, z - o.z) < Math.max(o.hw, o.hd) + pad) return false;
      }
      return true;
    };
    const flower = (v.flowerSpots || []).filter(([x, z]) => free(x, z, 0.6));
    const grass = (v.grassSpots || []).filter(([x, z]) => free(x, z, 0.8));
    const tree = (v.treeSpots || []).filter(([x, z, s]) => {
      const d = Math.hypot(x, z) || 1;
      const sx = x - (x / d) * 1.2, sz = z - (z / d) * 1.2;
      return Math.hypot(x, z) < 26 && free(sx, sz, 0.45);
    });
    const water = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      const x = -9.5 + Math.cos(a) * 4.5, z = 13 + Math.sin(a) * 3.9;
      if (x > -8.6 && Math.abs(z - 12.9) < 1.6) continue; // 낚시 데크
      if (free(x, z, 0.3)) water.push([x, z]);
    }
    for (const [x, z] of [[-3, -1.5], [2, 1.5], [-1, 0.5], [3.5, -1.2]]) water.push([POOL.x + x, POOL.z + z]); // 수영장 섬 수영장 위
    return { flower, grass, tree, water };
  }

  // 자리 i에 지금(T) 있는 곤충
  info(i, T) {
    const s = this.slots[i];
    const off = i * 37.3;
    const w = Math.floor((T + off) / WINDOW);
    const inWin = T + off - w * WINDOW;
    const night = this.isNight();
    const list = BUGS.filter((b) => b.habitat === s.habitat && (b.night ? night : !(night && s.habitat === 'water')));
    let total = 0;
    for (const b of list) total += WEIGHT[b.rarity];
    let r = hash(i + 1, w, 3) * total, kind = list[0];
    for (const b of list) { r -= WEIGHT[b.rarity]; if (r <= 0) { kind = b; break; } }
    const spots = this.spots[s.habitat];
    const spot = spots.length ? spots[Math.floor(hash(i + 1, w, 7) * spots.length)] : null;
    return { w, kind, spot, present: !!spot && inWin < PRESENT && !this.caught.has(`${i}:${w}`), t: inWin };
  }
  isNight() { const ph = this.v.phase; return ph === 'night' || ph === 'dusk'; }

  model(kind) {
    let list = this.models.get(kind.id);
    if (!list) this.models.set(kind.id, (list = []));
    return list.pop() || makeBug(kind);
  }
  release(s) {
    if (!s.model) return;
    s.model.g.removeFromParent();
    this.models.get(s.model.def.id).push(s.model);
    s.model = null;
  }

  // 잡혔거나 날아간 곤충 (나 또는 친구)
  markCaught(i, w) {
    if (!Number.isInteger(i) || !this.slots[i]) return;
    this.caught.add(`${i}:${w}`);
    if (this.caught.size > 200) this.caught = new Set([...this.caught].slice(-100));
  }
  // 그물에 넣을 모형 하나 (잡은 곤충을 보여 줄 때)
  takeModel(kind) { return makeBug(kind); }

  update(T, dt) {
    const v = this.v;
    const pl = v.player && v.mode === 'play' ? v.player.root.position : null;
    for (const s of this.slots) {
      const inf = this.info(s.i, T);
      if (!inf.present) {
        s.g.visible = false;
        s.kind = null;
        if (s.label) s.label.style.display = 'none';
        continue;
      }
      const key = `${inf.kind.id}:${inf.w}`;
      if (s.key !== key) {
        this.release(s);
        s.model = this.model(inf.kind);
        s.g.add(s.model.g);
        s.key = key;
      }
      s.kind = inf.kind;
      s.w = inf.w;
      s.g.visible = true;
      this.pose(s, inf, T);
      // 땅이나 나무에 앉은 곤충은 가까이 가면 반짝 표시
      const still = !s.model.wings || inf.kind.habitat === 'tree';
      if (still && pl && Math.hypot(pl.x - s.pos.x, pl.z - s.pos.z) < 9) {
        if (!s.label) s.label = v.makeLabel('✨', 'kv-sparkle');
        v.placeLabel(s.label, s.pos, 0.35);
      } else if (s.label) s.label.style.display = 'none';
    }
  }

  // 곤충 움직임 (모든 기기에서 같은 시계로 거의 같다)
  pose(s, inf, T) {
    const b = inf.kind, m = s.model;
    const [sx, sz, ss] = inf.spot;
    const ph = s.i * 1.7 + inf.w;
    const g = s.g;
    let flap = 0;
    if (b.habitat === 'tree') {
      // 나무줄기에 붙어 있다: 머리는 위, 등은 바깥쪽
      const d = Math.hypot(sx, sz) || 1;
      const ox = -sx / d, oz = -sz / d; // 광장 쪽을 바라보는 면
      const sc = ss || 1;
      const y = 1.0 * sc + Math.sin(T * 0.3 + ph) * 0.08;
      s.pos.set(sx + ox * 0.24 * sc, y, sz + oz * 0.24 * sc);
      const up = V(0, 1, 0), out = V(ox, 0, oz), xAx = V().crossVectors(out, up);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, out, up));
      s.ground.set(sx + ox * 1.15, 0, sz + oz * 1.15);
    } else if (b.habitat === 'grass') {
      let x = sx, z = sz, y = 0.03, h = ph;
      if (b.shape === 'hopper') {
        // 3초마다 폴짝
        const n = Math.floor((T + ph) / 3), k = (T + ph) / 3 - n;
        const a0 = hash(s.i, n, 11) * TAU, a1 = hash(s.i, n + 1, 11) * TAU;
        const p0 = [sx + Math.cos(a0) * 0.6, sz + Math.sin(a0) * 0.6], p1 = [sx + Math.cos(a1) * 0.6, sz + Math.sin(a1) * 0.6];
        const j = k > 0.8 ? (k - 0.8) / 0.2 : 0;
        x = p0[0] + (p1[0] - p0[0]) * j; z = p0[1] + (p1[1] - p0[1]) * j;
        y += Math.sin(j * Math.PI) * 0.45;
        h = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
      } else if (b.shape === 'ladybug') {
        const a = T * 0.25 + ph;
        x = sx + Math.cos(a) * 0.35; z = sz + Math.sin(a) * 0.35;
        h = Math.atan2(-Math.sin(a), Math.cos(a));
      } else {
        h = ph + Math.sin(T * 0.4 + ph) * 0.3;
      }
      s.pos.set(x, y, z);
      g.rotation.set(0, h, 0);
      if (b.shape === 'mantis') g.rotation.z = Math.sin(T * 1.3 + ph) * 0.08;
      s.ground.set(x, 0, z);
    } else {
      // 날아다닌다
      const sp = b.shape === 'dragonfly' ? 0.9 : b.shape === 'firefly' ? 0.35 : 0.6;
      const r = b.shape === 'dragonfly' ? 1.6 : 0.9;
      const hy = b.shape === 'dragonfly' ? 1.55 : b.shape === 'firefly' ? 1.0 : 1.05;
      let a = T * sp + ph;
      if (b.shape === 'dragonfly') a += Math.sin(T * 0.7 + ph) * 0.8; // 멈칫하다 휙
      const x = sx + Math.cos(a) * r, z = sz + Math.sin(a * 1.3) * r * 0.7;
      const y = hy + Math.sin(T * 2.1 + ph) * 0.22;
      const dx = -Math.sin(a) * r, dz = Math.cos(a * 1.3) * 1.3 * r * 0.7;
      s.pos.set(x, y, z);
      g.rotation.set(0, Math.atan2(dx, dz), 0);
      s.ground.set(x, 0, z);
      flap = b.shape === 'butterfly' ? Math.sin(T * 9 + ph) * 0.9 + 0.2 : b.shape === 'firefly' ? Math.sin(T * 20) * 0.5 : Math.sin(T * 40 + ph) * 0.35;
    }
    g.position.copy(s.pos);
    if (m.wings) { m.wings[0].rotation.z = flap; m.wings[1].rotation.z = -flap; }
    if (m.glow) { const k = 0.6 + 0.4 * Math.abs(Math.sin(T * 2.2 + ph)); m.glow.scale.setScalar(0.7 + k * 0.6); }
  }
}
