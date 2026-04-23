"use client";

/**
 * BoltCalendar — 볼트 상세 페이지의 캘린더 탭.
 *
 * 데이터 소스:
 *  - events (project_id = this)
 *  - meetings (project_id = this, scheduled_at)
 *  - project_milestones.due_date (마감일 표시)
 *
 * 기능:
 *  - 월 달력 그리드 (일요일 시작, 한국 기준)
 *  - 날짜 셀에 이벤트 점 + 제목 일부
 *  - 날짜 클릭 → 그 날의 이벤트 리스트 + "새 이벤트" 모달
 *  - 이전/다음 월 이동
 *  - 마일스톤 마감은 핑크 별표, 회의는 파란 점, 일반 이벤트는 앰버
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Flag,
  X,
  Users,
  ExternalLink,
} from "lucide-react";

type EventKind = "event" | "meeting" | "milestone";

interface CalItem {
  id: string;       // UI 용 prefix 포함 id
  rawId: string;    // 실제 DB id
  kind: EventKind;
  title: string;
  start: Date;
  end?: Date | null;
  location?: string | null;
  url?: string | null;
  linkHref?: string;  // 상세 페이지 경로
}

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function BoltCalendar({ projectId, canEdit }: Props) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [items, setItems] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const monthStart = month;
  const monthEnd = useMemo(() => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [month]);

  // 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const sinceIso = monthStart.toISOString();
      const untilIso = monthEnd.toISOString();

      const [evRes, mtgRes, msRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, start_at, end_at, location")
          .eq("project_id", projectId)
          .gte("start_at", sinceIso)
          .lte("start_at", untilIso),
        supabase
          .from("meetings")
          .select("id, title, scheduled_at, location")
          .eq("project_id", projectId)
          .gte("scheduled_at", sinceIso)
          .lte("scheduled_at", untilIso),
        supabase
          .from("project_milestones")
          .select("id, title, due_date")
          .eq("project_id", projectId)
          .gte("due_date", monthStart.toISOString().slice(0, 10))
          .lte("due_date", monthEnd.toISOString().slice(0, 10)),
      ]);

      if (cancelled) return;

      const list: CalItem[] = [];
      for (const e of (evRes.data as any[]) || []) {
        list.push({
          id: `ev-${e.id}`,
          rawId: e.id,
          kind: "event",
          title: e.title,
          start: new Date(e.start_at),
          end: e.end_at ? new Date(e.end_at) : null,
          location: e.location,
        });
      }
      for (const m of (mtgRes.data as any[]) || []) {
        if (!m.scheduled_at) continue;
        list.push({
          id: `mtg-${m.id}`,
          rawId: m.id,
          kind: "meeting",
          title: m.title,
          start: new Date(m.scheduled_at),
          location: m.location,
          linkHref: `/projects/${projectId}?tab=meetings#meeting-${m.id}`,
        });
      }
      for (const ms of (msRes.data as any[]) || []) {
        if (!ms.due_date) continue;
        list.push({
          id: `ms-${ms.id}`,
          rawId: ms.id,
          kind: "milestone",
          title: ms.title,
          start: new Date(ms.due_date + "T23:59:00"),
          linkHref: `/projects/${projectId}?tab=milestones#milestone-${ms.id}`,
        });
      }
      list.sort((a, b) => a.start.getTime() - b.start.getTime());
      setItems(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, monthStart, monthEnd, refreshKey]);

  // 날짜별 그룹화
  const byDate = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) {
      const key = localDateKey(it.start);
      const arr = map.get(key) || [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  // 월 그리드 셀 (일요일부터 6주 = 42 셀)
  const cells = useMemo(() => {
    const first = new Date(monthStart);
    const startWeekday = first.getDay(); // 0=일
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startWeekday);

    const today = localDateKey(new Date());
    const arr: Array<{ date: Date; inMonth: boolean; key: string; isToday: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push({
        date: d,
        inMonth: d.getMonth() === monthStart.getMonth(),
        key: localDateKey(d),
        isToday: localDateKey(d) === today,
      });
    }
    return arr;
  }, [monthStart]);

  const shiftMonth = (delta: number) => {
    const next = new Date(month);
    next.setMonth(month.getMonth() + delta);
    setMonth(next);
    setSelectedDate(null);
  };

  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setMonth(d);
    setSelectedDate(localDateKey(new Date()));
  };

  const selectedItems = selectedDate ? byDate.get(selectedDate) || [] : [];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-nu-pink" />
          <h2 className="font-head text-[20px] font-extrabold text-nu-ink">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 border border-nu-ink/15 rounded hover:bg-nu-ink hover:text-white"
            aria-label="이전 달"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-2 border border-nu-ink/15 rounded text-[11px] font-mono-nu uppercase tracking-widest hover:bg-nu-ink hover:text-white"
          >
            오늘
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 border border-nu-ink/15 rounded hover:bg-nu-ink hover:text-white"
            aria-label="다음 달"
          >
            <ChevronRight size={14} />
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setSelectedDate(selectedDate || localDateKey(new Date()));
                setCreateOpen(true);
              }}
              className="ml-2 inline-flex items-center gap-1 px-3 py-2 bg-nu-pink text-white rounded text-[12px] font-semibold hover:bg-nu-pink/90"
            >
              <Plus size={12} /> 이벤트 추가
            </button>
          )}
        </div>
      </header>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-[11px] font-mono-nu text-nu-graphite flex-wrap">
        <Legend color="bg-nu-amber" label="이벤트" />
        <Legend color="bg-nu-blue" label="회의" />
        <Legend color="bg-nu-pink" label="마일스톤 마감" />
      </div>

      {/* 그리드 */}
      <div className="border-[2px] border-nu-ink bg-white overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-nu-cream/30 border-b-[2px] border-nu-ink">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div
              key={d}
              className={`px-2 py-2 text-center font-mono-nu text-[10px] uppercase tracking-widest font-bold ${
                i === 0 ? "text-nu-pink" : i === 6 ? "text-nu-blue" : "text-nu-ink"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 grid-rows-6">
          {cells.map((cell, i) => {
            const dayItems = byDate.get(cell.key) || [];
            const isSelected = selectedDate === cell.key;
            const dayOfWeek = cell.date.getDay();
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(cell.key)}
                className={`relative min-h-[82px] p-1.5 border-r border-b border-nu-ink/10 text-left align-top hover:bg-nu-cream/20 transition-colors ${
                  !cell.inMonth ? "bg-nu-ink/[0.02] opacity-50" : ""
                } ${isSelected ? "bg-nu-pink/5 ring-2 ring-inset ring-nu-pink" : ""}`}
              >
                <div
                  className={`text-[12px] font-mono-nu tabular-nums font-bold ${
                    cell.isToday
                      ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-nu-pink text-white"
                      : dayOfWeek === 0
                        ? "text-nu-pink"
                        : dayOfWeek === 6
                          ? "text-nu-blue"
                          : "text-nu-ink"
                  }`}
                >
                  {cell.date.getDate()}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayItems.slice(0, 3).map((it) => (
                    <div
                      key={it.id}
                      className={`text-[10px] truncate flex items-center gap-1 leading-tight ${
                        it.kind === "meeting"
                          ? "text-nu-blue"
                          : it.kind === "milestone"
                            ? "text-nu-pink"
                            : "text-nu-amber"
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                          it.kind === "meeting"
                            ? "bg-nu-blue"
                            : it.kind === "milestone"
                              ? "bg-nu-pink"
                              : "bg-nu-amber"
                        }`}
                      />
                      {it.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-[9px] text-nu-muted font-mono-nu">
                      +{dayItems.length - 3}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택한 날짜의 이벤트 리스트 */}
      {selectedDate && (
        <section className="border border-nu-ink/10 bg-white p-4 rounded">
          <header className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
                선택 날짜
              </div>
              <div className="font-head text-[15px] font-extrabold text-nu-ink">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-nu-ink text-white rounded text-[11px] font-mono-nu uppercase tracking-widest"
              >
                <Plus size={11} /> 추가
              </button>
            )}
          </header>
          {loading ? (
            <p className="text-[12px] text-nu-graphite">로드 중…</p>
          ) : selectedItems.length === 0 ? (
            <p className="text-[12px] text-nu-graphite">이 날짜엔 이벤트가 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 생성 모달 */}
      {createOpen && selectedDate && (
        <CreateEventModal
          projectId={projectId}
          date={selectedDate}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ItemRow({ item }: { item: CalItem }) {
  const Icon = item.kind === "meeting" ? Users : item.kind === "milestone" ? Flag : CalendarIcon;
  const time = item.kind === "milestone"
    ? "마감일"
    : item.start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const accent =
    item.kind === "meeting" ? "text-nu-blue border-nu-blue" : item.kind === "milestone" ? "text-nu-pink border-nu-pink" : "text-nu-amber border-nu-amber";

  const inner = (
    <>
      <div className={`shrink-0 mt-0.5 ${accent.split(" ")[0]}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] text-nu-ink truncate flex items-center gap-1">
          {item.title}
          {item.linkHref && <ChevronRight size={12} className="text-nu-muted" />}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-nu-graphite mt-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1 font-mono-nu tabular-nums">
            <Clock size={10} /> {time}
          </span>
          {item.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} /> {item.location}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-nu-blue underline"
            >
              <ExternalLink size={10} /> 링크
            </a>
          )}
        </div>
      </div>
    </>
  );

  const liClass = `flex items-start gap-3 p-2 border-l-[3px] ${accent} bg-nu-cream/10 rounded-r transition-colors ${
    item.linkHref ? "hover:bg-nu-cream/30 cursor-pointer" : ""
  }`;

  if (item.linkHref) {
    return (
      <li>
        <Link href={item.linkHref} className={`${liClass} no-underline text-inherit`}>
          {inner}
        </Link>
      </li>
    );
  }
  return <li className={liClass}>{inner}</li>;
}

