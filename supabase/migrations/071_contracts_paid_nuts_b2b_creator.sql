-- 071: 전략 로드맵 남은 4건 통합 스키마
-- ⑦ 계약서/세금계산서, ⑩ 유료 너트, ⑬ B2B 포털, ⑯ 크리에이터 이코노미
-- 모든 정책 idempotent — 재실행 안전

-- ============================================
-- 1. 계약서 (프로젝트 용역 계약)
-- ============================================
create table if not exists public.project_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  client_id uuid references public.profiles(id) on delete set null,     -- 발주 주체
  contractor_id uuid references public.profiles(id) on delete set null, -- 수주 주체
  template text not null default 'standard_service' check (template in ('standard_service','nda','revenue_share','custom')),
  title text not null,
  status text not null default 'draft' check (status in ('draft','sent','signed_by_client','signed_by_contractor','signed','cancelled','expired')),
  -- 금액
  contract_amount bigint,                        -- 계약 총액 (원)
  vat_included boolean not null default false,
  withholding_rate numeric(5,4) default 0.033,   -- 원천징수 3.3%
  -- 기간
  start_date date,
  end_date date,
  -- 본문 (Markdown)
  terms_md text,
  -- 서명
  client_signed_at timestamptz,
  client_signature_name text,
  contractor_signed_at timestamptz,
  contractor_signature_name text,
  -- 감사
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_contracts_project_idx on public.project_contracts (project_id, status);

