"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Filter } from "lucide-react";
import type { Profile } from "@/lib/types";

interface UserWithCrews extends Profile {
  crews?: { group_id: string; group_name: string; role: string }[];
}

export function AdminUserList({ users }: { users: UserWithCrews[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const catLabels: Record<string, string> = {
    space: "공간",
    culture: "문화",
    platform: "플랫폼",
    vibe: "바이브",
  };

  const specialties = ["all", "space", "culture", "platform", "vibe"];

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        (u.nickname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty =
        specialtyFilter === "all" || u.specialty === specialtyFilter;
      return matchesSearch && matchesSpecialty;
    });
  }, [users, searchQuery, specialtyFilter]);

  async function toggleCrewPermission(userId: string, currentValue: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ can_create_crew: !currentValue })
      .eq("id", userId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`크루 생성 권한이 ${!currentValue ? "부여" : "해제"}되었습니다`);
    router.refresh();
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "member" : "admin";
    if (!confirm(`이 사용자의 역할을 ${newRole}로 변경하시겠습니까?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`역할이 ${newRole}로 변경되었습니다`);
    router.refresh();
  }

  function getGradeBadge(user: Profile) {
    if (user.role === "admin") {
      return (
        <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 inline-block">
          관리자
        </span>
      );
    }
    if (user.can_create_crew) {
      return (
        <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-blue/10 text-nu-blue px-2 py-0.5 inline-block">
          크루생성가능
        </span>
      );
    }
    return (
      <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-muted px-2 py-0.5 inline-block">
        일반
      </span>
    );
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
            placeholder="닉네임 또는 이메일로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 appearance-none cursor-pointer"
          >
            <option value="all">전체 분야</option>
            {specialties.filter((s) => s !== "all").map((s) => (
              <option key={s} value={s}>{catLabels[s] || s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">
        {filteredUsers.length}명 표시 / 전체 {users.length}명
      </p>

      <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
        {/* Desktop table */}
        <table className="w-full hidden md:table" role="table">
          <thead>
            <tr className="border-b border-nu-ink/[0.08]">
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">회원</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">이메일</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">분야</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">등급</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">가입일</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">크루 생성</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <>
                <tr
                  key={u.id}
                  className="border-b border-nu-ink/[0.04] last:border-0 text-sm cursor-pointer hover:bg-nu-ink/[0.02] transition-colors"
                  onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-mono-nu text-[10px] text-nu-muted uppercase">
                            {(u.nickname || u.email || "?").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.nickname || "unnamed"}</p>
                        <p className="text-[11px] text-nu-muted truncate">{u.name}</p>
                      </div>
                      {expandedUserId === u.id ? (
                        <ChevronUp size={14} className="text-nu-muted shrink-0" />
                      ) : (
                        <ChevronDown size={14} className="text-nu-muted shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-nu-muted truncate max-w-[180px]">{u.email}</td>
                  <td className="px-5 py-3 text-nu-muted capitalize">
                    {u.specialty ? catLabels[u.specialty] || u.specialty : "-"}
                  </td>
                  <td className="px-5 py-3">{getGradeBadge(u)}</td>
                  <td className="px-5 py-3 font-mono-nu text-[11px] text-nu-muted">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleCrewPermission(u.id, u.can_create_crew)}
                      className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 ${u.can_create_crew ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-nu-ink/5 text-nu-muted hover:bg-nu-ink/10"} transition-colors`}
                    >
                      {u.can_create_crew ? "허용" : "불가"}
                    </button>
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleRole(u.id, u.role)}
                      className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline"
                    >
                      변경
                    </button>
                  </td>
                </tr>
                {expandedUserId === u.id && (
                  <tr key={`${u.id}-detail`} className="border-b border-nu-ink/[0.04]">
                    <td colSpan={7} className="px-5 py-4 bg-nu-cream/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">닉네임</p>
                          <p>{u.nickname || "-"}</p>
                        </div>
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">이메일</p>
                          <p>{u.email}</p>
                        </div>
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">분야</p>
                          <p>{u.specialty ? catLabels[u.specialty] || u.specialty : "-"}</p>
                        </div>
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">자기소개</p>
                          <p className="text-nu-graphite">{u.bio || "-"}</p>
                        </div>
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">가입일시</p>
                          <p>{new Date(u.created_at).toLocaleString("ko")}</p>
                        </div>
                        <div>
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">소속 크루</p>
                          {u.crews && u.crews.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.crews.map((c) => (
                                <span key={c.group_id} className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-2 py-0.5">
                                  {c.group_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-nu-muted">없음</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-nu-ink/[0.06]">
          {filteredUsers.map((u) => (
            <div key={u.id}>
              <div
                className="p-4 flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono-nu text-[10px] text-nu-muted uppercase">
                        {(u.nickname || u.email || "?").charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{u.nickname || "unnamed"}</p>
                      {getGradeBadge(u)}
                    </div>
                    <p className="text-xs text-nu-muted truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-nu text-[10px] text-nu-muted">{formatDate(u.created_at)}</span>
                  {expandedUserId === u.id ? (
                    <ChevronUp size={14} className="text-nu-muted" />
                  ) : (
                    <ChevronDown size={14} className="text-nu-muted" />
                  )}
                </div>
              </div>
              {expandedUserId === u.id && (
                <div className="px-4 pb-4 bg-nu-cream/30">
                  <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                    <div>
                      <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">분야</p>
                      <p>{u.specialty ? catLabels[u.specialty] || u.specialty : "-"}</p>
                    </div>
                    <div>
                      <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">자기소개</p>
                      <p className="truncate">{u.bio || "-"}</p>
                    </div>
                    <div>
                      <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">소속 크루</p>
                      {u.crews && u.crews.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.crews.map((c) => (
                            <span key={c.group_id} className="font-mono-nu text-[8px] bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">
                              {c.group_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-nu-muted">없음</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCrewPermission(u.id, u.can_create_crew); }}
                      className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 ${u.can_create_crew ? "bg-green-100 text-green-700" : "bg-nu-ink/5 text-nu-muted"} transition-colors`}
                    >
                      {u.can_create_crew ? "크루생성 허용" : "크루생성 불가"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRole(u.id, u.role); }}
                      className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline"
                    >
                      역할 변경
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
