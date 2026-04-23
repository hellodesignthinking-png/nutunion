-- 워크플로우 잡 큐 — 장시간 AI 파이프라인을 비동기 처리.
-- Vercel Workflow 정식 도입 전 경량 대체.

create table if not exists public.workflow_jobs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,                  -- "wiki-synthesis" | "weekly-digest" | ...
  status text not null default 'pending',   -- pending | running | completed | failed | cancelled
  created_by uuid references auth.users(id) on delete set null,
  group_id uuid,                             -- 스코프 (선택)
  project_id uuid,                           -- 스코프 (선택)
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists workflow_jobs_status_created_idx on public.workflow_jobs (status, created_at);
create index if not exists workflow_jobs_task_type_status_idx on public.workflow_jobs (task_type, status);
create index if not exists workflow_jobs_created_by_idx on public.workflow_jobs (created_by);

-- RLS: 본인 잡만 조회, admin/staff 는 전체. 생성은 인증 사용자만.
alter table public.workflow_jobs enable row level security;

drop policy if exists workflow_jobs_select on public.workflow_jobs;
create policy workflow_jobs_select on public.workflow_jobs
  for select using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
  );

drop policy if exists workflow_jobs_insert on public.workflow_jobs;
create policy workflow_jobs_insert on public.workflow_jobs
  for insert with check (auth.uid() = created_by);

-- 업데이트는 service_role 만 (processor 에서만 상태 변경)
drop policy if exists workflow_jobs_update on public.workflow_jobs;
create policy workflow_jobs_update on public.workflow_jobs
  for update using (false);

-- 자동 updated_at
create or replace function public.tg_workflow_jobs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists workflow_jobs_updated_at on public.workflow_jobs;
create trigger workflow_jobs_updated_at
before update on public.workflow_jobs
for each row execute function public.tg_workflow_jobs_updated_at();
