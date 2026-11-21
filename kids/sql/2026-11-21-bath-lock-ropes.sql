-- 진숲 어린이 마을: 화장실, 집 잠그기, 여러 가지 줄넘기
-- 1) 화장실: 집 넓히기에 화장실(내 방 뒤, 공사비 열매 15, 선생님 할인을 받는다)을 더한다. 지을 수 있는 방이 다섯이 된다.
--    화장실 물건 7가지(변기, 세면대, 욕조, 샤워기, 세탁기, 수건걸이, 발 매트)를 상점에 더한다.
--    화장실 자리와 문, 물건을 놓는 곳은 화면(js/homeitems.js)이 정한다. 서버는 예전처럼 놓은 자리의 넓이(x -44~12, z -17~12)만 본다.
-- 2) 집 잠그기: 집 주인이 '비울 때 잠그기'를 켜 두면(kids_homes.locked), 주인이 마을에 없을 때는 친구가 그 집에 들어가지 못한다(kids_home_visit이 HOME_LOCKED).
--    앱은 마을에 있는 동안 1분마다 kids_here를 불러 '마을에 있다'고 알리고(kids_homes.here_at), 서버는 마지막 알림부터 2분 30초까지 마을에 있다고 본다.
--    나가기(kids_logout)를 누르면 바로 마을에 없는 것으로 한다. 이웃 마을 집 목록(kids_neighbors)에 지금 잠겨 있는지(locked)를 더한다.
-- 3) 줄넘기: 여러 가지 줄(jr_ 8가지)을 상점에서 산다(한 가지는 한 번만). 고른 줄은 kids_children.rope에 적고(kids_jr_rope), kids_me가 알려 준다.
--    기본 줄(basic)은 누구나 가진 줄이라 rope가 비어 있으면 기본 줄이다.
-- 기능 목록에 bath, hlock, ropes를 더한다. 다시 실행해도 된다.

-- ---------- 상점 물건 목록과 값 (화장실 물건과 줄넘기를 더한다) ----------
alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'fw_volley', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'h_toilet', 'h_washbasin', 'h_bathtub', 'h_shower', 'h_laundry', 'h_towel', 'h_bathmat', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero', 'av_h_cloud', 'av_h_spacebuns', 'av_h_twintails', 'av_h_sidetail', 'av_h_wavy', 'av_h_princess', 'av_h_quiff', 'av_h_messy', 'av_h_dino', 'av_h_daenggi', 'av_h_sangtu', 'hs_hanok', 'hs_log', 'hs_mushroom', 'hs_castle', 'jr_sky', 'jr_lime', 'jr_grape', 'jr_candy', 'jr_beads', 'jr_rainbow', 'jr_glow', 'jr_star'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'fw_volley' then 7 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'pet_maltese' then 30 when 'pet_yorkie' then 30 when 'pet_poodle' then 30 when 'pet_pom' then 30 when 'pet_bichon' then 30 when 'pet_corgi' then 30 when 'pet_jindo' then 30 when 'pet_golden' then 30 when 'pet_dachs' then 30 when 'pet_beagle' then 30 when 'pet_cheese' then 30 when 'pet_mackerel' then 30 when 'pet_tuxedo' then 30 when 'pet_russian' then 30 when 'pet_persian' then 30 when 'pet_siamese' then 30 when 'pet_ragdoll' then 30 when 'pet_budgie' then 30 when 'pet_budblue' then 30 when 'pet_lovebird' then 30 when 'pet_tiel' then 30 when 'pet_macaw' then 30 when 'pet_grey' then 30 when 'pet_conure' then 30 when 'pet_cockatoo' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'h_bunk' then 10 when 'h_drawer' then 5 when 'h_dresser' then 6 when 'h_globe' then 3 when 'h_bigsofa' then 9 when 'h_coffee' then 4 when 'h_tv' then 7 when 'h_fishtank' then 8 when 'h_clock' then 6 when 'h_rocking' then 5 when 'h_beanbag' then 4 when 'h_bigrug' then 5 when 'h_tallplant' then 3 when 'h_fireplace' then 9 when 'h_dtable' then 8 when 'h_fridge' then 7 when 'h_sink' then 6 when 'h_cupboard' then 6 when 'h_oven' then 5 when 'h_toilet' then 5 when 'h_washbasin' then 5 when 'h_bathtub' then 9 when 'h_shower' then 7 when 'h_laundry' then 6 when 'h_towel' then 2 when 'h_bathmat' then 2 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 when 'av_h_cloud' then 6 when 'av_h_spacebuns' then 5 when 'av_h_twintails' then 5 when 'av_h_sidetail' then 4 when 'av_h_wavy' then 6 when 'av_h_princess' then 7 when 'av_h_quiff' then 4 when 'av_h_messy' then 3 when 'av_h_dino' then 5 when 'av_h_daenggi' then 5 when 'av_h_sangtu' then 4 when 'hs_hanok' then 15 when 'hs_log' then 15 when 'hs_mushroom' then 15 when 'hs_castle' then 15 when 'jr_sky' then 3 when 'jr_lime' then 3 when 'jr_grape' then 3 when 'jr_candy' then 5 when 'jr_beads' then 5 when 'jr_rainbow' then 6 when 'jr_glow' then 7 when 'jr_star' then 8 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 열매 상점: 값 목록에 새 물건을 더한다 (나머지는 그대로)
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
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('h_toilet', 5), ('h_washbasin', 5), ('h_bathtub', 9), ('h_shower', 7), ('h_laundry', 6), ('h_towel', 2), ('h_bathmat', 2), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4), ('hs_hanok', 15), ('hs_log', 15), ('hs_mushroom', 15), ('hs_castle', 15), ('jr_sky', 3), ('jr_lime', 3), ('jr_grape', 3), ('jr_candy', 5), ('jr_beads', 5), ('jr_rainbow', 6), ('jr_glow', 7), ('jr_star', 8)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('fw_volley', 7), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('h_bunk', 10), ('h_drawer', 5), ('h_dresser', 6), ('h_globe', 3), ('h_bigsofa', 9), ('h_coffee', 4), ('h_tv', 7), ('h_fishtank', 8), ('h_clock', 6), ('h_rocking', 5), ('h_beanbag', 4), ('h_bigrug', 5), ('h_tallplant', 3), ('h_fireplace', 9), ('h_dtable', 8), ('h_fridge', 7), ('h_sink', 6), ('h_cupboard', 6), ('h_oven', 5), ('h_toilet', 5), ('h_washbasin', 5), ('h_bathtub', 9), ('h_shower', 7), ('h_laundry', 6), ('h_towel', 2), ('h_bathmat', 2), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4), ('hs_hanok', 15), ('hs_log', 15), ('hs_mushroom', 15), ('hs_castle', 15), ('jr_sky', 3), ('jr_lime', 3), ('jr_grape', 3), ('jr_candy', 5), ('jr_beads', 5), ('jr_rainbow', 6), ('jr_glow', 7), ('jr_star', 8)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

