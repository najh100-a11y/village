-- 진숲 어린이 마을: 선생님이 자기 선생님 주민의 열매 개수를 정한다 (선생님 화면 '선생님 계정' 탭)
-- 다시 실행해도 된다.
-- 바꿀 수 있는 것은 로그인한 선생님 자신의 주민(kids_children.teacher_id)뿐이다. 아이들 열매는 바꾸지 않는다
-- (아이 열매는 지금처럼 암송·묵상·필사와 선생님 도장으로만 모인다). 0부터 9999까지 정할 수 있다.

create or replace function public.kids_t_set_my_fruits(p_token text, p_fruits integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_n integer;
begin
  if p_fruits is null or p_fruits < 0 or p_fruits > 9999 then raise exception 'BAD_FRUITS'; end if;
  update public.kids_children set fruits = p_fruits where teacher_id = v_tid returning fruits into v_n;
  if v_n is null then raise exception 'NO_RESIDENT'; end if;
  return jsonb_build_object('ok', true, 'fruits', v_n);
end $$;
revoke all on function public.kids_t_set_my_fruits(text, integer) from public;
grant execute on function public.kids_t_set_my_fruits(text, integer) to anon, authenticated;
