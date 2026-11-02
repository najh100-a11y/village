// 진숲 어린이 마을 — 묵상의 숲 (날마다 바뀌는 묵상)
import { h, icon, modal, toast, confetti } from './ui.js';
import { message } from './api.js';
import { REWARD } from './economy.js';
import { guideCard, firstVisit, friendBoard, dayLabel } from './social.js';

export function createQt({ rpc, getToken, onFruits, onCelebrate, onDone, onSessionLost, features = () => ({}) }) {
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  let current = null;

  function speak(q) {
    if (!canSpeak) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`${q.ref}. ${q.passage.map((v) => v.t).join(' ')}`);
      u.lang = 'ko-KR';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 소리를 못 내도 괜찮다 */ }
  }

  async function load(day) {
    modal.setBody(h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, '묵상을 꺼내고 있어요…')));
    try {
      current = await rpc('kids_qt_day', { p_token: getToken(), p_day: day || null });
    } catch (e) {
      if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
      modal.setBody(h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, message(e))));
      return;
    }
    render();
  }

  function guideView(back) {
    modal.setTitle('묵상의 숲');
    modal.setBody(h('div', { class: 'mem' }, guideCard('qt'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: back }, '알겠어요, 시작할래요'))));
  }

  // 마음에 닿은 말: 서버에 저장 칸이 없으면 이 기기에만 둔다
  const wordKey = (day) => `kv.qtword.${day}`;
  function localWord(day) { try { return localStorage.getItem(wordKey(day)) || ''; } catch (e) { return ''; } }
  function keepWord(day, w) { try { if (w) localStorage.setItem(wordKey(day), w); else localStorage.removeItem(wordKey(day)); } catch (e) { /* 괜찮다 */ } }
  const clean = (t) => t.replace(/^[\s"'“”‘’(「『.,!?…]+|[\s"'“”‘’)」』.,!?…:;]+$/g, '');

  // 말씀을 낱말 단추로: 눌러서 마음에 닿은 말을 고른다 (붙어 있는 낱말을 이어서 누르면 함께 골라진다)
  function wordPassage(passage, picked, onPick) {
    const all = [];
    const box = h('div', { class: 'passage pick' });
    passage.forEach((v) => {
      const p = h('p', {}, v.n ? h('sup', {}, v.n) : null);
      v.t.split(/\s+/).filter(Boolean).forEach((tok, i) => {
        const b = h('button', { class: 'w', type: 'button' }, tok);
        const idx = all.length;
        all.push({ b, tok });
        b.addEventListener('click', () => onPick(idx));
        if (i) p.append(' ');
        p.append(b);
      });
      box.append(p);
    });
    const paint = (a, z) => all.forEach((x, i) => x.b.classList.toggle('on', a != null && i >= a && i <= z));
    return { box, all, paint };
  }

  function quietTimer(btn) {
    const ring = h('div', { class: 'quiet-ring', 'aria-hidden': 'true' }, h('span', {}));
    const label = h('p', { class: 'quiet-say' }, '숨을 천천히 들이쉬고, 내쉬어요.');
    const wrap = h('div', { class: 'quiet' }, ring, label);
    btn.replaceWith(wrap);
    let left = 30;
    const tick = () => {
      left--;
      ring.firstChild.textContent = String(left);
      if (left === 20) label.textContent = '하나님이 지금 나와 함께 계세요.';
      if (left === 10) label.textContent = '고른 말을 마음속으로 한 번 더 말해 봐요.';
      if (left <= 0) { clearInterval(t); wrap.classList.add('done'); label.textContent = '아멘. 잘했어요!'; ring.firstChild.textContent = '♡'; }
    };
    ring.firstChild.textContent = String(left);
    const t = setInterval(tick, 1000);
  }

  function render() {
    const d = current;
    modal.setTitle('묵상의 숲');
    if (!d.qt) {
      modal.setBody(h('div', { class: 'mem' },
        h('div', { class: 'empty' },
          h('p', { class: 'empty-big' }, d.next_start ? `묵상은 ${dayLabel(d.next_start)}부터 시작해요.` : '아직 올라온 묵상이 없어요.'),
          h('p', {}, '선생님이 말씀을 준비하고 있어요. 그동안 묵상하는 방법을 먼저 알아 둘까요?')),
        guideCard('qt', { compact: true })));
      return;
    }
    const q = d.qt;
    const mine = d.mine;
    const serverWord = !!(features() || {}).lectio;
    let word = (mine && mine.word) || localWord(q.day);
    let range = null;
    const answer = h('textarea', { id: 'qtAnswer', maxlength: 400, rows: 3, placeholder: '질문에 대한 내 생각을 한두 줄로 써 봐요.' });
    answer.value = mine ? mine.answer : '';
    const prayer = h('textarea', { id: 'qtPrayer', maxlength: 400, rows: 2, placeholder: '하나님께 하고 싶은 말을 써 봐요. (나만 볼 수 있어요)' });
    prayer.value = mine ? mine.prayer : '';
    const share = h('input', { type: 'checkbox', id: 'qtShare' });
    share.checked = mine ? mine.shared : true;
    const err = h('p', { class: 'err', role: 'alert' });

    // 2. 머물러요: 낱말 고르기
    const chosen = h('p', { class: 'word-chosen', 'aria-live': 'polite' });
    const prayHint = h('p', { class: 'hint-line' });
    const drawChosen = () => {
      chosen.replaceChildren(word ? h('span', {}, '내가 고른 말 ', h('b', {}, word)) : h('span', { class: 'hint-line' }, '아직 고르지 않았어요. 말씀에서 낱말을 눌러 보세요.'));
      if (word) chosen.append(h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => { word = ''; range = null; wp.paint(null); drawChosen(); } }, '다시 고르기'));
      prayHint.textContent = word ? `'${word}'라는 말을 넣어서 하나님께 이야기해 봐요.` : '';
    };
    const wp = wordPassage(q.passage, word, (i) => {
      // 바로 옆 낱말을 누르면 이어서 고르고(다섯 낱말까지), 떨어진 낱말을 누르면 새로 고른다
      if (range && (i === range[1] + 1 || i === range[0] - 1) && range[1] - range[0] < 4) range = [Math.min(range[0], i), Math.max(range[1], i)];
      else if (range && i >= range[0] && i <= range[1]) range = range[0] === range[1] ? null : [i, i];
      else range = [i, i];
      word = range ? clean(wp.all.slice(range[0], range[1] + 1).map((x) => x.tok).join(' ')) : '';
      wp.paint(range ? range[0] : null, range ? range[1] : null);
      drawChosen();
    });
    if (word) {
      // 저장해 둔 말이 말씀 속 어디인지 찾아 칠한다
      const toks = wp.all.map((x) => clean(x.tok));
      for (let a = 0; a < toks.length && !range; a++) for (let z = a; z < Math.min(toks.length, a + 5); z++) {
        if (clean(wp.all.slice(a, z + 1).map((x) => x.tok).join(' ')) === word) { range = [a, z]; break; }
      }
      if (range) wp.paint(range[0], range[1]);
    }
    drawChosen();

    const save = h('button', { class: 'btn btn-go', type: 'button' }, mine ? '고쳐서 저장하기' : '묵상 마치기');
    save.addEventListener('click', async () => {
      err.textContent = '';
      if (!answer.value.trim()) { err.textContent = '내 생각을 한 줄이라도 써 주세요.'; answer.focus(); return; }
      save.disabled = true;
      let res;
      const args = { p_token: getToken(), p_day: q.day, p_answer: answer.value, p_prayer: prayer.value, p_shared: share.checked };
      if (serverWord) args.p_word = word || null;
      try {
        res = await rpc('kids_qt_save', args);
      } catch (e) {
        save.disabled = false;
        if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
        err.textContent = message(e);
        return;
      }
      keepWord(q.day, word);
      onFruits(res.fruits);
      if (!mine) {
        confetti();
        onCelebrate();
        onDone('qt');
        const streak = res.streak > 1 ? ` 묵상 ${res.streak}일째예요!` : '';
        toast(res.gained ? `묵상을 마쳤어요! 열매 ${res.gained}개를 받았어요.${streak}` : '묵상을 저장했어요', 3600);
      } else toast('고쳐서 저장했어요');
      await load(q.day);
    });

    const nav = h('div', { class: 'day-nav' },
      h('button', { class: 'btn btn-plain', type: 'button', disabled: !d.prev, onclick: () => load(d.prev) }, icon('back'), '전날'),
      h('span', { class: 'day-now' }, q.is_today ? `오늘 · ${dayLabel(q.day)}` : dayLabel(q.day)),
      h('button', { class: 'btn btn-plain next', type: 'button', disabled: !d.next, onclick: () => load(d.next) }, '다음 날', icon('back')));
    const step = (n, t, sub) => h('div', { class: 'lx-step' }, h('span', { class: 'lx-n' }, String(n)), h('b', {}, t), sub ? h('span', {}, sub) : null);
    const quietBtn = h('button', { class: 'btn btn-soft', type: 'button' }, '30초 동안 조용히 머물기');
    quietBtn.addEventListener('click', () => quietTimer(quietBtn));

    modal.setBody(h('div', { class: 'mem qt' },
      nav,
      h('article', { class: 'verse-card qt-card' },
        h('div', { class: 'verse-tags' }, q.theme ? h('span', { class: 'tag' }, q.theme) : null,
          mine ? h('span', { class: 'tag tag-red' }, '묵상 마침') : null),
        h('h3', { class: 'qt-title' }, q.title),
        h('p', { class: 'qt-ref' }, q.ref),
        step(1, '읽어요', '"하나님, 말씀해 주세요." 기도하고, 천천히 두 번 읽어요.'),
        wp.box,
        h('p', { class: 'verse-ver' }, 'NJHV · 나종현 번역'),
        h('div', { class: 'row start' },
          canSpeak ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => speak(q) }, icon('speaker'), '들어 보기') : null,
          h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => guideView(render) }, '묵상은 어떻게 해요?'))),
      h('section', { class: 'think' },
        step(2, '머물러요', '마음에 닿은 낱말을 말씀에서 눌러 골라요. 옆 낱말을 이어서 누르면 함께 골라져요.'),
        chosen),
      h('section', { class: 'think' },
        step(3, '생각해요'),
        q.note ? h('div', { class: 'qt-note' }, h('b', {}, '짧은 해설 '), q.note) : null,
        h('ol', {}, q.questions.map((t) => h('li', {}, t))),
        h('label', { class: 'field', for: 'qtAnswer' }, h('span', {}, '내 생각')), answer),
      h('section', { class: 'write' },
        step(4, '기도해요'),
        h('div', { class: 'pray-ex' }, h('b', {}, '따라 해 보는 기도 '), q.prayer),
        prayHint,
        h('label', { class: 'field', for: 'qtPrayer' }, h('span', {}, '나의 기도 (나만 볼 수 있어요)')), prayer),
      h('section', { class: 'think' },
        step(5, '쉬어요', '잠깐 조용히 하나님과 함께 있어요.'),
        quietBtn,
        q.action ? h('p', { class: 'try' }, h('b', {}, '오늘 해 볼까요? '), q.action) : null),
      h('section', { class: 'write' },
        h('label', { class: 'check' }, share, h('span', {}, '친구들도 내 생각과 고른 말을 볼 수 있게 할래요')),
        err,
        h('div', { class: 'row end' }, h('span', { class: 'hint-line' }, mine ? '' : `묵상을 마치면 열매 ${REWARD.qt}개를 받아요.`), save)),
      friendBoard({
        title: q.is_today ? '오늘 묵상한 친구들' : '이날 묵상한 친구들',
        empty: '아직 아무도 묵상하지 않았어요. 첫 번째 친구가 되어 볼까요?',
        entries: d.friends, kind: 'qt', key: q.day, rpc, getToken, onSessionLost,
      })));
  }

  function open(day) {
    modal.open('묵상의 숲', h('div', { class: 'mem' }), { cls: 'qt-sheet' });
    if (firstVisit('qt')) guideView(() => load(day));
    else load(day);
  }

  return { open };
}
