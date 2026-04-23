"use client";

/**
 * ChatDockPanel — 너트/볼트 상세 페이지의 도킹형 채팅 패널.
 *
 * 핵심: ChatRoomView 는 **항상 단일 인스턴스** 로 렌더해야 Realtime 채널이 중복 구독되지 않음.
 *
 * 동작:
 *  - 데스크탑(lg+): 우측 420px 고정 패널 (기본 열림, localStorage 복원)
 *  - 모바일(<lg): 플로팅 💬 버튼 → 카카오톡 스타일 전체화면 (100dvh)
 *  - viewport 는 mount 후 측정 (hydration mismatch 회피)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, X, ExternalLink, Loader2, ChevronLeft, ArrowLeft, Type, Settings } from "lucide-react";
import { ChatRoomView } from "./chat-room-view";
import { useChatFontSize, FONT_PX, FONT_LABEL, type ChatFontSize } from "@/lib/chat/chat-prefs";
import { acquireFullscreenLock } from "@/lib/chat/fullscreen-lock";

interface Props {
  projectId?: string;
  groupId?: string;
}

const OPEN_KEY = "nu_chat_dock_open";

export function ChatDockPanel({ projectId, groupId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [docked, setDocked] = useState<boolean>(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomMeta, setRoomMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useChatFontSize();

  useEffect(() => {
    setMounted(true);
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 외부에서 "nu:open-chat-dock" 이벤트로 이 패널 자동 open 요청
  // detail: { group_id?, project_id? } — 현재 맥락과 매칭되면 열기
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const matches =
        (detail.group_id && detail.group_id === groupId) ||
        (detail.project_id && detail.project_id === projectId);
      if (!matches) return;
      if (window.innerWidth >= 1024) setDocked(true);
      else setMobileOpen(true);
    };
    window.addEventListener("nu:open-chat-dock", onOpen);
    return () => window.removeEventListener("nu:open-chat-dock", onOpen);
  }, [groupId, projectId]);

  // URL 에 ?openChat=1 이 있으면 자동 open (리더 배지 클릭 플로우)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openChat") === "1") {
      if (window.innerWidth >= 1024) setDocked(true);
      else setMobileOpen(true);
      // URL 정리 (history 오염 방지)
      params.delete("openChat");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem(OPEN_KEY);
      if (v === "0") setDocked(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(OPEN_KEY, docked ? "1" : "0");
    } catch {}
    const apply = () => {
      if (isDesktop && docked) document.body.classList.add("has-chat-dock");
      else document.body.classList.remove("has-chat-dock");
    };
    apply();
    return () => document.body.classList.remove("has-chat-dock");
  }, [docked, isDesktop]);

  // 모바일 전체화면 열렸을 때 body 잠금 (ref-counting lock)
  useEffect(() => {
    const active = mounted && !isDesktop && mobileOpen;
    if (!active) return;
    const release = acquireFullscreenLock();
    return release;
  }, [mounted, isDesktop, mobileOpen]);

  // 방 확보
  useEffect(() => {
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
        if (!cancelled && data.room_id) {
          setRoomId(data.room_id);
          // 방 메타 병렬로 pre-fetch (헤더 타이틀 용)
          fetch(`/api/chat/rooms/${data.room_id}`, { cache: "no-store" })
            .then((r) => r.ok && r.json())
            .then((j) => {
              if (!cancelled && j?.room) setRoomMeta(j.room);
            })
            .catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, groupId]);

  const showPanel = mounted && (isDesktop ? docked : mobileOpen);

  const headerTitle =
    roomMeta?.type === "nut"
      ? `🥜 ${roomMeta?.group?.name || "너트"}`
      : roomMeta?.type === "bolt"
        ? `🔩 ${roomMeta?.project?.title || "볼트"}`
        : "채팅";

  const close = () => {
    if (isDesktop) setDocked(false);
    else setMobileOpen(false);
  };

  // 패널 바디 — 모바일은 자체 헤더 포함, 데스크탑은 컴팩트 헤더
  const panelBody = (
    <div
      className="flex flex-col h-full bg-white"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif',
      }}
    >
      {/* 헤더 — 모바일 전체화면은 크게, 데스크탑 도크는 작게 */}
      <header
        className={`flex items-center justify-between border-b border-nu-ink/10 bg-white shrink-0 ${
          isDesktop ? "px-3 py-2" : "px-2"
        }`}
        style={
          !isDesktop
            ? {
                height: "56px",
                paddingTop: "max(0px, env(safe-area-inset-top))",
                minHeight: "calc(56px + env(safe-area-inset-top))",
              }
            : undefined
        }
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {!isDesktop && (
            <button
              onClick={close}
              className="p-2.5 -ml-1 hover:bg-nu-ink/5 active:bg-nu-ink/10 rounded-full"
              aria-label="뒤로가기"
            >
              <ArrowLeft size={22} strokeWidth={2.2} />
            </button>
          )}
          <div className="min-w-0 flex-1 px-1">
            <div className={`truncate font-bold text-nu-ink ${isDesktop ? "text-[13px]" : "text-[17px] leading-tight"}`}>
              {headerTitle}
            </div>
            {!isDesktop && roomMeta && (
              <div className="text-[11px] text-nu-graphite leading-tight mt-0.5">
                {roomMeta?.type === "nut" ? "너트 채팅" : roomMeta?.type === "bolt" ? "볼트 채팅" : "채팅"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* 설정 버튼 — 글자 크기 */}
          <div className="relative">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-1.5 hover:bg-nu-ink/10 rounded-full"
              aria-label="채팅 설정"
            >
              <Settings size={15} className="text-nu-graphite" />
            </button>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSettings(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-nu-ink/15 rounded-xl shadow-lg p-3 min-w-[220px]">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest font-bold mb-2">
                    <Type size={11} /> 글자 크기
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(["small", "medium", "large", "xlarge"] as ChatFontSize[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFontSize(s)}
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
                </div>
              </>
            )}
          </div>
          {roomId && (
            <Link
              href={`/chat?room=${roomId}`}
              className="text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border border-nu-ink/20 rounded hover:bg-nu-ink hover:text-white inline-flex items-center gap-1 no-underline"
              title="전체 화면으로 보기"
            >
              <ExternalLink size={10} />
              <span className="hidden sm:inline">전체</span>
            </Link>
          )}
          {isDesktop && (
            <button onClick={close} className="p-1.5 hover:bg-nu-ink/10 rounded-full" aria-label="접기">
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* 바디 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && !roomId ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-nu-muted" />
          </div>
        ) : roomId ? (
          <ChatRoomView roomId={roomId} embedded fullHeight />
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-[13px] text-nu-graphite">
            채팅방을 열 수 없어요. 멤버 자격을 확인해주세요.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 모바일 플로팅 버튼 */}
      {mounted && !isDesktop && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-nu-pink text-white shadow-[3px_3px_0_0_rgba(13,13,13,0.3)] hover:-translate-y-0.5 transition-all flex items-center justify-center active:scale-95"
          aria-label="채팅 열기"
          style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          <MessageSquare size={22} />
        </button>
      )}

      {/* 데스크탑 접힘 상태 탭 */}
      {mounted && isDesktop && !docked && (
        <button
          onClick={() => setDocked(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 px-1.5 py-4 bg-nu-pink text-white rounded-l-lg shadow-md hover:px-2 transition-all"
          aria-label="채팅 패널 열기"
        >
          <ChevronLeft size={14} />
          <span
            className="font-mono-nu text-[9px] uppercase tracking-widest font-bold"
            style={{ writingMode: "vertical-rl" }}
          >
            채팅
          </span>
          <MessageSquare size={12} />
        </button>
      )}

      {/* 패널 — 데스크탑: 우측 고정 / 모바일: 전체화면 (nav 덮기 위해 z-[700]) */}
      {showPanel && (
        <aside
          className={
            isDesktop
              ? "fixed top-[60px] right-0 bottom-0 w-[420px] z-30 bg-white border-l-[2.5px] border-nu-ink shadow-xl flex flex-col"
              : "fixed inset-0 z-[700] bg-white flex flex-col"
          }
          style={!isDesktop ? { height: "100dvh" } : undefined}
        >
          {panelBody}
        </aside>
      )}

      {/* 본문 공간 확보 */}
      <style jsx global>{`
        @media (min-width: 1024px) {
          body.has-chat-dock {
            padding-right: 420px;
            transition: padding-right 0.2s ease;
          }
        }
      `}</style>
    </>
  );
}
