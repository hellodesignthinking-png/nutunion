"use client";

/**
 * BoltMetricCard — 유형별 뷰 상단에서 재사용되는 큰 숫자 카드.
 */

interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: number; isPositive?: boolean };
  accent?: string;
  icon?: React.ReactNode;
}

export function BoltMetricCard({
  label,
  value,
  sub,
  trend,
  accent = "text-nu-ink",
  icon,
}: Props) {
  return (
    <div className="border border-nu-ink/[0.08] bg-white p-4 rounded-[var(--ds-radius-lg)]">
      <div className="flex items-center gap-1.5 text-nu-graphite">
        {icon}
        <span className="font-mono-nu text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className={`font-head text-[22px] font-extrabold tabular-nums leading-tight mt-1 ${accent}`}>
        {value}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        {sub && <span className="font-mono-nu text-[10px] text-nu-muted tabular-nums">{sub}</span>}
        {trend && (
          <span
            className={`font-mono-nu text-[10px] font-bold tabular-nums ${
              trend.isPositive === false ? "text-nu-pink" : "text-green-700"
            }`}
          >
            {trend.isPositive === false ? "▼" : "▲"} {Math.abs(trend.value)}
          </span>
        )}
      </div>
    </div>
  );
}
