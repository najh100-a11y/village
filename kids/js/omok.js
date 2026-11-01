// 진숲 어린이 마을 — 오목 놀이터 (컴퓨터와, 또는 마을 친구와 1:1)
import { h, modal, toast, confetti, josa } from './ui.js';
import { friendPicker, waitInvite } from './play.js';
import { sfx } from './sound.js';

const N = 13;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const idx = (x, y) => y * N + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function lineAt(board, x, y, c) {
  for (const [dx, dy] of DIRS) {
    const cells = [[x, y]];
    for (const s of [1, -1]) {
      let i = x + dx * s, j = y + dy * s;
      while (inside(i, j) && board[idx(i, j)] === c) { cells.push([i, j]); i += dx * s; j += dy * s; }
    }
    if (cells.length >= 5) return cells;
  }
  return null;
}

// 자리 점수: 놓았을 때 이어지는 돌 수와 막히지 않은 끝 수
function scoreAt(board, x, y, c) {
  let total = 0;
  for (const [dx, dy] of DIRS) {
    let count = 1, open = 0;
    for (const s of [1, -1]) {
      let i = x + dx * s, j = y + dy * s;
      while (inside(i, j) && board[idx(i, j)] === c) { count++; i += dx * s; j += dy * s; }
      if (inside(i, j) && board[idx(i, j)] === 0) open++;
    }
    if (count >= 5) total += 100000;
    else if (count === 4) total += open === 2 ? 10000 : open === 1 ? 2500 : 0;
    else if (count === 3) total += open === 2 ? 1200 : open === 1 ? 150 : 0;
    else if (count === 2) total += open === 2 ? 120 : open === 1 ? 20 : 0;
    else total += open === 2 ? 8 : open;
  }
  return total;
}

// 숲지기 솔의 난이도: easy 쉬움(가끔 실수하고 잘 안 막는다), normal 보통, hard 어려움(꼭 막고 한 수 앞을 본다)
export const OMOK_LEVELS = [['easy', '쉬움', '새싹처럼 살살 둬요. 처음 해 보는 친구에게 좋아요.'],
  ['normal', '보통', '숲지기 솔이 평소처럼 둬요.'], ['hard', '어려움', '꼭 막고 한 수 앞을 내다봐요. 이겨 보세요!']];
function candidates(board, me, defW) {
  const opp = me === 1 ? 2 : 1;
  const cands = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (board[idx(x, y)]) continue;
    let near = false;
    for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) if (inside(x + i, y + j) && board[idx(x + i, y + j)]) { near = true; break; }
    if (!near) continue;
    const att = scoreAt(board, x, y, me), def = scoreAt(board, x, y, opp);
    cands.push({ x, y, s: att + def * defW, att, def });
  }
  cands.sort((a, b) => b.s - a.s);
  return cands;
}
export function aiMove(board, me, level = 'normal') {
  if (!board.some((v) => v)) return level === 'easy' ? [6 + Math.floor(Math.random() * 3) - 1, 6 + Math.floor(Math.random() * 3) - 1] : [6, 6];
  const opp = me === 1 ? 2 : 1;
  if (level === 'easy') {
    // 쉬움: 이길 수 있으면 대개 이기고, 다섯 줄은 반쯤만 막고, 막는 것보다 내 돌을 잇는 것을 좋아한다
    const cands = candidates(board, me, 0.35);
    const win = cands.find((c) => c.att >= 100000);
    if (win && Math.random() < 0.8) return [win.x, win.y];
    const block = cands.find((c) => c.def >= 100000);
    if (block && Math.random() < 0.55) return [block.x, block.y];
    const top = cands.slice(0, 8);
    const pick = top[Math.floor(Math.random() * top.length)];
    return [pick.x, pick.y];
  }
  if (level === 'hard') {
    const cands = candidates(board, me, 1.0);
    const win = cands.find((c) => c.att >= 100000);
    if (win) return [win.x, win.y];
    const block = cands.find((c) => c.def >= 100000);
    if (block) return [block.x, block.y];
    // 두 수 앞: 내가 두고, 상대가 가장 좋은 곳에 두고, 내가 다시 둘 때를 따져 고른다
    let best = cands[0], bestV = -Infinity;
    for (const c of cands.slice(0, 8)) {
      board[idx(c.x, c.y)] = me;
      const reply = candidates(board, opp, 1.0)[0];
      let v = c.s;
      if (reply) {
        board[idx(reply.x, reply.y)] = opp;
        const next = candidates(board, me, 0)[0];
        board[idx(reply.x, reply.y)] = 0;
        v = c.s - reply.att * 0.6 + (next ? next.att * 0.3 : 0);
      }
      board[idx(c.x, c.y)] = 0;
      if (v > bestV) { bestV = v; best = c; }
    }
    return [best.x, best.y];
  }
  const cands = candidates(board, me, 0.9);
  const win = cands.find((c) => c.att >= 100000);
  if (win) return [win.x, win.y];
  const block = cands.find((c) => c.def >= 100000);
  if (block) return [block.x, block.y];
  if (cands[0].s >= 9000) return [cands[0].x, cands[0].y];
  // 보통: 좋은 자리 셋 가운데 하나를 고른다
  const top = cands.slice(0, 3);
  const pick = top[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * top.length)];
  return [pick.x, pick.y];
}

