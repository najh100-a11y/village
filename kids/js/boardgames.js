// 진숲 어린이 마을 — 보드게임 섬: 놀이 고르기 창, 놀이 화면, 두 사람 놀이 흐름
// 탁자를 누르면 놀이 고르기 창이 열리고, 숲지기 솔(컴퓨터)이나 마을 친구와 1:1로 한다.
// 놀이 화면은 마을 위에 덮이는 한 장의 화면이다. 마을의 내 주민은 탁자 의자에 앉아 있다.
// 친구와 할 때: 초대한 사람(0)이 판 씨앗을 정해 'start'로 알리고, 두 화면이 같은 수를 같은 차례로 둔다 ('mv').
// 과일 종 치기는 빠르기를 겨루므로 초대한 쪽 화면이 정한다: 친구는 'in'(뒤집기, 종 치기)을 보내고, 초대한 쪽이 'ev'로 알린다.
import { h, modal, confetti, josa, icon } from './ui.js';
import { friendPicker, waitInvite } from './play.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';
import { sfx } from './sound.js';
import * as R from './bg-rules.js';
import { VIEWS } from './bg-views.js';

export const BG_IDS = ['fruit', 'n77', 'code', 'mancala', 'yut', 'dots'];
export const bgKind = (id) => 'bg_' + id;
export const bgIdOf = (kind) => (typeof kind === 'string' && kind.startsWith('bg_') && BG_IDS.includes(kind.slice(3)) ? kind.slice(3) : null);
const GUIDE_AV = { skin: 2, eyes: 'smile', eyeColor: 1, brows: 'soft', nose: 'round', mouth: 'grin', cheek: 'pink', hair: 'short', hairColor: 2, outfit: 'overall', outfitColor: 4, bottomColor: 3, shoeColor: 5, hat: 'straw', hatColor: 4 };
const LEVELS = [['easy', '쉬움', '🌱'], ['normal', '보통', '🌳'], ['hard', '어려움', '🏔️']];

// 놀이마다 이름, 짧은 소개, 하는 법 (규칙은 js/bg-rules.js와 똑같이 적는다)
export const BG_INFO = {
  fruit: {
    name: '과일 종 치기', icon: '🔔', ask: '과일 종 치기 하자고 해요!', line: '같은 과일이 꼭 다섯 개면 땡! 누가 먼저 칠까요?',
    how: [
      ['번갈아 뒤집어요', '내 차례에 아래쪽 내 카드 더미를 누르면 맨 위 카드가 펼쳐져요.'],
      ['다섯 개면 땡!', '펼쳐진 카드 두 장에 같은 과일이 꼭 다섯 개 보이면 가운데 종을 먼저 눌러요. 펼쳐진 카드를 모두 가져와요.'],
      ['틀리면 한 장 줘요', '다섯 개가 아닌데 종을 치면 내 카드 한 장을 친구에게 줘요. 내 차례에 뒤집을 카드가 없으면 지고, 3분이 지나면 카드가 많은 사람이 이겨요.'],
    ],
  },
  n77: {
    name: '77 피하기', icon: '🃏', ask: '77 피하기 하자고 해요!', line: '합계가 11, 22, 33… 이나 77이 되지 않게 카드를 내요.',
    how: [
      ['한 장씩 내요', '내 카드 네 장 가운데 하나를 내면 그 수만큼 합계가 커져요. 낸 뒤에 한 장을 새로 가져와요.'],
      ['11의 배수와 77은 피해요', '합계가 11, 22, 33, 44, 55, 66이 되거나 77 이상이 되면 생명 하나를 잃고 합계는 0부터 다시 시작해요.'],
      ['특별한 카드', '0은 합계 그대로, −10은 합계를 10 줄여요(0보다 작아지지 않아요). ‘두 번!’을 내면 친구가 카드를 두 장 연달아 내야 해요. 생명 셋을 먼저 다 잃으면 져요.'],
    ],
  },
  code: {
    name: '숫자 암호', icon: '🔢', ask: '숫자 암호 맞히기 하자고 해요!', line: '친구가 숨긴 숫자 타일을 추리해서 맞혀요.',
    how: [
      ['작은 수부터 늘어놓아요', '0부터 11까지 숫자 타일이 해(밝은 색)와 밤(어두운 색)으로 하나씩 있어요. 내 타일은 작은 수부터 늘어놓고, 같은 수면 밤 타일이 왼쪽이에요.'],
      ['가져오고 맞혀요', '내 차례에 타일을 한 장 가져온 뒤, 친구의 숨은 타일 하나를 골라 숫자를 말해요. 맞히면 그 타일이 열리고, 한 번 더 맞히거나 멈출 수 있어요. 멈추면 가져온 타일은 숨긴 채 내 줄에 들어가요.'],
      ['틀리면 들켜요', '틀리면 가져온 타일을 보이게 내 줄에 놓아요(가져올 타일이 없을 때는 내 숨은 타일 하나를 보여 줘요). 친구 타일을 먼저 다 열면 이겨요.'],
    ],
  },
  mancala: {
    name: '만칼라', icon: '🪨', ask: '만칼라 하자고 해요!', line: '돌을 한 알씩 놓아 내 창고에 더 많이 모아요.',
    how: [
      ['돌을 한 알씩 놓아요', '아래쪽 여섯 구멍이 내 구멍이에요. 하나를 누르면 그 돌을 모두 집어 오른쪽(시계 반대 방향)으로 한 구멍에 한 알씩 놓아요. 내 창고는 오른쪽 끝이고, 친구 창고는 건너뛰어요.'],
      ['창고에 쏙 들어가면 한 번 더', '마지막 돌이 내 창고에 들어가면 한 번 더 해요.'],
      ['빈 구멍이면 잡아요', '마지막 돌이 내 빈 구멍에 들어가고 맞은편 친구 구멍에 돌이 있으면, 두 구멍 돌을 모두 내 창고로 가져와요. 한쪽 구멍이 다 비면 끝나요. 남은 돌은 그 주인의 창고로 가고, 창고에 돌이 많은 사람이 이겨요.'],
    ],
  },
  yut: {
    name: '윷놀이', icon: '🎋', ask: '윷놀이 하자고 해요!', line: '윷을 던져 말을 옮겨요. 지름길도 있고 잡기도 있어요.',
    how: [
      ['윷을 던져요', '도 1칸, 개 2칸, 걸 3칸, 윷 4칸, 모 5칸. 표시된 가락 하나만 엎어지면 빽도라서 1칸 뒤로 가요. 윷이나 모가 나오면 한 번 더 던져요.'],
      ['말을 옮겨요', '나온 수를 골라 말을 눌러요. 모서리나 가운데에 딱 멈추면 다음에는 지름길로 가요. 내 말끼리 만나면 업혀서 같이 다녀요.'],
      ['잡으면 한 번 더', '친구 말이 있는 곳에 멈추면 잡아서 처음으로 돌려보내고 한 번 더 던져요. 출발점에 닿거나 지나면 말이 들어와요. 내 말이 모두 먼저 들어오면 이겨요.'],
    ],
    opts: { key: 'pieces', label: '말 수', list: [[2, '말 2개 (빨리 끝나요)', 'two'], [4, '말 4개 (오래 해요)', 'four']], def: 2 },
  },
  dots: {
    name: '땅따먹기', icon: '✏️', ask: '땅따먹기(점 잇기) 하자고 해요!', line: '점과 점을 이어 네모를 닫으면 내 땅!',
    how: [
      ['선을 하나씩 그어요', '번갈아 가며 이웃한 두 점 사이에 선을 하나 그어요.'],
      ['네모를 닫으면 내 땅', '네모의 네 번째 선을 그으면 그 칸이 내 땅이 되고, 한 번 더 그어요.'],
      ['땅이 많으면 이겨요', '16칸이 모두 차면 땅이 많은 사람이 이겨요. 네모에 셋째 선을 긋기 전에 잘 생각해요!'],
    ],
  },
};

