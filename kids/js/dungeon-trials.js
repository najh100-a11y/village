// 진숲 어린이 마을 — 새벽 동굴의 시험 (방 하나에 시험 하나)
// 시험마다 같은 모양으로 만든다: makeTrial(kind, T)는 { begin, update, onPointer, onKey, onPray, win, stop, ownsDrag, info }를 돌려준다.
// T는 동굴(dungeon.js)이 주는 도구다: 단계(lv), 씨앗 난수(rng), 소품을 놓을 곳(props), 빛 가루(sparks), 내 주민(me),
// 말(say), 큰 글(banner), 판(body), 다치기(hurt), 통과(clear), 이름표(label, place), 화면 자리(screenOf, groundAt) 같은 것.
// 친구와 함께 할 때도 시험은 아이마다 자기 화면에서 따로 한다 (같은 씨앗이라 같은 문제가 같은 차례로 나온다).
import * as THREE from './three.module.min.js';
import { h } from './ui.js';
import { sfx, pianoKey } from './sound.js';
import { TRUTHS, LIES, SWORD_VERSES, DOUBTS, PROMISES, ACCUSE } from './dungeon-data.js';
import { makeDoor, makeStone, makeShadow, bobShadow, makeArrow, makeBubble, makeLamb, makeLightPool, makeBlob, makeWarn, makeWave, disposeObj, glowMat } from './dungeon-scene.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
function shuffleR(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const pickN = (a, n, r) => shuffleR(a, r).slice(0, n);
const NORTH = Math.PI; // 북쪽(-z)을 보는 방향
const lvOf = (T, arr) => arr[clamp(T.lv, 1, 3) - 1];

// ---------- 진리의 허리띠: 참말 길 ----------
function trialBelt(T) {
  const n = lvOf(T, [3, 4, 5]);
  const pairs = pickN(TRUTHS, n, T.rng).map(([t, f, ref]) => ({ t, f, ref, left: T.rng() < 0.5 }));
  const home = { x: T.slotX, z: 2.0 };
  const doors = [-1, 1].map((s) => { const d = makeDoor(); d.position.set(s * 1.8, 0, -2.6); T.props.add(d); return d; });
  // 문 앞 돌길
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 8), glowMat('#6E6690'));
    st.position.set(s * (0.5 + i * 0.45), 0.03, 1.0 - i * 0.95);
    T.props.add(st);
  }
  const tags = doors.map((d, i) => T.label(i ? '오른쪽 문' : '왼쪽 문', 'dg-tag'));
  let k = 0, busy = false, started = false;
  const wrong = new Set();
  T.me.place(home.x, home.z, NORTH);
  const texts = () => { const p = pairs[k]; return p.left ? [p.t, p.f] : [p.f, p.t]; };
  const truthSide = () => (pairs[k].left ? 0 : 1);
  function draw() {
    const tx = texts();
    const btn = (i) => h('button', { class: 'dg-choice' + (wrong.has(i) ? ' bad' : ''), type: 'button', disabled: !started || busy || wrong.has(i), onclick: () => choose(i) },
      h('b', {}, i ? '오른쪽 문 ▶' : '◀ 왼쪽 문'), h('span', {}, tx[i]));
    T.body(h('p', { class: 'dg-step' }, `갈림길 ${k + 1}/${n}`), h('div', { class: 'dg-choices' }, btn(0), btn(1)));
  }
  function resetDoors() { for (const d of doors) d.userData.inner.material.color.set('#141022'); }
  function choose(i) {
    if (!started || busy || wrong.has(i) || !T.alive()) return;
    busy = true;
    draw();
    const d = doors[i];
    T.me.walkTo(d.position.x, d.position.z + 1.05, () => {
      if (i === truthSide()) {
        d.userData.inner.material.color.set('#FFE58A');
        T.sparks.burst(V(d.position.x, 1.5, d.position.z + 0.3), '#FFF3B0', 18);
        sfx.success();
        T.banner('참말이에요!', pairs[k].ref, 1500);
        T.me.walkTo(d.position.x, d.position.z - 0.1, () => {
          k++;
          if (k >= n) { T.clear(); return; }
          T.fadeSwap(() => { T.me.place(home.x, home.z, NORTH); resetDoors(); wrong.clear(); busy = false; draw(); T.say('다음 갈림길이에요. 참말이 쓰인 문을 골라요.'); });
        }, 2.2);
      } else {
        d.userData.inner.material.color.set('#4D4766');
        T.sparks.burst(V(d.position.x, 1.3, d.position.z + 0.5), '#6A5E8E', 16, 0.8, 0.7);
        sfx.bonk();
        wrong.add(i);
        T.hurt('거짓말 안개에 마음이 다쳤어요');
        T.say(`거짓말 문이었어요. 다른 문에 쓰인 말이 참말이에요 (${pairs[k].ref}).`);
        T.me.walkTo(home.x, home.z, () => { T.me.face(NORTH); busy = false; draw(); });
      }
    });
  }
  draw();
  return {
    begin() { started = true; draw(); T.say('참말이 쓰인 문을 골라요. 아래 단추나 ← → 자판으로 골라요.'); },
    update() { doors.forEach((d, i) => T.place(tags[i], d.position, 3.25)); },
    onKey(code) {
      if (code === 'ArrowLeft' || code === 'KeyA') { choose(0); return true; }
      if (code === 'ArrowRight' || code === 'KeyD') { choose(1); return true; }
      return false;
    },
    info: () => ({ k, n, truth: k < n ? truthSide() : -1, busy, started }),
  };
}

