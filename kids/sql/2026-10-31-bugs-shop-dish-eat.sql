-- 진숲 어린이 마을: 마을 식탁 요리 먹기(누가 먹었는지), 곤충 채집 도감, 열매 상점(불꽃놀이)
-- 다시 실행해도 된다.

-- ---------- 마을 식탁 요리 먹기: 한 아이가 한 접시를 한 번 먹는다 ----------
create table if not exists public.kids_dish_eats (
  dish_id bigint not null references public.kids_dishes(id) on delete cascade,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dish_id, child_id)
);
create index if not exists kids_dish_eats_dish on public.kids_dish_eats (dish_id, created_at);
alter table public.kids_dish_eats enable row level security;
revoke all on public.kids_dish_eats from public, anon, authenticated;

-- 먹은 친구 이름 (먼저 먹은 순서, 열 명까지)
create or replace function public.kids__dish_eaters(p_dish bigint)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(s.n order by s.at), '[]'::jsonb) from (
    select c.village_name n, e.created_at at from public.kids_dish_eats e join public.kids_children c on c.id = e.child_id
     where e.dish_id = p_dish and c.village_name is not null order by e.created_at limit 10) s
$$;
revoke all on function public.kids__dish_eaters(bigint) from public, anon, authenticated;

create or replace function public.kids_dish_table(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(x order by at desc) from (
    select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'items', to_jsonb(d.items), 'cook', c.village_name, 'me', d.child_id = v_id,
             'eaters', public.kids__dish_eaters(d.id),
             'eaten', (select count(*) from public.kids_dish_eats e where e.dish_id = d.id),
             'ate', exists (select 1 from public.kids_dish_eats e where e.dish_id = d.id and e.child_id = v_id)) as x, d.created_at as at
      from public.kids_dishes d join public.kids_children c on c.id = d.child_id
     where not d.hidden order by d.created_at desc limit 4) s), '[]'::jsonb);
end $$;

create or replace function public.kids_dish_eat(p_token text, p_dish bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); d public.kids_dishes;
begin
  select * into d from public.kids_dishes where id = p_dish and not hidden;
  if d.id is null then raise exception 'NOT_FOUND'; end if;
  if d.child_id = v_id then raise exception 'OWN_DISH'; end if;
  insert into public.kids_dish_eats (dish_id, child_id) values (p_dish, v_id) on conflict do nothing;
  return jsonb_build_object('id', d.id, 'name', d.name, 'eaters', public.kids__dish_eaters(d.id),
    'eaten', (select count(*) from public.kids_dish_eats e where e.dish_id = d.id));
end $$;

-- ---------- 곤충 채집 ----------
create table if not exists public.kids_bugs (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  bug text not null check (bug in ('cabbage_white', 'swallowtail', 'honeybee', 'ladybug', 'grasshopper', 'red_dragonfly',
                                   'mantis', 'cicada', 'stag_beetle', 'rhino_beetle', 'firefly')),
  caught_at timestamptz not null default now()
);
create index if not exists kids_bugs_child on public.kids_bugs (child_id, caught_at desc);
alter table public.kids_bugs enable row level security;
revoke all on public.kids_bugs from public, anon, authenticated;

create or replace function public.kids_bug_book(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'mine', coalesce((select jsonb_object_agg(b.bug, jsonb_build_object('count', b.n, 'first', b.f))
      from (select bug, count(*) n, min(caught_at) f from public.kids_bugs where child_id = v_id group by bug) b), '{}'::jsonb),
    'my_today', (select count(*) from public.kids_bugs where child_id = v_id and caught_at >= v_start));
end $$;

