"use client";

/**
 * MonthlyChart — 이번 달 일별 매출 막대차트.
 *
 * - X: 일자 (1~월말)
 * - Y: 매출
 * - 목표선 (월목표 / 일수 = 일 목표) 점선
 * - 미입력 날짜는 0 (막대 없음)
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { AnchorDaily } from "@/lib/bolt/anchor-metrics";
import { fmtCompact, fmtKRW } from "@/lib/bolt/anchor-metrics";

interface Props {
  dailies: AnchorDaily[];
  monthlyGoal?: number | null;
  year?: number;
  month?: number; // 1-12
}

export function MonthlyChart({ dailies, monthlyGoal, year, month }: Props) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const daysInMonth = new Date(y, m, 0).getDate();

  const data = useMemo(() => {
    const byDate = new Map<string, AnchorDaily>();
    for (const d of dailies) byDate.set(d.date, d);

    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const row = byDate.get(key);
      rows.push({
        day,
        date: key,
        revenue: row ? row.revenue : 0,
        cost: row ? row.cost : 0,
        profit: row ? row.profit : 0,
        customers: row ? row.customers : 0,
      });
    }
    return rows;
  }, [dailies, y, m, daysInMonth]);

  const dailyGoal = monthlyGoal ? monthlyGoal / daysInMonth : null;

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const totalCost = data.reduce((s, r) => s + r.cost, 0);
  const daysWithData = data.filter((r) => r.revenue > 0).length;

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b-[2px] border-nu-ink">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
            Monthly Revenue
          </div>
          <div className="text-[14px] font-semibold text-nu-ink mt-0.5">
            {y}년 {m}월 · {daysWithData}/{daysInMonth}일 입력
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">누적 매출</div>
          <div className="font-head text-[20px] font-extrabold text-nu-pink tabular-nums leading-none">
            {fmtKRW(totalRevenue)}
          </div>
          {monthlyGoal && (
            <div className="font-mono-nu text-[10px] text-nu-graphite tabular-nums mt-0.5">
              목표 {fmtCompact(monthlyGoal)} · {Math.round((totalRevenue / monthlyGoal) * 100)}%
            </div>
          )}
        </div>
      </header>

      <div className="p-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#0D0D0D" opacity={0.08} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: "#6B6860", fontFamily: "var(--font-mono-nu)" }}
              interval={Math.ceil(daysInMonth / 10) - 1}
              axisLine={{ stroke: "#0D0D0D", strokeWidth: 1 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => fmtCompact(v)}
              tick={{ fontSize: 9, fill: "#6B6860", fontFamily: "var(--font-mono-nu)" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "#FF48B0", fillOpacity: 0.06 }}
              contentStyle={{
                background: "#FFFFFF",
                border: "2px solid #0D0D0D",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "var(--font-mono-nu)",
              }}
              labelFormatter={(day) => `${m}월 ${day}일`}
              formatter={(value, name) => {
                const label = name === "revenue" ? "매출" : name === "cost" ? "비용" : name === "profit" ? "순이익" : String(name);
                return [fmtKRW(Number(value)), label];
              }}
            />
            <Bar dataKey="revenue" fill="#FF48B0" radius={[2, 2, 0, 0]} maxBarSize={24} />
            {dailyGoal && (
              <ReferenceLine
                y={dailyGoal}
                stroke="#0055FF"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `일목표 ${fmtCompact(dailyGoal)}`,
                  position: "right",
                  fill: "#0055FF",
                  fontSize: 9,
                  fontFamily: "var(--font-mono-nu)",
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 요약 바 */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t-[2px] border-nu-ink/10 bg-nu-cream/20 text-[11px] font-mono-nu">
        <div className="flex gap-4">
          <span className="text-nu-graphite">
            매출 <span className="font-bold text-nu-ink tabular-nums">{fmtCompact(totalRevenue)}</span>
          </span>
          <span className="text-nu-graphite">
            비용 <span className="font-bold text-nu-ink tabular-nums">{fmtCompact(totalCost)}</span>
          </span>
          <span className="text-nu-graphite">
            순이익 <span className="font-bold text-green-700 tabular-nums">{fmtCompact(totalRevenue - totalCost)}</span>
          </span>
        </div>
        {totalRevenue > 0 && (
          <span className="text-nu-graphite">
            마진 <span className="font-bold text-nu-ink tabular-nums">
              {(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
