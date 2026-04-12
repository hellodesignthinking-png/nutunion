-- Wiki Knowledge System: NotebookLM-style Weekly Resource Collection & Synthesis

-- ═══════════════════════════════════════════════════
-- 1. 주간 리소스 피드 (Weekly Resource Feed)
-- ═══════════════════════════════════════════════════
create table wiki_weekly_resources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null, -- Monday of the week
  shared_by uuid not null references profiles(id) on delete cascade,
  title text not null,
  url text not null,
  resource_type text not null default 'link' check (resource_type in ('pdf','youtube','article','notion','link','other')),
  description text,
  auto_summary text, -- AI-generated summary
  metadata jsonb default '{}', -- thumbnail_url, duration, page_count, etc.
  linked_wiki_page_id uuid references wiki_pages(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 2. 주간 통합 로그 (Weekly Synthesis Logs)
-- ═══════════════════════════════════════════════════
create table wiki_synthesis_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  synthesis_type text not null default 'weekly_consolidation' check (synthesis_type in ('weekly_consolidation','resource_digest','meeting_synthesis')),
  input_summary jsonb default '{}', -- { meetingCount, resourceCount, noteCount }
  output_data jsonb default '{}', -- full AI result
  wiki_pages_created uuid[] default '{}',
  wiki_pages_updated uuid[] default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 3. 위키 공개 발행 (Wiki Public Publishing)
-- ═══════════════════════════════════════════════════
alter table wiki_topics add column if not exists is_public boolean default false;
alter table wiki_topics add column if not exists public_slug text;
alter table wiki_topics add column if not exists public_description text;
alter table wiki_topics add column if not exists published_at timestamptz;

-- Unique slug for public URLs
create unique index if not exists idx_wiki_topics_public_slug on wiki_topics(public_slug) where public_slug is not null;

-- ═══════════════════════════════════════════════════
-- 4. 기여 소스 추적 강화 (Contribution Source Tracking)
-- ═══════════════════════════════════════════════════
alter table wiki_contributions add column if not exists source_type text default 'manual' check (source_type in ('manual','meeting_sync','resource_link','ai_synthesis'));
alter table wiki_contributions add column if not exists source_id uuid;

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════
alter table wiki_weekly_resources enable row level security;
alter table wiki_synthesis_logs enable row level security;

create policy "wiki_weekly_resources_select" on wiki_weekly_resources for select using (true);
create policy "wiki_weekly_resources_all" on wiki_weekly_resources for all using (auth.role() = 'authenticated');

create policy "wiki_synthesis_logs_select" on wiki_synthesis_logs for select using (true);
create policy "wiki_synthesis_logs_all" on wiki_synthesis_logs for all using (auth.role() = 'authenticated');

-- Public wiki: allow anonymous read for published topics
create policy "wiki_topics_public_read" on wiki_topics for select using (is_public = true);
create policy "wiki_pages_public_read" on wiki_pages for select using (
  exists (
    select 1 from wiki_topics t
    where t.id = wiki_pages.topic_id and t.is_public = true
  )
);

-- ═══════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════
create index idx_wiki_weekly_resources_group_week on wiki_weekly_resources(group_id, week_start desc);
create index idx_wiki_weekly_resources_shared_by on wiki_weekly_resources(shared_by);
create index idx_wiki_synthesis_logs_group on wiki_synthesis_logs(group_id, week_start desc);
create index idx_wiki_contributions_source on wiki_contributions(source_type) where source_type != 'manual';
