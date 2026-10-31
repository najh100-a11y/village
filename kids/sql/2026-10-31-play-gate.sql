-- 진숲 어린이 마을: 놀이 마당 잠금 (그날 암송·묵상·필사 가운데 하나라도 해야 놀이를 할 수 있다)

create or replace function public.kids__cleared_today(p_child uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.kids_memory m where m.child_id = p_child and m.last_practiced_on = public.kids__today())
      or exists (select 1 from public.kids_qt_entries q where q.child_id = p_child
                  and (q.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                  and (c.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())
$$;
revoke all on function public.kids__cleared_today(uuid) from public, anon, authenticated;

create or replace function public.kids_today(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_today date := public.kids__today();
        v_week date := public.kids__week_of(v_today); v_verse uuid := public.kids__current_verse();
        w public.kids_weeks; q public.kids_qt;
begin
  select * into w from public.kids_weeks where week_start = v_week and is_published;
  if found then select * into q from public.kids_qt where day = v_today; end if;
  return jsonb_build_object(
    'today', v_today,
    'theme', w.theme,
    'cleared', public.kids__cleared_today(v_id),
    'verse', (select jsonb_build_object('id', v.id, 'ref', v.ref,
                'practiced', exists (select 1 from public.kids_memory m where m.child_id = v_id and m.verse_id = v.id and m.practice_count > 0))
              from public.kids_verses v where v.id = v_verse),
    'qt', case when q.day is null then null else jsonb_build_object('day', q.day, 'title', q.title, 'ref', q.ref,
            'done', exists (select 1 from public.kids_qt_entries e where e.child_id = v_id and e.day = q.day)) end,
    'copy', case when w.week_start is null or w.copy_ref = '' then null else jsonb_build_object('week', w.week_start, 'ref', w.copy_ref,
            'done', exists (select 1 from public.kids_copy_entries e where e.child_id = v_id and e.week_start = w.week_start)) end,
    'next_start', (select min(week_start) from public.kids_weeks where is_published and week_start > v_week));
end $$;

create or replace function public.kids_fish_catch(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_r numeric; v_acc int := 0; v_total int;
        k public.kids_fish_kinds; v_size numeric(5,1); v_first boolean; v_best boolean; v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
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

create or replace function public.kids_art_save(p_token text, p_title text, p_image text, p_thumb text, p_shared boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_title text := btrim(coalesce(p_title, ''));
        v_img bytea; v_th bytea; v_new uuid;
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
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

create or replace function public.kids_cook_done(p_token text, p_recipe text, p_stars int, p_together boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if p_recipe not in ('manna', 'lentil', 'fishbread', 'barley', 'matzah') then raise exception 'NOT_FOUND'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 3 then raise exception 'BAD_STARS'; end if;
  if exists (select 1 from public.kids_cook where child_id = v_id and last_at > now() - interval '8 seconds') then raise exception 'TOO_FAST'; end if;
  insert into public.kids_cook (child_id, recipe, best_stars, times, with_friend, last_at)
  values (v_id, p_recipe, p_stars, 1, case when p_together then 1 else 0 end, now())
  on conflict (child_id, recipe) do update set best_stars = greatest(public.kids_cook.best_stars, excluded.best_stars),
    times = public.kids_cook.times + 1, with_friend = public.kids_cook.with_friend + excluded.with_friend, last_at = now();
  return public.kids_cook_book(p_token);
end $$;
