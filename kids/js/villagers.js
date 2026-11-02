// 진숲 어린이 마을 — 마을 친구 NPC 넷 (봄이, 하람이, 튼튼이, 노을이)
// 마을 길을 따라 걸어 다니며 수다를 떨고, 낚시하고, 공을 주고받고, 열매와 밥을 먹고, 다 같이 춤춘다.
// 하는 일과 자리는 모든 기기가 같은 시계(park.now)로 정하므로 친구 화면에서도 같은 곳에서 같은 일을 한다.
// 아이가 가까이 오면 손을 흔들며 인사하고, 누르면 걸어가서 하이파이브·가위바위보·간식 나눠 먹기를 할 수 있다(내 화면에서만).
import * as THREE from './three.module.min.js';
import { Avatar, toon } from './avatar.js';
import { normalizeAvatar } from './face.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const SPEED = 1.6; // 걷는 빠르기 (초당)

export const VILLAGERS = [
  { id: 'bom', name: '봄이', snack: 'strawberry', about: '열매 따 먹기를 제일 좋아해요.',
    av: { skin: 1, eyes: 'sparkle', eyeColor: 1, brows: 'arch', nose: 'dot', mouth: 'grin', cheek: 'pink', hair: 'pigtails', hairColor: 3,
      outfit: 'dress', outfitColor: 10, bottomColor: 4, shoeColor: 6, hat: 'flower', hatColor: 2 } },
  { id: 'haram', name: '하람이', snack: 'carrot', about: '조용히 낚시하는 걸 좋아해요.',
    av: { skin: 2, eyes: 'round', eyeColor: 0, brows: 'soft', nose: 'round', mouth: 'smile', cheek: 'none', hair: 'short', hairColor: 0,
      outfit: 'check', outfitColor: 7, bottomColor: 3, shoeColor: 5, hat: 'bucket', hatColor: 4 } },
  { id: 'teun', name: '튼튼이', snack: 'tomato', about: '줄넘기와 공놀이 대장이에요.',
    av: { skin: 3, eyes: 'big', eyeColor: 1, brows: 'brave', nose: 'button', mouth: 'teeth', cheek: 'freckle', hair: 'spiky', hairColor: 1,
      outfit: 'sporty', outfitColor: 0, bottomColor: 2, shoeColor: 3, hat: 'cap', hatColor: 2 } },
  { id: 'noeul', name: '노을이', snack: 'strawberry', about: '그림 그리고 노래하는 걸 좋아해요.',
    av: { skin: 0, eyes: 'lash', eyeColor: 4, brows: 'soft', nose: 'dot', mouth: 'cat', cheek: 'peach', hair: 'long', hairColor: 5,
      outfit: 'stripe', outfitColor: 1, bottomColor: 1, shoeColor: 1, hat: 'ribbon', hatColor: 9 } },
];

