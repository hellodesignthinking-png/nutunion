"use client";

/**
 * TodaysPulse — 오늘의 핵심 지표 카드.
 *
 * 상태:
 *  - 미입력: "오늘 마감 미입력 · 지금 입력하기" 큰 CTA
 *  - 입력됨: 매출 · 객수 · 객단가 · 순이익 표시
 */

import { Flame, AlertCircle, TrendingUp, Users, Coffee } from "lucide-react";
import type { AnchorDaily } from "@/lib/bolt/anchor-metrics";
import { fmtKRW, fmtPct } from "@/lib/bolt/anchor-metrics";

interface Props {
  today: AnchorDaily | null;
  monthlyGoal?: number | null;  // 월매출 목표 (참고용)
  onOpenInput: () => void;
}

export function TodaysPulse({ today, monthlyGoal, onOpenInput }: Props) {
  // 미입력 상태
  if (!today) {
    return (
      <button
        type="button"
        onClick={onOpenInput}
        className="w-full text-left border-[2.5px] border-dashed border-nu-pink/60 bg-gradient-to-br from-nu-pink/5 to-nu-amber/5 p-5 rounded-[var(--ds-radius-xl)] hover:border-nu-pink hover:bg-nu-pink/10 transition-colors group"
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-nu-pink text-white rounded-full shrink-0 group-hover:scale-110 transition-transform">
            <AlertCircle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              오늘 마감 미입력
            </div>
            <div className="text-[16px] font-semibold text-nu-ink mt-0.5">
              지금 입력하기 →
            </div>
            <div className="text-[12px] text-nu-graphite mt-1">
              매출·비용·객수를 입력하면 주간/월간 분석이 자동 갱신됩니다.
              <span className="hidden sm:inline"> ( <kbd className="font-mono-nu text-[10px] px-1 py-0.5 bg-nu-ink/5 border border-nu-ink/10 rounded">⌘D</kbd> 단축키 )</span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  // 입력 완료 상태
  const goalPct = monthlyGoal && today.revenue > 0
    ? Math.round((today.revenue * 30 / monthlyGoal) * 100)
    : null;

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/10 to-nu-amber/10">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-ink font-bold">
            Today's Pulse
          </span>
        </div>
        <button
          onClick={onOpenInput}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1 border border-nu-ink/20 hover:bg-nu-ink hover:text-white rounded transition-colors"
        >
          수정
        </button>
      </header>

      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 매출 */}
        <Metric
          icon={<TrendingUp size={12} />}
          label="오늘 매출"
          value={fmtKRW(today.revenue)}
          accent="text-nu-pink"
          sub={goalPct !== null ? `월목표 대비 ${goalPct}%` : undefined}
        />
        {/* 객수 */}
        <Metric
          icon={<Users size={12} />}
          label="객수"
          value={`${today.customers}명`}
          accent="text-nu-blue"
          sub={today.avgTicket > 0 ? `객단가 ${fmtKRW(today.avgTicket)}` : undefined}
        />
        {/* 원가율 */}
        <Metric
          icon={<Coffee size={12} />}
          label="비용 비율"
          value={today.revenue > 0 ? fmtPct((today.cost / today.revenue) * 100) : "—"}
          accent="text-nu-amber"
          sub={`비용 ${fmtKRW(today.cost)}`}
        />
        {/* 순이익 */}
        <Metric
          icon={<Flame size={12} />}
          label="순이익"
          value={fmtKRW(today.profit)}
          accent={today.profit >= 0 ? "text-green-700" : "text-nu-pink"}
          sub={today.revenue > 0 ? `마진 ${fmtPct(today.marginPct)}` : undefined}
        />
      </div>

      {today.memo && (
        <div className="px-5 pb-4">
          <div className="text-[12px] text-nu-graphite italic leading-[1.6] p-3 bg-nu-cream/40 border-l-[3px] border-nu-ink/10">
            “{today.memo}”
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  accent = "text-nu-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-nu-graphite">
        {icon}
        <span className="font-mono-nu text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className={`font-head text-[22px] md:text-[24px] font-extrabold tabular-nums leading-tight mt-1 ${accent}`}>
        {value}
      </div>
      {sub && (
        <div className="font-mono-nu text-[10px] text-nu-muted mt-0.5 tabular-nums">
          {sub}
        </div>
      )}
    </div>
  );
}
