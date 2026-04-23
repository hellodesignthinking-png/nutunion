-- 066: 상세 페이지 로딩 성능 — 핫 패스 인덱스 추가
-- 대상: /projects/[id], /groups/[id], dashboard/brief 등

-- ── project_members: project_id + user_id 복합 (단일 유저 멤버십 체크) ──
create index if not exists project_members_project_user_idx
  on public.project_members (project_id, user_id);

create index if not exists project_members_project_idx
  on public.project_members (project_id);

create index if not exists project_members_user_idx
  on public.project_members (user_id);

-- ── project_milestones: project_id 필터 ──
create index if not exists project_milestones_project_idx
  on public.project_milestones (project_id, sort_order);

create index if not exists project_milestones_project_status_idx
  on public.project_milestones (project_id, status);

-- ── project_tasks: project_id 직접 필터 + milestone_id 조인 ──
create index if not exists project_tasks_project_idx
  on public.project_tasks (project_id);

create index if not exists project_tasks_milestone_idx
  on public.project_tasks (milestone_id);

create index if not exists project_tasks_assigned_idx
  on public.project_tasks (assigned_to, status)
  where status in ('todo', 'in_progress');

-- ── project_applications: project_id + applicant_id ──
create index if not exists project_applications_project_user_idx
  on public.project_applications (project_id, applicant_id);

-- ── project_updates: project_id + created_at desc (최신순 조회) ──
create index if not exists project_updates_project_time_idx
  on public.project_updates (project_id, created_at desc);

-- ── group_members: group_id + user_id ──
create index if not exists group_members_group_user_idx
  on public.group_members (group_id, user_id);

create index if not exists group_members_user_idx
  on public.group_members (user_id, status);

create index if not exists group_members_group_status_idx
  on public.group_members (group_id, status);

-- ── meetings: group_id + scheduled_at ──
create index if not exists meetings_group_time_idx
  on public.meetings (group_id, scheduled_at desc);

create index if not exists meetings_group_status_idx
  on public.meetings (group_id, status);

-- ── crew_posts: group_id + author_id + created_at (project_id 컬럼 없음) ──
create index if not exists crew_posts_group_time_idx
  on public.crew_posts (group_id, created_at desc);

create index if not exists crew_posts_group_author_idx
  on public.crew_posts (group_id, author_id);

-- ── events: group_id + start_at (앞으로의 일정) ──
create index if not exists events_group_time_idx
  on public.events (group_id, start_at);

-- events.project_id 는 003_projects.sql 에서 추가됨
create index if not exists events_project_time_idx
  on public.events (project_id, start_at)
  where project_id is not null;

-- ── wiki_weekly_resources: group_id + shared_by ──
create index if not exists wiki_weekly_resources_group_idx
  on public.wiki_weekly_resources (group_id, created_at desc);

create index if not exists wiki_weekly_resources_group_shared_idx
  on public.wiki_weekly_resources (group_id, shared_by);

-- ── meeting_notes: meeting_id + created_by ──
create index if not exists meeting_notes_meeting_idx
  on public.meeting_notes (meeting_id);

create index if not exists meeting_notes_creator_idx
  on public.meeting_notes (created_by);

-- ── projects: created_by (내가 만든 프로젝트 조회) ──
create index if not exists projects_creator_idx
  on public.projects (created_by);

create index if not exists projects_status_idx
  on public.projects (status, created_at desc);

-- ── file_attachments: target 조회 ──
create index if not exists file_attachments_target_idx
  on public.file_attachments (target_type, target_id, created_at desc);

-- ── notifications: user 최신순 ──
create index if not exists notifications_user_time_idx
  on public.notifications (user_id, is_read, created_at desc);

-- ── venture_* 인덱스 (062/064 에서 일부 이미 있음, 누락분 보완) ──
create index if not exists venture_insights_author_idx
  on public.venture_insights (project_id, author_id);

create index if not exists venture_problems_author_idx
  on public.venture_problems (project_id, author_id);

create index if not exists venture_ideas_author_idx
  on public.venture_ideas (project_id, author_id);

create index if not exists venture_feedback_author_idx
  on public.venture_feedback (project_id, author_id);

-- 완료
comment on schema public is
  'Performance indexes added (066) — detail page queries + dashboard brief hot paths';
