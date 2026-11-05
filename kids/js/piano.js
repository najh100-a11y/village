// 진숲 어린이 마을 — 내 집 피아노: 건반을 눌러 직접 연주하고, 노래를 따라 친다
// 건반은 C3~C6(3옥타브) 가운데 화면 너비에 맞는 만큼 보이고, '낮은 음'·'높은 음'으로 옮긴다.
// 손가락 여러 개로 함께 누를 수 있고(화음), 누른 채 옆으로 밀면 이어서 소리가 난다.
// 컴퓨터 자판: A S D F G H J K L ; ' 는 흰 건반, W E T Y U O P 는 검은 건반, Z X 는 한 옥타브 아래·위.
import { pianoKey, pianoReady } from './sound.js';
import { h } from './ui.js';

const LOW = 48, HIGH = 84; // C3 ~ C6
const SOLFA = ['도', '', '레', '', '미', '파', '', '솔', '', '라', '', '시'];
const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const WHITES = [];
for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) WHITES.push(m);
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
const KEYCHAR = { 0: 'A', 1: 'W', 2: 'S', 3: 'E', 4: 'D', 5: 'F', 6: 'T', 7: 'G', 8: 'Y', 9: 'H', 10: 'U', 11: 'J', 12: 'K', 13: 'O', 14: 'L', 15: 'P', 16: ';', 17: "'" };

// 음 이름(C4, D5 …)과 박자(4분음표 1박)를 적은 글을 [midi, 박자] 목록으로
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function score(text) {
  return text.trim().split(/\s+/).filter((t) => t !== '|').map((t) => {
    const [n, d] = t.split(':');
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    if (!m) throw new Error('bad note ' + t);
    return [12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] ? 1 : 0), d ? Number(d) : 1];
  });
}
// 따라 치기 노래 (가사는 싣지 않는다). 찬송가 셋은 hymnary.org의 찬송가 악보(MusicXML) 선율을 그대로 옮겼다:
// 예수 사랑하심은 = JESUS LOVES ME (Bradbury, 1862) 다장조, 기뻐하며 경배하세 = HYMN TO JOY (베토벤 교향곡 9번) 사장조,
// 나 같은 죄인 살리신 = NEW BRITAIN (1829) 사장조. 반짝반짝 작은 별은 프랑스 민요 선율(다장조)이다.
export const SONGS = [
  { id: 'twinkle', name: '반짝반짝 작은 별', beat: 0.48, notes: score(`
    C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 |
    G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2`) },
  { id: 'jesus', name: '예수 사랑하심은', beat: 0.42, notes: score(`
    G4 E4 E4 D4 | E4 G4 G4:2 | A4 A4 C5 A4 | A4 G4 G4:2 | G4 E4 E4 D4 | E4 G4 G4:2 | A4 A4 G4 C4 | E4 D4 C4:2 |
    G4:2 E4 G4 | A4 C5:3 | G4:2 E4 C4 | E4 D4:3 | G4:2 E4 G4 | A4 C5:2 A4 | G4 C4 E4 D4 | C4:4`) },
  { id: 'joy', name: '기뻐하며 경배하세', sub: '베토벤 「환희의 송가」', beat: 0.46, notes: score(`
    B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | B4:1.5 A4:.5 A4:2 | B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | A4:1.5 G4:.5 G4:2 |
    A4 A4 B4 G4 | A4 B4:.5 C5:.5 B4 G4 | A4 B4:.5 C5:.5 B4 A4 | G4 A4 D4:2 | B4 B4 C5 D5 | D5 C5 B4 A4 | G4 G4 A4 B4 | A4:1.5 G4:.5 G4:2`) },
  { id: 'grace', name: '나 같은 죄인 살리신', sub: 'Amazing Grace', beat: 0.5, notes: score(`
    D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | G4:2 E4 | D4:2 D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | D5:5 B4 |
    D5:1.5 B4:.5 D5:.5 B4:.5 | G4:2 D4 | E4:1.5 G4:.5 G4:.5 E4:.5 | D4:2 D4 | G4:2 B4:.5 G4:.5 | B4:2 A4 | G4:5`) },
];
export const noteName = (m) => SOLFA[((m % 12) + 12) % 12] || (SOLFA[(((m - 1) % 12) + 12) % 12] + '#');

