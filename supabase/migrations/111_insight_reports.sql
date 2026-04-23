-- 111_insight_reports.sql
-- 주간/월간 AI 인사이트 리포트 저장 테이블.
-- cron(/api/cron/insights-weekly|monthly) 가 사용자별 활동 데이터를 집계해 insert.

create table if not exists public.insight_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scope_kind text check (scope_kind in ('personal','group','project')) default 'personal',
  scope_id uuid,
  period text not null check (period in ('weekly','monthly')),
  period_start date not null,
  period_end date not null,
  content jsonb not null,
  model_used text,
  created_at timestamptz default now()
);

alter table public.insight_reports enable row level security;

drop policy if exists "insight_reports_owner" on public.insight_reports;
create policy "insight_reports_owner" on public.insight_reports
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create index if not exists idx_insight_reports_scope
  on public.insight_reports(owner_id, scope_kind, scope_id, period, period_start desc);

create index if not exists idx_insight_reports_period
  on public.insight_reports(period, period_start desc);
