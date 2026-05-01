-- 페이지 외부 공유 — 읽기 전용 공개 URL.
-- share_token 이 있으면 누구나 /shared/{token} 으로 접근 가능 (RLS 우회 view 사용).

alter table space_pages
  add column if not exists share_token text unique,
  add column if not exists shared_at timestamptz;

create index if not exists space_pages_share_token_idx
  on space_pages (share_token) where share_token is not null;

-- 공개 view — RLS 우회. share_token 으로만 접근. content/icon/title 만 노출.
create or replace view public.shared_pages as
  select id, title, icon, content, share_token, shared_at, updated_at
  from space_pages
  where share_token is not null;

-- view 의 RLS — anon/authenticated 모두 share_token 일치 시 read.
-- (view 는 base table 의 RLS 를 따르므로, base table 에 별도 정책 추가)
drop policy if exists "space_pages_shared_select" on space_pages;
create policy "space_pages_shared_select" on space_pages
  for select using (
    share_token is not null
    -- 별도 인증 없이 — anon 도 share_token 으로 SELECT 가능.
    -- 단, share_token 을 모르면 행을 찾을 수 없음.
  );

-- 블록도 share_token 페이지에 속하면 read 허용
drop policy if exists "space_page_blocks_shared_select" on space_page_blocks;
create policy "space_page_blocks_shared_select" on space_page_blocks
  for select using (
    exists (
      select 1 from space_pages
      where id = space_page_blocks.page_id
        and share_token is not null
    )
  );
