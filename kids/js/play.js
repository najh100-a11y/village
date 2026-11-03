// 진숲 어린이 마을 — 함께 놀기: 초대, 대답, 둘만의 놀이 채널
// 마을 전체 채널로는 짧은 초대만 오가고, 놀이는 두 사람만 듣는 채널에서 한다.
import { h, josa } from './ui.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';
import { sfx } from './sound.js';

const KIND_ASK = {
  omok: '오목 한 판 두자고 해요!', cook: '같이 요리하자고 해요!', ark: '노아의 방주 짝 맞추기 하자고 해요!',
  bg_fruit: '보드게임 섬에서 과일 종 치기 하자고 해요!', bg_n77: '보드게임 섬에서 77 피하기 하자고 해요!', bg_code: '보드게임 섬에서 숫자 암호 맞히기 하자고 해요!',
  bg_mancala: '보드게임 섬에서 만칼라 하자고 해요!', bg_yut: '보드게임 섬에서 윷놀이 하자고 해요!', bg_dots: '보드게임 섬에서 땅따먹기(점 잇기) 하자고 해요!',
};
const newGid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('') + Date.now().toString(36).slice(-4);

// 받는 쪽에서 메시지를 한 번만 처리하고, 보내는 쪽은 받았다는 대답이 올 때까지 다시 보낸다
function reliable(raw, onMsg) {
  let seq = 0;
  const unacked = new Map();
  const seen = new Set();
  const timer = setInterval(() => { for (const m of unacked.values()) raw.send(m); }, 1200);
  return {
    send(t, data = {}) { const m = { ...data, t, s: ++seq }; unacked.set(m.s, m); raw.send(m); },
    receive(m) {
      if (typeof m.ack === 'number') { unacked.delete(m.ack); return; }
      if (typeof m.s !== 'number' || typeof m.t !== 'string') return;
      raw.send({ ack: m.s });
      if (seen.has(m.s)) return;
      seen.add(m.s);
      onMsg(m);
    },
    stop() { clearInterval(timer); unacked.clear(); },
  };
}