-- 사기: 줄넘기(jr_)도 애완동물, 꾸미기, 집 모양처럼 한 가지는 한 번만 산다 (나머지는 그대로)
create or replace function public.kids_shop_buy(p_token text, p_item text, p_n integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__sale_price(p_item); v_n int := coalesce(p_n, 1); v_have int;
        v_one boolean := left(coalesce(p_item, ''), 4) = 'pet_' or left(coalesce(p_item, ''), 3) in ('av_', 'hs_', 'jr_');
begin
  if v_one then v_n := 1; end if;
  if v_price is null or v_n < 1 or v_n > 5 then raise exception 'BAD_ITEM'; end if;
  select coalesce((select count from public.kids_items where child_id = v_id and item = p_item), 0) into v_have;
  if left(p_item, 4) = 'pet_' and v_have >= 1 then raise exception 'HAVE_PET'; end if;
  if left(p_item, 3) = 'av_' and v_have >= 1 then raise exception 'HAVE_ITEM'; end if;
  if left(p_item, 3) = 'hs_' and v_have >= 1 then raise exception 'HAVE_HOUSE'; end if;
  if left(p_item, 3) = 'jr_' and v_have >= 1 then raise exception 'HAVE_ROPE'; end if;
  if v_have + v_n > 99 then raise exception 'BAG_FULL'; end if;
  update public.kids_children set fruits = fruits - v_price * v_n where id = v_id and fruits >= v_price * v_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  insert into public.kids_items (child_id, item, count) values (v_id, p_item, v_n)
    on conflict (child_id, item) do update set count = public.kids_items.count + excluded.count;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;

-- ---------- 1) 화장실 ----------
create or replace function public.kids__home_items(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(item, count), '{}'::jsonb) from public.kids_items
   where child_id = p_child and count > 0 and item in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'h_toilet', 'h_washbasin', 'h_bathtub', 'h_shower', 'h_laundry', 'h_towel', 'h_bathmat', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
$$;
revoke all on function public.kids__home_items(uuid) from public, anon, authenticated;

-- 집 저장: 화장실 물건을 받는다 (나머지는 그대로)
create or replace function public.kids_home_save(p_token text, p_layout jsonb, p_harvest jsonb default '[]'::jsonb, p_plan int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_old jsonb; e jsonb; o jsonb; v_new jsonb := '[]'::jsonb; v_now bigint := public.kids__now_ms();
begin
  if p_plan is null or p_plan < 2 then raise exception 'OLD_APP'; end if;
  if p_layout is null or jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 150 or length(p_layout::text) > 40000 then
    raise exception 'BAD_HOME';
  end if;
  for e in select * from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string' or length(e->>'id') > 24
       or (e->>'k') is null or (e->>'k') not in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'h_toilet', 'h_washbasin', 'h_bathtub', 'h_shower', 'h_laundry', 'h_towel', 'h_bathmat', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
       or jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'z') <> 'number'
       or (e->>'x')::numeric not between -44 and 12 or (e->>'z')::numeric not between -17 and 12
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

