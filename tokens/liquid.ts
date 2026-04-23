/**
 * nutunion Design System v1 — Liquid Layer (매일 변화)
 *
 * Liquid Identity v3.0 — 오늘의 장르 · 팔레트 · seed.
 * 매일 자정 기준 재계산. CSS 변수 `--liquid-*` 로 주입.
 */

export const GENRES = [
  { key: "resonance",    label: "Resonance",    primary: "#FF3D88", secondary: "#4A90E2", surface: "#FAF8F5" },
  { key: "overlap",      label: "Overlap",      primary: "#F5A524", secondary: "#9B59B6", surface: "#F7F5F0" },
  { key: "drift",        label: "Drift",        primary: "#27AE60", secondary: "#4A90E2", surface: "#F5F8F5" },
  { key: "echo",         label: "Echo",         primary: "#9B59B6", secondary: "#FF3D88", surface: "#F8F5F8" },
  { key: "protocol",     label: "Protocol",     primary: "#1a1a1a", secondary: "#FF3D88", surface: "#fafafa" },
  { key: "scene",        label: "Scene",        primary: "#4A90E2", secondary: "#F5A524", surface: "#F0F5FA" },
  { key: "vibe",         label: "Vibe",         primary: "#FF3D88", secondary: "#27AE60", surface: "#FFF5F8" },
  { key: "pulse",        label: "Pulse",        primary: "#dc2626", secondary: "#1a1a1a", surface: "#FAF5F5" },
] as const;

export type Genre = (typeof GENRES)[number];

/**
 * 오늘의 장르 계산 — 결정적 (같은 날짜는 같은 장르).
 * KST 기준 자정 roll-over.
 */
export function getTodayGenre(now = new Date()): Genre {
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const dayOfYear = Math.floor(
    (Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      Date.UTC(kst.getUTCFullYear(), 0, 0)) / 86400000
  );
  return GENRES[dayOfYear % GENRES.length];
}

/** 오늘의 seed — 캐싱·결정적 art 생성용 */
export function getTodaySeed(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, "0")}${String(kst.getUTCDate()).padStart(2, "0")}`;
}

/**
 * CSS 변수 스트링 — 서버에서 렌더 시 inline style 로 주입.
 *   <html style={liquidCssVars()}>
 */
export function liquidCssVars(genre = getTodayGenre()): Record<string, string> {
  return {
    "--liquid-primary": genre.primary,
    "--liquid-secondary": genre.secondary,
    "--liquid-surface": genre.surface,
    "--liquid-genre": `"${genre.label}"`,
  };
}
