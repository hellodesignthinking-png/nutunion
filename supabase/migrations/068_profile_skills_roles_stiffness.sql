-- 068: 와셔 프로필 확장 + 볼트 역할 확장 + 강성(Stiffness) 산식 공개
-- 전략문서 기반: P0 ① 와셔 프로필 고도화 · ② 볼트 역할 구조 · ④ 강성 계산 투명화

-- ============================================
-- 1. profiles: 스킬 태그 + 외부 링크 + 슬로건
-- ============================================
-- activity_score / points 가 008 에서 추가됐지만 누락된 환경을 대비해 idempotent
alter table public.profiles
  add column if not exists skill_tags text[] default '{}',
  add column if not exists external_links jsonb default '{}',  -- { github, behance, notion, web, linkedin }
  add column if not exists slogan text,                         -- 한줄 소개
  add column if not exists activity_score int default 0,        -- 008 에서 도입 (누락 대비 재선언)
  add column if not exists points int default 0;                -- 008 에서 도입 (누락 대비 재선언)

create index if not exists profiles_skill_tags_idx
  on public.profiles using gin (skill_tags);

comment on column public.profiles.skill_tags is
  'Array of skill tags (e.g. {Figma, React, UX Research}). 최대 12개 권장.';
comment on column public.profiles.external_links is
  'JSONB: { github?: url, behance?: url, notion?: url, web?: url, linkedin?: url }';

-- ============================================
-- 2. project_members: 확장된 역할 + 기여 시간
-- ============================================
-- 기존 CHECK 제약 (lead/member/observer) → pm/mentor/sponsor 추가
-- 단, 003 의 원본 CHECK 는 바로 drop 하기 어려울 수 있어 새 컬럼을 추가
alter table public.project_members
  add column if not exists role_type text
    check (role_type in ('pm','lead','member','support','mentor','sponsor','observer')),
  add column if not exists role_label text,   -- 사용자 지정 라벨 (예: "UX Lead")
  add column if not exists commit_hours_per_week int,
  add column if not exists reward_type text
    check (reward_type in ('experience','revenue','equity','cash','none') or reward_type is null);

-- 기존 role 값 → role_type 마이그레이션
update public.project_members
  set role_type = case
    when role = 'lead' then 'lead'
    when role = 'observer' then 'observer'
    else 'member'
  end
  where role_type is null;

comment on column public.project_members.role_type is
  'Protocol role — PM/Lead/Member/Support/Mentor/Sponsor/Observer';
comment on column public.project_members.role_label is
  'Human-readable role (e.g. "UX Lead", "백엔드 멘토")';

-- ============================================
-- 3. 강성 이벤트 로그 (Stiffness Events)
-- ============================================
-- 모든 강성 변동을 기록 → 공개된 산식 + 주간 델타 계산 가능
create table if not exists public.stiffness_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null check (event_type in (
    'milestone_complete',   -- 마일스톤 완료
    'task_complete',        -- 할일 완료
    'bolt_close',           -- 볼트 마감
    'meeting_attend',       -- 미팅 참석
    'post_create',          -- 글 작성
    'wiki_contribute',      -- 위키 기여
    'endorsement_received', -- 동료 추천 받음
    'venture_stage_advance',-- Venture 단계 진행
    'event_host',           -- 이벤트 주최
    'event_attend'          -- 이벤트 참석
  )),
  points int not null default 0,
  source_type text,   -- 'project','group','event','meeting','wiki'
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists stiffness_events_user_time_idx
  on public.stiffness_events (user_id, created_at desc);
create index if not exists stiffness_events_user_type_idx
  on public.stiffness_events (user_id, event_type);

alter table public.stiffness_events enable row level security;

drop policy if exists "stiffness_events_select_own_or_public" on public.stiffness_events;
create policy "stiffness_events_select_own_or_public"
  on public.stiffness_events for select
  using (user_id = auth.uid() or true);  -- 투명성: 누구나 조회 가능

drop policy if exists "stiffness_events_insert_self_or_service" on public.stiffness_events;
create policy "stiffness_events_insert_self_or_service"
  on public.stiffness_events for insert
  with check (auth.role() = 'service_role' or user_id = auth.uid());

-- ============================================
-- 4. 강성 산식 — View (공개된 계산식)
-- ============================================
-- 이 view 는 profiles.activity_score 와 profiles.points 를 사용.
-- 위에서 IF NOT EXISTS 로 보장됨.
create or replace view public.stiffness_breakdown as
with base as (
  select
    p.id as user_id,
    coalesce(p.activity_score, 0) as activity_score,
    coalesce(p.points, 0)         as points,
    (select count(*) from public.project_members pm where pm.user_id = p.id) as bolts_joined,
    (select count(*) from public.project_members pm
      join public.projects pr on pr.id = pm.project_id
      where pm.user_id = p.id and pr.status = 'completed') as bolts_completed,
    (select count(*) from public.group_members gm where gm.user_id = p.id and coalesce(gm.status, 'active') = 'active') as nuts_active,
    (select count(*) from public.stiffness_events e where e.user_id = p.id and e.created_at >= now() - interval '7 days') as events_this_week,
    (select coalesce(sum(e.points), 0) from public.stiffness_events e where e.user_id = p.id and e.created_at >= now() - interval '7 days') as delta_this_week
  from public.profiles p
)
select
  user_id,
  activity_score,
  points,
  bolts_joined,
  bolts_completed,
  nuts_active,
  events_this_week,
  delta_this_week,
  -- 공개된 산식:
  --   강성 = 활동점수(1.0) + 포인트(0.5) + 완료볼트(20) + 참여볼트(5) + 활성너트(3)
  (activity_score * 1.0
    + points * 0.5
    + bolts_completed * 20
    + bolts_joined * 5
    + nuts_active * 3)::int as stiffness
from base;

grant select on public.stiffness_breakdown to authenticated, anon;

comment on view public.stiffness_breakdown is
  '강성(Stiffness) 공개 산식 — (activity*1.0 + points*0.5 + closed*20 + joined*5 + nuts*3)';

-- ============================================
-- 5. 볼트 지원서 템플릿 — 구조화된 필드
-- ============================================
alter table public.project_applications
  add column if not exists self_intro text,        -- 자기소개
  add column if not exists hours_per_week int,     -- 시간 약속 (주당)
  add column if not exists motivation text,        -- 지원 사유
  add column if not exists relevant_skills text[] default '{}';

comment on column public.project_applications.self_intro is
  '지원자 자기소개 (150자 권장)';
comment on column public.project_applications.motivation is
  '지원 사유 — 왜 이 볼트인가';

-- ============================================
-- 6. 프로필 온보딩 완료 플래그
-- ============================================
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  '온보딩 완료 시각 — null 이면 신규 와셔 코치 표시';

-- 완료
comment on schema public is
  'Migration 068 applied — skill tags, extended roles, stiffness transparency, structured applications';
