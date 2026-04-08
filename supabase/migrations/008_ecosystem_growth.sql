-- ============================================
-- Ecosystem Growth: Points, Skills, Tiers, Brdiging
-- ============================================

-- 1. Profile Enhancements (Points & Skills)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS points int DEFAULT 0,
ADD COLUMN IF NOT EXISTS skill_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'scout' CHECK (tier IN ('scout', 'settler', 'pioneer', 'master')),
ADD COLUMN IF NOT EXISTS activity_score int DEFAULT 0;

-- 2. Group Enhancements (Verified Status & Activity)
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS activity_index int DEFAULT 0;

-- 3. Membership Enhancements (Contribution)
ALTER TABLE group_members
ADD COLUMN IF NOT EXISTS contribution_score int DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_role text DEFAULT 'member';

-- 4. Meeting Enhancements (Session Logs)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS secretary_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS speaker_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS log_url text, -- For Notion/Docs link
ADD COLUMN IF NOT EXISTS contribution_data jsonb DEFAULT '{}';

-- 5. Project Enhancements (Rewards)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS reward_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_currency text DEFAULT 'KRW',
ADD COLUMN IF NOT EXISTS milestone_dashboard_url text;

-- 6. Activity Logs (Point System)
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL, -- 'meeting_log', 'project_milestone', 'crew_join', etc.
  points_earned int NOT NULL DEFAULT 0,
  target_type text, -- 'group', 'project', 'meeting'
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Project Portfolios (Showcase)
CREATE TABLE project_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  contribution_summary text,
  skills_used text[] DEFAULT '{}',
  reward_received numeric,
  is_public boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- Indexes
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(action_type);
CREATE INDEX idx_portfolios_user ON project_portfolios(user_id);
CREATE INDEX idx_portfolios_project ON project_portfolios(project_id);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "portfolios_select" ON project_portfolios FOR SELECT USING (true);
CREATE POLICY "portfolios_modify" ON project_portfolios FOR ALL USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Trigger for basic point awarding (Example: joining a group)
CREATE OR REPLACE FUNCTION award_points_on_crew_join()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status <> 'active') THEN
    INSERT INTO activity_logs (user_id, action_type, points_earned, target_type, target_id)
    VALUES (NEW.user_id, 'crew_join', 10, 'group', NEW.group_id);
    
    UPDATE profiles SET points = points + 10 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_activated
  AFTER INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION award_points_on_crew_join();
