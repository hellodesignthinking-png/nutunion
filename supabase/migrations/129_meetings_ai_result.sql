-- 129_meetings_ai_result.sql
-- AI 회의록 구조화 결과 + 다음 회의 안건 영구 저장
-- Foundation for the meeting archive timeline (group/project home).

alter table meetings
  add column if not exists ai_result jsonb;

alter table meetings
  add column if not exists next_topics jsonb;

-- 인덱스: 아카이브 타임라인은 최근 회의를 자주 조회 (group_id + status + scheduled_at)
create index if not exists meetings_archive_idx
  on meetings (group_id, status, scheduled_at desc);