// ---------- 의의 흉배: 빛 가운데 서기 ----------
function trialBreast(T) {
  const R = lvOf(T, [1.9, 1.65, 1.45]), sp = lvOf(T, [0.8, 1.0, 1.2]), dur = lvOf(T, [20, 25, 30]), every = lvOf(T, [1.05, 0.88, 0.75]);
  const home = { x: T.slotX, z: 0.6 };
  T.me.place(home.x, home.z, NORTH);
  const pool = makeLightPool(R);
  T.props.add(pool);
  const ph = T.rng() * 10;
  const c = V();
  const centerAt = (t, out) => out.set(Math.sin(0.37 * t * sp + ph) * 2.2 + Math.sin(0.91 * t * sp + 1 + ph) * 0.6, 0, -0.6 + Math.sin(0.53 * t * sp + 2 + ph) * 1.5);
  centerAt(0, c);
  pool.position.copy(c);
  let started = false, done = false, t = 0, spawnT = 0.8, held = false, saved = 0;
  const aim = V();
  const drops = [];
  const fill = h('i');
  const bar = h('div', { class: 'dg-bar time' }, fill);
  const info = h('p', { class: 'dg-step' }, '빛 안에 서 있으면 참소가 녹아요');
  T.body(info, bar);
  function spawn() {
    const p = T.me.pos;
    const near = T.rng() < 0.6;
    const a = T.rng() * TAU, d = near ? T.rng() * 1.1 : 1 + T.rng() * 4;
    const bx = near ? p.x : c.x, bz = near ? p.z : c.z;
    const x = clamp(bx + Math.cos(a) * d, -4.6, 4.6), z = clamp(bz + Math.sin(a) * d, -4.4, 2.6);
    const warn = makeWarn();
    warn.position.set(x, 0.08, z);
    T.props.add(warn);
    const blob = makeBlob();
    blob.position.set(x, 8, z);
    T.props.add(blob);
    const label = T.label(ACCUSE[Math.floor(T.rng() * ACCUSE.length)], 'dg-accuse');
    drops.push({ x, z, warn, blob, label, t: 0, fall: 1.35 });
  }
  function drop(d) { disposeObj(d.warn); disposeObj(d.blob); T.unlabel(d.label); }
  function finish() {
    done = true;
    for (const d of drops) { T.sparks.burst(d.blob.position, '#FFF3B0', 6); drop(d); }
    drops.length = 0;
    T.me.dress.setRobe(false);
    T.clear();
  }
  return {
    ownsDrag: true,
    begin() {
      started = true;
      T.me.dress.setRobe(true);
      T.sparks.burst(V(T.me.pos.x, 1.2, T.me.pos.z), '#FFFBEA', 24, 0.8, 1.6);
      sfx.success();
      T.say('예수님의 의를 입었어요! 움직이는 빛을 따라가요. 화면을 누르고 있으면 그쪽으로 걸어요(컴퓨터는 방향키).');
    },
    update(dt) {
      if (!started || done) return;
      t += dt;
      centerAt(t, c);
      pool.position.copy(c);
      if (T.alive()) T.me.steer(dt, held ? aim : null, { x: 0, z: -0.8, r: 5.2 });
      spawnT -= dt;
      if (spawnT <= 0 && t < dur - 1.2) { spawn(); spawnT = every * (0.8 + T.rng() * 0.4); }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.t += dt;
        const k = d.t / d.fall;
        d.warn.scale.setScalar(0.6 + Math.min(1, k) * 0.7);
        d.blob.position.y = Math.max(0.3, 8 * (1 - k * k));
        T.place(d.label, d.blob.position, 0.55);
        const inLight = Math.hypot(d.x - c.x, d.z - c.z) < R;
        if (inLight && d.blob.position.y < 3.6) { // 빛 기둥에 닿으면 녹는다
          T.sparks.burst(d.blob.position, '#FFF3B0', 10, 0.6, 0.8);
          drop(d); drops.splice(i, 1);
          continue;
        }
        if (k >= 1) {
          const p = T.me.pos;
          if (T.alive() && Math.hypot(p.x - d.x, p.z - d.z) < 0.8) {
            if (Math.hypot(p.x - c.x, p.z - c.z) < R) { saved++; T.sparks.burst(V(p.x, 1.6, p.z), '#FFF3B0', 10); }
            else T.hurt('참소에 맞았어요. 빛 안으로 들어가요!');
          }
          T.sparks.burst(V(d.x, 0.3, d.z), '#4A3D6E', 8, 0.6, 0.5);
          drop(d); drops.splice(i, 1);
        }
      }
      fill.style.width = `${Math.max(0, (1 - t / dur) * 100).toFixed(1)}%`;
      info.textContent = `빛 안에 서 있어요 · ${Math.max(0, Math.ceil(dur - t))}초`;
      if (t >= dur) finish();
    },
    onPointer(type, x, y) {
      if (type === 'down' || (type === 'move' && held)) { const g = T.groundAt(x, y); if (g) { aim.copy(g); held = true; } }
      else if (type === 'up') held = false;
    },
    stop() { T.me.dress.setRobe(false); for (const d of drops) drop(d); drops.length = 0; },
    info: () => ({ t, dur, drops: drops.length, light: [c.x, c.z], R, saved }),
  };
}

