-- Update group_members role check constraint to include 'manager'
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE group_members ADD CONSTRAINT group_members_role_check CHECK (role IN ('member', 'host', 'moderator', 'manager'));
