-- 119_chat_threads.sql
-- Slack-style threaded replies + @mentions for chat_messages
-- Safe to re-run.

alter table chat_messages add column if not exists parent_message_id uuid references chat_messages(id) on delete cascade;
alter table chat_messages add column if not exists thread_reply_count int default 0;
alter table chat_messages add column if not exists thread_last_reply_at timestamptz;
alter table chat_messages add column if not exists mentions uuid[] default '{}';

create index if not exists idx_chat_messages_parent
  on chat_messages(parent_message_id, created_at)
  where parent_message_id is not null;

create index if not exists idx_chat_messages_mentions
  on chat_messages using gin(mentions);

create table if not exists chat_thread_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  parent_message_id uuid not null references chat_messages(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (user_id, parent_message_id)
);

alter table chat_thread_reads enable row level security;

drop policy if exists "chat_thread_reads_self" on chat_thread_reads;
create policy "chat_thread_reads_self" on chat_thread_reads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
