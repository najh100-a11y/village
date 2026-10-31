// 진숲 어린이 마을 — 숲속 부엌 (성경 이야기 속 음식 만들기, 혼자 또는 친구와 번갈아)
import { h, modal, toast, confetti, josa } from './ui.js';
import { message } from './api.js';
import { friendPicker, waitInvite } from './play.js';
import { RECIPES, recipeById, INGREDIENTS } from './play-data.js';

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const starsOf = (avg) => (avg >= 0.85 ? 3 : avg >= 0.6 ? 2 : 1);
const starRow = (n, max = 3) => h('span', { class: 'stars', 'aria-label': `별 ${n}개` }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '' }, '★')));
const TAP_LABEL = { mill: '갈기!', fire: '부채질!', dough: '반죽!', share: '나눠 주기!' };

function chip(id) {
  const [name, color] = INGREDIENTS[id] || [id, '#ddd'];
  return h('span', { class: 'ing' }, h('i', { style: `background:${color}` }), name);
}

// ---------- 단계 놀이: 끝나면 done(점수 0~1) ----------
function stepCollect(stage, st, done) {
  const field = h('div', { class: 'collect-field' });
  const count = h('b', {}, `0 / ${st.need}`);
  const bar = h('div', { class: 'timebar' }, h('i'));
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), h('div', { class: 'step-top' }, count, bar), field);
  let got = 0, over = false;
  const t0 = performance.now();
  const spawn = setInterval(() => {
    if (over) return;
    const it = h('button', { class: `drop ${st.item}`, type: 'button', 'aria-label': '줍기', style: `left:${8 + Math.random() * 80}%;top:${10 + Math.random() * 72}%` });
    it.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (over) return;
      it.remove();
      got++;
      count.textContent = `${got} / ${st.need}`;
      if (got >= st.need) end();
    });
    field.append(it);
    setTimeout(() => it.remove(), 2300);
  }, 520);
  const tick = setInterval(() => {
    const k = (performance.now() - t0) / (st.time * 1000);
    bar.firstChild.style.width = Math.max(0, 100 - k * 100) + '%';
    if (k >= 1) end();
  }, 100);
  function end() {
    if (over) return;
    over = true;
    clearInterval(spawn); clearInterval(tick);
    const used = (performance.now() - t0) / (st.time * 1000);
    done(got >= st.need ? Math.min(1, 1.15 - used * 0.4) : (got / st.need) * 0.7);
  }
}

function stepTap(stage, st, done) {
  const count = h('b', {}, `0 / ${st.need}`);
  const bar = h('div', { class: 'timebar' }, h('i'));
  const big = h('button', { class: `tap-big ${st.item}`, type: 'button' }, TAP_LABEL[st.item] || '콕!');
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), h('div', { class: 'step-top' }, count, bar), big);
  let got = 0, over = false;
  const t0 = performance.now();
  big.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (over) return;
    got++;
    count.textContent = `${got} / ${st.need}`;
    big.classList.remove('hit'); void big.offsetWidth; big.classList.add('hit');
    if (got >= st.need) end();
  });
  const tick = setInterval(() => {
    const k = (performance.now() - t0) / (st.time * 1000);
    bar.firstChild.style.width = Math.max(0, 100 - k * 100) + '%';
    if (k >= 1) end();
  }, 100);
  function end() {
    if (over) return;
    over = true;
    clearInterval(tick);
    const used = (performance.now() - t0) / (st.time * 1000);
    done(got >= st.need ? Math.min(1, 1.2 - used * 0.45) : (got / st.need) * 0.7);
  }
}

