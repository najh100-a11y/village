// 진숲 어린이 마을 — 집 모양 데이터 (그림을 그리지 않는 곳: 선생님 화면, 체험판 서버도 쓴다)
// 나무 오두막과 빨간 벽돌집은 누구나 고르고, 한옥·통나무집·버섯집·작은 성은 열매 상점에서 산다(hs_ 물건, 서버 kids__item_price와 같은 값).
// 지붕 색은 '옷 색깔'(처음 값: 내 옷 색을 따른다) 또는 아래 여덟 가지에서 고른다.
export const HOUSE_STYLES = {
  cabin: { name: '나무 오두막', price: 0, roof: '#4FA36C', desc: '나무 판자로 지은 세모 지붕 오두막이에요.' },
  brick: { name: '빨간 벽돌집', price: 0, roof: '#6B6F7A', desc: '빨간 벽돌을 차곡차곡 쌓고 굴뚝을 단 집이에요.' },
  hanok: { name: '한옥', price: 15, roof: '#4A4F57', desc: '하얀 벽과 나무 기둥, 끝이 살짝 들린 기와지붕을 얹은 우리 옛집이에요.' },
  log: { name: '통나무집', price: 15, roof: '#7A4E2D', desc: '둥근 통나무를 가로로 쌓아 지은 숲속 집이에요.' },
  mushroom: { name: '버섯집', price: 15, roof: '#D9534F', desc: '하얀 점이 콕콕 박힌 커다란 버섯 지붕 집이에요.' },
  castle: { name: '작은 성', price: 15, roof: '#4C8FC4', desc: '돌벽 위에 성가퀴를 두르고, 뾰족 지붕 탑에 깃발을 단 작은 성이에요.' },
};
export const HOUSE_IDS = Object.keys(HOUSE_STYLES);
export const houseItem = (s) => `hs_${s}`;
export const isFreeHouse = (s) => !!HOUSE_STYLES[s] && !HOUSE_STYLES[s].price;
// 지붕 색 (auto: 내 옷 색)
export const ROOF_COLORS = {
  auto: { name: '옷 색깔', c: null }, green: { name: '초록', c: '#4FA36C' }, red: { name: '빨강', c: '#D9534F' },
  blue: { name: '파랑', c: '#4C8FC4' }, orange: { name: '주황', c: '#F08A3E' }, purple: { name: '보라', c: '#8E6CC4' },
  brown: { name: '갈색', c: '#7A4E2D' }, gray: { name: '회색', c: '#6B6F7A' }, pink: { name: '분홍', c: '#EE8DB0' },
};
// 서버에 저장된 모양 { s: 모양, c: 지붕 색 }을 고친다 (모르는 값은 처음 값으로)
export function lookOf(look) {
  const l = look && typeof look === 'object' ? look : {};
  return { s: HOUSE_STYLES[l.s] ? l.s : 'cabin', c: ROOF_COLORS[l.c] ? l.c : 'auto' };
}
// 지붕 색: 'auto'면 주인의 옷 색(autoC), 그것도 없으면 모양마다 정한 색
export function roofColor(look, autoC) {
  const l = lookOf(look);
  return ROOF_COLORS[l.c].c || autoC || HOUSE_STYLES[l.s].roof;
}
// 열매 상점에서 파는 집 모양 (hs_ 물건)
export const HOUSE_ITEMS = Object.fromEntries(HOUSE_IDS.filter((s) => HOUSE_STYLES[s].price).map((s) => [houseItem(s), { ...HOUSE_STYLES[s], style: s }]));
export const HOUSE_ITEM_IDS = Object.keys(HOUSE_ITEMS);
