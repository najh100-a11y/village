// 진숲 어린이 마을 — 모래사장 보물 (서버 kids_treasure_kinds와 같다)
// rarity: 0 흔함, 1 조금 드묾, 2 드묾, 3 아주 드묾, -1 쓰레기(주우면 모래사장이 깨끗해진다, 팔지 않는다)
export const TREASURES = [
  { id: 'shell', name: '조개껍데기', rarity: 0, desc: '부채처럼 줄무늬가 퍼진 조개껍데기예요.' },
  { id: 'conch', name: '소라 껍데기', rarity: 0, desc: '귀에 대면 파도 소리가 들리는 것 같아요.' },
  { id: 'seaglass', name: '바다 유리', rarity: 0, desc: '파도에 오래 굴러 동글동글해진 유리 조각이에요.' },
  { id: 'starfish', name: '불가사리', rarity: 1, desc: '팔이 다섯 개인 별 모양 바다 친구예요.' },
  { id: 'crab', name: '꽃게', rarity: 1, desc: '모래 속에 숨어 있던 꽃게가 집게를 번쩍 들었어요.' },
  { id: 'coin', name: '옛날 동전', rarity: 1, desc: '누가 언제 떨어뜨렸을까요? 오래된 동전이에요.' },
  { id: 'pearl', name: '진주', rarity: 2, desc: '조개 속에서 동그랗게 빛나는 진주예요.' },
  { id: 'bottle', name: '편지 든 병', rarity: 2, desc: '병 안에 돌돌 만 편지가 들어 있어요.' },
  { id: 'fossil', name: '암모나이트 화석', rarity: 2, desc: '아주 먼 옛날 바다에 살던 친구의 흔적이에요.' },
  { id: 'chest', name: '작은 보물 상자', rarity: 3, desc: '반짝반짝! 모래사장에서 가장 귀한 보물이에요.' },
  { id: 'can', name: '빈 깡통', rarity: -1, desc: '누가 버리고 간 깡통이에요. 주워서 모래사장이 깨끗해졌어요.' },
  { id: 'sandal', name: '낡은 샌들', rarity: -1, desc: '한 짝만 남은 샌들이에요. 주워서 모래사장이 깨끗해졌어요.' },
];
export const treasureById = (id) => TREASURES.find((t) => t.id === id) || null;
export const TREASURE_RARITY = { 0: '흔해요', 1: '조금 드물어요', 2: '드물어요', 3: '아주 드물어요!' };

// 편지 든 병을 열면 나오는 짧은 편지 (하나를 골라 보여 준다)
export const BOTTLE_NOTES = [
  '이 병을 찾은 친구에게: 오늘도 힘내! 너는 정말 소중해.',
  '바다 건너에서 보내요. 오늘 만난 친구에게 웃어 주세요.',
  '이 편지를 읽는 친구가 행복하면 좋겠어요.',
  '고마운 사람 한 명을 떠올려 보세요. 오늘 고맙다고 말해 볼까요?',
  '파도처럼 끝까지 힘차게! 오늘도 멋진 하루 보내요.',
];

