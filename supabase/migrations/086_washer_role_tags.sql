-- ============================================
-- Migration 086: Washer (profiles) role_tags 칩
-- ============================================
-- 배경: 매칭 엔진이 볼트 유형과 와셔 역할을 맞추기 위한 태그.
-- role_tags 는 text[] — 다중 선택. 카테고리는 3개 (project/operation/platform) + 메타.

alter table public.profiles
  add column if not exists role_tags text[] not null default '{}';

-- 인덱스 (GIN) — 매칭 엔진에서 contains 검색
create index if not exists idx_profiles_role_tags on public.profiles using gin (role_tags);

-- 검증 쿼리 (주석)
-- select nickname, role_tags from profiles where array_length(role_tags, 1) > 0;
