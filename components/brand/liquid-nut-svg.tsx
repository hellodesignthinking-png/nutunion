"use client";

import { useMemo } from "react";
import { LogoGenre, GENRES } from "@/lib/brand/genre-engine";

interface LiquidNutSvgProps {
  genre: LogoGenre;
  size?: number;
  animated?: boolean;
  className?: string;
}

// ── Shared outer shell path (organic nut silhouette) ──────────────────────
const SMOOTH_SHELL = "M50 8 C62 8 78 18 82 30 C88 46 84 62 76 72 C68 82 56 92 50 92 C44 92 32 82 24 72 C16 62 12 46 18 30 C22 18 38 8 50 8Z";

// ── Blueprint: CAD drawing with dimension lines ───────────────────────────
function BlueprintKernel() {
  return (
    <g>
      {/* Blueprint grid */}
      <defs>
        <pattern id="bp-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0L0 0 0 8" fill="none" stroke="#1B5FDE" strokeWidth="0.3" opacity="0.4" />
        </pattern>
      </defs>
      <clipPath id="bp-clip"><path d={SMOOTH_SHELL} /></clipPath>
      <rect x="0" y="0" width="100" height="100" fill="url(#bp-grid)" clipPath="url(#bp-clip)" />

      {/* Outer engineering frame */}
      <path d={SMOOTH_SHELL} fill="none" stroke="#4A90D9" strokeWidth="1.5" strokeDasharray="4 2" />

      {/* Center cross-hairs */}
      <line x1="50" y1="25" x2="50" y2="75" stroke="#7EC8E3" strokeWidth="0.8" strokeDasharray="2 2" />
      <line x1="25" y1="50" x2="75" y2="50" stroke="#7EC8E3" strokeWidth="0.8" strokeDasharray="2 2" />

      {/* Dimension lines */}
      <line x1="18" y1="88" x2="82" y2="88" stroke="#C8E0FF" strokeWidth="0.6" />
      <line x1="18" y1="86" x2="18" y2="90" stroke="#C8E0FF" strokeWidth="0.6" />
      <line x1="82" y1="86" x2="82" y2="90" stroke="#C8E0FF" strokeWidth="0.6" />
      <text x="50" y="97" textAnchor="middle" fontSize="4" fill="#C8E0FF" fontFamily="'Space Mono', monospace">84.0 mm</text>

      <line x1="88" y1="8" x2="88" y2="92" stroke="#C8E0FF" strokeWidth="0.6" />
      <line x1="86" y1="8" x2="90" y2="8" stroke="#C8E0FF" strokeWidth="0.6" />
      <line x1="86" y1="92" x2="90" y2="92" stroke="#C8E0FF" strokeWidth="0.6" />
      <text x="95" y="52" textAnchor="middle" fontSize="4" fill="#C8E0FF" fontFamily="'Space Mono', monospace" transform="rotate(90 95 52)">84.0 mm</text>

      {/* Inner technical nut shape */}
      <path d="M50 25 L60 32 L60 50 L50 57 L40 50 L40 32Z"
        fill="none" stroke="#7EC8E3" strokeWidth="1.2" />
      <circle cx="50" cy="44" r="6" fill="none" stroke="#7EC8E3" strokeWidth="1" />

      {/* Corner markers */}
      {[[20,20],[80,20],[20,80],[80,80]].map(([x,y],i) => (
        <g key={i}>
          <line x1={x-4} y1={y} x2={x+4} y2={y} stroke="#4A90D9" strokeWidth="0.8" />
          <line x1={x} y1={y-4} x2={x} y2={y+4} stroke="#4A90D9" strokeWidth="0.8" />
        </g>
      ))}
    </g>
  );
}

