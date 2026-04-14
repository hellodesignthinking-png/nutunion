"use client";

import { useEffect, useState } from "react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const scenes = [
  {
    label: "SPACE",
    title: "Space Architects Seoul",
    desc: "서울의 빈 공간을 재해석하는 건축·인테리어 너트. 로컬 크리에이터와 함께 도시에 새로운 의미를 부여합니다.",
    color: "bg-nu-blue",
    accent: "#0055FF",
    halftone: "halftone-blue",
    stats: { members: 14, events: 23, cities: 3 },
    visualIcon: "M30,70 L30,20 L50,8 L70,20 L70,70 M38,70 L38,45 L50,38 L62,45 L62,70 M45,70 L45,55 L55,55 L55,70",
  },
  {
    label: "CULTURE",
    title: "Field Culture Lab",
    desc: "현장 기반 문화 리서치 랩. 소외된 로컬 문화를 발굴하고, 전시와 팝업으로 재조명합니다.",
    color: "bg-nu-amber",
    accent: "#C8882A",
    halftone: "halftone-yellow",
    stats: { members: 19, events: 15, cities: 5 },
    visualIcon: "M20,65 L20,15 L50,5 L80,15 L80,65 M30,25 L30,55 L45,55 L45,25 Z M55,20 L55,58 L70,58 L70,20 Z",
  },
  {
    label: "PLATFORM",
    title: "Open Source City",
    desc: "도시 데이터와 오픈소스를 결합하는 시빅 테크 그룹. 코드로 도시 문제를 해결합니다.",
    color: "bg-nu-ink",
    accent: "#F4F1EA",
    halftone: "halftone-paper",
    stats: { members: 22, events: 31, cities: 8 },
    visualIcon: "M15,60 L15,20 L50,10 L50,50 M55,55 L55,15 L85,5 L85,45 M20,65 L50,55 L85,50",
  },
  {
    label: "VIBE",
    title: "Vibe Curators",
    desc: "도시의 분위기를 포착하고 큐레이션하는 모임. 눈에 보이지 않지만 느껴지는 것들을 증폭합니다.",
    color: "bg-nu-pink",
    accent: "#FF48B0",
    halftone: "halftone-pink",
    stats: { members: 28, events: 42, cities: 6 },
    visualIcon: "M10,45 Q25,15 40,45 Q55,75 70,45 Q85,15 100,45",
  },
];

