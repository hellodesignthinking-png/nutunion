-- ============================================
-- NutUnion: Projects & Community System
-- ============================================

-- Extend profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_create_crew boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

-- Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','archived')),
  category text CHECK (category IN ('space','culture','platform','vibe')),
  image_url text,
  start_date date,
  end_date date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project members (users or crews)
CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  crew_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead','member','observer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (user_id IS NOT NULL AND crew_id IS NULL) OR
    (user_id IS NULL AND crew_id IS NOT NULL)
  ),
  UNIQUE (project_id, user_id),
  UNIQUE (project_id, crew_id)
);

-- Project milestones
CREATE TABLE project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  due_date date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project tasks
CREATE TABLE project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES project_milestones(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project activity feed
CREATE TABLE project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'post' CHECK (type IN ('post','milestone_update','status_change','member_joined')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Crew activity feed
CREATE TABLE crew_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'post' CHECK (type IN ('post','announcement','event_recap')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link events to projects
ALTER TABLE events ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_user ON project_members(user_id);
CREATE INDEX idx_pm_crew ON project_members(crew_id);
CREATE INDEX idx_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_tasks_milestone ON project_tasks(milestone_id);
CREATE INDEX idx_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_updates_project ON project_updates(project_id);
CREATE INDEX idx_crew_posts_group ON crew_posts(group_id);
CREATE INDEX idx_events_project ON events(project_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_posts ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "projects_select" ON projects FOR SELECT USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND (can_create_crew = true OR role = 'admin'))
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  created_by = auth.uid() OR
  EXISTS(SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = auth.uid() AND role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Project members
CREATE POLICY "pm_select" ON project_members FOR SELECT USING (true);
CREATE POLICY "pm_insert" ON project_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pm_update" ON project_members FOR UPDATE USING (
  EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "pm_delete" ON project_members FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid() AND pm.role = 'lead') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Milestones
CREATE POLICY "ms_select" ON project_milestones FOR SELECT USING (true);
CREATE POLICY "ms_insert" ON project_milestones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ms_update" ON project_milestones FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ms_delete" ON project_milestones FOR DELETE USING (auth.role() = 'authenticated');

-- Tasks
CREATE POLICY "tasks_select" ON project_tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert" ON project_tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tasks_update" ON project_tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_delete" ON project_tasks FOR DELETE USING (auth.role() = 'authenticated');

-- Updates
CREATE POLICY "updates_select" ON project_updates FOR SELECT USING (true);
CREATE POLICY "updates_insert" ON project_updates FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "updates_delete" ON project_updates FOR DELETE USING (
  author_id = auth.uid() OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Crew posts
CREATE POLICY "cp_select" ON crew_posts FOR SELECT USING (true);
CREATE POLICY "cp_insert" ON crew_posts FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS(SELECT 1 FROM group_members WHERE group_id = crew_posts.group_id AND user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "cp_delete" ON crew_posts FOR DELETE USING (
  author_id = auth.uid() OR
  EXISTS(SELECT 1 FROM group_members WHERE group_id = crew_posts.group_id AND user_id = auth.uid() AND role = 'host') OR
  EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