function readPref(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
function writePref(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* 이번만 */ } }
const levelOf = (id) => { const v = readPref('kv.bgLevel.' + id, 'normal'); return LEVELS.some(([k]) => k === v) ? v : 'normal'; };
function optsOf(id) {
  const o = BG_INFO[id].opts;
  if (!o) return {};
  const v = Number(readPref('kv.bgOpt.' + id, o.def));
  return { [o.key]: o.list.some(([x]) => x === v) ? v : o.def };
}
// 초대에 실어 보내는 놀이 설정 (마을 채널은 영어 소문자 낱말만 받는다: 'two', 'four')
function optsWord(id, opts) {
  const o = BG_INFO[id].opts;
  if (!o) return null;
  const it = o.list.find(([v]) => v === opts[o.key]);
  return it ? it[2] : null;
}
// 놀이 설정 읽기: { pieces: 2 } 같은 값이나 초대 낱말 (모르는 값이면 기본값)
function cleanOpts(id, x) {
  const o = BG_INFO[id].opts;
  if (!o) return {};
  let v = NaN;
  if (typeof x === 'string') { const it = o.list.find((e) => e[2] === x); v = it ? it[0] : NaN; } else if (x && typeof x === 'object') v = Number(x[o.key]);
  return { [o.key]: o.list.some(([k]) => k === v) ? v : o.def };
}
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
// 체험판 시험용: window.kvBgSpeed로 컴퓨터가 생각하는 시간만 줄인다 (보통은 1)
const aiSpeed = () => (typeof window !== 'undefined' && window.kvBgSpeed > 1 ? window.kvBgSpeed : 1);

