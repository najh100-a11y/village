-- 진숲 어린이 마을: 곤충 14가지 더하기 (모두 25가지)
-- 새 곤충: 노랑나비, 네발나비, 꽃등에, 꼬리박각시(꽃밭), 방아깨비, 귀뚜라미, 홍줄노린재, 길앞잡이(풀밭),
--          풍뎅이, 알락하늘소, 흰점박이꽃무지(나무줄기), 밀잠자리, 실잠자리, 소금쟁이(물가)
-- 곤충 목록과 드문 정도(0 흔해요, 1 가끔 보여요, 2 아주 드물어요)를 kids__bug_ids, kids__bug_rarity 한 곳에 두고
-- 잡기(kids_bug_catch), 팔기 값(kids__sell_price, kids__sell_bundle), 팔기 정보(kids__sell_info)가 이것을 쓴다.
-- 팔기 묶음은 예전과 같은 규칙이다: 흔한 곤충 10마리, 가끔 보이는 곤충 5마리, 아주 드문 곤충 2마리에 열매 1개.
-- js/bugs.js의 BUGS, js/demo.js의 BUG_KINDS·BUG_RARITY와 같은 차례다. 다시 실행해도 된다.

create or replace function public.kids__bug_ids()
returns text[] language sql immutable set search_path = '' as $$
  select array['cabbage_white', 'swallowtail', 'honeybee', 'ladybug', 'grasshopper', 'red_dragonfly', 'mantis', 'cicada', 'stag_beetle', 'rhino_beetle', 'firefly',
    'yellow_butterfly', 'comma_butterfly', 'hoverfly', 'hawkmoth', 'acrida', 'cricket', 'stinkbug', 'tiger_beetle', 'chafer', 'longhorn', 'flower_chafer',
    'skimmer', 'damselfly', 'water_strider']
$$;
revoke all on function public.kids__bug_ids() from public, anon, authenticated;

-- 없는 곤충이면 null
create or replace function public.kids__bug_rarity(p_bug text)
returns int language sql immutable set search_path = '' as $$
  select (array[0, 1, 0, 0, 0, 0, 1, 1, 2, 2, 2,
                0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 1,
                0, 1, 0])[array_position(public.kids__bug_ids(), p_bug)]
$$;
revoke all on function public.kids__bug_rarity(text) from public, anon, authenticated;

alter table public.kids_bugs drop constraint if exists kids_bugs_bug_check;
alter table public.kids_bugs add constraint kids_bugs_bug_check check (bug in ('cabbage_white', 'swallowtail', 'honeybee', 'ladybug', 'grasshopper',
  'red_dragonfly', 'mantis', 'cicada', 'stag_beetle', 'rhino_beetle', 'firefly', 'yellow_butterfly', 'comma_butterfly', 'hoverfly', 'hawkmoth', 'acrida',
  'cricket', 'stinkbug', 'tiger_beetle', 'chafer', 'longhorn', 'flower_chafer', 'skimmer', 'damselfly', 'water_strider'));

-- 곤충 잡기: 받는 곤충 목록만 바뀌었다 (나머지는 그대로)
create or replace function public.kids_bug_catch(p_token text, p_bug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_n int; v_kind int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if p_bug is null or public.kids__bug_rarity(p_bug) is null then raise exception 'BAD_BUG'; end if;
  if exists (select 1 from public.kids_bugs where child_id = v_id and caught_at > now() - interval '2 seconds') then raise exception 'TOO_FAST'; end if;
  select count(*) into v_n from public.kids_bugs where child_id = v_id and caught_at >= v_start;
  if v_n >= 60 then raise exception 'BUG_DAY'; end if;
  insert into public.kids_bugs (child_id, bug) values (v_id, p_bug);
  select count(*) into v_kind from public.kids_bugs where child_id = v_id and bug = p_bug;
  return jsonb_build_object('bug', p_bug, 'count', v_kind, 'kinds', (select count(distinct bug) from public.kids_bugs where child_id = v_id));
end $$;

-- 한 마리 값 (예전 함수. 곤충은 드문 정도로 1, 2, 3)
create or replace function public.kids__sell_price(p_kind text, p_item text)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 1 when 1 then 2 when 2 then 3 when 3 then 5 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case public.kids__bug_rarity(p_item) when 0 then 1 when 1 then 2 when 2 then 3 else null end
    else null end
$$;

-- 열매 1개가 되는 묶음 마릿수
create or replace function public.kids__sell_bundle(p_kind text, p_item text)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when p_kind = 'fish' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_fish_kinds k where k.id = p_item)
    when p_kind = 'bug' then case public.kids__bug_rarity(p_item) when 0 then 10 when 1 then 5 when 2 then 2 else null end
    when p_kind = 'treasure' then (select case k.rarity when 0 then 10 when 1 then 5 when 2 then 2 when 3 then 1 else null end from public.kids_treasure_kinds k where k.id = p_item)
    when p_kind = 'crop' then case p_item when 'carrot' then 2 when 'tomato' then 3 when 'cabbage' then 1 when 'strawberry' then 4 else null end
    else null end
$$;

-- 팔기 정보: 곤충 묶음 값을 곤충 목록에서 만든다 (나머지는 그대로)
create or replace function public.kids__sell_info(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fish', coalesce((select jsonb_object_agg(s.fish, s.n) from (select x.fish, count(*) n from public.kids_fish x join public.kids_fish_kinds k on k.id = x.fish
        where x.child_id = p_child and x.sold_at is null and k.rarity >= 0 group by x.fish) s), '{}'::jsonb),
    'bugs', coalesce((select jsonb_object_agg(s.bug, s.n) from (select bug, count(*) n from public.kids_bugs
        where child_id = p_child and sold_at is null group by bug) s), '{}'::jsonb),
    'treasures', coalesce((select jsonb_object_agg(s.item, s.n) from (select t.item, count(*) n from public.kids_treasures t join public.kids_treasure_kinds k on k.id = t.item
        where t.child_id = p_child and t.sold_at is null and k.rarity >= 0 group by t.item) s), '{}'::jsonb),
    'crops', public.kids__crops(p_child),
    'bundle', jsonb_build_object(
      'fish', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('fish', k.id)) from public.kids_fish_kinds k where k.rarity >= 0), '{}'::jsonb),
      'bug', (select jsonb_object_agg(b, public.kids__sell_bundle('bug', b)) from unnest(public.kids__bug_ids()) b),
      'treasure', coalesce((select jsonb_object_agg(k.id, public.kids__sell_bundle('treasure', k.id)) from public.kids_treasure_kinds k where k.rarity >= 0), '{}'::jsonb),
      'crop', jsonb_build_object('carrot', 2, 'tomato', 3, 'cabbage', 1, 'strawberry', 4)),
    'today', coalesce((select sum(fruits) from public.kids_sell_log
        where child_id = p_child and kind <> 'pet' and created_at >= public.kids__today()::timestamp at time zone 'Asia/Seoul'), 0),
    'cap', public.kids__sell_day(),
    'pet', 15)
$$;