export function createPlayHub({ getNet, getPerson, getMe, onAccept, onInviteShown, isBusy, onLockedInvite }) {
  const pending = new Map(); // gid → { resolve, peer, kind, timer }
  let session = null;
  let card = null;

  function makeSession({ gid, peer, kind, host, extra }) {
    const net = getNet();
    const bot = !!(net && net.isBot(peer));
    const s = {
      gid, peer, kind, host, extra, bot,
      peerName: (getPerson(peer) || {}).name || '친구',
      handlers: {},
      on(name, fn) { this.handlers[name] = fn; return this; },
      emit(name, ...a) { if (this.handlers[name]) this.handlers[name](...a); },
      send(t, data) { if (rel) rel.send(t, data); },
      close() {
        if (session === s) session = null;
        if (raw) { try { raw.send({ t: 'bye' }); } catch (e) { /* 무시 */ } }
        if (rel) rel.stop();
        if (raw) raw.close();
        if (bot && getNet()) getNet().botBusy(peer, false);
        s.closed = true;
      },
    };
    let raw = null, rel = null;
    if (!bot && net) {
      raw = net.openGame(gid, (m) => {
        if (m.t === 'bye' && typeof m.s !== 'number') { s.emit('left'); return; }
        rel.receive(m);
      }, () => s.emit('ready'));
      rel = reliable(raw || { send() {} }, (m) => s.emit('msg', m));
    } else setTimeout(() => s.emit('ready'), 30);
    session = s;
    return s;
  }

  // 친구에게 놀이를 청한다. 결과: { ok: true, session } 또는 { ok: false, reason }
  function invite(peer, kind, extra = null) {
    const net = getNet();
    if (!net) return { promise: Promise.resolve({ ok: false, reason: 'off' }), cancel() {} };
    const gid = newGid();
    let done;
    const promise = new Promise((resolve) => { done = resolve; });
    const timer = setTimeout(() => { pending.delete(gid); done({ ok: false, reason: 'timeout' }); }, 25000);
    pending.set(gid, { peer, kind, extra, timer, resolve: done });
    net.send('inv', { to: peer, g: gid, k: kind, x: extra });
    return {
      promise,
      cancel() { if (pending.has(gid)) { clearTimeout(timer); pending.delete(gid); done({ ok: false, reason: 'cancel' }); } },
    };
  }

  // busy: 0 대답 그대로, 1 다른 놀이 중, 2 오늘 말씀 활동을 아직 안 함
  function reply(to, g, ok, busy = 0) {
    const net = getNet();
    if (net) net.send('invr', { to, g, ok, b: busy });
  }

  function showCard(from, p) {
    const person = getPerson(from) || { name: '친구', avatar: null };
    const face = h('canvas', { width: 80, height: 80, class: 'inv-face', 'aria-hidden': 'true' });
    drawFaceIcon(face, normalizeAvatar(person.avatar));
    const close = () => { if (card) { card.remove(); card = null; } clearTimeout(t); };
    const t = setTimeout(() => { close(); reply(from, p.g, false); }, 25000);
    card = h('div', { class: 'invite-card', role: 'alertdialog', 'aria-label': '놀이 초대' },
      face,
      h('div', { class: 'inv-main' },
        h('p', {}, h('b', {}, josa(person.name, '이가', '가')), ` ${KIND_ASK[p.k]}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { close(); reply(from, p.g, false); } }, '다음에'),
          h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => {
            close();
            if (session) session.close();
            reply(from, p.g, true);
            const s = makeSession({ gid: p.g, peer: from, kind: p.k, host: false, extra: p.x });
            onAccept(p.k, s);
          } }, '좋아!'))));
    document.body.append(card);
    sfx.invite();
    if (onInviteShown) onInviteShown();
  }

  function onMsg(type, from, p) {
    const me = getMe();
    if (!me || p.to !== me) return false;
    if (type === 'inv') {
      const why = isBusy ? isBusy() : false;
      if (why === 'locked') { reply(from, p.g, false, 2); if (onLockedInvite) onLockedInvite(from, p.k); return true; }
      if (session || card || why) { reply(from, p.g, false, 1); return true; }
      showCard(from, p);
      return true;
    }
    if (type === 'invr') {
      const w = pending.get(p.g);
      if (!w || w.peer !== from) return true;
      clearTimeout(w.timer);
      pending.delete(p.g);
      if (!p.ok) { w.resolve({ ok: false, reason: p.b === 2 ? 'locked' : p.b ? 'busy' : 'no' }); return true; }
      if (session) session.close();
      w.resolve({ ok: true, session: makeSession({ gid: p.g, peer: from, kind: w.kind, host: true, extra: w.extra }) });
      return true;
    }
    return false;
  }

  function onLeave(id) { if (session && session.peer === id) session.emit('left'); }

  return { invite, onMsg, onLeave, get session() { return session; } };
}

// 친구 고르기 목록 (지금 마을에 있는 친구만)
export function friendPicker(friends, onPick, emptyText = '지금 마을에 있는 친구가 없어요.') {
  if (!friends.length) return h('p', { class: 'fb-empty' }, emptyText);
  return h('div', { class: 'friend-pick' }, friends.map((f) => {
    const cv = h('canvas', { width: 80, height: 80, class: 'fb-face', 'aria-hidden': 'true' });
    drawFaceIcon(cv, normalizeAvatar(f.avatar));
    return h('button', { class: 'fp-item', type: 'button', onclick: () => onPick(f) }, cv, h('span', {}, f.name));
  }));
}

// 초대하고 기다리는 화면 (창 안에 그린다). 결과는 then으로 받는다.
export function waitInvite(hub, friend, kind, extra, { setBody, onBack }) {
  const inv = hub.invite(friend.id, kind, extra);
  const msg = h('p', { class: 'result-big' }, `${friend.name}에게 물어보는 중이에요…`);
  setBody(h('div', { class: 'mem wait-inv' },
    h('div', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    msg,
    h('p', { class: 'hint-line' }, '친구가 ‘좋아!’를 누르면 바로 시작해요.'),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { inv.cancel(); onBack(); } }, '그만 기다리기'))));
  return inv.promise.then((r) => {
    if (r.ok) return r.session;
    if (r.reason === 'cancel') return null;
    const why = { locked: `${josa(friend.name, '은', '는')} 아직 놀이 마당이 안 열렸대요. 오늘 묵상을 마치면 같이 놀 수 있어요!`, busy: `${josa(friend.name, '은', '는')} 지금 다른 놀이를 하고 있어요.`, no: `${josa(friend.name, '이', '가')} 다음에 하재요.`, timeout: `${josa(friend.name, '이', '가')} 대답이 없어요.`, off: '지금은 친구와 연결되지 않아요.' }[r.reason] || '지금은 함께할 수 없어요.';
    setBody(h('div', { class: 'mem wait-inv' },
      h('p', { class: 'result-big' }, why),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: onBack }, '돌아가기'))));
    return null;
  });
}
