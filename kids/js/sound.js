// 진숲 어린이 마을 — 배경음악과 효과음
// 배경음악은 audio/bgm.mp3를 되풀이하고, 효과음은 파일 없이 브라우저(Web Audio)에서 바로 만든다.
// 브라우저는 아이가 화면을 한 번 누르기 전에는 소리를 못 내게 하므로, 첫 터치 때 소리를 깨운다.

const KEY = 'kv.sound.v1';
const MODES = ['all', 'sfx', 'off']; // 음악+효과음 → 효과음만 → 모두 끔
// 배경음악은 크게 녹음된 곡이라(평균 약 -15dBFS) 조금 작게 틀고, 효과음은 짧아서 작게 들리므로 크게 키운 뒤 리미터로 깨지지 않게 막는다.
// 마을에서 음악 평균은 약 -26dBFS, 짧은 효과음의 가장 큰 0.1초는 대개 -24~-17dBFS가 되도록 맞췄다.
const MUSIC_VOL = 0.28;
const SFX_GAIN = 3.2;
const FW_GAIN = 0.3; // 불꽃 소리는 원래 커서 덜 키운다
const SCENE = { village: 1, game: 0.7, quiet: 0.32, login: 0.8, piano: 0 }; // 피아노를 치는 동안은 음악을 멈춘다

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
    master.gain.value = SFX_GAIN;
    // 여러 소리가 겹쳐도 깨지지 않게 마지막에 리미터를 둔다
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.12;
    master.connect(lim);
    lim.connect(ac.destination);
  } catch (e) { ac = null; }
  return ac;
}

function unlock() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume().then(() => applyRain()).catch(() => {});
  else if (c) applyRain();
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
// 아이폰·아이패드는 audio.volume을 바꿔도 소리 크기가 그대로라서, 음악도 Web Audio의 음량 조절을 거쳐 내보낸다.
// (그렇게 못 하는 브라우저에서는 audio.volume을 쓴다)
let musicGain = null, musicVol = 0;
function wireMusic() {
  if (musicGain || !bgm) return;
  const c = ensureCtx();
  if (!c || !c.createMediaElementSource) return;
  try {
    const src = c.createMediaElementSource(bgm);
    musicGain = c.createGain();
    musicGain.gain.value = musicVol;
    src.connect(musicGain);
    musicGain.connect(c.destination);
    bgm.volume = 1;
  } catch (e) { musicGain = null; }
}
function setMusicVol(v) {
  musicVol = Math.max(0, Math.min(1, v));
  if (musicGain) musicGain.gain.value = musicVol;
  else if (bgm) bgm.volume = musicVol;
}
function playMusic() {
  if (!bgm) {
    bgm = new Audio(bgmSrc);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = 0;
  }
  wireMusic();
  const p = bgm.play();
  if (p && p.catch) p.catch(() => { /* 아직 터치 전이면 다음 터치 때 다시 */ });
  fadeTo(MUSIC_VOL * (SCENE[scene] ?? 1), 900);
}

function fadeTo(target, ms) {
  if (!bgm) return;
  clearInterval(fadeTimer);
  const from = musicVol, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    setMusicVol(from + (target - from) * k);
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
  const vol = MUSIC_VOL * (SCENE[s] ?? 1);
  if (bgm && wantMusic && musicOn()) { if (vol > 0 && bgm.paused) playMusic(); else fadeTo(vol, 700); } // 멈췄던 음악은 다시 튼다
  applyRain();
}
export function sceneNow() { return scene; }

