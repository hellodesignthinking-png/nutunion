-- L14.1: 볼트(프로젝트) 미팅 RLS 보강
--
-- 증상
--   /projects/{id}/meetings/{mid} 에서 회의록(summary) 작성/수정이 거부됨.
--
-- 원인
--   migration 067 의 meetings_update_organizer_or_host / meetings_delete_organizer_or_host
--   가 group_id 기반만 체크. project_id 만 있는 볼트 미팅은 organizer 본인이
--   아니면 update/delete 가 거부되어 회의록 작성·수정 실패.
--
-- 수정
--   project_members 의 lead/pm/member 도 update·delete 가능하게 OR 분기 추가.

drop policy if exists "meetings_update_organizer_or_host" on public.meetings;
create policy "meetings_update_organizer_or_host"
  on public.meetings for update
  using (
    organizer_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = meetings.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = meetings.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('lead','pm','member')
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "meetings_delete_organizer_or_host" on public.meetings;
create policy "meetings_delete_organizer_or_host"
  on public.meetings for delete
  using (
    organizer_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = meetings.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = meetings.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('lead','pm')
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 같은 이유로 INSERT 도 — 프로젝트 멤버가 볼트 미팅 만들 수 있게 명시 추가
drop policy if exists "meetings_insert_host_or_member" on public.meetings;
create policy "meetings_insert_host_or_member"
  on public.meetings for insert
  with check (
    -- 일반 너트 미팅
    (
      meetings.group_id is not null
      and (
        exists (
          select 1 from public.groups g
          where g.id = meetings.group_id and g.host_id = auth.uid()
        )
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = meetings.group_id
            and gm.user_id = auth.uid()
            and coalesce(gm.status, 'active') = 'active'
        )
      )
    )
    or
    -- 볼트 미팅 — project_members 의 lead/pm/member 만
    (
      meetings.project_id is not null
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = meetings.project_id
          and pm.user_id = auth.uid()
          and pm.role in ('lead','pm','member')
      )
    )
  );
