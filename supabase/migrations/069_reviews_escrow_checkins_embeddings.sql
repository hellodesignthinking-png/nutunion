-- 069: 전략 문서 남은 항목 6개 통합 스키마
-- P0-② 볼트 역할 needed_roles
-- P1-⑥ 에스크로 + 수수료
-- P1-⑧ 다축 태그형 리뷰
-- P1-⑨ 탭 자동 아카이브
-- P2-⑫ AI 매칭 (pgvector)
-- P2-⑮ 이벤트 QR 체크인

-- ============================================
-- 1. projects.needed_role_slots — 구조화된 역할 모집
-- ============================================
alter table public.projects
  add column if not exists role_slots jsonb default '[]';
-- 예: [{"role_type":"pm","count":1,"reward_type":"equity","hours":"full"},
--      {"role_type":"member","count":2,"reward_type":"experience","hours":8}]

comment on column public.projects.role_slots is
  'JSONB array of { role_type, count, reward_type, hours, description? }';

-- ============================================
-- 2. project_reviews — 다축 태그형 쌍방향 평가
-- ============================================
create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  target_user_id uuid references public.profiles(id) on delete cascade not null,
  -- 다축 태그: keep_commitment, communication, leadership, learning, collaboration 등
  tags text[] default '{}'
    check (array_length(tags, 1) is null or array_length(tags, 1) <= 10),
  overall_note text,  -- 선택 한줄평
  -- 별점 대신 "추천 의사"
  would_work_again boolean,
  visibility text not null default 'public' check (visibility in ('public','private','team')),
  created_at timestamptz not null default now(),
  unique (project_id, reviewer_id, target_user_id)
);

create index if not exists project_reviews_target_idx
  on public.project_reviews (target_user_id, created_at desc);
create index if not exists project_reviews_project_idx
  on public.project_reviews (project_id);

alter table public.project_reviews enable row level security;

drop policy if exists "project_reviews_select_public" on public.project_reviews;
create policy "project_reviews_select_public"
  on public.project_reviews for select
  using (
    visibility = 'public'
    or reviewer_id = auth.uid()
    or target_user_id = auth.uid()
    or (visibility = 'team' and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_reviews.project_id and pm.user_id = auth.uid()
    ))
  );

drop policy if exists "project_reviews_insert_members_only" on public.project_reviews;
create policy "project_reviews_insert_members_only"
  on public.project_reviews for insert
  with check (
    reviewer_id = auth.uid()
    and reviewer_id <> target_user_id
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_reviews.project_id
        and pm.user_id = auth.uid()
    )
  );

drop policy if exists "project_reviews_update_own" on public.project_reviews;
create policy "project_reviews_update_own"
  on public.project_reviews for update using (reviewer_id = auth.uid());
drop policy if exists "project_reviews_delete_own" on public.project_reviews;
create policy "project_reviews_delete_own"
  on public.project_reviews for delete using (reviewer_id = auth.uid());

