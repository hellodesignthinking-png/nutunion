-- ============================================================
-- Migration 116: Torque Bolt — 사업 컨설팅 프로젝트 유형
-- Torque Bolt: 팀 + 컨설턴트 이중 트랙 협업 구조
-- ============================================================

-- 1) projects.type 제약에 'torque' 추가
-- (기존 제약이 있으면 교체, 없으면 추가)
DO $$
BEGIN
  -- 기존 type 컬럼 제약 이름 확인 후 교체
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%type%' AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_type_check;
  END IF;
END $$;

ALTER TABLE projects
  ADD CONSTRAINT projects_type_check
  CHECK (type IN ('hex','anchor','carriage','eye','wing','torque'));

-- 2) Torque 전용 메타 테이블
CREATE TABLE IF NOT EXISTS project_torque (
  project_id             uuid        PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  engagement_type        text        NOT NULL CHECK (engagement_type IN ('one_time','retainer','hybrid')) DEFAULT 'one_time',
  started_at             date        NOT NULL DEFAULT CURRENT_DATE,
  ended_at               date,                                        -- NULL = 무기한 리테이너
  scope_summary          text,                                        -- 스코프 한 줄 요약
  retainer_monthly_hours int,                                         -- 월 계약 시간
  retainer_hourly_rate_krw int,                                       -- 시간당 단가 (원)
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- 3) 볼트 멤버십 역할 확장 (컨설턴트/팀/옵저버)
CREATE TABLE IF NOT EXISTS bolt_memberships (
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('owner','team','consultant','observer')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bolt_memberships_user   ON bolt_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_bolt_memberships_project ON bolt_memberships(project_id);

-- 4) Thread 설치에 가시성 컬럼 추가
-- (thread_installations 가 없으면 스킵 - migration 115 의존)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'thread_installations' AND table_schema = 'public'
  ) THEN
    ALTER TABLE thread_installations
      ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all'
      CHECK (visibility IN ('all','team_only','consultant_only','owner_only'));
  END IF;
END $$;

-- 5) Thread Kit 정의 테이블
CREATE TABLE IF NOT EXISTS thread_kits (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text        UNIQUE NOT NULL,
  name                 text        NOT NULL,
  description          text,
  target_type          text        NOT NULL CHECK (target_type IN ('nut','bolt')),
  target_subtype       text,                                           -- 'torque', 'hex' 등
  thread_slugs         jsonb       NOT NULL DEFAULT '[]',              -- [{slug, visibility, position, config?}]
  is_default           boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 6) Consulting Kit 시드 데이터
INSERT INTO thread_kits (slug, name, description, target_type, target_subtype, thread_slugs, is_default)
VALUES (
  'consulting-kit',
  '컨설팅 Kit',
  '사업 컨설팅 볼트를 위한 11개 Thread 조합 (팀 미팅·컨설턴트 세션·요청 큐·KPI·마일스톤·산출물·리스크·예산·의사결정·AI Copilot×2)',
  'bolt',
  'torque',
  '[
    {"slug":"team-meetings",         "visibility":"team_only",       "position":10},
    {"slug":"consultant-meetings",   "visibility":"all",             "position":20},
    {"slug":"request-queue",         "visibility":"all",             "position":30},
    {"slug":"kpi-dashboard",         "visibility":"all",             "position":40},
    {"slug":"milestone",             "visibility":"all",             "position":50},
    {"slug":"deliverables",          "visibility":"all",             "position":60},
    {"slug":"risk-register",         "visibility":"all",             "position":70},
    {"slug":"budget",                "visibility":"all",             "position":80},
    {"slug":"decision-log",          "visibility":"all",             "position":90},
    {"slug":"ai-copilot",            "visibility":"team_only",       "position":100, "config":{"mode":"team"}},
    {"slug":"ai-copilot",            "visibility":"consultant_only", "position":110, "config":{"mode":"consultant"}}
  ]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  thread_slugs = EXCLUDED.thread_slugs,
  updated_at   = now();

-- updated_at 컬럼 추가 (ON CONFLICT UPDATE 용)
ALTER TABLE thread_kits
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 7) RLS 정책
ALTER TABLE bolt_memberships ENABLE ROW LEVEL SECURITY;

-- 멤버 본인만 본인 행 조회
CREATE POLICY "bolt_memberships_select"
  ON bolt_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
  );

-- 오너만 삽입/수정/삭제
CREATE POLICY "bolt_memberships_insert"
  ON bolt_memberships FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
    OR project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "bolt_memberships_delete"
  ON bolt_memberships FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
    OR project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- project_torque RLS
ALTER TABLE project_torque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_torque_select"
  ON project_torque FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "project_torque_insert"
  ON project_torque FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "project_torque_update"
  ON project_torque FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
    OR project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- 8) 요청 큐 (consulting_requests) — 향후 Thread 구현 시 사용
CREATE TABLE IF NOT EXISTS consulting_requests (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                 text        NOT NULL,
  body                  text,
  requester_id          uuid        REFERENCES profiles(id),
  assignee_id           uuid        REFERENCES profiles(id),
  request_type          text        CHECK (request_type IN ('advice','analysis','deliverable','introduction','review','other')) DEFAULT 'other',
  priority              text        CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
  status                text        CHECK (status IN ('draft','submitted','accepted','in_progress','delivered','accepted_by_requester','cancelled')) DEFAULT 'draft',
  estimated_hours       numeric,
  actual_hours          numeric     DEFAULT 0,
  due_date              date,
  delivered_at          timestamptz,
  closed_at             timestamptz,
  tags                  text[]      DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consulting_requests_project ON consulting_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_consulting_requests_status  ON consulting_requests(project_id, status);

ALTER TABLE consulting_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulting_requests_member"
  ON consulting_requests FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- 9) 리스크 레지스터 테이블
CREATE TABLE IF NOT EXISTS consulting_risks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  description         text,
  category            text        CHECK (category IN ('market','financial','operational','legal','people','technology','external')),
  likelihood          int         CHECK (likelihood BETWEEN 1 AND 5) DEFAULT 3,
  impact              int         CHECK (impact BETWEEN 1 AND 5) DEFAULT 3,
  mitigation_plan     text,
  mitigation_status   text        CHECK (mitigation_status IN ('identified','analyzing','mitigating','mitigated','accepted','closed')) DEFAULT 'identified',
  owner_id            uuid        REFERENCES profiles(id),
  identified_by       uuid        REFERENCES profiles(id),
  review_due          date,
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consulting_risks_project ON consulting_risks(project_id);

ALTER TABLE consulting_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulting_risks_member"
  ON consulting_risks FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- 10) 의사결정 로그 테이블
CREATE TABLE IF NOT EXISTS consulting_decisions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number              serial,                                                          -- DEC-001 자동 증가
  title               text        NOT NULL,
  context             text,
  options_considered  jsonb       DEFAULT '[]',                                        -- [{option, pros, cons}]
  decision            text        NOT NULL,
  decision_rationale  text,
  consequences        text,
  status              text        CHECK (status IN ('proposed','accepted','superseded','reverted')) DEFAULT 'proposed',
  decision_makers     uuid[]      DEFAULT '{}',
  superseded_by       uuid        REFERENCES consulting_decisions(id),
  decided_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consulting_decisions_project ON consulting_decisions(project_id);

ALTER TABLE consulting_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulting_decisions_member"
  ON consulting_decisions FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );
