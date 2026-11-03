// 진숲 어린이 마을 — 함께 접속하기
// 실제: Supabase Realtime (broadcast + presence). 체험판: 같은 브라우저의 다른 탭(BroadcastChannel) + 예시 친구 둘.
import { cleanChat } from './chatfilter.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, REALTIME_BUDGET } from './config.js';

export const PHRASES = {
  hi: '안녕!', nice: '반가워!', together: '같이 가자!', good: '잘했어!', go: '힘내!', thanks: '고마워!',
  bless: '축복해!', memory: '암송의 집에서 만나!', qt: '오늘 묵상했어?', copy: '필사 같이 하자!', wait: '잠깐 기다려 줘!', bye: '내일 또 만나!',
};
export const EMOTES = { heart: '❤️', clap: '👏', smile: '😊', wave: '👋', pray: '🙏', star: '⭐' };
// 놀이기구를 타며 외치는 말 (말하기 판에는 나오지 않는다)
export const SHOUTS = { yay: '야호!', beep: '빵빵!', yum: '냠냠!' };
const EVENTS = ['mv', 'st', 'say', 'chat', 'dm', 'done', 'av', 'inv', 'invr', 'act', 'fish', 'art', 'dish', 'ob', 'fw', 'ate', 'bug', 'jp', 'gift', 'hm', 'hinv', 'pc', 'share'];
export const GAME_KINDS = ['omok', 'cook', 'ark'];
export const ACTS = ['', 'fish', 'omok', 'cook', 'art', 'memory', 'qt', 'copy', 'watch', 'ferris', 'viking', 'carousel', 'bumper', 'bench', 'eat', 'bug', 'home', 'coaster', 'swim', 'sea', 'visit', 'dig', 'skip', 'ark'];
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const GID_RE = /^[a-z0-9]{8,12}$/;
const WORD_RE = /^[a-z]{2,12}$/;
const PET_RE = /^pet_[a-z]{2,10}$/;

