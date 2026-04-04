-- NutUnion Database Schema
-- Community platform with groups, events, scheduling, and CMS

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

-- User profiles (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  nickname text unique not null,
  email text not null,
  specialty text check (specialty in ('space','culture','platform','vibe')),
  avatar_url text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

-- Community groups
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('space','culture','platform','vibe')),
  description text,
  host_id uuid references profiles(id) on delete set null,
  max_members int not null default 20,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Group membership
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','host','moderator')),
  status text not null default 'active' check (status in ('active','pending','waitlist')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Events / schedules
create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  max_attendees int,
  is_recurring boolean not null default false,
  recurrence_rule text,
  parent_event_id uuid references events(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Event attendance
create table event_attendees (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','waitlist','cancelled','attended')),
  registered_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Venues for booking
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity int,
  location text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Venue bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  booked_by uuid references profiles(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now()
);

-- CMS page content (admin-editable)
create table page_content (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  section text not null,
  field_key text not null,
  field_value text,
  field_type text not null default 'text' check (field_type in ('text','richtext','image','json')),
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null,
  unique(page, section, field_key)
);

-- User notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_groups_category on groups(category);
create index idx_groups_is_active on groups(is_active);
create index idx_group_members_user on group_members(user_id);
create index idx_group_members_status on group_members(status);
create index idx_events_group on events(group_id);
create index idx_events_start on events(start_at);
create index idx_events_created_by on events(created_by);
create index idx_event_attendees_user on event_attendees(user_id);
create index idx_bookings_venue on bookings(venue_id);
create index idx_bookings_start on bookings(start_at);
create index idx_page_content_lookup on page_content(page, section);
create index idx_notifications_user on notifications(user_id, is_read);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, nickname, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'nickname', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table venues enable row level security;
alter table bookings enable row level security;
alter table page_content enable row level security;
alter table notifications enable row level security;

-- Profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Groups
create policy "groups_select" on groups for select using (true);
create policy "groups_insert" on groups for insert with check (auth.role() = 'authenticated');
create policy "groups_update" on groups for update using (host_id = auth.uid() or exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "groups_delete" on groups for delete using (host_id = auth.uid() or exists(select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Group Members
create policy "group_members_select" on group_members for select using (true);
create policy "group_members_insert" on group_members for insert with check (auth.role() = 'authenticated');
create policy "group_members_update" on group_members for update using (
  user_id = auth.uid() or
  exists(select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'host')
);
create policy "group_members_delete" on group_members for delete using (
  user_id = auth.uid() or
  exists(select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'host')
);

-- Events
create policy "events_select" on events for select using (true);
create policy "events_insert" on events for insert with check (auth.role() = 'authenticated');
create policy "events_update" on events for update using (
  created_by = auth.uid() or
  exists(select 1 from group_members where group_id = events.group_id and user_id = auth.uid() and role = 'host')
);
create policy "events_delete" on events for delete using (
  created_by = auth.uid() or
  exists(select 1 from group_members where group_id = events.group_id and user_id = auth.uid() and role = 'host')
);

-- Event Attendees
create policy "event_attendees_select" on event_attendees for select using (true);
create policy "event_attendees_insert" on event_attendees for insert with check (auth.uid() = user_id);
create policy "event_attendees_update" on event_attendees for update using (auth.uid() = user_id);
create policy "event_attendees_delete" on event_attendees for delete using (auth.uid() = user_id);

-- Venues
create policy "venues_select" on venues for select using (true);
create policy "venues_insert" on venues for insert with check (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "venues_update" on venues for update using (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "venues_delete" on venues for delete using (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Bookings
create policy "bookings_select" on bookings for select using (auth.role() = 'authenticated');
create policy "bookings_insert" on bookings for insert with check (auth.role() = 'authenticated');
create policy "bookings_update" on bookings for update using (booked_by = auth.uid());
create policy "bookings_delete" on bookings for delete using (booked_by = auth.uid());

-- Page Content
create policy "page_content_select" on page_content for select using (true);
create policy "page_content_insert" on page_content for insert with check (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "page_content_update" on page_content for update using (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "page_content_delete" on page_content for delete using (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Notifications
create policy "notifications_select" on notifications for select using (auth.uid() = user_id);
create policy "notifications_update" on notifications for update using (auth.uid() = user_id);

-- ============================================
-- SEED: Landing page content
-- ============================================

insert into page_content (page, section, field_key, field_value, field_type, sort_order) values
-- Hero
('landing', 'hero', 'kicker', 'protocol collective', 'text', 0),
('landing', 'hero', 'title', 'nutunion', 'text', 1),
('landing', 'hero', 'subtitle', 'scene을 설계하는 protocol collective — 공간, 문화, 플랫폼, 그리고 바이브를 잇는 유니온.', 'text', 2),
('landing', 'hero', 'cta_primary', 'START SCENE', 'text', 3),
('landing', 'hero', 'cta_secondary', 'EXPLORE', 'text', 4),
-- About bento cells
('landing', 'about', 'cell_1_label', 'WHAT WE DO', 'text', 0),
('landing', 'about', 'cell_1_title', 'Scene을 설계합니다', 'text', 1),
('landing', 'about', 'cell_1_body', '공간 기획자, 문화 큐레이터, 플랫폼 빌더, 바이브 메이커가 모여 하나의 Scene을 만듭니다.', 'text', 2),
('landing', 'about', 'cell_2_number', '152+', 'text', 3),
('landing', 'about', 'cell_2_label', 'ACTIVE CREWS', 'text', 4),
('landing', 'about', 'cell_3_title', 'Protocol', 'text', 5),
('landing', 'about', 'cell_3_body', '각자의 전문성을 프로토콜로 연결합니다. 느슨하지만 강력한 유니온.', 'text', 6),
('landing', 'about', 'cell_4_label', 'SPACE', 'text', 7),
('landing', 'about', 'cell_4_title', '공간을 해석하고 재구성합니다', 'text', 8),
('landing', 'about', 'cell_5_label', 'CULTURE', 'text', 9),
('landing', 'about', 'cell_5_title', '문화를 발굴하고 큐레이션합니다', 'text', 10),
('landing', 'about', 'cell_6_label', 'PLATFORM', 'text', 11),
('landing', 'about', 'cell_6_title', '플랫폼을 설계하고 빌드합니다', 'text', 12),
-- Groups section
('landing', 'groups', 'title', 'Scene을 만드는 크루들', 'text', 0),
('landing', 'groups', 'subtitle', '각자의 전문 분야에서 Scene을 만들어가는 소모임들', 'text', 1),
-- Join section
('landing', 'join', 'title', 'Union에 합류하세요', 'text', 0),
('landing', 'join', 'subtitle', '당신의 전문성이 새로운 Scene의 시작입니다', 'text', 1),
-- Footer
('landing', 'footer', 'brand_text', 'nutunion은 공간·문화·플랫폼·바이브를 잇는 protocol collective입니다.', 'text', 0),
('landing', 'footer', 'copyright', '© 2024 nutunion. All rights reserved.', 'text', 1),
('landing', 'footer', 'links', '{"nav": [{"label": "About", "href": "#about"}, {"label": "Groups", "href": "#groups"}, {"label": "Join", "href": "#join"}], "protocol": [{"label": "Brand Guidelines", "href": "#"}, {"label": "Templates", "href": "#"}, {"label": "Open Source", "href": "#"}], "contact": {"email": "hello@nutunion.kr", "instagram": "@nutunion"}}', 'json', 2),
-- Ticker items
('landing', 'ticker', 'items', '["protocol collective","scene-maker","space → culture → fandom","nutunion","platform builder","vibe curator","open protocol","culture architect"]', 'json', 0);
