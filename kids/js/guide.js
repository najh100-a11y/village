// 진숲 어린이 마을 — 마을 지도
// 처음 온 친구도 어디에 무엇이 있고 무엇을 할 수 있는지 한눈에 본다.
// 땅, 길, 다리, 건물 자리는 마을을 짓는 값(world.js, isles.js, pool.js, park.js)을 그대로 써서 그린다.
// 장소를 누르면 하는 일과 열매, 지금 열렸는지가 나오고 '여기로 가기'로 그곳까지 걸어간다.
import { h } from './ui.js';
import { PARK_ISLE, POOL_ISLE, BRIDGES, PIER, JETTY, pierPoint, regionOf } from './isles.js';
import { PATHS, PLAZA, YARD, islandRadius } from './world.js';
import { POOL } from './pool.js';
import { DIG_SPOTS } from './beach.js';
import { PARK } from './park.js';
import { VILLAGERS } from './villagers.js';
import { REWARD } from './economy.js';

const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const n2 = (v) => Math.round(v * 100) / 100;
const WALK = 5.2; // 걷는 빠르기 (world.js WALK_SPEED)

// 보는 칸: 왼쪽 x, 위쪽 z, 너비, 높이 (북쪽(-z)이 위). r은 표시 크기
const VIEWS = [
  { id: 'main', name: '마을 섬', tab: '마을 섬', box: [-31, -28, 64, 63], r: 2.6 },
  { id: 'park', name: '놀이동산 섬', tab: '놀이동산', box: [-27, 36, 54, 54], r: 2.2 },
  { id: 'pool', name: '수영장 섬', tab: '수영장', box: [38, -21, 42, 36], r: 1.75 },
  { id: 'all', name: '전체', tab: '전체', box: [-36, -34, 116, 127], r: 3.4 },
];
const ISLE_NAME = { main: '마을 섬', park: '놀이동산 섬', pool: '수영장 섬' };
const CAT = {
  word: { name: '말씀', color: '#E8714F' },
  town: { name: '마을', color: '#3E8F4A' },
  play: { name: '놀이', color: '#2F86C9' },
  ride: { name: '놀이기구', color: '#CF4F94' },
};
const UNLOCK = { qt: '묵상의 숲으로', memory: '암송의 집으로', library: '필사 도서관으로' };

// 섬 둘레 (마을 섬은 world.js islandRadius, 작은 섬은 isles.js makeIsle과 같은 식)
function outline(cx, cz, rad, n = 120) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = rad(a);
    pts.push(`${n2(cx + Math.cos(a) * r)},${n2(cz - Math.sin(a) * r)}`); // 땅 모양은 x축으로 눕혀서 z = -sin
  }
  return pts.join(' ');
}
const isleRad = (I) => (a) => I.r + 0.6 * Math.sin(3 * a + I.seed) + 0.35 * Math.sin(7 * a + I.seed * 2);

