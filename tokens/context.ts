/**
 * nutunion Design System v1 — Context Layer (영역별 모드)
 *
 * 세 가지 모드:
 *   marketing — 랜딩·브랜드. Liquid 풀 노출, Riso 질감 ON, ⊕ 심볼 ON
 *   reader    — 대시보드·커뮤니티. 무채색 + Liquid 액센트 1개
 *   quiet     — 모달·Empty·설정. 최소주의
 */

import { foundation } from "./foundation";

export const context = {
  marketing: {
    accent:       "var(--liquid-primary)",
    background:   "var(--liquid-surface)",
    textPrimary:  foundation.neutral[950],
    textSecondary:foundation.neutral[700],
    noise:        true,
    ornaments:    true,
    fontHeading:  foundation.font.display,
  },

  reader: {
    accent:       "var(--liquid-primary)",
    background:   foundation.neutral[25],
    card:         foundation.neutral[0],
    border:       foundation.neutral[100],
    textPrimary:  foundation.neutral[900],
    textSecondary:foundation.neutral[500],
    noise:        false,
    ornaments:    false,
    fontHeading:  foundation.font.sans,
  },

  quiet: {
    accent:       foundation.neutral[900],
    background:   foundation.neutral[0],
    border:       foundation.neutral[100],
    textPrimary:  foundation.neutral[900],
    textSecondary:foundation.neutral[500],
    noise:        false,
    ornaments:    false,
    fontHeading:  foundation.font.sans,
  },
} as const;

export type ContextMode = keyof typeof context;
