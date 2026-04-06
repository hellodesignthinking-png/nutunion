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
    <section className="bg-nu-ink py-16 px-8 border-t border-nu-paper/[0.08] border-b border-b-nu-paper/[0.08]">
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
        {data.map((s) => (
          <div key={s.label} className="text-center">
            <span className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-paper block leading-none">
              <AnimatedNumber target={s.num} suffix={s.suffix} />
            </span>
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-paper/40 mt-2 block">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
