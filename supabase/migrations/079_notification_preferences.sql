-- 079: notification_preferences — 와셔별 채널·이벤트 설정

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  inapp jsonb not null default '{"all": true}',
  email jsonb not null default '{"critical": true, "daily_digest": true}',
  kakao jsonb not null default '{"critical": true}',
  push jsonb not null default '{"critical": true}',
  quiet_hours_start time default '22:00',
  quiet_hours_end time default '08:00',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_select_own" on public.notification_preferences;
create policy "notif_prefs_select_own" on public.notification_preferences for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "notif_prefs_write_own" on public.notification_preferences;
create policy "notif_prefs_write_own" on public.notification_preferences for all
  using (user_id = auth.uid());

comment on schema public is 'Migration 079 — notification_preferences';
