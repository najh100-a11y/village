-- 진숲 어린이 마을: 집 넓히기 (거실, 주방, 방 2, 방 3)와 새 가구 19가지, 방마다 벽지·바닥
-- 지은 방은 kids_homes.rooms에 지은 차례대로, 벽지·바닥은 kids_homes.style에 방마다 적는다.
-- 공사비는 열매(거실·주방 20, 방 15, 선생님 할인을 받는다). 산 기록은 kids_shop_log에 'home_living'처럼 'home_방 이름'으로 남는다.
-- 방 자리와 문, 가구를 놓는 칸은 화면(js/homeitems.js)이 정한다. 서버는 놓은 자리의 넓이(-44~12, -12~12)만 본다. 다시 실행해도 된다.

alter table public.kids_homes add column if not exists rooms jsonb not null default '[]'::jsonb;
alter table public.kids_homes add column if not exists style jsonb not null default '{}'::jsonb;

alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'fw_volley', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero', 'av_h_cloud', 'av_h_spacebuns', 'av_h_twintails', 'av_h_sidetail', 'av_h_wavy', 'av_h_princess', 'av_h_quiff', 'av_h_messy', 'av_h_dino', 'av_h_daenggi', 'av_h_sangtu'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'fw_volley' then 7 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'pet_maltese' then 30 when 'pet_yorkie' then 30 when 'pet_poodle' then 30 when 'pet_pom' then 30 when 'pet_bichon' then 30 when 'pet_corgi' then 30 when 'pet_jindo' then 30 when 'pet_golden' then 30 when 'pet_dachs' then 30 when 'pet_beagle' then 30 when 'pet_cheese' then 30 when 'pet_mackerel' then 30 when 'pet_tuxedo' then 30 when 'pet_russian' then 30 when 'pet_persian' then 30 when 'pet_siamese' then 30 when 'pet_ragdoll' then 30 when 'pet_budgie' then 30 when 'pet_budblue' then 30 when 'pet_lovebird' then 30 when 'pet_tiel' then 30 when 'pet_macaw' then 30 when 'pet_grey' then 30 when 'pet_conure' then 30 when 'pet_cockatoo' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'h_bunk' then 10 when 'h_drawer' then 5 when 'h_dresser' then 6 when 'h_globe' then 3 when 'h_bigsofa' then 9 when 'h_coffee' then 4 when 'h_tv' then 7 when 'h_fishtank' then 8 when 'h_clock' then 6 when 'h_rocking' then 5 when 'h_beanbag' then 4 when 'h_bigrug' then 5 when 'h_tallplant' then 3 when 'h_fireplace' then 9 when 'h_dtable' then 8 when 'h_fridge' then 7 when 'h_sink' then 6 when 'h_cupboard' then 6 when 'h_oven' then 5 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 when 'av_h_cloud' then 6 when 'av_h_spacebuns' then 5 when 'av_h_twintails' then 5 when 'av_h_sidetail' then 4 when 'av_h_wavy' then 6 when 'av_h_princess' then 7 when 'av_h_quiff' then 4 when 'av_h_messy' then 3 when 'av_h_dino' then 5 when 'av_h_daenggi' then 5 when 'av_h_sangtu' then 4 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 열매 상점: 값 목록에 새 가구를 더한다 (나머지는 그대로)
create or replace function public.kids_shop(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale();
begin
  return jsonb_build_object(
    'fruits', (select fruits from public.kids_children where id = v_id),
    'pet', (select pet from public.kids_children where id = v_id),
    'pets', (select public.kids__pets_json(pets, pet_names) from public.kids_children where id = v_id),
    'pet_names', (select pet_names from public.kids_children where id = v_id),
    'items', coalesce((select jsonb_object_agg(item, count) from public.kids_items where child_id = v_id and count > 0), '{}'::jsonb),
    'sale', v_sale,
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

create or replace function public.kids__home_items(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(item, count), '{}'::jsonb) from public.kids_items
   where child_id = p_child and count > 0 and item in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
$$;
revoke all on function public.kids__home_items(uuid) from public, anon, authenticated;

-- 공사비 (할인 전)
create or replace function public.kids__build_price(p_space text)
returns int language sql immutable set search_path = '' as $$
  select case p_space when 'living' then 20 when 'kitchen' then 20 when 'room2' then 15 when 'room3' then 15 else null end
$$;
revoke all on function public.kids__build_price(text) from public, anon, authenticated;

-- 집 정보: 놓은 물건, 가진 물건, 지은 방, 벽지·바닥, 공사비(할인한 값과 원래 값)
create or replace function public.kids_home(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale(); h record;
begin
  select layout, rooms, style into h from public.kids_homes where child_id = v_id;
  return jsonb_build_object(
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'items', public.kids__home_items(v_id),
    'fruits', (select fruits from public.kids_children where id = v_id),
    'crops', public.kids__crops(v_id),
    'sale', v_sale,
    'build', (select jsonb_object_agg(s, greatest(1, floor(public.kids__build_price(s) * (100 - v_sale) / 100.0)::int)) from unnest(array['living', 'kitchen', 'room2', 'room3']) s),
    'build_base', (select jsonb_object_agg(s, public.kids__build_price(s)) from unnest(array['living', 'kitchen', 'room2', 'room3']) s),
    'now', public.kids__now_ms());
end $$;

create or replace function public.kids_home_visit(p_token text, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text; h record;
begin
  select village_name into v_name from public.kids_children
   where id = p_child and village_name is not null and avatar is not null;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  select layout, rooms, style into h from public.kids_homes where child_id = p_child;
  return jsonb_build_object('name', v_name,
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'now', public.kids__now_ms());
end $$;

-- 집 저장: 새 가구 이름과 넓어진 땅(왼쪽으로 -44까지)을 받는다 (나머지는 그대로)
create or replace function public.kids_home_save(p_token text, p_layout jsonb, p_harvest jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_old jsonb; e jsonb; o jsonb; v_new jsonb := '[]'::jsonb; v_now bigint := public.kids__now_ms();
begin
  if p_layout is null or jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 150 or length(p_layout::text) > 40000 then
    raise exception 'BAD_HOME';
  end if;
  for e in select * from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string' or length(e->>'id') > 24
       or (e->>'k') is null or (e->>'k') not in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
       or jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'z') <> 'number'
       or (e->>'x')::numeric not between -44 and 12 or (e->>'z')::numeric not between -12 and 12
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

-- 집 넓히기 공사: 열매를 내고 방 하나를 짓는다 (지은 차례대로 내 방 왼쪽에 붙는다)
create or replace function public.kids_home_build(p_token text, p_space text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_base int := public.kids__build_price(p_space); v_price int; v_rooms jsonb; v_fruits int;
begin
  if v_base is null then raise exception 'BAD_SPACE'; end if;
  v_price := greatest(1, floor(v_base * (100 - public.kids__sale()) / 100.0)::int);
  insert into public.kids_homes (child_id) values (v_id) on conflict (child_id) do nothing;
  select rooms into v_rooms from public.kids_homes where child_id = v_id for update;
  v_rooms := coalesce(v_rooms, '[]'::jsonb);
  if v_rooms ? p_space or jsonb_array_length(v_rooms) >= 4 then raise exception 'BUILT'; end if;
  update public.kids_children set fruits = fruits - v_price where id = v_id and fruits >= v_price returning fruits into v_fruits;
  if not found then raise exception 'NO_FRUIT'; end if;
  v_rooms := v_rooms || to_jsonb(p_space);
  update public.kids_homes set rooms = v_rooms, updated_at = now() where child_id = v_id;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, 'home_' || p_space, 1, v_price);
  return jsonb_build_object('rooms', v_rooms, 'fruits', v_fruits, 'price', v_price);
end $$;

-- 벽지와 바닥: 내 방이나 지은 방마다 (열매는 들지 않는다)
create or replace function public.kids_home_style(p_token text, p_space text, p_wall text, p_floor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_rooms jsonb; v_style jsonb;
begin
  if p_wall is null or p_wall not in ('cream', 'mint', 'sky', 'pink', 'lemon', 'lilac', 'stripe', 'dots') or p_floor is null or p_floor not in ('wood', 'light', 'dark', 'tile', 'mintc', 'pinkc', 'bluec') then raise exception 'BAD_STYLE'; end if;
  insert into public.kids_homes (child_id) values (v_id) on conflict (child_id) do nothing;
  select rooms, style into v_rooms, v_style from public.kids_homes where child_id = v_id for update;
  if p_space is null or not (p_space = 'room' or coalesce(v_rooms, '[]'::jsonb) ? p_space) then raise exception 'BAD_SPACE'; end if;
  v_style := coalesce(v_style, '{}'::jsonb) || jsonb_build_object(p_space, jsonb_build_object('w', p_wall, 'f', p_floor));
  update public.kids_homes set style = v_style, updated_at = now() where child_id = v_id;
  return jsonb_build_object('style', v_style);
end $$;

revoke all on function public.kids_home_build(text, text) from public;
revoke all on function public.kids_home_style(text, text, text, text) from public;
grant execute on function public.kids_home_build(text, text) to anon, authenticated;
grant execute on function public.kids_home_style(text, text, text, text) to anon, authenticated;

-- 기능 목록: expand(집 넓히기)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true)
$$;
