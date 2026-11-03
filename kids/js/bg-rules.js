// 진숲 어린이 마을 — 보드게임 섬 놀이 규칙과 컴퓨터 상대
// 화면과 따로 두어서 node에서도 시험할 수 있다. 판(state)은 JSON처럼 단순한 값만 담는다.
// 두 사람 놀이는 같은 씨앗(seed)으로 판을 만들고, 같은 순서로 같은 수를 두면 두 화면의 판이 똑같아진다.
// 사람 번호: 0, 1 (친구와 할 때 0은 초대한 사람, 컴퓨터와 할 때 0은 나)

// ---------- 씨앗으로 만드는 난수 (판 안에 상태를 둔다) ----------
export function rndNext(s) {
  s.rs = (s.rs + 0x6D2B79F5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rndNext(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const other = (p) => 1 - p;

// =====================================================================
// 과일 종 치기: 과일 카드를 번갈아 뒤집다가, 보이는 카드에 같은 과일이 꼭 다섯 개면 종을 친다
// 카드 = 과일번호 * 10 + 개수 (과일 0 사과, 1 감, 2 복숭아 / 개수 1~5)
// =====================================================================
export const FRUITS = [
  { id: 'apple', name: '사과', color: '#EF6461' },
  { id: 'gam', name: '감', color: '#F49A4C' },
  { id: 'peach', name: '복숭아', color: '#F6A2C4' },
];
const FRUIT_COUNTS = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5]; // 과일마다 14장, 모두 42장
export const FRUIT_TIME = 180; // 3분이 지나면 카드가 많은 사람이 이긴다

export const Fruit = {
  init(seed, { first = 0 } = {}) {
    const s = { rs: seed >>> 0, deck: [[], []], pile: [[], []], turn: first, v: 0, over: null, last: null };
    const cards = [];
    for (let f = 0; f < 3; f++) for (const n of FRUIT_COUNTS) cards.push(f * 10 + n);
    shuffle(s, cards);
    s.deck = [cards.slice(0, 21), cards.slice(21)];
    return s;
  },
  top(s, p) { const pl = s.pile[p]; return pl.length ? pl[pl.length - 1] : null; },
  // 보이는 카드(두 사람 더미 맨 위)의 과일별 개수
  sums(s) {
    const sum = [0, 0, 0];
    for (const p of [0, 1]) { const c = Fruit.top(s, p); if (c != null) sum[Math.floor(c / 10)] += c % 10; }
    return sum;
  },
  five(s) { return Fruit.sums(s).includes(5); },
  canFlip(s, p) { return !s.over && s.turn === p && s.deck[p].length > 0; },
  // 차례인데 뒤집을 카드가 없다 (종을 칠 기회를 조금 준 뒤 진다)
  stuck(s) { return !s.over && s.deck[s.turn].length === 0; },
  flip(s, p) {
    if (!Fruit.canFlip(s, p)) return null;
    const c = s.deck[p].shift();
    s.pile[p].push(c);
    s.turn = other(p);
    s.v++;
    s.last = { k: 'flip', p, c };
    return c;
  },
  // 종 치기: 맞으면 두 더미를 모두 가져오고 다음에 내가 뒤집는다. 틀리면 내 카드 한 장을 친구에게 준다
  ring(s, p) {
    if (s.over) return null;
    const ok = Fruit.five(s);
    let n = 0;
    if (ok) {
      const got = [...s.pile[0], ...s.pile[1]];
      n = got.length;
      s.deck[p].push(...got);
      s.pile = [[], []];
      s.turn = p;
    } else if (s.deck[p].length) {
      s.deck[other(p)].push(s.deck[p].shift());
      n = 1;
    }
    s.v++;
    s.last = { k: 'ring', p, ok, n };
    return { ok, n };
  },
  // 끝내기: why 'stuck'(차례인데 카드가 없음), 'time'(시간이 다 됨)
  end(s, why) {
    if (s.over) return s.over;
    if (why === 'stuck') s.over = { winner: other(s.turn), why };
    else {
      const a = s.deck[0].length, b = s.deck[1].length;
      s.over = { winner: a === b ? -1 : a > b ? 0 : 1, why };
    }
    s.v++;
    return s.over;
  },
};
// 컴퓨터가 종을 칠 때까지 걸리는 시간(ms). null이면 이번에는 못 본 척 넘어간다
export function fruitRingDelay(level, isFive) {
  if (!isFive) {
    const oops = { easy: 0.03, normal: 0.01, hard: 0 }[level] || 0;
    return Math.random() < oops ? 900 + Math.random() * 700 : null;
  }
  const [miss, lo, hi] = { easy: [0.25, 1300, 2200], normal: [0.08, 850, 1400], hard: [0.02, 560, 900] }[level] || [0.08, 850, 1400];
  return Math.random() < miss ? null : lo + Math.random() * (hi - lo);
}

// =====================================================================
// 77 피하기: 숫자 카드를 한 장씩 내며 합계를 더한다. 11의 배수(11, 22, …, 66)가 되거나 77 이상이 되면 생명 하나를 잃는다
// 카드: 1~10 숫자 4장씩, 0 네 장, −10 세 장(합계 10 빼기), 두 번! 세 장(친구가 두 장을 내야 한다)
// =====================================================================
export const C77 = { MINUS: 11, TWICE: 12 };
export const N77_LIVES = 3;
export function card77Label(c) { return c === C77.MINUS ? '−10' : c === C77.TWICE ? '두 번!' : String(c); }
export function bust77(total) { return total >= 77 || (total > 0 && total % 11 === 0); }
function after77(total, c) {
  if (c === C77.MINUS) return Math.max(0, total - 10);
  if (c === C77.TWICE) return total;
  return total + c;
}
export const N77 = {
  init(seed, { first = 0 } = {}) {
    const s = { rs: seed >>> 0, deck: [], discard: [], hand: [[], []], total: 0, lives: [N77_LIVES, N77_LIVES], turn: first, need: 1, over: null, last: null, n: 0 };
    for (let v = 0; v <= 10; v++) for (let k = 0; k < 4; k++) s.deck.push(v);
    for (let k = 0; k < 3; k++) s.deck.push(C77.MINUS, C77.TWICE);
    shuffle(s, s.deck);
    for (let k = 0; k < 4; k++) for (const p of [0, 1]) s.hand[p].push(s.deck.pop());
    return s;
  },
  draw(s) {
    if (!s.deck.length) { s.deck = shuffle(s, s.discard); s.discard = []; }
    return s.deck.pop();
  },
  legal(s, p, a) { return !s.over && s.turn === p && a && Number.isInteger(a.i) && a.i >= 0 && a.i < s.hand[p].length; },
  apply(s, p, a) {
    const c = s.hand[p].splice(a.i, 1)[0];
    s.discard.push(c);
    s.hand[p].push(N77.draw(s));
    const before = s.total;
    s.total = after77(before, c);
    s.n++;
    const ev = { k: 'play', p, c, before, total: s.total, bust: false };
    if (c !== C77.TWICE && bust77(s.total)) {
      ev.bust = true;
      s.lives[p]--;
      s.total = 0;
      s.turn = other(p);
      s.need = 1;
      if (s.lives[p] <= 0) s.over = { winner: other(p), why: 'lives' };
    } else if (c === C77.TWICE) {
      s.turn = other(p);
      s.need = 2;
    } else if (s.need > 1) {
      s.need--;
    } else {
      s.turn = other(p);
      s.need = 1;
    }
    s.last = ev;
    return ev;
  },
};
// 컴퓨터: 쉬움은 대충, 보통은 안전한 카드를 고르고, 어려움은 친구가 곤란한 합계를 만든다
export function ai77(s, p, level = 'normal') {
  const hand = s.hand[p];
  const opts = hand.map((c, i) => {
    const t = after77(s.total, c);
    const bust = c !== C77.TWICE && bust77(t);
    // 두 장을 내야 하면, 다음 카드도 안전하게 낼 수 있는지 본다
    let next = true;
    if (!bust && s.need > 1 && c !== C77.TWICE) next = hand.some((d, j) => j !== i && (d === C77.TWICE || !bust77(after77(t, d))));
    // 친구가 낼 숫자(0~10) 가운데 터지는 것의 수 (클수록 친구가 곤란하다)
    let trap = 0;
    if (!bust) for (let v = 1; v <= 10; v++) if (bust77(t + v)) trap++;
    const special = c === 0 || c === C77.MINUS || c === C77.TWICE;
    return { i, c, t, bust, next, trap, special };
  });
  const safe = opts.filter((o) => !o.bust);
  if (!safe.length) return { i: pick(opts).i };
  if (level === 'easy') return { i: (Math.random() < 0.7 ? pick(safe) : pick(opts)).i };
  const score = (o) => (o.next ? 0 : -50) + o.trap * (level === 'hard' ? 3 : 1.5) - (o.special ? (o.t > 55 ? 2 : 8) : 0) + (level === 'hard' && o.c === C77.TWICE && s.total > 60 ? 12 : 0) + Math.random() * (level === 'hard' ? 0.5 : 2);
  safe.sort((a, b) => score(b) - score(a));
  return { i: safe[0].i };
}

// =====================================================================
// 숫자 암호: 해(밝은) 타일과 밤(어두운) 타일에 0~11 숫자. 작은 수부터 늘어놓고, 같은 수면 밤 타일이 왼쪽
// 타일 = 숫자 * 2 + 색 (색 0 밤, 1 해). 내 차례: 한 장 가져오고 → 친구 타일 하나의 숫자를 맞힌다
// 맞히면 더 맞히거나 멈추고(가져온 타일은 숨겨서 내 줄에), 틀리면 가져온 타일을 보여 주며 내 줄에 놓는다
// =====================================================================
export const CODE_MAX = 11;
export const codeNum = (k) => k >> 1;
export const codeColor = (k) => k & 1; // 0 밤, 1 해
function insertTile(row, t) {
  let i = 0;
  while (i < row.length && row[i].k < t.k) i++;
  row.splice(i, 0, t);
  return i;
}
export const Code = {
  init(seed, { first = 0 } = {}) {
    const s = { rs: seed >>> 0, pile: [], rows: [[], []], turn: first, phase: 'draw', drawn: null, over: null, last: null, n: 0 };
    for (let k = 0; k <= CODE_MAX * 2 + 1; k++) s.pile.push(k);
    shuffle(s, s.pile);
    for (let j = 0; j < 4; j++) for (const p of [0, 1]) insertTile(s.rows[p], { k: s.pile.pop(), open: false, no: [] });
    if (!s.pile.length) s.phase = 'guess';
    return s;
  },
  hidden(row) { return row.filter((t) => !t.open).length; },
  legal(s, p, a) {
    if (s.over || s.turn !== p || !a) return false;
    if (a.k === 'draw') return s.phase === 'draw' && s.pile.length > 0;
    if (a.k === 'guess') {
      const t = s.rows[other(p)][a.i];
      return s.phase === 'guess' && !!t && !t.open && Number.isInteger(a.n) && a.n >= 0 && a.n <= CODE_MAX;
    }
    if (a.k === 'again' || a.k === 'stop') return s.phase === 'more';
    if (a.k === 'reveal') { const t = s.rows[p][a.i]; return s.phase === 'reveal' && !!t && !t.open; }
    return false;
  },
  endTurn(s, p) { s.turn = other(p); s.drawn = null; s.phase = s.pile.length ? 'draw' : 'guess'; },
  apply(s, p, a) {
    s.n++;
    const ev = { k: a.k, p };
    if (a.k === 'draw') {
      s.drawn = s.pile.pop();
      s.phase = 'guess';
      ev.drawn = s.drawn;
    } else if (a.k === 'guess') {
      const opp = s.rows[other(p)], t = opp[a.i];
      ev.i = a.i; ev.n = a.n; ev.tk = t.k;
      if (codeNum(t.k) === a.n) {
        t.open = true;
        ev.ok = true;
        if (!Code.hidden(opp)) s.over = { winner: p, why: 'all' };
        else s.phase = 'more';
      } else {
        ev.ok = false;
        if (!t.no.includes(a.n)) t.no.push(a.n);
        if (s.drawn != null) {
          ev.placed = insertTile(s.rows[p], { k: s.drawn, open: true, no: [] });
          ev.shown = s.drawn;
          if (!Code.hidden(s.rows[p])) s.over = { winner: other(p), why: 'all' };
          else Code.endTurn(s, p);
        } else if (Code.hidden(s.rows[p])) s.phase = 'reveal';
        else { s.over = { winner: other(p), why: 'all' }; }
      }
    } else if (a.k === 'again') {
      s.phase = 'guess';
    } else if (a.k === 'stop') {
      if (s.drawn != null) ev.placed = insertTile(s.rows[p], { k: s.drawn, open: false, no: [] });
      Code.endTurn(s, p);
    } else if (a.k === 'reveal') {
      const t = s.rows[p][a.i];
      t.open = true;
      ev.i = a.i; ev.tk = t.k;
      if (!Code.hidden(s.rows[p])) s.over = { winner: other(p), why: 'all' };
      else Code.endTurn(s, p);
    }
    s.last = ev;
    return ev;
  },
  // p가 아는 것으로 친구 줄의 숨은 타일마다 될 수 있는 숫자와 그 가능성(0~1)
  // 줄은 왼쪽부터 커지므로, 칸마다 들어갈 수 있는 타일들 가운데 커지는 차례를 지키는 경우를 센다
  odds(s, p) {
    const row = s.rows[other(p)];
    const known = new Set();
    for (const t of s.rows[p]) known.add(t.k);
    if (s.drawn != null && s.turn === p) known.add(s.drawn);
    for (const t of row) if (t.open) known.add(t.k);
    const K = CODE_MAX * 2 + 2;
    const cand = row.map((t) => {
      if (t.open) return [t.k];
      const out = [];
      for (let k = codeColor(t.k); k < K; k += 2) if (!known.has(k) && !t.no.includes(codeNum(k))) out.push(k);
      return out;
    });
    const m = row.length;
    const f = cand.map(() => new Map()), g = cand.map(() => new Map());
    for (let i = 0; i < m; i++) for (const k of cand[i]) {
      let c = 0;
      if (i === 0) c = 1; else for (const [k2, v] of f[i - 1]) if (k2 < k) c += v;
      if (c) f[i].set(k, c);
    }
    for (let i = m - 1; i >= 0; i--) for (const k of cand[i]) {
      let c = 0;
      if (i === m - 1) c = 1; else for (const [k2, v] of g[i + 1]) if (k2 > k) c += v;
      if (c) g[i].set(k, c);
    }
    let total = 0;
    for (const [k, v] of f[m - 1] || []) total += v * (g[m - 1].get(k) || 0);
    return row.map((t, i) => {
      if (t.open) return null;
      const list = [];
      for (const k of cand[i]) {
        const w = (f[i].get(k) || 0) * (g[i].get(k) || 0);
        if (w) list.push({ n: codeNum(k), p: total ? w / total : 0 });
      }
      list.sort((a, b) => b.p - a.p);
      return list;
    });
  },
};
// 컴퓨터의 한 수 (지금 단계에 맞게)
export function aiCode(s, p, level = 'normal') {
  if (s.phase === 'draw') return { k: 'draw' };
  if (s.phase === 'reveal') {
    // 숨긴 타일 가운데 친구가 맞히기 쉬운 것(가장 작거나 큰 쪽)을 보여 준다
    const idx = s.rows[p].map((t, i) => (t.open ? -1 : i)).filter((i) => i >= 0);
    return { k: 'reveal', i: level === 'easy' ? pick(idx) : idx[0] };
  }
  const odds = Code.odds(s, p);
  const best = () => {
    let b = null;
    odds.forEach((list, i) => { if (list && list.length && (!b || list[0].p > b.p)) b = { i, n: list[0].n, p: list[0].p }; });
    return b;
  };
  if (s.phase === 'more') {
    const b = best();
    // 더 맞히는 쪽이 대개 유리하다 (쉬움은 확실할 때만 더 맞힌다)
    const need = { easy: 0.99, normal: 0.5, hard: 0.3 }[level] || 0.5;
    const go = b && b.p >= need;
    return { k: go ? 'again' : 'stop' };
  }
  if (level === 'easy' && odds.some((l) => l && l.length)) {
    const idx = odds.map((l, i) => (l && l.length ? i : -1)).filter((i) => i >= 0);
    const i = pick(idx);
    return { k: 'guess', i, n: Math.random() < 0.5 ? odds[i][0].n : pick(odds[i]).n };
  }
  const b = best();
  if (!b) {
    // 따질 수 없으면 (그럴 일은 없지만) 숨은 타일 하나에 아무 숫자나
    const idx = s.rows[other(p)].map((t, i) => (t.open ? -1 : i)).filter((i) => i >= 0);
    return { k: 'guess', i: pick(idx), n: Math.floor(Math.random() * (CODE_MAX + 1)) };
  }
  if (level === 'normal' && b.p < 0.999 && Math.random() < 0.15) {
    // 보통: 가끔은 아무 숨은 타일에서 가장 그럴듯한 수를 고른다
    const idx = odds.map((l, i) => (l && l.length ? i : -1)).filter((i) => i >= 0);
    const i = pick(idx);
    return { k: 'guess', i, n: odds[i][0].n };
  }
  return { k: 'guess', i: b.i, n: b.n };
}

// =====================================================================
// 만칼라: 구멍 여섯 개씩, 돌 네 개씩. 내 구멍의 돌을 모두 집어 오른쪽(시계 반대 방향)으로 하나씩 놓는다
// 판: 0~5 사람0 구멍, 6 사람0 창고, 7~12 사람1 구멍, 13 사람1 창고
// 마지막 돌이 내 창고에 들어가면 한 번 더, 내 빈 구멍에 들어가면 맞은편 돌까지 내 창고로
// =====================================================================
export const MAN = { PITS: 6, STONES: 4 };
const storeOf = (p) => (p === 0 ? 6 : 13);
const pitIdx = (p, i) => (p === 0 ? i : 7 + i);
export const Mancala = {
  init(seed, { first = 0 } = {}) {
    const b = new Array(14).fill(MAN.STONES);
    b[6] = 0; b[13] = 0;
    return { rs: seed >>> 0, b, turn: first, over: null, last: null, n: 0 };
  },
  legal(s, p, a) { return !s.over && s.turn === p && a && Number.isInteger(a.i) && a.i >= 0 && a.i < 6 && s.b[pitIdx(p, a.i)] > 0; },
  // 돌을 놓아 가는 자리들 (화면에서 하나씩 보여 준다)
  sow(b, p, i) {
    const path = [];
    let at = pitIdx(p, i), n = b[at];
    b[at] = 0;
    const skip = storeOf(other(p));
    while (n > 0) {
      at = (at + 1) % 14;
      if (at === skip) continue;
      b[at]++;
      n--;
      path.push(at);
    }
    return { path, last: at };
  },
  apply(s, p, a) {
    s.n++;
    const b = s.b;
    const from = pitIdx(p, a.i);
    const { path, last } = Mancala.sow(b, p, a.i);
    const ev = { k: 'sow', p, i: a.i, from, path, again: false, cap: 0 };
    const mine = p === 0 ? last >= 0 && last <= 5 : last >= 7 && last <= 12;
    if (last === storeOf(p)) ev.again = true;
    else if (mine && b[last] === 1 && b[12 - last] > 0) {
      ev.cap = b[12 - last] + 1;
      ev.capAt = [last, 12 - last];
      b[storeOf(p)] += ev.cap;
      b[last] = 0;
      b[12 - last] = 0;
    }
    // 한쪽 구멍이 모두 비면 끝: 남은 돌은 그 주인의 창고로
    const side = (q) => { let t = 0; for (let k = 0; k < 6; k++) t += b[pitIdx(q, k)]; return t; };
    if (side(0) === 0 || side(1) === 0) {
      for (const q of [0, 1]) for (let k = 0; k < 6; k++) { b[storeOf(q)] += b[pitIdx(q, k)]; b[pitIdx(q, k)] = 0; }
      const x = b[6], y = b[13];
      s.over = { winner: x === y ? -1 : x > y ? 0 : 1, why: 'empty' };
      ev.sweep = true;
    } else if (!ev.again) s.turn = other(p);
    s.last = ev;
    return ev;
  },
};
// 컴퓨터: 몇 수 앞까지 따져 본다 (쉬움 1수, 보통 4수, 어려움 6수)
export function aiMancala(s, p, level = 'normal') {
  const moves = [0, 1, 2, 3, 4, 5].filter((i) => s.b[pitIdx(p, i)] > 0);
  if (level === 'easy' && Math.random() < 0.45) return { i: pick(moves) };
  const depth = { easy: 1, normal: 4, hard: 6 }[level] || 4;
  const clone = (st) => ({ b: st.b.slice(), turn: st.turn, over: st.over, n: 0, last: null });
  const evalS = (st) => {
    if (st.over) return st.over.winner === p ? 1000 : st.over.winner === -1 ? 0 : -1000;
    return st.b[storeOf(p)] - st.b[storeOf(other(p))];
  };
  const search = (st, d, al, be) => {
    if (d === 0 || st.over) return evalS(st);
    const q = st.turn;
    const ms = [0, 1, 2, 3, 4, 5].filter((i) => st.b[pitIdx(q, i)] > 0);
    if (q === p) {
      let v = -Infinity;
      for (const i of ms) { const c = clone(st); Mancala.apply(c, q, { i }); v = Math.max(v, search(c, c.turn === q ? d : d - 1, al, be)); al = Math.max(al, v); if (al >= be) break; }
      return v;
    }
    let v = Infinity;
    for (const i of ms) { const c = clone(st); Mancala.apply(c, q, { i }); v = Math.min(v, search(c, c.turn === q ? d : d - 1, al, be)); be = Math.min(be, v); if (al >= be) break; }
    return v;
  };
  let best = moves[0], bv = -Infinity;
  for (const i of moves) {
    const c = clone(s);
    Mancala.apply(c, p, { i });
    const v = search(c, c.turn === p ? depth : depth - 1, -Infinity, Infinity) + Math.random() * 0.3;
    if (v > bv) { bv = v; best = i; }
  }
  return { i: best };
}

// =====================================================================
// 윷놀이: 윷가락 넷을 던져 도(1) 개(2) 걸(3) 윷(4) 모(5), 표시된 가락만 엎어지면 빽도(−1)
// 윷이나 모가 나오거나 친구 말을 잡으면 한 번 더 던진다. 내 말이 모두 먼저 들어오면 이긴다
// 판 자리: 바깥 0~19 (0은 출발·도착, 5·10·15는 모서리), 지름길 20~24 (5 → 가운데 22 → 15), 25~28 (10 → 22 → 0)
// =====================================================================
export const YUT = { HOME: -1, DONE: 99 };
export const YUT_NAMES = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
// 화면에 그릴 자리 (0~1 좌표, 오른쪽 아래가 출발)
export const YUT_XY = (() => {
  const P = {};
  const L = 0.06, R = 0.94;
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i <= 5; i++) P[i] = [R, lerp(R, L, i / 5)]; // 0 오른쪽 아래 → 5 오른쪽 위
  for (let i = 1; i <= 5; i++) P[5 + i] = [lerp(R, L, i / 5), L]; // → 10 왼쪽 위
  for (let i = 1; i <= 5; i++) P[10 + i] = [L, lerp(L, R, i / 5)]; // → 15 왼쪽 아래
  for (let i = 1; i <= 4; i++) P[15 + i] = [lerp(L, R, i / 5), R]; // → 19
  const C = [0.5, 0.5];
  const diag = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  P[20] = diag(P[5], C, 1 / 3); P[21] = diag(P[5], C, 2 / 3); P[22] = C; P[23] = diag(C, P[15], 1 / 3); P[24] = diag(C, P[15], 2 / 3);
  P[25] = diag(P[10], C, 1 / 3); P[26] = diag(P[10], C, 2 / 3); P[27] = diag(C, P[0], 1 / 3); P[28] = diag(C, P[0], 2 / 3);
  return P;
})();
export const YUT_LINES = [[0, 5], [5, 10], [10, 15], [15, 0], [5, 15], [10, 0]];
// 윷가락 던지기: 가락마다 평평한 쪽이 위로 올 확률 0.6. 첫째 가락에 빽도 표시
export function throwYut(s) {
  const flat = [0, 1, 2, 3].map(() => rndNext(s) < 0.6);
  const n = flat.filter(Boolean).length;
  const v = n === 0 ? 5 : n === 1 && flat[0] ? -1 : n;
  return { v, flat };
}
// 한 칸 앞으로 (first: 이번 이동의 첫 칸, prev: 바로 앞 자리)
function yutStep(n, first, prev) {
  if (n === YUT.HOME) return 1;
  if (first) { if (n === 5) return 20; if (n === 10) return 25; if (n === 22) return 27; }
  if (n === 22) return prev === 26 ? 27 : 23;
  if (n === 24) return 15;
  if (n === 28 || n === 19 || n === 0) return YUT.DONE;
  if (n === 21) return 22;
  if (n === 26) return 22;
  return n + 1; // 바깥 1~18, 20, 23, 25, 27
}
// 남은 칸 수 (컴퓨터가 쓰는 대강의 거리)
const YUT_LEFT = (() => {
  const R = { 0: 1, 20: 10, 21: 9, 22: 3, 23: 7, 24: 6, 25: 5, 26: 4, 27: 2, 28: 1 };
  for (let n = 1; n <= 4; n++) R[n] = 5 - n + 11;
  R[5] = 11;
  for (let n = 6; n <= 10; n++) R[n] = 10 - n + 6;
  for (let n = 11; n <= 19; n++) R[n] = 20 - n;
  R[YUT.HOME] = 17;
  R[YUT.DONE] = 0;
  return R;
})();
export const Yut = {
  init(seed, { first = 0, pieces = 4 } = {}) {
    const np = pieces === 2 ? 2 : 4;
    return {
      rs: seed >>> 0, np,
      pos: [new Array(np).fill(YUT.HOME), new Array(np).fill(YUT.HOME)],
      hist: [Array.from({ length: np }, () => []), Array.from({ length: np }, () => [])],
      tray: [], throws: 1, turn: first, phase: 'throw', over: null, last: null, n: 0, sticks: null,
    };
  },
  // 말 j가 값 v로 가는 곳과 지나는 길 (갈 수 없으면 null)
  dest(s, p, j, v) {
    const at = s.pos[p][j];
    if (at === YUT.DONE) return null;
    if (v === -1) {
      if (at === YUT.HOME) return null;
      const h = s.hist[p][j];
      let to;
      if (h.length >= 2) to = h[h.length - 2];
      else to = at === 0 ? 19 : 0;
      return { to, path: [to] };
    }
    let n = at, prev = null;
    const path = [];
    for (let k = 0; k < v; k++) {
      const nx = yutStep(n, k === 0, prev);
      prev = n;
      n = nx;
      path.push(n);
      if (n === YUT.DONE) break;
    }
    return { to: n, path };
  },
  // 같은 자리에 업힌 내 말들
  group(s, p, j) {
    const at = s.pos[p][j];
    if (at === YUT.HOME || at === YUT.DONE) return [j];
    return s.pos[p].map((q, k) => (q === at ? k : -1)).filter((k) => k >= 0);
  },
  options(s, p) {
    const out = [];
    if (s.over || s.turn !== p || s.phase !== 'move') return out;
    const seenV = new Set();
    s.tray.forEach((v, t) => {
      if (seenV.has(v)) return;
      seenV.add(v);
      const seenAt = new Set();
      s.pos[p].forEach((at, j) => {
        if (at === YUT.DONE) return;
        const key = at === YUT.HOME ? 'h' : String(at);
        if (seenAt.has(key)) return; // 집에 있는 말이나 업힌 말은 하나만
        const d = Yut.dest(s, p, j, v);
        if (!d) return;
        seenAt.add(key);
        out.push({ t, j, v, to: d.to, path: d.path });
      });
    });
    return out;
  },
  legal(s, p, a) {
    if (s.over || s.turn !== p || !a) return false;
    if (a.k === 'throw') return s.phase === 'throw' && s.throws > 0;
    if (a.k === 'move') return s.phase === 'move' && Number.isInteger(a.t) && Number.isInteger(a.j) && s.tray[a.t] != null && a.j >= 0 && a.j < s.np && !!Yut.dest(s, p, a.j, s.tray[a.t]);
    return false;
  },
  // 던질 것도 없고 움직일 수도 없으면 차례를 넘긴다
  settle(s, p) {
    if (s.over) return;
    if (s.throws > 0) { s.phase = 'throw'; return; }
    if (s.tray.length) {
      s.phase = 'move';
      if (Yut.options(s, p).length) return;
      s.dropped = s.tray.slice();
      s.tray = [];
    }
    s.turn = other(p);
    s.throws = 1;
    s.phase = 'throw';
  },
  apply(s, p, a) {
    s.n++;
    s.dropped = null;
    const ev = { k: a.k, p };
    if (a.k === 'throw') {
      const r = throwYut(s);
      s.sticks = r.flat;
      ev.v = r.v; ev.flat = r.flat;
      s.tray.push(r.v);
      if (r.v < 4) s.throws--;
      ev.again = r.v >= 4;
      Yut.settle(s, p);
    } else {
      const v = s.tray[a.t];
      const d = Yut.dest(s, p, a.j, v);
      const grp = Yut.group(s, p, a.j);
      const lead = s.hist[p][a.j].slice();
      s.tray.splice(a.t, 1);
      ev.v = v; ev.j = a.j; ev.grp = grp; ev.from = s.pos[p][a.j]; ev.to = d.to; ev.path = d.path;
      if (d.to === YUT.DONE) {
        for (const k of grp) { s.pos[p][k] = YUT.DONE; s.hist[p][k] = []; }
      } else {
        const h = v === -1 ? (lead.length >= 2 ? lead.slice(0, -1) : [d.to]) : [...lead, ...d.path];
        for (const k of grp) { s.pos[p][k] = d.to; s.hist[p][k] = h.slice(); }
        const o = other(p);
        const hit = s.pos[o].map((q, k) => (q === d.to ? k : -1)).filter((k) => k >= 0);
        if (hit.length) {
          for (const k of hit) { s.pos[o][k] = YUT.HOME; s.hist[o][k] = []; }
          ev.cap = hit;
          s.throws++;
        }
        ev.stack = s.pos[p].filter((q) => q === d.to).length > grp.length;
      }
      if (s.pos[p].every((q) => q === YUT.DONE)) s.over = { winner: p, why: 'home' };
      Yut.settle(s, p);
    }
    ev.dropped = s.dropped;
    s.last = ev;
    return ev;
  },
};
export function aiYut(s, p, level = 'normal') {
  if (s.phase === 'throw') return { k: 'throw' };
  const opts = Yut.options(s, p);
  const o = other(p);
  // 친구 말이 1~5칸 뒤에 있으면 잡힐 수 있다
  const reachable = (node) => {
    for (let j = 0; j < s.np; j++) {
      const at = s.pos[o][j];
      if (at === YUT.DONE) continue;
      for (let v = 1; v <= 5; v++) { const d = Yut.dest(s, o, j, v); if (d && d.to === node) return true; }
    }
    return false;
  };
  const scored = opts.map((op) => {
    const grp = Yut.group(s, p, op.j);
    const from = s.pos[p][op.j];
    let sc = (YUT_LEFT[from] - YUT_LEFT[op.to]) * 2 * grp.length;
    if (op.to === YUT.DONE) sc += 30 * grp.length;
    else {
      const caps = s.pos[o].filter((q) => q === op.to).length;
      sc += caps * 55;
      if (s.pos[p].some((q, k) => q === op.to && !grp.includes(k))) sc += 8;
      if ([5, 10, 22].includes(op.to)) sc += 10;
      if (reachable(op.to)) sc -= 22 * grp.length * (level === 'hard' ? 1.2 : 1);
      if (from !== YUT.HOME && from !== YUT.DONE && reachable(from)) sc += 12 * grp.length; // 잡히기 쉬운 곳에서 달아난다
    }
    if (op.v === -1) sc -= 3;
    return { op, sc: sc + Math.random() * (level === 'hard' ? 1 : 6) };
  });
  scored.sort((a, b) => b.sc - a.sc);
  const ch = level === 'easy' && Math.random() < 0.5 ? pick(scored) : scored[0];
  return { k: 'move', t: ch.op.t, j: ch.op.j };
}

// =====================================================================
// 땅따먹기 (점 잇기): 점과 점 사이에 선을 하나씩 긋는다. 네모의 네 번째 선을 그으면 그 땅을 갖고 한 번 더
// 네모 4×4. 선 번호: 가로선 0~19 (줄 r 0~4, 칸 c 0~3), 세로선 20~39 (줄 r 0~3, 칸 c 0~4)
// =====================================================================
export const DOTS_N = 4;
export const hLine = (r, c) => r * DOTS_N + c;
export const vLine = (r, c) => (DOTS_N + 1) * DOTS_N + r * (DOTS_N + 1) + c;
export const DOTS_LINES = 2 * DOTS_N * (DOTS_N + 1);
export const boxSides = (r, c) => [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)];
// 선 하나에 붙은 네모들
export function lineBoxes(l) {
  const out = [];
  const H = (DOTS_N + 1) * DOTS_N;
  if (l < H) {
    const r = Math.floor(l / DOTS_N), c = l % DOTS_N;
    if (r > 0) out.push([r - 1, c]);
    if (r < DOTS_N) out.push([r, c]);
  } else {
    const k = l - H, r = Math.floor(k / (DOTS_N + 1)), c = k % (DOTS_N + 1);
    if (c > 0) out.push([r, c - 1]);
    if (c < DOTS_N) out.push([r, c]);
  }
  return out;
}
export const Dots = {
  init(seed, { first = 0 } = {}) {
    return { rs: seed >>> 0, lines: new Array(DOTS_LINES).fill(0), boxes: new Array(DOTS_N * DOTS_N).fill(0), turn: first, over: null, last: null, n: 0 };
  },
  legal(s, p, a) { return !s.over && s.turn === p && a && Number.isInteger(a.l) && a.l >= 0 && a.l < DOTS_LINES && !s.lines[a.l]; },
  sidesOf(s, r, c) { return boxSides(r, c).filter((l) => s.lines[l]).length; },
  apply(s, p, a) {
    s.n++;
    s.lines[a.l] = p + 1;
    const got = [];
    for (const [r, c] of lineBoxes(a.l)) {
      if (Dots.sidesOf(s, r, c) === 4 && !s.boxes[r * DOTS_N + c]) { s.boxes[r * DOTS_N + c] = p + 1; got.push(r * DOTS_N + c); }
    }
    if (!got.length) s.turn = other(p);
    if (s.boxes.every((b) => b)) {
      const x = s.boxes.filter((b) => b === 1).length, y = s.boxes.length - x;
      s.over = { winner: x === y ? -1 : x > y ? 0 : 1, why: 'full' };
    }
    const ev = { k: 'line', p, l: a.l, got };
    s.last = ev;
    return ev;
  },
};
export function aiDots(s, p, level = 'normal') {
  const free = [];
  for (let l = 0; l < DOTS_LINES; l++) if (!s.lines[l]) free.push(l);
  const completes = (st, l) => lineBoxes(l).filter(([r, c]) => Dots.sidesOf(st, r, c) === 3).length;
  const gives = (st, l) => lineBoxes(l).some(([r, c]) => Dots.sidesOf(st, r, c) === 2);
  const take = free.filter((l) => completes(s, l) > 0);
  if (take.length && (level !== 'easy' || Math.random() < 0.75)) return { l: pick(take) };
  const safe = free.filter((l) => !gives(s, l) && !completes(s, l));
  if (safe.length) return { l: pick(safe) };
  if (level === 'easy') return { l: pick(free) };
  // 어쩔 수 없이 땅을 내줄 때: 친구가 가장 적게 가져가는 선
  const giveaway = (l) => {
    const st = { lines: s.lines.slice(), boxes: s.boxes.slice() };
    st.lines[l] = 1;
    let n = 0, more = true;
    while (more) {
      more = false;
      for (let m = 0; m < DOTS_LINES; m++) {
        if (st.lines[m]) continue;
        if (lineBoxes(m).some(([r, c]) => Dots.sidesOf(st, r, c) === 3)) {
          st.lines[m] = 1;
          for (const [r, c] of lineBoxes(m)) if (Dots.sidesOf(st, r, c) === 4 && !st.boxes[r * DOTS_N + c]) { st.boxes[r * DOTS_N + c] = 1; n++; }
          more = true;
        }
      }
    }
    return n;
  };
  let best = free[0], bv = Infinity;
  for (const l of free) { const v = giveaway(l) + Math.random() * 0.1; if (v < bv) { bv = v; best = l; } }
  return { l: best };
}

// 차례를 번갈아 두는 놀이 다섯 (과일 종 치기는 따로)
export const TURN_GAMES = {
  n77: { rules: N77, ai: ai77 },
  code: { rules: Code, ai: aiCode },
  mancala: { rules: Mancala, ai: aiMancala },
  yut: { rules: Yut, ai: aiYut },
  dots: { rules: Dots, ai: aiDots },
};
