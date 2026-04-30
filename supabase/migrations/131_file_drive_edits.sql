-- ============================================
-- Migration 131: file_drive_edits — 자료별 멤버별 Drive 사본 추적
-- ============================================
-- 배경: Migration 130 의 drive_edit_* 컬럼은 자료당 1개 사본만 추적할 수 있어
-- 같은 파일에 멤버 A·B 가 각자 사본을 만들면 마지막 작성자가 이전 참조를 덮어씀.
-- 이 테이블은 (자료, 멤버) 쌍마다 별도 사본 정보를 저장 — 멀티유저 협업 안전.

create table if not exists public.file_drive_edits (
  id uuid primary key default gen_random_uuid(),
  resource_table text not null check (resource_table in ('file_attachments', 'project_resources')),
  resource_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text not null,
  drive_link text,
  synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(resource_table, resource_id, user_id)
);

create index if not exists idx_file_drive_edits_resource on public.file_drive_edits(resource_table, resource_id);
create index if not exists idx_file_drive_edits_user on public.file_drive_edits(user_id);

-- updated_at 자동 갱신 트리거
create or replace function public.fde_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fde_updated_at on public.file_drive_edits;
create trigger trg_fde_updated_at
  before update on public.file_drive_edits
  for each row execute function public.fde_set_updated_at();

-- RLS — 본인 row 만 보고 수정. 자료실 행 접근 권한은 서버에서 별도 검사.
alter table public.file_drive_edits enable row level security;

drop policy if exists "fde_select_own" on public.file_drive_edits;
create policy "fde_select_own" on public.file_drive_edits
  for select using (auth.uid() = user_id);

drop policy if exists "fde_insert_own" on public.file_drive_edits;
create policy "fde_insert_own" on public.file_drive_edits
  for insert with check (auth.uid() = user_id);

drop policy if exists "fde_update_own" on public.file_drive_edits;
create policy "fde_update_own" on public.file_drive_edits
  for update using (auth.uid() = user_id);

drop policy if exists "fde_delete_own" on public.file_drive_edits;
create policy "fde_delete_own" on public.file_drive_edits
  for delete using (auth.uid() = user_id);

-- 130 컬럼에서 데이터 백필 (있으면)
insert into public.file_drive_edits (resource_table, resource_id, user_id, drive_file_id, drive_link, synced_at)
select 'file_attachments', id, drive_edit_user_id, drive_edit_file_id, drive_edit_link, drive_edit_synced_at
from public.file_attachments
where drive_edit_file_id is not null and drive_edit_user_id is not null
on conflict (resource_table, resource_id, user_id) do nothing;

insert into public.file_drive_edits (resource_table, resource_id, user_id, drive_file_id, drive_link, synced_at)
select 'project_resources', id, drive_edit_user_id, drive_edit_file_id, drive_edit_link, drive_edit_synced_at
from public.project_resources
where drive_edit_file_id is not null and drive_edit_user_id is not null
on conflict (resource_table, resource_id, user_id) do nothing;

notify pgrst, 'reload schema';
