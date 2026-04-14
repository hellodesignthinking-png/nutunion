-- ============================================================
-- 029: Staff Platform — 너트유니온 핵심 멤버 워크스페이스
-- ============================================================

-- 1. profiles 테이블에 staff 역할 추가 (기존 role 컬럼은 text이므로 확장 자유)
-- 관리자가 profiles.role = 'staff' 로 지정하면 스태프 포털 접근 가능

-- 2. 스태프 프로젝트 (내부 업무 프로젝트)
create table if not exists staff_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  category text default 'general',
  drive_folder_id text,
  drive_folder_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 스태프 프로젝트 멤버
create table if not exists staff_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references staff_projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  joined_at timestamptz default now(),
  unique(project_id, user_id)
);

-- 4. 스태프 파일 (Google Drive 미러)
create table if not exists staff_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references staff_projects(id) on delete cascade,
  drive_file_id text not null,
  title text not null,
  mime_type text,
  drive_url text,
  thumbnail_url text,
  file_size bigint,
  created_by uuid references profiles(id),
  ai_summary text,
  ai_tags text[] default '{}',
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. 스태프 할일 (Task)
create table if not exists staff_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references staff_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references profiles(id),
  source_type text default 'manual' check (source_type in ('manual', 'comment', 'meeting', 'ai')),
  source_file_id uuid references staff_files(id),
  due_date date,
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. 스태프 활동 로그
create table if not exists staff_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references staff_projects(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null, -- 'file_added', 'task_created', 'task_completed', 'comment_added', 'member_joined'
  target_type text,     -- 'file', 'task', 'project', 'comment'
  target_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 7. 스태프 코멘트 (파일·할일에 대한 내부 토론)
create table if not exists staff_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references staff_projects(id) on delete cascade,
  target_type text not null check (target_type in ('file', 'task', 'project')),
  target_id uuid not null,
  author_id uuid references profiles(id),
  content text not null,
  drive_comment_id text, -- Google Docs 코멘트와 양방향 동기화 시 사용
  created_at timestamptz default now()
);

-- 인덱스
create index if not exists idx_staff_files_project on staff_files(project_id);
create index if not exists idx_staff_tasks_project on staff_tasks(project_id);
create index if not exists idx_staff_tasks_assigned on staff_tasks(assigned_to);
create index if not exists idx_staff_activity_project on staff_activity(project_id);
create index if not exists idx_staff_comments_target on staff_comments(target_type, target_id);

-- RLS
alter table staff_projects enable row level security;
alter table staff_project_members enable row level security;
alter table staff_files enable row level security;
alter table staff_tasks enable row level security;
alter table staff_activity enable row level security;
alter table staff_comments enable row level security;

-- 스태프/관리자만 접근
create policy "staff_projects_select" on staff_projects for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_projects_insert" on staff_projects for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_projects_update" on staff_projects for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_projects_delete" on staff_projects for delete using (
  created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 나머지 테이블도 동일한 패턴
create policy "staff_pm_select" on staff_project_members for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_pm_all" on staff_project_members for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

create policy "staff_files_select" on staff_files for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_files_all" on staff_files for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

create policy "staff_tasks_select" on staff_tasks for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_tasks_all" on staff_tasks for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

create policy "staff_activity_select" on staff_activity for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_activity_insert" on staff_activity for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);

create policy "staff_comments_select" on staff_comments for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
create policy "staff_comments_all" on staff_comments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
);
