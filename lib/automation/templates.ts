/**
 * lib/automation/templates — Nut-mation pre-built rule library.
 *
 * Phase 1 ships 6 ready-to-activate templates.
 * Phase 2: drag-drop custom rule builder.
 */

export type AutomationTemplate = {
  id: string;
  category: string;
  name: string;
  description: string;
  icon: string;
  trigger_type: string;
  default_actions: { type: string; params: Record<string, any> }[];
  scope_required: "project" | "group" | "both" | "all";
  suggested_approval?: boolean;
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "ai_meeting_summary",
    category: "AI 비서",
    name: "AI 회의록 자동 요약",
    description: "회의가 마감되면 AI 가 자동으로 요약을 생성하고 볼트에 회의록 페이지를 추가합니다.",
    icon: "📋",
    trigger_type: "meeting.completed",
    default_actions: [{ type: "ai_summary", params: { save_to_wiki: true } }],
    scope_required: "project",
    suggested_approval: false,
  },
  {
    id: "milestone_complete_notify",
    category: "알림",
    name: "마일스톤 완료 시 팀 알림",
    description: "마일스톤이 완료되면 해당 볼트의 모든 멤버에게 축하 메시지를 채팅으로 발송.",
    icon: "🏁",
    trigger_type: "project.milestone_completed",
    default_actions: [
      { type: "send_chat_message", params: { template: "🏁 마일스톤 '{milestone_name}' 이 완료되었어요!" } },
    ],
    scope_required: "project",
  },
  {
    id: "new_member_welcome",
    category: "온보딩",
    name: "신규 멤버 환영 메시지",
    description: "너트에 신규 멤버가 가입하면 환영 DM 을 자동 발송합니다.",
    icon: "👋",
    trigger_type: "group.member_joined",
    default_actions: [{ type: "send_welcome_dm", params: { include_wiki_link: true } }],
    scope_required: "group",
  },
  {
    id: "overdue_task_reminder",
    category: "리마인드",
    name: "기한 초과 Task 리마인더",
    description: "마감일 지난 Task 담당자에게 매일 아침 9시(KST) 리마인더를 전송.",
    icon: "⏰",
    trigger_type: "schedule.daily_9am",
    default_actions: [{ type: "send_overdue_reminder", params: {} }],
    scope_required: "all",
  },
  {
    id: "r2_upload_chat_share",
    category: "협업",
    name: "새 자료 업로드 시 채팅 공유",
    description: "R2 에 새 파일이 올라오면 해당 너트/볼트 채팅방에 자동 공유.",
    icon: "📎",
    trigger_type: "resource.uploaded",
    default_actions: [{ type: "post_file_to_chat", params: {} }],
    scope_required: "both",
  },
  {
    id: "chat_sentiment_alert",
    category: "AI 분석",
    name: "부정적 감정 감지 시 관리자 알림",
    description: "채팅/회의 내용에 부정적 감정이 감지되면 호스트에게 알림.",
    icon: "🔍",
    trigger_type: "chat.message_posted",
    default_actions: [{ type: "ai_sentiment_branch", params: { notify_on: "negative" } }],
    scope_required: "group",
    suggested_approval: false,
  },
  {
    id: "external_notify",
    category: "외부 연동",
    name: "외부 Webhook 알림 (Slack/Discord/Kakao)",
    description: "주요 이벤트를 외부 메신저로 자동 알림.",
    icon: "🔔",
    trigger_type: "meeting.completed",
    default_actions: [{ type: "webhook_notify", params: { service: "discord", webhook_url: "" } }],
    scope_required: "all",
    suggested_approval: false,
  },
  {
    id: "grant_access_on_join",
    category: "온보딩",
    name: "가입 승인 시 자료 권한 자동 부여",
    description: "신규 멤버에게 너트 자료실 접근 + Google Drive 공유 폴더 reader 권한 자동 부여.",
    icon: "🔑",
    trigger_type: "group.member_joined",
    default_actions: [{ type: "grant_member_access", params: { include_drive: true } }],
    scope_required: "group",
    suggested_approval: false,
  },
  {
    id: "talent_match_new_project",
    category: "인재 매칭",
    name: "볼트 생성 시 인재 추천",
    description: "새 볼트가 생성되면 요구 스킬을 분석해 매칭되는 인재에게 참여 제안을 발송 (승인 필요).",
    icon: "🎯",
    trigger_type: "project.created",
    default_actions: [{ type: "ai_suggest_talents", params: { top_n: 5 } }],
    scope_required: "all",
    suggested_approval: true,
  },
];

export function findTemplate(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}
