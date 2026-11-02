// 진숲 어린이 마을 — 바닷가 놀이 (수영장 섬)
// 1) 모래사장 보물 캐기: 모래밭 열두 자리 가운데 넷이 40초마다 바뀌며 반짝인다. 반짝이는 곳을 누르면 걸어가서 삽으로 판다.
//    어느 자리가 반짝일지는 마을 시계(Date.now)로 정해서 친구 화면에서도 같은 곳이 반짝인다. 한 자리는 40초에 한 번 팔 수 있다(아이마다).
//    무엇이 나올지는 서버(kids_dig)가 정한다.
// 2) 물수제비 터: 섬 동쪽 작은 나무 다리 끝에서 돌을 던진다. 막대가 가운데 초록 칸에 왔을 때 누를수록 많이 튄다.
//    튄 횟수는 서버(kids_skip_throw)가 아이가 누른 때와 운을 섞어 정하고, 오늘의 물수제비 왕을 보여 준다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeStatic, mergeColored } from './merge.js';
import { JETTY } from './isles.js';
import { SEA_Y } from './sea.js';
import { h, josa, confetti, modal } from './ui.js';
import { sfx } from './sound.js';
import { message } from './api.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';
import { treasureIcon } from './beach-data.js';
import { buildArk } from './ark.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
function mk(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ---------- 보물 캐는 자리 ----------
// 수영장 섬 모래밭 (수영장 둘레 바닥, 야자나무, 선베드, 다리, 북쪽 노아의 방주를 피했다)
export const DIG_SPOTS = [
  [51.5, 3.6], [55.2, 4.6], [58.8, 3.8], [61.8, 2.6], [65.2, -0.4], [64.6, -8.8],
  [61.5, -11.8], [57.0, 6.6], [51.0, -11.2], [46.2, -8.6], [45.4, 0.8], [47.5, 2.6],
].map(([x, z]) => ({ x, z }));
export const DIG_WINDOW = 40; // 초
const DIG_ACTIVE = 4;
export const digWindow = (tSec = Date.now() / 1000) => Math.floor(tSec / DIG_WINDOW);
// w번째 때에 반짝이는 자리 번호 넷
export function activeSpots(w) {
  let s = (Math.imul(w | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const idx = DIG_SPOTS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, DIG_ACTIVE);
}

// 삽: 손에 쥐는 곳이 원점, 날은 아래(-y)
export function makeShovel() {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.02, 0.022, 0.86, 6), toon('#B07F4E'), 0, -0.26, 0));
  g.add(mk(new THREE.BoxGeometry(0.15, 0.04, 0.04), toon('#7A5233'), 0, 0.17, 0));
  const blade = mk(new THREE.BoxGeometry(0.19, 0.24, 0.02), toon('#9AA6B2'), 0, -0.78, 0.01);
  g.add(blade);
  const tip = mk(new THREE.ConeGeometry(0.095, 0.08, 4), toon('#9AA6B2'), 0, -0.93, 0.01);
  tip.rotation.set(Math.PI, Math.PI / 4, 0);
  g.add(tip);
  g.userData.isShovel = true;
  return g;
}
// 삽질: 0.5초에 한 번 꾹 넣었다가 퍼 올린다 (k: 지금까지 판 시간)
export function digPoseAt(av, k) {
  const ph = (k % 0.5) / 0.5;
  const a = ph < 0.45 ? -1.25 + (ph / 0.45) * 0.75 : -0.5 - ((ph - 0.45) / 0.55) * 0.75;
  av.arms[1].rotation.x = a; av.arms[1].rotation.z = 0.12;
  av.arms[0].rotation.x = a + 0.15; av.arms[0].rotation.z = -0.3;
}
export const remoteDigPose = (av, dt, t) => digPoseAt(av, t);

