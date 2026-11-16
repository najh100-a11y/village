// 진숲 어린이 마을 — 줄넘기 (마을 길 어디서나)
// 오른쪽 아래 '줄넘기' 단추를 누르면 그 자리에서 줄을 돌린다. 줄이 발밑에 오기 조금 전에 '뛰기'(컴퓨터는 스페이스바)를 눌러 넘는다.
// 한 번 넘을 때마다 줄이 조금씩 빨라지고(한 바퀴 1.15초에서 0.55초까지), 줄에 걸리면 끝난다. 이어서 넘은 수가 기록이다.
// 내 최고 기록, 오늘 내 최고, 오늘의 줄넘기 왕은 서버(kids_jr_save, kids_jr_board)가 센다. 줄넘기로는 열매를 주지 않는다.
// 친구 화면에서는 줄을 돌리며 폴짝폴짝 뛰는 모습으로 보인다(놀이 소식 'jrope').
import * as THREE from './three.module.min.js';
import { toon } from './avatar.js';
import { h, modal, confetti } from './ui.js';
import { message } from './api.js';
import { sfx } from './sound.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';

// P0 처음 한 바퀴(초), PMIN 가장 빠른 한 바퀴, STEP 넘을 때마다 줄어드는 시간, AIR 뛰어 있는 시간, H 뛰는 높이,
// CLEAR 줄이 발밑을 지날 때 몸이 뛴 높이의 이만큼 이상 떠 있으면 넘는다 (누르는 때가 줄이 지나기 0.03~0.37초 전이면 넘는다)
export const JR = { P0: 1.15, PMIN: 0.55, STEP: 0.01, AIR: 0.4, H: 0.42, CLEAR: 0.2 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const ROPE_C = '#FF6FA8', HANDLE_C = '#FFD54A';

// ---------- 줄과 손잡이 ----------
// theta: 줄이 도는 각도. 0이면 머리 위, π/2면 몸 앞, π면 발밑, 3π/2면 몸 뒤 (앞으로 넘는 줄)
export function ropeRig(av) {
  const g = new THREE.Group();
  const mat = toon(ROPE_C), hMat = toon(HANDLE_C);
  const handles = [0, 1].map((i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.22, 8), hMat);
    m.castShadow = true;
    m.position.set(0, -0.45, 0.03);
    av.arms[i].add(m);
    return m;
  });
  av.root.add(g);
  // 줄이 머리(모자, 머리 장식까지) 위로 넉넉히 지나가도록 아바타 키를 잰다 (뿌리 기준, 서 있을 때)
  let top = 2.05;
  {
    av.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(av.root.matrixWorld).invert(), m = new THREE.Matrix4(), bb = new THREE.Box3();
    let y = -Infinity;
    av.body.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      for (let q = o; q; q = q.parent) if (q === av.umbrella || q === av.body.parent) break; else if (!q.visible) return; // 감춘 것(접은 우산 등)은 빼고
      if (av.umbrella) for (let q = o; q; q = q.parent) if (q === av.umbrella) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      y = Math.max(y, bb.max.y);
    });
    if (Number.isFinite(y)) top = Math.min(3.2, y - av.body.position.y);
  }
  const pts = Array.from({ length: 19 }, () => V());
  const curve = new THREE.CatmullRomCurve3(pts);
  const hl = V(), hr = V();
  let tube = null;
  function update(theta) {
    av.root.updateMatrixWorld(true);
    hl.set(0, -0.57, 0.03); av.arms[0].localToWorld(hl); av.root.worldToLocal(hl);
    hr.set(0, -0.57, 0.03); av.arms[1].localToWorld(hr); av.root.worldToLocal(hr);
    const lift = av.body.position.y; // 뛰어오른 높이 (손과 줄도 함께 올라간다)
    const hy = (hl.y + hr.y) / 2, base = hy - lift; // 땅에 서 있을 때 손 높이
    const up = Math.max(0.9, top + 0.28 - base), down = base + 0.03, depth = 0.95; // 위는 머리 위로, 아래는 발바닥 바로 밑까지
    const c = Math.cos(theta), s = Math.sin(theta);
    const n = pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const k = i / n, b = Math.pow(Math.sin(Math.PI * k), 0.7);
      const p = pts[i];
      p.lerpVectors(hl, hr, k);
      p.x += (k - 0.5) * 0.3 * Math.sin(Math.PI * k);
      p.y += b * c * (c >= 0 ? up : down);
      p.z += b * s * depth;
      if (p.y < 0.014) p.y = 0.014; // 땅을 뚫지 않는다
    }
    const geo = new THREE.TubeGeometry(curve, 44, 0.02, 6, false);
    if (!tube) { tube = new THREE.Mesh(geo, mat); tube.castShadow = true; g.add(tube); } else { tube.geometry.dispose(); tube.geometry = geo; }
  }
  function dispose() {
    g.removeFromParent();
    if (tube) tube.geometry.dispose();
    for (const m of handles) { m.removeFromParent(); m.geometry.dispose(); }
  }
  return { update, dispose };
}

