"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Plus, X, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * ProjectCalendar — 볼트의 "일정" 탭. 너트 schedule 페이지와 동일한 시각 패턴.
 *
 * 데이터: project_meetings (scheduled_at + duration_min). 너트 events 같은 별도 테이블은 없음.
 * 뷰: 월/주/목록.
 * 호스트(lead/admin) 는 "+미팅" 버튼으로 즉시 미팅 추가.
 */

interface MeetingItem {
  id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  description: string | null;
  status: string;
}

interface Props {
  projectId: string;
  isAdmin?: boolean;
  isMember?: boolean;
  /** Server-loaded meetings — used as initial state to avoid empty-flash. */
  initialMeetings?: any[];
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToKstIso(s: string) {
  return `${s}:00+09:00`;
}

export function ProjectCalendar({ projectId, isAdmin = false, isMember = false, initialMeetings }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const seeded = Array.isArray(initialMeetings) && initialMeetings.length > 0;
  const [meetings, setMeetings] = useState<MeetingItem[]>(
    seeded ? (initialMeetings as MeetingItem[]) : [],
  );
  // Skip the loading flash when we already have server-rendered data.
  const [loading, setLoading] = useState(!seeded);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formDuration, setFormDuration] = useState(60);
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<MeetingItem | null>(null);

