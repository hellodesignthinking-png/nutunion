-- ============================================
-- Migration 087: Personal Workspace
-- ============================================
-- 개인 대시보드에서 관리하는 할일·이벤트.
-- 너트/볼트 외에, 개인 생활·외부 일정까지 한 플랫폼에서 관리.

-- 1. 개인 할일
create table if not exists public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  completed_at timestamptz,
  -- 연결: 볼트/너트에서 유래한 태스크 (context)
  project_id uuid references projects(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  -- Google Tasks 동기화 (향후)
  google_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personal_tasks_user on personal_tasks(user_id, status, due_date);
create index if not exists idx_personal_tasks_due on personal_tasks(user_id, due_date) where due_date is not null;

-- 2. 개인 이벤트 (볼트 events 와 별도 — 개인 일정)
create table if not exists public.personal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  url text,
  -- 연결된 볼트/너트 (선택)
  project_id uuid references projects(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  -- Google Calendar 동기화 (향후)
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_personal_events_user on personal_events(user_id, start_at);

-- 3. updated_at 트리거 재사용 (migration 084 에서 정의한 trg_touch_updated_at)
drop trigger if exists personal_tasks_touch on personal_tasks;
create trigger personal_tasks_touch before update on personal_tasks
  for each row execute function trg_touch_updated_at();

drop trigger if exists personal_events_touch on personal_events;
create trigger personal_events_touch before update on personal_events
  for each row execute function trg_touch_updated_at();

-- 4. status=done 전환 시 completed_at 자동
create or replace function trg_personal_tasks_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is null or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists personal_tasks_completed on personal_tasks;
create trigger personal_tasks_completed before update of status on personal_tasks
  for each row execute function trg_personal_tasks_completed_at();

-- 5. RLS — 본인 소유만
alter table personal_tasks  enable row level security;
alter table personal_events enable row level security;

drop policy if exists personal_tasks_own on personal_tasks;
create policy personal_tasks_own on personal_tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists personal_events_own on personal_events;
create policy personal_events_own on personal_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
