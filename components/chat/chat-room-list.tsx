"use client";

import Image from "next/image";
import { Hash, Users, User, Paperclip, Mic } from "lucide-react";

interface Room {
  id: string;
  type: "dm" | "nut" | "bolt";
  name?: string | null;
  group?: { id: string; name: string; image_url?: string | null } | null;
  project?: { id: string; title: string; image_url?: string | null } | null;
  dm_peer?: { id: string; nickname: string; avatar_url?: string | null } | null;
  last_message?: {
    content?: string | null;
    attachment_type?: string | null;
    is_system?: boolean;
    sender?: { nickname?: string };
    created_at: string;
  } | null;
  unread_count?: number;
  last_message_at?: string;
}

interface Props {
  rooms: Room[];
  activeRoomId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function ChatRoomList({ rooms, activeRoomId, onSelect }: Props) {
  if (rooms.length === 0) {
    return (
      <div className="p-6 text-center text-[12px] text-nu-graphite">
        <p className="mb-2">아직 채팅방이 없어요</p>
        <p className="text-[11px] text-nu-muted">
          너트/볼트에 참여하면 자동으로 채팅방이 생성되고, 프로필 카드의 "메시지 보내기" 로 DM 을 시작할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-nu-ink/[0.05]">
      {rooms.map((r) => {
        const title =
          r.type === "dm"
            ? r.dm_peer?.nickname || "DM"
            : r.group?.name || r.project?.title || r.name || "채팅방";
        const image =
          r.type === "dm"
            ? r.dm_peer?.avatar_url
            : r.group?.image_url || r.project?.image_url || null;
        const Icon = r.type === "dm" ? User : r.type === "nut" ? Hash : Users;

        const lastMsg = r.last_message;
        const preview = lastMsg?.is_system
          ? `· ${lastMsg.content}`
          : lastMsg?.content
            ? lastMsg.content
            : lastMsg?.attachment_type === "image"
              ? "📷 사진"
              : lastMsg?.attachment_type === "audio"
                ? "🎙️ 녹음"
                : lastMsg?.attachment_type === "file"
                  ? "📎 파일"
                  : "";

        const time = lastMsg?.created_at
          ? formatTime(lastMsg.created_at)
          : r.last_message_at
            ? formatTime(r.last_message_at)
            : "";

        const active = r.id === activeRoomId;

        return (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full text-left flex items-start gap-3 p-3 transition-colors ${
                active ? "bg-nu-pink/10" : "hover:bg-nu-cream/30"
              }`}
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-nu-ink/5 flex items-center justify-center overflow-hidden">
                {image ? (
                  <Image src={image} alt={title} width={40} height={40} className="w-10 h-10 object-cover" />
                ) : (
                  <Icon size={16} className="text-nu-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <Icon size={10} className="text-nu-muted shrink-0" />
                    <span className="font-semibold text-[13px] text-nu-ink truncate">{title}</span>
                  </div>
                  {time && <span className="font-mono-nu text-[10px] text-nu-muted tabular-nums shrink-0">{time}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[12px] text-nu-graphite truncate">{preview}</span>
                  {(r.unread_count || 0) > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 bg-nu-pink text-white rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center">
                      {(r.unread_count || 0) > 99 ? "99+" : r.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return d.toLocaleDateString("ko", { weekday: "short" });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