-- 잡은 곤충 기록: 놀이 마당과 같은 규칙(그날 말씀 활동을 하나 마쳐야)으로, 2초에 한 번, 하루 60마리까지
create or replace function public.kids_bug_catch(p_token text, p_bug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_n int; v_kind int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if p_bug is null or p_bug not in ('cabbage_white', 'swallowtail', 'honeybee', 'ladybug', 'grasshopper', 'red_dragonfly',
                                    'mantis', 'cicada', 'stag_beetle', 'rhino_beetle', 'firefly') then raise exception 'BAD_BUG'; end if;
  if exists (select 1 from public.kids_bugs where child_id = v_id and caught_at > now() - interval '2 seconds') then raise exception 'TOO_FAST'; end if;
  select count(*) into v_n from public.kids_bugs where child_id = v_id and caught_at >= v_start;
  if v_n >= 60 then raise exception 'BUG_DAY'; end if;
  insert into public.kids_bugs (child_id, bug) values (v_id, p_bug);
  select count(*) into v_kind from public.kids_bugs where child_id = v_id and bug = p_bug;
  return jsonb_build_object('bug', p_bug, 'count', v_kind, 'kinds', (select count(distinct bug) from public.kids_bugs where child_id = v_id));
end $$;

-- ---------- 열매 상점: 불꽃놀이 ----------
create table if not exists public.kids_items (
  child_id uuid not null references public.kids_children(id) on delete cascade,
  item text not null check (item in ('fw_spark', 'fw_flower', 'fw_heart')),
  count int not null default 0 check (count >= 0 and count <= 99),
  used_at timestamptz,
  primary key (child_id, item)
);
alter table public.kids_items enable row level security;
revoke all on public.kids_items from public, anon, authenticated;

-- 산 기록 (선생님 화면 '마을 대화' 탭에서 본다)
create table if not exists public.kids_shop_log (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  item text not null,
  n int not null,
  price int not null,
  created_at timestamptz not null default now()
);
create index if not exists kids_shop_log_at on public.kids_shop_log (created_at desc);
alter table public.kids_shop_log enable row level security;
revoke all on public.kids_shop_log from public, anon, authenticated;

-- 값: 반짝 불꽃 열매 1개, 꽃 불꽃 3개, 하트 불꽃 5개
create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 else null end
$$;
revoke all on function public.kids__item_price(text) from public, anon, authenticated;

create or replace function public.kids_shop(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'fruits', (select fruits from public.kids_children where id = v_id),
    'items', coalesce((select jsonb_object_agg(item, count) from public.kids_items where child_id = v_id and count > 0), '{}'::jsonb),
    'prices', jsonb_build_object('fw_spark', 1, 'fw_flower', 3, 'fw_heart', 5));
end $$;

create or replace function public.kids_shop_buy(p_token text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_price int := public.kids__item_price(p_item); v_n int := coalesce(p_n, 1); v_have int;
begin
  if v_price is null or v_n < 1 or v_n > 5 then raise exception 'BAD_ITEM'; end if;
  select coalesce((select count from public.kids_items where child_id = v_id and item = p_item), 0) into v_have;
  if v_have + v_n > 99 then raise exception 'BAG_FULL'; end if;
  update public.kids_children set fruits = fruits - v_price * v_n where id = v_id and fruits >= v_price * v_n;
  if not found then raise exception 'NO_FRUIT'; end if;
  insert into public.kids_items (child_id, item, count) values (v_id, p_item, v_n)
    on conflict (child_id, item) do update set count = public.kids_items.count + excluded.count;
  insert into public.kids_shop_log (child_id, item, n, price) values (v_id, p_item, v_n, v_price * v_n);
  return public.kids_shop(p_token);
end $$;

-- 불꽃 하나 터트리기 (2초에 한 번)
create or replace function public.kids_item_use(p_token text, p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_left int;
begin
  if exists (select 1 from public.kids_items where child_id = v_id and used_at > now() - interval '2 seconds') then raise exception 'TOO_FAST'; end if;
  update public.kids_items set count = count - 1, used_at = now() where child_id = v_id and item = p_item and count > 0 returning count into v_left;
  if not found then raise exception 'NO_ITEM'; end if;
  return jsonb_build_object('item', p_item, 'left', v_left);
end $$;

-- 화면이 서버에 어떤 기능이 있는지 묻는다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true)
$$;

-- ---------- 선생님: 마을 화면에 열매 상점 기록을 더한다 ----------
create or replace function public.kids_t_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'today', public.kids__today(),
    'chat_open', public.kids_chat_open(),
    'free_until', (select value from public.kids_config where key = 'play_free_until'),
    'play_free', public.kids__play_free(),
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
         order by l.created_at desc limit 100) s), '[]'::jsonb));
end $$;
