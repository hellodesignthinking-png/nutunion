import type { ReactNode } from "react";

/**
 * HeroShell — 랜딩·브랜드·선언문 영역 전용.
 * Liquid Identity 풀 노출, Riso 질감 ON, ⊕ 심볼 ON.
 *
 * 사용 예:
 *   <HeroShell><Hero /><StatsBanner /></HeroShell>
 */
export function HeroShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div data-mode="hero" className={`hero-shell relative ${className}`}>
      {children}
    </div>
  );
}
