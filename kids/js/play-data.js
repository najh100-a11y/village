// 진숲 어린이 마을 — 놀이 마당 자료 (물고기, 요리, 활동 표시)

// 서버 kids_fish_kinds 표와 같은 순서·같은 값 (체험판도 이 표로 뽑는다)
// rarity: -1 물건, 0 흔함, 1 가끔, 2 드묾, 3 아주 드묾
export const FISH = [
  { id: 'medaka', shadow: 'tiny', name: '송사리', weight: 22, min: 2, max: 4, rarity: 0, body: '#B9C7C9', fin: '#8FA3A6' },
  { id: 'minnow', shadow: 'small', name: '피라미', weight: 20, min: 8, max: 15, rarity: 0, body: '#C9D6E0', fin: '#E98D8D' },
  { id: 'crucian', shadow: 'small', name: '붕어', weight: 18, min: 10, max: 30, rarity: 0, body: '#B59A5E', fin: '#8C7440' },
  { id: 'loach', shadow: 'small', name: '미꾸라지', weight: 14, min: 10, max: 20, rarity: 0, body: '#9C8661', fin: '#7A6646', long: true },
  { id: 'smelt', shadow: 'small', name: '빙어', weight: 10, min: 8, max: 15, rarity: 1, body: '#DDEBF2', fin: '#A9C6D6' },
  { id: 'carp', shadow: 'large', name: '잉어', weight: 8, min: 30, max: 70, rarity: 1, body: '#8E7A55', fin: '#C27A46' },
  { id: 'catfish', shadow: 'large', name: '메기', weight: 6, min: 30, max: 60, rarity: 1, body: '#5F5A52', fin: '#46423C', whisker: true },
  { id: 'trout', shadow: 'medium', name: '무지개송어', weight: 5, min: 25, max: 50, rarity: 2, body: '#9FB7A8', fin: '#E6837A', stripe: '#F2A0A8' },
  { id: 'mandarin', shadow: 'medium', name: '쏘가리', weight: 3, min: 20, max: 45, rarity: 2, body: '#C9B26A', fin: '#8B7A3E', spots: '#6B5A2E' },
  { id: 'goldfish', shadow: 'small', name: '금붕어', weight: 3, min: 5, max: 15, rarity: 2, body: '#F28A3C', fin: '#F6B26B' },
  { id: 'golden', shadow: 'large', name: '황금잉어', weight: 1, min: 40, max: 70, rarity: 3, body: '#F4C542', fin: '#E39B2D' },
  { id: 'boot', shadow: 'medium', name: '낡은 장화', weight: 6, min: 0, max: 0, rarity: -1 },
  { id: 'can', shadow: 'medium', name: '빈 깡통', weight: 5, min: 0, max: 0, rarity: -1 },
];
export const fishById = (id) => FISH.find((f) => f.id === id);
// 물속 그림자 길이 (마을 단위)
export const SHADOW_LEN = { tiny: 0.2, small: 0.32, medium: 0.48, large: 0.68 };
export const RARITY = { '-1': '물건', 0: '흔해요', 1: '가끔 나와요', 2: '드물어요', 3: '아주 드물어요' };

