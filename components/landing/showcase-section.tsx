"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const showcases = [
  {
    label: "NETWORK",
    num: "01",
    title: "152개 너트가 만드는 Scene",
    desc: "서울, 제주, 부산 — 전국의 크리에이터들이 각자의 도시에서 Scene을 만들고, nutunion 프로토콜로 연결됩니다.",
    stats: [
      { num: "152+", label: "Active Crews" },
      { num: "2.4K", label: "Members" },
      { num: "38", label: "Cities" },
    ],
    accentColor: "#FF48B0",
    halftone: "halftone-pink",
    reverse: false,
  },
  {
    label: "SCHEDULE",
    num: "02",
    title: "일정, 예약, 그리고 협업",
    desc: "너트 캘린더, 공간 예약, 이벤트 관리까지. nutunion은 Scene을 만드는 과정 전체를 지원합니다. 반복 일정, 대기자 관리, 자동 알림으로 운영 부담을 최소화합니다.",
    stats: [
      { num: "890+", label: "Events / Month" },
      { num: "95%", label: "참석률" },
      { num: "24/7", label: "자동 운영" },
    ],
    accentColor: "#0055FF",
    halftone: "halftone-blue",
    reverse: true,
  },
];

export function ShowcaseSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="border-t-[3px] border-nu-ink">
      {showcases.map((s, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh] border-b-[3px] border-nu-ink"
        >
          {/* Visual side — Risograph composition */}
          <div className={`relative overflow-hidden min-h-[40vh] bg-nu-ink ${s.reverse ? "lg:order-2" : ""}`}>
            {/* Overprint color blocks */}
            <div className="absolute top-0 left-0 w-[55%] h-[45%] mix-blend-screen" style={{ backgroundColor: s.accentColor + '12' }} />
            <div className="absolute bottom-0 right-0 w-[60%] h-[50%] mix-blend-screen" style={{ backgroundColor: s.accentColor + '08' }} />

            {/* Halftone texture */}
            <div className={`absolute inset-0 ${s.halftone} opacity-[0.04]`} />

            {/* Grid lines */}
            <div className="absolute top-0 left-1/2 w-[2px] h-full bg-nu-paper/[0.03]" />
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-nu-paper/[0.03]" />

            {/* Registration marks */}
            <div className="absolute top-4 left-4 font-mono-nu text-[12px] text-nu-paper/15" aria-hidden="true">⊕</div>
            <div className="absolute bottom-4 right-4 font-mono-nu text-[12px] text-nu-paper/15" aria-hidden="true">⊕</div>

            {/* Decorative elements per showcase */}
            {idx === 0 ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" className="opacity-30">
                    {/* Network nodes — thicker strokes */}
                    <circle cx="150" cy="120" r="30" stroke="#FF48B0" strokeWidth="2"/>
                    <circle cx="300" cy="80" r="20" stroke="#0055FF" strokeWidth="2"/>
                    <circle cx="400" cy="180" r="35" stroke="#FFD200" strokeWidth="2"/>
                    <circle cx="100" cy="280" r="25" stroke="#FF48B0" strokeWidth="2"/>
                    <circle cx="250" cy="250" r="30" stroke="#0055FF" strokeWidth="2"/>
                    <circle cx="380" cy="300" r="20" stroke="#FFD200" strokeWidth="2"/>
                    {/* Lines — dashed */}
                    <line x1="150" y1="120" x2="300" y2="80" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    <line x1="300" y1="80" x2="400" y2="180" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    <line x1="150" y1="120" x2="250" y2="250" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    <line x1="100" y1="280" x2="250" y2="250" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    <line x1="250" y1="250" x2="380" y2="300" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    <line x1="400" y1="180" x2="380" y2="300" stroke="#F4F1EA" strokeWidth="1.5" strokeDasharray="6,6"/>
                    {/* Node dots */}
                    <rect x="146" y="116" width="8" height="8" fill="#FF48B0" transform="rotate(45 150 120)"/>
                    <rect x="296" y="76" width="8" height="8" fill="#0055FF" transform="rotate(45 300 80)"/>
                    <rect x="396" y="176" width="8" height="8" fill="#FFD200" transform="rotate(45 400 180)"/>
                    <rect x="96" y="276" width="8" height="8" fill="#FF48B0" transform="rotate(45 100 280)"/>
                    <rect x="246" y="246" width="8" height="8" fill="#0055FF" transform="rotate(45 250 250)"/>
                    <rect x="376" y="296" width="8" height="8" fill="#FFD200" transform="rotate(45 380 300)"/>
                  </svg>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid grid-cols-7 gap-[3px] w-[80%] max-w-[400px] opacity-25">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div
                        key={i}
                        className={`aspect-square border-[2px] border-nu-paper/10 flex items-center justify-center text-[12px] font-mono-nu text-nu-paper/40 ${
                          [3, 8, 12, 17, 22, 28].includes(i) ? "bg-nu-blue/25 border-nu-blue/30" : ""
                        } ${[5, 15, 25].includes(i) ? "bg-nu-pink/20 border-nu-pink/25" : ""}`}
                      >
                        {i < 31 ? i + 1 : ""}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Large faded number */}
            <div className="absolute top-6 left-6 font-head text-[100px] font-extrabold leading-none text-nu-paper/[0.03]" aria-hidden="true">
              {s.num}
            </div>
          </div>

          {/* Content side */}
          <div className={`flex flex-col justify-center p-10 lg:p-16 ${s.reverse ? "lg:order-1 border-r-[3px] border-nu-ink" : "border-l-[3px] border-nu-ink/10"} bg-nu-paper relative overflow-hidden`}>
            {/* Halftone corner */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${s.halftone} opacity-[0.04]`} aria-hidden="true" />

            <div className="reveal-item">
              <span className="font-mono-nu text-[12px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
                {s.label}
              </span>
              <h2 className="font-head text-[clamp(30px,3.5vw,46px)] font-extrabold text-nu-ink leading-[0.9] tracking-tighter mb-4">
                {s.title}
              </h2>
              <p className="text-nu-gray text-sm leading-relaxed max-w-md mb-8 border-l-[3px] border-nu-ink/15 pl-4">
                {s.desc}
              </p>

              <div className="flex gap-0">
                {s.stats.map((stat, i) => (
                  <div key={stat.label} className={`flex-1 ${i < s.stats.length - 1 ? 'border-r-[3px] border-nu-ink/10 pr-6' : ''} ${i > 0 ? 'pl-6' : ''}`}>
                    <span className="font-head text-2xl lg:text-3xl font-extrabold text-nu-ink block tracking-tight">
                      {stat.num}
                    </span>
                    <span className="font-mono-nu text-[11px] uppercase tracking-[0.2em] text-nu-muted">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
