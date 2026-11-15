-- 진숲 어린이 마을: 숨바꼭질 섬 (마을 섬 북쪽, 나무 다리로 이어진다)
-- 숨바꼭질은 친구 화면끼리 실시간 메시지로 하고, 서버는 이긴 아이에게 열매를 준다.
-- 이기면 열매 1개, 하루(한국 시각) 3개까지. 그날 말씀 활동을 마쳐야 하고(놀이 마당과 같다), 이긴 기록은 25초에 한 번만 받는다.
-- 술래가 모두 찾으면 술래가, 시간이 다 되거나 술래가 '못 찾겠다 꾀꼬리'를 외치면 끝까지 숨은 아이가 이긴다. 다시 실행해도 된다.

create table if not exists public.kids_hs_wins (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  role text not null check (role in ('seek', 'hide')),
  got boolean not null default false,
  won_at timestamptz not null default now());
create index if not exists kids_hs_wins_child_idx on public.kids_hs_wins (child_id, won_at);
alter table public.kids_hs_wins enable row level security;
revoke all on public.kids_hs_wins from anon, authenticated;

-- 이겼다: 오늘 받은 열매가 3개보다 적으면 1개를 준다 (got). today는 오늘 받은 개수
create or replace function public.kids_hs_win(p_token text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_n int; v_all int; v_got boolean := false; v_fruits int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if p_role is null or p_role not in ('seek', 'hide') then raise exception 'BAD_KIND'; end if;
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_hs:' || v_id::text));
  if exists (select 1 from public.kids_hs_wins where child_id = v_id and won_at > now() - interval '25 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) filter (where got), count(*) into v_n, v_all from public.kids_hs_wins where child_id = v_id and won_at >= v_start;
  if v_all >= 100 then raise exception 'HS_DAY'; end if;
  if v_n < 3 then
    v_got := true;
    update public.kids_children set fruits = fruits + 1 where id = v_id;
  end if;
  insert into public.kids_hs_wins (child_id, role, got) values (v_id, p_role, v_got);
  select fruits into v_fruits from public.kids_children where id = v_id;
  return jsonb_build_object('got', v_got, 'today', v_n + case when v_got then 1 else 0 end, 'max', 3, 'fruits', v_fruits);
end $$;
revoke all on function public.kids_hs_win(text, text) from public;
grant execute on function public.kids_hs_win(text, text) to anon, authenticated;

-- 기능 목록: hide(숨바꼭질 섬)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true)
$$;
