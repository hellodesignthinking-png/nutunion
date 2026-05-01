"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Activity {
  id: string;
  page_id: string | null;
  block_id: string | null;
  action: string;
  summary: string | null;
  created_at: string;
  actor_id: string | null;
  profiles: { nickname: string; avatar_url: string | null } | null;
}

interface Props {
  ownerType: "nut" | "bolt";
  ownerId: string;
  onJumpToPage: (pageId: string) => void;
}

const ACTION_ICON: Record<string, string> = {
  "page.created":   "📝",
  "page.updated":   "✏️",
  "page.deleted":   "🗑",
  "page.shared":    "🔗",
  "page.unshared":  "🔒",
  "block.created":  "➕",
  "block.updated":  "💬",
  "block.deleted":  "−",
};

const ACTION_LABEL: Record<string, string> = {
  "page.created":   "페이지 생성",
  "page.updated":   "페이지 수정",
  "page.deleted":   "페이지 삭제",
  "page.shared":    "공유 활성",
  "page.unshared":  "공유 해제",
  "block.created":  "블록 추가",
  "block.updated":  "블록 편집",
  "block.deleted":  "블록 삭제",
};

export function ActivityFeed({ ownerType, ownerId, onJumpToPage }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spaces/${ownerType}/${ownerId}/activity?limit=80`)
      .then((r) => r.json())
      .then((j: { activities: Activity[] }) => setActivities(j.activities ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [ownerType, ownerId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-2 text-[12px] text-nu-muted">
        <Loader2 size={12} className="animate-spin" /> 활동 로드 중…
      </div>
    );
  }
  if (activities.length === 0) {
    return <div className="px-2 py-2 text-[11px] text-nu-muted italic">활동 없음</div>;
  }

  return (
    <ul className="space-y-0.5">
      {activities.map((a) => (
        <li key={a.id} className="px-1.5 py-1 hover:bg-white">
          <button
            type="button"
            onClick={() => a.page_id && onJumpToPage(a.page_id)}
            disabled={!a.page_id}
            className="w-full text-left flex items-start gap-1.5"
          >
            <span className="text-[12px] mt-0.5">{ACTION_ICON[a.action] || "•"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-nu-ink truncate">
                <span className="font-bold">{a.profiles?.nickname || "익명"}</span>
                <span className="text-nu-muted"> · {ACTION_LABEL[a.action] || a.action}</span>
              </div>
              {a.summary && (
                <div className="text-[10px] text-nu-muted truncate">{a.summary}</div>
              )}
              <div className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">
                {timeAgo(a.created_at)}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}
