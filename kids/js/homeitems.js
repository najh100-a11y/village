// 진숲 어린이 마을 — 내 집 꾸미기 물건 (방, 마당, 밭)과 집 넓히기(거실, 주방, 방 2, 방 3)
// 상점, 내 집 화면, 체험판, 서버 SQL이 모두 이 목록을 쓴다. 값을 바꾸면 sql도 함께 바꾼다.
// w, d: 차지하는 칸 수 (가로, 세로). floor: 바닥에 까는 것(다른 가구를 위에 놓을 수 있다).
// zone: 'room'은 집 안 어느 방에나(내 방, 거실, 주방, 방 2, 방 3), 'kitchen'은 주방에만, 'yard'는 마당, 'garden'은 밭.
// grp: 상점과 꾸미기 판에서 묶어 보이는 칸 (bed 방, living 거실, kitchen 주방). v2: 집 넓히기와 함께 생긴 물건
// 씨앗(s_)은 밭 한 칸에 하나씩 심고, 다 자란 채소를 거두면 없어진다. 꽃은 다 자라면 그대로 핀다.

export const HOME_ITEMS = {
  // 방
  h_bed: { zone: 'room', grp: 'bed', name: '침대', desc: '포근한 이불이 덮인 침대예요.', price: 8, w: 2, d: 3 },
  h_desk: { zone: 'room', grp: 'bed', name: '책상', desc: '공책을 펴고 말씀을 따라 쓰기 좋은 책상이에요.', price: 5, w: 2, d: 1 },
  h_chair: { zone: 'room', grp: 'bed', name: '의자', desc: '책상이나 탁자 옆에 두는 나무 의자예요.', price: 2, w: 1, d: 1 },
  h_sofa: { zone: 'room', grp: 'living', name: '소파', desc: '친구와 나란히 앉을 수 있는 폭신한 소파예요.', price: 7, w: 2, d: 1 },
  h_shelf: { zone: 'room', grp: 'bed', name: '책장', desc: '좋아하는 책을 가득 꽂아 둔 책장이에요.', price: 6, w: 2, d: 1 },
  h_table: { zone: 'room', grp: 'living', name: '동그란 탁자', desc: '찻잔을 올려 둔 작은 탁자예요.', price: 3, w: 1, d: 1 },
  h_rug: { zone: 'room', grp: 'bed', name: '동그란 러그', desc: '바닥에 까는 알록달록한 깔개예요. 위에 가구를 놓을 수 있어요.', price: 4, w: 2, d: 2, floor: true },
  h_lamp: { zone: 'room', grp: 'bed', name: '스탠드', desc: '밤이 되면 따뜻하게 빛나요.', price: 3, w: 1, d: 1, glow: true },
  h_pot: { zone: 'room', grp: 'living', name: '화분', desc: '잎이 넓은 초록 식물이에요.', price: 2, w: 1, d: 1 },
  h_toys: { zone: 'room', grp: 'bed', name: '장난감 상자', desc: '곰 인형과 공이 들어 있어요.', price: 3, w: 1, d: 1 },
  h_piano: { zone: 'room', grp: 'living', name: '작은 피아노', desc: '의자에 앉아 건반을 누르면 진짜로 연주할 수 있어요. 찬송가 따라 치기도 있어요.', price: 9, w: 2, d: 1 },
  h_bunk: { zone: 'room', grp: 'bed', name: '2층 침대', desc: '사다리가 달린 2층 침대예요. 아래 칸에 누울 수 있어요.', price: 10, w: 2, d: 3, v2: true },
  h_drawer: { zone: 'room', grp: 'bed', name: '서랍장', desc: '옷과 물건을 넣어 두는 세 칸 서랍장이에요.', price: 5, w: 2, d: 1, v2: true },
  h_dresser: { zone: 'room', grp: 'bed', name: '화장대', desc: '동그란 거울이 달린 화장대와 작은 의자예요.', price: 6, w: 2, d: 1, v2: true },
  h_globe: { zone: 'room', grp: 'bed', name: '지구본', desc: '빙글빙글 천천히 도는 지구본이에요.', price: 3, w: 1, d: 1, v2: true },
  // 거실
  h_bigsofa: { zone: 'room', grp: 'living', name: '큰 소파', desc: '셋이 나란히 앉을 수 있는 커다란 소파예요.', price: 9, w: 3, d: 1, v2: true },
  h_coffee: { zone: 'room', grp: 'living', name: '거실 탁자', desc: '소파 앞에 두는 낮은 탁자예요. 과일 접시와 책이 놓여 있어요.', price: 4, w: 2, d: 1, v2: true },
  h_tv: { zone: 'room', grp: 'living', name: '텔레비전', desc: '낮은 장 위에 놓인 텔레비전이에요. 누르면 켜지고 꺼져요.', price: 7, w: 2, d: 1, v2: true },
  h_fishtank: { zone: 'room', grp: 'living', name: '어항', desc: '작은 물고기 세 마리가 헤엄치고 물방울이 보글보글 올라와요.', price: 8, w: 2, d: 1, v2: true },
  h_clock: { zone: 'room', grp: 'living', name: '괘종시계', desc: '시계추가 똑딱똑딱 흔들리고, 바늘이 이 기기의 지금 시각을 가리켜요.', price: 6, w: 1, d: 1, v2: true },
  h_rocking: { zone: 'room', grp: 'living', name: '흔들의자', desc: '쿠션을 얹은 나무 흔들의자예요. 앉아서 쉴 수 있어요.', price: 5, w: 1, d: 1, v2: true },
  h_beanbag: { zone: 'room', grp: 'living', name: '빈백', desc: '푹 파묻혀 앉는 말랑말랑한 의자예요.', price: 4, w: 1, d: 1, v2: true },
  h_bigrug: { zone: 'room', grp: 'living', name: '네모 러그', desc: '거실에 까는 커다란 네모 깔개예요. 위에 가구를 놓을 수 있어요.', price: 5, w: 3, d: 2, floor: true, v2: true },
  h_tallplant: { zone: 'room', grp: 'living', name: '큰 화분', desc: '잎이 넓적한 키 큰 초록 식물이에요.', price: 3, w: 1, d: 1, v2: true },
  h_fireplace: { zone: 'room', grp: 'living', name: '벽난로', desc: '빨간 벽돌 벽난로예요. 장작불이 일렁일렁 타올라요.', price: 9, w: 2, d: 1, v2: true },
  // 주방 (식탁은 어느 방에나, 나머지는 주방에만)
  h_dtable: { zone: 'room', grp: 'kitchen', name: '식탁', desc: '의자 네 개가 딸린 식탁이에요. 넷이 둘러앉을 수 있어요.', price: 8, w: 2, d: 3, v2: true },
  h_fridge: { zone: 'kitchen', grp: 'kitchen', name: '냉장고', desc: '누르면 문이 열려서 안에 든 음식이 보여요.', price: 7, w: 1, d: 1, v2: true },
  h_sink: { zone: 'kitchen', grp: 'kitchen', name: '싱크대', desc: '누르면 수도꼭지에서 물이 나와요.', price: 6, w: 2, d: 1, v2: true },
  h_cupboard: { zone: 'kitchen', grp: 'kitchen', name: '그릇장', desc: '접시와 컵을 가지런히 넣어 둔 그릇장이에요.', price: 6, w: 2, d: 1, v2: true },
  h_oven: { zone: 'kitchen', grp: 'kitchen', name: '오븐', desc: '유리창으로 안이 보이는 오븐이에요. 밤이 되면 안에 불이 켜져요.', price: 5, w: 1, d: 1, glow: true, v2: true },
  // 마당
  y_bench: { zone: 'yard', name: '벤치', desc: '마당에서 쉬어 가는 나무 벤치예요.', price: 5, w: 2, d: 1 },
  y_lamp: { zone: 'yard', name: '정원등', desc: '밤이 되면 마당을 환하게 밝혀요.', price: 3, w: 1, d: 1, glow: true },
  y_swing: { zone: 'yard', name: '그네', desc: "앉아서 '힘껏 구르기'를 누를수록 높이 올라가는 그네예요.", price: 8, w: 3, d: 2 },
  y_fountain: { zone: 'yard', name: '분수', desc: '맑은 물이 퐁퐁 솟는 작은 분수예요.', price: 9, w: 2, d: 2 },
  y_birdhouse: { zone: 'yard', name: '새집', desc: '작은 새가 쉬어 가는 나무 새집이에요.', price: 3, w: 1, d: 1 },
  y_picnic: { zone: 'yard', name: '피크닉 탁자', desc: '가족과 친구가 둘러앉는 나무 탁자예요.', price: 7, w: 2, d: 2 },
  y_tree: { zone: 'yard', name: '작은 나무', desc: '마당에 심는 동그란 나무예요.', price: 6, w: 1, d: 1 },
  y_slide: { zone: 'yard', name: '미끄럼틀', desc: '누르면 사다리를 올라가서 쭉 미끄러져 내려와요.', price: 8, w: 1, d: 3 },
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
export const ZONE_NAMES = { room: '방', yard: '마당', garden: '밭', kitchen: '주방' };
export const GROUP_NAMES = { bed: '🛏️ 방', living: '🛋️ 거실', kitchen: '🍳 주방' };
export const isSeed = (id) => String(id).startsWith('s_');

// ---------- 집 넓히기: 내 방 왼쪽(서쪽)으로 지은 차례대로 한 칸(가로 8, 세로 6)씩 붙는다 ----------
// price는 열매 (선생님 할인을 받는다). 서버 kids__build_price와 같다
export const SPACES = {
  room: { name: '내 방', icon: '🛏️' },
  living: { name: '거실', icon: '🛋️', price: 20, desc: '소파와 텔레비전을 두고 친구들과 모여 노는 방이에요.' },
  kitchen: { name: '주방', icon: '🍳', price: 20, desc: '조리대와 화덕이 함께 생겨서 요리 놀이를 할 수 있어요. 냉장고, 싱크대 같은 주방 물건은 주방에만 놓아요.' },
  room2: { name: '방 2', icon: '🛏️', price: 15, desc: '침대와 책상을 하나 더 둘 수 있는 방이에요.' },
  room3: { name: '방 3', icon: '🛏️', price: 15, desc: '방이 하나 더 있으면 좋겠다 싶을 때 지어요.' },
};
export const BUILD_IDS = ['living', 'kitchen', 'room2', 'room3'];
export const INDOOR = ['room', ...BUILD_IDS];
export const isIndoor = (z) => INDOOR.includes(z);
export const SLOT_W = 8;
// 벽지와 바닥 (서버 kids_home_style과 같은 이름)
export const WALLS = {
  cream: { name: '크림', c: '#F6E3C2' }, mint: { name: '민트', c: '#CDEBD9' }, sky: { name: '하늘', c: '#CFE6F7' },
  pink: { name: '분홍', c: '#F9D5E0' }, lemon: { name: '레몬', c: '#FBEFB2' }, lilac: { name: '라벤더', c: '#E1D7F2' },
  stripe: { name: '줄무늬', c: '#FFF4E2', c2: '#F6C9CF', pat: 'stripe' }, dots: { name: '물방울', c: '#D8ECF8', c2: '#FFFFFF', pat: 'dots' },
};
export const FLOORS = {
  wood: { name: '나무', c: '#D9A86C', c2: '#C48F55', pat: 'plank' }, light: { name: '밝은 나무', c: '#EBCB98', c2: '#D6B07A', pat: 'plank' },
  dark: { name: '진한 나무', c: '#A8744A', c2: '#8E5F3A', pat: 'plank' }, tile: { name: '바둑판 타일', c: '#FFFDF7', c2: '#BFDDEB', pat: 'check' },
  mintc: { name: '민트 카펫', c: '#A9DCC4', c2: '#9CD2B9', pat: 'soft' }, pinkc: { name: '분홍 카펫', c: '#F4BCCB', c2: '#EDAFC0', pat: 'soft' },
  bluec: { name: '파란 카펫', c: '#A9CBEB', c2: '#9BBFE3', pat: 'soft' },
};
export const STYLE_DEFAULT = {
  room: { w: 'cream', f: 'wood' }, living: { w: 'cream', f: 'light' }, kitchen: { w: 'mint', f: 'tile' },
  room2: { w: 'sky', f: 'wood' }, room3: { w: 'pink', f: 'wood' },
};
export function styleOf(style, id) {
  const s = (style && style[id]) || {};
  const d = STYLE_DEFAULT[id] || STYLE_DEFAULT.room;
  return { w: WALLS[s.w] ? s.w : d.w, f: FLOORS[s.f] ? s.f : d.f };
}

// 내 집 땅 (집 안 좌표, 1칸 = 1). 방 안, 마당, 밭
export const ROOM = { x0: -10, x1: -2, z0: -10, z1: -4 };
export const GARDEN = { x0: 2, x1: 8, z0: -10, z1: -7 };
// 마당: 대문 쪽 넓은 마당(왼쪽으로 집 넓히기 터 앞까지)과 밭 둘레
export const YARD_RECTS = [{ x0: -43, x1: 11, z0: -3, z1: 9 }, { x0: -1, x1: 11, z0: -10, z1: -3 }];
export const ISLAND = { x0: -44.5, x1: 12.5, z0: -11.5, z1: 10.5 };
export const LOT_X0 = ROOM.x0 - SLOT_W * BUILD_IDS.length; // 공사 터 왼쪽 끝 (-42)
// 앞마당(원래 마당)과 옆마당(새로 넓어진 마당): 꾸미기 판에서 따로 본다
export const YARD_PARTS = { yard: { x0: -12, x1: 11 }, yard2: { x0: -43, x1: -12 } };

// 지은 방 차례 (서버 kids_homes.rooms). 처음 보는 이름이나 겹친 것은 뺀다
export function cleanRooms(list) {
  const out = [];
  for (const id of Array.isArray(list) ? list : []) if (BUILD_IDS.includes(id) && !out.includes(id)) out.push(id);
  return out;
}
// 방들의 자리: 내 방(-10~-2) 다음부터 왼쪽으로 8칸씩
export function spaceList(rooms) {
  const out = [{ id: 'room', ...ROOM }];
  cleanRooms(rooms).forEach((id, i) => out.push({ id, x0: ROOM.x0 - SLOT_W * (i + 1), x1: ROOM.x0 - SLOT_W * i, z0: ROOM.z0, z1: ROOM.z1 }));
  return out;
}
// 방문 자리: 방과 방 사이 문(z -6.5), 새 방의 앞문(앞벽 가운데)
export const frontDoorX = (s) => s.x1 - SLOT_W / 2;
// 주방 조리대(요리 놀이 자리): 주방 왼쪽 끝에서 3칸, 뒤 벽에서 2.4칸. 요리 놀이의 숲속 부엌과 같은 모양이다
export const cookAt = (s) => ({ x: s.x0 + 3, z: -7.6 });

// 비워 두는 칸: 옷장, 방문 안팎, 마당 가운데 길, 주방 조리대 둘레
const BASE_RES = new Set();
{
  const res = (x, z) => BASE_RES.add(`${x},${z}`);
  res(-10, -10); res(-10, -9);
  res(-3, -7); res(-3, -6);
  for (let z = -7; z < -3; z++) res(-1, z);
  for (let z = -3; z < 9; z++) { res(-1, z); res(0, z); }
}
function reservedFor(rooms) {
  const R = new Set(BASE_RES);
  const res = (x, z) => R.add(`${x},${z}`);
  for (const s of spaceList(rooms).slice(1)) {
    // 오른쪽(동쪽) 방과 잇는 문: 문 양쪽 두 칸씩
    for (const z of [-7, -6]) { res(s.x1 - 1, z); res(s.x1, z); }
    const c = frontDoorX(s);
    res(c - 1, -5); res(c, -5);
    if (s.id === 'kitchen') {
      const { x } = cookAt(s), x0 = x - 3;
      for (let i = 1; i <= 4; i++) for (const z of [-9, -8]) res(x0 + i, z); // 조리대와 그 뒤에 서는 곳 (맨 뒤 벽 앞 한 줄은 그릇장 같은 것을 둘 수 있다)
      res(x0 + 5, -8); res(x0 + 4, -7); res(x0 + 5, -7); // 화덕
      res(x0 + 2, -7); res(x0 + 3, -7); // 조리대 앞
    }
  }
  return R;
}

// 지금 보고 있는 집 (내 집 또는 놀러 간 친구 집)의 방 차례. 화면에 집을 그릴 때 정한다
let ROOMS = [];
let SPACE_LIST = spaceList([]);
let RESERVED = reservedFor([]);
export function setRooms(rooms) {
  ROOMS = cleanRooms(rooms);
  SPACE_LIST = spaceList(ROOMS);
  RESERVED = reservedFor(ROOMS);
}
export const builtRooms = () => ROOMS.slice();
export const spaces = () => SPACE_LIST;
export const spaceById = (id) => SPACE_LIST.find((s) => s.id === id) || null;
export function isReserved(x, z) { return RESERVED.has(`${x},${z}`); }

const inRect = (r, x, z) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
// 칸 (x, z)가 어느 구역인지: 방 이름(room, living, kitchen, room2, room3), yard, garden, 아무 데도 아니면 null
export function cellZone(x, z) {
  if (isReserved(x, z)) return null;
  for (const s of SPACE_LIST) if (inRect(s, x, z)) return s.id;
  if (inRect(GARDEN, x, z)) return 'garden';
  if (YARD_RECTS.some((r) => inRect(r, x, z))) return 'yard';
  return null;
}
// 물건이 그 구역에 놓일 수 있는지 (집 안 물건은 어느 방에나, 주방 물건은 주방에만)
export function zoneFits(itemZone, cz) {
  if (itemZone === 'room') return isIndoor(cz);
  return itemZone === cz;
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
  if (mine.some(([x, z]) => !zoneFits(it.zone, cellZone(x, z)))) return false;
  // 한 물건은 한 방 안에만 (방과 방 사이 벽에 걸치지 않게)
  if (isIndoor(cellZone(mine[0][0], mine[0][1])) && mine.some(([x, z]) => cellZone(x, z) !== cellZone(mine[0][0], mine[0][1]))) return false;
  const taken = new Set();
  for (const o of layout) {
    if (o.id === ignoreId) continue;
    const oi = HOME_ITEMS[o.k];
    if (!oi || !!oi.floor !== !!it.floor) continue;
    for (const [x, z] of cellsOf(o)) taken.add(`${x},${z}`);
  }
  return mine.every(([x, z]) => !taken.has(`${x},${z}`));
}
// 놓인 물건이 지금 집 모양에서도 제자리에 맞는지 (집을 넓혀 문이 새로 난 자리에 있던 물건은 가방으로)
export function fitsZone(e) {
  const it = HOME_ITEMS[e.k];
  return !!it && cellsOf(e).every(([x, z]) => zoneFits(it.zone, cellZone(x, z)));
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
