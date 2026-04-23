"use client";

/**
 * MyCalendarWidget — 대시보드 "My Calendar"
 *
 * 데이터 소스 (병합):
 *  1) Google Calendar (Google 연결된 경우)
 *  2) nutunion 내부 meetings + events (내가 속한 너트의 것)
 *
 * Google 연결 안 된 유저도 내부 일정은 볼 수 있도록 fallback 제공.
 */

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  source: "google" | "meeting" | "event";
}

const KST = "Asia/Seoul";

export function MyCalendarWidget() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const combined: CalEvent[] = [];
      const nowIso = new Date().toISOString();
      // 14일 뒤
      const ahead = new Date(Date.now() + 14 * 86400000).toISOString();

      // 1) nutunion 내부 meetings + events (내가 host 이거나 member)
      if (user) {
        try {
          const [{ data: memberships }, { data: hosted }] = await Promise.all([
            supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("status", "active"),
            supabase.from("groups").select("id").eq("host_id", user.id),
          ]);
          const groupIds = Array.from(
            new Set([
              ...((memberships as any[]) || []).map((m) => m.group_id),
              ...((hosted as any[]) || []).map((g) => g.id),
            ]),
          );

          if (groupIds.length > 0) {
            const [{ data: meetingsData }, { data: eventsData }] = await Promise.all([
              supabase
                .from("meetings")
                .select("id, title, scheduled_at, duration_min, location, group_id, status")
                .in("group_id", groupIds)
                .gte("scheduled_at", nowIso)
                .lte("scheduled_at", ahead)
                .not("status", "in", "(cancelled,completed)")
                .order("scheduled_at")
                .limit(10),
              supabase
                .from("events")
                .select("id, title, start_at, end_at, location, group_id")
                .in("group_id", groupIds)
                .gte("start_at", nowIso)
                .lte("start_at", ahead)
                .order("start_at")
                .limit(10),
            ]);

            for (const m of (meetingsData as any[]) || []) {
              const startMs = new Date(m.scheduled_at).getTime();
              const endMs = startMs + (m.duration_min || 60) * 60000;
              combined.push({
                id: `meeting-${m.id}`,
                summary: m.title,
                start: m.scheduled_at,
                end: new Date(endMs).toISOString(),
                location: m.location || undefined,
                htmlLink: `/groups/${m.group_id}/meetings/${m.id}`,
                source: "meeting",
              });
            }
            for (const e of (eventsData as any[]) || []) {
              combined.push({
                id: `event-${e.id}`,
                summary: e.title,
                start: e.start_at,
                end: e.end_at || e.start_at,
                location: e.location || undefined,
                htmlLink: `/groups/${e.group_id}/events/${e.id}`,
                source: "event",
              });
            }
          }
        } catch (err) {
          console.warn("[my-calendar] internal fetch failed", err);
        }
      }

      // 2) Google Calendar
      try {
        const res = await fetch("/api/google/calendar?lookahead=14&lookback=0");
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(true);
          for (const e of data.events || []) {
            if (!e.start) continue;
            if (new Date(e.start).getTime() < Date.now()) continue;
            combined.push({
              id: `google-${e.id}`,
              summary: e.summary || "(제목 없음)",
              start: e.start,
              end: e.end || e.start,
              location: e.location,
              htmlLink: e.htmlLink,
              source: "google",
            });
          }
        } else if (res.status === 403 || res.status === 401) {
          setGoogleConnected(false);
        }
      } catch {
        setGoogleConnected(false);
      }

      // 정렬 후 상위 5개
      combined.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setEvents(combined.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: KST });
  }

  function formatDay(dateStr: string) {
    const d = new Date(dateStr);
    // KST 기준 오늘/내일/...
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: KST });
    const dStr = d.toLocaleDateString("en-CA", { timeZone: KST });
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: KST });
    if (dStr === todayStr) return "오늘";
    if (dStr === tomorrow) return "내일";
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: KST });
  }

  function dayNumber(dateStr: string) {
    return new Intl.DateTimeFormat("ko-KR", { day: "numeric", timeZone: KST })
      .format(new Date(dateStr))
      .replace(/\D/g, "");
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
      <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-4">
        <Calendar size={14} className="text-nu-pink" /> 다가오는 일정
        {googleConnected === false && (
          <span className="ml-auto text-[10px] font-mono-nu font-normal text-nu-muted bg-nu-ink/5 px-2 py-0.5 rounded-full">
            너트 일정만
          </span>
        )}
      </h3>
      {googleConnected === false && events.length > 0 && (
        <div className="mb-3 text-[11px] text-nu-muted bg-nu-cream/30 border border-nu-ink/5 px-2 py-1.5 rounded">
          💡 <a href="/settings/integrations" className="underline text-nu-blue">Google Calendar 연결</a> 시 외부 일정도 함께 표시돼요
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-nu-pink" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-4">
          <Calendar size={22} className="mx-auto mb-2 text-nu-muted/30" />
          <p className="text-xs text-nu-muted">앞으로 2주 동안 일정이 없어요</p>
          <p className="text-[12px] text-nu-muted/60 mt-1">너트 일정을 등록하거나 Google Calendar 를 연결해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const isExternal = evt.source === "google";
            return (
              <a
                key={evt.id}
                href={evt.htmlLink || "#"}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 py-1.5 no-underline hover:bg-nu-cream/20 transition-colors -mx-2 px-2 group"
              >
                <div className="w-10 h-10 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                  <span className="font-head text-xs font-extrabold text-nu-pink leading-none">
                    {dayNumber(evt.start)}
                  </span>
                  <span className="font-mono-nu text-[9px] uppercase text-nu-pink/70">
                    {formatDay(evt.start)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nu-ink truncate group-hover:text-nu-pink transition-colors">
                    {evt.summary}
                    {evt.source === "meeting" && <span className="ml-1 text-[10px] text-nu-blue">· 회의</span>}
                    {evt.source === "event" && <span className="ml-1 text-[10px] text-nu-graphite">· 이벤트</span>}
                  </p>
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
                {isExternal && <ExternalLink size={10} className="text-nu-muted shrink-0" />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
