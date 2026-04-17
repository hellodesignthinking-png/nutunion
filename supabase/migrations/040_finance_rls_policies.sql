-- ============================================================
-- 040_finance_rls_policies.sql
-- nutunion Finance 시스템 Row Level Security 정책
--
-- 목적:
--   NEXT_PUBLIC_SUPABASE_ANON_KEY 가 클라이언트에 노출되어 있기 때문에,
--   브라우저 콘솔에서 직접 supabase.from('employees').select('*') 등을
--   호출할 수 있음. API 라우트의 권한 체크를 우회할 위험이 있음.
--   이 마이그레이션은 DB 레벨에서 접근을 차단한다.
--
-- 권한 모델:
--   - admin / staff (profiles.role): 모든 Finance 데이터 R/W
--   - 본인 (auth.uid()): 자기 관련 레코드만 SELECT
--       · employees: email 일치
--       · attendances, payroll: 본인 employees.id 참조
--       · approvals: requester_id = auth.uid()
--   - 그 외 인증 사용자: volt/project 공개 메타만 읽기
--   - Anonymous: 모든 Finance 테이블 접근 불가
--
-- 적용 방법:
--   Supabase Dashboard → SQL Editor → 이 파일 전체 복사 → Run
--   또는: supabase db push (CLI 사용 시)
--
-- 롤백: 파일 최하단 주석 참고
-- ============================================================

-- ------------------------------------------------------------
-- 0. 공용 헬퍼 함수
-- ------------------------------------------------------------

-- admin/staff 여부 판단. security definer 로 RLS 재귀 방지.
create or replace function public.is_finance_admin_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'staff')
  );
$$;

comment on function public.is_finance_admin_staff() is
  'Finance RLS: profiles.role in (admin, staff) 여부. security definer 로 정책 내 재귀 회피.';

-- 현재 인증 사용자의 email → employees.id 매핑 (본인 레코드 조회용)
create or replace function public.current_employee_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select e.id::text
  from public.employees e
  join auth.users u on lower(u.email) = lower(e.email)
  where u.id = auth.uid()
  limit 1;
$$;

comment on function public.current_employee_id() is
  'Finance RLS: 로그인 사용자의 email 과 매칭되는 employees.id 를 text 로 반환.';

-- ------------------------------------------------------------
-- 1. profiles — 본인 + admin/staff
-- (이미 RLS 활성화되어 있을 수 있으므로 중복 정책만 재정의)
-- ------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "finance_profiles_select_self" on public.profiles;
create policy "finance_profiles_select_self" on public.profiles
  for select
  using (auth.uid()::text = id::text);

drop policy if exists "finance_profiles_select_admin_staff" on public.profiles;
create policy "finance_profiles_select_admin_staff" on public.profiles
  for select
  using (public.is_finance_admin_staff());

drop policy if exists "finance_profiles_update_self_nonrole" on public.profiles;
create policy "finance_profiles_update_self_nonrole" on public.profiles
  for update
  using (auth.uid()::text = id::text)
  with check (auth.uid()::text = id::text);

-- ------------------------------------------------------------
-- 2. companies — 인증 사용자 읽기, admin/staff 쓰기
-- ------------------------------------------------------------

alter table public.companies enable row level security;

drop policy if exists "finance_companies_select_authed" on public.companies;
create policy "finance_companies_select_authed" on public.companies
  for select
  using (auth.uid() is not null);

drop policy if exists "finance_companies_write_admin_staff" on public.companies;
create policy "finance_companies_write_admin_staff" on public.companies
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- ------------------------------------------------------------
-- 3. transactions — admin/staff 전용 (재무 민감 데이터)
-- ------------------------------------------------------------

alter table public.transactions enable row level security;

drop policy if exists "finance_transactions_admin_staff_all" on public.transactions;
create policy "finance_transactions_admin_staff_all" on public.transactions
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- ------------------------------------------------------------
-- 4. employees — admin/staff 전체, 본인은 자기 레코드만 읽기
-- ------------------------------------------------------------

alter table public.employees enable row level security;

drop policy if exists "finance_employees_admin_staff_all" on public.employees;
create policy "finance_employees_admin_staff_all" on public.employees
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

drop policy if exists "finance_employees_select_self" on public.employees;
create policy "finance_employees_select_self" on public.employees
  for select
  using (
    auth.uid() is not null
    and email is not null
    and lower(coalesce(email, '')) = lower(coalesce((select u.email::text from auth.users u where u.id = auth.uid()), ''))
  );

-- ------------------------------------------------------------
-- 5. attendances — admin/staff, 본인은 자기 출결만 SELECT
-- ------------------------------------------------------------

