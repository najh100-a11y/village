-- 진숲 어린이 마을: 물고기·곤충 팔기를 묶음으로 (흔한 것 10마리에 열매 1개)
-- 다시 실행해도 된다. 묶음 크기는 js/economy.js의 SELL_BUNDLE과 같다.

-- 열매 1개가 되는 마릿수: 흔함 10, 가끔 5, 드묾 2, 아주 드묾 1 (팔 수 없는 것은 null)
create or replace function public.kids__sell_bundle(p_kind text, p_item text)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case p_item when 'cabbage_white' then 10 when 'swallowtail' then 5 when 'honeybee' then 10 when 'ladybug' then 10 when 'grasshopper' then 10
      when 'red_dragonfly' then 10 when 'mantis' then 5 when 'cicada' then 5 when 'stag_beetle' then 2 when 'rhino_beetle' then 2 when 'firefly' then 2 else null end
    else null end
$$;
revoke all on function public.kids__sell_bundle(text, text) from public, anon, authenticated;

-- 가방에 있는(아직 팔지 않은) 물고기와 곤충, 묶음 크기, 오늘 팔아서 받은 열매와 하루 한도
create or replace function public.kids__sell_info(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fish', coalesce((select jsonb_object_agg(s.fish, s.n) from (select x.fish, count(*) n from public.kids_fish x join public.kids_fish_kinds k on k.id = x.fish
        where x.child_id = p_child and x.sold_at is null and k.rarity >= 0 group by x.fish) s), '{}'::jsonb),
    'bugs', coalesce((select jsonb_object_agg(s.bug, s.n) from (select bug, count(*) n from public.kids_bugs
        where child_id = p_child and sold_at is null group by bug) s), '{}'::jsonb),
    'bundle', jsonb_build_object(
      'fish', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('fish', k.id)) from public.kids_fish_kinds k where k.rarity >= 0), '{}'::jsonb),
      'bug', jsonb_build_object('cabbage_white', 10, 'swallowtail', 5, 'honeybee', 10, 'ladybug', 10, 'grasshopper', 10, 'red_dragonfly', 10,
        'mantis', 5, 'cicada', 5, 'stag_beetle', 2, 'rhino_beetle', 2, 'firefly', 2)),
    'today', coalesce((select sum(fruits) from public.kids_sell_log
        where child_id = p_child and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0),
    'cap', public.kids__sell_day())
$$;
revoke all on function public.kids__sell_info(uuid) from public, anon, authenticated;

-- 묶음으로 팔기: p_bundles 묶음(= 받을 열매 수). 가장 먼저 잡은 것부터 판다
create or replace function public.kids_sell_bundle(p_token text, p_kind text, p_item text, p_bundles int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_size int := public.kids__sell_bundle(p_kind, p_item); v_k int := coalesce(p_bundles, 1);
        v_cap int := public.kids__sell_day(); v_today int; v_got int; v_n int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if v_size is null or v_k < 1 or v_k > 30 then raise exception 'BAD_ITEM'; end if;
  if v_cap <= 0 then raise exception 'SELL_CLOSED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_sell:' || v_id::text));
  select coalesce(sum(fruits), 0) into v_today from public.kids_sell_log where child_id = v_id and created_at >= v_start;
  if v_today + v_k > v_cap then raise exception 'SELL_DAY'; end if;
  v_n := v_size * v_k;
  if p_kind = 'fish' then
    with s as (select id from public.kids_fish where child_id = v_id and fish = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_fish f set sold_at = now() from s where f.id = s.id;
  else
    with s as (select id from public.kids_bugs where child_id = v_id and bug = p_item and sold_at is null order by caught_at, id limit v_n for update)
    update public.kids_bugs b set sold_at = now() from s where b.id = s.id;
  end if;
  get diagnostics v_got = row_count;
  if v_got < v_n then raise exception 'NO_ITEM'; end if;
  update public.kids_children set fruits = fruits + v_k where id = v_id;
  insert into public.kids_sell_log (child_id, kind, item, n, fruits) values (v_id, p_kind, p_item, v_n, v_k);
  return public.kids_shop(p_token);
end $$;
grant execute on function public.kids_sell_bundle(text, text, text, int) to anon, authenticated;

-- 한 마리씩 값을 매기던 예전 팔기는 닫는다 (예전 화면이면 새로 고치라고 알린다)
create or replace function public.kids_sell(p_token text, p_kind text, p_item text, p_n int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'APP_OLD';
end $$;
