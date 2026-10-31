-- 진숲 어린이 마을: 3D 낚시용 두 단계 (물고기가 다가올 때 정하고, 제때 당기면 잡는다)

create table if not exists public.kids_fish_pending (
  child_id uuid primary key references public.kids_children(id) on delete cascade,
  fish text not null references public.kids_fish_kinds(id),
  size_cm numeric(5,1) not null,
  created_at timestamptz not null default now()
);
alter table public.kids_fish_pending enable row level security;
revoke all on public.kids_fish_pending from public, anon, authenticated;

-- 찌로 다가오는 물고기를 정한다 (그림자 크기를 맞추려고 미리 알려 준다)
create or replace function public.kids_fish_hook(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); v_r numeric; v_acc int := 0; v_total int;
        k public.kids_fish_kinds; v_size numeric(5,1); v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  if not public.kids__cleared_today(v_id) then raise exception 'PLAY_LOCKED'; end if;
  if exists (select 1 from public.kids_fish_pending where child_id = v_id and created_at > now() - interval '2 seconds') then
    raise exception 'TOO_FAST';
  end if;
  select count(*) into v_today from public.kids_fish where child_id = v_id and caught_at >= v_start;
  if v_today >= 80 then raise exception 'FISH_TIRED'; end if;
  select sum(weight) into v_total from public.kids_fish_kinds;
  v_r := floor(random() * v_total);
  for k in select * from public.kids_fish_kinds order by sort loop
    v_acc := v_acc + k.weight;
    exit when v_r < v_acc;
  end loop;
  v_size := case when k.rarity < 0 then 0 else round((k.min_cm + random() * (k.max_cm - k.min_cm))::numeric, 1) end;
  insert into public.kids_fish_pending (child_id, fish, size_cm, created_at) values (v_id, k.id, v_size, now())
  on conflict (child_id) do update set fish = excluded.fish, size_cm = excluded.size_cm, created_at = now();
  return jsonb_build_object('fish', k.id, 'size', v_size, 'rarity', k.rarity);
end $$;

-- 제때 당겼을 때: 다가온 물고기를 잡은 것으로 기록한다
create or replace function public.kids_fish_land(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.kids__auth(p_token, 'child'); pnd public.kids_fish_pending; k public.kids_fish_kinds;
        v_first boolean; v_best boolean; v_today int;
        v_start timestamptz := public.kids__today()::timestamp at time zone 'Asia/Seoul';
begin
  delete from public.kids_fish_pending where child_id = v_id and created_at > now() - interval '60 seconds' returning * into pnd;
  if pnd.child_id is null then raise exception 'NO_FISH'; end if;
  select * into k from public.kids_fish_kinds where id = pnd.fish;
  v_first := not exists (select 1 from public.kids_fish where child_id = v_id and fish = k.id);
  v_best := k.rarity >= 0 and not v_first and pnd.size_cm > (select max(size_cm) from public.kids_fish where child_id = v_id and fish = k.id);
  insert into public.kids_fish (child_id, fish, size_cm) values (v_id, k.id, pnd.size_cm);
  select count(*) into v_today from public.kids_fish where child_id = v_id and caught_at >= v_start;
  return jsonb_build_object('fish', k.id, 'name', k.name, 'rarity', k.rarity, 'size', pnd.size_cm,
    'first', v_first, 'best', v_best, 'today', v_today);
end $$;
