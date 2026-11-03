// 진숲 어린이 마을 — 보드게임 섬: 놀이 고르기 창, 친구 방(2~4명), 놀이 화면과 여럿이 하는 흐름
// 탁자를 누르면 놀이 고르기 창이 열린다. 컴퓨터(숲지기 솔, 봄이, 튼튼이)와 하거나, 방을 만들어 마을 친구를 부른다.
// 빈자리에는 컴퓨터를 앉힐 수 있고, 윷놀이는 넷이면 2:2 편 놀이도 된다. 만칼라는 두 사람 놀이다.
// 놀이 화면은 마을 위에 덮이는 한 장의 화면이다. 마을의 내 주민은 탁자 의자에 앉아 있다.
// 방에서 할 때: 방을 연 사람(방장)이 판마다 씨앗과 자리를 'start'로 알리고, 모든 화면이 같은 수를 같은 차례로 둔다 ('mv').
// 컴퓨터 자리와 방을 나간 친구 자리는 방장 화면이 대신 둔다.
// 과일 종 치기는 빠르기를 겨루므로 방장 화면이 정한다: 다른 사람은 'in'(뒤집기, 종 치기)을 보내고, 방장이 'ev'로 알린다.
import { h, modal, confetti, josa, icon, toast } from './ui.js';
import { friendPicker } from './play.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';
import { sfx } from './sound.js';
import { VILLAGERS } from './villagers.js';
import * as R from './bg-rules.js';
import { VIEWS } from './bg-views.js';

export const BG_IDS = ['fruit', 'n77', 'code', 'mancala', 'yut', 'dots'];
export const bgKind = (id) => 'bg_' + id;
export const bgIdOf = (kind) => (typeof kind === 'string' && kind.startsWith('bg_') && BG_IDS.includes(kind.slice(3)) ? kind.slice(3) : null);
const GUIDE_AV = { skin: 2, eyes: 'smile', eyeColor: 1, brows: 'soft', nose: 'round', mouth: 'grin', cheek: 'pink', hair: 'short', hairColor: 2, outfit: 'overall', outfitColor: 4, bottomColor: 3, shoeColor: 5, hat: 'straw', hatColor: 4 };
// 컴퓨터 친구 셋 (마을에 사는 친구들)
export const CPUS = [
  { name: '숲지기 솔', short: '솔', av: GUIDE_AV },
  { name: VILLAGERS[0].name, short: VILLAGERS[0].name.slice(0, 1), av: VILLAGERS[0].av },
  { name: VILLAGERS[1].name, short: VILLAGERS[1].name.slice(0, 1), av: VILLAGERS[1].av },
];
const LEVELS = [['easy', '쉬움', '🌱'], ['normal', '보통', '🌳'], ['hard', '어려움', '🏔️']];
const LEVEL_NAME = { easy: '쉬움', normal: '보통', hard: '어려움' };
// 자리 색 (1번 빨강, 2번 파랑, 3번 초록, 4번 노랑). 윷놀이 편 놀이는 1·3번 빨강 편, 2·4번 파랑 편
export const SEAT_COLORS = ['#E5484D', '#4D7DDB', '#3FA34D', '#DE9A12'];

// 놀이마다 이름, 짧은 소개, 하는 법 (규칙은 js/bg-rules.js와 똑같이 적는다)
export const BG_INFO = {
  fruit: {
    name: '과일 종 치기', icon: '🔔', line: '같은 과일이 꼭 다섯 개면 땡! 누가 먼저 칠까요? (2~4명)',
    how: [
      ['차례로 뒤집어요', '내 차례에 아래쪽 내 카드 더미를 누르면 맨 위 카드가 펼쳐져요. 카드는 모두 똑같이 나눠 가져요.'],
      ['다섯 개면 땡!', '펼쳐진 카드들에 같은 과일이 꼭 다섯 개 보이면 가운데 종을 먼저 눌러요. 펼쳐진 카드를 모두 가져와요.'],
      ['틀리면 한 장씩 줘요', '다섯 개가 아닌데 종을 치면 다른 사람에게 카드를 한 장씩 줘요. 내 차례에 뒤집을 카드가 없으면 나가요. 마지막까지 남거나, 3분이 지났을 때 카드가 가장 많은 사람이 이겨요.'],
    ],
  },
  n77: {
    name: '77 피하기', icon: '🃏', line: '합계가 11, 22, 33… 이나 77이 되지 않게 카드를 내요. (2~4명)',
    how: [
      ['한 장씩 내요', '내 카드 네 장 가운데 하나를 내면 그 수만큼 합계가 커져요. 낸 뒤에 한 장을 새로 가져와요. 합계는 머릿속으로 셈해요.'],
      ['11의 배수와 77은 피해요', '합계가 11, 22, 33, 44, 55, 66이 되거나 77 이상이 되면 생명 하나를 잃고 합계는 0부터 다시 시작해요.'],
      ['특별한 카드', '0은 합계 그대로, −10은 합계를 10 줄여요(0보다 작아지지 않아요). ‘두 번!’을 내면 다음 사람이 카드를 두 장 연달아 내야 해요. 생명 셋을 다 잃으면 나가고, 마지막까지 남은 사람이 이겨요.'],
    ],
  },
  code: {
    name: '숫자 암호', icon: '🔢', line: '친구들이 숨긴 숫자 타일을 추리해서 맞혀요. (2~4명)',
    how: [
      ['작은 수부터 늘어놓아요', '0부터 11까지 숫자 타일이 해(밝은 색)와 밤(어두운 색)으로 하나씩 있어요. 셋까지는 네 장, 넷이면 세 장씩 가져요. 내 타일은 작은 수부터, 같은 수면 밤 타일이 왼쪽이에요.'],
      ['가져오고 맞혀요', '내 차례에 타일을 한 장 가져온 뒤, 다른 사람의 숨은 타일 하나를 골라 숫자를 말해요. 맞히면 그 타일이 열리고, 한 번 더 맞히거나 멈출 수 있어요. 멈추면 가져온 타일은 숨긴 채 내 줄에 들어가요.'],
      ['틀리면 들켜요', '틀리면 가져온 타일을 보이게 내 줄에 놓아요(가져올 타일이 없을 때는 내 숨은 타일 하나를 보여 줘요). 타일이 다 열린 사람은 나가고, 마지막까지 숨은 타일이 남은 사람이 이겨요.'],
    ],
  },
  mancala: {
    name: '만칼라', icon: '🪨', line: '돌을 한 알씩 놓아 내 창고에 더 많이 모아요. (두 사람)',
    how: [
      ['돌을 한 알씩 놓아요', '아래쪽 여섯 구멍이 내 구멍이에요. 하나를 누르면 그 돌을 모두 집어 오른쪽(시계 반대 방향)으로 한 구멍에 한 알씩 놓아요. 내 창고는 오른쪽 끝이고, 친구 창고는 건너뛰어요.'],
      ['창고에 쏙 들어가면 한 번 더', '마지막 돌이 내 창고에 들어가면 한 번 더 해요.'],
      ['빈 구멍이면 잡아요', '마지막 돌이 내 빈 구멍에 들어가고 맞은편 친구 구멍에 돌이 있으면, 두 구멍 돌을 모두 내 창고로 가져와요. 한쪽 구멍이 다 비면 끝나요. 남은 돌은 그 주인의 창고로 가고, 창고에 돌이 많은 사람이 이겨요.'],
    ],
  },
  yut: {
    name: '윷놀이', icon: '🎋', line: '윷을 던져 말을 옮겨요. 넷이면 2:2 편 놀이도 해요. (2~4명)',
    how: [
      ['윷을 던져요', '도 1칸, 개 2칸, 걸 3칸, 윷 4칸, 모 5칸. 표시된 가락 하나만 엎어지면 빽도라서 1칸 뒤로 가요. 윷이나 모가 나오면 한 번 더 던져요.'],
      ['말을 옮겨요', '나온 수를 골라 말을 눌러요. 모서리나 가운데에 딱 멈추면 다음에는 지름길로 가요. 같은 편 말끼리 만나면 업혀서 같이 다녀요. 편 놀이에서는 같은 편이 말을 함께 써요.'],
      ['잡으면 한 번 더', '다른 편 말이 있는 곳에 멈추면 잡아서 처음으로 돌려보내고 한 번 더 던져요. 출발점에 닿거나 지나면 말이 들어와요. 우리 편 말이 모두 먼저 들어오면 이겨요.'],
    ],
  },
  dots: {
    name: '땅따먹기', icon: '✏️', line: '점과 점을 이어 네모를 닫으면 내 땅! (2~4명)',
    how: [
      ['선을 하나씩 그어요', '차례로 이웃한 두 점 사이에 선을 하나 그어요. 둘이면 16칸, 셋이나 넷이면 25칸 판이에요.'],
      ['네모를 닫으면 내 땅', '네모의 네 번째 선을 그으면 그 칸이 내 땅이 되고, 한 번 더 그어요.'],
      ['땅이 많으면 이겨요', '모든 칸이 차면 땅이 가장 많은 사람이 이겨요. 네모에 셋째 선을 긋기 전에 잘 생각해요!'],
    ],
  },
};

