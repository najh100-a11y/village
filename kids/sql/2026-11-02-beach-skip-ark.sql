-- 진숲 어린이 마을: 모래사장 보물 캐기, 물수제비, (노아의 방주 짝 맞추기는 서버가 필요 없다)
-- 다시 실행해도 된다. 보물 값은 js/beach-data.js의 TREASURES와 같다.
-- 보물 캐기: 수영장 섬 모래밭의 반짝이는 자리를 삽으로 파면 서버가 무게대로 하나 뽑아 기록한다(하루 60번, 2초에 한 번).
--   캔 보물은 가방의 보물 도감에 모이고, 열매 상점에서 물고기·곤충처럼 묶음으로 판다(흔한 것 10개에 열매 1개).
-- 물수제비: 수영장 섬 동쪽 물수제비 터 끝에서 돌을 던진다. 아이가 고른 때(p_aim, 0~1)로 서버가 튄 횟수를 정하고 기록한다.
--   오늘의 물수제비 왕(오늘 가장 많이 튄 기록)을 보여 준다. 열매는 주지 않는다.

-- ---------- 보물 ----------
create table if not exists public.kids_treasure_kinds (
  id text primary key, name text not null, weight int not null check (weight > 0), rarity int not null, sort int not null);
alter table public.kids_treasure_kinds enable row level security;
revoke all on public.kids_treasure_kinds from anon, authenticated;

insert into public.kids_treasure_kinds (id, name, weight, rarity, sort) values
  ('shell', '조개껍데기', 24, 0, 1),
  ('conch', '소라 껍데기', 18, 0, 2),
  ('seaglass', '바다 유리', 14, 0, 3),
  ('starfish', '불가사리', 10, 1, 4),
  ('crab', '꽃게', 8, 1, 5),
  ('coin', '옛날 동전', 6, 1, 6),
  ('pearl', '진주', 3, 2, 7),
  ('bottle', '편지 든 병', 3, 2, 8),
  ('fossil', '암모나이트 화석', 2, 2, 9),
  ('chest', '작은 보물 상자', 1, 3, 10),
  ('can', '빈 깡통', 7, -1, 11),
  ('sandal', '낡은 샌들', 5, -1, 12)
on conflict (id) do update set name = excluded.name, weight = excluded.weight, rarity = excluded.rarity, sort = excluded.sort;

create table if not exists public.kids_treasures (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  item text not null references public.kids_treasure_kinds(id),
  found_at timestamptz not null default now(),
  sold_at timestamptz);
create index if not exists kids_treasures_child_idx on public.kids_treasures (child_id, found_at);
alter table public.kids_treasures enable row level security;
revoke all on public.kids_treasures from anon, authenticated;

