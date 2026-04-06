"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Download, RefreshCw, Zap, Database, Shuffle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LiquidNutSvg } from "@/components/brand/liquid-nut-svg";
import { LogoGenre, GENRES, GenreConfig } from "@/lib/brand/genre-engine";
import { toast } from "sonner";

const GENRE_ORDER: LogoGenre[] = ["blueprint", "puffy", "pixel", "swiss_punk", "hand_drawn"];

const CAT_KO: Record<string, string> = {
  space: "공간·건축",
  culture: "예술·문화",
  platform: "플랫폼·개발",
  vibe: "바이브·지역",
};

interface VibeData {
  genre: LogoGenre;
  dominantCat: string;
  totalCount: number;
  breakdown: Record<string, number>;
  projectCounts: Record<string, number>;
  groupCounts: Record<string, number>;
  calculatedAt: string;
  fallback?: boolean;
}

export function LiquidIdentitySection() {
  const [vibe, setVibe]               = useState<VibeData | null>(null);
  const [activeGenre, setActiveGenre] = useState<LogoGenre>("blueprint");
  const [loading, setLoading]         = useState(true);
  const [transitioning, setTransit]   = useState(false);
  const [manualMode, setManual]       = useState(false);
  const [downloading, setDl]          = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  // ── Load Today's Vibe from API
  const loadVibe = useCallback(async () => {
    try {
      const res = await fetch("/api/todays-vibe", { cache: "no-store" });
      const data: VibeData = await res.json();
      setVibe(data);
      if (!manualMode) {
        triggerTransition(data.genre);
      }
    } catch {
      setVibe(null);
    } finally {
      setLoading(false);
    }
  }, [manualMode]);

  useEffect(() => { loadVibe(); }, [loadVibe]);

  // ── Inject Google Font dynamically
  useEffect(() => {
    const cfg = GENRES[activeGenre];
    if (!document.querySelector(`link[href="${cfg.fontUrl}"]`)) {
      const link = Object.assign(document.createElement("link"), {
        rel: "stylesheet", href: cfg.fontUrl,
      });
      document.head.appendChild(link);
    }
  }, [activeGenre]);

  function triggerTransition(genre: LogoGenre) {
    setTransit(true);
    setTimeout(() => {
      setActiveGenre(genre);
      setTransit(false);
    }, 350);
  }

  function handleManualSelect(genre: LogoGenre) {
    setManual(true);
    triggerTransition(genre);
  }

  function handleAutomatic() {
    setManual(false);
    if (vibe) triggerTransition(vibe.genre);
  }

  // ── Generate Insight string
  function buildInsight(v: VibeData): string {
    const cfg = GENRES[activeGenre];
    const parts: string[] = [];
    for (const [cat, count] of Object.entries(v.breakdown)) {
      if (count > 0) parts.push(`${CAT_KO[cat] || cat} ${count}개`);
    }
    if (parts.length === 0) return `오늘의 너트는 ${cfg.label} 스타일입니다.`;
    return `현재 ${parts.join(", ")} 활동이 모여 로고를 만들고 있습니다.`;
  }

  // ── SVG download
  function downloadSvg() {
    const el = svgRef.current?.querySelector("svg");
    if (!el) return;
    const blob = new Blob([el.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url, download: `nutunion-todays-nut-${activeGenre}.svg`,
    }).click();
    URL.revokeObjectURL(url);
    toast.success("SVG 다운로드 완료!");
  }

  // ── PNG via Canvas
  async function downloadPng() {
    setDl(true);
    try {
      const el = svgRef.current?.querySelector("svg");
      if (!el) return;
      const svgData = new XMLSerializer().serializeToString(el);
      const url = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" }));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200; canvas.height = 1200;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = GENRES[activeGenre].colors.bg;
        ctx.fillRect(0, 0, 1200, 1200);
        ctx.drawImage(img, 0, 0, 1200, 1200);
        canvas.toBlob(blob => {
          if (!blob) return;
          Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `nutunion-todays-nut-${activeGenre}-1200px.png`,
          }).click();
          toast.success("PNG 1200px 다운로드 완료!");
        }, "image/png");
        URL.revokeObjectURL(url);
        setDl(false);
      };
      img.src = url;
    } catch {
      toast.error("다운로드 실패");
      setDl(false);
    }
  }

  // ── Brand Kit JSON
  function downloadBrandKit() {
    const cfg = GENRES[activeGenre];
    const kit = {
      todaysNut: {
        genre: activeGenre,
        label: cfg.label,
        vibe: cfg.vibe,
        generatedAt: new Date().toISOString(),
        dataSource: vibe ? "live-supabase" : "daily-seed",
      },
      dataInsight: vibe ? buildInsight(vibe) : "데이터 없음",
      colors: cfg.colors,
      typography: { font: cfg.font, googleFontsUrl: cfg.fontUrl },
      risograph: { grain: cfg.grain, blendMode: "multiply" },
      usage: {
        businessCard: "로고 SVG + Primary 컬러로 명함을 구성하세요",
        instagram: `배경: ${cfg.colors.bg}, 텍스트: ${cfg.colors.text}`,
        pptCover: `제목: ${cfg.font} Bold, 포인트 컬러: ${cfg.colors.accent}`,
      },
    };
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `nutunion-brand-kit-${activeGenre}.json`,
    }).click();
    toast.success("브랜드 킷 다운로드 완료!");
  }

  const cfg = GENRES[activeGenre];

  return (
    <section
      id="liquid-identity"
      className="relative border-t-[3px] border-nu-ink overflow-hidden transition-colors duration-700"
      style={{ background: cfg.colors.bg }}
    >
      {/* Ambient light blob */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-20 transition-all duration-1000"
          style={{ background: `radial-gradient(circle, ${cfg.colors.accent} 0%, transparent 70%)` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-8 py-16 relative">
        {/* Top label */}
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span
              className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5"
              style={{ background: cfg.colors.primary, color: cfg.colors.text }}
            >
              Liquid Identity
            </span>
            <span className="font-mono-nu text-[10px] uppercase tracking-widest" style={{ color: cfg.colors.accent, opacity: 0.7 }}>
              v2.0
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutomatic}
              disabled={!manualMode}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border transition-all flex items-center gap-1.5"
              style={{
                borderColor: manualMode ? cfg.colors.accent : cfg.colors.primary,
                color: manualMode ? cfg.colors.accent : cfg.colors.primary,
                background: manualMode ? "transparent" : `${cfg.colors.primary}22`,
              }}
            >
              <Database size={11} /> 오늘의 데이터
            </button>
            <button
              onClick={() => { const g = GENRE_ORDER[Math.floor(Math.random() * GENRE_ORDER.length)]; handleManualSelect(g); }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border transition-all flex items-center gap-1.5"
              style={{ borderColor: cfg.colors.accent, color: cfg.colors.accent }}
            >
              <Shuffle size={11} /> 랜덤
            </button>
            <button onClick={loadVibe} className="p-2 border transition-all" style={{ borderColor: cfg.colors.accent, color: cfg.colors.accent }}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0" style={{ border: `3px solid ${cfg.colors.shell}` }}>

          {/* LEFT: genre selector + data insight */}
          <div style={{ borderRight: `3px solid ${cfg.colors.shell}` }}>

            {/* Today's Vibe header */}
            <div
              className="p-6 border-b"
              style={{ borderColor: `${cfg.colors.shell}80` }}
            >
              <p className="font-mono-nu text-[10px] uppercase tracking-widest mb-2" style={{ color: cfg.colors.accent, opacity: 0.7 }}>
                Today&apos;s Vibe
              </p>
              <h2
                className="text-4xl md:text-5xl font-extrabold tracking-tight transition-all duration-500"
                style={{ fontFamily: `'${cfg.font}', sans-serif`, color: cfg.colors.text }}
              >
                {cfg.vibe.toUpperCase()}
              </h2>
              <p className="mt-2 text-sm" style={{ color: cfg.colors.text, opacity: 0.6 }}>
                {cfg.description}
              </p>
            </div>

            {/* Data Insight */}
            {vibe && !vibe.fallback && (
              <div className="p-6 border-b" style={{ borderColor: `${cfg.colors.shell}40`, background: `${cfg.colors.primary}15` }}>
                <div className="flex items-start gap-3">
                  <Zap size={16} style={{ color: cfg.colors.accent }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono-nu text-[10px] uppercase tracking-widest mb-1" style={{ color: cfg.colors.accent, opacity: 0.7 }}>
                      Data Insight
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: cfg.colors.text }}>
                      {buildInsight(vibe)}
                    </p>
                    {/* Breakdown bars */}
                    <div className="mt-3 flex flex-col gap-1.5">
                      {Object.entries(vibe.breakdown)
                        .filter(([,v]) => v > 0)
                        .sort((a,b) => b[1]-a[1])
                        .map(([cat, count]) => {
                          const pct = Math.round((count / vibe.totalCount) * 100);
                          return (
                            <div key={cat}>
                              <div className="flex justify-between font-mono-nu text-[9px] mb-0.5" style={{ color: cfg.colors.text, opacity: 0.7 }}>
                                <span>{CAT_KO[cat] || cat}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full" style={{ background: `${cfg.colors.text}20` }}>
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: cfg.colors.accent }}
                                />
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
            <div className="p-6">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest mb-4" style={{ color: cfg.colors.text, opacity: 0.5 }}>
                Genre Library
              </p>
              <div className="flex flex-col gap-2">
                {GENRE_ORDER.map((g) => {
                  const c = GENRES[g];
                  const isActive = g === activeGenre;
                  const isToday = vibe?.genre === g && !manualMode;
                  return (
                    <button
                      key={g}
                      onClick={() => handleManualSelect(g)}
                      id={`genre-btn-${g}`}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-all border"
                      style={{
                        background: isActive ? c.colors.primary : "transparent",
                        borderColor: isActive ? c.colors.primary : `${cfg.colors.text}20`,
                        color: isActive ? c.colors.text : cfg.colors.text,
                        opacity: isActive ? 1 : 0.7,
                      }}
                    >
                      {/* Mini color swatch */}
                      <div className="w-6 h-6 shrink-0 border border-white/20" style={{ background: c.colors.accent }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-head text-sm font-bold">{c.label}</span>
                          {isToday && (
                            <span className="font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5"
                              style={{ background: c.colors.accent, color: c.colors.bg }}>
                              Today
                            </span>
                          )}
                        </div>
                        <p className="font-mono-nu text-[9px] opacity-70">{c.insightLabel} · {c.font}</p>
                      </div>
                      <ArrowRight size={12} className={`shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className="flex flex-col">
            {/* Logo preview */}
            <div
              className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden min-h-[480px] transition-colors duration-700"
              style={{ background: `${cfg.colors.primary}18` }}
            >
              {/* Grid dots */}
              <div className="absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage: `radial-gradient(${cfg.colors.accent} 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }} />

              {/* Logo */}
              <div
                ref={svgRef}
                className={`transition-all duration-300 ${transitioning ? "opacity-0 scale-90" : "opacity-100 scale-100"}`}
                style={{ filter: `drop-shadow(0 12px 40px ${cfg.colors.primary}60)` }}
              >
                <LiquidNutSvg genre={activeGenre} size={210} animated />
              </div>

              {/* Wordmark */}
              <div className={`text-center mt-6 transition-all duration-500 ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
                <p
                  className="text-4xl font-extrabold tracking-tight"
                  style={{ fontFamily: `'${cfg.font}', sans-serif`, color: cfg.colors.text }}
                >
                  NUT UNION
                </p>
                <p className="font-mono-nu text-[10px] uppercase tracking-[0.3em] mt-1" style={{ color: cfg.colors.accent, opacity: 0.7 }}>
                  {cfg.vibe} Edition
                </p>
              </div>

              {/* Genre badge */}
              <div
                className="absolute top-4 left-4 font-mono-nu text-[9px] font-bold uppercase tracking-widest px-3 py-1.5"
                style={{ background: cfg.colors.primary, color: cfg.colors.text }}
              >
                {cfg.label}
              </div>
            </div>

            {/* Download bar */}
            <div
              className="border-t p-4 flex flex-wrap gap-2 items-center"
              style={{ borderColor: `${cfg.colors.shell}60` }}
            >
              <p className="font-mono-nu text-[10px] uppercase tracking-widest mr-auto" style={{ color: cfg.colors.text, opacity: 0.5 }}>
                Download Identity Kit
              </p>
              <button
                onClick={downloadSvg}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] transition-all flex items-center gap-1.5"
                style={{ borderColor: cfg.colors.text, color: cfg.colors.text }}
                id="liquid-dl-svg"
              >
                <Download size={11} /> SVG
              </button>
              <button
                onClick={downloadPng}
                disabled={downloading}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] transition-all flex items-center gap-1.5 disabled:opacity-40"
                style={{ borderColor: cfg.colors.text, color: cfg.colors.text }}
                id="liquid-dl-png"
              >
                {downloading ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />} PNG 1200px
              </button>
              <button
                onClick={downloadBrandKit}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 transition-all flex items-center gap-1.5"
                style={{ background: cfg.colors.primary, color: cfg.colors.text }}
                id="liquid-dl-kit"
              >
                <Download size={11} /> Brand Kit
              </button>
            </div>

            {/* Link to brand guide */}
            <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: `${cfg.colors.shell}30` }}>
              <p className="font-mono-nu text-[9px] uppercase tracking-widest" style={{ color: cfg.colors.text, opacity: 0.4 }}>
                {vibe?.calculatedAt && `Updated ${new Date(vibe.calculatedAt).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
              <Link
                href="/brand"
                className="font-mono-nu text-[10px] uppercase tracking-widest no-underline flex items-center gap-1 hover:gap-2 transition-all"
                style={{ color: cfg.colors.accent }}
              >
                브랜드 가이드 <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
