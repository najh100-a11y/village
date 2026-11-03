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
import { ACT_ICON, ACT_TEXT, fishById, recipeById, RECIPES, FISH } from './play-data.js';
import { BUGS, bugById, bugIcon, catchChance, RARITY_TEXT } from './bugs.js';
import { TREASURES, treasureById, treasureIcon, treasureShadow, TREASURE_RARITY, BOTTLE_NOTES } from './beach-data.js';
import { FIREWORKS, FW_IDS, fireworkIcon } from './fireworks.js';
import { PET_ITEMS, PET_IDS, PET_FOOD } from './critters.js';
import { HOME_ITEMS, HOME_IDS, ZONE_NAMES, HARVEST, CROP_IDS } from './homeitems.js';
import { itemThumb, avatarThumb } from './home.js';
import { WARDROBE, WARDROBE_IDS } from './wardrobe.js';
import { GIFT, GIFT_MSGS } from './economy.js';
import { fishCanvas } from './fishing.js';
import { createHomeUI } from './homeui.js';
import { REWARD } from './economy.js';
import { initSound, startMusic, stopMusic, setScene, sfx, cycleSound, soundMode, setRain } from './sound.js';
import { createWeather, KINDS as WX_KINDS, KIND_IDS as WX_IDS, iconOf as wxIcon, WEATHER_CREDIT } from './weather.js';
import { h, modal, toast, confetti, josa } from './ui.js';
import { drawFaceIcon, normalizeAvatar, defaultAvatar } from './face.js';
import { BG_IDS, BG_INFO, bgIdOf, bgKind } from './boardgames.js';
import { VILLAGERS, TALK } from './villagers.js';
import { createGuide } from './guide.js';

const $ = (s) => document.querySelector(s);
const state = { token: store.get('token'), me: null, people: new Map(), today: null, features: {}, dms: new Map(), unread: 0 };
// 선생님 주민 이름 옆 작은 표시
const tBadge = (p) => (p && p.teacher ? h('span', { class: 't-badge' }, '선생님') : null);
const observes = new Map(); // 오목 구경: 친구 id → 가장 최근 판
let village = null;
let maker = null;
let memory = null;
let qt = null;
let copy = null;
let net = null;
let hub = null, art = null, play3d = null, homeUI = null, guide = null;
const online = new Set();
let hintShown = false;

const token = () => state.token;

const SOON = {
  shop: ['열매 상점', '모은 열매로 옷과 모자, 꾸미기 도구를 사는 곳이에요.'],
  sea: ['바다 낚시 나루터', '배를 타고 바다에 나가 바다 물고기를 낚는 곳이에요.'],
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
      $('#promptAct').textContent = d.id.startsWith('bg_') ? '하기' : { board: '보기', fish: '낚시하기', skip: '던지기', ark: '놀기', omok: '두기', cook: '요리하기', art: '그리기', ferris: '타기', viking: '타기', carousel: '타기', bumper: '타기', coaster: '타기', 'home-exit': '나가기', 'home-closet': '옷 갈아입기', suggest: '건의하기' }[d.id] || '들어가기';
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
    onHouseMove: (p) => net && net.send('hm', p), // 집 안 움직임 (같은 집에 있는 친구만 본다)
    // 벤치에 앉기 (seat: 자리 번호, 일어나면 null)
    onSit: (seat, lie) => {
      setActivity(seat == null ? '' : 'bench', seat == null ? -1 : seat);
      if (seat != null && lie && !lieTold) { lieTold = true; toast('선베드에 누웠어요. 다른 곳을 누르면 일어나요.', 2600); }
      else if (seat != null && !lie && !benchTold) { benchTold = true; toast('벤치에 앉았어요. 다른 곳을 누르면 일어나요.', 2600); }
    },
    onBenchFull: (lie) => toast(lie ? '다른 친구가 누워 있어요. 옆 선베드에 누워 볼까요?' : '벤치에 자리가 없어요. 다른 벤치에 앉아 볼까요?', 2400),
    // 열매 따 먹기 (상점에서 쓰는 열매와는 따로예요)
    onFruit: (what, name, kind) => {
      if (what === 'start') { setActivity('eat'); sfx.pop(); }
      else if (what === 'bite') { sfx.munch(); if (!munchSaid) { munchSaid = true; village.say('me', SHOUTS.yum); } }
      else if (what === 'done' && kind === 'dish') { setActivity(''); munchSaid = false; sfx.success(); toast(`${josa(name, '을', '를')} 맛있게 먹었어요! 만든 친구에게 고맙다고 말해 볼까요?`, 3200); }
      else if (what === 'done' && kind === 'npc') { setActivity(''); munchSaid = false; sfx.success(); toast(`${josa(npcSnackFrom || '마을 친구', '이', '가')} 준 ${josa(name, '을', '를')} 맛있게 먹었어요! 고맙다고 말해 볼까요?`, 3400); }
      else if (what === 'done' && kind === 'share') { setActivity(''); munchSaid = false; sfx.success(); toast(`친구가 키운 ${josa(name, '을', '를')} 맛있게 먹었어요! 나눠 준 친구에게 고맙다고 말해 볼까요?`, 3400); }
      else if (what === 'done') { setActivity(''); munchSaid = false; sfx.fruit(); toast(`${josa(name, '을', '를')} 냠냠 먹었어요. 정말 맛있어요!`, 2400); }
      else if (what === 'stop') { setActivity(''); munchSaid = false; }
      else if (what === 'empty') toast('이 나무 열매는 다 땄어요. 조금 있으면 다시 열려요!', 2600);
    },
    onPet: (r) => { if (r.busy) return; petSound(r.kind); if (r.mine) showPetBar(r.item); },
    onPetCare: (e) => onPetCare(e),
    onThunder: () => sfx.thunder(),
    onBug: (i, kind) => onBug(i, kind),
    onNet: (on) => setActivity(on ? 'bug' : ''),
    onDig: (i) => onDig(i),
    onDigging: (on) => setActivity(on ? 'dig' : ''),
    onDish: (i, d) => openDish(d),
    onVillager: (i) => openVillager(i),
    onShare: (i, d) => openShare(d),
    onBoom: (kind, c) => sfx.firework(kind, fwVol(c)),
    onFwLaunch: (item, x, z) => sfx.fwLaunch(fwVol({ x, z })),
    onSplash: () => sfx.splash(),
    onSwim: (on) => onSwim(on),
    onPlant: (id) => homeUI && homeUI.onPlant(id),
    onHomeItem: (id) => homeUI && homeUI.onHomeItem(id),
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
  if (DEMO) { window.kvEnter = (id) => village.enter(id); window.kvVillage = village; window.kvGames = () => ({ play3d, homeUI }); }
  maker = new Maker();
  const common = {
    rpc, getToken: token,
    onFruits: setFruits,
    onCelebrate: () => village.celebrate(),
    onSessionLost: sessionLost,
    onDone: (k) => { if (net) net.send('done', { k }); refreshToday(); },
  };
  memory = createMemory({
    ...common,
    onBoard: (cur) => { const ref = cur ? cur.ref : ''; if (ref !== boardRef) { boardRef = ref; village.setBoard(ref); } },
    onLoaded: (vs) => checkStamps(vs),
  });
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
      const bid = bgIdOf(kind);
      const what = bid ? BG_INFO[bid].name : { omok: '오목', ark: '방주 짝 맞추기', cook: '요리' }[kind] || '놀이';
      if (p) toast(`${josa(p.name, '이가', '가')} ${josa(what, '을', '를')} 같이 하재요. ${unlockHint()} 놀 수 있어요!`, 3800);
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
    features: () => state.features || {},
    personName: (id) => { const p = state.people.get(id); return p ? p.name : ''; },
    onOmokState: (st) => { if (net) net.send('ob', st); },
    getObserve: (id) => { const o = observes.get(id); return o && Date.now() - o.at < 30000 ? o.st : null; },
    watchable: () => watchableGames(),
    getMe: () => state.me,
    getPerson: (id) => state.people.get(id),
  });
  village.decorateRemote = (r, act, hint) => play3d.decorateRemote(r, act, hint);
  homeUI = createHomeUI({
    village, rpc, getToken: token, getMe: () => state.me, features: () => state.features || {}, sfx, setActivity, message,
    openShop: (t) => openShop(t), openMaker: (first) => openMaker(first), openSheet, modal, onSessionLost: sessionLost, setFruits,
    onlineFriends, sendHouseInvite: (id) => net && net.send('hinv', { to: id }),
    openMail: () => (mailOk() ? openMail() : null),
    onCrops: (c) => setCrops(c), openBasket: () => openBasket(),
  });
  // 마을 지도: 어디에 무엇이 있고 무엇을 할 수 있는지 (누르면 그곳으로 걸어간다)
  guide = createGuide({
    village, openSheet, toast,
    ctx: () => ({ features: state.features || {}, today: state.today || {}, verse: memory ? memory.current() : null, open: playOpen(), hint: unlockHint(), opens: opensNow(), people: state.people }),
    close: () => modal.close(),
    isGuest: () => !!(homeUI && homeUI.guest),
    before: async () => { modal.close(); if (village.atHome) await homeUI.exit(); },
    findFriend: (id) => findFriend(id),
  });
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
  $('#tvOpen').addEventListener('click', () => showTeacherLogin(true));
  $('#tvBack').addEventListener('click', () => showTeacherLogin(false));
  $('#tvForm').addEventListener('submit', (e) => { e.preventDefault(); teacherEnter(); });
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
  $('#btnGuide').addEventListener('click', () => {
    $('#btnGuide').classList.remove('fresh');
    try { localStorage.setItem('kv.guideSeen', '1'); } catch (e) { /* 그대로 */ }
    $('#sayPanel').hidden = true;
    guide.open();
  });
  try { if (!localStorage.getItem('kv.guideSeen')) $('#btnGuide').classList.add('fresh'); } catch (e) { /* 그대로 */ }
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
  takeMyPets(state.me);
}

function afterLogin() {
  $('#login').hidden = true;
  if (!state.me.avatar || !state.me.village_name) openMaker(true);
  else enterVillage(true);
}

// ---------- 선생님으로 들어가기 ----------
// 선생님 아이디와 비밀번호로 확인한 뒤, 그 선생님의 마을 주민으로 들어간다 (처음이면 서버가 주민을 만들고 열매 100개를 준다).
// 선생님 화면 로그인은 이 기기에 남기지 않는다 (마을 주민으로만 들어온다).
function showTeacherLogin(on) {
  $('#loginForm').hidden = on;
  $('#joinForm').hidden = true;
  $('#tvForm').hidden = !on;
  $('#tvErr').textContent = '';
  $('#tvDemoNote').hidden = !DEMO;
  setTimeout(() => $(on ? '#tvId' : '#loginId').focus({ preventScroll: true }), 50);
}

