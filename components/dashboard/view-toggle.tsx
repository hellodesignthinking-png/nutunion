"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Network } from "lucide-react";

const STORAGE_KEY = "dashboard.view";
type View = "list" | "mindmap";

/**
 * 대시보드 뷰 전환 토글 — 두 모드 분리 버튼 (segmented control).
 *
 * - 클릭 시 즉시 전환 + localStorage 영속.
 * - 활성 모드는 ink/cream 반전으로 명확히 표시.
 */
export function DashboardViewToggle({
  defaultView = "list",
  onChange,
}: {
  defaultView?: View;
  onChange?: (view: View) => void;
}) {
  const [view, setView] = useState<View>(defaultView);

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

  function set(next: View) {
    if (next === view) return;
    setView(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    onChange?.(next);
  }

  const baseCls = "font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 transition-all flex items-center gap-1.5";
  const activeCls = "bg-nu-ink text-nu-paper";
  const inactiveCls = "bg-white text-nu-ink hover:bg-nu-yellow";

  return (
    <div
      role="group"
      aria-label="대시보드 보기 모드"
      className="inline-flex border-[2px] border-nu-ink shadow-[2px_2px_0_0_#0D0F14]"
    >
      <button
        type="button"
        onClick={() => set("list")}
        aria-pressed={view === "list"}
        title="리스트 뷰"
        className={`${baseCls} ${view === "list" ? activeCls : inactiveCls}`}
      >
        <LayoutGrid size={11} /> 리스트
      </button>
      <button
        type="button"
        onClick={() => set("mindmap")}
        aria-pressed={view === "mindmap"}
        title="마인드맵 뷰"
        className={`${baseCls} border-l-[2px] border-nu-ink ${view === "mindmap" ? activeCls : inactiveCls}`}
      >
        <Network size={11} /> 마인드맵
      </button>
    </div>
  );
}
