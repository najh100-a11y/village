// 진숲 어린이 마을 — 줄넘기 줄 (열매 상점에서 사서, 줄넘기를 할 때 골라 쓴다)
// basic은 누구나 처음부터 가진 줄이다. 나머지는 상점 물건(jr_)으로 서버 kids__item_price, kids_jr_rope와 같은 목록이다.
// 차례(ROPE_IDS의 자리)는 친구 화면에 내가 어떤 줄로 뛰는지 알리는 번호라서 바꾸지 않고 뒤에만 더한다.
// rope: 줄 색, handle: 손잡이 색, pat: 무늬(stripe 줄무늬, beads 구슬, rainbow 무지개)와 cols(무늬 색들),
// glow: 빛을 받지 않고 늘 환한 줄(밤에도 밝다), star: 손잡이 끝에 별, thick: 줄 굵기 배수
export const ROPES = {
  basic: { name: '기본 줄넘기', desc: '분홍 줄에 노란 손잡이, 처음부터 가진 줄넘기예요.', price: 0, rope: '#FF6FA8', handle: '#FFD54A' },
  jr_sky: { name: '하늘 줄넘기', desc: '맑은 하늘색 줄에 하얀 손잡이예요.', price: 3, rope: '#5BB8F5', handle: '#FFFDF7' },
  jr_lime: { name: '연두 줄넘기', desc: '새싹 같은 연두색 줄에 주황 손잡이예요.', price: 3, rope: '#8FD14F', handle: '#F49A4C' },
  jr_grape: { name: '포도 줄넘기', desc: '포도처럼 진한 보라색 줄에 민트 손잡이예요.', price: 3, rope: '#9B6FE0', handle: '#7FD8BE' },
  jr_candy: { name: '사탕 줄넘기', desc: '빨강과 하양이 번갈아 감긴 막대사탕 같은 줄이에요.', price: 5, rope: '#EF4A3E', pat: 'stripe', cols: ['#EF4A3E', '#FFFFFF'], handle: '#EF4A3E' },
  jr_beads: { name: '구슬 줄넘기', desc: '알록달록 구슬을 꿰어 만든 조금 굵은 줄이에요.', price: 5, rope: '#F6D55C', pat: 'beads', cols: ['#EF6461', '#F6D55C', '#5BB8F5', '#7CC46A', '#F6A2C4'], handle: '#FFFDF7', thick: 1.4 },
  jr_rainbow: { name: '무지개 줄넘기', desc: '빨주노초파남보 일곱 빛깔이 차례로 이어진 줄이에요.', price: 6, rope: '#7CC46A', pat: 'rainbow', handle: '#FFFDF7' },
  jr_glow: { name: '야광 줄넘기', desc: '어두워도 환하게 빛나는 형광 줄이에요. 밤에 뛰면 더 멋져요.', price: 7, rope: '#B6FF3B', glow: true, handle: '#3B3B45' },
  jr_star: { name: '별빛 줄넘기', desc: '반짝이는 금빛 줄에, 손잡이 끝마다 별이 달렸어요.', price: 8, rope: '#FFC93C', handle: '#3E4A8A', star: true },
};
export const ROPE_IDS = Object.keys(ROPES);
export const SHOP_ROPES = ROPE_IDS.filter((id) => id !== 'basic');
export const isRope = (id) => Object.prototype.hasOwnProperty.call(ROPES, id);
export const ropeOf = (id) => (isRope(id) ? ROPES[id] : ROPES.basic);

// 무지개 일곱 빛깔
const RAINBOW = ['#EF4A3E', '#F49A4C', '#F6D55C', '#7CC46A', '#5BB8F5', '#3E64C8', '#9B6FE0'];
// 줄 위 자리 u(0~1, 한쪽 손잡이에서 다른 쪽까지)의 색
export function ropeColorAt(R, u) {
  if (R.pat === 'stripe') return R.cols[Math.floor(u * 22) % R.cols.length];
  if (R.pat === 'beads') return R.cols[Math.floor(u * 30) % R.cols.length];
  if (R.pat === 'rainbow') return RAINBOW[Math.min(RAINBOW.length - 1, Math.floor(u * RAINBOW.length))];
  return R.rope;
}

// 상점과 줄 고르기 창의 작은 그림 (SVG)
export function ropeSvg(id) {
  const R = ropeOf(id);
  const path = 'M15 24 C 14 68, 50 68, 49 24'; // 손잡이 둘을 위로 들고, 줄이 아래로 늘어진 모양
  const uid = `rp_${id}`;
  let defs = '', stroke = '';
  if (R.pat === 'rainbow') {
    defs = `<linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="0">${RAINBOW.map((c, i) => `<stop offset="${(i / (RAINBOW.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    stroke = `<path d="${path}" fill="none" stroke="url(#${uid})" stroke-width="4" stroke-linecap="round"/>`;
  } else if (R.pat === 'stripe') {
    stroke = `<path d="${path}" fill="none" stroke="${R.cols[0]}" stroke-width="4" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${R.cols[1]}" stroke-width="4" stroke-dasharray="4 4"/>`;
  } else if (R.pat === 'beads') {
    const n = R.cols.length;
    stroke = R.cols.map((c, i) => `<path d="${path}" fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="3.2 ${(3.2 * (n - 1)).toFixed(1)}" stroke-dashoffset="${(-3.2 * i).toFixed(1)}"/>`).join('');
  } else {
    if (R.glow) defs = `<filter id="${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>`;
    stroke = (R.glow ? `<path d="${path}" fill="none" stroke="${R.rope}" stroke-width="8" opacity=".7" filter="url(#${uid})"/>` : '')
      + `<path d="${path}" fill="none" stroke="${R.rope}" stroke-width="${R.glow ? 3.4 : 4}" stroke-linecap="round"/>`;
  }
  const handle = (x) => `<rect x="${x - 4}" y="7" width="8" height="18" rx="4" fill="${R.handle}" stroke="#8B6A4F" stroke-opacity=".35" stroke-width="1"/>`;
  const star = (x) => `<path transform="translate(${x} 7) scale(.5)" d="M0 -10 L2.9 -3.6 9.5 -3.1 4.5 1.4 6 8.1 0 4.6 -6 8.1 -4.5 1.4 -9.5 -3.1 -2.9 -3.6Z" fill="#FFD54A" stroke="#C99A1E" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${stroke}${handle(15)}${handle(49)}${R.star ? star(15) + star(49) : ''}</svg>`;
}