// 줄을 돌리는 팔: 손이 줄을 따라 작은 원을 그린다. hgt: 뛰어오른 높이(0~JR.H)
function ropeArms(av, theta, hgt) {
  const c = Math.cos(theta), s = Math.sin(theta);
  av.arms[0].rotation.x = av.arms[1].rotation.x = -0.32 - 0.16 * s;
  av.arms[0].rotation.z = -0.5 - 0.07 * c;
  av.arms[1].rotation.z = 0.5 + 0.07 * c;
  const k = hgt / JR.H;
  av.body.position.y = hgt;
  av.body.rotation.x = 0.04;
  av.legs[0].rotation.x = av.legs[1].rotation.x = -0.22 * k; // 두 발을 모아 살짝 굽힌다
}

// 친구 화면: 줄을 돌리며 박자에 맞춰 폴짝 (실제 기록과 박자를 맞추지는 않는다)
export function remoteRope(av) {
  const rig = ropeRig(av);
  const per = 0.78;
  const pose = (a, dt, t) => {
    const theta = (t / per) * TAU;
    const near = -Math.cos(theta); // 발밑(π)에서 1
    const hgt = near > 0.35 ? JR.H * Math.sin(((near - 0.35) / 0.65) * Math.PI / 2) : 0;
    ropeArms(a, theta, hgt);
    rig.update(theta);
  };
  pose.jrope = true;
  av.pose = pose;
  return { dispose() { rig.dispose(); if (av.pose === pose) av.pose = null; } };
}

// 줄 각도 판: 점이 줄, 아래 신발이 발밑, 초록 칸에 점이 있을 때 누르면 알맞다
function dialSvg() {
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<line x1="${(36 * Math.sin(a)).toFixed(2)}" y1="${(-36 * Math.cos(a)).toFixed(2)}" x2="${(40 * Math.sin(a)).toFixed(2)}" y2="${(-40 * Math.cos(a)).toFixed(2)}" stroke="#D9CBB0" stroke-width="2"/>`; }).join('');
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="45" fill="#FFFDF7" stroke="#E8DCC4" stroke-width="3"/>${ticks}`
    + '<path class="jr-zone" d="" stroke="#7CC46A" stroke-width="11" fill="none"/>'
    + '<text x="0" y="6" text-anchor="middle" font-size="18" fill="#B9A98E">👟</text>'
    + '<path d="M0 44 l-5 -7 h10 z" fill="#EF6461"/>'
    + '<g class="jr-dot"><circle cx="0" cy="-40" r="7" fill="' + ROPE_C + '" stroke="#fff" stroke-width="2.5"/></g></svg>';
}
// 각도 a(라디안, 0이 위, 시계 방향)의 원 위 점
const onRing = (a, r) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;

