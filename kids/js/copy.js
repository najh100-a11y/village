// 진숲 어린이 마을 — 필사 도서관 (주마다 바뀌는 성경 이야기 따라 쓰기)
import { h, icon, modal, toast, confetti, showImage } from './ui.js';
import { loadImageFile, toJpeg, jpegUrl } from './images.js';
import { message } from './api.js';
import { guideCard, firstVisit, friendBoard, passageBlock, dayLabel, isStory } from './social.js';

const FONT = '"Maplestory", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 화면에 손가락으로 따라 쓰는 공책 한 장
function tracePad(text) {
  const wrap = h('div', { class: 'trace' });
  const cv = h('canvas', { class: 'trace-cv', 'aria-label': `따라 쓸 말씀: ${text}` });
  wrap.append(cv);
  const ctx = cv.getContext('2d');
  const strokes = [];
  let lines = [];
  let size = 34, lineH = 64, dpr = 1, W = 600;

  function layout() {
    W = Math.max(260, wrap.clientWidth || 600);
    size = W < 420 ? 26 : 34;
    lineH = Math.round(size * 1.9);
    ctx.font = `${size}px ${FONT}`;
    lines = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (ctx.measureText(t).width > W - 36 && cur) { lines.push(cur); cur = word; } else cur = t;
    }
    if (cur) lines.push(cur);
    const H = lines.length * lineH + 24;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = H + 'px';
    draw();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const H = cv.height / dpr;
    ctx.fillStyle = '#FFFDF6';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#EADBC2';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < lines.length; i++) {
      const y = 12 + (i + 1) * lineH - lineH * 0.28;
      ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(W - 14, y); ctx.stroke();
    }
    ctx.font = `${size}px ${FONT}`;
    ctx.fillStyle = '#D9C7AE';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, 18, 12 + (i + 1) * lineH - lineH * 0.36));
    ctx.strokeStyle = '#5A3D2B';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 9);
    for (const s of strokes) {
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y) : ctx.moveTo(x * W, y)));
      if (s.length === 1) ctx.lineTo(s[0][0] * W + 0.1, s[0][1]);
      ctx.stroke();
    }
  }
  const pt = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) * ((cv.height / dpr) / r.height)];
  };
  let drawing = null;
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = [pt(e)]; strokes.push(drawing); draw(); });
  cv.addEventListener('pointermove', (e) => { if (!drawing) return; drawing.push(pt(e)); draw(); });
  const end = () => { drawing = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  requestAnimationFrame(layout);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => layout()) : null;
  if (ro) ro.observe(wrap);
  return {
    el: wrap,
    clear() { strokes.length = 0; draw(); },
    get used() { return strokes.length > 0; },
    stop() { if (ro) ro.disconnect(); },
  };
}