// 받은 메시지를 믿을 수 있는 모양으로만 걸러 낸다
export function clean(type, p) {
  if (!p || typeof p !== 'object') return null;
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100; // 섬 셋을 다 담는 넓이
  // r: 1이면 달리는 중
  if (type === 'mv') return num(p.x) && num(p.z) && num(p.tx) && num(p.tz) ? { x: p.x, z: p.z, tx: p.tx, tz: p.tz, ...(p.r === 1 ? { r: 1 } : {}) } : null;
  if (type === 'st') return num(p.x) && num(p.z) ? { x: p.x, z: p.z } : null;
  if (type === 'say') return PHRASES[p.p] || EMOTES[p.p] || SHOUTS[p.p] ? { p: p.p } : null;
  if (type === 'chat') { const t = typeof p.m === 'string' ? cleanChat(p.m) : ''; return t ? { m: t } : null; }
  if (type === 'done') return ['memory', 'qt', 'copy'].includes(p.k) ? { k: p.k } : null;
  if (type === 'av') return {};
  if (type === 'inv') return typeof p.to === 'string' && ID_RE.test(p.to) && GID_RE.test(p.g) && GAME_KINDS.includes(p.k)
    && (p.x == null || WORD_RE.test(p.x)) ? { to: p.to, g: p.g, k: p.k, x: p.x || null } : null;
  if (type === 'invr') return typeof p.to === 'string' && ID_RE.test(p.to) && GID_RE.test(p.g) && typeof p.ok === 'boolean'
    ? { to: p.to, g: p.g, ok: p.ok, b: p.b === 1 || p.b === 2 ? p.b : 0 } : null;
  // s: 앉은 자리 번호 (놀이기구 의자, 벤치)
  if (type === 'act') return ACTS.includes(p.a) ? { a: p.a, s: Number.isInteger(p.s) && p.s >= 0 && p.s < 64 ? p.s : -1 } : null;
  if (type === 'fish') return WORD_RE.test(p.f) ? { f: p.f } : null;
  if (type === 'art') return {};
  if (type === 'dish') return {};
  // 나눔 수레: s 나눔 바구니 번호, e 1이면 먹었다(0이면 새로 올렸다)
  if (type === 'share') return Number.isSafeInteger(p.s) && p.s > 0 ? { s: p.s, e: p.e === 1 ? 1 : 0 } : null;
  if (type === 'jp') return {}; // 폴짝 뛰었다
  // 애완동물 돌보기 (안아 주기, 먹이 주기). i: 돌보는 동물 (예전 화면은 없이 보낸다)
  if (type === 'pc') return p.k === 'hug' || p.k === 'feed' ? { k: p.k, i: typeof p.i === 'string' && PET_RE.test(p.i) ? p.i : null } : null;
  // 불꽃놀이: 종류와 쏜 자리
  if (type === 'fw') return ['fw_spark', 'fw_flower', 'fw_heart'].includes(p.k) && num(p.x) && num(p.z) ? { k: p.k, x: p.x, z: p.z } : null;
  // 마을 식탁 요리를 먹었다 (d: 요리 번호)
  if (type === 'ate') return Number.isSafeInteger(p.d) && p.d > 0 ? { d: p.d } : null;
  // 곤충을 잡았다 (s: 자리, w: 시간 칸, b: 곤충)
  if (type === 'bug') return Number.isInteger(p.s) && p.s >= 0 && p.s < 32 && Number.isInteger(p.w) && p.w >= 0 && p.w < 1e9 && /^[a-z_]{3,20}$/.test(p.b) ? { s: p.s, w: p.w, b: p.b } : null;
  // 선물: 열매(n 1~10) 또는 애완동물(n 0, p 동물). 실제 선물은 받는 쪽이 서버에서 확인한다
  if (type === 'gift') {
    if (typeof p.to !== 'string' || !ID_RE.test(p.to) || !WORD_RE.test(p.m)) return null;
    if (Number.isInteger(p.n) && p.n >= 1 && p.n <= 10) return { to: p.to, n: p.n, m: p.m };
    return p.n === 0 && typeof p.p === 'string' && PET_RE.test(p.p) ? { to: p.to, n: 0, m: p.m, p: p.p } : null;
  }
  // 집 안에서 움직이기: h 집 주인(빈 글자면 집에서 나감), x·z 집 안 자리, tx·tz 가는 곳,
  // 앉거나 누웠으면 y 높이·ro 방향·l(1 누움), a: 1 막 들어옴(먼저 있던 친구가 자기 자리를 알려 준다), u: 1 집을 새로 꾸몄음
  if (type === 'hm') {
    if (p.h === '') return { h: '' };
    if (typeof p.h !== 'string' || !ID_RE.test(p.h) || !num(p.x) || !num(p.z)) return null;
    const out = { h: p.h, x: p.x, z: p.z };
    if (num(p.tx) && num(p.tz)) { out.tx = p.tx; out.tz = p.tz; }
    if (num(p.y) && p.y >= 0 && p.y < 3 && num(p.ro)) { out.y = p.y; out.ro = p.ro; if (p.l === 1) out.l = 1; }
    if (p.a === 1) out.a = 1;
    if (p.u === 1) out.u = 1;
    return out;
  }
  // 우리 집에 놀러 오라고 부르기 (받는 아이만 본다)
  if (type === 'hinv') return typeof p.to === 'string' && ID_RE.test(p.to) ? { to: p.to } : null;
  // 둘이 대화: 받는 아이만 화면에 띄운다
  if (type === 'dm') { const t = typeof p.m === 'string' ? cleanChat(p.m) : ''; return t && typeof p.to === 'string' && ID_RE.test(p.to) ? { to: p.to, m: t } : null; }
  // 오목 구경: 판(13×13 = 169칸, 0 빈칸 1 검은 돌 2 흰 돌), 검은 돌·흰 돌 주인(g는 숲지기 솔), 이긴 쪽, 판 번호, 마지막 수
  if (type === 'ob') {
    const who = (v) => v === 'g' || (typeof v === 'string' && ID_RE.test(v));
    return typeof p.b === 'string' && /^[012]{169}$/.test(p.b) && who(p.k) && who(p.w) && [0, 1, 2, 3].includes(p.x)
      && Number.isInteger(p.r) && p.r >= 1 && p.r < 1000 && Number.isInteger(p.l) && p.l >= -1 && p.l < 169
      ? { b: p.b, k: p.k, w: p.w, x: p.x, r: p.r, l: p.l } : null;
  }
  return null;
}

