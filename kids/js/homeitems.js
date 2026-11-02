// 진숲 어린이 마을 — 내 집 꾸미기 물건 (방, 마당, 밭)
// 상점, 내 집 화면, 체험판, 서버 SQL이 모두 이 목록을 쓴다. 값을 바꾸면 sql도 함께 바꾼다.
// w, d: 차지하는 칸 수 (가로, 세로). floor: 바닥에 까는 것(다른 가구를 위에 놓을 수 있다).
// 씨앗(s_)은 밭 한 칸에 하나씩 심고, 다 자란 채소를 거두면 없어진다. 꽃은 다 자라면 그대로 핀다.

export const HOME_ITEMS = {
  // 방
  h_bed: { zone: 'room', name: '침대', desc: '포근한 이불이 덮인 침대예요.', price: 8, w: 2, d: 3 },
  h_desk: { zone: 'room', name: '책상', desc: '공책을 펴고 말씀을 따라 쓰기 좋은 책상이에요.', price: 5, w: 2, d: 1 },
  h_chair: { zone: 'room', name: '의자', desc: '책상이나 탁자 옆에 두는 나무 의자예요.', price: 2, w: 1, d: 1 },
  h_sofa: { zone: 'room', name: '소파', desc: '친구와 나란히 앉을 수 있는 폭신한 소파예요.', price: 7, w: 2, d: 1 },
  h_shelf: { zone: 'room', name: '책장', desc: '좋아하는 책을 가득 꽂아 둔 책장이에요.', price: 6, w: 2, d: 1 },
  h_table: { zone: 'room', name: '동그란 탁자', desc: '찻잔을 올려 둔 작은 탁자예요.', price: 3, w: 1, d: 1 },
  h_rug: { zone: 'room', name: '동그란 러그', desc: '바닥에 까는 알록달록한 깔개예요. 위에 가구를 놓을 수 있어요.', price: 4, w: 2, d: 2, floor: true },
  h_lamp: { zone: 'room', name: '스탠드', desc: '밤이 되면 따뜻하게 빛나요.', price: 3, w: 1, d: 1, glow: true },
  h_pot: { zone: 'room', name: '화분', desc: '잎이 넓은 초록 식물이에요.', price: 2, w: 1, d: 1 },
  h_toys: { zone: 'room', name: '장난감 상자', desc: '곰 인형과 공이 들어 있어요.', price: 3, w: 1, d: 1 },
  h_piano: { zone: 'room', name: '작은 피아노', desc: '누르면 딩동 소리가 날 것 같은 피아노예요.', price: 9, w: 2, d: 1 },
  // 마당
  y_bench: { zone: 'yard', name: '벤치', desc: '마당에서 쉬어 가는 나무 벤치예요.', price: 5, w: 2, d: 1 },
  y_lamp: { zone: 'yard', name: '정원등', desc: '밤이 되면 마당을 환하게 밝혀요.', price: 3, w: 1, d: 1, glow: true },
  y_swing: { zone: 'yard', name: '그네', desc: '바람에 살랑살랑 흔들리는 그네예요.', price: 8, w: 3, d: 2 },
  y_fountain: { zone: 'yard', name: '분수', desc: '맑은 물이 퐁퐁 솟는 작은 분수예요.', price: 9, w: 2, d: 2 },
  y_birdhouse: { zone: 'yard', name: '새집', desc: '작은 새가 쉬어 가는 나무 새집이에요.', price: 3, w: 1, d: 1 },
  y_picnic: { zone: 'yard', name: '피크닉 탁자', desc: '가족과 친구가 둘러앉는 나무 탁자예요.', price: 7, w: 2, d: 2 },
  y_tree: { zone: 'yard', name: '작은 나무', desc: '마당에 심는 동그란 나무예요.', price: 6, w: 1, d: 1 },
  y_slide: { zone: 'yard', name: '미끄럼틀', desc: '계단으로 올라가서 쭉 미끄러져요.', price: 8, w: 1, d: 3 },
  y_mailbox: { zone: 'yard', name: '우체통', desc: '빨간 우체통이에요.', price: 2, w: 1, d: 1 },
  // 밭 (씨앗과 모종)
  s_carrot: { zone: 'garden', name: '당근 씨앗', grown: '당근', kind: 'veg', desc: '심고 이틀이 지나면 당근 3개를 거둬요.', price: 1, w: 1, d: 1 },
  s_tomato: { zone: 'garden', name: '토마토 씨앗', grown: '토마토', kind: 'veg', desc: '사흘이 지나면 토마토가 열려요. 따고 나면 하루 반 뒤에 또 열려서 세 번 거둬요.', price: 1, w: 1, d: 1 },
  s_cabbage: { zone: 'garden', name: '배추 씨앗', grown: '배추', kind: 'veg', desc: '나흘이 지나면 커다란 배추 2포기를 거둬요.', price: 1, w: 1, d: 1 },
  s_strawberry: { zone: 'garden', name: '딸기 모종', grown: '딸기', kind: 'veg', desc: '닷새가 지나면 딸기가 열려요. 따고 나면 이틀 뒤에 또 열려서 세 번 거둬요.', price: 2, w: 1, d: 1 },
  s_sunflower: { zone: 'garden', name: '해바라기 씨앗', grown: '해바라기', kind: 'flower', desc: '사흘이 지나면 키 큰 해바라기가 피어요.', price: 1, w: 1, d: 1 },
  s_tulip: { zone: 'garden', name: '튤립 알뿌리', grown: '튤립', kind: 'flower', desc: '이틀이 지나면 예쁜 튤립이 피어요.', price: 2, w: 1, d: 1 },
};
export const HOME_IDS = Object.keys(HOME_ITEMS);
export const ZONE_NAMES = { room: '방', yard: '마당', garden: '밭' };
export const isSeed = (id) => String(id).startsWith('s_');