// ---------- 빗소리: 비 오는 날 마을에 잔잔하게 (효과음을 끄면 함께 꺼진다) ----------
let rainSrc = null, rainGain = null, rainLevel = 0, rainBuf = null;
export function setRain(level) { rainLevel = Math.max(0, Math.min(1, level || 0)); applyRain(); }
function applyRain() {
  const want = sfxOn() && rainLevel > 0 && !document.hidden ? rainLevel * 0.05 * (scene === 'quiet' ? 0.35 : scene === 'game' ? 0.7 : 1) : 0;
  if (!want && !rainSrc) return;
  const c = ac; // 아이가 화면을 처음 누를 때 소리를 깨우면(unlock) 그때 다시 부른다
  if (!c || c.state !== 'running') return;
  if (!rainSrc && want) {
    if (!rainBuf) {
      // 2초짜리 잡음을 되풀이한다 (빗방울 톡톡 소리를 조금 섞는다)
      rainBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = rainBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = last * 0.86 + (Math.random() * 2 - 1) * 0.14; // 조금 부드러운 잡음
        d[i] = last * 2.2 + (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0);
      }
    }
    rainSrc = c.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 0.5;
    rainGain = c.createGain();
    rainGain.gain.value = 0.0001;
    rainSrc.connect(f);
    f.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();
  }
  const t = c.currentTime;
  rainGain.gain.cancelScheduledValues(t);
  rainGain.gain.setTargetAtTime(Math.max(0.0001, want), t, 0.6);
  if (!want) {
    const src = rainSrc;
    rainSrc = null;
    setTimeout(() => { try { src.stop(); } catch (e) { /* 이미 멈춤 */ } }, 2500);
  }
}
document.addEventListener('visibilitychange', () => applyRain());

export function soundMode() { return mode; }
export function cycleSound() {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  try { localStorage.setItem(KEY, mode); } catch (e) { /* 이번에만 */ }
  if (musicOn() && wantMusic) playMusic(); else if (bgm) fadeTo(0, 400);
  applyRain();
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

// ---------- 불꽃놀이 소리 ----------
// 불꽃 소리는 길게 끌리므로 3초짜리 잡음을 되풀이해 쓰고, 여러 개가 겹쳐도 깨지지 않게 압축기를 거친다.
// 휴대폰 스피커는 아주 낮은 소리를 잘 못 내서, '펑'과 '타닥' 소리는 귀에 잘 들리는 높이로 만든다.
let fxBus = null, longNoise = null;
function bus() {
  if (!fxBus) {
    fxBus = ac.createDynamicsCompressor();
    fxBus.threshold.value = -16;
    fxBus.knee.value = 12;
    fxBus.ratio.value = 4;
    fxBus.attack.value = 0.003;
    fxBus.release.value = 0.3;
    const g = ac.createGain();
    g.gain.value = FW_GAIN;
    fxBus.connect(g);
    g.connect(master);
  }
  return fxBus;
}
function fxNoise({ dur = 0.3, vol = 0.2, freq = 1200, freq2 = 0, q = 0.8, kind = 'bandpass', delay = 0, attack = 0.004, hold = 0 }) {
  if (!longNoise) {
    longNoise = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
    const d = longNoise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = longNoise;
  s.loop = true;
  f.type = kind;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  if (hold > attack) g.gain.setValueAtTime(Math.max(0.0002, vol), t + hold); // hold: 그때까지 소리를 그대로 낸다
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(bus());
  s.start(t, Math.random() * 2);
  s.stop(t + dur + 0.05);
}
function fxTone({ f = 440, f2 = 0, type = 'sine', dur = 0.3, vol = 0.1, delay = 0, attack = 0.005, vib = 0, hold = 0 }) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = 9;
    lg.gain.value = vib;
    l.connect(lg);
    lg.connect(o.frequency);
    l.start(t);
    l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  if (hold > attack) g.gain.setValueAtTime(Math.max(0.0002, vol), t + hold); // hold: 그때까지 소리를 그대로 낸다
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus());
  o.start(t);
  o.stop(t + dur + 0.05);
}
// 불꽃이 올라갈 때: 높아지는 휘파람과 쉭 소리 (vol: 멀면 작게)
function fwLaunch(vol = 1) {
  fxTone({ f: 520, f2: 1750, type: 'sine', dur: 1.25, vol: 0.055 * vol, attack: 0.12, hold: 0.85, vib: 22 });
  fxNoise({ dur: 1.15, vol: 0.045 * vol, freq: 2600, freq2: 6200, q: 0.7, attack: 0.06, hold: 0.7 });
}
// 불꽃이 터질 때: 펑(높은 잡음) + 쿵(낮은 울림과 들리는 배음) + 우르릉 잔향 + 메아리 + 타닥타닥
// 10연발: crackle(타닥타닥)은 작은 소리만, willow(금빛 버들)는 크게 터지고 쏴아 내려앉는 소리, mini(갈래 끝)는 작게
function fwBurst(kind = 'spark', vol = 1) {
  if (kind === 'crackle') {
    for (let i = 0; i < 26; i++) fxNoise({ dur: rnd(0.015, 0.04), vol: rnd(0.06, 0.15) * vol, freq: rnd(3000, 8000), q: 1.6, delay: rnd(0, 0.75), attack: 0.002 });
    return;
  }
  const v = vol * (kind === 'flower2' || kind === 'mini' ? 0.6 : kind === 'willow' ? 1.15 : 1);
  if (kind === 'willow') fxNoise({ dur: 3.2, vol: 0.08 * v, freq: 5200, freq2: 2400, q: 0.6, delay: 0.3, attack: 0.3 });
  fxNoise({ dur: 0.24, vol: 0.6 * v, freq: 1500, q: 0.5, attack: 0.002 });
  fxTone({ f: 160, f2: 48, type: 'sine', dur: 0.85, vol: 0.55 * v, attack: 0.004 });
  fxTone({ f: 320, f2: 110, type: 'triangle', dur: 0.45, vol: 0.2 * v, attack: 0.004 });
  fxNoise({ dur: 1.7, vol: 0.3 * v, freq: 2600, freq2: 220, q: 0.4, kind: 'lowpass', attack: 0.01 });
  fxNoise({ dur: 1.2, vol: 0.11 * v, freq: 900, freq2: 180, q: 0.5, kind: 'lowpass', delay: 0.36, attack: 0.04 });
  const n = kind === 'heart' ? 10 : kind === 'flower2' ? 8 : 18;
  const until = kind === 'spark' ? 1.9 : 1.5;
  for (let i = 0; i < n; i++) fxNoise({ dur: rnd(0.02, 0.05), vol: rnd(0.05, 0.13) * v, freq: rnd(3500, 7500), q: 1.6, delay: rnd(0.35, until), attack: 0.002 });
  if (kind === 'heart') [1568, 2093, 2637, 3136].forEach((f, i) => fxTone({ f, dur: 0.7, vol: 0.05 * v, delay: 0.45 + i * 0.13 }));
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- 피아노 (내 집 피아노) ----------
// 줄을 친 소리처럼: 배음이 많은 소리로 세게 시작해 금방 조금 줄고, 그다음 천천히 사라진다. 높은 음일수록 빨리 사라지고,
// 시간이 지나면 밝은 배음부터 먼저 줄어든다(낮은 거르개). 줄 두 개를 아주 조금 다르게 맞춰 울림을 만들고, 망치 소리를 살짝 섞는다.
let pianoWave = null;
const voices = [];
function pianoTimbre() {
  if (!pianoWave) {
    const amp = [0, 1, 0.5, 0.33, 0.22, 0.16, 0.1, 0.07, 0.05, 0.035, 0.025, 0.018, 0.012];
    const re = new Float32Array(amp.length), im = new Float32Array(amp.length);
    amp.forEach((a, i) => { im[i] = a; });
    pianoWave = ac.createPeriodicWave(re, im);
  }
  return pianoWave;
}
// 피아노 소리를 낼 수 있는지 (소리를 껐거나 아직 화면을 누르기 전이면 false)
export function pianoReady() { return ready(); }
// midi 번호(가운데 도 60)의 음을 친다. vel 세기(0~1), delay 몇 초 뒤. 돌려주는 함수를 부르면 건반에서 손을 뗀 것처럼 소리를 멈춘다.
export function pianoKey(midi, { vel = 1, delay = 0 } = {}) {
  if (!ready()) return () => {};
  try {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const t = ac.currentTime + delay;
    const tc = Math.max(0.35, Math.min(1.6, 1.25 - (midi - 60) * 0.03)); // 사라지는 빠르기 (낮은 음은 길게)
    const peak = 0.062 * Math.max(0.2, Math.min(1, vel)) * (midi < 52 ? 1.15 : midi > 76 ? 0.85 : 1);
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(14000, f * 9), t);
    lp.frequency.setTargetAtTime(Math.min(9000, f * 3), t + 0.02, tc * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.setTargetAtTime(peak * 0.42, t + 0.005, 0.09);
    g.gain.setTargetAtTime(0.0001, t + 0.25, tc);
    const oscs = [1, 1.0011].map((k) => {
      const o = ac.createOscillator();
      o.setPeriodicWave(pianoTimbre());
      o.frequency.setValueAtTime(f * k, t);
      o.connect(lp);
      return o;
    });
    lp.connect(g);
    g.connect(master);
    const end = t + 0.25 + tc * 7;
    for (const o of oscs) { o.start(t); o.stop(end); }
    noise({ dur: 0.03, vol: 0.025 * vel, freq: Math.min(6000, f * 5), q: 1.2, delay }); // 망치가 줄을 치는 소리
    const voice = { g, oscs, done: false, end };
    const release = () => {
      if (voice.done) return;
      voice.done = true;
      const now = Math.max(ac.currentTime, t + 0.06);
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.07);
      for (const o of oscs) { try { o.stop(now + 0.5); } catch (e) { /* 이미 멈춤 */ } }
    };
    voice.release = release;
    voices.push(voice);
    // 너무 많이 겹치면 오래된 음부터 멈춘다
    while (voices.length && (voices.length > 28 || voices[0].end < ac.currentTime)) {
      const old = voices.shift();
      if (voices.length >= 28) old.release();
    }
    return release;
  } catch (e) { return () => {}; }
}

