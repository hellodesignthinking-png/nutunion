"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./signature-pad";

interface EmployeeInfo {
  id: string | number;
  name: string;
  email?: string;
  contract_status?: string;
  contract_signed?: boolean;
  contract_date?: string;
  contract_sent_date?: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  representative?: string;
  biz_no?: string;
  address?: string;
}

export function ContractActions({
  employee,
  company,
  canSign,
}: {
  employee: EmployeeInfo;
  company?: CompanyInfo;
  canSign: boolean;
}) {
  const router = useRouter();
  const [showSignature, setShowSignature] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = employee.contract_signed
    ? "completed"
    : employee.contract_status === "sent"
    ? "sent"
    : "none";

  const act = async (action: "send" | "sign" | "cancel") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/contracts/${employee.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "실패");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const handleSignSave = async () => {
    // 서명 이미지는 별도 저장 없이 상태만 완료로 변경 (MVP)
    // 향후: /api/finance/contracts/[id]/sign 에 서명 이미지 업로드 추가 가능
    await act("sign");
    setShowSignature(false);
  };

  return (
    <>
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            📋 전자 근로계약
          </div>
          <StatusBadge status={status} employee={employee} />
        </div>

        {status === "completed" && (
          <p className="text-[12px] text-nu-graphite mb-3">
            ✓ 계약 완료 — 서명일 {employee.contract_date}
          </p>
        )}
        {status === "sent" && (
          <p className="text-[12px] text-nu-graphite mb-3">
            📨 계약서가 발송되었습니다 — {employee.contract_sent_date}
            {employee.email && ` · ${employee.email}`}
            <br />
            직원이 로그인하여 서명하면 완료됩니다.
          </p>
        )}
        {status === "none" && (
          <p className="text-[12px] text-nu-graphite mb-3">
            아직 계약서가 발송되지 않았습니다.
          </p>
        )}

        {error && (
          <div className="border-[2px] border-red-500 bg-red-50 text-red-600 p-2 text-[12px] mb-3">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "none" && (
            <button
              onClick={() => act("send")}
              disabled={busy || !employee.email}
              className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
              title={!employee.email ? "이메일이 등록되어 있어야 발송 가능합니다" : undefined}
            >
              📨 계약서 발송
            </button>
          )}
          {status === "sent" && (
            <>
              {canSign && (
                <button
                  onClick={() => setShowSignature(true)}
                  disabled={busy}
                  className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                >
                  ✍ 서명하기
                </button>
              )}
              <button
                onClick={() => { if (confirm("발송을 취소하시겠습니까?")) act("cancel"); }}
                disabled={busy}
                className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50"
              >
                발송 취소
              </button>
            </>
          )}
          {status === "completed" && (
            <div className="font-mono-nu text-[10px] text-nu-graphite">
              ✓ 계약이 완료되었습니다
            </div>
          )}
        </div>
      </div>

      {showSignature && (
        <SignaturePad
          title={`${employee.name}${company ? ` · ${company.name}` : ""} 전자계약 서명`}
          onSave={handleSignSave}
          onClose={() => setShowSignature(false)}
        />
      )}
    </>
  );
}

function StatusBadge({ status, employee }: { status: string; employee: EmployeeInfo }) {
  if (status === "completed") {
    return (
      <span className="font-mono-nu text-[10px] uppercase tracking-wider px-2 py-1 bg-green-100 text-green-700 border-[2px] border-green-700">
        ✓ 완료
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="font-mono-nu text-[10px] uppercase tracking-wider px-2 py-1 bg-nu-blue/10 text-nu-blue border-[2px] border-nu-blue">
        📨 서명 대기
      </span>
    );
  }
  return (
    <span className="font-mono-nu text-[10px] uppercase tracking-wider px-2 py-1 bg-nu-ink/5 text-nu-graphite border-[2px] border-nu-ink/30">
      미발송
    </span>
  );
  void employee;
}
