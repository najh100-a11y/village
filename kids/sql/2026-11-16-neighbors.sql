-- 진숲 어린이 마을: 이웃 마을 (마을 섬 남서쪽 섬, 아이들 집이 모두 모여 있다)
-- 집 주인이 마을에 없어도 그 집에 놀러 갈 수 있다(집 배치는 원래 있던 kids_home_visit으로 읽는다).
-- 놀러 간 아이는 정해진 인사 스티커를 남길 수 있고, 집 주인은 다음에 들어와서 누가 다녀갔는지 본다.
-- 인사는 정해진 여덟 가지뿐이라(직접 쓰는 글이 아니다) 따로 거르지 않는다. 다시 실행해도 된다.

-- 다녀간 인사: host_id 집 주인, visitor_id 남긴 아이, sticker 인사 종류, seen 집 주인이 봤는지
create table if not exists public.kids_home_notes (
  id bigint generated always as identity primary key,
  host_id uuid not null references public.kids_children(id) on delete cascade,
  visitor_id uuid not null references public.kids_children(id) on delete cascade,
  sticker text not null check (sticker in ('hi', 'pretty', 'fun', 'miss', 'play', 'thanks', 'bless', 'star')),
  seen boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists kids_home_notes_host_idx on public.kids_home_notes (host_id, created_at desc);
create index if not exists kids_home_notes_visitor_idx on public.kids_home_notes (visitor_id, created_at desc);
alter table public.kids_home_notes enable row level security;
revoke all on public.kids_home_notes from public, anon, authenticated;

-- 이웃 마을 집 목록: 마을 이름과 주민이 있는 아이 모두 (가입한 차례, 새 친구는 뒤에 붙는다)
-- 집 모양(look)과 모습(avatar: 이름표 얼굴과 지붕 '옷 색깔'에 쓴다), 선생님인지(t). unseen: 내가 아직 안 본 인사 수
create or replace function public.kids_neighbors(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
begin
  return jsonb_build_object(
    'houses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.village_name, 'avatar', c.avatar,
               'look', coalesce(h.look, '{}'::jsonb), 't', c.teacher_id is not null) order by c.created_at, c.id)
        from public.kids_children c left join public.kids_homes h on h.child_id = c.id
       where c.village_name is not null and c.avatar is not null), '[]'::jsonb),
    'unseen', (select count(*) from public.kids_home_notes where host_id = v_id and not seen));
end $$;
revoke all on function public.kids_neighbors(text) from public;
grant execute on function public.kids_neighbors(text) to anon, authenticated;

-- 인사 남기기: 같은 집에는 10분에 한 번, 하루(한국 시각)에 30번까지. 내 집에는 남기지 않는다.
-- 집 주인마다 가장 새 인사 60개만 둔다.
create or replace function public.kids_home_note(p_token text, p_host uuid, p_sticker text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child');
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if p_sticker is null or p_sticker not in ('hi', 'pretty', 'fun', 'miss', 'play', 'thanks', 'bless', 'star') then raise exception 'BAD_KIND'; end if;
  if p_host = v_id then raise exception 'NOTE_SELF'; end if;
  if not exists (select 1 from public.kids_children where id = v_id and village_name is not null and avatar is not null) then raise exception 'NO_RESIDENT'; end if; -- 주민이 없는 선생님 (아이는 주민이 있어야 마을에 들어온다)
  if not exists (select 1 from public.kids_children where id = p_host and village_name is not null and avatar is not null) then raise exception 'NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext('kids_note:' || v_id::text));
  if exists (select 1 from public.kids_home_notes where visitor_id = v_id and host_id = p_host and created_at > now() - interval '10 minutes') then
    raise exception 'NOTE_AGAIN';
  end if;
  if (select count(*) from public.kids_home_notes where visitor_id = v_id and created_at >= v_start) >= 30 then raise exception 'NOTE_DAY'; end if;
  insert into public.kids_home_notes (host_id, visitor_id, sticker) values (p_host, v_id, p_sticker);
  delete from public.kids_home_notes where host_id = p_host and id not in (
    select id from public.kids_home_notes where host_id = p_host order by created_at desc, id desc limit 60);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.kids_home_note(text, uuid, text) from public;
grant execute on function public.kids_home_note(text, uuid, text) to anon, authenticated;

-- 우리 집에 다녀간 인사 (가장 새 것 40개). p_mark가 true면 읽은 뒤 모두 본 것으로 한다 (돌려주는 seen은 읽기 전 값)
create or replace function public.kids_home_notes(p_token text, p_mark boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_out jsonb; v_unseen int;
begin
  select coalesce(jsonb_agg(x order by (x->>'at')::bigint desc, (x->>'id')::bigint desc), '[]'::jsonb) into v_out from (
    select jsonb_build_object('id', n.id, 'from', n.visitor_id, 'name', coalesce(c.village_name, '친구'), 'avatar', c.avatar,
             's', n.sticker, 'at', floor(extract(epoch from n.created_at) * 1000)::bigint, 'seen', n.seen) x
      from public.kids_home_notes n join public.kids_children c on c.id = n.visitor_id
     where n.host_id = v_id order by n.created_at desc, n.id desc limit 40) q;
  select count(*) into v_unseen from public.kids_home_notes where host_id = v_id and not seen;
  if p_mark then update public.kids_home_notes set seen = true where host_id = v_id and not seen; end if;
  return jsonb_build_object('notes', v_out, 'unseen', v_unseen);
end $$;
revoke all on function public.kids_home_notes(text, boolean) from public;
grant execute on function public.kids_home_notes(text, boolean) to anon, authenticated;

-- 기능 목록: nbr(이웃 마을)를 더한다
create or replace function public.kids_features()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dish', true, 'comments', true, 'dm', true, 'eat', true, 'bugs', true, 'shop', true,
    'lectio', true, 'photo10', true, 'pets', true, 'home', true, 'feedback', true, 'gift', true, 'sell', true, 'wardrobe', true, 'sea', true,
    'visit', true, 'mail', true, 'qtgate', true, 'teachervillage', true, 'beach', true, 'skip', true, 'ark', true,
    'petname', true, 'farm', true, 'arkboard', true, 'pets3', true, 'hair', true, 'breeds', true, 'skip2', true, 'volley', true, 'expand', true, 'houses', true,
    'hide', true, 'nbr', true)
$$;
