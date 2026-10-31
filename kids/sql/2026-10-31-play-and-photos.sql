-- 진숲 어린이 마을: 필사 사진, 그림 공방, 낚시, 요리
-- 모든 테이블은 직접 접근을 막고(RLS, 권한 없음) SECURITY DEFINER 함수로만 읽고 쓴다.

-- ---------- 공통: 그림 파일 확인 ----------
create or replace function public.kids__image(p text, p_max int) returns bytea
language plpgsql immutable set search_path = '' as $$
declare b bytea;
begin
  if p is null or p = '' then return null; end if;
  begin
    b := decode(p, 'base64');
  exception when others then
    raise exception 'BAD_IMAGE';
  end;
  if octet_length(b) > p_max then raise exception 'IMAGE_TOO_BIG'; end if;
  if substring(b from 1 for 3) <> '\xffd8ff'::bytea then raise exception 'BAD_IMAGE'; end if; -- JPEG만
  return b;
end $$;

create or replace function public.kids__b64(b bytea) returns text
language sql immutable set search_path = '' as $$
  select case when b is null then null else replace(encode(b, 'base64'), E'\n', '') end
$$;

-- ---------- 필사 사진 ----------
alter table public.kids_copy_entries
  add column if not exists photo bytea,
  add column if not exists photo_thumb bytea,
  add column if not exists photo_ok boolean not null default false,
  add column if not exists photo_at timestamptz;

create or replace function public.kids_copy_photo(p_token text, p_week date, p_photo text, p_thumb text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_gain int := 0; v_fruits int;
        v_photo bytea; v_thumb bytea;
begin
  if not exists (select 1 from public.kids_weeks where week_start = p_week and is_published and copy_ref <> ''
                 and week_start <= public.kids__today()) then
    raise exception 'NOT_FOUND';
  end if;
  v_photo := public.kids__image(p_photo, 450000);
  v_thumb := public.kids__image(p_thumb, 40000);
  if v_photo is null or v_thumb is null then raise exception 'BAD_IMAGE'; end if;
  if not exists (select 1 from public.kids_copy_entries where child_id = v_id and week_start = p_week) then v_gain := 2; end if;
  insert into public.kids_copy_entries as e (child_id, week_start, note, shared, photo, photo_thumb, photo_ok, photo_at)
  values (v_id, p_week, '', true, v_photo, v_thumb, false, now())
  on conflict (child_id, week_start) do update
    set photo = excluded.photo, photo_thumb = excluded.photo_thumb, photo_ok = false, photo_at = now(), updated_at = now();
  update public.kids_children set fruits = fruits + v_gain where id = v_id returning fruits into v_fruits;
  return jsonb_build_object('gained', v_gain, 'fruits', v_fruits);
end $$;

create or replace function public.kids_copy_photo_delete(p_token text, p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  update public.kids_copy_entries set photo = null, photo_thumb = null, photo_ok = false, photo_at = null, updated_at = now()
   where child_id = v_id and week_start = p_week;
  return jsonb_build_object('ok', true);
end $$;

-- 사진 크게 보기: 내 사진이거나, 선생님이 확인했고 친구들에게 보이기로 한 사진만
create or replace function public.kids_copy_photo_get(p_token text, p_week date, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_b bytea;
begin
  select e.photo into v_b from public.kids_copy_entries e
   where e.child_id = p_child and e.week_start = p_week and e.photo is not null
     and (e.child_id = v_id or (e.photo_ok and e.shared and not e.hidden));
  if v_b is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('photo', public.kids__b64(v_b));
end $$;

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
              'has_photo', e.photo is not null, 'photo_ok', e.photo_ok, 'thumb', public.kids__b64(e.photo_thumb)) end,
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

-- ---------- 그림 공방 ----------
create table if not exists public.kids_art (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.kids_children(id) on delete cascade,
  title text not null default '',
  image bytea not null,
  thumb bytea not null,
  shared boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kids_art_created_idx on public.kids_art (created_at desc);
create index if not exists kids_art_child_idx on public.kids_art (child_id, created_at desc);
alter table public.kids_art enable row level security;
revoke all on public.kids_art from public, anon, authenticated;

create or replace function public.kids_art_save(p_token text, p_title text, p_image text, p_thumb text, p_shared boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_title text := btrim(coalesce(p_title, ''));
        v_img bytea; v_th bytea; v_new uuid;
begin
  if char_length(v_title) > 20 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from public.kids_art where child_id = v_id) >= 40 then raise exception 'ART_FULL'; end if;
  if (select count(*) from public.kids_art where child_id = v_id
       and created_at >= (public.kids__today()::timestamp at time zone 'Asia/Seoul')) >= 10 then raise exception 'ART_DAY'; end if;
  v_img := public.kids__image(p_image, 320000);
  v_th := public.kids__image(p_thumb, 30000);
  if v_img is null or v_th is null then raise exception 'BAD_IMAGE'; end if;
  insert into public.kids_art (child_id, title, image, thumb, shared) values (v_id, v_title, v_img, v_th, coalesce(p_shared, true))
  returning id into v_new;
  return jsonb_build_object('id', v_new);
end $$;

-- p_mine: 내 그림 모두 / 아니면 마을 전시관(보이기로 한 그림, 최근 40장)
create or replace function public.kids_art_list(p_token text, p_mine boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'child', c.id, 'name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id,
      'title', a.title, 'at', a.created_at, 'thumb', public.kids__b64(a.thumb),
      'shared', a.shared, 'hidden', case when c.id = v_id then a.hidden else false end,
      'reactions', public.kids__reactions('art', a.id::text, c.id, v_id)) order by a.created_at desc)
    from (select * from public.kids_art x
           where (p_mine and x.child_id = v_id) or (not p_mine and x.shared and not x.hidden)
           order by x.created_at desc limit 40) a
    join public.kids_children c on c.id = a.child_id
    where c.village_name is not null), '[]'::jsonb);
