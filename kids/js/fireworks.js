// 진숲 어린이 마을 — 불꽃놀이: 열매 상점에서 산 불꽃을 마을 하늘에 터트린다
// 불꽃 하나는 올라가는 꼬리 불빛과 터지는 별가루(점)로 이루어진다. 친구가 터트린 불꽃도 같은 자리에서 보인다.
import * as THREE from './three.module.min.js';

export const FIREWORKS = {
  fw_spark: { name: '반짝 불꽃', price: 1, desc: '금빛 별가루가 동그랗게 퍼져요.', colors: ['#FFE08A', '#FFFFFF'] },
  fw_flower: { name: '꽃 불꽃', price: 3, desc: '여러 빛깔 꽃이 두 번 활짝 피어요.', colors: ['#FF7A9A', '#7EC8F2', '#FFE08A', '#9BE38A'] },
  fw_heart: { name: '하트 불꽃', price: 5, desc: '하늘에 커다란 하트가 떠올라요.', colors: ['#FF5C8A', '#FFB3C8'] },
  fw_volley: { name: '10연발 불꽃', price: 7, desc: '불꽃 열 발이 차례로 솟아 동그라미, 고리, 별, 반짝이, 갈래 불꽃처럼 저마다 다르게 터져요. 마지막엔 커다란 금빛 버들 불꽃이 타닥타닥 쏟아져요.', colors: ['#FF5A5A', '#6FE3FF', '#FFD54A', '#C38BFF', '#9BE38A'], volley: true },
};
// 10연발: 0.45초마다 한 발씩 쏘아 올린다. dx: 보는 쪽에서 왼쪽(-)·오른쪽(+)으로 떨어진 거리, h: 터지는 높이
const VOLLEY = [
  { at: 0.0, kind: 'peony', cols: ['#FF5A5A', '#FFE08A'], dx: -2.6, h: 8.4 }, // 둥근 불꽃
  { at: 0.45, kind: 'ring', cols: ['#6FE3FF', '#FFFFFF'], dx: 2.4, h: 9.2 }, // 고리
  { at: 0.9, kind: 'double', cols: ['#9BE38A', '#C38BFF'], dx: -0.6, h: 9.8 }, // 안팎 두 빛깔
  { at: 1.35, kind: 'glitter', cols: ['#F4F4FF', '#FFE08A'], dx: 1.2, h: 8.8 }, // 반짝이
  { at: 1.8, kind: 'star', cols: ['#FFD54A', '#FFFFFF'], dx: -2.0, h: 9.6 }, // 별
  { at: 2.25, kind: 'crossette', cols: ['#FF7AC8', '#FFFFFF'], dx: 2.6, h: 8.9 }, // 갈래 불꽃: 여덟 갈래가 한 번 더 터진다
  { at: 2.7, kind: 'chrys', cols: ['#8FD3FF', '#FFFFFF'], dx: 0.2, h: 10.0 }, // 꼬리 달린 국화
  { at: 3.15, kind: 'palm', cols: ['#FFC24A', '#7EE07A'], dx: -2.8, h: 8.5 }, // 야자수
  { at: 3.6, kind: 'triple', cols: ['#FF5A5A', '#6FA8FF', '#FFE08A'], dx: 2.0, h: 9.4 }, // 세 송이
  { at: 4.4, kind: 'willow', cols: ['#FFC24A', '#FFE6A3'], dx: 0, h: 10.6 }, // 마지막: 커다란 금빛 버들과 타닥타닥
];
export const FW_IDS = Object.keys(FIREWORKS);
// 상점과 가방에 쓰는 작은 그림
export function fireworkIcon(id) {
  const c = (FIREWORKS[id] || FIREWORKS.fw_spark).colors;
  if (id === 'fw_volley') { // 여러 빛깔 불꽃 셋과 올라가는 꼬리
    const star = (cx, cy, r, col, n) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return `<line x1="${(cx + Math.cos(a) * r * 0.3).toFixed(1)}" y1="${(cy + Math.sin(a) * r * 0.3).toFixed(1)}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
    }).join('') + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="#fff"/>`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 46 L13 30 M24 46 L24 26 M38 46 L35 30" stroke="#FFD27A" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/>${star(13, 17, 9, c[0], 10)}${star(35, 15, 9, c[1], 10)}${star(24, 25, 8, c[2], 8)}<circle cx="24" cy="6" r="2" fill="${c[3]}"/><circle cx="6" cy="30" r="1.6" fill="${c[4]}"/><circle cx="43" cy="30" r="1.6" fill="${c[3]}"/></svg>`;
  }
  if (id === 'fw_heart') return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40C10 30 5 22 8 15c3-6 11-7 16 0 5-7 13-6 16 0 3 7-2 15-16 25z" fill="${c[0]}"/><path d="M24 40C10 30 5 22 8 15" fill="none" stroke="${c[1]}" stroke-width="2" stroke-dasharray="2 3"/><circle cx="16" cy="17" r="2.5" fill="#fff" opacity=".7"/></svg>`;
  const rays = Array.from({ length: id === 'fw_flower' ? 12 : 8 }, (_, i) => {
    const a = (i / (id === 'fw_flower' ? 12 : 8)) * Math.PI * 2;
    const col = c[i % c.length];
    return `<line x1="${24 + Math.cos(a) * 6}" y1="${24 + Math.sin(a) * 6}" x2="${24 + Math.cos(a) * 18}" y2="${24 + Math.sin(a) * 18}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><circle cx="${24 + Math.cos(a) * 20}" cy="${24 + Math.sin(a) * 20}" r="2.2" fill="${col}"/>`;
  }).join('');
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${rays}<circle cx="24" cy="24" r="4" fill="${c[0]}"/></svg>`;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 10연발 새 모양: 점 수(n), 점 크기(size), 아래로 당기는 힘(g), 공기 저항(d)
const NEW_KINDS = {
  peony: { n: 160, size: 0.62, g: 2.2, d: 1.1 },
  mini: { n: 30, size: 0.5, g: 2.0, d: 1.2 },
  double: { n: 235, size: 0.6, g: 2.1, d: 1.1 },
  ring: { n: 155, size: 0.62, g: 1.4, d: 1.2 },
  star: { n: 175, size: 0.62, g: 1.0, d: 1.3 },
  glitter: { n: 175, size: 0.5, g: 2.0, d: 1.2 },
  cross: { n: 20, size: 0.95, g: 2.2, d: 1.1 },
  chrys: { n: 425, size: 0.55, g: 1.8, d: 1.0 },
  palm: { n: 100, size: 0.85, g: 3.2, d: 1.3 },
  willow: { n: 365, size: 0.55, g: 2.4, d: 1.5 },
  crackle: { n: 75, size: 0.42, g: 1.0, d: 0.5 },
};

// 점 여러 개를 한 번에 움직이는 묶음
class Sparks {
  constructor(scene, tex, n, size) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.tw = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.used = 0;
  }
  add(p, v, color, life, twinkle = 0) {
    if (this.used >= this.n) return;
    const i = this.used++;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.life[i] = 0;
    this.max[i] = life;
    this.tw[i] = twinkle;
  }
  // gravity: 아래로 당기는 힘, drag: 공기 저항
  step(dt, gravity, drag) {
    const f = Math.exp(-drag * dt);
    let alive = 0;
    for (let i = 0; i < this.used; i++) {
      const k = this.life[i] / this.max[i];
      if (k >= 1) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      alive++;
      this.life[i] += dt;
      this.vel[i * 3] *= f; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * f - gravity * dt; this.vel[i * 3 + 2] *= f;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      let b = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (this.tw[i] && k > 0.45) b *= 0.45 + 0.55 * Math.abs(Math.sin(this.life[i] * 26 + i));
      this.col[i * 3] = this.base[i * 3] * b;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * b;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * b;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.color.needsUpdate = true;
    return alive;
  }
  dispose() { this.pts.removeFromParent(); this.pts.geometry.dispose(); this.mat.dispose(); }
}

export class Fireworks {
  constructor(v) {
    this.v = v;
    this.tex = dotTexture();
    this.shows = [];
    this.pending = []; // 10연발에서 아직 쏘지 않은 발 { wait, item, x, z, sh }
    this.flash = 0;
    this.onBoom = null; // 소리 (터질 때): (kind, center)
    this.onLaunch = null; // 소리 (올라갈 때): (item, x, z)
  }

  // item 불꽃을 (x, z)에서 쏘아 올린다. 10연발은 보는 쪽 좌우로 펼쳐 차례로 쏜다
  launch(item, x, z) {
    if (item === 'fw_volley') {
      if (this.pending.length > 20) return;
      const r = this.camRight(true);
      for (const sh of VOLLEY) this.pending.push({ wait: sh.at, item, x: x + r.x * sh.dx, z: z + r.z * sh.dx, sh });
      return;
    }
    if (this.shows.length > 8) return;
    this.shell(item, x, z);
  }
  // 한 발: sh가 있으면 10연발의 한 발 (모양, 빛깔, 높이)
  shell(item, x, z, sh = null) {
    const def = FIREWORKS[item] || FIREWORKS.fw_spark;
    const top = new THREE.Vector3(x + (Math.random() - 0.5) * (sh ? 0.4 : 1.0), sh ? sh.h : 9.0 + Math.random() * 1.2, z + (Math.random() - 0.5) * (sh ? 0.4 : 1.0));
    const scene = this.v.sceneFor ? this.v.sceneFor(x, z) : this.v.scene; // 내 집에서 쏘면 내 집 하늘에
    const trail = new Sparks(scene, this.tex, 70, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFF4CF' }));
    head.position.set(x, 1.0, z);
    scene.add(head);
    this.shows.push({ item, def, sh, cols: sh ? sh.cols : def.colors, from: new THREE.Vector3(x, 1.0, z), top, t: 0, rise: sh ? 1.1 + (sh.h - 9) * 0.06 : 1.25, trail, head, bursts: [], done: false, emit: 0, scene });
    if (this.onLaunch) this.onLaunch(item, x, z);
  }
  // 카메라의 오른쪽(flat: 땅과 나란히)과 위쪽
  camRight(flat = false) {
    const r = new THREE.Vector3().setFromMatrixColumn(this.v.camera.matrixWorld, 0);
    if (flat) r.y = 0;
    return r.lengthSq() > 1e-6 ? r.normalize() : new THREE.Vector3(1, 0, 0);
  }
  camUp() { return new THREE.Vector3().setFromMatrixColumn(this.v.camera.matrixWorld, 1).normalize(); }

  // 10연발 한 발이 터질 때
  volleyBurst(s) {
    const c = s.top, k = s.sh.kind;
    if (k === 'triple') { // 세 송이가 잇달아
      const r = this.camRight(), u = this.camUp();
      [[-1.7, 0.2], [1.7, 0.4], [0, 1.4]].forEach(([dx, dy], i) => {
        const at = c.clone().addScaledVector(r, dx).addScaledVector(u, dy);
        this.burst(s, at, 'peony', i * 0.14, { cols: [s.cols[i], '#FFFFFF'], scale: 0.62, quiet: i > 0 });
      });
    } else if (k === 'crossette') { // 여덟 갈래가 날아가다 한 번 더 터진다
      const dirs = this.burst(s, c, 'cross');
      dirs.forEach((d, i) => {
        const at = c.clone().addScaledVector(d, (1 - Math.exp(-1.1 * 0.58)) / 1.1);
        at.y -= 0.37;
        this.burst(s, at, 'mini', 0.58, { cols: [s.cols[i % 2], '#FFFFFF'], quiet: i > 0 });
      });
    } else if (k === 'willow') { // 금빛 버들이 천천히 늘어지고, 끝에 타닥타닥
      this.burst(s, c, 'willow');
      this.flash = Math.min(1, this.flash + 0.4);
      [1.4, 1.75, 2.1].forEach((d, i) => this.burst(s, c, 'crackle', d, { quiet: i > 0 }));
    } else this.burst(s, c, k);
  }

  // 한 번 터지기. opt: cols(빛깔), scale(크기), quiet(소리 없이). 돌려주는 값: 갈래 불꽃의 갈래 방향
  burst(s, center, kind, delay = 0, opt = {}) {
    const V = NEW_KINDS[kind];
    if (V) return this.burstNew(s, center, kind, delay, opt, V);
    const sp = new Sparks(s.scene || this.v.scene, this.tex, kind === 'heart' ? 190 : kind === 'flower2' ? 90 : 160, kind === 'spark' ? 0.55 : 0.62);
    const col = new THREE.Color();
    const dir = new THREE.Vector3();
    const cols = s.def.colors;
    if (kind === 'heart') {
      // 카메라를 마주 보는 하트 모양
      const cam = this.v.camera;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      for (let i = 0; i < 150; i++) {
        const t = (i / 150) * Math.PI * 2;
        const hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        dir.copy(right).multiplyScalar(hx * 0.24).addScaledVector(up, hy * 0.24 + 1.0);
        dir.x += (Math.random() - 0.5) * 0.3; dir.y += (Math.random() - 0.5) * 0.3; dir.z += (Math.random() - 0.5) * 0.3;
        sp.add(center, dir, col.set(cols[i % 5 === 0 ? 1 : 0]), 2.4 + Math.random() * 0.4, 1);
      }
      for (let i = 0; i < 40; i++) {
        dir.randomDirection().multiplyScalar(2 + Math.random() * 2);
        sp.add(center, dir, col.set('#FFFFFF'), 1.2 + Math.random() * 0.6, 1);
      }
    } else {
      const n = kind === 'flower2' ? 90 : kind === 'spark' ? 120 : 160;
      const speed = kind === 'flower2' ? 2.6 : kind === 'spark' ? 4.0 : 5.0;
      const shellCol = cols[Math.floor(Math.random() * cols.length)];
      for (let i = 0; i < n; i++) {
        dir.randomDirection().multiplyScalar(speed * (0.85 + Math.random() * 0.3));
        const c = kind === 'flower' ? cols[i % cols.length] : kind === 'flower2' ? shellCol : cols[i % 7 === 0 ? 1 : 0];
        sp.add(center, dir, col.set(c), (kind === 'spark' ? 1.6 : 2.1) + Math.random() * 0.5, kind === 'spark' ? 1 : 0);
      }
    }
    s.bursts.push({ sp, kind, delay, started: false, center: center.clone(), g: kind === 'heart' ? 0.7 : 2.2, d: kind === 'heart' ? 1.4 : 1.1 });
  }

  // 10연발의 새 모양들
  burstNew(s, center, kind, delay, opt, V) {
    const k = opt.scale || 1;
    const sp = new Sparks(s.scene || this.v.scene, this.tex, Math.ceil(V.n * Math.max(0.5, k)), V.size * (0.7 + 0.3 * k));
    const cols = opt.cols || s.cols;
    const col = new THREE.Color(), dir = new THREE.Vector3();
    const add = (d, c, life, tw = 0, bright = 1) => { col.set(c).multiplyScalar(bright); sp.add(center, d, col, life, tw); };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const out = [];
    if (kind === 'peony' || kind === 'mini') { // 둥근 불꽃 (mini: 갈래 끝에서 작게)
      const n = Math.round((kind === 'mini' ? 26 : 150) * k), sp0 = (kind === 'mini' ? 2.3 : 5.2) * Math.sqrt(k);
      for (let i = 0; i < n; i++) add(dir.randomDirection().multiplyScalar(sp0 * rnd(0.88, 1.08)), cols[i % 6 === 0 ? 1 : 0], (kind === 'mini' ? 1.0 : 2.0) + Math.random() * 0.5);
    } else if (kind === 'double') { // 안쪽 한 빛깔, 바깥쪽 다른 빛깔
      for (let i = 0; i < 90; i++) add(dir.randomDirection().multiplyScalar(2.7 * rnd(0.9, 1.1)), cols[0], 1.8 + Math.random() * 0.4);
      for (let i = 0; i < 140; i++) add(dir.randomDirection().multiplyScalar(5.4 * rnd(0.9, 1.06)), cols[1], 2.1 + Math.random() * 0.5);
    } else if (kind === 'ring' || kind === 'star') { // 카메라를 마주 보는 고리와 별 (고리는 살짝 기울인다)
      const r = this.camRight(), u = this.camUp();
      if (kind === 'ring') u.applyAxisAngle(r, 0.45);
      const pts = [];
      if (kind === 'ring') for (let i = 0; i < 130; i++) { const a = (i / 130) * Math.PI * 2; pts.push([Math.cos(a), Math.sin(a)]); }
      else for (let e = 0; e < 10; e++) { // 별: 바깥 꼭짓점 다섯, 안쪽 다섯을 잇는 선
        const a0 = Math.PI / 2 + (e / 10) * Math.PI * 2, a1 = Math.PI / 2 + ((e + 1) / 10) * Math.PI * 2;
        const r0 = e % 2 ? 0.45 : 1, r1 = e % 2 ? 1 : 0.45;
        for (let j = 0; j < 15; j++) { const t = j / 15; pts.push([Math.cos(a0) * r0 * (1 - t) + Math.cos(a1) * r1 * t, Math.sin(a0) * r0 * (1 - t) + Math.sin(a1) * r1 * t]); }
      }
      const spd = kind === 'ring' ? 4.8 : 5.2;
      for (const [x, y] of pts) {
        dir.copy(r).multiplyScalar(x * spd).addScaledVector(u, y * spd + 0.6);
        dir.x += rnd(-0.12, 0.12); dir.y += rnd(-0.12, 0.12); dir.z += rnd(-0.12, 0.12);
        add(dir, cols[0], 2.2 + Math.random() * 0.4, kind === 'star' ? 1 : 0);
      }
      for (let i = 0; i < 20; i++) add(dir.randomDirection().multiplyScalar(rnd(0.6, 1.6)), cols[1], 1.2 + Math.random() * 0.4, 1);
    } else if (kind === 'glitter') { // 반짝반짝 깜빡이는 은빛·금빛
      for (let i = 0; i < 170; i++) add(dir.randomDirection().multiplyScalar(4.4 * rnd(0.85, 1.08)), cols[i % 3 === 0 ? 1 : 0], 2.6 + Math.random() * 0.5, 1);
    } else if (kind === 'cross') { // 갈래 불꽃의 큰 별 여덟 개 (곧 사라지고 그 자리에서 다시 터진다)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const d = new THREE.Vector3(Math.cos(a), rnd(-0.25, 0.35), Math.sin(a)).normalize().multiplyScalar(4.4);
        out.push(d.clone().normalize().multiplyScalar(4.4));
        add(d, cols[0], 0.6, 0, 1);
        add(d.clone().multiplyScalar(0.93), '#FFFFFF', 0.6, 0, 0.6);
      }
    } else if (kind === 'chrys') { // 국화: 빛줄기마다 꼬리가 따라간다 (같은 방향 점 셋을 조금씩 느리게)
      for (let i = 0; i < 140; i++) {
        dir.randomDirection();
        const life = 2.3 + Math.random() * 0.4, c = cols[i % 8 === 0 ? 1 : 0];
        add(dir.clone().multiplyScalar(5.4), c, life);
        add(dir.clone().multiplyScalar(5.0), c, life * 0.9, 0, 0.55);
        add(dir.clone().multiplyScalar(4.6), c, life * 0.8, 0, 0.3);
      }
    } else if (kind === 'palm') { // 야자수: 굵은 빛줄기 열두 개가 위로 퍼졌다 늘어진다
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const d = new THREE.Vector3(Math.cos(a), rnd(0.35, 0.8), Math.sin(a)).normalize();
        for (let j = 0; j < 8; j++) add(d.clone().multiplyScalar(6.2 * (1 - j * 0.045)), cols[i % 2], 2.0 - j * 0.08, 0, 1 - j * 0.09);
      }
    } else if (kind === 'willow') { // 버들: 크게 퍼진 금빛이 천천히 늘어지며 오래 남는다
      for (let i = 0; i < 180; i++) {
        dir.randomDirection().multiplyScalar(4.6 * rnd(0.9, 1.05));
        const life = 3.6 + Math.random() * 0.6;
        add(dir.clone(), cols[0], life, 1);
        add(dir.clone().multiplyScalar(0.9), cols[1], life * 0.85, 0, 0.45);
      }
    } else if (kind === 'crackle') { // 타닥타닥: 하얗게 번쩍이고 바로 사라지는 작은 점들
      for (let i = 0; i < 70; i++) add(dir.randomDirection().multiplyScalar(rnd(1.5, 5.5)), Math.random() < 0.7 ? '#FFFFFF' : '#FFE08A', rnd(0.12, 0.35), 1);
    }
    s.bursts.push({ sp, kind, delay, started: false, center: center.clone(), g: V.g, d: V.d, quiet: !!opt.quiet });
    return out;
  }

  update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
    // 10연발: 차례가 된 발을 쏘아 올린다
    if (this.pending.length) {
      for (const q of this.pending) q.wait -= dt;
      const go = this.pending.filter((q) => q.wait <= 0);
      if (go.length) {
        this.pending = this.pending.filter((q) => q.wait > 0);
        for (const q of go) if (this.shows.length < 24) this.shell(q.item, q.x, q.z, q.sh);
      }
    }
    this.shows = this.shows.filter((s) => {
      s.t += dt;
      if (s.t < s.rise) {
        // 올라가기: 머리 불빛과 꼬리 불빛
        const k = s.t / s.rise;
        const e = 1 - (1 - k) * (1 - k);
        s.head.position.lerpVectors(s.from, s.top, e);
        s.head.position.x += Math.sin(s.t * 18) * 0.04;
        s.emit -= dt;
        while (s.emit <= 0) {
          s.emit += 0.02;
          s.trail.add(s.head.position, new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.6, (Math.random() - 0.5) * 0.4), new THREE.Color('#FFD27A'), 0.5 + Math.random() * 0.3);
        }
      } else if (!s.done) {
        s.done = true;
        s.head.removeFromParent();
        s.head.geometry.dispose();
        s.head.material.dispose();
        if (s.sh) this.volleyBurst(s);
        else if (s.item === 'fw_heart') this.burst(s, s.top, 'heart');
        else if (s.item === 'fw_flower') { this.burst(s, s.top, 'flower'); this.burst(s, s.top, 'flower2', 0.4); }
        else this.burst(s, s.top, 'spark');
      }
      const trailAlive = s.trail.step(dt, 1.5, 1.2);
      let alive = trailAlive;
      for (const b of s.bursts) {
        if (!b.started) {
          b.delay -= dt;
          if (b.delay > 0) { alive++; continue; }
          b.started = true;
          if (b.kind !== 'crackle' && b.kind !== 'mini') this.flash = Math.min(1, this.flash + 0.6);
          if (this.onBoom && !b.quiet) this.onBoom(b.kind, b.center);
        }
        alive += b.sp.step(dt, b.g, b.d);
      }
      if (s.done && !alive) {
        s.trail.dispose();
        for (const b of s.bursts) b.sp.dispose();
        return false;
      }
      return true;
    });
  }
}
