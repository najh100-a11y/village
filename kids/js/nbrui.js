// 진숲 어린이 마을 — 이웃 마을: 집 목록 불러오기, 집에 놀러 가기, 다녀간 인사 스티커
// 이웃 마을 섬(js/nbrisle.js)의 집은 서버 kids_neighbors(마을 이름과 주민이 있는 아이 모두, 가입한 차례)로 짓는다.
// 집을 누르면 그 집에 놀러 가고(주인이 마을에 없어도), 나오면 그 집 앞에 선다. 우리 집을 누르면 우리 집에 들어간다.
// 집 앞 우체통이나 친구 집 안의 '인사 남기기'로 정해진 인사 스티커 여덟 가지 가운데 하나를 남긴다(kids_home_note).
// 집 주인은 내 집에 들어오면 '다녀간 친구'에서 누가 언제 어떤 인사를 남겼는지 본다(kids_home_notes).
import { normalizeAvatar, drawFaceIcon } from './face.js';
import { h, toast, josa } from './ui.js';
import { regionOf } from './isles.js';
import { NB_LOTS } from './nbrisle.js';

// 인사 스티커 (서버 kids_home_notes.sticker와 같은 이름)
export const NB_STICKERS = {
  hi: ['👋', '놀러 왔다 가요!'],
  pretty: ['🌷', '집이 정말 예뻐요!'],
  fun: ['😆', '재미있게 놀다 가요!'],
  miss: ['🥰', '보고 싶었어요!'],
  play: ['🤝', '다음에 같이 놀아요!'],
  thanks: ['💐', '고마워요!'],
  bless: ['🙏', '하나님의 축복이 가득하길!'],
  star: ['⭐', '최고예요!'],
};
const stickerText = (s) => (NB_STICKERS[s] ? `${NB_STICKERS[s][1]} ${NB_STICKERS[s][0]}` : '');
function ago(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}
const face = (avatar) => {
  const c = h('canvas', { width: 80, height: 80, class: 'fl-face', 'aria-hidden': 'true' });
  drawFaceIcon(c, normalizeAvatar(avatar));
  return c;
};

