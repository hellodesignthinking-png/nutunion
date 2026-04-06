"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const features = [
  {
    label: "SPACE",
    title: "공간 기획",
    desc: "건축, 인테리어, 부동산 — 물리적 공간에 새로운 의미를 부여합니다. 로컬 크리에이터와 함께 도시의 빈 공간을 재해석합니다.",
    color: "border-l-nu-blue",
    bgHover: "hover:bg-nu-blue/[0.03]",
    iconPath: "M30,70 L30,20 L50,8 L70,20 L70,70 M38,70 L38,45 L50,38 L62,45 L62,70",
    iconColor: "#0055FF",
  },
  {
    label: "CULTURE",
    title: "문화 큐레이션",
    desc: "전시, 공연, 팝업 — 로컬 문화를 발굴하고 큐레이션합니다. 소외된 콘텐츠를 재조명하고, 새로운 관객과 연결합니다.",
    color: "border-l-nu-amber",
    bgHover: "hover:bg-nu-amber/[0.03]",
    iconPath: "M20,65 L20,15 L50,5 L80,15 L80,65 M30,25 L30,55 L45,55 L45,25 M55,20 L55,58 L70,58 L70,20",
    iconColor: "#C8882A",
  },
  {
    label: "PLATFORM",
    title: "플랫폼 빌딩",
    desc: "커뮤니티, 서비스, 인프라 — 디지털과 물리적 플랫폼을 설계하고 구축합니다. 오픈소스와 시빅 테크로 도시를 연결합니다.",
    color: "border-l-nu-ink",
    bgHover: "hover:bg-nu-ink/[0.03]",
    iconPath: "M15,60 L15,20 L50,10 L50,50 M55,55 L55,15 L85,5 L85,45 M20,65 L50,55 L85,50",
    iconColor: "#0D0D0D",
  },
  {
    label: "VIBE",
    title: "바이브 메이킹",
    desc: "분위기, 무드, 에너지 — 눈에 보이지 않지만 느껴지는 것들을 포착하고 증폭합니다. 도시의 바이브를 만들어갑니다.",
    color: "border-l-nu-pink",
    bgHover: "hover:bg-nu-pink/[0.03]",
    iconPath: "M10,40 Q25,10 40,40 Q55,70 70,40 Q85,10 100,40",
    iconColor: "#FF48B0",
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
        <h2 className="font-head text-[clamp(32px,4vw,48px)] font-extrabold text-nu-ink tracking-tight">
          4개의 축으로 Scene을 설계합니다
        </h2>
        <p className="text-nu-gray mt-4 max-w-lg mx-auto text-sm leading-relaxed">
          각자의 전문성이 하나의 프로토콜로 연결될 때, 새로운 Scene이 탄생합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((f, i) => (
          <div
            key={f.label}
            className={`reveal-item group border-l-4 ${f.color} ${f.bgHover} bg-nu-white border-t border-r border-b border-nu-ink/[0.06] p-8 lg:p-10 transition-all duration-300`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 100 80" fill="none" stroke={f.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
                  <path d={f.iconPath} />
                </svg>
              </div>
              <div>
                <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted block mb-2">
                  {f.label}
                </span>
                <h3 className="font-head text-xl font-extrabold text-nu-ink mb-3">
                  {f.title}
                </h3>
                <p className="text-sm text-nu-gray leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
