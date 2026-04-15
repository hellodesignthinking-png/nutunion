-- Staff File Comments — 자료실 파일에 리뷰/답글
CREATE TABLE IF NOT EXISTS staff_file_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES staff_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_file_comments_file ON staff_file_comments(file_id, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_file_comments_user ON staff_file_comments(user_id);

-- RLS
ALTER TABLE staff_file_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_file_comments_select" ON staff_file_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

CREATE POLICY "staff_file_comments_insert" ON staff_file_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

CREATE POLICY "staff_file_comments_delete" ON staff_file_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