export function createNbrUI(o) {
  // o: { village, rpc, getToken, getMe, features, homeUI(), modal, openSheet, message, onSessionLost, sfx, onlineIds(), busy() }
  const v = o.village;
  let houses = []; // 서버 목록 [{ id, name, avatar, look, t }]
  let unseen = 0, loadedAt = 0, loading = null, lastSig = '', tipShown = false;
  const on = () => !!(o.features().nbr && v.nbrIsle);

  // 내 줄은 지금 내 모습과 집 모양으로 (집 모양을 바꾸면 바로 이웃 마을에도)
  function apply() {
    if (!v.nbrIsle) return;
    const me = o.getMe();
    const list = houses.map((p) => (me && p.id === me.id ? { ...p, name: me.village_name || p.name, avatar: me.avatar || p.avatar, look: v.homeLookV || p.look } : p));
    const sig = JSON.stringify(list.map((p) => [p.id, p.name, p.look, p.avatar && p.avatar.outfitColor]));
    if (sig === lastSig) return;
    lastSig = sig;
    v.nbrIsle.setHouses(list, (av) => v.autoRoofOf(av));
  }
  async function load(force = false) {
    if (!o.features().nbr) return;
    if (loading) return loading;
    if (!force && Date.now() - loadedAt < 60000) return;
    loading = (async () => {
      try {
        const r = await o.rpc('kids_neighbors', { p_token: o.getToken() });
        houses = Array.isArray(r.houses) ? r.houses : [];
        unseen = Number(r.unseen) || 0;
        loadedAt = Date.now();
        apply();
        const H = o.homeUI();
        if (H) H.redrawBar();
      } catch (e) {
        if (e.code === 'SESSION') o.onSessionLost();
      } finally { loading = null; }
    })();
    return loading;
  }
  // 이웃 마을 섬에 들어오면 목록을 새로 (1분에 한 번), 처음 오면 도움말 한 번
  setInterval(() => {
    if (!on() || !v.player || v.atHome) return;
    apply();
    const p = v.player.root.position;
    if (regionOf(p.x, p.z) !== 'nbr') return;
    load();
    if (!tipShown) {
      tipShown = true;
      let first = false;
      try { first = !localStorage.getItem('kv.nbr.tip'); localStorage.setItem('kv.nbr.tip', '1'); } catch (e) { /* 그대로 */ }
      if (first) toast("이웃 마을이에요! 친구 집을 누르면 놀러 가요(친구가 마을에 없어도 돼요). 가운데 '이웃 마을 안내판'에서 친구 이름으로 집을 찾아요.", 6000);
    }
  }, 1500);

  // 집 앞에서 나올 때 설 자리 (집을 등지고 골목 쪽을 본다)
  const backOf = (l) => ({ x: l.door.x, z: l.door.z, rot: Math.atan2(l.fx, l.fz) });
  function goHouse(i) {
    const l = NB_LOTS[i], ow = v.nbrIsle && v.nbrIsle.ownerOf(i);
    if (!l) return;
    if (!ow) { toast('새 친구의 집이 들어설 자리예요! 새 친구가 마을에 처음 들어오면 여기에 집이 생겨요.', 3400); return; }
    const me = o.getMe(), H = o.homeUI();
    if (!H) return;
    if (me && ow.id === me.id) { H.enter(backOf(l)); return; }
    H.visit(ow.id, backOf(l));
  }
  function mailbox(i) {
    const ow = v.nbrIsle && v.nbrIsle.ownerOf(i), me = o.getMe();
    if (!ow) { toast('새 친구의 집이 들어설 자리예요! 아직 우체통이 비어 있어요.', 3000); return; }
    if (me && ow.id === me.id) { myNotes(); return; }
    leaveNote({ id: ow.id, name: ow.name });
  }

  // ---------- 인사 남기기 ----------
  let sending = false;
  function leaveNote(host) {
    if (!host || !host.id) return;
    const grid = h('div', { class: 'nb-stickers' }, Object.entries(NB_STICKERS).map(([k, [emo, text]]) => h('button', {
      class: 'nb-sticker', type: 'button',
      onclick: async (e) => {
        if (sending) return;
        sending = true;
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await o.rpc('kids_home_note', { p_token: o.getToken(), p_host: host.id, p_sticker: k });
          o.modal.close();
          o.sfx.pop();
          toast(`${host.name}에게 '${text} ${emo}' 인사를 남겼어요! ${josa(host.name, '이', '가')} 다음에 집에 들어오면 볼 수 있어요.`, 3600);
        } catch (err) {
          b.disabled = false;
          if (err.code === 'SESSION') { o.onSessionLost(); return; }
          toast(o.message(err), 3200);
        } finally { sending = false; }
      },
    }, h('span', { class: 'nb-emo', 'aria-hidden': 'true' }, emo), h('span', {}, text))));
    o.openSheet(`💌 ${host.name}에게 인사 남기기`, h('div', { class: 'talk nb-note' },
      h('p', {}, `${host.name}의 집에 다녀갔다고 인사를 남겨요. ${josa(host.name, '이', '가')} 다음에 집에 들어오면 누가 남겼는지 볼 수 있어요.`),
      grid,
      h('p', { class: 'note' }, '같은 집에는 10분에 한 번, 하루에 30번까지 남길 수 있어요.')), 'talk-sheet');
  }

  // ---------- 우리 집에 다녀간 친구 ----------
  async function myNotes() {
    const body = h('div', { class: 'talk friends nb-notes' }, h('p', { class: 'fb-empty' }, '불러오는 중…'));
    o.openSheet('💌 우리 집에 다녀간 친구', body, 'talk-sheet');
    try {
      const r = await o.rpc('kids_home_notes', { p_token: o.getToken(), p_mark: true });
      unseen = 0;
      const H = o.homeUI();
      if (H) H.redrawBar();
      const list = Array.isArray(r.notes) ? r.notes : [];
      if (!body.isConnected) return;
      body.replaceChildren(
        list.length ? h('div', { class: 'fl-list' }, list.map((n) => h('div', { class: `fl-row${n.seen ? '' : ' nb-new'}` }, face(n.avatar),
          h('div', { class: 'fl-main' }, h('b', {}, n.name, n.seen ? null : h('span', { class: 'nb-new-t' }, '새로')), h('span', {}, `${stickerText(n.s)} · ${ago(n.at)}`)))))
          : h('p', { class: 'fb-empty' }, '아직 다녀간 친구가 없어요. 친구들이 이웃 마을에서 우리 집에 놀러 오면 여기에 인사가 남아요.'),
        h('p', { class: 'note' }, '가장 최근 인사 40개까지 보여요.'));
    } catch (e) {
      if (e.code === 'SESSION') { o.onSessionLost(); return; }
      body.replaceChildren(h('p', { class: 'fb-empty' }, o.message(e)));
    }
  }

  // ---------- 이웃 마을 안내판: 친구 이름으로 집 찾기 ----------
  async function directory() {
    const body = h('div', { class: 'talk friends nb-dir' }, h('p', { class: 'fb-empty' }, '불러오는 중…'));
    o.openSheet('🏘️ 이웃 마을 안내판', body, 'talk-sheet');
    await load(true);
    if (!body.isConnected) return;
    const me = o.getMe(), online = new Set(o.onlineIds ? o.onlineIds() : []);
    const list = houses.slice(0, NB_LOTS.length).map((p) => ({ p, lot: v.nbrIsle ? v.nbrIsle.lotOf(p.id) : -1 }));
    list.sort((a, b) => (me && a.p.id === me.id ? -1 : me && b.p.id === me.id ? 1 : (a.p.name || '').localeCompare(b.p.name || '', 'ko')));
    const rows = list.map(({ p, lot }) => {
      const mine = me && p.id === me.id;
      const l = NB_LOTS[lot];
      return h('div', { class: 'fl-row' }, face(mine && me.avatar ? me.avatar : p.avatar),
        h('div', { class: 'fl-main' },
          h('b', {}, mine ? `우리 집 (${me.village_name || p.name})` : `${p.name}의 집`, p.t ? h('span', { class: 't-badge' }, '선생님') : null),
          h('span', {}, online.has(p.id) ? '🟢 지금 마을에 있어요' : '마을에 없어도 놀러 갈 수 있어요')),
        h('div', { class: 'fl-acts' },
          h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => { o.modal.close(); if (l) goHouse(lot); } }, mine ? '🏡 들어가기' : '🏠 놀러 가기'),
          l ? h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => { o.modal.close(); v.walkToPoint(l.door.x, l.door.z, Math.atan2(-l.fx, -l.fz)); } }, '📍 집 앞으로') : null));
    });
    body.replaceChildren(
      h('p', {}, `이웃 마을에 집이 ${houses.length}채 있어요. 친구 집을 누르면 바로 놀러 가고, '집 앞으로'를 누르면 그 집 앞까지 걸어가요.`),
      rows.length ? h('div', { class: 'fl-list' }, rows) : h('p', { class: 'fb-empty' }, '아직 집이 없어요.'),
      houses.length > NB_LOTS.length ? h('p', { class: 'note' }, `집터가 ${NB_LOTS.length}곳이라 그 뒤에 온 친구 집은 아직 이웃 마을에 보이지 않아요.`) : null);
  }

  function onDoor(id) {
    if (id === 'nb_board') { if (!o.features().nbr) { toast('이웃 마을은 곧 열려요!', 2400); return true; } directory(); return true; }
    if (id.startsWith('nbm_')) { if (o.features().nbr) mailbox(Number(id.slice(4))); return true; }
    if (id.startsWith('nb_')) { if (o.features().nbr) goHouse(Number(id.slice(3))); return true; }
    return false;
  }
  // 다가갔을 때 단추 글: 안내판 '보기', 우리 집 '들어가기', 친구 집 '놀러 가기', 우체통 '인사 남기기'(우리 집은 '열어 보기'), 빈 집터 '보기'
  function promptAct(id) {
    if (id === 'nb_board') return '보기';
    const mail = id.startsWith('nbm_'), i = Number(id.slice(mail ? 4 : 3));
    const ow = v.nbrIsle && v.nbrIsle.ownerOf(i), me = o.getMe();
    if (!ow) return '보기';
    const mine = me && ow.id === me.id;
    if (mail) return mine ? '열어 보기' : '인사 남기기';
    return mine ? '들어가기' : '놀러 가기';
  }
  return {
    load, onDoor, leaveNote, myNotes, directory, promptAct,
    unseen: () => unseen,
    get houses() { return houses; },
  };
}
