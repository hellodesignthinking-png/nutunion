import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://htmrdefcbslgwttjayxt.supabase.co';
const SERVICE_KEY = 'REMOVED_SECRET';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// SQL statements to run in order
const statements = [
  // 1. Tables
  `create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    name text not null,
    nickname text unique not null,
    email text not null,
    specialty text check (specialty in ('space','culture','platform','vibe')),
    avatar_url text,
    role text not null default 'member' check (role in ('member','admin')),
    created_at timestamptz not null default now()
  )`,

  `create table if not exists groups (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text check (category in ('space','culture','platform','vibe')),
    description text,
    host_id uuid references profiles(id) on delete set null,
    max_members int not null default 20,
    image_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  )`,

  `create table if not exists group_members (
    group_id uuid references groups(id) on delete cascade,
    user_id uuid references profiles(id) on delete cascade,
    role text not null default 'member' check (role in ('member','host','moderator')),
    status text not null default 'active' check (status in ('active','pending','waitlist')),
    joined_at timestamptz not null default now(),
    primary key (group_id, user_id)
  )`,

  `create table if not exists events (
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
  )`,

  `create table if not exists event_attendees (
    event_id uuid references events(id) on delete cascade,
    user_id uuid references profiles(id) on delete cascade,
    status text not null default 'registered' check (status in ('registered','waitlist','cancelled','attended')),
    registered_at timestamptz not null default now(),
    primary key (event_id, user_id)
  )`,

  `create table if not exists venues (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    capacity int,
    location text,
    image_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
  )`,

  `create table if not exists bookings (
    id uuid primary key default gen_random_uuid(),
    venue_id uuid references venues(id) on delete cascade,
    event_id uuid references events(id) on delete set null,
    booked_by uuid references profiles(id) on delete set null,
    start_at timestamptz not null,
    end_at timestamptz not null,
    status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
    created_at timestamptz not null default now()
  )`,

  `create table if not exists page_content (
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
  )`,

  `create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade,
    type text not null,
    title text not null,
    body text,
    is_read boolean not null default false,
    metadata jsonb default '{}',
    created_at timestamptz not null default now()
  )`,
];

async function run() {
  console.log('Starting migration...\n');

  // Execute each statement via rpc or direct
  // Since we can't run raw SQL via REST, we'll use the pg-meta endpoint
  // Actually let's use the supabase-js sql tagged template if available

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const tableName = sql.match(/create table if not exists (\w+)/)?.[1] || `statement_${i}`;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!res.ok) {
        // Try alternative - check if table already exists by querying it
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=0`, {
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
          },
        });

        if (checkRes.ok) {
          console.log(`  [SKIP] ${tableName} - already exists`);
        } else {
          console.log(`  [WARN] ${tableName} - needs manual creation`);
        }
      } else {
        console.log(`  [OK] ${tableName}`);
      }
    } catch (err) {
      console.log(`  [ERR] ${tableName}: ${err.message}`);
    }
  }

  // Check which tables exist
  console.log('\nChecking existing tables...');
  const tables = ['profiles','groups','group_members','events','event_attendees','venues','bookings','page_content','notifications'];

  for (const t of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=0`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });
      console.log(`  ${t}: ${res.ok ? '✓ exists' : '✗ missing ('+res.status+')'}`);
    } catch (err) {
      console.log(`  ${t}: ✗ error`);
    }
  }

  // Try to seed page_content if table exists
  console.log('\nSeeding page content...');
  const seedData = [
    { page: 'landing', section: 'hero', field_key: 'kicker', field_value: 'protocol collective', field_type: 'text', sort_order: 0 },
    { page: 'landing', section: 'hero', field_key: 'title', field_value: 'nutunion', field_type: 'text', sort_order: 1 },
    { page: 'landing', section: 'hero', field_key: 'subtitle', field_value: 'scene을 설계하는 protocol collective — 공간, 문화, 플랫폼, 그리고 바이브를 잇는 유니온.', field_type: 'text', sort_order: 2 },
    { page: 'landing', section: 'hero', field_key: 'cta_primary', field_value: 'START SCENE', field_type: 'text', sort_order: 3 },
    { page: 'landing', section: 'hero', field_key: 'cta_secondary', field_value: 'EXPLORE', field_type: 'text', sort_order: 4 },
    { page: 'landing', section: 'about', field_key: 'cell_1_label', field_value: 'WHAT WE DO', field_type: 'text', sort_order: 0 },
    { page: 'landing', section: 'about', field_key: 'cell_1_title', field_value: 'Scene을 설계합니다', field_type: 'text', sort_order: 1 },
    { page: 'landing', section: 'about', field_key: 'cell_1_body', field_value: '공간 기획자, 문화 큐레이터, 플랫폼 빌더, 바이브 메이커가 모여 하나의 Scene을 만듭니다.', field_type: 'text', sort_order: 2 },
    { page: 'landing', section: 'about', field_key: 'cell_2_number', field_value: '152+', field_type: 'text', sort_order: 3 },
    { page: 'landing', section: 'about', field_key: 'cell_2_label', field_value: 'ACTIVE CREWS', field_type: 'text', sort_order: 4 },
    { page: 'landing', section: 'join', field_key: 'title', field_value: 'Union에 합류하세요', field_type: 'text', sort_order: 0 },
    { page: 'landing', section: 'join', field_key: 'subtitle', field_value: '당신의 전문성이 새로운 Scene의 시작입니다', field_type: 'text', sort_order: 1 },
    { page: 'landing', section: 'footer', field_key: 'brand_text', field_value: 'nutunion은 공간·문화·플랫폼·바이브를 잇는 protocol collective입니다.', field_type: 'text', sort_order: 0 },
    { page: 'landing', section: 'footer', field_key: 'copyright', field_value: '© 2024 nutunion. All rights reserved.', field_type: 'text', sort_order: 1 },
    { page: 'landing', section: 'ticker', field_key: 'items', field_value: '["protocol collective","scene-maker","space → culture → fandom","nutunion","platform builder","vibe curator","open protocol","culture architect"]', field_type: 'json', sort_order: 0 },
  ];

  const { data, error } = await supabase.from('page_content').upsert(seedData, { onConflict: 'page,section,field_key' });
  if (error) {
    console.log(`  Seed error: ${error.message}`);
  } else {
    console.log(`  ✓ Seeded ${seedData.length} content items`);
  }

  console.log('\nDone!');
}

run().catch(console.error);
