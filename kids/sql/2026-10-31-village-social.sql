-- 진숲 어린이 마을: 마을 식탁(마음대로 요리), 그림 댓글, 둘이 대화(귓속말)
-- 2026-10-31-free-cook.sql의 내용을 함께 담았다 (이미 넣었어도 다시 실행해도 된다).

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

create or replace function public.kids_t_dish_hide(p_token text, p_id bigint, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  update public.kids_dishes set hidden = coalesce(p_hidden, false) where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return public.kids_t_village(p_token);
end $$;

-- ---------- 둘이 대화: 글 대화 기록에 받는 아이를 함께 남긴다 (선생님 화면에서 볼 수 있다) ----------
alter table public.kids_chat add column if not exists to_child uuid references public.kids_children(id) on delete cascade;

create or replace function public.kids_dm_send(p_token text, p_to uuid, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_t text; v_n int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids_chat_open() then raise exception 'CHAT_OFF'; end if;
  if (select chat_muted from public.kids_children where id = v_id) then raise exception 'CHAT_MUTED'; end if;
  if p_to is null or p_to = v_id or not exists (select 1 from public.kids_children where id = p_to) then raise exception 'NOT_FOUND'; end if;
  v_t := public.kids__chat_clean(p_text);
  if char_length(v_t) = 0 then raise exception 'EMPTY_CHAT'; end if;
  if exists (select 1 from public.kids_chat where child_id = v_id and created_at > now() - interval '1.5 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_n from public.kids_chat where child_id = v_id and created_at >= v_start;
  if v_n >= 300 then raise exception 'CHAT_TIRED'; end if;
  insert into public.kids_chat (child_id, body, masked, to_child)
  values (v_id, v_t, v_t <> left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), 60), p_to);
  delete from public.kids_chat where created_at < now() - interval '30 days';
  return jsonb_build_object('text', v_t);
end $$;

-- ---------- 그림 댓글 ----------
create table if not exists public.kids_art_comments (
  id bigint generated always as identity primary key,
  art_id uuid not null references public.kids_art(id) on delete cascade,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  body text not null,
  masked boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kids_art_comments_art on public.kids_art_comments (art_id, created_at);
create index if not exists kids_art_comments_child on public.kids_art_comments (child_id, created_at desc);
alter table public.kids_art_comments enable row level security;
revoke all on public.kids_art_comments from public, anon, authenticated;

create or replace function public.kids_art_comments(p_token text, p_art uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); a public.kids_art;
begin
  select * into a from public.kids_art where id = p_art;
  if a.id is null or (a.child_id <> v_id and (not a.shared or a.hidden)) then raise exception 'NOT_FOUND'; end if;
  return coalesce((select jsonb_agg(x order by at) from (
    select jsonb_build_object('id', m.id, 'name', c.village_name, 'body', m.body, 'me', m.child_id = v_id, 'at', m.created_at) as x, m.created_at as at
      from public.kids_art_comments m join public.kids_children c on c.id = m.child_id
     where m.art_id = p_art and not m.hidden order by m.created_at desc limit 60) s), '[]'::jsonb);
end $$;

create or replace function public.kids_art_comment_add(p_token text, p_art uuid, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_t text; v_n int; a public.kids_art;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids_chat_open() then raise exception 'CHAT_OFF'; end if;
  if (select chat_muted from public.kids_children where id = v_id) then raise exception 'CHAT_MUTED'; end if;
  select * into a from public.kids_art where id = p_art;
  if a.id is null or (a.child_id <> v_id and (not a.shared or a.hidden)) then raise exception 'NOT_FOUND'; end if;
  v_t := public.kids__chat_clean(p_text);
  if char_length(v_t) = 0 then raise exception 'EMPTY_CHAT'; end if;
  if exists (select 1 from public.kids_art_comments where child_id = v_id and created_at > now() - interval '3 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_n from public.kids_art_comments where child_id = v_id and created_at >= v_start;
  if v_n >= 100 then raise exception 'CHAT_TIRED'; end if;
  insert into public.kids_art_comments (art_id, child_id, body, masked)
  values (p_art, v_id, v_t, v_t <> left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), 60));
  return public.kids_art_comments(p_token, p_art);
end $$;

create or replace function public.kids_t_comment_hide(p_token text, p_id bigint, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  update public.kids_art_comments set hidden = coalesce(p_hidden, false) where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return public.kids_t_village(p_token);
end $$;

-- 화면이 서버에 어떤 기능이 있는지 묻는다 (없으면 그 단추를 숨긴다)
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true)
$$;

-- ---------- 선생님: 마을 설정, 대화(둘이 대화 포함), 식탁 요리, 그림 댓글 ----------
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
                 'hidden', d.hidden, 'at', d.created_at) as x, d.created_at as at
          from public.kids_dishes d join public.kids_children c on c.id = d.child_id
         order by d.created_at desc limit 60) s), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'art_title', a.title, 'art_owner', o.village_name, 'body', m.body, 'masked', m.masked, 'hidden', m.hidden,
                 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_art_comments m join public.kids_children c on c.id = m.child_id
          join public.kids_art a on a.id = m.art_id join public.kids_children o on o.id = a.child_id
         order by m.created_at desc limit 100) s), '[]'::jsonb));
end $$;
