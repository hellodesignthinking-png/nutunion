-- ============================================================
-- 042_rate_limits.sql
-- Supabase 기반 rate limit 스토어
--
-- 목적:
--   Vercel 서버리스 다중 인스턴스 간 rate limit 공유.
--   기존 lib/rate-limit.ts 는 인메모리라 인스턴스마다 카운터가 달라 실효 없음.
-- ============================================================

create table if not exists public.rate_limits (
  key           text        primary key,   -- "userId:route" 또는 "ip:route"
  count         int         not null default 0,
  window_start  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

comment on table public.rate_limits is
  '다중 인스턴스 간 공유 rate limit 카운터. 90일 이상 된 행은 cron 으로 정리.';

-- RLS 는 활성화하지 않음 — 애플리케이션(서비스 역할 또는 쿠키 세션 서버)에서만 접근하므로
-- 별도 RLS 불필요. 사용자가 직접 이 테이블을 조회할 수 있으면 rate limit 자체를 우회/분석 가능.
-- 단, anon key 로 접근 차단을 위해 RLS 를 켜고 "deny all" 정책을 추가하는 것이 안전.

alter table public.rate_limits enable row level security;

-- 기본 deny: 어떤 사용자도 직접 SELECT/INSERT/UPDATE/DELETE 불가.
-- 서버 코드가 쿠키 세션으로 접근해도 차단됨 → rate limit 함수는 SECURITY DEFINER 로 작성.
-- (정책 없음 = 전부 거부)

-- ------------------------------------------------------------
-- 슬라이딩 윈도우 rate limit 함수
--   limit: 허용 건수, window_seconds: 윈도우 길이(초)
--   리턴: { allowed bool, remaining int, reset_at timestamptz }
-- ------------------------------------------------------------

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.rate_limits%rowtype;
  cutoff timestamptz;
  now_ts timestamptz := now();
begin
  cutoff := now_ts - (p_window_seconds || ' seconds')::interval;

  -- upsert: 기존 행 있으면 가져오기, 없으면 새로 만들기
  insert into public.rate_limits (key, count, window_start, updated_at)
  values (p_key, 0, now_ts, now_ts)
  on conflict (key) do nothing;

  -- 행 잠금하고 현재값 읽기
  select * into rec
  from public.rate_limits
  where key = p_key
  for update;

  -- 윈도우 지났으면 리셋
  if rec.window_start < cutoff then
    update public.rate_limits
    set count = 1,
        window_start = now_ts,
        updated_at = now_ts
    where key = p_key;
    return jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'reset_at', now_ts + (p_window_seconds || ' seconds')::interval
    );
  end if;

  -- 한도 초과
  if rec.count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', rec.window_start + (p_window_seconds || ' seconds')::interval
    );
  end if;

  -- 카운터 증가
  update public.rate_limits
  set count = rec.count + 1,
      updated_at = now_ts
  where key = p_key;

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - rec.count - 1,
    'reset_at', rec.window_start + (p_window_seconds || ' seconds')::interval
  );
end;
$$;

comment on function public.check_rate_limit(text, int, int) is
  '슬라이딩 윈도우 rate limit 체크. JSONB 리턴: {allowed, remaining, reset_at}';

-- ============================================================
-- 오래된 레코드 청소용 (주기적 cron 에서 호출)
-- ============================================================
--   delete from public.rate_limits
--   where updated_at < now() - interval '1 day';
-- ============================================================
