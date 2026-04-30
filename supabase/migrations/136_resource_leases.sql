-- ============================================
-- Migration 136: resource_leases — lightweight TTL lock for cross-instance serialization
-- ============================================
-- 용도: Drive sync(/api/files/sync-from-drive)와 자동 sync 크론(/api/cron/auto-sync-drive)이
-- 같은 자료실 행을 동시에 처리하지 않도록 가드. Postgres advisory lock 은 connection-scoped
-- 인데 Supabase JS 클라이언트는 connection 을 재사용하지 않으므로 row 기반 lease 로 대체.
--
-- TTL 만료된 lock 은 자동으로 새 호출자가 가져가므로 누락된 release 도 안전.

create table if not exists public.resource_leases (
  lock_key      text primary key,
  acquired_by   uuid,
  acquired_at   timestamptz not null default now()
);

alter table public.resource_leases enable row level security;

-- 정책 없음 → service role 또는 security definer RPC 만 접근.
comment on table public.resource_leases is
  'TTL 기반 분산 lock 테이블. INSERT/UPDATE/DELETE 는 try_acquire_lease/release_lease RPC 통해서만.';

-- 호출자가 lock 을 잡으면 true, 다른 사용자가 점유 중이면 false.
-- 같은 사용자가 다시 호출하면 acquired_at 만 갱신(연장).
-- TTL 초과 lock 은 자동으로 새 호출자에게 양도.
create or replace function public.try_acquire_lease(
  p_key text,
  p_user uuid,
  p_ttl_seconds int default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  if p_key is null or p_user is null then
    return false;
  end if;

  select acquired_by, acquired_at into v_existing
  from public.resource_leases
  where lock_key = p_key;

  if not found then
    insert into public.resource_leases (lock_key, acquired_by, acquired_at)
    values (p_key, p_user, now())
    on conflict (lock_key) do nothing;
    -- 동시에 두 호출자가 not-found → insert 한 경우 한쪽만 통과
    perform 1 from public.resource_leases
      where lock_key = p_key and acquired_by = p_user;
    return found;
  end if;

  -- TTL 만료
  if v_existing.acquired_at < now() - make_interval(secs => p_ttl_seconds) then
    update public.resource_leases
      set acquired_by = p_user, acquired_at = now()
      where lock_key = p_key
        and acquired_at < now() - make_interval(secs => p_ttl_seconds);
    -- 다시 조건이 거짓이 됐을 수 있음 (race)
    return found;
  end if;

  -- 같은 사용자 재호출 → 연장
  if v_existing.acquired_by = p_user then
    update public.resource_leases
      set acquired_at = now()
      where lock_key = p_key;
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.try_acquire_lease(text, uuid, int) to authenticated, service_role;

create or replace function public.release_lease(p_key text, p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.resource_leases where lock_key = p_key and acquired_by = p_user;
$$;

grant execute on function public.release_lease(text, uuid) to authenticated, service_role;

-- 청소 — 24시간 넘은 좀비 lock 정리는 cron 에서 별도 호출
create or replace function public.cleanup_stale_leases(p_max_age_minutes int default 60)
returns int
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.resource_leases
      where acquired_at < now() - make_interval(mins => p_max_age_minutes)
      returning 1
  )
  select count(*)::int from deleted;
$$;

grant execute on function public.cleanup_stale_leases(int) to service_role;

notify pgrst, 'reload schema';
