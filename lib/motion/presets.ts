import type { Variants, Transition } from "motion/react";

/**
 * nutunion Motion System — 3-tier physics
 *
 * Tier 1 Utility    — 120~180ms · Reader 기본 · 상태 변화 통지
 * Tier 2 Expressive — 300~500ms · Hybrid · 감정적 강조
 * Tier 3 Signature  — 600~1500ms · Hero/랜딩 전용 · 브랜드 표현
 *
 * 토큰: /tokens/foundation.ts 의 duration/easing 과 동기화.
 * reduced-motion: lib/motion/reduced-motion.ts 의 훅과 함께 사용.
 */

const t_utility: Transition = { duration: 0.15, ease: [0.2, 0, 0, 1] };
const t_expressive: Transition = { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] };
const t_signature: Transition = { duration: 0.8, ease: [0.2, 0, 0, 1] };

/* ──────────────────────────────────────────────
   Tier 1 · Utility (Reader 기본)
   ────────────────────────────────────────────── */
export const utility = {
  button: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: t_utility,
  },
  card: {
    whileHover: { y: -2 },
    transition: t_utility,
  },
  tab: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: t_utility,
  },
  modal: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: t_utility,
  },
} as const;

/* ──────────────────────────────────────────────
   Tier 2 · Expressive (Hybrid 영역)
   ────────────────────────────────────────────── */
export const expressive = {
  nbaEntry: {
    initial: { opacity: 0, scale: 0.95, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: t_expressive,
  },
  badgeEarned: {
    initial: { scale: 0, rotate: -10 },
    animate: { scale: [0, 1.1, 1], rotate: 0 },
    transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.6, 1] },
  } as Variants & { transition: Transition },
  feedItem: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.35, ease: [0.2, 0, 0, 1] },
  },
  stagger: (delay = 0.05) => ({
    animate: {
      transition: { staggerChildren: delay },
    },
  }),
} as const;

/* ──────────────────────────────────────────────
   Tier 3 · Signature (Hero 전용)
   ────────────────────────────────────────────── */
export const signature = {
  heroParallax: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    transition: t_signature,
  },
  logoCascade: (i: number) => ({
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, delay: i * 0.04, ease: [0.2, 0, 0, 1] },
  }),
  liquidMorph: {
    initial: { opacity: 0, filter: "blur(8px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    transition: { duration: 1.2, ease: [0.2, 0, 0, 1] },
  },
} as const;

/* ──────────────────────────────────────────────
   Count-up (숫자 증가 애니메이션)
   ────────────────────────────────────────────── */
export function countUpTransition(duration = 0.4): Transition {
  return { duration, ease: [0.2, 0, 0, 1] };
}
