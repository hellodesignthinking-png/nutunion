"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

type LogoFamily =
  | "monolith" | "signal" | "seal" | "ribbon" | "sticker"
  | "totem" | "poster" | "wave" | "rails" | "mosaic";

interface PaletteSet {
  bg: string; panel: string; ink: string;
  accent: string; accentTwo: string; soft: string;
}

interface LogoVariant {
  id: number; seed: number; family: LogoFamily;
  label: string; subtitle: string; energy: string;
  palette: PaletteSet; fontStack: string; dateCode: string;
}

const DAILY_VARIANT_COUNT = 100;
const FAMILIES: LogoFamily[] = ["monolith","signal","seal","ribbon","sticker","totem","poster","wave","rails","mosaic"];

const PALETTES: PaletteSet[] = [
  { bg:"#f6f1e8", panel:"#fff9f0", ink:"#111111", accent:"#ff5c33", accentTwo:"#1d4ed8", soft:"#eadfca" },
  { bg:"#0c1222", panel:"#121b31", ink:"#f8fafc", accent:"#38bdf8", accentTwo:"#f97316", soft:"#1e293b" },
  { bg:"#fbf6d6", panel:"#fffce8", ink:"#101010", accent:"#e11d48", accentTwo:"#059669", soft:"#efe8b0" },
  { bg:"#1c1410", panel:"#281d18", ink:"#f7ead7", accent:"#f59e0b", accentTwo:"#fb7185", soft:"#3b2b22" },
  { bg:"#edf6ff", panel:"#ffffff", ink:"#0f172a", accent:"#7c3aed", accentTwo:"#0ea5e9", soft:"#d8eaff" },
  { bg:"#faf5ef", panel:"#fffdf9", ink:"#171717", accent:"#16a34a", accentTwo:"#ca8a04", soft:"#ece3d6" },
  { bg:"#151515", panel:"#222222", ink:"#f5f5f5", accent:"#f43f5e", accentTwo:"#22c55e", soft:"#2f2f2f" },
  { bg:"#fff1f2", panel:"#ffffff", ink:"#1f2937", accent:"#ec4899", accentTwo:"#14b8a6", soft:"#ffe0e6" },
  { bg:"#ffffff", panel:"#f5f5f5", ink:"#111111", accent:"#d00000", accentTwo:"#111111", soft:"#eeeeee" },
  { bg:"#1a0033", panel:"#2d0066", ink:"#ffffff", accent:"#bf5af2", accentTwo:"#00d4ff", soft:"#3d0080" },
  { bg:"#e8ede4", panel:"#f2f5ef", ink:"#1a2314", accent:"#c45c26", accentTwo:"#3d6b3a", soft:"#ccd9c5" },
  { bg:"#f5d800", panel:"#fde900", ink:"#0a0a0a", accent:"#0a0a0a", accentTwo:"#cc0000", soft:"#e6cc00" },
  { bg:"#e8f9f9", panel:"#ffffff", ink:"#0d2b2b", accent:"#007b7b", accentTwo:"#ff6b4a", soft:"#b8eded" },
  { bg:"#0a1628", panel:"#0d1f3c", ink:"#f4e9c3", accent:"#c9a227", accentTwo:"#4a90d9", soft:"#1a2f50" },
  { bg:"#e5e5e0", panel:"#eeeeeb", ink:"#2c2c2c", accent:"#ff6200", accentTwo:"#2c2c2c", soft:"#d5d5cf" },
  { bg:"#fff0f6", panel:"#ffffff", ink:"#1a001a", accent:"#ff0066", accentTwo:"#66ff00", soft:"#ffccdd" },
  { bg:"#0a1a0e", panel:"#0f2416", ink:"#d4f0dc", accent:"#22c55e", accentTwo:"#f59e0b", soft:"#1a3020" },
  { bg:"#f4e8d5", panel:"#faf3ea", ink:"#2d1a0a", accent:"#c05a2a", accentTwo:"#7a9e6c", soft:"#e8d4b8" },
  { bg:"#f0f4ff", panel:"#ffffff", ink:"#1a2040", accent:"#2040e0", accentTwo:"#40d0ff", soft:"#d8e4ff" },
  { bg:"#1a3330", panel:"#243d3a", ink:"#e8f5f2", accent:"#2eb8a0", accentTwo:"#d4904a", soft:"#2a4540" },
];

const LABEL_PARTS = ["CITY","COMMON","FIELD","WAVE","LOCAL","SHIFT","MAKERS","SIGNAL","PUBLIC","SCENE","OPEN","GROUND","FORM","LAYER","UNIT"];
const SUB_PARTS = ["spatial action","cultural relay","platform rhythm","community studio","local experiment","distributed practice","public texture","living archive","collective motion","field research"];
const ENERGY_WORDS = ["직조된 팀워크","거리의 리듬","낙관적인 실험","거친 추진력","손맛 나는 연결","집단적 편집","도시적 생동","현장형 상상력","열린 네트워크","공동의 밀도"];
const FONT_STACKS = [
  '"Arial Black","Helvetica Neue",sans-serif',
  '"Impact","Arial Narrow",sans-serif',
  '"Trebuchet MS","Avenir Next",sans-serif',
  '"Georgia","Times New Roman",serif',
  '"Courier New","SFMono-Regular",monospace',
  '"Gill Sans","Trebuchet MS",sans-serif',
  '"Verdana","Geneva",sans-serif',
  '"Palatino Linotype","Book Antiqua",serif',
  '"Lucida Console","Monaco",monospace',
  '"Tahoma","Geneva",sans-serif',
];

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" }).format(date);
}
function getDateCode(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
}
function createSeededRandom(seed: number) {
  let v = seed % 2147483647;
  if (v <= 0) v += 2147483646;
  return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; };
}
function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function generateDailyVariants(date: Date): LogoVariant[] {
  const dateCode = getDateCode(date);
  const baseSeed = Number(dateCode);
  return Array.from({ length: DAILY_VARIANT_COUNT }, (_, index) => {
    const seed = baseSeed + index * 97;
    const random = createSeededRandom(seed);
    const family = FAMILIES[index % FAMILIES.length];
    const palette = PALETTES[Math.floor(random() * PALETTES.length)];
    const left = pick(LABEL_PARTS, random);
    const right = pick(LABEL_PARTS, random);
    const label = left === right ? `${left} UNION` : `${left} ${right}`;
    return { id:index+1, seed, family, label, subtitle:pick(SUB_PARTS,random), energy:pick(ENERGY_WORDS,random), palette, fontStack:pick(FONT_STACKS,random), dateCode } satisfies LogoVariant;
  });
}

