-- ============================================
-- Migration 136: resource_leases — lightweight TTL lock for cross-instance serialization
-- ============================================
-- 용도: Drive sync(/api/files/sync-from-drive)와 자동 sync 크론(/api/cron/auto-sync-drive)이
-- 같은 자료실 행을 동시에 처리하지 않도록 가드. Postgres advisory lock 은 connection-scoped
-- 인데 Supabase JS 클라이언트는 connection 을 재사용하지 않으므로 row 기반 lease 로 대체.
--
-- TTL 만료된 lock 은 자동으로 새 호출자가 가져가므로 누락된 release 도 안전.
--
-- 멱등 — `create or replace` 와 `if not exists` 만 사용. 여러 번 실행해도 안전.

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
--
-- 구현 노트: record 타입 변수 대신 스칼라 변수만 사용 — 일부 Postgres 환경에서
-- record 기반 SELECT INTO 가 'relation does not exist' 로 잘못 파싱되는 경우가
-- 보고됨. 한 번의 INSERT ON CONFLICT 로 fast path 처리, 충돌 시 1행 조회.
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
  v_acquired_by  uuid;
  v_acquired_at  timestamptz;
  v_rows         int;
begin
  if p_key is null or p_user is null then
    return false;
  end if;

  -- 1) Fast path — 행이 없으면 새로 INSERT.
  insert into public.resource_leases (lock_key, acquired_by, acquired_at)
  values (p_key, p_user, now())
  on conflict (lock_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return true;
  end if;

  -- 2) 충돌 — 기존 행 조회.
  select acquired_by, acquired_at
    into v_acquired_by, v_acquired_at
    from public.resource_leases
    where lock_key = p_key;

  -- 동시에 다른 인스턴스가 release 했다면 not found 가능 → 재시도.
  if not found then
    insert into public.resource_leases (lock_key, acquired_by, acquired_at)
    values (p_key, p_user, now())
    on conflict (lock_key) do nothing;
    get diagnostics v_rows = row_count;
    return v_rows > 0;
  end if;

  -- 3) TTL 만료 → 새 owner 가 양도받음. 조건부 update 로 race 안전.
  if v_acquired_at < now() - make_interval(secs => p_ttl_seconds) then
    update public.resource_leases
      set acquired_by = p_user,
          acquired_at = now()
      where lock_key = p_key
        and acquired_at < now() - make_interval(secs => p_ttl_seconds);
    get diagnostics v_rows = row_count;
    return v_rows > 0;
  end if;

  -- 4) 같은 사용자 재호출 → 갱신.
  if v_acquired_by = p_user then
    update public.resource_leases
      set acquired_at = now()
      where lock_key = p_key
        and acquired_by = p_user;
    return true;
  end if;

  -- 5) 다른 사용자가 활성 점유 중.
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

-- 청소 — 좀비 lock 정리는 cron 에서 별도 호출 (선택)
create or replace function public.cleanup_stale_leases(p_max_age_minutes int default 60)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.resource_leases
    where acquired_at < now() - make_interval(mins => p_max_age_minutes);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_stale_leases(int) to service_role;

notify pgrst, 'reload schema';
