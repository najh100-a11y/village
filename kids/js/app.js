// 진숲 어린이 마을 — 아이 화면 흐름 (로그인 → 꾸미기 → 마을)
import { Village } from './world.js';
import { rpc, message, DEMO, store } from './api.js';
import { Maker } from './maker.js';
import { createMemory } from './memory.js';
import { createQt } from './qt.js';
import { createCopy } from './copy.js';
import { createNet, PHRASES, EMOTES, SHOUTS, clean } from './net.js';
import { cleanChat, CHAT_MAX } from './chatfilter.js';
import { createPlayHub } from './play.js';
import { createArt } from './art.js';
import { createPlay3D } from './play3d.js';
import { ACT_ICON, ACT_TEXT, fishById, recipeById, RECIPES } from './play-data.js';
import { BUGS, bugById, bugIcon, catchChance, RARITY_TEXT } from './bugs.js';
import { FIREWORKS, FW_IDS, fireworkIcon } from './fireworks.js';
import { PET_ITEMS, PET_IDS } from './critters.js';
import { initSound, startMusic, stopMusic, setScene, sfx, cycleSound, soundMode } from './sound.js';
import { h, modal, toast, confetti, josa } from './ui.js';
import { drawFaceIcon, normalizeAvatar, defaultAvatar } from './face.js';

const $ = (s) => document.querySelector(s);
const state = { token: store.get('token'), me: null, people: new Map(), today: null, features: {}, dms: new Map(), unread: 0 };
const observes = new Map(); // 오목 구경: 친구 id → 가장 최근 판
let village = null;
let maker = null;
let memory = null;
let qt = null;
let copy = null;
let net = null;
let hub = null, art = null, play3d = null;
const online = new Set();
let hintShown = false;

const token = () => state.token;

const SOON = {
  shop: ['열매 상점', '모은 열매로 옷과 모자, 꾸미기 도구를 사는 곳이에요.'],
};
const DONE_TEXT = {
  memory: '이번 주 말씀을 연습했어요',
  qt: '오늘 묵상을 마쳤어요',
  copy: '이번 주 필사를 마쳤어요',
};

async function boot() {
  initSound({ src: 'audio/bgm.mp3' });
  drawSoundBtn();
  if (DEMO) {
    $('#demoNote').hidden = false;
    $('#demoGo').hidden = false;
    document.documentElement.classList.add('is-demo');
  }
  village = new Village($('#world'), $('#labels'), {
    onEnter, onNpc, onBoard: openBoard,
    onNearDoor: (d) => {
      const p = $('#prompt');
      if (!d) { p.hidden = true; return; }
      $('#promptName').textContent = d.name;
      $('#promptAct').textContent = { board: '보기', fish: '낚시하기', omok: '두기', cook: '요리하기', art: '그리기', ferris: '타기', viking: '타기', carousel: '타기', bumper: '타기' }[d.id] || '들어가기';
      p.dataset.id = d.id;
      p.hidden = false;
    },
    placePrompt: (x, y) => { $('#prompt').style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; },
    onMove: () => hideHint(),
    onLocalMove: (p) => net && net.send('mv', p),
    onViewChange: (changed, canMap, isMap) => {
      $('#btnView').hidden = !changed;
      $('#btnMap').hidden = !canMap;
      $('#btnMap').setAttribute('aria-pressed', isMap ? 'true' : 'false');
      // 지도 보기에서는 방향 단추를 접고, 단추들이 가리지 않는 칸에 섬을 맞춘다
      document.body.classList.toggle('map-view', !!isMap);
      if (isMap) village.setSafe(measureSafe());
    },
    // 점프: 소리, 친구 화면에서도 폴짝 (너무 자주 보내지 않게)
    onJump: () => {
      sfx.jump();
      hideHint();
      const now = performance.now();
      if (net && now - jumpSent > 800) { jumpSent = now; net.send('jp', {}); }
    },
    onLocalStop: (p) => net && net.send('st', p),
    // 벤치에 앉기 (seat: 자리 번호, 일어나면 null)
    onSit: (seat) => {
      setActivity(seat == null ? '' : 'bench', seat == null ? -1 : seat);
      if (seat != null && !benchTold) { benchTold = true; toast('벤치에 앉았어요. 다른 곳을 누르면 일어나요.', 2600); }
    },
    onBenchFull: () => toast('벤치에 자리가 없어요. 다른 벤치에 앉아 볼까요?', 2400),
    // 열매 따 먹기 (상점에서 쓰는 열매와는 따로예요)
    onFruit: (what, name, kind) => {
      if (what === 'start') { setActivity('eat'); sfx.pop(); }
      else if (what === 'bite') { sfx.munch(); if (!munchSaid) { munchSaid = true; village.say('me', SHOUTS.yum); } }
      else if (what === 'done' && kind === 'dish') { setActivity(''); munchSaid = false; sfx.success(); toast(`${josa(name, '을', '를')} 맛있게 먹었어요! 만든 친구에게 고맙다고 말해 볼까요?`, 3200); }
      else if (what === 'done') { setActivity(''); munchSaid = false; sfx.fruit(); toast(`${josa(name, '을', '를')} 냠냠 먹었어요. 정말 맛있어요!`, 2400); }
      else if (what === 'stop') { setActivity(''); munchSaid = false; }
      else if (what === 'empty') toast('이 나무 열매는 다 땄어요. 조금 있으면 다시 열려요!', 2600);
    },
    onPet: (r) => { if (r.kind === 'cat') sfx.meow(); else if (r.kind === 'rabbit') sfx.hop(); else if (r.kind === 'chick') sfx.peep(); else sfx.bark(); },
    onBug: (i, kind) => onBug(i, kind),
    onNet: (on) => setActivity(on ? 'bug' : ''),
    onDish: (i, d) => openDish(d),
    onBoom: (kind, c) => sfx.firework(kind, fwVol(c)),
    onFwLaunch: (item, x, z) => sfx.fwLaunch(fwVol({ x, z })),
    onSplash: () => sfx.splash(),
    onCritterSound: (kind, soft) => { if (kind === 'bird') sfx.tweet(); else if (kind === 'cat') sfx.meow(soft); else sfx.bark(soft); },
  });
  try {
    await village.init();
  } catch (e) {
    $('#loading').replaceChildren(h('p', {}, '이 기기에서는 3D 마을을 열 수 없어요.'), h('p', { class: 'small' }, '다른 태블릿이나 컴퓨터로 들어와 주세요.'));
    return;
  }
  $('#loading').hidden = true;
  window.kvInfo = () => ({ ...village.renderer.info.render, programs: village.renderer.info.programs.length });
  if (DEMO) { window.kvEnter = (id) => village.enter(id); window.kvVillage = village; window.kvGames = () => ({ play3d }); }
  maker = new Maker();
  const common = {
    rpc, getToken: token,
    onFruits: setFruits,
    onCelebrate: () => village.celebrate(),
    onSessionLost: sessionLost,
    onDone: (k) => { if (net) net.send('done', { k }); refreshToday(); },
  };
  memory = createMemory({ ...common, onBoard: (cur) => village.setBoard(cur ? cur.ref : '') });
  qt = createQt({ ...common, features: () => state.features || {} });
  copy = createCopy({ ...common, features: () => state.features || {} });
  const onlineFriends = () => [...online].map((id) => state.people.get(id)).filter(Boolean);
  hub = createPlayHub({
    getNet: () => net,
    getPerson: (id) => state.people.get(id),
    getMe: () => state.me && state.me.id,
    isBusy: () => (!$('#maker').hidden || $('#hud').hidden ? true : !playOpen() ? 'locked' : false),
    onLockedInvite: (from, kind) => {
      const p = state.people.get(from);
      if (p) toast(`${josa(p.name, '이가', '가')} ${kind === 'omok' ? '오목' : '요리'}를 같이 하재요. 오늘 말씀 활동을 하나 마치면 놀 수 있어요!`, 3800);
    },
    onAccept: (kind, session) => openGameWith(kind, session),
  });
  art = createArt({ ...common, onShared: () => { if (net) net.send('art', {}); refreshWall(); }, onSaved: (b64) => { if (play3d) play3d.artSaved(b64); }, features: () => state.features });
  // 놀이는 창을 띄우지 않고 마을 안 그 자리에서 3D로 한다
  play3d = createPlay3D({
    village, rpc, getToken: token, onSessionLost: sessionLost, onCelebrate: () => village.celebrate(),
    setActivity, setScene, hub, onlineFriends, shout,
    onRare: (f) => { if (net) net.send('fish', { f }); },
    openArt: (start, onClose) => art.open(start, { onClose }),
    onDishShared: () => { if (net) net.send('dish', {}); dishAt = 0; refreshDishes(); },
    myId: () => state.me && state.me.id,
    personName: (id) => { const p = state.people.get(id); return p ? p.name : ''; },
    onOmokState: (st) => { if (net) net.send('ob', st); },
    getObserve: (id) => { const o = observes.get(id); return o && Date.now() - o.at < 30000 ? o.st : null; },
    watchable: () => watchableGames(),
  });
  village.decorateRemote = (r, act, hint) => play3d.decorateRemote(r, act, hint);
  bindUi();
  if (state.token) {
    try {
      await loadMe();
      return afterLogin();
    } catch (e) {
      if (e.code !== 'SESSION') toast(message(e));
      state.token = null;
      store.del('token');
    }
  }
  showLogin();
}

