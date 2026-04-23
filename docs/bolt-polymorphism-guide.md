# Bolt Polymorphism — 실행 가이드

Migration 084 적용 후, 새로운 유형의 볼트를 수동으로 생성하는 방법.

---

## 0. 전제 조건

1. `supabase/migrations/084_bolt_polymorphism.sql` 을 Supabase SQL Editor 에서 실행 완료
2. 검증 쿼리로 마이그레이션 성공 확인:

```sql
-- 기존 볼트가 모두 hex 로 백필됐는지
select type, count(*) from projects group by type;
-- 기대: hex | 5

-- 서브타입 테이블 존재 확인
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('project_anchor','project_carriage','project_eye','project_wing','bolt_metrics');
-- 기대: 5 rows
```

---

## 1. Anchor Bolt — FlagtaleSWR 카페

```sql
-- 1) 메인 레코드 (projects)
with new_bolt as (
  insert into projects (type, title, description, status, category, start_date, created_by)
  values (
    'anchor',
    'FlagtaleSWR 카페',
    '홍대 FlagtaleSWR 카페 매장 운영',
    'active',
    'space',
    '2025-11-01',   -- 오픈일과 별개로 볼트 생성일
    (select id from profiles where nickname = 'Taina' limit 1)
  )
  returning id
)
-- 2) 서브타입 필드 (project_anchor)
insert into project_anchor (
  project_id, opened_at, address, floor_area_sqm, seat_count,
  operating_hours, monthly_revenue_goal_krw, monthly_margin_goal_pct
)
select
  id,
  '2025-11-01',
  '서울특별시 마포구 와우산로 ...',
  45.5,
  22,
  '{"mon":"10:00-22:00","tue":"10:00-22:00","wed":"10:00-22:00","thu":"10:00-22:00","fri":"10:00-23:00","sat":"10:00-23:00","sun":"closed"}'::jsonb,
  15000000,
  20.0
from new_bolt;
```

## 2. Anchor Bolt — Flagtale 본점

```sql
with new_bolt as (
  insert into projects (type, title, description, status, category, start_date, created_by)
  values (
    'anchor',
    'Flagtale 본점',
    '제1호점 — 기존 운영 매장',
    'active',
    'space',
    '2024-07-15',
    (select id from profiles where nickname = 'Taina' limit 1)
  )
  returning id
)
insert into project_anchor (
  project_id, opened_at, address, monthly_revenue_goal_krw, monthly_margin_goal_pct
)
select id, '2024-07-15', '서울특별시 ...', 12000000, 18.0 from new_bolt;
```

## 3. Eye Bolt — Flagtale 홀딩 (2개 Anchor 의 부모)

```sql
-- 1) Eye 볼트 생성
with new_eye as (
  insert into projects (type, title, description, status, category, created_by)
  values (
    'eye',
    'Flagtale 홀딩',
    'Flagtale 본점 + FlagtaleSWR 카페 통합',
    'active',
    'space',
    (select id from profiles where nickname = 'Taina' limit 1)
  )
  returning id
)
insert into project_eye (project_id, rollup_rule)
select id, 'sum' from new_eye;

-- 2) 하위 2개 Anchor 를 이 Eye 의 자식으로 연결
update projects
set parent_bolt_id = (select id from projects where title = 'Flagtale 홀딩' limit 1)
where title in ('Flagtale 본점', 'FlagtaleSWR 카페');
```

## 4. Carriage Bolt — nutunion 플랫폼 자신

```sql
-- 기존 nutunion 볼트가 이미 있으면 업데이트로 전환
update projects set type = 'carriage' where title = 'nutunion';

insert into project_carriage (
  project_id, launched_at, domain, tech_stack, dau_goal, mau_goal
)
select
  id, '2025-12-01', 'nutunion.co.kr',
  array['Next.js 16','Supabase','Tailwind','TypeScript'],
  100, 500
from projects where title = 'nutunion'
on conflict (project_id) do nothing;
```

## 5. Wing Bolt — 예시 (북런칭 이벤트)

```sql
with new_wing as (
  insert into projects (type, title, description, status, category, start_date, end_date, created_by)
  values (
    'wing',
    '사람 도시 정책 북런칭',
    '북런칭 이벤트 1주 캠페인',
    'active',
    'culture',
    '2026-04-03',
    '2026-04-10',
    (select id from profiles where nickname = 'Taina' limit 1)
  )
  returning id
)
insert into project_wing (project_id, goal_metric, goal_value, budget_krw, channels)
select
  id, '참석자 수', 120, 500000,
  '[{"name":"SNS","budget":200000},{"name":"지인초대"},{"name":"오프라인","budget":100000}]'::jsonb
from new_wing;
```

---

## 6. Anchor 일일 마감 입력 (bolt_metrics)

```sql
-- FlagtaleSWR 오늘 마감
insert into bolt_metrics (project_id, period_type, period_start, metrics, memo, entered_by)
select
  id,
  'daily',
  current_date,
  jsonb_build_object(
    'revenue', jsonb_build_object('card', 350000, 'cash', 87000, 'delivery', 50000),
    'cost',    jsonb_build_object('food', 140000, 'supplies', 12000, 'labor', 110000),
    'customers', 59
  ),
  '오늘 단골 3명 방문, 신메뉴 반응 좋음',
  (select id from profiles where nickname = 'Taina' limit 1)
from projects where title = 'FlagtaleSWR 카페';
```

---

## 7. 검증

```sql
-- 유형별 볼트 개수
select type, count(*) from projects group by type order by type;

-- Flagtale 홀딩의 하위 볼트
select id, type, title from projects where parent_bolt_id =
  (select id from projects where title = 'Flagtale 홀딩');

-- 통합 뷰 테스트
select id, type, title, subtype from v_bolt_full where type != 'hex' limit 5;

-- bolt_metrics 최근 7일
select period_start, metrics->'revenue' as revenue, memo
from bolt_metrics
where project_id = (select id from projects where title = 'FlagtaleSWR 카페')
  and period_type = 'daily'
order by period_start desc
limit 7;
```

---

## 다음 단계 (Prompt 2~4)

이 수동 데이터가 확보되면:

- **Prompt 2** — Anchor Bolt 전용 UI (매장 운영 대시보드, 일일 입력 모달, 월간 차트)
- **Prompt 3** — Carriage/Eye/Wing UI + 생성 플로우 유형 선택
- **Prompt 4** — 유형별 강성 산식 (`lib/stiffness/rules.ts`) DB 트리거 연결, Operation Nut, Tap Mode 확장
