"use client";

import { useEffect, useState, useMemo } from "react";
import { Calendar, Clock, MapPin, Users, ExternalLink, Plus, X, ChevronLeft, ChevronRight, List, Grid3X3, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { UnifiedEvent } from "@/app/api/calendar/unified/route";

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  meeting: "너트 미팅",
  project_meeting: "볼트 미팅",
  milestone: "마일스톤",
};

const SOURCE_COLORS: Record<string, string> = {
  google: "#4F46E5",
  meeting: "#EC4899",
  project_meeting: "#F59E0B",
  milestone: "#10B981",
};

function SourceBadge({ source, label }: { source: string; label?: string }) {
  const color = SOURCE_COLORS[source] || "#6B7280";
  return (
    <span
      className="inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}
    >
      {label || SOURCE_LABELS[source] || source}
    </span>
  );
}

export default function StaffCalendarPage() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/unified?lookback=60&lookahead=90");
      if (!res.ok) {
        toast.error("일정을 불러올 수 없습니다");
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
      setGoogleConnected(data.googleConnected || false);
    } catch {
      toast.error("캘린더 로딩 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, []);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    if (!googleConnected) {
      toast.error("Google 캘린더 연동 후 일정을 생성할 수 있습니다");
      return;
    }
    setCreating(true);
    try {
      const startTime = `${form.date}T${form.startTime}:00+09:00`;
      const endTime = `${form.date}T${form.endTime}:00+09:00`;
      const res = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), startTime, endTime }),
      });
      if (!res.ok) { toast.error("일정 생성 실패"); setCreating(false); return; }
      toast.success("일정이 생성되었습니다");
      setForm({ title: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });
      setShowCreate(false);
      await loadEvents();
    } catch {
      toast.error("일정 생성 중 오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Filter events by active source filter
  const filteredEvents = useMemo(() => {
    if (!activeFilter) return events;
    return events.filter((e) => e.source === activeFilter);
  }, [events, activeFilter]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, UnifiedEvent[]> = {};
    for (const ev of filteredEvents) {
      const dateStr = new Date(ev.start).toISOString().split("T")[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    }
    return map;
  }, [filteredEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[selectedDate] || [];
  }, [selectedDate, eventsByDate]);

  const groupedByDate = useMemo(() => {
    return filteredEvents.reduce<Record<string, { events: UnifiedEvent[]; dateObj: Date }>>((acc, ev) => {
      const dateObj = new Date(ev.start);
      const dateKey = dateObj.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
      if (!acc[dateKey]) acc[dateKey] = { events: [], dateObj };
      acc[dateKey].events.push(ev);
      return acc;
    }, {});
  }, [filteredEvents]);

  // Source stats for filter bar
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of events) {
      counts[ev.source] = (counts[ev.source] || 0) + 1;
    }
    return counts;
  }, [events]);

  const upcomingCount = filteredEvents.filter((ev) => new Date(ev.start) >= today).length;
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
        <div className="h-8 w-32 bg-nu-ink/8 animate-pulse mb-8" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 bg-white border border-nu-ink/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">캘린더</h1>
          <p className="font-mono-nu text-[13px] text-nu-muted mt-1 uppercase tracking-widest">
            {upcomingCount > 0 ? `${upcomingCount}개 예정` : "모든 일정"}
            {!googleConnected && (
              <span className="ml-3 text-amber-500 normal-case not-uppercase">
                · Google 캘린더 미연결
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-nu-ink/15">
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 transition-colors ${viewMode === "calendar" ? "bg-nu-ink text-nu-paper" : "bg-transparent text-nu-muted hover:text-nu-ink"}`}
              aria-label="달력 보기"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-nu-ink text-nu-paper" : "bg-transparent text-nu-muted hover:text-nu-ink"}`}
              aria-label="리스트 보기"
            >
              <List size={14} />
            </button>
          </div>
          {googleConnected ? (
            <Button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest gap-1.5"
            >
              {showCreate ? <X size={12} /> : <Plus size={12} />}
              {showCreate ? "닫기" : "새 일정"}
            </Button>
          ) : (
            <a
              href="/profile"
              className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2 border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors no-underline"
            >
              <Link2 size={12} />
              Google 연결
            </a>
          )}
        </div>
      </div>

      {/* Source filter bar */}
      {Object.keys(sourceCounts).length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveFilter(null)}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
              !activeFilter ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/20 text-nu-muted hover:border-nu-ink/40"
            }`}
          >
            전체 ({events.length})
          </button>
          {Object.entries(sourceCounts).map(([src, count]) => {
            const color = SOURCE_COLORS[src] || "#6B7280";
            return (
              <button
                key={src}
                onClick={() => setActiveFilter(activeFilter === src ? null : src)}
                className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                  activeFilter === src ? "text-white" : "text-nu-muted hover:border-nu-ink/40"
                }`}
                style={
                  activeFilter === src
                    ? { backgroundColor: color, borderColor: color }
                    : { borderColor: `${color}40` }
                }
              >
                {SOURCE_LABELS[src] || src} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Create event form */}
      {showCreate && googleConnected && (
        <form onSubmit={handleCreateEvent} className="bg-white border border-nu-ink/[0.08] p-5 mb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">일정 제목</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="회의, 워크숍 등..." className="border-nu-ink/15 bg-transparent" />
            </div>
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">날짜</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">시작</label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
              </div>
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">종료</label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
              </div>
            </div>
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">장소</label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="선택 사항" className="border-nu-ink/15 bg-transparent" />
            </div>
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">설명</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="선택 사항" className="border-nu-ink/15 bg-transparent" />
            </div>
          </div>
          <Button type="submit" disabled={creating || !form.title.trim() || !form.date} className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest">
            {creating ? "생성 중..." : "일정 생성"}
          </Button>
        </form>
      )}

      {events.length === 0 ? (
        <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
          <Calendar size={48} className="mx-auto mb-4 text-nu-ink/15" />
          <p className="text-sm text-nu-muted mb-2">일정이 없습니다</p>
          {!googleConnected && (
            <p className="text-xs text-nu-muted/70 mb-4">Google 캘린더를 연결하면 개인 일정도 표시됩니다</p>
          )}
          {!googleConnected && (
            <a href="/profile" className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink inline-block transition-colors">
              Google 계정 연결하기
            </a>
          )}
        </div>
      ) : viewMode === "calendar" ? (
        /* ===== CALENDAR GRID VIEW ===== */
        <div>
          <div className="flex items-center justify-between mb-4 bg-white border border-nu-ink/[0.06] px-4 py-3">
            <button
              onClick={() => { setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); setSelectedDate(null); }}
              className="p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink">
                {currentMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
              </h2>
              <button
                onClick={() => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayStr); }}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 border border-nu-ink/15 text-nu-muted bg-transparent cursor-pointer hover:bg-nu-paper transition-colors"
              >
                오늘
              </button>
            </div>
            <button
              onClick={() => { setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); setSelectedDate(null); }}
              className="p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((day, i) => (
              <div key={day} className={`text-center py-2 font-mono-nu text-[12px] uppercase tracking-widest font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-nu-muted"}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-t border-l border-nu-ink/[0.06]">
            {calendarDays.map(({ date, dateStr, isCurrentMonth }, idx) => {
              const dayEvents = eventsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayOfWeek = date.getDay();

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={`relative min-h-[80px] md:min-h-[100px] p-1.5 border-r border-b border-nu-ink/[0.06] text-left cursor-pointer transition-colors bg-transparent ${isCurrentMonth ? "bg-white" : "bg-nu-ink/[0.02]"} ${isSelected ? "ring-2 ring-nu-ink ring-inset" : ""} ${isToday ? "bg-nu-blue/[0.04]" : ""} hover:bg-nu-paper/60`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold ${isToday ? "bg-nu-ink text-nu-paper rounded-full" : ""} ${!isToday && isCurrentMonth ? (dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-nu-ink") : ""} ${!isCurrentMonth ? "text-nu-muted/40" : ""}`}>
                    {date.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, evIdx) => {
                        const color = ev.color || SOURCE_COLORS[ev.source] || "#6B7280";
                        return (
                          <div
                            key={evIdx}
                            className="text-[9px] leading-tight px-1 py-0.5 truncate font-mono-nu"
                            style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
                            title={ev.title}
                          >
                            <span className="hidden md:inline">
                              {new Date(ev.start).getHours().toString().padStart(2, "0")}:{new Date(ev.start).getMinutes().toString().padStart(2, "0")}{" "}
                            </span>
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] text-nu-muted font-mono-nu px-1">+{dayEvents.length - 3}개 더</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected date detail */}
          {selectedDate && (
            <div className="mt-4 bg-white border border-nu-ink/[0.08]">
              <div className="px-4 py-3 border-b border-nu-ink/[0.06] flex items-center justify-between">
                <h3 className="font-head text-sm font-bold text-nu-ink">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
                </h3>
                <div className="flex items-center gap-2">
                  {googleConnected && (
                    <button
                      onClick={() => { setForm(f => ({ ...f, date: selectedDate })); setShowCreate(true); }}
                      className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray bg-transparent border border-nu-ink/15 px-3 py-1 cursor-pointer hover:bg-nu-paper transition-colors"
                    >
                      <Plus size={10} className="inline mr-1" />일정 추가
                    </button>
                  )}
                  <button onClick={() => setSelectedDate(null)} className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink">
                    <X size={14} />
                  </button>
                </div>
              </div>
              {selectedDateEvents.length > 0 ? (
                <div className="divide-y divide-nu-ink/5">
                  {selectedDateEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="font-mono-nu text-[12px] text-nu-muted">이 날 일정이 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ===== LIST VIEW ===== */
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([date, { events: dayEvents, dateObj }]) => {
            const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
            const isToday = dayStart.getTime() === today.getTime();
            const isPast = dayStart < today;
            return (
              <div key={date}>
                <h2 className={`font-mono-nu text-[13px] uppercase tracking-widest font-bold mb-3 py-1 flex items-center gap-2 ${isPast ? "text-nu-muted" : "text-nu-ink"}`}>
                  {isToday && <span className="w-2 h-2 rounded-full bg-nu-ink inline-block" />}
                  {date}
                  {isToday && <span className="text-[11px] font-normal ml-1 text-nu-pink">오늘</span>}
                </h2>
                <div className="space-y-2">
                  {dayEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
                </div>
              </div>
            );
          })}
          {Object.keys(groupedByDate).length === 0 && (
            <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center">
              <p className="text-sm text-nu-muted">해당 기간에 일정이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: UnifiedEvent }) {
  const color = ev.color || SOURCE_COLORS[ev.source] || "#6B7280";
  const isAllDay = ev.start.length === 10; // date-only string
  const startDate = new Date(ev.start);
  const endDate = new Date(ev.end);
  const durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60_000);

  const content = (
    <div
      className="flex items-start gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-nu-ink/20 transition-colors group"
      style={{ borderLeftWidth: "3px", borderLeftColor: color }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">{ev.title}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span className="font-mono-nu text-[11px] text-nu-muted flex items-center gap-1">
                <Clock size={10} />
                {isAllDay ? "종일" : `${startDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — ${endDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`}
                {!isAllDay && durationMins > 0 && (
                  <span className="text-nu-muted/50 ml-1">
                    ({durationMins >= 60 ? `${Math.floor(durationMins / 60)}시간${durationMins % 60 > 0 ? ` ${durationMins % 60}분` : ""}` : `${durationMins}분`})
                  </span>
                )}
              </span>
              {ev.location && (
                <span className="font-mono-nu text-[11px] text-nu-muted flex items-center gap-1">
                  <MapPin size={10} /> {ev.location}
                </span>
              )}
              {ev.attendees && ev.attendees.length > 0 && (
                <span className="font-mono-nu text-[11px] text-nu-muted flex items-center gap-1">
                  <Users size={10} /> {ev.attendees.length}명
                </span>
              )}
              <SourceBadge source={ev.source} label={ev.sourceLabel} />
            </div>
            {ev.description && (
              <p className="font-mono-nu text-[11px] text-nu-muted/60 mt-1.5 line-clamp-2">{ev.description}</p>
            )}
          </div>
          {ev.htmlLink && <ExternalLink size={12} className="text-nu-muted group-hover:text-nu-ink mt-0.5 shrink-0" />}
        </div>
      </div>
    </div>
  );

  if (ev.htmlLink) {
    const isExternal = ev.htmlLink.startsWith("http");
    return (
      <a
        href={ev.htmlLink}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="block no-underline"
      >
        {content}
      </a>
    );
  }

  return content;
}
