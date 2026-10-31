// 진숲 어린이 마을 — 배경음악과 효과음
// 배경음악은 audio/bgm.mp3를 되풀이하고, 효과음은 파일 없이 브라우저(Web Audio)에서 바로 만든다.
// 브라우저는 아이가 화면을 한 번 누르기 전에는 소리를 못 내게 하므로, 첫 터치 때 소리를 깨운다.

const KEY = 'kv.sound.v1';
const MODES = ['all', 'sfx', 'off']; // 음악+효과음 → 효과음만 → 모두 끔
const MUSIC_VOL = 0.34;
const SCENE = { village: 1, game: 0.7, quiet: 0.32, login: 0.8 };

let mode = 'all';
try { const s = localStorage.getItem(KEY); if (MODES.includes(s)) mode = s; } catch (e) { /* 기본값 */ }

let ac = null, master = null, noiseBuf = null;
let bgm = null, bgmSrc = 'audio/bgm.mp3';
let wantMusic = false, scene = 'village', fadeTimer = null;

const musicOn = () => mode === 'all';
const sfxOn = () => mode !== 'off';

function ensureCtx() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
  } catch (e) { ac = null; }
  return ac;
}

function unlock() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  if (wantMusic && musicOn()) playMusic();
}

export function initSound({ src } = {}) {
  if (src) bgmSrc = src;
  const once = () => unlock();
  window.addEventListener('pointerdown', once, { capture: true });
  window.addEventListener('keydown', once, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!bgm) return;
    if (document.hidden) bgm.pause();
    else if (wantMusic && musicOn()) playMusic();
  });
  // 단추를 누르면 작은 소리 (따로 소리를 내는 단추는 data-quiet)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button, label.btn, .tab');
    if (!b || b.disabled || b.closest('[data-quiet]')) return;
    sfx.tap();
  }, true);
}

// ---------- 배경음악 ----------
function playMusic() {
  if (!bgm) {
    bgm = new Audio(bgmSrc);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = 0;
  }
  const p = bgm.play();
  if (p && p.catch) p.catch(() => { /* 아직 터치 전이면 다음 터치 때 다시 */ });
  fadeTo(MUSIC_VOL * (SCENE[scene] || 1), 900);
}

function fadeTo(target, ms) {
  if (!bgm) return;
  clearInterval(fadeTimer);
  const from = bgm.volume, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    bgm.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k >= 1) {
      clearInterval(fadeTimer);
      if (target === 0) bgm.pause();
    }
  }, 40);
}

export function startMusic() { wantMusic = true; if (musicOn()) playMusic(); }
export function stopMusic() { wantMusic = false; fadeTo(0, 600); }
// 장면에 따라 음악 크기: 마을 / 놀이 / 조용히(암송·묵상·필사)
export function setScene(s) {
  scene = s;
  if (bgm && wantMusic && musicOn()) fadeTo(MUSIC_VOL * (SCENE[s] || 1), 700);
}

export function soundMode() { return mode; }
export function cycleSound() {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  try { localStorage.setItem(KEY, mode); } catch (e) { /* 이번에만 */ }
  if (musicOn() && wantMusic) playMusic(); else if (bgm) fadeTo(0, 400);
  if (sfxOn()) sfx.ding();
  return mode;
}

// ---------- 효과음 만들기 ----------
function ready() {
  if (!sfxOn()) return false;
  const c = ensureCtx();
  return !!(c && c.state === 'running');
}

function tone({ f = 440, f2 = 0, type = 'sine', dur = 0.12, vol = 0.15, delay = 0, attack = 0.006 }) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise({ dur = 0.25, vol = 0.15, freq = 1200, freq2 = 0, q = 1, kind = 'bandpass', delay = 0 }) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.03);
}

