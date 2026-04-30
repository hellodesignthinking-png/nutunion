-- 128: Wiki Topic 통합탭 버전 히스토리
-- 목적: AI 통합이 자료를 누적하지 않고 topic.content 를 재작성(rewrite)하도록 변경.
--       기존 콘텐츠는 wiki_topic_versions 에 스냅샷으로 보존 → 히스토리 + 복원 가능.

-- 1. wiki_topics 에 통합 콘텐츠 컬럼 추가 ─────────────
alter table public.wiki_topics add column if not exists content text;
alter table public.wiki_topics add column if not exists last_synthesized_at timestamptz;
alter table public.wiki_topics add column if not exists current_version int default 0;

-- 2. 버전 히스토리 테이블 ───────────────────────────
create table if not exists public.wiki_topic_versions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.wiki_topics(id) on delete cascade,
  version_number int not null,
  content_snapshot text not null,
  synthesis_input jsonb,        -- {resource_ids:[], resource_titles:[], page_ids:[]}
  synthesis_summary text,       -- AI가 만든 변경 요약 (3줄 이내)
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (topic_id, version_number)
);

alter table public.wiki_topic_versions enable row level security;

drop policy if exists "wiki_topic_versions_read" on public.wiki_topic_versions;
create policy "wiki_topic_versions_read" on public.wiki_topic_versions
  for select using (
    auth.uid() is not null
    and (
      exists (
        select 1 from public.wiki_topics t
        join public.group_members gm on gm.group_id = t.group_id
        where t.id = wiki_topic_versions.topic_id
          and gm.user_id = auth.uid()
          and gm.status = 'active'
      )
      or exists (
        select 1 from public.wiki_topics t
        join public.groups g on g.id = t.group_id
        where t.id = wiki_topic_versions.topic_id
          and g.host_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin','staff')
      )
    )
  );

drop policy if exists "wiki_topic_versions_write" on public.wiki_topic_versions;
create policy "wiki_topic_versions_write" on public.wiki_topic_versions
  for insert with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );

create index if not exists idx_wiki_topic_versions_topic
  on public.wiki_topic_versions(topic_id, version_number desc);

comment on table public.wiki_topic_versions is
  'Wiki Topic 통합탭 콘텐츠의 버전 히스토리. 매 통합/복원 시 직전 콘텐츠를 스냅샷으로 보존.';
