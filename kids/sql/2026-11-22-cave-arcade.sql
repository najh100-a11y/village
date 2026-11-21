-- 진숲 어린이 마을 — 새벽 동굴 오락실 (그림자 떼 물리치기와 도전 모드)
-- 1) 새 동굴 둘: d8 그림자 떼 굴(열매 1, 방 3), d9 큰 그림자 성(열매 2, 방 4). js/dungeon-data.js(DUNGEONS)와 같다.
-- 2) 도전 모드: 갑주의 방에서 혼자 끝없는 그림자 물결을 막는다. 한 번 할 때마다 점수, 이긴 물결 수, 걸린 시간을 남긴다.
--    이긴 물결이 5개 넘으면 열매 1개, 10개 넘으면 2개. 동굴 탐험 열매와 합쳐서 하루 5개까지다.
--    기록판은 이번 주(일요일부터) 가장 높은 점수와 지금까지 가장 높은 점수, 아이마다 한 줄씩 열 명까지다.
-- 놀이는 아이 화면에서 하므로, 서버는 말이 안 되는 기록(물결 하나에 4초보다 빠름, 점수가 너무 큼)과 하루 횟수만 살핀다.
-- 다시 실행해도 된다.

-- 동굴마다 [열매, 방 수] (d8, d9를 더한다)
create or replace function public.kids__dg_info(p_dg text)
returns int[] language sql immutable set search_path = ''
as $$
  select case p_dg
    when 'd1' then array[1, 3] when 'd2' then array[1, 3] when 'd3' then array[1, 3] when 'd8' then array[1, 3]
    when 'd4' then array[2, 4] when 'd5' then array[2, 4] when 'd6' then array[2, 4] when 'd9' then array[2, 4]
    when 'd7' then array[3, 7]
    else null end
$$;
revoke all on function public.kids__dg_info(text) from public, anon, authenticated;

-- 도전 모드 기록 (한 번에 한 줄). wave: 이긴 물결 수, got: 그때 받은 열매, week_start: 그 주 일요일
create table if not exists public.kids_arcade_runs (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  score int not null,
  wave int not null,
  ms int not null,
  got smallint not null default 0,
  week_start date not null,
  done_at timestamptz not null default now());
create index if not exists kids_arcade_runs_child_idx on public.kids_arcade_runs (child_id, done_at);
create index if not exists kids_arcade_runs_week_idx on public.kids_arcade_runs (week_start, score desc);
alter table public.kids_arcade_runs enable row level security;
revoke all on public.kids_arcade_runs from public, anon, authenticated;

-- 오늘 동굴에서 받은 열매 (동굴 탐험 + 도전 모드)
create or replace function public.kids__dg_today(p_child uuid)
returns int language sql stable security definer set search_path = '' as $$
  select (coalesce((select sum(got) from public.kids_dungeon_runs where child_id = p_child and done_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0)
        + coalesce((select sum(got) from public.kids_arcade_runs where child_id = p_child and done_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0))::int
$$;
revoke all on function public.kids__dg_today(uuid) from public, anon, authenticated;

-- 도전 기록판: 아이마다 가장 높은 점수 한 줄 (같은 점수면 먼저 세운 기록). p_week가 null이면 지금까지 모두
create or replace function public.kids__arc_best(p_week date)
returns table (child_id uuid, score int, wave int, done_at timestamptz, rank bigint)
language sql stable security definer set search_path = '' as $$
  select b.child_id, b.score, b.wave, b.done_at, row_number() over (order by b.score desc, b.done_at asc)
    from (select distinct on (r.child_id) r.child_id, r.score, r.wave, r.done_at
            from public.kids_arcade_runs r join public.kids_children c on c.id = r.child_id
           where r.score > 0 and (p_week is null or r.week_start = p_week) and c.village_name is not null and c.avatar is not null
           order by r.child_id, r.score desc, r.done_at asc) b
$$;
revoke all on function public.kids__arc_best(date) from public, anon, authenticated;

create or replace function public.kids__arc_rows(p_week date, p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'score', b.score, 'wave', b.wave,
           'me', c.id = p_me, 'teacher', c.teacher_id is not null) order by b.rank), '[]'::jsonb)
    from public.kids__arc_best(p_week) b join public.kids_children c on c.id = b.child_id
   where b.rank <= 10
$$;
revoke all on function public.kids__arc_rows(date, uuid) from public, anon, authenticated;

