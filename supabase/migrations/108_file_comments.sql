-- ============================================
-- Migration 108: file_comments — PDF/문서 파일별 코멘트
-- ============================================
-- file_attachments 또는 project_resources 의 개별 파일에 코멘트를 달 수 있도록 하는 테이블.
-- 다형(polymorphic) 관계: (file_table, file_id) 로 양쪽을 구분.

create table if not exists public.file_comments (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null,
  file_table text not null check (file_table in ('file_attachments','project_resources')),
  user_id uuid not null references profiles(id) on delete cascade,
  page int,
  content text not null,
  created_at timestamptz default now()
);

alter table public.file_comments enable row level security;

drop policy if exists "file_comments_read" on public.file_comments;
create policy "file_comments_read" on public.file_comments
  for select using (true);

drop policy if exists "file_comments_write" on public.file_comments;
create policy "file_comments_write" on public.file_comments
  for insert with check (user_id = auth.uid());

drop policy if exists "file_comments_delete" on public.file_comments;
create policy "file_comments_delete" on public.file_comments
  for delete using (user_id = auth.uid());

create index if not exists idx_file_comments_file
  on public.file_comments(file_table, file_id);
