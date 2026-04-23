"use client";

/**
 * WingDashboard — Wing Bolt (캠페인형) 전용 뷰.
 *
 * MVP:
 *  - 캠페인 헤더 (D-N, 목표 지표, 예산)
 *  - 목표 진도 프로그레스
 *  - 채널별 기여도
 *  - 일별 펀널 (일일 metrics → 라인)
 */

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Target as TargetIcon, Calendar, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BoltMetricCard } from "@/components/bolt/common/bolt-metric-card";
import { WingInputModal } from "./wing-input-modal";
import { fmtCompact, fmtKRW, fmtPct } from "@/lib/bolt/anchor-metrics";

interface WingSubtype {
  goal_metric: string | null;
  goal_value: number | null;
  actual_value: number | null;
  budget_krw: number | null;
  channels: Array<{ name: string; budget?: number; actual?: number }> | null;
}

interface Props {
  projectId: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function WingDashboard({ projectId, title, startDate, endDate }: Props) {
  const [wing, setWing] = useState<WingSubtype | null>(null);
  const [daily, setDaily] = useState<Array<{ date: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const [wRes, mRes] = await Promise.all([
        supabase.from("project_wing").select("*").eq("project_id", projectId).maybeSingle(),
        supabase
          .from("bolt_metrics")
          .select("period_start, metrics")
          .eq("project_id", projectId)
          .eq("period_type", "daily")
          .order("period_start", { ascending: true })
          .limit(90),
      ]);
      if (cancelled) return;
      setWing((wRes.data as WingSubtype) || null);

      // wing 일일 metrics: { attendance, sales, channel: {sns, offline, ...} }
      const points = ((mRes.data as any[]) || []).map((r) => {
        const m = r.metrics || {};
        const val = Number(m.attendance || m.sales || m.value || 0);
        return { date: r.period_start, value: val };
      });
      setDaily(points);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(() => {
    const actual = daily.reduce((s, d) => s + d.value, 0);
    return { actual };
  }, [daily]);

  const goalValue = wing?.goal_value || 0;
  const actualValue = wing?.actual_value ?? totals.actual;
  const pct = goalValue > 0 ? Math.min(100, (actualValue / goalValue) * 100) : 0;

  // D-N 계산
  const now = new Date();
  const end = endDate ? new Date(endDate) : null;
  const dDay = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-xl)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="border-[2.5px] border-nu-ink bg-gradient-to-br from-green-50 to-nu-amber/10 rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center justify-center w-11 h-11 bg-green-100 text-green-700 rounded-full shrink-0">
            <Megaphone size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-green-700 font-bold">
              📢 Wing Bolt · 캠페인형
            </div>
            <h1 className="text-[20px] md:text-[24px] font-head font-extrabold text-nu-ink mt-0.5 leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap mt-2 text-[12px] text-nu-graphite">
              {dDay !== null && (
                <span
                  className={`inline-flex items-center gap-1 font-mono-nu font-bold tabular-nums ${
                    dDay < 0 ? "text-nu-graphite" : dDay <= 3 ? "text-nu-pink" : "text-green-700"
                  }`}
                >
                  <Calendar size={11} />
                  {dDay < 0 ? `D+${Math.abs(dDay)}` : `D-${dDay}`}
                </span>
              )}
              {wing?.goal_metric && wing.goal_value && (
                <span className="inline-flex items-center gap-1 font-mono-nu tabular-nums">
                  <TargetIcon size={11} /> 목표 {wing.goal_metric} {wing.goal_value.toLocaleString("ko-KR")}
                </span>
              )}
              {wing?.budget_krw && (
                <span className="font-mono-nu tabular-nums">예산 {fmtKRW(wing.budget_krw)}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="shrink-0 px-3 py-2 bg-green-700 text-white rounded-[var(--ds-radius-md)] text-[12px] font-semibold inline-flex items-center gap-1"
          >
            <Plus size={12} /> 진도 입력
          </button>
        </div>
      </header>

      {/* 목표 진도 */}
      <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
            목표 달성률
          </div>
          <div className="font-head text-[28px] font-extrabold text-green-700 tabular-nums leading-none">
            {pct.toFixed(0)}%
          </div>
        </div>
        <div className="text-[11px] text-nu-graphite mb-2 tabular-nums font-mono-nu">
          {actualValue.toLocaleString("ko-KR")} / {goalValue.toLocaleString("ko-KR")}{" "}
          {wing?.goal_metric}
        </div>
        <div className="h-2.5 bg-nu-ink/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-700 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {/* 채널별 기여 */}
      {wing?.channels && wing.channels.length > 0 && (
        <section>
          <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
            📡 채널별 기여
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {wing.channels.map((ch, i) => {
              const actual = Number(ch.actual || 0);
              const budget = Number(ch.budget || 0);
              const chPct = budget > 0 ? (actual / budget) * 100 : 0;
              return (
                <BoltMetricCard
                  key={i}
                  label={ch.name}
                  value={actual > 0 ? actual.toLocaleString("ko-KR") : "—"}
                  sub={budget > 0 ? `예산 ${fmtCompact(budget)} · ${chPct.toFixed(0)}%` : undefined}
                  accent="text-green-700"
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 일별 진도 라인 */}
      {daily.length > 1 && (
        <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
          <header className="px-5 py-3 border-b-[2px] border-nu-ink">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
              Daily Funnel
            </div>
          </header>
          <div className="p-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#0D0D0D" opacity={0.08} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#6B6860" }}
                  axisLine={{ stroke: "#0D0D0D", strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 9, fill: "#6B6860" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "2px solid #0D0D0D",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "var(--font-mono-nu)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#047857"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#047857" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 진도 입력 — Wing 전용 모달 */}
      <WingInputModal
        projectId={projectId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        goalMetric={wing?.goal_metric}
        predefinedChannels={wing?.channels?.map((c) => ({ name: c.name }))}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}
