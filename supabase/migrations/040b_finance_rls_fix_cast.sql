-- ============================================================
-- 040b_finance_rls_fix_cast.sql
-- 040_finance_rls_policies.sql 실행 시 발생한 타입 불일치 수정
--
-- 에러: operator does not exist: bigint = text
-- 원인: attendances.employee_id / payroll.employee_id / approvals.requester_id
--       등이 bigint 로 저장되어 있어 text 비교가 실패
-- 해결: 양쪽을 ::text 로 캐스팅하여 비교
--
-- 실행 방법: Supabase Dashboard → SQL Editor → 전체 복사 → Run
-- (040_finance_rls_policies.sql 이 일부만 실행되었어도 멱등이므로 안전)
-- ============================================================

-- ------------------------------------------------------------
-- 헬퍼 함수 재정의 (이미 있어도 create or replace 로 안전)
-- ------------------------------------------------------------

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
    where id::text = auth.uid()::text
      and role in ('admin', 'staff')
  );
$$;

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

-- ------------------------------------------------------------
-- attendances.employee_id (bigint 가능) → text 캐스트
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
-- payroll.employee_id (bigint 가능) → text 캐스트
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
-- approvals — 실제 컬럼명 자동 감지 (requester_id 또는 requester)
-- ------------------------------------------------------------

alter table public.approvals enable row level security;

drop policy if exists "finance_approvals_admin_staff_all" on public.approvals;
create policy "finance_approvals_admin_staff_all" on public.approvals
  for all
  using (public.is_finance_admin_staff())
  with check (public.is_finance_admin_staff());

do $$
declare
  req_col text;
begin
  -- requester_id 컬럼이 있으면 우선, 없으면 requester 사용
  select column_name into req_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'approvals'
    and column_name in ('requester_id', 'requester')
  order by case column_name when 'requester_id' then 1 else 2 end
  limit 1;

  if req_col is null then
    raise notice 'approvals 테이블에 requester / requester_id 컬럼이 모두 없어서 요청자용 정책을 건너뜁니다';
    return;
  end if;

  execute 'drop policy if exists "finance_approvals_select_requester" on public.approvals';
  execute format($f$
    create policy "finance_approvals_select_requester" on public.approvals
      for select
      using (%I::text = auth.uid()::text)
  $f$, req_col);

  execute 'drop policy if exists "finance_approvals_insert_requester" on public.approvals';
  execute format($f$
    create policy "finance_approvals_insert_requester" on public.approvals
      for insert
      with check (
        auth.uid() is not null
        and %I::text = auth.uid()::text
      )
  $f$, req_col);
end $$;

-- ------------------------------------------------------------
-- employees.email 비교 안전 캐스트
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
    and lower(coalesce(email, '')) = lower(coalesce((select u.email::text from auth.users u where u.id = auth.uid()), ''))
    and email is not null
  );

-- ------------------------------------------------------------
-- profiles — id 타입 안전 캐스트
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
-- 나머지 테이블 — 040 에서 이미 만들어졌으면 아래는 멱등으로 재확인
-- (RLS enable 만 재확인. 기존 정책은 040 에서 잘 만들어졌다면 그대로 유지)
-- ------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.transactions enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;

-- 조건부 — vendors / project_finance 존재 시만
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='vendors') then
    execute 'alter table public.vendors enable row level security';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_finance') then
    execute 'alter table public.project_finance enable row level security';
  end if;
end $$;

-- ============================================================
-- 검증 쿼리 (SELECT 만, 영향 없음)
-- ============================================================
--
-- 1) 테이블별 RLS 상태:
--    select tablename, rowsecurity from pg_tables
--    where schemaname='public'
--      and tablename in ('transactions','employees','companies','attendances',
--                        'payroll','approvals','vendors','projects',
--                        'project_finance','project_members','project_milestones','profiles');
--
-- 2) Finance 정책 목록:
--    select tablename, policyname, cmd
--    from pg_policies
--    where schemaname='public' and policyname like 'finance_%'
--    order by tablename, policyname;
--
-- 3) 컬럼 타입 확인 (문제 재발 방지용):
--    select table_name, column_name, data_type
--    from information_schema.columns
--    where table_schema='public'
--      and table_name in ('attendances','payroll','approvals','employees','profiles')
--      and column_name in ('employee_id','requester_id','approver_id','id','email');
--
-- ============================================================