export function SceneGallery() {
  const ref = useRevealOnScroll();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setInterval(() => setActive((p) => (p + 1) % scenes.length), 5000);
        } else {
          clearInterval(timer);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => { clearInterval(timer); observer.disconnect(); };
  }, []);

  const s = scenes[active];

  return (
    <section ref={ref} className="bg-nu-ink border-t-[3px] border-nu-paper/20" id="scenes">
      {/* Header */}
      <div className="text-center pt-24 pb-12 px-8 reveal-item relative">
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
          Scene Gallery
        </span>
        <h2 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-paper tracking-tighter leading-[0.9]">
          4개의 Scene,
          <br />
          <span className="relative inline-block">
            하나의 Union
            <span className="absolute -bottom-2 left-0 w-full h-[4px] bg-nu-pink" aria-hidden="true" />
          </span>
        </h2>
        <p className="text-nu-paper/40 mt-6 max-w-lg mx-auto text-sm leading-relaxed">
          각 분야의 너트들이 만들어가는 실제 Scene을 살펴보세요
        </p>
      </div>

      {/* Main gallery — Risograph composition */}
      <div className="max-w-7xl mx-auto px-8 pb-8 reveal-item">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 border-[3px] border-nu-paper/15 overflow-hidden min-h-[500px]">
          {/* Visual area - 3 cols */}
          <div className="lg:col-span-3 relative overflow-hidden bg-nu-ink transition-all duration-700">
            {/* Overprint color blocks — changes with active scene */}
            <div className="absolute top-0 left-0 w-[60%] h-[50%] mix-blend-screen transition-colors duration-700" style={{ backgroundColor: s.accent + '12' }} />
            <div className="absolute bottom-0 right-0 w-[50%] h-[60%] mix-blend-screen transition-colors duration-700" style={{ backgroundColor: s.accent + '08' }} />

            {/* Halftone dot overlay */}
            <div className={`absolute inset-0 ${s.halftone} opacity-[0.04] transition-all duration-700`} />

            {/* Grid lines — Swiss punk */}
            <div className="absolute top-0 left-1/3 w-[2px] h-full bg-nu-paper/[0.04]" />
            <div className="absolute top-0 left-2/3 w-[2px] h-full bg-nu-paper/[0.04]" />
            <div className="absolute top-1/3 left-0 w-full h-[2px] bg-nu-paper/[0.04]" />
            <div className="absolute top-2/3 left-0 w-full h-[2px] bg-nu-paper/[0.04]" />

            {/* Large icon illustration */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="400" height="300" viewBox="0 0 110 80" fill="none" stroke={s.accent} strokeWidth="2" opacity="0.25" className="transition-all duration-700">
                <path d={s.visualIcon} />
              </svg>
            </div>

            {/* Registration marks */}
            <div className="absolute top-4 left-4 font-mono-nu text-[10px] text-nu-paper/15" aria-hidden="true">⊕</div>
            <div className="absolute top-4 right-4 font-mono-nu text-[10px] text-nu-paper/15" aria-hidden="true">⊕</div>

            {/* Scene number — large faded */}
            <div className="absolute top-6 left-6 font-head text-[100px] font-extrabold leading-none text-nu-paper/[0.03]">
              0{active + 1}
            </div>

            {/* Label stamp */}
            <div className="absolute bottom-6 left-6">
              <span className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 text-white ${s.color} -rotate-2 transition-colors duration-700 border-[2px] border-white/10`}>
                {s.label}
              </span>
            </div>
          </div>

          {/* Info area - 2 cols */}
          <div className="lg:col-span-2 bg-[#111] border-l-[3px] border-nu-paper/10 p-10 lg:p-12 flex flex-col justify-center relative overflow-hidden">
            {/* Halftone background */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${s.halftone} opacity-[0.03]`} aria-hidden="true" />

            <h3 className="font-head text-2xl lg:text-3xl font-extrabold text-nu-paper mb-4 tracking-tight transition-all duration-500">
              {s.title}
            </h3>
            <p className="text-nu-paper/45 text-sm leading-relaxed mb-8 border-l-[3px] border-nu-paper/10 pl-4">
              {s.desc}
            </p>

            {/* Mini stats with dividers */}
            <div className="flex gap-0 mb-8">
              {[
                { val: s.stats.members, label: "Members" },
                { val: s.stats.events, label: "Events" },
                { val: s.stats.cities, label: "Cities" },
              ].map((stat, i) => (
                <div key={stat.label} className={`flex-1 text-center ${i < 2 ? 'border-r-[2px] border-nu-paper/10' : ''}`}>
                  <span className="font-head text-xl font-extrabold text-nu-paper block">{stat.val}</span>
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/30">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Navigation tabs — brutalist */}
            <div className="flex gap-0 mt-auto">
              {scenes.map((sc, i) => (
                <button
                  key={sc.label}
                  onClick={() => setActive(i)}
                  className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-4 py-2.5 border-[2px] transition-all duration-300 ${
                    active === i
                      ? `${sc.color} text-white border-transparent`
                      : "bg-transparent text-nu-paper/30 border-nu-paper/10 hover:text-nu-paper/60 hover:border-nu-paper/20"
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 mt-3">
              {scenes.map((sc, i) => (
                <div key={i} className="h-[3px] flex-1 bg-nu-paper/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${active === i ? sc.color : 'bg-transparent'}`}
                    style={{ width: active === i ? '100%' : '0%', transition: active === i ? 'width 5s linear' : 'width 0.3s' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom thumbnails — Risograph panels */}
      <div className="max-w-7xl mx-auto px-8 pb-24 reveal-item">
        <div className="grid grid-cols-4 gap-[3px]">
          {scenes.map((sc, i) => (
            <button
              key={sc.label}
              onClick={() => setActive(i)}
              className={`relative h-20 overflow-hidden transition-all duration-300 bg-nu-ink border-[2px] ${
                active === i ? "opacity-100 border-t-[3px]" : "opacity-40 hover:opacity-60 border-transparent"
              }`}
              style={{ borderTopColor: active === i ? sc.accent : 'transparent', borderColor: active === i ? sc.accent + '40' : 'rgba(244,241,234,0.05)' }}
            >
              {/* Halftone texture per panel */}
              <div className={`absolute inset-0 ${sc.halftone} opacity-[0.06]`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] text-nu-paper/70">
                  {sc.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