-- ============================================
-- 3. project_escrow — 에스크로 홀드/릴리즈 원장
-- ============================================
create table if not exists public.project_escrow (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  amount bigint not null check (amount > 0),  -- 원 단위 정수
  currency text not null default 'KRW',
  status text not null default 'pending'
    check (status in ('pending','held','released','refunded','cancelled','disputed')),
  fee_amount bigint not null default 0,        -- 수수료 (원)
  fee_rate numeric(5,4),                        -- 0.0500 = 5%
  provider text check (provider in ('toss','portone','manual','other') or provider is null),
  provider_txn_id text,
  held_at timestamptz,
  released_at timestamptz,
  released_to uuid references public.profiles(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_escrow_project_idx
  on public.project_escrow (project_id, status);

alter table public.project_escrow enable row level security;

drop policy if exists "project_escrow_select_members_or_admin" on public.project_escrow;
create policy "project_escrow_select_members_or_admin"
  on public.project_escrow for select
  using (
    exists (select 1 from public.project_members pm
      where pm.project_id = project_escrow.project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "project_escrow_write_lead_or_admin" on public.project_escrow;
create policy "project_escrow_write_lead_or_admin"
  on public.project_escrow for all
  using (
    exists (select 1 from public.project_members pm
      where pm.project_id = project_escrow.project_id
        and pm.user_id = auth.uid() and pm.role in ('lead','pm'))
    or exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- 4. event_checkins — QR 출석
-- ============================================
alter table public.events
  add column if not exists checkin_token text unique,
  add column if not exists checkin_enabled boolean not null default false;

create table if not exists public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  method text not null default 'qr' check (method in ('qr','manual','geofence')),
  checked_in_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_checkins_event_idx
  on public.event_checkins (event_id, checked_in_at);
create index if not exists event_checkins_user_idx
  on public.event_checkins (user_id, checked_in_at desc);

alter table public.event_checkins enable row level security;

drop policy if exists "event_checkins_select_event_members" on public.event_checkins;
create policy "event_checkins_select_event_members"
  on public.event_checkins for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_checkins.event_id
        and (e.created_by = auth.uid()
          or exists (select 1 from public.groups g where g.id = e.group_id and g.host_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

drop policy if exists "event_checkins_insert_self" on public.event_checkins;
create policy "event_checkins_insert_self"
  on public.event_checkins for insert
  with check (user_id = auth.uid());

-- ============================================
-- 5. 탭 자동 아카이브 — wiki_pages 에 볼트 마감 훅
-- ============================================
-- closure_summary 가 있으면 wiki_pages 에 자동 복사 (트리거)
-- wiki_pages 는 존재한다고 가정
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='wiki_pages') then
    -- slug 컬럼이 없으면 추가 (탭 아카이브 고유 식별자 용)
    begin
      alter table public.wiki_pages add column if not exists slug text unique;
    exception when others then
      raise notice 'wiki_pages slug column skipped: %', sqlerrm;
    end;

    -- 트리거 함수
    create or replace function public.promote_closed_project_to_wiki()
    returns trigger language plpgsql security definer as $f$
    declare
      v_exists boolean;
      v_slug text;
    begin
      if new.status = 'completed' and new.closure_summary is not null
         and (old is null or old.status <> 'completed' or old.closure_summary is null) then
        v_slug := 'bolt-' || new.id::text;
        begin
          select exists (select 1 from public.wiki_pages where slug = v_slug) into v_exists;
          if not v_exists then
            insert into public.wiki_pages (slug, title, content, created_by, created_at, updated_at)
            values (
              v_slug,
              '[Tap] ' || new.title,
              coalesce(new.closure_summary, '') || E'\n\n---\n_자동 승격: 볼트 마감 시 탭 아카이브에 기록됨_',
              new.closed_by,
              now(),
              now()
            );
          end if;
        exception when others then
          raise notice 'wiki auto-archive insert failed (non-fatal): %', sqlerrm;
        end;
      end if;
      return new;
    end;
    $f$;

    drop trigger if exists projects_close_to_wiki on public.projects;
    create trigger projects_close_to_wiki
      after update on public.projects
      for each row
      execute function public.promote_closed_project_to_wiki();
  end if;
exception when others then
  -- wiki_pages 스키마 다르거나 컬럼 불일치 시 무시 (수동 API 로 대체)
  raise notice 'wiki auto-archive trigger skipped: %', sqlerrm;
end $$;

-- ============================================
-- 6. pgvector 준비 — AI 매칭 (extension optional)
-- ============================================
create extension if not exists vector;

-- 프로필 임베딩 (스킬 + bio + specialty 텍스트 기반)
create table if not exists public.profile_embeddings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  embedding vector(1536),  -- OpenAI text-embedding-3-small 기본 차원
  source_hash text,         -- 입력 텍스트 해시 — 변경 감지
  model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now()
);

create table if not exists public.project_embeddings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  embedding vector(1536),
  source_hash text,
  model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now()
);

-- HNSW 인덱스 (cosine distance) — 수십만 row 까지 실시간
create index if not exists profile_embeddings_idx
  on public.profile_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists project_embeddings_idx
  on public.project_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.profile_embeddings enable row level security;
alter table public.project_embeddings enable row level security;

drop policy if exists "profile_embeddings_select_all" on public.profile_embeddings;
create policy "profile_embeddings_select_all"
  on public.profile_embeddings for select using (true);
drop policy if exists "project_embeddings_select_all" on public.project_embeddings;
create policy "project_embeddings_select_all"
  on public.project_embeddings for select using (true);

-- service_role (API) 만 insert/update
drop policy if exists "profile_embeddings_write_service" on public.profile_embeddings;
create policy "profile_embeddings_write_service"
  on public.profile_embeddings for all
  using (auth.role() = 'service_role');
drop policy if exists "project_embeddings_write_service" on public.project_embeddings;
create policy "project_embeddings_write_service"
  on public.project_embeddings for all
  using (auth.role() = 'service_role');

-- ============================================
-- 7. updated_at 트리거 (project_escrow)
-- ============================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists project_escrow_touch on public.project_escrow;
create trigger project_escrow_touch
  before update on public.project_escrow
  for each row execute function public.touch_updated_at();

-- 완료
comment on schema public is
  'Migration 069 — reviews, escrow, checkins, wiki auto-archive, pgvector embeddings, role slots';
