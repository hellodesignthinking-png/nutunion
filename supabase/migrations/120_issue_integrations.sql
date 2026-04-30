-- 120_issue_integrations.sql
-- GitHub / Linear OAuth tokens + task ↔ issue links.
-- Safe to re-run.

create table if not exists user_integrations (
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('github','linear')),
  access_token_enc text not null,
  access_token_iv text not null,
  refresh_token_enc text,
  refresh_token_iv text,
  scopes text,
  installation_id text,
  workspace_id text,
  metadata jsonb default '{}'::jsonb,
  connected_at timestamptz default now(),
  primary key (user_id, provider)
);

alter table user_integrations enable row level security;

drop policy if exists "user_integrations_self" on user_integrations;
create policy "user_integrations_self" on user_integrations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists task_issue_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  task_table text not null check (task_table in ('project_tasks','personal_tasks')),
  provider text not null check (provider in ('github','linear')),
  external_id text not null,
  external_url text not null,
  external_title text,
  external_status text,
  linked_by uuid references profiles(id),
  linked_at timestamptz default now(),
  last_synced_at timestamptz default now(),
  unique (task_table, task_id, provider, external_id)
);

alter table task_issue_links enable row level security;

drop policy if exists "task_issue_links_read" on task_issue_links;
create policy "task_issue_links_read" on task_issue_links for select using (true);

drop policy if exists "task_issue_links_write" on task_issue_links;
create policy "task_issue_links_write" on task_issue_links for insert with check (linked_by = auth.uid());

drop policy if exists "task_issue_links_delete" on task_issue_links;
create policy "task_issue_links_delete" on task_issue_links for delete using (linked_by = auth.uid());

create index if not exists idx_task_issue_links_task on task_issue_links(task_table, task_id);
