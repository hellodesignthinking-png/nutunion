"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sun, CloudRain, Cloud, Snowflake, Wind, RefreshCw, Loader2,
  Calendar, CheckSquare, AlertTriangle, MessageSquare, Activity, Target, Sparkles,
} from "lucide-react";

interface Weather {
  temp_C: number;
  feels_like_C: number;
  desc: string;
  precip_mm: number;
  humidity: number;
  wind_kph: number;
  hi_C?: number;
  lo_C?: number;
  outfit_hint: string;
}

interface ScheduleHighlight {
  title: string;
  why: string;
  time?: string | null;
  source?: string | null;
}

interface RawItem {
  title: string;
  time: string | null;
  source: string;
  due?: string | null;
  is_overdue?: boolean;
}

interface Brief {
  greeting: string;
  weather: Weather | null;
  schedule_highlights: ScheduleHighlight[];
  activity_tip: string;
  strategy_tip: string;
  text: string;
  context_summary: {
    meetings_today: number;
    tasks_overdue: number;
    tasks_today: number;
    unread_chats: number;
    tasks_no_due?: number;
    upcoming_events?: number;
  };
  raw_items?: RawItem[];
  model_used?: string | null;
  nickname?: string;
  date?: string;
}

/**
 * strategy_tip 이 AI 에서 가끔 **볼드**, - 리스트, \n 반복, 이스케이프 문자로 오는 경우가 있어
 * 일반 텍스트로 보이도록 정리. 첫 2문장 유지.
 */
function sanitizeStrategyTip(raw: string): string {
  if (!raw) return "";
  const s = raw
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^\s*[-·•]\s*/gm, "")
    .replace(/\\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  // 첫 2문장까지만 노출 (과도한 장문 방지)
  const parts = s.split(/(?<=[.!?。！？])\s+/);
  return parts.slice(0, 2).join(" ").trim() || s;
}

function pickWeatherIcon(w: Weather | null) {
  if (!w) return Sun;
  const d = (w.desc || "").toLowerCase();
  if (w.precip_mm >= 0.5 || /rain|shower|drizzle|비/.test(d)) return CloudRain;
  if (/snow|눈/.test(d)) return Snowflake;
  if (/cloud|overcast|흐림/.test(d)) return Cloud;
  if (w.wind_kph >= 25) return Wind;
  return Sun;
}

function fmtTime(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  } catch { return null; }
}

