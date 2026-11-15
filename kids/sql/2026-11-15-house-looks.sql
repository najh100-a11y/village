-- 진숲 어린이 마을: 집 모양 고르기 (나무 오두막, 빨간 벽돌집은 누구나 / 한옥, 통나무집, 버섯집, 작은 성은 열매 15개)
-- 고른 모양과 지붕 색은 kids_homes.look에 {"s": 모양, "c": 지붕 색}으로 적는다. 산 모양은 kids_items에 hs_ 물건으로 하나씩만 둔다.
-- 모양과 색 목록은 화면(js/houses-data.js)과 같다. 다시 실행해도 된다.

alter table public.kids_homes add column if not exists look jsonb not null default '{}'::jsonb;

alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'fw_volley', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero', 'av_h_cloud', 'av_h_spacebuns', 'av_h_twintails', 'av_h_sidetail', 'av_h_wavy', 'av_h_princess', 'av_h_quiff', 'av_h_messy', 'av_h_dino', 'av_h_daenggi', 'av_h_sangtu', 'hs_hanok', 'hs_log', 'hs_mushroom', 'hs_castle'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'fw_volley' then 7 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'pet_maltese' then 30 when 'pet_yorkie' then 30 when 'pet_poodle' then 30 when 'pet_pom' then 30 when 'pet_bichon' then 30 when 'pet_corgi' then 30 when 'pet_jindo' then 30 when 'pet_golden' then 30 when 'pet_dachs' then 30 when 'pet_beagle' then 30 when 'pet_cheese' then 30 when 'pet_mackerel' then 30 when 'pet_tuxedo' then 30 when 'pet_russian' then 30 when 'pet_persian' then 30 when 'pet_siamese' then 30 when 'pet_ragdoll' then 30 when 'pet_budgie' then 30 when 'pet_budblue' then 30 when 'pet_lovebird' then 30 when 'pet_tiel' then 30 when 'pet_macaw' then 30 when 'pet_grey' then 30 when 'pet_conure' then 30 when 'pet_cockatoo' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'h_bunk' then 10 when 'h_drawer' then 5 when 'h_dresser' then 6 when 'h_globe' then 3 when 'h_bigsofa' then 9 when 'h_coffee' then 4 when 'h_tv' then 7 when 'h_fishtank' then 8 when 'h_clock' then 6 when 'h_rocking' then 5 when 'h_beanbag' then 4 when 'h_bigrug' then 5 when 'h_tallplant' then 3 when 'h_fireplace' then 9 when 'h_dtable' then 8 when 'h_fridge' then 7 when 'h_sink' then 6 when 'h_cupboard' then 6 when 'h_oven' then 5 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 when 'av_h_cloud' then 6 when 'av_h_spacebuns' then 5 when 'av_h_twintails' then 5 when 'av_h_sidetail' then 4 when 'av_h_wavy' then 6 when 'av_h_princess' then 7 when 'av_h_quiff' then 4 when 'av_h_messy' then 3 when 'av_h_dino' then 5 when 'av_h_daenggi' then 5 when 'av_h_sangtu' then 4 when 'hs_hanok' then 15 when 'hs_log' then 15 when 'hs_mushroom' then 15 when 'hs_castle' then 15 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 열매 상점: 값 목록에 집 모양을 더한다 (나머지는 그대로)
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
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4), ('hs_hanok', 15), ('hs_log', 15), ('hs_mushroom', 15), ('hs_castle', 15)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4), ('hs_hanok', 15), ('hs_log', 15), ('hs_mushroom', 15), ('hs_castle', 15)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

-- 사기: 집 모양(hs_)도 애완동물, 꾸미기처럼 하나만 산다
create or replace function public.kids_shop_buy(p_token text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__sale_price(p_item); v_n int := coalesce(p_n, 1); v_have int;
        v_one boolean := left(coalesce(p_item, ''), 4) = 'pet_' or left(coalesce(p_item, ''), 3) = 'av_' or left(coalesce(p_item, ''), 3) = 'hs_';
begin
  if v_one then v_n := 1; end if;
  if v_price is null or v_n < 1 or v_n > 5 then raise exception 'BAD_ITEM'; end if;
  select coalesce((select count from public.kids_items where child_id = v_id and item = p_item), 0) into v_have;
  if left(p_item, 4) = 'pet_' and v_have >= 1 then raise exception 'HAVE_PET'; end if;
  if left(p_item, 3) = 'av_' and v_have >= 1 then raise exception 'HAVE_ITEM'; end if;
  if left(p_item, 3) = 'hs_' and v_have >= 1 then raise exception 'HAVE_HOUSE'; end if;
  if v_have + v_n > 99 then raise exception 'BAG_FULL'; end if;
  update public.kids_children set fruits = fruits - v_price * v_n where id = v_id and fruits >= v_price * v_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  insert into public.kids_items (child_id, item, count) values (v_id, p_item, v_n)
    on conflict (child_id, item) do update set count = public.kids_items.count + excluded.count;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;

-- 산 집 모양 (모양 이름 목록)
create or replace function public.kids__houses(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(substr(item, 4) order by item), '[]'::jsonb) from public.kids_items
   where child_id = p_child and count > 0 and left(item, 3) = 'hs_'
$$;
revoke all on function public.kids__houses(uuid) from public, anon, authenticated;

-- 집 모양 보기와 바꾸기: 모양과 색을 둘 다 비우면 지금 모양만 알려 준다.
-- 하나만 주면 다른 하나는 지금 값을 그대로 둔다. 산 적 없는 모양은 고를 수 없다(NEED_HOUSE).
create or replace function public.kids_home_look(p_token text, p_style text default null, p_roof text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_look jsonb; v_s text; v_c text;
begin
  select look into v_look from public.kids_homes where child_id = v_id;
  v_look := coalesce(v_look, '{}'::jsonb);
  if p_style is not null or p_roof is not null then
    v_s := coalesce(p_style, v_look->>'s', 'cabin');
    v_c := coalesce(p_roof, v_look->>'c', 'auto');
    if v_s not in ('cabin', 'brick', 'hanok', 'log', 'mushroom', 'castle') or v_c not in ('auto', 'green', 'red', 'blue', 'orange', 'purple', 'brown', 'gray', 'pink') then raise exception 'BAD_LOOK'; end if;
    if v_s not in ('cabin', 'brick') and not exists (
      select 1 from public.kids_items where child_id = v_id and item = 'hs_' || v_s and count > 0) then
      raise exception 'NEED_HOUSE';
    end if;
    v_look := jsonb_build_object('s', v_s, 'c', v_c);
    insert into public.kids_homes (child_id, look) values (v_id, v_look)
      on conflict (child_id) do update set look = excluded.look, updated_at = now();
  end if;
  return jsonb_build_object('look', v_look, 'houses', public.kids__houses(v_id));
end $$;
revoke all on function public.kids_home_look(text, text, text) from public;
grant execute on function public.kids_home_look(text, text, text) to anon, authenticated;

-- 집 정보: 모양과 산 모양을 더한다 (나머지는 그대로)
create or replace function public.kids_home(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale(); h record;
begin
  select layout, rooms, style, look into h from public.kids_homes where child_id = v_id;
  return jsonb_build_object(
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'look', coalesce(h.look, '{}'::jsonb),
    'houses', public.kids__houses(v_id),
    'items', public.kids__home_items(v_id),
    'fruits', (select fruits from public.kids_children where id = v_id),
    'crops', public.kids__crops(v_id),
    'sale', v_sale,
    'build', (select jsonb_object_agg(s, greatest(1, floor(public.kids__build_price(s) * (100 - v_sale) / 100.0)::int)) from unnest(array['living', 'kitchen', 'room2', 'room3']) s),
    'build_base', (select jsonb_object_agg(s, public.kids__build_price(s)) from unnest(array['living', 'kitchen', 'room2', 'room3']) s),
    'now', public.kids__now_ms());
end $$;

-- 친구 집 놀러가기: 모양과 친구 모습(지붕 '옷 색깔'에 쓴다)을 더한다
create or replace function public.kids_home_visit(p_token text, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text; v_avatar jsonb; h record;
begin
  select village_name, avatar into v_name, v_avatar from public.kids_children
   where id = p_child and village_name is not null and avatar is not null;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  select layout, rooms, style, look into h from public.kids_homes where child_id = p_child;
  return jsonb_build_object('name', v_name, 'avatar', v_avatar,
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'look', coalesce(h.look, '{}'::jsonb),
    'now', public.kids__now_ms());
end $$;

-- 기능 목록: houses(집 모양)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true)
$$;
