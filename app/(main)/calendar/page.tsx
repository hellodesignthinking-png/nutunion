"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { UnifiedCalendarDialog } from "@/components/dashboard/unified-calendar-dialog";

export default function CalendarFullPage() {
  const [open, setOpen] = useState(true);
  // When the dialog is closed from this full-page, navigate back to dashboard
  useEffect(() => {
    if (!open) {
      window.location.href = "/dashboard";
    }
  }, [open]);
  return (
    <div className="min-h-screen bg-nu-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline mb-3"
        >
          <ChevronLeft size={12} /> 대시보드
        </Link>
      </div>
      <UnifiedCalendarDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