export function MorningBriefing() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 로드 — 캐시 우선. 같은 날 다시 방문해도 AI 재생성 없음.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/morning-briefing", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Brief;
      setBrief(data);
    } catch (err: any) {
      setError(err?.message || "브리핑 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  // 명시적 재생성 — POST 로 새 브리핑 생성 & 캐시 갱신
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/morning-briefing", {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Brief;
      setBrief(data);
    } catch (err: any) {
      setError(err?.message || "브리핑 재생성 실패");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const WIcon = pickWeatherIcon(brief?.weather || null);

  return (
    <section className="relative bg-emerald-50 border-[3px] border-emerald-800 shadow-[4px_4px_0_0_#0D0F14] p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-emerald-300 text-nu-ink border-[2px] border-emerald-800">
            <Sparkles size={10} /> AI 브리핑
          </span>
          <h2 className="font-head text-lg md:text-xl font-extrabold text-nu-ink tracking-tight uppercase">
            오늘의 브리핑
          </h2>
          {brief?.model_used && (
            <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted bg-white/70 px-2 py-0.5 border border-emerald-800/20 hidden md:inline-flex">
              {brief.model_used}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading || refreshing}
          className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-emerald-800 bg-white hover:bg-emerald-800 hover:text-nu-paper disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {refreshing || loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          다시 브리핑
        </button>
      </div>

      {loading && !brief ? (
        <div className="flex items-center gap-2 text-nu-muted py-6">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">브리핑 생성 중…</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="text-sm text-red-600">{error}</div>
          <button
            onClick={load}
            disabled={loading}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-emerald-800 bg-white hover:bg-emerald-800 hover:text-nu-paper disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw size={11} /> 다시 시도
          </button>
        </div>
      ) : brief ? (
        <div className="space-y-4">
          {/* Greeting */}
          <p className="text-[15px] md:text-base leading-relaxed text-nu-ink font-medium">
            {brief.greeting}
          </p>

          {/* Weather */}
          {brief.weather && (
            <Sub
              icon={WIcon}
              label="날씨 & 옷차림"
              color="text-sky-700"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-head text-2xl font-extrabold text-nu-ink">
                  {Math.round(brief.weather.temp_C)}°
                </span>
                <span className="text-sm text-nu-ink/80">
                  {brief.weather.desc}
                </span>
                {brief.weather.hi_C != null && brief.weather.lo_C != null && (
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
                    H {brief.weather.hi_C}° · L {brief.weather.lo_C}°
                  </span>
                )}
                {brief.weather.precip_mm > 0 && (
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-sky-700">
                    💧 {brief.weather.precip_mm}mm
                  </span>
                )}
              </div>
              <p className="text-sm text-nu-ink/90 mt-1">
                {brief.weather.outfit_hint}
              </p>
            </Sub>
          )}

          {/* Schedule */}
          {brief.schedule_highlights.length > 0 && (
            <Sub icon={Calendar} label="오늘의 핵심 일정" color="text-indigo-700">
              <ul className="list-none m-0 p-0 space-y-1.5">
                {brief.schedule_highlights.map((h, i) => {
                  const t = fmtTime(h.time);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-800/30 mt-0.5 shrink-0">
                        {t || (h.source === "task" ? "할 일" : "·")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-nu-ink">{h.title}</div>
                        <div className="text-[13px] text-nu-ink/70 leading-snug">{h.why}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Sub>
          )}

          {/* Activity Tip */}
          {brief.activity_tip && (
            <Sub icon={Activity} label="활동 추천" color="text-rose-600">
              <p className="text-sm text-nu-ink/90">{brief.activity_tip}</p>
            </Sub>
          )}

          {/* Strategy Tip */}
          {brief.strategy_tip && (
            <Sub icon={Target} label="전략 포인트" color="text-amber-700">
              <p className="text-sm text-nu-ink font-medium whitespace-pre-line">
                {sanitizeStrategyTip(brief.strategy_tip)}
              </p>
            </Sub>
          )}

          {/* Raw Items — 실제 할일/일정 목록 */}
          {brief.raw_items && brief.raw_items.length > 0 && (
            <Sub icon={CheckSquare} label="전체 할일 &amp; 일정 목록" color="text-emerald-700">
              <div className="space-y-1">
                {brief.raw_items.map((item, i) => {
                  const isOverdue = item.is_overdue;
                  const isUpcoming = item.source.startsWith("upcoming-");
                  const isNoDue = item.source.startsWith("no-due");
                  const fmtDate = item.time
                    ? new Date(item.time).toLocaleDateString("ko", { month: "short", day: "numeric", weekday: "short" })
                    : item.due || null;
                  let badge = "·";
                  let badgeCls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                  if (isOverdue) { badge = "밀린"; badgeCls = "bg-red-50 border-red-300 text-red-700"; }
                  else if (item.source.startsWith("today")) { badge = "오늘"; badgeCls = "bg-amber-50 border-amber-300 text-amber-800"; }
                  else if (isUpcoming) { badge = "예정"; badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-700"; }
                  else if (isNoDue) { badge = "진행"; badgeCls = "bg-gray-50 border-gray-300 text-gray-600"; }
                  else if (item.source === "event" || item.source === "meeting") { badge = "일정"; badgeCls = "bg-sky-50 border-sky-300 text-sky-700"; }
                  return (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border shrink-0 ${badgeCls}`}>
                        {badge}
                      </span>
                      <span className="text-[13px] text-nu-ink flex-1 truncate">{item.title}</span>
                      {fmtDate && (
                        <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{fmtDate}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Sub>
          )}

          {/* Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Chip icon={Calendar} label="미팅" value={brief.context_summary.meetings_today} accent="text-indigo-700" />
            <Chip icon={CheckSquare} label="할 일" value={brief.context_summary.tasks_today} accent="text-emerald-700" />
            <Chip icon={AlertTriangle} label="밀린 일" value={brief.context_summary.tasks_overdue} accent="text-red-600" />
            <Chip icon={MessageSquare} label="안 읽음" value={brief.context_summary.unread_chats} accent="text-nu-pink" />
            {(brief.context_summary.tasks_no_due || 0) > 0 && (
              <Chip icon={Activity} label="진행 중" value={brief.context_summary.tasks_no_due || 0} accent="text-gray-500" />
            )}
            {(brief.context_summary.upcoming_events || 0) > 0 && (
              <Chip icon={Calendar} label="이번 주" value={brief.context_summary.upcoming_events || 0} accent="text-violet-600" />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Sub({ icon: Icon, label, color, children }: { icon: any; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 border-[2px] border-emerald-800/30 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className={color} />
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Chip({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 bg-white border-[2px] border-emerald-800/30 px-3 py-1.5 font-mono-nu text-[11px] uppercase tracking-widest ${value > 0 ? "text-nu-ink" : "text-nu-muted"}`}>
      <Icon size={11} className={accent} />
      {label} <strong className="font-bold">{value}</strong>
    </span>
  );
}
