-- ============================================================
-- 052b_finance_foreign_keys_v2.sql
-- 052 파일의 Supabase Dashboard dollar-quote 파싱 오류 우회 버전
--
-- 변경점:
--   · 모든 DO 블록에 고유 태그 ($blk1$, $blk2$ ...) 적용
--   · orphan 카운트 블록은 일반 SELECT 로 변경 (DO 불필요)
--   · 파싱 충돌 가능성 제거
-- ============================================================

-- ------------------------------------------------------------
-- 0. Orphan 현황 조회 (단순 SELECT — 결과를 결과창에서 확인)
-- ------------------------------------------------------------

select 'transactions (company orphan)' as what,
       (select count(*) from public.transactions t
        where t.company is not null
          and not exists (select 1 from public.companies c where c.id = t.company)) as cnt
union all select 'employees (company orphan)',
       (select count(*) from public.employees e
        where e.company is not null
          and not exists (select 1 from public.companies c where c.id = e.company))
union all select 'attendances (employee orphan)',
       (select count(*) from public.attendances a
        where a.employee_id is not null
          and not exists (select 1 from public.employees e where e.id::text = a.employee_id::text))
union all select 'payroll (employee orphan)',
       (select count(*) from public.payroll p
        where p.employee_id is not null
          and not exists (select 1 from public.employees e where e.id::text = p.employee_id::text))
union all select 'approvals (company orphan)',
       (select count(*) from public.approvals ap
        where ap.company is not null
          and not exists (select 1 from public.companies c where c.id = ap.company));

-- ------------------------------------------------------------
-- 1. transactions.company → companies.id
-- ------------------------------------------------------------

do $blk1$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_company_fkey') then
    alter table public.transactions
      add constraint transactions_company_fkey
      foreign key (company) references public.companies(id)
      on delete restrict on update cascade not valid;
  end if;
end
$blk1$;

-- ------------------------------------------------------------
-- 2. employees.company → companies.id
-- ------------------------------------------------------------

do $blk2$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_company_fkey') then
    alter table public.employees
      add constraint employees_company_fkey
      foreign key (company) references public.companies(id)
      on delete restrict on update cascade not valid;
  end if;
end
$blk2$;

-- ------------------------------------------------------------
-- 3. approvals.company → companies.id (ON DELETE SET NULL)
-- ------------------------------------------------------------

do $blk3$
begin
  if not exists (select 1 from pg_constraint where conname = 'approvals_company_fkey') then
    alter table public.approvals
      add constraint approvals_company_fkey
      foreign key (company) references public.companies(id)
      on delete set null on update cascade not valid;
  end if;
end
$blk3$;

-- ------------------------------------------------------------
-- 4. attendances / payroll — trigger 기반 employee_id 검증
--    (bigint vs text 타입 불일치로 직접 FK 불가)
-- ------------------------------------------------------------

create or replace function public.check_employee_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.employee_id is null then return new; end if;
  if not exists (select 1 from public.employees where id::text = new.employee_id::text) then
    raise exception 'employee_id "%" 가 employees 테이블에 없습니다', new.employee_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists attendances_employee_fk on public.attendances;
create trigger attendances_employee_fk
  before insert or update of employee_id on public.attendances
  for each row execute function public.check_employee_exists();

drop trigger if exists payroll_employee_fk on public.payroll;
create trigger payroll_employee_fk
  before insert or update of employee_id on public.payroll
  for each row execute function public.check_employee_exists();

-- ------------------------------------------------------------
-- 5. project_finance → projects.id (테이블 존재 시만)
-- ------------------------------------------------------------

do $blk5$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='project_finance') then
    if not exists (select 1 from pg_constraint where conname = 'project_finance_project_fkey') then
      alter table public.project_finance
        add constraint project_finance_project_fkey
        foreign key (project_id) references public.projects(id)
        on delete cascade not valid;
    end if;
  end if;
end
$blk5$;

-- ============================================================
-- 확인:
--   select conname, conrelid::regclass as tbl, convalidated
--   from pg_constraint
--   where contype = 'f' and conname like '%_fkey'
--     and conrelid::regclass::text like 'public.%'
--   order by tbl;
-- ============================================================
