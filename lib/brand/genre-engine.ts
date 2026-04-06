// Genre type definitions and static config — no JSX, safe for server/client

export type LogoGenre = "blueprint" | "puffy" | "pixel" | "swiss_punk" | "hand_drawn";

export interface GenreConfig {
  genre: LogoGenre;
  label: string;
  vibe: string;                    // "Today's Vibe" display text
  categories: string[];            // trigger categories
  font: string;
  fontUrl: string;
  colors: {
    bg: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    shell: string;
  };
  grain: number;
  description: string;
  insightLabel: string;            // "12개의 건축 프로젝트"
}

export const GENRES: Record<LogoGenre, GenreConfig> = {
  blueprint: {
    genre: "blueprint",
    label: "Blueprint",
    vibe: "Architectural",
    categories: ["space", "technical"],
    font: "Space Mono",
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
    colors: {
      bg: "#0A1628",
      primary: "#1B5FDE",
      secondary: "#4A90D9",
      accent: "#7EC8E3",
      text: "#C8E0FF",
      shell: "#1B5FDE",
    },
    grain: 0.25,
    description: "설계도 청사진. 건축·기술 프로젝트가 활발할 때 등장합니다.",
    insightLabel: "건축/기술",
  },
  puffy: {
    genre: "puffy",
    label: "Puffy Y2K",
    vibe: "Creative & Jelly",
    categories: ["culture", "vibe"],
    font: "Bungee",
    fontUrl: "https://fonts.googleapis.com/css2?family=Bungee&display=swap",
    colors: {
      bg: "#1A0A2E",
      primary: "#FF48B0",
      secondary: "#BF5FFF",
      accent: "#FFE54C",
      text: "#FFFFFF",
      shell: "#FF48B0",
    },
    grain: 0.6,
    description: "젤리처럼 통통 튀는 Y2K 에너지. 예술·문화 크루가 활발할 때.",
    insightLabel: "예술/문화",
  },
  pixel: {
    genre: "pixel",
    label: "Pixel Art",
    vibe: "Digital & Retro",
    categories: ["platform", "technical"],
    font: "VT323",
    fontUrl: "https://fonts.googleapis.com/css2?family=VT323&display=swap",
    colors: {
      bg: "#0D0D0D",
      primary: "#00FF41",
      secondary: "#00C8FF",
      accent: "#FF4500",
      text: "#00FF41",
      shell: "#00FF41",
    },
    grain: 0.1,
    description: "8비트 레트로 픽셀. 개발·플랫폼 프로젝트가 주도할 때.",
    insightLabel: "플랫폼/개발",
  },
  swiss_punk: {
    genre: "swiss_punk",
    label: "Swiss Punk",
    vibe: "Bold & Strategic",
    categories: ["platform", "space"],
    font: "Archivo Black",
    fontUrl: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
    colors: {
      bg: "#FAFAF5",
      primary: "#FF2200",
      secondary: "#0D0D0D",
      accent: "#FFE100",
      text: "#0D0D0D",
      shell: "#0D0D0D",
    },
    grain: 0.35,
    description: "강렬한 대비, 과감한 레이아웃. 비즈니스·복합 프로젝트가 이끌 때.",
    insightLabel: "비즈니스/복합",
  },
  hand_drawn: {
    genre: "hand_drawn",
    label: "Hand-Drawn",
    vibe: "Local & Warm",
    categories: ["vibe", "culture"],
    font: "Patrick Hand",
    fontUrl: "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap",
    colors: {
      bg: "#FDF6EC",
      primary: "#C8571B",
      secondary: "#8B4513",
      accent: "#F5A623",
      text: "#3D1A00",
      shell: "#C8571B",
    },
    grain: 0.8,
    description: "마커 펜 낙서체. 로컬·지역 소모임이 가장 생기 넘칠 때.",
    insightLabel: "로컬/지역",
  },
};

// Category → genre mapping
const CAT_GENRE_MAP: Record<string, LogoGenre> = {
  space: "blueprint",
  culture: "puffy",
  platform: "pixel",
  vibe: "hand_drawn",
};

export function calcDominantGenre(
  categoryCounts: Record<string, number>
): { genre: LogoGenre; dominantCat: string; totalCount: number; breakdown: Record<string, number> } {
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { genre: "blueprint", dominantCat: "space", totalCount: 0, breakdown: {} };
  }

  // Find dominant category
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const [dominantCat] = sorted[0];
  const genre = CAT_GENRE_MAP[dominantCat] ?? "swiss_punk";

  return { genre, dominantCat, totalCount: total, breakdown: categoryCounts };
}

// Generate a stable "daily" genre from date seed (fallback when DB unavailable)
export function getDailySeedGenre(): LogoGenre {
  const genres: LogoGenre[] = ["blueprint", "puffy", "pixel", "swiss_punk", "hand_drawn"];
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return genres[day % genres.length];
}
