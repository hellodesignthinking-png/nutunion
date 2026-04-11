-- Growing Socialing Wiki System

-- Wiki Topics (지식 분류체계)
create table wiki_topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Wiki Pages (지식 문서)
create table wiki_pages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references wiki_topics(id) on delete cascade,
  title text not null,
  content text, -- markdown support
  created_by uuid references profiles(id) on delete set null,
  last_updated_by uuid references profiles(id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Wiki Contributions (기여 이력)
create table wiki_contributions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  change_summary text,
  created_at timestamptz not null default now()
);

-- Meeting Wiki Links (회의록과 위키 연결)
create table wiki_meeting_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete cascade,
  description text, -- 수정 포인트 등 메모
  created_at timestamptz not null default now()
);

-- Human Capital Data (멤버 역량/관심사 시각화용)
alter table profiles add column if not exists interests text[];
alter table profiles add column if not exists strengths text[];

-- RLS (Row Level Security) 설정
alter table wiki_topics enable row level security;
alter table wiki_pages enable row level security;
alter table wiki_contributions enable row level security;
alter table wiki_meeting_links enable row level security;

-- Policies
create policy "wiki_topics_select" on wiki_topics for select using (true);
create policy "wiki_topics_all" on wiki_topics for all using (auth.role() = 'authenticated');

create policy "wiki_pages_select" on wiki_pages for select using (true);
create policy "wiki_pages_all" on wiki_pages for all using (auth.role() = 'authenticated');

create policy "wiki_contributions_select" on wiki_contributions for select using (true);
create policy "wiki_contributions_all" on wiki_contributions for all using (auth.role() = 'authenticated');

create policy "wiki_meeting_links_select" on wiki_meeting_links for select using (true);
create policy "wiki_meeting_links_all" on wiki_meeting_links for all using (auth.role() = 'authenticated');

-- Indexes
create index idx_wiki_topics_group on wiki_topics(group_id);
create index idx_wiki_pages_topic on wiki_pages(topic_id);
create index idx_wiki_contributions_page on wiki_contributions(page_id);
create index idx_wiki_contributions_user on wiki_contributions(user_id);
create index idx_wiki_meeting_links_meeting on wiki_meeting_links(meeting_id);
