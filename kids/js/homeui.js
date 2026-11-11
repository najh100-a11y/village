// 진숲 어린이 마을 — 내 집 화면: 들어가고 나가기, 집 꾸미기 판, 밭 돌보기
import * as THREE from './three.module.min.js';
import { HOME_O, itemThumb } from './home.js';
import {
  HOME_ITEMS, HOME_IDS, ZONE_NAMES, GARDEN, YARD_RECTS, isSeed, footprint, canPlace,
  growStage, growHours, canWater, GROW, CROPS, HARVEST, needHours, leftText, setServerNow, serverNow,
  SPACES, BUILD_IDS, SLOT_W, ROOM, spaces, spaceById, isIndoor, YARD_PARTS, WALLS, FLOORS, styleOf, fitsZone, cellZone, cleanRooms,
} from './homeitems.js';
import { h, toast, josa, confetti } from './ui.js';
import { openPiano } from './piano.js';
import { pianoKey, setScene, sceneNow } from './sound.js';

// 꾸미기 판의 칸: 지은 방들(내 방, 거실, 주방, 방 2, 방 3), 앞마당, 옆마당, 밭
const OUT_TABS = { yard: '🌳 앞마당', yard2: '🌲 옆마당', garden: '🥕 밭' };
const tabName = (t) => (SPACES[t] ? SPACES[t].name : { yard: '앞마당', yard2: '옆마당', garden: '밭' }[t] || '');
const clip = (r, part) => ({ x0: Math.max(r.x0, part.x0), x1: Math.min(r.x1, part.x1), z0: r.z0, z1: r.z1 });
// 그 칸에서 물건을 찾아 놓을 땅
function tabRects(t) {
  if (t === 'garden') return [GARDEN];
  if (YARD_PARTS[t]) return YARD_RECTS.map((r) => clip(r, YARD_PARTS[t])).filter((r) => r.x1 > r.x0);
  const s = spaceById(t);
  return s ? [s] : [];
}
// 놓인 물건이 있는 칸 (꾸미기 중 물건을 누르면 그 칸으로)
function tabOfEntry(e) {
  const z = cellZone(e.x, e.z);
  if (isIndoor(z) || z === 'garden') return z;
  return e.x < YARD_PARTS.yard.x0 ? 'yard2' : 'yard';
}
// 물건이 그 칸에 놓이는 것인지
function itemInTab(id, t) {
  const it = HOME_ITEMS[id];
  if (isIndoor(t)) return it.zone === 'room' || (it.zone === 'kitchen' && t === 'kitchen');
  if (YARD_PARTS[t]) return it.zone === 'yard';
  return it.zone === t;
}
// 방마다 먼저 보이는 물건 묶음
const TAB_GRP = { room: 'bed', living: 'living', kitchen: 'kitchen', room2: 'bed', room3: 'bed' };
const STAGE_TEXT = ['씨앗을 심었어요. 곧 싹이 나요.', '싹이 났어요!', '쑥쑥 자라는 중이에요.'];
const AGAIN_TEXT = '열매를 땄어요. 다시 열매가 맺히는 중이에요.';
const newId = () => Math.random().toString(36).slice(2, 10);
// 서버가 적은 자람 기록 (없는 칸은 지운다)
const growOf = (pl) => ({ t: pl && pl.t, g: (pl && pl.g) || undefined, w: (pl && pl.w) || undefined, n: (pl && pl.n) || undefined });

