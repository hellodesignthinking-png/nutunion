"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Users, Filter } from "lucide-react";
import Link from "next/link";

interface MemberItem {
  id: string;
  name: string;
  nickname: string;
  email: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  can_create_crew: boolean;
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

export default function MembersPage() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, name, nickname, email, specialty, avatar_url, bio, role, can_create_crew, created_at")
        .order("created_at", { ascending: false });
      setMembers(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch = !search ||
        m.nickname?.toLowerCase().includes(search.toLowerCase()) ||
        m.name?.toLowerCase().includes(search.toLowerCase());
      const matchSpecialty = specialtyFilter === "all" || m.specialty === specialtyFilter;
      return matchSearch && matchSpecialty;
    });
  }, [members, search, specialtyFilter]);

  function getGrade(m: MemberItem) {
    if (m.role === "admin") return { label: "관리자", color: "bg-nu-pink text-white" };
    if (m.can_create_crew) return { label: "크루생성자", color: "bg-green-100 text-green-700" };
    return { label: "멤버", color: "bg-nu-cream text-nu-muted" };
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="mb-8">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">멤버 디렉토리</h1>
        <p className="text-nu-gray text-sm mt-1">nutunion 커뮤니티 멤버들을 찾아보세요</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            placeholder="이름 또는 닉네임으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-pink/40 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">전체 분야</option>
            <option value="space">공간</option>
            <option value="culture">문화</option>
            <option value="platform">플랫폼</option>
            <option value="vibe">바이브</option>
          </select>
        </div>
      </div>

      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">
        {filtered.length}명 표시 / 전체 {members.length}명
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.06] p-5 animate-pulse">
              <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-nu-cream" /><div className="flex-1"><div className="h-4 w-24 bg-nu-cream mb-2" /><div className="h-3 w-32 bg-nu-cream" /></div></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const grade = getGrade(m);
            return (
              <div key={m.id} className="bg-nu-white border border-nu-ink/[0.06] p-5 hover:border-nu-pink/20 transition-colors">
                <div className="flex items-start gap-4">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-nu-cream flex items-center justify-center font-head text-lg font-bold text-nu-ink shrink-0">
                      {(m.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{m.nickname}</p>
                      <span className={`font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${grade.color}`}>
                        {grade.label}
                      </span>
                    </div>
                    <p className="text-xs text-nu-muted truncate">{m.name}</p>
                    {m.specialty && (
                      <span className={`inline-block font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 text-white mt-2 ${catColors[m.specialty] || "bg-nu-gray"}`}>
                        {catLabels[m.specialty] || m.specialty}
                      </span>
                    )}
                    {m.bio && (
                      <p className="text-xs text-nu-gray mt-2 line-clamp-2">{m.bio}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.06] p-12 text-center">
          <Users size={24} className="mx-auto text-nu-muted mb-3" />
          <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
}
