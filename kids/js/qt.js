// 진숲 어린이 마을 — 묵상의 숲 (날마다 바뀌는 묵상)
import { h, icon, modal, toast, confetti } from './ui.js';
import { message } from './api.js';
import { guideCard, firstVisit, friendBoard, passageBlock, dayLabel } from './social.js';

export function createQt({ rpc, getToken, onFruits, onCelebrate, onDone, onSessionLost }) {
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
    const answer = h('textarea', { id: 'qtAnswer', maxlength: 400, rows: 3, placeholder: '질문에 대한 내 생각을 한두 줄로 써 봐요.' });
    answer.value = mine ? mine.answer : '';
    const prayer = h('textarea', { id: 'qtPrayer', maxlength: 400, rows: 2, placeholder: '하나님께 하고 싶은 말을 써 봐요. (나만 볼 수 있어요)' });
    prayer.value = mine ? mine.prayer : '';
    const share = h('input', { type: 'checkbox', id: 'qtShare' });
    share.checked = mine ? mine.shared : true;
    const err = h('p', { class: 'err', role: 'alert' });
    const save = h('button', { class: 'btn btn-go', type: 'button' }, mine ? '고쳐서 저장하기' : '묵상 마치기');
    save.addEventListener('click', async () => {
      err.textContent = '';
      if (!answer.value.trim()) { err.textContent = '내 생각을 한 줄이라도 써 주세요.'; answer.focus(); return; }
      save.disabled = true;
      let res;
      try {
        res = await rpc('kids_qt_save', { p_token: getToken(), p_day: q.day, p_answer: answer.value, p_prayer: prayer.value, p_shared: share.checked });
      } catch (e) {
        save.disabled = false;
        if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
        err.textContent = message(e);
        return;
      }
      onFruits(res.fruits);
      if (!mine) {
        confetti();
        onCelebrate();
        onDone('qt');
        toast(res.gained ? '오늘 묵상을 마쳤어요! 열매 1개를 받았어요' : '묵상을 저장했어요');
      } else toast('고쳐서 저장했어요');
      await load(q.day);
    });

    const nav = h('div', { class: 'day-nav' },
      h('button', { class: 'btn btn-plain', type: 'button', disabled: !d.prev, onclick: () => load(d.prev) }, icon('back'), '전날'),
      h('span', { class: 'day-now' }, q.is_today ? `오늘 · ${dayLabel(q.day)}` : dayLabel(q.day)),
      h('button', { class: 'btn btn-plain next', type: 'button', disabled: !d.next, onclick: () => load(d.next) }, '다음 날', icon('back')));

    modal.setBody(h('div', { class: 'mem qt' },
      nav,
      h('article', { class: 'verse-card qt-card' },
        h('div', { class: 'verse-tags' }, q.theme ? h('span', { class: 'tag' }, q.theme) : null,
          mine ? h('span', { class: 'tag tag-red' }, '묵상 마침') : null),
        h('h3', { class: 'qt-title' }, q.title),
        h('p', { class: 'qt-ref' }, q.ref),
        passageBlock(q.passage),
        h('p', { class: 'verse-ver' }, 'NJHV · 나종현 번역'),
        h('div', { class: 'row start' },
          canSpeak ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => speak(q) }, icon('speaker'), '들어 보기') : null,
          h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => guideView(render) }, '묵상은 어떻게 해요?'))),
      h('section', { class: 'think' },
        h('h3', {}, '생각해 봐요'),
        h('ol', {}, q.questions.map((t) => h('li', {}, t))),
        q.action ? h('p', { class: 'try' }, h('b', {}, '오늘 해 볼까요? '), q.action) : null),
      h('section', { class: 'write' },
        h('label', { class: 'field', for: 'qtAnswer' }, h('span', {}, '내 생각')), answer,
        h('div', { class: 'pray-ex' }, h('b', {}, '따라 해 보는 기도 '), q.prayer),
        h('label', { class: 'field', for: 'qtPrayer' }, h('span', {}, '나의 기도 (나만 볼 수 있어요)')), prayer,
        h('label', { class: 'check' }, share, h('span', {}, '친구들도 내 생각을 볼 수 있게 할래요')),
        err,
        h('div', { class: 'row end' }, h('span', { class: 'hint-line' }, mine ? '' : '묵상을 마치면 열매 1개를 받아요.'), save)),
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
