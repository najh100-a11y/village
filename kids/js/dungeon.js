// 진숲 어린이 마을 — 새벽 동굴 (하나님의 전신갑주)
// 마을 북서쪽 바위 동굴에 들어가면 '갑주의 방'에서 하나님의 전신갑주를 하나씩 입고(엡 6:14-17) 기도한 뒤(엡 6:18) 동굴을 고른다.
// 동굴마다 방이 몇 개 있고, 방마다 갑주 하나로 이기는 시험이 있다(dungeon-trials.js). 마지막은 끝까지 서서 새벽을 맞는 '새벽의 방'이다.
// 놀이 마당처럼 그날 말씀 활동을 해야 들어갈 수 있고, 혼자도 친구와 함께(넷까지)도 할 수 있다. 동굴을 깨면 하루 상한(5개) 안에서 열매를 받는다.
// 동굴 안은 마을과 따로 된 장면이다. 마을의 내 주민은 동굴 앞에 서 있고, 동굴 안에는 갑주를 입는 내 주민을 따로 만든다.
// 친구와 함께 할 때: 방장이 방(hub 'dgn')을 열고 친구를 부른다. 시험은 아이마다 자기 화면에서 하고(같은 씨앗),
// 모두 통과하면 방장이 다음 방으로 데려간다. 쓰러진 친구는 기도로 일으키고, 새벽의 방에서는 모두의 힘을 모아 새벽을 맞는다.
import * as THREE from './three.module.min.js';
import { Avatar } from './avatar.js';
import { normalizeAvatar, drawFaceIcon } from './face.js';
import { h, modal, toast, josa, confetti } from './ui.js';
import { message, store } from './api.js';
import { sfx } from './sound.js';
import { friendPicker } from './play.js';
import { ARMOR, PRAYER, ENTRY_PRAYER, KEY_VERSE, FIGHT_VERSE, STAND_VERSE, WIN_VERSE, TRIALS, DUNGEONS, DG_DAY, DG_MAX_PARTY, roomsOf, dungeonById, armorById } from './dungeon-data.js';
import { buildCave, dressAvatar, armorDisplay, pedestal, makeSparks, makeBibleStand, rngOf, disposeObj } from './dungeon-scene.js';
import { makeTrial } from './dungeon-trials.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const NORTH = Math.PI;
const SLOT_X = [0, -1.35, 1.35, -2.7];
const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
export const CAVE_DOOR_ID = 'dungeon';

// 자세: 쓰러짐(바닥에 주저앉음), 기도(무릎 꿇고 두 손 모음), 만세, 검 휘두르기, 방패 들기
function poseFn(P) {
  return (a, dt, t) => {
    a.head.rotation.x = 0;
    const act = P.fallen ? 'fall' : P.act;
    if (act === 'fall') {
      a.legs[0].rotation.x = a.legs[1].rotation.x = -1.45;
      a.body.position.y = -0.24;
      a.body.rotation.x = -0.2;
      a.arms[0].rotation.x = a.arms[1].rotation.x = -0.35;
      a.arms[0].rotation.z = -0.5; a.arms[1].rotation.z = 0.5;
      a.head.rotation.x = 0.25;
      return;
    }
    if (act === 'pray') {
      a.legs[0].rotation.x = a.legs[1].rotation.x = 1.25;
      a.body.position.y = -0.2;
      a.body.rotation.x = 0.08;
      a.arms[0].rotation.x = a.arms[1].rotation.x = -1.05;
      a.arms[0].rotation.z = 0.55; a.arms[1].rotation.z = -0.55;
      a.head.rotation.x = 0.28;
      return;
    }
    if (act === 'cheer') {
      a.arms[0].rotation.x = a.arms[1].rotation.x = -2.9;
      a.arms[0].rotation.z = -0.3; a.arms[1].rotation.z = 0.3;
      a.body.position.y = Math.abs(Math.sin(t * 6)) * 0.07;
    }
    if (act === 'strike') {
      const k = 1 - clamp01((P.actT || 0) / 0.45);
      a.arms[0].rotation.x = -2.95 + 1.8 * ease(k * 1.4);
      a.arms[0].rotation.z = -0.1;
    }
    if (P.dress) P.dress.armPose(a);
  };
}

