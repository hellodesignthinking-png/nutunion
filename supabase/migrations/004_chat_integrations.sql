-- ============================================
-- Chat & External Integrations
-- ============================================

-- Add integration URLs to groups and projects
ALTER TABLE groups ADD COLUMN IF NOT EXISTS kakao_chat_url text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS google_drive_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS kakao_chat_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_drive_url text;

-- Chat messages (Supabase Realtime)
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type text NOT NULL CHECK (room_type IN ('crew', 'project')),
  room_id uuid NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_room ON chat_messages(room_type, room_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at);
CREATE INDEX idx_chat_sender ON chat_messages(sender_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read messages in their rooms
CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "chat_delete" ON chat_messages FOR DELETE USING (
  sender_id = auth.uid() OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
