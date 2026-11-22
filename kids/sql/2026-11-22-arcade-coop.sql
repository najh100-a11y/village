-- 진숲 어린이 마을 — 도전 모드를 친구와 함께 (둘에서 넷까지)
-- 오락실(도전 모드)을 친구와 한 판에서 함께 할 수 있게 되어, 함께 한 판은 모두에게 같은 팀 점수로 남는다.
-- 1) 도전 기록에 함께 한 사람 수(party, 1~4)를 더한다. 혼자 한 기록은 1이다.
-- 2) kids_arcade_end에 p_party(함께 한 사람 수, 없으면 1)를 더한다. 사람이 많으면 그림자도 많아져서 점수 상한도 사람 수만큼 늘린다.
--    예전 화면이 네 값만 보내도 그대로 된다 (p_party 기본값 1).
-- 3) 기록판(kids__arc_best, kids__arc_rows)에 party를 더해서 '함께 3명'처럼 보여 준다.
-- 하루 10번(kids_arcade_start)은 그대로 아이마다 센다. 함께 해도 한 사람이 한 번씩 쓴다.
-- sql/2026-11-22-arcade-daily.sql 다음에 실행한다. 다시 실행해도 된다.

alter table public.kids_arcade_runs add column if not exists party smallint not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kids_arcade_runs_party_check' and conrelid = 'public.kids_arcade_runs'::regclass) then
    alter table public.kids_arcade_runs add constraint kids_arcade_runs_party_check check (party between 1 and 4);
  end if;
end $$;

-- 기록판: 아이마다 가장 높은 점수 한 줄 (같은 점수면 먼저 세운 기록). p_week가 null이면 지금까지 모두. party를 더한다
drop function if exists public.kids__arc_best(date);
create function public.kids__arc_best(p_week date)
returns table (child_id uuid, score int, wave int, party smallint, done_at timestamptz, rank bigint)
language sql stable security definer set search_path = '' as $$
  select b.child_id, b.score, b.wave, b.party, b.done_at, row_number() over (order by b.score desc, b.done_at asc)
    from (select distinct on (r.child_id) r.child_id, r.score, r.wave, r.party, r.done_at
            from public.kids_arcade_runs r join public.kids_children c on c.id = r.child_id
           where r.score > 0 and (p_week is null or r.week_start = p_week) and c.village_name is not null and c.avatar is not null
           order by r.child_id, r.score desc, r.done_at asc) b
$$;
revoke all on function public.kids__arc_best(date) from public, anon, authenticated;

create or replace function public.kids__arc_rows(p_week date, p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'score', b.score, 'wave', b.wave, 'party', b.party,
           'me', c.id = p_me, 'teacher', c.teacher_id is not null) order by b.rank), '[]'::jsonb)
    from public.kids__arc_best(p_week) b join public.kids_children c on c.id = b.child_id
   where b.rank <= 10
$$;
revoke all on function public.kids__arc_rows(date, uuid) from public, anon, authenticated;

-- 도전 한 번이 끝났다. p_party: 함께 한 사람 수 (혼자면 1)
drop function if exists public.kids_arcade_end(text, int, int, int);
create or replace function public.kids_arcade_end(p_token text, p_score int, p_wave int, p_ms int, p_party int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
        v_week date := public.kids__week_of(public.kids__today());
        v_party int := coalesce(p_party, 1);
        v_today int; v_runs int; v_want int; v_got int; v_fruits int; v_rank bigint;
begin
  if p_score is null or p_wave is null or p_ms is null or v_party < 1 or v_party > 4 or p_wave < 0 or p_wave > 500 or p_ms < 0 or p_ms > 4 * 3600000
     or p_ms < p_wave * 4000 or p_score < 0 or p_score::bigint > (p_wave + 1)::bigint * 40000 * v_party + p_ms then
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
  insert into public.kids_arcade_runs (child_id, score, wave, ms, got, week_start, party) values (v_id, p_score, p_wave, p_ms, v_got, v_week, v_party);
  select fruits into v_fruits from public.kids_children where id = v_id;
  select b.rank into v_rank from public.kids__arc_best(v_week) b where b.child_id = v_id;
  return jsonb_build_object('got', v_got, 'fruits', v_fruits, 'today', v_today + v_got, 'cap', 5,
    'best', (select max(score) from public.kids_arcade_runs where child_id = v_id),
    'week_best', (select max(score) from public.kids_arcade_runs where child_id = v_id and week_start = v_week),
    'best_wave', (select max(wave) from public.kids_arcade_runs where child_id = v_id),
    'rank', case when p_score > 0 then v_rank else null end,
    'plays', public.kids__arc_plays(v_id), 'play_cap', 10);
end $$;
revoke all on function public.kids_arcade_end(text, int, int, int, int) from public;
grant execute on function public.kids_arcade_end(text, int, int, int, int) to anon, authenticated;

-- 기능 목록: arcoop(오락실 함께 하기)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true, 'dungeon', true, 'arcade', true,
    'pethouse', true, 'arcoop', true)
$$;
