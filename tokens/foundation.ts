/**
 * nutunion Design System v1 — Foundation Layer (IMMUTABLE)
 *
 * 이 토큰은 Liquid Identity 가 바뀌어도 절대 변하지 않습니다.
 * 제품 UI 의 근간. 색·폰트·간격·라운드·그림자.
 */

export const foundation = {
  // ── Neutral Palette (제품 UI 기본) ──────────────────────────
  neutral: {
    0:    "#ffffff",
    25:   "#fafafa",   // 페이지 배경 (Reader)
    50:   "#f5f5f5",   // 섹션 배경
    100:  "#e5e5e5",   // Border
    200:  "#d4d4d4",   // Border strong
    300:  "#a3a3a3",   // Disabled text
    500:  "#737373",   // Secondary text
    700:  "#404040",   // Ink soft
    900:  "#1a1a1a",   // Primary text
    950:  "#0a0a0a",   // Headlines
  },

  // ── Semantic ──────────────────────────────────────────────
  success: "#16a34a",
  warning: "#ca8a04",
  danger:  "#dc2626",
  info:    "#2563eb",

  // ── Typography ────────────────────────────────────────────
  font: {
    sans:    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
    mono:    '"JetBrains Mono", "Geist Mono", Consolas, "Courier New", monospace',
    display: '"Inter", -apple-system, sans-serif',
  },

  // ── Space (4px grid) ──────────────────────────────────────
  space: {
    0:  "0px",
    1:  "4px",
    2:  "8px",
    3:  "12px",
    4:  "16px",
    5:  "20px",
    6:  "24px",
    8:  "32px",
    10: "40px",
    12: "48px",
    16: "64px",
    20: "80px",
  },

  // ── Radius ────────────────────────────────────────────────
  radius: {
    none: "0",
    sm:   "4px",
    md:   "8px",
    lg:   "12px",
    xl:   "16px",
    "2xl":"24px",
    full: "9999px",
  },

  // ── Shadow ────────────────────────────────────────────────
  shadow: {
    xs: "0 1px 2px rgb(0 0 0 / 0.04)",
    sm: "0 2px 4px rgb(0 0 0 / 0.06)",
    md: "0 4px 12px rgb(0 0 0 / 0.08)",
    lg: "0 12px 32px rgb(0 0 0 / 0.12)",
  },

  // ── Motion timings ────────────────────────────────────────
  duration: {
    utility:    "150ms",
    expressive: "400ms",
    signature:  "800ms",
  },
  easing: {
    standard:   "cubic-bezier(0.2, 0, 0, 1)",
    overshoot:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
    decel:      "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;

export type Foundation = typeof foundation;
