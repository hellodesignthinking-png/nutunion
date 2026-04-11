-- ============================================
-- 020: Roadmap Phase Interactions
-- 1) Allow all active group members to INSERT roadmap phases
-- 2) Extend comments CHECK for 'roadmap_phase' target_type
-- 3) Extend reactions CHECK for 'roadmap_phase' target_type
-- ============================================

-- Allow active group members to insert roadmap phases
-- (host/manager/admin keep full modify; members get INSERT only)
DROP POLICY IF EXISTS "roadmap_member_insert" ON group_roadmap_phases;
CREATE POLICY "roadmap_member_insert" ON group_roadmap_phases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_roadmap_phases.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.status = 'active'
    )
  );

-- Extend comments CHECK constraint to include 'roadmap_phase'
DO $$
BEGIN
  BEGIN
    ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
    CHECK (target_type IN ('crew_post','event','meeting','project_update','project_resource','file_attachment','milestone','roadmap_phase'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend reactions CHECK constraint to include 'roadmap_phase'
DO $$
BEGIN
  BEGIN
    ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_target_type_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check
    CHECK (target_type IN ('crew_post','event','meeting','project_update','project_resource','file_attachment','milestone','roadmap_phase'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
