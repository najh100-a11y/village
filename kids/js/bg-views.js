// 진숲 어린이 마을 — 보드게임 섬 놀이 화면 (77 피하기, 숫자 암호, 만칼라, 윷놀이, 땅따먹기)
// 화면은 판(state)을 그대로 그리고, 수가 놓일 때마다 짧게 움직임을 보여 준다.
// env: { main, meP, act(a), canAct(), who(p, text), banner(big, small), acts(...버튼), say(text), level, name(p) }
import { h, josa } from './ui.js';
import { sfx } from './sound.js';
import * as R from './bg-rules.js';

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const btn = (label, onclick, cls = 'btn btn-go') => h('button', { class: cls, type: 'button', onclick }, label);
const hearts = (n) => '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, R.N77_LIVES - n));
export const COLORS = { me: '#E5484D', opp: '#4D7DDB' };

// =====================================================================
// 77 피하기
// =====================================================================
function cardEl(c, attrs = {}) {
  const kind = c === R.C77.MINUS ? 'minus' : c === R.C77.TWICE ? 'twice' : c === 0 ? 'zero' : 'num';
  return h('button', { type: 'button', class: `c77 ${kind}`, ...attrs }, h('b', {}, R.card77Label(c)), kind === 'num' ? h('i', {}, R.card77Label(c)) : null);
}
function n77View(env) {
  const { main, meP } = env;
  const opp = 1 - meP;
  let sel = -1, st = null;
  const oppHand = h('div', { class: 'n77-opp', 'aria-label': '친구 카드' });
  const total = h('b', { class: 'n77-num' }, '0');
  const warn = h('p', { class: 'n77-warn' });
  const last = h('div', { class: 'n77-last' });
  const need = h('p', { class: 'n77-need' });
  const preview = h('p', { class: 'n77-preview', 'aria-live': 'polite' });
  const hand = h('div', { class: 'n77-hand', 'aria-label': '내 카드' });
  const totalBox = h('div', { class: 'n77-total' }, h('span', {}, '합계'), total);
  main.replaceChildren(h('div', { class: 'n77' }, oppHand, h('div', { class: 'n77-mid' }, last, totalBox, h('div', { class: 'n77-side' }, warn, need)), preview, hand));
  const nextDanger = (t) => { const k = Math.floor(t / 11) + 1; const m = k * 11; return m < 77 ? m : 77; };
  function render(s) {
    st = s;
    total.textContent = String(s.total);
    const nd = nextDanger(s.total);
    warn.replaceChildren(h('span', {}, '조심'), h('b', {}, nd === 77 ? '77' : `${nd} · 77`));
    oppHand.replaceChildren(...s.hand[opp].map(() => h('span', { class: 'c77 back', 'aria-hidden': 'true' })));
    const lc = s.discard.length ? s.discard[s.discard.length - 1] : null;
    last.replaceChildren(lc == null ? h('span', { class: 'c77 empty' }, '') : cardEl(lc, { disabled: true, tabindex: '-1' }), h('small', {}, lc == null ? '아직 낸 카드가 없어요' : s.last && s.last.p === meP ? '내가 낸 카드' : `${josa(env.name(opp), '이', '가')} 낸 카드`));
    need.textContent = s.need > 1 && !s.over ? (s.turn === meP ? '두 장을 내야 해요!' : '친구가 두 장을 내야 해요!') : '';
    hand.replaceChildren(...s.hand[meP].map((c, i) => cardEl(c, { class: `c77 ${c === R.C77.MINUS ? 'minus' : c === R.C77.TWICE ? 'twice' : c === 0 ? 'zero' : 'num'}${i === sel ? ' sel' : ''}`, onclick: () => tap(i), 'aria-label': `${R.card77Label(c)} 카드` })));
    env.who(meP, hearts(s.lives[meP]));
    env.who(opp, hearts(s.lives[opp]));
    input();
  }
  function input() {
    const on = env.canAct();
    hand.classList.toggle('off', !on);
    if (!on) { sel = -1; preview.textContent = ''; env.acts(); return; }
    if (sel >= 0) {
      const c = st.hand[meP][sel];
      const t = c === R.C77.MINUS ? Math.max(0, st.total - 10) : c === R.C77.TWICE ? st.total : st.total + c;
      preview.textContent = c === R.C77.TWICE ? `'두 번!'을 내면 친구가 카드 두 장을 내야 해요` : c === R.C77.MINUS ? `${st.total} − 10 = ${t}` : `${st.total} + ${c} = ${t}`;
      env.acts(btn('이 카드 내기', () => play(sel)));
    } else { preview.textContent = ''; env.acts(); }
  }
  function tap(i) {
    if (!env.canAct()) return;
    if (sel === i) { play(i); return; }
    sel = i;
    sfx.tick();
    render(st);
  }
  function play(i) {
    if (!env.canAct()) return;
    sel = -1;
    env.act({ i });
  }
  return {
    reset(s) { sel = -1; render(s); },
    render,
    input: () => input(),
    play(ev, s) {
      render(s);
      sfx.card();
      const lc = last.querySelector('.c77');
      if (lc) lc.classList.add('pop');
      if (ev.bust) {
        total.textContent = String(ev.total);
        totalBox.classList.add('bust');
        sfx.bonk();
        const who = ev.p === meP ? '내가' : josa(env.name(ev.p), '이', '가');
        env.banner(`펑! ${ev.total}`, `${who} 생명 하나를 잃었어요`);
        setTimeout(() => { totalBox.classList.remove('bust'); total.textContent = String(s.total); }, 1250);
        return 1400;
      }
      totalBox.classList.add('pop');
      setTimeout(() => totalBox.classList.remove('pop'), 400);
      return 600;
    },
    status(s) {
      if (s.turn === meP) return s.need > 1 ? '두 장을 연달아 내야 해요! 카드를 골라요.' : '내 차례예요. 낼 카드를 골라요. 한 번 더 누르면 내요.';
      return `${josa(env.name(opp), '이', '가')} 카드를 고르고 있어요…`;
    },
    aiDelay: () => 900 + Math.random() * 600,
  };
}

