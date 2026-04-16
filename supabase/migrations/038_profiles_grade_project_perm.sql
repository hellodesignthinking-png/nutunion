-- ============================================
-- Add grade and can_create_project columns to profiles
-- (idempotent — safe to run multiple times)
-- ============================================

-- 1. Add grade column (bronze / silver / gold / vip)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT 'bronze';

-- 2. Add project creation permission
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_create_project boolean NOT NULL DEFAULT false;

-- 3. Backfill existing users based on their current permissions
UPDATE profiles SET grade = 'silver'
  WHERE can_create_crew = true AND role != 'admin' AND (grade IS NULL OR grade = 'bronze');

UPDATE profiles SET grade = 'vip', can_create_project = true
  WHERE role = 'admin';

-- 4. Index for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_grade ON profiles(grade);
