-- ============================================
-- Migration 106: Nut-mation (자동화 엔진)
-- ============================================
-- - automation_rules: 활성화된 룰 인스턴스 (템플릿에서 파생)
-- - automation_logs: 실행 로그
-- - automation_approvals: HITL 승인 대기 큐

-- 자동화 룰
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  template_id text not null,                       -- 템플릿 식별자 (ai_meeting_summary 등)
  name text not null,
  description text,
  trigger_type text not null,                      -- 'meeting.completed', 'project.milestone_completed', ...
  conditions jsonb default '{}'::jsonb,            -- { project_ids: [...], group_ids: [...], keyword_filter: '...' }
  actions jsonb default '[]'::jsonb,               -- [{ type: 'ai_summary', params: {...} }, ...]
  scope jsonb default '{}'::jsonb,                 -- { kind: 'group'|'project'|'all', ids: [...] }
  is_active boolean default true,
  require_approval boolean default false,
  run_count int default 0,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 실행 로그
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.automation_rules(id) on delete cascade,
  trigger_payload jsonb,
  status text check (status in ('success','failed','skipped','pending_approval','approved','rejected')),
  action_results jsonb,
  error text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  executed_at timestamptz default now()
);

-- HITL 승인 대기 큐
create table if not exists public.automation_approvals (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.automation_logs(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  rule_name text not null,
  preview jsonb,
  status text default 'pending' check (status in ('pending','approved','rejected','expired')),
  created_at timestamptz default now(),
  decided_at timestamptz
);

alter table public.automation_rules enable row level security;
alter table public.automation_logs enable row level security;
alter table public.automation_approvals enable row level security;

drop policy if exists "automation_rules_owner" on public.automation_rules;
create policy "automation_rules_owner" on public.automation_rules
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "automation_logs_owner" on public.automation_logs;
create policy "automation_logs_owner" on public.automation_logs
  for select using (exists (select 1 from public.automation_rules r where r.id = rule_id and r.owner_id = auth.uid()));

drop policy if exists "automation_approvals_owner" on public.automation_approvals;
create policy "automation_approvals_owner" on public.automation_approvals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists idx_automation_rules_trigger on public.automation_rules(trigger_type) where is_active = true;
create index if not exists idx_automation_rules_owner on public.automation_rules(owner_id);
create index if not exists idx_automation_logs_rule on public.automation_logs(rule_id, executed_at desc);
create index if not exists idx_automation_approvals_pending on public.automation_approvals(owner_id, status) where status = 'pending';
