"use client";

import { useEffect, useRef } from "react";

/**
 * 공통 모달 컨테이너 — Escape/backdrop 닫기, focus trap, aria-modal
 */
export function ModalShell({
  title,
  onClose,
  children,
  locked = false,
  maxWidth = "lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** true면 Escape/backdrop으로 닫기 차단 (저장 중) */
  locked?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Escape로 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, locked]);

  // 마운트 시 첫 포커스 가능 요소로 포커스
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const first = container.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    first?.focus();
  }, []);

  // body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3 sm:p-4"
      onClick={() => !locked && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        className={`bg-nu-paper border-[2.5px] border-nu-ink w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-4 border-b-[2px] border-nu-ink">
          <div className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-ink">
            {title}
          </div>
          <button
            onClick={() => !locked && onClose()}
            disabled={locked}
            aria-label="닫기"
            className="text-nu-graphite hover:text-nu-ink text-[20px] leading-none p-1 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-nu-ink"
          >×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
