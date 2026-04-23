/**
 * meeting-schema.ts — team-meetings / consultant-meetings Thread 공통 데이터 타입.
 */

export type MeetingType = "weekly" | "biweekly" | "monthly" | "adhoc" | "session";
export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type ActionItemStatus = "open" | "in_progress" | "done" | "cancelled";
export type SessionType = "discovery" | "diagnosis" | "proposal" | "review" | "checkin";

export interface AgendaItem {
  id: string;
  topic: string;
  presenter_id?: string;
  duration_min?: number;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee_id?: string;
  due_date?: string;
  status: ActionItemStatus;
}

export interface Meeting {
  id: string;
  project_id: string;
  track: "team" | "consultant";       // 어느 트랙인지 구분
  title: string;
  meeting_type: MeetingType;
  session_type?: SessionType;         // consultant 트랙 전용
  scheduled_at: string;              // ISO datetime
  duration_minutes?: number;
  location?: string;
  attendee_ids: string[];
  status: MeetingStatus;
  agenda_items: AgendaItem[];
  notes?: string;                    // 마크다운 회의록
  action_items: ActionItem[];
  decisions: string[];
  recording_url?: string;
  shared_with_consultant?: boolean;  // team 트랙 전용 — 컨설턴트에게 공유 여부
  session_brief?: string;            // consultant 트랙 — 세션 브리프
  created_by: string;
  created_at: string;
}

export interface MeetingFormData {
  title: string;
  meeting_type: MeetingType;
  session_type?: SessionType;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  notes: string;
}

export const SESSION_TYPE_LABELS: Record<SessionType, { label: string; color: string }> = {
  discovery: { label: "발견",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  diagnosis: { label: "진단",   color: "bg-orange-100 text-orange-700 border-orange-200" },
  proposal:  { label: "제안",   color: "bg-purple-100 text-purple-700 border-purple-200" },
  review:    { label: "평가",   color: "bg-green-100 text-green-700 border-green-200" },
  checkin:   { label: "점검",   color: "bg-teal-100 text-teal-700 border-teal-200" },
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  weekly: "주간",
  biweekly: "격주",
  monthly: "월간",
  adhoc: "수시",
  session: "세션",
};

export const ACTION_STATUS_CONFIG: Record<ActionItemStatus, { label: string; color: string }> = {
  open:        { label: "미완",   color: "text-nu-graphite bg-nu-cream/50" },
  in_progress: { label: "진행중", color: "text-nu-amber bg-nu-amber/10" },
  done:        { label: "완료",   color: "text-green-700 bg-green-50" },
  cancelled:   { label: "취소",   color: "text-nu-muted bg-nu-cream/30" },
};
