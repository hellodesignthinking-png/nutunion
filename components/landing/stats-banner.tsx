"use client";

import { useEffect, useRef, useState } from "react";

interface StatsBannerProps {
  stats?: { crews: number; members: number; projects: number; events: number };
}

function AnimatedNumber({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1500;
          const start = performance.now();
          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export function StatsBanner({ stats }: StatsBannerProps) {
  const hasData = stats && (stats.crews > 0 || stats.members > 0);
  const data = hasData ? [
    { num: stats.crews, suffix: "+", label: "Active Crews" },
    { num: stats.members, suffix: "+", label: "Community Members" },
    { num: stats.projects, suffix: "", label: "Active Projects" },
    { num: stats.events, suffix: "+", label: "Events" },
  ] : [
    { num: 4, suffix: "", label: "Scene Categories" },
    { num: 8, suffix: "+", label: "Tool Integrations" },
    { num: 24, suffix: "/7", label: "Always Open" },
    { num: 1, suffix: "", label: "Community" },
  ];

  return (
    <section className="bg-nu-ink py-16 px-8 border-t-[3px] border-nu-pink border-b-[3px] border-b-nu-blue relative overflow-hidden">
      {/* Halftone background */}
      <div className="absolute inset-0 halftone-paper opacity-[0.02]" aria-hidden="true" />

      {/* Overprint stripes */}
      <div className="absolute top-0 left-[10%] w-[30%] h-full bg-nu-pink/[0.04] mix-blend-screen -skew-x-12" aria-hidden="true" />
      <div className="absolute top-0 right-[15%] w-[25%] h-full bg-nu-blue/[0.03] mix-blend-screen skew-x-12" aria-hidden="true" />

      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-0 relative">
        {data.map((s, i) => (
          <div key={s.label} className={`text-center py-6 px-4 ${i < data.length - 1 ? 'border-r-[3px] border-nu-paper/10' : ''} relative`}>
            {/* Large background number ghost */}
            <span className="absolute inset-0 flex items-center justify-center font-head text-[80px] font-extrabold text-nu-paper/[0.02] select-none pointer-events-none" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>

            <span className="font-head text-[clamp(40px,6vw,64px)] font-extrabold text-nu-paper block leading-none relative">
              <AnimatedNumber target={s.num} suffix={s.suffix} />
              {/* Overprint ghost */}
              <span className="absolute inset-0 text-nu-pink/10 translate-x-[2px] -translate-y-[1px] pointer-events-none select-none" aria-hidden="true">
                <AnimatedNumber target={s.num} suffix={s.suffix} />
              </span>
            </span>
            <span className="font-mono-nu text-[12px] uppercase tracking-[0.25em] text-nu-paper/40 mt-3 block">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
