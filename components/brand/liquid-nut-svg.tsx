"use client";

import { useMemo } from "react";
import { LogoGenre, GENRES, generateVariablePath } from "@/lib/brand/genre-engine";

interface LiquidNutSvgProps {
  genre: LogoGenre;
  size?: number;
  animated?: boolean;
  dateSeed?: number;
  activityLevel?: number;
  className?: string;
}

// ── Pixel kernel (8×8 grid) ─────────────────────────────────────────────
function GlitchPixelKernel({ animated }: { animated: boolean }) {
  const MAP = [
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [1,1,1,0,0,0,0,1,1,1],
    [1,1,0,0,1,1,0,0,1,1],
    [1,1,0,1,1,1,1,0,1,1],
    [1,1,0,1,1,1,1,0,1,1],
    [1,1,0,0,1,1,0,0,1,1],
    [1,1,1,0,0,0,0,1,1,1],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
  ];
  const ps = 8, ox = 10, oy = 10;
  const colors = ["#00E676","#00B8D4","#76FF03","#69F0AE"];
  return (
    <g shapeRendering="crispEdges">
      {MAP.map((row, ri) => row.map((cell, ci) => {
        if (!cell) return null;
        const c = colors[(ri * 3 + ci * 2) % colors.length];
        return <rect key={`${ri}-${ci}`} x={ox+ci*ps} y={oy+ri*ps} width={ps-1} height={ps-1} fill={c} />;
      }))}
      {/* scanlines */}
      {Array.from({length:13}).map((_,i)=>(
        <rect key={`sl-${i}`} x={0} y={i*8} width={100} height={1} fill="#000" opacity={0.12} />
      ))}
      {/* glitch slice */}
      {animated && (
        <rect x={0} y={38} width={100} height={6} fill="#010B06" opacity={0}>
          <animate attributeName="opacity" values="0;0;0.8;0;0;0.5;0" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="y" values="38;38;44;38;55;38" dur="2.5s" repeatCount="indefinite" />
        </rect>
      )}
      {/* CRT border */}
      <rect x={1} y={1} width={98} height={98} fill="none" stroke="#00E676" strokeWidth="1.5" opacity={0.4} />
    </g>
  );
}

// ── Blueprint kernel ────────────────────────────────────────────────────
function BlueprintKernel({ shell }: { shell: string }) {
  return (
    <g>
      <defs>
        <pattern id="bp3-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0L0 0 0 10" fill="none" stroke="#1976D2" strokeWidth="0.4" opacity={0.5} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={100} height={100} fill="url(#bp3-grid)" />
      {/* outer shell dash */}
      <path d={shell} fill="none" stroke="#42A5F5" strokeWidth="1.5" strokeDasharray="5 3" />
      {/* center cross */}
      <line x1={50} y1={20} x2={50} y2={80} stroke="#80D8FF" strokeWidth={0.8} strokeDasharray="2 2" />
      <line x1={20} y1={50} x2={80} y2={50} stroke="#80D8FF" strokeWidth={0.8} strokeDasharray="2 2" />
      {/* technical hexnut inner */}
      <path d="M50 28 L61 34 L61 50 L50 56 L39 50 L39 34Z" fill="none" stroke="#80D8FF" strokeWidth={1.2} />
      <circle cx={50} cy={43} r={6} fill="none" stroke="#80D8FF" strokeWidth={1} />
      {/* dim lines */}
      <line x1={16} y1={88} x2={84} y2={88} stroke="#E3F2FD" strokeWidth={0.6} />
      <line x1={16} y1={85} x2={16} y2={91} stroke="#E3F2FD" strokeWidth={0.6} />
      <line x1={84} y1={85} x2={84} y2={91} stroke="#E3F2FD" strokeWidth={0.6} />
      <text x={50} y={97} textAnchor="middle" fontSize={4} fill="#E3F2FD" fontFamily="'Space Mono',monospace">Ø 84.0 mm</text>
      {/* corner targets */}
      {[[18,18],[82,18],[18,82],[82,82]].map(([x,y],i)=>(
        <g key={i}>
          <line x1={x-5} y1={y} x2={x+5} y2={y} stroke="#42A5F5" strokeWidth={0.7} />
          <line x1={x} y1={y-5} x2={x} y2={y+5} stroke="#42A5F5" strokeWidth={0.7} />
          <circle cx={x} cy={y} r={1.5} fill="#42A5F5" opacity={0.6} />
        </g>
      ))}
    </g>
  );
}

