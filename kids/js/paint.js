// 진숲 어린이 마을 — 그림판 (연필, 펜, 붓, 크레파스, 마커, 스프레이, 채우기, 지우개, 모양, 도장, 확대·축소)
import { h } from './ui.js';
import { sfx } from './sound.js';

export const PW = 1000, PH = 750; // 종이 크기 (저장할 때는 800으로 줄인다)

export const COLORS = [
  '#2E2A2A', '#6B6B6B', '#FFFFFF', '#7A5233', '#C9875A', '#F6C9A0',
  '#EF6461', '#F49A4C', '#F6D55C', '#B5D86A', '#5DB760', '#2F8F5B',
  '#7EC8F2', '#3F6FD8', '#24356E', '#A07FE3', '#F6A2C4', '#E0457B',
];

export const TOOLS = [
  ['pencil', '✏️', '연필'], ['pen', '🖊️', '펜'], ['brush', '🖌️', '붓'], ['crayon', '🖍️', '크레파스'],
  ['marker', '🟨', '형광펜'], ['spray', '💨', '스프레이'], ['fill', '🪣', '채우기'], ['eraser', '🧽', '지우개'],
  ['shape', '🔷', '모양'], ['stamp', '⭐', '도장'], ['hand', '✋', '옮기기'],
];
const SHAPES = [['line', '선'], ['rect', '네모'], ['circle', '동그라미'], ['tri', '세모'], ['star', '별'], ['heart', '하트']];

// ---------- 도장 모양 (가운데 0,0, 크기 반지름 1 기준) ----------
function starPath(c, r1 = 1, r2 = 0.45, n = 5) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / n;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
}
function heartPath(c) {
  c.beginPath();
  c.moveTo(0, 0.9);
  c.bezierCurveTo(-1.1, 0.1, -1.0, -0.95, 0, -0.45);
  c.bezierCurveTo(1.0, -0.95, 1.1, 0.1, 0, 0.9);
  c.closePath();
}
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const ellipse = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };

export const STAMPS = [
  ['star', '별', (c, col) => { c.fillStyle = col; starPath(c); c.fill(); }],
  ['heart', '하트', (c, col) => { c.fillStyle = col; heartPath(c); c.fill(); }],
  ['flower', '꽃', (c, col) => {
    c.fillStyle = col;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; circle(c, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.42); }
    c.fillStyle = '#F6D55C'; circle(c, 0, 0, 0.32);
  }],
  ['sun', '해', (c, col) => {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 0.13; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 0.68, Math.sin(a) * 0.68); c.lineTo(Math.cos(a) * 0.98, Math.sin(a) * 0.98); c.stroke(); }
    circle(c, 0, 0, 0.52);
  }],
  ['cloud', '구름', (c, col) => { c.fillStyle = col; circle(c, -0.45, 0.15, 0.4); circle(c, 0, -0.1, 0.52); circle(c, 0.48, 0.12, 0.42); ellipse(c, 0, 0.3, 0.9, 0.28); }],
  ['tree', '나무', (c, col) => { c.fillStyle = '#7A5233'; c.fillRect(-0.13, 0.25, 0.26, 0.75); c.fillStyle = col; circle(c, 0, -0.15, 0.6); circle(c, -0.42, 0.12, 0.38); circle(c, 0.42, 0.12, 0.38); }],
  ['fish', '물고기', (c, col) => {
    c.fillStyle = col; ellipse(c, -0.1, 0, 0.7, 0.45);
    c.beginPath(); c.moveTo(0.45, 0); c.lineTo(1, -0.45); c.lineTo(1, 0.45); c.closePath(); c.fill();
    c.fillStyle = '#FFFFFF'; circle(c, -0.45, -0.1, 0.13); c.fillStyle = '#2E2A2A'; circle(c, -0.47, -0.1, 0.07);
  }],
  ['dove', '비둘기', (c, col) => {
    c.fillStyle = col; ellipse(c, 0.05, 0.15, 0.62, 0.34, -0.15); circle(c, -0.55, -0.15, 0.24);
    c.beginPath(); c.moveTo(-0.1, 0.05); c.quadraticCurveTo(0.2, -0.9, 0.75, -0.75); c.quadraticCurveTo(0.45, -0.25, 0.25, 0.1); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.55, 0.1); c.lineTo(1, -0.05); c.lineTo(0.95, 0.35); c.closePath(); c.fill();
    c.fillStyle = '#F49A4C'; c.beginPath(); c.moveTo(-0.78, -0.17); c.lineTo(-0.98, -0.1); c.lineTo(-0.76, -0.06); c.closePath(); c.fill();
    c.fillStyle = '#2E2A2A'; circle(c, -0.6, -0.2, 0.05);
  }],
  ['cross', '십자가', (c, col) => { c.fillStyle = col; c.fillRect(-0.15, -1, 0.3, 2); c.fillRect(-0.62, -0.55, 1.24, 0.3); }],
  ['rainbow', '무지개', (c) => {
    c.lineWidth = 0.13; c.lineCap = 'butt';
    ['#EF6461', '#F49A4C', '#F6D55C', '#5DB760', '#7EC8F2', '#3F6FD8', '#A07FE3'].forEach((cc, i) => {
      c.strokeStyle = cc; c.beginPath(); c.arc(0, 0.5, 0.95 - i * 0.12, Math.PI, 0); c.stroke();
    });
  }],
  ['butterfly', '나비', (c, col) => {
    c.fillStyle = col;
    ellipse(c, -0.45, -0.3, 0.42, 0.5, 0.5); ellipse(c, 0.45, -0.3, 0.42, 0.5, -0.5);
    ellipse(c, -0.35, 0.4, 0.3, 0.36, -0.4); ellipse(c, 0.35, 0.4, 0.3, 0.36, 0.4);
    c.fillStyle = '#2E2A2A'; ellipse(c, 0, 0.05, 0.08, 0.6);
  }],
  ['note', '음표', (c, col) => {
    c.fillStyle = col; ellipse(c, -0.3, 0.6, 0.33, 0.25, -0.4); c.fillRect(-0.02, -0.9, 0.13, 1.5);
    c.beginPath(); c.moveTo(0.1, -0.9); c.quadraticCurveTo(0.75, -0.6, 0.55, -0.05); c.quadraticCurveTo(0.6, -0.5, 0.1, -0.55); c.closePath(); c.fill();
  }],
  ['apple', '사과', (c, col) => {
    c.fillStyle = col; circle(c, -0.3, 0.15, 0.6); circle(c, 0.3, 0.15, 0.6);
    c.fillStyle = '#7A5233'; c.fillRect(-0.05, -0.75, 0.1, 0.35);
    c.fillStyle = '#5DB760'; ellipse(c, 0.28, -0.62, 0.25, 0.12, -0.5);
  }],
  ['house', '집', (c, col) => {
    c.fillStyle = col; c.fillRect(-0.7, -0.1, 1.4, 1.0);
    c.fillStyle = '#EF6461'; c.beginPath(); c.moveTo(-0.95, -0.05); c.lineTo(0, -0.95); c.lineTo(0.95, -0.05); c.closePath(); c.fill();
    c.fillStyle = '#7A5233'; c.fillRect(-0.18, 0.35, 0.36, 0.55);
  }],
  ['smile', '웃는 얼굴', (c, col) => {
    c.fillStyle = col; circle(c, 0, 0, 0.95);
    c.fillStyle = '#2E2A2A'; circle(c, -0.33, -0.2, 0.11); circle(c, 0.33, -0.2, 0.11);
    c.strokeStyle = '#2E2A2A'; c.lineWidth = 0.1; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0.05, 0.5, 0.3, Math.PI - 0.3); c.stroke();
  }],
  ['grass', '풀', (c, col) => {
    c.fillStyle = col;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.35 - 0.15, 0.9); c.quadraticCurveTo(i * 0.4, -0.2, i * 0.3 + (i % 2 ? 0.25 : -0.1), -0.9 + Math.abs(i) * 0.2); c.quadraticCurveTo(i * 0.35 + 0.05, 0.0, i * 0.35 + 0.15, 0.9); c.closePath(); c.fill(); }
  }],
];

