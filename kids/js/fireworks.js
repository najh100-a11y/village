// 진숲 어린이 마을 — 불꽃놀이: 열매 상점에서 산 불꽃을 마을 하늘에 터트린다
// 불꽃 하나는 올라가는 꼬리 불빛과 터지는 별가루(점)로 이루어진다. 친구가 터트린 불꽃도 같은 자리에서 보인다.
import * as THREE from './three.module.min.js';

export const FIREWORKS = {
  fw_spark: { name: '반짝 불꽃', price: 1, desc: '금빛 별가루가 동그랗게 퍼져요.', colors: ['#FFE08A', '#FFFFFF'] },
  fw_flower: { name: '꽃 불꽃', price: 3, desc: '여러 빛깔 꽃이 두 번 활짝 피어요.', colors: ['#FF7A9A', '#7EC8F2', '#FFE08A', '#9BE38A'] },
  fw_heart: { name: '하트 불꽃', price: 5, desc: '하늘에 커다란 하트가 떠올라요.', colors: ['#FF5C8A', '#FFB3C8'] },
};
export const FW_IDS = Object.keys(FIREWORKS);
// 상점과 가방에 쓰는 작은 그림
export function fireworkIcon(id) {
  const c = (FIREWORKS[id] || FIREWORKS.fw_spark).colors;
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
    this.flash = 0;
    this.onBoom = null; // 소리 (터질 때): (kind, center)
    this.onLaunch = null; // 소리 (올라갈 때): (item, x, z)
  }

  // item 불꽃을 (x, z)에서 쏘아 올린다
  launch(item, x, z) {
    const def = FIREWORKS[item] || FIREWORKS.fw_spark;
    if (this.shows.length > 8) return;
    const top = new THREE.Vector3(x + (Math.random() - 0.5) * 1.0, 9.0 + Math.random() * 1.2, z + (Math.random() - 0.5) * 1.0);
    const trail = new Sparks(this.v.scene, this.tex, 70, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFF4CF' }));
    head.position.set(x, 1.0, z);
    this.v.scene.add(head);
    this.shows.push({ item, def, from: new THREE.Vector3(x, 1.0, z), top, t: 0, rise: 1.25, trail, head, bursts: [], done: false, emit: 0 });
    if (this.onLaunch) this.onLaunch(item, x, z);
  }

  burst(s, center, kind, delay = 0) {
    const sp = new Sparks(this.v.scene, this.tex, kind === 'heart' ? 190 : kind === 'flower2' ? 90 : 160, kind === 'spark' ? 0.55 : 0.62);
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
    s.bursts.push({ sp, kind, delay, started: false, center: center.clone() });
  }

  update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
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
        if (s.item === 'fw_heart') this.burst(s, s.top, 'heart');
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
          this.flash = Math.min(1, this.flash + 0.6);
          if (this.onBoom) this.onBoom(b.kind, b.center);
        }
        alive += b.sp.step(dt, b.kind === 'heart' ? 0.7 : 2.2, b.kind === 'heart' ? 1.4 : 1.1);
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
