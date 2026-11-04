// 진숲 어린이 마을 — 열매 상점 꾸미기 물건 (모자, 얼굴, 등, 특별한 옷, 머리 모양)
// slot: 아바타에서 바뀌는 칸, v: 그 칸의 값. 한 번 사면 옷장에서 언제든 입고 벗는다 (머리 모양은 옷장의 머리 칸에서 바꾼다).
// 값과 이름은 서버(kids__item_price, kids__wear_item)와 같다. 서버는 산 아이만 입게 한다.
export const WARDROBE = {
  av_halo: { slot: 'hat', v: 'halo', name: '천사 고리', price: 6, desc: '머리 위에 반짝이는 고리가 둥실 떠 있어요.' },
  av_bunny: { slot: 'hat', v: 'bunny', name: '토끼 머리띠', price: 5, desc: '길쭉한 토끼 귀가 쫑긋! 모자 색으로 물들어요.' },
  av_catband: { slot: 'hat', v: 'catband', name: '고양이 머리띠', price: 5, desc: '뾰족한 고양이 귀 머리띠예요. 모자 색으로 물들어요.' },
  av_chef: { slot: 'hat', v: 'chef', name: '요리사 모자', price: 6, desc: '요리할 때 쓰면 더 맛있어질 것 같은 하얀 모자예요.' },
  av_glasses: { slot: 'face', v: 'glasses', name: '동그란 안경', price: 3, desc: '동글동글 똑똑해 보이는 안경이에요.' },
  av_sunglasses: { slot: 'face', v: 'sunglasses', name: '선글라스', price: 4, desc: '햇빛이 쨍쨍한 수영장에 잘 어울려요.' },
  av_heart: { slot: 'face', v: 'heart', name: '하트 안경', price: 4, desc: '분홍 하트 모양 안경이에요.' },
  av_angel: { slot: 'back', v: 'angel', name: '천사 날개', price: 10, desc: '등에 하얀 날개가 달려 살랑살랑 움직여요.' },
  av_butterfly: { slot: 'back', v: 'butterfly', name: '나비 날개', price: 10, desc: '알록달록 나비 날개예요. 등 색으로 물들어요.' },
  av_cape: { slot: 'back', v: 'cape', name: '망토', price: 6, desc: '달리면 펄럭이는 망토예요. 등 색으로 물들어요.' },
  av_backpack: { slot: 'back', v: 'backpack', name: '책가방', price: 4, desc: '말씀 공책을 넣고 다니는 가방이에요. 등 색으로 물들어요.' },
  av_sailor: { slot: 'outfit', v: 'sailor', name: '세일러복', price: 6, desc: '넓은 깃과 리본이 달린 옷이에요. 옷 색으로 깃을 물들여요.' },
  av_raincoat: { slot: 'outfit', v: 'raincoat', name: '비옷', price: 6, desc: '모자가 달린 반짝반짝 비옷이에요. 옷 색으로 물들어요.' },
  av_hero: { slot: 'outfit', v: 'hero', name: '영웅 옷', price: 8, desc: '가슴에 별이 빛나는 옷이에요. 망토와 함께 입어 봐요!' },
  // 머리 모양 (머리 색은 옷장에서 고른 색으로 물든다)
  av_h_cloud: { slot: 'hair', v: 'cloud', name: '뭉게구름 머리', price: 6, desc: '구름처럼 몽실몽실 크게 부푼 곱슬머리예요.' },
  av_h_spacebuns: { slot: 'hair', v: 'spacebuns', name: '양쪽 똥머리', price: 5, desc: '머리 위 양쪽에 동그란 똥머리를 하나씩 올렸어요.' },
  av_h_twintails: { slot: 'hair', v: 'twintails', name: '높은 양갈래', price: 5, desc: '머리 위쪽에서 묶어 어깨 아래까지 내려오는 양갈래예요.' },
  av_h_sidetail: { slot: 'hair', v: 'sidetail', name: '옆으로 묶은 머리', price: 4, desc: '한쪽 옆으로 모아 묶은 머리예요.' },
  av_h_wavy: { slot: 'hair', v: 'wavy', name: '긴 물결 머리', price: 6, desc: '가운데 가르마에 등까지 물결치며 내려오는 긴 머리예요.' },
  av_h_princess: { slot: 'hair', v: 'princess', name: '리본 긴 머리', price: 7, desc: '긴 생머리 뒤통수에 분홍 리본을 크게 달았어요.' },
  av_h_quiff: { slot: 'hair', v: 'quiff', name: '멋쟁이 앞머리', price: 4, desc: '옆은 짧게, 앞머리는 위로 멋지게 세워 넘겼어요.' },
  av_h_messy: { slot: 'hair', v: 'messy', name: '까치집 머리', price: 3, desc: '방금 일어난 것처럼 여기저기 뻗친 머리예요.' },
  av_h_dino: { slot: 'hair', v: 'dino', name: '공룡 머리', price: 5, desc: '이마에서 뒤통수까지 공룡 등처럼 뾰족뾰족 솟았어요.' },
  av_h_daenggi: { slot: 'hair', v: 'daenggi', name: '댕기 머리', price: 5, desc: '길게 땋아 내린 머리 끝에 빨간 댕기를 묶었어요. 한복과 잘 어울려요.' },
  av_h_sangtu: { slot: 'hair', v: 'sangtu', name: '상투 머리', price: 4, desc: '머리를 위로 올려 묶고 금빛 동곳을 꽂았어요. 한복과 잘 어울려요.' },
};
// 칸마다 벗었을 때 돌아가는 값
export const WEAR_OFF = { hat: 'none', face: 'none', back: 'none', outfit: 'tee', hair: 'short' };
export const WARDROBE_IDS = Object.keys(WARDROBE);
// 아바타 칸과 값으로 상점 물건 찾기 (없으면 누구나 고를 수 있는 것)
export function wearItem(slot, v) {
  for (const id of WARDROBE_IDS) if (WARDROBE[id].slot === slot && WARDROBE[id].v === v) return id;
  return null;
}
// 아바타에서 아직 사지 않은 상점 물건들
export function missingItems(av, owned) {
  const out = [];
  for (const slot of ['hat', 'face', 'back', 'outfit', 'hair']) {
    const id = av && wearItem(slot, av[slot]);
    if (id && !(owned && owned[id] > 0)) out.push(id);
  }
  return out;
}
