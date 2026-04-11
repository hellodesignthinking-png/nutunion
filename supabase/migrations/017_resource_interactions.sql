-- 017: Resource interactions (likes, comments) + reward_ratio for project members
-- Date: 2026-04-09

-- ─── 1. Extend comments table to support resource targets ───
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('project_update', 'crew_post', 'project_resource', 'file_attachment'));

-- Add optional parent_id for threaded replies
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- ─── 2. Extend reactions table to support resource targets ───
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_target_type_check;
ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check
  CHECK (target_type IN ('project_update', 'crew_post', 'comment', 'chat_message', 'project_resource', 'file_attachment'));

-- ─── 3. Add reward_ratio to project_members ───
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS reward_ratio INTEGER DEFAULT 0;

-- ─── 4. Indexes for performance ───
CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(target_type, target_id) WHERE target_type IN ('project_resource', 'file_attachment');
CREATE INDEX IF NOT EXISTS idx_reactions_resource ON reactions(target_type, target_id) WHERE target_type IN ('project_resource', 'file_attachment');
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
