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
      label: c("cell_1_label", "NUTUNION"),
      title: c("cell_1_title", "너(You)와 너트(Nut)의 연합"),
      body: c("cell_1_body", "작은 결집이 단단한 변화를 만듭니다. 너트유니온은 시티체인저들의 자율적 연합체입니다."),
      wide: false,
      halftone: "halftone-paper",
    },
    {
      bg: "bg-nu-pink text-nu-paper",
      label: c("cell_2_label", "ACTIVE NUTS"),
      huge: c("cell_2_number", "152+"),
      wide: false,
      halftone: "halftone-paper",
    },
    {
      bg: "",
      label: "NUT + BOLT",
      title: c("cell_3_title", "너트 + 볼트"),
      body: c("cell_3_body", "너트가 볼트에 체결될 때, 실질적인 변화가 시작됩니다."),
      wide: false,
      halftone: "halftone-pink",
    },
    {
      bg: "bg-nu-yellow text-nu-ink",
      label: c("cell_4_label", "TAP"),
      title: c("cell_4_title", "지식의 나사산을 새기다"),
      body: "탭은 활동과 학습의 기록이 쌓이는 탭 아카이브입니다. 경험이 지식이 됩니다.",
      wide: true,
      halftone: "halftone-ink",
      image: "/bento.png",
    },
    {
      bg: "bg-nu-blue text-nu-paper",
      label: c("cell_5_label", "WASHER"),
      title: c("cell_5_title", "와셔 — 너트를 지지하는 인재"),
      wide: false,
      halftone: "halftone-paper",
    },
    {
      bg: "",
      label: c("cell_6_label", "STIFFNESS"),
      title: c("cell_6_title", "강성 — 결합의 척도"),
      body: "참여도와 기여도를 측정하여 커뮤니티의 단단함을 가시화합니다.",
      wide: false,
      halftone: "halftone-blue",
    },
  ];

  return (
    <section id="about" ref={ref} className="border-b-[3px] border-nu-ink">
      <div className="bento-grid">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`bento-cell reveal-item ${cell.bg} ${cell.wide ? "wide" : ""} relative`}
          >
            {/* Registration mark */}
            <span className="absolute top-3 left-3 font-mono-nu text-[12px] opacity-10 select-none" aria-hidden="true">⊕</span>

            {/* Halftone corner decoration */}
            <div className={`absolute bottom-0 right-0 w-28 h-28 ${cell.halftone} opacity-[0.05]`} aria-hidden="true" />

            {cell.image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cell.image} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-25 pointer-events-none" aria-hidden="true" />
              </>
            )}

            <div className="relative z-10">
              <span className="font-mono-nu text-[12px] font-bold tracking-[0.25em] uppercase opacity-45 mb-5 block">
                {cell.label}
              </span>
            {cell.huge && (
              <span className="font-head text-[clamp(56px,6vw,88px)] font-extrabold leading-[0.9] tracking-tighter block relative">
                {cell.huge}
                {/* Overprint ghost */}
                <span className="absolute inset-0 text-nu-paper/20 translate-x-[3px] -translate-y-[2px] mix-blend-soft-light pointer-events-none select-none" aria-hidden="true">
                  {cell.huge}
                </span>
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
          </div>
        ))}
      </div>
    </section>
  );
}
