"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Search, Filter, ExternalLink, Settings, ToggleLeft, ToggleRight, Users, Trash2 } from "lucide-react";
import Link from "next/link";

interface GroupItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  is_active: boolean;
  member_count: number;
  event_count: number;
  max_members: number;
  host_nickname: string;
  host_email: string;
  created_at: string;
}

const catColors: Record<string, string> = {
  space:    "bg-nu-blue text-white",
  culture:  "bg-nu-amber text-white",
  platform: "bg-nu-ink text-white",
  vibe:     "bg-nu-pink text-white",
};

const catLabels: Record<string, string> = {
  space: "공간", culture: "문화", platform: "플랫폼", vibe: "바이브",
};

export function AdminGroupList({ groups }: { groups: GroupItem[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localGroups, setLocalGroups] = useState(groups);
  const [actionId, setActionId] = useState<string | null>(null);

  const filtered = useMemo(() => localGroups.filter(g => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || g.name.toLowerCase().includes(q) || g.host_nickname.toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || g.category === categoryFilter;
    const matchStatus = statusFilter === "all"
      || (statusFilter === "active" && g.is_active)
      || (statusFilter === "inactive" && !g.is_active);
    return matchQ && matchCat && matchStatus;
  }), [localGroups, searchQuery, categoryFilter, statusFilter]);

  async function toggleActive(groupId: string, current: boolean) {
    setActionId(groupId);
    const supabase = createClient();
    const { error } = await supabase.from("groups").update({ is_active: !current }).eq("id", groupId);
    if (error) { toast.error(error.message); }
    else {
      setLocalGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_active: !current } : g));
      toast.success(current ? "소모임이 비활성화되었습니다" : "소모임이 활성화되었습니다");
    }
    setActionId(null);
  }

  async function forceDelete(groupId: string, groupName: string) {
    if (!confirm(`"${groupName}" 소모임을 완전히 삭제하시겠습니까?\n\n모든 회의, 멤버, 게시글, 자료, 일정 데이터가 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    setActionId(groupId);
    const supabase = createClient();

    // Delete related data first (some tables have CASCADE, but be thorough)
    // Order matters: delete child records before parent
    try {
      await supabase.from("meeting_notes").delete().in(
        "meeting_id",
        (await supabase.from("meetings").select("id").eq("group_id", groupId)).data?.map((m: any) => m.id) || []
      );
      await supabase.from("meeting_agendas").delete().in(
        "meeting_id",
        (await supabase.from("meetings").select("id").eq("group_id", groupId)).data?.map((m: any) => m.id) || []
      );
    } catch { /* tables may not exist */ }

    // Delete in order — each wrapped in try/catch for missing tables
    const tablesToClean = [
      { table: "meetings", column: "group_id" },
      { table: "events", column: "group_id" },
      { table: "crew_posts", column: "group_id" },
      { table: "group_members", column: "group_id" },
      { table: "file_attachments", column: "target_id", extraFilter: { target_type: "group" } },
      { table: "group_roadmap_phases", column: "group_id" },
    ];

    for (const { table, column, extraFilter } of tablesToClean) {
      try {
        let query = supabase.from(table).delete().eq(column, groupId);
        if (extraFilter) {
          for (const [k, v] of Object.entries(extraFilter)) {
            query = query.eq(k, v);
          }
        }
        await query;
      } catch { /* table may not exist */ }
    }

    // Finally delete the group itself
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      setLocalGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success("소모임이 완전히 삭제되었습니다");
    }
    setActionId(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="소모임 이름 또는 호스트로 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none cursor-pointer">
          <option value="all">전체 카테고리</option>
          {["space","culture","platform","vibe"].map(c => (
            <option key={c} value={c}>{catLabels[c]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none cursor-pointer">
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center whitespace-nowrap">
          {filtered.length}/{localGroups.length}개
        </p>
      </div>

      <div className="bg-nu-white border border-nu-ink/[0.08]">
        {/* Desktop table */}
        <table className="w-full hidden md:table">
          <thead>
            <tr className="border-b border-nu-ink/[0.08]">
              {["소모임","카테고리","호스트","멤버","상태","관리"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} className={`border-b border-nu-ink/[0.04] last:border-0 text-sm ${!g.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-[200px]">{g.name}</p>
                  <p className="text-[10px] text-nu-muted">{formatDate(g.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 ${catColors[g.category] || "bg-nu-gray text-white"}`}>
                    {catLabels[g.category] || g.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-nu-muted text-sm truncate max-w-[120px]">
                  {g.host_nickname}
                  <p className="text-[10px]">{g.host_email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm">
                    <Users size={12} className="text-nu-muted" />
                    <span className="font-mono-nu">{g.member_count}/{g.max_members}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {g.is_active
                    ? <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5">활성</span>
                    : <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-red bg-red-50 px-2 py-0.5">비활성</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/groups/${g.id}`}
                      className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors" title="상세보기">
                      <ExternalLink size={13} />
                    </Link>
                    <Link href={`/groups/${g.id}/settings`}
                      className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors" title="설정">
                      <Settings size={13} />
                    </Link>
                    <button onClick={() => toggleActive(g.id, g.is_active)} disabled={actionId === g.id}
                      className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors" title={g.is_active ? "비활성화" : "활성화"}>
                      {g.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => forceDelete(g.id, g.name)} disabled={actionId === g.id}
                      className="p-1.5 text-nu-muted hover:text-nu-red transition-colors" title="삭제">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-nu-ink/[0.06]">
          {filtered.map(g => (
            <div key={g.id} className={`p-4 ${!g.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 shrink-0 ${catColors[g.category] || "bg-nu-gray text-white"}`}>
                    {catLabels[g.category] || g.category}
                  </span>
                  <p className="font-medium text-sm truncate">{g.name}</p>
                </div>
                {g.is_active
                  ? <span className="font-mono-nu text-[9px] text-green-600 shrink-0">활성</span>
                  : <span className="font-mono-nu text-[9px] text-nu-red shrink-0">비활성</span>}
              </div>
              <p className="text-xs text-nu-muted mb-2">
                호스트: {g.host_nickname} | {g.member_count}/{g.max_members}명 | {formatDate(g.created_at)}
              </p>
              <div className="flex items-center gap-3">
                <Link href={`/groups/${g.id}`} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink">상세</Link>
                <Link href={`/groups/${g.id}/settings`} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink">설정</Link>
                <button onClick={() => toggleActive(g.id, g.is_active)} disabled={actionId === g.id}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline">
                  {g.is_active ? "비활성화" : "활성화"}
                </button>
                <button onClick={() => forceDelete(g.id, g.name)} disabled={actionId === g.id}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-red hover:underline">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
