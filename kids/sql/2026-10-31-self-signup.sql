-- 진숲 어린이 마을: 아이가 가입 코드로 직접 가입 (선생님 승인 없이 바로)
-- 보호자 동의는 가입 화면의 체크로만 받는다. 선생님이 따로 확인하면 consent_checked를 켠다.

alter table public.kids_children
  add column if not exists joined_self boolean not null default false,
  add column if not exists consent_checked boolean not null default true;

insert into public.kids_config (key, value)
select 'signup_open', 'on' where not exists (select 1 from public.kids_config where key = 'signup_open');
insert into public.kids_config (key, value)
select 'signup_code', lpad((floor(random() * 1000000))::int::text, 6, '0')
 where not exists (select 1 from public.kids_config where key = 'signup_code');
insert into public.kids_config (key, value)
select 'signup_fails', '0|0' where not exists (select 1 from public.kids_config where key = 'signup_fails');

-- 로그인 화면에서 '가입하기'를 보일지 (코드는 알려 주지 않는다)
create or replace function public.kids_signup_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'on' from public.kids_config where key = 'signup_open'), false)
$$;

create or replace function public.kids_signup(p_code text, p_login_id text, p_pin text, p_name text, p_birthdate date, p_agree boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text; v_fails text; v_n int; v_since bigint; v_now bigint := extract(epoch from now())::bigint;
        v_login text; v_name text := btrim(coalesce(p_name, '')); v_id uuid;
begin
  if not public.kids_signup_open() then raise exception 'SIGNUP_CLOSED'; end if;
  -- 코드를 마구 넣어 보는 것 막기: 10분에 30번 넘게 틀리면 잠시 쉰다
  select value into v_fails from public.kids_config where key = 'signup_fails';
  v_n := split_part(coalesce(v_fails, '0|0'), '|', 1)::int;
  v_since := split_part(coalesce(v_fails, '0|0'), '|', 2)::bigint;
  if v_now - v_since > 600 then v_n := 0; v_since := v_now; end if;
  if v_n >= 30 then raise exception 'SIGNUP_BUSY'; end if;
  select value into v_code from public.kids_config where key = 'signup_code';
  if v_code is null or lower(btrim(coalesce(p_code, ''))) <> lower(v_code) then
    update public.kids_config set value = (v_n + 1)::text || '|' || v_since::text where key = 'signup_fails';
    return jsonb_build_object('ok', false, 'error', 'BAD_JOIN_CODE');
  end if;
  -- 하루에 직접 가입은 50명까지
  if (select count(*) from public.kids_children where joined_self
       and created_at >= (public.kids__today()::timestamp at time zone 'Asia/Seoul')) >= 50 then
    raise exception 'SIGNUP_BUSY';
  end if;
  if not coalesce(p_agree, false) then raise exception 'NO_AGREE'; end if;
  v_login := public.kids__check_login_id(p_login_id);
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then raise exception 'BAD_PIN'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 20 then raise exception 'BAD_NAME'; end if;
  if p_birthdate is null or p_birthdate < date '2005-01-01' or p_birthdate > public.kids__today() then
    raise exception 'BAD_BIRTHDATE';
  end if;
  if exists (select 1 from public.kids_children where lower(login_id) = lower(v_login)) then raise exception 'DUPLICATE_ID'; end if;
  if exists (select 1 from public.kids_children where real_name = v_name and birthdate = p_birthdate) then raise exception 'ALREADY_JOINED'; end if;
  insert into public.kids_children (login_id, pin_hash, real_name, birthdate, consent_date, joined_self, consent_checked)
  values (v_login, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), v_name, p_birthdate, public.kids__today(), true, false)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'token', public.kids__new_session('child', v_id, 30));
end $$;

-- 선생님: 가입 설정 보기와 바꾸기
create or replace function public.kids_t_signup(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'open', public.kids_signup_open(),
    'code', (select value from public.kids_config where key = 'signup_code'));
end $$;

create or replace function public.kids_t_set_signup(p_token text, p_open boolean, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_code text := btrim(coalesce(p_code, ''));
begin
  if p_code is not null then
    if v_code !~ '^[가-힣A-Za-z0-9]{4,12}$' then raise exception 'BAD_JOIN_CODE_FORMAT'; end if;
    update public.kids_config set value = v_code where key = 'signup_code';
    update public.kids_config set value = '0|0' where key = 'signup_fails';
  end if;
  if p_open is not null then
    update public.kids_config set value = case when p_open then 'on' else 'off' end where key = 'signup_open';
  end if;
  return public.kids_t_signup(p_token);
end $$;

-- 선생님: 보호자 동의를 따로 확인했다고 표시
create or replace function public.kids_t_check_consent(p_token text, p_child uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  if p_date is null or p_date > public.kids__today() then raise exception 'NO_CONSENT'; end if;
  update public.kids_children set consent_checked = true, consent_date = p_date where id = p_child;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.kids_t_overview(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_cur uuid := public.kids__current_verse();
begin
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', t.id, 'login_id', t.login_id, 'name', t.display_name)
             from public.kids_teachers t where t.id = v_tid),
    'children', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'login_id', c.login_id, 'name', c.real_name, 'birthdate', c.birthdate,
        'consent_date', c.consent_date, 'village_name', c.village_name, 'avatar', c.avatar,
        'joined_self', c.joined_self, 'consent_checked', c.consent_checked, 'created_at', c.created_at,
        'fruits', c.fruits, 'last_seen_at', c.last_seen_at,
        'locked', coalesce(c.locked_until > now(), false),
        'qt_count', (select count(*) from public.kids_qt_entries e where e.child_id = c.id),
        'copy_count', (select count(*) from public.kids_copy_entries e where e.child_id = c.id),
        'memory', coalesce((select jsonb_agg(jsonb_build_object(
            'verse_id', m.verse_id, 'practice_count', m.practice_count, 'best_score', m.best_score,
            'passed', m.passed_at is not null, 'last_practiced_on', m.last_practiced_on))
          from public.kids_memory m where m.child_id = c.id), '[]'::jsonb)
      ) order by c.real_name) from public.kids_children c), '[]'::jsonb),
    'verses', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'ref', v.ref, 'body', v.body, 'version', v.version, 'sort_order', v.sort_order,
        'is_current', v.id is not distinct from v_cur, 'is_published', v.is_published) order by v.sort_order, v.created_at)
      from public.kids_verses v), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'login_id', t.login_id, 'name', t.display_name)
        order by t.created_at) from public.kids_teachers t), '[]'::jsonb)
  );
end $$;
