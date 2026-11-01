// 진숲 어린이 마을 — 그림 공방 (그리기, 마을 전시관, 내 그림)
import { h, modal, toast, confetti, showImage } from './ui.js';
import { message } from './api.js';
import { reactionBar } from './social.js';
import { toJpeg, jpegUrl } from './images.js';
import { sfx } from './sound.js';
import { createPainter, PW, PH, COLORS, TOOLS, STAMPS, SHAPE_LIST, stampIcon } from './paint.js';
import { cleanChat, CHAT_MAX } from './chatfilter.js';

export function createArt({ rpc, getToken, onSessionLost, onCelebrate, onShared, onSaved, features = () => ({}) }) {
  let view = 'draw';
  let paper = null, used = false, painter = null;
  const tool = { color: COLORS[6], size: 10, tool: 'brush', shape: 'circle', stamp: 'star', filled: true };
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
  function go(id) {
    view = id;
    document.getElementById('modal').classList.toggle('paint-sheet', id === 'draw');
    if (id === 'draw') draw(); else if (id === 'gallery') gallery(); else mine();
  }

  function newPaper() {
    paper = document.createElement('canvas');
    paper.width = PW; paper.height = PH;
    const c = paper.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, PW, PH);
    used = false;
    if (painter) { painter.destroy(); painter = null; }
  }

  function draw() {
    modal.setTitle('그림 공방');
    if (!paper) newPaper();
    if (painter) painter.destroy();
    const zoomLabel = h('span', { class: 'zoom-num' }, '100%');
    const undoBtn = h('button', { class: 'tool', type: 'button', onclick: () => { if (painter.undo()) sfx.pop(true); refreshActs(); } }, '↩️ 되돌리기');
    const redoBtn = h('button', { class: 'tool', type: 'button', onclick: () => { if (painter.redo()) sfx.pop(true); refreshActs(); } }, '↪️ 다시 하기');
    const refreshActs = () => {
      undoBtn.disabled = !painter.canUndo;
      redoBtn.disabled = !painter.canRedo;
      zoomLabel.textContent = `${Math.round(painter.zoom * 100)}%`;
    };
    painter = createPainter(paper, tool, { onChange: (drew) => { if (drew) used = true; refreshActs(); } });
    window.kvPainter = painter;
    const zoomBar = h('div', { class: 'zoom-bar', 'data-quiet': '' },
      h('button', { type: 'button', 'aria-label': '크게 보기', onclick: () => painter.zoomIn() }, '＋'),
      zoomLabel,
      h('button', { type: 'button', 'aria-label': '작게 보기', onclick: () => painter.zoomOut() }, '－'),
      h('button', { type: 'button', class: 'wide', onclick: () => painter.fitAll() }, '전체'));
    const board = h('div', { class: 'paint-wrap' }, painter.el, zoomBar);

    const toolRow = h('div', { class: 'tool-row' });
    const subRow = h('div', { class: 'sub-row' });
    const colorRow = h('div', { class: 'swatches' });
    const sizeDot = h('i', { class: 'size-dot' });
    const size = h('input', { type: 'range', min: 1, max: 60, value: tool.size, 'aria-label': '굵기' });
    const showSize = () => { const d = Math.max(4, Math.min(44, tool.size * (tool.tool === 'stamp' ? 1.2 : 0.9))); sizeDot.style.width = sizeDot.style.height = `${d}px`; sizeDot.style.background = tool.color; };
    size.addEventListener('input', () => { tool.size = +size.value; showSize(); });

    function drawTools() {
      toolRow.replaceChildren(...TOOLS.map(([id, ic, label]) => h('button', {
        class: 'tool big' + (tool.tool === id ? ' on' : ''), type: 'button', 'aria-pressed': String(tool.tool === id), 'data-tool': id,
        onclick: () => { tool.tool = id; drawTools(); },
      }, h('span', { class: 'ic', 'aria-hidden': 'true' }, ic), label)));
      if (tool.tool === 'shape') {
        subRow.hidden = false;
        subRow.replaceChildren(
          ...SHAPE_LIST.map(([id, label]) => h('button', { class: 'tool' + (tool.shape === id ? ' on' : ''), type: 'button', onclick: () => { tool.shape = id; drawTools(); } }, label)),
          h('button', { class: 'tool' + (tool.filled ? ' on' : ''), type: 'button', onclick: () => { tool.filled = !tool.filled; drawTools(); } }, tool.filled ? '속까지 칠하기' : '테두리만'));
      } else if (tool.tool === 'stamp') {
        subRow.hidden = false;
        subRow.replaceChildren(...STAMPS.map(([id, label]) => h('button', {
          class: 'pstamp' + (tool.stamp === id ? ' on' : ''), type: 'button', 'aria-label': `${label} 도장`, title: label,
          onclick: () => { tool.stamp = id; drawTools(); },
        }, stampIcon(id, tool.color, 30))));
      } else if (tool.tool === 'hand') {
        subRow.hidden = false;
        subRow.replaceChildren(h('p', { class: 'hint-line' }, '크게 본 그림을 손가락으로 끌어 옮겨요. 두 손가락으로 벌리면 크게, 오므리면 작게 보여요.'));
      } else { subRow.hidden = true; subRow.replaceChildren(); }
      showSize();
    }
    function drawColors() {
      const custom = h('input', { type: 'color', value: tool.color, 'aria-label': '다른 색 고르기', class: 'sw custom' });
      custom.addEventListener('input', () => { tool.color = custom.value; drawColors(); if (tool.tool === 'stamp') drawTools(); });
      colorRow.replaceChildren(...COLORS.map((c) => h('button', {
        class: 'sw' + (tool.color.toLowerCase() === c.toLowerCase() ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': `색 ${c}`,
        onclick: () => { tool.color = c; if (tool.tool === 'eraser' || tool.tool === 'hand') tool.tool = 'brush'; drawColors(); drawTools(); },
      })), custom);
      showSize();
    }
    drawTools();
    drawColors();
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
      let savedB64 = null;
      try {
        const big = toJpeg(paper, { maxSide: 800, quality: 0.85, maxBytes: 300000 });
        const small = toJpeg(paper, { maxSide: 240, quality: 0.75, maxBytes: 28000 });
        await rpc('kids_art_save', { p_token: getToken(), p_title: title.value, p_image: big.b64, p_thumb: small.b64, p_shared: share.checked });
        savedB64 = big.b64;
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
      if (onSaved) onSaved(savedB64);
      newPaper();
      draft.title = '';
      go(share.checked ? 'gallery' : 'mine');
    });
    // 넓은 화면: 왼쪽 그림판, 오른쪽 도구 / 좁은 화면: 위아래
    modal.setBody(h('div', { class: 'mem game art' },
      tabs(),
      h('div', { class: 'art-layout' },
        board,
        h('div', { class: 'art-side' },
          toolRow,
          subRow,
          colorRow,
          h('div', { class: 'size-row' }, h('span', {}, '굵기'), size, h('span', { class: 'size-box' }, sizeDot)),
          h('div', { class: 'tools' }, undoBtn, redoBtn,
            h('button', { class: 'tool', type: 'button', onclick: () => { painter.clear(); refreshActs(); } }, '🗑️ 다 지우기')),
          h('div', { class: 'art-save' }, title,
            h('label', { class: 'check' }, share, h('span', {}, '마을 전시관에 걸기')),
            err,
            h('div', { class: 'row end' }, save))))));
    requestAnimationFrame(() => { painter.layout(); refreshActs(); });
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
    if (features().comments) body.push(h('button', { class: 'btn btn-soft btn-small cmt-open', type: 'button', onclick: () => comments(it, view) }, '💬 댓글 보기·쓰기'));
    return h('article', { class: 'art-card' + (it.me ? ' me' : '') }, body);
  }

  // 그림 한 장과 댓글
  async function comments(it, back) {
    const backTo = back || 'gallery';
    view = 'comments';
    modal.setTitle(it.title || '제목 없는 그림');
    const img = h('img', { class: 'cmt-img', src: jpegUrl(it.thumb), alt: it.title || '' });
    const list = h('div', { class: 'cmt-list', 'aria-live': 'polite' }, h('p', { class: 'hint-line' }, '댓글을 불러오고 있어요…'));
    const input = h('input', { type: 'text', maxlength: CHAT_MAX, autocomplete: 'off', enterkeyhint: 'send', placeholder: '그림에 남길 말 (선생님도 볼 수 있어요)', 'aria-label': '댓글' });
    const form = h('form', { class: 'say-write' }, input, h('button', { class: 'btn btn-go btn-small', type: 'submit', 'data-quiet': '' }, '남기기'));
    const draw = (rows) => {
      list.replaceChildren(...(rows.length ? rows.map((c) => h('p', { class: 'cmt' + (c.me ? ' me' : '') }, h('b', {}, c.name || '친구'), ' ', c.body)) : [h('p', { class: 'fb-empty' }, '아직 댓글이 없어요. 첫 댓글을 남겨 볼까요?')]));
      list.scrollTop = list.scrollHeight;
    };
    let sending = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!cleanChat(input.value) || sending) return;
      sending = true;
      try {
        const rows = await rpc('kids_art_comment_add', { p_token: getToken(), p_art: it.id, p_text: input.value });
        input.value = '';
        sfx.pop();
        draw(rows || []);
      } catch (err) { fail(err); } finally { sending = false; }
    });
    modal.setBody(h('div', { class: 'mem game art' }, tabs(),
      h('div', { class: 'cmt-wrap' },
        h('button', { class: 'cmt-pic', type: 'button', 'aria-label': '그림 크게 보기', onclick: async () => {
          const close = showImage(jpegUrl(it.thumb), '불러오는 중…');
          try { const r = await rpc('kids_art_get', { p_token: getToken(), p_id: it.id }); close(); showImage(jpegUrl(r.image), it.title ? `${it.name} · ${it.title}` : it.name); } catch (err) { close(); fail(err); }
        } }, img),
        h('p', { class: 'cmt-by' }, `${it.name || '친구'}의 그림`)),
      list, form,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-plain', type: 'button', onclick: () => go(backTo) }, backTo === 'mine' ? '내 그림으로' : '전시관으로'))));
    try { draw(await rpc('kids_art_comments', { p_token: getToken(), p_art: it.id })); } catch (err) { if (!fail(err)) list.replaceChildren(h('p', { class: 'fb-empty' }, '댓글을 불러오지 못했어요.')); }
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

  function open(start = 'draw', { onClose = null } = {}) {
    modal.open('그림 공방', h('div'), { cls: 'game-sheet', onClose });
    go(start);
  }
  return { open };
}
