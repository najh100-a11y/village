-- 진숲 어린이 마을: 하나님 나라 이야기 필사와 렉시오 디비나 묵상
-- 묵상에 짧은 해설(note)을 더하고, 아이가 고른 '마음에 닿은 말'(word)을 저장한다.
-- 필사 이야기는 기존 칸을 그대로 쓴다(이야기 제목은 theme, 성경 범위는 copy_ref, 문단은 n이 빈 copy_passage).
-- 다시 실행해도 된다.

alter table public.kids_qt add column if not exists note text not null default '';
alter table public.kids_qt_entries add column if not exists word text;

-- 아이: 날마다 묵상 (해설, 내가 고른 말, 친구들이 고른 말)
create or replace function public.kids_qt_day(p_token text, p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        v_day date; q public.kids_qt; w public.kids_weeks; e public.kids_qt_entries;
begin
  v_day := coalesce(p_day, v_today);
  select q2.* into q from public.kids_qt q2 join public.kids_weeks w2 on w2.week_start = q2.week_start
   where w2.is_published and q2.day = v_day and q2.day <= v_today;
  if not found then
    select q2.* into q from public.kids_qt q2 join public.kids_weeks w2 on w2.week_start = q2.week_start
     where w2.is_published and q2.day <= least(v_day, v_today) order by q2.day desc limit 1;
  end if;
  if not found then
    return jsonb_build_object('qt', null,
      'next_start', (select min(q2.day) from public.kids_qt q2 join public.kids_weeks w2 on w2.week_start = q2.week_start where w2.is_published));
  end if;
  select * into w from public.kids_weeks where week_start = q.week_start;
  select * into e from public.kids_qt_entries where child_id = v_id and day = q.day;
  return jsonb_build_object(
    'qt', jsonb_build_object('day', q.day, 'title', q.title, 'ref', q.ref, 'passage', q.passage, 'questions', q.questions,
            'prayer', q.prayer, 'action', q.action, 'note', q.note, 'theme', w.theme, 'is_today', q.day = v_today),
    'prev', (select max(q2.day) from public.kids_qt q2 join public.kids_weeks w2 on w2.week_start = q2.week_start where w2.is_published and q2.day < q.day),
    'next', (select min(q2.day) from public.kids_qt q2 join public.kids_weeks w2 on w2.week_start = q2.week_start where w2.is_published and q2.day > q.day and q2.day <= v_today),
    'mine', case when e.child_id is null then null else jsonb_build_object('answer', e.answer, 'prayer', e.prayer, 'word', e.word, 'shared', e.shared, 'hidden', e.hidden) end,
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'at', x.created_at,
        'text', case when c.id = v_id or (x.shared and not x.hidden) then x.answer else null end,
        'word', case when c.id = v_id or (x.shared and not x.hidden) then x.word else null end,
        'private', not x.shared, 'hidden', x.hidden,
        'reactions', public.kids__reactions('qt', q.day::text, c.id, v_id)) order by x.created_at)
      from public.kids_qt_entries x join public.kids_children c on c.id = x.child_id
      where x.day = q.day and c.village_name is not null), '[]'::jsonb));
end $$;

-- 아이: 묵상 저장 (마음에 닿은 말을 함께 저장한다. 예전 화면은 p_word 없이 불러도 된다)
drop function if exists public.kids_qt_save(text, date, text, text, boolean);
create or replace function public.kids_qt_save(p_token text, p_day date, p_answer text, p_prayer text, p_shared boolean, p_word text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_answer text := btrim(coalesce(p_answer, '')); v_prayer text := btrim(coalesce(p_prayer, ''));
        v_word text := nullif(btrim(coalesce(p_word, '')), '');
begin
  if not exists (select 1 from public.kids_qt q join public.kids_weeks w on w.week_start = q.week_start
                 where q.day = p_day and w.is_published and q.day <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  if char_length(v_answer) < 1 then raise exception 'EMPTY_ANSWER'; end if;
  if char_length(v_answer) > 400 or char_length(v_prayer) > 400 or char_length(coalesce(v_word, '')) > 60 then raise exception 'TOO_LONG'; end if;
  if not exists (select 1 from public.kids_qt_entries where child_id = v_id and day = p_day) then v_gain := 1; end if;
  insert into public.kids_qt_entries as e (child_id, day, answer, prayer, shared, word)
  values (v_id, p_day, v_answer, v_prayer, coalesce(p_shared, true), v_word)
  on conflict (child_id, day) do update set answer = excluded.answer, prayer = excluded.prayer,
    shared = excluded.shared, word = coalesce(excluded.word, e.word), updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;
grant execute on function public.kids_qt_save(text, date, text, text, boolean, text) to anon, authenticated;

-- 선생님: 묵상 저장 (해설을 함께 저장한다. 예전 화면은 p_note 없이 불러도 되고, 그때는 해설을 그대로 둔다)
drop function if exists public.kids_t_save_qt(text, date, text, text, jsonb, jsonb, text, text);
create or replace function public.kids_t_save_qt(p_token text, p_day date, p_title text, p_ref text, p_passage jsonb, p_questions jsonb,
  p_prayer text, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_week date := public.kids__week_of(p_day);
begin
  if not exists (select 1 from public.kids_weeks where week_start = v_week) then raise exception 'NO_WEEK'; end if;
  perform public.kids__check_passage(p_passage);
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 5
     or exists (select 1 from jsonb_array_elements(p_questions) e where jsonb_typeof(e) <> 'string') then
    raise exception 'BAD_QUESTIONS';
  end if;
  if char_length(coalesce(p_title, '')) > 40 or char_length(coalesce(p_ref, '')) > 60
     or char_length(coalesce(p_prayer, '')) > 400 or char_length(coalesce(p_action, '')) > 300
     or char_length(coalesce(p_note, '')) > 600 then
    raise exception 'TOO_LONG';
  end if;
  insert into public.kids_qt as q (day, week_start, title, ref, passage, questions, prayer, action, note)
  values (p_day, v_week, btrim(coalesce(p_title, '')), btrim(coalesce(p_ref, '')), p_passage, p_questions,
          btrim(coalesce(p_prayer, '')), btrim(coalesce(p_action, '')), btrim(coalesce(p_note, '')))
  on conflict (day) do update set title = excluded.title, ref = excluded.ref, passage = excluded.passage,
    questions = excluded.questions, prayer = excluded.prayer, action = excluded.action,
    note = case when p_note is null then q.note else excluded.note end;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.kids_t_save_qt(text, date, text, text, jsonb, jsonb, text, text, text) to anon, authenticated;

-- 선생님: 주간 계획 보기 (해설 포함)
create or replace function public.kids_t_weeks(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'week_start', w.week_start, 'theme', w.theme, 'verse_id', w.verse_id, 'copy_ref', w.copy_ref, 'copy_intro', w.copy_intro,
      'copy_passage', w.copy_passage, 'is_published', w.is_published,
      'days', coalesce((select jsonb_agg(jsonb_build_object('day', q.day, 'title', q.title, 'ref', q.ref, 'passage', q.passage,
          'questions', q.questions, 'prayer', q.prayer, 'action', q.action, 'note', q.note,
          'done_count', (select count(*) from public.kids_qt_entries e where e.day = q.day)) order by q.day)
        from public.kids_qt q where q.week_start = w.week_start), '[]'::jsonb),
      'copy_count', (select count(*) from public.kids_copy_entries e where e.week_start = w.week_start))
    order by w.week_start) from public.kids_weeks w), '[]'::jsonb);
end $$;

-- 화면이 서버에 어떤 기능이 있는지 묻는다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true, 'lectio', true)
$$;
