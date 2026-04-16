"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

export function FullImageSection() {
  const ref = useRevealOnScroll();

  return (
    <section ref={ref}>
      {/* ========== ROW 1: About + Large visual ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] min-h-[85vh]">
        {/* Left: Space — Risograph composition */}
        <div className="relative overflow-hidden min-h-[50vh] bg-nu-ink reveal-item">
          {/* Overprint color blocks */}
          <div className="absolute top-0 left-0 w-[60%] h-[50%] bg-nu-blue/12 mix-blend-screen" />
          <div className="absolute bottom-0 right-0 w-[50%] h-[40%] bg-nu-pink/8 mix-blend-screen" />

          {/* Halftone texture */}
          <div className="absolute inset-0 halftone-blue opacity-[0.04]" />

          {/* Grid lines */}
          <div className="absolute top-0 left-1/3 w-[2px] h-full bg-nu-paper/[0.03]" />
          <div className="absolute top-2/3 left-0 w-full h-[2px] bg-nu-paper/[0.03]" />

          {/* Risograph print photo background */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space-photo.png" alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-[0.85] pointer-events-none transition-transform duration-[2s] hover:scale-105" aria-hidden="true" />

          {/* Registration mark */}
          <div className="absolute top-4 left-4 font-mono-nu text-[12px] text-nu-paper/15" aria-hidden="true">⊕</div>

          <div className="absolute top-8 left-8 z-10">
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-blue/60 border-[2px] border-nu-blue/20 px-2 py-1">Space</span>
          </div>
          <div className="absolute bottom-8 left-8 z-10">
            <h3 className="font-head text-3xl lg:text-4xl font-extrabold text-nu-paper/90 leading-tight tracking-tighter">
              공간을<br/>재해석합니다
            </h3>
            <p className="text-nu-paper/35 text-sm mt-3 max-w-xs border-l-[3px] border-nu-paper/15 pl-3">
              건축, 인테리어, 부동산 — 물리적 공간에 새로운 의미를 부여합니다.
            </p>
          </div>
        </div>

        {/* Right: text + smaller visual stacked */}
        <div className="flex flex-col">
          {/* Top: culture visual */}
          <div className="relative overflow-hidden flex-1 min-h-[35vh] bg-nu-ink border-b-[3px] border-nu-paper/10 reveal-item">
            {/* Overprint */}
            <div className="absolute top-0 right-0 w-[50%] h-[60%] bg-nu-amber/10 mix-blend-screen" />
            <div className="absolute inset-0 halftone-yellow opacity-[0.03]" />

            {/* Risograph print photo background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/culture-photo.png" alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-[0.85] pointer-events-none transition-transform duration-[2s] hover:scale-105" aria-hidden="true" />

            <div className="absolute top-4 right-4 font-mono-nu text-[12px] text-nu-paper/15" aria-hidden="true">⊕</div>

            <div className="absolute bottom-6 left-8 z-10">
              <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-amber/60 border-[2px] border-nu-amber/20 px-2 py-1 block mb-2">Culture</span>
              <h3 className="font-head text-2xl font-extrabold text-nu-paper/85 tracking-tight">문화를 큐레이션합니다</h3>
            </div>
          </div>

          {/* Bottom: platform visual */}
          <div className="relative overflow-hidden flex-1 min-h-[35vh] bg-nu-ink reveal-item">
            {/* Overprint */}
            <div className="absolute bottom-0 left-0 w-[40%] h-[50%] bg-nu-paper/[0.02] mix-blend-screen" />
            <div className="absolute inset-0 halftone-paper opacity-[0.02]" />

            {/* Risograph print photo background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/platform-photo.png" alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-[0.8] pointer-events-none transition-transform duration-[2s] hover:scale-105" aria-hidden="true" />

            {/* Terminal — brutalist */}
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <div className="w-full max-w-md bg-[#0a0a0a] border-[3px] border-nu-paper/15 overflow-hidden">
                {/* Title bar */}
                <div className="h-8 bg-[#111] flex items-center gap-2 px-3 border-b-[2px] border-nu-paper/10">
                  <div className="w-3 h-3 bg-nu-pink/70" />
                  <div className="w-3 h-3 bg-nu-yellow/70" />
                  <div className="w-3 h-3 bg-nu-blue/50" />
                  <span className="ml-4 font-mono-nu text-[11px] text-nu-paper/25">scene.config.ts</span>
                </div>
                {/* Code */}
                <div className="p-4 font-mono-nu text-[13px] leading-6">
                  <div><span className="text-nu-pink/70">const</span> <span className="text-nu-paper/60">scene</span> <span className="text-nu-paper/30">=</span> <span className="text-nu-blue/70">Scene</span><span className="text-nu-paper/40">.create({"{"}</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">name:</span> <span className="text-nu-yellow/60">&apos;nutunion&apos;</span><span className="text-nu-paper/25">,</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">crews:</span> <span className="text-nu-blue/60">152</span><span className="text-nu-paper/25">,</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">cities:</span> <span className="text-nu-blue/60">38</span></div>
                  <div><span className="text-nu-paper/40">{"}"}</span><span className="text-nu-paper/40">)</span></div>
                  <div className="mt-2"><span className="text-nu-pink/70">await</span> <span className="text-nu-paper/50">scene.</span><span className="text-nu-blue/70">launch</span><span className="text-nu-paper/40">()</span></div>
                  <div className="text-nu-paper/20 mt-1">// → deployed to 38 cities</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-8 z-10">
              <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-paper/40 border-[2px] border-nu-paper/10 px-2 py-1 block mb-2">Platform</span>
              <h3 className="font-head text-2xl font-extrabold text-nu-paper/85 tracking-tight">플랫폼을 빌드합니다</h3>
            </div>
          </div>
        </div>
      </div>

      {/* ========== ROW 2: Vibe full-width ========== */}
      <div className="relative overflow-hidden h-[60vh] bg-nu-ink border-t-[3px] border-nu-ink reveal-item">
        {/* Overprint color blocks */}
        <div className="absolute top-0 left-0 w-[40%] h-[60%] bg-nu-pink/8 mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[35%] h-[50%] bg-[#6600ff]/5 mix-blend-screen" />

        {/* Halftone texture */}
        <div className="absolute inset-0 halftone-pink opacity-[0.03]" />

        {/* Grid lines */}
        <div className="absolute top-0 left-1/4 w-[2px] h-full bg-nu-paper/[0.03]" />
        <div className="absolute top-0 left-3/4 w-[2px] h-full bg-nu-paper/[0.03]" />

        {/* Risograph print photo background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vibe-photo.png" alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-[0.8] pointer-events-none transition-transform duration-[2s] hover:scale-105" aria-hidden="true" />

        {/* Registration marks */}
        <div className="absolute top-4 left-4 font-mono-nu text-[12px] text-nu-pink/20" aria-hidden="true">⊕</div>
        <div className="absolute top-4 right-4 font-mono-nu text-[12px] text-nu-pink/20" aria-hidden="true">⊕</div>

        {/* Stage lights — risograph style */}
        <div className="absolute top-0 left-[25%] w-[150px] h-[70%] bg-gradient-to-b from-nu-pink/8 to-transparent rotate-3 origin-top" />
        <div className="absolute top-0 right-[30%] w-[120px] h-[65%] bg-gradient-to-b from-[#6600ff]/6 to-transparent -rotate-2 origin-top" />

        <div className="absolute top-8 left-8 z-10">
          <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink/50 border-[2px] border-nu-pink/15 px-2 py-1">Vibe</span>
        </div>
        <div className="absolute bottom-12 left-8 lg:left-16 z-10 reveal-item">
          <h3 className="font-head text-4xl lg:text-5xl font-extrabold text-nu-paper/90 leading-tight tracking-tighter">
            바이브를<br/>만듭니다
          </h3>
          <p className="text-nu-paper/30 text-sm mt-3 max-w-sm border-l-[3px] border-nu-paper/15 pl-3">
            분위기, 무드, 에너지 — 도시의 바이브를 포착하고 증폭합니다.
          </p>
        </div>

        <div className="absolute bottom-12 right-8 lg:right-16 z-10 text-right hidden lg:block">
          <span className="font-head text-[100px] font-extrabold leading-none opacity-[0.04] text-nu-paper" style={{ WebkitTextStroke: '2px rgba(244,241,234,0.1)', color: 'transparent' }}>
            04
          </span>
        </div>
      </div>

      {/* ========== ROW 3: Mixed thumbnails strip — risograph panels ========== */}
      <div className="flex overflow-hidden h-[180px] border-t-[3px] border-b-[3px] border-nu-ink">
        {[
          { halftone: "halftone-blue", label: "Seoul", accent: "bg-nu-blue/15" },
          { halftone: "halftone-pink", label: "Events", accent: "bg-nu-pink/20" },
          { halftone: "halftone-yellow", label: "Culture", accent: "bg-nu-amber/15" },
          { halftone: "halftone-ink", label: "Platform", accent: "bg-nu-paper/5" },
          { halftone: "halftone-pink", label: "Vibe", accent: "bg-nu-pink/12" },
          { halftone: "halftone-yellow", label: "Jeju", accent: "bg-nu-yellow/10" },
        ].map((item, i) => (
          <div
            key={i}
            className={`bg-nu-ink flex-1 min-w-[140px] relative group overflow-hidden reveal-item border-r-[2px] border-nu-paper/[0.06] last:border-r-0`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            {/* Background image mapped based on index */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={["/seoul_thumb.png", "/events_thumb.png", "/culture_thumb.png", "/platform_thumb.png", "/vibe_thumb.png", "/jeju_thumb.png"][i]} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-50 max-w-none transition-all duration-700 group-hover:scale-110 group-hover:opacity-90 group-hover:mix-blend-normal pointer-events-none" aria-hidden="true" />
            
            {/* Overprint accent */}
            <div className={`absolute inset-0 ${item.accent} mix-blend-color pointer-events-none`} />

            {/* Halftone texture */}
            <div className={`absolute inset-0 ${item.halftone} opacity-[0.2] pointer-events-none`} />

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-nu-ink/60 border-[3px] border-nu-paper/20">
              <span className="font-mono-nu text-[12px] uppercase tracking-[0.2em] text-nu-paper/80 font-bold">{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
