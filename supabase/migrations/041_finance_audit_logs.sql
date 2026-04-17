-- ============================================================
-- 041_finance_audit_logs.sql
-- Finance 시스템 감사 로그 (Audit Log)
--
-- 목적:
--   - 재무/인사/결재 등 민감 데이터 변경 추적
--   - "누가 언제 어떤 레코드를 어떻게 바꿨나" 포렌식 가능
--   - 컴플라이언스/분쟁 대응 근거
--
-- 사용:
--   lib/finance/audit-log.ts 의 writeAuditLog() 로 API 라우트에서 기록
--
-- 주의:
--   본 파일은 040/040b (RLS 정책) 와 독립적으로 실행 가능하도록
--   admin/staff 체크를 inline 으로 작성. 먼저 실행해도 무방.
-- ============================================================

create table if not exists public.finance_audit_logs (
  id              bigserial primary key,
  actor_id        uuid references auth.users(id) on delete set null,
  actor_email     text,
  actor_role      text,
  entity_type     text        not null,   -- 'transaction' | 'employee' | 'payroll' | 'approval' | 'contract' | 'receipt' | ...
  entity_id       text,                   -- text 로 통일 (숫자 id, uuid id 섞임)
  action          text        not null,   -- 'create' | 'update' | 'delete' | 'batch_delete' | 'approve' | 'reject' | 'send' | 'sign' | 'cancel'
  company         text,                   -- companies.id
  summary         text,                   -- 사람이 읽을 한 줄 ("거래 삭제: 11월 30일 -₩120,000 서울 사무실 월세")
  diff            jsonb,                  -- { before: {...}, after: {...} } 또는 { ids: [...] } 등
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists finance_audit_logs_actor_idx   on public.finance_audit_logs (actor_id, created_at desc);
create index if not exists finance_audit_logs_entity_idx  on public.finance_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists finance_audit_logs_company_idx on public.finance_audit_logs (company, created_at desc);
create index if not exists finance_audit_logs_action_idx  on public.finance_audit_logs (action, created_at desc);

comment on table public.finance_audit_logs is
  'Finance 시스템 감사 로그: 재무/인사/결재 민감 데이터 변경 추적';
comment on column public.finance_audit_logs.diff is
  '변경 전/후 상태. {before:{...}, after:{...}} 또는 {ids:[...]} 형태.';

-- ------------------------------------------------------------
-- RLS — admin/staff 만 읽기, INSERT 는 인증된 사용자 모두 (자기 기록 남기기용)
-- (헬퍼 함수 의존 없이 inline 서브쿼리로 admin/staff 체크)
-- ------------------------------------------------------------

alter table public.finance_audit_logs enable row level security;

drop policy if exists "finance_audit_logs_select_admin_staff" on public.finance_audit_logs;
create policy "finance_audit_logs_select_admin_staff" on public.finance_audit_logs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id::text = auth.uid()::text
        and p.role in ('admin', 'staff')
    )
  );

drop policy if exists "finance_audit_logs_insert_self" on public.finance_audit_logs;
create policy "finance_audit_logs_insert_self" on public.finance_audit_logs
  for insert
  with check (
    auth.uid() is not null
    and (actor_id::text = auth.uid()::text or actor_id is null)
  );

-- 업데이트/삭제는 애초에 허용 안 함 (append-only)
-- → DELETE/UPDATE 정책을 만들지 않음 = 기본 deny

-- ============================================================
-- 유지보수 (선택):
--   90일 이상 된 로그 자동 삭제 (cron 에서 주기적으로 실행)
-- ------------------------------------------------------------
--   delete from public.finance_audit_logs
--   where created_at < now() - interval '90 days';
-- ============================================================
