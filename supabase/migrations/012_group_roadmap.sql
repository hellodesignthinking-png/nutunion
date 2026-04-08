-- Add topic to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic TEXT;

-- Create group_roadmap_phases table
CREATE TABLE IF NOT EXISTS group_roadmap_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done')),
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE group_roadmap_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmap_select" ON group_roadmap_phases FOR SELECT USING (true);
CREATE POLICY "roadmap_modify" ON group_roadmap_phases FOR ALL USING (
    EXISTS (
        SELECT 1 FROM groups 
        WHERE id = group_id 
        AND (host_id = auth.uid() OR EXISTS (
            SELECT 1 FROM group_members 
            WHERE group_id = group_roadmap_phases.group_id 
            AND user_id = auth.uid() 
            AND role = 'manager'
        ))
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Index
CREATE INDEX idx_roadmap_group ON group_roadmap_phases(group_id);
