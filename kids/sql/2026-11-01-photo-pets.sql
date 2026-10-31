-- 진숲 어린이 마을: 필사 공책 사진 열매 10개, 열매 상점 애완동물
-- 다시 실행해도 된다.

-- ---------- 필사 공책 사진: 한 주에 한 번 열매 10개 ----------
-- 처음 마치면서 사진을 올리면 10개, 따라 쓰기·공책 체크로 2개를 이미 받았으면 8개를 더 준다.
alter table public.kids_copy_entries add column if not exists photo_paid boolean not null default false;

create or replace function public.kids_copy_photo(p_token text, p_week date, p_photo text, p_thumb text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_photo bytea; v_thumb bytea; e public.kids_copy_entries;
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  v_photo := public.kids__image(p_photo, 450000);
  v_thumb := public.kids__image(p_thumb, 40000);
  if v_photo is null or v_thumb is null then raise exception 'BAD_IMAGE'; end if;
  select * into e from public.kids_copy_entries where child_id = v_id and week_start = p_week;
  if e.child_id is null then v_gain := 10;
  elsif not e.photo_paid then v_gain := 8;
  end if;
  insert into public.kids_copy_entries as x (child_id, week_start, note, shared, photo, photo_thumb, photo_ok, photo_at, photo_paid)
  values (v_id, p_week, '', true, v_photo, v_thumb, false, now(), true)
  on conflict (child_id, week_start) do update
    set photo = excluded.photo, photo_thumb = excluded.photo_thumb, photo_ok = false, photo_at = now(), photo_paid = true, updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

-- 필사 한 주 보기: 사진 열매를 이미 받았는지(photo_paid)도 알려 준다
create or replace function public.kids_copy_week(p_token text, p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        w public.kids_weeks; e public.kids_copy_entries;
begin
  select * into w from public.kids_weeks
   where is_published and copy_ref <> '' and week_start <= public.kids__week_of(least(coalesce(p_week, v_today), v_today))
   order by week_start desc limit 1;
  if not found then
    return jsonb_build_object('week', null, 'next_start', (select min(week_start) from public.kids_weeks where is_published and copy_ref <> ''));
  end if;
  select * into e from public.kids_copy_entries where child_id = v_id and week_start = w.week_start;
  return jsonb_build_object(
    'week', jsonb_build_object('week_start', w.week_start, 'theme', w.theme, 'ref', w.copy_ref, 'intro', w.copy_intro,
              'passage', w.copy_passage, 'is_current', w.week_start = public.kids__week_of(v_today)),
    'prev', (select max(week_start) from public.kids_weeks where is_published and copy_ref <> '' and week_start < w.week_start),
    'next', (select min(week_start) from public.kids_weeks where is_published and copy_ref <> '' and week_start > w.week_start and week_start <= v_today),
    'mine', case when e.child_id is null then null else jsonb_build_object('note', e.note, 'shared', e.shared, 'hidden', e.hidden,
              'has_photo', e.photo is not null, 'photo_ok', e.photo_ok, 'photo_paid', e.photo_paid, 'thumb', public.kids__b64(e.photo_thumb)) end,
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'at', x.created_at,
        'text', case when c.id = v_id or (x.shared and not x.hidden) then nullif(x.note, '') else null end,
        'private', not x.shared, 'hidden', x.hidden,
        'has_photo', x.photo is not null,
        'photo_wait', c.id = v_id and x.photo is not null and not x.photo_ok,
        'thumb', case when x.photo is not null and (c.id = v_id or (x.photo_ok and x.shared and not x.hidden))
                      then public.kids__b64(x.photo_thumb) else null end,
        'reactions', public.kids__reactions('copy', w.week_start::text, c.id, v_id)) order by x.created_at)
      from public.kids_copy_entries x join public.kids_children c on c.id = x.child_id
      where x.week_start = w.week_start and c.village_name is not null), '[]'::jsonb));