alter table public.project_contracts enable row level security;
drop policy if exists "contracts_select_parties" on public.project_contracts;
create policy "contracts_select_parties" on public.project_contracts for select
  using (
    client_id = auth.uid() or contractor_id = auth.uid() or created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "contracts_write_parties" on public.project_contracts;
create policy "contracts_write_parties" on public.project_contracts for all
  using (
    client_id = auth.uid() or contractor_id = auth.uid() or created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 세금계산서 / 원천징수 명세
create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.project_contracts(id) on delete cascade,
  escrow_id uuid references public.project_escrow(id) on delete set null,
  kind text not null check (kind in ('tax_invoice','withholding_receipt','cash_receipt')),
  supply_amount bigint not null,      -- 공급가액
  vat_amount bigint not null default 0,
  withholding_amount bigint not null default 0, -- 3.3% 원천징수액
  net_amount bigint not null,         -- 실 지급액 = supply + vat - withholding
  issued_at timestamptz,
  issue_number text,                  -- 국세청 승인번호 / 발행번호
  pdf_url text,
  status text not null default 'pending' check (status in ('pending','issued','void','failed')),
  raw_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tax_invoices_contract_idx on public.tax_invoices (contract_id);

alter table public.tax_invoices enable row level security;
drop policy if exists "tax_invoices_select_parties" on public.tax_invoices;
create policy "tax_invoices_select_parties" on public.tax_invoices for select
  using (
    exists (
      select 1 from public.project_contracts c
      where c.id = tax_invoices.contract_id
        and (c.client_id = auth.uid() or c.contractor_id = auth.uid() or c.created_by = auth.uid())
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "tax_invoices_write_admin_or_contractor" on public.tax_invoices;
create policy "tax_invoices_write_admin_or_contractor" on public.tax_invoices for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.project_contracts c
      where c.id = tax_invoices.contract_id and c.contractor_id = auth.uid()
    )
  );

-- ============================================
-- 2. 유료 너트 멤버십
-- ============================================
alter table public.groups
  add column if not exists is_paid boolean not null default false,
  add column if not exists monthly_fee bigint default 0,        -- 월 회비 (원)
  add column if not exists yearly_fee bigint default 0,         -- 연 회비 (원)
  add column if not exists paid_description text,               -- 유료 너트 설명
  add column if not exists max_paid_members int;                -- 정원

create table if not exists public.nut_subscriptions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tier text not null default 'monthly' check (tier in ('monthly','yearly','lifetime','trial')),
  status text not null default 'active' check (status in ('active','cancelled','paused','expired','pending_payment')),
  amount bigint not null,                   -- 결제된 금액 (원)
  started_at timestamptz not null default now(),
  current_period_end timestamptz,           -- 다음 갱신일
  cancelled_at timestamptz,
  escrow_id uuid references public.project_escrow(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists nut_subscriptions_user_idx on public.nut_subscriptions (user_id, status);
create index if not exists nut_subscriptions_group_idx on public.nut_subscriptions (group_id, status);

alter table public.nut_subscriptions enable row level security;
drop policy if exists "nut_subs_select_own_or_host" on public.nut_subscriptions;
create policy "nut_subs_select_own_or_host" on public.nut_subscriptions for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = nut_subscriptions.group_id and g.host_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "nut_subs_insert_self" on public.nut_subscriptions;
create policy "nut_subs_insert_self" on public.nut_subscriptions for insert
  with check (user_id = auth.uid());
drop policy if exists "nut_subs_update_self_or_host" on public.nut_subscriptions;
create policy "nut_subs_update_self_or_host" on public.nut_subscriptions for update
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = nut_subscriptions.group_id and g.host_id = auth.uid())
  );

-- ============================================
-- 3. B2B 기관 발주 포털
-- ============================================
create table if not exists public.b2b_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_number text,                     -- 사업자등록번호
  representative text,
  contact_email text,
  contact_phone text,
  address text,
  verified boolean not null default false,
  verified_at timestamptz,
  tier text not null default 'startup' check (tier in ('startup','sme','enterprise','public','nonprofit')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists b2b_orgs_verified_idx on public.b2b_organizations (verified);

-- B2B 볼트 발주 (기업이 제시하는 RFP/요청)
create table if not exists public.b2b_bolt_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.b2b_organizations(id) on delete cascade not null,
  title text not null,
  description text,
  category text check (category in ('space','culture','platform','vibe')),
  budget_min bigint,                        -- 예산 범위 (원)
  budget_max bigint,
  deadline date,
  status text not null default 'open' check (status in ('open','matching','matched','in_progress','completed','cancelled')),
  -- 매칭 결과
  matched_project_id uuid references public.projects(id) on delete set null,
  -- 공개 범위
  visibility text not null default 'invited' check (visibility in ('public','invited','private')),
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists b2b_requests_status_idx on public.b2b_bolt_requests (status, created_at desc);
create index if not exists b2b_requests_org_idx on public.b2b_bolt_requests (organization_id);

alter table public.b2b_organizations enable row level security;
alter table public.b2b_bolt_requests enable row level security;

drop policy if exists "b2b_orgs_select_all" on public.b2b_organizations;
create policy "b2b_orgs_select_all" on public.b2b_organizations for select using (verified = true or created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "b2b_orgs_insert_auth" on public.b2b_organizations;
create policy "b2b_orgs_insert_auth" on public.b2b_organizations for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
drop policy if exists "b2b_orgs_update_creator_or_admin" on public.b2b_organizations;
create policy "b2b_orgs_update_creator_or_admin" on public.b2b_organizations for update using (created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "b2b_requests_select_visibility" on public.b2b_bolt_requests;
create policy "b2b_requests_select_visibility" on public.b2b_bolt_requests for select
  using (
    visibility = 'public'
    or submitted_by = auth.uid()
    or exists (
      select 1 from public.b2b_organizations o
      where o.id = b2b_bolt_requests.organization_id and o.created_by = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "b2b_requests_insert_org_members" on public.b2b_bolt_requests;
create policy "b2b_requests_insert_org_members" on public.b2b_bolt_requests for insert
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.b2b_organizations o
      where o.id = b2b_bolt_requests.organization_id and o.created_by = auth.uid()
    )
  );

-- ============================================
-- 4. 크리에이터 이코노미 (유료 탭 콘텐츠 / 템플릿 마켓)
-- ============================================
create table if not exists public.tap_products (
  id uuid primary key default gen_random_uuid(),
  wiki_page_id uuid references public.wiki_pages(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  summary text,
  cover_url text,
  product_type text not null default 'template' check (product_type in ('template','report','course','dataset','ebook','other')),
  price bigint not null check (price >= 0),        -- 0 = 무료 (프리뷰)
  currency text not null default 'KRW',
  status text not null default 'draft' check (status in ('draft','published','archived','suspended')),
  preview_md text,                                  -- 무료 미리보기
  full_content_md text,                             -- 구매 후 열람
  attached_files jsonb default '[]',                -- [{url, name, size}]
  tags text[] default '{}',
  -- 통계
  sales_count int not null default 0,
  revenue_total bigint not null default 0,
  -- 수수료
  platform_fee_rate numeric(5,4) not null default 0.10, -- 10%
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tap_products_seller_idx on public.tap_products (seller_id, status);
create index if not exists tap_products_published_idx on public.tap_products (status, created_at desc) where status = 'published';

create table if not exists public.tap_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.tap_products(id) on delete cascade not null,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  amount bigint not null,
  platform_fee bigint not null default 0,
  seller_payout bigint not null,
  escrow_id uuid references public.project_escrow(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','completed','refunded','failed')),
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);
create index if not exists tap_purchases_buyer_idx on public.tap_purchases (buyer_id, status);

alter table public.tap_products enable row level security;
alter table public.tap_purchases enable row level security;

drop policy if exists "tap_products_select_published" on public.tap_products;
create policy "tap_products_select_published" on public.tap_products for select
  using (status = 'published' or seller_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "tap_products_write_seller" on public.tap_products;
create policy "tap_products_write_seller" on public.tap_products for all using (seller_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "tap_purchases_select_own_or_seller" on public.tap_purchases;
create policy "tap_purchases_select_own_or_seller" on public.tap_purchases for select
  using (
    buyer_id = auth.uid()
    or exists (select 1 from public.tap_products p where p.id = tap_purchases.product_id and p.seller_id = auth.uid())
    or exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );
drop policy if exists "tap_purchases_insert_buyer" on public.tap_purchases;
create policy "tap_purchases_insert_buyer" on public.tap_purchases for insert with check (buyer_id = auth.uid());

-- 완료
comment on schema public is
  'Migration 071 — contracts/tax invoices, paid nut subscriptions, B2B portal, creator economy';
