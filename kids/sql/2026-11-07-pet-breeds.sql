-- 진숲 어린이 마을: 애완동물 품종 (강아지 10, 고양이 7, 앵무새 8)
-- 품종 25가지를 애완동물 물건(pet_…)으로 더한다. 값은 처음 동물과 같이 열매 30개이고, 팔면 반(15개)을 받는다.
-- 데려오기, 데리고 다니기(세 마리까지), 이름 짓기, 팔기, 선물하기는 처음 동물과 똑같다.
-- 다시 실행해도 된다. 이름과 값은 js/pets-data.js와 같다.
--   pet_maltese 말티즈
--   pet_yorkie 요크셔테리어
--   pet_poodle 푸들
--   pet_pom 포메라니안
--   pet_bichon 비숑 프리제
--   pet_corgi 웰시코기
--   pet_jindo 진돗개
--   pet_golden 골든 리트리버
--   pet_dachs 닥스훈트
--   pet_beagle 비글
--   pet_cheese 치즈 태비
--   pet_mackerel 고등어 태비
--   pet_tuxedo 턱시도 고양이
--   pet_russian 러시안 블루
--   pet_persian 페르시안
--   pet_siamese 샴
--   pet_ragdoll 랙돌
--   pet_budgie 사랑앵무 (초록)
--   pet_budblue 사랑앵무 (파랑)
--   pet_lovebird 모란앵무
--   pet_tiel 왕관앵무
--   pet_macaw 홍금강앵무
--   pet_grey 회색앵무
--   pet_conure 썬코뉴어
--   pet_cockatoo 큰유황앵무

alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero', 'av_h_cloud', 'av_h_spacebuns', 'av_h_twintails', 'av_h_sidetail', 'av_h_wavy', 'av_h_princess', 'av_h_quiff', 'av_h_messy', 'av_h_dino', 'av_h_daenggi', 'av_h_sangtu'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'pet_parrot' then 30 when 'pet_maltese' then 30 when 'pet_yorkie' then 30 when 'pet_poodle' then 30 when 'pet_pom' then 30 when 'pet_bichon' then 30 when 'pet_corgi' then 30 when 'pet_jindo' then 30 when 'pet_golden' then 30 when 'pet_dachs' then 30 when 'pet_beagle' then 30 when 'pet_cheese' then 30 when 'pet_mackerel' then 30 when 'pet_tuxedo' then 30 when 'pet_russian' then 30 when 'pet_persian' then 30 when 'pet_siamese' then 30 when 'pet_ragdoll' then 30 when 'pet_budgie' then 30 when 'pet_budblue' then 30 when 'pet_lovebird' then 30 when 'pet_tiel' then 30 when 'pet_macaw' then 30 when 'pet_grey' then 30 when 'pet_conure' then 30 when 'pet_cockatoo' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 when 'av_h_cloud' then 6 when 'av_h_spacebuns' then 5 when 'av_h_twintails' then 5 when 'av_h_sidetail' then 4 when 'av_h_wavy' then 6 when 'av_h_princess' then 7 when 'av_h_quiff' then 4 when 'av_h_messy' then 3 when 'av_h_dino' then 5 when 'av_h_daenggi' then 5 when 'av_h_sangtu' then 4 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 열매 상점: 값 목록에 품종 동물을 더한다 (나머지는 그대로)
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
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('pet_maltese', 30), ('pet_yorkie', 30), ('pet_poodle', 30), ('pet_pom', 30), ('pet_bichon', 30), ('pet_corgi', 30), ('pet_jindo', 30), ('pet_golden', 30), ('pet_dachs', 30), ('pet_beagle', 30), ('pet_cheese', 30), ('pet_mackerel', 30), ('pet_tuxedo', 30), ('pet_russian', 30), ('pet_persian', 30), ('pet_siamese', 30), ('pet_ragdoll', 30), ('pet_budgie', 30), ('pet_budblue', 30), ('pet_lovebird', 30), ('pet_tiel', 30), ('pet_macaw', 30), ('pet_grey', 30), ('pet_conure', 30), ('pet_cockatoo', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8), ('av_h_cloud', 6), ('av_h_spacebuns', 5), ('av_h_twintails', 5), ('av_h_sidetail', 4), ('av_h_wavy', 6), ('av_h_princess', 7), ('av_h_quiff', 4), ('av_h_messy', 3), ('av_h_dino', 5), ('av_h_daenggi', 5), ('av_h_sangtu', 4)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

