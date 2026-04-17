-- ============================================================
-- 051_finance_indexes.sql
-- 백엔드 성능: 핫패스 쿼리 인덱스
--
-- 기반 분석:
--   lib/finance/*-queries.ts 의 WHERE / ORDER BY 절 분석
-- ============================================================

-- ------------------------------------------------------------
-- transactions
-- ------------------------------------------------------------
--  · getCompanyTransactions: .eq("company").gte("date").lte("date").order("date desc")
--  · 대시보드: 월별 집계
create index if not exists transactions_company_date_idx
  on public.transactions (company, date desc);

create index if not exists transactions_date_idx
  on public.transactions (date desc);

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);

-- 중복 거래 감지: date + company + amount + description (최근 1시간)
create index if not exists transactions_dup_check_idx
  on public.transactions (date, company, amount, description);

-- ------------------------------------------------------------
-- employees
-- ------------------------------------------------------------
--  · getHRDashboard: .eq("status", "재직")
--  · 본인 조회: .eq("email", lower)
create index if not exists employees_status_idx
  on public.employees (status);

create index if not exists employees_email_lower_idx
  on public.employees (lower(email))
  where email is not null;

create index if not exists employees_company_status_idx
  on public.employees (company, status);

-- ------------------------------------------------------------
-- attendances
-- ------------------------------------------------------------
--  · getMonthlyAttendance: .eq("employee_id").gte("date").lte("date")
create index if not exists attendances_employee_date_idx
  on public.attendances (employee_id, date desc);

create index if not exists attendances_date_idx
  on public.attendances (date desc);

-- ------------------------------------------------------------
-- payroll
-- ------------------------------------------------------------
--  · getMonthlyPayroll: .eq("year_month")
--  · getEmployeePayrollHistory: .eq("employee_id").order("year_month desc")
create index if not exists payroll_year_month_idx
  on public.payroll (year_month desc);

create index if not exists payroll_employee_year_month_idx
  on public.payroll (employee_id, year_month desc);

-- ------------------------------------------------------------
-- approvals
-- ------------------------------------------------------------
--  · getApprovals: .eq("status").order("created_at desc")
create index if not exists approvals_status_created_idx
  on public.approvals (status, created_at desc);

create index if not exists approvals_created_idx
  on public.approvals (created_at desc);

create index if not exists approvals_company_status_idx
  on public.approvals (company, status);

-- requester_id (이미 044 에서 생성되었을 수 있지만 멱등)
create index if not exists approvals_requester_id_idx
  on public.approvals (requester_id)
  where requester_id is not null;

-- ------------------------------------------------------------
-- profiles (RLS 정책에서 빈번히 참조)
-- ------------------------------------------------------------
create index if not exists profiles_role_idx
  on public.profiles (role)
  where role in ('admin', 'staff');

-- ============================================================
-- 분석 / 모니터링 쿼리
-- ------------------------------------------------------------
--  · 인덱스 사용 통계:
--      select schemaname, relname, indexrelname, idx_scan, idx_tup_read
--      from pg_stat_user_indexes
--      where schemaname='public'
--        and relname in ('transactions','employees','attendances','payroll','approvals')
--      order by idx_scan desc;
--
--  · 사용 안 되는 인덱스 (idx_scan = 0):
--      select indexrelname, pg_size_pretty(pg_relation_size(indexrelid))
--      from pg_stat_user_indexes
--      where schemaname='public' and idx_scan = 0;
-- ============================================================
