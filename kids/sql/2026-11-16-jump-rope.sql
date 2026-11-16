-- 진숲 어린이 마을: 줄넘기 기록 (마을 길 어디서나 하는 줄넘기)
-- 쉬지 않고 이어서 넘은 수를 기록한다. 아이마다 한 줄: 최고 기록, 오늘(한국 시각) 최고, 한 번 한 수와 넘은 수의 합.
-- 기록판은 오늘의 줄넘기 왕(오늘 최고, 같으면 먼저 세운 아이)과 최고 기록 열 명씩이다. 줄넘기로는 열매를 주지 않는다.
-- 앱의 줄은 한 바퀴에 적어도 0.55초가 걸리므로(처음 한 바퀴는 1초쯤), 넘은 수가 걸린 시간에 비해 너무 많으면 받지 않는다.
-- 다시 실행해도 된다.

create table if not exists public.kids_jrope (
  child_id uuid primary key references public.kids_children(id) on delete cascade,
  best int not null default 0,
  best_at timestamptz,
  day date,
  day_best int not null default 0,
  day_at timestamptz,
  runs int not null default 0,
  jumps bigint not null default 0,
  last_at timestamptz);
create index if not exists kids_jrope_day_idx on public.kids_jrope (day, day_best desc);
create index if not exists kids_jrope_best_idx on public.kids_jrope (best desc);
alter table public.kids_jrope enable row level security;
revoke all on public.kids_jrope from public, anon, authenticated;

-- 기록판 줄: p_today가 true면 오늘 최고, 아니면 최고 기록 (열 명. 같은 수면 먼저 세운 아이가 위)
create or replace function public.kids__jr_rows(p_me uuid, p_today boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by n desc, at asc), '[]'::jsonb) from (
    select jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'n', case when p_today then j.day_best else j.best end,
             'me', c.id = p_me, 'teacher', c.teacher_id is not null) x,
           case when p_today then j.day_best else j.best end n,
           case when p_today then j.day_at else j.best_at end at
      from public.kids_jrope j join public.kids_children c on c.id = j.child_id
     where c.village_name is not null and c.avatar is not null
       and ((p_today and j.day = public.kids__today() and j.day_best > 0) or (not p_today and j.best > 0))
     order by n desc, at asc limit 10) q
$$;
revoke all on function public.kids__jr_rows(uuid, boolean) from public, anon, authenticated;

-- 한 번 한 줄넘기 기록 (p_count 넘은 수, p_ms 줄을 돌린 시간). 1초 안에 또 보내면 TOO_FAST
-- 돌려주는 것: 이번 수, 내 최고, 오늘 내 최고, 새 최고인지, 오늘 새 최고인지, 오늘의 줄넘기 왕이 되었는지(king)
create or replace function public.kids_jr_save(p_token text, p_count int, p_ms int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        r public.kids_jrope; v_best int; v_day int; v_top uuid;
begin
  if p_count is null or p_count < 1 or p_count > 3000 or p_ms is null or p_ms < 0 or p_ms > 3600000
     or p_count * 500 > p_ms + 1500 then
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
revoke all on function public.kids_jr_save(text, int, int) from public;
grant execute on function public.kids_jr_save(text, int, int) to anon, authenticated;

-- 줄넘기 기록판: 오늘의 줄넘기 왕, 최고 기록, 내 기록
create or replace function public.kids_jr_board(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); r public.kids_jrope;
begin
  select * into r from public.kids_jrope where child_id = v_id;
  return jsonb_build_object('today', public.kids__jr_rows(v_id, true), 'all', public.kids__jr_rows(v_id, false),
    'best', coalesce(r.best, 0), 'best_today', case when r.day = public.kids__today() then r.day_best else 0 end);
end $$;
revoke all on function public.kids_jr_board(text) from public;
grant execute on function public.kids_jr_board(text) to anon, authenticated;

-- 기능 목록: jrope(줄넘기 기록)를 더한다 (말씀 활동 열매 rewards는 그대로)
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true)
$$;