/* ───────── 생성 모달 ───────── */

function CreateEventModal({
  projectId,
  date,
  onClose,
  onCreated,
}: {
  projectId: string;
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function save() {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      const { error } = await supabase.from("events").insert({
        project_id: projectId,
        title: title.trim(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        location: location.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("이벤트가 생성됐어요");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md bg-white rounded-t-[var(--ds-radius-xl)] sm:rounded-[var(--ds-radius-xl)] border border-nu-ink/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/10">
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              새 이벤트
            </div>
            <div className="text-[13px] font-semibold text-nu-ink">
              {new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-nu-cream/50 rounded">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-mono-nu uppercase tracking-widest text-nu-graphite font-bold mb-1">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 스프린트 리뷰"
              autoFocus
              className="w-full px-3 py-2 border-[1.5px] border-nu-ink/15 rounded text-[14px] focus:border-nu-pink outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono-nu uppercase tracking-widest text-nu-graphite font-bold mb-1">
                시작 시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border-[1.5px] border-nu-ink/15 rounded text-[14px] font-mono-nu tabular-nums focus:border-nu-pink outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono-nu uppercase tracking-widest text-nu-graphite font-bold mb-1">
                장소 (선택)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="회의실, Zoom 등"
                className="w-full px-3 py-2 border-[1.5px] border-nu-ink/15 rounded text-[14px] focus:border-nu-pink outline-none"
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 p-4 border-t border-nu-ink/10">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-nu-ink/15 rounded text-[13px]"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 sm:flex-none px-5 py-2 bg-nu-pink text-white rounded text-[13px] font-semibold disabled:opacity-50"
          >
            {saving ? "저장 중…" : "이벤트 생성"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
