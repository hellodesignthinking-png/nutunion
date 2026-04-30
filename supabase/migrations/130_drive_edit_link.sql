-- ============================================
-- Migration 130: Drive 편집 사본 추적
-- ============================================
-- 배경: R2 에 저장된 Office/HWP 파일을 사용자 Google Drive 로 복사해 편집할 때,
-- 같은 R2 파일에 대해 매번 새 Drive 사본을 만들지 않고 기존 사본을 재사용해야 함.
-- 또한 Drive 에서 편집한 내용을 R2 로 다시 동기화(import-back)할 때도
-- 어느 Drive 파일이 어느 R2 파일에 매핑되는지 알아야 함.

-- file_attachments — 그룹/공통 자료실
alter table public.file_attachments
  add column if not exists drive_edit_file_id text;     -- 사용자 Drive 의 변환된 사본 fileId
alter table public.file_attachments
  add column if not exists drive_edit_user_id uuid;     -- 사본을 만든 유저 (다른 멤버가 새로 만들 수 있음)
alter table public.file_attachments
  add column if not exists drive_edit_link text;        -- webViewLink (편집용)
alter table public.file_attachments
  add column if not exists drive_edit_synced_at timestamptz;  -- 마지막 R2 동기화 시각

-- project_resources — 볼트(프로젝트) 자료실
alter table public.project_resources
  add column if not exists drive_edit_file_id text;
alter table public.project_resources
  add column if not exists drive_edit_user_id uuid;
alter table public.project_resources
  add column if not exists drive_edit_link text;
alter table public.project_resources
  add column if not exists drive_edit_synced_at timestamptz;

-- 인덱스 — 같은 Drive fileId 로 어느 자료실 행을 갱신해야 하는지 빠르게 찾기
create index if not exists idx_file_attachments_drive_edit on public.file_attachments(drive_edit_file_id) where drive_edit_file_id is not null;
create index if not exists idx_project_resources_drive_edit on public.project_resources(drive_edit_file_id) where drive_edit_file_id is not null;

notify pgrst, 'reload schema';
