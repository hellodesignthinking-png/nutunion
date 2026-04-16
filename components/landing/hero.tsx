"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface HeroProps {
  content?: Record<string, string>;
}

export function Hero({ content }: HeroProps) {
  const sectionRef = useRevealOnScroll(0.08);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      if (!rightPanelRef.current) return;
      const scrollY = window.scrollY;
      rightPanelRef.current.style.transform = `translateY(${scrollY * 0.08}px)`;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const kicker = content?.kicker || "너(You)와 너트(Nut)의 연합";
  const title = content?.title || "너트유니온";
  const subtitle = content?.subtitle || "너트(Nut) + 볼트(Bolt) = 변화를 만드는 힘. 작은 결집이 도시를 바꿉니다.";
  const ctaPrimary = content?.cta_primary || "시티체인저 되기";
  const ctaSecondary = content?.cta_secondary || "EXPLORE";

  return (
    <section ref={sectionRef} id="home" className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden" role="banner">
      {/* Left - Text */}
      <div className="relative z-10 px-8 lg:px-14 py-32 lg:py-20 flex flex-col justify-end border-r-[3px] border-nu-ink bg-nu-paper">
        {/* Registration mark */}
        <div className="absolute top-4 left-4 font-mono-nu text-[12px] text-nu-ink/15 select-none" aria-hidden="true">⊕</div>
        <div className="absolute top-4 right-6 font-mono-nu text-[12px] text-nu-ink/15 select-none" aria-hidden="true">NU—001</div>

        {/* Halftone decorative element */}
        <div className="absolute top-12 right-12 w-40 h-40 halftone-pink opacity-[0.08] -rotate-12" aria-hidden="true" />
        <div className="absolute bottom-24 right-20 w-24 h-24 halftone-blue opacity-[0.06] rotate-6" aria-hidden="true" />

        <div className="reveal-item">
          <span className="font-mono-nu text-[12px] font-bold tracking-[0.3em] uppercase text-nu-pink mb-10 flex items-center gap-3">
            <span className="block w-10 h-[3px] bg-nu-pink" aria-hidden="true" />
            {kicker}
          </span>
        </div>

        {/* Title with misregistration / overprint effect */}
        <div className="reveal-item relative mb-7">
          <h1 className="font-head font-extrabold leading-[0.85] tracking-tighter text-nu-ink text-[clamp(64px,8vw,128px)]">
            {title.length > 3 ? (
              <>
                <span className="relative inline-block">
                  {title.slice(0, 3)}
                  {/* Overprint pink ghost */}
                  <span className="absolute inset-0 text-nu-pink opacity-20 translate-x-[3px] -translate-y-[2px] mix-blend-multiply pointer-events-none select-none" aria-hidden="true">
                    {title.slice(0, 3)}
                  </span>
                </span>
                <span className="block" style={{ WebkitTextStroke: "3px #0D0D0D", color: "transparent" }}>
                  {title.slice(3)}
                  {/* Overprint blue ghost */}
                  <span className="absolute text-nu-blue opacity-15 -translate-x-[2px] translate-y-[1px] mix-blend-multiply pointer-events-none select-none" style={{ WebkitTextStroke: "3px #0055FF" }} aria-hidden="true">
                    {title.slice(3)}
                  </span>
                </span>
              </>
            ) : title}
          </h1>

          {/* Decorative stamp */}
          <div className="absolute -right-4 top-4 w-20 h-20 border-[3px] border-nu-pink rotate-12 flex items-center justify-center opacity-30 pointer-events-none" aria-hidden="true">
            <span className="font-mono-nu text-[10px] font-bold text-nu-pink tracking-widest uppercase transform -rotate-12">RISO</span>
          </div>
        </div>

        <p className="reveal-item font-serif-nu text-lg italic font-light text-nu-gray leading-relaxed max-w-[420px] mb-8 border-l-[3px] border-nu-ink/20 pl-4">
          {subtitle}
        </p>

        <div className="reveal-item flex flex-wrap items-center gap-3 mt-4">
          <Link href="/signup" className="font-mono-nu text-[13px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[3px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] no-underline inline-flex items-center gap-2">
            {ctaPrimary} <span aria-hidden="true">&rarr;</span>
          </Link>
          <a href="#scenes" className="font-mono-nu text-[13px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-transparent text-nu-ink border-[3px] border-nu-ink hover:bg-nu-yellow hover:border-nu-yellow transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] no-underline">
            {ctaSecondary}
          </a>
        </div>

        <div className="reveal-item mt-6">
          <a href="#about" className="font-serif-nu text-sm italic text-nu-gray hover:text-nu-pink transition-colors no-underline inline-flex items-center gap-2">
            너트유니온에 대해 더 알아보기
            <span aria-hidden="true" className="text-xs">&darr;</span>
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-8 lg:left-14 flex items-center gap-3 z-10 scroll-bounce" aria-hidden="true">
          <span className="font-mono-nu text-[12px] tracking-[0.15em] uppercase text-nu-gray">Scroll</span>
          <span className="w-[60px] h-[3px] bg-nu-ink relative overflow-hidden">
            <span className="absolute inset-0 bg-nu-pink origin-left animate-pulse" />
          </span>
        </div>
      </div>

      {/* Right - Risograph Visual Composition */}
      <div ref={rightPanelRef} className="relative z-10 overflow-hidden min-h-[50vh] lg:min-h-0 bg-nu-ink will-change-transform">
        {/* Risograph artwork background */}
        <div className="absolute inset-0 bg-nu-ink" />
        <Image src="/hero-risograph.png" alt="" fill className="object-cover opacity-40 mix-blend-screen" aria-hidden="true" priority />

        {/* Halftone dot pattern overlay */}
        <div className="absolute inset-0 halftone-pink opacity-[0.06]" />

        {/* Overprint color blocks — Risograph style */}
        <div className="absolute top-0 left-0 w-[55%] h-[45%] bg-nu-pink/15 mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[60%] h-[50%] bg-nu-blue/12 mix-blend-screen" />
        <div className="absolute top-[30%] left-[25%] w-[40%] h-[35%] bg-nu-yellow/8 mix-blend-screen" />

        {/* Large geometric shapes */}
        <div className="absolute top-[10%] left-[8%] w-44 h-44 border-[3px] border-nu-pink/40 rotate-12 float-anim" />
        <div className="absolute top-[25%] right-[10%] w-28 h-28 border-[3px] border-nu-blue/30 -rotate-6 float-anim" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[20%] left-[12%] w-20 h-20 bg-nu-yellow/20 rotate-45 float-anim" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-[35%] right-[15%] w-48 h-48 border-[3px] border-nu-paper/10 float-anim" style={{ animationDelay: '1s' }} />

        {/* Cross registration marks */}
        <div className="absolute top-6 left-6 text-nu-paper/20 font-mono-nu text-xs select-none" aria-hidden="true">⊕</div>
        <div className="absolute top-6 right-6 text-nu-paper/20 font-mono-nu text-xs select-none" aria-hidden="true">⊕</div>
        <div className="absolute bottom-6 left-6 text-nu-paper/20 font-mono-nu text-xs select-none" aria-hidden="true">⊕</div>
        <div className="absolute bottom-6 right-6 text-nu-paper/20 font-mono-nu text-xs select-none" aria-hidden="true">⊕</div>

        {/* Thick border grid divisions */}
        <div className="absolute top-0 left-1/3 w-[3px] h-full bg-nu-paper/[0.04]" />
        <div className="absolute top-0 left-2/3 w-[3px] h-full bg-nu-paper/[0.04]" />
        <div className="absolute top-1/3 left-0 w-full h-[3px] bg-nu-paper/[0.04]" />
        <div className="absolute top-2/3 left-0 w-full h-[3px] bg-nu-paper/[0.04]" />

        {/* Abstract building silhouettes — Brutalist */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[2px] px-4 pb-0">
          <div className="w-[12%] bg-nu-pink/15 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-pink/20" style={{ height: '55%' }} />
          <div className="w-[8%] bg-nu-blue/12 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-blue/15" style={{ height: '72%' }} />
          <div className="w-[15%] bg-nu-paper/5 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-paper/8" style={{ height: '45%' }} />
          <div className="w-[10%] bg-nu-yellow/12 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-yellow/15" style={{ height: '85%' }} />
          <div className="w-[14%] bg-nu-pink/8 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-pink/12" style={{ height: '60%' }} />
          <div className="w-[9%] bg-nu-blue/15 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-blue/18" style={{ height: '50%' }} />
          <div className="w-[11%] bg-nu-paper/5 border-t-[3px] border-l-[3px] border-r-[3px] border-nu-paper/7" style={{ height: '68%' }} />
        </div>

        {/* NU text — misregistration effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <span className="font-head text-[clamp(100px,15vw,220px)] font-extrabold select-none opacity-80 pulse-glow" style={{ WebkitTextStroke: '3px rgba(244,241,234,0.4)', color: 'transparent' }} aria-hidden="true">
              NU
            </span>
            {/* Pink ghost offset */}
            <span className="absolute inset-0 font-head text-[clamp(100px,15vw,220px)] font-extrabold select-none opacity-20 translate-x-[4px] -translate-y-[3px]" style={{ WebkitTextStroke: '3px rgba(255,72,176,0.6)', color: 'transparent' }} aria-hidden="true">
              NU
            </span>
            {/* Blue ghost offset */}
            <span className="absolute inset-0 font-head text-[clamp(100px,15vw,220px)] font-extrabold select-none opacity-15 -translate-x-[3px] translate-y-[2px]" style={{ WebkitTextStroke: '3px rgba(0,85,255,0.5)', color: 'transparent' }} aria-hidden="true">
              NU
            </span>
          </div>
        </div>

        {/* Bottom corner metadata */}
        <div className="absolute bottom-10 right-10 font-mono-nu text-[12px] text-nu-paper/30 tracking-widest z-10 text-right">
          <div>EST. 2024</div>
          <div className="text-nu-pink/40 mt-1">EDITION 001</div>
        </div>

        {/* Ink stamp decorative */}
        <div className="absolute top-[15%] right-[10%] w-24 h-24 rounded-full border-[3px] border-nu-paper/10 flex items-center justify-center -rotate-12">
          <span className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] text-nu-paper/20">PROTOCOL</span>
        </div>
      </div>
    </section>
  );
}
