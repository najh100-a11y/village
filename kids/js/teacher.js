// 진숲 어린이 마을 — 선생님 화면
import { rpc, message, DEMO, store } from './api.js';
import { h, showImage } from './ui.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';

const $ = (s) => document.querySelector(s);
let token = store.get('teacher.token');
let data = null;
let weeks = [];
let posts = [];
const openWeeks = new Set();
let tab = 'kids';

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function age(birth) {
  const b = new Date(birth + 'T00:00:00');
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
function birthLabel(birth) {
  const [, m, d] = birth.split('-').map(Number);
  return `${m}월 ${d}일생 · 만 ${age(birth)}세`;
}
function ago(iso) {
  if (!iso) return '아직 안 들어옴';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return '방금 전';
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
// 두 번 눌러야 지워지는 버튼
function confirmButton(label, confirmLabel, onConfirm, cls = 'btn btn-sm') {
  const b = h('button', { class: cls, type: 'button' }, label);
  let armed = false, timer = null;
  b.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      b.className = 'btn btn-sm btn-danger';
      b.textContent = confirmLabel;
      timer = setTimeout(() => { armed = false; b.className = cls; b.textContent = label; }, 4000);
      return;
    }
    clearTimeout(timer);
    b.disabled = true;
    await onConfirm();
  });
  return b;
}
async function call(fn, args, errEl) {
  if (errEl) errEl.textContent = '';
  try {
    return await rpc(fn, { p_token: token, ...args });
  } catch (e) {
    if (e.code === 'SESSION') { logoutLocal(); toast('다시 로그인해 주세요.'); throw e; }
    if (errEl) errEl.textContent = message(e); else toast(message(e));
    throw e;
  }
}

// ---------- 시작 ----------
async function boot() {
  if (DEMO) $('#demoNote').hidden = false;
  bind();
  if (token) {
    try { await refresh(); return showMain(); } catch (e) { token = null; store.del('teacher.token'); }
  }
  let needSetup = false;
  try { needSetup = await rpc('kids_teacher_setup_needed', {}); } catch (e) { $('#loginErr').textContent = message(e); }
  $(needSetup ? '#setupView' : '#loginView').hidden = false;
}

function bind() {
  $('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#setupErr');
    err.textContent = '';
    try {
      const r = await rpc('kids_teacher_setup', { p_code: $('#setupCode').value, p_login_id: $('#setupId').value, p_password: $('#setupPw').value, p_name: $('#setupName').value });
      if (!r.ok) { err.textContent = message({ code: r.error }); return; }
      loginDone(r.token);
    } catch (e2) { err.textContent = message(e2); }
  });
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginErr');
    err.textContent = '';
    try {
      const r = await rpc('kids_teacher_login', { p_login_id: $('#loginId').value, p_password: $('#loginPw').value });
      if (!r.ok) { err.textContent = r.error === 'LOCKED' ? '여러 번 틀려서 15분 동안 잠겼어요.' : message({ code: r.error }); return; }
      loginDone(r.token);
    } catch (e2) { err.textContent = message(e2); }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await rpc('kids_logout', { p_token: token }); } catch (e) { /* 무시 */ }
    logoutLocal();
  });
  for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('#addKidBtn').addEventListener('click', () => {
    $('#kidForm').hidden = false;
    $('#newCard').hidden = true;
    $('#kConsent').value = todayStr();
    $('#kName').focus();
  });
  $('#kCancel').addEventListener('click', () => { $('#kidForm').hidden = true; $('#kidForm').reset(); });
  $('#kidForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#kName').value.trim(), id = $('#kId').value.trim(), pin = $('#kPin').value.trim();
    try {
      await call('kids_t_create_child', { p_login_id: id, p_pin: pin, p_name: name, p_birthdate: $('#kBirth').value, p_consent_date: $('#kConsent').value }, $('#kErr'));
    } catch (e2) { return; }
    $('#kidForm').reset();
    $('#kidForm').hidden = true;
    const card = $('#newCard');
    card.replaceChildren(h('div', { class: 'card', style: 'display:grid;gap:10px' },
      h('p', { class: 'note' }, h('b', {}, name), ' 계정을 만들었어요. 아래 아이디와 비밀번호를 아이에게 알려 주세요. 비밀번호는 지금 한 번만 보여요.'),
      h('div', { class: 'cardline' }, h('span', {}, '아이디'), id, h('span', {}, '비밀번호'), pin),
      h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { card.hidden = true; } }, '확인했어요'))));
    card.hidden = false;
    await refresh();
  });
  $('#chatRefresh').addEventListener('click', () => reloadVillage());
  $('#addVerseBtn').addEventListener('click', () => {
    const list = $('#verseList');
    const max = Math.max(0, ...data.verses.map((v) => v.sort_order));
    list.prepend(verseEditor({ id: null, ref: '', body: '', sort_order: max + 1, is_published: false, is_current: false }));
    list.querySelector('input').focus();
  });
  $('#teacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await call('kids_t_create_teacher', { p_login_id: $('#tId').value, p_password: $('#tPw').value, p_name: $('#tName').value }, $('#tErr')); } catch (e2) { return; }
    $('#teacherForm').reset();
    toast('선생님 계정을 더했어요.');
    await refresh();
  });
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await call('kids_t_change_password', { p_old: $('#pOld').value, p_new: $('#pNew').value }, $('#pErr')); } catch (e2) { return; }
    $('#pwForm').reset();
    toast('비밀번호를 바꿨어요. 다른 기기에서는 다시 로그인해야 해요.');
  });
  $('#dlgClose').addEventListener('click', () => $('#kidDlg').close());
}

