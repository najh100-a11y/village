// 진숲 어린이 마을 — 마을 친구 NPC: 섬마다 한 명 (마을 섬 봄이, 놀이동산 섬 튼튼이, 수영장 섬 노을이)
// 자기 섬의 자리 몇 곳을 차례로 돌며 열매를 먹고, 낚시하고, 줄넘기하고, 놀이기구를 구경하고, 헤엄치고, 선베드에서 노래한다.
// 하는 일과 자리는 모든 기기가 같은 시계(park.now)로 정하므로 친구 화면에서도 같은 곳에서 같은 일을 한다.
// 아이가 가까이 오면 손을 흔들며 인사하고, 누르면 걸어가서 하이파이브·가위바위보·간식 나눠 먹기를 할 수 있다(내 화면에서만).
import * as THREE from './three.module.min.js';
import { Avatar, toon } from './avatar.js';
import { normalizeAvatar } from './face.js';
import { resetLimbs } from './park.js';
import { inPool, swimPose, SWIM_Y } from './pool.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const SPEED = 1.6; // 걷는 빠르기 (초당)
const SWIM_SPEED = 1.1; // 헤엄치는 빠르기 (초당)

// 섬마다 한 명씩 산다. isle: main 마을 섬, park 놀이동산 섬, pool 수영장 섬
export const VILLAGERS = [
  { id: 'bom', name: '봄이', isle: 'main', snack: 'strawberry', about: '열매 따 먹기를 제일 좋아해요. 마을 섬에 살아요.',
    av: { skin: 1, eyes: 'sparkle', eyeColor: 1, brows: 'arch', nose: 'dot', mouth: 'grin', cheek: 'pink', hair: 'pigtails', hairColor: 3,
      outfit: 'dress', outfitColor: 10, bottomColor: 4, shoeColor: 6, hat: 'flower', hatColor: 2 } },
  { id: 'teun', name: '튼튼이', isle: 'park', snack: 'tomato', about: '줄넘기와 공놀이 대장이에요. 놀이동산 섬에 살아요.',
    av: { skin: 3, eyes: 'big', eyeColor: 1, brows: 'brave', nose: 'button', mouth: 'teeth', cheek: 'freckle', hair: 'spiky', hairColor: 1,
      outfit: 'sporty', outfitColor: 0, bottomColor: 2, shoeColor: 3, hat: 'cap', hatColor: 2 } },
  { id: 'noeul', name: '노을이', isle: 'pool', snack: 'carrot', about: '노래하고 헤엄치는 걸 좋아해요. 수영장 섬에 살아요.',
    av: { skin: 0, eyes: 'lash', eyeColor: 4, brows: 'soft', nose: 'dot', mouth: 'cat', cheek: 'peach', hair: 'long', hairColor: 5,
      outfit: 'stripe', outfitColor: 1, bottomColor: 1, shoeColor: 1, hat: 'ribbon', hatColor: 9 } },
];

// 하루는 자기 섬의 자리 몇 곳을 차례로 돌며 보낸다: [자리, 하는 일, 머무는 초]. 다 돌면 처음부터 되풀이한다
const SWIM_LEN = 10.4; // 수영장 한쪽 끝에서 다른 쪽 끝까지
const SWIM_STAY = (SWIM_LEN / SWIM_SPEED) * 4; // 두 번 왕복하고 들어간 자리로 돌아온다
const TOURS = {
  bom: [['treeA', 'eat', 45], ['pondBench', 'sit', 40], ['pondFish', 'fish', 55], ['treeB', 'eat', 40], ['reciteA', 'recite', 45],
    ['plazaBench', 'sit', 40], ['artLook', 'look', 40], ['yardJump', 'jump', 35], ['tableB', 'table', 45]],
  teun: [['pkJump', 'jump', 35], ['pkViking', 'cheer', 45], ['pkToss', 'toss', 40], ['pkBenchE', 'sit', 35], ['pkCoaster', 'cheer', 45],
    ['pkFerris', 'look', 35], ['pkBenchW', 'sit', 35]],
  noeul: [['plShell', 'shell', 40], ['plSwim', 'swim', SWIM_STAY], ['plLie', 'lie', 45], ['plArk', 'look', 40]],
};
// 수영장 섬은 물을 가로지르지 않게 지나갈 점을 정해 둔다 (놀이동산 섬은 마을 길 찾기를 쓴다)
const VIA = {
  'plShell>plSwim': [[56, 2.6], [47.2, 2.1], [47.2, -3.6], [48.4, -3.6]],
  'plSwim>plLie': [[48.4, -3.6], [47.2, -3.6], [47.2, -9.3], [60.8, -9.3]],
  'plLie>plArk': [[60.8, -9.3], [52.6, -9.3]],
  'plArk>plShell': [[47.2, -9.3], [47.2, 2.1], [56, 2.6]],
};

