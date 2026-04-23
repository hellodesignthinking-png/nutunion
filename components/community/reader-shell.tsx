import type { ReactNode } from "react";

/**
 * ReaderShell — 커뮤니티 본문 전용 리더블 컨테이너.
 *
 * 원칙:
 * - Riso·⊕ 심볼·Liquid gradient 전파 차단 (CSS isolation + 재정의)
 * - Pretendard Variable 15px/1.75 한글 우선 타이포
 * - 무채색 팔레트 (#fafafa bg / #1a1a1a text) + 오늘의 액센트 1개만
 * - 본문 최대 폭 680px (사이드바 동반 시 1040px)
 */
interface Props {
  children: ReactNode;
  /** sidebar 를 함께 사용할 때 true — max-w 1040px, article 680px */
  withSidebar?: boolean;
  /** 추가 className */
  className?: string;
}

export function ReaderShell({ children, withSidebar = false, className = "" }: Props) {
  const max = withSidebar ? "max-w-[1040px]" : "max-w-[720px]";
  return (
    <div className={`reader-shell ${className}`}>
      <div className={`${max} mx-auto px-4 md:px-6 py-6 md:py-8`}>
        {children}
      </div>
    </div>
  );
}

/** Reader 본문 전용 article 래퍼 — 한글 가독 최대 폭 680px */
export function ReaderArticle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article className={`max-w-[680px] mx-auto reader-body ${className}`}>
      {children}
    </article>
  );
}

/** Reader 섹션 — 기본 48px margin-bottom */
export function ReaderSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mb-12 ${className}`}>{children}</section>;
}
