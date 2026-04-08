-- Project Resources (file/document management with 4-stage classification)
CREATE TABLE IF NOT EXISTS project_resources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  type text NOT NULL DEFAULT 'file', -- file, google_doc, google_sheet, notion, link
  stage text NOT NULL DEFAULT 'planning', -- planning, interim, evidence, final
  uploaded_by uuid REFERENCES auth.users(id),
  file_size bigint,
  mime_type text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Project Finance (budget tracking with receipts)
CREATE TABLE IF NOT EXISTS project_finance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount integer NOT NULL, -- in KRW
  type text NOT NULL DEFAULT 'expense', -- expense, income, budget_allocation
  category text DEFAULT 'general', -- general, personnel, tools, marketing, other
  milestone_id uuid REFERENCES project_milestones(id),
  receipt_url text,
  description text,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz DEFAULT now()
);

-- Action Items (from split view - quick task creation)
CREATE TABLE IF NOT EXISTS project_action_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open', -- open, in_progress, done
  priority text DEFAULT 'medium', -- low, medium, high, urgent
  assigned_to uuid REFERENCES auth.users(id),
  source_url text, -- which document it came from
  due_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE project_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (project members can read, leads can write)
CREATE POLICY "Project members can view resources" ON project_resources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = project_resources.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can insert resources" ON project_resources
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = project_resources.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can view finance" ON project_finance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_finance.project_id AND pm.user_id = auth.uid() AND pm.role IN ('lead', 'manager'))
  );

CREATE POLICY "Project leads can insert finance" ON project_finance
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_finance.project_id AND pm.user_id = auth.uid() AND pm.role IN ('lead', 'manager'))
  );

CREATE POLICY "Project members can view action items" ON project_action_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = project_action_items.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can manage action items" ON project_action_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = project_action_items.project_id AND user_id = auth.uid())
  );
