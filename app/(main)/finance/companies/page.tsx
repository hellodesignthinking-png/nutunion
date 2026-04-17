import Link from "next/link";
import { getCompaniesWithFinance, getGlobalFinanceTrend } from "@/lib/finance/company-queries";
import { CompanySummaryCard } from "@/components/finance/company-summary-card";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function TrendCard({ label, current, prev, pct, positive }: { label: string; current: number; prev: number; pct: number; positive: boolean }) {
  const isUp = pct > 0;
  const goodDirection = positive ? isUp : !isUp; // 수입 증가=좋음, 지출 증가=나쁨
  const arrow = isUp ? "▲" : pct < 0 ? "▼" : "—";
  const pctText = isFinite(pct) ? `${Math.abs(pct).toFixed(1)}%` : "—";
  const color = pct === 0 ? "text-nu-graphite" : goodDirection ? "text-green-700" : "text-red-600";
  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
      <div className="flex justify-between items-baseline mb-2">
        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">{label}</div>
        <div className={`font-mono-nu text-[11px] font-bold ${color}`}>
          {arrow} {pctText}
        </div>
      </div>
      <div className="text-[22px] font-bold text-nu-ink break-all">₩{fmt(current)}</div>
      <div className="font-mono-nu text-[10px] text-nu-graphite mt-1">
        지난달 ₩{fmt(prev)}
      </div>
    </div>
  );
}

export default async function FinanceCompaniesPage() {
  const [companies, trend] = await Promise.all([
    getCompaniesWithFinance(6),
    getGlobalFinanceTrend(),
  ]);

  // 전체 집계 (nutunion(all) 제외)
  const totals = companies
    .filter((c) => c.company.id !== "all")
    .reduce(
      (acc, c) => ({
        income: acc.income + c.totalIncome,
        expense: acc.expense + c.totalExpense,
        count: acc.count + c.transactionCount,
      }),
      { income: 0, expense: 0, count: 0 }
    );

  const realCompanies = companies.filter((c) => c.company.id !== "all");
  const allCompany = companies.find((c) => c.company.id === "all");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          COMPANIES · 법인별 재무
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          법인별 재무 현황
        </h1>
        <p className="text-[13px] text-nu-graphite mt-2">
          최근 6개월 기준 · 각 법인의 수입·지출·순이익을 비교
        </p>
      </div>

      {/* 전체 KPI (6개월) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">6개월 수입</div>
          <div className="text-[18px] font-bold text-green-700 break-all">₩{fmt(totals.income)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">6개월 지출</div>
          <div className="text-[18px] font-bold text-red-600 break-all">₩{fmt(totals.expense)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">순이익</div>
          <div className={`text-[18px] font-bold break-all ${(totals.income - totals.expense) < 0 ? "text-red-600" : "text-nu-ink"}`}>
            ₩{fmt(totals.income - totals.expense)}
          </div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">거래 건수</div>
          <div className="text-[18px] font-bold text-nu-ink">{fmt(totals.count)}건</div>
        </div>
      </div>

      {/* 이달 vs 지난달 트렌드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        <TrendCard label="이달 수입" current={trend.thisMonth.income} prev={trend.lastMonth.income} pct={trend.incomeChangePct} positive />
        <TrendCard label="이달 지출" current={trend.thisMonth.expense} prev={trend.lastMonth.expense} pct={trend.expenseChangePct} positive={false} />
      </div>

      {/* 전체 통합 카드 */}
      {allCompany && (
        <section className="mb-8">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-3">
            ◈ 전체 통합
          </div>
          <div className="grid grid-cols-1 gap-4">
            <CompanySummaryCard summary={allCompany} />
          </div>
        </section>
      )}

      {/* 개별 법인 */}
      {realCompanies.length > 0 && (
        <section>
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-3">
            ● 법인 ({realCompanies.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {realCompanies.map((c) => (
              <CompanySummaryCard key={c.company.id} summary={c} />
            ))}
          </div>
        </section>
      )}

      {/* 빈 상태 */}
      {realCompanies.length === 0 && (
        <div className="border-[2.5px] border-nu-ink/30 border-dashed p-12 text-center">
          <div className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite mb-3">
            NO COMPANIES
          </div>
          <p className="text-[13px] text-nu-graphite mb-4">
            법인이 등록되어 있지 않습니다. 구 재무시스템에서 법인을 등록하세요.
          </p>
          <a
            href="https://nutunion-finance.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline"
          >
            구 재무시스템 열기 ↗
          </a>
        </div>
      )}
    </div>
  );
}
