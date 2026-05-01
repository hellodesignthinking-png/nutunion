-- L11: 글로벌 통합 활동 피드 — 읽음 커서 + AI 요약 캐시
--
-- 목적
--   1. 사용자별 owner(너트/볼트) 단위 last_read_at 저장 → 마인드맵 노드 미확인 배지
--   2. AI 브리핑 결과를 짧게 캐싱 → 동일 사용자/날짜 동일 호출 비용 0

create table if not exists activity_read_cursors (
  user_id     uuid not null references profiles(id) on delete cascade,
  owner_type  text not null check (owner_type in ('nut','bolt')),
  owner_id    uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, owner_type, owner_id)
);

create index if not exists activity_read_cursors_user_idx
  on activity_read_cursors (user_id, last_read_at desc);

alter table activity_read_cursors enable row level security;

drop policy if exists "activity_cursors_own" on activity_read_cursors;
create policy "activity_cursors_own" on activity_read_cursors
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI 브리핑 캐시 (사용자 × 날짜 × 시간대) — 24h TTL
create table if not exists activity_briefings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  brief_date  date not null,
  brief_type  text not null default 'morning' check (brief_type in ('morning','evening','realtime')),
  highlights  jsonb not null default '[]'::jsonb,
  summary     text,
  item_count  int default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, brief_date, brief_type)
);

create index if not exists activity_briefings_user_idx
  on activity_briefings (user_id, brief_date desc);

alter table activity_briefings enable row level security;

drop policy if exists "briefings_own" on activity_briefings;
create policy "briefings_own" on activity_briefings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