end $$;

create or replace function public.kids_art_get(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_b bytea;
begin
  select a.image into v_b from public.kids_art a where a.id = p_id and (a.child_id = v_id or (a.shared and not a.hidden));
  if v_b is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('image', public.kids__b64(v_b));
end $$;

create or replace function public.kids_art_update(p_token text, p_id uuid, p_shared boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  update public.kids_art set shared = coalesce(p_shared, shared) where id = p_id and child_id = v_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.kids_art_delete(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  delete from public.kids_art where id = p_id and child_id = v_id;
  delete from public.kids_reactions where kind = 'art' and target_key = p_id::text;
  return jsonb_build_object('ok', true);
end $$;

-- 마을 액자에 걸 그림 3장 (작은 그림만)
create or replace function public.kids_art_wall(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', c.village_name, 'title', a.title,
      'thumb', public.kids__b64(a.thumb)) order by a.created_at desc)
    from (select * from public.kids_art x where x.shared and not x.hidden order by x.created_at desc limit 3) a
    join public.kids_children c on c.id = a.child_id), '[]'::jsonb);
end $$;

-- 응원: 그림에도
alter table public.kids_reactions drop constraint if exists kids_reactions_kind_check;
alter table public.kids_reactions add constraint kids_reactions_kind_check check (kind in ('memory', 'qt', 'copy', 'art'));

