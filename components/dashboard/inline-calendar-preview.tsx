"use client";

/**
 * InlineCalendarPreview — 대시보드 인라인 주간 캘린더.
 *
 * 7일 스트립 × 최대 3개 이벤트 preview.
 * 오늘 컬럼 강조, 클릭 시 해당 날짜 초점으로 전체 UnifiedCalendarDialog 를 연다.
 *
 * Problem 5 해결: "캘린더로 보이는 형식이 없어" — 버튼이 아닌 실제 캘린더 뷰를
 * 대시보드에 직접 노출해 즉시 파악 가능하게 함.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar as CalIcon, Loader2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UnifiedCalendarDialog } from "./unified-calendar-dialog";

const KST = "Asia/Seoul";

type Src = "personal" | "nut" | "bolt" | "google";
interface Ev {
  id: string;
  title: string;
  start: string;
  source: Src;
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: KST });
}
function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: KST });
}

export function InlineCalendarPreview() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const now = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);

      const out: Ev[] = [];

      // personal_events
      try {
        const res = await fetch(
          `/api/personal/events?since=${start.toISOString()}&until=${end.toISOString()}&limit=60`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const j = await res.json();
          for (const r of j.rows || []) {
            out.push({ id: `p-${r.id}`, title: r.title, start: r.start_at, source: "personal" });
          }
        }
      } catch { /* noop */ }

      // nut events + meetings
      const [{ data: gm }, { data: hosted }] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("groups").select("id").eq("host_id", user.id),
      ]);
      const groupIds = [
        ...new Set([
          ...((gm as any[]) || []).map((g) => g.group_id).filter(Boolean),
          ...((hosted as any[]) || []).map((g) => g.id).filter(Boolean),
        ]),
      ];

      if (groupIds.length > 0) {
        const [{ data: evs }, { data: mts }] = await Promise.all([
          supabase.from("events")
            .select("id, title, start_at")
            .in("group_id", groupIds)
            .gte("start_at", start.toISOString())
            .lte("start_at", end.toISOString())
            .limit(40),
          supabase.from("meetings")
            .select("id, title, scheduled_at, status")
            .in("group_id", groupIds)
            .gte("scheduled_at", start.toISOString())
            .lte("scheduled_at", end.toISOString())
            .not("status", "in", "(cancelled,completed)")
            .limit(40),
        ]);
        for (const e of (evs as any[]) || []) out.push({ id: `e-${e.id}`, title: e.title, start: e.start_at, source: "nut" });
        for (const m of (mts as any[]) || []) out.push({ id: `m-${m.id}`, title: m.title, start: m.scheduled_at, source: "nut" });
      }

      out.sort((a, b) => a.start.localeCompare(b.start));
      setEvents(out);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tKey = todayKey();
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arr: Array<{ key: string; date: Date; items: Ev[] }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const k = d.toLocaleDateString("en-CA", { timeZone: KST });
      arr.push({ key: k, date: d, items: events.filter((e) => dayKey(e.start) === k) });
    }
    return arr;
  }, [events]);

  const srcColor: Record<Src, string> = {
    personal: "bg-nu-ink/10 text-nu-ink",
    nut: "bg-nu-pink/15 text-nu-pink",
    bolt: "bg-purple-100 text-purple-700",
    google: "bg-sky-100 text-sky-700",
  };

  return (
    <>
      <section className="bg-white border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
              <CalIcon size={10} /> 이번 주 캘린더
            </span>
            <span className="font-head text-sm md:text-base font-extrabold text-nu-ink uppercase tracking-tight">
              📅 오늘부터 7일
            </span>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper flex items-center gap-1 shrink-0"
          >
            전체 열기 <ChevronRight size={11} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-nu-muted py-6 justify-center">
            <Loader2 size={14} className="animate-spin" /> <span className="text-sm">불러오는 중…</span>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const isToday = d.key === tKey;
              const weekday = d.date.toLocaleDateString("ko", { weekday: "short" });
              const dayNum = d.date.getDate();
              return (
                <button
                  key={d.key}
                  onClick={() => setDialogOpen(true)}
                  className={`flex flex-col items-stretch min-h-[140px] border-[2px] p-1.5 text-left transition-colors ${
                    isToday
                      ? "border-nu-pink bg-nu-pink/5"
                      : "border-nu-ink/15 bg-nu-cream/20 hover:border-nu-ink/40 hover:bg-nu-cream/40"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest ${ isToday ? "text-nu-pink font-bold" : "text-nu-muted"}`}>
                      {weekday}
                    </span>
                    <span className={`font-head text-[17px] font-extrabold tabular-nums ${ isToday ? "text-nu-pink" : "text-nu-ink"}`}>
                      {dayNum}
                    </span>
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {d.items.slice(0, 5).map((ev) => (
                      <div
                        key={ev.id}
                        className={`font-mono-nu text-[10px] px-1.5 py-0.5 truncate leading-tight rounded-sm ${srcColor[ev.source]}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {d.items.length > 5 && (
                      <div className="font-mono-nu text-[9px] text-nu-muted pl-1">+{d.items.length - 5}개 더</div>
                    )}
                    {d.items.length === 0 && (
                      <div className="font-mono-nu text-[9px] text-nu-muted/40 pl-1">일정 없음</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
      <UnifiedCalendarDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
