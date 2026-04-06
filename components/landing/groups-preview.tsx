"use client";

import Link from "next/link";

const catColors: Record<string, { bg: string; bar: string }> = {
  space: { bg: "bg-nu-blue", bar: "bg-nu-blue" },
  culture: { bg: "bg-nu-amber", bar: "bg-nu-amber" },
  platform: { bg: "bg-nu-ink", bar: "bg-nu-ink" },
  vibe: { bg: "bg-nu-pink", bar: "bg-nu-pink" },
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
          <h2 className="font-head text-4xl font-extrabold tracking-tight text-nu-ink">
            Scene을 만드는 크루들
          </h2>
          <p className="font-body text-nu-gray mt-3 text-sm">
            새로운 크루가 여러분을 기다리고 있습니다
          </p>
        </div>
        <div className="text-center py-16 bg-nu-white border border-nu-ink/[0.06]">
          <p className="text-nu-gray mb-4">아직 등록된 크루가 없습니다</p>
          <Link
            href="/signup"
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-block"
          >
            첫 번째 크루를 만들어보세요 &rarr;
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
          <h2 className="font-head text-4xl font-extrabold tracking-tight text-nu-ink">
            Scene을 만드는 크루들
          </h2>
        </div>
        <Link
          href="/crews"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline hover:underline hidden md:block"
        >
          전체 보기 &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {data.map((g, i) => {
          const color = catColors[g.cat] || catColors.platform;
          const pct = g.max > 0 ? Math.round((g.m / g.max) * 100) : 0;
          return (
            <Link
              key={g.id || i}
              href={g.id ? `/groups/${g.id}` : "/crews"}
              className="group-card bg-nu-white border border-nu-ink/[0.08] p-5 flex flex-col no-underline"
            >
              <span className={`inline-block self-start font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 mb-4 text-white ${color.bg}`}>
                {g.cat}
              </span>
              <h3 className="font-head text-lg font-extrabold leading-tight mb-2 text-nu-ink">{g.name}</h3>
              <p className="font-body text-xs text-nu-gray leading-relaxed mb-4 flex-1">{g.desc}</p>
              <div>
                <div className="progress-bar">
                  <div className={`progress-bar-fill ${color.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="font-mono-nu text-[10px] text-nu-muted mt-1.5 block">
                  {g.m}/{g.max} 멤버
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="text-center mt-8 md:hidden">
        <Link href="/crews" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline hover:underline">
          전체 보기 &rarr;
        </Link>
      </div>
    </section>
  );
}
