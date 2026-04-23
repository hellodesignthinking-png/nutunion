-- Personal projects / tracks (lightweight kanban)
create table if not exists personal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  status text default 'active' check (status in ('idea','active','paused','done','archived')),
  category text,
  progress int default 0 check (progress between 0 and 100),
  target_date date,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table personal_projects enable row level security;

drop policy if exists "personal_projects_owner" on personal_projects;
create policy "personal_projects_owner" on personal_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_personal_projects_user on personal_projects(user_id, status);

create or replace function personal_projects_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists personal_projects_touch on personal_projects;
create trigger personal_projects_touch
  before update on personal_projects
  for each row execute function personal_projects_touch_updated_at();
