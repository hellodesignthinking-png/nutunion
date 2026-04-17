import type { FinTransaction } from "@/lib/finance/types";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function TransactionList({ transactions }: { transactions: FinTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-12 text-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">
          NO TRANSACTIONS
        </div>
        <p className="text-[13px] text-nu-graphite mt-2">이달 거래가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b-[2px] border-nu-ink">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
          거래 내역 ({transactions.length}건)
        </div>
      </div>
      <div className="divide-y divide-nu-ink/10">
        {transactions.map((t) => {
          const isIncome = t.amount >= 0;
          return (
            <div key={t.id} className="grid grid-cols-[80px_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-nu-ink/5">
              <div>
                <div className="font-mono-nu text-[11px] text-nu-ink">{t.date?.slice(5) || ""}</div>
                <div className="font-mono-nu text-[8px] uppercase text-nu-graphite mt-0.5">{t.type || ""}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-nu-ink font-medium truncate">{t.description || "-"}</div>
                <div className="flex gap-2 items-center mt-0.5">
                  {t.category && (
                    <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                      {t.category}
                    </span>
                  )}
                  {t.vendor_name && (
                    <span className="text-[10px] text-nu-graphite">· {t.vendor_name}</span>
                  )}
                  {t.receipt_type && t.receipt_type !== "미등록" && (
                    <span className="text-[9px] bg-nu-blue/10 text-nu-blue px-1.5 py-0.5 font-mono-nu uppercase tracking-wider">
                      {t.receipt_type}
                    </span>
                  )}
                </div>
              </div>
              <div className={`text-[14px] font-bold font-mono-nu ${isIncome ? "text-green-700" : "text-red-600"} whitespace-nowrap`}>
                {isIncome ? "+" : "-"}₩{fmt(Math.abs(t.amount))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
