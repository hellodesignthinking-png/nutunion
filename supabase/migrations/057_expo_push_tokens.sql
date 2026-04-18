-- ============================================================
-- 057_expo_push_tokens.sql
-- Expo Push Token 저장소 — 모바일 앱용.
-- Web Push (push_subscriptions) 와 별도 채널.
-- ============================================================

create table if not exists public.expo_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now(),
  failed_count int not null default 0,
  unique (user_id, token)
);

create index if not exists expo_push_tokens_user_idx on public.expo_push_tokens (user_id);

alter table public.expo_push_tokens enable row level security;

drop policy if exists "expo_push_tokens_self" on public.expo_push_tokens;
create policy "expo_push_tokens_self" on public.expo_push_tokens
  for all
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);