// ---------- 물수제비 터 ----------
// 다리 끝 두 자리 (나와 친구가 나란히 선다), 바다 쪽(+x)을 본다
export const SKIP_STANDS = [{ x: JETTY.x1 - 0.55, z: JETTY.z - 0.38 }, { x: JETTY.x1 - 0.55, z: JETTY.z + 0.38 }];
export const SKIP_FACE = Math.PI / 2;
export function makeStone() {
  const m = mk(new THREE.SphereGeometry(0.085, 12, 8), toon('#8E949C'));
  m.scale.set(1, 0.36, 0.8);
  return m;
}
// 던지기 자세: 팔을 뒤로 젖혔다가(k 0→0.5) 옆으로 휙 (k 0.5→1)
export function throwPoseAt(av, k) {
  const back = k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.5);
  const fwd = k < 0.5 ? 0 : ease((k - 0.5) / 0.5);
  av.arms[1].rotation.x = -0.4 + back * 0.9 - fwd * 1.1;
  av.arms[1].rotation.z = 0.5 + fwd * 0.3;
  av.arms[0].rotation.x = -0.6 - fwd * 0.4; av.arms[0].rotation.z = -0.35;
}
const readyPose = (av) => {
  av.arms[1].rotation.x = -0.55; av.arms[1].rotation.z = 0.45;
  av.arms[0].rotation.x = -0.6; av.arms[0].rotation.z = -0.35;
};

// =====================================================================
// 마을에 놓는 것들: 물수제비 터 다리, 반짝이는 모래, 판 구멍, 캔 보물이 떠오르는 그림
// =====================================================================
export class Beach {
  constructor(world) {
    this.v = world;
    this.dug = new Map(); // 자리 번호 → 판 때(window)
    this.pops = []; // 떠오르는 보물 그림
    this.digging = null;
    this.buildJetty();
    this.buildSpots();
    buildArk(world); // 노아의 방주 짝 맞추기 (섬 북쪽)
  }