// ---------------------------------------------------------------------
// 놀이 고르기 창: 하는 법, 숲지기 솔과 하기(난이도), 마을 친구와 하기
// ---------------------------------------------------------------------
export function boardMenu(id, { hub, onlineFriends, onStart }) {
  const info = BG_INFO[id];
  let tok = 0;
  const start = (how) => { tok++; modal.close(); onStart(id, how); };
  function body() {
    const friends = onlineFriends();
    const o = info.opts;
    const cur = optsOf(id);
    return h('div', { class: 'mem game bg-menu' },
      h('p', { class: 'bg-line' }, `${info.icon} ${info.line}`),
      h('section', { class: 'guide compact' },
        h('h3', {}, `${info.name}${josa(info.name, '은', '는').slice(info.name.length)} 이렇게 해요`),
        h('ol', { class: 'guide-steps' }, info.how.map(([b, s]) => h('li', {}, h('b', {}, b), h('span', {}, s))))),
      o ? h('div', { class: 'bg-opts', role: 'group', 'aria-label': o.label }, o.list.map(([v, label]) => h('button', {
        type: 'button', class: `chip${cur[o.key] === v ? ' on' : ''}`, 'aria-pressed': cur[o.key] === v ? 'true' : 'false',
        onclick: () => { writePref('kv.bgOpt.' + id, v); modal.setBody(body()); },
      }, label))) : null,
      h('div', { class: 'sub-head' }, h('h3', {}, '숲지기 솔과 하기'), h('p', {}, '난이도를 골라요')),
      h('div', { class: 'mode-pick levels' }, LEVELS.map(([lv, name, ic]) => h('button', {
        class: 'mode' + (lv === levelOf(id) ? ' last' : ''), type: 'button', 'data-level': lv,
        onclick: () => { writePref('kv.bgLevel.' + id, lv); start({ level: lv, opts: optsOf(id) }); },
      }, h('b', {}, `${ic} ${name}`), h('span', {}, { easy: '살살 해요. 처음 해 보는 친구에게 좋아요.', normal: '숲지기 솔이 평소처럼 해요.', hard: '솔이 꼼꼼히 따져요. 이겨 보세요!' }[lv])))),
      h('div', { class: 'sub-head' }, h('h3', {}, '마을 친구와 하기'), h('p', {}, friends.length ? `${friends.length}명` : '')),
      friendPicker(friends, (f) => {
        const my = ++tok;
        const opts = optsOf(id);
        modal.setTitle(info.name);
        waitInvite(hub, f, bgKind(id), optsWord(id, opts), { setBody: (b) => modal.setBody(b), onBack: () => modal.setBody(body()) }).then((s) => {
          if (!s) return;
          if (my !== tok || !modal.isOpen) { s.close(); return; }
          start({ session: s, opts });
        });
      }, '지금 마을에 있는 친구가 없어요. 친구가 들어오면 여기에 보여요.'));
  }
  modal.open(info.name, body(), { cls: 'game-sheet', onClose: () => { tok++; } });
}

// ---------------------------------------------------------------------
// 놀이 화면 틀: 위에 친구, 가운데 판, 아래에 나
// ---------------------------------------------------------------------
function faceCv(av) {
  const cv = h('canvas', { width: 80, height: 80, class: 'bg-face', 'aria-hidden': 'true' });
  try { drawFaceIcon(cv, normalizeAvatar(av)); } catch (e) { /* 얼굴 없이 */ }
  return cv;
}
function makeShell({ id, meName, meAv, oppName, oppAv, onExit }) {
  const info = BG_INFO[id];
  const sub = { me: h('small', {}), opp: h('small', {}) };
  const chip = (side, name, av) => h('div', { class: `bg-who ${side}` }, faceCv(av), h('span', { class: 'nm' }, h('b', {}, name), sub[side]));
  const meChip = chip('me', meName, meAv), oppChip = chip('opp', oppName, oppAv);
  const say = h('p', { class: 'bg-say', 'aria-live': 'polite' });
  const acts = h('div', { class: 'bg-acts' });
  const main = h('div', { class: `bg-main bg-${id}` });
  const bannerEl = h('div', { class: 'bg-banner', role: 'status' });
  const exit = h('button', { class: 'bg-exit', type: 'button', onclick: onExit }, icon('door'), '그만');
  const help = h('button', { class: 'bg-help', type: 'button', 'aria-label': '하는 법 보기', onclick: () => showHelp() }, '?');
  const helpBox = h('div', { class: 'bg-howto', hidden: true, onclick: () => { helpBox.hidden = true; } },
    h('div', { class: 'card' }, h('h3', {}, `${info.name} 하는 법`), h('ol', { class: 'guide-steps' }, info.how.map(([b, s]) => h('li', {}, h('b', {}, b), h('span', {}, s)))), h('button', { class: 'btn btn-go', type: 'button' }, '알겠어요')));
  function showHelp() { helpBox.hidden = false; sfx.pop(true); }
  const root = h('div', { class: `bg-screen bg-is-${id}`, role: 'dialog', 'aria-label': info.name },
    h('div', { class: 'bg-top' }, oppChip, h('span', { class: 'bg-title' }, `${info.icon} ${info.name}`), h('div', { class: 'bg-tools' }, help, exit)),
    main,
    h('div', { class: 'bg-bottom' }, say, h('div', { class: 'bg-bar' }, meChip, acts)),
    bannerEl, helpBox);
  document.body.append(root);
  document.body.classList.add('bg-on');
  let bt = 0;
  return {
    root, main,
    say(t) { say.textContent = t || ''; },
    sub(side, t) { sub[side].textContent = t || ''; },
    turn(side) { meChip.classList.toggle('turn', side === 'me'); oppChip.classList.toggle('turn', side === 'opp'); },
    acts(...els) { acts.replaceChildren(...els.flat().filter(Boolean)); },
    banner(big, small = '', ms = 2000) {
      bannerEl.replaceChildren(h('b', {}, big), small ? h('span', {}, small) : '');
      bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
      clearTimeout(bt);
      bt = setTimeout(() => bannerEl.classList.remove('show'), ms);
    },
    destroy() { clearTimeout(bt); root.remove(); document.body.classList.remove('bg-on'); },
  };
}

