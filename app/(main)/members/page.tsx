"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Users, Filter, Star, Crown, Award, Shield } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";

interface MemberItem {
  id: string;
  name: string | null;
  nickname: string;
  email: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  grade: string | null;
  can_create_crew: boolean;
  created_at: string;
}

const CAT_COLORS: Record<string, string> = {
  space: "bg-nu-blue", culture: "bg-nu-amber", platform: "bg-nu-ink", vibe: "bg-nu-pink",
};
const CAT_LABELS: Record<string, string> = {
  space: "공간", culture: "문화", platform: "플랫폼", vibe: "바이브",
};

const GRADE_INFO: Record<string, { label: string; color: string; icon: any }> = {
  admin:  { label: "최고관리자", color: "bg-nu-pink text-white",             icon: Shield },
  vip:    { label: "VIP",        color: "bg-nu-pink/10 text-nu-pink border border-nu-pink/20", icon: Crown },
  gold:   { label: "골드",       color: "bg-yellow-50 text-yellow-700 border border-yellow-200", icon: Star },
  silver: { label: "실버",       color: "bg-slate-50 text-slate-500 border border-slate-200",   icon: Star },
  bronze: { label: "브론즈",     color: "bg-amber-50 text-amber-600 border border-amber-200",   icon: Award },
};

function getGradeInfo(m: MemberItem) {
  if (m.role === "admin") return GRADE_INFO.admin;
  if (m.grade && GRADE_INFO[m.grade]) return GRADE_INFO[m.grade];
  if (m.can_create_crew) return GRADE_INFO.silver;
  return GRADE_INFO.bronze;
}

export default function MembersPage() {
  const [members, setMembers]   = useState<MemberItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, name, nickname, email, specialty, avatar_url, bio, role, grade, can_create_crew, created_at")
        .order("created_at", { ascending: false });

      // grade 없으면 can_create_crew로 추론
      setMembers((data || []).map((m: any) => ({
        ...m,
        grade: m.grade || (m.role === "admin" ? "vip" : m.can_create_crew ? "silver" : "bronze"),
      })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => members.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.nickname?.toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q);
    const matchSpecialty = specialty === "all" || m.specialty === specialty;
    const effectiveGrade = m.role === "admin" ? "admin" : (m.grade || "bronze");
    const matchGrade = gradeFilter === "all" || effectiveGrade === gradeFilter;
    return matchSearch && matchSpecialty && matchGrade;
  }), [members, search, specialty, gradeFilter]);

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero 
        category="Connect"
        title="Members"
        description="nutunion 커뮤니티의 동료들을 탐색하고 성장을 위한 연결을 시작하세요. 기획자, 개발자, 디렉터 등 다양한 Scene의 멤버들이 활동 중입니다."
      />

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
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
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}
            className="pl-9 pr-8 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none appearance-none cursor-pointer">
            <option value="all">전체 분야</option>
            <option value="space">공간</option>
            <option value="culture">문화</option>
            <option value="platform">플랫폼</option>
            <option value="vibe">바이브</option>
          </select>
        </div>
        <div className="relative">
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 pr-8 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none appearance-none cursor-pointer">
            <option value="all">전체 등급</option>
            <option value="admin">최고관리자</option>
            <option value="vip">VIP</option>
            <option value="gold">골드</option>
            <option value="silver">실버</option>
            <option value="bronze">브론즈</option>
          </select>
        </div>
      </div>

      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">
        {filtered.length}명 표시 / 전체 {members.length}명
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.06] p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-nu-cream shrink-0" />
                <div className="flex-1"><div className="h-4 w-24 bg-nu-cream mb-2" /><div className="h-3 w-32 bg-nu-cream" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const g = getGradeInfo(m);
            const GIcon = g.icon;
            return (
              <div key={m.id} className="bg-nu-white border border-nu-ink/[0.06] p-5 hover:border-nu-pink/30 hover:shadow-sm transition-all">
                <div className="flex items-start gap-4">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-nu-cream flex items-center justify-center font-head text-lg font-bold text-nu-ink shrink-0">
                      {(m.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{m.nickname}</p>
                      <span className={`inline-flex items-center gap-0.5 font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${g.color}`}>
                        <GIcon size={7} /> {g.label}
                      </span>
                    </div>
                    {m.name && <p className="text-xs text-nu-muted truncate">{m.name}</p>}
                    {m.specialty && (
                      <span className={`inline-block font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 text-white mt-2 ${CAT_COLORS[m.specialty] || "bg-nu-gray"}`}>
                        {CAT_LABELS[m.specialty] || m.specialty}
                      </span>
                    )}
                    {m.bio && <p className="text-xs text-nu-gray mt-2 line-clamp-2">{m.bio}</p>}
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
    </div>
  );
}