// 혼잣말: 자리에 따라(없으면 하는 일에 따라). 자리에 닿고 5초 뒤 한 번, 그 뒤로는 40초마다
const SAY_FIRST = 5, SAY_EVERY = 40;
const SAY = {
  eat: ['냠냠, 달콤해!', '이 나무 열매가 제일 맛있어.'],
  sit: ['아, 좋다~', '바람이 시원해.'],
  fish: ['조용조용… 찌를 잘 봐야지.', '🐟 잡았다!'],
  recite: ['한 줄 외웠다!', '천천히, 또박또박!'],
  artLook: ['우와, 멋진 그림이다!', '나도 그려 볼까?'],
  jump: ['하나! 둘! 셋!', '줄넘기 백 개 도전!'],
  table: ['잘 먹겠습니다!', '같이 먹으면 더 맛있겠다!'],
  pkViking: ['와, 엄청 높이 올라간다!', '야호! 나도 타고 싶다!'],
  toss: ['높이 던진다!', '나이스 캐치!'],
  pkCoaster: ['롤러코스터 정말 빠르다!', '거꾸로 도는 고리 봤어?'],
  pkFerris: ['꼭대기에 오르면 마을이 보이겠지?', '곤돌라가 천천히 돈다~'],
  swim: ['어푸어푸!', '물이 시원해!'],
  lie: ['🎵 랄랄라~', '햇볕이 따뜻하다~'],
  plArk: ['무지개 색이 정말 예쁘다.', '동물들이 둘씩 방주에 들어갔대.'],
  shell: ['예쁜 조개껍데기 찾았다!', '반짝이는 모래를 파면 보물이 나온대.'],
};
// 아이가 눌렀을 때 하는 말 (자리에 따라, 없으면 하는 일에 따라)
export const TALK = {
  walk: '다음 놀 곳으로 가는 중이야. 같이 갈래?',
  fish: '나 지금 낚시하는 중이야. 너도 반짝 연못 낚시터에서 해 봐!',
  eat: '이 나무 열매 정말 맛있어. 너도 나무를 눌러서 따 먹어 봐!',
  table: '마을 식탁에서 밥 먹는 중이야. 숲속 부엌에서 요리하면 여기 올릴 수 있어!',
  artLook: '그림 공방에 걸린 그림을 보고 있었어. 너도 그려 볼래?',
  sit: '벤치에서 쉬는 중이야. 벤치를 누르면 너도 앉을 수 있어.',
  jump: '줄넘기 하는 중이야! 나 잘하지?',
  recite: '암송의 집 앞에서 이번 주 말씀을 외우고 있었어.',
  pkViking: '바이킹 구경하고 있었어. 크게 흔들릴 때 정말 신나 보여!',
  toss: '공 높이 던지기 하고 있었어. 열 번 연속으로 받는 게 목표야!',
  pkCoaster: '롤러코스터 구경하고 있었어. 승강장에서 기다리면 탈 수 있어!',
  pkFerris: '대관람차 구경하고 있었어. 한 곤돌라에 둘이 탈 수 있대!',
  swim: '헤엄치고 있었어! 너도 물로 걸어 들어오면 헤엄칠 수 있어.',
  lie: '선베드에 누워서 노래 부르고 있었어. 선베드를 누르면 너도 누울 수 있어.',
  plArk: '노아의 방주를 보고 있었어. 탁자에서 동물 짝 맞추기를 할 수 있어!',
  shell: '바닷가에서 조개껍데기를 줍고 있었어. 반짝이는 모래를 누르면 보물을 캘 수 있어!',
};
// 지금 하는 일 (마을 지도에 보인다)
const DOING = {
  walk: '다음 놀 곳으로 걸어가는 중', hold: '나를 보고 있어요', eat: '열매 나무 옆에서 열매 먹는 중', sit: '벤치에서 쉬는 중',
  fish: '연못에서 낚시하는 중', recite: '암송의 집 앞에서 말씀 외우는 중', artLook: '그림 공방 앞에서 그림 구경하는 중', jump: '줄넘기하는 중',
  table: '마을 식탁에서 밥 먹는 중', pkViking: '바이킹 구경하는 중', toss: '공 높이 던지기 하는 중', pkCoaster: '롤러코스터 구경하는 중',
  pkFerris: '대관람차 구경하는 중', swim: '수영장에서 헤엄치는 중', lie: '선베드에 누워 노래하는 중', plArk: '노아의 방주 구경하는 중', shell: '바닷가에서 조개껍데기 줍는 중',
};

// 작은 소품
function rodMesh() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.4, 6), toon('#7A5233'));
  p.position.y = 0.7;
  g.add(p);
  g.rotation.x = 2.0;
  return g;
}
function fruitMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon('#EF6461')));
  const lf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), toon('#6CC24A'));
  lf.position.set(0.04, 0.12, 0);
  lf.scale.set(1.4, 0.4, 0.8);
  g.add(lf);
  return g;
}
function bowlMesh() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 12), toon('#FFFDF7'));
  g.add(b);
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), toon('#F49A4C'));
  food.scale.set(1, 0.35, 1);
  food.position.y = 0.05;
  g.add(food);
  return g;
}

