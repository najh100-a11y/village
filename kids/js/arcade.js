// 진숲 어린이 마을 — 새벽 동굴 오락실 (위에서 내려다보는 2D 빛 쏘기)
// 동굴 방 하나(시험 'arcade')와 갑주의 방의 '도전 모드'(끝없는 물결)에서 쓴다.
// 화면 아무 곳이나 누른 채 밀면(키보드는 방향키) 갑주를 입은 아이가 뛰어다니고, 말씀의 빛이 가까운 그림자에게 저절로 나간다.
// 그림자는 거짓말, 두려움, 참소, 의심이다(엡 6:12). 사람이 아니라 빛으로 물리칠 어둠이다.
// 도전 모드 물결 20부터는 더 센 그림자(미움, 걱정, 교만)가 섞여 나오고, 도전 모드에서는 움직이고 있을 때만 빛이 나간다(2026년 11월 22일).
// 빛 조각을 모으면 빛이 세지고, '기도' 단추를 누르면 기도의 빛이 퍼진다. 마지막에 나오는 큰 그림자를 물리치면 방을 통과한다.
// 물결을 이길 때마다 갑주 기술(SKILLS) 세 가지 가운데 하나를 골라 쌓는다(기술마다 3단계까지).
// 큰 그림자는 다섯 가지(BOSS_KINDS)이고 저마다 공격이 다르다. 동굴 방은 단계마다, 도전 모드는 다섯 물결마다 돌아가며 나온다.
// 친구와 함께(둘에서 넷까지) 할 때는 한 판에서 같이 싸운다(2026년 11월 22일). 판 크기를 모두 같게 하고(COOP_W×COOP_H),
// 방장 화면이 그림자, 큰 그림자, 어두운 구슬을 움직여 판 모습을 1초에 네 번쯤 보낸다('~S'). 내 주인공과 내 빛과 갑주 기술은
// 내 화면에서 움직이고, 맞힌 것만 방장에게 알린다('~A'). 친구의 빛은 내 화면에서 모양만 보여 준다. 사람이 많으면 그림자와 큰 그림자 힘도 는다.
// "너희 안에 계신 이가 세상에 있는 이보다 크심이라"(요일 4:4)
// 그림은 작은 판(짧은 쪽 200점쯤)에 점그림으로 그린 뒤 크게 늘린다(옛날 오락실처럼). 점수, 하트, 글자는 화면 크기로 또렷하게 그린다.
// T(동굴이 주는 도구)에서 쓰는 것: lv, endless, rng, keys, hearts, hurt, heal, alive, clear, pray, skip, me, props, sparks.
import * as THREE from './three.module.min.js';
import { arcadeSfx as A, startChip, stopChip, setScene, sceneNow } from './sound.js';
import { makeShadow, bobShadow } from './dungeon-scene.js';
import { ARMOR } from './dungeon-data.js';

const TAU = Math.PI * 2;
const NORTH = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const WALL = 7; // 판 가장자리 바위 두께 (점)
const HERO_SPEED = 84;
const SHOT_SPEED = 215;
const GAUGE_MAX = 8;
const POWER_TIME = 6;

// 그림자 (적). hp: 맞아야 하는 수, r: 크기, spd: 빠르기(점/초), pts: 점수
export const FOES = {
  wisp: { name: '거짓말 그림자', tip: '졸졸 따라와요', hp: 2, r: 4.5, spd: 31, pts: 100, col: '#9A82E0' },
  dasher: { name: '두려움 그림자', tip: '멈췄다가 휙 달려와요', hp: 2, r: 5, spd: 18, pts: 150, col: '#E070AE' },
  split: { name: '의심 그림자', tip: '물리치면 둘로 나뉘어요', hp: 3, r: 5.5, spd: 21, pts: 150, col: '#6CC4B8' },
  shooter: { name: '참소 그림자', tip: '어두운 구슬을 쏴요. 피해요!', hp: 3, r: 5.5, spd: 26, pts: 200, col: '#7FA0F0' },
  mini: { name: '작은 의심', tip: '', hp: 1, r: 3.5, spd: 44, pts: 50, col: '#8FE0D4' },
  // 도전 모드 물결 20부터 (strong)
  laser: { name: '미움 그림자', tip: '붉은 선이 보이면 비켜요! 곧 빛줄기를 쏴요', hp: 5, r: 6, spd: 20, pts: 400, col: '#F05068', strong: true },
  bomber: { name: '걱정 그림자', tip: '바닥에 붉은 동그라미가 생기면 얼른 나와요!', hp: 4, r: 5.5, spd: 24, pts: 350, col: '#F0A040', strong: true },
  pride: { name: '교만 그림자', tip: '아주 단단해요! 둘레로 구슬을 뿜어요', hp: 14, r: 8, spd: 13, pts: 600, col: '#B48CF0', strong: true },
};
const STRONG = ['laser', 'bomber', 'pride'], STRONG_FROM = 20;
const BOMB_R = 15, BOMB_T = 1.3; // 걱정 덩이: 떨어질 자리 반지름, 떨어지기까지 걸리는 시간
// 동굴 방의 물결 (단계마다). 마지막 물결 뒤에 큰 그림자가 나온다
const ROOM_WAVES = {
  1: [{ wisp: 5 }, { wisp: 4, dasher: 2 }, { wisp: 3, split: 2, dasher: 1 }],
  2: [{ wisp: 5, dasher: 1 }, { wisp: 4, split: 2, shooter: 1 }, { dasher: 3, wisp: 4 }, { split: 2, shooter: 2, wisp: 3 }],
  3: [{ wisp: 6, dasher: 2 }, { split: 3, shooter: 2 }, { dasher: 4, wisp: 4 }, { shooter: 3, split: 2, wisp: 3 }, { wisp: 5, dasher: 3, shooter: 2 }],
};
const BOSS_HP = { 1: 30, 2: 44, 3: 60 };
// 큰 그림자를 더 세게 (2026년 11월 22일, 너무 쉽다는 말에): 힘 1.7배, 고른 갑주 기술 단계마다 힘이 더 늘고(한 단계에 10%),
// 함께 하면 한 사람 더할 때마다 60%씩 는다. 공격도 더 자주, 더 촘촘하게 하고 구슬도 조금 빠르다.
const BOSS_K = 1.7, BOSS_PICK_K = 0.1, BOSS_ORB = 1.15;
// 친구와 함께 할 때 판 크기 (모두 같은 판). 주인공 옷 색은 자리마다 다르다 (나, 하늘색, 초록, 분홍)
const COOP_W = 216, COOP_H = 240; // 휴대폰을 세워 쓰는 아이가 많아 정사각형보다 조금 길게
const SLOT_COL = [['#E8B04A', '#B8862E'], ['#5BB8F5', '#2E7FB8'], ['#7CC46A', '#4A8E3E'], ['#F08AB8', '#B8507E']];
// 큰 그림자 다섯 가지. hpK: 힘 배수, tip: 나올 때 알려 주는 말, down: 물리쳤을 때
export const BOSS_KINDS = {
  shadow: { name: '큰 그림자', r: 16, hpK: 1, tip: '빛을 쏘며 끝까지 피해요!', down: '큰 그림자가 물러갔어요!' },
  doubt: { name: '의심 구름', r: 15, hpK: 1, tip: '구름에서 떨어지는 구슬을 피해요! 맞으면 구름이 나뉘어요', down: '의심 구름이 걷혔어요!' },
  mask: { name: '거짓 가면', r: 14, hpK: 0.9, tip: '가짜 가면에 속지 말아요! 진짜는 바닥에 그림자가 있어요', down: '거짓 가면이 깨졌어요!' },
  giant: { name: '두려움 거인', r: 19, hpK: 1.3, tip: '쿵! 퍼지는 구슬 고리의 빈틈으로 피해요!', down: '두려움 거인이 물러갔어요!' },
  accuser: { name: '참소하는 그림자', r: 16, hpK: 1.15, tip: '빙글빙글 쏟아지는 구슬 사이로 피해요!', down: '참소하는 그림자가 쫓겨났어요!' },
};
const ROOM_BOSSES = { 1: ['shadow', 'doubt'], 2: ['giant', 'mask'], 3: ['accuser'] };
const ENDLESS_BOSSES = ['shadow', 'doubt', 'mask', 'giant', 'accuser'];
const ACCUSE_WORDS = ['넌 못 해!', '또 틀렸지?', '넌 안 돼!', '포기해!'];
// 갑주 기술: 물결을 이길 때마다 셋 가운데 하나를 고른다. lv: 단계마다 카드에 쓰는 설명 (1단계부터)
const ARM = Object.fromEntries(ARMOR.map((a) => [a.id, a]));
export const SKILLS = {
  sword: { armor: 'sword', icon: '⚔️', name: '빛 칼', lv: ['내 둘레를 빛 칼로 휘둘러 그림자와 구슬을 베어요', '빛 칼이 더 넓게, 더 자주 휘둘러져요', '빛 칼이 아주 넓게, 아주 자주 휘둘러져요'] },
  shield: { armor: 'shield', icon: '🛡️', name: '도는 방패', lv: ['방패가 내 둘레를 돌며 어두운 구슬을 막아요', '방패가 둘이 돼요', '방패가 셋이 돼요'] },
  shoes: { armor: 'shoes', icon: '👟', name: '빠른 발', lv: ['더 빨리 달려요', '달린 자리에 빛 발자국이 남아 그림자를 막아요', '더 빨라지고 빛 발자국이 오래 남아요'] },
  belt: { armor: 'belt', icon: '🎗️', name: '진리의 빛줄기', lv: ['빛줄기가 그림자를 줄줄이 이어 쳐요. 가짜 가면도 드러나요', '빛줄기가 더 많이, 더 자주 이어져요', '빛줄기가 아주 많이, 아주 자주 이어져요'] },
  helmet: { armor: 'helmet', icon: '⛑️', name: '사방 빛', lv: ['가끔 내 둘레 사방으로 빛이 퍼져 나가요', '사방 빛이 더 많이, 더 자주 나가요', '사방 빛이 아주 많이, 아주 자주 나가요'] },
  breast: { armor: 'breast', icon: '✝️', name: '지켜 주는 의', lv: ['그림자에게 맞아도 한 번은 지켜 줘요 (시간이 지나면 다시 차요)', '더 빨리 다시 차요', '아주 빨리 다시 차요'] },
  light: { armor: 'sword', icon: '✨', name: '말씀의 빛 더하기', lv: ['말씀의 빛이 더 빨리 나가요', '빛이 그림자를 뚫고 하나 더 맞혀요', '빛이 두 줄로 나가요'] },
};
const SKILL_IDS = Object.keys(SKILLS);
const NO_SK = Object.fromEntries(SKILL_IDS.map((k) => [k, 0])); // 쓰러졌을 때는 기술이 쉰다
// 판 모습을 보낼 때 쓰는 번호
const FOE_IDS = Object.keys(FOES), BOSS_IDS = Object.keys(BOSS_KINDS);
const BST = ['enter', 'move', 'aim', 'charge', 'stompAim', 'fade', 'appear', 'down'];
const QCH = { wisp: 'w', dasher: 'd', split: 's', shooter: 'h', mini: 'm', laser: 'l', bomber: 'b', pride: 'p' }, QKIND = Object.fromEntries(Object.entries(QCH).map(([k, c]) => [c, k]));
const PH_OUT = { between: 'b', fight: 'f', boss: 'B', prepick: 'p', pick: 'p', pickwait: 'p', won: 'w', over: 'o', ready: 'r' };
const PH_IN = { b: 'between', f: 'fight', B: 'boss', p: 'pickhost', w: 'won', o: 'over', r: 'wait' };
const r1 = (x) => Math.round(x * 10) / 10;
// 주인공이 너무 세다는 말에 (2026년 11월 22일) 기술을 조금씩 약하게 했다: 빛 칼 범위와 빠르기, 빛줄기 수, 사방 빛 수, 지켜 주는 의 다시 차는 시간, 빠른 발, 빛 쏘는 빠르기
const SWORD_R = [0, 18, 21, 24], SWORD_GAP = [0, 1.8, 1.5, 1.2];
const BELT_N = [0, 3, 4, 5], BELT_GAP = [0, 2.6, 2.2, 1.8];
const HELM_N = [0, 6, 8, 10], HELM_GAP = [0, 3.6, 3.0, 2.4];
const GUARD_GAP = [0, 18, 15, 12], SHOE_K = [1, 1.12, 1.2, 1.28], FIRE_GAP = [0.28, 0.25, 0.22, 0.19];
// 도전 모드 n번째 물결 (다섯 번째마다 큰 그림자, 다섯 가지가 차례로)
function endlessWave(n, r, pk = 1) {
  if (n % 5 === 0) return { boss: true, hp: Math.round(26 + n * 2.5), blv: Math.min(3, 1 + Math.floor(n / 10)), kind: ENDLESS_BOSSES[(n / 5 - 1) % ENDLESS_BOSSES.length] };
  const total = Math.round(Math.min(22, 4 + n) * pk);
  const kinds = ['wisp'];
  if (n >= 2) kinds.push('dasher');
  if (n >= 3) kinds.push('split');
  if (n >= 4) kinds.push('shooter');
  // 물결 20부터 센 그림자가 섞인다 (물결 20은 큰 그림자가 데려오고, 21부터 셋, 세 물결마다 하나씩 더, 여섯까지)
  const first = n === STRONG_FROM + (STRONG_FROM % 5 === 0 ? 1 : 0);
  const strong = n >= STRONG_FROM ? Math.min(total - 4, Math.round(Math.min(6, 3 + Math.floor((n - STRONG_FROM - 1) / 3)) * pk)) : 0;
  const out = {};
  for (let i = 0; i < total - strong; i++) {
    const k = i < Math.ceil(total * 0.4) ? 'wisp' : kinds[Math.floor(r() * kinds.length)];
    out[k] = (out[k] || 0) + 1;
  }
  // 첫 센 물결(20)에는 세 가지를 하나씩 보여 준다
  for (let i = 0; i < strong; i++) { const k = first && i < STRONG.length ? STRONG[i] : STRONG[Math.floor(r() * STRONG.length)]; out[k] = (out[k] || 0) + 1; }
  return out;
}

// ---------- 점그림 ----------
const HERO_TOP = ['....kkkk....', '..kkhhhhkk..', '.khhhhhhhhk.', '.khHhhhhHhk.'];
const HERO_FACE = ['.kHssssssHk.', '.kssessessk.', '.kspsssspsk.'];
const HERO_BACK = ['.kHxxxxxxHk.', '.kxxxxxxxxk.', '.kxxxxxxxxk.'];
const HERO_BODY = ['..kssssssk..', '.kbbbbbbbbk.', 'skbbBbbBbbks', 'skwwwwwwwwks', '.kllllllllk.'];
const LEGS_A = ['..kllkkllk..', '..kffkkffk..'];
const LEGS_B = ['.kllk..kllk.', '.kffk..kffk.'];
const HERO_PAL = { k: '#120A22', h: '#DCE4EA', H: '#9AA6B2', s: '#F5C9A0', e: '#2A1F3D', p: '#F4A0A0', b: '#E8B04A', B: '#B8862E', w: '#F6D55C', l: '#5B6FB0', f: '#7CC46A', x: '#6A4630' };
const WISP_A = ['...kkkk...', '..kppppk..', '.kppppppk.', 'kppWppWppk', 'kppWppWppk', 'kppppppppk', 'kpppmmpppk', 'kppppppppk', 'kppkppkppk', '.kk.kk.kk.'];
const WISP_B = [...WISP_A.slice(0, 9), 'kk.kk.kk.k'];
const DASH = ['.....k.....', '.k..kpk..k.', '..kkpppkk..', '..kpppppk..', 'kkpWpppWpkk', '.kpWpppWpk.', '..kpppppk..', '..kpmmmpk..', '..kkpppkk..', '.k..kpk..k.', '.....k.....'];
const SHOOT = ['...kkkkkk...', '..kppppppk..', '.kppppppppk.', 'kppkkkkkkppk', 'kpkWWWWWWkpk', 'kpkWWeeWWkpk', 'kpkWWeeWWkpk', 'kppkkkkkkppk', 'kppppppppppk', '.kppppppppk.', '.kpk.kk.kpk.', '..k..kk..k..'];
const SPLIT = ['...kkkkkk...', '.kkppppppkk.', 'kppppppppppk', 'kpWWppppWWpk', 'kpWeppppWepk', 'kppppppppppk', 'kppmpmmpmppk', 'kppppppppppk', '.kpppkkpppk.', '..kkk..kkk..'];
const MINI = ['..kkk..', '.kpppk.', 'kpWpWpk', 'kpppppk', 'kpmmmpk', '.kpppk.', '.k.k.k.'];
const LASER = ['k..........k', 'kk..kkkk..kk', '.kkkppppkkk.', '.kppppppppk.', 'kppkkkkkkppk', 'kpkWWWWWWkpk', 'kpkWWeeWWkpk', 'kpkWWeeWWkpk', 'kppkkkkkkppk', '.kpppmmpppk.', '.kpkppppkpk.', '..k.kkkk.k..'];
const BOMBER = ['......kk....', '.....kyyk...', '....k.kk....', '...kkkkkk...', '..kppppppk..', '.kpWWppWWpk.', '.kpWeppeWpk.', 'kppppppppppk', 'kppmmmmmmppk', '.kppppppppk.', '..kppppppk..', '...kkkkkk...'];
const PRIDE = ['.y...y...y...y.', 'kyk.kyk.kyk.kyk', 'kyykyyykyyykyyk', 'kkkkkkkkkkkkkkk', 'kpppppppppppppk', 'kppWWWpppWWWppk', 'kppWeWpppWeWppk', 'kpppppppppppppk', 'kpppmmmmmmmpppk', '.kpppppppppppk.', '.kpppppppppppk.', '.kpkpppppppkpk.', '..k.kkkkkkk.k..'];
const HEART = ['.RR.RR.', 'RORRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
const GEM = ['..o..', '.oOo.', 'oOOOo', '.oOo.', '..o..'];
const SHIELD = ['.kkk.', 'kbbbk', 'kbwbk', 'kbbbk', '.kbk.', '..k..'];
const SHP = (p, m, W, e = '#120A22') => ({ k: '#0A0614', p, m, W, e });
const FOE_PAL = {
  wisp: SHP('#3E2C72', '#1E1540', '#F3EAFB'),
  dasher: SHP('#6A2058', '#300A28', '#FFE0E0'),
  shooter: SHP('#243A78', '#101C40', '#F3EAFB', '#E0404F'),
  split: SHP('#1F5258', '#0C3034', '#E6FFF9'),
  mini: SHP('#2E6E68', '#123A36', '#E6FFF9'),
  laser: SHP('#5A1830', '#2A0812', '#FFE0E0', '#FF3048'),
  bomber: { ...SHP('#6A4010', '#301C04', '#FFF0D0', '#2A1400'), y: '#FFD040' },
  pride: { ...SHP('#4A2A78', '#22103E', '#F0E0FF', '#3A1060'), y: '#FFE58A' },
};
// 떠오르는 점수 글자 (3×5 점)
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], x: ['000', '101', '010', '101', '000'],
};

