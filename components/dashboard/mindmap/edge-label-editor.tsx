"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  /** open 상태 + 초기값. null 이면 닫힘. */
  target: { edgeId: string; current: string | null; x: number; y: number } | null;
  onClose: () => void;
  onSave: (edgeId: string, label: string | null) => void;
}

/**
 * 사용자 엣지 라벨 편집 — 더블클릭으로 열림.
 *
 * 우클릭 메뉴와 같은 floating 카드 패턴. ESC 닫힘, Enter 저장.
 * 빈 문자열 저장 → label = null (라벨 제거).
 */
export function EdgeLabelEditor({ target, onClose, onSave }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (target) {
      setValue(target.current ?? "");
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [target, onClose]);

  if (!target) return null;
  const t = target;
  const left = Math.min(t.x, window.innerWidth - 260);
  const top = Math.min(t.y, window.innerHeight - 100);

  function commit() {
    const trimmed = value.trim();
    onSave(t.edgeId, trimmed || null);
    onClose();
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="연결 라벨 편집"
      style={{ position: "fixed", left, top, zIndex: 110 }}
      className="bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] p-2 min-w-[240px]"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
          연결 라벨
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="p-0.5 text-nu-muted hover:text-nu-ink"
        >
          <X size={11} />
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
        }}
        placeholder="예: 담당, 선행, 참조"
        maxLength={60}
        className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/30 focus:border-nu-ink outline-none"
        aria-label="라벨 텍스트"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono-nu text-[9px] text-nu-muted">Enter 저장 · Esc 취소</span>
        <button
          type="button"
          onClick={commit}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper"
        >
          저장
        </button>
      </div>
    </div>
  );
}
