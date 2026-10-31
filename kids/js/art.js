// 진숲 어린이 마을 — 그림 공방 (그리기, 마을 전시관, 내 그림)
import { h, modal, toast, confetti, showImage } from './ui.js';
import { message } from './api.js';
import { reactionBar } from './social.js';
import { toJpeg, jpegUrl } from './images.js';

const W = 800, H = 600;
const COLORS = ['#2E2A2A', '#7A5233', '#EF6461', '#F49A4C', '#F6D55C', '#5DB760', '#2F8F5B', '#7EC8F2', '#3F6FD8', '#A07FE3', '#F6A2C4', '#FFFFFF'];
const SIZES = [['가늘게', 5], ['보통', 12], ['굵게', 26]];

// 같은 색 영역 채우기
function floodFill(ctx, x, y, hex) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (i, j) => (j * W + i) * 4;
  const s = at(x, y);
  const target = [d[s], d[s + 1], d[s + 2]];
  const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const same = (p) => Math.abs(d[p] - target[0]) + Math.abs(d[p + 1] - target[1]) + Math.abs(d[p + 2] - target[2]) < 60;
  if (Math.abs(target[0] - c[0]) + Math.abs(target[1] - c[1]) + Math.abs(target[2] - c[2]) < 6) return false;
  const stack = [[x, y]];
  const seen = new Uint8Array(W * H);
  while (stack.length) {
    const [px, py] = stack.pop();
    let i = px;
    while (i >= 0 && !seen[py * W + i] && same(at(i, py))) i--;
    i++;
    let up = false, down = false;
    while (i < W && !seen[py * W + i] && same(at(i, py))) {
      const p = at(i, py);
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      seen[py * W + i] = 1;
      if (py > 0) { const u = !seen[(py - 1) * W + i] && same(at(i, py - 1)); if (u && !up) stack.push([i, py - 1]); up = u; }
      if (py < H - 1) { const dn = !seen[(py + 1) * W + i] && same(at(i, py + 1)); if (dn && !down) stack.push([i, py + 1]); down = dn; }
      i++;
    }
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

export function createArt({ rpc, getToken, onSessionLost, onCelebrate, onShared }) {
  let view = 'draw';
  let paper = null, pctx = null, undo = [], used = false;
  let tool = { color: COLORS[2], size: 12, mode: 'pen' };
  const draft = { title: '', share: true };

  const fail = (e) => {
    if (e.code === 'SESSION') { modal.close(); onSessionLost(); return true; }
    toast(message(e));
    return false;
  };

  function tabs() {
    const t = (id, label) => h('button', { class: 'tab' + (view === id ? ' on' : ''), type: 'button', 'aria-pressed': String(view === id), onclick: () => go(id) }, label);
    return h('div', { class: 'art-tabs' }, t('draw', '그리기'), t('gallery', '마을 전시관'), t('mine', '내 그림'));
  }
  function go(id) { view = id; if (id === 'draw') draw(); else if (id === 'gallery') gallery(); else mine(); }

  function newPaper() {
    paper = document.createElement('canvas');
    paper.width = W; paper.height = H;
    pctx = paper.getContext('2d');
    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(0, 0, W, H);
    undo = [];
    used = false;
  }

  function draw() {
    modal.setTitle('그림 공방');
    if (!paper) newPaper();
    const cv = h('canvas', { class: 'art-cv', width: W, height: H, 'aria-label': '그림판' });
    const cx = cv.getContext('2d');
    const show = () => cx.drawImage(paper, 0, 0);
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [Math.max(0, Math.min(W - 1, Math.round(((e.clientX - r.left) / r.width) * W))), Math.max(0, Math.min(H - 1, Math.round(((e.clientY - r.top) / r.height) * H)))];
    };
    const snap = () => { undo.push(pctx.getImageData(0, 0, W, H)); if (undo.length > 15) undo.shift(); };
    let last = null;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const [x, y] = pos(e);
      if (tool.mode === 'fill') {
        snap();
        if (floodFill(pctx, x, y, tool.color)) { used = true; show(); } else undo.pop();
        return;
      }
      cv.setPointerCapture(e.pointerId);
      snap();
      last = [x, y];
      pctx.strokeStyle = tool.mode === 'eraser' ? '#FFFFFF' : tool.color;
      pctx.fillStyle = pctx.strokeStyle;
      pctx.lineWidth = tool.mode === 'eraser' ? tool.size * 2 : tool.size;
      pctx.lineCap = 'round';
      pctx.lineJoin = 'round';
      pctx.beginPath(); pctx.arc(x, y, pctx.lineWidth / 2, 0, 7); pctx.fill();
      used = true;
      show();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const [x, y] = pos(e);
      pctx.beginPath(); pctx.moveTo(last[0], last[1]); pctx.lineTo(x, y); pctx.stroke();
      last = [x, y];
      show();
    });
    const end = () => { last = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    const swatches = h('div', { class: 'swatches' }, COLORS.map((c) => h('button', {
      class: 'sw' + (tool.color === c && tool.mode !== 'eraser' ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': `색 ${c}`,
      onclick: () => { tool.color = c; if (tool.mode === 'eraser') tool.mode = 'pen'; draw(); },
    })));
    const toolBtn = (mode, label) => h('button', { class: 'tool' + (tool.mode === mode ? ' on' : ''), type: 'button', 'aria-pressed': String(tool.mode === mode), onclick: () => { tool.mode = mode; draw(); } }, label);
    const sizes = h('div', { class: 'tools' }, SIZES.map(([label, s]) => h('button', {
      class: 'tool' + (tool.size === s ? ' on' : ''), type: 'button', 'aria-pressed': String(tool.size === s), onclick: () => { tool.size = s; draw(); },
    }, h('i', { class: 'dot', style: `width:${Math.max(6, s / 1.4)}px;height:${Math.max(6, s / 1.4)}px` }), label)));
    const title = h('input', { class: 'art-title', maxlength: 20, placeholder: '그림 제목 (쓰지 않아도 돼요)', 'aria-label': '그림 제목' });
    title.value = draft.title;
    title.addEventListener('input', () => { draft.title = title.value; });
    const share = h('input', { type: 'checkbox' });
    share.checked = draft.share;
    share.addEventListener('change', () => { draft.share = share.checked; });
    const err = h('p', { class: 'err', role: 'alert' });
    const save = h('button', { class: 'btn btn-go', type: 'button' }, '다 그렸어요!');
    save.addEventListener('click', async () => {
      if (!used) { toast('먼저 그림을 그려 볼까요?'); return; }
      save.disabled = true;
      save.textContent = '거는 중…';
      try {
        const big = toJpeg(paper, { maxSide: 800, quality: 0.85, maxBytes: 300000 });
        const small = toJpeg(paper, { maxSide: 240, quality: 0.75, maxBytes: 28000 });
        await rpc('kids_art_save', { p_token: getToken(), p_title: title.value, p_image: big.b64, p_thumb: small.b64, p_shared: share.checked });
      } catch (e) {
        save.disabled = false;
        save.textContent = '다 그렸어요!';
        if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
        err.textContent = { ART_FULL: '그림을 40장까지 둘 수 있어요. 내 그림에서 하나를 지우고 다시 해 봐요.', ART_DAY: '오늘은 그림을 10장 그렸어요. 내일 또 그려요!' }[e.code] || message(e);
        return;
      }
      confetti();
      onCelebrate();
      toast(share.checked ? '마을 전시관에 그림을 걸었어요!' : '내 그림에 넣어 두었어요');
      if (share.checked && onShared) onShared();
      newPaper();
      draft.title = '';
      go(share.checked ? 'gallery' : 'mine');
    });
    modal.setBody(h('div', { class: 'mem game art' },
      tabs(),
      h('div', { class: 'art-board' }, cv),
      swatches,
      h('div', { class: 'tools' },
        toolBtn('pen', '붓'), toolBtn('fill', '채우기'), toolBtn('eraser', '지우개'),
        h('button', { class: 'tool', type: 'button', onclick: () => { if (undo.length) { pctx.putImageData(undo.pop(), 0, 0); show(); } } }, '되돌리기'),
        h('button', { class: 'tool', type: 'button', onclick: () => { snap(); pctx.fillStyle = '#FFFFFF'; pctx.fillRect(0, 0, W, H); show(); } }, '다 지우기')),
      sizes,
      h('div', { class: 'art-save' }, title,
        h('label', { class: 'check' }, share, h('span', {}, '마을 전시관에 걸기')),
        err,
        h('div', { class: 'row end' }, save))));
    show();
  }

  function card(it, { mine: isMine = false, onChange } = {}) {
    const open = async () => {
      const close = showImage(jpegUrl(it.thumb), '불러오는 중…');
      try {
        const r = await rpc('kids_art_get', { p_token: getToken(), p_id: it.id });
        close();
        showImage(jpegUrl(r.image), it.title ? `${it.name} · ${it.title}` : it.name);
      } catch (e) { close(); fail(e); }
    };
    const body = [
      h('button', { class: 'art-thumb', type: 'button', 'aria-label': `${it.name}의 그림 크게 보기`, onclick: open }, h('img', { src: jpegUrl(it.thumb), alt: it.title || '' })),
      h('div', { class: 'art-meta' }, h('b', {}, it.title || '제목 없는 그림'), h('span', {}, it.name)),
    ];
    if (isMine) {
      const del = h('button', { class: 'btn btn-plain btn-small', type: 'button' }, '지우기');
      del.addEventListener('click', async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = '정말 지울까요?'; return; }
        try { await rpc('kids_art_delete', { p_token: getToken(), p_id: it.id }); } catch (e) { fail(e); return; }
        toast('그림을 지웠어요');
        onChange();
      });
      const sw = h('input', { type: 'checkbox', checked: it.shared });
      sw.addEventListener('change', async () => {
        try { await rpc('kids_art_update', { p_token: getToken(), p_id: it.id, p_shared: sw.checked }); } catch (e) { sw.checked = !sw.checked; fail(e); return; }
        toast(sw.checked ? '전시관에 걸었어요' : '전시관에서 내렸어요');
        if (sw.checked && onShared) onShared();
      });
      body.push(h('label', { class: 'check small' }, sw, h('span', {}, '전시관에 걸기')));
      if (it.hidden) body.push(h('p', { class: 'fb-note' }, '선생님이 이 그림을 친구들에게 보이지 않게 해 두었어요.'));
      body.push(del);
    } else {
      body.push(reactionBar({ ...it, key: it.id }, { kind: 'art', key: it.id, rpc, getToken, onSessionLost }));
    }
    return h('article', { class: 'art-card' + (it.me ? ' me' : '') }, body);
  }

  async function gallery() {
    modal.setTitle('마을 전시관');
    modal.setBody(h('div', { class: 'mem game art' }, tabs(), h('p', { class: 'empty-big' }, '그림을 꺼내고 있어요…')));
    let list;
    try { list = await rpc('kids_art_list', { p_token: getToken(), p_mine: false }); } catch (e) { fail(e); return; }
    if (view !== 'gallery') return;
    modal.setBody(h('div', { class: 'mem game art' }, tabs(),
      list.length ? h('div', { class: 'art-grid' }, list.map((it) => card(it))) : h('p', { class: 'fb-empty' }, '아직 걸린 그림이 없어요. 첫 그림을 걸어 볼까요?')));
  }

  async function mine() {
    modal.setTitle('내 그림');
    let list;
    try { list = await rpc('kids_art_list', { p_token: getToken(), p_mine: true }); } catch (e) { fail(e); return; }
    if (view !== 'mine') return;
    modal.setBody(h('div', { class: 'mem game art' }, tabs(),
      h('p', { class: 'hint-line' }, `내 그림 ${list.length} / 40장`),
      list.length ? h('div', { class: 'art-grid' }, list.map((it) => card(it, { mine: true, onChange: mine }))) : h('p', { class: 'fb-empty' }, '아직 그린 그림이 없어요.')));
  }

  function open(start = 'draw') {
    modal.open('그림 공방', h('div'), { cls: 'game-sheet' });
    go(start);
  }
  return { open };
}