// ---------- 평안의 복음의 신: 빛의 징검다리 ----------
const NOTES = [72, 74, 76, 67, 69, 71, 60, 62, 64];
function trialShoes(T) {
  const rounds = lvOf(T, [[3, 3, 4], [3, 4, 5], [4, 5, 6]]);
  const SP = 1.55, C = { x: 0, z: -1.2 };
  const near = { x: T.slotX, z: C.z + SP + 2.1 }, far = { x: 0, z: C.z - SP - 1.9 };
  T.me.place(near.x, near.z, NORTH);
  // 어두운 물웅덩이 (둥근 물과 조금 밝은 물가)
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.4, 44), new THREE.MeshBasicMaterial({ color: '#142C4C' }));
  water.material.userData.own = true;
  water.rotation.x = -Math.PI / 2;
  water.position.set(C.x, 0.06, C.z);
  T.props.add(water);
  const shore = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.62, 44), new THREE.MeshBasicMaterial({ color: '#3E6A96' }));
  shore.material.userData.own = true;
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(C.x, 0.062, C.z);
  T.props.add(shore);
  const stones = [...Array(9)].map((_, i) => {
    const s = makeStone();
    const col = i % 3, row = Math.floor(i / 3);
    s.position.set(C.x + (col - 1) * SP, 0.1, C.z + (row - 1) * SP);
    s.userData.k = 0;
    s.userData.col = '#FFE58A';
    T.props.add(s);
    return s;
  });
  let round = 0, seq = [], pos = 0, phase = 'wait', showT = 0, showI = -1, busy = false, lamb = null, done = false;
  const gridBtns = [];
  const step = h('p', { class: 'dg-step' }, '');
  const grid = h('div', { class: 'dg-grid' }, [...Array(9)].map((_, i) => {
    const b = h('button', { class: 'dg-cell', type: 'button', 'aria-label': `${Math.floor(i / 3) + 1}째 줄 ${(i % 3) + 1}째 돌`, onpointerdown: (e) => { e.preventDefault(); press(i); } });
    gridBtns.push(b);
    return b;
  }));
  T.body(step, grid);
  function newSeq() {
    const n = rounds[round];
    seq = [];
    while (seq.length < n) { const x = Math.floor(T.rng() * 9); if (seq[seq.length - 1] !== x) seq.push(x); }
  }
  function light(i, col = '#FFE58A') {
    const s = stones[i];
    s.userData.k = 1;
    s.userData.col = col;
    gridBtns[i].classList.add('on');
    gridBtns[i].classList.toggle('bad', col !== '#FFE58A');
    if (col === '#FFE58A') pianoKey(NOTES[i], { vel: 0.8 });
  }
  function drawStep() { step.textContent = phase === 'show' ? `${round + 1}/${rounds.length}번째 다리 · 빛나는 차례를 잘 봐요` : phase === 'input' ? `${round + 1}/${rounds.length}번째 다리 · ${pos}/${seq.length}칸 건넜어요` : `${Math.min(round + 1, rounds.length)}/${rounds.length}번째 다리`; }
  function show() { phase = 'show'; showI = -1; showT = 0.7; drawStep(); T.say('징검돌이 빛나는 차례를 잘 봐요!'); }
  function press(i) {
    if (phase !== 'input' || busy || done || !T.alive()) return;
    if (i === seq[pos]) {
      light(i);
      busy = true;
      T.me.hopTo(stones[i].position.x, stones[i].position.z, () => {
        busy = false;
        pos++;
        drawStep();
        if (pos >= seq.length) roundDone();
      });
    } else {
      light(i, '#FF6A6A');
      sfx.splash();
      T.sparks.burst(V(stones[i].position.x, 0.3, stones[i].position.z), '#7EC8F2', 12, 0.7, 1.2);
      T.hurt('징검돌을 잘못 밟았어요');
      busy = true;
      phase = 'move';
      T.me.hopTo(near.x, near.z, () => { busy = false; T.me.face(NORTH); show(); });
    }
  }
  function roundDone() {
    sfx.success();
    round++;
    phase = 'move';
    busy = true;
    if (round >= rounds.length) {
      lamb = makeLamb();
      lamb.position.set(far.x + 0.9, 0, far.z - 0.2);
      lamb.rotation.y = -0.6;
      T.props.add(lamb);
      T.sparks.burst(V(lamb.position.x, 0.8, lamb.position.z), '#FFFBEA', 16);
      lamb.userData.baa = T.label('매애~', 'dg-tag');
      T.me.hopTo(far.x, far.z, () => {
        done = true;
        T.me.face(Math.PI / 2);
        T.banner('길 잃은 양을 찾았어요!', '말씀의 빛을 따라 끝까지 건넜어요', 2200);
        setTimeout(() => T.clear(), 1500);
      });
      return;
    }
    T.banner(`${round}/${rounds.length} 건넜어요!`, '', 1200);
    T.me.hopTo(far.x, far.z, () => {
      T.fadeSwap(() => { T.me.place(near.x, near.z, NORTH); busy = false; newSeq(); show(); });
    });
  }
  newSeq();
  drawStep();
  return {
    ownsDrag: true,
    begin() { show(); },
    update(dt) {
      for (let i = 0; i < 9; i++) {
        const s = stones[i];
        s.userData.k = Math.max(0, s.userData.k - dt * 1.8);
        const k = s.userData.k;
        s.material.emissive.set(s.userData.col).multiplyScalar(k * 0.9);
        s.position.y = 0.1 + k * 0.05;
        if (k <= 0.01) gridBtns[i].classList.remove('on', 'bad');
      }
      if (phase === 'show') {
        showT -= dt;
        if (showT <= 0) {
          showI++;
          if (showI < seq.length) { light(seq[showI]); showT = lvOf(T, [0.72, 0.62, 0.55]); }
          else { phase = 'input'; pos = 0; drawStep(); T.say('이제 같은 차례로 돌을 눌러 건너요! (화면의 돌이나 아래 단추)'); }
        }
      }
      if (lamb && lamb.userData.baa) T.place(lamb.userData.baa, lamb.position, 1.25);
    },
    onPointer(type, x, y) {
      if (type !== 'down' || phase !== 'input') return;
      let best = -1, bd = 52;
      stones.forEach((s, i) => { const q = T.screenOf(s.position); const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) press(best);
    },
    onKey(code) {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (!m) return false;
      const n = Number(m[1]); // 숫자판 모양: 7 8 9 가 맨 위(먼 쪽) 줄
      press((2 - Math.floor((n - 1) / 3)) * 3 + ((n - 1) % 3));
      return true;
    },
    info: () => ({ round, rounds: rounds.length, seq, pos, phase, busy }),
  };
}

