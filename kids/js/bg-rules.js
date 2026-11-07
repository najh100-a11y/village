// 진숲 어린이 마을 — 보드게임 섬 놀이 규칙과 컴퓨터 상대
// 화면과 따로 두어서 node에서도 시험할 수 있다. 판(state)은 JSON처럼 단순한 값만 담는다.
// 여럿이 하는 놀이는 같은 씨앗(seed)으로 판을 만들고, 같은 순서로 같은 수를 두면 모든 화면의 판이 똑같아진다.
// 사람 번호(자리): 0 ~ n-1. 차례도 이 순서로 돈다. 끝난 판의 over.winners는 이긴 사람(들) 번호 목록이다
// (여럿이면 공동 1등, 윷놀이 편 놀이면 이긴 편 두 사람).

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
const clampN = (n, max = 4) => Math.max(2, Math.min(max, Number(n) || 2));
// p 다음으로 아직 판에 남은 사람
export function nextActive(s, p) {
  for (let k = 1; k <= s.n; k++) { const q = (p + k) % s.n; if (!s.out || !s.out[q]) return q; }
  return p;
}
export const activeOf = (s) => Array.from({ length: s.n }, (_, i) => i).filter((i) => !s.out || !s.out[i]);
// 점수가 가장 높은 사람들 (같으면 여럿)
function best(list, score) {
  const top = Math.max(...list.map(score));
  return list.filter((p) => score(p) === top);
}

