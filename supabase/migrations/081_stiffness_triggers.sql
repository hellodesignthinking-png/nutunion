-- 081: 강성(Stiffness) 이벤트 자동 기록 트리거
--
-- 이전에는 stiffness_events 를 수동 insert 했지만, 이제 DB 트리거로 자동화.
-- 대상 이벤트:
--   1. 마일스톤 완료 → +10
--   2. 볼트 마감(closure_summary 제출) → +25
--   3. 너트 합류 → +5 (본인)
--   4. 미팅 참석(event_checkins) → +3
--   5. 크루 포스트 작성 → +2
--   6. 탭 페이지 편집 → +3
--   7. 동료 리뷰 받음 → +5
--
-- 모든 트리거는 `exception when others` 로 방어 — 실패해도 본 작업은 성공.

-- ─── 1. 마일스톤 완료 ─────────────────────────────────
create or replace function public.stiffness_on_milestone_complete()
returns trigger language plpgsql security definer as $$
declare v_users uuid[];
begin
  if new.status = 'completed' and (old is null or old.status <> 'completed') then
    begin
      select array_agg(user_id) into v_users
      from public.project_members where project_id = new.project_id and user_id is not null;

      if v_users is not null then
        insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
        select u, 'milestone_complete', 10, 'project', new.project_id
        from unnest(v_users) as u;

        -- profiles.activity_score 동기화
        update public.profiles set activity_score = coalesce(activity_score, 0) + 10, updated_at = now()
        where id = any(v_users);
      end if;
    exception when others then raise notice 'stiffness milestone hook: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists stiffness_milestone_trigger on public.project_milestones;
create trigger stiffness_milestone_trigger
  after update on public.project_milestones
  for each row execute function public.stiffness_on_milestone_complete();

-- ─── 2. 볼트 마감 (closure_summary) ───────────────────
create or replace function public.stiffness_on_bolt_close()
returns trigger language plpgsql security definer as $$
declare v_users uuid[];
begin
  if new.status = 'completed' and new.closure_summary is not null
     and (old is null or old.status <> 'completed') then
    begin
      select array_agg(user_id) into v_users
      from public.project_members where project_id = new.id and user_id is not null;

      if v_users is not null then
        insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
        select u, 'bolt_close', 25, 'project', new.id from unnest(v_users) as u;

        update public.profiles set activity_score = coalesce(activity_score, 0) + 25, updated_at = now()
        where id = any(v_users);
      end if;
    exception when others then raise notice 'stiffness bolt_close hook: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists stiffness_bolt_close_trigger on public.projects;
create trigger stiffness_bolt_close_trigger
  after update on public.projects
  for each row execute function public.stiffness_on_bolt_close();

-- ─── 3. 너트 합류 ────────────────────────────────────
create or replace function public.stiffness_on_nut_join()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'active' and (old is null or old.status <> 'active') and new.user_id is not null then
    begin
      insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
      values (new.user_id, 'post_create', 5, 'group', new.group_id);

      update public.profiles set activity_score = coalesce(activity_score, 0) + 5, updated_at = now()
      where id = new.user_id;
    exception when others then raise notice 'stiffness nut_join hook: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists stiffness_nut_join_trigger on public.group_members;
create trigger stiffness_nut_join_trigger
  after insert or update on public.group_members
  for each row execute function public.stiffness_on_nut_join();

-- ─── 4. 미팅 참석 (event_checkins) ────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='event_checkins') then
    create or replace function public.stiffness_on_checkin()
    returns trigger language plpgsql security definer as $f$
    begin
      begin
        insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
        values (new.user_id, 'event_attend', 3, 'event', new.event_id);

        update public.profiles set activity_score = coalesce(activity_score, 0) + 3, updated_at = now()
        where id = new.user_id;
      exception when others then raise notice 'stiffness checkin hook: %', sqlerrm;
      end;
      return new;
    end $f$;

    drop trigger if exists stiffness_checkin_trigger on public.event_checkins;
    create trigger stiffness_checkin_trigger
      after insert on public.event_checkins
      for each row execute function public.stiffness_on_checkin();
  end if;
end $$;

-- ─── 5. 크루 포스트 작성 ─────────────────────────────
create or replace function public.stiffness_on_post()
returns trigger language plpgsql security definer as $$
begin
  if new.author_id is not null then
    begin
      insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
      values (new.author_id, 'post_create', 2, 'group', new.group_id);

      update public.profiles set activity_score = coalesce(activity_score, 0) + 2, updated_at = now()
      where id = new.author_id;
    exception when others then raise notice 'stiffness post hook: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists stiffness_post_trigger on public.crew_posts;
create trigger stiffness_post_trigger
  after insert on public.crew_posts
  for each row execute function public.stiffness_on_post();

-- ─── 6. 탭 편집 (bolt_taps.content_md 변경) ───────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='bolt_taps') then
    create or replace function public.stiffness_on_tap_edit()
    returns trigger language plpgsql security definer as $f$
    begin
      if new.last_edited_by is not null
         and (old is null or coalesce(old.content_md, '') <> coalesce(new.content_md, ''))
         and length(coalesce(new.content_md, '')) > 100 then  -- 100자 이상만 유효 기여
        begin
          insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
          values (new.last_edited_by, 'wiki_contribute', 3, 'project', new.project_id);

          update public.profiles set activity_score = coalesce(activity_score, 0) + 3, updated_at = now()
          where id = new.last_edited_by;
        exception when others then raise notice 'stiffness tap hook: %', sqlerrm;
        end;
      end if;
      return new;
    end $f$;

    drop trigger if exists stiffness_tap_trigger on public.bolt_taps;
    create trigger stiffness_tap_trigger
      after update on public.bolt_taps
      for each row execute function public.stiffness_on_tap_edit();
  end if;
end $$;

-- ─── 7. 리뷰 받음 (project_reviews.target_user_id) ────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_reviews') then
    create or replace function public.stiffness_on_review_received()
    returns trigger language plpgsql security definer as $f$
    begin
      begin
        insert into public.stiffness_events (user_id, event_type, points, source_type, source_id)
        values (new.target_user_id, 'endorsement_received', 5, 'project', new.project_id);

        update public.profiles set activity_score = coalesce(activity_score, 0) + 5, updated_at = now()
        where id = new.target_user_id;
      exception when others then raise notice 'stiffness review hook: %', sqlerrm;
      end;
      return new;
    end $f$;

    drop trigger if exists stiffness_review_trigger on public.project_reviews;
    create trigger stiffness_review_trigger
      after insert on public.project_reviews
      for each row execute function public.stiffness_on_review_received();
  end if;
end $$;

comment on schema public is 'Migration 081 — stiffness events auto-record via DB triggers';
