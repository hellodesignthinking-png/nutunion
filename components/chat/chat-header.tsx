"use client";

/**
 * ChatHeader — 채팅방 상단 헤더 (카카오톡 스타일).
 *
 * 좌: 뒤로가기 / 중: 타이틀 + 접속자 / 우: 원본 링크 + 설정(폰트 크기).
 */

import Link from "next/link";
import { ArrowLeft, ExternalLink, Settings, Type, Users } from "lucide-react";
import { FONT_PX, FONT_LABEL, type ChatFontSize } from "@/lib/chat/chat-prefs";

interface PresenceUser {
  user_id: string;
  nickname?: string;
  avatar_url?: string | null;
}

export interface ChatHeaderProps {
  title: string;
  totalMembers: number;
  onlineUsers: PresenceUser[];
  resourceLink?: string | null;
  onBack?: () => void;
  fontSize: ChatFontSize;
  onChangeFontSize: (v: ChatFontSize) => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  /** 타이틀 클릭 시 — 참여자 시트 열기 */
  onOpenMembers?: () => void;
}

export function ChatHeader({
  title,
  totalMembers,
  onlineUsers,
  resourceLink,
  onBack,
  fontSize,
  onChangeFontSize,
  showSettings,
  onToggleSettings,
  onCloseSettings,
  onOpenMembers,
}: ChatHeaderProps) {
  return (
    <header
      className="flex items-center gap-1 px-2 border-b border-nu-ink/8 bg-white shrink-0 sticky top-0 z-10 chat-system-font"
      style={{
        height: "56px",
        paddingTop: "max(0px, env(safe-area-inset-top))",
        minHeight: "calc(56px + env(safe-area-inset-top))",
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="p-2.5 -ml-1 hover:bg-nu-ink/5 active:bg-nu-ink/10 rounded-full transition-colors"
          aria-label="뒤로가기"
        >
          <ArrowLeft size={22} className="text-nu-ink" strokeWidth={2.2} />
        </button>
      )}
      <button
        type="button"
        onClick={onOpenMembers}
        disabled={!onOpenMembers}
        className="flex-1 min-w-0 px-1 text-left hover:bg-nu-ink/5 rounded-md py-1 -my-1 transition-colors disabled:hover:bg-transparent"
        aria-label="참여자 목록 보기"
      >
        <div className="font-bold text-[17px] text-nu-ink truncate leading-tight flex items-center gap-1">
          <span className="truncate">{title}</span>
          {totalMembers > 0 && (
            <span className="text-[14px] text-nu-muted tabular-nums font-normal shrink-0">
              {totalMembers}
            </span>
          )}
          {onOpenMembers && <Users size={12} className="text-nu-muted shrink-0" />}
        </div>
        {onlineUsers.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-nu-graphite leading-tight mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="tabular-nums">접속 {onlineUsers.length}</span>
          </div>
        )}
      </button>

      {/* 접속자 아바타 스택 */}
      {onlineUsers.length > 0 && (
        <div className="flex -space-x-1.5 shrink-0 mr-1">
          {onlineUsers.slice(0, 4).map((u) => (
            <span
              key={u.user_id}
              className="w-6 h-6 rounded-full border-2 border-white bg-nu-ink/10 overflow-hidden inline-block"
              title={u.nickname}
            >
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt={u.nickname || ""} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] w-full h-full flex items-center justify-center text-nu-graphite font-semibold">
                  {(u.nickname || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          ))}
          {onlineUsers.length > 4 && (
            <span className="w-6 h-6 rounded-full border-2 border-white bg-nu-ink text-white text-[9px] font-bold flex items-center justify-center">
              +{onlineUsers.length - 4}
            </span>
          )}
        </div>
      )}

      {resourceLink && (
        <Link
          href={resourceLink}
          className="p-2.5 hover:bg-nu-ink/5 active:bg-nu-ink/10 rounded-full text-nu-graphite no-underline"
          title="원본 보기"
          aria-label="원본 페이지로 이동"
        >
          <ExternalLink size={20} strokeWidth={2} />
        </Link>
      )}

      <div className="relative shrink-0">
        <button
          onClick={onToggleSettings}
          className="p-2.5 hover:bg-nu-ink/5 active:bg-nu-ink/10 rounded-full"
          aria-label="채팅 설정"
          title="설정"
        >
          <Settings size={20} className="text-nu-graphite" strokeWidth={2} />
        </button>
        {showSettings && (
          <>
            <div className="fixed inset-0 z-20" onClick={onCloseSettings} />
            <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-nu-ink/15 rounded-xl shadow-lg p-3 min-w-[220px]">
              <div className="flex items-center gap-1.5 text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest font-bold mb-2">
                <Type size={11} /> 글자 크기
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(["small", "medium", "large", "xlarge"] as ChatFontSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => onChangeFontSize(s)}
                    className={`py-1.5 rounded-lg border transition-colors ${
                      fontSize === s
                        ? "border-nu-pink bg-nu-pink/10 text-nu-ink font-bold"
                        : "border-nu-ink/15 text-nu-graphite hover:bg-nu-ink/5"
                    }`}
                  >
                    <div style={{ fontSize: FONT_PX[s] + "px", lineHeight: 1 }}>가</div>
                    <div className="text-[9px] font-mono-nu text-nu-muted mt-0.5">{FONT_LABEL[s]}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-nu-ink/10">
                <p className="text-[10px] text-nu-muted leading-relaxed">
                  글자 크기는 내 기기에서만 적용돼요.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