function readPref(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
function writePref(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* 이번만 */ } }
const levelOf = (id) => { const v = readPref('kv.bgLevel.' + id, 'normal'); return LEVELS.some(([k]) => k === v) ? v : 'normal'; };
const countOf = (id) => Math.max(2, Math.min(R.MAX_PLAYERS[id], Number(readPref('kv.bgN.' + id, 2)) || 2));
// 윷놀이 설정: 말 수(2, 4), 편 놀이
function yutOpts() {
  const pieces = Number(readPref('kv.bgOpt.yut', 2)) === 4 ? 4 : 2;
  return { pieces, team: readPref('kv.bgTeam.yut', '0') === '1' };
}
// 친구가 보낸 놀이 설정 읽기 (모르는 값이면 기본값)
function cleanOpts(id, o, n) {
  if (id !== 'yut') return {};
  const x = o && typeof o === 'object' ? o : {};
  return { pieces: Number(x.pieces) === 4 ? 4 : 2, team: !!x.team && n === 4 };
}
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
// 체험판 시험용: window.kvBgSpeed로 컴퓨터가 생각하는 시간만 줄인다 (보통은 1)
const aiSpeed = () => (typeof window !== 'undefined' && window.kvBgSpeed > 1 ? window.kvBgSpeed : 1);
function faceCv(av, cls = 'bg-face') {
  const cv = h('canvas', { width: 80, height: 80, class: cls, 'aria-hidden': 'true' });
  try { drawFaceIcon(cv, normalizeAvatar(av)); } catch (e) { /* 얼굴 없이 */ }
  return cv;
}
// 자리 하나: { id } 사람(나나 친구), { cpu } 컴퓨터 친구, { id, bot } 체험판 예시 친구(컴퓨터가 둔다)
// 보내는 모양은 { i: id, c: cpu, b: 1 }
const packSeat = (s) => (s.cpu != null ? { c: s.cpu } : s.bot ? { i: s.id, b: 1 } : { i: s.id });
function unpackSeats(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 4) return null;
  const out = [];
  for (const x of list) {
    if (!x || typeof x !== 'object') return null;
    if (Number.isInteger(x.c) && x.c >= 0 && x.c < CPUS.length) out.push({ cpu: x.c });
    else if (typeof x.i === 'string' && x.i.length < 80) out.push(x.b ? { id: x.i, bot: true } : { id: x.i });
    else return null;
  }
  return out;
}

// ---------------------------------------------------------------------
// 놀이 고르기 창: 하는 법, 컴퓨터와 하기(사람 수, 난이도), 친구와 하기(방 만들기)
// ---------------------------------------------------------------------
export function boardMenu(id, { hub, onlineFriends, getPerson, myAv, onStart }) {
  const info = BG_INFO[id];
  const max = R.MAX_PLAYERS[id];
  let tok = 0;
  const start = (how) => { tok++; modal.close(); onStart(id, how); };
  const chip = (label, on, onclick) => h('button', { type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onclick }, label);
  function body() {
    const n = countOf(id);
    const yo = yutOpts();
    const team = id === 'yut' && n === 4 && yo.team;
    const cpuNames = Array.from({ length: n - 1 }, (_, k) => CPUS[k].name);
    const vs = team ? `나와 ${CPUS[1].name} 편, ${josa(CPUS[0].name, '과', '와')} ${CPUS[2].name} 편` : cpuNames.join(', ');
    const soloSeats = () => [{ id: 'me' }, ...Array.from({ length: n - 1 }, (_, k) => ({ cpu: k }))];
    return h('div', { class: 'mem game bg-menu' },
      h('p', { class: 'bg-line' }, `${info.icon} ${info.line}`),
      h('section', { class: 'guide compact' },
        h('h3', {}, `${josa(info.name, '은', '는')} 이렇게 해요`),
        h('ol', { class: 'guide-steps' }, info.how.map(([b, s]) => h('li', {}, h('b', {}, b), h('span', {}, s))))),
      id === 'yut' ? h('div', { class: 'bg-opts', role: 'group', 'aria-label': '말 수' },
        chip('말 2개 (빨리 끝나요)', yo.pieces === 2, () => { writePref('kv.bgOpt.yut', 2); modal.setBody(body()); }),
        chip('말 4개 (오래 해요)', yo.pieces === 4, () => { writePref('kv.bgOpt.yut', 4); modal.setBody(body()); })) : null,
      h('div', { class: 'sub-head' }, h('h3', {}, '컴퓨터 친구와 하기'), h('p', {}, max > 2 ? '몇 명이서 할까요?' : '난이도를 골라요')),
      max > 2 ? h('div', { class: 'bg-opts', role: 'group', 'aria-label': '사람 수' },
        [2, 3, 4].map((k) => chip(`${k === 2 ? '둘' : k === 3 ? '셋' : '넷'}이서`, n === k, () => { writePref('kv.bgN.' + id, k); modal.setBody(body()); })),
        id === 'yut' && n === 4 ? chip('2:2 편 놀이', yo.team, () => { writePref('kv.bgTeam.yut', yo.team ? '0' : '1'); modal.setBody(body()); }) : null) : null,
      h('p', { class: 'bg-vs' }, `함께하는 컴퓨터 친구: ${vs}`),
      h('div', { class: 'mode-pick levels' }, LEVELS.map(([lv, name, ic]) => h('button', {
        class: 'mode' + (lv === levelOf(id) ? ' last' : ''), type: 'button', 'data-level': lv,
        onclick: () => { writePref('kv.bgLevel.' + id, lv); start({ level: lv, seats: soloSeats(), opts: id === 'yut' ? { pieces: yo.pieces, team } : {} }); },
      }, h('b', {}, `${ic} ${name}`), h('span', {}, { easy: '살살 해요. 처음 해 보는 친구에게 좋아요.', normal: '컴퓨터 친구들이 평소처럼 해요.', hard: '꼼꼼히 따져요. 이겨 보세요!' }[lv])))),
      h('div', { class: 'sub-head' }, h('h3', {}, '마을 친구와 하기'), h('p', {}, max > 2 ? `${max}명까지` : '두 사람')),
      h('p', { class: 'bg-vs' }, max > 2 ? '방을 만들고 지금 마을에 있는 친구들을 불러요. 빈자리에는 컴퓨터 친구를 앉힐 수 있어요.' : '방을 만들고 지금 마을에 있는 친구 한 명을 불러요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go', type: 'button', onclick: () => { tok++; lobby(id, { hub, onlineFriends, getPerson, myAv, onStart, back: () => boardMenu(id, { hub, onlineFriends, getPerson, myAv, onStart }) }); } }, '방 만들기')));
  }
  modal.open(info.name, body(), { cls: 'game-sheet', onClose: () => { tok++; } });
}

