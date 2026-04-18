"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function VentureEnableButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const enable = async () => {
    if (!confirm("Venture Builder 모드를 활성화하시겠습니까? 이후 디자인 씽킹 5단계 프로세스가 추가됩니다.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_stage", stage: "empathize" }),
      });
      if (!res.ok) throw new Error("활성화 실패");
      // venture_mode 도 true 로 — supabase 직접 (admin 라우트 없이 RLS 경유)
      const sRes = await fetch(`/api/venture/${projectId}/enable`, { method: "POST" });
      if (!sRes.ok) throw new Error((await sRes.json()).error || "활성화 실패");
      toast.success("Venture 모드 활성화됨");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={enable}
      disabled={loading}
      className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
    >
      {loading ? "활성화 중..." : "🚀 Venture 모드 활성화"}
    </button>
  );
}
