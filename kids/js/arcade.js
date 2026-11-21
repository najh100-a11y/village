// 진숲 어린이 마을 — 새벽 동굴 오락실 (위에서 내려다보는 2D 빛 쏘기)
// 동굴 방 하나(시험 'arcade')와 갑주의 방의 '도전 모드'(끝없는 물결)에서 쓴다.
// 화면 아무 곳이나 누른 채 밀면(키보드는 방향키) 갑주를 입은 아이가 뛰어다니고, 말씀의 빛이 가까운 그림자에게 저절로 나간다.
// 그림자는 거짓말, 두려움, 참소, 의심이다(엡 6:12). 사람이 아니라 빛으로 물리칠 어둠이다.
// 빛 조각을 모으면 빛이 세지고, '기도' 단추를 누르면 기도의 빛이 퍼진다. 마지막에 나오는 큰 그림자를 물리치면 방을 통과한다.
// "너희 안에 계신 이가 세상에 있는 이보다 크심이라"(요일 4:4)
// 그림은 작은 판(짧은 쪽 200점쯤)에 점그림으로 그린 뒤 크게 늘린다(옛날 오락실처럼). 점수, 하트, 글자는 화면 크기로 또렷하게 그린다.
// T(동굴이 주는 도구)에서 쓰는 것: lv, endless, rng, keys, hearts, hurt, heal, alive, clear, pray, skip, me, props, sparks.
import * as THREE from './three.module.min.js';
import { arcadeSfx as A, startChip, stopChip, setScene, sceneNow } from './sound.js';
import { makeShadow, bobShadow } from './dungeon-scene.js';

const TAU = Math.PI * 2;
const NORTH = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const WALL = 7; // 판 가장자리 바위 두께 (점)
const HERO_SPEED = 84;
const SHOT_SPEED = 215;
const GAUGE_MAX = 8;
const POWER_TIME = 8;

