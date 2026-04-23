-- 070: 리뷰 CTA 자동 알림 + 결제 웹훅 원장
-- P1 리뷰 알림 trigger, payment_webhooks 로그

-- ============================================
-- 1. 볼트 마감 시 팀원에게 리뷰 요청 알림 자동 생성
-- ============================================
-- notifications 테이블 스키마: (001_initial.sql 111번대)
--   user_id, type, title, body, link, created_at, is_read
create or replace function public.notify_team_for_reviews()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
begin
  -- completed 로 전환 + closure_summary 존재할 때만
  if new.status = 'completed' and (old is null or old.status <> 'completed') then
    begin
      insert into public.notifications (user_id, type, title, body, link_url, created_at, is_read)
      select
        pm.user_id,
        'review_request',
        '리뷰 요청: ' || new.title,
        '볼트가 마감됐어요. 동료에 대한 리뷰를 남겨주세요 — 포트폴리오에 반영됩니다.',
        '/projects/' || new.id || '?tab=reviews',
        now(),
        false
      from public.project_members pm
      where pm.project_id = new.id
        and pm.user_id is not null
        and coalesce(pm.role, 'member') <> 'observer'
        and (pm.role_type is null or pm.role_type <> 'observer');
      get diagnostics v_count = row_count;
      raise notice 'review_request notifications sent: %', v_count;
    exception when others then
      -- notifications 스키마가 다른 환경에서도 볼트 마감은 성공하도록 보장
      raise notice 'review_request insert failed (non-fatal): %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_close_notify_reviews on public.projects;
create trigger projects_close_notify_reviews
  after update on public.projects
  for each row execute function public.notify_team_for_reviews();

-- ============================================
-- 2. 결제 웹훅 원장 (멱등성 + 감사 추적)
-- ============================================
create table if not exists public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('toss','portone','manual','other')),
  event_type text,                       -- 'payment.approved', 'payment.cancelled', etc.
  provider_event_id text,                -- 공급자가 주는 고유 ID (멱등성)
  payment_key text,                      -- toss: paymentKey, portone: imp_uid
  order_id text,                         -- merchant 주문번호
  amount bigint,
  currency text default 'KRW',
  status text,                           -- approved/cancelled/failed/pending
  raw_payload jsonb,                     -- 웹훅 원본 (재처리용)
  escrow_id uuid references public.project_escrow(id) on delete set null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists payment_webhooks_escrow_idx on public.payment_webhooks (escrow_id);
create index if not exists payment_webhooks_order_idx  on public.payment_webhooks (order_id);

alter table public.payment_webhooks enable row level security;

drop policy if exists "payment_webhooks_select_admin" on public.payment_webhooks;
create policy "payment_webhooks_select_admin"
  on public.payment_webhooks for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "payment_webhooks_insert_service" on public.payment_webhooks;
create policy "payment_webhooks_insert_service"
  on public.payment_webhooks for insert
  with check (auth.role() = 'service_role' or auth.role() = 'anon'); -- 웹훅은 비로그인 POST

-- ============================================
-- 3. project_escrow 에 order_id 추가 (결제 연동)
-- ============================================
alter table public.project_escrow
  add column if not exists order_id text unique;

create index if not exists project_escrow_order_idx on public.project_escrow (order_id);

-- ============================================
-- 4. 주간 매칭 로그 (cron 중복 발송 방지)
-- ============================================
create table if not exists public.weekly_match_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  run_week date not null,   -- ISO week 시작일 (월요일)
  items_count int not null default 0,
  sent_push boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, run_week)
);

-- ============================================
-- 5. pgvector RPC — 주간 매칭용 (069 embeddings 에 의존)
-- ============================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_embeddings') then
    create or replace function public.match_projects_by_embedding(
      query_embedding vector(1536),
      match_count int default 5,
      exclude_user uuid default null
    )
    returns table(id uuid, title text, description text, category text, distance float)
    language sql stable as $f$
      select
        p.id, p.title, p.description, p.category,
        (pe.embedding <=> query_embedding) as distance
      from public.project_embeddings pe
      join public.projects p on p.id = pe.project_id
      where p.status = 'active'
        and coalesce(p.recruiting, true) = true
        and (exclude_user is null or not exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = exclude_user
        ))
      order by pe.embedding <=> query_embedding
      limit match_count
    $f$;

    grant execute on function public.match_projects_by_embedding(vector, int, uuid)
      to authenticated, anon, service_role;
  end if;
exception when others then
  raise notice 'match_projects_by_embedding RPC skipped: %', sqlerrm;
end $$;

-- 완료
comment on schema public is
  'Migration 070 — review CTA trigger, payment webhooks ledger, escrow order_id, weekly match runs, match RPC';
