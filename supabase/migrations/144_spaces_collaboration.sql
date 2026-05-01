-- L4 협업 기능 — 블록 댓글 / 즐겨찾기 / 스니펫
-- (백링크는 space_page_blocks.content 의 mention 패턴 스캔으로 처리, 별도 테이블 없음)
-- (실시간 커서는 Supabase Realtime broadcast — 별도 테이블 없음)
-- (타임라인 뷰는 space_pages.updated_at 사용 — 별도 테이블 없음)

-- ── 블록 댓글 ─────────────────────────────────────────────────────
create table if not exists space_block_comments (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references space_page_blocks(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text not null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists space_block_comments_block_idx
  on space_block_comments (block_id, created_at);

alter table space_block_comments enable row level security;

-- 부모 블록의 RLS 따라감 — 블록 read 가능하면 댓글도 read
drop policy if exists "block_comments_select" on space_block_comments;
create policy "block_comments_select" on space_block_comments
  for select using (
    exists (select 1 from space_page_blocks where id = space_block_comments.block_id)
  );

drop policy if exists "block_comments_insert" on space_block_comments;
create policy "block_comments_insert" on space_block_comments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from space_page_blocks where id = space_block_comments.block_id)
  );

-- 댓글 본인만 update/delete
drop policy if exists "block_comments_update_own" on space_block_comments;
create policy "block_comments_update_own" on space_block_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "block_comments_delete_own" on space_block_comments;
create policy "block_comments_delete_own" on space_block_comments
  for delete using (author_id = auth.uid());

drop trigger if exists block_comments_touch on space_block_comments;
create or replace function block_comments_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger block_comments_touch
  before update on space_block_comments
  for each row execute function block_comments_touch_updated_at();

-- ── 페이지 즐겨찾기 (profiles JSONB) ────────────────────────────
alter table profiles
  add column if not exists favorite_pages jsonb not null default '[]'::jsonb;
comment on column profiles.favorite_pages is
  'Array of space_pages.id — 사이드바 상단에 별표로 표시';

-- ── 스니펫 ────────────────────────────────────────────────────────
-- 블록 묶음을 저장 → 다른 페이지에서 빠르게 삽입.
-- blocks_json: [{ type, content, data }, ...] (position 은 삽입 시 재계산)
create table if not exists space_snippets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null default '제목 없는 스니펫',
  icon        text default '🧩',
  blocks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists space_snippets_user_idx
  on space_snippets (user_id, created_at desc);

alter table space_snippets enable row level security;

drop policy if exists "snippets_own_all" on space_snippets;
create policy "snippets_own_all" on space_snippets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists snippets_touch on space_snippets;
create or replace function snippets_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger snippets_touch
  before update on space_snippets
  for each row execute function snippets_touch_updated_at();
