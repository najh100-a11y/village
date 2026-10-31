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
    lead: '묵상은 하나님 말씀을 천천히 읽고, 그 말씀에 머물고, 하나님께 이야기하는 시간이에요. 교회는 아주 오래전부터 이렇게 말씀을 읽어 왔어요. 이것을 렉시오 디비나(거룩한 읽기)라고 불러요.',
    steps: [
      ['읽어요', '"하나님, 말씀해 주세요." 하고 짧게 기도한 뒤, 오늘 말씀을 천천히 두 번 읽어요. 한 번은 소리 내어 읽어도 좋아요.'],
      ['머물러요', '마음에 닿은 낱말이나 말 하나를 눌러 골라요. 그 말을 마음속으로 몇 번 되뇌어 봐요.'],
      ['생각해요', '짧은 해설을 읽고, 질문에 내 생각을 한두 줄 써요. 정답이 하나만 있는 건 아니에요.'],
      ['기도해요', '고른 말을 넣어 하나님께 내 마음을 이야기해요.'],
      ['쉬어요', '잠깐 조용히 하나님과 함께 있어요. 그리고 오늘 해 볼 일 하나를 정해요.'],
    ],
  },
  copy: {
    title: '필사는 이렇게 해요',
    lead: '주마다 하나님 나라 이야기 한 편을 읽고 한 글자씩 따라 쓰며 마음에 새겨요. 성경의 이야기들은 모두 하나의 큰 이야기로 이어져 있어요.',
    steps: [
      ['먼저 읽어요', '이번 주 이야기를 처음부터 끝까지 한 번 읽어요. 지난 이야기와 어떻게 이어지는지도 떠올려 봐요.'],
      ['한 문단씩 천천히', '화면에 손가락으로 따라 쓰거나, 공책에 연필로 한 문단씩 써요. 공책에 썼다면 사진을 찍어 올려도 돼요.'],
      ['예쁘게보다 정성껏', '글씨가 삐뚤어도 괜찮아요. 천천히 마음을 담아 써요.'],
      ['나눠 써도 돼요', '하루에 다 못 써도 괜찮아요. 일주일 동안 나눠 써요.'],
      ['한 줄 느낌', '다 쓰고 나면 마음에 남은 말을 한 줄로 적어요.'],
    ],
  },
};

export function guideCard(kind, { compact = false, extra = null } = {}) {
  const g = GUIDES[kind];
  const steps = extra ? [...g.steps, extra] : g.steps;
  return h('section', { class: 'guide' + (compact ? ' compact' : '') },
    h('h3', {}, g.title),
    h('p', { class: 'guide-lead' }, g.lead),
    h('ol', { class: 'guide-steps' }, steps.map(([t, d]) => h('li', {}, h('b', {}, t), h('span', {}, d)))));
}
// 필사 공책 사진 열매 안내 (서버가 준비되었을 때만 보여 준다)
export const COPY_PHOTO_STEP = ['공책 사진은 열매 10개', '공책에 손으로 다 쓰고 사진을 찍어 올리면 열매 10개를 받아요. 화면에 따라 쓰거나 공책 체크로 마치면 2개예요.'];

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
    if (e.text) body = h('p', { class: 'fb-text' }, e.word ? h('span', { class: 'fb-word' }, `마음에 닿은 말 · ${e.word}`) : null, e.text);
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

// 이야기(필사)는 절 번호 없이 문단으로 쓴다
export const isStory = (passage) => Array.isArray(passage) && passage.length > 0 && passage.every((v) => !v.n);
export function passageBlock(passage) {
  if (isStory(passage)) return h('div', { class: 'passage story' }, passage.map((v) => h('p', {}, v.t)));
  return h('div', { class: 'passage' }, passage.map((v) => h('p', {}, h('sup', {}, v.n), v.t)));
}

export function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const w = ['주일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${w}`;
}
