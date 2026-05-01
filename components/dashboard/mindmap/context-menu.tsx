"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, Eye, Trash2, StickyNote, Unplug, Sparkles, Focus } from "lucide-react";

export interface ContextMenuTarget {
  /** "node" | "edge" — 어느 종류 위에서 우클릭했는지 */
  kind: "node" | "edge";
  /** 화면 좌표 (clientX/Y) */
  x: number;
  y: number;
  /** 대상 id */
  targetId: string;
  /** href (노드일 때만) */
  href?: string;
  /** 사용자 자유 엣지 여부 */
  isUserEdge?: boolean;
}

interface Props {
  target: ContextMenuTarget | null;
  onClose: () => void;
  onOpenDrawer: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onFocusNode?: (id: string) => void;
  onExpandNode?: (id: string) => void;
}

/**
 * 마인드맵 우클릭 컨텍스트 메뉴 — 위치 기반 floating 카드.
 *
 * - 노드: 상세 보기 / 도메인으로 이동 / 메모 추가
 * - 사용자 엣지: 연결 해제
 *
 * ESC 또는 외부 클릭으로 닫힘. 키보드 접근성을 위해 첫 항목에 자동 포커스.
 */
export function ContextMenu({ target, onClose, onOpenDrawer, onDeleteEdge, onFocusNode, onExpandNode }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

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
    firstBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [target, onClose]);

  if (!target) return null;

  const itemCls = "w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-nu-cream font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink focus:outline-none focus:bg-nu-cream";

  // 화면 가장자리 고려 — viewport 안에 들어오게 clamp
  const left = Math.min(target.x, window.innerWidth - 220);
  const top = Math.min(target.y, window.innerHeight - 200);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left, top, zIndex: 100 }}
      className="bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] min-w-[200px] py-1"
    >
      {target.kind === "node" ? (
        <>
          <button
            ref={firstBtnRef}
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={() => { onOpenDrawer(target.targetId); onClose(); }}
          >
            <Eye size={11} /> 상세 보기
          </button>
          {target.href && (
            <a
              role="menuitem"
              href={target.href}
              className={`${itemCls} no-underline`}
              onClick={onClose}
            >
              <ExternalLink size={11} /> 도메인으로 이동
            </a>
          )}
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={() => { onOpenDrawer(target.targetId); onClose(); }}
            title="상세 패널 안에 메모 섹션이 있어요"
          >
            <StickyNote size={11} /> 메모 추가/보기
          </button>
          {onFocusNode && (
            <button
              type="button"
              role="menuitem"
              className={itemCls}
              onClick={() => { onFocusNode(target.targetId); onClose(); }}
              title="이 노드 + 직접 연결만 보기 (F 키)"
            >
              <Focus size={11} /> 포커스 모드
            </button>
          )}
          {onExpandNode && (
            <button
              type="button"
              role="menuitem"
              className={`${itemCls} text-nu-pink`}
              onClick={() => { onExpandNode(target.targetId); onClose(); }}
              title="Genesis AI 가 이 노드에서 5가지 분기 제안"
            >
              <Sparkles size={11} /> Genesis 로 분기
            </button>
          )}
        </>
      ) : (
        <>
          {target.isUserEdge ? (
            <button
              ref={firstBtnRef}
              type="button"
              role="menuitem"
              className={`${itemCls} text-red-700`}
              onClick={() => { onDeleteEdge(target.targetId); onClose(); }}
            >
              <Unplug size={11} /> 연결 해제
            </button>
          ) : (
            <button
              ref={firstBtnRef}
              type="button"
              role="menuitem"
              disabled
              className={`${itemCls} opacity-50 cursor-not-allowed`}
              title="자동 생성된 관계 — 도메인 데이터 변경으로만 사라집니다"
            >
              <Trash2 size={11} /> 자동 관계 (편집 불가)
            </button>
          )}
        </>
      )}
    </div>
  );
}
