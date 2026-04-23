-- 067: events / meetings INSERT/UPDATE/DELETE 권한 제한
-- 이전: authenticated 유저 누구나 group_id 만 세팅하면 insert 가능 → 권한 남용 가능
-- 현재: 그룹 host 또는 active member 만 쓰기 가능

-- ============================================
-- events: INSERT / UPDATE / DELETE — host or active member of group
-- ============================================
drop policy if exists "events_insert" on public.events;
drop policy if exists "events_update" on public.events;
drop policy if exists "events_delete" on public.events;

drop policy if exists "events_insert_host_or_member" on public.events;
create policy "events_insert_host_or_member"
  on public.events for insert
  with check (
    group_id is null
    or exists (
      select 1 from public.groups g
      where g.id = events.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = events.group_id
        and gm.user_id = auth.uid()
        and coalesce(gm.status, 'active') = 'active'
    )
  );

drop policy if exists "events_update_host_or_creator" on public.events;
create policy "events_update_host_or_creator"
  on public.events for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = events.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "events_delete_host_or_creator" on public.events;
create policy "events_delete_host_or_creator"
  on public.events for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = events.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================
-- meetings: host/member INSERT, organizer/host UPDATE/DELETE
-- ============================================
drop policy if exists "meetings_insert" on public.meetings;
drop policy if exists "meetings_update" on public.meetings;
drop policy if exists "meetings_delete" on public.meetings;

drop policy if exists "meetings_insert_host_or_member" on public.meetings;
create policy "meetings_insert_host_or_member"
  on public.meetings for insert
  with check (
    group_id is null
    or exists (
      select 1 from public.groups g
      where g.id = meetings.group_id and g.host_id = auth.uid()
    )
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = meetings.group_id
        and gm.user_id = auth.uid()
        and coalesce(gm.status, 'active') = 'active'
    )
  );

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
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================
-- 보조 인덱스 — 권한 체크 hot path
-- ============================================
create index if not exists groups_host_idx on public.groups (host_id);
create index if not exists group_members_user_active_idx
  on public.group_members (user_id, group_id)
  where coalesce(status, 'active') = 'active';

comment on schema public is 'RLS tightened (067) — events/meetings writes restricted to host/member';
