-- 115_thread_registry.sql
-- Thread Registry Core — Module Lattice substrate.
-- nut / bolt become containers; Thread instances install on them.

-- Thread 정의 (타입 메타데이터)
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                -- 'board', 'calendar', 'daily-revenue'
  name text not null,                        -- '📋 게시판'
  description text,
  icon text,                                 -- emoji
  category text check (category in (
    'communication','project','finance','space_ops',
    'platform_ops','growth','custom','integration','ai'
  )),
  scope text[] not null,                     -- ['nut'], ['bolt'], or both
  schema jsonb not null,                     -- Thread 데이터 JSON Schema
  config_schema jsonb,                       -- 인스턴스별 설정 스키마
  ui_component text not null,                -- React 컴포넌트 이름
  is_core boolean default false,
  is_public boolean default true,
  pricing text default 'free' check (pricing in ('free','paid','premium')),
  price_krw int default 0,
  created_by uuid references profiles(id),
  created_bolt_id uuid,                      -- 이 Thread 제작에 쓰인 볼트 (나중에 projects(id) 참조로 확장)
  install_count int default 0,
  avg_rating numeric(2,1),
  version text default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Thread 인스턴스 (어느 너트/볼트에 붙었는가)
create table if not exists thread_installations (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id),
  target_type text not null check (target_type in ('nut','bolt')),
  target_id uuid not null,
  position int default 0,
  config jsonb default '{}'::jsonb,
  is_enabled boolean default true,
  installed_by uuid references profiles(id),
  installed_at timestamptz default now(),
  unique(thread_id, target_type, target_id)
);
create index if not exists idx_thread_inst_target on thread_installations(target_type, target_id, position);

-- Thread 데이터 (각 인스턴스의 실제 데이터)
create table if not exists thread_data (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references thread_installations(id) on delete cascade,
  data jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_thread_data_inst on thread_data(installation_id, created_at desc);
create index if not exists idx_thread_data_gin on thread_data using gin(data);

-- Thread 리뷰 (Thread Store용)
create table if not exists thread_reviews (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id),
  user_id uuid not null references profiles(id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(thread_id, user_id)
);

-- RLS
alter table threads enable row level security;
alter table thread_installations enable row level security;
alter table thread_data enable row level security;
alter table thread_reviews enable row level security;

-- threads: public read for is_public=true, owner full control
drop policy if exists "threads_public_read" on threads;
create policy "threads_public_read" on threads for select using (is_public = true);
drop policy if exists "threads_owner_all" on threads;
create policy "threads_owner_all" on threads for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- thread_installations: target members can read/write
drop policy if exists "thread_inst_read" on thread_installations;
create policy "thread_inst_read" on thread_installations for select using (
  case target_type
    when 'nut' then exists(select 1 from group_members gm where gm.group_id = target_id and gm.user_id = auth.uid() and gm.status = 'active')
    when 'bolt' then exists(select 1 from project_members pm where pm.project_id = target_id and pm.user_id = auth.uid())
    else false
  end
);
drop policy if exists "thread_inst_write" on thread_installations;
create policy "thread_inst_write" on thread_installations for insert with check (
  installed_by = auth.uid() and
  case target_type
    when 'nut' then exists(select 1 from group_members gm where gm.group_id = target_id and gm.user_id = auth.uid() and gm.role in ('host','moderator'))
    when 'bolt' then exists(select 1 from project_members pm where pm.project_id = target_id and pm.user_id = auth.uid() and pm.role = 'lead')
    else false
  end
);
drop policy if exists "thread_inst_update" on thread_installations;
create policy "thread_inst_update" on thread_installations for update using (installed_by = auth.uid());
drop policy if exists "thread_inst_delete" on thread_installations;
create policy "thread_inst_delete" on thread_installations for delete using (installed_by = auth.uid());

-- thread_data: target members can read; owner writes
drop policy if exists "thread_data_read" on thread_data;
create policy "thread_data_read" on thread_data for select using (
  exists(select 1 from thread_installations ti where ti.id = installation_id and (
    case ti.target_type
      when 'nut' then exists(select 1 from group_members gm where gm.group_id = ti.target_id and gm.user_id = auth.uid() and gm.status = 'active')
      when 'bolt' then exists(select 1 from project_members pm where pm.project_id = ti.target_id and pm.user_id = auth.uid())
      else false
    end
  ))
);
drop policy if exists "thread_data_insert" on thread_data;
create policy "thread_data_insert" on thread_data for insert with check (
  created_by = auth.uid() and exists(select 1 from thread_installations ti where ti.id = installation_id)
);
drop policy if exists "thread_data_update" on thread_data;
create policy "thread_data_update" on thread_data for update using (created_by = auth.uid());
drop policy if exists "thread_data_delete" on thread_data;
create policy "thread_data_delete" on thread_data for delete using (created_by = auth.uid());

-- thread_reviews: all can read, owner writes
drop policy if exists "thread_reviews_read" on thread_reviews;
create policy "thread_reviews_read" on thread_reviews for select using (true);
drop policy if exists "thread_reviews_write" on thread_reviews;
create policy "thread_reviews_write" on thread_reviews for insert with check (user_id = auth.uid());
drop policy if exists "thread_reviews_update" on thread_reviews;
create policy "thread_reviews_update" on thread_reviews for update using (user_id = auth.uid());
drop policy if exists "thread_reviews_delete" on thread_reviews;
create policy "thread_reviews_delete" on thread_reviews for delete using (user_id = auth.uid());

-- updated_at trigger
create or replace function touch_threads() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists threads_touch on threads;
create trigger threads_touch before update on threads for each row execute function touch_threads();

drop trigger if exists thread_data_touch on thread_data;
create trigger thread_data_touch before update on thread_data for each row execute function touch_threads();
