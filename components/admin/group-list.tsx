"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Search, Filter, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";

interface GroupItem {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  member_count: number;
  event_count: number;
  max_members: number;
  host_nickname: string;
  host_email: string;
  created_at: string;
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const catLabels: Record<string, string> = {
  space: "공간",
  culture: "문화",
  platform: "플랫폼",
  vibe: "바이브",
};

export function AdminGroupList({ groups }: { groups: GroupItem[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch =
        !searchQuery ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.host_nickname.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || g.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [groups, searchQuery, categoryFilter]);

  async function toggleActive(groupId: string, currentState: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("groups")
      .update({ is_active: !currentState })
      .eq("id", groupId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(currentState ? "소모임이 비활성화되었습니다" : "소모임이 활성화되었습니다");
    router.refresh();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ko", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            placeholder="소모임 이름 또는 호스트로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 appearance-none cursor-pointer"
          >
            <option value="all">전체 카테고리</option>
            {["space", "culture", "platform", "vibe"].map((c) => (
              <option key={c} value={c}>{catLabels[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">
        {filteredGroups.length}개 표시 / 전체 {groups.length}개
      </p>

      <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
        {/* Desktop table */}
        <table className="w-full hidden md:table" role="table">
          <thead>
            <tr className="border-b border-nu-ink/[0.08]">
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">소모임</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">카테고리</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">호스트</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">멤버</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">일정</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">개설일</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">상태</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((g) => (
              <tr key={g.id} className={`border-b border-nu-ink/[0.04] last:border-0 text-sm ${!g.is_active ? "opacity-50" : ""}`}>
                <td className="px-5 py-3 font-medium truncate max-w-[200px]">{g.name}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${catColors[g.category] || "bg-nu-gray"}`}>
                    {catLabels[g.category] || g.category}
                  </span>
                </td>
                <td className="px-5 py-3 text-nu-muted truncate max-w-[120px]">{g.host_nickname}</td>
                <td className="px-5 py-3 font-mono-nu text-[11px]">{g.member_count}/{g.max_members}</td>
                <td className="px-5 py-3 font-mono-nu text-[11px] text-nu-muted">{g.event_count}</td>
                <td className="px-5 py-3 font-mono-nu text-[11px] text-nu-muted">{formatDate(g.created_at)}</td>
                <td className="px-5 py-3">
                  {g.is_active ? (
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-600">활성</span>
                  ) : (
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-red">비활성</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/crews/${g.id}`}
                      className="text-nu-muted hover:text-nu-ink transition-colors p-1"
                      title="상세보기"
                    >
                      <ExternalLink size={13} />
                    </Link>
                    <Link
                      href={`/crews/${g.id}/settings`}
                      className="text-nu-muted hover:text-nu-ink transition-colors p-1"
                      title="설정"
                    >
                      <Settings size={13} />
                    </Link>
                    <button
                      onClick={() => toggleActive(g.id, g.is_active)}
                      className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline"
                    >
                      {g.is_active ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-nu-ink/[0.06]">
          {filteredGroups.map((g) => (
            <div key={g.id} className={`p-4 ${!g.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${catColors[g.category] || "bg-nu-gray"}`}>
                    {catLabels[g.category] || g.category}
                  </span>
                  <span className="font-medium text-sm truncate">{g.name}</span>
                </div>
                {g.is_active ? (
                  <span className="font-mono-nu text-[9px] text-green-600 shrink-0">활성</span>
                ) : (
                  <span className="font-mono-nu text-[9px] text-nu-red shrink-0">비활성</span>
                )}
              </div>
              <div className="text-xs text-nu-muted mb-2">
                호스트: {g.host_nickname} | {g.member_count}/{g.max_members}명 | 일정 {g.event_count}개 | {formatDate(g.created_at)}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/crews/${g.id}`}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink"
                >
                  상세보기
                </Link>
                <Link
                  href={`/crews/${g.id}/settings`}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink"
                >
                  설정
                </Link>
                <button
                  onClick={() => toggleActive(g.id, g.is_active)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline"
                >
                  {g.is_active ? "비활성화" : "활성화"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
