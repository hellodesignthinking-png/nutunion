-- 너트/볼트 안의 자유 페이지 — 노션 스타일.
-- 멤버가 자유롭게 추가/삭제/계층 변경 가능. wiki(공식 지식) 와 별개로 작업 메모/문서.
-- L3 의 블록 에디터를 위한 hook 도 함께 (page_blocks 는 142b 에서).

create table if not exists space_pages (
  id              uuid primary key default gen_random_uuid(),
  -- 어느 너트 또는 볼트에 속하는지
  owner_type      text not null check (owner_type in ('nut', 'bolt')),
  owner_id        uuid not null,
  -- 트리 — null 이면 root 페이지
  parent_page_id  uuid references space_pages(id) on delete cascade,
  title           text not null default '제목 없음',
  icon            text default '📄',
  -- L1: 단일 마크다운 본문. L3 에서는 page_blocks 로 마이그레이션 + 이 컬럼 deprecate.
  content         text default '',
  position        int not null default 0,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 검색·트리 렌더용 인덱스
create index if not exists space_pages_owner_idx
  on space_pages (owner_type, owner_id, parent_page_id, position, updated_at desc);
create index if not exists space_pages_parent_idx
  on space_pages (parent_page_id);

alter table space_pages enable row level security;

-- ── RLS ────────────────────────────────────────────────────────────
-- 모든 멤버가 read/write — 사용자 답변 "모든 멤버 편집".
-- nut: group_members.user_id = auth.uid() 일 때
-- bolt: project_members.user_id = auth.uid() 일 때

drop policy if exists "space_pages_select" on space_pages;
create policy "space_pages_select" on space_pages
  for select using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_pages.owner_id
        and user_id = auth.uid()
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_pages.owner_id
        and user_id = auth.uid()
    ))
  );

drop policy if exists "space_pages_insert" on space_pages;
create policy "space_pages_insert" on space_pages
  for insert with check (
    created_by = auth.uid() and (
      (owner_type = 'nut' and exists (
        select 1 from group_members
        where group_id = space_pages.owner_id
          and user_id = auth.uid()
          and status = 'active'
      ))
      or
      (owner_type = 'bolt' and exists (
        select 1 from project_members
        where project_id = space_pages.owner_id
          and user_id = auth.uid()
      ))
    )
  );

drop policy if exists "space_pages_update" on space_pages;
create policy "space_pages_update" on space_pages
  for update using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_pages.owner_id
        and user_id = auth.uid()
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_pages.owner_id
        and user_id = auth.uid()
    ))
  ) with check (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_pages.owner_id
        and user_id = auth.uid()
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_pages.owner_id
        and user_id = auth.uid()
    ))
  );

drop policy if exists "space_pages_delete" on space_pages;
create policy "space_pages_delete" on space_pages
  for delete using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_pages.owner_id
        and user_id = auth.uid()
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_pages.owner_id
        and user_id = auth.uid()
    ))
  );

-- updated_at 자동 갱신
create or replace function space_pages_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists space_pages_touch on space_pages;
create trigger space_pages_touch
  before update on space_pages
  for each row execute function space_pages_touch_updated_at();
