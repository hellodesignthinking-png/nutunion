-- ============================================
-- Migration 089: storage_type 추적
-- ============================================
-- 배경: Cloudflare R2 / Supabase Storage / Google Drive 하이브리드 스토리지 도입.
-- 각 파일이 어디에 저장됐는지 추적해야 향후 이관·삭제·비용 관리가 쉬움.

-- file_attachments
alter table public.file_attachments
  add column if not exists storage_type text
    not null default 'supabase'
    check (storage_type in ('r2', 'supabase', 'google_drive', 'external'));

alter table public.file_attachments
  add column if not exists storage_key text;  -- R2 key 또는 Supabase path

-- project_resources
alter table public.project_resources
  add column if not exists storage_type text
    not null default 'supabase'
    check (storage_type in ('r2', 'supabase', 'google_drive', 'external'));

alter table public.project_resources
  add column if not exists storage_key text;

-- chat_messages 의 첨부도 분류 필요 (이관 판단용)
alter table public.chat_messages
  add column if not exists storage_type text
    check (storage_type in ('r2', 'supabase', 'google_drive', 'external'));

-- 인덱스 (향후 R2 이관 작업 시 Supabase 파일만 조회)
create index if not exists idx_file_attachments_storage on public.file_attachments(storage_type);
create index if not exists idx_project_resources_storage on public.project_resources(storage_type);

-- PostgREST 캐시 갱신
notify pgrst, 'reload schema';
