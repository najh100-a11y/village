// 진숲 어린이 마을 — 보드게임 섬 놀이 화면 (77 피하기, 숫자 암호, 만칼라, 윷놀이, 땅따먹기)
// 화면은 판(state)을 그대로 그리고, 수가 놓일 때마다 짧게 움직임을 보여 준다. 2~4명 (만칼라는 2명)
// env: { main, meP, n, others(), act(a), canAct(), who(p, text), banner(big, small), acts(...버튼), say(text), level,
//        name(p), color(p), sideColor(sd) }
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
const subj = (env, p) => (p === env.meP ? '내가' : josa(env.name(p), '이', '가'));
const topic = (env, p) => (p === env.meP ? '나는' : josa(env.name(p), '은', '는'));
// 이름표 (색 점과 이름)
const tag = (env, p, extra = '') => h('span', { class: `who-tag${extra}` }, h('i', { style: `background:${env.color(p)}` }), p === env.meP ? '나' : env.name(p));

// =====================================================================
// 77 피하기
// =====================================================================
const KIND77 = (c) => (c === R.C77.MINUS ? 'minus' : c === R.C77.TWICE ? 'twice' : c === 0 ? 'zero' : 'num');
function cardEl(c, attrs = {}) {
  const kind = KIND77(c);
  return h('button', { type: 'button', ...attrs, class: `c77 ${kind}${attrs.class ? ' ' + attrs.class : ''}` }, h('b', {}, R.card77Label(c)), kind === 'num' ? h('i', {}, R.card77Label(c)) : null);
}
function n77View(env) {
  const { main, meP } = env;
  let sel = -1, st = null;
  const opps = h('div', { class: 'n77-opps', 'aria-label': '다른 사람 카드' });
  const total = h('b', { class: 'n77-num' }, '0');
  const warn = h('p', { class: 'n77-warn' });
  const last = h('div', { class: 'n77-last' });
  const need = h('p', { class: 'n77-need' });
  const hand = h('div', { class: 'n77-hand', 'aria-label': '내 카드' });
  const totalBox = h('div', { class: 'n77-total' }, h('span', {}, '합계'), total);
  main.replaceChildren(h('div', { class: 'n77' }, opps, h('div', { class: 'n77-mid' }, last, totalBox, h('div', { class: 'n77-side' }, warn, need)), hand));
  const nextDanger = (t) => { const m = (Math.floor(t / 11) + 1) * 11; return m < 77 ? m : 77; };
  function render(s) {
    st = s;
    total.textContent = String(s.total);
    const nd = nextDanger(s.total);
    warn.replaceChildren(h('span', {}, '조심'), h('b', {}, nd === 77 ? '77' : `${nd} · 77`));
    opps.replaceChildren(...env.others().map((p) => h('div', { class: `n77-o${s.out[p] ? ' out' : ''}${s.turn === p && !s.over ? ' turn' : ''}` },
      h('span', { class: 'backs', 'aria-hidden': 'true' }, s.out[p] ? null : s.hand[p].map(() => h('i', { class: 'c77 back' }))),
      tag(env, p), s.out[p] ? h('small', {}, '나감') : null)));
    const lc = s.discard.length ? s.discard[s.discard.length - 1] : null;
    last.replaceChildren(lc == null ? h('span', { class: 'c77 empty' }, '') : cardEl(lc, { disabled: true, tabindex: '-1' }),
      h('small', {}, lc == null ? '아직 낸 카드가 없어요' : s.last ? `${subj(env, s.last.p)} 낸 카드` : ''));
    need.textContent = s.need > 1 && !s.over ? (s.turn === meP ? '두 장을 내야 해요!' : `${subj(env, s.turn)} 두 장을 내야 해요!`) : '';
    hand.replaceChildren(...(s.out[meP] ? [h('p', { class: 'n77-outme' }, '생명을 다 썼어요. 친구들이 하는 걸 지켜봐요!')] : s.hand[meP].map((c, i) => cardEl(c, { class: i === sel ? 'sel' : '', onclick: () => tap(i), 'aria-label': `${R.card77Label(c)} 카드` }))));
    for (let p = 0; p < s.n; p++) env.who(p, s.out[p] ? '나감' : hearts(s.lives[p]));
    input();
  }
  function input() {
    const on = env.canAct();
    hand.classList.toggle('off', !on);
    if (!on) { sel = -1; env.acts(); return; }
    // 고른 카드를 내기 전에 합계를 미리 보여 주지 않는다 (셈은 아이가 한다)
    env.acts(sel >= 0 ? btn('이 카드 내기', () => play(sel)) : null);
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
        env.banner(`펑! ${ev.total}`, ev.out ? `${subj(env, ev.p)} 생명을 다 써서 나갔어요` : `${subj(env, ev.p)} 생명 하나를 잃었어요`);
        setTimeout(() => { totalBox.classList.remove('bust'); total.textContent = String(s.total); }, 1250);
        return 1400;
      }
      totalBox.classList.add('pop');
      setTimeout(() => totalBox.classList.remove('pop'), 400);
      return 600;
    },
    status(s) {
      if (s.turn === meP) return s.need > 1 ? '두 장을 연달아 내야 해요! 카드를 골라요.' : '내 차례예요. 낼 카드를 골라요. 한 번 더 누르면 내요.';
      return `${subj(env, s.turn)} 카드를 고르고 있어요…`;
    },
    aiDelay: () => 900 + Math.random() * 600,
  };
}

