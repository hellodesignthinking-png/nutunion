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
  dirty = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** true면 Escape/backdrop으로 닫기 차단 (저장 중) */
  locked?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  /** true면 닫기 전 확인 다이얼로그 */
  dirty?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const attemptClose = () => {
    if (locked) return;
    if (dirty && !confirm("저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?")) return;
    onClose();
  };

  // Escape로 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, locked, dirty]);

  // 포커스 트랩 + 첫 포커스 자동
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )).filter((el) => !el.hasAttribute("aria-hidden"));

    const focusables = getFocusable();
    focusables[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKey);
    return () => {
      container.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
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
      onClick={attemptClose}
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
            {dirty && <span className="ml-2 text-nu-pink" title="저장되지 않은 변경사항">●</span>}
          </div>
          <button
            onClick={attemptClose}
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
