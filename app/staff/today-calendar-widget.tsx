"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
}

export function TodayCalendarWidget() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/google/calendar?lookback=0&lookahead=1");
        if (!res.ok) { setError(true); setLoading(false); return; }
        const data = await res.json();
        // Filter to today only
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEvents = (data.events || []).filter((ev: CalEvent) => {
          const start = new Date(ev.start);
          return start >= today && start < tomorrow;
        });
        setEvents(todayEvents);
      } catch {
        setError(true);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (error) return null; // Google 계정 미연결 시 조용히 숨김

  return (
    <section className="bg-white border border-nu-ink/[0.06]">
      <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
        <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
          <Calendar size={14} className="text-indigo-600" /> 오늘 일정
        </h3>
        <Link href="/staff/calendar" className="font-mono-nu text-[9px] text-indigo-600 no-underline hover:underline uppercase tracking-widest">
          전체
        </Link>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2].map(i => <div key={i} className="h-8 bg-nu-ink/5 animate-pulse" />)}
        </div>
      ) : events.length > 0 ? (
        <div className="divide-y divide-nu-ink/5">
          {events.slice(0, 5).map(ev => (
            <a
              key={ev.id}
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-indigo-50/50 transition-colors no-underline group"
            >
              <p className="font-head text-xs font-bold text-nu-ink group-hover:text-indigo-600 truncate">{ev.summary}</p>
              <p className="font-mono-nu text-[8px] text-nu-muted flex items-center gap-1 mt-0.5">
                <Clock size={9} />
                {new Date(ev.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                {" — "}
                {new Date(ev.end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <div className="p-5 text-center">
          <p className="font-mono-nu text-[10px] text-nu-muted">오늘 일정이 없습니다</p>
        </div>
      )}
    </section>
  );
}
