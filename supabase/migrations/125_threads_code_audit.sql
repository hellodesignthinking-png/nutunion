-- 125_threads_code_audit.sql
-- Phase C-2: audit log of all AI-generated component sources for admin review.

create table if not exists threads_code_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  prompt text not null,
  source text not null,
  reasoning text,
  created_at timestamptz not null default now()
);

create index if not exists idx_threads_code_audit_user
  on threads_code_audit(user_id, created_at desc);

alter table threads_code_audit enable row level security;

drop policy if exists "audit_admin_read" on threads_code_audit;
create policy "audit_admin_read" on threads_code_audit
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "audit_user_insert" on threads_code_audit;
create policy "audit_user_insert" on threads_code_audit
  for insert with check (auth.uid() = user_id);
