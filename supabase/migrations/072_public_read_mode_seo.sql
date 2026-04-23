-- 072: 비로그인 읽기 모드 — SEO 정상화
-- 이전: 040 이 projects SELECT 를 auth.uid() IS NOT NULL 로 제한
-- 현재: 공개 가능한 볼트/프로필/마일스톤은 익명도 읽기 가능
-- 단, draft / archived 는 제외

-- ============================================
-- 1. projects: 공개 (단, draft/archived 는 숨김)
-- ============================================
drop policy if exists "finance_projects_select_authed" on public.projects;
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_select_public" on public.projects;

create policy "projects_select_public"
  on public.projects for select
  using (
    status in ('active','completed')  -- draft/archived 제외
    or created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 2. profiles: 기본 공개 필드 (SEO·포트폴리오 필수)
-- ============================================
-- 기존 profiles_select 가 restrict 하는 경우 보강
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;

create policy "profiles_select_public"
  on public.profiles for select
  using (true);   -- 모든 프로필 공개. 개별 컬럼 감추기는 애플리케이션 레벨에서.

-- ============================================
-- 3. project_members: 공개 — 누가 참여했는지 보여야 SEO 가치
-- ============================================
drop policy if exists "project_members_select" on public.project_members;
drop policy if exists "project_members_select_public" on public.project_members;

create policy "project_members_select_public"
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and (p.status in ('active','completed')
             or p.created_by = auth.uid()
             or project_members.user_id = auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 4. project_milestones: 공개
-- ============================================
drop policy if exists "project_milestones_select" on public.project_milestones;
drop policy if exists "project_milestones_select_public" on public.project_milestones;

create policy "project_milestones_select_public"
  on public.project_milestones for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_milestones.project_id
        and p.status in ('active','completed')
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_milestones.project_id and pm.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 5. groups: 이미 공개 (001) 이지만 활성만 표시
-- ============================================
drop policy if exists "groups_select" on public.groups;
drop policy if exists "groups_select_public" on public.groups;

create policy "groups_select_public"
  on public.groups for select
  using (
    coalesce(is_active, true) = true
    or host_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

comment on schema public is
  'Migration 072 — SEO: public read mode for active/completed projects, profiles, milestones, groups';
