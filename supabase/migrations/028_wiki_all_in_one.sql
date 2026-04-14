-- ═══════════════════════════════════════════════════════════════
-- 028: Wiki System Complete (025 + 026 + 027 combined, safe re-run)
-- Run this in Supabase SQL Editor to create all wiki tables
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Core Wiki Tables (from 025) ──────────────────────────

create table if not exists wiki_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists wiki_pages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references wiki_topics(id) on delete cascade,
  title text not null,
  content text,
  created_by uuid references profiles(id) on delete set null,
  last_updated_by uuid references profiles(id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wiki_contributions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  change_summary text,
  created_at timestamptz not null default now()
);

create table if not exists wiki_meeting_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete cascade,
  description text,
  created_at timestamptz not null default now()
);

-- Human Capital columns on profiles
alter table profiles add column if not exists interests text[];
alter table profiles add column if not exists strengths text[];

-- ── 2. Advanced Features (from 026) ─────────────────────────

create table if not exists wiki_tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  color text default '#e91e63',
  created_at timestamptz not null default now(),
  unique(group_id, name)
);

create table if not exists wiki_page_tags (
  page_id uuid references wiki_pages(id) on delete cascade,
  tag_id uuid references wiki_tags(id) on delete cascade,
  primary key (page_id, tag_id)
);

create table if not exists wiki_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  version int not null,
  title text not null,
  content text,
  edited_by uuid references profiles(id) on delete set null,
  change_summary text,
  created_at timestamptz not null default now()
);

create table if not exists wiki_page_links (
  source_page_id uuid references wiki_pages(id) on delete cascade,
  target_page_id uuid references wiki_pages(id) on delete cascade,
  link_type text not null default 'reference' check (link_type in ('reference','extends','contradicts','prerequisite')),
  created_at timestamptz not null default now(),
  primary key (source_page_id, target_page_id)
);