// 요리: 성경 이야기는 개역한글판 본문을 확인해 쉬운 말로 풀었다. 요리법은 놀이로 꾸민 것이다.
export const RECIPES = [
  {
    id: 'manna', name: '만나 과자', color: '#F3E7C2',
    ref: '출애굽기 16장 14-31절, 민수기 11장 8절',
    story: '광야에서 하나님이 이스라엘 백성에게 아침마다 먹을 것을 내려 주셨어요. 사람들은 그것을 ‘만나’라고 불렀어요. 깟씨(고수 씨)처럼 작고 하얬고, 맛은 꿀을 섞은 과자 같았대요. 사람들은 아침마다 만나를 거두어 맷돌에 갈거나 절구에 찧어 과자를 만들었어요.',
    steps: [
      { type: 'collect', title: '아침에 만나 거두기', hint: '해가 뜨거워지기 전에 하얀 만나를 콕콕 눌러 모아요.', item: 'manna', need: 8, time: 12 },
      { type: 'tap', title: '맷돌에 갈기', hint: '맷돌을 빠르게 눌러 만나를 곱게 갈아요.', item: 'mill', need: 14, time: 7 },
      { type: 'heat', title: '노릇하게 굽기', hint: '바늘이 초록색에 왔을 때 멈춰요.', item: 'pan' },
    ],
  },
  {
    id: 'lentil', name: '붉은 콩죽', color: '#C8553D',
    ref: '창세기 25장 29-34절',
    story: '야곱이 죽을 끓이고 있을 때, 에서가 들에서 몹시 지쳐 돌아왔어요. 에서는 “그 붉은 것을 먹게 해 줘.” 하고 말했지요. 야곱은 에서에게 빵과 죽을 주었어요. 개역한글판에는 ‘팥죽’이라고 옮겨져 있지만, 히브리어 낱말은 렌틸콩(납작한 콩)을 가리켜요.',
    steps: [
      { type: 'pick', title: '재료 고르기', hint: '죽에 넣을 것만 골라요.', want: ['lentil', 'water'], decoy: ['apple', 'fish', 'honey'] },
      { type: 'stir', title: '보글보글 저어 끓이기', hint: '냄비 안에서 손가락으로 빙글빙글 저어요.', item: 'pot', need: 4 },
      { type: 'pick', title: '함께 낼 것 고르기', hint: '야곱이 죽과 함께 준 것을 골라요.', want: ['bread'], decoy: ['grape', 'egg'] },
    ],
  },
  {
    id: 'fishbread', name: '숯불 생선과 빵', color: '#9FC9E6',
    ref: '요한복음 21장 1-13절',
    story: '부활하신 예수님이 디베랴 바닷가에서 제자들에게 나타나셨어요. 제자들이 배에서 내려 보니 숯불이 있고, 그 위에 생선이 놓여 있고, 빵도 있었어요. 예수님은 “와서 아침을 먹어라.” 하시고 빵과 생선을 나누어 주셨어요.',
    steps: [
      { type: 'tap', title: '숯불 피우기', hint: '부채질하듯 빠르게 눌러 숯불을 살려요.', item: 'fire', need: 12, time: 7 },
      { type: 'heat', title: '생선 굽기', hint: '바늘이 초록색에 왔을 때 멈춰요.', item: 'grill' },
      { type: 'pick', title: '아침상 차리기', hint: '이야기에 나온 것만 골라 상에 올려요.', want: ['fish', 'bread'], decoy: ['apple', 'egg', 'honey'] },
    ],
  },
  {
    id: 'barley', name: '보리빵 도시락', color: '#D9B36C',
    ref: '요한복음 6장 1-13절',
    story: '많은 사람이 예수님을 따라왔어요. 한 아이가 보리빵 다섯 개와 물고기 두 마리를 가지고 있었어요. 예수님이 감사 기도를 하시고 나누어 주시자, 오천 명쯤 되는 사람들이 배부르게 먹고도 남은 조각이 열두 바구니에 가득 찼어요.',
    steps: [
      { type: 'count', title: '도시락 싸기', hint: '보리빵 다섯 개와 물고기 두 마리를 바구니에 담아요.', want: { bread: 5, fish: 2 } },
      { type: 'tap', title: '나누어 주기', hint: '빵을 콕콕 눌러 사람들에게 나누어 줘요.', item: 'share', need: 15, time: 8 },
      { type: 'collect', title: '남은 조각 모으기', hint: '남은 조각을 모아 열두 바구니를 채워요.', item: 'crumb', need: 12, time: 14 },
    ],
  },
  {
    id: 'matzah', name: '누룩 없는 빵', color: '#E9D3A0',
    ref: '출애굽기 12장 39절',
    story: '이스라엘 백성은 이집트에서 아주 급하게 떠나야 했어요. 반죽이 부풀 때까지 기다릴 시간이 없어서, 누룩을 넣지 않은 반죽으로 납작한 빵을 구웠어요. 이 빵을 ‘무교병’이라고 해요.',
    steps: [
      { type: 'pick', title: '재료 고르기', hint: '서둘러야 해요! 누룩은 넣지 않아요.', want: ['flour', 'water'], decoy: ['yeast', 'honey', 'apple'] },
      { type: 'tap', title: '얼른 반죽하기', hint: '빠르게 눌러 반죽을 치대요.', item: 'dough', need: 15, time: 7 },
      { type: 'heat', title: '납작하게 굽기', hint: '바늘이 초록색에 왔을 때 멈춰요.', item: 'pan' },
    ],
  },
];
export const recipeById = (id) => RECIPES.find((r) => r.id === id);

