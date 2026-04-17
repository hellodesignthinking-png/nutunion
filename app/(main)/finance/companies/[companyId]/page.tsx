import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyTransactions } from "@/lib/finance/company-queries";
import { TransactionList } from "@/components/finance/transaction-list";
import { parseYearMonth, firstDayOfMonth, lastDayOfMonth, prevMonth, nextMonth } from "@/lib/finance/date-utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ month?: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function CompanyDetailPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { month } = await searchParams;

  const { ym: currentMonth, y, m } = parseYearMonth(month);
  const fromDate = firstDayOfMonth(currentMonth);
  const toDate = lastDayOfMonth(y, m);

  const data = await getCompanyTransactions(companyId, { fromDate, toDate });
  if (!data.company) notFound();

  const { company, transactions } = data;
  const income = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const categoryMap: Record<string, number> = {};
  transactions.filter((t) => t.amount < 0).forEach((t) => {
    const c = t.category || "미분류";
    categoryMap[c] = (categoryMap[c] || 0) + Math.abs(t.amount);
  });
  const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = topCategories[0]?.[1] || 1;

  const prevM = prevMonth(y, m);
  const nextM = nextMonth(y, m);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link href="/finance/companies" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 법인 목록
        </Link>
      </div>

      {/* 법인 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 flex items-center justify-center text-[18px] font-bold border-[2.5px] border-nu-ink"
            style={{ background: `${company.color || "#0D0D0D"}22`, color: company.color || "#0D0D0D" }}
          >
            {company.icon || company.name[0]}
          </div>
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
              ENTITY
            </div>
            <h1 className="text-[22px] sm:text-[28px] font-bold text-nu-ink leading-tight">
              {company.name}
            </h1>
            {company.biz_type && (
              <div className="text-[12px] text-nu-graphite">{company.biz_type}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          <Link href={`/finance/companies/${companyId}?month=${prevM}`} className="px-3 py-2 font-mono-nu text-[14px] text-nu-ink hover:bg-nu-ink/5 no-underline">◀</Link>
          <span className="px-4 py-2 font-mono-nu text-[13px] font-bold tracking-wider">{currentMonth}</span>
          <Link href={`/finance/companies/${companyId}?month=${nextM}`} className="px-3 py-2 font-mono-nu text-[14px] text-nu-ink hover:bg-nu-ink/5 no-underline">▶</Link>
        </div>
      </div>

      {/* 법인 정보 (있을 때만) */}
      {(company.biz_no || company.representative || company.address) && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
          {company.biz_no && (
            <div><span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">사업자번호 </span><span className="text-nu-ink">{company.biz_no}</span></div>
          )}
          {company.representative && (
            <div><span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">대표자 </span><span className="text-nu-ink">{company.representative}</span></div>
          )}
          {company.address && (
            <div><span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">주소 </span><span className="text-nu-ink">{company.address}</span></div>
          )}
        </div>
      )}

      {/* 이달 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">수입</div>
          <div className="text-[18px] font-bold text-green-700">₩{fmt(income)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">지출</div>
          <div className="text-[18px] font-bold text-red-600">₩{fmt(expense)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">순이익</div>
          <div className={`text-[18px] font-bold ${(income - expense) < 0 ? "text-red-600" : "text-nu-ink"}`}>
            ₩{fmt(income - expense)}
          </div>
        </div>
      </div>

      {/* 카테고리 + 거래 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
              카테고리별 지출 Top 5
            </div>
            {topCategories.length === 0 ? (
              <div className="text-[12px] text-nu-graphite">지출 없음</div>
            ) : (
              <div className="flex flex-col gap-3">
                {topCategories.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-nu-ink font-medium">{cat}</span>
                      <span className="text-red-600 font-mono-nu">₩{fmt(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-nu-ink/10 overflow-hidden">
                      <div className="h-full bg-red-500/70" style={{ width: `${(amt / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <TransactionList transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