function OpenLogoArtwork({ variant, size }: { variant: LogoVariant; size: number }) {
  const { family, palette, label, seed, fontStack } = variant;
  const rng = createSeededRandom(seed + 1337);
  const sub = Math.floor(rng() * 4);
  const rx = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const ri = (lo: number, hi: number) => Math.floor(rx(lo, hi + 1));

  const { bg, panel, ink, accent: a1, accentTwo: a2, soft } = palette;
  const sl = label.split(" ")[0] || "NU";
  const N = sl[0] || "N";

  let inner: React.ReactNode = null;

  // ── MONOLITH ─────────────────────────────────────────────────────────
  if (family === "monolith") {
    if (sub === 0) {
      // Horizontal mass blocks
      const h1 = rx(22,40), h2 = rx(12,22);
      inner = <>
        <rect x="0" y="0" width="100" height={h1} fill={a1}/>
        <rect x="0" y={h1} width="100" height={h2} fill={ink}/>
        <rect x="0" y={h1+h2} width="100" height={100-h1-h2} fill={panel}/>
        <text x="6" y={h1*0.78} fontSize={h1*0.58} fontFamily={fontStack} fontWeight="900" fill={panel}>{sl}</text>
        <line x1="6" y1={h1+h2+14} x2="94" y2={h1+h2+14} stroke={a1} strokeWidth="1.5"/>
        <text x="6" y={h1+h2+26} fontSize="6.5" fontFamily={fontStack} fill={ink} letterSpacing="3">NUTUNION</text>
      </>;
    } else if (sub === 1) {
      // Vertical split — left solid / right stripes
      const sp = rx(38,55);
      inner = <>
        <rect x="0" y="0" width={sp} height="100" fill={ink}/>
        <rect x={sp} y="0" width={100-sp} height="100" fill={panel}/>
        {Array.from({length:7},(_,i)=>(
          <rect key={i} x={sp} y={i*15+rx(0,5)} width={100-sp} height={rx(3,9)} fill={i%2===0?a1:soft} opacity="0.9"/>
        ))}
        <text x={sp/2} y="60" textAnchor="middle" fontSize="26" fontFamily={fontStack} fontWeight="900" fill={panel}>{N}</text>
        <text x={sp/2} y="73" textAnchor="middle" fontSize="5.5" fontFamily={fontStack} fill={a1} letterSpacing="1.5">NUT</text>
      </>;
    } else if (sub === 2) {
      // Single rotated diamond
      const cx=rx(38,62), cy=rx(38,62), r2=rx(30,42);
      const sq = r2*Math.SQRT2;
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <rect x={cx-sq/2} y={cy-sq/2} width={sq} height={sq} fill={a1} transform={`rotate(45 ${cx} ${cy})`}/>
        <rect x={cx-sq*0.45/2} y={cy-sq*0.45/2} width={sq*0.45} height={sq*0.45} fill={panel} transform={`rotate(45 ${cx} ${cy})`}/>
        <text x={cx} y={cy+4} textAnchor="middle" fontSize="12" fontFamily={fontStack} fontWeight="900" fill={ink}>{N}</text>
        <rect x="0" y="88" width="100" height="12" fill={ink}/>
        <text x="6" y="97" fontSize="6.5" fontFamily={fontStack} fill={panel} letterSpacing="2">NU</text>
      </>;
    } else {
      // Big letterform fills frame
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={a1}/>
        <text x="50" y="88" textAnchor="middle" fontSize="100" fontFamily={fontStack} fontWeight="900" fill={panel} opacity="0.12">{N}</text>
        <text x="50" y="86" textAnchor="middle" fontSize="100" fontFamily={fontStack} fontWeight="900" fill={ink} opacity="0.9">{N}</text>
        <rect x="0" y="0" width="100" height="18" fill={ink} opacity="0.85"/>
        <text x="6" y="13" fontSize="6" fontFamily={fontStack} fill={panel} letterSpacing="3">NUTUNION OPEN</text>
      </>;
    }
  }

  // ── SIGNAL ────────────────────────────────────────────────────────────
  if (family === "signal") {
    if (sub === 0) {
      // Concentric arcs from corner
      const n = ri(3,6);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        {Array.from({length:n},(_,i)=>{
          const r3=18+i*(68/n);
          return <path key={i} d={`M 8 8 m ${r3} 0 a ${r3} ${r3} 0 0 0 0 ${r3}`} fill="none"
            stroke={i%2===0?a1:a2} strokeWidth={rx(2,5)} strokeLinecap="round"/>;
        })}
        <circle cx="8" cy="8" r="6" fill={a1}/>
        <rect x="0" y="84" width="100" height="16" fill={panel} opacity="0.08"/>
        <text x="8" y="96" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="2">SIGNAL</text>
      </>;
    } else if (sub === 1) {
      // Sunburst rays
      const rays = ri(9,18);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        {Array.from({length:rays},(_,i)=>{
          const angle=(i/rays)*Math.PI*2;
          return <line key={i} x1="50" y1="50"
            x2={50+Math.cos(angle)*48} y2={50+Math.sin(angle)*48}
            stroke={i%3===0?a1:ink} strokeWidth={i%2===0?2:1} opacity="0.75"/>;
        })}
        <circle cx="50" cy="50" r="15" fill={a1}/>
        <circle cx="50" cy="50" r="8" fill={panel}/>
        <text x="50" y="54" textAnchor="middle" fontSize="7" fontFamily={fontStack} fontWeight="900" fill={ink}>NU</text>
      </>;
    } else if (sub === 2) {
      // Radar scan + horizontal bars
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        {Array.from({length:11},(_,i)=>(
          <rect key={i} x="8" y={8+i*7.5} width={rx(25,75)} height={rx(2,5)} fill={i%3===0?a1:i%5===0?a2:panel} opacity={0.5+i*0.04} rx="1"/>
        ))}
        <circle cx="76" cy="34" r="18" fill="none" stroke={a2} strokeWidth="3"/>
        <circle cx="76" cy="34" r="10" fill="none" stroke={a2} strokeWidth="1.5"/>
        <circle cx="76" cy="34" r="4" fill={a2}/>
        <line x1="76" y1="10" x2="76" y2="58" stroke={a2} strokeWidth="1" strokeDasharray="3,3"/>
        <line x1="52" y1="34" x2="100" y2="34" stroke={a2} strokeWidth="1" strokeDasharray="3,3"/>
      </>;
    } else {
      // Oscilloscope frequency
      const pts = Array.from({length:18},(_,i)=>{
        const x=8+i*4.9, amp=rx(6,30);
        return `${x},${50+(i%2===0?amp:-amp)}`;
      }).join(" ");
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={a1}/>
        <polyline points={pts} fill="none" stroke={panel} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="50" x2="92" y2="50" stroke={panel} strokeWidth="0.8" strokeDasharray="2,3" opacity="0.4"/>
        <rect x="0" y="80" width="100" height="20" fill={ink}/>
        <text x="8" y="94" fontSize="8" fontFamily={fontStack} fill={a2} letterSpacing="1">FREQUENCY</text>
      </>;
    }
  }

  // ── SEAL ─────────────────────────────────────────────────────────────
  if (family === "seal") {
    if (sub === 0) {
      // Circular official seal
      const ticks = ri(16,24);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <circle cx="50" cy="50" r="46" fill={ink}/>
        <circle cx="50" cy="50" r="38" fill="none" stroke={a1} strokeWidth="2"/>
        {Array.from({length:ticks},(_,i)=>{
          const ang=(i/ticks)*Math.PI*2;
          return <line key={i} x1={50+Math.cos(ang)*38} y1={50+Math.sin(ang)*38}
            x2={50+Math.cos(ang)*44} y2={50+Math.sin(ang)*44}
            stroke={a1} strokeWidth={i%4===0?2.5:1}/>;
        })}
        <circle cx="50" cy="50" r="28" fill={panel}/>
        <text x="50" y="46" textAnchor="middle" fontSize="13" fontFamily={fontStack} fontWeight="900" fill={ink} letterSpacing="1">NUT</text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fontFamily={fontStack} fill={a1} letterSpacing="2">UNION</text>
      </>;
    } else if (sub === 1) {
      // Diamond badge
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <polygon points="50,5 95,50 50,95 5,50" fill={a1}/>
        <polygon points="50,14 86,50 50,86 14,50" fill={ink}/>
        <polygon points="50,26 74,50 50,74 26,50" fill={panel}/>
        <text x="50" y="47" textAnchor="middle" fontSize="10" fontFamily={fontStack} fontWeight="900" fill={a1}>NU</text>
        <text x="50" y="59" textAnchor="middle" fontSize="7.5" fontFamily={fontStack} fill={a2} letterSpacing="1">UNION</text>
        {[0,1,2,3].map(i=>{const a=(i/4)*Math.PI*2-Math.PI/4; return <circle key={i} cx={50+Math.cos(a)*46} cy={50+Math.sin(a)*46} r="3" fill={a2}/>;})}
      </>;
    } else if (sub === 2) {
      // Octagonal stamp
      const oct=(cx:number,cy:number,r:number)=>{const a=0.383*r; return `${cx-a},${cy-r} ${cx+a},${cy-r} ${cx+r},${cy-a} ${cx+r},${cy+a} ${cx+a},${cy+r} ${cx-a},${cy+r} ${cx-r},${cy+a} ${cx-r},${cy-a}`;};
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        <polygon points={oct(50,50,46)} fill={a1}/>
        <polygon points={oct(50,50,38)} fill={ink}/>
        <polygon points={oct(50,50,29)} fill={panel}/>
        <text x="50" y="47" textAnchor="middle" fontSize="12" fontFamily={fontStack} fontWeight="900" fill={ink}>NUT</text>
        <text x="50" y="60" textAnchor="middle" fontSize="8.5" fontFamily={fontStack} fill={a1} letterSpacing="2">UNION</text>
        {[0,1,2,3,4,5,6,7].map(i=>{const a=(i/8)*Math.PI*2-Math.PI/8; return <circle key={i} cx={50+Math.cos(a)*42} cy={50+Math.sin(a)*42} r="2.5" fill={a2}/>;})}
      </>;
    } else {
      // Postage stamp
      const perf=(x:number,y:number)=><circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={bg}/>;
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={a1}/>
        <rect x="10" y="10" width="80" height="80" fill={panel}/>
        {Array.from({length:9},(_,i)=>perf(14+i*9,7))}
        {Array.from({length:9},(_,i)=>perf(14+i*9,93))}
        {Array.from({length:9},(_,i)=>perf(7,14+i*9))}
        {Array.from({length:9},(_,i)=>perf(93,14+i*9))}
        <rect x="16" y="16" width="68" height="46" fill={soft}/>
        <text x="50" y="44" textAnchor="middle" fontSize="20" fontFamily={fontStack} fontWeight="900" fill={ink}>NU</text>
        <text x="50" y="57" textAnchor="middle" fontSize="8.5" fontFamily={fontStack} fill={a1} letterSpacing="2">UNION</text>
        <text x="50" y="80" textAnchor="middle" fontSize="13" fontFamily={fontStack} fontWeight="900" fill={a1}>∞</text>
      </>;
    }
  }

  // ── RIBBON ────────────────────────────────────────────────────────────
  if (family === "ribbon") {
    if (sub === 0) {
      // Three diagonal parallelograms
      const sk=rx(10,22);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <polygon points={`${sk},0 100,0 ${100-sk},38 0,38`} fill={a1}/>
        <polygon points={`0,34 100,34 ${100-sk/2},68 ${sk/2},68`} fill={ink}/>
        <polygon points={`0,64 100,64 100,100 0,100`} fill={a2}/>
        <text x={sk+6} y="27" fontSize="16" fontFamily={fontStack} fontWeight="900" fill={panel}>{sl}</text>
        <text x="8" y="88" fontSize="11" fontFamily={fontStack} fontWeight="900" fill={panel}>UNION</text>
      </>;
    } else if (sub === 1) {
      // Racing stripes
      const mh=rx(26,42), my=rx(10,25);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        <rect x="0" y={my} width="100" height={mh} fill={a1}/>
        <rect x="0" y={my+mh+rx(2,8)} width="100" height={rx(4,10)} fill={ink}/>
        <rect x="0" y={my+mh+rx(12,22)} width="100" height={rx(2,5)} fill={a2}/>
        <text x="8" y={my+mh*0.72} fontSize={mh*0.55} fontFamily={fontStack} fontWeight="900" fill={panel}>{N}</text>
      </>;
    } else if (sub === 2) {
      // Scroll/banner
      const y1=rx(28,36), y2=rx(60,70);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <path d={`M 10 ${y1} C 10 ${y1-10}, 90 ${y1-10}, 90 ${y1} L 90 ${y2} C 90 ${y2+10}, 10 ${y2+10}, 10 ${y2} Z`} fill={a1}/>
        <path d={`M 10 ${y1} C 6 ${y1}, 4 ${y1+5}, 8 ${y1+7} L 10 ${y1+7} Z`} fill={ink} opacity="0.5"/>
        <path d={`M 90 ${y1} C 94 ${y1}, 96 ${y1+5}, 92 ${y1+7} L 90 ${y1+7} Z`} fill={ink} opacity="0.5"/>
        <text x="50" y={(y1+y2)/2+5} textAnchor="middle" fontSize="16" fontFamily={fontStack} fontWeight="900" fill={panel}>{sl}</text>
        <text x="50" y={(y1+y2)/2+18} textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} opacity="0.8" letterSpacing="3">NUTUNION</text>
      </>;
    } else {
      // Interlocked rings
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        <ellipse cx="36" cy="50" rx="26" ry="17" fill="none" stroke={a1} strokeWidth="11"/>
        <ellipse cx="64" cy="50" rx="26" ry="17" fill="none" stroke={a2} strokeWidth="11"/>
        <ellipse cx="64" cy="50" rx="26" ry="17" fill="none" stroke={a2} strokeWidth="11" strokeDasharray="15 38" strokeDashoffset="19"/>
        <text x="50" y="87" textAnchor="middle" fontSize="8" fontFamily={fontStack} fill={panel} letterSpacing="2">NUTUNION</text>
      </>;
    }
  }

  // ── STICKER ───────────────────────────────────────────────────────────
  if (family === "sticker") {
    if (sub === 0) {
      // Enamel pin circle
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <circle cx="50" cy="50" r="44" fill={a1} stroke={ink} strokeWidth="4"/>
        <circle cx="50" cy="50" r="36" fill={panel}/>
        <circle cx="50" cy="50" r="34" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="4,3"/>
        <text x="50" y="46" textAnchor="middle" fontSize="14" fontFamily={fontStack} fontWeight="900" fill={ink}>{sl}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="7.5" fontFamily={fontStack} fill={a1} letterSpacing="2">NUTUNION</text>
        <circle cx="50" cy="8" r="3" fill={ink}/><circle cx="50" cy="92" r="3" fill={ink}/>
      </>;
    } else if (sub === 1) {
      // Starburst
      const pts=ri(5,9), or=rx(40,46), ir=or*rx(0.42,0.62);
      const star=Array.from({length:pts*2},(_,i)=>{
        const ang=(i/(pts*2))*Math.PI*2-Math.PI/2;
        const r=i%2===0?or:ir;
        return `${50+Math.cos(ang)*r},${50+Math.sin(ang)*r}`;
      }).join(" ");
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <polygon points={star} fill={a1} stroke={ink} strokeWidth="2.5" strokeLinejoin="round"/>
        <circle cx="50" cy="50" r={ir*0.78} fill={panel}/>
        <text x="50" y="54" textAnchor="middle" fontSize="12" fontFamily={fontStack} fontWeight="900" fill={ink}>{N}</text>
      </>;
    } else if (sub === 2) {
      // Dog-eared folder
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <path d="M 12 10 H 72 L 90 28 V 88 Q 90 91 87 91 H 13 Q 10 91 10 88 V 13 Q 10 10 12 10 Z" fill={a1} stroke={ink} strokeWidth="2.5"/>
        <polygon points="72,10 90,28 72,28" fill={a2} stroke={ink} strokeWidth="2.5"/>
        <rect x="18" y="38" width="50" height="8" rx="2" fill={panel}/>
        <rect x="18" y="52" width="38" height="8" rx="2" fill={panel}/>
        <rect x="18" y="66" width="26" height="8" rx="2" fill={panel}/>
        <text x="18" y="30" fontSize="11" fontFamily={fontStack} fontWeight="900" fill={panel}>{N}</text>
      </>;
    } else {
      // Shield
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <path d="M 50 8 L 90 22 L 90 55 C 90 75, 72 88, 50 94 C 28 88, 10 75, 10 55 L 10 22 Z" fill={a1} stroke={ink} strokeWidth="2.5"/>
        <path d="M 50 18 L 80 29 L 80 55 C 80 70, 66 80, 50 86 C 34 80, 20 70, 20 55 L 20 29 Z" fill={ink}/>
        <text x="50" y="57" textAnchor="middle" fontSize="18" fontFamily={fontStack} fontWeight="900" fill={a1}>{N}</text>
        <text x="50" y="70" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="1.5">UNION</text>
      </>;
    }
  }

  // ── TOTEM ─────────────────────────────────────────────────────────────
  if (family === "totem") {
    if (sub === 0) {
      // Stacked shapes
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <polygon points="50,8 72,30 28,30" fill={a1}/>
        <circle cx="50" cy="46" r="16" fill={panel} stroke={ink} strokeWidth="2"/>
        <text x="50" y="50" textAnchor="middle" fontSize="11" fontFamily={fontStack} fontWeight="900" fill={ink}>{N}</text>
        <rect x="32" y="64" width="36" height="14" fill={a2}/>
        <rect x="24" y="80" width="52" height="14" fill={ink}/>
        <text x="50" y="90.5" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="1.5">NUT</text>
      </>;
    } else if (sub === 1) {
      // Abstract face/mask totem
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        {/* Top mask */}
        <ellipse cx="50" cy="20" rx="16" ry="13" fill={a1}/>
        <circle cx="44" cy="18" r="3" fill={ink}/><circle cx="56" cy="18" r="3" fill={ink}/>
        <rect x="44" y="22" width="12" height="3" rx="1.5" fill={ink}/>
        {/* Mid mask */}
        <rect x="33" y="36" width="34" height="26" rx="4" fill={a2}/>
        <circle cx="43" cy="46" r="4" fill={ink}/><circle cx="57" cy="46" r="4" fill={ink}/>
        <rect x="42" y="55" width="16" height="3" fill={panel}/>
        {/* Bottom shape */}
        <polygon points="50,70 68,94 32,94" fill={panel} opacity="0.9"/>
        <circle cx="50" cy="82" r="4" fill={ink}/>
      </>;
    } else if (sub === 2) {
      // Stacked weight bars
      const bars=[{w:18,c:a2},{w:34,c:a1},{w:50,c:panel},{w:64,c:ink},{w:78,c:a2}];
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        {bars.map((b,i)=><rect key={i} x={(100-b.w)/2} y={10+i*17} width={b.w} height="13" fill={b.c}/>)}
      </>;
    } else {
      // Flame peak
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        <path d="M 50 8 C 66 22, 78 30, 74 52 C 70 70, 58 74, 50 92 C 42 74, 30 70, 26 52 C 22 30, 34 22, 50 8 Z" fill={a1}/>
        <path d="M 50 22 C 62 34, 68 40, 65 56 C 62 68, 56 74, 50 84 C 44 74, 38 68, 35 56 C 32 40, 38 34, 50 22 Z" fill={a2}/>
        <circle cx="50" cy="52" r="10" fill={panel}/>
        <text x="50" y="56" textAnchor="middle" fontSize="8" fontFamily={fontStack} fontWeight="900" fill={ink}>{N}</text>
      </>;
    }
  }

  // ── POSTER ────────────────────────────────────────────────────────────
  if (family === "poster") {
    if (sub === 0) {
      // Bauhaus horizontal bands
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        <rect x="0" y="0" width="100" height="32" fill={ink}/>
        <text x="8" y="24" fontSize="20" fontFamily={fontStack} fontWeight="900" fill={a1} letterSpacing="-1">{sl}</text>
        <rect x="0" y="35" width="62" height="4" fill={a1}/>
        <rect x="0" y="43" width="42" height="4" fill={a2}/>
        <text x="8" y="64" fontSize="9.5" fontFamily={fontStack} fill={ink}>{variant.subtitle.toUpperCase()}</text>
        <text x="8" y="76" fontSize="8" fontFamily={fontStack} fill={soft}>{variant.energy}</text>
        <rect x="0" y="84" width="100" height="16" fill={a1}/>
        <text x="8" y="95" fontSize="6.5" fontFamily={fontStack} fill={panel} letterSpacing="2">NUTUNION</text>
      </>;
    } else if (sub === 1) {
      // Swiss diagonal
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={a2}/>
        <polygon points="0,0 100,0 100,58 0,88" fill={ink}/>
        <text x="50" y="42" textAnchor="middle" fontSize="30" fontFamily={fontStack} fontWeight="900" fill={a1} letterSpacing="-2">{N}U</text>
        <text x="50" y="82" textAnchor="middle" fontSize="9" fontFamily={fontStack} fill={panel} letterSpacing="3">NUTUNION</text>
        <line x1="12" y1="58" x2="88" y2="58" stroke={panel} strokeWidth="1" opacity="0.4"/>
      </>;
    } else if (sub === 2) {
      // Large letterform BG
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={a1}/>
        <text x="50" y="90" textAnchor="middle" fontSize="110" fontFamily={fontStack} fontWeight="900" fill={panel} opacity="0.1">{N}</text>
        <rect x="8" y="8" width="84" height="30" fill={ink} opacity="0.9"/>
        <text x="16" y="28" fontSize="16" fontFamily={fontStack} fontWeight="900" fill={a1}>{sl}</text>
        <rect x="8" y="70" width="84" height="22" fill={ink} opacity="0.9"/>
        <text x="16" y="84" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="2">NUTUNION · OPEN IDENTITY</text>
      </>;
    } else {
      // Editorial grid
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <rect x="8" y="8" width="84" height="52" fill={a1}/>
        <text x="50" y="42" textAnchor="middle" fontSize="26" fontFamily={fontStack} fontWeight="900" fill={panel} letterSpacing="-2">{sl}</text>
        <text x="50" y="54" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} opacity="0.7" letterSpacing="2">COMMUNITY</text>
        <line x1="8" y1="64" x2="92" y2="64" stroke={ink} strokeWidth="1.5"/>
        <text x="8" y="76" fontSize="8" fontFamily={fontStack} fill={ink}>{variant.subtitle}</text>
        <rect x="8" y="83" width="28" height="10" fill={a2}/>
        <text x="12" y="91" fontSize="6.5" fontFamily={fontStack} fill={panel}>OPEN</text>
      </>;
    }
  }

  // ── WAVE ─────────────────────────────────────────────────────────────
  if (family === "wave") {
    if (sub === 0) {
      // Multi sine waves
      const wc=[a1,a2,ink,soft];
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        {Array.from({length:3},(_,wi)=>{
          const by=25+wi*18, amp=rx(8,20), freq=rx(0.06,0.11);
          const pts=Array.from({length:30},(_,xi)=>{const x=xi*(100/29); return `${x},${by+Math.sin((x*freq+wi)*Math.PI*2)*amp}`;}).join(" ");
          return <polyline key={wi} points={pts} fill="none" stroke={wc[wi%wc.length]} strokeWidth={rx(2,5)} strokeLinecap="round" opacity="0.9"/>;
        })}
        <rect x="0" y="82" width="100" height="18" fill={ink}/>
        <text x="8" y="93" fontSize="8" fontFamily={fontStack} fill={panel} letterSpacing="2">NUTUNION</text>
      </>;
    } else if (sub === 1) {
      // Concentric ripples
      const nr=ri(4,7);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        {Array.from({length:nr},(_,i)=>{
          const r=8+i*(44/nr);
          return <ellipse key={i} cx="50" cy="50" rx={r} ry={r*rx(0.5,1)} fill="none" stroke={i%2===0?a1:a2} strokeWidth={rx(1.5,4)} opacity={0.6+i*0.06}/>;
        })}
        <circle cx="50" cy="50" r="8" fill={a1}/>
        <text x="50" y="54" textAnchor="middle" fontSize="6" fontFamily={fontStack} fill={ink} fontWeight="900">NU</text>
      </>;
    } else if (sub === 2) {
      // Zigzag mountains
      const np=ri(3,6), sw=100/np;
      const zpts=["0,90",...Array.from({length:np},(_,pi)=>
        [`${(pi+0.5)*sw},${rx(12,42)}`,`${(pi+1)*sw},90`]
      ).flat()].join(" ");
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <polygon points={zpts} fill={a1}/>
        <polygon points={["0,100",...Array.from({length:np},(_,pi)=>
          [`${(pi+0.5)*sw},${rx(22,52)}`,`${(pi+1)*sw},100`]
        ).flat()].join(" ")} fill={a2} opacity="0.55"/>
        <rect x="0" y="86" width="100" height="14" fill={ink}/>
        <text x="8" y="95" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="2">NUTUNION</text>
      </>;
    } else {
      // Spiral
      const sp=Array.from({length:80},(_,i)=>{
        const t=(i/79)*Math.PI*6, r=4+(i/79)*40;
        return `${50+Math.cos(t)*r},${50+Math.sin(t)*r}`;
      }).join(" ");
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        <polyline points={sp} fill="none" stroke={a1} strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
        <circle cx="50" cy="50" r="4.5" fill={a2}/>
        <text x="50" y="96" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="2">SPIRAL·NUT</text>
      </>;
    }
  }

  // ── RAILS ─────────────────────────────────────────────────────────────
  if (family === "rails") {
    if (sub === 0) {
      // Barcode bars
      const nb=ri(16,28);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        {Array.from({length:nb},(_,i)=>{
          const bw=rx(1.5,5), bx=8+(i/nb)*84, bh=rx(50,82);
          return <rect key={i} x={bx} y={8} width={bw} height={bh} fill={i%5===0?a1:i%3===0?a2:ink}/>;
        })}
        <rect x="0" y="86" width="100" height="14" fill={soft}/>
        <text x="50" y="96" textAnchor="middle" fontSize="6.5" fontFamily={fontStack} fill={ink} letterSpacing="4">NUTUNION</text>
      </>;
    } else if (sub === 1) {
      // Horizontal scan lines
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={ink}/>
        {Array.from({length:18},(_,i)=>{
          const lh=rx(1,5), lw=rx(28,90), lx=rx(0,100-lw);
          return <rect key={i} x={lx} y={6+i*5.2} width={lw} height={lh} fill={i%3===0?a1:i%5===0?a2:panel} opacity={0.5+i*0.025} rx="0.5"/>;
        })}
        <text x="50" y="97" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={panel} letterSpacing="3">DATA RAIL</text>
      </>;
    } else if (sub === 2) {
      // Halftone grid
      const co=ri(6,10), ro=ri(6,10);
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        {Array.from({length:ro},(_,row)=>
          Array.from({length:co},(_,col)=>{
            const cx=10+col*(80/(co-1)), cy=10+row*(80/(ro-1));
            const r=(1.5+(Math.sin(col*0.8+row*0.6)+1)*3);
            return <circle key={`${row}-${col}`} cx={cx} cy={cy} r={r} fill={(row+col)%3===0?a1:(row+col)%3===1?a2:ink} opacity="0.85"/>;
          })
        )}
        <rect x="30" y="38" width="40" height="24" fill={panel} opacity="0.9"/>
        <text x="50" y="53" textAnchor="middle" fontSize="11" fontFamily={fontStack} fontWeight="900" fill={ink}>{sl}</text>
      </>;
    } else {
      // QR-corner aesthetic
      const qrCorner=(x:number,y:number,s:number)=><>
        <rect x={x} y={y} width={s} height={s} fill={ink}/>
        <rect x={x+3} y={y+3} width={s-6} height={s-6} fill={panel}/>
        <rect x={x+6} y={y+6} width={s-12} height={s-12} fill={ink}/>
      </>;
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={panel}/>
        {qrCorner(8,8,22)}{qrCorner(70,8,22)}{qrCorner(8,70,22)}
        {Array.from({length:4},(_,row)=>Array.from({length:4},(_,col)=>
          rng()>0.4?<rect key={`${row}-${col}`} x={36+col*7} y={36+row*7} width="5" height="5" fill={rng()>0.55?a1:ink}/>:null
        ))}
        <text x="72" y="88" textAnchor="middle" fontSize="6.5" fontFamily={fontStack} fill={ink} letterSpacing="0.5">NU</text>
      </>;
    }
  }

  // ── MOSAIC ────────────────────────────────────────────────────────────
  if (family === "mosaic") {
    if (sub === 0) {
      // 5×5 tile grid
      const cols=[ink,a1,a2,soft,panel];
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        {Array.from({length:5},(_,row)=>
          Array.from({length:5},(_,col)=>{
            const tc=cols[Math.floor(rng()*cols.length)], g=2, tw=(100-g*6)/5;
            return <rect key={`${row}-${col}`} x={g+col*(tw+g)} y={g+row*(tw+g)} width={tw} height={tw} rx={rng()>0.5?4:0} fill={tc}/>;
          })
        )}
      </>;
    } else if (sub === 1) {
      // Large + small irregular tiles
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={soft}/>
        <rect x="8" y="8" width="44" height="44" fill={a1}/>
        <rect x="56" y="8" width="36" height="20" fill={ink}/>
        <rect x="56" y="32" width="36" height="20" fill={a2}/>
        <rect x="8" y="56" width="20" height="36" fill={a2}/>
        <rect x="32" y="56" width="20" height="36" fill={panel} stroke={ink} strokeWidth="1.5"/>
        <rect x="56" y="56" width="36" height="36" fill={ink}/>
        <text x="30" y="35" textAnchor="middle" fontSize="18" fontFamily={fontStack} fontWeight="900" fill={panel}>{N}</text>
        <text x="74" y="82" textAnchor="middle" fontSize="9" fontFamily={fontStack} fill={a1} letterSpacing="1">NU</text>
      </>;
    } else if (sub === 2) {
      // Triangular tessellation
      const tc2=[a1,a2,ink,soft,panel], nc=ri(4,7), tw=100/nc, th=tw*0.87, nr=Math.ceil(100/th)+1;
      const tris:React.ReactNode[]=[];
      for(let r=0;r<nr;r++){for(let c=0;c<nc*2;c++){
        const up=c%2===0, bx=(c/2)*tw, by=r*th;
        const pts3=up?`${bx},${by+th} ${bx+tw/2},${by} ${bx+tw},${by+th}`:`${bx-tw/2},${by} ${bx+tw/2},${by} ${bx},${by+th}`;
        tris.push(<polygon key={`${r}-${c}`} points={pts3} fill={tc2[Math.floor(rng()*tc2.length)]} stroke={bg} strokeWidth="0.8"/>);
      }}
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        <clipPath id={`m${seed}`}><rect x="0" y="0" width="100" height="100"/></clipPath>
        <g clipPath={`url(#m${seed})`}>{tris}</g>
      </>;
    } else {
      // Concentric square frames
      const fc=[a1,ink,a2,soft,panel,a1,ink];
      inner = <>
        <rect x="0" y="0" width="100" height="100" fill={bg}/>
        {fc.map((c,i)=>{const m=i*8+4; return <rect key={i} x={m} y={m} width={100-m*2} height={100-m*2} fill="none" stroke={c} strokeWidth="5"/>;} )}
        <rect x="36" y="36" width="28" height="28" fill={a1}/>
        <text x="50" y="54" textAnchor="middle" fontSize="11" fontFamily={fontStack} fontWeight="900" fill={panel}>{N}</text>
      </>;
    }
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      {inner}
    </svg>
  );
}