function loginDone(t) {
  token = t;
  store.set('teacher.token', t);
  $('#setupView').hidden = true;
  $('#loginView').hidden = true;
  refresh().then(showMain).catch(() => {});
}
function logoutLocal() {
  token = null;
  store.del('teacher.token');
  $('#mainView').hidden = true;
  $('#meBox').hidden = true;
  $('#loginView').hidden = false;
}

async function refresh() {
  await checkLectio();
  const [o, w, p, st, su] = await Promise.all([
    rpc('kids_t_overview', { p_token: token }),
    rpc('kids_t_weeks', { p_token: token }),
    rpc('kids_t_posts', { p_token: token }),
    rpc('kids_t_storage', { p_token: token }).catch(() => null),
    rpc('kids_t_signup', { p_token: token }).catch(() => null),
    rpc('kids_t_village', { p_token: token }).catch(() => null),
  ]).then((r) => { villageConf = r[5]; return r; });
  signup = su;
  data = o;
  weeks = w || [];
  posts = p || [];
  storage = st;
  render();
}
function showMain() {
  $('#mainView').hidden = false;
  $('#meBox').hidden = false;
  showTab(tab);
}
function showTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  for (const id of ['kids', 'weeks', 'posts', 'verses', 'village', 'teachers']) $(`#tab-${id}`).hidden = id !== t;
}

// ---------- 그리기 ----------
function render() {
  $('#meName').textContent = data.me.name;
  $('#kidCount').textContent = `(${data.children.length})`;
  $('#verseCount').textContent = `(${data.verses.length})`;
  $('#weekCount').textContent = weeks.length ? `(${weeks.filter((w) => w.is_published).length}/${weeks.length})` : '';
  $('#postCount').textContent = posts.length ? `(${posts.length})` : '';
  renderKids();
  renderWeeks();
  renderPosts();
  renderVerses();
  renderVillage();
  renderTeachers();
}

// ---------- 마을 설정과 대화 ----------
let villageConf = null;
const timeOf = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
async function reloadVillage() {
  try { villageConf = await call('kids_t_village', {}); } catch (e) { return; }
  renderVillage();
}
function renderVillage() {
  const box = $('#villageBox');
  const list = $('#chatList');
  const v = villageConf;
  if (!v) { box.replaceChildren(h('p', { class: 'note' }, '마을 설정을 불러오지 못했어요.')); list.replaceChildren(); return; }
  $('#chatCount').textContent = v.chat.length ? `(${v.chat.length})` : '';
  const sw = (checked, label, onChange) => {
    const input = h('input', { type: 'checkbox', checked, 'aria-label': label });
    input.addEventListener('change', async () => {
      input.disabled = true;
      try { villageConf = await onChange(input.checked); } catch (e) { input.checked = !input.checked; input.disabled = false; return; }
      renderVillage();
    });
    return h('label', { class: 'switch' }, input, checked ? '켜짐' : '꺼짐');
  };
  box.replaceChildren(
    h('div', { class: 'village-row' },
      h('div', {}, h('h3', { style: 'margin:0' }, '글 대화'),
        h('p', { class: 'note' }, '아이들이 마을에서 직접 글을 써서 이야기해요. 끄면 정해진 말풍선과 이모티콘으로만 말해요.')),
      sw(v.chat_open, '글 대화 켜기', (on) => call('kids_t_set_village', { p_chat_open: on, p_free_today: null }))),
    h('div', { class: 'village-row' },
      h('div', {}, h('h3', { style: 'margin:0' }, '오늘은 누구나 놀이 마당'),
        h('p', { class: 'note' }, v.play_free ? `오늘(${v.today})은 말씀 활동을 안 해도 누구나 낚시, 오목, 그림, 요리를 할 수 있어요. 내일부터는 저절로 평소대로 돌아가요.` : '평소에는 그날 암송 연습, 묵상, 필사 가운데 하나를 마쳐야 놀이 마당이 열려요. 첫날이나 행사 날처럼 오늘만 누구나 놀게 하려면 켜 주세요.')),
      sw(v.play_free, '오늘은 누구나 놀이 마당', (on) => call('kids_t_set_village', { p_chat_open: null, p_free_today: on }))),
    ...(v.muted.length ? [h('p', { class: 'note warn' }, '글 대화를 막아 둔 아이: ', v.muted.map((c) => `${c.name}(${c.village_name || '-'})`).join(', '))] : []));
  const dl = $('#dishList');
  const dishes = v.dishes || [];
  const KIND = { soup: '국', fry: '볶음', grill: '구이', salad: '샐러드' };
  dl.replaceChildren(...(dishes.length ? dishes.map((d) => h('div', { class: 'chat-row' },
    h('time', { datetime: d.at }, timeOf(d.at)),
    h('div', {}, h('span', { class: 'who' }, d.child_name || '-', h('small', {}, d.village_name || '')), ' ',
      d.hidden ? h('span', { class: 'pill red' }, '숨김') : h('span', { class: 'pill green' }, KIND[d.kind] || ''),
      h('div', { class: 'body' }, d.name, d.eaten ? h('small', { class: 'muted' }, `  · 먹은 친구 ${d.eaten}명`) : null)),
    h('button', { class: 'btn btn-sm' + (d.hidden ? '' : ' btn-ghost'), type: 'button', onclick: async () => {
      try { villageConf = await call('kids_t_dish_hide', { p_id: d.id, p_hidden: !d.hidden }); } catch (e) { return; }
      toast(d.hidden ? '다시 식탁에 올렸어요.' : '식탁에서 숨겼어요.');
      renderVillage();
    } }, d.hidden ? '다시 보이기' : '숨기기'))) : [h('div', { class: 'card empty' }, '아직 올린 요리가 없어요.')]));
  const sl = $('#shopList');
  const ITEM = { fw_spark: '반짝 불꽃', fw_flower: '꽃 불꽃', fw_heart: '하트 불꽃', pet_dog: '애완동물 강아지', pet_cat: '애완동물 고양이', pet_rabbit: '애완동물 토끼', pet_chick: '애완동물 병아리' };
  const shop = v.shop || [];
  if (sl) sl.replaceChildren(...(shop.length ? shop.map((l) => h('div', { class: 'chat-row' },
    h('time', { datetime: l.at }, timeOf(l.at)),
    h('div', {}, h('span', { class: 'who' }, l.name || '-', h('small', {}, l.village_name || '')), ' ',
      h('span', { class: 'pill' }, `열매 ${l.price}개`),
      h('div', { class: 'body' }, `${ITEM[l.item] || l.item} ${l.n}개`, h('small', { class: 'muted' }, `  · 지금 남은 열매 ${l.fruits_left}개`))))) : [h('div', { class: 'card empty' }, '아직 산 것이 없어요.')]));
  const cl = $('#commentList');
  const cms = v.comments || [];
  if (cl) cl.replaceChildren(...(cms.length ? cms.map((c) => h('div', { class: 'chat-row' },
    h('time', { datetime: c.at }, timeOf(c.at)),
    h('div', {}, h('span', { class: 'who' }, c.name || '-', h('small', {}, c.village_name || '')), ' ',
      h('span', { class: 'pill' }, `${c.art_owner || '친구'}의 그림${c.art_title ? ` ‘${c.art_title}’` : ''}`), ' ',
      c.masked ? h('span', { class: 'pill red' }, '가림') : null, c.hidden ? h('span', { class: 'pill red' }, '숨김') : null,
      h('div', { class: 'body' }, c.body)),
    h('button', { class: 'btn btn-sm' + (c.hidden ? '' : ' btn-ghost'), type: 'button', onclick: async () => {
      try { villageConf = await call('kids_t_comment_hide', { p_id: c.id, p_hidden: !c.hidden }); } catch (e) { return; }
      toast(c.hidden ? '댓글을 다시 보이게 했어요.' : '댓글을 숨겼어요.');
      renderVillage();
    } }, c.hidden ? '다시 보이기' : '숨기기'))) : [h('div', { class: 'card empty' }, '아직 그림 댓글이 없어요.')]));
  if (!v.chat.length) { list.replaceChildren(h('div', { class: 'card empty' }, '아직 아이들이 쓴 글이 없어요.')); return; }
  list.replaceChildren(...v.chat.map((m) => h('div', { class: 'chat-row' },
    h('time', { datetime: m.at }, timeOf(m.at)),
    h('div', {}, h('span', { class: 'who' }, m.name || '-', h('small', {}, m.village_name || '')), ' ',
      m.to_name ? h('span', { class: 'pill' }, `→ ${m.to_name}에게 둘이 대화`) : null, ' ',
      m.masked ? h('span', { class: 'pill red' }, '가림') : null,
      h('div', { class: 'body' }, m.body)),
    h('button', { class: 'btn btn-sm' + (m.muted ? '' : ' btn-ghost'), type: 'button', onclick: async () => {
      try { villageConf = await call('kids_t_chat_mute', { p_child: m.child, p_mute: !m.muted }); } catch (e) { return; }
      toast(m.muted ? `${m.name}의 글 대화를 다시 열었어요.` : `${m.name}의 글 대화를 막았어요.`);
      renderVillage();
    } }, m.muted ? '막기 풀기' : '글 대화 막기'))));
}

