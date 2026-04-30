-- ============================================
-- Migration 137: file_attachments SELECT RLS — close USING(true) leak
-- ============================================
-- 005_community_features.sql 의 `files_select USING (true)` 정책이 그대로 남아 있어
-- 모든 인증 사용자가 모든 그룹·프로젝트의 파일 메타(file_url, file_name 등)를
-- 조회할 수 있는 누수 상태. 이 누수는 1.3 의 preview-proxy 권한 가드(RLS 매칭)
-- 까지 무력화시킨다 — RLS 가 모든 행을 통과시키면 다른 그룹의 R2 URL 도 매칭 성공.
--
-- 이 마이그레이션:
--  - target_type 별로 부모 자원의 멤버십을 검사하는 정책으로 교체
--  - 본인이 업로드한 행은 항상 조회 가능 (개인 라이브러리/임시 업로드 안전망)
--  - admin/staff 는 모든 파일 조회 가능 (운영 점검)
--
-- target_type 별 매칭:
--   group         → group_members(active)
--   crew_post     → crew_posts.group_id → group_members(active)
--   meeting       → meetings.group_id → group_members(active)
--   project       → project_members
--   project_update → project_updates.project_id → project_members
--   project_task  → project_tasks.project_id → project_members
--   (그 외)       → 본인만 (안전 기본값)
--
-- 멱등 — drop+create 패턴.

drop policy if exists "files_select"        on public.file_attachments;
drop policy if exists "files_select_member" on public.file_attachments;

create policy "files_select_member" on public.file_attachments
  for select using (
    -- 본인 업로드는 항상 가능
    uploaded_by = auth.uid()
    -- admin/staff 우회
    or exists(
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
    -- target_type 별 부모 자원 멤버십
    or case target_type
      when 'group' then exists(
        select 1 from public.group_members gm
        where gm.group_id = file_attachments.target_id
          and gm.user_id  = auth.uid()
          and gm.status   = 'active'
      )
      when 'crew_post' then exists(
        select 1
        from public.crew_posts cp
        join public.group_members gm on gm.group_id = cp.group_id
        where cp.id      = file_attachments.target_id
          and gm.user_id = auth.uid()
          and gm.status  = 'active'
      )
      when 'meeting' then exists(
        select 1
        from public.meetings m
        join public.group_members gm on gm.group_id = m.group_id
        where m.id       = file_attachments.target_id
          and gm.user_id = auth.uid()
          and gm.status  = 'active'
      )
      when 'project' then exists(
        select 1 from public.project_members pm
        where pm.project_id = file_attachments.target_id
          and pm.user_id    = auth.uid()
      )
      when 'project_update' then exists(
        select 1
        from public.project_updates pu
        join public.project_members pm on pm.project_id = pu.project_id
        where pu.id        = file_attachments.target_id
          and pm.user_id   = auth.uid()
      )
      when 'project_task' then exists(
        select 1
        from public.project_tasks pt
        join public.project_members pm on pm.project_id = pt.project_id
        where pt.id        = file_attachments.target_id
          and pm.user_id   = auth.uid()
      )
      else false
    end
  );

comment on policy "files_select_member" on public.file_attachments is
  '005 의 USING(true) 누수를 닫는 멤버 가드 — 137 적용. preview-proxy/RLS 매칭의
   안전 기반.';

notify pgrst, 'reload schema';
