-- ============================================
-- Migration 090: 채팅 리액션 + 자료 업로드 알림 + 방 자동 생성 트리거
-- ============================================
-- SAFE 버전: 변수명 _room_id (v_ 접두어 충돌 방지), $func$ 태그, 독립 블록.

-- 0. 선행 조건
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='chat_rooms') then
    raise exception 'chat_rooms 테이블이 없습니다. Migration 088 을 먼저 실행하세요.';
  end if;
end $$;

-- 1. chat_reactions
create table if not exists public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index if not exists idx_chat_reactions_msg on public.chat_reactions(message_id);

alter table public.chat_reactions enable row level security;

drop policy if exists chat_reactions_read on public.chat_reactions;
create policy chat_reactions_read on public.chat_reactions for select
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_members mem on mem.room_id = m.room_id
      where m.id = chat_reactions.message_id and mem.user_id = auth.uid()
    )
  );

drop policy if exists chat_reactions_write on public.chat_reactions;
create policy chat_reactions_write on public.chat_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='chat_reactions'
  ) then
    alter publication supabase_realtime add table public.chat_reactions;
  end if;
end $$;

-- 2. project_resources INSERT → 볼트 채팅방 시스템 메시지
create or replace function trg_project_resource_chat_notice()
returns trigger
language plpgsql
security definer
as $func$
declare
  _room_id uuid;
  _nick    text;
begin
  select r.id into _room_id from public.chat_rooms r where r.project_id = new.project_id;
  if _room_id is null then return new; end if;

  select p.nickname into _nick from public.profiles p where p.id = new.uploaded_by;

  insert into public.chat_messages (room_id, sender_id, content, is_system, auto_indexed_as, linked_resource_id)
  values (
    _room_id,
    coalesce(new.uploaded_by, (select created_by from public.projects where id = new.project_id)),
    coalesce(_nick, '누군가') || '님이 자료실에 "' || coalesce(new.name, '자료') || '" 을(를) 올렸어요 📎',
    true,
    'file_attachment',
    new.id
  );
  return new;
end;
$func$;

drop trigger if exists project_resources_chat_notice on public.project_resources;
create trigger project_resources_chat_notice
  after insert on public.project_resources
  for each row execute function trg_project_resource_chat_notice();

-- 3. file_attachments INSERT → 너트/볼트 채팅방 시스템 메시지
create or replace function trg_file_attachment_chat_notice()
returns trigger
language plpgsql
security definer
as $func$
declare
  _room_id uuid;
  _nick    text;
begin
  if new.target_type = 'group' then
    select r.id into _room_id from public.chat_rooms r where r.group_id = new.target_id;
  elsif new.target_type = 'project' then
    select r.id into _room_id from public.chat_rooms r where r.project_id = new.target_id;
  end if;
  if _room_id is null then return new; end if;

  select p.nickname into _nick from public.profiles p where p.id = new.uploaded_by;

  insert into public.chat_messages (room_id, sender_id, content, is_system, auto_indexed_as, linked_resource_id)
  values (
    _room_id,
    new.uploaded_by,
    coalesce(_nick, '누군가') || '님이 자료실에 "' || coalesce(new.file_name, '파일') || '" 을(를) 올렸어요 📎',
    true,
    'file_attachment',
    new.id
  );
  return new;
end;
$func$;

drop trigger if exists file_attachments_chat_notice on public.file_attachments;
create trigger file_attachments_chat_notice
  after insert on public.file_attachments
  for each row execute function trg_file_attachment_chat_notice();

-- 4. bolt_taps 회고 제출 알림
create or replace function trg_bolt_tap_chat_notice()
returns trigger
language plpgsql
security definer
as $func$
declare
  _room_id uuid;
  _nick    text;
begin
  if new.is_retrospective_submitted = true and coalesce(old.is_retrospective_submitted, false) = false then
    select r.id into _room_id from public.chat_rooms r where r.project_id = new.project_id;
    if _room_id is null then return new; end if;
    select p.nickname into _nick from public.profiles p where p.id = new.last_edited_by;

    insert into public.chat_messages (room_id, sender_id, content, is_system)
    values (
      _room_id,
      new.last_edited_by,
      coalesce(_nick, '누군가') || '님이 볼트 탭(회고록)을 발행했어요 📚',
      true
    );
  end if;
  return new;
end;
$func$;

drop trigger if exists bolt_taps_chat_notice on public.bolt_taps;
create trigger bolt_taps_chat_notice
  after update on public.bolt_taps
  for each row execute function trg_bolt_tap_chat_notice();

-- 5. 너트/볼트 생성 시 채팅방 자동 생성
create or replace function trg_ensure_chat_on_group_create()
returns trigger
language plpgsql
security definer
as $func$
begin
  perform public.ensure_group_room(new.id);
  return new;
end;
$func$;

drop trigger if exists groups_ensure_chat on public.groups;
create trigger groups_ensure_chat
  after insert on public.groups
  for each row execute function trg_ensure_chat_on_group_create();

create or replace function trg_ensure_chat_on_project_create()
returns trigger
language plpgsql
security definer
as $func$
begin
  perform public.ensure_project_room(new.id);
  return new;
end;
$func$;

drop trigger if exists projects_ensure_chat on public.projects;
create trigger projects_ensure_chat
  after insert on public.projects
  for each row execute function trg_ensure_chat_on_project_create();

-- 6. 캐시 갱신
notify pgrst, 'reload schema';