// =====================================================================
// 숫자 암호
// =====================================================================
function codeView(env) {
  const { main, meP } = env;
  let st = null, target = null; // { t, i }
  const oppBox = h('div', { class: 'code-opps' });
  const myRow = h('div', { class: 'code-row me', 'aria-label': '내 타일' });
  const pile = h('button', { class: 'code-pile', type: 'button', onclick: () => { if (env.canAct() && st.phase === 'draw') env.act({ k: 'draw' }); } });
  const drawn = h('div', { class: 'code-drawn' });
  const picker = h('div', { class: 'code-picker', hidden: true });
  main.replaceChildren(h('div', { class: 'code' }, oppBox, h('div', { class: 'code-mid' }, pile, drawn), picker, myRow));
  const rowEls = {};
  const tile = (t, { owner, i }) => {
    const mine = owner === meP;
    const col = R.codeColor(t.k) ? 'sun' : 'moon';
    const show = mine || t.open;
    const isSel = !mine && target && target.t === owner && target.i === i;
    const el = h('button', { type: 'button', class: `ctile ${col}${t.open ? ' open' : ''}${mine && !t.open ? ' secret' : ''}${isSel ? ' sel' : ''}`,
      'aria-label': show ? `${col === 'sun' ? '해' : '밤'} ${R.codeNum(t.k)}${mine ? (t.open ? ', 친구도 알아요' : ', 친구는 몰라요') : ''}` : `${col === 'sun' ? '해' : '밤'} 숨은 타일` },
    h('b', {}, show ? String(R.codeNum(t.k)) : '?'));
    if (mine && t.open) el.append(h('small', { class: 'tag' }, '들킴'));
    if (!mine && !t.open && t.no.length) el.append(h('small', { class: 'nos' }, t.no.slice(-3).map((n) => `✕${n}`).join(' ')));
    el.addEventListener('click', () => (mine ? tapMine(i) : tapOpp(owner, i)));
    return el;
  };
  function known(color) {
    const out = new Set();
    for (const t of st.rows[meP]) if (R.codeColor(t.k) === color) out.add(R.codeNum(t.k));
    for (const r of st.rows) for (const t of r) if (t.open && R.codeColor(t.k) === color) out.add(R.codeNum(t.k));
    if (st.drawn != null && st.turn === meP && R.codeColor(st.drawn) === color) out.add(R.codeNum(st.drawn));
    return out;
  }
  function render(s) {
    st = s;
    if (target && (s.phase !== 'guess' || s.turn !== meP || s.out[target.t] || !s.rows[target.t][target.i] || s.rows[target.t][target.i].open)) target = null;
    oppBox.replaceChildren(...env.others().map((q) => {
      const row = h('div', { class: 'code-row opp', 'aria-label': `${env.name(q)} 타일` }, s.rows[q].map((t, i) => tile(t, { owner: q, i })));
      rowEls[q] = row;
      return h('div', { class: `code-opp${s.out[q] ? ' out' : ''}${s.turn === q && !s.over ? ' turn' : ''}` }, h('div', { class: 'code-who' }, tag(env, q), s.out[q] ? h('small', {}, '다 열림') : null), row);
    }));
    myRow.replaceChildren(...s.rows[meP].map((t, i) => tile(t, { owner: meP, i })));
    rowEls[meP] = myRow;
    pile.replaceChildren(h('span', { class: 'stack', 'aria-hidden': 'true' }), h('b', {}, `${s.pile.length}`), h('small', {}, s.pile.length ? '남은 타일' : '다 가져갔어요'));
    if (s.drawn != null) {
      const mine = s.turn === meP;
      const col = R.codeColor(s.drawn) ? 'sun' : 'moon';
      drawn.replaceChildren(h('small', {}, mine ? '가져온 타일' : `${josa(env.name(s.turn), '이', '가')} 가져온 타일`), h('span', { class: `ctile ${col} big` }, h('b', {}, mine ? String(R.codeNum(s.drawn)) : '?')));
    } else drawn.replaceChildren();
    for (let p = 0; p < s.n; p++) env.who(p, s.out[p] ? '다 열림' : `숨은 타일 ${R.Code.hidden(s.rows[p])}`);
    input();
  }
  function input() {
    const on = env.canAct();
    const ph = st.phase;
    pile.disabled = !(on && ph === 'draw');
    pile.classList.toggle('pulse', on && ph === 'draw');
    for (const q of env.others()) if (rowEls[q]) rowEls[q].classList.toggle('pickable', on && ph === 'guess' && !st.out[q]);
    myRow.classList.toggle('pickable', on && ph === 'reveal');
    if (on && ph === 'guess' && target) {
      const t = st.rows[target.t][target.i];
      const color = R.codeColor(t.k);
      const no = known(color);
      picker.hidden = false;
      picker.replaceChildren(h('p', {}, `${env.name(target.t)}의 ${color ? '해' : '밤'} 타일 숫자는?`), h('div', { class: 'nums' },
        Array.from({ length: R.CODE_MAX + 1 }, (_, n) => {
          const out = no.has(n) || t.no.includes(n);
          return h('button', { type: 'button', class: `num ${color ? 'sun' : 'moon'}${out ? ' out' : ''}`, onclick: () => guess(n), 'aria-label': `${n}${out ? ' (이미 나왔어요)' : ''}` }, String(n));
        })));
    } else { picker.hidden = true; picker.replaceChildren(); }
    if (on && ph === 'more') env.acts(btn('그만하고 숨기기', () => env.act({ k: 'stop' }), 'btn btn-soft'), btn('한 번 더 맞히기', () => env.act({ k: 'again' })));
    else env.acts();
  }
  function tapOpp(q, i) {
    if (!env.canAct() || st.phase !== 'guess' || st.out[q]) return;
    const t = st.rows[q][i];
    if (!t || t.open) return;
    target = target && target.t === q && target.i === i ? null : { t: q, i };
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
    if (!env.canAct() || !target) return;
    const a = { k: 'guess', t: target.t, i: target.i, n };
    target = null;
    env.act(a);
  }
  return {
    reset(s) { target = null; render(s); },
    render,
    input: () => input(),
    play(ev, s) {
      render(s);
      if (ev.k === 'draw') { sfx.card(); const d = drawn.querySelector('.ctile'); if (d) d.classList.add('pop'); return 500; }
      if (ev.k === 'guess') {
        const row = rowEls[ev.t];
        const el = row && row.children[ev.i];
        if (ev.ok) {
          sfx.ding();
          if (el) el.classList.add('flip');
          env.banner(`맞혔어요! ${ev.n}`, ev.out ? `${topic(env, ev.t)} 타일이 다 열려서 나갔어요` : ev.p === meP ? `${env.name(ev.t)} 타일이 열렸어요` : ev.t === meP ? `${subj(env, ev.p)} 내 타일을 맞혔어요` : `${subj(env, ev.p)} ${env.name(ev.t)} 타일을 맞혔어요`);
        } else {
          sfx.fail();
          if (el) el.classList.add('shake');
          const prow = rowEls[ev.p];
          const placed = ev.placed != null && prow ? prow.children[ev.placed] : null;
          if (placed) placed.classList.add('pop');
          env.banner(`${ev.n}${[2, 4, 5, 9].includes(ev.n) ? '가' : '이'} 아니에요`, ev.selfOut ? `${topic(env, ev.p)} 타일이 다 열려서 나갔어요` : ev.shown != null ? (ev.p === meP ? '가져온 타일이 들켰어요' : `${subj(env, ev.p)} 가져온 타일이 보여요`) : '');
        }
        return 1300;
      }
      if (ev.k === 'reveal') { sfx.card(); const el = rowEls[ev.p] && rowEls[ev.p].children[ev.i]; if (el) el.classList.add('flip'); return 800; }
      if (ev.k === 'stop' && ev.placed != null) { sfx.card(); const el = rowEls[ev.p] && rowEls[ev.p].children[ev.placed]; if (el) el.classList.add('pop'); return 650; }
      return 300;
    },
    status(s) {
      if (s.turn !== meP) {
        const n = subj(env, s.turn);
        return s.phase === 'draw' ? `${n} 타일을 가져가요…` : s.phase === 'more' ? `${n} 더 맞힐지 생각하고 있어요…` : `${n} 생각하고 있어요…`;
      }
      if (s.phase === 'draw') return '내 차례예요. 가운데 타일 더미를 눌러 한 장 가져와요.';
      if (s.phase === 'guess') return target ? '숫자를 골라요. 흐린 숫자는 이미 보인 숫자예요.' : env.n > 2 ? '친구 줄에서 숨은 타일 하나를 눌러 숫자를 맞혀 봐요.' : '친구의 숨은 타일 하나를 눌러 숫자를 맞혀 봐요.';
      if (s.phase === 'more') return '맞혔어요! 한 번 더 맞힐까요, 멈출까요?';
      return '가져올 타일이 없어요. 내 숨은 타일 하나를 눌러 보여 줘요.';
    },
    aiDelay: (s) => (s.phase === 'draw' ? 700 : s.phase === 'more' ? 900 : 1400) + Math.random() * 400,
  };
}