function stepHeat(stage, st, done) {
  const zone = 0.32 + Math.random() * 0.36;
  const bar = h('div', { class: 'heat-bar' }, h('span', { class: 'heat-zone', style: `left:${(zone - 0.09) * 100}%;width:18%` }), h('i', { class: 'needle' }));
  const btn = h('button', { class: 'btn btn-go', type: 'button' }, '멈추기!');
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), h('div', { class: `heat-pic ${st.item}` }), bar, h('div', { class: 'row' }, btn));
  let v = 0, dir = 1, over = false, last = performance.now();
  const speed = 0.55 + Math.random() * 0.25;
  const loop = (now) => {
    if (over || !document.body.contains(bar)) return;
    v += dir * speed * ((now - last) / 1000);
    last = now;
    if (v > 1) { v = 1; dir = -1; } if (v < 0) { v = 0; dir = 1; }
    bar.lastChild.style.left = v * 100 + '%';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  btn.addEventListener('click', () => {
    if (over) return;
    over = true;
    const d = Math.abs(v - zone);
    btn.disabled = true;
    btn.textContent = d < 0.09 ? '딱 좋아요!' : d < 0.2 ? '조금 아쉬워요' : v < zone ? '덜 익었어요' : '조금 탔어요';
    setTimeout(() => done(d < 0.09 ? 1 : Math.max(0.3, 1 - d * 2.2)), 700);
  });
}

function stepPick(stage, st, done) {
  const items = shuffle([...st.want, ...st.decoy]);
  const chosen = new Set();
  const grid = h('div', { class: 'pick-grid' }, items.map((id) => {
    const b = h('button', { class: 'pick-item', type: 'button', 'aria-pressed': 'false' }, chip(id));
    b.addEventListener('click', () => {
      if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
      b.setAttribute('aria-pressed', String(chosen.has(id)));
    });
    return b;
  }));
  const ok = h('button', { class: 'btn btn-go', type: 'button' }, '다 골랐어요');
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), grid, h('div', { class: 'row' }, ok));
  ok.addEventListener('click', () => {
    const wrong = [...chosen].filter((id) => !st.want.includes(id)).length;
    const miss = st.want.filter((id) => !chosen.has(id)).length;
    ok.disabled = true;
    if (wrong || miss) {
      const fixed = h('p', { class: 'step-note' }, '정답: ', st.want.map((id) => chip(id)));
      stage.append(fixed);
      setTimeout(() => done(Math.max(0.3, 1 - (wrong + miss) * 0.25)), 1500);
    } else done(1);
  });
}

function stepStir(stage, st, done) {
  const pot = h('div', { class: 'stir-pot', 'aria-label': '냄비 안을 손가락으로 빙글빙글 저어요' }, h('i', { class: 'spoon' }));
  const count = h('b', {}, `0 / ${st.need}바퀴`);
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), h('div', { class: 'step-top' }, count), pot,
    h('p', { class: 'hint-line' }, '손가락을 떼지 않고 동그랗게 돌려요. 잘 안 되면 냄비를 여러 번 눌러도 돼요.'));
  let acc = 0, lastA = null, over = false, taps = 0;
  const t0 = performance.now();
  const angle = (e) => { const r = pot.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  const update = () => {
    const turns = Math.min(st.need, Math.floor(Math.abs(acc) / (Math.PI * 2) + taps / 4));
    count.textContent = `${turns} / ${st.need}바퀴`;
    pot.firstChild.style.transform = `rotate(${acc + taps * (Math.PI / 2)}rad)`;
    if (turns >= st.need && !over) {
      over = true;
      const used = (performance.now() - t0) / 1000;
      setTimeout(() => done(Math.min(1, Math.max(0.6, 1.25 - used / 16))), 300);
    }
  };
  pot.addEventListener('pointerdown', (e) => { e.preventDefault(); pot.setPointerCapture(e.pointerId); lastA = angle(e); taps++; update(); });
  pot.addEventListener('pointermove', (e) => {
    if (lastA === null) return;
    const a = angle(e);
    let d = a - lastA;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    acc += d;
    lastA = a;
    update();
  });
  const end = () => { lastA = null; };
  pot.addEventListener('pointerup', end);
  pot.addEventListener('pointercancel', end);
}

