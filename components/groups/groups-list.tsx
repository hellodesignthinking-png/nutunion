"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Search, Users, Lock, ArrowUpRight, Grid, List, Loader2 } from "lucide-react";

const FILTERS = [
  { key: "all",      label: "전체" },
  { key: "space",    label: "Space" },
  { key: "culture",  label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe",     label: "Vibe" },
];

const CAT: Record<string, { bg: string; text: string; bar: string; label: string; gradient: string }> = {
  space:    { bg: "bg-nu-blue",  text: "text-white",    bar: "bg-nu-blue",  label: "공간", gradient: "from-[#001a4d] to-[#003399]" },
  culture:  { bg: "bg-nu-amber", text: "text-white",    bar: "bg-nu-amber", label: "문화", gradient: "from-[#2a1800] to-[#5a3800]" },
  platform: { bg: "bg-nu-ink",   text: "text-nu-paper", bar: "bg-nu-ink",   label: "플랫폼", gradient: "from-[#0a0a0a] to-[#1a1a1a]" },
  vibe:     { bg: "bg-nu-pink",  text: "text-white",    bar: "bg-nu-pink",  label: "바이브", gradient: "from-[#330019] to-[#660033]" },
};

interface GroupItem {
  id: string;
  name: string;
  category: string;
  description: string;
  max_members: number;
  member_count: number;
  host_nickname: string;
  host_id: string;
  image_url?: string;
  user_status?: "active" | "pending" | "waitlist" | null;
}

export function GroupsList({ groups, userId }: { groups: GroupItem[]; userId?: string }) {
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState<"grid" | "list">("grid");
  const [joining, setJoining]   = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() =>
    groups.filter((g) => {
      if (filter !== "all" && g.category !== filter) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.description?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }), [groups, filter, search]);

  async function handleJoin(g: GroupItem) {
    if (!userId) { router.push("/login"); return; }
    if (joining || g.user_status) return; // 이미 상태가 있으면 클릭 불가
    setJoining(g.id);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("group_members")
      .select("id, status")
      .eq("group_id", g.id)
      .eq("user_id", userId)
      .single();

    if (existing) {
      const msg = existing.status === "pending"
        ? "이미 가입 승인 대기 중입니다"
        : existing.status === "active"
        ? "이미 가입한 소모임입니다"
        : "이미 대기자 명단에 있습니다";
      toast.error(msg);
      setJoining(null);
      return;
    }

    const isFull = g.member_count >= g.max_members;
    const status = isFull ? "waitlist" : "pending";

    const { error } = await supabase.from("group_members").insert({
      group_id: g.id,
      user_id: userId,
      role: "member",
      status,
    });

    if (error) {
      toast.error(error.code === "23505" ? "이미 신청했습니다" : error.message);
    } else {
      toast.success(
        isFull
          ? "대기자 명단에 등록되었습니다"
          : "가입 신청을 전송했습니다! 호스트의 승인을 기다려주세요"
      );
      router.refresh();
    }
    setJoining(null);
  }

  function getButtonLabel(g: GroupItem, isJoining: boolean) {
    if (isJoining) return "요청 중...";
    if (g.user_status === "active") return "가입 완료";
    if (g.user_status === "pending") return "승인 중";
    if (g.user_status === "waitlist") return "대기 중";
    return "가입 신청";
  }

  return (
    <>
      {/* ── 검색 + 필터 + 토글 ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              type="text"
              placeholder="소모임 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-nu-ink/10 bg-nu-white focus:outline-none focus:border-nu-pink/40"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border transition-colors ${
                  filter === f.key
                    ? "bg-nu-ink border-nu-ink text-nu-paper font-bold"
                    : "bg-white border-nu-ink/10 text-nu-graphite hover:border-nu-ink/20"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 border-l border-nu-ink/10 pl-4 hidden sm:flex">
          <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "text-nu-pink" : "text-nu-muted"}`} aria-label="Grid view">
            <Grid size={18} />
          </button>
          <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "text-nu-pink" : "text-nu-muted"}`} aria-label="List view">
            <List size={18} />
          </button>
        </div>
      </div>

      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-6">
        {filtered.length} RESULTS
      </p>

      {/* ── 카드 리스트/그리드 ─────────────────────────────────────── */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((g) => {
            const cat    = CAT[g.category] || CAT.platform;
            const pct    = g.max_members ? Math.min(Math.round((g.member_count / g.max_members) * 100), 100) : 0;
            const isFull = g.member_count >= g.max_members;
            const isHost = g.host_id === userId;
            const isJoining = joining === g.id;

            return (
              <div key={g.id} className="bg-nu-white border border-nu-ink/[0.08] flex flex-col group overflow-hidden hover:shadow-xl hover:shadow-nu-ink/5 transition-all">
                {/* Header Visual */}
                <div className={`h-32 relative overflow-hidden bg-gradient-to-br ${cat.gradient}`}>
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
                  <span className={`absolute top-4 left-4 font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 ${cat.bg} ${cat.text} shadow-lg shadow-black/10`}>
                    {cat.label}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex-1">
                    <Link href={`/groups/${g.id}`} className="no-underline block">
                      <h3 className="font-head text-lg font-extrabold text-nu-ink mb-1.5 group-hover:text-nu-pink transition-colors">
                        {g.name}
                      </h3>
                      <p className="text-xs text-nu-gray leading-relaxed line-clamp-2 mb-4">
                        {g.description || "이 소모임에 대한 설명이 아직 없습니다."}
                      </p>
                    </Link>
                  </div>

                  <div className="mb-4">
                    <div className="h-1.5 bg-nu-ink/5 overflow-hidden mb-1.5">
                      <div className={`h-full ${cat.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-nu-muted">
                      <span className="font-mono-nu text-[10px] flex items-center gap-1.5">
                        <Users size={12} /> {g.member_count}/{g.max_members}
                      </span>
                      {isFull && <span className="font-mono-nu text-[9px] text-nu-red flex items-center gap-1"><Lock size={10} /> FULL</span>}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-nu-ink/[0.05] flex items-center justify-between">
                    <span className="font-mono-nu text-[10px] text-nu-muted">by {g.host_nickname}</span>
                    {isHost ? (
                      <Link href={`/groups/${g.id}/settings`} className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1">
                         MANAGE <ArrowUpRight size={10} />
                      </Link>
                    ) : (
                      <button 
                        onClick={() => handleJoin(g)} 
                        disabled={isJoining || !!g.user_status} 
                        className={`font-mono-nu text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-70 ${
                          g.user_status === "active" ? "text-green-600" : 
                          g.user_status === "pending" ? "text-nu-amber" : "text-nu-ink hover:text-nu-pink"
                        }`}
                      >
                        {getButtonLabel(g, isJoining)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="flex flex-col gap-3">
          {filtered.map((g) => {
            const cat = CAT[g.category] || CAT.platform;
            const isJoining = joining === g.id;
            const isHost = g.host_id === userId;
            return (
              <div key={g.id} className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-5 hover:border-nu-pink/30 transition-all">
                <div className={`w-16 h-16 shrink-0 relative overflow-hidden ${cat.bg} bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="font-head text-2xl font-black text-white/20 capitalize">{g.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 ${cat.bg} ${cat.text}`}>
                      {cat.label}
                    </span>
                    <Link href={`/groups/${g.id}`} className="font-head text-base font-extrabold text-nu-ink no-underline hover:text-nu-pink truncate">
                      {g.name}
                    </Link>
                  </div>
                  <p className="text-xs text-nu-gray truncate max-w-xl">{g.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono-nu text-[10px] text-nu-muted mb-1">{g.member_count}/{g.max_members} 멤버</p>
                  {isHost ? (
                    <Link href={`/groups/${g.id}/settings`} className="text-[10px] font-bold text-nu-pink no-underline uppercase tracking-wider">MANAGE</Link>
                  ) : (
                    <button 
                      onClick={() => handleJoin(g)} 
                      disabled={isJoining || !!g.user_status} 
                      className={`text-[10px] font-bold disabled:opacity-70 transition-colors ${
                        g.user_status === "active" ? "text-green-600" : 
                        g.user_status === "pending" ? "text-nu-amber" : "text-nu-ink hover:text-nu-pink"
                      }`}
                    >
                      {getButtonLabel(g, isJoining)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.06] p-20 text-center">
          <Search size={32} className="mx-auto text-nu-muted/20 mb-4" />
          <p className="text-nu-gray font-medium">검색 결과가 없습니다</p>
          <p className="text-nu-muted text-xs mt-1">다른 키워드나 하위 카테고리로 필터링해보세요</p>
        </div>
      )}
    </>
  );
}
