"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const features = [
  {
    label: "SPACE",
    num: "01",
    title: "공간 기획",
    desc: "건축, 인테리어, 부동산 — 물리적 공간에 새로운 의미를 부여합니다. 로컬 크리에이터와 함께 도시의 빈 공간을 재해석합니다.",
    borderColor: "border-l-nu-blue",
    bgColor: "bg-nu-blue",
    imagePath: "/space.png",
    halftone: "halftone-blue",
  },
  {
    label: "CULTURE",
    num: "02",
    title: "문화 큐레이션",
    desc: "전시, 공연, 팝업 — 로컬 문화를 발굴하고 큐레이션합니다. 소외된 콘텐츠를 재조명하고, 새로운 관객과 연결합니다.",
    borderColor: "border-l-nu-amber",
    bgColor: "bg-nu-amber",
    imagePath: "/culture.png",
    halftone: "halftone-yellow",
  },
  {
    label: "PLATFORM",
    num: "03",
    title: "플랫폼 빌딩",
    desc: "커뮤니티, 서비스, 인프라 — 디지털과 물리적 플랫폼을 설계하고 구축합니다. 오픈소스와 시빅 테크로 도시를 연결합니다.",
    borderColor: "border-l-nu-ink",
    bgColor: "bg-nu-ink",
    imagePath: "/network.png",
    halftone: "halftone-ink",
  },
  {
    label: "VIBE",
    num: "04",
    title: "바이브 메이킹",
    desc: "분위기, 무드, 에너지 — 눈에 보이지 않지만 느껴지는 것들을 포착하고 증폭합니다. 도시의 바이브를 만들어갑니다.",
    borderColor: "border-l-nu-pink",
    bgColor: "bg-nu-pink",
    imagePath: "/vibe.png",
    halftone: "halftone-pink",
  },
];

export function FeaturesSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="py-24 px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16 reveal-item">
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
          What We Do
        </span>
        <h2 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-ink tracking-tighter leading-[0.9]">
          4개의 축으로
          <br />
          <span className="relative inline-block">
            Scene을 설계합니다
            <span className="absolute -bottom-2 left-0 w-full h-[4px] bg-nu-pink" aria-hidden="true" />
          </span>
        </h2>
        <p className="text-nu-gray mt-6 max-w-lg mx-auto text-sm leading-relaxed">
          각자의 전문성이 하나의 프로토콜로 연결될 때, 새로운 Scene이 탄생합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {features.map((f, i) => (
          <div
            key={f.label}
            className={`reveal-item group border-l-[5px] ${f.borderColor} bg-nu-white border-[3px] border-nu-ink p-8 lg:p-10 transition-all duration-200 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] relative overflow-hidden`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            {/* Halftone pattern in corner */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${f.halftone} opacity-[0.06]`} aria-hidden="true" />

            {/* Registration mark */}
            <span className="absolute top-3 right-4 font-mono-nu text-[8px] text-nu-ink/10">⊕</span>

            <div className="flex flex-col gap-6 w-full">
              {/* Risograph Image Block */}
              <div className="relative w-full h-48 border-[3px] border-nu-ink overflow-hidden bg-nu-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagePath} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute bottom-2 left-3 font-head text-[48px] font-extrabold text-nu-ink leading-none opacity-20 pointer-events-none select-none">{f.num}</span>
              </div>

              <div>
                <span className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-muted block mb-2">
                  {f.label}
                </span>
                <h3 className="font-head text-2xl font-extrabold text-nu-ink mb-3 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm text-nu-gray leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>

            {/* Bottom bar accent */}
            <div className={`absolute bottom-0 left-0 w-full h-[4px] ${f.bgColor} opacity-30`} />
          </div>
        ))}
      </div>
    </section>
  );
}