-- 선물: 받을 수 있는 동물에 품종을 더한다
alter table public.kids_gifts drop constraint if exists kids_gifts_item_check;
alter table public.kids_gifts add constraint kids_gifts_item_check check (item is null or item in ('pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo'));

create or replace function public.kids_pet_gift(p_token text, p_to uuid, p_pet text, p_msg text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text;
begin
  if p_to is null or p_to = v_id or not exists (select 1 from public.kids_children where id = p_to and village_name is not null) then raise exception 'NOT_FOUND'; end if;
  if coalesce(p_msg, '') not in ('thanks', 'bday', 'cheer', 'play', 'bless', 'best')
     or coalesce(p_pet, '') not in ('pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot', 'pet_maltese', 'pet_yorkie', 'pet_poodle', 'pet_pom', 'pet_bichon', 'pet_corgi', 'pet_jindo', 'pet_golden', 'pet_dachs', 'pet_beagle', 'pet_cheese', 'pet_mackerel', 'pet_tuxedo', 'pet_russian', 'pet_persian', 'pet_siamese', 'pet_ragdoll', 'pet_budgie', 'pet_budblue', 'pet_lovebird', 'pet_tiel', 'pet_macaw', 'pet_grey', 'pet_conure', 'pet_cockatoo') then raise exception 'BAD_GIFT'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_gift:' || v_id::text));
  perform 1 from public.kids_children where id in (v_id, p_to) order by id for update;
  if exists (select 1 from public.kids_gifts where from_child = v_id and created_at > now() - interval '3 seconds') then raise exception 'TOO_FAST'; end if;
  if public.kids__pet_gift_left(v_id) < 1 then raise exception 'PET_GIFT_DAY'; end if;
  if not exists (select 1 from public.kids_items where child_id = v_id and item = p_pet and count > 0) then raise exception 'NO_PET'; end if;
  if exists (select 1 from public.kids_items where child_id = p_to and item = p_pet and count > 0) then raise exception 'HAVE_PET_TO'; end if;
  select pet_names ->> p_pet into v_name from public.kids_children where id = v_id;
  delete from public.kids_items where child_id = v_id and item = p_pet;
  update public.kids_children set pets = array_remove(pets, p_pet), pet = (array_remove(pets, p_pet))[1], pet_names = pet_names - p_pet
   where id = v_id;
  insert into public.kids_items (child_id, item, count) values (p_to, p_pet, 1)
    on conflict (child_id, item) do update set count = 1;
  update public.kids_children set
         pet_names = case when v_name is null then pet_names - p_pet else jsonb_set(pet_names, array[p_pet], to_jsonb(v_name)) end,
         pets = case when cardinality(pets) < 3 and not (p_pet = any(pets)) then pets || p_pet else pets end,
         pet = coalesce(pet, p_pet)
   where id = p_to;
  insert into public.kids_gifts (from_child, to_child, n, msg, item) values (v_id, p_to, 0, p_msg, p_pet);
  return public.kids_shop(p_token) || jsonb_build_object('pet_gift_left', public.kids__pet_gift_left(v_id));
end $$;
revoke all on function public.kids_pet_gift(text, uuid, text, text) from public;
grant execute on function public.kids_pet_gift(text, uuid, text, text) to anon, authenticated;

-- 기능 목록: breeds(애완동물 품종)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true)
$$;
