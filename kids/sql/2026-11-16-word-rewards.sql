-- 진숲 어린이 마을: 말씀 활동 열매를 늘리고, 선생님이 선생님 화면에서 바꿀 수 있게 한다
-- 새 기본값: 묵상 5개(하루 처음 한 번), 암송 연습 구절마다 2개(하루 3구절까지), 필사 5개(한 주 처음 한 번),
-- 공책 사진을 올리면 그 주 필사 열매가 모두 15개, 선생님 도장 10개.
-- (2026-11-16 전에는 묵상 2개, 암송 연습 구절마다 1개(하루 구절 수 제한 없음), 필사 3개, 사진 모두 10개, 도장 10개였다)
-- 값은 kids_config의 reward_qt, reward_memory, reward_memory_verses, reward_copy, reward_photo, reward_stamp에 두고, 없으면 기본값을 쓴다.
-- 도장은 찍을 때 준 열매를 kids_memory.pass_fruits에 적어 두고, 지울 때 그만큼 뺀다(이 칸이 생기기 전 도장은 10개).
-- 받은 열매 기록은 바꾸지 않는다(앞으로 받는 열매만 바뀐다). 다시 실행해도 된다.

-- 설정 숫자 읽기: 숫자가 아니거나 없으면 기본값, 범위 밖이면 범위 끝으로
create or replace function public.kids__conf_int(p_key text, p_def int, p_lo int, p_hi int)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select case when value ~ '^[0-9]{1,3}$' then greatest(p_lo, least(p_hi, value::int)) end
    from public.kids_config where key = p_key), p_def)
$$;
revoke all on function public.kids__conf_int(text, int, int, int) from public, anon, authenticated;

-- 지금 말씀 활동 열매 (사진 열매는 필사 열매보다 작지 않게)
create or replace function public.kids__rewards()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'qt', public.kids__conf_int('reward_qt', 5, 1, 20),
    'memory', public.kids__conf_int('reward_memory', 2, 1, 10),
    'memory_verses', public.kids__conf_int('reward_memory_verses', 3, 1, 20),
    'copy', public.kids__conf_int('reward_copy', 5, 1, 30),
    'photo', greatest(public.kids__conf_int('reward_copy', 5, 1, 30), public.kids__conf_int('reward_photo', 15, 1, 50)),
    'stamp', public.kids__conf_int('reward_stamp', 10, 1, 50))
$$;
revoke all on function public.kids__rewards() from public, anon, authenticated;

alter table public.kids_memory add column if not exists pass_fruits int;

-- 암송 연습: 구절마다 하루 한 번, 하루에 정해진 구절 수까지 열매 (capped: 오늘 받을 수 있는 구절을 다 채웠다)
create or replace function public.kids_practice(p_token text, p_verse_id uuid, p_score integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        v_prev date; v_gain int := 0; v_fruits int; v_capped boolean := false; r jsonb := public.kids__rewards();
begin
  if not exists (select 1 from public.kids_verses where id = p_verse_id and is_published) then
    raise exception 'NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtext('kids_mem:' || v_id::text));
  select last_practiced_on into v_prev from public.kids_memory where child_id = v_id and verse_id = p_verse_id;
  if v_prev is distinct from v_today then
    if (select count(*) from public.kids_memory where child_id = v_id and verse_id <> p_verse_id and last_practiced_on = v_today)
       < (r->>'memory_verses')::int then
      v_gain := (r->>'memory')::int;
    else
      v_capped := true;
    end if;
  end if;
  insert into public.kids_memory as m (child_id, verse_id, practice_count, best_score, last_practiced_on, first_done_at)
  values (v_id, p_verse_id, 1, greatest(0, least(100, coalesce(p_score, 0))), v_today, now())
  on conflict (child_id, verse_id) do update set
    practice_count = m.practice_count + 1,
    best_score = greatest(m.best_score, excluded.best_score),
    last_practiced_on = excluded.last_practiced_on,
    first_done_at = coalesce(m.first_done_at, excluded.first_done_at);
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits, 'capped', v_capped, 'verses', (r->>'memory_verses')::int);
end $$;

-- 묵상: 하루 처음 한 번
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
  if not exists (select 1 from public.kids_qt_entries where child_id = v_id and day = p_day) then v_gain := (public.kids__rewards()->>'qt')::int; end if;
  insert into public.kids_qt_entries as e (child_id, day, answer, prayer, shared, word)
  values (v_id, p_day, v_answer, v_prayer, coalesce(p_shared, true), v_word)
  on conflict (child_id, day) do update set answer = excluded.answer, prayer = excluded.prayer,
    shared = excluded.shared, word = coalesce(excluded.word, e.word), updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits, 'streak', public.kids__qt_streak(v_id));
end $$;

