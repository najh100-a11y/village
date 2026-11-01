-- 진숲 어린이 마을: 내 집 꾸미기(방, 마당, 밭)와 마을 건의함
-- 다시 실행해도 된다. 물건 값은 js/homeitems.js와 같다.

-- ---------- 열매 상점: 집 꾸미기 물건 ----------
alter table public.kids_items drop constraint if exists kids_items_item_check;
alter table public.kids_items add constraint kids_items_item_check check (item in ('fw_spark', 'fw_flower', 'fw_heart', 'pet_dog', 'pet_cat', 'pet_rabbit', 'pet_chick', 'h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip'));

create or replace function public.kids__item_price(p_item text)
returns int language sql immutable set search_path = '' as $$
  select case p_item when 'fw_spark' then 1 when 'fw_flower' then 3 when 'fw_heart' then 5 when 'pet_dog' then 30 when 'pet_cat' then 30 when 'pet_rabbit' then 30 when 'pet_chick' then 30 when 'h_bed' then 8 when 'h_desk' then 5 when 'h_chair' then 2 when 'h_sofa' then 7 when 'h_shelf' then 6 when 'h_table' then 3 when 'h_rug' then 4 when 'h_lamp' then 3 when 'h_pot' then 2 when 'h_toys' then 3 when 'h_piano' then 9 when 'y_bench' then 5 when 'y_lamp' then 3 when 'y_swing' then 8 when 'y_fountain' then 9 when 'y_birdhouse' then 3 when 'y_picnic' then 7 when 'y_tree' then 6 when 'y_slide' then 8 when 'y_mailbox' then 2 when 's_carrot' then 1 when 's_tomato' then 1 when 's_cabbage' then 1 when 's_strawberry' then 2 when 's_sunflower' then 1 when 's_tulip' then 2 else null end
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
    'prices', jsonb_build_object('fw_spark', 1, 'fw_flower', 3, 'fw_heart', 5, 'pet_dog', 30, 'pet_cat', 30, 'pet_rabbit', 30, 'pet_chick', 30, 'h_bed', 8, 'h_desk', 5, 'h_chair', 2, 'h_sofa', 7, 'h_shelf', 6, 'h_table', 3, 'h_rug', 4, 'h_lamp', 3, 'h_pot', 2, 'h_toys', 3, 'h_piano', 9, 'y_bench', 5, 'y_lamp', 3, 'y_swing', 8, 'y_fountain', 9, 'y_birdhouse', 3, 'y_picnic', 7, 'y_tree', 6, 'y_slide', 8, 'y_mailbox', 2, 's_carrot', 1, 's_tomato', 1, 's_cabbage', 1, 's_strawberry', 2, 's_sunflower', 1, 's_tulip', 2));
end $$;

-- ---------- 내 집 ----------
-- layout: [{id, k(물건), x, z(왼쪽 위 칸), r(0~3, 90도씩 돌림), t(심은 때, ms), g(물 주어 앞당긴 시간), w(물 준 때)}]
create table if not exists public.kids_homes (
  child_id uuid primary key references public.kids_children(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.kids_homes enable row level security;
revoke all on public.kids_homes from public, anon, authenticated;

create or replace function public.kids__home_items(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(item, count), '{}'::jsonb) from public.kids_items
   where child_id = p_child and count > 0 and item in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
$$;
revoke all on function public.kids__home_items(uuid) from public, anon, authenticated;

create or replace function public.kids_home(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'layout', coalesce((select layout from public.kids_homes where child_id = v_id), '[]'::jsonb),
    'items', public.kids__home_items(v_id),
    'fruits', (select fruits from public.kids_children where id = v_id));
end $$;

-- 저장: 놓은 물건 수는 가진 수를 넘을 수 없다. p_harvest: 다 자라서 거둔 채소(id). 거두면 그 씨앗이 하나 줄어든다.
create or replace function public.kids_home_save(p_token text, p_layout jsonb, p_harvest jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_old jsonb; e jsonb; h text; v_k text;
begin
  if p_layout is null or jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 150 or length(p_layout::text) > 40000 then
    raise exception 'BAD_HOME';
  end if;
  for e in select * from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string' or length(e->>'id') > 24
       or (e->>'k') is null or (e->>'k') not in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
       or jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'z') <> 'number'
       or (e->>'x')::numeric not between -12 and 12 or (e->>'z')::numeric not between -12 and 12
       or (e->'r' is not null and (jsonb_typeof(e->'r') <> 'number' or (e->>'r')::numeric not in (0, 1, 2, 3))) then
      raise exception 'BAD_HOME';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_layout) a) <> (select count(distinct a->>'id') from jsonb_array_elements(p_layout) a) then
    raise exception 'BAD_HOME';
  end if;
  select layout into v_old from public.kids_homes where child_id = v_id for update;
  v_old := coalesce(v_old, '[]'::jsonb);
  -- 거둔 채소: 예전 배치에 있던 씨앗이고 새 배치에는 없어야 한다
  if p_harvest is not null and jsonb_typeof(p_harvest) = 'array' and jsonb_array_length(p_harvest) > 0 then
    if jsonb_array_length(p_harvest) > 30 then raise exception 'BAD_HOME'; end if;
    for h in select jsonb_array_elements_text(p_harvest) loop
      select a->>'k' into v_k from jsonb_array_elements(v_old) a where a->>'id' = h limit 1;
      if v_k is null or v_k not in ('s_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip') or exists (select 1 from jsonb_array_elements(p_layout) a where a->>'id' = h) then
        raise exception 'BAD_HOME';
      end if;
      update public.kids_items set count = count - 1 where child_id = v_id and item = v_k and count > 0;
    end loop;
  end if;
  if exists (
    select 1 from (select a->>'k' k, count(*) n from jsonb_array_elements(p_layout) a group by 1) u
    where u.n > coalesce((select count from public.kids_items i where i.child_id = v_id and i.item = u.k), 0)) then
    raise exception 'NOT_ENOUGH';
  end if;
  insert into public.kids_homes (child_id, layout, updated_at) values (v_id, p_layout, now())
    on conflict (child_id) do update set layout = excluded.layout, updated_at = now();
  return jsonb_build_object('ok', true, 'items', public.kids__home_items(v_id));
