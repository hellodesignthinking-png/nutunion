-- ============================================
-- Migration 085: Nut Type + Tap Mode + Stiffness 유형별 함수
-- ============================================
-- 배경:
--  1) 너트(groups)에 'operation' 유형을 추가 — Anchor/Carriage 볼트 전담 운영팀
--  2) 탭(bolt_taps)에 'living', 'dashboard' 모드 추가 — 위키형/대시보드형
--  3) 강성 유형별 매트릭스 DB 함수화
-- ============================================

-- 1. groups.type (기존 'interest' 기본, 'operation' 추가)
alter table public.groups
  add column if not exists type text
    not null default 'interest'
    check (type in ('interest', 'operation'));

alter table public.groups
  add column if not exists linked_bolt_id uuid references public.projects(id) on delete set null;

alter table public.groups
  add column if not exists visibility text
    not null default 'public'
    check (visibility in ('public', 'unlisted', 'private'));

create index if not exists idx_groups_type on public.groups(type);
create index if not exists idx_groups_linked_bolt on public.groups(linked_bolt_id) where linked_bolt_id is not null;

-- 2. bolt_taps.mode (기존 'archive' 기본, 'living', 'dashboard' 추가)
alter table public.bolt_taps
  add column if not exists mode text
    not null default 'archive'
    check (mode in ('archive', 'living', 'dashboard'));

alter table public.bolt_taps
  add column if not exists editable_by text[]
    not null default array['owner']::text[];
    -- 허용값: 'owner', 'contributors', 'members', 'public'

alter table public.bolt_taps
  add column if not exists widget_config jsonb default '{}'::jsonb;
  -- Dashboard mode: {widgets: [{type:'number'|'line'|'bar', dataRef:...}, ...]}

-- 3. 강성 유형별 가중치 테이블 (매트릭스 DB 버전)
-- lib/stiffness/rules.ts 의 매트릭스와 동기화
create table if not exists public.stiffness_rules (
  bolt_type text not null check (bolt_type in ('hex','anchor','carriage','eye','wing')),
  action_key text not null,
  weight int not null default 0,
  primary key (bolt_type, action_key)
);

-- 기존 rules 삭제 후 재삽입 (idempotent)
truncate table public.stiffness_rules;

insert into public.stiffness_rules (bolt_type, action_key, weight) values
  -- Hex
  ('hex','bolt_joined',5),
  ('hex','milestone_complete',10),
  ('hex','retrospective_written',5),
  ('hex','peer_review_given',3),
  ('hex','tap_published',5),
  ('hex','bolt_closed',25),
  -- Anchor
  ('anchor','bolt_joined',5),
  ('anchor','daily_close_entered',2),
  ('anchor','weekly_pnl_written',8),
  ('anchor','monthly_goal_achieved',15),
  ('anchor','review_responded',3),
  ('anchor','incident_resolved',5),
  ('anchor','tap_published',5),
  -- Carriage
  ('carriage','bolt_joined',5),
  ('carriage','release_deployed',10),
  ('carriage','bug_resolved',3),
  ('carriage','kpi_improved_10pct',8),
  ('carriage','documentation_updated',4),
  ('carriage','tap_published',5),
  -- Eye
  ('eye','bolt_joined',5),
  ('eye','monthly_rollup_reviewed',10),
  ('eye','cross_bolt_transfer_logged',5),
  -- Wing
  ('wing','bolt_joined',5),
  ('wing','wing_goal_achieved',20),
  ('wing','campaign_retrospective',5),
  ('wing','tap_published',3);

-- 4. 강성 증분 함수 — (user_id, bolt_id, action) 3중으로 호출
create or replace function apply_stiffness_delta(
  p_user_id uuid,
  p_project_id uuid,
  p_action text
)
returns int
language plpgsql security definer as $$
declare
  v_bolt_type text;
  v_weight int;
begin
  -- 1) 볼트 유형 조회
  select type into v_bolt_type from public.projects where id = p_project_id;
  if v_bolt_type is null then
    return 0;
  end if;

  -- 2) 가중치 룩업
  select weight into v_weight
  from public.stiffness_rules
  where bolt_type = v_bolt_type and action_key = p_action;

  if v_weight is null or v_weight = 0 then
    return 0;
  end if;

  -- 3) profiles.activity_score 누적
  update public.profiles
  set activity_score = coalesce(activity_score, 0) + v_weight
  where id = p_user_id;

  return v_weight;
end;
$$;

-- 5. Anchor 전용 트리거 — bolt_metrics INSERT 시 +2
create or replace function trg_anchor_daily_stiffness()
returns trigger language plpgsql as $$
declare
  v_type text;
begin
  select type into v_type from public.projects where id = new.project_id;
  if v_type = 'anchor' and new.period_type = 'daily' and new.entered_by is not null then
    perform apply_stiffness_delta(new.entered_by, new.project_id, 'daily_close_entered');
  end if;
  return new;
end;
$$;

drop trigger if exists bolt_metrics_anchor_stiffness on public.bolt_metrics;
create trigger bolt_metrics_anchor_stiffness
  after insert on public.bolt_metrics
  for each row
  execute function trg_anchor_daily_stiffness();

-- 6. Anchor + Operation Nut 자동 연결 헬퍼 (앱에서 opt-in 호출)
create or replace function create_operation_nut_for_bolt(
  p_project_id uuid,
  p_creator_id uuid
) returns uuid
language plpgsql security definer as $$
declare
  v_nut_id uuid;
  v_title text;
  v_category text;
begin
  select title, category into v_title, v_category
  from public.projects where id = p_project_id;

  if v_title is null then
    return null;
  end if;

  insert into public.groups (name, description, category, host_id, type, linked_bolt_id, visibility, is_active)
  values (
    v_title || ' 운영팀',
    v_title || ' 전담 운영 너트 (비공개)',
    coalesce(v_category, 'space'),
    p_creator_id,
    'operation',
    p_project_id,
    'private',
    true
  )
  returning id into v_nut_id;

  return v_nut_id;
end;
$$;

comment on function create_operation_nut_for_bolt(uuid, uuid)
  is 'Anchor/Carriage 볼트의 전담 Operation Nut 생성 헬퍼. 생성자를 host 로.';

-- 7. 검증 쿼리 (주석)
-- select bolt_type, count(*), sum(weight) from stiffness_rules group by bolt_type;
-- select type, count(*) from groups group by type;
-- select mode, count(*) from bolt_taps group by mode;
