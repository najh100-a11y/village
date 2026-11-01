// 진숲 어린이 마을 — 열매 주고받기 규칙 (선물, 팔기, 할인)
// 값은 서버(sql/2026-11-01-gift-sell-wardrobe.sql)와 같다. 서버가 늘 다시 확인한다.

// 잡은 물고기와 곤충을 팔 때 받는 열매 (흔함, 가끔, 드묾, 아주 드묾). 낡은 장화와 빈 깡통은 팔 수 없다.
export const SELL_PRICE = { fish: [1, 2, 3, 5], bug: [1, 2, 3] };
// 하루에 팔아서 받을 수 있는 열매 (선생님이 바꿀 수 있다. 0이면 팔기를 닫는다)
export const SELL_DAY_DEFAULT = 5;
export const SELL_DAY_CHOICES = [0, 3, 5, 10, 15, 20];
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
};
