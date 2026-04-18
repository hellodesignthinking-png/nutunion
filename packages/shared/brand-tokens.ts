// 브랜드 토큰 — 웹 / 모바일 공용.
// 웹(Tailwind) 에서는 CSS 변수로 이미 정의되어 있지만, React Native 에서는
// hex 값이 필요하므로 여기서 공유.

export const BRAND = {
  colors: {
    ink: "#0D0D0D",
    paper: "#FAF8F5",
    pink: "#FF3D88",
    graphite: "#666666",
    amber: "#FFB82E",
    blue: "#2E5BFF",
  },
  borders: {
    standard: 2.5,   // px — 기본 브루탈리스트 보더
    strong: 4,       // px — 히어로/배너 강조
    subtle: 1.5,     // px — 부속
  },
  radii: {
    none: 0,
    sm: 2,
    md: 6,
    lg: 12,
  },
  typography: {
    mono: "IBM Plex Mono, ui-monospace, monospace",
    body: "Inter, -apple-system, system-ui, sans-serif",
    heading: "Inter Tight, -apple-system, system-ui, sans-serif",
  },
  // 브루탈리스트 offset 그림자 (웹 CSS / RN shadowOffset 호환)
  shadow: {
    offset: { width: 4, height: 4 },
    color: "#0D0D0D",
    opacity: 1,
    radius: 0,
    elevation: 6, // android
  },
} as const;

export type BrandTokens = typeof BRAND;
