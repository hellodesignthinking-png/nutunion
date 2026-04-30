"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Calendar, BookOpen, Download, X, Trash2, Edit3, ExternalLink } from "lucide-react";
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
  description?: string | null;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 로컬 datetime-local 문자열 → KST(+09:00) ISO (서버 UTC 해석 방지)
function localInputToKstIso(s: string) {
  // s 형태: "2026-04-19T14:30"
  return `${s}:00+09:00`;
}

export default function SchedulePage() {
  const params = useParams();
  const groupId = params.id as string;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // 데스크탑은 month, 모바일(<768px)은 자동으로 list — 가로 스크롤 600px 강제 회피
  const [view, setView] = useState<"month" | "week" | "list">(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "list";
    }
    return "month";
  });
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [createMode, setCreateMode] = useState<{ date: Date; type: "event" | "meeting" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventItem | null>(null);

  // Create form
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formDuration, setFormDuration] = useState(60);
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecurrence, setFormRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [formRecurrenceCount, setFormRecurrenceCount] = useState(4);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit mode inside detail
  const [editingDetail, setEditingDetail] = useState(false);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // week view → 해당 주(일~토) 범위 / month/list → 월 범위
    let start: Date, end: Date;
    if (view === "week") {
      const base = new Date(currentDate);
      base.setHours(0, 0, 0, 0);
      const dow = base.getDay();
      start = new Date(base);
      start.setDate(base.getDate() - dow);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    }

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, start_at, end_at, location, max_attendees, description")
      .eq("group_id", groupId)
      .gte("start_at", start.toISOString())
      .lte("start_at", end.toISOString())
      .order("start_at");

    const { data: meetingsData } = await supabase
      .from("meetings")
      .select("id, title, scheduled_at, duration_min, location, description")
      .eq("group_id", groupId)
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at");

    const { data: group } = await supabase.from("groups").select("host_id, name").eq("id", groupId).single();
    setIsHost(group?.host_id === user.id);
    setGroupName(group?.name || "너트");

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
        description: m.description,
        itemType: "meeting" as const,
      })),
    ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    setEvents(combined);
    setLoading(false);
  }, [currentDate, groupId, view]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function isPast(evt: EventItem) {
    return new Date(evt.end_at).getTime() < Date.now();
  }

  // ESC closes any modal + body scroll lock
  useEffect(() => {
    const anyOpen = !!(dayModalDate || detailEvent || createMode || confirmDelete);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDelete) setConfirmDelete(null);
        else if (createMode) { setCreateMode(null); setFormError(null); }
        else if (detailEvent) { setDetailEvent(null); setEditingDetail(false); setFormError(null); }
        else if (dayModalDate) setDayModalDate(null);
      }
    }
    window.addEventListener("keydown", onKey);
    if (anyOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [dayModalDate, detailEvent, createMode, confirmDelete]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(view === "week" ? new Date(currentDate.getTime() - 7 * 86400000) : new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(view === "week" ? new Date(currentDate.getTime() + 7 * 86400000) : new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Week 범위 계산
  const weekStart = (() => {
    const d = new Date(currentDate); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  })();
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  function getEventsForDate(target: Date) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getDate() === target.getDate() && d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    });
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  function getEventsForDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function exportIcs() {
    const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const now = fmt(new Date().toISOString());
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nutunion//schedule//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const evt of events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${evt.itemType}-${evt.id}@nutunion.co.kr`,
        `DTSTAMP:${now}`,
        `DTSTART:${fmt(evt.start_at)}`,
        `DTEND:${fmt(evt.end_at)}`,
        `SUMMARY:${escape(evt.title)}`,
        ...(evt.location ? [`LOCATION:${escape(evt.location)}`] : []),
        ...(evt.description ? [`DESCRIPTION:${escape(evt.description)}`] : []),
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nutunion-${groupId.slice(0, 8)}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  function openDayModal(day: number) {
    const d = new Date(year, month, day, 10, 0, 0);
    setDayModalDate(d);
  }

  function openCreate(date: Date, type: "event" | "meeting") {
    setDayModalDate(null);
    setCreateMode({ date, type });
    setFormTitle("");
    setFormStart(toLocalInput(date));
    setFormDuration(60);
    setFormLocation("");
    setFormDescription("");
    setFormRecurrence("none");
    setFormRecurrenceCount(4);
    setFormError(null);
  }

  function openDetail(evt: EventItem) {
    setDayModalDate(null);
    setDetailEvent(evt);
    setEditingDetail(false);
    setFormTitle(evt.title);
    setFormStart(toLocalInput(new Date(evt.start_at)));
    setFormDuration(evt.duration_min || Math.round((new Date(evt.end_at).getTime() - new Date(evt.start_at).getTime()) / 60000) || 60);
    setFormLocation(evt.location || "");
    setFormDescription(evt.description || "");
  }

  // 반복 일정 → 개별 인스턴스 배열 생성 (parent_event_id 링크)
  function expandRecurrence(baseIso: string): string[] {
    const dates = [baseIso];
    if (formRecurrence === "none") return dates;
    const base = new Date(baseIso);
    const intervalDays = formRecurrence === "weekly" ? 7 : formRecurrence === "biweekly" ? 14 : 0;
    const count = Math.max(1, Math.min(52, formRecurrenceCount));
    for (let i = 1; i < count; i++) {
      const next = new Date(base);
      if (formRecurrence === "monthly") {
        next.setMonth(next.getMonth() + i);
      } else {
        next.setDate(next.getDate() + intervalDays * i);
      }
      dates.push(next.toISOString());
    }
    return dates;
  }

  async function handleCreate() {
    if (!createMode || !formTitle.trim() || !formStart) return;
    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const startIso = localInputToKstIso(formStart);
    const occurrences = expandRecurrence(startIso);

    try {
      if (createMode.type === "event") {
        if (!isHost) throw new Error("호스트만 이벤트를 만들 수 있습니다.");
        // 첫 occurrence 를 parent 로 등록
        const firstEnd = new Date(new Date(occurrences[0]).getTime() + formDuration * 60000).toISOString();
        const { data: parent, error } = await supabase.from("events").insert({
          group_id: groupId,
          title: formTitle.trim(),
          start_at: occurrences[0],
          end_at: firstEnd,
          location: formLocation.trim() || null,
          description: formDescription.trim() || null,
          created_by: userId,
          is_recurring: occurrences.length > 1,
          recurrence_rule: formRecurrence === "none" ? null : `${formRecurrence}:${occurrences.length}`,
        }).select("id").single();
        if (error) throw error;
        // 나머지는 parent 참조
        if (occurrences.length > 1 && parent) {
          const rest = occurrences.slice(1).map((iso) => ({
            group_id: groupId,
            title: formTitle.trim(),
            start_at: iso,
            end_at: new Date(new Date(iso).getTime() + formDuration * 60000).toISOString(),
            location: formLocation.trim() || null,
            description: formDescription.trim() || null,
            created_by: userId,
            is_recurring: true,
            parent_event_id: parent.id,
          }));
          const { error: batchErr } = await supabase.from("events").insert(rest);
          if (batchErr) throw batchErr;
        }
      } else {
        // meetings: 개별 row 일괄 insert (반복) — status 누락 시 조회 필터에서 빠지므로 명시
        const rows = occurrences.map((iso) => ({
          group_id: groupId,
          title: formTitle.trim(),
          scheduled_at: iso,
          duration_min: formDuration,
          location: formLocation.trim() || null,
          description: formDescription.trim() || null,
          organizer_id: userId,
          status: "upcoming",
        }));
        const { error } = await supabase.from("meetings").insert(rows);
        if (error) throw error;
      }
      setCreateMode(null);
      await loadAll();
    } catch (err: any) {
      setFormError(err.message || "알 수 없는 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!detailEvent || !formTitle.trim()) return;
    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const startIso = localInputToKstIso(formStart);
    const endIso = new Date(new Date(startIso).getTime() + formDuration * 60000).toISOString();

    try {
      if (detailEvent.itemType === "meeting") {
        const { error } = await supabase.from("meetings").update({
          title: formTitle.trim(),
          scheduled_at: startIso,
          duration_min: formDuration,
          location: formLocation.trim() || null,
          description: formDescription.trim() || null,
        }).eq("id", detailEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").update({
          title: formTitle.trim(),
          start_at: startIso,
          end_at: endIso,
          location: formLocation.trim() || null,
          description: formDescription.trim() || null,
        }).eq("id", detailEvent.id);
        if (error) throw error;
      }
      setDetailEvent(null);
      setEditingDetail(false);
      await loadAll();
    } catch (err: any) {
      setFormError(err.message || "알 수 없는 오류");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const supabase = createClient();
    const table = confirmDelete.itemType === "meeting" ? "meetings" : "events";
    const { error } = await supabase.from(table).delete().eq("id", confirmDelete.id);
    if (error) {
      setFormError("삭제 실패: " + error.message);
    } else {
      setEvents((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      setConfirmDelete(null);
      setDetailEvent(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="h-4 w-16 bg-nu-ink/5 animate-pulse mb-6" />
        <div className="h-10 w-40 bg-nu-ink/5 animate-pulse mb-8" />
        <div className="h-8 w-48 bg-nu-ink/5 animate-pulse mb-6" />
        <div className="bg-white border-[2px] border-nu-ink/[0.08] h-[400px] animate-pulse bg-nu-ink/[0.02]" />
      </div>
    );
  }

  const dayEventsForModal = dayModalDate ? events.filter(e => {
    const d = new Date(e.start_at);
    return d.getDate() === dayModalDate.getDate() && d.getMonth() === dayModalDate.getMonth() && d.getFullYear() === dayModalDate.getFullYear();
  }) : [];

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[13px] uppercase tracking-widest">
        <Link href={`/groups/${groupId}`} className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink">캘린더</span>
      </nav>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink flex items-center gap-2">
          <Calendar size={24} className="text-nu-pink" /> 캘린더
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportIcs} className="font-mono-nu text-[13px] uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2">
            <Download size={13} /> .ics 구독
          </button>
          <button
            onClick={() => openCreate(new Date(), "meeting")}
            className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-blue text-nu-blue hover:bg-nu-blue hover:text-nu-paper transition-colors inline-flex items-center gap-2"
          >
            <Plus size={13} /> 미팅
          </button>
          {isHost && (
            <button
              onClick={() => openCreate(new Date(), "event")}
              className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={13} /> 이벤트
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button aria-label={view === "week" ? "이전 주" : "이전 달"} onClick={prevMonth} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors"><ChevronLeft size={16} /></button>
          <h2 className="font-head text-xl font-bold min-w-[180px] text-center">
            {view === "week"
              ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 주`
              : `${year}년 ${month + 1}월`}
          </h2>
          <button aria-label={view === "week" ? "다음 주" : "다음 달"} onClick={nextMonth} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors"><ChevronRight size={16} /></button>
          <button onClick={goToday} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">오늘</button>
        </div>
        <div className="flex border-[2px] border-nu-ink/15 overflow-hidden">
          {(["month", "week", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 transition-colors ${view === v ? "bg-nu-ink text-nu-paper" : "text-nu-gray hover:bg-nu-cream"}`}>
              {v === "month" ? "월별" : v === "week" ? "주별" : "목록"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-x-auto mb-8">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 border-b-[2px] border-nu-ink/[0.08]">
              {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                <div key={d} className={`p-3 text-center font-mono-nu text-[12px] uppercase tracking-widest ${i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-muted"}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                if (day === null) return <div key={`e${i}`} className="min-h-[110px] border-b border-r border-nu-ink/[0.06] bg-nu-cream/20" />;
                const dayEvts = getEventsForDay(day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const weekday = (firstDay + day - 1) % 7;
                return (
                  <button
                    key={day}
                    onClick={() => openDayModal(day)}
                    className={`min-h-[110px] p-2 border-b border-r border-nu-ink/[0.06] text-left transition-colors hover:bg-nu-pink/[0.04] cursor-pointer relative group ${isToday ? "bg-nu-pink/5" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs ${isToday ? "bg-nu-pink text-white rounded-full font-bold" : weekday === 0 ? "text-nu-pink" : weekday === 6 ? "text-nu-blue" : "text-nu-graphite"}`}>
                        {day}
                      </span>
                      <Plus size={12} className="text-nu-muted/0 group-hover:text-nu-pink transition-colors" />
                    </div>
                    <div className="space-y-1">
                      {dayEvts.slice(0, 3).map((evt) => {
                        const past = isPast(evt);
                        return (
                        <div
                          key={evt.id}
                          onClick={(e) => { e.stopPropagation(); openDetail(evt); }}
                          className={`border-l-[3px] px-2 py-1 hover:opacity-80 transition-opacity cursor-pointer ${past ? "bg-nu-ink/5 border-nu-ink/20 opacity-70" : evt.itemType === "meeting" ? "bg-nu-blue/10 border-nu-blue" : "bg-nu-pink/10 border-nu-pink"}`}
                        >
                          <p className={`text-[11px] font-medium truncate ${past ? "text-nu-muted line-through decoration-nu-muted/40" : "text-nu-ink"}`}>
                            {evt.itemType === "meeting" && <BookOpen size={9} className={`inline mr-1 ${past ? "text-nu-muted" : "text-nu-blue"}`} />}
                            {evt.title}
                          </p>
                          <p className="text-[10px] text-nu-muted">{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        );
                      })}
                      {dayEvts.length > 3 && (
                        <p className="text-[10px] text-nu-muted font-mono-nu pl-2">+{dayEvts.length - 3}개 더</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-x-auto mb-8">
          <div className="grid grid-cols-7 min-w-[700px] border-b-[2px] border-nu-ink/[0.08]">
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} className={`p-3 text-center border-r border-nu-ink/[0.06] last:border-r-0 ${isToday ? "bg-nu-pink/5" : ""}`}>
                  <div className={`font-mono-nu text-[10px] uppercase tracking-widest ${i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-muted"}`}>
                    {["일", "월", "화", "수", "목", "금", "토"][i]}
                  </div>
                  <div className={`font-head text-lg font-extrabold mt-0.5 ${isToday ? "text-nu-pink" : "text-nu-ink"}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-w-[700px]">
            {weekDays.map((d, i) => {
              const dayEvts = getEventsForDate(d);
              return (
                <button
                  key={i}
                  onClick={() => setDayModalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0, 0))}
                  className="min-h-[260px] p-2 border-r border-nu-ink/[0.06] last:border-r-0 text-left hover:bg-nu-pink/[0.04] transition-colors cursor-pointer space-y-1 group"
                >
                  {dayEvts.length === 0 ? (
                    <div className="text-[11px] text-nu-muted/50 italic opacity-0 group-hover:opacity-100 transition-opacity">+ 일정</div>
                  ) : (
                    dayEvts.map((evt) => {
                      const past = isPast(evt);
                      return (
                      <div
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); openDetail(evt); }}
                        className={`border-l-[3px] px-2 py-1.5 hover:opacity-80 transition-opacity cursor-pointer ${past ? "bg-nu-ink/5 border-nu-ink/20 opacity-70" : evt.itemType === "meeting" ? "bg-nu-blue/10 border-nu-blue" : "bg-nu-pink/10 border-nu-pink"}`}
                      >
                        <p className={`text-[11px] font-bold truncate ${past ? "text-nu-muted line-through decoration-nu-muted/40" : "text-nu-ink"}`}>
                          {evt.itemType === "meeting" && <BookOpen size={9} className={`inline mr-1 ${past ? "text-nu-muted" : "text-nu-blue"}`} />}
                          {evt.title}
                        </p>
                        <p className="text-[10px] text-nu-muted">
                          {new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                          {evt.duration_min && ` · ${evt.duration_min}분`}
                        </p>
                        {evt.location && <p className="text-[10px] text-nu-muted truncate">📍 {evt.location}</p>}
                      </div>
                      );
                    })
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div>
          {view === "month" && <h3 className="font-head text-lg font-extrabold mb-4">이번 달 일정 ({events.length}개)</h3>}
          <div className="flex flex-col gap-3">
            {events.map((evt) => {
              const past = isPast(evt);
              return (
              <button
                key={`${evt.itemType}-${evt.id}`}
                onClick={() => openDetail(evt)}
                className={`bg-nu-white border-[2px] transition-all overflow-hidden flex flex-col relative group text-left ${past ? "border-nu-ink/[0.05] opacity-70 hover:opacity-90" : "border-nu-ink/[0.08] hover:border-nu-pink/40"}`}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-12 h-12 flex flex-col items-center justify-center shrink-0 ${past ? "bg-nu-ink/5" : evt.itemType === "meeting" ? "bg-nu-blue/10" : "bg-nu-pink/10"}`}>
                    <span className={`font-head text-base font-extrabold leading-none ${past ? "text-nu-muted" : evt.itemType === "meeting" ? "text-nu-blue" : "text-nu-pink"}`}>
                      {new Date(evt.start_at).getDate()}
                    </span>
                    <span className={`font-mono-nu text-[10px] ${past ? "text-nu-muted/70" : evt.itemType === "meeting" ? "text-nu-blue/70" : "text-nu-pink/70"}`}>
                      {new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-head text-sm font-bold truncate ${past ? "text-nu-muted line-through decoration-nu-muted/40" : "text-nu-ink"}`}>{evt.title}</p>
                      {past ? (
                        <span className="font-mono-nu text-[11px] bg-nu-ink/5 text-nu-muted px-1.5 py-0.5">지난</span>
                      ) : evt.itemType === "meeting" ? (
                        <span className="font-mono-nu text-[11px] bg-nu-blue/10 text-nu-blue px-1.5 py-0.5">미팅</span>
                      ) : (
                        <span className="font-mono-nu text-[11px] bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">이벤트</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-nu-muted">
                      <span className="flex items-center gap-1"><Clock size={10} />{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}{evt.duration_min && ` (${evt.duration_min}분)`}</span>
                      {evt.location && <span className="flex items-center gap-1"><MapPin size={10} />{evt.location}</span>}
                    </div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
          <Calendar size={32} className="text-nu-muted mx-auto mb-3" />
          <p className="text-nu-gray text-sm">이번 달 등록된 일정이 없습니다</p>
          <p className="text-nu-muted text-xs mt-1">달력 날짜를 클릭하여 일정을 추가하세요</p>
        </div>
      )}

      {/* ========== Day Modal ========== */}
      {dayModalDate && (
        <div className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setDayModalDate(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="하루 일정" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink">
              <div>
                <p className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted">
                  {dayModalDate.toLocaleDateString("ko", { weekday: "long" })}
                </p>
                <h3 className="font-head text-xl font-extrabold text-nu-ink">
                  {dayModalDate.getMonth() + 1}월 {dayModalDate.getDate()}일
                </h3>
              </div>
              <button onClick={() => setDayModalDate(null)} aria-label="닫기" className="p-1 hover:bg-nu-ink/5"><X size={18} /></button>
            </div>

            <div className="p-5">
              {dayEventsForModal.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {dayEventsForModal.map(evt => {
                    const past = isPast(evt);
                    return (
                    <button key={evt.id} onClick={() => openDetail(evt)}
                      className={`w-full flex items-start gap-3 p-3 border-l-[3px] hover:bg-nu-cream/30 transition-colors text-left ${past ? "bg-nu-ink/5 border-nu-ink/20 opacity-70" : evt.itemType === "meeting" ? "bg-nu-blue/5 border-nu-blue" : "bg-nu-pink/5 border-nu-pink"}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${past ? "text-nu-muted line-through decoration-nu-muted/40" : "text-nu-ink"}`}>{evt.title}</p>
                        <p className="text-xs text-nu-muted mt-0.5 flex items-center gap-2">
                          <Clock size={10} />{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                          {evt.location && <><MapPin size={10} className="ml-1" />{evt.location}</>}
                        </p>
                      </div>
                      <span className={`font-mono-nu text-[10px] uppercase px-1.5 py-0.5 shrink-0 ${past ? "bg-nu-ink/5 text-nu-muted" : evt.itemType === "meeting" ? "bg-nu-blue/10 text-nu-blue" : "bg-nu-pink/10 text-nu-pink"}`}>
                        {past ? "지난" : evt.itemType === "meeting" ? "미팅" : "이벤트"}
                      </span>
                    </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-nu-muted py-6">이 날 등록된 일정이 없습니다</p>
              )}

              <div className="flex gap-2 pt-4 border-t border-nu-ink/10">
                <button onClick={() => openCreate(dayModalDate, "meeting")}
                  className="flex-1 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] border-nu-blue text-nu-blue hover:bg-nu-blue hover:text-nu-paper transition-colors inline-flex items-center justify-center gap-1.5">
                  <Plus size={12} /> 미팅
                </button>
                {isHost && (
                  <button onClick={() => openCreate(dayModalDate, "event")}
                    className="flex-1 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors inline-flex items-center justify-center gap-1.5">
                    <Plus size={12} /> 이벤트
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== Create Modal ========== */}
      {createMode && (
        <div className="fixed inset-0 z-[101] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => { if (!saving) { setCreateMode(null); setFormError(null); } }} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="create-modal-title" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink">
              <h3 id="create-modal-title" className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Plus size={18} className={createMode.type === "event" ? "text-nu-pink" : "text-nu-blue"} />
                새 {createMode.type === "event" ? "이벤트" : "미팅"}
              </h3>
              <button onClick={() => !saving && setCreateMode(null)} aria-label="닫기" className="p-1 hover:bg-nu-ink/5"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">제목</label>
                <input autoFocus value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" placeholder="일정 이름" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">시작</label>
                  <input type="datetime-local" value={formStart} onChange={e => setFormStart(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                </div>
                <div>
                  <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">길이 (분)</label>
                  <input type="number" min={15} step={15} value={formDuration} onChange={e => setFormDuration(Math.max(15, Number(e.target.value) || 60))} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">장소 (선택)</label>
                <input value={formLocation} onChange={e => setFormLocation(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" placeholder="오프라인 또는 온라인 링크" />
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">{createMode.type === "event" ? "설명" : "아젠다"} (선택)</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm resize-none" />
              </div>
              <div className="pt-2 border-t border-nu-ink/10">
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">🔁 반복</label>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {(["none", "weekly", "biweekly", "monthly"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRecurrence(r)}
                      className={`px-2 py-1.5 border-[2px] font-mono-nu text-[10px] uppercase tracking-widest transition-colors ${
                        formRecurrence === r ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/20 bg-nu-paper text-nu-graphite hover:border-nu-ink/40"
                      }`}
                    >
                      {r === "none" ? "1회" : r === "weekly" ? "매주" : r === "biweekly" ? "격주" : "매월"}
                    </button>
                  ))}
                </div>
                {formRecurrence !== "none" && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono-nu text-[10px] text-nu-graphite">총</span>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={formRecurrenceCount}
                      onChange={(e) => setFormRecurrenceCount(Math.max(2, Math.min(52, Number(e.target.value) || 2)))}
                      className="w-16 px-2 py-1 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none"
                    />
                    <span className="font-mono-nu text-[10px] text-nu-graphite">회 (최대 52)</span>
                  </div>
                )}
              </div>
              {formError && (
                <div role="alert" className="px-3 py-2 border-l-[3px] border-red-500 bg-red-50 text-red-700 text-xs">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <button onClick={() => { setCreateMode(null); setFormError(null); }} disabled={saving} className="flex-1 px-4 py-2.5 border-[2px] border-nu-ink/20 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50">취소</button>
              <button onClick={handleCreate} disabled={!formTitle.trim() || !formStart || saving} className={`flex-1 px-4 py-2.5 font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-paper disabled:opacity-50 ${createMode.type === "event" ? "bg-nu-pink hover:bg-nu-pink/90" : "bg-nu-blue hover:bg-nu-blue/90"}`}>
                {saving ? "저장 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Detail Modal ========== */}
      {detailEvent && (
        <div className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => { if (!saving) { setDetailEvent(null); setEditingDetail(false); setFormError(null); } }} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="일정 상세" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink ${detailEvent.itemType === "meeting" ? "bg-nu-blue/5" : "bg-nu-pink/5"}`}>
              <div className="flex items-center gap-2 min-w-0">
                {detailEvent.itemType === "meeting" ? <BookOpen size={16} className="text-nu-blue shrink-0" /> : <Calendar size={16} className="text-nu-pink shrink-0" />}
                <span className={`font-mono-nu text-[10px] uppercase tracking-[0.25em] ${detailEvent.itemType === "meeting" ? "text-nu-blue" : "text-nu-pink"}`}>
                  {detailEvent.itemType === "meeting" ? "미팅" : "이벤트"}
                </span>
              </div>
              <button aria-label="닫기" onClick={() => { setDetailEvent(null); setEditingDetail(false); }} className="p-1 hover:bg-nu-ink/10"><X size={18} /></button>
            </div>

            {editingDetail ? (
              <div className="p-5 space-y-3">
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm font-bold" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="datetime-local" value={formStart} onChange={e => setFormStart(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                  <input type="number" min={15} step={15} value={formDuration} onChange={e => setFormDuration(Math.max(15, Number(e.target.value) || 60))} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                </div>
                <input value={formLocation} onChange={e => setFormLocation(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" placeholder="장소" />
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm resize-none" placeholder="설명" />
                {formError && (
                  <div role="alert" className="px-3 py-2 border-l-[3px] border-red-500 bg-red-50 text-red-700 text-xs">
                    {formError}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditingDetail(false)} disabled={saving} className="flex-1 px-4 py-2 border-[2px] border-nu-ink/20 font-mono-nu text-[12px] uppercase hover:bg-nu-ink/5 disabled:opacity-50">취소</button>
                  <button onClick={handleSaveEdit} disabled={saving} className="flex-1 px-4 py-2 bg-nu-ink text-nu-paper font-mono-nu text-[12px] font-bold uppercase disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-3">
                  <h3 className="font-head text-xl font-extrabold text-nu-ink">{detailEvent.title}</h3>
                  <div className="text-sm text-nu-graphite space-y-1.5">
                    <p className="flex items-center gap-2">
                      <Clock size={13} className="text-nu-muted" />
                      {new Date(detailEvent.start_at).toLocaleString("ko", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      {detailEvent.duration_min && <span className="text-nu-muted"> · {detailEvent.duration_min}분</span>}
                    </p>
                    {detailEvent.location && (
                      <p className="flex items-center gap-2"><MapPin size={13} className="text-nu-muted" />{detailEvent.location}</p>
                    )}
                  </div>
                  {detailEvent.description && (
                    <p className="text-sm text-nu-graphite whitespace-pre-wrap pt-2 border-t border-nu-ink/10">{detailEvent.description}</p>
                  )}
                  {detailEvent.itemType === "event" && userId && (
                    <div className="pt-3 border-t border-nu-ink/10">
                      <EventRsvpButton eventId={detailEvent.id} userId={userId} maxAttendees={detailEvent.max_attendees} />
                    </div>
                  )}
                  <div className="pt-3 border-t border-nu-ink/10">
                    <GoogleCalendarButton title={detailEvent.title} startAt={detailEvent.start_at} endAt={detailEvent.end_at} location={detailEvent.location || ""} className="text-[11px] px-3 py-1.5" />
                  </div>
                </div>

                <div className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
                  <Link href={`/groups/${groupId}/${detailEvent.itemType === "meeting" ? "meetings" : "events"}/${detailEvent.id}`}
                    className="flex-1 px-3 py-2 border-[2px] border-nu-ink/20 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 inline-flex items-center justify-center gap-1.5 no-underline text-nu-ink">
                    <ExternalLink size={12} /> 자세히
                  </Link>
                  {isHost && (
                    <>
                      <button onClick={() => setEditingDetail(true)}
                        className="px-3 py-2 border-[2px] border-nu-ink/20 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-1.5">
                        <Edit3 size={12} /> 수정
                      </button>
                      <button onClick={() => setConfirmDelete(detailEvent)}
                        className="px-3 py-2 border-[2px] border-red-500/30 text-red-500 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors inline-flex items-center gap-1.5">
                        <Trash2 size={12} /> 삭제
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========== Delete Confirm Modal ========== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[102] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)} role="presentation">
          <div role="alertdialog" aria-modal="true" aria-label="삭제 확인" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trash2 size={18} className="text-red-500" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">삭제 확인</h3>
              </div>
              <p className="text-sm text-nu-graphite mb-1">
                <span className="font-bold">{confirmDelete.title}</span> 을(를) 삭제하시겠습니까?
              </p>
              <p className="text-xs text-nu-muted">이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 border-[2px] border-nu-ink/20 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink/5">취소</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-red-600">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
