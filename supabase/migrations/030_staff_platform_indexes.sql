-- ============================================================
-- 030: Staff Platform — 추가 인덱스
-- ============================================================

-- staff_project_members의 user_id 조회 최적화
create index if not exists idx_staff_project_members_user on staff_project_members(user_id);

-- staff_comments의 project_id 조회 최적화
create index if not exists idx_staff_comments_project on staff_comments(project_id);
