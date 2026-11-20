// 진숲 어린이 마을 — 긴 줄 함께 넘기 (필사 도서관 옆 잔디밭)
// 마을 친구 둘(하랑, 다온)이 양 끝에서 긴 줄을 돌리고, 아이들이 줄 안에 나란히 서서 같이 뛴다(여섯 명까지, 혼자 연습도 된다).
// 잔디밭이나 줄 돌리는 친구를 누르면 들어간다. 열린 방이 있으면 그 방에 들어가도 되는지 방장에게 묻고, 없으면 내가 방장이 된다.
// 방장이 '시작'을 누르면 2.4초 뒤 땅에 있던 줄이 뒤로 올라가 머리 위를 지나 앞으로 내려온다.
// 줄이 발밑을 지날 때 몸이 떠 있으면 넘는다(뛰는 높이와 시간은 혼자 하는 줄넘기와 같다). 한 바퀴는 1.4초에서 넘을 때마다 0.01초씩 빨라져 0.8초까지.
// 한 명이라도 걸리면 끝나고, 모두 함께 넘은 수가 모둠 기록이다. 아이마다 자기 화면에서 자기가 넘었는지 보고,
// 걸린 아이는 몇 번째에 걸렸는지 방장에게 알린다. 방장은 잠깐(0.9초) 기다렸다가 가장 먼저 걸린 수로 끝을 알린다.
// 두 명 이상이 함께 넘었으면 방장이 서버(kids_jr_team_save)에 모둠 기록을 보낸다. 열매는 주지 않는다.
// 방 알림(lrope)과 들어가기(lj, ljr)는 마을 채널로, 방 안 이야기(L 자리, S 시작, X 걸림, E 끝, R 기록)는 방 채널(hub)로 한다.
// 방에 없는 친구 화면에서도 줄이 같이 돌고, 뛰는 친구는 줄에 맞춰 폴짝 뛴다(방장이 알려 준 '돌기 시작한 지 몇 초'로 맞춘다).
import * as THREE from './three.module.min.js';
import { Avatar, toon } from './avatar.js';
import { normalizeAvatar, drawFaceIcon } from './face.js';
import { h, modal, josa, confetti } from './ui.js';
import { message } from './api.js';
import { sfx } from './sound.js';
import { JR, dialSvg, onRing } from './jumprope.js';
import { friendPicker } from './play.js';

// 자리: x, z 잔디밭 가운데, rot 돌린 각도 (줄은 이 자리의 x축을 따라 놓이고, 뛰는 아이들은 +z 쪽을 본다)
// half 가운데에서 줄 돌리는 친구까지, hand 손 높이, up 줄이 머리 위로 올라가는 높이, down 아래로 내려가는 깊이(땅에서 멈춘다), depth 앞뒤로 휘는 폭
export const LR = { x: 12.6, z: -5.2, rot: 0, half: 4.2, up: 1.95, down: 1.7, depth: 1.25, P0: 1.4, PMIN: 0.8, STEP: 0.01, max: 6, delay: 2.4, wait: 0.9 };
const SLOT_X = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5]; // 뛰는 자리 (방장이 0번, 1m씩 떨어져 선다)
const TAU = Math.PI * 2;
const REST = Math.PI + Math.PI / 3; // 쉬는 동안 줄은 뛰는 아이들 발뒤꿈치 뒤 땅에
const CLEAR_H = JR.H * JR.CLEAR;
const ROPE_C = '#5BB6F0';
const TURNERS = [
  { name: '하랑', av: { skin: 1, eyes: 'smile', eyeColor: 0, brows: 'soft', nose: 'button', mouth: 'grin', cheek: 'pink', hair: 'short', hairColor: 1,
    outfit: 'sporty', outfitColor: 2, bottom: 'jogger', bottomColor: 1, shoeColor: 3 } },
  { name: '다온', av: { skin: 0, eyes: 'big', eyeColor: 1, brows: 'arch', nose: 'dot', mouth: 'cat', cheek: 'peach', hair: 'ponytail', hairColor: 3,
    outfit: 'stripe', outfitColor: 5, bottom: 'shorts', bottomColor: 4, shoeColor: 1 } },
];

// 줄이 k번째로 발밑을 지나는 때 (돌기 시작한 뒤 초). 처음 땅에서 올라가 한 번 지나기까지는 첫 바퀴의 5/6
const PT = [];
export function passTime(k) {
  while (PT.length <= k) {
    const j = PT.length;
    PT.push(j === 0 ? (5 / 6) * LR.P0 : PT[j - 1] + Math.max(LR.PMIN, LR.P0 - j * LR.STEP));
  }
  return PT[k];
}
// 돌기 시작한 뒤 t초의 줄 각도 (0 머리 위, π/2 앞, π 발밑, 3π/2 뒤)
export function ropeAngle(t) {
  if (t == null || t <= 0) return REST;
  let lo = 0;
  while (passTime(lo) <= t) lo = lo ? lo * 2 : 1;
  let a = lo >> 1, b = lo; // passTime(b) > t
  while (a < b) { const m = (a + b) >> 1; if (passTime(m) > t) b = m; else a = m + 1; }
  const k = a;
  if (k === 0) return REST + ((5 * Math.PI) / 3) * (t / passTime(0));
  const p0 = passTime(k - 1), p1 = passTime(k);
  return 3 * Math.PI + TAU * (k - 1) + (TAU * (t - p0)) / (p1 - p0);
}
// 자리 기준 좌표 → 마을 좌표
function at(lx, lz) {
  const c = Math.cos(LR.rot), s = Math.sin(LR.rot);
  return { x: LR.x + lx * c + lz * s, z: LR.z - lx * s + lz * c };
}
const slotPos = (i) => at(SLOT_X[i] != null ? SLOT_X[i] : 0, 0);
const nowS = () => performance.now() / 1000;

