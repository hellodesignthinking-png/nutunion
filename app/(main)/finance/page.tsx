import Link from "next/link";
import { getBoltsWithFinance } from "@/lib/finance/queries";
import { BoltSummaryCard } from "@/components/finance/bolt-summary-card";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function FinanceHomePage() {
  const bolts = await getBoltsWithFinance();

  // 전체 집계
  const totals = bolts.reduce(
    (acc, b) => ({
      budget: acc.budget + b.totalBudget,
      income: acc.income + b.totalIncome,
      expense: acc.expense + b.totalExpense,
      count: acc.count + b.transactionCount,
    }),
    { budget: 0, income: 0, expense: 0, count: 0 }
  );

  const activeBolts = bolts.filter((b) => b.project.status === "active");
  const otherBolts = bolts.filter((b) => b.project.status !== "active");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          FINANCE · 재무관리
        </div>
        <h1 className="text-[28px] sm:text-[36px] font-bold text-nu-ink leading-tight">
          재무 대시보드
        </h1>
      </div>

      {/* 섹션 네비 */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/finance" className="border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline">
          볼트
        </Link>
        <Link href="/finance/companies" className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          법인
        </Link>
        <Link href="/finance/transactions" className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          거래
        </Link>
        <Link href="/finance/hr" className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          HR
        </Link>
        <Link href="/finance/marketing" className="border-[2.5px] border-nu-pink bg-nu-paper text-nu-pink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-pink hover:text-nu-paper transition-colors">
          ✨ AI 마케팅
        </Link>
        <Link href="/finance/docs" className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          📋 규정
        </Link>
      </div>

      <p className="text-[13px] sm:text-[14px] text-nu-graphite mb-6">
        각 볼트(프로젝트)의 예산·지출·수익성을 한눈에 확인합니다.
      </p>

      {/* 전체 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "총 예산", value: totals.budget, color: "text-nu-ink" },
          { label: "총 수입", value: totals.income, color: "text-green-700" },
          { label: "총 지출", value: totals.expense, color: "text-red-600" },
          { label: "순이익", value: totals.income - totals.expense, color: (totals.income - totals.expense) < 0 ? "text-red-600" : "text-green-700" },
        ].map((k) => (
          <div key={k.label} className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
              {k.label}
            </div>
            <div className={`text-[16px] sm:text-[20px] font-bold ${k.color} break-all`}>
              ₩{fmt(k.value)}
            </div>
          </div>
        ))}
      </div>

      {/* 진행 중인 볼트 */}
      {activeBolts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-ink">
              ● 진행 중 ({activeBolts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBolts.map((b) => (
              <BoltSummaryCard key={b.project.id} summary={b} />
            ))}
          </div>
        </section>
      )}

      {/* 기타 볼트 */}
      {otherBolts.length > 0 && (
        <section>
          <h2 className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-graphite mb-4">
            ○ 기타 ({otherBolts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherBolts.map((b) => (
              <BoltSummaryCard key={b.project.id} summary={b} />
            ))}
          </div>
        </section>
      )}

      {/* 빈 상태 */}
      {bolts.length === 0 && (
        <div className="border-[2.5px] border-nu-ink/30 border-dashed p-12 text-center">
          <div className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite mb-3">
            NO BOLTS
          </div>
          <h3 className="text-[18px] font-bold text-nu-ink mb-2">볼트가 없습니다</h3>
          <p className="text-[13px] text-nu-graphite mb-6">
            먼저 프로젝트(볼트)를 생성해야 재무 관리를 시작할 수 있습니다.
          </p>
          <Link
            href="/projects/create"
            className="inline-block border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline hover:bg-nu-ink transition-colors"
          >
            볼트 생성하기
          </Link>
        </div>
      )}

      {/* 구 재무시스템 링크 */}
      <div className="mt-12 pt-6 border-t border-nu-ink/10 text-center">
        <a
          href="https://nutunion-finance.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          구 재무시스템 (거래/HR/보고서) ↗
        </a>
      </div>
    </div>
  );
}
