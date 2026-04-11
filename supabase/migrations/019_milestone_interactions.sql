-- ============================================
-- 019: Milestone Interactions
-- 1) Add milestone_id to project_resources
-- 2) Extend comments/reactions CHECK for 'milestone' target_type
-- ============================================

-- Add milestone_id FK to project_resources for linking resources to milestones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_resources' AND column_name = 'milestone_id'
  ) THEN
    ALTER TABLE project_resources
      ADD COLUMN milestone_id uuid REFERENCES project_milestones(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_resources_milestone ON project_resources(milestone_id);

-- Extend comments CHECK constraint to include 'milestone'
-- Drop old constraint and recreate (safe approach)
DO $$
BEGIN
  -- Try to drop existing constraint
  BEGIN
    ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  -- Add new constraint including 'milestone'
  ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
    CHECK (target_type IN ('crew_post','event','meeting','project_update','project_resource','file_attachment','milestone'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend reactions CHECK constraint to include 'milestone'
DO $$
BEGIN
  BEGIN
    ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_target_type_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check
    CHECK (target_type IN ('crew_post','event','meeting','project_update','project_resource','file_attachment','milestone'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
