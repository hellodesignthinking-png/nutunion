"use client";

/**
 * BottomSheet — mobile-friendly sheet pattern with desktop fallback.
 *
 * - Mobile (<md): slides up from bottom, occupies up to `maxHeight` (default 70vh).
 *   Drag handle at top; swipe down >50px closes.
 * - Desktop (md+): centered modal with backdrop click to close.
 *
 * No external dependencies.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = "70vh",
  className = "",
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current == null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragOffset(delta);
  }
  function onTouchEnd() {
    if (dragOffset > 50) {
      onClose();
    }
    setDragOffset(0);
    touchStartY.current = null;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-nu-paper border-t-[4px] md:border-[4px] border-nu-ink w-full md:max-w-lg md:shadow-[8px_8px_0_0_#0D0F14] flex flex-col ${className}`}
        style={{
          maxHeight,
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset === 0 ? "transform 160ms ease-out" : "none",
        }}
      >
        {/* Drag handle — mobile only */}
        <div
          className="md:hidden pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="block w-12 h-1 rounded-full bg-nu-ink/30" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b-[2px] border-nu-ink">
            <h3 className="font-head text-base font-black text-nu-ink uppercase tracking-tight truncate">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default BottomSheet;