async function teacherEnter() {
  const err = $('#tvErr');
  err.textContent = '';
  const id = $('#tvId').value.trim(), pw = $('#tvPw').value;
  if (!id || !pw) { err.textContent = '선생님 아이디와 비밀번호를 써 주세요.'; return; }
  const btn = $('#tvGo');
  btn.disabled = true;
  btn.textContent = '들어가는 중…';
  try {
    const r = await rpc('kids_teacher_login', { p_login_id: id, p_password: pw });
    if (!r || !r.ok) {
      err.textContent = r && r.error === 'LOCKED' ? '여러 번 틀려서 15분 동안 잠겼어요.' : message({ code: r && r.error });
      return;
    }
    let res;
    try { res = await rpc('kids_t_village_enter', { p_token: r.token }); }
    finally { rpc('kids_logout', { p_token: r.token }).catch(() => { /* 저절로 끝난다 */ }); }
    state.token = res.token;
    store.set('token', res.token);
    await loadMe();
    $('#tvPw').value = '';
    showTeacherLogin(false);
    state.welcomeFruits = !!res.new;
    afterLogin();
  } catch (e) {
    err.textContent = message(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '마을로 들어가기';
  }
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
  if (homeUI) homeUI.reset();
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
  if (!state.todayChecked) setTimeout(showQtNudge, 4500);
  state.todayChecked = true;
}

// ---------- 선생님 도장 알림 ----------
// 선생님이 선생님 화면에서 도장을 찍으면, 마을에 있는 아이 화면에 1분 안에 알린다 (40초마다 도장판을 다시 읽는다)
let boardRef = null, stampTimer = 0;
function startStampWatch() {
  clearInterval(stampTimer);
  stampTimer = setInterval(() => {
    if (!state.me || document.hidden || $('#hud').hidden) return;
    memory.load().catch(() => { /* 다음에 */ });
  }, 40000);
}
function checkStamps(vs) {
  const me = state.me && state.me.id;
  if (!me || !Array.isArray(vs)) return;
  const key = `kv.stamped.${me}`;
  const now = vs.filter((v) => v.passed).map((v) => v.id);
  let before = null;
  try { before = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { before = null; }
  try { localStorage.setItem(key, JSON.stringify(now)); } catch (e) { /* 이 기기에 남기지 못해도 괜찮다 */ }
  if (!Array.isArray(before)) return; // 이 기기에서 처음 읽은 것: 기억만 해 둔다
  const fresh = vs.filter((v) => v.passed && !before.includes(v.id));
  if (!fresh.length) return;
  confetti();
  sfx.success();
  village.celebrate();
  toast(fresh.length === 1
    ? `선생님이 ${fresh[0].ref} 말씀에 도장을 찍어 주셨어요! 열매 10개를 받았어요.`
    : `선생님이 말씀 ${fresh.length}개에 도장을 찍어 주셨어요! 열매 ${fresh.length * 10}개를 받았어요.`, 5200);
  refreshFruits();
}

// 놀이 마당: 그날 암송·묵상·필사 가운데 하나라도 마쳐야 열린다
const playOpen = () => !!(state.today && state.today.cleared);
const GAMES = {
  fish: () => play3d.fishing(), sea: () => play3d.seaFishing(), omok: () => play3d.omokMenu(), cook: () => play3d.cookMenu(), art: () => play3d.easel(),
  skip: () => play3d.skipping(), ark: () => play3d.arkMenu(),
  ferris: () => play3d.ride('ferris'), viking: () => play3d.ride('viking'), carousel: () => play3d.ride('carousel'), bumper: () => play3d.ride('bumper'), coaster: () => play3d.ride('coaster'),
  // 보드게임 섬 탁자 여섯 (문 이름 bg_fruit 등)
  ...Object.fromEntries(BG_IDS.map((id) => [bgKind(id), () => play3d.boardOpen(id)])),
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
  // 오른쪽 단추 줄: 세로면 오른쪽을, 낮은 가로 화면에서 가로로 놓였으면 위쪽을 비운다
  if (ctl && ctl.width > ctl.height) s.top = Math.max(s.top, ctl.bottom + 8);
  else if (ctl) s.right = Math.max(s.right, W - ctl.left + 8);
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
  // 달리기 단추: 누르면 켜지고 다시 누르면 꺼진다 (기기에 기억)
  const runBtn = $('#btnRun');
  const setRun = (on, say = false) => {
    village.setRunning(on);
    runBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    store.set('run', on ? '1' : '0');
    if (say) toast(on ? '달리기! 이제 빨리 달려요. 다시 누르면 걸어요.' : '이제 천천히 걸어요.', 1800);
  };
  setRun(store.get('run') === '1');
  runBtn.addEventListener('click', () => { setRun(!village.running, true); sfx.pop(); });
  runBtn.addEventListener('contextmenu', (e) => e.preventDefault());
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
// 놀이 마당을 여는 활동 (서버 kids_today의 opens). 묵상은 날마다, 암송과 필사는 한 주에 한 번이라
// 이번 주 암송·필사를 이미 했으면 그날 묵상을 해야 열린다. 옛 서버에는 opens가 없다.
function opensNow() {
  const t = state.today || {};
  return Array.isArray(t.opens) ? t.opens : null;
}
// '오늘 묵상을 마치면' 처럼 짧게 (알림 글에 붙인다)
function unlockHint() {
  const o = opensNow();
  if (!o) return '오늘 말씀 활동을 하나 마치면';
  if (o.includes('qt')) return '오늘 묵상을 마치면';
  return '오늘 암송 연습이나 필사를 하면';
}
function showLocked() {
  const go = (where) => { modal.close(); village.walkTo(where); };
  const o = opensNow();
  const btn = (label, where, primary) => h('button', { class: `btn ${primary ? 'btn-go' : 'btn-soft'}`, type: 'button', onclick: () => go(where) }, label);
  let big, lines, buttons;
  if (!o) {
    big = '말씀 활동을 하나 마치면 열려요!';
    lines = ['오늘 암송 연습, 오늘 묵상, 이번 주 필사 가운데 하나만 해도 돼요. 마치고 오면 낚시, 오목, 그림, 요리를 하고 놀이동산 놀이기구도 탈 수 있어요.'];
    buttons = [btn('암송의 집', 'memory'), btn('묵상의 숲', 'qt'), btn('필사 도서관', 'library')];
  } else if (o.includes('qt')) {
    big = '오늘 묵상을 하면 열려요!';
    lines = [`묵상은 날마다 하는 거예요. 오늘 묵상을 마치면 열매 ${REWARD.qt}개를 받고, 낚시, 오목, 그림, 요리와 놀이동산 놀이기구가 열려요.`];
    if (o.includes('memory') || o.includes('copy')) lines.push(`이번 주 ${o.includes('memory') && o.includes('copy') ? '암송이나 필사' : o.includes('memory') ? '암송' : '필사'}를 아직 안 했다면, 그걸 처음 하는 날에도 열려요.`);
    buttons = [btn('묵상의 숲으로', 'qt', true), o.includes('memory') ? btn('암송의 집', 'memory') : null, o.includes('copy') ? btn('필사 도서관', 'library') : null];
  } else {
    big = '오늘 말씀 활동을 하면 열려요!';
    lines = ['오늘은 묵상이 없는 날이에요. 암송 연습이나 필사를 하면 놀이 마당이 열려요.'];
    buttons = [o.includes('memory') ? btn('암송의 집', 'memory', true) : null, o.includes('copy') ? btn('필사 도서관', 'library') : null];
  }
  openSheet('놀이 마당', h('div', { class: 'talk' },
    h('p', { class: 'result-big' }, big),
    ...lines.map((l) => h('p', {}, l)),
    h('div', { class: 'row' }, ...buttons.filter(Boolean))), 'talk-sheet');
}

// 마을에 들어오면 오늘 묵상을 하자고 알려 준다 (오늘 묵상을 마칠 때까지, 들어올 때마다 한 번)
let qtCard = null;
function showQtNudge() {
  const t = state.today;
  if (!t || !t.qt || t.qt.done || qtCard || (state.me && state.me.teacher)) return;
  const streak = t.qt_streak || 0;
  const close = () => { if (qtCard === card) { card.remove(); qtCard = null; } };
  const lead = streak >= 2 ? `묵상 ${streak}일째 이어 가고 있어요! 오늘도 이어 가요.` : '오늘의 묵상이 기다리고 있어요.';
  const gate = opensNow() && !playOpen() ? ' 묵상을 마치면 놀이 마당이 열려요.' : '';
  const card = h('div', { class: 'invite-card dm-card qt-nudge', role: 'status' },
    h('div', { class: 'dm-ic', 'aria-hidden': 'true' }, '🌿'),
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, lead), ` '${t.qt.title}' 묵상을 하면 열매 ${REWARD.qt}개를 받아요.${gate}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '나중에'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); modal.close(); village.walkTo('qt'); } }, '묵상하러 가기'))));
  qtCard = card;
  document.body.append(card);
  setTimeout(close, 12000);
}

async function enterVillage(greet) {
  const me = state.me;
  // 이 아이의 쪽지와 오늘 할 일을 새로 (다른 아이로 다시 들어온 경우)
  state.dms = new Map();
  state.unread = 0;
  state.mailBox = [];
  state.todayChecked = false;
  village.setPlayer(me.avatar);
  village.setHome(me.village_name, normalizeAvatar(me.avatar));
  village.setMyName(me.village_name, me.teacher);
  showMyPets();
  village.setMode('play');
  village.viewChanged();
  rpc('kids_chat_open').then(showChatInput).catch(() => showChatInput(false));
  rpc('kids_features').then((f) => { state.features = f || {}; showNews(); checkFeedbackReply(); checkGifts(); loadMail(true); }).catch(() => { state.features = {}; });
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
  startStampWatch();
  refreshToday();
  refreshWall();
  refreshDishes();
  refreshShares();
  startNet();
  startMusic();
  setScene('village');
  startWeather();
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
  } else if (greet && me.teacher) {
    if (store.get('tv.new')) { state.welcomeFruits = true; store.del('tv.new'); }
    const call = /님$/.test(me.village_name) ? me.village_name : `${me.village_name} 선생님`; // '목사님'이면 그대로
    toast(state.welcomeFruits ? `숲지기 솔: ${call}, 어서 오세요! 선생님 열매 ${me.fruits}개를 드렸어요.`
      : `숲지기 솔: 어서 오세요, ${call}!`, state.welcomeFruits ? 4600 : 3200);
    state.welcomeFruits = false;
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
  {
    // 내 애완동물 이름 (마을 사람 목록에 함께 온다)
    const mine = state.people.get(state.me.id);
    if (mine) {
      const names = { ...(state.petNames || {}) };
      for (const q of personPets(mine)) if (myPets().includes(q.item)) names[q.item] = q.name || '';
      state.petNames = names;
      showMyPets();
    }
  }
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
      village.addRemote(id, p.avatar, p.name, p.teacher);
      village.setPets(id, personPets(p));
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
      if ((type === 'inv' || type === 'invr' || type === 'hinv') && p.to !== (state.me && state.me.id)) return;
      const person = await ensurePerson(id);
      if (!person || net !== n) return;
      if (!online.has(id)) { online.add(id); showCount(); village.addRemote(id, person.avatar, person.name, person.teacher); village.setPets(id, personPets(person)); }
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
      } else if (type === 'hm') {
        // 친구가 어느 집에 들어가고 나갔는지, 집 안 어디에 있는지
        const res = village.remoteHouse(id, p);
        const me = state.me && state.me.id;
        if (res && p.a && p.h && p.h === me && res.was !== p.h) {
          sfx.pop(true);
          toast(village.atHome && village.house === me ? `${josa(person.name, '이가', '가')} 우리 집에 놀러 왔어요!` : `${josa(person.name, '이가', '가')} 우리 집에 놀러 갔어요. '내 집'에 들어가면 만날 수 있어요!`, 3600);
        }
        if (p.u && homeUI.guest && homeUI.guest.id === id) homeUI.refreshGuest();
      } else if (type === 'hinv') {
        if (state.features.visit) showHomeInvite(id, person.name);
      } else if (type === 'gift') {
        // 친구가 선물을 보냈다는 신호: 실제 선물은 서버에서 확인해 받는다
        if (p.to === (state.me && state.me.id)) checkGifts(true);
      } else if (type === 'jp') {
        village.remoteJump(id);
      } else if (type === 'pc') {
        village.remotePetCare(id, p.k, p.i);
      } else if (type === 'dish') {
        dishAt = 0;
        refreshDishes();
        logLine(person.name, '🍽️ 마을 식탁에 요리를 올렸어요', false);
      } else if (type === 'share') {
        const mine = (village.shareList || []).find((d) => d.id === p.s && d.me);
        if (p.e && mine) { sfx.ding(); toast(`${josa(person.name, '이가', '가')} 내가 나눈 ${josa(HARVEST[mine.crop].name, '을', '를')} 먹었어요! 맛있대요.`, 3600); }
        if (!p.e) logLine(person.name, '🧺 나눔 수레에 밭에서 거둔 것을 올렸어요', false);
        shareAt = 0;
        refreshShares();
      } else if (type === 'art') {
        refreshWall();
        logLine(person.name, '🎨 전시관에 그림을 걸었어요', false);
      } else if (type === 'av') {
        try { await fetchPeople(true); } catch (e) { return; }
        const np = state.people.get(id);
        if (np) { village.addRemote(id, np.avatar, np.name, np.teacher); village.setPets(id, personPets(np)); }
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

let shareAt = 0;
async function refreshShares() {
  if (!state.features.farm || Date.now() - shareAt < 3000) return;
  shareAt = Date.now();
  try { village.setShareCart(await rpc('kids_share_table', { p_token: token() })); } catch (e) { /* 다음에 */ }
}

let wallAt = 0;
async function refreshWall() {
  if (Date.now() - wallAt < 3000) return;
  wallAt = Date.now();
  try { village.setArtWall(await rpc('kids_art_wall', { p_token: token() })); } catch (e) { /* 다음에 */ }
}

// ---------- 수영: 물에 들어가면 영법(자유형·배영·접영)을 고른다 ----------
const STROKE_LIST = [['free', '🏊', '자유형'], ['back', '🙃', '배영'], ['fly', '🦋', '접영']];
let stroke = 'free', swimming = false, strokeTold = false, lieTold = false;
try { const s0 = store.get('stroke'); if (STROKE_LIST.some(([k]) => k === s0)) stroke = s0; } catch (e) { /* 기본 자유형 */ }
let swimBar = null;
function strokeIdx() { return STROKE_LIST.findIndex(([k]) => k === stroke); }
function drawSwimBar() {
  if (!swimBar) {
    swimBar = h('div', { class: 'swim-bar', hidden: true, role: 'group', 'aria-label': '헤엄치는 방법 고르기' },
      ...STROKE_LIST.map(([k, ic, name]) => h('button', { type: 'button', 'data-k': k, onclick: () => pickStroke(k) }, h('span', { 'aria-hidden': 'true' }, ic), ` ${name}`)));
    document.body.append(swimBar);
  }
  for (const b of swimBar.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.k === stroke ? 'true' : 'false');
  swimBar.hidden = !swimming;
  document.body.classList.toggle('swimming', swimming); // 아래쪽 안내 글이 단추에 가리지 않게
}
function pickStroke(k) {
  if (k === stroke) return;
  stroke = k;
  try { store.set('stroke', k); } catch (e) { /* 저장 못 해도 이번에는 된다 */ }
  village.setStroke(k);
  sfx.pop();
  drawSwimBar();
  if (swimming) setActivity('swim', strokeIdx());
  const [, , name] = STROKE_LIST[strokeIdx()];
  toast(`${josa(name, '으로', '로')} 헤엄쳐요!`, 1800);
}
function onSwim(on) {
  swimming = on;
  village.setStroke(stroke);
  drawSwimBar();
  if (on) {
    setActivity('swim', strokeIdx());
    if (!strokeTold) { strokeTold = true; toast('아래 단추로 자유형, 배영, 접영을 골라 헤엄쳐 봐요!', 3000); }
  } else if (myAct === 'swim') setActivity('');
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
  if (!playOpen()) { toast(`${unlockHint()} 곤충을 잡을 수 있어요!`, 3000); return; }
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

// ---------- 모래사장 보물 캐기 ----------
let treasureBook = null;
async function loadTreasureBook() {
  try { treasureBook = await rpc('kids_treasure_book', { p_token: token() }); } catch (e) { if (e.code === 'SESSION') sessionLost(); treasureBook = treasureBook || { mine: {} }; }
  return treasureBook;
}
function onDig(i) {
  if (!state.features.beach) { toast('보물 캐기는 곧 열려요! 조금만 기다려 줘요.', 2600); return; }
  if (!playOpen()) { toast(`${unlockHint()} 보물을 캘 수 있어요!`, 3000); return; }
  village.startDig(i, async () => {
    try {
      const r = await rpc('kids_dig', { p_token: token() });
      village.digResult(r.item);
      if (treasureBook) treasureBook.mine[r.item] = r.count;
      setTimeout(() => showTreasureCard(r), 1500);
    } catch (e) {
      village.digResult(null);
      if (e.code === 'SESSION') { sessionLost(); return; }
      toast(message(e), 2800);
    }
  });
}
let treasureCard = null;
function showTreasureCard(r) {
  const t = treasureById(r.item) || { name: r.name, rarity: r.rarity, desc: '' };
  if (treasureCard) treasureCard.remove();
  const close = () => { if (treasureCard === card) { card.remove(); treasureCard = null; } };
  const ic = h('div', { class: 'bug-ic', 'aria-hidden': 'true' });
  ic.innerHTML = treasureIcon(r.item, 56);
  const kinds = TREASURES.filter((x) => x.rarity >= 0).length;
  let line;
  if (t.rarity < 0) line = '주워서 모래사장이 깨끗해졌어요!';
  else if (r.first) line = `처음 캤어요. 보물 도감에 올랐어요! (${r.kinds}/${kinds}가지)`;
  else line = `지금까지 ${r.count}개 캤어요.`;
  const note = r.item === 'bottle' ? h('p', { class: 'bottle-note' }, `편지를 펼쳐 봤어요. “${BOTTLE_NOTES[Math.floor(Math.random() * BOTTLE_NOTES.length)]}”`) : null;
  const card = h('div', { class: 'invite-card catch-card', role: 'status' }, ic,
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, `${josa(t.name, '을', '를')} ${t.rarity < 0 ? '주웠어요' : '캤어요'}!`), ' ', line),
      note,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '닫기'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); openBag(null, r.item); } }, '도감 보기'))));
  treasureCard = card;
  document.body.append(card);
  if (t.rarity >= 2) { confetti(); sfx.success(); } else if (t.rarity < 0) sfx.blub(); else sfx.fruit();
  setTimeout(close, note ? 9000 : 6500);
}

// ---------- 가방: 곤충 도감과 내 불꽃 ----------
let shopData = null;
async function loadShop() {
  try { shopData = await rpc('kids_shop', { p_token: token() }); if (shopData && Number.isFinite(shopData.fruits)) setFruits(shopData.fruits); if (shopData) setPetNames(shopData.pet_names); } catch (e) { if (e.code === 'SESSION') sessionLost(); }
  return shopData;
}
async function openBag(focusBug, focusTreasure) {
  const body = h('div', { class: 'talk bag' }, h('p', { class: 'fb-empty' }, '가방을 여는 중…'));
  openSheet('내 가방', body, 'bag-sheet');
  const [book, shop, tbook] = await Promise.all([state.features.bugs ? loadBugBook() : null, state.features.shop ? loadShop() : null,
    state.features.beach ? loadTreasureBook() : null]);
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
    else {
      if (state.features.pets3) pets.append(h('p', { class: 'note' }, `함께 다니는 친구 ${myPets().length}/${PET_MAX}마리 · 세 마리까지 데리고 다닐 수 있어요.`));
      pets.append(h('div', { class: 'shop-list' }, owned.map((id) => petRow(id, { owned: true, back: 'bag' }))));
    }
    secs.push(pets);
  }
  // 꾸미기 물건 (모자, 안경, 날개, 특별한 옷)
  if (state.features.wardrobe) {
    const items = (shop && shop.items) || {};
    const owned = WARDROBE_IDS.filter((id) => items[id] > 0);
    const sec = h('section', { class: 'bag-sec' }, h('h3', {}, '👗 꾸미기 물건'));
    if (!owned.length) sec.append(h('p', { class: 'note' }, '아직 없어요. 열매 상점의 꾸미기 칸에서 날개, 망토, 안경 같은 물건을 살 수 있어요.'));
    else sec.append(h('div', { class: 'bag-chips' }, owned.map((id) => h('span', { class: 'bag-chip' }, WARDROBE[id].name))));
    sec.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); openMaker(false); } }, '옷장 열기')));
    secs.push(sec);
  }
  // 수확 바구니 (밭에서 거둔 것)
  if (state.features.farm) {
    if (shop && shop.sell) setCrops(shop.sell.crops);
    const crops = state.crops || {};
    const have = CROP_IDS.filter((id) => crops[id] > 0);
    const sec = h('section', { class: 'bag-sec' }, h('h3', {}, '🥕 수확 바구니'));
    if (!have.length) sec.append(h('p', { class: 'note' }, '아직 거둔 것이 없어요. 내 집 밭에 씨앗을 심으면 며칠 뒤에 거둘 수 있어요.'));
    else sec.append(h('div', { class: 'bag-chips' }, have.map((id) => cropChip(id, crops[id]))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); openBasket(); } }, '나누기·팔기')));
    secs.push(sec);
  }
  // 팔 수 있는 물고기와 곤충
  if (state.features.sell && shop && shop.sell) {
    const nf = Object.values(shop.sell.fish || {}).reduce((a, n) => a + n, 0);
    const nb = Object.values(shop.sell.bugs || {}).reduce((a, n) => a + n, 0);
    const nt = Object.values(shop.sell.treasures || {}).reduce((a, n) => a + n, 0);
    const nc = Object.values(shop.sell.crops || {}).reduce((a, n) => a + n, 0);
    const what = [nf && `물고기 ${nf}마리`, nb && `곤충 ${nb}마리`, nt && `보물 ${nt}개`, nc && `거둔 채소·열매 ${nc}개`].filter(Boolean).join(', ');
    const sec = h('section', { class: 'bag-sec' }, h('h3', {}, '🧺 팔 수 있는 것'),
      h('p', { class: 'note' }, what ? `${what}가 가방에 있어요. 열매 상점에서 팔면 열매를 받아요. 흔한 물고기와 곤충은 10마리에 1개, 거둔 채소와 열매는 1~4개에 1개예요 (오늘 ${shop.sell.today || 0}/${shop.sell.cap || 0}개 받음).` : '팔 것이 없어요. 낚시하고, 곤충을 잡고, 보물을 캐고, 밭에서 거두면 열매 상점에서 팔 수 있어요.'));
    if (nf || nb || nt || nc) sec.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { shopTab = 'sell'; modal.close(); village.walkTo('shop'); } }, '열매 상점으로 가기')));
    secs.push(sec);
  }
  // 집 꾸미기 물건
  if (state.features.home) {
    const items = (shop && shop.items) || {};
    const owned = HOME_IDS.filter((id) => items[id] > 0);
    const sec = h('section', { class: 'bag-sec' }, h('h3', {}, '🏠 집 꾸미기 물건'));
    if (!owned.length) sec.append(h('p', { class: 'note' }, '아직 없어요. 열매 상점에서 가구와 씨앗을 사면 내 집을 꾸밀 수 있어요.'));
    else {
      sec.append(h('div', { class: 'bag-chips' }, owned.map((id) => h('span', { class: 'bag-chip' }, homeIcon(id), `${HOME_ITEMS[id].name} ${items[id]}개`))),
        h('p', { class: 'note' }, "내 집에 들어가서 '집 꾸미기'를 누르면 놓을 수 있어요."));
      if (!village.atHome) sec.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); village.walkTo('home'); } }, '내 집으로 가기')));
    }
    secs.push(sec);
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
  // 보물 도감
  if (state.features.beach) {
    const mine = (tbook && tbook.mine) || {};
    const list = TREASURES.filter((t) => t.rarity >= 0);
    const got = list.filter((t) => mine[t.id]).length;
    const detail = h('div', { class: 'bug-detail', hidden: true });
    const show = (t) => {
      const n = mine[t.id];
      detail.hidden = false;
      const ic = h('div', {});
      ic.innerHTML = n ? treasureIcon(t.id, 56) : treasureShadow(t.id, 56);
      detail.replaceChildren(ic, h('div', {},
        h('b', {}, n ? t.name : '아직 못 찾은 보물'),
        h('p', { class: 'note' }, `${TREASURE_RARITY[t.rarity]}${n ? ` · ${n}개 캠` : ''}`),
        h('p', {}, n ? t.desc : '수영장 섬 모래밭에서 반짝이는 곳을 파 봐요.')));
    };
    const grid = h('div', { class: 'bug-grid' }, list.map((t) => {
      const n = mine[t.id];
      const cell = h('button', { class: 'bug-cell' + (t.id === focusTreasure ? ' new' : ''), type: 'button', onclick: () => show(t) });
      cell.innerHTML = n ? treasureIcon(t.id, 48) : treasureShadow(t.id, 48);
      cell.append(h('b', {}, n ? t.name : '???'), h('small', {}, n ? `${n}개` : TREASURE_RARITY[t.rarity]));
      return cell;
    }));
    const tr = h('section', { class: 'bag-sec' }, h('h3', {}, `🏝️ 보물 도감 (${got}/${list.length})`),
      h('p', { class: 'note' }, `수영장 섬 모래밭에서 반짝이는 곳을 눌러 삽으로 파요. 반짝이는 곳은 40초마다 바뀌어요. 오늘 ${(tbook && tbook.today) || 0}번 팠어요 (하루 60번까지).`), grid, detail);
    if (focusTreasure) { const t = treasureById(focusTreasure); if (t && t.rarity >= 0) show(t); }
    if (focusTreasure) secs.unshift(tr); else secs.push(tr);
  }
  body.replaceChildren(...secs);
}
// 불꽃 한 줄 (상점과 가방에서 같이 쓴다)
function fwRow(id, count, { buy = false, launch = false, shop = null } = {}) {
  const f = FIREWORKS[id];
  const ic = h('div', { class: 'fw-ic', 'aria-hidden': 'true' });
  ic.innerHTML = fireworkIcon(id);
  const acts = h('div', { class: 'acts' });
  if (buy) acts.append(buyBtn(id, shop, '사기', () => buyFirework(id)));
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
  if (id === 'pet_parrot') return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6c-3 2-4 5-3 8" stroke="#3DBB5C" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="24" cy="26" r="15" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/><ellipse cx="24" cy="30" rx="10" ry="8" fill="#F6D55C"/><circle cx="17" cy="23" r="4" fill="#fff"/><circle cx="31" cy="23" r="4" fill="#fff"/><circle cx="17.5" cy="23.5" r="2" fill="#2E2A2A"/><circle cx="30.5" cy="23.5" r="2" fill="#2E2A2A"/><path d="M20 28q4-4 8 0q-1 7-4 8q-3-1-4-8z" fill="#F3E6C8" stroke="#5A3D2B" stroke-width="1.2"/></svg>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="28" r="14" fill="${c}" stroke="#5A3D2B" stroke-width="1.5"/><path d="M22 13c1-3 3-4 5-3" stroke="#5A3D2B" stroke-width="1.5" fill="none"/>${eye}<path d="M20 30h8l-4 4z" fill="#F49A4C"/></svg>`;
}
function petSound(kind) {
  if (kind === 'cat') sfx.meow(); else if (kind === 'rabbit') sfx.hop(); else if (kind === 'chick') sfx.peep(); else if (kind === 'parrot') sfx.squawk(); else sfx.bark();
}
// ---------- 내 애완동물: 세 마리까지 데리고 다닌다 ----------
const PET_MAX = 3;
const PET_GIFT_DAY = 3;
// state.me.pets: 데리고 다니는 동물 id 목록 (순서대로 내 왼쪽 뒤, 오른쪽 뒤, 가운데 뒤)
function myPets() {
  const m = state.me;
  if (!m) return [];
  if (Array.isArray(m.pets)) return m.pets.map((q) => (typeof q === 'string' ? q : q && q.item)).filter((it) => it && PET_ITEMS[it]);
  return m.pet && PET_ITEMS[m.pet] ? [m.pet] : [];
}
// 서버가 준 목록(from.pets: [{item, name}])을 state.me에 (예전 서버는 pet 한 마리만 준다)
function takeMyPets(m, from = m) {
  if (!m || !from) return;
  if (Array.isArray(from.pets)) {
    const names = { ...(state.petNames || {}) };
    const list = [];
    for (const q of from.pets) {
      const it = q && (typeof q === 'string' ? q : q.item);
      if (!it || !PET_ITEMS[it] || list.includes(it)) continue;
      list.push(it);
      if (typeof q === 'object' && 'name' in q) names[it] = q.name || '';
    }
    state.petNames = names;
    m.pets = list;
  } else m.pets = from.pet && PET_ITEMS[from.pet] ? [from.pet] : [];
  m.pet = m.pets[0] || null;
}
function showMyPets() { village.setPets('me', myPets().map((item) => ({ item, name: petName(item) }))); }
// 친구가 데리고 다니는 동물 [{item, name}] (예전 서버는 pet, pet_name 한 마리)
function personPets(p) {
  if (!p) return [];
  if (Array.isArray(p.pets)) return p.pets.filter((q) => q && PET_ITEMS[q.item]);
  return p.pet && PET_ITEMS[p.pet] ? [{ item: p.pet, name: p.pet_name || '' }] : [];
}
function petCall(it) { return petName(it) || (PET_ITEMS[it] ? PET_ITEMS[it].name : '애완동물'); }
function petSellPrice(id) { return Math.floor(((PET_ITEMS[id] && PET_ITEMS[id].price) || 30) / 2); }

// ---------- 내 애완동물 돌보기: 누르면 아래에 '안아 주기', '먹이 주기' 단추가 잠깐 나온다 ----------
let petBar = null, petBarTimer = 0;
function showPetBar(item) {
  const list = myPets();
  const it = item && list.includes(item) ? item : list[0];
  if (!it || !PET_ITEMS[it]) return;
  const food = PET_FOOD[PET_ITEMS[it].kind];
  if (!petBar) {
    petBar = h('div', { class: 'pet-bar', hidden: true, role: 'group', 'aria-label': '애완동물 돌보기' });
    document.body.append(petBar);
  }
  petBar.replaceChildren(
    h('span', { class: 'pb-name' }, petCall(it)),
    h('button', { type: 'button', onclick: () => doPetCare('hug', it) }, h('span', { 'aria-hidden': 'true' }, '🤗'), ' 안아 주기'),
    h('button', { type: 'button', onclick: () => doPetCare('feed', it) }, h('span', { 'aria-hidden': 'true' }, food.icon), ' 먹이 주기'),
    h('button', { type: 'button', class: 'pb-x', 'aria-label': '닫기', onclick: hidePetBar }, '×'));
  petBar.hidden = false;
  document.body.classList.add('pet-bar-on');
  clearTimeout(petBarTimer);
  petBarTimer = setTimeout(hidePetBar, 7000);
}
function hidePetBar() {
  clearTimeout(petBarTimer);
  if (petBar) petBar.hidden = true;
  document.body.classList.remove('pet-bar-on');
}
function doPetCare(what, item) {
  hidePetBar();
  const r = village.careForPet(what, item);
  if (r === 'ok') { if (net) net.send('pc', { k: what, i: item }); return; }
  if (r === 'pool') toast('물 밖으로 나와서 돌봐 줄 수 있어요.', 2400);
  else if (r === 'busy') toast('지금 하던 일을 마치고 다시 해 봐요.', 2400);
  else toast("데리고 다니는 애완동물이 없어요. 가방의 '우리 집 친구'에서 데리고 다닐 수 있어요.", 3200);
}
// 돌보는 동안 소리와 알림 (내 애완동물만)
function onPetCare(e) {
  if (!e.mine) return;
  if (e.phase === 'hug') petSound(e.kind);
  else if (e.phase === 'eat') sfx.pop();
  else if (e.phase === 'bite') sfx.munch();
  else if (e.phase === 'done') {
    sfx.success();
    const name = petCall(e.item);
    if (e.what === 'hug') toast(`${josa(name, '을', '를')} 꼭 안아 줬어요! ${e.kind === 'dog' ? '좋아서 꼬리를 흔들어요.' : '무척 좋아해요.'}`, 2600);
    else toast(`${josa(name, '이', '가')} ${josa(PET_FOOD[e.kind].name, '을', '를')} 맛있게 먹었어요!`, 2600);
  }
}

// 아이가 지어 준 애완동물 이름
function petName(id) { return (id && state.petNames && state.petNames[id]) || ''; }
function setPetNames(names) {
  if (names && typeof names === 'object') state.petNames = { ...names };
}
const PET_NAME_IDEAS = {
  dog: ['초코', '보리', '콩이', '뭉치', '두부', '복실이'],
  cat: ['나비', '치즈', '구름이', '까망이', '모모', '루루'],
  rabbit: ['솜이', '하양이', '당근이', '토리', '방울이', '꼬미'],
  chick: ['삐약이', '노랑이', '병돌이', '콩알이', '햇살이', '꼬꼬'],
  parrot: ['초록이', '알록이', '깃털이', '말랑이', '피코', '수다쟁이'],
};
const PET_NAME_OK = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]{1,8}$/;
// 이름 짓기 (데려온 뒤 바로, 또는 가방·상점의 '이름 짓기')
function openPetName(id, fresh = false) {
  const p = PET_ITEMS[id];
  if (!p) return;
  const cur = petName(id);
  const input = h('input', { class: 'pn-input', type: 'text', maxlength: 8, value: cur, placeholder: `예: ${PET_NAME_IDEAS[p.kind][0]}`, 'aria-label': `${p.name} 이름`, autocomplete: 'off' });
  const err = h('p', { class: 'pn-err', role: 'alert' });
  const ic = h('div', { class: 'fw-ic pet big', 'aria-hidden': 'true' });
  ic.innerHTML = petIcon(id);
  let busy = false;
  const save = async (name) => {
    if (busy) return;
    const v = String(name).replace(/\s+/g, ' ').trim();
    if (v && !PET_NAME_OK.test(v)) { err.textContent = message({ code: 'BAD_PET_NAME' }); return; }
    busy = true;
    try {
      const r = await rpc('kids_pet_name', { p_token: token(), p_pet: id, p_name: v });
      setPetNames(r.pet_names);
      if (shopData) shopData.pet_names = r.pet_names;
      if (myPets().includes(id)) { showMyPets(); if (net) net.send('av', {}); }
      modal.close();
      petSound(p.kind);
      if (v) {
        const call = /[가-힣]$/.test(v) ? josa(v, '아', '야') : v;
        village.say('me', `${call}, 안녕!`);
        toast(`${p.name} 이름은 이제 '${josa(v, "'이에요", "'예요")}!`, 3000);
      }
      else toast('이름을 지웠어요. 다음에 다시 지어 줘요.', 2400);
    } catch (e) {
      if (e.code === 'SESSION') { sessionLost(); return; }
      err.textContent = message(e);
    } finally { busy = false; }
  };
  const ideas = h('div', { class: 'pn-ideas' }, PET_NAME_IDEAS[p.kind].map((n) => h('button', { class: 'pn-idea', type: 'button', onclick: () => { input.value = n; err.textContent = ''; input.focus(); } }, n)));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(input.value); });
  input.addEventListener('input', () => { err.textContent = ''; });
  openSheet(fresh ? '새 친구 이름 짓기' : `${p.name} 이름 짓기`, h('div', { class: 'talk pet-name' },
    h('div', { class: 'pn-head' }, ic, h('p', {}, fresh ? `${josa(p.name, '이가', '가')} 우리 집 친구가 되었어요! 이름을 지어 줄까요?` : '새 이름을 지어 줘요. 친구들에게도 이름표가 보여요.')),
    input, err,
    h('p', { class: 'note' }, '한글, 영어, 숫자로 8글자까지 지을 수 있어요. 아래 이름을 눌러 골라도 돼요.'),
    ideas,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-plain', type: 'button', onclick: () => modal.close() }, fresh ? '나중에 지을게요' : '닫기'),
      h('button', { class: 'btn btn-go', type: 'button', onclick: () => save(input.value) }, '이 이름으로 하기'))), 'talk-sheet');
  setTimeout(() => { try { input.focus(); } catch (e) { /* 괜찮다 */ } }, 250);
}
// back: 팔기·선물 뒤에 돌아갈 곳 ('bag' 가방, 'shop' 상점 동물 칸)
function petRow(id, { owned, buy = false, shop = null, back = null }) {
  const p = PET_ITEMS[id];
  const ic = h('div', { class: 'fw-ic pet', 'aria-hidden': 'true' });
  ic.innerHTML = petIcon(id);
  const acts = h('div', { class: 'acts' });
  const multi = !!state.features.pets3;
  const withMe = myPets().includes(id);
  if (!owned && buy) acts.append(buyBtn(id, shop, '데려오기', () => buyPet(id)));
  if (owned) acts.append(withMe
    ? h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => togglePet(id, false) }, '집에서 쉬게 하기')
    : h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => togglePet(id, true) }, '데리고 다니기'));
  if (owned && state.features.petname) acts.append(h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => openPetName(id) }, petName(id) ? '이름 바꾸기' : '이름 짓기'));
  if (owned && multi) acts.append(
    h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => openPetGift(id, back) }, '🎁 선물하기'),
    h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => askSellPet(id, back) }, `팔기 (열매 ${petSellPrice(id)}개)`));
  if (acts.childElementCount >= 3) acts.classList.add('many');
  const nm = owned ? petName(id) : '';
  return h('div', { class: 'shop-item' + (withMe ? ' with-me' : '') }, ic,
    h('div', {}, h('b', {}, nm ? `${nm} ` : '', nm ? h('small', { class: 'pet-kind' }, p.name) : p.name), h('p', {}, p.desc),
      h('p', {}, owned ? (withMe ? '지금 나와 함께 다녀요' : multi ? '우리 집에서 쉬고 있어요' : '우리 집 친구예요') : '')), acts);
}
// 팔기·선물을 마친 뒤 (또는 그만두면) 원래 보던 창으로
function petBack(back) {
  if (back === 'bag') openBag();
  else if (back === 'shop' || back === 'sell') openShop(back === 'sell' ? 'sell' : 'pet');
  else modal.close();
}
function redrawPetViews() {
  const body = document.querySelector('#modalBody .talk.shop');
  if (body && shopData) drawShop(body, shopData);
  const bag = document.querySelector('#modalBody .talk.bag');
  if (bag) openBag();
}
let petBusy = false;
async function buyPet(id) {
  if (petBusy) return;
  petBusy = true;
  try {
    const r = await rpc('kids_shop_buy', { p_token: token(), p_item: id, p_n: 1 });
    shopData = r;
    setFruits(r.fruits);
    setPetNames(r.pet_names);
    sfx.success();
    petBusy = false;
    let home = false;
    if (state.features.pets3) {
      // 함께 다니는 동물이 세 마리보다 적으면 바로 따라다닌다
      if (myPets().length < PET_MAX) await togglePet(id, true, true);
      else { home = true; redrawPetViews(); }
    } else await choosePet(id, true);
    const homeNote = home ? ` 지금은 세 마리가 함께 다녀서 새 친구는 집에서 기다려요.` : '';
    // 데려오자마자 이름을 지어 준다
    if (state.features.petname) { openPetName(id, true); if (home) toast(homeNote.trim(), 3600); }
    else toast(`${josa(PET_ITEMS[id].name, '이가', '가')} 우리 집 친구가 되었어요!${home ? homeNote : ' 이제 졸졸 따라다녀요.'}`, 3400);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { petBusy = false; }
}
// 데리고 다니기 켜고 끄기 (세 마리까지). 서버가 예전 것이면 한 마리만
async function togglePet(id, on, fresh = false) {
  if (!state.features.pets3) return choosePet(on ? id : null, fresh);
  if (petBusy) return;
  const cur = myPets();
  if (on && cur.includes(id)) return;
  if (on && cur.length >= PET_MAX) { toast(`애완동물은 세 마리까지 함께 다녀요. 한 마리를 집에서 쉬게 하고 데려가요.`, 3400); return; }
  const list = on ? [...cur, id] : cur.filter((x) => x !== id);
  petBusy = true;
  try {
    const r = await rpc('kids_pets_set', { p_token: token(), p_pets: list });
    takeMyPets(state.me, r);
    if (shopData) { shopData.pet = state.me.pet; shopData.pets = r.pets; }
    showMyPets();
    if (net) net.send('av', {});
    const p = PET_ITEMS[id], nm = petCall(id);
    if (on) { petSound(p.kind); if (!fresh) toast(`${josa(nm, '이랑', '랑')} 함께 다녀요! (함께 다니는 친구 ${myPets().length}/${PET_MAX})`, 3000); }
    else toast(`${josa(nm, '이', '가')} 집에서 쉬고 있어요.`, 2400);
    redrawPetViews();
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
    state.me.pets = id ? [id] : [];
    showMyPets();
    if (net) net.send('av', {});
    if (id) {
      const p = PET_ITEMS[id];
      petSound(p.kind);
      const nm = petName(id);
      if (!fresh) toast(nm ? `${josa(nm, '이랑', '랑')} 함께 다녀요!` : `${josa(p.name, '이랑', '랑')} 함께 다녀요!`, 3000);
    } else toast('애완동물이 집에서 쉬고 있어요.', 2400);
    redrawPetViews();
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { petBusy = false; }
}
// 가게에 다시 팔기: 데려올 때 값의 반
function askSellPet(id, back) {
  const p = PET_ITEMS[id];
  if (!p || !state.features.pets3) return;
  const nm = petCall(id), got = petSellPrice(id);
  const ic = h('div', { class: 'fw-ic pet big', 'aria-hidden': 'true' });
  ic.innerHTML = petIcon(id);
  openSheet('애완동물 팔기', h('div', { class: 'talk pet-name' },
    h('div', { class: 'pn-head' }, ic, h('p', {}, `${josa(nm, '을', '를')} 열매 상점에 팔고 열매 ${got}개를 받을까요?`)),
    h('p', { class: 'note' }, `데려올 때 값(열매 ${p.price}개)의 반을 받아요. 다시 데려오려면 열매 ${p.price}개가 들어요.${petName(id) ? ' 지어 준 이름도 함께 지워져요.' : ''}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-plain', type: 'button', onclick: () => petBack(back) }, '아니요, 함께 지낼래요'),
      h('button', { class: 'btn btn-go', type: 'button', onclick: () => sellPet(id, back) }, `열매 ${got}개 받고 팔기`))), 'talk-sheet');
}
async function sellPet(id, back) {
  if (petBusy) return;
  petBusy = true;
  const nm = petCall(id);
  try {
    const r = await rpc('kids_pet_sell', { p_token: token(), p_pet: id });
    shopData = r;
    setFruits(r.fruits);
    setPetNames(r.pet_names);
    takeMyPets(state.me, r);
    showMyPets();
    if (net) net.send('av', {});
    sfx.fruit();
    toast(`${josa(nm, '을', '를')} 팔고 열매 ${Number.isFinite(r.got) ? r.got : petSellPrice(id)}개를 받았어요.`, 3000);
    petBusy = false;
    petBack(back);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { petBusy = false; }
}
// 친구에게 애완동물 선물하기: 친구 고르기, 한마디
function openPetGift(id, back) {
  const pt = PET_ITEMS[id];
  if (!pt || !state.features.pets3) return;
  const nm = petCall(id);
  const shop = shopData || {};
  const left = Number.isFinite(shop.pet_gift_left) ? shop.pet_gift_left : PET_GIFT_DAY;
  const me = state.me && state.me.id;
  const people = [...state.people.values()].filter((q) => q.id !== me && q.name)
    .sort((a, b) => (online.has(b.id) - online.has(a.id)) || a.name.localeCompare(b.name, 'ko'));
  let to = null, msg = 'best';
  const sum = h('p', { class: 'gift-sum' });
  const send = h('button', { class: 'btn btn-go', type: 'button', onclick: () => sendPetGift(id, to, msg, back) });
  const msgs = h('div', { class: 'gift-msgs', role: 'group', 'aria-label': '함께 보낼 말' });
  const btns = people.map((q) => {
    const has = personPets(q).some((x) => x.item === id); // 친구가 데리고 다니는 동물만 미리 안다 (나머지는 서버가 확인)
    const cv = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
    drawFaceIcon(cv, normalizeAvatar(q.avatar));
    const b = h('button', { class: 'gift-person', type: 'button', 'aria-pressed': 'false', disabled: has || !left, onclick: () => { to = q.id; draw(); } },
      cv, h('b', {}, q.name, tBadge(q)), has ? h('small', {}, `${josa(pt.name, '이', '가')} 벌써 있어요`) : online.has(q.id) ? h('small', {}, '지금 마을에 있어요') : null);
    b.dataset.id = q.id;
    return b;
  });
  const draw = () => {
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.id === to));
    msgs.replaceChildren(...Object.entries(GIFT_MSGS).map(([k, t]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(msg === k),
      onclick: () => { msg = k; draw(); } }, t)));
    const tp = to && state.people.get(to);
    sum.textContent = tp ? `${tp.name}에게 ${josa(nm, '과', '와')} "${GIFT_MSGS[msg]}"를 보내요.` : '선물할 친구를 골라요.';
    send.textContent = `🎁 ${josa(nm, '을', '를')} 선물하기`;
    send.disabled = !tp || !left;
  };
  draw();
  const ic = h('div', { class: 'fw-ic pet big', 'aria-hidden': 'true' });
  ic.innerHTML = petIcon(id);
  openSheet('애완동물 선물하기', h('div', { class: 'talk gift pet-gift' },
    h('div', { class: 'pn-head' }, ic, h('p', {}, `${josa(nm, '을', '를')} 친구에게 보내요. 보내면 친구네 집 친구가 돼요.${petName(id) ? ' 지어 준 이름도 함께 가요.' : ''}`)),
    h('p', { class: 'note' }, left ? `동물 선물은 하루에 세 번까지 할 수 있어요. 오늘은 ${left}번 더 할 수 있어요.` : '오늘은 동물 선물을 다 했어요. 내일 또 할 수 있어요.'),
    h('h4', {}, '누구에게 보낼까요?'),
    people.length ? h('div', { class: 'gift-people' }, btns) : h('p', { class: 'fb-empty' }, '아직 마을 친구가 없어요.'),
    h('h4', {}, '함께 보낼 말'), msgs, sum,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => petBack(back) }, '다음에'), send)), 'talk-sheet');
}
async function sendPetGift(id, to, msg, back) {
  if (gifting || !to) return;
  gifting = true;
  const nm = petCall(id);
  const tp = state.people.get(to) || { name: '친구' };
  try {
    const r = await rpc('kids_pet_gift', { p_token: token(), p_to: to, p_pet: id, p_msg: msg });
    shopData = r;
    setFruits(r.fruits);
    setPetNames(r.pet_names);
    takeMyPets(state.me, r);
    showMyPets();
    if (net) { net.send('av', {}); net.send('gift', { to, n: 0, m: msg, p: id }); }
    sfx.success();
    confetti();
    village.celebrate();
    toast(`${tp.name}에게 ${josa(nm, '을', '를')} 선물했어요! "${GIFT_MSGS[msg]}"`, 3400);
    gifting = false;
    petBack(back);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3400);
  } finally { gifting = false; }
}

// 새로 생긴 일을 한 번씩 알려 준다 (기기마다 한 번)
function showNews() {
  const news = [];
  if (state.features.photo10) news.push(['photo10', '새 소식! 필사 이야기를 공책에 손으로 써서 사진을 올리면 열매 10개를 받아요.']);
  if (state.features.pets) news.push(['pets', '새 소식! 열매 상점에 애완동물이 왔어요. 열매 30개로 데려오면 졸졸 따라다녀요.']);
  if (state.features.home) news.push(['home', "새 소식! 이제 내 집을 꾸밀 수 있어요. 열매 상점에서 가구와 씨앗을 사서 '내 집'에 들어가 방과 마당, 밭을 꾸며 봐요."]);
  if (state.features.feedback) news.push(['feedback', '새 소식! 숲지기 솔 옆에 마을 건의함이 생겼어요. 마을에 바라는 것을 적어 주세요.']);
  news.push(['run', "새 소식! '달리기' 단추를 누르면 빨리 달려요(컴퓨터는 Shift 키). 내 집 침대에 누울 수도 있어요."]);
  if (state.features.wardrobe) news.push(['wardrobe', "새 소식! 열매 상점에 천사 날개, 망토, 안경 같은 꾸미기 물건이 왔어요. '꾸미기'(옷장)에는 잠옷도 생겼어요."]);
  if (state.features.gift) news.push(['gift', '새 소식! 친구에게 열매를 선물할 수 있어요. 열매 상점의 선물 칸이나 친구 목록에서 보내요.']);
  if (state.features.sell) news.push(['sell2', '새 소식! 잡은 물고기와 곤충을 열매 상점에서 팔 수 있어요. 흔한 것은 10마리에 열매 1개예요.']);
  if (state.features.mail) news.push(['mail', "새 소식! 마을에 없는 친구에게도 쪽지를 보낼 수 있어요. 위쪽 친구 단추를 눌러 '쪽지함'을 열어요."]);
  if (state.features.qtgate) news.push(['qtgate', `새 소식! 묵상은 날마다 하는 거예요. 오늘 묵상을 마치면 열매 ${REWARD.qt}개를 받고 놀이 마당이 열려요(이번 주 암송·필사를 처음 하는 날에도 열려요). 필사는 열매 ${REWARD.copy}개, 공책 사진을 올리면 모두 ${REWARD.photo}개예요.`]);
  if (state.features.visit) news.push(['visit', "새 소식! 친구 집에 놀러 갈 수 있어요. 친구 목록에서 '집에 놀러 가기'를 누르거나, 내 집에서 '친구 부르기'로 친구를 불러요."]);
  if (state.features.sea) news.push(['sea', '새 소식! 마을 남동쪽 바닷가에 바다 낚시 나루터가 생겼어요. 배를 타고 나가 바다 물고기를 낚아 봐요.']);
  if (state.features.sea) news.push(['searow', '새 소식! 바다 낚시 배를 마음대로 저어 갈 수 있어요. 갈매기가 맴도는 물고기 떼 가까이에서 낚시하면 물고기가 금방 모여요.']);
  if (state.features.beach) news.push(['beach', '새 소식! 수영장 섬 모래밭이 반짝이면 눌러 보세요. 삽으로 파서 조개, 진주, 보물 상자를 찾아요.']);
  if (state.features.skip) news.push(['skip', '새 소식! 수영장 섬 동쪽에 물수제비 터가 생겼어요. 오늘의 물수제비 왕에 도전해 봐요.']);
  if (state.features.ark) news.push(['ark', '새 소식! 수영장 섬 북쪽 노아의 방주에서 동물 짝 맞추기를 해요. 혼자 해도 되고, 친구와 겨뤄도 돼요.']);
  if (state.features.sea) news.push(['seafight', '새 소식! 바다 낚시가 1인칭이 되었어요. 물고기가 물면 바늘이 초록 칸에 올 때 ‘감기!’를 눌러 끌어와요. 줄이 팽팽하면 ‘줄 풀기’를 눌러요.']);
  if (state.features.farm) news.push(['farm2', "새 소식! 밭의 채소와 열매는 며칠에 걸쳐 자라요. 거둔 것은 수확 바구니에 모였다가, 마을 식탁 옆 '나눔 수레'에서 친구들과 나눠 먹거나 열매 상점에서 팔 수 있어요."]);
  news.push(['npc', '새 소식! 섬마다 마을 친구가 살아요(마을 섬 봄이, 놀이동산 섬 튼튼이, 수영장 섬 노을이). 눌러서 하이파이브, 가위바위보를 하고 간식도 나눠 먹어 봐요.']);
  if (state.features.arkboard) news.push(['arkboard', '새 소식! 노아의 방주 짝 맞추기에 이번 주 기록판이 생겼어요. 혼자 하기를 빨리 마치면 난이도마다 10위까지 이름이 올라가요.']);
  if (state.features.pets) news.push(['petcare', '새 소식! 데리고 다니는 애완동물을 누르면 안아 주거나 먹이를 줄 수 있어요.']);
  if (state.features.pets3) news.push(['pets3', "새 소식! 애완동물을 세 마리까지 데리고 다닐 수 있어요. 가방의 '우리 집 친구'에서 열매 15개(반값)에 다시 팔거나 친구에게 선물할 수도 있어요."]);
  if (state.features.petname) news.push(['petname', '새 소식! 애완동물에게 이름을 지어 줄 수 있어요(가방에서). 내 말을 따라 하는 앵무새도 열매 상점에 왔어요.']);
  news.push(['weather', "새 소식! 마을 날씨가 대구의 지금 날씨를 따라 바뀌어요. 대구에 비가 오면 마을에도 비가, 눈이 오면 눈이 내려요. 위쪽 열매 옆의 날씨를 누르면 자세히 볼 수 있어요."]);
  news.push(['boardisle', '새 소식! 마을 서쪽 다리를 건너면 보드게임 섬이 있어요. 과일 종 치기, 77 피하기, 숫자 암호, 만칼라, 윷놀이, 땅따먹기를 숲지기 솔이나 친구와 1:1로 해 봐요.']);
  news.push(['clothes2', "새 소식! 옷장('꾸미기')에 옷이 많이 늘었어요. 이제 상의와 하의를 따로 골라 입어요. 치마, 반바지, 청바지, 한복 저고리와 한복 치마, 패딩, 야구 점퍼도 있어요."]);
  news.unshift(['guide', "새 소식! 오른쪽 '마을 지도' 단추를 누르면 어디에 무엇이 있고 무엇을 할 수 있는지 볼 수 있어요. 가고 싶은 곳을 고르면 그곳까지 걸어가요."]);
  // 이 기기로 처음 들어왔으면 지난 소식을 한꺼번에 띄우지 않고 마을 지도만 알려 준다
  let firstHere = false;
  try { firstHere = !Object.keys(localStorage).some((k) => k.startsWith('kv.news.')); } catch (e) { firstHere = false; }
  if (firstHere) {
    notice("어서 와요! 오른쪽 '마을 지도'를 누르면 어디에 무엇이 있고 무엇을 할 수 있는지 볼 수 있어요.", 6000, () => {
      try { for (const [k] of news) localStorage.setItem(`kv.news.${k}`, '1'); } catch (e) { /* 다음에 또 */ }
    });
    return;
  }
  const fresh = news.filter(([k]) => { try { return !localStorage.getItem(`kv.news.${k}`); } catch (e) { return false; } });
  fresh.forEach(([k, text]) => notice(text, 5200, () => { try { localStorage.setItem(`kv.news.${k}`, '1'); } catch (e) { /* 다음에 또 */ } }));
}
// 알림을 하나씩 차례로 띄운다 (마을에 들어오고 조금 뒤부터)
const notices = [];
let noticeOn = false;
function notice(text, ms = 5200, done = null) {
  notices.push([text, ms, done]);
  if (!noticeOn) { noticeOn = true; setTimeout(nextNotice, 2500); }
}
function nextNotice() {
  const n = notices.shift();
  if (!n || !state.me) { noticeOn = false; notices.length = 0; return; }
  toast(n[0], n[1]);
  if (n[2]) n[2]();
  setTimeout(nextNotice, n[1] + 600);
}

// ---------- 열매 상점 ----------
let shopTab = 'fw';
async function openShop(t) {
  if (t && SHOP_TABS.includes(t)) shopTab = t;
  const body = h('div', { class: 'talk shop' }, h('p', { class: 'fb-empty' }, '상점을 여는 중…'));
  openSheet('열매 상점', body, 'shop-sheet');
  const shop = await loadShop();
  if (!modal.isOpen) return;
  drawShop(body, shop);
}
const SHOP_TABS = ['fw', 'pet', 'wear', 'room', 'yard', 'garden', 'sell', 'gift'];
const SHOP_NOTE = {
  fw: '산 불꽃은 가방에 들어가고, 마을 어디서나 터트릴 수 있어요. 친구들 하늘에도 같이 터져요.',
  pet: '애완동물은 한 번 데려오면 계속 우리 집 친구예요. 한 번에 한 마리가 나를 따라다녀요.',
  wear: "한 번 사면 계속 내 것이에요. 여기서 바로 써 보거나, 화면 아래 '꾸미기'(옷장)에서 다른 옷과 함께 골라요. 옷장에서는 사기 전에 입어 볼 수도 있어요.",
  room: "방에 놓는 가구예요. 내 집에 들어가서 '집 꾸미기'를 누르면 놓을 수 있어요. 산 가구는 없어지지 않아요.",
  yard: "마당에 놓는 물건이에요. 내 집에 들어가서 '집 꾸미기'를 누르면 놓을 수 있어요. 산 물건은 없어지지 않아요.",
  garden: '씨앗과 모종은 밭 한 칸에 하나씩 심어요. 다 자란 채소를 거두면 그 씨앗은 없어지고, 꽃은 다 피면 계속 피어 있어요.',
  sell: '잡은 물고기와 곤충은 같은 것끼리 모아서 팔아요. 흔한 것은 10마리, 가끔 보이는 것은 5마리, 드문 것은 2마리, 아주 드문 것은 1마리에 열매 1개예요. 팔아도 도감 기록은 그대로 남아요. 쓰레기(낡은 장화, 빈 깡통 같은 것)는 팔 수 없어요.',
  gift: '모은 열매를 친구에게 선물해요. 한 번에 1~10개, 하루에 모두 열매 10개까지 보낼 수 있어요. 선생님도 선물 기록을 볼 수 있어요.',
};
const PET_NOTE3 = `애완동물은 한 번 데려오면 계속 우리 집 친구예요. 세 마리까지 함께 다닐 수 있어요. 다시 팔면 데려올 때 값의 반(열매 15개)을 받고, 친구에게 선물할 수도 있어요.`;
// 원래 값과 지금 값 (선생님이 할인을 켜면 지금 값이 싸다)
function basePrice(id) { return (FIREWORKS[id] || PET_ITEMS[id] || HOME_ITEMS[id] || WARDROBE[id] || {}).price || 0; }
function priceOf(id, shop) { const p = shop && shop.prices && shop.prices[id]; return Number.isFinite(p) ? p : basePrice(id); }
function buyBtn(id, shop, verb, onclick) {
  const p = priceOf(id, shop), b = basePrice(id);
  return h('button', { class: 'btn btn-go btn-small', type: 'button', disabled: (shop ? shop.fruits : 0) < p, onclick },
    p < b ? h('s', { class: 'was' }, String(b)) : null, `열매 ${p}개로 ${verb}`);
}
function drawShop(body, shop) {
  if (!shop) { body.replaceChildren(h('p', { class: 'note' }, '상점을 열지 못했어요. 잠시 뒤에 다시 와 주세요.')); return; }
  const items = shop.items || {};
  const f = state.features;
  const tabsDef = [['fw', '🎆 불꽃'], f.pets && ['pet', '🐾 동물'], f.wardrobe && ['wear', '👗 꾸미기'],
    f.home && ['room', '🛏️ 방'], f.home && ['yard', '🌳 마당'], f.home && ['garden', '🥕 밭'],
    f.sell && shop.sell && ['sell', '🧺 팔기'], f.gift && ['gift', '🎁 선물']].filter(Boolean);
  if (!tabsDef.some(([k]) => k === shopTab)) shopTab = 'fw';
  const tabs = tabsDef.length > 1 ? h('div', { class: 'shop-tabs', role: 'tablist' }, tabsDef.map(([k, label]) => h('button', {
    class: 'shop-tab', role: 'tab', type: 'button', 'aria-selected': String(shopTab === k), onclick: () => { shopTab = k; drawShop(body, shop); },
  }, label))) : null;
  let rows;
  if (shopTab === 'fw') rows = FW_IDS.map((id) => fwRow(id, items[id] || 0, { buy: true, launch: true, shop }));
  else if (shopTab === 'pet') rows = PET_IDS.map((id) => petRow(id, { owned: items[id] > 0, buy: true, shop, back: 'shop' }));
  else if (shopTab === 'wear') rows = WARDROBE_IDS.map((id) => wearRow(id, shop));
  else if (shopTab === 'sell') rows = sellRows(shop);
  else if (shopTab === 'gift') rows = giftRows(shop);
  else rows = HOME_IDS.filter((id) => HOME_ITEMS[id].zone === shopTab).map((id) => homeRow(id, items[id] || 0, shop));
  const sale = shop.sale > 0 && !['sell', 'gift'].includes(shopTab) ? h('p', { class: 'shop-sale' }, `🎉 지금 선생님이 모든 물건을 ${shop.sale}% 할인해 주고 있어요!`) : null;
  body.replaceChildren(...[
    h('p', { class: 'shop-fruit' }, `내 열매 🍎 ${shop.fruits}개`),
    tabs, sale,
    h('div', { class: 'shop-list' }, rows),
    h('p', { class: 'note' }, `${['sell', 'gift'].includes(shopTab) ? '' : '열매는 암송 연습, 묵상, 필사를 하면 모여요. '}${shopTab === 'pet' && f.pets3 ? PET_NOTE3 : SHOP_NOTE[shopTab]}`)].filter(Boolean));
}
function redrawShop(r) {
  if (r) shopData = r;
  const body = document.querySelector('#modalBody .talk.shop');
  if (body && shopData) drawShop(body, shopData);
}

// ---------- 꾸미기 물건 (모자, 안경, 날개, 특별한 옷) ----------
const WEAR_VERB = { hat: '쓰기', face: '쓰기', back: '메기', outfit: '입기' };
function wearRow(id, shop) {
  const it = WARDROBE[id];
  const owned = (shop.items || {})[id] > 0;
  const me = normalizeAvatar(state.me && state.me.avatar);
  const wearing = me[it.slot] === it.v;
  const ic = h('div', { class: 'fw-ic home wear', 'aria-hidden': 'true' });
  const src = avatarThumb({ ...me, [it.slot]: it.v }, it.slot === 'back' ? 'back' : it.slot === 'outfit' ? 'body' : 'head');
  if (src) ic.append(h('img', { src, alt: '' }));
  const acts = h('div', { class: 'acts' });
  if (!owned) acts.append(buyBtn(id, shop, '사기', () => buyWear(id)));
  else if (!wearing) acts.append(h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => wearNow(id, true) }, WEAR_VERB[it.slot]));
  else if (it.slot === 'outfit') acts.append(h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => { modal.close(); openMaker(false); } }, '옷장에서 갈아입기'));
  else acts.append(h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => wearNow(id, false) }, '벗기'));
  return h('div', { class: 'shop-item' + (wearing ? ' with-me' : '') }, ic,
    h('div', {}, h('b', {}, it.name), h('p', {}, it.desc), h('p', {}, owned ? (wearing ? '지금 하고 있어요' : '내 옷장에 있어요') : '')), acts);
}
async function buyWear(id) {
  if (buying) return;
  buying = true;
  try {
    const r = await rpc('kids_shop_buy', { p_token: token(), p_item: id, p_n: 1 });
    setFruits(r.fruits);
    sfx.success();
    buying = false;
    redrawShop(r);
    await wearNow(id, true, true);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { buying = false; }
}
// 산 꾸미기 물건을 바로 하기 / 벗기 (모습을 저장하고 친구들에게 알린다)
let wearBusy = false;
async function wearNow(id, on, fresh = false) {
  if (wearBusy || !state.me) return;
  wearBusy = true;
  const it = WARDROBE[id];
  try {
    const av = { ...normalizeAvatar(state.me.avatar), [it.slot]: on ? it.v : (it.slot === 'outfit' ? 'tee' : 'none') };
    const pet = state.me.pet, pets = state.me.pets;
    state.me = await rpc('kids_save_avatar', { p_token: token(), p_avatar: av, p_village_name: state.me.village_name });
    if (state.me && !('pet' in state.me)) { state.me.pet = pet; state.me.pets = pets; } else takeMyPets(state.me);
    village.setPlayer(state.me.avatar);
    village.setHome(state.me.village_name, normalizeAvatar(state.me.avatar));
    if (net) net.send('av', {});
    updateHud();
    if (on) { village.celebrate(); toast(fresh ? `${josa(it.name, '을', '를')} 샀어요! 정말 잘 어울려요.` : `${josa(it.name, '을', '를')} 했어요! 정말 잘 어울려요.`, 2800); }
    else toast(`${josa(it.name, '을', '를')} 벗었어요. 옷장에 잘 넣어 둘게요.`, 2400);
    redrawShop();
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { wearBusy = false; }
}

// ---------- 팔기: 잡은 물고기와 곤충 ----------
function sellRows(shop) {
  const sell = shop.sell || {};
  const cap = sell.cap || 0, today = sell.today || 0, left = Math.max(0, cap - today);
  const head = h('div', { class: 'sell-head' },
    cap > 0 ? h('b', {}, `오늘 팔아서 받은 열매 ${today} / ${cap}개`) : h('b', {}, '지금은 팔기를 쉬고 있어요.'),
    h('p', {}, cap > 0 ? (left ? `흔한 물고기, 곤충, 보물은 10개, 거둔 채소와 열매는 1~4개를 모으면 열매 1개예요. 오늘은 열매 ${left}개 더 받을 수 있어요.` : '오늘은 다 팔았어요. 내일 또 팔아요!') : '선생님이 다시 열어 주면 팔 수 있어요.'));
  const out = [head];
  // size마리를 모으면 열매 1개
  const row = (kind, id, name, count, size, icon, u = '마리') => {
    const can = Math.min(Math.floor(count / size), left);
    const acts = h('div', { class: 'acts' },
      h('button', { class: 'btn btn-go btn-small', type: 'button', disabled: count < size || left < 1, onclick: () => sellNow(kind, id, 1, size) }, `${size}${u} 팔기 (열매 1개)`),
      can > 1 ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => sellNow(kind, id, can, size) }, `${can * size}${u} 팔기 (열매 ${can}개)`) : null);
    const need = count < size ? ` · 열매 1개까지 ${size - count}${u} 더 모아요` : '';
    return h('div', { class: 'shop-item sell' }, icon, h('div', {}, h('b', {}, name), h('p', {}, `가방에 ${count}${u} · ${size}${u}에 열매 1개${need}`)), acts);
  };
  const bundle = sell.bundle || {};
  const fishes = FISH.filter((f) => (sell.fish || {})[f.id] > 0 && (bundle.fish || {})[f.id]);
  const bugs = BUGS.filter((b) => (sell.bugs || {})[b.id] > 0 && (bundle.bug || {})[b.id]);
  for (const f of fishes) {
    const ic = h('div', { class: 'fw-ic fish', 'aria-hidden': 'true' }, fishCanvas(f, 60, 40));
    out.push(row('fish', f.id, f.name, sell.fish[f.id], bundle.fish[f.id], ic));
  }
  for (const b of bugs) {
    const ic = h('div', { class: 'fw-ic bug', 'aria-hidden': 'true' });
    ic.innerHTML = bugIcon(b.id, true);
    out.push(row('bug', b.id, b.name, sell.bugs[b.id], bundle.bug[b.id], ic));
  }
  const trs = TREASURES.filter((t) => (sell.treasures || {})[t.id] > 0 && (bundle.treasure || {})[t.id]);
  for (const t of trs) {
    const ic = h('div', { class: 'fw-ic bug', 'aria-hidden': 'true' });
    ic.innerHTML = treasureIcon(t.id, 44);
    out.push(row('treasure', t.id, t.name, sell.treasures[t.id], bundle.treasure[t.id], ic, '개'));
  }
  const crops = CROP_IDS.filter((id) => (sell.crops || {})[id] > 0 && (bundle.crop || {})[id]);
  for (const id of crops) {
    const hv = HARVEST[id];
    const ic = h('div', { class: 'fw-ic crop', 'aria-hidden': 'true' }, hv.icon);
    out.push(row('crop', id, hv.name, sell.crops[id], bundle.crop[id], ic, hv.unit));
  }
  if (!fishes.length && !bugs.length && !trs.length && !crops.length) out.push(h('p', { class: 'fb-empty' }, '팔 물고기나 곤충, 보물이 없어요. 반짝 연못과 바다에서 낚시하고, 반짝이는 곤충을 잡고, 모래밭에서 보물을 캐 와요!'));
  // 애완동물: 하루 팔기 한도와 따로, 데려올 때 값의 반
  const pets = state.features.pets3 ? PET_IDS.filter((id) => (shop.items || {})[id] > 0) : [];
  if (pets.length) {
    out.push(h('div', { class: 'sell-head' }, h('b', {}, '🐾 애완동물'), h('p', {}, `데려올 때 값의 반(열매 ${petSellPrice(pets[0])}개)을 받아요. 위의 하루 한도와 따로예요.`)));
    for (const id of pets) {
      const ic = h('div', { class: 'fw-ic pet', 'aria-hidden': 'true' });
      ic.innerHTML = petIcon(id);
      const nm = petName(id);
      out.push(h('div', { class: 'shop-item sell' }, ic,
        h('div', {}, h('b', {}, nm ? `${nm} ` : '', nm ? h('small', { class: 'pet-kind' }, PET_ITEMS[id].name) : PET_ITEMS[id].name),
          h('p', {}, myPets().includes(id) ? '지금 나와 함께 다녀요' : '우리 집에서 쉬고 있어요')),
        h('div', { class: 'acts' }, h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => askSellPet(id, 'sell') }, `팔기 (열매 ${petSellPrice(id)}개)`))));
    }
  }
  return out;
}
let selling = false;
// k: 받을 열매 수(묶음 수), size: 묶음 하나의 마릿수
async function sellNow(kind, id, k, size) {
  if (selling) return;
  selling = true;
  try {
    const r = await rpc('kids_sell_bundle', { p_token: token(), p_kind: kind, p_item: id, p_bundles: k });
    setFruits(r.fruits);
    sfx.success();
    const name = kind === 'fish' ? (fishById(id) || {}).name : kind === 'bug' ? (bugById(id) || {}).name : kind === 'crop' ? (HARVEST[id] || {}).name : (treasureById(id) || {}).name;
    const unit = kind === 'treasure' ? '개' : kind === 'crop' ? (HARVEST[id] || {}).unit : '마리';
    if (kind === 'crop' && r.sell) setCrops(r.sell.crops);
    toast(`${name} ${k * size}${unit}를 팔고 열매 ${k}개를 받았어요!`, 2600);
    redrawShop(r);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { selling = false; }
}

// ---------- 선물: 친구에게 열매 주기 ----------
function giftRows(shop) {
  const left = Number.isFinite(shop.gift_left) ? shop.gift_left : GIFT.day;
  const me = state.me && state.me.id;
  const people = [...state.people.values()].filter((p) => p.id !== me && p.name)
    .sort((a, b) => (online.has(b.id) - online.has(a.id)) || a.name.localeCompare(b.name, 'ko'));
  const out = [h('div', { class: 'sell-head' }, h('b', {}, `오늘 더 보낼 수 있는 열매 ${left}개`),
    h('p', {}, left ? '선물할 친구를 골라요. 지금 마을에 있는 친구가 먼저 나와요.' : '오늘은 선물을 다 보냈어요. 내일 또 보내요!'),
    state.features.pets3 ? h('p', {}, "애완동물은 '🐾 동물' 칸이나 가방에서 '선물하기'를 눌러 보내요.") : null)];
  if (!people.length) out.push(h('p', { class: 'fb-empty' }, '아직 마을 친구가 없어요.'));
  const grid = h('div', { class: 'gift-people' }, people.map((p) => {
    const cv = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
    drawFaceIcon(cv, normalizeAvatar(p.avatar));
    return h('button', { class: 'gift-person', type: 'button', disabled: !left || !shop.fruits, onclick: () => openGift(p.id) },
      cv, h('b', {}, p.name, tBadge(p)), online.has(p.id) ? h('small', {}, '지금 마을에 있어요') : null);
  }));
  if (people.length) out.push(grid);
  return out;
}
// 선물 고르기 창: 몇 개, 한마디
function openGift(id) {
  const p = state.people.get(id);
  if (!p || !state.features.gift) return;
  const shop = shopData || {};
  const left = Math.min(Number.isFinite(shop.gift_left) ? shop.gift_left : GIFT.day, state.me ? state.me.fruits : 0);
  let n = Math.min(1, left), msg = 'thanks';
  const face = h('canvas', { width: 96, height: 96, class: 'fl-face big', 'aria-hidden': 'true' });
  drawFaceIcon(face, normalizeAvatar(p.avatar));
  const nums = h('div', { class: 'gift-nums', role: 'group', 'aria-label': '몇 개 보낼까요' });
  const msgs = h('div', { class: 'gift-msgs', role: 'group', 'aria-label': '함께 보낼 말' });
  const sum = h('p', { class: 'gift-sum' });
  const send = h('button', { class: 'btn btn-go', type: 'button', onclick: () => sendGift(id, n, msg) });
  const draw = () => {
    nums.replaceChildren(...GIFT.choices.map((k) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(n === k), disabled: k > left,
      onclick: () => { n = k; draw(); } }, `🍎 ${k}`)));
    msgs.replaceChildren(...Object.entries(GIFT_MSGS).map(([k, t]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(msg === k),
      onclick: () => { msg = k; draw(); } }, t)));
    sum.textContent = `${p.name}에게 열매 ${n}개와 "${GIFT_MSGS[msg]}"를 보내요. (내 열매 ${state.me ? state.me.fruits : 0}개)`;
    send.textContent = `🎁 열매 ${n}개 선물하기`;
    send.disabled = n < 1;
  };
  draw();
  openSheet('열매 선물하기', h('div', { class: 'talk gift' },
    h('div', { class: 'gift-to' }, face, h('div', {}, h('b', {}, p.name, tBadge(p)), h('p', { class: 'note' }, left ? `오늘은 열매 ${left}개까지 보낼 수 있어요.` : '오늘은 더 보낼 수 없어요.'))),
    h('h4', {}, '몇 개 보낼까요?'), nums, h('h4', {}, '함께 보낼 말'), msgs, sum,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => modal.close() }, '다음에'), send)), 'talk-sheet');
}
let gifting = false;
async function sendGift(id, n, msg) {
  if (gifting) return;
  gifting = true;
  try {
    const r = await rpc('kids_gift_send', { p_token: token(), p_to: id, p_n: n, p_msg: msg });
    setFruits(r.fruits);
    if (shopData) { shopData.fruits = r.fruits; shopData.gift_left = r.gift_left; }
    if (net) net.send('gift', { to: id, n, m: msg });
    sfx.success();
    confetti();
    village.celebrate();
    const p = state.people.get(id) || { name: '친구' };
    modal.close();
    toast(`${p.name}에게 열매 ${n}개를 선물했어요! "${GIFT_MSGS[msg]}"`, 3200);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { gifting = false; }
}
// 받은 선물: 서버에서 아직 못 본 선물을 가져와 알린다 (친구가 보냈다는 신호를 받았을 때와 마을에 들어올 때)
let giftChecking = false;
async function checkGifts(live = false) {
  if (!state.features.gift || giftChecking || !state.me) return;
  giftChecking = true;
  try {
    const r = await rpc('kids_gift_inbox', { p_token: token() });
    if (Number.isFinite(r.fruits)) setFruits(r.fruits);
    const pets = (r.gifts || []).filter((g) => g.item && PET_ITEMS[g.item]);
    if (pets.length) {
      // 받은 동물은 서버에서 바로 나를 따라다니게 되어 있다 (세 마리보다 적을 때). 이름과 목록을 새로 받는다
      const shop = await loadShop();
      if (shop) { takeMyPets(state.me, shop); showMyPets(); if (net) net.send('av', {}); redrawPetViews(); }
    }
    for (const g of r.gifts || []) {
      let text, line;
      if (g.item && PET_ITEMS[g.item]) {
        const kind = PET_ITEMS[g.item].name, nm = petName(g.item);
        const call = nm ? `${kind} ${nm}` : kind;
        const follow = myPets().includes(g.item);
        text = `🎁 ${josa(g.name, '이가', '가')} ${josa(call, '을', '를')} 선물했어요! "${GIFT_MSGS[g.msg] || ''}" ${follow ? '지금 나를 따라다녀요.' : "가방의 '우리 집 친구'에서 데리고 다닐 수 있어요."}`;
        line = `🎁 ${kind} 선물`;
      } else {
        text = `🎁 ${josa(g.name, '이가', '가')} 열매 ${g.n}개를 선물했어요! "${GIFT_MSGS[g.msg] || ''}"`;
        line = `🎁 열매 ${g.n}개 선물`;
      }
      if (live) { sfx.success(); confetti(); toast(text, 4600); logLine(g.name, line, false); }
      else notice(text, 5200);
    }
  } catch (e) { if (e.code === 'SESSION') sessionLost(); } finally { giftChecking = false; }
}
function homeIcon(id) {
  const ic = h('div', { class: 'fw-ic home', 'aria-hidden': 'true' });
  const src = itemThumb(id);
  if (src) ic.append(h('img', { src, alt: '' }));
  return ic;
}
function homeRow(id, count, shop) {
  const it = HOME_ITEMS[id];
  return h('div', { class: 'shop-item' }, homeIcon(id),
    h('div', {}, h('b', {}, it.name), h('p', {}, it.desc), h('p', {}, count ? `가진 것 ${count}개` : '')),
    h('div', { class: 'acts' }, buyBtn(id, shop, '사기', () => buyHome(id))));
}
async function buyHome(id) {
  if (buying) return;
  buying = true;
  try {
    const r = await rpc('kids_shop_buy', { p_token: token(), p_item: id, p_n: 1 });
    shopData = r;
    setFruits(r.fruits);
    sfx.success();
    const it = HOME_ITEMS[id];
    toast(village.atHome ? `${josa(it.name, '을', '를')} 샀어요! '집 꾸미기'에서 놓아 봐요.` : `${josa(it.name, '을', '를')} 샀어요! 내 집에 들어가서 '집 꾸미기'를 누르면 놓을 수 있어요.`, 3200);
    if (homeUI) homeUI.onShopChanged(r.items);
    const body = document.querySelector('#modalBody .talk.shop');
    if (body) drawShop(body, r);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { buying = false; }
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
    if (net) {
      const at = village.atHome ? village.playerPos() : { x, z }; // 내 집에서 쏘면 친구들에게는 마을 내 집 위에서 터진다
      net.send('fw', { k: id, x: +(at.x).toFixed(2), z: +(at.z - (village.atHome ? 2 : 0)).toFixed(2) });
    }
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

// ---------- 수확 바구니와 나눔 수레 ----------
// 밭에서 거둔 채소와 열매는 수확 바구니에 모인다. 나눔 수레에 올려 친구들과 나눠 먹거나 열매 상점에서 판다
function setCrops(c) { if (c && typeof c === 'object') state.crops = { ...c }; }
function cropCount() { return Object.values(state.crops || {}).reduce((a, n) => a + (n || 0), 0); }
function cropChip(id, n) {
  const hv = HARVEST[id];
  return h('span', { class: 'bag-chip crop' }, h('span', { 'aria-hidden': 'true' }, hv.icon), `${hv.name} ${n}${hv.unit}`);
}
async function openBasket() {
  const body = h('div', { class: 'talk basket' }, h('p', { class: 'fb-empty' }, '수확 바구니를 여는 중…'));
  openSheet('🧺 수확 바구니', body, 'talk-sheet');
  const shop = await loadShop();
  if (!modal.isOpen || !body.isConnected) return;
  if (shop && shop.sell) setCrops(shop.sell.crops);
  drawBasket(body);
}
function drawBasket(body) {
  const crops = state.crops || {};
  const have = CROP_IDS.filter((id) => crops[id] > 0);
  if (!have.length) {
    body.replaceChildren(h('p', { class: 'fb-empty' }, '수확 바구니가 비어 있어요.'),
      h('p', { class: 'note' }, '열매 상점에서 씨앗을 사서 내 집 밭에 심어 봐요. 며칠 지나 다 자라면 거둘 수 있어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => modal.close() }, '알겠어요')));
    return;
  }
  const want = {};
  const rows = have.map((id) => {
    const hv = HARVEST[id];
    const max = Math.min(10, crops[id]);
    want[id] = Math.min(3, max);
    const num = h('b', { class: 'share-n' }, String(want[id]));
    const step = (d) => { want[id] = Math.max(1, Math.min(max, want[id] + d)); num.textContent = String(want[id]); };
    return h('div', { class: 'shop-item basket-row' },
      h('div', { class: 'fw-ic crop', 'aria-hidden': 'true' }, hv.icon),
      h('div', {}, h('b', {}, `${hv.name} ${crops[id]}${hv.unit}`), h('p', {}, `${hv.sell}${hv.unit}를 팔면 열매 1개`)),
      h('div', { class: 'acts' },
        h('div', { class: 'stepper' },
          h('button', { class: 'btn btn-plain btn-small', type: 'button', 'aria-label': '하나 빼기', onclick: () => step(-1) }, '−'), num,
          h('button', { class: 'btn btn-plain btn-small', type: 'button', 'aria-label': '하나 더', onclick: () => step(1) }, '+')),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => shareCrop(id, want[id], body) }, '나눔 수레에 올리기')));
  });
  body.replaceChildren(
    h('p', {}, '밭에서 거둔 채소와 열매예요. 마을 식탁 옆 나눔 수레에 올리면 친구들이 하나씩 먹을 수 있어요.'),
    h('div', { class: 'shop-list' }, rows),
    h('p', { class: 'note' }, '나눔 수레에는 한 번에 10개까지 올릴 수 있어요. 열매 상점의 팔기 칸에서 팔 수도 있어요.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-plain', type: 'button', onclick: () => modal.close() }, '닫기'),
      state.features.sell ? h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { shopTab = 'sell'; modal.close(); if (homeUI.guest || village.atHome) homeUI.exit().then(() => village.walkTo('shop')); else village.walkTo('shop'); } }, '🍎 열매 상점에서 팔기') : null));
}
let sharing = false;
async function shareCrop(id, n, body) {
  if (sharing) return;
  sharing = true;
  try {
    const r = await rpc('kids_crop_share', { p_token: token(), p_crop: id, p_n: n });
    setCrops(r.crops);
    sfx.success();
    village.celebrate();
    const hv = HARVEST[id];
    toast(`나눔 수레에 ${hv.name} ${n}${hv.unit}를 올렸어요! 친구들이 하나씩 먹을 수 있어요.`, 3400);
    if (net) net.send('share', { s: r.id, e: 0 });
    shareAt = 0;
    refreshShares();
    if (body && body.isConnected) drawBasket(body);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 3000);
  } finally { sharing = false; }
}
function openShare(d) {
  const hv = HARVEST[d.crop] || { name: '채소', unit: '개', icon: '🧺' };
  const eaters = Array.isArray(d.eaters) ? d.eaters : [];
  const left = Math.max(0, (d.n || 0) - (d.eaten || 0));
  const canEat = !d.me && !d.ate && left > 0;
  openSheet('나눔 수레', h('div', { class: 'talk dish-eat' },
    h('p', { class: 'result-big' }, `${hv.icon} ${hv.name}`),
    h('p', {}, d.me ? `내가 밭에서 거둬 나눈 ${josa(hv.name, '이에요', '예요')}.` : `${d.by || '친구'}${hasB(d.by) ? '이가' : '가'} 밭에서 길러 나눈 ${josa(hv.name, '이에요', '예요')}.`),
    h('p', {}, `${d.n}${hv.unit} 가운데 ${left}${hv.unit} 남았어요.`),
    h('div', { class: 'eaters' }, eaters.length
      ? [h('b', {}, `냠냠 먹은 친구 ${d.eaten || eaters.length}명`), h('p', {}, eaters.join(', ') + ((d.eaten || 0) > eaters.length ? ' …' : ''))]
      : h('p', {}, '아직 아무도 안 먹었어요.')),
    d.ate ? h('p', { class: 'note' }, '나도 벌써 하나 먹었어요! 다른 친구들 몫이에요.') : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-plain', type: 'button', onclick: () => modal.close() }, '닫기'),
      canEat ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => eatShare(d) }, '하나 먹기') : null)), 'talk-sheet');
}
let eatingShare = false;
async function eatShare(d) {
  if (eatingShare) return;
  eatingShare = true;
  try {
    await rpc('kids_share_eat', { p_token: token(), p_share: d.id });
    modal.close();
    village.eatShare(d);
    if (net) net.send('share', { s: d.id, e: 1 });
    shareAt = 0;
    setTimeout(refreshShares, 2600);
  } catch (e) {
    if (e.code === 'SESSION') { sessionLost(); return; }
    toast(message(e), 2800);
    shareAt = 0;
    refreshShares();
  } finally { eatingShare = false; }
}

// ---------- 마을 친구 NPC: 눌러서 다가가면 하이파이브, 가위바위보, 간식 나눠 먹기 ----------
let npcSnackFrom = null;
const RPS = [['scissors', '✌️', '가위'], ['rock', '✊', '바위'], ['paper', '🖐️', '보']];
function npcSnackKey(d) { return `kv.npcSnack.${(state.me && state.me.id) || 'me'}.${d.id}`; }
function todayStr() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; }
function openVillager(i) {
  const d = VILLAGERS[i];
  const vg = village.villagers;
  if (!d || !vg) return;
  let after = null; // 창을 닫은 뒤 할 일
  hideHint();
  $('#sayPanel').hidden = true;
  village.setPaused(true);
  const body = h('div', { class: 'talk npc-talk' });
  modal.open('마을 친구', body, { cls: 'talk-sheet', onClose: () => {
    village.setPaused(false);
    vg.hold(i, 2.5); // 잠깐 더 마주 보다가 하던 일로 돌아간다
    if (after) { const f = after; after = null; f(); }
  } });
  const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
  drawFaceIcon(face, normalizeAvatar(d.av));
  const head = h('div', { class: 'npc-head' }, face, h('div', {}, h('b', {}, d.name), h('p', {}, `마을 친구 · ${d.about}`)));
  const btn = (label, fn, cls = 'btn-soft') => h('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
  let snackDone = false;
  try { snackDone = localStorage.getItem(npcSnackKey(d)) === todayStr(); } catch (e) { /* 그대로 */ }
  const hv = HARVEST[d.snack];
  function home() {
    body.replaceChildren(...[head,
      h('p', { class: 'npc-line' }, `“${vg.talkOf ? vg.talkOf(i) : TALK.walk}”`),
      h('div', { class: 'npc-acts' },
        btn('👋 하이파이브', () => { after = () => highFive(); modal.close(); }),
        btn('✌️ 가위바위보', () => rps()),
        !snackDone && hv ? btn(`${hv.icon} 간식 나눠 먹기`, () => { after = () => snack(); modal.close(); }) : null),
      snackDone ? h('p', { class: 'note' }, `오늘은 ${josa(d.name, '이', '가')} 간식을 벌써 나눠 줬어요. 내일 또 줄 거예요!`) : null,
      h('p', { class: 'note' }, '마을 친구는 우리 마을에 사는 친구예요. 진짜 친구처럼 쪽지나 선물은 주고받을 수 없어요.'),
      h('div', { class: 'row' }, btn('안녕, 또 봐!', () => { after = () => vg.say(i, '또 놀자!'); modal.close(); }, 'btn-plain'))].filter(Boolean));
  }
  let score = { me: 0, npc: 0 };
  function rps(last) {
    const pick = (k) => {
      const mine = RPS.findIndex((r) => r[0] === k);
      const theirs = Math.floor(Math.random() * 3);
      // 가위(0)는 보(2)를, 바위(1)는 가위(0)를, 보(2)는 바위(1)를 이긴다
      const res = mine === theirs ? 'draw' : (mine + 2) % 3 === theirs ? 'win' : 'lose';
      if (res === 'win') { score.me++; sfx.success(); } else if (res === 'lose') { score.npc++; sfx.fail(); } else sfx.pop();
      rps({ mine, theirs, res });
    };
    const lines = { win: [`내가 이겼다!`, `${d.name}: 와, 너 정말 잘한다!`], lose: [`${josa(d.name, '이', '가')} 이겼어요.`, `${d.name}: 헤헤, 한 판 더 할래?`], draw: ['비겼어요!', `${d.name}: 우리 마음이 똑같네!`] };
    body.replaceChildren(...[head,
      h('p', { class: 'npc-line' }, last ? lines[last.res][1] : `${d.name}: 가위, 바위, 보! 하나 골라!`),
      last ? h('div', { class: 'rps-show' },
        h('div', {}, h('span', { class: 'rps-big', 'aria-hidden': 'true' }, RPS[last.mine][1]), h('small', {}, `나 · ${RPS[last.mine][2]}`)),
        h('b', { class: 'rps-res ' + last.res }, lines[last.res][0]),
        h('div', {}, h('span', { class: 'rps-big', 'aria-hidden': 'true' }, RPS[last.theirs][1]), h('small', {}, `${d.name} · ${RPS[last.theirs][2]}`))) : null,
      h('p', { class: 'note' }, `나 ${score.me} : ${score.npc} ${d.name}`),
      h('div', { class: 'rps-pick' }, RPS.map(([k, ic, name]) => h('button', { class: 'rps-btn', type: 'button', onclick: () => pick(k) }, h('span', { 'aria-hidden': 'true' }, ic), name))),
      h('div', { class: 'row' }, btn('그만할래', () => {
        const won = score.me > score.npc, lost = score.me < score.npc;
        after = () => { vg.say(i, won ? '다음엔 내가 이길 거야!' : lost ? '재밌었다! 또 하자!' : '재밌었다!'); if (lost) vg.cheer(i); else vg.jump(i); };
        modal.close();
      }, 'btn-plain'))].filter(Boolean));
  }
  function highFive() {
    if (village.player) village.player.jump();
    vg.jump(i);
    sfx.pop();
    village.say('me', '짝!');
    vg.say(i, '하이파이브! 짝!');
    setActivity('');
  }
  function snack() {
    try { localStorage.setItem(npcSnackKey(d), todayStr()); } catch (e) { /* 이번만 */ }
    npcSnackFrom = d.name;
    vg.say(i, `이거 먹어 봐! 내가 좋아하는 ${josa(hv.name, '이야', '야')}.`, 2.8);
    vg.cheer(i);
    setTimeout(() => village.eatShare({ crop: d.snack }, 'npc'), 900);
  }
  home();
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

// 친구가 어느 집에 있는지 (친구 목록에 보인다)
function houseText(r) {
  if (!r || !r.house) return '';
  const me = state.me && state.me.id;
  if (r.house === r.id) return '🏠 자기 집에 있어요';
  if (r.house === me) return '🏡 우리 집에 놀러 와 있어요';
  const owner = state.people.get(r.house);
  return `🏡 ${owner ? `${owner.name}네` : '친구'} 집에 놀러 갔어요`;
}

// 친구 찾아가기: 친구가 어느 집 안에 있으면 그 집으로, 아니면 마을에서 친구 옆으로
async function findFriend(id) {
  const r = village.remotes.get(id);
  if (state.features.visit && state.features.home && r && r.house) { goVisit(r.house); return; }
  modal.close(); if (play3d.active) play3d.stop(); if (village.atHome) await homeUI.exit(); village.walkToFriend(id);
}

function openFriends() {
  const list = [...online].map((id) => state.people.get(id)).filter(Boolean);
  const visitOk = !!(state.features.visit && state.features.home);
  const games = new Set(watchableGames().map((g) => g.id));
  const dmOk = !!(state.features.dm && state.chatOpen);
  const rows = list.map((p) => {
    const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
    drawFaceIcon(face, normalizeAvatar(p.avatar));
    const r = village.remotes.get(p.id);
    const act = r && r.actName;
    const swimAs = act === 'swim' && STROKE_LIST[r.actSeat] ? `${STROKE_LIST[r.actSeat][2]}으로 ` : ''; // 배영으로 수영하는 중
    const unread = (state.dms.get(p.id) || []).filter((m) => !m.mine && !m.read).length;
    return h('div', { class: 'fl-row' }, face,
      h('div', { class: 'fl-main' }, h('b', {}, p.name, tBadge(p)), h('span', {}, houseText(r) || (act ? `${ACT_ICON[act] || ''} ${swimAs}${ACT_TEXT[act] || ''}` : '마을을 걷고 있어요'))),
      h('div', { class: 'fl-acts' },
        dmOk ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => openDm(p.id) }, unread ? `💌 쪽지 (${unread})` : '💌 쪽지') : null,
        state.features.gift ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: async () => { if (!shopData) await loadShop(); openGift(p.id); } }, '🎁 선물') : null,
        games.has(p.id) ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { modal.close(); play3d.omokWatch(p.id); } }, '👀 구경하기') : null,
        visitOk ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => goVisit(p.id) }, '🏠 집에 놀러 가기') : null,
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => findFriend(p.id) }, '찾아가기')));
  });
  openSheet(`지금 마을에 있는 친구 ${list.length}명`, h('div', { class: 'talk friends' },
    mailOk() ? h('div', { class: 'row' }, h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => openMail() },
      state.unread ? `💌 쪽지함 (새 쪽지 ${state.unread})` : '💌 쪽지함 · 마을에 없는 친구에게도')) : null,
    rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '지금은 혼자 있어요. 친구가 들어오면 여기에 보여요.'),
    dmOk ? h('p', { class: 'note' }, '쪽지는 둘만 보이지만, 안전을 위해 선생님은 볼 수 있어요.') : null), 'talk-sheet');
}

function addDm(id, text, mine) {
  const list = state.dms.get(id) || [];
  list.push({ mine, text, at: Date.now(), read: mine || dmOpenWith === id });
  while (list.length > 60) list.shift();
  state.dms.set(id, list);
  if (dmOpenWith === id) {
    drawDm();
    if (!mine) { sfx.pop(true); if (mailOk()) rpc('kids_dm_thread', { p_token: token(), p_with: id }).catch(() => { /* 다음에 */ }); } // 보고 있으니 읽은 것으로
    return;
  }
  if (!mine) {
    state.unread += 1;
    friendsBadge();
    sfx.invite();
    const p = state.people.get(id) || { name: '친구' };
    showDmCard(id, p.name, text);
  }
}

// 친구가 자기 집에 놀러 오라고 불렀다
let homeCard = null;
function showHomeInvite(id, name) {
  if (homeCard) homeCard.remove();
  const close = () => { if (homeCard === card) { card.remove(); homeCard = null; } };
  const card = h('div', { class: 'invite-card dm-card', role: 'status' },
    h('div', { class: 'dm-ic', 'aria-hidden': 'true' }, '🏠'),
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, name), `${josa(name, '이가', '가').slice(name.length)} 자기 집에 놀러 오래요!`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '다음에'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); goVisit(id); } }, '놀러 가기'))));
  homeCard = card;
  sfx.invite();
  document.body.append(card);
  setTimeout(close, 12000);
}
// 친구 집에 놀러 가기 (하던 놀이는 그만둔다)
async function goVisit(id) {
  if (!state.features.visit) return;
  modal.close();
  if (play3d.active) play3d.stop();
  if (homeUI.editing) homeUI.stopEdit();
  await homeUI.visit(id);
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
// 둘이 쪽지: 서버에 남겨 두고, 받는 친구가 마을에 있으면 바로 보낸다 (없으면 다음에 들어와서 쪽지함에서 읽는다)
const mailOk = () => !!(state.features.mail && state.features.dm);
let dmOfflineTold = false;
async function openDm(id) {
  const p = state.people.get(id);
  if (!p) return;
  const canSend = !!(state.features.dm && state.chatOpen);
  if (mailOk()) {
    try {
      const th = await rpc('kids_dm_thread', { p_token: token(), p_with: id });
      state.dms.set(id, (Array.isArray(th) ? th : []).map((m) => ({ mine: !!m.mine, text: m.text, at: Date.parse(m.at) || Date.now(), read: true })));
    } catch (e) { if (e.code === 'SESSION') { sessionLost(); return; } }
    loadMail();
  }
  dmOpenWith = id;
  dmBody = h('div', { class: 'dm-list', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', maxlength: CHAT_MAX, autocomplete: 'off', enterkeyhint: 'send', placeholder: `${p.name}에게 할 말`, 'aria-label': `${p.name}에게 할 말`, disabled: !canSend });
  let sending = false;
  const form = h('form', { class: 'say-write' }, input, h('button', { class: 'btn btn-go btn-small', type: 'submit', 'data-quiet': '', disabled: !canSend }, '보내기'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t0 = cleanChat(input.value);
    if (!t0 || sending || !canSend) return;
    if (!mailOk() && !online.has(id)) { toast(`${josa(p.name, '이', '가')} 지금 마을에 없어요.`); return; }
    sending = true;
    try {
      const r = await rpc('kids_dm_send', { p_token: token(), p_to: id, p_text: input.value });
      const t = cleanChat(r && r.text);
      if (t) {
        input.value = '';
        addDm(id, t, true);
        sfx.pop();
        if (online.has(id)) { if (net) net.send('dm', { to: id, m: t }); }
        else if (!dmOfflineTold) { dmOfflineTold = true; toast(`쪽지를 남겼어요! ${josa(p.name, '이', '가')} 마을에 들어오면 읽을 수 있어요.`, 3200); }
      }
    } catch (err) {
      if (err.code === 'SESSION') { sessionLost(); return; }
      toast(message(err));
    } finally { sending = false; }
  });
  const here = online.has(id);
  openSheet(`💌 ${josa(p.name, '과', '와')} 쪽지`, h('div', { class: 'talk dm' },
    mailOk() && !here ? h('p', { class: 'note' }, `${josa(p.name, '은', '는')} 지금 마을에 없어요. 쪽지를 남기면 다음에 들어와서 읽어요.`) : null,
    dmBody, form,
    canSend ? null : h('p', { class: 'note' }, '지금은 선생님이 글 대화를 쉬게 해 두어서 쪽지를 보낼 수 없어요.'),
    h('p', { class: 'note' }, '둘만 보이는 쪽지예요. 안전을 위해 선생님은 볼 수 있어요.'),
    mailOk() ? h('div', { class: 'row' }, h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => openMail() }, '쪽지함으로')) : null), 'talk-sheet');
  const m = document.getElementById('modal');
  const obs = new MutationObserver(() => { if (m.hidden || !document.body.contains(dmBody)) { dmOpenWith = null; dmBody = null; obs.disconnect(); } });
  obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  drawDm();
  if (canSend && matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 60);
}

// ---------- 쪽지함 ----------
async function loadMail(notify = false) {
  if (!mailOk() || !state.me) return;
  let box;
  try { box = await rpc('kids_dm_box', { p_token: token() }); } catch (e) { if (e.code === 'SESSION') sessionLost(); return; }
  state.mailBox = Array.isArray(box) ? box : [];
  state.unread = state.mailBox.reduce((a, t) => a + (t.unread || 0), 0);
  friendsBadge();
  if (notify && state.unread) showMailCard();
}
// 마을에 들어왔을 때 안 읽은 쪽지가 있으면
function showMailCard() {
  const from = state.mailBox.filter((t) => t.unread).map((t) => t.name);
  if (!from.length) return;
  if (dmCard) dmCard.remove();
  const close = () => { if (dmCard === card) { card.remove(); dmCard = null; } };
  const who = from.length > 2 ? `${from.slice(0, 2).join(', ')} 외 ${from.length - 2}명` : from.join(', ');
  const card = h('div', { class: 'invite-card dm-card', role: 'status' },
    h('div', { class: 'dm-ic', 'aria-hidden': 'true' }, '💌'),
    h('div', { class: 'inv-main' },
      h('p', {}, h('b', {}, who), `에게서 쪽지가 ${state.unread}통 왔어요!`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: close }, '나중에'),
        h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { close(); openMail(); } }, '쪽지함 열기'))));
  dmCard = card;
  sfx.invite();
  document.body.append(card);
  setTimeout(close, 10000);
}
function mailAgo(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}
function openMail() {
  if (!mailOk()) return;
  const me = state.me && state.me.id;
  const body = h('div', { class: 'talk friends mail' }, h('p', { class: 'fb-empty' }, '쪽지함을 여는 중…'));
  openSheet('💌 쪽지함', body, 'talk-sheet');
  loadMail().then(() => {
    if (!document.body.contains(body)) return;
    const canSend = !!(state.features.dm && state.chatOpen);
    const face = (av) => { const cv = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' }); drawFaceIcon(cv, normalizeAvatar(av)); return cv; };
    const threads = state.mailBox.map((t) => h('button', { class: 'fl-row mail-row' + (t.unread ? ' unread' : ''), type: 'button', onclick: () => openDm(t.id) },
      face(t.avatar),
      h('div', { class: 'fl-main' },
        h('b', {}, t.name, t.unread ? h('span', { class: 'mail-new' }, `새 쪽지 ${t.unread}`) : null),
        h('span', {}, `${t.mine ? '나: ' : ''}${t.text}`)),
      h('small', { class: 'mail-at' }, mailAgo(t.at))));
    const people = [...state.people.values()].filter((p) => p.id !== me && p.name).sort((a, b) => (online.has(b.id) - online.has(a.id)) || a.name.localeCompare(b.name, 'ko'));
    body.replaceChildren(
      h('div', { class: 'sub-head' }, h('h3', {}, '주고받은 쪽지'), h('p', {}, '최근 30일')),
      threads.length ? h('div', { class: 'fl-list' }, threads) : h('p', { class: 'fb-empty' }, '아직 주고받은 쪽지가 없어요.'),
      canSend ? h('div', { class: 'sub-head' }, h('h3', {}, '쪽지 쓰기'), h('p', {}, '마을에 없는 친구에게도 보낼 수 있어요')) : null,
      canSend ? (people.length ? h('div', { class: 'gift-people' }, people.map((p) => h('button', { class: 'gift-person', type: 'button', onclick: () => openDm(p.id) },
        face(p.avatar), h('b', {}, p.name, tBadge(p)), online.has(p.id) ? h('small', {}, '지금 마을에 있어요') : null))) : h('p', { class: 'fb-empty' }, '아직 마을 친구가 없어요.'))
        : h('p', { class: 'note' }, '지금은 선생님이 글 대화를 쉬게 해 두어서 쪽지를 보낼 수 없어요. 받은 쪽지는 읽을 수 있어요.'),
      h('p', { class: 'note' }, '쪽지는 둘만 보이지만, 안전을 위해 선생님은 볼 수 있어요. 쪽지는 30일 동안 남아요.'));
  });
}

// ---------- 화면 ----------
// ---------- 대구 지금 날씨: 마을 하늘, 비·눈, 빗소리 (js/weather.js, Open-Meteo.com) ----------
let weather = null;
function startWeather() {
  if (weather) { weather.start(); return; }
  weather = createWeather({ onChange: applyWeather });
  $('#hudWeather').addEventListener('click', openWeather);
  if (DEMO) applyWeather(null); // 체험판은 날씨를 못 받아도 날씨 단추를 보여서 미리 보기를 할 수 있게
  weather.start();
}
function applyWeather(w) {
  const chip = $('#hudWeather');
  const prev = state.weather;
  state.weather = w;
  if (!w) {
    chip.hidden = !DEMO;
    chip.textContent = '🌤️ 날씨';
    village.setWeather('clear');
    setRain(0);
    return;
  }
  village.setWeather(w.kind, w.level, w.wind || 0);
  const wet = ['drizzle', 'rain', 'storm'].includes(w.kind);
  setRain(wet ? (w.kind === 'drizzle' ? 0.35 : 0.5 + w.level * 0.5) : 0);
  chip.hidden = false;
  chip.textContent = `${wxIcon(w)} ${Number.isFinite(w.temp) ? `${Math.round(w.temp)}°` : WX_KINDS[w.kind].name}`;
  chip.setAttribute('aria-label', `대구 지금 날씨: ${w.label || WX_KINDS[w.kind].name}${Number.isFinite(w.temp) ? `, ${Math.round(w.temp)}도` : ''}. 눌러서 자세히 보기`);
  // 마을에 있는 동안 날씨가 바뀌면 한 번 알려 준다 (체험판 미리 보기는 빼고)
  if (prev && !w.preview && !prev.preview && prev.kind !== w.kind && state.me && !$('#hud').hidden) {
    toast(`${wxIcon(w)} 대구 날씨가 '${w.label || WX_KINDS[w.kind].name}'(으)로 바뀌었어요. ${WX_KINDS[w.kind].line}`, 4200);
  }
}
function fmtClock(ms) {
  const d = new Date(ms);
  return `${d.getHours() < 12 ? '오전' : '오후'} ${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function openWeather() {
  const w = weather && weather.now();
  const body = h('div', { class: 'talk wx-sheet' });
  if (!w) {
    body.append(h('p', {}, '아직 대구 날씨를 받지 못했어요. 인터넷이 연결되면 15분 안에 다시 받아요.'));
    if (DEMO) body.append(h('p', { class: 'note' }, '체험판을 여는 곳에 따라 날씨를 받지 못할 수 있어요. 아래에서 날씨를 골라 미리 볼 수 있어요.'));
  }
  else {
    const k = WX_KINDS[w.kind];
    body.append(
      h('div', { class: 'wx-head' }, h('span', { class: 'wx-big', 'aria-hidden': 'true' }, wxIcon(w)),
        h('div', {}, h('b', {}, `대구 지금 날씨: ${w.label || k.name}`),
          h('p', {}, [Number.isFinite(w.temp) ? `기온 ${w.temp.toFixed(1)}°C` : null, Number.isFinite(w.wind) && !w.preview ? `바람 초속 ${w.wind.toFixed(1)}m` : null].filter(Boolean).join(' · ')))),
      h('p', { class: 'talk-line' }, k.line),
      w.preview ? h('p', { class: 'note' }, '체험판에서 고른 날씨를 보여 주고 있어요.')
        : h('p', { class: 'note' }, `${fmtClock(w.fetchedAt)}에 받은 날씨예요. 15분마다 새로 받아요. 기상 모델로 계산한 값이라 실제 하늘과 조금 다를 수 있어요.`),
      h('p', { class: 'wx-credit' }, '날씨 정보: ', h('a', { href: WEATHER_CREDIT.url, target: '_blank', rel: 'noopener' }, WEATHER_CREDIT.text),
        ' (', h('a', { href: WEATHER_CREDIT.licenseUrl, target: '_blank', rel: 'noopener' }, WEATHER_CREDIT.license), ')'));
  }
  if (DEMO) {
    // 체험판: 여러 날씨를 미리 볼 수 있다
    const now = w && w.preview ? w.kind : null;
    body.append(h('h4', {}, '날씨 바꿔 보기 (체험판)'),
      h('div', { class: 'wx-pick' }, ...WX_IDS.map((id) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(now === id),
        onclick: () => { weather.preview(id); openWeather(); } }, `${WX_KINDS[id].icon} ${WX_KINDS[id].name}`)),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!now), onclick: () => { weather.preview(null); openWeather(); } }, '진짜 대구 날씨')));
  }
  body.append(h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => modal.close() }, '알겠어요')));
  openSheet('마을 날씨', body, 'talk-sheet');
}