export function BrandPageClient() {
  const [dayOffset, setDayOffset] = useState(0);
  const [activeVariantId, setActiveVariantId] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

  const activeDate = useMemo(() => {
    const next = new Date();
    next.setHours(0,0,0,0);
    next.setDate(next.getDate() + dayOffset);
    return next;
  }, [dayOffset]);

  const variants = useMemo(() => generateDailyVariants(activeDate), [activeDate]);
  const activeVariant = variants.find(v => v.id === activeVariantId) || variants[0];

  function copyVariantCode(variant: LogoVariant) {
    const code = `${variant.dateCode}-${variant.family}-${variant.seed}`;
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success("로고 코드가 복사되었습니다");
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2ede2_0%,#efe6d5_50%,#f9f5ec_100%)]">
      <header className="sticky top-0 z-40 border-b-[3px] border-nu-ink bg-nu-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-1.5 font-mono-nu text-[13px] uppercase tracking-widest text-nu-muted no-underline transition-colors hover:text-nu-ink">
            <ArrowLeft size={14} /> 홈으로
          </Link>
          <span className="text-nu-ink/20">|</span>
          <span className="font-head text-lg font-extrabold text-nu-ink">Open Logo Lab</span>
          <span className="ml-auto bg-nu-ink px-2 py-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-paper">100 open forms / day</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-14">
        {/* Hero */}
        <section className="mb-10 border-[3px] border-nu-ink bg-[linear-gradient(135deg,#fff9ef_0%,#ffe8c9_30%,#f4f1ea_100%)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b-[2px] border-nu-ink p-8 lg:border-b-0 lg:border-r-[2px] lg:p-10">
              <p className="mb-4 font-mono-nu text-[12px] uppercase tracking-[0.24em] text-nu-muted">Not a logo set. A behavior set.</p>
              <h1 className="mb-5 font-head text-5xl font-extrabold leading-[0.9] tracking-[-0.05em] text-nu-ink md:text-7xl">
                너트 형태를<br/>버리고도<br/><span className="text-nu-blue">브랜드는 살아있을 수 있다</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-nu-gray md:text-lg">
                워드마크, 스탬프, 포스터, 신호, 리본, 토템… 100개가 같은 실루엣의 색 변주가 아니라 <strong>로고 문법 자체가 다른 40가지 구조 위에서</strong> 팔레트와 배치가 더해져 매일 새로운 조합이 됩니다.
              </p>
            </div>
            <div className="p-8 lg:p-10">
              <div className="mb-6 flex items-center justify-between gap-3">
                <button onClick={() => setDayOffset(p=>p-1)} className="inline-flex items-center gap-1 border-[2px] border-nu-ink px-3 py-2 font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink transition-colors hover:bg-nu-ink hover:text-nu-paper">
                  <ChevronLeft size={14}/> 이전
                </button>
                <div className="text-center">
                  <p className="font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">active day</p>
                  <p className="font-head text-xl font-extrabold text-nu-ink">{formatDateLabel(activeDate)}</p>
                </div>
                <button onClick={() => setDayOffset(p=>p+1)} className="inline-flex items-center gap-1 border-[2px] border-nu-ink px-3 py-2 font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink transition-colors hover:bg-nu-ink hover:text-nu-paper">
                  다음 <ChevronRight size={14}/>
                </button>
              </div>
              <div className="border-[2px] border-nu-ink bg-white p-4">
                <div className="flex min-h-[320px] items-center justify-center border-[2px] border-dashed border-nu-ink/15" style={{background:activeVariant.palette.bg}}>
                  <OpenLogoArtwork variant={activeVariant} size={280}/>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">Today&apos;s Lead Form · <span className="text-nu-pink">{activeVariant.family}</span></p>
                    <h2 className="text-2xl font-extrabold text-nu-ink" style={{fontFamily:activeVariant.fontStack}}>{activeVariant.label}</h2>
                    <p className="text-sm text-nu-gray">{activeVariant.subtitle} · {activeVariant.energy}</p>
                  </div>
                  <button onClick={()=>copyVariantCode(activeVariant)} className="inline-flex items-center gap-2 border-[2px] border-nu-pink bg-nu-pink px-4 py-2 font-mono-nu text-[12px] uppercase tracking-widest text-nu-paper transition-colors hover:border-nu-ink hover:bg-nu-ink">
                    {copied?<Check size={12}/>:<Copy size={12}/>} 코드 복사
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rules */}
        <section className="mb-10 grid gap-0 border-[3px] border-nu-ink md:grid-cols-3">
          {[
            {rule:"01",title:"형태를 고정하지 않는다",body:"로고 목적에 맞춘 정형화된 틀 대신, 브랜드가 가진 태도와 활동 밀도를 바탕으로 형식이 먼저 바뀝니다."},
            {rule:"02",title:"서로 다른 로고 문법",body:"모놀리스·신호·스탬프·리본·스티커·토템·포스터·파동·레일·모자이크 — 10개 패밀리 × 4개 레이아웃 = 40개 구조 문법."},
            {rule:"03",title:"사람의 활동이 먼저 보인다",body:"로고가 '너트처럼 생겼는가'보다 '오늘 어떤 방식으로 움직이는 집단인가'가 먼저 읽히도록 구성했습니다."},
          ].map((r,i)=>(
            <div key={r.rule} className={`p-6 ${i<2?"border-b-[2px] border-nu-ink md:border-b-0 md:border-r-[2px]":""}`}>
              <p className="mb-2 font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">rule {r.rule}</p>
              <h3 className="mb-2 font-head text-2xl font-extrabold text-nu-ink">{r.title}</h3>
              <p className="text-sm leading-relaxed text-nu-gray">{r.body}</p>
            </div>
          ))}
        </section>

        {/* Grid of 100 */}
        <section className="mb-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono-nu text-[12px] uppercase tracking-[0.2em] text-nu-muted">Today&apos;s 100</p>
              <h2 className="font-head text-4xl font-extrabold text-nu-ink">열린 형식의 로고 아카이브</h2>
            </div>
            <p className="max-w-md text-right text-sm text-nu-gray hidden sm:block">
              100개 모두가 같은 실루엣에서 파생되지 않습니다. 날짜를 바꾸면 구조, 팔레트, 레이아웃 조합이 전부 달라집니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-0 border-[3px] border-nu-ink sm:grid-cols-4 lg:grid-cols-5">
            {variants.map((variant, index) => {
              const isActive = activeVariant.id === variant.id;
              const bRow = Math.floor(index/5);
              const totalRows = Math.ceil(DAILY_VARIANT_COUNT/5);
              return (
                <button
                  key={variant.id}
                  onClick={() => setActiveVariantId(variant.id)}
                  className={`group border-nu-ink p-3 text-left transition-all
                    ${bRow < totalRows-1 ? "border-b-[2px]" : ""}
                    ${index%5!==4 ? "border-r-[2px]" : ""}
                    ${isActive ? "bg-nu-ink text-nu-paper" : "bg-nu-white hover:bg-nu-cream/50"}`}
                >
                  <div className={`mb-2.5 flex aspect-square items-center justify-center border-[2px] ${isActive?"border-nu-paper/20":"border-nu-ink/10"}`}
                    style={{background:variant.palette.bg}}>
                    <OpenLogoArtwork variant={variant} size={86}/>
                  </div>
                  <p className={`mb-0.5 font-mono-nu text-[10px] uppercase tracking-[0.15em] ${isActive?"text-nu-paper/55":"text-nu-muted"}`}>
                    {variant.family}
                  </p>
                  <p className="text-base font-extrabold leading-none" style={{fontFamily:variant.fontStack}}>{variant.id}</p>
                  <p className={`mt-1.5 text-[11px] leading-snug ${isActive?"text-nu-paper/70":"text-nu-gray"}`}>{variant.subtitle}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Detail panel */}
        <section className="mb-10 grid gap-0 border-[3px] border-nu-ink lg:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b-[2px] border-nu-ink bg-nu-ink p-6 text-nu-paper lg:border-b-0 lg:border-r-[2px]">
            <p className="mb-2 font-mono-nu text-[12px] uppercase tracking-[0.18em] text-nu-paper/55">Selected Variant</p>
            <h2 className="mb-2 text-4xl font-extrabold" style={{fontFamily:activeVariant.fontStack}}>{activeVariant.label}</h2>
            <p className="mb-6 text-sm leading-relaxed text-nu-paper/75">{activeVariant.energy} · {activeVariant.subtitle}</p>
            <div className="space-y-3">
              <div><p className="font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-paper/45">family</p><p className="text-sm">{activeVariant.family}</p></div>
              <div><p className="font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-paper/45">system code</p><p className="text-sm">{activeVariant.dateCode}-{activeVariant.seed}</p></div>
            </div>
          </div>
          <div className="bg-nu-white p-6">
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              {[activeVariant.palette.ink, activeVariant.palette.accent, activeVariant.palette.accentTwo].map(color=>(
                <button key={color} onClick={()=>{navigator.clipboard.writeText(color); toast.success(`${color} 복사됨`);}}
                  className="border-[2px] border-nu-ink p-3 text-left transition-transform hover:-translate-y-0.5">
                  <div className="mb-3 h-16 border border-nu-ink/10" style={{background:color}}/>
                  <p className="font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">tone</p>
                  <p className="font-mono-nu text-[13px] text-nu-ink">{color}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border-[2px] border-nu-ink p-4">
                <p className="mb-2 font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">why it feels different</p>
                <p className="text-sm leading-relaxed text-nu-gray">이 시스템은 단일 아이콘을 변형하는 방식이 아니라, 40가지 서로 다른 레이아웃 문법 위에 20가지 팔레트가 조합되어 같은 엔진의 다른 색이 아닌 구조 자체가 달라집니다.</p>
              </div>
              <div className="border-[2px] border-nu-ink p-4">
                <p className="mb-2 font-mono-nu text-[11px] uppercase tracking-[0.18em] text-nu-muted">best use</p>
                <ul className="space-y-2 text-sm text-nu-gray">
                  <li>캠페인별 대표 심볼</li>
                  <li>홈/브랜드 페이지의 일일 메인 비주얼</li>
                  <li>SNS 카드, 모집 포스터, 참가자 배지</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-[3px] border-nu-ink bg-[linear-gradient(135deg,#0d0d0d_0%,#1a1a1a_100%)] p-8 text-nu-paper md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 font-mono-nu text-[12px] uppercase tracking-[0.22em] text-nu-paper/50">Brand Principle</p>
              <h2 className="font-head text-3xl font-extrabold md:text-4xl">로고는 한 가지 답이 아니라<br/>다양한 활동을 담는 운영체제여야 한다</h2>
            </div>
            <Link href="/#identity-generator" className="inline-flex items-center justify-center bg-nu-pink px-8 py-4 font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-paper no-underline transition-colors hover:bg-nu-blue">
              Generator 열기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