// ── Puffy Jelly kernel ──────────────────────────────────────────────────
function PuffyJellyKernel() {
  return (
    <g>
      <defs>
        <radialGradient id="pj3-grad" cx="38%" cy="30%" r="58%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
          <stop offset="35%" stopColor="#E040FB" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#4A148C" stopOpacity={0.95} />
        </radialGradient>
        <radialGradient id="pj3-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F8E71C" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#E040FB" stopOpacity={0} />
        </radialGradient>
        <filter id="pj3-shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#E040FB" floodOpacity={0.5} />
        </filter>
      </defs>
      {/* Outer glow ring */}
      <path d="M50 12 C61 12 76 21 79 32 C85 47 80 63 73 72 C66 81 56 89 50 89 C44 89 34 81 27 72 C20 63 15 47 21 32 C24 21 39 12 50 12Z"
        fill="url(#pj3-glow)" transform="scale(1.1) translate(-5,-5)" />
      {/* Main body */}
      <path d="M50 16 C61 16 75 23 78 34 C83 48 79 62 72 71 C65 80 56 87 50 87 C44 87 35 80 28 71 C21 62 17 48 22 34 C25 23 39 16 50 16Z"
        fill="url(#pj3-grad)" filter="url(#pj3-shadow)" />
      {/* Specular highlight */}
      <ellipse cx={37} cy={30} rx={12} ry={7} fill="white" opacity={0.5} transform="rotate(-25 37 30)" />
      <ellipse cx={35} cy={28} rx={5} ry={3} fill="white" opacity={0.8} transform="rotate(-25 35 28)" />
      {/* Inner ring */}
      <circle cx={50} cy={52} r={15} fill="none" stroke="#F8E71C" strokeWidth={2} opacity={0.6} />
      <circle cx={50} cy={52} r={8} fill="#E040FB" opacity={0.85} />
      <circle cx={50} cy={52} r={4} fill="white" opacity={0.9} />
      {/* Stars */}
      {[[70,20,"#F8E71C"],[78,48,"#FFF"],[25,70,"#CE93D8"]].map(([px,py,c],i)=>(
        <g key={i} transform={`translate(${px},${py})`}>
          <path d="M0-6L1-1L6 0L1 1L0 6L-1 1L-6 0L-1-1Z" fill={c as string} opacity={0.95} />
        </g>
      ))}
      <path d="M50 14 C61 14 76 22 79 33 C85 48 80 62 73 71 C66 80 56 88 50 88 C44 88 34 80 27 71 C20 62 15 48 21 33 C24 22 39 14 50 14Z"
        fill="none" stroke="#0D0D0D" strokeWidth={2.5} />
    </g>
  );
}

// ── Swiss Punk kernel ───────────────────────────────────────────────────
function SwissPunkKernel({ shell }: { shell: string }) {
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} fill="#F5F5F0" />
      <polygon points="0,0 55,0 100,45 100,100 45,100 0,55" fill="#E5000A" opacity={0.9} />
      <polygon points="0,0 25,0 100,75 100,100 75,100 0,25" fill="#FFD600" opacity={0.55} />
      {/* Shadow */}
      <path d={shell} fill="none" stroke="#0D0D0D" strokeWidth={5} transform="translate(4,4)" opacity={0.3} />
      {/* Shell white over */}
      <path d={shell} fill="#F5F5F0" stroke="#0D0D0D" strokeWidth={3} />
      {/* Bold N stamp */}
      <text x={50} y={63} textAnchor="middle" fontSize={42} fontWeight={900}
        fontFamily="'Archivo Black',sans-serif" fill="#0D0D0D" letterSpacing={-2}>N</text>
      <text x={52} y={65} textAnchor="middle" fontSize={42} fontWeight={900}
        fontFamily="'Archivo Black',sans-serif" fill="#E5000A" letterSpacing={-2} opacity={0.35}>N</text>
      {/* Barcode */}
      {Array.from({length:18}).map((_,i)=>(
        <rect key={i} x={8+i*4.8} y={78} width={i%4===0?3:2} height={10} fill="#0D0D0D" />
      ))}
      <text x={50} y={94} textAnchor="middle" fontSize={3.5} fontFamily="'Space Mono',monospace" fill="#0D0D0D">
        NUT-UN10N · 2025
      </text>
    </g>
  );
}

