-- ============================================================
-- 059_growth_features.sql
-- 1) Talent Matching — projects 에 구인 상태/역할
-- 2) Funding Portal  — venture_plans 제출 창구
-- 3) Wiki Fork/Chain — wiki_pages 파생 계보 + 탭↔탭 연결
-- 4) Portfolio Radar — venture_* 테이블 집계 뷰
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) Talent Matching
-- ────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists needed_roles  text[] default '{}',
  add column if not exists recruiting    boolean not null default false,
  add column if not exists recruiting_note text;

create index if not exists projects_recruiting_idx
  on public.projects (recruiting) where recruiting = true;

-- ────────────────────────────────────────────────────────────
-- 2) Funding Portal
-- ────────────────────────────────────────────────────────────

create table if not exists public.funding_submissions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  plan_id         uuid not null references public.venture_plans(id) on delete restrict,
  submitter_id    uuid references auth.users(id) on delete set null,
  status          text not null default 'submitted'
    check (status in ('draft','submitted','reviewing','funded','rejected','withdrawn')),
  amount_req      bigint,                         -- 요청 금액 KRW
  contact_email   text,
  pitch           text,                           -- 추가 피치 메모
  reviewer_id     uuid references auth.users(id) on delete set null,
  review_note     text,
  submitted_at    timestamptz not null default now(),
  decided_at      timestamptz
);

create index if not exists funding_submissions_project_idx
  on public.funding_submissions (project_id, submitted_at desc);
create index if not exists funding_submissions_status_idx
  on public.funding_submissions (status, submitted_at desc);

alter table public.funding_submissions enable row level security;

drop policy if exists "funding_member_select" on public.funding_submissions;
create policy "funding_member_select" on public.funding_submissions
  for select using (
    public.is_project_member(project_id)
    or exists (select 1 from public.profiles p
               where p.id::text = auth.uid()::text
                 and p.role in ('admin','staff'))
  );

drop policy if exists "funding_host_insert" on public.funding_submissions;
create policy "funding_host_insert" on public.funding_submissions
  for insert with check (public.is_project_member(project_id));

drop policy if exists "funding_admin_update" on public.funding_submissions;
create policy "funding_admin_update" on public.funding_submissions
  for update using (
    exists (select 1 from public.profiles p
            where p.id::text = auth.uid()::text
              and p.role in ('admin','staff'))
  );

-- ────────────────────────────────────────────────────────────
-- 3) Wiki Fork + Connections
-- ────────────────────────────────────────────────────────────

alter table public.wiki_pages
  add column if not exists forked_from         uuid references public.wiki_pages(id) on delete set null,
  add column if not exists original_author_id  uuid references public.profiles(id) on delete set null,
  add column if not exists fork_depth          int not null default 0;

create index if not exists wiki_pages_forked_from_idx
  on public.wiki_pages (forked_from) where forked_from is not null;
create index if not exists wiki_pages_original_author_idx
  on public.wiki_pages (original_author_id);

-- 탭 ↔ 탭 연결 (유저가 의미적으로 관련 있다고 선언)
create table if not exists public.wiki_page_connections (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references public.wiki_pages(id) on delete cascade,
  target_id   uuid not null references public.wiki_pages(id) on delete cascade,
  relation    text not null default 'related'
    check (relation in ('related','extends','combines','cites','replaces','sequel')),
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (source_id, target_id, relation),
  check (source_id <> target_id)
);

create index if not exists wiki_connections_source_idx on public.wiki_page_connections (source_id);
create index if not exists wiki_connections_target_idx on public.wiki_page_connections (target_id);

alter table public.wiki_page_connections enable row level security;

drop policy if exists "wiki_conn_select" on public.wiki_page_connections;
create policy "wiki_conn_select" on public.wiki_page_connections
  for select using (true);  -- 연결 관계는 공개 (탐색 허용)

drop policy if exists "wiki_conn_auth_insert" on public.wiki_page_connections;
create policy "wiki_conn_auth_insert" on public.wiki_page_connections
  for insert with check (auth.uid() is not null and (created_by is null or created_by::text = auth.uid()::text));

drop policy if exists "wiki_conn_author_delete" on public.wiki_page_connections;
create policy "wiki_conn_author_delete" on public.wiki_page_connections
  for delete using (
    created_by::text = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role = 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- 4) Portfolio — venture 단계별 기여 집계 뷰
-- ────────────────────────────────────────────────────────────

create or replace view public.venture_contributions_view as
with base as (
  select 'empathize'::text as stage, project_id, author_id as user_id, 1 as weight
    from public.venture_insights where author_id is not null
  union all
  select 'define', project_id, author_id, case when is_selected then 3 else 1 end
    from public.venture_problems where author_id is not null
  union all
  select 'ideate', project_id, author_id, case when is_main then 3 else 1 end
    from public.venture_ideas where author_id is not null
  union all
  select 'ideate-vote', v.idea_id::text::uuid, v.user_id, v.weight
    from public.venture_idea_votes v
  union all
  select 'prototype', project_id, assignee_id,
         case when status = 'done' then 2 when status = 'doing' then 1 else 0 end
    from public.venture_prototype_tasks where assignee_id is not null and status <> 'todo'
  union all
  select 'prototype-feedback', project_id, author_id, 1
    from public.venture_feedback where author_id is not null
  union all
  select 'plan', project_id, created_by, 3
    from public.venture_plans where created_by is not null and is_current = true
)
select
  user_id,
  stage,
  sum(weight)::int as total_weight,
  count(*)::int    as items
from base
group by user_id, stage;

comment on view public.venture_contributions_view is
  '사용자별 venture 단계 기여도 집계 — 레이더 차트용';

-- ============================================================
-- 실행 후 확인:
--   select * from pg_tables where tablename in ('funding_submissions','wiki_page_connections');
--   select * from pg_views  where viewname  = 'venture_contributions_view';
-- ============================================================
