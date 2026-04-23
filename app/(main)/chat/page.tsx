"use client";

/**
 * /chat — 카카오톡 스타일 채팅 홈.
 *
 * 모바일 UX:
 *  - 초기 진입: 항상 방 목록 (자동 선택 X)
 *  - 방 탭 → 전체화면 상세 (100dvh)
 *  - 상세 뒤로가기 → 목록 복귀
 *  - 타이틀/탭/새DM 은 모바일에서도 상단에 노출
 *
 * 데스크탑 UX:
 *  - 좌 320px 목록 + 우측 상세 2-pane
 *  - 자동으로 첫 방 선택
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatRoomList } from "@/components/chat/chat-room-list";
import { ChatRoomView } from "@/components/chat/chat-room-view";
import { NewDMModal } from "@/components/chat/new-dm-modal";
import { MessageSquare, Hash, Users, User, Globe, UserPlus } from "lucide-react";
import { acquireFullscreenLock } from "@/lib/chat/fullscreen-lock";

type Tab = "all" | "nut" | "bolt" | "dm";

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-6"><div className="h-[500px] bg-nu-ink/5 animate-pulse rounded-lg" /></div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const params = useSearchParams();
  const initialRoom = params.get("room");
  const [tab, setTab] = useState<Tab>("all");
  const [activeRoom, setActiveRoom] = useState<string | null>(initialRoom);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [newDMOpen, setNewDMOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 판별
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 방 목록 로드
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/chat/rooms", { cache: "no-store" });
      const json = await res.json();
      setRooms(json.rooms || []);
      // 데스크탑에서만 첫 방 자동 선택 (모바일은 목록 먼저 보여주기)
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        if (!activeRoom && json.rooms?.[0]) setActiveRoom(json.rooms[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    if (initialRoom) setActiveRoom(initialRoom);
  }, [initialRoom]);

  // 모바일 전체화면 모드 — ref-counting lock 사용 (이중 관리/라우터 이동 시 자동 해제)
  useEffect(() => {
    if (!isMobile) return;
    const release = acquireFullscreenLock();
    return release;
  }, [isMobile]);

  // 안드로이드 하드웨어 back 버튼 — 방 상세에서 뒤로 제스처 시 방 목록으로만 이동
  // (그리고 그 뒤 한 번 더 누르면 페이지 이탈)
  useEffect(() => {
    if (!isMobile || !activeRoom) return;
    // 방 진입 시 history 에 stub 엔트리 push
    window.history.pushState({ chatRoom: activeRoom }, "");
    const onPop = () => {
      setActiveRoom(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [isMobile, activeRoom]);

  // 탭별 개수 + 미읽음 합계
  const counts = useMemo(() => {
    const c = { all: rooms.length, nut: 0, bolt: 0, dm: 0 };
    const u = { all: 0, nut: 0, bolt: 0, dm: 0 };
    for (const r of rooms) {
      const k = (r.type as Tab) ?? "all";
      if (k === "nut" || k === "bolt" || k === "dm") {
        c[k]++;
        u[k] += r.unread_count || 0;
      }
      u.all += r.unread_count || 0;
    }
    return { c, u };
  }, [rooms]);

  const filtered = useMemo(() => {
    if (tab === "all") return rooms;
    return rooms.filter((r) => r.type === tab);
  }, [rooms, tab]);

  const TABS: Array<{ key: Tab; label: string; Icon: typeof Globe }> = [
    { key: "all", label: "전체", Icon: Globe },
    { key: "nut", label: "너트", Icon: Hash },
    { key: "bolt", label: "볼트", Icon: Users },
    { key: "dm", label: "개인", Icon: User },
  ];

  // 목록 화면 (모바일은 단독 전체화면, 데스크탑은 좌측 패널)
  const listView = (
    <div className="flex flex-col h-full">
      {/* 모바일 전용 상단 바 — 타이틀 + 새 DM */}
      <div className="md:hidden px-4 pt-3 pb-2 border-b border-nu-ink/10 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-nu-pink" />
            <h1 className="font-head text-[20px] font-extrabold text-nu-ink">채팅</h1>
            {counts.u.all > 0 && (
              <span className="min-w-[20px] h-[20px] px-1.5 bg-nu-pink text-white rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center">
                {counts.u.all > 99 ? "99+" : counts.u.all}
              </span>
            )}
          </div>
          <button
            onClick={() => setNewDMOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-nu-pink text-white rounded-full text-[12px] font-bold active:scale-95"
          >
            <UserPlus size={13} /> 새 DM
          </button>
        </div>
      </div>

      {/* 탭 필터 — 모바일에선 균등 4분할 grid (잘림 방지), 데스크탑은 inline */}
      <div className="px-2 py-2 border-b border-nu-ink/10 bg-nu-cream/20 shrink-0">
        <div className="grid grid-cols-4 gap-1 md:flex md:items-center md:gap-1">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            const count = counts.c[key];
            const unread = counts.u[key];
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-label={`${label} (${count}개${unread > 0 ? `, 안읽음 ${unread}` : ""})`}
                className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-nu-ink text-white shadow-sm"
                    : "bg-white border border-nu-ink/15 text-nu-graphite hover:bg-nu-ink/5"
                }`}
              >
                <Icon size={13} />
                <span className="hidden min-[380px]:inline">{label}</span>
                <span className={`tabular-nums text-[11px] ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
                {unread > 0 && (
                  <span
                    className={`min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold tabular-nums flex items-center justify-center ${
                      active ? "bg-white text-nu-ink" : "bg-nu-pink text-white"
                    }`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 방 목록 */}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        <ChatRoomList
          rooms={filtered}
          activeRoomId={activeRoom}
          onSelect={(id) => setActiveRoom(id)}
          onRefresh={() => setReloadKey((k) => k + 1)}
        />
      </div>
    </div>
  );

  // 데스크탑 2-pane 레이아웃
  if (!isMobile) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 데스크탑 상단 바 */}
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-nu-pink" />
            <h1 className="font-head text-[22px] font-extrabold text-nu-ink">채팅</h1>
            {counts.u.all > 0 && (
              <span className="ml-1 min-w-[20px] h-[20px] px-1.5 bg-nu-pink text-white rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center">
                {counts.u.all > 99 ? "99+" : counts.u.all}
              </span>
            )}
            <button
              onClick={() => setNewDMOpen(true)}
              className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 border-[1.5px] border-nu-ink bg-nu-paper text-nu-ink rounded text-[11px] font-mono-nu uppercase tracking-widest font-bold hover:bg-nu-ink hover:text-nu-paper transition-colors"
            >
              <UserPlus size={11} /> 새 DM
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[320px_1fr] gap-0 border-[2px] border-nu-ink bg-white rounded-[var(--ds-radius-lg)] overflow-hidden" style={{ minHeight: "min(calc(100vh-220px), 700px)", maxHeight: "calc(100vh-160px)" }}>
          <aside className="border-r border-nu-ink/10 bg-nu-cream/10 overflow-auto flex flex-col">
            {listView}
          </aside>
          <section className="flex flex-col min-h-0 overflow-hidden">
            {activeRoom ? (
              <ChatRoomView
                roomId={activeRoom}
                onMessage={() => setReloadKey((k) => k + 1)}
                fullHeight
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-nu-graphite text-[13px] p-8 text-center">
                <div>
                  <MessageSquare size={32} className="mx-auto mb-2 text-nu-muted" />
                  <p>왼쪽에서 대화를 선택하거나, 너트/볼트 상세의 "채팅방 열기" 버튼을 눌러보세요.</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {newDMOpen && <NewDMModal onClose={() => setNewDMOpen(false)} />}
      </div>
    );
  }

  // 모바일 카카오톡 스타일 — 목록 OR 상세 (전환식)
  // 하단 탭 바(52px + safe-area)를 가리지 않도록 bottom inset 사용.
  // 상세 레이어에서는 composer 를 바로 탭 위에 올리기 위해 동일한 inset 적용.
  const mobileLayerStyle: React.CSSProperties = {
    top: 0,
    left: 0,
    right: 0,
    bottom: "calc(52px + env(safe-area-inset-bottom))",
  };

  return (
    <>
      {/* 목록 레이어 — 항상 존재 (활성방 있어도 뒤에 유지). z-[440] → 바텀탭(450) 아래 */}
      <div className="fixed z-[440] bg-white flex flex-col chat-fullscreen" style={mobileLayerStyle}>
        {listView}
      </div>

      {/* 상세 레이어 — 활성방 있을 때만 위로 덮기 (카카오톡 슬라이드). z-[445] → 여전히 바텀탭 아래 */}
      {activeRoom && (
        <div
          className="fixed z-[445] bg-white flex flex-col animate-slide-in-right chat-fullscreen"
          style={mobileLayerStyle}
        >
          <ChatRoomView
            roomId={activeRoom}
            onBack={() => setActiveRoom(null)}
            onMessage={() => setReloadKey((k) => k + 1)}
            fullHeight
          />
        </div>
      )}

      {newDMOpen && <NewDMModal onClose={() => setNewDMOpen(false)} />}
    </>
  );
}
