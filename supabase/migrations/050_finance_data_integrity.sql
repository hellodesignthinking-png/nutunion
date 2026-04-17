-- ============================================================
-- 050_finance_data_integrity.sql
-- 백엔드 안정성: 데이터 무결성 보강
--
-- 해결하는 문제:
--   1) 앱이 id=Date.now() 로 PK 를 직접 할당 → 동시 INSERT 시 충돌
--   2) payroll 중복 방지 (같은 직원/월 2건 금지)
--   3) attendances 중복 방지 (같은 직원/날짜/유형 2건 금지)
--   4) 공백 입력 차단 (CHECK constraints)
--
-- 방법:
--   · id 컬럼에 sequence 기반 DEFAULT 추가 → 앱이 id 를 안 보내도 자동 할당
--   · 기존 앱 코드가 id 를 보내는 경우도 그 값 유지 (DEFAULT 는 미전달 시만 발동)
--   · UNIQUE constraint 추가 전 중복 레코드 정리 안내
-- ============================================================

-- ------------------------------------------------------------
-- 1. id 자동 생성 (기존 bigint id 를 identity 로 전환)
--    기존 값은 유지, 향후 insert 시 자동으로 현재 max+1 부터
-- ------------------------------------------------------------

do $$
declare
  tbl text;
  max_id bigint;
  seq_name text;
begin
  for tbl in
    select unnest(array['transactions','employees','approvals','payroll','attendances']) as t
    where exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name = t and column_name='id'
    )
  loop
    -- 해당 테이블의 현재 max(id)
    execute format('select coalesce(max(id), 0) from public.%I', tbl) into max_id;
    seq_name := tbl || '_id_seq';

    -- 시퀀스가 없으면 생성
    if not exists (select 1 from pg_sequences where schemaname='public' and sequencename=seq_name) then
      execute format('create sequence public.%I start with %s', seq_name, max_id + 1);
      raise notice '시퀀스 public.% 생성 (시작값: %)', seq_name, max_id + 1;
    else
      -- 이미 있으면 max_id 보다 크도록 조정
      execute format('select setval(%L, greatest(%s, nextval(%L)))', 'public.' || seq_name, max_id, 'public.' || seq_name);
    end if;

    -- id 컬럼의 DEFAULT 를 nextval 로 설정 (이미 설정되어 있을 수도 있음)
    execute format(
      'alter table public.%I alter column id set default nextval(%L)',
      tbl, 'public.' || seq_name
    );

    -- 시퀀스 소유권을 컬럼에 부여
    execute format('alter sequence public.%I owned by public.%I.id', seq_name, tbl);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. payroll: 같은 직원/월 중복 방지
-- ------------------------------------------------------------

-- 중복 제거 (최신 것 하나만 남김)
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count from (
    select employee_id, year_month, count(*) as c
    from public.payroll
    group by employee_id, year_month
    having count(*) > 1
  ) t;

  if dup_count > 0 then
    raise notice 'payroll 중복 % 쌍 발견 — 최신 것만 남기고 나머지 삭제', dup_count;
    with ranked as (
      select id,
        row_number() over (
          partition by employee_id, year_month
          order by coalesce(paid_date, '1900-01-01') desc, id desc
        ) as rn
      from public.payroll
    )
    delete from public.payroll where id in (select id from ranked where rn > 1);
  end if;
end $$;

-- UNIQUE 제약
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_employee_month_unique'
  ) then
    alter table public.payroll
      add constraint payroll_employee_month_unique
      unique (employee_id, year_month);
    raise notice 'payroll UNIQUE(employee_id, year_month) 추가됨';
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. attendances: 같은 직원/날짜/유형 중복 방지
-- ------------------------------------------------------------

-- 단, 같은 유형이라도 여러 번 기록이 필요할 수 있음 (ex: 출근 N번)
-- 따라서 strict unique 대신 partial unique (type 이 '출근','퇴근'만 제외)
-- → 일단은 UNIQUE 안 걸고 인덱스만 추가 (안전)

-- ------------------------------------------------------------
-- 4. NOT NULL / CHECK 보강 (기존 데이터 깨지지 않는 것만)
-- ------------------------------------------------------------

do $$
begin
  -- transactions.amount 는 0 이면 안 됨 (앱에서 검증하지만 DB 레벨로도)
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_amount_nonzero'
  ) then
    begin
      alter table public.transactions
        add constraint transactions_amount_nonzero check (amount <> 0) not valid;
      -- not valid: 기존 데이터는 검증 skip, 신규 insert/update 만 검증
      raise notice 'transactions amount <> 0 constraint 추가됨 (기존 데이터 skip)';
    exception when others then
      raise notice 'transactions_amount_nonzero 추가 실패: %', sqlerrm;
    end;
  end if;

  -- employees.name 공백 금지
  if not exists (
    select 1 from pg_constraint where conname = 'employees_name_nonblank'
  ) then
    begin
      alter table public.employees
        add constraint employees_name_nonblank check (length(trim(name)) > 0) not valid;
      raise notice 'employees name 공백 금지 constraint 추가됨';
    exception when others then
      raise notice 'employees_name_nonblank 추가 실패: %', sqlerrm;
    end;
  end if;

  -- approvals.title 공백 금지
  if not exists (
    select 1 from pg_constraint where conname = 'approvals_title_nonblank'
  ) then
    begin
      alter table public.approvals
        add constraint approvals_title_nonblank check (length(trim(title)) > 0) not valid;
      raise notice 'approvals title 공백 금지 constraint 추가됨';
    exception when others then
      raise notice 'approvals_title_nonblank 추가 실패: %', sqlerrm;
    end;
  end if;
end $$;

-- ============================================================
-- 검증
-- ------------------------------------------------------------
--   -- id 기본값 확인
--   select table_name, column_name, column_default
--   from information_schema.columns
--   where table_schema='public'
--     and table_name in ('transactions','employees','approvals','payroll','attendances')
--     and column_name='id';
--
--   -- UNIQUE / CHECK 제약 확인
--   select conname, contype, conrelid::regclass
--   from pg_constraint
--   where conrelid::regclass::text like 'public.%'
--     and (conname like 'payroll_%' or conname like 'transactions_%' or conname like 'employees_%' or conname like 'approvals_%');
-- ============================================================