// ---------- 믿음의 방패: 화전 막기 ----------
const LANE_X = [-2.6, 0, 2.6];
function trialShield(T) {
  const need = lvOf(T, [8, 12, 16]), every = lvOf(T, [1.6, 1.25, 1.0]), travel = lvOf(T, [1.5, 1.25, 1.05]);
  const home = { x: T.slotX, z: 1.9 };
  T.me.place(home.x, home.z, NORTH);
  const archers = LANE_X.map((x) => { const a = makeShadow('archer', 0.95); a.position.set(x, 0, -4.6); T.props.add(a); return { obj: a, wind: 0, lane: 0 }; });
  archers.forEach((a, i) => { a.lane = i; });
  const arrows = [];
  let started = false, done = false, blocked = 0, nextT = 1.2, raise = -1, raiseT = 0, last = [-1, -1], t = 0;
  const count = h('b', { class: 'dg-count' }, `0/${need}`);
  const laneBtn = (i, label) => h('button', { class: 'dg-lane', type: 'button', onpointerdown: (e) => { e.preventDefault(); lift(i); } }, label);
  const lanes = h('div', { class: 'dg-lanes' }, laneBtn(0, '◀ 왼쪽'), laneBtn(1, '▲ 가운데'), laneBtn(2, '오른쪽 ▶'));
  T.body(h('p', { class: 'dg-step' }, '막은 불화살 ', count), lanes);
  const shieldPos = (lane) => { const a = archers[lane].obj.position, p = T.me.pos; const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz) || 1; return V(p.x + (dx / d) * 0.55, 1.05, p.z + (dz / d) * 0.55); };
  function lift(i) {
    if (!started || done || !T.alive()) return;
    raise = i;
    raiseT = 0.55;
    const a = archers[i].obj.position, p = T.me.pos;
    T.me.face(Math.atan2(a.x - p.x, a.z - p.z));
    T.me.dress.st.guardTo = 1;
    T.me.act('guard', 0.55);
    lanes.children[i].classList.add('on');
    setTimeout(() => lanes.children[i].classList.remove('on'), 200);
  }
  function shoot(lane) {
    const a = archers[lane].obj.position;
    const o = makeArrow();
    const from = V(a.x, 1.05, a.z + 0.4);
    o.position.copy(from);
    T.props.add(o);
    arrows.push({ o, lane, t: 0, from, to: shieldPos(lane) });
    sfx.whoosh();
  }
  function finish() {
    done = true;
    for (const a of arrows) { T.sparks.burst(a.o.position, '#9FE0FF', 6); disposeObj(a.o); }
    arrows.length = 0;
    // 화살을 다 막으면 그림자들은 빛 가루로 흩어진다
    for (const a of archers) { a.wind = 0; T.sparks.burst(V(a.obj.position.x, 0.9, a.obj.position.z), '#C9B2F7', 16, 0.9, 1.1); a.obj.visible = false; }
    T.me.dress.st.guardTo = 0;
    T.clear();
  }
  return {
    begin() { started = true; T.say('불화살이 오는 쪽 단추(← ↑ →)를 눌러 믿음의 방패를 들어요!'); },
    update(dt) {
      t += dt;
      archers.forEach((a, i) => {
        bobShadow(a.obj, t, i * 1.3);
        if (a.wind > 0 && !done) {
          a.wind -= dt;
          a.obj.scale.setScalar(0.95 * (1 + Math.sin((0.4 - a.wind) * 30) * 0.04));
          if (a.wind <= 0) { a.obj.scale.setScalar(0.95); shoot(i); }
        }
      });
      if (!started || done) return;
      if (raiseT > 0) { raiseT -= dt; if (raiseT <= 0) { raise = -1; T.me.dress.st.guardTo = 0; } }
      nextT -= dt;
      if (nextT <= 0 && blocked + arrows.length < need + 1) {
        let lane = Math.floor(T.rng() * 3);
        if (last[0] === lane && last[1] === lane) lane = (lane + 1 + Math.floor(T.rng() * 2)) % 3;
        last = [last[1], lane];
        archers[lane].wind = 0.4;
        nextT = every * (0.85 + T.rng() * 0.3);
      }
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        a.t += dt;
        const k = Math.min(1, a.t / travel);
        a.o.position.lerpVectors(a.from, a.to, k);
        a.o.position.y += Math.sin(Math.PI * k) * 0.6;
        a.o.lookAt(a.to);
        a.o.userData.fire.scale.set(1 + Math.sin(t * 40) * 0.15, 1, 1.6);
        if (k >= 1) {
          if (raise === a.lane && raiseT > 0 && T.alive()) {
            blocked++;
            count.textContent = `${blocked}/${need}`;
            T.sparks.burst(a.to, '#9FE0FF', 14, 0.9, 1);
            sfx.pop();
            const pop = T.label('소멸!', 'dg-pop');
            T.flash(pop, a.to);
          } else {
            T.sparks.burst(a.to, '#FF9A3C', 12, 0.8, 0.9);
            if (T.alive()) T.hurt('불화살에 맞았어요');
          }
          disposeObj(a.o);
          arrows.splice(i, 1);
          if (blocked >= need) { finish(); return; }
        }
      }
    },
    onKey(code) {
      const i = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2 }[code];
      if (i == null) return false;
      lift(i);
      return true;
    },
    stop() { for (const a of arrows) disposeObj(a.o); arrows.length = 0; T.me.dress.st.guardTo = 0; },
    info: () => ({ blocked, need, arrows: arrows.map((a) => ({ lane: a.lane, k: a.t / travel })), raise, raiseT }),
  };
}

