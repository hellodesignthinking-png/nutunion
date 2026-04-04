"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

interface HeroProps {
  content?: Record<string, string>;
}

export function Hero({ content }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll(".reveal-item");
    if (!els) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const kicker = content?.kicker || "protocol collective";
  const title = content?.title || "nutunion";
  const subtitle =
    content?.subtitle ||
    "scene을 설계하는 protocol collective — 공간, 문화, 플랫폼, 그리고 바이브를 잇는 유니온.";
  const ctaPrimary = content?.cta_primary || "START SCENE";
  const ctaSecondary = content?.cta_secondary || "EXPLORE";

  return (
    <section
      ref={sectionRef}
      id="home"
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden"
      role="banner"
    >
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
              <span
                className="block"
                style={{ WebkitTextStroke: "2px #0D0D0D", color: "transparent" }}
              >
                {title.slice(3)}
              </span>
            </>
          ) : (
            title
          )}
        </h1>

        <p className="reveal-item font-serif-nu text-lg italic font-light text-nu-gray leading-relaxed max-w-[420px] mb-8">
          {subtitle}
        </p>

        <div className="reveal-item flex flex-wrap items-center gap-3 mt-4">
          <Link
            href="/signup"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[1.5px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all hover:translate-x-0.5 hover:-translate-y-0.5 no-underline inline-flex items-center gap-2"
          >
            {ctaPrimary} <span aria-hidden="true">&rarr;</span>
          </Link>
          <a
            href="#groups"
            className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-transparent text-nu-ink border-[1.5px] border-nu-ink hover:bg-nu-yellow hover:border-nu-yellow transition-all hover:translate-x-0.5 hover:-translate-y-0.5 no-underline"
          >
            {ctaSecondary}
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-8 lg:left-14 flex items-center gap-3 z-10" aria-hidden="true">
          <span className="font-mono-nu text-[10px] tracking-[0.15em] uppercase text-nu-gray">
            Scroll
          </span>
          <span className="w-[60px] h-[1px] bg-nu-gray relative overflow-hidden">
            <span className="absolute inset-0 bg-nu-pink origin-left animate-pulse" />
          </span>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="relative z-10 bg-nu-ink flex items-center justify-center overflow-hidden min-h-[40vh] lg:min-h-0">
        {/* Gradient orbs for visual depth */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nu-pink/20 rounded-full blur-[100px]" aria-hidden="true" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-nu-blue/15 rounded-full blur-[80px]" aria-hidden="true" />

        <span
          className="font-head text-[clamp(100px,15vw,220px)] font-extrabold select-none opacity-90 relative z-10"
          style={{ WebkitTextStroke: "2px rgba(244,241,234,0.6)", color: "transparent" }}
          aria-hidden="true"
        >
          NU
        </span>
        <div className="absolute bottom-10 right-10 font-mono-nu text-[10px] text-nu-paper/30 tracking-widest">
          EST. 2024
        </div>
      </div>
    </section>
  );
}
