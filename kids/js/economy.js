// 진숲 어린이 마을 — 열매 주고받기 규칙 (선물, 팔기, 할인)
// 값은 서버(sql/2026-11-01-gift-sell-wardrobe.sql)와 같다. 서버가 늘 다시 확인한다.

// 잡은 물고기와 곤충, 캔 보물은 묶음으로 판다: 몇 개를 모으면 열매 1개인지 (흔함, 가끔, 드묾, 아주 드묾).
// 송사리 같은 흔한 물고기와 흔한 곤충은 10마리에 열매 1개. 낡은 장화와 빈 깡통은 팔 수 없다.
export const SELL_BUNDLE = { fish: [10, 5, 2, 1], bug: [10, 5, 2], treasure: [10, 5, 2, 1] };
// 하루에 팔아서 받을 수 있는 열매 (선생님이 바꿀 수 있다. 0이면 팔기를 닫는다)
export const SELL_DAY_DEFAULT = 5;
export const SELL_DAY_CHOICES = [0, 3, 5, 10, 15, 20];
// 말씀 활동으로 받는 열매. 선생님이 선생님 화면에서 바꾸고, 앱은 서버(kids_features의 rewards)에서 받아 온 숫자로 안내한다.
// 처음 값(sql/2026-11-16-word-rewards.sql): 묵상 하루 5개, 암송 연습 구절마다 하루 2개(하루 3구절까지),
// 필사 한 주 5개(공책 사진을 올리면 그 주 모두 15개), 선생님 도장 10개. 실제로 주는 열매는 서버가 정한다.
export const REWARD = { memory: 2, verses: 3, qt: 5, copy: 5, photo: 15, stamp: 10 };
// 이 기능 전의 서버(rewards를 알려 주지 않는다)가 주는 열매. verses 0은 하루 구절 수 제한이 없다는 뜻
const REWARD_OLD = { memory: 1, verses: 0, qt: 2, copy: 3, photo: 10, stamp: 10 };
// 서버가 알려 준 숫자로 바꾼다 (모든 안내 글이 REWARD를 읽는다)
export function setRewards(r) {
  if (!r || typeof r !== 'object') { Object.assign(REWARD, REWARD_OLD); return; }
  const n = (x, d) => (Number.isInteger(x) && x > 0 ? x : d);
  Object.assign(REWARD, { memory: n(r.memory, 2), verses: n(r.memory_verses, 3), qt: n(r.qt, 5), copy: n(r.copy, 5), stamp: n(r.stamp, 10) });
  REWARD.photo = Math.max(REWARD.copy, n(r.photo, 15));
}
// 선생님이 고르는 말씀 활동 열매 (서버 kids_t_set_rewards가 받는 범위 안)
export const REWARD_CHOICES = {
  qt: [1, 2, 3, 4, 5, 6, 7, 8, 10], memory: [1, 2, 3, 4, 5], verses: [1, 2, 3, 4, 5, 10],
  copy: [1, 2, 3, 4, 5, 6, 8, 10], photo: [5, 8, 10, 12, 15, 20, 25, 30], stamp: [5, 10, 15, 20, 25, 30],
};
// 선물: 한 번에 1~10개, 하루에 보내는 열매는 모두 10개까지
export const GIFT = { max: 10, day: 10, choices: [1, 2, 3, 5, 10] };
// 선물과 함께 보내는 한마디 (정해진 말만 보낸다)
export const GIFT_MSGS = { thanks: '고마워!', bday: '생일 축하해!', cheer: '힘내!', play: '같이 놀자!', bless: '축복해!', best: '네가 최고야!' };
// 선생님이 고르는 열매 상점 할인 (퍼센트)
export const SALES = [0, 10, 20, 30, 40, 50];
// 할인한 값: 원래 값에서 할인만큼 빼고 소수점은 버린다 (가장 싸도 열매 1개)
export const salePrice = (price, sale) => Math.max(1, Math.floor((price * (100 - (sale || 0))) / 100));
// 곤충 이름 (선생님 화면의 판 기록에 쓴다. js/bugs.js의 이름과 같다)
export const BUG_NAMES = {
  cabbage_white: '배추흰나비', swallowtail: '호랑나비', honeybee: '꿀벌', ladybug: '칠성무당벌레', grasshopper: '메뚜기', red_dragonfly: '고추잠자리',
  mantis: '사마귀', cicada: '매미', stag_beetle: '사슴벌레', rhino_beetle: '장수풍뎅이', firefly: '반딧불이',
  yellow_butterfly: '노랑나비', comma_butterfly: '네발나비', hoverfly: '꽃등에', hawkmoth: '꼬리박각시', acrida: '방아깨비', cricket: '귀뚜라미',
  stinkbug: '홍줄노린재', tiger_beetle: '길앞잡이', chafer: '풍뎅이', longhorn: '알락하늘소', flower_chafer: '흰점박이꽃무지', skimmer: '밀잠자리',
  damselfly: '실잠자리', water_strider: '소금쟁이',
};
