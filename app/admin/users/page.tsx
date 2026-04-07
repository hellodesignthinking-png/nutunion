import { createClient } from "@/lib/supabase/server";
import { AdminUserList } from "@/components/admin/user-list";
import { Shield, Award, Star, Crown } from "lucide-react";

const GRADE_GUIDE = [
  {
    grade: "브론즈",
    icon: Award,
    color: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    badgeColor: "bg-amber-100 text-amber-700",
    desc: "가입 시 기본 부여 등급",
    perms: ["커뮤니티 참여", "소모임 가입 신청", "프로젝트 지원"],
    noperms: ["소모임 개설", "프로젝트 개설"],
  },
  {
    grade: "실버",
    icon: Star,
    color: "bg-slate-50 border-slate-200",
    iconColor: "text-slate-500",
    badgeColor: "bg-slate-100 text-slate-600",
    desc: "활성 멤버에게 부여되는 등급",
    perms: ["커뮤니티 참여", "소모임 가입 신청", "프로젝트 지원", "소모임 개설"],
    noperms: ["프로젝트 개설"],
  },
  {
    grade: "골드",
    icon: Star,
    color: "bg-yellow-50 border-yellow-200",
    iconColor: "text-yellow-500",
    badgeColor: "bg-yellow-100 text-yellow-700",
    desc: "핵심 기여자 등급",
    perms: ["커뮤니티 참여", "소모임 가입 신청", "프로젝트 지원", "소모임 개설", "프로젝트 개설"],
    noperms: [],
  },
  {
    grade: "VIP",
    icon: Crown,
    color: "bg-pink-50 border-pink-200",
    iconColor: "text-pink-500",
    badgeColor: "bg-pink-100 text-pink-600",
    desc: "최상위 파트너 및 핵심 멤버",
    perms: ["모든 권한 (골드 포함)", "우선 참여 기회", "특별 혜택"],
    noperms: [],
  },
  {
    grade: "관리자",
    icon: Shield,
    color: "bg-nu-pink/5 border-nu-pink/30",
    iconColor: "text-nu-pink",
    badgeColor: "bg-nu-pink text-white",
    desc: "플랫폼 전체 관리 권한",
    perms: ["모든 멤버 권한", "회원 등급 조정", "소모임 강제 관리", "프로젝트 강제 관리", "콘텐츠 관리"],
    noperms: [],
  },
];

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // select("*") — Supabase returns all columns that exist.
  // grade / can_create_project will be undefined if migration hasn't run yet,
  // but at least the user list won't be empty.
  const { data: users, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch crew memberships for all users
  const { data: memberships } = await supabase
    .from("group_members")
    .select("user_id, group_id, role, group:groups!group_members_group_id_fkey(name)")
    .eq("status", "active");

  // Build a map of user_id -> crews
  const crewMap: Record<string, { group_id: string; group_name: string; role: string }[]> = {};
  (memberships || []).forEach((m: any) => {
    if (!crewMap[m.user_id]) crewMap[m.user_id] = [];
    crewMap[m.user_id].push({
      group_id: m.group_id,
      group_name: m.group?.name || "unknown",
      role: m.role,
    });
  });

  const usersWithCrews = (users || []).map((u: any) => ({
    ...u,
    grade: u.grade || "bronze",
    can_create_project: u.can_create_project ?? false,
    crews: crewMap[u.id] || [],
  }));

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">회원 관리</h1>
          <p className="text-nu-gray text-sm mt-1">
            {usersWithCrews.length}명의 회원이 등록되어 있습니다
            {error && <span className="text-nu-red ml-2">(쿼리 오류 — SQL 마이그레이션 확인 필요)</span>}
          </p>
        </div>
      </div>

      {/* Grade Guide */}
      <div className="mb-8 mt-6">
        <h2 className="font-head text-lg font-extrabold text-nu-ink mb-4 flex items-center gap-2">
          <Shield size={18} className="text-nu-pink" />
          등급 안내
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {GRADE_GUIDE.map((g) => (
            <div key={g.grade} className={`border p-4 rounded-none ${g.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <g.icon size={16} className={g.iconColor} />
                <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 font-bold ${g.badgeColor}`}>
                  {g.grade}
                </span>
              </div>
              <p className="text-xs text-nu-muted mb-3">{g.desc}</p>
              <ul className="space-y-1">
                {g.perms.map((p) => (
                  <li key={p} className="text-[11px] text-nu-ink flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                    {p}
                  </li>
                ))}
                {g.noperms.map((p) => (
                  <li key={p} className="text-[11px] text-nu-muted/60 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">✗</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <AdminUserList users={usersWithCrews} />
    </div>
  );
}
