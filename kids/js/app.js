// 진숲 어린이 마을 — 아이 화면 흐름 (로그인 → 꾸미기 → 마을)
import { Village } from './world.js';
import { rpc, message, DEMO, store } from './api.js';
import { Maker } from './maker.js';
import { createMemory } from './memory.js';
import { createQt } from './qt.js';
import { createCopy } from './copy.js';
import { createNet, PHRASES, EMOTES, clean } from './net.js';
import { cleanChat, CHAT_MAX } from './chatfilter.js';
import { createPlayHub } from './play.js';
import { createArt } from './art.js';
import { createPlay3D } from './play3d.js';
import { ACT_ICON, fishById, recipeById, RECIPES } from './play-data.js';
import { initSound, startMusic, stopMusic, setScene, sfx, cycleSound, soundMode } from './sound.js';
import { h, modal, toast, confetti, josa } from './ui.js';
import { drawFaceIcon, normalizeAvatar, defaultAvatar } from './face.js';

const $ = (s) => document.querySelector(s);
const state = { token: store.get('token'), me: null, people: new Map(), today: null };
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
      $('#promptAct').textContent = { board: '보기', fish: '낚시하기', omok: '두기', cook: '요리하기', art: '그리기' }[d.id] || '들어가기';
      p.dataset.id = d.id;
      p.hidden = false;
    },
    placePrompt: (x, y) => { $('#prompt').style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; },
    onMove: () => hideHint(),
    onLocalMove: (p) => net && net.send('mv', p),
    onLocalStop: (p) => net && net.send('st', p),
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
  qt = createQt(common);
  copy = createCopy(common);
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
  art = createArt({ ...common, onShared: () => { if (net) net.send('art', {}); refreshWall(); }, onSaved: (b64) => { if (play3d) play3d.artSaved(b64); } });
  // 놀이는 창을 띄우지 않고 마을 안 그 자리에서 3D로 한다
  play3d = createPlay3D({
    village, rpc, getToken: token, onSessionLost: sessionLost, onCelebrate: () => village.celebrate(),
    setActivity, setScene, hub, onlineFriends,
    onRare: (f) => { if (net) net.send('fish', { f }); },
    openArt: (start, onClose) => art.open(start, { onClose }),
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
  $('#btnOut').addEventListener('click', askLogout);
  $('#btnSay').addEventListener('click', toggleSay);
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
const GAMES = { fish: () => play3d.fishing(), omok: () => play3d.omokMenu(), cook: () => play3d.cookMenu(), art: () => play3d.easel() };
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
    h('p', {}, '오늘 암송 연습, 오늘 묵상, 이번 주 필사 가운데 하나만 해도 돼요. 마치고 오면 낚시, 오목, 그림, 요리를 할 수 있어요.'),
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
  village.setMode('play');
  rpc('kids_chat_open').then(showChatInput).catch(() => showChatInput(false));
  village.setPaused(false);
  updateHud();
  $('#hud').hidden = false;
  if (greet) {
    $('#hint').hidden = false;
    $('#hint').classList.remove('gone');
    hintShown = true;
  }
  memory.load().catch((e) => { if (e.code === 'SESSION') sessionLost(); });
  refreshToday();
  refreshWall();
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
      if (!online.has(id)) { online.add(id); showCount(); village.addRemote(id, person.avatar, person.name); }
      if (type === 'mv') village.remoteMove(id, p);
      else if (type === 'st') village.remoteStop(id, p);
      else if (type === 'say') {
        const text = PHRASES[p.p] || EMOTES[p.p];
        village.say(id, text);
        sfx.pop(true);
        logLine(person.name, text, false);
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
        village.setRemoteActivity(id, ACT_ICON[p.a] || '', p.a || '');
      } else if (type === 'fish') {
        const f = fishById(p.f);
        if (f && f.rarity >= 2) {
          toast(`${josa(person.name, '이가', '가')} ${josa(f.name, '을', '를')} 낚았어요!`, 3200);
          logLine(person.name, `🎣 ${f.name}!`, false);
        }
      } else if (type === 'art') {
        refreshWall();
        logLine(person.name, '🎨 전시관에 그림을 걸었어요', false);
      } else if (type === 'av') {
        try { await fetchPeople(true); } catch (e) { return; }
        const np = state.people.get(id);
        if (np) village.addRemote(id, np.avatar, np.name);
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

let wallAt = 0;
async function refreshWall() {
  if (Date.now() - wallAt < 3000) return;
  wallAt = Date.now();
  try { village.setArtWall(await rpc('kids_art_wall', { p_token: token() })); } catch (e) { /* 다음에 */ }
}

let myAct = '';
function setActivity(a) {
  if (a === myAct) return;
  myAct = a;
  if (net) net.send('act', { a });
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
  else lines.push(`안녕, ${name}!${t.theme ? ` 이번 주 주제는 '${t.theme}'이야.` : ''}`);
  let go = null;
  if (!playOpen()) lines.push('말씀 활동을 하나 마치면 남쪽 놀이 마당이 열려. 낚시도 하고 오목도 둘 수 있어!');
  if (t.qt && !t.qt.done) { lines.push(`오늘 묵상은 '${t.qt.title}'이야. 묵상의 숲에 가 볼래?`); go = ['묵상의 숲으로', 'qt']; }
  else if (cur && !cur.practiced_today && !cur.passed) { lines.push(`이번 주 말씀은 ${cur.ref}이야. 암송의 집에서 연습해 볼까?`); go = ['암송의 집으로', 'memory']; }
  else if (t.copy && !t.copy.done) { lines.push(`이번 주 필사는 ${t.copy.ref}이야. 필사 도서관에서 따라 써 볼래?`); go = ['필사 도서관으로', 'library']; }
  else if (t.qt || cur) { lines.push('오늘 할 일을 벌써 다 했구나. 정말 멋지다! 친구들 글에 응원도 보내 봐.'); lines.push('남쪽 놀이 마당에서 친구랑 오목을 두거나, 연못에서 낚시를 해도 좋아.'); }
  else lines.push('마을을 천천히 둘러보렴. 연못에서 낚시를 하거나 그림 공방에서 그림을 그려도 좋아.');
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
    t.theme ? h('p', { class: 'board-theme' }, h('span', { class: 'tag' }, '이번 주 주제'), ' ', t.theme) : null,
    cur ? memory.verseCard(cur) : h('div', { class: 'empty' }, h('p', { class: 'empty-big' }, '이번 주 말씀이 곧 올라와요.')),
    h('div', { class: 'board-todo' },
      t.qt ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => qt.open()); } },
        h('b', {}, '오늘 묵상'), h('span', {}, t.qt.title), h('em', {}, t.qt.done ? '마침' : '아직')) : null,
      t.copy ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => copy.open()); } },
        h('b', {}, '이번 주 필사'), h('span', {}, t.copy.ref), h('em', {}, t.copy.done ? '마침' : '아직')) : null,
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
      state.me = await rpc('kids_save_avatar', { p_token: token(), p_avatar: result.avatar, p_village_name: result.name });
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
