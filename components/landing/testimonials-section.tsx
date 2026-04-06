"use client";

import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

export function TestimonialsSection() {
  const ref = useRevealOnScroll(0.1);

  return (
    <section ref={ref} className="py-24 px-8 border-t border-nu-ink/[0.12]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 reveal-item">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
            Why nutunion
          </span>
          <h2 className="font-head text-[clamp(28px,4vw,42px)] font-extrabold text-nu-ink tracking-tight">
            함께 만드는 커뮤니티
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-nu-ink/[0.06] reveal-item">
          {[
            { emoji: "🏗", title: "크루 운영", desc: "주제 중심의 소모임을 만들고 정기 미팅, 자료 공유, 액션아이템까지 체계적으로 운영합니다." },
            { emoji: "🚀", title: "프로젝트 협업", desc: "크루원들이 프로젝트에 지원하고, PM이 선발하여 실제 프로젝트를 함께 진행합니다." },
            { emoji: "🔗", title: "외부 도구 연동", desc: "Slack, Notion, Google Drive 등 이미 쓰고 있는 도구들과 자연스럽게 연결됩니다." },
          ].map((item, i) => (
            <div key={i} className="bg-nu-white p-8 text-center">
              <span className="text-3xl block mb-4">{item.emoji}</span>
              <h3 className="font-head text-lg font-extrabold text-nu-ink mb-3">{item.title}</h3>
              <p className="text-sm text-nu-gray leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
