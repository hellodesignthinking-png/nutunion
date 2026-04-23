"use client";

import { useEffect, useState } from "react";

/**
 * prefers-reduced-motion 훅.
 * true 면 Tier 2/3 애니메이션을 Tier 1(즉시) 으로 폴백.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/**
 * Tier 2/3 프리셋을 safe 하게 — reduced 일 때 transition 만 짧게.
 */
export function withReducedMotion<T extends { transition?: unknown }>(
  preset: T,
  reduced: boolean,
): T {
  if (!reduced) return preset;
  return { ...preset, transition: { duration: 0.01 } } as T;
}
