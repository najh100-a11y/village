// 진숲 어린이 마을 — 암송의 집 (말씀 보기, 외우기 연습, 도장판)
import { h, icon, modal, toast, confetti } from './ui.js';
import { sfx } from './sound.js';
import { message } from './api.js';
import { guideCard, firstVisit, friendBoard } from './social.js';

function shuffle(arr, seed = Math.random()) {
  const a = arr.slice();
  let s = Math.floor(seed * 2147483646) + 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createMemory({ rpc, getToken, onFruits, onCelebrate, onBoard, onSessionLost, onDone = () => {} }) {
  let verses = [];
  const current = () => verses.find((v) => v.is_current) || null;
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  async function load() {
    verses = await rpc('kids_verses', { p_token: getToken() });
    onBoard(current());
    return verses;
  }

  function speak(v) {
    if (!canSpeak) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(`${v.ref}. ${v.body}`);
      u.lang = 'ko-KR';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 소리를 못 내도 괜찮다 */ }
  }

  // 암송 구절은 개역한글판(대한성서공회) 본문을 고치지 않고 그대로 쓴다
  const verseVer = (v) => (v.version === 'NJHV' ? 'NJHV · 나종현 번역' : '성경전서 개역한글판 · 대한성서공회')

  function verseCard(v, { showActions = true } = {}) {
    return h('article', { class: 'verse-card' + (v.passed ? ' is-passed' : '') },
      h('div', { class: 'verse-tags' },
        v.is_current ? h('span', { class: 'tag' }, '이번 주 말씀') : null,
        v.passed ? h('span', { class: 'tag tag-red' }, '도장 받았어요') : null,
        v.practice_count ? h('span', { class: 'tag tag-soft' }, `연습 ${v.practice_count}번`) : null),
      h('h3', { class: 'verse-ref' }, v.ref),
      h('p', { class: 'verse-body' }, v.body),
      h('p', { class: 'verse-ver' }, verseVer(v)),
      showActions ? h('div', { class: 'row' },
        canSpeak ? h('button', { class: 'btn btn-soft', type: 'button', onclick: () => speak(v) }, icon('speaker'), '들어 보기') : null,
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => practice(v) }, '외우기 연습')) : null,
      v.passed ? h('div', { class: 'stamp-mark', 'aria-hidden': 'true' }, h('span', {}, '참 잘'), h('span', {}, '했어요')) : null);
  }

  function stampGrid() {
    if (!verses.length) return null;
    // 빨간 도장: 선생님 앞에서 외워서 받은 말씀, 초록 ✓: 연습한 말씀 (진한 초록은 오늘 연습)
    return h('div', { class: 'stamp-grid' }, verses.map((v) => h('button', {
      class: 'stamp' + (v.passed ? ' passed' : v.practice_count ? ' practiced' : '') + (!v.passed && v.practiced_today ? ' today' : '') + (v.is_current ? ' current' : ''),
      type: 'button',
      onclick: () => showVerse(v),
    },
    h('span', { class: 'stamp-dot', 'aria-hidden': 'true' }, v.passed ? '참 잘' : v.practice_count ? '✓' : ''),
    h('span', { class: 'stamp-ref' }, v.ref),
    h('span', { class: 'stamp-state' }, v.passed ? '선생님 도장 받음' : v.practiced_today ? `오늘 연습했어요 (${v.practice_count}번)` : v.practice_count ? `연습 ${v.practice_count}번` : '아직이에요'))));
  }

  function showGuide(back) {
    modal.setTitle('암송의 집');
    modal.setBody(h('div', { class: 'mem' }, guideCard('memory'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: back }, '알겠어요, 외워 볼래요'))));
  }

  function showHome() {
    modal.setTitle('암송의 집');
    const cur = current();
    const passed = verses.filter((v) => v.passed).length;
    const board = h('div', { class: 'fboard-slot' });
    modal.setBody(h('div', { class: 'mem' },
      cur ? verseCard(cur) : h('div', { class: 'empty' },
        h('p', { class: 'empty-big' }, '아직 이번 주 말씀이 올라오지 않았어요.'),
        h('p', {}, verses.length ? '아래 도장판에서 지난 말씀을 골라 연습해 볼 수 있어요.' : '선생님이 곧 올려 주실 거예요!')),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => showGuide(showHome) }, '말씀은 어떻게 외워요?')),
      board,
      verses.length ? h('div', { class: 'sub-head' },
        h('h3', {}, '말씀 도장판'),
        h('p', {}, `${verses.length}개 중 ${passed}개 도장`)) : null,
      stampGrid(),
      verses.length ? h('p', { class: 'stamp-legend' },
        h('span', {}, h('i', { style: 'background:#E3F3D6;border:2px solid #8BD46A;color:#2F7A3A' }, '✓'), '연습한 말씀'),
        h('span', {}, h('i', { style: 'background:#FFE3E1;border:2px solid #EF6461;color:#EF6461' }, '도'), '선생님 앞에서 외워 도장 받은 말씀')) : null,
      h('p', { class: 'note' }, '외우기 연습을 끝까지 마치면 초록 ✓가 생기고, 하루에 한 구절마다 열매 1개를 받아요. 다 외우면 선생님 앞에서 외워 보세요. 선생님이 빨간 도장을 찍어 주고 열매 10개를 받아요.')));
    if (cur) {
      rpc('kids_house_memory', { p_token: getToken() }).then((r) => {
        if (!r || !r.verse) return;
        board.replaceChildren(friendBoard({
          title: '이번 주 말씀을 연습한 친구들',
          empty: '아직 아무도 연습하지 않았어요. 첫 번째로 해 볼까요?',
          entries: r.friends, kind: 'memory', key: r.verse.id, rpc, getToken, onSessionLost,
          badge: (e) => (e.passed ? h('span', { class: 'tag tag-red' }, '도장') : null),
        }));
      }).catch((e) => { if (e.code === 'SESSION') onSessionLost(); });
    }
  }

  function showVerse(v) {
    modal.setTitle(v.ref);
    modal.setBody(h('div', { class: 'mem' },
      verseCard(v),
      h('button', { class: 'btn btn-plain', type: 'button', onclick: showHome }, icon('back'), '도장판으로')));
  }

  // ---------- 연습: 1 읽기 → 2 빈칸 → 3 순서 ----------
  function practice(v) {
    const tokens = v.body.split(/\s+/).filter(Boolean);
    const run = { mistakes: 0 };
    const stepper = (n) => h('ol', { class: 'steps', 'aria-label': '연습 단계' },
      ['읽어 보기', '빈칸 채우기', '순서대로 놓기'].map((t, i) => h('li', { class: i + 1 < n ? 'done' : i + 1 === n ? 'now' : '' },
        h('span', {}, String(i + 1)), t)));

    // 1단계
    let reads = 0;
    const dots = h('div', { class: 'read-dots' }, [0, 1, 2].map(() => h('span')));
    const nextBtn = h('button', { class: 'btn btn-go', type: 'button', disabled: true, onclick: step2 }, '다음: 빈칸 채우기');
    const readBtn = h('button', { class: 'btn btn-sun', type: 'button', onclick: () => {
      if (reads >= 3) return;
      dots.children[reads].classList.add('on');
      reads++;
      if (reads === 3) { nextBtn.disabled = false; readBtn.disabled = true; readBtn.textContent = '세 번 다 읽었어요!'; }
    } }, '소리 내어 한 번 읽었어요');
    modal.setTitle('외우기 연습');
    modal.setBody(h('div', { class: 'mem practice' },
      stepper(1),
      h('h3', { class: 'verse-ref' }, v.ref),
      h('p', { class: 'verse-body big' }, v.body),
      h('p', { class: 'hint-line' }, '소리 내어 세 번 읽어 보세요.'),
      dots,
      h('div', { class: 'row' },
        canSpeak ? h('button', { class: 'btn btn-soft', type: 'button', onclick: () => speak(v) }, icon('speaker'), '들어 보기') : null,
        readBtn),
      h('div', { class: 'row end' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: showHome }, '그만하기'), nextBtn)));

    // 2단계: 빈칸
    function step2() {
      const n = tokens.length;
      const want = Math.max(1, Math.round(n * 0.4));
      const order = shuffle([...tokens.keys()]).slice(0, want).sort((a, b) => a - b);
      let pos = 0;
      const spans = tokens.map((t, i) => order.includes(i)
        ? h('span', { class: 'blank', style: `min-width:${Math.max(2.2, t.length * 1.05)}em` }, '')
        : h('span', { class: 'word' }, t));
      const line = h('p', { class: 'verse-body big fill-line' }, spans.flatMap((s, i) => (i ? [' ', s] : [s])));
      const mark = () => spans.forEach((s, i) => s.classList.toggle('now', i === order[pos]));
      mark();
      const chips = h('div', { class: 'chips' });
      const done = h('button', { class: 'btn btn-go', type: 'button', hidden: true, onclick: step3 }, '다음: 순서대로 놓기');
      shuffle(order.map((i) => tokens[i])).forEach((word) => {
        const c = h('button', { class: 'chip', type: 'button', 'data-quiet': '', onclick: () => {
          if (word === tokens[order[pos]]) {
            sfx.pop();
            const s = spans[order[pos]];
            s.textContent = word;
            s.classList.add('filled');
            c.remove();
            pos++;
            mark();
            if (pos >= order.length) { done.hidden = false; chips.append(h('p', { class: 'cheer' }, '빈칸을 다 채웠어요!')); }
          } else {
            run.mistakes++;
            sfx.fail();
            c.classList.remove('shake');
            void c.offsetWidth;
            c.classList.add('shake');
          }
        } }, word);
        chips.append(c);
      });
      modal.setBody(h('div', { class: 'mem practice' },
        stepper(2),
        h('h3', { class: 'verse-ref' }, v.ref),
        line,
        h('p', { class: 'hint-line' }, '노랗게 빛나는 빈칸에 들어갈 말을 골라요.'),
        chips,
        h('div', { class: 'row end' }, done)));
    }

    // 3단계: 순서
    function step3() {
      let pos = 0;
      const built = h('p', { class: 'verse-body big build-line' }, h('span', { class: 'caret' }));
      const chips = h('div', { class: 'chips' });
      shuffle(tokens).forEach((word) => {
        const c = h('button', { class: 'chip', type: 'button', 'data-quiet': '', onclick: () => {
          if (word === tokens[pos]) {
            sfx.pop();
            built.lastChild.before(h('span', { class: 'word pop' }, word), ' ');
            c.remove();
            pos++;
            if (pos >= tokens.length) finish();
          } else {
            run.mistakes++;
            sfx.fail();
            c.classList.remove('shake');
            void c.offsetWidth;
            c.classList.add('shake');
          }
        } }, word);
        chips.append(c);
      });
      modal.setBody(h('div', { class: 'mem practice' },
        stepper(3),
        h('h3', { class: 'verse-ref' }, v.ref),
        built,
        h('p', { class: 'hint-line' }, '첫 낱말부터 차례대로 눌러요.'),
        chips));
    }

    async function finish() {
      const score = Math.max(0, 100 - run.mistakes * 5);
      const stars = run.mistakes === 0 ? 3 : run.mistakes <= 3 ? 2 : 1;
      modal.setBody(h('div', { class: 'mem result' }, h('p', { class: 'empty-big' }, '기록하고 있어요…')));
      let res = null;
      try {
        res = await rpc('kids_practice', { p_token: getToken(), p_verse_id: v.id, p_score: score });
      } catch (e) {
        if (e.code === 'SESSION') return onSessionLost();
        toast(message(e));
      }
      if (res) onFruits(res.fruits);
      if (res && res.gained) onDone('memory');
      try { await load(); } catch (e) { /* 다음에 다시 불러온다 */ }
      const fresh = verses.find((x) => x.id === v.id) || v;
      confetti();
      onCelebrate();
      modal.setTitle('잘했어요!');
      modal.setBody(h('div', { class: 'mem result' },
        h('div', { class: 'stars', 'aria-label': `별 ${stars}개` }, [1, 2, 3].map((i) => icon('star', 'ico star' + (i <= stars ? ' on' : '')))),
        h('p', { class: 'result-big' }, run.mistakes === 0 ? '한 번도 안 틀렸어요!' : `${run.mistakes}번 다시 골랐어요. 잘 해냈어요!`),
        res && res.gained ? h('p', { class: 'fruit-gain' }, icon('apple'), '열매 1개를 받았어요') :
          h('p', { class: 'fruit-none' }, '오늘 이 말씀의 열매는 벌써 받았어요. 내일 또 연습하면 받을 수 있어요.'),
        fresh.passed ? h('p', { class: 'note' }, '이 말씀은 벌써 도장을 받았어요. 계속 기억해요!') :
          h('p', { class: 'note' }, '다 외웠으면 선생님 앞에서 외워 보세요. 도장과 열매 10개를 받아요.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft', type: 'button', onclick: () => practice(fresh) }, '한 번 더'),
          h('button', { class: 'btn btn-go', type: 'button', onclick: showHome }, '도장판으로'))));
    }
  }

  async function open(view = 'home', verseId = null) {
    modal.open('암송의 집', h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, '말씀을 꺼내고 있어요…')), { cls: 'memory' });
    try {
      await load();
    } catch (e) {
      if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
      modal.setBody(h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, message(e))));
      return;
    }
    const v = verseId && verses.find((x) => x.id === verseId);
    if (!verseId && firstVisit('memory')) showGuide(showHome);
    else if (view === 'practice' && v) practice(v);
    else if (v) showVerse(v);
    else showHome();
  }

  return { open, load, current, verseCard: (v) => verseCard(v, { showActions: false }) };
}
