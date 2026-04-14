"use client";

import { useEffect, useState, useMemo } from "react";
import { Calendar, Clock, MapPin, Users, ExternalLink, Plus, X, ChevronLeft, ChevronRight, List, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: { email: string; responseStatus: string }[];
  htmlLink: string;
}

export default function StaffCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function loadEvents() {
    try {
      const res = await fetch("/api/google/calendar?lookback=60&lookahead=60");
      if (!res.ok) {
        if (res.status === 401) setError("Google 계정을 연결해주세요");
        else setError("캘린더를 불러올 수 없습니다");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setError("캘린더 로딩 중 오류가 발생했습니다");
    }
    setLoading(false);
  }

  useEffect(() => { loadEvents(); }, []);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setCreating(true);
    try {
      const startTime = `${form.date}T${form.startTime}:00+09:00`;
      const endTime = `${form.date}T${form.endTime}:00+09:00`;
      const res = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          startTime,
          endTime,
        }),
      });
      if (!res.ok) { toast.error("일정 생성 실패"); setCreating(false); return; }
      toast.success("일정이 생성되었습니다");
      setForm({ title: "", description: "", location: "", date: "", startTime: "09:00", endTime: "10:00" });
      setShowCreate(false);
      setLoading(true);
      await loadEvents();
    } catch {
      toast.error("일정 생성 중 오류가 발생했습니다");
    }
    setCreating(false);
  }

  // Calendar grid helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Previous month fill
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: true });
    }

    // Next month fill (up to 42 cells for 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: d.toISOString().split("T")[0], isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  // Map events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const dateStr = new Date(ev.start).toISOString().split("T")[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    }
    return map;
  }, [events]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[selectedDate] || [];
  }, [selectedDate, eventsByDate]);

  function navigateMonth(delta: number) {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayStr);
  }

  // List view grouping
  const groupedByDate = useMemo(() => {
    return events.reduce<Record<string, { events: CalendarEvent[]; dateObj: Date }>>((acc, ev) => {
      const dateObj = new Date(ev.start);
      const dateKey = dateObj.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
      if (!acc[dateKey]) acc[dateKey] = { events: [], dateObj };
      acc[dateKey].events.push(ev);
      return acc;
    }, {});
  }, [events]);

  const upcomingCount = events.filter(ev => new Date(ev.start) >= today).length;
  const pastCount = events.filter(ev => new Date(ev.start) < today).length;

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">캘린더</h1>
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">
            Google Calendar{events.length > 0 && ` · ${upcomingCount}개 예정`}{pastCount > 0 && ` · ${pastCount}개 지남`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-nu-ink/15">
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 cursor-pointer border-none transition-colors ${viewMode === "calendar" ? "bg-indigo-600 text-white" : "bg-transparent text-nu-muted hover:text-nu-ink"}`}
              aria-label="달력 보기"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 cursor-pointer border-none transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "bg-transparent text-nu-muted hover:text-nu-ink"}`}
              aria-label="리스트 보기"
            >
              <List size={14} />
            </button>
          </div>
          {!error && (
            <Button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest gap-1.5"
            >
              {showCreate ? <X size={12} /> : <Plus size={12} />}
              {showCreate ? "닫기" : "새 일정"}
            </Button>
          )}
        </div>
      </div>

      {/* Create event form */}
      {showCreate && (
        <form onSubmit={handleCreateEvent} className="bg-white border border-indigo-200 p-5 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">일정 제목</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="회의, 워크숍 등..." className="border-nu-ink/15 bg-transparent" />
            </div>
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">날짜</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">시작</label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
              </div>
              <div>
                <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">종료</label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
              </div>
            </div>
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">장소</label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="선택 사항" className="border-nu-ink/15 bg-transparent" />
            </div>
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">설명</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="선택 사항" className="border-nu-ink/15 bg-transparent" />
            </div>
          </div>
          <Button type="submit" disabled={creating || !form.title.trim() || !form.date} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
            {creating ? "생성 중..." : "일정 생성"}
          </Button>
        </form>
      )}

      {error ? (
        <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
          <Calendar size={48} className="mx-auto mb-4 text-nu-ink/15" />
          <p className="text-sm text-nu-muted mb-4">{error}</p>
          <a href="/profile" className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-indigo-600 text-white no-underline hover:bg-indigo-700 inline-block">
            Google 계정 연결하기
          </a>
        </div>
      ) : viewMode === "calendar" ? (
        /* ===== CALENDAR GRID VIEW ===== */
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4 bg-white border border-nu-ink/[0.06] px-4 py-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600 transition-colors"
              aria-label="이전 달"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink">
                {currentMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
              </h2>
              <button
                onClick={goToToday}
                className="font-mono-nu text-[9px] uppercase tracking-widest px-3 py-1 border border-indigo-200 text-indigo-600 bg-transparent cursor-pointer hover:bg-indigo-50 transition-colors"
              >
                오늘
              </button>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600 transition-colors"
              aria-label="다음 달"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`text-center py-2 font-mono-nu text-[10px] uppercase tracking-widest font-bold ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-nu-muted"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
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
                  className={`
                    relative min-h-[80px] md:min-h-[100px] p-1.5 border-r border-b border-nu-ink/[0.06]
                    text-left cursor-pointer transition-colors bg-transparent
                    ${isCurrentMonth ? "bg-white" : "bg-nu-ink/[0.02]"}
                    ${isSelected ? "ring-2 ring-indigo-500 ring-inset bg-indigo-50/30" : ""}
                    ${isToday ? "bg-indigo-50/50" : ""}
                    hover:bg-indigo-50/30
                  `}
                >
                  {/* Date number */}
                  <span className={`
                    inline-flex items-center justify-center w-6 h-6 text-xs font-bold
                    ${isToday ? "bg-indigo-600 text-white rounded-full" : ""}
                    ${!isToday && isCurrentMonth ? (dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-nu-ink") : ""}
                    ${!isCurrentMonth ? "text-nu-muted/40" : ""}
                  `}>
                    {date.getDate()}
                  </span>

                  {/* Event dots / mini list */}
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, evIdx) => (
                        <div
                          key={evIdx}
                          className="text-[8px] leading-tight px-1 py-0.5 bg-indigo-100 text-indigo-700 truncate rounded-sm font-mono-nu"
                          title={ev.summary}
                        >
                          <span className="hidden md:inline">
                            {new Date(ev.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}{" "}
                          </span>
                          {ev.summary}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[8px] text-nu-muted font-mono-nu px-1">
                          +{dayEvents.length - 3}개 더
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected date detail panel */}
          {selectedDate && (
            <div className="mt-4 bg-white border border-indigo-200">
              <div className="px-4 py-3 border-b border-indigo-100 bg-indigo-50/30 flex items-center justify-between">
                <h3 className="font-head text-sm font-bold text-indigo-700">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setForm(f => ({ ...f, date: selectedDate }));
                      setShowCreate(true);
                    }}
                    className="font-mono-nu text-[9px] uppercase tracking-widest text-indigo-600 bg-transparent border border-indigo-200 px-3 py-1 cursor-pointer hover:bg-indigo-50 transition-colors"
                  >
                    <Plus size={10} className="inline mr-1" />일정 추가
                  </button>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink"
                    aria-label="닫기"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {selectedDateEvents.length > 0 ? (
                <div className="divide-y divide-nu-ink/5">
                  {selectedDateEvents.map(ev => (
                    <a
                      key={ev.id}
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-3 hover:bg-indigo-50/50 transition-colors no-underline group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-head text-sm font-bold text-nu-ink group-hover:text-indigo-600 transition-colors">{ev.summary}</h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(ev.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — {new Date(ev.end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                              <span className="text-nu-muted/50 ml-1">
                                ({(() => {
                                  const mins = Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000);
                                  return mins >= 60 ? `${Math.floor(mins / 60)}시간${mins % 60 > 0 ? ` ${mins % 60}분` : ""}` : `${mins}분`;
                                })()})
                              </span>
                            </span>
                            {ev.location && (
                              <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                                <MapPin size={10} /> {ev.location}
                              </span>
                            )}
                            {ev.attendees && ev.attendees.length > 0 && (
                              <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                                <Users size={10} /> {ev.attendees.length}명
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="font-mono-nu text-[9px] text-nu-muted/60 mt-1.5 line-clamp-2">{ev.description}</p>
                          )}
                        </div>
                        <ExternalLink size={12} className="text-nu-muted group-hover:text-indigo-600 mt-1 shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="font-mono-nu text-[10px] text-nu-muted">이 날 일정이 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ===== LIST VIEW ===== */
        events.length === 0 ? (
          <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
            <Calendar size={48} className="mx-auto mb-4 text-nu-ink/15" />
            <p className="text-sm text-nu-muted">예정된 일정이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([date, { events: dayEvents, dateObj }]) => {
              const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
              const isToday = dayStart.getTime() === today.getTime();
              const isPast = dayStart < today;
              return (
                <div key={date}>
                  <h2 className={`font-mono-nu text-[11px] uppercase tracking-widest font-bold mb-3 sticky top-[60px] py-2 z-10 flex items-center gap-2 ${
                    isToday ? "text-indigo-600 bg-indigo-50/50" : isPast ? "text-nu-muted bg-nu-paper" : "text-indigo-600 bg-nu-paper"
                  }`}>
                    {isToday && <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />}
                    {date}
                    {isToday && <span className="text-[9px] font-normal ml-1">오늘</span>}
                  </h2>
                  <div className="space-y-2">
                    {dayEvents.map(ev => (
                      <a
                        key={ev.id}
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors no-underline group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-indigo-600 transition-colors">{ev.summary}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(ev.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — {new Date(ev.end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                <span className="text-nu-muted/50 ml-1">
                                  ({(() => {
                                    const mins = Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000);
                                    return mins >= 60 ? `${Math.floor(mins / 60)}시간${mins % 60 > 0 ? ` ${mins % 60}분` : ""}` : `${mins}분`;
                                  })()})
                                </span>
                              </span>
                              {ev.location && (
                                <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                                  <MapPin size={10} /> {ev.location}
                                </span>
                              )}
                              {ev.attendees && ev.attendees.length > 0 && (
                                <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                                  <Users size={10} /> {ev.attendees.length}명
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <p className="font-mono-nu text-[9px] text-nu-muted/60 mt-1.5 line-clamp-2">{ev.description}</p>
                            )}
                          </div>
                          <ExternalLink size={12} className="text-nu-muted group-hover:text-indigo-600 mt-1 shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
