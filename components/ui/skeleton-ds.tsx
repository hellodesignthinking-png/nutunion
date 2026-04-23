"use client";

/**
 * nutunion Skeleton (DS v1) — 3 variants.
 *
 * - text:  lines of text placeholder
 * - card:  card-sized rectangle with optional header
 * - chart: chart area with animated bar/ring
 *
 * Shimmer 1400ms linear infinite · neutral-100 → neutral-50 → neutral-100.
 * prefers-reduced-motion 에서는 정적 표시.
 */

import { useReducedMotion } from "@/lib/motion/reduced-motion";

interface BaseProps {
  className?: string;
}

/** 공통 Shimmer CSS */
const SHIMMER_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, var(--neutral-100) 0%, var(--neutral-50) 50%, var(--neutral-100) 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1400ms linear infinite",
};

/** Text skeleton */
export function SkeletonText({ lines = 3, className = "" }: BaseProps & { lines?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="콘텐츠 로딩 중">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-[var(--ds-radius-sm)]"
          style={{
            width: i === lines - 1 ? "62%" : "100%",
            ...(reduced ? { background: "var(--neutral-100)" } : SHIMMER_STYLE),
          }}
        />
      ))}
    </div>
  );
}

/** Card skeleton */
export function SkeletonCard({ count = 1, className = "" }: BaseProps & { count?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]"
          role="status"
          aria-label="카드 로딩 중"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full shrink-0"
              style={reduced ? { background: "var(--neutral-100)" } : SHIMMER_STYLE}
            />
            <div className="flex-1 space-y-2">
              <div className="h-3 rounded w-1/3" style={reduced ? { background: "var(--neutral-100)" } : SHIMMER_STYLE} />
              <div className="h-2.5 rounded w-1/5" style={reduced ? { background: "var(--neutral-100)" } : SHIMMER_STYLE} />
            </div>
          </div>
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

/** Chart skeleton */
export function SkeletonChart({ height = 180, className = "" }: BaseProps & { height?: number }) {
  const reduced = useReducedMotion();
  const bars = [0.45, 0.72, 0.38, 0.88, 0.55, 0.7, 0.3];
  return (
    <div
      className={`p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)] ${className}`}
      style={{ height }}
      role="status"
      aria-label="차트 로딩 중"
    >
      <div className="flex items-end justify-between gap-1.5 h-full pb-4">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${h * 100}%`,
              ...(reduced
                ? { background: "var(--neutral-100)" }
                : { ...SHIMMER_STYLE, animationDelay: `${i * 80}ms` }),
            }}
          />
        ))}
      </div>
    </div>
  );
}
