-- 진숲 어린이 마을: 열매 선물, 물고기·곤충 팔기, 열매 상점 할인, 꾸미기 물건(옷장), 건의함 하루 10개
-- 다시 실행해도 된다. 값은 js/economy.js, js/wardrobe.js, js/homeitems.js와 같다.

-- ---------- 설정: 상점 할인(퍼센트)과 하루에 팔아서 받는 열매 ----------
insert into public.kids_config (key, value) values ('shop_sale', '0'), ('sell_day', '5') on conflict (key) do nothing;

create or replace function public.kids__sale()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select case when value in ('0', '10', '20', '30', '40', '50') then value::int else 0 end
    from public.kids_config where key = 'shop_sale'), 0)
$$;
revoke all on function public.kids__sale() from public, anon, authenticated;

create or replace function public.kids__sell_day()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select case when value ~ '^[0-9]{1,2}$' then least(30, value::int) else 5 end
    from public.kids_config where key = 'sell_day'), 5)
$$;
revoke all on function public.kids__sell_day() from public, anon, authenticated;

-- ---------- 열매 상점: 꾸미기 물건 ----------
alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip', 'av_halo', 'av_bunny', 'av_catband', 'av_chef', 'av_glasses', 'av_sunglasses', 'av_heart', 'av_angel', 'av_butterfly', 'av_cape', 'av_backpack', 'av_sailor', 'av_raincoat', 'av_hero'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 when 'av_halo' then 6 when 'av_bunny' then 5 when 'av_catband' then 5 when 'av_chef' then 6 when 'av_glasses' then 3 when 'av_sunglasses' then 4 when 'av_heart' then 4 when 'av_angel' then 10 when 'av_butterfly' then 10 when 'av_cape' then 6 when 'av_backpack' then 4 when 'av_sailor' then 6 when 'av_raincoat' then 6 when 'av_hero' then 8 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

-- 할인한 값: 원래 값에서 할인만큼 빼고 소수점은 버린다 (가장 싸도 1개)
create or replace function public.kids__sale_price(p_item text)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.kids__item_price(p_item) is null then null
    else greatest(1, floor(public.kids__item_price(p_item) * (100 - public.kids__sale()) / 100.0)::int) end
$$;
revoke all on function public.kids__sale_price(text) from public, anon, authenticated;

-- 아바타 칸과 값이 상점 물건이면 그 물건 이름 (누구나 고를 수 있는 것은 null)
create or replace function public.kids__wear_item(p_slot text, p_val text)
returns text language sql immutable set search_path = '' as $$
  select case p_slot || ':' || coalesce(p_val, '') when 'hat:halo' then 'av_halo' when 'hat:bunny' then 'av_bunny' when 'hat:catband' then 'av_catband' when 'hat:chef' then 'av_chef' when 'face:glasses' then 'av_glasses' when 'face:sunglasses' then 'av_sunglasses' when 'face:heart' then 'av_heart' when 'back:angel' then 'av_angel' when 'back:butterfly' then 'av_butterfly' when 'back:cape' then 'av_cape' when 'back:backpack' then 'av_backpack' when 'outfit:sailor' then 'av_sailor' when 'outfit:raincoat' then 'av_raincoat' when 'outfit:hero' then 'av_hero' else null end
$$;
revoke all on function public.kids__wear_item(text, text) from public, anon, authenticated;

-- ---------- 팔기: 잡은 물고기와 곤충 ----------
-- 팔아도 도감 기록은 남는다 (sold_at만 적는다)
alter table public.kids_fish add column if not exists sold_at timestamptz;
alter table public.kids_bugs add column if not exists sold_at timestamptz;
create index if not exists kids_fish_unsold on public.kids_fish (child_id, fish) where sold_at is null;
create index if not exists kids_bugs_unsold on public.kids_bugs (child_id, bug) where sold_at is null;

create table if not exists public.kids_sell_log (
  id bigserial primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  kind text not null check (kind in ('fish', 'bug')),
  item text not null,
  n int not null check (n between 1 and 99),
  fruits int not null check (fruits >= 0),
  created_at timestamptz not null default now()
);
create index if not exists kids_sell_log_child on public.kids_sell_log (child_id, created_at);
alter table public.kids_sell_log enable row level security;
revoke all on public.kids_sell_log from public, anon, authenticated;

