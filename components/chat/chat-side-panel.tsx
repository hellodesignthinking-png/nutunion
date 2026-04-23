"use client";

/**
 * ChatSidePanel — 너트/볼트 상세 페이지에서 우측에 슬라이드인되는 채팅 패널.
 *
 * - 버튼 클릭 시 우측에서 열림 (부드러운 애니메이션)
 * - 데스크탑: 420px 고정폭, 오른쪽 가장자리에 붙음
 * - 모바일: 전체 화면 오버레이
 * - ESC 로 닫기, 바깥 영역 클릭으로 닫기
 * - 패널 내부에 ChatRoomView 임베드 (Realtime + 첨부 업로드 그대로)
 *
 * 사용:
 *   <ChatSidePanel groupId={id}/>   // 너트
 *   <ChatSidePanel projectId={id}/> // 볼트
 */

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { ChatRoomView } from "./chat-room-view";

interface Props {
  projectId?: string;
  groupId?: string;
}

export function ChatSidePanel({ projectId, groupId }: Props) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 방 확보 — 패널이 열릴 때 최초 1회
  useEffect(() => {
    if (!open || roomId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const body: any = {};
        if (projectId) body.project_id = projectId;
        else if (groupId) body.group_id = groupId;
        const res = await fetch("/api/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!cancelled && data.room_id) setRoomId(data.room_id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, groupId, roomId]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* 플로팅 토글 버튼 — 항상 우하단 */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-[45] w-14 h-14 rounded-full bg-nu-pink text-white shadow-[3px_3px_0_0_rgba(13,13,13,0.3)] hover:shadow-[4px_4px_0_0_rgba(13,13,13,0.4)] hover:-translate-y-0.5 transition-all flex items-center justify-center md:bottom-8 md:right-8 ${
          open ? "hidden" : "flex"
        }`}
        aria-label="채팅 사이드 패널 열기"
        title="채팅방"
      >
        <MessageSquare size={22} />
      </button>

      {/* 오버레이 */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[48] bg-black/20 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      {/* 패널 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="채팅 사이드 패널"
        className={`fixed top-0 right-0 bottom-0 z-[49] w-full sm:w-[420px] bg-white border-l-[2.5px] border-nu-ink shadow-2xl transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-ink font-bold">
              Chat · Realtime
            </span>
          </div>
          <div className="flex items-center gap-1">
            {roomId && (
              <Link
                href={`/chat?room=${roomId}`}
                className="text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border border-nu-ink/20 rounded hover:bg-nu-ink hover:text-white inline-flex items-center gap-1 no-underline"
                title="전체 화면으로 열기"
              >
                <ExternalLink size={10} /> 전체화면
              </Link>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-nu-ink/10 rounded"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {loading && !roomId ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-nu-muted" />
            </div>
          ) : roomId ? (
            <ChatRoomView roomId={roomId} />
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-center text-[12px] text-nu-graphite">
              채팅방을 열 수 없어요. 멤버인지 확인해주세요.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