// ---------- 같은 색 영역 채우기 ----------
function floodFill(ctx, x, y, hex) {
  const img = ctx.getImageData(0, 0, PW, PH);
  const d = img.data;
  const at = (i, j) => (j * PW + i) * 4;
  const s = at(x, y);
  const target = [d[s], d[s + 1], d[s + 2]];
  const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const same = (p) => Math.abs(d[p] - target[0]) + Math.abs(d[p + 1] - target[1]) + Math.abs(d[p + 2] - target[2]) < 60;
  if (Math.abs(target[0] - c[0]) + Math.abs(target[1] - c[1]) + Math.abs(target[2] - c[2]) < 6) return false;
  const stack = [[x, y]];
  const seen = new Uint8Array(PW * PH);
  while (stack.length) {
    const [px, py] = stack.pop();
    let i = px;
    while (i >= 0 && !seen[py * PW + i] && same(at(i, py))) i--;
    i++;
    let up = false, down = false;
    while (i < PW && !seen[py * PW + i] && same(at(i, py))) {
      const p = at(i, py);
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      seen[py * PW + i] = 1;
      if (py > 0) { const u = !seen[(py - 1) * PW + i] && same(at(i, py - 1)); if (u && !up) stack.push([i, py - 1]); up = u; }
      if (py < PH - 1) { const dn = !seen[(py + 1) * PW + i] && same(at(i, py + 1)); if (dn && !down) stack.push([i, py + 1]); down = dn; }
      i++;
    }
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

// 모양 그리기 (x0,y0)~(x1,y1) 상자 안에
function drawShape(c, kind, x0, y0, x1, y1, color, width, filled) {
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'line') { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore(); return; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
  if (rx < 1 || ry < 1) { c.restore(); return; }
  if (kind === 'rect') { c.beginPath(); c.rect(cx - rx, cy - ry, rx * 2, ry * 2); } else if (kind === 'circle') { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); } else if (kind === 'tri') {
    c.beginPath(); c.moveTo(cx, cy - ry); c.lineTo(cx + rx, cy + ry); c.lineTo(cx - rx, cy + ry); c.closePath();
  } else {
    c.translate(cx, cy); c.scale(rx, ry);
    if (kind === 'star') starPath(c); else heartPath(c);
    c.setTransform(c.getTransform().scale(1 / rx, 1 / ry));
    c.lineWidth = width;
  }
  if (filled) c.fill(); else c.stroke();
  c.restore();
}

// ---------- 그림판 만들기 ----------
// paper: 그릴 종이(캔버스). state: { color, size, tool, shape, stamp, filled } — 바꾸면 계속 기억한다.
export function createPainter(paper, state, { onChange } = {}) {
  const pctx = paper.getContext('2d', { willReadFrequently: true });
  const undo = [], redo = [];
  const cv = h('canvas', { class: 'paint-cv', 'aria-label': '그림판. 한 손가락으로 그리고, 두 손가락으로 벌리면 크게 볼 수 있어요.' });
  const cx = cv.getContext('2d');
  const layer = document.createElement('canvas'); // 형광펜처럼 한 획을 따로 그렸다가 합치는 종이
  layer.width = PW; layer.height = PH;
  const lctx = layer.getContext('2d');
  let view = { s: 1, ox: 0, oy: 0 }, fit = 1, dpr = 1, cw = 0, chh = 0;
  let stroke = null, preview = null, raf = 0;
  const pointers = new Map();
  let pinch = null;

  const snap = () => {
    const c = document.createElement('canvas');
    c.width = PW; c.height = PH;
    c.getContext('2d').drawImage(paper, 0, 0);
    undo.push(c);
    if (undo.length > 12) undo.shift();
    redo.length = 0;
  };
  const restore = (c) => { pctx.globalCompositeOperation = 'source-over'; pctx.globalAlpha = 1; pctx.drawImage(c, 0, 0); };

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = r.width; chh = r.height;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    const nf = Math.min(cw / PW, chh / PH);
    if (!fit || Math.abs(view.s - fit) < 1e-6) { fit = nf; fitView(); } else { fit = nf; clampView(); }
    render();
  }
  function fitView() { view.s = fit; view.ox = (cw - PW * fit) / 2; view.oy = (chh - PH * fit) / 2; }
  function clampView() {
    view.s = Math.max(fit, Math.min(fit * 6, view.s));
    const w = PW * view.s, hh = PH * view.s;
    view.ox = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, view.ox));
    view.oy = hh <= chh ? (chh - hh) / 2 : Math.min(0, Math.max(chh - hh, view.oy));
  }
  function zoomAt(f, sx, sy) {
    const ns = Math.max(fit, Math.min(fit * 6, view.s * f));
    const px = (sx - view.ox) / view.s, py = (sy - view.oy) / view.s;
    view.s = ns; view.ox = sx - px * ns; view.oy = sy - py * ns;
    clampView();
    render();
    if (onChange) onChange();
  }
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.fillStyle = '#E9DFCB';
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.setTransform(view.s * dpr, 0, 0, view.s * dpr, view.ox * dpr, view.oy * dpr);
      cx.imageSmoothingEnabled = view.s < 1.5;
      cx.drawImage(paper, 0, 0);
      if (stroke && stroke.tool === 'marker') { cx.globalAlpha = 0.38; cx.drawImage(layer, 0, 0); cx.globalAlpha = 1; }
      if (preview) preview(cx);
      cx.setTransform(1, 0, 0, 1, 0, 0);
    });
  }
  const toPaper = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) - view.ox) / view.s, ((e.clientY - r.top) - view.oy) / view.s];
  };
  const clampP = ([x, y]) => [Math.max(0, Math.min(PW - 1, Math.round(x))), Math.max(0, Math.min(PH - 1, Math.round(y)))];

  // ---------- 붓질 ----------
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function segment(st, x0, y0, x1, y1) {
    const t = st.tool, size = state.size;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (t === 'pen' || t === 'eraser') {
      pctx.strokeStyle = pctx.fillStyle = t === 'eraser' ? '#FFFFFF' : state.color;
      pctx.lineWidth = t === 'eraser' ? size * 1.6 : size;
      pctx.lineCap = 'round'; pctx.lineJoin = 'round';
      pctx.beginPath(); pctx.moveTo(x0, y0); pctx.lineTo(x1, y1); pctx.stroke();
    } else if (t === 'pencil') {
      const w = Math.max(1.2, size * 0.35);
      pctx.globalAlpha = 0.82;
      pctx.strokeStyle = state.color; pctx.lineWidth = w; pctx.lineCap = 'round';
      pctx.beginPath(); pctx.moveTo(x0, y0); pctx.lineTo(x1, y1); pctx.stroke();
      pctx.globalAlpha = 0.28; pctx.fillStyle = state.color;
      for (let i = 0; i < len; i += 1.5) {
        const k = i / (len || 1);
        pctx.fillRect(x0 + (x1 - x0) * k + (Math.random() - 0.5) * w * 1.6, y0 + (y1 - y0) * k + (Math.random() - 0.5) * w * 1.6, 1, 1);
      }
      pctx.globalAlpha = 1;
    } else if (t === 'brush') {
      // 빠르게 그으면 가늘어지고 천천히 그으면 굵어진다
      const speed = len / Math.max(1, st.dt || 16);
      const target = size * Math.max(0.45, Math.min(1.35, 1.35 - speed * 0.35));
      st.w = st.w == null ? target : st.w + (target - st.w) * 0.35;
      pctx.fillStyle = state.color;
      const steps = Math.max(1, Math.ceil(len / Math.max(1, st.w * 0.25)));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const w = st.pw + (st.w - st.pw) * k;
        dot(pctx, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, w / 2);
      }
      st.pw = st.w;
    } else if (t === 'crayon') {
      pctx.fillStyle = state.color;
      const r = size * 0.55;
      for (let i = 0; i <= len; i += 1.2) {
        const k = i / (len || 1);
        const px = x0 + (x1 - x0) * k, py = y0 + (y1 - y0) * k;
        for (let j = 0; j < 4; j++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * r;
          pctx.globalAlpha = 0.35 + Math.random() * 0.4;
          pctx.fillRect(px + Math.cos(a) * rr, py + Math.sin(a) * rr, 1.6, 1.6);
        }
      }
      pctx.globalAlpha = 1;
    } else if (t === 'marker') {
      lctx.strokeStyle = state.color; lctx.lineWidth = size * 1.8; lctx.lineCap = 'round'; lctx.lineJoin = 'round';
      lctx.beginPath(); lctx.moveTo(x0, y0); lctx.lineTo(x1, y1); lctx.stroke();
    } else if (t === 'spray') {
      pctx.fillStyle = state.color;
      const r = size * 1.4;
      const n = Math.ceil(10 + len * 1.5);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
        pctx.globalAlpha = 0.6;
        pctx.fillRect(x1 + Math.cos(a) * rr, y1 + Math.sin(a) * rr, 1.5, 1.5);
      }
      pctx.globalAlpha = 1;
    }
  }

  function stamp(x, y) {
    const st = STAMPS.find((s) => s[0] === state.stamp) || STAMPS[0];
    const r = Math.max(14, state.size * 3.4);
    pctx.save();
    pctx.translate(x, y);
    pctx.scale(r, r);
    st[2](pctx, state.color);
    pctx.restore();
  }

  function down(e) {
    const [x, y] = toPaper(e);
    const t = state.tool;
    if (t === 'hand') { stroke = { tool: 'hand', sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy }; return; }
    if (x < 0 || y < 0 || x >= PW || y >= PH) { if (t !== 'shape') return; }
    const [px, py] = clampP([x, y]);
    if (t === 'fill') {
      snap();
      if (floodFill(pctx, px, py, state.color)) { sfx.blub(); render(); if (onChange) onChange(true); } else undo.pop();
      return;
    }
    if (t === 'stamp') {
      snap();
      stamp(px, py);
      sfx.pop();
      render();
      if (onChange) onChange(true);
      return;
    }
    snap();
    stroke = { tool: t, x: px, y: py, x0: px, y0: py, t: performance.now(), w: null, pw: null };
    if (t === 'shape') { preview = null; return; }
    if (t === 'marker') { lctx.clearRect(0, 0, PW, PH); }
    if (t === 'brush') { stroke.w = stroke.pw = state.size; }
    segment(stroke, px, py, px + 0.01, py + 0.01);
    render();
  }
  function move(e) {
    if (!stroke) return;
    if (stroke.tool === 'hand') {
      view.ox = stroke.ox + (e.clientX - stroke.sx);
      view.oy = stroke.oy + (e.clientY - stroke.sy);
      clampView(); render();
      return;
    }
    const [x, y] = clampP(toPaper(e));
    if (stroke.tool === 'shape') {
      const s0 = stroke;
      const sh = state.shape, col = state.color, w = Math.max(2, state.size), filled = state.filled;
      s0.x = x; s0.y = y;
      preview = (c) => drawShape(c, sh, s0.x0, s0.y0, s0.x, s0.y, col, w, filled && sh !== 'line');
      render();
      return;
    }
    const now = performance.now();
    stroke.dt = now - stroke.t; stroke.t = now;
    segment(stroke, stroke.x, stroke.y, x, y);
    stroke.x = x; stroke.y = y;
    render();
  }
  function up() {
    if (!stroke) return;
    const st = stroke;
    stroke = null;
    if (st.tool === 'hand') return;
    if (st.tool === 'marker') { pctx.globalAlpha = 0.38; pctx.drawImage(layer, 0, 0); pctx.globalAlpha = 1; lctx.clearRect(0, 0, PW, PH); }
    if (st.tool === 'shape') {
      preview = null;
      if (Math.hypot(st.x - st.x0, st.y - st.y0) < 4) { undo.pop(); render(); return; }
      drawShape(pctx, state.shape, st.x0, st.y0, st.x, st.y, state.color, Math.max(2, state.size), state.filled && state.shape !== 'line');
      sfx.pop();
    }
    render();
    if (onChange) onChange(true);
  }
  // 그리다가 두 번째 손가락이 닿으면 그 획은 없던 일로 하고 확대·이동으로 바꾼다
  function cancelStroke() {
    if (stroke && stroke.tool !== 'hand') {
      const c = undo.pop();
      if (c) restore(c);
      lctx.clearRect(0, 0, PW, PH);
    }
    stroke = null; preview = null;
    render();
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelStroke();
      const [a, b] = [...pointers.values()];
      const r = cv.getBoundingClientRect();
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
      return;
    }
    if (pointers.size === 1) down(e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const r = cv.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      view.ox += mx - pinch.mx; view.oy += my - pinch.my;
      zoomAt(d / Math.max(1, pinch.d), mx, my);
      pinch = { d, mx, my };
      return;
    }
    move(e);
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    up();
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    zoomAt(e.deltaY > 0 ? 0.88 : 1.14, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const ro = new ResizeObserver(() => layout());
  ro.observe(cv);

  return {
    el: cv,
    layout,
    render,
    zoomIn() { zoomAt(1.4, cw / 2, chh / 2); },
    zoomOut() { zoomAt(1 / 1.4, cw / 2, chh / 2); },
    fitAll() { fitView(); render(); if (onChange) onChange(); },
    get zoom() { return fit ? view.s / fit : 1; },
    undo() { const c = undo.pop(); if (!c) return false; const r = document.createElement('canvas'); r.width = PW; r.height = PH; r.getContext('2d').drawImage(paper, 0, 0); redo.push(r); restore(c); render(); return true; },
    redo() { const c = redo.pop(); if (!c) return false; const u = document.createElement('canvas'); u.width = PW; u.height = PH; u.getContext('2d').drawImage(paper, 0, 0); undo.push(u); restore(c); render(); return true; },
    clear() { snap(); pctx.fillStyle = '#FFFFFF'; pctx.fillRect(0, 0, PW, PH); render(); },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); },
    // 시험용: 종이 좌표를 화면 좌표로
    screenOf(x, y) { const r = cv.getBoundingClientRect(); return { x: r.left + view.ox + x * view.s, y: r.top + view.oy + y * view.s }; },
  };
}

// 도장 미리보기 단추 그림
export function stampIcon(id, color, size = 34) {
  const c = h('canvas', { width: size * 2, height: size * 2, style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  const x = c.getContext('2d');
  const st = STAMPS.find((s) => s[0] === id);
  x.translate(size, size);
  x.scale(size * 0.8, size * 0.8);
  st[2](x, color);
  return c;
}
export const SHAPE_LIST = SHAPES;