// 내 집 땅 (집 안 좌표, 1칸 = 1). 방 안, 마당, 밭
export const ROOM = { x0: -10, x1: -2, z0: -10, z1: -4 };
export const GARDEN = { x0: 2, x1: 8, z0: -10, z1: -7 };
export const YARD_RECTS = [{ x0: -11, x1: 11, z0: -3, z1: 9 }, { x0: -1, x1: 11, z0: -10, z1: -3 }];
export const ISLAND = { x0: -12.5, x1: 12.5, z0: -11.5, z1: 10.5 };
// 비워 두는 칸: 옷장, 방문 안팎, 마당 가운데 길
const RESERVED = new Set();
const res = (x, z) => RESERVED.add(`${x},${z}`);
res(-10, -10); res(-10, -9);
res(-3, -7); res(-3, -6);
for (let z = -7; z < -3; z++) res(-1, z);
for (let z = -3; z < 9; z++) { res(-1, z); res(0, z); }
export function isReserved(x, z) { return RESERVED.has(`${x},${z}`); }

const inRect = (r, x, z) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
// 칸 (x, z)가 이 구역인지
export function cellZone(x, z) {
  if (isReserved(x, z)) return null;
  if (inRect(ROOM, x, z)) return 'room';
  if (inRect(GARDEN, x, z)) return 'garden';
  if (YARD_RECTS.some((r) => inRect(r, x, z))) return 'yard';
  return null;
}
// 돌린 뒤의 가로, 세로 칸 수
export function footprint(id, r = 0) {
  const it = HOME_ITEMS[id];
  if (!it) return { w: 1, d: 1 };
  return r % 2 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
}
// 놓인 물건 e = { k, x, z, r }가 차지하는 칸들
export function cellsOf(e) {
  const { w, d } = footprint(e.k, e.r || 0);
  const out = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([e.x + i, e.z + j]);
  return out;
}
// 놓을 수 있는지: 모든 칸이 그 물건의 구역이고, 다른 물건과 겹치지 않아야 한다 (깔개는 깔개끼리만 겹치지 않는다)
export function canPlace(layout, e, ignoreId = null) {
  const it = HOME_ITEMS[e.k];
  if (!it) return false;
  const mine = cellsOf(e);
  if (mine.some(([x, z]) => cellZone(x, z) !== it.zone)) return false;
  const taken = new Set();
  for (const o of layout) {
    if (o.id === ignoreId) continue;
    const oi = HOME_ITEMS[o.k];
    if (!oi || !!oi.floor !== !!it.floor) continue;
    for (const [x, z] of cellsOf(o)) taken.add(`${x},${z}`);
  }
  return mine.every(([x, z]) => !taken.has(`${x},${z}`));
}
// 물건 가운데 (집 안 좌표)
export function centerOf(e) {
  const { w, d } = footprint(e.k, e.r || 0);
  return { x: e.x + w / 2, z: e.z + d / 2 };
}