// =====================================================================
// 숫자 암호
// =====================================================================
function codeView(env) {
  const { main, meP } = env;
  const opp = 1 - meP;
  let st = null, target = -1;
  const oppRow = h('div', { class: 'code-row opp', 'aria-label': '친구 타일' });
  const myRow = h('div', { class: 'code-row me', 'aria-label': '내 타일' });
  const pile = h('button', { class: 'code-pile', type: 'button', onclick: () => { if (env.canAct() && st.phase === 'draw') env.act({ k: 'draw' }); } });
  const drawn = h('div', { class: 'code-drawn' });
  const picker = h('div', { class: 'code-picker', hidden: true });
  main.replaceChildren(h('div', { class: 'code' }, oppRow, h('div', { class: 'code-mid' }, pile, drawn), picker, myRow));
  const tile = (t, { mine, i }) => {
    const col = R.codeColor(t.k) ? 'sun' : 'moon';
    const show = mine || t.open;
    const el = h('button', { type: 'button', class: `ctile ${col}${t.open ? ' open' : ''}${mine && !t.open ? ' secret' : ''}${!mine && i === target ? ' sel' : ''}`, 'aria-label': show ? `${col === 'sun' ? '해' : '밤'} ${R.codeNum(t.k)}${mine ? (t.open ? ', 친구도 알아요' : ', 친구는 몰라요') : ''}` : `${col === 'sun' ? '해' : '밤'} 숨은 타일` },
      h('b', {}, show ? String(R.codeNum(t.k)) : '?'));
    if (mine && t.open) el.append(h('small', { class: 'tag' }, '들킴'));
    if (!mine && !t.open && t.no.length) el.append(h('small', { class: 'nos' }, t.no.slice(-3).map((n) => `✕${n}`).join(' ')));
    el.addEventListener('click', () => (mine ? tapMine(i) : tapOpp(i)));
    return el;
  };
  function known(color) {
    const out = new Set();
    for (const t of st.rows[meP]) if (R.codeColor(t.k) === color) out.add(R.codeNum(t.k));
    for (const t of st.rows[opp]) if (t.open && R.codeColor(t.k) === color) out.add(R.codeNum(t.k));
    if (st.drawn != null && st.turn === meP && R.codeColor(st.drawn) === color) out.add(R.codeNum(st.drawn));
    return out;
  }
  function render(s) {
    st = s;
    if (target >= 0 && (!s.rows[opp][target] || s.rows[opp][target].open || s.phase !== 'guess' || s.turn !== meP)) target = -1;
    oppRow.replaceChildren(...s.rows[opp].map((t, i) => tile(t, { mine: false, i })));
    myRow.replaceChildren(...s.rows[meP].map((t, i) => tile(t, { mine: true, i })));
    pile.replaceChildren(h('span', { class: 'stack', 'aria-hidden': 'true' }), h('b', {}, `${s.pile.length}`), h('small', {}, s.pile.length ? '남은 타일' : '다 가져갔어요'));
    if (s.drawn != null) {
      const mine = s.turn === meP;
      const col = R.codeColor(s.drawn) ? 'sun' : 'moon';
      drawn.replaceChildren(h('small', {}, mine ? '가져온 타일' : '친구가 가져온 타일'), h('span', { class: `ctile ${col} big` }, h('b', {}, mine ? String(R.codeNum(s.drawn)) : '?')));
    } else drawn.replaceChildren();
    env.who(meP, `숨은 타일 ${R.Code.hidden(s.rows[meP])}`);
    env.who(opp, `숨은 타일 ${R.Code.hidden(s.rows[opp])}`);
    input();
  }
  function input() {
    const on = env.canAct();
    const ph = st.phase;
    pile.disabled = !(on && ph === 'draw');
    pile.classList.toggle('pulse', on && ph === 'draw');
    oppRow.classList.toggle('pickable', on && ph === 'guess');
    myRow.classList.toggle('pickable', on && ph === 'reveal');
    if (on && ph === 'guess' && target >= 0) {
      const t = st.rows[opp][target];
      const color = R.codeColor(t.k);
      const no = known(color);
      picker.hidden = false;
      picker.replaceChildren(h('p', {}, `${color ? '해' : '밤'} 타일의 숫자는?`), h('div', { class: 'nums' },
        Array.from({ length: R.CODE_MAX + 1 }, (_, n) => {
          const out = no.has(n) || t.no.includes(n);
          return h('button', { type: 'button', class: `num ${color ? 'sun' : 'moon'}${out ? ' out' : ''}`, onclick: () => guess(n), 'aria-label': `${n}${out ? ' (이미 나왔어요)' : ''}` }, String(n));
        })));
    } else { picker.hidden = true; picker.replaceChildren(); }
    if (on && ph === 'more') env.acts(btn('그만하고 숨기기', () => env.act({ k: 'stop' }), 'btn btn-soft'), btn('한 번 더 맞히기', () => env.act({ k: 'again' })));
    else env.acts();
  }
  function tapOpp(i) {
    if (!env.canAct() || st.phase !== 'guess') return;
    const t = st.rows[opp][i];
    if (!t || t.open) return;
    target = target === i ? -1 : i;
    sfx.tick();
    render(st);
  }
  function tapMine(i) {
    if (!env.canAct() || st.phase !== 'reveal') return;
    const t = st.rows[meP][i];
    if (!t || t.open) return;
    env.act({ k: 'reveal', i });
  }
  function guess(n) {
    if (!env.canAct() || target < 0) return;
    const i = target;
    target = -1;
    env.act({ k: 'guess', i, n });
  }
  const who = (p) => (p === meP ? '내가' : josa(env.name(p), '이', '가'));
  return {
    reset(s) { target = -1; render(s); },
    render,
    input: () => input(),
    play(ev, s) {
      render(s);
      if (ev.k === 'draw') { sfx.card(); const d = drawn.querySelector('.ctile'); if (d) d.classList.add('pop'); return 500; }
      if (ev.k === 'guess') {
        const row = ev.p === meP ? oppRow : myRow;
        const el = row.children[ev.i];
        if (ev.ok) {
          sfx.ding();
          if (el) el.classList.add('flip');
          env.banner(`맞혔어요! ${ev.n}`, ev.p === meP ? '친구 타일이 열렸어요' : `${who(ev.p)} 내 타일을 맞혔어요`);
        } else {
          sfx.fail();
          if (el) el.classList.add('shake');
          const placed = ev.placed != null ? (ev.p === meP ? myRow : oppRow).children[ev.placed] : null;
          if (placed) placed.classList.add('pop');
          env.banner(`${ev.n}${[2, 4, 5, 9].includes(ev.n) ? '가' : '이'} 아니에요`, ev.shown != null ? (ev.p === meP ? '가져온 타일이 들켰어요' : `${josa(env.name(ev.p), '이', '가')} 가져온 타일이 보여요`) : '');
        }
        return 1300;
      }
      if (ev.k === 'reveal') { sfx.card(); const el = (ev.p === meP ? myRow : oppRow).children[ev.i]; if (el) el.classList.add('flip'); return 800; }
      if (ev.k === 'stop' && ev.placed != null) { sfx.card(); const el = (ev.p === meP ? myRow : oppRow).children[ev.placed]; if (el) el.classList.add('pop'); return 650; }
      return 300;
    },
    status(s) {
      if (s.turn !== meP) {
        const n = josa(env.name(opp), '이', '가');
        return s.phase === 'draw' ? `${n} 타일을 가져가요…` : s.phase === 'more' ? `${n} 더 맞힐지 생각하고 있어요…` : `${n} 내 타일을 보고 생각하고 있어요…`;
      }
      if (s.phase === 'draw') return '내 차례예요. 가운데 타일 더미를 눌러 한 장 가져와요.';
      if (s.phase === 'guess') return target >= 0 ? '숫자를 골라요. 회색 숫자는 이미 보인 숫자예요.' : '친구의 숨은 타일 하나를 눌러 숫자를 맞혀 봐요.';
      if (s.phase === 'more') return '맞혔어요! 한 번 더 맞힐까요, 멈출까요?';
      return '가져올 타일이 없어요. 내 숨은 타일 하나를 눌러 보여 줘요.';
    },
    aiDelay: (s) => (s.phase === 'draw' ? 700 : s.phase === 'more' ? 900 : 1400) + Math.random() * 400,
  };
}

