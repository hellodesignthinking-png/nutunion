"use client";

import { useEffect, useRef, useState } from "react";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "already_running";

export interface WorkflowJobSnapshot<T = unknown> {
  id: string;
  taskType: string;
  status: JobStatus;
  output: T | null;
  error: string | null;
  progress: { attempts: number; maxAttempts: number };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface UseWorkflowJobOptions {
  /** 폴링 간격 (ms). 기본 3000 */
  intervalMs?: number;
  /** 최대 폴링 시도 횟수 (intervalMs × 이 값 = 총 timeout). 기본 120 (= 6분@3s) */
  maxAttempts?: number;
  /** 완료/실패 시 호출 — 훅은 자동 정지 */
  onComplete?: (snapshot: WorkflowJobSnapshot) => void;
  onFailed?: (snapshot: WorkflowJobSnapshot) => void;
  /** 비활성화 */
  enabled?: boolean;
}

export interface UseWorkflowJobResult<T = unknown> {
  snapshot: WorkflowJobSnapshot<T> | null;
  status: JobStatus | "idle" | "error";
  output: T | null;
  error: string | null;
  isPolling: boolean;
  /** 수동 정지 (언마운트 시 자동 정지됨) */
  stop: () => void;
}

/**
 * 워크플로우 잡 상태를 폴링.
 *
 * @example
 *   const { status, output, error } = useWorkflowJob<WikiSynthesisOutput>(jobId, {
 *     onComplete: (snap) => toast.success("완료!"),
 *   });
 */
export function useWorkflowJob<T = unknown>(
  jobId: string | null | undefined,
  options: UseWorkflowJobOptions = {}
): UseWorkflowJobResult<T> {
  const { intervalMs = 3000, maxAttempts = 120, onComplete, onFailed, enabled = true } = options;

  const [snapshot, setSnapshot] = useState<WorkflowJobSnapshot<T> | null>(null);
  const [status, setStatus] = useState<UseWorkflowJobResult<T>["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const stoppedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  useEffect(() => {
    if (!enabled || !jobId) {
      setIsPolling(false);
      return;
    }

    stoppedRef.current = false;
    setIsPolling(true);
    setStatus("pending");
    setError(null);

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stoppedRef.current) return;
      attempts += 1;

      try {
        const res = await fetch(`/api/workflow/status/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            setStatus("error");
            setError("Job not found");
            setIsPolling(false);
            return;
          }
          // transient — retry
        } else {
          const snap = (await res.json()) as WorkflowJobSnapshot<T>;
          setSnapshot(snap);
          setStatus(snap.status);

          if (snap.status === "completed") {
            setIsPolling(false);
            onCompleteRef.current?.(snap as WorkflowJobSnapshot);
            return;
          }
          if (snap.status === "failed" || snap.status === "cancelled") {
            setError(snap.error ?? "Job failed");
            setIsPolling(false);
            onFailedRef.current?.(snap as WorkflowJobSnapshot);
            return;
          }
        }
      } catch (err) {
        // network hiccup — retry
        console.warn("[useWorkflowJob] poll error", err);
      }

      if (attempts >= maxAttempts) {
        setStatus("error");
        setError(`폴링 타임아웃 (${maxAttempts}회 시도)`);
        setIsPolling(false);
        return;
      }

      timeoutId = setTimeout(poll, intervalMs);
    };

    // 즉시 한 번 폴링
    poll();

    return () => {
      stoppedRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [jobId, enabled, intervalMs, maxAttempts]);

  return {
    snapshot,
    status,
    output: snapshot?.output ?? null,
    error,
    isPolling,
    stop: () => {
      stoppedRef.current = true;
      setIsPolling(false);
    },
  };
}

/**
 * 동기 API → 비동기 trigger 로 이전하는 컴포넌트용 편의 훅.
 *
 * @example
 *   const { trigger, jobId, status, output, error } = useTriggerWorkflow("/api/ai/wiki-synthesis/trigger");
 *   trigger({ groupId });
 */
export function useTriggerWorkflow<I = unknown, T = unknown>(endpoint: string) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const jobResult = useWorkflowJob<T>(jobId);

  const trigger = async (input: I): Promise<{ jobId: string } | { error: string }> => {
    setIsTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.jobId) {
        const msg = data.error ?? "Failed to trigger job";
        setTriggerError(msg);
        return { error: msg };
      }
      setJobId(data.jobId);
      return { jobId: data.jobId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setTriggerError(msg);
      return { error: msg };
    } finally {
      setIsTriggering(false);
    }
  };

  return {
    trigger,
    jobId,
    isTriggering,
    triggerError,
    ...jobResult,
  };
}
