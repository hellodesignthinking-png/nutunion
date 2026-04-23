-- Venture Source Library — NotebookLM 스타일 원천 자료.
-- Drive 문서 / YouTube / 기사 / 링크 / 텍스트 / 회의록 스냅샷 등을
-- 하나의 풀에 모아 AI 가 문제 정의 / 아이디어 도출 때 인용 가능.

create table if not exists public.venture_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,

  -- 원천 종류
  kind text not null check (kind in ('youtube','article','drive_doc','pdf','link','raw_text','meeting_note','interview')),

  title text not null,
  url text,                          -- 외부 링크 (YouTube, article, drive)
  content_text text,                 -- raw_text / 발췌 본문 (검색/프롬프트용)
  excerpt text,                      -- 한 줄 요약 (카드 표시용, 200자 이내)
  ai_summary text,                   -- AI 자동 요약 (400~800자, 사업 관점)
  tags text[] not null default '{}',

  -- 메타
  author_name text,                  -- 기사/영상 작성자
  published_at timestamptz,          -- 원본 발행 시점
  thumbnail_url text,

  -- AI 처리 상태
  summary_status text not null default 'pending'
    check (summary_status in ('pending','processing','ready','failed')),
  summary_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venture_sources_project_idx on public.venture_sources (project_id, created_at desc);
create index if not exists venture_sources_kind_idx on public.venture_sources (project_id, kind);
create index if not exists venture_sources_tags_idx on public.venture_sources using gin (tags);

alter table public.venture_sources enable row level security;

-- RLS: 프로젝트 멤버만 조회/추가/삭제
drop policy if exists venture_sources_select on public.venture_sources;
create policy venture_sources_select on public.venture_sources
  for select using (
    public.is_project_member(project_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
  );

drop policy if exists venture_sources_insert on public.venture_sources;
create policy venture_sources_insert on public.venture_sources
  for insert with check (
    public.is_project_member(project_id)
    and added_by = auth.uid()
  );

drop policy if exists venture_sources_update on public.venture_sources;
create policy venture_sources_update on public.venture_sources
  for update using (
    added_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
  );

drop policy if exists venture_sources_delete on public.venture_sources;
create policy venture_sources_delete on public.venture_sources
  for delete using (
    added_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
  );

-- 자동 updated_at
create or replace function public.tg_venture_sources_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists venture_sources_updated_at on public.venture_sources;
create trigger venture_sources_updated_at
before update on public.venture_sources
for each row execute function public.tg_venture_sources_updated_at();

-- ── problems / ideas 에 AI 인용 메타 추가 ──────────────────────
-- (기존 row 는 null 허용, migration 부드럽게 적용)

alter table public.venture_problems
  add column if not exists generated_by_ai boolean not null default false,
  add column if not exists source_citations jsonb,            -- [{source_id, title, quote}]
  add column if not exists ai_rationale text;

alter table public.venture_ideas
  add column if not exists generated_by_ai boolean not null default false,
  add column if not exists source_citations jsonb,
  add column if not exists ai_rationale text,
  add column if not exists linked_problem_id uuid references public.venture_problems(id) on delete set null;

comment on table public.venture_sources is 'Venture Source Library — NotebookLM-style raw material pool for AI problem/idea synthesis';
comment on column public.venture_problems.source_citations is 'AI가 이 HMW를 제안할 때 인용한 venture_sources 리스트';
comment on column public.venture_ideas.source_citations is 'AI가 이 아이디어를 제안할 때 인용한 venture_sources 리스트';
