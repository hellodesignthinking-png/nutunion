-- ============================================
-- Migration 100: User AI Keys Vault + Undo Actions
-- ============================================
-- AI 공급자 키를 유저별로 암호화 저장 (AES-256-GCM, app-level).
-- Personal AI OS (대시보드 비서) 에서 유저 개인 키를 우선 사용.

create table if not exists public.user_ai_keys (
  user_id uuid primary key references profiles(id) on delete cascade,
  openai_key_enc text,
  openai_key_iv text,
  anthropic_key_enc text,
  anthropic_key_iv text,
  google_key_enc text,
  google_key_iv text,
  preferred_provider text default 'auto' check (preferred_provider in ('auto','openai','anthropic','google')),
  updated_at timestamptz default now()
);

alter table public.user_ai_keys enable row level security;

drop policy if exists "user_ai_keys_self" on public.user_ai_keys;
create policy "user_ai_keys_self" on public.user_ai_keys
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI 에이전트 행동 로그 (취소 기능용) — 최근 5개 이내만 유지
create table if not exists public.user_ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tool text not null,          -- create_task / create_event / create_meeting / ...
  target_table text not null,  -- personal_tasks / project_tasks / meetings / events / chat_messages / wiki_pages
  target_id uuid,              -- 생성된 row id
  args jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_ai_actions_user on public.user_ai_actions(user_id, created_at desc);

alter table public.user_ai_actions enable row level security;
drop policy if exists "user_ai_actions_self" on public.user_ai_actions;
create policy "user_ai_actions_self" on public.user_ai_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
