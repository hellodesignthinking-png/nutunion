-- 109_project_dev_plan.sql
-- Store Genesis "기술 개발" dev-plan JSON per project.
-- Safe to re-run.

alter table if exists projects
  add column if not exists dev_plan jsonb,
  add column if not exists dev_plan_generated_at timestamptz;

comment on column projects.dev_plan is 'Genesis 기술 개발 로드맵 JSON (schema: lib/genesis/dev-plan-schema)';
comment on column projects.dev_plan_generated_at is 'dev_plan 이 마지막으로 생성/갱신된 시점';
