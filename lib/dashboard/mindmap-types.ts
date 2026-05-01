/**
 * Genesis 마인드맵 데이터 타입.
 * 서버에서 한 번에 모든 노드 데이터를 묶어 클라이언트로 전달.
 */

export type NodeKind =
  | "center"
  | "nut"
  | "bolt"
  | "schedule"
  | "issue"
  | "washer"     // 같은 너트·볼트의 동료 (인적 네트워크)
  | "topic"      // wiki 탭 (지식 네트워크)
  | "ai-role"    // Genesis 가 제안한 임시 역할 (washer 후보)
  | "ai-task";   // Genesis 가 제안한 임시 첫 액션

export interface MindMapNodeData {
  kind: NodeKind;
  /** 표시 제목 */
  title: string;
  /** 부제 (예: "5명", "마감 D-2") */
  subtitle?: string;
  /** 클릭 시 이동 — drawer 안의 "열기" 버튼에 사용 */
  href?: string;
  /** drawer 상세에 사용할 추가 메타 */
  meta?: Record<string, unknown>;
}

export interface MindMapData {
  nuts: Array<{ id: string; name: string; role: string; memberCount?: number }>;
  bolts: Array<{ id: string; title: string; status: string; daysLeft?: number }>;
  schedule: Array<{ id: string; title: string; at: string; source: "meeting" | "event" }>;
  issues: Array<{ id: string; title: string; kind: "overdue_task" | "mention" }>;
  /** 동료 — 같은 너트·볼트에 속한 다른 사용자. nutIds/boltIds 로 어디서 만났는지 표시 */
  washers: Array<{ id: string; nickname: string; avatar_url?: string | null; nutIds: string[]; boltIds: string[] }>;
  /** 위키 탭 — 너트별 지식 분류. groupId 로 소속 너트와 연결 */
  topics: Array<{ id: string; name: string; groupId: string }>;
}

export const NODE_COLORS: Record<NodeKind, { bg: string; border: string; ink: string; pulse: string }> = {
  center:   { bg: "bg-white",       border: "border-nu-ink",       ink: "text-nu-ink",       pulse: "ring-nu-ink" },
  nut:      { bg: "bg-nu-pink/10",  border: "border-nu-pink",      ink: "text-nu-pink",      pulse: "ring-nu-pink" },
  bolt:     { bg: "bg-nu-amber/10", border: "border-nu-amber",     ink: "text-nu-ink",       pulse: "ring-nu-amber" },
  schedule: { bg: "bg-emerald-100", border: "border-emerald-700",  ink: "text-emerald-900",  pulse: "ring-emerald-500" },
  issue:    { bg: "bg-red-100",     border: "border-red-700",      ink: "text-red-900",      pulse: "ring-red-500" },
  washer:   { bg: "bg-violet-100",  border: "border-violet-700",   ink: "text-violet-900",   pulse: "ring-violet-500" },
  topic:    { bg: "bg-sky-100",     border: "border-sky-700",      ink: "text-sky-900",      pulse: "ring-sky-500" },
  "ai-role":{ bg: "bg-yellow-100",  border: "border-yellow-600",   ink: "text-yellow-900",   pulse: "ring-yellow-500" },
  "ai-task":{ bg: "bg-orange-100",  border: "border-orange-600",   ink: "text-orange-900",   pulse: "ring-orange-500" },
};
