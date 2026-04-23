/**
 * Stiffness Rules — 볼트 유형별 기여 가중치 매트릭스.
 *
 * [현 상태] 스카폴드. 실제 강성 계산 트리거(migration 081) 는 Hex 기준으로만 작동 중.
 * [다음] 유형별 트리거를 DB 에 추가할 때 이 매트릭스를 참조 (단일 진실 원천).
 *
 * 참고 문서: R11 "Protocol Collective" 설계안 §5, §Part A.
 */

import type { BoltType } from "@/lib/bolt/types";

export type StiffnessAction =
  // 공통
  | "bolt_joined"
  | "bolt_created"
  | "tap_published"
  // Hex
  | "milestone_complete"
  | "retrospective_written"
  | "peer_review_given"
  | "bolt_closed"
  // Anchor
  | "daily_close_entered"
  | "weekly_pnl_written"
  | "monthly_goal_achieved"
  | "review_responded"
  | "incident_resolved"
  // Carriage
  | "release_deployed"
  | "bug_resolved"
  | "kpi_improved_10pct"
  | "documentation_updated"
  // Eye
  | "monthly_rollup_reviewed"
  | "cross_bolt_transfer_logged"
  // Wing
  | "wing_goal_achieved"
  | "campaign_retrospective"
  // Torque
  | "consulting_request_completed"
  | "deliverable_approved"
  | "risk_mitigated"
  | "decision_recorded"
  | "session_conducted";

/**
 * 가중치 매트릭스.
 * [볼트 유형][액션] → 포인트
 *
 * 0 또는 누락 = 그 유형에서는 해당 액션이 강성에 기여하지 않음.
 */
export const STIFFNESS_MATRIX: Record<BoltType, Partial<Record<StiffnessAction, number>>> = {
  hex: {
    bolt_joined: 5,
    milestone_complete: 10,
    retrospective_written: 5,
    peer_review_given: 3,
    tap_published: 5,
    bolt_closed: 25,
  },
  anchor: {
    bolt_joined: 5,
    daily_close_entered: 2,
    weekly_pnl_written: 8,
    monthly_goal_achieved: 15,
    review_responded: 3,
    incident_resolved: 5,
    tap_published: 5,
  },
  carriage: {
    bolt_joined: 5,
    release_deployed: 10,
    bug_resolved: 3,
    kpi_improved_10pct: 8,
    documentation_updated: 4,
    tap_published: 5,
  },
  eye: {
    bolt_joined: 5,
    monthly_rollup_reviewed: 10,
    cross_bolt_transfer_logged: 5,
  },
  wing: {
    bolt_joined: 5,
    wing_goal_achieved: 20,
    campaign_retrospective: 5,
    tap_published: 3,
  },
  torque: {
    bolt_joined: 5,
    consulting_request_completed: 8,
    deliverable_approved: 12,
    risk_mitigated: 6,
    decision_recorded: 4,
    session_conducted: 10,
    tap_published: 5,
  },
};

/**
 * 특정 볼트 유형 · 액션 쌍의 가중치.
 * 매트릭스에 없으면 0.
 */
export function stiffnessDelta(type: BoltType, action: StiffnessAction): number {
  return STIFFNESS_MATRIX[type]?.[action] ?? 0;
}

/**
 * 공개 산식 문자열 — /stiffness 페이지 투명화용.
 */
export function renderFormula(type: BoltType): string {
  const rules = STIFFNESS_MATRIX[type];
  if (!rules) return "";
  return Object.entries(rules)
    .map(([action, weight]) => `${action}×${weight}`)
    .join(" + ");
}

/**
 * UI 라벨 매핑 — 액션 코드 → 한국어.
 */
export const ACTION_LABELS: Record<StiffnessAction, string> = {
  bolt_joined: "볼트 합류",
  bolt_created: "볼트 생성",
  tap_published: "탭 발행",
  milestone_complete: "마일스톤 완료",
  retrospective_written: "회고 작성",
  peer_review_given: "피어 리뷰",
  bolt_closed: "볼트 마감",
  daily_close_entered: "일일 마감 입력",
  weekly_pnl_written: "주간 P&L 작성",
  monthly_goal_achieved: "월간 목표 달성",
  review_responded: "리뷰 응대",
  incident_resolved: "이슈 해결",
  release_deployed: "릴리스 배포",
  bug_resolved: "버그 수정",
  kpi_improved_10pct: "KPI 10% 개선",
  documentation_updated: "문서 업데이트",
  monthly_rollup_reviewed: "월간 롤업 리뷰",
  cross_bolt_transfer_logged: "자금 이동 기록",
  wing_goal_achieved: "캠페인 목표 달성",
  campaign_retrospective: "캠페인 회고",
  consulting_request_completed: "컨설팅 요청 완료",
  deliverable_approved: "산출물 승인",
  risk_mitigated: "리스크 완화",
  decision_recorded: "의사결정 기록",
  session_conducted: "컨설팅 세션 진행",
};