let signup = null;
function renderSignup() {
  const box = $('#signupBox');
  if (!signup) { box.hidden = true; return; }
  box.hidden = false;
  const sw = h('input', { type: 'checkbox', checked: signup.open, 'aria-label': '아이 직접 가입 받기' });
  sw.addEventListener('change', async () => {
    sw.disabled = true;
    try { signup = await call('kids_t_set_signup', { p_open: sw.checked, p_code: null }); } catch (e) { sw.checked = !sw.checked; sw.disabled = false; return; }
    toast(sw.checked ? '아이들이 직접 가입할 수 있어요.' : '직접 가입을 껐어요.');
    renderSignup();
  });
  const code = h('input', { value: signup.code || '', maxlength: 12, 'aria-label': '새 가입 코드' });
  const err = h('p', { class: 'err', role: 'alert' });
  box.replaceChildren(
    h('div', { class: 'signup-head' },
      h('div', {}, h('h3', {}, '아이 직접 가입'),
        h('p', { class: 'note' }, '아이가 마을 첫 화면의 ‘처음 왔어요! 가입하기’에서 가입 코드와 이름, 생년월일, 아이디, 비밀번호를 직접 넣으면 바로 계정이 생겨요.')),
      h('label', { class: 'switch' }, sw, signup.open ? '받는 중' : '꺼짐')),
    h('div', { class: 'signup-code' }, h('span', {}, '지금 가입 코드'), h('b', {}, signup.code || '-')),
    h('div', { class: 'verse-head' },
      h('label', { class: 'field', style: 'flex:1' }, h('span', {}, '가입 코드 바꾸기 (한글·영문·숫자 4~12글자)'), code),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
        try { signup = await call('kids_t_set_signup', { p_open: null, p_code: code.value.trim() }, err); } catch (e) { return; }
        toast('가입 코드를 바꿨어요.');
        renderSignup();
      } }, '바꾸기')),
    err,
    h('p', { class: 'note warn' }, '가입 코드를 아는 사람은 누구나 가입할 수 있어요. 교회 안에서만 알려 주고, 가입이 끝나면 꺼 두거나 코드를 바꿔 주세요. 직접 가입한 아이의 보호자 동의는 가입 화면의 체크로만 받은 것이라, 종이 동의서 등으로 따로 확인하면 아이 정보에서 ‘동의 확인함’을 눌러 기록해 주세요.'));
}