function stepCount(stage, st, done) {
  const basket = {};
  const shown = h('div', { class: 'basket' });
  const draw = () => shown.replaceChildren(...(Object.keys(basket).length ? Object.entries(basket).map(([id, n]) => h('span', { class: 'ing' }, chip(id), h('b', {}, `× ${n}`))) : [h('span', { class: 'hint-line' }, '바구니가 비어 있어요')]));
  const pickers = h('div', { class: 'pick-grid' }, Object.keys(st.want).concat(['apple']).map((id) => h('button', {
    class: 'pick-item', type: 'button', onclick: () => { basket[id] = (basket[id] || 0) + 1; draw(); },
  }, chip(id), h('em', {}, '+1'))));
  const reset = h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { for (const k of Object.keys(basket)) delete basket[k]; draw(); } }, '바구니 비우기');
  const ok = h('button', { class: 'btn btn-go', type: 'button' }, '다 담았어요');
  stage.replaceChildren(h('p', { class: 'step-hint' }, st.hint), pickers, shown, h('div', { class: 'row' }, reset, ok));
  draw();
  ok.addEventListener('click', () => {
    const exact = Object.entries(st.want).every(([id, n]) => basket[id] === n) && Object.keys(basket).every((id) => st.want[id]);
    ok.disabled = true;
    if (exact) done(1);
    else {
      stage.append(h('p', { class: 'step-note' }, '정답: 보리빵 다섯 개와 물고기 두 마리예요.'));
      setTimeout(() => done(0.5), 1500);
    }
  });
}

const STEP = { collect: stepCollect, tap: stepTap, heat: stepHeat, pick: stepPick, stir: stepStir, count: stepCount };