function updateHud() {
  const me = state.me;
  $('#hudName').textContent = me.village_name || '';
  drawFaceIcon($('#hudFace'), normalizeAvatar(me.avatar));
  setFruits(me.fruits);
}

// 서버의 열매 수로 화면을 맞춘다 (선생님이 도장을 찍어 준 뒤 등)
// 다른 탭(선생님 화면 등)에 다녀오면 열매 수를 다시 읽는다 (선생님이 주민 열매를 바꿨을 수 있다)
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.me && state.token && !$('#hud').hidden) refreshFruits(); });
function refreshFruits() {
  rpc('kids_me', { p_token: token() }).then((m) => { if (m && Number.isFinite(m.fruits)) setFruits(m.fruits); }).catch(() => { /* 다음에 */ });
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
async function openGameWith(kind, session) {
  if (modal.isOpen) modal.close();
  if (village.atHome) await homeUI.exit();
  hideHint();
  $('#sayPanel').hidden = true;
  const bid = bgIdOf(kind);
  if (bid) play3d.boardGame(bid, { session, opts: session.extra });
  else if (kind === 'omok') play3d.omok({ session });
  else if (kind === 'ark') play3d.ark({ session });
  else play3d.cook({ recipe: recipeById(session.extra) || RECIPES[0], session });
}

function onEnter(id) {
  if (homeUI && homeUI.onDoor(id)) return;
  if (id === 'home') return homeUI.enter();
  if (id === 'suggest') return openSuggest();
  if (id === 'memory') return openHouse(() => memory.open(), 'memory');
  if (id === 'qt') return openHouse(() => qt.open(), 'qt');
  if (id === 'library') return openHouse(() => copy.open(), 'copy');
  // 서버에 아직 없는 놀이는 곧 열린다고만 알린다
  const NEED = { sea: 'sea', skip: 'skip', ark: 'ark' };
  if (GAMES[id] && NEED[id] && !state.features[NEED[id]]) { toast('곧 열려요! 조금만 기다려 줘요.', 2600); return; }
  if (GAMES[id]) return openGame(id);
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

// 숲지기 솔의 날씨 이야기 (대구 지금 날씨)
const SOL_WX = {
  drizzle: '지금 대구에 이슬비가 와서 마을에도 보슬보슬 내리고 있어. 밖에 나갈 때는 우산 챙기렴!',
  rain: '지금 대구에 비가 와서 마을에도 비가 내려. 비 오는 날엔 우산 꼭 챙기고, 미끄러운 길 조심해!',
  snow: '대구에 눈이 와서 마을에도 하얀 눈이 내려! 나가서 놀 땐 따뜻하게 입으렴.',
  storm: '지금 대구에 천둥번개가 쳐서 마을에도 번쩍번쩍해. 진짜로 천둥이 치면 밖에 나가지 말고 안전한 집 안에 있어야 해.',
  fog: '대구에 안개가 껴서 마을도 뿌옇네. 길을 건널 때는 더 조심하렴!',
  clear: null, partly: null, cloudy: null,
};
function onNpc() {
  const me = state.me;
  const t = state.today || {};
  const cur = memory.current();
  const name = josa(me.village_name, '아', '야');
  const lines = [];
  if (me.is_birthday) lines.push(`${name}, 생일 축하해! 오늘은 마을이 더 반짝이는 것 같아.`);
  else lines.push(`안녕, ${name}!${t.theme ? ` 이번 주 이야기는 '${t.theme}'이야.` : ''}`);
  const wx = state.weather;
  if (wx && SOL_WX[wx.kind]) lines.push(SOL_WX[wx.kind]);
  let go = null;
  if (!playOpen()) {
    const o = opensNow();
    if (o && o.includes('qt')) lines.push(`묵상은 날마다 하는 거야. 오늘 묵상을 마치면 놀이 마당과 놀이동산 섬이 열려.${o.includes('memory') || o.includes('copy') ? ' 이번 주 암송이나 필사를 처음 하는 날에도 열리고!' : ''}`);
    else lines.push(`${unlockHint()} 놀이 마당과 놀이동산 섬이 열려. 낚시도 하고 바이킹도 탈 수 있어!`);
  }
  if (t.qt && !t.qt.done) { lines.push(`오늘 묵상은 '${t.qt.title}'이야. 묵상의 숲에 가 볼래?`); go = ['묵상의 숲으로', 'qt']; }
  else if (cur && !cur.practiced_today && !cur.passed) { lines.push(`이번 주 말씀은 ${cur.ref}이야. 암송의 집에서 연습해 볼까?`); go = ['암송의 집으로', 'memory']; }
  else if (t.copy && !t.copy.done) { if (state.features.photo10) lines.push('이번 주 이야기를 공책에 손으로 써서 사진을 올리면 열매를 10개나 받을 수 있어!'); lines.push(t.theme ? `이번 주 필사는 '${t.theme}' 이야기야(${t.copy.ref}). 필사 도서관에서 읽고 따라 써 볼래?` : `이번 주 필사는 ${t.copy.ref}이야. 필사 도서관에서 따라 써 볼래?`); go = ['필사 도서관으로', 'library']; }
  else if (t.qt || cur) { lines.push('오늘 할 일을 벌써 다 했구나. 정말 멋지다! 친구들 글에 응원도 보내 봐.'); lines.push('남쪽 다리를 건너면 놀이동산 섬이야. 친구랑 회전목마나 바이킹을 타도 좋아. 동쪽 다리 건너 수영장 섬에서 헤엄쳐도 좋고!'); if (state.features.sea) lines.push('남동쪽 바닷가 나루터에서 배를 타고 바다 낚시를 할 수도 있어! 갈매기가 맴도는 곳에 물고기 떼가 있대.'); if (state.features.beach) lines.push('수영장 섬 모래밭에서 반짝이는 곳을 파면 보물이 나와. 물수제비 터와 노아의 방주도 거기 있어!'); }
  else lines.push('마을을 천천히 둘러보렴. 남쪽 다리를 건너면 놀이동산 섬, 동쪽 다리를 건너면 수영장 섬이야. 열매가 달린 나무를 누르면 열매를 따 먹을 수 있어.');
  if (state.features.feedback) lines.push('마을에 바라는 게 있거나 이상한 곳을 찾았니? 내 옆 건의함에 적어 주면 선생님께 꼭 전할게.');
  lines.push("마을 어디에 무엇이 있는지 궁금하면 '마을 지도'를 열어 봐. 가고 싶은 곳을 고르면 거기까지 데려다줄게.");
  openSheet('숲지기 솔', h('div', { class: 'talk' },
    lines.map((l) => h('p', { class: 'talk-line' }, l)),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => modal.close() }, '고마워요'),
      h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { modal.close(); guide.open(); } }, '🗺️ 마을 지도'),
      state.features.feedback ? h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { modal.close(); openSuggest(); } }, '건의함에 쓰기') : null,
      go ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { modal.close(); village.walkTo(go[1]); } }, go[0]) : null)), 'talk-sheet');
}

