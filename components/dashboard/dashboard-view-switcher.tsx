"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
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

  return (
    <>
      <div className="mb-3 flex justify-end">
        <DashboardViewToggle defaultView={view} onChange={setView} />
      </div>
      {isMindmap ? (
        // 풀-블리드 — 100vw 로 부모 max-w-4xl 컨테이너 탈출, 높이는 뷰포트 ~85%.
        // left:50% + -ml-[50vw] 트릭은 어떤 max-width 부모 안에서도 viewport 전체 폭을
        // 차지하면서 document flow 는 유지 (header/toggle 위치 안 흔들림).
        <div
          className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-3 sm:px-6"
          style={{ height: "calc(100vh - 220px)", minHeight: 560 }}
        >
          <MindMapDashboard nickname={nickname} data={mindmapData} userId={userId} fillContainer />
        </div>
      ) : (
        children
      )}
    </>
  );
}