export function createGuide(o) {
  const v = o.village;
  let view = 'main', sel = null, timer = 0, els = null, spots = [];
  let lastTree = null, lastDig = null; // 지도에서 누른 열매 나무, 보물 자리 번호

  // ---------- 장소 ----------
  // isle: 섬, cat: 갈래, lock: 놀이 마당이 열려야 하는 곳, need: 서버 기능 이름, lbl: 이름표 자리(s 아래, n 위, e 오른쪽, w 왼쪽)
  function makeSpots(c) {
    const F = c.features || {}, t = c.today || {}, cur = c.verse;
    const L = [];
    const add = (s) => { if (!s.hide) L.push(s); };
    add({ id: 'memory', isle: 'main', cat: 'word', icon: '📖', name: '암송의 집', short: '이번 주 말씀 외우기', x: -11, z: -13.4, lbl: 's',
      now: cur ? `이번 주 말씀: ${cur.ref}${cur.passed ? ' (도장 받았어요)' : cur.practiced_today ? ' (오늘 연습했어요)' : ''}` : '',
      lines: ['이번 주 말씀을 읽어 보기, 빈칸 채우기, 순서대로 놓기로 외워요.', '말씀 도장판에서 연습한 말씀과 선생님 도장을 봐요.'],
      reward: `연습하면 구절마다 하루 ${REWARD.memory}개, 선생님 앞에서 외워 도장을 받으면 ${REWARD.stamp}개`,
      go: { t: 'door', id: 'memory' } });
    add({ id: 'qt', isle: 'main', cat: 'word', icon: '🌿', name: '묵상의 숲', short: '날마다 하는 묵상', x: -17.8, z: 1.1, lbl: 's',
      now: t.qt ? `오늘 묵상: ${t.qt.title}${t.qt.done ? ' (마쳤어요)' : ''}` : '',
      lines: ['날마다 이번 주 이야기의 성경 말씀 한두 절을 읽고, 읽어요·머물러요·생각해요·기도해요·쉬어요 다섯 단계로 묵상해요.',
        c.opens && c.opens.includes('qt') && !c.open ? '오늘 묵상을 마치면 놀이 마당과 놀이기구가 열려요.' : null].filter(Boolean),
      reward: `하루에 처음 마치면 ${REWARD.qt}개`,
      go: { t: 'door', id: 'qt' } });
    add({ id: 'library', isle: 'main', cat: 'word', icon: '✏️', name: '필사 도서관', short: '이번 주 이야기 따라 쓰기', x: 11.2, z: -13.4, lbl: 's',
      now: t.copy ? `이번 주 필사: ${t.theme || t.copy.ref}${t.copy.done ? ' (마쳤어요)' : ''}` : '',
      lines: ['이번 주 하나님 나라 이야기를 읽고 따라 써요.', F.photo10 ? '공책에 손으로 써서 사진을 올릴 수도 있어요.' : null].filter(Boolean),
      reward: F.photo10 ? `한 주에 처음 마치면 ${REWARD.copy}개, 공책 사진을 올리면 그 주 필사 열매가 모두 ${REWARD.photo}개` : `한 주에 처음 마치면 ${REWARD.copy}개`,
      go: { t: 'door', id: 'library' } });
    add({ id: 'plaza', isle: 'main', cat: 'town', icon: '🌲', name: '광장', label: '광장', short: '숲지기 솔, 마을 게시판, 건의함', x: 3.4, z: -4.9, lbl: 'e',
      lines: ['마을 한가운데예요. 벤치 두 개에 앉아 쉴 수도 있어요.'],
      subs: [
        { icon: '🌲', name: '숲지기 솔', text: '오늘 할 일(묵상, 암송, 필사)을 알려 주고 그곳으로 데려다줘요.', go: { t: 'guide' } },
        { icon: '📋', name: '마을 게시판', text: '이번 주 이야기와 말씀, 오늘 묵상·이번 주 필사·암송을 했는지 한눈에 봐요.', go: { t: 'door', id: 'board' } },
        F.feedback ? { icon: '📮', name: '마을 건의함', text: '앱에 바라는 것이나 이상한 곳을 써서 선생님께 보내요. 친구들에게는 보이지 않아요.', go: { t: 'door', id: 'suggest' } } : null,
      ].filter(Boolean) });
    add({ id: 'home', isle: 'main', cat: 'town', icon: '🏠', name: '내 집', short: F.home ? '방·마당·밭 꾸미기' : '주민 꾸미기', x: 0, z: -21, lbl: 's',
      lines: F.home ? ['내 방과 마당, 밭을 꾸며요. 꾸밀 물건은 열매 상점에서 사요.', '밭에 씨앗을 심으면 며칠에 걸쳐 자라고, 물은 12시간에 한 번 줄 수 있어요.', '옷장을 누르면 옷을 갈아입어요.']
        : ['내 주민의 얼굴, 머리, 옷을 바꿔요.'],
      go: { t: 'door', id: 'home' } });
    if (F.shop) {
      const sells = ['잡은 물고기와 곤충', F.beach ? '캔 보물' : null, F.farm ? '밭에서 거둔 것' : null].filter(Boolean);
      add({ id: 'shop', isle: 'main', cat: 'town', icon: '🛒', name: '열매 상점', short: '열매로 사고팔기', x: 16.6, z: 1.6, lbl: 'n',
        lines: [`모은 열매로 불꽃${F.pets ? ', 애완동물' : ''}, 꾸미기 물건${F.home ? ', 집 꾸미기 물건과 씨앗' : ''}을 사요.`,
          F.sell ? `${sells.join(', ')}을 팔아 열매로 바꿔요.` : null, F.gift ? '친구에게 열매를 선물해요.' : null].filter(Boolean),
        go: { t: 'door', id: 'shop' } });
    }
    add({ id: 'fruit', isle: 'main', cat: 'town', icon: '🍎', name: '열매 나무', short: '열매 따 먹기', tree: true,
      lines: ['사과, 감, 복숭아가 달린 나무를 누르면 하나 따서 냠냠 먹어요. 딴 열매는 75초쯤 뒤에 다시 열려요.', '먹는 놀이예요. 상점에서 쓰는 열매는 늘지 않아요.'],
      go: { t: 'fruit' }, goText: '가까운 열매 나무로' });
    add({ id: 'fish', isle: 'main', cat: 'play', icon: '🎣', name: '반짝 연못 낚시터', label: '연못 낚시터', short: '연못 물고기 낚기', x: -9.5, z: 13, lbl: 's', lock: true,
      lines: ['데크 끝에서 물고기 그림자 근처로 낚싯대를 던져요. 찌가 쑥 들어가면 얼른 당겨요.', '잡은 물고기는 물고기 도감에 모이고, 오늘의 큰 물고기 기록판도 있어요.'],
      go: { t: 'door', id: 'fish' } });
    add({ id: 'art', isle: 'main', cat: 'play', icon: '🎨', name: '그림 공방', short: '이젤에서 그림 그리기', x: 11.2, z: 11.2, lbl: 'e', lock: true,
      lines: ['이젤에서 연필, 붓, 크레파스, 도장 같은 도구로 그림을 그려요.', '가장 최근 그림 여섯 장이 공방 전시 벽에 걸려요.'],
      go: { t: 'door', id: 'art' } });
    add({ id: 'omok', isle: 'main', cat: 'play', icon: '⚫', name: '오목 놀이터', label: '오목', short: '오목 두기', x: 7.2, z: 17.4, lbl: 'w', lock: true,
      lines: ['숲지기 솔(쉬움·보통·어려움)이나 지금 마을에 있는 친구와 오목을 둬요.'],
      go: { t: 'door', id: 'omok' } });
    add({ id: 'cook', isle: 'main', cat: 'play', icon: '🍳', name: '숲속 부엌', short: '요리하기', x: 15.6, z: 15.8, lbl: 'e', lock: true,
      lines: ['요리책에서 성경 이야기 속 음식(만나 과자, 붉은 콩죽 같은 것)을 골라 단계마다 요리해요. 친구와 번갈아 할 수도 있어요.',
        "'마음대로 요리하기'로 재료를 골라 만든 요리는 마을 식탁에 올라가요."],
      go: { t: 'door', id: 'cook' } });
    add({ id: 'table', isle: 'main', cat: 'town', icon: '🍽️', name: '마을 식탁', short: '친구 요리 보기', x: 10, z: 21.9, lbl: 's',
      lines: ['친구들이 숲속 부엌에서 만든 요리가 놓여요(가장 최근 네 접시).', F.eat ? '접시를 누르면 누가 만들었는지 보이고, 친구 요리는 한 번씩 먹을 수 있어요.' : '접시를 누르면 누가 만들었는지 보여요.'],
      go: { t: 'table' } });
    if (F.farm) {
      add({ id: 'share', isle: 'main', cat: 'town', icon: '🧺', name: '나눔 수레', short: '친구가 나눈 채소·과일', x: 15.2, z: 21.6, lbl: 'e',
        lines: ['친구들이 밭에서 거둔 것을 바구니에 담아 올려요(최근 바구니 넷, 일주일 동안).', '바구니마다 하나씩 먹을 수 있어요. 내 수확 바구니에서 올릴 수도 있어요.'],
        go: { t: 'share' } });
    }
    add({ id: 'sea', isle: 'main', cat: 'play', icon: '⛵', name: '바다 낚시 나루터', label: '바다 낚시', short: '배 타고 바다 낚시', x: 28.5, z: 30.2, lbl: 'n', lock: true, need: 'sea',
      lines: ['나무 다리 끝에서 배를 타고 바다로 노를 저어 나가요.', '갈매기가 맴도는 곳에 물고기 떼가 있어요. 그 근처에서 낚시하면 물고기가 더 많이, 더 빨리 다가와요.',
        '물고기가 물면 줄다리기로 감아 올려요.'],
      go: { t: 'door', id: 'sea' } });
    add({ id: 'bugs', isle: 'main', cat: 'play', icon: '🦋', name: '곤충 채집', short: '그물로 곤충 잡기', lock: true, need: 'bugs', nomap: true,
      lines: ['꽃밭, 풀밭, 나무줄기, 물가에 곤충이 나타나요(90초마다 바뀌어요). 반딧불이는 밤에만 나와요.', '곤충을 누르면 다가가서 그물을 휘둘러요. 잡은 곤충은 가방의 곤충 도감에 모여요.'] });
    // 놀이동산 섬
    const rides = [
      ['carousel', '🎠', '회전목마', 0, 52.5, 's', ['말 여섯 마리가 18초에 한 바퀴 돌며 오르락내리락해요.', "'손 흔들기'로 친구들에게 인사해요."]],
      ['ferris', '🎡', '대관람차', -10.5, 59.5, 's', ['곤돌라 여섯 개가 50초에 한 바퀴 돌아요.', '한 곤돌라에 둘이 나란히 앉을 수 있어요.']],
      ['viking', '🚢', '바이킹', 10.5, 60.5, 's', ['여덟 자리 배가 점점 크게 흔들렸다가(가장 크게 약 49도) 다시 잦아들어요.']],
      ['bumper', '🚗', '범퍼카', 0, 69.5, 's', ['내가 직접 몰아요. 벽이나 다른 차에 부딪히면 쿵! 하고 튕겨요.', '곰 친구들이 모는 차 다섯 대도 함께 달려요.']],
      ['coaster', '🎢', '롤러코스터', -18.3, 63.3, 'n', ['섬 둘레 바다 위를 한 바퀴 달리고, 거꾸로 한 바퀴 도는 고리도 있어요.', '열차는 47초쯤마다 한 번 출발해요. 승강장에서 기다렸다가 타요.']],
    ];
    for (const [id, icon, name, x, z, lbl, lines] of rides) {
      add({ id, isle: 'park', cat: 'ride', icon, name, short: lines[0].replace(/\.$/, ''), x, z, lbl, lock: true,
        lines: [...lines, '타는 동안 1인칭 단추를 누르면 내 눈높이로 봐요.'], go: { t: 'door', id } });
    }
    // 수영장 섬
    add({ id: 'pool', isle: 'pool', cat: 'town', icon: '🏊', name: '진숲 수영장', label: '수영장', short: '헤엄치기', x: 56, z: -3.6, lbl: 's',
      lines: ['물로 걸어 들어가면 헤엄쳐요. 자유형, 배영, 접영 가운데 골라요.', '북쪽 선베드에 누워 쉴 수도 있어요.'],
      go: { t: 'point', x: POOL.x - POOL.hw + 1.6, z: POOL.z } });
    add({ id: 'dig', isle: 'pool', cat: 'play', icon: '✨', name: '모래사장 보물 캐기', short: '반짝이는 모래 파기', lock: true, need: 'beach', dig: true,
      lines: ['모래밭 열두 자리 가운데 넷이 40초마다 바뀌며 반짝여요(지도의 ✨). 반짝이는 곳을 누르면 삽으로 파요.', '조개껍데기, 불가사리, 진주가 나오고, 아주 가끔 보물 상자도 나와요. 캔 보물은 가방의 보물 도감에 모여요.'],
      go: { t: 'dig' }, goText: '반짝이는 곳으로' });
    add({ id: 'skip', isle: 'pool', cat: 'play', icon: '🌊', name: '물수제비 터', label: '물수제비', short: '돌 튀기기', x: 75, z: -4.8, lbl: 's', lock: true, need: 'skip',
      lines: ['다리 끝에서 막대 위 바늘이 가운데 초록 칸에 올 때 던질수록 돌이 많이 튀어요.', "'오늘 기록'에서 오늘 가장 많이 튄 친구 다섯 명을 봐요."],
      go: { t: 'door', id: 'skip' } });
    add({ id: 'ark', isle: 'pool', cat: 'play', icon: '🌈', name: '노아의 방주 짝 맞추기', label: '노아의 방주', short: '동물 카드 짝 맞추기', x: 56, z: -13.4, lbl: 'n', lock: true, need: 'ark',
      lines: ['탁자 위 동물 카드를 두 장씩 뒤집어 같은 동물 짝을 찾아요. 동물들이 둘씩 방주에 들어간 이야기(창세기 7장)에서 따왔어요.',
        '혼자 하면 쉬움(12장), 보통(16장), 어려움(20장)을 고르고, 친구와 하면 20장으로 번갈아 뒤집어요.',
        F.arkboard ? '혼자 하기 기록은 이번 주 기록판에 올라가요. 난이도마다 가장 빠른 10명이 보이고, 일요일마다 새로 시작해요.' : null].filter(Boolean),
      go: { t: 'door', id: 'ark' } });
    return L;
  }
  // 마을 친구 (자리는 놀이동산과 같은 시계로 정해진다)
  function npcSpot(i) {
    const d = VILLAGERS[i], vg = v.villagers;
    const p = npcPos(i);
    const doing = vg && vg.doingText ? vg.doingText(p) : '';
    return { id: `npc${i}`, npc: i, isle: d.isle || 'main', cat: 'town', icon: '🌱', name: d.name, short: d.about,
      lines: [d.about, doing ? `지금: ${doing}` : null, '가까이 가서 누르면 하이파이브, 가위바위보를 하고 간식도 나눠 먹어요.'].filter(Boolean),
      go: vg ? { t: 'npc', i } : null, goText: '같이 놀러 가기' };
  }
  function npcPos(i) {
    const vg = v.villagers;
    if (!vg) return null;
    try {
      if (vg.held(i)) { const q = vg.list[i].av.root.position; return { x: q.x, z: q.z, act: 'hold' }; }
      return vg.plan(i, v.park.now());
    } catch (e) { const q = vg.list[i] && vg.list[i].av.root.position; return q ? { x: q.x, z: q.z, act: vg.list[i].act } : null; }
  }
  function myPos() {
    if (v.atHome) return { x: 0, z: -17.8, ry: 0, home: true };
    const r = v.player && v.player.root;
    return r ? { x: r.position.x, z: r.position.z, ry: r.rotation.y } : { x: 0, z: 0, ry: 0 };
  }
  function isleOf(p) {
    const g = regionOf(p.x, p.z);
    if (g === 'b-park') return p.z > 36 ? 'park' : 'main';
    if (g === 'b-pool') return p.x > 38 ? 'pool' : 'main';
    return g;
  }

  // ---------- 상태 ----------
  function status(sp, c) {
    if (sp.need && !(c.features || {})[sp.need]) return { cls: 'soon', text: '곧 열려요' };
    if (!sp.lock) return null;
    return c.open ? { cls: 'ok', text: '오늘은 열려 있어요. 지금 놀 수 있어요!' } : { cls: 'lock', text: `🔒 ${c.hint} 열려요` };
  }
  const unlockTo = (c) => (!c.opens || c.opens.includes('qt') ? 'qt' : c.opens.includes('memory') ? 'memory' : 'library');

  // ---------- 그리기 ----------
  function baseLayer() {
    const g = sv('g', { class: 'gm-base', 'aria-hidden': 'true' });
    g.append(sv('rect', { x: -80, y: -80, width: 200, height: 210, fill: '#5FC3E6' }));
    const isles = [[0, 0, islandRadius, 39.5, 47, '#8DCC5F', 'main'], [PARK_ISLE.x, PARK_ISLE.z, isleRad(PARK_ISLE), PARK_ISLE.r + 4.5, PARK_ISLE.r + 10, '#8DCC5F', 'park'],
      [POOL_ISLE.x, POOL_ISLE.z, isleRad(POOL_ISLE), POOL_ISLE.r + 4.5, POOL_ISLE.r + 10, '#EDCF92', 'pool']];
    for (const [x, z, , , sh] of isles) g.append(sv('circle', { cx: x, cy: z, r: sh, fill: '#8FDDF0' }));
    for (const [x, z, , sd] of isles) g.append(sv('circle', { cx: x, cy: z, r: sd, fill: '#F3E2B4' }));
    // 나루터와 물수제비 다리 (모래 위, 땅 아래)
    const pier = (u0, u1, w) => [pierPoint(u0, -w), pierPoint(u1, -w), pierPoint(u1, w), pierPoint(u0, w)].map((p) => `${n2(p.x)},${n2(p.z)}`).join(' ');
    g.append(sv('polygon', { points: pier(0, PIER.len, PIER.hw), fill: '#B07F4E' }));
    g.append(sv('polygon', { points: pier(PIER.len - PIER.end, PIER.len, PIER.hw2), fill: '#B07F4E' }));
    g.append(sv('rect', { x: JETTY.x0, y: JETTY.z - JETTY.hw, width: JETTY.x1 - JETTY.x0, height: JETTY.hw * 2, fill: '#B07F4E' }));
    for (const [x, z, rad, , , fill, id] of isles) g.append(sv('polygon', { class: 'gm-land', 'data-isle': id, points: outline(x, z, rad), fill }));
    // 다리
    for (const b of BRIDGES) {
      const [d0, d1] = b.deck;
      g.append(b.along === 'z' ? sv('rect', { x: b.x0, y: d0, width: b.x1 - b.x0, height: d1 - d0, fill: '#C99862', stroke: '#8F6239', 'stroke-width': 0.25 })
        : sv('rect', { x: d0, y: b.z0, width: d1 - d0, height: b.z1 - b.z0, fill: '#C99862', stroke: '#8F6239', 'stroke-width': 0.25 }));
    }
    // 마을 섬 길, 광장, 놀이 마당, 연못
    for (const [w, col] of [[2.7, '#CDB27C'], [2.3, '#EAD7A8']]) {
      for (const p of PATHS) g.append(sv('polyline', { points: p.map(([x, z]) => `${x},${z}`).join(' '), fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      g.append(sv('circle', { cx: PLAZA.x, cy: PLAZA.z, r: PLAZA.r + (w - 2.3) / 2, fill: col }));
      g.append(sv('circle', { cx: YARD.x, cy: YARD.z, r: YARD.r + (w - 2.3) / 2, fill: col }));
    }
    g.append(sv('ellipse', { cx: -9.5, cy: 13, rx: 4.6, ry: 3.9, fill: '#7DB85A' }));
    g.append(sv('ellipse', { cx: -9.5, cy: 13, rx: 3.6, ry: 3.06, fill: '#6FC9E9' }));
    // 놀이동산 마당과 입구 길
    g.append(sv('rect', { x: -1.15, y: PARK_ISLE.z - PARK_ISLE.r - 1, width: 2.3, height: PARK_ISLE.r - PARK.r + 2, fill: '#EAD7A8' }));
    g.append(sv('circle', { cx: PARK.x, cy: PARK.z, r: PARK.r + 0.3, fill: '#D9B48C' }));
    g.append(sv('circle', { cx: PARK.x, cy: PARK.z, r: PARK.r, fill: '#F3DDBF' }));
    // 수영장: 둘레 바닥, 선베드 자리, 물, 다리에서 오는 나무 길
    const P = POOL, dx = P.hw + P.deck, dz = P.hd + P.deck, nx = dx - 0.6;
    g.append(sv('rect', { x: POOL_ISLE.x - POOL_ISLE.r - 1, y: -5, width: P.x - dx - (POOL_ISLE.x - POOL_ISLE.r - 1) + 0.2, height: 2, fill: '#C99862' }));
    g.append(sv('rect', { x: P.x - dx, y: P.z - dz, width: dx * 2, height: dz * 2, rx: 0.5, fill: '#ECE7DC', stroke: '#CFC6B4', 'stroke-width': 0.2 }));
    g.append(sv('rect', { x: P.x - nx, y: P.z - dz - 0.75, width: nx * 2, height: 1.25, rx: 0.4, fill: '#ECE7DC' }));
    g.append(sv('rect', { x: P.x - P.hw, y: P.z - P.hd, width: P.hw * 2, height: P.hd * 2, fill: '#2E9BD0' }));
    // 건물과 놀이기구 바닥 (부딪히는 자리를 그대로: 큰 네모와 큰 동그라미)
    for (const ob of v.obstacles || []) {
      if (ob.t === 'b' && ob.hw * ob.hd > 2) {
        const deg = n2((-Math.atan2(ob.s, ob.c) * 180) / Math.PI);
        if (Math.abs(ob.hw - ob.hd) < 0.05) { // 정사각 자리는 팔각 정자(묵상의 숲)
          const pts = [];
          for (let k = 0; k < 8; k++) { const a = ((k + 0.5) / 8) * Math.PI * 2; pts.push(`${n2(Math.cos(a) * ob.hw * 1.08)},${n2(Math.sin(a) * ob.hw * 1.08)}`); }
          g.append(sv('polygon', { points: pts.join(' '), transform: `translate(${n2(ob.x)} ${n2(ob.z)}) rotate(${deg})`, fill: '#E9D3B1', stroke: '#B8946A', 'stroke-width': 0.3 }));
          continue;
        }
        g.append(sv('rect', { x: -ob.hw, y: -ob.hd, width: ob.hw * 2, height: ob.hd * 2, rx: 0.5, transform: `translate(${n2(ob.x)} ${n2(ob.z)}) rotate(${deg})`, fill: '#E9D3B1', stroke: '#B8946A', 'stroke-width': 0.3 }));
      } else if (ob.t === 'c' && ob.r > 2.5) {
        g.append(sv('circle', { cx: n2(ob.x), cy: n2(ob.z), r: ob.r, fill: '#E9D3B1', stroke: '#B8946A', 'stroke-width': 0.3 }));
      }
    }
    // 롤러코스터 선로 (놀이동산 섬 둘레 바다 위)
    const tr = v.park && v.park.coaster && v.park.coaster.track;
    if (tr && tr.pts) {
      const pts = [];
      for (let i = 0; i < tr.pts.length; i += 6) pts.push(`${n2(tr.pts[i].p.x)},${n2(tr.pts[i].p.z)}`);
      pts.push(pts[0]);
      g.append(sv('polyline', { points: pts.join(' '), fill: 'none', stroke: '#E0584C', 'stroke-width': 0.5, 'stroke-linejoin': 'round', opacity: 0.85 }));
    }
    return g;
  }

  // 장소 표시 (보는 칸마다 크기가 달라서 다시 그린다)
  function pinLayer(c) {
    const V = VIEWS.find((x) => x.id === view), R = V.r, all = view === 'all';
    const g = sv('g', { class: 'gm-pins' });
    const lbl = (text, side, r, size) => {
      const at = { s: [0, r + size * 1.05, 'middle'], n: [0, -r - size * 0.45, 'middle'], e: [r + size * 0.35, size * 0.35, 'start'], w: [-r - size * 0.35, size * 0.35, 'end'] }[side || 's'];
      return sv('text', { class: 'gm-lbl', x: n2(at[0]), y: n2(at[1]), 'text-anchor': at[2], 'font-size': n2(size), 'stroke-width': n2(size * 0.3) }, text);
    };
    const pin = (sp, x, z, r, kind, extra = []) => {
      const st = status(sp, c);
      const el = sv('g', { class: `gm-pin ${kind}${sel === sp.id ? ' on' : ''}${st && st.cls !== 'ok' ? ' shut' : ''}`, 'data-id': sp.id, transform: `translate(${n2(x)} ${n2(z)})`,
        role: 'button', tabindex: '0', 'aria-label': `${sp.name}${st && st.cls === 'lock' ? ' (아직 닫혀 있어요)' : st && st.cls === 'soon' ? ' (곧 열려요)' : ''}` }, ...extra);
      // 열매 나무와 보물 자리는 누른 바로 그 자리로 가게 자리 번호를 기억한다
      const onPick = () => { lastTree = el.dataset.tree != null ? +el.dataset.tree : null; lastDig = el.dataset.dig != null ? +el.dataset.dig : null; pick(sp.id, false); };
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } });
      return el;
    };
    // 열매 나무 (작은 사과)
    const fruit = spots.find((s) => s.id === 'fruit');
    if (fruit && !all) {
      (v.fruitTrees || []).forEach((t, i) => {
        g.append(pin(fruit, t.x, t.z, R * 0.45, 'tree', [sv('circle', { r: R * 0.5, class: 'gm-hit' }), sv('text', { class: 'gm-emo', 'font-size': n2(R * 0.85) }, '🍎')]));
        g.lastChild.dataset.tree = String(i);
      });
    }
    // 보물 캐는 자리: 모래 둔덕, 지금 반짝이는 곳은 ✨
    const dig = spots.find((s) => s.id === 'dig');
    if (dig && view !== 'park') {
      DIG_SPOTS.forEach((p, i) => {
        const on = !!(v.beach && v.beach.isActive(i));
        g.append(pin(dig, p.x, p.z, R * 0.4, 'dig' + (on ? ' shine' : ''), [sv('circle', { r: R * 0.42, fill: '#E2B865', stroke: '#fff', 'stroke-width': R * 0.08 }),
          sv('text', { class: 'gm-emo gm-spark', 'font-size': n2(R * 0.95) }, '✨')]));
        g.lastChild.dataset.dig = String(i);
      });
    }
    // 장소
    for (const sp of spots) {
      if (sp.nomap || sp.tree || sp.dig || sp.x == null) continue;
      const st = status(sp, c);
      const kids = [sv('circle', { class: 'gm-ring', r: n2(R * 1.32), 'stroke-width': n2(R * 0.12) }), sv('circle', { class: 'gm-dot', r: R, stroke: CAT[sp.cat].color, 'stroke-width': n2(R * 0.2) }),
        sv('text', { class: 'gm-emo', 'font-size': n2(R * 1.05) }, sp.icon)];
      if (st && st.cls !== 'ok') kids.push(sv('g', { transform: `translate(${n2(R * 0.78)} ${n2(-R * 0.78)})` }, sv('circle', { r: n2(R * 0.46), fill: '#fff' }), sv('text', { class: 'gm-emo', 'font-size': n2(R * 0.56) }, st.cls === 'soon' ? '⏳' : '🔒')));
      if (!all) kids.push(lbl(sp.label || sp.name, sp.lbl, R, R * 0.8));
      g.append(pin(sp, sp.x, sp.z, R, 'place', kids));
    }
    // 섬 이름 (전체 보기)
    if (all) {
      for (const [id, x, z] of [['main', -20, -25], ['park', 0, 89.5], ['pool', 56, 15.5]]) {
        const t = sv('text', { class: 'gm-isle', x, y: z, 'text-anchor': 'middle', 'font-size': 4.2, 'stroke-width': 1.1, 'data-isle': id }, ISLE_NAME[id]);
        t.addEventListener('click', () => setView(id));
        g.append(t);
      }
    } else {
      // 다리 끝 이름표: 어느 섬으로 가는 다리인지
      if (view === 'main') {
        g.append(sv('text', { class: 'gm-note', x: -1.8, y: 32.4, 'text-anchor': 'end', 'font-size': n2(R * 0.7), 'stroke-width': n2(R * 0.7 * 0.3) }, '놀이동산 섬 가는 다리'));
        g.append(sv('text', { class: 'gm-note', x: 31.2, y: -6.6, 'text-anchor': 'end', 'font-size': n2(R * 0.7), 'stroke-width': n2(R * 0.7 * 0.3) }, '수영장 섬 가는 다리'));
      } else if (view === 'park') {
        g.append(sv('text', { class: 'gm-note', x: 1.8, y: 40.2, 'font-size': n2(R * 0.72), 'stroke-width': n2(R * 0.72 * 0.3) }, '마을 섬 가는 다리'));
        g.append(sv('text', { class: 'gm-note', x: 0, y: 46.4, 'text-anchor': 'middle', 'font-size': n2(R * 0.72), 'stroke-width': n2(R * 0.72 * 0.3) }, '놀이동산 입구'));
      } else if (view === 'pool') {
        g.append(sv('text', { class: 'gm-note', x: 39, y: -6.2, 'font-size': n2(R * 0.72), 'stroke-width': n2(R * 0.72 * 0.3) }, '마을 섬 가는 다리'));
        g.append(sv('text', { class: 'gm-note', x: 56, y: -8.9, 'text-anchor': 'middle', 'font-size': n2(R * 0.62), 'stroke-width': n2(R * 0.62 * 0.3) }, '선베드'));
      }
    }
    // 북쪽 표시
    const [bx, bz, bw] = V.box;
    g.append(sv('g', { class: 'gm-north', transform: `translate(${n2(bx + bw - R * 1.6)} ${n2(bz + R * 1.8)})`, 'aria-hidden': 'true' },
      sv('circle', { r: n2(R * 1.15), fill: 'rgba(255,253,247,.9)' }), sv('path', { d: `M0 ${n2(-R * 0.8)} L${n2(R * 0.42)} ${n2(R * 0.15)} L${n2(-R * 0.42)} ${n2(R * 0.15)}Z`, fill: '#E0584C' }),
      sv('text', { class: 'gm-n', y: n2(R * 0.78), 'text-anchor': 'middle', 'font-size': n2(R * 0.62) }, '북')));
    // 움직이는 것: 친구, 마을 친구, 나
    g.append(sv('g', { class: 'gm-live' }));
    return g;
  }

  // 움직이는 것: 처음(full)에 만들고, 그다음부터는 자리만 옮긴다 (나를 감싸는 물결이 끊기지 않게)
  let live = null;
  function drawLive(full = false) {
    if (!els) return;
    const layer = els.svg.querySelector('.gm-live');
    if (!layer) return;
    const R = VIEWS.find((x) => x.id === view).r, all = view === 'all';
    const tap = (el, fn) => {
      el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
      return el;
    };
    if (full || !live || !layer.firstChild) {
      live = { npcs: [], friends: new Map(), me: null, arrow: null };
      layer.replaceChildren();
      // 마을 친구
      VILLAGERS.forEach((d, i) => {
        const el = tap(sv('g', { class: 'gm-pin npc', role: 'button', tabindex: '0', 'aria-label': `마을 친구 ${d.name}` },
          sv('circle', { class: 'gm-ring', r: n2(R * 0.9), 'stroke-width': n2(R * 0.1) }),
          sv('circle', { r: n2(R * 0.55), fill: '#DDF3D3', stroke: '#3E8F4A', 'stroke-width': n2(R * 0.12) }),
          sv('text', { class: 'gm-emo', 'font-size': n2(R * 0.62) }, '🌱'),
          all ? null : sv('text', { class: 'gm-lbl small', y: n2(R * 1.3), 'text-anchor': 'middle', 'font-size': n2(R * 0.58), 'stroke-width': n2(R * 0.16) }, d.name)), () => pick(`npc${i}`, false));
        live.npcs[i] = el;
        layer.append(el);
      });
      // 나: 빨간 동그라미와 보는 쪽 화살표
      const home = myPos().home;
      live.arrow = home ? null : sv('path', { d: `M0 ${n2(-R * 1.18)} L${n2(R * 0.45)} ${n2(-R * 0.45)} L${n2(-R * 0.45)} ${n2(-R * 0.45)}Z`, fill: '#EF6461', stroke: '#fff', 'stroke-width': n2(R * 0.08) });
      live.me = sv('g', { class: 'gm-me', 'aria-hidden': 'true' },
        sv('circle', { class: 'gm-pulse', r: n2(R * 0.9) }), live.arrow,
        sv('circle', { r: n2(R * 0.62), fill: '#EF6461', stroke: '#fff', 'stroke-width': n2(R * 0.16) }),
        sv('text', { class: 'gm-me-t', 'font-size': n2(R * 0.62) }, '나'));
      layer.append(live.me);
    }
    // 함께 접속한 친구 (들어오고 나가면 더하고 뺀다)
    const c = o.ctx(), seen = new Set();
    for (const [id, r] of v.remotes || []) {
      const q = r.av && r.av.root.position;
      if (!q) continue;
      seen.add(id);
      let el = live.friends.get(id);
      if (!el) {
        const name = (c.people.get(id) || {}).name || '친구';
        el = tap(sv('g', { class: 'gm-pin friend', role: 'button', tabindex: '0', 'aria-label': `친구 ${name}` },
          sv('circle', { r: n2(R * 0.42), fill: '#3C8DD0', stroke: '#fff', 'stroke-width': n2(R * 0.12) }),
          all ? null : sv('text', { class: 'gm-lbl small', y: n2(R * 1.05), 'text-anchor': 'middle', 'font-size': n2(R * 0.58), 'stroke-width': n2(R * 0.16) }, name)), () => showFriend(id));
        live.friends.set(id, el);
        layer.insertBefore(el, layer.firstChild);
      }
      el.setAttribute('transform', `translate(${n2(q.x)} ${n2(q.z)})`);
    }
    for (const [id, el] of live.friends) if (!seen.has(id)) { el.remove(); live.friends.delete(id); }
    live.npcs.forEach((el, i) => {
      const p = npcPos(i);
      el.style.display = p ? '' : 'none';
      if (p) el.setAttribute('transform', `translate(${n2(p.x)} ${n2(p.z)})`);
      el.classList.toggle('on', sel === `npc${i}`);
    });
    const me = myPos();
    live.me.setAttribute('transform', `translate(${n2(me.x)} ${n2(me.z)})`);
    if (live.arrow) live.arrow.setAttribute('transform', `rotate(${n2((-me.ry * 180) / Math.PI + 180)})`);
    // 반짝이는 모래 자리
    for (const el of els.svg.querySelectorAll('.gm-pin.dig')) el.classList.toggle('shine', !!(v.beach && v.beach.isActive(+el.dataset.dig)));
  }

  // ---------- 고른 곳 설명 ----------
  function card() {
    const c = o.ctx();
    const sp = sel && (sel.startsWith('npc') ? npcSpot(+sel.slice(3)) : spots.find((s) => s.id === sel));
    if (!sp) {
      const me = myPos();
      return h('div', { class: 'gm-card gm-hello' },
        h('p', { class: 'gm-big' }, '가고 싶은 곳을 눌러 보세요!'),
        h('p', {}, "무엇을 할 수 있는지 알려 주고, '여기로 가기'를 누르면 그곳까지 걸어가요."),
        h('p', { class: 'gm-me-line' }, h('i', { class: 'gm-me-dot', 'aria-hidden': 'true' }), me.home ? ' 지금 나는 내 집 안에 있어요.' : ` 지금 나는 ${ISLE_NAME[isleOf(me)]}에 있어요.`),
        h('p', { class: `gm-st ${c.open ? 'ok' : 'lock'}` }, c.open ? '오늘은 놀이 마당과 놀이기구가 열려 있어요!' : `🔒 표시가 있는 놀이는 ${c.hint} 열려요.`),
        h('p', { class: 'gm-tip' }, '🍎 상점에서 쓰는 열매는 암송의 집, 묵상의 숲, 필사 도서관에서 모아요.'));
    }
    const st = status(sp, c);
    const go = sp.go && !(st && st.cls === 'soon');
    const btns = [];
    if (go) btns.push(h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => doGo(sp, sp.go) }, sp.goText || '여기로 가기'));
    if (go && st && st.cls === 'lock') {
      const to = unlockTo(c);
      btns.push(h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => doGo(spots.find((s) => s.id === to), { t: 'door', id: to }) }, UNLOCK[to]));
    }
    return h('div', { class: 'gm-card', style: `--cat:${CAT[sp.cat].color}` },
      h('div', { class: 'gm-head' }, h('span', { class: 'gm-ico', 'aria-hidden': 'true' }, sp.icon),
        h('div', {}, h('b', {}, sp.name), h('span', { class: 'gm-where' }, sp.npc != null ? `마을 친구 · ${ISLE_NAME[sp.isle]}` : `${ISLE_NAME[sp.isle]} · ${CAT[sp.cat].name}`))),
      st ? h('p', { class: `gm-st ${st.cls}` }, st.text) : null,
      sp.now ? h('p', { class: 'gm-now' }, sp.now) : null,
      h('ul', { class: 'gm-lines' }, sp.lines.map((l) => h('li', {}, l))),
      sp.reward ? h('p', { class: 'gm-reward' }, h('b', {}, '🍎 열매'), ' ', sp.reward) : null,
      sp.subs ? h('div', { class: 'gm-subs' }, sp.subs.map((s) => h('div', { class: 'gm-sub' },
        h('span', { class: 'gm-ico small', 'aria-hidden': 'true' }, s.icon),
        h('div', {}, h('b', {}, s.name), h('span', {}, s.text)),
        h('button', { class: 'btn btn-soft btn-small', type: 'button', onclick: () => doGo(sp, s.go) }, '가기')))) : null,
      btns.length ? h('div', { class: 'row' }, btns) : null);
  }
  function showFriend(id) {
    const c = o.ctx();
    const name = (c.people.get(id) || {}).name || '친구';
    sel = null;
    redrawPins();
    els.card.replaceChildren(h('div', { class: 'gm-card', style: '--cat:#3C8DD0' },
      h('div', { class: 'gm-head' }, h('span', { class: 'gm-ico', 'aria-hidden': 'true' }, '🙂'), h('div', {}, h('b', {}, name), h('span', { class: 'gm-where' }, '함께 접속한 친구'))),
      h('ul', { class: 'gm-lines' }, h('li', {}, '지금 같은 마을에 있는 친구예요.')),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-go btn-small', type: 'button', onclick: () => o.findFriend(id) }, '찾아가기'))));
  }

  // ---------- 가기 ----------
  async function doGo(sp, go) {
    if (!go) return;
    if (go.t === 'fruit' && go.i == null && lastTree != null) go = { t: 'fruit', i: lastTree };
    if (go.t === 'dig' && go.i == null && lastDig != null) go = { t: 'dig', i: lastDig };
    if (go.t === 'door' && go.id === 'home' && v.atHome && !o.isGuest()) { o.close(); o.toast('지금 내 집에 있어요.'); return; }
    await o.before(); // 창을 닫고, 집 안이면 마을로 나온다
    const p = v.player && v.player.root.position;
    if (go.t === 'door') v.walkTo(go.id);
    else if (go.t === 'guide') v.walkToNpc();
    else if (go.t === 'point') v.walkToPoint(go.x, go.z);
    else if (go.t === 'npc') {
      const vg = v.villagers, q = vg && vg.list[go.i] && vg.list[go.i].av.root.position;
      if (!vg || !q) return;
      vg.walkTo(go.i);
      // 멀리서 가면 닿을 때까지 기다려 준다 (길은 곧은 거리보다 조금 길다)
      if (p) vg.hold(go.i, Math.min(45, (Math.hypot(q.x - p.x, q.z - p.z) / WALK) * 1.5 + 4));
    } else if (go.t === 'fruit') {
      const T = v.fruitTrees || [];
      let best = go.i != null ? go.i : -1, bd = Infinity;
      if (best < 0 && p) T.forEach((t, i) => { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) v.walkToFruit(best);
    } else if (go.t === 'dig') {
      let best = go.i != null && v.beach && v.beach.isActive(go.i) ? go.i : -1, bd = Infinity;
      if (best < 0 && p) DIG_SPOTS.forEach((s, i) => { if (!v.beach || !v.beach.isActive(i)) return; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) v.walkToDig(best);
      else { v.walkToPoint(55.2, 3.4); o.toast('지금 반짝이는 곳이 없어요. 40초마다 새로 반짝이니 조금 기다려 봐요.', 3200); }
    } else if (go.t === 'table') {
      v.walkToPoint(11.2, 21.65, Math.PI, () => o.toast((v.dishList || []).length ? '접시를 누르면 누가 만든 요리인지 보여요.' : '아직 식탁에 요리가 없어요. 숲속 부엌에서 만들어 올려 봐요.', 3000));
    } else if (go.t === 'share') {
      const cart = v.shareCart;
      if (!cart) return;
      const a = cart.rotation.y;
      v.walkToPoint(cart.position.x + Math.sin(a) * 1.15, cart.position.z + Math.cos(a) * 1.15, a + Math.PI,
        () => o.toast((v.shareList || []).length ? '바구니를 누르면 하나 먹을 수 있어요.' : '지금은 수레가 비어 있어요.', 3000));
    }
  }

  // ---------- 고르기, 보는 칸 ----------
  function pick(id, fromList) {
    sel = id;
    if (fromList) { lastTree = null; lastDig = null; }
    // 목록에서 고르면 그곳이 있는 섬을 크게 본다 (마을 친구는 사는 섬)
    const sp = id.startsWith('npc') ? null : spots.find((s) => s.id === id);
    const isle = sp ? sp.isle : (VILLAGERS[+id.slice(3)] || {}).isle || 'main';
    if (fromList && isle !== view) setView(isle, true);
    redrawPins();
    els.card.replaceChildren(card());
    (fromList ? els.wrap : els.card).scrollIntoView({ block: fromList ? 'start' : 'nearest', behavior: 'smooth' });
  }
  function setView(id, quiet) {
    view = id;
    const V = VIEWS.find((x) => x.id === id);
    els.svg.setAttribute('viewBox', V.box.join(' '));
    els.svg.classList.toggle('all', id === 'all');
    for (const b of els.tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.v === id ? 'true' : 'false');
    if (!quiet) redrawPins();
  }
  function redrawPins() {
    const old = els.svg.querySelector('.gm-pins');
    const c = o.ctx();
    const g = pinLayer(c);
    if (old) old.replaceWith(g); else els.svg.append(g);
    drawLive(true);
  }

  // ---------- 장소 목록 ----------
  function listBox(c) {
    const groups = [
      ['말씀 활동 (상점에서 쓰는 열매를 모아요)', (s) => s.cat === 'word'],
      ['마을', (s) => s.cat === 'town' && s.isle === 'main'],
      [`놀이 마당 ${c.open ? '(오늘은 열려 있어요)' : `(${c.hint} 열려요)`}`, (s) => s.cat === 'play' && s.isle === 'main'],
      ['놀이동산 섬 (남쪽 다리 건너)', (s) => s.isle === 'park'],
      ['수영장 섬 (동쪽 다리 건너)', (s) => s.isle === 'pool'],
    ];
    const row = (sp) => {
      const st = status(sp, c);
      return h('button', { class: 'gm-row', type: 'button', style: `--cat:${CAT[sp.cat].color}`, onclick: () => pick(sp.id, true) },
        h('span', { class: 'gm-ico small', 'aria-hidden': 'true' }, sp.icon),
        h('span', { class: 'gm-row-t' }, h('b', {}, sp.name), h('span', {}, sp.short)),
        st && st.cls !== 'ok' ? h('span', { class: 'gm-row-st', 'aria-label': st.cls === 'soon' ? '곧 열려요' : '아직 닫혀 있어요' }, st.cls === 'soon' ? '⏳' : '🔒') : null);
    };
    return h('div', { class: 'gm-list' },
      groups.map(([title, f]) => {
        const items = spots.filter(f);
        return items.length ? h('section', {}, h('h3', {}, title), h('div', { class: 'gm-rows' }, items.map(row))) : null;
      }),
      v.villagers ? h('section', {}, h('h3', {}, '마을 친구 (섬마다 한 명, 🌱 이름표)'), h('div', { class: 'gm-rows' }, VILLAGERS.map((d, i) => row(npcSpot(i))))) : null);
  }

  // ---------- 열기 ----------
  function open(focus = null) {
    const c = o.ctx();
    spots = makeSpots(c);
    const me = myPos();
    const f = focus && spots.find((s) => s.id === focus);
    view = f && f.isle ? f.isle : isleOf(me);
    sel = f ? f.id : null;
    lastTree = null; lastDig = null;
    const svg = sv('svg', { class: 'gm-svg', viewBox: VIEWS.find((x) => x.id === view).box.join(' '), role: 'group', 'aria-label': '마을 지도. 북쪽이 위예요.' });
    svg.append(baseLayer());
    svg.addEventListener('click', (e) => {
      // 전체 보기에서 섬을 누르면 그 섬을 크게 본다
      const land = e.target.closest && e.target.closest('.gm-land');
      if (view === 'all' && land) setView(land.dataset.isle);
    });
    const tabs = h('div', { class: 'gm-tabs', role: 'group', 'aria-label': '지도 보는 곳' },
      VIEWS.map((x) => h('button', { type: 'button', 'data-v': x.id, 'aria-pressed': x.id === view ? 'true' : 'false', 'aria-label': x.id === 'all' ? '섬 셋 모두 보기' : `${x.name} 보기`, onclick: () => setView(x.id) }, x.tab)));
    const cardBox = h('div', { class: 'gm-side', 'aria-live': 'polite' });
    const wrap = h('div', { class: 'gm-wrap' }, h('div', { class: 'gm-map' }, svg), cardBox);
    const legend = h('div', { class: 'gm-legend', 'aria-hidden': 'true' },
      h('span', {}, h('i', { class: 'gm-me-dot' }), '나'),
      h('span', {}, h('i', { class: 'lg npc' }), '마을 친구'),
      h('span', {}, h('i', { class: 'lg friend' }), '함께 접속한 친구'),
      h('span', {}, '🔒 아직 닫힌 곳'),
      ...Object.values(CAT).map((k) => h('span', {}, h('i', { class: 'lg cat', style: `border-color:${k.color}` }), k.name)));
    els = { svg, tabs, card: cardBox, wrap };
    setView(view, true);
    redrawPins();
    cardBox.replaceChildren(card());
    o.openSheet('마을 지도', h('div', { class: 'gm' },
      h('p', { class: 'gm-intro' }, '어디에 무엇이 있는지 보고, 가고 싶은 곳을 눌러요. 북쪽이 위예요.'),
      tabs, wrap, legend, listBox(c)), 'map-sheet');
    clearInterval(timer);
    timer = setInterval(() => {
      if (!svg.isConnected || document.getElementById('modal').hidden) { clearInterval(timer); return; }
      drawLive();
    }, 700);
  }

  return { open };
}
