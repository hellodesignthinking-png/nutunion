-- ============================================
-- Migration 107: Nut-mation 확장 — 멤버 자료 접근 로그
-- ============================================
-- 신규 멤버 가입 시 너트/볼트 자료실 접근 이력 감사 테이블.
-- R2 는 퍼블릭 버킷이라 per-user ACL 불가, 이 테이블은 관찰성(observability)용.

create table if not exists public.member_resource_access (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  scope text not null check (scope in ('group','project')),
  scope_id uuid not null,
  grant_source text not null check (grant_source in ('join','automation','manual')),
  granted_at timestamptz default now(),
  revoked_at timestamptz
);

alter table public.member_resource_access enable row level security;

drop policy if exists "member_resource_access_self" on public.member_resource_access;
create policy "member_resource_access_self" on public.member_resource_access
  for select using (member_id = auth.uid());

create index if not exists idx_member_resource_access
  on public.member_resource_access(scope, scope_id, member_id);
