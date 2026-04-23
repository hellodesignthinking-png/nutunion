-- ============================================
-- Migration 101: Person CRM (AI 인맥 관리)
-- ============================================
-- 너트유니온 유저가 자신의 인맥 (내부 멤버 + 외부 연락처) 을 관리하는 시스템.
-- 인물별 이벤트(생일/창립일 등), 대화 맥락 메모(프라이버시 보호 위해 TTL),
-- 너트유니온 프로필과의 선택적 연결을 지원.

-- 1) people — 인물/연락처
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  linked_profile_id uuid references profiles(id) on delete set null,
  display_name text not null,
  role_hint text,
  company text,
  phone text,
  email text,
  kakao_id text,
  relationship text,                -- "family","friend","biz","crew","partner"
  importance int default 3 check (importance between 1 and 5),
  last_contact_at timestamptz,
  notes text,
  tags text[] default '{}',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) person_events — 인물 관련 이벤트 (생일/결혼/창립 등)
create table if not exists person_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('birthday','anniversary','founding_day','memorial','milestone','note')),
  title text not null,
  event_date date not null,
  lunar boolean default false,
  recurring boolean default true,
  detail text,
  source text default 'manual',     -- 'manual' | 'google_contacts' | 'kakao_parse' | 'ai_inferred'
  created_at timestamptz default now()
);

-- 3) person_context_notes — 관계 맥락 메모 (대화에서 추출된 단서)
create table if not exists person_context_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  extracted_from text,               -- 'chat_log','meeting','manual'
  ttl_days int default 180,
  created_at timestamptz default now()
);

-- RLS
alter table people enable row level security;
alter table person_events enable row level security;
alter table person_context_notes enable row level security;

drop policy if exists "people_owner" on people;
create policy "people_owner" on people for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "person_events_owner" on person_events;
create policy "person_events_owner" on person_events for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "person_context_notes_owner" on person_context_notes;
create policy "person_context_notes_owner" on person_context_notes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Indexes
create index if not exists idx_people_owner on people(owner_id);
create index if not exists idx_people_owner_last_contact on people(owner_id, last_contact_at);
create index if not exists idx_person_events_owner_date on person_events(owner_id, event_date);
create index if not exists idx_person_events_person on person_events(person_id);
create index if not exists idx_person_context_person on person_context_notes(person_id);
create index if not exists idx_person_context_owner on person_context_notes(owner_id, created_at desc);

-- updated_at trigger (재사용: trg_touch_updated_at)
drop trigger if exists people_touch on people;
create trigger people_touch before update on people
  for each row execute function trg_touch_updated_at();