function paint(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
function whiteOf(c, col = '#FFFFFF') {
  const d = document.createElement('canvas');
  d.width = c.width;
  d.height = c.height;
  const g = d.getContext('2d');
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return d;
}
let SPR = null;
function sprites() {
  if (SPR) return SPR;
  const hero = (head, legs) => paint([...HERO_TOP, ...head, ...HERO_BODY, ...legs], HERO_PAL);
  SPR = {
    hero: [hero(HERO_FACE, LEGS_A), hero(HERO_FACE, LEGS_B)],
    back: [hero(HERO_BACK, LEGS_A), hero(HERO_BACK, LEGS_B)],
    wisp: [paint(WISP_A, FOE_PAL.wisp), paint(WISP_B, FOE_PAL.wisp)],
    dasher: [paint(DASH, FOE_PAL.dasher)],
    shooter: [paint(SHOOT, FOE_PAL.shooter)],
    split: [paint(SPLIT, FOE_PAL.split)],
    mini: [paint(MINI, FOE_PAL.mini)],
    laser: [paint(LASER, FOE_PAL.laser)],
    bomber: [paint(BOMBER, FOE_PAL.bomber)],
    pride: [paint(PRIDE, FOE_PAL.pride)],
    heart: paint(HEART, { R: '#F0506A', O: '#FFC2CC' }),
    heartOff: paint(HEART, { R: '#4A3D6E', O: '#5A4D80' }),
    gem: paint(GEM, { o: '#FFC93A', O: '#FFF8D6' }),
    shield: paint(SHIELD, { k: '#0A0614', b: '#5BB8F5', w: '#FFFFFF' }),
  };
  SPR.slots = [];
  SPR.heroW = whiteOf(SPR.hero[0]);
  SPR.heroG = whiteOf(SPR.hero[0], '#6A5E8E');
  for (const k of Object.keys(FOE_PAL)) { SPR[k + 'W'] = whiteOf(SPR[k][0]); SPR[k + 'R'] = whiteOf(SPR[k][0], '#FF6A7A'); }
  return SPR;
}

// 자리마다 옷 색이 다른 주인공 (0은 늘 쓰던 노란 옷)
function heroSet(slot) {
  const SP = sprites();
  slot = clamp(slot | 0, 0, SLOT_COL.length - 1);
  if (SP.slots[slot]) return SP.slots[slot];
  const [b1, b2] = SLOT_COL[slot];
  const pal = { ...HERO_PAL, b: b1, B: b2 };
  const hero = (head, legs) => paint([...HERO_TOP, ...head, ...HERO_BODY, ...legs], pal);
  const set = { hero: [hero(HERO_FACE, LEGS_A), hero(HERO_FACE, LEGS_B)], back: [hero(HERO_BACK, LEGS_A), hero(HERO_BACK, LEGS_B)] };
  set.G = whiteOf(set.hero[0], '#6A5E8E');
  SP.slots[slot] = set;
  return set;
}

// 동굴 바닥과 벽 (판 크기가 바뀔 때만 다시 그린다)
function buildFloor(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#383250';
  g.fillRect(0, 0, W, H);
  for (let y = 0, row = 0; y < H; y += 16, row++) {
    for (let x = (row % 2) * 8 - 8; x < W; x += 16) {
      const v = Math.random();
      g.fillStyle = v < 0.33 ? '#4A4462' : v < 0.66 ? '#45405D' : '#4F4868';
      g.fillRect(x + 1, y + 1, 15, 15);
      g.fillStyle = '#5B5476';
      g.fillRect(x + 1, y + 1, 15, 1);
    }
  }
  for (let i = 0; i < (W * H) / 70; i++) { g.fillStyle = Math.random() < 0.5 ? '#3A3452' : '#5A5374'; g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1); }
  // 바위 벽
  g.fillStyle = '#120C22';
  g.fillRect(0, 0, W, WALL); g.fillRect(0, H - WALL, W, WALL); g.fillRect(0, 0, WALL, H); g.fillRect(W - WALL, 0, WALL, H);
  const rock = (x, y, w, h) => { g.fillStyle = '#3A2E5E'; g.fillRect(x, y, w, h); g.fillStyle = '#54467F'; g.fillRect(x, y, w, 1); g.fillStyle = '#231A3E'; g.fillRect(x, y + h - 1, w, 1); };
  for (let x = 0; x < W; x += 7) { const w = 5 + Math.floor(Math.random() * 4); rock(x, 1 + Math.floor(Math.random() * 2), w, WALL - 2); rock(x, H - WALL + 1, w, WALL - 2); }
  for (let y = WALL; y < H - WALL; y += 7) { const hh = 5 + Math.floor(Math.random() * 4); rock(1, y, WALL - 2, hh); rock(W - WALL + 1, y, WALL - 2, hh); }
  // 벽에 박힌 빛나는 돌
  for (let i = 0; i < 6; i++) {
    const side = i % 4, t = Math.random();
    const x = side < 2 ? Math.floor(WALL + t * (W - 2 * WALL)) : side === 2 ? 2 : W - 5;
    const y = side < 2 ? (side === 0 ? 2 : H - 5) : Math.floor(WALL + t * (H - 2 * WALL));
    g.fillStyle = '#7FD8FF'; g.fillRect(x, y, 3, 3);
    g.fillStyle = '#E6FBFF'; g.fillRect(x + 1, y, 1, 1);
  }
  return c;
}

