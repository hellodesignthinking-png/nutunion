-- ============================================
-- Migration 088: 너트유니온 채팅 (카카오톡 스타일)
-- ============================================
-- 설계:
--  - chat_rooms: 방 (DM / 너트 그룹 / 볼트 그룹)
--  - chat_members: 참여자 + last_read_at (읽지 않은 수 계산용)
--  - chat_messages: 메시지 (텍스트 + 선택적 첨부)
--  - Supabase Realtime 을 위한 publication 확장

-- 1. 방
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'nut', 'bolt')),
  name text,              -- DM 은 null 허용, 그룹은 연결된 너트/볼트 이름
  group_id uuid references public.groups(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now(),
  -- 그룹 방은 너트/볼트당 1개 (unique)
  constraint chat_rooms_nut_once unique (group_id),
  constraint chat_rooms_bolt_once unique (project_id)
);
create index if not exists idx_chat_rooms_last on chat_rooms(last_message_at desc);
create index if not exists idx_chat_rooms_group on chat_rooms(group_id);
create index if not exists idx_chat_rooms_project on chat_rooms(project_id);

-- 2. 참여자
create table if not exists public.chat_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz default now(),
  joined_at timestamptz not null default now(),
  -- DM 은 항상 2명, 그룹은 자동 합류
  primary key (room_id, user_id)
);
create index if not exists idx_chat_members_user on chat_members(user_id);

-- 3. 메시지
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text,
  -- 첨부 (S3/Supabase Storage URL)
  attachment_url text,
  attachment_type text check (attachment_type in ('image','file','audio','video') or attachment_type is null),
  attachment_name text,
  attachment_size bigint,
  -- 자동 처리 플래그
  auto_indexed_as text check (auto_indexed_as in ('file_attachment','meeting_note') or auto_indexed_as is null),
  linked_resource_id uuid,   -- file_attachments.id 또는 meeting id
  -- 시스템 메시지 (가입/나감/파일업로드 알림)
  is_system boolean not null default false,
  reply_to uuid references chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (content is not null or attachment_url is not null or is_system)
);
create index if not exists idx_chat_messages_room on chat_messages(room_id, created_at desc);

-- 4. 방 last_message_at 자동 갱신
create or replace function trg_chat_touch_room()
returns trigger language plpgsql as $$
begin
  update public.chat_rooms set last_message_at = now() where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_room on chat_messages;
create trigger chat_messages_touch_room after insert on chat_messages
  for each row execute function trg_chat_touch_room();

-- 5. RLS
alter table chat_rooms    enable row level security;
alter table chat_members  enable row level security;
alter table chat_messages enable row level security;

-- helper — 내가 이 방 멤버인지 (RLS 재귀 방지를 위해 SECURITY DEFINER)
create or replace function is_chat_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1 from public.chat_members
    where room_id = p_room_id and user_id = auth.uid()
  );
$func$;

