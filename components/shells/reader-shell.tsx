import type { ReactNode } from "react";

/**
 * ReaderShell v2 — 제품 UI 전용 (대시보드·너트·볼트·탭·설정).
 *
 * - Pretendard 15px / 1.75 한글 최적
 * - 무채색 + Liquid 액센트 1개 (버튼/뱃지/링크만)
 * - Riso 노이즈·⊕ 심볼 자동 제거 (globals.css `.reader-shell` 셀렉터)
 * - `data-mode="reader"` 로 CSS cascade 를 끊음
 */
export function ReaderShell({
  children,
  maxWidth = 1040,
  tight = false,
  className = "",
}: {
  children: ReactNode;
  /** 680(article) · 1040(dashboard) · 1280(wide) */
  maxWidth?: 680 | 1040 | 1280;
  /** 상하 패딩 축소 */
  tight?: boolean;
  className?: string;
}) {
  return (
    <div data-mode="reader" className={`reader-shell min-h-[50vh] ${className}`}>
      <main style={{ maxWidth }} className={`mx-auto px-4 md:px-6 ${tight ? "py-4" : "py-8"}`}>
        {children}
      </main>
    </div>
  );
}

/** Quiet Mode — 모달·설정 전용 */
export function QuietShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div data-mode="quiet" className={`quiet-shell min-h-[40vh] bg-[color:var(--neutral-0)] ${className}`}>
      {children}
    </div>
  );
}
