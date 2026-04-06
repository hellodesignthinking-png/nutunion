"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface HeroProps {
  content?: Record<string, string>;
}

export function Hero({ content }: HeroProps) {
  const sectionRef = useRevealOnScroll(0.08);

  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Parallax effect on the right panel
  useEffect(() => {
    function handleScroll() {
      if (!rightPanelRef.current) return;
      const scrollY = window.scrollY;
      rightPanelRef.current.style.transform = `translateY(${scrollY * 0.08}px)`;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const kicker = content?.kicker || "protocol collective";
  const title = content?.title || "nutunion";
  const subtitle = content?.subtitle || "scene을 설계하는 protocol collective — 공간, 문화, 플랫폼, 그리고 바이브를 잇는 유니온.";
  const ctaPrimary = content?.cta_primary || "START SCENE";
  const ctaSecondary = content?.cta_secondary || "EXPLORE";

  return (
    <section ref={sectionRef} id="home" className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden" role="banner">
      {/* Left - Text */}
      <div className="relative z-10 px-8 lg:px-14 py-32 lg:py-20 flex flex-col justify-end border-r border-nu-ink/[0.15]">
        <div className="reveal-item">
          <span className="font-mono-nu text-[10px] font-bold tracking-[0.3em] uppercase text-nu-pink mb-10 flex items-center gap-3">
            <span className="block w-7 h-[1.5px] bg-nu-pink" aria-hidden="true" />
            {kicker}
          </span>
        </div>

        <h1 className="reveal-item font-head font-extrabold leading-[0.9] tracking-tighter text-nu-ink mb-7 text-[clamp(56px,7.5vw,112px)]">
          {title.length > 3 ? (
            <>
              {title.slice(0, 3)}
              <span className="block" style={{ WebkitTextStroke: "2px #0D0D0D", color: "transparent" }}>
                {title.slice(3)}
              </span>
            </>
          ) : title}
        </h1>

        <p className="reveal-item font-serif-nu text-lg italic font-light text-nu-gray leading-relaxed max-w-[420px] mb-8">
          {subtitle}
        </p>

        <div className="reveal-item flex flex-wrap items-center gap-3 mt-4">
          <Link href="/signup" className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[1.5px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all hover:translate-x-0.5 hover:-translate-y-0.5 no-underline inline-flex items-center gap-2">
            {ctaPrimary} <span aria-hidden="true">&rarr;</span>
          </Link>
          <a href="#scenes" className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-transparent text-nu-ink border-[1.5px] border-nu-ink hover:bg-nu-yellow hover:border-nu-yellow transition-all hover:translate-x-0.5 hover:-translate-y-0.5 no-underline">
            {ctaSecondary}
          </a>
        </div>

        <div className="reveal-item mt-6">
          <a href="#about" className="font-serif-nu text-sm italic text-nu-gray hover:text-nu-pink transition-colors no-underline inline-flex items-center gap-2">
            nutunion에 대해 더 알아보기
            <span aria-hidden="true" className="text-xs">&darr;</span>
          </a>
        </div>

        {/* Scroll indicator with bounce */}
        <div className="absolute bottom-10 left-8 lg:left-14 flex items-center gap-3 z-10 scroll-bounce" aria-hidden="true">
          <span className="font-mono-nu text-[10px] tracking-[0.15em] uppercase text-nu-gray">Scroll</span>
          <span className="w-[60px] h-[1px] bg-nu-gray relative overflow-hidden">
            <span className="absolute inset-0 bg-nu-pink origin-left animate-pulse" />
          </span>
        </div>
      </div>

      {/* Right - CSS Visual (no broken images) */}
      <div ref={rightPanelRef} className="relative z-10 overflow-hidden min-h-[50vh] lg:min-h-0 bg-nu-ink will-change-transform">
        {/* Multi-layer gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-nu-ink via-[#1a1025] to-nu-ink" />
        <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] bg-nu-pink/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[15%] w-[300px] h-[300px] bg-nu-blue/15 rounded-full blur-[100px]" />
        <div className="absolute top-[60%] left-[50%] w-[200px] h-[200px] bg-nu-yellow/10 rounded-full blur-[80px]" />

        {/* Isometric grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(30deg, #F4F1EA 1px, transparent 1px), linear-gradient(-30deg, #F4F1EA 1px, transparent 1px)',
          backgroundSize: '50px 29px',
        }} />

        {/* Floating geometric elements */}
        <div className="absolute top-[12%] left-[8%] w-28 h-28 border border-nu-pink/25 rotate-12 float-anim" />
        <div className="absolute top-[30%] right-[12%] w-20 h-20 border border-nu-blue/20 -rotate-6 float-anim" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[25%] left-[15%] w-16 h-16 border border-nu-yellow/15 rotate-45 float-anim" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-[40%] right-[20%] w-36 h-36 rounded-full border border-nu-paper/8 float-anim" style={{ animationDelay: '1s' }} />

        {/* Center building silhouettes */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 px-8 pb-0">
          <div className="w-[12%] bg-nu-pink/10 border-t border-l border-r border-nu-pink/15" style={{ height: '55%' }} />
          <div className="w-[8%] bg-nu-blue/8 border-t border-l border-r border-nu-blue/12" style={{ height: '72%' }} />
          <div className="w-[15%] bg-nu-paper/5 border-t border-l border-r border-nu-paper/8" style={{ height: '45%' }} />
          <div className="w-[10%] bg-nu-yellow/8 border-t border-l border-r border-nu-yellow/12" style={{ height: '85%' }} />
          <div className="w-[14%] bg-nu-pink/6 border-t border-l border-r border-nu-pink/10" style={{ height: '60%' }} />
          <div className="w-[9%] bg-nu-blue/10 border-t border-l border-r border-nu-blue/15" style={{ height: '50%' }} />
          <div className="w-[11%] bg-nu-paper/4 border-t border-l border-r border-nu-paper/7" style={{ height: '68%' }} />
        </div>

        {/* NU text with pulse-glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-head text-[clamp(100px,15vw,220px)] font-extrabold select-none opacity-80 pulse-glow" style={{ WebkitTextStroke: '2px rgba(244,241,234,0.4)', color: 'transparent' }} aria-hidden="true">
            NU
          </span>
        </div>

        <div className="absolute bottom-10 right-10 font-mono-nu text-[10px] text-nu-paper/25 tracking-widest z-10">
          EST. 2024
        </div>
      </div>
    </section>
  );
}
