-- ============================================================
-- Seeding: Taina의 실제 사업 5개 Torque Bolt 초기 데이터
-- 실행 전: 116_torque_bolt_consulting.sql 마이그레이션 완료 필요
-- ============================================================

DO $$
DECLARE
  taina_id    uuid;
  p1_id       uuid := gen_random_uuid();  -- FlagtaleCafe 브랜드 리뉴얼
  p2_id       uuid := gen_random_uuid();  -- ZeroSite 사회적기업 인증
  p3_id       uuid := gen_random_uuid();  -- SecondWind 시장 진입
  p4_id       uuid := gen_random_uuid();  -- 양평 타운하우스 개발
  p5_id       uuid := gen_random_uuid();  -- Antenna 법인 거버넌스
BEGIN
  SELECT id INTO taina_id
  FROM profiles
  WHERE role = 'admin'
  ORDER BY created_at
  LIMIT 1;

  IF taina_id IS NULL THEN
    RAISE NOTICE 'Admin 계정을 찾을 수 없습니다. 첫 번째 프로필을 사용합니다.';
    SELECT id INTO taina_id FROM profiles ORDER BY created_at LIMIT 1;
  END IF;

  IF taina_id IS NULL THEN
    RAISE EXCEPTION '프로필이 없습니다. 먼저 계정을 생성해주세요.';
  END IF;

  RAISE NOTICE '사용자 ID: %', taina_id;

  -- 1. FlagtaleCafe 브랜드 리뉴얼
  INSERT INTO projects (
    id, title, description, type, status, category,
    start_date, created_by, created_at, updated_at
  ) VALUES (
    p1_id,
    'FlagtaleCafe 브랜드 리뉴얼',
    '3지점 확장을 앞두고 FlagtaleCafe의 브랜드 아이덴티티를 재정립합니다. 외부 브랜딩 컨설턴트와 함께 로고·공간·디지털 채널을 통합 설계합니다.',
    'torque', 'active', 'space',
    CURRENT_DATE - 14,
    taina_id, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO project_torque (
    project_id, engagement_type, started_at, scope_summary,
    retainer_monthly_hours, retainer_hourly_rate_krw
  ) VALUES (
    p1_id, 'retainer', CURRENT_DATE - 14,
    '3지점 확장 대비 브랜드 아이덴티티 재정립 및 디지털 채널 통합',
    40, 150000
  )
  ON CONFLICT (project_id) DO NOTHING;

  INSERT INTO bolt_memberships (project_id, user_id, role)
  VALUES (p1_id, taina_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (p1_id, taina_id, 'lead')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO consulting_risks (project_id, title, category, likelihood, impact, mitigation_status, identified_by)
  VALUES
    (p1_id, '3지점 동시 공사로 인한 브랜드 개편 지연', 'operational', 3, 4, 'identified', taina_id),
    (p1_id, '기존 단골 고객의 리브랜딩 거부감', 'market', 2, 3, 'analyzing', taina_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO consulting_decisions (project_id, title, context, decision, status, decided_at)
  VALUES (
    p1_id,
    '"FlagtaleCafe"로 네이밍 통일',
    '3지점 확장을 앞두고 각 지점 명칭이 상이하여 브랜드 혼선 발생',
    '기존 "Flagtale" 자산을 활용하여 "FlagtaleCafe"로 전체 통일. 신규 로고 개발.',
    'accepted',
    NOW() - INTERVAL '7 days'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO consulting_requests (project_id, title, body, requester_id, request_type, priority, status, estimated_hours, actual_hours)
  VALUES
    (p1_id, '경쟁사 카페 브랜딩 분석 요약본', '강남·홍대·성수 지역 프리미엄 카페 5곳의 브랜딩 전략 분석 요청', taina_id, 'analysis', 'high', 'in_progress', 6, 3),
    (p1_id, '3지점 공간 컨셉 가이드라인', '각 지점 특성을 살리면서 브랜드 통일성을 유지하는 공간 컨셉 방향성', taina_id, 'deliverable', 'normal', 'submitted', 8, 0)
  ON CONFLICT DO NOTHING;

  -- 2. ZeroSite 사회적기업 인증
  INSERT INTO projects (
    id, title, description, type, status, category,
    start_date, end_date, created_by, created_at, updated_at
  ) VALUES (
    p2_id,
    'ZeroSite 사회적기업 인증 지원',
    'ZeroSite의 사회적기업 인증 신청을 위한 전문 컨설팅. 사회적 가치 측정, 요건 검토, 서류 작성을 지원합니다.',
    'torque', 'active', 'platform',
    CURRENT_DATE - 30,
    CURRENT_DATE + 60,
    taina_id, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO project_torque (
    project_id, engagement_type, started_at, ended_at, scope_summary
  ) VALUES (
    p2_id, 'one_time', CURRENT_DATE - 30, CURRENT_DATE + 60,
    '사회적기업 인증 신청 서류 작성 및 요건 충족 지원 (3개월 프로젝트)'
  )
  ON CONFLICT (project_id) DO NOTHING;

  INSERT INTO bolt_memberships (project_id, user_id, role)
  VALUES (p2_id, taina_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (p2_id, taina_id, 'lead')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO consulting_risks (project_id, title, category, likelihood, impact, mitigation_status, identified_by)
  VALUES
    (p2_id, '사회적 가치 측정 기준 충족 미달', 'legal', 3, 5, 'mitigating', taina_id),
    (p2_id, '정부 인증 심사 일정 지연', 'external', 2, 3, 'accepted', taina_id)
  ON CONFLICT DO NOTHING;

  -- 3. SecondWind 시장 진입 자문
  INSERT INTO projects (
    id, title, description, type, status, category,
    start_date, created_by, created_at, updated_at
  ) VALUES (
    p3_id,
    'SecondWind 제품 시장 진입 자문',
    'SecondWind 러닝 앱의 타겟 검증과 런칭 전략. 러닝업계 베테랑 컨설턴트와 함께 MZ러너 시장 진입 로드맵을 설계합니다.',
    'torque', 'active', 'platform',
    CURRENT_DATE - 7,
    taina_id, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO project_torque (
    project_id, engagement_type, started_at, scope_summary,
    retainer_monthly_hours, retainer_hourly_rate_krw
  ) VALUES (
    p3_id, 'hybrid', CURRENT_DATE - 7,
    'MZ러너 타겟 검증 → 베타 런칭 → 그로스 전략 수립 (3개월 집중 + 리테이너 전환)',
    20, 200000
  )
  ON CONFLICT (project_id) DO NOTHING;

  INSERT INTO bolt_memberships (project_id, user_id, role)
  VALUES (p3_id, taina_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (p3_id, taina_id, 'lead')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO consulting_requests (project_id, title, body, requester_id, request_type, priority, status, estimated_hours, actual_hours)
  VALUES
    (p3_id, '국내 러닝앱 시장 현황 분석', 'Nike Run Club, Strava, 런데이, 삼성 러닝 등 주요 플레이어 포지셔닝 분석', taina_id, 'analysis', 'high', 'accepted', 10, 0),
    (p3_id, '베타 테스터 모집 전략 조언', '초기 200명 베타 유저 확보 방안 (러닝 커뮤니티 접근법)', taina_id, 'advice', 'normal', 'submitted', 3, 0)
  ON CONFLICT DO NOTHING;

  -- 4. 양평 타운하우스 개발 자문
  INSERT INTO projects (
    id, title, description, type, status, category,
    start_date, end_date, created_by, created_at, updated_at
  ) VALUES (
    p4_id,
    '양평 타운하우스 개발 자문',
    '양평 리버티랜드 타운하우스 인허가 및 사업성 검토. 부동산 개발 전문 컨설턴트와 함께 M&A 및 공동개발 구조를 설계합니다.',
    'torque', 'active', 'space',
    CURRENT_DATE - 45,
    CURRENT_DATE + 90,
    taina_id, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO project_torque (
    project_id, engagement_type, started_at, ended_at, scope_summary
  ) VALUES (
    p4_id, 'one_time', CURRENT_DATE - 45, CURRENT_DATE + 90,
    '양평 타운하우스 인허가 요건 검토 + M&A/공동개발 구조 설계 + 사업성 분석'
  )
  ON CONFLICT (project_id) DO NOTHING;

  INSERT INTO bolt_memberships (project_id, user_id, role)
  VALUES (p4_id, taina_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (p4_id, taina_id, 'lead')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO consulting_risks (project_id, title, category, likelihood, impact, mitigation_status, identified_by)
  VALUES
    (p4_id, '개발행위허가 심사 지연', 'legal', 4, 5, 'identified', taina_id),
    (p4_id, '토지 소유자 M&A 협상 결렬', 'financial', 3, 5, 'analyzing', taina_id),
    (p4_id, '공사비 원자재 가격 상승', 'financial', 3, 3, 'accepted', taina_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO consulting_decisions (project_id, title, context, decision, status, decided_at)
  VALUES (
    p4_id,
    '공동개발 구조로 사업 추진',
    '단독 시행 시 자본 조달 리스크가 높고, 토지 소유자가 현물출자 방식을 선호함',
    '기존 토지 소유자와 공동개발 법인(SPC) 설립. 수익 배분 6:4 (소유자:개발자)',
    'accepted',
    NOW() - INTERVAL '3 days'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Antenna 법인 거버넌스 재편
  INSERT INTO projects (
    id, title, description, type, status, category,
    start_date, created_by, created_at, updated_at
  ) VALUES (
    p5_id,
    'Antenna 법인 거버넌스 재편',
    'Antenna 홀딩스의 법인 구조 재편성. 법무·재무 전문 컨설턴트와 함께 지분 구조, 이사회 구성, 자금 조달 체계를 정비합니다.',
    'torque', 'active', 'culture',
    CURRENT_DATE - 21,
    taina_id, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO project_torque (
    project_id, engagement_type, started_at, scope_summary,
    retainer_monthly_hours, retainer_hourly_rate_krw
  ) VALUES (
    p5_id, 'retainer', CURRENT_DATE - 21,
    '지분 구조 정비 + 이사회 구성 + 투자 유치 준비 (IR 자료 작성 포함)',
    30, 250000
  )
  ON CONFLICT (project_id) DO NOTHING;

  INSERT INTO bolt_memberships (project_id, user_id, role)
  VALUES (p5_id, taina_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (p5_id, taina_id, 'lead')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO consulting_risks (project_id, title, category, likelihood, impact, mitigation_status, identified_by)
  VALUES
    (p5_id, '소액주주 동의 미확보로 주식 이전 지연', 'legal', 3, 4, 'mitigating', taina_id),
    (p5_id, '재무제표 불일치로 투자자 신뢰 저하', 'financial', 2, 5, 'analyzing', taina_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO consulting_requests (project_id, title, body, requester_id, request_type, priority, status, estimated_hours, actual_hours)
  VALUES
    (p5_id, 'IR 덱 검토 요청', '시드 투자 유치를 위한 IR 덱 초안 검토 및 피드백 요청 (15페이지)', taina_id, 'review', 'urgent', 'in_progress', 4, 2),
    (p5_id, '법인 지분 양도 세금 계산 조언', '창업자 4인의 지분 재편 시 취득세·양도세 추정 방법론', taina_id, 'advice', 'high', 'submitted', 2, 0)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Taina 실제 사업 5개 Torque Bolt 시딩 완료!';
  RAISE NOTICE '  1. FlagtaleCafe 브랜드 리뉴얼 (%)', p1_id;
  RAISE NOTICE '  2. ZeroSite 사회적기업 인증 (%)', p2_id;
  RAISE NOTICE '  3. SecondWind 시장 진입 자문 (%)', p3_id;
  RAISE NOTICE '  4. 양평 타운하우스 개발 자문 (%)', p4_id;
  RAISE NOTICE '  5. Antenna 법인 거버넌스 재편 (%)', p5_id;

END $$;

-- ─────────────────────────────────────────────────────────
-- 보조 테이블: consulting_deliverables (산출물 라이브러리)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consulting_deliverables (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  category    text        CHECK (category IN (
    'proposal','analysis','report','template','playbook',
    'presentation','decision_memo','other'
  )) DEFAULT 'report',
  stage       text        CHECK (stage IN (
    'draft','review','approved','delivered','archived'
  )) DEFAULT 'draft',
  author_id   uuid        REFERENCES profiles(id),
  file_url    text,
  content_md  text,
  version     text        NOT NULL DEFAULT '1.0',
  tags        text[]      NOT NULL DEFAULT '{}',
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consulting_deliverables_project
  ON consulting_deliverables(project_id);

ALTER TABLE consulting_deliverables ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY IF NOT EXISTS 는 PostgreSQL 미지원 → DROP 후 재생성
DROP POLICY IF EXISTS "consulting_deliverables_member" ON consulting_deliverables;
CREATE POLICY "consulting_deliverables_member"
  ON consulting_deliverables FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────
-- 보조 테이블: project_meetings_torque (이중 미팅 트랙)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_meetings_torque (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  track                   text        NOT NULL CHECK (track IN ('team', 'consultant')),
  title                   text        NOT NULL,
  meeting_type            text        CHECK (meeting_type IN ('weekly','biweekly','monthly','adhoc','session')),
  session_type            text        CHECK (session_type IN ('discovery','diagnosis','proposal','review','checkin')),
  scheduled_at            timestamptz NOT NULL,
  duration_minutes        int         DEFAULT 60,
  location                text,
  attendee_ids            uuid[]      NOT NULL DEFAULT '{}',
  status                  text        CHECK (status IN ('scheduled','in_progress','completed','cancelled')) DEFAULT 'scheduled',
  agenda_items            jsonb       NOT NULL DEFAULT '[]',
  action_items            jsonb       NOT NULL DEFAULT '[]',
  decisions               jsonb       NOT NULL DEFAULT '[]',
  notes                   text,
  recording_url           text,
  shared_with_consultant  boolean     DEFAULT false,
  session_brief           text,
  created_by              uuid        REFERENCES profiles(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_meetings_torque_project ON project_meetings_torque(project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_torque_track   ON project_meetings_torque(project_id, track);

ALTER TABLE project_meetings_torque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_torque_team_select" ON project_meetings_torque;
CREATE POLICY "meetings_torque_team_select"
  ON project_meetings_torque FOR SELECT
  USING (
    track = 'consultant'
    OR (
      track = 'team' AND (
        (shared_with_consultant = false AND (
          project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid() AND role IN ('owner','team'))
          OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
        ))
        OR
        (shared_with_consultant = true AND (
          project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid())
          OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
        ))
      )
    )
  );

DROP POLICY IF EXISTS "meetings_torque_insert" ON project_meetings_torque;
CREATE POLICY "meetings_torque_insert"
  ON project_meetings_torque FOR INSERT
  WITH CHECK (
    project_id IN (SELECT project_id FROM bolt_memberships WHERE user_id = auth.uid())
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "meetings_torque_update" ON project_meetings_torque;
CREATE POLICY "meetings_torque_update"
  ON project_meetings_torque FOR UPDATE
  USING (
    created_by = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  );
