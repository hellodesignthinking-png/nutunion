"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Search,
  SearchX,
  Users,
  Lock,
  ArrowUpRight,
  Grid,
  List,
  Loader2,
  Plus,
  Check,
  Clock,
} from "lucide-react";

const FILTERS = [
  { key: "all",      label: "전체" },
  { key: "space",    label: "Space" },
  { key: "culture",  label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe",     label: "Vibe" },
];

const SORTS = [
  { key: "newest",  label: "최신순" },
  { key: "popular", label: "인기순" },
  { key: "name",    label: "이름순" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

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
  host_avatar_url?: string | null;
  image_url?: string;
  created_at?: string;
  user_status?: "active" | "pending" | "waitlist" | null;
}

function capacityBarColor(pct: number): string {
  if (pct > 80) return "bg-nu-pink";
  if (pct > 60) return "bg-nu-amber";
  return "bg-nu-blue";
}

function HostAvatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-5 h-5 rounded-full border border-nu-ink/10 object-cover"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-nu-ink/10 flex items-center justify-center font-mono-nu text-[8px] font-bold uppercase text-nu-ink/50">
      {name.charAt(0)}
    </span>
  );
}

export function GroupsList({ groups, userId }: { groups: GroupItem[]; userId?: string }) {
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [sort, setSort]         = useState<SortKey>("newest");
  const [view, setView]         = useState<"grid" | "list">("grid");
  const [joining, setJoining]   = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const base = groups.filter((g) => {
      if (filter !== "all" && g.category !== filter) return false;
      if (
        search &&
        !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !g.description?.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });

    const sorted = [...base];
    switch (sort) {
      case "popular":
        sorted.sort((a, b) => b.member_count - a.member_count);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => {
          if (!a.created_at || !b.created_at) return 0;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;
    }
    return sorted;
  }, [groups, filter, search, sort]);

  function resetFilters() {
    setFilter("all");
    setSearch("");
    setSort("newest");
  }

  async function handleJoin(g: GroupItem) {
    if (!userId) { router.push("/login"); return; }
    if (joining || g.user_status) return;
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
        ? "이미 가입한 너트입니다"
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

  function StatusButton({ g, isJoining }: { g: GroupItem; isJoining: boolean }) {
    if (isJoining) {
      return (
        <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-ink/50 flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin" /> 요청 중...
        </span>
      );
    }
    if (g.user_status === "active") {
      return (
        <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-green-600 flex items-center gap-1.5">
          <Check size={10} /> 참여중
        </span>
      );
    }
    if (g.user_status === "pending") {
      return (
        <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-amber flex items-center gap-1.5">
          <Clock size={10} /> 승인 대기
        </span>
      );
    }
    if (g.user_status === "waitlist") {
      return (
        <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-muted flex items-center gap-1.5">
          <Users size={10} /> 대기 중 (인원 마감)
        </span>
      );
    }
    return (
      <button
        onClick={() => handleJoin(g)}
        className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-ink hover:text-nu-pink transition-colors flex items-center gap-1.5"
      >
        <Plus size={10} /> 참여하기
      </button>
    );
  }

  return (
    <>
      {/* -- Search + Filter + Sort + View Toggle -- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              type="text"
              placeholder="너트 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border-[2px] border-nu-ink/10 focus:border-nu-pink bg-transparent font-mono-nu placeholder:text-nu-ink/30 focus:outline-none"
            />
          </div>
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border-[2px] transition-colors ${
                  filter === f.key
                    ? "bg-nu-ink border-nu-ink text-nu-paper font-bold"
                    : "bg-white border-nu-ink/10 text-nu-graphite hover:border-nu-ink/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort + View toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`text-[11px] font-mono-nu uppercase tracking-wider px-3 py-1.5 border-[2px] transition-colors ${
                  sort === s.key
                    ? "bg-nu-ink border-nu-ink text-nu-paper font-bold"
                    : "border-nu-ink/10 text-nu-muted hover:border-nu-ink/20"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-l-[2px] border-nu-ink/10 pl-4 hidden sm:flex">
            <button
              onClick={() => setView("grid")}
              className={`p-2 ${view === "grid" ? "text-nu-pink" : "text-nu-muted"}`}
              aria-label="그리드 보기"
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 ${view === "list" ? "text-nu-pink" : "text-nu-muted"}`}
              aria-label="리스트 보기"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-6">
        {filtered.length} RESULTS
      </p>

      {/* -- Card Grid / List -- */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((g) => {
            const cat    = CAT[g.category] || CAT.platform;
            const pct    = g.max_members ? Math.min(Math.round((g.member_count / g.max_members) * 100), 100) : 0;
            const isFull = g.member_count >= g.max_members;
            const isHost = g.host_id === userId;
            const isJoining = joining === g.id;

            return (
              <div key={g.id} className="bg-nu-white border-[2px] border-nu-ink/[0.08] flex flex-col group overflow-hidden hover:shadow-xl hover:shadow-nu-ink/5 transition-all">
                {/* Header Visual */}
                <div className={`h-32 relative overflow-hidden bg-gradient-to-br ${cat.gradient}`}>
                  {g.image_url ? (
                    <Image src={g.image_url} alt="" fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
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
                    <Link href={`/groups/${g.id}`} className="no-underline block" prefetch={true}>
                      <h3 className="font-head text-lg font-extrabold text-nu-ink mb-1.5 group-hover:text-nu-pink transition-colors">
                        {g.name}
                      </h3>
                      <p className="text-xs text-nu-gray leading-relaxed line-clamp-2 mb-4">
                        {g.description || "이 너트에 대한 설명이 아직 없습니다."}
                      </p>
                    </Link>
                  </div>

                  {/* Capacity indicator */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono-nu text-[11px] font-bold text-nu-ink flex items-center gap-1.5">
                        <Users size={12} className="text-nu-muted" />
                        {g.member_count}/{g.max_members}명
                      </span>
                      {isFull && (
                        <span className="font-mono-nu text-[9px] font-bold text-nu-red flex items-center gap-1 uppercase tracking-wider">
                          <Lock size={10} /> FULL
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-nu-ink/5 overflow-hidden border border-nu-ink/[0.06]">
                      <div
                        className={`h-full ${capacityBarColor(pct)} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer: host info + action */}
                  <div className="pt-4 border-t-[2px] border-nu-ink/[0.05] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HostAvatar src={g.host_avatar_url} name={g.host_nickname} />
                      <span className="font-mono-nu text-[10px] text-nu-muted">{g.host_nickname}</span>
                    </div>
                    {isHost ? (
                      <Link
                        href={`/groups/${g.id}/settings`}
                        className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1"
                        prefetch={true}
                      >
                        MANAGE <ArrowUpRight size={10} />
                      </Link>
                    ) : (
                      <StatusButton g={g} isJoining={isJoining} />
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
            const pct = g.max_members ? Math.min(Math.round((g.member_count / g.max_members) * 100), 100) : 0;
            const isJoining = joining === g.id;
            const isHost = g.host_id === userId;
            return (
              <div key={g.id} className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4 flex items-center gap-5 hover:border-nu-pink/30 transition-all">
                <div className={`w-16 h-16 shrink-0 relative overflow-hidden ${cat.bg} bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                  {g.image_url ? (
                    <Image src={g.image_url} alt="" fill className="object-cover" sizes="64px" />
                  ) : (
                    <span className="font-head text-2xl font-black text-white/20 capitalize">{g.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 ${cat.bg} ${cat.text}`}>
                      {cat.label}
                    </span>
                    <Link href={`/groups/${g.id}`} className="font-head text-base font-extrabold text-nu-ink no-underline hover:text-nu-pink truncate" prefetch={true}>
                      {g.name}
                    </Link>
                  </div>
                  <p className="text-xs text-nu-gray truncate max-w-xl mb-1.5">{g.description}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <HostAvatar src={g.host_avatar_url} name={g.host_nickname} />
                      <span className="font-mono-nu text-[10px] text-nu-muted">{g.host_nickname}</span>
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-muted">
                      {g.member_count}/{g.max_members}명
                    </span>
                    <div className="w-16 h-1.5 bg-nu-ink/5 overflow-hidden">
                      <div className={`h-full ${capacityBarColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isHost ? (
                    <Link href={`/groups/${g.id}/settings`} className="text-[10px] font-bold text-nu-pink no-underline uppercase tracking-wider" prefetch={true}>MANAGE</Link>
                  ) : (
                    <StatusButton g={g} isJoining={isJoining} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- Empty state -- */}
      {filtered.length === 0 && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.06] p-20 text-center">
          <SearchX size={40} className="mx-auto text-nu-muted/20 mb-5" />
          <p className="font-head text-lg font-extrabold text-nu-ink mb-1">검색 결과가 없습니다</p>
          <p className="text-nu-muted text-xs mt-1 mb-6">다른 키워드나 카테고리로 검색해보세요</p>
          <button
            onClick={resetFilters}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors"
          >
            모든 너트 보기
          </button>
        </div>
      )}
    </>
  );
}