-- 공사비 (할인 전): 화장실 15
create or replace function public.kids__build_price(p_space text)
returns int language sql immutable set search_path = '' as $$
  select case p_space when 'living' then 20 when 'kitchen' then 20 when 'room2' then 15 when 'room3' then 15 when 'bath' then 15 else null end
$$;
revoke all on function public.kids__build_price(text) from public, anon, authenticated;

-- 집 넓히기 공사: 방을 다섯까지 (나머지는 그대로)
create or replace function public.kids_home_build(p_token text, p_space text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_base int := public.kids__build_price(p_space); v_price int; v_rooms jsonb; v_fruits int;
begin
  if v_base is null then raise exception 'BAD_SPACE'; end if;
  v_price := greatest(1, floor(v_base * (100 - public.kids__sale()) / 100.0)::int);
  insert into public.kids_homes (child_id) values (v_id) on conflict (child_id) do nothing;
  select rooms into v_rooms from public.kids_homes where child_id = v_id for update;
  v_rooms := coalesce(v_rooms, '[]'::jsonb);
  if v_rooms ? p_space or jsonb_array_length(v_rooms) >= 5 then raise exception 'BUILT'; end if;
  update public.kids_children set fruits = fruits - v_price where id = v_id and fruits >= v_price returning fruits into v_fruits;
  if not found then raise exception 'NO_FRUIT'; end if;
  v_rooms := v_rooms || to_jsonb(p_space);
  update public.kids_homes set rooms = v_rooms, updated_at = now() where child_id = v_id;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, 'home_' || p_space, 1, v_price);
  return jsonb_build_object('rooms', v_rooms, 'fruits', v_fruits, 'price', v_price);
end $$;

-- ---------- 2) 집 잠그기 ----------
alter table public.kids_homes add column if not exists locked boolean not null default false;
alter table public.kids_homes add column if not exists here_at timestamptz;

-- 그 집에 지금 들어갈 수 있는지: 잠그지 않았거나, 주인이 2분 30초 안에 '마을에 있다'고 알렸으면
create or replace function public.kids__home_open(p_child uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select not h.locked or coalesce(h.here_at > now() - interval '150 seconds', false)
                     from public.kids_homes h where h.child_id = p_child), true)
$$;
revoke all on function public.kids__home_open(uuid) from public, anon, authenticated;