// ---------------------------------------------------------------------
// 판 하나하나의 흐름 (두 사람 놀이 공통): 시작, 한 판 더, 친구가 나감
// ---------------------------------------------------------------------
function matchFlow({ shell, session, meP, oppName, onCelebrate, onCheer, begin }) {
  const remote = !!(session && !session.bot);
  const isHost = !remote || session.host;
  const f = { round: 0, over: false, wantAgain: false, peerAgain: false, peerLeft: false, alive: true, seedWait: null };
  f.start = (r) => {
    // 초대한 쪽(또는 혼자)만 씨앗을 정한다
    const seed = newSeed();
    if (remote) session.send('start', { r, seed });
    run(r, seed);
  };
  function run(r, seed) {
    f.round = r; f.over = false; f.wantAgain = false; f.peerAgain = false;
    begin(r, seed);
  }
  f.onStart = (m) => { if (!isHost && Number.isInteger(m.r) && m.r > f.round && Number.isInteger(m.seed)) run(m.r, m.seed >>> 0); };
  f.finish = (over) => {
    f.over = true;
    const w = over.winner;
    if (w === -1) { shell.banner('비겼어요!', '둘 다 정말 잘했어요', 3200); sfx.ding(); }
    else if (w === meP) { shell.banner('내가 이겼어요!', '정말 잘했어요', 3200); confetti(); if (onCelebrate) onCelebrate(); if (onCheer) onCheer('me'); }
    else { shell.banner(`${josa(oppName, '이', '가')} 이겼어요`, '다음 판에 다시 해 봐요!', 3200); sfx.fail(); if (onCheer) onCheer('opp'); }
    shell.say(w === -1 ? '비겼어요. 한 판 더 할까요?' : w === meP ? '이겼어요! 한 판 더 할까요?' : '아쉬워요! 한 판 더 할까요?');
    f.drawAgain();
  };
  f.drawAgain = () => {
    if (!f.over) return;
    const quit = h('button', { class: 'btn btn-soft', type: 'button', onclick: () => shell.exit() }, '그만하기');
    if (f.peerLeft) { shell.acts(h('button', { class: 'btn btn-go', type: 'button', onclick: () => shell.exit() }, '나가기')); return; }
    if (!remote) { shell.acts(quit, h('button', { class: 'btn btn-go', type: 'button', onclick: () => f.start(f.round + 1) }, '한 판 더')); return; }
    shell.acts(quit, h('button', {
      class: `btn btn-go${f.peerAgain ? ' pulse' : ''}`, type: 'button', disabled: f.wantAgain,
      onclick: () => {
        f.wantAgain = true;
        session.send('again', { r: f.round });
        if (f.peerAgain && isHost) f.start(f.round + 1);
        else { shell.say(`${josa(oppName, '을', '를')} 기다리고 있어요…`); f.drawAgain(); }
      },
    }, f.peerAgain ? '좋아, 한 판 더!' : f.wantAgain ? '기다리는 중…' : '한 판 더'));
  };
  f.onAgain = (m) => {
    if (!f.over || (Number.isInteger(m.r) && m.r !== f.round)) return;
    f.peerAgain = true;
    if (f.wantAgain && isHost) f.start(f.round + 1);
    else { shell.say(`${josa(oppName, '이', '가')} 한 판 더 하재요!`); f.drawAgain(); }
  };
  f.onLeft = () => {
    f.peerLeft = true;
    shell.say(`${josa(oppName, '이', '가')} 놀이를 마쳤어요.`);
    shell.banner(`${josa(oppName, '이', '가')} 나갔어요`, '다음에 또 해요!', 2600);
    f.over = true;
    f.drawAgain();
  };
  return f;
}