  buildJetty() {
    const v = this.v, J = JETTY;
    const g = new THREE.Group();
    const wood = toon('#B07F4E'), light = toon('#C99862'), dark = toon('#7A5233'), pile = toon('#6B4A33');
    const W = J.hw + 0.15, L = J.x1 - J.x0, mid = (J.x0 + J.x1) / 2;
    const n = Math.round(L / 0.5);
    for (let i = 0; i < n; i++) {
      const x = J.x0 + (i + 0.5) * (L / n);
      g.add(mk(new THREE.BoxGeometry(L / n - 0.06, 0.06, W * 2), i % 2 ? wood : light, x, 0.015, J.z));
    }
    g.add(mk(new THREE.BoxGeometry(L, 0.2, W * 2 - 0.2), dark, mid, -0.12, J.z));
    // 난간: 모래밭 쪽에서 끝 가까이까지 (끝은 돌을 던지게 열어 둔다)
    const R0 = J.x0 + 0.6, R1 = J.x1 - 1.3;
    for (const s of [-1, 1]) {
      const z = J.z + s * (W - 0.05);
      g.add(mk(new THREE.BoxGeometry(R1 - R0, 0.09, 0.09), wood, (R0 + R1) / 2, 0.86, z));
      g.add(mk(new THREE.BoxGeometry(R1 - R0, 0.06, 0.06), wood, (R0 + R1) / 2, 0.46, z));
      const m = Math.round((R1 - R0) / 1.6);
      for (let i = 0; i <= m; i++) {
        const x = R0 + (i / m) * (R1 - R0);
        g.add(mk(new THREE.BoxGeometry(0.13, 0.95, 0.13), dark, x, 0.46, z));
        if (x > 69.5) g.add(mk(new THREE.CylinderGeometry(0.11, 0.13, 1.9, 8), pile, x, -0.98, z));
      }
      // 끝 모서리 말뚝 (낮게)
      g.add(mk(new THREE.BoxGeometry(0.14, 0.4, 0.14), dark, J.x1 - 0.08, 0.2, z));
      g.add(mk(new THREE.CylinderGeometry(0.11, 0.13, 1.9, 8), pile, J.x1 - 0.08, -0.98, z));
    }
    mergeColored(g, VC);
    mergeStatic(g);
    v.scene.add(g);
    // 누르면 다리 끝으로 가는 것: 들머리 표지판과 끝의 돌 바구니 (둘 다 물수제비 터 자리 무리에 넣는다)
    const sp = SKIP_STANDS[0];
    const sx = (sp.x + SKIP_STANDS[1].x) / 2, sz = J.z;
    const sg = new THREE.Group();
    // 무리는 바다 쪽(+x)을 본다: 마을 자리 (x, z)는 무리 안에서 (-(z - sz), x - sx)
    const at = (o, x, y, z) => { o.position.set(-(z - sz), y, x - sx); sg.add(o); return o; };
    const sign = v.postSign('물수제비 터', 1.4);
    sign.rotation.y = Math.PI; // 섬 쪽(-x)을 본다
    at(sign, J.x0 + 0.25, 0, J.z + W + 0.35);
    const basket = new THREE.Group();
    basket.add(mk(new THREE.CylinderGeometry(0.24, 0.19, 0.2, 14), toon('#C99862'), 0, 0.1, 0));
    const rim = mk(new THREE.TorusGeometry(0.23, 0.025, 6, 16), toon('#A06E45'), 0, 0.2, 0);
    rim.rotation.x = Math.PI / 2;
    basket.add(rim);
    const stoneMat = toon('#8E949C'), stone2 = toon('#A7ACB3');
    for (let k = 0; k < 6; k++) {
      const st = mk(new THREE.SphereGeometry(0.075, 10, 6), k % 2 ? stoneMat : stone2, Math.cos(k * 1.1) * 0.11, 0.2 + (k % 3) * 0.02, Math.sin(k * 1.1) * 0.11);
      st.scale.set(1, 0.38, 0.8);
      basket.add(st);
    }
    at(basket, J.x1 - 1.0, 0.03, J.z + W - 0.3);
    v.spot('skip', '물수제비 터', sg, { x: sx, z: sz, rot: SKIP_FACE, door: 0 });
  }

