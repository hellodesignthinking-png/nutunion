-- Wiki Tab Goal: groups can declare what final "너트 탭" they are building
-- wiki_tab_goal: the name/goal of the final tab (e.g., "바이브코딩 완전 정복 가이드")
-- wiki_tab_description: what this tab aims to deliver when complete
-- wiki_tab_status: 'building' | 'ready' | 'published'
-- wiki_tab_published_slug: when published, the public slug
-- wiki_tab_published_at: when it was published

alter table groups
  add column if not exists wiki_tab_goal text,
  add column if not exists wiki_tab_description text,
  add column if not exists wiki_tab_status text default 'building'
    check (wiki_tab_status in ('building', 'ready', 'published')),
  add column if not exists wiki_tab_published_slug text,
  add column if not exists wiki_tab_published_at timestamptz;

-- Unique index on published slug
create unique index if not exists idx_groups_wiki_tab_slug
  on groups(wiki_tab_published_slug)
  where wiki_tab_published_slug is not null;
