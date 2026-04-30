-- ============================================
-- Migration 135: file_versions RLS — limit SELECT to members of the owning resource
-- ============================================
-- 132 가 file_versions 를 만들면서 SELECT 정책을 'authenticated' 전체로 두었다.
-- 라우트(/api/files/versions, /api/files/versions/restore)에서 멤버십을 다시 검사하지만
-- DB 레벨에서도 같은 의미로 좁혀 두는 것이 안전 — admin/SQL 직접 쿼리, 미래의 신규 라우트,
-- pg_graphql 같은 자동 노출에서도 누수가 일어나지 않는다.
--
-- 정책: file_versions 행을 보려면 부모 자료실 행(file_attachments / project_resources)을
-- 사용자가 RLS로 볼 수 있어야 한다. 부모 row 가 없거나 RLS로 가려져 있으면 0행.
-- 멱등(drop if exists → create) 이며 132 가 이미 적용된 환경에서도 그대로 실행 가능.

drop policy if exists "fv_select_authenticated" on public.file_versions;
drop policy if exists "fv_select_member" on public.file_versions;

create policy "fv_select_member" on public.file_versions
  for select using (
    case resource_table
      when 'file_attachments' then exists(
        select 1 from public.file_attachments fa
        where fa.id = file_versions.resource_id
      )
      when 'project_resources' then exists(
        select 1 from public.project_resources pr
        where pr.id = file_versions.resource_id
      )
      else false
    end
  );

-- INSERT/DELETE 는 정책 없음 → service role(라우트)에서만 처리. 명시적 주석으로 의도를 박아둔다.
comment on table public.file_versions is
  'R2 sync-back 직전 백업본 추적. INSERT/UPDATE/DELETE 는 service role 전용. SELECT 만 멤버 RLS 통과.';

notify pgrst, 'reload schema';