  // 반짝이는 모래: 자리마다 작은 모래 둔덕, 빙글 도는 반짝이, 판 구멍. 같은 것끼리 InstancedMesh 하나로 그린다
  buildSpots() {
    const v = this.v, n = DIG_SPOTS.length;
    const IM = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); v.scene.add(m); return m; };
    const mound = new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    mound.scale(1, 0.22, 1);
    this.mMound = IM(mound, toon('#E9C77F'));
    const star = new THREE.OctahedronGeometry(0.13, 0);
    star.scale(0.55, 1.25, 0.55);
    this.mStar = IM(star, new THREE.MeshBasicMaterial({ color: '#FFF4B0' }));
    const hole = new THREE.CircleGeometry(0.36, 18);
    hole.rotateX(-Math.PI / 2);
    this.mHole = IM(hole, new THREE.MeshBasicMaterial({ color: '#B98E4E', transparent: true, opacity: 0.85, depthWrite: false }));
    // 누르는 곳 (보이지 않는다): 반짝일 때만 pick이 붙는다
    this.hits = DIG_SPOTS.map((p, i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set(p.x, 0.25, p.z);
      m.userData.i = i;
      v.scene.add(m);
      v.pickRoots.push(m);
      return m;
    });
    this.M = new THREE.Matrix4();
    this.Q = new THREE.Quaternion();
    this.E = new THREE.Euler();
    this.S = V();
    this.P = V();
  }
  // 지금 반짝이는(내가 아직 안 판) 자리인지
  isActive(i, w = digWindow()) { return activeSpots(w).includes(i) && this.dug.get(i) !== w; }
  markDug(i) { this.dug.set(i, digWindow()); }

  update(dt) {
    const tSec = Date.now() / 1000, w = digWindow(tSec), act = new Set(activeSpots(w));
    const left = DIG_WINDOW - (tSec % DIG_WINDOW); // 이번 때가 끝나기까지
    const { M, Q, E, S, P } = this;
    const put = (im, i, x, y, z, ry, s) => { E.set(0, ry, 0); Q.setFromEuler(E); M.compose(P.set(x, y, z), Q, S.set(s, s, s)); im.setMatrixAt(i, M); };
    DIG_SPOTS.forEach((p, i) => {
      const dug = this.dug.get(i) === w && act.has(i);
      const on = act.has(i) && !dug;
      // 새로 나타날 때와 사라질 때 부드럽게
      const fade = on ? Math.min(1, (tSec % DIG_WINDOW) / 0.8, left / 0.8) : 0;
      put(this.mMound, i, p.x, 0.0, p.z, 0, on ? Math.max(0.001, fade) : 0.001);
      const bob = Math.sin(tSec * 3 + i) * 0.06;
      put(this.mStar, i, p.x, 0.42 + bob, p.z, tSec * 2.2 + i, on ? Math.max(0.001, fade * (0.9 + Math.sin(tSec * 7 + i * 2) * 0.25)) : 0.001);
      put(this.mHole, i, p.x, 0.02, p.z, 0, dug ? Math.max(0.001, Math.min(1, left / 1.5)) : 0.001);
      this.hits[i].userData.pick = on ? { type: 'dig', i } : null;
    });
    for (const im of [this.mMound, this.mStar, this.mHole]) im.instanceMatrix.needsUpdate = true;
    // 튄 모래
    if (this.grains) for (let k = this.grains.length - 1; k >= 0; k--) {
      const g = this.grains[k];
      g.life += dt;
      g.vel.y -= 7 * dt;
      g.m.position.addScaledVector(g.vel, dt);
      if (g.life > 0.7 || g.m.position.y < 0) { g.m.removeFromParent(); this.grains.splice(k, 1); }
    }
    // 떠오르는 보물
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const o = this.pops[k];
      o.life += dt;
      const y = 0.6 + Math.min(1, o.life / 0.5) * 1.1;
      this.v.placeLabel(o.el, o.pos, y);
      o.el.style.opacity = String(Math.max(0, Math.min(1, (o.max - o.life) / 0.4)));
      if (o.life >= o.max) { o.el.remove(); this.pops.splice(k, 1); }
    }
  }
  // 삽으로 퍼낼 때 모래 알갱이가 튄다
  sand(i) {
    const p = DIG_SPOTS[i];
    if (!this.sandGeo) { this.sandGeo = new THREE.SphereGeometry(0.035, 5, 4); this.sandMat = toon('#E2BD72'); }
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(this.sandGeo, this.sandMat);
      m.position.set(p.x + (Math.random() - 0.5) * 0.3, 0.08, p.z + (Math.random() - 0.5) * 0.3);
      this.v.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.9;
      this.grains = this.grains || [];
      this.grains.push({ m, life: 0, vel: V(Math.cos(a) * s * 0.7, 1.6 + Math.random() * 1.2, Math.sin(a) * s * 0.7) });
    }
    sfx.chop();
  }
  // 캔 보물을 구멍 위로 띄워 보여 준다
  popItem(i, id) {
    const p = DIG_SPOTS[i];
    const el = this.v.makeLabel('', 'kv-treasure home-ok');
    el.innerHTML = treasureIcon(id, 54);
    this.pops.push({ el, pos: V(p.x, 0, p.z), life: 0, max: 2.6 });
  }
}

