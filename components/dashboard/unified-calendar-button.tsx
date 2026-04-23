"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { UnifiedCalendarDialog } from "./unified-calendar-dialog";

export function UnifiedCalendarButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] hover:bg-nu-ink hover:text-nu-paper transition-colors p-4 flex items-center justify-between gap-3 font-mono-nu text-[13px] uppercase tracking-widest"
      >
        <span className="flex items-center gap-2">
          <Calendar size={16} className="text-nu-pink" />
          <span className="font-head text-base font-extrabold">📅 전체 일정 (통합 캘린더)</span>
        </span>
        <span className="text-nu-muted text-[11px]">개인 · 너트 · 볼트 통합 뷰 →</span>
      </button>
      <UnifiedCalendarDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