function bindUi() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await login($('#loginId').value, $('#loginPin').value);
  });
  $('#demoGo').addEventListener('click', () => login('체험', '1234'));
  $('#joinOpen').addEventListener('click', () => showJoin(true));
  $('#joinBack').addEventListener('click', () => showJoin(false));
  $('#joinForm').addEventListener('submit', (e) => { e.preventDefault(); join(); });
  $('#promptBtn').addEventListener('click', () => {
    const id = $('#prompt').dataset.id;
    if (id) village.enter(id);
  });
  $('#btnStamps').addEventListener('click', () => openHouse(() => memory.open(), 'memory'));
  $('#btnDress').addEventListener('click', () => openMaker(false));
  $('#btnBag').addEventListener('click', () => openBag());
  $('#btnOut').addEventListener('click', askLogout);
  $('#btnSay').addEventListener('click', toggleSay);
  $('#btnView').addEventListener('click', () => village.resetView());
  $('#btnZoomIn').addEventListener('click', () => village.zoomStep(-1));
  $('#btnZoomOut').addEventListener('click', () => village.zoomStep(1));
  $('#btnMap').addEventListener('click', () => village.toggleMap());
  setupPad();
  $('#onlineCount').addEventListener('click', () => openFriends());
  $('#btnSound').addEventListener('click', () => { cycleSound(); drawSoundBtn(); toast({ all: '음악과 효과음을 켰어요', sfx: '음악은 끄고 효과음만 들려요', off: '소리를 모두 껐어요' }[soundMode()]); });
  $('#modalClose').addEventListener('click', () => modal.close());
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') modal.close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (modal.isOpen) modal.close(); else $('#sayPanel').hidden = true; }
  });
  // 말하기 판: 글 쓰기(선생님이 켰을 때)와 정해진 말, 이모티콘
  const panel = $('#sayPanel');
  const input = h('input', { id: 'chatInput', type: 'text', maxlength: CHAT_MAX, autocomplete: 'off', enterkeyhint: 'send', placeholder: '친구들에게 할 말 (선생님도 볼 수 있어요)', 'aria-label': '친구들에게 할 말' });
  const form = h('form', { id: 'chatForm', class: 'say-write', hidden: true },
    input, h('button', { class: 'btn btn-go btn-small', type: 'submit', 'data-quiet': '' }, '보내기'));
  form.addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
  panel.replaceChildren(
    form,
    h('div', { class: 'say-phrases' }, Object.entries(PHRASES).map(([id, t]) => h('button', { class: 'say-btn', type: 'button', 'data-quiet': '', onclick: () => say(id) }, t))),
    h('div', { class: 'say-emotes' }, Object.entries(EMOTES).map(([id, t]) => h('button', { class: 'say-emo', type: 'button', 'data-quiet': '', 'aria-label': id, onclick: () => say(id) }, t))));
}

// 글 대화: 서버가 다듬은 글(거친 말, 전화번호, 주소를 가린 글)만 친구들에게 보낸다
let chatSending = false;
function showChatInput(on) {
  state.chatOpen = !!on;
  $('#chatForm').hidden = !on;
}
async function sendChat() {
  const input = $('#chatInput');
  const text = cleanChat(input.value);
  if (!text || chatSending) return;
  chatSending = true;
  try {
    const r = await rpc('kids_chat_send', { p_token: token(), p_text: input.value });
    const t = cleanChat(r && r.text);
    if (!t) return;
    input.value = '';
    input.blur();
    $('#sayPanel').hidden = true; // 보내면 말하기 판을 닫는다
    village.say('me', t);
    sfx.pop();
    logLine(state.me.village_name, t, true);
    if (net) net.send('chat', { m: t });
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    if (e.code === 'CHAT_OFF') showChatInput(false);
    toast(message(e));
  } finally { chatSending = false; }
}

function toggleSay() {
  const p = $('#sayPanel');
  p.hidden = !p.hidden;
  if (!p.hidden) {
    rpc('kids_chat_open').then(showChatInput).catch(() => {});
    if (state.chatOpen && matchMedia('(pointer: fine)').matches) setTimeout(() => $('#chatInput').focus({ preventScroll: true }), 50);
  }
}

// 놀이기구에서 외치기: 내 머리 위 말풍선과 친구들에게만 (대화 기록에는 남기지 않는다)
function shout(id) {
  const text = SHOUTS[id] || EMOTES[id];
  if (!text) return;
  village.say('me', text);
  sfx.pop();
  if (net) net.send('say', { p: id });
}

function say(id) {
  const text = PHRASES[id] || EMOTES[id];
  if (!text) return;
  $('#sayPanel').hidden = true;
  village.say('me', text);
  sfx.pop();
  logLine(state.me.village_name, text, true);
  if (net) net.send('say', { p: id });
}

const SOUND_LABEL = { all: '소리', sfx: '음악 끔', off: '소리 끔' };
function drawSoundBtn() {
  const b = $('#btnSound');
  if (!b) return;
  const m = soundMode();
  b.classList.toggle('muted', m !== 'all');
  b.setAttribute('aria-label', `소리 설정: ${SOUND_LABEL[m]}`);
  b.lastChild.textContent = SOUND_LABEL[m];
}

function logLine(name, text, mine) {
  const log = $('#chatLog');
  const line = h('p', { class: mine ? 'me' : '' }, h('b', {}, name), ' ', text);
  log.append(line);
  while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => line.classList.add('old'), 14000);
}