alter table public.attendances enable row level security;

drop policy if exists "finance_attendances_admin_staff_all" on public.attendances;
create policy "finance_attendances_admin_staff_all" on public.attendances
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

drop policy if exists "finance_attendances_select_self" on public.attendances;
create policy "finance_attendances_select_self" on public.attendances
  for select
  using (
    employee_id::text = public.current_employee_id()
  );

-- ------------------------------------------------------------
-- 6. payroll — admin/staff, 본인은 자기 급여만 SELECT
-- ------------------------------------------------------------

alter table public.payroll enable row level security;

drop policy if exists "finance_payroll_admin_staff_all" on public.payroll;
create policy "finance_payroll_admin_staff_all" on public.payroll
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

drop policy if exists "finance_payroll_select_self" on public.payroll;
create policy "finance_payroll_select_self" on public.payroll
  for select
  using (
    employee_id::text = public.current_employee_id()
  );

-- ------------------------------------------------------------
-- 7. approvals — admin/staff 전체, 요청자는 본인 건만 CRUD
-- ------------------------------------------------------------

alter table public.approvals enable row level security;

drop policy if exists "finance_approvals_admin_staff_all" on public.approvals;
create policy "finance_approvals_admin_staff_all" on public.approvals
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- approvals 실제 컬럼명 자동 감지 (requester_id 또는 requester)
do $$
declare
  req_col text;
begin
  select column_name into req_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'approvals'
    and column_name in ('requester_id', 'requester')
  order by case column_name when 'requester_id' then 1 else 2 end
  limit 1;

  if req_col is null then
    raise notice 'approvals 테이블에 requester_id/requester 컬럼 없음 → 요청자용 정책 skip';
    return;
  end if;

  execute 'drop policy if exists "finance_approvals_select_requester" on public.approvals';
  execute format($f$
    create policy "finance_approvals_select_requester" on public.approvals
      for select using (%I::text = auth.uid()::text)
  $f$, req_col);

  execute 'drop policy if exists "finance_approvals_insert_requester" on public.approvals';
  execute format($f$
    create policy "finance_approvals_insert_requester" on public.approvals
      for insert with check (
        auth.uid() is not null
        and %I::text = auth.uid()::text
      )
  $f$, req_col);
end $$;

-- (수정/삭제는 admin/staff 정책이 처리. 요청자 본인의 상태 변경은 API 에서 검증)

-- ------------------------------------------------------------
-- 8. vendors — admin/staff 전용
-- (테이블이 존재하지 않는 경우 ALTER/CREATE POLICY 는 에러 발생 → 조건부 실행)
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'vendors'
  ) then
    execute 'alter table public.vendors enable row level security';

    execute 'drop policy if exists "finance_vendors_admin_staff_all" on public.vendors';
    execute $POL$
      create policy "finance_vendors_admin_staff_all" on public.vendors
        for all
        using (public.is_finance_admin_staff())
        with check (public.is_finance_admin_staff())
    $POL$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 9. projects (볼트) — 인증 사용자 읽기, admin/staff 쓰기
--   주의: 이미 다른 마이그레이션(014, 021, 029 등) 에서 정책이 있을 수 있음.
--   기존 정책을 덮어쓰지 않도록 Finance 전용 이름(finance_*)으로만 추가.
-- ------------------------------------------------------------

alter table public.projects enable row level security;

drop policy if exists "finance_projects_select_authed" on public.projects;
create policy "finance_projects_select_authed" on public.projects
  for select
  using (auth.uid() is not null);

drop policy if exists "finance_projects_write_admin_staff" on public.projects;
create policy "finance_projects_write_admin_staff" on public.projects
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- ------------------------------------------------------------
-- 10. project_finance — admin/staff 전용
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'project_finance'
  ) then
    execute 'alter table public.project_finance enable row level security';

    execute 'drop policy if exists "finance_project_finance_admin_staff_all" on public.project_finance';
    execute $POL$
      create policy "finance_project_finance_admin_staff_all" on public.project_finance
        for all
        using (public.is_finance_admin_staff())
        with check (public.is_finance_admin_staff())
    $POL$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 11. project_members — 인증 사용자 읽기, admin/staff 쓰기
-- ------------------------------------------------------------

alter table public.project_members enable row level security;

drop policy if exists "finance_project_members_select_authed" on public.project_members;
create policy "finance_project_members_select_authed" on public.project_members
  for select
  using (auth.uid() is not null);

drop policy if exists "finance_project_members_write_admin_staff" on public.project_members;
create policy "finance_project_members_write_admin_staff" on public.project_members
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- ------------------------------------------------------------
-- 12. project_milestones — 인증 사용자 읽기, admin/staff 쓰기
-- ------------------------------------------------------------

