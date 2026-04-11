-- ============================================
-- Project Meetings (회의록)
-- Allows projects to have their own meetings,
-- reusing meeting_notes via the meetings table.
-- ============================================

-- Add optional project_id column to meetings table
-- so meetings can belong to either a group OR a project
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ALTER COLUMN group_id DROP NOT NULL;

-- Index for project meetings
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);

-- RLS: project members can view project meetings
CREATE POLICY "project_members_select_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = meetings.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- RLS: project members can insert meetings
CREATE POLICY "project_members_insert_meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = meetings.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- RLS: meeting organizer can update
CREATE POLICY "meeting_organizer_update"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    organizer_id = auth.uid()
  );