async function login(id, pin) {
  const err = $('#loginErr');
  err.textContent = '';
  if (!id.trim() || !pin) { err.textContent = '아이디와 비밀번호를 써 주세요.'; return; }
  const btn = $('#loginGo');
  btn.disabled = true;
  btn.textContent = '들어가는 중…';
  try {
    const res = await rpc('kids_login', { p_login_id: id, p_pin: pin });
    if (!res || !res.ok) { err.textContent = message({ code: res && res.error }); return; }
    state.token = res.token;
    store.set('token', res.token);
    await loadMe();
    $('#loginPin').value = '';
    afterLogin();
  } catch (e) {
    err.textContent = message(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '마을로 들어가기';
  }
}

async function loadMe() {
  state.me = await rpc('kids_me', { p_token: token() });
}

function afterLogin() {
  $('#login').hidden = true;
  if (!state.me.avatar || !state.me.village_name) openMaker(true);
  else enterVillage(true);
}

// ---------- 직접 가입 ----------
function showJoin(on) {
  $('#loginForm').hidden = on;
  $('#joinForm').hidden = !on;
  $('#joinErr').textContent = '';
  $('#joinDemoNote').hidden = !DEMO;
  if (on) setTimeout(() => $('#joinCode').focus({ preventScroll: true }), 50);
  else setTimeout(() => $('#loginId').focus({ preventScroll: true }), 50);
}

async function join() {
  const err = $('#joinErr');
  err.textContent = '';
  const v = (id) => $(id).value.trim();
  if (!v('#joinCode')) { err.textContent = '가입 코드를 써 주세요.'; return; }
  if (!v('#joinName')) { err.textContent = '이름을 써 주세요.'; return; }
  if (!$('#joinBirth').value) { err.textContent = '생년월일을 골라 주세요.'; return; }
  if (!/^[가-힣A-Za-z0-9_]{2,12}$/.test(v('#joinId'))) { err.textContent = message({ code: 'BAD_LOGIN_ID' }); return; }
  if (!/^[0-9]{4,6}$/.test($('#joinPin').value)) { err.textContent = message({ code: 'BAD_PIN' }); return; }
  if ($('#joinPin').value !== $('#joinPin2').value) { err.textContent = '비밀번호 두 개가 서로 달라요.'; return; }
  if (!$('#joinAgree').checked) { err.textContent = message({ code: 'NO_AGREE' }); return; }
  const btn = $('#joinGo');
  btn.disabled = true;
  btn.textContent = '가입하는 중…';
  try {
    const res = await rpc('kids_signup', { p_code: v('#joinCode'), p_login_id: v('#joinId'), p_pin: $('#joinPin').value,
      p_name: v('#joinName'), p_birthdate: $('#joinBirth').value, p_agree: true });
    if (!res || !res.ok) { err.textContent = message({ code: res && res.error }); return; }
    state.token = res.token;
    store.set('token', res.token);
    await loadMe();
    for (const id of ['#joinCode', '#joinName', '#joinBirth', '#joinId', '#joinPin', '#joinPin2']) $(id).value = '';
    $('#joinAgree').checked = false;
    showJoin(false);
    toast(`가입했어요! 아이디는 ${josa(state.me.login_id, '이에요', '예요')}. 잊지 않게 적어 두세요.`, 4200);
    afterLogin();
  } catch (e) {
    err.textContent = message(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '가입하고 마을로!';
  }
}

function showLogin() {
  if (play3d) play3d.stop();
  $('#btnView').hidden = true;
  stopNet();
  stopMusic();
  rpc('kids_signup_open').then((open) => { $('#joinOpen').hidden = !open; }).catch(() => { $('#joinOpen').hidden = true; });
  village.setMode('idle');
  $('#hud').hidden = true;
  $('#prompt').hidden = true;
  $('#hint').hidden = true;
  $('#sayPanel').hidden = true;
  $('#chatLog').replaceChildren();
  $('#login').hidden = false;
  setTimeout(() => $('#loginId').focus({ preventScroll: true }), 50);
}

async function refreshToday() {
  const was = playOpen();
  try { state.today = await rpc('kids_today', { p_token: token() }); } catch (e) { return; }
  if (!was && playOpen() && state.todayChecked) {
    toast('놀이 마당이 열렸어요! 남쪽 놀이 마당에서 친구들과 놀아요', 3800);
    setTimeout(() => sfx.fruit(), 600);
  }
  state.todayChecked = true;
}

// 놀이 마당: 그날 암송·묵상·필사 가운데 하나라도 마쳐야 열린다
const playOpen = () => !!(state.today && state.today.cleared);
const GAMES = {
  fish: () => play3d.fishing(), omok: () => play3d.omokMenu(), cook: () => play3d.cookMenu(), art: () => play3d.easel(),
  ferris: () => play3d.ride('ferris'), viking: () => play3d.ride('viking'), carousel: () => play3d.ride('carousel'), bumper: () => play3d.ride('bumper'),
};
let benchTold = false, munchSaid = false, jumpSent = 0;
// 불꽃 소리 크기: 내 주민에게서 멀수록 작게 (가까우면 1, 45m쯤이면 0.3)
function fwVol(c) {
  const p = village && village.playerPos();
  if (!c || !p) return 0.9;
  return Math.max(0.3, Math.min(1, 1.15 - Math.hypot(p.x - c.x, p.z - c.z) / 45));
}

// 화면 가장자리에서 단추들이 차지한 너비 (지도 보기에서 섬을 그 안쪽에 맞춘다)
function measureSafe() {
  const W = innerWidth, H = innerHeight;
  const s = { top: 12, bottom: 12, left: 12, right: 12 };
  const seen = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
  for (const sel of ['#hud .plate', '#hud .hud-btns', '#gameUi .g-top', '#gameUi .g-bottom']) {
    for (const el of document.querySelectorAll(sel)) {
      const r = seen(el);
      if (!r) continue;
      if (r.bottom < H * 0.45) s.top = Math.max(s.top, r.bottom + 8);
      else if (r.top > H * 0.55) s.bottom = Math.max(s.bottom, H - r.top + 8);
    }
  }
  const ctl = seen($('#viewCtl'));
  if (ctl) s.right = Math.max(s.right, W - ctl.left + 8);
  return s;
}

// ---------- 휴대폰·태블릿: 방향 단추(8방향)와 점프 ----------
// 방향 단추는 화살표 자판을 누른 것처럼 알린다. 그래서 마을 걷기와 범퍼카가 같은 단추로 움직인다.
function setupPad() {
  const touch = matchMedia('(pointer: coarse)').matches;
  document.documentElement.classList.toggle('touch', touch);
  const pad = $('#pad');
  const CODE = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' };
  const OCT = { 0: 'r', 1: 'rd', 2: 'd', 3: 'dl', 4: 'l', '-4': 'l', '-3': 'lu', '-2': 'u', '-1': 'ur' };
  let held = new Set(), pid = null;
  const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
  const setDirs = (next) => {
    for (const k of held) if (!next.has(k)) send('keyup', CODE[k]);
    for (const k of next) if (!held.has(k)) send('keydown', CODE[k]);
    held = next;
    for (const b of pad.querySelectorAll('[data-d]')) b.classList.toggle('on', held.has(b.dataset.d));
  };
  const dirsAt = (e) => {
    const r = pad.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    if (Math.hypot(x, y) < 0.2) return new Set(); // 가운데는 멈춤
    return new Set(OCT[Math.round(Math.atan2(y, x) / (Math.PI / 4))]);
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pid = e.pointerId;
    try { pad.setPointerCapture(pid); } catch (err) { /* 그대로 */ }
    setDirs(dirsAt(e));
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) setDirs(dirsAt(e)); });
  const release = (e) => { if (!e || e.pointerId === pid) { pid = null; setDirs(new Set()); } };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  pad.addEventListener('lostpointercapture', release);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => release());
  window.addEventListener('resize', () => { if (document.body.classList.contains('map-view')) village.setSafe(measureSafe()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  const jump = $('#btnJump');
  jump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jump.classList.add('on');
    village.jump();
  });
  const up = () => jump.classList.remove('on');
  jump.addEventListener('pointerup', up);
  jump.addEventListener('pointercancel', up);
  jump.addEventListener('pointerleave', up);
  jump.addEventListener('contextmenu', (e) => e.preventDefault());
}
async function openGame(id) {
  if (!playOpen()) await refreshToday();
  if (!playOpen()) return showLocked();
  hideHint();
  $('#sayPanel').hidden = true;
  GAMES[id]();
}
function showLocked() {
  const go = (where) => { modal.close(); village.walkTo(where); };
  openSheet('놀이 마당', h('div', { class: 'talk' },
    h('p', { class: 'result-big' }, '말씀 활동을 하나 마치면 열려요!'),
    h('p', {}, '오늘 암송 연습, 오늘 묵상, 이번 주 필사 가운데 하나만 해도 돼요. 마치고 오면 낚시, 오목, 그림, 요리를 하고 놀이동산 놀이기구도 탈 수 있어요.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => go('memory') }, '암송의 집'),
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => go('qt') }, '묵상의 숲'),
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => go('library') }, '필사 도서관'))), 'talk-sheet');
}