// ---------- 마을 건의함: 앱에 바라는 것, 고칠 곳 (선생님만 읽는다) ----------
const FB_KIND = { idea: ['💡', '이런 게 있으면 좋겠어요'], bug: ['🐞', '이상한 곳이 있어요'], like: ['💛', '이게 좋아요'], etc: ['✉️', '그 밖의 이야기'] };
const FB_STATUS = { new: '보냈어요', seen: '선생님이 읽었어요', done: '고쳤어요!' };
async function openSuggest() {
  if (!state.features.feedback) { toast('마을 건의함은 곧 열려요!', 2400); return; }
  let kind = 'idea', sending = false;
  const text = h('textarea', { class: 'sg-text', maxlength: 300, rows: 4, placeholder: '예: 낚시터에 물고기가 더 많았으면 좋겠어요. / 범퍼카에서 차가 벽에 끼었어요.', 'aria-label': '건의할 내용' });
  const count = h('small', { class: 'sg-count' }, '0/300');
  text.addEventListener('input', () => { count.textContent = `${[...text.value].length}/300`; });
  const kinds = h('div', { class: 'sg-kinds', role: 'radiogroup', 'aria-label': '건의 종류' });
  const drawKinds = () => kinds.replaceChildren(...Object.entries(FB_KIND).map(([k, [ic, label]]) => h('button', {
    class: 'sg-kind', type: 'button', role: 'radio', 'aria-checked': String(kind === k), onclick: () => { kind = k; drawKinds(); },
  }, h('span', { 'aria-hidden': 'true' }, ic), label)));
  drawKinds();
  const mine = h('div', { class: 'sg-mine' }, h('p', { class: 'note' }, '내가 쓴 건의를 불러오는 중…'));
  const send = h('button', { class: 'btn btn-go', type: 'button', onclick: async () => {
    if (sending) return;
    const body = text.value.trim();
    if ([...body].length < 2) { toast('두 글자 넘게 써 주세요.', 2200); return; }
    sending = true;
    send.disabled = true;
    try {
      await rpc('kids_feedback_send', { p_token: token(), p_kind: kind, p_body: body });
      sfx.success();
      toast('건의함에 넣었어요! 들려줘서 고마워요.', 2800);
      text.value = '';
      count.textContent = '0/300';
      loadMine();
    } catch (e) {
      if (e.code === 'SESSION') { sessionLost(); return; }
      toast(message(e), 3000);
    } finally { sending = false; send.disabled = false; }
  } }, '건의함에 넣기');
  const loadMine = async () => {
    let list = [];
    try { list = await rpc('kids_feedback_mine', { p_token: token() }); } catch (e) { mine.replaceChildren(h('p', { class: 'note' }, '내가 쓴 건의를 불러오지 못했어요.')); return; }
    if (!list.length) { mine.replaceChildren(); return; }
    mine.replaceChildren(h('h3', {}, '내가 쓴 건의'), ...list.map((f) => h('div', { class: 'sg-item' + (f.new_reply ? ' new' : '') },
      h('div', { class: 'sg-head' }, h('span', {}, (FB_KIND[f.kind] || FB_KIND.etc).join(' ')), h('span', { class: 'sg-status ' + f.status }, FB_STATUS[f.status] || ''), h('small', {}, dayText(f.at))),
      h('p', {}, f.body),
      f.reply ? h('p', { class: 'sg-reply' }, h('b', {}, '선생님: '), f.reply) : null)));
  };
  openSheet('마을 건의함', h('div', { class: 'talk sg' },
    h('p', {}, '진숲 마을을 더 좋게 만들 생각이 있나요? 바라는 것이나 고쳐야 할 곳을 적어 주세요.'),
    h('p', { class: 'note' }, `건의함에 넣은 글은 선생님만 읽어요. 친구들에게는 보이지 않아요. 하루에 ${state.features.gift ? '열' : '다섯'} 번까지 넣을 수 있어요.`),
    kinds, text, h('div', { class: 'row end' }, count, send), mine), 'talk-sheet');
  loadMine();
}
function dayText(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
// 선생님이 내 건의에 답을 달았으면 마을에 들어올 때 알려 준다
async function checkFeedbackReply() {
  if (!state.features.feedback) return;
  try {
    const list = await rpc('kids_feedback_mine', { p_token: token(), p_peek: true });
    if (list.some((f) => f.new_reply)) {
      notices.unshift(['숲지기 솔: 네 건의에 선생님이 답해 주셨어! 내 옆 마을 건의함에서 볼 수 있어.', 5600, null]);
      if (!noticeOn) { noticeOn = true; setTimeout(nextNotice, 2500); }
    }
  } catch (e) { /* 다음에 */ }
}

function openBoard() {
  const cur = memory.current();
  const t = state.today || {};
  openSheet('마을 게시판', h('div', { class: 'mem' },
    t.theme ? h('p', { class: 'board-theme' }, h('span', { class: 'tag' }, '이번 주 이야기'), ' ', t.theme) : null,
    cur ? memory.verseCard(cur) : h('div', { class: 'empty' }, h('p', { class: 'empty-big' }, '이번 주 말씀이 곧 올라와요.')),
    h('div', { class: 'board-todo' },
      t.qt ? h('button', { class: 'todo', type: 'button', onclick: () => { modal.close(); openHouse(() => qt.open()); } },
        h('b', {}, '오늘 묵상'), h('span', {}, `${t.qt.title}${t.qt_streak >= 2 ? ` · ${t.qt_streak}일째` : ''}`), h('em', {}, t.qt.done ? '마침' : '아직')) : null,
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
  const wardrobe = !!state.features.wardrobe;
  const shop = wardrobe ? await loadShop() : null;
  let result = await maker.open({ avatar: me.avatar || defaultAvatar(), name: me.village_name || '', first,
    shop: { on: wardrobe, owned: (shop && shop.items) || {}, prices: (shop && shop.prices) || {} } });
  while (result) {
    try {
      const pet = state.me && state.me.pet, pets = state.me && state.me.pets;
      state.me = await rpc('kids_save_avatar', { p_token: token(), p_avatar: result.avatar, p_village_name: result.name });
      if (state.me && !('pet' in state.me)) { state.me.pet = pet; state.me.pets = pets; } else takeMyPets(state.me);
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
    village.setMyName(state.me.village_name, state.me.teacher);
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
  if (homeUI && village.atHome) { try { await homeUI.exit(); } catch (e) { /* 그대로 나간다 */ } }
  try { await rpc('kids_logout', { p_token: token() }); } catch (e) { /* 이미 끊겼어도 괜찮다 */ }
  state.token = null;
  state.me = null;
  store.del('token');
  setRain(0);
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
