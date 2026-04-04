"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin } from "lucide-react";

interface EventItem {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  max_attendees: number | null;
}

export default function SchedulePage() {
  const params = useParams();
  const groupId = params.id as string;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [view, setView] = useState<"month" | "week">("month");

  useEffect(() => {
    async function loadEvents() {
      const supabase = createClient();
      const start = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const end = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      const { data } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, location, max_attendees")
        .eq("group_id", groupId)
        .gte("start_at", start.toISOString())
        .lte("start_at", end.toISOString())
        .order("start_at");

      setEvents(data || []);
    }
    loadEvents();
  }, [groupId, currentDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getDate() === day && d.getMonth() === month;
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">
          캘린더
        </h1>
        <Link
          href={`/groups/${groupId}/events/create`}
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
        >
          <Plus size={14} /> 일정 추가
        </Link>
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-nu-cream transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-head text-xl font-bold min-w-[160px] text-center">
            {year}년 {month + 1}월
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-nu-cream transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("month")}
            className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 transition-colors ${
              view === "month"
                ? "bg-nu-ink text-nu-paper"
                : "bg-transparent text-nu-gray hover:bg-nu-cream"
            }`}
          >
            월
          </button>
          <button
            onClick={() => setView("week")}
            className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 transition-colors ${
              view === "week"
                ? "bg-nu-ink text-nu-paper"
                : "bg-transparent text-nu-gray hover:bg-nu-cream"
            }`}
          >
            주
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
        <div className="min-w-[600px]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-nu-ink/[0.08]" role="row">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div
              key={d}
              className="p-3 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[100px] border-b border-r border-nu-ink/[0.06] bg-nu-cream/30"
                />
              );
            }

            const dayEvents = getEventsForDay(day);
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();

            return (
              <div
                key={day}
                className={`min-h-[100px] p-2 border-b border-r border-nu-ink/[0.06] ${
                  isToday ? "bg-nu-pink/5" : ""
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs mb-1 ${
                    isToday
                      ? "bg-nu-pink text-white rounded-full font-bold"
                      : "text-nu-graphite"
                  }`}
                >
                  {day}
                </span>
                {dayEvents.map((evt) => (
                  <Link
                    key={evt.id}
                    href={`/groups/${groupId}/events/${evt.id}`}
                    className="block calendar-event bg-nu-pink/10 border-l-2 border-nu-pink px-2 py-1 mb-1 no-underline"
                  >
                    <p className="text-[10px] font-medium text-nu-ink truncate">
                      {evt.title}
                    </p>
                    <p className="text-[9px] text-nu-muted">
                      {new Date(evt.start_at).toLocaleTimeString("ko", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Event list below calendar */}
      {events.length > 0 && (
        <div className="mt-8">
          <h3 className="font-head text-lg font-extrabold mb-4">
            이번 달 일정
          </h3>
          <div className="flex flex-col gap-2">
            {events.map((evt) => (
              <Link
                key={evt.id}
                href={`/groups/${groupId}/events/${evt.id}`}
                className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-4 no-underline hover:border-nu-pink/30 transition-colors"
              >
                <div className="w-10 h-10 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                  <span className="font-head text-sm font-bold text-nu-pink leading-none">
                    {new Date(evt.start_at).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-nu-ink truncate">
                    {evt.title}
                  </p>
                  <div className="flex gap-3 mt-0.5 text-[11px] text-nu-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(evt.start_at).toLocaleTimeString("ko", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {evt.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {evt.location}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