// ── Puffy Y2K: 3D glossy inflated nut ─────────────────────────────────────
function PuffyKernel() {
  return (
    <g>
      <defs>
        <radialGradient id="puffy-gloss" cx="35%" cy="30%" r="55%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#FF48B0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8B00FF" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="puffy-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#FFE54C" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FF48B0" stopOpacity="0" />
        </radialGradient>
        <filter id="puffy-blur">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow */}
      <path d={SMOOTH_SHELL} fill="url(#puffy-glow)" transform="scale(1.12) translate(-4,-4)" />

      {/* Main puffy body */}
      <path d="M50 14 C59 14 73 22 76 32 C81 46 77 60 70 69 C63 78 54 86 50 86 C46 86 37 78 30 69 C23 60 19 46 24 32 C27 22 41 14 50 14Z"
        fill="url(#puffy-gloss)" />

      {/* Highlight specular */}
      <ellipse cx="38" cy="32" rx="10" ry="7" fill="white" opacity="0.45" transform="rotate(-20 38 32)" />
      <ellipse cx="36" cy="30" rx="4" ry="2.5" fill="white" opacity="0.7" transform="rotate(-20 36 30)" />

      {/* Star sparkles */}
      {[[68,22,"#FFE54C"],[76,45,"#FFFFFF"],[28,68,"#BF5FFF"]].map(([x,y,c],i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <path d="M0-5 L1-1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1-1Z" fill={c as string} opacity="0.9" />
        </g>
      ))}

      {/* Inner ring detail */}
      <circle cx="50" cy="50" r="14" fill="none" stroke="#FFE54C" strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="50" r="7" fill="#FF48B0" opacity="0.8" />
      <circle cx="50" cy="50" r="3" fill="#FFFFFF" opacity="0.9" />

      {/* Outer border */}
      <path d={SMOOTH_SHELL} fill="none" stroke="#0D0D0D" strokeWidth="2.5" />
    </g>
  );
}

// ── Pixel Art: 8-bit grid rendering of nut ────────────────────────────────
function PixelKernel() {
  // 12×12 pixel map of a nut shape (1=filled, 0=empty)
  const MAP = [
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,0,0,0,0,1,1,1,0],
    [1,1,1,0,0,0,0,0,0,1,1,1],
    [1,1,0,0,0,1,1,0,0,0,1,1],
    [1,1,0,0,1,1,1,1,0,0,1,1],
    [1,1,0,0,1,1,1,1,0,0,1,1],
    [1,1,0,0,0,1,1,0,0,0,1,1],
    [1,1,1,0,0,0,0,0,0,1,1,1],
    [0,1,1,1,0,0,0,0,1,1,1,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,0,0,0],
  ];
  const SIZE = 7;
  const OFFSET_X = 8;
  const OFFSET_Y = 8;
  const colors = ["#00FF41", "#00C8FF", "#FF4500"];

  return (
    <g shapeRendering="crispEdges">
      {MAP.map((row, ri) =>
        row.map((cell, ci) => {
          if (!cell) return null;
          const colorIdx = (ri + ci) % 3 === 0 ? 1 : 0;
          return (
            <rect
              key={`${ri}-${ci}`}
              x={OFFSET_X + ci * SIZE}
              y={OFFSET_Y + ri * SIZE}
              width={SIZE - 1}
              height={SIZE - 1}
              fill={colors[colorIdx]}
            />
          );
        })
      )}
      {/* Scanline overlay */}
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={`scan-${i}`} x={0} y={i * 8} width={100} height={1} fill="black" opacity={0.15} />
      ))}
      {/* CRT corner glow */}
      <rect x="0" y="0" width="100" height="100" fill="none"
        stroke="#00FF41" strokeWidth="2" opacity="0.3" />
    </g>
  );
}

// ── Swiss Punk: bold cut & paste brutalist ────────────────────────────────
function SwissPunkKernel() {
  return (
    <g>
      {/* Bold black bg */}
      <rect x="0" y="0" width="100" height="100" fill="#FAFAF5" />

      {/* Diagonal slash — risograph */}
      <polygon points="0,0 40,0 100,60 100,100 60,100 0,40" fill="#FF2200" opacity="0.92" />
      <polygon points="0,0 20,0 100,80 100,100 80,100 0,20" fill="#FFE100" opacity="0.6" />

      {/* Heavy nut outline — offset shadow */}
      <path d={SMOOTH_SHELL} fill="none" stroke="#0D0D0D" strokeWidth="4"
        transform="translate(3,3)" />
      <path d={SMOOTH_SHELL} fill="white" stroke="#0D0D0D" strokeWidth="3" />

      {/* Big N letter stamp */}
      <text x="50" y="62" textAnchor="middle" fontSize="40" fontWeight="900"
        fontFamily="'Archivo Black', sans-serif" fill="#0D0D0D" letterSpacing="-2">N</text>
      <text x="50" y="62" textAnchor="middle" fontSize="40" fontWeight="900"
        fontFamily="'Archivo Black', sans-serif" fill="#FF2200" letterSpacing="-2"
        opacity="0.4" transform="translate(2,2)">N</text>

      {/* Barcode strip */}
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={10 + i * 5} y={78} width={i % 3 === 0 ? 3 : 2} height={10} fill="#0D0D0D" />
      ))}
      <text x="50" y="94" textAnchor="middle" fontSize="4" fontFamily="'Space Mono', monospace" fill="#0D0D0D">
        NUT-UN10N-2025
      </text>
    </g>
  );
}