async function enterVillage(greet) {
  const me = state.me;
  village.setPlayer(me.avatar);
  village.setHome(me.village_name, normalizeAvatar(me.avatar));
  village.setMyName(me.village_name);
  village.setPet('me', me.pet || null);
  village.setMode('play');
  village.viewChanged();
  rpc('kids_chat_open').then(showChatInput).catch(() => showChatInput(false));
  rpc('kids_features').then((f) => { state.features = f || {}; showNews(); }).catch(() => { state.features = {}; });
  village.setPaused(false);
  updateHud();
  $('#hud').hidden = false;
  if (greet) {
    if (document.documentElement.classList.contains('touch')) $('#hint').textContent = '방향 단추로 걷고, 점프로 폴짝! · 가고 싶은 곳을 눌러도 가요';
    $('#hint').hidden = false;
    $('#hint').classList.remove('gone');
    hintShown = true;
  }
  memory.load().catch((e) => { if (e.code === 'SESSION') sessionLost(); });
  refreshToday();
  refreshWall();
  refreshDishes();
  startNet();
  startMusic();
  setScene('village');
  if (greet && me.is_birthday) {
    setTimeout(() => {
      confetti();
      village.celebrate();
      openSheet('생일 축하해요!', h('div', { class: 'talk' },
        h('p', { class: 'result-big' }, `${josa(me.village_name, '아', '야')}, 생일 축하해!`),
        h('p', {}, '하나님이 너를 이 세상에 보내 주셔서 정말 기뻐. 오늘 하루도 사랑 듬뿍 받으렴.'),
        h('p', { class: 'note' }, '— 숲지기 솔과 진숲 마을 친구들'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => modal.close() }, '고마워요!'))), 'talk-sheet');
    }, 700);
  } else if (greet) {
    toast(`숲지기 솔: 어서 와, ${josa(me.village_name, '아', '야')}!`, 3200);
  }
}

// ---------- 함께 접속 ----------
let peopleFetchedAt = 0;
async function fetchPeople(force) {
  if (!force && Date.now() - peopleFetchedAt < 8000) return null;
  peopleFetchedAt = Date.now();
  const v = await rpc('kids_village', { p_token: token() });
  state.people = new Map(v.people.map((p) => [p.id, p]));
  return v;
}

async function ensurePerson(id) {
  if (!state.people.has(id)) { try { await fetchPeople(); } catch (e) { return null; } }
  return state.people.get(id) || null;
}

async function startNet() {
  stopNet();
  let v;
  try { v = await fetchPeople(true); } catch (e) { if (e.code === 'SESSION') sessionLost(); return; }
  if (!v || !state.me) return;
  online.clear();
  const showCount = () => {
    const el = $('#onlineCount');
    el.textContent = online.size ? `친구 ${online.size}명` : '혼자 있어요';
    el.classList.toggle('alone', !online.size);
  };
  showCount();
  const n = createNet(DEMO, {
    posNow: () => village && village.playerPos(),
    onStatus: (s) => $('#onlineCount').classList.toggle('off', s !== 'on'),
    onJoin: async (id) => {
      const p = await ensurePerson(id);
      if (!p || net !== n) return;
      online.add(id);
      showCount();
      village.addRemote(id, p.avatar, p.name);
      village.setPet(id, p.pet || null);
      n.announce();
    },
    onLeave: (id) => {
      online.delete(id);
      showCount();
      village.removeRemote(id);
      hub.onLeave(id);
    },
    onMsg: async (type, id, raw) => {
      const p = clean(type, raw);
      if (!p) return;
      if ((type === 'inv' || type === 'invr') && p.to !== (state.me && state.me.id)) return;
      const person = await ensurePerson(id);
      if (!person || net !== n) return;
      if (!online.has(id)) { online.add(id); showCount(); village.addRemote(id, person.avatar, person.name); village.setPet(id, person.pet || null); }
      if (type === 'mv') village.remoteMove(id, p);
      else if (type === 'st') village.remoteStop(id, p);
      else if (type === 'say') {
        const text = PHRASES[p.p] || EMOTES[p.p] || SHOUTS[p.p];
        village.say(id, text);
        sfx.pop(true);
        if (!SHOUTS[p.p]) logLine(person.name, text, false);
      } else if (type === 'chat') {
        village.say(id, p.m);
        sfx.pop(true);
        logLine(person.name, p.m, false);
      } else if (type === 'done') {
        village.remoteCelebrate(id);
        sfx.ding();
        toast(`${josa(person.name, '이가', '가')} ${DONE_TEXT[p.k]}!`, 3200);
      } else if (type === 'inv' || type === 'invr') {
        hub.onMsg(type, id, p);
      } else if (type === 'act') {
        village.setRemoteActivity(id, ACT_ICON[p.a] || '', p.a || '', p.s);
      } else if (type === 'fish') {
        const f = fishById(p.f);
        if (f && f.rarity >= 2) {
          toast(`${josa(person.name, '이가', '가')} ${josa(f.name, '을', '를')} 낚았어요!`, 3200);
          logLine(person.name, `🎣 ${f.name}!`, false);
        }
      } else if (type === 'dm') {
        // 둘이 이야기는 서버에 기록된 뒤에만 오가야 하므로, 기능이 켜져 있을 때만 받는다
        if (p.to !== (state.me && state.me.id) || !state.features.dm || !state.chatOpen) return;
        addDm(id, p.m, false);
      } else if (type === 'ob') {
        observes.set(id, { st: p, at: Date.now() });
        if (play3d) play3d.observe(id, p);
      } else if (type === 'fw') {
        if (village.fireworks) village.fireworks.launch(p.k, p.x, p.z);
        const me = village.playerPos();
        if (me && village.mode === 'play' && Math.hypot(me.x - p.x, me.z - p.z) < 22) village.lookUp(4.5);
        const fw = FIREWORKS[p.k];
        if (fw) logLine(person.name, `🎆 ${fw.name}을 터트렸어요`, false);
      } else if (type === 'ate') {
        const mine = (village.dishList || []).find((d) => d.id === p.d && d.me);
        if (mine) { sfx.ding(); toast(`${josa(person.name, '이가', '가')} 내 ${josa(mine.name, '을', '를')} 먹었어요! 맛있대요.`, 3600); }
        dishAt = 0;
        refreshDishes();
      } else if (type === 'bug') {
        if (village.bugs) village.bugs.markCaught(p.s, p.w);
        const b = bugById(p.b);
        if (b && b.rarity >= 1) { toast(`${josa(person.name, '이가', '가')} ${josa(b.name, '을', '를')} 잡았어요!`, 3000); logLine(person.name, `🦋 ${b.name}`, false); }
      } else if (type === 'jp') {
        village.remoteJump(id);
      } else if (type === 'dish') {
        dishAt = 0;
        refreshDishes();
        logLine(person.name, '🍽️ 마을 식탁에 요리를 올렸어요', false);
      } else if (type === 'art') {
        refreshWall();
        logLine(person.name, '🎨 전시관에 그림을 걸었어요', false);
      } else if (type === 'av') {
        try { await fetchPeople(true); } catch (e) { return; }
        const np = state.people.get(id);
        if (np) { village.addRemote(id, np.avatar, np.name); village.setPet(id, np.pet || null); }
      }
    },
  });
  net = n;
  const bots = DEMO ? [...state.people.values()].filter((p) => ['c2', 'c3'].includes(p.id) && p.id !== state.me.id) : [];
  n.start(v.room, state.me.id, bots);
}

function stopNet() {
  if (hub && hub.session) hub.session.close();
  if (net) { const n = net; net = null; n.stop(); }
  online.clear();
  if (village) village.clearRemotes();
}

let dishAt = 0;
async function refreshDishes() {
  if (Date.now() - dishAt < 3000) return;
  dishAt = Date.now();
  try { village.setDishTable(await rpc('kids_dish_table', { p_token: token() })); } catch (e) { /* 서버가 아직이면 빈 식탁 */ }
}

let wallAt = 0;
async function refreshWall() {
  if (Date.now() - wallAt < 3000) return;
  wallAt = Date.now();
  try { village.setArtWall(await rpc('kids_art_wall', { p_token: token() })); } catch (e) { /* 다음에 */ }
}

