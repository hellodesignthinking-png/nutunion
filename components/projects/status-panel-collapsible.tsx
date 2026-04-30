"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

/**
 * StatusPanelCollapsible — ProjectStatusPanel 래퍼.
 *
 * 동작:
 *  - 홈 탭 (overview / 미지정) → 기본 열림
 *  - 다른 탭 → 기본 닫힘
 *  - 토글 버튼으로 언제든 열고 닫기
 *  - 사용자 마지막 선택 localStorage 에 저장 (탭 전환에도 유지)
 */
export function StatusPanelCollapsible({ children, projectId }: { children: ReactNode; projectId: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const isHome = !tab || tab === "overview";

  // 사용자 토글 우선 — 없으면 탭 기반 기본값
  const storageKey = `nu:project-status:${projectId}`;
  const [open, setOpen] = useState<boolean>(isHome);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "open") setOpen(true);
      else if (saved === "closed") setOpen(false);
      else setOpen(isHome);
    } catch {
      setOpen(isHome);
    }
  }, [storageKey, isHome]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {}
  }

  return (
    <div className="mb-6">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 border-[2px] border-nu-ink/15 hover:border-nu-ink/40 hover:bg-nu-cream/30 transition-colors group"
        aria-expanded={open}
        aria-controls="project-status-panel-body"
      >
        <span className="flex items-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink">
          <BarChart3 size={13} className="text-nu-pink" />
          진행 현황
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div id="project-status-panel-body" className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}