// ── Crayon Box kernel ───────────────────────────────────────────────────
function CrayonBoxKernel({ shell }: { shell: string }) {
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} fill="#FFFAF0" />
      <defs>
        <filter id="cb3-rough">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" seed="5" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" />
        </filter>
        <filter id="cb3-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feBlend in="SourceGraphic" in2="g" mode="multiply" />
        </filter>
      </defs>
      {/* Crayon fill */}
      <path d={shell} fill="#FDD835" opacity={0.4} filter="url(#cb3-rough)" />
      <path d={shell} fill="#D84315" opacity={0.15} filter="url(#cb3-rough)" transform="translate(2,-2)" />
      {/* Main outline */}
      <path d={shell} fill="none" stroke="#D84315" strokeWidth={3} strokeLinecap="round"
        filter="url(#cb3-rough)" />
      {/* Wobbly center motif */}
      <path d="M50 32 C55 30 63 34 65 40 C68 48 64 57 57 61 C53 63 47 63 43 61 C36 57 32 48 35 40 C37 34 45 34 50 32Z"
        fill="none" stroke="#6D4C41" strokeWidth={2} strokeLinecap="round" filter="url(#cb3-rough)" />
      <circle cx={50} cy={50} r={6} fill="#FDD835" stroke="#D84315" strokeWidth={2} filter="url(#cb3-rough)" />
      {/* Scribble accents */}
      <path d="M18 28 Q22 24 26 28" fill="none" stroke="#FDD835" strokeWidth={2} strokeLinecap="round" />
      <path d="M74 28 Q78 24 82 28" fill="none" stroke="#FDD835" strokeWidth={2} strokeLinecap="round" />
      <path d="M18 72 Q22 76 26 72" fill="none" stroke="#D84315" strokeWidth={2} strokeLinecap="round" />
      <path d="M74 72 Q78 76 82 72" fill="none" stroke="#D84315" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

// ── Neo Gradient kernel ─────────────────────────────────────────────────
function NeoGradientKernel({ shell }: { shell: string }) {
  return (
    <g>
      <defs>
        <radialGradient id="ng3-a" cx="20%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#7B2FBE" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ng3-b" cx="80%" cy="80%" r="60%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#FF6B9D" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="ng3-c" cx="80%" cy="20%" r="55%">
          <stop offset="0%" stopColor="#F8E71C" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#7B2FBE" stopOpacity={0} />
        </radialGradient>
        <filter id="ng3-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect x={0} y={0} width={100} height={100} fill="#08004A" />
      {/* Mesh gradient blobs */}
      <ellipse cx={25} cy={25} rx={40} ry={40} fill="url(#ng3-a)" filter="url(#ng3-blur)" opacity={0.8} />
      <ellipse cx={75} cy={75} rx={40} ry={40} fill="url(#ng3-b)" filter="url(#ng3-blur)" opacity={0.8} />
      <ellipse cx={78} cy={22} rx={30} ry={30} fill="url(#ng3-c)" filter="url(#ng3-blur)" opacity={0.7} />
      {/* Nut shell on top */}
      <path d={shell} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
      {/* Inner organic form */}
      <path d="M50 30 C62 30 70 40 70 50 C70 62 62 70 50 70 C38 70 30 62 30 50 C30 40 38 30 50 30Z"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="4 3" />
      {/* Center orb */}
      <circle cx={50} cy={50} r={12} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <circle cx={50} cy={50} r={5} fill="white" opacity={0.8} />
      {/* Floating particles */}
      {[[22,45,3,"#FF6B9D"],[75,35,2,"#00D4FF"],[40,72,2.5,"#F8E71C"],[65,65,2,"#FF6B9D"]].map(([px,py,r,c],i)=>(
        <circle key={i} cx={px as number} cy={py as number} r={r as number} fill={c as string} opacity={0.8} />
      ))}
    </g>
  );
}

