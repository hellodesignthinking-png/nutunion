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
export function DashboardViewSwitcher({ nickname, mindmapData, children }: Props) {
  const [view, setView] = useState<"list" | "mindmap">("list");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard.view");
      if (saved === "mindmap") setView("mindmap");
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <DashboardViewToggle defaultView={view} onChange={setView} />
      </div>
      {hydrated && view === "mindmap" ? (
        <MindMapDashboard nickname={nickname} data={mindmapData} />
      ) : (
        children
      )}
    </>
  );
}
