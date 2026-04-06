"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Users, ArrowRight } from "lucide-react";

const filters = [
  { key: "all", label: "전체" },
  { key: "space", label: "Space" },
  { key: "culture", label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe", label: "Vibe" },
];

const catStyles: Record<string, { bg: string; gradient: string; accent: string }> = {
  space: { bg: "bg-nu-blue", gradient: "from-[#001a4d] to-[#003399]", accent: "border-nu-blue" },
  culture: { bg: "bg-nu-amber", gradient: "from-[#2a1800] to-[#5a3800]", accent: "border-nu-amber" },
  platform: { bg: "bg-nu-ink", gradient: "from-[#0a0a0a] to-[#1a1a1a]", accent: "border-nu-ink" },
  vibe: { bg: "bg-nu-pink", gradient: "from-[#330019] to-[#660033]", accent: "border-nu-pink" },
};

interface CrewItem {
  id: string;
  name: string;
  category: string;
  description: string;
  max_members: number;
  member_count: number;
  host_nickname: string;
  host_avatar: string | null;
  image_url: string | null;
  created_at: string;
  host_id: string;
}

export function CrewsGrid({ groups, userId }: { groups: CrewItem[]; userId?: string }) {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const router = useRouter();

  const filtered = filter === "all" ? groups : groups.filter((g) => g.category === filter);

  async function handleJoin(groupId: string, maxMembers: number, currentCount: number) {
    if (!userId) { router.push("/signup"); return; }
    const supabase = createClient();
    const status = currentCount >= maxMembers ? "waitlist" : "active";
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member", status });
    if (error) {
      if (error.code === "23505") toast.error("이미 가입한 크루입니다");
      else toast.error(error.message);
      return;
    }
    toast.success(status === "waitlist" ? "대기자 명단에 등록되었습니다" : "크루에 참여했습니다!");
    router.refresh();
  }

  return (
    <>
      {/* Filter + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] transition-colors ${
                filter === f.key
                  ? "bg-nu-ink border-nu-ink text-nu-paper"
                  : "bg-transparent border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView("grid")} className={`p-2 transition-colors ${view === "grid" ? "text-nu-ink" : "text-nu-muted"}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="7" height="7"/><rect x="9" width="7" height="7"/><rect y="9" width="7" height="7"/><rect x="9" y="9" width="7" height="7"/></svg>
          </button>
          <button onClick={() => setView("list")} className={`p-2 transition-colors ${view === "list" ? "text-nu-ink" : "text-nu-muted"}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="16" height="3"/><rect y="5" width="16" height="3"/><rect y="10" width="16" height="3"/><rect y="15" width="10" height="1"/></svg>
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-6">
        {filtered.length}개의 크루
      </p>

      {/* Grid view */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((g) => {
            const style = catStyles[g.category] || catStyles.platform;
            const pct = Math.min(Math.round((g.member_count / g.max_members) * 100), 100);

            return (
              <div key={g.id} className="group-card bg-nu-white border border-nu-ink/[0.06] overflow-hidden flex flex-col">
                {/* Card header visual */}
                <div className={`relative h-40 bg-gradient-to-br ${style.gradient} overflow-hidden`}>
                  {g.image_url ? (
                    <img src={g.image_url} alt={g.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  ) : (
                    <>
                      <div className="absolute inset-0 opacity-[0.05]" style={{
                        backgroundImage: 'radial-gradient(circle, #F4F1EA 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }} />
                      <div className="absolute bottom-4 right-4 font-head text-[60px] font-extrabold leading-none text-nu-paper/[0.06]">
                        {g.name.charAt(0)}
                      </div>
                    </>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 text-white ${style.bg}`}>
                      {g.category}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5 flex-1 flex flex-col">
                  <Link href={userId ? `/groups/${g.id}` : "/login"} className="no-underline block">
                    <h3 className="font-head text-lg font-extrabold text-nu-ink leading-tight mb-2 group-hover:text-nu-pink transition-colors">
                      {g.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-nu-gray leading-relaxed mb-4 flex-1 line-clamp-3">
                    {g.description}
                  </p>

                  {/* Host info */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold">
                      {g.host_nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-muted">
                      {g.host_nickname}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="progress-bar">
                      <div className={`progress-bar-fill ${style.bg}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                        <Users size={10} /> {g.member_count}/{g.max_members}
                      </span>
                      {pct >= 100 && <span className="font-mono-nu text-[9px] text-nu-red">FULL</span>}
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => handleJoin(g.id, g.max_members, g.member_count)}
                    className="w-full font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-3 border border-nu-ink/15 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors flex items-center justify-center gap-2"
                  >
                    {pct >= 100 ? "대기자 등록" : "참여하기"} <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="flex flex-col gap-3">
          {filtered.map((g) => {
            const style = catStyles[g.category] || catStyles.platform;
            return (
              <div key={g.id} className="group-card bg-nu-white border border-nu-ink/[0.06] p-5 flex items-center gap-5">
                {/* Mini visual */}
                <div className={`w-20 h-20 shrink-0 bg-gradient-to-br ${style.gradient} overflow-hidden relative`}>
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-head text-2xl font-extrabold text-nu-paper/10">
                      {g.name.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 text-white ${style.bg}`}>
                      {g.category}
                    </span>
                    <Link href={userId ? `/groups/${g.id}` : "/login"} className="font-head text-base font-extrabold text-nu-ink no-underline hover:text-nu-pink truncate">
                      {g.name}
                    </Link>
                  </div>
                  <p className="text-xs text-nu-gray truncate">{g.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="font-mono-nu text-[10px] text-nu-muted">by {g.host_nickname}</span>
                    <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1"><Users size={10} /> {g.member_count}/{g.max_members}</span>
                  </div>
                </div>
                {/* Action */}
                <button
                  onClick={() => handleJoin(g.id, g.max_members, g.member_count)}
                  className="shrink-0 font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] px-5 py-2.5 border border-nu-ink/15 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors"
                >
                  참여
                </button>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-nu-white border border-nu-ink/[0.06] p-12">
          <p className="text-nu-gray text-sm mb-4">해당 카테고리에 크루가 없습니다</p>
          <Link href={userId ? "/groups/create" : "/signup"} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline hover:underline">
            첫 번째 크루를 만들어보세요 &rarr;
          </Link>
        </div>
      )}
    </>
  );
}
