-- 진숲 어린이 마을: 애완동물 이름, 앵무새, 며칠 걸려 자라는 밭과 수확 바구니(나누기·팔기)
-- 2026-11-02

-- ---------- 1) 앵무새 ----------
alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero'));

create or replace function public.kids__item_price(p_item text)
returns integer language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 else null end
$$;

-- ---------- 2) 애완동물 이름 ----------
-- 애완동물마다 이름 하나 (예: {"pet_dog": "초코"}). 한글·영문·숫자·띄어쓰기로 8글자까지, 나쁜 말·전화번호는 받지 않는다
alter table public.kids_children add column if not exists pet_names jsonb not null default '{}'::jsonb;

create or replace function public.kids_pet_name(p_token text, p_pet text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if p_pet is null or left(p_pet, 4) <> 'pet_' or not exists (select 1 from public.kids_items
      where child_id = v_id and item = p_pet and count > 0) then
    raise exception 'NO_PET';
  end if;
  if v_name = '' then
    update public.kids_children set pet_names = pet_names - p_pet where id = v_id;
  else
    if char_length(v_name) > 8 or v_name !~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]+$' or public.kids__chat_clean(v_name) <> v_name then
      raise exception 'BAD_PET_NAME';
    end if;
    update public.kids_children set pet_names = jsonb_set(pet_names, array[p_pet], to_jsonb(v_name)) where id = v_id;
  end if;
  return jsonb_build_object('pet_names', (select pet_names from public.kids_children where id = v_id));
end $$;
revoke all on function public.kids_pet_name(text, text, text) from public;
grant execute on function public.kids_pet_name(text, text, text) to anon, authenticated;

-- 마을 사람 목록: 데리고 다니는 애완동물 이름도 함께
create or replace function public.kids_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'room', (select value from public.kids_config where key = 'realtime_room'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'pet', c.pet,
        'pet_name', case when c.pet is not null then c.pet_names ->> c.pet end,
        'teacher', c.teacher_id is not null))
      from public.kids_children c where c.village_name is not null and c.avatar is not null), '[]'::jsonb));
end $$;

