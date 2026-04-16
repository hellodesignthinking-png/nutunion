"use client";

import {
  useEffect, useState, useCallback, useRef,
} from "react";
import Link from "next/link";
import {
  Download, RefreshCw, Zap, Database, Shuffle, Calendar,
  ArrowRight, Layers, ChevronRight,
} from "lucide-react";
import { LiquidNutSvg } from "@/components/brand/liquid-nut-svg";
import { useGenreTheme } from "@/components/brand/genre-theme-context";
import {
  LogoGenre, GENRES, ALL_GENRES,
  ArchiveEntry, getTodayKey, buildInsight,
} from "@/lib/brand/genre-engine";
import { toast } from "sonner";
import { OpenLogoArtwork, LogoVariant } from "@/components/brand/brand-page-client";

const CAT_KO: Record<string, string> = {
  space: "공간·건축", culture: "예술·문화", platform: "플랫폼·개발", vibe: "바이브·지역",
};

interface VibeApiResponse {
  genre: LogoGenre;
  isHybrid: boolean;
  hybridGenres?: [LogoGenre, LogoGenre];
  dominantCat: string;
  subCat?: string;
  activityLevel: number;
  breakdown: Record<string, number>;
  insight: string;
  dateSeed: number;
  totalProjects: number;
  totalGroups: number;
  calculatedAt: string;
  fallback?: boolean;
}

const ARCHIVE_KEY = "nu_identity_archive";

function loadArchive(): ArchiveEntry[] {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]"); } catch { return []; }
}

function saveToArchive(genre: LogoGenre, insight: string, activityLevel: number) {
  const today = getTodayKey();
  const archive: ArchiveEntry[] = loadArchive();
  const exists = archive.find(e => e.date === today);
  if (!exists) {
    archive.unshift({ date: today, genre, insight, activityLevel });
    if (archive.length > 30) archive.pop();
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  }
}

// ── Canvas helpers ──────────────────────────────────────────────────────────
async function svgToCanvas(svgEl: SVGElement, w: number, h: number, bg: string): Promise<HTMLCanvasElement> {
  const data = new XMLSerializer().serializeToString(svgEl);
  const url  = URL.createObjectURL(new Blob([data], { type: "image/svg+xml" }));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas  = Object.assign(document.createElement("canvas"), { width: w, height: h });
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.src = url;
  });
}

function canvasToDownload(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob(blob => {
    if (!blob) return;
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: filename,
    }).click();
  }, "image/png");
}

function buildVariantForGenre(genre: LogoGenre, dateSeed: number = 0, dateCode: string = "2026"): LogoVariant {
  const cfg = GENRES[genre];
  let seedNum = dateSeed;
  for(let i=0; i<genre.length; i++) seedNum += genre.charCodeAt(i);
  return {
    id: seedNum,
    seed: seedNum,
    family: "monolith",
    label: cfg.label,
    subtitle: cfg.vibe,
    energy: cfg.labelKo,
    dateCode,
    fontStack: `'${cfg.font}', sans-serif`,
    palette: {
      bg: cfg.colors.bg,
      panel: cfg.colors.surface,
      ink: cfg.colors.text,
      accent: cfg.colors.primary,
      accentTwo: cfg.colors.secondary,
      soft: cfg.colors.shell,
    }
  };
}

