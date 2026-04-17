-- ============================================================
-- 053_finance_storage_buckets.sql
-- Supabase Storage 버킷 설정 + RLS
--
-- 목적:
--   영수증(receipt), 서명(signature) 을 DB text 컬럼의 base64 에서
--   Supabase Storage 로 이전 → DB 부하 감소, 쿼리 속도 향상
--
-- 이 파일 역할:
--   · 버킷 생성 (idempotent)
--   · storage.objects 에 RLS 정책 설정
--
-- 참고:
--   버킷은 Supabase Dashboard → Storage 에서도 생성 가능.
--   이 SQL 이 실패하면 Dashboard 로 수동 생성 후 RLS 부분만 실행.
-- ============================================================

-- ------------------------------------------------------------
-- 1. receipts 버킷 (영수증)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-receipts',
  'finance-receipts',
  false,  -- private — signed URL 로만 접근
  2 * 1024 * 1024,  -- 2MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- ------------------------------------------------------------
-- 2. signatures 버킷 (근로계약서 서명)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-signatures',
  'finance-signatures',
  false,  -- private
  1 * 1024 * 1024,  -- 1MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- ------------------------------------------------------------
-- 3. Storage RLS — admin/staff 만 접근
-- ------------------------------------------------------------

-- 모든 인증 사용자의 직접 접근 차단. API 라우트가 service_role 로 업로드/다운로드.

-- SELECT
drop policy if exists "finance_storage_select_admin_staff" on storage.objects;
create policy "finance_storage_select_admin_staff" on storage.objects
  for select
  using (
    bucket_id in ('finance-receipts', 'finance-signatures')
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

-- INSERT (admin/staff 만)
drop policy if exists "finance_storage_insert_admin_staff" on storage.objects;
create policy "finance_storage_insert_admin_staff" on storage.objects
  for insert
  with check (
    bucket_id in ('finance-receipts', 'finance-signatures')
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

-- UPDATE
drop policy if exists "finance_storage_update_admin_staff" on storage.objects;
create policy "finance_storage_update_admin_staff" on storage.objects
  for update
  using (
    bucket_id in ('finance-receipts', 'finance-signatures')
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

-- DELETE
drop policy if exists "finance_storage_delete_admin_staff" on storage.objects;
create policy "finance_storage_delete_admin_staff" on storage.objects
  for delete
  using (
    bucket_id in ('finance-receipts', 'finance-signatures')
    and exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

-- ------------------------------------------------------------
-- 검증
-- ------------------------------------------------------------
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets
--   where id like 'finance-%';
--
--   select policyname, cmd from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and policyname like 'finance_storage_%';
-- ============================================================