function renderKids() {
  renderSignup();
  const list = $('#kidList');
  const pub = data.verses.filter((v) => v.is_published).length;
  if (!data.children.length) {
    list.replaceChildren(h('div', { class: 'card empty' }, '아직 아이 계정이 없어요. 아이들이 마을 첫 화면에서 직접 가입하거나, 위의 ‘아이 계정 만들기’로 만들 수 있어요.'));
    return;
  }
  list.replaceChildren(...data.children.map((c) => {
    const cv = h('canvas', { width: 104, height: 104, 'aria-hidden': 'true' });
    drawFaceIcon(cv, normalizeAvatar(c.avatar));
    const passed = c.memory.filter((m) => m.passed).length;
    const practiced = c.memory.reduce((s, m) => s + m.practice_count, 0);
    return h('button', { class: 'kid', type: 'button', onclick: () => openKid(c.id) },
      cv,
      h('div', {}, h('div', { class: 'nm' }, c.name, ' ', c.locked ? h('span', { class: 'pill red' }, '잠김') : null,
          c.joined_self ? h('span', { class: 'pill' }, '직접 가입') : null, ' ', !c.consent_checked ? h('span', { class: 'pill sun' }, '동의 확인 전') : null),
        h('div', { class: 'sub' }, `아이디 ${c.login_id}`, c.village_name ? ` · 마을 이름 ${c.village_name}` : ' · 아직 꾸미기 전')),
      h('div', { class: 'stat col3' }, birthLabel(c.birthdate)),
      h('div', { class: 'stat col4' }, h('b', {}, `${passed}/${pub}`), ' 도장 · 연습 ', h('b', {}, String(practiced)), '번 · 묵상 ', h('b', {}, String(c.qt_count || 0)),
        ' · 필사 ', h('b', {}, String(c.copy_count || 0)), ' · 열매 ', h('b', {}, String(c.fruits))),
      h('div', { class: 'stat' }, ago(c.last_seen_at)));
  }));
}

function consentCheck(c) {
  const d = h('input', { type: 'date', value: new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) });
  const err = h('p', { class: 'err', role: 'alert' });
  return h('div', { class: 'note warn', style: 'margin-top:10px;display:grid;gap:8px' },
    h('span', {}, `직접 가입한 아이예요. 보호자 동의는 가입 화면의 체크로만 받았어요(${c.consent_date}). 종이 동의서 등으로 따로 확인했다면 날짜를 고르고 눌러 주세요.`),
    h('div', { class: 'verse-head' },
      h('label', { class: 'field', style: 'flex:1' }, h('span', {}, '동의 확인한 날'), d),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
        try { await call('kids_t_check_consent', { p_child: c.id, p_date: d.value }, err); } catch (e) { return; }
        toast('보호자 동의를 확인했다고 기록했어요.');
        await refresh();
        $('#kidDlg').close();
      } }, '동의 확인함')),
    err);
}

function openKid(id) {
  const c = data.children.find((x) => x.id === id);
  if (!c) return;
  const dlg = $('#kidDlg');
  $('#dlgTitle').textContent = `${c.name}${c.village_name ? ` (${c.village_name})` : ''}`;
  const err = h('p', { class: 'err', role: 'alert' });
  const fName = h('input', { value: c.name, maxlength: 20 });
  const fBirth = h('input', { type: 'date', value: c.birthdate });
  const fId = h('input', { value: c.login_id, maxlength: 12 });
  const fPin = h('input', { inputmode: 'numeric', maxlength: 6, placeholder: '숫자 4~6자리' });
  const pinErr = h('p', { class: 'err', role: 'alert' });
  const memBy = Object.fromEntries(c.memory.map((m) => [m.verse_id, m]));
  const verses = data.verses.filter((v) => v.is_published || memBy[v.id]);
  const body = h('div', { class: 'dlg-body' },
    h('section', {},
      h('h4', {}, '말씀 도장'),
      h('p', { class: 'note', style: 'margin-bottom:10px' }, '아이가 선생님 앞에서 외우면 도장을 켜 주세요. 도장을 받으면 열매 10개가 더해지고, 끄면 다시 빠집니다.'),
      verses.length ? h('div', { class: 'stamp-list' }, verses.map((v) => {
        const m = memBy[v.id] || { practice_count: 0, best_score: 0, passed: false };
        const sw = h('input', { type: 'checkbox', checked: m.passed, 'aria-label': `${v.ref} 도장` });
        sw.addEventListener('change', async () => {
          sw.disabled = true;
          try {
            const r = await call('kids_t_set_pass', { p_child_id: c.id, p_verse_id: v.id, p_passed: sw.checked });
            toast(sw.checked ? `${v.ref} 도장을 찍었어요. (열매 ${r.fruits}개)` : '도장을 지웠어요.');
            await refresh();
          } catch (e) { sw.checked = !sw.checked; }
          sw.disabled = false;
        });
        return h('div', { class: 'stamp-row' },
          h('div', {}, h('div', { class: 'r' }, v.ref, v.is_current ? ' ' : '', v.is_current ? h('span', { class: 'pill sun' }, '이번 주') : null)),
          h('div', { class: 'm' }, m.practice_count ? `연습 ${m.practice_count}번 · 최고 ${m.best_score}점` : '아직 연습 안 함'),
          h('label', { class: 'switch' }, sw, '도장'));
      })) : h('p', { class: 'note' }, '아이들에게 공개한 구절이 아직 없어요.')),
    h('section', {},
      h('h4', {}, '정보 고치기'),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, '이름'), fName),
        h('label', { class: 'field' }, h('span', {}, '생년월일'), fBirth),
        h('label', { class: 'field' }, h('span', {}, '로그인 아이디'), fId)),
      c.consent_checked
        ? h('p', { class: 'note', style: 'margin-top:10px' }, `보호자 동의 확인한 날: ${c.consent_date}`)
        : consentCheck(c),
      err,
      h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-go btn-sm', type: 'button', onclick: async () => {
        try { await call('kids_t_update_child', { p_id: c.id, p_login_id: fId.value, p_name: fName.value, p_birthdate: fBirth.value }, err); } catch (e) { return; }
        toast('저장했어요.');
        await refresh();
        dlg.close();
      } }, '저장'))),
    h('section', {},
      h('h4', {}, '비밀번호 새로 정하기'),
      h('p', { class: 'note', style: 'margin-bottom:10px' }, c.locked ? '비밀번호를 여러 번 틀려 잠겨 있어요. 새 비밀번호를 정하면 바로 풀려요.' : '아이가 비밀번호를 잊었을 때 새로 정해 주세요. 이 아이가 로그인해 둔 기기는 모두 로그아웃됩니다.'),
      h('div', { class: 'verse-head' }, h('label', { class: 'field', style: 'flex:1' }, h('span', {}, '새 비밀번호'), fPin),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
          try { await call('kids_t_reset_pin', { p_id: c.id, p_pin: fPin.value.trim() }, pinErr); } catch (e) { return; }
          toast(`새 비밀번호를 정했어요: ${fPin.value.trim()}`);
          fPin.value = '';
          await refresh();
        } }, '정하기')),
      pinErr),
    h('section', {},
      h('h4', {}, '계정 지우기'),
      h('p', { class: 'note', style: 'margin-bottom:10px' }, '이름, 생년월일, 꾸민 모습, 암송·묵상·필사 기록, 사진과 그림, 놀이 기록이 모두 지워지고 되돌릴 수 없어요. 아이가 교회를 떠났거나 보호자가 동의를 거두면 지워 주세요.'),
      h('div', { class: 'form-actions' }, confirmButton('지우기', '정말 지우기', async () => {
        try { await call('kids_t_delete_child', { p_id: c.id }); } catch (e) { return; }
        dlg.close();
        toast(`${c.name} 계정을 지웠어요.`);
        await refresh();
      }))));
  $('#dlgBody').replaceWith(body);
  body.id = 'dlgBody';
  if (!dlg.open) dlg.showModal();
}