let myAct = '', mySeat = -1;
// a: 하는 일, s: 앉은 자리 번호 (놀이기구 의자, 벤치)
function setActivity(a, s = -1) {
  if (a === myAct && s === mySeat) return;
  myAct = a;
  mySeat = s;
  if (net) net.send('act', s >= 0 ? { a, s } : { a });
}

// ---------- 곤충 채집 ----------
let bugBook = null;
async function loadBugBook() {
  try { bugBook = await rpc('kids_bug_book', { p_token: token() }); } catch (e) { if (e.code === 'SESSION') sessionLost(); bugBook = bugBook || { mine: {} }; }
  return bugBook;
}
function onBug(i, kind) {
  if (!state.features.bugs) { toast('곤충 채집은 곧 열려요! 조금만 기다려 줘요.', 2600); return; }
  if (!playOpen()) { toast('말씀 활동을 하나 마치면 곤충을 잡을 수 있어요!', 3000); return; }
  village.startNet(i, catchChance(kind), async (hit, k, w) => {
    sfx.whoosh();
    if (!hit) { toast(`앗, ${josa(k.name, '이', '가')} 날아갔어요! 다른 곤충을 찾아봐요.`, 2400); return; }
    try {
      const r = await rpc('kids_bug_catch', { p_token: token(), p_bug: k.id });
      sfx.success();
      if (net) net.send('bug', { s: i, w, b: k.id });
      if (bugBook) bugBook.mine[k.id] = { ...(bugBook.mine[k.id] || {}), count: r.count };
      showCatchCard(k, r.count, r.kinds);
    } catch (e) {
      if (e.code === 'SESSION') { sessionLost(); return; }
      toast(message(e), 2800);
    }
  });
}
let catchCard = null;
function showCatchCard(k, count, kinds) {
  if (catchCard) catchCard.remove();
  const close = () => { if (catchCard === card) { card.remove(); catchCard = null; } };
  const ic = h('div', { class: 'bug-ic', 'aria-hidden': 'true' });
  ic.innerHTML = bugIcon(k.id);
  const card = h('div', { class: 'invite-card catch-card', role: 'status' }, ic,
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, `${josa(k.name, '을', '를')} 잡았어요!`), ' ',
        count === 1 ? `처음 잡았어요. 곤충 도감에 올랐어요! (${kinds}/${BUGS.length}가지)` : `지금까지 ${count}마리 잡았어요.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '닫기'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); openBag(k.id); } }, '도감 보기'))));
  catchCard = card;
  document.body.append(card);
  setTimeout(close, 6500);
}

// ---------- 가방: 곤충 도감과 내 불꽃 ----------
let shopData = null;
async function loadShop() {
  try { shopData = await rpc('kids_shop', { p_token: token() }); if (shopData && Number.isFinite(shopData.fruits)) setFruits(shopData.fruits); } catch (e) { if (e.code === 'SESSION') sessionLost(); }
  return shopData;
}
async function openBag(focusBug) {
  const body = h('div', { class: 'talk bag' }, h('p', { class: 'fb-empty' }, '가방을 여는 중…'));
  openSheet('내 가방', body, 'bag-sheet');
  const [book, shop] = await Promise.all([state.features.bugs ? loadBugBook() : null, state.features.shop ? loadShop() : null]);
  if (!modal.isOpen) return;
  const secs = [];
  // 불꽃
  const fw = h('section', { class: 'bag-sec' }, h('h3', {}, '🎆 내 불꽃'));
  if (!state.features.shop) fw.append(h('p', { class: 'note' }, '열매 상점은 곧 문을 열어요.'));
  else {
    const items = (shop && shop.items) || {};
    const owned = FW_IDS.filter((id) => items[id] > 0);
    if (!owned.length) fw.append(h('p', { class: 'note' }, '아직 불꽃이 없어요. 열매 상점에서 열매로 살 수 있어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); village.walkTo('shop'); } }, '열매 상점으로 가기')));
    else fw.append(h('div', { class: 'shop-list' }, owned.map((id) => fwRow(id, items[id], { launch: true }))));
  }
  secs.push(fw);
  // 애완동물
  if (state.features.pets) {
    const items = (shop && shop.items) || {};
    const owned = PET_IDS.filter((id) => items[id] > 0);
    const pets = h('section', { class: 'bag-sec' }, h('h3', {}, '🐾 우리 집 친구'));
    if (!owned.length) pets.append(h('p', { class: 'note' }, '아직 애완동물이 없어요. 열매 상점에서 열매 30개로 데려올 수 있어요.'));
    else pets.append(h('div', { class: 'shop-list' }, owned.map((id) => petRow(id, { owned: true }))));
    secs.push(pets);
  }
  // 곤충 도감
  const bugs = h('section', { class: 'bag-sec' });
  if (!state.features.bugs) bugs.append(h('h3', {}, '🦋 곤충 도감'), h('p', { class: 'note' }, '곤충 채집은 곧 열려요.'));
  else {
    const mine = (book && book.mine) || {};
    const got = BUGS.filter((b) => mine[b.id]).length;
    const detail = h('div', { class: 'bug-detail', hidden: true });
    const show = (b) => {
      const m = mine[b.id];
      detail.hidden = false;
      const ic = h('div', {});
      ic.innerHTML = bugIcon(b.id, !!m);
      detail.replaceChildren(ic, h('div', {},
        h('b', {}, m ? b.name : '아직 못 잡은 곤충'),
        h('p', { class: 'note' }, `${{ flower: '꽃밭', grass: '풀밭', tree: '나무줄기', water: '물가' }[b.habitat]} · ${RARITY_TEXT[b.rarity]}${b.night ? ' · 밤에만' : ''}${m ? ` · ${m.count}마리 잡음` : ''}`),
        h('p', {}, m ? b.desc : `${{ flower: '꽃밭', grass: '풀밭', tree: '나무줄기', water: '물가' }[b.habitat]}에서 찾아봐요.`)));
    };
    const grid = h('div', { class: 'bug-grid' }, BUGS.map((b) => {
      const m = mine[b.id];
      const cell = h('button', { class: 'bug-cell' + (b.id === focusBug ? ' new' : ''), type: 'button', onclick: () => show(b) });
      cell.innerHTML = bugIcon(b.id, !!m);
      cell.append(h('b', {}, m ? b.name : '???'), h('small', {}, m ? `${m.count}마리` : RARITY_TEXT[b.rarity]));
      return cell;
    }));
    bugs.append(h('h3', {}, `🦋 곤충 도감 (${got}/${BUGS.length})`),
      h('p', { class: 'note' }, '꽃밭, 풀밭, 나무줄기, 물가에서 반짝이는 곤충을 눌러 그물로 잡아요. 반딧불이는 밤에만 나와요.'), grid, detail);
    if (focusBug) { const b = bugById(focusBug); if (b) show(b); }
  }
  secs.push(bugs);
  body.replaceChildren(...secs);
}
// 불꽃 한 줄 (상점과 가방에서 같이 쓴다)
function fwRow(id, count, { buy = false, launch = false, fruits = 0 } = {}) {
  const f = FIREWORKS[id];
  const ic = h('div', { class: 'fw-ic', 'aria-hidden': 'true' });
  ic.innerHTML = fireworkIcon(id);
  const acts = h('div', { class: 'acts' });
  if (buy) acts.append(h('button', { class: 'btn btn-go btn-small', type: 'button', disabled: fruits < f.price, onclick: () => buyFirework(id) }, `열매 ${f.price}개로 사기`));
  if (launch && count > 0) acts.append(h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); launchFirework(id); } }, '펑! 터트리기'));
  return h('div', { class: 'shop-item' }, ic,
    h('div', {}, h('b', {}, f.name), h('p', {}, f.desc), h('p', {}, count ? `가방에 ${count}개` : '')), acts);
}

// ---------- 애완동물 ----------
// 상점과 가방에 쓰는 작은 그림
function petIcon(id) {
  const c = (PET_ITEMS[id] || {}).coat || '#ccc';
  const eye = '<circle cx="19" cy="25" r="2.2" fill="#2E2A2A"/><circle cx="29" cy="25" r="2.2" fill="#2E2A2A"/>';
  const face = `<circle cx="24" cy="27" r="13" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/>${eye}`;
  if (id === 'pet_dog') return `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="11" cy="22" rx="5" ry="10" fill="#8A5A33"/><ellipse cx="37" cy="22" rx="5" ry="10" fill="#8A5A33"/>${face}<ellipse cx="24" cy="32" rx="6" ry="4.5" fill="#FFF3DA"/><circle cx="24" cy="30" r="2.2" fill="#2E2A2A"/></svg>`;
  if (id === 'pet_cat') return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 20 14 6 23 15zM36 20 34 6 25 15z" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/>${face}<path d="M22 31h4l-2 2z" fill="#EF8FA0"/><path d="M14 30h-6M14 33h-6M34 30h6M34 33h6" stroke="#5A3D2B" stroke-width="1"/></svg>`;
  if (id === 'pet_rabbit') return `<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="18" cy="12" rx="4.5" ry="11" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/><ellipse cx="30" cy="12" rx="4.5" ry="11" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/><ellipse cx="18" cy="12" rx="2" ry="7" fill="#F6B8C8"/><ellipse cx="30" cy="12" rx="2" ry="7" fill="#F6B8C8"/>${face}<circle cx="24" cy="31" r="2" fill="#F6B8C8"/></svg>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="28" r="14" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/><path d="M22 13c1-3 3-4 5-3" stroke="#5A3D2B" stroke-width="1.5" fill="none"/>${eye}<path d="M20 30h8l-4 4z" fill="#F49A4C"/></svg>`;
}
function petRow(id, { owned, buy = false, fruits = 0 }) {
  const p = PET_ITEMS[id];
  const ic = h('div', { class: 'fw-ic pet', 'aria-hidden': 'true' });
  ic.innerHTML = petIcon(id);
  const acts = h('div', { class: 'acts' });
  const withMe = state.me && state.me.pet === id;
  if (!owned && buy) acts.append(h('button', { class: 'btn btn-go btn-small', type: 'button', disabled: fruits < p.price, onclick: () => buyPet(id) }, `열매 ${p.price}개로 데려오기`));
  if (owned) acts.append(withMe
    ? h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => choosePet(null) }, '집에서 쉬게 하기')
    : h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => choosePet(id) }, '데리고 다니기'));
  return h('div', { class: 'shop-item' + (withMe ? ' with-me' : '') }, ic,
    h('div', {}, h('b', {}, p.name), h('p', {}, p.desc), h('p', {}, owned ? (withMe ? '지금 나와 함께 다녀요' : '우리 집 친구예요') : '')), acts);
}
let petBusy = false;
async function buyPet(id) {
  if (petBusy) return;
  petBusy = true;
  try {
    const r = await rpc('kids_shop_buy', { p_token: token(), p_item: id, p_n: 1 });
    shopData = r;
    setFruits(r.fruits);
    sfx.success();
    petBusy = false;
    await choosePet(id, true);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { petBusy = false; }
}
async function choosePet(id, fresh = false) {
  if (petBusy) return;
  petBusy = true;
  try {
    await rpc('kids_pet_set', { p_token: token(), p_pet: id });
    state.me.pet = id;
    village.setPet('me', id);
    if (net) net.send('av', {});
    if (id) {
      const p = PET_ITEMS[id];
      if (p.kind === 'cat') sfx.meow(); else if (p.kind === 'rabbit') sfx.hop(); else if (p.kind === 'chick') sfx.peep(); else sfx.bark();
      toast(fresh ? `${josa(p.name, '이가', '가')} 우리 집 친구가 되었어요! 이제 졸졸 따라다녀요.` : `${josa(p.name, '이랑', '랑')} 함께 다녀요!`, 3000);
    } else toast('애완동물이 집에서 쉬고 있어요.', 2400);
    const body = document.querySelector('#modalBody .talk.shop');
    if (body && shopData) drawShop(body, shopData);
    const bag = document.querySelector('#modalBody .talk.bag');
    if (bag) openBag();
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { petBusy = false; }
}

// 새로 생긴 일을 한 번씩 알려 준다 (기기마다 한 번)
function showNews() {
  const news = [];
  if (state.features.photo10) news.push(['photo10', '새 소식! 필사 이야기를 공책에 손으로 써서 사진을 올리면 열매 10개를 받아요.']);
  if (state.features.pets) news.push(['pets', '새 소식! 열매 상점에 애완동물이 왔어요. 열매 30개로 데려오면 졸졸 따라다녀요.']);
  const fresh = news.filter(([k]) => { try { return !localStorage.getItem(`kv.news.${k}`); } catch (e) { return false; } });
  fresh.forEach(([k, text], i) => setTimeout(() => {
    toast(text, 5200);
    try { localStorage.setItem(`kv.news.${k}`, '1'); } catch (e) { /* 다음에 또 */ }
  }, 2500 + i * 5800));
}

// ---------- 열매 상점 ----------
async function openShop() {
  const body = h('div', { class: 'talk shop' }, h('p', { class: 'fb-empty' }, '상점을 여는 중…'));
  openSheet('열매 상점', body, 'shop-sheet');
  const shop = await loadShop();
  if (!modal.isOpen) return;
  drawShop(body, shop);
}
function drawShop(body, shop) {
  if (!shop) { body.replaceChildren(h('p', { class: 'note' }, '상점을 열지 못했어요. 잠시 뒤에 다시 와 주세요.')); return; }
  const items = shop.items || {};
  body.replaceChildren(
    h('p', { class: 'shop-fruit' }, `내 열매 🍎 ${shop.fruits}개`),
    h('h3', { class: 'shop-h' }, '🎆 불꽃놀이'),
    h('div', { class: 'shop-list' }, FW_IDS.map((id) => fwRow(id, items[id] || 0, { buy: true, launch: true, fruits: shop.fruits }))),
    state.features.pets ? h('h3', { class: 'shop-h' }, '🐾 애완동물') : null,
    state.features.pets ? h('div', { class: 'shop-list' }, PET_IDS.map((id) => petRow(id, { owned: items[id] > 0, buy: true, fruits: shop.fruits }))) : null,
    h('p', { class: 'note' }, state.features.pets
      ? '열매는 암송 연습, 묵상, 필사를 하면 모여요. 산 불꽃은 가방에 들어가고, 마을 어디서나 터트릴 수 있어요. 애완동물은 한 번 데려오면 계속 우리 집 친구예요. 한 번에 한 마리가 나를 따라다녀요.'
      : '열매는 암송 연습, 묵상, 필사를 하면 모여요. 산 불꽃은 가방에 들어가고, 마을 어디서나 터트릴 수 있어요. 친구들 하늘에도 같이 터져요.'));
}
let buying = false;
async function buyFirework(id) {
  if (buying) return;
  buying = true;
  try {
    const r = await rpc('kids_shop_buy', { p_token: token(), p_item: id, p_n: 1 });
    shopData = r;
    setFruits(r.fruits);
    sfx.success();
    toast(`${josa(FIREWORKS[id].name, '을', '를')} 샀어요! 가방에서 언제든 터트릴 수 있어요.`, 2800);
    const body = document.querySelector('#modalBody .talk.shop');
    if (body) drawShop(body, r);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { buying = false; }
}
let launching = false;
async function launchFirework(id) {
  if (launching || !village.player) return;
  launching = true;
  try {
    const r = await rpc('kids_item_use', { p_token: token(), p_item: id });
    if (shopData && shopData.items) shopData.items[id] = r.left;
    // 보는 쪽으로 조금 앞에서 쏘아 올리고, 잠깐 하늘을 올려다본다
    const a = village.aheadOf(4);
    const x = +a.x.toFixed(2), z = +a.z.toFixed(2);
    village.fireworks.launch(id, x, z);
    village.lookUp(4.8);
    village.celebrate();
    if (net) net.send('fw', { k: id, x, z });
    toast(`${FIREWORKS[id].name}! 하늘을 봐요${r.left ? ` (가방에 ${r.left}개 남았어요)` : ''}`, 2600);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 2600);
  } finally { setTimeout(() => { launching = false; }, 600); }
}

// ---------- 마을 식탁: 누가 먹었는지 보고, 친구 요리를 먹는다 ----------
function openDish(d) {
  const eaters = Array.isArray(d.eaters) ? d.eaters : [];
  const canEat = !!state.features.eat && !d.me && !d.ate;
  const body = h('div', { class: 'talk dish-eat' },
    h('p', { class: 'result-big' }, d.name || '요리'),
    h('p', {}, d.me ? '내가 만든 요리예요.' : `${d.cook || '친구'}${hasB(d.cook) ? '이가' : '가'} 만든 요리예요.`),
    state.features.eat ? h('div', { class: 'eaters' }, eaters.length
      ? [h('b', {}, `냠냠 먹은 친구 ${d.eaten || eaters.length}명`), h('p', {}, eaters.join(', ') + ((d.eaten || 0) > eaters.length ? ' …' : ''))]
      : h('p', {}, '아직 아무도 안 먹었어요.')) : null,
    d.ate ? h('p', { class: 'note' }, '나도 벌써 맛있게 먹었어요!') : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-plain', type: 'button', onclick: () => modal.close() }, '닫기'),
      canEat ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => eatDish(d) }, '냠냠 먹기') : null));
  openSheet('마을 식탁', body, 'talk-sheet');
}
const hasB = (w) => { const c = String(w || '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
let eatingDish = false;
async function eatDish(d) {
  if (eatingDish) return;
  eatingDish = true;
  try {
    await rpc('kids_dish_eat', { p_token: token(), p_dish: d.id });
    modal.close();
    village.eatDish(d);
    if (net) net.send('ate', { d: d.id });
    dishAt = 0;
    setTimeout(refreshDishes, 2600);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 2800);
  } finally { eatingDish = false; }
}

// ---------- 친구 목록, 둘이 대화, 오목 구경 ----------
function watchableGames() {
  const out = [];
  for (const [id, o] of observes) {
    if (Date.now() - o.at > 30000 || !online.has(id)) continue;
    const other = o.st.k === id ? o.st.w : o.st.k;
    out.push({ id, name: (state.people.get(id) || {}).name || '친구', vs: other === 'g' ? '숲지기 솔' : (state.people.get(other) || {}).name || '' });
  }
  return out;
}

function friendsBadge() {
  const el = $('#onlineCount');
  el.dataset.unread = state.unread ? String(state.unread) : '';
}

function openFriends() {
  const list = [...online].map((id) => state.people.get(id)).filter(Boolean);
  const games = new Set(watchableGames().map((g) => g.id));
  const dmOk = !!(state.features.dm && state.chatOpen);
  const rows = list.map((p) => {
    const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
    drawFaceIcon(face, normalizeAvatar(p.avatar));
    const r = village.remotes.get(p.id);
    const act = r && r.actName;
    const unread = (state.dms.get(p.id) || []).filter((m) => !m.mine && !m.read).length;
    return h('div', { class: 'fl-row' }, face,
      h('div', { class: 'fl-main' }, h('b', {}, p.name), h('span', {}, act ? `${ACT_ICON[act] || ''} ${ACT_TEXT[act] || ''}` : '마을을 걷고 있어요')),
      h('div', { class: 'fl-acts' },
        dmOk ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => openDm(p.id) }, unread ? `💌 이야기 (${unread})` : '💌 둘이 이야기') : null,
        games.has(p.id) ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); play3d.omokWatch(p.id); } }, '👀 구경하기') : null,
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => { modal.close(); if (play3d.active) play3d.stop(); village.walkToFriend(p.id); } }, '찾아가기')));
  });
  openSheet(`지금 마을에 있는 친구 ${list.length}명`, h('div', { class: 'talk friends' },
    rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '지금은 혼자 있어요. 친구가 들어오면 여기에 보여요.'),
    dmOk ? h('p', { class: 'note' }, '둘이 이야기한 글은 둘만 보이지만, 안전을 위해 선생님은 볼 수 있어요.') : null), 'talk-sheet');
}

