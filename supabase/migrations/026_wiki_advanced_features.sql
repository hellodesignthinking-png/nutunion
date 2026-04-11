-- Growing Socialing Wiki v2: Advanced Features

-- ═══════════════════════════════════════════════════
-- 1. 글로벌 태그 시스템 (Global Tag System)
-- ═══════════════════════════════════════════════════
create table wiki_tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  color text default '#e91e63', -- hex color for visual
  created_at timestamptz not null default now(),
  unique(group_id, name)
);

-- Page-Tag join table (Many-to-Many)
create table wiki_page_tags (
  page_id uuid references wiki_pages(id) on delete cascade,
  tag_id uuid references wiki_tags(id) on delete cascade,
  primary key (page_id, tag_id)
);

-- ═══════════════════════════════════════════════════
-- 2. 버전 히스토리 (Version History / Diffs)
-- ═══════════════════════════════════════════════════
create table wiki_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  version int not null,
  title text not null,
  content text,
  edited_by uuid references profiles(id) on delete set null,
  change_summary text,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 3. 지식 그래프 연결 (Knowledge Graph Links)
-- ═══════════════════════════════════════════════════
create table wiki_page_links (
  source_page_id uuid references wiki_pages(id) on delete cascade,
  target_page_id uuid references wiki_pages(id) on delete cascade,
  link_type text not null default 'reference' check (link_type in ('reference','extends','contradicts','prerequisite')),
  created_at timestamptz not null default now(),
  primary key (source_page_id, target_page_id)
);

-- ═══════════════════════════════════════════════════
-- 4. AI 분석 로그 (AI Analysis Logs)
-- ═══════════════════════════════════════════════════
create table wiki_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  analysis_type text not null check (analysis_type in ('weekly_digest','monthly_evolution','cross_reference','trend_detection')),
  title text not null,
  content text not null, -- markdown/json result
  metadata jsonb default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 5. 주간 인사이트 뉴스레터 (Weekly Insight Newsletter)
-- ═══════════════════════════════════════════════════
create table wiki_newsletters (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  top_pages jsonb default '[]', -- [{pageId, title, views, edits}]
  top_contributors jsonb default '[]', -- [{userId, nickname, contributions}]
  key_insights text, -- markdown content
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════
-- 6. 페이지 조회수 / 반응 (Page Analytics)
-- ═══════════════════════════════════════════════════
create table wiki_page_views (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table wiki_page_reactions (
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  reaction text not null default '👍' check (reaction in ('👍','🔥','💡','🎯','📌')),
  created_at timestamptz not null default now(),
  primary key (page_id, user_id, reaction)
);

-- ═══════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════
alter table wiki_tags enable row level security;
alter table wiki_page_tags enable row level security;
alter table wiki_page_versions enable row level security;
alter table wiki_page_links enable row level security;
alter table wiki_ai_analyses enable row level security;
alter table wiki_newsletters enable row level security;
alter table wiki_page_views enable row level security;
alter table wiki_page_reactions enable row level security;

-- Simple open-read for authenticated users
create policy "wiki_tags_select" on wiki_tags for select using (true);
create policy "wiki_tags_all" on wiki_tags for all using (auth.role() = 'authenticated');

create policy "wiki_page_tags_select" on wiki_page_tags for select using (true);
create policy "wiki_page_tags_all" on wiki_page_tags for all using (auth.role() = 'authenticated');

create policy "wiki_page_versions_select" on wiki_page_versions for select using (true);
create policy "wiki_page_versions_all" on wiki_page_versions for all using (auth.role() = 'authenticated');

create policy "wiki_page_links_select" on wiki_page_links for select using (true);
create policy "wiki_page_links_all" on wiki_page_links for all using (auth.role() = 'authenticated');

create policy "wiki_ai_analyses_select" on wiki_ai_analyses for select using (true);
create policy "wiki_ai_analyses_all" on wiki_ai_analyses for all using (auth.role() = 'authenticated');

create policy "wiki_newsletters_select" on wiki_newsletters for select using (true);
create policy "wiki_newsletters_all" on wiki_newsletters for all using (auth.role() = 'authenticated');

create policy "wiki_page_views_select" on wiki_page_views for select using (true);
create policy "wiki_page_views_all" on wiki_page_views for all using (auth.role() = 'authenticated');

create policy "wiki_page_reactions_select" on wiki_page_reactions for select using (true);
create policy "wiki_page_reactions_all" on wiki_page_reactions for all using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════
create index idx_wiki_tags_group on wiki_tags(group_id);
create index idx_wiki_page_versions_page on wiki_page_versions(page_id, version);
create index idx_wiki_page_links_source on wiki_page_links(source_page_id);
create index idx_wiki_page_links_target on wiki_page_links(target_page_id);
create index idx_wiki_ai_analyses_group on wiki_ai_analyses(group_id, analysis_type);
create index idx_wiki_newsletters_group on wiki_newsletters(group_id);
create index idx_wiki_page_views_page on wiki_page_views(page_id);
create index idx_wiki_page_reactions_page on wiki_page_reactions(page_id);
