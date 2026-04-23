-- Migration 104 — Genesis AI 공간 설계 비서 감사 로그
-- intent → plan → provision 흐름에서 생성된 plan 저장 (감사성/재현성)
-- additive only. 미적용 환경에서도 provision 은 graceful degrade.

create table if not exists public.genesis_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('group','project')),
  target_id uuid,
  intent text not null,
  plan jsonb not null,
  model_used text,
  created_at timestamptz default now()
);

alter table public.genesis_plans enable row level security;

drop policy if exists "genesis_plans_owner" on public.genesis_plans;
create policy "genesis_plans_owner" on public.genesis_plans
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists idx_genesis_plans_target on public.genesis_plans(target_kind, target_id);
create index if not exists idx_genesis_plans_owner on public.genesis_plans(owner_id, created_at desc);
