import Link from "next/link";
import type { BoltFinanceSummary } from "@/lib/finance/queries";
import { fmtKRW } from "@/lib/finance/format";

const statusColors: Record<string, string> = {
  active: "bg-nu-pink text-nu-paper",
  draft: "bg-nu-graphite/20 text-nu-graphite",
  completed: "bg-nu-blue text-nu-paper",
  archived: "bg-nu-graphite/10 text-nu-graphite/70",
};

const statusLabels: Record<string, string> = {
  active: "진행중",
  draft: "초안",
  completed: "완료",
  archived: "보관",
};

export function BoltSummaryCard({ summary }: { summary: BoltFinanceSummary }) {
  const { project, totalBudget, totalIncome, totalExpense, balance, netProfit, transactionCount } = summary;
  const burnRate = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;
  const burnColor = burnRate > 90 ? "text-red-600" : burnRate > 70 ? "text-orange-600" : "text-nu-ink";

  return (
    <Link
      href={`/finance/${project.id}`}
      className="block border-[2.5px] border-nu-ink bg-nu-paper p-5 transition-all hover:shadow-[4px_4px_0_0_#0D0D0D] hover:-translate-x-[2px] hover:-translate-y-[2px] no-underline"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
            BOLT
          </div>
          <h3 className="text-[16px] font-bold text-nu-ink leading-tight break-words">
            {project.title}
          </h3>
          {project.category && (
            <div className="text-[11px] text-nu-graphite mt-1">{project.category}</div>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-mono-nu uppercase tracking-wider ${statusColors[project.status] || statusColors.draft}`}>
          {statusLabels[project.status] || project.status}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-1">
            예산
          </div>
          <div className="text-[14px] font-bold text-nu-ink">
            ₩{fmtKRW(totalBudget)}
          </div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-1">
            지출
          </div>
          <div className={`text-[14px] font-bold ${burnColor}`}>
            ₩{fmtKRW(totalExpense)}
          </div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-1">
            잔액
          </div>
          <div className={`text-[14px] font-bold ${balance < 0 ? "text-red-600" : "text-green-700"}`}>
            ₩{fmtKRW(balance)}
          </div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-1">
            순이익
          </div>
          <div className={`text-[14px] font-bold ${netProfit < 0 ? "text-red-600" : "text-green-700"}`}>
            ₩{fmtKRW(netProfit)}
          </div>
        </div>
      </div>

      {/* 진행률 */}
      {totalBudget > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-mono-nu uppercase tracking-wider mb-1">
            <span className="text-nu-graphite">Burn Rate</span>
            <span className={burnColor}>{burnRate.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-nu-graphite/10 overflow-hidden">
            <div
              className={`h-full ${burnRate > 90 ? "bg-red-600" : burnRate > 70 ? "bg-orange-500" : "bg-nu-pink"}`}
              style={{ width: `${Math.min(100, burnRate)}%` }}
            />
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="flex justify-between items-center pt-3 border-t border-nu-ink/10 text-[11px] font-mono-nu text-nu-graphite">
        <span>{transactionCount}건 거래</span>
        <span>자세히 →</span>
      </div>
    </Link>
  );
}