-- ---------- 3) 밭: 며칠 걸려 자라고, 거둔 것은 수확 바구니에 모은다 ----------
-- need: 처음 다 자라기까지 시간, again: 열매를 딴 뒤 다시 열리기까지 시간, picks: 거둘 수 있는 횟수, yield: 한 번에 거두는 수
create or replace function public.kids__crop(p_seed text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_seed
    when 's_carrot' then '{"crop": "carrot", "need": 48, "again": 0, "picks": 1, "yield": 3}'::jsonb
    when 's_tomato' then '{"crop": "tomato", "need": 72, "again": 36, "picks": 3, "yield": 3}'::jsonb
    when 's_cabbage' then '{"crop": "cabbage", "need": 96, "again": 0, "picks": 1, "yield": 2}'::jsonb
    when 's_strawberry' then '{"crop": "strawberry", "need": 120, "again": 48, "picks": 3, "yield": 4}'::jsonb
    when 's_sunflower' then '{"need": 72}'::jsonb
    when 's_tulip' then '{"need": 48}'::jsonb
    else null end
$$;
-- 물: 12시간에 한 번, 줄 때마다 6시간만큼 빨리 자란다
create or replace function public.kids__now_ms()
returns bigint language sql stable set search_path = '' as $$
  select floor(extract(epoch from now()) * 1000)::bigint
$$;
-- 심은(또는 다시 열리기 시작한) 뒤 자란 시간 (물로 당긴 시간 포함)
create or replace function public.kids__grown_h(e jsonb)
returns numeric language sql stable set search_path = '' as $$
  select greatest(0, (public.kids__now_ms() - coalesce((e->>'t')::numeric, public.kids__now_ms())) / 3600000.0) + coalesce((e->>'g')::numeric, 0)
$$;
create or replace function public.kids__need_h(e jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case when coalesce((e->>'n')::int, 0) > 0 then (public.kids__crop(e->>'k')->>'again')::numeric
    else (public.kids__crop(e->>'k')->>'need')::numeric end
$$;

create table if not exists public.kids_crops (
  child_id uuid not null references public.kids_children(id) on delete cascade,
  crop text not null check (crop in ('carrot', 'tomato', 'cabbage', 'strawberry')),
  count integer not null default 0 check (count between 0 and 999),
  primary key (child_id, crop)
);
alter table public.kids_crops enable row level security;

create or replace function public.kids__crops(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(crop, count), '{}'::jsonb) from public.kids_crops where child_id = p_child and count > 0
$$;

-- 밭 식물의 자람 기록(t 심은 시각, g 물로 당긴 시간, w 물 준 시각, n 거둔 횟수)은 서버가 정한다
create or replace function public.kids__plants(p_layout jsonb)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(a->>'id', jsonb_strip_nulls(jsonb_build_object('t', a->'t', 'g', a->'g', 'w', a->'w', 'n', a->'n'))), '{}'::jsonb)
    from jsonb_array_elements(p_layout) a where left(a->>'k', 2) = 's_'
$$;

create or replace function public.kids_home(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'layout', coalesce((select layout from public.kids_homes where child_id = v_id), '[]'::jsonb),
    'items', public.kids__home_items(v_id),
    'fruits', (select fruits from public.kids_children where id = v_id),
    'crops', public.kids__crops(v_id),
    'now', public.kids__now_ms());
end $$;

create or replace function public.kids_home_visit(p_token text, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text;
begin
  select village_name into v_name from public.kids_children
   where id = p_child and village_name is not null and avatar is not null;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('name', v_name,
    'layout', coalesce((select layout from public.kids_homes where child_id = p_child), '[]'::jsonb),
    'now', public.kids__now_ms());
end $$;

-- 집 저장: 새로 심은 식물은 서버 시각으로 심은 때를 적고, 있던 식물은 서버에 적힌 자람 기록을 그대로 둔다.
-- p_harvest는 예전 화면과 맞추려고 받기만 한다 (거두기는 kids_garden_harvest)
create or replace function public.kids_home_save(p_token text, p_layout jsonb, p_harvest jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_old jsonb; e jsonb; o jsonb; v_new jsonb := '[]'::jsonb; v_now bigint := public.kids__now_ms();
begin
  if p_layout is null or jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 150 or length(p_layout::text) > 40000 then
    raise exception 'BAD_HOME';
  end if;
  for e in select * from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string' or length(e->>'id') > 24
       or (e->>'k') is null or (e->>'k') not in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
       or jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'z') <> 'number'
       or (e->>'x')::numeric not between -12 and 12 or (e->>'z')::numeric not between -12 and 12
       or (e->'r' is not null and (jsonb_typeof(e->'r') <> 'number' or (e->>'r')::numeric not in (0, 1, 2, 3))) then
      raise exception 'BAD_HOME';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_layout) a) <> (select count(distinct a->>'id') from jsonb_array_elements(p_layout) a) then
    raise exception 'BAD_HOME';
  end if;
  if exists (
    select 1 from (select a->>'k' k, count(*) n from jsonb_array_elements(p_layout) a group by 1) u
    where u.n > coalesce((select count from public.kids_items i where i.child_id = v_id and i.item = u.k), 0)) then
    raise exception 'NOT_ENOUGH';
  end if;
  select layout into v_old from public.kids_homes where child_id = v_id for update;
  v_old := coalesce(v_old, '[]'::jsonb);
  for e in select * from jsonb_array_elements(p_layout) loop
    e := e - 't' - 'g' - 'w' - 'n';
    if left(e->>'k', 2) = 's_' then
      select a into o from jsonb_array_elements(v_old) a where a->>'id' = e->>'id' and a->>'k' = e->>'k' limit 1;
      if o is not null then
        e := e || jsonb_strip_nulls(jsonb_build_object('t', o->'t', 'g', o->'g', 'w', o->'w', 'n', o->'n'));
      else
        e := e || jsonb_build_object('t', v_now);
      end if;
      o := null;
    end if;
    v_new := v_new || jsonb_build_array(e);
  end loop;
  insert into public.kids_homes (child_id, layout, updated_at) values (v_id, v_new, now())
    on conflict (child_id) do update set layout = excluded.layout, updated_at = now();
  return jsonb_build_object('ok', true, 'items', public.kids__home_items(v_id), 'plants', public.kids__plants(v_new), 'now', v_now);
