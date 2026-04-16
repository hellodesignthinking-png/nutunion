"use client";

import React, { useMemo, useState, type ReactNode } from "react";
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

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash >>> 0;
}

function generateDynamicPalette(rng: () => number): PaletteSet {
  const h = Math.floor(rng() * 360);
  const s = 40 + Math.floor(rng() * 50);
  const l = 85 + Math.floor(rng() * 10);
  const bg = `hsl(${h}, ${s}%, ${l}%)`;
  const panel = `hsl(${h}, ${s}%, 98%)`;
  const inkL = Math.floor(rng() * 10) + 4;
  const ink = `hsl(${(h + 180 + Math.floor(rng()*60)-30) % 360}, ${20 + Math.floor(rng()*20)}%, ${inkL}%)`;
  const a1_h = (h + 90 + Math.floor(rng()*180)) % 360;
  const accent = `hsl(${a1_h}, ${75 + Math.floor(rng()*25)}%, ${45 + Math.floor(rng()*15)}%)`;
  const a2_h = (a1_h + 90 + Math.floor(rng()*180)) % 360;
  const accentTwo = `hsl(${a2_h}, ${75 + Math.floor(rng()*25)}%, ${45 + Math.floor(rng()*15)}%)`;
  const soft = `hsl(${h}, ${Math.max(0, s - 30)}%, ${75 + Math.floor(rng()*15)}%)`;
  return { bg, panel, ink, accent, accentTwo, soft };
}

function generateDailyVariants(date: Date): LogoVariant[] {
  const dateCode = getDateCode(date);
  const baseSeed = Number(dateCode);
  return Array.from({ length: DAILY_VARIANT_COUNT }, (_, index) => {
    const contentSeed = baseSeed + index * 997;
    const contentRng = createSeededRandom(contentSeed);
    const left = pick(LABEL_PARTS, contentRng);
    const right = pick(LABEL_PARTS, contentRng);
    const label = left === right ? `${left} UNION` : `${left} ${right}`;
    const subtitle = pick(SUB_PARTS, contentRng);
    const energy = pick(ENERGY_WORDS, contentRng);
    const contentStr = `${label}|${subtitle}|${energy}|${index}`;
    const hash = hashString(contentStr);
    const visualRng = createSeededRandom(hash);
    const palette = generateDynamicPalette(visualRng);
    const fontStack = pick(FONT_STACKS, visualRng);
    const family = FAMILIES[Math.floor(visualRng() * FAMILIES.length)];
    return {
      id: index + 1, seed: hash, family,
      label, subtitle, energy, palette, fontStack, dateCode
    } satisfies LogoVariant;
  });
}