// =====================================================================
// 물수제비 놀이 (play3d가 begin/stopAll과 함께 만든다)
// =====================================================================
export function createSkipGame({ v, ui, begin, stopAll, portrait, rpc, getToken, lost, live, onCelebrate }) {
  function skipBoard() {
    const box = h('div', { class: 'mem' }, h('p', { class: 'empty-big' }, '기록을 꺼내고 있어요…'));
    modal.open('오늘의 물수제비 왕', box, { cls: 'game-sheet' });
    rpc('kids_skip_board', { p_token: getToken() }).then((b) => drawBoard(box, b)).catch((e) => {
      if (lost(e)) return;
      box.replaceChildren(h('p', { class: 'fb-empty' }, message(e)));
    });
  }
  function drawBoard(box, b) {
    const top = (b && b.top) || [];
    const rows = top.map((t, i) => {
      const cv = h('canvas', { width: 64, height: 64, class: 'fl-face', 'aria-hidden': 'true' });
      drawFaceIcon(cv, normalizeAvatar(t.avatar));
      return h('div', { class: 'fl-row' + (t.me ? ' me' : '') }, h('b', { class: 'rank' }, `${i + 1}`), cv,
        h('div', { class: 'fl-main' }, h('b', {}, t.name, t.teacher ? h('span', { class: 't-badge' }, '선생님') : null, t.me ? ' (나)' : ''), h('span', {}, `${t.skips}번 튀었어요`)));
    });
    box.replaceChildren(
      h('div', { class: 'sub-head' }, h('h3', {}, '오늘 가장 많이 튄 친구'), h('p', {}, '날마다 새로 세요')),
      rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '오늘은 아직 아무도 던지지 않았어요. 첫 기록을 세워 봐요!'),
      h('p', { class: 'note' }, `내 오늘 최고 ${b.best_today || 0}번 · 내 최고 기록 ${b.best || 0}번`));
  }

  function skipping() {
    stopAll();
    const pl = v.player;
    // 비어 있는 자리에 선다
    let stand = SKIP_STANDS[0];
    for (const s of SKIP_STANDS) {
      const busy = [...v.remotes.values()].some((r) => Math.hypot(r.av.root.position.x - s.x, r.av.root.position.z - s.z) < 0.3);
      if (!busy) { stand = s; break; }
    }
    v.placePlayer(stand.x, stand.z, SKIP_FACE, 0);
    const K = V(stand.x, 0, stand.z), F = V(1, 0, 0), SIDE = V(0, 0, 1);
    const far = portrait() ? 1.45 : 1;
    // 아이 뒤 조금 옆에서 바다 쪽을 본다 (아이는 화면 왼쪽 아래, 바다는 앞)
    const sideS = stand === SKIP_STANDS[0] ? -1 : 1;
    const camNormal = { pos: K.clone().addScaledVector(F, -8.2 * far).addScaledVector(SIDE, 4.0 * sideS * far).setY(5.0 * far), look: K.clone().addScaledVector(F, 8).setY(-0.8) };
    // 돌이 날아가는 동안: 조금 더 높이 올라가 멀리까지 본다
    const camWide = { pos: K.clone().addScaledVector(F, -8.0 * far).addScaledVector(SIDE, 4.4 * sideS * far).setY(6.8 * far), look: K.clone().addScaledVector(F, 12).setY(-1.0) };
    const game = { cam: camNormal, camSpeed: 2.6 };
    const grp = new THREE.Group();
    v.scene.add(grp);
    const stone = makeStone();
    stone.visible = false;
    grp.add(stone);
    pl.pose = readyPose;
    // 막대: 바늘이 왔다 갔다, 가운데 초록 칸이 가장 좋다
    const needle = h('i', { class: 'needle' });
    const bar = h('div', { class: 'heat-bar skip-bar' }, h('span', { class: 'heat-zone', style: 'left:41%;width:18%' }), needle);
    let st = 'idle', mt = Math.random() * 2, t = 0, plan = null, result = null, hopI = 0, throwK = 0, idleSay = 0;
    const fx = [];
    const labels = [];
    const meter = () => { const q = (mt / 1.3) % 2; return q < 1 ? q : 2 - q; }; // 0~1, 1.3초에 한 번 끝까지
    function setIdle(msg) {
      st = 'idle';
      pl.pose = readyPose;
      stone.visible = false;
      ui.setPanel(bar);
      ui.say(msg || '바늘이 가운데 초록 칸에 왔을 때 ‘던지기’를 눌러요!');
      ui.setMain('던지기', { onClick: () => throwNow() });
    }
    function ripple(x, z, size = 1) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 24), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, SEA_Y + 0.04, z);
      grp.add(m);
      fx.push({ m, life: 0, max: 0.9, kind: 'ring', size });
    }
    function splash(x, z, nn = 6) {
      for (let i = 0; i < nn; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#DFF4FF', transparent: true, opacity: 0.95 }));
        m.position.set(x, SEA_Y + 0.05, z);
        grp.add(m);
        const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 0.6;
        fx.push({ m, life: 0, max: 0.55, kind: 'drop', vel: V(Math.cos(a) * s * 0.6, 1.2 + Math.random(), Math.sin(a) * s * 0.6) });
      }
    }
    // 돌이 지나갈 길: 손에서 첫 물까지 한 번, 그다음 n번 튀고 가라앉는다
    function makePlan(n, aim) {
      const hand = V(K.x + 0.15, 0.95, K.z + (stand === SKIP_STANDS[0] ? -0.25 : 0.25));
      const legs = [];
      let x = hand.x + 3.6 + aim * 2.4;
      const z0 = hand.z + (Math.random() - 0.5) * 0.4, drift = (Math.random() - 0.5) * 0.08;
      legs.push({ from: hand, to: V(x, SEA_Y + 0.02, z0), hgt: 0.9, dur: 0.62 });
      let d = 1.5 + aim * 1.3, hh = 0.42, du = 0.36, z = z0;
      for (let i = 0; i < n; i++) {
        const from = legs[legs.length - 1].to;
        x += d; z += drift * d;
        legs.push({ from, to: V(x, SEA_Y + 0.02, z), hgt: hh, dur: du, skip: i + 1 });
        d *= 0.86; hh *= 0.84; du *= 0.92;
      }
      // 마지막: 물 위를 조금 미끄러지다 퐁당
      const last = legs[legs.length - 1].to;
      legs.push({ from: last, to: V(last.x + Math.max(0.3, d * 0.6), SEA_Y - 0.4, last.z), hgt: 0.05, dur: 0.45, sink: true });
      return legs;
    }
    async function throwNow() {
      if (st !== 'idle') return;
      const m = meter();
      const aim = Math.max(0, 1 - Math.abs(m - 0.5) * 2);
      st = 'windup'; t = 0; throwK = 0;
      result = null;
      ui.setMain('…', { disabled: true });
      ui.say(aim > 0.85 ? '좋아요! 휙!' : '휙!');
      try {
        result = await rpc('kids_skip_throw', { p_token: getToken(), p_aim: +aim.toFixed(3) });
        if (!live(game)) return;
        plan = makePlan(result.skips, aim);
      } catch (e) {
        if (lost(e)) return;
        if (!live(game)) return;
        setIdle(message(e));
      }
    }
    function addCount(n, pos) {
      for (const o of labels) o.el.remove(); // 마지막 숫자만 크게
      labels.length = 0;
      const el = ui.label(`${n}`);
      el.classList.add('skip-count');
      labels.push({ el, pos: pos.clone(), life: 0 });
    }
    function finish() {
      const r = result;
      st = 'show'; t = 0;
      const n = r.skips;
      const top = (r.top || [])[0];
      const king = top && top.me && n > 0 && n === top.skips && r.today_best_new;
      let note;
      if (n === 0) note = '돌이 바로 퐁당 빠졌어요. 다시 해 봐요!';
      else if (king) note = '오늘의 물수제비 왕이에요!';
      else if (r.new_best) note = '내 최고 기록이에요!';
      else if (r.today_best_new) note = '오늘 내 최고 기록이에요!';
      else note = `오늘 내 최고 ${r.best_today}번`;
      ui.banner(n === 0 ? '퐁당!' : `물수제비 ${n}번!`, note, 2600);
      if (king || r.new_best) { confetti(); onCelebrate(); } else if (n >= 8) sfx.success();
      if (n >= 8) pl.celebrate();
      setTimeout(() => { if (live(game) && st === 'show') setIdle(n >= 10 ? '대단해요! 또 던져 볼까요?' : '또 던져 볼까요? 가운데 초록 칸을 노려요!'); }, 1800);
    }
    game.update = (dt, time) => {
      mt += dt;
      if (st === 'idle') {
        needle.style.left = `${(meter() * 100).toFixed(1)}%`;
        idleSay += dt;
      } else if (st === 'windup') {
        t += dt;
        throwK = Math.min(0.5, t / 0.35 * 0.5);
        throwPoseAt(pl, throwK);
        if (t >= 0.35 && plan) { st = 'fly'; t = 0; hopI = 0; stone.visible = true; sfx.whoosh(); }
      } else if (st === 'fly') {
        throwK = Math.min(1, 0.5 + t / 0.3 * 0.5);
        throwPoseAt(pl, throwK);
        t += dt;
        let leg = plan[hopI];
        while (leg && t >= leg.dur) {
          t -= leg.dur;
          // 물에 닿았다
          if (leg.sink) { ripple(leg.to.x, leg.to.z, 1.6); splash(leg.to.x, leg.to.z, 9); sfx.splash(); hopI = plan.length; stone.visible = false; break; }
          ripple(leg.to.x, leg.to.z, 0.9);
          splash(leg.to.x, leg.to.z, 4);
          if (leg.skip) { sfx.tick(); addCount(leg.skip, leg.to); }
          hopI++;
          leg = plan[hopI];
        }
        if (hopI >= plan.length) { stone.visible = false; finish(); } else {
          const k = clamp01(t / leg.dur);
          stone.position.lerpVectors(leg.from, leg.to, k);
          stone.position.y += Math.sin(k * Math.PI) * leg.hgt;
          stone.rotation.y = time * 25;
        }
        game.cam = camWide;
      } else if (st === 'show') {
        t += dt;
        if (t > 1.2) game.cam = camNormal;
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life += dt;
        const k = p.life / p.max;
        if (p.kind === 'ring') { p.m.scale.setScalar(1 + k * 5 * p.size); p.m.material.opacity = 0.85 * (1 - k); } else {
          p.vel.y -= 6 * dt;
          p.m.position.addScaledVector(p.vel, dt);
        }
        if (k >= 1) { p.m.geometry.dispose(); p.m.material.dispose(); p.m.removeFromParent(); fx.splice(i, 1); }
      }
      for (let i = labels.length - 1; i >= 0; i--) {
        const o = labels[i];
        o.life += dt;
        ui.place(o.el, o.pos, 0.4 + o.life * 0.6);
        o.el.style.opacity = String(Math.max(0, 1 - o.life / 1.4));
        if (o.life > 1.4) { o.el.remove(); labels.splice(i, 1); }
      }
    };
    game.onTap = () => { if (st === 'idle') throwNow(); };
    game.stop = () => {
      st = 'stopped';
      for (const o of labels) o.el.remove();
      grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      grp.removeFromParent();
      pl.pose = null;
    };
    game.state = () => st;
    begin('skip', '물수제비 터', game, [['star', '오늘 기록', skipBoard]]);
    setIdle('물수제비 터에 왔어요! 바늘이 가운데 초록 칸에 왔을 때 ‘던지기’를 눌러요.');
  }
  return { skipping };
}