end $$;

-- ---------- 열매 상점: 애완동물 (한 마리씩 열매 30개, 한 번 데려오면 계속 우리 집 친구) ----------
alter table public.kids_children add column if not exists pet text;
alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check
  check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5
                     when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

create or replace function public.kids_shop(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'fruits', (select fruits from public.kids_children where id = v_id),
    'pet', (select pet from public.kids_children where id = v_id),
    'items', coalesce((select jsonb_object_agg(item, count) from public.kids_items where child_id = v_id and count > 0), '{}'::jsonb),
    'prices', jsonb_build_object('fw_spark', 1, 'fw_flower', 3, 'fw_heart', 5, 'pet_dog', 30, 'pet_cat', 30, 'pet_rabbit', 30, 'pet_chick', 30));
end $$;

create or replace function public.kids_shop_buy(p_token text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__item_price(p_item); v_n int := coalesce(p_n, 1); v_have int;
        v_pet boolean := left(coalesce(p_item, ''), 4) = 'pet_';
begin
  if v_pet then v_n := 1; end if;
  if v_price is null or v_n < 1 or v_n > 5 then raise exception 'BAD_ITEM'; end if;
  select coalesce((select count from public.kids_items where child_id = v_id and item = p_item), 0) into v_have;
  if v_pet and v_have >= 1 then raise exception 'HAVE_PET'; end if;
  if v_have + v_n > 99 then raise exception 'BAG_FULL'; end if;
  update public.kids_children set fruits = fruits - v_price * v_n where id = v_id and fruits >= v_price * v_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  insert into public.kids_items (child_id, item, count) values (v_id, p_item, v_n)
    on conflict (child_id, item) do update set count = public.kids_items.count + excluded.count;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;

-- 불꽃만 터트릴 수 있다 (애완동물은 쓰는 물건이 아니다)
create or replace function public.kids_item_use(p_token text, p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_left int;
begin
  if left(coalesce(p_item, ''), 3) <> 'fw_' then raise exception 'BAD_ITEM'; end if;
  if exists (select 1 from public.kids_items where child_id = v_id and used_at > now() - interval '2 seconds') then raise exception 'TOO_FAST'; end if;
  update public.kids_items set count = count - 1, used_at = now() where child_id = v_id and item = p_item and count > 0 returning count into v_left;
  if not found then raise exception 'NO_ITEM'; end if;
  return jsonb_build_object('item', p_item, 'left', v_left);
end $$;

-- 데리고 다닐 애완동물 고르기 (null이면 집에서 쉰다). 데려온 애완동물만 고를 수 있다.
create or replace function public.kids_pet_set(p_token text, p_pet text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_pet is not null and not exists (select 1 from public.kids_items
      where child_id = v_id and item = p_pet and count > 0 and left(item, 4) = 'pet_') then
    raise exception 'NO_PET';
  end if;
  update public.kids_children set pet = p_pet where id = v_id;
  return jsonb_build_object('pet', p_pet);
end $$;
grant execute on function public.kids_pet_set(text, text) to anon, authenticated;

-- 나와 마을 사람들: 데리고 다니는 애완동물도 함께
create or replace function public.kids_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); c public.kids_children;
begin
  update public.kids_children set last_seen_at = now() where id = v_id returning * into c;
  return jsonb_build_object(
    'id', c.id, 'login_id', c.login_id, 'name', c.real_name,
    'village_name', c.village_name, 'avatar', c.avatar, 'fruits', c.fruits, 'pet', c.pet,
    'is_birthday', public.kids__is_birthday(c.birthdate));
end $$;

create or replace function public.kids_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'room', (select value from public.kids_config where key = 'realtime_room'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'pet', c.pet))
      from public.kids_children c where c.village_name is not null and c.avatar is not null), '[]'::jsonb));
end $$;

-- 화면이 서버에 어떤 기능이 있는지 묻는다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true)
$$;
