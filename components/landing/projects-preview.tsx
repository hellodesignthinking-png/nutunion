import Link from "next/link";
import { Briefcase, Users, ArrowRight } from "lucide-react";

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
    <section className="py-20 px-8 bg-nu-ink">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink block mb-3">
            Collaboration
          </span>
          <h2 className="font-head text-4xl font-extrabold tracking-tight text-nu-paper">
            진행 중인 프로젝트
          </h2>
          <p className="text-nu-paper/40 mt-3 text-sm">
            크루들이 함께 만들어가는 프로젝트에 참여해보세요
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group bg-nu-graphite/50 border border-nu-paper/[0.08] p-6 no-underline hover:border-nu-pink/30 transition-all hover:translate-y-[-2px]"
            >
              <div className="flex items-center gap-2 mb-3">
                {p.category && (
                  <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 text-white ${catColors[p.category] || "bg-nu-gray"}`}>
                    {p.category}
                  </span>
                )}
                <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-green-900/50 text-green-400 px-2 py-0.5">
                  {p.status}
                </span>
              </div>
              <h3 className="font-head text-xl font-extrabold text-nu-paper group-hover:text-nu-pink transition-colors mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-nu-paper/40 line-clamp-2 mb-4">
                {p.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-mono-nu text-[10px] text-nu-paper/30 flex items-center gap-1">
                  <Users size={11} /> {p.memberCount}명 참여
                </span>
                <span className="font-mono-nu text-[10px] text-nu-pink flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  자세히 <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/projects"
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-paper/50 hover:text-nu-pink no-underline transition-colors"
          >
            모든 프로젝트 보기 &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
