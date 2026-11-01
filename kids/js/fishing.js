// 진숲 어린이 마을 — 반짝 연못 낚시터
// 던지고, 찌가 쑥 들어가면 당기고, 빠르게 눌러 감아요. 어떤 물고기가 걸릴지는 서버가 정한다.
import { h, modal, toast, confetti, josa } from './ui.js';
import { message } from './api.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';
import { fishById, fishAt, RARITY } from './play-data.js';
import { sfx } from './sound.js';

export function drawFish(ctx, kind, cx, cy, len, { silhouette = false } = {}) {
  const f = typeof kind === 'string' ? fishById(kind) : kind;
  const S = silhouette ? '#C9BFAE' : null, S2 = silhouette ? '#B5AA97' : null;
  ctx.save();
  ctx.translate(cx, cy);
  if (!f || f.rarity < 0) {
    // 물건
    ctx.fillStyle = S || (f && f.id === 'can' ? '#A9B4BE' : '#6B4B3A');
    if (f && f.id === 'can') {
      ctx.fillRect(-len * 0.22, -len * 0.3, len * 0.44, len * 0.6);
      if (!silhouette) { ctx.fillStyle = '#EF6461'; ctx.fillRect(-len * 0.22, -len * 0.1, len * 0.44, len * 0.18); }
    } else if (f && f.id === 'bottle') {
      // 비스듬히 누운 유리병과 코르크 마개
      ctx.rotate(-0.45);
      ctx.fillStyle = S || 'rgba(110,190,140,.9)';
      ctx.beginPath(); ctx.roundRect(-len * 0.3, -len * 0.13, len * 0.42, len * 0.26, len * 0.07); ctx.fill();
      ctx.fillRect(len * 0.1, -len * 0.06, len * 0.17, len * 0.12);
      if (!silhouette) {
        ctx.fillStyle = '#B98A5B'; ctx.fillRect(len * 0.26, -len * 0.05, len * 0.07, len * 0.1);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-len * 0.24, -len * 0.08, len * 0.28, len * 0.04);
      }
    } else if (f && f.id === 'oldnet') {
      // 엉킨 그물과 동그란 찌
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, len * 0.34, len * 0.24, 0, 0, 7);
      ctx.fillStyle = S || 'rgba(111,138,122,.25)'; ctx.fill();
      ctx.clip();
      ctx.strokeStyle = S2 || '#6F8A7A'; ctx.lineWidth = Math.max(1, len * 0.025);
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * len * 0.09 - len * 0.14, -len * 0.26); ctx.lineTo(i * len * 0.09 + len * 0.14, len * 0.26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * len * 0.09 + len * 0.14, -len * 0.26); ctx.lineTo(i * len * 0.09 - len * 0.14, len * 0.26); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = S2 || '#F28A3C'; ctx.beginPath(); ctx.arc(len * 0.28, -len * 0.18, len * 0.09, 0, 7); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-len * 0.2, -len * 0.35); ctx.lineTo(len * 0.08, -len * 0.35); ctx.lineTo(len * 0.08, len * 0.1);
      ctx.lineTo(len * 0.38, len * 0.12); ctx.quadraticCurveTo(len * 0.42, len * 0.32, len * 0.3, len * 0.32);
      ctx.lineTo(-len * 0.2, len * 0.32); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return;
  }
  const body = S || f.body, fin = S2 || f.fin;
  const eye = (x, y, r) => {
    if (silhouette) return;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#2E2A2A'; ctx.beginPath(); ctx.arc(x - r * 0.1, y, r * 0.55, 0, 7); ctx.fill();
  };
  ctx.lineCap = 'round';
  if (f.shape === 'squid') {
    // 오징어: 몸통은 오른쪽, 끝에 세모 지느러미, 왼쪽에 머리와 다리
    ctx.fillStyle = fin;
    ctx.beginPath(); ctx.moveTo(len * 0.3, 0); ctx.lineTo(len * 0.47, -len * 0.15); ctx.lineTo(len * 0.56, 0); ctx.lineTo(len * 0.47, len * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(len * 0.17, 0, len * 0.3, len * 0.1, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-len * 0.14, 0, len * 0.07, len * 0.08, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = Math.max(1, len * 0.025);
    for (let i = 0; i < 8; i++) {
      const y = (i - 3.5) * len * 0.022;
      ctx.beginPath(); ctx.moveTo(-len * 0.18, y * 0.6); ctx.quadraticCurveTo(-len * 0.3, y * 1.5, -len * 0.4, y * 1.7 + Math.sin(i * 1.7) * len * 0.02); ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, len * 0.014);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-len * 0.18, 0); ctx.quadraticCurveTo(-len * 0.38, s * len * 0.11, -len * 0.5, s * len * 0.06); ctx.stroke();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-len * 0.51, s * len * 0.06, len * 0.035, len * 0.018, 0, 0, 7); ctx.fill();
    }
    if (!silhouette) { ctx.fillStyle = 'rgba(200,110,90,.35)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(len * (0.02 + i * 0.05), (i % 2 ? -1 : 1) * len * 0.03, len * 0.012, 0, 7); ctx.fill(); } }
    eye(-len * 0.14, -len * 0.025, len * 0.035);
    ctx.restore();
    return;
  }
  if (f.shape === 'octopus') {
    // 문어: 둥근 머리 아래로 꼬불꼬불한 다리 여덟 개
    ctx.strokeStyle = body;
    ctx.lineWidth = Math.max(2, len * 0.055);
    for (let i = 0; i < 8; i++) {
      const a = -0.2 + (i / 7) * (Math.PI + 0.4);
      const sx = Math.cos(a) * len * 0.08, ex = Math.cos(a) * len * 0.4, ey = len * 0.1 + Math.sin(a) * len * 0.16;
      ctx.beginPath(); ctx.moveTo(sx, len * 0.06); ctx.quadraticCurveTo((sx + ex) / 2 + (i % 2 ? 1 : -1) * len * 0.07, len * 0.3, ex, ey); ctx.stroke();
      if (!silhouette) { ctx.fillStyle = f.fin; ctx.beginPath(); ctx.arc((sx + ex) / 2, len * 0.22, len * 0.015, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, -len * 0.08, len * 0.18, len * 0.2, 0, 0, 7); ctx.fill();
    if (!silhouette) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-len * 0.06, -len * 0.16, len * 0.06, len * 0.04, -0.5, 0, 7); ctx.fill(); }
    eye(-len * 0.07, len * 0.03, len * 0.035);
    eye(len * 0.07, len * 0.03, len * 0.035);
    ctx.restore();
    return;
  }
  if (f.shape === 'ribbon') {
    // 갈치: 은빛 띠처럼 길고 꼬리 끝이 뾰족하다
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-len * 0.56, -len * 0.01); ctx.quadraticCurveTo(-len * 0.42, -len * 0.075, -len * 0.1, -len * 0.065);
    ctx.lineTo(len * 0.58, -len * 0.004); ctx.lineTo(len * 0.58, len * 0.004); ctx.lineTo(-len * 0.1, len * 0.055);
    ctx.quadraticCurveTo(-len * 0.45, len * 0.05, -len * 0.56, -len * 0.01); ctx.fill();
    ctx.strokeStyle = fin; ctx.lineWidth = Math.max(1, len * 0.018);
    ctx.beginPath(); ctx.moveTo(-len * 0.36, -len * 0.075); ctx.quadraticCurveTo(0, -len * 0.09, len * 0.55, -len * 0.012); ctx.stroke();
    if (!silhouette) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, len * 0.012); ctx.beginPath(); ctx.moveTo(-len * 0.4, 0); ctx.lineTo(len * 0.4, 0); ctx.stroke(); }
    eye(-len * 0.45, -len * 0.025, len * 0.028);
    ctx.restore();
    return;
  }
  if (f.shape === 'flat') {
    // 광어: 납작하고 넓은 몸, 두 눈이 한쪽에 몰려 있다 (위에서 본 모습)
    const W = len * 0.84, Hh = len * 0.56;
    ctx.fillStyle = fin;
    ctx.beginPath(); ctx.ellipse(-len * 0.03, 0, W * 0.5, Hh * 0.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W * 0.4, 0); ctx.lineTo(W * 0.62, -Hh * 0.3); ctx.lineTo(W * 0.62, Hh * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(-len * 0.03, 0, W * 0.42, Hh * 0.4, 0, 0, 7); ctx.fill();
    if (!silhouette && f.spots) {
      ctx.fillStyle = f.spots;
      for (const [x, y] of [[-0.05, -0.1], [0.08, 0.08], [0.18, -0.05], [-0.12, 0.12], [0.25, 0.1], [0.02, 0.18]]) { ctx.beginPath(); ctx.arc(len * x, len * y, len * 0.025, 0, 7); ctx.fill(); }
    }
    eye(-W * 0.3, -Hh * 0.12, len * 0.032);
    eye(-W * 0.22, -Hh * 0.24, len * 0.032);
    ctx.restore();
    return;
  }
  const tuna = f.shape === 'tuna';
  const L = f.long ? len * 1.1 : len;
  const H = f.long ? len * 0.16 : f.slim ? len * 0.19 : f.id === 'goldfish' || f.deep ? len * 0.42 : tuna ? len * 0.34 : len * 0.3;
  // 꼬리
  ctx.fillStyle = fin;
  ctx.beginPath();
  if (tuna) {
    // 참치: 초승달 꼬리
    ctx.moveTo(L * 0.36, 0); ctx.quadraticCurveTo(L * 0.48, -H * 0.2, L * 0.6, -H * 0.8); ctx.quadraticCurveTo(L * 0.5, 0, L * 0.6, H * 0.8); ctx.quadraticCurveTo(L * 0.48, H * 0.2, L * 0.36, 0);
  } else {
    ctx.moveTo(L * 0.36, 0); ctx.lineTo(L * 0.56, -H * 0.62); ctx.lineTo(L * 0.52, 0); ctx.lineTo(L * 0.56, H * 0.62); ctx.closePath();
  }
  ctx.fill();
  // 지느러미
  if (f.spiny) {
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-L * 0.17 + i * L * 0.06, -H * 0.42); ctx.lineTo(-L * 0.14 + i * L * 0.06, -H * 0.78); ctx.lineTo(-L * 0.1 + i * L * 0.06, -H * 0.42); ctx.closePath(); ctx.fill(); }
  } else {
    if (tuna && !silhouette) ctx.fillStyle = f.back;
    ctx.beginPath(); ctx.ellipse(0, -H * 0.42, L * 0.14, H * 0.22, -0.3, 0, 7); ctx.fill();
  }
  if (tuna && !silhouette) {
    ctx.fillStyle = f.fin;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = L * (0.16 + i * 0.05); ctx.beginPath(); ctx.moveTo(x, s * H * 0.36); ctx.lineTo(x + L * 0.025, s * H * 0.5); ctx.lineTo(x + L * 0.04, s * H * 0.33); ctx.closePath(); ctx.fill(); }
  }
  // 몸
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.42, H * 0.5, 0, 0, 7); ctx.fill();
  if (!silhouette) {
    if (f.back) {
      // 등은 짙은 색, 고등어는 물결무늬
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.42, H * 0.5, 0, 0, 7); ctx.clip();
      ctx.fillStyle = f.back;
      ctx.beginPath(); ctx.ellipse(0, -H * 0.32, L * 0.46, H * 0.36, 0, 0, 7); ctx.fill();
      if (f.wave) {
        ctx.strokeStyle = f.wave; ctx.lineWidth = Math.max(1, H * 0.07);
        for (let i = 0; i < 7; i++) { const x = -L * 0.2 + i * L * 0.075; ctx.beginPath(); ctx.moveTo(x, -H * 0.5); ctx.quadraticCurveTo(x + L * 0.035, -H * 0.3, x - L * 0.01, -H * 0.08); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (f.lateral) { ctx.strokeStyle = f.lateral; ctx.lineWidth = Math.max(1, H * 0.07); ctx.beginPath(); ctx.moveTo(-L * 0.3, -H * 0.04); ctx.quadraticCurveTo(0, -H * 0.16, L * 0.38, 0); ctx.stroke(); }
    if (f.stripe) { ctx.fillStyle = f.stripe; ctx.beginPath(); ctx.ellipse(0, H * 0.02, L * 0.36, H * 0.12, 0, 0, 7); ctx.fill(); }
    if (f.spots) { ctx.fillStyle = f.spots; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-L * 0.2 + i * L * 0.08, (i % 2 ? -1 : 1) * H * 0.12 - (f.deep ? H * 0.1 : 0), H * 0.07, 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(-L * 0.05, H * 0.2, L * 0.25, H * 0.12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(-L * 0.28, -H * 0.1, H * 0.13, 0, 7); ctx.fill();
    ctx.fillStyle = '#2E2A2A'; ctx.beginPath(); ctx.arc(-L * 0.29, -H * 0.1, H * 0.07, 0, 7); ctx.fill();
    if (f.whisker) {
      ctx.strokeStyle = '#2E2A2A'; ctx.lineWidth = Math.max(1, len * 0.012);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.4, H * 0.05); ctx.quadraticCurveTo(-L * 0.55, H * 0.2 * s, -L * 0.62, H * 0.45 * s); ctx.stroke(); }
    }
  }
  ctx.restore();
}

export function fishCanvas(kind, w = 120, hgt = 70, opts) {
  const c = h('canvas', { width: w * 2, height: hgt * 2, class: 'fish-cv', 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  drawFish(ctx, kind, w / 2, hgt / 2, w * 0.8, opts);
  return c;
}

export function createFishing({ rpc, getToken, onSessionLost, onCelebrate, onRare }) {
  let st = null; // 낚시 상태
  let raf = 0;

  function stop() { cancelAnimationFrame(raf); if (st) clearTimeout(st.timer); st = null; }

  function scene() {
    stop();
    modal.setTitle('반짝 연못 낚시터');
    const cv = h('canvas', { class: 'pond-cv', 'aria-label': '연못' });
    const ctx = cv.getContext('2d');
    const msg = h('p', { class: 'pond-msg', 'aria-live': 'polite' }, '낚싯대를 던져 볼까요?');
    const meter = h('div', { class: 'reel', hidden: true }, h('i'));
    const btn = h('button', { class: 'btn btn-go pond-btn', type: 'button', 'data-quiet': '' }, '던지기');
    const tabs = h('div', { class: 'pond-tabs' });
    st = { phase: 'idle', t: 0, cv, ctx, msg, meter, btn, bob: { x: 0.55, y: 0.55, dip: 0 }, nib: 0 };
    btn.addEventListener('click', act);
    modal.setBody(h('div', { class: 'mem game pond' }, cv, msg, meter, h('div', { class: 'row' }, btn), tabs));
    loadBook(tabs);
    const loop = (ts) => {
      if (!st || !document.body.contains(cv)) return;
      draw(ts / 1000);
      raf = requestAnimationFrame(loop);
    };
    requestAnimationFrame(() => { size(); raf = requestAnimationFrame(loop); });
  }

  function size() {
    if (!st) return;
    const w = Math.min(560, st.cv.parentElement.clientWidth || 360);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    st.w = w; st.h = Math.round(w * 0.56); st.dpr = dpr;
    st.cv.width = w * dpr; st.cv.height = st.h * dpr;
    st.cv.style.width = w + 'px'; st.cv.style.height = st.h + 'px';
  }

  function draw(t) {
    const { ctx, w, h: H, dpr } = st;
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8FD8F2'); g.addColorStop(1, '#4FB2DC');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, H);
    // 물결
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = H * (0.15 + i * 0.15) + Math.sin(t * 1.3 + i) * 3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / 30 + t * 2 + i) * 2);
      ctx.stroke();
    }
    // 연잎
    for (const [x, y, r] of [[0.12, 0.25, 26], [0.85, 0.75, 32], [0.2, 0.82, 22]]) {
      ctx.fillStyle = '#5FAE4E'; ctx.beginPath(); ctx.arc(w * x, H * y, r, 0.3, Math.PI * 2 - 0.1); ctx.lineTo(w * x, H * y); ctx.fill();
    }
    ctx.fillStyle = '#F6A2C4'; ctx.beginPath(); ctx.arc(w * 0.85 + 6, H * 0.75 - 6, 7, 0, 7); ctx.fill();
    // 낚싯줄과 찌
    const ph = st.phase;
    if (ph !== 'idle') {
      const bx = w * st.bob.x, by = H * st.bob.y;
      let dip = 0;
      if (ph === 'wait') dip = st.nib > 0 ? Math.sin(t * 30) * 3 : Math.sin(t * 2.2) * 1.5;
      if (ph === 'bite') dip = 9 + Math.sin(t * 25) * 3;
      if (ph === 'reel') dip = 6 + Math.sin(t * 18) * 4;
      ctx.strokeStyle = 'rgba(60,40,30,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w * 0.98, H * 0.02); ctx.quadraticCurveTo(w * 0.8, by - 40, bx, by + dip - 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.ellipse(bx, by + 4, 14 + (ph === 'bite' ? 8 : 0), 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#EF6461'; ctx.beginPath(); ctx.arc(bx, by + dip - 4, 7, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(bx, by + dip - 4, 7, 0, Math.PI); ctx.fill();
      if (ph === 'bite') {
        ctx.fillStyle = '#FFFDF7'; ctx.font = `bold 34px "Maplestory Bold", sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('!', bx, by - 22);
      }
    }
    if (ph === 'reel' || ph === 'done') {
      // 물속 그림자
      ctx.fillStyle = 'rgba(30,60,80,.25)';
      ctx.beginPath(); ctx.ellipse(w * st.bob.x + Math.sin(t * 3) * 20, H * st.bob.y + 24, 34, 10, 0, 0, 7); ctx.fill();
    }
  }

  function setPhase(p, text, label, opts = {}) {
    st.phase = p;
    st.msg.textContent = text;
    st.btn.textContent = label;
    st.btn.disabled = !!opts.disabled;
    st.btn.classList.toggle('pulse', !!opts.pulse);
    st.meter.hidden = p !== 'reel';
  }

  function act() {
    if (!st) return;
    const p = st.phase;
    if (p === 'idle' || p === 'miss' || p === 'done') return cast();
    if (p === 'wait') { clearTimeout(st.timer); sfx.fail(); setPhase('miss', '앗, 너무 일찍 당겼어요. 찌가 쑥 들어갈 때 당겨요!', '다시 던지기'); return; }
    if (p === 'bite') { clearTimeout(st.timer); return reel(); }
    if (p === 'reel') {
      sfx.tick();
      st.power = Math.min(100, st.power + 9);
      if (st.power >= 100) land();
    }
  }

  function cast() {
    st.bob = { x: 0.3 + Math.random() * 0.4, y: 0.4 + Math.random() * 0.3 };
    sfx.splash();
    setPhase('wait', '찌를 잘 보세요… 쑥 들어가면 당겨요!', '당기기');
    const wait = 1600 + Math.random() * 3800;
    // 살짝 건드리는 입질 (속지 않기)
    if (Math.random() < 0.6) setTimeout(() => { if (st && st.phase === 'wait') { st.nib = 1; setTimeout(() => { if (st) st.nib = 0; }, 450); } }, wait * 0.5);
    st.timer = setTimeout(() => {
      if (!st || st.phase !== 'wait') return;
      setPhase('bite', '지금이에요! 당겨요!', '당기기!', { pulse: true });
      sfx.bite();
      st.timer = setTimeout(() => { if (st && st.phase === 'bite') { sfx.fail(); setPhase('miss', '물고기가 도망갔어요. 다시 해 볼까요?', '다시 던지기'); } }, 1300);
    }, wait);
  }

  function reel() {
    st.power = 25;
    st.drain = 14 + Math.random() * 14;
    setPhase('reel', '빠르게 눌러서 감아요!', '감기!', { pulse: true });
    let last = performance.now();
    const left = performance.now() + 6500;
    const tick = () => {
      if (!st || st.phase !== 'reel') return;
      const now = performance.now();
      st.power = Math.max(0, st.power - st.drain * ((now - last) / 1000));
      last = now;
      st.meter.firstChild.style.width = st.power + '%';
      if (now > left || st.power <= 0) { sfx.fail(); setPhase('miss', '줄이 느슨해져서 놓쳤어요. 다시 해 볼까요?', '다시 던지기'); return; }
      st.timer = setTimeout(tick, 50);
    };
    tick();
  }

  async function land() {
    setPhase('done', '끌어올리는 중…', '잠깐만요', { disabled: true });
    let r;
    try {
      r = await rpc('kids_fish_catch', { p_token: getToken() });
    } catch (e) {
      if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
      if (!st) return;
      setPhase('miss', e.code === 'FISH_TIRED' ? '오늘은 물고기들이 쉬고 싶대요. 내일 또 와요!' : e.code === 'TOO_FAST' ? '조금만 쉬었다가 던져요.' : message(e), '다시 던지기');
      return;
    }
    if (!st) return;
    const f = fishById(r.fish) || { name: r.name, rarity: r.rarity };
    const junk = f.rarity < 0;
    setPhase('done', junk ? `${josa(f.name, '이', '가')} 걸렸어요. 연못을 깨끗하게 했어요!` : `${josa(f.name, '을', '를')} 낚았어요! ${r.size}cm`, '또 던지기');
    showCatch(r, f);
    if (!junk && (r.first || f.rarity >= 2)) { confetti(); onCelebrate(); } else if (junk) sfx.blub(); else sfx.ding();
    if (f.rarity >= 2 && onRare) onRare(r.fish);
  }

  function showCatch(r, f) {
    const junk = f.rarity < 0;
    const card = h('div', { class: 'catch-card' + (f.rarity >= 2 ? ' rare' : '') },
      fishCanvas(f, 150, 86),
      h('div', {},
        h('b', {}, f.name),
        junk ? h('span', {}, '물고기는 아니지만 연못이 깨끗해졌어요.') : h('span', {}, `${r.size}cm · ${RARITY[f.rarity]}`),
        r.first && !junk ? h('em', {}, '처음 낚았어요! 도감에 올랐어요') : r.best ? h('em', {}, '내 기록보다 커요!') : null));
    const old = st.cv.parentElement.querySelector('.catch-card');
    if (old) old.remove();
    st.msg.after(card);
    const tabs = st.cv.parentElement.querySelector('.pond-tabs');
    if (tabs) loadBook(tabs);
  }

  const loadBook = (box) => renderFishBook(box, { rpc, getToken, onSessionLost });

  function open() {
    modal.open('반짝 연못 낚시터', h('div'), { cls: 'game-sheet', onClose: stop });
    scene();
  }
  return { open };
}

// 물고기 도감: 연못과 바다를 나눠 보여 준다 (place: 먼저 볼 곳)
export async function renderFishBook(box, { rpc, getToken, onSessionLost, place = 'pond' }) {
  let b;
  try { b = await rpc('kids_fish_book', { p_token: getToken() }); } catch (e) {
    if (e.code === 'SESSION') { modal.close(); return onSessionLost(); }
    return;
  }
  const PLACES = [['pond', '🐟 반짝 연못'], ['sea', '🌊 바다']];
  const draw = () => {
    const list = fishAt(place);
    const fishes = list.filter((f) => f.rarity >= 0);
    const got = fishes.filter((f) => b.mine[f.id]).length;
    const book = h('div', { class: 'fish-book' }, list.map((f) => {
      const m = b.mine[f.id];
      return h('div', { class: 'fb-cell' + (m ? '' : ' unknown') },
        fishCanvas(f, 84, 48, { silhouette: !m }),
        h('b', {}, m ? f.name : '?'),
        h('span', {}, m ? (f.rarity < 0 ? `${m.count}번` : `최고 ${m.best}cm · ${m.count}마리`) : RARITY[f.rarity]));
    }));
    // 오늘의 큰 물고기는 연못과 바다를 따로 센다 (옛 서버는 today_sea가 없다)
    const tops = place === 'sea' ? (b.today_sea || []) : (b.today_top || []).filter((t) => ((fishById(t.fish) || {}).place || 'pond') === 'pond');
    const top = tops.length ? h('ol', { class: 'fish-top' }, tops.map((t, i) => {
      const cv = h('canvas', { width: 80, height: 80, class: 'fb-face', 'aria-hidden': 'true' });
      drawFaceIcon(cv, normalizeAvatar(t.avatar));
      return h('li', { class: t.me ? 'me' : '' }, h('span', { class: `fb-rank r${i + 1}` }, String(i + 1)), cv,
        h('b', {}, t.name), h('span', {}, `${(fishById(t.fish) || {}).name || ''} ${t.size}cm`));
    })) : h('p', { class: 'fb-empty' }, place === 'sea' ? '오늘은 아직 아무도 바다에서 낚지 않았어요.' : '오늘은 아직 아무도 연못에서 낚지 않았어요.');
    const tabs = h('div', { class: 'shop-tabs', role: 'tablist' }, PLACES.map(([k, label]) => h('button', {
      class: 'shop-tab', role: 'tab', type: 'button', 'aria-selected': String(place === k), onclick: () => { place = k; draw(); },
    }, label)));
    box.replaceChildren(tabs,
      h('section', { class: 'fboard' }, h('div', { class: 'sub-head' }, h('h3', {}, '오늘의 큰 물고기'), h('p', {}, place === 'sea' ? '바다 · 마을 친구들 기록' : '연못 · 마을 친구들 기록')), top),
      h('section', { class: 'fboard' }, h('div', { class: 'sub-head' }, h('h3', {}, place === 'sea' ? '바다 도감' : '연못 도감'), h('p', {}, `${got} / ${fishes.length}`)), book));
  };
  draw();
}
