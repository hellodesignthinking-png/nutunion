-- Migration to add social links to profiles and rejection reason to group_members

-- 1. Add social link columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS link_notion text,
ADD COLUMN IF NOT EXISTS link_github text,
ADD COLUMN IF NOT EXISTS link_drive text,
ADD COLUMN IF NOT EXISTS link_website text,
ADD COLUMN IF NOT EXISTS link_instagram text,
ADD COLUMN IF NOT EXISTS link_facebook text;

-- 2. Update group_members to handle rejected status and reason
-- First, add the column
ALTER TABLE group_members
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Second, update the check constraint to include 'rejected'
-- In PostgreSQL, we drop and re-create the check constraint.
DO $$ 
BEGIN
    ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_status_check;
    ALTER TABLE group_members ADD CONSTRAINT group_members_status_check 
    CHECK (status IN ('active', 'pending', 'waitlist', 'rejected'));
EXCEPTION
    WHEN others THEN
        -- Fallback: just try to add it
        ALTER TABLE group_members ADD CONSTRAINT group_members_status_check 
        CHECK (status IN ('active', 'pending', 'waitlist', 'rejected'));
END $$;
