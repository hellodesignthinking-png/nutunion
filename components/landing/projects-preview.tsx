import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string | null;
  memberCount: number;
}

export function ProjectsPreview({ projects }: { projects?: ProjectItem[] }) {
  if (!projects || projects.length === 0) return null;

  return (
    <section className="py-20 px-8 bg-nu-ink relative overflow-hidden">
      {/* Halftone background texture */}
      <div className="absolute inset-0 halftone-pink opacity-[0.03]" aria-hidden="true" />

      {/* Overprint color blocks */}
      <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-nu-blue/[0.04] mix-blend-screen" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/3 bg-nu-pink/[0.03] mix-blend-screen" aria-hidden="true" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header — magazine column layout feel */}
        <div className="flex items-end justify-between mb-12 border-b-[3px] border-nu-paper/20 pb-6">
          <div>
            <span className="font-mono-nu text-[12px] uppercase tracking-[0.3em] text-nu-pink block mb-3">
              Collaboration
            </span>
            <h2 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold tracking-tighter text-nu-paper leading-[0.9]">
              진행 중인
              <br />
              볼트
            </h2>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-nu-paper/30 text-sm max-w-xs mb-3">
              너트들이 함께 만들어가는 볼트에 참여해보세요
            </p>
            <span className="font-mono-nu text-[11px] text-nu-paper/15 tracking-widest uppercase">
              ISSUE {String(new Date().getMonth() + 1).padStart(2, '0')}.{new Date().getFullYear()}
            </span>
          </div>
        </div>

        {/* Project grid — zine/magazine layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-8">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group bg-nu-graphite/30 border-[3px] border-nu-paper/[0.10] p-6 no-underline hover:border-nu-pink/50 transition-all hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_rgba(255,72,176,0.3)] relative overflow-hidden"
            >
              {/* Halftone decoration */}
              <div className="absolute top-0 right-0 w-28 h-28 halftone-pink opacity-[0.04] rotate-12 z-10" aria-hidden="true" />
              
              {/* Abstract background graphic */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i % 2 === 0 ? "/network.png" : "/space.png"} alt="" className="absolute -bottom-1/2 -right-1/4 w-full h-full object-cover mix-blend-color-dodge opacity-20 pointer-events-none transition-transform duration-700 group-hover:scale-110 z-0 grayscale" aria-hidden="true" />

              {/* Issue number */}
              <span className="absolute top-3 right-4 font-head text-[56px] font-extrabold text-nu-paper/[0.03] leading-none select-none" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="flex items-center gap-2 mb-3">
                {p.category && (
                  <span className={`font-mono-nu text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 text-white ${catColors[p.category] || "bg-nu-gray"} -rotate-1`}>
                    {p.category}
                  </span>
                )}
                <span className="font-mono-nu text-[10px] uppercase tracking-widest border-[2px] border-green-500/50 text-green-400 px-2 py-0.5">
                  {p.status}
                </span>
              </div>

              <h3 className="font-head text-xl font-extrabold text-nu-paper group-hover:text-nu-pink transition-colors mb-2 tracking-tight">
                {p.title}
              </h3>
              <p className="text-sm text-nu-paper/40 line-clamp-2 mb-4 border-l-[3px] border-nu-paper/10 pl-3">
                {p.description}
              </p>

              <div className="flex items-center justify-between border-t-[2px] border-nu-paper/[0.06] pt-3">
                <span className="font-mono-nu text-[12px] text-nu-paper/30 flex items-center gap-1">
                  <Users size={11} /> {p.memberCount}명 참여
                </span>
                <span className="font-mono-nu text-[12px] text-nu-pink flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  자세히 <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/projects"
            className="font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-paper/50 hover:text-nu-pink no-underline transition-colors border-[2px] border-nu-paper/20 px-6 py-3 hover:border-nu-pink inline-block"
          >
            모든 볼트 보기 &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
