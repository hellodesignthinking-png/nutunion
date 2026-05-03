-- L14: 협업 OS 4 골조 — 자동화 + 커스텀 필드 + 회의→결정 추출 + 프로젝트 채팅
--
-- 의존: 152 (project_decisions, project_risks, project_share_links)
-- 목적: 단순 협업 도구 → 운영 플랫폼

-- ── 1) 자동화 룰 ──────────────────────────────────────────
-- IF (trigger + condition) THEN (action + config)
-- triggers : project.state_changed | task.overdue | milestone.due_soon |
--            risk.added.high | decision.added | file.uploaded
-- actions  : create_task | create_risk | notify | send_webhook
create table if not exists project_automation_rules (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  trigger       text not null check (trigger in (
    'project.state_changed','task.overdue','milestone.due_soon',
    'risk.added.high','decision.added','file.uploaded'
  )),
  condition     jsonb not null default '{}'::jsonb,                   -- 트리거 추가 조건
  action        text not null check (action in (
    'create_task','create_risk','notify','send_webhook'
  )),
  action_config jsonb not null default '{}'::jsonb,
  enabled       boolean not null default true,
  -- 같은 룰이 같은 대상에 반복 발동하지 않도록 cooldown (분 단위)
  cooldown_min  int not null default 1440,
  last_fired_at timestamptz,
  fire_count    int not null default 0,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists automation_rules_project_idx
  on project_automation_rules (project_id, enabled);

alter table project_automation_rules enable row level security;

drop policy if exists "automation_rules_select" on project_automation_rules;
create policy "automation_rules_select" on project_automation_rules
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_automation_rules.project_id
              and pm.user_id = auth.uid())
  );

drop policy if exists "automation_rules_write" on project_automation_rules;
create policy "automation_rules_write" on project_automation_rules
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_automation_rules.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_automation_rules.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  );

-- 자동화 실행 로그 — 감사 + 디버그
create table if not exists project_automation_runs (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references project_automation_rules(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  trigger_payload jsonb not null default '{}'::jsonb,
  status      text not null check (status in ('success','skipped','error')),
  result      jsonb not null default '{}'::jsonb,
  error_msg   text,
  ran_at      timestamptz not null default now()
);

create index if not exists automation_runs_rule_idx
  on project_automation_runs (rule_id, ran_at desc);

alter table project_automation_runs enable row level security;

drop policy if exists "automation_runs_select" on project_automation_runs;
create policy "automation_runs_select" on project_automation_runs
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_automation_runs.project_id
              and pm.user_id = auth.uid())
  );

-- ── 2) 커스텀 필드 정의 + 값 ──────────────────────────────
-- 프로젝트별 자유 필드. type 별 value_*, value_json 컬럼 분리해서 색인 가능.
create table if not exists project_field_defs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  key           text not null,                                         -- 'land_area_sqm' 같은 internal id
  label         text not null,                                         -- 사용자 표시명
  field_type    text not null check (field_type in (
    'text','number','currency','percent','date','select','multi_select','url','user'
  )),
  options       jsonb not null default '[]'::jsonb,                    -- select/multi_select 항목
  position      int not null default 0,
  is_required   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (project_id, key)
);

create index if not exists field_defs_project_idx
  on project_field_defs (project_id, position);

alter table project_field_defs enable row level security;

drop policy if exists "field_defs_select" on project_field_defs;
create policy "field_defs_select" on project_field_defs
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_defs.project_id
              and pm.user_id = auth.uid())
  );

drop policy if exists "field_defs_write" on project_field_defs;
create policy "field_defs_write" on project_field_defs
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_defs.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_defs.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm'))
  );

create table if not exists project_field_values (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  field_def_id uuid not null references project_field_defs(id) on delete cascade,
  value_text   text,
  value_number numeric,
  value_date   date,
  value_json   jsonb,
  updated_by   uuid references profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (project_id, field_def_id)
);

create index if not exists field_values_project_idx
  on project_field_values (project_id);

alter table project_field_values enable row level security;

drop policy if exists "field_values_select" on project_field_values;
create policy "field_values_select" on project_field_values
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_values.project_id
              and pm.user_id = auth.uid())
  );

drop policy if exists "field_values_write" on project_field_values;
create policy "field_values_write" on project_field_values
  for all using (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_values.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  ) with check (
    exists (select 1 from project_members pm
            where pm.project_id = project_field_values.project_id
              and pm.user_id = auth.uid()
              and pm.role in ('lead','pm','member'))
  );

-- ── 3) 프로젝트 채팅 채널 ────────────────────────────────
-- 가벼운 메시지 + 액션 변환 (→ task/decision/risk)
create table if not exists project_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  content      text not null,
  -- 메시지로부터 변환된 자식들 (task_id, decision_id, risk_id) 기록
  converted_to jsonb not null default '[]'::jsonb,
  attachment_url text,
  parent_id    uuid references project_chat_messages(id) on delete set null,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);

create index if not exists chat_messages_project_idx
  on project_chat_messages (project_id, created_at desc);

alter table project_chat_messages enable row level security;

drop policy if exists "chat_select" on project_chat_messages;
create policy "chat_select" on project_chat_messages
  for select using (
    exists (select 1 from project_members pm
            where pm.project_id = project_chat_messages.project_id
              and pm.user_id = auth.uid())
  );

drop policy if exists "chat_insert" on project_chat_messages;
create policy "chat_insert" on project_chat_messages
  for insert with check (
    author_id = auth.uid() and
    exists (select 1 from project_members pm
            where pm.project_id = project_chat_messages.project_id
              and pm.user_id = auth.uid())
  );

drop policy if exists "chat_update_own" on project_chat_messages;
create policy "chat_update_own" on project_chat_messages
  for update using (author_id = auth.uid());

drop policy if exists "chat_delete_own_or_lead" on project_chat_messages;
create policy "chat_delete_own_or_lead" on project_chat_messages
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from project_members pm
      where pm.project_id = project_chat_messages.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('lead','pm')
    )
  );

-- ── 4) 자동화 helper RPC — 룰 평가 시간 갱신 ────────────────
create or replace function project_automation_mark_fired(p_rule_id uuid)
returns void language plpgsql security definer as $$
begin
  update project_automation_rules
  set last_fired_at = now(), fire_count = fire_count + 1, updated_at = now()
  where id = p_rule_id;
end;
$$;

grant execute on function project_automation_mark_fired(uuid) to authenticated, service_role;
