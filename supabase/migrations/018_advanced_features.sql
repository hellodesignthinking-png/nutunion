-- ============================================
-- 018: Advanced Features Migration
-- 1) Endorsements (동료 보증)
-- 2) Skill Badges (스킬 뱃지)
-- 3) Best Practices (베스트 프랙티스 승격)
-- 4) Notification enhancements (통합 알림)
-- ============================================

-- ─── 1. ENDORSEMENTS (동료 보증) ───

create table if not exists endorsements (
  id uuid primary key default gen_random_uuid(),
  endorser_id uuid not null references profiles(id) on delete cascade,
  endorsed_id uuid not null references profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  milestone_id uuid references project_milestones(id) on delete set null,
  dimension text not null check (dimension in ('planning','sincerity','organization','execution','expertise','collaboration')),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- One endorsement per dimension per project per pair
  unique(endorser_id, endorsed_id, project_id, dimension)
);

create index idx_endorsements_endorsed on endorsements(endorsed_id);
create index idx_endorsements_project on endorsements(project_id);

-- ─── 2. SKILL BADGES (스킬 뱃지) ───

create table if not exists skill_badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon text not null default '🏅',
  category text not null check (category in ('tool','role','domain','special')),
  requirement_count int not null default 5,  -- endorsements needed
  created_at timestamptz not null default now()
);

create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references skill_badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  endorser_ids uuid[] not null default '{}',
  unique(user_id, badge_id)
);

create index idx_user_badges_user on user_badges(user_id);

-- Seed default badges
insert into skill_badges (name, description, icon, category, requirement_count) values
  ('구글 시트 마스터', '스프레드시트 데이터 관리 전문가', '📊', 'tool', 5),
  ('노션 아키텍트', '노션 워크스페이스 설계 전문가', '🏗️', 'tool', 5),
  ('피그마 위저드', '디자인 시스템 및 프로토타입 전문가', '🎨', 'tool', 5),
  ('프로젝트 리더', '성공적 프로젝트 리딩 3회 이상', '👑', 'role', 3),
  ('브랜딩 전문가', '브랜드 전략 및 실행 역량', '✨', 'domain', 5),
  ('데이터 분석가', '데이터 기반 의사결정 역량', '📈', 'domain', 5),
  ('커뮤니케이터', '탁월한 발표/문서 소통 능력', '🎤', 'role', 5),
  ('팀 플레이어', '협업 지수 최상위 (동료 보증 10건 이상)', '🤝', 'special', 10)
on conflict (name) do nothing;

-- ─── 3. BEST PRACTICES (베스트 프랙티스 승격) ───

create table if not exists best_practices (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('meeting','resource','session')),
  source_id uuid not null,
  group_id uuid references groups(id) on delete set null,
  title text not null,
  description text,
  content jsonb not null default '{}',
  target_type text not null check (target_type in ('curriculum','guideline','template')),
  promoted_by uuid not null references profiles(id) on delete cascade,
  tags text[] not null default '{}',
  is_published boolean not null default true,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_best_practices_group on best_practices(group_id);
create index idx_best_practices_target on best_practices(target_type);
create index idx_best_practices_tags on best_practices using gin(tags);

-- ─── 4. NOTIFICATION ENHANCEMENTS ───
-- Add category column if not exists + link_url for deep linking
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='notifications' and column_name='category') then
    alter table notifications add column category text default 'general';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='notifications' and column_name='link_url') then
    alter table notifications add column link_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='notifications' and column_name='actor_id') then
    alter table notifications add column actor_id uuid references profiles(id) on delete set null;
  end if;
end $$;

create index if not exists idx_notifications_user_unread on notifications(user_id, is_read) where is_read = false;
create index if not exists idx_notifications_category on notifications(user_id, category);
