-- 076: 장기 tier — 법무/세무 실연동 + Phase 4 (Open Protocol / City Chapter / Vibe / i18n)

-- ============================================
-- 1. 전자서명 (모두싸인/eForm)
-- ============================================
alter table public.project_contracts
  add column if not exists esign_provider text check (esign_provider in ('modusign','eformsign','docusign','manual') or esign_provider is null),
  add column if not exists esign_document_id text,       -- 공급자 측 문서 ID
  add column if not exists esign_request_id text,
  add column if not exists esign_status text,            -- draft/sent/partial/completed/rejected
  add column if not exists esign_pdf_url text,           -- 완료된 PDF URL
  add column if not exists esign_embed_url text;         -- iframe 서명 페이지

create table if not exists public.esign_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.project_contracts(id) on delete cascade,
  provider text not null,
  event_type text not null,                              -- 'sent','viewed','signed','completed','rejected'
  actor_email text,
  raw_payload jsonb,
  received_at timestamptz not null default now()
);
create index if not exists esign_events_contract_idx on public.esign_events (contract_id, received_at desc);

alter table public.esign_events enable row level security;
drop policy if exists "esign_events_select_parties" on public.esign_events;
create policy "esign_events_select_parties" on public.esign_events for select
  using (
    exists (
      select 1 from public.project_contracts c
      where c.id = esign_events.contract_id
        and (c.client_id = auth.uid() or c.contractor_id = auth.uid() or c.created_by = auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "esign_events_insert_service" on public.esign_events;
create policy "esign_events_insert_service" on public.esign_events for insert
  with check (auth.role() = 'service_role' or auth.role() = 'anon');  -- 웹훅 받는 용

-- ============================================
-- 2. 세금계산서/원천징수 실연동 (Popbill 등)
-- ============================================
alter table public.tax_invoices
  add column if not exists provider text check (provider in ('popbill','bill36524','hometax_direct','manual') or provider is null),
  add column if not exists provider_mgt_key text,         -- 공급자 관리번호
  add column if not exists submitted_at timestamptz,      -- 국세청 제출 시각
  add column if not exists nts_confirm_num text;          -- 국세청 승인번호

create table if not exists public.tax_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.tax_invoices(id) on delete cascade,
  provider text not null,
  event_type text not null,                               -- 'issued','sent','accepted','rejected','voided'
  raw_payload jsonb,
  received_at timestamptz not null default now()
);
create index if not exists tax_invoice_events_idx on public.tax_invoice_events (invoice_id);

alter table public.tax_invoice_events enable row level security;
drop policy if exists "tax_events_select_parties" on public.tax_invoice_events;
create policy "tax_events_select_parties" on public.tax_invoice_events for select
  using (
    exists (
      select 1 from public.tax_invoices ti
      join public.project_contracts c on c.id = ti.contract_id
      where ti.id = tax_invoice_events.invoice_id
        and (c.client_id = auth.uid() or c.contractor_id = auth.uid() or c.created_by = auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "tax_events_insert_service" on public.tax_invoice_events;
create policy "tax_events_insert_service" on public.tax_invoice_events for insert
  with check (auth.role() = 'service_role' or auth.role() = 'anon');

-- ============================================
-- 3. Phase 4-① Open Protocol — 화이트라벨 인스턴스 등록
-- ============================================
create table if not exists public.protocol_instances (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                              -- 'seoul-food-scene' 등
  name text not null,
  host_org_id uuid references public.b2b_organizations(id) on delete set null,
  domain text unique,                                     -- 'foodscene.nutunion.co.kr'
  brand_primary text default '#FF3D88',
  brand_ink text default '#0D0D0D',
  logo_url text,
  license_tier text not null default 'community'
    check (license_tier in ('community','pro','enterprise')),
  revenue_share_rate numeric(5,4) default 0.15,           -- 플랫폼 기본 수수료 15%
  status text not null default 'pending' check (status in ('pending','active','suspended','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.protocol_instances enable row level security;
drop policy if exists "protocol_select_all" on public.protocol_instances;
create policy "protocol_select_all" on public.protocol_instances for select
  using (status = 'active' or created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "protocol_write_admin" on public.protocol_instances;
create policy "protocol_write_admin" on public.protocol_instances for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================
-- 4. Phase 4-② City Chapter — 지역 확장
-- ============================================
create table if not exists public.city_chapters (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                              -- 'seoul','busan','jeju','daegu'
  name_ko text not null,
  name_en text,
  region_code text,                                       -- 'KR-11' (서울) 등 ISO 3166-2
  captain_id uuid references public.profiles(id) on delete set null,   -- 챕터장 와셔
  sponsor_org_id uuid references public.b2b_organizations(id) on delete set null,
  cover_url text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists city_chapters_active_idx on public.city_chapters (active) where active = true;

-- 너트/볼트에 city_chapter_id 연결 (선택)
alter table public.groups        add column if not exists city_chapter_id uuid references public.city_chapters(id) on delete set null;
alter table public.projects      add column if not exists city_chapter_id uuid references public.city_chapters(id) on delete set null;
create index if not exists groups_city_idx on public.groups (city_chapter_id) where city_chapter_id is not null;

alter table public.city_chapters enable row level security;
drop policy if exists "city_chapters_select_all" on public.city_chapters;
create policy "city_chapters_select_all" on public.city_chapters for select using (true);
drop policy if exists "city_chapters_write_admin" on public.city_chapters;
create policy "city_chapters_write_admin" on public.city_chapters for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 초기 시드 (서울/부산/제주/대구/광주)
insert into public.city_chapters (slug, name_ko, name_en, region_code)
values
  ('seoul',    '서울',   'Seoul',    'KR-11'),
  ('busan',    '부산',   'Busan',    'KR-26'),
  ('jeju',     '제주',   'Jeju',     'KR-49'),
  ('daegu',    '대구',   'Daegu',    'KR-27'),
  ('gwangju',  '광주',   'Gwangju',  'KR-29')
on conflict (slug) do nothing;

-- ============================================
-- 5. Phase 4-③ Vibe Economy — 탭 구독 모델
-- ============================================
create table if not exists public.tap_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade not null,  -- 구독받는 와셔
  subscriber_id uuid references public.profiles(id) on delete cascade not null,
  tier text not null default 'monthly' check (tier in ('monthly','yearly','lifetime')),
  amount bigint not null,
  status text not null default 'active' check (status in ('active','cancelled','paused','expired','pending_payment')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  escrow_id uuid references public.project_escrow(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (creator_id, subscriber_id)
);
create index if not exists tap_subs_creator_idx on public.tap_subscriptions (creator_id, status);
create index if not exists tap_subs_subscriber_idx on public.tap_subscriptions (subscriber_id, status);

alter table public.tap_subscriptions enable row level security;
drop policy if exists "tap_subs_select" on public.tap_subscriptions;
create policy "tap_subs_select" on public.tap_subscriptions for select
  using (
    subscriber_id = auth.uid() or creator_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "tap_subs_insert_self" on public.tap_subscriptions;
create policy "tap_subs_insert_self" on public.tap_subscriptions for insert
  with check (subscriber_id = auth.uid());
drop policy if exists "tap_subs_update_self_or_creator" on public.tap_subscriptions;
create policy "tap_subs_update_self_or_creator" on public.tap_subscriptions for update
  using (subscriber_id = auth.uid() or creator_id = auth.uid());

-- 크리에이터 월 구독료 필드
alter table public.profiles
  add column if not exists creator_monthly_fee bigint default 0,
  add column if not exists creator_yearly_fee bigint default 0,
  add column if not exists creator_enabled boolean not null default false;

-- ============================================
-- 6. Phase 4-④ i18n — 다국어 slug
-- ============================================
alter table public.groups       add column if not exists description_en text, add column if not exists description_ja text;
alter table public.projects     add column if not exists description_en text, add column if not exists description_ja text;
alter table public.wiki_pages   add column if not exists content_en text,     add column if not exists content_ja text;

comment on schema public is
  'Migration 076 — esign + tax invoices + Open Protocol + City Chapter + Vibe Economy + i18n';
