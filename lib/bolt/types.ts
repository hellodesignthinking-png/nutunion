/**
 * Bolt Polymorphism — 5가지 유형의 판별 유니온 타입.
 *
 * 실제 기계공학의 볼트(Hex/Anchor/Carriage/Eye/Wing) 이름을 차용.
 * 각 유형은 시간성·입력주기·KPI 축이 다름:
 *
 *  - hex       : 탐사형 (시작-종료 명확한 프로젝트)
 *  - anchor    : 공간형 (매장·카페, 일일 매출 입력)
 *  - carriage  : 플랫폼형 (디지털 서비스, DAU/Uptime/MRR)
 *  - eye       : 포트폴리오형 (여러 볼트를 묶는 부모)
 *  - wing      : 캠페인형 (단기 푸시, 1~4주)
 *  - torque     : 컨설팅형 (팀+컨설턴트 이중 트랙, 요청 큐, 공유 대시보드)
 *
 * DB: migration 084 참조, migration 116 (torque 추가).
 */

export type BoltType = "hex" | "anchor" | "carriage" | "eye" | "wing" | "torque";

export type BoltCategory = "space" | "culture" | "platform" | "vibe";

export type BoltStatus = "draft" | "active" | "completed" | "archived";

/**
 * 공통 베이스 — projects 테이블의 공통 컬럼.
 * 서브타입 필드는 각 인터페이스에서 확장.
 */
export interface BaseBolt {
  id: string;
  type: BoltType;
  title: string;
  description: string | null;
  status: BoltStatus;
  category: BoltCategory | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  parent_bolt_id: string | null;
}

/* -------- 1. Hex (탐사형) -------- */
export interface HexBolt extends BaseBolt {
  type: "hex";
  start_date: string | null;
  end_date: string | null;
  // 기존 projects 필드는 확장 시점에 그대로 유지됨.
  // milestone/task 는 별도 테이블 조회.
}

/* -------- 2. Anchor (공간형) -------- */
export interface AnchorFields {
  opened_at: string | null;
  address: string | null;
  floor_area_sqm: number | null;
  seat_count: number | null;
  operating_hours: Record<string, string>; // {"mon":"09:00-22:00",...}
  holidays: string[];                       // ["sun"] 또는 ISO 날짜
  monthly_revenue_goal_krw: number | null;
  monthly_margin_goal_pct: number | null;
}
export interface AnchorBolt extends BaseBolt {
  type: "anchor";
  anchor: AnchorFields;
}

/* -------- 3. Carriage (플랫폼형) -------- */
export interface CarriageIntegrations {
  posthog_project_id?: string;
  vercel_project_id?: string;
  sentry_dsn?: string;
  stripe_account?: string;
  [key: string]: string | undefined;
}
export interface CarriageFields {
  launched_at: string | null;
  domain: string | null;
  app_store_url: string | null;
  tech_stack: string[];
  dau_goal: number | null;
  mau_goal: number | null;
  mrr_goal_krw: number | null;
  integrations: CarriageIntegrations;
}
export interface CarriageBolt extends BaseBolt {
  type: "carriage";
  carriage: CarriageFields;
}

/* -------- 4. Eye (포트폴리오형) -------- */
export type EyeRollupRule = "sum" | "avg" | "weighted";
export interface EyeFields {
  rollup_rule: EyeRollupRule;
  weights: Record<string, number>; // rollup_rule='weighted' 일 때 {boltId: weight}
}
export interface EyeBolt extends BaseBolt {
  type: "eye";
  eye: EyeFields;
  // children 은 별도 쿼리: select * from projects where parent_bolt_id = :id
}

/* -------- 5. Wing (캠페인형) -------- */
export interface WingChannel {
  name: string;
  budget?: number;
  actual?: number;
}
export interface WingFields {
  goal_metric: string | null;  // "참석자", "매출", ...
  goal_value: number | null;
  actual_value: number;
  budget_krw: number | null;
  channels: WingChannel[];
  // start_date / end_date 는 BaseBolt 가 아니라 HexBolt 에만 있지만
  // Wing 도 기간이 필요 — projects.start_date / end_date 를 그대로 재사용
  start_date: string | null;
  end_date: string | null;
}
export interface WingBolt extends BaseBolt {
  type: "wing";
  wing: WingFields;
}

/* -------- 6. Torque (컨설팅형) -------- */
export type TorqueEngagementType = "one_time" | "retainer" | "hybrid";

export interface TorqueFields {
  engagement_type: TorqueEngagementType;
  started_at: string;                        // ISO date
  ended_at: string | null;                   // null = 무기한 리테이너
  scope_summary: string | null;              // 한 줄 스코프 요약
  retainer_monthly_hours: number | null;     // 월 계약 시간
  retainer_hourly_rate_krw: number | null;   // 시간당 단가 (원)
  consultant_user_ids: string[];             // 컨설턴트 user_id 배열
  client_team_user_ids: string[];            // 내부 팀 user_id 배열
}

export interface TorqueBolt extends BaseBolt {
  type: "torque";
  torque: TorqueFields;
}

/* -------- 유니온 -------- */
export type Bolt = HexBolt | AnchorBolt | CarriageBolt | EyeBolt | WingBolt | TorqueBolt;

/* -------- 주기 지표 (bolt_metrics) -------- */
export type MetricsPeriodType = "daily" | "weekly" | "monthly";

/** Anchor 일일 지표 예시 (공용 shape, 유형마다 키가 다름) */
export interface AnchorDailyMetrics {
  revenue?: { card?: number; cash?: number; delivery?: number };
  cost?: { food?: number; supplies?: number; labor?: number; rent?: number; other?: number };
  customers?: number;
  avg_ticket?: number; // 서버에서 자동 계산되기도
}

/** Carriage 일간/주간 지표 예시 */
export interface CarriageMetrics {
  dau?: number;
  mau?: number;
  uptime_pct?: number;
  errors?: number;
  releases?: number;
  mrr_krw?: number;
}

/** Wing 일일 지표 예시 */
export interface WingMetrics {
  attendance?: number;
  sales?: number;
  channel?: Record<string, number>; // {sns: 45, offline: 23, ...}
}

export interface BoltMetricRow {
  id: string;
  project_id: string;
  period_type: MetricsPeriodType;
  period_start: string; // YYYY-MM-DD
  metrics: AnchorDailyMetrics | CarriageMetrics | WingMetrics | Record<string, unknown>;
  memo: string | null;
  entered_by: string | null;
  entered_at: string;
  updated_at: string;
}
