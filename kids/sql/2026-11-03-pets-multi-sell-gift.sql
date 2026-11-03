-- 진숲 어린이 마을: 애완동물 세 마리까지 데리고 다니기, 가게에 다시 팔기(반값), 친구에게 선물하기
-- 다시 실행해도 된다.
-- 데리고 다니는 동물은 kids_children.pets(순서 있는 목록, 0~3마리)에 적는다. 예전 칸 pet에는 목록의 첫 동물을 같이 적어서
-- 예전 화면도 한 마리는 보이게 둔다. 원래 데리고 다니던 한 마리는 그대로 목록의 첫 동물이 된다.
-- 팔기: 가진 동물 한 마리를 정가(30)의 반인 열매 15개에 판다. 세일은 50%까지만 되므로 사서 바로 팔아도 열매가 늘지 않는다.
--   하루 팔기 한도(물고기·곤충·보물·채소)에는 넣지 않는다. 판 동물의 이름도 같이 지운다.
-- 선물: 가진 동물을 마을 이름을 정한 친구에게 보낸다. 친구가 같은 동물을 이미 가졌으면 보낼 수 없다.
--   지어 준 이름도 같이 간다. 친구가 데리고 다니는 동물이 세 마리보다 적으면 바로 친구를 따라다닌다.
--   한 사람이 하루에 세 마리까지 보낼 수 있고, 선물 기록(kids_gifts)에 n = 0, item = 동물로 남는다(열매 선물 한도와 따로).
-- 함께 고치는 것: kids_sell_log의 종류 검사에 'crop'이 빠져 있어서 채소 팔기가 실패하던 것을 고친다('pet'도 넣는다).

alter table public.kids_children add column if not exists pets text[] not null default '{}';
update public.kids_children set pets = array[pet] where pet is not null and pets = '{}';
alter table public.kids_children drop constraint if exists kids_children_pets_check;
alter table public.kids_children add constraint kids_children_pets_check check (cardinality(pets) <= 3);

alter table public.kids_sell_log drop constraint if exists kids_sell_log_kind_check;
alter table public.kids_sell_log add constraint kids_sell_log_kind_check check (kind in ('fish', 'bug', 'treasure', 'crop', 'pet'));

alter table public.kids_gifts add column if not exists item text;
alter table public.kids_gifts drop constraint if exists kids_gifts_n_check;
alter table public.kids_gifts add constraint kids_gifts_n_check check ((item is null and n between 1 and 10) or (item is not null and n = 0));
alter table public.kids_gifts drop constraint if exists kids_gifts_item_check;
alter table public.kids_gifts add constraint kids_gifts_item_check check (item is null or item in ('pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot'));

-- 데리고 다니는 동물 목록 [{item, name}]
create or replace function public.kids__pets_json(p_pets text[], p_names jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', x.item, 'name', p_names ->> x.item) order by x.i), '[]'::jsonb)
    from unnest(p_pets) with ordinality x(item, i)
$$;
revoke all on function public.kids__pets_json(text[], jsonb) from public, anon, authenticated;

-- 데리고 다닐 동물 정하기 (0~3마리, 순서대로 내 왼쪽 뒤, 오른쪽 뒤, 가운데 뒤)
create or replace function public.kids_pets_set(p_token text, p_pets text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_pets text[] := coalesce(p_pets, '{}'); c public.kids_children;
begin
  if cardinality(v_pets) > 3 or array_position(v_pets, null) is not null
     or cardinality(v_pets) <> (select count(distinct x) from unnest(v_pets) x) then
    raise exception 'BAD_PETS';
  end if;
  if exists (select 1 from unnest(v_pets) x where left(x, 4) <> 'pet_' or not exists (select 1 from public.kids_items
      where child_id = v_id and item = x and count > 0)) then
    raise exception 'NO_PET';
  end if;
  update public.kids_children set pets = v_pets, pet = v_pets[1] where id = v_id returning * into c;
  return jsonb_build_object('pet', c.pet, 'pets', public.kids__pets_json(c.pets, c.pet_names));
end $$;
revoke all on function public.kids_pets_set(text, text[]) from public;
grant execute on function public.kids_pets_set(text, text[]) to anon, authenticated;

-- 예전 화면용: 한 마리만 데리고 다니기 (null이면 모두 집에서 쉬기)
create or replace function public.kids_pet_set(p_token text, p_pet text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_pet is not null and not exists (select 1 from public.kids_items
      where child_id = v_id and item = p_pet and count > 0 and left(item, 4) = 'pet_') then
    raise exception 'NO_PET';
  end if;
  update public.kids_children set pet = p_pet, pets = case when p_pet is null then '{}'::text[] else array[p_pet] end where id = v_id;
  return jsonb_build_object('pet', p_pet);
end $$;

-- 가게에 다시 팔기: 열매 15개 (정가 30의 반)
create or replace function public.kids_pet_sell(p_token text, p_pet text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_got int := floor(coalesce(public.kids__item_price(p_pet), 0) / 2.0)::int;
begin
  if p_pet is null or left(p_pet, 4) <> 'pet_' or v_got < 1 then raise exception 'NO_PET'; end if;
  perform 1 from public.kids_children where id = v_id for update;
  delete from public.kids_items where child_id = v_id and item = p_pet and count > 0;
  if not found then raise exception 'NO_PET'; end if;
  update public.kids_children set pets = array_remove(pets, p_pet), pet = (array_remove(pets, p_pet))[1],
         pet_names = pet_names - p_pet, fruits = fruits + v_got
   where id = v_id;
  insert into public.kids_sell_log (child_id, kind, item, n, fruits) values (v_id, 'pet', p_pet, 1, v_got);
  return public.kids_shop(p_token) || jsonb_build_object('got', v_got);
end $$;
revoke all on function public.kids_pet_sell(text, text) from public;
grant execute on function public.kids_pet_sell(text, text) to anon, authenticated;

-- 오늘 동물을 선물한 수
create or replace function public.kids__pet_gift_left(p_child uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, 3 - (select count(*) from public.kids_gifts
    where from_child = p_child and item is not null and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'))::int
$$;
revoke all on function public.kids__pet_gift_left(uuid) from public, anon, authenticated;

-- 친구에게 동물 선물하기
create or replace function public.kids_pet_gift(p_token text, p_to uuid, p_pet text, p_msg text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text;
begin
  if p_to is null or p_to = v_id or not exists (select 1 from public.kids_children where id = p_to and village_name is not null) then raise exception 'NOT_FOUND'; end if;
  if coalesce(p_msg, '') not in ('thanks', 'bday', 'cheer', 'play', 'bless', 'best')
     or coalesce(p_pet, '') not in ('pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'pet_parrot') then raise exception 'BAD_GIFT'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_gift:' || v_id::text));
  -- 두 아이가 서로에게 동시에 보내도 막히지 않도록 늘 같은 순서로 잠근다
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

-- 아래는 원래 함수에 pets(데리고 다니는 동물 목록)와 동물 선물·팔기 칸을 더한 것

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
    'is_birthday', c.teacher_id is null and public.kids__is_birthday(c.birthdate));
end $$;

create or replace function public.kids_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'room', (select value from public.kids_config where key = 'realtime_room'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'pet', c.pet,
        'pet_name', case when c.pet is not null then c.pet_names ->> c.pet end,
        'pets', public.kids__pets_json(c.pets, c.pet_names),
        'teacher', c.teacher_id is not null))
      from public.kids_children c where c.village_name is not null and c.avatar is not null), '[]'::jsonb));
end $$;

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
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('pet_parrot', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'pet_gift_left', public.kids__pet_gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

create or replace function public.kids_gift_inbox(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_list jsonb;
begin
  with g as (update public.kids_gifts set seen_at = now() where to_child = v_id and seen_at is null returning from_child, n, msg, item, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('from', g.from_child, 'name', coalesce(c.village_name, '친구'), 'n', g.n, 'msg', g.msg,
      'item', g.item, 'at', g.created_at) order by g.created_at), '[]'::jsonb) into v_list
    from g left join public.kids_children c on c.id = g.from_child;
  return jsonb_build_object('gifts', v_list, 'fruits', (select fruits from public.kids_children where id = v_id));
end $$;

-- 하루 팔기 한도는 물고기·곤충·보물·채소만 센다 (동물 팔기는 빼고)
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
        where child_id = p_child and kind <> 'pet' and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0),
    'cap', public.kids__sell_day(),
    'pet', 15)
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
  select coalesce(sum(fruits), 0) into v_today from public.kids_sell_log where child_id = v_id and kind <> 'pet' and created_at >= v_start;
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

