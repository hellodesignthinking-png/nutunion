"use client";

/**
 * UnifiedCalendar — 개인/너트/볼트/구글 일정 통합 뷰.
 * 오늘±3일 주 스트립 + 선택된 날짜 이벤트 리스트.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  Plus,
  Clock,
  Loader2,
  MapPin,
  X,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Src = "personal" | "nut" | "bolt" | "google";

interface Ev {
  id: string;
  title: string;
  start: string; // ISO
  end?: string | null;
  location?: string | null;
  source: Src;
  href?: string | null;
  external?: boolean;
  groupName?: string | null;
  projectName?: string | null;
}

const KST = "Asia/Seoul";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: KST });
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: KST });
}

export function UnifiedCalendar() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [formOpen, setFormOpen] = useState(false);

  // add form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDay);
  const [time, setTime] = useState("10:00");
  const [loc, setLoc] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const now = new Date();
      const start = new Date(now); start.setDate(start.getDate() - 3); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setDate(end.getDate() + 14); end.setHours(23, 59, 59, 999);

      const combined: Ev[] = [];

      // 1) personal_events
      try {
        const res = await fetch(
          `/api/personal/events?since=${start.toISOString()}&until=${end.toISOString()}&limit=100`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const j = await res.json();
          for (const r of j.rows || []) {
            combined.push({
              id: `p-${r.id}`,
              title: r.title,
              start: r.start_at,
              end: r.end_at,
              location: r.location,
              source: "personal",
            });
          }
        }
      } catch { /* noop */ }

      // 2) nut 일정 (내가 속한/호스팅하는 너트의 events + meetings)
      const [{ data: gm }, { data: hosted }] = await Promise.all([
        supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id).eq("status", "active"),
        supabase.from("groups").select("id, name").eq("host_id", user.id),
      ]);
      const groupMap = new Map<string, string>();
      for (const m of ((gm as any[]) || [])) if (m.groups?.name) groupMap.set(m.group_id, m.groups.name);
      for (const g of ((hosted as any[]) || [])) groupMap.set(g.id, g.name);
      const groupIds = Array.from(groupMap.keys());

      if (groupIds.length > 0) {
        const [{ data: evs }, { data: meetings }] = await Promise.all([
          supabase.from("events")
            .select("id, group_id, title, start_at, end_at, location")
            .in("group_id", groupIds)
            .gte("start_at", start.toISOString())
            .lte("start_at", end.toISOString())
            .limit(50),
          supabase.from("meetings")
            .select("id, group_id, title, scheduled_at, duration_min, location, status")
            .in("group_id", groupIds)
            .gte("scheduled_at", start.toISOString())
            .lte("scheduled_at", end.toISOString())
            .not("status", "in", "(cancelled,completed)")
            .limit(50),
        ]);
        for (const e of (evs as any[]) || []) {
          combined.push({
            id: `g-${e.id}`,
            title: e.title,
            start: e.start_at,
            end: e.end_at,
            location: e.location,
            source: "nut",
            href: `/groups/${e.group_id}/events/${e.id}`,
            groupName: groupMap.get(e.group_id),
          });
        }
        for (const m of (meetings as any[]) || []) {
          const startMs = new Date(m.scheduled_at).getTime();
          const endIso = new Date(startMs + (m.duration_min || 60) * 60000).toISOString();
          combined.push({
            id: `m-${m.id}`,
            title: m.title,
            start: m.scheduled_at,
            end: endIso,
            location: m.location,
            source: "nut",
            href: `/groups/${m.group_id}/meetings/${m.id}`,
            groupName: groupMap.get(m.group_id),
          });
        }
      }

      // 3) 볼트 미팅 — project_meetings 있으면
      try {
        const { data: pm } = await supabase
          .from("project_members")
          .select("project_id, projects(id, title)")
          .eq("user_id", user.id);
        const projMap = new Map<string, string>();
        for (const r of ((pm as any[]) || [])) {
          if (r.projects?.title) projMap.set(r.project_id, r.projects.title);
        }
        const projIds = Array.from(projMap.keys());
        if (projIds.length > 0) {
          const { data: pMeetings } = await supabase
            .from("project_meetings")
            .select("id, project_id, title, scheduled_at, duration_min, location")
            .in("project_id", projIds)
            .gte("scheduled_at", start.toISOString())
            .lte("scheduled_at", end.toISOString())
            .limit(30);
          for (const m of ((pMeetings as any[]) || [])) {
            const endIso = new Date(new Date(m.scheduled_at).getTime() + (m.duration_min || 60) * 60000).toISOString();
            combined.push({
              id: `pm-${m.id}`,
              title: m.title,
              start: m.scheduled_at,
              end: endIso,
              location: m.location,
              source: "bolt",
              href: `/projects/${m.project_id}`,
              projectName: projMap.get(m.project_id),
            });
          }
        }
      } catch { /* table may not exist — graceful */ }

      // 4) Google Calendar
      try {
        const res = await fetch("/api/google/calendar?lookahead=14&lookback=3");
        if (res.ok) {
          const data = await res.json();
          for (const e of data.events || []) {
            if (!e.start) continue;
            combined.push({
              id: `gc-${e.id}`,
              title: e.summary || "(제목 없음)",
              start: e.start,
              end: e.end,
              location: e.location,
              source: "google",
              href: e.htmlLink,
              external: true,
            });
          }
        }
      } catch { /* no google */ }

      combined.sort((a, b) => a.start.localeCompare(b.start));
      setEvents(combined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Week strip: today-3 … today+3
  const strip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: Array<{ key: string; date: Date; isToday: boolean; count: number }> = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const k = d.toLocaleDateString("en-CA", { timeZone: KST });
      const count = events.filter((e) => dayKey(e.start) === k).length;
      out.push({ key: k, date: d, isToday: i === 0, count });
    }
    return out;
  }, [events]);

  const dayEvents = useMemo(() => {
    return events.filter((e) => dayKey(e.start) === selectedDay);
  }, [events, selectedDay]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const startIso = `${date}T${time}:00+09:00`;
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + 60 * 60000);
      const res = await fetch("/api/personal/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          location: loc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      setTitle(""); setLoc("");
      setFormOpen(false);
      await load();
      toast.success("일정 추가됨");
    } catch (err: any) {
      toast.error(err?.message || "추가 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="border-[2px] border-nu-ink bg-nu-paper">
      <header className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalIcon size={14} className="text-nu-blue" />
          <span className="font-mono-nu text-[11px] uppercase tracking-[0.25em] text-nu-ink font-bold">
            통합 캘린더
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((v) => !v);
            setDate(selectedDay);
          }}
          className="h-7 px-2 border-[1.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1"
        >
          {formOpen ? <X size={11} /> : <Plus size={11} />}
          {formOpen ? "닫기" : "일정 추가"}
        </button>
      </header>

      {/* Week strip */}
      <div className="grid grid-cols-7 border-b-[2px] border-nu-ink/10">
        {strip.map((d) => {
          const selected = d.key === selectedDay;
          return (
            <button
              key={d.key}
              onClick={() => setSelectedDay(d.key)}
              className={`py-2 flex flex-col items-center border-r border-nu-ink/5 last:border-r-0 transition-colors ${
                selected ? "bg-nu-ink text-nu-paper" : d.isToday ? "bg-nu-pink/10 text-nu-ink hover:bg-nu-pink/20" : "text-nu-ink hover:bg-nu-cream/30"
              }`}
            >
              <span className="font-mono-nu text-[9px] uppercase tracking-widest opacity-70">
                {d.date.toLocaleDateString("ko", { weekday: "short" })}
              </span>
              <span className={`font-head text-[16px] font-extrabold tabular-nums leading-tight ${d.isToday && !selected ? "text-nu-pink" : ""}`}>
                {d.date.getDate()}
              </span>
              {d.count > 0 && (
                <span className={`font-mono-nu text-[9px] tabular-nums ${selected ? "text-nu-paper/80" : "text-nu-muted"}`}>
                  {d.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {formOpen && (
        <form onSubmit={addEvent} className="p-3 border-b-[2px] border-nu-ink/10 bg-nu-cream/20 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목"
            className="w-full px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[13px]"
            required
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[11px] font-mono-nu tabular-nums" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[11px] font-mono-nu tabular-nums" />
            <input type="text" value={loc} onChange={(e) => setLoc(e.target.value)}
              placeholder="장소 (선택)"
              className="flex-1 min-w-[120px] px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[12px]" />
          </div>
          <button type="submit" disabled={adding || !title.trim()}
            className="h-8 px-3 bg-nu-blue text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-40 inline-flex items-center gap-1">
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} 등록
          </button>
        </form>
      )}

      {/* Event list for selected day */}
      <div className="p-3 max-h-[380px] overflow-auto">
        {loading ? (
          <div className="py-6 text-center"><Loader2 size={16} className="animate-spin inline-block text-nu-muted" /></div>
        ) : dayEvents.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-nu-graphite">
            <CalIcon size={16} className="inline-block text-nu-muted/40 mb-1" />
            <p>이 날은 일정이 없어요</p>
          </div>
        ) : (
          <ul className="space-y-1.5 list-none p-0 m-0">
            {dayEvents.map((ev) => (
              <li key={ev.id}>
                <EventRow ev={ev} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EventRow({ ev }: { ev: Ev }) {
  const srcCls = {
    personal: "bg-nu-ink/5 text-nu-graphite",
    nut: "bg-pink-50 text-nu-pink",
    bolt: "bg-purple-50 text-purple-600",
    google: "bg-blue-50 text-blue-500",
  }[ev.source];
  const srcLabel = { personal: "개인", nut: "너트", bolt: "볼트", google: "구글" }[ev.source];
  const timeStr = new Date(ev.start).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit", timeZone: KST });
  const content = (
    <div className="flex items-start gap-2 p-2 border-l-[2px] border-nu-ink/20 bg-nu-cream/10 hover:bg-nu-cream/30 transition-colors">
      <Clock size={11} className="mt-0.5 shrink-0 text-nu-muted" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-nu-ink truncate">{ev.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`font-mono-nu text-[9px] uppercase px-1 py-px ${srcCls}`}>{srcLabel}</span>
          <span className="font-mono-nu text-[10px] tabular-nums text-nu-muted">{timeStr}</span>
          {ev.location && (
            <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] text-nu-muted truncate max-w-[140px]">
              <MapPin size={9} /> {ev.location}
            </span>
          )}
          {ev.groupName && <span className="font-mono-nu text-[10px] text-indigo-500 truncate max-w-[120px]">@ {ev.groupName}</span>}
          {ev.projectName && <span className="font-mono-nu text-[10px] text-purple-500 truncate max-w-[120px]">@ {ev.projectName}</span>}
        </div>
      </div>
      {ev.external && <ExternalLink size={10} className="text-nu-muted shrink-0 mt-0.5" />}
    </div>
  );
  if (ev.href) {
    return ev.external ? (
      <a href={ev.href} target="_blank" rel="noopener noreferrer" className="no-underline block">{content}</a>
    ) : (
      <Link href={ev.href} className="no-underline block">{content}</Link>
    );
  }
  return content;
}