// 보내는 양 조절: 사람이 많을수록 한 사람이 보내는 횟수를 줄인다 (무료 한도 안에서 끊기지 않게).
// 움직임(mv, st)은 가장 최근 것 하나만 남기고, 인사·마침·꾸미기(say, done, av)는 먼저 보낸다.
const MAX_RATE = 2.5;
const round2 = (v) => +v.toFixed(2);
export class Outbox {
  constructor(post, peerCount, posNow) {
    this.post = post;
    this.peerCount = peerCount;
    this.posNow = posNow || (() => null);
    this.tokens = 1;
    this.last = performance.now();
    this.move = null;
    this.queue = [];
    this.timer = setInterval(() => this.flush(), 250);
  }
  rate() {
    const n = this.peerCount() + 1;
    return Math.min(MAX_RATE, REALTIME_BUDGET / (n * n));
  }
  push(ev, payload) {
    if (ev === 'inv' || ev === 'invr' || ev === 'dm' || ev === 'gift' || ev === 'hinv') { if (this.peerCount() > 0) this.post(ev, payload); return; } // 초대·대답·둘이 대화·선물·집에 부르기는 바로
    if (ev === 'hm') {
      // 집 안 움직임은 가장 새 것 하나만. 들어오고 나가는 것(a, 빈 h)과 새로 꾸민 것(u)은 잃지 않게 차례에 넣는다
      if (payload.h !== '') this.lastHouse = { h: payload.h, x: payload.x, z: payload.z };
      else this.lastHouse = null;
      if (payload.a || payload.u || payload.h === '') { this.hmove = null; this.queue = this.queue.filter((m) => m[0] !== 'hm'); this.queue.push([ev, payload]); while (this.queue.length > 4) this.queue.shift(); }
      else this.hmove = [ev, payload];
      this.flush();
      return;
    }
    if (ev === 'ob') this.queue = this.queue.filter((m) => m[0] !== 'ob'); // 오목 판은 가장 새 것만
    if (ev === 'jp') this.queue = this.queue.filter((m) => m[0] !== 'jp'); // 점프는 하나만
    if (ev === 'mv' || ev === 'st') this.move = [ev, payload];
    else {
      if (ev === 'act') { this.queue = this.queue.filter((m) => m[0] !== 'act'); this.lastAct = payload; }
      this.queue.push([ev, payload]);
      while (this.queue.length > 3) this.queue.shift();
    }
    this.flush();
  }
  // 새로 들어온 친구에게 내 자리와 지금 하는 일(놀이기구, 벤치)을 알린다
  announce() {
    if (!this.move) this.move = ['st', null];
    if (this.lastAct && this.lastAct.a && !this.queue.some((m) => m[0] === 'act')) this.queue.push(['act', this.lastAct]);
    if (this.lastHouse && !this.queue.some((m) => m[0] === 'hm')) this.queue.push(['hm', { ...this.lastHouse, a: 1 }]); // 어느 집에 있는지도
    this.flush();
  }
  freshMove() {
    let [ev, p] = this.move;
    this.move = null;
    const now = this.posNow();
    if (!now) return p ? [ev, p] : null;
    const x = round2(now.x), z = round2(now.z);
    if (ev === 'mv' && p) {
      if (Math.hypot(p.tx - x, p.tz - z) < 0.2) return ['st', { x, z }];
      return ['mv', { x, z, tx: p.tx, tz: p.tz, ...(p.r === 1 ? { r: 1 } : {}) }];
    }
    return ['st', { x, z }];
  }
  flush() {
    const t = performance.now();
    this.tokens = Math.min(1, this.tokens + ((t - this.last) / 1000) * this.rate());
    this.last = t;
    if (this.peerCount() === 0) { this.move = null; this.hmove = null; this.queue.length = 0; return; } // 아무도 없으면 보내지 않는다
    while (this.tokens >= 1) {
      let m = this.queue.length ? this.queue.shift() : null;
      if (!m && this.hmove) { m = this.hmove; this.hmove = null; }
      if (!m && this.move) m = this.freshMove();
      if (!m) break;
      this.tokens -= 1;
      this.post(m[0], m[1]);
    }
  }
  stop() { clearInterval(this.timer); this.move = null; this.hmove = null; this.lastHouse = null; this.queue.length = 0; }
}

