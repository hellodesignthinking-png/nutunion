"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "./modal-shell";

const DOC_TYPES = [
  "경비 청구",
  "휴가 신청",
  "출장 신청",
  "구매 요청",
  "외부 미팅",
  "장비 요청",
  "교육/세미나",
  "기타",
];

interface CompanyOpt { id: string; name: string; }

export function ApprovalCreateModal({ companies, defaultCompany }: { companies: CompanyOpt[]; defaultCompany?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    doc_type: DOC_TYPES[0],
    amount: "",
    company: defaultCompany && defaultCompany !== "all" ? defaultCompany : (companies[0]?.id || ""),
    content: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("제목을 입력하세요"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          doc_type: form.doc_type,
          amount: form.amount || undefined,
          company: form.company || undefined,
          content: form.content.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "저장 실패");
      toast.success("결재가 요청되었습니다");
      setOpen(false);
      setForm({ title: "", doc_type: DOC_TYPES[0], amount: "", company: form.company, content: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = !!(form.title.trim() || form.content.trim() || form.amount);
  const inputStyle = "w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none";
  const labelStyle = "font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
      >
        + 결재 요청
      </button>

      {open && (
        <ModalShell title="결재 요청 작성" onClose={() => setOpen(false)} locked={submitting} maxWidth="lg" dirty={isDirty}>
          <div className="p-5 flex flex-col gap-4">
            <div>
              <div className={labelStyle}>유형 *</div>
              <select value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))} className={inputStyle}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <div className={labelStyle}>제목 *</div>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="예: 2026년 1분기 영업 출장 신청"
                className={inputStyle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={labelStyle}>금액 (선택)</div>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="경비일 경우 입력"
                  className={inputStyle}
                />
              </div>
              <div>
                <div className={labelStyle}>관련 법인</div>
                <select value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={inputStyle}>
                  {companies.filter((c) => c.id !== "all").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className={labelStyle}>내용 / 상세 설명</div>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                placeholder="결재 사유와 세부 내용을 입력하세요"
                className={`${inputStyle} resize-y`}
              />
            </div>

            {error && (
              <div className="border-[2px] border-red-500 bg-red-50 text-red-600 p-2 text-[12px]">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => !submitting && setOpen(false)}
                className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
              >
                {submitting ? "제출 중..." : "결재 제출"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
