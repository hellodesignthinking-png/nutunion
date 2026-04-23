"use client";

/**
 * EyeDashboard — Eye Bolt (포트폴리오형).
 *
 * MVP:
 *  - 포트폴리오 헤더 (롤업 규칙, 하위 볼트 개수)
 *  - 통합 KPI 카드 (월매출 합계, 평균 마진, 총 하위)
 *  - Sub-Bolts Grid (하위 볼트 + 각자 핵심 지표 1개)
 *  - Rollup Chart (지점별 월매출 막대, Recharts)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Plus, TrendingUp, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BoltMetricCard } from "@/components/bolt/common/bolt-metric-card";
import { BoltTypeBadge } from "@/components/bolt/bolt-type-badge";
import { asBoltType } from "@/lib/bolt/guards";
import { fmtCompact, fmtKRW, monthBoundaries } from "@/lib/bolt/anchor-metrics";
import type { BoltType } from "@/lib/bolt/types";

interface Child {
  id: string;
  title: string;
  type: BoltType;
  monthRevenue: number;
  monthProfit: number;
  marginPct: number;
}

interface Props {
  projectId: string;
  title: string;
}

export function EyeDashboard({ projectId, title }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [rollupRule, setRollupRule] = useState<string>("sum");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();

      const [eyeRes, childRes] = await Promise.all([
        supabase.from("project_eye").select("rollup_rule").eq("project_id", projectId).maybeSingle(),
        supabase
          .from("projects")
          .select("id, title, type")
          .eq("parent_bolt_id", projectId),
      ]);

      if (cancelled) return;
      setRollupRule((eyeRes.data as any)?.rollup_rule || "sum");

      const kids = (childRes.data as Array<{ id: string; title: string; type: string }>) || [];
      if (kids.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      // 이번 달 metrics 롤업 (각 자식별)
      const { start, end } = monthBoundaries(new Date());
      const ids = kids.map((k) => k.id);
      const { data: metrics } = await supabase
        .from("bolt_metrics")
        .select("project_id, metrics")
        .in("project_id", ids)
        .eq("period_type", "daily")
        .gte("period_start", start)
        .lte("period_start", end);

      const byChild = new Map<string, { revenue: number; cost: number }>();
      for (const m of metrics || []) {
        const k = (m as any).project_id as string;
        const rev = (m as any).metrics?.revenue || {};
        const cost = (m as any).metrics?.cost || {};
        const r = Number(rev.card || 0) + Number(rev.cash || 0) + Number(rev.delivery || 0);
        const c =
          Number(cost.food || 0) +
          Number(cost.supplies || 0) +
          Number(cost.labor || 0) +
          Number(cost.rent || 0) +
          Number(cost.other || 0);
        const prev = byChild.get(k) || { revenue: 0, cost: 0 };
        byChild.set(k, { revenue: prev.revenue + r, cost: prev.cost + c });
      }

      if (cancelled) return;
      const hydrated: Child[] = kids.map((k) => {
        const agg = byChild.get(k.id) || { revenue: 0, cost: 0 };
        const profit = agg.revenue - agg.cost;
        return {
          id: k.id,
          title: k.title,
          type: asBoltType(k.type),
          monthRevenue: agg.revenue,
          monthProfit: profit,
          marginPct: agg.revenue > 0 ? (profit / agg.revenue) * 100 : 0,
        };
      });

      setChildren(hydrated);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(() => {
    const revenue = children.reduce((s, c) => s + c.monthRevenue, 0);
    const profit = children.reduce((s, c) => s + c.monthProfit, 0);
    const avgMargin =
      children.length > 0
        ? children.reduce((s, c) => s + c.marginPct, 0) / children.length
        : 0;
    return { revenue, profit, avgMargin };
  }, [children]);

  const chartData = children.map((c) => ({
    name: c.title.length > 8 ? c.title.slice(0, 8) + "…" : c.title,
    revenue: c.monthRevenue,
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-xl)]" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-nu-ink/5 animate-pulse rounded-[var(--ds-radius-lg)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="border-[2.5px] border-nu-ink bg-gradient-to-br from-purple-100 to-nu-pink/5 rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center justify-center w-11 h-11 bg-purple-100 text-purple-700 rounded-full shrink-0">
            <Layers size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-purple-700 font-bold">
              🔗 Eye Bolt · 포트폴리오형
            </div>
            <h1 className="text-[20px] md:text-[24px] font-head font-extrabold text-nu-ink mt-0.5 leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap mt-2 text-[12px] text-nu-graphite">
              <span className="font-mono-nu">
                롤업 규칙: <strong className="text-nu-ink">{rollupRule}</strong>
              </span>
              <span className="font-mono-nu tabular-nums">
                하위 {children.length}개
              </span>
            </div>
          </div>
          <Link
            href={`/projects/create?parent=${projectId}`}
            className="shrink-0 px-3 py-2 bg-purple-700 text-white rounded-[var(--ds-radius-md)] text-[12px] font-semibold inline-flex items-center gap-1"
          >
            <Plus size={12} /> 하위 볼트 추가
          </Link>
        </div>
      </header>

      {/* 통합 KPI */}
      <section>
        <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
          📊 통합 KPI (이번 달)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <BoltMetricCard
            label="통합 월매출"
            value={fmtKRW(totals.revenue)}
            accent="text-nu-pink"
            icon={<TrendingUp size={11} />}
          />
          <BoltMetricCard
            label="통합 순이익"
            value={fmtKRW(totals.profit)}
            accent={totals.profit >= 0 ? "text-green-700" : "text-nu-pink"}
          />
          <BoltMetricCard
            label="평균 마진"
            value={`${totals.avgMargin.toFixed(1)}%`}
            accent="text-nu-ink"
          />
        </div>
      </section>

      {/* Sub-Bolts Grid */}
      <section>
        <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
          🧩 하위 볼트
        </h3>
        {children.length === 0 ? (
          <div className="p-4 bg-nu-cream/30 text-[12px] text-nu-graphite rounded border-l-[3px] border-purple-400">
            아직 이 포트폴리오에 하위 볼트가 없어요.{" "}
            <Link href={`/projects/create?parent=${projectId}`} className="text-purple-700 font-bold underline">
              첫 볼트 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/projects/${c.id}`}
                className="block p-4 border border-nu-ink/[0.08] hover:border-purple-400 bg-white rounded-[var(--ds-radius-lg)] no-underline"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BoltTypeBadge type={c.type} size="sm" />
                </div>
                <div className="font-semibold text-nu-ink text-[14px] mb-2">{c.title}</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">월매출</div>
                    <div className="font-head text-[16px] font-extrabold text-nu-pink tabular-nums">
                      {fmtCompact(c.monthRevenue)}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-nu-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Rollup Chart */}
      {chartData.length > 0 && (
        <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
          <header className="px-5 py-3 border-b-[2px] border-nu-ink">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
              Revenue Rollup · 이번 달
            </div>
          </header>
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#0D0D0D" opacity={0.08} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6B6860", fontFamily: "var(--font-mono-nu)" }}
                  axisLine={{ stroke: "#0D0D0D", strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => fmtCompact(v)}
                  tick={{ fontSize: 9, fill: "#6B6860", fontFamily: "var(--font-mono-nu)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "#9333EA", fillOpacity: 0.08 }}
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "2px solid #0D0D0D",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "var(--font-mono-nu)",
                  }}
                  formatter={(v) => [fmtKRW(Number(v)), "매출"]}
                />
                <Bar dataKey="revenue" fill="#9333EA" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