export function trialArcade(T) {
  const endless = !!T.endless;
  const lv = endless ? 1 : clamp(T.lv || 1, 1, 3);
  const roomWaves = endless ? null : ROOM_WAVES[lv];
  // 친구와 함께: CO는 동굴이 주는 함께 하기 도구(혼자면 null), HOST는 그림자를 움직이는 화면(혼자면 늘 나)
  let CO = T.coop || null;
  let HOST = !CO || !!CO.host;
  const CL = () => !!CO && !HOST;
  const mySlot = CO ? clamp(CO.slot(CO.me), 0, 3) : 0;
  let cv = null, ctx = null, buf = null, b = null, floor = null, probe = null, L = null, layoutT = 0;
  let started = false, overlay = false, prevScene = null, t0 = 0;
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const S = {
    W: 240, H: 200, phase: 'ready', t: 0, wave: 0, cleared: 0, queue: [], spawnT: 0, betweenT: 0, maxAlive: [6, 8, 9][lv - 1], mul: [1, 1.08, 1.16][lv - 1],
    hero: { x: 120, y: 150, vx: 0, vy: 0, inv: 0, walk: 0, up: false, moved: 0 },
    foes: [], shots: [], orbs: [], items: [], parts: [], pops: [], portals: [], boss: null, bomb: null, bombId: 0,
    score: 0, combo: 0, comboT: 0, mult: 1, gauge: 0, power: 0, fireT: 0.4, stop: 0, shake: 0, flash: 0, flashCol: '#fff',
    banner: null, hint: 5.5, seen: new Set(), endT: 0, end: '', lastBossHit: 0, kills: 0,
    // 갑주 기술 단계와 기술마다 남은 시간, 기술이 그리는 것들
    sk: Object.fromEntries(SKILL_IDS.map((k) => [k, 0])), skT: { sword: 0.4, belt: 0.8, helmet: 1.2, breast: 0 }, guard: false,
    shAng: 0, shBossT: 0, prints: [], printT: 0, slash: null, chains: [], pick: null, pickT: 0, pickEl: null, blockT: 0,
    decoys: [], words: [], tips: [],
    // 함께 할 때: 친구 주인공(heroes), 그림자·가짜 가면·큰 그림자 번호, 보낼 것들(새 구슬, 소리와 글, 맞힌 것)
    heroes: new Map(), fid: 0, did: 0, bossN: 0, newOrbs: [], fxq: [], bn: null, bnN: 0, bnSeen: 0, sendT: 0, lastSend: 0, lastKey: '',
    myPk: 0, picking: false, pickWaitT: 0, prepickT: 0, hitQ: new Map(), bossQ: 0, decQ: [], gemQ: 0, bombQ: null, dead: new Map(),
    hostT: 0, hostAt: 0, snapAt: 0, qStr: '', partyMax: 1, pn: 1, allDownT: 0, rings: [], spec: {},
    // 걱정 그림자가 떨어뜨리는 걱정 덩이, 가만히 서 있을 때 알려 준 수
    bombs: [], kid: 0, stillT: 0, stillTips: 0,
  };

  // ---------- 동굴 안(3D) 모습: 시작 전에는 그림자 셋이 떠 있다 ----------
  T.me.place(T.slotX, 1.6, NORTH);
  const ghosts = [[-2.4, -3.0], [0, -4.0], [2.4, -3.0]].map(([x, z], i) => { const g = makeShadow('shadow', 0.9 + (i === 1 ? 0.35 : 0)); g.position.set(x, 0, z); T.props.add(g); return g; });
  function popGhosts(quiet = false) {
    for (const g of ghosts) { if (g.parent) { if (!quiet) T.sparks.burst(new THREE.Vector3(g.position.x, 1, g.position.z), '#FFF3B0', 16, 0.9, 1.3); g.parent.remove(g); } }
    ghosts.length = 0;
  }

  // ---------- 화면 ----------
  function makeCanvas() {
    cv = document.createElement('canvas');
    cv.className = 'arc-cv';
    cv.setAttribute('aria-label', endless ? '그림자 떼 도전 판' : '그림자 떼 물리치기 판');
    ctx = cv.getContext('2d');
    buf = document.createElement('canvas');
    b = buf.getContext('2d');
    probe = document.createElement('div');
    probe.className = 'arc-probe';
    document.body.append(probe, cv);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', onResize);
  }
  let resized = false;
  const onResize = () => { resized = true; };
  function measure() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    const sr = probe.getBoundingClientRect();
    const sl = sr.left || 0, st = sr.top || 0, sR = Math.max(0, vw - (sr.right || vw)), sB = Math.max(0, vh - (sr.bottom || vh));
    let right = sR + 6, bottom = sB + 6;
    const gb = document.querySelector('#gameUi .g-bottom');
    if (gb) {
      const r = gb.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (r.height > r.width * 1.1 && r.left > vw * 0.55) right = Math.max(right, vw - r.left + 8);
        else bottom = Math.max(bottom, vh - r.top + 6);
      }
    }
    const x0 = sl + 6, y0 = st + 52;
    const fw = Math.max(140, vw - right - x0), fh = Math.max(140, vh - bottom - y0);
    const dw = fw * dpr, dh = fh * dpr;
    let s, W, H;
    if (CO) {
      // 함께 할 때는 모두 같은 판 크기. 정수 배로 줄이면 너무 작아질 때는 그대로 늘린다
      W = COOP_W; H = COOP_H;
      const k = Math.min(dw / W, dh / H);
      s = Math.max(1, Math.floor(k));
      if (s < k * 0.88) s = Math.max(0.5, k);
    } else {
      s = Math.max(1, Math.floor(Math.min(dw, dh) / 170)); // 짧은 쪽이 170~200점쯤 되게 (점이 커야 오락실 같다)
      W = Math.floor(dw / s); H = Math.floor(dh / s);
      if (W > H * 2) W = Math.floor(H * 2);
      if (H > W * 2) H = Math.floor(W * 2);
    }
    const ox = Math.round(x0 * dpr + (dw - W * s) / 2), oy = Math.round(y0 * dpr + (dh - H * s) / 2);
    return { dpr, vw, vh, s, W, H, ox, oy, top: st, left: sl, right: sR, key: [vw, vh, dpr, W, H, s, ox, oy].join(',') };
  }
  function relayout(force = false) {
    const m = measure();
    if (!force && L && m.key === L.key) return;
    const cw = Math.round(m.vw * m.dpr), ch = Math.round(m.vh * m.dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    if (!L || L.W !== m.W || L.H !== m.H) {
      const kx = L ? m.W / L.W : 1, ky = L ? m.H / L.H : 1;
      buf.width = m.W;
      buf.height = m.H;
      floor = buildFloor(m.W, m.H);
      S.W = m.W;
      S.H = m.H;
      // 판 크기가 바뀌면(기기를 돌리면) 모두 판 안으로
      if (L) for (const o of [S.hero, ...S.foes, ...S.items, ...S.portals, ...(S.boss ? [S.boss] : [])]) { o.x *= kx; o.y *= ky; }
      S.orbs.length = 0;
      S.shots.length = 0;
    }
    L = m;
  }
  // 판 위 점(px)과 화면 위 자리(CSS px) 바꾸기
  const toCss = (x, y) => ({ x: (L.ox + x * L.s) / L.dpr, y: (L.oy + y * L.s) / L.dpr });

  // ---------- 손가락 (떠다니는 조이스틱) ----------
  function onDown(e) {
    e.preventDefault();
    if (joy.id !== null) return;
    joy.id = e.pointerId;
    joy.ox = joy.x = e.clientX;
    joy.oy = joy.y = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 괜찮다 */ }
  }
  function onMove(e) {
    if (e.pointerId !== joy.id) return;
    joy.x = e.clientX;
    joy.y = e.clientY;
    // 손가락이 멀리 가면 가운데도 따라온다 (반대로 바로 돌아갈 수 있게)
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), R = 46;
    if (d > R) { joy.ox += (dx / d) * (d - R); joy.oy += (dy / d) * (d - R); }
  }
  function onUp(e) { if (e.pointerId === joy.id) joy.id = null; }
  function steerDir() {
    let x = 0, y = 0, m = 0;
    const k = T.keys;
    if (k && k.size) {
      x = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
      y = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0);
      const d = Math.hypot(x, y);
      if (d) { x /= d; y /= d; m = 1; }
    }
    if (!m && joy.id !== null) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
      if (d > 5) { x = dx / d; y = dy / d; m = Math.min(1, (d - 5) / 34); }
    }
    return { x, y, m };
  }

  // ---------- 시작과 끝 ----------
  function begin() {
    if (started) return;
    started = true;
    t0 = performance.now();
    sprites();
    makeCanvas();
    overlay = true;
    document.body.classList.add('dg-arcade');
    relayout(true);
    S.hero.x = CO ? S.W * (0.3 + 0.13 * mySlot) : S.W / 2; // 함께 하면 나란히 선다
    S.hero.y = S.H * 0.7;
    T.skip(true);
    prevScene = sceneNow();
    setScene('arcade');
    startChip();
    A.wave();
    if (CO && HOST) for (const id of CO.bots()) addBot(id);
    if (CL()) {
      S.phase = 'wait';
      banner('친구와 함께!', '방장 화면에서 그림자가 오면 시작해요', 2.2);
      sendMe(true);
      return;
    }
    nextWave();
  }
  // 오락실 판을 걷어 내고 동굴(3D)로 돌아간다
  function exitOverlay(quiet = false) {
    if (!overlay) return;
    overlay = false;
    document.body.classList.remove('dg-arcade');
    T.skip(false);
    stopChip();
    if (sceneNow() === 'arcade') setScene(prevScene || 'game');
    joy.id = null;
    popGhosts(quiet);
    const c = cv, p = probe;
    if (c) { c.classList.add('out'); setTimeout(() => { c.remove(); if (p) p.remove(); }, 480); }
    window.removeEventListener('resize', onResize);
    cv = null;
    probe = null;
    closePick();
  }
  function stop() {
    closePick();
    exitOverlay(true);
    popGhosts(true);
  }
  // 도전 모드가 끝났을 때 (하트를 다 잃었을 때 동굴이 부른다)
  function finish() {
    if (S.phase === 'over') return;
    S.phase = 'over';
    S.end = 'over';
    S.endT = 2.2;
    S.flash = 0.5;
    S.flashCol = '#2A0A18';
    S.shake = 5;
    A.over();
    closePick();
    S.picking = false;
    banner('여기까지!', `물결 ${S.cleared}개를 이겼어요 · 점수 ${fmt(S.score)}`, 2.2, false, true);
  }

  // ---------- 물결 ----------
  function nextWave() {
    S.wave++;
    // 함께 하면 사람 수만큼 그림자가 많아진다 (한 사람 더할 때마다 반만큼)
    const pn = partyN(), pk = 1 + 0.5 * (pn - 1);
    S.pn = pn;
    let spec = endless ? endlessWave(S.wave, T.rng, pk) : S.wave <= roomWaves.length ? roomWaves[S.wave - 1] : null;
    if (spec && spec.boss && S.forceBoss) spec = { ...spec, kind: S.forceBoss };
    if (!spec) { const ks = ROOM_BOSSES[lv]; spec = { boss: true, hp: BOSS_HP[lv], blv: lv, kind: S.forceBoss || ks[Math.floor(T.rng() * ks.length)] }; }
    S.spec = spec;
    if (endless) { S.mul = 1 + Math.min(0.6, (S.wave - 1) * 0.03); S.maxAlive = Math.min(12, 6 + Math.floor(S.wave / 3)); }
    else S.maxAlive = [6, 8, 9][lv - 1];
    S.maxAlive += 3 * (pn - 1);
    S.phase = 'between';
    S.betweenT = S.wave === 1 ? 1.8 : 1.5;
    if (spec.boss) {
      const K = BOSS_KINDS[spec.kind] || BOSS_KINDS.shadow;
      banner(`${K.name}${ga(K.name)} 나타났어요!`, K.tip, 2.0, false, true);
      S.betweenT = 2.0;
      return;
    }
    const kinds = Object.keys(spec);
    const freshAll = kinds.filter((k) => !S.seen.has(k)), fresh = freshAll[0];
    for (const k of kinds) S.seen.add(k);
    const title = endless ? `물결 ${S.wave}` : `물결 ${S.wave}/${roomWaves.length}`;
    if (freshAll.some((k) => FOES[k].strong)) banner(title, `더 센 그림자가 나와요! ${freshAll.filter((k) => FOES[k].strong).map((k) => FOES[k].name).join(', ')}`, 2.4, false, true);
    else banner(title, fresh ? `새 그림자: ${FOES[fresh].name} · ${FOES[fresh].tip}` : '말씀의 빛으로 물리쳐요!', 1.5, false, true);
    const q = [];
    for (const k of kinds) for (let i = 0; i < Math.round(spec[k] * (endless ? 1 : pk)); i++) q.push(k);
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(T.rng() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    S.queue = q;
  }
  function startWave() {
    if (S.spec.boss) { spawnBoss(S.spec); return; }
    S.phase = 'fight';
    S.spawnT = 0.2;
  }
  function waveDone() {
    S.cleared++;
    A.wave();
    share('w');
    if (!endless && S.spec.boss) { win(); return; }
    // 물결 사이에 남은 빛 조각은 저절로 모인다
    for (const it of S.items) it.pull = true;
    // 갑주 기술 고르기 (조금 뒤에 카드가 나온다. 더 고를 기술이 없으면 바로 다음 물결)
    // 함께 할 때는 모두 고를 때까지 기다린다 (예시 친구는 바로 고른다)
    if (CO) { for (const rh of S.heroes.values()) if (rh.ai) botPick(rh); S.phase = 'prepick'; S.pickT = 0.8; S.pickWaitT = 0; return; }
    if (SKILL_IDS.some((k) => S.sk[k] < 3)) { S.phase = 'prepick'; S.pickT = 0.8; return; }
    nextWave();
  }
  function win() {
    const K = BOSS_KINDS[S.lastBoss] || BOSS_KINDS.shadow;
    S.phase = 'won';
    S.end = 'won';
    S.endT = 3.2;
    A.win();
    closePick();
    S.picking = false;
    banner(K.down, '너희 안에 계신 이가 세상에 있는 이보다 크심이라 (요일 4:4)', 3.2);
  }

  // ---------- 갑주 기술 고르기 (카드 세 장) ----------
  function openPick() {
    const can = SKILL_IDS.filter((k) => S.sk[k] < 3);
    if (!can.length) { picked(); return; } // 기술을 다 올렸다 (함께 할 때만 여기 온다)
    // 아직 없는 기술을 조금 더 자주 보여 준다
    const pool = can.map((k) => ({ k, w: (S.sk[k] ? 1 : 1.6) * Math.random() })).sort((a, b) => b.w - a.w).slice(0, 3).map((x) => x.k);
    if (HOST) S.phase = 'pick';
    S.picking = true;
    S.pickWave = S.wave; // 이 물결을 이기고 고른다 (친구 화면은 방장이 먼저 넘어가도 이 물결로 알린다)
    S.pick = pool;
    joy.id = null;
    A.wave();
    const el = document.createElement('div');
    el.className = 'arc-pick';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '갑주 기술 고르기');
    const head = document.createElement('p');
    head.className = 'arc-pick-h';
    head.textContent = '갑주 기술을 하나 골라요';
    const row = document.createElement('div');
    row.className = 'arc-cards';
    pool.forEach((k, i) => {
      const K = SKILLS[k], a = ARM[K.armor], lvNow = S.sk[k];
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'arc-card';
      bt.disabled = true;
      bt.innerHTML = '';
      const add = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; bt.append(e); return e; };
      add('span', 'ic', K.icon).setAttribute('aria-hidden', 'true');
      add('b', 'nm', K.name);
      add('span', 'lv', lvNow ? `${lvNow}단계 → ${lvNow + 1}단계` : '새 기술!');
      add('span', 'ds', K.lv[lvNow]);
      // 갑주 이름과 말씀 (구절이 이름과 거의 같으면 이름만)
      add('span', 'vs', a.verse.length > a.name.length + 3 ? `${a.name} · ‘${a.verse}’ (${a.ref})` : `${a.name} (${a.ref})`);
      add('span', 'key', `${i + 1}`).setAttribute('aria-hidden', 'true');
      bt.addEventListener('click', () => choose(k));
      row.append(bt);
    });
    el.append(head, row);
    document.body.append(el);
    S.pickEl = el;
    // 화면을 누르고 있던 손가락으로 잘못 고르지 않게 잠깐 뒤에 누를 수 있다
    setTimeout(() => { if (S.pickEl === el) for (const bt of el.querySelectorAll('button')) bt.disabled = false; }, 450);
  }
  function closePick() {
    if (S.pickEl) { S.pickEl.remove(); S.pickEl = null; }
  }
  function choose(k) {
    if (!S.picking || !S.pick || !S.pick.includes(k) || S.sk[k] >= 3) return;
    S.sk[k]++;
    if (k === 'breast' && S.sk.breast === 1) S.guard = true;
    if (k === 'sword') S.skT.sword = 0.2;
    if (k === 'belt') S.skT.belt = 0.4;
    if (k === 'helmet') S.skT.helmet = 0.6;
    S.pick = null;
    closePick();
    A.power();
    burst(S.hero.x, S.hero.y, '#FFF3B0', 14, 60, 0.5);
    picked();
    tip(S.hero.x, S.hero.y - 14, `${SKILLS[k].icon} ${SKILLS[k].name} ${S.sk[k]}단계!`, '#FFE58A', 1.6);
  }
  // 이번 물결의 기술을 골랐다: 혼자면 바로 다음 물결, 함께면 친구를 기다린다 (방장) / 방장에게 알린다 (친구)
  function picked() {
    S.picking = false;
    S.myPk = Math.max(S.myPk, S.pickWave || S.wave);
    S.pickWave = 0;
    if (!HOST) { sendMe(true); return; }
    if (CO) S.phase = 'pickwait';
    else nextWave();
  }
  // 예시 친구는 기술을 바로 고른다
  function botPick(rh) {
    const can = SKILL_IDS.filter((k) => rh.sk[k] < 3);
    if (can.length) rh.sk[can[Math.floor(Math.random() * can.length)]]++;
    rh.pk = S.wave;
  }
  // 이름 뒤 '이/가' (받침이 있으면 '이')
  function ga(w) { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가'; }
  // 판 위에 또렷한 글자로 잠깐 떠오르는 말
  function tip(x, y, txt, col = '#FFF8E7', life = 1.1, px = 15) { S.tips.push({ x, y, txt, col, life, max: life, px }); if (S.tips.length > 8) S.tips.shift(); }

  // ---------- 만들기 ----------
  // 그림자가 나올 자리: 모든 주인공에게서 떨어진 곳
  function spotAwayFromHero(min) {
    const hs = heroList(), m = WALL + 10;
    let best = null, bd = -1;
    for (let i = 0; i < 14; i++) {
      const x = rnd(m, S.W - m), y = rnd(m, S.H - m);
      let d = Infinity;
      for (const h of hs) d = Math.min(d, Math.hypot(x - h.x, y - h.y));
      if (d >= min) return { x, y };
      if (d > bd) { bd = d; best = { x, y }; }
    }
    return best;
  }
  function openPortal(kind, at) {
    const p = at || spotAwayFromHero(Math.min(70, Math.min(S.W, S.H) * 0.38));
    S.portals.push({ kind, x: p.x, y: p.y, t: 0, dur: 0.75 });
    A.spawn();
    share('sn');
    // 센 그림자가 처음 나올 때는 어떻게 피하는지 그 자리에 알려 준다
    const F = FOES[kind];
    if (F.strong && !S.seen.has('tip_' + kind)) {
      S.seen.add('tip_' + kind);
      const y = clamp(p.y - 16, WALL + 10, S.H - WALL - 10);
      tip(p.x, y, `${F.name}: ${F.tip}`, '#FFB0B8', 2.6, 13);
      share('tp', r1(p.x), r1(y), `${F.name}: ${F.tip}`, '#FFB0B8', 2.6, 13);
    }
  }
  function addFoe(kind, x, y, id) {
    const F = FOES[kind];
    const f = { id: id != null ? id : ++S.fid, kind, x, y, vx: 0, vy: 0, r: F.r, hp: F.hp, max: F.hp, t: Math.random() * 10, st: 'roam', stT: rnd(0.8, 1.8), flash: 0, dx: 0, dy: 0, fireT: rnd(1.4, 2.4), bombed: -1,
      sx: x, sy: y, svx: 0, svy: 0, sat: 0 };
    S.foes.push(f);
    return f;
  }
  // 고른 갑주 기술 단계의 합 (함께면 모두의 평균)
  function pickCount() {
    let sum = SKILL_IDS.reduce((a, k) => a + S.sk[k], 0), n = 1;
    if (CO) for (const rh of S.heroes.values()) if (rh.ai || performance.now() - rh.seen < 6000) { sum += SKILL_IDS.reduce((a, k) => a + rh.sk[k], 0); n++; }
    return sum / n;
  }
  function spawnBoss(spec) {
    S.phase = 'boss';
    const kind = BOSS_KINDS[spec.kind] ? spec.kind : 'shadow', K = BOSS_KINDS[kind];
    const hp = Math.round(spec.hp * K.hpK * BOSS_K * (1 + BOSS_PICK_K * Math.min(21, pickCount())) * (1 + 0.6 * (partyN() - 1)));
    const homeY = kind === 'giant' ? S.H * 0.3 : kind === 'doubt' ? S.H * 0.22 : S.H * 0.27;
    S.boss = { n: ++S.bossN, kind, name: K.name, x: S.W / 2, y: -26, hp, max: hp, t: 0, st: 'enter', stT: 1.7, atkT: 2.0, flash: 0, r: K.r, pat: 0, blv: spec.blv || 1, dx: 0, dy: 0, bombed: -1, homeY, alpha: 1, split: 0, tgI: 0, mad: false };
    S.lastBoss = kind;
    S.seen.add('boss_' + kind);
    A.bossIn();
    share('bi');
    S.shake = 4;
  }
  const bossHittable = (B) => B.st !== 'enter' && B.st !== 'down' && B.st !== 'fade';
  // 가짜 가면을 맞히면 펑 하고 사라진다
  function popDecoy(dc) {
    const i = S.decoys.indexOf(dc);
    if (i < 0) return;
    S.decoys.splice(i, 1);
    burst(dc.x, dc.y, '#EDE4FF', 12, 60, 0.45);
    tip(dc.x, dc.y - 12, '가짜!', '#F6C2CF', 0.9, 14);
    A.pop(2);
    if (CL()) { S.decQ.push(dc.id); S.dead.set('d' + dc.id, S.t); return; } // 방장에게 알린다
    S.score += 50;
  }

  // ---------- 갑주 기술 ----------
  function skills(dt, on = true, atk = on) {
    const h = S.hero, sk = on ? S.sk : NO_SK, ak = atk ? sk : NO_SK; // ak: 공격하는 기술 (도전 모드는 움직일 때만)
    // 빛 칼: 가까이 그림자나 구슬이 있으면 휘두른다
    if (ak.sword) {
      S.skT.sword -= dt;
      const R = SWORD_R[sk.sword];
      if (S.skT.sword <= 0) {
        const near = S.foes.some((f) => Math.hypot(f.x - h.x, f.y - h.y) < R + f.r) || S.orbs.some((o) => Math.hypot(o.x - h.x, o.y - h.y) < R)
          || S.decoys.some((d) => Math.hypot(d.x - h.x, d.y - h.y) < R + 6) || (S.boss && bossHittable(S.boss) && Math.hypot(S.boss.x - h.x, S.boss.y - h.y) < R + S.boss.r);
        if (near) {
          S.skT.sword = SWORD_GAP[sk.sword];
          S.slash = { t: 0, R, a0: Math.random() * TAU };
          for (const f of [...S.foes]) { const d = Math.hypot(f.x - h.x, f.y - h.y) || 1; if (d < R + f.r) hitFoe(f, 2, (f.x - h.x) / d, (f.y - h.y) / d); }
          for (const dc of [...S.decoys]) if (Math.hypot(dc.x - h.x, dc.y - h.y) < R + 6) popDecoy(dc);
          for (let i = S.orbs.length - 1; i >= 0; i--) { const o = S.orbs[i]; if (Math.hypot(o.x - h.x, o.y - h.y) < R) { burst(o.x, o.y, '#FFF3B0', 3, 30, 0.25); S.orbs.splice(i, 1); } }
          if (S.boss && bossHittable(S.boss) && Math.hypot(S.boss.x - h.x, S.boss.y - h.y) < R + S.boss.r) hitBoss(2);
          A.slash();
        }
      }
    }
    if (S.slash) { S.slash.t += dt; if (S.slash.t > 0.22) S.slash = null; }
    // 도는 방패: 구슬을 막고, 닿은 그림자를 친다
    if (sk.shield) {
      S.shAng += dt * 3.4;
      S.shBossT = Math.max(0, S.shBossT - dt);
      S.blockT = Math.max(0, S.blockT - dt);
      for (let k = 0; k < sk.shield; k++) {
        const a = S.shAng + (k * TAU) / sk.shield, sx = h.x + Math.cos(a) * 17, sy = h.y + Math.sin(a) * 17;
        for (let i = S.orbs.length - 1; i >= 0; i--) { const o = S.orbs[i]; if (Math.hypot(o.x - sx, o.y - sy) < 5.5) { burst(o.x, o.y, '#BFE6FF', 4, 35, 0.3); S.orbs.splice(i, 1); if (!S.blockT) { A.block(); S.blockT = 0.08; } } }
        for (const f of [...S.foes]) { if (!(f.shT > 0) && Math.hypot(f.x - sx, f.y - sy) < f.r + 4) { f.shT = 0.5; hitFoe(f, 1, Math.cos(a), Math.sin(a)); } }
        for (const dc of [...S.decoys]) if (Math.hypot(dc.x - sx, dc.y - sy) < 9) popDecoy(dc);
        const B = S.boss;
        if (B && !S.shBossT && bossHittable(B) && Math.hypot(B.x - sx, B.y - sy) < B.r + 4) { S.shBossT = 0.6; hitBoss(1); }
      }
    }
    // 빠른 발: 2단계부터 달린 자리에 빛 발자국
    if (sk.shoes >= 2) {
      S.printT -= dt;
      if (S.printT <= 0 && Math.hypot(h.vx, h.vy) > 20) { S.printT = 0.09; const life = sk.shoes >= 3 ? 1.8 : 1.1; S.prints.push({ x: h.x + rnd(-1, 1), y: h.y + 6, life, max: life }); if (S.prints.length > 40) S.prints.shift(); }
    }
    for (let i = S.prints.length - 1; i >= 0; i--) {
      const pr = S.prints[i];
      pr.life -= dt;
      if (pr.life <= 0) { S.prints.splice(i, 1); continue; }
      for (const f of [...S.foes]) if (!(f.prT > 0) && Math.hypot(f.x - pr.x, f.y - pr.y) < f.r + 3) { f.prT = 0.45; hitFoe(f, 1, 0, 0); }
    }
    // 진리의 빛줄기: 가까운 그림자에서 시작해 줄줄이 이어 친다
    if (ak.belt) {
      S.skT.belt -= dt;
      if (S.skT.belt <= 0) {
        const first = nearestFrom(h.x, h.y, 150);
        if (first) {
          S.skT.belt = BELT_GAP[sk.belt];
          const pts = [[h.x, h.y]], hitList = [first];
          let cur = first;
          while (hitList.length < BELT_N[sk.belt]) {
            let nx = null, nd = 58;
            for (const f of S.foes) { if (hitList.includes(f)) continue; const d = Math.hypot(f.x - cur.x, f.y - cur.y); if (d < nd) { nd = d; nx = f; } }
            for (const dc of S.decoys) { if (hitList.includes(dc)) continue; const d = Math.hypot(dc.x - cur.x, dc.y - cur.y); if (d < nd) { nd = d; nx = dc; } }
            if (!nx) break;
            hitList.push(nx);
            cur = nx;
          }
          for (const t of hitList) {
            pts.push([t.x, t.y]);
            if (t === S.boss) hitBoss(1);
            else if (S.decoys.includes(t)) popDecoy(t);
            else hitFoe(t, 2, 0, 0);
          }
          S.chains.push({ pts, life: 0.22 });
          A.chain();
        } else S.skT.belt = 0.2;
      }
    }
    for (let i = S.chains.length - 1; i >= 0; i--) { S.chains[i].life -= dt; if (S.chains[i].life <= 0) S.chains.splice(i, 1); }
    // 사방 빛
    if (ak.helmet) {
      S.skT.helmet -= dt;
      if (S.skT.helmet <= 0 && (S.foes.length || S.decoys.length || (S.boss && bossHittable(S.boss)))) {
        S.skT.helmet = HELM_GAP[sk.helmet];
        const n = HELM_N[sk.helmet], off = Math.random() * TAU;
        for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; S.shots.push({ x: h.x, y: h.y - 2, vx: Math.cos(a) * SHOT_SPEED * 0.85, vy: Math.sin(a) * SHOT_SPEED * 0.85, life: 0.9, pierce: 0, last: null }); }
        burst(h.x, h.y - 6, '#E6EEF2', 8, 40, 0.3);
        A.radial();
      }
    }
    // 지켜 주는 의: 다시 차기
    if (sk.breast && !S.guard) { S.skT.breast -= dt; if (S.skT.breast <= 0) { S.guard = true; tip(h.x, h.y - 14, '✝️ 다시 지켜 줘요', '#FFE58A', 1.0, 13); } }
  }

  // ---------- 맞히기, 물리치기 ----------
  function burst(x, y, col, n = 10, sp = 60, life = 0.5, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.65);
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, c: col, size: size + (Math.random() < 0.3 ? 1 : 0) });
    }
    if (S.parts.length > 420) S.parts.splice(0, S.parts.length - 420);
  }
  function popText(x, y, txt, c = '#FFE58A') { S.pops.push({ x, y, txt, c, life: 0.85 }); }
  function hitFoe(f, dmg, dx, dy) {
    f.hp -= dmg;
    f.flash = 0.08;
    f.x += dx * 2;
    f.y += dy * 2;
    if (CL()) {
      // 친구 화면: 맞힌 것을 방장에게 알리고, 힘이 다 빠지면 내 화면에서 먼저 물리친다 (방장이 곧 같게 맞춘다)
      S.hitQ.set(f.id, (S.hitQ.get(f.id) || 0) + dmg);
      if (f.hp <= 0) {
        const i = S.foes.indexOf(f);
        if (i >= 0) S.foes.splice(i, 1);
        S.dead.set(f.id, S.t);
        killFx(f, FOES[f.kind].pts * S.mult, true);
        return;
      }
    } else if (f.hp <= 0) { kill(f); return; }
    A.hit();
    burst(f.x, f.y, '#FFF3B0', 3, 40, 0.25);
  }
  function kill(f) {
    const i = S.foes.indexOf(f);
    if (i < 0) return;
    S.foes.splice(i, 1);
    const F = FOES[f.kind];
    S.kills++;
    S.combo++;
    S.comboT = 2.6;
    const m = Math.min(5, 1 + Math.floor(S.combo / 6));
    if (m > S.mult) { S.mult = m; A.combo(m); comboPop(m); }
    const pts = F.pts * S.mult;
    S.score += pts;
    killFx(f, pts, true);
    if (f.kind === 'split') for (const s of [-1, 1]) { const c = addFoe('mini', f.x + s * 5, f.y); c.vx = s * 60; c.st = 'chase'; }
  }
  // 그림자가 물러갈 때 보이는 것 (점수 글자, 빛, 소리)과 떨어지는 빛 조각, 하트 (빛 조각과 하트는 화면마다 따로 줍는다)
  function killFx(f, pts, mine) {
    const F = FOES[f.kind];
    popText(f.x, f.y - 7, `+${pts}`);
    burst(f.x, f.y, F.col, 12, 70, 0.55);
    burst(f.x, f.y, '#FFF8D6', 6, 40, 0.35);
    if (mine) { S.stop = Math.max(S.stop, CO ? 0.02 : 0.035); S.shake = Math.max(S.shake, 1.6); }
    A.pop(S.combo > 1 ? Math.min(7, Math.floor(S.combo / 3)) : 0);
    if (Math.random() < (f.kind === 'mini' ? 0.3 : 0.7)) addItem('gem', f.x, f.y);
    if (T.hearts() < 3 && T.alive() && Math.random() < (endless ? 0.025 : 0.05) && !S.items.some((it) => it.kind === 'heart')) addItem('heart', f.x, f.y);
  }
  function comboPop(m) { S.comboPop = { m, life: 1.1 }; }
  function addItem(kind, x, y) {
    const a = Math.random() * TAU;
    S.items.push({ kind, x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: kind === 'heart' ? 12 : 9, t: 0, pull: false });
  }
  function hurtHero(sx, sy, why) {
    const h = S.hero;
    if (h.inv > 0 || !T.alive() || S.god) return;
    // 의의 흉배: 한 번은 지켜 준다
    if (S.guard) {
      S.guard = false;
      S.skT.breast = GUARD_GAP[S.sk.breast];
      h.inv = 1.0;
      burst(h.x, h.y, '#FFE58A', 16, 70, 0.5);
      tip(h.x, h.y - 14, '지켜 줬어요!', '#FFE58A');
      A.guard();
      return;
    }
    if (!T.hurt(why, true)) { h.inv = 0.3; return; }
    h.inv = 1.4;
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1;
    h.vx = (dx / d) * 170;
    h.vy = (dy / d) * 170;
    S.stop = CO && HOST ? 0.05 : 0.12; // 방장 화면은 판 전체가 멈추니 짧게
    S.shake = 6;
    S.flash = 0.35;
    S.flashCol = '#C8283C';
    if (!CO) { S.combo = 0; S.mult = 1; } // 함께 할 때는 모두의 콤보라서 끊지 않는다
    A.hurt();
    burst(h.x, h.y, '#FF8A9A', 10, 60, 0.4);
  }

  // ---------- 기도의 빛 (기도 단추, 다시 일어날 때) ----------
  function onPray() {
    if (!overlay || S.phase === 'ready' || S.phase === 'over' || S.phase === 'won' || S.picking) return;
    if (CO) S.bombQ = [Math.round(S.hero.x), Math.round(S.hero.y)]; // 친구 화면에도 빛 고리가 퍼지고 구슬이 사라진다
    S.bombId++;
    S.bomb = { t: 0, id: S.bombId, x: S.hero.x, y: S.hero.y };
    for (const o of S.orbs) burst(o.x, o.y, '#FFF3B0', 3, 30, 0.3);
    S.orbs.length = 0;
    S.flash = 0.3;
    S.flashCol = '#FFF8D6';
    S.shake = Math.max(S.shake, 4);
    S.hero.inv = Math.max(S.hero.inv, 1.0);
    A.bomb();
    banner('기도의 빛!', '', 0.9, true);
  }
  function onKey(code) {
    if (!overlay) return false;
    if (S.picking) {
      const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[code];
      if (i != null && S.pick && S.pick[i] && S.pickEl && !S.pickEl.querySelector('button').disabled) choose(S.pick[i]);
      return code === 'Space' || code === 'Enter' || i != null;
    }
    if (code === 'Space' || code === 'Enter') { if (T.alive()) { T.pray(); return true; } }
    return false;
  }

  // ---------- 매 화면 ----------
  function update(dt) {
    if (!started) { const t = performance.now() / 1000; ghosts.forEach((g, i) => bobShadow(g, t, i * 1.3)); return; }
    if (!overlay) return;
    dt = Math.min(dt, 0.05);
    S.t += dt;
    const down = !T.alive() && S.phase !== 'over' && S.phase !== 'won';
    const frozen = down && !CO; // 혼자일 때 쓰러지면 판이 멈춘다 (함께 할 때는 친구들이 계속 싸운다)
    const paused = !!(T.paused && T.paused());
    // 판 크기 다시 재기 (쓰러졌거나 끝날 때 큰 단추가 나와도 판은 그대로 둔다)
    layoutT -= dt;
    if (resized || (layoutT <= 0 && !frozen && !S.end)) { layoutT = 0.5; resized = false; relayout(); }
    if (CO) netTick(dt);
    // 창(나갈까요? 같은 것)이 떠 있는 동안은 멈춘다 (함께 할 때는 판은 그대로 가고 내 주인공만 선다)
    if (paused && !CO) { joy.id = null; render(frozen, down); return; }
    if (paused) joy.id = null;
    if (S.stop > 0) S.stop -= dt;
    else if (!frozen && S.phase !== 'over' && !(S.picking && !CO)) sim(dt, !down && !S.picking && !paused);
    if (!frozen) fx(dt);
    if (S.end) {
      S.endT -= dt;
      if (S.endT <= 0) {
        const end = S.end;
        S.end = '';
        exitOverlay();
        if (end === 'won') T.clear();
      }
    }
    if (overlay) render(frozen, down);
  }
  function fx(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life -= dt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.life -= dt; p.y -= dt * 16; if (p.life <= 0) S.pops.splice(i, 1); }
    if (S.comboPop) { S.comboPop.life -= dt; if (S.comboPop.life <= 0) S.comboPop = null; }
    for (let i = S.tips.length - 1; i >= 0; i--) { S.tips[i].life -= dt; if (S.tips[i].life <= 0) S.tips.splice(i, 1); }
    S.shake *= Math.exp(-dt * 10);
    if (S.shake < 0.2) S.shake = 0;
    S.flash = Math.max(0, S.flash - dt);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.dur) S.banner = null; }
  }
  // meOn: 내 주인공이 움직이고 빛을 쏠 수 있다 (쓰러졌거나 기술을 고르는 중이면 아니다)
  function sim(dt, meOn = true) {
    const h = S.hero;
    // 움직이기
    const d = meOn ? steerDir() : { x: 0, y: 0, m: 0 };
    const hs = HERO_SPEED * SHOE_K[S.sk.shoes];
    const tx = d.x * hs * d.m, ty = d.y * hs * d.m;
    const k = 1 - Math.exp(-dt * 16);
    h.vx += (tx - h.vx) * k;
    h.vy += (ty - h.vy) * k;
    h.x = clamp(h.x + h.vx * dt, WALL + 5, S.W - WALL - 5);
    h.y = clamp(h.y + h.vy * dt, WALL + 6, S.H - WALL - 6);
    const sp = Math.hypot(h.vx, h.vy);
    if (sp > 8) { h.walk += dt * (4 + sp / 12); if (Math.abs(h.vy) > Math.abs(h.vx) * 0.8) h.up = h.vy < 0; }
    if (d.m > 0) h.moved += dt;
    // 도전 모드에서는 움직이고 있을 때만 빛을 쏜다 (빛 칼, 진리의 빛줄기, 사방 빛도)
    const atk = meOn && (!endless || d.m > 0.15);
    if (endless && meOn && !atk && (S.phase === 'fight' || S.phase === 'boss') && (S.foes.length || S.boss)) {
      S.stillT += dt;
      if (S.stillT > 1.4 && S.stillTips < 4) { S.stillT = 0; S.stillTips++; tip(h.x, h.y - 15, '움직여야 빛이 나가요!', '#FFE58A', 1.2, 13); }
    } else S.stillT = 0;
    h.inv = Math.max(0, h.inv - dt);
    if (S.hint > 0) S.hint -= dt * (h.moved > 0.6 ? 3 : 1);
    S.power = Math.max(0, S.power - dt);
    if (HOST) {
      S.comboT -= dt;
      if (S.comboT <= 0 && S.combo) { S.combo = 0; S.mult = 1; }
      worldHost(dt);
    } else worldClient(dt);
    // 빛 쏘기: 가까운 그림자에게 저절로
    S.fireT -= dt;
    if (S.fireT <= 0 && S.phase !== 'won') {
      const tg = atk ? nearestFrom(h.x, h.y, 175) : null;
      if (tg) {
        fireFrom(h, tg, false, S.sk.light, S.power > 0);
        A.shoot();
        S.fireT = S.power > 0 ? Math.min(0.17, FIRE_GAP[S.sk.light]) : FIRE_GAP[S.sk.light];
      } else S.fireT = 0.06;
    }
    moveShots(dt);
    if (CO) tickFriends(dt);
    skills(dt, meOn, atk);
    // 어두운 구슬
    for (let i = S.orbs.length - 1; i >= 0; i--) {
      const o = S.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.t += dt;
      if (o.x < WALL - 2 || o.y < WALL - 2 || o.x > S.W - WALL + 2 || o.y > S.H - WALL + 2) { S.orbs.splice(i, 1); continue; }
      if (meOn && Math.hypot(o.x - h.x, o.y - h.y) < 4.5) { S.orbs.splice(i, 1); hurtHero(o.x, o.y, '어두운 구슬에 맞았어요!'); }
    }
    // 부딪히기 (그림자, 큰 그림자)
    if (meOn) {
      for (const f of S.foes) if (Math.hypot(f.x - h.x, f.y - h.y) < f.r + 4) { hurtHero(f.x, f.y, `${FOES[f.kind].name}에게 부딪혔어요!`); break; }
      const B = S.boss;
      if (B && B.st !== 'fade' && B.st !== 'enter' && B.st !== 'down' && Math.hypot(B.x - h.x, B.y - h.y) < B.r + 3) hurtHero(B.x, B.y, `${B.name}에게 부딪혔어요!`);
      // 미움 그림자의 빛줄기
      for (const f of S.foes) if (f.st === 'lzFire' && beamHits(f, h.x, h.y, 5)) { hurtHero(f.x, f.y, '미움 그림자의 빛줄기에 맞았어요!'); break; }
    }
    // 걱정 덩이: 붉은 동그라미가 다 차면 쾅 (모든 화면에서 따로 터지고, 저마다 자기 주인공만 다친다)
    for (let i = S.bombs.length - 1; i >= 0; i--) {
      const bm = S.bombs[i];
      bm.t += dt;
      if (bm.t < bm.dur) continue;
      S.bombs.splice(i, 1);
      S.dead.set('k' + bm.id, S.t);
      burst(bm.x, bm.y, '#FFB050', 18, 90, 0.5);
      burst(bm.x, bm.y, '#5A3010', 10, 50, 0.4, 2);
      S.shake = Math.max(S.shake, 3);
      A.boom();
      if (meOn && Math.hypot(h.x - bm.x, h.y - bm.y) < bm.r + 2) hurtHero(bm.x, bm.y, '걱정 덩이가 터졌어요!');
    }
    // 기도의 빛 고리 (내 기도)
    if (S.bomb) {
      const B = S.bomb;
      B.t += dt;
      const R = (B.t / 0.55) * Math.hypot(S.W, S.H);
      for (const f of [...S.foes]) if (f.bombed !== B.id && Math.hypot(f.x - B.x, f.y - B.y) < R) { f.bombed = B.id; hitFoe(f, 3, 0, 0); }
      if (S.boss && S.boss.bombed !== B.id && bossHittable(S.boss) && Math.hypot(S.boss.x - B.x, S.boss.y - B.y) < R) { S.boss.bombed = B.id; hitBoss(4); }
      for (const dc of [...S.decoys]) if (Math.hypot(dc.x - B.x, dc.y - B.y) < R) popDecoy(dc);
      if (B.t > 0.6) S.bomb = null;
    }
    // 친구의 기도 빛 고리 (보이기만)
    for (let i = S.rings.length - 1; i >= 0; i--) { S.rings[i].t += dt; if (S.rings[i].t > 0.6) S.rings.splice(i, 1); }
    // 빛 조각, 하트
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      it.t += dt;
      it.life -= dt;
      if (it.life <= 0) { S.items.splice(i, 1); continue; }
      const dx = h.x - it.x, dy = h.y - it.y, dd = Math.hypot(dx, dy) || 1;
      if (meOn && it.t > 0.3 && (it.pull || dd < 38)) { const v = it.pull ? 150 : 120; it.vx = (dx / dd) * v; it.vy = (dy / dd) * v; }
      else { it.vx *= 1 - dt * 4; it.vy *= 1 - dt * 4; }
      it.x = clamp(it.x + it.vx * dt, WALL + 3, S.W - WALL - 3);
      it.y = clamp(it.y + it.vy * dt, WALL + 3, S.H - WALL - 3);
      if (meOn && dd < 8 && it.t > 0.15) { S.items.splice(i, 1); pick(it); }
    }
  }
  // 그림자를 움직이는 화면(혼자일 때, 함께 할 때 방장): 물결, 문, 그림자, 가짜 가면, 큰 그림자
  function worldHost(dt) {
    S.hl = heroList();
    if (S.phase === 'prepick') { S.pickT -= dt; if (S.pickT <= 0) openPick(); }
    if (S.phase === 'prepick' || S.phase === 'pick' || S.phase === 'pickwait') S.pickWaitT += dt;
    if (S.phase === 'pickwait') {
      // 친구가 모두 고르면 (20초가 지나면 기다리지 않고) 다음 물결
      const now = performance.now();
      const wait = [...S.heroes.values()].some((rh) => !rh.ai && now - rh.seen < 5000 && rh.pk < S.wave);
      if (!wait || S.pickWaitT > 20) nextWave();
    }
    if (S.phase === 'between') { S.betweenT -= dt; if (S.betweenT <= 0) startWave(); }
    else if (S.phase === 'fight') {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && S.queue.length) {
        const room = S.maxAlive - S.foes.length - S.portals.length;
        for (let i = 0; i < Math.min(2 + (S.pn > 2 ? 1 : 0), room) && S.queue.length; i++) openPortal(S.queue.shift());
        S.spawnT = 0.85 - (lv - 1) * 0.08;
      }
      if (!S.queue.length && !S.foes.length && !S.portals.length) waveDone();
    }
    // 문(그림자가 나오는 소용돌이)
    for (let i = S.portals.length - 1; i >= 0; i--) {
      const p = S.portals[i];
      p.t += dt;
      if (p.t >= p.dur) { S.portals.splice(i, 1); addFoe(p.kind, p.x, p.y); burst(p.x, p.y, '#6A4FB0', 8, 40, 0.35); }
    }
    // 그림자
    for (const f of S.foes) moveFoe(f, dt);
    separate();
    // 거짓 가면의 가짜 가면
    for (let i = S.decoys.length - 1; i >= 0; i--) {
      const dc = S.decoys[i];
      dc.t += dt;
      dc.life -= dt;
      dc.x += Math.cos(dc.t * 1.3 + dc.ph) * 10 * dt;
      dc.y += Math.sin(dc.t * 1.7 + dc.ph) * 6 * dt;
      dc.fireT -= dt;
      if (dc.fireT <= 0 && S.phase === 'boss') { const h = nearestHero(dc.x, dc.y), a = Math.atan2(h.y - dc.y, h.x - dc.x); orb(dc.x, dc.y, Math.cos(a) * 52 * S.mul * BOSS_ORB, Math.sin(a) * 52 * S.mul * BOSS_ORB); dc.fireT = rnd(1.3, 2.1); }
      if (dc.life <= 0 || !S.boss) { burst(dc.x, dc.y, '#B9A6E8', 8, 40, 0.4); S.decoys.splice(i, 1); }
    }
    // 큰 그림자
    if (S.boss) moveBoss(S.boss, dt);
    // 도전 모드를 함께 할 때: 모두 쓰러지면 (일으켜 줄 친구가 없으면) 끝
    if (CO && endless && S.phase !== 'over' && S.phase !== 'ready') {
      const now = performance.now();
      const up = T.alive() || [...S.heroes.values()].some((rh) => !rh.ai && !rh.f && now - rh.seen < 6000);
      if (!up && !(CO.canRevive && CO.canRevive())) { S.allDownT += dt; if (S.allDownT > 1.2 && T.over) T.over(); }
      else S.allDownT = 0;
    }
  }
  // 친구 화면: 방장이 보낸 판 모습을 부드럽게 따라간다 (그림자는 받은 빠르기로 조금 앞을 내다본다)
  function worldClient(dt) {
    const now = performance.now();
    if (S.prepickT > 0) { S.prepickT -= dt; if (S.prepickT <= 0 && S.phase === 'pickhost' && S.myPk < S.wave && !S.picking) openPick(); }
    for (const p of S.portals) p.t = Math.min(p.dur, p.t + dt);
    const k = Math.min(1, dt * 12);
    for (const f of S.foes) {
      f.t += dt;
      f.flash = Math.max(0, f.flash - dt);
      if (f.shT > 0) f.shT -= dt;
      if (f.prT > 0) f.prT -= dt;
      if ((f.st === 'lzAim' || f.st === 'lzFire') && f.stT > 0) { f.stT -= dt; if (f.st === 'lzFire' && f.stT <= 0) f.st = 'roam'; } // 빛줄기는 정해진 시간만
      const age = Math.min(0.3, (now - f.sat) / 1000);
      f.x += (clamp(f.sx + f.svx * age, WALL + f.r, S.W - WALL - f.r) - f.x) * k;
      f.y += (clamp(f.sy + f.svy * age, WALL + f.r, S.H - WALL - f.r) - f.y) * k;
      f.vx = f.svx; f.vy = f.svy;
    }
    for (const dc of S.decoys) { dc.t += dt; dc.x += (dc.sx - dc.x) * k; dc.y += (dc.sy - dc.y) * k; }
    const B = S.boss;
    if (B) {
      B.t += dt;
      B.flash = Math.max(0, B.flash - dt);
      const age = Math.min(0.3, (now - B.sat) / 1000);
      B.x += (B.sx + B.svx * age - B.x) * k;
      B.y += (B.sy + B.svy * age - B.y) * k;
      if (B.st === 'down' && Math.random() < dt * 14) { const x = B.x + rnd(-14, 14), y = B.y + rnd(-12, 12); burst(x, y, Math.random() < 0.5 ? '#FFF3B0' : '#9A82E0', 10, 80, 0.5); S.shake = Math.max(S.shake, 3); }
    }
    for (const [id, t0] of S.dead) if (S.t - t0 > 3) S.dead.delete(id);
  }
  // 빛 한 번 쏘기 (cos: 친구 빛을 내 화면에서 보여 주기만 한다)
  function fireFrom(src, tg, cos, light, power) {
    const a = Math.atan2(tg.y - src.y, tg.x - src.x);
    const n = power ? [-0.22, 0, 0.22] : [0];
    // 말씀의 빛 더하기: 2단계부터 하나 더 뚫고, 3단계는 두 줄
    const lanes = light >= 3 ? [-2.5, 2.5] : [0], pierce = light >= 2 ? 1 : 0;
    for (const o of n) for (const ln of lanes) {
      const px = -Math.sin(a) * ln, py = Math.cos(a) * ln;
      S.shots.push({ x: src.x + Math.cos(a) * 5 + px, y: src.y - 2 + Math.sin(a) * 5 + py, vx: Math.cos(a + o) * SHOT_SPEED, vy: Math.sin(a + o) * SHOT_SPEED, life: 1.0, pierce, last: null, cos });
    }
  }
  function moveShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < WALL || s.y < WALL || s.x > S.W - WALL || s.y > S.H - WALL) { if (s.life > 0) burst(s.x, s.y, '#FFE58A', 2, 25, 0.2); S.shots.splice(i, 1); continue; }
      const dx = s.vx / SHOT_SPEED, dy = s.vy / SHOT_SPEED;
      let hit = null;
      for (const f of S.foes) { if (f !== s.last && Math.hypot(f.x - s.x, f.y - s.y) < f.r + 2) { hit = f; if (!s.cos) hitFoe(f, 1, dx, dy); break; } }
      if (!hit) for (const dc of S.decoys) { if (Math.hypot(dc.x - s.x, dc.y - s.y) < 11) { hit = dc; if (!s.cos) popDecoy(dc); break; } }
      if (!hit && S.boss && S.boss !== s.last && bossHittable(S.boss) && Math.hypot(S.boss.x - s.x, S.boss.y - s.y) < S.boss.r + 2) { hit = S.boss; if (!s.cos) hitBoss(1); }
      if (!hit) continue;
      if (s.cos) { burst(s.x, s.y, '#FFE58A', 2, 25, 0.2); S.shots.splice(i, 1); continue; }
      if (s.pierce > 0 && hit !== S.boss) { s.pierce--; s.last = hit; } else S.shots.splice(i, 1);
    }
    if (S.shots.length > 160) S.shots.splice(0, S.shots.length - 160);
  }
  function pick(it) {
    if (it.kind === 'heart') {
      if (T.hearts() < 3) T.heal();
      A.heart();
      popText(it.x, it.y - 6, '+', '#FF8A9A');
      burst(it.x, it.y, '#FF8A9A', 8, 40, 0.4);
      return;
    }
    if (CL()) S.gemQ++; else S.score += 10; // 함께 할 때 점수는 방장 화면이 센다
    A.gem();
    burst(it.x, it.y, '#FFE58A', 4, 30, 0.3);
    if (S.power > 0) return;
    S.gauge++;
    if (S.gauge >= GAUGE_MAX) {
      S.gauge = 0;
      S.power = POWER_TIME;
      A.power();
      banner('말씀의 빛이 세졌어요!', '세 줄기 빛이 나가요', 1.2, true);
    }
  }
  // (x, y)에서 가장 가까운 그림자, 가짜 가면, 큰 그림자
  function nearestFrom(x, y, range) {
    let best = null, bd = range;
    for (const f of S.foes) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
    for (const dc of S.decoys) { const d = Math.hypot(dc.x - x, dc.y - y) - 6; if (d < bd) { bd = d; best = dc; } }
    const B = S.boss;
    if (B && bossHittable(B)) { const d = Math.hypot(B.x - x, B.y - y) - B.r; if (d < bd) best = B; }
    return best;
  }
  // 그림자가 노리는 주인공들 (쓰러지지 않은 나와 친구. 방장 화면만 쓴다)
  function heroList() {
    const out = [];
    if (T.alive()) out.push(S.hero);
    if (CO) { const now = performance.now(); for (const rh of S.heroes.values()) if (!rh.f && (rh.ai || now - rh.seen < 6000)) out.push(rh); }
    return out.length ? out : [S.hero];
  }
  function nearestHero(x, y) {
    const hs = S.hl || heroList();
    let best = hs[0], bd = Infinity;
    for (const h of hs) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  // 함께 하는 사람 수 (나 + 최근에 소식이 온 친구 + 예시 친구)
  function partyN() {
    if (!CO) return 1;
    const now = performance.now();
    let n = 1, humans = 1;
    for (const rh of S.heroes.values()) if (rh.ai || now - rh.seen < 6000) { n++; if (!rh.ai) humans++; }
    S.partyMax = Math.max(S.partyMax, humans);
    return Math.min(4, n);
  }
  // 어두운 구슬 하나 (방장이면 친구들에게도 보낸다)
  function orb(x, y, vx, vy) {
    S.orbs.push({ x, y, vx, vy, t: 0 });
    if (CO && HOST) S.newOrbs.push(r1(x), r1(y), Math.round(vx), Math.round(vy), +S.t.toFixed(2));
  }
  // 소리, 흔들림, 떠오르는 말을 친구 화면에도 (방장만)
  function share(code, ...a) { if (CO && HOST) S.fxq.push([code, ...a]); }
  // 걱정 덩이 하나 (방장 화면에서 만들어 친구 화면에도 보낸다)
  function addBomb(x, y, dur = BOMB_T, id = null, t = 0) {
    const bm = { id: id != null ? id : ++S.kid, x, y, r: BOMB_R, t, dur };
    S.bombs.push(bm);
    return bm;
  }
  // 미움 그림자의 빛줄기가 (x, y)에 닿는지 (그림자에서 빛줄기 쪽으로만)
  function beamHits(f, x, y, w) {
    const cx = Math.cos(f.la || 0), cy = Math.sin(f.la || 0), px = x - f.x, py = y - f.y;
    const along = px * cx + py * cy;
    return along > 0 && Math.abs(px * cy - py * cx) < w;
  }
  function moveFoe(f, dt) {
    const F = FOES[f.kind], h = nearestHero(f.x, f.y), spd = F.spd * S.mul;
    f.t += dt;
    f.flash = Math.max(0, f.flash - dt);
    if (f.shT > 0) f.shT -= dt;
    if (f.prT > 0) f.prT -= dt;
    const dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (f.kind === 'wisp' || f.kind === 'mini' || f.kind === 'split') {
      const wob = Math.sin(f.t * 3) * 0.5;
      const ax = ux - uy * wob, ay = uy + ux * wob;
      f.vx += (ax * spd - f.vx) * Math.min(1, dt * 2.5);
      f.vy += (ay * spd - f.vy) * Math.min(1, dt * 2.5);
    } else if (f.kind === 'dasher') {
      f.stT -= dt;
      if (f.st === 'roam' || f.st === 'chase') {
        f.vx += (ux * spd + Math.cos(f.t) * 8 - f.vx) * Math.min(1, dt * 2);
        f.vy += (uy * spd + Math.sin(f.t * 1.3) * 8 - f.vy) * Math.min(1, dt * 2);
        if (f.stT <= 0 && d < 150) { f.st = 'aim'; f.stT = 0.6; A.warn(); share('wr'); }
      } else if (f.st === 'aim') {
        f.vx *= 0.8; f.vy *= 0.8;
        f.dx = ux; f.dy = uy;
        if (f.stT <= 0) { f.st = 'dash'; f.stT = 0.5; }
      } else if (f.st === 'dash') {
        f.vx = f.dx * 150 * S.mul;
        f.vy = f.dy * 150 * S.mul;
        if (f.stT <= 0) { f.st = 'rest'; f.stT = 0.45; }
      } else if (f.st === 'rest') {
        f.vx *= 0.85; f.vy *= 0.85;
        if (f.stT <= 0) { f.st = 'roam'; f.stT = rnd(1.2, 2.3); }
      }
    } else if (f.kind === 'shooter') {
      const want = d < 72 ? -1 : d > 108 ? 1 : 0;
      const side = Math.sin(f.t * 0.7) > 0 ? 1 : -1;
      f.vx += ((ux * want - uy * side * 0.6) * spd - f.vx) * Math.min(1, dt * 2);
      f.vy += ((uy * want + ux * side * 0.6) * spd - f.vy) * Math.min(1, dt * 2);
      f.fireT -= dt;
      if (f.fireT <= 0) {
        const n = lv >= 3 || (endless && S.wave >= 12) ? [-0.18, 0.18] : [0];
        for (const o of n) { const a = Math.atan2(dy, dx) + o; orb(f.x, f.y, Math.cos(a) * 58 * S.mul, Math.sin(a) * 58 * S.mul); }
        A.zap();
        share('z');
        f.fireT = Math.max(1.4, 2.4 - (lv - 1) * 0.25 - (endless ? S.wave * 0.03 : 0));
      }
    } else if (f.kind === 'laser') {
      // 미움 그림자: 멀찍이 빙 돌다가 붉은 선으로 겨누고(1.1초, 마지막 0.3초는 방향이 굳는다) 빛줄기를 쏜다(0.45초)
      if (f.st === 'lzAim') {
        f.vx *= 0.8; f.vy *= 0.8;
        f.stT -= dt;
        const tg = f.tg && (f.tg === S.hero ? T.alive() : !f.tg.f) ? f.tg : h;
        if (f.stT > 0.3) f.la = Math.atan2(tg.y - f.y, tg.x - f.x);
        if (f.stT <= 0) { f.st = 'lzFire'; f.stT = 0.45; A.laser(); share('lz'); S.shake = Math.max(S.shake, 2); }
      } else if (f.st === 'lzFire') {
        f.vx = 0; f.vy = 0;
        f.stT -= dt;
        if (f.stT <= 0) { f.st = 'roam'; f.stT = rnd(2.4, 3.4) * Math.max(0.7, 1 - (S.wave - STRONG_FROM) * 0.012); }
      } else {
        const want = d < 95 ? -1 : d > 135 ? 1 : 0, side = Math.sin(f.t * 0.6) > 0 ? 1 : -1;
        f.vx += ((ux * want - uy * side * 0.7) * spd - f.vx) * Math.min(1, dt * 2);
        f.vy += ((uy * want + ux * side * 0.7) * spd - f.vy) * Math.min(1, dt * 2);
        f.stT -= dt;
        if (f.stT <= 0 && d < 230) { f.st = 'lzAim'; f.stT = 1.1; f.tg = h; f.la = Math.atan2(dy, dx); A.warn(); share('wr'); }
      }
    } else if (f.kind === 'bomber') {
      // 걱정 그림자: 떨어져 맴돌다가 주인공 자리와 둘레에 걱정 덩이 셋을 떨어뜨린다
      const want = d < 80 ? -1 : d > 125 ? 1 : 0, side = Math.sin(f.t * 0.8) > 0 ? 1 : -1;
      f.vx += ((ux * want - uy * side * 0.6) * spd - f.vx) * Math.min(1, dt * 2);
      f.vy += ((uy * want + ux * side * 0.6) * spd - f.vy) * Math.min(1, dt * 2);
      f.fireT -= dt;
      if (f.fireT <= 0 && d < 220) {
        const n = S.wave >= STRONG_FROM + 8 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const ox = i ? rnd(-26, 26) : h.vx * 0.35, oy = i ? rnd(-26, 26) : h.vy * 0.35; // 첫 덩이는 가는 쪽을 내다보고 떨어진다
          addBomb(clamp(h.x + ox, WALL + 8, S.W - WALL - 8), clamp(h.y + oy, WALL + 8, S.H - WALL - 8), BOMB_T + i * 0.12);
        }
        A.drop(); share('dr');
        f.fireT = rnd(3.0, 4.0) * Math.max(0.7, 1 - (S.wave - STRONG_FROM) * 0.012);
      }
    } else if (f.kind === 'pride') {
      // 교만 그림자: 느리게 다가오며 둘레로 구슬 고리를 뿜는다 (힘이 반 아래면 더 촘촘히)
      f.vx += (ux * spd - f.vx) * Math.min(1, dt * 1.5);
      f.vy += (uy * spd - f.vy) * Math.min(1, dt * 1.5);
      f.fireT -= dt;
      if (f.fireT <= 0) {
        const n = f.hp < f.max / 2 ? 12 : 10, off = Math.random() * TAU;
        for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; orb(f.x, f.y, Math.cos(a) * 44 * S.mul, Math.sin(a) * 44 * S.mul); }
        A.zap(); share('z');
        f.fireT = rnd(2.6, 3.4);
      }
    }
    f.x = clamp(f.x + f.vx * dt, WALL + f.r, S.W - WALL - f.r);
    f.y = clamp(f.y + f.vy * dt, WALL + f.r, S.H - WALL - f.r);
  }
  function separate() {
    const a = S.foes;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const p = a[i], q = a[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), m = p.r + q.r;
      if (d > 0.01 && d < m) { const k = (m - d) / 2 / d; p.x -= dx * k; p.y -= dy * k; q.x += dx * k; q.y += dy * k; }
    }
  }
  function hitBoss(dmg) {
    const B = S.boss;
    if (!B || !bossHittable(B)) return;
    B.hp -= dmg;
    B.flash = 0.07;
    burst(B.x + rnd(-6, 6), B.y + rnd(-6, 6), '#FFF3B0', 3, 50, 0.3);
    if (S.t - S.lastBossHit > 0.07) { A.bossHit(); S.lastBossHit = S.t; }
    if (CL()) { S.bossQ += dmg; B.hp = Math.max(1, B.hp); return; } // 큰 그림자가 물러가는 것은 방장 화면이 정한다
    // 힘이 3분의 1 아래로 내려가면 화가 나서 더 세진다
    if (!B.mad && B.hp > 0 && B.hp < B.max / 3) { B.mad = true; tip(B.x, B.y - B.r - 10, '더 세졌어요! 조심!', '#FF9AA8', 1.3, 15); share('tp', r1(B.x), r1(B.y - B.r - 10), '더 세졌어요! 조심!', '#FF9AA8', 1.3, 15); }
    // 의심 구름: 힘이 2/3, 1/3 아래로 내려가면 의심 그림자를 떨어뜨리며 작아진다
    if (B.kind === 'doubt' && B.hp > 0) {
      const want = B.hp < B.max / 3 ? 2 : B.hp < (B.max * 2) / 3 ? 1 : 0;
      while (B.split < want) {
        B.split++;
        B.r -= 2;
        for (const sd of [-1, 1]) { const f = addFoe('split', clamp(B.x + sd * 12, WALL + 8, S.W - WALL - 8), clamp(B.y + 10, WALL + 8, S.H - WALL - 8)); f.vx = sd * 50; }
        burst(B.x, B.y, '#8FB8C0', 18, 80, 0.6);
        tip(B.x, B.y - 22, '구름이 나뉘었어요!', '#CDEFF5', 1.1, 14);
        share('tp', r1(B.x), r1(B.y - 22), '구름이 나뉘었어요!', '#CDEFF5', 1.1, 14);
        S.shake = Math.max(S.shake, 3);
      }
    }
    if (B.hp <= 0) {
      B.hp = 0;
      B.st = 'down';
      B.stT = 1.7;
      B.alpha = 1;
      B.spiral = null;
      B.rain = null;
      S.orbs.length = 0;
      S.portals.length = 0;
      const pts = (endless ? 2000 + S.wave * 200 : 2000 + lv * 1000) * S.mult;
      S.score += pts;
      popText(B.x, B.y - 18, `+${pts}`, '#FFF8D6');
      A.bossDown();
      share('bd', r1(B.x), r1(B.y), pts);
      S.shake = 6;
      // 남은 작은 그림자와 가짜 가면도 함께 흩어진다
      for (const f of [...S.foes]) kill(f);
      for (const dc of [...S.decoys]) popDecoy(dc);
    }
  }
  function moveBoss(B, dt) {
    const h = nearestHero(B.x, B.y);
    B.t += dt;
    B.flash = Math.max(0, B.flash - dt);
    if (B.st === 'enter') {
      B.stT -= dt;
      B.y += (B.homeY - B.y) * Math.min(1, dt * 2.2);
      if (B.stT <= 0) { B.st = 'move'; B.t = 0; }
      return;
    }
    if (B.st === 'down') {
      B.stT -= dt;
      if (Math.random() < dt * 14) { const x = B.x + rnd(-14, 14), y = B.y + rnd(-12, 12); burst(x, y, Math.random() < 0.5 ? '#FFF3B0' : '#9A82E0', 10, 80, 0.5); S.shake = Math.max(S.shake, 3); }
      if (B.stT <= 0) {
        bossGone(B);
        S.boss = null;
        waveDone();
      }
      return;
    }
    const mx = Math.max(0, S.W / 2 - 38);
    if (B.st === 'move') {
      if (B.kind === 'giant') {
        // 두려움 거인은 쿵쿵 걸어서 다가온다
        const dx = h.x - B.x, dy = h.y - B.y, d = Math.hypot(dx, dy) || 1, sp = (16 + B.blv * 3) * S.mul * (B.mad ? 1.25 : 1);
        if (d > B.r + 18) { B.x += (dx / d) * sp * dt; B.y += (dy / d) * sp * dt; }
        B.x = clamp(B.x, WALL + B.r, S.W - WALL - B.r);
        B.y = clamp(B.y, WALL + B.r, S.H - WALL - B.r);
      } else {
        const sp = (B.kind === 'doubt' ? 0.7 : B.kind === 'accuser' ? 0.4 : 0.55) * (B.mad ? 1.3 : 1);
        const pathX = S.W / 2 + Math.sin(B.t * sp) * mx, pathY = B.homeY + Math.sin(B.t * 1.1) * Math.min(B.kind === 'doubt' ? 8 : 20, S.H * 0.08);
        B.x += (pathX - B.x) * Math.min(1, dt * 2.5);
        B.y += (pathY - B.y) * Math.min(1, dt * 2.5);
      }
      B.atkT -= dt;
      if (B.atkT <= 0 && !B.spiral && !B.rain) attack(B);
    } else if (B.st === 'aim') {
      B.stT -= dt;
      const tg = B.tg || h, dx = tg.x - B.x, dy = tg.y - B.y, d = Math.hypot(dx, dy) || 1;
      B.dx = dx / d; B.dy = dy / d;
      if (B.stT <= 0) { B.st = 'charge'; B.stT = 0.85; }
    } else if (B.st === 'charge') {
      B.stT -= dt;
      B.x += B.dx * 145 * dt;
      B.y += B.dy * 145 * dt;
      const out = B.x < WALL + B.r || B.x > S.W - WALL - B.r || B.y < WALL + B.r || B.y > S.H - WALL - B.r;
      B.x = clamp(B.x, WALL + B.r, S.W - WALL - B.r);
      B.y = clamp(B.y, WALL + B.r, S.H - WALL - B.r);
      if (B.stT <= 0 || out) { B.st = 'move'; S.shake = Math.max(S.shake, out ? 3 : 1); }
    } else if (B.st === 'stompAim') {
      B.stT -= dt;
      if (B.stT <= 0) { stomp(B); B.st = 'move'; if (B.mad || B.blv >= 3) B.stomp2 = 0.5; } // 화가 나면 두 번 쿵
    } else if (B.st === 'fade') {
      // 거짓 가면: 사라졌다가 다른 곳에서 나타난다 (사라진 동안은 맞지 않는다)
      B.stT -= dt;
      B.alpha = Math.max(0, B.stT / 0.4);
      if (B.stT <= 0) {
        B.x = rnd(WALL + 26, S.W - WALL - 26);
        B.y = rnd(WALL + 22, Math.max(WALL + 24, S.H * 0.45));
        B.st = 'appear';
        B.stT = 0.4;
      }
    } else if (B.st === 'appear') {
      B.stT -= dt;
      B.alpha = 1 - Math.max(0, B.stT / 0.4);
      if (B.stT <= 0) {
        B.st = 'move'; B.alpha = 1; B.homeY = B.y;
        // 나타나자마자 가까운 주인공에게 구슬 셋
        const a0 = Math.atan2(h.y - B.y, h.x - B.x);
        for (let i = -1; i <= 1; i++) orb(B.x, B.y, Math.cos(a0 + i * 0.3) * 60 * S.mul * BOSS_ORB, Math.sin(a0 + i * 0.3) * 60 * S.mul * BOSS_ORB);
        A.zap(); share('z');
      }
    }
    if (B.stomp2 > 0) { B.stomp2 -= dt; if (B.stomp2 <= 0) { B.stomp2 = 0; stomp(B, true); } }
    // 참소하는 그림자의 빙글빙글 구슬 (2단계부터 세 갈래)
    if (B.spiral) {
      const sp = B.spiral;
      sp.t -= dt;
      sp.e -= dt;
      const arms = B.blv >= 2 || B.mad ? 3 : 2;
      while (sp.e <= 0 && sp.t > 0) {
        for (let k = 0; k < arms; k++) { const a = sp.a + (k * TAU) / arms; orb(B.x, B.y, Math.cos(a) * 50 * S.mul * BOSS_ORB, Math.sin(a) * 50 * S.mul * BOSS_ORB); }
        sp.a += 0.4 * sp.dir;
        sp.e += 0.085 - (B.blv - 1) * 0.008;
      }
      if (sp.t <= 0) B.spiral = null;
    }
    // 의심 구름의 비
    if (B.rain) {
      const rn = B.rain;
      rn.e -= dt;
      if (rn.e <= 0 && rn.n > 0) {
        const tg = S.hl[Math.floor(Math.random() * S.hl.length)] || h;
        const drops = B.mad ? 2 : 1;
        for (let q = 0; q < drops; q++) {
          const x = clamp(Math.random() < 0.55 ? tg.x + rnd(-36, 36) : rnd(WALL + 6, S.W - WALL - 6), WALL + 4, S.W - WALL - 4);
          orb(x, B.y + 8, 0, 64 * S.mul * BOSS_ORB);
        }
        rn.n--;
        rn.e = 0.11;
        if (rn.n % 3 === 0) { A.zap(); share('z'); }
      }
      if (rn.n <= 0) B.rain = null;
    }
  }
  // 큰 그림자가 물러간 뒤: 빛이 터지고 빛 조각이 쏟아진다 (모든 화면에서 따로)
  function bossGone(B) {
    burst(B.x, B.y, '#FFF8D6', 40, 140, 0.9, 2);
    S.flash = 0.45;
    S.flashCol = '#FFF8D6';
    for (let i = 0; i < 10; i++) addItem('gem', B.x + rnd(-8, 8), B.y + rnd(-8, 8));
    if (endless) { if (T.alive()) addItem('heart', B.x, B.y); tip(B.x, B.y - 20, BOSS_KINDS[B.kind].down, '#FFF3B0', 1.6, 16); }
    for (const it of S.items) it.pull = true;
  }
  // 두려움 거인이 쿵! 하면 구슬 고리가 퍼진다 (빈틈으로 피한다)
  function stomp(B, second = false) {
    const n = 28, gap = B.blv >= 3 ? 3 : 4, g0 = Math.floor(Math.random() * n), off = second ? Math.PI / n : 0;
    for (let i = 0; i < n; i++) {
      if ((i - g0 + n) % n < gap) continue;
      const a = (i / n) * TAU + off;
      orb(B.x + Math.cos(a) * (B.r - 4), B.y + Math.sin(a) * (B.r - 4), Math.cos(a) * 52 * S.mul * BOSS_ORB, Math.sin(a) * 52 * S.mul * BOSS_ORB);
    }
    S.shake = 7;
    A.stomp();
    burst(B.x, B.y + B.r, '#8E7A9E', 16, 70, 0.5);
    share('st', r1(B.x), r1(B.y), B.r);
  }
  function attack(B) {
    const low = B.hp < B.max / 2, blv = B.blv, mul = S.mul * BOSS_ORB;
    // 노릴 주인공: 함께 할 때는 돌아가며 노린다
    const hs = S.hl && S.hl.length ? S.hl : [S.hero];
    const h = hs[(B.tgI++) % hs.length];
    const CYC = {
      shadow: blv >= 2 || low ? ['burst', 'aimed', 'summon', 'burst', 'charge', 'aimed'] : ['burst', 'aimed', 'summon', 'aimed', 'charge'],
      doubt: ['rain', 'aimed', 'burst', 'rain', 'aimed'],
      mask: ['decoy', 'aimed', 'teleport', 'aimed', 'burst', 'teleport'],
      giant: blv >= 2 || low ? ['stomp', 'roar', 'stomp', 'charge', 'aimed'] : ['stomp', 'aimed', 'stomp', 'roar', 'charge'],
      accuser: ['spiral', 'words', 'aimed', 'spiral', 'shooters', 'burst'],
    };
    const cycle = CYC[B.kind] || CYC.shadow;
    const pat = cycle[B.pat++ % cycle.length];
    if (pat === 'burst') {
      // 화가 나면 두 겹
      const n = 14 + blv * 2, off = B.pat * 0.37;
      for (const ring of B.mad ? [0, 1] : [0]) for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU + ring * (Math.PI / n), v = 48 * mul * (ring ? 0.78 : 1); orb(B.x, B.y, Math.cos(a) * v, Math.sin(a) * v); }
      A.zap(); share('z');
    } else if (pat === 'aimed') {
      const base = Math.atan2(h.y - B.y, h.x - B.x), n = blv >= 3 || B.mad ? 7 : 5;
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.24; orb(B.x, B.y, Math.cos(a) * 70 * mul, Math.sin(a) * 70 * mul); }
      A.zap(); share('z');
    } else if (pat === 'summon') {
      const n = Math.min(3 + (blv > 1 ? 1 : 0), Math.max(0, S.maxAlive - S.foes.length - S.portals.length));
      for (let i = 0; i < n; i++) openPortal(strongNow() && i === 1 ? STRONG[(B.pat + i) % STRONG.length] : i >= 2 && blv >= 2 ? 'dasher' : 'wisp', { x: clamp(B.x + (i - 1.5) * 20, WALL + 10, S.W - WALL - 10), y: clamp(B.y + 18, WALL + 10, S.H - WALL - 10) });
    } else if (pat === 'shooters') {
      const n = Math.min(blv >= 2 ? 3 : 2, Math.max(0, S.maxAlive - S.foes.length - S.portals.length));
      for (let i = 0; i < n; i++) openPortal(strongNow() && i === 0 ? 'laser' : 'shooter', { x: clamp(B.x + (i - (n - 1) / 2) * 30, WALL + 10, S.W - WALL - 10), y: clamp(B.y + 14, WALL + 10, S.H - WALL - 10) });
    } else if (pat === 'charge') {
      B.st = 'aim';
      B.stT = 0.65;
      B.tg = h;
      A.warn(); share('wr');
    } else if (pat === 'rain') {
      B.rain = { n: 12 + blv * 3, e: 0.2 };
    } else if (pat === 'decoy') {
      // 진짜와 가짜 둘이 자리를 바꾼다
      const spots = [0.25, 0.5, 0.75].map((k) => ({ x: WALL + 20 + (S.W - 2 * WALL - 40) * k, y: rnd(WALL + 22, Math.max(WALL + 24, S.H * 0.4)) }));
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      B.x = spots[0].x; B.y = spots[0].y; B.homeY = B.y;
      S.decoys = spots.slice(1).map((p) => ({ id: ++S.did, x: p.x, y: p.y, t: 0, ph: Math.random() * TAU, life: 9, fireT: rnd(1.0, 1.8) }));
      for (const p of spots) burst(p.x, p.y, '#B9A6E8', 12, 60, 0.4);
      A.tele(); share('tl');
    } else if (pat === 'teleport') {
      B.st = 'fade';
      B.stT = 0.4;
      A.tele(); share('tl');
    } else if (pat === 'stomp') {
      B.st = 'stompAim';
      B.stT = 0.6;
      A.warn(); share('wr');
    } else if (pat === 'roar') {
      // 크게 울부짖으면 모두 뒤로 밀려나고, 두려움 그림자가 나온다
      roarPush(B.x, B.y);
      for (const rh of S.heroes.values()) if (rh.ai) { const dx = rh.x - B.x, dy = rh.y - B.y, d = Math.hypot(dx, dy) || 1; rh.vx += (dx / d) * 150; rh.vy += (dy / d) * 150; }
      share('ro', r1(B.x), r1(B.y));
      tip(B.x, B.y - B.r - 8, '쿠아앙!', '#F6C2CF', 1.0, 18);
      const n = Math.min(3, Math.max(0, S.maxAlive - S.foes.length - S.portals.length));
      for (let i = 0; i < n; i++) openPortal(strongNow() ? ['bomber', 'laser', 'dasher'][i] : 'dasher', { x: clamp(B.x + (i - 1) * 26, WALL + 10, S.W - WALL - 10), y: clamp(B.y + 10, WALL + 10, S.H - WALL - 10) });
    } else if (pat === 'spiral') {
      B.spiral = { t: 2.8, e: 0, a: Math.random() * TAU, dir: Math.random() < 0.5 ? 1 : -1 };
      A.warn(); share('wr');
    } else if (pat === 'words') {
      // 참소하는 말: 말풍선이 뜨고 그 자리에서 구슬이 나온다
      const w = ACCUSE_WORDS[Math.floor(Math.random() * ACCUSE_WORDS.length)];
      tip(B.x, B.y - B.r - 8, w, '#FF9AA8', 1.6, 16);
      share('tp', r1(B.x), r1(B.y - B.r - 8), w, '#FF9AA8', 1.6, 16);
      const base = Math.atan2(h.y - B.y, h.x - B.x);
      for (let i = 0; i < 5; i++) { const a = base + (i - 2) * 0.28; orb(B.x, B.y, Math.cos(a) * 60 * mul, Math.sin(a) * 60 * mul); }
      A.zap(); share('z');
    }
    // 더 자주 공격한다 (힘이 반 아래면 더, 3분의 1 아래면 더더). 함께 하면 사람이 많을수록 조금 더 자주
    const base = { shadow: 2.4, doubt: 2.5, mask: 2.3, giant: 2.7, accuser: 2.9 }[B.kind] || 2.4;
    B.atkT = Math.max(0.9, (base - 0.5 - (low ? 0.55 : 0) - (B.mad ? 0.3 : 0) - (blv - 1) * 0.15) * (1 - 0.06 * (S.pn - 1)));
  }
  // 도전 모드 물결 20부터는 큰 그림자도 센 그림자를 데려온다
  function strongNow() { return endless && S.wave >= STRONG_FROM; }
  // 울부짖음에 내 주인공이 밀려난다
  function roarPush(bx, by) {
    const h = S.hero, dx = h.x - bx, dy = h.y - by, d = Math.hypot(dx, dy) || 1;
    S.shake = 6;
    A.roar();
    if (!T.alive()) return;
    h.vx += (dx / d) * 150;
    h.vy += (dy / d) * 150;
  }

  // ---------- 함께 하기 ----------
  const skStr = (sk) => SKILL_IDS.map((k) => sk[k] | 0).join('');
  function skOf(str) { const o = {}; SKILL_IDS.forEach((k, i) => { o[k] = clamp(Number(String(str || '')[i]) || 0, 0, 3); }); return o; }
  // 친구 주인공 하나 (처음 소식이 오면 만든다)
  function friend(id) {
    let rh = S.heroes.get(id);
    if (!rh) {
      const slot = clamp(CO.slot(id), 0, 3);
      rh = { id, slot: slot < 0 ? 1 : slot, name: CO.name(id), ai: false, x: S.W / 2, y: S.H * 0.7, vx: 0, vy: 0, tx: S.W / 2, ty: S.H * 0.7, at: 0, up: false, walk: 0,
        f: false, hp: 3, sk: skOf(''), pk: 0, fireT: 0.5, shAng: Math.random() * TAU, slT: 0.5, slash: null, side: Math.random() < 0.5 ? 1 : -1, fresh: true, seen: performance.now(), direct: 0 };
      S.heroes.set(id, rh);
    }
    return rh;
  }
  // 예시 친구 (체험판): 방장 화면이 움직이고, 빛도 진짜로 쏜다
  function addBot(id) {
    const rh = friend(id);
    rh.ai = true;
    rh.fresh = false;
    rh.x = rh.tx = S.W * (0.3 + 0.13 * rh.slot);
    rh.y = rh.ty = S.H * 0.72;
  }
  function applyHero(rh, m, now) {
    const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
    rh.tx = clamp(num(m.x, rh.tx), 0, S.W);
    rh.ty = clamp(num(m.y, rh.ty), 0, S.H);
    rh.vx = clamp(num(m.vx), -320, 320);
    rh.vy = clamp(num(m.vy), -320, 320);
    rh.up = m.u === 1;
    rh.f = m.f === 1;
    rh.hp = clamp(num(m.hp, 3), 0, 3);
    if (typeof m.s === 'string') rh.sk = skOf(m.s);
    if (Number.isFinite(m.pk)) rh.pk = Math.max(rh.pk, m.pk | 0);
    rh.at = now;
    rh.seen = now;
    if (rh.fresh) { rh.x = rh.tx; rh.y = rh.ty; rh.fresh = false; }
  }
  // 친구 주인공 움직이기 (받은 자리로 부드럽게) + 친구 빛과 빛 칼을 내 화면에서 보여 주기
  function tickFriends(dt) {
    const now = performance.now(), fight = S.phase === 'fight' || S.phase === 'boss';
    for (const rh of S.heroes.values()) {
      if (rh.ai) { if (HOST) botTick(rh, dt, fight); }
      else {
        const age = Math.min(0.35, (now - rh.at) / 1000), k = Math.min(1, dt * 10);
        rh.x += (clamp(rh.tx + rh.vx * age, WALL + 5, S.W - WALL - 5) - rh.x) * k;
        rh.y += (clamp(rh.ty + rh.vy * age, WALL + 6, S.H - WALL - 6) - rh.y) * k;
        if (!rh.f && fight && now - rh.seen < 6000 && (!endless || Math.hypot(rh.vx, rh.vy) > 20)) {
          rh.fireT -= dt;
          if (rh.fireT <= 0) {
            const tg = nearestFrom(rh.x, rh.y, 175);
            if (tg) { fireFrom(rh, tg, true, rh.sk.light, false); rh.fireT = FIRE_GAP[rh.sk.light]; } else rh.fireT = 0.1;
          }
          if (rh.sk.sword) {
            rh.slT -= dt;
            const R = SWORD_R[rh.sk.sword];
            if (rh.slT <= 0 && nearestFrom(rh.x, rh.y, R + 4)) { rh.slT = SWORD_GAP[rh.sk.sword]; rh.slash = { t: 0, R, a0: Math.random() * TAU }; }
          }
        }
      }
      const sp = Math.hypot(rh.vx, rh.vy);
      if (sp > 8) rh.walk += dt * (4 + sp / 12);
      if (rh.slash) { rh.slash.t += dt; if (rh.slash.t > 0.22) rh.slash = null; }
      rh.shAng += dt * 3.4;
    }
  }
  // 예시 친구: 가까운 그림자와 알맞게 떨어져 빙 돌며 빛을 쏘고, 구슬은 피한다
  function botTick(bt, dt, fight) {
    let ax = 0, ay = 0;
    const tg = fight ? nearestFrom(bt.x, bt.y, 400) : null;
    if (tg) {
      const dx = tg.x - bt.x, dy = tg.y - bt.y, d = Math.hypot(dx, dy) || 1, want = tg === S.boss ? 78 : 56, k = clamp((d - want) / 30, -1, 1);
      ax += (dx / d) * k - (dy / d) * 0.6 * bt.side;
      ay += (dy / d) * k + (dx / d) * 0.6 * bt.side;
      if (Math.random() < dt * 0.3) bt.side = -bt.side;
    } else {
      const hx = clamp(S.hero.x + (bt.slot - mySlot) * 24, WALL + 10, S.W - WALL - 10), hy = clamp(S.hero.y + 12, WALL + 10, S.H - WALL - 10);
      const dx = hx - bt.x, dy = hy - bt.y, d = Math.hypot(dx, dy);
      if (d > 10) { ax += dx / d; ay += dy / d; }
    }
    for (const o of S.orbs) { const dx = bt.x - o.x, dy = bt.y - o.y, d = Math.hypot(dx, dy) || 1; if (d < 28) { ax += ((dx / d) * (28 - d)) / 8; ay += ((dy / d) * (28 - d)) / 8; } }
    for (const f of S.foes) {
      const dx = bt.x - f.x, dy = bt.y - f.y, d = Math.hypot(dx, dy) || 1;
      if (d < f.r + 14) { ax += (dx / d) * 1.5; ay += (dy / d) * 1.5; }
      // 붉은 선을 비켜선다
      if ((f.st === 'lzAim' || f.st === 'lzFire') && beamHits(f, bt.x, bt.y, 14)) { const nx = -Math.sin(f.la), ny = Math.cos(f.la), sd = (bt.x - f.x) * nx + (bt.y - f.y) * ny >= 0 ? 1 : -1; ax += nx * sd * 2; ay += ny * sd * 2; }
    }
    for (const bm of S.bombs) { const dx = bt.x - bm.x, dy = bt.y - bm.y, d = Math.hypot(dx, dy) || 1; if (d < bm.r + 10) { ax += (dx / d) * 2; ay += (dy / d) * 2; } }
    const m = Math.hypot(ax, ay);
    if (m > 1) { ax /= m; ay /= m; }
    const k = 1 - Math.exp(-dt * 10), sp = HERO_SPEED * 0.85;
    bt.vx += (ax * sp - bt.vx) * k;
    bt.vy += (ay * sp - bt.vy) * k;
    bt.x = clamp(bt.x + bt.vx * dt, WALL + 5, S.W - WALL - 5);
    bt.y = clamp(bt.y + bt.vy * dt, WALL + 6, S.H - WALL - 6);
    if (Math.hypot(bt.vx, bt.vy) > 8 && Math.abs(bt.vy) > Math.abs(bt.vx) * 0.8) bt.up = bt.vy < 0;
    bt.tx = bt.x; bt.ty = bt.y; bt.seen = performance.now();
    if (fight && (!endless || Math.hypot(bt.vx, bt.vy) > 20)) {
      bt.fireT -= dt;
      if (bt.fireT <= 0) { const t2 = nearestFrom(bt.x, bt.y, 175); if (t2) { fireFrom(bt, t2, false, bt.sk.light, false); bt.fireT = FIRE_GAP[bt.sk.light] * 1.3; } else bt.fireT = 0.1; }
    }
  }
  // 보내기: 방장은 판 모습을, 친구는 내 주인공을. 사람이 많으면 조금 덜 자주 (실시간 서버가 1초에 받을 수 있는 수가 정해져 있다)
  function netTick(dt) {
    S.sendT -= dt;
    if (S.sendT > 0) return;
    const n = CO.size();
    if (HOST) { S.sendT = 0.25; sendSnap(); return; }
    S.sendT = n >= 4 ? 0.5 : n === 3 ? 0.34 : 0.25;
    sendMe(false);
  }
  function sendMe(force) {
    if (!CO || HOST || !started) return;
    const h = S.hero, now = performance.now();
    const m = { x: r1(h.x), y: r1(h.y), vx: Math.round(h.vx), vy: Math.round(h.vy), u: h.up ? 1 : 0, f: T.alive() || S.phase === 'won' ? 0 : 1, hp: T.hearts(), s: skStr(S.sk), pk: S.myPk };
    const key = JSON.stringify(m);
    const busy = S.hitQ.size || S.bossQ || S.decQ.length || S.gemQ || S.bombQ;
    // 가만히 있고 맞힌 것도 없으면 1초에 한 번만
    if (!force && !busy && key === S.lastKey && now - S.lastSend < 1000) return;
    if (S.hitQ.size) { const k = []; for (const [id, d] of S.hitQ) k.push(id, d); m.k = k; S.hitQ.clear(); }
    if (S.bossQ) { m.bd = S.bossQ; S.bossQ = 0; }
    if (S.decQ.length) { m.dk = S.decQ; S.decQ = []; }
    if (S.gemQ) { m.g = S.gemQ; S.gemQ = 0; }
    if (S.bombQ) { m.b = S.bombQ; S.bombQ = null; }
    S.lastKey = key;
    S.lastSend = now;
    CO.send('~A', m);
  }
  function sendSnap() {
    if (!started) return;
    const F = [];
    for (const f of S.foes) F.push(f.id, FOE_IDS.indexOf(f.kind), r1(f.x), r1(f.y), Math.round(f.vx), Math.round(f.vy), Math.max(0, f.hp), f.st === 'aim' ? 1 : f.st === 'dash' ? 2 : f.kind === 'shooter' && f.fireT < 0.35 ? 3 : 0);
    const P = [];
    for (const p of S.portals) P.push(r1(p.x), r1(p.y), +(p.t / p.dur).toFixed(2), FOE_IDS.indexOf(p.kind));
    const B = S.boss;
    const Bo = B ? [B.n, BOSS_IDS.indexOf(B.kind), r1(B.x), r1(B.y), Math.max(0, Math.ceil(B.hp)), B.max, Math.max(0, BST.indexOf(B.st)), +(B.alpha || 0).toFixed(2), B.r, B.spiral ? 1 : 0, B.blv, +(B.stT || 0).toFixed(2), B.mad ? 1 : 0] : 0;
    const D = [];
    for (const dc of S.decoys) D.push(dc.id, r1(dc.x), r1(dc.y));
    const h = S.hero;
    const H = [[CO.me, r1(h.x), r1(h.y), Math.round(h.vx), Math.round(h.vy), h.up ? 1 : 0, T.alive() || S.phase === 'won' ? 0 : 1, skStr(S.sk), T.hearts()]];
    for (const rh of S.heroes.values()) if (rh.ai) H.push([rh.id, r1(rh.x), r1(rh.y), Math.round(rh.vx), Math.round(rh.vy), rh.up ? 1 : 0, 0, skStr(rh.sk), 3, 1]);
    const m = { ht: +S.t.toFixed(2), ph: PH_OUT[S.phase] || 'r', wv: S.wave, cl: S.cleared, sc: Math.round(S.score), mu: S.mult, cb: S.combo,
      sp: S.spec && S.spec.boss ? BOSS_IDS.indexOf(S.spec.kind) + 1 : 0, F, P, Bo, D, H };
    if (S.newOrbs.length) { m.O = S.newOrbs; S.newOrbs = []; }
    if (S.fxq.length) { m.E = S.fxq; S.fxq = []; }
    if (S.bn && S.t < S.bn.until) m.bn = [S.bn.n, S.bn.big, S.bn.small, S.bn.dur, S.bn.minor ? 1 : 0];
    if (S.phase === 'fight' && S.queue.length) m.q = S.queue.map((k) => QCH[k] || 'w').join('');
    // 미움 그림자가 겨누거나 쏘는 방향, 걱정 덩이
    const Z = [];
    for (const f of S.foes) if (f.st === 'lzAim' || f.st === 'lzFire') Z.push(f.id, f.st === 'lzAim' ? 1 : 2, +(f.la || 0).toFixed(3), +f.stT.toFixed(2));
    if (Z.length) m.Z = Z;
    if (S.bombs.length) { m.K = []; for (const bm of S.bombs) m.K.push(bm.id, r1(bm.x), r1(bm.y), bm.dur, +bm.t.toFixed(2)); }
    CO.send('~S', m);
  }
  // 동굴이 넘겨 주는 방 소식
  function onNet(m, from, fromHost) {
    if (!CO || !m || typeof m !== 'object') return;
    if (m.t === '~S') { if (fromHost && !HOST) onSnap(m); return; }
    if (m.t !== '~A' || from === CO.me || typeof from !== 'string') return;
    if (CO.slot(from) < 0) return;
    const now = performance.now(), rh = friend(from);
    if (rh.ai) return;
    applyHero(rh, m, now);
    rh.direct = now;
    if (Array.isArray(m.b)) { S.rings.push({ x: clamp(Number(m.b[0]) || 0, 0, S.W), y: clamp(Number(m.b[1]) || 0, 0, S.H), t: 0 }); S.orbs.length = 0; S.newOrbs.length = 0; }
    if (!HOST || !started) return;
    partyN();
    // 친구가 맞힌 것 (방장이 셈한다)
    if (Array.isArray(m.k)) for (let i = 0; i + 1 < m.k.length; i += 2) { const f = S.foes.find((x) => x.id === m.k[i]); if (f) hitFoe(f, clamp(Number(m.k[i + 1]) || 0, 0, 30), 0, 0); }
    if (Number.isFinite(m.bd) && m.bd > 0) hitBoss(Math.min(80, m.bd));
    if (Array.isArray(m.dk)) for (const id of m.dk) { const dc = S.decoys.find((x) => x.id === id); if (dc) popDecoy(dc); }
    if (Number.isFinite(m.g) && m.g > 0) S.score += 10 * Math.min(60, m.g | 0);
  }
  const hostNow = () => S.hostT + Math.min(0.6, (performance.now() - S.hostAt) / 1000);
  // 방장이 보낸 판 모습 (친구 화면)
  function onSnap(m) {
    if (!started || !overlay || !Number.isFinite(m.ht)) return;
    const now = performance.now();
    S.hostT = m.ht; S.hostAt = now; S.snapAt = now;
    S.wave = Math.max(0, m.wv | 0);
    S.cleared = Math.max(0, m.cl | 0);
    S.score = Math.max(0, Number(m.sc) || 0);
    const mu = clamp(m.mu | 0, 1, 5);
    if (mu > S.mult) { A.combo(mu); comboPop(mu); }
    S.mult = mu; S.combo = Math.max(0, m.cb | 0);
    S.spec = m.sp ? { boss: true, kind: BOSS_IDS[m.sp - 1] || 'shadow' } : {};
    if (S.spec.boss) S.lastBoss = S.spec.kind;
    S.qStr = typeof m.q === 'string' ? m.q : '';
    if (Array.isArray(m.bn) && m.bn[0] !== S.bnSeen) { S.bnSeen = m.bn[0]; banner(String(m.bn[1] || ''), String(m.bn[2] || ''), Number(m.bn[3]) || 1.5, !!m.bn[4]); }
    if (Array.isArray(m.E)) for (const e of m.E) if (Array.isArray(e)) onEvent(e);
    syncFoes(m.F);
    if (Array.isArray(m.Z)) for (let i = 0; i + 3 < m.Z.length; i += 4) {
      const f = S.foes.find((x) => x.id === m.Z[i]);
      if (f) { f.st = m.Z[i + 1] === 2 ? 'lzFire' : 'lzAim'; f.la = Number(m.Z[i + 2]) || 0; f.stT = Number(m.Z[i + 3]) || 0; }
    }
    if (Array.isArray(m.K)) for (let i = 0; i + 4 < m.K.length; i += 5) {
      const id = m.K[i];
      if (S.dead.has('k' + id) || S.bombs.some((x) => x.id === id)) continue;
      addBomb(Number(m.K[i + 1]) || 0, Number(m.K[i + 2]) || 0, Number(m.K[i + 3]) || BOMB_T, id, (Number(m.K[i + 4]) || 0) + Math.min(0.3, hostNow() - S.hostT));
    }
    S.portals = [];
    if (Array.isArray(m.P)) for (let i = 0; i + 3 < m.P.length; i += 4) S.portals.push({ x: m.P[i], y: m.P[i + 1], t: (Number(m.P[i + 2]) || 0) * 0.75, dur: 0.75, kind: FOE_IDS[m.P[i + 3]] || 'wisp' });
    syncBoss(m.Bo);
    syncDecoys(m.D);
    if (Array.isArray(m.O)) {
      const hn = hostNow();
      for (let i = 0; i + 4 < m.O.length; i += 5) {
        const age = clamp(hn - m.O[i + 4], 0, 0.6), vx = Number(m.O[i + 2]) || 0, vy = Number(m.O[i + 3]) || 0;
        S.orbs.push({ x: m.O[i] + vx * age, y: m.O[i + 1] + vy * age, vx, vy, t: age });
      }
      if (S.orbs.length > 400) S.orbs.splice(0, S.orbs.length - 400);
    }
    if (Array.isArray(m.H)) for (const e of m.H) {
      if (!Array.isArray(e) || e[0] === CO.me || typeof e[0] !== 'string' || CO.slot(e[0]) < 0) continue;
      const rh = friend(e[0]);
      if (rh.direct && now - rh.direct < 700) continue; // 친구가 직접 보낸 소식이 더 새롭다
      applyHero(rh, { x: e[1], y: e[2], vx: e[3], vy: e[4], u: e[5], f: e[6], s: e[7], hp: e[8] }, now);
      rh.botLike = e[9] === 1; // 예시 친구 (함께 한 사람 수에 넣지 않는다)
    }
    // 함께 한 사람 수 (기록에 남긴다)
    let humans = 1;
    for (const rh of S.heroes.values()) if (!rh.botLike && now - rh.seen < 6000) humans++;
    S.partyMax = Math.max(S.partyMax, Math.min(4, humans));
    // 방장 화면의 단계를 따라간다
    const ph = PH_IN[m.ph] || 'wait';
    if (ph !== S.phase) {
      const prev = S.phase;
      if (ph === 'over') { if (T.over) T.over(); else finish(); return; }
      if (prev === 'pickhost' && S.picking && S.pick) choose(S.pick[Math.floor(Math.random() * S.pick.length)]); // 방장이 기다리지 않고 넘어갔다
      if (ph === 'won') { win(); return; }
      S.phase = ph;
      if (ph === 'pickhost' || ph === 'between') for (const it of S.items) it.pull = true;
    }
    if (S.phase === 'pickhost' && S.myPk < S.wave && !S.picking && S.prepickT <= 0) S.prepickT = 0.8;
  }
  function onEvent(e) {
    const [c, a, b2, c2, d2, e2, f2] = e;
    if (c === 'w') A.wave();
    else if (c === 'bi') { A.bossIn(); S.shake = Math.max(S.shake, 4); }
    else if (c === 'sn') A.spawn();
    else if (c === 'wr') A.warn();
    else if (c === 'z') A.zap();
    else if (c === 'tl') A.tele();
    else if (c === 'st') { S.shake = 7; A.stomp(); burst(a, b2 + (c2 || 19), '#8E7A9E', 16, 70, 0.5); }
    else if (c === 'ro') { roarPush(a, b2); tip(a, b2 - 27, '쿠아앙!', '#F6C2CF', 1.0, 18); }
    else if (c === 'tp') tip(a, b2, String(c2 || ''), String(d2 || '#FFF8E7'), Number(e2) || 1.1, Number(f2) || 15);
    else if (c === 'bd') { A.bossDown(); S.shake = 6; popText(a, b2 - 18, `+${c2 | 0}`, '#FFF8D6'); S.orbs.length = 0; }
    else if (c === 'lz') { A.laser(); S.shake = Math.max(S.shake, 2); }
    else if (c === 'dr') A.drop();
  }
  function syncFoes(F) {
    if (!Array.isArray(F)) return;
    const now = performance.now(), seen = new Set(), byId = new Map(S.foes.map((f) => [f.id, f]));
    for (let i = 0; i + 7 < F.length; i += 8) {
      const id = F[i], kind = FOE_IDS[F[i + 1]];
      if (!kind || !Number.isFinite(id)) continue;
      seen.add(id);
      const d0 = S.dead.get(id);
      if (d0 != null) { if (S.t - d0 < 1.5) continue; S.dead.delete(id); } // 내가 먼저 물리친 그림자 (방장이 아직 모른다)
      let f = byId.get(id);
      if (!f) { f = addFoe(kind, F[i + 2], F[i + 3], id); f.max = Math.max(f.max, F[i + 6]); }
      const hp = Number(F[i + 6]) || 0;
      if (hp < f.hp - 0.01) f.flash = 0.08;
      f.hp = Math.min(f.hp, hp);
      f.sx = F[i + 2]; f.sy = F[i + 3]; f.svx = Number(F[i + 4]) || 0; f.svy = Number(F[i + 5]) || 0; f.sat = now;
      const st = F[i + 7];
      f.st = st === 1 ? 'aim' : st === 2 ? 'dash' : 'roam';
      f.fireT = st === 3 ? 0.2 : 1;
    }
    // 방장 화면에서 사라진 그림자: 친구가 물리쳤다
    for (const f of [...S.foes]) if (!seen.has(f.id)) { S.foes.splice(S.foes.indexOf(f), 1); killFx(f, FOES[f.kind].pts * S.mult, false); }
  }
  function syncBoss(Bo) {
    if (!Array.isArray(Bo)) {
      if (S.boss) { const B = S.boss; S.boss = null; if (B.st === 'down') bossGone(B); }
      return;
    }
    const [n, ki, x, y, hp, max, st, al, r, spi, blv, stT, mad] = Bo;
    const kind = BOSS_IDS[ki] || 'shadow', K = BOSS_KINDS[kind], now = performance.now();
    let B = S.boss;
    if (!B || B.n !== n) {
      B = S.boss = { n, kind, name: K.name, x, y, hp, max, t: 0, st: 'enter', stT: 0, flash: 0, r, blv, alpha: 1, sx: x, sy: y, svx: 0, svy: 0, sat: now, sht: S.hostT };
      S.lastBoss = kind;
    }
    const dtS = Math.max(0.05, S.hostT - B.sht);
    if (S.hostT > B.sht) { B.svx = clamp((x - B.sx) / dtS, -200, 200); B.svy = clamp((y - B.sy) / dtS, -200, 200); }
    B.sx = x; B.sy = y; B.sat = now; B.sht = S.hostT;
    B.st = BST[st] || 'move';
    if (B.st === 'down' || B.st === 'enter') { B.svx = 0; B.svy = 0; }
    B.stT = Number(stT) || 0;
    if (hp < B.hp - 0.01) B.flash = 0.07;
    B.hp = hp > B.hp + 25 ? hp : Math.min(B.hp, hp);
    if (B.st === 'down') B.hp = 0;
    B.max = max; B.alpha = Number(al); B.r = r; B.blv = blv; B.mad = mad === 1;
    B.spiral = spi ? (B.spiral || {}) : null;
  }
  function syncDecoys(D) {
    if (!Array.isArray(D)) return;
    const seen = new Set();
    for (let i = 0; i + 2 < D.length; i += 3) {
      const id = D[i];
      seen.add(id);
      if (S.dead.has('d' + id)) continue;
      let dc = S.decoys.find((x) => x.id === id);
      if (!dc) { dc = { id, x: D[i + 1], y: D[i + 2], t: 0, ph: 0, life: 9, fireT: 2 }; S.decoys.push(dc); burst(dc.x, dc.y, '#B9A6E8', 12, 60, 0.4); }
      dc.sx = D[i + 1]; dc.sy = D[i + 2];
    }
    for (let i = S.decoys.length - 1; i >= 0; i--) if (!seen.has(S.decoys[i].id)) { const dc = S.decoys[i]; burst(dc.x, dc.y, '#B9A6E8', 8, 40, 0.4); S.decoys.splice(i, 1); }
  }
  // 방장이 나갔다: 지금 판을 이어받아 혼자 이어 간다 (동굴이 부른다)
  function promote() {
    if (!CO || HOST) return;
    const ph = S.phase;
    HOST = true;
    CO = null;
    S.heroes.clear();
    S.dead.clear();
    S.rings.length = 0;
    for (const f of S.foes) { f.st = 'roam'; f.stT = rnd(0.8, 1.8); f.fireT = rnd(1.4, 2.4); f.bombed = -1; }
    for (const dc of S.decoys) { dc.ph = Math.random() * TAU; dc.life = 6; dc.fireT = rnd(1.2, 2); }
    if (S.boss) {
      const B = S.boss;
      Object.assign(B, { pat: 0, atkT: 1.5, homeY: clamp(B.y, WALL + 20, S.H * 0.4), bombed: -1, split: B.kind === 'doubt' ? Math.round((15 - B.r) / 2) : 0, spiral: null, rain: null, dx: 0, dy: 0, tgI: 0 });
      if (B.st === 'down') B.stT = Math.max(0.3, B.stT); else if (B.st === 'enter') B.stT = 0.6; else { B.st = 'move'; B.alpha = 1; }
    }
    S.queue = [...S.qStr].map((c) => QKIND[c] || 'wisp');
    S.mul = endless ? 1 + Math.min(0.6, (S.wave - 1) * 0.03) : [1, 1.08, 1.16][lv - 1];
    S.maxAlive = endless ? Math.min(12, 6 + Math.floor(S.wave / 3)) : [6, 8, 9][lv - 1];
    S.pn = 1;
    if (ph === 'wait') { S.wave = 0; nextWave(); }
    else if (ph === 'between') { S.wave = Math.max(0, S.wave - 1); nextWave(); }
    else if (ph === 'fight') { S.phase = 'fight'; S.spec = {}; S.spawnT = 0.4; }
    else if (ph === 'boss') { S.phase = 'boss'; if (!S.boss) waveDone(); }
    else if (ph === 'pickhost') {
      if (S.picking) S.phase = 'pick';
      else if (S.myPk < S.wave && SKILL_IDS.some((k) => S.sk[k] < 3)) openPick();
      else nextWave();
    }
  }

  // ---------- 그리기 ----------
  // share: 함께 할 때 친구 화면에도 같은 큰 글을 띄운다 (방장만)
  function banner(big, small, dur, minor = false, sh = false) {
    S.banner = { big, small, dur, t: 0, minor };
    if (sh && CO && HOST) S.bn = { n: ++S.bnN, big, small, dur, minor, until: S.t + dur };
  }
  function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function spr(img, x, y) { b.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); }
  function num(str, x, y, col) {
    const w = str.length * 4 - 1;
    let cx = Math.round(x - w / 2);
    const cy = Math.round(y - 2);
    for (const ch of str) {
      const g = DIGITS[ch];
      if (g) {
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') {
          b.fillStyle = '#0A0614'; b.fillRect(cx + xx - 1, cy + yy, 1, 1); b.fillRect(cx + xx + 1, cy + yy, 1, 1); b.fillRect(cx + xx, cy + yy - 1, 1, 1); b.fillRect(cx + xx, cy + yy + 1, 1, 1);
        }
        b.fillStyle = col;
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') b.fillRect(cx + xx, cy + yy, 1, 1);
      }
      cx += 4;
    }
  }
  function ellipse(x, y, rx, ry, col) { b.fillStyle = col; b.beginPath(); b.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, TAU); b.fill(); }
  function render(frozen, down = frozen) {
    const W = S.W, H = S.H, SP = SPR, h = S.hero;
    const sx = S.shake ? Math.round(rnd(-S.shake, S.shake)) : 0, sy = S.shake ? Math.round(rnd(-S.shake, S.shake)) : 0;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.imageSmoothingEnabled = false;
    b.fillStyle = '#0C0A18';
    b.fillRect(0, 0, W, H);
    b.setTransform(1, 0, 0, 1, sx, sy);
    b.drawImage(floor, 0, 0);
    // 문
    for (const p of S.portals) {
      const k = p.t / p.dur;
      ellipse(p.x, p.y + 3, 2 + k * 6, 1 + k * 2.5, 'rgba(10,6,20,.6)');
      b.strokeStyle = `rgba(150,110,230,${0.4 + k * 0.5})`;
      b.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const rr = 2 + k * 6 - i * 2; if (rr <= 0.5) continue; b.beginPath(); b.arc(Math.round(p.x), Math.round(p.y), rr, S.t * 6 + i * 2, S.t * 6 + i * 2 + 4); b.stroke(); }
    }
    // 빛 조각, 하트
    for (const it of S.items) {
      if (it.life < 2 && Math.floor(it.life * 8) % 2) continue;
      const bob = Math.round(Math.sin(it.t * 6) * 1);
      if (it.kind === 'heart') spr(SP.heart, it.x, it.y + bob);
      else { spr(SP.gem, it.x, it.y + bob); if (Math.floor(it.t * 5) % 3 === 0) { b.fillStyle = '#FFFFFF'; b.fillRect(Math.round(it.x) + 2, Math.round(it.y) - 3 + bob, 1, 1); } }
    }
    // 걱정 덩이가 떨어질 자리 (붉은 동그라미가 차오르고, 다 차면 쾅)
    for (const bm of S.bombs) {
      const k = clamp(bm.t / bm.dur, 0, 1), blink = k > 0.7 ? Math.floor(S.t * 14) % 2 : 0;
      b.fillStyle = `rgba(220,60,50,${0.12 + k * 0.28})`;
      b.beginPath(); b.arc(Math.round(bm.x), Math.round(bm.y), bm.r * k, 0, TAU); b.fill();
      b.strokeStyle = blink ? '#FFE0A0' : 'rgba(240,80,60,.9)';
      b.lineWidth = 1;
      b.beginPath(); b.arc(Math.round(bm.x), Math.round(bm.y), bm.r, 0, TAU); b.stroke();
      // 위에서 떨어지는 걱정 덩이
      const fy = bm.y - (1 - k) * 46;
      ellipse(bm.x, fy, 3, 3, '#2A1400');
      ellipse(bm.x, fy, 2, 2, '#F0A040');
    }
    // 그림자들
    for (const f of S.foes) {
      ellipse(f.x, f.y + f.r + 1, f.r, 1.6, 'rgba(8,4,16,.5)');
      const fr = SP[f.kind];
      let img = fr[Math.floor(f.t * 4) % fr.length];
      if (f.flash > 0) img = SP[f.kind + 'W'];
      else if (f.kind === 'dasher' && f.st === 'aim' && Math.floor(f.t * 16) % 2) img = SP.dasherR;
      else if (f.kind === 'shooter' && f.fireT < 0.35 && Math.floor(f.t * 16) % 2) img = SP.shooterR;
      else if (f.kind === 'laser' && f.st === 'lzAim' && Math.floor(f.t * 16) % 2) img = SP.laserR;
      spr(img, f.x, f.y + (f.kind === 'dasher' ? 0 : Math.round(Math.sin(f.t * 5))));
      if (f.kind === 'dasher' && f.st === 'aim') { b.fillStyle = '#FFE58A'; b.fillRect(Math.round(f.x), Math.round(f.y) - 11, 1, 3); b.fillRect(Math.round(f.x), Math.round(f.y) - 7, 1, 1); }
    }
    // 미움 그림자: 겨누는 붉은 선과 빛줄기
    for (const f of S.foes) {
      if (f.st !== 'lzAim' && f.st !== 'lzFire') continue;
      const L = Math.hypot(W, H), ex = f.x + Math.cos(f.la || 0) * L, ey = f.y + Math.sin(f.la || 0) * L;
      if (f.st === 'lzAim') {
        const lock = f.stT <= 0.3;
        b.strokeStyle = `rgba(255,${lock ? 60 : 90},${lock ? 70 : 100},${lock ? 0.9 : 0.35 + (Math.floor(S.t * 10) % 2) * 0.25})`;
        b.lineWidth = 1;
      } else {
        b.strokeStyle = 'rgba(255,70,90,.55)';
        b.lineWidth = 7;
        b.beginPath(); b.moveTo(Math.round(f.x), Math.round(f.y)); b.lineTo(Math.round(ex), Math.round(ey)); b.stroke();
        b.strokeStyle = '#FFF0F0';
        b.lineWidth = 3;
      }
      b.beginPath(); b.moveTo(Math.round(f.x), Math.round(f.y)); b.lineTo(Math.round(ex), Math.round(ey)); b.stroke();
    }
    // 빛 발자국
    for (const pr of S.prints) { b.globalAlpha = clamp(pr.life / pr.max, 0, 1) * 0.8; b.fillStyle = '#E8FFB0'; b.fillRect(Math.round(pr.x) - 1, Math.round(pr.y), 2, 1); b.fillStyle = '#9BE07A'; b.fillRect(Math.round(pr.x) - 1, Math.round(pr.y) + 1, 2, 1); }
    b.globalAlpha = 1;
    for (const dc of S.decoys) drawMask(dc.x, dc.y, 14, 1, false, dc.t, true);
    if (S.boss) drawBoss(S.boss);
    // 어두운 구슬
    for (const o of S.orbs) {
      const p = Math.floor(o.t * 8) % 2;
      ellipse(o.x, o.y, 3, 3, '#0A0614');
      ellipse(o.x, o.y, 2, 2, p ? '#C050E0' : '#E070FF');
      b.fillStyle = '#F0C8FF';
      b.fillRect(Math.round(o.x) - 1, Math.round(o.y) - 1, 1, 1);
    }
    // 함께 하는 친구 (자리마다 옷 색이 다르다. 쓰러진 친구는 잿빛)
    for (const rh of S.heroes.values()) {
      if (!rh.ai && performance.now() - rh.seen > 8000) continue;
      const set = heroSet(rh.slot), moving = Math.hypot(rh.vx, rh.vy) > 8 && !rh.f, fi = moving ? Math.floor(rh.walk) % 2 : 0;
      ellipse(rh.x, rh.y + 8, 5, 1.8, 'rgba(8,4,16,.55)');
      spr(rh.f ? set.G : (rh.up ? set.back : set.hero)[fi], rh.x, rh.y + (moving && fi ? -1 : 0));
      if (rh.f) continue;
      for (let k = 0; k < rh.sk.shield; k++) { const a = rh.shAng + (k * TAU) / rh.sk.shield; spr(SP.shield, rh.x + Math.cos(a) * 17, rh.y + Math.sin(a) * 17); }
      if (rh.slash) { const sl = rh.slash, k = sl.t / 0.22; b.strokeStyle = `rgba(255,248,214,${0.8 - k * 0.7})`; b.lineWidth = 2; b.beginPath(); b.arc(Math.round(rh.x), Math.round(rh.y), sl.R * (0.7 + k * 0.3), sl.a0, sl.a0 + TAU * Math.min(1, k * 1.6)); b.stroke(); }
    }
    // 나
    ellipse(h.x, h.y + 8, 5, 1.8, 'rgba(8,4,16,.55)');
    if (!(h.inv > 0 && Math.floor(h.inv * 14) % 2)) {
      const moving = Math.hypot(h.vx, h.vy) > 8;
      const fi = moving ? Math.floor(h.walk) % 2 : 0;
      const set = heroSet(mySlot);
      let img = (h.up ? set.back : set.hero)[fi];
      if (down) img = set.G;
      spr(img, h.x, h.y + (moving && fi ? -1 : 0));
      if (S.power > 0) { b.strokeStyle = `rgba(255,229,138,${0.35 + Math.sin(S.t * 10) * 0.2})`; b.lineWidth = 1; b.beginPath(); b.arc(Math.round(h.x), Math.round(h.y), 10, 0, TAU); b.stroke(); }
    }
    // 지켜 주는 의 (차 있으면 금빛 고리)
    if (S.guard && !down) { b.strokeStyle = `rgba(255,214,90,${0.45 + Math.sin(S.t * 6) * 0.2})`; b.lineWidth = 1; b.beginPath(); b.arc(Math.round(h.x), Math.round(h.y), 12, 0, TAU); b.stroke(); }
    // 도는 방패
    for (let k = 0; k < S.sk.shield; k++) { const a = S.shAng + (k * TAU) / S.sk.shield; spr(SP.shield, h.x + Math.cos(a) * 17, h.y + Math.sin(a) * 17); }
    // 빛 칼 휘두르기
    if (S.slash) {
      const sl = S.slash, k = sl.t / 0.22;
      b.strokeStyle = `rgba(255,248,214,${0.9 - k * 0.7})`;
      b.lineWidth = 3;
      b.beginPath(); b.arc(Math.round(h.x), Math.round(h.y), sl.R * (0.7 + k * 0.3), sl.a0, sl.a0 + TAU * Math.min(1, k * 1.6)); b.stroke();
      b.strokeStyle = `rgba(255,255,255,${0.8 - k * 0.8})`;
      b.lineWidth = 1;
      b.beginPath(); b.arc(Math.round(h.x), Math.round(h.y), sl.R * (0.7 + k * 0.3) - 2, sl.a0, sl.a0 + TAU * Math.min(1, k * 1.6)); b.stroke();
    }
    // 진리의 빛줄기 (지그재그)
    for (const c of S.chains) {
      b.strokeStyle = `rgba(255,240,170,${clamp(c.life / 0.22, 0, 1)})`;
      b.lineWidth = 1;
      b.beginPath();
      b.moveTo(Math.round(c.pts[0][0]), Math.round(c.pts[0][1]));
      for (let i = 1; i < c.pts.length; i++) {
        const [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
        for (let k = 1; k <= 3; k++) { const t2 = k / 4; b.lineTo(Math.round(x0 + (x1 - x0) * t2 + rnd(-3, 3)), Math.round(y0 + (y1 - y0) * t2 + rnd(-3, 3))); }
        b.lineTo(Math.round(x1), Math.round(y1));
      }
      b.stroke();
    }
    // 빛
    for (const s of S.shots) {
      const ex = s.x - s.vx * 0.022, ey = s.y - s.vy * 0.022;
      b.strokeStyle = 'rgba(255,229,138,.55)';
      b.lineWidth = 2;
      b.beginPath(); b.moveTo(Math.round(ex), Math.round(ey)); b.lineTo(Math.round(s.x), Math.round(s.y)); b.stroke();
      b.fillStyle = '#FFFDF0';
      b.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
    }
    // 기도의 빛 고리
    if (S.bomb) {
      const B = S.bomb, R = (B.t / 0.55) * Math.hypot(W, H);
      b.strokeStyle = `rgba(255,243,176,${Math.max(0, 0.9 - B.t)})`;
      b.lineWidth = 4;
      b.beginPath(); b.arc(B.x, B.y, R, 0, TAU); b.stroke();
      b.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.7 - B.t)})`;
      b.lineWidth = 1;
      b.beginPath(); b.arc(B.x, B.y, Math.max(0, R - 4), 0, TAU); b.stroke();
    }
    // 친구의 기도 빛 고리
    for (const rg of S.rings) {
      const R = (rg.t / 0.55) * Math.hypot(W, H);
      b.strokeStyle = `rgba(255,243,176,${Math.max(0, 0.7 - rg.t)})`;
      b.lineWidth = 3;
      b.beginPath(); b.arc(rg.x, rg.y, R, 0, TAU); b.stroke();
    }
    for (const p of S.parts) { b.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1); b.fillStyle = p.c; b.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    b.globalAlpha = 1;
    for (const p of S.pops) { b.globalAlpha = clamp(p.life * 2.2, 0, 1); num(p.txt, p.x, p.y, p.c); }
    b.globalAlpha = 1;
    // 어둠 (내 둘레만 밝게)
    b.setTransform(1, 0, 0, 1, 0, 0);
    const R = Math.max(W, H) * 0.72;
    const g = b.createRadialGradient(h.x, h.y, 26, h.x, h.y, R);
    g.addColorStop(0, 'rgba(6,3,16,0)');
    g.addColorStop(1, frozen ? 'rgba(6,3,16,.75)' : 'rgba(6,3,16,.42)');
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
    if (S.flash > 0) { b.globalAlpha = Math.min(0.6, S.flash * 1.6); b.fillStyle = S.flashCol; b.fillRect(0, 0, W, H); b.globalAlpha = 1; }

    // 큰 화면에 옮기기
    const u = L.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0C0A18';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, L.ox, L.oy, W * L.s, H * L.s);
    ctx.strokeStyle = '#4A3D6E';
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.strokeRect(L.ox - ctx.lineWidth / 2, L.oy - ctx.lineWidth / 2, W * L.s + ctx.lineWidth, H * L.s + ctx.lineWidth);
    hud(frozen, down);
  }
  function drawBoss(B) {
    if (B.kind === 'mask') { b.globalAlpha = B.alpha; ellipse(B.x, B.y + 16, 12, 3, 'rgba(8,4,16,.55)'); drawMask(B.x, B.y, B.r, B.hp / B.max, B.flash > 0, B.t, false); b.globalAlpha = 1; return; }
    if (B.kind === 'doubt') { drawCloud(B); return; }
    if (B.kind === 'giant') { drawGiant(B); return; }
    if (B.kind === 'accuser') { drawAccuser(B); return; }
    drawShadowBoss(B);
  }
  // 거짓 가면 (진짜는 금이 가고, 가짜는 바닥 그림자가 없다. 진리의 빛줄기가 있으면 가짜는 붉게 드러난다)
  function drawMask(cx, cy, r, life, flash, t, fake) {
    const x = Math.round(cx), y = Math.round(cy + Math.sin(t * 2) * 1.5), k = r / 14;
    const reveal = fake && S.sk.belt > 0;
    // 망토
    b.fillStyle = flash ? '#EDE4FF' : '#0A0614';
    b.beginPath(); b.arc(x, y + 3 * k, 13 * k + 1, 0, TAU); b.fill();
    b.fillStyle = flash ? '#8E78D0' : reveal ? '#5A1E36' : '#30204F';
    b.beginPath(); b.arc(x, y + 3 * k, 13 * k, 0, TAU); b.fill();
    for (let i = 0; i < 5; i++) { b.beginPath(); b.arc(x + (-9 + i * 4.5) * k, y + (13 + Math.sin(t * 4 + i) * 1.5) * k, 3 * k, 0, TAU); b.fill(); }
    // 가면 (웃는 척하는 하얀 얼굴)
    b.fillStyle = '#0A0614';
    b.beginPath(); b.ellipse(x, y - 1 * k, 9 * k + 1, 10 * k + 1, 0, 0, TAU); b.fill();
    b.fillStyle = reveal ? '#F6C2CF' : '#EDE4FF';
    b.beginPath(); b.ellipse(x, y - 1 * k, 9 * k, 10 * k, 0, 0, TAU); b.fill();
    b.fillStyle = '#0A0614';
    for (const sd of [-1, 1]) { b.beginPath(); b.ellipse(x + sd * 4 * k, y - 3 * k, 2.4 * k, 1.5 * k, sd * 0.4, 0, TAU); b.fill(); }
    b.strokeStyle = '#0A0614'; b.lineWidth = 1;
    b.beginPath(); b.arc(x, y + 1 * k, 5 * k, 0.15 * Math.PI, 0.85 * Math.PI); b.stroke();
    // 맞을수록 금이 간다
    if (!fake && life < 0.75) { b.beginPath(); b.moveTo(x + 2, y - 10 * k); b.lineTo(x - 1, y - 6 * k); b.lineTo(x + 2, y - 3 * k); b.stroke(); }
    if (!fake && life < 0.4) { b.beginPath(); b.moveTo(x - 7 * k, y + 2); b.lineTo(x - 3 * k, y + 4); b.lineTo(x - 5 * k, y + 8); b.stroke(); }
  }
  // 의심 구름 (물음표가 떠다닌다)
  function drawCloud(B) {
    const t = S.t, x = Math.round(B.x), y = Math.round(B.y), k = B.r / 15;
    ellipse(x, y + 18 * k, 14 * k, 3, 'rgba(8,4,16,.45)');
    const puffs = [[-9, 2, 7], [0, -3, 9], [9, 2, 7], [-4, 5, 7], [5, 5, 7]];
    for (const [col, grow] of [[B.flash > 0 ? '#EDE4FF' : '#0A0614', 1], [B.flash > 0 ? '#9FC8D0' : '#3C5A64', 0]]) {
      b.fillStyle = col;
      for (const [px, py, pr] of puffs) { b.beginPath(); b.arc(x + px * k + Math.sin(t * 2 + px) * 0.6, y + py * k, pr * k + grow, 0, TAU); b.fill(); }
    }
    b.fillStyle = 'rgba(200,235,240,.25)';
    b.beginPath(); b.arc(x - 3 * k, y - 6 * k, 4 * k, 0, TAU); b.fill();
    // 걱정하는 눈
    for (const sd of [-1, 1]) {
      ellipse(x + sd * 4 * k, y, 2.6 * k, 3 * k, '#E6FFF9');
      b.fillStyle = '#0A0614';
      b.fillRect(Math.round(x + sd * 4 * k + Math.sin(t * 1.7) * 1.2) - 1, Math.round(y), 2, 2);
      b.fillRect(Math.round(x + sd * 4 * k) - 2, Math.round(y - 4 * k) + (sd > 0 ? 1 : 0), 4, 1);
    }
    // 물음표 셋
    const Q = ['111', '001', '010', '000', '010'];
    for (let i = 0; i < 3; i++) {
      const qx = Math.round(x + (i - 1) * 9 * k), qy = Math.round(y - 16 * k + Math.sin(t * 3 + i * 2) * 2);
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (Q[yy][xx] === '1') { b.fillStyle = '#0A0614'; b.fillRect(qx + xx - 1, qy + yy, 3, 1); }
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (Q[yy][xx] === '1') { b.fillStyle = '#CDEFF5'; b.fillRect(qx + xx, qy + yy, 1, 1); }
    }
  }
  // 두려움 거인 (쿵 하기 전에 몸을 움츠린다)
  function drawGiant(B) {
    const t = S.t, k = B.r / 19;
    const crouch = B.st === 'stompAim' ? Math.min(1, (0.7 - B.stT) / 0.7) : 0;
    const step = B.st === 'move' ? Math.abs(Math.sin(t * 5)) * 1.5 : 0;
    const x = Math.round(B.x), y = Math.round(B.y - step + crouch * 3);
    const sq = 1 + crouch * 0.15;
    ellipse(x, y + 20 * k, 17 * k, 4, 'rgba(8,4,16,.55)');
    const body = B.flash > 0 ? '#9A78B0' : B.st === 'aim' && Math.floor(t * 14) % 2 ? '#7A2448' : '#3E2440';
    for (const [col, grow] of [[B.flash > 0 ? '#EDE4FF' : '#0A0614', 1], [body, 0]]) {
      b.fillStyle = col;
      b.beginPath(); b.ellipse(x, y, 17 * k * sq + grow, 16 * k / sq + grow, 0, 0, TAU); b.fill();
      // 삐죽삐죽 털
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; b.beginPath(); b.moveTo(x + Math.cos(a - 0.15) * 15 * k, y + Math.sin(a - 0.15) * 14 * k); b.lineTo(x + Math.cos(a) * (21 * k + grow), y + Math.sin(a) * (20 * k + grow)); b.lineTo(x + Math.cos(a + 0.15) * 15 * k, y + Math.sin(a + 0.15) * 14 * k); b.fill(); }
      // 팔과 발
      for (const sd of [-1, 1]) { b.beginPath(); b.arc(x + sd * 17 * k, y + 5 * k - crouch * 4, 5 * k + grow, 0, TAU); b.fill(); b.beginPath(); b.arc(x + sd * 8 * k, y + 15 * k, 5 * k + grow, 0, TAU); b.fill(); }
    }
    const angry = B.hp < B.max / 2;
    for (const sd of [-1, 1]) {
      ellipse(x + sd * 6 * k, y - 4 * k, 4 * k, 4.5 * k, '#FFE0E0');
      b.fillStyle = angry ? '#E0404F' : '#7A1E2E';
      b.fillRect(Math.round(x + sd * 6 * k) - 1, Math.round(y - 4 * k), 2, 3);
      b.fillStyle = '#0A0614';
      b.fillRect(Math.round(x + sd * 6 * k) - 4, Math.round(y - 10 * k) + (sd > 0 ? 0 : 1), 8, 1);
    }
    // 이빨 보이는 입
    b.fillStyle = '#0A0614';
    b.fillRect(x - 7, Math.round(y + 5 * k), 14, 3);
    b.fillStyle = '#FFF8E7';
    for (let i = 0; i < 4; i++) b.fillRect(x - 6 + i * 4, Math.round(y + 5 * k), 2, 1);
  }
  // 참소하는 그림자 (두건을 쓴 큰 눈)
  function drawAccuser(B) {
    const t = S.t, x = Math.round(B.x), y = Math.round(B.y + Math.sin(t * 2) * 1.5), k = B.r / 16;
    ellipse(x, y + 18 * k, 14 * k, 3, 'rgba(8,4,16,.5)');
    const body = B.flash > 0 ? '#7C8CD8' : '#1E2A58';
    for (const [col, grow] of [[B.flash > 0 ? '#EDE4FF' : '#0A0614', 1], [body, 0]]) {
      b.fillStyle = col;
      b.beginPath(); b.arc(x, y, 14 * k + grow, 0, TAU); b.fill();
      b.beginPath(); b.moveTo(x - 9 * k - grow, y - 8 * k); b.lineTo(x, y - 22 * k - grow); b.lineTo(x + 9 * k + grow, y - 8 * k); b.fill();
      for (let i = 0; i < 6; i++) { b.beginPath(); b.arc(x + (-11 + i * 4.4) * k, y + (11 + Math.sin(t * 4 + i) * 2) * k, 3.4 * k + grow, 0, TAU); b.fill(); }
    }
    // 큰 눈 하나 (나를 노려본다)
    const dx = S.hero.x - B.x, dy = S.hero.y - B.y, d = Math.hypot(dx, dy) || 1;
    ellipse(x, y - 2 * k, 7 * k, 5 * k, '#F3EAFB');
    ellipse(x + (dx / d) * 2.5 * k, y - 2 * k + (dy / d) * 1.5 * k, 2.6 * k, 2.6 * k, B.hp < B.max / 2 ? '#FF4058' : '#C83A4A');
    b.fillStyle = '#0A0614';
    b.fillRect(x - Math.round(7 * k), Math.round(y - 8 * k), Math.round(14 * k), 1);
    // 소리치는 입
    const open = B.spiral ? 2 + Math.round(Math.abs(Math.sin(t * 12)) * 2) : 1;
    b.fillRect(x - 4, Math.round(y + 5 * k), 8, open);
  }
  function drawShadowBoss(B) {
    const t = S.t, x = Math.round(B.x), y = Math.round(B.y), k = B.r / 13;
    const angry = B.hp < B.max / 2, aim = B.st === 'aim' && Math.floor(t * 14) % 2;
    // 맞으면 몸이 밝은 보라로 번쩍인다 (하얗게 다 덮으면 큰 그림자 모양이 안 보여서)
    const body = B.flash > 0 ? '#7E66C8' : aim ? '#7A2448' : '#2A1C4C';
    const edge = B.flash > 0 ? '#EDE4FF' : '#0A0614';
    ellipse(x, y + 17 * k, 15 * k, 3 * k, 'rgba(8,4,16,.5)');
    // 둘레의 어두운 기운 (바닥에서 잘 보이게 옅은 보라 테두리)
    b.fillStyle = `rgba(150,110,230,${0.16 + Math.sin(t * 3) * 0.05})`;
    b.beginPath(); b.arc(x, y, (19 + Math.sin(t * 3) * 1.5) * k, 0, TAU); b.fill();
    // 몸 (테두리 먼저)
    for (const [col, grow] of [[edge, 1], [body, 0]]) {
      b.fillStyle = col;
      b.beginPath(); b.arc(x, y, 13 * k + grow, 0, TAU); b.fill();
      for (let i = 0; i < 6; i++) { b.beginPath(); b.arc(x + (-11 + i * 4.4) * k, y + (10 + Math.sin(t * 4 + i) * 2) * k, 3.6 * k + grow, 0, TAU); b.fill(); }
      for (const sd of [-1, 0, 1]) { b.beginPath(); b.moveTo(x + (sd * 7 - 3) * k - grow, y - 10 * k); b.lineTo(x + sd * 7 * k, y - (17 + (sd ? 0 : 3)) * k - grow); b.lineTo(x + (sd * 7 + 3) * k + grow, y - 10 * k); b.fill(); }
    }
    // 눈 (나를 본다)
    const dx = S.hero.x - B.x, dy = S.hero.y - B.y, d = Math.hypot(dx, dy) || 1, px = Math.round((dx / d) * 1.5), py = Math.round((dy / d) * 1.5);
    const eye = angry ? '#FF6A7A' : '#FFE58A';
    for (const sd of [-1, 1]) {
      const ex = Math.round(x + sd * 5 * k), ey = Math.round(y - 2 * k);
      ellipse(ex, ey, 3.5 * k, 3 * k, eye);
      b.fillStyle = '#0A0614';
      b.fillRect(ex - 1 + px, ey - 1 + py, 3, 3);
      b.fillRect(ex - 3, ey - Math.round(4 * k) - (angry ? (sd > 0 ? 0 : 1) : 0), 7, 1);
    }
    b.fillStyle = '#0A0614';
    b.fillRect(x - 5, Math.round(y + 6 * k), 10, 1);
    if (angry) { b.fillRect(x - 5, Math.round(y + 6 * k) - 1, 1, 1); b.fillRect(x + 4, Math.round(y + 6 * k) - 1, 1, 1); }
  }
  let FONTN = '';
  function text(str, x, y, px, col = '#FFF8E7', align = 'center') {
    const u = L.dpr;
    if (!FONTN) FONTN = (getComputedStyle(document.documentElement).getPropertyValue('--display') || '').trim() || 'sans-serif';
    ctx.font = `${Math.round(px * u)}px ${FONTN}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * u * 0.24);
    ctx.strokeStyle = 'rgba(14,8,30,.95)';
    ctx.strokeText(str, x * u, y * u);
    ctx.fillStyle = col;
    ctx.fillText(str, x * u, y * u);
  }
  function hud(frozen, down = frozen) {
    const u = L.dpr, vw = L.vw, y = L.top + 26, c00 = toCss(0, 0);
    ctx.imageSmoothingEnabled = false;
    // 하트
    const hs = 3;
    const hearts = T.hearts();
    for (let i = 0; i < 3; i++) ctx.drawImage(i < hearts ? SPR.heart : SPR.heartOff, Math.round((L.left + 12 + i * 25) * u), Math.round((y - 9) * u), 7 * hs * u, 6 * hs * u);
    // 함께 하는 친구 하트 (하트 아래 작은 글씨)
    if (CO) {
      let fy = y + 18;
      const now = performance.now();
      for (const rh of S.heroes.values()) {
        if (!rh.ai && now - rh.seen > 8000) continue;
        text(`${rh.name} ${rh.f ? '🙏' : '❤'.repeat(Math.max(0, rh.hp))}`, L.left + 12, fy, 12, rh.f ? '#B8AEDC' : SLOT_COL[rh.slot][0], 'left');
        fy += 16;
      }
    }
    // 점수와 콤보
    text(fmt(S.score), vw / 2, y - 4, 22);
    if (S.mult > 1 || S.combo >= 3) text(`콤보 ${S.combo}${S.mult > 1 ? ` · ×${S.mult}` : ''}`, vw / 2, y + 16, 13, '#FFE58A');
    // 물결과 빛 게이지
    const rx = vw - L.right - 12;
    const wl = S.spec && S.spec.boss ? (BOSS_KINDS[S.spec.kind] || BOSS_KINDS.shadow).name : endless ? `물결 ${S.wave}` : `물결 ${Math.min(S.wave, roomWaves.length)}/${roomWaves.length}`;
    text(wl, rx, y - 6, 15, '#F3EAFB', 'right');
    const gx = rx - GAUGE_MAX * 9 + 2, gy = y + 9;
    for (let i = 0; i < GAUGE_MAX; i++) {
      const on = S.power > 0 ? i < Math.ceil((S.power / POWER_TIME) * GAUGE_MAX) : i < S.gauge;
      ctx.fillStyle = on ? (S.power > 0 ? '#FFF3B0' : '#FFC93A') : 'rgba(90,77,128,.8)';
      ctx.fillRect(Math.round((gx + i * 9) * u), Math.round(gy * u), Math.round(7 * u), Math.round(7 * u));
    }
    // 큰 그림자 힘
    const B = S.boss;
    if (B) {
      const p0 = toCss(0, 0), p1 = toCss(S.W, 0);
      const bw = Math.min(300, (p1.x - p0.x) * 0.6), bx = (p0.x + p1.x) / 2 - bw / 2, by = p0.y + 12;
      ctx.fillStyle = 'rgba(10,6,20,.85)';
      ctx.fillRect(Math.round((bx - 2) * u), Math.round((by - 2) * u), Math.round((bw + 4) * u), Math.round(10 * u));
      ctx.fillStyle = B.hp < B.max / 2 ? '#FF6A7A' : '#B08AF0';
      ctx.fillRect(Math.round(bx * u), Math.round(by * u), Math.round(bw * (B.hp / B.max) * u), Math.round(6 * u));
      text(B.name, bx + bw / 2, by + 16, 12, '#F3EAFB');
    }
    // 갑주 기술 (판 왼쪽 아래, 단계만큼 노란 점)
    const cb = toCss(0, S.H);
    let sx2 = c00.x + 8;
    for (const k of SKILL_IDS) {
      const lvK = S.sk[k];
      if (!lvK) continue;
      text(SKILLS[k].icon, sx2 + 10, cb.y - 20, 17);
      for (let i = 0; i < lvK; i++) { ctx.fillStyle = '#FFE58A'; ctx.fillRect(Math.round((sx2 + 3 + i * 5) * u), Math.round((cb.y - 8) * u), Math.round(4 * u), Math.round(4 * u)); }
      sx2 += 25;
    }
    // 판 위에 떠오르는 말 (가짜!, 참소하는 말, 기술 단계)
    const fw = toCss(S.W, 0).x - c00.x;
    for (const tp of S.tips) {
      const p = toCss(tp.x, tp.y), k = tp.life / tp.max;
      ctx.globalAlpha = clamp(k * 2.5, 0, 1);
      // 긴 말은 판 안에 들어오게 가운데 쪽으로 옮기고 두 줄로
      const long = tp.txt.length > 16, px = long ? clamp(p.x, c00.x + fw * 0.3, c00.x + fw * 0.7) : p.x;
      if (long) wrapText(tp.txt, px, p.y - (1 - k) * 18, tp.px, tp.col, fw * 0.6);
      else text(tp.txt, px, p.y - (1 - k) * 18, tp.px, tp.col);
      ctx.globalAlpha = 1;
    }
    // 큰 글
    const c0 = toCss(0, 0), c1 = toCss(S.W, S.H), cx = (c0.x + c1.x) / 2, cy = (c0.y + c1.y) / 2;
    if (S.banner) {
      const B2 = S.banner, k = Math.min(1, B2.t / 0.18, (B2.dur - B2.t) / 0.25);
      ctx.globalAlpha = clamp(k, 0, 1);
      const by2 = B2.minor ? c0.y + (c1.y - c0.y) * 0.3 : cy - 20;
      text(B2.big, cx, by2, B2.minor ? 20 : 30, B2.minor ? '#FFE58A' : '#FFF8E7');
      if (B2.small) wrapText(B2.small, cx, by2 + (B2.minor ? 22 : 32), 15, '#F3EAFB', (c1.x - c0.x) * 0.9);
      ctx.globalAlpha = 1;
    }
    if (S.comboPop) { ctx.globalAlpha = clamp(S.comboPop.life * 2, 0, 1); const p = toCss(S.hero.x, S.hero.y - 16); text(`콤보 ×${S.comboPop.m}!`, p.x, p.y - (1.1 - S.comboPop.life) * 20, 16, '#FFE58A'); ctx.globalAlpha = 1; }
    if (S.hint > 0 && S.wave <= 1 && !frozen) {
      ctx.globalAlpha = clamp(S.hint, 0, 1);
      const shoot = endless ? '움직일 때만 빛이 나가요' : '빛은 저절로 나가요';
      wrapText(('ontouchstart' in window || navigator.maxTouchPoints > 0) ? `화면을 누른 채 밀면 움직여요 · ${shoot}` : `방향키로 움직여요(화면을 눌러 밀어도 돼요) · ${shoot}`, cx, c1.y - 18, 14, '#FFF8E7', (c1.x - c0.x) * 0.92);
      ctx.globalAlpha = 1;
    }
    // 친구 이름 (머리 위)
    if (CO) {
      const now = performance.now();
      for (const rh of S.heroes.values()) {
        if (!rh.ai && now - rh.seen > 8000) continue;
        const p = toCss(rh.x, rh.y - 13);
        text(rh.name + (rh.f ? ' 🙏' : ''), p.x, p.y, 11, rh.f ? '#C9C0E8' : SLOT_COL[rh.slot][0]);
      }
    }
    if (frozen) {
      text('쓰러졌어요', cx, cy - 12, 26, '#F6C2CF');
      text('‘기도하기’를 누르면 다시 일어나요', cx, cy + 18, 15, '#F3EAFB');
    } else if (down && CO) {
      text('쓰러졌어요', cx, cy - 12, 24, '#F6C2CF');
      wrapText(T.selfPray && T.selfPray() ? '‘기도하기’를 누르면 다시 일어나요' : '친구가 ‘친구 기도’를 누르면 다시 일어나요', cx, cy + 16, 14, '#F3EAFB', (c1.x - c0.x) * 0.9);
    }
    // 함께 할 때 기다리는 말
    if (CO && !S.picking && !S.end) {
      const waitPick = HOST ? S.phase === 'pickwait' : S.phase === 'pickhost' && S.myPk >= S.wave;
      if (waitPick) text('친구들이 갑주 기술을 고르고 있어요…', cx, cy, 16, '#FFE58A');
      else if (CL() && S.phase === 'wait') text('방장 화면에서 시작하기를 기다려요…', cx, cy + 40, 15, '#F3EAFB');
      else if (CL() && S.snapAt && performance.now() - S.snapAt > 4000) text('방장 화면과 잠깐 연결이 끊겼어요…', cx, cy + 40, 15, '#F6C2CF');
    }
    // 조이스틱
    if (joy.id !== null && !frozen) {
      ctx.strokeStyle = 'rgba(255,248,231,.35)';
      ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(joy.ox * u, joy.oy * u, 46 * u, 0, TAU); ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, 46 / (d || 1));
      ctx.fillStyle = 'rgba(255,248,231,.45)';
      ctx.beginPath(); ctx.arc((joy.ox + dx * m) * u, (joy.oy + dy * m) * u, 18 * u, 0, TAU); ctx.fill();
    }
  }
  function wrapText(str, x, y, px, col, maxW) {
    const u = L.dpr;
    ctx.font = `${Math.round(px * u)}px ${FONTN || 'sans-serif'}`;
    if (ctx.measureText(str).width <= maxW * u) { text(str, x, y, px, col); return; }
    // 반쯤에서 띄어쓰기로 두 줄
    const mid = Math.floor(str.length / 2);
    let cut = str.lastIndexOf(' ', mid);
    if (cut < 0) cut = str.indexOf(' ', mid);
    if (cut < 0) { text(str, x, y, px * 0.85, col); return; }
    text(str.slice(0, cut), x, y, px, col);
    text(str.slice(cut + 1), x, y + px * 1.3, px, col);
  }

  return {
    begin, update, onKey, onPray, stop, finish, onNet, promote,
    get overlay() { return overlay; },
    get coop() { return !!CO; },
    info: () => ({
      phase: S.phase, wave: S.wave, waves: endless ? null : roomWaves.length, cleared: S.cleared, score: S.score, foes: S.foes.length, portals: S.portals.length, queue: S.queue.length,
      boss: S.boss ? { hp: S.boss.hp, max: S.boss.max, st: S.boss.st } : null, hero: { x: Math.round(S.hero.x), y: Math.round(S.hero.y) }, field: [S.W, S.H, L ? L.s : 0],
      ms: started ? Math.round(performance.now() - t0) : 0, power: +S.power.toFixed(1), gauge: S.gauge, combo: S.combo, mult: S.mult, kills: S.kills, items: S.items.length, orbs: S.orbs.length, overlay,
      sk: { ...S.sk }, pick: S.pick ? [...S.pick] : null, guard: S.guard, bossKind: S.boss ? S.boss.kind : null, decoys: S.decoys.length,
      coop: !!CO, host: HOST, party: S.partyMax, friends: [...S.heroes.values()].map((rh) => ({ id: rh.id, x: Math.round(rh.x), y: Math.round(rh.y), f: rh.f, ai: rh.ai, pk: rh.pk, age: Math.round(performance.now() - rh.seen) })), pickWaitT: +S.pickWaitT.toFixed(1),
      myPk: S.myPk, picking: S.picking, bossMad: S.boss ? !!S.boss.mad : false,
      bombs: S.bombs.length, kinds: S.foes.map((f) => f.kind), lasers: S.foes.filter((f) => f.st === 'lzAim' || f.st === 'lzFire').map((f) => f.st), stillTips: S.stillTips,
    }),
    // 시험용: 지금 있는 그림자를 모두 물리치고 남은 물결을 비운다 / 큰 그림자에게 바로 / 큰 그림자 힘을 1로
    debugKill: () => { S.queue.length = 0; S.portals.length = 0; for (const f of [...S.foes]) kill(f); },
    debugBoss: (kind) => { if (kind) S.forceBoss = kind; S.queue.length = 0; S.portals.length = 0; S.foes.length = 0; closePick(); S.pick = null; S.picking = false; S.wave = endless ? Math.floor(S.wave / 5) * 5 + 4 : roomWaves.length; nextWave(); },
    debugSkill: (k, n = 1) => { if (SKILLS[k]) { S.sk[k] = clamp(n, 0, 3); if (k === 'breast' && n) S.guard = true; } },
    debugChoose: (i = 0) => { if (S.pick && S.pick[i]) choose(S.pick[i]); },
    debugGod: (on = true) => { S.god = on; },
    // 시험용: n번째 물결로 바로 (방장 화면)
    debugWave: (n) => { S.queue.length = 0; S.portals.length = 0; S.foes.length = 0; closePick(); S.pick = null; S.picking = false; S.wave = Math.max(0, n - 1); nextWave(); },
    debugBossLow: () => { if (S.boss) S.boss.hp = 1; },
    debugHero: (x, y) => { S.hero.x = x; S.hero.y = y; },
  };
}