// ── Industrial kernel ───────────────────────────────────────────────────
function IndustrialKernel({ shell }: { shell: string }) {
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} fill="#1A1208" />
      <defs>
        <filter id="ind3-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="9" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feBlend in="SourceGraphic" in2="g" mode="multiply" result="m" />
          <feComponentTransfer in="m"><feFuncA type="linear" slope="0.85" /></feComponentTransfer>
        </filter>
        <filter id="ind3-rough">
          <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </defs>
      {/* Rust texture bg */}
      <rect x={0} y={0} width={100} height={100} fill="#3E2000" filter="url(#ind3-grain)" opacity={0.6} />
      {/* Stencil shell knocked-out */}
      <path d={shell} fill="#8B6914" filter="url(#ind3-rough)" opacity={0.8} />
      <path d={shell} fill="none" stroke="#FF6F00" strokeWidth={2.5} filter="url(#ind3-rough)" />
      {/* Stencil holes */}
      <rect x={35} y={35} width={30} height={30} fill="#1A1208" rx={2} />
      <rect x={40} y={40} width={20} height={20} fill="#1A1208" rx={1} />
      {/* Rivets */}
      {[[20,20],[80,20],[20,80],[80,80],[50,10],[50,90],[10,50],[90,50]].map(([px,py],i)=>(
        <circle key={i} cx={px} cy={py} r={3} fill="#5D4E37" stroke="#FF6F00" strokeWidth={0.8} />
      ))}
      {/* Weight label */}
      <text x={50} y={54} textAnchor="middle" fontSize={10} fontWeight={700}
        fontFamily="'Stardos Stencil',sans-serif" fill="#FF6F00" opacity={0.9}>NUT</text>
      {/* Danger stripe */}
      {Array.from({length:5}).map((_,i)=>(
        <rect key={i} x={i*22-5} y={80} width={11} height={12} fill={i%2===0?"#FF6F00":"#1A1208"} opacity={0.85} />
      ))}
    </g>
  );
}

// ── Eco Organic kernel ──────────────────────────────────────────────────
function EcoOrganicKernel({ shell }: { shell: string }) {
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} fill="#0E1A0F" />
      <defs>
        <radialGradient id="eco3-sun" cx="50%" cy="30%" r="40%">
          <stop offset="0%" stopColor="#CDDC39" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#0E1A0F" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={50} cy={35} rx={28} ry={28} fill="url(#eco3-sun)" />
      {/* Organic nut form */}
      <path d={shell} fill="#1B4D1D" />
      <path d={shell} fill="none" stroke="#43A047" strokeWidth={2} strokeLinecap="round" />
      {/* Leaf veins */}
      <path d="M50 20 Q55 35 50 50 Q45 35 50 20Z" fill="none" stroke="#CDDC39" strokeWidth={1} opacity={0.7} />
      <path d="M35 30 Q45 42 50 50 Q42 40 35 30Z" fill="none" stroke="#CDDC39" strokeWidth={1} opacity={0.6} />
      <path d="M65 30 Q55 42 50 50 Q58 40 65 30Z" fill="none" stroke="#CDDC39" strokeWidth={1} opacity={0.6} />
      {/* Dots — seeds */}
      {[[50,65,3],[38,72,2],[62,72,2],[30,55,1.5],[70,55,1.5]].map(([px,py,r],i)=>(
        <circle key={i} cx={px as number} cy={py as number} r={r as number} fill="#CDDC39" opacity={0.8} />
      ))}
      {/* Root lines */}
      <path d="M50 75 Q45 82 40 88" fill="none" stroke="#2E7D32" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M50 75 Q55 82 60 88" fill="none" stroke="#2E7D32" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M50 75 L50 90" fill="none" stroke="#2E7D32" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}

