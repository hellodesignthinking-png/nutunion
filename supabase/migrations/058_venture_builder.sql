-- ============================================================
-- 058_venture_builder.sql
-- Venture Builder 모드 — 디자인 씽킹 5단계 프로세스
--   1. Empathize — 유저 인사이트
--   2. Define    — HMW 문제 정의
--   3. Ideate    — 아이디어 + 투표
--   4. Prototype — 체크리스트 + 피드백
--   5. Plan      — AI 사업계획서
-- ============================================================

-- projects 에 venture 모드 + stage 추가
alter table public.projects
  add column if not exists venture_mode boolean not null default false,
  add column if not exists venture_stage text not null default 'empathize'
    check (venture_stage in ('empathize','define','ideate','prototype','plan','completed'));

create index if not exists projects_venture_mode_idx
  on public.projects (venture_mode) where venture_mode = true;

-- ────────────────────────────────────────────────────────────
-- 1. Empathize — 유저 인사이트 / 인터뷰
-- ────────────────────────────────────────────────────────────

create table if not exists public.venture_insights (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  source       text not null default 'interview'
    check (source in ('interview','observation','survey','research','other')),
  quote        text not null,            -- 실제 유저 발언/관찰 내용
  pain_point   text,                     -- 추출된 고통점
  target_user  text,                     -- 대상 페르소나 메모
  tags         text[] default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists venture_insights_project_idx on public.venture_insights (project_id, created_at desc);

-- ────────────────────────────────────────────────────────────
-- 2. Define — HMW 문제 정의
-- ────────────────────────────────────────────────────────────

create table if not exists public.venture_problems (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  author_id        uuid references auth.users(id) on delete set null,
  hmw_statement    text not null,        -- "우리가 어떻게 하면 ~할 수 있을까?"
  target_user      text,
  context          text,
  success_metric   text,
  is_selected      boolean not null default false, -- 팀이 최종 선택한 문제
  created_at       timestamptz not null default now()
);
create index if not exists venture_problems_project_idx on public.venture_problems (project_id, is_selected desc, created_at desc);

-- 프로젝트 하나에 selected 는 최대 1개
create unique index if not exists venture_problems_selected_unique
  on public.venture_problems (project_id) where is_selected = true;

-- ────────────────────────────────────────────────────────────
-- 3. Ideate — 아이디어 + 투표
-- ────────────────────────────────────────────────────────────

create table if not exists public.venture_ideas (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  title           text not null,
  description     text,
  image_url       text,                  -- 선택적 목업/그림
  is_main         boolean not null default false,  -- 최종 선택 (Main Solution)
  created_at      timestamptz not null default now()
);
create index if not exists venture_ideas_project_idx on public.venture_ideas (project_id, is_main desc, created_at desc);
create unique index if not exists venture_ideas_main_unique
  on public.venture_ideas (project_id) where is_main = true;

create table if not exists public.venture_idea_votes (
  idea_id    uuid not null references public.venture_ideas(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  weight     int not null default 1 check (weight in (1,2,3)), -- 강도 (1: 좋아요, 2: 매우, 3: 꼭)
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. Prototype — 체크리스트 + 피드백
-- ────────────────────────────────────────────────────────────

create table if not exists public.venture_prototype_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_id uuid references auth.users(id) on delete set null,
  due_date    date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists venture_proto_tasks_project_idx
  on public.venture_prototype_tasks (project_id, sort_order);

create table if not exists public.venture_feedback (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  tester_name text,
  score       int check (score between 1 and 10),
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists venture_feedback_project_idx
  on public.venture_feedback (project_id, created_at desc);

-- ────────────────────────────────────────────────────────────
-- 5. Plan — 사업계획서 (AI 초안 + 편집본)
-- ────────────────────────────────────────────────────────────

create table if not exists public.venture_plans (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  version      int not null default 1,
  is_current   boolean not null default true,
  generated_by text,                       -- 'ai' | 'manual'
  model        text,                       -- AI 모델명
  content      jsonb not null,             -- { summary, problem, solution, target, market, business_model, milestones, team }
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists venture_plans_current_unique
  on public.venture_plans (project_id) where is_current = true;

-- ────────────────────────────────────────────────────────────
-- RLS — 프로젝트 멤버 기반 공용 정책
-- ────────────────────────────────────────────────────────────

-- 멤버 여부 확인 헬퍼 (이미 있을 수도 있음 — 멱등)
create or replace function public.is_project_member(p_project uuid, p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project
      and pm.user_id = p_user
  ) or exists (
    select 1 from public.profiles p
    where p.id = p_user and p.role in ('admin','staff')
  );
$$;

do $apply_rls$
declare t text;
begin
  for t in select unnest(array[
    'venture_insights',
    'venture_problems',
    'venture_ideas',
    'venture_idea_votes',
    'venture_prototype_tasks',
    'venture_feedback',
    'venture_plans'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_member_select" on public.%I', t, t);
    execute format('drop policy if exists "%s_member_write"  on public.%I', t, t);

    if t = 'venture_idea_votes' then
      -- idea_votes 는 idea_id → project_id 조인 필요
      execute $sql$
        create policy "venture_idea_votes_member_select" on public.venture_idea_votes
          for select using (
            exists (
              select 1 from public.venture_ideas i
              where i.id = venture_idea_votes.idea_id
                and public.is_project_member(i.project_id)
            )
          )
      $sql$;
      execute $sql$
        create policy "venture_idea_votes_member_write" on public.venture_idea_votes
          for all using (
            user_id::text = auth.uid()::text
          ) with check (
            user_id::text = auth.uid()::text
          )
      $sql$;
    else
      execute format($P$
        create policy "%s_member_select" on public.%I
          for select using (public.is_project_member(project_id))
      $P$, t, t);
      execute format($P$
        create policy "%s_member_write" on public.%I
          for all using (public.is_project_member(project_id))
                 with check (public.is_project_member(project_id))
      $P$, t, t);
    end if;
  end loop;
end
$apply_rls$;

-- ============================================================
-- 확인:
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename like 'venture_%';
-- ============================================================
