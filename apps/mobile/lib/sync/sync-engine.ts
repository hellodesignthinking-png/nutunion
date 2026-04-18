// 온라인/오프라인 동기화 엔진.
// - 온라인 복귀 감지 → 대기 큐 flush
// - 주기적 refresh 훅

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { apiPost, apiDelete } from "../api";
import {
  pendingMutations,
  removeMutation,
  markMutationFailed,
  enqueueMutation,
  type QueuedMutation,
} from "./db";

type OnlineListener = (online: boolean) => void;
const listeners = new Set<OnlineListener>();
let currentOnline = true;
let flushing = false;

export function subscribeOnlineStatus(fn: OnlineListener): () => void {
  listeners.add(fn);
  fn(currentOnline);
  return () => listeners.delete(fn);
}

export function getOnline(): boolean {
  return currentOnline;
}

NetInfo.addEventListener((state: NetInfoState) => {
  const next = !!state.isConnected && state.isInternetReachable !== false;
  const wasOffline = !currentOnline;
  currentOnline = next;
  for (const l of listeners) l(next);
  if (next && wasOffline) {
    // 온라인 복귀 → 큐 flush
    flushMutations().catch((err) => console.warn("[sync] flush err", err));
  }
});

/**
 * 오프라인 중에 호출된 변경 작업을 큐에 저장하고 온라인 시 재생.
 * 온라인이면 즉시 실행 시도하고 실패하면 큐에 저장.
 */
export async function mutateWithQueue(opts: {
  endpoint: string;
  method: "POST" | "DELETE";
  body?: unknown;
}): Promise<{ queued: boolean; result?: unknown; error?: string }> {
  if (currentOnline) {
    try {
      const result =
        opts.method === "DELETE" ? await apiDelete(opts.endpoint) : await apiPost(opts.endpoint, opts.body);
      return { queued: false, result };
    } catch (err: unknown) {
      // 네트워크성 오류면 큐에 저장, 아니면 호출측 처리
      const msg = err instanceof Error ? err.message : "unknown";
      if (/Network|Failed to fetch|Load failed/i.test(msg)) {
        await enqueueMutation(opts.endpoint, opts.method, opts.body);
        return { queued: true };
      }
      return { queued: false, error: msg };
    }
  } else {
    await enqueueMutation(opts.endpoint, opts.method, opts.body);
    return { queued: true };
  }
}

export async function flushMutations(): Promise<{ succeeded: number; failed: number }> {
  if (flushing) return { succeeded: 0, failed: 0 };
  flushing = true;
  try {
    const queue = await pendingMutations();
    let succeeded = 0;
    let failed = 0;

    for (const m of queue as QueuedMutation[]) {
      // 시도 횟수 제한 (5회 이상은 스킵 — 수동 정리 필요)
      if (m.attempts >= 5) continue;

      try {
        const body = m.body ? JSON.parse(m.body) : undefined;
        if (m.method === "DELETE") {
          await apiDelete(m.endpoint);
        } else {
          await apiPost(m.endpoint, body);
        }
        await removeMutation(m.id);
        succeeded += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        await markMutationFailed(m.id, msg);
        failed += 1;
        // 네트워크 오류면 나머지도 실패할 가능성 높음 — 중단
        if (/Network|Failed to fetch|Load failed/i.test(msg)) break;
      }
    }

    return { succeeded, failed };
  } finally {
    flushing = false;
  }
}
