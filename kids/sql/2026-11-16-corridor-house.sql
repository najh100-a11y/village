-- 진숲 어린이 마을: 복도 있는 집 (집 넓히기 방 자리가 바뀐다)
-- 전에는 지은 방이 지은 차례대로 내 방 왼쪽(서쪽)에 한 줄로 붙었다(방 하나 가로 8, z -10~-4).
-- 이제는 방마다 자리가 정해져 있다. 앞줄(z -10~-4)은 동쪽부터 내 방, 거실(x -18~-10), 복도(x -20~-18), 주방(x -28~-20)이고,
-- 뒷줄(z -16~-10)은 방 2(x -18~-10)와 방 3(x -28~-20)이다. 그래서 집 땅이 뒤로 z -17까지 넓어진다.
-- 이미 방을 지은 집은 그 방에 놓았던 가구를 방과 함께 새 자리로 옮긴다(한 번만. kids_homes.plan이 1인 집).
-- 새 자리에서 복도 문 앞 칸에 걸리는 가구는 집 주인이 들어올 때 앱이 같은 방 가까운 빈자리로 옮긴다.
-- 저장은 새 앱만 한다(p_plan 2). 옛 앱이 열려 있던 아이는 화면을 새로 고치면 된다. 다시 실행해도 된다.

-- 집 모양 차례: 1 한 줄로 붙는 집(옛), 2 복도 있는 집. 있던 집은 1, 앞으로 생기는 집은 2
alter table public.kids_homes add column if not exists plan smallint not null default 1;
alter table public.kids_homes alter column plan set default 2;

-- 옛 자리의 가구를 새 자리로: 지은 차례 i(1부터)인 방의 옛 자리는 x -10-8i ~ -10-8(i-1), z -10 ~ -4
update public.kids_homes h set plan = 2, layout = coalesce((
  select jsonb_agg(case when s.x0 is null then e.v
           else e.v || jsonb_build_object('x', (e.v->>'x')::numeric - s.old_x0 + s.x0, 'z', (e.v->>'z')::numeric + 10 + s.z0) end order by e.n)
    from jsonb_array_elements(coalesce(h.layout, '[]'::jsonb)) with ordinality e(v, n)
    left join lateral (
      select -10 - 8 * r.i as old_x0, p.x0, p.z0
        from jsonb_array_elements_text(coalesce(h.rooms, '[]'::jsonb)) with ordinality r(id, i)
        join (values ('living', -18, -10), ('kitchen', -28, -10), ('room2', -18, -16), ('room3', -28, -16)) p(id, x0, z0) on p.id = r.id
       where jsonb_typeof(e.v->'x') = 'number' and jsonb_typeof(e.v->'z') = 'number'
         and (e.v->>'x')::numeric >= -10 - 8 * r.i and (e.v->>'x')::numeric < -10 - 8 * (r.i - 1)
         and (e.v->>'z')::numeric >= -10 and (e.v->>'z')::numeric < -4
       limit 1) s on true), '[]'::jsonb)
 where h.plan = 1;

-- 집 저장: 뒤로 넓어진 땅(z -17까지)을 받는다. p_plan은 앱이 아는 집 모양 차례 (옛 앱은 보내지 않는다)
drop function if exists public.kids_home_save(text, jsonb, jsonb);
create or replace function public.kids_home_save(p_token text, p_layout jsonb, p_harvest jsonb default '[]'::jsonb, p_plan int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_old jsonb; e jsonb; o jsonb; v_new jsonb := '[]'::jsonb; v_now bigint := public.kids__now_ms();
begin
  if p_plan is null or p_plan < 2 then raise exception 'OLD_APP'; end if;
  if p_layout is null or jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 150 or length(p_layout::text) > 40000 then
    raise exception 'BAD_HOME';
  end if;
  for e in select * from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string' or length(e->>'id') > 24
       or (e->>'k') is null or (e->>'k') not in ('h_bed', 'h_desk', 'h_chair', 'h_sofa', 'h_shelf', 'h_table', 'h_rug', 'h_lamp', 'h_pot', 'h_toys', 'h_piano', 'h_bunk', 'h_drawer', 'h_dresser', 'h_globe', 'h_bigsofa', 'h_coffee', 'h_tv', 'h_fishtank', 'h_clock', 'h_rocking', 'h_beanbag', 'h_bigrug', 'h_tallplant', 'h_fireplace', 'h_dtable', 'h_fridge', 'h_sink', 'h_cupboard', 'h_oven', 'y_bench', 'y_lamp', 'y_swing', 'y_fountain', 'y_birdhouse', 'y_picnic', 'y_tree', 'y_slide', 'y_mailbox', 's_carrot', 's_tomato', 's_cabbage', 's_strawberry', 's_sunflower', 's_tulip')
       or jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'z') <> 'number'
       or (e->>'x')::numeric not between -44 and 12 or (e->>'z')::numeric not between -17 and 12
       or (e->'r' is not null and (jsonb_typeof(e->'r') <> 'number' or (e->>'r')::numeric not in (0, 1, 2, 3))) then
      raise exception 'BAD_HOME';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_layout) a) <> (select count(distinct a->>'id') from jsonb_array_elements(p_layout) a) then
    raise exception 'BAD_HOME';
  end if;
  if exists (
    select 1 from (select a->>'k' k, count(*) n from jsonb_array_elements(p_layout) a group by 1) u
    where u.n > coalesce((select count from public.kids_items i where i.child_id = v_id and i.item = u.k), 0)) then
    raise exception 'NOT_ENOUGH';
  end if;
  select layout into v_old from public.kids_homes where child_id = v_id for update;
  v_old := coalesce(v_old, '[]'::jsonb);
  for e in select * from jsonb_array_elements(p_layout) loop
    e := e - 't' - 'g' - 'w' - 'n';
    if left(e->>'k', 2) = 's_' then
      select a into o from jsonb_array_elements(v_old) a where a->>'id' = e->>'id' and a->>'k' = e->>'k' limit 1;
      if o is not null then
        e := e || jsonb_strip_nulls(jsonb_build_object('t', o->'t', 'g', o->'g', 'w', o->'w', 'n', o->'n'));
      else
        e := e || jsonb_build_object('t', v_now);
      end if;
      o := null;
    end if;
    v_new := v_new || jsonb_build_array(e);
  end loop;
  insert into public.kids_homes (child_id, layout, updated_at) values (v_id, v_new, now())
    on conflict (child_id) do update set layout = excluded.layout, updated_at = now();
  return jsonb_build_object('ok', true, 'items', public.kids__home_items(v_id), 'plants', public.kids__plants(v_new), 'now', v_now);
end $$;
revoke all on function public.kids_home_save(text, jsonb, jsonb, int) from public;
grant execute on function public.kids_home_save(text, jsonb, jsonb, int) to anon, authenticated;
