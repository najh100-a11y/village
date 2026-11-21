-- 진숲 어린이 마을 — 새벽 동굴 (하나님의 전신갑주, 엡 6:10-18)
-- 마을 섬 북서쪽 동굴에서 갑주를 입고 기도한 뒤 동굴(시험 방 여러 개 + 새벽의 방)을 깬다.
-- 놀이 마당처럼 그날 말씀 활동을 해야 열매를 받는다(PLAY_LOCKED). 동굴을 깨면 동굴마다 정한 열매를 하루 5개까지 받는다.
-- 시험은 아이 화면에서 하므로, 서버는 동굴 이름, 걸린 시간(방 하나에 10초보다 빠르면 받지 않는다), 하루 횟수만 살핀다.
-- 동굴 목록은 js/dungeon-data.js(DUNGEONS)와 같다: d1~d3 열매 1(방 3), d4~d6 열매 2(방 4), d7 열매 3(방 7). 방 수에는 새벽의 방이 들어 있다.

-- 동굴을 깬 기록 (한 번에 한 줄). got: 그때 받은 열매
create table if not exists public.kids_dungeon_runs (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  dg text not null,
  ms int not null,
  party smallint not null default 1,
  got smallint not null default 0,
  done_at timestamptz not null default now());
create index if not exists kids_dungeon_runs_child_idx on public.kids_dungeon_runs (child_id, done_at);
alter table public.kids_dungeon_runs enable row level security;
revoke all on public.kids_dungeon_runs from public, anon, authenticated;

-- 동굴마다 [열매, 방 수]. 없는 동굴이면 null
create or replace function public.kids__dg_info(p_dg text)
returns int[] language sql immutable set search_path = ''
as $$
  select case p_dg
    when 'd1' then array[1, 3] when 'd2' then array[1, 3] when 'd3' then array[1, 3]
    when 'd4' then array[2, 4] when 'd5' then array[2, 4] when 'd6' then array[2, 4]
    when 'd7' then array[3, 7]
    else null end
$$;
revoke all on function public.kids__dg_info(text) from public, anon, authenticated;

-- 내 동굴 기록: 동굴마다 깬 횟수와 가장 빠른 시간, 오늘 동굴에서 받은 열매, 하루 상한
create or replace function public.kids_dungeon_book(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('dg', x.dg, 'clears', x.n, 'best_ms', x.best) order by x.dg)
                      from (select dg, count(*)::int as n, min(ms) as best from public.kids_dungeon_runs where child_id = v_id group by dg) x), '[]'::jsonb),
    'today', coalesce((select sum(got)::int from public.kids_dungeon_runs where child_id = v_id and done_at >= v_start), 0),
    'cap', 5);
end $$;
revoke all on function public.kids_dungeon_book(text) from public;
grant execute on function public.kids_dungeon_book(text) to anon, authenticated;

-- 동굴을 깼다: 열매는 동굴마다 정한 수만큼, 오늘 동굴에서 받은 열매가 5개가 될 때까지
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
  select coalesce(sum(got), 0)::int, count(*)::int into v_today, v_all from public.kids_dungeon_runs where child_id = v_id and done_at >= v_start;
  if v_all >= 60 then raise exception 'DG_DAY'; end if;
  v_got := greatest(0, least(v_info[1], 5 - v_today));
  if v_got > 0 then update public.kids_children set fruits = fruits + v_got where id = v_id; end if;
  insert into public.kids_dungeon_runs (child_id, dg, ms, party, got) values (v_id, p_dg, p_ms, p_party, v_got);
  select fruits into v_fruits from public.kids_children where id = v_id;
  select count(*)::int, min(ms) into v_clears, v_best from public.kids_dungeon_runs where child_id = v_id and dg = p_dg;
  return jsonb_build_object('got', v_got, 'fruits', v_fruits, 'today', v_today + v_got, 'cap', 5, 'clears', v_clears, 'best_ms', v_best, 'first', v_clears = 1);
end $$;
revoke all on function public.kids_dungeon_clear(text, text, int, int) from public;
grant execute on function public.kids_dungeon_clear(text, text, int, int) to anon, authenticated;

-- 기능 목록: dungeon(새벽 동굴)을 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true, 'dungeon', true)
$$;
