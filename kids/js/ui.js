// 진숲 어린이 마을 — 화면 도우미 (요소 만들기, 창, 알림, 아이콘)
import { sfx } from './sound.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ICONS = {
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5C5.5 4.3 8.6 4.4 12 6.2c3.4-1.8 6.5-1.9 9-.7v13c-2.5-1.2-5.6-1.1-9 .7-3.4-1.8-6.5-1.9-9-.7z" fill="currentColor" opacity=".25"/><path d="M12 6.2v13M3 5.5C5.5 4.3 8.6 4.4 12 6.2c3.4-1.8 6.5-1.9 9-.7v13c-2.5-1.2-5.6-1.1-9 .7-3.4-1.8-6.5-1.9-9-.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  shirt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 3.5 4 6l1.8 4 2.2-1v11.5h8V9l2.2 1L20 6l-4.5-2.5c-.6 1.5-1.9 2.3-3.5 2.3S9.1 5 8.5 3.5z" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  door: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20.5V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v15.5" fill="currentColor" opacity=".25"/><path d="M4 20.5h16M6 20.5V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v15.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="14.5" cy="12.5" r="1.2" fill="currentColor"/></svg>',
  apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5c-1.6-1.2-4.8-1.4-6.4 1-1.8 2.7-.6 7.2 1.6 9.7 1.3 1.5 2.6 2 4.8 1.2 2.2.8 3.5.3 4.8-1.2 2.2-2.5 3.4-7 1.6-9.7-1.6-2.4-4.8-2.2-6.4-1z" fill="#EF6461"/><path d="M12 7.6c.1-1.7.6-3 1.6-4" stroke="#6B4429" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M13.4 5.2c1.4-1.6 3.4-1.7 4.6-1-1 1.6-2.8 2.3-4.6 1z" fill="#6CC24A"/><ellipse cx="8.7" cy="10.6" rx="1.2" ry="1.8" fill="#fff" opacity=".55"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  leaf: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29V15" stroke="#6B4429" stroke-width="2.4" stroke-linecap="round"/><path d="M16 16C9 16 4.5 11.5 4.5 5.5 11.5 5.5 16 9 16 16z" fill="#6CC24A"/><path d="M16 13.5c.5-6 4.5-9.8 11.5-9.8 0 6-4.6 10-11.5 9.8z" fill="#8BD46A"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.7 5.9 6.4.7-4.8 4.3 1.3 6.4L12 16.9l-5.6 3.2 1.3-6.4L2.9 9.4l6.4-.7z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};
export function icon(name, cls = 'ico') {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = ICONS[name] || '';
  return s;
}

// ---------- 창 ----------
let modalClose = null;
export const modal = {
  open(title, content, { cls = '', onClose = null } = {}) {
    const m = document.getElementById('modal');
    m.className = 'modal ' + cls;
    document.getElementById('modalTitle').textContent = title;
    this.setBody(content);
    if (m.hidden) sfx.open();
    m.hidden = false;
    modalClose = onClose;
    requestAnimationFrame(() => m.classList.add('show'));
  },
  setTitle(t) { document.getElementById('modalTitle').textContent = t; },
  setBody(content) {
    const b = document.getElementById('modalBody');
    b.replaceChildren(content);
    b.scrollTop = 0;
  },
  close() {
    const m = document.getElementById('modal');
    if (m.hidden) return;
    m.classList.remove('show');
    m.hidden = true;
    sfx.close();
    const cb = modalClose;
    modalClose = null;
    if (cb) cb();
  },
  get isOpen() { return !document.getElementById('modal').hidden; },
};

let toastTimer = null;
export function toast(text, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function confetti() {
  sfx.success();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div', { class: 'confetti' });
  const cols = ['#EF6461', '#F6D55C', '#5DB760', '#7EC8F2', '#F6A2C4', '#A07FE3'];
  for (let i = 0; i < 46; i++) {
    const p = h('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[i % cols.length];
    p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    p.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + 's';
    p.style.setProperty('--x', (Math.random() * 120 - 60).toFixed(0) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3400);
}

// 받침 있는 글자인지 (한국어 조사 고르기)
export function hasBatchim(word) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}
export const josa = (word, withB, withoutB) => `${word}${hasBatchim(word) ? withB : withoutB}`;

// 사진·그림 크게 보기 (창 위에 한 겹 더)
export function showImage(url, caption = '') {
  sfx.pop(true);
  const close = () => { layer.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const layer = h('div', { class: 'viewer', role: 'dialog', 'aria-label': caption || '크게 보기', onclick: close },
    h('img', { src: url, alt: caption || '' }),
    caption ? h('p', {}, caption) : null,
    h('button', { class: 'viewer-x', type: 'button', 'aria-label': '닫기' }, '×'));
  window.addEventListener('keydown', onKey, true);
  document.body.append(layer);
  return close;
}
