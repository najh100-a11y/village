-- 진숲 어린이 마을 — 도전 모드 난이도 (쉬움, 보통, 어려움)
-- 1) 도전 기록에 난이도(lvl: 0 쉬움, 1 보통, 2 어려움)를 더한다. 예전 기록은 모두 보통(1)이다.
-- 2) kids_arcade_end에 p_level(없으면 1)을 더한다. 어려움은 점수가 1.5배라 점수 상한도 1.5배로 한다.
--    예전 화면이 다섯 값(p_party까지)만 보내도 그대로 된다 (p_level 기본값 1).
-- 3) 기록판(kids__arc_best, kids__arc_rows)에 lvl을 더해서 난이도 표를 보여 준다.
-- 4) 기능 목록에 arclevel을 더한다. sql/2026-11-22-arcade-coop.sql 다음에 실행한다. 다시 실행해도 된다.

alter table public.kids_arcade_runs add column if not exists lvl smallint not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kids_arcade_runs_lvl_check' and conrelid = 'public.kids_arcade_runs'::regclass) then
    alter table public.kids_arcade_runs add constraint kids_arcade_runs_lvl_check check (lvl between 0 and 2);
  end if;
end $$;

-- 기록판: 아이마다 가장 높은 점수 한 줄 (같은 점수면 먼저 세운 기록). party와 lvl을 함께 준다
drop function if exists public.kids__arc_best(date);
create function public.kids__arc_best(p_week date)
returns table (child_id uuid, score int, wave int, party smallint, lvl smallint, done_at timestamptz, rank bigint)
language sql stable security definer set search_path = '' as $$
  select b.child_id, b.score, b.wave, b.party, b.lvl, b.done_at, row_number() over (order by b.score desc, b.done_at asc)
    from (select distinct on (r.child_id) r.child_id, r.score, r.wave, r.party, r.lvl, r.done_at
            from public.kids_arcade_runs r join public.kids_children c on c.id = r.child_id
           where r.score > 0 and (p_week is null or r.week_start = p_week) and c.village_name is not null and c.avatar is not null
           order by r.child_id, r.score desc, r.done_at asc) b
$$;
revoke all on function public.kids__arc_best(date) from public, anon, authenticated;

create or replace function public.kids__arc_rows(p_week date, p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'score', b.score, 'wave', b.wave, 'party', b.party, 'lvl', b.lvl,
           'me', c.id = p_me, 'teacher', c.teacher_id is not null) order by b.rank), '[]'::jsonb)
    from public.kids__arc_best(p_week) b join public.kids_children c on c.id = b.child_id
   where b.rank <= 10
$$;
revoke all on function public.kids__arc_rows(date, uuid) from public, anon, authenticated;

-- 도전 한 번이 끝났다. p_party: 함께 한 사람 수 (혼자면 1), p_level: 0 쉬움, 1 보통, 2 어려움
drop function if exists public.kids_arcade_end(text, int, int, int, int);
create or replace function public.kids_arcade_end(p_token text, p_score int, p_wave int, p_ms int, p_party int default 1, p_level int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
        v_week date := public.kids__week_of(public.kids__today());
        v_party int := coalesce(p_party, 1);
        v_level int := coalesce(p_level, 1);
        v_today int; v_runs int; v_want int; v_got int; v_fruits int; v_rank bigint;
begin
  if p_score is null or p_wave is null or p_ms is null or v_party < 1 or v_party > 4 or v_level < 0 or v_level > 2
     or p_wave < 0 or p_wave > 500 or p_ms < 0 or p_ms > 4 * 3600000 or p_ms < p_wave * 4000 or p_score < 0
     or p_score::numeric > (p_wave + 1)::numeric * 40000 * v_party * (case when v_level = 2 then 1.5 else 1 end) + p_ms then
    raise exception 'BAD_ARC';
  end if;
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_dg:' || v_id::text));
  if exists (select 1 from public.kids_arcade_runs where child_id = v_id and done_at > now() - interval '5 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*)::int into v_runs from public.kids_arcade_runs where child_id = v_id and done_at >= v_start;
  if v_runs >= 10 then raise exception 'ARC_DAY'; end if;
  v_today := public.kids__dg_today(v_id);
  v_want := case when p_wave >= 10 then 2 when p_wave >= 5 then 1 else 0 end;
  v_got := greatest(0, least(v_want, 5 - v_today));
  if v_got > 0 then update public.kids_children set fruits = fruits + v_got where id = v_id; end if;
  insert into public.kids_arcade_runs (child_id, score, wave, ms, got, week_start, party, lvl) values (v_id, p_score, p_wave, p_ms, v_got, v_week, v_party, v_level);
  select fruits into v_fruits from public.kids_children where id = v_id;
  select b.rank into v_rank from public.kids__arc_best(v_week) b where b.child_id = v_id;
  return jsonb_build_object('got', v_got, 'fruits', v_fruits, 'today', v_today + v_got, 'cap', 5,
    'best', (select max(score) from public.kids_arcade_runs where child_id = v_id),
    'week_best', (select max(score) from public.kids_arcade_runs where child_id = v_id and week_start = v_week),
    'best_wave', (select max(wave) from public.kids_arcade_runs where child_id = v_id),
    'rank', case when p_score > 0 then v_rank else null end,
    'plays', public.kids__arc_plays(v_id), 'play_cap', 10);
end $$;
revoke all on function public.kids_arcade_end(text, int, int, int, int, int) from public;
grant execute on function public.kids_arcade_end(text, int, int, int, int, int) to anon, authenticated;

-- 기능 목록: arclevel(도전 모드 난이도)을 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true, 'dungeon', true, 'arcade', true,
    'pethouse', true, 'arcoop', true, 'arclevel', true)
$$;
