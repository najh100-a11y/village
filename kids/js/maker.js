// 진숲 어린이 마을 — 주민 꾸미기 (머리 모양·머리 색·눈썹·눈·코·입·옷·모자)
import * as THREE from './three.module.min.js';
import { Avatar, toon } from './avatar.js';
import { PARTS, PALETTE, randomAvatar, normalizeAvatar, drawPartTile } from './face.js';
import { h, icon, josa } from './ui.js';
import { WARDROBE, wearItem, missingItems } from './wardrobe.js';

const TABS = [
  { id: 'face', label: '얼굴', view: 'head', sections: [
    { key: 'skin', title: '피부색', type: 'color', pal: 'skin' },
    { key: 'eyes', title: '눈', type: 'face', part: 'eyes' },
    { key: 'eyeColor', title: '눈동자 색', type: 'color', pal: 'eye' },
    { key: 'brows', title: '눈썹', type: 'face', part: 'brows' },
    { key: 'nose', title: '코', type: 'face', part: 'nose' },
    { key: 'mouth', title: '입', type: 'face', part: 'mouth' },
    { key: 'cheek', title: '볼', type: 'face', part: 'cheek' },
  ] },
  { id: 'hair', label: '머리', view: 'head', sections: [
    { key: 'hair', title: '머리 모양', type: 'thumb', part: 'hair' },
    { key: 'hairColor', title: '머리 색', type: 'color', pal: 'hair' },
  ] },
  { id: 'clothes', label: '옷', view: 'body', sections: [
    { key: 'outfit', title: '옷', type: 'thumb', part: 'outfit' },
    { key: 'outfitColor', title: '옷 색', type: 'color', pal: 'cloth' },
    { key: 'bottomColor', title: '바지 색', type: 'color', pal: 'bottom' },
    { key: 'shoeColor', title: '신발 색', type: 'color', pal: 'shoe' },
  ] },
  { id: 'hat', label: '모자', view: 'head', sections: [
    { key: 'hat', title: '모자', type: 'thumb', part: 'hat' },
    { key: 'hatColor', title: '모자 색', type: 'color', pal: 'cloth' },
  ] },
  // 열매 상점에서 산 꾸미기 물건 (🔒는 아직 사지 않은 것. 입어 볼 수는 있지만 저장하려면 사야 한다)
  { id: 'acc', label: '꾸미기', view: 'body', shop: true, sections: [
    { key: 'face', title: '안경', type: 'thumb', part: 'face' },
    { key: 'back', title: '등에 메는 것', type: 'thumb', part: 'back' },
    { key: 'backColor', title: '등 물건 색 (나비 날개, 망토, 가방)', type: 'color', pal: 'cloth' },
  ] },
];
const THUMB_DEPS = {
  hair: ['skin', 'hairColor'],
  outfit: ['skin', 'outfitColor', 'bottomColor', 'shoeColor'],
  hat: ['skin', 'hair', 'hairColor', 'hatColor'],
  face: ['skin', 'eyes', 'eyeColor', 'hair', 'hairColor'],
  back: ['skin', 'outfit', 'outfitColor', 'backColor'],
};
const FACE_DEPS = ['skin', 'eyeColor', 'hairColor'];
const VIEWS = {
  head: { y: 1.45, dist: 4.4 },
  body: { y: 1.0, dist: 7.0 },
};

export class Maker {
  constructor() {
    this.el = document.getElementById('maker');
    this.canvas = document.getElementById('makerCanvas');
    this.opts = document.getElementById('makerOptions');
    this.tabsEl = document.getElementById('makerTabs');
    this.nameInput = document.getElementById('makerName');
    this.errEl = document.getElementById('makerErr');
    this.tab = TABS[0];
    this.running = false;
    this.thumbQueue = [];
    document.getElementById('makerRandom').addEventListener('click', () => {
      this.avatar = randomAvatar();
      this.refreshAll();
      this.preview.celebrate();
    });
    document.getElementById('makerSave').addEventListener('click', () => this.finish(true));
    document.getElementById('makerCancel').addEventListener('click', () => this.finish(false));
    this.shop = { on: false, owned: {}, prices: {} };
  }
  // 탭 단추 (상점 꾸미기 물건이 없는 서버면 '꾸미기' 탭을 감춘다)
  drawTabs() {
    this.tabsEl.replaceChildren(...this.tabs().map((t) => h('button', {
      class: 'tab', type: 'button', role: 'tab', 'data-tab': t.id, 'aria-selected': 'false',
      onclick: () => this.showTab(t),
    }, t.label)));
  }
  tabs() { return TABS.filter((t) => !t.shop || this.shop.on); }
  // 상점 물건이면 그 이름, 아니면 null
  shopItem(key, v) { return this.shop.on ? wearItem(key, v) : null; }
  owns(id) { return this.shop.owned[id] > 0; }