end $$;
grant execute on function public.kids_home(text) to anon, authenticated;
grant execute on function public.kids_home_save(text, jsonb, jsonb) to anon, authenticated;

-- 쓰는 물건(불꽃)만 터트릴 수 있다
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

-- ---------- 마을 건의함 ----------
-- 아이가 쓴 건의는 선생님만 본다. 선생님은 '봤어요', '고쳤어요'로 표시하고 짧게 답할 수 있다.
create table if not exists public.kids_feedback (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  kind text not null check (kind in ('idea', 'bug', 'like', 'etc')),
  body text not null check (char_length(body) between 2 and 300),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  reply text,
  replied_at timestamptz,
  reply_seen boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists kids_feedback_at on public.kids_feedback (created_at desc);
create index if not exists kids_feedback_child on public.kids_feedback (child_id, created_at desc);
alter table public.kids_feedback enable row level security;
revoke all on public.kids_feedback from public, anon, authenticated;

create or replace function public.kids_feedback_send(p_token text, p_kind text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_body text := btrim(coalesce(p_body, ''));
begin
  if coalesce(p_kind, '') not in ('idea', 'bug', 'like', 'etc') then raise exception 'BAD_KIND'; end if;
  if char_length(v_body) < 2 then raise exception 'EMPTY_FEEDBACK'; end if;
  if char_length(v_body) > 300 then raise exception 'TOO_LONG'; end if;
  if exists (select 1 from public.kids_feedback where child_id = v_id and created_at > now() - interval '20 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.kids_feedback where child_id = v_id and created_at > now() - interval '1 day') >= 5 then raise exception 'FEEDBACK_DAY'; end if;
  insert into public.kids_feedback (child_id, kind, body) values (v_id, p_kind, v_body);
  return jsonb_build_object('ok', true);
end $$;

-- 내가 쓴 건의 (최근 20개). 답을 처음 보면 본 것으로 표시한다
create or replace function public.kids_feedback_mine(p_token text, p_peek boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'body', body, 'status', status, 'reply', reply,
           'new_reply', reply is not null and not reply_seen, 'at', created_at) order by created_at desc), '[]'::jsonb)
    into v from (select * from public.kids_feedback where child_id = v_id order by created_at desc limit 20) f;
  if not coalesce(p_peek, false) then
    update public.kids_feedback set reply_seen = true where child_id = v_id and reply is not null and not reply_seen;
  end if;
  return v;
end $$;

create or replace function public.kids_t_feedback(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'body', f.body, 'status', f.status, 'reply', f.reply,
      'at', f.created_at, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name) order by f.created_at desc)
    from (select * from public.kids_feedback order by created_at desc limit 200) f join public.kids_children c on c.id = f.child_id), '[]'::jsonb);
end $$;

create or replace function public.kids_t_feedback_set(p_token text, p_id bigint, p_status text, p_reply text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  if coalesce(p_status, '') not in ('new', 'seen', 'done') then raise exception 'BAD_KIND'; end if;
  if char_length(coalesce(v_reply, '')) > 300 then raise exception 'TOO_LONG'; end if;
  update public.kids_feedback set status = p_status,
    reply = case when p_reply is null then reply else v_reply end,
    replied_at = case when p_reply is not null and v_reply is not null and v_reply is distinct from reply then now() else replied_at end,
    reply_seen = case when p_reply is not null and v_reply is not null and v_reply is distinct from reply then false else reply_seen end
   where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.kids_feedback_send(text, text, text) to anon, authenticated;
grant execute on function public.kids_feedback_mine(text, boolean) to anon, authenticated;
grant execute on function public.kids_t_feedback(text) to anon, authenticated;
grant execute on function public.kids_t_feedback_set(text, bigint, text, text) to anon, authenticated;

-- 화면이 서버에 어떤 기능이 있는지 묻는다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true)
$$;
