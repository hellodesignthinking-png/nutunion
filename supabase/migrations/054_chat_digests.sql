-- ============================================================
-- 054_chat_digests.sql
-- 오픈카톡 등 대화 로그를 AI 로 요약해 저장하는 디지스트 테이블
--
-- 연결:
--   · volt (projects.id) 또는
--   · nut  (profiles.id) 또는
--   · group (groups.id)
--
-- 용도: 회의록 / 토론 정리 / 주요 결정사항 추출
-- ============================================================

create table if not exists public.chat_digests (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('project', 'member', 'group')),
  entity_id       uuid not null,
  title           text not null check (length(trim(title)) > 0),
  chat_date       date,                               -- 대화 일자 (선택)
  source          text not null default 'kakao'       -- 'kakao' | 'slack' | 'manual' | 'other'
                  check (source in ('kakao','slack','manual','other')),
  raw_chat        text,                               -- 원본 대화 (선택 백업)
  summary         text not null,                      -- AI 전체 요약
  topics          jsonb not null default '[]'::jsonb, -- [{title, summary}]
  decisions       jsonb not null default '[]'::jsonb, -- [string]
  action_items    jsonb not null default '[]'::jsonb, -- [{assignee, task, due}]
  participants    jsonb not null default '[]'::jsonb, -- [string]
  tone            text,                               -- 분위기 한 줄
  model           text,                               -- 사용 모델 (예: anthropic/claude-sonnet-4.5)
  input_tokens    int default 0,
  output_tokens   int default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists chat_digests_entity_idx
  on public.chat_digests (entity_type, entity_id, created_at desc);
create index if not exists chat_digests_creator_idx
  on public.chat_digests (created_by, created_at desc);
create index if not exists chat_digests_chat_date_idx
  on public.chat_digests (chat_date desc);

comment on table public.chat_digests is
  '오픈카톡/Slack 등 대화 로그를 AI 로 회의록/토론 정리로 변환한 기록';

-- updated_at 자동 갱신
create or replace function public.touch_chat_digests_updated_at()
returns trigger language plpgsql as $trg$
begin
  new.updated_at = now();
  return new;
end
$trg$;

drop trigger if exists chat_digests_touch on public.chat_digests;
create trigger chat_digests_touch
  before update on public.chat_digests
  for each row execute function public.touch_chat_digests_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.chat_digests enable row level security;

-- SELECT — 1) admin/staff 전체, 2) project 멤버, 3) 본인 프로필 관련, 4) 작성자
drop policy if exists "chat_digests_select" on public.chat_digests;
create policy "chat_digests_select" on public.chat_digests
  for select
  using (
    -- admin/staff 전체 조회
    exists (select 1 from public.profiles p
            where p.id::text = auth.uid()::text
              and p.role in ('admin','staff'))
    -- 작성자 본인
    or created_by::text = auth.uid()::text
    -- member 엔터티가 본인일 때
    or (entity_type = 'member' and entity_id::text = auth.uid()::text)
    -- project 멤버
    or (entity_type = 'project' and exists (
          select 1 from public.project_members pm
          where pm.project_id = chat_digests.entity_id
            and pm.user_id::text = auth.uid()::text
       ))
  );

-- INSERT — 인증 사용자. entity 검증은 앱 계층에서 수행
drop policy if exists "chat_digests_insert" on public.chat_digests;
create policy "chat_digests_insert" on public.chat_digests
  for insert
  with check (
    auth.uid() is not null
    and (created_by is null or created_by::text = auth.uid()::text)
  );

-- UPDATE — 작성자 또는 admin/staff
drop policy if exists "chat_digests_update" on public.chat_digests;
create policy "chat_digests_update" on public.chat_digests
  for update
  using (
    created_by::text = auth.uid()::text
    or exists (select 1 from public.profiles p
               where p.id::text = auth.uid()::text
                 and p.role in ('admin','staff'))
  );

-- DELETE — 작성자 또는 admin
drop policy if exists "chat_digests_delete" on public.chat_digests;
create policy "chat_digests_delete" on public.chat_digests
  for delete
  using (
    created_by::text = auth.uid()::text
    or exists (select 1 from public.profiles p
               where p.id::text = auth.uid()::text
                 and p.role = 'admin')
  );
