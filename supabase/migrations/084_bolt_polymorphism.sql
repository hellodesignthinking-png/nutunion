-- ============================================
-- Migration 084: Bolt Polymorphism Foundation
-- ============================================
-- 배경: projects 테이블이 "시작-마일스톤-종료" 패턴(Hex) 하나로만 설계됨.
-- 실제 사업 포트폴리오(카페, 플랫폼, 포트폴리오, 캠페인)는 종료일이 없거나
-- 다른 주기를 가짐. 5유형 다형성(Hex/Anchor/Carriage/Eye/Wing)으로 확장.
--
-- 설계 원칙: 0 regression.
--   1) 기존 projects 테이블은 유지, type 컬럼만 추가 (default 'hex')
--   2) 서브타입은 별도 테이블 (JSONB 회피 — 집계·정렬·인덱스 필요)
--   3) 기존 UI는 type='hex' 로 자동 진입 → 변경 없이 동작
-- ============================================

-- 1. projects 에 타입 + 부모 참조 추가
alter table projects
  add column if not exists type text
    not null default 'hex'
    check (type in ('hex','anchor','carriage','eye','wing'));

alter table projects
  add column if not exists parent_bolt_id uuid references projects(id) on delete set null;

-- Self-reference 순환 방지 (Eye 볼트가 자기 자신을 부모로 삼을 수 없음)
alter table projects
  drop constraint if exists projects_no_self_parent;
alter table projects
  add constraint projects_no_self_parent
    check (parent_bolt_id is null or parent_bolt_id <> id);

create index if not exists idx_projects_type on projects(type);
create index if not exists idx_projects_parent on projects(parent_bolt_id) where parent_bolt_id is not null;