  const canManage = isAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let start: Date;
    let end: Date;
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
    const { data } = await supabase
      .from("meetings")
      .select("id, title, scheduled_at, duration_min, location, description, status")
      .eq("project_id", projectId)
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at");
    setMeetings((data as MeetingItem[]) || []);
    setLoading(false);
  }, [projectId, currentDate, view]);

  useEffect(() => { load(); }, [load]);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (createOpen) setCreateOpen(false);
        else if (detail) setDetail(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, detail]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const weekStart = (() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function getForDay(day: number) {
    return meetings.filter((m) => {
      const d = new Date(m.scheduled_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }
  function getForDate(target: Date) {
    return meetings.filter((m) => {
      const d = new Date(m.scheduled_at);
      return d.getDate() === target.getDate() && d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    });
  }

  const prev = () => setCurrentDate(view === "week" ? new Date(currentDate.getTime() - 7 * 86400000) : new Date(year, month - 1, 1));
  const next = () => setCurrentDate(view === "week" ? new Date(currentDate.getTime() + 7 * 86400000) : new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  function openCreate(date: Date) {
    setCreateDate(date);
    setFormTitle("");
    setFormStart(toLocalInput(date));
    setFormDuration(60);
    setFormLocation("");
    setFormDescription("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!formTitle.trim() || !formStart) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인이 필요해요");
        setSaving(false);
        return;
      }
      const startIso = localInputToKstIso(formStart);
      const { error } = await supabase.from("meetings").insert({
        project_id: projectId,
        title: formTitle.trim(),
        scheduled_at: startIso,
        duration_min: formDuration,
        location: formLocation.trim() || null,
        description: formDescription.trim() || null,
        organizer_id: user.id,
        status: "upcoming",
      });
      if (error) throw error;
      toast.success("일정이 추가됐어요");
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "추가 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-[400px] bg-nu-ink/5 animate-pulse" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={prev} aria-label={view === "week" ? "이전 주" : "이전 달"} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-head text-xl font-bold min-w-[180px] text-center">
            {view === "week"
              ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 주`
              : `${year}년 ${month + 1}월`}
          </h2>
          <button onClick={next} aria-label={view === "week" ? "다음 주" : "다음 달"} className="p-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper transition-colors">오늘</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border-[2px] border-nu-ink/15 overflow-hidden">
            {(["month", "week", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 transition-colors ${view === v ? "bg-nu-ink text-nu-paper" : "text-nu-gray hover:bg-nu-cream"}`}>
                {v === "month" ? "월별" : v === "week" ? "주별" : "목록"}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              onClick={() => openCreate(new Date())}
              className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus size={13} /> 일정 추가
            </button>
          )}
        </div>
      </div>

      {/* Month view */}
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
                const items = getForDay(day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const weekday = (firstDay + day - 1) % 7;
                return (
                  <button
                    key={day}
                    onClick={() => canManage && openCreate(new Date(year, month, day, 10, 0, 0))}
                    className={`min-h-[110px] p-2 border-b border-r border-nu-ink/[0.06] text-left transition-colors hover:bg-nu-pink/[0.04] cursor-pointer relative group ${isToday ? "bg-nu-pink/5" : ""}`}
                    aria-label={`${month + 1}월 ${day}일`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs ${isToday ? "bg-nu-pink text-white rounded-full font-bold" : weekday === 0 ? "text-nu-pink" : weekday === 6 ? "text-nu-blue" : "text-nu-graphite"}`}>{day}</span>
                      {canManage && <Plus size={12} className="text-nu-muted/0 group-hover:text-nu-pink transition-colors" />}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          onClick={(e) => { e.stopPropagation(); setDetail(m); }}
                          className="border-l-[3px] px-2 py-1 hover:opacity-80 transition-opacity cursor-pointer bg-nu-blue/10 border-nu-blue"
                        >
                          <p className="text-[11px] font-medium truncate text-nu-ink">
                            <BookOpen size={9} className="inline mr-1 text-nu-blue" />
                            {m.title}
                          </p>
                          <p className="text-[10px] text-nu-muted">{new Date(m.scheduled_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      ))}
                      {items.length > 3 && <p className="text-[10px] text-nu-muted font-mono-nu pl-2">+{items.length - 3}개 더</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-x-auto mb-8">
          <div className="grid grid-cols-7 min-w-[700px] border-b-[2px] border-nu-ink/[0.08]">
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} className={`p-3 text-center border-r border-nu-ink/[0.06] last:border-r-0 ${isToday ? "bg-nu-pink/5" : ""}`}>
                  <div className={`font-mono-nu text-[10px] uppercase tracking-widest ${i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-muted"}`}>{["일","월","화","수","목","금","토"][i]}</div>
                  <div className={`font-head text-lg font-extrabold mt-0.5 ${isToday ? "text-nu-pink" : "text-nu-ink"}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-w-[700px]">
            {weekDays.map((d, i) => {
              const items = getForDate(d);
              return (
                <button
                  key={i}
                  onClick={() => canManage && openCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0, 0))}
                  className="min-h-[260px] p-2 border-r border-nu-ink/[0.06] last:border-r-0 text-left hover:bg-nu-pink/[0.04] transition-colors cursor-pointer space-y-1 group"
                >
                  {items.length === 0 ? (
                    canManage && <div className="text-[11px] text-nu-muted/50 italic opacity-0 group-hover:opacity-100">+ 일정</div>
                  ) : (
                    items.map((m) => (
                      <div
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); setDetail(m); }}
                        className="border-l-[3px] px-2 py-1.5 hover:opacity-80 transition-opacity cursor-pointer bg-nu-blue/10 border-nu-blue"
                      >
                        <p className="text-[11px] font-bold text-nu-ink truncate">
                          <BookOpen size={9} className="inline mr-1 text-nu-blue" />
                          {m.title}
                        </p>
                        <p className="text-[10px] text-nu-muted">
                          {new Date(m.scheduled_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                          {m.duration_min && ` · ${m.duration_min}분`}
                        </p>
                        {m.location && <p className="text-[10px] text-nu-muted truncate">📍 {m.location}</p>}
                      </div>
                    ))
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {meetings.length > 0 && view === "list" && (
        <div className="flex flex-col gap-3">
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => setDetail(m)}
              className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all overflow-hidden flex flex-col relative group text-left"
            >
              <div className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 flex flex-col items-center justify-center shrink-0 bg-nu-blue/10">
                  <span className="font-head text-base font-extrabold leading-none text-nu-blue">{new Date(m.scheduled_at).getDate()}</span>
                  <span className="font-mono-nu text-[10px] text-nu-blue/70">{new Date(m.scheduled_at).toLocaleDateString("ko", { month: "short" })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-head text-sm font-bold text-nu-ink truncate">{m.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-nu-muted">
                    <span className="flex items-center gap-1"><Clock size={10} />{new Date(m.scheduled_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })} ({m.duration_min}분)</span>
                    {m.location && <span className="flex items-center gap-1"><MapPin size={10} />{m.location}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {meetings.length === 0 && (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
          <Calendar size={32} className="text-nu-muted mx-auto mb-3" />
          <p className="text-nu-gray text-sm">{view === "month" ? "이번 달" : view === "week" ? "이번 주" : ""} 등록된 일정이 없어요</p>
          {canManage && <p className="text-nu-muted text-xs mt-1">달력 날짜를 클릭하거나 "일정 추가" 로 새 미팅을 등록하세요</p>}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setDetail(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink bg-nu-blue/5">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-nu-blue" />
                <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-blue">미팅</span>
              </div>
              <button onClick={() => setDetail(null)} aria-label="닫기" className="p-1 hover:bg-nu-ink/10"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-head text-xl font-extrabold text-nu-ink">{detail.title}</h3>
              <div className="text-sm text-nu-graphite space-y-1.5">
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-nu-muted" />
                  {new Date(detail.scheduled_at).toLocaleString("ko", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  <span className="text-nu-muted"> · {detail.duration_min}분</span>
                </p>
                {detail.location && <p className="flex items-center gap-2"><MapPin size={13} className="text-nu-muted" />{detail.location}</p>}
              </div>
              {detail.description && <p className="text-sm text-nu-graphite whitespace-pre-wrap pt-2 border-t border-nu-ink/10">{detail.description}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <Link
                href={`/projects/${projectId}/meetings/${detail.id}`}
                className="flex-1 px-3 py-2 border-[2px] border-nu-ink/20 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 inline-flex items-center justify-center gap-1.5 no-underline text-nu-ink"
              >
                미팅 상세 →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[101] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => !saving && setCreateOpen(false)} role="presentation">
          <div role="dialog" aria-modal="true" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink">
              <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Plus size={18} className="text-nu-pink" /> 새 미팅
              </h3>
              <button onClick={() => !saving && setCreateOpen(false)} aria-label="닫기" className="p-1 hover:bg-nu-ink/5"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">제목</label>
                <input autoFocus value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" placeholder="미팅 이름" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">시작</label>
                  <input type="datetime-local" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                </div>
                <div>
                  <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">길이 (분)</label>
                  <input type="number" min={15} step={15} value={formDuration} onChange={(e) => setFormDuration(Math.max(15, Number(e.target.value) || 60))} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">장소 (선택)</label>
                <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm" placeholder="오프라인 또는 온라인 링크" />
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-muted mb-1 block">아젠다 (선택)</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <button onClick={() => setCreateOpen(false)} disabled={saving} className="flex-1 px-4 py-2.5 border-[2px] border-nu-ink/20 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50">취소</button>
              <button onClick={handleCreate} disabled={!formTitle.trim() || !formStart || saving} className="flex-1 px-4 py-2.5 bg-nu-pink text-nu-paper font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-nu-pink/90 disabled:opacity-50">
                {saving ? "저장 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
