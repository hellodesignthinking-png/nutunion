-- 103_daily_briefings.sql
-- 유저별 하루 1회 아침 브리핑 캐시. KST 자정 기준으로 roll-over.
-- 동일 날짜에 대해 기본 GET 은 캐시 반환, POST(혹은 ?refresh=1) 만 재생성.

create table if not exists daily_briefings (
  user_id uuid not null references profiles(id) on delete cascade,
  briefing_date date not null,                  -- KST 기준 날짜
  payload jsonb not null,                       -- 전체 브리핑 객체
  model_used text,
  refreshed_at timestamptz default now(),
  primary key (user_id, briefing_date)
);

alter table daily_briefings enable row level security;

drop policy if exists "daily_briefings_self" on daily_briefings;
create policy "daily_briefings_self" on daily_briefings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_daily_briefings_date on daily_briefings(briefing_date);

comment on table daily_briefings is 'Per-user per-day cache of the morning briefing payload. Rolls over at KST midnight.';
