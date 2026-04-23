-- ============================================================
-- Migration 118: 컨설팅 모듈 Addon 테이블
-- 기존 볼트에 컨설팅 모듈을 추가할 수 있는 모듈 시스템
-- ============================================================

CREATE TABLE IF NOT EXISTS project_consulting_addons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key         text        NOT NULL,   -- 모듈 식별자 (e.g. 'request-queue', 'risk-register')
  config      jsonb       DEFAULT '{}',
  installed_by uuid       REFERENCES profiles(id),
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_consulting_addons_project
  ON project_consulting_addons(project_id);

ALTER TABLE project_consulting_addons ENABLE ROW LEVEL SECURITY;

-- 멤버·오너만 조회
DROP POLICY IF EXISTS "consulting_addons_select" ON project_consulting_addons;
CREATE POLICY "consulting_addons_select"
  ON project_consulting_addons FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- 오너·팀만 추가
DROP POLICY IF EXISTS "consulting_addons_insert" ON project_consulting_addons;
CREATE POLICY "consulting_addons_insert"
  ON project_consulting_addons FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role IN ('owner','team'))
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('lead','member'))
  );

-- 오너·팀만 삭제
DROP POLICY IF EXISTS "consulting_addons_delete" ON project_consulting_addons;
CREATE POLICY "consulting_addons_delete"
  ON project_consulting_addons FOR DELETE
  USING (
    project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    OR project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role IN ('owner','team'))
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('lead','member'))
  );
