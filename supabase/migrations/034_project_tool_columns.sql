-- Missing columns referenced by project settings page
-- These were never migrated but the UI expects them

ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_slack text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_notion text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_drive text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_kakao text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_budget integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_currency text DEFAULT 'KRW';

-- Also allow lead/manager to delete projects (not just admin)
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  created_by = auth.uid() OR
  EXISTS(SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid() AND role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow 'manager' role in project_members
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('lead', 'member', 'observer', 'manager'));
