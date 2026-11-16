// 진숲 어린이 마을 — 숨바꼭질 (숨바꼭질 섬의 술래 나무)
// 술래가 술래 나무에서 눈을 가리고 30초를 세는 동안('꼭꼭 숨어라 머리카락 보일라') 나머지는 숨을 곳 47군데 가운데 한 곳에 숨는다(한 곳에 한 명).
// 그다음 2분 동안 술래가 숨을 곳 앞으로 가서 찾아본다(한 번 찾아보면 3.5초 쉰다). 찾은 친구는 술래와 같이 찾는다.
// 찾는 시간이 4분의 3 지나면 10~14초마다 부스럭 소리가 난다(절반은 아무도 없는 곳에서 나는 가짜 소리). 모두 찾으면 술래가,
// 시간이 다 되거나 술래가 '못 찾겠다 꾀꼬리'를 외치면 끝까지 숨은 친구가 이긴다(이기면 열매 1개, 하루 3개까지: 서버 kids_hs_win). 처음 찾은 친구가 다음 술래다.
// 혼자 하면 컴퓨터 친구(다람이, 콩이, 별이)와 하고, 친구와 하면 방을 연 사람(방장) 화면이 판을 정해 알린다.
// 방을 만들면 마을 모두에게 알린다(hroom). 술래 나무를 누른 친구는 열린 방 목록에서 '들어가기'를 눌러 초대 없이 들어온다(hj → hjr, 8명까지).
// 판이 진행 중일 때 들어온 친구는 기다렸다가 다음 판부터 같이 한다.
// 컴퓨터 친구는 숨은 곳을 모른다: 아직 찾아보지 않은 곳 가운데 가까운 곳을 고르고, 부스럭 소리가 나면 절반쯤 그리로 간다.
// 숨은 사람은 몸, 이름표, 말풍선, 애완동물이 모두 보이지 않는다(같이 하지 않는 친구 화면에서도: 하는 일 'hsh').
import * as THREE from './three.module.min.js';
import { Avatar } from './avatar.js';
import { normalizeAvatar, drawFaceIcon } from './face.js';
import { h, toast, josa, confetti } from './ui.js';
import { sfx } from './sound.js';
import { HS_SPOTS, HS_TREE, gatherPoint } from './hideisle.js';
import { regionOf } from './isles.js';
import { friendPicker } from './play.js';

export const HS_RULE = { hideSec: 30, seekSec: 120, checkSec: 3.5, max: 8, giveUpSec: 30, winMax: 3, rustleAt: 0.75, decoy: 0.5 };
// 컴퓨터 친구가 찾는 빠르기(m/초)와 두리번거리는 시간(ms), 숨은 친구를 못 보고 지나칠 확률, 부스럭 소리를 따라갈 확률
export const HS_CPU = { seekSpeed: 4.0, helpSpeed: 3.6, look: 800, think: [2700, 3400], miss: 0.1, follow: 0.5 };
// 컴퓨터 친구 셋 (숨바꼭질 섬에 놀러 오는 친구들)
export const HS_CPUS = [
  { name: '다람이', av: { skin: 1, eyes: 'big', eyeColor: 0, brows: 'soft', nose: 'button', mouth: 'grin', cheek: 'pink', hair: 'short', hairColor: 3,
    outfit: 'overall', outfitColor: 6, bottomColor: 2, shoeColor: 1, hat: 'cap', hatColor: 6 } },
  { name: '콩이', av: { skin: 2, eyes: 'smile', eyeColor: 1, brows: 'arch', nose: 'dot', mouth: 'cat', cheek: 'peach', hair: 'pigtails', hairColor: 1,
    outfit: 'stripe', outfitColor: 3, bottom: 'shorts', bottomColor: 4, shoeColor: 2, hat: 'ribbon', hatColor: 3 } },
  { name: '별이', av: { skin: 0, eyes: 'sparkle', eyeColor: 2, brows: 'brave', nose: 'round', mouth: 'teeth', cheek: 'freckle', hair: 'spiky', hairColor: 4,
    outfit: 'sporty', outfitColor: 8, bottom: 'jogger', bottomColor: 1, shoeColor: 4 } },
];
const CHANT = '꼭꼭 숨어라 머리카락 보일라';
const EMPTY = ['여기 없네!', '어디 있지?', '여기도 없어!', '음… 아니네!'];
// 술래가 눈을 가린 자세 (두 손을 얼굴로)
const coverEyes = (av) => {
  av.arms[0].rotation.x = av.arms[1].rotation.x = -2.15;
  av.arms[0].rotation.z = 0.62; av.arms[1].rotation.z = -0.62;
  if (av.head) av.head.rotation.x = 0.22;
};
const nowMs = () => performance.now();
// 이름 여럿에 조사 (하늘이, 다람이가)
const listJosa = (names, a, b) => (names.length > 1 ? `${names.slice(0, -1).join(', ')}, ${josa(names[names.length - 1], a, b)}` : josa(names[0] || '', a, b));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (sec) => { const s = Math.max(0, Math.ceil(sec)); return s >= 60 ? `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초` : `${s}초`; };
function turnTo(cur, want, k) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
// 방장 → 모두 (판 소식)과 모두 → 방장 (부탁)
const EVT = new Set(['L', 'G', 'H', 'U', 'S', 'C', 'R', 'E', 'N', 'X', 'Z', 'P']);
const REQ = new Set(['h', 'u', 't', 'g', 'q', 'j']);

