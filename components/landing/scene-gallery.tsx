"use client";

import { useEffect, useState } from "react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const scenes = [
  {
    label: "SPACE",
    title: "Space Architects Seoul",
    desc: "서울의 빈 공간을 재해석하는 건축·인테리어 크루. 로컬 크리에이터와 함께 도시에 새로운 의미를 부여합니다.",
    color: "bg-nu-blue",
    gradient: "from-[#001133] via-[#002266] to-[#001a4d]",
    accent: "#0055FF",
    stats: { members: 14, events: 23, cities: 3 },
    visualIcon: "M30,70 L30,20 L50,8 L70,20 L70,70 M38,70 L38,45 L50,38 L62,45 L62,70 M45,70 L45,55 L55,55 L55,70",
  },
  {
    label: "CULTURE",
    title: "Field Culture Lab",
    desc: "현장 기반 문화 리서치 랩. 소외된 로컬 문화를 발굴하고, 전시와 팝업으로 재조명합니다.",
    color: "bg-nu-amber",
    gradient: "from-[#2a1800] via-[#4a2800] to-[#3a2000]",
    accent: "#C8882A",
    stats: { members: 19, events: 15, cities: 5 },
    visualIcon: "M20,65 L20,15 L50,5 L80,15 L80,65 M30,25 L30,55 L45,55 L45,25 Z M55,20 L55,58 L70,58 L70,20 Z",
  },
  {
    label: "PLATFORM",
    title: "Open Source City",
    desc: "도시 데이터와 오픈소스를 결합하는 시빅 테크 그룹. 코드로 도시 문제를 해결합니다.",
    color: "bg-nu-ink",
    gradient: "from-[#0a0a0a] via-[#151515] to-[#0d0d0d]",
    accent: "#F4F1EA",
    stats: { members: 22, events: 31, cities: 8 },
    visualIcon: "M15,60 L15,20 L50,10 L50,50 M55,55 L55,15 L85,5 L85,45 M20,65 L50,55 L85,50",
  },
  {
    label: "VIBE",
    title: "Vibe Curators",
    desc: "도시의 분위기를 포착하고 큐레이션하는 모임. 눈에 보이지 않지만 느껴지는 것들을 증폭합니다.",
    color: "bg-nu-pink",
    gradient: "from-[#330019] via-[#660033] to-[#4d0026]",
    accent: "#FF48B0",
    stats: { members: 28, events: 42, cities: 6 },
    visualIcon: "M10,45 Q25,15 40,45 Q55,75 70,45 Q85,15 100,45",
  },
];

export function SceneGallery() {
  const ref = useRevealOnScroll();
  const [active, setActive] = useState(0);

  // Auto-rotate only when visible
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
    <section ref={ref} className="bg-nu-ink" id="scenes">
      {/* Header */}
      <div className="text-center pt-24 pb-12 px-8 reveal-item">
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
          Scene Gallery
        </span>
        <h2 className="font-head text-[clamp(32px,4vw,48px)] font-extrabold text-nu-paper tracking-tight">
          4개의 Scene, 하나의 Union
        </h2>
        <p className="text-nu-paper/40 mt-4 max-w-lg mx-auto text-sm leading-relaxed">
          각 분야의 크루들이 만들어가는 실제 Scene을 살펴보세요
        </p>
      </div>

      {/* Main gallery */}
      <div className="max-w-7xl mx-auto px-8 pb-8 reveal-item">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 border border-nu-paper/10 overflow-hidden min-h-[500px]">
          {/* Visual area - 3 cols */}
          <div className={`lg:col-span-3 relative overflow-hidden bg-gradient-to-br ${s.gradient} transition-all duration-700`}>
            {/* Gradient orbs */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] transition-colors duration-700" style={{ backgroundColor: s.accent + '20' }} />
            <div className="absolute bottom-1/3 right-1/3 w-48 h-48 rounded-full blur-[80px] transition-colors duration-700" style={{ backgroundColor: s.accent + '15' }} />

            {/* Large icon illustration */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="400" height="300" viewBox="0 0 110 80" fill="none" stroke={s.accent} strokeWidth="1" opacity="0.25" className="transition-all duration-700">
                <path d={s.visualIcon} />
              </svg>
            </div>

            {/* Decorative grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'linear-gradient(0deg, #F4F1EA 1px, transparent 1px), linear-gradient(90deg, #F4F1EA 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />

            {/* Scene number */}
            <div className="absolute top-6 left-6 font-head text-[80px] font-extrabold leading-none text-nu-paper/[0.04]">
              0{active + 1}
            </div>

            {/* Label */}
            <div className="absolute bottom-6 left-6">
              <span className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1 text-white ${s.color} transition-colors duration-700`}>
                {s.label}
              </span>
            </div>
          </div>

          {/* Info area - 2 cols */}
          <div className="lg:col-span-2 bg-[#141414] p-10 lg:p-12 flex flex-col justify-center">
            <h3 className="font-head text-2xl lg:text-3xl font-extrabold text-nu-paper mb-4 transition-all duration-500">
              {s.title}
            </h3>
            <p className="text-nu-paper/45 text-sm leading-relaxed mb-8">
              {s.desc}
            </p>

            {/* Mini stats */}
            <div className="flex gap-6 mb-8">
              <div>
                <span className="font-head text-xl font-extrabold text-nu-paper block">{s.stats.members}</span>
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/30">Members</span>
              </div>
              <div>
                <span className="font-head text-xl font-extrabold text-nu-paper block">{s.stats.events}</span>
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/30">Events</span>
              </div>
              <div>
                <span className="font-head text-xl font-extrabold text-nu-paper block">{s.stats.cities}</span>
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/30">Cities</span>
              </div>
            </div>

            {/* Navigation tabs */}
            <div className="flex gap-2 mt-auto">
              {scenes.map((sc, i) => (
                <button
                  key={sc.label}
                  onClick={() => setActive(i)}
                  className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-4 py-2 border transition-all duration-300 ${
                    active === i
                      ? `${sc.color} text-white border-transparent`
                      : "bg-transparent text-nu-paper/30 border-nu-paper/10 hover:text-nu-paper/60"
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 mt-4">
              {scenes.map((sc, i) => (
                <div key={i} className="h-[2px] flex-1 bg-nu-paper/10 overflow-hidden">
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

      {/* Bottom thumbnails */}
      <div className="max-w-7xl mx-auto px-8 pb-24 reveal-item">
        <div className="grid grid-cols-4 gap-1">
          {scenes.map((sc, i) => (
            <button
              key={sc.label}
              onClick={() => setActive(i)}
              className={`relative h-20 overflow-hidden transition-all duration-300 bg-gradient-to-br ${sc.gradient} ${
                active === i ? "opacity-100 border-t-2" : "opacity-40 hover:opacity-60 border-t-2 border-transparent"
              }`}
              style={{ borderColor: active === i ? sc.accent : 'transparent' }}
            >
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
