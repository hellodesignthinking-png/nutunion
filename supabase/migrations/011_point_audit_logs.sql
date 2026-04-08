-- Add point_logs table to track Nut Points
CREATE TABLE IF NOT EXISTS point_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL,
    type text NOT NULL, -- earn, spend, adjust
    reason text NOT NULL,
    metadata jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger to update points in profiles when a log is added
CREATE OR REPLACE FUNCTION update_profile_points()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET points = COALESCE(points, 0) + NEW.amount
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_points
AFTER INSERT ON point_logs
FOR EACH ROW
EXECUTE FUNCTION update_profile_points();

-- Enable RLS
ALTER TABLE point_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "point_logs_select" ON point_logs FOR SELECT USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