function verseEditor(v) {
  const err = h('p', { class: 'err', role: 'alert' });
  const fSort = h('input', { type: 'number', value: String(v.sort_order), min: 0, max: 999 });
  const fRef = h('input', { value: v.ref, maxlength: 60, placeholder: '예: 시편 23편 1절' });
  const fBody = h('textarea', { maxlength: 1000, placeholder: '어린이용 쉬운 말로 옮긴 구절' });
  fBody.value = v.body;
  const save = async (published) => {
    const r = await call('kids_t_save_verse', { p_id: v.id, p_ref: fRef.value, p_body: fBody.value, p_sort: Number(fSort.value) || 0, p_published: published }, err);
    return r;
  };
  return h('article', { class: 'card verse' + (v.is_current ? ' is-current' : '') },
    h('div', { class: 'chips' },
      v.id ? (v.is_published ? h('span', { class: 'pill green' }, '아이들에게 공개') : h('span', { class: 'pill' }, '검토 전 · 비공개')) : h('span', { class: 'pill sun' }, '새 구절'),
      v.is_current ? h('span', { class: 'pill sun' }, '이번 주 말씀') : null,
      h('span', { class: 'pill' }, v.version === 'NJHV' ? 'NJHV' : '개역한글판')),
    h('div', { class: 'verse-head' },
      h('label', { class: 'field' }, h('span', {}, '순서'), fSort),
      h('label', { class: 'field' }, h('span', {}, '구절 위치'), fRef)),
    h('label', { class: 'field' }, h('span', {}, '본문 (개역한글판을 글자 하나 바꾸지 않고 그대로)'), fBody),
    err,
    h('div', { class: 'verse-foot' },
      h('div', { class: 'chips' },
        v.id ? confirmButton('지우기', '정말 지우기', async () => {
          try { await call('kids_t_delete_verse', { p_id: v.id }); } catch (e) { return; }
          toast('구절을 지웠어요.');
          await refresh();
        }) : h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: (e) => e.target.closest('article').remove() }, '취소')),
      h('div', { class: 'chips' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
          try { await save(v.id ? v.is_published : false); } catch (e) { return; }
          toast('저장했어요.');
          await refresh();
        } }, '저장'),
        v.is_published
          ? h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
            try { await save(false); } catch (e) { return; }
            toast('아이들 화면에서 숨겼어요.');
            await refresh();
          } }, '숨기기')
          : h('button', { class: 'btn btn-sm btn-go', type: 'button', onclick: async () => {
            try { await save(true); } catch (e) { return; }
            toast('검토를 마치고 아이들에게 공개했어요.');
            await refresh();
          } }, '검토 끝, 공개하기'),
        v.id && v.is_published && !v.is_current ? h('button', { class: 'btn btn-sm btn-go', type: 'button', onclick: async () => {
          try { await call('kids_t_set_current', { p_id: v.id }); } catch (e) { return; }
          toast(`${v.ref}을(를) 이번 주 말씀으로 정했어요.`);
          await refresh();
        } }, '이번 주 말씀으로') : null)));
}