function OpenLogoArtwork({ variant, size }: { variant: LogoVariant; size: number }) {
  const { palette, label, seed, fontStack, subtitle, energy } = variant;
  const rng = createSeededRandom(seed + 1337);
  const rx = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const ri = (lo: number, hi: number) => Math.floor(rx(lo, hi + 1));

  const { bg, panel, ink, accent: a1, accentTwo: a2, soft } = palette;
  const sl = label.split(" ")[0] || "NU";
  const N = sl[0] || "N";

  let bgLayer: React.ReactNode = null;
  let fgLayer: React.ReactNode = null;
  let txtLayer: React.ReactNode = null;

  // 1. DYNAMIC BACKGROUND (12 variants)
  const bgType = ri(0, 11);
  if (bgType === 0) bgLayer = <rect x="0" y="0" width="100" height="100" fill={bg} />;
  else if (bgType === 1) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><polygon points={`0,0 100,0 ${rx(50, 100)},100 0,${rx(50, 100)}`} fill={soft}/></>;
  else if (bgType === 2) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/>{Array.from({length: ri(5, 12)}, (_,i)=><rect key={i} x="0" y={i*(100/ri(5,12))} width="100" height={rx(1, 8)} fill={soft} opacity="0.7"/>)}</>;
  else if (bgType === 3) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/>{Array.from({length: ri(4, 9)}, (_,i)=><circle key={i} cx="50" cy="50" r={10+i*rx(8,15)} fill="none" stroke={soft} strokeWidth={rx(1, 4)} opacity="0.8"/>)}</>;
  else if (bgType === 4) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><circle cx="50" cy="50" r={rx(35, 48)} fill={panel}/></>;
  else if (bgType === 5) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/>{Array.from({length: 6}, (_,i)=><line key={i} x1={10+i*16} y1="0" x2={10+i*16} y2="100" stroke={soft} strokeWidth={rx(4, 12)} />)}</>;
  else if (bgType === 6) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/>{Array.from({length: 5}, (_,i)=><path key={i} d={`M0 ${20+i*15} Q ${rx(30, 70)} ${rx(-20, 120)} 100 ${20+i*15}`} fill="none" stroke={soft} strokeWidth={rx(2, 6)}/>)}</>;
  else if (bgType === 7) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><rect x={rx(5,15)} y={rx(5,15)} width={rx(70,90)} height={rx(70,90)} fill={panel} stroke={soft} strokeWidth="3" strokeDasharray={`${rx(2,10)} ${rx(2,10)}`}/></>;
  else if (bgType === 8) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><polygon points="0,50 50,0 100,50 50,100" fill={soft} opacity="0.6"/></>;
  else if (bgType === 9) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/>{Array.from({length: ri(20,50)}, (_,i)=><circle key={i} cx={rx(0,100)} cy={rx(0,100)} r={rx(0.5, 2.5)} fill={ink} opacity="0.2"/>)}</>;
  else if (bgType === 10) bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><circle cx={rx(20,80)} cy={rx(20,80)} r={rx(30,80)} fill={a1} opacity="0.15"/><circle cx={rx(20,80)} cy={rx(20,80)} r={rx(30,80)} fill={a2} opacity="0.15"/></>;
  else bgLayer = <><rect x="0" y="0" width="100" height="100" fill={bg}/><path d={`M 0 0 L ${rx(40,60)} 100 L 100 0 Z`} fill={soft} opacity="0.7"/></>;

  // 2. DYNAMIC FOREGROUND GRAPHIC (12 variants)
  const fgType = ri(0, 11);
  if (fgType === 0) fgLayer = <circle cx="50" cy="50" r={rx(20, 38)} fill={a1} opacity="0.95"/>;
  else if (fgType === 1) fgLayer = <rect x={rx(20,35)} y={rx(20,35)} width={rx(30,50)} height={rx(30,50)} fill={a2} transform={`rotate(${rx(0,90)} 50 50)`} opacity="0.95"/>;
  else if (fgType === 2) fgLayer = <><circle cx={rx(35,45)} cy="50" r={rx(15,28)} fill={a1}/><circle cx={rx(55,65)} cy="50" r={rx(15,28)} fill={a2} opacity="0.85"/></>;
  else if (fgType === 3) fgLayer = <polygon points={`50,${rx(5,25)} ${rx(75,95)},${rx(75,95)} ${rx(5,25)},${rx(75,95)}`} fill={a1} opacity="0.95"/>;
  else if (fgType === 4) fgLayer = <><rect x={rx(20,35)} y={rx(15,25)} width={rx(8,16)} height={rx(50,70)} fill={a1}/><rect x={rx(55,70)} y={rx(15,25)} width={rx(8,16)} height={rx(50,70)} fill={a2}/><rect x="30" y={rx(40,60)} width="40" height={rx(8,16)} fill={ink}/></>;
  else if (fgType === 5) fgLayer = <>{Array.from({length: ri(4, 9)}, (_,i)=><circle key={i} cx={rx(20,80)} cy={rx(20,80)} r={rx(4,18)} fill={i%2===0?a1: (i%3===0?ink:a2)} opacity="0.9"/>)}</>;
  else if (fgType === 6) fgLayer = <path d={`M ${rx(10,30)} ${rx(30,70)} Q 50 ${rx(-10,30)} ${rx(70,90)} ${rx(30,70)} Q 50 ${rx(70,110)} ${rx(10,30)} ${rx(30,70)}Z`} fill={rng()>0.5?a1:a2} opacity="0.95"/>;
  else if (fgType === 7) fgLayer = <text x="50" y={rx(65,85)} textAnchor="middle" fontSize={rx(45,80)} fontWeight="900" fontFamily={fontStack} fill={a1} opacity="0.25">{N}</text>;
  else if (fgType === 8) fgLayer = <><ellipse cx="50" cy="50" rx={rx(25,45)} ry={rx(8,25)} fill={a2} transform={`rotate(${rx(0,180)} 50 50)`}/><circle cx="50" cy="50" r={rx(6,15)} fill={ink}/></>;
  else if (fgType === 9) fgLayer = <><rect x="0" y={rx(30,50)} width="100" height={rx(10,25)} fill={ink} opacity="0.9"/><rect x={rx(20,60)} y="0" width={rx(10,25)} height="100" fill={a1} opacity="0.9"/></>;
  else if (fgType === 10) fgLayer = <polygon points={`0,0 ${rx(30,70)},0 ${rx(70,100)},100 0,100`} fill={rng()>0.5?a1:ink} opacity={rx(0.4, 0.8)}/>;
  else fgLayer = <polyline points={`15,${rx(20,80)} 35,${rx(20,80)} 65,${rx(20,80)} 85,${rx(20,80)}`} fill="none" stroke={a2} strokeWidth={rx(4, 12)} strokeLinejoin="round"/>;

  // 3. DYNAMIC TYPOGRAPHY (12 variants)
  const tyType = ri(0, 11);
  if (tyType === 0) txtLayer = <><text x="50" y="47" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily={fontStack} fill={ink}>{sl}</text><rect x="35" y="55" width="30" height="2" fill={a1}/><text x="50" y="65" textAnchor="middle" fontSize="6.5" fontFamily={fontStack} fill={ink} letterSpacing="2">UNION</text></>;
  else if (tyType === 1) txtLayer = <><text x="8" y="24" fontSize="18" fontWeight="900" fontFamily={fontStack} fill={ink}>{sl}</text><text x="8" y="36" fontSize="6" fontFamily={fontStack} fill={ink} opacity="0.8">{energy}</text></>;
  else if (tyType === 2) txtLayer = <><rect x="0" y="76" width="100" height="24" fill={ink}/><text x="50" y="91" textAnchor="middle" fontSize="10" fontWeight="900" fontFamily={fontStack} fill={panel}>{sl} UNION</text></>;
  else if (tyType === 3) txtLayer = <><text x="90" y="50" textAnchor="middle" fontSize="14" fontWeight="900" fontFamily={fontStack} fill={ink} transform="rotate(-90 90 50)">{sl}</text><text x="10" y="90" fontSize="7" fontFamily={fontStack} fill={ink}>{subtitle}</text></>;
  else if (tyType === 4) txtLayer = <><text x="8" y="16" fontSize="10" fontWeight="900" fontFamily={fontStack} fill={ink}>{sl}</text><text x="92" y="92" textAnchor="end" fontSize="10" fontWeight="900" fontFamily={fontStack} fill={ink}>UNION</text></>;
  else if (tyType === 5) txtLayer = <><rect x="12" y="38" width="76" height="24" fill={panel} stroke={ink} strokeWidth="2.5"/><text x="50" y="54" textAnchor="middle" fontSize="12" fontWeight="900" fontFamily={fontStack} fill={ink}>{sl}</text></>;
  else if (tyType === 6) txtLayer = <><text x="50" y="18" textAnchor="middle" fontSize="10" fontWeight="900" fontFamily={fontStack} fill={ink} letterSpacing="4">{sl}</text><text x="50" y="92" textAnchor="middle" fontSize="6" fontFamily={fontStack} fill={ink} letterSpacing="1">{energy}</text></>;
  else if (tyType === 7) txtLayer = <><text x="50" y="56" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily={fontStack} fill={ink}>{N}</text><text x="50" y="70" textAnchor="middle" fontSize="6" fontFamily={fontStack} fill={ink} opacity="0.9" letterSpacing="1.5">{label}</text></>;
  else if (tyType === 8) txtLayer = <><circle cx="50" cy="50" r="32" fill="none" stroke={ink} strokeWidth="2.5" strokeDasharray="5 5"/><text x="50" y="48" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily={fontStack} fill={ink}>{sl}</text><text x="50" y="60" textAnchor="middle" fontSize="7" fontFamily={fontStack} fill={a1}>UNION</text></>;
  else if (tyType === 9) txtLayer = <><rect x="0" y="80" width="100" height="20" fill={a1}/><text x="50" y="93" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily={fontStack} fill={panel}>{label}</text><text x="8" y="14" fontSize="6" fontFamily={fontStack} fill={ink}>{energy}</text></>;
  else if (tyType === 10) txtLayer = <><text x="10" y="55" fontSize="20" fontWeight="900" fontFamily={fontStack} fill={panel} stroke={ink} strokeWidth="1.5">{sl}</text><rect x="10" y="62" width="40" height="4" fill={a2}/></>;
  else txtLayer = <><rect x="6" y="84" width="24" height="10" fill={a1}/><text x="34" y="92" fontSize="7.5" fontWeight="900" fontFamily={fontStack} fill={ink}>{label}</text></>;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      {bgLayer}
      {fgLayer}
      {txtLayer}
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
            {rule:"02",title:"서로 다른 로고 문법",body:"배경, 코어 형태, 텍스트 배치가 콘텐츠 해시 데이터에 반응하여 1,700가지 이상의 개별적인 구조 문법으로 절차적 렌더링을 수행합니다."},
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
                <p className="text-sm leading-relaxed text-nu-gray">이 시스템은 단일 아이콘을 변형하는 방식이 아니라, 콘텐츠 해시 데이터를 바탕으로 무한대에 가까운 컬러 팔레트와 수천 가지 레이아웃 구조가 절차적으로 조합되어 완전히 독립적인 구조를 렌더링합니다.</p>
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
