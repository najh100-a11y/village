-- 진숲 어린이 마을 — 애완동물 집
-- 1) 집 꾸미기 물건 여섯 가지를 상점에 더한다 (js/homeitems.js와 같다):
--    집 안: 캣타워 h_cattower(8), 새장 h_birdcage(6), 동물 쿠션 h_petbed(4) / 마당: 강아지 집 y_doghouse(8), 토끼장 y_hutch(6), 병아리 둥지 y_nest(4)
--    물건 목록이 들어 있는 곳(kids_items 검사, kids__item_price, kids_shop의 값 목록 두 곳, kids__home_items, kids_home_save)은
--    지금 서버에 있는 정의를 읽어서 '발 매트(h_bathmat)' 바로 뒤에 새 물건을 끼워 넣는다. 끼울 자리를 못 찾으면 멈춘다.
-- 2) 집에서 쉬는 동물: 가진 동물 가운데 데리고 다니지 않는 동물(kids__rest_pets)을 내 집(kids_home)과 친구 집 놀러 가기(kids_home_visit)에 'rest_pets'로 준다.
--    화면이 그 동물을 맞는 애완동물 집에 놓는다(서버는 목록만 준다).
-- 3) 기능 목록에 pethouse를 더한다. 다시 실행해도 된다.

do $patch$
declare d text; n int;
  v_new_txt constant text := '''h_bathmat''::text, ''h_cattower''::text, ''h_birdcage''::text, ''h_petbed''::text, ''y_doghouse''::text, ''y_hutch''::text, ''y_nest''::text';
  v_new_list constant text := '''h_bathmat'', ''h_cattower'', ''h_birdcage'', ''h_petbed'', ''y_doghouse'', ''y_hutch'', ''y_nest'', ';
  v_new_price constant text := 'when ''h_bathmat'' then 2 when ''h_cattower'' then 8 when ''h_birdcage'' then 6 when ''h_petbed'' then 4 when ''y_doghouse'' then 8 when ''y_hutch'' then 6 when ''y_nest'' then 4';
  v_new_pair constant text := '(''h_bathmat'', 2), (''h_cattower'', 8), (''h_birdcage'', 6), (''h_petbed'', 4), (''y_doghouse'', 8), (''y_hutch'', 6), (''y_nest'', 4)';
begin
  -- 가진 물건 표의 물건 이름 검사
  select pg_get_constraintdef(oid) into d from pg_constraint where conname = 'kids_items_item_check' and conrelid = 'public.kids_items'::regclass;
  if position('h_cattower' in d) = 0 then
    n := (length(d) - length(replace(d, '''h_bathmat''::text', ''))) / length('''h_bathmat''::text');
    if n <> 1 then raise exception 'PATCH kids_items_item_check %', n; end if;
    d := replace(d, '''h_bathmat''::text', v_new_txt);
    execute 'alter table public.kids_items drop constraint kids_items_item_check';
    execute 'alter table public.kids_items add constraint kids_items_item_check ' || d;
  end if;
  -- 값
  d := pg_get_functiondef('public.kids__item_price(text)'::regprocedure);
  if position('h_cattower' in d) = 0 then
    n := (length(d) - length(replace(d, 'when ''h_bathmat'' then 2', ''))) / length('when ''h_bathmat'' then 2');
    if n <> 1 then raise exception 'PATCH kids__item_price %', n; end if;
    execute replace(d, 'when ''h_bathmat'' then 2', v_new_price);
  end if;
  -- 상점 값 목록 (할인 값과 원래 값 두 곳)
  d := pg_get_functiondef('public.kids_shop(text)'::regprocedure);
  if position('h_cattower' in d) = 0 then
    n := (length(d) - length(replace(d, '(''h_bathmat'', 2)', ''))) / length('(''h_bathmat'', 2)');
    if n <> 2 then raise exception 'PATCH kids_shop %', n; end if;
    execute replace(d, '(''h_bathmat'', 2)', v_new_pair);
  end if;
  -- 집에 놓을 수 있는 물건 (가방 목록과 집 저장)
  d := pg_get_functiondef('public.kids__home_items(uuid)'::regprocedure);
  if position('h_cattower' in d) = 0 then
    n := (length(d) - length(replace(d, '''h_bathmat'', ', ''))) / length('''h_bathmat'', ');
    if n <> 1 then raise exception 'PATCH kids__home_items %', n; end if;
    execute replace(d, '''h_bathmat'', ', v_new_list);
  end if;
  d := pg_get_functiondef('public.kids_home_save(text, jsonb, jsonb, integer)'::regprocedure);
  if position('h_cattower' in d) = 0 then
    n := (length(d) - length(replace(d, '''h_bathmat'', ', ''))) / length('''h_bathmat'', ');
    if n <> 1 then raise exception 'PATCH kids_home_save %', n; end if;
    execute replace(d, '''h_bathmat'', ', v_new_list);
  end if;
end $patch$;

-- 집에서 쉬는 동물: 가진 동물(kids_items의 pet_) 가운데 데리고 다니지 않는 동물 [{item, name}]
create or replace function public.kids__rest_pets(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', i.item, 'name', c.pet_names ->> i.item) order by i.item), '[]'::jsonb)
    from public.kids_items i join public.kids_children c on c.id = i.child_id
   where i.child_id = p_child and i.count > 0 and left(i.item, 4) = 'pet_'
     and not (i.item = any(coalesce(c.pets, case when c.pet is null then '{}'::text[] else array[c.pet] end)))
$$;
revoke all on function public.kids__rest_pets(uuid) from public, anon, authenticated;

-- 내 집: rest_pets를 더한다 (나머지는 그대로)
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
    'rest_pets', public.kids__rest_pets(v_id),
    'now', public.kids__now_ms());
end $$;

-- 친구 집 놀러 가기: 그 집에서 쉬는 동물(rest_pets)을 더한다 (나머지는 그대로)
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
    'rest_pets', public.kids__rest_pets(p_child),
    'now', public.kids__now_ms());
end $$;

-- 기능 목록: pethouse(애완동물 집)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true, 'rewards', public.kids__rewards(), 'jrope', true, 'jr2', true, 'bath', true, 'hlock', true, 'ropes', true, 'dungeon', true, 'arcade', true,
    'pethouse', true)
$$;
