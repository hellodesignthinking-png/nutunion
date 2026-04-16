"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Copy, Check } from "lucide-react";
import { NutCellLogo, MATRIX, CategoryGroup } from "@/components/brand/nut-cell-logo";
import { toast } from "sonner";

const ALL_GROUPS: CategoryGroup[] = ["technical", "creative", "social", "strategic"];

const USAGE_RULES = [
  {
    rule: "컬러 중첩 (Multiply Logic)",
    desc: "복합 프로젝트(예: 건축 + 예술)일 때 두 컬러 레이어가 겹치며 제3의 색을 만듭니다. 이는 너트유니온 내에서의 '융합'을 상징합니다.",
    icon: "⊕",
  },
  {
    rule: "질감의 농도 (Grain Intensity)",
    desc: "기술/개발 쪽은 매끄러운 디지털 질감(Grain 0.2–0.3)을, 문화/지역 쪽은 거칠고 따뜻한 종이 질감(Grain 0.5–0.7)을 사용합니다.",
    icon: "◈",
  },
  {
    rule: "반응형 아이콘 (Responsive Kernel)",
    desc: "로고가 작아질 때는 단순한 기하학적 형태로, 크게 보일 때는 내부 Kernel의 상세 디테일이 살아납니다. 항상 SVG 형식을 사용하세요.",
    icon: "⊞",
  },
  {
    rule: "Shell 불변성 (Shell Anchor)",
    desc: "너트(견과류) 형상의 외곽 Shell은 고정입니다. 어떤 카테고리든 이 Shell을 유지하여 브랜드 일관성을 확보합니다.",
    icon: "◐",
  },
];

