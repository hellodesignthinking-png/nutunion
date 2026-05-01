"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Minimize2 } from "lucide-react";
import { DashboardViewToggle } from "./view-toggle";
import type { MindMapData } from "@/lib/dashboard/mindmap-types";

// reactflow 는 ~30KB+ — 마인드맵 진입 시에만 로드.
const MindMapDashboard = dynamic(
  () => import("./mindmap/mindmap-dashboard").then((m) => m.MindMapDashboard),
  { ssr: false, loading: () => <div className="h-[600px] bg-nu-cream/30 animate-pulse border-[3px] border-nu-ink" /> },
);

interface Props {
  nickname: string;
  mindmapData: MindMapData;
  children: ReactNode; // 기존 list 뷰 (DashboardTabs 등)
  toggleSlot?: (toggle: ReactNode) => ReactNode; // header 의 어디에 토글을 둘지 부모가 결정
  /** realtime 구독을 위한 사용자 id */
  userId?: string;
}

/**
 * 대시보드 뷰 전환 컨테이너.
 *
 * - localStorage("dashboard.view") 읽어 초기 뷰 결정 (SSR mismatch 회피 — 첫 mount 후만 mindmap 활성)
 * - "mindmap" 모드일 때 children 대신 MindMapDashboard 렌더
 * - 토글 버튼은 부모 헤더에서 자유 위치
 *
 * Phase B 의 핵심 — Phase A 의 toast-only 토글이 실제 뷰 전환으로 승격.
 */
export function DashboardViewSwitcher({ nickname, mindmapData, children, userId }: Props) {
  const [view, setView] = useState<"list" | "mindmap">("list");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard.view");
      if (saved === "mindmap") setView("mindmap");
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const isMindmap = hydrated && view === "mindmap";

  // 마인드맵 모드 = 진짜 풀스크린: body 클래스 토글로 nav/sidebar/footer 모두 감춤.
  // ESC 키 또는 우상단 [→ 리스트] 버튼으로 종료.
  useEffect(() => {
    if (!isMindmap) return;
    document.body.classList.add("nu-mindmap-fullscreen");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setView("list");
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("nu-mindmap-fullscreen");
      window.removeEventListener("keydown", onKey);
    };
  }, [isMindmap]);

  if (isMindmap) {
    // 100vw × 100vh 풀스크린 — fixed inset-0 으로 dashboard 페이지 chrome 위에 덮음.
    return (
      <div className="fixed inset-0 z-[200] bg-nu-paper flex flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b-[2px] border-nu-ink bg-white shrink-0">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted flex items-center gap-2">
            <span className="font-head text-[12px] font-extrabold text-nu-ink">{nickname}님의 세계관</span>
            <span className="hidden sm:inline">· Genesis Mind Map</span>
            <span className="hidden md:inline opacity-60">· ESC 종료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setView("list")}
              title="리스트로 돌아가기 (ESC)"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-white hover:bg-nu-cream flex items-center gap-1 shadow-[2px_2px_0_0_#0D0F14]"
            >
              <Minimize2 size={11} /> 리스트로
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <MindMapDashboard nickname={nickname} data={mindmapData} userId={userId} fillContainer />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <DashboardViewToggle defaultView={view} onChange={setView} />
      </div>
      {children}
    </>
  );
}
