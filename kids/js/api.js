// 진숲 어린이 마을 — 서버 호출
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const DEMO = new URLSearchParams(location.search).has('demo') || window.KV_FORCE_DEMO === true;
const demo = DEMO ? new (await import('./demo.js')).DemoBackend() : null;

export class ApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function rpc(fn, args = {}) {
  if (demo) {
    await new Promise((r) => setTimeout(r, 120));
    return demo.call(fn, JSON.parse(JSON.stringify(args)));
  }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify(args),
    });
  } catch (e) {
    throw new ApiError('NETWORK');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!res.ok) throw new ApiError((data && data.message) || `HTTP_${res.status}`);
  return data;
}

const MESSAGES = {
  LOGIN_FAILED: '아이디나 비밀번호가 맞지 않아요.',
  LOCKED: '여러 번 틀려서 잠시 잠겼어요. 10분 뒤에 다시 하거나 선생님께 말해 주세요.',
  SESSION: '다시 로그인해 주세요.',
  NETWORK: '마을에 연결하지 못했어요. 인터넷을 확인해 주세요. 계속 안 되면 선생님께 알려 주세요.',
  BAD_NAME: '이름은 1~10글자로 써 주세요.',
  BAD_AVATAR: '꾸민 모습을 저장하지 못했어요. 다시 해 볼까요?',
  NOT_FOUND: '찾을 수 없어요. 화면을 새로 고쳐 주세요.',
  // 선생님 화면
  BAD_LOGIN_ID: '아이디는 한글·영문·숫자 2~12글자로 정해 주세요.',
  BAD_PIN: '아이 비밀번호는 숫자 4~6자리로 정해 주세요.',
  BAD_BIRTHDATE: '생년월일을 다시 확인해 주세요.',
  NO_CONSENT: '보호자 동의서를 받은 날짜를 넣어 주세요.',
  DUPLICATE_ID: '이미 쓰고 있는 아이디예요. 다른 아이디를 정해 주세요.',
  WEAK_PASSWORD: '비밀번호는 8글자 이상으로 정해 주세요.',
  WRONG_PASSWORD: '지금 비밀번호가 맞지 않아요.',
  BAD_CODE: '설정 코드가 맞지 않아요.',
  ALREADY: '이미 선생님 계정이 있어요. 로그인해 주세요.',
  BAD_REF: '구절 위치를 1~60글자로 써 주세요.',
  BAD_BODY: '구절 내용을 써 주세요. (1000글자까지)',
  NOT_PUBLISHED: '아이들에게 공개한 구절만 이번 주 말씀으로 정할 수 있어요.',
  CANNOT_DELETE_SELF: '지금 로그인한 선생님 계정은 지울 수 없어요.',
  EMPTY_ANSWER: '내 생각을 한 줄이라도 써 주세요.',
  TOO_LONG: '글이 너무 길어요. 조금 줄여 주세요.',
  SELF_REACTION: '내 글에는 응원을 보낼 수 없어요.',
  BAD_REACTION: '응원을 보내지 못했어요.',
  BAD_WEEK: '주간 계획은 주일(일요일) 날짜로 시작해야 해요.',
  NO_WEEK: '먼저 그 주의 주간 계획을 저장해 주세요.',
  BAD_PASSAGE: '본문은 한 줄에 한 절씩, "1 본문" 모양으로 써 주세요.',
  BAD_QUESTIONS: '질문은 한 줄에 하나씩, 다섯 개까지 쓸 수 있어요.',
  BAD_IMAGE: '사진이나 그림을 읽지 못했어요. 다시 해 볼까요?',
  IMAGE_TOO_BIG: '사진이 너무 커요. 다른 사진으로 해 볼까요?',
  ART_FULL: '그림을 40장까지 둘 수 있어요. 내 그림에서 하나를 지우고 다시 해 봐요.',
  ART_DAY: '오늘은 그림을 10장 그렸어요. 내일 또 그려요!',
  TOO_FAST: '조금만 쉬었다가 해요.',
  FISH_TIRED: '오늘은 물고기들이 쉬고 싶대요. 내일 또 와요!',
  NO_FISH: '물고기가 도망갔어요. 다시 던져 볼까요?',
  BAD_DISH: '요리 재료를 다시 골라 볼까요?',
  DISH_DAY: '오늘은 요리를 많이 올렸어요. 내일 또 만들어요!',
  OWN_DISH: '내가 만든 요리예요. 친구들이 먹으러 올 거예요!',
  BUG_DAY: '오늘은 곤충을 많이 잡았어요. 내일 또 잡아요!',
  BAD_BUG: '이 곤충은 잡을 수 없어요.',
  NO_FRUIT: '열매가 모자라요. 암송, 묵상, 필사를 하면 열매가 모여요.',
  BAG_FULL: '가방이 가득 찼어요. 불꽃을 먼저 터트려 봐요!',
  NO_ITEM: '가방에 그 물건이 없어요. 화면을 새로 열어 볼까요?',
  BAD_ITEM: '살 수 없는 물건이에요.',
  HAVE_PET: '벌써 우리 집 친구예요! 가방에서 데리고 다닐 수 있어요.',
  BAD_HOME: '집을 저장하지 못했어요. 다시 해 볼까요?',
  NOT_ENOUGH: '가진 물건보다 많이 놓을 수 없어요. 열매 상점에서 더 살 수 있어요.',
  BAD_KIND: '종류를 다시 골라 주세요.',
  EMPTY_FEEDBACK: '두 글자 넘게 써 주세요.',
  FEEDBACK_DAY: '오늘 넣을 수 있는 건의를 다 넣었어요. 내일 또 들려줘요!',
  HAVE_ITEM: '벌써 산 물건이에요! 옷장에서 입어 봐요.',
  NEED_ITEM: '🔒 표시가 있는 물건은 열매 상점에서 사야 입을 수 있어요.',
  SELL_DAY: '오늘 팔아서 받을 수 있는 열매를 다 받았어요. 내일 또 팔아요!',
  SELL_CLOSED: '지금은 팔기를 쉬고 있어요. 선생님께 물어보세요.',
  BAD_GIFT: '선물을 보내지 못했어요. 다시 골라 볼까요?',
  GIFT_DAY: '오늘은 선물을 많이 보냈어요. 선물은 하루에 열매 10개까지 보낼 수 있어요.',
  APP_OLD: '마을이 새로워졌어요. 화면을 새로 고쳐 주세요.',
  BAD_SALE: '할인은 0~50% 사이에서 10%씩, 팔기 한도는 0~30개로 정해 주세요.',
  NO_PET: '아직 데려오지 않은 친구예요. 열매 상점에서 데려와요.',
  CHAT_OFF: '지금은 글 대화가 꺼져 있어요. 말풍선 단추로 말해요.',
  CHAT_MUTED: '선생님이 글 대화를 잠시 쉬게 했어요. 말풍선 단추로 말해요.',
  EMPTY_CHAT: '할 말을 써 주세요.',
  CHAT_TIRED: '오늘은 글을 많이 썼어요. 내일 또 이야기해요!',
  BAD_STARS: '요리 기록을 저장하지 못했어요.',
  PLAY_LOCKED: '놀이 마당은 오늘의 말씀 활동을 하나 마치면 열려요.',
  BAD_JOIN_CODE: '가입 코드가 맞지 않아요. 선생님께 코드를 다시 물어보세요.',
  SIGNUP_CLOSED: '지금은 가입을 받지 않아요. 선생님께 말해 주세요.',
  SIGNUP_BUSY: '잠시 뒤에 다시 해 주세요.',
  NO_AGREE: '보호자와 함께 읽고 동의 칸에 표시해 주세요.',
  ALREADY_JOINED: '같은 이름과 생일로 이미 가입한 친구가 있어요. 아이디를 잊었다면 선생님께 물어보세요.',
  BAD_JOIN_CODE_FORMAT: '가입 코드는 한글·영문·숫자 4~12글자로 정해 주세요.',
};

export function message(err) {
  const code = (err && (err.code || err.message)) || '';
  if (MESSAGES[code]) return MESSAGES[code];
  if (String(code).startsWith('HTTP_5')) return '마을 서버가 잠시 쉬고 있어요. 조금 뒤에 다시 해 주세요.';
  return '문제가 생겼어요. 잠시 뒤 다시 해 주세요.';
}

const prefix = DEMO ? 'kv.demo.' : 'kv.';
// 체험판은 탭마다 따로 로그인할 수 있게 (두 탭으로 함께 접속을 시험해 볼 수 있다)
const box = () => (DEMO ? window.sessionStorage : window.localStorage);
export const store = {
  get(k) { try { return box().getItem(prefix + k); } catch (e) { return null; } },
  set(k, v) { try { box().setItem(prefix + k, v); } catch (e) { /* 저장 못 해도 계속 */ } },
  del(k) { try { box().removeItem(prefix + k); } catch (e) { /* 무시 */ } },
};
