-- Personal notes / wiki (Notion-alternative minimal)
create table if not exists personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references personal_notes(id) on delete cascade,
  title text not null,
  content text default '',
  icon text,
  tags text[] default '{}',
  is_favorite boolean default false,
  is_archived boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table personal_notes enable row level security;

drop policy if exists "personal_notes_owner" on personal_notes;
create policy "personal_notes_owner" on personal_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_personal_notes_user on personal_notes(user_id, is_archived);
create index if not exists idx_personal_notes_parent on personal_notes(parent_id);
create index if not exists idx_personal_notes_tags on personal_notes using gin(tags);

-- auto-update updated_at
create or replace function personal_notes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists personal_notes_touch on personal_notes;
create trigger personal_notes_touch
  before update on personal_notes
  for each row execute function personal_notes_touch_updated_at();
