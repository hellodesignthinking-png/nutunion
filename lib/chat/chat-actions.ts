/**
 * lib/chat/chat-actions — 채팅 시스템 메시지에 액션 페이로드 인코딩/디코딩.
 *
 * DB 마이그레이션 없이 `chat_messages.content` 에 magic prefix 로 payload 저장.
 * MsgBubble 에서 이 prefix 감지 시 인터랙티브 액션 카드 렌더.
 *
 * 지원 액션 타입:
 *  - join_request: 너트 가입 신청 → 호스트 승인/거절
 *  - project_application: 볼트 지원서 → 리더 승인/거절
 *  - payment_pending: 결제 승인 대기
 *  - (확장)
 */

export const ACTION_PREFIX = "__NU_ACTION__";

export interface JoinRequestAction {
  type: "join_request";
  group_id: string;
  applicant_id: string;
  applicant_nick: string;
  /** 호스트만 버튼 노출 */
  host_id: string;
}

export interface ProjectApplicationAction {
  type: "project_application";
  project_id: string;
  applicant_id: string;
  applicant_nick: string;
  lead_id: string;
}

export interface PaymentPendingAction {
  type: "payment_pending";
  project_id?: string;
  group_id?: string;
  settlement_id: string;
  amount: number;
  currency: string;
  requester_nick: string;
  receipt_url?: string | null;
  receipt_mime?: string | null;
  memo?: string | null;
}

export type AnnouncementSeverity = "info" | "warning" | "urgent";

export interface AnnouncementAction {
  type: "announcement";
  pinned?: boolean;
  severity?: AnnouncementSeverity;
  author_nick?: string;
}

export interface PollAction {
  type: "poll";
  poll_id?: string;
  question: string;
  options: string[];
  author_nick?: string;
}

export type ChatAction =
  | JoinRequestAction
  | ProjectApplicationAction
  | PaymentPendingAction
  | AnnouncementAction
  | PollAction;

export function encodeAction(action: ChatAction, displayText?: string): string {
  const prefix = ACTION_PREFIX + JSON.stringify(action);
  return displayText ? `${prefix}\n${displayText}` : prefix;
}

/** content 에서 action + display text 분리. 아니면 null */
export function decodeAction(content: string | null | undefined): {
  action: ChatAction;
  displayText: string;
} | null {
  if (!content) return null;
  if (!content.startsWith(ACTION_PREFIX)) return null;
  try {
    const rest = content.slice(ACTION_PREFIX.length);
    // JSON 끝 감지 (문자열 balance 간단 스캔)
    let depth = 0;
    let jsonEnd = -1;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    if (jsonEnd < 0) return null;
    const json = rest.slice(0, jsonEnd);
    const displayText = rest.slice(jsonEnd).replace(/^\n+/, "").trim();
    const action = JSON.parse(json) as ChatAction;
    return { action, displayText };
  } catch {
    return null;
  }
}
