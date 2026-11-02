-- 진숲 어린이 마을: 열매 규칙 바꾸기, 매일 묵상해야 놀이 마당이 열리기, 마을에 없는 친구에게도 쪽지
-- 다시 실행해도 된다.

-- ---------- 열매 ----------
-- 암송 연습: 구절마다 하루 1개 (그대로)
-- 묵상: 그날 묵상을 처음 마치면 2개 (예전 1개)
-- 필사: 이번 주 필사를 처음 마치면 3개 (예전 2개). 공책 사진을 올리면 이번 주 필사 열매가 모두 10개
--       (처음 올리면 10개, 3개를 이미 받았으면 7개 더. 예전 규칙으로 2개를 받은 주는 8개 더)

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
  if not exists (select 1 from public.kids_qt_entries where child_id = v_id and day = p_day) then v_gain := 2; end if;
  insert into public.kids_qt_entries as e (child_id, day, answer, prayer, shared, word)
  values (v_id, p_day, v_answer, v_prayer, coalesce(p_shared, true), v_word)
  on conflict (child_id, day) do update set answer = excluded.answer, prayer = excluded.prayer,
    shared = excluded.shared, word = coalesce(excluded.word, e.word), updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits, 'streak', public.kids__qt_streak(v_id));
end $$;

-- 필사 열매로 이미 받은 수 (사진 열매를 셈할 때 쓴다). 예전 규칙으로 마친 주는 비어 있다(2개로 본다)
alter table public.kids_copy_entries add column if not exists copy_paid int;

create or replace function public.kids_copy_save(p_token text, p_week date, p_note text, p_shared boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_note text := btrim(coalesce(p_note, ''));
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  if char_length(v_note) > 300 then raise exception 'TOO_LONG'; end if;
  if not exists (select 1 from public.kids_copy_entries where child_id = v_id and week_start = p_week) then v_gain := 3; end if;
  insert into public.kids_copy_entries as e (child_id, week_start, note, shared, copy_paid)
  values (v_id, p_week, v_note, coalesce(p_shared, true), 3)
  on conflict (child_id, week_start) do update set note = excluded.note, shared = excluded.shared, updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

create or replace function public.kids_copy_photo(p_token text, p_week date, p_photo text, p_thumb text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_photo bytea; v_thumb bytea; e public.kids_copy_entries;
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  v_photo := public.kids__image(p_photo, 450000);
  v_thumb := public.kids__image(p_thumb, 40000);
  if v_photo is null or v_thumb is null then raise exception 'BAD_IMAGE'; end if;
  select * into e from public.kids_copy_entries where child_id = v_id and week_start = p_week;
  if e.child_id is null then v_gain := 10;
  elsif not e.photo_paid then v_gain := greatest(0, 10 - coalesce(e.copy_paid, 2));
  end if;
  insert into public.kids_copy_entries as x (child_id, week_start, note, shared, photo, photo_thumb, photo_ok, photo_at, photo_paid, copy_paid)
  values (v_id, p_week, '', true, v_photo, v_thumb, false, now(), true, 10)
  on conflict (child_id, week_start) do update
    set photo = excluded.photo, photo_thumb = excluded.photo_thumb, photo_ok = false, photo_at = now(), photo_paid = true,
        copy_paid = case when x.photo_paid then x.copy_paid else 10 end, updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

-- 필사 화면: 이번 주에 이미 받은 필사 열매(paid)를 함께 준다 (사진을 올리면 몇 개를 더 받는지 보여 주려고)
create or replace function public.kids_copy_week(p_token text, p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        w public.kids_weeks; e public.kids_copy_entries;
begin
  select * into w from public.kids_weeks
   where is_published and copy_ref <> '' and week_start <= public.kids__week_of(least(coalesce(p_week, v_today), v_today))
   order by week_start desc limit 1;
  if not found then
    return jsonb_build_object('week', null, 'next_start', (select min(week_start) from public.kids_weeks where is_published and copy_ref <> ''));
  end if;
  select * into e from public.kids_copy_entries where child_id = v_id and week_start = w.week_start;
  return jsonb_build_object(
    'week', jsonb_build_object('week_start', w.week_start, 'theme', w.theme, 'ref', w.copy_ref, 'intro', w.copy_intro,
              'passage', w.copy_passage, 'is_current', w.week_start = public.kids__week_of(v_today)),
    'prev', (select max(week_start) from public.kids_weeks where is_published and copy_ref <> '' and week_start < w.week_start),
    'next', (select min(week_start) from public.kids_weeks where is_published and copy_ref <> '' and week_start > w.week_start and week_start <= v_today),
    'mine', case when e.child_id is null then null else jsonb_build_object('note', e.note, 'shared', e.shared, 'hidden', e.hidden,
              'has_photo', e.photo is not null, 'photo_ok', e.photo_ok, 'photo_paid', e.photo_paid, 'paid', coalesce(e.copy_paid, 2),
              'thumb', public.kids__b64(e.photo_thumb)) end,
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'at', x.created_at,
        'text', case when c.id = v_id or (x.shared and not x.hidden) then nullif(x.note, '') else null end,
        'private', not x.shared, 'hidden', x.hidden,
        'has_photo', x.photo is not null,
        'photo_wait', c.id = v_id and x.photo is not null and not x.photo_ok,
        'thumb', case when x.photo is not null and (c.id = v_id or (x.photo_ok and x.shared and not x.hidden))
                      then public.kids__b64(x.photo_thumb) else null end,
        'reactions', public.kids__reactions('copy', w.week_start::text, c.id, v_id)) order by x.created_at)
      from public.kids_copy_entries x join public.kids_children c on c.id = x.child_id
      where x.week_start = w.week_start and c.village_name is not null), '[]'::jsonb));
