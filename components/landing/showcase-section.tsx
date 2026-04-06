"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const showcases = [
  {
    label: "NETWORK",
    title: "152개 크루가 만드는 Scene",
    desc: "서울, 제주, 부산 — 전국의 크리에이터들이 각자의 도시에서 Scene을 만들고, nutunion 프로토콜로 연결됩니다.",
    stats: [
      { num: "152+", label: "Active Crews" },
      { num: "2.4K", label: "Members" },
      { num: "38", label: "Cities" },
    ],
    gradient: "from-nu-pink/20 via-nu-ink to-nu-blue/15",
    accentColor: "nu-pink",
    reverse: false,
  },
  {
    label: "SCHEDULE",
    title: "일정, 예약, 그리고 협업",
    desc: "소모임 캘린더, 공간 예약, 이벤트 관리까지. nutunion은 Scene을 만드는 과정 전체를 지원합니다. 반복 일정, 대기자 관리, 자동 알림으로 운영 부담을 최소화합니다.",
    stats: [
      { num: "890+", label: "Events / Month" },
      { num: "95%", label: "참석률" },
      { num: "24/7", label: "자동 운영" },
    ],
    gradient: "from-nu-blue/20 via-nu-ink to-nu-yellow/10",
    accentColor: "nu-blue",
    reverse: true,
  },
];

export function ShowcaseSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="border-t border-nu-ink/[0.12]">
      {showcases.map((s, idx) => (
        <div
          key={idx}
          className={`grid grid-cols-1 lg:grid-cols-2 min-h-[70vh] border-b border-nu-ink/[0.12]`}
        >
          {/* Visual side */}
          <div className={`relative overflow-hidden min-h-[40vh] bg-nu-ink ${s.reverse ? "lg:order-2" : ""}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />

            {/* Decorative elements per showcase */}
            {idx === 0 ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" className="opacity-30">
                    {/* Network nodes */}
                    <circle cx="150" cy="120" r="30" stroke="#FF48B0" strokeWidth="0.5"/>
                    <circle cx="300" cy="80" r="20" stroke="#0055FF" strokeWidth="0.5"/>
                    <circle cx="400" cy="180" r="35" stroke="#FFD200" strokeWidth="0.5"/>
                    <circle cx="100" cy="280" r="25" stroke="#FF48B0" strokeWidth="0.5"/>
                    <circle cx="250" cy="250" r="30" stroke="#0055FF" strokeWidth="0.5"/>
                    <circle cx="380" cy="300" r="20" stroke="#FFD200" strokeWidth="0.5"/>
                    {/* Lines */}
                    <line x1="150" y1="120" x2="300" y2="80" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    <line x1="300" y1="80" x2="400" y2="180" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    <line x1="150" y1="120" x2="250" y2="250" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    <line x1="100" y1="280" x2="250" y2="250" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    <line x1="250" y1="250" x2="380" y2="300" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    <line x1="400" y1="180" x2="380" y2="300" stroke="#F4F1EA" strokeWidth="0.3" strokeDasharray="4,4"/>
                    {/* Node dots */}
                    <circle cx="150" cy="120" r="4" fill="#FF48B0"/>
                    <circle cx="300" cy="80" r="4" fill="#0055FF"/>
                    <circle cx="400" cy="180" r="4" fill="#FFD200"/>
                    <circle cx="100" cy="280" r="4" fill="#FF48B0"/>
                    <circle cx="250" cy="250" r="4" fill="#0055FF"/>
                    <circle cx="380" cy="300" r="4" fill="#FFD200"/>
                  </svg>
                </div>
                <div className="absolute top-1/4 left-1/3 w-48 h-48 bg-nu-pink/10 rounded-full blur-[80px]" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid grid-cols-7 gap-[2px] w-[80%] max-w-[400px] opacity-25">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div
                        key={i}
                        className={`aspect-square border border-nu-paper/10 flex items-center justify-center text-[10px] font-mono-nu text-nu-paper/40 ${
                          [3, 8, 12, 17, 22, 28].includes(i) ? "bg-nu-blue/20" : ""
                        } ${[5, 15, 25].includes(i) ? "bg-nu-pink/15" : ""}`}
                      >
                        {i < 31 ? i + 1 : ""}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-nu-blue/10 rounded-full blur-[80px]" />
              </>
            )}
          </div>

          {/* Content side */}
          <div className={`flex flex-col justify-center p-10 lg:p-16 ${s.reverse ? "lg:order-1" : ""}`}>
            <div className="reveal-item">
              <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
                {s.label}
              </span>
              <h2 className="font-head text-[clamp(28px,3.5vw,42px)] font-extrabold text-nu-ink leading-tight mb-4">
                {s.title}
              </h2>
              <p className="text-nu-gray text-sm leading-relaxed max-w-md mb-8">
                {s.desc}
              </p>

              <div className="flex gap-8">
                {s.stats.map((stat) => (
                  <div key={stat.label}>
                    <span className="font-head text-2xl lg:text-3xl font-extrabold text-nu-ink block">
                      {stat.num}
                    </span>
                    <span className="font-mono-nu text-[9px] uppercase tracking-[0.2em] text-nu-muted">
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
