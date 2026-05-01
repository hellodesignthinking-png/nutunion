-- 마인드맵 노드별 사적 메모 (스티키 노트 스타일).
-- 도메인 엔티티(너트/볼트)에 이미 댓글이 있으므로, 여기는 *사용자 개인의* 마인드맵
-- 워크스페이스 위에 붙이는 메모. 다른 사용자는 절대 볼 수 없음.
--
-- node_id 형식: "{kind}-{uuid}" — mindmap-dashboard.tsx 의 node id 와 동일.
--   예) "nut-abc123", "bolt-xyz789", "sched-...", "issue-...", "topic-...", "washer-..."

create table if not exists mindmap_node_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  node_id     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists mindmap_node_notes_user_node_idx
  on mindmap_node_notes (user_id, node_id, created_at desc);

alter table mindmap_node_notes enable row level security;

-- 본인 메모만 read/write — 노드 id 는 도메인 엔티티 id 를 포함하지만 메모 자체는 사적.
drop policy if exists "node_notes_own_select" on mindmap_node_notes;
create policy "node_notes_own_select" on mindmap_node_notes
  for select using (auth.uid() = user_id);

drop policy if exists "node_notes_own_insert" on mindmap_node_notes;
create policy "node_notes_own_insert" on mindmap_node_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "node_notes_own_update" on mindmap_node_notes;
create policy "node_notes_own_update" on mindmap_node_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "node_notes_own_delete" on mindmap_node_notes;
create policy "node_notes_own_delete" on mindmap_node_notes
  for delete using (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function mindmap_node_notes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mindmap_node_notes_touch on mindmap_node_notes;
create trigger mindmap_node_notes_touch
  before update on mindmap_node_notes
  for each row execute function mindmap_node_notes_touch_updated_at();
