// 진숲 어린이 마을 — 체험판 (서버 없이 이 브라우저 안에서만 돌아가는 가짜 서버)
// 실제 서버의 RPC 함수와 같은 이름, 같은 규칙으로 흉내 낸다.
import PLAN from './plan-data.js';
import { FISH, FRIDGE as FRIDGE_IDS } from './play-data.js';
import { toJpeg } from './images.js';
import { cleanChat } from './chatfilter.js';
const BUG_KINDS = ['cabbage_white', 'swallowtail', 'honeybee', 'ladybug', 'grasshopper', 'red_dragonfly', 'mantis', 'cicada', 'stag_beetle', 'rhino_beetle', 'firefly'];
const ITEM_PRICE = { fw_spark: 1, fw_flower: 3, fw_heart: 5, pet_dog: 30, pet_cat: 30, pet_rabbit: 30, pet_chick: 30 };

const FIRST = PLAN.weeks[0].week_start;
const LAST = PLAN.weeks[PLAN.weeks.length - 1].days.slice(-1)[0].date;

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 체험판의 '오늘': 실제 날짜가 계획 기간 밖이면 기간 안으로 옮긴다
function today() {
  const t = iso(new Date());
  return t < FIRST ? FIRST : t > LAST ? LAST : t;
}
function weekOf(day) {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
function fail(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}
const ID_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;
const nowIso = (minAgo = 0) => new Date(Date.now() - minAgo * 60000).toISOString();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }; // 놀이 기록은 실제 오늘 기준

// 체험판 그림·사진은 따로 저장한다 (브라우저 저장 공간이 차면 오래된 것부터 지운다)
const IMG = 'kv.demo.img.';
function imgPut(db, id, b64) {
  for (let i = 0; i < 12; i++) {
    try {
      localStorage.setItem(IMG + id, b64);
      db.imgs = (db.imgs || []).filter((x) => x !== id).concat(id);
      return true;
    } catch (e) {
      const old = (db.imgs || []).find((x) => !x.startsWith('seed'));
      if (!old) return false;
      try { localStorage.removeItem(IMG + old); } catch (er) { /* 무시 */ }
      db.imgs = db.imgs.filter((x) => x !== old);
    }
  }
  return false;
}
function imgGet(id) { try { return id ? localStorage.getItem(IMG + id) : null; } catch (e) { return null; } }
function imgDel(db, id) { try { localStorage.removeItem(IMG + id); } catch (e) { /* 무시 */ } db.imgs = (db.imgs || []).filter((x) => x !== id); }
const isJpeg = (b64) => typeof b64 === 'string' && b64.startsWith('/9j/');

// 예시 친구들이 그린 그림 (체험판 전시관이 비어 있지 않게)
function seedDrawings() {
  const make = (paint) => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 600;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 600);
    x.lineCap = 'round'; x.lineJoin = 'round';
    paint(x);
    return { img: toJpeg(c, { maxSide: 800, quality: 0.8, maxBytes: 300000 }).b64, thumb: toJpeg(c, { maxSide: 240, quality: 0.75, maxBytes: 28000 }).b64 };
  };
  const church = make((x) => {
    x.fillStyle = '#BFE6F7'; x.fillRect(0, 0, 800, 380);
    x.fillStyle = '#F6D55C'; x.beginPath(); x.arc(660, 100, 60, 0, 7); x.fill();
    x.fillStyle = '#8DCC5F'; x.beginPath(); x.ellipse(400, 560, 520, 230, 0, 0, 7); x.fill();
    x.fillStyle = '#FFF3DA'; x.fillRect(280, 260, 240, 200);
    x.fillStyle = '#EF6461'; x.beginPath(); x.moveTo(250, 270); x.lineTo(400, 160); x.lineTo(550, 270); x.fill();
    x.fillStyle = '#8B5E3C'; x.fillRect(370, 360, 60, 100);
    x.strokeStyle = '#6B4429'; x.lineWidth = 12; x.beginPath(); x.moveTo(400, 60); x.lineTo(400, 160); x.moveTo(365, 95); x.lineTo(435, 95); x.stroke();
    x.fillStyle = '#7EC8F2'; x.fillRect(300, 290, 50, 50); x.fillRect(450, 290, 50, 50);
  });
  const rainbow = make((x) => {
    x.fillStyle = '#E6F5FC'; x.fillRect(0, 0, 800, 600);
    ['#EF6461', '#F49A4C', '#F6D55C', '#5DB760', '#7EC8F2', '#3F6FD8', '#A07FE3'].forEach((c, i) => {
      x.strokeStyle = c; x.lineWidth = 26; x.beginPath(); x.arc(400, 520, 330 - i * 26, Math.PI, 0); x.stroke();
    });
    x.fillStyle = '#fff';
    for (const [cx, cy] of [[120, 480], [680, 480]]) { x.beginPath(); x.arc(cx, cy, 60, 0, 7); x.arc(cx + 60, cy + 10, 50, 0, 7); x.arc(cx - 60, cy + 10, 50, 0, 7); x.fill(); }
  });
  return [church, rainbow];
}

// 이 기기에 남은 체험판 자료에 새 계획(이야기, 묵상 해설)을 덮어쓴다. 아이들이 쓴 글은 그대로 둔다.
// 체험판 예시 친구 바다는 토끼를 데리고 다닌다 (친구 애완동물이 어떻게 보이는지)
function seedPets(db) {
  if (!db || db.petsSeeded) return db;
  db.petsSeeded = true;
  const c3 = (db.children || []).find((c) => c.id === 'c3');
  if (c3 && !c3.pet) {
    c3.pet = 'pet_rabbit';
    db.items = db.items || {};
    db.items.c3 = { ...(db.items.c3 || {}), pet_rabbit: 1 };
  }
  return db;
}
function syncPlan(db) {
  seedPets(db);
  if (!db || db.planVersion === PLAN.version) return db; // 한 번만 (선생님이 고친 내용은 남긴다)
  db.planVersion = PLAN.version;
  try {
    for (const w of PLAN.weeks) {
      const x = (db.weeks || []).find((y) => y.week_start === w.week_start);
      if (x) Object.assign(x, { theme: w.theme, copy_ref: w.copy.ref, copy_intro: w.copy.intro, copy_passage: w.copy.verses });
      for (const d of w.days) {
        const q = (db.qt || []).find((y) => y.day === d.date);
        if (q) Object.assign(q, { title: d.title, ref: d.ref, passage: d.verses, questions: d.questions, prayer: d.prayer, action: d.action, note: d.note || '' });
      }
    }
  } catch (e) { /* 그대로 쓴다 */ }
  return db;
}

