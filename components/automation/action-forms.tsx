"use client";

/**
 * Per-action-type inline parameter forms for the custom rule builder.
 * Kept in one file for simplicity — each action is a small sub-component.
 */

type ActionInstance = { type: string; params: Record<string, any> };

export function ActionParamsForm({
  action,
  onChange,
}: {
  action: ActionInstance;
  onChange: (params: Record<string, any>) => void;
}) {
  const p = action.params || {};
  const set = (k: string, v: any) => onChange({ ...p, [k]: v });

  switch (action.type) {
    case "ai_summary":
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold">AI 요약 파라미터</p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!p.save_to_wiki}
              onChange={(e) => set("save_to_wiki", e.target.checked)}
            />
            볼트 위키에 저장
          </label>
        </div>
      );

    case "send_chat_message":
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold">메시지 템플릿</p>
          <textarea
            rows={3}
            value={p.template || ""}
            onChange={(e) => set("template", e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
            placeholder="🔔 {title} 이벤트"
          />
          <p className="text-[10px] text-nu-ink/50">
            {"{title}, {name}, {milestone_name} 등 변수 사용 가능"}
          </p>
        </div>
      );

    case "send_welcome_dm":
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!p.include_wiki_link}
              onChange={(e) => set("include_wiki_link", e.target.checked)}
            />
            위키 시작 가이드 링크 포함
          </label>
        </div>
      );

    case "send_overdue_reminder":
      return <p className="text-xs text-nu-ink/60">추가 설정 없음.</p>;

    case "post_file_to_chat":
      return <p className="text-xs text-nu-ink/60">자동으로 연결된 채팅방에 공유.</p>;

    case "ai_suggest_talents":
      return (
        <div className="space-y-2">
          <label className="block text-xs font-bold">상위 N명</label>
          <input
            type="number"
            min={1}
            max={20}
            value={p.top_n ?? 5}
            onChange={(e) => set("top_n", Number(e.target.value))}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
          />
        </div>
      );

    case "ai_sentiment_branch":
      return (
        <div className="space-y-2">
          <label className="block text-xs font-bold">알림 트리거</label>
          <select
            value={p.notify_on || "negative"}
            onChange={(e) => set("notify_on", e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
          >
            <option value="negative">부정적 감정</option>
            <option value="positive">긍정적 감정</option>
            <option value="any">모든 감정 변화</option>
          </select>
        </div>
      );

    case "webhook_notify":
      return (
        <div className="space-y-2">
          <label className="block text-xs font-bold">서비스</label>
          <select
            value={p.service || "discord"}
            onChange={(e) => set("service", e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
          >
            <option value="discord">Discord</option>
            <option value="slack">Slack</option>
            <option value="kakao">Kakao</option>
          </select>
          <label className="block text-xs font-bold">Webhook URL</label>
          <input
            type="url"
            value={p.webhook_url || ""}
            onChange={(e) => set("webhook_url", e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs font-mono"
            placeholder="https://..."
          />
          <label className="block text-xs font-bold">메시지</label>
          <input
            type="text"
            value={p.message || ""}
            onChange={(e) => set("message", e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink bg-white text-xs"
            placeholder="🔔 {title}"
          />
        </div>
      );

    case "grant_member_access":
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!p.include_drive}
              onChange={(e) => set("include_drive", e.target.checked)}
            />
            Google Drive reader 권한도 부여
          </label>
          <p className="text-[10px] text-nu-ink/50">
            호스트에 Google 연동이 있고, 너트에 Drive 폴더가 설정되어 있어야 합니다.
          </p>
        </div>
      );

    default:
      return (
        <p className="text-xs text-nu-ink/60">
          이 액션의 인라인 설정 폼이 아직 없어요. ({action.type})
        </p>
      );
  }
}