create or replace function public.kids__sell_price(p_kind text, p_item text)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 1 when 1 then 2 when 2 then 3 when 3 then 5 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case p_item when 'cabbage_white' then 1 when 'swallowtail' then 2 when 'honeybee' then 1 when 'ladybug' then 1 when 'grasshopper' then 1 when 'red_dragonfly' then 1 when 'mantis' then 2 when 'cicada' then 2 when 'stag_beetle' then 3 when 'rhino_beetle' then 3 when 'firefly' then 3 else null end
    else null end
$$;
revoke all on function public.kids__sell_price(text, text) from public, anon, authenticated;

-- 가방에 있는(아직 팔지 않은) 물고기와 곤충, 값, 오늘 팔아서 받은 열매와 하루 한도
create or replace function public.kids__sell_info(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fish', coalesce((select jsonb_object_agg(s.fish, s.n) from (select x.fish, count(*) n from public.kids_fish x join public.kids_fish_kinds k on k.id = x.fish
        where x.child_id = p_child and x.sold_at is null and k.rarity >= 0 group by x.fish) s), '{}'::jsonb),
    'bugs', coalesce((select jsonb_object_agg(s.bug, s.n) from (select bug, count(*) n from public.kids_bugs
        where child_id = p_child and sold_at is null group by bug) s), '{}'::jsonb),
    'prices', jsonb_build_object(
      'fish', coalesce((select jsonb_object_agg(k.id, public.kids__sell_price('fish', k.id)) from public.kids_fish_kinds k where k.rarity >= 0), '{}'::jsonb),
      'bug', jsonb_build_object('cabbage_white', 1, 'swallowtail', 2, 'honeybee', 1, 'ladybug', 1, 'grasshopper', 1, 'red_dragonfly', 1, 'mantis', 2, 'cicada', 2, 'stag_beetle', 3, 'rhino_beetle', 3, 'firefly', 3)),
    'today', coalesce((select sum(fruits) from public.kids_sell_log
        where child_id = p_child and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0),
    'cap', public.kids__sell_day())
$$;
revoke all on function public.kids__sell_info(uuid) from public, anon, authenticated;

