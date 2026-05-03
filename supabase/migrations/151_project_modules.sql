-- L12: 볼트 자유 모듈 — 노션처럼 볼트 안에서 사용자가 모듈을 자유롭게 추가
--
-- 컨셉
--   bolt 페이지의 "내 모듈" 탭에 사용자가 카드를 자유 추가.
--   kind 별로 렌더링 다름 (link, note, embed, kanban_mini, countdown, gdrive, notion 등).
--   config jsonb 에 kind 별 설정 보관 — 스키마 확장 시 마이그레이션 없이 새 kind 추가 가능.

create table if not exists project_modules (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  kind          text not null check (kind in (
    'link',         -- URL + 미리보기 (OG 메타) — Notion/Drive/YouTube/Twitter 등 어떤 URL 도
    'note',         -- 짧은 메모 / 마크다운
    'embed',        -- iframe (allowfullscreen) — YouTube embed, Figma, Drive 미리보기
    'kanban_mini',  -- 3컬럼 to-do 보드
    'countdown',    -- D-Day 카운트다운
    'social',       -- Twitter/Threads/Instagram URL — 카드 형태 (link 의 특수형이지만 UX 분리)
    'gdrive',       -- Google Drive 파일/폴더 — link 의 특수형 (아이콘+이름)
    'notion'        -- Notion 페이지 — link 의 특수형
  )),
  title         text,
  config        jsonb not null default '{}'::jsonb,
  -- column 폭 (1=1/3, 2=2/3, 3=full) — 노션 column 감각
  width         int  not null default 1 check (width between 1 and 3),
  sort_order    int  not null default 0,
  is_visible    boolean not null default true,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists project_modules_project_idx
  on project_modules (project_id, sort_order);

alter table project_modules enable row level security;

-- 프로젝트 멤버만 읽고 쓸 수 있음 (대시보드 모듈은 팀 자산).
drop policy if exists "project_modules_select" on project_modules;
create policy "project_modules_select" on project_modules
  for select using (
    exists (select 1 from project_members
            where project_members.project_id = project_modules.project_id
              and project_members.user_id = auth.uid())
    or
    exists (select 1 from projects p
            where p.id = project_modules.project_id
              and p.created_by = auth.uid())
  );

drop policy if exists "project_modules_write" on project_modules;
create policy "project_modules_write" on project_modules
  for all using (
    exists (select 1 from project_members
            where project_members.project_id = project_modules.project_id
              and project_members.user_id = auth.uid()
              and project_members.role in ('lead','pm','member'))
    or
    exists (select 1 from projects p
            where p.id = project_modules.project_id
              and p.created_by = auth.uid())
  ) with check (
    exists (select 1 from project_members
            where project_members.project_id = project_modules.project_id
              and project_members.user_id = auth.uid()
              and project_members.role in ('lead','pm','member'))
    or
    exists (select 1 from projects p
            where p.id = project_modules.project_id
              and p.created_by = auth.uid())
  );

-- updated_at 자동 갱신
create or replace function project_modules_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists project_modules_touch_trg on project_modules;
create trigger project_modules_touch_trg
  before update on project_modules
  for each row execute function project_modules_touch_updated_at();

-- ── URL 미리보기 캐시 (외부 서비스 호출 비용 절감) ────────────────
create table if not exists embed_metadata_cache (
  url           text primary key,
  title         text,
  description   text,
  image_url     text,
  site_name     text,
  provider      text,         -- 'youtube' | 'twitter' | 'notion' | 'gdrive' | 'figma' | 'github' | 'slack' | 'generic'
  embed_html    text,         -- oEmbed iframe (있을 경우)
  fetched_at    timestamptz not null default now()
);

create index if not exists embed_cache_provider_idx
  on embed_metadata_cache (provider, fetched_at desc);

-- 비공개 — 누구나 캐시는 읽을 수 있게 (URL 자체가 검열 대상이 아님), insert/update 는 service role 만.
alter table embed_metadata_cache enable row level security;

drop policy if exists "embed_cache_select" on embed_metadata_cache;
create policy "embed_cache_select" on embed_metadata_cache
  for select using (auth.role() = 'authenticated');
