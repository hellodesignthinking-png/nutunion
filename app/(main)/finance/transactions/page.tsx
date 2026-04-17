import Link from "next/link";
import { getCompanyTransactions, getCompanies } from "@/lib/finance/company-queries";
import { TransactionList } from "@/components/finance/transaction-list";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ company?: string; month?: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function FinanceTransactionsPage({ searchParams }: PageProps) {
  const { company: selectedCompany = "all", month } = await searchParams;
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fromDate = `${currentMonth}-01`;
  const [y, m] = currentMonth.split("-").map(Number);
  const toDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const [companies, data] = await Promise.all([
    getCompanies(),
    getCompanyTransactions(selectedCompany, { fromDate, toDate }),
  ]);

  const { transactions } = data;
  const income = transactions.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const qs = (opts: { company?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts.company) p.set("company", opts.company);
    if (opts.month) p.set("month", opts.month);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-3 flex gap-4 items-center">
        <Link href="/finance" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 재무 홈
        </Link>
        <div className="flex gap-1">
          <Link href="/finance/companies" className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 text-nu-graphite hover:text-nu-ink no-underline">법인</Link>
          <Link href="/finance/transactions" className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 bg-nu-ink text-nu-paper no-underline">거래</Link>
        </div>
      </div>

      <div className="mb-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          TRANSACTIONS · 거래 내역
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          전체 거래
        </h1>
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

      {/* 구 시스템 안내 */}
      <div className="mt-8 pt-6 border-t border-nu-ink/10 text-center">
        <p className="text-[12px] text-nu-graphite mb-3">거래 추가·수정, 파일 업로드, HR/급여 관리는 구 재무시스템에서 사용하실 수 있습니다.</p>
        <a
          href="https://nutunion-finance.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline"
        >
          구 재무시스템 열기 ↗
        </a>
      </div>
    </div>
  );
}
