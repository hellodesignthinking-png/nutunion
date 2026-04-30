"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UnifiedCalendarDialog } from "@/components/dashboard/unified-calendar-dialog";

export default function CalendarFullPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // When the dialog is closed from this full-page, navigate back to dashboard
  // (router.back preserves scroll/tab state when arriving from dashboard;
  // falls back to /dashboard via push when this is a fresh tab)
  useEffect(() => {
    if (!open) {
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    }
  }, [open, router]);
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
