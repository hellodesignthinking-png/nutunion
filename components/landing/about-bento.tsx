"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface AboutBentoProps {
  content?: Record<string, string>;
}

export function AboutBento({ content }: AboutBentoProps) {
  const ref = useRevealOnScroll(0.08);

  const c = (key: string, fallback: string) => content?.[key] || fallback;

  const cells = [
    {
      bg: "bg-nu-ink text-nu-paper",
      label: c("cell_1_label", "WHAT WE DO"),
      title: c("cell_1_title", "Scene을 설계합니다"),
      body: c("cell_1_body", "공간 기획자, 문화 큐레이터, 플랫폼 빌더, 바이브 메이커가 모여 하나의 Scene을 만듭니다."),
      wide: false,
    },
    {
      bg: "bg-nu-pink text-nu-paper",
      label: c("cell_2_label", "ACTIVE CREWS"),
      huge: c("cell_2_number", "152+"),
      wide: false,
    },
    {
      bg: "",
      label: "PROTOCOL",
      title: c("cell_3_title", "Protocol"),
      body: c("cell_3_body", "각자의 전문성을 프로토콜로 연결합니다. 느슨하지만 강력한 유니온."),
      wide: false,
    },
    {
      bg: "bg-nu-yellow text-nu-ink",
      label: c("cell_4_label", "SPACE"),
      title: c("cell_4_title", "공간을 해석하고 재구성합니다"),
      body: "건축, 인테리어, 부동산 — 물리적 공간에 새로운 의미를 부여합니다.",
      wide: true,
    },
    {
      bg: "bg-nu-blue text-nu-paper",
      label: c("cell_5_label", "CULTURE"),
      title: c("cell_5_title", "문화를 발굴하고 큐레이션합니다"),
      wide: false,
    },
    {
      bg: "",
      label: c("cell_6_label", "PLATFORM"),
      title: c("cell_6_title", "플랫폼을 설계하고 빌드합니다"),
      body: "커뮤니티와 서비스를 연결하는 디지털 인프라를 구축합니다.",
      wide: false,
    },
  ];

  return (
    <section id="about" ref={ref} className="border-b border-nu-ink/[0.12]">
      <div className="bento-grid">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`bento-cell reveal-item ${cell.bg} ${cell.wide ? "wide" : ""}`}
          >
            <span className="font-mono-nu text-[10px] font-bold tracking-[0.25em] uppercase opacity-45 mb-5 block">
              {cell.label}
            </span>
            {cell.huge && (
              <span className="font-head text-[clamp(56px,6vw,88px)] font-extrabold leading-[0.9] tracking-tighter block">
                {cell.huge}
              </span>
            )}
            {cell.title && (
              <h3 className="font-head text-[clamp(24px,3vw,32px)] font-extrabold leading-none tracking-tight mb-3.5">
                {cell.title}
              </h3>
            )}
            {cell.body && (
              <p className="font-body text-sm leading-7 opacity-65">
                {cell.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