// ---------- 구원의 투구: 의심 방울 터뜨리기 ----------
function trialHelmet(T) {
  const need = lvOf(T, [8, 12, 16]), speed = lvOf(T, [1.2, 1.5, 1.8]), every = lvOf(T, [1.45, 1.2, 1.0]);
  const home = { x: T.slotX, z: 1.5 };
  T.me.place(home.x, home.z, NORTH);
  const head = V(home.x, 1.75, home.z);
  const bubbles = [];
  let started = false, done = false, popped = 0, nextT = 0.6, t = 0, goodRun = 0;
  const count = h('b', { class: 'dg-count' }, `0/${need}`);
  T.body(h('p', { class: 'dg-step' }, '터뜨린 의심 방울 ', count), h('p', { class: 'dg-hint' }, '어두운 방울은 눌러서 펑! 반짝이는 약속 방울은 그대로 받아요.'));
  function spawn() {
    const good = goodRun < 2 && T.rng() < 0.3;
    goodRun = good ? goodRun + 1 : 0;
    const a = -Math.PI / 2 + (T.rng() - 0.5) * 2.1; // 북쪽 반원
    const r = 6.2;
    const o = makeBubble(good);
    o.position.set(head.x + Math.cos(a) * r, 1.2 + T.rng() * 1.8, head.z + Math.sin(a) * r);
    T.props.add(o);
    const text = good ? PROMISES[Math.floor(T.rng() * PROMISES.length)] : DOUBTS[Math.floor(T.rng() * DOUBTS.length)];
    const label = T.label(text, good ? 'dg-promise' : 'dg-doubt');
    bubbles.push({ o, good, text, label, sp: speed * (0.85 + T.rng() * 0.3), ph: T.rng() * 6 });
  }
  function remove(b) { const i = bubbles.indexOf(b); if (i >= 0) bubbles.splice(i, 1); disposeObj(b.o); T.unlabel(b.label); }
  function pop(b) {
    if (b.good) {
      T.sparks.burst(b.o.position, '#FFE58A', 10, 0.6, 0.6);
      remove(b);
      sfx.fail();
      T.hurt('약속 방울은 터뜨리지 말고 받아요');
      return;
    }
    T.sparks.burst(b.o.position, '#8E7BC4', 14, 0.9, 0.8);
    remove(b);
    sfx.pop();
    popped++;
    count.textContent = `${popped}/${need}`;
    if (popped >= need) {
      done = true;
      for (const x of [...bubbles]) { T.sparks.burst(x.o.position, x.good ? '#FFE58A' : '#8E7BC4', 6); remove(x); }
      T.clear();
    }
  }
  return {
    ownsDrag: true,
    begin() { started = true; T.say('어두운 의심 방울을 눌러 터뜨려요. 반짝이는 약속 방울은 받아요!'); },
    update(dt) {
      if (!started || done) return;
      t += dt;
      nextT -= dt;
      if (nextT <= 0) { spawn(); nextT = every * (0.75 + T.rng() * 0.5); }
      const hp = V(T.me.pos.x, 1.75, T.me.pos.z);
      for (const b of [...bubbles]) {
        const p = b.o.position;
        const d = V().subVectors(hp, p);
        const dist = d.length();
        d.normalize();
        p.addScaledVector(d, b.sp * dt);
        p.y += Math.sin(t * 2.4 + b.ph) * 0.25 * dt;
        b.o.scale.setScalar(1 + Math.sin(t * 5 + b.ph) * 0.04);
        T.place(b.label, p, 0.62);
        if (dist < 0.62) {
          if (b.good) {
            T.sparks.burst(hp, '#FFE58A', 16, 0.7, 1.2);
            sfx.fruit();
            T.say(`'${b.text}' 약속을 받았어요!`);
            T.heal();
          } else {
            T.sparks.burst(hp, '#5A4A86', 10, 0.6, 0.6);
            T.hurt('의심이 머리에 닿았어요. 구원의 소망을 붙들어요!');
          }
          remove(b);
        }
      }
    },
    onPointer(type, x, y) {
      if (type !== 'down' || !started || done || !T.alive()) return;
      let best = null, bd = 62;
      for (const b of bubbles) { const q = T.screenOf(b.o.position); const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = b; } }
      if (best) pop(best);
    },
    stop() { for (const b of [...bubbles]) remove(b); },
    info: () => ({ popped, need, bubbles: bubbles.map((b) => ({ good: b.good, d: +b.o.position.distanceTo(V(T.me.pos.x, 1.75, T.me.pos.z)).toFixed(2) })) }),
    // 시험용: 가장 가까운 어두운 방울을 터뜨린다
    debugPop() { const b = bubbles.filter((x) => !x.good)[0]; if (b) pop(b); return !!b; },
  };
}

