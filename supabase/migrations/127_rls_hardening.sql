-- 127_rls_hardening.sql
-- RLS audit (2026-04). Tighten over-permissive policies, fill missing
-- WITH CHECK / DELETE policies, scope public reads.
-- Each change is additive (drop+recreate) and idempotent.

-- ─────────────────────────────────────────────────────────────────────
-- 1) task_issue_links — read was `using (true)` (anyone authenticated
-- could enumerate every GitHub/Linear link in the system, including
-- private external_url + external_title).
-- Tighten to: only the linker, OR a member of the parent task.
-- For project_tasks → must be a project_member.
-- For personal_tasks → must own the task.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "task_issue_links_read" on task_issue_links;
create policy "task_issue_links_read" on task_issue_links
  for select using (
    linked_by = auth.uid()
    or (
      task_table = 'project_tasks'
      and exists(
        select 1 from project_tasks pt
        join project_members pm on pm.project_id = pt.project_id
        where pt.id = task_issue_links.task_id
          and pm.user_id = auth.uid()
      )
    )
    or (
      task_table = 'personal_tasks'
      and exists(
        select 1 from personal_tasks p
        where p.id = task_issue_links.task_id
          and p.user_id = auth.uid()
      )
    )
  );

-- INSERT had `with check (linked_by = auth.uid())` ✓ but no UPDATE policy.
-- Sync routines call .update() to refresh external_status/last_synced_at.
-- Without a policy these updates silently fail (or require service role).
-- Add an UPDATE policy scoped to the linker.
drop policy if exists "task_issue_links_update" on task_issue_links;
create policy "task_issue_links_update" on task_issue_links
  for update using (linked_by = auth.uid())
  with check (linked_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 2) yjs_documents — `for all` policy used `updated_by = auth.uid()`
-- but without doc_id ownership in WITH CHECK any user could insert
-- yjs_documents rows for someone else's note (PK conflict would block
-- overwrite, but a fresh row could shadow an as-yet-uninitialised doc).
-- Re-create the upsert policy with both user check AND doc-ownership.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "yjs_documents_owner_upsert" on yjs_documents;
drop policy if exists "yjs_documents_owner_insert" on yjs_documents;
drop policy if exists "yjs_documents_owner_update" on yjs_documents;
drop policy if exists "yjs_documents_owner_delete" on yjs_documents;
create policy "yjs_documents_owner_insert" on yjs_documents
  for insert with check (
    updated_by = auth.uid()
    and case
      when doc_id like 'personal_notes:%' then exists(
        select 1 from personal_notes pn
        where pn.id::text = split_part(doc_id, ':', 2)
          and pn.user_id = auth.uid()
      )
      else false
    end
  );

create policy "yjs_documents_owner_update" on yjs_documents
  for update
  using (
    case
      when doc_id like 'personal_notes:%' then exists(
        select 1 from personal_notes pn
        where pn.id::text = split_part(doc_id, ':', 2)
          and pn.user_id = auth.uid()
      )
      else false
    end
  )
  with check (
    updated_by = auth.uid()
    and case
      when doc_id like 'personal_notes:%' then exists(
        select 1 from personal_notes pn
        where pn.id::text = split_part(doc_id, ':', 2)
          and pn.user_id = auth.uid()
      )
      else false
    end
  );

create policy "yjs_documents_owner_delete" on yjs_documents
  for delete using (
    case
      when doc_id like 'personal_notes:%' then exists(
        select 1 from personal_notes pn
        where pn.id::text = split_part(doc_id, ':', 2)
          and pn.user_id = auth.uid()
      )
      else false
    end
  );

-- ─────────────────────────────────────────────────────────────────────
-- 3) automation_logs — only had SELECT policy. INSERT/UPDATE happen
-- via service-role from cron + decide route, which bypass RLS, so this
-- is OK. Add an explicit comment to make the intent visible.
-- (No policy change.)
-- ─────────────────────────────────────────────────────────────────────
comment on table automation_logs is
  'Writes are service-role only (cron + automation engine). Users get SELECT via owner_id of the parent rule.';

-- ─────────────────────────────────────────────────────────────────────
-- 4) file_comments — read was `using (true)`. Comments themselves
-- can carry sensitive PDF feedback. Scope read to the same audience
-- that can see the parent file_attachment / project_resource.
-- file_attachments / project_resources have their own RLS, so we
-- piggyback on visibility there.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "file_comments_read" on file_comments;
create policy "file_comments_read" on file_comments
  for select using (
    user_id = auth.uid()
    or (
      file_table = 'file_attachments'
      and exists(select 1 from file_attachments fa where fa.id = file_comments.file_id)
    )
    or (
      file_table = 'project_resources'
      and exists(select 1 from project_resources pr where pr.id = file_comments.file_id)
    )
  );
-- Note: the inner EXISTS is gated by RLS on the parent table — if the
-- caller can't see the parent file row, the EXISTS returns 0 and the
-- comment is hidden. No explicit join condition needed.

-- Add missing UPDATE policy (edit own comment).
drop policy if exists "file_comments_update" on file_comments;
create policy "file_comments_update" on file_comments
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 5) thread_reviews — read public is intentional (App-Store style),
-- but UPDATE/DELETE policies lacked WITH CHECK on UPDATE — could let
-- a user "transfer" a review to another user_id. Tighten.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "thread_reviews_update" on thread_reviews;
create policy "thread_reviews_update" on thread_reviews
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 6) thread_installations — UPDATE policy had no WITH CHECK; a member
-- of the same target could repoint installed_by to themselves. Tighten.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "thread_inst_update" on thread_installations;
create policy "thread_inst_update" on thread_installations
  for update using (installed_by = auth.uid())
  with check (installed_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 7) thread_data — UPDATE policy had no WITH CHECK; created_by could
-- be rewritten to another user. Tighten.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "thread_data_update" on thread_data;
create policy "thread_data_update" on thread_data
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 8) member_resource_access — only SELECT policy (self) defined.
-- Writes happen exclusively from automation engine via service role,
-- which bypasses RLS. Document this and add a deny-by-default
-- INSERT/UPDATE/DELETE comment (no explicit policies needed; without
-- a policy any non-service-role write is blocked).
-- ─────────────────────────────────────────────────────────────────────
comment on table member_resource_access is
  'Audit table. Writes are service-role only (automation engine). Users SELECT own rows via member_resource_access_self.';

-- end 127_rls_hardening.sql