// =====================================================================
// 만칼라
// =====================================================================
const PIT = (p, i) => (p === 0 ? i : 7 + i);
const STORE = (p) => (p === 0 ? 6 : 13);
function stonesEl(n, seed) {
  const box = h('span', { class: 'stones', 'aria-hidden': 'true' });
  const cols = ['#EF6461', '#4D7DDB', '#F6D55C', '#6FD3C0', '#F6A2C4', '#A07FE3'];
  const k = Math.min(n, 14);
  for (let j = 0; j < k; j++) {
    const a = (j * 2.39996) + seed, r = 8 + Math.sqrt(j) * 9;
    const s = h('i');
    s.style.left = `calc(50% + ${(Math.cos(a) * r * (k > 8 ? 1 : 0.85)).toFixed(1)}%)`;
    s.style.top = `calc(50% + ${(Math.sin(a) * r * 0.8).toFixed(1)}%)`;
    s.style.background = cols[(j + seed) % cols.length];
    box.append(s);
  }
  return box;
}
function mancalaView(env) {
  const { main, meP } = env;
  const opp = 1 - meP;
  let shown = null, st = null, busy = false;
  const cells = {};
  const make = (idx, cls) => {
    const el = h('button', { type: 'button', class: cls, 'data-i': idx });
    el.addEventListener('click', () => {
      if (!env.canAct() || busy) return;
      const i = meP === 0 ? idx : idx - 7;
      if (idx === STORE(0) || idx === STORE(1) || i < 0 || i > 5 || st.b[idx] === 0) return;
      env.act({ i });
    });
    cells[idx] = el;
    return el;
  };
  const top = h('div', { class: 'man-row top' }, [5, 4, 3, 2, 1, 0].map((i) => make(PIT(opp, i), 'pit opp')));
  const bot = h('div', { class: 'man-row bot' }, [0, 1, 2, 3, 4, 5].map((i) => make(PIT(meP, i), 'pit mine')));
  const board = h('div', { class: 'man-board' }, make(STORE(opp), 'store opp'), top, bot, make(STORE(meP), 'store mine'));
  main.replaceChildren(h('div', { class: 'man' }, h('p', { class: 'man-dir', 'aria-hidden': 'true' }, '돌은 시계 반대 방향으로 돌아요 ↺'), board));
  function draw(b, hi = -1) {
    for (const [idx, el] of Object.entries(cells)) {
      const n = b[idx];
      el.replaceChildren(stonesEl(n, Number(idx)), h('b', {}, String(n)));
      el.classList.toggle('hi', Number(idx) === hi);
      el.classList.toggle('empty', n === 0);
      el.setAttribute('aria-label', `${Number(idx) === STORE(meP) ? '내 창고' : Number(idx) === STORE(opp) ? '친구 창고' : el.classList.contains('mine') ? '내 구멍' : '친구 구멍'} 돌 ${n}개`);
    }
  }
  function render(s) {
    st = s;
    shown = s.b.slice();
    draw(shown);
    env.who(meP, `창고 ${s.b[STORE(meP)]}개`);
    env.who(opp, `창고 ${s.b[STORE(opp)]}개`);
    input();
  }
  function input() {
    const on = env.canAct() && !busy;
    for (let i = 0; i < 6; i++) { const el = cells[PIT(meP, i)]; el.disabled = !on || st.b[PIT(meP, i)] === 0; el.classList.toggle('can', on && st.b[PIT(meP, i)] > 0); }
    for (let i = 0; i < 6; i++) cells[PIT(opp, i)].disabled = true;
    cells[STORE(0)].disabled = cells[STORE(1)].disabled = true;
    env.acts();
  }
  return {
    reset(s) { busy = false; render(s); },
    render,
    input: () => input(),
    play(ev, s) {
      // 놓기 전 판에서 한 알씩
      busy = true;
      const b = shown ? shown.slice() : s.b.slice();
      b[ev.from] = 0;
      draw(b, ev.from);
      const STEP = 170;
      ev.path.forEach((idx, k) => setTimeout(() => { b[idx]++; draw(b, idx); sfx.stone(); }, 160 + k * STEP));
      let t = 160 + ev.path.length * STEP;
      if (ev.cap) {
        setTimeout(() => { env.banner(`잡았다! ${ev.cap}개`, ev.p === meP ? '내 창고로 가져왔어요' : `${josa(env.name(ev.p), '이', '가')} 가져갔어요`); sfx.ding(); }, t + 100);
        t += 700;
      } else if (ev.again && !s.over) {
        setTimeout(() => { env.banner('한 번 더!', ev.p === meP ? '창고에 쏙 들어갔어요' : `${josa(env.name(ev.p), '이', '가')} 한 번 더 해요`, 1400); sfx.ding(); }, t + 80);
        t += 500;
      }
      setTimeout(() => { busy = false; }, t);
      return t + 120;
    },
    status(s) {
      if (s.turn === meP) return '내 차례예요. 아래쪽 내 구멍 하나를 눌러요.';
      return `${josa(env.name(opp), '이', '가')} 구멍을 고르고 있어요…`;
    },
    aiDelay: () => 900 + Math.random() * 500,
  };
}

