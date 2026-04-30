-- 121_ai_preferences.sql
-- Per-user AI preferences for ai-copilot Thread + dependency awareness.

alter table profiles
  add column if not exists ai_preferences jsonb default '{"enabled": true, "features": ["summarize","extract_actions","recommend","cross_thread_alert","thread_recommend"]}'::jsonb;

-- Track AI suggestion outcomes (already may exist as user_ai_actions; add a small dependency-warning helper view)
-- This is purely for UI dependency warning; if the table is missing it falls back gracefully.
create table if not exists user_ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action_type text not null,         -- 'thread_suggestion', 'summary_apply', 'extract_apply', etc.
  payload jsonb,
  outcome text check (outcome in ('accepted','rejected','pending','rolled_back')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_user_ai_actions_user_created on user_ai_actions(user_id, created_at desc);

alter table user_ai_actions enable row level security;
drop policy if exists "uaa_owner_all" on user_ai_actions;
create policy "uaa_owner_all" on user_ai_actions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
