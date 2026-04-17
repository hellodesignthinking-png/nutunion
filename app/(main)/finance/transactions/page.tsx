import Link from "next/link";
import { getCompanyTransactions, getCompanies } from "@/lib/finance/company-queries";
import { TransactionList } from "@/components/finance/transaction-list";
import { parseYearMonth, firstDayOfMonth, lastDayOfMonth, prevMonth, nextMonth } from "@/lib/finance/date-utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ company?: string; month?: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function FinanceTransactionsPage({ searchParams }: PageProps) {
  const { company: selectedCompany = "all", month } = await searchParams;
  const { ym: currentMonth, y, m } = parseYearMonth(month);
  const fromDate = firstDayOfMonth(currentMonth);
  const toDate = lastDayOfMonth(y, m);

  const [companies, data] = await Promise.all([
    getCompanies(),
    getCompanyTransactions(selectedCompany, { fromDate, toDate }),
  ]);

  const { transactions } = data;
  const income = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const prevM = prevMonth(y, m);
  const nextM = nextMonth(y, m);
  const qs = (opts: { company?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts.company) p.set("company", opts.company);
    if (opts.month) p.set("month", opts.month);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
            TRANSACTIONS · 거래 내역
          </div>
          <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
            전체 거래
          </h1>
        </div>
        {transactions.length > 0 && (
          <a
            href={`/api/finance/transactions/export?company=${selectedCompany}&month=${currentMonth}`}
            className="border-[2.5px] border-nu-ink bg-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
            download
          >
            📥 CSV 다운로드
          </a>
        )}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* 법인 */}
        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper overflow-x-auto">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/finance/transactions${qs({ company: c.id, month: currentMonth })}`}
              className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider whitespace-nowrap no-underline ${
                selectedCompany === c.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* 월 선택 */}
        <div className="flex items-center gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          <Link href={`/finance/transactions${qs({ company: selectedCompany, month: prevM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">◀</Link>
          <span className="px-3 py-2 font-mono-nu text-[12px] font-bold tracking-wider">{currentMonth}</span>
          <Link href={`/finance/transactions${qs({ company: selectedCompany, month: nextM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">▶</Link>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">수입</div>
          <div className="text-[16px] font-bold text-green-700">₩{fmt(income)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">지출</div>
          <div className="text-[16px] font-bold text-red-600">₩{fmt(expense)}</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">순이익</div>
          <div className={`text-[16px] font-bold ${(income - expense) < 0 ? "text-red-600" : "text-nu-ink"}`}>
            ₩{fmt(income - expense)}
          </div>
        </div>
      </div>

      <TransactionList transactions={transactions} />

    </div>
  );
}
