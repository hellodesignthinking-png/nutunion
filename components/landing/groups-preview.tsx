"use client";

import Link from "next/link";

const catColors: Record<string, { bg: string; bar: string; halftone: string }> = {
  space: { bg: "bg-nu-blue", bar: "bg-nu-blue", halftone: "halftone-blue" },
  culture: { bg: "bg-nu-amber", bar: "bg-nu-amber", halftone: "halftone-yellow" },
  platform: { bg: "bg-nu-ink", bar: "bg-nu-ink", halftone: "halftone-ink" },
  vibe: { bg: "bg-nu-pink", bar: "bg-nu-pink", halftone: "halftone-pink" },
};

interface GroupItem {
  id?: string;
  name: string;
  cat: string;
  desc: string;
  m: number;
  max: number;
}

export function GroupsPreview({ groups }: { groups?: GroupItem[] }) {
  const data = groups || [];

  if (data.length === 0) {
    return (
      <section id="groups" className="py-20 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-head text-4xl font-extrabold tracking-tighter text-nu-ink">
            Scene을 만드는 너트들
          </h2>
          <p className="font-body text-nu-gray mt-3 text-sm">
            새로운 너트가 여러분을 기다리고 있습니다
          </p>
        </div>
        <div className="text-center py-16 bg-nu-white border-[3px] border-nu-ink">
          <p className="text-nu-gray mb-4">아직 등록된 너트가 없습니다</p>
          <Link
            href="/signup"
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-pink text-nu-paper border-[3px] border-nu-pink no-underline hover:bg-nu-ink hover:border-nu-ink transition-colors inline-block"
          >
            첫 번째 너트를 만들어보세요 &rarr;
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="groups" className="py-20 px-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-12">
        <div>
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink block mb-3">
            Community
          </span>
          <h2 className="font-head text-[clamp(32px,4.5vw,52px)] font-extrabold tracking-tighter text-nu-ink leading-[0.9]">
            Scene을 만드는
            <br />
            <span className="relative inline-block">
              너트들
              <span className="absolute -bottom-1 left-0 w-full h-[4px] bg-nu-pink" aria-hidden="true" />
            </span>
          </h2>
        </div>
        <Link
          href="/groups"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink no-underline hover:text-nu-pink transition-colors hidden md:flex items-center gap-2 border-[2px] border-nu-ink px-4 py-2 hover:bg-nu-ink hover:text-nu-paper"
        >
          전체 보기 &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        {data.map((g, i) => {
          const color = catColors[g.cat] || catColors.platform;
          const pct = g.max > 0 ? Math.round((g.m / g.max) * 100) : 0;
          const imgMap: Record<string, string> = { space: "/space.png", culture: "/culture.png", platform: "/network.png", vibe: "/vibe.png" };
          const imgSrc = imgMap[g.cat] || "/network.png";
          return (
            <Link
              key={g.id || i}
              href={g.id ? `/groups/${g.id}` : "/groups"}
              className="group-card bg-nu-white p-0 flex flex-col no-underline relative overflow-hidden group"
            >
              {/* Image Header */}
              <div className="h-32 border-b-[3px] border-nu-ink relative overflow-hidden bg-nu-paper shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-60 group-hover:scale-105 transition-transform duration-500" />
                <div className={`absolute inset-0 ${color.bg} mix-blend-color opacity-20 pointer-events-none`} />
              </div>
              
              <div className="p-5 flex flex-col flex-1 relative">
              {/* Halftone background accent */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${color.halftone} opacity-[0.06] -rotate-12`} aria-hidden="true" />

              {/* Registration mark */}
              <span className="absolute top-2 right-3 font-mono-nu text-[8px] text-nu-ink/10" aria-hidden="true">⊕</span>

              {/* Category tag — rotated stamp style */}
              <span className={`inline-block self-start font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 mb-4 text-white ${color.bg} -rotate-1`}>
                {g.cat}
              </span>

              <h3 className="font-head text-lg font-extrabold leading-tight mb-2 text-nu-ink tracking-tight">{g.name}</h3>
              <p className="font-body text-xs text-nu-gray leading-relaxed mb-4 flex-1">{g.desc}</p>

              <div>
                <div className="progress-bar">
                  <div className={`progress-bar-fill ${color.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-mono-nu text-[10px] text-nu-muted">
                    {g.m}/{g.max} 와셔
                  </span>
                  <span className="font-mono-nu text-[9px] text-nu-ink/20">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="text-center mt-8 md:hidden">
        <Link href="/groups" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline hover:underline">
          전체 보기 &rarr;
        </Link>
      </div>
    </section>
  );
}
