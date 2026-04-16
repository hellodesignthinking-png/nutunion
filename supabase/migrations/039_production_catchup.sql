-- ============================================================
-- 039: Production Catch-up Migration
-- Applies all tables/columns not yet in production DB.
-- Safe to run multiple times (idempotent).
-- Run this in Supabase SQL Editor once.
-- ============================================================

-- ── 1. meeting_resources and related tables (from 009) ──────
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

CREATE TABLE IF NOT EXISTS meeting_resource_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES meeting_resources(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_attendances (
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mres_meeting ON meeting_resources(meeting_id);
CREATE INDEX IF NOT EXISTS idx_mreply_res ON meeting_resource_replies(resource_id);
CREATE INDEX IF NOT EXISTS idx_missue_meeting ON meeting_issues(meeting_id);

ALTER TABLE meeting_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_resource_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_resources' AND policyname='mres_select') THEN
    CREATE POLICY "mres_select" ON meeting_resources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_resources' AND policyname='mres_insert') THEN
    CREATE POLICY "mres_insert" ON meeting_resources FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_resource_replies' AND policyname='mreply_select') THEN
    CREATE POLICY "mreply_select" ON meeting_resource_replies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_resource_replies' AND policyname='mreply_insert') THEN
    CREATE POLICY "mreply_insert" ON meeting_resource_replies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_issues' AND policyname='missue_select') THEN
    CREATE POLICY "missue_select" ON meeting_issues FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_issues' AND policyname='missue_modify') THEN
    CREATE POLICY "missue_modify" ON meeting_issues FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_attendances' AND policyname='matt_select') THEN
    CREATE POLICY "matt_select" ON meeting_attendances FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meeting_attendances' AND policyname='matt_modify') THEN
    CREATE POLICY "matt_modify" ON meeting_attendances FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ── 2. project_milestones extra columns (from 010) ──────────
ALTER TABLE project_milestones
  ADD COLUMN IF NOT EXISTS reward_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- ── 3. projects extra columns (from 010 + 034) ──────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS snapshot_content TEXT,
  ADD COLUMN IF NOT EXISTS milestone_dashboard_url TEXT,
  ADD COLUMN IF NOT EXISTS zerosite_launch_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS zerosite_launch_reason TEXT,
  ADD COLUMN IF NOT EXISTS tool_slack TEXT,
  ADD COLUMN IF NOT EXISTS tool_notion TEXT,
  ADD COLUMN IF NOT EXISTS tool_drive TEXT,
  ADD COLUMN IF NOT EXISTS tool_kakao TEXT,
  ADD COLUMN IF NOT EXISTS total_budget INTEGER,
  ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'KRW';

-- ── 4. project_members: allow 'manager' role (from 034) ─────
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('lead', 'member', 'observer', 'manager'));

-- ── 5. group_expenditures table (from 015) ──────────────────
CREATE TABLE IF NOT EXISTS group_expenditures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT '운영비',
  item text NOT NULL,
  amount integer NOT NULL,
  payer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  receipt_url text,
  description text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_expenditures_group ON group_expenditures(group_id);
CREATE INDEX IF NOT EXISTS idx_group_expenditures_payer ON group_expenditures(payer_id);
CREATE INDEX IF NOT EXISTS idx_group_expenditures_status ON group_expenditures(status);
CREATE INDEX IF NOT EXISTS idx_group_expenditures_date ON group_expenditures(date);

ALTER TABLE group_expenditures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_expenditures' AND policyname='Group members can view expenditures') THEN
    CREATE POLICY "Group members can view expenditures" ON group_expenditures
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM group_members WHERE group_id = group_expenditures.group_id AND user_id = auth.uid() AND status = 'active')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_expenditures' AND policyname='Group members can insert expenditures') THEN
    CREATE POLICY "Group members can insert expenditures" ON group_expenditures
      FOR INSERT WITH CHECK (
        payer_id = auth.uid() AND
        EXISTS (SELECT 1 FROM group_members WHERE group_id = group_expenditures.group_id AND user_id = auth.uid() AND status = 'active')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_expenditures' AND policyname='Group hosts/managers can update expenditures') THEN
    CREATE POLICY "Group hosts/managers can update expenditures" ON group_expenditures
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM group_members WHERE group_id = group_expenditures.group_id AND user_id = auth.uid() AND role IN ('host', 'moderator') AND status = 'active')
      );
  END IF;
END $$;

-- ── 6. best_practices table (from 018) ──────────────────────
CREATE TABLE IF NOT EXISTS best_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('meeting','resource','session')),
  source_id uuid NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}',
  target_type text NOT NULL CHECK (target_type IN ('curriculum','guideline','template')),
  promoted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_best_practices_group ON best_practices(group_id);
CREATE INDEX IF NOT EXISTS idx_best_practices_target ON best_practices(target_type);
CREATE INDEX IF NOT EXISTS idx_best_practices_tags ON best_practices USING gin(tags);

ALTER TABLE best_practices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='best_practices' AND policyname='bp_select') THEN
    CREATE POLICY "bp_select" ON best_practices FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='best_practices' AND policyname='bp_insert') THEN
    CREATE POLICY "bp_insert" ON best_practices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='best_practices' AND policyname='bp_update') THEN
    CREATE POLICY "bp_update" ON best_practices FOR UPDATE USING (promoted_by = auth.uid());
  END IF;
END $$;

-- ── 7. notifications extra columns (from 018) ───────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix notifications INSERT policy (403 error)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_insert') THEN
    CREATE POLICY "notifications_insert" ON notifications
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(user_id, category);

-- ── 8. profiles grade columns (from 038) ────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS can_create_project boolean NOT NULL DEFAULT false;

UPDATE profiles SET grade = 'silver'
  WHERE can_create_crew = true AND role != 'admin' AND (grade IS NULL OR grade = 'bronze');

UPDATE profiles SET grade = 'vip', can_create_project = true
  WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_profiles_grade ON profiles(grade);

-- ── 9. Refresh PostgREST schema cache ───────────────────────
NOTIFY pgrst, 'reload schema';