// ── Main export ──────────────────────────────────────────────────────────
export function LiquidNutSvg({
  genre, size = 200, animated = true, dateSeed = 0, activityLevel = 0, className,
}: LiquidNutSvgProps) {
  const cfg = GENRES[genre];

  // Variable nut shell path (Nordkyn-style morphing)
  const shell = useMemo(
    () => generateVariablePath(dateSeed, activityLevel),
    [dateSeed, activityLevel]
  );

  const kernel = useMemo(() => {
    switch (genre) {
      case "blueprint":    return <BlueprintKernel shell={shell} />;
      case "puffy_jelly":  return <PuffyJellyKernel />;
      case "glitch_pixel": return <GlitchPixelKernel animated={animated} />;
      case "swiss_punk":   return <SwissPunkKernel shell={shell} />;
      case "crayon_box":   return <CrayonBoxKernel shell={shell} />;
      case "neo_gradient": return <NeoGradientKernel shell={shell} />;
      case "industrial":   return <IndustrialKernel shell={shell} />;
      case "eco_organic":  return <EcoOrganicKernel shell={shell} />;
    }
  }, [genre, shell, animated]);

  // Genre-specific animation
  const animEl = useMemo(() => {
    if (!animated) return null;
    switch (cfg.animation) {
      case "drift":
        return <path d={shell} fill="none" stroke={cfg.colors.accent} strokeWidth={0.5} opacity={0.4}
          strokeDasharray="4 6">
          <animateTransform attributeName="transform" type="rotate"
            from="0 50 50" to="360 50 50" dur="18s" repeatCount="indefinite" />
        </path>;
      case "jelly":
        return <circle cx={50} cy={50} r={46} fill="none" stroke={cfg.colors.accent}
          strokeWidth={0.6} opacity={0.4} strokeDasharray="3 3">
          <animate attributeName="rx" values="46;48;45;47;46" dur="3s" repeatCount="indefinite" />
        </circle>;
      case "flow":
        return <ellipse cx={50} cy={50} rx={46} ry={46} fill="none"
          stroke={cfg.colors.accent} strokeWidth={0.5} opacity={0.35}
          strokeDasharray="6 4">
          <animateTransform attributeName="transform" type="rotate"
            from="0 50 50" to="-360 50 50" dur="10s" repeatCount="indefinite" />
          <animate attributeName="rx" values="46;50;43;48;46" dur="5s" repeatCount="indefinite" />
        </ellipse>;
      case "breathe":
        return <path d={shell} fill={cfg.colors.accent} opacity={0}>
          <animate attributeName="opacity" values="0;0.07;0;0.05;0" dur="4s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale"
            values="1 1;1.03 1.03;1 1" additive="sum" dur="4s" repeatCount="indefinite" />
        </path>;
      case "glitch":
        return <rect x={0} y={0} width={100} height={100} fill={cfg.colors.primary} opacity={0}>
          <animate attributeName="opacity" values="0;0;0.06;0;0;0.04;0" dur="2s" repeatCount="indefinite" />
        </rect>;
      default:
        return null;
    }
  }, [animated, cfg, shell]);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}
      xmlns="http://www.w3.org/2000/svg" className={className}
      role="img" aria-label={`Nut Union ${cfg.label} Logo`}>

      <clipPath id={`shell3-${genre}`}><path d={shell} /></clipPath>

      {/* Global bg */}
      <rect width={100} height={100} fill={cfg.colors.bg} />

      {/* Kernel artwork */}
      <g clipPath={["swiss_punk","crayon_box","eco_organic"].includes(genre)
        ? undefined : `url(#shell3-${genre})`}>
        {kernel}
      </g>

      {/* Genre-specific animated element */}
      {animEl}

      {/* Genre badge (top-left stamp) */}
      <text x={8} y={13} fontSize={5} fontFamily="monospace"
        fill={cfg.colors.text} opacity={0.65} letterSpacing={1}>
        {cfg.label.toUpperCase()}
      </text>
    </svg>
  );
}
