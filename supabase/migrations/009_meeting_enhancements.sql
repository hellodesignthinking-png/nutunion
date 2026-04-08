-- ============================================
-- Meeting Enhancements: Resources, Issues, Attendance
-- ============================================

-- 1. Shared Resources
CREATE TABLE IF NOT EXISTS meeting_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('drive', 'article', 'paper', 'link')),
  description text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Resource Replies
CREATE TABLE IF NOT EXISTS meeting_resource_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES meeting_resources(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Meeting Issues
CREATE TABLE IF NOT EXISTS meeting_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Meeting Attendance
CREATE TABLE IF NOT EXISTS meeting_attendances (
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mres_meeting ON meeting_resources(meeting_id);
CREATE INDEX IF NOT EXISTS idx_mreply_res ON meeting_resource_replies(resource_id);
CREATE INDEX IF NOT EXISTS idx_missue_meeting ON meeting_issues(meeting_id);

-- RLS
ALTER TABLE meeting_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_resource_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mres_select" ON meeting_resources FOR SELECT USING (true);
CREATE POLICY "mres_insert" ON meeting_resources FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "mreply_select" ON meeting_resource_replies FOR SELECT USING (true);
CREATE POLICY "mreply_insert" ON meeting_resource_replies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "missue_select" ON meeting_issues FOR SELECT USING (true);
CREATE POLICY "missue_modify" ON meeting_issues FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "matt_select" ON meeting_attendances FOR SELECT USING (true);
CREATE POLICY "matt_modify" ON meeting_attendances FOR ALL USING (auth.role() = 'authenticated');