// ---------------------------------------------------------------------
// 차례를 번갈아 두는 놀이 다섯
// ---------------------------------------------------------------------
function turnGame(id, { shell, session, level, opts, meP, oppName, flow, cheer }) {
  const T = R.TURN_GAMES[id];
  const remote = !!(session && !session.bot);
  const aiP = remote ? -1 : 1 - meP;
  const lv = session && session.bot ? 'normal' : level;
  let st = null, pushed = 0, q = [], animating = false, aiT = 0, alive = true;
  const buf = new Map(); // 'r:n' → 친구가 둔 수 (먼저 온 것)
  const canAct = () => !!st && alive && !st.over && !flow.over && !animating && !q.length && st.turn === meP;
  const env = {
    main: shell.main, meP, level: lv,
    act: (a) => local(a),
    canAct,
    who: (p, t) => shell.sub(p === meP ? 'me' : 'opp', t),
    banner: (b, s, ms) => shell.banner(b, s, ms),
    acts: (...els) => { if (!flow.over) shell.acts(...els); },
    say: (t) => shell.say(t),
    name: (p) => (p === meP ? '나' : oppName),
  };
  const view = VIEWS[id](env);
  function begin(r, seed) {
    clearTimeout(aiT);
    q = []; pushed = 0; animating = false;
    st = T.rules.init(seed, { ...opts, first: (r - 1) % 2 });
    shell.acts();
    view.reset(st);
    step();
    drain();
  }
  function local(a) {
    if (!canAct()) return false;
    let ok = false;
    try { ok = T.rules.legal(st, meP, a); } catch (e) { ok = false; }
    if (!ok) return false;
    if (remote) session.send('mv', { r: flow.round, n: pushed, a });
    push(meP, a);
    return true;
  }
  function push(p, a) { pushed++; q.push([p, a]); pump(); }
  function pump() {
    if (animating || !q.length || !alive) return;
    const [p, a] = q.shift();
    let ev = null;
    try { if (T.rules.legal(st, p, a)) ev = T.rules.apply(st, p, a); } catch (e) { console.error(e); }
    if (!ev) { pump(); return; }
    if (p !== meP && cheer) cheer('reach-opp'); else if (cheer) cheer('reach-me');
    animating = true;
    let ms = 0;
    try { ms = view.play(ev, st) || 0; } catch (e) { console.error(e); }
    setTimeout(() => {
      if (!alive) return;
      animating = false;
      view.render(st);
      if (st.over) { flow.finish(st.over); return; }
      step();
      pump();
      drain();
    }, ms);
  }
  function step() {
    if (!st || st.over) return;
    shell.turn(st.turn === meP ? 'me' : 'opp');
    shell.say(view.status(st));
    view.input();
    clearTimeout(aiT);
    if (st.turn === aiP && !q.length) {
      const r = flow.round;
      aiT = setTimeout(() => {
        if (!alive || !st || st.over || st.turn !== aiP || animating || q.length || flow.round !== r) return;
        let a = null;
        try { a = T.ai(st, aiP, lv); } catch (e) { console.error(e); }
        if (a) push(aiP, a);
      }, (view.aiDelay ? view.aiDelay(st) : 900) / aiSpeed());
    }
  }
  // 친구가 둔 수를 차례대로
  function drain() {
    while (buf.has(`${flow.round}:${pushed}`)) {
      const a = buf.get(`${flow.round}:${pushed}`);
      buf.delete(`${flow.round}:${pushed}`);
      push(1 - meP, a);
    }
  }
  function onMsg(m) {
    if (m.t === 'mv' && Number.isInteger(m.r) && Number.isInteger(m.n) && m.a && typeof m.a === 'object') {
      if (m.r < flow.round || buf.size > 400) return;
      buf.set(`${m.r}:${m.n}`, m.a);
      if (m.r === flow.round) drain();
    }
  }
  return {
    begin, onMsg,
    stop() { alive = false; clearTimeout(aiT); },
    state: () => st,
    idle: () => canAct(),
  };
}