export function createCook({ rpc, getToken, onSessionLost, onCelebrate, hub, onlineFriends }) {
  let book = {};
  let run = null;

  const fail = (e) => { if (e.code === 'SESSION') { modal.close(); onSessionLost(); return; } toast(message(e)); };

  async function menu() {
    if (run && run.session) run.session.close();
    run = null;
    modal.setTitle('숲속 부엌');
    try { book = await rpc('kids_cook_book', { p_token: getToken() }); } catch (e) { if (e.code === 'SESSION') return fail(e); book = {}; }
    modal.setBody(h('div', { class: 'mem game cook' },
      h('p', { class: 'hint-line' }, '성경 이야기에 나오는 음식을 만들어 봐요. 요리법은 재미있게 꾸민 놀이예요.'),
      h('div', { class: 'recipe-list' }, RECIPES.map((r) => h('button', { class: 'recipe', type: 'button', onclick: () => detail(r) },
        h('i', { class: 'dish', style: `background:${r.color}` }),
        h('b', {}, r.name), h('span', {}, r.ref),
        starRow((book[r.id] && book[r.id].stars) || 0))))));
  }

  function detail(r) {
    modal.setTitle(r.name);
    const friends = onlineFriends();
    modal.setBody(h('div', { class: 'mem game cook' },
      h('article', { class: 'verse-card' },
        h('div', { class: 'verse-tags' }, h('span', { class: 'tag' }, '성경 이야기')),
        h('h3', { class: 'verse-ref' }, r.ref),
        h('p', { class: 'copy-intro' }, r.story)),
      h('ol', { class: 'cook-steps' }, r.steps.map((s) => h('li', {}, s.title))),
      h('div', { class: 'mode-pick' },
        h('button', { class: 'mode', type: 'button', onclick: () => start(r, null) }, h('b', {}, '혼자 요리하기'), h('span', {}, '세 단계를 모두 내가 해요.'))),
      h('div', { class: 'sub-head' }, h('h3', {}, '친구와 번갈아 요리하기'), h('p', {}, friends.length ? `${friends.length}명` : '')),
      friendPicker(friends, (f) => {
        waitInvite(hub, f, 'cook', r.id, { setBody: (b) => modal.setBody(b), onBack: () => detail(r) }).then((s) => { if (s) start(r, s); });
      }, '지금 마을에 있는 친구가 없어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: menu }, '다른 요리 보기'))));
  }

  function start(r, session) {
    run = { r, session, i: 0, scores: [], waiting: null, alone: !session };
    if (session) {
      session.on('msg', (m) => {
        if (!run || run.session !== session) return;
        if (m.t === 'step' && m.i === run.i && owner(run.i) !== 'me') {
          run.scores[m.i] = Math.max(0, Math.min(100, m.sc | 0)) / 100;
          next();
        }
      }).on('left', () => {
        if (!run || run.session !== session) return;
        run.alone = true;
        toast(`${josa(session.peerName, '이가', '가')} 부엌을 떠났어요. 남은 단계는 내가 해요!`, 3600);
        if (run.waiting) play(); // 친구 차례를 기다리던 중이면 내가 이어서
      });
    }
    play();
  }

  // 단계 주인: 함께일 때는 초대한 사람이 1, 3단계, 초대받은 사람이 2단계
  function owner(i) {
    if (!run.session || run.alone) return 'me';
    const hostTurn = i % 2 === 0;
    return hostTurn === run.session.host ? 'me' : 'peer';
  }

  function play() {
    const { r, i } = run;
    if (i >= r.steps.length) return finish();
    const st = r.steps[i];
    modal.setTitle(`${r.name} · ${i + 1} / ${r.steps.length}`);
    const stage = h('div', { class: 'stage' });
    modal.setBody(h('div', { class: 'mem game cook' },
      h('ol', { class: 'cook-steps now' }, r.steps.map((s, k) => h('li', { class: k < i ? 'done' : k === i ? 'now' : '' }, s.title,
        run.session && !run.alone ? h('em', {}, owner(k) === 'me' ? ' (나)' : ` (${run.session.peerName})`) : null))),
      h('h3', { class: 'step-title' }, st.title),
      stage));
    run.waiting = owner(i) !== 'me';
    if (!run.waiting) {
      STEP[st.type](stage, st, (score) => {
        if (!run || run.i !== i) return;
        run.scores[i] = score;
        if (run.session && !run.alone && !run.session.bot) run.session.send('step', { i, sc: Math.round(score * 100) });
        next();
      });
    } else {
      stage.replaceChildren(h('div', { class: 'wait-inv' },
        h('div', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('p', { class: 'result-big' }, `${josa(run.session.peerName, '이가', '가')} ‘${st.title}’를 하고 있어요`),
        h('p', { class: 'hint-line' }, '친구를 응원하며 기다려요!'),
        i === 0 ? h('article', { class: 'verse-card' }, h('h3', { class: 'verse-ref' }, r.ref), h('p', { class: 'copy-intro' }, r.story)) : null));
      if (run.session.bot) {
        const at = run.i;
        setTimeout(() => { if (run && run.i === at) { run.scores[at] = 0.7 + Math.random() * 0.3; next(); } }, 2600 + Math.random() * 2000);
      }
    }
  }

  function next() {
    run.i += 1;
    setTimeout(() => { if (run) play(); }, 450);
  }

  async function finish() {
    const { r, session } = run;
    const avg = run.scores.reduce((a, b) => a + (b || 0), 0) / r.steps.length;
    const stars = starsOf(avg);
    const together = !!session && !run.alone;
    let res = null;
    try { res = await rpc('kids_cook_done', { p_token: getToken(), p_recipe: r.id, p_stars: stars, p_together: together }); } catch (e) {
      if (e.code === 'SESSION') return fail(e);
    }
    if (res) book = res;
    if (stars >= 2) { confetti(); onCelebrate(); }
    modal.setTitle('요리 완성!');
    modal.setBody(h('div', { class: 'mem game cook' },
      h('div', { class: 'dish-done' }, h('i', { class: 'dish big', style: `background:${r.color}` }),
        h('p', { class: 'result-big' }, `${r.name} 완성!`), starRow(stars),
        together ? h('p', {}, `${josa(session.peerName, '과', '와')} 함께 만들었어요.`) : null),
      h('p', { class: 'hint-line' }, `${r.ref}에 나오는 음식이에요.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: menu }, '다른 요리'),
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => { if (session) session.close(); start(r, null); } }, '혼자 한 번 더'))));
  }

  function open() {
    modal.open('숲속 부엌', h('div'), { cls: 'game-sheet', onClose: () => { if (run && run.session) run.session.close(); run = null; } });
    menu();
  }
  function openWith(session) {
    modal.open('숲속 부엌', h('div'), { cls: 'game-sheet', onClose: () => { if (run && run.session) run.session.close(); run = null; } });
    const r = recipeById(session.extra) || RECIPES[0];
    toast(`${josa(session.peerName, '과', '와')} ${josa(r.name, '을', '를')} 만들어요. 2단계가 내 차례예요!`, 3600);
    start(r, session);
  }
  return { open, openWith };
}
