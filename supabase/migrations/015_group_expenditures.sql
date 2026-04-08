-- ============================================
-- Group Expenditures: Financial Tracking & Settlements
-- ============================================

CREATE TABLE IF NOT EXISTS group_expenditures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT '운영비',
  item text NOT NULL,
  amount integer NOT NULL,
  payer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  receipt_url text,
  description text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, paid
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_group_expenditures_group ON group_expenditures(group_id);
CREATE INDEX idx_group_expenditures_payer ON group_expenditures(payer_id);
CREATE INDEX idx_group_expenditures_status ON group_expenditures(status);
CREATE INDEX idx_group_expenditures_date ON group_expenditures(date);

-- RLS (Row Level Security)
ALTER TABLE group_expenditures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view expenditures" ON group_expenditures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_expenditures.group_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Group members can insert expenditures" ON group_expenditures
  FOR INSERT WITH CHECK (
    payer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_expenditures.group_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Group hosts/managers can update expenditures" ON group_expenditures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_expenditures.group_id
      AND user_id = auth.uid()
      AND role IN ('host', 'moderator')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_expenditures.group_id
      AND user_id = auth.uid()
      AND role IN ('host', 'moderator')
      AND status = 'active'
    )
  );

-- Realtime subscriptions for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE group_expenditures;