create or replace function public.kids_t_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'today', public.kids__today(),
    'chat_open', public.kids_chat_open(),
    'free_until', (select value from public.kids_config where key = 'play_free_until'),
    'play_free', public.kids__play_free(),
    'sale', public.kids__sale(),
    'sell_day', public.kids__sell_day(),
    'chat', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'to_name', t.real_name, 'to_village_name', t.village_name,
                 'body', m.body, 'masked', m.masked, 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_chat m join public.kids_children c on c.id = m.child_id
          left join public.kids_children t on t.id = m.to_child
         order by m.created_at desc limit 200) s), '[]'::jsonb),
    'muted', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.real_name, 'village_name', c.village_name))
        from public.kids_children c where c.chat_muted), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'child_name', c.real_name, 'village_name', c.village_name,
                 'hidden', d.hidden, 'at', d.created_at,
                 'eaten', (select count(*) from public.kids_dish_eats e where e.dish_id = d.id)) as x, d.created_at as at
          from public.kids_dishes d join public.kids_children c on c.id = d.child_id
         order by d.created_at desc limit 60) s), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'art_title', a.title, 'art_owner', o.village_name, 'body', m.body, 'masked', m.masked, 'hidden', m.hidden,
                 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_art_comments m join public.kids_children c on c.id = m.child_id
          join public.kids_art a on a.id = m.art_id join public.kids_children o on o.id = a.child_id
         order by m.created_at desc limit 100) s), '[]'::jsonb),
    'shop', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', l.id, 'name', c.real_name, 'village_name', c.village_name, 'item', l.item, 'n', l.n,
                 'price', l.price, 'fruits_left', c.fruits, 'at', l.created_at) as x, l.created_at as at
          from public.kids_shop_log l join public.kids_children c on c.id = l.child_id
         order by l.created_at desc limit 100) s), '[]'::jsonb),
    'sells', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', l.id, 'name', c.real_name, 'village_name', c.village_name, 'kind', l.kind, 'item', l.item, 'n', l.n,
                 'fruits', l.fruits, 'fruits_left', c.fruits, 'at', l.created_at) as x, l.created_at as at
          from public.kids_sell_log l join public.kids_children c on c.id = l.child_id
         order by l.created_at desc limit 100) s), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', g.id, 'name', a.real_name, 'village_name', a.village_name, 'to_name', b.real_name,
                 'to_village_name', b.village_name, 'n', g.n, 'msg', g.msg, 'item', g.item, 'at', g.created_at) as x, g.created_at as at
          from public.kids_gifts g join public.kids_children a on a.id = g.from_child join public.kids_children b on b.id = g.to_child
         order by g.created_at desc limit 100) s), '[]'::jsonb));
end $$;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true)
$$;
