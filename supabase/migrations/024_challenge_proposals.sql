-- =====================================================
-- 024: Challenge Proposals (의뢰 시스템)
-- =====================================================
-- Flow: 의뢰 제출 → 관리자 검토 → 프로젝트 전환 & PM 배정

CREATE TABLE IF NOT EXISTS challenge_proposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 의뢰자 정보
  company_name  text NOT NULL,
  contact_email text NOT NULL,
  contact_name  text,
  contact_phone text,
  -- 프로젝트 정보
  project_title text NOT NULL,
  description   text,
  budget        text,                -- small / medium / large / tbd
  timeline      text,                -- urgent / normal / long
  required_skills text[] DEFAULT '{}',
  -- 상태 관리
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'converted')),
  admin_notes   text,
  reject_reason text,
  -- 프로젝트 전환 시
  converted_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  assigned_pm_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- 제출자 (로그인 사용자인 경우)
  submitted_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- 타임스탬프
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_proposals_status ON challenge_proposals(status);
CREATE INDEX IF NOT EXISTS idx_challenge_proposals_created ON challenge_proposals(created_at DESC);

-- RLS
ALTER TABLE challenge_proposals ENABLE ROW LEVEL SECURITY;

-- 누구나 의뢰 제출 가능 (비로그인도 API로 제출 가능)
CREATE POLICY "Anyone can insert proposals"
  ON challenge_proposals FOR INSERT
  WITH CHECK (true);

-- 본인 의뢰 조회
CREATE POLICY "Users can view own proposals"
  ON challenge_proposals FOR SELECT
  USING (submitted_by = auth.uid());

-- 관리자는 모든 의뢰 조회/수정
CREATE POLICY "Admins can do anything with proposals"
  ON challenge_proposals FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_challenge_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_challenge_proposals_updated_at
  BEFORE UPDATE ON challenge_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_proposals_updated_at();
