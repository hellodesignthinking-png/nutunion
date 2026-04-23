/**
 * lib/automation/palette — shared trigger + action palette.
 *
 * Source of truth for the Visual Rule Builder. Extends naturally from
 * `templates.ts` trigger_types / action types.
 */

export type TriggerSpec = {
  id: string;           // trigger_type (e.g. "meeting.completed")
  label: string;        // UI label
  icon: string;
  description: string;
  payload_hints: string[]; // variable names available in downstream action params
};

export type ActionSpec = {
  type: string;         // "ai_summary" etc.
  label: string;
  icon: string;
  description: string;
  default_params: Record<string, any>;
};

export const TRIGGERS: TriggerSpec[] = [
  {
    id: "meeting.completed",
    label: "회의 마감",
    icon: "🎙️",
    description: "미팅이 종료되었을 때",
    payload_hints: ["title", "participant_count", "meeting_id", "project_id"],
  },
  {
    id: "project.milestone_completed",
    label: "마일스톤 완료",
    icon: "🏁",
    description: "볼트 마일스톤이 완료되었을 때",
    payload_hints: ["milestone_name", "project_id"],
  },
  {
    id: "project.created",
    label: "볼트 생성",
    icon: "🚀",
    description: "새 볼트가 생성되었을 때",
    payload_hints: ["title", "project_id"],
  },
  {
    id: "group.member_joined",
    label: "너트 멤버 가입",
    icon: "👋",
    description: "너트에 신규 멤버가 가입했을 때",
    payload_hints: ["user_id", "group_id"],
  },
  {
    id: "chat.message_posted",
    label: "채팅 메시지",
    icon: "💬",
    description: "채팅방에 메시지가 게시되었을 때",
    payload_hints: ["text", "sender_id", "room_id"],
  },
  {
    id: "resource.uploaded",
    label: "자료 업로드",
    icon: "📎",
    description: "R2 자료가 업로드되었을 때",
    payload_hints: ["name", "url", "group_id", "project_id"],
  },
  {
    id: "schedule.daily_9am",
    label: "매일 오전 9시 (KST)",
    icon: "⏰",
    description: "정해진 시간마다 트리거",
    payload_hints: [],
  },
];

export const ACTIONS: ActionSpec[] = [
  {
    type: "ai_summary",
    label: "AI 요약",
    icon: "🧠",
    description: "AI 가 이벤트 내용을 요약하고 선택적으로 볼트 위키에 저장.",
    default_params: { save_to_wiki: true },
  },
  {
    type: "send_chat_message",
    label: "채팅 메시지 발송",
    icon: "💬",
    description: "너트/볼트 채팅방에 템플릿 메시지를 게시.",
    default_params: { template: "🔔 {title} 이벤트가 발생했어요." },
  },
  {
    type: "send_welcome_dm",
    label: "환영 DM",
    icon: "👋",
    description: "신규 멤버에게 환영 DM 을 발송.",
    default_params: { include_wiki_link: true },
  },
  {
    type: "send_overdue_reminder",
    label: "기한 초과 리마인더",
    icon: "⏳",
    description: "마감 지난 Task 담당자에게 리마인더.",
    default_params: {},
  },
  {
    type: "post_file_to_chat",
    label: "파일 채팅 공유",
    icon: "📎",
    description: "업로드된 파일을 연결된 채팅방에 공유.",
    default_params: {},
  },
  {
    type: "ai_suggest_talents",
    label: "AI 인재 추천",
    icon: "🎯",
    description: "AI 가 매칭 인재를 추천.",
    default_params: { top_n: 5 },
  },
  {
    type: "ai_sentiment_branch",
    label: "감정 분석 분기",
    icon: "🔍",
    description: "부정/긍정 감정 감지 시 알림.",
    default_params: { notify_on: "negative" },
  },
  {
    type: "webhook_notify",
    label: "외부 Webhook",
    icon: "🔔",
    description: "Slack / Discord / Kakao 등 외부로 알림.",
    default_params: { service: "discord", webhook_url: "", message: "🔔 {title}" },
  },
  {
    type: "grant_member_access",
    label: "자료 권한 부여",
    icon: "🔑",
    description: "신규 멤버에게 자료실 + Drive reader 권한 부여.",
    default_params: { include_drive: true },
  },
];

export function findTrigger(id: string) {
  return TRIGGERS.find((t) => t.id === id);
}
export function findAction(type: string) {
  return ACTIONS.find((a) => a.type === type);
}