export class DemoBackend {
  constructor() {
    this.key = 'kv.demo.db.v4';
    this.db = this.load();
  }
  load() {
    try {
      const s = localStorage.getItem(this.key);
      if (s) return syncPlan(JSON.parse(s));
    } catch (e) { /* 무시 */ }
    const db = seedPets(this.seed());
    try {
      seedDrawings().forEach((d, i) => {
        const id = `seed${i + 1}`;
        imgPut(db, id, d.img);
        imgPut(db, id + 't', d.thumb);
        db.art.push({ id, child: i ? 'c3' : 'c2', title: i ? '구름 위 무지개' : '우리 교회', img: id, thumb: id + 't', shared: true, hidden: false, at: nowIso(120 - i * 60) });
      });
    } catch (e) { /* 그림을 못 만들어도 계속 */ }
    return db;
  }
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch (e) { /* 무시 */ }
  }
  seed() {
    const t = today();
    const verses = PLAN.verses.map((v, i) => ({ id: `v${i + 1}`, ref: v.ref, body: v.body, version: '개역한글', sort_order: i + 1, is_current: false, is_published: true }));
    const vid = (ref) => (verses.find((v) => v.ref === ref) || {}).id || null;
    const weeks = PLAN.weeks.map((w) => ({
      week_start: w.week_start, theme: w.theme, verse_id: vid(w.verse_ref), copy_ref: w.copy.ref, copy_intro: w.copy.intro,
      copy_passage: w.copy.verses, is_published: true,
    }));
    const qt = PLAN.weeks.flatMap((w) => w.days.map((d) => ({
      day: d.date, week_start: w.week_start, title: d.title, ref: d.ref, passage: d.verses, questions: d.questions, prayer: d.prayer, action: d.action, note: d.note || '',
    })));
    const wk = weekOf(t);
    const curVerse = weeks.find((w) => w.week_start === wk).verse_id;
    return {
      planVersion: PLAN.version,
      verses, weeks, qt,
      children: [
        { id: 'c1', login_id: '체험', pin: '1234', name: '체험 어린이', birthdate: '2017-05-05', consent_date: t, village_name: null, avatar: null, fruits: 0, last_seen_at: null, memory: {} },
        { id: 'c2', login_id: '하늘', pin: '1111', name: '예시 하늘', birthdate: '2016-09-12', consent_date: t, village_name: '하늘이',
          avatar: { v: 1, skin: 0, eyes: 'sparkle', eyeColor: 1, brows: 'soft', nose: 'dot', mouth: 'grin', cheek: 'pink', hair: 'pigtails', hairColor: 0, outfit: 'dress', outfitColor: 10, bottomColor: 0, shoeColor: 3, hat: 'flower', hatColor: 2 },
          fruits: 12, last_seen_at: nowIso(30), memory: { [curVerse]: { practice_count: 3, best_score: 95, passed: true, last: t, first: nowIso(300) } } },
        { id: 'c3', login_id: '바다', pin: '2222', name: '예시 바다', birthdate: '2018-02-20', consent_date: t, village_name: '바다',
          avatar: { v: 1, skin: 3, eyes: 'round', eyeColor: 0, brows: 'thick', nose: 'round', mouth: 'smile', cheek: 'none', hair: 'spiky', hairColor: 1, outfit: 'hoodie', outfitColor: 7, bottomColor: 2, shoeColor: 4, hat: 'cap', hatColor: 0 },
          fruits: 4, last_seen_at: null, memory: { [curVerse]: { practice_count: 1, best_score: 80, passed: false, last: t, first: nowIso(120) } } },
      ],
      qtEntries: [
        { child: 'c2', day: t, answer: '하나님이 하신 일을 생각하니 마음이 따뜻해졌어요. 오늘 동생한테 먼저 양보해 볼래요.', prayer: '', shared: true, hidden: false, at: nowIso(200) },
        { child: 'c3', day: t, answer: '조금 어려웠지만 끝까지 읽었어요.', prayer: '', shared: false, hidden: false, at: nowIso(90) },
      ],
      copyEntries: [{ child: 'c2', week: wk, note: '천천히 따라 쓰니까 말씀이 더 잘 기억났어요.', shared: true, hidden: false, at: nowIso(400) }],
      reactions: [{ kind: 'qt', target: 'c2', key: t, from: 'c3', r: 'heart' }],
      art: [],
      fish: [
        { child: 'c2', fish: 'carp', size: 52.4, at: nowIso(50) },
        { child: 'c3', fish: 'crucian', size: 21.0, at: nowIso(20) },
        { child: 'c2', fish: 'medaka', size: 3.1, at: nowIso(45) },
      ],
      cook: { c2: { manna: { stars: 3, times: 1, with_friend: 0 } } },
      imgs: [],
      teachers: [{ id: 't1', login_id: '선생님', pw: 'demo1234', name: '체험 선생님' }],
      sessions: {},
    };
  }
  session(token, kind) {
    const s = this.db.sessions[token];
    if (!s || s.kind !== kind) fail('SESSION');
    return s.id;
  }
  newSession(kind, id) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.db.sessions[token] = { kind, id };
    return token;
  }
  child(id) { return this.db.children.find((c) => c.id === id) || fail('NOT_FOUND'); }
  call(fn, a) {
    this.db = this.load(); // 다른 탭이 바꾼 내용을 먼저 읽는다
    const out = this[fn] ? this[fn](a) : fail('NOT_FOUND');
    this.save();
    return out;
  }
  currentVerse() {
    const w = this.db.weeks.find((x) => x.week_start === weekOf(today()) && x.is_published);
    if (w && w.verse_id && this.db.verses.some((v) => v.id === w.verse_id && v.is_published)) return w.verse_id;
    const v = this.db.verses.find((x) => x.is_current && x.is_published);
    return v ? v.id : null;
  }
  reactions(kind, key, target, viewer) {
    const rs = this.db.reactions.filter((r) => r.kind === kind && r.key === key && r.target === target);
    const counts = {};
    rs.forEach((r) => { counts[r.r] = (counts[r.r] || 0) + 1; });
    return { counts, mine: rs.filter((r) => r.from === viewer).map((r) => r.r) };
  }
  // 그날 암송 연습·묵상·필사 가운데 하나라도 했는지 (놀이 마당 열기)
  cleared(me) {
    if (this.playFree()) return true;
    const c = this.child(me);
    const s = startOfToday();
    return Object.values(c.memory).some((m) => m.last === today())
      || this.db.qtEntries.some((e) => e.child === me && (e.updatedAt || e.at) >= s)
      || this.db.copyEntries.some((e) => e.child === me && (e.updatedAt || e.at) >= s);
  }
  gate(me) { if (!this.cleared(me)) fail('PLAY_LOCKED'); }
  publishedDays() {
    return this.db.qt.filter((q) => this.db.weeks.some((w) => w.week_start === q.week_start && w.is_published)).map((q) => q.day).sort();
  }

  // 누구나 놀이 날 (이 날짜까지는 말씀 활동을 안 해도 놀이 마당이 열린다)
  villageConf() { return this.db.village || (this.db.village = { chat_open: true, free_until: '' }); }
  playFree() { const f = this.villageConf().free_until; return /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= today(); }

  // ---------- 마을 글 대화 ----------
  kids_features() { return { dish: true, comments: true, dm: true, eat: true, bugs: true, shop: true, lectio: true, photo10: true, pets: true }; }
  kids_dm_send({ p_token, p_to, p_text }) {
    const me = this.session(p_token, 'child');
    if (!this.villageConf().chat_open) fail('CHAT_OFF');
    if (this.child(me).chat_muted) fail('CHAT_MUTED');
    if (!p_to || p_to === me) fail('NOT_FOUND');
    this.child(p_to);
    const t = cleanChat(p_text);
    if (!t) fail('EMPTY_CHAT');
    this.db.chat = this.db.chat || [];
    const last = this.db.chat.filter((m) => m.child === me).map((m) => m.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 1500) fail('TOO_FAST');
    const raw = [...String(p_text || '').replace(/\s+/g, ' ').trim()].slice(0, 60).join('');
    this.db.chat.push({ id: Date.now() + Math.random(), child: me, to: p_to, body: t, masked: t !== raw, at: nowIso() });
    this.db.chat = this.db.chat.slice(-300);
    return { text: t };
  }
  kids_chat_open() { return this.villageConf().chat_open; }
  kids_chat_send({ p_token, p_text }) {
    const me = this.session(p_token, 'child');
    if (!this.villageConf().chat_open) fail('CHAT_OFF');
    if (this.child(me).chat_muted) fail('CHAT_MUTED');
    const t = cleanChat(p_text);
    if (!t) fail('EMPTY_CHAT');
    this.db.chat = this.db.chat || [];
    const mine = this.db.chat.filter((m) => m.child === me);
    const last = mine.map((m) => m.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 2000) fail('TOO_FAST');
    if (mine.filter((m) => m.at >= startOfToday()).length >= 300) fail('CHAT_TIRED');
    const raw = [...String(p_text || '').replace(/\s+/g, ' ').trim()].slice(0, 60).join('');
    this.db.chat.push({ id: Date.now() + Math.random(), child: me, body: t, masked: t !== raw, at: nowIso() });
    this.db.chat = this.db.chat.slice(-300);
    return { text: t };
  }

  // ---------- 마음대로 요리 ----------
  kids_dish_save({ p_token, p_name, p_kind, p_items }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    if (!['soup', 'fry', 'grill', 'salad'].includes(p_kind)) fail('BAD_DISH');
    if (!Array.isArray(p_items) || p_items.length < 1 || p_items.length > 4) fail('BAD_DISH');
    const caught = new Set(this.db.fish.filter((f) => f.child === me).map((f) => `fish_${f.fish}`));
    for (const it of p_items) {
      if (FRIDGE_IDS.includes(it)) continue;
      const k = FISH.find((f) => `fish_${f.id}` === it);
      if (k && k.rarity >= 0 && caught.has(it)) continue;
      fail('BAD_DISH');
    }
    this.db.dishes = this.db.dishes || [];
    const mine = this.db.dishes.filter((d) => d.child === me);
    const last = mine.map((d) => d.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 3000) fail('TOO_FAST');
    if (mine.filter((d) => d.at >= startOfToday()).length >= 30) fail('DISH_DAY');
    const name = [...cleanChat(p_name)].slice(0, 16).join('') || '나의 요리';
    const id = Date.now();
    this.db.dishes.push({ id, child: me, name, kind: p_kind, items: p_items, hidden: false, at: nowIso() });
    this.db.dishes = this.db.dishes.slice(-200);
    return { id, name };
  }
  dishEaters(id) {
    return (this.db.dishEats || []).filter((e) => e.dish === id).map((e) => (this.db.children.find((x) => x.id === e.child) || {}).village_name).filter(Boolean);
  }
  kids_dish_table({ p_token }) {
    const me = this.session(p_token, 'child');
    return (this.db.dishes || []).filter((d) => !d.hidden).slice(-4).reverse().map((d) => {
      const c = this.db.children.find((x) => x.id === d.child) || {};
      const eaters = this.dishEaters(d.id);
      return { id: d.id, name: d.name, kind: d.kind, items: d.items, cook: c.village_name, me: d.child === me,
        eaters: eaters.slice(0, 10), eaten: eaters.length, ate: (this.db.dishEats || []).some((e) => e.dish === d.id && e.child === me) };
    });
  }
  kids_dish_eat({ p_token, p_dish }) {
    const me = this.session(p_token, 'child');
    const d = (this.db.dishes || []).find((x) => x.id === p_dish && !x.hidden) || fail('NOT_FOUND');
    if (d.child === me) fail('OWN_DISH');
    this.db.dishEats = this.db.dishEats || [];
    if (!this.db.dishEats.some((e) => e.dish === d.id && e.child === me)) this.db.dishEats.push({ dish: d.id, child: me, at: nowIso() });
    const eaters = this.dishEaters(d.id);
    return { id: d.id, name: d.name, eaters: eaters.slice(0, 10), eaten: eaters.length };
  }

  // ---------- 곤충 채집 ----------
  kids_bug_book({ p_token }) {
    const me = this.session(p_token, 'child');
    const mine = {};
    for (const b of (this.db.bugs || []).filter((x) => x.child === me)) {
      const m = mine[b.bug] || (mine[b.bug] = { count: 0, first: b.at });
      m.count++;
    }
    return { mine, my_today: (this.db.bugs || []).filter((x) => x.child === me && x.at >= startOfToday()).length };
  }
  kids_bug_catch({ p_token, p_bug }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    if (!BUG_KINDS.includes(p_bug)) fail('BAD_BUG');
    this.db.bugs = this.db.bugs || [];
    const mine = this.db.bugs.filter((x) => x.child === me);
    const last = mine.map((x) => x.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 2000) fail('TOO_FAST');
    if (mine.filter((x) => x.at >= startOfToday()).length >= 60) fail('BUG_DAY');
    this.db.bugs.push({ child: me, bug: p_bug, at: nowIso() });
    const all = this.db.bugs.filter((x) => x.child === me);
    return { bug: p_bug, count: all.filter((x) => x.bug === p_bug).length, kinds: new Set(all.map((x) => x.bug)).size };
  }

  // ---------- 열매 상점: 불꽃놀이 ----------
  kids_shop({ p_token }) {
    const me = this.session(p_token, 'child');
    const items = {};
    for (const [k, n] of Object.entries((this.db.items || {})[me] || {})) if (n > 0) items[k] = n;
    return { fruits: this.child(me).fruits, items, prices: { ...ITEM_PRICE }, pet: this.child(me).pet || null };
  }
  kids_shop_buy({ p_token, p_item, p_n }) {
    const me = this.session(p_token, 'child');
    const price = ITEM_PRICE[p_item];
    const pet = String(p_item || '').startsWith('pet_');
    const n = pet ? 1 : p_n || 1;
    if (!price || n < 1 || n > 5) fail('BAD_ITEM');
    this.db.items = this.db.items || {};
    const bag = this.db.items[me] || (this.db.items[me] = {});
    if (pet && (bag[p_item] || 0) >= 1) fail('HAVE_PET');
    if ((bag[p_item] || 0) + n > 99) fail('BAG_FULL');
    const c = this.child(me);
    if (c.fruits < price * n) fail('NO_FRUIT');
    c.fruits -= price * n;
    bag[p_item] = (bag[p_item] || 0) + n;
    this.db.shopLog = this.db.shopLog || [];
    this.db.shopLog.push({ id: Date.now(), child: me, item: p_item, n, price: price * n, at: nowIso() });
    return this.kids_shop({ p_token });
  }
  kids_item_use({ p_token, p_item }) {
    const me = this.session(p_token, 'child');
    const bag = ((this.db.items || {})[me]) || {};
    if (!String(p_item || '').startsWith('fw_')) fail('BAD_ITEM');
    this.usedAt = this.usedAt || {};
    if (this.usedAt[me] && Date.now() - this.usedAt[me] < 2000) fail('TOO_FAST');
    if (!(bag[p_item] > 0)) fail('NO_ITEM');
    bag[p_item] -= 1;
    this.usedAt[me] = Date.now();
    return { item: p_item, left: bag[p_item] };
  }
  // 데리고 다닐 애완동물 (null이면 집에서 쉰다)
  kids_pet_set({ p_token, p_pet }) {
    const me = this.session(p_token, 'child');
    if (p_pet && !(((this.db.items || {})[me] || {})[p_pet] > 0 && String(p_pet).startsWith('pet_'))) fail('NO_PET');
    this.child(me).pet = p_pet || null;
    return { pet: p_pet || null };
  }
  kids_t_dish_hide({ p_token, p_id, p_hidden }) {
    this.session(p_token, 'teacher');
    const d = (this.db.dishes || []).find((x) => x.id === p_id) || fail('NOT_FOUND');
    d.hidden = !!p_hidden;
    return this.kids_t_village({ p_token });
  }

  // ---------- 아이 ----------
  signupConf() { return this.db.signup || (this.db.signup = { open: true, code: '0000' }); }
  kids_signup_open() { return this.signupConf().open; }
  kids_signup({ p_code, p_login_id, p_pin, p_name, p_birthdate, p_agree }) {
    const conf = this.signupConf();
    if (!conf.open) fail('SIGNUP_CLOSED');
    if (String(p_code || '').trim().toLowerCase() !== conf.code.toLowerCase()) return { ok: false, error: 'BAD_JOIN_CODE' };
    if (!p_agree) fail('NO_AGREE');
    const l = String(p_login_id || '').trim();
    if (!ID_RE.test(l)) fail('BAD_LOGIN_ID');
    if (!/^[0-9]{4,6}$/.test(p_pin || '')) fail('BAD_PIN');
    const n = String(p_name || '').trim();
    if (n.length < 1 || n.length > 20) fail('BAD_NAME');
    if (!p_birthdate || p_birthdate < '2005-01-01' || p_birthdate > iso(new Date())) fail('BAD_BIRTHDATE');
    if (this.db.children.some((c) => c.login_id.toLowerCase() === l.toLowerCase())) fail('DUPLICATE_ID');
    if (this.db.children.some((c) => c.name === n && c.birthdate === p_birthdate)) fail('ALREADY_JOINED');
    const id = 'c' + Date.now();
    this.db.children.push({ id, login_id: l, pin: p_pin, name: n, birthdate: p_birthdate, consent_date: iso(new Date()), village_name: null, avatar: null,
      fruits: 0, last_seen_at: nowIso(), memory: {}, joined_self: true, consent_checked: false });
    return { ok: true, token: this.newSession('child', id) };
  }
  kids_login({ p_login_id, p_pin }) {
    const c = this.db.children.find((x) => x.login_id.toLowerCase() === String(p_login_id || '').trim().toLowerCase());
    if (!c || c.pin !== p_pin) return { ok: false, error: 'LOGIN_FAILED' };
    c.last_seen_at = nowIso();
    return { ok: true, token: this.newSession('child', c.id) };
  }
  kids_logout({ p_token }) { delete this.db.sessions[p_token]; return null; }
  kids_me({ p_token }) {
    const c = this.child(this.session(p_token, 'child'));
    c.last_seen_at = nowIso();
    return { id: c.id, login_id: c.login_id, name: c.name, village_name: c.village_name, avatar: c.avatar, fruits: c.fruits, pet: c.pet || null,
      is_birthday: c.birthdate.slice(5) === iso(new Date()).slice(5) };
  }
  kids_save_avatar({ p_token, p_avatar, p_village_name }) {
    const c = this.child(this.session(p_token, 'child'));
    const name = String(p_village_name || '').trim();
    if (name.length < 1 || name.length > 10) fail('BAD_NAME');
    c.avatar = p_avatar;
    c.village_name = name;
    return this.kids_me({ p_token });
  }
  kids_verses({ p_token }) {
    const c = this.child(this.session(p_token, 'child'));
    const cur = this.currentVerse();
    return this.db.verses.filter((v) => v.is_published).sort((x, y) => x.sort_order - y.sort_order).map((v) => {
      const m = c.memory[v.id] || {};
      return { id: v.id, ref: v.ref, body: v.body, version: v.version, is_current: v.id === cur, practice_count: m.practice_count || 0,
        best_score: m.best_score || 0, practiced_today: m.last === today(), passed: !!m.passed };
    });
  }
  kids_practice({ p_token, p_verse_id, p_score }) {
    const c = this.child(this.session(p_token, 'child'));
    if (!this.db.verses.some((v) => v.id === p_verse_id && v.is_published)) fail('NOT_FOUND');
    const m = c.memory[p_verse_id] || (c.memory[p_verse_id] = { practice_count: 0, best_score: 0, passed: false, last: null, first: null });
    const gained = m.last === today() ? 0 : 1;
    m.practice_count += 1;
    m.best_score = Math.max(m.best_score, Math.max(0, Math.min(100, p_score | 0)));
    m.last = today();
    m.first = m.first || nowIso();
    c.fruits += gained;
    return { gained, fruits: c.fruits };
  }
  kids_village({ p_token }) {
    this.session(p_token, 'child');
    return { room: 'demo', people: this.db.children.filter((c) => c.village_name && c.avatar).map((c) => ({ id: c.id, name: c.village_name, avatar: c.avatar, pet: c.pet || null })) };
  }
  kids_today({ p_token }) {
    const me = this.session(p_token, 'child');
    const t = today();
    const w = this.db.weeks.find((x) => x.week_start === weekOf(t) && x.is_published);
    const q = w && this.db.qt.find((x) => x.day === t);
    const vId = this.currentVerse();
    const v = this.db.verses.find((x) => x.id === vId);
    const c = this.child(me);
    return {
      today: t, theme: w ? w.theme : null, cleared: this.cleared(me),
      verse: v ? { id: v.id, ref: v.ref, practiced: !!(c.memory[v.id] && c.memory[v.id].practice_count) } : null,
      qt: q ? { day: q.day, title: q.title, ref: q.ref, done: this.db.qtEntries.some((e) => e.child === me && e.day === q.day) } : null,
      copy: w && w.copy_ref ? { week: w.week_start, ref: w.copy_ref, done: this.db.copyEntries.some((e) => e.child === me && e.week === w.week_start) } : null,
    };
  }
  kids_house_memory({ p_token }) {
    const me = this.session(p_token, 'child');
    const vId = this.currentVerse();
    if (!vId) return { verse: null, friends: [] };
    const v = this.db.verses.find((x) => x.id === vId);
    const friends = this.db.children.filter((c) => c.village_name && c.memory[vId] && (c.memory[vId].practice_count || c.memory[vId].passed))
      .map((c) => ({ id: c.id, name: c.village_name, avatar: c.avatar, me: c.id === me, at: c.memory[vId].first, passed: !!c.memory[vId].passed,
        count: c.memory[vId].practice_count, reactions: this.reactions('memory', vId, c.id, me) }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return { verse: { id: v.id, ref: v.ref }, friends };
  }
  entriesFor(list, key, field, kind, me, textField) {
    return list.filter((e) => e[field] === key).map((e) => {
      const c = this.child(e.child);
      if (!c.village_name) return null;
      return { id: c.id, name: c.village_name, avatar: c.avatar, me: c.id === me, at: e.at,
        text: c.id === me || (e.shared && !e.hidden) ? (e[textField] || null) : null, private: !e.shared, hidden: e.hidden,
        reactions: this.reactions(kind, key, c.id, me) };
    }).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
  }
  kids_qt_day({ p_token, p_day }) {
    const me = this.session(p_token, 'child');
    const t = today();
    const days = this.publishedDays().filter((d) => d <= t);
    if (!days.length) return { qt: null, next_start: this.publishedDays()[0] || null };
    const want = p_day || t;
    const day = days.includes(want) ? want : days.filter((d) => d <= want).pop() || days[days.length - 1];
    const q = this.db.qt.find((x) => x.day === day);
    const w = this.db.weeks.find((x) => x.week_start === q.week_start);
    const mine = this.db.qtEntries.find((e) => e.child === me && e.day === day);
    const i = days.indexOf(day);
    return {
      qt: { day, title: q.title, ref: q.ref, passage: q.passage, questions: q.questions, prayer: q.prayer, action: q.action, note: q.note || '', theme: w.theme, is_today: day === t },
      prev: i > 0 ? days[i - 1] : null,
      next: i < days.length - 1 ? days[i + 1] : null,
      mine: mine ? { answer: mine.answer, prayer: mine.prayer, word: mine.word || null, shared: mine.shared, hidden: mine.hidden } : null,
      friends: this.entriesFor(this.db.qtEntries, day, 'day', 'qt', me, 'answer').map((f) => {
        const e = this.db.qtEntries.find((x) => x.child === f.id && x.day === day);
        return { ...f, word: f.me || (e.shared && !e.hidden) ? (e.word || null) : null };
      }),
    };
  }
  kids_qt_save({ p_token, p_day, p_answer, p_prayer, p_shared, p_word }) {
    const me = this.session(p_token, 'child');
    if (!this.publishedDays().includes(p_day) || p_day > today()) fail('NOT_FOUND');
    const answer = String(p_answer || '').trim(), prayer = String(p_prayer || '').trim();
    if (!answer) fail('EMPTY_ANSWER');
    const word = String(p_word || '').trim() || null;
    if (answer.length > 400 || prayer.length > 400 || (word && word.length > 60)) fail('TOO_LONG');
    const c = this.child(me);
    let e = this.db.qtEntries.find((x) => x.child === me && x.day === p_day);
    let gained = 0;
    if (!e) { e = { child: me, day: p_day, hidden: false, at: nowIso() }; this.db.qtEntries.push(e); gained = 1; c.fruits += 1; }
    Object.assign(e, { answer, prayer, shared: p_shared !== false, updatedAt: nowIso() });
    if (word) e.word = word;
    return { gained, fruits: c.fruits };
  }
  kids_copy_week({ p_token, p_week }) {
    const me = this.session(p_token, 'child');
    const t = today();
    const weeks = this.db.weeks.filter((w) => w.is_published && w.copy_ref && w.week_start <= t).map((w) => w.week_start).sort();
    if (!weeks.length) return { week: null, next_start: (this.db.weeks.filter((w) => w.is_published).map((w) => w.week_start).sort()[0]) || null };
    const want = weekOf(p_week && p_week < t ? p_week : t);
    const ws = weeks.filter((x) => x <= want).pop() || weeks[0];
    const w = this.db.weeks.find((x) => x.week_start === ws);
    const mine = this.db.copyEntries.find((e) => e.child === me && e.week === ws);
    const i = weeks.indexOf(ws);
    return {
      week: { week_start: ws, theme: w.theme, ref: w.copy_ref, intro: w.copy_intro, passage: w.copy_passage, is_current: ws === weekOf(t) },
      prev: i > 0 ? weeks[i - 1] : null,
      next: i < weeks.length - 1 ? weeks[i + 1] : null,
      mine: mine ? { note: mine.note, shared: mine.shared, hidden: mine.hidden, has_photo: !!mine.photo, photo_ok: !!mine.photo_ok, photo_paid: !!mine.photo_paid, thumb: imgGet(mine.thumb) } : null,
      friends: this.entriesFor(this.db.copyEntries, ws, 'week', 'copy', me, 'note').map((f) => {
        const e = this.db.copyEntries.find((x) => x.child === f.id && x.week === ws);
        const visible = e.photo && (f.me || (e.photo_ok && e.shared && !e.hidden));
        return { ...f, has_photo: !!e.photo, photo_wait: f.me && !!e.photo && !e.photo_ok, thumb: visible ? imgGet(e.thumb) : null };
      }),
    };
  }
  kids_copy_photo({ p_token, p_week, p_photo, p_thumb }) {
    const me = this.session(p_token, 'child');
    if (!this.db.weeks.some((w) => w.week_start === p_week && w.is_published && w.copy_ref) || p_week > today()) fail('NOT_FOUND');
    if (!isJpeg(p_photo) || !isJpeg(p_thumb)) fail('BAD_IMAGE');
    if (p_photo.length * 0.75 > 450000 || p_thumb.length * 0.75 > 40000) fail('IMAGE_TOO_BIG');
    const c = this.child(me);
    let e = this.db.copyEntries.find((x) => x.child === me && x.week === p_week);
    let gained = 0;
    // 공책 사진: 처음이면 열매 10개, 따라 쓰기로 2개를 이미 받았으면 8개 더 (한 주에 한 번)
    if (!e) { e = { child: me, week: p_week, note: '', shared: true, hidden: false, at: nowIso() }; this.db.copyEntries.push(e); gained = 10; }
    else if (!e.photo_paid) gained = 8;
    c.fruits += gained;
    e.photo_paid = true;
    const id = `p${me}${p_week}`;
    imgPut(this.db, id, p_photo);
    imgPut(this.db, id + 't', p_thumb);
    Object.assign(e, { photo: id, thumb: id + 't', photo_ok: false, updatedAt: nowIso() });
    return { gained, fruits: c.fruits };
  }
  kids_copy_photo_delete({ p_token, p_week }) {
    const me = this.session(p_token, 'child');
    const e = this.db.copyEntries.find((x) => x.child === me && x.week === p_week);
    if (e && e.photo) { imgDel(this.db, e.photo); imgDel(this.db, e.thumb); e.photo = null; e.thumb = null; e.photo_ok = false; }
    return { ok: true };
  }
  kids_copy_photo_get({ p_token, p_week, p_child }) {
    const me = this.session(p_token, 'child');
    const e = this.db.copyEntries.find((x) => x.child === p_child && x.week === p_week);
    if (!e || !e.photo || !(p_child === me || (e.photo_ok && e.shared && !e.hidden))) fail('NOT_FOUND');
    return { photo: imgGet(e.photo) || fail('NOT_FOUND') };
  }

  // ---------- 그림 공방 ----------
  artItem(a, me) {
    const c = this.db.children.find((x) => x.id === a.child);
    if (!c || !c.village_name) return null;
    return { id: a.id, child: c.id, name: c.village_name, avatar: c.avatar, me: c.id === me, title: a.title, at: a.at, thumb: imgGet(a.thumb),
      shared: a.shared, hidden: c.id === me ? a.hidden : false, reactions: this.reactions('art', a.id, c.id, me) };
  }
  kids_art_save({ p_token, p_title, p_image, p_thumb, p_shared }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    const title = String(p_title || '').trim();
    if (title.length > 20) fail('TOO_LONG');
    if (this.db.art.filter((a) => a.child === me).length >= 40) fail('ART_FULL');
    if (this.db.art.filter((a) => a.child === me && a.at >= startOfToday()).length >= 10) fail('ART_DAY');
    if (!isJpeg(p_image) || !isJpeg(p_thumb)) fail('BAD_IMAGE');
    const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    imgPut(this.db, id, p_image);
    imgPut(this.db, id + 't', p_thumb);
    this.db.art.push({ id, child: me, title, img: id, thumb: id + 't', shared: p_shared !== false, hidden: false, at: nowIso() });
    return { id };
  }
  kids_art_list({ p_token, p_mine }) {
    const me = this.session(p_token, 'child');
    return this.db.art.filter((a) => (p_mine ? a.child === me : a.shared && !a.hidden))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40).map((a) => this.artItem(a, me)).filter(Boolean);
  }
  // 그림 댓글
  artComments(me, artId) {
    return (this.db.artComments || []).filter((c) => c.art === artId && !c.hidden).slice(-60).map((c) => {
      const ch = this.db.children.find((x) => x.id === c.child) || {};
      return { id: c.id, name: ch.village_name, body: c.body, me: c.child === me, at: c.at };
    });
  }
  kids_art_comments({ p_token, p_art }) {
    const me = this.session(p_token, 'child');
    this.db.art.find((x) => x.id === p_art && (x.child === me || (x.shared && !x.hidden))) || fail('NOT_FOUND');
    return this.artComments(me, p_art);
  }
  kids_art_comment_add({ p_token, p_art, p_text }) {
    const me = this.session(p_token, 'child');
    if (!this.villageConf().chat_open) fail('CHAT_OFF');
    if (this.child(me).chat_muted) fail('CHAT_MUTED');
    this.db.art.find((x) => x.id === p_art && (x.child === me || (x.shared && !x.hidden))) || fail('NOT_FOUND');
    const t = cleanChat(p_text);
    if (!t) fail('EMPTY_CHAT');
    this.db.artComments = this.db.artComments || [];
    const last = this.db.artComments.filter((c) => c.child === me).map((c) => c.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 3000) fail('TOO_FAST');
    const raw = [...String(p_text || '').replace(/\s+/g, ' ').trim()].slice(0, 60).join('');
    this.db.artComments.push({ id: Date.now() + Math.random(), art: p_art, child: me, body: t, masked: t !== raw, hidden: false, at: nowIso() });
    return this.artComments(me, p_art);
  }
  kids_t_comment_hide({ p_token, p_id, p_hidden }) {
    this.session(p_token, 'teacher');
    const c = (this.db.artComments || []).find((x) => x.id === p_id) || fail('NOT_FOUND');
    c.hidden = !!p_hidden;
    return this.kids_t_village({ p_token });
  }
  kids_art_get({ p_token, p_id }) {
    const me = this.session(p_token, 'child');
    const a = this.db.art.find((x) => x.id === p_id && (x.child === me || (x.shared && !x.hidden))) || fail('NOT_FOUND');
    return { image: imgGet(a.img) || fail('NOT_FOUND') };
  }
  kids_art_update({ p_token, p_id, p_shared }) {
    const me = this.session(p_token, 'child');
    const a = this.db.art.find((x) => x.id === p_id && x.child === me) || fail('NOT_FOUND');
    a.shared = !!p_shared;
    return { ok: true };
  }
  kids_art_delete({ p_token, p_id }) {
    const me = this.session(p_token, 'child');
    const a = this.db.art.find((x) => x.id === p_id && x.child === me);
    if (a) { imgDel(this.db, a.img); imgDel(this.db, a.thumb); this.db.art = this.db.art.filter((x) => x !== a); }
    this.db.reactions = this.db.reactions.filter((r) => !(r.kind === 'art' && r.key === p_id));
    return { ok: true };
  }
  kids_art_wall({ p_token }) {
    this.session(p_token, 'child');
    return this.db.art.filter((a) => a.shared && !a.hidden).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6).map((a) => {
      const c = this.db.children.find((x) => x.id === a.child) || {};
      return { id: a.id, name: c.village_name, title: a.title, thumb: imgGet(a.thumb) };
    });
  }

  // ---------- 낚시 ----------
  kids_fish_catch({ p_token }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    const mine = this.db.fish.filter((f) => f.child === me);
    const last = mine.map((f) => f.at).sort().pop();
    if (last && Date.now() - new Date(last).getTime() < 3000) fail('TOO_FAST');
    if (mine.filter((f) => f.at >= startOfToday()).length >= 80) fail('FISH_TIRED');
    const total = FISH.reduce((a, f) => a + f.weight, 0);
    let r = Math.floor(Math.random() * total), k = FISH[0];
    for (const f of FISH) { if (r < f.weight) { k = f; break; } r -= f.weight; }
    const size = k.rarity < 0 ? 0 : Math.round((k.min + Math.random() * (k.max - k.min)) * 10) / 10;
    const same = mine.filter((f) => f.fish === k.id);
    const first = !same.length;
    const best = k.rarity >= 0 && !first && size > Math.max(...same.map((f) => f.size));
    this.db.fish.push({ child: me, fish: k.id, size, at: nowIso() });
    return { fish: k.id, name: k.name, rarity: k.rarity, size, first, best, today: mine.filter((f) => f.at >= startOfToday()).length + 1 };
  }
  // 3D 낚시: 다가오는 물고기를 먼저 정하고(hook), 제때 당기면 잡는다(land)
  kids_fish_hook({ p_token }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    this.fishPending = this.fishPending || {};
    const pnd = this.fishPending[me];
    if (pnd && Date.now() - pnd.t < 2000) fail('TOO_FAST');
    if (this.db.fish.filter((f) => f.child === me && f.at >= startOfToday()).length >= 80) fail('FISH_TIRED');
    const total = FISH.reduce((a, f) => a + f.weight, 0);
    let r = Math.floor(Math.random() * total), k = FISH[0];
    for (const f of FISH) { if (r < f.weight) { k = f; break; } r -= f.weight; }
    const size = k.rarity < 0 ? 0 : Math.round((k.min + Math.random() * (k.max - k.min)) * 10) / 10;
    this.fishPending[me] = { fish: k.id, size, t: Date.now() };
    return { fish: k.id, size, rarity: k.rarity };
  }
  kids_fish_land({ p_token }) {
    const me = this.session(p_token, 'child');
    const pnd = this.fishPending && this.fishPending[me];
    if (!pnd || Date.now() - pnd.t > 60000) { if (this.fishPending) delete this.fishPending[me]; fail('NO_FISH'); }
    delete this.fishPending[me];
    const k = FISH.find((f) => f.id === pnd.fish);
    const mine = this.db.fish.filter((f) => f.child === me);
    const same = mine.filter((f) => f.fish === k.id);
    const first = !same.length;
    const best = k.rarity >= 0 && !first && pnd.size > Math.max(...same.map((f) => f.size));
    this.db.fish.push({ child: me, fish: k.id, size: pnd.size, at: nowIso() });
    return { fish: k.id, name: k.name, rarity: k.rarity, size: pnd.size, first, best, today: mine.filter((f) => f.at >= startOfToday()).length + 1 };
  }
  kids_fish_book({ p_token }) {
    const me = this.session(p_token, 'child');
    const mine = {};
    for (const f of this.db.fish.filter((x) => x.child === me)) {
      const m = mine[f.fish] || (mine[f.fish] = { count: 0, best: 0 });
      m.count++; m.best = Math.max(m.best, f.size);
    }
    const kinds = Object.fromEntries(FISH.map((f) => [f.id, f]));
    const today_top = this.db.fish.filter((f) => f.at >= startOfToday() && kinds[f.fish] && kinds[f.fish].rarity >= 0)
      .sort((a, b) => b.size - a.size || a.at.localeCompare(b.at)).slice(0, 5).map((f) => {
        const c = this.db.children.find((x) => x.id === f.child) || {};
        return { name: c.village_name, avatar: c.avatar, me: f.child === me, fish: f.fish, size: f.size, at: f.at };
      }).filter((t) => t.name);
    return { mine, today_top, my_today: this.db.fish.filter((f) => f.child === me && f.at >= startOfToday()).length };
  }

  // ---------- 요리 ----------
  kids_cook_book({ p_token }) {
    const me = this.session(p_token, 'child');
    return (this.db.cook && this.db.cook[me]) || {};
  }
  kids_cook_done({ p_token, p_recipe, p_stars, p_together }) {
    const me = this.session(p_token, 'child');
    this.gate(me);
    if (!['manna', 'lentil', 'fishbread', 'barley', 'matzah'].includes(p_recipe)) fail('NOT_FOUND');
    if (!(p_stars >= 1 && p_stars <= 3)) fail('BAD_STARS');
    this.db.cook = this.db.cook || {};
    const b = this.db.cook[me] || (this.db.cook[me] = {});
    const r = b[p_recipe] || (b[p_recipe] = { stars: 0, times: 0, with_friend: 0 });
    r.stars = Math.max(r.stars, p_stars); r.times++; if (p_together) r.with_friend++;
    return b;
  }
  kids_copy_save({ p_token, p_week, p_note, p_shared }) {
    const me = this.session(p_token, 'child');
    if (!this.db.weeks.some((w) => w.week_start === p_week && w.is_published && w.copy_ref) || p_week > today()) fail('NOT_FOUND');
    const note = String(p_note || '').trim();
    if (note.length > 300) fail('TOO_LONG');
    const c = this.child(me);
    let e = this.db.copyEntries.find((x) => x.child === me && x.week === p_week);
    let gained = 0;
    if (!e) { e = { child: me, week: p_week, hidden: false, at: nowIso() }; this.db.copyEntries.push(e); gained = 2; c.fruits += 2; }
    Object.assign(e, { note, shared: p_shared !== false, updatedAt: nowIso() });
    return { gained, fruits: c.fruits };
  }
  kids_react({ p_token, p_kind, p_target, p_key, p_reaction, p_on }) {
    const me = this.session(p_token, 'child');
    if (!['memory', 'qt', 'copy', 'art'].includes(p_kind) || !['clap', 'heart', 'pray', 'metoo'].includes(p_reaction)) fail('BAD_REACTION');
    if (p_target === me) fail('SELF_REACTION');
    if (p_kind === 'art' && !this.db.art.some((a) => a.id === p_key && a.child === p_target && a.shared && !a.hidden)) fail('NOT_FOUND');
    const i = this.db.reactions.findIndex((r) => r.kind === p_kind && r.target === p_target && r.key === p_key && r.from === me && r.r === p_reaction);
    if (p_on && i < 0) this.db.reactions.push({ kind: p_kind, target: p_target, key: p_key, from: me, r: p_reaction });
    if (!p_on && i >= 0) this.db.reactions.splice(i, 1);
    return this.reactions(p_kind, p_key, p_target, me);
  }

  // ---------- 선생님 ----------
  kids_teacher_setup_needed() { return false; }
  kids_teacher_setup() { return { ok: false, error: 'ALREADY' }; }
  kids_teacher_login({ p_login_id, p_password }) {
    const t = this.db.teachers.find((x) => x.login_id.toLowerCase() === String(p_login_id || '').trim().toLowerCase());
    if (!t || t.pw !== p_password) return { ok: false, error: 'LOGIN_FAILED' };
    return { ok: true, token: this.newSession('teacher', t.id) };
  }
  kids_t_overview({ p_token }) {
    const tid = this.session(p_token, 'teacher');
    const me = this.db.teachers.find((t) => t.id === tid);
    const cur = this.currentVerse();
    return {
      me: { id: me.id, login_id: me.login_id, name: me.name },
      children: [...this.db.children].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((c) => ({
        id: c.id, login_id: c.login_id, name: c.name, birthdate: c.birthdate, consent_date: c.consent_date, village_name: c.village_name,
        avatar: c.avatar, fruits: c.fruits, last_seen_at: c.last_seen_at, locked: false,
        joined_self: !!c.joined_self, consent_checked: c.consent_checked !== false,
        qt_count: this.db.qtEntries.filter((e) => e.child === c.id).length,
        copy_count: this.db.copyEntries.filter((e) => e.child === c.id).length,
        memory: Object.entries(c.memory).map(([verse_id, m]) => ({ verse_id, practice_count: m.practice_count, best_score: m.best_score, passed: !!m.passed, last_practiced_on: m.last })),
      })),
      verses: [...this.db.verses].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ ...v, is_current: v.id === cur })),
      teachers: this.db.teachers.map((t) => ({ id: t.id, login_id: t.login_id, name: t.name })),
    };
  }
  checkChild(login, pin, name, birth, selfId) {
    const l = String(login || '').trim();
    if (!ID_RE.test(l)) fail('BAD_LOGIN_ID');
    if (pin !== undefined && !/^[0-9]{4,6}$/.test(pin || '')) fail('BAD_PIN');
    const n = String(name || '').trim();
    if (n.length < 1 || n.length > 20) fail('BAD_NAME');
    if (!birth || birth < '1990-01-01' || birth > iso(new Date())) fail('BAD_BIRTHDATE');
    if (this.db.children.some((c) => c.login_id.toLowerCase() === l.toLowerCase() && c.id !== selfId)) fail('DUPLICATE_ID');
    return { l, n };
  }
  kids_t_create_child({ p_token, p_login_id, p_pin, p_name, p_birthdate, p_consent_date }) {
    this.session(p_token, 'teacher');
    const { l, n } = this.checkChild(p_login_id, p_pin, p_name, p_birthdate);
    if (!p_consent_date || p_consent_date > iso(new Date())) fail('NO_CONSENT');
    const id = 'c' + Date.now();
    this.db.children.push({ id, login_id: l, pin: p_pin, name: n, birthdate: p_birthdate, consent_date: p_consent_date, village_name: null, avatar: null, fruits: 0, last_seen_at: null, memory: {} });
    return { id };
  }
  kids_t_update_child({ p_token, p_id, p_login_id, p_name, p_birthdate }) {
    this.session(p_token, 'teacher');
    const c = this.child(p_id);
    const { l, n } = this.checkChild(p_login_id, undefined, p_name, p_birthdate, p_id);
    Object.assign(c, { login_id: l, name: n, birthdate: p_birthdate });
    return { ok: true };
  }
  kids_t_reset_pin({ p_token, p_id, p_pin }) {
    this.session(p_token, 'teacher');
    if (!/^[0-9]{4,6}$/.test(p_pin || '')) fail('BAD_PIN');
    this.child(p_id).pin = p_pin;
    for (const [k, s] of Object.entries(this.db.sessions)) if (s.kind === 'child' && s.id === p_id) delete this.db.sessions[k];
    return { ok: true };
  }
  kids_t_delete_child({ p_token, p_id }) {
    this.session(p_token, 'teacher');
    this.db.children = this.db.children.filter((c) => c.id !== p_id);
    this.db.qtEntries = this.db.qtEntries.filter((e) => e.child !== p_id);
    this.db.copyEntries = this.db.copyEntries.filter((e) => e.child !== p_id);
    this.db.reactions = this.db.reactions.filter((r) => r.target !== p_id && r.from !== p_id);
    for (const a of this.db.art.filter((x) => x.child === p_id)) { imgDel(this.db, a.img); imgDel(this.db, a.thumb); }
    this.db.art = this.db.art.filter((x) => x.child !== p_id);
    this.db.fish = this.db.fish.filter((x) => x.child !== p_id);
    if (this.db.cook) delete this.db.cook[p_id];
    return { ok: true };
  }
  kids_t_save_verse({ p_token, p_id, p_ref, p_body, p_sort, p_published }) {
    this.session(p_token, 'teacher');
    const ref = String(p_ref || '').trim(), body = String(p_body || '').trim();
    if (ref.length < 1 || ref.length > 60) fail('BAD_REF');
    if (body.length < 1 || body.length > 1000) fail('BAD_BODY');
    if (!p_id) {
      const id = 'v' + Date.now() + Math.floor(Math.random() * 1000);
      this.db.verses.push({ id, ref, body, version: '개역한글', sort_order: p_sort ?? 0, is_current: false, is_published: !!p_published });
      return { id };
    }
    const v = this.db.verses.find((x) => x.id === p_id) || fail('NOT_FOUND');
    Object.assign(v, { ref, body, sort_order: p_sort ?? v.sort_order, is_published: p_published ?? v.is_published });
    if (!v.is_published) v.is_current = false;
    return { id: v.id };
  }
  kids_t_delete_verse({ p_token, p_id }) {
    this.session(p_token, 'teacher');
    this.db.verses = this.db.verses.filter((v) => v.id !== p_id);
    return { ok: true };
  }
  kids_t_set_current({ p_token, p_id }) {
    this.session(p_token, 'teacher');
    const v = this.db.verses.find((x) => x.id === p_id && x.is_published) || fail('NOT_PUBLISHED');
    for (const x of this.db.verses) x.is_current = false;
    v.is_current = true;
    return { ok: true };
  }
  kids_t_set_pass({ p_token, p_child_id, p_verse_id, p_passed }) {
    this.session(p_token, 'teacher');
    const c = this.child(p_child_id);
    const m = c.memory[p_verse_id] || (c.memory[p_verse_id] = { practice_count: 0, best_score: 0, passed: false, last: null, first: null });
    if (p_passed && !m.passed) { m.passed = true; m.first = m.first || nowIso(); c.fruits += 10; }
    if (!p_passed && m.passed) { m.passed = false; c.fruits = Math.max(0, c.fruits - 10); }
    return { ok: true, fruits: c.fruits };
  }
  kids_t_create_teacher({ p_token, p_login_id, p_password, p_name }) {
    this.session(p_token, 'teacher');
    const l = String(p_login_id || '').trim();
    if (!ID_RE.test(l)) fail('BAD_LOGIN_ID');
    if ((p_password || '').length < 8) fail('WEAK_PASSWORD');
    if (this.db.teachers.some((t) => t.login_id.toLowerCase() === l.toLowerCase())) fail('DUPLICATE_ID');
    const id = 't' + Date.now();
    this.db.teachers.push({ id, login_id: l, pw: p_password, name: String(p_name || '').trim() || l });
    return { id };
  }
  kids_t_change_password({ p_token, p_old, p_new }) {
    const t = this.db.teachers.find((x) => x.id === this.session(p_token, 'teacher'));
    if (t.pw !== p_old) fail('WRONG_PASSWORD');
    if ((p_new || '').length < 8) fail('WEAK_PASSWORD');
    t.pw = p_new;
    return { ok: true };
  }
  kids_t_delete_teacher({ p_token, p_id }) {
    if (this.session(p_token, 'teacher') === p_id) fail('CANNOT_DELETE_SELF');
    this.db.teachers = this.db.teachers.filter((t) => t.id !== p_id);
    return { ok: true };
  }
  kids_t_weeks({ p_token }) {
    this.session(p_token, 'teacher');
    return [...this.db.weeks].sort((a, b) => a.week_start.localeCompare(b.week_start)).map((w) => ({
      ...w,
      days: this.db.qt.filter((q) => q.week_start === w.week_start).sort((a, b) => a.day.localeCompare(b.day))
        .map((q) => ({ ...q, done_count: this.db.qtEntries.filter((e) => e.day === q.day).length })),
      copy_count: this.db.copyEntries.filter((e) => e.week === w.week_start).length,
    }));
  }
  kids_t_save_week({ p_token, p_week, p_theme, p_verse_id, p_copy_ref, p_copy_intro, p_copy_passage }) {
    this.session(p_token, 'teacher');
    if (!p_week || new Date(p_week + 'T00:00:00').getDay() !== 0) fail('BAD_WEEK');
    if (!Array.isArray(p_copy_passage)) fail('BAD_PASSAGE');
    let w = this.db.weeks.find((x) => x.week_start === p_week);
    if (!w) { w = { week_start: p_week, is_published: false }; this.db.weeks.push(w); }
    Object.assign(w, { theme: String(p_theme || '').trim(), verse_id: p_verse_id || null, copy_ref: String(p_copy_ref || '').trim(),
      copy_intro: String(p_copy_intro || '').trim(), copy_passage: p_copy_passage });
    return { ok: true };
  }
  kids_t_save_qt({ p_token, p_day, p_title, p_ref, p_passage, p_questions, p_prayer, p_action, p_note }) {
    this.session(p_token, 'teacher');
    const ws = weekOf(p_day);
    if (!this.db.weeks.some((w) => w.week_start === ws)) fail('NO_WEEK');
    if (!Array.isArray(p_passage)) fail('BAD_PASSAGE');
    if (!Array.isArray(p_questions) || p_questions.length > 5) fail('BAD_QUESTIONS');
    let q = this.db.qt.find((x) => x.day === p_day);
    if (!q) { q = { day: p_day, week_start: ws }; this.db.qt.push(q); }
    Object.assign(q, { title: p_title, ref: p_ref, passage: p_passage, questions: p_questions, prayer: p_prayer, action: p_action });
    if (p_note != null) q.note = String(p_note).trim();
    return { ok: true };
  }
  kids_t_publish_week({ p_token, p_week, p_published }) {
    this.session(p_token, 'teacher');
    const w = this.db.weeks.find((x) => x.week_start === p_week) || fail('NOT_FOUND');
    w.is_published = !!p_published;
    if (w.is_published && w.verse_id) { const v = this.db.verses.find((x) => x.id === w.verse_id); if (v) v.is_published = true; }
    return { ok: true };
  }
  kids_t_posts({ p_token }) {
    this.session(p_token, 'teacher');
    const name = (id) => this.db.children.find((c) => c.id === id) || {};
    const qt = this.db.qtEntries.map((e) => ({ kind: 'qt', key: e.day, child_id: e.child, name: name(e.child).name, village_name: name(e.child).village_name,
      label: (this.db.qt.find((q) => q.day === e.day) || {}).ref, text: e.answer, shared: e.shared, hidden: e.hidden, at: e.at }));
    const cp = this.db.copyEntries.filter((e) => e.note || e.photo).map((e) => ({ kind: 'copy', key: e.week, child_id: e.child, name: name(e.child).name, village_name: name(e.child).village_name,
      label: (this.db.weeks.find((w) => w.week_start === e.week) || {}).copy_ref, text: e.note, shared: e.shared, hidden: e.hidden, at: e.at,
      has_photo: !!e.photo, photo_ok: !!e.photo_ok, thumb: imgGet(e.thumb) }));
    const art = this.db.art.map((a) => ({ kind: 'art', key: a.id, child_id: a.child, name: name(a.child).name, village_name: name(a.child).village_name,
      label: a.title || '제목 없는 그림', text: null, shared: a.shared, hidden: a.hidden, at: a.at, thumb: imgGet(a.thumb) }));
    return [...qt, ...cp, ...art].sort((a, b) => b.at.localeCompare(a.at));
  }
  kids_t_village({ p_token }) {
    this.session(p_token, 'teacher');
    const v = this.villageConf();
    return {
      today: today(), chat_open: v.chat_open, free_until: v.free_until, play_free: this.playFree(),
      chat: (this.db.chat || []).slice().reverse().slice(0, 200).map((m) => {
        const c = this.db.children.find((x) => x.id === m.child) || {};
        const t = m.to ? this.db.children.find((x) => x.id === m.to) || {} : null;
        return { id: m.id, child: m.child, name: c.name, village_name: c.village_name, to_name: t && t.name, to_village_name: t && t.village_name, body: m.body, masked: m.masked, muted: !!c.chat_muted, at: m.at };
      }),
      muted: this.db.children.filter((c) => c.chat_muted).map((c) => ({ id: c.id, name: c.name, village_name: c.village_name })),
      comments: (this.db.artComments || []).slice().reverse().slice(0, 100).map((m) => {
        const c = this.db.children.find((x) => x.id === m.child) || {};
        const a = this.db.art.find((x) => x.id === m.art) || {};
        const o = this.db.children.find((x) => x.id === a.child) || {};
        return { id: m.id, child: m.child, name: c.name, village_name: c.village_name, art_title: a.title, art_owner: o.village_name, body: m.body, masked: m.masked, hidden: m.hidden, muted: !!c.chat_muted, at: m.at };
      }),
      dishes: (this.db.dishes || []).slice().reverse().slice(0, 60).map((d) => {
        const c = this.db.children.find((x) => x.id === d.child) || {};
        return { id: d.id, name: d.name, kind: d.kind, child_name: c.name, village_name: c.village_name, hidden: d.hidden, at: d.at, eaten: this.dishEaters(d.id).length };
      }),
      shop: (this.db.shopLog || []).slice().reverse().slice(0, 100).map((l) => {
        const c = this.db.children.find((x) => x.id === l.child) || {};
        return { id: l.id, name: c.name, village_name: c.village_name, item: l.item, n: l.n, price: l.price, fruits_left: c.fruits, at: l.at };
      }),
    };
  }
  kids_t_set_village({ p_token, p_chat_open, p_free_today }) {
    this.session(p_token, 'teacher');
    const v = this.villageConf();
    if (p_chat_open != null) v.chat_open = !!p_chat_open;
    if (p_free_today != null) v.free_until = p_free_today ? today() : '';
    return this.kids_t_village({ p_token });
  }
  kids_t_chat_mute({ p_token, p_child, p_mute }) {
    this.session(p_token, 'teacher');
    this.child(p_child).chat_muted = !!p_mute;
    return this.kids_t_village({ p_token });
  }
  kids_t_signup({ p_token }) { this.session(p_token, 'teacher'); return { ...this.signupConf() }; }
  kids_t_set_signup({ p_token, p_open, p_code }) {
    this.session(p_token, 'teacher');
    const conf = this.signupConf();
    if (p_code != null) {
      const c = String(p_code).trim();
      if (!/^[가-힣A-Za-z0-9]{4,12}$/.test(c)) fail('BAD_JOIN_CODE_FORMAT');
      conf.code = c;
    }
    if (p_open != null) conf.open = !!p_open;
    return { ...conf };
  }
  kids_t_check_consent({ p_token, p_child, p_date }) {
    this.session(p_token, 'teacher');
    if (!p_date || p_date > iso(new Date())) fail('NO_CONSENT');
    const c = this.child(p_child);
    c.consent_checked = true;
    c.consent_date = p_date;
    return { ok: true };
  }
  kids_t_photo_ok({ p_token, p_child, p_week, p_ok }) {
    this.session(p_token, 'teacher');
    const e = this.db.copyEntries.find((x) => x.child === p_child && x.week === p_week && x.photo) || fail('NOT_FOUND');
    e.photo_ok = !!p_ok;
    return { ok: true };
  }
  kids_t_image({ p_token, p_kind, p_child, p_key }) {
    this.session(p_token, 'teacher');
    let id = null;
    if (p_kind === 'copy') id = (this.db.copyEntries.find((x) => x.child === p_child && x.week === p_key) || {}).photo;
    if (p_kind === 'art') id = (this.db.art.find((x) => x.child === p_child && x.id === p_key) || {}).img;
    return { image: imgGet(id) || fail('NOT_FOUND') };
  }
  kids_t_storage({ p_token }) {
    this.session(p_token, 'teacher');
    let bytes = 0;
    for (const id of this.db.imgs || []) bytes += Math.floor(((imgGet(id) || '').length * 3) / 4);
    return { photos: this.db.copyEntries.filter((e) => e.photo).length, drawings: this.db.art.length, bytes, db_bytes: 12 * 1024 * 1024 + bytes };
  }
  kids_t_hide_post({ p_token, p_kind, p_child, p_key, p_hidden }) {
    this.session(p_token, 'teacher');
    if (p_kind === 'art') {
      const a = this.db.art.find((x) => x.child === p_child && x.id === p_key);
      if (a) a.hidden = !!p_hidden;
      return { ok: true };
    }
    const list = p_kind === 'qt' ? this.db.qtEntries : this.db.copyEntries;
    const e = list.find((x) => x.child === p_child && (p_kind === 'qt' ? x.day : x.week) === p_key);
    if (e) e.hidden = !!p_hidden;
    return { ok: true };
  }
}
