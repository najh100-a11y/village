// 진숲 어린이 마을 — 날씨 모습: 비, 눈, 구름, 번개
// 빗줄기와 눈송이는 카메라가 보는 곳 둘레의 상자 안에서만 내리고, 상자 밖으로 나가면 반대쪽으로 다시 들어온다.
// (마을이든 내 집이든 지금 보이는 장면에 root를 넣는다)
import * as THREE from './three.module.min.js';
import { toonGradient } from './avatar.js';
import { mergeGeos } from './merge.js';

const BOX = 34, TOP = 20; // 상자 가로·세로, 높이
const TAU = Math.PI * 2;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.55, 'rgba(255,255,255,.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 구름 한 덩이: 공 몇 개를 합친 것 (한 번에 그린다)
function cloudGeo(rand) {
  const parts = [];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(1, 12, 8);
    const r = 2.2 + rand() * 1.8;
    g.scale(r * 1.25, r * 0.72, r);
    g.translate((i - (n - 1) / 2) * 2.6 + (rand() - 0.5) * 1.2, (rand() - 0.3) * 1.1, (rand() - 0.5) * 2.2);
    parts.push(g);
  }
  const I = new THREE.Matrix4();
  return mergeGeos(parts.map((geo) => ({ geo, m: I })));
}

