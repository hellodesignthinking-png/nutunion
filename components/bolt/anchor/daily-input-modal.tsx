"use client";

/**
 * DailyInputModal — Anchor Bolt 일일 마감 입력.
 *
 * 특징:
 *  - ESC 로 닫기 + body scroll lock
 *  - 숫자 입력 시 자동 천단위 콤마
 *  - 모바일에서 inputMode="numeric" → 숫자 키패드
 *  - 기존 입력이 있으면 prefill (수정 모드)
 *  - 저장 시 upsert (중복 시 덮어쓰기)
 */

import { useEffect, useState, useRef, forwardRef } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { fmtKRW } from "@/lib/bolt/anchor-metrics";

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** 입력할 날짜 (default: 오늘) */
  date?: string;
  /** 기존 입력 prefill */
  initial?: {
    revenue?: { card?: number; cash?: number; delivery?: number };
    cost?: { food?: number; supplies?: number; labor?: number; rent?: number; other?: number };
    customers?: number;
    memo?: string;
  };
}

const parseNum = (v: string): number => {
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmtInput = (v: number | undefined): string => (v ? v.toLocaleString("ko-KR") : "");

export function DailyInputModal({ projectId, isOpen, onClose, onSaved, date, initial }: Props) {
  const today = date || new Date().toISOString().slice(0, 10);

  const [card, setCard] = useState("");
  const [cash, setCash] = useState("");
  const [delivery, setDelivery] = useState("");
  const [food, setFood] = useState("");
  const [supplies, setSupplies] = useState("");
  const [labor, setLabor] = useState("");
  const [rent, setRent] = useState("");
  const [other, setOther] = useState("");
  const [customers, setCustomers] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // prefill
  useEffect(() => {
    if (!isOpen) return;
    setCard(fmtInput(initial?.revenue?.card));
    setCash(fmtInput(initial?.revenue?.cash));
    setDelivery(fmtInput(initial?.revenue?.delivery));
    setFood(fmtInput(initial?.cost?.food));
    setSupplies(fmtInput(initial?.cost?.supplies));
    setLabor(fmtInput(initial?.cost?.labor));
    setRent(fmtInput(initial?.cost?.rent));
    setOther(fmtInput(initial?.cost?.other));
    setCustomers(initial?.customers ? String(initial.customers) : "");
    setMemo(initial?.memo || "");
  }, [isOpen, initial]);

  // ESC + scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // autofocus
    setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const revenue = parseNum(card) + parseNum(cash) + parseNum(delivery);
  const cost = parseNum(food) + parseNum(supplies) + parseNum(labor) + parseNum(rent) + parseNum(other);
  const profit = revenue - cost;
  const cust = parseNum(customers);
  const avgTicket = cust > 0 ? Math.round(revenue / cust) : 0;

  async function save() {
    if (revenue === 0 && cost === 0) {
      toast.error("매출 또는 비용을 1개 이상 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bolts/${projectId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_type: "daily",
          period_start: today,
          metrics: {
            revenue: {
              card: parseNum(card),
              cash: parseNum(cash),
              delivery: parseNum(delivery),
            },
            cost: {
              food: parseNum(food),
              supplies: parseNum(supplies),
              labor: parseNum(labor),
              rent: parseNum(rent),
              other: parseNum(other),
            },
            customers: cust,
          },
          memo: memo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "저장 실패");
      toast.success("마감 저장됨 · 강성 +2");
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="일일 마감 입력"
        className="w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-[var(--ds-radius-xl)] sm:rounded-[var(--ds-radius-xl)] border border-[color:var(--neutral-100)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--neutral-100)] sticky top-0 bg-white z-10">
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold">
              Daily Close
            </div>
            <div className="text-[14px] font-semibold text-[color:var(--neutral-900)]">
              {dateLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 hover:bg-[color:var(--neutral-50)] rounded"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* 매출 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
              💰 매출
            </div>
            <div className="grid grid-cols-1 gap-2">
              <NumberField ref={firstInputRef} label="카드" value={card} onChange={setCard} />
              <NumberField label="현금" value={cash} onChange={setCash} />
              <NumberField label="배달" value={delivery} onChange={setDelivery} />
            </div>
            <div className="mt-2 flex justify-between text-[12px] font-mono-nu pt-2 border-t border-dashed border-nu-ink/10">
              <span className="text-nu-graphite">매출 합계</span>
              <span className="font-bold text-nu-ink tabular-nums">{fmtKRW(revenue)}</span>
            </div>
          </section>

          {/* 비용 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
              💸 비용
            </div>
            <div className="grid grid-cols-1 gap-2">
              <NumberField label="식자재" value={food} onChange={setFood} />
              <NumberField label="소모품" value={supplies} onChange={setSupplies} />
              <NumberField label="인건비" value={labor} onChange={setLabor} />
              <NumberField label="임대료" value={rent} onChange={setRent} />
              <NumberField label="기타" value={other} onChange={setOther} />
            </div>
            <div className="mt-2 flex justify-between text-[12px] font-mono-nu pt-2 border-t border-dashed border-nu-ink/10">
              <span className="text-nu-graphite">비용 합계</span>
              <span className="font-bold text-nu-ink tabular-nums">{fmtKRW(cost)}</span>
            </div>
          </section>

          {/* 객수 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold mb-2">
              👥 객수
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-nu-graphite mb-1">방문 객수</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customers}
                  onChange={(e) => setCustomers(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[15px] font-mono-nu tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-nu-graphite mb-1">객단가 (자동)</label>
                <div className="w-full px-3 py-2.5 border-[1.5px] border-dashed border-nu-ink/10 rounded-[var(--ds-radius-md)] text-[15px] font-mono-nu tabular-nums text-nu-graphite bg-nu-cream/20">
                  {avgTicket > 0 ? fmtKRW(avgTicket) : "—"}
                </div>
              </div>
            </div>
          </section>

          {/* 순이익 요약 */}
          <section className="p-3 bg-gradient-to-r from-nu-pink/5 to-nu-amber/5 border-l-[3px] border-nu-pink">
            <div className="flex justify-between items-baseline">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold">
                순이익
              </span>
              <span className={`font-head text-[22px] font-extrabold tabular-nums ${profit >= 0 ? "text-green-700" : "text-nu-pink"}`}>
                {fmtKRW(profit)}
              </span>
            </div>
            {revenue > 0 && (
              <div className="text-[10px] font-mono-nu text-nu-graphite text-right mt-0.5">
                마진 {((profit / revenue) * 100).toFixed(1)}%
              </div>
            )}
          </section>

          {/* 메모 */}
          <section>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite font-bold block mb-2">
              📝 메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="오늘 특이사항, 고객 반응, 이슈 등"
              className="w-full px-3 py-2 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[13px] leading-[1.6] resize-none"
            />
          </section>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 p-4 border-t border-[color:var(--neutral-100)] sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px] font-medium"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 저장 중
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> 마감 저장
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---- NumberField — 자동 콤마 포맷 ---- */
interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}
const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, value, onChange },
  ref,
) {
  const display = value ? parseNum(value).toLocaleString("ko-KR") : "";
  return (
    <div className="flex items-center gap-3">
      <label className="text-[12px] text-nu-graphite w-14 shrink-0">{label}</label>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-graphite text-[13px] pointer-events-none">₩</span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="0"
          className="w-full pl-7 pr-3 py-2.5 border-[1.5px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[15px] font-mono-nu tabular-nums text-right"
        />
      </div>
    </div>
  );
});
