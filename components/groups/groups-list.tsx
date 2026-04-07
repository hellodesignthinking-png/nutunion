"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Search, Users, Lock, ArrowUpRight } from "lucide-react";

const FILTERS = [
  { key: "all",      label: "전체" },
  { key: "space",    label: "Space" },
  { key: "culture",  label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe",     label: "Vibe" },
];

const CAT: Record<string, { bg: string; text: string; bar: string; label: string }> = {
  space:    { bg: "bg-nu-blue",  text: "text-white",    bar: "bg-nu-blue",  label: "공간" },
  culture:  { bg: "bg-nu-amber", text: "text-white",    bar: "bg-nu-amber", label: "문화" },
  platform: { bg: "bg-nu-ink",   text: "text-nu-paper", bar: "bg-nu-ink",   label: "플랫폼" },
  vibe:     { bg: "bg-nu-pink",  text: "text-white",    bar: "bg-nu-pink",  label: "바이브" },
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
}

export function GroupsList({ groups, userId }: { groups: GroupItem[]; userId?: string }) {
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
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
    if (joining) return;
    setJoining(g.id);
    const supabase = createClient();

    // 이미 가입/대기 중인지 확인
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

    // 정원 초과 → waitlist, 여유 → pending (호스트 승인 필요)
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

  return (
    <>
      {/* ── 검색 + 필터 ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            placeholder="소모임 이름 또는 설명으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-pink/40 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2.5 border-[1.5px] transition-colors ${
                filter === f.key
                  ? "bg-nu-ink border-nu-ink text-nu-paper"
                  : "bg-transparent border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-5">
        {filtered.length}개의 소모임
      </p>

      {/* ── 카드 그리드 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((g) => {
          const cat   = CAT[g.category] || CAT.platform;
          const pct   = g.max_members ? Math.min(Math.round((g.member_count / g.max_members) * 100), 100) : 0;
          const isFull = g.member_count >= g.max_members;
          const isHost = g.host_id === userId;
          const isJoining = joining === g.id;

          return (
            <div key={g.id}
              className="bg-nu-white border border-nu-ink/[0.08] flex flex-col hover:border-nu-pink/30 hover:shadow-sm transition-all group overflow-hidden">
              {/* 카테고리 컬러 바 */}
              <div className={`h-1 w-full ${cat.bar}`} />

              <div className="p-5 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <span className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                  <span className="font-mono-nu text-[10px] text-nu-muted">by {g.host_nickname}</span>
                </div>

                {/* Title + desc */}
                <Link href={`/groups/${g.id}`} className="no-underline block flex-1">
                  <h3 className="font-head text-lg font-extrabold text-nu-ink leading-tight mb-2 group-hover:text-nu-pink transition-colors">
                    {g.name}
                  </h3>
                  <p className="text-xs text-nu-gray leading-relaxed line-clamp-2 mb-4">
                    {g.description || "소모임 소개가 없습니다"}
                  </p>
                </Link>

                {/* 정원 바 */}
                <div className="mb-4">
                  <div className="h-1.5 bg-nu-ink/5 overflow-hidden mb-1">
                    <div className={`h-full ${cat.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                      <Users size={10} /> {g.member_count}/{g.max_members}명
                    </span>
                    {isFull && (
                      <span className="font-mono-nu text-[9px] text-nu-red flex items-center gap-0.5">
                        <Lock size={9} /> 정원 초과
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                {isHost ? (
                  <Link href={`/groups/${g.id}/settings`}
                    className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-2.5 border border-nu-pink/40 text-nu-pink no-underline block hover:bg-nu-pink hover:text-white transition-colors flex items-center justify-center gap-1.5">
                    <ArrowUpRight size={12} /> 관리하기
                  </Link>
                ) : (
                  <button
                    onClick={() => handleJoin(g)}
                    disabled={isJoining}
                    className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-2.5 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors w-full disabled:opacity-50">
                    {isJoining ? "신청 중..." : isFull ? "대기자 등록" : "가입 신청"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.06] p-16 text-center">
          <Search size={28} className="mx-auto text-nu-muted/30 mb-3" />
          <p className="text-nu-gray">해당 조건에 맞는 소모임이 없습니다</p>
        </div>
      )}
    </>
  );
}
