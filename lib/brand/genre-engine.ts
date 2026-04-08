// Liquid Identity v3.0 — 8 Genre Engine
// No JSX — safe for server and client

export type LogoGenre =
  | "blueprint"       // 건축/기술 — CAD 설계도
  | "puffy_jelly"     // 예술/문화 — Y2K 젤리
  | "glitch_pixel"    // 플랫폼/개발 — 8비트 글리치
  | "swiss_punk"      // 비즈니스 — 브루탈리스트
  | "crayon_box"      // 로컬/커뮤니티 — 크레파스
  | "neo_gradient"    // 복합 — 그라데이션 메쉬
  | "industrial"      // 공간개발/시공 — 스텐실 철강
  | "eco_organic";    // 지역재생/환경 — 식물/자연

// Hybrid combinations (when categories are roughly equal)
const HYBRID_MAP: Record<string, LogoGenre> = {
  "space+platform":    "blueprint",
  "platform+space":    "blueprint",
  "space+culture":     "neo_gradient",
  "culture+space":     "neo_gradient",
  "culture+platform":  "glitch_pixel",
  "platform+culture":  "glitch_pixel",
  "vibe+space":        "eco_organic",
  "space+vibe":        "eco_organic",
  "vibe+culture":      "crayon_box",
  "culture+vibe":      "crayon_box",
  "vibe+platform":     "industrial",
  "platform+vibe":     "industrial",
};

export interface GenreConfig {
  genre: LogoGenre;
  label: string;
  labelKo: string;
  vibe: string;
  insightLabel: string;
  categories: string[];
  font: string;
  fontUrl: string;
  colors: {
    bg: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    shell: string;
    surface: string;
  };
  grain: number;
  description: string;
  insightTemplate: string;   // "현재 {count}개의 {cat} 프로젝트가 로고를 만들고 있습니다"
  animation: "drift" | "jelly" | "glitch" | "static" | "brush" | "flow" | "stamp" | "breathe";
}

