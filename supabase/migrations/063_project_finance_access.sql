-- 063: 프로젝트 자금/보상 접근 정책 확장 + 마감 시 자동 정산 스냅샷
-- 배경: 040 에서 project_finance 를 admin/staff 전용으로 막아버려 프로젝트 멤버가 자기 볼트의 자금
--       데이터를 못 보는 문제 발생. 본 마이그레이션에서 프로젝트 멤버도 조회, host/lead/manager
--       쓰기 가능하게 확장.

-- ── 1. projects: 정산 스냅샷 컬럼 ──────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS finance_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS rewards_finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rewards_finalized_at timestamptz;

COMMENT ON COLUMN public.projects.finance_snapshot IS
  '마감 시 집계된 자금/보상 요약 (JSON). 멤버가 원본 project_finance 권한 없어도 이것만으로 자금 내역 열람 가능.';

-- ── 2. project_finance RLS — 프로젝트 멤버 SELECT 허용 ──
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_finance') then
    execute 'alter table public.project_finance enable row level security';

    -- 기존 admin/staff only 정책 유지하되, 멤버 읽기 정책 추가
    execute 'drop policy if exists "project_finance_member_select" on public.project_finance';
    execute $POL$
      create policy "project_finance_member_select" on public.project_finance
        for select using (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_finance.project_id
              and pm.user_id = auth.uid()
          )
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','staff')
          )
        )
    $POL$;

    -- 프로젝트 lead/manager/host 쓰기 허용
    execute 'drop policy if exists "project_finance_lead_insert" on public.project_finance';
    execute $POL$
      create policy "project_finance_lead_insert" on public.project_finance
        for insert with check (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_finance.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','manager','host','owner')
          )
          or exists (
            select 1 from public.projects p
            where p.id = project_finance.project_id and p.created_by = auth.uid()
          )
          or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role in ('admin','staff')
          )
        )
    $POL$;

    execute 'drop policy if exists "project_finance_lead_update" on public.project_finance';
    execute $POL$
      create policy "project_finance_lead_update" on public.project_finance
        for update using (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_finance.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','manager','host','owner')
          )
          or exists (
            select 1 from public.projects p
            where p.id = project_finance.project_id and p.created_by = auth.uid()
          )
          or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role in ('admin','staff')
          )
        )
    $POL$;

    execute 'drop policy if exists "project_finance_lead_delete" on public.project_finance';
    execute $POL$
      create policy "project_finance_lead_delete" on public.project_finance
        for delete using (
          exists (
            select 1 from public.project_members pm
            where pm.project_id = project_finance.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','manager','host','owner')
          )
          or exists (
            select 1 from public.projects p
            where p.id = project_finance.project_id and p.created_by = auth.uid()
          )
          or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role in ('admin','staff')
          )
        )
    $POL$;
  end if;
end $$;

-- ── 3. project_members reward_ratio 업데이트 허용 ──────
-- 기존 admin/staff-only update 정책이 있을 수 있어 호스트 허용 정책 추가
do $$
begin
  execute 'alter table public.project_members enable row level security';

  execute 'drop policy if exists "project_members_host_update" on public.project_members';
  execute $POL$
    create policy "project_members_host_update" on public.project_members
      for update using (
        exists (
          select 1 from public.projects p
          where p.id = project_members.project_id and p.created_by = auth.uid()
        )
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = project_members.project_id
            and pm.user_id = auth.uid()
            and pm.role in ('lead','manager','host','owner')
        )
        or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role in ('admin','staff')
        )
      )
  $POL$;

  -- SELECT: 모든 인증 사용자 (팀 구성 조회용)
  execute 'drop policy if exists "project_members_authenticated_select" on public.project_members';
  execute $POL$
    create policy "project_members_authenticated_select" on public.project_members
      for select using (auth.uid() is not null)
  $POL$;
end $$;

-- ── 4. project_milestones reward_percentage 업데이트 허용 ──
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_milestones') then
    execute 'alter table public.project_milestones enable row level security';

    execute 'drop policy if exists "project_milestones_member_select" on public.project_milestones';
    execute $POL$
      create policy "project_milestones_member_select" on public.project_milestones
        for select using (auth.uid() is not null)
    $POL$;

    execute 'drop policy if exists "project_milestones_host_write" on public.project_milestones';
    execute $POL$
      create policy "project_milestones_host_write" on public.project_milestones
        for all using (
          exists (
            select 1 from public.projects p
            where p.id = project_milestones.project_id and p.created_by = auth.uid()
          )
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = project_milestones.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','manager','host','owner')
          )
          or exists (
            select 1 from public.profiles pr
            where pr.id = auth.uid() and pr.role in ('admin','staff')
          )
        )
    $POL$;
  end if;
end $$;

-- ── 5. RPC: finance snapshot 계산 (close 엔드포인트에서 호출) ──
create or replace function public.compute_project_finance_snapshot(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_budget numeric;
  v_currency text;
  v_reward_total numeric;
  v_income numeric := 0;
  v_expense numeric := 0;
  v_balance numeric;
  v_tx_count int := 0;
  v_milestones jsonb;
  v_members jsonb;
  v_result jsonb;
begin
  select
    coalesce(total_budget, 0),
    coalesce(budget_currency, 'KRW'),
    coalesce(reward_total, total_budget, 0)
  into v_total_budget, v_currency, v_reward_total
  from public.projects
  where id = p_project_id;

  -- 거래 집계 (테이블 존재 시)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_finance') then
    select
      coalesce(sum(case when type = 'income' then amount else 0 end), 0),
      coalesce(sum(case when type = 'expense' then amount else 0 end), 0),
      count(*)
    into v_income, v_expense, v_tx_count
    from public.project_finance
    where project_id = p_project_id;
  end if;

  v_balance := (v_total_budget + v_income) - v_expense;

  -- 마일스톤별 보상 분배
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'title', m.title,
    'status', m.status,
    'reward_percentage', coalesce(m.reward_percentage, 0),
    'reward_amount', round(v_reward_total * coalesce(m.reward_percentage, 0) / 100.0),
    'is_settled', coalesce(m.is_settled, false),
    'settled_at', m.settled_at
  ) order by m.sort_order nulls last, m.created_at), '[]'::jsonb)
  into v_milestones
  from public.project_milestones m
  where m.project_id = p_project_id;

  -- 멤버별 보상 분배
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', pm.user_id,
    'role', pm.role,
    'reward_ratio', coalesce(pm.reward_ratio, 0),
    'reward_amount', round(v_reward_total * coalesce(pm.reward_ratio, 0) / 100.0),
    'nickname', pr.nickname,
    'avatar_url', pr.avatar_url
  ) order by pm.role, pr.nickname), '[]'::jsonb)
  into v_members
  from public.project_members pm
  left join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = p_project_id;

  v_result := jsonb_build_object(
    'currency', v_currency,
    'total_budget', v_total_budget,
    'reward_total', v_reward_total,
    'income_total', v_income,
    'expense_total', v_expense,
    'balance', v_balance,
    'transaction_count', v_tx_count,
    'milestones', v_milestones,
    'members', v_members,
    'computed_at', now()
  );

  return v_result;
end
$$;

grant execute on function public.compute_project_finance_snapshot(uuid) to authenticated;

comment on function public.compute_project_finance_snapshot(uuid) is
  '프로젝트 자금/보상 스냅샷 — 마감 시 projects.finance_snapshot 에 저장.';