// ── Hand-Drawn: marker sketch warmth ─────────────────────────────────────
function HandDrawnKernel() {
  return (
    <g>
      {/* Warm paper bg */}
      <rect x="0" y="0" width="100" height="100" fill="#FDF6EC" />

      {/* Wobbly nut outline (hand-tremor effect via bezier variation) */}
      <path
        d="M50 10 C53 7 66 10 74 18 C84 28 87 44 84 58 C81 72 70 86 58 90 C54 91 46 91 42 90 C30 86 19 72 16 58 C13 44 16 28 26 18 C34 10 47 13 50 10Z"
        fill="#FDF0E0" stroke="#C8571B" strokeWidth="2.5" strokeLinecap="round"
        style={{ filter: "url(#hand-rough)" }}
      />
      <defs>
        <filter id="hand-rough">
          <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
        </filter>
      </defs>

      {/* Inner sketch detail */}
      <path d="M50 30 C55 28 62 32 64 38 C66 44 62 52 56 56 C52 58 48 58 44 56 C38 52 34 44 36 38 C38 32 45 32 50 30Z"
        fill="none" stroke="#8B4513" strokeWidth="1.8" strokeLinecap="round"
        style={{ filter: "url(#hand-rough)" }} />

      {/* Center cross doodle */}
      <line x1="47" y1="40" x2="53" y2="40" stroke="#C8571B" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="37" x2="50" y2="43" stroke="#C8571B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="4" fill="#F5A623" stroke="#C8571B" strokeWidth="1.5" />

      {/* Doodle accents */}
      <path d="M20 25 Q22 22 25 25 Q22 28 20 25Z" fill="#F5A623" />
      <path d="M75 25 Q77 22 80 25 Q77 28 75 25Z" fill="#F5A623" />
      <path d="M20 72 Q22 69 25 72 Q22 75 20 72Z" fill="#C8571B" />
      <path d="M75 72 Q77 69 80 72 Q77 75 75 72Z" fill="#C8571B" />

      {/* Handwriting underline */}
      <path d="M22 82 Q35 84 50 82 Q65 80 78 82" fill="none" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

// ── Main export ──────────────────────────────────────────────────────────
export function LiquidNutSvg({ genre, size = 200, animated = true, className }: LiquidNutSvgProps) {
  const cfg = GENRES[genre];

  const kernelElement = useMemo(() => {
    switch (genre) {
      case "blueprint":   return <BlueprintKernel />;
      case "puffy":       return <PuffyKernel />;
      case "pixel":       return <PixelKernel />;
      case "swiss_punk":  return <SwissPunkKernel />;
      case "hand_drawn":  return <HandDrawnKernel />;
    }
  }, [genre]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`Nut Union ${cfg.label} Logo`}
    >
      {/* Clip the whole thing to the nut shell */}
      <clipPath id={`shell-clip-${genre}`}>
        <path d={SMOOTH_SHELL} />
      </clipPath>

      {/* Background */}
      <rect width="100" height="100" fill={cfg.colors.bg} />

      {/* Genre-specific artwork */}
      <g clipPath={genre === "swiss_punk" || genre === "hand_drawn" ? undefined : `url(#shell-clip-${genre})`}>
        {kernelElement}
      </g>

      {/* Outer shell border — genre-specific */}
      {genre === "blueprint" && (
        <path d={SMOOTH_SHELL} fill="none" stroke={cfg.colors.shell} strokeWidth="1.5" strokeDasharray="4 2" />
      )}
      {genre === "pixel" && (
        <path d={SMOOTH_SHELL} fill="none" stroke={cfg.colors.shell} strokeWidth="2"
          style={{ imageRendering: "pixelated" }} />
      )}

      {/* Animated rotate ring */}
      {animated && genre !== "pixel" && genre !== "swiss_punk" && (
        <circle cx="50" cy="50" r="47" fill="none"
          stroke={cfg.colors.accent} strokeWidth="0.6" opacity="0.5"
          strokeDasharray={genre === "blueprint" ? "3 5" : genre === "hand_drawn" ? "2 3" : "3 3"}>
          <animateTransform attributeName="transform" type="rotate"
            from="0 50 50" to="360 50 50" dur="15s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Pixel scan flicker */}
      {animated && genre === "pixel" && (
        <rect x="0" y="0" width="100" height="100" fill="#00FF41" opacity="0">
          <animate attributeName="opacity" values="0;0.04;0;0.02;0" dur="3s" repeatCount="indefinite" />
        </rect>
      )}
    </svg>
  );
}
