-- 064: Venture Archive — 프로토타입 시각 결과물 + 흐름 되돌리기 + 아카이브 지원

-- ── prototype tasks: 이미지/첨부 ──────────────────────
alter table public.venture_prototype_tasks
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists result_note text,
  add column if not exists completed_at timestamptz;

-- ── feedback: 이미지 (유저 테스트 사진 등) ────────────
alter table public.venture_feedback
  add column if not exists image_urls text[] not null default '{}';

-- ── venture_stage_history: revert 플래그 추가 ──────────
alter table public.venture_stage_history
  add column if not exists is_revert boolean not null default false;

comment on column public.venture_stage_history.is_revert is
  '사용자가 의도적으로 이전 단계로 되돌렸는지 여부. 아카이브 시각화에서 구분.';

-- ── 성능: 타임라인 조회 인덱스 ──────────────────────
create index if not exists venture_stage_history_project_time_idx
  on public.venture_stage_history (project_id, changed_at);

create index if not exists venture_insights_project_time_idx
  on public.venture_insights (project_id, created_at);

create index if not exists venture_problems_project_time_idx
  on public.venture_problems (project_id, created_at);

create index if not exists venture_ideas_project_time_idx
  on public.venture_ideas (project_id, created_at);

create index if not exists venture_feedback_project_time_idx
  on public.venture_feedback (project_id, created_at);

-- ── Archive View: 타임라인 집계 함수 ──────────────────
-- 프로젝트의 모든 활동을 시간순 통합 피드로 반환
create or replace function public.venture_activity_feed(p_project_id uuid, p_limit int default 200)
returns table (
  event_type text,
  event_id uuid,
  event_at timestamptz,
  author_id uuid,
  author_nickname text,
  author_avatar text,
  title text,
  detail text
)
language sql
stable
security definer
set search_path = public
as $$
  -- 단계 전환
  select
    case when h.is_revert then 'stage_revert' else 'stage_change' end as event_type,
    h.id as event_id,
    h.changed_at as event_at,
    h.changed_by as author_id,
    p.nickname as author_nickname,
    p.avatar_url as author_avatar,
    concat(coalesce(h.from_stage,'시작'), ' → ', h.to_stage) as title,
    h.note as detail
  from public.venture_stage_history h
  left join public.profiles p on p.id = h.changed_by
  where h.project_id = p_project_id
    and (h.note is null or h.note not like '[auto-reminder]%')

  union all

  -- 인사이트
  select
    'insight' as event_type, i.id, i.created_at, i.author_id,
    p.nickname, p.avatar_url,
    case when length(i.quote) > 80 then substring(i.quote from 1 for 80) || '…' else i.quote end,
    i.pain_point
  from public.venture_insights i
  left join public.profiles p on p.id = i.author_id
  where i.project_id = p_project_id

  union all

  -- HMW
  select
    case when pr.generated_by_ai then 'problem_ai' else 'problem' end,
    pr.id, pr.created_at, pr.author_id,
    p.nickname, p.avatar_url,
    pr.hmw_statement,
    case when pr.is_selected then '✓ 선정됨' else null end
  from public.venture_problems pr
  left join public.profiles p on p.id = pr.author_id
  where pr.project_id = p_project_id

  union all

  -- 아이디어
  select
    case when id.generated_by_ai then 'idea_ai' else 'idea' end,
    id.id, id.created_at, id.author_id,
    p.nickname, p.avatar_url,
    id.title,
    case when id.is_main then '⭐ 메인 선정' else null end
  from public.venture_ideas id
  left join public.profiles p on p.id = id.author_id
  where id.project_id = p_project_id

  union all

  -- 프로토타입 태스크
  select
    'task' as event_type, t.id, t.created_at, t.assignee_id,
    p.nickname, p.avatar_url,
    t.title,
    case when t.status = 'done' then '✓ 완료' when t.status = 'doing' then '진행 중' else '대기' end
  from public.venture_prototype_tasks t
  left join public.profiles p on p.id = t.assignee_id
  where t.project_id = p_project_id

  union all

  -- 피드백
  select
    'feedback' as event_type, f.id, f.created_at, f.author_id,
    p.nickname, p.avatar_url,
    case when f.tester_name is not null then '[' || f.tester_name || '] ' else '' end ||
      case when length(f.note) > 80 then substring(f.note from 1 for 80) || '…' else f.note end,
    case when f.score is not null then '점수: ' || f.score::text else null end
  from public.venture_feedback f
  left join public.profiles p on p.id = f.author_id
  where f.project_id = p_project_id

  union all

  -- 소스 (Source Library)
  select
    'source' as event_type, s.id, s.created_at, s.added_by,
    p.nickname, p.avatar_url,
    s.title,
    s.kind
  from public.venture_sources s
  left join public.profiles p on p.id = s.added_by
  where s.project_id = p_project_id

  order by event_at desc
  limit p_limit
$$;

grant execute on function public.venture_activity_feed(uuid, int) to authenticated;

-- ── Archive View: 일별 활동 카운트 ────────────────────
create or replace function public.venture_daily_activity(p_project_id uuid, p_days int default 60)
returns table (
  day date,
  insight_count int,
  problem_count int,
  idea_count int,
  task_count int,
  feedback_count int,
  source_count int,
  contributor_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (p_days || ' days')::interval)::date,
      current_date,
      '1 day'::interval
    )::date as day
  ),
  all_events as (
    select created_at::date as day, author_id as actor from public.venture_insights where project_id = p_project_id
    union all select created_at::date, author_id from public.venture_problems where project_id = p_project_id
    union all select created_at::date, author_id from public.venture_ideas where project_id = p_project_id
    union all select created_at::date, assignee_id from public.venture_prototype_tasks where project_id = p_project_id
    union all select created_at::date, author_id from public.venture_feedback where project_id = p_project_id
    union all select created_at::date, added_by from public.venture_sources where project_id = p_project_id
  )
  select
    d.day,
    (select count(*)::int from public.venture_insights where project_id = p_project_id and created_at::date = d.day),
    (select count(*)::int from public.venture_problems where project_id = p_project_id and created_at::date = d.day),
    (select count(*)::int from public.venture_ideas where project_id = p_project_id and created_at::date = d.day),
    (select count(*)::int from public.venture_prototype_tasks where project_id = p_project_id and created_at::date = d.day),
    (select count(*)::int from public.venture_feedback where project_id = p_project_id and created_at::date = d.day),
    (select count(*)::int from public.venture_sources where project_id = p_project_id and created_at::date = d.day),
    (select count(distinct actor)::int from all_events where day = d.day and actor is not null) as contributor_count
  from days d
  order by d.day
$$;

grant execute on function public.venture_daily_activity(uuid, int) to authenticated;

comment on function public.venture_activity_feed(uuid, int) is
  'Venture Archive — 프로젝트의 모든 활동을 시간순 통합 피드로 반환';
comment on function public.venture_daily_activity(uuid, int) is
  'Venture Archive — 일별 활동 카운트 (timeline 차트용)';
