-- ============================================
-- Migration 132: file_versions — R2 sync-back 직전 백업본 추적
-- ============================================
-- 배경: Drive 에서 잘못 편집한 내용을 [R2 로 동기화] 누르면 원본을 덮어써 되돌릴 수 없음.
-- sync-back 직전에 현재 R2 객체를 _versions/ 경로로 복사해두고, UI 에서 복원할 수 있게 한다.
-- 자료당 최대 5개 보관 (그 이상이면 가장 오래된 것부터 삭제 — 라우트에서 처리).

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  resource_table text not null check (resource_table in ('file_attachments', 'project_resources')),
  resource_id uuid not null,
  -- 백업본 R2 key — 원본 key 와 다름 (예: resources/u/{ts}_x.docx → _versions/resources/u/{ts}_x.docx.{tsbak})
  backup_storage_key text not null,
  -- 백업 시점의 메타
  bytes bigint,
  content_type text,
  -- 누가 sync-back 트리거해서 이 백업이 만들어졌는지
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  -- 사용자가 붙이는 라벨 (자동: "Drive 동기화 직전")
  label text
);

create index if not exists idx_file_versions_resource on public.file_versions(resource_table, resource_id, created_at desc);

-- RLS — 자료실 행에 권한 있는 멤버만 조회/복원. 복원은 서버에서 검사 후 service role 로 처리.
alter table public.file_versions enable row level security;

-- SELECT 정책 — file_attachments / project_resources 의 RLS 가 이미 멤버십 체크하므로
-- 여기서는 단순히 "조회 가능한 사람" 으로 둠. 라우트에서 한 번 더 검사.
drop policy if exists "fv_select_authenticated" on public.file_versions;
create policy "fv_select_authenticated" on public.file_versions
  for select using (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