// ── Main Component ──────────────────────────────────────────────────────────
export function LiquidIdentitySection() {
  const { activeGenre, cfg, setGenre } = useGenreTheme();
  const [vibe, setVibe]               = useState<VibeApiResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [transitioning, setTransit]   = useState(false);
  const [manualMode, setManual]       = useState(false);
  const [downloading, setDl]          = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive]         = useState<ArchiveEntry[]>([]);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Load live vibe
  const loadVibe = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/todays-vibe", { cache: "no-store" });
      const data: VibeApiResponse = await res.json();
      setVibe(data);
      if (!manualMode) {
        triggerTransition(data.genre);
        saveToArchive(data.genre, data.insight, data.activityLevel);
      }
    } catch { setVibe(null); }
    finally { setLoading(false); }
  }, [manualMode]);

  useEffect(() => { loadVibe(); }, [loadVibe]);

  useEffect(() => {
    setArchive(loadArchive());
    // Load fonts
    const fontsToLoad = ALL_GENRES.map(g => GENRES[g].fontUrl);
    fontsToLoad.forEach(url => {
      if (!document.querySelector(`link[href="${url}"]`)) {
        document.head.appendChild(
          Object.assign(document.createElement("link"), { rel: "stylesheet", href: url })
        );
      }
    });
  }, []);

  function triggerTransition(genre: LogoGenre) {
    setTransit(true);
    setTimeout(() => { setGenre(genre); setTransit(false); }, 280);
  }

  function handleSelect(genre: LogoGenre) {
    setManual(true);
    triggerTransition(genre);
  }

  function handleAutomatic() {
    setManual(false);
    if (vibe) triggerTransition(vibe.genre);
  }

  // ── SVG download
  function dlSvg() {
    const el = svgContainerRef.current?.querySelector("svg");
    if (!el) return;
    const blob = new Blob([el.outerHTML], { type: "image/svg+xml" });
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `nutunion-${activeGenre}-${getTodayKey()}.svg`,
    }).click();
    toast.success("SVG 다운로드!");
  }

  // ── PNG 1200×1200
  async function dlPng() {
    setDl("png");
    const el = svgContainerRef.current?.querySelector("svg");
    if (!el) { setDl(null); return; }
    const canvas = await svgToCanvas(el as SVGElement, 1200, 1200, cfg.colors.bg);
    canvasToDownload(canvas, `nutunion-${activeGenre}-1200px.png`);
    toast.success("PNG 1200px 다운로드!");
    setDl(null);
  }

  // ── Wallpaper (mobile 1080×1920, desktop 2560×1440 in one click)
  async function dlWallpaper() {
    setDl("wallpaper");
    const el = svgContainerRef.current?.querySelector("svg");
    if (!el) { setDl(null); return; }

    // Mobile
    const mobile = Object.assign(document.createElement("canvas"), { width: 1080, height: 1920 });
    const mctx = mobile.getContext("2d")!;
    mctx.fillStyle = cfg.colors.bg;
    mctx.fillRect(0, 0, 1080, 1920);
    // Gradient overlay
    const grad = mctx.createRadialGradient(540, 700, 0, 540, 700, 900);
    grad.addColorStop(0, cfg.colors.primary + "55");
    grad.addColorStop(1, cfg.colors.bg);
    mctx.fillStyle = grad;
    mctx.fillRect(0, 0, 1080, 1920);
    // Logo centered
    const logoCanvas = await svgToCanvas(el as SVGElement, 700, 700, "transparent");
    mctx.drawImage(logoCanvas, 190, 580, 700, 700);
    // Text
    mctx.fillStyle = cfg.colors.text;
    mctx.font = `bold 80px '${cfg.font}', monospace`;
    mctx.textAlign = "center";
    mctx.fillText("NUT UNION", 540, 1420);
    mctx.font = `32px monospace`;
    mctx.fillStyle = cfg.colors.accent;
    mctx.fillText(cfg.vibe.toUpperCase() + " EDITION", 540, 1480);
    mctx.fillStyle = cfg.colors.text + "50";
    mctx.font = `24px monospace`;
    mctx.fillText(getTodayKey(), 540, 1540);
    canvasToDownload(mobile, `nutunion-wallpaper-mobile-${activeGenre}.png`);

    toast.success("모바일 배경화면 다운로드!");
    setDl(null);
  }

  // ── Business Card (standard 1050×600)
  async function dlBusinessCard() {
    setDl("card");
    const el = svgContainerRef.current?.querySelector("svg");
    if (!el) { setDl(null); return; }

    const card = Object.assign(document.createElement("canvas"), { width: 1050, height: 600 });
    const ctx = card.getContext("2d")!;
    // Background
    ctx.fillStyle = cfg.colors.bg;
    ctx.fillRect(0, 0, 1050, 600);
    // Left color block
    ctx.fillStyle = cfg.colors.primary;
    ctx.fillRect(0, 0, 320, 600);
    // Gradient on block
    const bg = ctx.createLinearGradient(0, 0, 320, 600);
    bg.addColorStop(0, cfg.colors.primary);
    bg.addColorStop(1, cfg.colors.secondary + "CC");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 320, 600);
    // Logo on left
    const logoCanvas = await svgToCanvas(el as SVGElement, 220, 220, "transparent");
    ctx.drawImage(logoCanvas, 50, 190, 220, 220);
    // Right text block
    ctx.fillStyle = cfg.colors.text;
    ctx.font = `bold 52px '${cfg.font}', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("NUT UNION", 380, 140);
    ctx.fillStyle = cfg.colors.accent;
    ctx.font = `26px monospace`;
    ctx.fillText(cfg.vibe.toUpperCase(), 382, 185);
    // Divider
    ctx.strokeStyle = cfg.colors.accent + "60";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(380, 210);
    ctx.lineTo(980, 210);
    ctx.stroke();
    // Contact placeholder
    ctx.fillStyle = cfg.colors.text + "80";
    ctx.font = "22px monospace";
    const lines = ["nutunion.co.kr", "contact@nutunion.co.kr", "서울, 대한민국"];
    lines.forEach((l, i) => ctx.fillText(l, 382, 260 + i * 40));
    // Genre + date stamp
    ctx.fillStyle = cfg.colors.text + "40";
    ctx.font = "18px monospace";
    ctx.fillText(`${cfg.label} Identity · ${getTodayKey()}`, 382, 540);
    canvasToDownload(card, `nutunion-bizcard-${activeGenre}.png`);
    toast.success("명함 다운로드!");
    setDl(null);
  }

  // ── Brand Kit JSON
  function dlBrandKit() {
    const kit = {
      version: "v3.0",
      generated: new Date().toISOString(),
      genre: { id: activeGenre, label: cfg.label, vibe: cfg.vibe },
      dataInsight: vibe?.insight ?? buildInsight(activeGenre, vibe?.activityLevel ?? 0, vibe?.dominantCat ?? ""),
      isHybrid: vibe?.isHybrid,
      hybridGenres: vibe?.hybridGenres,
      colors: cfg.colors,
      typography: { font: cfg.font, url: cfg.fontUrl },
      animation: cfg.animation,
      risograph: { grain: cfg.grain },
      usage: {
        businessCard: `배경: ${cfg.colors.bg}, 강조: ${cfg.colors.primary}, 폰트: ${cfg.font}`,
        instagram: `배경: ${cfg.colors.bg}, 텍스트: ${cfg.colors.text}, 포인트: ${cfg.colors.accent}`,
        pptCover: `제목: ${cfg.font} Bold, Primary: ${cfg.colors.primary}, Accent: ${cfg.colors.accent}`,
      },
    };
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `nutunion-brand-kit-${activeGenre}.json`,
    }).click();
    toast.success("브랜드 킷 JSON!");
  }

  return (
    <section
      id="liquid-identity"
      className="relative overflow-hidden border-t-[3px] border-nu-ink transition-[background] duration-700"
      style={{ background: cfg.colors.bg }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-15 transition-all duration-1000"
          style={{ background: `radial-gradient(circle, ${cfg.colors.accent} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full opacity-8 transition-all duration-1000"
          style={{ background: `radial-gradient(circle, ${cfg.colors.primary} 0%, transparent 70%)` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-8 py-16 relative">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <span className="font-mono-nu text-[12px] font-bold uppercase tracking-[0.2em] px-3 py-1.5"
              style={{ background: cfg.colors.primary, color: cfg.colors.text }}>
              Liquid Identity
            </span>
            <span className="font-mono-nu text-[11px] uppercase tracking-widest"
              style={{ color: cfg.colors.accent, opacity: 0.7 }}>
              v3.0 Multiverse
            </span>
            {vibe?.isHybrid && (
              <span className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5"
                style={{ background: cfg.colors.accent, color: cfg.colors.bg }}>
                <Layers size={9} className="inline mr-1" />Hybrid
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleAutomatic} disabled={!manualMode}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border transition-all flex items-center gap-1.5"
              style={{ borderColor: cfg.colors.accent, color: cfg.colors.accent,
                background: manualMode ? "transparent" : `${cfg.colors.accent}18` }}>
              <Database size={11} /> 오늘 데이터
            </button>
            <button onClick={() => handleSelect(ALL_GENRES[Math.floor(Math.random() * ALL_GENRES.length)])}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border transition-all flex items-center gap-1.5"
              style={{ borderColor: cfg.colors.text + "40", color: cfg.colors.text }}>
              <Shuffle size={11} /> 랜덤
            </button>
            <button onClick={() => setShowArchive(a => !a)}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border transition-all flex items-center gap-1.5"
              style={{ borderColor: cfg.colors.text + "40", color: cfg.colors.text,
                background: showArchive ? `${cfg.colors.primary}22` : "transparent" }}>
              <Calendar size={11} /> 아카이브
            </button>
            <button onClick={loadVibe} className="p-2 border transition-all"
              style={{ borderColor: cfg.colors.text + "30", color: cfg.colors.text }}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Archive Drawer ──────────────────────────────────────────── */}
        {showArchive && (
          <div className="mb-8 border p-4" style={{ borderColor: `${cfg.colors.accent}40`, background: `${cfg.colors.surface}` }}>
            <p className="font-mono-nu text-[12px] uppercase tracking-widest mb-3"
              style={{ color: cfg.colors.accent }}>
              너트 아카이브 — 지난 로고들
            </p>
            {archive.length === 0 ? (
              <p className="font-mono-nu text-[13px]" style={{ color: cfg.colors.text, opacity: 0.4 }}>
                아직 기록이 없습니다. 매일 방문하면 수집됩니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {archive.map((e) => {
                  const c = GENRES[e.genre];
                  return (
                    <button key={e.date} onClick={() => handleSelect(e.genre)}
                      className="flex flex-col items-center gap-1.5 p-3 border transition-all hover:scale-105"
                      style={{ borderColor: `${c.colors.primary}50`, background: `${c.colors.bg}` }}>
                      <div style={{ width: 52, height: 52 }}>
                        <OpenLogoArtwork variant={buildVariantForGenre(e.genre)} size={52} />
                      </div>
                      <span className="font-mono-nu text-[10px]" style={{ color: c.colors.text }}>
                        {e.date.slice(5)}
                      </span>
                      <span className="font-mono-nu text-[9px]" style={{ color: c.colors.accent }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Main grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-[3px]"
          style={{ borderColor: cfg.colors.shell }}>

          {/* LEFT */}
          <div style={{ borderRight: `3px solid ${cfg.colors.shell}60` }}>

            {/* Today's vibe header */}
            <div className="p-7 border-b" style={{ borderColor: `${cfg.colors.shell}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-black text-white"
                  style={{ background: cfg.colors.text, color: cfg.colors.bg }}>
                  Liquid Identity v3.0
                </span>
                <span className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1"
                  style={{ background: `${cfg.colors.accent}20`, color: cfg.colors.accent }}>
                  Multiverse Engine
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight transition-all duration-500"
                style={{ fontFamily: `'${cfg.font}', sans-serif`, color: cfg.colors.text }}>
                {cfg.vibe.toUpperCase()}
              </h2>
              {vibe?.isHybrid && vibe.hybridGenres && (
                <p className="font-mono-nu text-[12px] mt-2 flex items-center gap-2 font-bold"
                  style={{ color: cfg.colors.accent }}>
                  <Layers size={10} />
                  {GENRES[vibe.hybridGenres[0]].label} × {GENRES[vibe.hybridGenres[1]].label} Hybrid
                </p>
              )}
              
              <div className="mt-5 p-4 border" style={{ borderColor: `${cfg.colors.accent}40`, background: `${cfg.colors.primary}08` }}>
                <p className="font-mono-nu text-[11px] mb-1.5 uppercase tracking-widest" style={{ color: cfg.colors.accent }}>
                  Generative Concept
                </p>
                <p className="text-sm leading-relaxed" style={{ color: cfg.colors.text, opacity: 0.9 }}>
                  <strong>매일 스스로 진화하는 멀티버스 로고 시스템입니다.</strong><br/>
                  오늘은 <strong>{cfg.labelKo} ({cfg.label})</strong> 스타일의 파장과 에너지가 감지되었습니다. 
                  우측의 로고는 고정된 이미지가 아닌, 오늘의 날짜 값과 넛유니언의 활동 데이터를 수학적 난수로 변환하여 
                  단 한 번만 계산되어 그려진 <strong>세상에 하나뿐인 기하학적 {cfg.labelKo} 엠블럼</strong>입니다.
                  이 에너지에 동기화되어 현재 랜딩 페이지 전체의 포인트 컬러도 <strong>{cfg.vibe} 테마</strong>로 자동 변화했습니다.
                </p>
              </div>
            </div>

            {/* Data Insight */}
            {vibe && !vibe.fallback && vibe.activityLevel > 0 && (
              <div className="p-6 border-b" style={{ borderColor: `${cfg.colors.shell}20`, background: `${cfg.colors.primary}12` }}>
                <div className="flex items-start gap-3">
                  <Zap size={16} style={{ color: cfg.colors.accent }} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-mono-nu text-[12px] uppercase tracking-widest mb-1.5"
                      style={{ color: cfg.colors.accent, opacity: 0.7 }}>Data Insight</p>
                    <p className="text-sm leading-relaxed" style={{ color: cfg.colors.text }}>
                      {vibe.insight || `총 ${vibe.activityLevel}개의 활동이 오늘의 너트를 만들었습니다.`}
                    </p>
                    {/* Breakdown */}
                    <div className="mt-4 flex flex-col gap-2">
                      {Object.entries(vibe.breakdown)
                        .filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])
                        .map(([cat, count]) => {
                          const pct = Math.round((count / vibe.activityLevel) * 100);
                          return (
                            <div key={cat}>
                              <div className="flex justify-between font-mono-nu text-[11px] mb-0.5"
                                style={{ color: cfg.colors.text, opacity: 0.6 }}>
                                <span>{CAT_KO[cat] ?? cat}</span>
                                <span>{count}개 ({pct}%)</span>
                              </div>
                              <div className="h-1.5 w-full rounded-sm" style={{ background: `${cfg.colors.text}18` }}>
                                <div className="h-full rounded-sm transition-all duration-700"
                                  style={{ width: `${pct}%`, background: cfg.colors.accent }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Genre selector */}
            <div className="p-5">
              <p className="font-mono-nu text-[12px] uppercase tracking-widest mb-3"
                style={{ color: cfg.colors.text, opacity: 0.4 }}>8 Genre Library</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_GENRES.map((g) => {
                  const c = GENRES[g];
                  const isActive = g === activeGenre;
                  const isToday  = vibe?.genre === g && !manualMode;
                  return (
                    <button key={g} onClick={() => handleSelect(g)} id={`genre-${g}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-left border transition-all"
                      style={{
                        background:   isActive ? c.colors.primary : "transparent",
                        borderColor:  isActive ? c.colors.primary : `${cfg.colors.text}18`,
                        color:        isActive ? c.colors.text : cfg.colors.text,
                        opacity:      isActive ? 1 : 0.65,
                      }}>
                      <div className="w-5 h-5 shrink-0" style={{ background: c.colors.accent }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-head text-xs font-bold">{c.label}</span>
                          {isToday && (
                            <span className="font-mono-nu text-[9px] uppercase tracking-wider px-1 py-0.5"
                              style={{ background: c.colors.accent, color: c.colors.bg }}>Today</span>
                          )}
                        </div>
                        <p className="font-mono-nu text-[10px] opacity-60 truncate">{c.labelKo}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className="flex flex-col">
            {/* Logo canvas */}
            <div className="flex-1 flex flex-col items-center justify-center p-10 relative overflow-hidden min-h-[500px] transition-colors duration-700"
              style={{ background: `${cfg.colors.primary}15` }}>
              {/* Dot grid */}
              <div className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `radial-gradient(${cfg.colors.accent} 1px, transparent 1px)`,
                  backgroundSize: "18px 18px",
                }} />

              {/* SVG Logo */}
              <div ref={svgContainerRef}
                className={`transition-all duration-300 ${transitioning ? "opacity-0 scale-90" : "opacity-100 scale-100"}`}
                style={{ filter: `drop-shadow(0 16px 48px ${cfg.colors.primary}70)` }}>
                <OpenLogoArtwork
                  variant={buildVariantForGenre(activeGenre, vibe?.dateSeed ?? 0)}
                  size={220}
                />
              </div>

              {/* Wordmark */}
              <div className={`text-center mt-7 transition-all duration-500 ${transitioning ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"}`}>
                <p className="text-4xl font-extrabold tracking-tight"
                  style={{ fontFamily: `'${cfg.font}', sans-serif`, color: cfg.colors.text }}>
                  NUT UNION
                </p>
                <p className="font-mono-nu text-[12px] uppercase tracking-[0.3em] mt-1.5"
                  style={{ color: cfg.colors.accent, opacity: 0.7 }}>
                  {cfg.vibe} · {getTodayKey()}
                </p>
              </div>

              {/* Genre stamp */}
              <div className="absolute top-4 left-4 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5"
                style={{ background: cfg.colors.primary, color: cfg.colors.text }}>
                {cfg.label}
              </div>

              {/* Variable path indicator */}
              {(vibe?.activityLevel ?? 0) > 0 && (
                <div className="absolute top-4 right-4 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1"
                  style={{ background: `${cfg.colors.accent}20`, color: cfg.colors.accent }}>
                  Activity {vibe?.activityLevel}
                </div>
              )}
            </div>

            {/* ── Download bar ──────────────────────────────────────── */}
            <div className="border-t p-4" style={{ borderColor: `${cfg.colors.shell}50` }}>
              <p className="font-mono-nu text-[12px] uppercase tracking-widest mb-3"
                style={{ color: cfg.colors.text, opacity: 0.4 }}>
                한정판 Identity Kit · {getTodayKey()}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* SVG */}
                <button onClick={dlSvg}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] flex items-center justify-center gap-1.5 transition-all hover:opacity-80"
                  style={{ borderColor: cfg.colors.text + "50", color: cfg.colors.text }}
                  id="dl-svg">
                  <Download size={11} /> SVG 로고
                </button>
                {/* PNG */}
                <button onClick={dlPng} disabled={downloading === "png"}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] flex items-center justify-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: cfg.colors.text + "50", color: cfg.colors.text }}
                  id="dl-png">
                  {downloading === "png" ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                  PNG 1200px
                </button>
                {/* Wallpaper */}
                <button onClick={dlWallpaper} disabled={downloading === "wallpaper"}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 flex items-center justify-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: cfg.colors.primary + "DD", color: cfg.colors.text }}
                  id="dl-wallpaper">
                  {downloading === "wallpaper" ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                  📱 배경화면
                </button>
                {/* Business Card */}
                <button onClick={dlBusinessCard} disabled={downloading === "card"}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 flex items-center justify-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: cfg.colors.accent + "CC", color: cfg.colors.bg }}
                  id="dl-card">
                  {downloading === "card" ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                  💳 명함 디자인
                </button>
              </div>
              {/* Brand Kit */}
              <button onClick={dlBrandKit}
                className="mt-2 w-full font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-3 flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: cfg.colors.secondary, color: cfg.colors.text }}
                id="dl-brandkit">
                <Download size={12} /> 전체 브랜드 킷 (JSON)
              </button>
            </div>

            {/* Footer nav */}
            <div className="p-4 border-t flex items-center justify-between"
              style={{ borderColor: `${cfg.colors.shell}20` }}>
              <p className="font-mono-nu text-[11px]" style={{ color: cfg.colors.text, opacity: 0.3 }}>
                {vibe?.calculatedAt
                  ? `Calculated ${new Date(vibe.calculatedAt).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}`
                  : "Daily seed"}
              </p>
              <Link href="/brand"
                className="font-mono-nu text-[12px] uppercase tracking-widest no-underline flex items-center gap-1 hover:gap-2 transition-all"
                style={{ color: cfg.colors.accent }}>
                브랜드 가이드 <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