export const GENRES: Record<LogoGenre, GenreConfig> = {
  blueprint: {
    genre: "blueprint",
    label: "Blueprint",
    labelKo: "청사진",
    vibe: "Architectural",
    insightLabel: "건축/인테리어",
    categories: ["space"],
    font: "Space Mono",
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
    colors: {
      bg: "#06111F",
      primary: "#1976D2",
      secondary: "#42A5F5",
      accent: "#80D8FF",
      text: "#E3F2FD",
      shell: "#1E88E5",
      surface: "#0D2137",
    },
    grain: 0.2,
    description: "CAD 설계도 스타일. 건축·인테리어 프로젝트가 오늘을 이끕니다.",
    insightTemplate: "{count}개의 공간/건축 프로젝트가 너트의 설계도를 그리고 있습니다.",
    animation: "drift",
  },

  puffy_jelly: {
    genre: "puffy_jelly",
    label: "Puffy Jelly",
    labelKo: "Y2K 젤리",
    vibe: "Jelly & Neon",
    insightLabel: "예술/문화",
    categories: ["culture"],
    font: "Bungee",
    fontUrl: "https://fonts.googleapis.com/css2?family=Bungee&display=swap",
    colors: {
      bg: "#12002A",
      primary: "#E040FB",
      secondary: "#7C4DFF",
      accent: "#F8E71C",
      text: "#FFFFFF",
      shell: "#E040FB",
      surface: "#1E003D",
    },
    grain: 0.6,
    description: "젤리처럼 통통. 예술·문화 크루가 오늘 가장 생기 넘칩니다.",
    insightTemplate: "{count}개의 예술/문화 소모임이 너트에 네온 광채를 불어넣고 있습니다.",
    animation: "jelly",
  },

  glitch_pixel: {
    genre: "glitch_pixel",
    label: "Glitch Pixel",
    labelKo: "픽셀 글리치",
    vibe: "Digital & Retro",
    insightLabel: "플랫폼/개발",
    categories: ["platform"],
    font: "VT323",
    fontUrl: "https://fonts.googleapis.com/css2?family=VT323&display=swap",
    colors: {
      bg: "#010B06",
      primary: "#00E676",
      secondary: "#00B8D4",
      accent: "#FF3D00",
      text: "#00E676",
      shell: "#00E676",
      surface: "#001A0F",
    },
    grain: 0.1,
    description: "8비트 레트로 글리치. 플랫폼·개발 프로젝트가 오늘 터미널을 점령했습니다.",
    insightTemplate: "{count}개의 플랫폼/개발 프로젝트가 주파수를 올리며 신호를 보내고 있습니다.",
    animation: "glitch",
  },

  swiss_punk: {
    genre: "swiss_punk",
    label: "Swiss Punk",
    labelKo: "스위스 펑크",
    vibe: "Bold & Strategic",
    insightLabel: "비즈니스/기획",
    categories: ["platform", "space"],
    font: "Archivo Black",
    fontUrl: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
    colors: {
      bg: "#F5F5F0",
      primary: "#E5000A",
      secondary: "#0D0D0D",
      accent: "#FFD600",
      text: "#0D0D0D",
      shell: "#0D0D0D",
      surface: "#EBEBEB",
    },
    grain: 0.35,
    description: "과감한 자름. 비즈니스·복합 프로젝트의 강렬한 에너지입니다.",
    insightTemplate: "오늘 {count}개의 전략 프로젝트가 너트를 대담하게 재단하고 있습니다.",
    animation: "static",
  },

  crayon_box: {
    genre: "crayon_box",
    label: "Crayon Box",
    labelKo: "크레파스",
    vibe: "Local & Handmade",
    insightLabel: "로컬/커뮤니티",
    categories: ["vibe"],
    font: "Patrick Hand",
    fontUrl: "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap",
    colors: {
      bg: "#FFFAF0",
      primary: "#D84315",
      secondary: "#6D4C41",
      accent: "#FDD835",
      text: "#3E2723",
      shell: "#D84315",
      surface: "#FFF3E0",
    },
    grain: 0.85,
    description: "크레파스 낙서. 동네 소모임의 따뜻한 손길이 느껴집니다.",
    insightTemplate: "{count}개의 로컬/지역 소모임이 너트에 크레파스를 입히고 있습니다.",
    animation: "brush",
  },

  neo_gradient: {
    genre: "neo_gradient",
    label: "Neo Gradient",
    labelKo: "네오 그라디언트",
    vibe: "Abstract & Mesh",
    insightLabel: "복합 프로젝트",
    categories: ["culture", "space"],
    font: "Syne",
    fontUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap",
    colors: {
      bg: "#08004A",
      primary: "#7B2FBE",
      secondary: "#FF6B9D",
      accent: "#00D4FF",
      text: "#FFFFFF",
      shell: "#FF6B9D",
      surface: "#0F0060",
    },
    grain: 0.5,
    description: "몽환적 메쉬 그라디언트. 여러 카테고리가 융합된 하이브리드 에너지.",
    insightTemplate: "다양한 분야 {count}개 프로젝트가 혼재하며 새로운 스타일을 만들고 있습니다.",
    animation: "flow",
  },

  industrial: {
    genre: "industrial",
    label: "Industrial",
    labelKo: "인더스트리얼",
    vibe: "Steel & Stencil",
    insightLabel: "공간개발/시공",
    categories: ["space", "vibe"],
    font: "Stardos Stencil",
    fontUrl: "https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@700&display=swap",
    colors: {
      bg: "#1A1208",
      primary: "#8B6914",
      secondary: "#5D4E37",
      accent: "#FF6F00",
      text: "#F5E6C8",
      shell: "#B8860B",
      surface: "#251A0C",
    },
    grain: 0.7,
    description: "스텐실 철강. 공간개발·시공 프로젝트의 단단한 에너지가 느껴집니다.",
    insightTemplate: "{count}개의 공간개발/시공 프로젝트가 너트에 스텐실로 각인하고 있습니다.",
    animation: "stamp",
  },

  eco_organic: {
    genre: "eco_organic",
    label: "Eco Organic",
    labelKo: "에코 오가닉",
    vibe: "Green & Natural",
    insightLabel: "지역재생/환경",
    categories: ["vibe", "culture"],
    font: "Gaegu",
    fontUrl: "https://fonts.googleapis.com/css2?family=Gaegu:wght@700&display=swap",
    colors: {
      bg: "#0E1A0F",
      primary: "#2E7D32",
      secondary: "#558B2F",
      accent: "#CDDC39",
      text: "#E8F5E9",
      shell: "#43A047",
      surface: "#162718",
    },
    grain: 0.65,
    description: "자연과 식물. 지역재생·환경 프로젝트가 오늘 가장 풍성하게 자랍니다.",
    insightTemplate: "{count}개의 지역재생/환경 프로젝트가 너트에 초록 숨결을 불어넣고 있습니다.",
    animation: "breathe",
  },
};

export const ALL_GENRES = Object.keys(GENRES) as LogoGenre[];

// ─── Category → Genre map ──────────────────────────────────────────────────
const PRIMARY_MAP: Record<string, LogoGenre> = {
  space:    "blueprint",
  culture:  "puffy_jelly",
  platform: "glitch_pixel",
  vibe:     "crayon_box",
};

