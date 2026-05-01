"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Network } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "dashboard.view";
type View = "list" | "mindmap";

/**
 * 대시보드 뷰 전환 토글 — Phase A.
 *
 * 현재는 mindmap 으로 전환 시 "Coming Soon" 토스트만 표시.
 * Phase B 부터 실제 마인드맵 뷰가 마운트되도록 부모 컴포넌트가 view 값을 사용.
 *
 * localStorage 영속화 — 사용자가 선호하는 뷰가 다음 방문에서도 유지.
 */
export function DashboardViewToggle({
  defaultView = "list",
  onChange,
}: {
  defaultView?: View;
  onChange?: (view: View) => void;
}) {
  const [view, setView] = useState<View>(defaultView);

  // hydrate from localStorage (after mount to avoid SSR mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as View | null;
      if (saved === "list" || saved === "mindmap") {
        setView(saved);
        onChange?.(saved);
      }
    } catch { /* localStorage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next: View = view === "list" ? "mindmap" : "list";
    setView(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    onChange?.(next);

    if (next === "mindmap") {
      toast.info("🕸️ 마인드맵 뷰", {
        description: "곧 공개됩니다 — Genesis AI 가 너트·볼트·일정·이슈를 하나의 시각적 맥락으로 연결합니다.",
      });
    }
  }

  const Icon = view === "list" ? Network : LayoutGrid;
  const label = view === "list" ? "마인드맵" : "리스트";

  return (
    <button
      type="button"
      onClick={toggle}
      title={`${label} 뷰로 전환`}
      className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-white hover:bg-nu-yellow transition-all flex items-center gap-1.5 shadow-[2px_2px_0_0_#0D0F14] hover:shadow-[3px_3px_0_0_#0D0F14] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