  ensure3D() {
    if (this.renderer) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.add(new THREE.HemisphereLight('#ffffff', '#9CD07A', 1.7));
    const sun = new THREE.DirectionalLight('#FFF4E0', 2.1);
    sun.position.set(3, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3;
    scene.add(sun);
    const stand = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.3, 40), toon('#8DCC5F'));
    grass.position.y = -0.15;
    grass.receiveShadow = true;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.55, 0.35, 40), toon('#B88A5C'));
    soil.position.y = -0.45;
    stand.add(grass, soil);
    const cols = ['#EF6461', '#F6D55C', '#F6A2C4', '#FFFDF7'];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(cols[i % 4]));
      f.position.set(Math.cos(a) * 1.35, 0.06, Math.sin(a) * 1.35);
      stand.add(f);
    }
    scene.add(stand);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.view = { ...VIEWS.head };
    this.camY = this.view.y;
    this.camDist = this.view.dist;
    this.preview = new Avatar(this.avatar);
    scene.add(this.preview.root);
    this.spin = 0;
    this.spinVel = 0;
    this.idle = 0;
    // 손가락으로 돌리기
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      this.spin += dx * 0.012;
      this.spinVel = dx * 0.012;
      this.idle = 0;
    });
    const end = () => { drag = null; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => this.running && this.resize());
    // 미리보기 그림을 그리는 작은 렌더러
    this.thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.thumbR.setPixelRatio(1);
    this.thumbR.setSize(160, 160, false);
    this.thumbScene = new THREE.Scene();
    this.thumbScene.add(new THREE.HemisphereLight('#ffffff', '#C9E7B4', 1.9));
    const ts = new THREE.DirectionalLight('#FFF4E0', 1.8);
    ts.position.set(3, 6, 6);
    this.thumbScene.add(ts);
    this.thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
  }

  // shop: { on, owned: {물건: 개수}, prices: {물건: 값} } 상점 꾸미기 물건을 쓸 수 있는지와 산 것
  open({ avatar, name, first, shop }) {
    this.shop = { on: false, owned: {}, prices: {}, ...(shop || {}) };
    this.drawTabs();
    this.avatar = normalizeAvatar(avatar);
    // 상점 물건을 쓸 수 없는 서버면 그 값은 기본으로 돌려 둔다
    if (!this.shop.on) for (const k of ['hat', 'face', 'back', 'outfit']) if (wearItem(k, this.avatar[k])) this.avatar[k] = k === 'outfit' ? 'tee' : 'none';
    this.first = first;
    this.nameInput.value = name || '';
    this.errEl.textContent = '';
    document.getElementById('makerTitle').textContent = first ? '나만의 주민을 만들어요' : '옷장';
    document.getElementById('makerCancel').hidden = !!first;
    document.getElementById('makerSave').textContent = first ? '이 모습으로 마을에 가기' : '이대로 저장하기';
    this.el.hidden = false;
    this.ensure3D();
    this.preview.setData(this.avatar);
    this.running = true;
    this.resize();
    this.clock.getDelta();
    requestAnimationFrame(this.loop);
    this.showTab(this.tabs()[0]);
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  finish(save) {
    if (save) {
      const name = this.nameInput.value.trim();
      if (!name) {
        this.errEl.textContent = '마을에서 부를 이름을 먼저 써 주세요.';
        this.nameInput.focus();
        return;
      }
      if (name.length > 10) { this.errEl.textContent = '이름은 10글자까지 쓸 수 있어요.'; return; }
      const miss = this.shop.on ? missingItems(this.avatar, this.shop.owned) : [];
      if (miss.length) {
        this.errEl.textContent = `🔒 ${josa(miss.map((id) => WARDROBE[id].name).join(', '), '은', '는')} 열매 상점에서 사야 입을 수 있어요. 벗거나 상점에서 사 주세요.`;
        return;
      }
    }
    const result = save ? { avatar: { ...this.avatar }, name: this.nameInput.value.trim() } : null;
    if (this.resolve) this.resolve(result);
    this.resolve = null;
  }

  close() {
    this.running = false;
    this.el.hidden = true;
    this.thumbQueue = [];
  }

  setError(t) { this.errEl.textContent = t; }

  resize() {
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    if (!w || !hgt) return;
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.idle += dt;
    if (this.idle > 2.2) {
      let d = -this.spin % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.spin += d * Math.min(1, dt * 2.5);
    } else {
      this.spinVel *= 0.92;
    }
    this.preview.root.rotation.y = this.spin;
    this.preview.update(dt, false);
    this.camY += (this.view.y - this.camY) * Math.min(1, dt * 5);
    this.camDist += (this.view.dist - this.camDist) * Math.min(1, dt * 5);
    const narrow = this.camera.aspect < 0.9 ? 1.18 : 1;
    this.camera.position.set(0, this.camY + 0.45, this.camDist * narrow);
    this.camera.lookAt(0, this.camY, 0);
    this.renderer.render(this.scene, this.camera);
  }

  showTab(tab) {
    this.tab = tab;
    this.view = { ...VIEWS[tab.view] };
    for (const b of this.tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab.id));
    this.thumbQueue = [];
    this.opts.replaceChildren(...tab.sections.map((s) => this.section(s)));
    this.opts.scrollTop = 0;
  }

  section(s) {
    const grid = h('div', { class: 'opt-grid ' + (s.type === 'color' ? 'colors' : s.type) });
    const wrap = h('section', { class: 'opt-sec', 'data-key': s.key }, h('h4', {}, s.title), grid);
    if (s.type === 'color') {
      PALETTE[s.pal].forEach(([hex, label], i) => {
        grid.append(h('button', {
          class: 'swatch', type: 'button', title: label, 'aria-label': label, 'data-v': String(i),
          style: `--c:${hex}`, 'aria-pressed': String(this.avatar[s.key] === i),
          onclick: () => this.select(s.key, i),
        }));
      });
    } else {
      PARTS[s.part].forEach(([id, label]) => {
        const item = wearItem(s.key, id);
        if (item && !this.shop.on) return; // 상점이 없는 서버에서는 상점 물건을 보이지 않는다
        const cv = h('canvas', { width: s.type === 'face' ? 120 : 160, height: s.type === 'face' ? 84 : 160, 'aria-hidden': 'true' });
        const locked = item && !this.owns(item);
        const btn = h('button', {
          class: 'tile' + (locked ? ' locked' : ''), type: 'button', 'data-v': id, 'aria-pressed': String(this.avatar[s.key] === id),
          title: locked ? `열매 상점에서 열매 ${this.shop.prices[item] || WARDROBE[item].price}개로 살 수 있어요 (입어 볼 수는 있어요)` : label,
          onclick: () => this.select(s.key, id),
        }, cv, h('span', {}, label), locked ? h('small', { class: 'lock' }, `🔒 열매 ${this.shop.prices[item] || WARDROBE[item].price}`) : null);
        grid.append(btn);
        if (s.type === 'face') drawPartTile(cv, this.avatar, s.part, id);
        else this.queueThumb(cv, s.part, id);
      });
    }
    return wrap;
  }

  select(key, value) {
    if (this.avatar[key] === value) return;
    this.avatar[key] = value;
    const item = wearItem(key, value);
    this.errEl.textContent = item && this.shop.on && !this.owns(item) ? `🔒 ${WARDROBE[item].name}: 입어 보는 중이에요. 저장하려면 열매 상점에서 사 주세요.` : '';
    this.preview.setData(this.avatar);
    this.preview.celebrate();
    this.idle = 0;
    for (const sec of this.opts.querySelectorAll('.opt-sec')) {
      const k = sec.dataset.key;
      for (const b of sec.querySelectorAll('[data-v]')) {
        const v = b.classList.contains('swatch') ? Number(b.dataset.v) : b.dataset.v;
        b.setAttribute('aria-pressed', String(this.avatar[k] === v));
      }
      const s = this.tab.sections.find((x) => x.key === k);
      if (!s) continue;
      if (s.type === 'face' && FACE_DEPS.includes(key)) {
        for (const b of sec.querySelectorAll('.tile')) drawPartTile(b.querySelector('canvas'), this.avatar, s.part, b.dataset.v);
      }
      if (s.type === 'thumb' && THUMB_DEPS[s.part].includes(key)) {
        this.thumbQueue = [];
        for (const b of sec.querySelectorAll('.tile')) this.queueThumb(b.querySelector('canvas'), s.part, b.dataset.v);
      }
    }
  }

  refreshAll() {
    this.preview.setData(this.avatar);
    this.showTab(this.tab);
  }

  queueThumb(canvas, part, id) {
    this.thumbQueue.push({ canvas, part, id });
    if (!this.thumbBusy) {
      this.thumbBusy = true;
      requestAnimationFrame(() => this.drainThumbs());
    }
  }

  drainThumbs() {
    const start = performance.now();
    while (this.thumbQueue.length && performance.now() - start < 24) {
      const { canvas, part, id } = this.thumbQueue.shift();
      this.renderThumb(canvas, part, id);
    }
    if (this.thumbQueue.length) requestAnimationFrame(() => this.drainThumbs());
    else this.thumbBusy = false;
  }

  renderThumb(canvas, part, id) {
    const data = { ...this.avatar, [part]: id };
    if (part === 'hair') data.hat = 'none';
    const av = new Avatar(data);
    av.update(0, false);
    av.body.position.y = 0;
    const head = part !== 'outfit' && part !== 'back';
    av.root.rotation.y = part === 'hair' ? 0.55 : part === 'hat' ? 0.3 : part === 'back' ? Math.PI - 0.55 : part === 'face' ? 0.12 : 0.25;
    this.thumbScene.add(av.root);
    if (head) {
      this.thumbCam.position.set(0, 1.85, 3.6);
      this.thumbCam.lookAt(0, 1.52, 0);
    } else {
      this.thumbCam.position.set(0, 1.4, 5.0);
      this.thumbCam.lookAt(0, 0.85, 0);
    }
    this.thumbR.render(this.thumbScene, this.thumbCam);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.thumbR.domElement, 0, 0, canvas.width, canvas.height);
    this.thumbScene.remove(av.root);
    av.dispose();
  }
}

export { icon };
