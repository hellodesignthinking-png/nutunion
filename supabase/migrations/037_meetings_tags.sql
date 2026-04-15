-- Add tags column to meetings table
-- Also ensures group_roadmap_phases exists (may have been missed in production)

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS tags text[];

-- Ensure group_roadmap_phases table exists
CREATE TABLE IF NOT EXISTS group_roadmap_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done')),
  "order" int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE group_roadmap_phases ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='group_roadmap_phases' AND policyname='roadmap_select'
  ) THEN
    CREATE POLICY "roadmap_select" ON group_roadmap_phases FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='group_roadmap_phases' AND policyname='roadmap_modify'
  ) THEN
    CREATE POLICY "roadmap_modify" ON group_roadmap_phases FOR ALL USING (
      auth.uid() IN (
        SELECT host_id FROM groups WHERE id = group_roadmap_phases.group_id
      )
      OR auth.uid() IN (
        SELECT user_id FROM group_members
        WHERE group_id = group_roadmap_phases.group_id AND status = 'active'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_roadmap_group ON group_roadmap_phases(group_id);
