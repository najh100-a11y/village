-- 진숲 어린이 마을: 바다 낚시 나루터 (배를 타고 나가 바다 물고기를 낚는다)
-- 다시 실행해도 된다. 물고기 값은 js/play-data.js의 FISH와 같다.
-- 연못 낚시(kids_fish_hook, 옛 kids_fish_catch)는 연못 물고기만, 바다 낚시(kids_sea_hook)는 바다 물고기만 뽑는다.
-- 잡은 기록(kids_fish_land), 하루 80마리, 도감, 팔기(묶음 크기는 rarity로 정한다)는 연못과 같이 쓴다.

alter table public.kids_fish_kinds add column if not exists place text not null default 'pond';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kids_fish_kinds_place_check') then
    alter table public.kids_fish_kinds add constraint kids_fish_kinds_place_check check (place in ('pond', 'sea'));
  end if;
end $$;

insert into public.kids_fish_kinds (id, name, weight, min_cm, max_cm, rarity, sort, place) values
  ('anchovy', '멸치', 22, 6, 14, 0, 14, 'sea'),
  ('jack', '전갱이', 20, 15, 35, 0, 15, 'sea'),
  ('mackerel', '고등어', 18, 20, 45, 0, 16, 'sea'),
  ('rockfish', '우럭', 10, 20, 50, 1, 17, 'sea'),
  ('flounder', '광어', 8, 30, 80, 1, 18, 'sea'),
  ('squid', '오징어', 8, 20, 40, 1, 19, 'sea'),
  ('seabream', '참돔', 4, 25, 70, 2, 20, 'sea'),
  ('hairtail', '갈치', 4, 50, 120, 2, 21, 'sea'),
  ('octopus', '문어', 3, 30, 90, 2, 22, 'sea'),
  ('tuna', '참치', 1, 80, 180, 3, 23, 'sea'),
  ('bottle', '빈 병', 6, 0, 0, -1, 24, 'sea'),
  ('oldnet', '낡은 그물', 5, 0, 0, -1, 25, 'sea')
on conflict (id) do update set name = excluded.name, weight = excluded.weight, min_cm = excluded.min_cm,
  max_cm = excluded.max_cm, rarity = excluded.rarity, sort = excluded.sort, place = excluded.place;

-- 낚시터(p_place)에서 무게대로 하나 뽑아 '다가오는 물고기'로 정해 둔다 (제때 당기면 kids_fish_land가 기록한다)
create or replace function public.kids__fish_pick(p_id uuid, p_place text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_r numeric; v_acc int := 0; v_total int; k public.kids_fish_kinds; v_size numeric(5,1); v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(p_id) then raise exception 'PLAY_LOCKED'; end if;
  if exists (select 1 from public.kids_fish_pending where child_id = p_id and created_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_today from public.kids_fish where child_id = p_id and caught_at >= v_start;
  if v_today >= 80 then raise exception 'FISH_TIRED'; end if;
  select sum(weight) into v_total from public.kids_fish_kinds where place = p_place;
  v_r := floor(random() * v_total);
  for k in select * from public.kids_fish_kinds where place = p_place order by sort loop
    v_acc := v_acc + k.weight;
    exit when v_r < v_acc;
  end loop;
  v_size := case when k.rarity < 0 then 0 else round((k.min_cm + random() * (k.max_cm - k.min_cm))::numeric, 1) end;
  insert into public.kids_fish_pending (child_id, fish, size_cm, created_at) values (p_id, k.id, v_size, now())
  on conflict (child_id) do update set fish = excluded.fish, size_cm = excluded.size_cm, created_at = now();
  return jsonb_build_object('fish', k.id, 'size', v_size, 'rarity', k.rarity);
end $$;
revoke all on function public.kids__fish_pick(uuid, text) from public, anon, authenticated;

create or replace function public.kids_fish_hook(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.kids__fish_pick(public.kids__auth(p_token, 'child'), 'pond');
end $$;

create or replace function public.kids_sea_hook(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.kids__fish_pick(public.kids__auth(p_token, 'child'), 'sea');
end $$;
grant execute on function public.kids_sea_hook(text) to anon, authenticated;

-- 옛 2D 낚시: 연못 물고기만
create or replace function public.kids_fish_catch(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_r numeric; v_acc int := 0; v_total int;
        k public.kids_fish_kinds; v_size numeric(5,1); v_first boolean; v_best boolean; v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if exists (select 1 from public.kids_fish where child_id = v_id and caught_at > now() - interval '3 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_today from public.kids_fish where child_id = v_id and caught_at >= v_start;
  if v_today >= 80 then raise exception 'FISH_TIRED'; end if;
  select sum(weight) into v_total from public.kids_fish_kinds where place = 'pond';
  v_r := floor(random() * v_total);
  for k in select * from public.kids_fish_kinds where place = 'pond' order by sort loop
    v_acc := v_acc + k.weight;
    exit when v_r < v_acc;
  end loop;
  v_size := case when k.rarity < 0 then 0 else round((k.min_cm + random() * (k.max_cm - k.min_cm))::numeric, 1) end;
  v_first := not exists (select 1 from public.kids_fish where child_id = v_id and fish = k.id);
  v_best := k.rarity >= 0 and not v_first and v_size > (select max(size_cm) from public.kids_fish where child_id = v_id and fish = k.id);
  insert into public.kids_fish (child_id, fish, size_cm) values (v_id, k.id, v_size);
  return jsonb_build_object('fish', k.id, 'name', k.name, 'rarity', k.rarity, 'size', v_size,
    'first', v_first, 'best', v_best, 'today', v_today + 1);
end $$;

-- 도감: 오늘의 큰 물고기는 연못(today_top)과 바다(today_sea)를 따로 센다
create or replace function public.kids_fish_book(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'mine', coalesce((select jsonb_object_agg(f.fish, jsonb_build_object('count', f.n, 'best', f.best))
      from (select fish, count(*) n, max(size_cm) best from public.kids_fish where child_id = v_id group by fish) f), '{}'::jsonb),
    'today_top', coalesce((select jsonb_agg(t) from (
      select jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'fish', x.fish,
               'size', x.size_cm, 'at', x.caught_at) t
        from public.kids_fish x join public.kids_children c on c.id = x.child_id join public.kids_fish_kinds k on k.id = x.fish
       where x.caught_at >= v_start and k.rarity >= 0 and k.place = 'pond' and c.village_name is not null
       order by x.size_cm desc, x.caught_at limit 5) s), '[]'::jsonb),
    'today_sea', coalesce((select jsonb_agg(t) from (
      select jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'fish', x.fish,
               'size', x.size_cm, 'at', x.caught_at) t
        from public.kids_fish x join public.kids_children c on c.id = x.child_id join public.kids_fish_kinds k on k.id = x.fish
       where x.caught_at >= v_start and k.rarity >= 0 and k.place = 'sea' and c.village_name is not null
       order by x.size_cm desc, x.caught_at limit 5) s), '[]'::jsonb),
    'my_today', (select count(*) from public.kids_fish where child_id = v_id and caught_at >= v_start));
end $$;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true)
$$;