// 그림 (64x64)
const S = {
  shell: '<path d="M32 54 L10 26 Q32 4 54 26 Z" fill="#F7C9A8" stroke="#D98A68" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<path d="M32 54 L18 18 M32 54 L25 12 M32 54 L32 10 M32 54 L39 12 M32 54 L46 18" stroke="#D98A68" stroke-width="2" fill="none"/>'
    + '<rect x="26" y="52" width="12" height="6" rx="2" fill="#E9A985" stroke="#D98A68" stroke-width="2"/>',
  conch: '<path d="M12 44 Q14 22 34 14 L52 10 Q50 30 40 42 Q28 54 16 52 Z" fill="#F4D9B8" stroke="#C99862" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<path d="M18 46 Q22 32 34 24 M24 50 Q30 38 42 30 M34 14 Q40 20 46 26" stroke="#C99862" stroke-width="2" fill="none"/>'
    + '<ellipse cx="22" cy="44" rx="6" ry="4" fill="#F7B7A3"/>',
  seaglass: '<path d="M14 30 Q12 18 24 16 Q34 14 36 24 Q38 34 26 38 Q16 40 14 30 Z" fill="#8FD9C2" stroke="#4FA88E" stroke-width="2.5"/>'
    + '<path d="M34 40 Q36 30 46 32 Q56 34 52 44 Q48 52 40 50 Q32 48 34 40 Z" fill="#9CC8F2" stroke="#5B8FC9" stroke-width="2.5"/>'
    + '<path d="M19 24 Q22 21 26 22" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M40 38 Q43 35 47 36" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  starfish: '<path d="M32 6 L38 24 L57 24 L42 35 L48 54 L32 42 L16 54 L22 35 L7 24 L26 24 Z" fill="#F59A55" stroke="#D96E2E" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<circle cx="32" cy="30" r="2.5" fill="#FFE1C4"/><circle cx="32" cy="18" r="1.8" fill="#FFE1C4"/><circle cx="44" cy="27" r="1.8" fill="#FFE1C4"/><circle cx="20" cy="27" r="1.8" fill="#FFE1C4"/><circle cx="39" cy="42" r="1.8" fill="#FFE1C4"/><circle cx="25" cy="42" r="1.8" fill="#FFE1C4"/>',
  crab: '<ellipse cx="32" cy="38" rx="16" ry="11" fill="#EF6461" stroke="#B9403D" stroke-width="2.5"/>'
    + '<path d="M16 34 Q8 30 8 22 M48 34 Q56 30 56 22" stroke="#B9403D" stroke-width="3" fill="none"/>'
    + '<path d="M4 20 Q8 12 14 18 Q10 20 8 24 Z M60 20 Q56 12 50 18 Q54 20 56 24 Z" fill="#EF6461" stroke="#B9403D" stroke-width="2"/>'
    + '<path d="M18 46 L10 52 M22 48 L16 56 M46 46 L54 52 M42 48 L48 56" stroke="#B9403D" stroke-width="2.5"/>'
    + '<line x1="27" y1="28" x2="26" y2="22" stroke="#B9403D" stroke-width="2"/><line x1="37" y1="28" x2="38" y2="22" stroke="#B9403D" stroke-width="2"/>'
    + '<circle cx="26" cy="21" r="3" fill="#fff" stroke="#3B2E25" stroke-width="1.5"/><circle cx="38" cy="21" r="3" fill="#fff" stroke="#3B2E25" stroke-width="1.5"/>'
    + '<circle cx="26" cy="21" r="1.3" fill="#3B2E25"/><circle cx="38" cy="21" r="1.3" fill="#3B2E25"/>',
  coin: '<circle cx="32" cy="32" r="22" fill="#F6C945" stroke="#C99A1E" stroke-width="3"/><circle cx="32" cy="32" r="15" fill="none" stroke="#C99A1E" stroke-width="2"/>'
    + '<rect x="27" y="27" width="10" height="10" fill="#F6C945" stroke="#C99A1E" stroke-width="2"/><path d="M18 24 Q22 18 28 16" stroke="#FFF1B8" stroke-width="3" fill="none" stroke-linecap="round"/>',
  pearl: '<path d="M8 40 Q32 64 56 40 Z" fill="#C9B6E4" stroke="#8F78B5" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<path d="M8 40 Q14 14 32 12 Q50 14 56 40" fill="#D9CBEE" stroke="#8F78B5" stroke-width="2.5"/>'
    + '<circle cx="32" cy="38" r="10" fill="#FFFDF7" stroke="#C9C1D6" stroke-width="2"/><circle cx="28" cy="34" r="3" fill="#fff"/>',
  bottle: '<rect x="27" y="6" width="10" height="8" rx="2" fill="#B07F4E" stroke="#7A5233" stroke-width="2"/>'
    + '<path d="M28 14 L28 20 Q16 26 16 38 L16 54 Q16 58 20 58 L44 58 Q48 58 48 54 L48 38 Q48 26 36 20 L36 14 Z" fill="#BDE8F2" fill-opacity=".85" stroke="#5FA8D3" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<rect x="22" y="34" width="20" height="16" rx="2" fill="#FFF6DC" stroke="#C99862" stroke-width="2" transform="rotate(-12 32 42)"/>'
    + '<path d="M26 40 L38 37 M26 44 L36 42" stroke="#C99862" stroke-width="1.8" transform="rotate(-12 32 42)"/>',
  fossil: '<circle cx="32" cy="32" r="22" fill="#E3CBA2" stroke="#A9835A" stroke-width="2.5"/>'
    + '<path d="M32 32 m-3 0 a3 3 0 1 1 6 0 a7 7 0 1 1 -14 0 a11 11 0 1 1 22 0 a15 15 0 1 1 -30 0 a19 19 0 1 1 38 0" fill="none" stroke="#A9835A" stroke-width="2.2"/>',
  chest: '<path d="M10 28 Q10 14 32 14 Q54 14 54 28 Z" fill="#B07F4E" stroke="#7A5233" stroke-width="2.5"/>'
    + '<rect x="10" y="28" width="44" height="24" rx="2" fill="#A06E45" stroke="#7A5233" stroke-width="2.5"/>'
    + '<rect x="28" y="14" width="8" height="38" fill="#F6C945" stroke="#C99A1E" stroke-width="2"/><rect x="27" y="28" width="10" height="9" rx="2" fill="#F6C945" stroke="#C99A1E" stroke-width="2"/>'
    + '<path d="M16 10 L18 4 L20 10 M44 8 L46 2 L48 8" stroke="#F6C945" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  can: '<rect x="20" y="12" width="24" height="40" rx="4" fill="#C9D3DD" stroke="#8A8F98" stroke-width="2.5"/>'
    + '<ellipse cx="32" cy="13" rx="12" ry="4" fill="#E5EBF0" stroke="#8A8F98" stroke-width="2"/><rect x="20" y="24" width="24" height="14" fill="#EF6461"/>',
  sandal: '<path d="M22 8 Q36 6 40 20 L44 46 Q44 58 32 58 Q20 58 20 46 L18 20 Q18 10 22 8 Z" fill="#7EC8F2" stroke="#3E89B8" stroke-width="2.5"/>'
    + '<path d="M22 30 Q30 18 31 14 Q32 18 40 30" stroke="#F6D55C" stroke-width="4" fill="none" stroke-linecap="round"/>',
};
export function treasureIcon(id, size = 40) {
  const body = S[id] || '<circle cx="32" cy="32" r="20" fill="#E8DCC4"/>';
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
// 아직 못 찾은 보물: 같은 모양을 회색 그림자로
export function treasureShadow(id, size = 40) {
  const body = (S[id] || '').replace(/fill="[^"]*"/g, 'fill="#CFC6B4"').replace(/stroke="[^"]*"/g, 'stroke="#B8AE9A"');
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