-- 보물 캐기: 무게대로 하나 뽑아 기록한다
create or replace function public.kids_dig(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_r numeric; v_acc int := 0; v_total int; k public.kids_treasure_kinds;
        v_today int; v_first boolean; v_count int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_dig:' || v_id::text));
  if exists (select 1 from public.kids_treasures where child_id = v_id and found_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_today from public.kids_treasures where child_id = v_id and found_at >= v_start;
  if v_today >= 60 then raise exception 'DIG_DAY'; end if;
  select sum(weight) into v_total from public.kids_treasure_kinds;
  v_r := floor(random() * v_total);
  for k in select * from public.kids_treasure_kinds order by sort loop
    v_acc := v_acc + k.weight;
    exit when v_r < v_acc;
  end loop;
  v_first := not exists (select 1 from public.kids_treasures where child_id = v_id and item = k.id);
  insert into public.kids_treasures (child_id, item) values (v_id, k.id);
  select count(*) into v_count from public.kids_treasures where child_id = v_id and item = k.id;
  return jsonb_build_object('item', k.id, 'name', k.name, 'rarity', k.rarity, 'first', v_first, 'count', v_count,
    'kinds', (select count(distinct t.item) from public.kids_treasures t join public.kids_treasure_kinds kk on kk.id = t.item
               where t.child_id = v_id and kk.rarity >= 0),
    'today', v_today + 1);
end $$;
grant execute on function public.kids_dig(text) to anon, authenticated;

-- 보물 도감: 지금까지 캔 수(판 것도 센다)와 오늘 캔 수
create or replace function public.kids_treasure_book(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'mine', coalesce((select jsonb_object_agg(item, n) from (select item, count(*) n from public.kids_treasures
        where child_id = v_id group by item) s), '{}'::jsonb),
    'today', (select count(*) from public.kids_treasures where child_id = v_id and found_at >= v_start));
end $$;
grant execute on function public.kids_treasure_book(text) to anon, authenticated;

-- 팔기: 보물도 묶음으로 판다 (흔한 것 10개, 조금 드문 것 5개, 드문 것 2개, 아주 드문 것 1개에 열매 1개. 쓰레기는 팔지 않는다)
alter table public.kids_sell_log drop constraint if exists kids_sell_log_kind_check;
alter table public.kids_sell_log add constraint kids_sell_log_kind_check check (kind in ('fish', 'bug', 'treasure'));

create or replace function public.kids__sell_bundle(p_kind text, p_item text)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case p_item when 'cabbage_white' then 10 when 'swallowtail' then 5 when 'honeybee' then 10 when 'ladybug' then 10 when 'grasshopper' then 10
      when 'red_dragonfly' then 10 when 'mantis' then 5 when 'cicada' then 5 when 'stag_beetle' then 2 when 'rhino_beetle' then 2 when 'firefly' then 2 else null end
    when p_kind = 'treasure' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_treasure_kinds k where k.id = p_item)
    else null end
$$;

create or replace function public.kids__sell_info(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fish', coalesce((select jsonb_object_agg(s.fish, s.n) from (select x.fish, count(*) n from public.kids_fish x join public.kids_fish_kinds k on k.id = x.fish
        where x.child_id = p_child and x.sold_at is null and k.rarity >= 0 group by x.fish) s), '{}'::jsonb),
    'bugs', coalesce((select jsonb_object_agg(s.bug, s.n) from (select bug, count(*) n from public.kids_bugs
        where child_id = p_child and sold_at is null group by bug) s), '{}'::jsonb),
    'treasures', coalesce((select jsonb_object_agg(s.item, s.n) from (select t.item, count(*) n from public.kids_treasures t join public.kids_treasure_kinds k on k.id = t.item
        where t.child_id = p_child and t.sold_at is null and k.rarity >= 0 group by t.item) s), '{}'::jsonb),
    'bundle', jsonb_build_object(
      'fish', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('fish', k.id)) from public.kids_fish_kinds k where k.rarity >= 0), '{}'::jsonb),
      'bug', jsonb_build_object('cabbage_white', 10, 'swallowtail', 5, 'honeybee', 10, 'ladybug', 10, 'grasshopper', 10, 'red_dragonfly', 10,
        'mantis', 5, 'cicada', 5, 'stag_beetle', 2, 'rhino_beetle', 2, 'firefly', 2),
      'treasure', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('treasure', k.id)) from public.kids_treasure_kinds k where k.rarity >= 0), '{}'::jsonb)),
    'today', coalesce((select sum(fruits) from public.kids_sell_log
        where child_id = p_child and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0),
    'cap', public.kids__sell_day())
$$;

