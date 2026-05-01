-- L3 블록 에디터 — 노션식 슬래시 블록.
-- 한 페이지 = 여러 블록의 순서있는 리스트. 각 블록은 type 에 따라 다른 렌더.
--
-- 블록 type:
--   text      — 일반 단락
--   h1, h2, h3 — 제목
--   bullet    — 불릿 리스트 항목
--   numbered  — 번호 리스트 항목
--   todo      — 체크박스 ([] / [x])
--   code      — 코드 블록 (data.lang 으로 언어)
--   divider   — 가로선
--   quote     — 인용
--   callout   — 박스 강조 (data.icon, data.color)
--
-- L1 의 space_pages.content (마크다운) 은 page 마이그레이션 시 자동으로
-- text 블록 한 개로 변환 (별도 스크립트). 신규 페이지는 처음부터 블록.

create table if not exists space_page_blocks (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references space_pages(id) on delete cascade,
  type        text not null check (type in (
    'text','h1','h2','h3','bullet','numbered','todo','code','divider','quote','callout'
  )),
  content     text default '',
  -- 블록별 추가 데이터 — todo: { checked }, code: { lang }, callout: { icon, color }, etc.
  data        jsonb not null default '{}'::jsonb,
  position    int not null default 0,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists space_page_blocks_page_idx
  on space_page_blocks (page_id, position);

alter table space_page_blocks enable row level security;

-- 부모 페이지의 RLS 를 그대로 따라감 — 페이지 read 권한 = 블록 read 권한
drop policy if exists "space_page_blocks_select" on space_page_blocks;
create policy "space_page_blocks_select" on space_page_blocks
  for select using (
    exists (
      select 1 from space_pages
      where space_pages.id = space_page_blocks.page_id
    )
  );

drop policy if exists "space_page_blocks_insert" on space_page_blocks;
create policy "space_page_blocks_insert" on space_page_blocks
  for insert with check (
    exists (
      select 1 from space_pages
      where space_pages.id = space_page_blocks.page_id
    )
  );

drop policy if exists "space_page_blocks_update" on space_page_blocks;
create policy "space_page_blocks_update" on space_page_blocks
  for update using (
    exists (
      select 1 from space_pages
      where space_pages.id = space_page_blocks.page_id
    )
  );

drop policy if exists "space_page_blocks_delete" on space_page_blocks;
create policy "space_page_blocks_delete" on space_page_blocks
  for delete using (
    exists (
      select 1 from space_pages
      where space_pages.id = space_page_blocks.page_id
    )
  );

-- updated_at 자동 갱신
create or replace function space_page_blocks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists space_page_blocks_touch on space_page_blocks;
create trigger space_page_blocks_touch
  before update on space_page_blocks
  for each row execute function space_page_blocks_touch_updated_at();

-- 페이지 업데이트도 함께 — 블록 변경 시 페이지의 updated_at 도 bump
create or replace function space_page_blocks_bump_page()
returns trigger language plpgsql as $$
begin
  update space_pages set updated_at = now() where id = coalesce(new.page_id, old.page_id);
  return null;
end;
$$;

drop trigger if exists space_page_blocks_bump_page_trg on space_page_blocks;
create trigger space_page_blocks_bump_page_trg
  after insert or update or delete on space_page_blocks
  for each row execute function space_page_blocks_bump_page();