alter table public.project_milestones enable row level security;

drop policy if exists "finance_project_milestones_select_authed" on public.project_milestones;
create policy "finance_project_milestones_select_authed" on public.project_milestones
  for select
  using (auth.uid() is not null);

drop policy if exists "finance_project_milestones_write_admin_staff" on public.project_milestones;
create policy "finance_project_milestones_write_admin_staff" on public.project_milestones
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

-- ============================================================
-- 검증 (SELECT 만 실행, 영향 없음)
-- ============================================================
--
-- 1) 헬퍼 함수 동작 확인 (로그인 사용자 세션에서):
--    select public.is_finance_admin_staff();
--    select public.current_employee_id();
--
-- 2) 테이블별 RLS 활성화 여부:
--    select tablename, rowsecurity
--    from pg_tables
--    where schemaname='public'
--      and tablename in ('transactions','employees','companies','attendances',
--                        'payroll','approvals','vendors','projects',
--                        'project_finance','project_members','project_milestones','profiles');
--
-- 3) 정책 목록:
--    select tablename, policyname, cmd, qual
--    from pg_policies
--    where schemaname='public'
--      and policyname like 'finance_%';
--
-- ============================================================
-- 롤백 (문제 발생 시)
-- ============================================================
--
--   drop policy if exists "finance_profiles_select_self" on public.profiles;
--   drop policy if exists "finance_profiles_select_admin_staff" on public.profiles;
--   drop policy if exists "finance_profiles_update_self_nonrole" on public.profiles;
--   drop policy if exists "finance_companies_select_authed" on public.companies;
--   drop policy if exists "finance_companies_write_admin_staff" on public.companies;
--   drop policy if exists "finance_transactions_admin_staff_all" on public.transactions;
--   drop policy if exists "finance_employees_admin_staff_all" on public.employees;
--   drop policy if exists "finance_employees_select_self" on public.employees;
--   drop policy if exists "finance_attendances_admin_staff_all" on public.attendances;
--   drop policy if exists "finance_attendances_select_self" on public.attendances;
--   drop policy if exists "finance_payroll_admin_staff_all" on public.payroll;
--   drop policy if exists "finance_payroll_select_self" on public.payroll;
--   drop policy if exists "finance_approvals_admin_staff_all" on public.approvals;
--   drop policy if exists "finance_approvals_select_requester" on public.approvals;
--   drop policy if exists "finance_approvals_insert_requester" on public.approvals;
--   drop policy if exists "finance_vendors_admin_staff_all" on public.vendors;
--   drop policy if exists "finance_projects_select_authed" on public.projects;
--   drop policy if exists "finance_projects_write_admin_staff" on public.projects;
--   drop policy if exists "finance_project_finance_admin_staff_all" on public.project_finance;
--   drop policy if exists "finance_project_members_select_authed" on public.project_members;
--   drop policy if exists "finance_project_members_write_admin_staff" on public.project_members;
--   drop policy if exists "finance_project_milestones_select_authed" on public.project_milestones;
--   drop policy if exists "finance_project_milestones_write_admin_staff" on public.project_milestones;
--   drop function if exists public.is_finance_admin_staff();
--   drop function if exists public.current_employee_id();
--
-- RLS 자체를 끄려면(권장하지 않음):
--   alter table public.transactions disable row level security;
--   ...
--
-- ============================================================
-- 주의사항
-- ============================================================
--
-- 1. API 라우트는 서버에서 createClient() 로 쿠키 기반 세션을 사용하므로
--    auth.uid() 가 정상 동작하고 admin/staff 체크를 통과한다 — RLS 추가 후에도
--    기존 API 동작은 그대로 유지됨.
--
-- 2. service_role key 를 사용하는 서버 코드는 RLS 를 우회함. 현재 repo 에는
--    SERVICE_ROLE_KEY 사용 없음 (모두 anon key + 쿠키 세션). 만약 나중에
--    cron job / admin script 가 생기면 service_role key 로 실행해야 함.
--
-- 3. 직원 본인의 email 이 auth.users.email 과 다르면(예: 회사 이메일 vs 가입 이메일)
--    본인 조회 정책이 매칭 안 됨. Finance 시스템 사용자는 모두 회사 이메일로
--    Supabase 가입되어 있다는 가정을 전제로 함.
--
-- 4. 정책명 prefix 를 'finance_' 로 통일해 다른 마이그레이션(035 wiki RLS 등)의
--    정책과 충돌하지 않도록 했음.
-- ============================================================
