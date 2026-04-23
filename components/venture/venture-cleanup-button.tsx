"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * 이전에 자동 생성된 플레이스홀더 예시 데이터(`[타겟 유저]` 등)를 일괄 삭제하는 버튼.
 * 호스트/admin 전용 UI.
 */
export function VentureCleanupButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      // 1) 먼저 dry-run 으로 미리보기
      const dryRes = await fetch(`/api/venture/${projectId}/cleanup-placeholders?dry=1`, { method: "POST" });
      const dryData = await dryRes.json();
      if (!dryRes.ok) throw new Error(dryData.error ?? "미리보기 실패");
      const { deleted: preview, total: previewTotal } = dryData as { deleted: { problems: number; ideas: number; tasks: number }; total: number };

      if (previewTotal === 0) {
        toast.info("삭제할 플레이스홀더가 없습니다 — 모든 데이터가 실제 입력된 것입니다");
        return;
      }

      // 2) 확인 dialog (실제 개수 표시)
      const confirmed = confirm(
        `다음 데이터가 삭제됩니다:\n\n` +
        `• HMW ${preview.problems}건 (대괄호 패턴)\n` +
        `• 아이디어 ${preview.ideas}건 (템플릿 예시 정확 일치)\n` +
        `• 태스크 ${preview.tasks}건 (템플릿 예시 정확 일치)\n\n` +
        `총 ${previewTotal}건. 사용자가 직접 작성한 데이터는 보존됩니다.\n\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;

      // 3) 실제 실행
      const res = await fetch(`/api/venture/${projectId}/cleanup-placeholders`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "정리 실패");
      const { deleted, total } = data as { deleted: { problems: number; ideas: number; tasks: number }; total: number };
      toast.success(`정리 완료: HMW ${deleted.problems} · 아이디어 ${deleted.ideas} · 태스크 ${deleted.tasks} 삭제 (총 ${total}건)`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "정리 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="h-9 px-3 border-[2px] border-orange-500 bg-orange-50 text-orange-700 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-nu-paper disabled:opacity-50"
      title="[타겟 유저] 같은 예시 플레이스홀더 데이터 일괄 삭제"
    >
      {busy ? "정리 중..." : "🧹 예시 데이터 정리"}
    </button>
  );
}