// 둘이 나누는 이야기 (번갈아 말한다). 마을에 실제로 있는 것만 말한다
const CHATS = [
  ['오늘 묵상 했어?', '응! 묵상하고 나니까 마음이 편해.'],
  ['반짝 연못에서 황금잉어 봤어?', '아직! 오늘은 꼭 낚아 볼 거야.'],
  ['나눔 수레에 누가 딸기를 올렸더라!', '와, 하나 먹으러 가야지.'],
  ['이번 주 암송 구절 외웠어?', '반쯤 외웠어. 같이 연습할래?'],
  ['롤러코스터 빙글 돌 때 무서웠어?', '조금! 그래도 또 타고 싶어.'],
  ['그림 공방에 새 그림이 걸렸대.', '누구 그림일까? 이따 보러 가자.'],
  ['바다에 물고기 떼가 왔대!', '갈매기 도는 곳으로 노 저어 가 보자!'],
  ['우리 밭에 토마토가 열렸어.', '정말? 나눔 수레에 올려 줘!'],
  ['노아의 방주 짝 맞추기 해 봤어?', '응, 코끼리 짝을 제일 먼저 찾았어!'],
  ['물수제비 몇 번 튀겼어?', '다섯 번! 오늘의 물수제비 왕 될 거야.'],
];
const SAY = {
  fish: ['조용조용… 찌를 잘 봐야지.', '🐟 잡았다!', '오늘은 물고기가 잘 무네.'],
  eat: ['냠냠, 달콤해!', '이 나무 열매가 제일 맛있어.', '하나 더 먹을까?'],
  table: ['같이 먹으니까 더 맛있다!', '냠냠!', '잘 먹겠습니다!'],
  look: ['우와, 멋진 그림이다!', '나도 그려 볼까?', '색이 정말 예쁘다.'],
  sit: ['아, 좋다~', '바람이 시원해.', '조금 쉬었다 가야지.'],
  jump: ['하나! 둘! 셋!', '줄넘기 백 개 도전!', '헉헉, 열 개 더!'],
  toss: ['받아!', '나이스 캐치!', '이번엔 높이 던진다!'],
  dance: ['🎵', '랄랄라~', '다 같이 빙글빙글!'],
  recite: ['한 줄 외웠다!', '처음부터 다시 해 볼까?', '천천히, 또박또박!'],
};
// 아이가 눌렀을 때 하는 말 (하고 있는 일에 따라)
export const TALK = {
  walk: '어디 가냐고? 마을을 한 바퀴 도는 중이야!',
  chat: '친구랑 이야기하고 있었어. 너도 같이 놀자!',
  fish: '나 지금 낚시하는 중이야. 너도 반짝 연못 낚시터에서 해 봐!',
  eat: '이 나무 열매 정말 맛있어. 너도 나무를 눌러서 따 먹어 봐!',
  table: '마을 식탁에서 밥 먹는 중이야. 숲속 부엌에서 요리하면 여기 올릴 수 있어!',
  look: '그림 공방에 걸린 그림을 보고 있었어. 너도 그려 볼래?',
  sit: '벤치에서 쉬는 중이야. 벤치를 누르면 너도 앉을 수 있어.',
  jump: '줄넘기 하는 중이야! 나 잘하지?',
  toss: '공 주고받기 하고 있었어. 받아랏!',
  dance: '다 같이 춤추는 시간이야! 신나지?',
  recite: '암송의 집 앞에서 이번 주 말씀을 같이 외우고 있었어.',
};

