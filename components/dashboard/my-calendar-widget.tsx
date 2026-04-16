"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Loader2, ExternalLink } from "lucide-react";

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
}

export function MyCalendarWidget() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/google/calendar?lookahead=14&lookback=0");
        if (res.ok) {
          const data = await res.json();
          const upcoming = (data.events || [])
            .filter((e: any) => new Date(e.start) >= new Date())
            .slice(0, 5);
          setEvents(upcoming);
        }
      } catch { /* Google not connected */ }
      setLoading(false);
    }
    load();
  }, []);

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDay(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "오늘";
    if (d.toDateString() === tomorrow.toDateString()) return "내일";
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
      <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-4">
        <Calendar size={14} className="text-nu-pink" /> 다가오는 일정
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-nu-pink" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-4">
          <Calendar size={22} className="mx-auto mb-2 text-nu-muted/30" />
          <p className="text-xs text-nu-muted">예정된 일정이 없습니다</p>
          <p className="text-[12px] text-nu-muted/60 mt-1">Google Calendar에 일정을 추가해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(evt => (
            <a key={evt.id} href={evt.htmlLink || "#"} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 py-1.5 no-underline hover:bg-nu-cream/20 transition-colors -mx-2 px-2 group">
              <div className="w-10 h-10 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                <span className="font-head text-xs font-extrabold text-nu-pink leading-none">
                  {new Date(evt.start).getDate()}
                </span>
                <span className="font-mono-nu text-[9px] uppercase text-nu-pink/70">
                  {formatDay(evt.start)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-nu-ink truncate group-hover:text-nu-pink transition-colors">{evt.summary}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-0.5 text-[11px] text-nu-muted">
                    <Clock size={8} /> {formatTime(evt.start)}
                  </span>
                  {evt.location && (
                    <span className="flex items-center gap-0.5 text-[11px] text-nu-muted truncate">
                      <MapPin size={8} /> {evt.location}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
