-- 078: AI 사용량 원장 (비용·rate limit 추적)
-- idempotent — 기존 테이블이 있어도 누락 컬럼을 보강

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid()
);

-- 누락 컬럼 보강 (기존 다른 스키마 테이블이 있었을 경우 대비)
alter table public.ai_usage_logs
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists feature text,
  add column if not exists model text,
  add column if not exists input_tokens int not null default 0,
  add column if not exists output_tokens int not null default 0,
  add column if not exists cost_usd_cents int,
  add column if not exists cost_krw int,
  add column if not exists latency_ms int,
  add column if not exists accepted boolean,
  add column if not exists error text,
  add column if not exists created_at timestamptz not null default now();

-- NOT NULL 제약은 필수 컬럼 확보 이후 적용
do $$
begin
  alter table public.ai_usage_logs alter column feature set not null;
exception when others then null; end $$;
do $$
begin
  alter table public.ai_usage_logs alter column model set not null;
exception when others then null; end $$;

create index if not exists ai_usage_user_month_idx
  on public.ai_usage_logs (user_id, created_at desc);
create index if not exists ai_usage_feature_idx
  on public.ai_usage_logs (feature, created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_select_own_or_admin" on public.ai_usage_logs;
create policy "ai_usage_select_own_or_admin" on public.ai_usage_logs for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ai_usage_insert_service" on public.ai_usage_logs;
create policy "ai_usage_insert_service" on public.ai_usage_logs for insert
  with check (auth.role() = 'service_role' or user_id = auth.uid());

comment on schema public is 'Migration 078 — ai_usage_logs for Claude API budget + rate limit';
