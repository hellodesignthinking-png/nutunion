"use client";

/**
 * ImageLightbox — 채팅 이미지 클릭 시 풀스크린 뷰어.
 *
 * 기능:
 *  - 핀치 줌 (모바일) + 휠 줌 (데스크탑)
 *  - 드래그 panning
 *  - Escape / 배경 탭 → 닫기
 *  - 더블클릭/더블탭 → 2x ↔ 1x 토글
 *  - 원본 다운로드 링크
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, ZoomIn } from "lucide-react";

export interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Escape 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => {
      const next = Math.max(1, Math.min(5, s - e.deltaY * 0.002));
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  };

  const onDoubleClick = () => {
    if (scale > 1) reset();
    else setScale(2);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => setDragging(false);

  // Touch (pinch + pan)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { distance: Math.hypot(dx, dy), scale };
    } else if (e.touches.length === 1 && scale > 1) {
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: pos.x,
        oy: pos.y,
      };
      setDragging(true);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = Math.max(1, Math.min(5, pinchRef.current.scale * (d / pinchRef.current.distance)));
      setScale(next);
      if (next === 1) setPos({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && dragging) {
      setPos({
        x: dragStart.current.ox + (e.touches[0].clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };
  const onTouchEnd = () => {
    pinchRef.current = null;
    setDragging(false);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대 보기"
      className="fixed inset-0 z-[900] bg-black/92 flex items-center justify-center chat-system-font"
      onClick={(e) => {
        // 이미지 외부 탭 → 닫기
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* 상단 액션 */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60"
            title="원본 크기"
            aria-label="원본 크기로 재설정"
          >
            <ZoomIn size={18} />
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60"
            title="다운로드"
            aria-label="원본 다운로드"
          >
            <Download size={18} />
          </a>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60"
          aria-label="닫기"
        >
          <X size={20} />
        </button>
      </div>

      {/* 줌 상태 인디케이터 */}
      {scale > 1.01 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-[12px] font-mono rounded-full tabular-nums">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        className={`max-w-[95vw] max-h-[90vh] object-contain select-none ${
          dragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-zoom-in"
        }`}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging || pinchRef.current ? "none" : "transform 0.18s ease-out",
          touchAction: "none",
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={onDoubleClick}
        draggable={false}
      />
    </div>,
    document.body,
  );
}