export function BrandPageClient() {
  const [copied, setCopied]   = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<"sm" | "md" | "lg">("md");

  function copyColor(hex: string) {
    navigator.clipboard.writeText(hex);
    setCopied(hex);
    toast.success(`${hex} 복사됨`);
    setTimeout(() => setCopied(null), 2000);
  }

  const sizeMap = { sm: 80, md: 140, lg: 200 };

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Header */}
      <header className="border-b-[3px] border-nu-ink sticky top-0 bg-nu-paper z-40">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-4">
          <Link href="/" className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-muted no-underline hover:text-nu-ink flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={14} /> 홈으로
          </Link>
          <span className="text-nu-ink/20">|</span>
          <span className="font-head text-lg font-extrabold">Nut-Cell Brand System</span>
          <span className="ml-auto font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted bg-nu-ink/5 px-2 py-1">v1.0</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-16">

        {/* Hero */}
        <div className="mb-20 border-b-[2px] border-nu-ink/10 pb-16">
          <p className="font-mono-nu text-[12px] uppercase tracking-[0.2em] text-nu-muted mb-4">
            Master Design Matrix
          </p>
          <h1 className="font-head text-6xl md:text-8xl font-extrabold text-nu-ink tracking-tighter mb-6">
            THE NUT-CELL<br />
            <span className="text-nu-pink">IDENTITY SYSTEM</span>
          </h1>
          <p className="text-nu-gray max-w-2xl text-lg leading-relaxed">
            너트유니온이 다루는 모든 사업 영역을 <strong>시각적 유전자(DNA)</strong>로 변환합니다.
            심볼, 폰트, 컬러, 질감이 카테고리에 따라 자동으로 조합되어 살아있는 유기체처럼 작동하는 브랜드 시스템입니다.
          </p>
        </div>

        {/* Size selector */}
        <div className="flex items-center gap-2 mb-8">
          <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">사이즈:</span>
          {(["sm", "md", "lg"] as const).map(s => (
            <button key={s} onClick={() => setActiveSize(s)}
              className={`font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 border-[2px] transition-all ${
                activeSize === s ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/20 text-nu-muted"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* All 4 groups grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-[3px] border-nu-ink mb-20">
          {ALL_GROUPS.map((g, i) => {
            const cfg = MATRIX[g];
            return (
              <div
                key={g}
                className={`p-8 ${i % 2 === 0 ? "border-r-[2px]" : ""} ${i < 2 ? "border-b-[2px]" : ""} border-nu-ink`}
              >
                {/* Logo */}
                <div
                  className="flex items-center justify-center mb-8 rounded-sm"
                  style={{ background: `${cfg.primary}10`, minHeight: "200px" }}
                >
                  <NutCellLogo group={g} size={sizeMap[activeSize]} animated />
                </div>

                {/* Group info */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-nu-paper"
                      style={{ background: cfg.primary }}
                    >
                      {cfg.label}
                    </span>
                    <span className="font-mono-nu text-[12px] text-nu-muted">grain {cfg.grain}</span>
                  </div>
                  <h2
                    className="text-2xl font-extrabold text-nu-ink mb-1"
                    style={{ fontFamily: `'${cfg.font}', sans-serif` }}
                  >
                    NUT UNION
                  </h2>
                  <p className="font-mono-nu text-[13px] text-nu-muted">{cfg.tagline}</p>
                </div>

                {/* Colors */}
                <div className="mb-4">
                  <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-2">Color Palette</p>
                  <div className="flex gap-1.5">
                    {[cfg.primary, cfg.secondary, cfg.accent].map(color => (
                      <button
                        key={color}
                        className="flex-1 group relative"
                        onClick={() => copyColor(color)}
                      >
                        <div className="h-10 border border-nu-ink/10" style={{ background: color }} />
                        <p className="font-mono-nu text-[10px] text-nu-muted mt-1 text-center">
                          {copied === color
                            ? <><Check size={8} className="inline" /> Copied!</>
                            : color
                          }
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div className="border border-nu-ink/10 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-0.5">Typography</p>
                    <p className="text-sm font-bold text-nu-ink" style={{ fontFamily: `'${cfg.font}', sans-serif` }}>
                      {cfg.font}
                    </p>
                  </div>
                  <a
                    href={cfg.fontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline flex items-center gap-1 no-underline"
                  >
                    <Download size={10} /> 폰트
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overprint showcases */}
        <div className="mb-20">
          <h2 className="font-head text-4xl font-extrabold text-nu-ink mb-2">Overprint Mixes</h2>
          <p className="text-nu-gray mb-8">복합 프로젝트 — 두 카테고리가 겹치며 제3의 정체성을 만듭니다</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-[3px] border-nu-ink">
            {[
              { a: "technical", b: "creative", ratio: 0.4, label: "건축 × 예술" },
              { a: "creative",  b: "social",   ratio: 0.4, label: "문화 × 커뮤니티" },
              { a: "social",    b: "strategic", ratio: 0.45, label: "지역 × 비즈니스" },
              { a: "technical", b: "strategic", ratio: 0.5,  label: "기술 × 전략" },
            ].map(({ a, b, ratio, label }, i) => (
              <div
                key={`${a}-${b}`}
                className={`p-6 flex flex-col items-center gap-4 ${i < 3 ? "border-r-[2px] border-nu-ink" : ""}`}
              >
                <div style={{ filter: `drop-shadow(0 4px 16px ${MATRIX[a as CategoryGroup].primary}40)` }}>
                  <NutCellLogo
                    group={a as CategoryGroup}
                    mixRatio={ratio}
                    secondaryGroup={b as CategoryGroup}
                    size={100}
                    animated={false}
                  />
                </div>
                <p className="font-mono-nu text-[12px] text-nu-muted text-center uppercase tracking-widest">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Design Rules */}
        <div className="mb-20">
          <h2 className="font-head text-4xl font-extrabold text-nu-ink mb-8">Dynamic Risograph Rules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-[3px] border-nu-ink">
            {USAGE_RULES.map((rule, i) => (
              <div
                key={rule.rule}
                className={`p-8 ${i % 2 === 0 ? "border-r-[2px]" : ""} ${i < 2 ? "border-b-[2px]" : ""} border-nu-ink`}
              >
                <div className="flex items-start gap-4">
                  <span className="font-head text-4xl text-nu-pink -mt-1 shrink-0">{rule.icon}</span>
                  <div>
                    <h3 className="font-head text-lg font-extrabold text-nu-ink mb-2">{rule.rule}</h3>
                    <p className="text-nu-gray text-sm leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage matrix table */}
        <div className="mb-20">
          <h2 className="font-head text-4xl font-extrabold text-nu-ink mb-8">Master Matrix</h2>
          <div className="border-[3px] border-nu-ink overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b-[2px] border-nu-ink bg-nu-ink">
                  {["그룹", "카테고리", "폰트", "Primary", "Grain"].map(h => (
                    <th key={h} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-paper px-6 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_GROUPS.map((g, i) => {
                  const cfg = MATRIX[g];
                  return (
                    <tr key={g} className={`border-b border-nu-ink/10 ${i % 2 === 0 ? "" : "bg-nu-cream/30"}`}>
                      <td className="px-6 py-4">
                        <span
                          className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 text-nu-paper"
                          style={{ background: cfg.primary }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono-nu text-[13px] text-nu-gray">{cfg.tagline}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold" style={{ fontFamily: `'${cfg.font}', sans-serif` }}>
                          {cfg.font}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border border-nu-ink/10" style={{ background: cfg.primary }} />
                          <span className="font-mono-nu text-[13px]">{cfg.primary}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono-nu text-[13px]">{cfg.grain}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="border-[3px] border-nu-ink p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-head text-3xl font-extrabold text-nu-ink mb-2">Identity Generator</h2>
            <p className="text-nu-gray">랜딩 페이지에서 실시간으로 로고를 조합하고 다운로드하세요.</p>
          </div>
          <Link
            href="/#identity-generator"
            className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-8 py-4 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            Generator 사용하기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
