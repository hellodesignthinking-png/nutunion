-- L13: 볼트 → 협업 OS — 결정 로그 + 리스크 추적 + 4단 권한 외부 공유 + 접근 로그
--
-- 기존 시스템과의 관계
--   • space_activity_log (148): 페이지·블록 활동
--   • space_webhooks (149): 외부 발신
--   • activity_read_cursors (150): 미확인 추적
--   • project_modules (151): 자유 모듈
--   • L13 (152): 결정·리스크·외부 공유 — "프로젝트 OS" 핵심 골조

-- ── 1) 결정 로그 ──────────────────────────────────────────
-- "이번 프로젝트는 A안으로 진행" 같은 의사결정을 추적 가능한 형태로 영구 기록.
-- 출처(meeting_id / message_id / page_id) 를 포인터로 보관.
create table if not exists project_decisions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,                                -- 결정 한 줄 요약
  rationale     text,                                          -- 왜 그렇게 결정했는지 (선택)
  decided_at    timestamptz not null default now(),
  decided_by    uuid references profiles(id) on delete set null,
  status        text not null default 'active' check (status in ('active','reverted')),
  -- 출처 — 어디서 결정되었는지 (어느 하나만 있을 수도, 자유)
  source_kind   text check (source_kind in ('meeting','chat','page','manual')),
  source_id     uuid,
  -- 영향 범위 (선택) — 결정이 어떤 마일스톤/태스크에 영향을 주는지
  related_ids   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists project_decisions_project_idx
  on project_decisions (project_id, decided_at desc);
create index if not exists project_decisions_status_idx
  on project_decisions (project_id, status);

alter table project_decisions enable row level security;

drop policy if exists "decisions_select" on project_decisions;
create policy "decisions_select" on project_decisions
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_decisions.project_id and pm.user_id = auth.uid())
  );

drop policy if exists "decisions_write" on project_decisions;
create policy "decisions_write" on project_decisions
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_decisions.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_decisions.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  );

-- ── 2) 리스크 추적 ────────────────────────────────────────
-- 마감 임박, 권리분석 미완, 견적 초과 등 — manual + 향후 AI 자동 감지 둘 다.
create table if not exists project_risks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text,
  severity      text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status        text not null default 'open' check (status in ('open','mitigating','resolved','accepted')),
  owner_id      uuid references profiles(id) on delete set null,
  due_at        timestamptz,
  detected_by   text not null default 'manual' check (detected_by in ('manual','ai','rule')),
  source_kind   text,
  source_id     uuid,
  resolved_at   timestamptz,
  resolved_by   uuid references profiles(id) on delete set null,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists project_risks_project_idx
  on project_risks (project_id, severity, status);
create index if not exists project_risks_owner_idx
  on project_risks (owner_id, status);

alter table project_risks enable row level security;

drop policy if exists "risks_select" on project_risks;
create policy "risks_select" on project_risks
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_risks.project_id and pm.user_id = auth.uid())
  );

drop policy if exists "risks_write" on project_risks;
create policy "risks_write" on project_risks
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_risks.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_risks.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  );

create or replace function project_risks_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists project_risks_touch_trg on project_risks;
create trigger project_risks_touch_trg
  before update on project_risks
  for each row execute function project_risks_touch_updated_at();

-- ── 3) 외부 공유 링크 — 4단 권한 ──────────────────────────
-- 시공사·감정평가사·투자자 등에게 스코프된 뷰 제공.
create table if not exists project_share_links (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  token           text not null unique,                              -- URL 슬러그
  -- 권한 단계 — 점진적 권한 (높을수록 많이 가능)
  permission      text not null default 'view' check (permission in (
    'view',         -- 보기만
    'comment',      -- 보기 + 댓글
    'upload',       -- 보기 + 댓글 + 파일 업로드
    'edit_limited'  -- 보기 + 댓글 + 업로드 + 일부 영역 편집
  )),
  -- 노출 영역 — 무엇을 보여줄지
  show_overview   boolean not null default true,
  show_milestones boolean not null default true,
  show_files      boolean not null default false,
  show_meetings   boolean not null default false,
  show_finance    boolean not null default false,
  show_decisions  boolean not null default false,
  show_risks      boolean not null default false,
  -- 보안
  password_hash   text,                                              -- bcrypt/sha256 (선택)
  require_email   boolean not null default false,                    -- 이메일 인증 강제
  allow_download  boolean not null default true,
  -- 라이프사이클
  expires_at      timestamptz,
  revoked_at      timestamptz,
  -- 메타
  label           text,                                              -- "감정평가사 박○○", "투자자 미팅용" 등
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_viewed_at  timestamptz,
  view_count      int not null default 0
);

create index if not exists project_share_links_project_idx
  on project_share_links (project_id, created_at desc);
create unique index if not exists project_share_links_token_idx
  on project_share_links (token);

alter table project_share_links enable row level security;

-- Owner(프로젝트 lead/pm) 만 관리. 읽기는 공개 — token 으로 직접 조회는 RLS 우회 (service role) 필요.
drop policy if exists "share_links_owner" on project_share_links;
create policy "share_links_owner" on project_share_links
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_share_links.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_share_links.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  );

-- ── 4) 외부 공유 접근 로그 ────────────────────────────────
-- "누가 언제 무엇을 봤는지" — 감사 + 추적.
create table if not exists project_share_access_logs (
  id            uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references project_share_links(id) on delete cascade,
  -- 외부인 식별 (선택) — 이메일 인증 통과 시 채워짐
  visitor_email text,
  visitor_ip    text,
  user_agent    text,
  -- 행동
  action        text not null check (action in ('view','download','comment','upload')),
  target_kind   text,                                                -- 'page' | 'file' | 'milestone' 등
  target_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists share_logs_link_idx
  on project_share_access_logs (share_link_id, created_at desc);
create index if not exists share_logs_action_idx
  on project_share_access_logs (share_link_id, action);

alter table project_share_access_logs enable row level security;

drop policy if exists "share_logs_owner" on project_share_access_logs;
create policy "share_logs_owner" on project_share_access_logs
  for select using (
    exists (
      select 1 from project_share_links sl
      join project_members pm on pm.project_id = sl.project_id
      where sl.id = project_share_access_logs.share_link_id
        and pm.user_id = auth.uid()
        and pm.role in ('lead','pm')
    )
  );

-- view_count 증가 RPC — 동시성 안전
create or replace function increment_share_view_count(link_id uuid)
returns void language plpgsql security definer as $$
begin
  update project_share_links
  set view_count = view_count + 1,
      last_viewed_at = now()
  where id = link_id;
end;
$$;

grant execute on function increment_share_view_count(uuid) to anon, authenticated;

-- ── 5) AI PM 브리핑 캐시 ──────────────────────────────────
-- 같은 프로젝트의 같은 날 PM 브리핑은 24h 캐시.
create table if not exists project_pm_briefings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  brief_date  date not null,
  buckets     jsonb not null default '{}'::jsonb,                    -- { todays, risks, blocked, decisions, next }
  model_used  text,
  created_at  timestamptz not null default now(),
  unique (project_id, user_id, brief_date)
);

create index if not exists pm_briefings_idx
  on project_pm_briefings (user_id, brief_date desc);

alter table project_pm_briefings enable row level security;

drop policy if exists "pm_briefings_own" on project_pm_briefings;
create policy "pm_briefings_own" on project_pm_briefings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
