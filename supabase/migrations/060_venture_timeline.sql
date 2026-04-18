-- ============================================================
-- 060_venture_timeline.sql
-- Venture 단계 전환 이력 자동 기록
-- ============================================================

create table if not exists public.venture_stage_history (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  from_stage   text,
  to_stage     text not null,
  changed_by   uuid references auth.users(id) on delete set null,
  changed_at   timestamptz not null default now(),
  note         text
);

create index if not exists venture_stage_history_project_idx
  on public.venture_stage_history (project_id, changed_at desc);

alter table public.venture_stage_history enable row level security;

drop policy if exists "venture_stage_history_select" on public.venture_stage_history;
create policy "venture_stage_history_select" on public.venture_stage_history
  for select using (public.is_project_member(project_id));

drop policy if exists "venture_stage_history_insert" on public.venture_stage_history;
create policy "venture_stage_history_insert" on public.venture_stage_history
  for insert with check (public.is_project_member(project_id));

-- 자동 기록 트리거 — projects.venture_stage 변경 시 history 추가
create or replace function public.log_venture_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.venture_stage is distinct from old.venture_stage then
    insert into public.venture_stage_history (project_id, from_stage, to_stage, changed_by)
    values (new.id, old.venture_stage, new.venture_stage, auth.uid());
  end if;
  -- venture_mode 최초 활성화도 기록
  if new.venture_mode = true and (old.venture_mode is null or old.venture_mode = false) then
    insert into public.venture_stage_history (project_id, from_stage, to_stage, changed_by, note)
    values (new.id, null, coalesce(new.venture_stage, 'empathize'), auth.uid(), 'Venture 모드 활성화');
  end if;
  return new;
end
$fn$;

drop trigger if exists projects_venture_stage_change on public.projects;
create trigger projects_venture_stage_change
  after update of venture_stage, venture_mode on public.projects
  for each row execute function public.log_venture_stage_change();
