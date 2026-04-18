-- ============================================================
-- 056_push_subscriptions.sql
-- Web Push API 구독 저장소
-- ============================================================

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth_key      text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  failed_count  int not null default 0,
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'Web Push API PushSubscription 저장 — 사용자당 여러 브라우저/기기 가능';

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_self_select" on public.push_subscriptions;
create policy "push_subscriptions_self_select" on public.push_subscriptions
  for select using (user_id::text = auth.uid()::text);

drop policy if exists "push_subscriptions_self_insert" on public.push_subscriptions;
create policy "push_subscriptions_self_insert" on public.push_subscriptions
  for insert with check (user_id::text = auth.uid()::text);

drop policy if exists "push_subscriptions_self_delete" on public.push_subscriptions;
create policy "push_subscriptions_self_delete" on public.push_subscriptions
  for delete using (user_id::text = auth.uid()::text);
-- UPDATE 는 service_role 에서만 (발송 실패 카운터 업데이트용)