-- 필사: 한 주 처음 한 번 (copy_paid: 그 주에 받은 필사 열매)
create or replace function public.kids_copy_save(p_token text, p_week date, p_note text, p_shared boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_note text := btrim(coalesce(p_note, '')); v_copy int := (public.kids__rewards()->>'copy')::int;
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  if char_length(v_note) > 300 then raise exception 'TOO_LONG'; end if;
  if not exists (select 1 from public.kids_copy_entries where child_id = v_id and week_start = p_week) then v_gain := v_copy; end if;
  insert into public.kids_copy_entries as e (child_id, week_start, note, shared, copy_paid)
  values (v_id, p_week, v_note, coalesce(p_shared, true), v_copy)
  on conflict (child_id, week_start) do update set note = excluded.note, shared = excluded.shared, updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

-- 공책 사진: 그 주 필사 열매가 모두 사진 열매가 되도록 (이미 받은 필사 열매는 빼고 준다. 한 주에 한 번)
create or replace function public.kids_copy_photo(p_token text, p_week date, p_photo text, p_thumb text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_photo bytea; v_thumb bytea; e public.kids_copy_entries; v_total int := (public.kids__rewards()->>'photo')::int;
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  v_photo := public.kids__image(p_photo, 450000);
  v_thumb := public.kids__image(p_thumb, 40000);
  if v_photo is null or v_thumb is null then raise exception 'BAD_IMAGE'; end if;
  select * into e from public.kids_copy_entries where child_id = v_id and week_start = p_week;
  if e.child_id is null then v_gain := v_total;
  elsif not e.photo_paid then v_gain := greatest(0, v_total - coalesce(e.copy_paid, 2));
  end if;
  insert into public.kids_copy_entries as x (child_id, week_start, note, shared, photo, photo_thumb, photo_ok, photo_at, photo_paid, copy_paid)
  values (v_id, p_week, '', true, v_photo, v_thumb, false, now(), true, v_total)
  on conflict (child_id, week_start) do update
    set photo = excluded.photo, photo_thumb = excluded.photo_thumb, photo_ok = false, photo_at = now(), photo_paid = true,
        copy_paid = case when x.photo_paid then x.copy_paid else greatest(coalesce(x.copy_paid, 2), v_total) end, updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

-- 선생님 도장: 찍을 때 정해 둔 도장 열매를 주고 적어 둔다. 지우면 그때 준 만큼 뺀다 (stamp: 주거나 뺀 열매)
create or replace function public.kids_t_set_pass(p_token text, p_child_id uuid, p_verse_id uuid, p_passed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_prev timestamptz; v_paid int; v_fruits int; v_n int := 0;
begin
  if not exists (select 1 from public.kids_children where id = p_child_id)
     or not exists (select 1 from public.kids_verses where id = p_verse_id) then
    raise exception 'NOT_FOUND';
  end if;
  select passed_at, pass_fruits into v_prev, v_paid from public.kids_memory where child_id = p_child_id and verse_id = p_verse_id;
  if p_passed and v_prev is null then
    v_n := (public.kids__rewards()->>'stamp')::int;
    insert into public.kids_memory as m (child_id, verse_id, passed_at, passed_by, pass_fruits)
    values (p_child_id, p_verse_id, now(), v_tid, v_n)
    on conflict (child_id, verse_id) do update set passed_at = excluded.passed_at, passed_by = excluded.passed_by, pass_fruits = excluded.pass_fruits;
    update public.kids_children set fruits = fruits + v_n where id = p_child_id;
  elsif not p_passed and v_prev is not null then
    v_n := coalesce(v_paid, 10);
    update public.kids_memory set passed_at = null, passed_by = null, pass_fruits = null
     where child_id = p_child_id and verse_id = p_verse_id;
    update public.kids_children set fruits = greatest(0, fruits - v_n) where id = p_child_id;
  end if;
  select fruits into v_fruits from public.kids_children where id = p_child_id;
  return jsonb_build_object('ok', true, 'fruits', v_fruits, 'stamp', v_n);
end $$;

-- 내 암송 구절: 도장으로 받은 열매(stamp_fruits)를 더한다
create or replace function public.kids_verses(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        v_cur uuid := public.kids__current_verse();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'ref', v.ref, 'body', v.body, 'version', v.version, 'is_current', v.id is not distinct from v_cur,
      'practice_count', coalesce(m.practice_count, 0), 'best_score', coalesce(m.best_score, 0),
      'practiced_today', coalesce(m.last_practiced_on = v_today, false),
      'passed', coalesce(m.passed_at is not null, false),
      'stamp_fruits', case when m.passed_at is not null then coalesce(m.pass_fruits, 10) end
    ) order by v.sort_order, v.created_at)
    from public.kids_verses v
    left join public.kids_memory m on m.verse_id = v.id and m.child_id = v_id
    where v.is_published), '[]'::jsonb);