// ─── Variable path generator (Nordkyn-style) ──────────────────────────────
// Generates slightly different bezier control points based on a numeric seed
export function generateVariablePath(seed: number, activityLevel: number): string {
  // Normalize activity to 0-1
  const a = Math.min(activityLevel / 20, 1) * 3; // max 3px variation

  function jitter(base: number, variance: number, offset: number): number {
    return base + Math.sin(seed * 13.37 + offset) * variance * a;
  }

  const p = (b: number, v: number, o: number) => jitter(b, v, o).toFixed(1);

  // Each C command needs exactly 3 coordinate pairs: (cp1x,cp1y cp2x,cp2y endx,endy)
  return [
    `M${p(50,1,29)},${p(8,1.5,0)}`,
    `C${p(62,1,1)},${p(8,1,2)} ${p(78,1,3)},${p(18,1,4)} ${p(84,1,7)},${p(38,1,5)}`,
    `C${p(88,1,6)},${p(46,1,8)} ${p(86,1,9)},${p(62,1,10)} ${p(76,1,11)},${p(72,1,12)}`,
    `C${p(66,1,13)},${p(82,1,14)} ${p(56,1,15)},${p(92,1,16)} ${p(50,1,29)},${p(92,1,17)}`,
    `C${p(44,1,18)},${p(92,1,19)} ${p(34,1,20)},${p(82,1,21)} ${p(24,1,22)},${p(72,1,23)}`,
    `C${p(14,1,24)},${p(62,1,25)} ${p(12,1,26)},${p(46,1,27)} ${p(16,1,28)},${p(38,1,1)}`,
    `C${p(22,1,2)},${p(18,1,3)} ${p(38,1,4)},${p(8,1,5)} ${p(50,1,29)},${p(8,1.5,0)}`,
    `Z`
  ].join(" ");
}

// ─── Dominant genre calculator with hybrid support ─────────────────────────
export interface VibeResult {
  genre: LogoGenre;
  isHybrid: boolean;
  hybridGenres?: [LogoGenre, LogoGenre];
  dominantCat: string;
  subCat?: string;
  activityLevel: number;   // total count
  breakdown: Record<string, number>;
  insight: string;
  dateSeed: number;
}

export function calcVibeResult(
  categoryCounts: Record<string, number>,
  hybridThreshold = 0.38 // if top 2 are within this ratio, trigger hybrid
): VibeResult {
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const dateSeed = Math.floor(Date.now() / 86400000); // day-stable seed

  if (total === 0) {
    const fallback = ALL_GENRES[dateSeed % ALL_GENRES.length];
    return {
      genre: fallback, isHybrid: false, dominantCat: "space",
      activityLevel: 0, breakdown: {}, insight: "", dateSeed,
    };
  }

  const sorted = Object.entries(categoryCounts)
    .filter(([,v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const [topCat, topCount] = sorted[0];
  const [subCat, subCount] = sorted[1] ?? [null, 0];

  const topRatio = topCount / total;
  const subRatio = subCount / total;

  // Hybrid check: if top two are within threshold of each other
  if (subCat && Math.abs(topRatio - subRatio) < hybridThreshold && subRatio > 0.2) {
    const hybridKey = `${topCat}+${subCat}`;
    const hybridGenre = HYBRID_MAP[hybridKey] ?? "neo_gradient";
    const topGenre = PRIMARY_MAP[topCat] ?? "blueprint";
    const subGenre = PRIMARY_MAP[subCat] ?? "glitch_pixel";

    return {
      genre: hybridGenre,
      isHybrid: true,
      hybridGenres: [topGenre, subGenre],
      dominantCat: topCat,
      subCat,
      activityLevel: total,
      breakdown: categoryCounts,
      insight: buildInsight(hybridGenre, total, topCat),
      dateSeed,
    };
  }

  const genre = PRIMARY_MAP[topCat] ?? ALL_GENRES[dateSeed % ALL_GENRES.length];
  return {
    genre,
    isHybrid: false,
    dominantCat: topCat,
    subCat: subCat ?? undefined,
    activityLevel: total,
    breakdown: categoryCounts,
    insight: buildInsight(genre, total, topCat),
    dateSeed,
  };
}

export function buildInsight(genre: LogoGenre, count: number, cat: string): string {
  const cfg = GENRES[genre];
  return cfg.insightTemplate
    .replace("{count}", String(count))
    .replace("{cat}", cat);
}

export function getDailySeedGenre(): LogoGenre {
  const day = Math.floor(Date.now() / 86400000);
  return ALL_GENRES[day % ALL_GENRES.length];
}

// ─── Local archive helpers ─────────────────────────────────────────────────
export interface ArchiveEntry {
  date: string; // YYYY-MM-DD
  genre: LogoGenre;
  insight: string;
  activityLevel: number;
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}