end $$;

-- ---------- 놀이 마당 여는 조건 ----------
-- 묵상은 날마다, 암송과 필사는 한 주에 한 번 하는 것이라 이렇게 연다:
--   오늘 묵상을 마쳤다
--   또는 이번 주 암송 구절을 오늘 처음 연습했다 / 이번 주 필사를 오늘 처음 마쳤다
--   또는 오늘 묵상할 것이 없는 날(계획이 없거나 공개 전)에는 예전처럼 암송 연습이나 필사를 오늘 했다
--   또는 선생님이 정한 '누구나 놀이 날'
create or replace function public.kids__qt_today()
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.kids_qt q join public.kids_weeks w on w.week_start = q.week_start
                  where q.day = public.kids__today() and w.is_published)
$$;

create or replace function public.kids__cleared_today(p_child uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.kids__play_free()
      or exists (select 1 from public.kids_qt_entries q where q.child_id = p_child and q.day = public.kids__today())
      or exists (select 1 from public.kids_memory m where m.child_id = p_child and m.verse_id = public.kids__current_verse()
                  and (m.first_done_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                  and c.week_start = public.kids__week_of(public.kids__today())
                  and (c.created_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or (not public.kids__qt_today() and (
            exists (select 1 from public.kids_memory m where m.child_id = p_child and m.last_practiced_on = public.kids__today())
         or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                     and (c.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())))
$$;

-- 묵상을 며칠째 이어서 했는지 (오늘 아직 안 했으면 어제까지). 묵상할 것이 없던 날은 건너뛴다
create or replace function public.kids__qt_streak(p_child uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare v_d date := public.kids__today(); v_n int := 0; v_i int := 0;
begin
  if not exists (select 1 from public.kids_qt_entries where child_id = p_child and day = v_d) then v_d := v_d - 1; end if;
  while v_i < 120 loop
    if exists (select 1 from public.kids_qt_entries where child_id = p_child and day = v_d) then v_n := v_n + 1;
    elsif exists (select 1 from public.kids_qt where day = v_d) then exit;
    end if;
    v_d := v_d - 1;
    v_i := v_i + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.kids__qt_streak(uuid) from public, anon, authenticated;

-- 오늘 할 일: opens는 지금 하면 놀이 마당이 열리는 활동(qt 묵상, memory 암송, copy 필사), qt_streak는 묵상 이어 한 날 수
create or replace function public.kids_today(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        v_week date := public.kids__week_of(v_today); v_verse uuid := public.kids__current_verse();
        w public.kids_weeks; q public.kids_qt; v_opens jsonb := '[]'::jsonb; v_qt boolean := public.kids__qt_today();
begin
  select * into w from public.kids_weeks where week_start = v_week and is_published;
  if found then select * into q from public.kids_qt where day = v_today; end if;
  if v_qt then
    if not exists (select 1 from public.kids_qt_entries where child_id = v_id and day = v_today) then v_opens := v_opens || '["qt"]'; end if;
    if v_verse is not null and not exists (select 1 from public.kids_memory m where m.child_id = v_id and m.verse_id = v_verse and m.first_done_at is not null) then
      v_opens := v_opens || '["memory"]';
    end if;
    if w.week_start is not null and w.copy_ref <> '' and not exists (select 1 from public.kids_copy_entries e where e.child_id = v_id and e.week_start = w.week_start) then
      v_opens := v_opens || '["copy"]';
    end if;
  else
    if v_verse is not null then v_opens := v_opens || '["memory"]'; end if;
    if w.week_start is not null and w.copy_ref <> '' then v_opens := v_opens || '["copy"]'; end if;
  end if;
  return jsonb_build_object(
    'today', v_today,
    'theme', w.theme,
    'cleared', public.kids__cleared_today(v_id),
    'opens', v_opens,
    'qt_streak', public.kids__qt_streak(v_id),
    'verse', (select jsonb_build_object('id', v.id, 'ref', v.ref,
                'practiced', exists (select 1 from public.kids_memory m where m.child_id = v_id and m.verse_id = v.id and m.practice_count > 0))
              from public.kids_verses v where v.id = v_verse),
    'qt', case when q.day is null then null else jsonb_build_object('day', q.day, 'title', q.title, 'ref', q.ref,
            'done', exists (select 1 from public.kids_qt_entries e where e.child_id = v_id and e.day = q.day)) end,
    'copy', case when w.week_start is null or w.copy_ref = '' then null else jsonb_build_object('week', w.week_start, 'ref', w.copy_ref,
            'done', exists (select 1 from public.kids_copy_entries e where e.child_id = v_id and e.week_start = w.week_start)) end,
    'next_start', (select min(week_start) from public.kids_weeks where is_published and week_start > v_week));
end $$;

-- ---------- 쪽지: 마을에 없는 친구에게도 ----------
-- 둘이 이야기(kids_dm_send)는 원래 서버에 30일 동안 남는다. 받는 아이가 마을에 들어오면 쪽지함에서 읽는다.
alter table public.kids_chat add column if not exists read_at timestamptz;
create index if not exists kids_chat_to on public.kids_chat (to_child, created_at desc) where to_child is not null;

-- 쪽지함: 나와 쪽지를 주고받은 친구별 마지막 쪽지와 안 읽은 수 (최근 30일)
create or replace function public.kids_dm_box(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.other, 'name', c.village_name, 'avatar', c.avatar,
      'text', t.body, 'at', t.created_at, 'mine', t.mine, 'unread', t.unread) order by t.created_at desc)
    from (
      select distinct on (other) other, body, created_at, mine,
             (select count(*) from public.kids_chat u where u.to_child = v_id and u.child_id = x.other and u.read_at is null) unread
        from (select case when k.child_id = v_id then k.to_child else k.child_id end other, k.body, k.created_at, k.child_id = v_id mine
                from public.kids_chat k
               where k.to_child is not null and (k.child_id = v_id or k.to_child = v_id)
                 and k.created_at > now() - interval '30 days') x
       order by other, created_at desc) t
    join public.kids_children c on c.id = t.other
   where c.village_name is not null), '[]'::jsonb);
end $$;
grant execute on function public.kids_dm_box(text) to anon, authenticated;

-- 한 친구와 주고받은 쪽지 (최근 60개, 오래된 것부터). 그 친구가 보낸 쪽지는 읽은 것으로 한다
create or replace function public.kids_dm_thread(p_token text, p_with uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  update public.kids_chat set read_at = now() where to_child = v_id and child_id = p_with and read_at is null;
  return coalesce((select jsonb_agg(jsonb_build_object('text', t.body, 'at', t.created_at, 'mine', t.child_id = v_id) order by t.created_at)
    from (select * from public.kids_chat k
           where (k.child_id = v_id and k.to_child = p_with) or (k.child_id = p_with and k.to_child = v_id)
           order by k.created_at desc limit 60) t), '[]'::jsonb);
end $$;
grant execute on function public.kids_dm_thread(text, uuid) to anon, authenticated;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true)
$$;
