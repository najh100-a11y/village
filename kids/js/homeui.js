// 진숲 어린이 마을 — 내 집 화면: 들어가고 나가기, 집 꾸미기 판, 밭 돌보기
import * as THREE from './three.module.min.js';
import { HOME_O, itemThumb } from './home.js';
import {
  HOME_ITEMS, HOME_IDS, ZONE_NAMES, ROOM, GARDEN, YARD_RECTS, isSeed, footprint, canPlace,
  growStage, growHours, canWater, GROW,
} from './homeitems.js';
import { h, toast, josa } from './ui.js';

const ZONES = ['room', 'yard', 'garden'];
const ZONE_RECTS = { room: [ROOM], garden: [GARDEN], yard: YARD_RECTS };
const STAGE_TEXT = ['씨앗을 심었어요. 곧 싹이 나요.', '싹이 났어요!', '쑥쑥 자라는 중이에요.'];
const newId = () => Math.random().toString(36).slice(2, 10);

export function createHomeUI(o) {
  // o: { village, rpc, getToken, getMe, features, sfx, setActivity, openShop, openMaker, openSheet, modal, message, onSessionLost, setFruits,
  //      onlineFriends, sendHouseInvite }
  const v = o.village;
  let st = null; // { layout, items }
  let guest = null; // 친구 집에 놀러 왔을 때 { id, name }
  const invited = new Map(); // 친구 id → 마지막으로 부른 때 (같은 친구를 너무 자주 부르지 않게)
  let busy = false, editing = false, tab = 'room';
  let mode = null; // { kind: 'place', e, from } | { kind: 'sel', id }
  let saveTimer = null, saving = false, harvest = [], dirty = false;

  // ---------- 화면 조각 ----------
  const bar = h('div', { class: 'home-bar', hidden: true });
  // 내 집: 꾸미기, 친구 부르기, 마을로 / 친구 집: 우리 집으로, 마을로
  function drawBar() {
    const btn = (label, fn, cls = 'btn-soft') => h('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
    if (guest) bar.replaceChildren(btn('🏠 우리 집으로', () => enter()), btn('🏡 마을로', () => exit()));
    else bar.replaceChildren(btn('🛋️ 집 꾸미기', () => startEdit(), 'btn-go'),
      o.features().visit ? btn('👋 친구 부르기', () => openInvite()) : null,
      btn('🏡 마을로', () => exit()));
  }
  const act = h('div', { class: 'he-act', hidden: true });
  const hint = h('p', { class: 'he-hint' });
  const tabs = h('div', { class: 'he-tabs', role: 'tablist' });
  const list = h('div', { class: 'he-list' });
  const panel = h('div', { class: 'home-edit', hidden: true }, act,
    h('div', { class: 'he-panel' },
      h('div', { class: 'he-top' }, tabs,
        h('div', { class: 'he-btns' },
          h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => o.openShop() }, '🍎 열매 상점'),
          h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => stopEdit() }, '다 했어요'))),
      hint, list));
  document.body.append(bar, panel);

  const placed = (k) => (v.homeSpace ? v.homeSpace.layout.filter((e) => e.k === k).length : 0);
  const owned = (k) => (st && st.items && st.items[k]) || 0;

  // ---------- 들어가고 나가기 ----------
  async function enter() {
    if (busy || (v.atHome && !guest)) return;
    if (!o.features().home) { o.openMaker(false); return; }
    if (v.atHome) await exit(true); // 친구 집에서 우리 집으로
    busy = true;
    try {
      st = await o.rpc('kids_home', { p_token: o.getToken() });
      if (Number.isFinite(st.fruits)) o.setFruits(st.fruits);
    } catch (e) {
      busy = false;
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 2800);
      return;
    }
    busy = false;
    const me = o.getMe();
    guest = null;
    v.enterHome(st.layout || [], me ? me.village_name : '', me ? me.id : null, false);
    o.setActivity('home');
    o.sfx.door();
    document.body.classList.add('at-home');
    drawBar();
    bar.hidden = false;
    let first = false;
    try { first = !localStorage.getItem('kv.home.tip'); localStorage.setItem('kv.home.tip', '1'); } catch (e) { /* 그대로 */ }
    toast(first ? "내 집에 왔어요! '집 꾸미기'를 누르면 방과 마당과 밭을 꾸밀 수 있어요. 옷장을 누르면 옷을 갈아입어요." : '내 집에 왔어요!', first ? 5200 : 2000);
  }
  // quiet: 다른 집으로 바로 옮겨 갈 때 (소리와 하는 일 알림을 건너뛴다)
  async function exit(quiet = false) {
    if (!v.atHome) return;
    if (editing) stopEdit();
    if (!guest) await flush();
    guest = null;
    v.exitHome();
    if (!quiet) { o.setActivity(''); o.sfx.door(); }
    document.body.classList.remove('at-home');
    bar.hidden = true;
  }

  // ---------- 친구 집에 놀러 가기 ----------
  async function visit(id) {
    const me = o.getMe();
    if (!me) return;
    if (id === me.id) return enter();
    if (busy || (guest && guest.id === id)) return;
    if (!o.features().visit) { toast('친구 집에 놀러 가기는 곧 열려요!', 2400); return; }
    busy = true;
    let r;
    try { r = await o.rpc('kids_home_visit', { p_token: o.getToken(), p_child: id }); } catch (e) {
      busy = false;
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 2800);
      return;
    }
    busy = false;
    if (v.atHome) await exit(true);
    guest = { id, name: r.name || '친구' };
    v.enterHome(r.layout || [], guest.name, id, true);
    o.setActivity('visit');
    o.sfx.door();
    document.body.classList.add('at-home');
    drawBar();
    bar.hidden = false;
    toast(`${guest.name}네 집에 놀러 왔어요! 가구에 앉아 보고, 마당과 밭도 구경해요.`, 3200);
  }
  // 친구가 집을 새로 꾸몄을 때 다시 불러온다
  async function refreshGuest() {
    if (!guest || !v.atHome) return;
    const id = guest.id;
    try {
      const r = await o.rpc('kids_home_visit', { p_token: o.getToken(), p_child: id });
      if (guest && guest.id === id && v.homeSpace) v.homeSpace.setLayout(r.layout || []);
    } catch (e) { /* 다음에 */ }
  }
  // 우리 집으로 친구 부르기 (지금 마을에 있는 친구)
  function openInvite() {
    if (guest) return;
    const me = o.getMe();
    const list = (o.onlineFriends ? o.onlineFriends() : []).filter((p) => p && p.id !== (me && me.id));
    const here = new Set([...v.remotes.values()].filter((r) => v.inMyHouse(r)).map((r) => r.id));
    const rows = list.map((p) => {
      const inHouse = here.has(p.id);
      const recent = Date.now() - (invited.get(p.id) || 0) < 20000;
      return h('div', { class: 'fl-row' },
        h('div', { class: 'fl-main' }, h('b', {}, p.name, p.teacher ? h('span', { class: 't-badge' }, '선생님') : null), h('span', {}, inHouse ? '우리 집에 와 있어요' : recent ? '방금 불렀어요' : '')),
        h('div', { class: 'fl-acts' }, h('button', {
          class: 'btn btn-go btn-small', type: 'button', disabled: inHouse || recent,
          onclick: () => {
            invited.set(p.id, Date.now());
            o.sendHouseInvite(p.id);
            o.sfx.pop();
            o.modal.close();
            toast(`${p.name}에게 우리 집에 놀러 오라고 했어요!`, 2600);
          },
        }, '👋 부르기')));
    });
    o.openSheet('우리 집에 친구 부르기', h('div', { class: 'talk friends' },
      rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '지금 마을에 있는 친구가 없어요. 친구가 들어오면 부를 수 있어요.'),
      h('p', { class: 'note' }, '부른 친구 화면에 "놀러 가기" 단추가 떠요. 친구는 친구 목록에서 언제든 우리 집에 놀러 올 수도 있어요.')), 'talk-sheet');
  }

  // ---------- 저장 ----------
  function scheduleSave(now = false) {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, now ? 0 : 700);
  }
  async function save() {
    if (saving) { saveTimer = setTimeout(save, 300); return; }
    if (!dirty || !v.homeSpace) return;
    saving = true;
    dirty = false;
    const layout = v.homeSpace.layout.map(({ id, k, x, z, r, t, g, w }) => {
      const e = { id, k, x, z, r: r || 0 };
      if (t) e.t = t;
      if (g) e.g = +g.toFixed(2);
      if (w) e.w = w;
      return e;
    });
    const hv = harvest;
    harvest = [];
    try {
      const r = await o.rpc('kids_home_save', { p_token: o.getToken(), p_layout: layout, p_harvest: hv });
      st.items = r.items || st.items;
      st.layout = layout;
      if (editing) drawList();
      v.sendHouse({ u: 1 }); // 우리 집에 놀러 온 친구 화면도 새로 꾸민 대로
    } catch (e) {
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 3000);
      // 서버에 있는 대로 되돌린다
      try {
        st = await o.rpc('kids_home', { p_token: o.getToken() });
        if (v.homeSpace) v.homeSpace.setLayout(st.layout || []);
        if (editing) drawList();
      } catch (err) { /* 다음에 */ }
    } finally { saving = false; }
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (dirty) await save();
  }

  // ---------- 꾸미기 ----------
  function startEdit() {
    if (!v.atHome || editing || guest) return;
    editing = true;
    // 아래쪽 꾸미기 판에 가리지 않게 집 전체가 화면 위쪽에 오도록 본다
    const look = new THREE.Vector3(HOME_O.x - 0.5, 0, HOME_O.z + 2.6);
    const pos = new THREE.Vector3(HOME_O.x - 0.5, 31, HOME_O.z + 20.5);
    v.enterGame({
      cam: { pos, look },
      camSpeed: 3,
      onTap: (ray) => onEditTap(ray),
      update: () => {},
      stop: () => { if (editing) stopEdit(true); },
    });
    if (innerWidth < innerHeight) v.view.game.zoom = 1.45; // 세로 화면은 조금 멀리서
    document.body.classList.add('home-editing');
    bar.hidden = true;
    panel.hidden = false;
    mode = null;
    drawTabs();
    drawList();
    drawAct();
  }
  function stopEdit(fromGame = false) {
    if (!editing) return;
    editing = false;
    cancelMode();
    if (!fromGame) v.exitGame();
    document.body.classList.remove('home-editing');
    panel.hidden = true;
    bar.hidden = !v.atHome;
    flush();
  }
  function drawTabs() {
    tabs.replaceChildren(...ZONES.map((z) => h('button', {
      class: 'he-tab', role: 'tab', type: 'button', 'aria-selected': String(tab === z),
      onclick: () => { tab = z; cancelMode(); drawTabs(); drawList(); drawAct(); },
    }, { room: '🛏️ 방', yard: '🌳 마당', garden: '🥕 밭' }[z])));
  }
  function drawList() {
    const ids = HOME_IDS.filter((id) => HOME_ITEMS[id].zone === tab && owned(id) > 0);
    const cards = ids.map((id) => {
      const it = HOME_ITEMS[id];
      const left = owned(id) - placed(id);
      const img = itemThumb(id);
      return h('button', {
        class: 'he-item' + (left > 0 ? '' : ' none') + (mode && mode.kind === 'place' && !mode.from && mode.e.k === id ? ' on' : ''),
        type: 'button',
        onclick: () => pick(id),
      }, img ? h('img', { src: img, alt: '' }) : h('span', { class: 'he-noimg' }, '?'),
      h('b', {}, it.name), h('small', {}, left > 0 ? `${left}개 남음` : '모두 놓았어요'));
    });
    cards.push(h('button', { class: 'he-item shop', type: 'button', onclick: () => o.openShop(tab) }, h('span', { class: 'he-plus' }, '+'), h('b', {}, '더 사기'), h('small', {}, '열매 상점')));
    list.replaceChildren(...cards);
    if (!ids.length) hint.textContent = tab === 'garden' ? '아직 씨앗이 없어요. 열매 상점에서 씨앗을 사면 밭에 심을 수 있어요.' : `아직 ${ZONE_NAMES[tab]}에 놓을 물건이 없어요. 열매 상점에서 사 올 수 있어요.`;
    else if (!mode) hint.textContent = tab === 'garden' ? '씨앗을 고르고 밭의 빈칸을 눌러 심어요. 심은 것을 누르면 옮기거나 뽑을 수 있어요.' : '물건을 고르고 놓을 곳을 눌러요. 놓은 물건을 누르면 옮기거나 돌릴 수 있어요.';
  }
  function drawAct() {
    if (!mode) { act.hidden = true; return; }
    act.hidden = false;
    const btn = (label, fn, cls = 'btn-soft', dis = false) => h('button', { class: `btn ${cls} btn-small`, type: 'button', disabled: dis, onclick: fn }, label);
    if (mode.kind === 'place') {
      const ok = canPlace(v.homeSpace.layout, mode.e, mode.from ? mode.from.id : null);
      const seed = isSeed(mode.e.k);
      act.replaceChildren(
        h('span', { class: 'he-what' }, HOME_ITEMS[mode.e.k].name),
        seed ? null : btn('↻ 돌리기', () => rotateGhost()),
        btn(seed ? '✓ 여기에 심기' : '✓ 여기에 놓기', () => confirmPlace(), 'btn-go', !ok),
        btn('그만', () => { cancelMode(); drawList(); drawAct(); }, 'btn-plain'));
      hint.textContent = ok ? '좋아요! 다른 곳에 두려면 그곳을 눌러요.' : `빨간색은 놓을 수 없는 자리예요. ${ZONE_NAMES[HOME_ITEMS[mode.e.k].zone]}의 빈 곳을 눌러 봐요.`;
    } else if (mode.kind === 'sel') {
      const e = v.homeSpace.entry(mode.id);
      if (!e) { mode = null; act.hidden = true; return; }
      const seed = isSeed(e.k);
      act.replaceChildren(
        h('span', { class: 'he-what' }, seed ? HOME_ITEMS[e.k].grown : HOME_ITEMS[e.k].name),
        btn('옮기기', () => startMove(e)),
        seed ? null : btn('↻ 돌리기', () => rotateSel(e)),
        btn(seed ? '뽑기' : '가방에 넣기', () => putBack(e)),
        btn('닫기', () => { cancelMode(); drawAct(); }, 'btn-plain'));
      hint.textContent = seed ? '뽑으면 씨앗이 다시 가방으로 돌아가요. 자라던 것은 처음부터 다시 자라요.' : '옮기거나 돌리거나, 가방에 다시 넣을 수 있어요.';
    }
  }
  function cancelMode() {
    const H = v.homeSpace;
    if (!H) { mode = null; return; }
    if (mode && mode.kind === 'place' && mode.from) {
      const it = H.items.get(mode.from.id);
      if (it && it.obj) it.obj.visible = true;
    }
    H.clearGhost();
    H.clearSel();
    mode = null;
  }
  // 이 물건을 놓을 첫 빈자리 (구역 가운데에서 가까운 곳부터)
  function firstFree(k, r = 0) {
    const it = HOME_ITEMS[k];
    const f = footprint(k, r);
    const rects = ZONE_RECTS[it.zone];
    let best = null, bd = Infinity;
    for (const R of rects) {
      const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      for (let x = R.x0; x <= R.x1 - f.w; x++) for (let z = R.z0; z <= R.z1 - f.d; z++) {
        const e = { id: '_', k, x, z, r };
        if (!canPlace(v.homeSpace.layout, e)) continue;
        const d = Math.hypot(x + f.w / 2 - cx, z + f.d / 2 - cz);
        if (d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }
  function pick(k) {
    if (owned(k) - placed(k) <= 0) { toast('가진 것을 모두 놓았어요. 놓은 것을 옮기거나, 열매 상점에서 더 살 수 있어요.', 3000); return; }
    cancelMode();
    const spot = firstFree(k);
    if (!spot) { toast(`${ZONE_NAMES[HOME_ITEMS[k].zone]}에 빈자리가 없어요. 다른 물건을 옮기거나 가방에 넣어 봐요.`, 3200); return; }
    mode = { kind: 'place', e: { ...spot, id: newId() }, from: null };
    o.sfx.pop();
    showGhost();
    drawList();
  }
  function startMove(e) {
    cancelMode();
    const it = v.homeSpace.items.get(e.id);
    if (it && it.obj) it.obj.visible = false;
    mode = { kind: 'place', e: { ...e }, from: e };
    showGhost();
  }
  function showGhost() {
    const ok = canPlace(v.homeSpace.layout, mode.e, mode.from ? mode.from.id : null);
    v.homeSpace.showGhost(mode.e, ok);
    drawAct();
  }
  function rotateGhost() {
    const e = mode.e;
    e.r = ((e.r || 0) + 1) % 4;
    o.sfx.tick();
    showGhost();
  }
  function confirmPlace() {
    const H = v.homeSpace;
    const e = mode.e;
    if (!canPlace(H.layout, e, mode.from ? mode.from.id : null)) return;
    if (mode.from) {
      H.put({ ...mode.from, x: e.x, z: e.z, r: e.r || 0 });
      const it = H.items.get(mode.from.id);
      if (it && it.obj) it.obj.visible = true;
    } else {
      const n = { id: e.id, k: e.k, x: e.x, z: e.z, r: e.r || 0 };
      if (isSeed(e.k)) n.t = Date.now();
      H.put(n);
    }
    o.sfx.pop();
    H.clearGhost();
    const k = e.k, seed = isSeed(k);
    mode = null;
    scheduleSave();
    drawList();
    drawAct();
    if (seed) hint.textContent = '심었어요! 싹이 나고 자라는 데 시간이 걸려요. 마당에서 밭을 누르면 물을 줄 수 있어요.';
  }
  function rotateSel(e) {
    const H = v.homeSpace;
    const n = { ...e, r: ((e.r || 0) + 1) % 4 };
    if (!canPlace(H.layout, n, e.id)) { toast('여기서는 돌릴 자리가 없어요. 조금 옮긴 다음 돌려 봐요.', 2600); return; }
    H.put(n);
    o.sfx.tick();
    H.showSel(e.id);
    scheduleSave();
  }
  function putBack(e) {
    const H = v.homeSpace;
    cancelMode();
    H.take(e.id);
    o.sfx.close();
    scheduleSave();
    drawList();
    drawAct();
  }
  function onEditTap(ray) {
    const H = v.homeSpace;
    if (!H) return;
    if (mode && mode.kind === 'place') {
      const c = H.cellAt(ray);
      if (!c) return;
      const f = footprint(mode.e.k, mode.e.r || 0);
      mode.e.x = Math.floor(c.x - f.w / 2 + 0.5);
      mode.e.z = Math.floor(c.z - f.d / 2 + 0.5);
      showGhost();
      return;
    }
    const p = H.pickAt(ray);
    if (p && (p.type === 'homeitem' || p.type === 'plant')) {
      const e = H.entry(p.id);
      if (!e) return;
      cancelMode();
      tab = HOME_ITEMS[e.k].zone;
      drawTabs();
      drawList();
      mode = { kind: 'sel', id: p.id };
      H.showSel(p.id);
      o.sfx.tap();
      drawAct();
      return;
    }
    if (mode) { cancelMode(); drawAct(); drawList(); }
  }

  // ---------- 밭 돌보기 (꾸미기 아닐 때 식물을 누르면) ----------
  function onPlant(id) {
    const H = v.homeSpace;
    const e = H && H.entry(id);
    if (!e) return;
    const it = HOME_ITEMS[e.k];
    const stage = growStage(e);
    const veg = it.kind === 'veg';
    const left = Math.max(0, GROW.full - growHours(e));
    const lines = [];
    if (guest) {
      // 친구 밭: 구경만 한다
      lines.push(stage < 3 ? STAGE_TEXT[stage] : veg ? `${josa(it.grown, '이', '가')} 다 자랐어요!` : `${josa(it.grown, '이', '가')} 활짝 피었어요!`);
      o.openSheet(`${guest.name}네 밭`, h('div', { class: 'talk' },
        h('p', { class: 'result-big' }, it.grown),
        ...lines.map((l) => h('p', {}, l)),
        h('p', { class: 'note' }, '친구 밭이에요. 물 주기와 거두기는 밭 주인만 할 수 있어요.'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => o.modal.close() }, '알겠어요'))), 'talk-sheet');
      return;
    }
    if (stage < 3) {
      lines.push(STAGE_TEXT[stage]);
      lines.push(left < 1 ? '이제 곧 다 자라요!' : `다 자라려면 ${Math.ceil(left)}시간쯤 더 있어야 해요.`);
    } else lines.push(veg ? `${josa(it.grown, '이', '가')} 다 자랐어요! 거둘 수 있어요.` : `${josa(it.grown, '이', '가')} 활짝 피었어요!`);
    const water = stage < 3 && canWater(e);
    const body = h('div', { class: 'talk' },
      h('p', { class: 'result-big' }, it.grown),
      ...lines.map((l) => h('p', {}, l)),
      stage < 3 && !water ? h('p', { class: 'note' }, '물은 한 시간에 한 번 줄 수 있어요. 물을 주면 2시간만큼 빨리 자라요.') : null,
      stage < 3 && water ? h('p', { class: 'note' }, '물을 주면 2시간만큼 빨리 자라요.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => o.modal.close() }, '닫기'),
        water ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { o.modal.close(); waterPlant(e); } }, '💧 물 주기') : null,
        stage === 3 && veg ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { o.modal.close(); harvestPlant(e); } }, '🧺 거두기') : null));
    o.openSheet('우리 밭', body, 'talk-sheet');
  }
  function waterPlant(e) {
    const H = v.homeSpace;
    if (!canWater(e)) return;
    H.put({ ...e, g: (e.g || 0) + GROW.water, w: Date.now() });
    o.sfx.splash();
    v.say('me', '💧');
    toast(`${HOME_ITEMS[e.k].grown}에 물을 주었어요. 쑥쑥 자라라!`, 2400);
    scheduleSave(true);
  }
  function harvestPlant(e) {
    const H = v.homeSpace;
    if (growStage(e) < 3) return;
    H.take(e.id);
    harvest.push(e.id);
    o.sfx.munch();
    v.celebrate();
    v.say('me', '냠냠!');
    toast(`${josa(HOME_ITEMS[e.k].grown, '을', '를')} 거뒀어요! 냠냠, 정말 맛있어요. 씨앗을 또 심어 봐요.`, 3200);
    scheduleSave(true);
  }
  // 꾸미기 아닐 때 물건을 누르면 (작은 재미)
  function onHomeItem(id) {
    const e = v.homeSpace && v.homeSpace.entry(id);
    if (!e) return;
    if (e.k === 'h_piano') { o.sfx.success(); v.say('me', '🎵'); }
    else if (e.k === 'y_fountain') { o.sfx.splash(); v.say('me', '시원해!'); }
    else if (e.k === 'y_swing' || e.k === 'y_slide') { o.sfx.jump(); v.jump(); v.say('me', '야호!'); }
    else if (e.k === 'h_bed') v.say('me', '포근해~');
    else if (e.k === 'y_birdhouse') o.sfx.tweet();
    else if (e.k === 'y_mailbox') {
      v.say('me', '편지 왔나?');
      if (!guest && o.openMail) setTimeout(() => o.openMail(), 600); // 우리 집 우체통은 쪽지함
    }
  }

  // 상점에서 산 뒤 (가진 수가 바뀌었다)
  function onShopChanged(items) {
    if (!st) return;
    const next = {};
    for (const id of HOME_IDS) if (items && items[id] > 0) next[id] = items[id];
    st.items = next;
    if (editing) drawList();
  }

  // 로그인 화면으로 돌아갈 때: 저장하지 않고 바로 마을로 돌려 둔다
  function reset() {
    clearTimeout(saveTimer);
    dirty = false;
    harvest = [];
    if (editing) { editing = false; cancelMode(); if (v.mode === 'game') v.exitGame(); }
    if (v.atHome) v.exitHome();
    document.body.classList.remove('at-home', 'home-editing');
    panel.hidden = true;
    bar.hidden = true;
    st = null;
    guest = null;
  }

  return {
    enter, exit, reset, onPlant, onHomeItem, onShopChanged, startEdit, stopEdit, visit, refreshGuest, openInvite,
    get editing() { return editing; },
    get guest() { return guest; },
    onDoor(id) {
      if (id === 'home-exit') { exit(); return true; }
      if (id === 'home-closet') {
        if (guest) { toast(`${guest.name}네 옷장이에요. 옷은 우리 집 옷장에서 갈아입어요.`, 2600); return true; }
        o.openMaker(false);
        return true;
      }
      return false;
    },
  };
}