export function createHomeUI(o) {
  // o: { village, rpc, getToken, getMe, features, sfx, setActivity, openShop, openMaker, openSheet, modal, message, onSessionLost, setFruits,
  //      onlineFriends, sendHouseInvite, sendPiano }
  const v = o.village;
  let st = null; // { layout, items }
  let guest = null; // 친구 집에 놀러 왔을 때 { id, name }
  const invited = new Map(); // 친구 id → 마지막으로 부른 때 (같은 친구를 너무 자주 부르지 않게)
  let busy = false, editing = false, tab = 'room', editCtrl = null, building = false;
  let mode = null; // { kind: 'place', e, from } | { kind: 'sel', id }
  let saveTimer = null, saving = false, dirty = false, farmBusy = false;

  // ---------- 화면 조각 ----------
  const bar = h('div', { class: 'home-bar', hidden: true });
  // 내 집: 꾸미기, 친구 부르기, 마을로 / 친구 집: 우리 집으로, 마을로
  function drawBar() {
    const btn = (label, fn, cls = 'btn-soft') => h('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
    if (guest) bar.replaceChildren(btn('🏠 우리 집으로', () => enter()), btn('🏡 마을로', () => exit()));
    else bar.replaceChildren(btn('🛋️ 집 꾸미기', () => startEdit(), 'btn-go'),
      o.features().farm && o.openBasket ? btn('🧺 바구니', () => o.openBasket()) : null,
      o.features().visit ? btn('👋 친구 부르기', () => openInvite()) : null,
      btn('🏡 마을로', () => exit()));
  }
  const act = h('div', { class: 'he-act', hidden: true });
  const hint = h('p', { class: 'he-hint' });
  const tabs = h('div', { class: 'he-tabs', role: 'tablist' });
  const list = h('div', { class: 'he-list' });
  const extra = h('div', { class: 'he-extra', hidden: true });
  const panel = h('div', { class: 'home-edit', hidden: true }, act,
    h('div', { class: 'he-panel' },
      h('div', { class: 'he-top' }, tabs,
        h('div', { class: 'he-btns' },
          h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => o.openShop() }, '🍎 열매 상점'),
          h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => stopEdit() }, '다 했어요'))),
      hint, list, extra));
  document.body.append(bar, panel);

  const placed = (k) => (v.homeSpace ? v.homeSpace.layout.filter((e) => e.k === k).length : 0);
  const owned = (k) => (st && st.items && st.items[k]) || 0;
  const expandOn = () => !!o.features().expand;
  // 서버가 준 집 모양 (집 넓히기가 아직 서버에 없으면 공사 터를 보이지 않는다)
  const plan = (r) => ({ rooms: cleanRooms(r && r.rooms), style: (r && r.style) || {}, lot: expandOn() });
  // 집 모양이 바뀌어 제자리에 맞지 않게 된 물건(새로 난 문 자리 등)은 가방으로 돌려 놓는다
  function tidyLayout() {
    const H = v.homeSpace;
    if (!H || guest) return [];
    const off = H.layout.filter((e) => !fitsZone(e));
    if (!off.length) return [];
    for (const e of off) H.take(e.id);
    scheduleSave(true);
    return off;
  }

  // ---------- 들어가고 나가기 ----------
  async function enter() {
    if (busy || (v.atHome && !guest)) return;
    if (!o.features().home) { o.openMaker(false); return; }
    if (v.atHome) await exit(true); // 친구 집에서 우리 집으로
    busy = true;
    try {
      st = await o.rpc('kids_home', { p_token: o.getToken() });
      if (Number.isFinite(st.fruits)) o.setFruits(st.fruits);
      setServerNow(st.now);
      if (o.onCrops) o.onCrops(st.crops);
    } catch (e) {
      busy = false;
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 2800);
      return;
    }
    busy = false;
    const me = o.getMe();
    guest = null;
    st.rooms = cleanRooms(st.rooms);
    v.enterHome(st.layout || [], me ? me.village_name : '', me ? me.id : null, false, plan(st));
    tidyLayout();
    o.setActivity('home');
    o.sfx.door();
    document.body.classList.add('at-home');
    drawBar();
    bar.hidden = false;
    let first = false;
    try { first = !localStorage.getItem('kv.home.tip'); localStorage.setItem('kv.home.tip', '1'); } catch (e) { /* 그대로 */ }
    let buildTip = false;
    if (!first && o.features().expand && st.rooms.length < BUILD_IDS.length) {
      try { buildTip = !localStorage.getItem('kv.home.build.tip'); localStorage.setItem('kv.home.build.tip', '1'); } catch (e) { /* 그대로 */ }
    }
    toast(first ? "내 집에 왔어요! '집 꾸미기'를 누르면 방과 마당과 밭을 꾸밀 수 있어요. 옷장을 누르면 옷을 갈아입어요."
      : buildTip ? "집을 넓힐 수 있어요! 내 방 왼쪽 '집 넓히기 공사 터' 팻말을 누르면 거실, 주방, 방을 지을 수 있어요." : '내 집에 왔어요!', first || buildTip ? 5600 : 2000);
  }
  // quiet: 다른 집으로 바로 옮겨 갈 때 (소리와 하는 일 알림을 건너뛴다)
  async function exit(quiet = false) {
    if (!v.atHome) return;
    if (piano) piano.close();
    if (swingUi) swingUi.stop();
    if (editing) stopEdit();
    if (!guest) await flush();
    clearTimeout(styleTimer);
    building = false;
    document.body.classList.remove('home-building');
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
    try { r = await o.rpc('kids_home_visit', { p_token: o.getToken(), p_child: id }); setServerNow(r.now); } catch (e) {
      busy = false;
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 2800);
      return;
    }
    busy = false;
    if (v.atHome) await exit(true);
    guest = { id, name: r.name || '친구' };
    v.enterHome(r.layout || [], guest.name, id, true, plan(r));
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
      if (guest && guest.id === id && v.homeSpace) {
        const H = v.homeSpace;
        if (JSON.stringify(cleanRooms(r.rooms)) !== JSON.stringify(H.rooms) || JSON.stringify(r.style || {}) !== JSON.stringify(H.style)) H.setPlan(cleanRooms(r.rooms), r.style || {});
        H.setLayout(r.layout || []);
      }
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
    const layout = v.homeSpace.layout.map(({ id, k, x, z, r }) => ({ id, k, x, z, r: r || 0 }));
    try {
      const r = await o.rpc('kids_home_save', { p_token: o.getToken(), p_layout: layout });
      st.items = r.items || st.items;
      st.layout = layout;
      setServerNow(r.now);
      // 식물이 언제 심겼는지는 서버가 적은 대로 맞춘다
      if (r.plants && v.homeSpace) {
        for (const [id, pl] of Object.entries(r.plants)) {
          const e = v.homeSpace.entry(id);
          if (e && (e.t !== pl.t || (e.g || 0) !== (pl.g || 0) || (e.n || 0) !== (pl.n || 0) || (e.w || 0) !== (pl.w || 0))) v.homeSpace.put({ id, k: e.k, x: e.x, z: e.z, r: e.r || 0, ...growOf(pl) });
        }
      }
      if (editing) drawList();
      v.sendHouse({ u: 1 }); // 우리 집에 놀러 온 친구 화면도 새로 꾸민 대로
    } catch (e) {
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 3000);
      // 서버에 있는 대로 되돌린다
      try {
        st = await o.rpc('kids_home', { p_token: o.getToken() });
        setServerNow(st.now);
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
  // 칸마다 카메라: 방과 밭은 가까이, 마당은 넓게 (아래쪽 꾸미기 판에 가리지 않게 보는 곳을 조금 앞으로)
  function tabCam(t) {
    let x, z, far;
    if (YARD_PARTS[t]) { x = (YARD_PARTS[t].x0 + YARD_PARTS[t].x1) / 2; z = 2.6; far = 1; }
    else if (t === 'garden') { x = (GARDEN.x0 + GARDEN.x1) / 2; z = -6.2; far = 0.5; }
    else { const sp = spaceById(t) || spaceById('room'); x = (sp.x0 + sp.x1) / 2; z = -5.4; far = 0.5; }
    return { look: new THREE.Vector3(HOME_O.x + x, 0, HOME_O.z + z), pos: new THREE.Vector3(HOME_O.x + x, 31 * far, HOME_O.z + z + 17.9 * far) };
  }
  function setTab(t) {
    tab = t;
    if (editCtrl) Object.assign(editCtrl.cam, tabCam(t));
  }
  function startEdit(first = null) {
    if (!v.atHome || editing || guest) return;
    if (piano) piano.close();
    if (v.sitting && v.sitting.swing) v.standUp();
    editing = true;
    if (first) tab = first;
    if (!tabList().includes(tab)) tab = 'room';
    editCtrl = {
      cam: tabCam(tab),
      camSpeed: 3,
      onTap: (ray) => onEditTap(ray),
      update: () => {},
      stop: () => { if (editing) stopEdit(true); },
    };
    v.enterGame(editCtrl);
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
    editCtrl = null;
    cancelMode();
    if (!fromGame) v.exitGame();
    document.body.classList.remove('home-editing');
    panel.hidden = true;
    bar.hidden = !v.atHome;
    flush();
  }
  // 칸 목록: 지은 방(내 방부터 지은 차례), 앞마당, 옆마당(집 넓히기가 있을 때), 밭
  function tabList() {
    const H = v.homeSpace;
    return ['room', ...(H ? H.rooms : []), 'yard', ...(expandOn() ? ['yard2'] : []), 'garden'];
  }
  function tabLabel(t) {
    if (SPACES[t]) return !v.homeSpace || !v.homeSpace.rooms.length ? '🛏️ 방' : `${SPACES[t].icon} ${SPACES[t].name}`;
    return expandOn() ? OUT_TABS[t] : { yard: '🌳 마당', garden: '🥕 밭' }[t];
  }
  function drawTabs() {
    tabs.replaceChildren(...tabList().map((z) => h('button', {
      class: 'he-tab', role: 'tab', type: 'button', 'aria-selected': String(tab === z),
      onclick: () => { setTab(z); cancelMode(); drawTabs(); drawList(); drawAct(); },
    }, tabLabel(z))));
    const on = tabs.querySelector('[aria-selected="true"]');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function drawList() {
    const pref = TAB_GRP[tab];
    const ids = HOME_IDS.filter((id) => itemInTab(id, tab) && owned(id) > 0)
      .sort((a, b) => (HOME_ITEMS[a].grp === pref ? 0 : 1) - (HOME_ITEMS[b].grp === pref ? 0 : 1));
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
    const shopTab = isIndoor(tab) ? 'room' : YARD_PARTS[tab] ? 'yard' : tab;
    cards.push(h('button', { class: 'he-item shop', type: 'button', onclick: () => o.openShop(shopTab, TAB_GRP[tab]) }, h('span', { class: 'he-plus' }, '+'), h('b', {}, '더 사기'), h('small', {}, '열매 상점')));
    list.replaceChildren(...cards);
    // 주방이 없는데 주방 물건을 가지고 있으면 알려 준다
    const waitKitchen = isIndoor(tab) && !spaceById('kitchen') ? HOME_IDS.filter((id) => HOME_ITEMS[id].zone === 'kitchen' && owned(id) > 0).length : 0;
    const kitchenNote = waitKitchen ? ` 주방 물건 ${waitKitchen}가지는 주방을 지으면 놓을 수 있어요.` : '';
    if (!ids.length) hint.textContent = tab === 'garden' ? '아직 씨앗이 없어요. 열매 상점에서 씨앗을 사면 밭에 심을 수 있어요.' : `아직 ${tabName(tab)}에 놓을 물건이 없어요. 열매 상점에서 사 올 수 있어요.${kitchenNote}`;
    else if (!mode) hint.textContent = tab === 'garden' ? '씨앗을 고르고 밭의 빈칸을 눌러 심어요. 심은 것을 누르면 옮기거나 뽑을 수 있어요.' : `물건을 고르고 놓을 곳을 눌러요. 놓은 물건을 누르면 옮기거나 돌릴 수 있어요.${kitchenNote}`;
    drawExtra();
  }
  // 꾸미기 판 아래 단추: 벽지·바닥 바꾸기(방 칸), 집 넓히기(아직 지을 방이 있으면)
  function drawExtra() {
    const H = v.homeSpace;
    const can = expandOn() && H && H.rooms.length < BUILD_IDS.length;
    extra.replaceChildren(...[
      expandOn() && isIndoor(tab) ? h('button', { class: 'he-chip', type: 'button', onclick: () => openStyle(tab) }, `🎨 ${tabName(tab)} 벽지·바닥`) : null,
      can ? h('button', { class: 'he-chip', type: 'button', onclick: () => openBuild(true) }, '🏗️ 집 넓히기') : null].filter(Boolean));
    extra.hidden = !extra.children.length;
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
      const z = HOME_ITEMS[mode.e.k].zone;
      hint.textContent = ok ? '좋아요! 다른 곳에 두려면 그곳을 눌러요.' : `빨간색은 놓을 수 없는 자리예요. ${z === 'room' ? '집 안 방' : ZONE_NAMES[z]}의 빈 곳을 눌러 봐요.`;
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
    const rects = itemInTab(k, tab) ? tabRects(tab) : it.zone === 'kitchen' ? tabRects('kitchen') : [];
    let best = null, bd = Infinity;
    for (const R of rects) {
      // 주방은 조리대 앞을 비워 두도록 조리대 뒤 벽 앞 줄부터 채운다
      const kit = R.id === 'kitchen';
      const cx = kit ? R.x0 + 3 : (R.x0 + R.x1) / 2, cz = kit ? R.z0 + 0.5 : (R.z0 + R.z1) / 2;
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
    if (HOME_ITEMS[k].zone === 'kitchen' && !spaceById('kitchen')) { toast("주방 물건은 주방에만 놓아요. '집 넓히기'에서 주방을 지으면 놓을 수 있어요.", 3400); return; }
    const spot = firstFree(k) || (footprint(k, 0).w !== footprint(k, 0).d ? firstFree(k, 1) : null); // 안 들어가면 돌려서
    if (!spot) { toast(`${HOME_ITEMS[k].zone === 'kitchen' ? '주방' : tabName(tab)}에 빈자리가 없어요. 다른 물건을 옮기거나 가방에 넣어 봐요.`, 3200); return; }
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
    if (!mode || mode.kind !== 'place') return;
    const e = mode.e;
    e.r = ((e.r || 0) + 1) % 4;
    o.sfx.tick();
    showGhost();
  }
  function confirmPlace() {
    const H = v.homeSpace;
    if (!H || !mode || mode.kind !== 'place') return;
    const e = mode.e;
    if (!canPlace(H.layout, e, mode.from ? mode.from.id : null)) return;
    if (mode.from) {
      H.put({ ...mode.from, x: e.x, z: e.z, r: e.r || 0 });
      const it = H.items.get(mode.from.id);
      if (it && it.obj) it.obj.visible = true;
    } else {
      const n = { id: e.id, k: e.k, x: e.x, z: e.z, r: e.r || 0 };
      if (isSeed(e.k)) n.t = serverNow();
      H.put(n);
    }
    o.sfx.pop();
    H.clearGhost();
    const k = e.k, seed = isSeed(k);
    mode = null;
    scheduleSave();
    drawList();
    drawAct();
    if (seed) hint.textContent = CROPS[k] ? `심었어요! ${josa(HOME_ITEMS[k].grown, '은', '는')} ${leftText(CROPS[k].need)}쯤 지나면 ${CROPS[k].crop ? '거둘 수 있어요' : '꽃이 펴요'}. 꾸미기를 마치고 밭을 누르면 물을 줄 수 있어요.` : '심었어요!';
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
      setTab(tabOfEntry(e));
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
  // 식물마다 며칠씩 걸려 자란다. 다 자란 채소와 열매는 수확 바구니에 모아서 마을 나눔 수레에 나누거나 열매 상점에서 판다
  function plantLines(e) {
    const it = HOME_ITEMS[e.k], c = CROPS[e.k] || {};
    const stage = growStage(e);
    const veg = !!c.crop;
    const left = Math.max(0, needHours(e) - growHours(e));
    const lines = [];
    if (stage < 3) {
      lines.push((e.n || 0) > 0 ? AGAIN_TEXT : STAGE_TEXT[stage]);
      lines.push(left < 1 ? '이제 곧 다 자라요!' : `${veg ? '거두려면' : '꽃이 피려면'} ${leftText(left)}쯤 더 기다려요.`);
    } else lines.push(veg ? `${josa(it.grown, '이', '가')} 다 자랐어요! 거둘 수 있어요.` : `${josa(it.grown, '이', '가')} 활짝 피었어요!`);
    if (veg && c.picks > 1) lines.push(`${josa(it.grown, '은', '는')} 한 포기에서 ${c.picks}번까지 딸 수 있어요. 지금까지 ${Math.min(c.picks, e.n || 0)}번 땄어요.`);
    return { stage, veg, lines, c };
  }
  function onPlant(id) {
    const H = v.homeSpace;
    const e = H && H.entry(id);
    if (!e) return;
    const it = HOME_ITEMS[e.k];
    const { stage, veg, lines, c } = plantLines(e);
    if (guest) {
      // 친구 밭: 구경만 한다
      o.openSheet(`${guest.name}네 밭`, h('div', { class: 'talk' },
        h('p', { class: 'result-big' }, it.grown),
        ...lines.map((l) => h('p', {}, l)),
        h('p', { class: 'note' }, '친구 밭이에요. 물 주기와 거두기는 밭 주인만 할 수 있어요.'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => o.modal.close() }, '알겠어요'))), 'talk-sheet');
      return;
    }
    const water = stage < 3 && canWater(e);
    const waited = e.w ? Math.max(0, GROW.waterEvery - (serverNow() - e.w) / 3600000) : 0;
    const body = h('div', { class: 'talk' },
      h('p', { class: 'result-big' }, it.grown),
      ...lines.map((l) => h('p', {}, l)),
      stage < 3 && !water ? h('p', { class: 'note' }, `물을 주었어요. ${leftText(waited)} 뒤에 또 줄 수 있어요. 물을 주면 ${GROW.water}시간만큼 빨리 자라요.`) : null,
      stage < 3 && water ? h('p', { class: 'note' }, `물을 주면 ${GROW.water}시간만큼 빨리 자라요. 물은 ${GROW.waterEvery}시간에 한 번 줄 수 있어요.`) : null,
      stage === 3 && veg ? h('p', { class: 'note' }, `거두면 ${it.grown} ${c.yield}${HARVEST[c.crop].unit}가 수확 바구니에 담겨요. 친구들과 나눠 먹거나 열매 상점에서 팔 수 있어요.`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => o.modal.close() }, '닫기'),
        water ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { o.modal.close(); waterPlant(e); } }, '💧 물 주기') : null,
        stage === 3 && veg ? h('button', { class: 'btn btn-go', type: 'button', onclick: () => { o.modal.close(); harvestPlant(e); } }, '🧺 거두기') : null));
    o.openSheet('우리 밭', body, 'talk-sheet');
  }
  async function waterPlant(e) {
    const H = v.homeSpace;
    if (!canWater(e) || farmBusy) return;
    farmBusy = true;
    try {
      await flush();
      const r = await o.rpc('kids_garden_water', { p_token: o.getToken(), p_id: e.id });
      setServerNow(r.now);
      const cur = H && H.entry(e.id);
      if (cur) H.put({ id: cur.id, k: cur.k, x: cur.x, z: cur.z, r: cur.r || 0, ...growOf(r.plant) });
      o.sfx.splash();
      v.say('me', '💧');
      toast(`${HOME_ITEMS[e.k].grown}에 물을 주었어요. 쑥쑥 자라라!`, 2400);
      v.sendHouse({ u: 1 });
    } catch (err) {
      if (err.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(err), 2800);
    } finally { farmBusy = false; }
  }
  async function harvestPlant(e) {
    const H = v.homeSpace;
    if (growStage(e) < 3 || farmBusy) return;
    farmBusy = true;
    try {
      await flush();
      const r = await o.rpc('kids_garden_harvest', { p_token: o.getToken(), p_id: e.id });
      setServerNow(r.now);
      const cur = H && H.entry(e.id);
      if (r.done) H.take(e.id);
      else if (cur) H.put({ id: cur.id, k: cur.k, x: cur.x, z: cur.z, r: cur.r || 0, ...growOf(r.plant) });
      if (st && r.items) { st.items = r.items; st.layout = H.layout.map(({ id, k, x, z, r: rr }) => ({ id, k, x, z, r: rr || 0 })); }
      if (o.onCrops) o.onCrops(r.crops);
      const hv = HARVEST[r.crop];
      o.sfx.success();
      v.celebrate();
      v.say('me', `${hv.icon} 와, ${hv.name}!`);
      const more = !r.done ? ` 다시 열리면 ${CROPS[e.k].picks - r.picks}번 더 딸 수 있어요.` : (CROPS[e.k].picks > 1 ? ' 이 포기는 다 땄어요. 새로 심어 봐요.' : '');
      toast(`${hv.name} ${r.got}${hv.unit}를 수확 바구니에 담았어요!${more}`, 3400);
      v.sendHouse({ u: 1 });
    } catch (err) {
      if (err.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(err), 2800);
    } finally { farmBusy = false; }
  }
  // ---------- 피아노: 의자에 앉으면 건반이 나온다 (js/piano.js) ----------
  let piano = null, pianoScene = 'village';
  let pnBuf = null, pnTimer = null; // 같은 집 친구에게 들려줄 음 (1.2초씩 모아 보낸다)
  function openPianoHere() {
    if (piano && piano.open) return;
    pianoScene = sceneNow() === 'piano' ? 'village' : sceneNow();
    setScene('piano'); // 치는 동안 배경음악을 멈춘다
    piano = openPiano({
      standing: () => !v.sitting,
      onCover: (px) => v.setBottomCover(px),
      onPlay: (m) => queueNote(m),
      onDone: (song) => { v.celebrate(); toast(`🎉 '${song.name}'${josa(song.name, '을', '를').slice(song.name.length)} 끝까지 쳤어요!`, 3000); },
      onClose: () => {
        piano = null;
        v.setBottomCover(0);
        sendNotes();
        setScene(pianoScene);
        if (v.sitting && v.sitting.home) v.standUp();
      },
    });
  }
  function queueNote(m) {
    if (!o.sendPiano || !v.house || !v.houseCompany()) return;
    const now = performance.now();
    if (!pnBuf) { pnBuf = { t0: now, n: [] }; pnTimer = setTimeout(sendNotes, 1200); }
    if (pnBuf.n.length < 32) pnBuf.n.push([m, Math.min(5000, Math.round(now - pnBuf.t0))]);
  }
  function sendNotes() {
    clearTimeout(pnTimer);
    pnTimer = null;
    const b = pnBuf;
    pnBuf = null;
    if (b && b.n.length && v.house) o.sendPiano({ h: v.house, n: b.n, _t: b.t0 });
  }
  // 같은 집에 있는 친구가 친 음을 듣는다 (친구가 친 순서와 간격 그대로, 조금 늦게)
  const pnBubble = new Map(); // 친구 id → 마지막으로 🎵를 띄운 때 (자주 띄우지 않는다)
  function remotePiano(id, p) {
    const r = v.remotes && v.remotes.get(id);
    if (!r || !v.inMyHouse(r) || p.h !== v.house) return;
    const now = performance.now();
    if (!(now - (pnBubble.get(id) || 0) < 6000)) { pnBubble.set(id, now); v.say(id, '🎵'); }
    for (const [m, dt] of p.n) {
      setTimeout(() => { const rel = pianoKey(m, { vel: 0.65 }); setTimeout(rel, 700); }, dt);
    }
  }

  // ---------- 그네 타기: 그네에 앉으면 '힘껏 구르기'로 높이 흔든다 ----------
  let swingUi = null;
  function startSwing(id) {
    if (swingUi) swingUi.stop();
    const H = v.homeSpace;
    const meter = h('i');
    let yay = false, lastSide = 0, lastPush = 0;
    const pump = () => {
      const rd = H && H.ride(id);
      if (!rd || !v.sitting || !v.sitting.swing) return;
      const now = performance.now();
      if (now - lastPush < 180) return; // 너무 빨리 누르면 한 번으로
      lastPush = now;
      H.ride(id, rd.want + 0.13);
      o.sfx.hop();
      if (rd.want >= 0.95 && !yay) { yay = true; v.say('me', '야호!'); }
      v.sendHouse(); // 같은 집 친구 화면의 그네도 그만큼 높이
    };
    const el = h('div', { class: 'swing-bar', role: 'group', 'aria-label': '그네 타기' },
      h('div', { class: 'swing-meter', 'aria-hidden': 'true' }, h('span', {}, '높이'), h('b', {}, meter)),
      h('button', { class: 'btn btn-sun swing-push', type: 'button', 'data-quiet': '', onclick: pump }, '힘껏 구르기!'),
      h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => v.standUp() }, '내리기'));
    document.body.append(el);
    document.body.classList.add('swing-on');
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) pump(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); v.standUp(); }
    };
    window.addEventListener('keydown', onKey, true);
    const tick = setInterval(() => {
      if (!v.sitting || !v.sitting.swing || v.sitting.swing.id !== id) { stop(); return; }
      const rd = H.ride(id);
      if (!rd) return;
      meter.style.width = `${Math.round(Math.min(1, rd.amp) * 100)}%`;
      // 높이 흔들리면 가운데를 지날 때마다 바람 소리
      const side = Math.sign(Math.sin(rd.phase));
      if (side !== lastSide && lastSide !== 0 && rd.amp > 0.5) o.sfx.whoosh();
      lastSide = side;
    }, 50);
    function stop() {
      clearInterval(tick);
      window.removeEventListener('keydown', onKey, true);
      el.remove();
      document.body.classList.remove('swing-on');
      if (swingUi && swingUi.el === el) swingUi = null;
    }
    swingUi = { el, stop };
    toast("그네에 앉았어요! '힘껏 구르기'를 누를수록 높이 올라가요.", 2600);
  }

  // 미끄럼틀 소리: 미끄러지기 시작하면 쉬익, 내려서면 통
  function onSlide(k) {
    if (k === 'go') o.sfx.whoosh();
    else if (k === 'done') o.sfx.jump();
  }

  // 꾸미기 아닐 때 물건을 누르면 (작은 재미)
  function onHomeItem(id) {
    const e = v.homeSpace && v.homeSpace.entry(id);
    if (!e) return;
    if (e.k === 'h_piano') openPianoHere();
    else if (e.k === 'y_fountain') { o.sfx.splash(); v.say('me', '시원해!'); }
    else if (e.k === 'y_swing' && v.sitting && v.sitting.swing) startSwing(id);
    else if (e.k === 'y_slide') { if (!v.sliding) { o.sfx.jump(); v.jump(); v.say('me', '야호!'); } } // 탈 때는 world가 사다리부터 태운다
    else if (e.k === 'y_swing') { o.sfx.jump(); v.jump(); v.say('me', '야호!'); }
    else if (e.k === 'h_bed' || e.k === 'h_bunk') v.say('me', '포근해~');
    else if (['h_fridge', 'h_sink', 'h_tv', 'h_globe'].includes(e.k)) {
      const r = v.homeSpace.poke(id);
      if (r === 'fridge') { o.sfx.open(); v.say('me', '시원해!'); setTimeout(() => o.sfx.close(), 2500); }
      else if (r === 'sink') { o.sfx.splash(); v.say('me', '손을 깨끗이 씻어요!'); }
      else if (r === 'tv-on') { o.sfx.tap(); v.say('me', '구름이 흘러가요~'); }
      else if (r === 'tv-off') o.sfx.tap();
      else if (r === 'globe') { o.sfx.whoosh(); v.say('me', '빙글빙글!'); }
    }
    else if (e.k === 'h_clock') {
      const d = new Date(), hh = d.getHours();
      o.sfx.ding();
      v.say('me', `지금은 ${hh < 12 ? '오전' : '오후'} ${(hh % 12) || 12}시 ${d.getMinutes()}분!`);
    }
    else if (e.k === 'h_fishtank') { o.sfx.blub(); v.say('me', '물고기야 안녕!'); }
    else if (e.k === 'h_fireplace') v.say('me', '따뜻해~');
    else if (e.k === 'h_oven') v.say('me', '따끈따끈!');
    else if (e.k === 'y_birdhouse') o.sfx.tweet();
    else if (e.k === 'y_mailbox') {
      v.say('me', '편지 왔나?');
      if (!guest && o.openMail) setTimeout(() => o.openMail(), 600); // 우리 집 우체통은 쪽지함
    }
  }

  // ---------- 집 넓히기 공사: 공사 터 팻말이나 꾸미기 판의 '집 넓히기'에서 ----------
  const buildPrice = (id) => (st && st.build && Number.isFinite(st.build[id]) ? st.build[id] : SPACES[id].price);
  const buildBase = (id) => (st && st.build_base && Number.isFinite(st.build_base[id]) ? st.build_base[id] : SPACES[id].price);
  function openBuild(fromEdit = false) {
    if (guest) { toast(`${guest.name}네 집 공사 터예요. 집 넓히기는 우리 집에서 할 수 있어요.`, 2800); return; }
    if (!st || !v.homeSpace) return;
    if (!expandOn()) { toast('집 넓히기는 곧 열려요!', 2400); return; }
    const H = v.homeSpace;
    const fruits = o.getFruits ? o.getFruits() : null;
    const left = BUILD_IDS.filter((id) => !H.rooms.includes(id));
    const rows = BUILD_IDS.map((id) => {
      const sp = SPACES[id], built = H.rooms.includes(id), price = buildPrice(id), base = buildBase(id);
      return h('div', { class: 'shop-item build-row' + (built ? ' built' : '') },
        h('div', { class: 'build-ic', 'aria-hidden': 'true' }, sp.icon),
        h('div', {}, h('b', {}, sp.name), h('p', {}, sp.desc),
          !built && price < base ? h('p', { class: 'build-sale' }, `할인해서 열매 ${price}개 (원래 ${base}개)`) : null),
        h('div', { class: 'acts' }, built
          ? h('span', { class: 'build-done' }, '지었어요 ✓')
          : h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => askBuild(id, fromEdit) }, `🍎 ${price}개로 짓기`)));
    });
    o.openSheet('집 넓히기 공사', h('div', { class: 'talk shop build' },
      fruits != null ? h('p', { class: 'shop-fruit' }, `내 열매 🍎 ${fruits}개`) : null,
      h('p', {}, left.length ? '거실, 주방, 방을 하나씩 지어서 집을 넓혀요. 새로 지은 방은 지은 차례대로 내 방 왼쪽에 붙어요.' : '집을 다 넓혔어요! 방마다 꾸미기를 즐겨 봐요.'),
      h('div', { class: 'shop-list' }, rows),
      h('p', { class: 'note' }, '방과 방 사이에는 문이 나고, 새 방마다 마당으로 나가는 앞문이 있어요. 공사비는 열매로 내고, 한 번 지은 방은 그대로 남아요.')), 'talk-sheet');
  }
  function askBuild(id, fromEdit) {
    const sp = SPACES[id], price = buildPrice(id);
    const fruits = o.getFruits ? o.getFruits() : null;
    if (fruits != null && fruits < price) { toast(`열매가 ${price - fruits}개 더 있어야 ${josa(sp.name, '을', '를')} 지을 수 있어요. 암송, 묵상, 필사로 열매를 모아요!`, 3600); return; }
    o.openSheet('집 넓히기 공사', h('div', { class: 'talk' },
      h('p', { class: 'result-big' }, `${sp.icon} ${sp.name}`),
      h('p', {}, `열매 ${price}개로 ${josa(sp.name, '을', '를')} 지을까요?`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => openBuild(fromEdit) }, '아니요'),
        h('button', { class: 'btn btn-go', type: 'button', onclick: () => doBuild(id, fromEdit) }, '네, 지어요!'))), 'talk-sheet');
  }
  async function doBuild(id, fromEdit) {
    if (building || !v.homeSpace) return;
    building = true;
    let r;
    try {
      await flush();
      r = await o.rpc('kids_home_build', { p_token: o.getToken(), p_space: id });
    } catch (e) {
      building = false;
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 3000);
      return;
    }
    o.modal.close();
    if (Number.isFinite(r.fruits)) o.setFruits(r.fruits);
    st.rooms = cleanRooms(r.rooms);
    if (editing) stopEdit();
    if (v.sitting) v.standUp();
    const H = v.homeSpace, idx = st.rooms.indexOf(id);
    const rect = { x0: ROOM.x0 - SLOT_W * (idx + 1), x1: ROOM.x0 - SLOT_W * idx };
    const cx = (rect.x0 + rect.x1) / 2;
    let applied = false, off = [];
    const apply = () => {
      if (applied) return;
      applied = true;
      H.setPlan(st.rooms, st.style || {});
      off = tidyLayout();
      v.sendHouse({ u: 1 }); // 우리 집에 놀러 온 친구 화면에도 새 방이
    };
    const far = innerWidth < innerHeight ? 1.9 : 1; // 세로 화면은 멀리서 방 전체가 들어오게
    const ctrl = {
      cam: { look: new THREE.Vector3(HOME_O.x + cx, 0.6, HOME_O.z - 6.8), pos: new THREE.Vector3(HOME_O.x + cx, 0.6 + 9.9 * far, HOME_O.z - 6.8 + 13.3 * far) },
      camSpeed: 2.4,
      onTap: () => {},
      update: () => {},
      stop: () => { H.endFx(); apply(); building = false; document.body.classList.remove('home-building'); }, // 공사 장면 중에 다른 놀이로 바뀌어도 방은 지어 둔다
    };
    v.enterGame(ctrl);
    document.body.classList.add('home-building');
    o.sfx.pop();
    H.buildFx(rect, {
      onHit: () => o.sfx.hammer(),
      onMid: () => { apply(); o.sfx.success(); confetti(); v.celebrate(); },
      onEnd: () => {
        building = false;
        document.body.classList.remove('home-building');
        if (v.game === ctrl) v.exitGame();
        const sp = SPACES[id];
        const more = id === 'kitchen' ? ' 주방 조리대를 누르면 요리할 수 있어요.' : '';
        const moved = off.length ? ` 새로 난 문 자리에 있던 물건 ${off.length}개는 가방에 넣어 두었어요.` : '';
        toast(fromEdit ? `${josa(sp.name, '이', '가')} 생겼어요! 새 가구를 놓아 봐요.${more}${moved}` : `${josa(sp.name, '이', '가')} 생겼어요! '집 꾸미기'에서 ${josa(sp.name, '을', '를')} 꾸며 봐요.${more}${moved}`, 4600);
        if (fromEdit) startEdit(id);
      },
    });
  }

  // ---------- 벽지와 바닥: 방마다 고른다 (열매는 들지 않는다) ----------
  let styleTimer = null, styleBusy = false;
  function openStyle(space) {
    const H = v.homeSpace;
    if (!H || guest || !spaceById(space)) return;
    const cur = styleOf(H.style, space);
    const sw = (kind, key, def) => {
      const on = (kind === 'w' ? cur.w : cur.f) === key;
      const bg = def.pat === 'stripe' ? `repeating-linear-gradient(90deg, ${def.c} 0 8px, ${def.c2} 8px 16px)`
        : def.pat === 'dots' ? `radial-gradient(${def.c2} 3px, transparent 4px) 0 0 / 14px 14px, ${def.c}`
          : def.pat === 'check' ? `conic-gradient(${def.c2} 25%, ${def.c} 0 50%, ${def.c2} 0 75%, ${def.c} 0) 0 0 / 18px 18px`
            : def.pat === 'plank' ? `repeating-linear-gradient(90deg, ${def.c} 0 14px, ${def.c2} 14px 16px)` : def.c;
      return h('button', {
        class: 'style-sw' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on),
        onclick: () => { pickStyle(space, kind, key); openStyle(space); },
      }, h('i', { style: `background:${bg}` }), h('span', {}, def.name));
    };
    o.openSheet(`${tabName(space)} 벽지·바닥`, h('div', { class: 'talk home-style' },
      h('h3', {}, '벽지'), h('div', { class: 'style-row' }, Object.entries(WALLS).map(([k, d]) => sw('w', k, d))),
      h('h3', {}, '바닥'), h('div', { class: 'style-row' }, Object.entries(FLOORS).map(([k, d]) => sw('f', k, d))),
      h('p', { class: 'note' }, '누르면 바로 바뀌어요. 벽지와 바닥은 열매 없이 몇 번이든 바꿀 수 있어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => o.modal.close() }, '다 골랐어요'))), 'talk-sheet style-sheet');
  }
  function pickStyle(space, kind, key) {
    const H = v.homeSpace;
    if (!H) return;
    const cur = styleOf(H.style, space);
    H.style[space] = { ...cur, [kind]: key };
    H.buildHouse();
    o.sfx.tick();
    clearTimeout(styleTimer);
    styleTimer = setTimeout(() => saveStyle(space), 500);
  }
  async function saveStyle(space) {
    const H = v.homeSpace;
    if (!H || guest) return;
    if (styleBusy) { styleTimer = setTimeout(() => saveStyle(space), 300); return; }
    styleBusy = true;
    const want = styleOf(H.style, space);
    try {
      const r = await o.rpc('kids_home_style', { p_token: o.getToken(), p_space: space, p_wall: want.w, p_floor: want.f });
      if (st) st.style = r.style || st.style;
      v.sendHouse({ u: 1 });
    } catch (e) {
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      toast(o.message(e), 3000);
      if (st && v.homeSpace) v.homeSpace.setPlan(v.homeSpace.rooms, st.style || {}); // 서버에 있는 대로
    } finally { styleBusy = false; }
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
    if (editing) { editing = false; cancelMode(); if (v.mode === 'game') v.exitGame(); }
    if (v.atHome) v.exitHome();
    document.body.classList.remove('at-home', 'home-editing');
    panel.hidden = true;
    bar.hidden = true;
    st = null;
    guest = null;
    building = false;
    clearTimeout(styleTimer);
  }

  return {
    enter, exit, reset, onPlant, onHomeItem, onSlide, onShopChanged, startEdit, stopEdit, visit, refreshGuest, openInvite, remotePiano, openBuild,
    get editing() { return editing; },
    get guest() { return guest; },
    onDoor(id) {
      if (id === 'home-exit') { exit(); return true; }
      if (id === 'home-build') { openBuild(false); return true; }
      if (id === 'home-cook') {
        if (guest) { toast(`${guest.name}네 주방이에요. 요리는 우리 집 주방이나 마을 숲속 부엌에서 해요.`, 2800); return true; }
        if (o.openCook) o.openCook();
        return true;
      }
      if (id === 'home-closet') {
        if (guest) { toast(`${guest.name}네 옷장이에요. 옷은 우리 집 옷장에서 갈아입어요.`, 2600); return true; }
        o.openMaker(false);
        return true;
      }
      return false;
    },
  };
}
