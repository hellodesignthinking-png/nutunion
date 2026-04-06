"use client";

import { Calendar } from "lucide-react";

interface GoogleCalendarButtonProps {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  className?: string;
}

export function GoogleCalendarButton({
  title,
  description,
  location,
  startAt,
  endAt,
  className = "",
}: GoogleCalendarButtonProps) {
  function formatDate(dateStr: string) {
    return new Date(dateStr).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function openGoogleCalendar() {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${formatDate(startAt)}/${formatDate(endAt)}`,
      ...(description && { details: description }),
      ...(location && { location }),
    });
    window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank");
  }

  return (
    <button
      onClick={openGoogleCalendar}
      className={`inline-flex items-center gap-2 font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2.5 border border-nu-ink/15 text-nu-graphite hover:bg-nu-blue/5 hover:border-nu-blue/30 hover:text-nu-blue transition-colors ${className}`}
    >
      <Calendar size={13} />
      Google 캘린더에 추가
    </button>
  );
}
