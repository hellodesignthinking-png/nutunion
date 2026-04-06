"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Download, RefreshCw, Layers, Zap, ChevronRight } from "lucide-react";
import { NutCellLogo, MATRIX, CategoryGroup } from "@/components/brand/nut-cell-logo";
import { toast } from "sonner";

const GROUPS: { id: CategoryGroup; emoji: string; cats: string[] }[] = [
  { id: "technical",  emoji: "⚙️", cats: ["건축", "인테리어", "개발", "기술"] },
  { id: "creative",   emoji: "🎨", cats: ["예술", "문화", "디자인", "기획"] },
  { id: "social",     emoji: "🌐", cats: ["커뮤니티", "지역", "복합 프로젝트"] },
  { id: "strategic",  emoji: "📐", cats: ["비즈니스", "공간개발", "전략"] },
];

const FONT_CLASSES: Record<CategoryGroup, string> = {
  technical: "font-space-grotesk",
  creative:  "font-syne",
  social:    "font-quicksand",
  strategic: "font-archivo",
};

export function IdentityGeneratorSection() {
  const [activeGroup, setActiveGroup]       = useState<CategoryGroup>("technical");
  const [mixGroup, setMixGroup]             = useState<CategoryGroup | null>(null);
  const [mixRatio, setMixRatio]             = useState(0.4);
  const [showMix, setShowMix]               = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const cfg    = MATRIX[activeGroup];
  const cfg2   = mixGroup ? MATRIX[mixGroup] : null;

  // Load dynamic font
  useEffect(() => {
    const fonts = [cfg.fontUrl];
    if (cfg2) fonts.push(cfg2.fontUrl);
    fonts.forEach(url => {
      if (!document.querySelector(`link[href="${url}"]`)) {
        const link = Object.assign(document.createElement("link"), {
          rel: "stylesheet", href: url,
        });
        document.head.appendChild(link);
      }
    });
  }, [cfg, cfg2]);

  // ── Download SVG
  const downloadSvg = useCallback(() => {
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `nutunion-${activeGroup}${mixGroup ? `-x-${mixGroup}` : ""}.svg`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }, [activeGroup, mixGroup]);

  // ── Download PNG via Canvas
  const downloadPng = useCallback(async () => {
    setDownloading(true);
    try {
      const svgEl = svgRef.current?.querySelector("svg");
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 800; canvas.height = 800;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#FAFAF5";
        ctx.fillRect(0, 0, 800, 800);
        ctx.drawImage(img, 0, 0, 800, 800);
        canvas.toBlob(blob => {
          if (!blob) return;
          const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `nutunion-${activeGroup}${mixGroup ? `-x-${mixGroup}` : ""}.png`,
          });
          a.click();
        }, "image/png");
        URL.revokeObjectURL(url);
        toast.success("PNG 다운로드 완료!");
        setDownloading(false);
      };
      img.src = url;
    } catch {
      toast.error("다운로드에 실패했습니다");
      setDownloading(false);
    }
  }, [activeGroup, mixGroup]);

  // ── Download Brand Kit (JSON + Color + Font info)
  const downloadBrandKit = useCallback(() => {
    const kit = {
      group: activeGroup,
      label: cfg.label,
      tagline: cfg.tagline,
      ...(cfg2 ? { mixGroup, mixLabel: cfg2.label, mixRatio } : {}),
      colors: {
        primary: mixGroup
          ? `${cfg.primary} × ${cfg2?.primary} (mix ${Math.round(mixRatio * 100)}%)`
          : cfg.primary,
        secondary: cfg.secondary,
        accent: cfg.accent,
        ...(cfg2 ? { secondaryPrimary: cfg2.primary, secondaryAccent: cfg2.accent } : {}),
      },
      typography: {
        font: cfg.font,
        googleFontsUrl: cfg.fontUrl,
        usage: "Logo wordmark, headings",
        ...(cfg2 ? { mixFont: cfg2.font, mixFontUrl: cfg2.fontUrl } : {}),
      },
      risographStyle: {
        grainIntensity: cfg.grain,
        blendMode: "multiply",
        overprint: mixGroup ? `${cfg.label} + ${cfg2?.label}` : "single",
      },
    };
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `nutunion-brand-kit-${activeGroup}.json`,
    });
    a.click();
    toast.success("브랜드 킷 다운로드 완료!");
  }, [activeGroup, mixGroup, mixRatio, cfg, cfg2]);

  return (
    <section className="relative border-t-[3px] border-nu-ink overflow-hidden">
      {/* Halftone background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      {/* Overprint color spot */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${cfg.primary}22 0%, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-8 py-20">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 text-nu-paper"
              style={{ background: cfg.primary }}
            >
              Identity Engine
            </span>
            <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
              Nut-Cell System v1.0
            </span>
          </div>
          <h2
            className="font-head text-5xl md:text-7xl font-extrabold text-nu-ink tracking-tighter mb-3 transition-all duration-500"
            style={{ fontFamily: `'${cfg.font}', sans-serif` }}
          >
            IDENTITY<br />
            <span style={{ color: cfg.primary }}>GENERATOR</span>
          </h2>
          <p className="text-nu-gray max-w-md leading-relaxed">
            너트유니온의 시각적 DNA를 탐색하세요. 카테고리를 선택하면 로고, 컬러, 폰트가 실시간으로 조합됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-[3px] border-nu-ink">
          {/* Left: Controls */}
          <div className="border-r-[3px] border-nu-ink">
            {/* Category selector */}
            <div className="border-b-[2px] border-nu-ink/20 p-6">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">
                01 — 카테고리 선택
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GROUPS.map((g) => {
                  const c = MATRIX[g.id];
                  const isActive = activeGroup === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGroup(g.id)}
                      className={`border-[2px] p-4 text-left transition-all duration-200 ${
                        isActive
                          ? "text-nu-paper"
                          : "border-nu-ink/15 bg-transparent hover:border-nu-ink/40"
                      }`}
                      style={isActive ? { background: c.primary, borderColor: c.primary } : {}}
                      id={`identity-group-${g.id}`}
                    >
                      <div className="text-xl mb-2">{g.emoji}</div>
                      <p
                        className="font-head text-sm font-extrabold mb-1 transition-colors"
                        style={{ fontFamily: `'${c.font}', sans-serif` }}
                      >
                        {c.label}
                      </p>
                      <p className="font-mono-nu text-[9px] opacity-70">
                        {g.cats.join(" · ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mix / Overprint */}
            <div className="border-b-[2px] border-nu-ink/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                  02 — 오버프린트 믹스
                </p>
                <button
                  onClick={() => setShowMix(!showMix)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest flex items-center gap-1"
                  style={{ color: showMix ? cfg.primary : undefined }}
                  id="identity-mix-toggle"
                >
                  <Layers size={12} /> {showMix ? "ON" : "OFF"}
                </button>
              </div>

              {showMix && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    {GROUPS.filter(g => g.id !== activeGroup).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setMixGroup(mixGroup === g.id ? null : g.id)}
                        className={`border-[2px] py-2 px-3 text-center text-xs font-mono-nu uppercase transition-all ${
                          mixGroup === g.id ? "text-nu-paper" : "border-nu-ink/15"
                        }`}
                        style={mixGroup === g.id ? { background: MATRIX[g.id].primary, borderColor: MATRIX[g.id].primary } : {}}
                      >
                        {MATRIX[g.id].label}
                      </button>
                    ))}
                  </div>
                  {mixGroup && (
                    <div>
                      <div className="flex justify-between font-mono-nu text-[10px] text-nu-muted mb-1">
                        <span>{MATRIX[activeGroup].label}</span>
                        <span>{Math.round(mixRatio * 100)}%</span>
                        <span>{MATRIX[mixGroup].label}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={mixRatio}
                        onChange={e => setMixRatio(parseFloat(e.target.value))}
                        className="w-full accent-nu-pink"
                        id="identity-mix-ratio"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Color Palette */}
            <div className="p-6">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">
                03 — 컬러 팔레트
              </p>
              <div className="flex gap-2 mb-3">
                {[cfg.primary, cfg.secondary, cfg.accent, "#FAFAF5", "#0D0D0D"].map((color, i) => (
                  <div key={i} className="flex-1">
                    <div
                      className="w-full h-10 border border-nu-ink/10 cursor-pointer"
                      style={{ background: color }}
                      onClick={() => { navigator.clipboard.writeText(color); toast.success(`${color} 복사!`); }}
                      title={color}
                    />
                    <p className="font-mono-nu text-[8px] text-nu-muted mt-1 text-center truncate">{color}</p>
                  </div>
                ))}
                {cfg2 && [cfg2.primary, cfg2.accent].map((color, i) => (
                  <div key={`mix-${i}`} className="flex-1">
                    <div
                      className="w-full h-10 border border-nu-ink/10 cursor-pointer opacity-60"
                      style={{ background: color }}
                      onClick={() => { navigator.clipboard.writeText(color); toast.success(`${color} 복사!`); }}
                      title={`${color} (mix)`}
                    />
                    <p className="font-mono-nu text-[8px] text-nu-muted mt-1 text-center truncate">{color}</p>
                  </div>
                ))}
              </div>
              <p className="font-mono-nu text-[10px] text-nu-muted">
                컬러 칩 클릭 시 HEX 코드 복사
              </p>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="flex flex-col">
            {/* Logo preview */}
            <div
              className="flex-1 flex items-center justify-center p-12 relative overflow-hidden transition-all duration-700 min-h-[420px]"
              style={{ background: `${cfg.primary}08` }}
            >
              {/* Grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `linear-gradient(${cfg.primary}40 1px, transparent 1px), linear-gradient(90deg, ${cfg.primary}40 1px, transparent 1px)`,
                  backgroundSize: "24px 24px",
                }}
              />

              <div className="relative flex flex-col items-center gap-6 z-10">
                {/* SVG Logo */}
                <div
                  ref={svgRef}
                  className="transition-all duration-500"
                  style={{
                    filter: `drop-shadow(0 8px 32px ${cfg.primary}40)`,
                  }}
                >
                  <NutCellLogo
                    group={activeGroup}
                    mixRatio={showMix && mixGroup ? mixRatio : 0}
                    secondaryGroup={showMix ? (mixGroup ?? undefined) : undefined}
                    size={180}
                    animated
                  />
                </div>

                {/* Wordmark */}
                <div className="text-center">
                  <p
                    className="text-3xl font-extrabold text-nu-ink tracking-tight transition-all duration-500"
                    style={{ fontFamily: `'${cfg.font}', sans-serif`, color: cfg.primary }}
                  >
                    NUT UNION
                  </p>
                  <p
                    className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-muted mt-1"
                  >
                    {cfg.tagline}
                    {cfg2 ? ` × ${cfg2.tagline}` : ""}
                  </p>
                </div>

                {/* Typography badge */}
                <div
                  className="border px-4 py-2 flex items-center gap-2"
                  style={{ borderColor: `${cfg.primary}40` }}
                >
                  <Zap size={11} style={{ color: cfg.primary }} />
                  <span className="font-mono-nu text-[10px] text-nu-muted">
                    {cfg.font}
                    {cfg2 ? ` × ${cfg2.font}` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Download bar */}
            <div className="border-t-[3px] border-nu-ink p-4 flex flex-wrap gap-2">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center mr-auto">
                Download My Identity
              </p>
              <button
                onClick={downloadSvg}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors flex items-center gap-1.5"
                id="identity-download-svg"
              >
                <Download size={12} /> SVG
              </button>
              <button
                onClick={downloadPng}
                disabled={downloading}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors flex items-center gap-1.5 disabled:opacity-50"
                id="identity-download-png"
              >
                {downloading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />} PNG
              </button>
              <button
                onClick={downloadBrandKit}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 text-nu-paper transition-colors flex items-center gap-1.5"
                style={{ background: cfg.primary }}
                id="identity-download-kit"
              >
                <Download size={12} /> Brand Kit
              </button>
            </div>

            {/* Link to full branding page */}
            <div className="border-t border-nu-ink/10 p-4">
              <Link
                href="/brand"
                className="font-mono-nu text-[10px] uppercase tracking-widest no-underline flex items-center gap-1 hover:gap-2 transition-all"
                style={{ color: cfg.primary }}
              >
                전체 브랜드 가이드 보기 <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