end $$;

-- 선생님이 말씀 활동 열매를 바꾼다 (null은 그대로). 사진 열매는 필사 열매보다 작을 수 없다
create or replace function public.kids_t_set_rewards(p_token text, p_qt int default null, p_memory int default null, p_memory_verses int default null,
                                                    p_copy int default null, p_photo int default null, p_stamp int default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); r jsonb := public.kids__rewards();
        v_copy int := coalesce(p_copy, (r->>'copy')::int); v_photo int := coalesce(p_photo, (r->>'photo')::int);
begin
  if (p_qt is not null and p_qt not between 1 and 20) or (p_memory is not null and p_memory not between 1 and 10)
     or (p_memory_verses is not null and p_memory_verses not between 1 and 20) or (p_copy is not null and p_copy not between 1 and 30)
     or (p_photo is not null and p_photo not between 1 and 50) or (p_stamp is not null and p_stamp not between 1 and 50)
     or v_photo < v_copy then
    raise exception 'BAD_REWARD';
  end if;
  insert into public.kids_config (key, value)
  select k, v::text from (values ('reward_qt', p_qt), ('reward_memory', p_memory), ('reward_memory_verses', p_memory_verses),
                                 ('reward_copy', p_copy), ('reward_photo', p_photo), ('reward_stamp', p_stamp)) s(k, v)
   where v is not null
  on conflict (key) do update set value = excluded.value;
  return public.kids_t_village(p_token);
end $$;
revoke all on function public.kids_t_set_rewards(text, int, int, int, int, int, int) from public;
grant execute on function public.kids_t_set_rewards(text, int, int, int, int, int, int) to anon, authenticated;

-- 선생님 화면 마을 설정: 말씀 활동 열매(rewards)를 더한다
create or replace function public.kids_t_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'today', public.kids__today(),
    'chat_open', public.kids_chat_open(),
    'free_until', (select value from public.kids_config where key = 'play_free_until'),
    'play_free', public.kids__play_free(),
    'sale', public.kids__sale(),
    'sell_day', public.kids__sell_day(),
    'rewards', public.kids__rewards(),
    'chat', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'to_name', t.real_name, 'to_village_name', t.village_name,
                 'body', m.body, 'masked', m.masked, 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_chat m join public.kids_children c on c.id = m.child_id
          left join public.kids_children t on t.id = m.to_child
         order by m.created_at desc limit 200) s), '[]'::jsonb),
    'muted', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.real_name, 'village_name', c.village_name))
        from public.kids_children c where c.chat_muted), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'child_name', c.real_name, 'village_name', c.village_name,
                 'hidden', d.hidden, 'at', d.created_at,
                 'eaten', (select count(*) from public.kids_dish_eats e where e.dish_id = d.id)) as x, d.created_at as at
          from public.kids_dishes d join public.kids_children c on c.id = d.child_id
         order by d.created_at desc limit 60) s), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'art_title', a.title, 'art_owner', o.village_name, 'body', m.body, 'masked', m.masked, 'hidden', m.hidden,
                 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_art_comments m join public.kids_children c on c.id = m.child_id
          join public.kids_art a on a.id = m.art_id join public.kids_children o on o.id = a.child_id
         order by m.created_at desc limit 100) s), '[]'::jsonb),
    'shop', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', l.id, 'name', c.real_name, 'village_name', c.village_name, 'item', l.item, 'n', l.n,
                 'price', l.price, 'fruits_left', c.fruits, 'at', l.created_at) as x, l.created_at as at
          from public.kids_shop_log l join public.kids_children c on c.id = l.child_id
         order by l.created_at desc limit 100) s), '[]'::jsonb),
    'sells', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', l.id, 'name', c.real_name, 'village_name', c.village_name, 'kind', l.kind, 'item', l.item, 'n', l.n,
                 'fruits', l.fruits, 'fruits_left', c.fruits, 'at', l.created_at) as x, l.created_at as at
          from public.kids_sell_log l join public.kids_children c on c.id = l.child_id
         order by l.created_at desc limit 100) s), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', g.id, 'name', a.real_name, 'village_name', a.village_name, 'to_name', b.real_name,
                 'to_village_name', b.village_name, 'n', g.n, 'msg', g.msg, 'item', g.item, 'at', g.created_at) as x, g.created_at as at
          from public.kids_gifts g join public.kids_children a on a.id = g.from_child join public.kids_children b on b.id = g.to_child
         order by g.created_at desc limit 100) s), '[]'::jsonb));
end $$;

-- 기능 목록: 지금 말씀 활동 열매(rewards)를 함께 알려 준다 (앱 안내 글이 이 숫자를 쓴다)
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards())
$$;
