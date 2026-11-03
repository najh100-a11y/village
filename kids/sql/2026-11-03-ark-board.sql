-- 진숲 어린이 마을: 노아의 방주 짝 맞추기 주간 기록판
-- 다시 실행해도 된다.
-- 혼자 하기(쉬움 12장, 보통 16장, 어려움 20장)를 다 마친 시간을 남긴다. 한 주는 일요일부터 토요일까지(한국 시간)이고,
-- 난이도마다 아이별 그 주 가장 빠른 기록으로 10위까지 줄 세운다(같은 시간이면 덜 뒤집은 쪽, 그래도 같으면 먼저 낸 쪽).
-- 지난 기록은 지우지 않아서 지난주 기록판도 볼 수 있다. 친구와 하는 판은 기록에 넣지 않는다.
-- 시간은 화면이 잰 것을 쓰되, 첫 카드를 뒤집을 때 서버가 시작 시각을 적어 두고(kids_ark_start),
-- 다 찾았을 때(kids_ark_finish) 서버가 잰 시간보다 3초 넘게 빠르다고 하면 서버 시간에서 3초 뺀 값으로 적는다.
-- 짝 하나에 0.8초보다 빠르거나, 카드 수보다 적게 뒤집었거나, 시작하고 30분이 지나면 받지 않는다.

create table if not exists public.kids_ark_runs (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  level text not null check (level in ('easy', 'normal', 'hard')),
  week_start date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ms integer check (ms is null or ms between 1000 and 1800000),
  flips integer check (flips is null or flips between 2 and 999)
);
create index if not exists kids_ark_runs_child_idx on public.kids_ark_runs (child_id, started_at);
create index if not exists kids_ark_runs_week_idx on public.kids_ark_runs (week_start, level, ms) where ms is not null;
alter table public.kids_ark_runs enable row level security;
revoke all on public.kids_ark_runs from anon, authenticated;

-- 난이도마다 짝 수
create or replace function public.kids__ark_pairs(p_level text)
returns integer language sql immutable set search_path = '' as $$
  select case p_level when 'easy' then 6 when 'normal' then 8 when 'hard' then 10 end
$$;

-- 한 주 한 난이도의 아이별 가장 빠른 기록과 순위 (마을 이름을 정한 주민만)
create or replace function public.kids__ark_best(p_week date, p_level text)
returns table (child_id uuid, ms integer, flips integer, done_at timestamptz, rank bigint)
language sql stable security definer set search_path = '' as $$
  select b.child_id, b.ms, b.flips, b.finished_at, row_number() over (order by b.ms, b.flips, b.finished_at)
    from (select distinct on (r.child_id) r.child_id, r.ms, r.flips, r.finished_at
            from public.kids_ark_runs r join public.kids_children c on c.id = r.child_id
           where r.week_start = p_week and r.level = p_level and r.ms is not null and c.village_name is not null
           order by r.child_id, r.ms, r.flips, r.finished_at) b
$$;

-- 10위까지 (이름, 얼굴, 시간, 뒤집은 횟수, 나인지, 선생님인지)
create or replace function public.kids__ark_top(p_week date, p_level text, p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('rank', b.rank, 'name', c.village_name, 'avatar', c.avatar, 'ms', b.ms, 'flips', b.flips,
           'me', c.id = p_me, 'teacher', c.teacher_id is not null) order by b.rank), '[]'::jsonb)
    from public.kids__ark_best(p_week, p_level) b join public.kids_children c on c.id = b.child_id
   where b.rank <= 10
$$;