// ---------------------------------------------------------------------
// 과일 종 치기 (빠르기 놀이): 초대한 쪽(또는 혼자)이 판을 정한다
// ---------------------------------------------------------------------
const PIPS = { 1: [[50, 50]], 2: [[50, 28], [50, 72]], 3: [[28, 26], [50, 50], [72, 74]], 4: [[30, 28], [70, 28], [30, 72], [70, 72]], 5: [[28, 24], [72, 24], [50, 50], [28, 76], [72, 76]] };
function fruitSvg(f) {
  if (f === 0) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.6c-1.6-1.2-4.8-1.4-6.4 1-1.8 2.7-.6 7.2 1.6 9.7 1.3 1.5 2.6 2 4.8 1.2 2.2.8 3.5.3 4.8-1.2 2.2-2.5 3.4-7 1.6-9.7-1.6-2.4-4.8-2.2-6.4-1z" fill="#EF6461"/><path d="M12 7.6c.1-1.7.6-3 1.6-4" stroke="#6B4429" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M13.4 5.2c1.4-1.6 3.4-1.7 4.6-1-1 1.6-2.8 2.3-4.6 1z" fill="#6CC24A"/><ellipse cx="8.7" cy="10.8" rx="1.2" ry="1.8" fill="#fff" opacity=".55"/></svg>';
  if (f === 1) return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="13.6" rx="8.6" ry="7.4" fill="#F49A4C"/><path d="M12 6.6 9 4.4l.6 3.2-3.4.4 2.9 1.6M12 6.6l3-2.2-.6 3.2 3.4.4-2.9 1.6" fill="#5E9E3E"/><rect x="11.2" y="4.6" width="1.6" height="3" rx=".8" fill="#6B4429"/><ellipse cx="8.4" cy="12" rx="1.3" ry="1.9" fill="#fff" opacity=".45"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.4c-4.6-.6-8 2.6-7.6 7.2.4 4.2 3.6 6.8 7.6 6.8s7.2-2.6 7.6-6.8c.4-4.6-3-7.8-7.6-7.2z" fill="#F6A2C4"/><path d="M12 6.8c-1.4 3-1.4 9.6 0 13.4" stroke="#E57FA6" stroke-width="1.2" fill="none"/><path d="M12.4 6.6c1-2.2 3.4-3 5.4-2.4-1 2-3.2 2.8-5.4 2.4z" fill="#6CC24A"/><ellipse cx="8.4" cy="11.6" rx="1.4" ry="2" fill="#fff" opacity=".5"/></svg>';
}
function fruitCard(c, extra = '') {
  if (c == null) return h('div', { class: `fcard none ${extra}` });
  const f = Math.floor(c / 10), n = c % 10;
  const el = h('div', { class: `fcard f${f} ${extra}`, 'aria-label': `${R.FRUITS[f].name} ${n}개` });
  for (const [x, y] of PIPS[n]) {
    const s = h('span', { class: 'fi', html: fruitSvg(f) });
    s.style.left = x + '%';
    s.style.top = y + '%';
    el.append(s);
  }
  return el;
}
function fruitGame({ shell, session, level, meP, oppName, flow }) {
  const remote = !!(session && !session.bot);
  const isHost = !remote || session.host;
  const opp = 1 - meP;
  const aiP = remote ? -1 : opp;
  const lv = session && session.bot ? 'normal' : level;
  const WINDOW = remote ? 450 : 0; // 둘이 거의 같이 쳤을 때 누가 빨랐는지 기다리는 시간
  let st = null, evN = 0, shownAt = 0, pend = null, stuckT = 0, endT = 0, deadline = 0, aiT = [], myCool = 0, alive = true, clock = 0;
  const buf = new Map();
  // 화면
  const timer = h('div', { class: 'fr-timer' }, h('i'), h('b', {}, '3:00'));
  const oppDeck = h('div', { class: 'fr-deck opp' });
  const oppPile = h('div', { class: 'fr-pile opp' });
  const myPile = h('div', { class: 'fr-pile me' });
  const myDeck = h('button', { class: 'fr-deck me', type: 'button', onclick: () => flip() });
  const bell = h('button', { class: 'fr-bell', type: 'button', 'aria-label': '종 치기', onclick: () => ring() },
    h('span', { class: 'bell', html: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="54" rx="24" ry="5" fill="#8B5E3C"/><path d="M10 50c0-4 2-6 4-8 1-10 4-22 18-24 14 2 17 14 18 24 2 2 4 4 4 8z" fill="#F2C14E"/><path d="M14 42c1-9 4-19 14-21" stroke="#FFE7A8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="32" cy="14" r="4.5" fill="#E0A92E"/></svg>' }),
    h('b', {}, '땡!'));
  const sums = h('p', { class: 'fr-sums', 'aria-live': 'polite' });
  shell.main.replaceChildren(h('div', { class: 'fr-game' }, timer, oppDeck, h('div', { class: 'fr-mid' }, oppPile, bell, myPile), sums, myDeck));
  const deckFace = (n, mine) => [h('span', { class: 'back', 'aria-hidden': 'true' }), h('b', {}, `${n}장`), mine ? h('small', {}, '눌러서 뒤집기') : null].filter(Boolean);
  // 카드가 날아가는 모습: 종을 맞게 치면 펼쳐진 카드가 친 사람 더미로, 틀리면 카드 한 장이 친구 더미로
  function fly(els, to) {
    const t = to.getBoundingClientRect();
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const c = el.cloneNode(true);
      c.classList.remove('in');
      c.classList.add('fly');
      Object.assign(c.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0' });
      document.body.append(c);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transform = `translate(${(t.left + t.width / 2 - (r.left + r.width / 2)).toFixed(0)}px, ${(t.top + t.height / 2 - (r.top + r.height / 2)).toFixed(0)}px) scale(.35)`;
        c.style.opacity = '0';
      }));
      setTimeout(() => c.remove(), 700);
    }
  }
  function render(fx = null) {
    if (!st) return;
    oppDeck.replaceChildren(...deckFace(st.deck[opp].length, false));
    myDeck.replaceChildren(...deckFace(st.deck[meP].length, true));
    oppPile.replaceChildren(fruitCard(R.Fruit.top(st, opp), fx && fx.flip === opp ? 'in' : ''), h('small', {}, st.pile[opp].length ? `${st.pile[opp].length}장 쌓임` : ''));
    myPile.replaceChildren(fruitCard(R.Fruit.top(st, meP), fx && fx.flip === meP ? 'in' : ''), h('small', {}, st.pile[meP].length ? `${st.pile[meP].length}장 쌓임` : ''));
    const can = R.Fruit.canFlip(st, meP) && !pend && !flow.over && alive;
    myDeck.disabled = !can;
    myDeck.classList.toggle('can', can);
    bell.disabled = !!st.over || flow.over;
    shell.sub('me', `카드 ${st.deck[meP].length}장`);
    shell.sub('opp', `카드 ${st.deck[opp].length}장`);
    if (!st.over && !flow.over) {
      shell.turn(st.turn === meP ? 'me' : 'opp');
      if (!pend) shell.say(st.turn === meP ? (st.deck[meP].length ? '내 차례예요! 내 카드 더미를 눌러 뒤집어요.' : '뒤집을 카드가 없어요! 다섯 개가 보이면 얼른 종을 쳐요.') : `${josa(oppName, '이', '가')} 뒤집을 차례예요. 같은 과일 다섯 개를 찾아요!`);
    }
  }
  function tickClock() {
    if (!st || st.over) return;
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timer.querySelector('b').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    timer.querySelector('i').style.width = `${Math.max(0, Math.min(100, (left / R.FRUIT_TIME) * 100))}%`;
    timer.classList.toggle('low', left <= 20);
  }
  function begin(r, seed) {
    for (const t of aiT) clearTimeout(t);
    aiT = []; clearTimeout(stuckT); clearTimeout(endT);
    if (pend) { clearTimeout(pend.t); pend = null; }
    st = R.Fruit.init(seed, { first: (r - 1) % 2 });
    evN = 0;
    buf.clear();
    shell.acts();
    deadline = Date.now() + R.FRUIT_TIME * 1000;
    clearInterval(clock);
    clock = setInterval(tickClock, 250);
    tickClock();
    shownAt = performance.now();
    if (isHost) endT = setTimeout(() => { if (alive && st && !st.over) hostDo({ k: 'end', why: 'time' }); }, R.FRUIT_TIME * 1000);
    render();
    afterEvent();
  }
  // 판을 바꾸는 일 하나 (초대한 쪽이 정하고 친구에게 알린다)
  function applyEv(e) {
    if (e.k === 'flip') {
      const c = R.Fruit.flip(st, e.p);
      if (c == null) return false;
      sfx.card();
      render({ flip: e.p });
    } else if (e.k === 'ring') {
      const res = R.Fruit.ring(st, e.p);
      if (!res) return false;
      const who = e.p === meP ? '내가' : josa(oppName, '이', '가');
      bell.classList.remove('hit'); void bell.offsetWidth; bell.classList.add('hit');
      if (res.ok) {
        sfx.bell();
        shell.banner(`땡! ${who} 먼저!`, `카드 ${res.n}장을 가져갔어요`, 1600);
        fly([...shell.main.querySelectorAll('.fr-pile .fcard:not(.none)')], e.p === meP ? myDeck : oppDeck);
      } else {
        sfx.bonk();
        shell.banner('앗, 다섯 개가 아니에요!', res.n ? `${who} 카드 한 장을 줬어요` : '', 1600);
        if (res.n) fly([(e.p === meP ? myDeck : oppDeck).querySelector('.back')].filter(Boolean), e.p === meP ? oppDeck : myDeck);
      }
      render();
    } else if (e.k === 'end') {
      R.Fruit.end(st, e.why);
      if (e.why === 'stuck') shell.say(st.over.winner === meP ? `${josa(oppName, '은', '는')} 뒤집을 카드가 없어요.` : '뒤집을 카드가 없어요.');
      if (e.why === 'time') shell.say('3분이 다 됐어요! 카드가 많은 사람이 이겨요.');
    } else return false;
    evN++;
    shownAt = performance.now();
    updateSums();
    if (st.over) {
      clearInterval(clock);
      for (const t of aiT) clearTimeout(t);
      clearTimeout(stuckT); clearTimeout(endT);
      render();
      setTimeout(() => { if (alive) flow.finish(st.over); }, 900);
    }
    return true;
  }
  function updateSums() {
    // 숲지기 솔과 '쉬움'으로 할 때만 보이는 과일 수를 적어 준다 (세는 연습)
    if (session || lv !== 'easy') { sums.textContent = ''; return; }
    const s = R.Fruit.sums(st);
    const parts = R.FRUITS.map((f, i) => (s[i] ? `${f.name} ${s[i]}` : null)).filter(Boolean);
    sums.textContent = parts.length ? parts.join(' · ') : '';
  }
  function hostDo(e) {
    if (!alive || !st || st.over) return;
    if (!applyEv(e)) return;
    if (remote) session.send('ev', { r: flow.round, n: evN - 1, e });
    afterEvent();
  }
  // 초대한 쪽: 컴퓨터 차례, 카드가 없을 때, 종 기다리기
  function afterEvent() {
    if (!isHost || !st || st.over) return;
    for (const t of aiT) clearTimeout(t);
    aiT = [];
    clearTimeout(stuckT);
    const v = st.v;
    if (aiP >= 0) {
      const five = R.Fruit.five(st);
      // 다섯 개가 보이면 종을 치고, 아니면 아주 가끔 잘못 친다. 다섯 개가 보일 때는 뒤집기를 늦춰 사람에게도 칠 틈을 준다
      const rd = R.fruitRingDelay(lv, five);
      if (rd != null) aiT.push(setTimeout(() => { if (alive && st && st.v === v) hostRing(aiP, rd, v); }, rd));
      if (st.turn === aiP && R.Fruit.canFlip(st, aiP)) {
        const fd = 750 + Math.random() * 600 + (five ? 1600 : 0);
        aiT.push(setTimeout(() => { if (alive && st && st.v === v && !pend) hostDo({ k: 'flip', p: aiP }); }, fd));
      }
    }
    if (R.Fruit.stuck(st)) stuckT = setTimeout(() => { if (alive && st && st.v === v && !pend && R.Fruit.stuck(st)) hostDo({ k: 'end', why: 'stuck' }); }, 2800);
  }
  function hostRing(p, rt, v) {
    if (!st || st.over || v !== st.v) return;
    if (!pend) {
      pend = { v, list: [] };
      pend.t = setTimeout(() => {
        const pd = pend;
        pend = null;
        if (!pd || !st || st.v !== pd.v) return;
        pd.list.sort((a, b) => a.rt - b.rt);
        hostDo({ k: 'ring', p: pd.list[0].p });
      }, WINDOW);
    }
    if (pend.list.some((x) => x.p === p)) return;
    pend.list.push({ p, rt });
  }
  function flip() {
    if (!st || st.over || flow.over || pend || !R.Fruit.canFlip(st, meP)) return;
    if (isHost) hostDo({ k: 'flip', p: meP });
    else { session.send('in', { r: flow.round, a: 'flip', v: st.v }); myDeck.disabled = true; }
  }
  function ring() {
    if (!st || st.over || flow.over) return;
    const now = performance.now();
    if (now < myCool) return;
    myCool = now + 600;
    const rt = Math.round(now - shownAt);
    bell.classList.remove('press'); void bell.offsetWidth; bell.classList.add('press');
    sfx.tap();
    if (isHost) hostRing(meP, rt, st.v);
    else session.send('in', { r: flow.round, a: 'ring', v: st.v, rt });
  }
  function onKey(e) {
    if (!alive || e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); ring(); } else if (e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); flip(); }
  }
  window.addEventListener('keydown', onKey);
  function onMsg(m) {
    if (isHost && m.t === 'in' && m.r === flow.round && st && !st.over) {
      const gp = opp; // 초대받은 친구
      if (m.a === 'flip' && m.v === st.v && !pend && R.Fruit.canFlip(st, gp)) hostDo({ k: 'flip', p: gp });
      else if (m.a === 'ring' && Number.isInteger(m.v)) hostRing(gp, Math.max(0, Math.min(20000, Number(m.rt) || 0)), m.v);
      return;
    }
    if (!isHost && m.t === 'ev' && Number.isInteger(m.r) && Number.isInteger(m.n) && m.e && typeof m.e === 'object') {
      if (m.r < flow.round) return;
      buf.set(`${m.r}:${m.n}`, m.e);
      drain();
    }
  }
  function drain() {
    while (st && buf.has(`${flow.round}:${evN}`)) {
      const e = buf.get(`${flow.round}:${evN}`);
      buf.delete(`${flow.round}:${evN}`);
      const ok = (e.k === 'flip' || e.k === 'ring') ? (e.p === 0 || e.p === 1) : e.k === 'end' && (e.why === 'time' || e.why === 'stuck');
      if (!ok || !applyEv(e)) { evN++; }
    }
  }
  return {
    begin: (r, seed) => { begin(r, seed); drain(); },
    onMsg,
    stop() {
      alive = false;
      for (const t of aiT) clearTimeout(t);
      clearTimeout(stuckT); clearTimeout(endT); clearInterval(clock);
      if (pend) clearTimeout(pend.t);
      window.removeEventListener('keydown', onKey);
    },
    state: () => st,
    idle: () => !!st && alive && !st.over && !flow.over && !pend,
  };
}

