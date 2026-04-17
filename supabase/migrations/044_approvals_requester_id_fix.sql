-- ============================================================
-- 044_approvals_requester_id_fix.sql
-- approvals 테이블의 requester_id 컬럼 보장
--
-- 배경:
--   앱 코드 (app/api/finance/approvals/route.ts, approval-queries.ts 등) 는
--   `requester_id` 컬럼을 가정하지만 기존 DB 스키마에는 `requester` 만 존재.
--   이로 인해 결재 생성 INSERT 가 silently 컬럼 drop 되거나 RLS 정책이 작동 안함.
--
-- 안전한 마이그레이션:
--   1) requester_id 이미 존재 → no-op
--   2) requester 존재 + requester_id 없음 → requester_id 추가 후 데이터 복사
--   3) 둘 다 없음 → requester_id 만 추가 (uuid)
--   4) 기존 requester 컬럼은 삭제하지 않고 유지 (다른 코드가 참조할 수 있음)
-- ============================================================

do $$
declare
  has_requester_id boolean;
  has_requester boolean;
  requester_type text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals' and column_name = 'requester_id'
  ) into has_requester_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals' and column_name = 'requester'
  ) into has_requester;

  if has_requester_id then
    raise notice 'approvals.requester_id 이미 존재 — 변경 없음';
    return;
  end if;

  -- requester_id 가 없음 → 추가
  alter table public.approvals add column requester_id uuid;
  raise notice 'approvals.requester_id 컬럼 추가 완료 (uuid)';

  -- requester 컬럼이 있고 타입이 호환되면 데이터 복사 시도
  if has_requester then
    select data_type into requester_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals' and column_name = 'requester';

    raise notice 'approvals.requester 기존 타입: %', requester_type;

    -- uuid 직접 할당 가능한 경우: uuid, text
    if requester_type in ('uuid', 'text', 'character varying') then
      begin
        execute 'update public.approvals set requester_id = requester::uuid where requester is not null and requester_id is null';
        raise notice 'requester → requester_id 데이터 복사 완료';
      exception
        when invalid_text_representation or data_exception then
          raise notice 'requester 값이 uuid 가 아니어서 복사 skip (%) — 수동 확인 필요', sqlerrm;
      end;
    else
      raise notice 'requester 타입(%) 이 uuid 와 호환 안됨 — 수동 마이그레이션 필요', requester_type;
    end if;
  end if;
end $$;

-- 인덱스 (RLS 정책의 requester_id = auth.uid() 조회 최적화)
create index if not exists approvals_requester_id_idx on public.approvals (requester_id);

-- RLS 정책 재적용 (040b 에서 inline 감지되었지만 명시적 컬럼명으로 재고정)
alter table public.approvals enable row level security;

drop policy if exists "finance_approvals_select_requester" on public.approvals;
create policy "finance_approvals_select_requester" on public.approvals
  for select
  using (requester_id::text = auth.uid()::text);

drop policy if exists "finance_approvals_insert_requester" on public.approvals;
create policy "finance_approvals_insert_requester" on public.approvals
  for insert
  with check (
    auth.uid() is not null
    and requester_id::text = auth.uid()::text
  );

-- ============================================================
-- 검증
--   select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='approvals'
--     and column_name in ('requester','requester_id');
--
--   select count(*) filter (where requester_id is not null) as with_id,
--          count(*) filter (where requester_id is null) as without_id
--   from public.approvals;
-- ============================================================
