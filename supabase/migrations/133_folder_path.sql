-- ============================================
-- Migration 133: folder_path — 자료실 단순 폴더 구조
-- ============================================
-- 배경: 평면 + 태그 만으로는 자료가 누적되면 정리가 어려움. 가상 경로 기반의 단순 폴더
-- 추가 (예: 'clients/2026', 'design'). UI 에서는 한 단계 깊이만 1차 지원.
-- 진정한 트리는 추후 필요 시 path-LIKE 쿼리로 확장 가능.

alter table public.file_attachments
  add column if not exists folder_path text not null default '';

alter table public.project_resources
  add column if not exists folder_path text not null default '';

-- 같은 (그룹/볼트, 폴더) 안에서 빠르게 조회
create index if not exists idx_file_attachments_folder
  on public.file_attachments(target_type, target_id, folder_path);
create index if not exists idx_project_resources_folder
  on public.project_resources(project_id, folder_path);

notify pgrst, 'reload schema';
