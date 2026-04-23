-- 077: daily_metrics 집계 테이블 + pg_cron 스케줄 (선택)

create table if not exists public.daily_metrics (
  date date primary key,
  dau int not null default 0,
  wau int not null default 0,
  mau int not null default 0,
  new_signups int not null default 0,
  new_groups int not null default 0,
  new_projects int not null default 0,
  total_activities int not null default 0,
  calculated_at timestamptz not null default now()
);

create or replace function public.compute_daily_metrics(target_date date default current_date)
returns void language plpgsql security definer as $$
declare
  v_dau int; v_wau int; v_mau int;
  v_new_users int; v_new_groups int; v_new_projects int; v_activities int;
begin
  -- Activity heuristic: last_activity_at OR updated_at (profiles)
  select count(distinct id) into v_dau
  from public.profiles where updated_at >= target_date and updated_at < target_date + 1;
  select count(distinct id) into v_wau
  from public.profiles where updated_at >= target_date - interval '7 days';
  select count(distinct id) into v_mau
  from public.profiles where updated_at >= target_date - interval '30 days';

  select count(*) into v_new_users from public.profiles
    where created_at >= target_date and created_at < target_date + 1;
  select count(*) into v_new_groups from public.groups
    where created_at >= target_date and created_at < target_date + 1;
  select count(*) into v_new_projects from public.projects
    where created_at >= target_date and created_at < target_date + 1;

  v_activities := 0;
  begin
    select count(*) into v_activities from public.crew_posts
      where created_at >= target_date and created_at < target_date + 1;
  exception when others then null; end;

  insert into public.daily_metrics (date, dau, wau, mau, new_signups, new_groups, new_projects, total_activities, calculated_at)
  values (target_date, v_dau, v_wau, v_mau, v_new_users, v_new_groups, v_new_projects, v_activities, now())
  on conflict (date) do update set
    dau = excluded.dau, wau = excluded.wau, mau = excluded.mau,
    new_signups = excluded.new_signups, new_groups = excluded.new_groups,
    new_projects = excluded.new_projects, total_activities = excluded.total_activities,
    calculated_at = now();
end $$;

alter table public.daily_metrics enable row level security;
drop policy if exists "daily_metrics_admin_only" on public.daily_metrics;
create policy "daily_metrics_admin_only" on public.daily_metrics for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Optional: pg_cron 로 매일 00:05 KST (UTC 15:05) 실행
-- select cron.schedule('compute_daily_metrics', '5 15 * * *', $$select public.compute_daily_metrics(current_date - 1)$$);

comment on schema public is 'Migration 077 — daily_metrics + compute_daily_metrics()';
