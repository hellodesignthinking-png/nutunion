import Link from "next/link";
import { getCompaniesWithFinance } from "@/lib/finance/company-queries";
import { CompanySummaryCard } from "@/components/finance/company-summary-card";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function FinanceCompaniesPage() {
  const companies = await getCompaniesWithFinance(6);

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
      {/* 네비 */}
      <div className="mb-3 flex gap-4 items-center">
        <Link href="/finance" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 재무 홈
        </Link>
        <div className="flex gap-1">
          <Link href="/finance/companies" className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 bg-nu-ink text-nu-paper no-underline">법인</Link>
          <Link href="/finance/transactions" className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 text-nu-graphite hover:text-nu-ink no-underline">거래</Link>
        </div>
      </div>

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

      {/* 전체 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">총 수입</div>
          <div className="text-[18px] font-bold text-green-700 break-all">₩{fmt(totals.income)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">총 지출</div>
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
