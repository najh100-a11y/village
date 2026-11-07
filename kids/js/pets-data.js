// 진숲 어린이 마을 — 열매 상점 애완동물 목록 (그림 없이 쓰는 부분: 상점, 체험판 서버, 선생님 화면이 함께 쓴다)
// 품종 설명은 백과사전과 품종 표준에서 확인한 내용만 짧게 쓴다 (README '애완동물 품종' 참고).
// look: 3D 모양 (js/critters.js). 값은 모두 열매 30개이고, 서버(sql/2026-11-07-pet-breeds.sql)와 같다.
//   size 크기, leg 다리 길이, len 몸 길이, wide 몸 굵기, head 머리 색, legC 다리 색, muzzle 주둥이 색,
//   chest 가슴 무늬, saddle 등 무늬, ears 귀 모양, earS 귀 크기, tail 꼬리 모양, fluff 털 모양, bow 머리 리본,
//   snout 주둥이 길이, eye 눈동자 색, stripes 줄무늬 색, points 귀·얼굴·발·꼬리 끝 색(포인트), mitts 하얀 발

export const PET_ITEMS = {
  // ---------- 처음부터 있던 동물 ----------
  pet_dog: { kind: 'dog', name: '강아지', desc: '꼬리를 흔들며 졸졸 따라와요.', coat: '#C98B4E', ear: '#8A5A33', collar: '#5FA9E0', price: 30 },
  pet_cat: { kind: 'cat', name: '고양이', desc: '살금살금 곁을 지켜 줘요.', coat: '#F2E2C4', ear: '#D9B98A', collar: '#EF6461', price: 30 },
  pet_rabbit: { kind: 'rabbit', name: '토끼', desc: '깡충깡충 뛰어서 따라와요.', coat: '#FFFFFF', ear: '#F6B8C8', price: 30 },
  pet_chick: { kind: 'chick', name: '병아리', desc: '삐약삐약 종종걸음으로 따라와요.', coat: '#FFD84D', price: 30 },
  pet_parrot: { kind: 'parrot', name: '앵무새', desc: '머리 위를 훨훨 날아 따라오고, 내가 한 말을 따라 해요.', coat: '#3DBB5C', ear: '#F6D55C', wing: '#3E8FE0', tail: '#E5484D', price: 30 },

  // ---------- 강아지 품종 ----------
  pet_maltese: { kind: 'dog', breed: true, name: '말티즈', price: 30, coat: '#FFFFFF', ear: '#FFFFFF', collar: '#F6A2C4',
    desc: '온몸이 새하얀 작은 강아지예요. 비단처럼 윤기 나는 긴 털이 곱슬거리지 않고 몸을 따라 쭉 늘어져요.',
    look: { size: 0.82, snout: 0.75, ears: 'fluff', fluff: 'skirt', bow: '#F2709A', muzzle: '#FFFFFF' } },
  pet_yorkie: { kind: 'dog', breed: true, name: '요크셔테리어', price: 30, coat: '#C98A45', ear: '#C98A45', collar: '#EF6461',
    desc: '19세기 영국 요크셔 지방에서 생긴 작은 강아지예요. 몸통은 푸른빛 도는 짙은 회색이고, 머리와 가슴과 다리는 밝은 황갈색이에요. 작은 귀가 쫑긋 서 있어요.',
    look: { size: 0.78, snout: 0.8, ears: 'up', earS: 0.8, fluff: 'skirt', skirt: '#5B6675', saddle: '#5B6675', bow: '#E5484D', muzzle: '#C98A45' } },
  pet_poodle: { kind: 'dog', breed: true, name: '푸들', price: 30, coat: '#E2A66C', ear: '#E2A66C', collar: '#4D7DDB',
    desc: '곱슬곱슬한 털이 빽빽한 강아지예요. 원래 물새 사냥을 돕던 개이고, 아주 똑똑한 개로 손꼽혀요. 이 친구는 살구색 털이에요.',
    look: { size: 0.86, snout: 0.85, ears: 'curly', fluff: 'curly', tail: 'pom', muzzle: '#E9B47E' } },
  pet_pom: { kind: 'dog', breed: true, name: '포메라니안', price: 30, coat: '#F0A33E', ear: '#F0A33E', collar: '#7EC8F2',
    desc: '작고 털이 아주 풍성한 강아지예요. 포메라니아 지방의 이름을 땄고, 털이 수북한 꼬리를 등 위에 높이 얹고 다녀요.',
    look: { size: 0.72, snout: 0.5, ears: 'up', earS: 0.6, fluff: 'mane', wide: 1.18, tail: 'plume', muzzle: '#F5B65C' } },
  pet_bichon: { kind: 'dog', breed: true, name: '비숑 프리제', price: 30, coat: '#FFFFFF', ear: '#FFFFFF', collar: '#F6D55C',
    desc: '털이 늘 새하얗고 나선처럼 느슨하게 말려 있어서 솜뭉치 같아요. 이름은 프랑스 말로 \'곱슬 털 작은 개\'라는 뜻이에요.',
    look: { size: 0.82, snout: 0.6, ears: 'hidden', fluff: 'curly', round: true, tail: 'plume', muzzle: '#FFFFFF' } },
  pet_corgi: { kind: 'dog', breed: true, name: '웰시코기', price: 30, coat: '#D98B45', ear: '#D98B45', collar: '#4FA36C',
    desc: '영국 웨일스에서 소를 몰던 개예요. 다리가 짧아 몸이 땅에 가깝고, 뾰족한 귀가 서 있어요. 이 친구는 다리와 가슴과 목에 흰 무늬가 있어요.',
    look: { leg: 0.6, len: 1.2, ears: 'up', earS: 1.5, tail: 'stub', chest: '#FFF8EC', legC: '#FFF8EC', muzzle: '#FFF8EC', blaze: '#FFF8EC' } },
  pet_jindo: { kind: 'dog', breed: true, name: '진돗개', price: 30, coat: '#F6F0E4', ear: '#F6F0E4', collar: '#EF6461',
    desc: '우리나라 진도에서 온 개예요. 1962년에 천연기념물이 되었고, 충성스럽기로 이름나 있어요. 세모난 귀가 쫑긋 서고 꼬리를 등 위로 말아 올려요. 이 친구는 흰 털(백구)이에요.',
    look: { size: 1.08, ears: 'up', earS: 1.15, tail: 'curl', snout: 1.1, muzzle: '#F6F0E4' } },
  pet_golden: { kind: 'dog', breed: true, name: '골든 리트리버', price: 30, coat: '#E1A852', ear: '#D4973F', collar: '#EF6461',
    desc: '19세기 스코틀랜드에서 생긴 큰 편인 개예요. 금빛 털이 길고, 시각 장애인을 돕는 안내견으로도 일해요.',
    look: { size: 1.24, ears: 'long', tail: 'feather', snout: 1.25, muzzle: '#E9B865' } },
  pet_dachs: { kind: 'dog', breed: true, name: '닥스훈트', price: 30, coat: '#B5582A', ear: '#9C4A22', collar: '#F6D55C',
    desc: '독일 말로 \'오소리 개\'라는 뜻이에요. 독일에서 오소리를 사냥하던 개라서 다리가 짧고 몸이 길어요.',
    look: { leg: 0.5, len: 1.45, ears: 'long', tail: 'long', snout: 1.35, muzzle: '#B5582A' } },
  pet_beagle: { kind: 'dog', breed: true, name: '비글', price: 30, coat: '#FFFFFF', ear: '#A8662E', collar: '#4D7DDB',
    desc: '토끼 사냥을 하던 영국의 사냥개예요. 냄새를 아주 잘 맡아요. 길고 부드러운 귀가 늘어지고, 꼬리 끝이 하얘요.',
    look: { ears: 'long', tail: 'long', snout: 1.2, head: '#C98140', saddle: '#2E2826', tailC: '#2E2826', tip: '#FFFFFF', muzzle: '#FFFFFF', blaze: '#FFFFFF', legC: '#FFFFFF' } },

  // ---------- 고양이 (품종과 털 무늬) ----------
  pet_cheese: { kind: 'cat', breed: true, name: '치즈 태비', price: 30, coat: '#F2A65A', ear: '#E8954A', collar: '#4D7DDB',
    desc: '주황빛 털에 진한 줄무늬(태비 무늬)가 있는 고양이예요. 우리나라에서는 \'치즈 고양이\'라고 불러요. 품종 이름이 아니라 털 색과 무늬를 부르는 별명이에요.',
    look: { stripes: '#D47A2C', eye: '#D9A13B', muzzle: '#FFF1DC' } },
  pet_mackerel: { kind: 'cat', breed: true, name: '고등어 태비', price: 30, coat: '#A29D94', ear: '#8F8A82', collar: '#EF6461',
    desc: '회색 털에 가는 검은 줄무늬가 있는 고양이예요. 이런 줄무늬를 영어로 \'매커럴(고등어) 태비\'라고 해요. 이마에는 M자 무늬가 있어요.',
    look: { stripes: '#45413D', eye: '#B6BF46', muzzle: '#E9E4DA', mark: true } },
  pet_tuxedo: { kind: 'cat', breed: true, name: '턱시도 고양이', price: 30, coat: '#2F2C2C', ear: '#2F2C2C', collar: '#EF6461',
    desc: '검은 털에 가슴과 배, 발이 하얀 고양이예요. 턱시도를 입은 것 같다고 이렇게 불러요. 여러 품종에서 볼 수 있는 털 무늬예요.',
    look: { chest: '#FFFFFF', mitts: '#FFFFFF', muzzle: '#FFFFFF', eye: '#E2C044' } },
  pet_russian: { kind: 'cat', breed: true, name: '러시안 블루', price: 30, coat: '#8D9AAB', ear: '#7F8C9D', collar: '#F6D55C',
    desc: '푸른빛 도는 회색 털이 은빛으로 반짝이고, 눈이 초록색이에요. 러시아의 항구 도시 아르한겔스크에서 왔다고 전해져요.',
    look: { eye: '#3FAE58', muzzle: '#9DA9B9', wide: 0.95, earS: 1.08 } },
  pet_persian: { kind: 'cat', breed: true, name: '페르시안', price: 30, coat: '#FBF7F0', ear: '#F0E6DA', collar: '#A07FE3',
    desc: '털이 아주 길고 풍성하며 얼굴이 동그랗고 코가 짧아요. 옛 페르시아(지금의 이란) 쪽에서 온 고양이로 알려져 있어요.',
    look: { fluff: 'puff', leg: 0.82, snout: 0.45, earS: 0.65, eye: '#D9822B', tail: 'fluffy', muzzle: '#FBF7F0', wide: 1.2 } },
  pet_siamese: { kind: 'cat', breed: true, name: '샴', price: 30, coat: '#EFE3CC', ear: '#4B3428', collar: '#EF6461',
    desc: '태국(옛 이름 시암)에서 온 고양이예요. 얼굴과 귀, 발, 꼬리처럼 몸에서 서늘한 곳의 털이 진하고, 눈이 파래요. 몸이 날씬해요.',
    look: { points: '#4B3428', eye: '#4C9BE8', earS: 1.25, wide: 0.92, muzzle: '#4B3428' } },
  pet_ragdoll: { kind: 'cat', breed: true, name: '랙돌', price: 30, coat: '#F2E9D9', ear: '#5E4636', collar: '#7EC8F2',
    desc: '덩치가 큰 편인 고양이예요. 안아 올리면 몸에 힘을 빼고 축 늘어진다고 \'헝겊 인형\'이라는 이름이 붙었어요. 눈이 파랗고, 이 친구는 발과 배가 하얀 무늬예요.',
    look: { size: 1.12, leg: 0.9, fluff: 'puff', points: '#5E4636', mitts: '#FFFFFF', chest: '#FFFFFF', eye: '#4C9BE8', tail: 'fluffy', muzzle: '#5E4636' } },

  // ---------- 앵무새 품종 ----------
  pet_budgie: { kind: 'parrot', breed: true, name: '사랑앵무 (초록)', price: 30, coat: '#86D04E', ear: '#F3E24A', wing: '#E2E36A', tail: '#2C52B0',
    desc: '호주의 메마른 땅에 사는 작은 앵무새예요. 야생에서는 몸이 연두색, 얼굴이 노란색이고 날개에 검은 물결무늬가 있어요. 사람 말을 흉내 낼 수 있어요.',
    look: { size: 0.8, bars: '#2B2827', cheek: '#6A5BD8', beak: '#E9C994', tailLen: 1.15 } },
  pet_budblue: { kind: 'parrot', breed: true, name: '사랑앵무 (파랑)', price: 30, coat: '#7EC4F0', ear: '#FFFFFF', wing: '#EEF3F6', tail: '#2C52B0',
    desc: '사람이 기르면서 생긴 파란 사랑앵무예요. 노란 색소가 없어서 몸은 하늘색, 얼굴은 하얀색이 되었어요.',
    look: { size: 0.8, bars: '#2B2827', cheek: '#6A5BD8', beak: '#E9C994', tailLen: 1.15 } },
  pet_lovebird: { kind: 'parrot', breed: true, name: '모란앵무', price: 30, coat: '#5DBE48', ear: '#F59A86', wing: '#5DBE48', tail: '#4CA83E',
    desc: '아프리카에 사는 작은 앵무새예요. 짝과 늘 붙어 지내서 영어로 \'러브버드\'라고 불러요. 꼬리가 짧고 뭉툭해요. 이 친구는 얼굴이 분홍빛인 종류예요.',
    look: { size: 0.8, rump: '#3E7FD6', beak: '#EBDDA8', tailLen: 0.45, chubby: true, belly: '#8ED46A' } },
  pet_tiel: { kind: 'parrot', breed: true, name: '왕관앵무', price: 30, coat: '#9C9C99', ear: '#F4D648', wing: '#9C9C99', tail: '#8B8B88',
    desc: '호주에 사는 앵무새예요. 머리 위 볏이 기분에 따라 움직이고, 볼에 동그란 주황색 무늬가 있어요. 사람 말을 흉내 내기도 해요.',
    look: { crest: '#F4D648', crestTip: '#9C9C99', crestType: 'tiel', cheek: '#F08A3C', patch: '#F7F6F0', beak: '#8D8A86', tailLen: 1.3, belly: '#A9A9A6' } },
  pet_macaw: { kind: 'parrot', breed: true, name: '홍금강앵무', price: 30, coat: '#D62B2B', ear: '#D62B2B', wing: '#F4C431', tail: '#D62B2B',
    desc: '중남미 숲에 사는 큰 앵무새예요. 몸은 진한 빨강이고 날개에 노랑과 파랑 깃털이 있어요. 몸길이의 반이 넘을 만큼 꼬리가 길어요.',
    look: { size: 1.4, wingTip: '#2F5DC8', tail2: '#2F5DC8', rump: '#7FC4F0', bare: '#F7F1EC', bareS: 1.45, beak: '#EFE6D2', jaw: '#2B2523', tailLen: 1.9, belly: '#D62B2B' } },
  pet_grey: { kind: 'parrot', breed: true, name: '회색앵무', price: 30, coat: '#8F9196', ear: '#8F9196', wing: '#7A7C81', tail: '#D8322F',
    desc: '아프리카 적도 부근에 사는 앵무새예요. 몸은 회색, 꼬리는 빨간색, 부리는 검은색이에요. 소리와 사람 말을 아주 잘 흉내 내요.',
    look: { size: 1.12, bare: '#ECEDEE', beak: '#2B2523', tailLen: 0.7, belly: '#9EA0A5', tail2: '#D8322F' } },
  pet_conure: { kind: 'parrot', breed: true, name: '썬코뉴어', price: 30, coat: '#F7C21C', ear: '#F58A1F', wing: '#F7C21C', tail: '#3FA34D',
    desc: '남아메리카 북동쪽에 사는 앵무새예요. 금빛 노란 몸에 얼굴과 배가 주황빛이고, 날개와 꼬리 끝은 초록과 파랑이에요. 몸집에 비해 목소리가 아주 커요. 야생에서는 멸종 위기종이에요.',
    look: { size: 0.95, wingTip: '#2F68C8', wingMid: '#3FA34D', tail2: '#2F68C8', belly: '#F7A53A', beak: '#2B2523', ring: '#F7F4EE', tailLen: 1.05 } },
  pet_cockatoo: { kind: 'parrot', breed: true, name: '큰유황앵무', price: 30, coat: '#FAFAF6', ear: '#FAFAF6', wing: '#F4F4EE', tail: '#F4F4EE',
    desc: '호주와 뉴기니 등지에 사는 큰 편인 흰 앵무새예요. 머리 위 노란 볏을 활짝 펼치고, 부리는 검은색이에요.',
    look: { size: 1.28, crest: '#F6D33A', crestType: 'fan', beak: '#2B2523', ring: '#EEF4F8', tailLen: 0.8, belly: '#FAFAF6' } },
};
export const PET_IDS = Object.keys(PET_ITEMS);
// 상점 동물 칸의 작은 칸 (토끼와 병아리는 함께)
export const PET_GROUPS = [['dog', '🐶 강아지'], ['cat', '🐱 고양이'], ['parrot', '🦜 앵무새'], ['small', '🐰 토끼·병아리']];
export function petGroup(id) { const k = (PET_ITEMS[id] || {}).kind; return k === 'rabbit' || k === 'chick' ? 'small' : k; }
// 서버에 품종이 없으면(kids_features의 breeds) 처음 다섯 마리만 판다
export function shopPets(breeds) { return PET_IDS.filter((id) => breeds || !PET_ITEMS[id].breed); }
