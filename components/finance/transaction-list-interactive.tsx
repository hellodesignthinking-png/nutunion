"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FinTransaction } from "@/lib/finance/types";
import { TransactionCreateModal } from "./transaction-create-modal";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

interface CompanyOpt { id: string; name: string; }

export function TransactionListInteractive({
  transactions,
  companies,
  editable = false,
  hasActiveFilter = false,
}: {
  transactions: FinTransaction[];
  companies: CompanyOpt[];
  editable?: boolean;
  hasActiveFilter?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FinTransaction | null>(null);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const toggleSelect = (id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/finance/transactions/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "삭제 실패");
      toast.success(`${data.deleted}건 삭제 완료`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setBatchDeleting(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-12 text-center">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">
          {hasActiveFilter ? "NO RESULTS" : "NO TRANSACTIONS"}
        </div>
        <p className="text-[13px] text-nu-graphite mt-2">
          {hasActiveFilter
            ? "조건에 맞는 거래가 없습니다. 필터를 변경해보세요."
            : "이달 거래가 없습니다. '+ 거래 추가' 버튼으로 시작하세요."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b-[2px] border-nu-ink flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {editable && (
              <input
                type="checkbox"
                checked={selected.size === transactions.length && transactions.length > 0}
                ref={(el) => {
                  if (el) el.indeterminate = selected.size > 0 && selected.size < transactions.length;
                }}
                onChange={toggleAll}
                aria-label="전체 선택"
                className="w-4 h-4 accent-nu-pink cursor-pointer"
              />
            )}
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
              거래 내역 ({transactions.length}건)
              {selected.size > 0 && <span className="text-nu-pink"> · {selected.size}건 선택</span>}
            </div>
          </div>
          {editable && (
            selected.size > 0 ? (
              <button
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                className="border-[2px] border-red-600 bg-red-50 text-red-600 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-red-600 hover:text-nu-paper disabled:opacity-50"
              >
                {batchDeleting ? "삭제 중..." : `🗑 ${selected.size}건 삭제`}
              </button>
            ) : (
              <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                행 클릭하여 수정 · 체크박스로 다중 선택
              </div>
            )
          )}
        </div>
        <div className="divide-y divide-nu-ink/10">
          {transactions.map((t) => {
            const isIncome = t.amount >= 0;
            const isSelected = selected.has(t.id);
            const rowClasses = `grid grid-cols-[32px_80px_1fr_auto] gap-3 px-4 py-3 items-center ${
              isSelected ? "bg-nu-pink/5" : editable ? "hover:bg-nu-ink/5" : ""
            }`;
            return (
              <div key={t.id} className={rowClasses}>
                {editable ? (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(t.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${t.description} 선택`}
                    className="w-4 h-4 accent-nu-pink cursor-pointer"
                  />
                ) : (
                  <span />
                )}
                <div
                  className={editable ? "cursor-pointer" : undefined}
                  onClick={editable ? () => setEditing(t) : undefined}
                  role={editable ? "button" : undefined}
                  tabIndex={editable ? 0 : undefined}
                  onKeyDown={editable ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditing(t);
                    }
                  } : undefined}
                >
                  <div className="font-mono-nu text-[11px] text-nu-ink">{t.date?.slice(5) || ""}</div>
                  <div className="font-mono-nu text-[8px] uppercase text-nu-graphite mt-0.5">{t.type || ""}</div>
                </div>
                <div
                  className={`min-w-0 ${editable ? "cursor-pointer" : ""}`}
                  onClick={editable ? () => setEditing(t) : undefined}
                >
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

      {editable && editing && (
        <TransactionCreateModal
          companies={companies}
          editing={{
            id: editing.id,
            date: editing.date,
            company: editing.company,
            type: editing.type,
            description: editing.description,
            amount: editing.amount,
            category: editing.category,
            receipt_type: editing.receipt_type,
            vendor_name: editing.vendor_name,
            memo: editing.memo,
          }}
          controlledOpen={true}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
