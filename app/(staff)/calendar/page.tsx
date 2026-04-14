"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users, ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  async function loadEvents() {
    try {
      const res = await fetch("/api/google/calendar?lookback=7&lookahead=30");
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

  const groupedByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const date = new Date(ev.start).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <div className="h-8 w-32 bg-nu-ink/8 animate-pulse mb-8" />
        {[1,2,3].map(i => <div key={i} className="h-20 bg-white border border-nu-ink/[0.06] animate-pulse mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">캘린더</h1>
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">Google Calendar</p>
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
      ) : events.length === 0 ? (
        <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
          <Calendar size={48} className="mx-auto mb-4 text-nu-ink/15" />
          <p className="text-sm text-nu-muted">예정된 일정이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([date, dayEvents]) => (
            <div key={date}>
              <h2 className="font-mono-nu text-[11px] uppercase tracking-widest font-bold text-indigo-600 mb-3 sticky top-[60px] bg-nu-paper py-2 z-10">
                {date}
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
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(ev.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — {new Date(ev.end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
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
                      </div>
                      <ExternalLink size={12} className="text-nu-muted group-hover:text-indigo-600 mt-1 shrink-0" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