// =====================================================================
// 만칼라 (두 사람)
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
  board.style.setProperty('--me', env.color(meP));
  board.style.setProperty('--opp', env.color(opp));
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
        setTimeout(() => { env.banner(`잡았다! ${ev.cap}개`, ev.p === meP ? '내 창고로 가져왔어요' : `${subj(env, ev.p)} 가져갔어요`); sfx.ding(); }, t + 100);
        t += 700;
      } else if (ev.again && !s.over) {
        setTimeout(() => { env.banner('한 번 더!', ev.p === meP ? '창고에 쏙 들어갔어요' : `${subj(env, ev.p)} 한 번 더 해요`, 1400); sfx.ding(); }, t + 80);
        t += 500;
      }
      setTimeout(() => { busy = false; }, t);
      return t + 120;
    },
    status(s) {
      if (s.turn === meP) return '내 차례예요. 아래쪽 내 구멍 하나를 눌러요.';
      return `${subj(env, opp)} 구멍을 고르고 있어요…`;
    },
    aiDelay: () => 900 + Math.random() * 500,
  };
}

// =====================================================================
// 윷놀이 (2~4명, 넷이면 2:2 편)
// =====================================================================
function yutView(env) {
  const { main, meP } = env;
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
  const homeOpp = h('div', { class: 'yut-homes opp' });
  const homeMe = h('div', { class: 'yut-homes me' });
  const sticks = h('div', { class: 'yut-sticks', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((k) => h('i', { class: k === 0 ? 'mark' : '' })));
  const result = h('b', { class: 'yut-result', 'aria-live': 'polite' });
  const tray = h('div', { class: 'yut-tray' });
  main.replaceChildren(h('div', { class: 'yut' }, homeOpp, boardBox, h('div', { class: 'yut-throw' }, sticks, result, tray), homeMe));
  const pct = (n) => { const [x, y] = R.YUT_XY[n]; return { left: `${x * 100}%`, top: `${y * 100}%` }; };
  const side = (p) => R.yutSide(st, p);
  // 편 이름: 편 놀이면 '우리 편'/'다른 편', 아니면 사람 이름
  const sideName = (sd) => {
    if (!st.team) return sd === meP ? '내' : `${env.name(sd)}`;
    return sd === side(meP) ? '우리 편' : '상대 편';
  };
  // 위쪽 작은 칸에 쓰는 짧은 이름 ('숲지기 솔' → '솔')
  const shortName = (sd) => (st.team || sd === meP ? sideName(sd) : String(env.name(sd)).split(' ').pop());
  function tokens(s, override) {
    layer.replaceChildren();
    const mySd = side(meP);
    const opts = env.canAct() && s.phase === 'move' ? R.Yut.options(s, meP) : [];
    for (let sd = 0; sd < s.sides; sd++) {
      const at = new Map();
      s.pos[sd].forEach((q, j) => {
        let node = q;
        if (override && override.sd === sd && override.grp.includes(j)) node = override.node;
        if (node === R.YUT.HOME || node === R.YUT.DONE) return;
        if (!at.has(node)) at.set(node, []);
        at.get(node).push(j);
      });
      for (const [node, js] of at) {
        const mine = sd === mySd;
        const can = mine && opts.some((o) => o.j === js[0] && (selT < 0 || o.t === selT));
        const el = h('button', { type: 'button', class: `ytok${mine ? ' mine' : ''}${can ? ' can' : ''}${mine && js.includes(selJ) ? ' sel' : ''}`, 'aria-label': `${sideName(sd)} 말${js.length > 1 ? ` ${js.length}개 업힘` : ''}` },
          js.length > 1 ? h('b', {}, `×${js.length}`) : null);
        Object.assign(el.style, pct(node));
        el.style.setProperty('--c', env.sideColor(sd));
        el.addEventListener('click', () => (mine ? pickPiece(js[0]) : null));
        layer.append(el);
      }
    }
    // 고른 말이 갈 곳
    if (selJ >= 0 && selT >= 0) {
      const d = R.Yut.dest(s, side(meP), selJ, s.tray[selT]);
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
    const mySd = side(meP);
    const draw = (sd) => {
      const home = s.pos[sd].map((q, j) => (q === R.YUT.HOME ? j : -1)).filter((j) => j >= 0);
      const done = s.pos[sd].filter((q) => q === R.YUT.DONE).length;
      const mine = sd === mySd;
      const opts = mine && env.canAct() && s.phase === 'move' ? R.Yut.options(s, meP) : [];
      const can = home.length && opts.some((o) => o.j === home[0] && (selT < 0 || o.t === selT));
      const el = h('button', { type: 'button', class: `yut-wait${can ? ' can' : ''}${mine && home.includes(selJ) ? ' sel' : ''}`, disabled: !mine || !home.length, onclick: () => (home.length ? pickPiece(home[0]) : null) },
        h('span', { class: 'lbl' }, mine ? `${sideName(sd)} 말` : shortName(sd)),
        h('span', { class: 'toks' }, home.map(() => h('i', { style: `background:${env.sideColor(sd)}` }))),
        h('small', {}, `${home.length ? (mine && can ? '눌러서 새 말 놓기' : `기다림 ${home.length}`) : '모두 나감'} · 들어옴 ${done}/${s.np}`));
      return el;
    };
    const others = [];
    for (let sd = 0; sd < s.sides; sd++) if (sd !== mySd) others.push(draw(sd));
    homeOpp.replaceChildren(...others);
    homeMe.replaceChildren(draw(mySd));
    for (let p = 0; p < s.n; p++) env.who(p, `${s.team ? (side(p) === mySd ? '우리 편 · ' : '다른 편 · ') : ''}들어온 말 ${s.pos[side(p)].filter((q) => q === R.YUT.DONE).length}/${s.np}`);
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
    const grp = R.Yut.group(st, side(meP), j);
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
          if (ev.dropped) env.say(ev.p === meP ? '움직일 수 있는 말이 없어서 차례가 넘어가요.' : `${topic(env, ev.p)} 움직일 말이 없어서 차례가 넘어가요.`);
        }, 650);
        return ev.dropped ? 2000 : ev.again ? 1500 : 1000;
      }
      // 말이 한 칸씩 간다
      const STEP = 210;
      ev.path.forEach((node, k) => setTimeout(() => {
        anim = { sd: ev.sd, grp: ev.grp, node: node === R.YUT.DONE ? 0 : node };
        tokens(st, anim);
        sfx.tap();
      }, k * STEP));
      let t = ev.path.length * STEP;
      setTimeout(() => {
        anim = null;
        render(s);
        if (ev.cap) { sfx.bonk(); env.banner('잡았다!', ev.p === meP ? '다른 편 말을 처음으로 보냈어요. 한 번 더!' : `${subj(env, ev.p)} 말을 잡았어요. 한 번 더!`); }
        else if (ev.to === R.YUT.DONE) { sfx.ding(); env.banner('말이 들어왔어요!', `${sideName(ev.sd)} 말 ${ev.grp.length}개`); }
        else if (ev.stack) sfx.pop();
        if (ev.dropped && ev.p === meP) env.say('남은 수로 움직일 수 있는 말이 없어요.');
      }, t);
      t += ev.cap || ev.to === R.YUT.DONE ? 1100 : 300;
      return t;
    },
    status(s) {
      if (s.turn !== meP) {
        const mate = s.team && side(s.turn) === side(meP) ? ' (우리 편)' : '';
        return s.phase === 'throw' ? `${subj(env, s.turn)}${mate} 윷을 던져요…` : `${subj(env, s.turn)}${mate} 말을 고르고 있어요…`;
      }
      if (s.phase === 'throw') return s.tray.length ? '한 번 더 던져요!' : '내 차례예요. 윷을 던져요!';
      return selJ >= 0 ? '반짝이는 곳을 누르면 말이 가요.' : s.tray.length > 1 ? '쓸 수를 고르고, 옮길 말을 눌러요.' : `옮길 말을 눌러요. 새 말은 아래 ‘${sideName(side(meP))} 말’을 눌러요.`;
    },
    aiDelay: (s) => (s.phase === 'throw' ? 700 : 1000) + Math.random() * 400,
  };
}