// ---------- 성령의 검: 말씀으로 물리치기 ----------
function trialSword(T) {
  const need = lvOf(T, [3, 4, 5]), approach = lvOf(T, [14, 11, 9]);
  const home = { x: T.slotX, z: 1.9 };
  T.me.place(home.x, home.z, NORTH);
  const lies = pickN(LIES, need, T.rng);
  const keys = Object.keys(SWORD_VERSES);
  let idx = 0, state = 'wait', p = 0, fleeT = 0, gapT = 0, t = 0, shadow = null, say = null, beam = null, beamT = 0;
  const z0 = -5.4, z1 = home.z - 1.35;
  const count = h('b', { class: 'dg-count' }, `0/${need}`);
  const lieEl = h('p', { class: 'dg-lie-line' }, '');
  const cardsEl = h('div', { class: 'dg-vcards' });
  T.body(h('p', { class: 'dg-step' }, '물리친 그림자 ', count), lieEl, cardsEl);
  function cardsFor(lie) {
    const others = shuffleR(keys.filter((k) => k !== lie[2]), T.rng).slice(0, 2);
    const list = shuffleR([lie[2], ...others], T.rng);
    cardsEl.replaceChildren(...list.map((k) => {
      const vv = SWORD_VERSES[k];
      return h('button', { class: 'dg-vcard', type: 'button', onclick: (e) => pick(k, e.currentTarget) }, h('span', {}, vv.text), h('cite', {}, vv.ref));
    }));
  }
  function next() {
    if (idx >= need) return;
    const lie = lies[idx];
    shadow = makeShadow('shadow', 1.05);
    shadow.position.set(home.x * 0.3, 0, z0);
    T.props.add(shadow);
    say = T.label(`${lie[0]}: “${lie[1]}”`, 'dg-lie');
    lieEl.textContent = `${lie[0]}: “${lie[1]}”`;
    cardsFor(lie);
    p = 0;
    state = 'come';
    T.sparks.burst(V(shadow.position.x, 1, z0), '#4A3D6E', 10, 0.6, 0.6);
  }
  function pick(k, btn) {
    if (state !== 'come' || !T.alive()) return;
    const lie = lies[idx];
    if (k === lie[2]) {
      state = 'strike'; // 검을 휘두르는 동안 다시 눌러도 한 번만
      cardsEl.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      T.me.act('strike', 0.45);
      sfx.whoosh();
      const vv = SWORD_VERSES[k];
      setTimeout(() => {
        if (!shadow || state !== 'strike') return;
        // 말씀의 빛 줄기
        const a = V(T.me.pos.x, 1.2, T.me.pos.z), b = V(shadow.position.x, 0.9, shadow.position.z);
        const len = a.distanceTo(b);
        beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8, 1, true), glowMat('#FFF6C8', 0.8, true));
        beam.position.copy(a).add(b).multiplyScalar(0.5);
        beam.lookAt(b);
        beam.rotateX(Math.PI / 2);
        T.props.add(beam);
        beamT = 0.35;
        T.sparks.burst(b, '#FFF3B0', 22, 1.1, 1.3);
        sfx.success();
        state = 'flee';
        fleeT = 0;
        T.unlabel(say);
        say = T.label('으앗, 말씀이다! 도망가자~', 'dg-lie');
        idx++;
        count.textContent = `${idx}/${need}`;
        T.say(`${vv.ref} 말씀으로 물리쳤어요! 마귀를 대적하면 피한대요 (약 4:7).`);
        cardsEl.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      }, 220);
    } else {
      if (btn) { btn.disabled = true; btn.classList.add('bad'); }
      p = Math.min(0.92, p + 0.22);
      sfx.bonk();
      T.hurt('그 말씀은 이 거짓말에 맞지 않아요');
      T.say('그 말씀도 참 좋은 말씀이에요. 그런데 이 거짓말을 이기는 말씀은 다른 거예요. 다시 골라 봐요!');
    }
  }
  return {
    begin() { next(); T.say('그림자의 거짓말에 맞는 말씀 카드를 골라 성령의 검으로 물리쳐요!'); },
    update(dt) {
      t += dt;
      if (beam) { beamT -= dt; beam.material.opacity = Math.max(0, beamT / 0.35) * 0.8; if (beamT <= 0) { disposeObj(beam); beam = null; } }
      if (!shadow) {
        if (state === 'gap') { gapT -= dt; if (gapT <= 0) next(); }
        return;
      }
      bobShadow(shadow, t);
      if (state === 'come') {
        if (T.alive()) p += dt / approach;
        shadow.position.z = z0 + (z1 - z0) * ease(p);
        shadow.position.x = home.x * 0.3 + Math.sin(t * 1.3) * 0.4;
        if (p >= 1) {
          T.hurt('그림자가 다가와 마음이 흔들렸어요');
          p = 0.3;
          T.sparks.burst(V(shadow.position.x, 1, shadow.position.z), '#4A3D6E', 10, 0.8, 0.6);
        }
      } else if (state === 'flee') {
        fleeT += dt;
        shadow.position.z -= dt * 6;
        shadow.position.y += dt * 2.2;
        shadow.scale.setScalar(Math.max(0.05, 1.05 * (1 - fleeT / 0.9)));
        shadow.userData.mat.opacity = Math.max(0, 1 - fleeT / 0.9);
        if (fleeT >= 0.9) {
          disposeObj(shadow); shadow = null;
          T.unlabel(say); say = null;
          if (idx >= need) { state = 'done'; T.clear(); return; }
          state = 'gap';
          gapT = 0.7;
          return;
        }
      }
      if (say) T.place(say, shadow.position, 1.75);
    },
    stop() { if (shadow) disposeObj(shadow); if (beam) disposeObj(beam); },
    info: () => ({ idx, need, state, p, key: lies[idx] ? lies[idx][2] : null }),
    debugPick(k) { pick(k || (lies[idx] && lies[idx][2])); },
  };
}