// ---------------------------------------------------------------------
// 방장 대기실: 자리마다 친구를 부르거나 컴퓨터를 앉히고, 다 모이면 시작
// ---------------------------------------------------------------------
function lobby(id, { hub, onlineFriends, getPerson, myAv, onStart, back }) {
  const info = BG_INFO[id];
  const max = R.MAX_PLAYERS[id];
  const room = hub.openRoom(bgKind(id), null);
  // 자리: { id, state: 'me' | 'wait' | 'in' } 사람, { cpu } 컴퓨터, { id, bot: true } 체험판 예시 친구
  const seats = [{ id: 'me', state: 'me' }];
  let picking = false, started = false;
  const yo = yutOpts();
  let pieces = yo.pieces, team = yo.team;
  const name = (s) => (s.cpu != null ? CPUS[s.cpu].name : s.state === 'me' ? '나 (방장)' : (getPerson(s.id) || {}).name || '친구');
  const freeCpu = () => [0, 1, 2].find((k) => !seats.some((s) => s.cpu === k));
  const realSeats = () => seats.filter((s) => s.cpu != null || s.bot || s.state === 'me' || s.state === 'in');
  function broadcast() {
    if (started) return;
    room.send('lobby', { seats: seats.filter((s) => s.state !== 'wait').map((s) => (s.state === 'me' ? { i: room.hostId } : packSeat(s))), o: { pieces, team: team && seats.length === 4 }, host: room.hostId });
  }
  function remove(s) {
    const i = seats.indexOf(s);
    if (i <= 0) return;
    seats.splice(i, 1);
    if (s.state === 'wait') room.cancelInvite(s.id);
    if (s.state === 'in') { room.send('kick', { to: s.id }); room.members.delete(s.id); }
    if (s.bot) { room.bots.delete(s.id); }
    draw();
    broadcast();
  }
  function invite(f) {
    if (seats.length >= max || seats.some((s) => s.id === f.id)) return;
    const s = { id: f.id, state: 'wait' };
    seats.push(s);
    picking = false;
    draw();
    room.invite(f.id).then((r) => {
      if (started || !seats.includes(s)) return;
      if (r.ok) {
        if (r.bot) { s.bot = true; s.state = 'in'; } else s.state = 'in';
        sfx.pop();
      } else {
        seats.splice(seats.indexOf(s), 1);
        const why = { locked: '아직 놀이 마당이 안 열렸대요', busy: '지금 다른 놀이를 하고 있어요', no: '다음에 하재요', timeout: '대답이 없어요', off: '연결되지 않아요' }[r.reason] || '함께할 수 없어요';
        if (r.reason !== 'cancel') toast(`${josa(f.name, '은', '는')} ${why}.`, 2600);
      }
      draw();
      broadcast();
    });
  }
  function draw() {
    if (started) return;
    const ready = seats.length >= 2 && !seats.some((s) => s.state === 'wait');
    const tm = id === 'yut' && team && seats.length === 4;
    const rows = seats.map((s, i) => {
      const av = s.cpu != null ? CPUS[s.cpu].av : s.state === 'me' ? null : (getPerson(s.id) || {}).avatar;
      const col = tm ? SEAT_COLORS[i % 2] : SEAT_COLORS[i];
      return h('div', { class: `lb-seat${s.state === 'wait' ? ' wait' : ''}`, style: `--c:${col}` },
        h('span', { class: 'lb-no' }, String(i + 1)),
        faceCv(s.state === 'me' ? myAv : av, 'lb-face'),
        h('span', { class: 'lb-name' }, h('b', {}, name(s)), h('small', {}, s.state === 'me' ? '방을 만들었어요' : s.state === 'wait' ? '물어보는 중…' : s.cpu != null ? '컴퓨터 친구' : s.bot ? '예시 친구 (컴퓨터가 둬요)' : '들어왔어요'),
          tm ? h('small', { class: 'lb-team' }, i % 2 === 0 ? '빨강 편' : '파랑 편') : null),
        i > 0 ? h('button', { class: 'lb-x', type: 'button', 'aria-label': `${name(s)} 빼기`, onclick: () => remove(s) }, '×') : null);
    });
    const friends = onlineFriends().filter((f) => !seats.some((s) => s.id === f.id));
    modal.setTitle(`${info.name} · 친구와 하기`);
    modal.setBody(h('div', { class: 'mem game bg-lobby' },
      h('p', { class: 'bg-line' }, max > 2 ? `친구들을 불러 모아요. 모두 ${max}명까지 함께해요.` : '친구 한 명을 불러요.'),
      h('div', { class: 'lb-seats' }, rows),
      seats.length < max ? h('div', { class: 'row' },
        h('button', { class: `btn btn-soft${picking ? ' on' : ''}`, type: 'button', onclick: () => { picking = !picking; draw(); } }, '친구 부르기'),
        max > 2 && freeCpu() != null ? h('button', { class: 'btn btn-soft', type: 'button', onclick: () => { seats.push({ cpu: freeCpu() }); draw(); broadcast(); } }, '컴퓨터 친구 앉히기') : null) : null,
      picking ? friendPicker(friends, (f) => invite(f), '지금 마을에 있는 친구가 없어요. 친구가 들어오면 여기에 보여요.') : null,
      id === 'yut' ? h('div', { class: 'bg-opts', role: 'group', 'aria-label': '윷놀이 설정' },
        h('button', { type: 'button', class: `chip${pieces === 2 ? ' on' : ''}`, onclick: () => { pieces = 2; writePref('kv.bgOpt.yut', 2); draw(); broadcast(); } }, '말 2개'),
        h('button', { type: 'button', class: `chip${pieces === 4 ? ' on' : ''}`, onclick: () => { pieces = 4; writePref('kv.bgOpt.yut', 4); draw(); broadcast(); } }, '말 4개'),
        seats.length === 4 ? h('button', { type: 'button', class: `chip${team ? ' on' : ''}`, 'aria-pressed': team ? 'true' : 'false', onclick: () => { team = !team; writePref('kv.bgTeam.yut', team ? '1' : '0'); draw(); broadcast(); } }, '2:2 편 놀이') : null) : null,
      id === 'yut' && seats.length === 4 && team ? h('p', { class: 'bg-vs' }, '1·3번 자리가 빨강 편, 2·4번 자리가 파랑 편이에요. 같은 편은 말을 함께 쓰고, 두 편이 번갈아 던져요.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { room.close(); started = true; back(); } }, '방 닫기'),
        h('button', { class: 'btn btn-go', type: 'button', disabled: !ready, onclick: go }, ready ? `${realSeats().length}명이서 시작하기` : '친구를 기다려요'))));
  }
  function go() {
    if (started) return;
    const list = realSeats();
    if (list.length < 2) return;
    started = true;
    const s2 = list.map((s) => (s.state === 'me' ? { id: room.hostId } : s.cpu != null ? { cpu: s.cpu } : s.bot ? { id: s.id, bot: true } : { id: s.id }));
    // 오지 않은 친구 초대는 거둔다
    for (const s of seats) if (s.state === 'wait') room.cancelInvite(s.id);
    modal.close();
    onStart(id, { room, seats: s2, level: 'normal', opts: id === 'yut' ? { pieces, team: team && s2.length === 4 } : {} });
  }
  room.on('msg', (m, from) => {
    if (m.t === 'hello') broadcast();
  }).on('left', (who) => {
    const s = seats.find((x) => x.id === who);
    if (s && !started) { seats.splice(seats.indexOf(s), 1); toast(`${josa((getPerson(who) || {}).name || '친구', '이', '가')} 방에서 나갔어요.`, 2400); draw(); broadcast(); }
  });
  // 친구가 들어오면 자리를 알린다 (들어온 뒤 'hello'를 보내 온다)
  modal.open(`${info.name} · 친구와 하기`, h('div'), { cls: 'game-sheet', onClose: () => { if (!started) { started = true; room.close(); } } });
  draw();
}

