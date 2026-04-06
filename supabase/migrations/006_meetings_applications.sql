-- ============================================
-- Meetings, Project Applications, Integrations
-- ============================================

-- Crew meetings
CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  location text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','in_progress','completed','cancelled')),
  organizer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  next_topic text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Meeting agendas
CREATE TABLE meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  description text,
  duration_min int DEFAULT 10,
  presenter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  resources jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Meeting notes (notes + action items + decisions)
CREATE TABLE meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'note' CHECK (type IN ('note','action_item','decision')),
  content text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project applications
CREATE TABLE project_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  applicant_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  crew_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  message text,
  portfolio_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, applicant_id)
);

-- External integrations
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_type text NOT NULL CHECK (workspace_type IN ('crew','project')),
  workspace_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('slack','notion','webhook','discord')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Webhook logs
CREATE TABLE integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  response_status int,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meetings_group ON meetings(group_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_agendas_meeting ON meeting_agendas(meeting_id);
CREATE INDEX idx_notes_meeting ON meeting_notes(meeting_id);
CREATE INDEX idx_notes_owner ON meeting_notes(owner_id);
CREATE INDEX idx_applications_project ON project_applications(project_id);
CREATE INDEX idx_applications_applicant ON project_applications(applicant_id);
CREATE INDEX idx_applications_status ON project_applications(status);
CREATE INDEX idx_integrations_workspace ON integrations(workspace_type, workspace_id);
CREATE INDEX idx_logs_integration ON integration_logs(integration_id);

-- RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Meetings: crew members can see, host/organizer can manage
CREATE POLICY "meetings_select" ON meetings FOR SELECT USING (true);
CREATE POLICY "meetings_insert" ON meetings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "meetings_update" ON meetings FOR UPDATE USING (
  organizer_id = auth.uid() OR EXISTS(SELECT 1 FROM group_members WHERE group_id = meetings.group_id AND user_id = auth.uid() AND role = 'host')
);
CREATE POLICY "meetings_delete" ON meetings FOR DELETE USING (
  organizer_id = auth.uid() OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Agendas
CREATE POLICY "agendas_select" ON meeting_agendas FOR SELECT USING (true);
CREATE POLICY "agendas_insert" ON meeting_agendas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "agendas_update" ON meeting_agendas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "agendas_delete" ON meeting_agendas FOR DELETE USING (auth.role() = 'authenticated');

-- Notes
CREATE POLICY "notes_select" ON meeting_notes FOR SELECT USING (true);
CREATE POLICY "notes_insert" ON meeting_notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notes_update" ON meeting_notes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "notes_delete" ON meeting_notes FOR DELETE USING (auth.role() = 'authenticated');

-- Applications: applicants see their own, project leads see all for their project
CREATE POLICY "apps_select" ON project_applications FOR SELECT USING (
  applicant_id = auth.uid() OR
  EXISTS(SELECT 1 FROM project_members WHERE project_id = project_applications.project_id AND user_id = auth.uid() AND role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "apps_insert" ON project_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "apps_update" ON project_applications FOR UPDATE USING (
  applicant_id = auth.uid() OR
  EXISTS(SELECT 1 FROM project_members WHERE project_id = project_applications.project_id AND user_id = auth.uid() AND role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Integrations
CREATE POLICY "integrations_select" ON integrations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "integrations_insert" ON integrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "integrations_update" ON integrations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "integrations_delete" ON integrations FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "logs_select" ON integration_logs FOR SELECT USING (auth.role() = 'authenticated');