-- 마을에 있다고 알리기 (앱이 1분마다). 20초 안에 다시 오면 적지 않는다. 돌려주는 것: 내 집을 잠가 두었는지
create or replace function public.kids_here(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_locked boolean;
begin
  insert into public.kids_homes as h (child_id, here_at) values (v_id, now())
    on conflict (child_id) do update set here_at = now()
    where h.here_at is null or h.here_at < now() - interval '20 seconds';
  select locked into v_locked from public.kids_homes where child_id = v_id;
  return jsonb_build_object('locked', coalesce(v_locked, false));
end $$;
revoke all on function public.kids_here(text) from public;
grant execute on function public.kids_here(text) to anon, authenticated;

-- 우리 집 문: p_locked가 true면 '비울 때 잠그기', false면 '늘 열어 두기'
create or replace function public.kids_home_lock(p_token text, p_locked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_locked is null then raise exception 'BAD_LOCK'; end if;
  insert into public.kids_homes as h (child_id, locked, here_at) values (v_id, p_locked, now())
    on conflict (child_id) do update set locked = excluded.locked, here_at = now();
  return jsonb_build_object('locked', p_locked);
end $$;
revoke all on function public.kids_home_lock(text, boolean) from public;
grant execute on function public.kids_home_lock(text, boolean) to anon, authenticated;

-- 내 집 정보: 잠가 두었는지(locked)와 화장실 공사비를 더한다 (나머지는 그대로)
create or replace function public.kids_home(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale(); h record;
begin
  select layout, rooms, style, look, locked into h from public.kids_homes where child_id = v_id;
  return jsonb_build_object(
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'look', coalesce(h.look, '{}'::jsonb),
    'locked', coalesce(h.locked, false),
    'houses', public.kids__houses(v_id),
    'items', public.kids__home_items(v_id),
    'fruits', (select fruits from public.kids_children where id = v_id),
    'crops', public.kids__crops(v_id),
    'sale', v_sale,
    'build', (select jsonb_object_agg(s, greatest(1, floor(public.kids__build_price(s) * (100 - v_sale) / 100.0)::int)) from unnest(array['living', 'kitchen', 'room2', 'room3', 'bath']) s),
    'build_base', (select jsonb_object_agg(s, public.kids__build_price(s)) from unnest(array['living', 'kitchen', 'room2', 'room3', 'bath']) s),
    'now', public.kids__now_ms());
end $$;

-- 친구 집 구경: 잠가 둔 집은 주인이 마을에 있을 때만. 잠가 두었는지(locked)를 함께 준다 (안에 있던 친구는 주인이 나가면 마을로)
create or replace function public.kids_home_visit(p_token text, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text; v_avatar jsonb; h record;
begin
  select village_name, avatar into v_name, v_avatar from public.kids_children
   where id = p_child and village_name is not null and avatar is not null;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  if p_child <> v_id and not public.kids__home_open(p_child) then raise exception 'HOME_LOCKED'; end if;
  select layout, rooms, style, look, locked into h from public.kids_homes where child_id = p_child;
  return jsonb_build_object('name', v_name, 'avatar', v_avatar,
    'layout', coalesce(h.layout, '[]'::jsonb),
    'rooms', coalesce(h.rooms, '[]'::jsonb),
    'style', coalesce(h.style, '{}'::jsonb),
    'look', coalesce(h.look, '{}'::jsonb),
    'locked', coalesce(h.locked, false),
    'now', public.kids__now_ms());
end $$;

-- 이웃 마을 집 목록: 지금 문이 잠겨 있는지(locked: 잠가 두었고 주인이 마을에 없음)를 더한다 (나머지는 그대로)
create or replace function public.kids_neighbors(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'houses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar,
               'look', coalesce(h.look, '{}'::jsonb), 't', c.teacher_id is not null,
               'locked', coalesce(h.locked, false) and not coalesce(h.here_at > now() - interval '150 seconds', false)) order by c.created_at, c.id)
        from public.kids_children c left join public.kids_homes h on h.child_id = c.id
       where c.village_name is not null and c.avatar is not null), '[]'::jsonb),
    'unseen', (select count(*) from public.kids_home_notes where host_id = v_id and not seen));
end $$;

-- 나가기: 아이가 나가면 바로 '마을에 없음'으로 (잠가 둔 집은 바로 잠긴다)
create or replace function public.kids_logout(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  delete from public.kids_sessions where token_hash = public.kids__hash(p_token) returning kind, subject_id into s;
  if s.kind = 'child' then update public.kids_homes set here_at = null where child_id = s.subject_id; end if;
end $$;

-- ---------- 3) 줄넘기 ----------
alter table public.kids_children add column if not exists rope text;
alter table public.kids_children drop constraint if exists kids_children_rope_check;
alter table public.kids_children add constraint kids_children_rope_check check (rope is null or rope in ('jr_sky', 'jr_lime', 'jr_grape', 'jr_candy', 'jr_beads', 'jr_rainbow', 'jr_glow', 'jr_star'));

-- 줄 고르기: 'basic'(기본 줄)이나 산 줄
create or replace function public.kids_jr_rope(p_token text, p_rope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_rope is null or (p_rope <> 'basic' and p_rope not in ('jr_sky', 'jr_lime', 'jr_grape', 'jr_candy', 'jr_beads', 'jr_rainbow', 'jr_glow', 'jr_star')) then raise exception 'BAD_ITEM'; end if;
  if p_rope <> 'basic' and not exists (select 1 from public.kids_items where child_id = v_id and item = p_rope and count > 0) then raise exception 'NO_ROPE'; end if;
  update public.kids_children set rope = nullif(p_rope, 'basic') where id = v_id;
  return jsonb_build_object('rope', p_rope);
end $$;
revoke all on function public.kids_jr_rope(text, text) from public;
grant execute on function public.kids_jr_rope(text, text) to anon, authenticated;

-- 내 정보: 고른 줄(rope)을 더한다 (나머지는 그대로)
create or replace function public.kids_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); c public.kids_children;
begin
  update public.kids_children set last_seen_at = now() where id = v_id returning * into c;
  return jsonb_build_object(
    'id', c.id, 'login_id', c.login_id, 'name', c.real_name,
    'village_name', c.village_name, 'avatar', c.avatar, 'fruits', c.fruits, 'pet', c.pet,
    'pets', public.kids__pets_json(c.pets, c.pet_names),
    'teacher', c.teacher_id is not null,
    'is_birthday', c.teacher_id is null and public.kids__is_birthday(c.birthdate),
    'rope', coalesce(c.rope, 'basic'));
end $$;

-- ---------- 기능 목록: bath(화장실), hlock(집 잠그기), ropes(여러 가지 줄넘기)를 더한다 ----------
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true)
$$;