// opts: { onClose(), onPlay(midi) 내가 누른 음(친구에게 들려준다), onDone(song) 노래를 끝까지 쳤다, standing() 일어났는지 }
export function openPiano(opts = {}) {
  let start = 60; // 보이는 첫 흰 건반 (C4)
  let base = 60; // 컴퓨터 자판 A가 치는 음
  let count = 10; // 보이는 흰 건반 수
  let pedal = false;
  let song = null, idx = 0, demo = null, doneShown = false, closed = false;
  const down = new Map(); // 누르고 있는 것(손가락, 자판) → { m, release }
  const held = new Map(); // midi → 누르고 있는 수 (건반 모양)
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  const keysEl = h('div', { class: 'pn-keys', 'aria-label': '피아노 건반' });
  const lowBtn = h('button', { class: 'btn btn-soft btn-small pn-oct', type: 'button', onclick: () => shift(-1) }, '◀ 낮은 음');
  const highBtn = h('button', { class: 'btn btn-soft btn-small pn-oct', type: 'button', onclick: () => shift(1) }, '높은 음 ▶');
  const pedalBtn = h('button', { class: 'btn btn-soft btn-small pn-pedal', type: 'button', 'aria-pressed': 'false', onclick: () => setPedal(!pedal) }, '울림 길게');
  const closeBtn = h('button', { class: 'btn btn-red btn-small', type: 'button', onclick: () => close() }, '그만 치기');
  const songsEl = h('div', { class: 'pn-songs', role: 'tablist', 'aria-label': '따라 치기 노래' });
  const guideEl = h('div', { class: 'pn-guide', hidden: true });
  const quiet = h('p', { class: 'pn-quiet', hidden: true }, "소리가 꺼져 있어요. 위쪽 '소리' 단추로 효과음을 켜 주세요.");
  const root = h('div', { class: 'piano', role: 'dialog', 'aria-label': '피아노 치기' },
    h('div', { class: 'pn-top' },
      h('b', { class: 'pn-title' }, '🎹 작은 피아노'),
      h('div', { class: 'pn-ctrl' }, lowBtn, highBtn, pedalBtn, closeBtn)),
    songsEl, guideEl, quiet, keysEl);
  document.body.append(root);
  document.body.classList.add('piano-on');

  // ---------- 노래 고르기 ----------
  function drawSongs() {
    const chip = (label, sub, on, fn) => h('button', { class: 'pn-song' + (on ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(on), onclick: fn },
      label, sub ? h('small', {}, sub) : null);
    songsEl.replaceChildren(
      chip('자유롭게 치기', null, !song, () => setSong(null)),
      ...SONGS.map((s) => chip(s.name, s.sub, song === s, () => setSong(s))));
  }
  function setSong(s) {
    stopDemo();
    song = s;
    idx = 0;
    doneShown = false;
    drawSongs();
    drawGuide();
    if (song) showNote(song.notes[0][0]);
    paint();
  }

  // ---------- 따라 치기 안내 ----------
  function drawGuide() {
    if (opts.onCover) requestAnimationFrame(() => { if (!closed) opts.onCover(root.getBoundingClientRect().height); });
    guideEl.hidden = !song;
    if (!song) { guideEl.replaceChildren(); return; }
    const n = song.notes.length;
    if (idx >= n) {
      guideEl.replaceChildren(
        h('b', { class: 'pn-done' }, '🎉 끝까지 쳤어요! 정말 잘했어요.'),
        h('div', { class: 'pn-gbtns' },
          h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => setSong(song) }, '처음부터 다시'),
          h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => playDemo() }, '들어 보기')));
      return;
    }
    const next = song.notes.slice(idx, idx + 7).map(([m], i) => h('span', { class: 'pn-chip' + (i === 0 ? ' now' : '') }, noteName(m)));
    guideEl.replaceChildren(
      h('div', { class: 'pn-next' }, h('span', { class: 'pn-lbl' }, demo ? '들려주는 중' : '다음 음'), next),
      h('div', { class: 'pn-prog', 'aria-label': `${idx} / ${n}` }, h('i', { style: `width:${Math.round((idx / n) * 100)}%` })),
      h('div', { class: 'pn-gbtns' },
        h('span', { class: 'pn-count' }, `${idx} / ${n}`),
        demo
          ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => stopDemo(true) }, '그만 듣기')
          : h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => playDemo() }, '들어 보기')));
  }
  function playDemo() {
    stopDemo();
    idx = 0;
    doneShown = false;
    const notes = song.notes, beat = song.beat;
    let t = 300, i = 0;
    demo = { timers: [], releases: new Set() };
    for (const [m, d] of notes) {
      const k = i++;
      demo.timers.push(setTimeout(() => {
        if (!demo) return;
        showNote(m);
        const rel = pianoKey(m, { vel: 0.8 });
        demo.releases.add(rel);
        press(m, true);
        demo.cur = k;
        drawGuideDemo(k);
        demo.timers.push(setTimeout(() => { rel(); demo && demo.releases.delete(rel); press(m, false); }, Math.max(120, d * beat * 1000 * 0.9)));
      }, t));
      t += d * beat * 1000;
    }
    demo.timers.push(setTimeout(() => stopDemo(true), t + 200));
    drawGuide();
  }
  function drawGuideDemo(k) {
    const chips = guideEl.querySelectorAll('.pn-chip');
    // 들려주는 동안에는 지금 나는 음부터 보여 준다
    const next = song.notes.slice(k, k + 7).map(([m], i) => h('span', { class: 'pn-chip' + (i === 0 ? ' now' : '') }, noteName(m)));
    const row = guideEl.querySelector('.pn-next');
    if (row && chips) row.replaceChildren(h('span', { class: 'pn-lbl' }, '들려주는 중'), next);
    const bar = guideEl.querySelector('.pn-prog i');
    if (bar) bar.style.width = `${Math.round(((k + 1) / song.notes.length) * 100)}%`;
  }
  function stopDemo(redraw = false) {
    if (!demo) return;
    for (const t of demo.timers) clearTimeout(t);
    for (const r of demo.releases) r();
    demo = null;
    held.clear();
    for (const [, d] of down) held.set(d.m, (held.get(d.m) || 0) + 1);
    idx = 0;
    if (redraw && song) { drawGuide(); showNote(song.notes[0][0]); }
    paint();
  }

  // ---------- 건반 그리기 ----------
  function layout() {
    const w = keysEl.clientWidth || root.clientWidth || window.innerWidth;
    const want = w < 520 ? 34 : 44; // 휴대폰은 조금 좁게
    count = Math.max(8, Math.min(WHITES.length, Math.floor(w / want)));
    if (count >= WHITES.length) start = LOW;
    else if (WHITES.indexOf(start) < 0 || WHITES.indexOf(start) + count > WHITES.length) start = WHITES[Math.max(0, WHITES.length - count)];
    draw();
  }
  function visibleWhites() { const i = WHITES.indexOf(start); return WHITES.slice(i, i + count); }
  function draw() {
    const ws = visibleWhites();
    const wPct = 100 / ws.length;
    const kids = [];
    ws.forEach((m, i) => {
      const off = m - base;
      const ch = fine && KEYCHAR[off] ? KEYCHAR[off] : '';
      kids.push(h('div', { class: 'pn-w' + (m % 12 === 0 ? ' c' : ''), 'data-m': String(m), role: 'button', 'aria-label': noteName(m) },
        ch ? h('i', { class: 'pn-kb' }, ch) : null,
        h('span', {}, noteName(m)),
        m === 60 ? h('em', { class: 'pn-mid', title: '가운데 도' }) : null));
    });
    ws.forEach((m, i) => {
      if (i === ws.length - 1 || !isBlack(m + 1)) return;
      const off = m + 1 - base;
      const ch = fine && KEYCHAR[off] ? KEYCHAR[off] : '';
      kids.push(h('div', { class: 'pn-b', 'data-m': String(m + 1), role: 'button', 'aria-label': noteName(m + 1), style: `left:calc(${(i + 1) * wPct}% - ${wPct * 0.31}%);width:${wPct * 0.62}%` },
        ch ? h('i', { class: 'pn-kb' }, ch) : null));
    });
    keysEl.replaceChildren(...kids);
    if (opts.onCover) requestAnimationFrame(() => { if (!closed) opts.onCover(root.getBoundingClientRect().height); });
    lowBtn.disabled = start <= LOW;
    highBtn.disabled = WHITES.indexOf(start) + count >= WHITES.length;
    paint();
  }
  function paint() {
    const target = song && !demo && idx < song.notes.length ? song.notes[idx][0] : null;
    for (const k of keysEl.children) {
      const m = Number(k.dataset.m);
      k.classList.toggle('on', (held.get(m) || 0) > 0);
      k.classList.toggle('next', m === target);
    }
  }
  function shift(dir) {
    const i = WHITES.indexOf(start);
    const j = Math.max(0, Math.min(WHITES.length - count, i + dir * 7));
    start = WHITES[j];
    base = Math.max(LOW, Math.min(HIGH - 12, base + dir * 12));
    draw();
  }
  // 안 보이는 음이면 보이게 옮긴다 (따라 치기)
  function showNote(m) {
    const ws = visibleWhites();
    const lo = ws[0], hi = ws[ws.length - 1];
    if (m >= lo && m <= hi) return;
    const white = isBlack(m) ? m - 1 : m;
    let i = WHITES.indexOf(white) - Math.floor(count / 2);
    i = Math.max(0, Math.min(WHITES.length - count, i));
    start = WHITES[i];
    draw();
  }
  function setPedal(on) {
    pedal = on;
    pedalBtn.setAttribute('aria-pressed', String(on));
    pedalBtn.classList.toggle('on', on);
  }

  // ---------- 소리 내기 ----------
  function press(m, on) {
    held.set(m, Math.max(0, (held.get(m) || 0) + (on ? 1 : -1)));
    const k = keysEl.querySelector(`[data-m="${m}"]`);
    if (k) k.classList.toggle('on', held.get(m) > 0);
  }
  function noteOn(who, m) {
    if (m < LOW || m > HIGH) return;
    noteOff(who);
    quiet.hidden = pianoReady();
    const release = pianoKey(m, { vel: 0.9 });
    down.set(who, { m, release });
    press(m, true);
    if (opts.onPlay) opts.onPlay(m);
    if (song && !demo && idx < song.notes.length) {
      if (m === song.notes[idx][0]) {
        idx += 1;
        if (idx >= song.notes.length) {
          drawGuide();
          if (!doneShown) { doneShown = true; if (opts.onDone) opts.onDone(song); }
        } else { showNote(song.notes[idx][0]); drawGuide(); }
      } else {
        const t = keysEl.querySelector('.next');
        if (t) { t.classList.remove('wiggle'); void t.offsetWidth; t.classList.add('wiggle'); }
      }
      paint();
    }
  }
  function noteOff(who) {
    const d = down.get(who);
    if (!d) return;
    down.delete(who);
    if (!pedal) d.release();
    press(d.m, false);
  }
  const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); const k = el && el.closest && el.closest('[data-m]'); return k && keysEl.contains(k) ? Number(k.dataset.m) : null; };
  keysEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { keysEl.setPointerCapture(e.pointerId); } catch (err) { /* 그대로 */ }
    const m = keyAt(e.clientX, e.clientY);
    if (m != null) noteOn('p' + e.pointerId, m);
  });
  keysEl.addEventListener('pointermove', (e) => {
    const d = down.get('p' + e.pointerId);
    if (!d) return;
    const m = keyAt(e.clientX, e.clientY);
    if (m != null && m !== d.m) noteOn('p' + e.pointerId, m); // 누른 채 밀면 옆 건반도 친다
  });
  const up = (e) => noteOff('p' + e.pointerId);
  keysEl.addEventListener('pointerup', up);
  keysEl.addEventListener('pointercancel', up);
  keysEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // 컴퓨터 자판 (피아노를 치는 동안에는 마을 움직임 자판을 쓰지 않는다)
  const onKey = (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    e.stopImmediatePropagation();
    if (e.code in KEYMAP) {
      e.preventDefault();
      if (!e.repeat) noteOn('k' + e.code, base + KEYMAP[e.code]);
    } else if (e.code === 'KeyZ' || e.code === 'KeyX') {
      e.preventDefault();
      if (!e.repeat) { base = Math.max(LOW, Math.min(HIGH - 12, base + (e.code === 'KeyZ' ? -12 : 12))); showNote(base); showNote(Math.min(HIGH, base + 12)); draw(); }
    }
  };
  const onKeyUp = (e) => { if (e.code in KEYMAP) { e.stopImmediatePropagation(); noteOff('k' + e.code); } };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  // 마을에서 일어나 걸어가면 피아노를 닫는다
  const watch = setInterval(() => { if (opts.standing && opts.standing()) close(); }, 400);

  function close() {
    if (closed) return;
    closed = true;
    stopDemo();
    for (const who of [...down.keys()]) { const d = down.get(who); d.release(); down.delete(who); }
    clearInterval(watch);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('resize', onResize);
    root.remove();
    document.body.classList.remove('piano-on');
    if (opts.onClose) opts.onClose();
  }

  drawSongs();
  quiet.hidden = pianoReady();
  layout();
  requestAnimationFrame(layout); // 처음 그릴 때 너비가 정해진 뒤 다시
  return { close, get open() { return !closed; } };
}
