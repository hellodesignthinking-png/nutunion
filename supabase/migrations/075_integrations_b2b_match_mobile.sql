-- 075: 중기 3건 통합 스키마
-- 3-1 B2B AI 매칭 결과 저장
-- 3-5 외부 도구 OAuth 토큰 + 볼트 연결
-- 3-3 모바일 릴리스 트래킹

-- ============================================
-- 1. b2b_match_suggestions — 발주별 추천 너트
-- ============================================
create table if not exists public.b2b_match_suggestions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.b2b_bolt_requests(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade not null,
  rank int not null default 0,
  match_score numeric(5,4) not null default 0,    -- 0.0 ~ 1.0
  reason text,                                     -- 사용자에게 설명 가능한 이유
  method text not null default 'keyword' check (method in ('pgvector','keyword','hybrid','manual')),
  status text not null default 'suggested' check (status in ('suggested','invited','declined','accepted')),
  created_at timestamptz not null default now(),
  unique (request_id, group_id)
);
create index if not exists b2b_matches_request_idx on public.b2b_match_suggestions (request_id, rank);

alter table public.b2b_match_suggestions enable row level security;

drop policy if exists "b2b_matches_select" on public.b2b_match_suggestions;
create policy "b2b_matches_select" on public.b2b_match_suggestions for select
  using (
    exists (
      select 1 from public.b2b_bolt_requests r
      where r.id = b2b_match_suggestions.request_id
        and (r.submitted_by = auth.uid()
          or exists (select 1 from public.b2b_organizations o where o.id = r.organization_id and o.created_by = auth.uid()))
    )
    or exists (
      select 1 from public.groups g
      where g.id = b2b_match_suggestions.group_id and g.host_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "b2b_matches_write_admin_service" on public.b2b_match_suggestions;
create policy "b2b_matches_write_admin_service" on public.b2b_match_suggestions for all
  using (
    auth.role() = 'service_role'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 2. 그룹/볼트 임베딩 (매칭용)
-- ============================================
-- project_embeddings 는 069 에 이미 존재
-- group_embeddings 추가
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    create table if not exists public.group_embeddings (
      group_id uuid primary key references public.groups(id) on delete cascade,
      embedding vector(1536),
      source_hash text,
      model text not null default 'text-embedding-3-small',
      updated_at timestamptz not null default now()
    );
    create index if not exists group_embeddings_idx
      on public.group_embeddings using hnsw (embedding vector_cosine_ops);

    alter table public.group_embeddings enable row level security;
    drop policy if exists "group_embeddings_select_all" on public.group_embeddings;
    create policy "group_embeddings_select_all" on public.group_embeddings for select using (true);
    drop policy if exists "group_embeddings_write_service" on public.group_embeddings;
    create policy "group_embeddings_write_service" on public.group_embeddings for all
      using (auth.role() = 'service_role');

    -- RPC: 텍스트 임베딩 → TOP N 너트
    create or replace function public.match_groups_by_embedding(
      query_embedding vector(1536),
      match_count int default 3
    )
    returns table(group_id uuid, name text, description text, category text, distance float)
    language sql stable as $f$
      select g.id, g.name, g.description, g.category,
        (ge.embedding <=> query_embedding) as distance
      from public.group_embeddings ge
      join public.groups g on g.id = ge.group_id
      where coalesce(g.is_active, true) = true
      order by ge.embedding <=> query_embedding
      limit match_count
    $f$;
    grant execute on function public.match_groups_by_embedding(vector, int) to authenticated, anon, service_role;
  end if;
exception when others then
  raise notice 'group_embeddings setup skipped: %', sqlerrm;
end $$;

-- ============================================
-- 3. external_integrations — Slack/Notion/GitHub 토큰 저장
-- ============================================
create table if not exists public.external_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null check (provider in ('slack','notion','github','discord')),
  external_user_id text,
  external_team_id text,
  external_team_name text,
  access_token text not null,        -- 민감 — service_role 만 읽기
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index if not exists ext_integrations_user_idx on public.external_integrations (user_id, provider);

alter table public.external_integrations enable row level security;
drop policy if exists "ext_int_select_self" on public.external_integrations;
-- access_token 노출 방지 — 애플리케이션 서버에서 service_role 키로만 읽기.
-- 클라이언트에서는 bolt_integrations 만 조회.
create policy "ext_int_select_self" on public.external_integrations for select
  using (user_id = auth.uid() and auth.role() = 'service_role');
drop policy if exists "ext_int_write_self" on public.external_integrations;
create policy "ext_int_write_self" on public.external_integrations for all
  using (user_id = auth.uid());

-- ============================================
-- 4. bolt_integrations — 볼트별 외부 리소스 연결
-- ============================================
create table if not exists public.bolt_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  provider text not null check (provider in ('slack','notion','github','google_drive','google_calendar','discord')),
  resource_type text,                 -- 'channel','database','repo','folder','calendar'
  resource_id text,                   -- 외부 식별자
  resource_name text,                 -- 표시명
  resource_url text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, provider, resource_id)
);
create index if not exists bolt_integrations_project_idx on public.bolt_integrations (project_id);

alter table public.bolt_integrations enable row level security;
drop policy if exists "bolt_int_select_members" on public.bolt_integrations;
create policy "bolt_int_select_members" on public.bolt_integrations for select
  using (
    exists (select 1 from public.project_members pm
      where pm.project_id = bolt_integrations.project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.projects p
      where p.id = bolt_integrations.project_id and p.created_by = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "bolt_int_write_members" on public.bolt_integrations;
create policy "bolt_int_write_members" on public.bolt_integrations for all
  using (
    exists (select 1 from public.project_members pm
      where pm.project_id = bolt_integrations.project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.projects p
      where p.id = bolt_integrations.project_id and p.created_by = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 5. mobile_releases — 모바일 배포 트래킹
-- ============================================
create table if not exists public.mobile_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios','android')),
  channel text not null check (channel in ('internal','preview','production')),
  version text not null,              -- 1.0.0
  build_number int,
  eas_build_id text,
  eas_submit_id text,
  store_url text,                     -- TestFlight / Internal App Sharing
  changelog text,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz not null default now(),
  status text not null default 'built' check (status in ('queued','building','built','submitted','live','failed'))
);
create index if not exists mobile_releases_channel_idx on public.mobile_releases (channel, released_at desc);

alter table public.mobile_releases enable row level security;
drop policy if exists "mobile_releases_select_auth" on public.mobile_releases;
create policy "mobile_releases_select_auth" on public.mobile_releases for select using (auth.uid() is not null);
drop policy if exists "mobile_releases_write_admin" on public.mobile_releases;
create policy "mobile_releases_write_admin" on public.mobile_releases for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

comment on schema public is
  'Migration 075 — b2b AI matches, group embeddings, external OAuth integrations, bolt integrations, mobile releases';