end $$;

-- 물 주기
create or replace function public.kids_garden_water(p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_layout jsonb; e jsonb; v_i int; v_now bigint := public.kids__now_ms();
begin
  select layout into v_layout from public.kids_homes where child_id = v_id for update;
  select a.e, a.i - 1 into e, v_i from jsonb_array_elements(coalesce(v_layout, '[]'::jsonb)) with ordinality a(e, i) where a.e->>'id' = p_id limit 1;
  if e is null or left(e->>'k', 2) <> 's_' then raise exception 'NO_PLANT'; end if;
  if public.kids__grown_h(e) >= public.kids__need_h(e) then raise exception 'RIPE'; end if;
  if e->'w' is not null and v_now - (e->>'w')::bigint < 12 * 3600000 then raise exception 'WATERED'; end if;
  e := e || jsonb_build_object('g', coalesce((e->>'g')::numeric, 0) + 6, 'w', v_now);
  update public.kids_homes set layout = jsonb_set(v_layout, array[v_i::text], e), updated_at = now() where child_id = v_id;
  return jsonb_build_object('id', p_id, 'plant', jsonb_strip_nulls(jsonb_build_object('t', e->'t', 'g', e->'g', 'w', e->'w', 'n', e->'n')), 'now', v_now);
end $$;

-- 거두기: 다 자란 채소·열매를 수확 바구니에 담는다. 당근·배추는 뽑으면 끝, 토마토·딸기는 세 번까지 다시 열린다
create or replace function public.kids_garden_harvest(p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_layout jsonb; e jsonb; v_i int; c jsonb; v_n int; v_done boolean;
        v_now bigint := public.kids__now_ms(); v_crop text; v_yield int;
begin
  select layout into v_layout from public.kids_homes where child_id = v_id for update;
  select a.e, a.i - 1 into e, v_i from jsonb_array_elements(coalesce(v_layout, '[]'::jsonb)) with ordinality a(e, i) where a.e->>'id' = p_id limit 1;
  if e is null or left(e->>'k', 2) <> 's_' then raise exception 'NO_PLANT'; end if;
  c := public.kids__crop(e->>'k');
  v_crop := c->>'crop';
  if v_crop is null then raise exception 'NOT_CROP'; end if;
  if public.kids__grown_h(e) < public.kids__need_h(e) then raise exception 'NOT_RIPE'; end if;
  v_yield := (c->>'yield')::int;
  insert into public.kids_crops (child_id, crop, count) values (v_id, v_crop, v_yield)
    on conflict (child_id, crop) do update set count = least(999, public.kids_crops.count + excluded.count);
  v_n := coalesce((e->>'n')::int, 0) + 1;
  v_done := v_n >= (c->>'picks')::int;
  if v_done then
    -- 다 거둔 식물은 밭에서 빼고 씨앗(모종)도 다 쓴 것으로 한다
    v_layout := v_layout - v_i;
    update public.kids_items set count = count - 1 where child_id = v_id and item = e->>'k' and count > 0;
  else
    e := (e - 'g' - 'w') || jsonb_build_object('t', v_now, 'n', v_n);
    v_layout := jsonb_set(v_layout, array[v_i::text], e);
  end if;
  update public.kids_homes set layout = v_layout, updated_at = now() where child_id = v_id;
  return jsonb_build_object('id', p_id, 'crop', v_crop, 'got', v_yield, 'done', v_done, 'picks', v_n,
    'plant', case when v_done then null else jsonb_strip_nulls(jsonb_build_object('t', e->'t', 'g', e->'g', 'w', e->'w', 'n', e->'n')) end,
    'crops', public.kids__crops(v_id), 'items', public.kids__home_items(v_id), 'now', v_now);
end $$;
revoke all on function public.kids_garden_water(text, text) from public;
revoke all on function public.kids_garden_harvest(text, text) from public;
grant execute on function public.kids_garden_water(text, text) to anon, authenticated;
grant execute on function public.kids_garden_harvest(text, text) to anon, authenticated;

-- ---------- 4) 나눔 바구니: 거둔 것을 마을 식탁 옆 나눔 수레에 올리면 친구들이 하나씩 먹는다 ----------
create table if not exists public.kids_shares (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  crop text not null check (crop in ('carrot', 'tomato', 'cabbage', 'strawberry')),
  n integer not null check (n between 1 and 10),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.kids_share_eats (
  share_id bigint not null references public.kids_shares(id) on delete cascade,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (share_id, child_id)
);
create index if not exists kids_shares_recent on public.kids_shares (created_at desc);
alter table public.kids_shares enable row level security;
alter table public.kids_share_eats enable row level security;

create or replace function public.kids__share_eaters(p_share bigint)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(s.n order by s.at), '[]'::jsonb) from (
    select c.village_name n, e.created_at at from public.kids_share_eats e join public.kids_children c on c.id = e.child_id
     where e.share_id = p_share and c.village_name is not null order by e.created_at limit 10) s
$$;

create or replace function public.kids_crop_share(p_token text, p_crop text, p_n integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_n int := coalesce(p_n, 0); v_share bigint;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if p_crop is null or p_crop not in ('carrot', 'tomato', 'cabbage', 'strawberry') or v_n < 1 or v_n > 10 then raise exception 'BAD_ITEM'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_share:' || v_id::text));
  if exists (select 1 from public.kids_shares where child_id = v_id and created_at > now() - interval '3 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.kids_shares where child_id = v_id and created_at >= v_start) >= 10 then raise exception 'SHARE_DAY'; end if;
  update public.kids_crops set count = count - v_n where child_id = v_id and crop = p_crop and count >= v_n;
  if not found then raise exception 'NO_CROP'; end if;
  insert into public.kids_shares (child_id, crop, n) values (v_id, p_crop, v_n) returning id into v_share;
  return jsonb_build_object('id', v_share, 'crops', public.kids__crops(v_id));
end $$;

-- 나눔 수레: 아직 남은 바구니 최근 네 개 (일주일 안)
create or replace function public.kids_share_table(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(x order by at desc) from (
    select jsonb_build_object('id', s.id, 'crop', s.crop, 'n', s.n, 'by', c.village_name, 'me', s.child_id = v_id,
             'eaten', (select count(*) from public.kids_share_eats e where e.share_id = s.id),
             'eaters', public.kids__share_eaters(s.id),
             'ate', exists (select 1 from public.kids_share_eats e where e.share_id = s.id and e.child_id = v_id)) as x, s.created_at as at
      from public.kids_shares s join public.kids_children c on c.id = s.child_id
     where not s.hidden and s.created_at > now() - interval '7 days'
       and (select count(*) from public.kids_share_eats e where e.share_id = s.id) < s.n
     order by s.created_at desc limit 4) q), '[]'::jsonb);
end $$;

create or replace function public.kids_share_eat(p_token text, p_share bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); s public.kids_shares; v_eaten int;
begin
  select * into s from public.kids_shares where id = p_share and not hidden for update;
  if s.id is null then raise exception 'NOT_FOUND'; end if;
  if s.child_id = v_id then raise exception 'OWN_SHARE'; end if;
  if exists (select 1 from public.kids_share_eats where share_id = s.id and child_id = v_id) then raise exception 'ATE_SHARE'; end if;
  select count(*) into v_eaten from public.kids_share_eats where share_id = s.id;
  if v_eaten >= s.n then raise exception 'ALL_EATEN'; end if;
  insert into public.kids_share_eats (share_id, child_id) values (s.id, v_id);
  return jsonb_build_object('id', s.id, 'crop', s.crop, 'n', s.n, 'eaten', v_eaten + 1, 'eaters', public.kids__share_eaters(s.id));
end $$;
revoke all on function public.kids_crop_share(text, text, integer) from public;
revoke all on function public.kids_share_table(text) from public;
revoke all on function public.kids_share_eat(text, bigint) from public;
grant execute on function public.kids_crop_share(text, text, integer) to anon, authenticated;
grant execute on function public.kids_share_table(text) to anon, authenticated;
grant execute on function public.kids_share_eat(text, bigint) to anon, authenticated;

-- ---------- 5) 팔기: 수확한 채소와 열매도 열매 상점에서 판다 ----------
-- 당근 2개, 토마토 3개, 배추 1포기, 딸기 4개에 열매 1개
create or replace function public.kids__sell_bundle(p_kind text, p_item text)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case p_item when 'cabbage_white' then 10 when 'swallowtail' then 5 when 'honeybee' then 10 when 'ladybug' then 10 when 'grasshopper' then 10
      when 'red_dragonfly' then 10 when 'mantis' then 5 when 'cicada' then 5 when 'stag_beetle' then 2 when 'rhino_beetle' then 2 when 'firefly' then 2 else null end
    when p_kind = 'treasure' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_treasure_kinds k where k.id = p_item)
    when p_kind = 'crop' then case p_item when 'carrot' then 2 when 'tomato' then 3 when 'cabbage' then 1 when 'strawberry' then 4 else null end
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
    'crops', public.kids__crops(p_child),
    'bundle', jsonb_build_object(
      'fish', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('fish', k.id)) from public.kids_fish_kinds k where k.rarity >= 0), '{}'::jsonb),
      'bug', jsonb_build_object('cabbage_white', 10, 'swallowtail', 5, 'honeybee', 10, 'ladybug', 10, 'grasshopper', 10, 'red_dragonfly', 10,
        'mantis', 5, 'cicada', 5, 'stag_beetle', 2, 'rhino_beetle', 2, 'firefly', 2),
      'treasure', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('treasure', k.id)) from public.kids_treasure_kinds k where k.rarity >= 0), '{}'::jsonb),
      'crop', jsonb_build_object('carrot', 2, 'tomato', 3, 'cabbage', 1, 'strawberry', 4)),
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
    get diagnostics v_got = row_count;
  elsif p_kind = 'bug' then
    with s as (select id from public.kids_bugs where child_id = v_id and bug = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_bugs b set sold_at = now() from s where b.id = s.id;
    get diagnostics v_got = row_count;
  elsif p_kind = 'crop' then
    update public.kids_crops set count = count - v_n where child_id = v_id and crop = p_item and count >= v_n;
    v_got := case when found then v_n else 0 end;
  else
    with s as (select id from public.kids_treasures where child_id = v_id and item = p_item and sold_at is null order by found_at, id limit v_n for update)
    update public.kids_treasures t set sold_at = now() from s where t.id = s.id;
    get diagnostics v_got = row_count;
  end if;
  if v_got < v_n then raise exception 'NO_ITEM'; end if;
  update public.kids_children set fruits = fruits + v_k where id = v_id;
  insert into public.kids_sell_log (child_id, kind, item, n, fruits) values (v_id, p_kind, p_item, v_n, v_k);
  return public.kids_shop(p_token);
end $$;

-- 상점: 앵무새 값과 애완동물 이름
create or replace function public.kids_shop(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale();
begin
  return jsonb_build_object(
    'fruits', (select fruits from public.kids_children where id = v_id),
    'pet', (select pet from public.kids_children where id = v_id),
    'pet_names', (select pet_names from public.kids_children where id = v_id),
    'items', coalesce((select jsonb_object_agg(item, count) from public.kids_items where child_id = v_id and count > 0), '{}'::jsonb),
    'sale', v_sale,
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

-- 새 기능 표시
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true)
$$;

-- 안에서만 쓰는 도움 함수는 바깥(anon, authenticated)에서 부르지 못하게
revoke all on function public.kids__crop(text) from public, anon, authenticated;
revoke all on function public.kids__crops(uuid) from public, anon, authenticated;
revoke all on function public.kids__plants(jsonb) from public, anon, authenticated;
revoke all on function public.kids__share_eaters(bigint) from public, anon, authenticated;
revoke all on function public.kids__now_ms() from public, anon, authenticated;
revoke all on function public.kids__grown_h(jsonb) from public, anon, authenticated;
revoke all on function public.kids__need_h(jsonb) from public, anon, authenticated;
