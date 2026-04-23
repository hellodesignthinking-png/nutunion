-- 082: AI budget 추적을 별도 테이블로 분리 — 043 과 스키마 충돌 해소
--
-- 배경:
--   043_ai_usage_logs = finance/marketing AI 호출 원장 (id bigserial, actor_id, endpoint, content_type 등)
--   078_ai_usage_logs = 커뮤니티 AI 기능 budget (id uuid, user_id, feature, cost_krw, accepted 등)
--   → 두 마이그레이션이 같은 테이블명으로 충돌. 용도가 완전히 다르므로 분리.
--
-- 조치: 신규 테이블 `ai_budget_logs` 생성. lib/ai/client.ts 는 이 테이블 참조로 전환.
-- 078 이 prod 에 이미 적용됐다면 기존 데이터는 보존 (082 는 새 테이블만 생성).

create table if not exists public.ai_budget_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd_cents int,
  cost_krw int,
  latency_ms int,
  accepted boolean,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ai_budget_user_month_idx
  on public.ai_budget_logs (user_id, created_at desc);
create index if not exists ai_budget_feature_idx
  on public.ai_budget_logs (feature, created_at desc);

alter table public.ai_budget_logs enable row level security;

drop policy if exists "ai_budget_select_own_or_admin" on public.ai_budget_logs;
create policy "ai_budget_select_own_or_admin" on public.ai_budget_logs for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ai_budget_insert_service" on public.ai_budget_logs;
create policy "ai_budget_insert_service" on public.ai_budget_logs for insert
  with check (auth.role() = 'service_role' or user_id = auth.uid());

-- 기존 078 데이터 (만약 있으면) 복사 — 동일 컬럼 매핑
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ai_usage_logs')
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'ai_usage_logs' and column_name = 'feature'
     ) then
    insert into public.ai_budget_logs (id, user_id, feature, model, input_tokens, output_tokens, cost_usd_cents, cost_krw, latency_ms, accepted, error, created_at)
    select id::uuid, user_id, feature, model,
           coalesce(input_tokens, 0), coalesce(output_tokens, 0),
           cost_usd_cents, cost_krw, latency_ms, accepted, error, created_at
    from public.ai_usage_logs
    where feature is not null  -- 043 레거시 row 제외
    on conflict (id) do nothing;
  end if;
exception when others then
  raise notice 'ai_usage_logs → ai_budget_logs 마이그레이션 skip: %', sqlerrm;
end $$;

comment on schema public is 'Migration 082 — ai_budget_logs (lib/ai/client.ts 전용). 043 ai_usage_logs 는 finance/marketing 전용 유지.';