-- rooms 조회: 내가 멤버인 방만
drop policy if exists chat_rooms_read on chat_rooms;
create policy chat_rooms_read on chat_rooms for select
  using (is_chat_member(id) or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists chat_rooms_insert on chat_rooms;
create policy chat_rooms_insert on chat_rooms for insert
  with check (created_by = auth.uid());

-- members 조회: 본인 레코드만 (재귀 회피).
-- 다른 멤버 조회가 필요하면 get_room_members() SECURITY DEFINER 함수를 쓸 것.
drop policy if exists chat_members_read on chat_members;
create policy chat_members_read on chat_members for select
  using (user_id = auth.uid());

drop policy if exists chat_members_write on chat_members;
create policy chat_members_write on chat_members for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 같은 방의 멤버 전체 조회용 (RLS 우회)
create or replace function get_room_members(p_room_id uuid)
returns table (user_id uuid, last_read_at timestamptz, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $func$
  select m.user_id, m.last_read_at, m.joined_at
  from public.chat_members m
  where m.room_id = p_room_id
    and exists (
      select 1 from public.chat_members me
      where me.room_id = p_room_id and me.user_id = auth.uid()
    );
$func$;

-- messages 읽기/쓰기: 멤버만
drop policy if exists chat_messages_read on chat_messages;
create policy chat_messages_read on chat_messages for select
  using (is_chat_member(room_id));

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages for insert
  with check (is_chat_member(room_id) and sender_id = auth.uid());

drop policy if exists chat_messages_update on chat_messages;
create policy chat_messages_update on chat_messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists chat_messages_delete on chat_messages;
create policy chat_messages_delete on chat_messages for delete
  using (sender_id = auth.uid());

-- 5b. 기존 테이블에 누락 컬럼 보강 (create table if not exists 가 무시된 경우 대비)
alter table public.chat_messages add column if not exists content text;
alter table public.chat_messages add column if not exists attachment_url text;
alter table public.chat_messages add column if not exists attachment_type text;
alter table public.chat_messages add column if not exists attachment_name text;
alter table public.chat_messages add column if not exists attachment_size bigint;
alter table public.chat_messages add column if not exists auto_indexed_as text;
alter table public.chat_messages add column if not exists linked_resource_id uuid;
alter table public.chat_messages add column if not exists is_system boolean not null default false;
alter table public.chat_messages add column if not exists reply_to uuid references public.chat_messages(id) on delete set null;
alter table public.chat_messages add column if not exists edited_at timestamptz;

alter table public.chat_rooms add column if not exists type text;
alter table public.chat_rooms add column if not exists name text;
alter table public.chat_rooms add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.chat_rooms add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.chat_rooms add column if not exists last_message_at timestamptz default now();

alter table public.chat_members add column if not exists last_read_at timestamptz default now();

-- PostgREST 스키마 캐시 강제 갱신 (컬럼 추가 후 필수)
notify pgrst, 'reload schema';

-- 6. Supabase Realtime publication 에 추가 (이미 있으면 스킵 — idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_rooms'
  ) then
    alter publication supabase_realtime add table public.chat_rooms;
  end if;
end $$;

-- 7. 헬퍼 — DM 방 생성(또는 기존 방 반환)
create or replace function get_or_create_dm_room(p_other_user uuid)
returns uuid language plpgsql security definer as $$
declare
  v_me uuid := auth.uid();
  v_room uuid;
begin
  if v_me is null or p_other_user is null or v_me = p_other_user then
    return null;
  end if;

  -- 기존 DM 방 찾기 (멤버가 정확히 두 명 & 두 유저 포함)
  select r.id into v_room
  from chat_rooms r
  where r.type = 'dm'
    and exists (select 1 from chat_members m1 where m1.room_id = r.id and m1.user_id = v_me)
    and exists (select 1 from chat_members m2 where m2.room_id = r.id and m2.user_id = p_other_user)
    and (select count(*) from chat_members m where m.room_id = r.id) = 2
  limit 1;

  if v_room is not null then
    return v_room;
  end if;

  -- 신규 DM 방
  insert into chat_rooms (type, created_by) values ('dm', v_me) returning id into v_room;
  insert into chat_members (room_id, user_id) values (v_room, v_me), (v_room, p_other_user);

  return v_room;
end;
$$;

-- 8. 너트/볼트 방 자동 생성 — 너트/볼트 개설 시 호출
create or replace function ensure_group_room(p_group_id uuid)
returns uuid language plpgsql security definer as $$
declare v_room uuid;
begin
  select id into v_room from chat_rooms where group_id = p_group_id;
  if v_room is not null then return v_room; end if;

  insert into chat_rooms (type, group_id, name, created_by)
  select 'nut', p_group_id, name, host_id from groups where id = p_group_id
  returning id into v_room;

  -- 기존 멤버 자동 등록
  insert into chat_members (room_id, user_id)
  select v_room, user_id from group_members where group_id = p_group_id
  on conflict do nothing;

  return v_room;
end;
$$;

create or replace function ensure_project_room(p_project_id uuid)
returns uuid language plpgsql security definer as $$
declare v_room uuid;
begin
  select id into v_room from chat_rooms where project_id = p_project_id;
  if v_room is not null then return v_room; end if;

  insert into chat_rooms (type, project_id, name, created_by)
  select 'bolt', p_project_id, title, created_by from projects where id = p_project_id
  returning id into v_room;

  insert into chat_members (room_id, user_id)
  select v_room, user_id from project_members where project_id = p_project_id and user_id is not null
  on conflict do nothing;

  return v_room;
end;
$$;

-- 9. 그룹/볼트 멤버 자동 합류 트리거
create or replace function trg_auto_join_room_nut()
returns trigger language plpgsql as $$
declare v_room uuid;
begin
  select id into v_room from chat_rooms where group_id = new.group_id;
  if v_room is not null and new.user_id is not null then
    insert into chat_members (room_id, user_id) values (v_room, new.user_id) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists group_members_auto_join_chat on group_members;
create trigger group_members_auto_join_chat after insert on group_members
  for each row execute function trg_auto_join_room_nut();

create or replace function trg_auto_join_room_bolt()
returns trigger language plpgsql as $$
declare v_room uuid;
begin
  select id into v_room from chat_rooms where project_id = new.project_id;
  if v_room is not null and new.user_id is not null then
    insert into chat_members (room_id, user_id) values (v_room, new.user_id) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists project_members_auto_join_chat on project_members;
create trigger project_members_auto_join_chat after insert on project_members
  for each row execute function trg_auto_join_room_bolt();
