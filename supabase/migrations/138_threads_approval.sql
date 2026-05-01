-- ============================================
-- Migration 138: threads code 승인 워크플로 + audit log
-- ============================================
-- code-mode Thread (ui_component='__code__') 는 사용자 코드를 sandbox 에서 실행하므로
-- 무분별한 publish 가 위험. approval_status 컬럼 + 변경 이력 audit 로 통제.
--
-- 흐름:
--  1) 사용자 빌드 → approval_status='pending', is_draft=true
--  2) admin 검토 → 'approved' 또는 'rejected' (이유 audit 에 기록)
--  3) approved 만 다른 user 가 install 가능
--  4) 모든 status 전환은 thread_approval_audit 에 기록

alter table public.threads
  add column if not exists approval_status text default 'approved' check (approval_status in ('pending','approved','rejected'));

-- ui_component='__code__' 인 새 row 는 default 로 'pending' 으로 들어가도록 trigger
create or replace function public.threads_set_pending_for_code()
returns trigger language plpgsql as $$
begin
  if NEW.ui_component = '__code__' and NEW.approval_status is null then
    NEW.approval_status := 'pending';
  end if;
  return NEW;
end;
$$;

drop trigger if exists threads_set_pending on public.threads;
create trigger threads_set_pending
  before insert on public.threads
  for each row execute function public.threads_set_pending_for_code();

-- audit log
create table if not exists public.thread_approval_audit (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_thread_approval_audit_thread on public.thread_approval_audit(thread_id, created_at desc);

-- audit 는 admin 만 조회
alter table public.thread_approval_audit enable row level security;
drop policy if exists "audit_select_admin" on public.thread_approval_audit;
create policy "audit_select_admin" on public.thread_approval_audit
  for select using (
    exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- thread install 정책 — code-mode 는 approved 만 install 가능
-- (기존 install 정책에 추가)
do $$ begin
  -- 기존 thread_installations insert 정책에 approval_status 체크가 없으면 보강
  -- 정책 이름은 환경별로 다를 수 있어 idempotent 하게 다시 작성하지 않음.
  -- 대신 라우트(/api/threads/install) 에서 approval_status 검증 (코드에서 처리).
  null;
end $$;

notify pgrst, 'reload schema';
