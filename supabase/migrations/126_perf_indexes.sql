-- 126_perf_indexes.sql
-- Performance index audit (2026-04). Additive-only, idempotent.
-- Each index targets a real query pattern found in app/api/** or lib/**.
-- Indexes already present (verified in earlier migrations) are NOT re-created here.

-- ─────────────────────────────────────────────────────────────────────
-- chat_thread_reads
-- Query: upsert by (user_id, parent_message_id) — covered by PK.
-- Lookup of "all reads for a parent_message_id" (for unread fan-out)
-- benefits from a secondary index on parent_message_id.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_chat_thread_reads_parent
  on chat_thread_reads(parent_message_id);

-- ─────────────────────────────────────────────────────────────────────
-- chat_messages: thread fetch ordering
-- app/api/chat/messages/[id]/thread/route.ts orders replies by created_at asc.
-- Existing idx_chat_messages_parent (parent_message_id, created_at) covers this.
-- No new index needed. (documented for completeness)
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- chat_messages.sender_id (RLS / "messages by user" lookups)
-- RLS policies that filter sender_id = auth.uid() and "user activity"
-- pages benefit from a sender index. The 005 migration added
-- idx_chat_sender on chat_messages(sender_id) — verified, skip.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- notifications: cron digest query
-- app/api/cron/notifications-digest filters
--   user_id = ? AND is_read = false AND created_at >= ?
-- order by created_at desc. The partial index
-- idx_notifications_user_unread (user_id, is_read) WHERE is_read=false
-- already exists (mig 039); add created_at to that ordering for
-- index-only scan on digest.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_notifications_user_unread_created
  on notifications(user_id, created_at desc)
  where is_read = false;

-- ─────────────────────────────────────────────────────────────────────
-- task_issue_links — reverse lookup by external_id
-- lib/integrations/* sync routines look up by (provider, external_id)
-- to update last_synced_at / external_status. Without this index every
-- webhook poll does a full scan.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_task_issue_links_external
  on task_issue_links(provider, external_id);

create index if not exists idx_task_issue_links_linked_by
  on task_issue_links(linked_by);

-- ─────────────────────────────────────────────────────────────────────
-- thread_data — created_by lookups
-- Several admin/migration routes filter by created_by; RLS update/delete
-- policies use created_by = auth.uid() so an index speeds those checks.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_thread_data_created_by
  on thread_data(created_by);

-- ─────────────────────────────────────────────────────────────────────
-- thread_installations — "my installs" + RLS membership lookup
-- Existing idx_thread_inst_target covers (target_type, target_id).
-- Add installed_by for owner-edit RLS path.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_thread_inst_installed_by
  on thread_installations(installed_by);

-- ─────────────────────────────────────────────────────────────────────
-- daily_briefings — per-user lookup by date
-- Existing idx_daily_briefings_date is on briefing_date alone; the upsert
-- path in morning-briefing route filters (user_id, briefing_date).
-- A composite avoids a secondary filter scan.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_daily_briefings_user_date
  on daily_briefings(user_id, briefing_date desc);

-- ─────────────────────────────────────────────────────────────────────
-- automation_logs — owner / status digest views
-- Existing idx_automation_logs_rule (rule_id, executed_at desc) is good
-- for per-rule timelines. Add a partial index for failed-runs alerting.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_automation_logs_failed
  on automation_logs(executed_at desc)
  where status = 'failed';

-- ─────────────────────────────────────────────────────────────────────
-- automation_approvals — log_id reverse lookup
-- /api/automations/approvals/[id]/decide updates the log row tied to an
-- approval. log_id is unique-ish but unindexed.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_automation_approvals_log
  on automation_approvals(log_id);

-- ─────────────────────────────────────────────────────────────────────
-- yjs_documents — updated_by RLS
-- Policy gates writes by updated_by = auth.uid(); index helps the
-- planner avoid a seq scan on the RLS subquery for large doc tables.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_yjs_documents_updated_by
  on yjs_documents(updated_by)
  where updated_by is not null;

-- ─────────────────────────────────────────────────────────────────────
-- file_comments — by-user lookups + delete RLS
-- 108 added (file_table, file_id). Add user_id for "my comments" + RLS.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_file_comments_user
  on file_comments(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- threads_code_audit — covered by idx_threads_code_audit_user already.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- person_context_notes — owner timeline
-- /api/people/[id]/notes orders by created_at desc on (person_id, owner_id).
-- mig 101 already adds idx_person_context_owner (owner_id, created_at desc).
-- Add a (person_id, created_at desc) for the per-person timeline path.
-- ─────────────────────────────────────────────────────────────────────
create index if not exists idx_person_context_person_created
  on person_context_notes(person_id, created_at desc);

-- end 126_perf_indexes.sql