function addDm(id, text, mine) {
  const list = state.dms.get(id) || [];
  list.push({ mine, text, at: Date.now(), read: mine || dmOpenWith === id });
  while (list.length > 60) list.shift();
  state.dms.set(id, list);
  if (dmOpenWith === id) { drawDm(); if (!mine) sfx.pop(true); return; }
  if (!mine) {
    state.unread += 1;
    friendsBadge();
    sfx.invite();
    const p = state.people.get(id) || { name: '친구' };
    showDmCard(id, p.name, text);
  }
}

let dmCard = null;
function showDmCard(id, name, text) {
  if (dmCard) dmCard.remove();
  const close = () => { if (dmCard === card) { card.remove(); dmCard = null; } };
  const card = h('div', { class: 'invite-card dm-card', role: 'status' },
    h('div', { class: 'dm-ic', 'aria-hidden': 'true' }, '💌'),
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, name), ' ', text),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '나중에'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); openDm(id); } }, '대답하기'))));
  dmCard = card;
  document.body.append(card);
  setTimeout(close, 7000);
}

let dmOpenWith = null, dmBody = null;
function drawDm() {
  if (!dmBody) return;
  const list = state.dms.get(dmOpenWith) || [];
  for (const m of list) if (!m.mine && !m.read) { m.read = true; state.unread = Math.max(0, state.unread - 1); }
  friendsBadge();
  dmBody.replaceChildren(...(list.length ? list.map((m) => h('p', { class: 'dm-msg' + (m.mine ? ' me' : '') }, m.text)) : [h('p', { class: 'fb-empty' }, '먼저 인사해 볼까요?')]));
  dmBody.scrollTop = dmBody.scrollHeight;
}
function openDm(id) {
  const p = state.people.get(id);
  if (!p) return;
  dmOpenWith = id;
  dmBody = h('div', { class: 'dm-list', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', maxlength: CHAT_MAX, autocomplete: 'off', enterkeyhint: 'send', placeholder: `${p.name}에게 할 말`, 'aria-label': `${p.name}에게 할 말` });
  let sending = false;
  const form = h('form', { class: 'say-write' }, input, h('button', { class: 'btn btn-go btn-small', type: 'submit', 'data-quiet': '' }, '보내기'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t0 = cleanChat(input.value);
    if (!t0 || sending) return;
    if (!online.has(id)) { toast(`${josa(p.name, '이', '가')} 지금 마을에 없어요.`); return; }
    sending = true;
    try {
      const r = await rpc('kids_dm_send', { p_token: token(), p_to: id, p_text: input.value });
      const t = cleanChat(r && r.text);
      if (t) { input.value = ''; addDm(id, t, true); sfx.pop(); if (net) net.send('dm', { to: id, m: t }); }
    } catch (err) {
      if (err.code === 'SESSION') { sessionLost(); return; }
      toast(message(err));
    } finally { sending = false; }
  });
  openSheet(`💌 ${josa(p.name, '과', '와')} 둘이 이야기`, h('div', { class: 'talk dm' },
    dmBody, form, h('p', { class: 'note' }, '둘만 보이는 이야기예요. 안전을 위해 선생님은 볼 수 있어요.')), 'talk-sheet');
  const m = document.getElementById('modal');
  const obs = new MutationObserver(() => { if (m.hidden || !document.body.contains(dmBody)) { dmOpenWith = null; dmBody = null; obs.disconnect(); } });
  obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  drawDm();
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 60);
}

// ---------- 화면 ----------
function updateHud() {
  const me = state.me;
  $('#hudName').textContent = me.village_name || '';
  drawFaceIcon($('#hudFace'), normalizeAvatar(me.avatar));
  setFruits(me.fruits);
}

function setFruits(n) {
  if (state.me) state.me.fruits = n;
  const el = $('#hudFruit');
  if (Number(el.textContent) < n && !$('#hud').hidden) sfx.fruit();
  if (el.textContent !== String(n)) {
    el.textContent = String(n);
    el.parentElement.classList.remove('bump');
    void el.offsetWidth;
    el.parentElement.classList.add('bump');
  }
}

function hideHint() {
  if (hintShown) { $('#hint').classList.add('gone'); hintShown = false; }
}

function openSheet(title, body, cls = '') {
  hideHint();
  $('#sayPanel').hidden = true;
  village.setPaused(true);
  modal.open(title, body, { cls, onClose: () => village.setPaused(false) });
}

// 집 안 창을 열고, 닫히면 마을을 다시 움직인다
function openHouse(fn, act = '') {
  hideHint();
  if (village.standUp) village.standUp(); // 새로 고칠 때 예전 파일이 섞여 있어도 집은 열리게
  $('#sayPanel').hidden = true;
  village.setPaused(true);
  fn();
  setActivity(act);
  setScene(GAMES[act] ? 'game' : 'quiet');
  const m = document.getElementById('modal');
  const obs = new MutationObserver(() => {
    if (m.hidden) { village.setPaused(false); obs.disconnect(); refreshToday(); setActivity(''); setScene('village'); }
  });
  obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
}

// 친구의 놀이 초대를 받았을 때
function openGameWith(kind, session) {
  if (modal.isOpen) modal.close();
  hideHint();
  $('#sayPanel').hidden = true;
  if (kind === 'omok') play3d.omok({ session });
  else play3d.cook({ recipe: recipeById(session.extra) || RECIPES[0], session });
}

function onEnter(id) {
  if (id === 'memory') return openHouse(() => memory.open(), 'memory');
  if (id === 'qt') return openHouse(() => qt.open(), 'qt');
  if (id === 'library') return openHouse(() => copy.open(), 'copy');
  if (GAMES[id]) return openGame(id);
  if (id === 'home') return openMaker(false);
  if (id === 'shop' && state.features.shop) return openShop();
  const s = SOON[id];
  if (s) {
    openSheet(s[0], h('div', { class: 'talk' },
      h('p', { class: 'result-big' }, '곧 문을 열어요!'),
      h('p', {}, s[1]),
      h('p', { class: 'note' }, '열매는 말씀 연습, 묵상, 필사를 하면 모을 수 있어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => modal.close() }, '알겠어요'))), 'talk-sheet');
  }
}

function onNpc() {
  const me = state.me;
  const t = state.today || {};
  const cur = memory.current();
  const name = josa(me.village_name, '아', '야');
  const lines = [];
  if (me.is_birthday) lines.push(`${name}, 생일 축하해! 오늘은 마을이 더 반짝이는 것 같아.`);
  else lines.push(`안녕, ${name}!${t.theme ? ` 이번 주 이야기는 '${t.theme}'이야.` : ''}`);
  let go = null;
  if (!playOpen()) lines.push('말씀 활동을 하나 마치면 놀이 마당과 놀이동산 섬이 열려. 낚시도 하고 바이킹도 탈 수 있어!');
  if (t.qt && !t.qt.done) { lines.push(`오늘 묵상은 '${t.qt.title}'이야. 묵상의 숲에 가 볼래?`); go = ['묵상의 숲으로', 'qt']; }
  else if (cur && !cur.practiced_today && !cur.passed) { lines.push(`이번 주 말씀은 ${cur.ref}이야. 암송의 집에서 연습해 볼까?`); go = ['암송의 집으로', 'memory']; }
  else if (t.copy && !t.copy.done) { if (state.features.photo10) lines.push('이번 주 이야기를 공책에 손으로 써서 사진을 올리면 열매를 10개나 받을 수 있어!'); lines.push(t.theme ? `이번 주 필사는 '${t.theme}' 이야기야(${t.copy.ref}). 필사 도서관에서 읽고 따라 써 볼래?` : `이번 주 필사는 ${t.copy.ref}이야. 필사 도서관에서 따라 써 볼래?`); go = ['필사 도서관으로', 'library']; }
  else if (t.qt || cur) { lines.push('오늘 할 일을 벌써 다 했구나. 정말 멋지다! 친구들 글에 응원도 보내 봐.'); lines.push('남쪽 다리를 건너면 놀이동산 섬이야. 친구랑 회전목마나 바이킹을 타도 좋아. 동쪽 다리 건너 수영장 섬에서 헤엄쳐도 좋고!'); }
  else lines.push('마을을 천천히 둘러보렴. 남쪽 다리를 건너면 놀이동산 섬, 동쪽 다리를 건너면 수영장 섬이야. 열매가 달린 나무를 누르면 열매를 따 먹을 수 있어.');
  openSheet('숲지기 솔', h('div', { class: 'talk' },
    lines.map((l) => h('p', { class: 'talk-line' }, l)),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => modal.close() }, '고마워요'),
      go ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { modal.close(); village.walkTo(go[1]); } }, go[0]) : null)), 'talk-sheet');
}

