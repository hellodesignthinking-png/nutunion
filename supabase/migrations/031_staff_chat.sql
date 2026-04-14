-- Staff Chat Messages — flexible room-based messaging for staff platform
-- Supports: team channels, project channels, DMs, Google Chat bridge

CREATE TABLE IF NOT EXISTS staff_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,          -- e.g. "team-general", "project-{uuid}", "dm-{uid1}-{uid2}"
  room_type text NOT NULL DEFAULT 'team' CHECK (room_type IN ('team', 'project', 'dm')),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',    -- { sender_name, attachments, etc. }
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_staff_chat_room ON staff_chat_messages(room_id, created_at DESC);
CREATE INDEX idx_staff_chat_sender ON staff_chat_messages(sender_id);

-- RLS
ALTER TABLE staff_chat_messages ENABLE ROW LEVEL SECURITY;

-- Staff/Admin can read all staff chat messages
CREATE POLICY "staff_chat_select" ON staff_chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

-- Staff/Admin can insert own messages
CREATE POLICY "staff_chat_insert" ON staff_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

-- Delete own messages or admin
CREATE POLICY "staff_chat_delete" ON staff_chat_messages
  FOR DELETE USING (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE staff_chat_messages;
