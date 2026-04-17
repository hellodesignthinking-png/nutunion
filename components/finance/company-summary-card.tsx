import Link from "next/link";
import type { CompanyFinanceSummary } from "@/lib/finance/types";

type SummaryWithEmployees = CompanyFinanceSummary & { employeeCount?: number };

function fmt(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

export function CompanySummaryCard({ summary }: { summary: SummaryWithEmployees }) {
  const { company, totalIncome, totalExpense, netProfit, transactionCount, monthlyBreakdown, employeeCount } = summary;
  const isAll = company.id === "all";
  const accent = company.color || "#0D0D0D";

  // 최근 6개월 중 최대값 (차트 스케일링용)
  const maxValue = monthlyBreakdown.reduce((m, b) => Math.max(m, b.income, b.expense), 0);

  return (
    <Link
      href={`/finance/companies/${company.id}`}
      className="block border-[2.5px] border-nu-ink bg-nu-paper p-5 transition-all hover:shadow-[4px_4px_0_0_#0D0D0D] hover:-translate-x-[2px] hover:-translate-y-[2px] no-underline"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center text-[14px] font-bold border-[2px] border-nu-ink"
            style={{ background: `${accent}22`, color: accent }}
          >
            {company.icon || company.name[0]}
          </div>
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">
              {isAll ? "ENTITY · ALL" : "ENTITY"}
            </div>
            <h3 className="text-[15px] font-bold text-nu-ink leading-tight">{company.name}</h3>
          </div>
        </div>
        {company.biz_type && (
          <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
            {company.biz_type}
          </span>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-nu-ink/10">
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">수입</div>
          <div className="text-[14px] font-bold text-green-700">₩{fmt(totalIncome)}</div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">지출</div>
          <div className="text-[14px] font-bold text-red-600">₩{fmt(totalExpense)}</div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">순이익</div>
          <div className={`text-[14px] font-bold ${netProfit < 0 ? "text-red-600" : "text-nu-ink"}`}>
            ₩{fmt(netProfit)}
          </div>
        </div>
      </div>

      {/* 월별 막대 (최근 6개월) */}
      {monthlyBreakdown.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-end font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-2">
            <span>최근 추이</span>
            <span>{monthlyBreakdown.length}M</span>
          </div>
          <div className="flex items-end gap-1 h-[40px]">
            {monthlyBreakdown.map((b) => (
              <div key={b.month} className="flex-1 flex flex-col items-center gap-px">
                <div className="w-full flex gap-px items-end" style={{ height: 36 }}>
                  <div
                    className="flex-1 bg-green-600/70"
                    style={{ height: `${maxValue > 0 ? (b.income / maxValue) * 100 : 0}%`, minHeight: b.income > 0 ? 2 : 0 }}
                    title={`수입 ${b.income.toLocaleString()}`}
                  />
                  <div
                    className="flex-1 bg-red-500/70"
                    style={{ height: `${maxValue > 0 ? (b.expense / maxValue) * 100 : 0}%`, minHeight: b.expense > 0 ? 2 : 0 }}
                    title={`지출 ${b.expense.toLocaleString()}`}
                  />
                </div>
                <div className="font-mono-nu text-[7px] text-nu-graphite">{b.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="flex justify-between items-center text-[11px] font-mono-nu text-nu-graphite pt-2">
        <span>
          {transactionCount}건
          {typeof employeeCount === "number" && employeeCount > 0 && ` · 직원 ${employeeCount}명`}
        </span>
        <span>자세히 →</span>
      </div>
    </Link>
  );
}
