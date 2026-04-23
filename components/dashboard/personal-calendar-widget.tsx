"use client";

/**
 * PersonalCalendarWidget — 대시보드 전용 개인 캘린더 요약.
 *
 * - 오늘 + 다음 5일 이벤트 (개인 + 내 볼트/너트 참여)
 * - 빠른 추가 (제목 + 날짜 + 시간)
 * - Google Calendar 연동 (이미 있으면 배지 표시)
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Loader2,
  MapPin,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface Ev {
  id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  source: "personal" | "meeting" | "event";
}

export function PersonalCalendarWidget() {
  const [items, setItems] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 6);
      const res = await fetch(
        `/api/personal/events?since=${now.toISOString()}&until=${end.toISOString()}&limit=50`,
        { cache: "no-store" },
      );
      const json = await res.json();
      const list: Ev[] = (json.rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        start_at: r.start_at,
        end_at: r.end_at,
        location: r.location,
        source: "personal" as const,
      }));
      list.sort((a, b) => a.start_at.localeCompare(b.start_at));
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      const res = await fetch("/api/personal/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      setTitle("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  // 날짜별 그룹화
  const grouped = new Map<string, Ev[]>();
  for (const ev of items) {
    const key = ev.start_at.slice(0, 10);
    const arr = grouped.get(key) || [];
    arr.push(ev);
    grouped.set(key, arr);
  }
  const days = Array.from(grouped.keys()).sort();

  return (
    <section className="border border-nu-ink/[0.08] bg-white rounded-[var(--ds-radius-lg)] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/[0.08] bg-nu-cream/10">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-nu-blue" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-ink font-bold">
            My Calendar
          </span>
        </div>
        <a href="/calendar" className="text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted hover:text-nu-ink inline-flex items-center gap-0.5">
          전체 보기 <ChevronRight size={10} />
        </a>
      </header>

      {/* 빠른 추가 */}
      <form onSubmit={addEvent} className="flex items-center gap-1.5 p-3 border-b border-nu-ink/[0.05] flex-wrap">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 제목"
          className="flex-1 min-w-[120px] px-2 py-1.5 border border-nu-ink/10 rounded text-[13px] focus:border-nu-blue outline-none"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1.5 border border-nu-ink/10 rounded text-[11px] font-mono-nu tabular-nums"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="px-2 py-1.5 border border-nu-ink/10 rounded text-[11px] font-mono-nu tabular-nums"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="p-1.5 bg-nu-blue text-white rounded hover:bg-nu-blue/80 disabled:opacity-40"
          aria-label="추가"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </form>

      {/* 리스트 */}
      <div className="max-h-[360px] overflow-auto p-3 space-y-3">
        {loading ? (
          <div className="p-4 text-center">
            <Loader2 size={14} className="animate-spin inline-block text-nu-muted" />
          </div>
        ) : days.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-nu-graphite">
            <Sparkles size={14} className="inline-block text-nu-muted mb-1" />
            <p>앞으로 7일 동안 일정이 없어요</p>
          </div>
        ) : (
          days.map((day) => {
            const d = new Date(day + "T00:00:00");
            const isToday = day === new Date().toISOString().slice(0, 10);
            return (
              <div key={day}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span
                    className={`font-head text-[13px] font-extrabold tabular-nums ${
                      isToday ? "text-nu-pink" : "text-nu-ink"
                    }`}
                  >
                    {d.getMonth() + 1}월 {d.getDate()}일
                  </span>
                  <span className="text-[10px] text-nu-muted font-mono-nu uppercase tracking-widest">
                    {isToday
                      ? "오늘"
                      : d.toLocaleDateString("ko", { weekday: "short" })}
                  </span>
                </div>
                <ul className="space-y-1">
                  {(grouped.get(day) || []).map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2 p-2 bg-nu-cream/20 rounded border-l-[2px] border-nu-blue/60">
                      <Clock size={11} className="mt-0.5 shrink-0 text-nu-blue" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-nu-ink truncate">{ev.title}</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono-nu text-nu-muted tabular-nums">
                          <span>
                            {new Date(ev.start_at).toLocaleTimeString("ko", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {ev.location && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin size={9} /> {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