export const sfx = {
  // 천둥: 멀리서 우르릉 (휴대폰 스피커에도 들리게 낮은 소리에 조금 높은 소리를 섞는다)
  thunder: play(() => {
    fxNoise({ dur: 2.6, vol: 0.5, freq: 160, freq2: 70, q: 0.7, kind: 'lowpass', attack: 0.08, hold: 0.5 });
    fxNoise({ dur: 1.4, vol: 0.18, freq: 900, freq2: 260, q: 0.6, kind: 'lowpass', attack: 0.02, delay: 0.05 });
    fxNoise({ dur: 1.8, vol: 0.28, freq: 120, q: 0.8, kind: 'lowpass', attack: 0.2, delay: 0.6 });
  }),
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
  bonk: play(() => { tone({ f: 190, f2: 90, type: 'sine', dur: 0.16, vol: 0.14 }); noise({ dur: 0.08, vol: 0.12, freq: 700, q: 0.8, kind: 'lowpass' }); tone({ f: 620, f2: 880, type: 'triangle', dur: 0.08, vol: 0.06, delay: 0.05 }); }),
  honk: play(() => { [0, 0.18].forEach((d) => { tone({ f: 415, type: 'square', dur: 0.12, vol: 0.05, delay: d }); tone({ f: 523, type: 'square', dur: 0.12, vol: 0.04, delay: d }); }); }),
  // 열매 먹기: 아삭
  munch: play(() => { noise({ dur: 0.08, vol: 0.3, freq: rnd(2400, 3200), q: 1.4 }); noise({ dur: 0.06, vol: 0.18, freq: rnd(1500, 2000), q: 1.2, delay: 0.06 }); }),
  // 동물 소리 (soft면 작게)
  bark: play((soft = false) => { const v = soft ? 0.07 : 0.13; tone({ f: 520, f2: 330, type: 'sawtooth', dur: 0.09, vol: v * 0.6 }); tone({ f: 470, f2: 300, type: 'triangle', dur: 0.1, vol: v, delay: 0.16 }); }),
  meow: play((soft = false) => { const v = soft ? 0.06 : 0.11; tone({ f: 620, f2: 880, type: 'triangle', dur: 0.16, vol: v }); tone({ f: 880, f2: 520, type: 'triangle', dur: 0.26, vol: v, delay: 0.15 }); }),
  // 불꽃놀이: 올라가는 소리와 터지는 소리 (kind: spark, flower, flower2, heart / vol: 거리에 따라 0.3~1)
  fwLaunch: play((vol = 1) => fwLaunch(vol)),
  firework: play((kind = 'spark', vol = 1) => fwBurst(kind, vol)),
  boom: play((soft = false) => fwBurst(soft ? 'flower2' : 'spark', 1)),
  // 애완동물: 토끼 깡충, 병아리 삐약
  hop: play(() => { tone({ f: 420, f2: 880, type: 'triangle', dur: 0.12, vol: 0.09 }); tone({ f: 560, f2: 1100, type: 'triangle', dur: 0.1, vol: 0.06, delay: 0.14 }); }),
  peep: play((soft = false) => { const v = soft ? 0.05 : 0.09; tone({ f: 2300, f2: 3000, dur: 0.07, vol: v }); tone({ f: 2400, f2: 3100, dur: 0.07, vol: v, delay: 0.12 }); }),
  // 폴짝 뛰기: 통 올라가는 소리
  jump: play(() => { tone({ f: 330, f2: 760, type: 'triangle', dur: 0.14, vol: 0.1 }); tone({ f: 660, f2: 990, dur: 0.08, vol: 0.04, delay: 0.06 }); }),
  tweet: play(() => { [0, 0.13, 0.24].forEach((d, i) => tone({ f: 2600 + i * 300, f2: 3600 + i * 200, dur: 0.06, vol: 0.035, delay: d })); }),
  // 앵무새: 꽥 하고 높은 소리 두 번
  squawk: play((soft = false) => { const v = soft ? 0.05 : 0.09; tone({ f: 1200, f2: 1700, type: 'sawtooth', dur: 0.09, vol: v * 0.5 }); tone({ f: 1500, f2: 1100, type: 'triangle', dur: 0.12, vol: v, delay: 0.12 }); }),
  // 바다 낚시: 릴 감는 드르륵, 줄 푸는 스르륵, 물고기가 당길 때 덜컥, 줄 끊김
  reel: play((n = 5) => { for (let i = 0; i < n; i++) noise({ dur: 0.018, vol: 0.12, freq: 3200, q: 2.5, delay: i * 0.035 }); }),
  unreel: play(() => { noise({ dur: 0.35, vol: 0.06, freq: 2600, freq2: 1500, q: 1.2 }); }),
  tug: play(() => { tone({ f: 150, f2: 90, type: 'triangle', dur: 0.14, vol: 0.12 }); noise({ dur: 0.09, vol: 0.08, freq: 600, q: 0.8, kind: 'lowpass' }); }),
  snap: play(() => { noise({ dur: 0.05, vol: 0.3, freq: 4200, q: 2, kind: 'highpass' }); tone({ f: 900, f2: 180, type: 'triangle', dur: 0.25, vol: 0.1, delay: 0.03 }); }),
  // 보드게임 섬: 종(땡!), 카드 넘기기, 윷가락 떨어지는 소리
  bell: play(() => { tone({ f: 2093, dur: 1.1, vol: 0.12 }); tone({ f: 3136, dur: 0.7, vol: 0.05 }); tone({ f: 4186, dur: 0.4, vol: 0.03 }); tone({ f: 1046, type: 'triangle', dur: 0.5, vol: 0.05 }); }),
  card: play(() => { noise({ dur: 0.08, vol: 0.12, freq: 2600, freq2: 4600, q: 0.9 }); tone({ f: 420, f2: 300, type: 'triangle', dur: 0.05, vol: 0.05, delay: 0.05 }); }),
  clack: play(() => { for (let i = 0; i < 4; i++) { const d = 0.32 + i * rnd(0.05, 0.09); noise({ dur: 0.035, vol: 0.22, freq: rnd(1800, 2800), q: 2, delay: d }); tone({ f: rnd(240, 340), type: 'triangle', dur: 0.06, vol: 0.08, delay: d }); } }),
};
