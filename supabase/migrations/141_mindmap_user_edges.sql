-- 사용자가 마인드맵 위에서 직접 그어 만든 사적 엣지 (Miro 자유 연결).
-- 너트/볼트/일정/이슈/탭/와셔/파일 어떤 노드 ID 쌍이든 연결 가능.
-- 본인만 보이고 본인만 편집 — 도메인 데이터에 영향 없음.

create table if not exists mindmap_user_edges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_id   text not null,
  target_id   text not null,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists mindmap_user_edges_user_idx
  on mindmap_user_edges (user_id, created_at desc);

-- 자기-루프 방지
alter table mindmap_user_edges
  add constraint mindmap_user_edges_no_self_loop
  check (source_id <> target_id);

-- 같은 (source, target) 쌍 중복 방지
create unique index if not exists mindmap_user_edges_unique_pair
  on mindmap_user_edges (user_id, source_id, target_id);

alter table mindmap_user_edges enable row level security;

drop policy if exists "user_edges_own_select" on mindmap_user_edges;
create policy "user_edges_own_select" on mindmap_user_edges
  for select using (auth.uid() = user_id);

drop policy if exists "user_edges_own_insert" on mindmap_user_edges;
create policy "user_edges_own_insert" on mindmap_user_edges
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_edges_own_update" on mindmap_user_edges;
create policy "user_edges_own_update" on mindmap_user_edges
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_edges_own_delete" on mindmap_user_edges;
create policy "user_edges_own_delete" on mindmap_user_edges
  for delete using (auth.uid() = user_id);