// =====================================================================
// 땅따먹기 (점 잇기, 2~4명)
// =====================================================================
function dotsView(env) {
  const { main, meP } = env;
  let st = null, sel = -1, N = 0;
  let root = null, lineEls = [], boxEls = [];
  const box = h('div', { class: 'dots-board' });
  main.replaceChildren(box);
  const initial = (p) => (p === meP ? '나' : String(env.name(p)).split(' ').pop().slice(0, 1));
  function build(size) {
    N = size;
    const G = (k) => 8 + k * (84 / N);
    root = svg('svg', { viewBox: '0 0 100 100', class: 'dots-svg', role: 'group', 'aria-label': '점 잇기 판' });
    const boxesG = svg('g'), linesG = svg('g'), dotsG = svg('g'), hitsG = svg('g');
    root.append(boxesG, linesG, dotsG, hitsG);
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) dotsG.append(svg('circle', { cx: G(c), cy: G(r), r: N > 4 ? 1.6 : 1.9, class: 'dot' }));
    const lineXY = (l) => {
      const H = (N + 1) * N;
      if (l < H) { const r = Math.floor(l / N), c = l % N; return [G(c), G(r), G(c + 1), G(r)]; }
      const k = l - H, r = Math.floor(k / (N + 1)), c = k % (N + 1);
      return [G(c), G(r), G(c), G(r + 1)];
    };
    lineEls = []; boxEls = [];
    const cell = 84 / N;
    for (let l = 0; l < R.dotsLines(N); l++) {
      const [x1, y1, x2, y2] = lineXY(l);
      const ln = svg('line', { x1, y1, x2, y2, class: 'ln' });
      lineEls.push(ln);
      linesG.append(ln);
      const horiz = y1 === y2, pad = cell * 0.14, w = cell * 0.48;
      const hit = svg('rect', { x: horiz ? x1 + pad : x1 - w / 2, y: horiz ? y1 - w / 2 : y1 + pad, width: horiz ? x2 - x1 - pad * 2 : w, height: horiz ? w : y2 - y1 - pad * 2, class: 'hit', rx: 2 });
      hit.addEventListener('click', () => tap(l));
      hitsG.append(hit);
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = svg('g', { class: 'bx' });
      g.append(svg('rect', { x: G(c) + 1.4, y: G(r) + 1.4, width: cell - 2.8, height: cell - 2.8, rx: 2.5 }), svg('text', { x: G(c) + cell / 2, y: G(r) + cell / 2 + cell * 0.14, 'font-size': (cell * 0.4).toFixed(1) }, ''));
      boxEls.push(g);
      boxesG.append(g);
    }
    box.replaceChildren(root);
  }
  function render(s, flash = -1) {
    st = s;
    if (s.size !== N) build(s.size);
    if (sel >= 0 && s.lines[sel]) sel = -1;
    s.lines.forEach((o, l) => {
      const el = lineEls[l];
      el.setAttribute('class', `ln${o ? ' on' : ''}${l === sel ? ' pre' : ''}${l === flash ? ' new' : ''}`);
      el.style.stroke = o ? env.color(o - 1) : l === sel ? env.color(meP) : '';
    });
    s.boxes.forEach((o, b) => {
      const g = boxEls[b];
      g.setAttribute('class', `bx${o ? ' on' : ''}`);
      const rect = g.querySelector('rect'), text = g.querySelector('text');
      rect.style.fill = o ? env.color(o - 1) : 'transparent';
      text.style.fill = o ? env.color(o - 1) : '';
      text.textContent = o ? initial(o - 1) : '';
    });
    for (let p = 0; p < s.n; p++) env.who(p, `땅 ${s.boxes.filter((o) => o === p + 1).length}칸`);
    input();
  }
  function input() {
    const on = env.canAct();
    if (root) root.classList.toggle('on', on);
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
        if (!s.over) env.say(ev.p === meP ? `땅 ${ev.got.length}칸을 차지했어요! 한 번 더 그어요.` : `${subj(env, ev.p)} 땅을 차지해서 한 번 더 그어요.`);
        return 900;
      }
      return 350;
    },
    status(s) {
      if (s.turn === meP) return s.last && s.last.p === meP && s.last.got.length ? '땅을 차지했어요! 한 번 더 그어요.' : sel >= 0 ? '한 번 더 누르거나 ‘여기에 긋기’를 눌러요.' : '내 차례예요. 두 점 사이를 눌러 선을 그어요.';
      return `${subj(env, s.turn)} 선을 고르고 있어요…`;
    },
    aiDelay: () => 650 + Math.random() * 500,
  };
}

export const VIEWS = { n77: n77View, code: codeView, mancala: mancalaView, yut: yutView, dots: dotsView };