create or replace function public.kids_react(p_token text, p_kind text, p_target uuid, p_key text, p_reaction text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_kind not in ('memory', 'qt', 'copy', 'art') or p_reaction not in ('clap', 'heart', 'pray', 'metoo') then raise exception 'BAD_REACTION'; end if;
  if p_target = v_id then raise exception 'SELF_REACTION'; end if;
  if (p_kind = 'memory' and not exists (select 1 from public.kids_memory where child_id = p_target and verse_id::text = p_key))
     or (p_kind = 'qt' and not exists (select 1 from public.kids_qt_entries where child_id = p_target and day::text = p_key))
     or (p_kind = 'copy' and not exists (select 1 from public.kids_copy_entries where child_id = p_target and week_start::text = p_key))
     or (p_kind = 'art' and not exists (select 1 from public.kids_art where child_id = p_target and id::text = p_key and shared and not hidden)) then
    raise exception 'NOT_FOUND';
  end if;
  if p_on then
    insert into public.kids_reactions (kind, target_child, target_key, from_child, reaction)
    values (p_kind, p_target, p_key, v_id, p_reaction) on conflict do nothing;
  else
    delete from public.kids_reactions where kind = p_kind and target_child = p_target and target_key = p_key
      and from_child = v_id and reaction = p_reaction;
  end if;
  return public.kids__reactions(p_kind, p_key, p_target, v_id);
end $$;

-- ---------- 낚시 ----------
create table if not exists public.kids_fish_kinds (
  id text primary key,
  name text not null,
  weight int not null,
  min_cm numeric(5,1) not null,
  max_cm numeric(5,1) not null,
  rarity int not null, -- -1 물건, 0 흔함, 1 가끔, 2 드묾, 3 아주 드묾
  sort int not null
);
alter table public.kids_fish_kinds enable row level security;
revoke all on public.kids_fish_kinds from public, anon, authenticated;
insert into public.kids_fish_kinds (id, name, weight, min_cm, max_cm, rarity, sort) values
  ('medaka', '송사리', 22, 2, 4, 0, 1),
  ('minnow', '피라미', 20, 8, 15, 0, 2),
  ('crucian', '붕어', 18, 10, 30, 0, 3),
  ('loach', '미꾸라지', 14, 10, 20, 0, 4),
  ('smelt', '빙어', 10, 8, 15, 1, 5),
  ('carp', '잉어', 8, 30, 70, 1, 6),
  ('catfish', '메기', 6, 30, 60, 1, 7),
  ('trout', '무지개송어', 5, 25, 50, 2, 8),
  ('mandarin', '쏘가리', 3, 20, 45, 2, 9),
  ('goldfish', '금붕어', 3, 5, 15, 2, 10),
  ('golden', '황금잉어', 1, 40, 70, 3, 11),
  ('boot', '낡은 장화', 6, 0, 0, -1, 12),
  ('can', '빈 깡통', 5, 0, 0, -1, 13)
on conflict (id) do update set name = excluded.name, weight = excluded.weight, min_cm = excluded.min_cm,
  max_cm = excluded.max_cm, rarity = excluded.rarity, sort = excluded.sort;

create table if not exists public.kids_fish (
  id bigserial primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  fish text not null references public.kids_fish_kinds(id),
  size_cm numeric(5,1) not null,
  caught_at timestamptz not null default now()
);
create index if not exists kids_fish_child_idx on public.kids_fish (child_id, caught_at desc);
create index if not exists kids_fish_time_idx on public.kids_fish (caught_at desc);
alter table public.kids_fish enable row level security;
revoke all on public.kids_fish from public, anon, authenticated;

create or replace function public.kids_fish_catch(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_r numeric; v_acc int := 0; v_total int;
        k public.kids_fish_kinds; v_size numeric(5,1); v_first boolean; v_best boolean; v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if exists (select 1 from public.kids_fish where child_id = v_id and caught_at > now() - interval '3 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_today from public.kids_fish where child_id = v_id and caught_at >= v_start;
  if v_today >= 80 then raise exception 'FISH_TIRED'; end if;
  select sum(weight) into v_total from public.kids_fish_kinds;
  v_r := floor(random() * v_total);
  for k in select * from public.kids_fish_kinds order by sort loop
    v_acc := v_acc + k.weight;
    exit when v_r < v_acc;
  end loop;
  v_size := case when k.rarity < 0 then 0 else round((k.min_cm + random() * (k.max_cm - k.min_cm))::numeric, 1) end;
  v_first := not exists (select 1 from public.kids_fish where child_id = v_id and fish = k.id);
  v_best := k.rarity >= 0 and not v_first and v_size > (select max(size_cm) from public.kids_fish where child_id = v_id and fish = k.id);
  insert into public.kids_fish (child_id, fish, size_cm) values (v_id, k.id, v_size);
  return jsonb_build_object('fish', k.id, 'name', k.name, 'rarity', k.rarity, 'size', v_size,
    'first', v_first, 'best', v_best, 'today', v_today + 1);
end $$;

create or replace function public.kids_fish_book(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  return jsonb_build_object(
    'mine', coalesce((select jsonb_object_agg(f.fish, jsonb_build_object('count', f.n, 'best', f.best))
      from (select fish, count(*) n, max(size_cm) best from public.kids_fish where child_id = v_id group by fish) f), '{}'::jsonb),
    'today_top', coalesce((select jsonb_agg(t) from (
      select jsonb_build_object('name', c.village_name, 'avatar', c.avatar, 'me', c.id = v_id, 'fish', x.fish,
               'size', x.size_cm, 'at', x.caught_at) t
        from public.kids_fish x join public.kids_children c on c.id = x.child_id join public.kids_fish_kinds k on k.id = x.fish
       where x.caught_at >= v_start and k.rarity >= 0 and c.village_name is not null
       order by x.size_cm desc, x.caught_at limit 5) s), '[]'::jsonb),
    'my_today', (select count(*) from public.kids_fish where child_id = v_id and caught_at >= v_start));
end $$;

-- ---------- 요리 ----------
create table if not exists public.kids_cook (
  child_id uuid not null references public.kids_children(id) on delete cascade,
  recipe text not null check (recipe in ('manna', 'lentil', 'fishbread', 'barley', 'matzah')),
  best_stars int not null default 0 check (best_stars between 0 and 3),
  times int not null default 0,
  with_friend int not null default 0,
  last_at timestamptz not null default now(),
  primary key (child_id, recipe)
);
alter table public.kids_cook enable row level security;
revoke all on public.kids_cook from public, anon, authenticated;

create or replace function public.kids_cook_book(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return coalesce((select jsonb_object_agg(recipe, jsonb_build_object('stars', best_stars, 'times', times, 'with_friend', with_friend))
    from public.kids_cook where child_id = v_id), '{}'::jsonb);
end $$;

create or replace function public.kids_cook_done(p_token text, p_recipe text, p_stars int, p_together boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if p_recipe not in ('manna', 'lentil', 'fishbread', 'barley', 'matzah') then raise exception 'NOT_FOUND'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 3 then raise exception 'BAD_STARS'; end if;
  if exists (select 1 from public.kids_cook where child_id = v_id and last_at > now() - interval '8 seconds') then raise exception 'TOO_FAST'; end if;
  insert into public.kids_cook (child_id, recipe, best_stars, times, with_friend, last_at)
  values (v_id, p_recipe, p_stars, 1, case when p_together then 1 else 0 end, now())
  on conflict (child_id, recipe) do update set best_stars = greatest(public.kids_cook.best_stars, excluded.best_stars),
    times = public.kids_cook.times + 1, with_friend = public.kids_cook.with_friend + excluded.with_friend, last_at = now();
  return public.kids_cook_book(p_token);
end $$;

-- ---------- 선생님 화면 ----------
create or replace function public.kids_t_posts(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return coalesce((select jsonb_agg(p order by (p->>'at') desc) from (
      select jsonb_build_object('kind', 'qt', 'key', e.day::text, 'child_id', c.id, 'name', c.real_name, 'village_name', c.village_name,
        'label', q.ref, 'text', e.answer, 'shared', e.shared, 'hidden', e.hidden, 'at', e.updated_at) as p
        from public.kids_qt_entries e join public.kids_children c on c.id = e.child_id join public.kids_qt q on q.day = e.day
       where e.updated_at > now() - interval '60 days'
      union all
      select jsonb_build_object('kind', 'copy', 'key', e.week_start::text, 'child_id', c.id, 'name', c.real_name, 'village_name', c.village_name,
        'label', w.copy_ref, 'text', e.note, 'shared', e.shared, 'hidden', e.hidden, 'at', e.updated_at,
        'has_photo', e.photo is not null, 'photo_ok', e.photo_ok, 'thumb', public.kids__b64(e.photo_thumb))
        from public.kids_copy_entries e join public.kids_children c on c.id = e.child_id join public.kids_weeks w on w.week_start = e.week_start
       where e.updated_at > now() - interval '60 days' and (e.note <> '' or e.photo is not null)
      union all
      select jsonb_build_object('kind', 'art', 'key', a.id::text, 'child_id', c.id, 'name', c.real_name, 'village_name', c.village_name,
        'label', coalesce(nullif(a.title, ''), '제목 없는 그림'), 'text', null, 'shared', a.shared, 'hidden', a.hidden, 'at', a.created_at,
        'thumb', public.kids__b64(a.thumb))
        from public.kids_art a join public.kids_children c on c.id = a.child_id
       where a.created_at > now() - interval '60 days'
    ) s limit 300), '[]'::jsonb);
end $$;

create or replace function public.kids_t_hide_post(p_token text, p_kind text, p_child uuid, p_key text, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  if p_kind = 'qt' then
    update public.kids_qt_entries set hidden = p_hidden where child_id = p_child and day::text = p_key;
  elsif p_kind = 'copy' then
    update public.kids_copy_entries set hidden = p_hidden where child_id = p_child and week_start::text = p_key;
  elsif p_kind = 'art' then
    update public.kids_art set hidden = p_hidden where child_id = p_child and id::text = p_key;
  else
    raise exception 'BAD_KIND';
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.kids_t_photo_ok(p_token text, p_child uuid, p_week date, p_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  update public.kids_copy_entries set photo_ok = coalesce(p_ok, false) where child_id = p_child and week_start = p_week and photo is not null;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.kids_t_image(p_token text, p_kind text, p_child uuid, p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_b bytea;
begin
  if p_kind = 'copy' then
    select photo into v_b from public.kids_copy_entries where child_id = p_child and week_start::text = p_key;
  elsif p_kind = 'art' then
    select image into v_b from public.kids_art where child_id = p_child and id::text = p_key;
  end if;
  if v_b is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('image', public.kids__b64(v_b));
end $$;

create or replace function public.kids_t_storage(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'photos', (select count(*) from public.kids_copy_entries where photo is not null),
    'drawings', (select count(*) from public.kids_art),
    'bytes', coalesce((select sum(octet_length(photo) + octet_length(photo_thumb)) from public.kids_copy_entries where photo is not null), 0)
           + coalesce((select sum(octet_length(image) + octet_length(thumb)) from public.kids_art), 0),
    'db_bytes', pg_database_size(current_database()));
end $$;

-- 도우미 함수는 바깥에서 부를 수 없게
revoke all on function public.kids__image(text, int) from public, anon, authenticated;
revoke all on function public.kids__b64(bytea) from public, anon, authenticated;
