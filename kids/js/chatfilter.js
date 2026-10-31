// 진숲 어린이 마을 — 마을 글 대화 다듬기
// 서버 함수 kids__chat_clean(sql/2026-10-31-chat-and-free-play.sql)과 같은 규칙이다.
// 보낼 때는 서버가 다듬은 글만 친구들에게 가고, 받을 때도 한 번 더 다듬는다.

export const CHAT_MAX = 40; // 아이가 한 번에 쓸 수 있는 글자 수 (서버는 60자까지 받는다)

const BAD = /(씨발|시발|씨빨|씨바|시바(?!견)|ㅅ ?ㅂ|ㅆ ?ㅂ|병 ?신|븅 ?신|ㅂ ?ㅅ|개 ?새|ㅅ ?ㄲ|좆|지 ?랄|ㅈ ?ㄹ|ㅈ ?ㄴ|엠 ?창|fuck|shit|bitch|존나|졸라|닥쳐|꺼져|미친|ㅁㅊ|애미|느금|등신|멍청이|바보|찐따|죽여|죽을래)/gi;

export function cleanChat(s) {
  let t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  t = [...t].slice(0, 60).join('');
  t = t.replace(/[0-9０-９][0-9０-９ .\-]{5,}[0-9０-９]/g, '***'); // 전화번호, 긴 숫자
  t = t.replace(/(https?:\/\/|www\.)[^ ]*/gi, '***'); // 인터넷 주소
  t = t.replace(/[^ ]+\.(com|net|kr|org|io|me|ly|gg|co)([^a-z]|$)/gi, '***');
  t = t.replace(BAD, '♡'); // 거친 말, 놀리는 말
  return t;
}
