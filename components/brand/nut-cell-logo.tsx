"use client";

import { useMemo } from "react";

export type CategoryGroup = "technical" | "creative" | "social" | "strategic";

export interface NutCellConfig {
  group: CategoryGroup;
  mixRatio?: number; // 0-1, secondary color blend
  secondaryGroup?: CategoryGroup;
  size?: number;
  animated?: boolean;
}

export const MATRIX: Record<
  CategoryGroup,
  {
    label: string;
    font: string;
    fontUrl: string;
    primary: string;
    secondary: string;
    accent: string;
    grain: number;
    kernelPath: string;
    tagline: string;
  }
> = {
  technical: {
    label: "Technical",
    font: "Space Grotesk",
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap",
    primary: "#1B3A6B",
    secondary: "#4A6FA5",
    accent: "#7FB3D3",
    grain: 0.3,
    tagline: "건축 · 기술 · 개발",
    // Circuit-board / grid kernel
    kernelPath: `
      M 50 30 L 70 30 L 70 50 M 50 30 L 30 30 L 30 50
      M 50 70 L 70 70 L 70 50 M 50 70 L 30 70 L 30 50
      M 50 50 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0
      M 38 38 L 42 42 M 62 38 L 58 42 M 38 62 L 42 58 M 62 62 L 58 58
      M 50 22 L 50 26 M 50 74 L 50 78 M 22 50 L 26 50 M 74 50 L 78 50
    `,
  },
  creative: {
    label: "Creative",
    font: "Syne",
    fontUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap",
    primary: "#FF48B0",
    secondary: "#8B2FC9",
    accent: "#FF9EE5",
    grain: 0.7,
    tagline: "예술 · 문화 · 디자인",
    // Organic brushstroke kernel
    kernelPath: `
      M 35 40 C 38 28 58 28 62 38 C 68 50 60 65 50 68 C 40 71 30 60 35 40 Z
      M 42 45 C 44 38 56 38 58 45 C 60 52 55 60 50 62 C 45 64 38 58 42 45 Z
      M 50 35 L 50 65 M 38 50 C 42 46 58 46 62 50
    `,
  },
  social: {
    label: "Social",
    font: "Quicksand",
    fontUrl: "https://fonts.googleapis.com/css2?family=Quicksand:wght@700&display=swap",
    primary: "#F5A623",
    secondary: "#E8622A",
    accent: "#FFD580",
    grain: 0.5,
    tagline: "커뮤니티 · 지역 · 연결",
    // Connected nodes kernel
    kernelPath: `
      M 50 50 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0
      M 30 35 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0
      M 70 35 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0
      M 30 65 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0
      M 70 65 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0
      M 50 50 L 30 35 M 50 50 L 70 35 M 50 50 L 30 65 M 50 50 L 70 65
      M 30 35 L 70 35 M 30 65 L 70 65 M 30 35 L 30 65 M 70 35 L 70 65
    `,
  },
  strategic: {
    label: "Strategic",
    font: "Archivo Black",
    fontUrl: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
    primary: "#0D1B2A",
    secondary: "#374151",
    accent: "#6B7280",
    grain: 0.2,
    tagline: "비즈니스 · 전략 · 공간",
    // Rising graph / block kernel
    kernelPath: `
      M 28 68 L 28 55 L 36 55 L 36 68 Z
      M 40 68 L 40 45 L 48 45 L 48 68 Z
      M 52 68 L 52 38 L 60 38 L 60 68 Z
      M 64 68 L 64 30 L 72 30 L 72 68 Z
      M 25 68 L 75 68
      M 58 30 L 72 30 L 72 44
      M 52 38 L 72 30
    `,
  },
};

// Nut-shell outer path (hexagonal-organic hybrid)
const SHELL_PATH = `
  M 50 8
  C 62 8 78 18 82 30
  C 88 46 84 62 76 72
  C 68 82 56 92 50 92
  C 44 92 32 82 24 72
  C 16 62 12 46 18 30
  C 22 18 38 8 50 8 Z
`;

// Halftone filter for risograph effect
const HALFTONE_ID = "nut-halftone";

export function NutCellLogo({
  group,
  mixRatio = 0,
  secondaryGroup,
  size = 200,
  animated = true,
}: NutCellConfig) {
  const cfg = MATRIX[group];
  const cfg2 = secondaryGroup ? MATRIX[secondaryGroup] : null;

  // Blend primary color if mix
  const blendColor = useMemo(() => {
    if (!cfg2 || mixRatio === 0) return cfg.primary;
    // Simple hex blend
    const hex = (h: string) => parseInt(h, 16);
    const r1 = hex(cfg.primary.slice(1, 3));
    const g1 = hex(cfg.primary.slice(3, 5));
    const b1 = hex(cfg.primary.slice(5, 7));
    const r2 = hex(cfg2.primary.slice(1, 3));
    const g2 = hex(cfg2.primary.slice(3, 5));
    const b2 = hex(cfg2.primary.slice(5, 7));
    const r = Math.round(r1 * (1 - mixRatio) + r2 * mixRatio);
    const g = Math.round(g1 * (1 - mixRatio) + g2 * mixRatio);
    const b = Math.round(b1 * (1 - mixRatio) + b2 * mixRatio);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }, [cfg, cfg2, mixRatio]);

  const accentBlend = cfg2
    ? mixRatio > 0.5
      ? cfg2.accent
      : cfg.accent
    : cfg.accent;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Nut Union ${cfg.label} Identity`}
    >
      <defs>
        <filter id={`${HALFTONE_ID}-${group}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.65 + cfg.grain * 0.1}
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feBlend in="SourceGraphic" in2="gray" mode="multiply" result="blend" />
          <feComponentTransfer in="blend">
            <feFuncA type="linear" slope="1" />
          </feComponentTransfer>
        </filter>

        {/* Overprint layer for dual-group */}
        {cfg2 && (
          <filter id={`overprint-${group}`}>
            <feBlend in="SourceGraphic" in2="BackgroundImage" mode="multiply" />
          </filter>
        )}

        <linearGradient id={`shell-grad-${group}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={blendColor} />
          <stop offset="100%" stopColor={cfg2 ? cfg2.primary : cfg.secondary} />
        </linearGradient>
      </defs>

      {/* Shell outer background */}
      <path
        d={SHELL_PATH}
        fill={`url(#shell-grad-${group})`}
        filter={`url(#${HALFTONE_ID}-${group})`}
      />

      {/* Shell border — risograph 2px thick */}
      <path
        d={SHELL_PATH}
        fill="none"
        stroke="#0D0D0D"
        strokeWidth="2.5"
      />

      {/* Overprint accent overlay */}
      <path
        d={SHELL_PATH}
        fill={accentBlend}
        opacity={0.15 + (cfg.grain * 0.2)}
        style={{ mixBlendMode: "screen" }}
      />

      {/* Kernel icon */}
      <g
        stroke="#FAFAF5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.92}
        filter={`url(#${HALFTONE_ID}-${group})`}
      >
        <path d={cfg.kernelPath} />
      </g>

      {/* Animated pulse ring */}
      {animated && (
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={accentBlend}
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="4 6"
        >
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            dur="12s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Category mark — top left stamp */}
      <text
        x="15"
        y="22"
        fontSize="6"
        fontFamily="monospace"
        fill="#FAFAF5"
        opacity="0.7"
        letterSpacing="1"
      >
        {cfg.label.toUpperCase()}
      </text>
    </svg>
  );
}
