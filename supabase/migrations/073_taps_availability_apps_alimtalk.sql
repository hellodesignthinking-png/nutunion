-- 073: Phase 1 잔여 — 볼트 탭 / 와셔 가용성 / 지원서 강화 / 알림톡 로그

-- ============================================
-- 1. bolt_taps — 볼트별 자동 생성되는 "기억 저장고" 페이지
-- ============================================
create table if not exists public.bolt_taps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null unique,
  title text not null,
  content_md text default '',     -- Markdown 본문
  visibility text not null default 'members' check (visibility in ('public','members','private')),
  is_retrospective_submitted boolean not null default false,  -- 마감 회고 제출 여부
  last_edited_by uuid references public.profiles(id) on delete set null,
  last_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bolt_taps_visibility_idx on public.bolt_taps (visibility) where visibility = 'public';

alter table public.bolt_taps enable row level security;

drop policy if exists "bolt_taps_select_by_visibility" on public.bolt_taps;
create policy "bolt_taps_select_by_visibility" on public.bolt_taps for select
  using (
    visibility = 'public'
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = bolt_taps.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = bolt_taps.project_id and p.created_by = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "bolt_taps_write_members" on public.bolt_taps;
create policy "bolt_taps_write_members" on public.bolt_taps for all
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = bolt_taps.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = bolt_taps.project_id and p.created_by = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 볼트 생성 시 자동으로 빈 bolt_tap 생성 (트리거)
create or replace function public.ensure_bolt_tap()
returns trigger language plpgsql security definer as $$
begin
  begin
    insert into public.bolt_taps (project_id, title, content_md, visibility)
    values (new.id, new.title || ' — Tap', '', 'members')
    on conflict (project_id) do nothing;
  exception when others then
    raise notice 'bolt_tap auto-create skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists projects_create_tap on public.projects;
create trigger projects_create_tap
  after insert on public.projects
  for each row execute function public.ensure_bolt_tap();

-- 기존 볼트들에 대해서도 자동 채움 (idempotent)
insert into public.bolt_taps (project_id, title, content_md, visibility)
select p.id, p.title || ' — Tap', '', 'members'
from public.projects p
where not exists (select 1 from public.bolt_taps bt where bt.project_id = p.id)
on conflict (project_id) do nothing;

-- ============================================
-- 2. profiles.availability — 가용성 토글
-- ============================================
alter table public.profiles
  add column if not exists availability text default 'observing'
    check (availability in ('looking','focused','observing'));

comment on column public.profiles.availability is
  'looking = 새 볼트 찾는 중 · focused = 기존 볼트 집중 · observing = 관망';

-- ============================================
-- 3. project_applications — PM 승인 워크플로우 필드
-- ============================================
alter table public.project_applications
  add column if not exists reviewer_note text,
  add column if not exists role_type text
    check (role_type in ('pm','lead','member','support','mentor','sponsor','observer') or role_type is null);

create index if not exists project_applications_status_idx
  on public.project_applications (project_id, status, created_at desc);

-- ============================================
-- 4. alimtalk_logs — 카카오톡 알림톡 원장
-- ============================================
create table if not exists public.alimtalk_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  phone text not null,
  template_code text not null,        -- 사전 승인된 템플릿 코드
  variables jsonb default '{}',
  provider text not null default 'ncp' check (provider in ('ncp','biztalk','other')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  provider_msg_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alimtalk_logs_user_idx on public.alimtalk_logs (user_id, created_at desc);
create index if not exists alimtalk_logs_status_idx on public.alimtalk_logs (status);

alter table public.alimtalk_logs enable row level security;
drop policy if exists "alimtalk_select_own" on public.alimtalk_logs;
create policy "alimtalk_select_own" on public.alimtalk_logs for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "alimtalk_insert_service" on public.alimtalk_logs;
create policy "alimtalk_insert_service" on public.alimtalk_logs for insert
  with check (auth.role() = 'service_role' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 완료
comment on schema public is
  'Migration 073 — bolt_taps auto-create, profile availability, app approval fields, alimtalk logs';