// =====================================================================
// 과일 종 치기: 과일 카드를 차례로 뒤집다가, 보이는 카드에 같은 과일이 꼭 다섯 개면 종을 친다 (2~4명)
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
  init(seed, { n = 2, first = 0 } = {}) {
    n = clampN(n);
    const s = { rs: seed >>> 0, n, deck: [], pile: [], out: new Array(n).fill(false), turn: first % n, v: 0, over: null, last: null };
    const cards = [];
    for (let f = 0; f < 3; f++) for (const c of FRUIT_COUNTS) cards.push(f * 10 + c);
    shuffle(s, cards);
    for (let p = 0; p < n; p++) { s.deck.push([]); s.pile.push([]); }
    // 똑같이 나눈다: 두 명 21장, 세 명 14장, 네 명 10장 (네 명이면 남는 두 장은 쓰지 않는다)
    const per = Math.floor(cards.length / n);
    cards.slice(0, per * n).forEach((c, i) => s.deck[i % n].push(c));
    s.cards = per * n;
    return s;
  },
  top(s, p) { const pl = s.pile[p]; return pl.length ? pl[pl.length - 1] : null; },
  // 보이는 카드(모든 더미 맨 위)의 과일별 개수
  sums(s) {
    const sum = [0, 0, 0];
    for (let p = 0; p < s.n; p++) { const c = Fruit.top(s, p); if (c != null) sum[Math.floor(c / 10)] += c % 10; }
    return sum;
  },
  five(s) { return Fruit.sums(s).includes(5); },
  canFlip(s, p) { return !s.over && !s.out[p] && s.turn === p && s.deck[p].length > 0; },
  // 차례인데 뒤집을 카드가 없다 (종을 칠 틈을 조금 준 뒤 그 사람은 판에서 나간다)
  stuck(s) { return !s.over && s.deck[s.turn].length === 0; },
  flip(s, p) {
    if (!Fruit.canFlip(s, p)) return null;
    const c = s.deck[p].shift();
    s.pile[p].push(c);
    s.turn = nextActive(s, p);
    s.v++;
    s.last = { k: 'flip', p, c };
    return c;
  },
  // 종 치기: 맞으면 모든 더미를 가져오고 다음에 내가 뒤집는다. 틀리면 판에 남은 다른 사람에게 한 장씩 준다
  ring(s, p) {
    if (s.over || s.out[p]) return null;
    const ok = Fruit.five(s);
    let n = 0;
    const to = [];
    if (ok) {
      const got = [];
      for (let q = 0; q < s.n; q++) got.push(...s.pile[q]);
      n = got.length;
      s.deck[p].push(...got);
      s.pile = s.pile.map(() => []);
      s.turn = p;
    } else {
      for (let k = 1; k < s.n; k++) {
        const q = (p + k) % s.n;
        if (s.out[q] || !s.deck[p].length) continue;
        s.deck[q].push(s.deck[p].shift());
        to.push(q);
        n++;
      }
    }
    s.v++;
    s.last = { k: 'ring', p, ok, n, to };
    return { ok, n, to };
  },
  // 차례인 사람이 카드가 없어 판에서 나간다 (펼친 더미는 남는다). 한 사람만 남으면 끝
  drop(s) {
    if (s.over) return null;
    const p = s.turn;
    s.out[p] = true;
    const left = activeOf(s);
    if (left.length <= 1) s.over = { winners: left, why: 'out' };
    else s.turn = nextActive(s, p);
    s.v++;
    s.last = { k: 'out', p };
    return p;
  },
  // 시간이 다 됨: 판에 남은 사람 가운데 카드가 가장 많은 사람(들)
  end(s) {
    if (s.over) return s.over;
    s.over = { winners: best(activeOf(s), (p) => s.deck[p].length), why: 'time' };
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
// 77 피하기: 숫자 카드를 한 장씩 내며 합계를 더한다. 11의 배수(11, 22, …, 66)가 되거나 77 이상이 되면 생명 하나를 잃는다 (2~4명)
// 카드: 1~10 숫자 4장씩, 0 네 장, −10 세 장(합계 10 빼기), 두 번! 세 장(다음 사람이 두 장을 내야 한다)
// 생명을 다 잃으면 판에서 나가고, 마지막까지 남은 사람이 이긴다
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
  init(seed, { n = 2, first = 0 } = {}) {
    n = clampN(n);
    const s = { rs: seed >>> 0, n, deck: [], discard: [], hand: [], total: 0, lives: new Array(n).fill(N77_LIVES), out: new Array(n).fill(false), turn: first % n, need: 1, over: null, last: null };
    for (let v = 0; v <= 10; v++) for (let k = 0; k < 4; k++) s.deck.push(v);
    for (let k = 0; k < 3; k++) s.deck.push(C77.MINUS, C77.TWICE);
    shuffle(s, s.deck);
    for (let p = 0; p < n; p++) s.hand.push([]);
    for (let k = 0; k < 4; k++) for (let p = 0; p < n; p++) s.hand[p].push(s.deck.pop());
    return s;
  },
  draw(s) {
    if (!s.deck.length) { s.deck = shuffle(s, s.discard); s.discard = []; }
    return s.deck.pop();
  },
  legal(s, p, a) { return !s.over && !s.out[p] && s.turn === p && !!a && Number.isInteger(a.i) && a.i >= 0 && a.i < s.hand[p].length; },
  apply(s, p, a) {
    const c = s.hand[p].splice(a.i, 1)[0];
    s.discard.push(c);
    s.hand[p].push(N77.draw(s));
    const before = s.total;
    s.total = after77(before, c);
    const ev = { k: 'play', p, c, before, total: s.total, bust: false };
    if (c !== C77.TWICE && bust77(s.total)) {
      ev.bust = true;
      s.lives[p]--;
      s.total = 0;
      s.need = 1;
      if (s.lives[p] <= 0) { s.out[p] = true; ev.out = true; }
      const left = activeOf(s);
      if (left.length <= 1) s.over = { winners: left, why: 'lives' };
      else s.turn = nextActive(s, p);
    } else if (c === C77.TWICE) {
      s.turn = nextActive(s, p);
      s.need = 2;
    } else if (s.need > 1) {
      s.need--;
    } else {
      s.turn = nextActive(s, p);
      s.need = 1;
    }
    s.last = ev;
    return ev;
  },
};
// 컴퓨터: 쉬움은 대충, 보통은 안전한 카드를 고르고, 어려움은 다음 사람이 곤란한 합계를 만든다
export function ai77(s, p, level = 'normal') {
  const hand = s.hand[p];
  const opts = hand.map((c, i) => {
    const t = after77(s.total, c);
    const bust = c !== C77.TWICE && bust77(t);
    // 두 장을 내야 하면, 다음 카드도 안전하게 낼 수 있는지 본다
    let next = true;
    if (!bust && s.need > 1 && c !== C77.TWICE) next = hand.some((d, j) => j !== i && (d === C77.TWICE || !bust77(after77(t, d))));
    // 다음 사람이 낼 숫자(1~10) 가운데 터지는 것의 수 (클수록 다음 사람이 곤란하다)
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
// 숫자 암호: 해(밝은) 타일과 밤(어두운) 타일에 0~11 숫자. 작은 수부터 늘어놓고, 같은 수면 밤 타일이 왼쪽 (2~4명)
// 타일 = 숫자 * 2 + 색 (색 0 밤, 1 해). 처음에 2~3명은 네 장, 4명은 세 장씩 가진다
// 내 차례: 한 장 가져오고 → 다른 사람 타일 하나의 숫자를 맞힌다. 맞히면 더 맞히거나 멈추고(가져온 타일은 숨겨서 내 줄에),
// 틀리면 가져온 타일을 보여 주며 내 줄에 놓는다. 타일이 다 열린 사람은 판에서 나가고, 마지막까지 숨은 타일이 남은 사람이 이긴다
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
  init(seed, { n = 2, first = 0 } = {}) {
    n = clampN(n);
    const s = { rs: seed >>> 0, n, pile: [], rows: [], out: new Array(n).fill(false), turn: first % n, phase: 'draw', drawn: null, over: null, last: null };
    for (let k = 0; k <= CODE_MAX * 2 + 1; k++) s.pile.push(k);
    shuffle(s, s.pile);
    for (let p = 0; p < n; p++) s.rows.push([]);
    const each = n >= 4 ? 3 : 4;
    for (let j = 0; j < each; j++) for (let p = 0; p < n; p++) insertTile(s.rows[p], { k: s.pile.pop(), open: false, no: [] });
    if (!s.pile.length) s.phase = 'guess';
    return s;
  },
  hidden(row) { return row.filter((t) => !t.open).length; },
  legal(s, p, a) {
    if (s.over || s.out[p] || s.turn !== p || !a) return false;
    if (a.k === 'draw') return s.phase === 'draw' && s.pile.length > 0;
    if (a.k === 'guess') {
      if (!Number.isInteger(a.t) || a.t === p || a.t < 0 || a.t >= s.n || s.out[a.t]) return false;
      const t = s.rows[a.t][a.i];
      return s.phase === 'guess' && !!t && !t.open && Number.isInteger(a.n) && a.n >= 0 && a.n <= CODE_MAX;
    }
    if (a.k === 'again' || a.k === 'stop') return s.phase === 'more';
    if (a.k === 'reveal') { const t = s.rows[p][a.i]; return s.phase === 'reveal' && !!t && !t.open; }
    return false;
  },
  endTurn(s, p) { s.turn = nextActive(s, p); s.drawn = null; s.phase = s.pile.length ? 'draw' : 'guess'; },
  // q의 타일이 다 열렸으면 판에서 나간다. 한 사람만 남으면 끝
  checkOut(s, q) {
    if (Code.hidden(s.rows[q]) === 0 && !s.out[q]) s.out[q] = true;
    const left = activeOf(s);
    if (left.length <= 1) { s.over = { winners: left, why: 'all' }; return true; }
    return false;
  },
  apply(s, p, a) {
    const ev = { k: a.k, p };
    if (a.k === 'draw') {
      s.drawn = s.pile.pop();
      s.phase = 'guess';
      ev.drawn = s.drawn;
    } else if (a.k === 'guess') {
      const row = s.rows[a.t], t = row[a.i];
      ev.t = a.t; ev.i = a.i; ev.n = a.n; ev.tk = t.k;
      if (codeNum(t.k) === a.n) {
        t.open = true;
        ev.ok = true;
        ev.out = Code.hidden(row) === 0;
        if (!Code.checkOut(s, a.t)) s.phase = 'more';
      } else {
        ev.ok = false;
        if (!t.no.includes(a.n)) t.no.push(a.n);
        if (s.drawn != null) {
          ev.placed = insertTile(s.rows[p], { k: s.drawn, open: true, no: [] });
          ev.shown = s.drawn;
          ev.selfOut = Code.hidden(s.rows[p]) === 0;
          if (!Code.checkOut(s, p)) Code.endTurn(s, p);
        } else if (Code.hidden(s.rows[p])) s.phase = 'reveal';
        else if (!Code.checkOut(s, p)) Code.endTurn(s, p);
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
      ev.selfOut = Code.hidden(s.rows[p]) === 0;
      if (!Code.checkOut(s, p)) Code.endTurn(s, p);
    }
    s.last = ev;
    return ev;
  },
  // p가 아는 것으로 q 줄의 숨은 타일마다 될 수 있는 숫자와 그 가능성(0~1)
  // 줄은 왼쪽부터 커지므로, 칸마다 들어갈 수 있는 타일들 가운데 커지는 차례를 지키는 경우를 센다
  odds(s, p, q) {
    const row = s.rows[q];
    const known = new Set();
    for (const t of s.rows[p]) known.add(t.k);
    if (s.drawn != null && s.turn === p) known.add(s.drawn);
    for (const r of s.rows) for (const t of r) if (t.open) known.add(t.k);
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
// 컴퓨터(숲지기 솔 같은 컴퓨터 친구)가 숨은 타일을 짐작하는 법: 사람처럼 눈에 보이는 단서만 간단히 따진다.
// 위의 Code.odds처럼 될 수 있는 경우를 모두 세어 보지 않는다(그렇게 하면 다 아는 것처럼 잘 맞혀서 아이들이 이기기 어렵다).
// 모든 난이도: 타일 색, 자기 타일, 열린 타일, 그 타일에 이미 틀린 숫자는 뺀다.
// 쉬움: 바로 옆 타일이 열려 있을 때만 그보다 크거나 작은 수로 좁힌다. 아무 숨은 타일이나 고른다.
// 보통: 왼쪽·오른쪽으로 가장 가까운 열린 타일 사이의 수로 좁힌다. 아무 숨은 타일이나 고른다.
// 어려움: 보통에 더해, 사이에 숨은 타일 수만큼 칸을 비워 두고(줄은 커지는 차례라서), 열 번에 세 번쯤은 가장 좁혀진 타일을 고른다.
// 숫자는 좁혀진 수 가운데 아무거나 고른다(sharp를 0보다 크게 하면 자리에 맞는 수를 더 자주 고른다. 지금은 모두 0).
// 컴퓨터끼리 둔 결과는 README '보드게임 섬'의 '컴퓨터 친구가 두는 법'에 있다.
const CODE_K = CODE_MAX * 2 + 2;
// sharp: 자리(왼쪽 작고 오른쪽 큰)를 따지는 정도, focus: 가장 좁혀진 타일을 고르는 비율, more: 맞힌 뒤 더 맞히려면 필요한 자신감(남은 수가 n개면 1/n)
// near: 바로 옆 열린 타일만 본다, gaps: 사이에 숨은 타일 수만큼 칸을 비워 둔다
export const CODE_AI = {
  easy: { near: true, gaps: false, sharp: 0, focus: 0, more: 0.99 },
  normal: { near: false, gaps: false, sharp: 0, focus: 0, more: 0.5 },
  hard: { near: false, gaps: true, sharp: 0, focus: 0.3, more: 0.33 },
};
function codeHunch(s, p, q, level) {
  const row = s.rows[q], m = row.length;
  const known = new Set();
  for (const t of s.rows[p]) known.add(t.k);
  if (s.drawn != null && s.turn === p) known.add(s.drawn);
  for (const r of s.rows) for (const t of r) if (t.open) known.add(t.k);
  const c = CODE_AI[level] || CODE_AI.normal;
  return row.map((t, i) => {
    if (t.open) return null;
    let lo = -1, hi = CODE_K, li = -1, ri = m;
    for (let j = i - 1; j >= 0; j--) { if (row[j].open) { lo = row[j].k; li = j; break; } if (c.near) break; }
    for (let j = i + 1; j < m; j++) { if (row[j].open) { hi = row[j].k; ri = j; break; } if (c.near) break; }
    if (c.near) { li = Math.max(li, i - 1); ri = Math.min(ri, i + 1); }
    if (c.gaps) { lo += i - li - 1; hi -= ri - i - 1; } // 사이에 숨은 타일마다 한 칸씩
    const ks = [];
    for (let k = codeColor(t.k); k < CODE_K; k += 2) if (k > lo && k < hi && !known.has(k) && !t.no.includes(codeNum(k))) ks.push(k);
    if (!ks.length) return null;
    // 자리 짐작: 양쪽 단서 사이에서 이 칸이 놓인 만큼의 수 근처를 조금 더 자주 고른다
    const e = Math.max(lo, -1) + (Math.min(hi, CODE_K) - Math.max(lo, -1)) * (i - li) / (ri - li);
    const sharp = c.sharp;
    const w = ks.map((k) => 1 / (1 + sharp * Math.abs(k - e)));
    const sum = w.reduce((x, y) => x + y, 0);
    return { ks, w, conf: Math.max(...w) / sum };
  });
}
function pickWeighted(ks, w) {
  let r = Math.random() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < ks.length; i++) { r -= w[i]; if (r <= 0) return ks[i]; }
  return ks[ks.length - 1];
}
// 컴퓨터의 한 수 (지금 단계에 맞게)
export function aiCode(s, p, level = 'normal') {
  if (s.phase === 'draw') return { k: 'draw' };
  if (s.phase === 'reveal') {
    const idx = s.rows[p].map((t, i) => (t.open ? -1 : i)).filter((i) => i >= 0);
    return { k: 'reveal', i: level === 'easy' ? pick(idx) : idx[0] };
  }
  const all = [];
  for (const q of activeOf(s)) {
    if (q === p) continue;
    codeHunch(s, p, q, level).forEach((h, i) => { if (h) all.push({ t: q, i, ...h }); });
  }
  if (!all.length) {
    // 단서끼리 어긋나 짐작할 수 없으면 아무 숨은 타일에 아무 숫자나
    if (s.phase === 'more') return { k: 'stop' };
    for (const q of activeOf(s)) {
      if (q === p) continue;
      const i = s.rows[q].findIndex((t) => !t.open);
      if (i >= 0) return { k: 'guess', t: q, i, n: Math.floor(Math.random() * (CODE_MAX + 1)) };
    }
  }
  // 가장 자신 있는 타일 (같으면 아무거나)
  const top = Math.max(...all.map((x) => x.conf));
  const sure = all.filter((x) => x.conf >= top - 1e-9);
  if (s.phase === 'more') {
    // 맞힌 뒤 더 맞힐지: 쉬움은 확실할 때만, 보통은 반반이면, 어려움은 셋 중 하나쯤이어도 해 본다
    return { k: top >= (CODE_AI[level] || CODE_AI.normal).more ? 'again' : 'stop' };
  }
  const x = Math.random() < (CODE_AI[level] || CODE_AI.normal).focus ? pick(sure) : pick(all);
  return { k: 'guess', t: x.t, i: x.i, n: codeNum(pickWeighted(x.ks, x.w)) };
}

// =====================================================================
// 만칼라 (두 사람): 구멍 여섯 개씩, 돌 네 개씩. 내 구멍의 돌을 모두 집어 오른쪽(시계 반대 방향)으로 하나씩 놓는다
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
    return { rs: seed >>> 0, n: 2, b, turn: first % 2, over: null, last: null };
  },
  legal(s, p, a) { return !s.over && s.turn === p && !!a && Number.isInteger(a.i) && a.i >= 0 && a.i < 6 && s.b[pitIdx(p, a.i)] > 0; },
  // 돌을 놓아 가는 자리들 (화면에서 하나씩 보여 준다)
  sow(b, p, i) {
    const path = [];
    let at = pitIdx(p, i), n = b[at];
    b[at] = 0;
    const skip = storeOf(1 - p);
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
      s.over = { winners: best([0, 1], (q) => b[storeOf(q)]), why: 'empty' };
      ev.sweep = true;
    } else if (!ev.again) s.turn = 1 - p;
    s.last = ev;
    return ev;
  },
};
// 컴퓨터: 몇 수 앞까지 따져 본다 (쉬움 1수, 보통 4수, 어려움 6수)
export function aiMancala(s, p, level = 'normal') {
  const moves = [0, 1, 2, 3, 4, 5].filter((i) => s.b[pitIdx(p, i)] > 0);
  if (level === 'easy' && Math.random() < 0.45) return { i: pick(moves) };
  const depth = { easy: 1, normal: 4, hard: 6 }[level] || 4;
  const clone = (st) => ({ n: 2, b: st.b.slice(), turn: st.turn, over: st.over, last: null });
  const evalS = (st) => {
    if (st.over) return st.over.winners.length > 1 ? 0 : st.over.winners[0] === p ? 1000 : -1000;
    return st.b[storeOf(p)] - st.b[storeOf(1 - p)];
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
  let bestI = moves[0], bv = -Infinity;
  for (const i of moves) {
    const c = clone(s);
    Mancala.apply(c, p, { i });
    const v = search(c, c.turn === p ? depth : depth - 1, -Infinity, Infinity) + Math.random() * 0.3;
    if (v > bv) { bv = v; bestI = i; }
  }
  return { i: bestI };
}

// =====================================================================
// 윷놀이 (2~4명, 넷이면 2:2 편 놀이도): 윷가락 넷을 던져 도(1) 개(2) 걸(3) 윷(4) 모(5), 표시된 가락만 엎어지면 빽도(−1)
// 윷이나 모가 나오거나 다른 편 말을 잡으면 한 번 더 던진다. 우리 편 말이 모두 먼저 들어오면 이긴다
// 편 놀이는 1·3번째 사람이 한 편, 2·4번째 사람이 한 편이고, 같은 편은 말을 함께 쓴다 (차례는 두 편이 번갈아)
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
export const yutSide = (s, p) => (s.team ? p % 2 : p);
export const Yut = {
  init(seed, { n = 2, first = 0, pieces = 4, team = false } = {}) {
    n = clampN(n);
    const tm = !!team && n === 4;
    const sides = tm ? 2 : n;
    const np = pieces === 2 ? 2 : 4;
    return {
      rs: seed >>> 0, n, np, team: tm, sides,
      pos: Array.from({ length: sides }, () => new Array(np).fill(YUT.HOME)),
      hist: Array.from({ length: sides }, () => Array.from({ length: np }, () => [])),
      tray: [], throws: 1, turn: first % n, phase: 'throw', over: null, last: null, sticks: null,
    };
  },
  // 말 j(편 sd)가 값 v로 가는 곳과 지나는 길 (갈 수 없으면 null)
  dest(s, sd, j, v) {
    const at = s.pos[sd][j];
    if (at === YUT.DONE) return null;
    if (v === -1) {
      if (at === YUT.HOME) return null;
      const h = s.hist[sd][j];
      const to = h.length >= 2 ? h[h.length - 2] : at === 0 ? 19 : 0;
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
  // 같은 자리에 업힌 같은 편 말들
  group(s, sd, j) {
    const at = s.pos[sd][j];
    if (at === YUT.HOME || at === YUT.DONE) return [j];
    return s.pos[sd].map((q, k) => (q === at ? k : -1)).filter((k) => k >= 0);
  },
  options(s, p) {
    const out = [];
    if (s.over || s.turn !== p || s.phase !== 'move') return out;
    const sd = yutSide(s, p);
    const seenV = new Set();
    s.tray.forEach((v, t) => {
      if (seenV.has(v)) return;
      seenV.add(v);
      const seenAt = new Set();
      s.pos[sd].forEach((at, j) => {
        if (at === YUT.DONE) return;
        const key = at === YUT.HOME ? 'h' : String(at);
        if (seenAt.has(key)) return; // 집에 있는 말이나 업힌 말은 하나만
        const d = Yut.dest(s, sd, j, v);
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
    if (a.k === 'move') return s.phase === 'move' && Number.isInteger(a.t) && Number.isInteger(a.j) && s.tray[a.t] != null && a.j >= 0 && a.j < s.np && !!Yut.dest(s, yutSide(s, p), a.j, s.tray[a.t]);
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
    s.turn = (p + 1) % s.n;
    s.throws = 1;
    s.phase = 'throw';
  },
  apply(s, p, a) {
    s.dropped = null;
    const ev = { k: a.k, p };
    const sd = yutSide(s, p);
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
      const d = Yut.dest(s, sd, a.j, v);
      const grp = Yut.group(s, sd, a.j);
      const lead = s.hist[sd][a.j].slice();
      s.tray.splice(a.t, 1);
      ev.v = v; ev.j = a.j; ev.sd = sd; ev.grp = grp; ev.from = s.pos[sd][a.j]; ev.to = d.to; ev.path = d.path;
      if (d.to === YUT.DONE) {
        for (const k of grp) { s.pos[sd][k] = YUT.DONE; s.hist[sd][k] = []; }
      } else {
        const hh = v === -1 ? (lead.length >= 2 ? lead.slice(0, -1) : [d.to]) : [...lead, ...d.path];
        for (const k of grp) { s.pos[sd][k] = d.to; s.hist[sd][k] = hh.slice(); }
        const cap = [];
        for (let o = 0; o < s.sides; o++) {
          if (o === sd) continue;
          s.pos[o].forEach((q, k) => { if (q === d.to) { s.pos[o][k] = YUT.HOME; s.hist[o][k] = []; cap.push([o, k]); } });
        }
        if (cap.length) { ev.cap = cap; s.throws++; }
        ev.stack = s.pos[sd].filter((q) => q === d.to).length > grp.length;
      }
      if (s.pos[sd].every((q) => q === YUT.DONE)) {
        s.over = { winners: Array.from({ length: s.n }, (_, i) => i).filter((i) => yutSide(s, i) === sd), why: 'home', side: sd };
      }
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
  const sd = yutSide(s, p);
  // 다른 편 말이 1~5칸 뒤에 있으면 잡힐 수 있다
  const reachable = (node) => {
    for (let o = 0; o < s.sides; o++) {
      if (o === sd) continue;
      for (let j = 0; j < s.np; j++) {
        if (s.pos[o][j] === YUT.DONE) continue;
        for (let v = 1; v <= 5; v++) { const d = Yut.dest(s, o, j, v); if (d && d.to === node) return true; }
      }
    }
    return false;
  };
  const scored = opts.map((op) => {
    const grp = Yut.group(s, sd, op.j);
    const from = s.pos[sd][op.j];
    let sc = (YUT_LEFT[from] - YUT_LEFT[op.to]) * 2 * grp.length;
    if (op.to === YUT.DONE) sc += 30 * grp.length;
    else {
      let caps = 0;
      for (let o = 0; o < s.sides; o++) if (o !== sd) caps += s.pos[o].filter((q) => q === op.to).length;
      sc += caps * 55;
      if (s.pos[sd].some((q, k) => q === op.to && !grp.includes(k))) sc += 8;
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
// 땅따먹기 (점 잇기, 2~4명): 점과 점 사이에 선을 하나씩 긋는다. 네모의 네 번째 선을 그으면 그 땅을 갖고 한 번 더
// 네모는 두 명이면 4×4, 세 명 이상이면 5×5. 선 번호: 가로선 (줄 r 0~N, 칸 c 0~N-1), 그다음 세로선 (줄 r 0~N-1, 칸 c 0~N)
// =====================================================================
export const dotsSize = (n) => (n >= 3 ? 5 : 4);
export const hLine = (N, r, c) => r * N + c;
export const vLine = (N, r, c) => (N + 1) * N + r * (N + 1) + c;
export const dotsLines = (N) => 2 * N * (N + 1);
export const boxSides = (N, r, c) => [hLine(N, r, c), hLine(N, r + 1, c), vLine(N, r, c), vLine(N, r, c + 1)];
// 선 하나에 붙은 네모들
export function lineBoxes(N, l) {
  const out = [];
  const H = (N + 1) * N;
  if (l < H) {
    const r = Math.floor(l / N), c = l % N;
    if (r > 0) out.push([r - 1, c]);
    if (r < N) out.push([r, c]);
  } else {
    const k = l - H, r = Math.floor(k / (N + 1)), c = k % (N + 1);
    if (c > 0) out.push([r, c - 1]);
    if (c < N) out.push([r, c]);
  }
  return out;
}
export const Dots = {
  init(seed, { n = 2, first = 0 } = {}) {
    n = clampN(n);
    const N = dotsSize(n);
    return { rs: seed >>> 0, n, size: N, lines: new Array(dotsLines(N)).fill(0), boxes: new Array(N * N).fill(0), turn: first % n, over: null, last: null };
  },
  legal(s, p, a) { return !s.over && s.turn === p && !!a && Number.isInteger(a.l) && a.l >= 0 && a.l < s.lines.length && !s.lines[a.l]; },
  sidesOf(s, r, c) { return boxSides(s.size, r, c).filter((l) => s.lines[l]).length; },
  apply(s, p, a) {
    const N = s.size;
    s.lines[a.l] = p + 1;
    const got = [];
    for (const [r, c] of lineBoxes(N, a.l)) {
      if (Dots.sidesOf(s, r, c) === 4 && !s.boxes[r * N + c]) { s.boxes[r * N + c] = p + 1; got.push(r * N + c); }
    }
    if (!got.length) s.turn = (p + 1) % s.n;
    if (s.boxes.every((b) => b)) {
      const all = Array.from({ length: s.n }, (_, i) => i);
      s.over = { winners: best(all, (q) => s.boxes.filter((b) => b === q + 1).length), why: 'full' };
    }
    const ev = { k: 'line', p, l: a.l, got };
    s.last = ev;
    return ev;
  },
};
export function aiDots(s, p, level = 'normal') {
  const N = s.size;
  const free = [];
  for (let l = 0; l < s.lines.length; l++) if (!s.lines[l]) free.push(l);
  const completes = (st, l) => lineBoxes(N, l).filter(([r, c]) => Dots.sidesOf(st, r, c) === 3).length;
  const gives = (st, l) => lineBoxes(N, l).some(([r, c]) => Dots.sidesOf(st, r, c) === 2);
  const take = free.filter((l) => completes(s, l) > 0);
  if (take.length && (level !== 'easy' || Math.random() < 0.75)) return { l: pick(take) };
  const safe = free.filter((l) => !gives(s, l) && !completes(s, l));
  if (safe.length) return { l: pick(safe) };
  if (level === 'easy') return { l: pick(free) };
  // 어쩔 수 없이 땅을 내줄 때: 다음 사람이 가장 적게 가져가는 선
  const giveaway = (l) => {
    const st = { size: N, lines: s.lines.slice(), boxes: s.boxes.slice() };
    st.lines[l] = 1;
    let n = 0, more = true;
    while (more) {
      more = false;
      for (let m = 0; m < st.lines.length; m++) {
        if (st.lines[m]) continue;
        if (lineBoxes(N, m).some(([r, c]) => Dots.sidesOf(st, r, c) === 3)) {
          st.lines[m] = 1;
          for (const [r, c] of lineBoxes(N, m)) if (Dots.sidesOf(st, r, c) === 4 && !st.boxes[r * N + c]) { st.boxes[r * N + c] = 1; n++; }
          more = true;
        }
      }
    }
    return n;
  };
  let bestL = free[0], bv = Infinity;
  for (const l of free) { const v = giveaway(l) + Math.random() * 0.1; if (v < bv) { bv = v; bestL = l; } }
  return { l: bestL };
}

// 차례를 돌아가며 두는 놀이 다섯 (과일 종 치기는 따로). max: 함께할 수 있는 사람 수
export const TURN_GAMES = {
  n77: { rules: N77, ai: ai77 },
  code: { rules: Code, ai: aiCode },
  mancala: { rules: Mancala, ai: aiMancala },
  yut: { rules: Yut, ai: aiYut },
  dots: { rules: Dots, ai: aiDots },
};
export const MAX_PLAYERS = { fruit: 4, n77: 4, code: 4, mancala: 2, yut: 4, dots: 4 };
