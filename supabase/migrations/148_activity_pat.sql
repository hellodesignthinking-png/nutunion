-- L8: 활동 로그 + Personal Access Tokens

-- ── 1) 활동 로그 ─────────────────────────────────────────────────
-- 페이지/블록 CRUD 를 추적해 사이드바 "활동" 탭 + 분석 통계의 원천.

create table if not exists space_activity_log (
  id          uuid primary key default gen_random_uuid(),
  owner_type  text not null check (owner_type in ('nut','bolt')),
  owner_id    uuid not null,
  page_id     uuid,
  block_id    uuid,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null check (action in (
    'page.created','page.updated','page.deleted',
    'block.created','block.updated','block.deleted',
    'page.shared','page.unshared'
  )),
  summary     text,
  created_at  timestamptz not null default now()
);

create index if not exists space_activity_log_owner_idx
  on space_activity_log (owner_type, owner_id, created_at desc);
create index if not exists space_activity_log_actor_idx
  on space_activity_log (actor_id, created_at desc);

alter table space_activity_log enable row level security;

-- read: 그 너트/볼트 멤버만
drop policy if exists "activity_log_select" on space_activity_log;
create policy "activity_log_select" on space_activity_log
  for select using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_activity_log.owner_id
        and user_id = auth.uid()
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_activity_log.owner_id
        and user_id = auth.uid()
    ))
  );

-- insert: trigger 로만 — application code 는 직접 insert 안 함
drop policy if exists "activity_log_insert" on space_activity_log;
create policy "activity_log_insert" on space_activity_log
  for insert with check (true);

-- ── 2) 트리거 — space_pages 변경 시 로그 ────────────────────────
create or replace function log_space_page_activity()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    insert into space_activity_log (owner_type, owner_id, page_id, actor_id, action, summary)
    values (new.owner_type, new.owner_id, new.id, new.created_by, 'page.created', new.title);
  elsif (tg_op = 'UPDATE') then
    -- title 변경
    if old.title is distinct from new.title then
      insert into space_activity_log (owner_type, owner_id, page_id, actor_id, action, summary)
      values (new.owner_type, new.owner_id, new.id, auth.uid(), 'page.updated', '제목: ' || coalesce(new.title, ''));
    end if;
    -- share toggle
    if old.share_token is distinct from new.share_token then
      if new.share_token is not null then
        insert into space_activity_log (owner_type, owner_id, page_id, actor_id, action, summary)
        values (new.owner_type, new.owner_id, new.id, auth.uid(), 'page.shared', new.title);
      else
        insert into space_activity_log (owner_type, owner_id, page_id, actor_id, action, summary)
        values (new.owner_type, new.owner_id, new.id, auth.uid(), 'page.unshared', new.title);
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    insert into space_activity_log (owner_type, owner_id, page_id, actor_id, action, summary)
    values (old.owner_type, old.owner_id, old.id, auth.uid(), 'page.deleted', old.title);
  end if;
  return null;
end;
$$;

drop trigger if exists log_space_page_activity_trg on space_pages;
create trigger log_space_page_activity_trg
  after insert or update or delete on space_pages
  for each row execute function log_space_page_activity();

-- block 변경 — owner_type/owner_id 는 부모 페이지 조회 필요
create or replace function log_space_block_activity()
returns trigger language plpgsql security definer as $$
declare
  v_owner_type text;
  v_owner_id uuid;
begin
  if (tg_op = 'INSERT') then
    select owner_type, owner_id into v_owner_type, v_owner_id from space_pages where id = new.page_id;
    if v_owner_type is not null then
      insert into space_activity_log (owner_type, owner_id, page_id, block_id, actor_id, action, summary)
      values (v_owner_type, v_owner_id, new.page_id, new.id, new.created_by, 'block.created',
              new.type || ' · ' || left(coalesce(new.content, ''), 60));
    end if;
  elsif (tg_op = 'UPDATE') then
    -- content 만 변경 시 로그 (data 변경, position 만 변경 시 스킵)
    if old.content is distinct from new.content then
      select owner_type, owner_id into v_owner_type, v_owner_id from space_pages where id = new.page_id;
      if v_owner_type is not null then
        insert into space_activity_log (owner_type, owner_id, page_id, block_id, actor_id, action, summary)
        values (v_owner_type, v_owner_id, new.page_id, new.id, auth.uid(), 'block.updated',
                new.type || ' · ' || left(coalesce(new.content, ''), 60));
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    select owner_type, owner_id into v_owner_type, v_owner_id from space_pages where id = old.page_id;
    if v_owner_type is not null then
      insert into space_activity_log (owner_type, owner_id, page_id, block_id, actor_id, action, summary)
      values (v_owner_type, v_owner_id, old.page_id, old.id, auth.uid(), 'block.deleted',
              old.type || ' · ' || left(coalesce(old.content, ''), 60));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists log_space_block_activity_trg on space_page_blocks;
create trigger log_space_block_activity_trg
  after insert or update or delete on space_page_blocks
  for each row execute function log_space_block_activity();

-- ── 3) Personal Access Tokens (PAT) ─────────────────────────────
-- 사용자가 외부 nutunion API 호출용 토큰. token 평문은 저장 안 하고 sha256 해시.
-- 발급 시점에만 평문 반환. 이후 조회 불가.

create table if not exists personal_access_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  name         text not null default 'Untitled',
  token_hash   text not null unique,   -- sha256 hex
  prefix       text not null,           -- 표시용 8자 (예: "nut_abc1")
  scope        text[] not null default array['read']::text[],
  last_used_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists pat_user_idx on personal_access_tokens (user_id, created_at desc);

alter table personal_access_tokens enable row level security;

drop policy if exists "pat_own_all" on personal_access_tokens;
create policy "pat_own_all" on personal_access_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
