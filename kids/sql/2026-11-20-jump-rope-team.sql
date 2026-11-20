-- 진숲 어린이 마을: 줄넘기 2단 뛰기와 긴 줄 함께 넘기
-- 1) 2단 뛰기: 혼자 하는 줄넘기에서 2단 뛰기를 섞어 뛴다. 줄이 발밑을 지날 때마다 1번이라 2단 뛰기 한 번은 2번으로 센다.
--    2단 뛰기는 두 번째 넘기가 첫 번째 넘기 0.34초 뒤라서, 넘은 수에 견준 시간 검사를 2단 뛰기 수(p_double)만큼 늦춘다.
--    한 번 뛰기는 1번에 0.5초, 2단 뛰기는 2번에 0.85초보다 빠르면 받지 않는다 (앱의 줄은 가장 빨라도 한 바퀴 0.55초, 2단 뛰기는 0.55 + 0.34초).
--    예전 앱은 p_double을 보내지 않으니 0으로 본다 (예전과 같은 검사).
-- 2) 긴 줄 함께 넘기: 도서관 옆 잔디밭에서 마을 친구 둘이 긴 줄을 돌리고 아이들이 여럿(2~6명) 함께 뛴다.
--    한 명이라도 걸리면 끝나고, 모두 함께 넘은 수를 방장이 보낸다(kids_jr_team_save). 기록판에 오늘과 지금까지 모둠 기록 다섯 개씩 보인다.
--    긴 줄은 한 바퀴가 1.4초에서 0.8초까지 빨라지므로, 넘은 수 1번에 0.75초보다 빠르면 받지 않는다.
-- 다시 실행해도 된다.

-- ---------- 1) 2단 뛰기 ----------
drop function if exists public.kids_jr_save(text, int, int);
create or replace function public.kids_jr_save(p_token text, p_count int, p_ms int, p_double int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        r public.kids_jrope; v_best int; v_day int; v_top uuid; v_dbl int := coalesce(p_double, 0);
begin
  if p_count is null or p_count < 1 or p_count > 3000 or p_ms is null or p_ms < 0 or p_ms > 3600000
     or v_dbl < 0 or v_dbl * 2 > p_count
     or (p_count - 2 * v_dbl) * 500 + v_dbl * 850 > p_ms + 1500 then
    raise exception 'BAD_JUMP';
  end if;
  perform pg_advisory_xact_lock(hashtext('kids_jr:' || v_id::text));
  select * into r from public.kids_jrope where child_id = v_id;
  if r.child_id is not null and r.last_at > now() - interval '1 second' then raise exception 'TOO_FAST'; end if;
  v_best := coalesce(r.best, 0);
  v_day := case when r.day = v_today then r.day_best else 0 end;
  insert into public.kids_jrope as j (child_id, best, best_at, day, day_best, day_at, runs, jumps, last_at)
  values (v_id, p_count, now(), v_today, p_count, now(), 1, p_count, now())
  on conflict (child_id) do update set
    best = greatest(j.best, p_count),
    best_at = case when p_count > j.best then now() else j.best_at end,
    day_best = case when j.day = v_today then greatest(j.day_best, p_count) else p_count end,
    day_at = case when j.day is distinct from v_today or p_count > j.day_best then now() else j.day_at end,
    day = v_today, runs = j.runs + 1, jumps = j.jumps + p_count, last_at = now();
  select j.child_id into v_top from public.kids_jrope j join public.kids_children c on c.id = j.child_id
   where j.day = v_today and j.day_best > 0 and c.village_name is not null and c.avatar is not null
   order by j.day_best desc, j.day_at asc limit 1;
  return jsonb_build_object('count', p_count, 'best', greatest(v_best, p_count), 'best_today', greatest(v_day, p_count),
    'new_best', p_count > v_best, 'today_best_new', p_count > v_day, 'king', p_count > v_day and v_top = v_id);
end $$;
revoke all on function public.kids_jr_save(text, int, int, int) from public;
grant execute on function public.kids_jr_save(text, int, int, int) to anon, authenticated;

-- ---------- 2) 긴 줄 함께 넘기 ----------
create table if not exists public.kids_jr_teams (
  id bigint generated always as identity primary key,
  day date not null,
  n int not null,
  members uuid[] not null,
  host uuid not null references public.kids_children(id) on delete cascade,
  made_at timestamptz not null default now());
