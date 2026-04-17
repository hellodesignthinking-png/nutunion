-- ============================================================
-- 052_finance_foreign_keys.sql
-- Finance 데이터 무결성: FK 제약 추가
--
-- 목적:
--   orphan 레코드 방지 (존재하지 않는 company 참조 등)
--
-- 접근:
--   1) 기존 orphan 레코드 식별 (삭제 안 함 — 데이터 손실 방지)
--   2) NOT VALID 로 FK 추가 (기존 행은 검증 skip, 신규 insert/update 만 검증)
--   3) 운영 담당자가 orphan 정리 후 수동으로 VALIDATE CONSTRAINT 실행
--
-- 주의:
--   · companies.id 는 text 타입 — FK 호환 확인됨
--   · employees → companies FK 는 기존 데이터에 orphan 많을 가능성 → NOT VALID 필수
--   · ON DELETE RESTRICT: 참조 중인 company 삭제 차단 (데이터 보호)
-- ============================================================

-- ------------------------------------------------------------
-- 0. Orphan 검출 (참고용 — 실제 삭제 안 함)
-- ------------------------------------------------------------

do $$
declare
  tx_orphan int;
  emp_orphan int;
  att_orphan int;
  pay_orphan int;
  appr_orphan int;
begin
  -- transactions.company 중 companies 에 없는 값
  select count(*) into tx_orphan
  from public.transactions t
  where t.company is not null
    and not exists (select 1 from public.companies c where c.id = t.company);

  -- employees.company
  select count(*) into emp_orphan
  from public.employees e
  where e.company is not null
    and not exists (select 1 from public.companies c where c.id = e.company);

  -- attendances.employee_id → employees.id (양쪽 text 캐스트)
  select count(*) into att_orphan
  from public.attendances a
  where a.employee_id is not null
    and not exists (select 1 from public.employees e where e.id::text = a.employee_id::text);

  -- payroll.employee_id → employees.id (양쪽 text 캐스트)
  select count(*) into pay_orphan
  from public.payroll p
  where p.employee_id is not null
    and not exists (select 1 from public.employees e where e.id::text = p.employee_id::text);

  -- approvals.company
  select count(*) into appr_orphan
  from public.approvals ap
  where ap.company is not null
    and not exists (select 1 from public.companies c where c.id = ap.company);

  raise notice '=== Orphan 레코드 현황 (FK 적용 전) ===';
  raise notice '  transactions (company 없음): %', tx_orphan;
  raise notice '  employees (company 없음): %', emp_orphan;
  raise notice '  attendances (employee 없음): %', att_orphan;
  raise notice '  payroll (employee 없음): %', pay_orphan;
  raise notice '  approvals (company 없음): %', appr_orphan;
  raise notice '=== FK 는 NOT VALID 로 추가됨 — 기존 orphan 유지 ===';
  raise notice '=== Orphan 정리 후 VALIDATE CONSTRAINT 실행 권장 ===';
end $$;

-- ------------------------------------------------------------
-- 1. transactions.company → companies.id (ON DELETE RESTRICT)
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_company_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_company_fkey
      foreign key (company) references public.companies(id)
      on delete restrict
      on update cascade
      not valid;
    raise notice 'FK transactions.company → companies.id 추가됨 (NOT VALID)';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. employees.company → companies.id (ON DELETE RESTRICT)
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_company_fkey'
  ) then
    alter table public.employees
      add constraint employees_company_fkey
      foreign key (company) references public.companies(id)
      on delete restrict
      on update cascade
      not valid;
    raise notice 'FK employees.company → companies.id 추가됨 (NOT VALID)';
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. approvals.company → companies.id (ON DELETE SET NULL)
--    결재는 법인 삭제 시 null 로 설정 (기록 유지)
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'approvals_company_fkey'
  ) then
    alter table public.approvals
      add constraint approvals_company_fkey
      foreign key (company) references public.companies(id)
      on delete set null
      on update cascade
      not valid;
    raise notice 'FK approvals.company → companies.id 추가됨 (NOT VALID)';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. attendances / payroll — employee_id 는 text 이고 employees.id 는 bigint
--    타입 불일치로 직접 FK 불가. 대신 trigger 기반 검증 (참조 무결성 보장)
-- ------------------------------------------------------------

create or replace function public.check_employee_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.employee_id is null then return new; end if;
  if not exists (select 1 from public.employees where id::text = new.employee_id::text) then
    raise exception 'employee_id "%" 가 employees 테이블에 없습니다', new.employee_id;
  end if;
  return new;
end;
$$;

comment on function public.check_employee_exists() is
  'attendances/payroll.employee_id 가 employees.id 를 참조하는지 검증 (bigint vs text 타입 불일치 대응)';

-- attendances 트리거
drop trigger if exists attendances_employee_fk on public.attendances;
create trigger attendances_employee_fk
  before insert or update of employee_id on public.attendances
  for each row
  execute function public.check_employee_exists();

-- payroll 트리거
drop trigger if exists payroll_employee_fk on public.payroll;
create trigger payroll_employee_fk
  before insert or update of employee_id on public.payroll
  for each row
  execute function public.check_employee_exists();

-- ------------------------------------------------------------
-- 5. project_finance / project_members / project_milestones → projects.id
--    (이미 존재할 수도 있지만 멱등)
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_finance') then
    if not exists (select 1 from pg_constraint where conname = 'project_finance_project_fkey') then
      begin
        alter table public.project_finance
          add constraint project_finance_project_fkey
          foreign key (project_id) references public.projects(id)
          on delete cascade
          not valid;
        raise notice 'FK project_finance.project_id → projects.id 추가됨';
      exception when others then
        raise notice 'project_finance FK 추가 실패: %', sqlerrm;
      end;
    end if;
  end if;
end $$;

-- ============================================================
-- 검증 / 활성화 절차
-- ------------------------------------------------------------
--
-- 1) Orphan 레코드 수동 확인:
--      select t.id, t.date, t.company, t.description, t.amount
--      from public.transactions t
--      where t.company is not null
--        and not exists (select 1 from public.companies c where c.id = t.company);
--
-- 2) Orphan 정리 (예: company='불명' 으로 리네임):
--      insert into public.companies (id, name) values ('unknown', '미분류')
--      on conflict (id) do nothing;
--
--      update public.transactions set company = 'unknown'
--      where company is not null
--        and not exists (select 1 from public.companies c where c.id = transactions.company);
--
-- 3) 모든 orphan 정리 후 FK 활성화 (기존 데이터도 검증):
--      alter table public.transactions validate constraint transactions_company_fkey;
--      alter table public.employees validate constraint employees_company_fkey;
--      alter table public.approvals validate constraint approvals_company_fkey;
--
-- 4) FK 목록 조회:
--      select conname, conrelid::regclass as table_name,
--             pg_get_constraintdef(oid) as definition,
--             convalidated
--      from pg_constraint
--      where contype = 'f' and conrelid::regclass::text like 'public.%'
--      order by conrelid::regclass::text;
--
-- ============================================================