-- 내 도전 기록과 기록판 (이번 주, 지금까지), 오늘 동굴 열매
create or replace function public.kids_arcade_book(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_week date := public.kids__week_of(public.kids__today());
begin
  return jsonb_build_object(
    'best', coalesce((select max(score) from public.kids_arcade_runs where child_id = v_id), 0),
    'week_best', coalesce((select max(score) from public.kids_arcade_runs where child_id = v_id and week_start = v_week), 0),
    'best_wave', coalesce((select max(wave) from public.kids_arcade_runs where child_id = v_id), 0),
    'week', public.kids__arc_rows(v_week, v_id), 'all', public.kids__arc_rows(null, v_id),
    'today', public.kids__dg_today(v_id), 'cap', 5);
end $$;
revoke all on function public.kids_arcade_book(text) from public;
grant execute on function public.kids_arcade_book(text) to anon, authenticated;

-- 도전 한 번이 끝났다 (p_wave: 이긴 물결 수). 열매는 물결 5개 넘으면 1, 10개 넘으면 2 (동굴 열매와 함께 하루 5개까지)
create or replace function public.kids_arcade_end(p_token text, p_score int, p_wave int, p_ms int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
        v_week date := public.kids__week_of(public.kids__today());
        v_today int; v_runs int; v_want int; v_got int; v_fruits int; v_rank bigint;
begin
  if p_score is null or p_wave is null or p_ms is null or p_wave < 0 or p_wave > 500 or p_ms < 0 or p_ms > 4 * 3600000
     or p_ms < p_wave * 4000 or p_score < 0 or p_score::bigint > (p_wave + 1)::bigint * 40000 + p_ms then
    raise exception 'BAD_ARC';
  end if;
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_dg:' || v_id::text));
  if exists (select 1 from public.kids_arcade_runs where child_id = v_id and done_at > now() - interval '5 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*)::int into v_runs from public.kids_arcade_runs where child_id = v_id and done_at >= v_start;
  if v_runs >= 100 then raise exception 'ARC_DAY'; end if;
  v_today := public.kids__dg_today(v_id);
  v_want := case when p_wave >= 10 then 2 when p_wave >= 5 then 1 else 0 end;
  v_got := greatest(0, least(v_want, 5 - v_today));
  if v_got > 0 then update public.kids_children set fruits = fruits + v_got where id = v_id; end if;
  insert into public.kids_arcade_runs (child_id, score, wave, ms, got, week_start) values (v_id, p_score, p_wave, p_ms, v_got, v_week);
  select fruits into v_fruits from public.kids_children where id = v_id;
  select b.rank into v_rank from public.kids__arc_best(v_week) b where b.child_id = v_id;
  return jsonb_build_object('got', v_got, 'fruits', v_fruits, 'today', v_today + v_got, 'cap', 5,
    'best', (select max(score) from public.kids_arcade_runs where child_id = v_id),
    'week_best', (select max(score) from public.kids_arcade_runs where child_id = v_id and week_start = v_week),
    'best_wave', (select max(wave) from public.kids_arcade_runs where child_id = v_id),
    'rank', case when p_score > 0 then v_rank else null end);
end $$;
revoke all on function public.kids_arcade_end(text, int, int, int) from public;
grant execute on function public.kids_arcade_end(text, int, int, int) to anon, authenticated;

-- 동굴 기록과 동굴을 깼을 때: 오늘 받은 열매에 도전 모드 열매도 센다
create or replace function public.kids_dungeon_book(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('dg', x.dg, 'clears', x.n, 'best_ms', x.best) order by x.dg)
                      from (select dg, count(*)::int as n, min(ms) as best from public.kids_dungeon_runs where child_id = v_id group by dg) x), '[]'::jsonb),
    'today', public.kids__dg_today(v_id),
    'cap', 5);
end $$;
revoke all on function public.kids_dungeon_book(text) from public;
grant execute on function public.kids_dungeon_book(text) to anon, authenticated;

create or replace function public.kids_dungeon_clear(p_token text, p_dg text, p_ms int, p_party int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_info int[] := public.kids__dg_info(p_dg);
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
        v_today int; v_all int; v_got int; v_fruits int; v_clears int; v_best int;
begin
  if v_info is null or p_ms is null or p_ms < v_info[2] * 10000 or p_ms > 3 * 3600000
     or p_party is null or p_party < 1 or p_party > 4 then
    raise exception 'BAD_DG';
  end if;
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_dg:' || v_id::text));
  if exists (select 1 from public.kids_dungeon_runs where child_id = v_id and done_at > now() - interval '20 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*)::int into v_all from public.kids_dungeon_runs where child_id = v_id and done_at >= v_start;
  if v_all >= 60 then raise exception 'DG_DAY'; end if;
  v_today := public.kids__dg_today(v_id);
  v_got := greatest(0, least(v_info[1], 5 - v_today));
  if v_got > 0 then update public.kids_children set fruits = fruits + v_got where id = v_id; end if;
  insert into public.kids_dungeon_runs (child_id, dg, ms, party, got) values (v_id, p_dg, p_ms, p_party, v_got);
  select fruits into v_fruits from public.kids_children where id = v_id;
  select count(*)::int, min(ms) into v_clears, v_best from public.kids_dungeon_runs where child_id = v_id and dg = p_dg;
  return jsonb_build_object('got', v_got, 'fruits', v_fruits, 'today', v_today + v_got, 'cap', 5, 'clears', v_clears, 'best_ms', v_best, 'first', v_clears = 1);
end $$;
revoke all on function public.kids_dungeon_clear(text, text, int, int) from public;
grant execute on function public.kids_dungeon_clear(text, text, int, int) to anon, authenticated;

-- 기능 목록: arcade(동굴 오락실, 도전 모드)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true, 'dungeon', true, 'arcade', true)
$$;