// 하루를 다섯 장면으로 나누어 되풀이한다 (한 장면 80초, 앞부분은 다음 자리로 걸어간다)
const SCENE_SEC = 80;
const SCENES = [
  { bom: ['chatA', 'chat', 'noeul'], noeul: ['chatB', 'chat', 'bom'], haram: ['pondFish', 'fish'], teun: ['yardJump', 'jump'] },
  { bom: ['treeA', 'eat'], teun: ['tossA', 'toss', 'noeul'], noeul: ['tossB', 'toss', 'teun'], haram: ['pondBench', 'sit'] },
  { haram: ['tableA', 'table'], bom: ['tableB', 'table'], noeul: ['artLook', 'look'], teun: ['yardJump2', 'jump'] },
  { bom: ['dance0', 'dance'], haram: ['dance1', 'dance'], teun: ['dance2', 'dance'], noeul: ['dance3', 'dance'] },
  { bom: ['plazaBench', 'sit'], haram: ['reciteA', 'recite', 'teun'], teun: ['reciteB', 'recite', 'haram'], noeul: ['treeB', 'eat'] },
];

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
  // opts: { paths: 마을 길 꺾은선 목록, onTalk(i): 눌러서 다가갔을 때 }
  constructor(v, opts = {}) {
    this.v = v;
    this.opts = opts;
    this.list = [];
    this.holds = new Map();
    this.spots = this.makeSpots();
    this.buildGraph(opts.paths || []);
    this.routes = new Map();
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
      this.list.push({ d, i, av, tag, bubble: null, prop: null, propKind: '', pos: null, greetAt: -99, waveT: 0, saidKey: '', seat: -1, act: 'walk' });
    });
  }

  // ---------- 자리 ----------
  makeSpots() {
    const v = this.v;
    const s = {};
    const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    const put = (id, x, z, rot) => {
      const p = V(x, 0, z);
      v.resolve(p);
      s[id] = { x: p.x, z: p.z, rot };
    };
    // 광장 남쪽: 둘이 마주 보고 이야기
    put('chatA', -1.0, 0.1, face(-1.0, 0.1, 0.4, 0.6));
    put('chatB', 0.4, 0.6, face(0.4, 0.6, -1.0, 0.1));
    // 연못 남쪽 기슭에서 낚시 (연못을 본다)
    put('pondFish', -9.2, 16.8, face(-9.2, 16.8, -9.5, 13));
    // 놀이 마당: 줄넘기, 공 주고받기
    put('yardJump', 10.1, 14.3, 0.4);
    put('yardJump2', 12.3, 14.2, -0.4);
    put('tossA', 9.8, 16.3, face(9.8, 16.3, 12.6, 16.0));
    put('tossB', 12.6, 16.0, face(12.6, 16.0, 9.8, 16.3));
    // 마을 식탁 북쪽에서 밥 먹기 (남쪽 식탁을 본다)
    put('tableA', 10.6, 19.35, 0);
    put('tableB', 11.8, 19.35, 0);
    // 그림 공방 앞에서 그림 구경 (북쪽 벽을 본다)
    put('artLook', 10.5, 13.5, Math.PI);
    // 광장 가운데 넷이 둥글게 서서 춤
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.3;
      const x = Math.sin(a) * 1.3, z = -0.3 + Math.cos(a) * 1.3;
      put(`dance${k}`, x, z, face(x, z, 0, -0.3));
    }
    // 암송의 집 앞에서 함께 외우기 (집을 본다)
    put('reciteA', -8.8, -8.0, face(-8.8, -8.0, -11.0, -13.4));
    put('reciteB', -10.0, -7.6, face(-10.0, -7.6, -11.0, -13.4));
    // 열매 나무 두 그루 (길 가까운 것): 나무 옆에 서서 나무를 본다
    const tree = (ax, az) => {
      let best = null, bd = Infinity;
      for (const t of v.fruitTrees || []) { const d = Math.hypot(t.x - ax, t.z - az); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    for (const [id, ax, az] of [['treeA', -4, 6], ['treeB', -12.5, 6.5]]) {
      const t = tree(ax, az);
      if (!t) { put(id, ax, az, 0); continue; }
      const dx = ax - t.x, dz = az - t.z, d = Math.hypot(dx, dz) || 1;
      const x = t.x + (dx / d) * 1.25 * (t.s || 1), z = t.z + (dz / d) * 1.25 * (t.s || 1);
      put(id, x, z, face(x, z, t.x, t.z));
    }
    // 벤치: 연못 벤치와 광장 서쪽 벤치 (가장 가까운 벤치의 왼쪽 자리)
    const bench = (id, ax, az) => {
      let bi = -1, bd = Infinity;
      (v.benches || []).forEach((b, i) => { if (b.lie) return; const d = Math.hypot(b.x - ax, b.z - az); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { put(id, ax, az, 0); return; }
      const st = v.benchSeat(bi, 0);
      const out = v.benchOut(bi, 0);
      s[id] = { x: out.x, z: out.z, rot: st.rot, seat: { i: bi * 2, x: st.x, y: st.y, z: st.z, rot: st.rot } };
    };
    bench('pondBench', -6.9, 17.0);
    bench('plazaBench', -3.6, -2.0);
    // 연못 남쪽은 길이 없어서 연못을 가로지르지 않게 돌아가는 길을 따로 잇는다: 연못 길 끝 → 연못 동쪽 → 벤치 앞 → 낚시 자리
    if (s.pondBench) s.pondBench.chain = [[-5.6, 15.0]];
    if (s.pondFish) s.pondFish.linkSpot = 'pondBench';
    return s;
  }

  // ---------- 길 찾기: 마을 길(꺾은선)을 잇는 그물과 자리 ----------
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
    // 자리마다 가장 가까운 길에 잇는다 (chain이 있으면 그 점들을 거쳐서, linkSpot이 있으면 그 자리로)
    const spotLinks = {};
    for (const [id, sp] of Object.entries(this.spots)) {
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
    for (const [id, sp] of Object.entries(this.spots)) this.spotNode[id] = node(sp.x, sp.z);
    for (const [id, sp] of Object.entries(this.spots)) {
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
  // 두 자리 사이 길 (가장 짧은 길, 꺾인 점 목록과 길이)
  route(from, to) {
    const k = `${from}>${to}`;
    if (this.routes.has(k)) return this.routes.get(k);
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
    const pts = [];
    if (dist[b] < Infinity) { for (let u = b; u >= 0; u = prev[u]) pts.unshift(V(N[u].x, 0, N[u].z)); } else pts.push(V(N[a].x, 0, N[a].z), V(N[b].x, 0, N[b].z));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    const r = { pts, len };
    this.routes.set(k, r);
    return r;
  }

  // ---------- 지금 하는 일 (같은 시계로 정한다) ----------
  plan(i, T) {
    const id = VILLAGERS[i].id;
    const cyc = SCENES.length * SCENE_SEC;
    const tc = ((T % cyc) + cyc) % cyc;
    const si = Math.floor(tc / SCENE_SEC), u = tc - si * SCENE_SEC;
    const round = Math.floor(T / cyc);
    const cur = SCENES[si][id], prev = SCENES[(si + SCENES.length - 1) % SCENES.length][id];
    const r = this.route(prev[0], cur[0]);
    const walkT = r.len / SPEED;
    const sp = this.spots[cur[0]];
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
    return { act: cur[1], spot: cur[0], with: cur[2] || null, x: sp.x, z: sp.z, rot: sp.rot, seat: sp.seat || null, t: u - walkT, si, round, moving: false };
  }

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
    const pos = g.clone().addScaledVector(dir, 1.25);
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
  say(i, text, life = 2.6) {
    const n = this.list[i];
    if (!n) return;
    if (n.bubble) n.bubble.el.remove();
    const el = this.v.makeLabel(text, 'kv-bubble npc-say' + ([...text].length <= 2 ? ' emoji' : ''));
    n.bubble = { el, life };
  }
  jump(i) { const n = this.list[i]; if (n) n.av.jump(); }
  cheer(i) { const n = this.list[i]; if (n) { n.av.celebrate(); n.waveT = 1.6; } }
  // 벤치 자리를 NPC가 쓰고 있는지 (아이가 같은 자리에 앉지 않게)
  seatTaken(seat) { return this.list.some((n) => n.seat === seat); }
  // 아이 이름 (인사할 때)
  myName() { const t = this.v.myTag && this.v.myTag.textContent; return t || '친구'; }

  // ---------- 매 장면 ----------
  update(T, dt) {
    const v = this.v;
    const pp = v.player && v.mode === 'play' && !v.atHome ? v.player.root.position : null;
    let ballOn = false, ropeOn = false;
    const plans = this.list.map((n, i) => this.plan(i, T));
    this.list.forEach((n, i) => {
      const av = n.av, root = av.root;
      const held = this.held(i);
      let p = plans[i];
      if (held) p = { act: 'hold', x: root.position.x, z: root.position.z, rot: root.rotation.y, moving: false };
      n.act = held ? (n.act === 'hold' ? 'walk' : n.act) : p.act;
      // 보이는 자리는 정해진 자리를 따라간다 (멈췄다 가면 조금 빨리 걸어서 따라잡는다)
      if (!n.pos) { n.pos = V(p.x, 0, p.z); root.position.copy(n.pos); }
      const want = V(p.x, 0, p.z);
      const gap = n.pos.distanceTo(want);
      let moving = p.moving;
      if (gap > 10) n.pos.copy(want);
      else if (gap > 0.03) {
        const sp = Math.min(gap, (gap > 0.6 ? SPEED * 2.2 : SPEED * 1.4) * dt);
        const dir = want.clone().sub(n.pos).normalize();
        n.pos.addScaledVector(dir, sp);
        if (gap > 0.15) { moving = true; p = { ...p, rot: Math.atan2(dir.x, dir.z) }; }
      }
      // 벤치에 아이나 친구가 먼저 앉아 있으면 앉지 않고 그 앞에 선다
      const seatFree = p.seat && !(v.sitting && v.sitting.seat === p.seat.i) && !v.benchTaken(p.seat.i, true);
      const seated = !held && p.act === 'sit' && seatFree && gap < 0.3;
      n.seat = seated ? p.seat.i : -1;
      if (seated) {
        root.position.set(p.seat.x, p.seat.y, p.seat.z);
      } else {
        const q = n.pos.clone();
        v.resolve(q);
        root.position.set(q.x, 0, q.z);
      }
      // 얼굴 방향: 걸을 때는 가는 쪽, 아이가 가까우면(인사, 멈춤) 아이 쪽, 아니면 그 자리에서 보는 쪽
      let face = seated ? p.seat.rot : p.rot;
      const near = pp && Math.hypot(pp.x - root.position.x, pp.z - root.position.z) < 2.8;
      if ((held || (near && !moving && p.act !== 'dance' && p.act !== 'toss' && !seated)) && pp) face = Math.atan2(pp.x - root.position.x, pp.z - root.position.z);
      root.rotation.y = turnTo(root.rotation.y, face, dt * (moving ? 8 : 5));
      // 아이가 가까이 오면 손을 흔들며 인사 (한 친구에 40초에 한 번)
      if (near && !held && (v.time - n.greetAt) > 40) {
        n.greetAt = v.time;
        n.waveT = 1.6;
        this.say(i, `안녕, ${this.myName()}!`);
        if (this.opts.onGreet) this.opts.onGreet(i);
      }
      // 소품과 자세
      this.dress(n, held ? 'hold' : p.act, p, plans, T);
      if (!held && p.act === 'toss' && p.with && n.d.id < p.with) ballOn = this.tossBall(n, i, p, plans) || ballOn;
      av.update(dt, moving, 1);
      // 공 주고받기: 던지는 쪽은 팔을 올리고, 받는 쪽은 두 팔을 앞으로 내민다
      if (n.tossArm === 'throw') { av.arms[1].rotation.x = -2.5; }
      else if (n.tossArm === 'catch') { av.arms[0].rotation.x = av.arms[1].rotation.x = -1.5; }
      n.tossArm = '';
      if (!held && p.act === 'jump' && !moving) { ropeOn = true; this.jumpRope(n, p); }
      if (n.waveT > 0) {
        n.waveT -= dt;
        av.arms[1].rotation.x = -2.7;
        av.arms[1].rotation.z = 0.25 + Math.sin(v.time * 14) * 0.35;
      }
      // 하는 일에 맞게 가끔 혼잣말 (장면마다 정해진 때)
      if (!held && !moving) this.chatter(n, i, p);
      // 이름표와 말풍선
      const show = !v.atHome;
      if (show) v.placeLabel(n.tag, root.position, seated ? 2.15 : 2.45); else n.tag.style.display = 'none';
      if (n.bubble) {
        n.bubble.life -= dt;
        if (n.bubble.life <= 0 || !show) { n.bubble.el.remove(); n.bubble = null; }
        else { n.bubble.el.style.opacity = String(Math.min(1, n.bubble.life / 0.4)); v.placeLabel(n.bubble.el, root.position, seated ? 2.55 : 2.85); }
      }
    });
    if (!ballOn) this.ball.visible = false;
    if (!ropeOn) this.rope.visible = false;
  }

  // 손에 드는 것과 자세
  dress(n, act, p, plans, T) {
    const av = n.av;
    const kind = act === 'fish' ? 'rod' : act === 'eat' ? 'fruit' : act === 'table' ? 'bowl' : '';
    if (n.propKind !== kind) {
      if (n.prop) { av.drop(); n.prop.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); n.prop = null; }
      n.propKind = kind;
      if (kind) {
        n.prop = kind === 'rod' ? rodMesh() : kind === 'fruit' ? fruitMesh() : bowlMesh();
        av.hold(n.prop, 1);
        if (kind !== 'rod') n.prop.position.set(0, -0.5, 0.08);
      }
    }
    const t = p.t || 0;
    if (act === 'sit' && n.seat >= 0) av.pose = (a) => { a.legs[0].rotation.x = a.legs[1].rotation.x = -1.45; a.arms[0].rotation.x = a.arms[1].rotation.x = -0.4; };
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
    else if (act === 'dance') {
      av.pose = (a) => {
        const k = t * 2.2 + n.i * 0.6;
        a.arms[0].rotation.x = -2.4 + Math.sin(k * 2) * 0.4;
        a.arms[1].rotation.x = -2.4 - Math.sin(k * 2) * 0.4;
        a.arms[0].rotation.z = -0.5; a.arms[1].rotation.z = 0.5;
        a.body.rotation.z = Math.sin(k * 2) * 0.12;
      };
      // 2초마다 다 같이 폴짝
      if (Math.floor(t / 2) !== n.lastHop) { n.lastHop = Math.floor(t / 2); av.jump(); }
    } else if (act === 'recite') av.pose = (a) => { a.arms[0].rotation.x = a.arms[1].rotation.x = -0.9; a.arms[0].rotation.z = 0.4; a.arms[1].rotation.z = -0.4; a.head.rotation.x = Math.sin(t * 2.5) * 0.08; };
    else if (act === 'chat') {
      // 말하는 차례면 손짓
      const myTurn = (Math.floor(t / 3.2) % 2) === (p.with && n.d.id < p.with ? 0 : 1);
      av.pose = myTurn ? (a) => { a.arms[1].rotation.x = -1.2 + Math.sin(t * 6) * 0.3; a.arms[1].rotation.z = 0.4; } : null;
    } else if (act === 'toss') av.pose = null;
    else av.pose = null;
    if (!av.pose && act !== 'jump') av.body.rotation.z = 0;
  }

  // 공 주고받기: 1.8초마다 한쪽에서 다른 쪽으로 포물선
  tossBall(n, i, p, plans) {
    const j = VILLAGERS.findIndex((d) => d.id === p.with);
    const other = this.list[j];
    if (j < 0 || this.held(j) || plans[j].act !== 'toss' || plans[j].moving || !other) return false;
    const t = p.t || 0, per = 1.8;
    const k = (t % per) / per, back = Math.floor(t / per) % 2 === 1;
    const A = n.av.root.position, B = other.av.root.position;
    const from = back ? B : A, to = back ? A : B;
    // 손 앞(서로를 향해 0.4m)에서 손 앞으로
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;
    const fx = from.x + (dx / d) * 0.4, fz = from.z + (dz / d) * 0.4, tx = to.x - (dx / d) * 0.4, tz = to.z - (dz / d) * 0.4;
    const b = this.ball;
    b.visible = true;
    b.position.set(fx + (tx - fx) * k, 1.15 + Math.sin(k * Math.PI) * 1.3, fz + (tz - fz) * k);
    const thrower = back ? other : n, catcher = back ? n : other;
    if (k < 0.25) thrower.tossArm = 'throw';
    if (k > 0.65) catcher.tossArm = 'catch';
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

  // 혼잣말과 둘의 이야기 (장면 안에서 정해진 때에만, 같은 말을 두 번 하지 않게)
  chatter(n, i, p) {
    const t = p.t || 0;
    if (p.act === 'chat') {
      const turn = Math.floor(t / 3.2);
      const mine = (turn % 2) === (p.with && n.d.id < p.with ? 0 : 1);
      const k = `${p.round}:${p.si}:c${turn}`;
      if (mine && n.saidKey !== k && t % 3.2 < 0.5) {
        n.saidKey = k;
        const dlg = CHATS[(Math.floor(turn / 2) + p.round * 3) % CHATS.length];
        this.say(i, dlg[turn % 2], 3.0);
      }
      return;
    }
    const lines = SAY[p.act];
    if (!lines) return;
    const every = p.act === 'dance' ? 6 : p.act === 'toss' ? 7 : 13;
    const step = Math.floor((t + n.i * 2.3) / every);
    const k = `${p.round}:${p.si}:${step}`;
    if (n.saidKey !== k && ((t + n.i * 2.3) % every) < 0.5 && t > 1) {
      n.saidKey = k;
      const line = lines[(step + n.i + p.round) % lines.length];
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