const play = (fn) => (...a) => { if (ready()) { try { fn(...a); } catch (e) { /* 소리는 없어도 괜찮다 */ } } };
const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  tap: play(() => tone({ f: 760, f2: 1050, dur: 0.07, vol: 0.09 })),
  pop: play((soft = false) => tone({ f: rnd(480, 560), f2: rnd(880, 980), dur: 0.09, vol: soft ? 0.07 : 0.14 })),
  open: play(() => { tone({ f: 523, type: 'triangle', dur: 0.13, vol: 0.12 }); tone({ f: 784, type: 'triangle', dur: 0.16, vol: 0.12, delay: 0.07 }); }),
  close: play(() => { tone({ f: 784, type: 'triangle', dur: 0.1, vol: 0.09 }); tone({ f: 587, type: 'triangle', dur: 0.13, vol: 0.09, delay: 0.06 }); }),
  fruit: play(() => { tone({ f: 1047, type: 'triangle', dur: 0.11, vol: 0.13 }); tone({ f: 1568, type: 'triangle', dur: 0.18, vol: 0.13, delay: 0.08 }); tone({ f: 2093, dur: 0.2, vol: 0.04, delay: 0.14 }); }),
  success: play(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.24, vol: 0.12, delay: i * 0.09 }));
    tone({ f: 2093, dur: 0.5, vol: 0.04, delay: 0.36 });
  }),
  fail: play(() => { tone({ f: 392, f2: 330, type: 'triangle', dur: 0.16, vol: 0.11 }); tone({ f: 294, f2: 247, type: 'triangle', dur: 0.24, vol: 0.11, delay: 0.14 }); }),
  ding: play(() => { tone({ f: 1046, dur: 0.3, vol: 0.1 }); tone({ f: 1568, dur: 0.25, vol: 0.05, delay: 0.02 }); }),
  invite: play(() => { [0, 0.28].forEach((d) => { tone({ f: 1318, dur: 0.5, vol: 0.11, delay: d }); tone({ f: 1975, dur: 0.35, vol: 0.04, delay: d }); }); }),
  splash: play(() => { noise({ dur: 0.38, vol: 0.22, freq: 1400, freq2: 500, q: 0.8 }); tone({ f: 320, f2: 120, dur: 0.2, vol: 0.1, delay: 0.05 }); }),
  bite: play(() => { tone({ f: 1400, dur: 0.06, vol: 0.12 }); tone({ f: 1860, dur: 0.08, vol: 0.12, delay: 0.07 }); }),
  tick: play(() => tone({ f: rnd(1700, 1950), dur: 0.03, vol: 0.06 })),
  stone: play(() => { noise({ dur: 0.05, vol: 0.28, freq: 2600, q: 1.5, kind: 'highpass' }); tone({ f: 210, f2: 160, type: 'triangle', dur: 0.07, vol: 0.13 }); }),
  blub: play(() => tone({ f: rnd(260, 320), f2: rnd(640, 760), dur: 0.09, vol: 0.12 })),
  whoosh: play(() => noise({ dur: 0.3, vol: 0.08, freq: 400, freq2: 2400, q: 0.7 })),
  // 칼질: 사각 소리와 도마에 닿는 통 소리
  chop: play(() => { noise({ dur: 0.06, vol: 0.22, freq: rnd(3200, 4200), q: 2, kind: 'bandpass' }); tone({ f: rnd(170, 210), f2: 110, type: 'triangle', dur: 0.08, vol: 0.16, delay: 0.02 }); }),
  // 지글지글
  sizzle: play(() => { noise({ dur: 0.5, vol: 0.09, freq: 5200, q: 0.6, kind: 'highpass' }); noise({ dur: 0.35, vol: 0.05, freq: 2600, freq2: 4200, q: 1.2, delay: 0.12 }); }),
  door: play(() => { tone({ f: 330, f2: 410, type: 'triangle', dur: 0.12, vol: 0.08 }); noise({ dur: 0.1, vol: 0.05, freq: 900, q: 1 }); }),
  // 범퍼카: 쿵 부딪히는 소리와 빵빵
  bonk: play(() => { tone({ f: 190, f2: 90, type: 'sine', dur: 0.16, vol: 0.2 }); noise({ dur: 0.08, vol: 0.12, freq: 700, q: 0.8, kind: 'lowpass' }); tone({ f: 620, f2: 880, type: 'triangle', dur: 0.08, vol: 0.06, delay: 0.05 }); }),
  honk: play(() => { [0, 0.18].forEach((d) => { tone({ f: 415, type: 'square', dur: 0.12, vol: 0.05, delay: d }); tone({ f: 523, type: 'square', dur: 0.12, vol: 0.04, delay: d }); }); }),
  // 열매 먹기: 아삭
  munch: play(() => { noise({ dur: 0.07, vol: 0.16, freq: rnd(2400, 3200), q: 1.4 }); noise({ dur: 0.05, vol: 0.1, freq: rnd(1500, 2000), q: 1.2, delay: 0.06 }); }),
  // 동물 소리 (soft면 작게)
  bark: play((soft = false) => { const v = soft ? 0.07 : 0.13; tone({ f: 520, f2: 330, type: 'sawtooth', dur: 0.09, vol: v * 0.6 }); tone({ f: 470, f2: 300, type: 'triangle', dur: 0.1, vol: v, delay: 0.16 }); }),
  meow: play((soft = false) => { const v = soft ? 0.06 : 0.11; tone({ f: 620, f2: 880, type: 'triangle', dur: 0.16, vol: v }); tone({ f: 880, f2: 520, type: 'triangle', dur: 0.26, vol: v, delay: 0.15 }); }),
  // 불꽃 터지는 소리 (soft: 두 번째 작은 꽃)
  boom: play((soft = false) => {
    const v = soft ? 0.5 : 1;
    tone({ f: 120, f2: 45, type: 'sine', dur: 0.5, vol: 0.22 * v });
    noise({ dur: 0.45, vol: 0.14 * v, freq: 900, freq2: 200, q: 0.6, kind: 'lowpass' });
    for (let i = 0; i < 6; i++) noise({ dur: 0.04, vol: 0.05 * v, freq: rnd(3000, 6000), q: 2, kind: 'bandpass', delay: 0.25 + i * rnd(0.05, 0.12) });
  }),
  // 폴짝 뛰기: 통 올라가는 소리
  jump: play(() => { tone({ f: 330, f2: 760, type: 'triangle', dur: 0.14, vol: 0.1 }); tone({ f: 660, f2: 990, dur: 0.08, vol: 0.04, delay: 0.06 }); }),
  tweet: play(() => { [0, 0.13, 0.24].forEach((d, i) => tone({ f: 2600 + i * 300, f2: 3600 + i * 200, dur: 0.06, vol: 0.035, delay: d })); }),
};
