"use client";

/**
 * UnifiedCalendarDialog — Google Calendar-style 통합 캘린더.
 * 일/주/월/년 뷰 지원. 개인 + 너트 + 볼트 일정을 한 화면에.
 *
 * 소스:
 *  - personal_events (user_id=me)
 *  - events (group_id in my groups)
 *  - meetings (group_id in my groups OR project_id in my projects)
 *  - personal_tasks due_date (all-day)
 *  - project_tasks assigned_to=me with due_date
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Calendar as CalIcon, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const KST = "Asia/Seoul";

type EvKind = "personal" | "nut-event" | "nut-meeting" | "bolt-meeting" | "bolt-task" | "personal-task" | "google";
type View = "day" | "week" | "month" | "year";

interface Ev {
  id: string;
  title: string;
  start: string; // ISO
  end?: string | null;
  allDay?: boolean;
  kind: EvKind;
  href?: string | null;
  groupName?: string | null;
  projectName?: string | null;
}

const KIND_COLOR: Record<EvKind, { bg: string; border: string; text: string; label: string }> = {
  "personal": { bg: "bg-nu-ink/10", border: "border-nu-ink", text: "text-nu-ink", label: "개인" },
  "nut-event": { bg: "bg-nu-pink/15", border: "border-nu-pink", text: "text-nu-pink", label: "너트 이벤트" },
  "nut-meeting": { bg: "bg-nu-pink/10", border: "border-nu-pink/70", text: "text-nu-pink", label: "너트 회의" },
  "bolt-meeting": { bg: "bg-nu-blue/15", border: "border-nu-blue", text: "text-nu-blue", label: "볼트 회의" },
  "bolt-task": { bg: "bg-amber-100", border: "border-amber-600", text: "text-amber-700", label: "볼트 할 일" },
  "personal-task": { bg: "bg-nu-ink/5", border: "border-nu-ink/50", text: "text-nu-graphite", label: "개인 할 일" },
  "google": { bg: "bg-green-100", border: "border-green-400", text: "text-green-700", label: "구글" },
};

function kstDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: KST });
}
function kstYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: KST });
}
function kstHour(iso: string): number {
  return Number(new Date(iso).toLocaleString("en-US", { timeZone: KST, hour: "numeric", hour12: false }).replace(/\D/g, "")) || 0;
}
function kstMinute(iso: string): number {
  const s = new Date(iso).toLocaleString("en-US", { timeZone: KST, minute: "2-digit" });
  return Number(s) || 0;
}

function startOfKstDay(dateStr: string): Date {
  // dateStr = "YYYY-MM-DD" in KST
  const [y, m, d] = dateStr.split("-").map(Number);
  // construct 00:00 KST as UTC
  const utc = Date.UTC(y, m - 1, d, -9, 0, 0);
  return new Date(utc);
}

function addDays(dateStr: string, days: number): string {
  const d = startOfKstDay(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return kstDateStr(d);
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nd = new Date(Date.UTC(y, m - 1 + months, d, -9));
  return kstDateStr(nd);
}

function formatMonthTitle(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function UnifiedCalendarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<string>(() => kstDateStr(new Date())); // current focused date YYYY-MM-DD
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEv, setSelectedEv] = useState<Ev | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [googleNotConnected, setGoogleNotConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 뷰에 따라 범위 계산
      let rangeStart: Date, rangeEnd: Date;
      if (view === "day") {
        rangeStart = startOfKstDay(cursor);
        rangeEnd = new Date(rangeStart.getTime() + 86400000);
      } else if (view === "week") {
        // 일요일 기준
        const d = startOfKstDay(cursor);
        const wd = new Date(d.getTime() + 9 * 3600_000).getUTCDay();
        rangeStart = new Date(d.getTime() - wd * 86400000);
        rangeEnd = new Date(rangeStart.getTime() + 7 * 86400000);
      } else if (view === "month") {
        const [y, m] = cursor.split("-").map(Number);
        rangeStart = new Date(Date.UTC(y, m - 1, 1, -9));
        rangeEnd = new Date(Date.UTC(y, m, 1, -9));
      } else {
        // year
        const [y] = cursor.split("-").map(Number);
        rangeStart = new Date(Date.UTC(y, 0, 1, -9));
        rangeEnd = new Date(Date.UTC(y + 1, 0, 1, -9));
      }

      const startIso = rangeStart.toISOString();
      const endIso = rangeEnd.toISOString();

      // 내 그룹/볼트 IDs
      const [{ data: memberships }, { data: hosted }, { data: pm }, { data: createdProjects }] = await Promise.all([
        supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id).eq("status", "active"),
        supabase.from("groups").select("id, name").eq("host_id", user.id),
        supabase.from("project_members").select("project_id, projects(id, title)").eq("user_id", user.id),
        supabase.from("projects").select("id, title").eq("created_by", user.id),
      ]);

      const groupNameMap = new Map<string, string>();
      for (const m of (memberships as any[]) || []) if (m.group_id) groupNameMap.set(m.group_id, m.groups?.name || "");
      for (const g of (hosted as any[]) || []) if (g.id) groupNameMap.set(g.id, g.name || "");
      const groupIds = Array.from(groupNameMap.keys());

      const projectNameMap = new Map<string, string>();
      for (const p of (pm as any[]) || []) if (p.project_id) projectNameMap.set(p.project_id, p.projects?.title || "");
      for (const p of (createdProjects as any[]) || []) if (p.id) projectNameMap.set(p.id, p.title || "");
      const projectIds = Array.from(projectNameMap.keys());

      const all: Ev[] = [];

      // 1) personal_events
      try {
        const { data: pevs } = await supabase
          .from("personal_events")
          .select("id, title, start_at, end_at")
          .eq("user_id", user.id)
          .gte("start_at", startIso)
          .lt("start_at", endIso);
        for (const e of (pevs as any[]) || []) {
          all.push({ id: `pe-${e.id}`, title: e.title, start: e.start_at, end: e.end_at, kind: "personal" });
        }
      } catch {}

      // 2) group events
      if (groupIds.length > 0) {
        try {
          const { data: evs } = await supabase
            .from("events")
            .select("id, title, start_at, end_at, group_id")
            .in("group_id", groupIds)
            .gte("start_at", startIso)
            .lt("start_at", endIso);
          for (const e of (evs as any[]) || []) {
            all.push({
              id: `ge-${e.id}`, title: e.title, start: e.start_at, end: e.end_at,
              kind: "nut-event", groupName: groupNameMap.get(e.group_id) || null,
              href: `/groups/${e.group_id}/events/${e.id}`,
            });
          }
        } catch {}
        try {
          const { data: mts } = await supabase
            .from("meetings")
            .select("id, title, scheduled_at, duration_min, group_id, status")
            .in("group_id", groupIds)
            .gte("scheduled_at", startIso)
            .lt("scheduled_at", endIso)
            .not("status", "in", "(cancelled,completed)");
          for (const m of (mts as any[]) || []) {
            const endMs = new Date(m.scheduled_at).getTime() + (m.duration_min || 60) * 60000;
            all.push({
              id: `gm-${m.id}`, title: m.title, start: m.scheduled_at, end: new Date(endMs).toISOString(),
              kind: "nut-meeting", groupName: groupNameMap.get(m.group_id) || null,
              href: `/groups/${m.group_id}/meetings/${m.id}`,
            });
          }
        } catch {}
      }

      // 3) project meetings
      if (projectIds.length > 0) {
        try {
          const { data: pmts } = await supabase
            .from("meetings")
            .select("id, title, scheduled_at, duration_min, project_id, status")
            .in("project_id", projectIds)
            .gte("scheduled_at", startIso)
            .lt("scheduled_at", endIso)
            .not("status", "in", "(cancelled,completed)");
          for (const m of (pmts as any[]) || []) {
            const endMs = new Date(m.scheduled_at).getTime() + (m.duration_min || 60) * 60000;
            all.push({
              id: `pm-${m.id}`, title: m.title, start: m.scheduled_at, end: new Date(endMs).toISOString(),
              kind: "bolt-meeting", projectName: projectNameMap.get(m.project_id) || null,
              href: `/projects/${m.project_id}/meetings/${m.id}`,
            });
          }
        } catch {}

        // 4) project_tasks assigned to me with due_date in range
        try {
          const { data: tasks } = await supabase
            .from("project_tasks")
            .select("id, title, due_date, project_id, status")
            .eq("assigned_to", user.id)
            .in("project_id", projectIds)
            .not("due_date", "is", null);
          for (const t of (tasks as any[]) || []) {
            const iso = startOfKstDay(t.due_date).toISOString();
            if (iso >= startIso && iso < endIso) {
              all.push({
                id: `pt-${t.id}`, title: t.title, start: iso, allDay: true,
                kind: "bolt-task", projectName: projectNameMap.get(t.project_id) || null,
                href: `/projects/${t.project_id}`,
              });
            }
          }
        } catch {}
      }

      // 5b) Google Calendar events
      try {
        const gres = await fetch(`/api/personal/google-calendar?since=${encodeURIComponent(startIso)}&until=${encodeURIComponent(endIso)}`);
        if (gres.ok) {
          const gdata = await gres.json();
          setGoogleNotConnected(!!gdata.not_connected);
          for (const e of (gdata.events || []) as any[]) {
            if (!e.start_at) continue;
            all.push({
              id: `gc-${e.id}`,
              title: e.title,
              start: e.start_at,
              end: e.end_at || null,
              allDay: !!e.all_day,
              kind: "google",
              href: e.html_link || null,
            });
          }
        }
      } catch {}

      // 6) personal_tasks due_date
      try {
        const { data: ptasks } = await supabase
          .from("personal_tasks")
          .select("id, title, due_date, status")
          .eq("user_id", user.id)
          .not("due_date", "is", null);
        for (const t of (ptasks as any[]) || []) {
          const iso = startOfKstDay(t.due_date).toISOString();
          if (iso >= startIso && iso < endIso) {
            all.push({ id: `pptk-${t.id}`, title: t.title, start: iso, allDay: true, kind: "personal-task" });
          }
        }
      } catch {}

      setEvents(all);
    } finally {
      setLoading(false);
    }
  }, [cursor, view]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) {
      const key = kstYmd(e.start);
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    // sort each
    for (const arr of map.values()) arr.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [events]);

  function nav(dir: -1 | 1 | 0) {
    if (dir === 0) { setCursor(kstDateStr(new Date())); return; }
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else if (view === "month") setCursor(addMonths(cursor, dir));
    else setCursor(addMonths(cursor, dir * 12));
  }

  async function createPersonalEvent() {
    if (!newTitle.trim() || !newStart) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const startIso = new Date(newStart).toISOString();
    const { error } = await supabase.from("personal_events").insert({
      user_id: user.id,
      title: newTitle.trim(),
      start_at: startIso,
    });
    if (!error) {
      setCreating(false);
      setNewTitle("");
      setNewStart("");
      load();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="bg-white border-0 md:border-[4px] border-nu-ink md:shadow-[8px_8px_0_0_#0D0F14] w-full max-w-6xl h-[100vh] md:h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 md:p-4 border-b-[3px] border-nu-ink flex-wrap">
          <CalIcon size={16} className="text-nu-pink" />
          <h2 className="font-head text-lg md:text-xl font-extrabold text-nu-ink tracking-tight uppercase">
            통합 캘린더
          </h2>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => nav(-1)} className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"><ChevronLeft size={14} /></button>
            <button onClick={() => nav(0)} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper">오늘</button>
            <button onClick={() => nav(1)} className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"><ChevronRight size={14} /></button>
          </div>
          <span className="font-head text-base md:text-lg font-bold text-nu-ink ml-2">
            {view === "year" ? `${cursor.split("-")[0]}년` : formatMonthTitle(cursor)}
            {view === "day" && ` · ${Number(cursor.split("-")[2])}일`}
          </span>
          <div className="ml-auto flex items-center gap-1 w-full md:w-auto order-3 md:order-none">
            <div className="grid grid-cols-4 md:inline-flex md:w-auto w-full gap-1 flex-1 md:flex-none">
              {(["day", "week", "month", "year"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`font-mono-nu text-[10px] md:text-[11px] uppercase tracking-widest px-2 md:px-2.5 py-1 border-[2px] ${view === v ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/30 hover:border-nu-ink"}`}
                >
                  {v === "day" ? "일" : v === "week" ? "주" : v === "month" ? "월" : "년"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="font-mono-nu text-[10px] md:text-[11px] uppercase tracking-widest px-2 md:px-2.5 py-1 border-[2px] border-nu-pink bg-nu-pink text-nu-paper hover:bg-nu-ink flex items-center gap-1 shrink-0"
            >
              <Plus size={11} /> 일정
            </button>
            <button onClick={onClose} className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper ml-1 shrink-0"><X size={14} /></button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 px-3 md:px-4 py-2 border-b border-nu-ink/10 text-[10px] font-mono-nu uppercase tracking-widest">
          {(Object.keys(KIND_COLOR) as EvKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={`inline-block w-3 h-3 ${KIND_COLOR[k].bg} border ${KIND_COLOR[k].border}`} />
              <span className="text-nu-graphite">{KIND_COLOR[k].label}</span>
            </span>
          ))}
          {googleNotConnected && (
            <Link href="/settings/integrations" className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-green-600 text-green-700 bg-green-50 no-underline hover:bg-green-100">
              Google Calendar 연결 →
            </Link>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-nu-pink" />
            </div>
          )}
          {view === "month" && <MonthView cursor={cursor} byDay={byDay} onPickEv={setSelectedEv} />}
          {view === "week" && <WeekView cursor={cursor} events={events} onPickEv={setSelectedEv} />}
          {view === "day" && <DayView cursor={cursor} events={events} onPickEv={setSelectedEv} />}
          {view === "year" && <YearView cursor={cursor} byDay={byDay} onPickMonth={(m) => { setCursor(m); setView("month"); }} />}
        </div>

        {/* Inline create form */}
        {creating && (
          <div className="border-t-[3px] border-nu-ink bg-nu-cream/40 p-3 flex flex-wrap gap-2 items-center">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">개인 일정 추가</span>
            <input
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="제목" className="flex-1 min-w-[200px] px-2 py-1.5 border-[2px] border-nu-ink/30 focus:border-nu-ink text-sm"
            />
            <input
              type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)}
              className="px-2 py-1.5 border-[2px] border-nu-ink/30 focus:border-nu-ink text-sm"
            />
            <button onClick={createPersonalEvent} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink">저장</button>
            <button onClick={() => setCreating(false)} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/30">취소</button>
          </div>
        )}

        {/* Side panel for selected event — bottom sheet on mobile, inline bar on desktop */}
        {selectedEv && (
          <div className="fixed md:static inset-x-0 bottom-0 z-[60] border-t-[3px] border-nu-ink bg-white p-3 md:p-4 flex items-start gap-3 flex-wrap max-h-[70vh] overflow-auto shadow-[0_-8px_0_0_rgba(13,15,20,0.08)] md:shadow-none">
            <div className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border ${KIND_COLOR[selectedEv.kind].border} ${KIND_COLOR[selectedEv.kind].bg} ${KIND_COLOR[selectedEv.kind].text}`}>
              {KIND_COLOR[selectedEv.kind].label}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-head text-lg font-extrabold text-nu-ink truncate">{selectedEv.title}</div>
              <div className="text-xs text-nu-muted">
                {new Date(selectedEv.start).toLocaleString("ko-KR", { timeZone: KST, dateStyle: "medium", timeStyle: "short" })}
                {selectedEv.groupName ? ` · ${selectedEv.groupName}` : ""}
                {selectedEv.projectName ? ` · ${selectedEv.projectName}` : ""}
              </div>
            </div>
            {selectedEv.href && (
              <Link href={selectedEv.href} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper no-underline">
                상세 페이지 →
              </Link>
            )}
            <button onClick={() => setSelectedEv(null)} className="p-1.5 border-[2px] border-nu-ink/30"><X size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Month View — 7xN grid
// ─────────────────────────────────────────────────────────────────────────
function MonthView({ cursor, byDay, onPickEv }: { cursor: string; byDay: Map<string, Ev[]>; onPickEv: (e: Ev) => void }) {
  const [y, m] = cursor.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1, -9));
  const wd = new Date(firstOfMonth.getTime() + 9 * 3600_000).getUTCDay();
  const gridStart = new Date(firstOfMonth.getTime() - wd * 86400000);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) cells.push(kstDateStr(new Date(gridStart.getTime() + i * 86400000)));
  const today = kstDateStr(new Date());

  return (
    <div className="p-2">
      <div className="grid grid-cols-7 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={`font-mono-nu text-[10px] uppercase tracking-widest text-center py-1 ${i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-muted"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[1px] bg-nu-ink/10 border border-nu-ink/10">
        {cells.map((c, i) => {
          const mine = byDay.get(c) || [];
          const [cy, cm] = c.split("-").map(Number);
          const inMonth = cy === y && cm === m;
          const isToday = c === today;
          return (
            <div key={c} className={`bg-white min-h-[90px] p-1 ${inMonth ? "" : "opacity-40"} ${isToday ? "ring-2 ring-nu-pink ring-inset" : ""}`}>
              <div className={`font-mono-nu text-[11px] ${isToday ? "text-nu-pink font-bold" : "text-nu-graphite"} mb-0.5`}>
                {Number(c.split("-")[2])}
              </div>
              <div className="space-y-0.5">
                {mine.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onPickEv(e)}
                    className={`w-full text-left truncate px-1 py-[1px] text-[10px] md:text-xs border-l-2 ${KIND_COLOR[e.kind].bg} ${KIND_COLOR[e.kind].border} ${KIND_COLOR[e.kind].text}`}
                  >
                    {e.title}
                  </button>
                ))}
                {mine.length > 3 && (
                  <div className="text-[9px] text-nu-muted font-mono-nu px-1">+{mine.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Week / Day view (hour grid)
// ─────────────────────────────────────────────────────────────────────────
function HourGrid({ days, events, onPickEv }: { days: string[]; events: Ev[]; onPickEv: (e: Ev) => void }) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_PX = 44;
  const today = kstDateStr(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px]">
      {/* hour column */}
      <div className="w-12 shrink-0 border-r border-nu-ink/10 sticky left-0 bg-white z-[1]">
        <div className="h-8" />
        {HOURS.map((h) => (
          <div key={h} className="font-mono-nu text-[9px] text-nu-muted text-right pr-1" style={{ height: HOUR_PX }}>
            {String(h).padStart(2, "0")}
          </div>
        ))}
      </div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const dayEvs = events.filter((e) => kstYmd(e.start) === d);
          const allDay = dayEvs.filter((e) => e.allDay);
          const timed = dayEvs.filter((e) => !e.allDay);
          const isToday = d === today;
          return (
            <div key={d} className="relative border-r border-nu-ink/10 last:border-r-0">
              <div className={`h-8 text-center border-b border-nu-ink/10 py-1 sticky top-0 bg-white z-[1] ${isToday ? "bg-nu-pink/10" : ""}`}>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{d.slice(5)}</div>
                <div className="flex flex-wrap gap-[1px] justify-center px-1">
                  {allDay.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={() => onPickEv(e)} className={`text-[9px] px-1 ${KIND_COLOR[e.kind].bg} ${KIND_COLOR[e.kind].text} border ${KIND_COLOR[e.kind].border} truncate max-w-full`}>
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
              {/* hour cells */}
              <div className="relative">
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-nu-ink/5" style={{ height: HOUR_PX }} />
                ))}
                {timed.map((e) => {
                  const startH = kstHour(e.start);
                  const startM = kstMinute(e.start);
                  const top = startH * HOUR_PX + (startM / 60) * HOUR_PX;
                  const durMin = e.end ? Math.max(30, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000) : 60;
                  const height = Math.max(20, (durMin / 60) * HOUR_PX);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onPickEv(e)}
                      className={`absolute left-0.5 right-0.5 ${KIND_COLOR[e.kind].bg} border-l-4 ${KIND_COLOR[e.kind].border} ${KIND_COLOR[e.kind].text} text-[10px] px-1 py-0.5 overflow-hidden text-left`}
                      style={{ top, height }}
                    >
                      <div className="font-semibold truncate">{e.title}</div>
                      <div className="font-mono-nu text-[9px] opacity-70">
                        {String(startH).padStart(2, "0")}:{String(startM).padStart(2, "0")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function WeekView({ cursor, events, onPickEv }: { cursor: string; events: Ev[]; onPickEv: (e: Ev) => void }) {
  const d = startOfKstDay(cursor);
  const wd = new Date(d.getTime() + 9 * 3600_000).getUTCDay();
  const sunday = new Date(d.getTime() - wd * 86400000);
  const days = Array.from({ length: 7 }, (_, i) => kstDateStr(new Date(sunday.getTime() + i * 86400000)));
  return <HourGrid days={days} events={events} onPickEv={onPickEv} />;
}

function DayView({ cursor, events, onPickEv }: { cursor: string; events: Ev[]; onPickEv: (e: Ev) => void }) {
  return <HourGrid days={[cursor]} events={events} onPickEv={onPickEv} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Year view — 12 mini month calendars
// ─────────────────────────────────────────────────────────────────────────
function YearView({ cursor, byDay, onPickMonth }: { cursor: string; byDay: Map<string, Ev[]>; onPickMonth: (monthCursor: string) => void }) {
  const [y] = cursor.split("-").map(Number);
  const today = kstDateStr(new Date());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
      {Array.from({ length: 12 }, (_, mi) => {
        const firstOfMonth = new Date(Date.UTC(y, mi, 1, -9));
        const wd = new Date(firstOfMonth.getTime() + 9 * 3600_000).getUTCDay();
        const gridStart = new Date(firstOfMonth.getTime() - wd * 86400000);
        const cells: string[] = [];
        for (let i = 0; i < 42; i++) cells.push(kstDateStr(new Date(gridStart.getTime() + i * 86400000)));
        const monthStr = `${y}-${String(mi + 1).padStart(2, "0")}-01`;
        return (
          <button
            key={mi}
            onClick={() => onPickMonth(monthStr)}
            className="border-[2px] border-nu-ink/20 hover:border-nu-ink p-2 bg-white text-left"
          >
            <div className="font-head text-sm font-bold text-nu-ink mb-1">{mi + 1}월</div>
            <div className="grid grid-cols-7 gap-[1px]">
              {["일","월","화","수","목","금","토"].map((d, i) => (
                <div key={d} className={`text-[8px] font-mono-nu text-center ${i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-muted"}`}>{d}</div>
              ))}
              {cells.map((c) => {
                const [cy, cm] = c.split("-").map(Number);
                const inMonth = cy === y && cm === mi + 1;
                const count = (byDay.get(c) || []).length;
                const isToday = c === today;
                return (
                  <div key={c} className={`text-[9px] text-center relative ${inMonth ? "text-nu-ink" : "text-nu-muted/40"} ${isToday ? "bg-nu-pink/20" : ""}`}>
                    {Number(c.split("-")[2])}
                    {count > 0 && inMonth && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-nu-pink" />
                    )}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