// =====================================================================
// 윷놀이
// =====================================================================
function yutView(env) {
  const { main, meP } = env;
  const opp = 1 - meP;
  let st = null, selT = -1, selJ = -1, anim = null;
  const boardBox = h('div', { class: 'yut-board' });
  const lines = svg('svg', { viewBox: '0 0 100 100', class: 'yut-lines', 'aria-hidden': 'true' });
  const P = (n) => R.YUT_XY[n].map((v) => v * 100);
  for (const [a, b] of R.YUT_LINES) { const [x1, y1] = P(a), [x2, y2] = P(b); lines.append(svg('line', { x1, y1, x2, y2 })); }
  for (let n = 0; n <= 28; n++) {
    const [x, y] = P(n);
    const big = [0, 5, 10, 15, 22].includes(n);
    lines.append(svg('circle', { cx: x, cy: y, r: big ? 4.6 : 3.1, class: big ? 'big' : '' }));
  }
  const layer = h('div', { class: 'yut-tokens' });
  boardBox.append(lines, layer, h('span', { class: 'yut-start', 'aria-hidden': 'true' }, '↑ 출발·도착'));
  const homeOpp = h('div', { class: 'yut-home opp' });
  const homeMe = h('div', { class: 'yut-home me' });
  const sticks = h('div', { class: 'yut-sticks', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((k) => h('i', { class: k === 0 ? 'mark' : '' })));
  const result = h('b', { class: 'yut-result', 'aria-live': 'polite' });
  const tray = h('div', { class: 'yut-tray' });
  main.replaceChildren(h('div', { class: 'yut' }, homeOpp, boardBox, h('div', { class: 'yut-throw' }, sticks, result, tray), homeMe));
  const pct = (n) => { const [x, y] = R.YUT_XY[n]; return { left: `${x * 100}%`, top: `${y * 100}%` }; };
  function tokens(s, override) {
    layer.replaceChildren();
    const opts = env.canAct() && s.phase === 'move' ? R.Yut.options(s, meP) : [];
    for (const p of [0, 1]) {
      const at = new Map();
      s.pos[p].forEach((q, j) => {
        let node = q;
        if (override && override.p === p && override.grp.includes(j)) node = override.node;
        if (node === R.YUT.HOME || node === R.YUT.DONE) return;
        if (!at.has(node)) at.set(node, []);
        at.get(node).push(j);
      });
      for (const [node, js] of at) {
        const mine = p === meP;
        const can = mine && opts.some((o) => o.j === js[0] && (selT < 0 || o.t === selT));
        const el = h('button', { type: 'button', class: `ytok ${mine ? 'me' : 'opp'}${can ? ' can' : ''}${mine && js.includes(selJ) ? ' sel' : ''}`, 'aria-label': `${mine ? '내' : '친구'} 말${js.length > 1 ? ` ${js.length}개 업힘` : ''}` },
          js.length > 1 ? h('b', {}, `×${js.length}`) : null);
        Object.assign(el.style, pct(node));
        el.addEventListener('click', () => (mine ? pickPiece(js[0]) : null));
        layer.append(el);
      }
    }
    // 고른 말이 갈 곳
    if (selJ >= 0 && selT >= 0) {
      const d = R.Yut.dest(s, meP, selJ, s.tray[selT]);
      if (d) {
        const node = d.to === R.YUT.DONE ? 0 : d.to;
        const el = h('button', { type: 'button', class: 'ydest', 'aria-label': d.to === R.YUT.DONE ? '들어가기' : '여기로 가기' }, h('span', {}, d.to === R.YUT.DONE ? '들어가기!' : '여기로!'));
        Object.assign(el.style, pct(node));
        el.addEventListener('click', go);
        layer.append(el);
      }
    }
  }
  function homes(s) {
    const draw = (box, p) => {
      const home = s.pos[p].map((q, j) => (q === R.YUT.HOME ? j : -1)).filter((j) => j >= 0);
      const done = s.pos[p].filter((q) => q === R.YUT.DONE).length;
      const mine = p === meP;
      const opts = mine && env.canAct() && s.phase === 'move' ? R.Yut.options(s, meP) : [];
      const can = home.length && opts.some((o) => o.j === home[0] && (selT < 0 || o.t === selT));
      const homeBtn = h('button', { type: 'button', class: `yut-wait${can ? ' can' : ''}${mine && home.includes(selJ) ? ' sel' : ''}`, disabled: !mine || !home.length, onclick: () => (home.length ? pickPiece(home[0]) : null) },
        h('span', { class: 'lbl' }, mine ? '내 말' : '친구 말'),
        h('span', { class: 'toks' }, home.map(() => h('i', { class: mine ? 'me' : 'opp' }))),
        h('small', {}, home.length ? (mine && can ? '눌러서 새 말 놓기' : `기다리는 말 ${home.length}`) : '모두 나갔어요'));
      box.replaceChildren(homeBtn, h('span', { class: 'yut-done' }, `들어온 말 ${done}/${s.np}`));
    };
    draw(homeOpp, opp);
    draw(homeMe, meP);
    env.who(meP, `들어온 말 ${s.pos[meP].filter((q) => q === R.YUT.DONE).length}/${s.np}`);
    env.who(opp, `들어온 말 ${s.pos[opp].filter((q) => q === R.YUT.DONE).length}/${s.np}`);
  }
  function chooseDefault(s) {
    if (!(env.canAct() && s.phase === 'move')) { selT = -1; selJ = -1; return; }
    const opts = R.Yut.options(s, meP);
    if (selT < 0 || s.tray[selT] == null || !opts.some((o) => o.t === selT)) selT = opts.length ? opts[0].t : -1;
    if (selJ >= 0 && !opts.some((o) => o.t === selT && o.j === selJ)) selJ = -1;
  }
  function render(s) {
    st = s;
    chooseDefault(s);
    tokens(s, anim);
    homes(s);
    tray.replaceChildren(...s.tray.map((v, t) => h('button', { type: 'button', class: `ychip${t === selT ? ' sel' : ''}${v === -1 ? ' back' : ''}`, onclick: () => pickT(t), disabled: !(env.canAct() && s.phase === 'move') }, R.YUT_NAMES[v])));
    if (s.sticks) [...sticks.children].forEach((el, k) => el.classList.toggle('flat', !!s.sticks[k]));
    input();
  }
  function input() {
    const on = env.canAct();
    if (on && st.phase === 'throw') env.acts(btn('윷 던지기!', () => env.act({ k: 'throw' }), 'btn btn-go big'));
    else if (on && st.phase === 'move' && selJ >= 0) env.acts(btn('이 말 옮기기', go));
    else env.acts();
  }
  function pickT(t) { if (!env.canAct()) return; selT = t; selJ = -1; sfx.tick(); render(st); }
  function pickPiece(j) {
    if (!env.canAct() || st.phase !== 'move') return;
    const opts = R.Yut.options(st, meP);
    const grp = R.Yut.group(st, meP, j);
    let o = opts.find((x) => x.t === selT && grp.includes(x.j));
    if (!o) o = opts.find((x) => grp.includes(x.j));
    if (!o) return;
    if (selJ >= 0 && grp.includes(selJ) && o.t === selT) { go(); return; }
    selT = o.t; selJ = o.j;
    sfx.tick();
    render(st);
  }
  function go() {
    if (!env.canAct() || selT < 0 || selJ < 0) return;
    const a = { k: 'move', t: selT, j: selJ };
    selJ = -1;
    env.act(a);
  }
  const name = (p) => (p === meP ? '내' : `${env.name(p)}의`);
  return {
    reset(s) { selT = -1; selJ = -1; anim = null; result.textContent = ''; render(s); },
    render,
    input: () => input(),
    play(ev, s) {
      if (ev.k === 'throw') {
        sticks.classList.add('toss');
        sfx.clack();
        result.textContent = '';
        setTimeout(() => {
          sticks.classList.remove('toss');
          render(s);
          result.textContent = `${R.YUT_NAMES[ev.v]}!`;
          result.classList.remove('pop'); void result.offsetWidth; result.classList.add('pop');
          if (ev.again) env.banner(`${R.YUT_NAMES[ev.v]}!`, '한 번 더 던져요', 1300);
          if (ev.dropped) env.say(ev.p === meP ? '움직일 수 있는 말이 없어서 차례가 넘어가요.' : `${josa(env.name(ev.p), '은', '는')} 움직일 말이 없어서 차례가 넘어가요.`);
        }, 650);
        return ev.dropped ? 2000 : ev.again ? 1500 : 1000;
      }
      // 말이 한 칸씩 간다
      const STEP = 210;
      const path = ev.path;
      path.forEach((node, k) => setTimeout(() => {
        anim = { p: ev.p, grp: ev.grp, node: node === R.YUT.DONE ? 0 : node };
        tokens(st, anim);
        sfx.tap();
      }, k * STEP));
      let t = path.length * STEP;
      setTimeout(() => {
        anim = null;
        render(s);
        if (ev.cap) { sfx.bonk(); env.banner('잡았다!', ev.p === meP ? '친구 말을 출발점으로 보냈어요. 한 번 더!' : `${josa(env.name(ev.p), '이', '가')} 내 말을 잡았어요`); }
        else if (ev.to === R.YUT.DONE) { sfx.ding(); env.banner('말이 들어왔어요!', `${name(ev.p)} 말 ${ev.grp.length}개`); }
        else if (ev.stack) sfx.pop();
        if (ev.dropped) env.say(ev.p === meP ? '남은 수로 움직일 수 있는 말이 없어요.' : '');
      }, t);
      t += ev.cap || ev.to === R.YUT.DONE ? 1100 : 300;
      return t;
    },
    status(s) {
      if (s.turn !== meP) return s.phase === 'throw' ? `${josa(env.name(opp), '이', '가')} 윷을 던져요…` : `${josa(env.name(opp), '이', '가')} 말을 고르고 있어요…`;
      if (s.phase === 'throw') return s.tray.length ? '한 번 더 던져요!' : '내 차례예요. 윷을 던져요!';
      return selJ >= 0 ? '반짝이는 곳을 누르면 말이 가요.' : s.tray.length > 1 ? '쓸 수를 고르고, 옮길 말을 눌러요.' : '옮길 말을 눌러요. 새 말은 아래 ‘내 말’을 눌러요.';
    },
    aiDelay: (s) => (s.phase === 'throw' ? 700 : 1000) + Math.random() * 400,
  };
}

// =====================================================================
// 땅따먹기 (점 잇기)
// =====================================================================
function dotsView(env) {
  const { main, meP } = env;
  const opp = 1 - meP;
  const N = R.DOTS_N;
  let st = null, sel = -1;
  const G = (k) => 10 + k * (80 / N);
  const root = svg('svg', { viewBox: '0 0 100 100', class: 'dots-svg', role: 'group', 'aria-label': '점 잇기 판' });
  const boxesG = svg('g'), linesG = svg('g'), dotsG = svg('g'), hitsG = svg('g');
  root.append(boxesG, linesG, dotsG, hitsG);
  for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) dotsG.append(svg('circle', { cx: G(c), cy: G(r), r: 1.9, class: 'dot' }));
  const lineXY = (l) => {
    const H = (N + 1) * N;
    if (l < H) { const r = Math.floor(l / N), c = l % N; return [G(c), G(r), G(c + 1), G(r)]; }
    const k = l - H, r = Math.floor(k / (N + 1)), c = k % (N + 1);
    return [G(c), G(r), G(c), G(r + 1)];
  };
  const lineEls = [], hitEls = [];
  for (let l = 0; l < R.DOTS_LINES; l++) {
    const [x1, y1, x2, y2] = lineXY(l);
    const ln = svg('line', { x1, y1, x2, y2, class: 'ln' });
    lineEls.push(ln);
    linesG.append(ln);
    const horiz = y1 === y2;
    const hit = svg('rect', { x: horiz ? x1 + 2.5 : x1 - 5, y: horiz ? y1 - 5 : y1 + 2.5, width: horiz ? x2 - x1 - 5 : 10, height: horiz ? 10 : y2 - y1 - 5, class: 'hit', rx: 2 });
    hit.addEventListener('click', () => tap(l));
    hitEls.push(hit);
    hitsG.append(hit);
  }
  const boxEls = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const g = svg('g', { class: 'bx' });
    g.append(svg('rect', { x: G(c) + 1.6, y: G(r) + 1.6, width: 80 / N - 3.2, height: 80 / N - 3.2, rx: 2.5 }), svg('text', { x: G(c) + 40 / N, y: G(r) + 40 / N + 2.6 }, ''));
    boxEls.push(g);
    boxesG.append(g);
  }
  main.replaceChildren(h('div', { class: 'dots' }, root));
  function render(s, flash = -1) {
    st = s;
    if (sel >= 0 && s.lines[sel]) sel = -1;
    s.lines.forEach((o, l) => {
      const el = lineEls[l];
      el.setAttribute('class', `ln${o ? (o - 1 === meP ? ' me' : ' opp') : ''}${l === sel ? ' pre' : ''}${l === flash ? ' new' : ''}`);
    });
    s.boxes.forEach((o, b) => {
      const g = boxEls[b];
      g.setAttribute('class', `bx${o ? (o - 1 === meP ? ' me' : ' opp') : ''}`);
      g.querySelector('text').textContent = o ? (o - 1 === meP ? '나' : String(env.name(o - 1)).split(' ').pop().slice(0, 1)) : '';
    });
    const cnt = (p) => s.boxes.filter((o) => o === p + 1).length;
    env.who(meP, `땅 ${cnt(meP)}칸`);
    env.who(opp, `땅 ${cnt(opp)}칸`);
    input();
  }
  function input() {
    const on = env.canAct();
    root.classList.toggle('on', on);
    if (on && sel >= 0) env.acts(btn('여기에 긋기', () => draw(sel)));
    else env.acts();
  }
  function tap(l) {
    if (!env.canAct() || st.lines[l]) return;
    if (sel === l) { draw(l); return; }
    sel = l;
    sfx.tick();
    render(st);
  }
  function draw(l) {
    if (!env.canAct() || st.lines[l]) return;
    sel = -1;
    env.act({ l });
  }
  return {
    reset(s) { sel = -1; render(s); },
    render: (s) => render(s),
    input: () => input(),
    play(ev, s) {
      render(s, ev.l);
      sfx.tap();
      if (ev.got.length) {
        sfx.ding();
        for (const b of ev.got) boxEls[b].classList.add('pop');
        if (!s.over) env.say(ev.p === meP ? `땅 ${ev.got.length}칸을 차지했어요! 한 번 더 그어요.` : `${josa(env.name(ev.p), '이', '가')} 땅을 차지해서 한 번 더 그어요.`);
        return 900;
      }
      return 350;
    },
    status(s) {
      if (s.turn === meP) return s.last && s.last.p === meP && s.last.got.length ? '땅을 차지했어요! 한 번 더 그어요.' : sel >= 0 ? '한 번 더 누르거나 ‘여기에 긋기’를 눌러요.' : '내 차례예요. 두 점 사이를 눌러 선을 그어요.';
      return `${josa(env.name(opp), '이', '가')} 선을 고르고 있어요…`;
    },
    aiDelay: () => 650 + Math.random() * 500,
  };
}

export const VIEWS = { n77: n77View, code: codeView, mancala: mancalaView, yut: yutView, dots: dotsView };