export function createJumpRope({ v, ui, begin, stopAll, portrait, rpc, getToken, lost, live, onCelebrate, features = () => ({}) }) {
  // ---------- 기록판 ----------
  function board() {
    const box = h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, '기록을 꺼내고 있어요…'));
    modal.open('줄넘기 기록판', box, { cls: 'game-sheet' });
    if (!features().jrope) { box.replaceChildren(h('p', { class: 'fb-empty' }, '기록판은 곧 열려요. 먼저 줄넘기를 연습해 봐요!')); return; }
    rpc('kids_jr_board', { p_token: getToken() }).then((b) => drawBoard(box, b)).catch((e) => {
      if (lost(e)) return;
      box.replaceChildren(h('p', { class: 'fb-empty' }, message(e)));
    });
  }
  function rows(list, key) {
    return list.map((t, i) => {
      const cv = h('canvas', { width: 64, height: 64, class: 'fl-face', 'aria-hidden': 'true' });
      drawFaceIcon(cv, normalizeAvatar(t.avatar));
      return h('div', { class: 'fl-row' + (t.me ? ' me' : '') }, h('b', { class: 'rank' }, `${i + 1}`), cv,
        h('div', { class: 'fl-main' }, h('b', {}, t.name, t.teacher ? h('span', { class: 't-badge' }, '선생님') : null, t.me ? ' (나)' : ''), h('span', {}, `${t[key]}번 넘었어요`)));
    });
  }
  function drawBoard(box, b) {
    const today = rows((b && b.today) || [], 'n'), all = rows((b && b.all) || [], 'n');
    box.replaceChildren(
      h('div', { class: 'sub-head' }, h('h3', {}, '오늘의 줄넘기 왕'), h('p', {}, '날마다 새로 세요')),
      today.length ? h('div', { class: 'fl-list' }, today) : h('p', { class: 'fb-empty' }, '오늘은 아직 아무도 넘지 않았어요. 첫 기록을 세워 봐요!'),
      h('div', { class: 'sub-head' }, h('h3', {}, '최고 기록'), h('p', {}, '지금까지 가장 많이 넘은 기록')),
      all.length ? h('div', { class: 'fl-list' }, all) : h('p', { class: 'fb-empty' }, '아직 기록이 없어요.'),
      h('p', { class: 'note' }, `내 오늘 최고 ${b.best_today || 0}번 · 내 최고 기록 ${b.best || 0}번 · 쉬지 않고 이어서 넘은 수를 세요.`));
  }

  // 줄넘기를 할 수 있는 곳인지 (마을 땅 위, 걷고 있을 때)
  function why() {
    if (!v.player) return '잠시 뒤에 다시 해 봐요.';
    if (v.atHome) return '줄넘기는 마을 길에서 할 수 있어요.';
    if (v.swim) return '물속에서는 줄넘기를 할 수 없어요. 물 밖으로 나와요!';
    if (v.mode !== 'play') return '하던 놀이를 마치고 해 봐요.';
    if (document.body.classList.contains('hs-on')) return '숨바꼭질을 마치고 해 봐요.'; // 숨바꼭질을 하는 동안에는(찾는 중, 판 결과 창) 하지 않는다
    return null;
  }

  function jumpRope() {
    const no = why();
    if (no) return { ok: false, why: no };
    stopAll();
    const pl = v.player;
    pl.drop();
    const P = pl.root.position.clone(), rot = pl.root.rotation.y;
    v.placePlayer(P.x, P.z, rot, P.y);
    const F = V(Math.sin(rot), 0, Math.cos(rot)), S = V(Math.cos(rot), 0, -Math.sin(rot));
    const far = portrait() ? 1.08 : 1;
    // 아이 앞 조금 옆에서 본다. 허리 아래를 바라봐서 아이가 화면 가운데 위쪽에 오게 한다 (아래에는 숫자판과 단추가 있다)
    const game = { cam: { pos: P.clone().addScaledVector(F, 8.0 * far).addScaledVector(S, 4.0 * far).setY(P.y + 3.2 * far), look: P.clone().setY(P.y + 0.6) }, camSpeed: 3 };
    const rig = ropeRig(pl);
    const REST = Math.PI + Math.PI / 3; // 쉬는 동안 줄은 발뒤꿈치 뒤 땅에
    let st = 'idle', T = 0, perfAt = performance.now(), theta = REST, omega = 0, n = 0, tj = -9, t0 = 0, waitT = 0, failWhy = '', trip = 0;
    let best = null, bestToday = null, saving = false;
    const now = () => T + Math.min(0.1, (performance.now() - perfAt) / 1000); // 눌린 때 (화면 사이 시간까지 잰다)
    const hgtAt = (t) => { const tau = t - tj; return tau >= 0 && tau <= JR.AIR ? JR.H * Math.sin((Math.PI * tau) / JR.AIR) : 0; };
    const period = () => Math.max(JR.PMIN, JR.P0 - n * JR.STEP);

    // 화면: 큰 수, 줄 각도 판, 내 기록
    const dial = h('div', { class: 'jr-dial' });
    dial.innerHTML = dialSvg();
    const zone = dial.querySelector('.jr-zone'), dot = dial.querySelector('.jr-dot');
    const big = h('b', { class: 'jr-count' }, '0');
    const sub = h('span', { class: 'jr-sub' }, '');
    const panel = h('div', { class: 'jr-panel' }, dial, h('div', { class: 'jr-num' }, big, h('span', { class: 'jr-unit' }, '번'), sub));
    const drawSub = () => { sub.textContent = best == null ? '' : `내 최고 ${best}번${bestToday ? ` · 오늘 ${bestToday}번` : ''}`; };
    function drawDial() {
      const a = ((theta % TAU) + TAU) % TAU;
      dot.setAttribute('transform', `rotate(${((a * 180) / Math.PI).toFixed(1)})`);
      // 지금 빠르기에서 누르면 알맞은 때: 줄이 발밑에 오기 0.33초 전부터 0.07초 전까지
      const w = TAU / period();
      const a1 = Math.PI - Math.min(Math.PI * 0.95, w * 0.33), a2 = Math.PI - w * 0.07;
      zone.setAttribute('d', `M ${onRing(a1, 40)} A 40 40 0 0 1 ${onRing(a2, 40)}`);
    }
    function idle(msg) {
      st = 'idle';
      theta = REST; omega = 0;
      pl.body.rotation.x = 0;
      ui.setPanel(panel);
      drawDial();
      ui.say(msg || '줄이 발밑에 오기 조금 전에 ‘뛰기’를 눌러요. 컴퓨터는 스페이스바도 돼요.');
      ui.setMain(n ? '다시 하기' : '시작', { pulse: true, onClick: () => start() });
    }
    function start() {
      if (st === 'turn' || st === 'ready') return;
      n = 0; tj = -9; failWhy = '';
      big.textContent = '0';
      st = 'ready'; waitT = 0;
      theta = REST;
      ui.say('줄을 돌려요! 발밑에 올 때 뛰어요.');
      ui.setMain('뛰기!', { onClick: () => {} }); // 누르는 순간(pointerdown)에 뛴다
    }
    function hop() {
      if (st !== 'turn' && st !== 'ready') return;
      const t = now();
      if (t - tj < JR.AIR) return; // 아직 공중
      tj = t;
      sfx.hop();
    }
    function pass(tp) {
      // 줄이 발밑을 지나는 때 tp: 몸이 떠 있으면 넘었다
      const hgt = hgtAt(tp);
      if (hgt >= JR.H * JR.CLEAR) {
        n++;
        big.textContent = String(n);
        big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump');
        sfx.tick();
        if (n % 10 === 0) { sfx.ding(); ui.banner(`${n}번!`, n >= 50 ? '대단해요!' : '잘하고 있어요!', 900); }
        if (best != null && n === best + 1 && best > 0) ui.banner('새 기록!', `${n}번째`, 1000);
        omega = TAU / period();
        return true;
      }
      // 왜 걸렸는지: 막 뛰려던 참이면 늦었고, 벌써 내려왔으면 일렀고, 한참 안 뛰었으면 박자를 놓쳤다
      const tau = tp - tj;
      failWhy = tau >= 0 && tau <= JR.AIR / 2 ? 'late' : tau > JR.AIR / 2 && tau < JR.AIR + 0.5 ? 'early' : 'none';
      return false;
    }
    async function finish() {
      st = 'trip'; trip = 0;
      sfx.bonk();
      const ms = Math.round((T - t0) * 1000);
      const tip = failWhy === 'early' ? '조금 늦게 뛰어 봐요! 줄이 발 바로 앞에 왔을 때요.'
        : failWhy === 'late' ? '조금만 더 일찍 뛰어 봐요!'
          : '줄이 발밑에 오기 조금 전에 ‘뛰기’를 눌러요.';
      let note = n === 0 ? '줄에 걸렸어요!' : '';
      let r = null;
      if (n > 0 && features().jrope && !saving) {
        saving = true;
        try { r = await rpc('kids_jr_save', { p_token: getToken(), p_count: n, p_ms: ms }); } catch (e) { if (lost(e)) return; note = message(e); }
        saving = false;
        if (!live(game)) return;
      }
      if (r) {
        best = r.best; bestToday = r.best_today;
        const king = r.king;
        note = king ? '오늘의 줄넘기 왕이에요!' : r.new_best ? '내 최고 기록이에요!' : r.today_best_new ? '오늘 내 최고 기록이에요!' : `내 최고 ${r.best}번`;
        if (king || r.new_best) { confetti(); onCelebrate(); pl.celebrate(); } else if (r.today_best_new) sfx.success();
      } else if (n > 0 && !features().jrope) {
        if (best == null || n > best) { best = n; note = '이번에 가장 많이 넘었어요!'; }
      }
      drawSub();
      ui.banner(n ? `${n}번 넘었어요!` : '앗!', note, 2600);
      setTimeout(() => { if (live(game) && st === 'trip') idle(tip); }, 1300);
    }

    let curH = 0; // 지금 뛰어오른 높이 (자세 함수가 쓴다)
    game.update = (dt) => {
      T += dt;
      perfAt = performance.now();
      let hgt = hgtAt(T);
      if (st === 'ready') {
        waitT += dt;
        if (waitT >= 0.5) { st = 'turn'; omega = TAU / JR.P0; t0 = T; }
      } else if (st === 'turn') {
        const prev = theta;
        theta += omega * dt;
        // 이번 화면 사이에 줄이 발밑(π의 홀수 배)을 지났는지
        const k = Math.ceil((prev - Math.PI) / TAU - 1e-9);
        const bottom = Math.PI + k * TAU;
        if (prev < bottom && theta >= bottom) {
          const tp = T - dt + (bottom - prev) / omega;
          if (!pass(tp)) { theta = bottom; hgt = 0; finish(); }
        }
      } else if (st === 'trip') {
        trip = Math.min(1, trip + dt * 3);
        hgt = 0;
      }
      curH = st === 'trip' ? 0 : hgt;
      drawDial();
    };
    // 자세: 아바타가 걷기 흔들림을 정한 뒤에 덮어쓴다 (줄은 손 자리가 정해진 다음에 그린다)
    const ropePose = (a) => {
      ropeArms(a, theta, curH);
      if (st === 'trip') { a.body.rotation.x = 0.04 + 0.22 * Math.sin(trip * Math.PI); a.arms[0].rotation.x = a.arms[1].rotation.x = -0.32 - 0.6 * trip; }
      rig.update(theta);
    };
    game.onTap = () => hop();
    game.debug = () => ({ st, theta, omega, n, T, tj }); // 시험용
    const kd = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        if (st === 'idle') start(); else hop();
      }
    };
    game.stop = () => {
      window.removeEventListener('keydown', kd);
      rig.dispose();
      pl.pose = null;
      pl.body.rotation.x = 0;
    };
    begin('jrope', '줄넘기', game, [], -1, [['star', '기록판', board]]);
    pl.pose = ropePose;
    window.addEventListener('keydown', kd);
    ui.main.addEventListener('pointerdown', (e) => { if (st === 'turn' || st === 'ready') { e.preventDefault(); hop(); } });
    idle();
    // 지난 기록을 불러와 보여 준다
    if (features().jrope) {
      rpc('kids_jr_board', { p_token: getToken() }).then((b) => { if (!live(game) || !b) return; best = b.best || 0; bestToday = b.best_today || 0; drawSub(); }).catch((e) => { lost(e); });
    }
    return { ok: true };
  }
  return { jumpRope, board };
}