// ---------------------------------------------------------------------
// 놀이 화면 열기. 돌려주는 것: { stop(), state() }
// cfg: { session, level, opts, meName, meAv, oppName, oppAv, onExit, onCelebrate, onCheer }
// ---------------------------------------------------------------------
export function mountBoardGame(id, cfg) {
  const { session = null, level = 'normal', meName = '나', meAv, onExit, onCelebrate, onCheer } = cfg;
  const meP = session && !session.bot && !session.host ? 1 : 0;
  const oppName = session ? session.peerName : '숲지기 솔';
  const oppAv = session ? cfg.oppAv : GUIDE_AV;
  const opts = id === 'yut' ? cleanOpts(id, cfg.opts || (session && session.extra)) : {};
  let exited = false;
  const exit = () => { if (exited) return; exited = true; onExit(); };
  const shell = makeShell({ id, meName, meAv, oppName: session ? oppName : `${oppName}(${{ easy: '쉬움', normal: '보통', hard: '어려움' }[level] || '보통'})`, oppAv, onExit: exit });
  shell.exit = exit;
  let game = null;
  const flow = matchFlow({ shell, session, meP, oppName, onCelebrate, onCheer, begin: (r, seed) => game.begin(r, seed) });
  const cheer = (k) => { if (onCheer && k.startsWith('reach')) onCheer(k); };
  game = id === 'fruit'
    ? fruitGame({ shell, session, level, meP, oppName, flow })
    : turnGame(id, { shell, session, level, opts, meP, oppName, flow, cheer });
  const remote = !!(session && !session.bot);
  if (remote) {
    session.on('msg', (m) => {
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'start') flow.onStart(m);
      else if (m.t === 'again') flow.onAgain(m);
      else game.onMsg(m);
    }).on('left', () => { if (!exited) flow.onLeft(); });
  }
  if (!remote || session.host) flow.start(1);
  else { shell.say(`${josa(oppName, '이', '가')} 판을 차리고 있어요…`); }
  return {
    stop() {
      game.stop();
      flow.alive = false;
      shell.destroy();
    },
    state: () => ({ id, round: flow.round, over: flow.over, st: game.state(), meP, idle: game.idle() }),
  };
}
