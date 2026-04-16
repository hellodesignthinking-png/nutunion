"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const items = [
  {
    image: "/culture.png",
    title: "너트 운영",
    desc: "주제 중심의 너트를 만들고 정기 미팅, 자료 공유, 액션아이템까지 체계적으로 운영합니다.",
    num: "01",
    halftone: "halftone-blue",
    accent: "border-t-nu-blue",
  },
  {
    image: "/network.png",
    title: "볼트 협업",
    desc: "와셔들이 볼트에 지원하고, PM이 선발하여 실제 볼트를 함께 진행합니다.",
    num: "02",
    halftone: "halftone-pink",
    accent: "border-t-nu-pink",
  },
  {
    image: "/vibe.png",
    title: "외부 도구 연동",
    desc: "Slack, Notion, Google Drive 등 이미 쓰고 있는 도구들과 자연스럽게 연결됩니다.",
    num: "03",
    halftone: "halftone-yellow",
    accent: "border-t-nu-amber",
  },
];

export function TestimonialsSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="py-24 px-8 border-t-[3px] border-nu-ink">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 reveal-item">
          <span className="font-mono-nu text-[12px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
            Why nutunion
          </span>
          <h2 className="font-head text-[clamp(32px,4.5vw,48px)] font-extrabold text-nu-ink tracking-tighter leading-[0.9]">
            함께 만드는
            <br />
            <span className="relative inline-block">
              커뮤니티
              <span className="absolute -bottom-1.5 left-0 w-full h-[4px] bg-nu-pink" aria-hidden="true" />
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 reveal-item">
          {items.map((item, i) => (
            <div key={i} className={`bg-nu-white p-8 text-center border-[3px] border-nu-ink ${item.accent} border-t-[5px] relative overflow-hidden group hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_#0D0D0D] transition-all`}>
              {/* Halftone corner */}
              <div className={`absolute bottom-0 right-0 w-24 h-24 ${item.halftone} opacity-[0.05]`} aria-hidden="true" />

              {/* Large faded number */}
              <span className="absolute top-2 right-4 font-head text-[64px] font-extrabold text-nu-ink/[0.04] leading-none select-none pointer-events-none" aria-hidden="true">
                {item.num}
              </span>

              {/* Registration mark */}
              <span className="absolute top-2 left-3 font-mono-nu text-[10px] text-nu-ink/10" aria-hidden="true">⊕</span>

              <div className="w-20 h-20 mx-auto mb-6 border-[3px] border-nu-ink overflow-hidden rounded-full rotate-3 bg-nu-paper relative group-hover:rotate-12 transition-transform duration-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80" />
              </div>
              <h3 className="font-head text-xl font-extrabold text-nu-ink mb-3 tracking-tight relative z-10">{item.title}</h3>
              <p className="text-sm text-nu-gray leading-relaxed relative z-10">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