export function createOmok({ hub, onlineFriends, onCelebrate }) {
  let g = null;
  let cv = null, ctx = null, status = null, controls = null;

  function close() {
    if (g && g.session) { g.session.close(); }
    g = null;
  }

  function menu() {
    modal.setTitle('오목 놀이터');
    const friends = onlineFriends();
    modal.setBody(h('div', { class: 'mem game' },
      h('section', { class: 'guide compact' },
        h('h3', {}, '오목은 이렇게 해요'),
        h('ol', { class: 'guide-steps' },
          h('li', {}, h('b', {}, '번갈아 놓아요'), h('span', {}, '검은 돌이 먼저, 흰 돌이 다음이에요. 줄이 만나는 곳을 눌러요.')),
          h('li', {}, h('b', {}, '다섯 개를 한 줄로'), h('span', {}, '가로, 세로, 대각선 어느 쪽이든 내 돌 다섯 개를 먼저 이으면 이겨요.')),
          h('li', {}, h('b', {}, '친구를 막아요'), h('span', {}, '친구 돌이 넷이나 셋으로 이어지면 끝을 막아 줘요.')))),
      h('div', { class: 'mode-pick' },
        h('button', { class: 'mode', type: 'button', onclick: () => start({ mode: 'ai', me: 1 }) },
          h('b', {}, '숲지기 솔과 두기'), h('span', {}, '컴퓨터와 연습해요. 내가 먼저 검은 돌이에요.'))),
      h('div', { class: 'sub-head' }, h('h3', {}, '마을 친구와 두기'), h('p', {}, friends.length ? `${friends.length}명` : '')),
      friendPicker(friends, (f) => askFriend(f), '지금 마을에 있는 친구가 없어요. 친구가 들어오면 여기에 보여요.')));
  }

  function askFriend(f) {
    modal.setTitle('오목 놀이터');
    waitInvite(hub, f, 'omok', null, { setBody: (b) => modal.setBody(b), onBack: menu }).then((s) => {
      if (s) startSession(s);
    });
  }

  function startSession(session) {
    session.on('msg', onPeerMsg).on('left', () => {
      if (!g || g.session !== session) return;
      g.peerLeft = true;
      g.over = true;
      say(`${josa(session.peerName, '이가', '가')} 놀이를 마쳤어요.`);
      drawControls();
    });
    // 처음 판: 초대한 사람이 검은 돌
    start({ mode: 'pvp', me: session.host ? 1 : 2, session });
  }

  function start({ mode, me, session = null, round = 1 }) {
    const prev = g;
    g = { mode, me, session, round, board: new Int8Array(N * N), moves: [], turn: 1, over: false, winLine: null, wantAgain: false, peerAgain: false,
      peerLeft: prev && prev.session === session ? prev.peerLeft : false };
    modal.setTitle(mode === 'ai' ? '오목: 숲지기 솔과' : `오목: ${josa(session.peerName, '과', '와')} 한 판`);
    cv = h('canvas', { class: 'omok-board', 'aria-label': '오목판' });
    ctx = cv.getContext('2d');
    status = h('p', { class: 'omok-status', 'aria-live': 'polite' });
    controls = h('div', { class: 'row' });
    const wrap = h('div', { class: 'mem game omok' },
      h('div', { class: 'omok-players' },
        h('span', { class: 'stone-chip black' }, mode === 'ai' ? (me === 1 ? '나' : '솔') : (me === 1 ? '나' : session.peerName)),
        h('span', { class: 'vs' }, 'vs'),
        h('span', { class: 'stone-chip white' }, mode === 'ai' ? (me === 2 ? '나' : '솔') : (me === 2 ? '나' : session.peerName))),
      status, cv, controls);
    modal.setBody(wrap);
    cv.addEventListener('pointerup', onTap);
    layout();
    draw();
    requestAnimationFrame(() => { if (g && cv.isConnected) { layout(); draw(); } });
    drawControls();
    turnText();
    if (g.turn !== g.me) opponentTurn();
  }

  function layout() {
    const w = Math.min(520, (cv.parentElement && cv.parentElement.clientWidth) || 360);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cv.style.height = w + 'px';
    cv.width = cv.height = Math.round(w * dpr);
    g.px = w;
    g.dpr = dpr;
  }

  function cellXY(i) { const pad = g.px / (N + 1); return pad + i * pad; }

  function draw() {
    if (!g || !ctx) return;
    const w = g.px;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.fillStyle = '#E9C27D';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#7A5233';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < N; i++) {
      const v = cellXY(i);
      ctx.beginPath(); ctx.moveTo(cellXY(0), v); ctx.lineTo(cellXY(N - 1), v); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(v, cellXY(0)); ctx.lineTo(v, cellXY(N - 1)); ctx.stroke();
    }
    ctx.fillStyle = '#7A5233';
    for (const [x, y] of [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]]) { ctx.beginPath(); ctx.arc(cellXY(x), cellXY(y), 3, 0, 7); ctx.fill(); }
    const r = (w / (N + 1)) * 0.44;
    g.moves.forEach(([x, y], k) => {
      const c = g.board[idx(x, y)];
      const cx = cellXY(x), cy = cellXY(y);
      const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      if (c === 1) { grad.addColorStop(0, '#6A6464'); grad.addColorStop(1, '#1E1A1A'); } else { grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(1, '#D9D2C5'); }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      if (k === g.moves.length - 1) { ctx.fillStyle = '#EF6461'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, 7); ctx.fill(); }
    });
    if (g.winLine) {
      const pts = [...g.winLine].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      ctx.strokeStyle = 'rgba(239,100,97,.85)';
      ctx.lineWidth = r * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cellXY(pts[0][0]), cellXY(pts[0][1]));
      ctx.lineTo(cellXY(pts[pts.length - 1][0]), cellXY(pts[pts.length - 1][1]));
      ctx.stroke();
    }
  }

  function say(t) { if (status) status.textContent = t; }
  function oppName() { return g.mode === 'ai' ? '숲지기 솔' : g.session.peerName; }
  function turnText() {
    if (!g || g.over) return;
    say(g.turn === g.me ? `내 차례예요 (${g.me === 1 ? '검은' : '흰'} 돌)` : `${oppName()} 차례예요…`);
  }

  function onTap(e) {
    if (!g || g.over || g.turn !== g.me) return;
    const r = cv.getBoundingClientRect();
    const pad = r.width / (N + 1);
    const x = Math.round((e.clientX - r.left) / pad) - 1, y = Math.round((e.clientY - r.top) / pad) - 1;
    if (!inside(x, y) || g.board[idx(x, y)]) return;
    place(x, y, g.me);
    if (g.mode === 'pvp' && !g.session.bot) g.session.send('mv', { n: g.moves.length - 1, x, y, r: g.round });
    if (!g.over) opponentTurn();
  }

  function place(x, y, c) {
    sfx.stone();
    g.board[idx(x, y)] = c;
    g.moves.push([x, y]);
    g.turn = c === 1 ? 2 : 1;
    const line = lineAt(g.board, x, y, c);
    if (line) finish(c, line);
    else if (g.moves.length === N * N) finish(0, null);
    else turnText();
    draw();
  }

  function finish(winner, line) {
    g.over = true;
    g.winLine = line;
    if (winner === 0) say('비겼어요! 둘 다 정말 잘했어요.');
    else if (winner === g.me) {
      say('내가 이겼어요! 다섯 개를 이었어요.');
      confetti();
      onCelebrate();
    } else { say(`${g.mode === 'ai' ? '숲지기 솔이' : josa(oppName(), '이가', '가')} 이겼어요. 다음 판에 다시 해 봐요!`); sfx.fail(); }
    drawControls();
  }

  function opponentTurn() {
    if (g.mode === 'ai' || (g.session && g.session.bot)) {
      const game = g;
      setTimeout(() => {
        if (g !== game || g.over) return;
        const [x, y] = aiMove(g.board, g.me === 1 ? 2 : 1);
        place(x, y, g.me === 1 ? 2 : 1);
      }, 500 + Math.random() * 700);
    }
  }

  function onPeerMsg(m) {
    if (!g || g.mode !== 'pvp') return;
    if (m.t === 'mv') {
      const opp = g.me === 1 ? 2 : 1;
      if (g.over || m.r !== g.round || m.n !== g.moves.length || g.turn !== opp || !inside(m.x, m.y) || g.board[idx(m.x, m.y)]) return;
      place(m.x, m.y, opp);
    } else if (m.t === 'again') {
      g.peerAgain = true;
      if (g.wantAgain) rematch();
      else { say(`${josa(g.session.peerName, '이가', '가')} 한 판 더 하재요!`); drawControls(); }
    }
  }

  function rematch() {
    const next = g.me === 1 ? 2 : 1; // 판마다 돌 색을 바꾼다
    start({ mode: g.mode, me: next, session: g.session, round: g.round + 1 });
  }

  function drawControls() {
    if (!controls) return;
    const btns = [h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { close(); menu(); } }, '그만하기')];
    if (g && g.over && !g.peerLeft) {
      if (g.mode === 'ai' || g.session.bot) {
        btns.push(h('button', { class: 'btn btn-go', type: 'button', onclick: () => (g.mode === 'ai' ? start({ mode: 'ai', me: g.me === 1 ? 2 : 1 }) : rematch()) }, '한 판 더'));
      } else {
        btns.push(h('button', { class: 'btn btn-go', type: 'button', disabled: g.wantAgain, onclick: () => {
          g.wantAgain = true;
          g.session.send('again');
          if (g.peerAgain) rematch();
          else { say(`${josa(g.session.peerName, '을', '를')} 기다리고 있어요…`); drawControls(); }
        } }, g.peerAgain ? '좋아, 한 판 더!' : g.wantAgain ? '기다리는 중…' : '한 판 더'));
      }
    }
    controls.replaceChildren(...btns);
  }

  function open() {
    modal.open('오목 놀이터', h('div'), { cls: 'game-sheet', onClose: close });
    menu();
  }
  function openWith(session) {
    modal.open('오목 놀이터', h('div'), { cls: 'game-sheet', onClose: close });
    startSession(session);
  }
  return { open, openWith, get state() { return g && { moves: g.moves.map((m) => m.join(',')), turn: g.turn, me: g.me, over: g.over, round: g.round }; } };
}
