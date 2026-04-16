"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const features = [
  {
    label: "NUT",
    num: "01",
    title: "너트 (Nut) — 변화를 만드는 최소 단위",
    desc: "변화를 만드는 최소 단위의 결집체. 같은 관심사와 목표를 가진 시티체인저들이 모여 하나의 너트를 형성합니다. 작지만 단단한 연결의 시작점.",
    borderColor: "border-l-nu-pink",
    bgColor: "bg-nu-pink",
    imagePath: "/space.png",
    halftone: "halftone-pink",
  },
  {
    label: "BOLT",
    num: "02",
    title: "볼트 — 프로젝트",
    desc: "너트들이 결합하여 해결해야 할 과제. 여러 너트가 하나의 볼트에 체결되어 실질적인 변화를 만들어냅니다. 아이디어에서 실행으로.",
    borderColor: "border-l-nu-blue",
    bgColor: "bg-nu-blue",
    imagePath: "/network.png",
    halftone: "halftone-blue",
  },
  {
    label: "TAP",
    num: "03",
    title: "탭 (Tap) — 지식의 나사산을 새기는 공간",
    desc: "지식의 나사산을 새기는 공간. 활동과 학습의 기록이 쌓여 커뮤니티의 집단 지성을 형성합니다. 경험이 지식이 되는 아카이브.",
    borderColor: "border-l-nu-amber",
    bgColor: "bg-nu-amber",
    imagePath: "/culture.png",
    halftone: "halftone-yellow",
  },
  {
    label: "WASHER",
    num: "04",
    title: "와셔 (Washer) — 너트를 지지하는 구성원",
    desc: "너트를 단단하게 지지하는 구성원들. 각자의 전문성과 경험으로 팀의 결합력을 높이는 시티체인저 한 사람 한 사람이 곧 와셔입니다.",
    borderColor: "border-l-nu-ink",
    bgColor: "bg-nu-ink",
    imagePath: "/vibe.png",
    halftone: "halftone-ink",
  },
  {
    label: "STIFFNESS",
    num: "05",
    title: "강성 — 활동 척도",
    desc: "얼마나 단단하게 결합하고 활동했는지의 척도. 참여도, 기여도, 성과를 종합하여 너트와 와셔의 강성을 측정합니다.",
    borderColor: "border-l-nu-pink",
    bgColor: "bg-nu-pink",
    imagePath: "/space.png",
    halftone: "halftone-pink",
  },
];

export function FeaturesSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="py-24 px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16 reveal-item">
        <span className="font-mono-nu text-[12px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
          How It Works
        </span>
        <h2 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-ink tracking-tighter leading-[0.9]">
          너트와 볼트로
          <br />
          <span className="relative inline-block">
            변화를 조립합니다
            <span className="absolute -bottom-2 left-0 w-full h-[4px] bg-nu-pink" aria-hidden="true" />
          </span>
        </h2>
        <p className="text-nu-gray mt-6 max-w-lg mx-auto text-sm leading-relaxed">
          작은 결집(너트)이 과제(볼트)에 체결될 때, 도시를 바꾸는 힘이 생깁니다.
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
            <span className="absolute top-3 right-4 font-mono-nu text-[10px] text-nu-ink/10">⊕</span>

            <div className="flex flex-col gap-6 w-full">
              {/* Risograph Image Block */}
              <div className="relative w-full h-48 border-[3px] border-nu-ink overflow-hidden bg-nu-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagePath} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute bottom-2 left-3 font-head text-[48px] font-extrabold text-nu-ink leading-none opacity-20 pointer-events-none select-none">{f.num}</span>
              </div>

              <div>
                <span className="font-mono-nu text-[11px] uppercase tracking-[0.25em] text-nu-muted block mb-2">
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
