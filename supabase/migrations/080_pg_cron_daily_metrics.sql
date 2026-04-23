-- 080: pg_cron 으로 daily_metrics 자동 집계
-- 전제: Supabase Dashboard → Database → Extensions 에서 pg_cron 활성화

do $$
begin
  -- pg_cron 이 활성 상태일 때만 스케줄 등록
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 기존 잡 제거 (idempotent)
    perform cron.unschedule('nutunion_daily_metrics')
      where exists (select 1 from cron.job where jobname = 'nutunion_daily_metrics');

    -- 매일 00:05 UTC (09:05 KST) — 전날 지표 계산
    perform cron.schedule(
      'nutunion_daily_metrics',
      '5 0 * * *',
      $cron$
        select public.compute_daily_metrics((current_date at time zone 'UTC')::date - 1);
      $cron$
    );

    raise notice 'pg_cron: nutunion_daily_metrics scheduled at 00:05 UTC daily';
  else
    raise notice 'pg_cron extension not found — enable via Dashboard → Database → Extensions';
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;

-- 수동 트리거 뷰 (운영자가 강제 재계산할 때)
create or replace function public.recompute_daily_metrics_range(
  start_date date,
  end_date date default current_date
) returns int language plpgsql security definer as $$
declare
  d date := start_date;
  n int := 0;
begin
  while d <= end_date loop
    perform public.compute_daily_metrics(d);
    d := d + 1;
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function public.recompute_daily_metrics_range(date, date) to authenticated;

comment on schema public is 'Migration 080 — pg_cron daily_metrics scheduler';
