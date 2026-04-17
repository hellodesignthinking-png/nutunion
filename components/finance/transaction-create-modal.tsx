"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "./modal-shell";
import { ReceiptUploader } from "./receipt-uploader";

interface CompanyOpt {
  id: string;
  name: string;
}

interface TransactionData {
  id: number | string;
  date: string;
  company: string;
  type?: string;
  description: string;
  amount: number;
  category?: string;
  receipt_type?: string;
  vendor_name?: string;
  memo?: string;
  receipt_url?: string | null;
}

const TYPES = ["수입", "지출", "이체", "기타"];
const CATEGORIES = [
  "매출", "서비스수익", "기타수익",
  "인건비", "급여", "상여금",
  "임차료", "통신비", "보험료",
  "광고비", "소모품비", "외주용역비", "수수료",
  "식대", "교통비", "접대비", "복리후생비",
  "세금과공과", "기타비용", "미분류",
];
const RECEIPT_TYPES = ["세금계산서", "계산서", "현금영수증", "신용카드", "간이영수증", "미등록"];

interface Props {
  companies: CompanyOpt[];
  defaultCompany?: string;
  /** 수정 모드: 편집할 거래 객체 */
  editing?: TransactionData | null;
  /** 외부 제어용 — 수정 모드에서 사용 */
  controlledOpen?: boolean;
  onClose?: () => void;
  /** 버튼 라벨 커스텀 (기본: + 거래 추가) */
  triggerLabel?: string;
}

export function TransactionCreateModal({ companies, defaultCompany, editing, controlledOpen, onClose, triggerLabel }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen !== undefined) {
      if (!v && onClose) onClose();
    } else {
      setInternalOpen(v);
    }
  };

  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const initialForm = () => ({
    date: editing?.date || new Date().toISOString().slice(0, 10),
    company: editing?.company || (defaultCompany && defaultCompany !== "all" ? defaultCompany : (companies[0]?.id || "")),
    type: editing?.type || "지출",
    description: editing?.description || "",
    amount: editing ? String(Math.abs(editing.amount)) : "",
    isExpense: editing ? editing.amount < 0 : true,
    category: editing?.category || "미분류",
    receipt_type: editing?.receipt_type || "미등록",
    vendor_name: editing?.vendor_name || "",
    memo: editing?.memo || "",
  });

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) setForm(initialForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Ctrl+Enter / Cmd+Enter 저장
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, isEdit]);

  const handleSubmit = async (forceDuplicate = false) => {
    if (!form.description.trim()) { setError("내용을 입력하세요"); return; }
    if (amount === 0 || !form.amount || isNaN(Number(form.amount))) { setError("금액을 입력하세요 (0 제외)"); return; }
    const signedAmount = form.isExpense ? -amount : amount;

    setError(null);
    setDuplicateWarning(false);
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/finance/transactions/${editing!.id}` : "/api/finance/transactions";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          company: form.company,
          type: form.type,
          description: form.description.trim(),
          amount: signedAmount,
          category: form.category,
          receipt_type: form.receipt_type,
          vendor_name: form.vendor_name.trim() || undefined,
          memo: form.memo.trim() || undefined,
          ...(forceDuplicate ? { force_duplicate: true } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setDuplicateWarning(true);
        setError(data.error || "중복 거래가 감지되었습니다");
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.error || "저장 실패");
      toast.success(isEdit ? "거래가 수정되었습니다" : "거래가 등록되었습니다");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const amount = Math.abs(Number(form.amount) || 0);

  const handleDelete = async () => {
    if (!isEdit || !editing) return;
    if (!confirm("이 거래를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/transactions/${editing.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "삭제 실패");
      toast.success("거래가 삭제되었습니다");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {controlledOpen === undefined && (
        <button
          onClick={() => setOpen(true)}
          className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
        >
          {triggerLabel || "+ 거래 추가"}
        </button>
      )}

      {open && (
        <ModalShell
          title={isEdit ? "거래 수정" : "거래 추가"}
          onClose={() => setOpen(false)}
          locked={submitting}
          maxWidth="lg"
          dirty={!!(form.description.trim() || form.amount || form.vendor_name.trim() || form.memo.trim()) && !isEdit}
        >
          <div className="p-5 flex flex-col gap-4">
              {/* 수입/지출 토글 */}
              <div className="flex gap-2">
                {[
                  { val: true, label: "지출", color: "text-red-600 border-red-600" },
                  { val: false, label: "수입", color: "text-green-700 border-green-700" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setForm((f) => ({ ...f, isExpense: opt.val, type: opt.val ? "지출" : "수입" }))}
                    className={`flex-1 border-[2.5px] px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest ${
                      form.isExpense === opt.val
                        ? `${opt.color} bg-nu-ink/5 font-bold`
                        : "border-nu-ink/30 text-nu-graphite"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <Field label="날짜 *">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
              </Field>

              <Field label="법인 *">
                <select
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                >
                  {companies.filter((c) => c.id !== "all").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="금액 *">
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="숫자만 입력"
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
                <p className="text-[10px] text-nu-graphite mt-1">
                  {form.amount && !isNaN(Number(form.amount)) && `₩${Number(form.amount).toLocaleString("ko-KR")}`}
                </p>
              </Field>

              <Field label="내용 *">
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="예: 서울시 사무실 월세"
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="카테고리">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="유형">
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="증빙">
                  <select
                    value={form.receipt_type}
                    onChange={(e) => setForm((f) => ({ ...f, receipt_type: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {RECEIPT_TYPES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>

                <Field label="거래처">
                  <input
                    type="text"
                    value={form.vendor_name}
                    onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
                    placeholder="(선택)"
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  />
                </Field>
              </div>

              <Field label="메모">
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  placeholder="(선택)"
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none resize-y"
                />
              </Field>

              {/* 영수증 (수정 모드에서만) */}
              {isEdit && editing && (
                <Field label="영수증">
                  <ReceiptUploader
                    transactionId={editing.id}
                    currentUrl={editing.receipt_url}
                  />
                  <p className="text-[10px] text-nu-graphite mt-1">이미지는 자동 압축됩니다. 최대 750KB까지.</p>
                </Field>
              )}

              {error && (
                <div className={`border-[2px] p-2 text-[12px] ${duplicateWarning ? "border-orange-500 bg-orange-50 text-orange-700" : "border-red-500 bg-red-50 text-red-600"}`}>
                  <div>{error}</div>
                  {duplicateWarning && (
                    <button
                      type="button"
                      onClick={() => handleSubmit(true)}
                      disabled={submitting}
                      className="mt-2 border-[2px] border-orange-600 bg-orange-100 text-orange-700 px-3 py-1 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-orange-600 hover:text-white"
                    >
                      {submitting ? "처리 중..." : "그래도 저장"}
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {isEdit && (
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="border-[2.5px] border-red-500 bg-nu-paper text-red-600 px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-nu-paper disabled:opacity-50"
                  >
                    삭제
                  </button>
                )}
                <button
                  onClick={() => !submitting && setOpen(false)}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  title="Ctrl+Enter (또는 ⌘+Enter)로 저장"
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                >
                  {submitting ? "저장 중..." : isEdit ? "수정" : "저장"}
                </button>
              </div>
            </div>
        </ModalShell>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
