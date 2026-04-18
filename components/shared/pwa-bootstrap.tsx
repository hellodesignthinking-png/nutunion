"use client";

import { useEffect, useState } from "react";

/** beforeinstallprompt Event 타입 (TS DOM 에 없음) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa_install_dismissed_at";
const REMIND_AFTER_DAYS = 14;

/**
 * 서비스 워커 등록 + PWA 설치 프롬프트 유도 배너.
 *
 * 동작:
 *   1) /sw.js 등록 (prod 에서만)
 *   2) beforeinstallprompt 캐치 → 우측 하단 배너 노출
 *   3) 사용자 "설치" 클릭 → 네이티브 프롬프트 호출
 *   4) "나중에" → 14일 동안 재노출 안 함
 *   5) 이미 설치된 PWA (standalone) → 노출 안 함
 *
 * 전역 루트 layout 에 한 번만 마운트.
 */
export function PwaBootstrap() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // SW 등록
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const reg = navigator.serviceWorker.register("/sw.js", { scope: "/" });
    reg.catch((err) => console.warn("[PWA] SW 등록 실패:", err));
  }, []);

  // 설치 프롬프트 캐치
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이미 standalone 모드 (설치됨) 이면 skip
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // 최근 14일 내 dismiss 했으면 skip
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) {
        const daysAgo = (Date.now() - Number(dismissed)) / (24 * 60 * 60 * 1000);
        if (daysAgo < REMIND_AFTER_DAYS) return;
      }
    } catch {
      // localStorage 차단 환경 — 조용히 skip
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // 페이지 진입 직후 튀어나오지 않게 약간 지연
      setTimeout(() => setShow(true), 3500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    try {
      await prompt.userChoice;
    } catch {}
    setPrompt(null);
    setShow(false);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  if (!show || !prompt) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className="fixed bottom-[72px] md:bottom-4 right-3 left-3 md:left-auto md:max-w-sm z-[600] border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,1)] print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 flex-shrink-0 bg-nu-pink text-nu-paper flex items-center justify-center border-[2.5px] border-nu-ink font-bold text-[18px]">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div id="pwa-install-title" className="font-bold text-[14px] text-nu-ink leading-tight">
            nutunion 앱으로 설치
          </div>
          <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">
            홈 화면에서 바로 실행. 네이티브 앱 같은 속도.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={install}
              className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink"
            >
              설치
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="border-[2.5px] border-nu-ink/30 bg-transparent text-nu-graphite px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:border-nu-ink hover:text-nu-ink"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