// 식물마다 자라는 시간 (서버 kids__crop과 같다)
// need: 심고 나서 다 자라기까지(시간), again: 열매를 딴 뒤 다시 열리기까지, picks: 거둘 수 있는 횟수, yield: 한 번에 거두는 수
export const CROPS = {
  s_carrot: { crop: 'carrot', need: 48, again: 0, picks: 1, yield: 3 },
  s_tomato: { crop: 'tomato', need: 72, again: 36, picks: 3, yield: 3 },
  s_cabbage: { crop: 'cabbage', need: 96, again: 0, picks: 1, yield: 2 },
  s_strawberry: { crop: 'strawberry', need: 120, again: 48, picks: 3, yield: 4 },
  s_sunflower: { need: 72 },
  s_tulip: { need: 48 },
};
// 수확 바구니에 모이는 것. sell: 열매 1개를 받으려면 몇 개를 팔아야 하는지 (서버 kids__sell_bundle과 같다)
export const HARVEST = {
  carrot: { name: '당근', unit: '개', sell: 2, icon: '🥕', color: '#F49A4C' },
  tomato: { name: '토마토', unit: '개', sell: 3, icon: '🍅', color: '#EF4A3E' },
  cabbage: { name: '배추', unit: '포기', sell: 1, icon: '🥬', color: '#9BD971' },
  strawberry: { name: '딸기', unit: '개', sell: 4, icon: '🍓', color: '#E8394B' },
};
export const CROP_IDS = Object.keys(HARVEST);
// 물: 12시간에 한 번, 줄 때마다 6시간만큼 빨리 자란다. 심은 지 10분이면 싹이 난다
export const GROW = { sprout: 1 / 6, water: 6, waterEvery: 12 };
// 자람은 서버 시각으로 잰다 (기기 시계가 틀려도 같게)
let skew = 0;
export function setServerNow(ms) { if (Number.isFinite(ms)) skew = ms - Date.now(); }
export const serverNow = () => Date.now() + skew;
export function needHours(e) {
  const c = e && CROPS[e.k];
  if (!c) return 48;
  return (e.n || 0) > 0 ? c.again : c.need;
}
export function growHours(e, now = serverNow()) {
  if (!e || !e.t) return 0;
  return Math.max(0, (now - e.t) / 3600000) + (e.g || 0);
}
// 0: 씨앗 심은 흙, 1: 싹, 2: 자라는 중(열매를 딴 뒤 다시 맺는 중), 3: 다 자람
export function growStage(e, now = serverNow()) {
  const hrs = growHours(e, now), need = needHours(e);
  if (hrs >= need) return 3;
  if ((e.n || 0) > 0) return 2;
  return hrs >= need * 0.5 ? 2 : hrs >= GROW.sprout ? 1 : 0;
}
export function canWater(e, now = serverNow()) {
  return growStage(e, now) < 3 && (!e.w || now - e.w >= GROW.waterEvery * 3600000);
}
// 남은 시간을 아이가 읽기 쉽게: '1일 5시간', '3시간', '40분'
export function leftText(hours) {
  const hrs = Math.max(0, hours);
  if (hrs < 1) return `${Math.max(1, Math.ceil(hrs * 60))}분`;
  const d = Math.floor(hrs / 24), hh = Math.ceil(hrs - d * 24);
  if (hh === 24) return `${d + 1}일`;
  return d ? (hh ? `${d}일 ${hh}시간` : `${d}일`) : `${hh}시간`;
}
