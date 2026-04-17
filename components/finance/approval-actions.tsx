"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  approvalId: string | number;
  isPending: boolean;
  isAdminStaff: boolean;
  isRequester: boolean;
}

export function ApprovalActions({ approvalId, isPending, isAdminStaff, isRequester }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const act = async (action: "approve" | "reject" | "cancel", extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "처리 실패");
      const labels = { approve: "승인", reject: "반려", cancel: "취소" };
      toast.success(`결재가 ${labels[action]}되었습니다`);
      if (action === "cancel") {
        router.push("/finance/approvals");
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  if (!isPending) {
    return <div className="text-[12px] text-nu-graphite italic">이미 처리된 결재입니다</div>;
  }

  return (
    <div className="space-y-3">
      {showRejectBox && (
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-red-600 mb-2">반려 사유</div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="반려 사유를 입력해주세요"
            className="w-full border-[2px] border-red-500 bg-red-50 px-3 py-2 text-[13px] outline-none resize-y mb-2"
          />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {isAdminStaff && !showRejectBox && (
          <>
            <button
              onClick={() => { if (confirm("승인 처리하시겠습니까?")) act("approve"); }}
              disabled={busy}
              className="flex-1 border-[2.5px] border-nu-ink bg-green-700 text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-green-800 disabled:opacity-50"
            >
              ✓ 승인
            </button>
            <button
              onClick={() => setShowRejectBox(true)}
              disabled={busy}
              className="flex-1 border-[2.5px] border-nu-ink bg-red-600 text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50"
            >
              ✕ 반려
            </button>
          </>
        )}
        {showRejectBox && (
          <>
            <button
              onClick={() => { setShowRejectBox(false); setRejectReason(""); }}
              disabled={busy}
              className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
            >
              취소
            </button>
            <button
              onClick={() => act("reject", { reject_reason: rejectReason })}
              disabled={busy || !rejectReason.trim()}
              className="flex-1 border-[2.5px] border-nu-ink bg-red-600 text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50"
            >
              반려 확정
            </button>
          </>
        )}
        {isRequester && !showRejectBox && (
          <button
            onClick={() => { if (confirm("결재 요청을 취소하시겠습니까? 기록은 삭제됩니다.")) act("cancel"); }}
            disabled={busy}
            className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-graphite px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50"
          >
            요청 취소
          </button>
        )}
      </div>
    </div>
  );
}