export class WeatherFx {
  constructor({ coarse = false } = {}) {
    this.root = new THREE.Group();
    this.root.name = 'weather';
    this.coarse = coarse;
    this.kind = 'clear';
    this.level = 0;
    this.wind = 0;
    this.seed = 7;
    const rand = () => { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; };
    // 비: 짧은 선분
    this.rainN = coarse ? 900 : 1600;
    this.rainPos = new Float32Array(this.rainN * 6);
    this.rainSp = new Float32Array(this.rainN);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: '#E2EAF2', transparent: true, opacity: 0.6, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.root.add(this.rain);
    // 눈: 둥근 점
    this.snowN = coarse ? 700 : 1200;
    this.snowPos = new Float32Array(this.snowN * 3);
    this.snowPh = new Float32Array(this.snowN);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snowMat = new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.32, map: dotTexture(), transparent: true, depthWrite: false, sizeAttenuation: true });
    this.snow = new THREE.Points(sg, this.snowMat);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.root.add(this.snow);
    this.placed = false;
    // 구름: 섬 위 높은 하늘에 천천히 흘러간다
    // 구름은 조금 비친다 (섬 전체를 볼 때 섬을 다 가리지 않게)
    const cm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient(), transparent: true, opacity: 0.82, depthWrite: false });
    this.cloudMatW = cm('#FFFFFF');
    this.cloudMatG = cm('#B9C2CC');
    this.cloudMatD = cm('#8792A0');
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(cloudGeo(rand), this.cloudMatW);
      const a = rand() * TAU, d = 20 + rand() * 64;
      m.position.set(Math.cos(a) * d, 30 + rand() * 8, Math.sin(a) * d + 30); // 섬 넷의 가운데 둘레
      m.userData.sp = 0.5 + rand() * 0.6;
      m.castShadow = false;
      m.receiveShadow = false;
      m.visible = false;
      this.root.add(m);
      this.clouds.push(m);
    }
    this.flash = 0;     // 번개 밝기 (0~1)
    this.nextBolt = 6;  // 다음 번개까지 초
    this.onThunder = null;
  }
  // kind: clear, partly, cloudy, fog, drizzle, rain, snow, storm. level: 비·눈 세기 (0~1)
  set(kind, level = 0.6, wind = 0) {
    this.kind = kind;
    this.level = Math.max(0, Math.min(1, level));
    this.wind = Math.max(-1, Math.min(1, wind / 10));
    const wet = kind === 'drizzle' || kind === 'rain' || kind === 'storm';
    this.wantRain = wet;
    this.wantSnow = kind === 'snow';
    this.rain.visible = wet && !this.far;
    this.snow.visible = this.wantSnow && !this.far;
    this.rainMat.opacity = kind === 'drizzle' ? 0.45 : kind === 'storm' ? 0.72 : 0.62;
    const nClouds = kind === 'clear' ? 0 : kind === 'partly' ? 6 : kind === 'fog' ? 0 : 14;
    const mat = kind === 'storm' ? this.cloudMatD : wet || kind === 'cloudy' || kind === 'snow' ? this.cloudMatG : this.cloudMatW;
    this.clouds.forEach((c, i) => { c.visible = i < nClouds; c.material = mat; });
    this.placed = false;
    if (kind !== 'storm') this.flash = 0;
  }
  // 상자 안에 다시 뿌린다 (처음, 또는 장면이 바뀌었을 때)
  scatter(f) {
    for (let i = 0; i < this.rainN; i++) {
      const x = f.x + (Math.random() - 0.5) * BOX, z = f.z + (Math.random() - 0.5) * BOX, y = Math.random() * TOP;
      this.setDrop(i, x, y, z);
      this.rainSp[i] = 0.85 + Math.random() * 0.3;
    }
    for (let i = 0; i < this.snowN; i++) {
      this.snowPos[i * 3] = f.x + (Math.random() - 0.5) * BOX;
      this.snowPos[i * 3 + 1] = Math.random() * TOP;
      this.snowPos[i * 3 + 2] = f.z + (Math.random() - 0.5) * BOX;
      this.snowPh[i] = Math.random() * TAU;
    }
    this.placed = true;
  }
  setDrop(i, x, y, z) {
    const p = this.rainPos, k = i * 6;
    const len = this.kind === 'drizzle' ? 0.32 : 0.62;
    p[k] = x; p[k + 1] = y; p[k + 2] = z;
    p[k + 3] = x - this.wind * len * 0.5; p[k + 4] = y + len; p[k + 5] = z;
  }
  // focus: 카메라가 보는 곳 (Vector3), t: 시간, far: 섬 전체처럼 멀리서 볼 때 (빗줄기·눈송이는 감추고 구름만)
  update(dt, focus, t, far = false) {
    if (!focus) return;
    if (far !== this.far) {
      this.far = far;
      this.rain.visible = !!this.wantRain && !far;
      this.snow.visible = !!this.wantSnow && !far;
      if (!far) this.placed = false;
    }
    if (!this.placed) this.scatter(focus);
    const half = BOX / 2;
    const wrap = (v, c) => (v - c > half ? v - BOX : v - c < -half ? v + BOX : v);
    if (this.rain.visible) {
      // 세기에 따라 보이는 빗줄기 수를 줄인다
      const n = Math.max(80, Math.round(this.rainN * (0.25 + 0.75 * this.level)));
      this.rain.geometry.setDrawRange(0, n * 2);
      const fall = (this.kind === 'drizzle' ? 9 : 19) * dt;
      const p = this.rainPos;
      for (let i = 0; i < n; i++) {
        const k = i * 6;
        let x = p[k], y = p[k + 1] - fall * this.rainSp[i], z = p[k + 2];
        x += this.wind * fall * 0.35;
        if (y < 0) { y += TOP; x = focus.x + (Math.random() - 0.5) * BOX; z = focus.z + (Math.random() - 0.5) * BOX; }
        x = wrap(x, focus.x); z = wrap(z, focus.z);
        this.setDrop(i, x, y, z);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.snow.visible) {
      const n = Math.max(80, Math.round(this.snowN * (0.3 + 0.7 * this.level)));
      this.snow.geometry.setDrawRange(0, n);
      const p = this.snowPos;
      for (let i = 0; i < n; i++) {
        const k = i * 3, ph = this.snowPh[i];
        let x = p[k] + (Math.sin(t * 0.9 + ph) * 0.5 + this.wind * 0.8) * dt;
        let y = p[k + 1] - (1.1 + (ph % 1) * 0.5) * dt;
        let z = p[k + 2] + Math.cos(t * 0.7 + ph) * 0.4 * dt;
        if (y < 0) { y += TOP; x = focus.x + (Math.random() - 0.5) * BOX; z = focus.z + (Math.random() - 0.5) * BOX; }
        p[k] = wrap(x, focus.x); p[k + 1] = y; p[k + 2] = wrap(z, focus.z);
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
    for (const c of this.clouds) {
      if (!c.visible) continue;
      c.position.x += c.userData.sp * (0.6 + Math.abs(this.wind) * 2) * dt;
      if (c.position.x > 96) c.position.x -= 192;
    }
    // 번개: 천둥번개일 때 6~16초마다 두 번 번쩍, 조금 뒤에 우르릉
    if (this.kind === 'storm') {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 6 + Math.random() * 10;
        this.boltAt = [0, 0.22];
        this.boltClock = 0;
        if (this.onThunder) setTimeout(() => this.onThunder(), 500 + Math.random() * 1400);
      }
    }
    if (this.boltAt) {
      this.boltClock += dt;
      while (this.boltAt.length && this.boltClock >= this.boltAt[0]) { this.flash = 1; this.boltAt.shift(); }
      if (!this.boltAt.length) this.boltAt = null;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 7);
  }
}
