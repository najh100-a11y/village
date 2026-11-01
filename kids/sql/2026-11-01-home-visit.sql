-- 진숲 어린이 마을: 친구 집에 놀러 가기
-- 다시 실행해도 된다. 친구 집은 구경만 한다(꾸미기, 물 주기, 거두기는 주인만 kids_home_save로 한다).
-- 집 안에서 누가 어디 있는지는 서버에 남기지 않고 실시간 메시지('hm')로만 주고받는다.

-- 마을 친구(이름과 주민이 있는 아이) 집의 배치를 본다
create or replace function public.kids_home_visit(p_token text, p_child uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_name text;
begin
  select village_name into v_name from public.kids_children
   where id = p_child and village_name is not null and avatar is not null;
  if v_name is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('name', v_name,
    'layout', coalesce((select layout from public.kids_homes where child_id = p_child), '[]'::jsonb));
end $$;
revoke all on function public.kids_home_visit(text, uuid) from public;
grant execute on function public.kids_home_visit(text, uuid) to anon, authenticated;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true)
$$;