export class Villagers {
  // opts: { paths: 마을 길 꺾은선 목록, onTalk(i): 눌러서 다가갔을 때, poses: { lie: 선베드에 눕는 자세 } }
  constructor(v, opts = {}) {
    this.v = v;
    this.opts = opts;
    this.list = [];
    this.holds = new Map();
    this.spots = this.makeSpots();
    this.buildGraph(opts.paths || []);
    this.routes = new Map();
    this.tours = VILLAGERS.map((d) => this.makeTour(d));
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), toon('#F6D55C'));
    this.ball.visible = false;
    v.scene.add(this.ball);
    this.rope = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.014, 6, 24, Math.PI), toon('#EF6461'));
    this.rope.visible = false;
    v.scene.add(this.rope);
    VILLAGERS.forEach((d, i) => {
      const av = new Avatar(normalizeAvatar(d.av));
      av.root.traverse((o) => { if (o.isMesh) o.userData.pick = null; });
      av.root.userData.pick = { type: 'villager', i };
      v.scene.add(av.root);
      v.pickRoots.push(av.root);
      const tag = v.makeLabel(`🌱 ${d.name}`, 'kv-tag kv-npc');
      this.list.push({ d, i, av, tag, bubble: null, prop: null, propKind: '', pos: null, greetAt: -999, waveT: 0, saidKey: '', seat: -1, act: 'walk', spot: '', poseKind: '' });
    });
  }

  // ---------- 자리 ----------
  makeSpots() {
    const v = this.v;
    const s = {};
    const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    const put = (id, isle, x, z, rot, extra = {}) => {
      const p = V(x, 0, z);
      v.resolve(p);
      s[id] = { isle, x: p.x, z: p.z, rot, ...extra };
    };
    // ----- 마을 섬 (봄이)
    put('pondFish', 'main', -9.2, 16.8, face(-9.2, 16.8, -9.5, 13)); // 연못 남쪽 기슭 (연못을 본다)
    put('yardJump', 'main', 10.1, 14.3, 0.4); // 놀이 마당 줄넘기
    put('tableB', 'main', 11.8, 19.35, 0); // 마을 식탁 북쪽 (남쪽 식탁을 본다)
    put('artLook', 'main', 10.5, 13.5, Math.PI); // 그림 공방 앞 (북쪽 벽을 본다)
    put('reciteA', 'main', -8.8, -8.0, face(-8.8, -8.0, -11.0, -13.4)); // 암송의 집 앞
    // 열매 나무 두 그루 (길 가까운 것): 나무 옆에 서서 나무를 본다
    const tree = (ax, az) => {
      let best = null, bd = Infinity;
      for (const t of v.fruitTrees || []) { const d = Math.hypot(t.x - ax, t.z - az); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    for (const [id, ax, az] of [['treeA', -4, 6], ['treeB', -12.5, 6.5]]) {
      const t = tree(ax, az);
      if (!t) { put(id, 'main', ax, az, 0); continue; }
      const dx = ax - t.x, dz = az - t.z, d = Math.hypot(dx, dz) || 1;
      const x = t.x + (dx / d) * 1.25 * (t.s || 1), z = t.z + (dz / d) * 1.25 * (t.s || 1);
      put(id, 'main', x, z, face(x, z, t.x, t.z));
    }
    // 벤치: 가장 가까운 벤치의 왼쪽 자리 (선베드는 from 쪽 옆에 서서 눕는다)
    const bench = (id, isle, ax, az, lie = false, from = null) => {
      let bi = -1, bd = Infinity;
      (v.benches || []).forEach((b, i) => { if (!!b.lie !== lie) return; const d = Math.hypot(b.x - ax, b.z - az); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { put(id, isle, ax, az, 0); return; }
      const st = v.benchSeat(bi, 0);
      const out = v.benchOut(bi, 0, from);
      s[id] = { isle, x: out.x, z: out.z, rot: st.rot, seat: { i: bi * 2, x: st.x, y: st.y, z: st.z, rot: st.rot, lie } };
    };
    bench('pondBench', 'main', -6.9, 17.0);
    bench('plazaBench', 'main', -3.6, -2.0);
    // 연못 남쪽은 길이 없어서 연못을 가로지르지 않게 돌아가는 길을 따로 잇는다: 연못 길 끝 → 연못 동쪽 → 벤치 앞 → 낚시 자리
    if (s.pondBench) s.pondBench.chain = [[-5.6, 15.0]];
    if (s.pondFish) s.pondFish.linkSpot = 'pondBench';
    // ----- 놀이동산 섬 (튼튼이): 놀이기구 바닥과 타는 곳을 비켜서 선다
    put('pkJump', 'park', 5.5, 54.0, 0.6); // 회전목마 동쪽 마당 줄넘기
    put('pkViking', 'park', 17.0, 61.0, face(17.0, 61.0, 10.5, 60.5)); // 바이킹 동쪽에서 구경
    put('pkToss', 'park', 13.0, 66.5, -0.8); // 범퍼카 장 동쪽 공 던지기
    put('pkCoaster', 'park', -13.0, 67.5, face(-13.0, 67.5, -19.5, 64.0)); // 롤러코스터 승강장을 본다
    put('pkFerris', 'park', -10.5, 55.0, 0); // 대관람차 북쪽에서 구경
    bench('pkBenchE', 'park', 11.6, 69.5);
    bench('pkBenchW', 'park', -5, 50);
    // ----- 수영장 섬 (노을이)
    put('plShell', 'pool', 63.2, 5.0, 0.5); // 남쪽 바닷가 조개껍데기 줍기
    put('plSwim', 'pool', 50.8, -3.6, Math.PI / 2, { swim: { x0: 50.8, x1: 50.8 + SWIM_LEN } }); // 가운데 줄을 따라 왕복
    bench('plLie', 'pool', 60.8, -8, true, { x: 60.8, z: -10 }); // 동쪽 선베드 (북쪽 옆에 서서 눕는다)
    put('plArk', 'pool', 51.2, -12.6, face(51.2, -12.6, 56, -13.4)); // 방주와 무지개를 본다
    return s;
  }

  // ---------- 길 찾기: 마을 섬은 마을 길(꺾은선)을 잇는 그물, 작은 섬은 정해 둔 점이나 마을 길 찾기 ----------
  buildGraph(paths) {
    const nodes = []; // {x, z}
    const key = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`;
    const idx = new Map();
    const node = (x, z) => { const k = key(x, z); if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ x, z, e: [] }); } return idx.get(k); };
    const link = (a, b) => { if (a === b) return; const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); nodes[a].e.push([b, d]); nodes[b].e.push([a, d]); };
    const segs = [];
    paths.forEach((p, pi) => { for (let i = 0; i < p.length - 1; i++) segs.push({ pi, a: p[i], b: p[i + 1], extra: [] }); });
    const proj = (sg, x, z) => {
      const [ax, az] = sg.a, [bx, bz] = sg.b;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      return { t, x: ax + dx * t, z: az + dz * t, d: Math.hypot(ax + dx * t - x, az + dz * t - z) };
    };
    const links = [];
    // 길 끝이 다른 길 가운데에 닿으면 그 자리에서 잇는다
    paths.forEach((p, pi) => {
      for (const e of [p[0], p[p.length - 1]]) {
        for (const sg of segs) {
          if (sg.pi === pi) continue;
          const q = proj(sg, e[0], e[1]);
          if (q.d < 0.6 && q.t > 0.001 && q.t < 0.999) { sg.extra.push(q); links.push([[e[0], e[1]], [q.x, q.z]]); }
        }
      }
    });
    const mainSpots = Object.entries(this.spots).filter(([, sp]) => sp.isle === 'main');
    // 자리마다 가장 가까운 길에 잇는다 (chain이 있으면 그 점들을 거쳐서, linkSpot이 있으면 그 자리로)
    const spotLinks = {};
    for (const [id, sp] of mainSpots) {
      if (sp.linkSpot) continue;
      const end = sp.chain && sp.chain.length ? sp.chain[sp.chain.length - 1] : [sp.x, sp.z];
      let best = null, bs = null;
      for (const sg of segs) { const q = proj(sg, end[0], end[1]); if (!best || q.d < best.d) { best = q; bs = sg; } }
      if (bs) { if (best.t > 0.001 && best.t < 0.999) bs.extra.push(best); spotLinks[id] = [best.x, best.z]; }
    }
    for (const sg of segs) {
      const pts = [{ t: 0, x: sg.a[0], z: sg.a[1] }, ...sg.extra, { t: 1, x: sg.b[0], z: sg.b[1] }].sort((p, q) => p.t - q.t);
      for (let i = 0; i < pts.length - 1; i++) link(node(pts[i].x, pts[i].z), node(pts[i + 1].x, pts[i + 1].z));
    }
    for (const [a, b] of links) link(node(a[0], a[1]), node(b[0], b[1]));
    // 광장: 길 끝을 광장 가운데로 잇는다 (가운데 큰 나무는 북쪽에 있어 남쪽 가운데를 지난다). 북쪽 큰길 끝은 양옆 길로 잇는다
    const hub = node(0, -0.6);
    for (const [x, z] of [[0, 1], [-4.5, -1.2], [4.5, -1.2], [-2.5, -5.5], [2.5, -5.5]]) if (idx.has(key(x, z))) link(hub, idx.get(key(x, z)));
    if (idx.has(key(0, -7))) for (const x of [-2.5, 2.5]) if (idx.has(key(x, -5.5))) link(idx.get(key(0, -7)), idx.get(key(x, -5.5)));
    this.spotNode = {};
    for (const [id, sp] of mainSpots) this.spotNode[id] = node(sp.x, sp.z);
    for (const [id, sp] of mainSpots) {
      const n = this.spotNode[id];
      if (sp.linkSpot && this.spotNode[sp.linkSpot] != null) link(n, this.spotNode[sp.linkSpot]);
      let last = n;
      for (const [cx, cz] of sp.chain || []) { const c = node(cx, cz); link(last, c); last = c; }
      if (spotLinks[id]) link(last, node(spotLinks[id][0], spotLinks[id][1]));
      // 광장 안 자리는 광장 가운데와도 바로 잇는다
      if (Math.hypot(sp.x, sp.z + 2.5) < 5.4) link(n, hub);
      this.spotNode[id] = n;
    }
    this.nodes = nodes;
  }
  // 두 자리 사이 길 (꺾인 점 목록과 길이)
  route(from, to) {
    const k = `${from}>${to}`;
    if (this.routes.has(k)) return this.routes.get(k);
    const A = this.spots[from], B = this.spots[to];
    let pts;
    if (A.isle !== 'main') {
      // 작은 섬: 정해 둔 점을 지나거나, 아이가 누른 곳으로 걸어갈 때와 같은 길 찾기 (집과 놀이기구를 돌아간다)
      const via = VIA[k] ? VIA[k].map(([x, z]) => ({ x, z })) : this.v.planRoute({ x: A.x, z: A.z }, { x: B.x, z: B.z });
      pts = [V(A.x, 0, A.z), ...via.map((q) => V(q.x, 0, q.z)), V(B.x, 0, B.z)];
    } else {
      const N = this.nodes, a = this.spotNode[from], b = this.spotNode[to];
      const dist = new Array(N.length).fill(Infinity), prev = new Array(N.length).fill(-1), done = new Array(N.length).fill(false);
      dist[a] = 0;
      for (;;) {
        let u = -1;
        for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || u === b) break;
        done[u] = true;
        for (const [w, d] of N[u].e) if (dist[u] + d < dist[w]) { dist[w] = dist[u] + d; prev[w] = u; }
      }
      pts = [];
      if (dist[b] < Infinity) { for (let u = b; u >= 0; u = prev[u]) pts.unshift(V(N[u].x, 0, N[u].z)); } else pts.push(V(A.x, 0, A.z), V(B.x, 0, B.z));
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    const r = { pts, len };
    this.routes.set(k, r);
    return r;
  }
  // 한 바퀴: 자리마다 앞 자리에서 걸어오는 길과 머무는 시간
  makeTour(d) {
    const T = TOURS[d.id];
    const stops = T.map(([spot, act, stay], k) => ({ spot, act, stay, leg: this.route(T[(k + T.length - 1) % T.length][0], spot) }));
    const cyc = stops.reduce((a, st) => a + st.leg.len / SPEED + st.stay, 0);
    return { stops, cyc };
  }

  // ---------- 지금 하는 일 (같은 시계로 정한다) ----------
  plan(i, T) {
    const tour = this.tours[i];
    const round = Math.floor(T / tour.cyc);
    let u = T - round * tour.cyc;
    for (let si = 0; si < tour.stops.length; si++) {
      const st = tour.stops[si], r = st.leg, walkT = r.len / SPEED;
      if (u < walkT && r.len > 0.05) {
        let d = u * SPEED;
        for (let k = 1; k < r.pts.length; k++) {
          const a = r.pts[k - 1], b = r.pts[k], L = a.distanceTo(b);
          if (d <= L || k === r.pts.length - 1) {
            const f = L ? Math.min(1, d / L) : 1;
            return { act: 'walk', x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, rot: Math.atan2(b.x - a.x, b.z - a.z), moving: true, si, round };
          }
          d -= L;
        }
      }
      u -= Math.max(0, walkT);
      if (u < st.stay || si === tour.stops.length - 1) {
        const sp = this.spots[st.spot], t = Math.min(u, st.stay);
        if (st.act === 'swim') {
          // 가운데 줄을 따라 왕복한다 (한쪽 끝까지 SWIM_LEN)
          const legT = SWIM_LEN / SWIM_SPEED, n = Math.floor(t / legT), f = (t - n * legT) / legT, out = n % 2 === 0;
          const x = out ? sp.swim.x0 + SWIM_LEN * f : sp.swim.x1 - SWIM_LEN * f;
          return { act: 'swim', spot: st.spot, x, z: sp.z, rot: out ? Math.PI / 2 : -Math.PI / 2, t, si, round, moving: true, lap: n };
        }
        return { act: st.act, spot: st.spot, x: sp.x, z: sp.z, rot: sp.rot, seat: sp.seat || null, t, si, round, moving: false };
      }
      u -= st.stay;
    }
    const sp = this.spots[tour.stops[0].spot];
    return { act: 'walk', x: sp.x, z: sp.z, rot: sp.rot, moving: false, si: 0, round };
  }
  // 지금 하는 일을 짧게 (마을 지도), 눌렀을 때 하는 말
  doingText(p) { return p ? (p.act === 'walk' || p.act === 'hold' ? DOING[p.act] : DOING[p.spot] || DOING[p.act] || '') : ''; }
  talkOf(i) { const n = this.list[i]; return (n && n.act !== 'walk' && (TALK[n.spot] || TALK[n.act])) || TALK.walk; }

  // ---------- 아이와 놀기 ----------
  // 눌렀을 때: 아이가 그 친구 곁으로 걸어간 뒤 talk를 부른다 (그동안 친구는 내 화면에서만 잠깐 멈춘다)
  walkTo(i) {
    const v = this.v, n = this.list[i];
    if (!n || !v.player || v.mode !== 'play') return;
    this.hold(i, 12);
    const g = n.av.root.position, p = v.player.root.position;
    const dir = V(p.x - g.x, 0, p.z - g.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const pos = V(g.x, 0, g.z).addScaledVector(dir, 1.25);
    v.resolve(pos);
    v.target = { pos, action: () => { v.faceTo(n.av.root.position); this.hold(i, 40); if (this.opts.onTalk) this.opts.onTalk(i); } };
    v.showTapMark(pos);
    v.reportMove(pos.x, pos.z);
  }
  hold(i, sec) { this.holds.set(i, (this.v.time || 0) + sec); }
  release(i) { this.holds.delete(i); }
  held(i) { const until = this.holds.get(i); return until != null && (this.v.time || 0) < until; }
  // 지금 하는 일 (말할 거리)
  actOf(i) { const n = this.list[i]; return n ? n.act : 'walk'; }
  say(i, text, life = 2.8) {
    const n = this.list[i];
    if (!n) return;
    if (n.bubble) n.bubble.el.remove();
    const el = this.v.makeLabel(text, 'kv-bubble npc-say' + ([...text].length <= 2 ? ' emoji' : ''));
    n.bubble = { el, life };
  }
  jump(i) { const n = this.list[i]; if (n && !n.swimming) n.av.jump(); }
  cheer(i) { const n = this.list[i]; if (n && !n.swimming) { n.av.celebrate(); n.waveT = 1.6; } }
  // 벤치 자리를 NPC가 쓰고 있는지 (아이가 같은 자리에 앉지 않게)
  seatTaken(seat) { return this.list.some((n) => n.seat === seat); }
  // 아이 이름 (인사할 때)
  myName() { const t = this.v.myTag && this.v.myTag.textContent; return t || '친구'; }

  // ---------- 매 장면 ----------
  update(T, dt) {
    const v = this.v;
    const pp = v.player && v.mode === 'play' && !v.atHome ? v.player.root.position : null;
    let ballOn = false, ropeOn = false;
    this.list.forEach((n, i) => {
      const av = n.av, root = av.root;
      const held = this.held(i);
      let p = this.plan(i, T);
      if (held) p = { act: 'hold', x: n.pos ? n.pos.x : p.x, z: n.pos ? n.pos.z : p.z, rot: root.rotation.y, moving: false };
      if (!held) { n.act = p.act; n.spot = p.spot || ''; }
      // 보이는 자리는 정해진 자리를 따라간다 (멈췄다 가면 조금 빨리 걸어서 따라잡는다)
      if (!n.pos) { n.pos = V(p.x, 0, p.z); root.position.set(p.x, 0, p.z); }
      const want = V(p.x, 0, p.z);
      const gap = n.pos.distanceTo(want);
      let moving = !!p.moving;
      if (gap > 10) n.pos.copy(want);
      else if (gap > 0.03) {
        const sp = Math.min(gap, (gap > 0.6 ? SPEED * 2.2 : SPEED * 1.4) * dt);
        const dir = want.clone().sub(n.pos).normalize();
        n.pos.addScaledVector(dir, sp);
        if (gap > 0.15) { moving = true; p = { ...p, rot: Math.atan2(dir.x, dir.z) }; }
      }
      // 벤치·선베드에 아이나 친구가 먼저 있으면 앉지 않고 그 옆에 선다
      const seatFree = p.seat && !(v.sitting && v.sitting.seat === p.seat.i) && !v.benchTaken(p.seat.i, true);
      const seated = !held && (p.act === 'sit' || p.act === 'lie') && seatFree && gap < 0.3;
      n.seat = seated ? p.seat.i : -1;
      // 헤엄치기: 물에 들어가면 머리와 어깨만 물 위로
      const swim = inPool(n.pos.x, n.pos.z);
      if (swim !== !!n.swimming) {
        n.swimming = swim;
        if (v.pool) v.pool.splash(n.pos.x, n.pos.z);
      }
      if (seated) root.position.set(p.seat.x, p.seat.y, p.seat.z);
      else {
        const q = n.pos.clone();
        v.resolve(q);
        const y = root.position.y + ((swim ? SWIM_Y : 0) - root.position.y) * Math.min(1, dt * 6);
        root.position.set(q.x, Math.abs(y) < 0.002 ? 0 : y, q.z);
      }
      if (swim && v.pool) {
        n.rip = (n.rip || 0) - dt;
        if (n.rip <= 0) { v.pool.ripple(root.position.x, root.position.z, moving ? 1 : 0.7); n.rip = moving ? 0.4 : 1.2; }
      }
      // 얼굴 방향: 걸을 때는 가는 쪽, 아이가 가까우면(인사, 멈춤) 아이 쪽, 아니면 그 자리에서 보는 쪽
      let face = seated ? p.seat.rot : p.rot;
      const near = pp && Math.hypot(pp.x - root.position.x, pp.z - root.position.z) < 2.8;
      if ((held || (near && !moving && !seated)) && pp) face = Math.atan2(pp.x - root.position.x, pp.z - root.position.z);
      root.rotation.y = turnTo(root.rotation.y, face, dt * (moving ? 8 : 5));
      // 아이가 가까이 오면 손을 흔들며 인사 (한 친구에 90초에 한 번)
      if (near && !held && (v.time - n.greetAt) > 90) {
        n.greetAt = v.time;
        if (!swim && !seated) n.waveT = 1.6;
        this.say(i, `안녕, ${this.myName()}!`);
        if (this.opts.onGreet) this.opts.onGreet(i);
      }
      // 소품과 자세
      this.dress(n, held ? 'hold' : p.act, p, seated, swim);
      av.swimMoving = moving;
      av.update(dt, moving && !swim, 1);
      if (!held && p.act === 'toss' && !moving) ballOn = this.tossBall(n, p) || ballOn;
      if (!held && p.act === 'jump' && !moving) { ropeOn = true; this.jumpRope(n, p); }
      if (n.waveT > 0 && !swim && !seated) {
        n.waveT -= dt;
        av.arms[1].rotation.x = -2.7;
        av.arms[1].rotation.z = 0.25 + Math.sin(v.time * 14) * 0.35;
      } else if (n.waveT > 0) n.waveT -= dt;
      // 가끔 혼잣말 (자리에 닿고 조금 뒤 한 번, 그 뒤로 40초마다)
      if (!held && p.act !== 'walk') this.chatter(n, i, p);
      // 이름표와 말풍선
      const show = !v.atHome;
      const top = seated ? (p.act === 'lie' ? 1.55 : 2.15) : 2.45;
      if (show) v.placeLabel(n.tag, root.position, top); else n.tag.style.display = 'none';
      if (n.bubble) {
        n.bubble.life -= dt;
        if (n.bubble.life <= 0 || !show) { n.bubble.el.remove(); n.bubble = null; }
        else { n.bubble.el.style.opacity = String(Math.min(1, n.bubble.life / 0.4)); v.placeLabel(n.bubble.el, root.position, top + 0.4); }
      }
    });
    if (!ballOn) this.ball.visible = false;
    if (!ropeOn) this.rope.visible = false;
  }

  // 손에 드는 것과 자세
  dress(n, act, p, seated, swim) {
    const av = n.av;
    const kind = swim ? '' : act === 'fish' ? 'rod' : act === 'eat' ? 'fruit' : act === 'table' ? 'bowl' : '';
    if (n.propKind !== kind) {
      if (n.prop) { av.drop(); n.prop.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); n.prop = null; }
      n.propKind = kind;
      if (kind) {
        n.prop = kind === 'rod' ? rodMesh() : kind === 'fruit' ? fruitMesh() : bowlMesh();
        av.hold(n.prop, 1);
        if (kind !== 'rod') n.prop.position.set(0, -0.5, 0.08);
      }
    }
    // 헤엄치기·눕기 자세에서 벗어나면 몸을 바로 세운다
    const pk = swim ? 'swim' : seated && act === 'lie' ? 'lie' : '';
    if (n.poseKind !== pk) { if (n.poseKind) resetLimbs(av); n.poseKind = pk; }
    const t = p.t || 0;
    if (swim) { av.stroke = p.lap != null && p.lap % 4 >= 2 ? 'back' : 'free'; av.pose = swimPose; return; }
    if (pk === 'lie' && this.opts.poses && this.opts.poses.lie) av.pose = this.opts.poses.lie;
    else if (act === 'sit' && seated) av.pose = (a) => { a.legs[0].rotation.x = a.legs[1].rotation.x = -1.45; a.arms[0].rotation.x = a.arms[1].rotation.x = -0.4; };
    else if (act === 'fish') av.pose = (a) => { a.arms[1].rotation.x = -1.05; a.arms[0].rotation.x = -0.8; a.arms[0].rotation.z = 0.35; };
    else if (act === 'eat' || act === 'table') {
      av.pose = (a) => {
        const k = (t % 2.6) + 0.5;
        const bite = Math.max(0, Math.sin(k * 11)) * 0.18;
        a.arms[1].rotation.x = -1.5 + bite;
        a.arms[1].rotation.z = -0.25;
        a.arms[0].rotation.x = act === 'table' ? -1.0 : -0.3;
        a.head.rotation.x = bite * 0.6;
      };
    } else if (act === 'look') av.pose = (a) => { a.head.rotation.x = -0.25; if (Math.floor(t / 4) % 3 === 0) { a.arms[1].rotation.x = -2.2; a.arms[1].rotation.z = 0.1; } };
    else if (act === 'cheer') {
      // 놀이기구 구경: 4초마다 두 팔을 들고 폴짝
      av.pose = (a) => {
        const k = t % 4;
        if (k < 1.3) { a.arms[0].rotation.x = a.arms[1].rotation.x = -2.6 + Math.sin(k * 12) * 0.25; a.arms[0].rotation.z = -0.35; a.arms[1].rotation.z = 0.35; }
        else a.head.rotation.x = -0.2;
      };
      if (Math.floor(t / 4) !== n.lastHop && t % 4 < 0.3) { n.lastHop = Math.floor(t / 4); av.jump(); }
    } else if (act === 'recite') av.pose = (a) => { a.arms[0].rotation.x = a.arms[1].rotation.x = -0.9; a.arms[0].rotation.z = 0.4; a.arms[1].rotation.z = -0.4; a.head.rotation.x = Math.sin(t * 2.5) * 0.08; };
    else if (act === 'shell') {
      // 모래를 내려다보다가 가끔 주워서 들어 본다
      av.pose = (a) => {
        const k = t % 6;
        a.head.rotation.x = k < 4.5 ? 0.5 : 0.1;
        a.arms[1].rotation.x = k < 4.5 ? -0.55 - Math.sin(k * 3) * 0.15 : -1.7;
        a.arms[0].rotation.x = -0.3;
      };
    } else av.pose = null;
    if (!av.pose && act !== 'jump') av.body.rotation.z = 0;
  }

  // 공 높이 던지기: 1.6초마다 위로 던져서 받는다
  tossBall(n, p) {
    const t = p.t || 0, per = 1.6, k = (t % per) / per;
    const root = n.av.root, f = root.rotation.y;
    const b = this.ball;
    b.visible = true;
    b.position.set(root.position.x + Math.sin(f) * 0.35, 1.25 + Math.sin(k * Math.PI) * 1.7, root.position.z + Math.cos(f) * 0.35);
    const up = k < 0.18 || k > 0.82;
    n.av.arms[0].rotation.x = n.av.arms[1].rotation.x = up ? -2.1 : -1.2;
    n.av.head.rotation.x = -0.35 * Math.sin(k * Math.PI);
    return true;
  }
  // 줄넘기: 두 손을 잇는 줄이 몸 둘레를 앞으로 돌고, 줄이 발밑에 올 때 폴짝 뛴다
  jumpRope(n, p) {
    const t = p.t || 0, per = 0.8;
    const ph = (t % per) / per;
    if (Math.floor(t / per) !== n.lastJump) { n.lastJump = Math.floor(t / per); n.av.jump(); }
    const r = this.rope, root = n.av.root;
    r.visible = true;
    r.position.set(root.position.x, 0.95, root.position.z);
    // 반원 줄(두 끝이 양손)을 몸의 옆축으로 돌린다. 뛰어오른 꼭대기(약 0.39)에 줄이 발밑(반 바퀴)에 온다
    r.rotation.set((ph - 0.39) * Math.PI * 2 + Math.PI, root.rotation.y, 0, 'YXZ');
    n.av.arms[0].rotation.x = n.av.arms[1].rotation.x = -0.5;
    n.av.arms[0].rotation.z = -0.7; n.av.arms[1].rotation.z = 0.7;
  }

  // 혼잣말: 자리에 닿고 5초 뒤 한 번, 그 뒤로 40초마다 (같은 때 같은 말을 두 번 하지 않게)
  chatter(n, i, p) {
    const lines = SAY[p.spot] || SAY[p.act];
    if (!lines) return;
    const t = p.t || 0;
    if (t < SAY_FIRST) return;
    const step = Math.floor((t - SAY_FIRST) / SAY_EVERY);
    const k = `${p.round}:${p.si}:${step}`;
    if (n.saidKey !== k && (t - SAY_FIRST) - step * SAY_EVERY < 0.6) {
      n.saidKey = k;
      const line = lines[(step + p.round + p.si) % lines.length];
      this.say(i, line);
      if (line.startsWith('🐟')) n.av.jump();
    }
  }
}

function turnTo(cur, want, k) {
  let d = want - cur;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return cur + d * Math.min(1, k);
}
