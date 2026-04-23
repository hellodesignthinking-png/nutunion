"use client";

/**
 * AnchorDashboard — Anchor Bolt 전용 운영 대시보드.
 *
 * 구성:
 *  1) MissingInputAlert (3일+ 미입력 시)
 *  2) TodaysPulse (오늘 지표 / 미입력 CTA)
 *  3) MonthlyChart (이번 달 일별 매출)
 *  4) WeeklyPnLTable (최근 4주)
 *  5) DailyInputModal (⌘D 글로벌 숏컷)
 *
 * 사용: <AnchorDashboard projectId={id} monthlyGoal={goal} address={addr} />
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Target, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TodaysPulse } from "./todays-pulse";
import { MonthlyChart } from "./monthly-chart";
import { WeeklyPnLTable } from "./weekly-pnl-table";
import { MissingInputAlert } from "./missing-input-alert";
import { DailyInputModal } from "./daily-input-modal";
import { QuickInsights } from "./quick-insights";
import { MonthlyReportButton } from "./monthly-report-button";
import {
  normalizeDaily,
  rollupWeekly,
  monthBoundaries,
  todayKey,
  fmtCompact,
  type AnchorDaily,
} from "@/lib/bolt/anchor-metrics";
import type { BoltMetricRow } from "@/lib/bolt/types";

interface AnchorSubtype {
  opened_at: string | null;
  address: string | null;
  monthly_revenue_goal_krw: number | null;
  monthly_margin_goal_pct: number | null;
}

interface Props {
  projectId: string;
  title: string;
  /** 페이지가 이미 project_anchor 조회했다면 프리패스, 아니면 내부에서 fetch */
  initialAnchor?: AnchorSubtype;
}

export function AnchorDashboard({ projectId, title, initialAnchor }: Props) {
  const [anchor, setAnchor] = useState<AnchorSubtype | null>(initialAnchor ?? null);
  const [rows, setRows] = useState<BoltMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Anchor subtype 필드 로드 (부모에서 안 준 경우)
  useEffect(() => {
    if (initialAnchor) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("project_anchor")
        .select("opened_at, address, monthly_revenue_goal_krw, monthly_margin_goal_pct")
        .eq("project_id", projectId)
        .maybeSingle();
      if (!cancelled) setAnchor((data as AnchorSubtype) || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialAnchor]);

  const monthlyGoalKrw = anchor?.monthly_revenue_goal_krw ?? null;
  const marginGoalPct = anchor?.monthly_margin_goal_pct ?? null;
  const address = anchor?.address ?? null;
  const openedAt = anchor?.opened_at ?? null;

  // 데이터 로드 — 지난 45일 (이번 달 + 지난 4주 커버)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceD = new Date();
      sinceD.setDate(sinceD.getDate() - 45);
      const since = sinceD.toISOString().slice(0, 10);
      try {
        const res = await fetch(
          `/api/bolts/${projectId}/metrics?period_type=daily&since=${since}&limit=100`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!cancelled) setRows(json.rows || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  // 정규화
  const dailies: AnchorDaily[] = useMemo(() => rows.map(normalizeDaily), [rows]);
  const today = useMemo(() => dailies.find((d) => d.date === todayKey()) || null, [dailies]);
  const weeks = useMemo(() => rollupWeekly(dailies), [dailies]);
  const dates = useMemo(() => dailies.map((d) => d.date), [dailies]);

  // ⌘D 글로벌 숏컷 (cmd/ctrl + d)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 폼 입력 중이면 무시
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // 이번 달
  const now = new Date();
  const monthRange = monthBoundaries(now);
  const monthRows = dailies.filter(
    (d) => d.date >= monthRange.start && d.date <= monthRange.end,
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-xl)]" />
        <div className="h-64 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-xl)]" />
      </div>
    );
  }

  // 오늘 prefill
  const todayPrefill = useMemo(() => {
    const row = rows.find((r) => r.period_start === todayKey() && r.period_type === "daily");
    if (!row) return undefined;
    const m = (row.metrics as any) || {};
    return {
      revenue: m.revenue,
      cost: m.cost,
      customers: m.customers,
      memo: row.memo || "",
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* 매장 헤더 */}
      <header className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-amber/10 to-nu-pink/5 rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center justify-center w-11 h-11 bg-nu-amber/20 text-nu-amber rounded-full shrink-0">
            <Building2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-amber font-bold">
              🏢 Anchor Bolt · 공간형
            </div>
            <h1 className="text-[20px] md:text-[24px] font-head font-extrabold text-nu-ink mt-0.5 leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap mt-2 text-[12px] text-nu-graphite">
              {address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} /> {address}
                </span>
              )}
              {openedAt && (
                <span className="inline-flex items-center gap-1 font-mono-nu tabular-nums">
                  <Building2 size={11} /> 오픈 {new Date(openedAt).toLocaleDateString("ko")}
                </span>
              )}
              {monthlyGoalKrw && (
                <span className="inline-flex items-center gap-1 font-mono-nu tabular-nums">
                  <Target size={11} /> 월목표 {fmtCompact(monthlyGoalKrw)}
                  {marginGoalPct != null && ` · 마진 ${marginGoalPct}%`}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="shrink-0 px-3 py-2 bg-nu-ink text-white rounded-[var(--ds-radius-md)] text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-nu-pink transition-colors"
          >
            <Plus size={12} /> 마감 입력
            <kbd className="hidden md:inline-block ml-1 font-mono-nu text-[9px] px-1 py-0.5 bg-white/20 rounded">⌘D</kbd>
          </button>
        </div>
      </header>

      {/* 미입력 경고 */}
      <MissingInputAlert dailyDates={dates} onOpenInput={() => setModalOpen(true)} />

      {/* Today's Pulse */}
      <TodaysPulse
        today={today}
        monthlyGoal={monthlyGoalKrw}
        onOpenInput={() => setModalOpen(true)}
      />

      {/* Monthly Chart */}
      <MonthlyChart
        dailies={monthRows}
        monthlyGoal={monthlyGoalKrw}
        year={now.getFullYear()}
        month={now.getMonth() + 1}
      />

      {/* Weekly P&L */}
      <WeeklyPnLTable weeks={weeks} />

      {/* AI Quick Insights */}
      <QuickInsights projectId={projectId} />

      {/* 월간 리포트 PDF */}
      <MonthlyReportButton
        projectId={projectId}
        title={title}
        dailies={monthRows}
        weeks={weeks}
        monthlyGoalKrw={monthlyGoalKrw}
        year={now.getFullYear()}
        month={now.getMonth() + 1}
      />

      {/* Input Modal */}
      <DailyInputModal
        projectId={projectId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        initial={todayPrefill}
      />
    </div>
  );
}
