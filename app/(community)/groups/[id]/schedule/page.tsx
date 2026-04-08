"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Calendar, BookOpen, Download } from "lucide-react";
import { GoogleCalendarButton } from "@/components/integrations/google-calendar-button";
import { EventRsvpButton } from "@/components/groups/event-rsvp-button";

interface EventItem {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  max_attendees: number | null;
  itemType: "event" | "meeting";
  duration_min?: number;
}

export default function SchedulePage() {
  const params = useParams();
  const groupId = params.id as string;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "list">("month");

  useEffect(() => {
    async function loadAll() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, location, max_attendees")
        .eq("group_id", groupId)
        .gte("start_at", start.toISOString())
        .lte("start_at", end.toISOString())
        .order("start_at");

      const { data: meetingsData } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, duration_min, location")
        .eq("group_id", groupId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at");

      const { data: group } = await supabase.from("groups").select("host_id").eq("id", groupId).single();
      setIsHost(group?.host_id === user.id);

      const combined: EventItem[] = [
        ...(eventsData || []).map((e: any) => ({ ...e, itemType: "event" as const })),
        ...(meetingsData || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          start_at: m.scheduled_at,
          end_at: new Date(new Date(m.scheduled_at).getTime() + (m.duration_min || 60) * 60000).toISOString(),
          location: m.location,
          max_attendees: null,
          duration_min: m.duration_min,
          itemType: "meeting" as const,
        })),
      ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

      setEvents(combined);
    }
    loadAll();
  }, [groupId, currentDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getDate() === day && d.getMonth() === month;
    });
  }

  function exportIcs() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//nutunion//nutunion//KO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    for (const evt of events) {
      const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      lines.push(
        "BEGIN:VEVENT",
        `DTSTART:${fmt(evt.start_at)}`,
        `DTEND:${fmt(evt.end_at)}`,
        `SUMMARY:${evt.title}`,
        ...(evt.location ? [`LOCATION:${evt.location}`] : []),
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nutunion-group.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink flex items-center gap-2">
          <Calendar size={24} className="text-nu-pink" /> 캘린더
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportIcs}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
          >
            <Download size={13} /> .ics 구독
          </button>
          {isHost && (
            <Link
              href={`/groups/${groupId}/events/create`}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={13} /> 일정 추가
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-head text-xl font-bold min-w-[150px] text-center">{year}년 {month + 1}월</h2>
          <button onClick={nextMonth} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex border-[2px] border-nu-ink/15 overflow-hidden">
          {(["month", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 transition-colors ${view === v ? "bg-nu-ink text-nu-paper" : "text-nu-gray hover:bg-nu-cream"}`}>
              {v === "month" ? "월별" : "목록"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-x-auto mb-8">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 border-b-[2px] border-nu-ink/[0.08]">
              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <div key={d} className="p-3 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                if (day === null) return <div key={`e${i}`} className="min-h-[100px] border-b border-r border-nu-ink/[0.06] bg-nu-cream/20" />;
                const dayEvts = getEventsForDay(day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                return (
                  <div key={day} className={`min-h-[100px] p-2 border-b border-r border-nu-ink/[0.06] ${isToday ? "bg-nu-pink/5" : ""}`}>
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs mb-1 ${isToday ? "bg-nu-pink text-white rounded-full font-bold" : "text-nu-graphite"}`}>
                      {day}
                    </span>
                    {dayEvts.map((evt) => (
                      <Link key={evt.id}
                        href={`/groups/${groupId}/${evt.itemType === "meeting" ? "meetings" : "events"}/${evt.id}`}
                        className={`block border-l-[3px] px-2 py-1 mb-1 no-underline text-nu-ink hover:opacity-80 transition-opacity ${
                          evt.itemType === "meeting" ? "bg-nu-blue/10 border-nu-blue" : "bg-nu-pink/10 border-nu-pink"
                        }`}>
                        <p className="text-[10px] font-medium truncate">
                          {evt.itemType === "meeting" && <BookOpen size={9} className="inline mr-1 text-nu-blue" />}
                          {evt.title}
                        </p>
                        <p className="text-[9px] text-nu-muted">{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}</p>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div>
          {view === "month" && <h3 className="font-head text-lg font-extrabold mb-4">이번 달 일정 ({events.length}개)</h3>}
          <div className="flex flex-col gap-3">
            {events.map((evt) => (
              <div key={`${evt.itemType}-${evt.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all overflow-hidden">
                <Link href={`/groups/${groupId}/${evt.itemType === "meeting" ? "meetings" : "events"}/${evt.id}`} className="flex items-center gap-4 p-4 no-underline">
                  <div className={`w-12 h-12 flex flex-col items-center justify-center shrink-0 ${evt.itemType === "meeting" ? "bg-nu-blue/10" : "bg-nu-pink/10"}`}>
                    <span className={`font-head text-base font-extrabold leading-none ${evt.itemType === "meeting" ? "text-nu-blue" : "text-nu-pink"}`}>
                      {new Date(evt.start_at).getDate()}
                    </span>
                    <span className={`font-mono-nu text-[8px] ${evt.itemType === "meeting" ? "text-nu-blue/70" : "text-nu-pink/70"}`}>
                      {new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{evt.title}</p>
                      {evt.itemType === "meeting" && <span className="font-mono-nu text-[9px] bg-nu-blue/10 text-nu-blue px-1.5 py-0.5">미팅</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-nu-muted">
                      <span className="flex items-center gap-1"><Clock size={10} />{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}{evt.duration_min && ` (${evt.duration_min}분)`}</span>
                      {evt.location && <span className="flex items-center gap-1"><MapPin size={10} />{evt.location}</span>}
                    </div>
                  </div>
                  <GoogleCalendarButton title={evt.title} startAt={evt.start_at} endAt={evt.end_at} location={evt.location || ""} className="shrink-0 hidden md:inline-flex text-[9px] px-2 py-1.5" />
                </Link>
                {evt.itemType === "event" && userId && (
                  <div className="border-t border-nu-ink/[0.06] px-4 py-2.5">
                    <EventRsvpButton eventId={evt.id} userId={userId} maxAttendees={evt.max_attendees} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
          <Calendar size={32} className="text-nu-muted mx-auto mb-3" />
          <p className="text-nu-gray">이번 달 일정이 없습니다</p>
        </div>
      )}
    </div>
  );
}