// ---------------------------------------------------------------------
// 초대받은 친구의 대기실: 방장이 시작하기를 기다린다
// ---------------------------------------------------------------------
export function joinRoom(id, room, { getPerson, myId, myAv, onStart }) {
  const info = BG_INFO[id];
  let seats = null, o = {}, done = false, heard = false;
  const early = []; // 시작 소식보다 먼저 온 수 (놀이 화면이 열리면 넘겨준다)
  const hostName = room.nameOf(room.hostId);
  const draw = (msg = null) => {
    if (done) return;
    const rows = (seats || []).map((s, i) => {
      const nm = s.cpu != null ? CPUS[s.cpu].name : s.id === myId ? '나' : (getPerson(s.id) || {}).name || '친구';
      const av = s.cpu != null ? CPUS[s.cpu].av : (getPerson(s.id) || {}).avatar;
      return h('div', { class: 'lb-seat', style: `--c:${o.team ? SEAT_COLORS[i % 2] : SEAT_COLORS[i]}` }, h('span', { class: 'lb-no' }, String(i + 1)), faceCv(s.id === myId ? myAv : av, 'lb-face'),
        h('span', { class: 'lb-name' }, h('b', {}, nm), h('small', {}, s.id === room.hostId ? '방장' : s.cpu != null || s.bot ? '컴퓨터 친구' : '친구'), o.team ? h('small', { class: 'lb-team' }, i % 2 === 0 ? '빨강 편' : '파랑 편') : null));
    });
    modal.setBody(h('div', { class: 'mem game bg-lobby' },
      h('p', { class: 'bg-line' }, msg || `${josa(hostName, '이', '가')} 만든 방이에요. 방장이 시작하면 바로 놀이가 열려요.`),
      seats ? h('div', { class: 'lb-seats' }, rows) : h('div', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      id === 'yut' && seats ? h('p', { class: 'bg-vs' }, `말 ${o.pieces === 4 ? 4 : 2}개${o.team ? ' · 2:2 편 놀이' : ''}`) : null,
      h('div', { class: 'row' }, h('button', { class: msg ? 'btn btn-go' : 'btn btn-plain', type: 'button', onclick: () => leave() }, msg ? '돌아가기' : '방에서 나가기'))));
  };
  const leave = () => { if (!done) { done = true; room.close(); } modal.close(); };
  room.on('msg', (m) => {
    if (done) return;
    if (m.t === 'lobby') {
      heard = true;
      const s = unpackSeats(m.seats);
      if (s || Array.isArray(m.seats)) { seats = s || (m.seats || []).map((x) => (Number.isInteger(x.c) ? { cpu: x.c } : { id: x.i, bot: !!x.b })); o = m.o && typeof m.o === 'object' ? m.o : {}; draw(); }
      if (Array.isArray(m.seats)) room.setMembers(m.seats.filter((x) => typeof x.i === 'string' && !x.b).map((x) => x.i));
    } else if (m.t === 'mv' || m.t === 'ev') {
      if (early.length < 200) early.push(m);
    } else if (m.t === 'start') {
      const s = unpackSeats(m.seats);
      if (!s || !s.some((x) => x.id === myId)) return;
      done = true;
      modal.close();
      onStart(id, { room, seats: s, level: 'normal', opts: cleanOpts(id, m.o, s.length), startMsg: m, early });
    } else if (m.t === 'kick' && m.to === myId) {
      done = false;
      draw('방장이 이번 판에서 나를 뺐어요. 다음에 같이 해요!');
      done = true;
      room.close();
    }
  }).on('left', (who) => {
    if (done || who !== room.hostId) return;
    draw('방장이 방을 닫았어요.');
    done = true;
    room.close();
  });
  modal.open(`${info.name} · ${hostName}의 방`, h('div'), { cls: 'game-sheet', onClose: () => { if (!done) { done = true; room.close(); } } });
  draw();
  room.send('hello', {});
  // 방장에게서 소식이 없으면 방이 없어진 것이다
  setTimeout(() => { if (!done && !heard) { draw('방을 찾을 수 없어요. 방장이 방을 닫았나 봐요.'); done = true; room.close(); } }, 12000);
}

// ---------------------------------------------------------------------
// 놀이 화면 틀: 위에 다른 사람들, 가운데 판, 아래에 나
// ---------------------------------------------------------------------
function makeShell({ id, players, meP, colorOf, onExit }) {
  const info = BG_INFO[id];
  const n = players.length;
  const subs = [], chips = [];
  players.forEach((pl, p) => {
    subs[p] = h('small', {});
    const nm = h('b', {}, p === meP ? '나' : pl.label);
    chips[p] = h('div', { class: `bg-who${p === meP ? ' me' : ''}`, style: `--c:${colorOf(p)}` }, faceCv(pl.av), h('span', { class: 'nm' }, nm, subs[p]));
    chips[p].nameEl = nm;
  });
  const order = Array.from({ length: n - 1 }, (_, k) => (meP + 1 + k) % n);
  const say = h('p', { class: 'bg-say', 'aria-live': 'polite' });
  const acts = h('div', { class: 'bg-acts' });
  const main = h('div', { class: `bg-main bg-${id}` });
  const bannerEl = h('div', { class: 'bg-banner', role: 'status' });
  const exit = h('button', { class: 'bg-exit', type: 'button', onclick: onExit }, icon('door'), '그만');
  const help = h('button', { class: 'bg-help', type: 'button', 'aria-label': '하는 법 보기', onclick: () => { helpBox.hidden = false; sfx.pop(true); } }, '?');
  const helpBox = h('div', { class: 'bg-howto', hidden: true, onclick: () => { helpBox.hidden = true; } },
    h('div', { class: 'card' }, h('h3', {}, `${info.name} 하는 법`), h('ol', { class: 'guide-steps' }, info.how.map(([b, s]) => h('li', {}, h('b', {}, b), h('span', {}, s)))), h('button', { class: 'btn btn-go', type: 'button' }, '알겠어요')));
  const root = h('div', { class: `bg-screen bg-is-${id} bg-n${n}`, role: 'dialog', 'aria-label': info.name },
    h('div', { class: 'bg-top' }, h('div', { class: 'bg-opps' }, order.map((p) => chips[p])), h('div', { class: 'bg-tools' }, h('span', { class: 'bg-title' }, `${info.icon} ${info.name}`), help, exit)),
    main,
    h('div', { class: 'bg-bottom' }, say, h('div', { class: 'bg-bar' }, chips[meP], acts)),
    bannerEl, helpBox);
  document.body.append(root);
  document.body.classList.add('bg-on');
  let bt = 0;
  return {
    root, main, order,
    say(t) { say.textContent = t || ''; },
    sub(p, t) { if (subs[p]) subs[p].textContent = t || ''; },
    rename(p, label) { if (chips[p] && p !== meP) chips[p].nameEl.textContent = label; },
    dim(p, on) { if (chips[p]) chips[p].classList.toggle('out', !!on); },
    turn(p) { chips.forEach((c, q) => c.classList.toggle('turn', q === p)); },
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
// 판 하나하나의 흐름: 시작, 한 판 더, 친구가 나감 (방장만 판을 시작한다)
// ---------------------------------------------------------------------
function matchFlow({ shell, room, seats, meP, myId, opts, players, team, onCelebrate, onCheer, begin, onSeatsChange }) {
  const isHost = !room || room.host;
  const f = { round: 0, over: false, wantAgain: false, wants: new Set(), alive: true, ended: false };
  // 지금 판에 있는 사람(사람만, 나 포함)
  const humans = () => seats.map((s) => (s.id && !s.bot && s.cpu == null && !s.gone ? s.id : null)).filter(Boolean);
  f.start = (r) => {
    const seed = newSeed();
    if (room) room.send('start', { r, seed, seats: seats.map((s) => (s.gone ? { c: s.sub } : packSeat(s))), o: opts });
    run(r, seed);
  };
  function run(r, seed) {
    f.round = r; f.over = false; f.wantAgain = false; f.wants.clear();
    begin(r, seed);
  }
  f.onStart = (m) => {
    if (isHost || !Number.isInteger(m.r) || m.r <= f.round || !Number.isInteger(m.seed)) return;
    // 다음 판 자리: 나간 친구 자리는 컴퓨터로
    const s2 = unpackSeats(m.seats);
    if (s2 && s2.length === seats.length) s2.forEach((x, p) => { if (x.cpu != null && seats[p].id && !seats[p].gone) { seats[p].gone = true; seats[p].sub = x.cpu; onSeatsChange(p); } });
    run(m.r, m.seed >>> 0);
  };
  const nameOf = (p) => players[p].label;
  f.finish = (over) => {
    f.over = true;
    const w = (over.winners || []).filter((p) => p >= 0 && p < seats.length);
    const mine = w.includes(meP);
    const alive = players.length;
    if (team && w.length === 2) {
      if (mine) { shell.banner('우리 편이 이겼어요!', '같이 해서 더 신나요', 3200); confetti(); if (onCelebrate) onCelebrate(); if (onCheer) onCheer('me'); } else { shell.banner(`${w.map(nameOf).join('·')} 편이 이겼어요`, '다음 판에 다시 해 봐요!', 3200); sfx.fail(); }
    } else if (!w.length || (w.length > 1 && w.length === alive && alive === 2)) { shell.banner('비겼어요!', '모두 정말 잘했어요', 3200); sfx.ding(); }
    else if (mine && w.length === 1) { shell.banner('내가 이겼어요!', '정말 잘했어요', 3200); confetti(); if (onCelebrate) onCelebrate(); if (onCheer) onCheer('me'); }
    else if (mine) { shell.banner('공동 1등이에요!', `${josa(w.filter((p) => p !== meP).map(nameOf).join(', '), '과', '와')} 함께`, 3200); confetti(); if (onCheer) onCheer('me'); }
    else { shell.banner(`${josa(w.map(nameOf).join(', '), '이', '가')} 이겼어요`, '다음 판에 다시 해 봐요!', 3200); sfx.fail(); if (onCheer) onCheer('opp'); }
    shell.say(mine ? '잘했어요! 한 판 더 할까요?' : '아쉬워요! 한 판 더 할까요?');
    f.drawAgain();
  };
  f.drawAgain = () => {
    if (!f.over) return;
    const quit = h('button', { class: 'btn btn-soft', type: 'button', onclick: () => shell.exit() }, '그만하기');
    if (f.ended) { shell.acts(h('button', { class: 'btn btn-go', type: 'button', onclick: () => shell.exit() }, '나가기')); return; }
    const others = humans().filter((x) => x !== myId);
    if (!room || !others.length) {
      // 사람이 나뿐이면 (컴퓨터와 하거나 친구들이 다 나갔으면) 바로 한 판 더
      if (isHost) { shell.acts(quit, h('button', { class: 'btn btn-go', type: 'button', onclick: () => f.start(f.round + 1) }, '한 판 더')); return; }
    }
    const waiting = isHost ? others.filter((x) => !f.wants.has(x)) : [];
    shell.acts(quit, h('button', {
      class: `btn btn-go${f.wants.size && !f.wantAgain ? ' pulse' : ''}`, type: 'button', disabled: f.wantAgain,
      onclick: () => {
        f.wantAgain = true;
        if (room) room.send('again', { r: f.round });
        f.checkAgain();
        f.drawAgain();
      },
    }, f.wantAgain ? (isHost ? '기다리는 중…' : '방장을 기다려요…') : f.wants.size ? '좋아, 한 판 더!' : '한 판 더'));
    if (f.wantAgain && isHost && waiting.length) shell.say(`${josa(waiting.map((x) => (seats.find((s) => s.id === x) ? nameOf(seats.findIndex((s) => s.id === x)) : '친구')).join(', '), '을', '를')} 기다리고 있어요…`);
    else if (f.wantAgain && !isHost) shell.say('방장이 다음 판을 시작하기를 기다려요…');
  };
  f.checkAgain = () => {
    if (!isHost || !f.over || !f.wantAgain) return;
    const others = humans().filter((x) => x !== myId);
    if (others.every((x) => f.wants.has(x))) f.start(f.round + 1);
  };
  f.onAgain = (m, from) => {
    if (!f.over || (Number.isInteger(m.r) && m.r !== f.round)) return;
    f.wants.add(from);
    const p = seats.findIndex((s) => s.id === from);
    if (p >= 0 && !f.wantAgain) shell.say(`${josa(nameOf(p), '이', '가')} 한 판 더 하재요!`);
    f.checkAgain();
    f.drawAgain();
  };
  // 친구가 나감: 방장이 나가면 끝, 다른 친구가 나가면 그 자리는 컴퓨터가 대신한다
  f.onLeft = (who) => {
    const p = seats.findIndex((s) => s.id === who && !s.gone);
    if (p < 0) return;
    const nm = nameOf(p);
    if (room && who === room.hostId) {
      f.ended = true;
      f.over = true;
      shell.banner('방장이 나갔어요', '놀이가 끝났어요. 다음에 또 해요!', 3000);
      shell.say(`방을 만든 ${josa(nm, '이', '가')} 나가서 놀이가 끝났어요.`);
      begin.stop && begin.stop();
      f.drawAgain();
      return;
    }
    seats[p].gone = true;
    seats[p].sub = [0, 1, 2].find((k) => !seats.some((s) => s.cpu === k || s.sub === k)) ?? 0;
    onSeatsChange(p);
    shell.banner(`${josa(nm, '이', '가')} 나갔어요`, '그 자리는 컴퓨터 친구가 대신해요', 2600);
    if (f.over) { f.checkAgain(); f.drawAgain(); }
  };
  return f;
}

// ---------------------------------------------------------------------
// 차례를 돌아가며 두는 놀이 다섯
// ---------------------------------------------------------------------
function turnGame(id, { shell, room, seats, level, opts, meP, players, flow, cheer, colorOf, sideColor }) {
  const T = R.TURN_GAMES[id];
  const isHost = !room || room.host;
  const n = seats.length;
  // 이 화면이 대신 두는 자리: 컴퓨터 자리, 예시 친구, 나간 친구 (방장 화면만)
  const cpuSeat = (p) => isHost && p !== meP && (seats[p].cpu != null || seats[p].bot || seats[p].gone);
  let st = null, pushed = 0, q = [], animating = false, aiT = 0, alive = true;
  const buf = new Map(); // 'r:n' → { p, a }
  const canAct = () => !!st && alive && !st.over && !flow.over && !animating && !q.length && st.turn === meP;
  const env = {
    main: shell.main, meP, n, level,
    others: () => shell.order,
    act: (a) => local(a),
    canAct,
    who: (p, t) => shell.sub(p, t),
    banner: (b, s, ms) => shell.banner(b, s, ms),
    acts: (...els) => { if (!flow.over) shell.acts(...els); },
    say: (t) => shell.say(t),
    name: (p) => (p === meP ? '나' : players[p].label),
    color: colorOf,
    sideColor,
  };
  const view = VIEWS[id](env);
  function begin(r, seed) {
    clearTimeout(aiT);
    q = []; pushed = 0; animating = false;
    st = T.rules.init(seed, { ...opts, n, first: (r - 1) % n });
    shell.acts();
    view.reset(st);
    step();
    drain();
  }
  function send(p, a) { if (room) room.send('mv', { r: flow.round, n: pushed, p, a }); }
  function local(a) {
    if (!canAct()) return false;
    let ok = false;
    try { ok = T.rules.legal(st, meP, a); } catch (e) { ok = false; }
    if (!ok) return false;
    send(meP, a);
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
    if (cheer) cheer(p === meP ? 'reach-me' : 'reach-opp');
    animating = true;
    let ms = 0;
    try { ms = view.play(ev, st) || 0; } catch (e) { console.error(e); }
    setTimeout(() => {
      if (!alive) return;
      animating = false;
      view.render(st);
      marks();
      if (st.over) { flow.finish(st.over); return; }
      step();
      pump();
      drain();
    }, ms);
  }
  // 판에서 나간 사람은 이름표를 흐리게
  function marks() { if (st.out) for (let p = 0; p < n; p++) shell.dim(p, st.out[p]); }
  function step() {
    if (!st || st.over) return;
    shell.turn(st.turn);
    shell.say(view.status(st));
    view.input();
    clearTimeout(aiT);
    if (cpuSeat(st.turn) && !q.length) {
      const r = flow.round, who = st.turn;
      aiT = setTimeout(() => {
        if (!alive || !st || st.over || st.turn !== who || animating || q.length || flow.round !== r || !cpuSeat(who)) return;
        let a = null;
        try { a = T.ai(st, who, level); } catch (e) { console.error(e); }
        if (a) { send(who, a); push(who, a); }
      }, (view.aiDelay ? view.aiDelay(st) : 900) / aiSpeed());
    }
  }
  // 다른 화면에서 둔 수를 차례대로
  function drain() {
    while (buf.has(`${flow.round}:${pushed}`)) {
      const m = buf.get(`${flow.round}:${pushed}`);
      buf.delete(`${flow.round}:${pushed}`);
      push(m.p, m.a);
    }
  }
  function onMsg(m) {
    if (m.t === 'mv' && Number.isInteger(m.r) && Number.isInteger(m.n) && Number.isInteger(m.p) && m.p >= 0 && m.p < n && m.a && typeof m.a === 'object') {
      if (m.r < flow.round || buf.size > 600) return;
      const key = `${m.r}:${m.n}`;
      if (!buf.has(key)) buf.set(key, { p: m.p, a: m.a });
      if (m.r === flow.round) drain();
    }
  }
  return {
    begin, onMsg,
    seatChanged: () => { if (st && !st.over && !animating && !q.length) step(); },
    stop() { alive = false; clearTimeout(aiT); },
    state: () => st,
    idle: () => canAct(),
  };
}

// ---------------------------------------------------------------------
// 과일 종 치기 (빠르기 놀이): 방장(또는 혼자) 화면이 판을 정한다
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
function fruitGame({ shell, room, seats, level, meP, myId, players, flow, colorOf }) {
  const isHost = !room || room.host;
  const n = seats.length;
  const cpuSeat = (p) => isHost && p !== meP && (seats[p].cpu != null || seats[p].bot || seats[p].gone);
  // 둘이 거의 같이 쳤을 때 누가 빨랐는지 기다리는 시간 (다른 화면의 사람이 있을 때만)
  const window_ = () => (room && seats.some((s, p) => p !== meP && s.id && !s.bot && !s.gone) ? 450 : 0);
  let st = null, evN = 0, shownAt = 0, pend = null, stuckT = 0, endT = 0, deadline = 0, aiT = [], myCool = 0, alive = true, clock = 0;
  const buf = new Map();
  const nm = (p) => (p === meP ? '나' : players[p].label);
  const subj = (p) => (p === meP ? '내가' : josa(players[p].label, '이', '가'));
  // 화면: 위에 다른 사람들의 더미, 가운데 종, 아래에 내 더미
  const timer = h('div', { class: 'fr-timer' }, h('i'), h('b', {}, '3:00'));
  const others = shell.order;
  const decks = {}, piles = {}, stations = {};
  for (const p of others) {
    decks[p] = h('div', { class: 'fr-deck opp' });
    piles[p] = h('div', { class: 'fr-pile' });
    stations[p] = h('div', { class: 'fr-st', style: `--c:${colorOf(p)}` }, h('span', { class: 'who-tag' }, h('i', { style: `background:${colorOf(p)}` }), nm(p)), piles[p], decks[p]);
  }
  piles[meP] = h('div', { class: 'fr-pile me' });
  decks[meP] = h('button', { class: 'fr-deck me', type: 'button', onclick: () => flip() });
  const bell = h('button', { class: 'fr-bell', type: 'button', 'aria-label': '종 치기', onclick: () => ring() },
    h('span', { class: 'bell', html: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="54" rx="24" ry="5" fill="#8B5E3C"/><path d="M10 50c0-4 2-6 4-8 1-10 4-22 18-24 14 2 17 14 18 24 2 2 4 4 4 8z" fill="#F2C14E"/><path d="M14 42c1-9 4-19 14-21" stroke="#FFE7A8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="32" cy="14" r="4.5" fill="#E0A92E"/></svg>' }),
    h('b', {}, '땡!'));
  const sums = h('p', { class: 'fr-sums', 'aria-live': 'polite' });
  shell.main.replaceChildren(h('div', { class: `fr-game fr-n${n}` }, timer, h('div', { class: 'fr-opps' }, others.map((p) => stations[p])), h('div', { class: 'fr-mid' }, bell), sums,
    h('div', { class: 'fr-mine' }, piles[meP], decks[meP])));
  const deckFace = (p, mine) => [h('span', { class: 'back', 'aria-hidden': 'true' }), h('b', {}, st.out[p] ? '나감' : `${st.deck[p].length}장`), mine && !st.out[p] ? h('small', {}, '눌러서 뒤집기') : null].filter(Boolean);
  // 카드가 날아가는 모습: 종을 맞게 치면 펼쳐진 카드가 친 사람 더미로, 틀리면 카드가 다른 사람 더미로
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
    for (let p = 0; p < n; p++) {
      decks[p].replaceChildren(...deckFace(p, p === meP));
      piles[p].replaceChildren(fruitCard(R.Fruit.top(st, p), fx && fx.flip === p ? 'in' : ''), h('small', {}, st.pile[p].length ? `${st.pile[p].length}장 쌓임` : ''));
      if (stations[p]) stations[p].classList.toggle('turn', st.turn === p && !st.over);
      stations[p] && stations[p].classList.toggle('out', !!st.out[p]);
      shell.sub(p, st.out[p] ? '나감' : `카드 ${st.deck[p].length}장`);
      shell.dim(p, st.out[p]);
    }
    const can = R.Fruit.canFlip(st, meP) && !pend && !flow.over && alive;
    decks[meP].disabled = !can;
    decks[meP].classList.toggle('can', can);
    bell.disabled = !!st.over || flow.over || st.out[meP];
    if (!st.over && !flow.over) {
      shell.turn(st.turn);
      if (!pend) {
        shell.say(st.out[meP] ? '카드를 다 써서 나왔어요. 친구들이 하는 걸 지켜봐요!'
          : st.turn === meP ? (st.deck[meP].length ? '내 차례예요! 내 카드 더미를 눌러 뒤집어요.' : '뒤집을 카드가 없어요! 다섯 개가 보이면 얼른 종을 쳐요.')
            : `${subj(st.turn)} 뒤집을 차례예요. 같은 과일 다섯 개를 찾아요!`);
      }
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
    st = R.Fruit.init(seed, { n, first: (r - 1) % n });
    evN = 0;
    for (const k of [...buf.keys()]) if (!k.startsWith(`${r}:`)) buf.delete(k);
    shell.acts();
    deadline = Date.now() + R.FRUIT_TIME * 1000;
    clearInterval(clock);
    clock = setInterval(tickClock, 250);
    tickClock();
    shownAt = performance.now();
    if (isHost) endT = setTimeout(() => { if (alive && st && !st.over) hostDo({ k: 'end' }); }, R.FRUIT_TIME * 1000);
    render();
    updateSums();
    afterEvent();
  }
  // 판을 바꾸는 일 하나 (방장 화면이 정하고 다른 화면에 알린다)
  function applyEv(e) {
    if (e.k === 'flip') {
      const c = R.Fruit.flip(st, e.p);
      if (c == null) return false;
      sfx.card();
      render({ flip: e.p });
    } else if (e.k === 'ring') {
      const before = [...shell.main.querySelectorAll('.fr-pile .fcard:not(.none)')];
      const res = R.Fruit.ring(st, e.p);
      if (!res) return false;
      bell.classList.remove('hit'); void bell.offsetWidth; bell.classList.add('hit');
      if (res.ok) {
        sfx.bell();
        shell.banner(`땡! ${subj(e.p)} 먼저!`, `카드 ${res.n}장을 가져갔어요`, 1600);
        fly(before, decks[e.p]);
      } else {
        sfx.bonk();
        shell.banner('앗, 다섯 개가 아니에요!', res.n ? `${subj(e.p)} 카드를 ${res.n > 1 ? '한 장씩 나눠' : '한 장'} 줬어요` : '', 1600);
        const back = decks[e.p].querySelector('.back');
        for (const q of res.to) if (back) fly([back], decks[q]);
      }
      render();
    } else if (e.k === 'out') {
      const p = st.turn;
      R.Fruit.drop(st);
      shell.banner(`${subj(p)} 카드를 다 썼어요`, st.over ? '' : '판에서 나가요', 1800);
      render();
    } else if (e.k === 'end') {
      R.Fruit.end(st);
      shell.say('3분이 다 됐어요! 카드가 가장 많은 사람이 이겨요.');
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
    // 컴퓨터와 '쉬움'으로 할 때만 보이는 과일 수를 적어 준다 (세는 연습)
    if (room || level !== 'easy') { sums.textContent = ''; return; }
    const s = R.Fruit.sums(st);
    const parts = R.FRUITS.map((f, i) => (s[i] ? `${f.name} ${s[i]}` : null)).filter(Boolean);
    sums.textContent = parts.length ? parts.join(' · ') : '';
  }
  function hostDo(e) {
    if (!alive || !st || st.over) return;
    if (!applyEv(e)) return;
    if (room) room.send('ev', { r: flow.round, n: evN - 1, e });
    afterEvent();
  }
  // 방장: 컴퓨터 차례, 카드가 없을 때, 종 기다리기
  function afterEvent() {
    if (!isHost || !st || st.over) return;
    for (const t of aiT) clearTimeout(t);
    aiT = [];
    clearTimeout(stuckT);
    const v = st.v;
    const five = R.Fruit.five(st);
    for (let p = 0; p < n; p++) {
      if (!cpuSeat(p) || st.out[p]) continue;
      // 다섯 개가 보이면 종을 치고, 아니면 아주 가끔 잘못 친다
      const rd = R.fruitRingDelay(level, five);
      if (rd != null) aiT.push(setTimeout(() => { if (alive && st && st.v === v) hostRing(p, rd / aiSpeed(), v); }, rd / aiSpeed()));
    }
    if (cpuSeat(st.turn) && R.Fruit.canFlip(st, st.turn)) {
      const who = st.turn;
      // 다섯 개가 보일 때는 뒤집기를 늦춰 사람에게도 칠 틈을 준다
      const fd = (750 + Math.random() * 600 + (five ? 1600 : 0)) / aiSpeed();
      aiT.push(setTimeout(() => { if (alive && st && st.v === v && !pend) hostDo({ k: 'flip', p: who }); }, fd));
    }
    if (R.Fruit.stuck(st)) stuckT = setTimeout(() => { if (alive && st && st.v === v && !pend && R.Fruit.stuck(st)) hostDo({ k: 'out' }); }, 2800 / aiSpeed());
  }
  function hostRing(p, rt, v) {
    if (!st || st.over || v !== st.v || st.out[p]) return;
    if (!pend) {
      pend = { v, list: [] };
      pend.t = setTimeout(() => {
        const pd = pend;
        pend = null;
        if (!pd || !st || st.v !== pd.v) return;
        pd.list.sort((a, b) => a.rt - b.rt);
        hostDo({ k: 'ring', p: pd.list[0].p });
      }, window_());
    }
    if (pend.list.some((x) => x.p === p)) return;
    pend.list.push({ p, rt });
  }
  function flip() {
    if (!st || st.over || flow.over || pend || !R.Fruit.canFlip(st, meP)) return;
    if (isHost) hostDo({ k: 'flip', p: meP });
    else { room.send('in', { r: flow.round, a: 'flip', v: st.v }); decks[meP].disabled = true; }
  }
  function ring() {
    if (!st || st.over || flow.over || st.out[meP]) return;
    const now = performance.now();
    if (now < myCool) return;
    myCool = now + 600;
    const rt = Math.round(now - shownAt);
    bell.classList.remove('press'); void bell.offsetWidth; bell.classList.add('press');
    sfx.tap();
    if (isHost) hostRing(meP, rt, st.v);
    else room.send('in', { r: flow.round, a: 'ring', v: st.v, rt });
  }
  function onKey(e) {
    if (!alive || e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); ring(); } else if (e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); flip(); }
  }
  window.addEventListener('keydown', onKey);
  function onMsg(m, from) {
    if (isHost && m.t === 'in' && m.r === flow.round && st && !st.over) {
      const gp = seats.findIndex((s) => s.id === from && !s.gone);
      if (gp < 0) return;
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
      const ok = (e.k === 'flip' || e.k === 'ring') ? Number.isInteger(e.p) && e.p >= 0 && e.p < n : e.k === 'out' || e.k === 'end';
      if (!ok || !applyEv(e)) evN++;
    }
  }
  return {
    begin: (r, seed) => { begin(r, seed); drain(); },
    onMsg,
    seatChanged: () => afterEvent(),
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
// cfg: { room, seats, mySeat, level, opts, myId, myAv, getPerson, startMsg, onExit, onCelebrate, onCheer }
// ---------------------------------------------------------------------
export function mountBoardGame(id, cfg) {
  const { room = null, level = 'normal', myId, myAv, getPerson, onExit, onCelebrate, onCheer, startMsg = null, early = [] } = cfg;
  const seats = cfg.seats.map((s) => ({ ...s, id: s.id === 'me' ? myId : s.id }));
  const meP = Math.max(0, seats.findIndex((s) => s.id === myId && !s.cpu));
  const n = seats.length;
  const opts = cleanOpts(id, cfg.opts, n);
  const team = id === 'yut' && opts.team;
  const solo = !room;
  // 자리마다 보여 줄 이름과 얼굴
  const players = seats.map((s, p) => {
    if (s.cpu != null) return { label: solo ? `${CPUS[s.cpu].name}${p === 1 && n === 2 ? `(${LEVEL_NAME[level] || '보통'})` : ''}` : CPUS[s.cpu].name, av: CPUS[s.cpu].av };
    if (p === meP) return { label: '나', av: myAv };
    const pr = getPerson ? getPerson(s.id) : null;
    return { label: (pr && pr.name) || (room && room.nameOf(s.id)) || '친구', av: pr && pr.avatar };
  });
  // 이름은 '숲지기 솔(보통)'처럼 붙은 꼬리를 떼고 쓴다 (놀이 안 말)
  const plain = players.map((pl, p) => (seats[p].cpu != null ? CPUS[seats[p].cpu].name : pl.label));
  const sideColor = (sd) => SEAT_COLORS[sd % SEAT_COLORS.length];
  const colorOf = (p) => (team ? sideColor(p % 2) : SEAT_COLORS[p]);
  let exited = false;
  const exit = () => { if (exited) return; exited = true; onExit(); };
  const shell = makeShell({ id, players, meP, colorOf, onExit: exit });
  shell.exit = exit;
  let game = null;
  const names = plain.map((label, p) => ({ label: p === meP ? '나' : label }));
  const beginFn = (r, seed) => game.begin(r, seed);
  beginFn.stop = () => game && game.stop();
  const flow = matchFlow({
    shell, room, seats, meP, myId, opts, players: names, team, onCelebrate, onCheer, begin: beginFn,
    onSeatsChange: (p) => {
      const s = seats[p];
      if (s.gone) { names[p].label = `${plain[p]}`; shell.rename(p, `${plain[p]} (컴퓨터가 대신)`); }
      if (game && game.seatChanged) game.seatChanged();
    },
  });
  const cheer = (k) => { if (onCheer && k.startsWith('reach')) onCheer(k); };
  game = id === 'fruit'
    ? fruitGame({ shell, room, seats, level, meP, myId, players: names, flow, colorOf })
    : turnGame(id, { shell, room, seats, level, opts, meP, players: names, flow, cheer, colorOf, sideColor });
  if (room) {
    room.on('msg', (m, from) => {
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'start') flow.onStart(m);
      else if (m.t === 'again') flow.onAgain(m, from);
      else if (m.t === 'hello' || m.t === 'lobby' || m.t === 'kick') return;
      else game.onMsg(m, from);
    }).on('left', (who) => { if (!exited) flow.onLeft(who); });
    // 방 사람: 사람 자리의 친구들
    if (room.host) room.setMembers(seats.filter((s) => s.id && !s.bot && s.cpu == null).map((s) => s.id));
    else room.setMembers(seats.filter((s) => s.id && !s.bot && s.cpu == null).map((s) => s.id));
  }
  if (!room || room.host) flow.start(1);
  else if (startMsg) { flow.onStart(startMsg); for (const m of early) game.onMsg(m, m._f); }
  else shell.say('방장이 판을 차리고 있어요…');
  return {
    seats, meP, n,
    stop() {
      game.stop();
      flow.alive = false;
      shell.destroy();
    },
    state: () => ({ id, round: flow.round, over: flow.over, st: game.state(), meP, n, idle: game.idle() }),
  };
}