function renderVerses() {
  const drafts = data.verses.filter((v) => !v.is_published).length;
  const cur = data.verses.find((v) => v.is_current);
  $('#draftNote').replaceChildren(
    drafts ? h('span', {}, h('b', {}, `검토 전 구절 ${drafts}개`), '가 있어요. 암송 구절은 성경전서 개역한글판(대한성서공회) 본문을 그대로 넣었어요. 개역한글판은 저작권료 없이 쓸 수 있지만 출처를 밝히고 본문을 바꾸지 않아야 해요. 구절 위치와 본문이 맞는지 확인한 뒤 ‘검토 끝, 공개하기’를 눌러야 아이들 화면에 보입니다. ') : h('span', {}, '모든 구절을 검토했어요. '),
    cur ? (cur.is_published ? `지금 이번 주 말씀은 ${cur.ref}이에요.` : `이번 주 말씀으로 정한 ${cur.ref}은 아직 비공개라 아이들에게 보이지 않아요.`) : '이번 주 말씀이 아직 정해지지 않았어요.');
  $('#verseList').replaceChildren(...data.verses.map((v) => verseEditor(v)));
}

function renderTeachers() {
  $('#teacherList').replaceChildren(...data.teachers.map((t) => h('div', { class: 'trow' },
    h('div', {}, h('b', {}, t.name), h('span', { class: 'pill', style: 'margin-left:8px' }, t.login_id), t.id === data.me.id ? h('span', { class: 'pill green', style: 'margin-left:6px' }, '나') : null),
    t.id === data.me.id ? null : confirmButton('지우기', '정말 지우기', async () => {
      try { await call('kids_t_delete_teacher', { p_id: t.id }); } catch (e) { return; }
      toast('선생님 계정을 지웠어요.');
      await refresh();
    }))));
}

// ---------- 주간 계획 ----------
function todayIso() { return todayStr(); }
function weekOfIso(day) {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function rangeLabel(ws) {
  const d = new Date(ws + 'T00:00:00');
  const e = new Date(d.getTime() + 6 * 86400000);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ~ ${e.getMonth() + 1}월 ${e.getDate()}일`;
}
function dayName(day) {
  const d = new Date(day + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${['주일', '월', '화', '수', '목', '금', '토'][d.getDay()]}`;
}
// 성경 본문은 "1 본문"처럼 한 줄에 한 절, 이야기는 번호 없이 한 줄에 한 문단
const passageToText = (p) => (p || []).map((v) => (v.n ? `${v.n} ${v.t}` : v.t)).join('\n');
// 서버에 묵상 해설 칸이 있는지 (sql/2026-11-01-kingdom-stories-lectio.sql)
let lectio = false;
async function checkLectio() {
  try { const f = await rpc('kids_features'); lectio = !!(f && f.lectio); } catch (e) { lectio = false; }
}
function textToPassage(t) {
  const out = [];
  for (const line of String(t).split('\n').map((x) => x.trim()).filter(Boolean)) {
    const m = line.match(/^(\d+(?::\d+)?[a-z]?)\s+(.+)$/);
    out.push(m ? { n: m[1], t: m[2] } : { n: '', t: line });
  }
  return out;
}

function renderImport() {
  const box = $('#importBox');
  const has = weeks.length > 0;
  const btn = has
    ? confirmButton('준비된 계획 다시 불러오기', '고친 내용을 덮어써요. 그래도 불러올까요?', () => importPlan(), 'btn btn-sm')
    : h('button', { class: 'btn btn-go', type: 'button', onclick: () => importPlan() }, '준비된 13주 계획 불러오기');
  box.replaceChildren(btn);
}

async function importPlan() {
  const box = $('#importBox');
  const status = h('span', { class: 'importing' }, '계획을 여는 중…');
  box.replaceChildren(status);
  let PLAN;
  try { PLAN = (await import('./plan-data.js')).default; } catch (e) { status.textContent = '계획 파일을 열지 못했어요.'; return; }
  await checkLectio();
  const total = PLAN.verses.length + PLAN.weeks.length + PLAN.weeks.reduce((s, w) => s + w.days.length, 0);
  let n = 0;
  const tick = () => { n++; status.textContent = `불러오는 중… ${n} / ${total}`; };
  try {
    // 1) 암송 구절: 없는 것만 새로 넣는다 (비공개)
    for (const [i, v] of PLAN.verses.entries()) {
      if (!data.verses.some((x) => x.ref === v.ref)) {
        await rpc('kids_t_save_verse', { p_token: token, p_id: null, p_ref: v.ref, p_body: v.body, p_sort: i + 1, p_published: false });
      }
      tick();
    }
    data = await rpc('kids_t_overview', { p_token: token });
    // 2) 주간 계획 (공개 여부는 건드리지 않는다)
    for (const w of PLAN.weeks) {
      const verse = data.verses.find((x) => x.ref === w.verse_ref);
      await rpc('kids_t_save_week', { p_token: token, p_week: w.week_start, p_theme: w.theme, p_verse_id: verse ? verse.id : null,
        p_copy_ref: w.copy.ref, p_copy_intro: w.copy.intro, p_copy_passage: w.copy.verses });
      tick();
    }
    // 3) 날마다 묵상
    for (const w of PLAN.weeks) {
      for (const d of w.days) {
        const args = { p_token: token, p_day: d.date, p_title: d.title, p_ref: d.ref, p_passage: d.verses,
          p_questions: d.questions, p_prayer: d.prayer, p_action: d.action };
        if (lectio) args.p_note = d.note || '';
        await rpc('kids_t_save_qt', args);
        tick();
      }
    }
  } catch (e) {
    if (e.code === 'SESSION') { logoutLocal(); return; }
    status.textContent = `중간에 멈췄어요: ${message(e)} (다시 누르면 이어서 덮어써요)`;
    await refresh();
    return;
  }
  toast('13주 계획을 불러왔어요. 한 주씩 검토하고 공개해 주세요.');
  await refresh();
}

function renderWeeks() {
  renderImport();
  const nowWeek = weekOfIso(todayIso());
  const pub = weeks.filter((w) => w.is_published).length;
  $('#weeksNote').replaceChildren(weeks.length
    ? h('span', {}, h('b', {}, `${weeks.length}주 가운데 ${pub}주 공개`), '. 주마다 암송 구절, 필사 본문, 날마다 묵상 7개가 한 묶음이에요. 처음 넣어 둔 내용은 Claude가 원문을 바탕으로 옮긴 ',
      h('b', {}, '초안'), '이에요. 한 주씩 펼쳐서 읽고 고친 뒤 ‘검토 끝, 공개하기’를 누르면 그 주가 시작되는 날부터 아이들에게 보여요. 공개하면 그 주의 암송 구절도 함께 공개돼요.')
    : h('span', {}, '아직 주간 계획이 없어요. 오른쪽 위 ‘준비된 13주 계획 불러오기’를 누르면 2026년 11월 1일부터 13주 치 초안이 들어와요. 들어온 내용은 모두 검토 전(비공개) 상태예요.'));
  $('#weekList').replaceChildren(...weeks.map((w) => weekCard(w, w.week_start === nowWeek)));
}

function weekCard(w, isNow) {
  const verse = data.verses.find((v) => v.id === w.verse_id);
  const open = openWeeks.has(w.week_start);
  const card = h('article', { class: 'card week' + (isNow ? ' is-now' : '') },
    h('div', { class: 'week-head' },
      h('div', {},
        h('h3', {}, w.theme || '(주제 없음)'),
        h('div', { class: 'when' }, rangeLabel(w.week_start), isNow ? ' · 이번 주' : '')),
      h('div', { class: 'chips' },
        w.is_published ? h('span', { class: 'pill green' }, '공개') : h('span', { class: 'pill' }, '검토 전 · 비공개'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { if (open) openWeeks.delete(w.week_start); else openWeeks.add(w.week_start); renderWeeks(); } }, open ? '접기' : '펼쳐서 검토하기'),
        w.is_published
          ? h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
            try { await call('kids_t_publish_week', { p_week: w.week_start, p_published: false }); } catch (e) { return; }
            toast('이 주를 비공개로 돌렸어요.');
            await refresh();
          } }, '비공개로')
          : h('button', { class: 'btn btn-sm btn-go', type: 'button', onclick: async () => {
            try { await call('kids_t_publish_week', { p_week: w.week_start, p_published: true }); } catch (e) { return; }
            toast('검토를 마치고 공개했어요.');
            await refresh();
          } }, '검토 끝, 공개하기'))),
    h('div', { class: 'week-sum' },
      h('span', {}, '암송 ', h('b', {}, verse ? verse.ref : '없음'), verse && !verse.is_published ? ' (비공개)' : ''),
      h('span', {}, '필사 ', h('b', {}, w.copy_ref || '없음')),
      h('span', {}, '묵상 ', h('b', {}, `${w.days.length}일`)),
      h('span', {}, '묵상한 아이 ', h('b', {}, String(w.days.reduce((s, d) => s + d.done_count, 0))), '번 · 필사 마친 아이 ', h('b', {}, String(w.copy_count)), '명')));
  if (open) card.append(weekEditor(w));
  return card;
}

