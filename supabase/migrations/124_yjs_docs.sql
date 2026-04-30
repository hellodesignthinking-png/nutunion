-- 124_yjs_docs.sql
-- CRDT (Yjs) realtime collaborative editing — minimum viable schema.
-- Scope: personal_notes only in this iteration. Doc id format: "personal_notes:{note_id}"
-- Future doc namespaces (e.g. "thread:{id}") can extend the policy with new branches.

-- ─────────────────────────────────────────────────────────────────────
-- Y.Doc snapshots (binary state)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists yjs_documents (
  doc_id text primary key,                     -- e.g. "personal_notes:{uuid}"
  state bytea not null,                        -- Y.encodeStateAsUpdate(doc)
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id) on delete set null
);

alter table yjs_documents enable row level security;

drop policy if exists "yjs_documents_owner_select" on yjs_documents;
create policy "yjs_documents_owner_select"
  on yjs_documents for select
  using (
    case
      when doc_id like 'personal_notes:%' then exists(
        select 1 from personal_notes pn
        where pn.id::text = split_part(doc_id, ':', 2)
          and pn.user_id = auth.uid()
      )
      else false
    end
  );

drop policy if exists "yjs_documents_owner_upsert" on yjs_documents;
create policy "yjs_documents_owner_upsert"
  on yjs_documents for all
  using (updated_by = auth.uid())
  with check (updated_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Per-doc presence (cursors / focus)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists yjs_presence (
  doc_id text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  cursor_data jsonb,
  last_seen timestamptz default now(),
  primary key (doc_id, user_id)
);

alter table yjs_presence enable row level security;

drop policy if exists "yjs_presence_self_write" on yjs_presence;
create policy "yjs_presence_self_write"
  on yjs_presence for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "yjs_presence_doc_read" on yjs_presence;
create policy "yjs_presence_doc_read"
  on yjs_presence for select
  using (true);  -- presence is public per doc (UI can decide what to show)

create index if not exists yjs_presence_doc_idx on yjs_presence(doc_id);
create index if not exists yjs_presence_last_seen_idx on yjs_presence(last_seen);
