/**
 * Bolt 타입 가드 — 판별 유니온을 좁히는 헬퍼.
 *
 * 사용 예:
 *   const bolt = await getBolt(id);
 *   if (isAnchor(bolt)) {
 *     // bolt.anchor.monthly_revenue_goal_krw ← 타입 안전
 *   }
 */

import type {
  Bolt,
  BoltType,
  HexBolt,
  AnchorBolt,
  CarriageBolt,
  EyeBolt,
  WingBolt,
  TorqueBolt,
} from "./types";

export const isHex      = (b: Bolt | null | undefined): b is HexBolt      => !!b && b.type === "hex";
export const isAnchor   = (b: Bolt | null | undefined): b is AnchorBolt   => !!b && b.type === "anchor";
export const isCarriage = (b: Bolt | null | undefined): b is CarriageBolt => !!b && b.type === "carriage";
export const isEye      = (b: Bolt | null | undefined): b is EyeBolt      => !!b && b.type === "eye";
export const isWing     = (b: Bolt | null | undefined): b is WingBolt     => !!b && b.type === "wing";
export const isTorque   = (b: Bolt | null | undefined): b is TorqueBolt   => !!b && b.type === "torque";

/** 시간성이 있는(시작-종료) 유형인지 — Burndown 차트 등에 사용 */
export const hasDeadline = (b: Bolt | null | undefined): b is HexBolt | WingBolt =>
  isHex(b) || isWing(b);

/** 주기 지표 입력이 필요한 유형 */
export const hasMetricsCycle = (b: Bolt | null | undefined): b is AnchorBolt | CarriageBolt | WingBolt =>
  isAnchor(b) || isCarriage(b) || isWing(b);

/** 부모 포트폴리오가 될 수 있는 유형 */
export const canBeParent = (b: Bolt | null | undefined): b is EyeBolt =>
  isEye(b);

/** UI 라벨 비교 등에 쓰는 안전 캐스팅 */
export function asBoltType(value: string | null | undefined): BoltType {
  if (value === "anchor" || value === "carriage" || value === "eye" || value === "wing" || value === "torque") {
    return value;
  }
  return "hex";
}

export const ALL_BOLT_TYPES: BoltType[] = ["hex", "anchor", "carriage", "eye", "wing", "torque"];
