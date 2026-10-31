-- 진숲 어린이 마을: 마을 글 대화(직접 쓰기)와 '누구나 놀이 날'

-- ---------- 누구나 놀이 날 ----------
-- play_free_until 날짜(한국 날짜)까지는 말씀 활동을 안 해도 놀이 마당이 열린다. 빈 값이면 평소대로.
insert into public.kids_config (key, value)
select 'play_free_until', '' where not exists (select 1 from public.kids_config where key = 'play_free_until');

create or replace function public.kids__play_free() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select case when value ~ '^\d{4}-\d{2}-\d{2}$' then value::date >= public.kids__today() else false end
                     from public.kids_config where key = 'play_free_until'), false)
$$;
revoke all on function public.kids__play_free() from public, anon, authenticated;

create or replace function public.kids__cleared_today(p_child uuid) returns boolean
language sql stable set search_path = '' as $$
  select public.kids__play_free()
      or exists (select 1 from public.kids_memory m where m.child_id = p_child and m.last_practiced_on = public.kids__today())
      or exists (select 1 from public.kids_qt_entries q where q.child_id = p_child
                  and (q.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())
      or exists (select 1 from public.kids_copy_entries c where c.child_id = p_child
                  and (c.updated_at at time zone 'Asia/Seoul')::date = public.kids__today())
$$;
revoke all on function public.kids__cleared_today(uuid) from public, anon, authenticated;

-- ---------- 글 대화 ----------
alter table public.kids_children add column if not exists chat_muted boolean not null default false;

create table if not exists public.kids_chat (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.kids_children(id) on delete cascade,
  body text not null,
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kids_chat_created on public.kids_chat (created_at desc);
create index if not exists kids_chat_child on public.kids_chat (child_id, created_at desc);
alter table public.kids_chat enable row level security;
revoke all on public.kids_chat from public, anon, authenticated;

insert into public.kids_config (key, value)
select 'chat_open', 'on' where not exists (select 1 from public.kids_config where key = 'chat_open');

-- 글 다듬기: 전화번호·긴 숫자, 인터넷 주소, 거친 말을 가린다. 화면(js/chatfilter.js)도 같은 규칙을 쓴다.
create or replace function public.kids__chat_clean(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare t text := coalesce(p, '');
begin
  t := regexp_replace(t, '[[:cntrl:]]', ' ', 'g');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  t := left(t, 60);
  t := regexp_replace(t, '[0-9０-９][0-9０-９ .\-]{5,}[0-9０-９]', '***', 'g');
  t := regexp_replace(t, '(https?://|www\.)[^ ]*', '***', 'gi');
  t := regexp_replace(t, '[^ ]+\.(com|net|kr|org|io|me|ly|gg|co)([^a-z]|$)', '***', 'gi');
  t := regexp_replace(t, '(씨발|시발|씨빨|씨바|시바(?!견)|ㅅ ?ㅂ|ㅆ ?ㅂ|병 ?신|븅 ?신|ㅂ ?ㅅ|개 ?새|ㅅ ?ㄲ|좆|지 ?랄|ㅈ ?ㄹ|ㅈ ?ㄴ|엠 ?창|fuck|shit|bitch|존나|졸라|닥쳐|꺼져|미친|ㅁㅊ|애미|느금|등신|멍청이|바보|찐따|죽여|죽을래)', '♡', 'gi');
  return t;
end $$;
revoke all on function public.kids__chat_clean(text) from public, anon, authenticated;

create or replace function public.kids_chat_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'on' from public.kids_config where key = 'chat_open'), false)
$$;

create or replace function public.kids_chat_send(p_token text, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_t text; v_n int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids_chat_open() then raise exception 'CHAT_OFF'; end if;
  if (select chat_muted from public.kids_children where id = v_id) then raise exception 'CHAT_MUTED'; end if;
  v_t := public.kids__chat_clean(p_text);
  if char_length(v_t) = 0 then raise exception 'EMPTY_CHAT'; end if;
  if exists (select 1 from public.kids_chat where child_id = v_id and created_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_n from public.kids_chat where child_id = v_id and created_at >= v_start;
  if v_n >= 300 then raise exception 'CHAT_TIRED'; end if;
  insert into public.kids_chat (child_id, body, masked)
  values (v_id, v_t, v_t <> left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), 60));
  -- 대화 기록은 30일만 둔다
  delete from public.kids_chat where created_at < now() - interval '30 days';
  return jsonb_build_object('text', v_t);
end $$;

-- 선생님: 마을 설정(글 대화, 누구나 놀이 날)과 최근 대화
create or replace function public.kids_t_village(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  return jsonb_build_object(
    'today', public.kids__today(),
    'chat_open', public.kids_chat_open(),
    'free_until', (select value from public.kids_config where key = 'play_free_until'),
    'play_free', public.kids__play_free(),
    'chat', coalesce((select jsonb_agg(s.x order by s.at desc) from (
        select jsonb_build_object('id', m.id, 'child', c.id, 'name', c.real_name, 'village_name', c.village_name,
                 'body', m.body, 'masked', m.masked, 'muted', c.chat_muted, 'at', m.created_at) as x, m.created_at as at
          from public.kids_chat m join public.kids_children c on c.id = m.child_id
         order by m.created_at desc limit 200) s), '[]'::jsonb),
    'muted', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.real_name, 'village_name', c.village_name))
        from public.kids_children c where c.chat_muted), '[]'::jsonb));
end $$;

create or replace function public.kids_t_set_village(p_token text, p_chat_open boolean, p_free_today boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  if p_chat_open is not null then
    update public.kids_config set value = case when p_chat_open then 'on' else 'off' end where key = 'chat_open';
  end if;
  if p_free_today is not null then
    update public.kids_config set value = case when p_free_today then public.kids__today()::text else '' end where key = 'play_free_until';
  end if;
  return public.kids_t_village(p_token);
end $$;

create or replace function public.kids_t_chat_mute(p_token text, p_child uuid, p_mute boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tid uuid := public.kids__auth(p_token, 'teacher');
begin
  update public.kids_children set chat_muted = coalesce(p_mute, false) where id = p_child;
  if not found then raise exception 'NOT_FOUND'; end if;
  return public.kids_t_village(p_token);
end $$;

-- 오늘(2026년 10월 31일)은 첫날이라 누구나 놀이 마당을 쓸 수 있다
update public.kids_config set value = '2026-10-31' where key = 'play_free_until';