create or replace function public.kids_sell_bundle(p_token text, p_kind text, p_item text, p_bundles integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_size int := public.kids__sell_bundle(p_kind, p_item); v_k int := coalesce(p_bundles, 1);
        v_cap int := public.kids__sell_day(); v_today int; v_got int; v_n int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if v_size is null or v_k < 1 or v_k > 30 then raise exception 'BAD_ITEM'; end if;
  if v_cap <= 0 then raise exception 'SELL_CLOSED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_sell:' || v_id::text));
  select coalesce(sum(fruits), 0) into v_today from public.kids_sell_log where child_id = v_id and created_at >= v_start;
  if v_today + v_k > v_cap then raise exception 'SELL_DAY'; end if;
  v_n := v_size * v_k;
  if p_kind = 'fish' then
    with s as (select id from public.kids_fish where child_id = v_id and fish = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_fish f set sold_at = now() from s where f.id = s.id;
  elsif p_kind = 'bug' then
    with s as (select id from public.kids_bugs where child_id = v_id and bug = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_bugs b set sold_at = now() from s where b.id = s.id;
  else
    with s as (select id from public.kids_treasures where child_id = v_id and item = p_item and sold_at is null order by found_at, id limit v_n for update)
    update public.kids_treasures t set sold_at = now() from s where t.id = s.id;
  end if;
  get diagnostics v_got = row_count;
  if v_got < v_n then raise exception 'NO_ITEM'; end if;
  update public.kids_children set fruits = fruits + v_k where id = v_id;
  insert into public.kids_sell_log (child_id, kind, item, n, fruits) values (v_id, p_kind, p_item, v_n, v_k);
  return public.kids_shop(p_token);
end $$;

-- ---------- 물수제비 ----------
create table if not exists public.kids_skips (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  skips int not null check (skips between 0 and 30),
  thrown_at timestamptz not null default now());
create index if not exists kids_skips_child_idx on public.kids_skips (child_id, thrown_at);
create index if not exists kids_skips_day_idx on public.kids_skips (thrown_at, skips);
alter table public.kids_skips enable row level security;
revoke all on public.kids_skips from anon, authenticated;

-- 오늘의 물수제비 왕: 아이마다 오늘 가장 많이 튄 기록으로 줄 세운다 (같으면 먼저 낸 아이가 앞)
create or replace function public.kids__skip_top(p_me uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.skips desc, x.t), '[]'::jsonb) from (
    select jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'skips', b.skips, 'me', c.id = p_me,
             'teacher', c.teacher_id is not null) j, b.skips, b.t
      from (select distinct on (s.child_id) s.child_id, s.skips, s.thrown_at as t
              from public.kids_skips s
             where s.thrown_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul' and s.skips > 0
             order by s.child_id, s.skips desc, s.thrown_at) b
      join public.kids_children c on c.id = b.child_id
     where c.village_name is not null
     order by b.skips desc, b.t
     limit 5) x
$$;
revoke all on function public.kids__skip_top(uuid) from public, anon, authenticated;

-- 던지기: p_aim은 아이가 단추를 누른 때가 가운데에 얼마나 가까운지 (1이 가장 좋다). 튄 횟수에는 운도 조금 섞인다
create or replace function public.kids_skip_throw(p_token text, p_aim numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_a numeric := greatest(0, least(1, coalesce(p_aim, 0))); v_n int; v_today int;
        v_best_today int; v_best int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_skip:' || v_id::text));
  if exists (select 1 from public.kids_skips where child_id = v_id and thrown_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*), coalesce(max(skips), 0) into v_today, v_best_today from public.kids_skips where child_id = v_id and thrown_at >= v_start;
  if v_today >= 300 then raise exception 'SKIP_DAY'; end if;
  select coalesce(max(skips), 0) into v_best from public.kids_skips where child_id = v_id;
  if v_a < 0.08 then v_n := 0; -- 너무 늦거나 일러서 퐁당
  else v_n := least(20, greatest(1, round((1 + 14 * power(v_a, 1.5)) * (0.8 + random() * 0.4))::int));
  end if;
  insert into public.kids_skips (child_id, skips) values (v_id, v_n);
  return jsonb_build_object('skips', v_n, 'best_today', greatest(v_best_today, v_n), 'best', greatest(v_best, v_n),
    'new_best', v_n > v_best and v_n > 0, 'today_best_new', v_n > v_best_today and v_n > 0, 'top', public.kids__skip_top(v_id));
end $$;
grant execute on function public.kids_skip_throw(text, numeric) to anon, authenticated;

create or replace function public.kids_skip_board(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object('top', public.kids__skip_top(v_id),
    'best', (select coalesce(max(skips), 0) from public.kids_skips where child_id = v_id),
    'best_today', (select coalesce(max(skips), 0) from public.kids_skips where child_id = v_id and thrown_at >= v_start));
end $$;
grant execute on function public.kids_skip_board(text) to anon, authenticated;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true)
$$;
