/**
 * lib/chat/toast-dedupe — 동일 메시지 반복 toast 억제.
 *
 * 케이스: Realtime 에러가 연속 터질 때, 같은 문구의 toast 가 쌓이면 사용자 UX 저하.
 * 동일 key/message 가 3초 내 재호출되면 suppress.
 */

import { toast } from "sonner";

const lastShown = new Map<string, number>();
const WINDOW_MS = 3000;

function shouldShow(key: string): boolean {
  const now = Date.now();
  const last = lastShown.get(key) || 0;
  if (now - last < WINDOW_MS) return false;
  lastShown.set(key, now);
  // 메모리 캡 (오래된 항목 정리)
  if (lastShown.size > 50) {
    for (const [k, t] of lastShown) {
      if (now - t > WINDOW_MS * 10) lastShown.delete(k);
    }
  }
  return true;
}

export function toastErrorOnce(message: string, key?: string) {
  const k = key || message;
  if (!shouldShow(k)) return;
  toast.error(message);
}

export function toastSuccessOnce(message: string, key?: string) {
  const k = key || message;
  if (!shouldShow(k)) return;
  toast.success(message);
}
