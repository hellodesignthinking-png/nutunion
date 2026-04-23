-- 065: Wiki AI Synthesis 에 사용된 자료 추적
-- 목적: 같은 자료를 반복 분석해 토큰 낭비하는 것을 방지.
--       synthesis 실행 시 이미 분석된 자료는 프롬프트에서 제외.

create table if not exists public.wiki_synthesis_inputs (
  id uuid primary key default gen_random_uuid(),
  synthesis_id uuid not null references public.wiki_synthesis_logs(id) on delete cascade,
  group_id uuid not null,                      -- 빠른 조회용 (denormalized)
  source_type text not null check (source_type in (
    'resource',        -- wiki_weekly_resources
    'meeting',         -- meetings
    'meeting_note',    -- meeting_notes
    'drive_doc',       -- file_attachments (drive-link)
    'wiki_page'        -- wiki_pages (기존 페이지 참고용)
  )),
  source_id uuid not null,
  used_at timestamptz not null default now(),
  unique (synthesis_id, source_type, source_id)
);

create index if not exists wiki_synthesis_inputs_group_idx
  on public.wiki_synthesis_inputs (group_id, source_type, source_id);
create index if not exists wiki_synthesis_inputs_source_lookup_idx
  on public.wiki_synthesis_inputs (source_type, source_id);
create index if not exists wiki_synthesis_inputs_synthesis_idx
  on public.wiki_synthesis_inputs (synthesis_id);

alter table public.wiki_synthesis_inputs enable row level security;

-- RLS: 그룹 멤버 조회 / service_role 만 쓰기 (synthesis 코어에서 admin 으로 insert)
drop policy if exists wiki_synthesis_inputs_select on public.wiki_synthesis_inputs;
create policy wiki_synthesis_inputs_select on public.wiki_synthesis_inputs
  for select using (
    auth.uid() is not null
    and (
      exists (select 1 from public.group_members gm
              where gm.group_id = wiki_synthesis_inputs.group_id
                and gm.user_id = auth.uid()
                and gm.status = 'active')
      or exists (select 1 from public.groups g
                 where g.id = wiki_synthesis_inputs.group_id
                   and g.host_id = auth.uid())
      or exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role in ('admin','staff'))
    )
  );

-- 사용자 insert 금지 — synthesis 코어가 service_role 로만 기록
drop policy if exists wiki_synthesis_inputs_no_insert on public.wiki_synthesis_inputs;
create policy wiki_synthesis_inputs_no_insert on public.wiki_synthesis_inputs
  for insert with check (false);

-- ── 조회 편의 함수: 그룹의 각 자료 분석 여부 ──────────
create or replace function public.wiki_resource_analysis_status(
  p_group_id uuid
)
returns table (
  source_type text,
  source_id uuid,
  last_analyzed_at timestamptz,
  analysis_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    source_type,
    source_id,
    max(used_at) as last_analyzed_at,
    count(*)::int as analysis_count
  from public.wiki_synthesis_inputs
  where group_id = p_group_id
  group by source_type, source_id
$$;

grant execute on function public.wiki_resource_analysis_status(uuid) to authenticated;

-- ── RPC: inputs 기록 (security definer — RLS 우회) ────
create or replace function public.record_wiki_synthesis_inputs(
  p_synthesis_id uuid,
  p_group_id uuid,
  p_entries jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_entry jsonb;
begin
  -- 권한: 호출자가 그룹의 호스트/멤버/admin 이어야 함
  if not (
    exists (select 1 from public.groups g where g.id = p_group_id and g.host_id = auth.uid())
    or exists (select 1 from public.group_members gm
               where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.status = 'active')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff'))
  ) then
    raise exception 'Unauthorized';
  end if;

  -- 배치 insert
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    begin
      insert into public.wiki_synthesis_inputs (synthesis_id, group_id, source_type, source_id)
      values (
        p_synthesis_id,
        p_group_id,
        v_entry->>'source_type',
        (v_entry->>'source_id')::uuid
      )
      on conflict (synthesis_id, source_type, source_id) do nothing;
      v_count := v_count + 1;
    exception when others then
      -- 개별 row 실패는 skip
      continue;
    end;
  end loop;

  return v_count;
end
$$;

grant execute on function public.record_wiki_synthesis_inputs(uuid, uuid, jsonb) to authenticated;

comment on function public.record_wiki_synthesis_inputs(uuid, uuid, jsonb) is
  'Synthesis 코어가 분석에 사용한 자료 IDs 를 일괄 기록. RLS 우회 (security definer).';

comment on table public.wiki_synthesis_inputs is
  'Wiki AI Synthesis 입력 자료 기록 — 반복 분석 방지. synthesis_id 별로 어떤 자료가 프롬프트에 들어갔는지 추적.';
comment on function public.wiki_resource_analysis_status(uuid) is
  '그룹 전체 자료별 분석 이력 (마지막 분석 시점 + 횟수)';
