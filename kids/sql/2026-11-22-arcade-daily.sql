-- 진숲 어린이 마을 — 도전 모드는 하루 10번까지
-- 도전 모드(새벽 동굴 오락실의 끝없는 물결)가 게임 같은 면이 커서, 하루에 시작할 수 있는 횟수를 10번으로 줄인다.
-- 끝날 때가 아니라 시작할 때 센다. 중간에 '그만'으로 나가도 한 번으로 친다.
-- 동굴 안의 오락실 방(그림자 떼 굴, 큰 그림자 성)은 동굴 탐험의 한 방이라 여기서 세지 않는다.
-- sql/2026-11-22-cave-arcade.sql 다음에 실행한다. 다시 실행해도 된다.

-- 도전을 시작한 기록 (하루 횟수를 센다)
create table if not exists public.kids_arcade_starts (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  started_at timestamptz not null default now());
create index if not exists kids_arcade_starts_child_idx on public.kids_arcade_starts (child_id, started_at);
alter table public.kids_arcade_starts enable row level security;
revoke all on public.kids_arcade_starts from public, anon, authenticated;

-- 오늘 한 도전 수: 시작한 수와 끝난 기록 수 가운데 큰 쪽 (이 파일을 넣기 전에 오늘 이미 한 도전도 센다)
create or replace function public.kids__arc_plays(p_child uuid)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(
    (select count(*) from public.kids_arcade_starts where child_id = p_child and started_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'),
    (select count(*) from public.kids_arcade_runs where child_id = p_child and done_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'))::int
$$;
revoke all on function public.kids__arc_plays(uuid) from public, anon, authenticated;

-- 도전을 시작한다. 오늘 10번을 다 했으면 ARC_DAY
create or replace function public.kids_arcade_start(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_n int;
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_dg:' || v_id::text));
  v_n := public.kids__arc_plays(v_id);
  if v_n >= 10 then raise exception 'ARC_DAY'; end if;
  insert into public.kids_arcade_starts (child_id) values (v_id);
  return jsonb_build_object('plays', v_n + 1, 'play_cap', 10);
end $$;
revoke all on function public.kids_arcade_start(text) from public;
grant execute on function public.kids_arcade_start(text) to anon, authenticated;

-- 내 도전 기록과 기록판에 오늘 시작한 수(plays)와 하루 횟수(play_cap)를 더한다
create or replace function public.kids_arcade_book(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_week date := public.kids__week_of(public.kids__today());
begin
  return jsonb_build_object(
    'best', coalesce((select max(score) from public.kids_arcade_runs where child_id = v_id), 0),
    'week_best', coalesce((select max(score) from public.kids_arcade_runs where child_id = v_id and week_start = v_week), 0),
    'best_wave', coalesce((select max(wave) from public.kids_arcade_runs where child_id = v_id), 0),
    'week', public.kids__arc_rows(v_week, v_id), 'all', public.kids__arc_rows(null, v_id),
    'today', public.kids__dg_today(v_id), 'cap', 5,
    'plays', public.kids__arc_plays(v_id), 'play_cap', 10);
end $$;
revoke all on function public.kids_arcade_book(text) from public;
grant execute on function public.kids_arcade_book(text) to anon, authenticated;

-- 도전 한 번이 끝났다: 하루에 남길 수 있는 기록도 10번까지 (전에는 100번)
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
  if v_runs >= 10 then raise exception 'ARC_DAY'; end if;
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
    'rank', case when p_score > 0 then v_rank else null end,
    'plays', public.kids__arc_plays(v_id), 'play_cap', 10);
end $$;
revoke all on function public.kids_arcade_end(text, int, int, int) from public;
grant execute on function public.kids_arcade_end(text, int, int, int) to anon, authenticated;