-- ---------- 선물: 친구에게 열매 주기 ----------
create table if not exists public.kids_gifts (
  id bigserial primary key,
  from_child uuid not null references public.kids_children(id) on delete cascade,
  to_child uuid not null references public.kids_children(id) on delete cascade,
  n int not null check (n between 1 and 10),
  msg text not null check (msg in ('thanks', 'bday', 'cheer', 'play', 'bless', 'best')),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists kids_gifts_to on public.kids_gifts (to_child) where seen_at is null;
create index if not exists kids_gifts_from on public.kids_gifts (from_child, created_at);
alter table public.kids_gifts enable row level security;
revoke all on public.kids_gifts from public, anon, authenticated;

create or replace function public.kids__gift_left(p_child uuid)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(0, 10 - coalesce((select sum(n) from public.kids_gifts
    where from_child = p_child and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0))::int
$$;
revoke all on function public.kids__gift_left(uuid) from public, anon, authenticated;

-- ---------- 상점 보기와 사기 ----------
create or replace function public.kids_shop(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_sale int := public.kids__sale();
begin
  return jsonb_build_object(
    'fruits', (select fruits from public.kids_children where id = v_id),
    'pet', (select pet from public.kids_children where id = v_id),
    'items', coalesce((select jsonb_object_agg(item, count) from public.kids_items where child_id = v_id and count > 0), '{}'::jsonb),
    'sale', v_sale,
    'prices', (select jsonb_object_agg(t.i, greatest(1, floor(t.p * (100 - v_sale) / 100.0)::int)) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'base', (select jsonb_object_agg(t.i, t.p) from (values ('fw_spark', 1), ('fw_flower', 3), ('fw_heart', 5), ('pet_dog', 30), ('pet_cat', 30), ('pet_rabbit', 30), ('pet_chick', 30), ('h_bed', 8), ('h_desk', 5), ('h_chair', 2), ('h_sofa', 7), ('h_shelf', 6), ('h_table', 3), ('h_rug', 4), ('h_lamp', 3), ('h_pot', 2), ('h_toys', 3), ('h_piano', 9), ('y_bench', 5), ('y_lamp', 3), ('y_swing', 8), ('y_fountain', 9), ('y_birdhouse', 3), ('y_picnic', 7), ('y_tree', 6), ('y_slide', 8), ('y_mailbox', 2), ('s_carrot', 1), ('s_tomato', 1), ('s_cabbage', 1), ('s_strawberry', 2), ('s_sunflower', 1), ('s_tulip', 2), ('av_halo', 6), ('av_bunny', 5), ('av_catband', 5), ('av_chef', 6), ('av_glasses', 3), ('av_sunglasses', 4), ('av_heart', 4), ('av_angel', 10), ('av_butterfly', 10), ('av_cape', 6), ('av_backpack', 4), ('av_sailor', 6), ('av_raincoat', 6), ('av_hero', 8)) t(i, p)),
    'gift_left', public.kids__gift_left(v_id),
    'sell', public.kids__sell_info(v_id));
end $$;

create or replace function public.kids_shop_buy(p_token text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__sale_price(p_item); v_n int := coalesce(p_n, 1); v_have int;
        v_one boolean := left(coalesce(p_item, ''), 4) = 'pet_' or left(coalesce(p_item, ''), 3) = 'av_';
begin
  if v_one then v_n := 1; end if;
  if v_price is null or v_n < 1 or v_n > 5 then raise exception 'BAD_ITEM'; end if;
  select coalesce((select count from public.kids_items where child_id = v_id and item = p_item), 0) into v_have;
  if left(p_item, 4) = 'pet_' and v_have >= 1 then raise exception 'HAVE_PET'; end if;
  if left(p_item, 3) = 'av_' and v_have >= 1 then raise exception 'HAVE_ITEM'; end if;
  if v_have + v_n > 99 then raise exception 'BAG_FULL'; end if;
  update public.kids_children set fruits = fruits - v_price * v_n where id = v_id and fruits >= v_price * v_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  insert into public.kids_items (child_id, item, count) values (v_id, p_item, v_n)
    on conflict (child_id, item) do update set count = public.kids_items.count + excluded.count;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;

-- ---------- 팔기 ----------
-- 가장 먼저 잡은 것부터 판다. 하루에 팔아서 받는 열매는 선생님이 정한 만큼까지
create or replace function public.kids_sell(p_token text, p_kind text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__sell_price(p_kind, p_item); v_n int := coalesce(p_n, 1);
        v_cap int := public.kids__sell_day(); v_today int; v_got int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if v_price is null or v_n < 1 or v_n > 99 then raise exception 'BAD_ITEM'; end if;
  if v_cap <= 0 then raise exception 'SELL_CLOSED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_sell:' || v_id::text));
  select coalesce(sum(fruits), 0) into v_today from public.kids_sell_log where child_id = v_id and created_at >= v_start;
  if v_today + v_price * v_n > v_cap then raise exception 'SELL_DAY'; end if;
  if p_kind = 'fish' then
    with s as (select id from public.kids_fish where child_id = v_id and fish = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_fish f set sold_at = now() from s where f.id = s.id;
  else
    with s as (select id from public.kids_bugs where child_id = v_id and bug = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_bugs b set sold_at = now() from s where b.id = s.id;
  end if;
  get diagnostics v_got = row_count;
  if v_got < v_n then raise exception 'NO_ITEM'; end if;
  update public.kids_children set fruits = fruits + v_price * v_n where id = v_id;
  insert into public.kids_sell_log (child_id, kind, item, n, fruits) values (v_id, p_kind, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;
grant execute on function public.kids_sell(text, text, text, int) to anon, authenticated;

-- ---------- 선물 보내기와 받기 ----------
create or replace function public.kids_gift_send(p_token text, p_to uuid, p_n int, p_msg text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_left int;
begin
  if p_to is null or p_to = v_id or not exists (select 1 from public.kids_children where id = p_to and village_name is not null) then raise exception 'NOT_FOUND'; end if;
  if p_n is null or p_n < 1 or p_n > 10 or coalesce(p_msg, '') not in ('thanks', 'bday', 'cheer', 'play', 'bless', 'best') then raise exception 'BAD_GIFT'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_gift:' || v_id::text));
  if exists (select 1 from public.kids_gifts where from_child = v_id and created_at > now() - interval '3 seconds') then raise exception 'TOO_FAST'; end if;
  v_left := public.kids__gift_left(v_id);
  if p_n > v_left then raise exception 'GIFT_DAY'; end if;
  update public.kids_children set fruits = fruits - p_n where id = v_id and fruits >= p_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  update public.kids_children set fruits = fruits + p_n where id = p_to;
  insert into public.kids_gifts (from_child, to_child, n, msg) values (v_id, p_to, p_n, p_msg);
  return jsonb_build_object('fruits', (select fruits from public.kids_children where id = v_id), 'gift_left', v_left - p_n);
end $$;
grant execute on function public.kids_gift_send(text, uuid, int, text) to anon, authenticated;

-- 아직 못 본 선물 (보면 본 것으로 적는다)
create or replace function public.kids_gift_inbox(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_list jsonb;
begin
  with g as (update public.kids_gifts set seen_at = now() where to_child = v_id and seen_at is null returning from_child, n, msg, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('from', g.from_child, 'name', coalesce(c.village_name, '친구'), 'n', g.n, 'msg', g.msg, 'at', g.created_at)
      order by g.created_at), '[]'::jsonb) into v_list
    from g left join public.kids_children c on c.id = g.from_child;
  return jsonb_build_object('gifts', v_list, 'fruits', (select fruits from public.kids_children where id = v_id));
end $$;
grant execute on function public.kids_gift_inbox(text) to anon, authenticated;

-- ---------- 옷장: 상점 꾸미기 물건은 산 아이만 입는다 ----------
create or replace function public.kids_save_avatar(p_token text, p_avatar jsonb, p_village_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text := btrim(coalesce(p_village_name, '')); v_slot text; v_item text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 10 then raise exception 'BAD_NAME'; end if;
  if p_avatar is null or jsonb_typeof(p_avatar) <> 'object' or pg_column_size(p_avatar) > 4000 then
    raise exception 'BAD_AVATAR';
  end if;
  foreach v_slot in array array['hat', 'face', 'back', 'outfit'] loop
    v_item := public.kids__wear_item(v_slot, p_avatar->>v_slot);
    if v_item is not null and not exists (select 1 from public.kids_items where child_id = v_id and item = v_item and count > 0) then
      raise exception 'NEED_ITEM';
    end if;
  end loop;
  update public.kids_children set avatar = p_avatar, village_name = v_name where id = v_id;
  return public.kids_me(p_token);
end $$;

-- ---------- 마을 건의함: 하루에 10개까지 ----------
create or replace function public.kids_feedback_send(p_token text, p_kind text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_body text := btrim(coalesce(p_body, ''));
begin
  if coalesce(p_kind, '') not in ('idea', 'bug', 'like', 'etc') then raise exception 'BAD_KIND'; end if;
  if char_length(v_body) < 2 then raise exception 'EMPTY_FEEDBACK'; end if;
  if char_length(v_body) > 300 then raise exception 'TOO_LONG'; end if;
  if exists (select 1 from public.kids_feedback where child_id = v_id and created_at > now() - interval '20 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.kids_feedback where child_id = v_id and created_at > now() - interval '1 day') >= 10 then raise exception 'FEEDBACK_DAY'; end if;
  insert into public.kids_feedback (child_id, kind, body) values (v_id, p_kind, v_body);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 선생님: 할인과 팔기 한도, 선물과 판 기록 ----------
create or replace function public.kids_t_set_shop(p_token text, p_sale int, p_sell_day int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  if p_sale is not null then
    if p_sale not in (0, 10, 20, 30, 40, 50) then raise exception 'BAD_SALE'; end if;
    insert into public.kids_config (key, value) values ('shop_sale', p_sale::text) on conflict (key) do update set value = excluded.value;
  end if;
  if p_sell_day is not null then
    if p_sell_day < 0 or p_sell_day > 30 then raise exception 'BAD_SALE'; end if;
    insert into public.kids_config (key, value) values ('sell_day', p_sell_day::text) on conflict (key) do update set value = excluded.value;
  end if;
  return public.kids_t_village(p_token);
end $$;
grant execute on function public.kids_t_set_shop(text, int, int) to anon, authenticated;

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
                 'to_village_name', b.village_name, 'n', g.n, 'msg', g.msg, 'at', g.created_at) as x, g.created_at as at
          from public.kids_gifts g join public.kids_children a on a.id = g.from_child join public.kids_children b on b.id = g.to_child
         order by g.created_at desc limit 100) s), '[]'::jsonb));
end $$;

-- 화면이 서버에 어떤 기능이 있는지 묻는다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true)
$$;