export function createDungeon({ v, ui, begin, stopAll, portrait, rpc, getToken, lost, onCelebrate, features, hub, myId, getMe, getPerson, onlineFriends, setFruits }) {
  let cave = null, sparks = null;
  let R = null; // 동굴 안에 있을 때의 모든 것
  let book = { clears: {}, best: {}, today: 0, cap: DG_DAY };
  const remotes = new Map();
  const keys = new Set();
  const me = { av: null, dress: null, act: '', actT: 0, task: null, fallen: false, moving: false, tag: null };
  let game = null, fadeEl = null, hurtEl = null;
  const btn = { pray: null, friends: null, book: null };
  const meId = () => (myId ? myId() : null);
  const nameOf = (id) => (id === meId() ? '나' : ((getPerson && getPerson(id)) || {}).name || '친구');
  const quickDress = () => store.get('dgn.dressed') === '1';

  // ---------- 화면 도구 ----------
  function fade(fn, ms = 420) {
    if (!fadeEl) { fadeEl = h('div', { class: 'dg-fade', 'aria-hidden': 'true' }); document.body.append(fadeEl); }
    fadeEl.classList.add('on');
    setTimeout(() => { try { fn(); } finally { if (fadeEl) fadeEl.classList.remove('on'); } }, ms);
  }
  function hurtFlash() {
    if (!hurtEl) { hurtEl = h('div', { class: 'dg-hurt', 'aria-hidden': 'true' }); document.body.append(hurtEl); }
    hurtEl.classList.remove('on'); void hurtEl.offsetWidth; hurtEl.classList.add('on');
  }
  const wideLayout = () => matchMedia('(min-width: 760px) and (min-aspect-ratio: 5/4)').matches;
  // 판과 단추가 가리는 곳을 재서 마을 카메라에 알린다 (남은 칸 가운데에 동굴이 보이게)
  function measureCover() {
    if (!game) return;
    const H = window.innerHeight;
    const top = ui.root.querySelector('.g-top'), bottom = ui.root.querySelector('.g-bottom'), panel = ui.panel;
    const tb = top ? top.getBoundingClientRect().bottom : 0;
    let bt = bottom ? bottom.getBoundingClientRect().top : H;
    let left = 0;
    const pr = panel && panel.childElementCount ? panel.getBoundingClientRect() : null;
    if (pr && pr.height > 0) { if (wideLayout()) left = pr.right; else bt = Math.min(bt, pr.top); }
    game.cover = { top: tb, bottom: Math.max(0, H - bt), left };
  }
  function setCam(pos, look) {
    const P = V(...pos), L = V(...look);
    if (portrait()) P.sub(L).multiplyScalar(1.55).add(L);
    game.cam.pos.copy(P);
    game.cam.look.copy(L);
  }
  function screenOf(p) {
    const q = p.clone().project(v.camera);
    const rect = v.canvas.getBoundingClientRect();
    return { x: rect.left + (q.x * 0.5 + 0.5) * rect.width, y: rect.top + (-q.y * 0.5 + 0.5) * rect.height };
  }
  const ground = new THREE.Plane(V(0, 1, 0), 0);
  function groundAt(x, y) { const p = V(); return v.rayAt(x, y).ray.intersectPlane(ground, p) ? p : null; }
  const roomLabels = new Set();
  const pops = [];
  function label(text, cls) { const el = ui.label(text); if (cls) el.classList.add(...cls.split(' ')); roomLabels.add(el); return el; }
  function unlabel(el) { if (el) { el.remove(); roomLabels.delete(el); } }
  function flashLabel(el, pos) { pops.push({ el, p: pos.clone(), life: 0.8 }); }
  function clearLabels() { for (const el of roomLabels) el.remove(); roomLabels.clear(); pops.length = 0; }

  // ---------- 내 주민 (동굴 안) ----------
  function place(x, z, rot = NORTH) { const p = me.av.root.position; p.set(x, 0, z); me.av.root.rotation.y = rot; me.task = null; }
  function face(rot) { me.av.root.rotation.y = rot; }
  function walkTo(x, z, cb, speed = 2.6) {
    const p = me.av.root.position;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > 0.05) face(Math.atan2(x - p.x, z - p.z));
    me.task = { kind: 'walk', from: p.clone(), to: V(x, 0, z), t: 0, dur: Math.max(0.05, d / speed), cb };
  }
  function hopTo(x, z, cb, dur = 0.42) {
    const p = me.av.root.position;
    if (Math.hypot(x - p.x, z - p.z) > 0.05) face(Math.atan2(x - p.x, z - p.z));
    me.task = { kind: 'hop', from: p.clone(), to: V(x, 0, z), t: 0, dur, cb };
    sfx.hop();
  }
  function act(code, dur = 0.5) { me.act = code; me.actT = dur; }
  // 방향 자판·방향 단추(화면 방향)나 누르고 있는 곳으로 걷는다
  function steer(dt, aim, lim) {
    if (me.task) return;
    let kx = 0, kz = 0;
    if (keys.has('u')) kz -= 1;
    if (keys.has('d')) kz += 1;
    if (keys.has('l')) kx -= 1;
    if (keys.has('r')) kx += 1;
    const yw = v.view.game.yaw, c = Math.cos(yw), s = Math.sin(yw);
    let dx = kx * c + kz * s, dz = -kx * s + kz * c;
    const p = me.av.root.position;
    if (!dx && !dz && aim) { dx = aim.x - p.x; dz = aim.z - p.z; if (Math.hypot(dx, dz) < 0.15) dx = dz = 0; }
    const d = Math.hypot(dx, dz);
    if (!d) return;
    p.x += (dx / d) * 3.4 * dt;
    p.z += (dz / d) * 3.4 * dt;
    if (lim) {
      const ox = p.x - lim.x, oz = p.z - lim.z, od = Math.hypot(ox, oz);
      if (od > lim.r) { p.x = lim.x + (ox / od) * lim.r; p.z = lim.z + (oz / od) * lim.r; }
    }
    face(Math.atan2(dx, dz));
    me.moving = true;
  }
  function makeMe() {
    const mine = getMe ? getMe() : null;
    me.av = new Avatar(normalizeAvatar({ ...((mine && mine.avatar) || {}), hat: 'none' })); // 투구를 쓰려고 모자는 벗는다
    me.dress = dressAvatar(me.av);
    me.av.pose = poseFn(me);
    me.av.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    cave.scene.add(me.av.root);
  }
  function dropMe() {
    if (!me.av) return;
    me.dress.remove();
    me.av.root.removeFromParent();
    me.av.dispose();
    me.av = null; me.dress = null; me.task = null; me.act = ''; me.fallen = false;
  }

  // ---------- 친구 (동굴 안) ----------
  const mySlot = () => (R ? Math.max(0, R.slots.indexOf(meId())) : 0);
  const realFriends = () => (R ? R.slots.filter((id) => id && id !== meId() && !R.bots.has(id)) : []);
  const partyCount = () => (R ? R.slots.filter(Boolean).length : 1);
  function ensureRemote(id) {
    if (!id || id === meId()) return null;
    if (remotes.has(id)) return remotes.get(id);
    const p = getPerson ? getPerson(id) : null;
    const av = new Avatar(normalizeAvatar({ ...((p && p.avatar) || {}), hat: 'none' }));
    cave.scene.add(av.root);
    const r = { id, av, dress: dressAvatar(av), tag: ui.label(nameOf(id)), target: V(), rot: NORTH, act: '', actT: 0, fallen: false, h: 3, dr: 0, d: 0, k: -1, c: 0, robe: 0, bot: R.bots.has(id), at: performance.now() };
    r.tag.classList.add('dg-name');
    av.pose = poseFn(r);
    remotes.set(id, r);
    if (r.bot) setDressed(r, ARMOR.length);
    homeRemote(r);
    av.root.position.copy(r.target);
    return r;
  }
  function setDressed(r, n) {
    n = Math.max(0, Math.min(ARMOR.length, n | 0));
    if (n === r.dr) return;
    if (n < r.dr) r.dress.remove();
    for (let i = 0; i < n; i++) r.dress.put(ARMOR[i].id);
    r.dr = n;
  }
  function homeRemote(r) {
    const i = Math.max(0, R.slots.indexOf(r.id));
    const z = R.homeZ != null ? R.homeZ : 1.4;
    r.target.set(SLOT_X[i] || 0, 0, z);
    r.rot = R.phase === 'lobby' ? 0 : NORTH;
  }
  function dropRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    r.dress.remove();
    r.av.root.removeFromParent();
    r.av.dispose();
    r.tag.remove();
    remotes.delete(id);
  }
  function syncRemotes() {
    for (const id of [...remotes.keys()]) if (!R.slots.includes(id)) dropRemote(id);
    for (const id of R.slots) if (id && id !== meId()) ensureRemote(id);
  }
  function onP(from, m) {
    const r = remotes.get(from);
    if (!r || r.bot) return;
    const num = (x, d = 0) => (Number.isFinite(x) ? x : d);
    r.target.set(num(m.x), Math.max(0, num(m.y)), num(m.z));
    r.rot = num(m.r, NORTH);
    if (m.a !== r.act) { r.act = typeof m.a === 'string' ? m.a.slice(0, 8) : ''; r.actT = r.act === 'strike' ? 0.45 : 0; }
    r.dress.st.guardTo = m.g ? 1 : 0;
    r.h = num(m.h, 3);
    r.fallen = m.f === 1;
    setDressed(r, num(m.dr));
    r.d = Math.max(0, num(m.d));
    r.k = num(m.k, -1);
    r.c = m.c === 1 ? 1 : 0;
    if (!!m.rb !== !!r.robe) { r.robe = m.rb ? 1 : 0; r.dress.setRobe(!!r.robe); }
    r.at = performance.now();
    if (R && R.phase === 'play' && R.run && R.run.rooms[R.run.i].t === 'dawn') checkDawn();
    if (R && R.phase === 'cleared' && !R.host) { const w = waitingFor().join(','); if (w !== R.waitKey) { R.waitKey = w; drawCleared(); } }
  }
  function tickRemotes(dt) {
    for (const r of remotes.values()) {
      const p = r.av.root.position;
      const dx = r.target.x - p.x, dz = r.target.z - p.z, d = Math.hypot(dx, dz);
      const k = 1 - Math.exp(-dt * 9);
      p.x += dx * k; p.z += dz * k; p.y += (r.target.y - p.y) * k;
      let dr = r.rot - r.av.root.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      r.av.root.rotation.y += dr * Math.min(1, dt * 10);
      if (r.actT > 0) { r.actT -= dt; if (r.actT <= 0 && r.act === 'strike') r.act = ''; }
      r.av.update(dt, d > 0.06 && !r.fallen, 1);
      r.dress.update(dt);
      const txt = `${nameOf(r.id)}${r.fallen ? ' 🙏' : ''}${r.c && R.phase !== 'lobby' ? ' ✓' : ''}`;
      if (r.tag.textContent !== txt) r.tag.textContent = txt;
      r.tag.classList.toggle('down', r.fallen);
      ui.place(r.tag, p, 2.55);
    }
  }

  // ---------- 방 보내기 ----------
  function sendP(force = false) {
    if (!R || !R.room || !realFriends().length || !me.av) return;
    const p = me.av.root.position;
    const m = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r: +me.av.root.rotation.y.toFixed(2), a: me.act || '', g: me.dress.st.guardTo ? 1 : 0,
      h: R.hearts, f: me.fallen ? 1 : 0, dr: R.dressed, d: R.myD, k: R.run ? R.run.i : -1, c: R.phase === 'cleared' || R.phase === 'done' ? 1 : 0, rb: me.dress.robeOn() ? 1 : 0 };
    const key = JSON.stringify(m);
    const now = performance.now();
    if (!force && key === R.lastP && now - R.lastPAt < 2500) return;
    R.lastP = key; R.lastPAt = now;
    if (R.room.blast) R.room.blast('~P', m);
  }
  function sendRoster() {
    if (!R || !R.host) return;
    if (R.room && R.room.setMembers) R.room.setMembers(R.slots.filter((id) => id && !R.bots.has(id)));
    if (R.room) R.room.send('L', { sl: R.slots, rd: [...R.ready], dg: R.dg });
    syncRemotes();
    drawLobby();
  }

  // ---------- 서버 ----------
  function normBook(r) {
    const b = { clears: {}, best: {}, today: 0, cap: DG_DAY };
    if (r && typeof r === 'object') {
      for (const row of Array.isArray(r.rows) ? r.rows : []) {
        if (row && typeof row.dg === 'string') { b.clears[row.dg] = row.clears | 0; if (Number.isFinite(row.best_ms)) b.best[row.dg] = row.best_ms; }
      }
      if (Number.isFinite(r.today)) b.today = r.today;
      if (Number.isFinite(r.cap)) b.cap = r.cap;
    }
    return b;
  }
  async function loadBook() {
    try {
      const r = await rpc('kids_dungeon_book', { p_token: getToken() });
      book = normBook(r);
    } catch (e) { if (lost(e)) return; }
    if (!R) return;
    if (R.host && !R.picked) { R.picked = true; R.dg = suggest(); }
    if (R.host && !unlocked(DUNGEONS.findIndex((d) => d.id === R.dg))) R.dg = DUNGEONS[0].id;
    if (R.host) sendRoster(); else drawLobby();
  }
  const unlocked = (i) => i === 0 || (i > 0 && i < DUNGEONS.length && (book.clears[DUNGEONS[i - 1].id] || 0) > 0);
  // 아직 안 깬 동굴 가운데 가장 앞 (모두 깼으면 마지막)
  function suggest() {
    for (let i = 0; i < DUNGEONS.length; i++) if (unlocked(i) && !(book.clears[DUNGEONS[i].id] > 0)) return DUNGEONS[i].id;
    return DUNGEONS[DUNGEONS.length - 1].id;
  }

  // ---------- 들어가기 ----------
  function enter() {
    if (R) return;
    if (!features().dungeon) { toast('새벽 동굴은 곧 열려요! 조금만 기다려 줘요.', 2600); return; }
    open({ room: hub ? hub.openRoom('dgn') : null, host: true });
    loadBook();
  }
  // 친구가 부른 동굴에 들어간다 (초대 카드에서 '좋아!')
  function join(session) {
    if (R) leave();
    open({ room: session, host: false });
    loadBook();
  }
  function open({ room, host }) {
    stopAll();
    if (!cave) { cave = buildCave(); sparks = makeSparks(cave.scene); }
    cave.clearProps(); cave.setDawn(0); cave.setGate(0);
    R = {
      room, host, slots: host ? [meId()] : [room.hostId, meId()], ready: new Set(), bots: new Set(),
      phase: 'lobby', dressed: 0, prayed: false, dressing: false, praying: false, dg: DUNGEONS[0].id,
      run: null, trial: null, hearts: 3, inv: 0, prayCd: 0, fallenAt: 0, falls: 0, myD: 0, botD: 0,
      flights: [], displays: [], mainSpec: null, homeZ: 1.4, sendT: 0, lastP: '', lastPAt: 0, autoT: 0,
    };
    if (room) bind(room);
    // 마을의 내 주민은 동굴 문 앞에 선다 (마을 친구들에게는 동굴 앞에 있는 것으로 보인다)
    const door = v.doors.find((d) => d.id === CAVE_DOOR_ID);
    if (door && v.player) {
      const cx = door.group ? door.group.position.x : door.pos.x, cz = door.group ? door.group.position.z : door.pos.z - 1;
      v.placePlayer(door.pos.x, door.pos.z, Math.atan2(cx - door.pos.x, cz - door.pos.z));
    }
    if (v.player) v.player.drop();
    game = {
      scene: cave.scene,
      cam: { pos: V(0, 8, 11), look: V(0, 0.8, -1) },
      camSpeed: 3.2,
      update: (dt, t) => tick(dt, t),
      onPointer: (type, x, y) => { if (R && R.phase === 'play' && R.trial && !me.fallen) R.trial.onPointer(type, x, y); },
      onTap: () => {},
      ownsDrag: () => !!(R && R.phase === 'play' && R.trial && R.trial.ownsDrag),
      onExit: () => askExit(),
      stop: () => leave(),
      debug: () => debug(),
    };
    makeMe();
    begin('dgn', '새벽 동굴', game, [['pray', '기도', () => onPrayBtn()], ['leaf', '친구 부르기', () => pickFriend()]], mySlot(), [['book', '갑주 이야기', () => openArmorBook()]]);
    const rounds = ui.root.querySelectorAll('.g-side .round');
    [btn.pray, btn.friends, btn.book] = rounds;
    document.body.classList.add('in-cave');
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    syncRemotes();
    buildLobby();
    // 처음 시점은 바로 동굴 안으로 (마을에서 날아오지 않게)
    v.camPos.copy(game.cam.pos);
    v.camLook.copy(game.cam.look);
    if (!host) R.room.send('R', { r: 0 });
    sfx.door();
  }
  function bind(room) {
    room.on('msg', (m, from) => onRoomMsg(m, from));
    room.on('left', (id) => onLeft(id));
  }

  // ---------- 갑주의 방 ----------
  const PED = ARMOR.map((a, i) => { const th = (i - 2.5) * 0.38; return { x: Math.sin(th) * 4.2, z: -0.9 - Math.cos(th) * 3.1 }; });
  function buildLobby() {
    endTrial();
    cave.clearProps();
    cave.setDawn(0);
    cave.setGate(0);
    R.phase = 'lobby';
    R.homeZ = 2.0;
    R.displays = ARMOR.map((a, i) => {
      const pd = pedestal(a.color);
      pd.position.set(PED[i].x, 0, PED[i].z);
      cave.props.add(pd);
      const d = armorDisplay(a.id);
      d.position.set(PED[i].x, 1.75, PED[i].z);
      d.visible = i >= R.dressed;
      cave.props.add(d);
      return { a, d, pd, ph: i * 0.9 };
    });
    const bs = makeBibleStand();
    bs.position.set(0, 0, -1.3);
    cave.props.add(bs);
    place((SLOT_X[mySlot()] || 0), R.homeZ, 0); // 갑주의 방에서는 카메라 쪽을 본다 (입은 갑주가 잘 보이게)
    for (const r of remotes.values()) homeRemote(r);
    setCam([0, 9.6, 14.2], [0, 0.9, -1.0]);
    document.body.classList.remove('pad-game');
    drawLobby();
  }
  function allReady() { return R.slots.filter(Boolean).every((id) => R.ready.has(id)); }
  function drawLobby() {
    if (!R || R.phase !== 'lobby' || !game) return;
    const party = partyCount() > 1;
    if (btn.friends) btn.friends.style.display = R.host ? '' : 'none';
    if (btn.pray) btn.pray.style.display = 'none';
    if (btn.book) btn.book.style.display = '';
    const hud = h('div', { class: 'dg-hud' }, h('span', {}, `🍎 오늘 동굴 열매 ${Math.min(book.today, book.cap)}/${book.cap}`), party ? h('span', {}, `👫 ${partyCount()}명`) : null);
    if (R.dressed < ARMOR.length) {
      const quick = quickDress();
      ui.say(R.dressed ? '다음 갑주를 입어요.' : '갑주의 방이에요. 하나님의 전신갑주를 입어요!', '새벽 동굴 · 갑주의 방');
      ui.setMain(R.dressing ? '…' : quick ? '전신갑주 입기' : `갑주 입기 ${R.dressed + 1}/6`, { disabled: R.dressing, pulse: !R.dressing, onClick: () => dressNext() });
      const last = R.dressed ? ARMOR[R.dressed - 1] : null;
      ui.setPanel(hud, last && !quick ? armorCard(last) : verseCard('🛡️ 하나님의 전신갑주', KEY_VERSE, '마귀의 꾀를 이기려면 하나님이 주시는 갑주를 입어야 해요. 내 힘이 아니라 주님의 힘으로 강해져요.'));
      return;
    }
    if (!R.prayed) {
      ui.say('갑주를 다 입었어요! 이제 기도로 준비해요.', '새벽 동굴 · 갑주의 방');
      ui.setMain(R.praying ? '기도하는 중…' : '기도하기', { disabled: R.praying, pulse: !R.praying, onClick: () => pray() });
      ui.setPanel(hud, h('div', { class: 'dg-card pray' }, h('div', { class: 'dg-card-h' }, '🙏 마음속으로 따라 기도해요'), h('p', { class: 'dg-prayer' }, ENTRY_PRAYER),
        h('p', { class: 'dg-verse' }, PRAYER.verse, h('cite', {}, PRAYER.ref))));
      return;
    }
    // 동굴 고르기
    const d = dungeonById(R.dg) || DUNGEONS[0];
    const di = DUNGEONS.indexOf(d);
    let main, wait = '';
    if (R.host) {
      const notReady = R.slots.filter((id) => id && !R.ready.has(id));
      if (notReady.length) wait = `${notReady.map((id) => nameOf(id)).join(', ')} 준비하는 중…`;
      main = { label: notReady.length ? '기다리는 중' : '들어가기!', disabled: !!notReady.length || !unlocked(di), pulse: !notReady.length, onClick: () => startRun() };
    } else main = { label: '방장을 기다려요', disabled: true, pulse: false, onClick: () => {} };
    ui.say(R.host ? (party ? '동굴을 고르고 모두 준비되면 들어가요!' : '들어갈 동굴을 골라요. 동굴을 깨면 다음 동굴이 열려요.') : `${nameOf(R.slots[0])} 방장이 동굴을 고르고 있어요.`, '새벽 동굴 · 갑주의 방');
    ui.setMain(main.label, main);
    const list = h('div', { class: 'dg-list', role: 'listbox', 'aria-label': '동굴 고르기' }, DUNGEONS.map((x, i) => {
      const open = unlocked(i), n = book.clears[x.id] || 0;
      return h('button', {
        class: 'dg-pick' + (x.id === R.dg ? ' on' : '') + (open ? '' : ' locked') + (n ? ' done' : ''), type: 'button', role: 'option', 'aria-selected': String(x.id === R.dg),
        disabled: !R.host || !open, onclick: () => { R.dg = x.id; sfx.tap(); sendRoster(); },
      }, h('span', { class: 'dg-ic', 'aria-hidden': 'true' }, open ? x.icon : '🔒'), h('b', {}, x.name), h('small', {}, `🍎${x.fruit}${n ? ` · ✓${n}` : ''}`));
    }));
    const rooms = roomsOf(d).map((rm) => { const t = TRIALS[rm.t]; const a = t.armor ? armorById(t.armor) : null; return h('span', { class: 'dg-room' }, `${a ? a.icon : '🌅'} ${t.name}`); });
    const roster = party ? h('div', { class: 'lr-roster dg-roster' }, R.slots.filter(Boolean).map((id, i) => chip(id, i === 0 ? ' 👑' : '', R.ready.has(id) ? ' ✓' : ' …'))) : null;
    ui.setPanel(hud, h('div', { class: 'dg-picker' }, list,
      h('p', { class: 'dg-desc' }, `${d.icon} ${d.name}: ${d.desc}`),
      h('div', { class: 'dg-rooms' }, rooms),
      !unlocked(di) ? h('p', { class: 'dg-hint' }, '앞 동굴을 깨면 열려요.') : null,
      wait ? h('p', { class: 'dg-hint' }, wait) : null), roster);
    // 처음 들어온 아이는 아직 안 깬 첫 동굴을 고른 채로
  }
  function chip(id, pre, post) {
    const cv = h('canvas', { width: 40, height: 40, class: 'lr-face', 'aria-hidden': 'true' });
    const p = id === meId() ? getMe && getMe() : getPerson && getPerson(id);
    drawFaceIcon(cv, normalizeAvatar(p && p.avatar));
    return h('span', { class: 'lr-chip' + (id === meId() ? ' me' : '') }, cv, `${nameOf(id)}${pre}${post}`);
  }
  function armorCard(a) {
    return h('div', { class: 'dg-card' }, h('div', { class: 'dg-card-h' }, `${a.icon} ${a.name}`),
      h('p', { class: 'dg-verse' }, a.verse, h('cite', {}, a.ref)), h('p', { class: 'dg-mean' }, a.meaning));
  }
  function verseCard(title, vv, note) {
    return h('div', { class: 'dg-card' }, h('div', { class: 'dg-card-h' }, title), h('p', { class: 'dg-verse' }, vv.text, h('cite', {}, vv.ref)), note ? h('p', { class: 'dg-mean' }, note) : null);
  }
  // 갑주를 입는다: 처음에는 하나씩 (말씀과 뜻을 읽으며), 한 번 다 입어 본 뒤로는 한 번에
  function dressNext() {
    if (!R || R.phase !== 'lobby' || R.dressing || R.dressed >= ARMOR.length) return;
    R.dressing = true;
    if (quickDress()) {
      const start = R.dressed;
      ARMOR.slice(start).forEach((a, k) => setTimeout(() => { if (R && R.phase === 'lobby') fly(start + k, k === ARMOR.length - 1 - start); }, k * 330));
    } else fly(R.dressed, true);
    drawLobby();
  }
  function fly(i, lastOne) {
    const D = R.displays[i];
    if (!D) return;
    const from = D.d.position.clone();
    R.flights.push({ D, i, from, t: 0, dur: 0.5, lastOne });
    sfx.whoosh();
  }
  function landed(f) {
    f.D.d.visible = false;
    me.dress.put(f.D.a.id);
    R.dressed = Math.max(R.dressed, f.i + 1);
    const p = me.av.root.position;
    sparks.burst(V(p.x, 1.1, p.z), f.D.a.color, 14, 0.8, 1.1);
    sfx.ding();
    if (quickDress()) ui.banner(f.D.a.name, f.D.a.ref, 700);
    else ui.banner(f.D.a.name, `${f.D.a.ref} · 입었어요!`, 1500);
    if (f.lastOne || R.dressed >= ARMOR.length) R.dressing = false;
    if (R.dressed >= ARMOR.length) store.set('dgn.dressed', '1');
    sendP(true);
    drawLobby();
  }
  function pray() {
    if (!R || R.phase !== 'lobby' || R.dressed < ARMOR.length || R.prayed || R.praying) return;
    R.praying = true;
    act('pray', 3.0);
    drawLobby();
    sendP(true);
    setTimeout(() => {
      if (!R || !R.praying) return;
      R.praying = false;
      R.prayed = true;
      const p = me.av.root.position;
      sparks.burst(V(p.x, 1.4, p.z), '#FFF3B0', 26, 1, 1.6);
      sfx.bell();
      ui.banner('아멘!', '말씀과 기도로 준비했어요', 1800);
      markReady();
      drawLobby();
    }, 3000);
  }
  function markReady() {
    if (!R || !R.prayed) return;
    if (R.host) { R.ready.add(meId()); sendRoster(); } else if (R.room) R.room.send('R', { r: 1 });
  }
  function openArmorBook() {
    modal.open('하나님의 전신갑주', h('div', { class: 'talk dg-book' },
      h('p', { class: 'dg-verse' }, KEY_VERSE.text, h('cite', {}, KEY_VERSE.ref)),
      h('p', { class: 'dg-verse' }, FIGHT_VERSE.text, h('cite', {}, FIGHT_VERSE.ref)),
      h('p', { class: 'dg-mean' }, '우리가 싸우는 것은 사람이 아니라 거짓말, 두려움, 참소 같은 어둠이에요. 그래서 동굴의 그림자는 미워할 친구가 아니라, 말씀과 빛으로 물리칠 어둠이에요.'),
      ARMOR.map((a) => h('div', { class: 'dg-card' }, h('div', { class: 'dg-card-h' }, `${a.icon} ${a.name}`), h('p', { class: 'dg-verse' }, a.verse, h('cite', {}, a.ref)), h('p', { class: 'dg-mean' }, a.meaning))),
      h('div', { class: 'dg-card' }, h('div', { class: 'dg-card-h' }, '🙏 기도'), h('p', { class: 'dg-verse' }, PRAYER.verse, h('cite', {}, PRAYER.ref)), h('p', { class: 'dg-mean' }, PRAYER.meaning)),
      h('p', { class: 'dg-verse' }, STAND_VERSE.text, h('cite', {}, STAND_VERSE.ref)),
      h('p', { class: 'note' }, '성경 말씀은 개역한글판이에요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => modal.close() }, '알겠어요'))), { cls: 'game-sheet' });
  }

  // ---------- 친구 부르기 (방장, 갑주의 방에서) ----------
  function pickFriend() {
    if (!R || !R.host) return;
    if (R.phase !== 'lobby') { toast('갑주의 방에서 친구를 부를 수 있어요.', 2200); return; }
    if (partyCount() >= DG_MAX_PARTY) { toast(`${DG_MAX_PARTY}명까지 함께 갈 수 있어요.`, 2200); return; }
    const inRoom = new Set(R.slots);
    const list = (onlineFriends ? onlineFriends() : []).filter((f) => f && !inRoom.has(f.id));
    modal.open('새벽 동굴에 친구 부르기', h('div', { class: 'talk' }, h('p', {}, `누구를 부를까요? (${DG_MAX_PARTY}명까지)`), friendPicker(list, (f) => { modal.close(); invite(f); })), { cls: 'game-sheet' });
  }
  async function invite(f) {
    if (!R || !R.host || !R.room) return;
    toast(`${josa(f.name, '을', '를')} 부르는 중이에요…`, 2000);
    const r = await R.room.invite(f.id);
    if (!R || !R.host) return;
    if (r.ok) {
      if (!R.slots.includes(f.id)) {
        if (partyCount() >= DG_MAX_PARTY) return;
        R.slots.push(f.id);
      }
      if (r.bot) { R.bots.add(f.id); R.ready.add(f.id); }
      sfx.ding();
      toast(`${josa(f.name, '이가', '가')} 왔어요!`, 2000);
      sendRoster();
    } else {
      const why = { busy: `${josa(f.name, '은', '는')} 지금 다른 놀이를 하고 있어요.`, no: `${josa(f.name, '이', '가')} 다음에 하재요.`, timeout: `${josa(f.name, '이', '가')} 대답이 없어요.`, off: '지금은 친구와 연결되지 않아요.', locked: `${josa(f.name, '은', '는')} 아직 오늘 말씀 활동을 안 했대요.` }[r.reason];
      if (why) toast(why, 2600);
    }
  }

  // ---------- 동굴 탐험 ----------
  function startRun() {
    if (!R || !R.host || R.phase !== 'lobby' || !R.prayed || !allReady()) return;
    const i = DUNGEONS.findIndex((d) => d.id === R.dg);
    if (!unlocked(i)) return;
    const seed = Math.floor(Math.random() * 1e9);
    if (R.room && realFriends().length) R.room.send('G', { dg: R.dg, seed });
    goRun(R.dg, seed);
  }
  function goRun(dg, seed) {
    const d = dungeonById(dg);
    if (!d) return;
    R.dg = dg;
    R.run = { d, rooms: roomsOf(d), i: -1, seed, t0: performance.now(), cleared: new Set() };
    R.ready = new Set();
    R.falls = 0;
    R.phase = 'moving'; // 다음 화면으로 넘어가는 동안 (단추를 두 번 눌러도 한 번만)
    if (btn.friends) btn.friends.style.display = 'none';
    if (btn.book) btn.book.style.display = 'none'; // 동굴 안에서는 단추를 줄인다 (휴대폰에서 판을 가리지 않게)
    sfx.open();
    enterRoom(0);
  }
  function endTrial() {
    if (R && R.trial) { try { R.trial.stop(); } catch (e) { console.error(e); } }
    if (R) R.trial = null;
    clearLabels();
    if (me.dress) { me.dress.setRobe(false); me.dress.st.guardTo = 0; }
    document.body.classList.remove('pad-game');
  }
  function enterRoom(i) {
    fade(() => {
      if (!R || !R.run) return;
      endTrial();
      R.run.i = i;
      R.run.cleared = new Set();
      R.hearts = 3; R.inv = 0; R.prayCd = 0; R.myD = 0; R.botD = 0; R.autoT = 0;
      me.fallen = false; me.act = ''; me.task = null;
      R.phase = 'intro';
      R.body = [];
      R.over = null;
      cave.clearProps();
      cave.setGate(0);
      cave.setDawn(0);
      const room = R.run.rooms[i];
      R.trial = makeTrial(room.t, trialCtx(room, i));
      R.homeZ = me.av.root.position.z;
      for (const r of remotes.values()) { homeRemote(r); if (r.bot) r.av.root.position.copy(r.target); }
      setCam(room.t === 'shoes' ? [0, 12.8, 10.6] : [0, 10.2, 13.4], room.t === 'shoes' ? [0, 0, -1.0] : [0, 0.6, -1.4]);
      drawIntro();
      sendP(true);
    });
  }
  function trialCtx(room, i) {
    const T = {
      lv: room.lv, rng: rngOf((R.run.seed + i * 7919) >>> 0), props: cave.props, sparks, cave, slotX: SLOT_X[mySlot()] || 0,
      me: {
        get av() { return me.av; }, get dress() { return me.dress; }, get pos() { return me.av.root.position; },
        place, face, walkTo, hopTo, act, steer,
      },
      say: (t) => ui.say(t),
      banner: (b, s, ms) => ui.banner(b, s, ms),
      body: (...els) => { R.body = els; if (!R.over) drawPlayPanel(); },
      hurt: (why) => hurt(why),
      heal: () => heal(),
      clear: () => roomCleared(),
      alive: () => !!R && R.phase === 'play' && !me.fallen,
      label, unlabel, place: (el, pos, y) => ui.place(el, pos, y), flash: flashLabel,
      screenOf, groundAt,
      setMain: (label2, opts = {}) => {
        const key = `${label2}|${!!opts.pulse}|${!!opts.disabled}|${!!opts.hidden}`;
        R.mainSpec = [label2, opts];
        if (me.fallen || R.phase !== 'play' || key === R.mainKey) return;
        R.mainKey = key;
        ui.setMain(label2, opts);
      },
      addDawn: (n) => addDawn(n),
      dawnLevel: () => dawnLevel(),
      fadeSwap: (fn) => fade(fn, 300),
      cam: (pos, look) => setCam(pos, look),
    };
    return T;
  }
  function hudEl() {
    const n = R.run.rooms.length, room = R.run.rooms[R.run.i];
    const hearts = h('span', { class: 'dg-hearts', 'aria-label': `하트 ${R.hearts}개` }, '❤️'.repeat(Math.max(0, R.hearts)) + '🤍'.repeat(Math.max(0, 3 - R.hearts)));
    return h('div', { class: 'dg-hud' }, hearts, h('span', {}, `방 ${R.run.i + 1}/${n} · ${TRIALS[room.t].name}`));
  }
  function drawPlayPanel() {
    if (!R || !R.run) return;
    ui.setPanel(hudEl(), ...(R.over ? [R.over] : R.body || []));
  }
  function drawIntro() {
    const room = R.run.rooms[R.run.i], tr = TRIALS[room.t];
    const a = tr.armor ? armorById(tr.armor) : null;
    const n = R.run.rooms.length;
    ui.say(`${tr.place} · ${tr.name}`, `${R.run.d.icon} ${R.run.d.name}`);
    ui.banner(`방 ${R.run.i + 1}/${n}`, `${a ? `${a.icon} ${a.name}` : '🌅 새벽의 방'} · ${tr.name}`, 1800);
    const card = h('div', { class: 'dg-card intro' },
      h('div', { class: 'dg-card-h' }, a ? `${a.icon} ${a.name}` : '🌅 새벽의 방', h('small', {}, `${'⭐'.repeat(room.lv)}`)),
      h('p', { class: 'dg-how' }, tr.how),
      h('p', { class: 'dg-verse' }, tr.verse.text, h('cite', {}, tr.verse.ref)),
      tr.robe ? h('p', { class: 'dg-mean' }, '나의 의가 아니라 그리스도의 의를 입어요. 예수님의 의가 나의 의가 되어요. ', h('span', { class: 'dg-verse-in' }, tr.robe.text, h('cite', {}, tr.robe.ref))) : null);
    R.over = card;
    drawPlayPanel();
    if (btn.pray) btn.pray.style.display = 'none';
    ui.setMain('시작!', { pulse: true, onClick: () => startTrial() });
  }
  function startTrial() {
    if (!R || R.phase !== 'intro' || !R.trial) return;
    R.phase = 'play';
    R.mainSpec = null;
    R.mainKey = '';
    R.over = null;
    ui.setMain('', { hidden: true, onClick: () => {} });
    if (btn.pray) btn.pray.style.display = '';
    if (R.trial.pad) document.body.classList.add('pad-game');
    R.trial.begin();
    drawPlayPanel();
    sendP(true);
  }
  // ---------- 하트, 쓰러짐, 기도 ----------
  function hurt(why) {
    if (!R || R.phase !== 'play' || me.fallen || R.inv > 0) return false;
    R.hearts = Math.max(0, R.hearts - 1);
    R.inv = 0.9;
    hurtFlash();
    sfx.bonk();
    if (why) ui.say(why);
    if (R.hearts <= 0) fall();
    drawPlayPanel();
    sendP(true);
    return true;
  }
  function heal() {
    if (!R || me.fallen || R.hearts >= 3) return;
    R.hearts++;
    drawPlayPanel();
    sendP(true);
  }
  function fall() {
    me.fallen = true;
    me.task = null;
    R.falls++;
    R.fallenAt = performance.now();
    sfx.fail();
    const party = realFriends().length > 0;
    R.fallLabel = '';
    ui.say(party ? '쓰러졌어요… 친구가 기도해 주면 바로 일어나요. 조금 뒤에는 혼자서도 기도할 수 있어요.' : '쓰러졌어요… ‘기도하기’를 누르면 하나님이 다시 일으켜 주세요.');
    ui.banner('쓰러졌어요', '기도하면 다시 일어날 수 있어요', 1600);
    drawFallen();
  }
  function selfPrayIn() { return realFriends().length ? Math.max(0, 4 - (performance.now() - R.fallenAt) / 1000) : 0; }
  function drawFallen() {
    if (!R || !me.fallen) return;
    const w = selfPrayIn();
    const lab = w > 0 ? `기도 ${Math.ceil(w)}` : '기도하기';
    if (lab === R.fallLabel) return;
    R.fallLabel = lab;
    ui.setMain(lab, { disabled: w > 0, pulse: w <= 0, onClick: () => { if (selfPrayIn() <= 0) revive(null); } });
  }
  function revive(by) {
    if (!R || !me.fallen) return;
    me.fallen = false;
    R.hearts = 3;
    R.inv = 1.6;
    act('pray', 1.0);
    const p = me.av.root.position;
    sparks.burst(V(p.x, 1.2, p.z), '#FFF3B0', 22, 0.9, 1.5);
    sfx.ding();
    ui.banner('다시 일어났어요!', by ? `${josa(nameOf(by), '이가', '가')} 기도해 줬어요` : '하나님이 힘을 주셨어요', 1800);
    ui.say('다시 힘을 내요! 하나님이 함께하셔요.');
    R.mainKey = '';
    if (R.mainSpec) ui.setMain(R.mainSpec[0], R.mainSpec[1]); else ui.setMain('', { hidden: true, onClick: () => {} });
    if (R.trial) R.trial.onPray();
    drawPlayPanel();
    sendP(true);
  }
  // '기도' 단추: 쓰러진 친구가 있으면 친구를 위해, 아니면 내 하트 하나 (잠깐 쉬었다가 다시)
  function fallenFriend() {
    const p = me.av ? me.av.root.position : V();
    let best = null, bd = Infinity;
    for (const r of remotes.values()) if (r.fallen && !r.bot && r.k === (R.run ? R.run.i : -1)) { const d = r.av.root.position.distanceTo(p); if (d < bd) { bd = d; best = r; } }
    return best;
  }
  function onPrayBtn() {
    if (!R || R.phase !== 'play') return;
    if (me.fallen) { if (selfPrayIn() <= 0) revive(null); return; }
    const f = fallenFriend();
    if (f) {
      R.room.send('V', { to: f.id });
      act('pray', 1.2);
      sparks.burst(V(f.av.root.position.x, 1.2, f.av.root.position.z), '#FFF3B0', 16, 0.8, 1.3);
      ui.say(`${josa(f.id ? nameOf(f.id) : '친구', '을', '를')} 위해 기도했어요.`);
      sendP(true);
      return;
    }
    if (R.prayCd > 0) return;
    R.prayCd = R.run && R.run.rooms[R.run.i].t === 'dawn' ? 4 : 10;
    act('pray', 0.9);
    const p = me.av.root.position;
    sparks.burst(V(p.x, 1.4, p.z), '#FFF3B0', 12, 0.6, 1.2);
    sfx.ding();
    if (R.hearts < 3) { heal(); ui.say('기도했더니 힘이 났어요! (하트 하나)'); } else ui.say('기도했어요. 하나님이 함께하셔요!');
    R.trial.onPray();
    sendP(true);
  }
  function drawPrayBtn() {
    const b = btn.pray;
    if (!b || !R || R.phase !== 'play') return;
    const f = fallenFriend();
    const txt = me.fallen ? '기도' : f ? '친구 기도' : R.prayCd > 0 ? `기도 ${Math.ceil(R.prayCd)}` : '기도';
    const last = b.lastChild;
    if (last && last.nodeType === 3 && last.textContent !== txt) last.textContent = txt;
    b.disabled = !me.fallen && !f && R.prayCd > 0;
    b.classList.toggle('dg-glow', !!f);
  }
  // ---------- 새벽의 방: 모두의 힘을 모은다 ----------
  function dawnNeed() { return 100 * (1 + 0.5 * (partyCount() - 1)); }
  function dawnLevel() {
    if (!R || !R.run) return 0;
    let s = R.myD + R.botD;
    for (const r of remotes.values()) if (!r.bot && r.k === R.run.i) s += r.d;
    return s / dawnNeed();
  }
  function addDawn(n) {
    R.myD += n;
    if (R.bots.size) R.botD += n * 0.75 * R.bots.size;
    sendP(true);
    checkDawn();
  }
  function checkDawn() {
    if (!R || !R.run || R.phase !== 'play' || R.run.rooms[R.run.i].t !== 'dawn') return;
    if (!R.host || dawnLevel() < 1) return;
    if (R.room && realFriends().length) R.room.send('W', { i: R.run.i });
    R.trial.win();
  }
  // ---------- 방 통과 ----------
  function roomCleared() {
    if (!R || !R.run || R.phase !== 'play') return;
    const i = R.run.i, room = R.run.rooms[i], last = i === R.run.rooms.length - 1;
    R.phase = 'cleared';
    me.fallen = false;
    document.body.classList.remove('pad-game');
    cave.setGate(1);
    if (last) { finishRun(); return; }
    act('cheer', 1.6);
    sfx.success();
    const tr = TRIALS[room.t];
    ui.banner('통과!', tr.verse.ref, 1800);
    R.over = h('div', { class: 'dg-card' }, h('div', { class: 'dg-card-h' }, `✨ ${tr.name} 통과!`), h('p', { class: 'dg-verse' }, tr.verse.text, h('cite', {}, tr.verse.ref)));
    drawPlayPanel();
    if (btn.pray) btn.pray.style.display = 'none';
    R.run.cleared.add(meId());
    // 예시 친구는 내가 통과하면 곧 따라 통과한다
    for (const b of R.bots) setTimeout(() => { if (R && R.run && R.run.i === i) { R.run.cleared.add(b); const r = remotes.get(b); if (r) { r.c = 1; r.act = 'cheer'; } checkAdvance(); } }, 500 + Math.random() * 900);
    if (!R.host && R.room) R.room.send('C', { i });
    sendP(true);
    drawCleared();
    checkAdvance();
  }
  // 아직 통과하지 못한 아이들. 방장은 받은 'C'로 세고, 친구 화면은 친구들의 자리 알림(통과 표시)으로 본다
  function waitingFor() {
    if (R.host) return R.slots.filter((id) => id && !R.run.cleared.has(id));
    return R.slots.filter((id) => {
      if (!id) return false;
      if (id === meId()) return !R.run.cleared.has(id);
      const r = remotes.get(id);
      return !(r && r.c && r.k === R.run.i);
    });
  }
  function drawCleared() {
    if (!R || R.phase !== 'cleared') return;
    const wait = waitingFor();
    if (R.host) {
      if (wait.length) { ui.setMain('기다리는 중', { disabled: true }); ui.say(`친구를 기다려요: ${wait.map((id) => nameOf(id)).join(', ')}. 쓰러진 친구가 있으면 '친구 기도'로 일으켜 줘요.`); }
      else { ui.setMain('다음 방 ▶', { pulse: true, onClick: () => advance() }); ui.say(realFriends().length ? '모두 통과했어요! 곧 다음 방으로 가요.' : '통과했어요! 말씀을 한 번 읽고 다음 방으로 가요.'); }
    } else {
      ui.setMain(wait.length ? '기다리는 중' : '곧 출발', { disabled: true });
      ui.say(wait.length ? '친구들이 통과하기를 기다려요.' : `${nameOf(R.slots[0])} 방장이 다음 방으로 데려가요.`);
    }
    if (btn.pray) btn.pray.style.display = realFriends().length ? '' : 'none';
  }
  function checkAdvance() {
    if (!R || !R.run || !R.host) return;
    if (R.phase === 'cleared') drawCleared();
    if (R.phase !== 'cleared' || waitingFor().length) return;
    if (realFriends().length && !R.autoT) R.autoT = 6; // 함께 할 때는 조금 뒤 저절로
  }
  function advance() {
    if (!R || !R.run || !R.host || R.phase !== 'cleared' || waitingFor().length) return;
    const i = R.run.i + 1;
    if (i >= R.run.rooms.length) return;
    if (R.room && realFriends().length) R.room.send('N', { i });
    R.phase = 'moving';
    enterRoom(i);
  }
  async function finishRun() {
    R.phase = 'done';
    const run = R.run, d = run.d;
    const ms = Math.round(performance.now() - run.t0);
    act('cheer', 4);
    confetti();
    if (onCelebrate) onCelebrate();
    ui.banner('새벽이 왔어요!', `${d.name} 통과`, 2800);
    ui.say('끝까지 섰어요! 예수님이 이미 이기셨어요.');
    if (btn.pray) btn.pray.style.display = 'none';
    const res = h('p', { class: 'dg-result' }, '열매를 받는 중…');
    R.over = h('div', { class: 'dg-card win' },
      h('div', { class: 'dg-card-h' }, `🌅 ${d.name} 통과!`, h('small', {}, fmtTime(ms))), res,
      h('p', { class: 'dg-verse' }, STAND_VERSE.text, h('cite', {}, STAND_VERSE.ref)),
      h('p', { class: 'dg-verse' }, WIN_VERSE.text, h('cite', {}, WIN_VERSE.ref)));
    drawPlayPanel();
    ui.setMain('…', { disabled: true });
    const before = { ...book.clears };
    let r = null, err = '';
    try { r = await rpc('kids_dungeon_clear', { p_token: getToken(), p_dg: d.id, p_ms: ms, p_party: partyCount() }); }
    catch (e) { if (lost(e)) return; err = message(e); }
    if (!R || R.phase !== 'done') return;
    if (r) {
      if (Number.isFinite(r.fruits) && setFruits) setFruits(r.fruits);
      book.clears[d.id] = Number.isFinite(r.clears) ? r.clears : (book.clears[d.id] || 0) + 1;
      if (Number.isFinite(r.best_ms)) book.best[d.id] = r.best_ms;
      if (Number.isFinite(r.today)) book.today = r.today;
      if (Number.isFinite(r.cap)) book.cap = r.cap;
      const got = r.got | 0;
      const lines = [];
      if (got > 0) { lines.push(`🍎 열매 ${got}개를 받았어요! (오늘 동굴 열매 ${book.today}/${book.cap})`); sfx.fruit(); }
      else lines.push(`오늘 받을 수 있는 동굴 열매(${book.cap}개)를 다 받았어요. 내일 또 와요!`);
      const di = DUNGEONS.indexOf(d);
      if (!(before[d.id] > 0) && di + 1 < DUNGEONS.length) lines.push(`🔓 새 동굴이 열렸어요: ${DUNGEONS[di + 1].icon} ${DUNGEONS[di + 1].name}`);
      res.textContent = lines.join('\n');
    } else res.textContent = err || '기록을 저장하지 못했어요.';
    ui.setMain('갑주의 방', { pulse: true, onClick: () => backToLobby() });
  }
  function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`; }
  function backToLobby() {
    if (!R || R.phase !== 'done') return;
    R.phase = 'moving';
    fade(() => {
      if (!R) return;
      R.run = null;
      buildLobby();
      if (R.host) { for (const b of R.bots) R.ready.add(b); }
      markReady();
      if (R.host && !unlocked(DUNGEONS.findIndex((x) => x.id === R.dg))) R.dg = DUNGEONS[0].id;
      if (R.host && (book.clears[R.dg] || 0) > 0) { const s = suggest(); if (!(book.clears[s] > 0)) R.dg = s; }
      sendRoster();
      drawLobby();
      sendP(true);
    });
  }

  // ---------- 방 이야기 ----------
  function onRoomMsg(m, from) {
    if (!R || typeof from !== 'string') return;
    const fromHost = from === R.room.hostId;
    if (m.t === '~P') { onP(from, m); return; }
    if (m.t === 'L' && !R.host && fromHost && Array.isArray(m.sl)) {
      const sl = m.sl.filter((x) => typeof x === 'string').slice(0, DG_MAX_PARTY);
      if (!sl.includes(meId())) {
        // 방장 화면이 나를 잠깐 놓쳤다 (기기가 잠깐 멈추면 나간 것으로 보일 수 있다): 다시 알리고, 그래도 안 되면 혼자 이어 간다
        R.room.send('R', { r: R.prayed ? 1 : 0 });
        clearTimeout(R.lostT);
        R.lostT = setTimeout(() => { if (R && !R.host && !R.slots.includes(meId())) becomeSolo(); }, 6000);
        R.slots = R.slots.filter((id) => id === meId() || sl.includes(id));
        return;
      }
      clearTimeout(R.lostT);
      R.slots = sl;
      R.ready = new Set(Array.isArray(m.rd) ? m.rd.filter((x) => typeof x === 'string') : []);
      if (typeof m.dg === 'string' && dungeonById(m.dg)) R.dg = m.dg;
      if (R.room.setMembers) R.room.setMembers(sl);
      syncRemotes();
      if (R.phase === 'lobby') { for (const r of remotes.values()) homeRemote(r); drawLobby(); }
      if (R.prayed && R.phase === 'lobby' && !R.ready.has(meId())) R.room.send('R', { r: 1 });
    } else if (m.t === 'R' && R.host) {
      // 방에서 빠졌던 친구가 다시 알리면(잠깐 연결이 끊겼던 것) 자리가 있으면 다시 넣는다
      if (!R.slots.includes(from)) { if (partyCount() >= DG_MAX_PARTY) return; R.slots.push(from); }
      if (m.r) R.ready.add(from); else R.ready.delete(from);
      sendRoster();
    } else if (m.t === 'G' && !R.host && fromHost && R.phase === 'lobby' && typeof m.dg === 'string') {
      goRun(m.dg, (m.seed >>> 0) || 1);
    } else if (m.t === 'N' && !R.host && fromHost && R.run && Number.isInteger(m.i) && m.i === R.run.i + 1 && R.phase !== 'moving') {
      R.phase = 'moving';
      enterRoom(m.i);
    } else if (m.t === 'C' && R.host && R.run && m.i === R.run.i) {
      R.run.cleared.add(from);
      checkAdvance();
    } else if (m.t === 'W' && !R.host && fromHost && R.run && R.trial && R.run.rooms[R.run.i].t === 'dawn') {
      R.trial.win();
    } else if (m.t === 'V' && m.to === meId() && me.fallen) {
      revive(from);
    }
  }
  function onLeft(id) {
    if (!R) return;
    if (!R.host && id === R.room.hostId) { becomeSolo(); return; }
    const i = R.slots.indexOf(id);
    if (i < 0) return;
    R.slots.splice(i, 1);
    R.ready.delete(id);
    dropRemote(id);
    // 잠깐 연결이 끊겼다가 다시 오는 때가 있어서, 조금 기다려도 안 돌아오면 알린다
    setTimeout(() => { if (R && !R.slots.includes(id)) toast(`${josa(nameOf(id), '이가', '가')} 동굴에서 나갔어요.`, 2200); }, 5000);
    if (R.host) { sendRoster(); checkAdvance(); checkDawn(); }
  }
  // 방장이 나가면: 혼자서 이어 간다 (내가 방장이 된다)
  function becomeSolo() {
    clearTimeout(R.lostT);
    toast('방장과 연결이 끊겨서 혼자 이어서 해요.', 2600);
    try { R.room.close(); } catch (e) { /* 무시 */ }
    R.room = hub ? hub.openRoom('dgn') : null;
    if (R.room) bind(R.room);
    R.host = true;
    R.slots = [meId()];
    R.ready = new Set(R.prayed ? [meId()] : []);
    R.bots = new Set();
    for (const id of [...remotes.keys()]) dropRemote(id);
    if (R.phase === 'cleared') { drawCleared(); checkAdvance(); }
    if (R.phase === 'play' && R.run && R.run.rooms[R.run.i].t === 'dawn') checkDawn();
    if (R.phase === 'lobby') drawLobby();
  }

  // ---------- 자판 ----------
  const kd = (e) => {
    if (!R || modal.isOpen) return;
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (KEYMAP[e.code]) keys.add(KEYMAP[e.code]);
    if (e.repeat) { if (KEYMAP[e.code] || e.code === 'Space') e.preventDefault(); return; }
    if (R.phase === 'play' && R.trial && !me.fallen && R.trial.onKey(e.code)) { e.preventDefault(); return; }
    const onBtn = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if ((e.code === 'Space' || e.code === 'Enter') && !onBtn && ui.main && !ui.main.hidden && !ui.main.disabled && ui.onMain) { e.preventDefault(); ui.onMain(); return; }
    if (e.code === 'KeyP' && R.phase === 'play') { onPrayBtn(); return; }
    if (KEYMAP[e.code] || e.code === 'Space') e.preventDefault();
  };
  const ku = (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); };
  const blur = () => keys.clear();

  // ---------- 매 화면 ----------
  function tick(dt, t) {
    if (!R || !me.av) return;
    cave.update(dt, t);
    sparks.update(dt);
    R.inv = Math.max(0, R.inv - dt);
    if (R.prayCd > 0) R.prayCd = Math.max(0, R.prayCd - dt);
    me.moving = false;
    if (R.trial && R.phase !== 'lobby') {
      try { R.trial.update(dt); } catch (e) { console.error(e); }
    }
    if (!R) return;
    // 내 주민
    let moving = me.moving, speed = 1.2;
    if (me.task) {
      const tk = me.task;
      tk.t += dt;
      const k = Math.min(1, tk.t / tk.dur);
      const p = me.av.root.position;
      p.lerpVectors(tk.from, tk.to, tk.kind === 'hop' ? ease(k) : k);
      p.y = tk.kind === 'hop' ? Math.sin(Math.PI * k) * 0.55 : 0;
      moving = tk.kind === 'walk';
      if (k >= 1) { me.task = null; p.y = 0; if (tk.cb) tk.cb(); }
    }
    if (me.act) { me.actT -= dt; if (me.actT <= 0) me.act = ''; }
    me.av.update(dt, moving && !me.fallen, speed);
    me.dress.update(dt);
    // 갑주가 날아와 입혀진다
    if (R.phase === 'lobby') {
      for (const D of R.displays) if (D.d.visible && !R.flights.some((f) => f.D === D)) { D.d.rotation.y += dt * 0.9; D.d.position.y = 1.75 + Math.sin(t * 2 + D.ph) * 0.08; }
      for (let i = R.flights.length - 1; i >= 0; i--) {
        const f = R.flights[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        const to = V(me.av.root.position.x, 1.0, me.av.root.position.z);
        f.D.d.position.lerpVectors(f.from, to, ease(k));
        f.D.d.position.y += Math.sin(Math.PI * k) * 0.9;
        f.D.d.scale.setScalar(1 - k * 0.5);
        if (k >= 1) { R.flights.splice(i, 1); f.D.d.scale.setScalar(1); landed(f); }
      }
    }
    tickRemotes(dt);
    // 내 이름표 (친구와 함께 할 때)
    if (realFriends().length || R.bots.size) {
      if (!me.tag) { me.tag = ui.label('나'); me.tag.classList.add('dg-name', 'me'); }
      ui.place(me.tag, me.av.root.position, 2.55);
    } else if (me.tag) { me.tag.style.display = 'none'; }
    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.life -= dt;
      q.p.y += dt * 1.3;
      if (q.life <= 0) { unlabel(q.el); pops.splice(i, 1); continue; }
      q.el.style.opacity = String(Math.min(1, q.life / 0.3));
      ui.place(q.el, q.p, 0);
    }
    if (R.phase === 'play') {
      drawPrayBtn();
      if (me.fallen) drawFallen();
    }
    if (R.phase === 'cleared' && R.autoT > 0) { R.autoT -= dt; if (R.autoT <= 0) advance(); }
    R.sendT -= dt;
    if (R.sendT <= 0) { R.sendT = 0.3; sendP(false); measureCover(); }
  }

  // ---------- 나가기 ----------
  function askExit() {
    if (!R) return;
    if (R.phase === 'lobby' || R.phase === 'done') { stopAll(); return; }
    modal.open('동굴에서 나갈까요?', h('div', { class: 'talk' },
      h('p', {}, '지금 나가면 이 동굴은 처음부터 다시 해야 해요.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => modal.close() }, '계속할래요'),
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => { modal.close(); stopAll(); } }, '나갈래요'))), { cls: 'talk-sheet' });
  }
  function leave() {
    if (!R) return;
    const r = R;
    endTrial();
    R = null;
    try { if (r.room) r.room.close(); } catch (e) { /* 무시 */ }
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('blur', blur);
    keys.clear();
    for (const id of [...remotes.keys()]) dropRemote(id);
    if (me.tag) { me.tag.remove(); me.tag = null; }
    dropMe();
    if (cave) { cave.clearProps(); sparks.clear(); cave.setDawn(0); cave.setGate(0); }
    document.body.classList.remove('in-cave', 'pad-game');
    game = null;
    // 마을로 돌아오면 카메라를 바로 내 주민 뒤로 (동굴 자리에서 마을을 가로질러 날아오지 않게)
    queueMicrotask(() => {
      if (v.mode === 'game' || !v.player) return;
      const p = v.player.root.position;
      v.camLook.set(p.x, 0.6, p.z - 3.2);
      v.camPos.set(p.x, 16, p.z + 15);
    });
  }

  function debug() {
    if (!R) return null;
    return {
      phase: R.phase, host: R.host, slots: R.slots, ready: [...R.ready], dg: R.dg, dressed: R.dressed, prayed: R.prayed, hearts: R.hearts, fallen: me.fallen,
      run: R.run && { dg: R.run.d.id, i: R.run.i, n: R.run.rooms.length, room: R.run.rooms[R.run.i] && R.run.rooms[R.run.i].t, cleared: [...R.run.cleared] },
      trial: R.trial ? R.trial.info() : null, dawn: R.run ? +dawnLevel().toFixed(2) : 0, book, remotes: [...remotes.values()].map((x) => ({ id: x.id, dr: x.dr, f: x.fallen, k: x.k, c: x.c, d: x.d })),
      me: me.av && { x: +me.av.root.position.x.toFixed(2), z: +me.av.root.position.z.toFixed(2), act: me.act },
    };
  }

  return {
    enter, join,
    get active() { return !!R; },
    debug,
    // 시험용 도구 (체험판 자동 시험에서 쓴다)
    test: {
      trial: () => (R ? R.trial : null),
      start: () => startTrial(),
      clear: () => roomCleared(),
      hurt: (w) => hurt(w),
      pray: () => onPrayBtn(),
      next: () => advance(),
      dress: () => dressNext(),
      ready: () => { if (!R) return; while (R.dressed < ARMOR.length) { me.dress.put(ARMOR[R.dressed].id); R.dressed++; if (R.displays[R.dressed - 1]) R.displays[R.dressed - 1].d.visible = false; } R.prayed = true; markReady(); drawLobby(); },
      go: () => startRun(),
      pick: (id) => { if (R && R.host) { R.dg = id; sendRoster(); } },
      book: () => book,
      moveTo: (x, z) => { if (me.av) place(x, z, me.av.root.rotation.y); },
      dawn: (n) => { if (R && R.phase === 'play') addDawn(n); },
      unlockAll: () => { for (const d of DUNGEONS) book.clears[d.id] = Math.max(1, book.clears[d.id] || 0); drawLobby(); },
    },
  };
}