// 그림자 (적). hp: 맞아야 하는 수, r: 크기, spd: 빠르기(점/초), pts: 점수
export const FOES = {
  wisp: { name: '거짓말 그림자', tip: '졸졸 따라와요', hp: 2, r: 4.5, spd: 31, pts: 100, col: '#9A82E0' },
  dasher: { name: '두려움 그림자', tip: '멈췄다가 휙 달려와요', hp: 2, r: 5, spd: 18, pts: 150, col: '#E070AE' },
  split: { name: '의심 그림자', tip: '물리치면 둘로 나뉘어요', hp: 3, r: 5.5, spd: 21, pts: 150, col: '#6CC4B8' },
  shooter: { name: '참소 그림자', tip: '어두운 구슬을 쏴요. 피해요!', hp: 3, r: 5.5, spd: 26, pts: 200, col: '#7FA0F0' },
  mini: { name: '작은 의심', tip: '', hp: 1, r: 3.5, spd: 44, pts: 50, col: '#8FE0D4' },
};
// 동굴 방의 물결 (단계마다). 마지막 물결 뒤에 큰 그림자가 나온다
const ROOM_WAVES = {
  1: [{ wisp: 5 }, { wisp: 4, dasher: 2 }, { wisp: 3, split: 2, dasher: 1 }],
  2: [{ wisp: 5, dasher: 1 }, { wisp: 4, split: 2, shooter: 1 }, { dasher: 3, wisp: 4 }, { split: 2, shooter: 2, wisp: 3 }],
  3: [{ wisp: 6, dasher: 2 }, { split: 3, shooter: 2 }, { dasher: 4, wisp: 4 }, { shooter: 3, split: 2, wisp: 3 }, { wisp: 5, dasher: 3, shooter: 2 }],
};
const BOSS_HP = { 1: 30, 2: 44, 3: 60 };
const BOSS_NAME = '큰 그림자';
// 도전 모드 n번째 물결 (다섯 번째마다 큰 그림자)
function endlessWave(n, r) {
  if (n % 5 === 0) return { boss: true, hp: 26 + n * 4, blv: Math.min(3, 1 + Math.floor(n / 10)) };
  const total = Math.min(22, 4 + n);
  const kinds = ['wisp'];
  if (n >= 2) kinds.push('dasher');
  if (n >= 3) kinds.push('split');
  if (n >= 4) kinds.push('shooter');
  const out = {};
  for (let i = 0; i < total; i++) {
    const k = i < Math.ceil(total * 0.4) ? 'wisp' : kinds[Math.floor(r() * kinds.length)];
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// ---------- 점그림 ----------
const HERO_TOP = ['....kkkk....', '..kkhhhhkk..', '.khhhhhhhhk.', '.khHhhhhHhk.'];
const HERO_FACE = ['.kHssssssHk.', '.kssessessk.', '.kspsssspsk.'];
const HERO_BACK = ['.kHxxxxxxHk.', '.kxxxxxxxxk.', '.kxxxxxxxxk.'];
const HERO_BODY = ['..kssssssk..', '.kbbbbbbbbk.', 'skbbBbbBbbks', 'skwwwwwwwwks', '.kllllllllk.'];
const LEGS_A = ['..kllkkllk..', '..kffkkffk..'];
const LEGS_B = ['.kllk..kllk.', '.kffk..kffk.'];
const HERO_PAL = { k: '#120A22', h: '#DCE4EA', H: '#9AA6B2', s: '#F5C9A0', e: '#2A1F3D', p: '#F4A0A0', b: '#E8B04A', B: '#B8862E', w: '#F6D55C', l: '#5B6FB0', f: '#7CC46A', x: '#6A4630' };
const WISP_A = ['...kkkk...', '..kppppk..', '.kppppppk.', 'kppWppWppk', 'kppWppWppk', 'kppppppppk', 'kpppmmpppk', 'kppppppppk', 'kppkppkppk', '.kk.kk.kk.'];
const WISP_B = [...WISP_A.slice(0, 9), 'kk.kk.kk.k'];
const DASH = ['.....k.....', '.k..kpk..k.', '..kkpppkk..', '..kpppppk..', 'kkpWpppWpkk', '.kpWpppWpk.', '..kpppppk..', '..kpmmmpk..', '..kkpppkk..', '.k..kpk..k.', '.....k.....'];
const SHOOT = ['...kkkkkk...', '..kppppppk..', '.kppppppppk.', 'kppkkkkkkppk', 'kpkWWWWWWkpk', 'kpkWWeeWWkpk', 'kpkWWeeWWkpk', 'kppkkkkkkppk', 'kppppppppppk', '.kppppppppk.', '.kpk.kk.kpk.', '..k..kk..k..'];
const SPLIT = ['...kkkkkk...', '.kkppppppkk.', 'kppppppppppk', 'kpWWppppWWpk', 'kpWeppppWepk', 'kppppppppppk', 'kppmpmmpmppk', 'kppppppppppk', '.kpppkkpppk.', '..kkk..kkk..'];
const MINI = ['..kkk..', '.kpppk.', 'kpWpWpk', 'kpppppk', 'kpmmmpk', '.kpppk.', '.k.k.k.'];
const HEART = ['.RR.RR.', 'RORRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
const GEM = ['..o..', '.oOo.', 'oOOOo', '.oOo.', '..o..'];
const SHP = (p, m, W, e = '#120A22') => ({ k: '#0A0614', p, m, W, e });
const FOE_PAL = {
  wisp: SHP('#3E2C72', '#1E1540', '#F3EAFB'),
  dasher: SHP('#6A2058', '#300A28', '#FFE0E0'),
  shooter: SHP('#243A78', '#101C40', '#F3EAFB', '#E0404F'),
  split: SHP('#1F5258', '#0C3034', '#E6FFF9'),
  mini: SHP('#2E6E68', '#123A36', '#E6FFF9'),
};
// 떠오르는 점수 글자 (3×5 점)
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], x: ['000', '101', '010', '101', '000'],
};

function paint(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
function whiteOf(c, col = '#FFFFFF') {
  const d = document.createElement('canvas');
  d.width = c.width;
  d.height = c.height;
  const g = d.getContext('2d');
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return d;
}
let SPR = null;
function sprites() {
  if (SPR) return SPR;
  const hero = (head, legs) => paint([...HERO_TOP, ...head, ...HERO_BODY, ...legs], HERO_PAL);
  SPR = {
    hero: [hero(HERO_FACE, LEGS_A), hero(HERO_FACE, LEGS_B)],
    back: [hero(HERO_BACK, LEGS_A), hero(HERO_BACK, LEGS_B)],
    wisp: [paint(WISP_A, FOE_PAL.wisp), paint(WISP_B, FOE_PAL.wisp)],
    dasher: [paint(DASH, FOE_PAL.dasher)],
    shooter: [paint(SHOOT, FOE_PAL.shooter)],
    split: [paint(SPLIT, FOE_PAL.split)],
    mini: [paint(MINI, FOE_PAL.mini)],
    heart: paint(HEART, { R: '#F0506A', O: '#FFC2CC' }),
    heartOff: paint(HEART, { R: '#4A3D6E', O: '#5A4D80' }),
    gem: paint(GEM, { o: '#FFC93A', O: '#FFF8D6' }),
  };
  SPR.heroW = whiteOf(SPR.hero[0]);
  SPR.heroG = whiteOf(SPR.hero[0], '#6A5E8E');
  for (const k of Object.keys(FOE_PAL)) { SPR[k + 'W'] = whiteOf(SPR[k][0]); SPR[k + 'R'] = whiteOf(SPR[k][0], '#FF6A7A'); }
  return SPR;
}

// 동굴 바닥과 벽 (판 크기가 바뀔 때만 다시 그린다)
function buildFloor(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#383250';
  g.fillRect(0, 0, W, H);
  for (let y = 0, row = 0; y < H; y += 16, row++) {
    for (let x = (row % 2) * 8 - 8; x < W; x += 16) {
      const v = Math.random();
      g.fillStyle = v < 0.33 ? '#4A4462' : v < 0.66 ? '#45405D' : '#4F4868';
      g.fillRect(x + 1, y + 1, 15, 15);
      g.fillStyle = '#5B5476';
      g.fillRect(x + 1, y + 1, 15, 1);
    }
  }
  for (let i = 0; i < (W * H) / 70; i++) { g.fillStyle = Math.random() < 0.5 ? '#3A3452' : '#5A5374'; g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1); }
  // 바위 벽
  g.fillStyle = '#120C22';
  g.fillRect(0, 0, W, WALL); g.fillRect(0, H - WALL, W, WALL); g.fillRect(0, 0, WALL, H); g.fillRect(W - WALL, 0, WALL, H);
  const rock = (x, y, w, h) => { g.fillStyle = '#3A2E5E'; g.fillRect(x, y, w, h); g.fillStyle = '#54467F'; g.fillRect(x, y, w, 1); g.fillStyle = '#231A3E'; g.fillRect(x, y + h - 1, w, 1); };
  for (let x = 0; x < W; x += 7) { const w = 5 + Math.floor(Math.random() * 4); rock(x, 1 + Math.floor(Math.random() * 2), w, WALL - 2); rock(x, H - WALL + 1, w, WALL - 2); }
  for (let y = WALL; y < H - WALL; y += 7) { const hh = 5 + Math.floor(Math.random() * 4); rock(1, y, WALL - 2, hh); rock(W - WALL + 1, y, WALL - 2, hh); }
  // 벽에 박힌 빛나는 돌
  for (let i = 0; i < 6; i++) {
    const side = i % 4, t = Math.random();
    const x = side < 2 ? Math.floor(WALL + t * (W - 2 * WALL)) : side === 2 ? 2 : W - 5;
    const y = side < 2 ? (side === 0 ? 2 : H - 5) : Math.floor(WALL + t * (H - 2 * WALL));
    g.fillStyle = '#7FD8FF'; g.fillRect(x, y, 3, 3);
    g.fillStyle = '#E6FBFF'; g.fillRect(x + 1, y, 1, 1);
  }
  return c;
}

export function trialArcade(T) {
  const endless = !!T.endless;
  const lv = endless ? 1 : clamp(T.lv || 1, 1, 3);
  const roomWaves = endless ? null : ROOM_WAVES[lv];
  let cv = null, ctx = null, buf = null, b = null, floor = null, probe = null, L = null, layoutT = 0;
  let started = false, overlay = false, prevScene = null, t0 = 0;
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const S = {
    W: 240, H: 200, phase: 'ready', t: 0, wave: 0, cleared: 0, queue: [], spawnT: 0, betweenT: 0, maxAlive: [6, 8, 9][lv - 1], mul: [1, 1.08, 1.16][lv - 1],
    hero: { x: 120, y: 150, vx: 0, vy: 0, inv: 0, walk: 0, up: false, moved: 0 },
    foes: [], shots: [], orbs: [], items: [], parts: [], pops: [], portals: [], boss: null, bomb: null, bombId: 0,
    score: 0, combo: 0, comboT: 0, mult: 1, gauge: 0, power: 0, fireT: 0.4, stop: 0, shake: 0, flash: 0, flashCol: '#fff',
    banner: null, hint: 5.5, seen: new Set(), endT: 0, end: '', lastBossHit: 0, kills: 0,
  };

  // ---------- 동굴 안(3D) 모습: 시작 전에는 그림자 셋이 떠 있다 ----------
  T.me.place(T.slotX, 1.6, NORTH);
  const ghosts = [[-2.4, -3.0], [0, -4.0], [2.4, -3.0]].map(([x, z], i) => { const g = makeShadow('shadow', 0.9 + (i === 1 ? 0.35 : 0)); g.position.set(x, 0, z); T.props.add(g); return g; });
  function popGhosts(quiet = false) {
    for (const g of ghosts) { if (g.parent) { if (!quiet) T.sparks.burst(new THREE.Vector3(g.position.x, 1, g.position.z), '#FFF3B0', 16, 0.9, 1.3); g.parent.remove(g); } }
    ghosts.length = 0;
  }

  // ---------- 화면 ----------
  function makeCanvas() {
    cv = document.createElement('canvas');
    cv.className = 'arc-cv';
    cv.setAttribute('aria-label', endless ? '그림자 떼 도전 판' : '그림자 떼 물리치기 판');
    ctx = cv.getContext('2d');
    buf = document.createElement('canvas');
    b = buf.getContext('2d');
    probe = document.createElement('div');
    probe.className = 'arc-probe';
    document.body.append(probe, cv);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', onResize);
  }
  let resized = false;
  const onResize = () => { resized = true; };
  function measure() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    const sr = probe.getBoundingClientRect();
    const sl = sr.left || 0, st = sr.top || 0, sR = Math.max(0, vw - (sr.right || vw)), sB = Math.max(0, vh - (sr.bottom || vh));
    let right = sR + 6, bottom = sB + 6;
    const gb = document.querySelector('#gameUi .g-bottom');
    if (gb) {
      const r = gb.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (r.height > r.width * 1.1 && r.left > vw * 0.55) right = Math.max(right, vw - r.left + 8);
        else bottom = Math.max(bottom, vh - r.top + 6);
      }
    }
    const x0 = sl + 6, y0 = st + 52;
    const fw = Math.max(140, vw - right - x0), fh = Math.max(140, vh - bottom - y0);
    const dw = fw * dpr, dh = fh * dpr;
    const s = Math.max(1, Math.floor(Math.min(dw, dh) / 170)); // 짧은 쪽이 170~200점쯤 되게 (점이 커야 오락실 같다)
    let W = Math.floor(dw / s), H = Math.floor(dh / s);
    if (W > H * 2) W = Math.floor(H * 2);
    if (H > W * 2) H = Math.floor(W * 2);
    const ox = Math.round(x0 * dpr + (dw - W * s) / 2), oy = Math.round(y0 * dpr + (dh - H * s) / 2);
    return { dpr, vw, vh, s, W, H, ox, oy, top: st, left: sl, right: sR, key: [vw, vh, dpr, W, H, s, ox, oy].join(',') };
  }
  function relayout(force = false) {
    const m = measure();
    if (!force && L && m.key === L.key) return;
    const cw = Math.round(m.vw * m.dpr), ch = Math.round(m.vh * m.dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    if (!L || L.W !== m.W || L.H !== m.H) {
      const kx = L ? m.W / L.W : 1, ky = L ? m.H / L.H : 1;
      buf.width = m.W;
      buf.height = m.H;
      floor = buildFloor(m.W, m.H);
      S.W = m.W;
      S.H = m.H;
      // 판 크기가 바뀌면(기기를 돌리면) 모두 판 안으로
      if (L) for (const o of [S.hero, ...S.foes, ...S.items, ...S.portals, ...(S.boss ? [S.boss] : [])]) { o.x *= kx; o.y *= ky; }
      S.orbs.length = 0;
      S.shots.length = 0;
    }
    L = m;
  }
  // 판 위 점(px)과 화면 위 자리(CSS px) 바꾸기
  const toCss = (x, y) => ({ x: (L.ox + x * L.s) / L.dpr, y: (L.oy + y * L.s) / L.dpr });

  // ---------- 손가락 (떠다니는 조이스틱) ----------
  function onDown(e) {
    e.preventDefault();
    if (joy.id !== null) return;
    joy.id = e.pointerId;
    joy.ox = joy.x = e.clientX;
    joy.oy = joy.y = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 괜찮다 */ }
  }
  function onMove(e) {
    if (e.pointerId !== joy.id) return;
    joy.x = e.clientX;
    joy.y = e.clientY;
    // 손가락이 멀리 가면 가운데도 따라온다 (반대로 바로 돌아갈 수 있게)
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), R = 46;
    if (d > R) { joy.ox += (dx / d) * (d - R); joy.oy += (dy / d) * (d - R); }
  }
  function onUp(e) { if (e.pointerId === joy.id) joy.id = null; }
  function steerDir() {
    let x = 0, y = 0, m = 0;
    const k = T.keys;
    if (k && k.size) {
      x = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
      y = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0);
      const d = Math.hypot(x, y);
      if (d) { x /= d; y /= d; m = 1; }
    }
    if (!m && joy.id !== null) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
      if (d > 5) { x = dx / d; y = dy / d; m = Math.min(1, (d - 5) / 34); }
    }
    return { x, y, m };
  }

  // ---------- 시작과 끝 ----------
  function begin() {
    if (started) return;
    started = true;
    t0 = performance.now();
    sprites();
    makeCanvas();
    overlay = true;
    document.body.classList.add('dg-arcade');
    relayout(true);
    S.hero.x = S.W / 2;
    S.hero.y = S.H * 0.7;
    T.skip(true);
    prevScene = sceneNow();
    setScene('arcade');
    startChip();
    A.wave();
    nextWave();
  }
  // 오락실 판을 걷어 내고 동굴(3D)로 돌아간다
  function exitOverlay(quiet = false) {
    if (!overlay) return;
    overlay = false;
    document.body.classList.remove('dg-arcade');
    T.skip(false);
    stopChip();
    if (sceneNow() === 'arcade') setScene(prevScene || 'game');
    joy.id = null;
    popGhosts(quiet);
    const c = cv, p = probe;
    if (c) { c.classList.add('out'); setTimeout(() => { c.remove(); if (p) p.remove(); }, 480); }
    window.removeEventListener('resize', onResize);
    cv = null;
    probe = null;
  }
  function stop() {
    exitOverlay(true);
    popGhosts(true);
  }
  // 도전 모드가 끝났을 때 (하트를 다 잃었을 때 동굴이 부른다)
  function finish() {
    if (S.phase === 'over') return;
    S.phase = 'over';
    S.end = 'over';
    S.endT = 2.2;
    S.flash = 0.5;
    S.flashCol = '#2A0A18';
    S.shake = 5;
    A.over();
    banner('여기까지!', `물결 ${S.cleared}개를 이겼어요 · 점수 ${fmt(S.score)}`, 2.2);
  }

  // ---------- 물결 ----------
  function nextWave() {
    S.wave++;
    const spec = endless ? endlessWave(S.wave, T.rng) : S.wave <= roomWaves.length ? roomWaves[S.wave - 1] : { boss: true, hp: BOSS_HP[lv], blv: lv };
    S.spec = spec;
    if (endless) { S.mul = 1 + Math.min(0.6, (S.wave - 1) * 0.03); S.maxAlive = Math.min(12, 6 + Math.floor(S.wave / 3)); }
    S.phase = 'between';
    S.betweenT = S.wave === 1 ? 1.8 : 1.5;
    if (spec.boss) {
      banner(BOSS_NAME + '가 나타났어요!', '빛을 쏘며 끝까지 피해요!', 1.8);
      return;
    }
    const kinds = Object.keys(spec);
    const fresh = kinds.find((k) => !S.seen.has(k));
    for (const k of kinds) S.seen.add(k);
    const title = endless ? `물결 ${S.wave}` : `물결 ${S.wave}/${roomWaves.length}`;
    banner(title, fresh ? `새 그림자: ${FOES[fresh].name} · ${FOES[fresh].tip}` : '말씀의 빛으로 물리쳐요!', 1.5);
    const q = [];
    for (const k of kinds) for (let i = 0; i < spec[k]; i++) q.push(k);
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(T.rng() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    S.queue = q;
  }
  function startWave() {
    if (S.spec.boss) { spawnBoss(S.spec); return; }
    S.phase = 'fight';
    S.spawnT = 0.2;
  }
  function waveDone() {
    S.cleared++;
    A.wave();
    if (!endless && S.spec.boss) { win(); return; }
    // 물결 사이에 남은 빛 조각은 저절로 모인다
    for (const it of S.items) it.pull = true;
    nextWave();
  }
  function win() {
    S.phase = 'won';
    S.end = 'won';
    S.endT = 3.0;
    A.win();
    banner('어둠이 물러갔어요!', '너희 안에 계신 이가 세상에 있는 이보다 크심이라 (요일 4:4)', 3.0);
  }

  // ---------- 만들기 ----------
  function spotAwayFromHero(min) {
    const h = S.hero, m = WALL + 10;
    let best = null, bd = -1;
    for (let i = 0; i < 14; i++) {
      const x = rnd(m, S.W - m), y = rnd(m, S.H - m), d = Math.hypot(x - h.x, y - h.y);
      if (d >= min) return { x, y };
      if (d > bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  function openPortal(kind, at) {
    const p = at || spotAwayFromHero(Math.min(70, Math.min(S.W, S.H) * 0.38));
    S.portals.push({ kind, x: p.x, y: p.y, t: 0, dur: 0.75 });
    A.spawn();
  }
  function addFoe(kind, x, y) {
    const F = FOES[kind];
    const f = { kind, x, y, vx: 0, vy: 0, r: F.r, hp: F.hp, max: F.hp, t: Math.random() * 10, st: 'roam', stT: rnd(0.8, 1.8), flash: 0, dx: 0, dy: 0, fireT: rnd(1.4, 2.4), bombed: -1 };
    S.foes.push(f);
    return f;
  }
  function spawnBoss(spec) {
    S.phase = 'boss';
    const hp = spec.hp;
    S.boss = { x: S.W / 2, y: -24, hp, max: hp, t: 0, st: 'enter', stT: 1.7, atkT: 2.0, flash: 0, r: 16, pat: 0, blv: spec.blv || 1, dx: 0, dy: 0, bombed: -1, hx: S.W / 2, hy: S.H * 0.27 };
    A.bossIn();
    S.shake = 4;
  }

  // ---------- 맞히기, 물리치기 ----------
  function burst(x, y, col, n = 10, sp = 60, life = 0.5, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.65);
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, c: col, size: size + (Math.random() < 0.3 ? 1 : 0) });
    }
    if (S.parts.length > 420) S.parts.splice(0, S.parts.length - 420);
  }
  function popText(x, y, txt, c = '#FFE58A') { S.pops.push({ x, y, txt, c, life: 0.85 }); }
  function hitFoe(f, dmg, dx, dy) {
    f.hp -= dmg;
    f.flash = 0.08;
    f.x += dx * 2;
    f.y += dy * 2;
    if (f.hp <= 0) { kill(f); return; }
    A.hit();
    burst(f.x, f.y, '#FFF3B0', 3, 40, 0.25);
  }
  function kill(f) {
    const i = S.foes.indexOf(f);
    if (i < 0) return;
    S.foes.splice(i, 1);
    const F = FOES[f.kind];
    S.kills++;
    S.combo++;
    S.comboT = 2.6;
    const m = Math.min(5, 1 + Math.floor(S.combo / 6));
    if (m > S.mult) { S.mult = m; A.combo(m); comboPop(m); }
    const pts = F.pts * S.mult;
    S.score += pts;
    popText(f.x, f.y - 7, `+${pts}`);
    burst(f.x, f.y, F.col, 12, 70, 0.55);
    burst(f.x, f.y, '#FFF8D6', 6, 40, 0.35);
    S.stop = Math.max(S.stop, 0.035);
    S.shake = Math.max(S.shake, 1.6);
    A.pop(S.combo > 1 ? Math.min(7, Math.floor(S.combo / 3)) : 0);
    if (f.kind === 'split') for (const s of [-1, 1]) { const c = addFoe('mini', f.x + s * 5, f.y); c.vx = s * 60; c.st = 'chase'; }
    if (Math.random() < (f.kind === 'mini' ? 0.3 : 0.7)) addItem('gem', f.x, f.y);
    if (T.hearts() < 3 && Math.random() < (endless ? 0.035 : 0.05) && !S.items.some((it) => it.kind === 'heart')) addItem('heart', f.x, f.y);
  }
  function comboPop(m) { S.comboPop = { m, life: 1.1 }; }
  function addItem(kind, x, y) {
    const a = Math.random() * TAU;
    S.items.push({ kind, x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: kind === 'heart' ? 12 : 9, t: 0, pull: false });
  }
  function hurtHero(sx, sy, why) {
    const h = S.hero;
    if (h.inv > 0 || !T.alive()) return;
    if (!T.hurt(why, true)) { h.inv = 0.3; return; }
    h.inv = 1.4;
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1;
    h.vx = (dx / d) * 170;
    h.vy = (dy / d) * 170;
    S.stop = 0.12;
    S.shake = 6;
    S.flash = 0.35;
    S.flashCol = '#C8283C';
    S.combo = 0;
    S.mult = 1;
    A.hurt();
    burst(h.x, h.y, '#FF8A9A', 10, 60, 0.4);
  }

  // ---------- 기도의 빛 (기도 단추, 다시 일어날 때) ----------
  function onPray() {
    if (!overlay || S.phase === 'ready' || S.phase === 'over' || S.phase === 'won') return;
    S.bombId++;
    S.bomb = { t: 0, id: S.bombId, x: S.hero.x, y: S.hero.y };
    for (const o of S.orbs) burst(o.x, o.y, '#FFF3B0', 3, 30, 0.3);
    S.orbs.length = 0;
    S.flash = 0.3;
    S.flashCol = '#FFF8D6';
    S.shake = Math.max(S.shake, 4);
    S.hero.inv = Math.max(S.hero.inv, 1.0);
    A.bomb();
    banner('기도의 빛!', '', 0.9, true);
  }
  function onKey(code) {
    if (!overlay) return false;
    if (code === 'Space' || code === 'Enter') { if (T.alive()) { T.pray(); return true; } }
    return false;
  }

  // ---------- 매 화면 ----------
  function update(dt) {
    if (!started) { const t = performance.now() / 1000; ghosts.forEach((g, i) => bobShadow(g, t, i * 1.3)); return; }
    if (!overlay) return;
    dt = Math.min(dt, 0.05);
    S.t += dt;
    const frozen = !T.alive() && S.phase !== 'over' && S.phase !== 'won';
    // 판 크기 다시 재기 (쓰러졌거나 끝날 때 큰 단추가 나와도 판은 그대로 둔다)
    layoutT -= dt;
    if (resized || (layoutT <= 0 && !frozen && !S.end)) { layoutT = 0.5; resized = false; relayout(); }
    // 창(나갈까요? 같은 것)이 떠 있는 동안은 멈춘다
    if (T.paused && T.paused()) { joy.id = null; render(frozen); return; }
    if (S.stop > 0) S.stop -= dt;
    else if (!frozen && S.phase !== 'over') sim(dt);
    if (!frozen) fx(dt);
    if (S.end) {
      S.endT -= dt;
      if (S.endT <= 0) {
        const end = S.end;
        S.end = '';
        exitOverlay();
        if (end === 'won') T.clear();
      }
    }
    if (overlay) render(frozen);
  }
  function fx(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life -= dt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.life -= dt; p.y -= dt * 16; if (p.life <= 0) S.pops.splice(i, 1); }
    if (S.comboPop) { S.comboPop.life -= dt; if (S.comboPop.life <= 0) S.comboPop = null; }
    S.shake *= Math.exp(-dt * 10);
    if (S.shake < 0.2) S.shake = 0;
    S.flash = Math.max(0, S.flash - dt);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.dur) S.banner = null; }
  }
  function sim(dt) {
    const h = S.hero;
    // 움직이기
    const d = steerDir();
    const tx = d.x * HERO_SPEED * d.m, ty = d.y * HERO_SPEED * d.m;
    const k = 1 - Math.exp(-dt * 16);
    h.vx += (tx - h.vx) * k;
    h.vy += (ty - h.vy) * k;
    h.x = clamp(h.x + h.vx * dt, WALL + 5, S.W - WALL - 5);
    h.y = clamp(h.y + h.vy * dt, WALL + 6, S.H - WALL - 6);
    const sp = Math.hypot(h.vx, h.vy);
    if (sp > 8) { h.walk += dt * (4 + sp / 12); if (Math.abs(h.vy) > Math.abs(h.vx) * 0.8) h.up = h.vy < 0; }
    if (d.m > 0) h.moved += dt;
    h.inv = Math.max(0, h.inv - dt);
    if (S.hint > 0) S.hint -= dt * (h.moved > 0.6 ? 3 : 1);
    S.power = Math.max(0, S.power - dt);
    S.comboT -= dt;
    if (S.comboT <= 0 && S.combo) { S.combo = 0; S.mult = 1; }

    // 물결 진행
    if (S.phase === 'between') { S.betweenT -= dt; if (S.betweenT <= 0) startWave(); }
    else if (S.phase === 'fight') {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && S.queue.length) {
        const room = S.maxAlive - S.foes.length - S.portals.length;
        for (let i = 0; i < Math.min(2, room) && S.queue.length; i++) openPortal(S.queue.shift());
        S.spawnT = 0.85 - (lv - 1) * 0.08;
      }
      if (!S.queue.length && !S.foes.length && !S.portals.length) waveDone();
    }
    // 문(그림자가 나오는 소용돌이)
    for (let i = S.portals.length - 1; i >= 0; i--) {
      const p = S.portals[i];
      p.t += dt;
      if (p.t >= p.dur) { S.portals.splice(i, 1); addFoe(p.kind, p.x, p.y); burst(p.x, p.y, '#6A4FB0', 8, 40, 0.35); }
    }
    // 빛 쏘기: 가까운 그림자에게 저절로
    S.fireT -= dt;
    if (S.fireT <= 0 && S.phase !== 'won') {
      const tg = nearestTarget(175);
      if (tg) {
        const a = Math.atan2(tg.y - h.y, tg.x - h.x);
        const n = S.power > 0 ? [-0.22, 0, 0.22] : [0];
        for (const o of n) S.shots.push({ x: h.x + Math.cos(a) * 5, y: h.y - 2 + Math.sin(a) * 5, vx: Math.cos(a + o) * SHOT_SPEED, vy: Math.sin(a + o) * SHOT_SPEED, life: 1.0 });
        A.shoot();
        S.fireT = S.power > 0 ? 0.17 : 0.25;
      } else S.fireT = 0.06;
    }
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < WALL || s.y < WALL || s.x > S.W - WALL || s.y > S.H - WALL) { if (s.life > 0) burst(s.x, s.y, '#FFE58A', 2, 25, 0.2); S.shots.splice(i, 1); continue; }
      const dx = s.vx / SHOT_SPEED, dy = s.vy / SHOT_SPEED;
      let hit = false;
      for (const f of S.foes) { if (Math.hypot(f.x - s.x, f.y - s.y) < f.r + 2) { hitFoe(f, 1, dx, dy); hit = true; break; } }
      if (!hit && S.boss && S.boss.st !== 'enter' && S.boss.st !== 'down' && Math.hypot(S.boss.x - s.x, S.boss.y - s.y) < S.boss.r + 2) { hitBoss(1); hit = true; }
      if (hit) S.shots.splice(i, 1);
    }
    // 그림자
    for (const f of S.foes) moveFoe(f, dt);
    separate();
    // 어두운 구슬
    for (let i = S.orbs.length - 1; i >= 0; i--) {
      const o = S.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.t += dt;
      if (o.x < WALL - 2 || o.y < WALL - 2 || o.x > S.W - WALL + 2 || o.y > S.H - WALL + 2) { S.orbs.splice(i, 1); continue; }
      if (Math.hypot(o.x - h.x, o.y - h.y) < 4.5) { S.orbs.splice(i, 1); hurtHero(o.x, o.y, '어두운 구슬에 맞았어요!'); }
    }
    // 큰 그림자
    if (S.boss) moveBoss(S.boss, dt);
    // 부딪히기
    for (const f of S.foes) if (Math.hypot(f.x - h.x, f.y - h.y) < f.r + 4) { hurtHero(f.x, f.y, `${FOES[f.kind].name}에게 부딪혔어요!`); break; }
    // 기도의 빛 고리
    if (S.bomb) {
      const B = S.bomb;
      B.t += dt;
      const R = (B.t / 0.55) * Math.hypot(S.W, S.H);
      for (const f of [...S.foes]) if (f.bombed !== B.id && Math.hypot(f.x - B.x, f.y - B.y) < R) { f.bombed = B.id; hitFoe(f, 3, 0, 0); }
      if (S.boss && S.boss.bombed !== B.id && S.boss.st !== 'enter' && S.boss.st !== 'down' && Math.hypot(S.boss.x - B.x, S.boss.y - B.y) < R) { S.boss.bombed = B.id; hitBoss(4); }
      if (B.t > 0.6) S.bomb = null;
    }
    // 빛 조각, 하트
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      it.t += dt;
      it.life -= dt;
      if (it.life <= 0) { S.items.splice(i, 1); continue; }
      const dx = h.x - it.x, dy = h.y - it.y, dd = Math.hypot(dx, dy) || 1;
      if (it.t > 0.3 && (it.pull || dd < 38)) { const v = it.pull ? 150 : 120; it.vx = (dx / dd) * v; it.vy = (dy / dd) * v; }
      else { it.vx *= 1 - dt * 4; it.vy *= 1 - dt * 4; }
      it.x = clamp(it.x + it.vx * dt, WALL + 3, S.W - WALL - 3);
      it.y = clamp(it.y + it.vy * dt, WALL + 3, S.H - WALL - 3);
      if (dd < 8 && it.t > 0.15) { S.items.splice(i, 1); pick(it); }
    }
  }
  function pick(it) {
    if (it.kind === 'heart') {
      if (T.hearts() < 3) T.heal();
      A.heart();
      popText(it.x, it.y - 6, '+', '#FF8A9A');
      burst(it.x, it.y, '#FF8A9A', 8, 40, 0.4);
      return;
    }
    S.score += 10;
    A.gem();
    burst(it.x, it.y, '#FFE58A', 4, 30, 0.3);
    if (S.power > 0) return;
    S.gauge++;
    if (S.gauge >= GAUGE_MAX) {
      S.gauge = 0;
      S.power = POWER_TIME;
      A.power();
      banner('말씀의 빛이 세졌어요!', '세 줄기 빛이 나가요', 1.2, true);
    }
  }
  function nearestTarget(range) {
    const h = S.hero;
    let best = null, bd = range;
    for (const f of S.foes) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < bd) { bd = d; best = f; } }
    const B = S.boss;
    if (B && B.st !== 'enter' && B.st !== 'down') { const d = Math.hypot(B.x - h.x, B.y - h.y) - B.r; if (d < bd) best = B; }
    return best;
  }
  function moveFoe(f, dt) {
    const F = FOES[f.kind], h = S.hero, spd = F.spd * S.mul;
    f.t += dt;
    f.flash = Math.max(0, f.flash - dt);
    const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (f.kind === 'wisp' || f.kind === 'mini' || f.kind === 'split') {
      const wob = Math.sin(f.t * 3) * 0.5;
      const ax = ux - uy * wob, ay = uy + ux * wob;
      f.vx += (ax * spd - f.vx) * Math.min(1, dt * 2.5);
      f.vy += (ay * spd - f.vy) * Math.min(1, dt * 2.5);
    } else if (f.kind === 'dasher') {
      f.stT -= dt;
      if (f.st === 'roam' || f.st === 'chase') {
        f.vx += (ux * spd + Math.cos(f.t) * 8 - f.vx) * Math.min(1, dt * 2);
        f.vy += (uy * spd + Math.sin(f.t * 1.3) * 8 - f.vy) * Math.min(1, dt * 2);
        if (f.stT <= 0 && d < 150) { f.st = 'aim'; f.stT = 0.6; A.warn(); }
      } else if (f.st === 'aim') {
        f.vx *= 0.8; f.vy *= 0.8;
        f.dx = ux; f.dy = uy;
        if (f.stT <= 0) { f.st = 'dash'; f.stT = 0.5; }
      } else if (f.st === 'dash') {
        f.vx = f.dx * 150 * S.mul;
        f.vy = f.dy * 150 * S.mul;
        if (f.stT <= 0) { f.st = 'rest'; f.stT = 0.45; }
      } else if (f.st === 'rest') {
        f.vx *= 0.85; f.vy *= 0.85;
        if (f.stT <= 0) { f.st = 'roam'; f.stT = rnd(1.2, 2.3); }
      }
    } else if (f.kind === 'shooter') {
      const want = d < 72 ? -1 : d > 108 ? 1 : 0;
      const side = Math.sin(f.t * 0.7) > 0 ? 1 : -1;
      f.vx += ((ux * want - uy * side * 0.6) * spd - f.vx) * Math.min(1, dt * 2);
      f.vy += ((uy * want + ux * side * 0.6) * spd - f.vy) * Math.min(1, dt * 2);
      f.fireT -= dt;
      if (f.fireT <= 0) {
        const n = lv >= 3 || (endless && S.wave >= 12) ? [-0.18, 0.18] : [0];
        for (const o of n) { const a = Math.atan2(dy, dx) + o; S.orbs.push({ x: f.x, y: f.y, vx: Math.cos(a) * 58 * S.mul, vy: Math.sin(a) * 58 * S.mul, t: 0 }); }
        A.zap();
        f.fireT = Math.max(1.4, 2.4 - (lv - 1) * 0.25 - (endless ? S.wave * 0.03 : 0));
      }
    }
    f.x = clamp(f.x + f.vx * dt, WALL + f.r, S.W - WALL - f.r);
    f.y = clamp(f.y + f.vy * dt, WALL + f.r, S.H - WALL - f.r);
  }
  function separate() {
    const a = S.foes;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const p = a[i], q = a[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), m = p.r + q.r;
      if (d > 0.01 && d < m) { const k = (m - d) / 2 / d; p.x -= dx * k; p.y -= dy * k; q.x += dx * k; q.y += dy * k; }
    }
  }
  function hitBoss(dmg) {
    const B = S.boss;
    B.hp -= dmg;
    B.flash = 0.07;
    burst(B.x + rnd(-6, 6), B.y + rnd(-6, 6), '#FFF3B0', 3, 50, 0.3);
    if (S.t - S.lastBossHit > 0.07) { A.bossHit(); S.lastBossHit = S.t; }
    if (B.hp <= 0) {
      B.hp = 0;
      B.st = 'down';
      B.stT = 1.7;
      S.orbs.length = 0;
      S.portals.length = 0;
      const pts = (endless ? 2000 + S.wave * 200 : 2000 + lv * 1000) * S.mult;
      S.score += pts;
      popText(B.x, B.y - 18, `+${pts}`, '#FFF8D6');
      A.bossDown();
      S.shake = 6;
      // 남은 작은 그림자도 함께 흩어진다
      for (const f of [...S.foes]) kill(f);
    }
  }
  function moveBoss(B, dt) {
    const h = S.hero;
    B.t += dt;
    B.flash = Math.max(0, B.flash - dt);
    const pathX = S.W / 2 + Math.sin(B.t * 0.55) * Math.max(0, S.W / 2 - 38), pathY = S.H * 0.27 + Math.sin(B.t * 1.1) * Math.min(20, S.H * 0.08);
    if (B.st === 'enter') {
      B.stT -= dt;
      B.y += (S.H * 0.27 - B.y) * Math.min(1, dt * 2.2);
      if (B.stT <= 0) { B.st = 'move'; B.t = 0; }
      return;
    }
    if (B.st === 'down') {
      B.stT -= dt;
      if (Math.random() < dt * 14) { const x = B.x + rnd(-14, 14), y = B.y + rnd(-12, 12); burst(x, y, Math.random() < 0.5 ? '#FFF3B0' : '#9A82E0', 10, 80, 0.5); S.shake = Math.max(S.shake, 3); }
      if (B.stT <= 0) {
        burst(B.x, B.y, '#FFF8D6', 40, 140, 0.9, 2);
        S.flash = 0.45;
        S.flashCol = '#FFF8D6';
        for (let i = 0; i < 10; i++) addItem('gem', B.x + rnd(-8, 8), B.y + rnd(-8, 8));
        if (endless) addItem('heart', B.x, B.y);
        for (const it of S.items) it.pull = true;
        S.boss = null;
        waveDone();
      }
      return;
    }
    if (B.st === 'move') {
      B.x += (pathX - B.x) * Math.min(1, dt * 2.5);
      B.y += (pathY - B.y) * Math.min(1, dt * 2.5);
      B.atkT -= dt;
      if (B.atkT <= 0) attack(B);
    } else if (B.st === 'aim') {
      B.stT -= dt;
      const dx = h.x - B.x, dy = h.y - B.y, d = Math.hypot(dx, dy) || 1;
      B.dx = dx / d; B.dy = dy / d;
      if (B.stT <= 0) { B.st = 'charge'; B.stT = 0.85; }
    } else if (B.st === 'charge') {
      B.stT -= dt;
      B.x += B.dx * 125 * dt;
      B.y += B.dy * 125 * dt;
      const out = B.x < WALL + B.r || B.x > S.W - WALL - B.r || B.y < WALL + B.r || B.y > S.H - WALL - B.r;
      B.x = clamp(B.x, WALL + B.r, S.W - WALL - B.r);
      B.y = clamp(B.y, WALL + B.r, S.H - WALL - B.r);
      if (B.stT <= 0 || out) { B.st = 'move'; S.shake = Math.max(S.shake, out ? 3 : 1); }
    }
    if (Math.hypot(B.x - h.x, B.y - h.y) < B.r + 3) hurtHero(B.x, B.y, `${BOSS_NAME}에게 부딪혔어요!`);
  }
  function attack(B) {
    const h = S.hero, low = B.hp < B.max / 2, blv = B.blv;
    const cycle = blv >= 2 || low ? ['burst', 'aimed', 'summon', 'burst', 'charge', 'aimed'] : ['burst', 'aimed', 'summon', 'aimed'];
    const pat = cycle[B.pat++ % cycle.length];
    const mul = S.mul;
    if (pat === 'burst') {
      const n = 10 + blv * 2, off = B.pat * 0.37;
      for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; S.orbs.push({ x: B.x, y: B.y, vx: Math.cos(a) * 46 * mul, vy: Math.sin(a) * 46 * mul, t: 0 }); }
      A.zap();
    } else if (pat === 'aimed') {
      const base = Math.atan2(h.y - B.y, h.x - B.x), n = blv >= 3 ? 5 : 3;
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.26; S.orbs.push({ x: B.x, y: B.y, vx: Math.cos(a) * 66 * mul, vy: Math.sin(a) * 66 * mul, t: 0 }); }
      A.zap();
    } else if (pat === 'summon') {
      const n = Math.min(2 + (blv > 1 ? 1 : 0), Math.max(0, S.maxAlive - S.foes.length - S.portals.length));
      for (let i = 0; i < n; i++) openPortal(i === 2 && blv >= 2 ? 'dasher' : 'wisp', { x: clamp(B.x + (i - 1) * 22, WALL + 10, S.W - WALL - 10), y: clamp(B.y + 18, WALL + 10, S.H - WALL - 10) });
    } else if (pat === 'charge') {
      B.st = 'aim';
      B.stT = 0.8;
      A.warn();
    }
    B.atkT = Math.max(1.3, (low ? 1.8 : 2.4) - (blv - 1) * 0.15);
  }

  // ---------- 그리기 ----------
  function banner(big, small, dur, minor = false) { S.banner = { big, small, dur, t: 0, minor }; }
  function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function spr(img, x, y) { b.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); }
  function num(str, x, y, col) {
    const w = str.length * 4 - 1;
    let cx = Math.round(x - w / 2);
    const cy = Math.round(y - 2);
    for (const ch of str) {
      const g = DIGITS[ch];
      if (g) {
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') {
          b.fillStyle = '#0A0614'; b.fillRect(cx + xx - 1, cy + yy, 1, 1); b.fillRect(cx + xx + 1, cy + yy, 1, 1); b.fillRect(cx + xx, cy + yy - 1, 1, 1); b.fillRect(cx + xx, cy + yy + 1, 1, 1);
        }
        b.fillStyle = col;
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') b.fillRect(cx + xx, cy + yy, 1, 1);
      }
      cx += 4;
    }
  }
  function ellipse(x, y, rx, ry, col) { b.fillStyle = col; b.beginPath(); b.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, TAU); b.fill(); }
  function render(frozen) {
    const W = S.W, H = S.H, SP = SPR, h = S.hero;
    const sx = S.shake ? Math.round(rnd(-S.shake, S.shake)) : 0, sy = S.shake ? Math.round(rnd(-S.shake, S.shake)) : 0;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.imageSmoothingEnabled = false;
    b.fillStyle = '#0C0A18';
    b.fillRect(0, 0, W, H);
    b.setTransform(1, 0, 0, 1, sx, sy);
    b.drawImage(floor, 0, 0);
    // 문
    for (const p of S.portals) {
      const k = p.t / p.dur;
      ellipse(p.x, p.y + 3, 2 + k * 6, 1 + k * 2.5, 'rgba(10,6,20,.6)');
      b.strokeStyle = `rgba(150,110,230,${0.4 + k * 0.5})`;
      b.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const rr = 2 + k * 6 - i * 2; if (rr <= 0.5) continue; b.beginPath(); b.arc(Math.round(p.x), Math.round(p.y), rr, S.t * 6 + i * 2, S.t * 6 + i * 2 + 4); b.stroke(); }
    }
    // 빛 조각, 하트
    for (const it of S.items) {
      if (it.life < 2 && Math.floor(it.life * 8) % 2) continue;
      const bob = Math.round(Math.sin(it.t * 6) * 1);
      if (it.kind === 'heart') spr(SP.heart, it.x, it.y + bob);
      else { spr(SP.gem, it.x, it.y + bob); if (Math.floor(it.t * 5) % 3 === 0) { b.fillStyle = '#FFFFFF'; b.fillRect(Math.round(it.x) + 2, Math.round(it.y) - 3 + bob, 1, 1); } }
    }
    // 그림자들
    for (const f of S.foes) {
      ellipse(f.x, f.y + f.r + 1, f.r, 1.6, 'rgba(8,4,16,.5)');
      const fr = SP[f.kind];
      let img = fr[Math.floor(f.t * 4) % fr.length];
      if (f.flash > 0) img = SP[f.kind + 'W'];
      else if (f.kind === 'dasher' && f.st === 'aim' && Math.floor(f.t * 16) % 2) img = SP.dasherR;
      else if (f.kind === 'shooter' && f.fireT < 0.35 && Math.floor(f.t * 16) % 2) img = SP.shooterR;
      spr(img, f.x, f.y + (f.kind === 'dasher' ? 0 : Math.round(Math.sin(f.t * 5))));
      if (f.kind === 'dasher' && f.st === 'aim') { b.fillStyle = '#FFE58A'; b.fillRect(Math.round(f.x), Math.round(f.y) - 11, 1, 3); b.fillRect(Math.round(f.x), Math.round(f.y) - 7, 1, 1); }
    }
    if (S.boss) drawBoss(S.boss);
    // 어두운 구슬
    for (const o of S.orbs) {
      const p = Math.floor(o.t * 8) % 2;
      ellipse(o.x, o.y, 3, 3, '#0A0614');
      ellipse(o.x, o.y, 2, 2, p ? '#C050E0' : '#E070FF');
      b.fillStyle = '#F0C8FF';
      b.fillRect(Math.round(o.x) - 1, Math.round(o.y) - 1, 1, 1);
    }
    // 나
    ellipse(h.x, h.y + 8, 5, 1.8, 'rgba(8,4,16,.55)');
    if (!(h.inv > 0 && Math.floor(h.inv * 14) % 2)) {
      const moving = Math.hypot(h.vx, h.vy) > 8;
      const fi = moving ? Math.floor(h.walk) % 2 : 0;
      let img = (h.up ? SP.back : SP.hero)[fi];
      if (frozen) img = SP.heroG;
      spr(img, h.x, h.y + (moving && fi ? -1 : 0));
      if (S.power > 0) { b.strokeStyle = `rgba(255,229,138,${0.35 + Math.sin(S.t * 10) * 0.2})`; b.lineWidth = 1; b.beginPath(); b.arc(Math.round(h.x), Math.round(h.y), 10, 0, TAU); b.stroke(); }
    }
    // 빛
    for (const s of S.shots) {
      const ex = s.x - s.vx * 0.022, ey = s.y - s.vy * 0.022;
      b.strokeStyle = 'rgba(255,229,138,.55)';
      b.lineWidth = 2;
      b.beginPath(); b.moveTo(Math.round(ex), Math.round(ey)); b.lineTo(Math.round(s.x), Math.round(s.y)); b.stroke();
      b.fillStyle = '#FFFDF0';
      b.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
    }
    // 기도의 빛 고리
    if (S.bomb) {
      const B = S.bomb, R = (B.t / 0.55) * Math.hypot(W, H);
      b.strokeStyle = `rgba(255,243,176,${Math.max(0, 0.9 - B.t)})`;
      b.lineWidth = 4;
      b.beginPath(); b.arc(B.x, B.y, R, 0, TAU); b.stroke();
      b.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.7 - B.t)})`;
      b.lineWidth = 1;
      b.beginPath(); b.arc(B.x, B.y, Math.max(0, R - 4), 0, TAU); b.stroke();
    }
    for (const p of S.parts) { b.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1); b.fillStyle = p.c; b.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    b.globalAlpha = 1;
    for (const p of S.pops) { b.globalAlpha = clamp(p.life * 2.2, 0, 1); num(p.txt, p.x, p.y, p.c); }
    b.globalAlpha = 1;
    // 어둠 (내 둘레만 밝게)
    b.setTransform(1, 0, 0, 1, 0, 0);
    const R = Math.max(W, H) * 0.72;
    const g = b.createRadialGradient(h.x, h.y, 26, h.x, h.y, R);
    g.addColorStop(0, 'rgba(6,3,16,0)');
    g.addColorStop(1, frozen ? 'rgba(6,3,16,.75)' : 'rgba(6,3,16,.42)');
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
    if (S.flash > 0) { b.globalAlpha = Math.min(0.6, S.flash * 1.6); b.fillStyle = S.flashCol; b.fillRect(0, 0, W, H); b.globalAlpha = 1; }

    // 큰 화면에 옮기기
    const u = L.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0C0A18';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, L.ox, L.oy, W * L.s, H * L.s);
    ctx.strokeStyle = '#4A3D6E';
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.strokeRect(L.ox - ctx.lineWidth / 2, L.oy - ctx.lineWidth / 2, W * L.s + ctx.lineWidth, H * L.s + ctx.lineWidth);
    hud(frozen);
  }
  function drawBoss(B) {
    const t = S.t, x = Math.round(B.x), y = Math.round(B.y), k = B.r / 13;
    const angry = B.hp < B.max / 2, aim = B.st === 'aim' && Math.floor(t * 14) % 2;
    // 맞으면 몸이 밝은 보라로 번쩍인다 (하얗게 다 덮으면 큰 그림자 모양이 안 보여서)
    const body = B.flash > 0 ? '#7E66C8' : aim ? '#7A2448' : '#2A1C4C';
    const edge = B.flash > 0 ? '#EDE4FF' : '#0A0614';
    ellipse(x, y + 17 * k, 15 * k, 3 * k, 'rgba(8,4,16,.5)');
    // 둘레의 어두운 기운 (바닥에서 잘 보이게 옅은 보라 테두리)
    b.fillStyle = `rgba(150,110,230,${0.16 + Math.sin(t * 3) * 0.05})`;
    b.beginPath(); b.arc(x, y, (19 + Math.sin(t * 3) * 1.5) * k, 0, TAU); b.fill();
    // 몸 (테두리 먼저)
    for (const [col, grow] of [[edge, 1], [body, 0]]) {
      b.fillStyle = col;
      b.beginPath(); b.arc(x, y, 13 * k + grow, 0, TAU); b.fill();
      for (let i = 0; i < 6; i++) { b.beginPath(); b.arc(x + (-11 + i * 4.4) * k, y + (10 + Math.sin(t * 4 + i) * 2) * k, 3.6 * k + grow, 0, TAU); b.fill(); }
      for (const sd of [-1, 0, 1]) { b.beginPath(); b.moveTo(x + (sd * 7 - 3) * k - grow, y - 10 * k); b.lineTo(x + sd * 7 * k, y - (17 + (sd ? 0 : 3)) * k - grow); b.lineTo(x + (sd * 7 + 3) * k + grow, y - 10 * k); b.fill(); }
    }
    // 눈 (나를 본다)
    const dx = S.hero.x - B.x, dy = S.hero.y - B.y, d = Math.hypot(dx, dy) || 1, px = Math.round((dx / d) * 1.5), py = Math.round((dy / d) * 1.5);
    const eye = angry ? '#FF6A7A' : '#FFE58A';
    for (const sd of [-1, 1]) {
      const ex = Math.round(x + sd * 5 * k), ey = Math.round(y - 2 * k);
      ellipse(ex, ey, 3.5 * k, 3 * k, eye);
      b.fillStyle = '#0A0614';
      b.fillRect(ex - 1 + px, ey - 1 + py, 3, 3);
      b.fillRect(ex - 3, ey - Math.round(4 * k) - (angry ? (sd > 0 ? 0 : 1) : 0), 7, 1);
    }
    b.fillStyle = '#0A0614';
    b.fillRect(x - 5, Math.round(y + 6 * k), 10, 1);
    if (angry) { b.fillRect(x - 5, Math.round(y + 6 * k) - 1, 1, 1); b.fillRect(x + 4, Math.round(y + 6 * k) - 1, 1, 1); }
  }
  let FONTN = '';
  function text(str, x, y, px, col = '#FFF8E7', align = 'center') {
    const u = L.dpr;
    if (!FONTN) FONTN = (getComputedStyle(document.documentElement).getPropertyValue('--display') || '').trim() || 'sans-serif';
    ctx.font = `${Math.round(px * u)}px ${FONTN}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * u * 0.24);
    ctx.strokeStyle = 'rgba(14,8,30,.95)';
    ctx.strokeText(str, x * u, y * u);
    ctx.fillStyle = col;
    ctx.fillText(str, x * u, y * u);
  }
  function hud(frozen) {
    const u = L.dpr, vw = L.vw, y = L.top + 26;
    ctx.imageSmoothingEnabled = false;
    // 하트
    const hs = 3;
    const hearts = T.hearts();
    for (let i = 0; i < 3; i++) ctx.drawImage(i < hearts ? SPR.heart : SPR.heartOff, Math.round((L.left + 12 + i * 25) * u), Math.round((y - 9) * u), 7 * hs * u, 6 * hs * u);
    // 점수와 콤보
    text(fmt(S.score), vw / 2, y - 4, 22);
    if (S.mult > 1 || S.combo >= 3) text(`콤보 ${S.combo}${S.mult > 1 ? ` · ×${S.mult}` : ''}`, vw / 2, y + 16, 13, '#FFE58A');
    // 물결과 빛 게이지
    const rx = vw - L.right - 12;
    const wl = S.spec && S.spec.boss ? BOSS_NAME : endless ? `물결 ${S.wave}` : `물결 ${Math.min(S.wave, roomWaves.length)}/${roomWaves.length}`;
    text(wl, rx, y - 6, 15, '#F3EAFB', 'right');
    const gx = rx - GAUGE_MAX * 9 + 2, gy = y + 9;
    for (let i = 0; i < GAUGE_MAX; i++) {
      const on = S.power > 0 ? i < Math.ceil((S.power / POWER_TIME) * GAUGE_MAX) : i < S.gauge;
      ctx.fillStyle = on ? (S.power > 0 ? '#FFF3B0' : '#FFC93A') : 'rgba(90,77,128,.8)';
      ctx.fillRect(Math.round((gx + i * 9) * u), Math.round(gy * u), Math.round(7 * u), Math.round(7 * u));
    }
    // 큰 그림자 힘
    const B = S.boss;
    if (B) {
      const p0 = toCss(0, 0), p1 = toCss(S.W, 0);
      const bw = Math.min(300, (p1.x - p0.x) * 0.6), bx = (p0.x + p1.x) / 2 - bw / 2, by = p0.y + 12;
      ctx.fillStyle = 'rgba(10,6,20,.85)';
      ctx.fillRect(Math.round((bx - 2) * u), Math.round((by - 2) * u), Math.round((bw + 4) * u), Math.round(10 * u));
      ctx.fillStyle = B.hp < B.max / 2 ? '#FF6A7A' : '#B08AF0';
      ctx.fillRect(Math.round(bx * u), Math.round(by * u), Math.round(bw * (B.hp / B.max) * u), Math.round(6 * u));
      text(BOSS_NAME, bx + bw / 2, by + 16, 12, '#F3EAFB');
    }
    // 큰 글
    const c0 = toCss(0, 0), c1 = toCss(S.W, S.H), cx = (c0.x + c1.x) / 2, cy = (c0.y + c1.y) / 2;
    if (S.banner) {
      const B2 = S.banner, k = Math.min(1, B2.t / 0.18, (B2.dur - B2.t) / 0.25);
      ctx.globalAlpha = clamp(k, 0, 1);
      const by2 = B2.minor ? c0.y + (c1.y - c0.y) * 0.3 : cy - 20;
      text(B2.big, cx, by2, B2.minor ? 20 : 30, B2.minor ? '#FFE58A' : '#FFF8E7');
      if (B2.small) wrapText(B2.small, cx, by2 + (B2.minor ? 22 : 32), 15, '#F3EAFB', (c1.x - c0.x) * 0.9);
      ctx.globalAlpha = 1;
    }
    if (S.comboPop) { ctx.globalAlpha = clamp(S.comboPop.life * 2, 0, 1); const p = toCss(S.hero.x, S.hero.y - 16); text(`콤보 ×${S.comboPop.m}!`, p.x, p.y - (1.1 - S.comboPop.life) * 20, 16, '#FFE58A'); ctx.globalAlpha = 1; }
    if (S.hint > 0 && S.wave <= 1 && !frozen) {
      ctx.globalAlpha = clamp(S.hint, 0, 1);
      wrapText(('ontouchstart' in window || navigator.maxTouchPoints > 0) ? '화면을 누른 채 밀면 움직여요 · 빛은 저절로 나가요' : '방향키로 움직여요(화면을 눌러 밀어도 돼요) · 빛은 저절로 나가요', cx, c1.y - 18, 14, '#FFF8E7', (c1.x - c0.x) * 0.92);
      ctx.globalAlpha = 1;
    }
    if (frozen) {
      text('쓰러졌어요', cx, cy - 12, 26, '#F6C2CF');
      text('‘기도하기’를 누르면 다시 일어나요', cx, cy + 18, 15, '#F3EAFB');
    }
    // 조이스틱
    if (joy.id !== null && !frozen) {
      ctx.strokeStyle = 'rgba(255,248,231,.35)';
      ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(joy.ox * u, joy.oy * u, 46 * u, 0, TAU); ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, 46 / (d || 1));
      ctx.fillStyle = 'rgba(255,248,231,.45)';
      ctx.beginPath(); ctx.arc((joy.ox + dx * m) * u, (joy.oy + dy * m) * u, 18 * u, 0, TAU); ctx.fill();
    }
  }
  function wrapText(str, x, y, px, col, maxW) {
    const u = L.dpr;
    ctx.font = `${Math.round(px * u)}px ${FONTN || 'sans-serif'}`;
    if (ctx.measureText(str).width <= maxW * u) { text(str, x, y, px, col); return; }
    // 반쯤에서 띄어쓰기로 두 줄
    const mid = Math.floor(str.length / 2);
    let cut = str.lastIndexOf(' ', mid);
    if (cut < 0) cut = str.indexOf(' ', mid);
    if (cut < 0) { text(str, x, y, px * 0.85, col); return; }
    text(str.slice(0, cut), x, y, px, col);
    text(str.slice(cut + 1), x, y + px * 1.3, px, col);
  }

  return {
    begin, update, onKey, onPray, stop, finish,
    get overlay() { return overlay; },
    info: () => ({
      phase: S.phase, wave: S.wave, waves: endless ? null : roomWaves.length, cleared: S.cleared, score: S.score, foes: S.foes.length, portals: S.portals.length, queue: S.queue.length,
      boss: S.boss ? { hp: S.boss.hp, max: S.boss.max, st: S.boss.st } : null, hero: { x: Math.round(S.hero.x), y: Math.round(S.hero.y) }, field: [S.W, S.H, L ? L.s : 0],
      ms: started ? Math.round(performance.now() - t0) : 0, power: +S.power.toFixed(1), gauge: S.gauge, combo: S.combo, mult: S.mult, kills: S.kills, items: S.items.length, orbs: S.orbs.length, overlay,
    }),
    // 시험용: 지금 있는 그림자를 모두 물리치고 남은 물결을 비운다 / 큰 그림자에게 바로 / 큰 그림자 힘을 1로
    debugKill: () => { S.queue.length = 0; S.portals.length = 0; for (const f of [...S.foes]) kill(f); },
    debugBoss: () => { if (endless) return; S.queue.length = 0; S.portals.length = 0; S.foes.length = 0; S.wave = roomWaves.length; nextWave(); },
    debugBossLow: () => { if (S.boss) S.boss.hp = 1; },
    debugHero: (x, y) => { S.hero.x = x; S.hero.y = y; },
  };
}