export function createCopy({ rpc, getToken, onFruits, onCelebrate, onDone, onSessionLost }) {
  let data = null;

  async function load(week) {
    modal.setBody(h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, '이야기를 꺼내고 있어요…')));
    try {
      data = await rpc('kids_copy_week', { p_token: getToken(), p_week: week || null });
    } catch (e) {
      if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
      modal.setBody(h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, message(e))));
      return;
    }
    home();
  }

  function guideView(back) {
    modal.setTitle('필사 도서관');
    modal.setBody(h('div', { class: 'mem' }, guideCard('copy'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: back }, '알겠어요, 써 볼래요'))));
  }

  function weekLabel(ws) {
    const d = new Date(ws + 'T00:00:00');
    const e = new Date(d.getTime() + 6 * 86400000);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ~ ${e.getMonth() + 1}월 ${e.getDate()}일`;
  }

  function home() {
    modal.setTitle('필사 도서관');
    if (!data.week) {
      modal.setBody(h('div', { class: 'mem' },
        h('div', { class: 'empty' },
          h('p', { class: 'empty-big' }, data.next_start ? `필사는 ${dayLabel(data.next_start)}부터 시작해요.` : '아직 올라온 이야기가 없어요.'),
          h('p', {}, '그동안 필사하는 방법을 먼저 알아 둘까요?')),
        guideCard('copy', { compact: true })));
      return;
    }
    const w = data.week;
    const mine = data.mine;
    const story = isStory(w.passage);
    modal.setBody(h('div', { class: 'mem copy' },
      h('div', { class: 'day-nav' },
        h('button', { class: 'btn btn-plain', type: 'button', disabled: !data.prev, onclick: () => load(data.prev) }, icon('back'), '지난주'),
        h('span', { class: 'day-now' }, w.is_current ? `이번 주 · ${weekLabel(w.week_start)}` : weekLabel(w.week_start)),
        h('button', { class: 'btn btn-plain next', type: 'button', disabled: !data.next, onclick: () => load(data.next) }, '다음 주', icon('back'))),
      story
        ? h('article', { class: 'verse-card story-card' },
          h('div', { class: 'verse-tags' }, h('span', { class: 'tag' }, '하나님 나라 이야기'), mine ? h('span', { class: 'tag tag-red' }, '필사 마침') : null),
          h('h3', { class: 'story-title' }, w.theme),
          h('p', { class: 'qt-ref' }, `성경 ${w.ref}`),
          w.intro ? h('p', { class: 'copy-intro' }, w.intro) : null,
          passageBlock(w.passage),
          h('p', { class: 'verse-ver' }, '진숲 어린이 마을 · 하나님 나라 이야기'))
        : h('article', { class: 'verse-card' },
          h('div', { class: 'verse-tags' }, w.theme ? h('span', { class: 'tag' }, w.theme) : null, mine ? h('span', { class: 'tag tag-red' }, '필사 마침') : null),
          h('h3', { class: 'verse-ref' }, w.ref),
          w.intro ? h('p', { class: 'copy-intro' }, w.intro) : null,
          passageBlock(w.passage),
          h('p', { class: 'verse-ver' }, 'NJHV · 나종현 번역')),
      h('div', { class: 'mode-pick three' },
        h('button', { class: 'mode', type: 'button', onclick: () => trace(0) },
          h('b', {}, '화면에 따라 쓰기'), h('span', {}, '연하게 보이는 글씨 위를 손가락이나 펜으로 따라 써요.')),
        h('button', { class: 'mode', type: 'button', onclick: notebook },
          h('b', {}, '공책에 쓰기'), h('span', {}, story ? '내 공책에 연필로 한 문단씩 쓰고, 다 쓴 문단을 눌러 표시해요.' : '내 공책에 연필로 한 절씩 쓰고, 다 쓴 절을 눌러 표시해요.')),
        h('button', { class: 'mode', type: 'button', onclick: () => photoPick() },
          h('b', {}, '공책 사진 올리기'), h('span', {}, '공책에 다 쓴 다음, 사진을 찍어 올려요.'))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: () => guideView(home) }, '필사는 어떻게 해요?')),
      mine && mine.has_photo ? myPhotoCard() : null,
      mine ? finishForm(true) : null,
      friendBoard({
        title: w.is_current ? '이번 주 필사를 마친 친구들' : '이 주에 필사를 마친 친구들',
        empty: '아직 아무도 마치지 않았어요. 첫 번째로 마쳐 볼까요?',
        entries: data.friends, kind: 'copy', key: w.week_start, rpc, getToken, onSessionLost,
        extra: photoExtra,
      })));
  }

  // ---------- 공책 사진 ----------
  function photoExtra(e) {
    if (e.thumb) {
      return h('button', { class: 'fb-photo', type: 'button', 'aria-label': `${e.name}의 필사 사진 크게 보기`, onclick: () => bigPhoto(e) },
        h('img', { src: jpegUrl(e.thumb), alt: '' }), h('span', {}, '공책 사진'));
    }
    if (e.has_photo && !e.me) return h('p', { class: 'fb-note' }, '공책 사진으로 필사했어요.');
    return null;
  }

  async function bigPhoto(e) {
    const close = showImage(jpegUrl(e.thumb), `${e.name}의 필사 · 불러오는 중…`);
    try {
      const r = await rpc('kids_copy_photo_get', { p_token: getToken(), p_week: data.week.week_start, p_child: e.id });
      close();
      showImage(jpegUrl(r.photo), `${e.name}의 필사 · ${data.week.ref}`);
    } catch (err) {
      close();
      if (err.code === 'SESSION') { modal.close(); return onSessionLost(); }
      toast(message(err));
    }
  }

  function myPhotoCard() {
    const mine = data.mine;
    const me = data.friends.find((f) => f.me) || { id: null, name: '나', thumb: mine.thumb };
    return h('section', { class: 'photo-card' },
      h('button', { class: 'photo-thumb', type: 'button', 'aria-label': '내 필사 사진 크게 보기', onclick: () => bigPhoto({ ...me, thumb: mine.thumb }) },
        h('img', { src: jpegUrl(mine.thumb), alt: '' })),
      h('div', { class: 'photo-info' },
        h('b', {}, '내 공책 사진'),
        h('span', { class: 'hint-line' }, mine.photo_ok
          ? (mine.shared && !mine.hidden ? '선생님이 확인했어요. 친구들도 볼 수 있어요.' : '선생님이 확인했어요. 나만 보기로 해 두었어요.')
          : '선생님이 확인하면 친구들에게도 보여요.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => photoPick() }, '다시 올리기'),
          h('button', { class: 'btn btn-plain btn-small', type: 'button', onclick: removePhoto }, '사진 지우기'))));
  }

  async function removePhoto() {
    try {
      await rpc('kids_copy_photo_delete', { p_token: getToken(), p_week: data.week.week_start });
    } catch (e) {
      if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
      toast(message(e));
      return;
    }
    toast('사진을 지웠어요');
    await load(data.week.week_start);
  }

  function photoPick() {
    const input = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': '공책 사진 고르기' });
    const err = h('p', { class: 'err', role: 'alert' });
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      err.textContent = '';
      try {
        const img = await loadImageFile(f);
        photoPreview(img);
      } catch (e) {
        err.textContent = '이 사진은 열 수 없어요. 다른 사진으로 해 볼까요?';
      }
    });
    modal.setTitle('공책 사진 올리기');
    modal.setBody(h('div', { class: 'mem copy' },
      h('section', { class: 'guide compact' },
        h('h3', {}, '사진은 이렇게 찍어요'),
        h('ol', { class: 'guide-steps' },
          h('li', {}, h('b', {}, '공책만 나오게'), h('span', {}, '얼굴이나 이름표, 집 주소가 사진에 들어가지 않게 해요.')),
          h('li', {}, h('b', {}, '밝은 곳에서'), h('span', {}, '그림자가 지지 않게, 공책을 반듯하게 놓고 찍어요.')),
          h('li', {}, h('b', {}, '선생님이 먼저 봐요'), h('span', {}, '올린 사진은 선생님이 확인한 뒤에 친구들에게 보여요.')))),
      h('label', { class: 'btn btn-go photo-btn' }, input, '사진 찍기 또는 고르기'),
      err,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: home }, '돌아가기'))));
  }

  function photoPreview(img) {
    let rot = 0;
    const box = h('div', { class: 'photo-preview' });
    const err = h('p', { class: 'err', role: 'alert' });
    const show = () => {
      const c = toJpeg(img, { maxSide: 900, quality: 0.8, maxBytes: 900000, rotate: rot });
      box.replaceChildren(h('img', { src: c.url, alt: '올릴 공책 사진' }));
    };
    const up = h('button', { class: 'btn btn-go', type: 'button' }, '이 사진 올리기');
    up.addEventListener('click', async () => {
      up.disabled = true;
      up.textContent = '올리는 중…';
      let res;
      try {
        const big = toJpeg(img, { maxSide: 1280, quality: 0.72, maxBytes: 420000, rotate: rot });
        const small = toJpeg(img, { maxSide: 260, quality: 0.7, maxBytes: 36000, rotate: rot });
        res = await rpc('kids_copy_photo', { p_token: getToken(), p_week: data.week.week_start, p_photo: big.b64, p_thumb: small.b64 });
      } catch (e) {
        up.disabled = false;
        up.textContent = '이 사진 올리기';
        if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
        err.textContent = e.message === 'TOO_BIG' ? '사진이 너무 커요. 다른 사진으로 해 볼까요?' : message(e);
        return;
      }
      onFruits(res.fruits);
      if (res.gained) {
        confetti();
        onCelebrate();
        onDone('copy');
        toast('공책 사진을 올렸어요! 열매 2개를 받았어요');
      } else toast('새 사진으로 바꿨어요');
      await load(data.week.week_start);
    });
    modal.setTitle('이 사진이 맞나요?');
    modal.setBody(h('div', { class: 'mem copy' },
      box,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { rot = (rot + 3) % 4; show(); } }, '왼쪽으로 돌리기'),
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { rot = (rot + 1) % 4; show(); } }, '오른쪽으로 돌리기')),
      h('p', { class: 'hint-line' }, '공책 글씨가 바로 서 보이게 돌린 다음 올려요.'),
      err,
      h('div', { class: 'row end' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => photoPick() }, '다른 사진'), up)));
    show();
  }

  function trace(i) {
    const p = data.week.passage;
    const v = p[i];
    const pad = tracePad(v.t);
    const last = i === p.length - 1;
    const story = isStory(p);
    modal.setTitle(`따라 쓰기 ${i + 1} / ${p.length}`);
    modal.setBody(h('div', { class: 'mem copy' },
      h('p', { class: 'qt-ref' }, story ? `${data.week.theme} · ${i + 1}번째 문단` : `${data.week.ref} · ${v.n}절`),
      pad.el,
      h('div', { class: 'row end' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { pad.stop(); home(); } }, '그만하기'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => pad.clear() }, '지우기'),
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => {
          if (!pad.used) { toast('글씨를 따라 써 볼까요?'); return; }
          pad.stop();
          if (last) finish(); else trace(i + 1);
        } }, last ? '다 썼어요!' : story ? '다음 문단' : '다음 절'))));
  }

  function notebook() {
    const p = data.week.passage;
    const story = isStory(p);
    const done = new Set();
    const go = h('button', { class: 'btn btn-go', type: 'button', disabled: true, onclick: finish }, '다 썼어요!');
    modal.setTitle('공책에 쓰기');
    modal.setBody(h('div', { class: 'mem copy' },
      h('p', { class: 'hint-line' }, story ? '한 문단씩 공책에 쓰고, 다 쓴 문단을 눌러 주세요.' : '한 절씩 공책에 쓰고, 다 쓴 절을 눌러 주세요.'),
      h('div', { class: 'nb-list' }, p.map((v, k) => {
        const b = h('button', { class: 'nb-item', type: 'button', 'aria-pressed': 'false' }, h('sup', {}, v.n || String(k + 1)), h('span', {}, v.t));
        b.addEventListener('click', () => {
          if (done.has(k)) done.delete(k); else done.add(k);
          b.setAttribute('aria-pressed', String(done.has(k)));
          go.disabled = done.size !== p.length;
        });
        return b;
      })),
      h('div', { class: 'row end' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: home }, '그만하기'), go)));
  }

  function finishForm(editing) {
    const mine = data.mine;
    const note = h('textarea', { id: 'cpNote', maxlength: 300, rows: 2, placeholder: '마음에 남은 말이나 느낌을 한 줄로 써 봐요. (쓰지 않아도 괜찮아요)' });
    note.value = mine ? mine.note : '';
    const share = h('input', { type: 'checkbox', id: 'cpShare' });
    share.checked = mine ? mine.shared : true;
    const err = h('p', { class: 'err', role: 'alert' });
    const btn = h('button', { class: 'btn btn-go', type: 'button' }, editing ? '느낌 고치기' : '필사 마치기');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      let res;
      try {
        res = await rpc('kids_copy_save', { p_token: getToken(), p_week: data.week.week_start, p_note: note.value, p_shared: share.checked });
      } catch (e) {
        btn.disabled = false;
        if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
        err.textContent = message(e);
        return;
      }
      onFruits(res.fruits);
      if (!editing && res.gained) {
        confetti();
        onCelebrate();
        onDone('copy');
        toast('이번 주 필사를 마쳤어요! 열매 2개를 받았어요');
      } else toast('저장했어요');
      await load(data.week.week_start);
    });
    return h('section', { class: 'write' },
      h('label', { class: 'field', for: 'cpNote' }, h('span', {}, editing ? '나의 한 줄 느낌' : '한 줄 느낌')), note,
      h('label', { class: 'check' }, share, h('span', {}, '친구들도 볼 수 있게 할래요')),
      err,
      h('div', { class: 'row end' }, h('span', { class: 'hint-line' }, editing ? '' : '필사를 마치면 열매 2개를 받아요.'), btn));
  }

  function finish() {
    modal.setTitle('다 썼어요!');
    if (data.mine) {
      toast('이번 주 필사를 한 번 더 했어요. 정말 멋져요!');
      onCelebrate();
      return home();
    }
    modal.setBody(h('div', { class: 'mem copy' },
      h('p', { class: 'result-big' }, isStory(data.week.passage) ? '이야기를 끝까지 따라 썼어요!' : '말씀을 끝까지 따라 썼어요!'),
      finishForm(false)));
  }

  function open(week) {
    modal.open('필사 도서관', h('div', { class: 'mem' }), { cls: 'copy-sheet' });
    if (firstVisit('copy')) guideView(() => load(week));
    else load(week);
  }

  return { open };
}
