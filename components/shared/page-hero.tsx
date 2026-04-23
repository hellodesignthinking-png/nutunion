import { Plus } from "lucide-react";
import Link from "next/link";
import React from "react";
import { GenerativeArt } from "@/components/art/generative-art";

interface PageHeroProps {
  category?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  stats?: {
    label: string;
    value: string;
    icon?: React.ReactNode;
  }[];
  className?: string;
  /** 리스트 페이지용 compact 변형 — 세로 높이 ~ 60% 축소 */
  compact?: boolean;
  /** Generative cover — seed + category 제공 시 Hero 배경에 SVG 렌더 */
  cover?: {
    seed: string;
    category: "space" | "culture" | "platform" | "vibe";
    opacity?: number;
  };
}

export function PageHero({ category, title, description, action, stats, className = "", compact = false, cover }: PageHeroProps) {
  const Icon = Plus;

  const coverNode = cover ? (
    <div className="absolute inset-0 opacity-[0.18] pointer-events-none mix-blend-screen" aria-hidden="true" style={{ opacity: cover.opacity ?? 0.18 }}>
      <GenerativeArt seed={cover.seed} category={cover.category} variant="hero" className="w-full h-full" />
    </div>
  ) : null;

  if (compact) {
    return (
      <div className={`relative bg-nu-ink overflow-hidden border-b border-nu-paper/10 ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-nu-blue/10 via-nu-ink to-nu-pink/5" />
        {coverNode}
        <div className="absolute top-0 right-0 w-[140px] h-[140px] bg-nu-pink/10 rounded-full blur-[60px]" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 pt-8 pb-6 md:pt-10 md:pb-7 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {category && (
              <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-blue font-bold block mb-1">
                {category}
              </span>
            )}
            <h1 className="font-head text-[24px] md:text-[30px] font-extrabold text-nu-paper leading-tight tracking-tight mb-1">
              {title}
            </h1>
            <p className="text-nu-paper/50 text-[12px] md:text-[13px] leading-relaxed max-w-3xl">
              {description}
            </p>
            {stats && stats.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-3">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/40 flex items-center gap-1">
                      {stat.icon}
                      {stat.label}
                    </span>
                    <span className="font-head text-[14px] font-bold text-nu-paper tracking-tight">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {action && (
            <Link
              href={action.href}
              className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Icon size={13} /> {action.label}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-nu-ink overflow-hidden border-b border-nu-paper/10 ${className}`}>
      {/* Premium Gradients & Blurs */}
      <div className="absolute inset-0 bg-gradient-to-br from-nu-blue/15 via-nu-ink to-nu-pink/10" />
      {coverNode}
      <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-nu-blue/20 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-1/4 right-1/3 w-[180px] h-[180px] bg-nu-pink/15 rounded-full blur-[70px] opacity-50" />
      
      <div className="relative max-w-7xl mx-auto px-8 pt-20 pb-12 md:pt-24 md:pb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="flex-1">
          {category && (
            <span className="font-mono-nu text-[12px] uppercase tracking-[0.4em] text-nu-blue font-bold block mb-4">
              {category}
            </span>
          )}
          <h1 className="font-head text-[clamp(40px,6vw,68px)] font-extrabold text-nu-paper leading-none tracking-tighter mb-5">
             {title}
          </h1>
          <p className="text-nu-paper/50 max-w-2xl text-[13px] md:text-sm leading-relaxed mb-8 md:mb-6">
             {description}
          </p>

          {stats && stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-6 md:gap-12 mt-6">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-paper/40 flex items-center gap-1.5">
                    {stat.icon}
                    {stat.label}
                  </span>
                  <span className="font-head text-2xl font-bold text-nu-paper tracking-tight">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {action && (
          <div>
            <Link
              href={action.href}
              className="font-mono-nu text-[13px] font-bold tracking-[0.1em] uppercase px-8 py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline inline-flex items-center gap-2.5 shadow-xl shadow-nu-pink/10 active:scale-95 whitespace-nowrap"
            >
              <Icon size={15} /> {action.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
