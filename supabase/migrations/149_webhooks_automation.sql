-- L10: 외부 통합 / Webhook / 워크플로우 자동화

-- ── space_webhooks ─────────────────────────────────────────────────
-- 너트/볼트 안에서 활동 발생 시 외부 URL 로 POST.
-- name 은 표시용 (예: "마케팅 슬랙"). secret 은 HMAC 서명용 (수신측 검증).

create table if not exists space_webhooks (
  id          uuid primary key default gen_random_uuid(),
  owner_type  text not null check (owner_type in ('nut','bolt')),
  owner_id    uuid not null,
  name        text not null default 'Untitled',
  url         text not null,
  secret      text,                         -- HMAC SHA-256 키
  -- 어떤 이벤트에 발사할지. activity_log 의 action 과 동일 형식.
  events      text[] not null default array[
    'page.created','page.shared','block.created'
  ]::text[],
  preset      text check (preset in ('slack','discord','generic')) default 'generic',
  enabled     boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- 마지막 발송 결과
  last_called_at  timestamptz,
  last_status     int,
  last_error      text
);

create index if not exists space_webhooks_owner_idx
  on space_webhooks (owner_type, owner_id, enabled);

alter table space_webhooks enable row level security;

-- read/write: admin (host/lead) 만 — 외부 URL 노출은 권한 있는 자만
drop policy if exists "webhooks_select" on space_webhooks;
create policy "webhooks_select" on space_webhooks
  for select using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'host'
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'lead'
    ))
  );

drop policy if exists "webhooks_insert" on space_webhooks;
create policy "webhooks_insert" on space_webhooks
  for insert with check (
    created_by = auth.uid()
    and (
      (owner_type = 'nut' and exists (
        select 1 from group_members
        where group_id = space_webhooks.owner_id
          and user_id = auth.uid()
          and role = 'host'
          and status = 'active'
      ))
      or
      (owner_type = 'bolt' and exists (
        select 1 from project_members
        where project_id = space_webhooks.owner_id
          and user_id = auth.uid()
          and role = 'lead'
      ))
    )
  );

drop policy if exists "webhooks_update" on space_webhooks;
create policy "webhooks_update" on space_webhooks
  for update using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'host'
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'lead'
    ))
  );

drop policy if exists "webhooks_delete" on space_webhooks;
create policy "webhooks_delete" on space_webhooks
  for delete using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'host'
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_webhooks.owner_id
        and user_id = auth.uid()
        and role = 'lead'
    ))
  );

-- ── space_webhook_deliveries ──────────────────────────────────────
-- 발송 이력 (감사용). 최근 100건만 유지하는 cron 가 향후 가능.

create table if not exists space_webhook_deliveries (
  id          uuid primary key default gen_random_uuid(),
  webhook_id  uuid not null references space_webhooks(id) on delete cascade,
  event       text not null,
  payload     jsonb not null,
  status      int,
  response    text,
  duration_ms int,
  created_at  timestamptz not null default now()
);

create index if not exists webhook_deliveries_webhook_idx
  on space_webhook_deliveries (webhook_id, created_at desc);

alter table space_webhook_deliveries enable row level security;

-- 발송 이력 read 는 webhook 의 오너 admin 만
drop policy if exists "webhook_deliveries_select" on space_webhook_deliveries;
create policy "webhook_deliveries_select" on space_webhook_deliveries
  for select using (
    exists (
      select 1 from space_webhooks
      where id = space_webhook_deliveries.webhook_id
    )
  );

-- ── space_automation_rules ────────────────────────────────────────
-- 워크플로우: 트리거 + 조건 + 액션. 단순 버전 (조건은 future).
-- 액션은 webhook 으로 매핑되거나, "create_page" / "send_notification" 등 내장.

create table if not exists space_automation_rules (
  id          uuid primary key default gen_random_uuid(),
  owner_type  text not null check (owner_type in ('nut','bolt')),
  owner_id    uuid not null,
  name        text not null default 'Untitled rule',
  trigger_event text not null,                 -- e.g. "page.shared"
  conditions  jsonb not null default '{}'::jsonb,  -- 향후 확장 (작성자 / 키워드 등)
  action_type text not null check (action_type in (
    'webhook','notification','append_block','assign_label'
  )),
  action_config jsonb not null default '{}'::jsonb,  -- 액션별 설정
  enabled     boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists automation_rules_owner_idx
  on space_automation_rules (owner_type, owner_id, trigger_event, enabled);

alter table space_automation_rules enable row level security;

drop policy if exists "automation_rules_admin_all" on space_automation_rules;
create policy "automation_rules_admin_all" on space_automation_rules
  for all using (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_automation_rules.owner_id
        and user_id = auth.uid()
        and role = 'host'
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_automation_rules.owner_id
        and user_id = auth.uid()
        and role = 'lead'
    ))
  )
  with check (
    (owner_type = 'nut' and exists (
      select 1 from group_members
      where group_id = space_automation_rules.owner_id
        and user_id = auth.uid()
        and role = 'host'
        and status = 'active'
    ))
    or
    (owner_type = 'bolt' and exists (
      select 1 from project_members
      where project_id = space_automation_rules.owner_id
        and user_id = auth.uid()
        and role = 'lead'
    ))
  );
