"use client";

import { useState } from "react";
import { useTriggerWorkflow } from "@/lib/workflow/use-workflow-job";

interface Props {
  groupId: string;
  onCompleted?: (output: Record<string, unknown>) => void;
}

/**
 * 비동기 wiki-synthesis 트리거 버튼 — 60초 이상 걸릴 수 있는 통합 작업용.
 *
 * 흐름:
 *   1. 클릭 → POST /api/ai/wiki-synthesis/trigger (즉시 202)
 *   2. useWorkflowJob 이 /api/workflow/status/[jobId] 를 3초 간격으로 폴링
 *   3. completed → onCompleted 콜백
 *
 * 기존 sync 엔드포인트 `/api/ai/wiki-synthesis` 도 여전히 사용 가능 (60초 내 완료 케이스).
 * 이 컴포넌트는 장시간 예상되는 경우의 참조 구현.
 */
export function AsyncSynthesisButton({ groupId, onCompleted }: Props) {
  const [hasStarted, setHasStarted] = useState(false);

  const {
    trigger,
    jobId,
    status,
    output,
    error,
    isTriggering,
    triggerError,
    isPolling,
  } = useTriggerWorkflow<{ groupId: string }, Record<string, unknown>>(
    "/api/ai/wiki-synthesis/trigger"
  );

  const handleClick = async () => {
    setHasStarted(true);
    const result = await trigger({ groupId });
    if ("error" in result) {
      console.error("Trigger failed:", result.error);
    }
  };

  // 완료 시 콜백
  if (status === "completed" && output && onCompleted) {
    onCompleted(output);
  }

  const currentError = triggerError || error;
  const busy = isTriggering || isPolling;

  const statusLabel: Record<string, string> = {
    idle: "준비됨",
    pending: "대기 중 (크론 실행 대기)",
    running: "처리 중...",
    completed: "완료",
    failed: "실패",
    cancelled: "취소됨",
    already_running: "이미 실행 중",
    error: "오류",
  };

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink m-0">
          비동기 지식 통합
        </h3>
        {hasStarted && (
          <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
            {statusLabel[status] ?? status}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={busy || status === "completed"}
        className="w-full h-10 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 disabled:cursor-not-allowed"
        aria-busy={busy}
      >
        {isTriggering
          ? "요청 중..."
          : isPolling
            ? `폴링 중 (${status})`
            : status === "completed"
              ? "✓ 완료됨"
              : "비동기 통합 시작"}
      </button>

      {jobId && (
        <div className="mt-2 font-mono-nu text-[9px] text-nu-graphite truncate">
          jobId: {jobId}
        </div>
      )}

      {currentError && (
        <div className="mt-2 border-l-[3px] border-red-500 pl-2 text-[11px] text-red-700">
          {currentError}
        </div>
      )}

      {status === "completed" && output && (
        <div className="mt-3 border-t-[1px] border-nu-ink/20 pt-2">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">
            결과 미리보기
          </div>
          <pre className="text-[10px] text-nu-ink max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
            {JSON.stringify(output, null, 2).slice(0, 500)}
          </pre>
        </div>
      )}
    </div>
  );
}
