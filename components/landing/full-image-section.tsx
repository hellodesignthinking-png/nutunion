"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

export function FullImageSection() {
  const ref = useRevealOnScroll();

  return (
    <section ref={ref}>
      {/* ========== ROW 1: About + Large visual ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] min-h-[85vh]">
        {/* Left: big moody visual - Space */}
        <div className="relative overflow-hidden min-h-[50vh] bg-[#0a0f1a] reveal-item">
          {/* Gradient atmosphere */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d1a2d] to-[#0a0f1a]" />
          <div className="absolute top-[30%] left-[20%] w-[350px] h-[350px] bg-nu-blue/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[30%] w-[200px] h-[200px] bg-nu-pink/8 rounded-full blur-[80px]" />

          {/* Abstract architectural form */}
          <div className="absolute bottom-0 left-[10%] right-[10%] flex items-end gap-[2px]">
            <div className="w-[18%] bg-gradient-to-t from-nu-blue/20 to-nu-blue/5 border-t border-x border-nu-blue/15" style={{ height: '65%' }}>
              <div className="p-2 space-y-3 mt-4">
                {[1,2,3,4,5].map(i => <div key={i} className="flex gap-1"><div className="w-2 h-2 bg-nu-paper/10" /><div className="w-2 h-2 bg-nu-paper/10" /></div>)}
              </div>
            </div>
            <div className="w-[14%] bg-gradient-to-t from-nu-paper/8 to-transparent border-t border-x border-nu-paper/10" style={{ height: '82%' }} />
            <div className="w-[22%] bg-gradient-to-t from-nu-blue/15 to-nu-blue/3 border-t border-x border-nu-blue/12" style={{ height: '55%' }}>
              <div className="p-3 mt-6">
                {[1,2,3].map(i => <div key={i} className="h-3 w-full bg-nu-paper/5 mb-2" />)}
              </div>
            </div>
            <div className="w-[12%] bg-gradient-to-t from-nu-pink/10 to-transparent border-t border-x border-nu-pink/10" style={{ height: '95%' }} />
            <div className="w-[20%] bg-gradient-to-t from-nu-paper/6 to-transparent border-t border-x border-nu-paper/8" style={{ height: '70%' }} />
            <div className="w-[14%] bg-gradient-to-t from-nu-blue/12 to-transparent border-t border-x border-nu-blue/10" style={{ height: '60%' }} />
          </div>

          {/* Floating label */}
          <div className="absolute top-8 left-8 z-10">
            <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-blue/60">Space</span>
          </div>
          <div className="absolute bottom-8 left-8 z-10">
            <h3 className="font-head text-3xl lg:text-4xl font-extrabold text-nu-paper/90 leading-tight">
              공간을<br/>재해석합니다
            </h3>
            <p className="text-nu-paper/35 text-sm mt-3 max-w-xs">
              건축, 인테리어, 부동산 — 물리적 공간에 새로운 의미를 부여합니다.
            </p>
          </div>
        </div>

        {/* Right: text + smaller visual stacked */}
        <div className="flex flex-col">
          {/* Top: culture visual */}
          <div className="relative overflow-hidden flex-1 min-h-[35vh] bg-[#1a1200] reveal-item">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2a1800] via-[#1a1000] to-[#0d0a00]" />
            <div className="absolute top-[40%] right-[25%] w-[250px] h-[250px] bg-nu-amber/12 rounded-full blur-[100px]" />

            {/* Gallery frames */}
            <div className="absolute inset-0 flex items-center justify-center gap-6 p-12">
              <div className="w-32 h-44 border border-nu-paper/15 bg-nu-amber/5 relative -rotate-2">
                <div className="absolute inset-3 border border-nu-paper/8" />
                <div className="absolute inset-6 bg-nu-amber/8" />
              </div>
              <div className="w-40 h-52 border border-nu-paper/15 bg-nu-pink/5 relative rotate-1 -mt-8">
                <div className="absolute inset-3 border border-nu-paper/8" />
                <div className="absolute top-8 left-8 right-8 bottom-12 bg-nu-pink/6" />
              </div>
              <div className="hidden lg:block w-28 h-36 border border-nu-paper/15 bg-nu-blue/5 relative -rotate-3 mt-4">
                <div className="absolute inset-3 border border-nu-paper/8" />
              </div>
            </div>

            <div className="absolute bottom-6 left-8 z-10">
              <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-amber/60 block mb-1">Culture</span>
              <h3 className="font-head text-2xl font-extrabold text-nu-paper/85">문화를 큐레이션합니다</h3>
            </div>
          </div>

          {/* Bottom: platform visual */}
          <div className="relative overflow-hidden flex-1 min-h-[35vh] bg-[#080808] border-t border-nu-paper/5 reveal-item">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] to-[#111]" />

            {/* Terminal/code aesthetic */}
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <div className="w-full max-w-md bg-[#0d0d0d] border border-nu-paper/10 rounded-lg overflow-hidden shadow-2xl">
                {/* Title bar */}
                <div className="h-8 bg-[#151515] flex items-center gap-2 px-3 border-b border-nu-paper/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-nu-pink/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-nu-yellow/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-nu-blue/40" />
                  <span className="ml-4 font-mono-nu text-[9px] text-nu-paper/25">scene.config.ts</span>
                </div>
                {/* Code */}
                <div className="p-4 font-mono-nu text-[11px] leading-6">
                  <div><span className="text-nu-pink/70">const</span> <span className="text-nu-paper/60">scene</span> <span className="text-nu-paper/30">=</span> <span className="text-nu-blue/70">Scene</span><span className="text-nu-paper/40">.create({"{"}</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">name:</span> <span className="text-nu-yellow/60">&apos;nutunion&apos;</span><span className="text-nu-paper/25">,</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">crews:</span> <span className="text-nu-blue/60">152</span><span className="text-nu-paper/25">,</span></div>
                  <div className="ml-4"><span className="text-nu-paper/40">cities:</span> <span className="text-nu-blue/60">38</span></div>
                  <div><span className="text-nu-paper/40">{"}"})</span></div>
                  <div className="mt-2"><span className="text-nu-pink/70">await</span> <span className="text-nu-paper/50">scene.</span><span className="text-nu-blue/70">launch</span><span className="text-nu-paper/40">()</span></div>
                  <div className="text-nu-paper/20 mt-1">// → deployed to 38 cities</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-8 z-10">
              <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-paper/40 block mb-1">Platform</span>
              <h3 className="font-head text-2xl font-extrabold text-nu-paper/85">플랫폼을 빌드합니다</h3>
            </div>
          </div>
        </div>
      </div>

      {/* ========== ROW 2: Vibe full-width cinematic ========== */}
      <div className="relative overflow-hidden h-[60vh] bg-[#0d0008] reveal-item">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0015] via-[#0d0008] to-[#0a0012]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-nu-pink/12 rounded-full blur-[150px]" />
        <div className="absolute bottom-[20%] right-[30%] w-[300px] h-[300px] bg-[#6600ff]/8 rounded-full blur-[120px]" />
        <div className="absolute top-[50%] left-[60%] w-[200px] h-[200px] bg-nu-yellow/5 rounded-full blur-[80px]" />

        {/* Sound wave */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="100%" height="200" viewBox="0 0 1200 200" fill="none" className="opacity-20 max-w-5xl">
            <path d="M0,100 Q50,30 100,100 Q150,170 200,100 Q250,20 300,100 Q350,180 400,100 Q450,10 500,100 Q550,190 600,100 Q650,25 700,100 Q750,175 800,100 Q850,15 900,100 Q950,185 1000,100 Q1050,30 1100,100 Q1150,170 1200,100" stroke="#FF48B0" strokeWidth="2">
              <animate attributeName="d" dur="4s" repeatCount="indefinite" values="
                M0,100 Q50,30 100,100 Q150,170 200,100 Q250,20 300,100 Q350,180 400,100 Q450,10 500,100 Q550,190 600,100 Q650,25 700,100 Q750,175 800,100 Q850,15 900,100 Q950,185 1000,100 Q1050,30 1100,100 Q1150,170 1200,100;
                M0,100 Q50,160 100,100 Q150,40 200,100 Q250,170 300,100 Q350,30 400,100 Q450,175 500,100 Q550,25 600,100 Q650,165 700,100 Q750,35 800,100 Q850,170 900,100 Q950,30 1000,100 Q1050,160 1100,100 Q1150,40 1200,100;
                M0,100 Q50,30 100,100 Q150,170 200,100 Q250,20 300,100 Q350,180 400,100 Q450,10 500,100 Q550,190 600,100 Q650,25 700,100 Q750,175 800,100 Q850,15 900,100 Q950,185 1000,100 Q1050,30 1100,100 Q1150,170 1200,100
              "/>
            </path>
            <path d="M0,100 Q50,60 100,100 Q150,140 200,100 Q250,55 300,100 Q350,145 400,100 Q450,50 500,100 Q550,150 600,100 Q650,58 700,100 Q750,142 800,100 Q850,52 900,100 Q950,148 1000,100 Q1050,60 1100,100 Q1150,140 1200,100" stroke="#FF48B0" strokeWidth="1" opacity="0.5">
              <animate attributeName="d" dur="3s" repeatCount="indefinite" values="
                M0,100 Q50,60 100,100 Q150,140 200,100 Q250,55 300,100 Q350,145 400,100 Q450,50 500,100 Q550,150 600,100 Q650,58 700,100 Q750,142 800,100 Q850,52 900,100 Q950,148 1000,100 Q1050,60 1100,100 Q1150,140 1200,100;
                M0,100 Q50,135 100,100 Q150,65 200,100 Q250,140 300,100 Q350,60 400,100 Q450,142 500,100 Q550,55 600,100 Q650,138 700,100 Q750,62 800,100 Q850,140 900,100 Q950,58 1000,100 Q1050,135 1100,100 Q1150,65 1200,100;
                M0,100 Q50,60 100,100 Q150,140 200,100 Q250,55 300,100 Q350,145 400,100 Q450,50 500,100 Q550,150 600,100 Q650,58 700,100 Q750,142 800,100 Q850,52 900,100 Q950,148 1000,100 Q1050,60 1100,100 Q1150,140 1200,100
              "/>
            </path>
          </svg>
        </div>

        {/* Crowd silhouettes */}
        <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-nu-ink/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
          <div className="flex items-end gap-0 opacity-10">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="bg-nu-paper rounded-t-full" style={{
                width: `${20 + Math.random() * 15}px`,
                height: `${60 + Math.random() * 40}px`,
              }} />
            ))}
          </div>
        </div>

        {/* Stage lights */}
        <div className="absolute top-0 left-[25%] w-[150px] h-[70%] bg-gradient-to-b from-nu-pink/8 to-transparent rotate-3 origin-top blur-sm" />
        <div className="absolute top-0 right-[30%] w-[120px] h-[65%] bg-gradient-to-b from-[#6600ff]/6 to-transparent -rotate-2 origin-top blur-sm" />

        {/* Text overlay */}
        <div className="absolute top-8 left-8 z-10">
          <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-pink/50">Vibe</span>
        </div>
        <div className="absolute bottom-12 left-8 lg:left-16 z-10 reveal-item">
          <h3 className="font-head text-4xl lg:text-5xl font-extrabold text-nu-paper/90 leading-tight">
            바이브를<br/>만듭니다
          </h3>
          <p className="text-nu-paper/30 text-sm mt-3 max-w-sm">
            분위기, 무드, 에너지 — 도시의 바이브를 포착하고 증폭합니다.
          </p>
        </div>

        {/* Right side floating text */}
        <div className="absolute bottom-12 right-8 lg:right-16 z-10 text-right hidden lg:block">
          <span className="font-head text-[100px] font-extrabold leading-none opacity-[0.04] text-nu-paper" style={{ WebkitTextStroke: '1px rgba(244,241,234,0.1)', color: 'transparent' }}>
            04
          </span>
        </div>
      </div>

      {/* ========== ROW 3: Mixed thumbnails strip ========== */}
      <div className="flex overflow-hidden h-[180px] border-t border-b border-nu-ink/10">
        {[
          { bg: "bg-gradient-to-br from-nu-blue/20 to-nu-ink", label: "Seoul" },
          { bg: "bg-gradient-to-br from-nu-pink/25 to-[#2a0015]", label: "Events" },
          { bg: "bg-gradient-to-br from-nu-amber/20 to-[#1a1000]", label: "Culture" },
          { bg: "bg-gradient-to-br from-nu-ink to-[#111]", label: "Platform" },
          { bg: "bg-gradient-to-br from-[#1a0028] to-nu-ink", label: "Vibe" },
          { bg: "bg-gradient-to-br from-nu-yellow/15 to-[#1a1800]", label: "Jeju" },
        ].map((item, i) => (
          <div
            key={i}
            className={`${item.bg} flex-1 min-w-[140px] relative group overflow-hidden reveal-item`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-nu-ink/40">
              <span className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-paper/80">{item.label}</span>
            </div>
            {/* Subtle pattern per cell */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: i % 2 === 0
                ? 'radial-gradient(circle, #F4F1EA 1px, transparent 1px)'
                : 'linear-gradient(45deg, #F4F1EA 1px, transparent 1px)',
              backgroundSize: i % 2 === 0 ? '20px 20px' : '15px 15px',
            }} />
          </div>
        ))}
      </div>
    </section>
  );
}
