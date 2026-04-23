-- Migration 083: project_tasks.completed_at
-- 번다운 차트가 정확하려면 "언제 완료됐는지"를 알아야 한다.
-- 현재 project_tasks 는 updated_at / completed_at 둘 다 없어서
-- burndown chart 가 "어제 완료됐다고 가정"하는 가짜 그래프를 그리고 있었음.

-- 1) completed_at 컬럼 추가 (idempotent)
alter table project_tasks
  add column if not exists completed_at timestamptz;

-- 2) 기존 done 상태 task 는 created_at 으로 백필 (정확하진 않지만 비어있는 것보다 낫다)
update project_tasks
set    completed_at = coalesce(created_at, now())
where  status = 'done'
  and  completed_at is null;

-- 3) status 변경 시 completed_at 자동 갱신 트리거
create or replace function trg_project_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  -- done 으로 전환되는 순간 stamp
  if (new.status = 'done' and (old.status is null or old.status <> 'done')) then
    new.completed_at := now();
  -- done 에서 벗어나면 clear (재오픈 케이스)
  elsif (new.status <> 'done' and old.status = 'done') then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists project_tasks_completed_at_trigger on project_tasks;
create trigger project_tasks_completed_at_trigger
  before update of status on project_tasks
  for each row
  execute function trg_project_task_completed_at();

-- INSERT 시에도 done 으로 바로 들어오는 edge case 처리
create or replace function trg_project_task_completed_at_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists project_tasks_completed_at_insert_trigger on project_tasks;
create trigger project_tasks_completed_at_insert_trigger
  before insert on project_tasks
  for each row
  execute function trg_project_task_completed_at_insert();

-- 4) index (burndown chart 가 자주 이 컬럼으로 필터)
create index if not exists idx_project_tasks_completed_at
  on project_tasks (project_id, completed_at)
  where completed_at is not null;