function weekEditor(w) {
  const err = h('p', { class: 'err', role: 'alert' });
  const fTheme = h('input', { value: w.theme, maxlength: 60 });
  const fVerse = h('select', {}, h('option', { value: '' }, '(없음)'), data.verses.map((v) => {
    const o = h('option', { value: v.id }, `${v.ref}${v.is_published ? '' : ' (비공개)'}`);
    if (v.id === w.verse_id) o.selected = true;
    return o;
  }));
  const fRef = h('input', { value: w.copy_ref, maxlength: 60 });
  const fIntro = h('textarea', { class: 'small', maxlength: 400 });
  fIntro.value = w.copy_intro;
  const fPassage = h('textarea', {});
  fPassage.value = passageToText(w.copy_passage);
  const verse = data.verses.find((v) => v.id === w.verse_id);
  return h('div', { class: 'week-edit' },
    h('h4', {}, '이번 주 암송과 필사'),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, '주제 (필사 이야기 제목)'), fTheme),
      h('label', { class: 'field' }, h('span', {}, '암송 구절'), fVerse)),
    verse ? h('p', { class: 'note' }, h('b', {}, verse.ref), ' ', verse.body, ' — 암송 구절 본문은 ‘암송 구절’ 탭에서 고쳐요.') : null,
    h('label', { class: 'field' }, h('span', {}, '필사 성경 범위'), fRef),
    h('label', { class: 'field' }, h('span', {}, '필사 앞 소개 글'), fIntro),
    h('label', { class: 'field' }, h('span', {}, '필사 본문 (이야기는 한 줄에 한 문단, 성경 본문은 한 줄에 한 절: "1 본문")'), fPassage),
    err,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-go btn-sm', type: 'button', onclick: async () => {
      let passage;
      try { passage = textToPassage(fPassage.value); } catch (e) { err.textContent = message(e); return; }
      try {
        await call('kids_t_save_week', { p_week: w.week_start, p_theme: fTheme.value, p_verse_id: fVerse.value || null,
          p_copy_ref: fRef.value, p_copy_intro: fIntro.value, p_copy_passage: passage }, err);
      } catch (e) { return; }
      toast('이번 주 암송·필사를 저장했어요.');
      await refresh();
    } }, '암송·필사 저장')),
    h('h4', {}, '날마다 묵상'),
    ...w.days.map((d) => dayEditor(d)));
}