function openBoard() {
  const cur = memory.current();
  const t = state.today || {};
  openSheet('마을 게시판', h('div', { class: 'mem' },
    t.theme ? h('p', { class: 'board-theme' }, h('span', { class: 'tag' }, '이번 주 이야기'), ' ', t.theme) : null,
    cur ? memory.verseCard(cur) : h('div', { class: 'empty' }, h('p', { class: 'empty-big' }, '이번 주 말씀이 곧 올라와요.')),
    h('div', { class: 'board-todo' },
      t.qt ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => qt.open()); } },
        h('b', {}, '오늘 묵상'), h('span', {}, t.qt.title), h('em', {}, t.qt.done ? '마침' : '아직')) : null,
      t.copy ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => copy.open()); } },
        h('b', {}, '이번 주 필사'), h('span', {}, t.theme || t.copy.ref), h('em', {}, t.copy.done ? '마침' : '아직')) : null,
      cur ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => memory.open('practice', cur.id)); } },
        h('b', {}, '이번 주 암송'), h('span', {}, cur.ref), h('em', {}, cur.passed ? '도장' : cur.practice_count ? '연습 중' : '아직')) : null)));
}

async function openMaker(first) {
  village.setPaused(true);
  $('#hud').hidden = true;
  $('#prompt').hidden = true;
  $('#sayPanel').hidden = true;
  const me = state.me;
  let result = await maker.open({ avatar: me.avatar || defaultAvatar(), name: me.village_name || '', first });
  while (result) {
    try {
      const pet = state.me && state.me.pet;
      state.me = await rpc('kids_save_avatar', { p_token: token(), p_avatar: result.avatar, p_village_name: result.name });
      if (state.me && !('pet' in state.me)) state.me.pet = pet;
      break;
    } catch (e) {
      if (e.code === 'SESSION') { maker.close(); return sessionLost(); }
      maker.setError(message(e));
      result = await new Promise((resolve) => { maker.resolve = resolve; });
    }
  }
  maker.close();
  if (result) {
    village.setPlayer(state.me.avatar);
    village.setHome(state.me.village_name, normalizeAvatar(state.me.avatar));
    village.setMyName(state.me.village_name);
    if (net) net.send('av', {});
  }
  if (first && !result) return;
  if (first) return enterVillage(true);
  village.setPaused(false);
  updateHud();
  $('#hud').hidden = false;
  if (result) { village.celebrate(); toast('새 모습이 정말 잘 어울려요!'); }
}

function askLogout() {
  openSheet('마을에서 나가기', h('div', { class: 'talk' },
    h('p', {}, '다음에 또 놀러 와요! 함께 쓰는 태블릿이라면 꼭 나가기를 눌러 주세요.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => modal.close() }, '더 있을래요'),
      h('button', { class: 'btn btn-red', type: 'button', onclick: logout }, '나가기'))), 'talk-sheet');
}

async function logout() {
  modal.close();
  try { await rpc('kids_logout', { p_token: token() }); } catch (e) { /* 이미 끊겼어도 괜찮다 */ }
  state.token = null;
  state.me = null;
  store.del('token');
  showLogin();
}

function sessionLost() {
  modal.close();
  state.token = null;
  store.del('token');
  showLogin();
  $('#loginErr').textContent = message({ code: 'SESSION' });
}

window.addEventListener('pagehide', () => stopNet());
boot();