export const INGREDIENTS = {
  lentil: ['렌틸콩', '#C8553D'], water: ['물', '#7EC8F2'], apple: ['사과', '#EF6461'], fish: ['생선', '#9FC9E6'],
  honey: ['꿀', '#F4C542'], bread: ['빵', '#D9A35C'], grape: ['포도', '#8E6BC9'], egg: ['달걀', '#FFF3DA'],
  flour: ['밀가루', '#F6F0E2'], yeast: ['누룩', '#C9B99A'],
  potato: ['감자', '#D9B66A'], carrot: ['당근', '#F28B30'], onion: ['양파', '#EBD9C0'], tomato: ['토마토', '#E8413C'],
  mushroom: ['버섯', '#C9A27A'], cabbage: ['양배추', '#A8D58A'], paprika: ['파프리카', '#F6C330'], rice: ['쌀', '#F7F3E8'],
  manna: ['만나', '#FFF8E6'],
};

// 마음대로 요리: 냉장고 재료 (서버 kids_dish_save가 받는 목록과 같다). 낚은 물고기는 'fish_물고기id'로 쓴다.
export const FRIDGE = ['potato', 'carrot', 'onion', 'tomato', 'mushroom', 'cabbage', 'paprika', 'egg', 'rice', 'bread', 'manna', 'lentil', 'flour', 'apple', 'grape', 'honey'];
// 썰었을 때 속 색 (없으면 겉 색)
export const PIECE_COLOR = {
  potato: '#F2DFA0', carrot: '#F28B30', onion: '#F3EBDD', tomato: '#E8413C', mushroom: '#E6D2B5', cabbage: '#C7E6A6',
  paprika: '#F6C330', egg: '#FFE07A', bread: '#E9C88F', apple: '#F5E6B8', grape: '#8E6BC9',
};
// 썰지 않고 그대로 넣는 재료 (가루, 곡식, 꿀)
export const NO_CUT = ['rice', 'manna', 'lentil', 'flour', 'honey'];
export const COOK_KIND = { soup: ['국', '냄비에 끓이기', '🍲'], fry: ['볶음', '프라이팬에 볶기', '🍳'], grill: ['구이', '화로에 굽기', '🔥'], salad: ['샐러드', '그대로 접시에', '🥗'] };
export function ingInfo(id) {
  if (id && id.startsWith('fish_')) {
    const f = FISH.find((x) => x.id === id.slice(5));
    return f ? { name: f.name, color: f.body, piece: '#F3D2C2', fish: f } : null;
  }
  const v = INGREDIENTS[id];
  return v ? { name: v[0], color: v[1], piece: PIECE_COLOR[id] || v[1] } : null;
}
export function dishName(items, kind) {
  const names = items.map((id) => (ingInfo(id) || {}).name).filter(Boolean);
  const uniq = [...new Set(names)];
  const head = uniq.slice(0, 2).join(' ');
  return `${head}${uniq.length > 2 ? ' 듬뿍' : ''} ${COOK_KIND[kind][0]}`.trim();
}

export const ACT_ICON = { fish: '🎣', omok: '⚫', cook: '🍳', art: '🎨', memory: '📖', qt: '🌿', copy: '✏️', watch: '👀', ferris: '🎡', viking: '⛵', carousel: '🎠', bumper: '🚗', bench: '🪑', eat: '🍎' };
export const ACT_TEXT = {
  fish: '낚시하는 중', omok: '오목 두는 중', cook: '요리하는 중', art: '그림 그리는 중', memory: '암송하는 중', qt: '묵상하는 중', copy: '필사하는 중', watch: '오목 구경하는 중',
  ferris: '대관람차 타는 중', viking: '바이킹 타는 중', carousel: '회전목마 타는 중', bumper: '범퍼카 타는 중', bench: '벤치에서 쉬는 중', eat: '열매 먹는 중',
};
