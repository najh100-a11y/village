-- 진숲 어린이 마을: 열매 상점 머리 모양 (머리 칸)
-- 머리 모양 11가지를 꾸미기 물건(av_h_…)으로 판다. 한 번 사면 옷장의 머리 칸에서 언제든 바꾼다.
-- 산 아이만 그 머리 모양으로 저장할 수 있다(kids_save_avatar가 hair 칸도 확인한다).
-- 다시 실행해도 된다. 값과 이름은 js/wardrobe.js와 같다.

alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero', 'av_h_cloud', 'av_h_spacebuns', 'av_h_twintails', 'av_h_sidetail', 'av_h_wavy', 'av_h_princess', 'av_h_quiff', 'av_h_messy', 'av_h_dino', 'av_h_daenggi', 'av_h_sangtu'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 when 'av_h_cloud' then 6 when 'av_h_spacebuns' then 5 when 'av_h_twintails' then 5 when 'av_h_sidetail' then 4 when 'av_h_wavy' then 6 when 'av_h_princess' then 7 when 'av_h_quiff' then 4 when 'av_h_messy' then 3 when 'av_h_dino' then 5 when 'av_h_daenggi' then 5 when 'av_h_sangtu' then 4 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 아바타 칸과 값이 상점 물건이면 그 물건 이름 (누구나 고를 수 있는 것은 null)
create or replace function public.kids__wear_item(p_slot text, p_val text)
returns text language sql immutable set search_path = '' as $$
  select case p_slot || ':' || coalesce(p_val, '') when 'hat:halo' then 'av_halo' when 'hat:bunny' then 'av_bunny' when 'hat:catband' then 'av_catband' when 'hat:chef' then 'av_chef' when 'face:glasses' then 'av_glasses' when 'face:sunglasses' then 'av_sunglasses' when 'face:heart' then 'av_heart' when 'back:angel' then 'av_angel' when 'back:butterfly' then 'av_butterfly' when 'back:cape' then 'av_cape' when 'back:backpack' then 'av_backpack' when 'outfit:sailor' then 'av_sailor' when 'outfit:raincoat' then 'av_raincoat' when 'outfit:hero' then 'av_hero' when 'hair:cloud' then 'av_h_cloud' when 'hair:spacebuns' then 'av_h_spacebuns' when 'hair:twintails' then 'av_h_twintails' when 'hair:sidetail' then 'av_h_sidetail' when 'hair:wavy' then 'av_h_wavy' when 'hair:princess' then 'av_h_princess' when 'hair:quiff' then 'av_h_quiff' when 'hair:messy' then 'av_h_messy' when 'hair:dino' then 'av_h_dino' when 'hair:daenggi' then 'av_h_daenggi' when 'hair:sangtu' then 'av_h_sangtu' else null end
$$;
revoke all on function public.kids__wear_item(text, text) from public, anon, authenticated;

-- 옷장: 상점 꾸미기 물건(머리 모양 포함)은 산 아이만 한다
create or replace function public.kids_save_avatar(p_token text, p_avatar jsonb, p_village_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text := btrim(coalesce(p_village_name, '')); v_slot text; v_item text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 10 then raise exception 'BAD_NAME'; end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 4000 then
    raise exception 'BAD_AVATAR';
  end if;
  foreach v_slot in array array['hat', 'face', 'back', 'outfit', 'hair'] loop
    v_item := public.kids__wear_item(v_slot, p_avatar->>v_slot);
    if v_item is not null and not exists (select 1 from public.kids_items where child_id = v_id and item = v_item and count > 0) then
      raise exception 'NEED_ITEM';
    end if;
  end loop;
  update public.kids_children set avatar = p_avatar, village_name = v_name where id = v_id;
  return public.kids_me(p_token);
end $$;

-- 열매 상점: 값 목록에 머리 모양을 더한다 (나머지는 그대로)
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
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

-- 기능 목록: hair(열매 상점 머리 칸)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true)
$$;
