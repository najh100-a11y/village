-- 진숲 어린이 마을: 선생님도 마을에 들어오기 (선생님 주민)
-- 다시 실행해도 된다.
-- 선생님마다 마을 주민 하나를 kids_children에 둔다(teacher_id로 잇는다). 아이 로그인(아이디+비밀번호 숫자)으로는 들어갈 수 없고,
-- 선생님 로그인(선생님 화면 또는 마을 첫 화면의 '선생님으로 들어가기')으로만 들어간다.
-- 선생님 주민은 선생님 화면의 아이 목록과 도장 목록에 나오지 않고, 놀이 마당은 늘 열려 있으며, 생일 축하는 하지 않는다.
-- 처음 들어올 때 열매 100개를 받는다.

alter table public.kids_children add column if not exists teacher_id uuid references public.kids_teachers(id) on delete cascade;
create unique index if not exists kids_children_teacher_uq on public.kids_children (teacher_id) where teacher_id is not null;

-- 선생님 세션으로 선생님 주민의 마을 세션을 받는다 (없으면 만든다)
create or replace function public.kids_t_village_enter(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); t public.kids_teachers; v_cid uuid; v_new boolean := false;
begin
  select * into t from public.kids_teachers where id = v_tid;
  select id into v_cid from public.kids_children where teacher_id = v_tid;
  if v_cid is null then
    insert into public.kids_children (login_id, pin_hash, real_name, birthdate, consent_date, fruits, created_by, consent_checked, teacher_id)
    values ('#teacher-' || t.login_id,
            -- 아무도 모르는 비밀번호: 아이 로그인으로는 들어올 수 없다
            extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 8)),
            t.display_name, (now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date, 100, v_tid, true, v_tid)
    returning id into v_cid;
    v_new := true;
  end if;
  update public.kids_children set last_seen_at = now() where id = v_cid;
  return jsonb_build_object('ok', true, 'new', v_new, 'token', public.kids__new_session('child', v_cid, 14));
end $$;
grant execute on function public.kids_t_village_enter(text) to anon, authenticated;

-- 나: 선생님 주민이면 teacher가 참이고 생일 축하는 하지 않는다
create or replace function public.kids_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); c public.kids_children;
begin
  update public.kids_children set last_seen_at = now() where id = v_id returning * into c;
  return jsonb_build_object(
    'id', c.id, 'login_id', c.login_id, 'name', c.real_name,
    'village_name', c.village_name, 'avatar', c.avatar, 'fruits', c.fruits, 'pet', c.pet,
    'teacher', c.teacher_id is not null,
    'is_birthday', c.teacher_id is null and public.kids__is_birthday(c.birthdate));
end $$;

-- 마을 사람들: 선생님 주민에는 teacher 표시 (이름표에 '선생님'이 붙는다)
create or replace function public.kids_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'room', (select value from public.kids_config where key = 'realtime_room'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar, 'pet', c.pet,
        'teacher', c.teacher_id is not null))
      from public.kids_children c where c.village_name is not null and c.avatar is not null), '[]'::jsonb));
end $$;

-- 놀이 마당: 선생님 주민은 늘 열려 있다
create or replace function public.kids__cleared_today(p_child uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.kids__play_free()
      or exists (select 1 from public.kids_children t where t.id = p_child and t.teacher_id is not null)
      or exists (select 1 from public.kids_qt_entries q where q.child_id = p_child and q.day = public.kids__today())
      or exists (select 1 from public.kids_memory m where m.child_id = p_child and m.verse_id = public.kids__current_verse()
                  and (m.first_done_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                  and c.week_start = public.kids__week_of(public.kids__today())
                  and (c.created_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or (not public.kids__qt_today() and (
            exists (select 1 from public.kids_memory m where m.child_id = p_child and m.last_practiced_on = public.kids__today())
         or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                     and (c.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())))
$$;

-- 선생님 화면 아이 목록에는 선생님 주민을 넣지 않는다 (내 선생님 주민은 my_resident로 따로 준다)
create or replace function public.kids_t_overview(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher'); v_cur uuid := public.kids__current_verse();
begin
  return jsonb_build_object(
    'me', (select jsonb_build_object('id', t.id, 'login_id', t.login_id, 'name', t.display_name)
             from public.kids_teachers t where t.id = v_tid),
    'my_resident', (select jsonb_build_object('village_name', c.village_name, 'fruits', c.fruits, 'last_seen_at', c.last_seen_at)
             from public.kids_children c where c.teacher_id = v_tid),
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
      ) order by c.real_name) from public.kids_children c where c.teacher_id is null), '[]'::jsonb),
    'verses', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'ref', v.ref, 'body', v.body, 'version', v.version, 'sort_order', v.sort_order,
        'is_current', v.id is not distinct from v_cur, 'is_published', v.is_published) order by v.sort_order, v.created_at)
      from public.kids_verses v), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'login_id', t.login_id, 'name', t.display_name)
        order by t.created_at) from public.kids_teachers t), '[]'::jsonb)
  );
end $$;

create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true)
$$;