function dayEditor(d) {
  const err = h('p', { class: 'err', role: 'alert' });
  const fTitle = h('input', { value: d.title, maxlength: 40 });
  const fRef = h('input', { value: d.ref, maxlength: 60 });
  const fPassage = h('textarea', { class: 'small' });
  fPassage.value = passageToText(d.passage);
  const fQ = h('textarea', { class: 'small' });
  fQ.value = (d.questions || []).join('\n');
  const fPrayer = h('textarea', { class: 'small', maxlength: 400 });
  fPrayer.value = d.prayer;
  const fAction = h('input', { value: d.action, maxlength: 300 });
  const fNote = h('textarea', { class: 'small', maxlength: 600 });
  fNote.value = d.note || '';
  return h('div', { class: 'day-edit' },
    h('div', { class: 'dhead' }, h('span', {}, dayName(d.day)), h('span', { class: 'pill' }, `묵상한 아이 ${d.done_count}명`)),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, '제목'), fTitle),
      h('label', { class: 'field' }, h('span', {}, '본문 위치'), fRef)),
    h('label', { class: 'field' }, h('span', {}, '본문 (한 줄에 한 절: "1 본문")'), fPassage),
    lectio ? h('label', { class: 'field' }, h('span', {}, '짧은 해설'), fNote) : null,
    h('label', { class: 'field' }, h('span', {}, '생각해 봐요 (한 줄에 질문 하나)'), fQ),
    h('label', { class: 'field' }, h('span', {}, '따라 해 보는 기도'), fPrayer),
    h('label', { class: 'field' }, h('span', {}, '오늘 해 볼까요?'), fAction),
    err,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
      let passage;
      try { passage = textToPassage(fPassage.value); } catch (e) { err.textContent = message(e); return; }
      const questions = fQ.value.split('\n').map((x) => x.trim()).filter(Boolean);
      try {
        const args = { p_day: d.day, p_title: fTitle.value, p_ref: fRef.value, p_passage: passage,
          p_questions: questions, p_prayer: fPrayer.value, p_action: fAction.value };
        if (lectio) args.p_note = fNote.value;
        await call('kids_t_save_qt', args, err);
      } catch (e) { return; }
      toast(`${dayName(d.day)} 묵상을 저장했어요.`);
      await refresh();
    } }, '이날 저장')));
}

// ---------- 아이들 글 ----------
let storage = null;
const mb = (b) => (b / 1048576).toFixed(1);
async function bigImage(p) {
  try {
    const r = await rpc('kids_t_image', { p_token: token, p_kind: p.kind, p_child: p.child_id, p_key: p.key });
    showImage(`data:image/jpeg;base64,${r.image}`, `${p.name} · ${p.label || ''}`);
  } catch (e) { toast(message(e)); }
}
function renderPosts() {
  const list = $('#postList');
  $('#storageNote').textContent = storage
    ? `필사 사진 ${storage.photos}장, 그림 ${storage.drawings}장이 약 ${mb(storage.bytes)}MB를 쓰고 있어요. (데이터베이스 전체 ${mb(storage.db_bytes)}MB / 무료 한도 500MB)`
    : '';
  if (!posts.length) { list.replaceChildren(h('div', { class: 'card empty' }, '아직 나눈 글이 없어요.')); return; }
  list.replaceChildren(...posts.map((p) => {
    const sw = h('input', { type: 'checkbox', checked: p.hidden, 'aria-label': '숨기기' });
    sw.addEventListener('change', async () => {
      sw.disabled = true;
      try { await call('kids_t_hide_post', { p_kind: p.kind, p_child: p.child_id, p_key: p.key, p_hidden: sw.checked }); } catch (e) { sw.checked = !sw.checked; sw.disabled = false; return; }
      toast(sw.checked ? '친구들에게 보이지 않게 했어요.' : '다시 보이게 했어요.');
      await refresh();
    });
    let photoOk = null;
    if (p.kind === 'copy' && p.has_photo) {
      const ok = h('input', { type: 'checkbox', checked: p.photo_ok, 'aria-label': '사진을 친구들에게 보여 주기' });
      ok.addEventListener('change', async () => {
        ok.disabled = true;
        try { await call('kids_t_photo_ok', { p_child: p.child_id, p_week: p.key, p_ok: ok.checked }); } catch (e) { ok.checked = !ok.checked; ok.disabled = false; return; }
        toast(ok.checked ? '확인했어요. 친구들도 사진을 볼 수 있어요.' : '사진을 친구들에게 보이지 않게 했어요.');
        await refresh();
      });
      photoOk = h('label', { class: 'switch' }, ok, '사진 확인');
    }
    const when = p.kind === 'qt' ? `${dayName(p.key)} · ${p.label || ''}` : p.kind === 'copy' ? `${rangeLabel(p.key)} · ${p.label || ''}` : `${new Date(p.at).getMonth() + 1}월 ${new Date(p.at).getDate()}일 · ${p.label || ''}`;
    return h('article', { class: 'post' + (p.hidden ? ' is-hidden' : '') },
      h('div', { class: 'meta' },
        h('span', { class: 'who' }, p.name), p.village_name ? h('span', {}, `(${p.village_name})`) : null,
        h('span', { class: 'pill' }, p.kind === 'qt' ? '묵상' : p.kind === 'art' ? '그림' : p.has_photo ? '필사 사진' : '필사'),
        h('span', {}, when),
        p.shared ? null : h('span', { class: 'pill' }, p.kind === 'art' ? '전시관에 걸지 않음' : '아이가 나만 보기로 함'),
        p.kind === 'copy' && p.has_photo && !p.photo_ok ? h('span', { class: 'pill sun' }, '사진 확인 전') : null),
      h('div', { class: 'post-sw' }, photoOk, h('label', { class: 'switch' }, sw, '숨기기')),
      p.thumb ? h('button', { class: 'pic', type: 'button', 'aria-label': '크게 보기', onclick: () => bigImage(p) }, h('img', { src: `data:image/jpeg;base64,${p.thumb}`, alt: '' })) : null,
      p.text ? h('p', { class: 'txt' }, p.text) : null);
  }));
}

boot();
