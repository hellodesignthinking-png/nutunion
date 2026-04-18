-- ============================================================
-- 055_project_closure.sql
-- 볼트(프로젝트) 마감 정보 저장 컬럼 추가
--
-- 흐름:
--   1) admin/owner 가 "프로젝트 마감" 클릭
--   2) AI 가 프로젝트 데이터(멤버/마일스톤/회의록 등)를 종합 요약
--   3) projects.status = 'completed' + closure_* 컬럼 채워짐
--
-- 재마감 가능성 (closure_summary 덮어쓰기) 도 지원.
-- ============================================================

alter table public.projects
  add column if not exists closed_at         timestamptz,
  add column if not exists closed_by         uuid references public.profiles(id) on delete set null,
  add column if not exists closure_summary   text,
  add column if not exists closure_highlights jsonb,
  add column if not exists closure_model     text;

create index if not exists projects_closed_at_idx
  on public.projects (closed_at desc)
  where closed_at is not null;

comment on column public.projects.closure_summary is
  '프로젝트 마감 시 AI 가 생성한 전체 요약 텍스트';
comment on column public.projects.closure_highlights is
  'AI 가 구조화한 하이라이트: { achievements, challenges, lessons, key_contributors, final_outputs, stats }';