export function createLongRope({ v, ui, begin, stopAll, portrait, rpc, getToken, lost, onCelebrate, features, hub, myId, getMe, getPerson, onlineFriends, sendNet, board, toast, setActivity }) {
  // ---------- 잔디밭: 안내판, 줄 돌리는 친구 둘, 긴 줄 ----------
  const root = new THREE.Group();
  root.position.set(LR.x, 0, LR.z);
  root.rotation.y = LR.rot;
  v.scene.add(root);
  {
    const sg = v.postSign('🪢 긴 줄넘기', 1.7);
    v.spot('jrlong', '긴 줄넘기', sg, { ...at(-1.3, -2.4), rot: LR.rot, door: 3.6 }); // 안내판은 뛰는 자리 뒤쪽, 누르면 뛰는 자리 앞으로 간다
  }
  const turners = TURNERS.map((t, i) => {
    const av = new Avatar(normalizeAvatar(t.av));
    av.root.traverse((m) => { if (m.isMesh) m.userData.pick = null; });
    av.root.position.set(i ? LR.half + 0.35 : -LR.half - 0.35, 0, 0);
    av.root.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; // 서로 마주 본다
    root.add(av.root);
    const tag = v.makeLabel(`🌱 ${t.name}`, 'kv-tag kv-npc');
    const p = at(i ? LR.half + 0.35 : -LR.half - 0.35, 0);
    v.addObstacleCircle(p.x, p.z, 0.45);
    return { av, tag };
  });
  root.userData.pick = { type: 'building', id: 'jrlong' };
  v.pickRoots.push(root);
  const ropeMat = toon(ROPE_C);
  const pts = Array.from({ length: 25 }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts);
  let tube = null;
  const hl = new THREE.Vector3(), hr = new THREE.Vector3();
  // 줄 돌리는 팔: 줄 쪽으로 뻗은 팔의 손이 줄과 같이 작은 원을 그린다
  function turnerPose(av, theta, side) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const arm = av.arms[1];
    arm.rotation.x = -1.25 + 0.3 * c;
    arm.rotation.z = 0.15 + side * 0.28 * s;
    av.arms[0].rotation.x = -0.2; av.arms[0].rotation.z = -0.2;
    av.body.rotation.x = 0.03;
  }
  function drawRope(theta) {
    turners.forEach((t, i) => turnerPose(t.av, theta, i ? 1 : -1));
    root.updateMatrixWorld(true);
    for (const [k, out] of [[0, hl], [1, hr]]) {
      const av = turners[k].av;
      av.root.updateMatrixWorld(true);
      out.set(0, -0.57, 0.03);
      av.arms[1].localToWorld(out);
      root.worldToLocal(out);
    }
    const c = Math.cos(theta), s = Math.sin(theta), n = pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const k = i / n, b = Math.pow(Math.sin(Math.PI * k), 0.7);
      const p = pts[i];
      p.lerpVectors(hl, hr, k);
      p.y += b * c * (c >= 0 ? LR.up : LR.down);
      p.z += b * s * LR.depth;
      if (p.y < 0.02) p.y = 0.02;
    }
    const geo = new THREE.TubeGeometry(curve, 64, 0.025, 6, false);
    if (!tube) { tube = new THREE.Mesh(geo, ropeMat); tube.castShadow = true; root.add(tube); } else { tube.geometry.dispose(); tube.geometry = geo; }
  }

  // ---------- 상태 ----------
  // R: 내가 든 방. slots: 자리마다 아이 번호(없으면 ''), phase: lobby 모이는 중 · count 곧 시작 · run 도는 중 · end 끝
  let R = null;
  let ad = null; // 다른 아이가 연 방 알림 { g, host, n, m, s, at, t0 }
  let joining = null;
  let adTimer = 0;
  const me = () => (myId ? myId() : null);
  const nameOf = (id) => (id === me() ? '나' : ((getPerson && getPerson(id)) || {}).name || '친구');
  const mySlot = () => (R ? R.slots.indexOf(me()) : -1);
  const players = () => (R ? R.slots.filter(Boolean) : []);
  // 지금 줄이 돌기 시작한 지 몇 초인지 (돌지 않으면 null)
  function ropeT() {
    if (R) return R.phase === 'count' || R.phase === 'run' ? nowS() - R.t0 : null;
    if (ad && ad.s === 1 && nowS() - ad.at < 12) return nowS() - ad.t0;
    return null;
  }

  // ---------- 매 화면 ----------
  let lastTheta = null;
  v.tickers = v.tickers || [];
  v.tickers.push((dt) => {
    const t = ropeT();
    const theta = R && R.phase === 'end' ? R.stopTheta : t == null ? REST : ropeAngle(t);
    for (const tr of turners) {
      tr.av.update(dt);
      const wp = new THREE.Vector3();
      tr.av.root.getWorldPosition(wp);
      wp.y = 2.0;
      if (v.atHome || wp.distanceTo(v.camera.position) > 45) tr.tag.style.display = 'none'; // 집 안이나 멀리서는 이름표를 감춘다
      else v.placeLabel(tr.tag, wp, 0);
    }
    if (theta !== lastTheta || !tube) { drawRope(theta); lastTheta = theta; }
    if (R) tick();
  });

  // ---------- 화면 (방에 있을 때) ----------
  let game = null, panel = null, big = null, sub = null, roster = null, dot = null, zone = null;
  let curH = 0, trip = 0;
  function buildPanel() {
    const dial = h('div', { class: 'jr-dial' });
    dial.innerHTML = dialSvg();
    zone = dial.querySelector('.jr-zone'); dot = dial.querySelector('.jr-dot');
    big = h('b', { class: 'jr-count' }, '0');
    sub = h('span', { class: 'jr-sub' }, '');
    roster = h('div', { class: 'lr-roster' });
    panel = h('div', { class: 'jr-panel lr-panel' }, dial, h('div', { class: 'jr-num' }, h('span', { class: 'jr-unit lr-lead' }, '함께'), big, h('span', { class: 'jr-unit' }, '번'), sub), roster);
    ui.setPanel(panel);
  }
  function drawDial(theta) {
    if (!dot) return;
    const a = ((theta % TAU) + TAU) % TAU;
    dot.setAttribute('transform', `rotate(${((a * 180) / Math.PI).toFixed(1)})`);
    const t = ropeT();
    let k = 0;
    if (t != null && t > 0) while (passTime(k) <= t) k++;
    const per = k ? passTime(k) - passTime(k - 1) : LR.P0;
    const w = TAU / per;
    const a1 = Math.PI - Math.min(Math.PI * 0.95, w * 0.33), a2 = Math.PI - w * 0.07;
    zone.setAttribute('d', `M ${onRing(a1, 40)} A 40 40 0 0 1 ${onRing(a2, 40)}`);
  }
  function drawRoster() {
    if (!roster) return;
    const out = R.phase === 'end' && R.result ? new Set(R.result.w) : new Set();
    roster.replaceChildren(...R.slots.map((id, i) => {
      if (!id) return null;
      const cv = h('canvas', { width: 40, height: 40, class: 'lr-face', 'aria-hidden': 'true' });
      const p = id === me() ? getMe && getMe() : getPerson && getPerson(id);
      drawFaceIcon(cv, normalizeAvatar(p && p.avatar));
      return h('span', { class: 'lr-chip' + (out.has(id) ? ' out' : '') + (id === me() ? ' me' : '') }, cv, `${id === me() ? '나' : nameOf(id)}${i === 0 ? ' 👑' : ''}${out.has(id) ? ' 💥' : ''}`);
    }).filter(Boolean));
    sub.textContent = `${players().length}명${R.host ? ' · 내가 방장' : ''}`;
  }
  function drawMain() {
    if (!game) return;
    if (R.phase === 'count' || R.phase === 'run') {
      if (R.my.out) ui.setMain('…', { disabled: true });
      else ui.setMain('뛰기!', { onClick: () => {} }); // 누르는 순간(pointerdown)에 뛴다
    } else if (R.host) {
      ui.setMain(R.phase === 'end' ? '…' : R.played ? '다시 하기' : '시작', { pulse: R.phase === 'lobby', disabled: R.phase === 'end', onClick: () => startRound() });
    } else ui.setMain('기다리는 중', { disabled: true });
  }
  function sayLobby() {
    if (R.host) ui.say(players().length > 1 ? `모두 ${players().length}명이에요. ‘시작’을 누르면 함께 뛰어요!` : '‘친구 부르기’로 친구를 부르거나 혼자 연습해요. 줄이 발밑에 오기 조금 전에 뛰어요.');
    else ui.say(`${nameOf(R.slots[0])} 방장이 ‘시작’을 누르면 줄이 돌아요. 줄이 발밑에 오기 조금 전에 뛰어요!`);
  }
  function placeMe() {
    const i = mySlot();
    if (i < 0 || !v.player) return;
    const p = slotPos(i);
    v.placePlayer(p.x, p.z, LR.rot);
  }

  // ---------- 방 열기, 들어가기 ----------
  function enterGame() {
    stopAll();
    const pl = v.player;
    if (pl) pl.drop();
    // 앞쪽 높은 곳에서 내려다본다 (앞 오른쪽 열매 가게 지붕과 왼쪽 가로등에 가리지 않게). 휴대폰(세로)은 더 멀리서
    const far = portrait() ? 1.7 : 1;
    const C = at(0, 8.8 * far), L = at(0, 1.2);
    game = { cam: { pos: new THREE.Vector3(C.x, 10.4 * far, C.z), look: new THREE.Vector3(L.x, 0.4, L.z) }, camSpeed: 3 };
    game.update = () => {};
    game.onTap = () => hop();
    game.onExit = () => stopAll();
    game.stop = () => leave();
    game.debug = () => ({ phase: R && R.phase, slots: R && R.slots, host: R && R.host, my: R && R.my, result: R && R.result, t: ropeT(), played: R && R.played });
    const side = R.host ? [['leaf', '친구 부르기', () => pickFriend()]] : [];
    begin('jrteam', '긴 줄넘기', game, side, Math.max(0, mySlot()), [['star', '기록판', () => board()]]);
    if (pl) pl.pose = myPose;
    buildPanel();
    drawRoster(); drawMain(); sayLobby();
    placeMe();
    window.addEventListener('keydown', kd);
    ui.main.addEventListener('pointerdown', onMainDown);
  }
  const onMainDown = (e) => { if (R && (R.phase === 'count' || R.phase === 'run')) { e.preventDefault(); hop(); } };
  const kd = (e) => {
    if (e.repeat || !R) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
      e.preventDefault();
      if (R.phase === 'count' || R.phase === 'run') hop();
      else if (R.host && R.phase === 'lobby') startRound();
    }
  };
  function bind(room) {
    room.on('msg', (m, from) => onRoomMsg(m, from));
    room.on('left', (id) => onLeft(id));
  }
  function open() {
    if (!hub) return;
    const room = hub.openRoom('jrteam', null);
    R = { room, host: true, slots: [me(), '', '', '', '', ''], phase: 'lobby', my: null, played: false };
    bind(room);
    enterGame();
    advertise();
    clearInterval(adTimer);
    adTimer = setInterval(() => advertise(), 4000);
  }
  // 친구가 부른 방에 들어간다 (초대 카드에서 '좋아!')
  function join(session) {
    if (R) leave();
    R = { room: session, host: false, slots: [session.hostId, me(), '', '', '', ''], phase: 'lobby', my: null, played: false };
    bind(session);
    enterGame();
  }
  function freshAd() { return ad && nowS() - ad.at < 40 && getPerson && getPerson(ad.host) && ad.s !== 2 ? ad : null; }
  function enter() {
    if (R) { sayLobby(); return; }
    if (!features().jr2) { toast('긴 줄넘기는 곧 열려요! 조금만 기다려 줘요.', 2600); return; }
    const a = freshAd();
    if (a && a.host !== me()) { requestJoin(a); return; }
    open();
  }
  function requestJoin(a) {
    if (joining || !sendNet) return;
    joining = { g: a.g, host: a.host, timer: setTimeout(() => { if (joining && joining.g === a.g) { joining = null; toast('방장이 대답이 없어요. 조금 뒤에 다시 눌러요.', 2600); } }, 9000) };
    sendNet('lj', { to: a.host, g: a.g });
    toast(`${josa(nameOf(a.host), '이가', '가')} 연 긴 줄넘기에 들어가도 되는지 물어보는 중이에요…`, 2400);
  }
  function onJoinAsk(from, g) {
    const reply = (ok, b = 0) => sendNet && sendNet('ljr', { to: from, g, ok, b });
    if (!R || !R.host || R.room.gid !== g) { reply(false, 2); return; }
    if (R.slots.includes(from)) { reply(true); return; }
    if (R.phase === 'count' || R.phase === 'run') { reply(false, 3); return; }
    const i = R.slots.indexOf('');
    if (i < 0) { reply(false, 1); return; }
    R.slots[i] = from;
    R.room.members.add(from);
    reply(true);
    sfx.ding();
    toast(`${josa(nameOf(from), '이가', '가')} 긴 줄넘기에 들어왔어요!`, 2400);
    sendRoster();
  }
  function onJoinReply(from, p) {
    if (!joining || joining.g !== p.g || joining.host !== from) return;
    clearTimeout(joining.timer);
    joining = null;
    if (!p.ok) {
      if (p.b === 2) ad = null;
      toast(p.b === 1 ? `긴 줄넘기가 꽉 찼어요 (${LR.max}명까지).` : p.b === 3 ? '지금 줄을 돌리는 중이에요. 줄이 멈추면 다시 눌러요.' : '그 방은 벌써 닫혔어요. 다시 누르면 새로 열어요.', 2800);
      return;
    }
    if (R || !hub) return;
    const room = hub.joinRoom(p.g, 'jrteam', from);
    R = { room, host: false, slots: [from, me(), '', '', '', ''], phase: 'lobby', my: null, played: false };
    bind(room);
    enterGame();
  }
  // 방장이 친구를 부른다
  function pickFriend() {
    if (!R || !R.host) return;
    if (R.phase !== 'lobby') { toast('줄이 멈추면 친구를 부를 수 있어요.', 2200); return; }
    const inRoom = new Set(players());
    const list = (onlineFriends ? onlineFriends() : []).filter((f) => f && !inRoom.has(f.id));
    modal.open('긴 줄넘기에 친구 부르기', h('div', { class: 'talk' }, h('p', {}, '누구를 부를까요? (여섯 명까지)'), friendPicker(list, (f) => { modal.close(); invite(f); })), { cls: 'game-sheet' });
  }
  async function invite(f) {
    if (!R || !R.host) return;
    if (!R.slots.includes('')) { toast(`${LR.max}명까지 함께 뛸 수 있어요.`, 2400); return; }
    toast(`${josa(f.name, '을', '를')} 부르는 중이에요…`, 2000);
    const r = await R.room.invite(f.id);
    if (!R || !R.host) return;
    if (r.ok) {
      if (!R.slots.includes(f.id)) { const i = R.slots.indexOf(''); if (i >= 0) R.slots[i] = f.id; }
      sfx.ding();
      toast(`${josa(f.name, '이가', '가')} 왔어요!`, 2000);
      sendRoster();
    } else {
      const why = { busy: `${josa(f.name, '은', '는')} 지금 다른 놀이를 하고 있어요.`, no: `${josa(f.name, '이', '가')} 다음에 하재요.`, timeout: `${josa(f.name, '이', '가')} 대답이 없어요.`, off: '지금은 친구와 연결되지 않아요.' }[r.reason];
      if (why) toast(why, 2600);
    }
  }
  function sendRoster() {
    if (!R || !R.host) return;
    R.room.send('L', { sl: R.slots });
    drawRoster(); sayLobby();
    advertise();
  }
  function advertise() {
    if (!R || !R.host || !sendNet) return;
    const s = R.phase === 'count' || R.phase === 'run' ? 1 : 0;
    const e = s === 1 ? Math.round((nowS() - R.t0) * 100) / 100 : 0;
    sendNet('lrope', { g: R.room.gid, n: players().length, m: LR.max, s, e });
  }

  // ---------- 한 판 ----------
  function startRound() {
    if (!R || !R.host || R.phase !== 'lobby') return;
    R.room.send('S', { d: LR.delay });
    beginRound(LR.delay);
    advertise();
  }
  function beginRound(d) {
    R.phase = 'count';
    R.t0 = nowS() + d;
    R.my = { n: 0, k: 0, out: false, tj: -9 };
    R.fails = new Map();
    R.result = null;
    R.played = true;
    R.round = players(); // 이번 판을 같이 뛴 아이들
    big.textContent = '0';
    drawRoster(); drawMain();
    ui.say('준비! 줄이 뒤에서 올라와 머리 위를 지나 앞으로 내려와요.');
    ui.banner('준비!', R.round.length > 1 ? `${R.round.length}명이 함께 뛰어요` : '혼자 연습해요', 1400);
    sfx.pop(true);
  }
  function hop() {
    if (!R || !R.my || R.my.out || (R.phase !== 'count' && R.phase !== 'run')) return;
    const t = nowS() - R.t0;
    if (t - R.my.tj < JR.AIR) return;
    R.my.tj = t;
    sfx.hop();
  }
  const hgtAt = (t) => { const tau = t - (R ? R.my.tj : -9); return tau >= 0 && tau <= JR.AIR ? JR.H * Math.sin((Math.PI * tau) / JR.AIR) : 0; };
  function tick() {
    const t = ropeT();
    if (R.phase === 'count' && t != null && t >= 0) { R.phase = 'run'; ui.say('뛰어요! 줄이 발밑에 오기 조금 전에 ‘뛰기’!'); advertise(); }
    if (R.phase === 'run' && R.my && !R.my.out) {
      while (passTime(R.my.k) <= t) {
        const tp = passTime(R.my.k);
        if (hgtAt(tp) >= CLEAR_H) {
          R.my.k++; R.my.n++;
          big.textContent = String(R.my.n);
          big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump');
          sfx.tick();
          if (R.my.n % 10 === 0) { sfx.ding(); ui.banner(`${R.my.n}번!`, '모두 잘하고 있어요!', 900); }
        } else {
          R.my.out = true;
          trip = 0;
          sfx.bonk();
          ui.say('줄에 걸렸어요! 잠깐만요…');
          drawMain();
          if (R.host) failed(me(), R.my.k); else R.room.send('X', { k: R.my.k });
          break;
        }
      }
    }
    const theta = R.phase === 'end' ? R.stopTheta : t == null ? REST : ropeAngle(t);
    drawDial(theta);
    curH = R.my && !R.my.out && (R.phase === 'run' || R.phase === 'count') && t != null ? hgtAt(t) : 0;
    if (R.my && R.my.out) trip = Math.min(1, trip + 0.05);
  }
  // 방장: 누가 몇 번째에 걸렸는지 모은다
  function failed(id, k) {
    if (!R || !R.host || (R.phase !== 'run' && R.phase !== 'count')) return;
    if (!R.fails.has(id) || R.fails.get(id) > k) R.fails.set(id, k);
    if (!R.endTimer) R.endTimer = setTimeout(() => { R && (R.endTimer = 0); finalize(); }, LR.wait * 1000);
  }
  function finalize() {
    if (!R || !R.host || !R.fails.size) return;
    const n = Math.min(...R.fails.values());
    const w = [...R.fails].filter(([, k]) => k === n).map(([id]) => id);
    R.room.send('E', { n, w });
    onEnd(n, w);
  }
  async function onEnd(n, w) {
    if (!R || R.phase === 'end' || R.phase === 'lobby') return;
    R.stopTheta = REST;
    R.phase = 'end';
    R.result = { n, w };
    if (R.endTimer) { clearTimeout(R.endTimer); R.endTimer = 0; }
    big.textContent = String(n);
    drawRoster(); drawMain();
    for (const id of w) if (id !== me() && v.say) v.say(id, '앗!');
    const who = w.map((id) => (id === me() ? '내가' : josa(nameOf(id), '이가', '가'))).join(', ');
    const many = R.round.length > 1;
    ui.banner(many ? `모두 함께 ${n}번!` : `${n}번 넘었어요!`, w.length ? `${who} 걸렸어요` : '', 2800);
    ui.say(many ? `모두 함께 ${n}번 넘었어요! ${R.host ? '‘다시 하기’로 한 번 더 해요.' : '방장이 다시 시작하기를 기다려요.'}` : '줄이 발밑에 오기 조금 전에 뛰어요. ‘다시 하기’로 한 번 더 해요.');
    advertise();
    // 모둠 기록 (두 명 이상, 방장만 보낸다)
    if (R.host && many && n > 0 && features().jr2) {
      const ids = R.round;
      try {
        const r = await rpc('kids_jr_team_save', { p_token: getToken(), p_count: n, p_ms: Math.round(passTime(n) * 1000), p_members: ids });
        if (R && r) {
          R.room.send('R', { tt: r.today_top ? 1 : 0, at: r.all_top ? 1 : 0, b: Number.isInteger(r.best) ? r.best : 0 });
          celebrate(r.today_top, r.all_top);
        }
      } catch (e) { if (!lost(e) && R) toast(message(e), 2600); }
    }
    setTimeout(() => {
      if (!R || R.phase !== 'end') return;
      R.phase = 'lobby';
      R.my = null;
      drawRoster(); drawMain(); sayLobby();
    }, 2600);
  }
  function celebrate(today, all) {
    if (!today && !all) return;
    confetti(); onCelebrate();
    if (v.player) v.player.celebrate();
    ui.banner(all ? '최고 모둠 기록!' : '오늘의 모둠 1등!', all ? '지금까지 가장 많이 함께 넘었어요' : '오늘 가장 많이 함께 넘었어요', 2600);
  }

  // ---------- 방 이야기 ----------
  function onRoomMsg(m, from) {
    if (!R) return;
    if (m.t === 'L' && !R.host && from === R.room.hostId && Array.isArray(m.sl)) {
      R.slots = m.sl.slice(0, LR.max).map((x) => (typeof x === 'string' ? x : ''));
      while (R.slots.length < LR.max) R.slots.push('');
      if (!R.slots.includes(me())) { toast('방장이 자리를 정리했어요.', 2000); stopAll(); return; }
      placeMe();
      if (setActivity && mySlot() >= 0) setActivity('jrteam', mySlot()); // 친구 화면에서도 내 자리에 서게
      drawRoster(); sayLobby();
    } else if (m.t === 'S' && !R.host && from === R.room.hostId && R.phase === 'lobby') {
      beginRound(Math.max(0.6, Math.min(4, Number(m.d) || LR.delay)));
    } else if (m.t === 'X' && R.host && Number.isInteger(m.k) && m.k >= 0) {
      failed(from, m.k);
    } else if (m.t === 'E' && !R.host && from === R.room.hostId && Number.isInteger(m.n)) {
      onEnd(m.n, Array.isArray(m.w) ? m.w.filter((x) => typeof x === 'string') : []);
    } else if (m.t === 'R' && !R.host && from === R.room.hostId) {
      celebrate(m.tt === 1, m.at === 1);
    }
  }
  function onLeft(id) {
    if (!R) return;
    if (!R.host && id === R.room.hostId) { toast('방장이 나가서 긴 줄넘기가 끝났어요.', 2600); stopAll(); return; }
    if (R.host) {
      const i = R.slots.indexOf(id);
      if (i > 0) { R.slots[i] = ''; toast(`${josa(nameOf(id), '이가', '가')} 나갔어요.`, 2000); sendRoster(); }
      if (R.fails) R.fails.delete(id);
    }
  }
  // ---------- 나가기 ----------
  function leave() {
    if (!R) return;
    const r = R;
    R = null;
    clearInterval(adTimer); adTimer = 0;
    if (r.endTimer) clearTimeout(r.endTimer);
    if (r.host && sendNet) sendNet('lrope', { g: r.room.gid, n: 0, m: LR.max, s: 2, e: 0 });
    try { r.room.close(); } catch (e) { /* 무시 */ }
    window.removeEventListener('keydown', kd);
    if (ui.main) ui.main.removeEventListener('pointerdown', onMainDown);
    const pl = v.player;
    if (pl) { pl.pose = null; pl.body.position.y = 0; pl.body.rotation.x = 0; }
    // 줄 밖(앞쪽)으로 나와 선다
    const p = at(SLOT_X[Math.max(0, r.slots.indexOf(me()))] || 0, 2.4);
    if (pl) v.placePlayer(p.x, p.z, LR.rot + Math.PI);
    game = null; panel = null; dot = null; zone = null;
  }
  // 내 자세: 두 발을 모으고 팔은 살짝 벌린다. 뛰면 무릎을 굽힌다. 걸리면 휘청
  function myPose(a) {
    a.arms[0].rotation.x = a.arms[1].rotation.x = -0.25;
    a.arms[0].rotation.z = -0.35; a.arms[1].rotation.z = 0.35;
    a.body.position.y = curH;
    a.legs[0].rotation.x = a.legs[1].rotation.x = -0.25 * (curH / JR.H);
    a.body.rotation.x = R && R.my && R.my.out ? 0.25 * Math.sin(Math.min(1, trip) * Math.PI) : 0.02;
  }

  // ---------- 마을 채널 ----------
  function onNet(type, from, p) {
    if (type === 'lrope') {
      if (p.s === 2) { if (ad && ad.g === p.g) ad = null; return; }
      ad = { g: p.g, host: from, n: p.n, m: p.m, s: p.s, at: nowS(), t0: nowS() - (p.s === 1 ? p.e + 0.1 : 0) };
    } else if (type === 'lj') onJoinAsk(from, p.g);
    else if (type === 'ljr') onJoinReply(from, p);
  }
  function peerLeft(id) {
    if (ad && ad.host === id) ad = null;
    if (joining && joining.host === id) { clearTimeout(joining.timer); joining = null; }
  }

  // ---------- 친구 화면: 줄 안에서 뛰는 친구 ----------
  // 친구가 알려 준 자리(놀이 소식의 자리 번호)에 세우고, 줄이 발밑을 지날 때마다 폴짝 뛰게 한다
  function decorate(r) {
    const i = Number.isInteger(r.actSeat) && r.actSeat >= 0 && r.actSeat < LR.max ? r.actSeat : 0;
    const p = slotPos(i);
    const pose = (a) => {
      a.arms[0].rotation.x = a.arms[1].rotation.x = -0.25;
      a.arms[0].rotation.z = -0.35; a.arms[1].rotation.z = 0.35;
      const t = ropeT();
      let y = 0;
      if (t != null && t > 0 && !(R && R.phase === 'end')) {
        let k = 0;
        while (passTime(k) < t - 0.2) k++;
        const tau = t - (passTime(k) - 0.2);
        if (tau >= 0 && tau <= JR.AIR) y = JR.H * Math.sin((Math.PI * tau) / JR.AIR);
      }
      a.body.position.y = y;
      a.legs[0].rotation.x = a.legs[1].rotation.x = -0.25 * (y / JR.H);
    };
    v.pinRemote(r.id, { x: p.x, y: 0, z: p.z, rot: LR.rot, pose, auto: true, kind: 'jrteam' });
  }

  return {
    enter, join, onNet, peerLeft, decorate,
    get active() { return !!R; },
    debug: () => ({ R: R && { phase: R.phase, slots: R.slots, host: R.host, my: R.my, result: R.result, gid: R.room && R.room.gid }, ad, t: ropeT() }),
  };
}
