-- 진숲 어린이 마을: 마음대로 요리하기 (냉장고 재료와 낚은 물고기로 요리해서 마을 식탁에 올리기)

create table if not exists public.kids_dishes (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('soup', 'fry', 'grill', 'salad')),
  items text[] not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kids_dishes_created on public.kids_dishes (created_at desc);
create index if not exists kids_dishes_child on public.kids_dishes (child_id, created_at desc);
alter table public.kids_dishes enable row level security;
revoke all on public.kids_dishes from public, anon, authenticated;

-- 요리 저장: 재료는 냉장고 목록이거나, 이 아이가 한 번이라도 낚은 물고기('fish_물고기id')만 받는다
create or replace function public.kids_dish_save(p_token text, p_name text, p_kind text, p_items text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_item text; v_name text; v_n int; v_dish bigint;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
        v_fridge text[] := array['potato','carrot','onion','tomato','mushroom','cabbage','paprika','egg','rice','bread','manna','lentil','flour','apple','grape','honey'];
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if p_kind is null or p_kind not in ('soup', 'fry', 'grill', 'salad') then raise exception 'BAD_DISH'; end if;
  if p_items is null or coalesce(array_length(p_items, 1), 0) < 1 or array_length(p_items, 1) > 4 then raise exception 'BAD_DISH'; end if;
  foreach v_item in array p_items loop
    if v_item = any (v_fridge) then continue; end if;
    if v_item like 'fish\_%' and exists (
      select 1 from public.kids_fish f join public.kids_fish_kinds k on k.id = f.fish
       where f.child_id = v_id and k.rarity >= 0 and 'fish_' || k.id = v_item) then continue; end if;
    raise exception 'BAD_DISH';
  end loop;
  if exists (select 1 from public.kids_dishes where child_id = v_id and created_at > now() - interval '3 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_n from public.kids_dishes where child_id = v_id and created_at >= v_start;
  if v_n >= 30 then raise exception 'DISH_DAY'; end if;
  v_name := left(public.kids__chat_clean(p_name), 16);
  if char_length(v_name) = 0 then v_name := '나의 요리'; end if;
  insert into public.kids_dishes (child_id, name, kind, items) values (v_id, v_name, p_kind, p_items) returning id into v_dish;
  -- 아이마다 최근 60개만 둔다
  delete from public.kids_dishes where child_id = v_id and id not in
    (select id from public.kids_dishes where child_id = v_id order by created_at desc limit 60);
  return jsonb_build_object('id', v_dish, 'name', v_name);
end $$;

-- 마을 식탁: 최근 요리 네 접시
create or replace function public.kids_dish_table(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(x order by at desc) from (
    select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'items', to_jsonb(d.items), 'cook', c.village_name, 'me', d.child_id = v_id) as x, d.created_at as at
      from public.kids_dishes d join public.kids_children c on c.id = d.child_id
     where not d.hidden order by d.created_at desc limit 4) s), '[]'::jsonb);
end $$;

-- 선생님: 마을 설정과 대화에 요리도 함께 본다
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
                 'body', m.body, 'masked', m.masked, 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_chat m join public.kids_children c on c.id = m.child_id
         order by m.created_at desc limit 200) s), '[]'::jsonb),
    'muted', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.real_name, 'village_name', c.village_name))
        from public.kids_children c where c.chat_muted), '[]'::jsonb),
    'dishes', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'child_name', c.real_name, 'village_name', c.village_name,
                 'hidden', d.hidden, 'at', d.created_at) as x, d.created_at as at
          from public.kids_dishes d join public.kids_children c on c.id = d.child_id
         order by d.created_at desc limit 60) s), '[]'::jsonb));
end $$;

create or replace function public.kids_t_dish_hide(p_token text, p_id bigint, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  update public.kids_dishes set hidden = coalesce(p_hidden, false) where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return public.kids_t_village(p_token);
end $$;