export function createHideGame(o) {
  // o: { village, hub, rpc, getToken, getMe, getPerson, onlineFriends, setActivity, setScene, modal, playOpen, refreshToday, showLocked,
  //      onSessionLost, message, setFruits, features }
  const v = o.village;
  const isle = () => v.hideIsle;
  let G = null; // 지금 하는 숨바꼭질
  let lobby = null; // 방장 대기실 { seats, firstMe }
  let closingSheet = false;
  const rooms = new Map(); // 마을에 열린 숨바꼭질 방: gid → { host, n, m, s(0 모이는 중, 1 하는 중), at }
  let joining = null; // 들어가기를 물어보는 중 { g, host, timer }
  let menuRooms = null; // 술래 나무 창의 열린 방 목록 칸

  // ---------- 화면 조각 ----------
  const hud = h('div', { class: 'hs-hud', hidden: true, role: 'status', 'aria-live': 'polite' });
  const bar = h('div', { class: 'hs-bar', hidden: true });
  const cover = h('div', { class: 'hs-cover', hidden: true });
  const result = h('div', { class: 'hs-result', hidden: true });
  document.body.append(hud, bar, cover, result);
  v.tickers = v.tickers || [];
  v.tickers.push(() => tick());

  // ---------- 함께하는 사람 ----------
  const P = (pid) => (G ? G.players.find((p) => p.pid === pid) : null);
  const nameOf = (pid) => { const p = P(pid); return p ? p.name : '친구'; };
  const myId = () => { const me = o.getMe(); return me ? me.id : null; };
  const seekers = () => (G ? [G.seeker, ...G.found] : []);
  const isSeeker = (pid) => G && (pid === G.seeker || G.found.includes(pid));
  const hiddenLeft = () => (G ? G.hidden.size : 0);
  const hiders = () => (G ? G.players.filter((p) => p.pid !== G.seeker) : []);
  const spotTaken = (k) => G && [...G.hidden.values()].includes(k);
  // 보내는 모양: { p, c(컴퓨터 친구 번호) 또는 b(체험판 예시 친구) }
  const pack = (list = G.players) => list.map((p) => (p.kind === 'cpu' ? (p.bot ? { p: p.pid, b: 1 } : { p: p.pid, c: p.ci }) : { p: p.pid }));
  // 방에서 메시지를 받아야 하는 친구 (다음 판을 기다리는 친구도)
  const roomMembers = () => [...G.players, ...(G.queue || [])].filter((p) => p.kind === 'kid' && !p.bot && p.pid !== G.me).map((p) => p.pid);
  const seatCount = () => (lobby ? lobby.seats.length : G.players.length + (G.queue || []).length);
  function unpack(list) {
    if (!Array.isArray(list)) return null;
    const out = [];
    for (const x of list) {
      if (!x || typeof x.p !== 'string' || out.some((q) => q.pid === x.p)) continue;
      if (Number.isInteger(x.c) && HS_CPUS[x.c]) out.push({ pid: x.p, kind: 'cpu', ci: x.c, name: HS_CPUS[x.c].name, av: HS_CPUS[x.c].av });
      else {
        const person = o.getPerson(x.p) || (x.p === myId() ? o.getMe() : null);
        const name = person ? (person.name || person.village_name || '친구') : '친구';
        out.push({ pid: x.p, kind: x.b ? 'cpu' : 'kid', bot: !!x.b, name, av: person ? person.avatar : null });
      }
      if (out.length >= HS_RULE.max) break;
    }
    return out;
  }

  // ---------- 컴퓨터 친구 (내 화면에서만 그린다) ----------
  function makeActor(pl) {
    const av = new Avatar(normalizeAvatar(pl.av));
    av.root.traverse((m) => { if (m.isMesh) m.userData.pick = null; });
    v.scene.add(av.root);
    const tag = v.makeLabel(`🌱 ${pl.name}`, 'kv-tag kv-npc');
    return { pid: pl.pid, name: pl.name, av, tag, via: [], target: null, speed: 3, hidden: false, bubble: null, arrived: true, stuck: 0, brain: { mode: 'idle', until: 0, k: -1 } };
  }
  function dropActor(a) {
    a.av.root.removeFromParent();
    a.av.dispose();
    a.tag.remove();
    if (a.bubble) a.bubble.el.remove();
  }
  function actorAt(a, x, z, rot = null) {
    a.av.root.position.set(x, 0, z);
    if (rot != null) a.av.root.rotation.y = rot;
    a.target = null; a.via = []; a.arrived = true;
  }
  function actorGo(a, x, z, speed = 3) {
    const pos = a.av.root.position;
    a.target = new THREE.Vector3(x, 0, z);
    a.via = v.planRoute(pos, a.target) || [];
    a.speed = speed;
    a.arrived = false;
    a.stuck = 0;
  }
  function actorSay(a, text, life = 2.6) {
    if (a.hidden) return;
    if (a.bubble) a.bubble.el.remove();
    a.bubble = { el: v.makeLabel(text, 'kv-bubble npc-say'), life };
  }
  function stepActor(a, dt) {
    const pos = a.av.root.position;
    let moving = false;
    // 걸을 거리만큼 길을 따라간다 (화면이 느려 한 번에 많이 가야 할 때는 여러 점을 지난다)
    let left = a.target ? a.speed * dt : 0;
    for (let guard = 0; a.target && left > 1e-4 && guard < 8; guard++) {
      while (a.via.length && Math.hypot(a.via[0].x - pos.x, a.via[0].z - pos.z) < 0.5) a.via.shift();
      const goal = a.via.length ? a.via[0] : a.target;
      const dx = goal.x - pos.x, dz = goal.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.15 && !a.via.length) { pos.x = a.target.x; pos.z = a.target.z; a.target = null; a.arrived = true; break; }
      const step = Math.min(d, left);
      const bx = pos.x, bz = pos.z;
      pos.x += (dx / d) * step; pos.z += (dz / d) * step;
      v.resolve(pos);
      a.av.root.rotation.y = turnTo(a.av.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
      moving = true;
      left -= step;
      // 막혀서 못 가면 다음 점으로 건너뛴다
      a.stuck = Math.hypot(pos.x - bx, pos.z - bz) < step * 0.2 ? a.stuck + dt : 0;
      if (a.stuck > 0.8) { pos.x = goal.x; pos.z = goal.z; if (a.via.length) a.via.shift(); a.stuck = 0; }
      if (step >= d - 1e-6 && a.via.length && goal === a.via[0]) a.via.shift();
    }
    a.av.update(dt, moving, 1.1);
    if (a.av.root.visible === a.hidden) a.av.root.visible = !a.hidden;
    if (a.hidden) { a.tag.style.display = 'none'; if (a.bubble) { a.bubble.el.remove(); a.bubble = null; } return; }
    v.placeLabel(a.tag, pos, 2.45);
    if (a.bubble) {
      a.bubble.life -= dt;
      if (a.bubble.life <= 0) { a.bubble.el.remove(); a.bubble = null; } else {
        a.bubble.el.style.opacity = String(Math.min(1, a.bubble.life / 0.5));
        v.placeLabel(a.bubble.el, pos, 3.05);
      }
    }
  }
  const actor = (pid) => (G ? G.actors.get(pid) : null);
  function syncActors() {
    for (const [pid, a] of G.actors) if (!P(pid)) { dropActor(a); G.actors.delete(pid); }
    G.players.forEach((p, i) => {
      if (p.kind !== 'cpu' || G.actors.has(p.pid)) return;
      const a = makeActor(p);
      const gp = gatherPoint(i, G.players.length);
      actorAt(a, gp.x, gp.z, gp.rot);
      G.actors.set(p.pid, a);
    });
  }

  // ---------- 다른 사람 모습 (숨고 찾기) ----------
  function showHidden(pid, on, k = -1) {
    if (pid === G.me) return;
    const hid = on || !!G.blind; // 술래가 눈을 가리고 세는 동안에는 술래 화면에서 아무도 보이지 않는다
    const a = actor(pid);
    if (a) {
      a.hidden = hid;
      if (on && k >= 0) { const sp = HS_SPOTS[k]; actorAt(a, sp.door2.x, sp.door2.z); }
      if (!on) a.av.pose = null;
      return;
    }
    v.setHsHidden(pid, hid);
  }
  // 술래 눈가림: 내가 술래로 세는 동안 내 화면에서는 같이 하는 친구가 모두 보이지 않는다
  // (숨으러 가는 모습, 이름표, 말풍선, 애완동물, 마을 지도 위 자리). 다 세면 숨지 않은 친구만 다시 보인다
  function blind(on) {
    G.blind = !!on;
    for (const p of G.players) {
      if (p.pid === G.me) continue;
      const hid = G.blind || G.hidden.has(p.pid);
      const a = actor(p.pid);
      if (a) a.hidden = hid;
      else v.setHsHidden(p.pid, hid);
    }
  }
  // 판에서 나간 친구는 숨은 모습과 자리 고정을 풀어 마을에서 다시 보이게 한다
  function freeKid(pid) {
    v.setHsHidden(pid, false);
    v.unpinRemote(pid);
  }
  function sayAs(pid, text) {
    const a = actor(pid);
    if (a) actorSay(a, text);
    else v.say(pid === G.me ? 'me' : pid, text);
  }
  function celebrate(pid) {
    const a = actor(pid);
    if (a) a.av.jump();
    else if (pid === G.me) v.player.celebrate();
    else v.remoteCelebrate(pid);
  }

  // ---------- 내 모습: 숨기, 술래 세기 ----------
  let hidCtrl = null, countCtrl = null;
  function enterHidden(k, auto) {
    const sp = HS_SPOTS[k];
    if (!sp) return;
    exitCount();
    v.target = null;
    if (v.sitting) v.standUp(true);
    // 숨었다는 것을 먼저 알리고 자리를 옮긴다 (친구 화면에 숨는 곳이 잠깐이라도 보이지 않게)
    v.setMeHidden(true);
    o.setActivity('hsh');
    v.placePlayer(sp.door2.x, sp.door2.z, Math.atan2(sp.dx, sp.dz));
    // 숨은 곳 바깥(바다 쪽) 높은 곳에서 섬 가운데를 내려다본다: 앞에 숨은 곳, 그 너머로 찾으러 오는 술래가 보인다
    // (높이 올려 두어야 둘레 숲의 나무에 가리지 않는다)
    hidCtrl = {
      cam: { pos: new THREE.Vector3(sp.x + sp.dx * 5, 7.2, sp.z + sp.dz * 5), look: new THREE.Vector3(sp.x - sp.dx * 4, 0.5, sp.z - sp.dz * 4) },
      camSpeed: 2.6,
      onTap: () => {},
      update: () => {},
      stop: () => { hidCtrl = null; }, // 다른 놀이가 화면을 가져가면 숨은 채로 둔다 (판은 이어진다)
    };
    v.enterGame(hidCtrl);
    document.body.classList.add('hs-lock');
    if (!auto) { sfx.tuck(); if (isle()) isle().shake(k, 0.4); }
    G.myHide = k;
  }
  function exitHidden() {
    if (G) G.myHide = -1;
    v.setMeHidden(false);
    if (hidCtrl && v.game === hidCtrl) v.exitGame();
    hidCtrl = null;
    if (!countCtrl) document.body.classList.remove('hs-lock');
    if (G) o.setActivity('hs');
  }
  function enterCount() {
    exitHidden();
    v.target = null;
    if (v.sitting) v.standUp(true);
    v.placePlayer(HS_TREE.seekX, HS_TREE.seekZ, HS_TREE.seekRot);
    v.player.pose = coverEyes;
    countCtrl = {
      cam: { pos: new THREE.Vector3(HS_TREE.seekX + 1.2, 2.7, HS_TREE.seekZ + 4.2), look: new THREE.Vector3(HS_TREE.x, 1.6, HS_TREE.z) },
      camSpeed: 3,
      onTap: () => {},
      update: () => {},
      stop: () => { countCtrl = null; cover.hidden = true; if (v.player && v.player.pose === coverEyes) v.player.pose = null; },
    };
    v.enterGame(countCtrl);
    document.body.classList.add('hs-lock');
    cover.hidden = false;
  }
  function exitCount() {
    cover.hidden = true;
    if (v.player && v.player.pose === coverEyes) { v.player.pose = null; }
    if (countCtrl && v.game === countCtrl) v.exitGame();
    countCtrl = null;
    if (!hidCtrl) document.body.classList.remove('hs-lock');
  }

  // ---------- 판 소식 (모든 화면이 같은 차례로 한다) ----------
  function apply(m) {
    if (!G || !m || typeof m.t !== 'string') return;
    // 기다리는 중(방장이 시작하기 전, 또는 하는 판이 끝나기 전)에는 방 사람 목록과 시작, 끝만 본다
    if (G.waiting && m.t !== 'L' && m.t !== 'G' && m.t !== 'X') return;
    switch (m.t) {
      case 'L': if (G.waiting) { const pl = unpack(m.pl); if (pl) { G.players = pl; G.busy = m.ph === 1; drawWait(); } } break;
      case 'P': { const pl = unpack(m.pl); if (pl) { for (const p of G.players) if (p.pid !== G.me && !pl.some((q) => q.pid === p.pid)) freeKid(p.pid); G.players = pl; syncActors(); drawHud(); } break; }
      case 'G': startRound(m); break;
      case 'H': if (Number.isInteger(m.k) && HS_SPOTS[m.k] && typeof m.p === 'string') onHid(m.p, m.k, !!m.a); break;
      case 'U': if (typeof m.p === 'string') onUnhid(m.p); break;
      case 'S': onSeek(Number(m.ms) || HS_RULE.seekSec * 1000); break;
      case 'C': if (Number.isInteger(m.k) && HS_SPOTS[m.k]) onCheck(m.p, m.k, Array.isArray(m.f) ? m.f : [], m.m === 1); break;
      case 'R': if (Number.isInteger(m.k) && HS_SPOTS[m.k]) onRustle(m.k); break;
      case 'E': onEnd(m); break;
      case 'N': { const a = actor(m.p); if (a && Number.isFinite(m.x) && Number.isFinite(m.z)) actorGo(a, m.x, m.z, Number(m.s) || 3); break; }
      case 'Z': if (m.p === G.me) toast(m.w === 'taken' ? '여기에는 벌써 누가 숨었어요! 다른 곳을 찾아봐요.' : m.w === 'early' ? `찾기 시작하고 ${HS_RULE.giveUpSec}초가 지나야 외칠 수 있어요.` : '지금은 할 수 없어요.', 2600); break;
      case 'X': finish(m.w === 'host' ? '방장이 숨바꼭질을 끝냈어요.' : '숨바꼭질이 끝났어요.'); break;
      default: break;
    }
  }
  function startRound(m) {
    const pl = unpack(m.pl);
    if (!pl || !pl.some((p) => p.pid === G.me)) { if (!G.waiting) finish('숨바꼭질 판에 내 자리가 없어요.'); return; }
    if (G.waiting) { G.waiting = false; closingSheet = true; o.modal.close(); closingSheet = false; }
    result.hidden = true;
    // 지난 판에 숨어 있던 모습을 모두 되돌린다
    G.blind = false;
    for (const p of G.players) if (p.pid !== G.me) showHidden(p.pid, false);
    for (const p of G.players) if (p.pid !== G.me && !pl.some((q) => q.pid === p.pid)) freeKid(p.pid); // 이번 판에 없는 친구
    for (const p of G.players) if (p.kind === 'kid' && p.pid !== G.me) v.unpinRemote(p.pid);
    G.players = pl;
    G.round = Number(m.r) || G.round + 1;
    G.seeker = typeof m.sk === 'string' && P(m.sk) ? m.sk : pl[0].pid;
    G.phase = 'hide';
    G.hidden = new Map();
    G.found = [];
    G.checked = new Set();
    G.endAt = nowMs() + (Number(m.ms) || HS_RULE.hideSec * 1000);
    G.seekAt = 0;
    G.lastCheck = 0;
    G.myHide = -1;
    G.result = null;
    syncActors();
    // 컴퓨터 친구는 나무 둘레에 모였다가, 술래는 나무 앞에서 눈을 가린다
    G.players.forEach((p, i) => {
      const a = actor(p.pid);
      if (!a) return;
      a.hidden = false;
      a.av.pose = null;
      a.brain = { mode: 'idle', until: 0, k: -1 };
      if (p.pid === G.seeker) { actorAt(a, HS_TREE.seekX, HS_TREE.seekZ, HS_TREE.seekRot); a.av.pose = coverEyes; } else {
        const gp = gatherPoint(i, G.players.length);
        actorAt(a, gp.x, gp.z, gp.rot);
      }
    });
    const sk = P(G.seeker);
    if (sk && sk.kind === 'kid' && sk.pid !== G.me) v.pinRemote(sk.pid, { x: HS_TREE.seekX, z: HS_TREE.seekZ, rot: HS_TREE.seekRot, pose: coverEyes });
    o.setActivity('hs');
    o.setScene('game');
    if (G.seeker === G.me) { blind(true); enterCount(); }
    else {
      exitHidden();
      exitCount();
      // 섬 밖에 있으면 나무 둘레로 데려온다
      const q = v.player.root.position;
      if (regionOf(q.x, q.z) !== 'hide') { const gp = gatherPoint(G.players.findIndex((p) => p.pid === G.me), G.players.length); v.target = null; v.placePlayer(gp.x, gp.z, gp.rot); }
      sayAs(G.seeker, CHANT);
    }
    if (isle()) isle().setRings(G.seeker === G.me ? null : 'hide');
    sfx.bell();
    drawHud();
    drawBar();
  }
  function onHid(pid, k, auto) {
    if (!P(pid) || pid === G.seeker) return;
    G.hidden.set(pid, k);
    if (pid === G.me) enterHidden(k, auto);
    else showHidden(pid, true, k);
    drawHud();
    drawBar();
  }
  function onUnhid(pid) {
    G.hidden.delete(pid);
    if (pid === G.me) exitHidden();
    else showHidden(pid, false);
    drawHud();
    drawBar();
  }
  function onSeek(ms) {
    G.phase = 'seek';
    G.endAt = nowMs() + ms;
    G.seekAt = nowMs();
    G.nextRustle = G.seekAt + ms * HS_RULE.rustleAt;
    const sk = P(G.seeker);
    if (G.seeker === G.me) { blind(false); exitCount(); }
    else if (sk && sk.kind === 'kid') v.unpinRemote(sk.pid);
    const a = actor(G.seeker);
    if (a) a.av.pose = null;
    sayAs(G.seeker, '다 숨었니? 이제 찾는다!');
    if (isle()) isle().setRings('seek', G.checked);
    sfx.whoosh();
    if (G.seeker === G.me) toast('이제 찾아요! 숨을 곳을 누르면 그 앞으로 가서 찾아봐요.', 3200);
    drawHud();
    drawBar();
  }
  // miss: 컴퓨터 친구가 숨은 사람을 못 보고 지나쳤다
  function onCheck(pid, k, f, miss = false) {
    if (!miss) G.checked.add(k);
    if (isle()) { isle().puff(k); isle().setRings(G.phase === 'seek' ? 'seek' : null, G.checked); }
    const who = nameOf(pid);
    const found = f.filter((q) => G.hidden.has(q));
    if (pid !== G.me) { const a = actor(pid); if (a) a.av.root.rotation.y = Math.atan2(HS_SPOTS[k].x - a.av.root.position.x, HS_SPOTS[k].z - a.av.root.position.z); }
    if (!found.length) {
      sayAs(pid, pick(EMPTY));
      if (pid === G.me) sfx.tap();
      if (miss && G.myHide === k) toast(`휴, 아슬아슬! ${josa(who, '이가', '가')} 못 보고 지나갔어요.`, 2600);
      drawHud();
      return;
    }
    sayAs(pid, '찾았다!');
    for (const q of found) {
      G.hidden.delete(q);
      G.found.push(q);
      if (q === G.me) {
        exitHidden();
        sayAs(q, '들켰다!');
        toast(`${josa(who, '이가', '가')} 나를 찾았어요! 이제 같이 찾아요. 숨을 곳을 눌러 찾아봐요.`, 3600);
        if (isle()) isle().setRings('seek', G.checked);
      } else {
        showHidden(q, false);
        setTimeout(() => { if (G) sayAs(q, '들켰다!'); }, 350);
      }
      const fa = actor(q);
      if (fa) fa.brain = { mode: 'idle', until: nowMs() + 1500, k: -1 }; // 찾은 컴퓨터 친구도 같이 찾는다
      celebrate(q);
    }
    sfx.success();
    if (pid === G.me) confetti();
    banner(`${josa(who, '이가', '가')} ${listJosa(found.map(nameOf), '을', '를')} 찾았어요!`);
    drawHud();
    drawBar();
  }
  function onRustle(k) {
    if (isle()) isle().rustle(k);
    sfx.rustle();
    if (G.myHide === k) toast('앗, 부스럭! 들킬지도 몰라요. 쉿!', 2200);
    G.lastRustle = { k, at: nowMs() };
    if (G.host) for (const a of G.actors.values()) if (isSeeker(a.pid) && !G.checked.has(k) && Math.random() < HS_CPU.follow) a.brain = { mode: 'go', k, until: 0 };
  }
  function onEnd(m) {
    G.phase = 'end';
    const why = ['all', 'time', 'giveup', 'left'].includes(m.w) ? m.w : 'time';
    const win = Array.isArray(m.win) ? m.win.filter((p) => P(p)) : [];
    const stayed = [...G.hidden.keys()];
    if (G.blind) blind(false); // 세는 중에 판이 끝나면 (술래가 나가는 등) 다시 모두 보인다
    exitCount();
    for (const q of stayed) {
      if (q === G.me) { exitHidden(); setTimeout(() => { if (G) sayAs(G.me, '나 여기 있지!'); }, 200); } else {
        showHidden(q, false);
        setTimeout(() => { if (G) sayAs(q, '나 여기 있지!'); }, 300);
      }
      celebrate(q);
    }
    G.hidden.clear();
    if (why === 'giveup') sayAs(G.seeker, '못 찾겠다 꾀꼬리!');
    const sk = P(G.seeker);
    if (sk && sk.kind === 'kid' && sk.pid !== G.me) v.unpinRemote(sk.pid);
    for (const a of G.actors.values()) { a.av.pose = null; a.brain = { mode: 'idle', until: 0, k: -1 }; }
    if (isle()) isle().setRings(null);
    G.result = { why, win, next: typeof m.nx === 'string' ? m.nx : null, stayed, reward: null };
    if (win.includes(G.me)) claim(G.seeker === G.me ? 'seek' : 'hide');
    if (win.includes(G.me)) { confetti(); v.celebrate(); } else sfx.ding();
    o.setScene('village');
    drawHud();
    drawBar();
    drawResult();
  }
  // 이긴 열매 받기 (하루 3개까지)
  async function claim(role) {
    const R = G.result;
    try {
      const r = await o.rpc('kids_hs_win', { p_token: o.getToken(), p_role: role });
      if (Number.isFinite(r.fruits)) o.setFruits(r.fruits);
      R.reward = r.got ? `🍎 열매 1개를 받았어요! (오늘 ${r.today}/${r.max || HS_RULE.winMax})` : `오늘 숨바꼭질 열매 ${r.max || HS_RULE.winMax}개를 다 받았어요. 내일 또 받아요!`;
    } catch (e) {
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      R.reward = e.code === 'TOO_FAST' ? '조금 전에 받은 열매가 있어요. 다음 판에 또 이겨 봐요!' : e.code === 'PLAY_LOCKED' ? '오늘 말씀 활동을 마치면 열매를 받을 수 있어요.' : '열매를 받지 못했어요. 다음 판에 다시 해 봐요.';
    }
    if (G && G.result === R) drawResult();
  }

  // ---------- 방장 (혼자 할 때는 내 화면이 방장) ----------
  function emit(t, d = {}) { if (!G) return; const m = { ...d, t }; if (G.room) G.room.send(t, d); apply(m); }
  function ask(t, d = {}) { if (!G) return; if (G.host) hostReq(G.me, { ...d, t }); else if (G.room) G.room.send(t, d); }
  function hostReq(from, m) {
    if (!G || !G.host) return;
    const pl = P(from);
    if (m.t === 'j') { sendRoster(); return; }
    if (m.t === 'q') {
      if (lobby) { lobby.seats = lobby.seats.filter((s) => s.pid !== from); if (G.room) G.room.setMembers(lobby.seats.filter((x) => x.kind === 'kid' && !x.bot && x.state === 'in').map((x) => x.pid)); sendLobby(); drawLobby(); return; }
      dropPlayer(from);
      return;
    }
    if (!pl) return;
    if (m.t === 'h') {
      const k = m.k;
      if (G.phase !== 'hide' || from === G.seeker || !Number.isInteger(k) || !HS_SPOTS[k]) return;
      if (spotTaken(k) && G.hidden.get(from) !== k) { emit('Z', { p: from, w: 'taken' }); return; }
      if (G.hidden.get(from) === k) return;
      emit('H', { p: from, k });
    } else if (m.t === 'u') {
      if (G.phase === 'hide' && G.hidden.has(from)) emit('U', { p: from });
    } else if (m.t === 't') {
      const k = m.k;
      if (G.phase !== 'seek' || !isSeeker(from) || !Number.isInteger(k) || !HS_SPOTS[k]) return;
      const last = G.chk.get(from) || 0;
      if (nowMs() - last < HS_RULE.checkSec * 1000 - 150) return;
      G.chk.set(from, nowMs());
      doCheck(from, k);
    } else if (m.t === 'g') {
      if (G.phase !== 'seek' || from !== G.seeker) return;
      if (nowMs() - G.seekAt < HS_RULE.giveUpSec * 1000 - 300) { emit('Z', { p: from, w: 'early' }); return; }
      hostEnd('giveup');
    }
  }
  // cpu: 컴퓨터 친구가 찾아보면 숨은 사람을 가끔(10%) 못 보고 지나친다 (그곳은 찾아본 곳으로 치지 않는다)
  function doCheck(pid, k, cpu = false) {
    const f = [...G.hidden].filter(([, s]) => s === k).map(([p]) => p);
    if (cpu && f.length && Math.random() < HS_CPU.miss) { emit('C', { p: pid, k, f: [], m: 1 }); return; }
    emit('C', { p: pid, k, f });
    if (G && G.phase === 'seek' && !G.hidden.size) hostEnd('all');
  }
  function hostEnd(why) {
    if (!G || G.phase === 'end') return;
    const win = why === 'all' ? [G.seeker] : why === 'left' ? [] : [...G.hidden.keys()];
    const order = G.players.map((p) => p.pid);
    const after = order[(order.indexOf(G.seeker) + 1) % order.length];
    const nx = G.found[0] && P(G.found[0]) ? G.found[0] : P(after) ? after : order[0];
    emit('E', { w: why, win, nx });
  }
  function hostStart(seeker) {
    if (!G || !G.host) return;
    // 기다리던 친구도 이번 판부터 같이 한다
    if (G.queue && G.queue.length) {
      G.players = [...G.players, ...G.queue].slice(0, HS_RULE.max);
      G.queue = [];
      syncActors();
    }
    if (G.room) G.room.setMembers(roomMembers());
    G.chk = new Map();
    emit('G', { r: (G.round || 0) + 1, sk: seeker, pl: pack(), ms: HS_RULE.hideSec * 1000 });
    // 컴퓨터 친구가 숨는다 (조금씩 다르게 출발)
    for (const p of hiders()) {
      const a = actor(p.pid);
      if (a) a.brain = { mode: 'hide', until: nowMs() + 600 + Math.random() * 2200, k: -1 };
    }
    advertise();
  }
  // 숨을 시간이 끝났는데 아직 못 숨은 사람은 가까운 빈 곳에 숨긴다
  function autoHide() {
    for (const p of hiders()) {
      if (G.hidden.has(p.pid)) continue;
      const a = actor(p.pid);
      const at = a ? a.av.root.position : p.pid === G.me ? v.player.root.position : (v.remotes.get(p.pid) || { av: { root: { position: { x: HS_TREE.x, z: HS_TREE.z } } } }).av.root.position;
      const want = a && a.brain.k >= 0 && !spotTaken(a.brain.k) ? a.brain.k : -1;
      let best = want, bd = Infinity;
      if (best < 0) for (const sp of HS_SPOTS) {
        if (spotTaken(sp.k)) continue;
        const d = Math.hypot(sp.door2.x - at.x, sp.door2.z - at.z);
        if (d < bd) { bd = d; best = sp.k; }
      }
      if (best >= 0) emit('H', { p: p.pid, k: best, a: 1 });
    }
  }
  function hostTick() {
    const t = nowMs();
    if (G.phase === 'hide' && t >= G.endAt) {
      autoHide();
      if (!G || G.phase !== 'hide') return;
      emit('S', { ms: HS_RULE.seekSec * 1000 });
      for (const a of G.actors.values()) if (isSeeker(a.pid)) a.brain = { mode: 'idle', until: nowMs() + 1200, k: -1 };
      return;
    }
    if (G.phase === 'seek') {
      if (t >= G.endAt) { hostEnd('time'); return; }
      if (t >= G.nextRustle && G.hidden.size) {
        // 절반은 아무도 숨지 않은 곳(아직 찾아보지 않은 곳)에서 나는 가짜 부스럭이다
        const hid = new Set(G.hidden.values());
        const empty = HS_SPOTS.filter((sp) => !hid.has(sp.k) && !G.checked.has(sp.k)).map((sp) => sp.k);
        emit('R', { k: empty.length && Math.random() < HS_RULE.decoy ? pick(empty) : pick([...hid]) });
        G.nextRustle = t + 10000 + Math.random() * 4000;
      }
    }
    // 컴퓨터 친구 생각
    for (const a of G.actors.values()) cpuThink(a, t);
  }
  function cpuThink(a, t) {
    const b = a.brain;
    if (G.phase === 'hide' && b.mode === 'hide' && t >= b.until) {
      // 빈 곳 가운데 하나를 골라 걸어간다 (다른 컴퓨터 친구가 가는 곳은 빼고)
      const going = new Set([...G.actors.values()].map((x) => x.brain.k).filter((k) => k >= 0));
      const free = HS_SPOTS.filter((sp) => !spotTaken(sp.k) && !going.has(sp.k));
      if (!free.length) { b.mode = 'idle'; return; }
      const sp = pick(free);
      b.k = sp.k; b.mode = 'hiding';
      emit('N', { p: a.pid, x: sp.door2.x, z: sp.door2.z, s: 3.4 });
      return;
    }
    if (G.phase === 'hide' && b.mode === 'hiding' && a.arrived) {
      b.mode = 'done';
      if (spotTaken(b.k)) { b.mode = 'hide'; b.until = t; b.k = -1; return; } // 누가 먼저 숨었으면 다른 곳으로
      emit('H', { p: a.pid, k: b.k });
      return;
    }
    if (G.phase !== 'seek' || !isSeeker(a.pid)) return;
    if ((b.mode === 'idle' && t >= b.until) || b.mode === 'go') {
      // 아직 찾아보지 않은 곳 가운데 가까운 곳을 고른다 (부스럭 소리가 난 곳으로 가기로 했으면 그곳)
      let k = b.mode === 'go' && !G.checked.has(b.k) ? b.k : -1;
      if (k < 0) {
        const taken = new Set([...G.actors.values()].filter((x) => x !== a && x.brain.mode === 'walk').map((x) => x.brain.k));
        const left = HS_SPOTS.filter((sp) => !G.checked.has(sp.k) && !taken.has(sp.k));
        if (!left.length) { b.mode = 'idle'; b.until = t + 2000; return; }
        const pos = a.av.root.position;
        const w = left.map((sp) => 1 / (Math.hypot(sp.door2.x - pos.x, sp.door2.z - pos.z) + 4));
        let r = Math.random() * w.reduce((s, x) => s + x, 0);
        k = left[left.length - 1].k;
        for (let i = 0; i < left.length; i++) { r -= w[i]; if (r <= 0) { k = left[i].k; break; } }
      }
      const sp = HS_SPOTS[k];
      b.k = k; b.mode = 'walk';
      emit('N', { p: a.pid, x: sp.door2.x, z: sp.door2.z, s: a.pid === G.seeker ? HS_CPU.seekSpeed : HS_CPU.helpSpeed });
      return;
    }
    if (b.mode === 'walk' && a.arrived) { b.mode = 'look'; b.until = t + HS_CPU.look; return; }
    if (b.mode === 'look' && t >= b.until) {
      const last = G.chk.get(a.pid) || 0;
      if (t - last < HS_RULE.checkSec * 1000) return;
      G.chk.set(a.pid, t);
      b.mode = 'idle';
      b.until = t + HS_CPU.think[0] + Math.random() * (HS_CPU.think[1] - HS_CPU.think[0]); // 둘레를 두리번거리다가 다음 곳으로
      doCheck(a.pid, b.k, true);
    }
  }
  // 친구가 나감 (방장 화면)
  function dropPlayer(pid) {
    if (!G || pid === G.me) return;
    if (G.queue && G.queue.some((q) => q.pid === pid)) { // 다음 판을 기다리던 친구
      G.queue = G.queue.filter((q) => q.pid !== pid);
      if (G.room) G.room.setMembers(roomMembers());
      sendRoster();
      advertise();
      if (G.phase === 'end') drawResult();
      return;
    }
    if (!P(pid)) return;
    const wasSeeker = pid === G.seeker;
    G.hidden.delete(pid);
    G.found = G.found.filter((q) => q !== pid);
    G.players = G.players.filter((p) => p.pid !== pid);
    freeKid(pid);
    if (G.room) G.room.setMembers(roomMembers());
    emit('P', { pl: pack() });
    sendRoster();
    advertise();
    if (G.players.length + (G.queue || []).length < 2) { emit('X', { w: 'alone' }); return; }
    if (G.phase !== 'end' && G.phase !== 'lobby') {
      if (wasSeeker || G.players.length < 2) hostEnd('left');
      else if (G.phase === 'seek' && !G.hidden.size) hostEnd('all');
    }
  }
  // ---------- 열린 방 (초대 없이 들어오기) ----------
  // 방장: 마을 모두에게 방을 알린다 (s 0 모이는 중, 1 하는 중, 2 닫힘)
  let advAt = 0;
  function advertise() {
    if (!o.send || !G || !G.host || !G.room) return;
    advAt = nowMs();
    o.send('hroom', { g: G.room.gid, n: seatCount(), m: HS_RULE.max, s: lobby ? 0 : 1 });
  }
  // 방장: 기다리는 친구에게 방 사람 목록을 보낸다 (ph 1: 지금 판을 하는 중)
  function sendRoster() {
    if (!G || !G.host || !G.room) return;
    if (lobby) { sendLobby(); return; }
    G.room.send('L', { pl: pack([...G.players, ...(G.queue || [])]), ph: G.phase === 'end' ? 0 : 1 });
  }
  // 방장: 친구가 들어오고 싶어 한다
  function onJoinAsk(from, g) {
    const reply = (ok, b = 0) => { if (o.send) o.send('hjr', { to: from, g, ok, b }); };
    if (!G || !G.host || !G.room || G.room.gid !== g || G.room.closed) { reply(false, 2); return; }
    const seat = lobby && lobby.seats.find((x) => x.pid === from);
    if (seat || P(from) || (G.queue || []).some((q) => q.pid === from)) { // 벌써 방에 있다 (부르는 중이었으면 들어온 것으로)
      if (seat && seat.state === 'wait') { seat.state = 'in'; G.room.cancelInvite(from); sendLobby(); drawLobby(); }
      G.room.members.add(from);
      reply(true);
      return;
    }
    if (seatCount() >= HS_RULE.max) { reply(false, 1); return; }
    const person = o.getPerson(from);
    const entry = { pid: from, kind: 'kid', name: person ? (person.name || '친구') : '친구', av: person ? person.avatar : null };
    G.room.members.add(from);
    if (lobby) { lobby.seats.push({ ...entry, state: 'in' }); drawLobby(); } else { G.queue = G.queue || []; G.queue.push(entry); }
    reply(true);
    sfx.ding();
    toast(`${josa(entry.name, '이가', '가')} 숨바꼭질 방에 들어왔어요!${lobby ? '' : ' 다음 판부터 같이 해요.'}`, 2800);
    sendRoster();
    advertise();
    if (G.phase === 'end') drawResult();
  }
  // 들어가기를 물어본 방의 대답
  function onJoinReply(from, p) {
    if (!joining || joining.g !== p.g || joining.host !== from) return;
    clearTimeout(joining.timer);
    joining = null;
    if (!p.ok) {
      if (p.b !== 1) rooms.delete(p.g);
      toast(p.b === 1 ? `방이 꽉 찼어요 (${HS_RULE.max}명까지). 다른 방에 들어가거나 방을 만들어요.` : '그 방은 벌써 닫혔어요.', 2800);
      drawRooms();
      return;
    }
    if (G) return;
    closingSheet = true; o.modal.close(); closingSheet = false;
    if (o.beforeStart) o.beforeStart();
    join(o.hub.joinRoom(p.g, 'hide', from));
  }
  async function requestJoin(r) {
    if (G || joining || !o.send) return;
    if (!o.playOpen()) await o.refreshToday();
    if (!o.playOpen()) { closingSheet = true; o.modal.close(); closingSheet = false; o.showLocked(); return; }
    joining = { g: r.g, host: r.host, timer: setTimeout(() => { if (joining && joining.g === r.g) { joining = null; toast('방장이 대답이 없어요. 조금 뒤에 다시 해 봐요.', 2600); drawRooms(); } }, 9000) };
    o.send('hj', { to: r.host, g: r.g });
    drawRooms();
  }
  const openRooms = () => [...rooms.entries()].filter(([, r]) => Date.now() - r.at < 40000 && o.getPerson(r.host)).map(([g, r]) => ({ g, ...r }));
  // 술래 나무 창의 열린 방 목록
  function drawRooms() {
    if (!menuRooms || !menuRooms.isConnected) return;
    const list = openRooms();
    if (!list.length) { menuRooms.replaceChildren(); return; }
    menuRooms.replaceChildren(h('h3', {}, '친구가 연 방'), h('div', { class: 'fl-list' }, list.map((r) => {
      const person = o.getPerson(r.host) || {};
      const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
      drawFaceIcon(face, normalizeAvatar(person.avatar));
      const full = r.n >= r.m, busy = joining && joining.g === r.g;
      return h('div', { class: 'fl-row' }, face,
        h('div', { class: 'fl-main' }, h('b', {}, `${person.name || '친구'}네 방`), h('span', {}, `${r.n}/${r.m}명 · ${r.s === 0 ? '모이는 중' : '하는 중 (다음 판부터 같이 해요)'}`)),
        h('div', { class: 'fl-acts' }, h('button', { class: 'btn btn-go btn-small', type: 'button', disabled: full || !!joining, onclick: () => requestJoin(r) }, busy ? '들어가는 중…' : full ? '꽉 찼어요' : '들어가기')));
    })));
  }
  // 마을 채널로 온 방 소식 (app.js가 넘겨준다)
  function onNet(type, from, p) {
    if (type === 'hroom') {
      for (const [g, r] of rooms) if (r.host === from && g !== p.g) rooms.delete(g);
      if (p.s === 2) { rooms.delete(p.g); drawRooms(); return; }
      const had = rooms.has(p.g);
      rooms.set(p.g, { host: from, n: p.n, m: p.m, s: p.s, at: Date.now() });
      if (!had && p.s === 0 && !G && v.player) {
        const q = v.player.root.position, person = o.getPerson(from);
        if (person && regionOf(q.x, q.z) === 'hide') toast(`🙈 ${josa(person.name || '친구', '이가', '가')} 숨바꼭질 방을 열었어요! 술래 나무를 누르면 들어갈 수 있어요.`, 3600);
      }
      drawRooms();
    } else if (type === 'hj') onJoinAsk(from, p.g);
    else if (type === 'hjr') onJoinReply(from, p);
  }
  function peerLeft(id) {
    let ch = false;
    for (const [g, r] of rooms) if (r.host === id) { rooms.delete(g); ch = true; }
    if (joining && joining.host === id) { clearTimeout(joining.timer); joining = null; ch = true; }
    if (ch) drawRooms();
  }

  // ---------- 매 장면 ----------
  let lastTick = 0, lastFrame = 0;
  // 장면마다: 컴퓨터 친구를 걷게 한다 (실제 시계로: 화면이 느린 기기에서도 판 시간에 맞게)
  function stepAll() {
    const now = nowMs(), dt = Math.min(1, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    if (G) for (const a of G.actors.values()) stepActor(a, dt);
  }
  function tick() { lastFrame = nowMs(); stepAll(); }
  // 판 진행은 장면과 따로 0.2초마다 (방장 화면이 뒤로 가서 장면이 멈춰도 판은 이어진다)
  setInterval(() => {
    if (!G) return;
    if (G.host && G.room && nowMs() - advAt > 15000) advertise(); // 열린 방은 15초마다 다시 알린다
    if (nowMs() - lastFrame > 400) stepAll();
    if (G.waiting || G.phase === 'lobby') return;
    if (G.host) hostTick();
    if (G) drawHud();
  }, 200);

  // ---------- 화면: 위 알림, 아래 단추, 술래 눈가림, 결과 ----------
  let bannerT = null;
  function banner(text) {
    G.banner = text;
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { if (G) { G.banner = null; drawHud(); } }, 2600);
    drawHud();
  }
  function drawHud() {
    if (!G || G.waiting) { hud.hidden = true; return; }
    const left = (G.endAt - nowMs()) / 1000;
    const me = G.me;
    let big = '', small = '';
    if (G.phase === 'hide') {
      if (G.seeker === me) {
        cover.replaceChildren(
          h('p', { class: 'hs-cover-eyes', 'aria-hidden': 'true' }, '🙈'),
          h('p', { class: 'hs-cover-chant' }, CHANT),
          h('p', { class: 'hs-cover-num' }, String(Math.max(0, Math.ceil(left)))),
          h('p', { class: 'hs-cover-sub' }, `나는 술래! 술래 나무에 눈을 가리고 세는 중이에요. 친구들이 숨는 동안 기다려요.`));
        hud.hidden = true;
        return;
      }
      big = G.myHide >= 0 ? `🤫 ${HS_SPOTS[G.myHide].name}에 숨었어요` : '🏃 얼른 숨어요!';
      small = `${nameOf(G.seeker)}${G.seeker === me ? '' : ' 술래'}가 세는 중 · ${fmt(left)}${G.myHide >= 0 ? ' · 다른 곳으로 옮겨도 돼요' : ' · 숨을 곳을 누르면 그리로 가서 숨어요'}`;
    } else if (G.phase === 'seek') {
      const n = hiddenLeft();
      if (G.seeker === me || G.found.includes(me)) {
        big = G.seeker === me ? `👀 나는 술래! 숨은 친구 ${n}명` : `👀 같이 찾아요! 숨은 친구 ${n}명`;
        const cool = Math.max(0, G.lastCheck + HS_RULE.checkSec * 1000 - nowMs());
        small = `남은 시간 ${fmt(left)}${cool > 0 ? ' · 숨 고르는 중…' : ' · 숨을 곳을 눌러 찾아봐요'}`;
      } else if (G.myHide >= 0) {
        big = `🤫 ${HS_SPOTS[G.myHide].name}에 숨어 있어요`;
        small = `${nameOf(G.seeker)} 술래가 찾는 중 · 남은 시간 ${fmt(left)} · 숨은 친구 ${n}명`;
      } else {
        big = '👀 술래가 찾는 중';
        small = `남은 시간 ${fmt(left)}`;
      }
    } else if (G.phase === 'end') { hud.hidden = true; return; } else { hud.hidden = true; return; }
    hud.replaceChildren(h('b', {}, G.banner || big), h('span', {}, small));
    hud.hidden = false;
  }
  function drawBar() {
    if (!G || G.waiting) { bar.hidden = true; return; }
    const btn = (label, fn, cls = 'btn-soft') => h('button', { class: `btn ${cls} btn-small`, type: 'button', onclick: fn }, label);
    const items = [];
    if (G.phase === 'hide' && G.myHide >= 0) items.push(btn('🏃 다른 곳에 숨기', () => ask('u')));
    if (G.phase === 'seek' && G.seeker === G.me) items.push(btn('🐦 못 찾겠다 꾀꼬리', () => giveUp()));
    if (G.phase !== 'end') items.push(btn('그만하기', () => askQuit()));
    bar.replaceChildren(...items);
    bar.hidden = !items.length;
    document.body.classList.toggle('hs-on', true);
  }
  function giveUp() {
    if (!G || G.phase !== 'seek') return;
    const passed = (nowMs() - G.seekAt) / 1000;
    if (passed < HS_RULE.giveUpSec) { toast(`찾기 시작하고 ${HS_RULE.giveUpSec}초가 지나야 외칠 수 있어요. 조금만 더 찾아봐요! (${Math.ceil(HS_RULE.giveUpSec - passed)}초 남음)`, 2800); return; }
    ask('g');
  }
  function askQuit() {
    if (!G) return;
    const body = h('div', { class: 'talk' },
      h('p', {}, G.host && G.room ? '숨바꼭질을 그만할까요? 방장이 나가면 친구들 숨바꼭질도 끝나요.' : '숨바꼭질을 그만할까요?'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => o.modal.close() }, '더 할래요'),
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => { o.modal.close(); quit(); } }, '그만할래요')));
    v.setPaused(true);
    o.modal.open('숨바꼭질', body, { cls: 'talk-sheet', onClose: () => v.setPaused(false) });
  }
  function drawResult() {
    const R = G && G.result;
    if (!R) { result.hidden = true; return; }
    const title = R.why === 'all' ? `👀 ${nameOf(G.seeker)} 술래가 모두 찾았어요!` : R.why === 'giveup' ? '🐦 못 찾겠다 꾀꼬리!' : R.why === 'left' ? '친구가 나가서 이번 판은 끝났어요' : '⏰ 시간이 다 됐어요!';
    const lines = [];
    if (R.why === 'all') lines.push(G.seeker === G.me ? '숨은 친구를 모두 찾았어요. 내가 이겼어요!' : `${nameOf(G.seeker)} 술래가 이겼어요.`);
    else if (R.why !== 'left') lines.push(R.win.length ? `끝까지 숨은 ${listJosa(R.win.map(nameOf), '이', '가')} 이겼어요!` : '아무도 이기지 못했어요.');
    if (R.win.includes(G.me)) lines.push(R.reward || '열매를 받는 중…');
    if (R.next && P(R.next)) lines.push(`다음 술래: ${nameOf(R.next)}${R.next === G.found[0] ? ' (처음 찾은 친구)' : ''}`);
    if (G.host && G.queue && G.queue.length) lines.push(`${listJosa(G.queue.map((q) => q.name), '이', '가')} 다음 판부터 같이 해요.`);
    const acts = [];
    if (G.host) acts.push(h('button', { class: 'btn btn-go', type: 'button', onclick: () => { result.hidden = true; hostStart(R.next && P(R.next) ? R.next : G.players[0].pid); } }, '한 판 더!'));
    else acts.push(h('p', { class: 'hs-wait' }, '방장이 다음 판을 시작하면 바로 시작해요.'));
    acts.push(h('button', { class: 'btn btn-plain', type: 'button', onclick: () => quit() }, '그만하기'));
    result.replaceChildren(h('div', { class: 'hs-card' }, h('h3', {}, title), ...lines.map((t) => h('p', {}, t)), h('div', { class: 'row' }, acts)));
    result.hidden = false;
  }

  // ---------- 숨을 곳과 술래 나무 ----------
  // 숨을 곳 앞에 닿았을 때 (마을이 걸어가서 부른다)
  function onSpot(k) {
    const sp = HS_SPOTS[k];
    if (!sp) return;
    if (!G || G.waiting || G.phase === 'end' || G.phase === 'lobby') {
      if (isle()) isle().shake(k, 0.5);
      toast(`${sp.name}: 숨바꼭질 할 때 숨는 곳이에요. 가운데 술래 나무를 누르면 숨바꼭질을 시작해요.`, 3200);
      return;
    }
    if (G.phase === 'hide') {
      if (G.seeker === G.me) return;
      if (G.myHide === k) return;
      if (G.myHide >= 0) ask('u');
      ask('h', { k });
      return;
    }
    if (G.phase === 'seek') {
      if (!isSeeker(G.me)) { toast('숨어 있는 동안은 움직일 수 없어요. 쉿!', 2200); return; }
      const wait = G.lastCheck + HS_RULE.checkSec * 1000 - nowMs();
      const go = () => { if (!G || G.phase !== 'seek') return; G.lastCheck = nowMs(); ask('t', { k }); drawHud(); };
      if (wait > 0) { setTimeout(go, wait); toast('숨 고르는 중… 곧 찾아봐요!', 1400); } else go();
    }
  }
  // 문 앞 안내 글 ('덤불 [숨기]')
  function promptAct(id) {
    if (id === 'hs_tree') return G ? '규칙 보기' : '숨바꼭질';
    if (!G || G.waiting) return '살펴보기';
    if (G.phase === 'hide' && G.seeker !== G.me) return '숨기';
    if (G.phase === 'seek' && isSeeker(G.me)) return '찾아보기';
    return '살펴보기';
  }

  // ---------- 시작하기: 고르는 창 ----------
  function sheet(title, body, onClose = null) {
    v.setPaused(true);
    o.modal.open(title, body, { cls: 'talk-sheet hs-sheet', onClose: () => { v.setPaused(false); if (onClose && !closingSheet) onClose(); } });
  }
  function howTo() {
    return h('ul', { class: 'hs-how' },
      h('li', {}, `술래가 술래 나무에 눈을 가리고 ${HS_RULE.hideSec}초를 세는 동안 숨을 곳 ${HS_SPOTS.length}군데 가운데 한 곳에 숨어요. 숨을 곳을 누르면 그 앞으로 가서 쏙 숨어요.`),
      h('li', {}, `술래는 ${fmt(HS_RULE.seekSec)} 동안 숨을 곳을 눌러 찾아봐요. 한 번 찾아보면 ${HS_RULE.checkSec}초 쉬어요. 찾은 친구는 술래와 같이 찾아요.`),
      h('li', {}, '찾는 시간이 거의 끝나 가면 가끔 부스럭 소리가 나요. 그런데 아무도 없는 곳에서 나는 가짜 소리도 있어요! 모두 찾으면 술래가, 끝까지 숨으면 숨은 친구가 이겨요.'),
      h('li', {}, `술래는 ${HS_RULE.giveUpSec}초가 지나면 '못 찾겠다 꾀꼬리'를 외칠 수 있어요. 처음 찾은 친구가 다음 술래예요.`));
  }
  async function open() {
    if (G) { // 놀이 중에는 규칙만 다시 본다
      const body = h('div', { class: 'talk hs-menu' }, h('p', { class: 'hs-lead' }, '숨바꼭질 하는 법'), howTo(),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => o.modal.close() }, '알았어요')));
      v.setPaused(true);
      o.modal.open('🙈 숨바꼭질', body, { cls: 'talk-sheet', onClose: () => v.setPaused(false) });
      return;
    }
    if (!o.playOpen()) await o.refreshToday();
    if (!o.playOpen()) { o.showLocked(); return; }
    let n = 2;
    const nums = h('div', { class: 'hs-nums', role: 'group', 'aria-label': '컴퓨터 친구 수' });
    const drawNums = () => nums.replaceChildren(...[1, 2, 3].map((k) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(n === k), onclick: () => { n = k; drawNums(); } }, `${k}명`)));
    drawNums();
    const online = (o.onlineFriends ? o.onlineFriends() : []).length;
    menuRooms = h('div', { class: 'hs-rooms' });
    const body = h('div', { class: 'talk hs-menu' },
      h('p', { class: 'hs-lead' }, '술래 나무에서 숨바꼭질을 해요!'),
      menuRooms,
      howTo(),
      h('h3', {}, '컴퓨터 친구와 하기'),
      h('p', {}, '함께할 컴퓨터 친구 (다람이, 콩이, 별이)'), nums,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => solo(n, false) }, '🙈 내가 숨을래요'),
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => solo(n, true) }, '👀 내가 술래 할래요')),
      h('h3', {}, '마을 친구와 하기'),
      h('p', {}, `방을 만들면 마을 친구 누구나 술래 나무에서 초대 없이 바로 들어올 수 있어요. 친구를 불러도 되고, 컴퓨터 친구도 넣을 수 있어요(모두 ${HS_RULE.max}명까지).${online ? '' : ' 지금은 마을에 다른 친구가 없어요.'}`),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-soft', type: 'button', onclick: () => makeRoom() }, '👋 방 만들기')),
      h('p', { class: 'note' }, `이기면 열매 1개를 받아요 (하루 ${HS_RULE.winMax}개까지).`));
    sheet('🙈 숨바꼭질', body, () => { menuRooms = null; });
    drawRooms();
  }
  function newGame({ room = null, host = true }) {
    const me = o.getMe();
    G = {
      room, host, me: me.id, players: [], actors: new Map(), phase: 'lobby', round: 0, seeker: null,
      hidden: new Map(), found: [], checked: new Set(), chk: new Map(), endAt: 0, seekAt: 0, myHide: -1, lastCheck: 0, waiting: false, result: null, queue: [],
    };
    document.body.classList.add('hs-on');
    return G;
  }
  function meEntry() { const me = o.getMe(); return { pid: me.id, kind: 'kid', name: me.village_name || '나', av: me.avatar }; }
  function solo(n, iSeek) {
    closingSheet = true; o.modal.close(); closingSheet = false;
    if (o.beforeStart) o.beforeStart();
    newGame({});
    G.players = [meEntry(), ...HS_CPUS.slice(0, n).map((c, i) => ({ pid: `cpu${i}`, kind: 'cpu', ci: i, name: c.name, av: c.av }))];
    syncActors();
    hostStart(iSeek ? G.me : G.players[1 + Math.floor(Math.random() * n)].pid);
  }

  // ---------- 친구와 하기: 방장 대기실 ----------
  function makeRoom() {
    if (!o.hub) return;
    const room = o.hub.openRoom('hide', null);
    newGame({ room, host: true });
    lobby = { seats: [{ ...meEntry(), state: 'in' }], first: 'draw' };
    bindRoom(room);
    drawLobby();
    advertise();
  }
  function lobbyPlayers() { return lobby.seats.filter((s) => s.state === 'in'); }
  function sendLobby() {
    if (!G || !G.room) return;
    G.players = lobbyPlayers().map(({ state, ...p }) => p);
    G.room.send('L', { pl: pack() });
    advertise();
  }
  function drawLobby() {
    if (!lobby || !G) return;
    const S = lobby.seats;
    const full = S.length >= HS_RULE.max;
    const rows = S.map((s, i) => {
      const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
      drawFaceIcon(face, normalizeAvatar(s.av));
      const what = i === 0 ? '방장 (나)' : s.kind === 'cpu' && !s.bot ? '컴퓨터 친구' : s.state === 'wait' ? '물어보는 중…' : s.bot ? '예시 친구 (컴퓨터가 해요)' : '들어왔어요';
      return h('div', { class: 'fl-row' }, face, h('div', { class: 'fl-main' }, h('b', {}, s.name), h('span', {}, what)),
        i > 0 ? h('div', { class: 'fl-acts' }, h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => {
          if (s.state === 'wait' && G.room) G.room.cancelInvite(s.pid);
          lobby.seats = S.filter((x) => x !== s);
          if (s.kind === 'kid' && !s.bot && G.room) G.room.setMembers(lobby.seats.filter((x) => x.kind === 'kid' && !x.bot && x.state === 'in' && x.pid !== G.me).map((x) => x.pid));
          sendLobby(); drawLobby();
        } }, '빼기')) : null);
    });
    const freeCpu = HS_CPUS.findIndex((c, i) => !S.some((s) => s.kind === 'cpu' && s.ci === i));
    const ready = lobbyPlayers().length >= 2 && !S.some((s) => s.state === 'wait');
    const firstChips = h('div', { class: 'hs-nums' }, [['draw', '🎲 제비뽑기'], ['me', '👀 내가 술래']].map(([k, label]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(lobby.first === k), onclick: () => { lobby.first = k; drawLobby(); } }, label)));
    const body = h('div', { class: 'talk hs-menu' },
      h('div', { class: 'fl-list' }, rows),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft btn-small', type: 'button', disabled: full, onclick: () => pickFriend() }, '👋 친구 부르기'),
        h('button', { class: 'btn btn-soft btn-small', type: 'button', disabled: full || freeCpu < 0, onclick: () => { lobby.seats.push({ pid: `cpu${freeCpu}`, kind: 'cpu', ci: freeCpu, name: HS_CPUS[freeCpu].name, av: HS_CPUS[freeCpu].av, state: 'in' }); sendLobby(); drawLobby(); } }, '🌱 컴퓨터 친구 넣기')),
      h('h3', {}, '첫 술래'), firstChips,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { closingSheet = true; o.modal.close(); closingSheet = false; quit(); } }, '방 닫기'),
        h('button', { class: 'btn btn-go', type: 'button', disabled: !ready, onclick: () => startFromLobby() }, '시작하기')),
      h('p', { class: 'note' }, `${ready ? '모두 모였으면 시작해요!' : '두 명 넘게 모이면 시작할 수 있어요.'} 마을 친구 누구나 술래 나무에서 이 방을 보고 들어올 수 있어요.`));
    if (o.modal.isOpen && document.querySelector('.hs-sheet')) o.modal.setBody(body);
    else sheet('🙈 숨바꼭질 방', body, () => quit());
  }
  function pickFriend() {
    const inRoom = new Set(lobby.seats.map((s) => s.pid));
    const list = (o.onlineFriends ? o.onlineFriends() : []).filter((f) => f && !inRoom.has(f.id));
    o.modal.setBody(h('div', { class: 'talk hs-menu' },
      h('p', {}, '누구를 부를까요?'),
      friendPicker(list, (f) => invite(f)),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => drawLobby() }, '돌아가기'))));
  }
  async function invite(f) {
    if (!G || !G.room || !lobby) return;
    const seat = { pid: f.id, kind: 'kid', name: f.name, av: f.avatar, state: 'wait' };
    lobby.seats.push(seat);
    drawLobby();
    const r = await G.room.invite(f.id);
    if (!G || !lobby || !lobby.seats.includes(seat)) return;
    if (seat.state === 'in') { if (o.modal.isOpen) drawLobby(); return; } // 부르는 사이에 술래 나무에서 스스로 들어왔다
    if (r.ok) {
      seat.state = 'in';
      if (r.bot) { seat.kind = 'cpu'; seat.bot = true; }
      sendLobby();
    } else {
      lobby.seats = lobby.seats.filter((s) => s !== seat);
      const why = { locked: `${josa(f.name, '은', '는')} 아직 놀이 마당이 안 열렸대요.`, busy: `${josa(f.name, '은', '는')} 지금 다른 놀이를 하고 있어요.`, no: `${josa(f.name, '이', '가')} 다음에 하재요.`, timeout: `${josa(f.name, '이', '가')} 대답이 없어요.` }[r.reason];
      if (why) toast(why, 2600);
    }
    if (o.modal.isOpen) drawLobby();
  }
  function startFromLobby() {
    if (!lobby || !G) return;
    const pl = lobbyPlayers();
    if (pl.length < 2) return;
    G.players = pl.map(({ state, ...p }) => p);
    if (G.room) G.room.setMembers(G.players.filter((p) => p.kind === 'kid' && !p.bot && p.pid !== G.me).map((p) => p.pid));
    const firstMe = lobby.first === 'me';
    lobby = null;
    closingSheet = true; o.modal.close(); closingSheet = false;
    if (o.beforeStart) o.beforeStart();
    syncActors();
    const first = firstMe ? G.me : pick(G.players).pid;
    hostStart(first);
  }
  // 초대받아 들어감: 방장이 시작할 때까지 기다린다
  function join(room) {
    if (G) quit(true);
    newGame({ room, host: false });
    G.waiting = true;
    G.players = [];
    bindRoom(room);
    room.send('j', {});
    drawWait();
  }
  function drawWait() {
    if (!G || !G.waiting) return;
    const rows = G.players.map((p) => {
      const face = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
      drawFaceIcon(face, normalizeAvatar(p.av));
      return h('div', { class: 'fl-row' }, face, h('div', { class: 'fl-main' }, h('b', {}, p.name), h('span', {}, p.pid === G.room.hostId ? '방장' : p.kind === 'cpu' ? '컴퓨터 친구' : p.pid === G.me ? '나' : '친구')));
    });
    const body = h('div', { class: 'talk hs-menu' },
      h('p', { class: 'hs-lead' }, G.busy ? '지금 하는 판이 끝나면 다음 판부터 같이 해요!' : '방장이 시작하기를 기다려요!'),
      rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '방에 들어가는 중…'),
      howTo(),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { closingSheet = true; o.modal.close(); closingSheet = false; quit(); } }, '나가기')));
    if (o.modal.isOpen && document.querySelector('.hs-sheet')) o.modal.setBody(body);
    else sheet('🙈 숨바꼭질 방', body, () => quit());
  }
  function bindRoom(room) {
    room.on('msg', (m, from) => {
      if (!G || G.room !== room) return;
      if (G.host) { if (REQ.has(m.t)) hostReq(from, m); return; }
      if (from === room.hostId && EVT.has(m.t)) apply(m);
    });
    room.on('left', (id) => {
      if (!G || G.room !== room) return;
      if (!G.host && id === room.hostId) { finish('방장이 나가서 숨바꼭질이 끝났어요.'); return; }
      if (G.host) {
        if (lobby) { lobby.seats = lobby.seats.filter((s) => s.pid !== id); sendLobby(); if (o.modal.isOpen) drawLobby(); return; }
        dropPlayer(id);
      }
    });
  }

  // ---------- 그만하기 ----------
  function quit(silent = false) {
    if (!G) return;
    if (G.room) {
      if (G.host) { try { G.room.send('X', { w: 'host' }); } catch (e) { /* 무시 */ } } else { try { G.room.send('q', {}); } catch (e) { /* 무시 */ } }
      setTimeout(((r) => () => r.close())(G.room), 600);
    }
    finish(silent ? null : '숨바꼭질을 그만했어요.');
  }
  function finish(msg) {
    if (!G) return;
    const g = G;
    if (g.host && g.room && o.send) o.send('hroom', { g: g.room.gid, n: 0, m: HS_RULE.max, s: 2 }); // 방이 닫혔다고 알린다
    exitCount();
    exitHidden();
    for (const p of g.players) if (p.kind === 'kid' && p.pid !== g.me) { v.setHsHidden(p.pid, false); v.unpinRemote(p.pid); }
    for (const a of g.actors.values()) dropActor(a);
    g.actors.clear();
    if (g.room && !g.room.closed && !g.host) setTimeout(() => { if (!g.room.closed) g.room.close(); }, 600);
    G = null;
    lobby = null;
    if (isle()) isle().setRings(null);
    hud.hidden = true; bar.hidden = true; cover.hidden = true; result.hidden = true;
    document.body.classList.remove('hs-on', 'hs-lock');
    o.setActivity('');
    o.setScene('village');
    if (o.modal.isOpen && document.querySelector('.hs-sheet')) { closingSheet = true; o.modal.close(); closingSheet = false; }
    if (msg) toast(msg, 2600);
  }

  return {
    open, join, onSpot, promptAct, quit, onNet, peerLeft,
    get rooms() { return openRooms(); },
    get active() { return !!G; },
    get hidden() { return !!(G && G.myHide >= 0); },
    get state() { return G ? { phase: G.phase, seeker: G.seeker, hidden: [...G.hidden], found: [...G.found], checked: [...G.checked], players: G.players.map((p) => p.pid), queue: (G.queue || []).map((p) => p.pid), waiting: !!G.waiting, me: G.me, myHide: G.myHide, host: G.host, blind: !!G.blind, result: G.result && { ...G.result },
      actors: [...G.actors.values()].map((a) => ({ p: a.pid, m: a.brain.mode, k: a.brain.k, arr: a.arrived, hid: a.hidden, x: +a.av.root.position.x.toFixed(1), z: +a.av.root.position.z.toFixed(1), via: a.via.length, go: !!a.target })) } : null; },
  };
}
