"use client";

/**
 * WeeklyPnLTable — 지난 4주 P&L 요약.
 */

import { TrendingUp, TrendingDown } from "lucide-react";
import type { WeeklyRollup } from "@/lib/bolt/anchor-metrics";
import { fmtKRW, fmtCompact, fmtPct } from "@/lib/bolt/anchor-metrics";

interface Props {
  weeks: WeeklyRollup[];
}

export function WeeklyPnLTable({ weeks }: Props) {
  const show = weeks.slice(0, 4);
  if (show.length === 0) {
    return (
      <section className="border-[2.5px] border-nu-ink/30 bg-nu-paper rounded-[var(--ds-radius-xl)] p-5 text-center">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
          Weekly P&L
        </div>
        <p className="text-[12px] text-nu-graphite">
          주간 P&L 은 일일 마감 데이터가 쌓이면 자동 계산됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
      <header className="px-5 py-3 border-b-[2px] border-nu-ink">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
          Weekly P&L
        </div>
        <div className="text-[14px] font-semibold text-nu-ink mt-0.5">
          최근 {show.length}주
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b-[2px] border-nu-ink/20 bg-nu-cream/20">
              <th className="text-left px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">주차</th>
              <th className="text-right px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">매출</th>
              <th className="text-right px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">비용</th>
              <th className="text-right px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">순이익</th>
              <th className="text-right px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">마진</th>
              <th className="text-right px-4 py-2 font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">입력일</th>
            </tr>
          </thead>
          <tbody>
            {show.map((w, i) => {
              const prev = show[i + 1];
              const delta = prev ? w.revenue - prev.revenue : 0;
              return (
                <tr key={w.weekStart} className="border-b border-nu-ink/5 hover:bg-nu-cream/10">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-nu-ink">{w.weekLabel}</div>
                    <div className="font-mono-nu text-[10px] text-nu-muted tabular-nums">{w.weekStart}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="font-mono-nu font-semibold text-nu-ink">{fmtCompact(w.revenue)}</div>
                    {prev && delta !== 0 && (
                      <div className={`font-mono-nu text-[10px] inline-flex items-center gap-0.5 ${delta > 0 ? "text-green-700" : "text-nu-pink"}`}>
                        {delta > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {delta > 0 ? "+" : ""}{fmtCompact(delta)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-mono-nu text-nu-graphite">
                    {fmtCompact(w.cost)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-mono-nu font-bold ${w.profit >= 0 ? "text-green-700" : "text-nu-pink"}`}>
                    {fmtCompact(w.profit)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-mono-nu ${w.marginPct >= 0 ? "text-nu-ink" : "text-nu-pink"}`}>
                    {fmtPct(w.marginPct)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-mono-nu text-[10px] text-nu-muted">
                    {w.days}/7
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
