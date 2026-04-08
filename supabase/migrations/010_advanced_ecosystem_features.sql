-- 010_advanced_ecosystem_features.sql

-- Add milestone settlement fields
ALTER TABLE project_milestones 
ADD COLUMN IF NOT EXISTS reward_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- Add project snapshot field (for "archived" state persistent content)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS snapshot_content TEXT,
ADD COLUMN IF NOT EXISTS milestone_dashboard_url TEXT; -- Already added but ensuring

-- Add project launch status (for ZeroSite integration)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS zerosite_launch_status TEXT DEFAULT 'idle', -- idle, pending, launched, rejected
ADD COLUMN IF NOT EXISTS zerosite_launch_reason TEXT;

-- Create a view for refined talent searching (Project Ready indicators)
CREATE OR REPLACE VIEW talent_stats AS
SELECT 
    p.id AS profile_id,
    p.nickname,
    p.avatar_url,
    p.skill_tags,
    p.tier,
    p.activity_score,
    p.points,
    p.specialty,
    (SELECT COUNT(*) FROM meeting_attendances ma WHERE ma.user_id = p.id) AS total_attendances,
    (SELECT COUNT(*) FROM meetings m WHERE m.secretary_id = p.id OR m.speaker_id = p.id) AS leadership_count,
    (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = p.id) AS project_count
FROM profiles p;
