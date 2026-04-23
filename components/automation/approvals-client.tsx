"use client";

import { useState } from "react";

type Approval = {
  id: string;
  rule_id: string;
  log_id: string;
  rule_name: string;
  preview: any;
  created_at: string;
};

export function ApprovalsClient({ initialApprovals }: { initialApprovals: Approval[] }) {
  const [items, setItems] = useState<Approval[]>(initialApprovals);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    const res = await fetch(`/api/automations/approvals/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(null);
    if (res.ok) {
      setItems((list) => list.filter((a) => a.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "처리 실패");
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-nu-ink/60">승인 대기 중인 자동화가 없어요. 🎉</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="border-[3px] border-nu-ink bg-white p-4 shadow-[3px_3px_0_#0D0D0D]">
          <div className="flex justify-between gap-2 items-start">
            <div>
              <p className="font-bold text-nu-ink">{a.rule_name}</p>
              <p className="text-xs text-nu-ink/60">{new Date(a.created_at).toLocaleString("ko-KR")}</p>
            </div>
          </div>
          <pre className="mt-3 text-xs bg-nu-paper p-2 border-[2px] border-nu-ink overflow-x-auto max-h-48">
            {JSON.stringify(a.preview, null, 2)}
          </pre>
          <div className="flex gap-2 mt-3">
            <button
              disabled={busy === a.id}
              onClick={() => decide(a.id, "approve")}
              className="px-3 py-2 border-[3px] border-nu-ink bg-nu-pink text-white font-bold disabled:opacity-50 shadow-[3px_3px_0_#0D0D0D]"
            >
              승인
            </button>
            <button
              disabled={busy === a.id}
              onClick={() => decide(a.id, "reject")}
              className="px-3 py-2 border-[3px] border-nu-ink bg-white font-bold disabled:opacity-50"
            >
              거절
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
