"use client";

/**
 * OfflineClient — /offline 페이지의 인터랙티브 영역.
 *
 * 기능:
 *  1) 실시간 온라인 상태 체크 (navigator.onLine + online/offline 이벤트)
 *  2) 온라인 상태면 "다시 시도" 버튼 활성화 + 자동 복귀 배너
 *  3) 캐시 초기화 버튼 — SW 에 postMessage 로 모든 캐시 삭제 + SW 해제
 */

import { useEffect, useState } from "react";
import { RefreshCw, Trash2, CheckCircle2 } from "lucide-react";

export default function OfflineClient() {
  const [online, setOnline] = useState<boolean>(true);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function retry() {
    window.location.href = "/";
  }

  async function clearCaches() {
    if (clearing) return;
    setClearing(true);
    try {
      // 1) SW 에게 캐시 삭제 + unregister 요청
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) {
          reg.active.postMessage({ type: "CLEAR_CACHES" });
        }
        // 직접 unregister (SW 자가 unregister 는 비동기)
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // 2) CacheStorage 직접 비우기 (double-safety)
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // 3) localStorage 의 chat prefs 는 유지, 다른 캐시성 키만 삭제
      try {
        const keep = new Set<string>();
        // 채팅 폰트 설정은 유지
        keep.add("nu_chat_font_size");
        keep.add("nu_chat_dock_open");
        const toDel: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && !keep.has(k) && k.startsWith("nu_cache_")) toDel.push(k);
        }
        toDel.forEach((k) => localStorage.removeItem(k));
      } catch {}
      setCleared(true);
      // 약간 지연 후 홈으로 하드 리로드
      setTimeout(() => {
        window.location.href = "/?sw_reset=1";
      }, 600);
    } catch (err) {
      console.error("[offline] clear caches failed", err);
      setClearing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 연결 상태 배너 */}
      <div
        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-[12px] font-mono-nu uppercase tracking-widest ${
          online
            ? "border-green-500/40 bg-green-500/10 text-green-700"
            : "border-nu-ink/15 bg-nu-ink/5 text-nu-graphite"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            online ? "bg-green-500 animate-pulse" : "bg-nu-muted"
          }`}
        />
        {online ? "다시 연결됨" : "연결 안 됨"}
      </div>

      {/* 다시 시도 버튼 */}
      <button
        onClick={retry}
        disabled={!online}
        className="w-full inline-flex items-center justify-center gap-2 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-5 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw size={12} />
        {online ? "다시 시도" : "네트워크 대기 중"}
      </button>

      {/* 캐시 초기화 */}
      <button
        onClick={clearCaches}
        disabled={clearing || cleared}
        className="w-full inline-flex items-center justify-center gap-2 border border-nu-ink/25 bg-white text-nu-ink px-4 py-2 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-60"
      >
        {cleared ? (
          <>
            <CheckCircle2 size={12} className="text-green-600" />
            초기화 완료 · 이동 중…
          </>
        ) : clearing ? (
          <>
            <RefreshCw size={12} className="animate-spin" />
            초기화 중…
          </>
        ) : (
          <>
            <Trash2 size={12} />
            캐시 초기화 + SW 재설치
          </>
        )}
      </button>
    </div>
  );
}
