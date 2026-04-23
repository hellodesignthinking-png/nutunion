"use client";

/**
 * OnlineStatusBanner — 네트워크 상태 배너.
 *
 * 역할:
 *  - `offline` 이벤트 감지 → 상단에 "오프라인" 배너
 *  - `online` 복귀 시 잠깐 "다시 연결됨" 토스트 후 자동 사라짐
 *  - SW v5 에서 offline fallback 제거됨 → 유저가 네트워크 상태를 알 수 있는 유일한 피드백
 *
 * 전역 layout 에 한 번만 마운트.
 */

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

type Status = "online" | "offline" | "reconnected";

export function OnlineStatusBanner() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 초기 상태
    if (navigator.onLine === false) setStatus("offline");

    const toOffline = () => setStatus("offline");
    const toOnline = () => {
      setStatus((prev) => (prev === "offline" ? "reconnected" : "online"));
      // 3초 후 "다시 연결됨" 배너 숨김
      window.setTimeout(() => {
        setStatus((s) => (s === "reconnected" ? "online" : s));
      }, 3000);
    };

    window.addEventListener("offline", toOffline);
    window.addEventListener("online", toOnline);
    return () => {
      window.removeEventListener("offline", toOffline);
      window.removeEventListener("online", toOnline);
    };
  }, []);

  if (status === "online") return null;

  const isOffline = status === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[600] flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-semibold shadow-md transition-colors ${
        isOffline ? "bg-nu-ink text-white" : "bg-green-600 text-white"
      }`}
      style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} />
          <span>오프라인 상태입니다 — 연결 복구를 기다리고 있어요</span>
        </>
      ) : (
        <>
          <Wifi size={14} />
          <span>다시 연결됐어요</span>
        </>
      )}
    </div>
  );
}