-- 내 순위 (그 주에 기록이 없으면 null)
create or replace function public.kids__ark_mine(p_week date, p_level text, p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('rank', b.rank, 'ms', b.ms, 'flips', b.flips)
    from public.kids__ark_best(p_week, p_level) b where b.child_id = p_me
$$;

revoke all on function public.kids__ark_pairs(text) from public, anon, authenticated;
revoke all on function public.kids__ark_best(date, text) from public, anon, authenticated;
revoke all on function public.kids__ark_top(date, text, uuid) from public, anon, authenticated;
revoke all on function public.kids__ark_mine(date, text, uuid) from public, anon, authenticated;

-- 시작: 혼자 하기에서 첫 카드를 뒤집을 때 부른다
create or replace function public.kids_ark_start(p_token text, p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_run bigint;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if public.kids__ark_pairs(p_level) is null then raise exception 'BAD_LEVEL'; end if;
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_ark:' || v_id::text));
  if exists (select 1 from public.kids_ark_runs where child_id = v_id and started_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  if (select count(*) from public.kids_ark_runs where child_id = v_id and started_at >= v_start) >= 200 then raise exception 'ARK_DAY'; end if;
  insert into public.kids_ark_runs (child_id, level, week_start)
  values (v_id, p_level, public.kids__week_of(public.kids__today())) returning id into v_run;
  return jsonb_build_object('run', v_run);
end $$;

-- 끝: 모든 짝을 찾았을 때. p_ms는 화면이 잰 시간(첫 카드부터 마지막 짝까지, 1000분의 1초), p_flips는 뒤집은 횟수
create or replace function public.kids_ark_finish(p_token text, p_run bigint, p_ms integer, p_flips integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); r public.kids_ark_runs; v_srv integer; v_ms integer; v_pairs integer;
        v_prev integer; v_mine jsonb;
begin
  select * into r from public.kids_ark_runs where id = p_run and child_id = v_id for update;
  if not found or r.finished_at is not null then raise exception 'NO_RUN'; end if;
  v_srv := floor(extract(epoch from (now() - r.started_at)) * 1000)::integer;
  if v_srv > 1800000 then raise exception 'NO_RUN'; end if;
  v_pairs := public.kids__ark_pairs(r.level);
  if p_flips is null or p_flips < v_pairs * 2 or p_flips > 999 then raise exception 'BAD_RUN'; end if;
  v_ms := greatest(coalesce(p_ms, v_srv), v_srv - 3000, 1000);
  if v_ms < v_pairs * 800 then raise exception 'BAD_RUN'; end if;
  select min(ms) into v_prev from public.kids_ark_runs
   where child_id = v_id and week_start = r.week_start and level = r.level and ms is not null;
  update public.kids_ark_runs set finished_at = now(), ms = v_ms, flips = p_flips where id = r.id;
  v_mine := public.kids__ark_mine(r.week_start, r.level, v_id);
  return jsonb_build_object('ms', v_ms, 'flips', p_flips, 'level', r.level, 'week_start', r.week_start,
    'new_best', v_prev is null or v_ms < v_prev, 'mine', v_mine, 'top', public.kids__ark_top(r.week_start, r.level, v_id));
end $$;

-- 기록판: p_weeks_ago 0이면 이번 주, 1이면 지난주 (52주 전까지)
create or replace function public.kids_ark_board(p_token text, p_level text, p_weeks_ago integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_week date := public.kids__week_of(public.kids__today()) - 7 * greatest(0, least(52, coalesce(p_weeks_ago, 0)));
begin
  if public.kids__ark_pairs(p_level) is null then raise exception 'BAD_LEVEL'; end if;
  return jsonb_build_object('level', p_level, 'week_start', v_week, 'week_end', v_week + 6,
    'top', public.kids__ark_top(v_week, p_level, v_id),
    'mine', public.kids__ark_mine(v_week, p_level, v_id),
    'count', (select count(*) from public.kids__ark_best(v_week, p_level)));
end $$;

-- 놀이 고르는 창: 이번 주 난이도마다 1등과 내 기록
create or replace function public.kids_ark_week(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_week date := public.kids__week_of(public.kids__today()); v_out jsonb := '{}'::jsonb; lv text;
begin
  foreach lv in array array['easy', 'normal', 'hard'] loop
    v_out := v_out || jsonb_build_object(lv, jsonb_build_object(
      'first', (select t -> 0 from (select public.kids__ark_top(v_week, lv, v_id) t) x where jsonb_array_length(x.t) > 0),
      'mine', public.kids__ark_mine(v_week, lv, v_id)));
  end loop;
  return jsonb_build_object('week_start', v_week, 'week_end', v_week + 6, 'levels', v_out);
end $$;

revoke all on function public.kids_ark_start(text, text) from public;
revoke all on function public.kids_ark_finish(text, bigint, integer, integer) from public;
revoke all on function public.kids_ark_board(text, text, integer) from public;
revoke all on function public.kids_ark_week(text) from public;
grant execute on function public.kids_ark_start(text, text) to anon, authenticated;
grant execute on function public.kids_ark_finish(text, bigint, integer, integer) to anon, authenticated;
grant execute on function public.kids_ark_board(text, text, integer) to anon, authenticated;
grant execute on function public.kids_ark_week(text) to anon, authenticated;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true)
$$;
