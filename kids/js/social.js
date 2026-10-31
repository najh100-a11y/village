// 진숲 어린이 마을 — 집마다 쓰는 "먼저 해낸 친구들" 판, 반응 단추, 가이드
import { h, toast, josa } from './ui.js';
import { message } from './api.js';
import { drawFaceIcon, normalizeAvatar } from './face.js';

export const REACTIONS = [
  ['clap', '👏', '박수'],
  ['heart', '❤️', '좋아요'],
  ['pray', '🙏', '기도할게'],
  ['metoo', '💪', '나도 할래'],
];

export const GUIDES = {
  memory: {
    title: '말씀 외우기는 이렇게 해요',
    lead: '이번 주 말씀을 일주일 동안 마음에 담아요.',
    steps: [
      ['소리 내어 세 번', '말씀을 천천히, 소리 내어 세 번 읽어요. 장과 절도 같이 읽어요.'],
      ['빈칸 채우기', '빠진 낱말을 찾아 넣으면서 말씀을 떠올려요.'],
      ['순서대로 놓기', '낱말을 처음부터 차례대로 놓아 보면 거의 다 외운 거예요.'],
      ['날마다 한 번', '하루에 한 번씩 연습하면 일주일 뒤에는 술술 나와요.'],
      ['선생님께 들려드리기', '다 외우면 선생님 앞에서 외워 보세요. 도장을 받아요!'],
    ],
  },
  qt: {
    title: '묵상은 이렇게 해요',
    lead: '묵상은 하나님 말씀을 천천히 읽고, 마음에 담고, 하나님께 이야기하는 시간이에요.',
    steps: [
      ['조용히 시작해요', '눈을 감고 "하나님, 말씀해 주세요." 하고 짧게 기도해요.'],
      ['두 번 읽어요', '오늘 말씀을 천천히 두 번 읽어요. 한 번은 소리 내어 읽어도 좋아요.'],
      ['생각해 봐요', '질문을 읽고 말씀 속에서 답을 찾아요. 정답이 하나만 있는 건 아니에요.'],
      ['적어 봐요', '내 생각을 한두 줄로 짧게 써요. 길게 쓰지 않아도 괜찮아요.'],
      ['기도하고 해 봐요', '하나님께 내 마음을 이야기하고, 오늘 해 볼 일 하나를 정해요.'],
    ],
  },
  copy: {
    title: '필사는 이렇게 해요',
    lead: '필사는 말씀을 한 글자씩 따라 쓰면서 마음에 새기는 거예요.',
    steps: [
      ['먼저 읽어요', '이번 주 이야기를 처음부터 끝까지 한 번 읽어요.'],
      ['한 절씩 천천히', '화면에 손가락으로 따라 쓰거나, 공책에 연필로 한 절씩 써요. 공책에 썼다면 사진을 찍어 올려도 돼요.'],
      ['예쁘게보다 정성껏', '글씨가 삐뚤어도 괜찮아요. 천천히 마음을 담아 써요.'],
      ['나눠 써도 돼요', '하루에 다 못 써도 괜찮아요. 일주일 동안 나눠 써요.'],
      ['한 줄 느낌', '다 쓰고 나면 마음에 남은 말을 한 줄로 적어요.'],
    ],
  },
};

export function guideCard(kind, { compact = false } = {}) {
  const g = GUIDES[kind];
  return h('section', { class: 'guide' + (compact ? ' compact' : '') },
    h('h3', {}, g.title),
    h('p', { class: 'guide-lead' }, g.lead),
    h('ol', { class: 'guide-steps' }, g.steps.map(([t, d]) => h('li', {}, h('b', {}, t), h('span', {}, d)))));
}

// 처음 들어온 집이면 가이드를 먼저 보여 준다 (기기마다 한 번)
export function firstVisit(kind) {
  const key = `kv.guide.${kind}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch (e) { return false; }
  return true;
}

function face(avatar) {
  const cv = h('canvas', { width: 80, height: 80, class: 'fb-face', 'aria-hidden': 'true' });
  drawFaceIcon(cv, normalizeAvatar(avatar));
  return cv;
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours() < 12 ? '오전' : '오후'} ${((d.getHours() + 11) % 12) + 1}시 ${String(d.getMinutes()).padStart(2, '0')}분`;
}