-- 2. 서브타입 테이블 — Anchor (공간형: 카페·매장)
create table if not exists project_anchor (
  project_id uuid primary key references projects(id) on delete cascade,
  opened_at date,
  address text,
  floor_area_sqm numeric(8,2),
  seat_count int,
  operating_hours jsonb default '{}'::jsonb,  -- {"mon":"09:00-22:00",...}
  holidays jsonb default '[]'::jsonb,         -- ["sun"] or ["2026-05-05"]
  monthly_revenue_goal_krw numeric(14,0),
  monthly_margin_goal_pct numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Carriage (플랫폼형: 디지털 서비스)
create table if not exists project_carriage (
  project_id uuid primary key references projects(id) on delete cascade,
  launched_at date,
  domain text,
  app_store_url text,
  tech_stack text[] default '{}',
  dau_goal int,
  mau_goal int,
  mrr_goal_krw numeric(14,0),
  integrations jsonb default '{}'::jsonb,  -- {posthog_id, vercel_project, sentry_dsn, stripe, ...}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Eye (포트폴리오형: 여러 볼트를 묶음)
create table if not exists project_eye (
  project_id uuid primary key references projects(id) on delete cascade,
  rollup_rule text not null default 'sum'
    check (rollup_rule in ('sum','avg','weighted')),
  weights jsonb default '{}'::jsonb,  -- rollup_rule='weighted' 일 때 {bolt_id: weight}
  created_at timestamptz not null default now()
);

-- 5. Wing (캠페인형: 단기 푸시 1~4주)
create table if not exists project_wing (
  project_id uuid primary key references projects(id) on delete cascade,
  goal_metric text,          -- '참석자', '매출', '가입', ...
  goal_value numeric(14,2),
  actual_value numeric(14,2) default 0,
  budget_krw numeric(14,0),
  channels jsonb default '[]'::jsonb,  -- [{name, budget, actual}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. 주기 지표 입력 테이블 (Anchor/Carriage/Wing 공용)
create table if not exists bolt_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  period_type text not null check (period_type in ('daily','weekly','monthly')),
  period_start date not null,
  metrics jsonb not null default '{}'::jsonb,
  -- Anchor 예: {revenue:{card,cash,delivery}, cost:{food,supplies,labor}, customers, memo}
  -- Carriage 예: {dau, mau, uptime_pct, errors, releases}
  -- Wing 예: {attendance, sales, channel:{sns,offline,referral}}
  memo text,
  entered_by uuid references profiles(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, period_type, period_start)
);

create index if not exists idx_bolt_metrics_proj_period
  on bolt_metrics(project_id, period_type, period_start desc);

-- 7. updated_at 자동 갱신 트리거
create or replace function trg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists project_anchor_touch on project_anchor;
create trigger project_anchor_touch before update on project_anchor
  for each row execute function trg_touch_updated_at();

drop trigger if exists project_carriage_touch on project_carriage;
create trigger project_carriage_touch before update on project_carriage
  for each row execute function trg_touch_updated_at();

drop trigger if exists project_wing_touch on project_wing;
create trigger project_wing_touch before update on project_wing
  for each row execute function trg_touch_updated_at();

drop trigger if exists bolt_metrics_touch on bolt_metrics;
create trigger bolt_metrics_touch before update on bolt_metrics
  for each row execute function trg_touch_updated_at();

-- 8. RLS — 서브타입은 "부모 projects 에 대한 권한과 동일" 원칙
alter table project_anchor    enable row level security;
alter table project_carriage  enable row level security;
alter table project_eye       enable row level security;
alter table project_wing      enable row level security;
alter table bolt_metrics      enable row level security;

-- 공용 헬퍼: 이 볼트를 읽을 수 있는지 (멤버 or public)
create or replace function can_read_bolt(p_project_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from projects p where p.id = p_project_id
    -- TODO: 추후 Operation Nut 비공개 볼트가 생기면 여기 권한 로직 추가
  );
$$;

-- 공용 헬퍼: 이 볼트를 수정할 수 있는지 (owner or admin or lead)
create or replace function can_write_bolt(p_project_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from projects p
    where p.id = p_project_id
      and (
        p.created_by = auth.uid()
        or exists (
          select 1 from project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
            and pm.role in ('lead','member')
        )
        or exists (
          select 1 from profiles pr
          where pr.id = auth.uid() and pr.role = 'admin'
        )
      )
  );
$$;

-- Anchor RLS
drop policy if exists anchor_select on project_anchor;
create policy anchor_select on project_anchor
  for select using (can_read_bolt(project_id));
drop policy if exists anchor_write on project_anchor;
create policy anchor_write on project_anchor
  for all using (can_write_bolt(project_id)) with check (can_write_bolt(project_id));

-- Carriage RLS
drop policy if exists carriage_select on project_carriage;
create policy carriage_select on project_carriage
  for select using (can_read_bolt(project_id));
drop policy if exists carriage_write on project_carriage;
create policy carriage_write on project_carriage
  for all using (can_write_bolt(project_id)) with check (can_write_bolt(project_id));

-- Eye RLS
drop policy if exists eye_select on project_eye;
create policy eye_select on project_eye
  for select using (can_read_bolt(project_id));
drop policy if exists eye_write on project_eye;
create policy eye_write on project_eye
  for all using (can_write_bolt(project_id)) with check (can_write_bolt(project_id));

-- Wing RLS
drop policy if exists wing_select on project_wing;
create policy wing_select on project_wing
  for select using (can_read_bolt(project_id));
drop policy if exists wing_write on project_wing;
create policy wing_write on project_wing
  for all using (can_write_bolt(project_id)) with check (can_write_bolt(project_id));

-- bolt_metrics RLS — 읽기는 멤버, 쓰기는 담당자/owner
drop policy if exists metrics_select on bolt_metrics;
create policy metrics_select on bolt_metrics
  for select using (can_read_bolt(project_id));
drop policy if exists metrics_insert on bolt_metrics;
create policy metrics_insert on bolt_metrics
  for insert with check (can_write_bolt(project_id));
drop policy if exists metrics_update on bolt_metrics;
create policy metrics_update on bolt_metrics
  for update using (can_write_bolt(project_id)) with check (can_write_bolt(project_id));
drop policy if exists metrics_delete on bolt_metrics;
create policy metrics_delete on bolt_metrics
  for delete using (can_write_bolt(project_id));

-- 9. 기존 볼트 전부 hex 로 명시 (default 가 있으므로 이미 hex지만 일관성 차원)
update projects set type = 'hex' where type is null;

-- 10. 통합 뷰 — UI 에서 서브타입 필드까지 한 번에 조회 (선택적 사용)
create or replace view v_bolt_full as
select
  p.*,
  case p.type
    when 'anchor'   then to_jsonb(a.*) - 'project_id'
    when 'carriage' then to_jsonb(c.*) - 'project_id'
    when 'eye'      then to_jsonb(e.*) - 'project_id'
    when 'wing'     then to_jsonb(w.*) - 'project_id'
    else null
  end as subtype
from projects p
left join project_anchor   a on p.type = 'anchor'   and a.project_id = p.id
left join project_carriage c on p.type = 'carriage' and c.project_id = p.id
left join project_eye      e on p.type = 'eye'      and e.project_id = p.id
left join project_wing     w on p.type = 'wing'     and w.project_id = p.id;

-- 뷰는 view owner 권한 — 실제 RLS 는 base table 에서 작동
comment on view v_bolt_full is 'Bolt + subtype JSON in one row. Use for read-only UI queries.';

-- 11. 검증 쿼리 (수동 실행용, 주석)
-- select type, count(*) from projects group by type;
-- -> 기존 볼트 5개 모두 hex 여야 함