class SupabaseNet {
  constructor(h) { this.h = h; this.peers = new Set(); }
  start(room, myId) {
    if (!window.supabase || !room) { this.h.onStatus('off'); return; }
    this.myId = myId;
    this.room = room;
    this.out = new Outbox((ev, p) => this.post(ev, p), () => this.peers.size, this.h.posNow);
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 8 } },
    });
    const ch = this.client.channel(`kv-${room}`, { config: { broadcast: { self: false }, presence: { key: myId, enabled: true } } });
    this.ch = ch;
    for (const ev of EVENTS) {
      ch.on('broadcast', { event: ev }, (msg) => {
        const p = msg && msg.payload;
        if (!p || typeof p.i !== 'string' || p.i === myId) return;
        this.h.onMsg(ev, p.i, p);
      });
    }
    ch.on('presence', { event: 'sync' }, () => {
      const now = new Set(Object.keys(ch.presenceState()));
      now.delete(myId);
      for (const id of now) if (!this.peers.has(id)) { this.peers.add(id); this.h.onJoin(id); }
      for (const id of [...this.peers]) if (!now.has(id)) { this.peers.delete(id); this.h.onLeave(id); }
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try { await ch.track({ at: Date.now() }); } catch (e) { /* 다음 동기화 때 다시 */ }
        this.h.onStatus('on');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.h.onStatus('off');
      }
    });
  }
  send(ev, payload) { if (this.out) this.out.push(ev, payload); }
  announce() { if (this.out) this.out.announce(); }
  isBot() { return false; }
  botBusy() {}
  // 두 사람만 쓰는 놀이 채널 (오목, 함께 요리)
  openGame(gid, onMsg, onReady) {
    if (!this.client) return null;
    const ch = this.client.channel(`kv-${this.room}-g-${gid}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'g' }, (msg) => {
      const p = msg && msg.payload;
      if (p && typeof p === 'object' && p._f !== this.myId) onMsg(p);
    });
    ch.subscribe((status) => { if (status === 'SUBSCRIBED' && onReady) onReady(); });
    return {
      send: (p) => { try { ch.send({ type: 'broadcast', event: 'g', payload: { ...p, _f: this.myId } }); } catch (e) { /* 다시 보낸다 */ } },
      close: () => { try { this.client.removeChannel(ch); } catch (e) { /* 무시 */ } },
    };
  }
  post(ev, payload) {
    if (!this.ch) return;
    try { this.ch.send({ type: 'broadcast', event: ev, payload: { ...payload, i: this.myId } }); } catch (e) { /* 끊겼을 때는 무시 */ }
  }
  stop() {
    if (this.out) { this.out.stop(); this.out = null; }
    if (this.ch) { try { this.client.removeChannel(this.ch); } catch (e) { /* 무시 */ } }
    this.ch = null;
    for (const id of this.peers) this.h.onLeave(id);
    this.peers.clear();
  }
}

// 체험판: 다른 탭과 예시 친구들
const BOT_ROUTE = [[0, 9], [0, 2.5], [-3, -7.5], [-8, -8.6], [-3, -7.5], [-6, -0.5], [-11.5, 3], [-6, -0.5], [0, 2.5],
  [6, -0.5], [12, 3], [6, -0.5], [3, -7.5], [8, -8.6], [3, -7.5], [1.6, -9.2], [0, -15], [1.6, -9.2], [3, -7.5], [0, 2.5]];
const BOT_LINES = ['hi', 'nice', 'together', 'qt', 'memory', 'good', 'heart', 'clap', 'smile', 'copy'];

class DemoNet {
  constructor(h) { this.h = h; this.peers = new Map(); this.bots = []; }
  start(room, myId, bots = []) {
    this.myId = myId;
    this.out = new Outbox((ev, p) => this.post({ t: 'ev', ev, p }), () => this.peers.size + this.bots.length, this.h.posNow);
    try {
      this.bc = new BroadcastChannel('kv-demo-room');
      this.bc.onmessage = (e) => this.receive(e.data);
    } catch (e) { this.bc = null; }
    this.hello = setInterval(() => { this.post({ t: 'hello' }); this.expire(); }, 2500);
    this.post({ t: 'hello' });
    this.h.onStatus('on');
    // 예시 친구 (이 기기 안에서만 움직이는 가짜 친구)
    bots.filter((b) => b.id !== myId).slice(0, 2).forEach((b, k) => {
      const bot = { id: b.id, i: (k * 9) % BOT_ROUTE.length, pos: [...BOT_ROUTE[(k * 9) % BOT_ROUTE.length]], wait: 1 + k * 2, saidAt: 4 + k * 5, done: false };
      this.bots.push(bot);
      this.h.onJoin(bot.id);
      this.h.onMsg('st', bot.id, { x: bot.pos[0], z: bot.pos[1] });
    });
    // 체험판: 조금 지나면 예시 친구가 오목 한 판을 청한다 (한 번만)
    this.botInvite = setTimeout(() => {
      const bot = this.bots.find((b) => !b.busy);
      if (bot && this.out) this.h.onMsg('inv', bot.id, { to: myId, g: Math.random().toString(36).slice(2, 10).padEnd(8, '0'), k: 'omok' });
    }, 70000);
    let last = performance.now();
    this.tick = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      for (const bot of this.bots) this.stepBot(bot, dt);
    }, 200);
  }
  stepBot(bot, dt) {
    if (bot.busy) return;
    bot.saidAt -= dt;
    if (bot.saidAt <= 0) {
      bot.saidAt = 9 + Math.random() * 10;
      this.h.onMsg('say', bot.id, { p: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)] });
    }
    if (!bot.done && performance.now() > 25000 + this.bots.indexOf(bot) * 15000) {
      bot.done = true;
      this.h.onMsg('done', bot.id, { k: this.bots.indexOf(bot) === 0 ? 'qt' : 'memory' });
    }
    // 체험판: 조금 지나면 예시 친구도 놀이기구를 30초쯤 탄다 (한 번씩)
    const k = this.bots.indexOf(bot);
    if (!bot.rode && performance.now() > 40000 + k * 22000) {
      bot.rode = true;
      bot.riding = 30;
      const [a, seat] = k === 0 ? ['carousel', 2] : ['ferris', 5];
      this.h.onMsg('act', bot.id, { a, s: seat });
    }
    if (bot.riding > 0) {
      bot.riding -= dt;
      if (bot.riding <= 0) this.h.onMsg('act', bot.id, { a: '' });
      return;
    }
    if (bot.wait > 0) { bot.wait -= dt; return; }
    const [tx, tz] = BOT_ROUTE[bot.i];
    const dx = tx - bot.pos[0], dz = tz - bot.pos[1];
    const d = Math.hypot(dx, dz);
    if (!bot.moving) {
      bot.moving = true;
      this.h.onMsg('mv', bot.id, { x: bot.pos[0], z: bot.pos[1], tx, tz });
    }
    const step = 3.2 * dt;
    if (d <= step) {
      bot.pos = [tx, tz];
      bot.i = (bot.i + 1) % BOT_ROUTE.length;
      bot.moving = false;
      if (Math.random() < 0.35) { bot.wait = 1.5 + Math.random() * 3; this.h.onMsg('st', bot.id, { x: tx, z: tz }); }
    } else {
      bot.pos = [bot.pos[0] + (dx / d) * step, bot.pos[1] + (dz / d) * step];
    }
  }
  post(m) { if (this.bc) try { this.bc.postMessage({ ...m, from: this.myId }); } catch (e) { /* 무시 */ } }
  receive(m) {
    if (!m || typeof m.from !== 'string' || m.from === this.myId) return;
    // 같은 친구를 다른 탭에서 실제로 쓰고 있으면 예시로 움직이던 것을 멈춘다
    this.bots = this.bots.filter((b) => b.id !== m.from);
    if (!this.peers.has(m.from)) {
      this.peers.set(m.from, Date.now());
      this.h.onJoin(m.from);
      this.post({ t: 'hello' });
    }
    this.peers.set(m.from, Date.now());
    if (m.t === 'bye') { this.peers.delete(m.from); this.h.onLeave(m.from); return; }
    if (m.t === 'ev' && EVENTS.includes(m.ev)) this.h.onMsg(m.ev, m.from, m.p || {});
  }
  expire() {
    const now = Date.now();
    for (const [id, at] of [...this.peers]) if (now - at > 8000) { this.peers.delete(id); this.h.onLeave(id); }
  }
  send(ev, payload) {
    // 예시 친구에게 보낸 초대는 예시 친구가 대신 대답한다
    if (ev === 'inv' && this.isBot(payload.to)) {
      const bot = this.bots.find((b) => b.id === payload.to);
      setTimeout(() => {
        if (!this.out) return;
        const ok = !bot.busy;
        if (ok) this.botBusy(bot.id, true, payload.k);
        this.h.onMsg('invr', bot.id, { to: this.myId, g: payload.g, ok, b: ok ? 0 : 1 });
      }, 1300);
      return;
    }
    if (ev === 'invr' && this.isBot(payload.to)) { if (payload.ok) this.botBusy(payload.to, true, 'omok'); return; }
    if (this.out) this.out.push(ev, payload);
  }
  announce() { if (this.out) this.out.announce(); }
  isBot(id) { return this.bots.some((b) => b.id === id); }
  botBusy(id, on, kind) {
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) return;
    bot.busy = on;
    this.h.onMsg('act', bot.id, { a: on ? kind : '' });
    if (on) this.h.onMsg('st', bot.id, { x: bot.pos[0], z: bot.pos[1] });
  }
  openGame(gid, onMsg, onReady) {
    let bc = null;
    try { bc = new BroadcastChannel(`kv-demo-g-${gid}`); } catch (e) { return null; }
    bc.onmessage = (e) => { const p = e.data; if (p && p._f !== this.myId) onMsg(p); };
    setTimeout(() => onReady && onReady(), 50);
    return {
      send: (p) => { try { bc.postMessage({ ...p, _f: this.myId }); } catch (e) { /* 무시 */ } },
      close: () => { try { bc.close(); } catch (e) { /* 무시 */ } },
    };
  }
  stop() {
    clearTimeout(this.botInvite);
    if (this.out) { this.out.stop(); this.out = null; }
    this.post({ t: 'bye' });
    clearInterval(this.hello);
    clearInterval(this.tick);
    if (this.bc) this.bc.close();
    for (const id of this.peers.keys()) this.h.onLeave(id);
    for (const b of this.bots) this.h.onLeave(b.id);
    this.peers.clear();
    this.bots = [];
  }
}

export function createNet(demo, handlers) {
  return demo ? new DemoNet(handlers) : new SupabaseNet(handlers);
}