export function reactionBar(entry, { kind, key, rpc, getToken, onSessionLost }) {
  const counts = { ...(entry.reactions && entry.reactions.counts) };
  const mine = new Set((entry.reactions && entry.reactions.mine) || []);
  const bar = h('div', { class: 'rx' + (entry.me ? ' mine' : '') });
  const draw = () => {
    bar.replaceChildren(...REACTIONS.filter(([id]) => !entry.me || counts[id]).map(([id, emo, label]) => {
      const n = counts[id] || 0;
      if (entry.me) {
        return n ? h('span', { class: 'rx-got', title: label }, emo, h('b', {}, String(n))) : null;
      }
      return h('button', {
        class: 'rx-btn', type: 'button', 'aria-pressed': String(mine.has(id)), title: label,
        onclick: async (e) => {
          const on = !mine.has(id);
          e.currentTarget.disabled = true;
          try {
            const r = await rpc('kids_react', { p_token: getToken(), p_kind: kind, p_target: entry.child || entry.id, p_key: entry.key || key, p_reaction: id, p_on: on });
            Object.keys(counts).forEach((k) => delete counts[k]);
            Object.assign(counts, r.counts || {});
            mine.clear();
            (r.mine || []).forEach((m) => mine.add(m));
            if (on) toast({
              clap: `${entry.name}에게 박수를 보냈어요`,
              heart: `${entry.name}에게 마음을 보냈어요`,
              pray: `${josa(entry.name, '을', '를')} 위해 기도할게요`,
              metoo: `${entry.name}처럼 나도 해 볼래요!`,
            }[id]);
          } catch (err) {
            if (err.code === 'SESSION') return onSessionLost();
            toast(message(err));
          }
          draw();
        },
      }, h('span', { class: 'rx-emo' }, emo), h('span', { class: 'rx-label' }, label), n ? h('b', {}, String(n)) : null);
    }));
    if (entry.me && !bar.children.length) bar.append(h('span', { class: 'rx-none' }, '친구들의 응원을 기다려요'));
  };
  draw();
  return bar;
}

// entries: [{id, name, avatar, me, at, text, private, hidden, passed, count, reactions}]
export function friendBoard({ title, empty, entries, kind, key, rpc, getToken, onSessionLost, badge, extra }) {
  const wrap = h('section', { class: 'fboard' },
    h('div', { class: 'sub-head' }, h('h3', {}, title), h('p', {}, entries.length ? `${entries.length}명` : '')));
  if (!entries.length) {
    wrap.append(h('p', { class: 'fb-empty' }, empty));
    return wrap;
  }
  const list = h('ol', { class: 'fb-list' });
  entries.forEach((e, i) => {
    const rank = i < 3 ? h('span', { class: `fb-rank r${i + 1}`, title: `${i + 1}번째` }, String(i + 1)) : h('span', { class: 'fb-rank' }, String(i + 1));
    let body = null;
    if (e.text) body = h('p', { class: 'fb-text' }, e.text);
    else if (e.hidden && e.me) body = h('p', { class: 'fb-note' }, '선생님이 이 글을 친구들에게 보이지 않게 해 두었어요.');
    else if (e.private) body = h('p', { class: 'fb-note' }, e.me ? '나만 보기로 했어요.' : '글은 나만 보기로 했대요.');
    list.append(h('li', { class: 'fb-item' + (e.me ? ' me' : '') },
      rank,
      face(e.avatar),
      h('div', { class: 'fb-main' },
        h('div', { class: 'fb-name' }, e.name, e.me ? h('span', { class: 'tag tag-soft' }, '나') : null, badge ? badge(e) : null,
          h('span', { class: 'fb-time' }, timeLabel(e.at))),
        body,
        extra ? extra(e) : null,
        reactionBar(e, { kind, key, rpc, getToken, onSessionLost }))));
  });
  wrap.append(list);
  return wrap;
}

export function passageBlock(passage) {
  return h('div', { class: 'passage' }, passage.map((v) => h('p', {}, h('sup', {}, v.n), v.t)));
}

export function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const w = ['주일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}`;
}
