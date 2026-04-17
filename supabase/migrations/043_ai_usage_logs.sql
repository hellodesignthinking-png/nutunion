-- ============================================================
-- 043_ai_usage_logs.sql
-- AI Gateway 토큰 사용량 로그
--
-- 목적:
--   /api/finance/marketing 등 AI 생성 엔드포인트의 토큰 사용량 추적
--   비용 추정 및 사용자별 소비 분석
-- ============================================================

create table if not exists public.ai_usage_logs (
  id              bigserial primary key,
  actor_id        uuid references auth.users(id) on delete set null,
  actor_email     text,
  endpoint        text        not null,   -- 'marketing' | 'other'
  model           text        not null,   -- 'anthropic/claude-sonnet-4.5' 등
  input_tokens    int         not null default 0,
  output_tokens   int         not null default 0,
  total_tokens    int         generated always as (input_tokens + output_tokens) stored,
  content_type    text,                   -- marketing 의 'blog'/'sns' 등
  entity_type     text,                   -- 'bolt' | 'company'
  entity_id       text,
  duration_ms     int,
  success         boolean     not null default true,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);
create index if not exists ai_usage_logs_actor_idx on public.ai_usage_logs (actor_id, created_at desc);
create index if not exists ai_usage_logs_endpoint_idx on public.ai_usage_logs (endpoint, created_at desc);

comment on table public.ai_usage_logs is
  'AI Gateway 호출 토큰 사용량 및 비용 추적';

-- RLS — admin/staff 만 조회. INSERT 는 인증된 사용자.
alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs_select_admin_staff" on public.ai_usage_logs;
create policy "ai_usage_logs_select_admin_staff" on public.ai_usage_logs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

drop policy if exists "ai_usage_logs_insert_self" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_self" on public.ai_usage_logs
  for insert
  with check (
    auth.uid() is not null
    and (actor_id::text = auth.uid()::text or actor_id is null)
  );
-- 수정/삭제 정책 없음 (append-only)
