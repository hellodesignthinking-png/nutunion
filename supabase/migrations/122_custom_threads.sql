-- 122_custom_threads.sql
-- Custom Thread Builder — Phase C-1 Prompt 4.
-- Extends `threads` (from migration 115) with builder state + draft flag + generated source.
-- No new tables — custom Threads are stored in `threads` with `created_by` set + `ui_component='__generic__'`.

alter table threads
  add column if not exists builder_mode text
    check (builder_mode in ('no-code','ai-assist','code'))
    default 'no-code';

alter table threads
  add column if not exists builder_state jsonb default '{}'::jsonb;

alter table threads
  add column if not exists is_draft boolean default false;

alter table threads
  add column if not exists generated_component_source text;

create index if not exists idx_threads_drafts
  on threads(created_by, is_draft) where is_draft = true;

create index if not exists idx_threads_creator
  on threads(created_by) where created_by is not null;

-- Permit creators to edit/delete their own custom threads (drafts + non-drafts).
drop policy if exists "threads_creator_write" on threads;
create policy "threads_creator_write" on threads
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "threads_creator_insert" on threads;
create policy "threads_creator_insert" on threads
  for insert with check (created_by = auth.uid());

drop policy if exists "threads_creator_delete" on threads;
create policy "threads_creator_delete" on threads
  for delete using (created_by = auth.uid());

-- Drafts are private to creator (override public_read for is_draft=true rows).
drop policy if exists "threads_public_read" on threads;
create policy "threads_public_read" on threads
  for select using (
    (is_public = true and coalesce(is_draft, false) = false)
    or created_by = auth.uid()
  );