create index if not exists kids_jr_teams_day_idx on public.kids_jr_teams (day, n desc);
create index if not exists kids_jr_teams_n_idx on public.kids_jr_teams (n desc);
alter table public.kids_jr_teams enable row level security;
revoke all on public.kids_jr_teams from public, anon, authenticated;

-- 모둠 기록 줄: p_today가 true면 오늘, 아니면 지금까지. 다섯 개 (같은 수면 먼저 세운 모둠이 위)
-- names: 함께 뛴 아이들 이름 (뛴 자리 차례, 지금은 없는 아이는 빼고), me: 내가 함께 뛴 기록인지
create or replace function public.kids__jr_team_rows(p_me uuid, p_today boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by n desc, made_at asc), '[]'::jsonb) from (
    select jsonb_build_object('n', t.n, 'me', p_me = any(t.members),
             'names', (select coalesce(jsonb_agg(c.village_name order by m.i), '[]'::jsonb)
                         from unnest(t.members) with ordinality m(id, i) join public.kids_children c on c.id = m.id
                        where c.village_name is not null)) x, t.n, t.made_at
      from public.kids_jr_teams t
     where (not p_today or t.day = public.kids__today())
     order by t.n desc, t.made_at asc limit 5) q
$$;
revoke all on function public.kids__jr_team_rows(uuid, boolean) from public, anon, authenticated;

-- 모둠 기록 보내기 (방장). p_count 모두 함께 넘은 수, p_ms 줄을 돌린 시간, p_members 함께 뛴 아이들(방장 포함, 2~6명)
-- 돌려주는 것: 이번 수, 오늘 모둠 1등인지(today_top), 지금까지 모둠 1등인지(all_top), 내가 함께 뛴 모둠 최고(best)
create or replace function public.kids_jr_team_save(p_token text, p_count int, p_ms int, p_members uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today(); v_k int;
        v_top_today int; v_top_all int;
begin
  v_k := coalesce(array_length(p_members, 1), 0);
  if p_count is null or p_count < 1 or p_count > 3000 or p_ms is null or p_ms < 0 or p_ms > 3600000
     or p_count * 750 > p_ms + 3000 then
    raise exception 'BAD_JUMP';
  end if;
  if v_k < 2 or v_k > 6 or not (v_id = any(p_members))
     or (select count(distinct m) from unnest(p_members) m) <> v_k
     or (select count(*) from public.kids_children c where c.id = any(p_members)) <> v_k then
    raise exception 'BAD_TEAM';
  end if;
  perform pg_advisory_xact_lock(hashtext('kids_jrt:' || v_id::text));
  if exists (select 1 from public.kids_jr_teams where host = v_id and made_at > now() - interval '2 seconds') then raise exception 'TOO_FAST'; end if;
  select max(n) into v_top_today from public.kids_jr_teams where day = v_today;
  select max(n) into v_top_all from public.kids_jr_teams;
  insert into public.kids_jr_teams (day, n, members, host) values (v_today, p_count, p_members, v_id);
  return jsonb_build_object('count', p_count, 'today_top', p_count > coalesce(v_top_today, 0), 'all_top', p_count > coalesce(v_top_all, 0),
    'best', (select max(n) from public.kids_jr_teams where v_id = any(members)));
end $$;
revoke all on function public.kids_jr_team_save(text, int, int, uuid[]) from public;
grant execute on function public.kids_jr_team_save(text, int, int, uuid[]) to anon, authenticated;

-- 줄넘기 기록판: 혼자 기록(오늘의 줄넘기 왕, 최고 기록, 내 기록)에 모둠 기록(오늘, 지금까지, 내가 함께 뛴 최고)을 더한다
create or replace function public.kids_jr_board(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); r public.kids_jrope;
begin
  select * into r from public.kids_jrope where child_id = v_id;
  return jsonb_build_object('today', public.kids__jr_rows(v_id, true), 'all', public.kids__jr_rows(v_id, false),
    'best', coalesce(r.best, 0), 'best_today', case when r.day = public.kids__today() then r.day_best else 0 end,
    'team_today', public.kids__jr_team_rows(v_id, true), 'team_all', public.kids__jr_team_rows(v_id, false),
    'team_best', coalesce((select max(n) from public.kids_jr_teams where v_id = any(members)), 0));
end $$;

-- 기능 목록: jr2(2단 뛰기와 긴 줄 함께 넘기)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true)
$$;