create table if not exists wiki_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  analysis_type text not null check (analysis_type in ('weekly_digest','monthly_evolution','cross_reference','trend_detection')),
  title text not null,
  content text not null,
  metadata jsonb default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists wiki_newsletters (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  top_pages jsonb default '[]',
  top_contributors jsonb default '[]',
  key_insights text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table if not exists wiki_page_views (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists wiki_page_reactions (
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  reaction text not null default '👍' check (reaction in ('👍','🔥','💡','🎯','📌')),
  created_at timestamptz not null default now(),
  primary key (page_id, user_id, reaction)
);

-- ── 3. Knowledge System (from 027) ──────────────────────────

create table if not exists wiki_weekly_resources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null,
  shared_by uuid not null references profiles(id) on delete cascade,
  title text not null,
  url text not null,
  resource_type text not null default 'link' check (resource_type in ('pdf','youtube','article','notion','link','drive','sheet','slide','docs','other')),
  description text,
  auto_summary text,
  metadata jsonb default '{}',
  linked_wiki_page_id uuid references wiki_pages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists wiki_synthesis_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  synthesis_type text not null default 'weekly_consolidation' check (synthesis_type in ('weekly_consolidation','resource_digest','meeting_synthesis')),
  input_summary jsonb default '{}',
  output_data jsonb default '{}',
  wiki_pages_created uuid[] default '{}',
  wiki_pages_updated uuid[] default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Wiki public publishing columns
alter table wiki_topics add column if not exists is_public boolean default false;
alter table wiki_topics add column if not exists public_slug text;
alter table wiki_topics add column if not exists public_description text;
alter table wiki_topics add column if not exists published_at timestamptz;

-- Contribution source tracking
alter table wiki_contributions add column if not exists source_type text default 'manual';
alter table wiki_contributions add column if not exists source_id uuid;

-- Wiki pages Google Docs sync columns
alter table wiki_pages add column if not exists google_doc_id text;
alter table wiki_pages add column if not exists google_doc_url text;

-- ── 4. Resource comments/reviews table (NEW) ────────────────

create table if not exists resource_comments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null, -- file_attachments.id or wiki_weekly_resources.id
  resource_type text not null default 'file' check (resource_type in ('file','weekly_resource')),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  parent_id uuid references resource_comments(id) on delete cascade, -- reply threading
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 4b. Resource Tags (for 자료실 tag/review system) ─────────

create table if not exists resource_tags (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique(resource_id, user_id, tag)
);

-- ── 4c. Ensure file_attachments has content column ──────────

alter table file_attachments add column if not exists content text;
alter table project_resources add column if not exists content text;

-- ── 5. RLS ───────────────────────────────────────────────────

do $$ begin
  -- Core wiki
  alter table wiki_topics enable row level security;
  alter table wiki_pages enable row level security;
  alter table wiki_contributions enable row level security;
  alter table wiki_meeting_links enable row level security;
  -- Advanced
  alter table wiki_tags enable row level security;
  alter table wiki_page_tags enable row level security;
  alter table wiki_page_versions enable row level security;
  alter table wiki_page_links enable row level security;
  alter table wiki_ai_analyses enable row level security;
  alter table wiki_newsletters enable row level security;
  alter table wiki_page_views enable row level security;
  alter table wiki_page_reactions enable row level security;
  -- Knowledge
  alter table wiki_weekly_resources enable row level security;
  alter table wiki_synthesis_logs enable row level security;
  -- Comments
  alter table resource_comments enable row level security;
  -- Resource tags
  alter table resource_tags enable row level security;
end $$;

-- Policies (drop if exists + recreate for idempotency)
do $$ begin
  -- wiki_topics
  drop policy if exists "wiki_topics_select" on wiki_topics;
  drop policy if exists "wiki_topics_all" on wiki_topics;
  drop policy if exists "wiki_topics_public_read" on wiki_topics;
  create policy "wiki_topics_select" on wiki_topics for select using (true);
  create policy "wiki_topics_all" on wiki_topics for all using (auth.role() = 'authenticated');

  -- wiki_pages
  drop policy if exists "wiki_pages_select" on wiki_pages;
  drop policy if exists "wiki_pages_all" on wiki_pages;
  drop policy if exists "wiki_pages_public_read" on wiki_pages;
  create policy "wiki_pages_select" on wiki_pages for select using (true);
  create policy "wiki_pages_all" on wiki_pages for all using (auth.role() = 'authenticated');
  create policy "wiki_pages_public_read" on wiki_pages for select using (
    exists (select 1 from wiki_topics t where t.id = wiki_pages.topic_id and t.is_public = true)
  );

  -- wiki_contributions
  drop policy if exists "wiki_contributions_select" on wiki_contributions;
  drop policy if exists "wiki_contributions_all" on wiki_contributions;
  create policy "wiki_contributions_select" on wiki_contributions for select using (true);
  create policy "wiki_contributions_all" on wiki_contributions for all using (auth.role() = 'authenticated');

  -- wiki_meeting_links
  drop policy if exists "wiki_meeting_links_select" on wiki_meeting_links;
  drop policy if exists "wiki_meeting_links_all" on wiki_meeting_links;
  create policy "wiki_meeting_links_select" on wiki_meeting_links for select using (true);
  create policy "wiki_meeting_links_all" on wiki_meeting_links for all using (auth.role() = 'authenticated');

  -- wiki_tags
  drop policy if exists "wiki_tags_select" on wiki_tags;
  drop policy if exists "wiki_tags_all" on wiki_tags;
  create policy "wiki_tags_select" on wiki_tags for select using (true);
  create policy "wiki_tags_all" on wiki_tags for all using (auth.role() = 'authenticated');

  -- wiki_page_tags
  drop policy if exists "wiki_page_tags_select" on wiki_page_tags;
  drop policy if exists "wiki_page_tags_all" on wiki_page_tags;
  create policy "wiki_page_tags_select" on wiki_page_tags for select using (true);
  create policy "wiki_page_tags_all" on wiki_page_tags for all using (auth.role() = 'authenticated');

  -- wiki_page_versions
  drop policy if exists "wiki_page_versions_select" on wiki_page_versions;
  drop policy if exists "wiki_page_versions_all" on wiki_page_versions;
  create policy "wiki_page_versions_select" on wiki_page_versions for select using (true);
  create policy "wiki_page_versions_all" on wiki_page_versions for all using (auth.role() = 'authenticated');

  -- wiki_page_links
  drop policy if exists "wiki_page_links_select" on wiki_page_links;
  drop policy if exists "wiki_page_links_all" on wiki_page_links;
  create policy "wiki_page_links_select" on wiki_page_links for select using (true);
  create policy "wiki_page_links_all" on wiki_page_links for all using (auth.role() = 'authenticated');

  -- wiki_ai_analyses
  drop policy if exists "wiki_ai_analyses_select" on wiki_ai_analyses;
  drop policy if exists "wiki_ai_analyses_all" on wiki_ai_analyses;
  create policy "wiki_ai_analyses_select" on wiki_ai_analyses for select using (true);
  create policy "wiki_ai_analyses_all" on wiki_ai_analyses for all using (auth.role() = 'authenticated');

  -- wiki_newsletters
  drop policy if exists "wiki_newsletters_select" on wiki_newsletters;
  drop policy if exists "wiki_newsletters_all" on wiki_newsletters;
  create policy "wiki_newsletters_select" on wiki_newsletters for select using (true);
  create policy "wiki_newsletters_all" on wiki_newsletters for all using (auth.role() = 'authenticated');

  -- wiki_page_views
  drop policy if exists "wiki_page_views_select" on wiki_page_views;
  drop policy if exists "wiki_page_views_all" on wiki_page_views;
  create policy "wiki_page_views_select" on wiki_page_views for select using (true);
  create policy "wiki_page_views_all" on wiki_page_views for all using (auth.role() = 'authenticated');

  -- wiki_page_reactions
  drop policy if exists "wiki_page_reactions_select" on wiki_page_reactions;
  drop policy if exists "wiki_page_reactions_all" on wiki_page_reactions;
  create policy "wiki_page_reactions_select" on wiki_page_reactions for select using (true);
  create policy "wiki_page_reactions_all" on wiki_page_reactions for all using (auth.role() = 'authenticated');

  -- wiki_weekly_resources
  drop policy if exists "wiki_weekly_resources_select" on wiki_weekly_resources;
  drop policy if exists "wiki_weekly_resources_all" on wiki_weekly_resources;
  create policy "wiki_weekly_resources_select" on wiki_weekly_resources for select using (true);
  create policy "wiki_weekly_resources_all" on wiki_weekly_resources for all using (auth.role() = 'authenticated');

  -- wiki_synthesis_logs
  drop policy if exists "wiki_synthesis_logs_select" on wiki_synthesis_logs;
  drop policy if exists "wiki_synthesis_logs_all" on wiki_synthesis_logs;
  create policy "wiki_synthesis_logs_select" on wiki_synthesis_logs for select using (true);
  create policy "wiki_synthesis_logs_all" on wiki_synthesis_logs for all using (auth.role() = 'authenticated');

  -- resource_comments
  drop policy if exists "resource_comments_select" on resource_comments;
  drop policy if exists "resource_comments_all" on resource_comments;
  create policy "resource_comments_select" on resource_comments for select using (true);
  create policy "resource_comments_all" on resource_comments for all using (auth.role() = 'authenticated');

  -- resource_tags
  drop policy if exists "resource_tags_select" on resource_tags;
  drop policy if exists "resource_tags_all" on resource_tags;
  create policy "resource_tags_select" on resource_tags for select using (true);
  create policy "resource_tags_all" on resource_tags for all using (auth.role() = 'authenticated');
end $$;

-- ── 6. Indexes ───────────────────────────────────────────────

create index if not exists idx_wiki_topics_group on wiki_topics(group_id);
create index if not exists idx_wiki_pages_topic on wiki_pages(topic_id);
create index if not exists idx_wiki_contributions_page on wiki_contributions(page_id);
create index if not exists idx_wiki_contributions_user on wiki_contributions(user_id);
create index if not exists idx_wiki_meeting_links_meeting on wiki_meeting_links(meeting_id);
create index if not exists idx_wiki_tags_group on wiki_tags(group_id);
create index if not exists idx_wiki_page_versions_page on wiki_page_versions(page_id, version);
create index if not exists idx_wiki_page_links_source on wiki_page_links(source_page_id);
create index if not exists idx_wiki_page_links_target on wiki_page_links(target_page_id);
create index if not exists idx_wiki_ai_analyses_group on wiki_ai_analyses(group_id, analysis_type);
create index if not exists idx_wiki_newsletters_group on wiki_newsletters(group_id);
create index if not exists idx_wiki_page_views_page on wiki_page_views(page_id);
create index if not exists idx_wiki_page_reactions_page on wiki_page_reactions(page_id);
create index if not exists idx_wiki_weekly_resources_group_week on wiki_weekly_resources(group_id, week_start desc);
create index if not exists idx_wiki_weekly_resources_shared_by on wiki_weekly_resources(shared_by);
create index if not exists idx_wiki_synthesis_logs_group on wiki_synthesis_logs(group_id, week_start desc);
create unique index if not exists idx_wiki_topics_public_slug on wiki_topics(public_slug) where public_slug is not null;
create index if not exists idx_resource_comments_resource on resource_comments(resource_id, resource_type);
create index if not exists idx_resource_comments_group on resource_comments(group_id);
create index if not exists idx_resource_tags_resource on resource_tags(resource_id);
create index if not exists idx_resource_tags_user on resource_tags(user_id);

-- ── 7. Extend file_attachments CHECK constraint ────────────────
-- Allow 'meeting' as target_type so meeting recordings appear in 자료실
do $$ begin
  alter table file_attachments drop constraint if exists file_attachments_target_type_check;
  alter table file_attachments add constraint file_attachments_target_type_check
    check (target_type in ('project_update', 'crew_post', 'project_task', 'project', 'group', 'meeting'));
exception when others then null;
end $$;

-- ── 8. Add file_attachments update policy ──────────────────────
do $$ begin
  drop policy if exists "files_update" on file_attachments;
  create policy "files_update" on file_attachments for update using (
    uploaded_by = auth.uid() or exists(select 1 from profiles where id = auth.uid() and role = 'admin')
  );
exception when others then null;
end $$;
