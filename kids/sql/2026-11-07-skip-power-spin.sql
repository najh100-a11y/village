-- 진숲 어린이 마을: 물수제비 힘과 스핀 (운 없이 잘 맞힐수록 많이 튄다)
-- 화면에서 힘(0~1, 막대가 오른쪽 끝까지 찼을 때 1)과 스핀(0~1, 도는 바늘이 위쪽 빨간 점에 꼭 맞으면 1, 45도 넘게 어긋나면 0)을 정해 보낸다.
-- 튄 횟수 = 힘이 0.2보다 작으면 0(바로 퐁당), 아니면 24 × (힘 - 0.2) / 0.8 × (0.15 + 0.85 × 스핀^1.2)를 반올림해 1~24번.
--   스핀이 0이면(돌이 흔들려서) 1번까지만 튄다. 운(random)은 섞지 않는다.
-- 예전 화면이 쓰는 kids_skip_throw(누른 때 하나와 운)는 그대로 둔다. 다시 실행해도 된다.

create or replace function public.kids_skip_throw2(p_token text, p_power numeric, p_spin numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_p numeric := greatest(0, least(1, coalesce(p_power, 0)));
        v_s numeric := greatest(0, least(1, coalesce(p_spin, 0)));
        v_n int; v_today int; v_best_today int; v_best int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_skip:' || v_id::text));
  if exists (select 1 from public.kids_skips where child_id = v_id and thrown_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*), coalesce(max(skips), 0) into v_today, v_best_today from public.kids_skips where child_id = v_id and thrown_at >= v_start;
  if v_today >= 300 then raise exception 'SKIP_DAY'; end if;
  select coalesce(max(skips), 0) into v_best from public.kids_skips where child_id = v_id;
  if v_p < 0.2 then v_n := 0;
  else
    v_n := round(24 * (v_p - 0.2) / 0.8 * (0.15 + 0.85 * power(v_s, 1.2)))::int;
    if v_s = 0 then v_n := least(v_n, 1); end if;
    v_n := greatest(1, least(24, v_n));
  end if;
  insert into public.kids_skips (child_id, skips) values (v_id, v_n);
  return jsonb_build_object('skips', v_n, 'best_today', greatest(v_best_today, v_n), 'best', greatest(v_best, v_n),
    'new_best', v_n > v_best and v_n > 0, 'today_best_new', v_n > v_best_today and v_n > 0, 'top', public.kids__skip_top(v_id));
end $$;
revoke all on function public.kids_skip_throw2(text, numeric, numeric) from public;
grant execute on function public.kids_skip_throw2(text, numeric, numeric) to anon, authenticated;

-- 기능 목록: skip2(물수제비 힘과 스핀)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true)
$$;