// ---------- 새벽의 방: 끝까지 서기 ----------
function trialDawn(T) {
  const travel = lvOf(T, [2.7, 2.3, 1.95]), gap = lvOf(T, [1.1, 0.95, 0.8]), add = lvOf(T, [18, 15, 13]);
  const home = { x: T.slotX, z: 1.7 };
  T.me.place(home.x, home.z, NORTH);
  const zStart = -7.2, zEnd = home.z - 0.35, zone = [home.z - 1.85, home.z - 0.7];
  let started = false, won = false, wave = null, nextT = 1.0, cd = 0, t = 0, dawnT = 0, guardT = 0, blocks = 0;
  const marker = h('i', { class: 'dg-mark' });
  const zoneEl = h('b', { class: 'dg-zone' });
  const track = h('div', { class: 'dg-track' }, zoneEl, marker);
  const mfill = h('i');
  const meter = h('div', { class: 'dg-bar dawn' }, mfill);
  const mtext = h('span', { class: 'dg-mtext' }, '새벽 0%');
  T.body(h('div', { class: 'dg-meter-row' }, h('span', { 'aria-hidden': 'true' }, '🌙'), meter, h('span', { 'aria-hidden': 'true' }, '🌅'), mtext), track);
  // 초록 칸 자리 (물결이 지나가는 길 위 비율)
  const toK = (z) => (z - zStart) / (zEnd - zStart);
  zoneEl.style.left = `${(toK(zone[0]) * 100).toFixed(1)}%`;
  zoneEl.style.width = `${((toK(zone[1]) - toK(zone[0])) * 100).toFixed(1)}%`;
  function spawn() {
    const o = makeWave(8.6);
    o.position.set(0, 0, zStart);
    T.props.add(o);
    wave = { o, t: 0 };
  }
  function inZone() { return wave && wave.o.position.z >= zone[0] && wave.o.position.z <= zone[1]; }
  function stand() {
    if (!started || won || !T.alive() || cd > 0) return;
    T.me.dress.st.guardTo = 1;
    T.me.act('guard', 0.5);
    guardT = 0.5;
    if (inZone()) {
      for (const b of wave.o.children) T.sparks.burst(V(b.position.x, 0.8, wave.o.position.z), '#FFF3B0', 3, 0.6, 1.2);
      disposeObj(wave.o);
      wave = null;
      nextT = gap;
      blocks++;
      sfx.success();
      T.addDawn(add);
      T.say('잘 섰어요! 물결 사이에 기도하면 새벽이 더 빨리 와요.');
    } else {
      cd = 0.6;
      T.say(wave ? '조금 더 가까이 왔을 때 눌러요! (초록 칸)' : '물결이 오면 눌러요.');
    }
  }
  function win() {
    if (won) return;
    won = true;
    if (wave) { for (const b of wave.o.children) T.sparks.burst(V(b.position.x, 0.8, wave.o.position.z), '#FFF3B0', 3); disposeObj(wave.o); wave = null; }
    T.setMain('', { hidden: true });
    T.me.dress.st.guardTo = 0;
    T.me.act('cheer', 3.5);
    T.me.face(Math.PI);
    T.cam([0, 5.2, 12.5], [0, 2.6, -8]); // 북쪽 문 너머로 떠오르는 해를 바라본다
    sfx.bell();
    T.say('새벽이 와요! 끝까지 섰어요.');
  }
  return {
    begin() {
      started = true;
      T.say('어둠의 물결이 초록 칸에 오면 ‘서기!’를 눌러요. 물결 사이에 기도하면 새벽이 더 빨리 와요.');
      T.setMain('서기!', { onClick: () => stand() });
    },
    update(dt) {
      t += dt;
      const m = T.dawnLevel();
      mfill.style.width = `${(Math.min(1, m) * 100).toFixed(1)}%`;
      mtext.textContent = `새벽 ${Math.min(100, Math.round(m * 100))}%`;
      if (won) {
        dawnT += dt;
        T.cave.setDawn(0.3 + ease(dawnT / 3.2) * 0.7);
        if (dawnT >= 3.4) T.clear(); // 여러 번 불러도 한 번만 통과한다 (아직 '시작'을 안 누른 친구도 누르면 바로 통과)
        return;
      }
      T.cave.setDawn(Math.min(0.3, m * 0.3));
      if (!started) return;
      cd = Math.max(0, cd - dt);
      if (guardT > 0) { guardT -= dt; if (guardT <= 0) T.me.dress.st.guardTo = 0; }
      if (!wave) { nextT -= dt; if (nextT <= 0) spawn(); }
      if (wave) {
        if (T.alive()) wave.t += dt;
        const k = wave.t / travel;
        wave.o.position.z = zStart + (zEnd - zStart) * k;
        wave.o.children.forEach((b, i) => { b.position.y = 0.5 + Math.sin(t * 4 + i) * 0.12; });
        marker.style.left = `${(Math.min(1, k) * 100).toFixed(1)}%`;
        track.classList.toggle('hot', inZone());
        T.setMain('서기!', { pulse: inZone(), onClick: () => stand() });
        if (k >= 1) {
          T.sparks.burst(V(T.me.pos.x, 0.8, T.me.pos.z), '#3A2D5C', 12, 0.9, 0.5);
          disposeObj(wave.o);
          wave = null;
          nextT = gap;
          T.hurt('어둠의 물결에 밀렸어요');
        }
      } else marker.style.left = '0%';
    },
    onKey(code) { if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { stand(); return true; } return false; },
    onPray() { if (!won) T.addDawn(7); },
    win,
    stop() { if (wave) disposeObj(wave.o); wave = null; },
    info: () => ({ won, blocks, wave: wave ? { z: wave.o.position.z, inZone: inZone() } : null, zone }),
    debugStand: () => stand(),
  };
}

const MAKERS = { belt: trialBelt, breast: trialBreast, shoes: trialShoes, shield: trialShield, helmet: trialHelmet, sword: trialSword, dawn: trialDawn };
export function makeTrial(kind, T) {
  const make = MAKERS[kind];
  if (!make) throw new Error(`no trial ${kind}`);
  const tr = make(T);
  return { ownsDrag: false, pad: false, begin() {}, update() {}, onPointer() {}, onKey: () => false, onPray() {}, win() {}, stop() {}, info: () => ({}), ...tr };
}
