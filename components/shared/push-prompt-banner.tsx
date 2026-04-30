"use client";

/**
 * PushPromptBanner — 푸시 알림 미구독 사용자에게 1회 노출되는 가벼운 권유 배너.
 *
 * 자동 비노출 조건:
 *  - localStorage('nu:push:dismissed') 가 set 되어 있음
 *  - Notification.permission 이 "granted" 또는 "denied"
 *  - SW 미지원 브라우저
 *  - 기존 PushManager 구독 있음
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";

const KEY = "nu:push:dismissed";

export function PushPromptBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY) === "1") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;

    // 기존 구독 있는지 확인
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          // SW 없음 → 굳이 띄우지 않음 (페이지가 SW 등록한 후 다시 시도)
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (!sub) {
          // 미구독 + 권한 default → 권유
          setShow(true);
        }
      } catch {
        // 무시
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setShow(false);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40 bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-nu-pink/10 flex items-center justify-center shrink-0 border-2 border-nu-pink/20">
          <Bell size={16} className="text-nu-pink" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-head text-[13px] font-extrabold text-nu-ink mb-0.5">
            알림 받으시겠어요?
          </p>
          <p className="text-[11px] text-nu-muted leading-relaxed">
            새 댓글, 미팅, 가입 신청을 놓치지 않고 받으세요. 언제든 설정에서 끌 수 있어요.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href="/settings/notifications"
              onClick={dismiss}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-nu-pink text-white border-2 border-nu-pink hover:bg-nu-ink hover:border-nu-ink no-underline"
            >
              알림 켜기
            </Link>
            <button
              onClick={dismiss}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 border-nu-ink/15 text-nu-muted hover:border-nu-ink hover:text-nu-ink"
            >
              나중에
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="p-1 text-nu-muted hover:text-nu-ink shrink-0" aria-label="닫기">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
