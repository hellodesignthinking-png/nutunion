import { createClient } from "@/lib/supabase/server";
import { AdminUserList } from "@/components/admin/user-list";
import { Shield, Award, Star, Crown, AlertTriangle } from "lucide-react";

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

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch crew memberships
  const { data: memberships } = await supabase
    .from("group_members")
    .select("user_id, group_id, role, group:groups!group_members_group_id_fkey(name)")
    .eq("status", "active");

  const crewMap: Record<string, { group_id: string; group_name: string; role: string }[]> = {};
  (memberships || []).forEach((m: any) => {
    if (!crewMap[m.user_id]) crewMap[m.user_id] = [];
    crewMap[m.user_id].push({
      group_id: m.group_id,
      group_name: m.group?.name || "unknown",
      role: m.role,
    });
  });

  // ── 마이그레이션 실행 여부 감지 ──────────────────────────────
  // grade 컬럼이 존재하면 최소 1명 이상이 undefined가 아닌 값을 가짐
  const migrationDone = (users || []).some((u: any) => u.grade !== undefined && u.grade !== null);

  const usersWithCrews = (users || []).map((u: any) => {
    // grade 컬럼이 없으면 기존 필드에서 추론
    let grade = u.grade;
    if (!grade) {
      if (u.role === "admin") grade = "vip";
      else if (u.can_create_crew) grade = "silver";
      else grade = "bronze";
    }
    return {
      ...u,
      grade,
      can_create_project: u.can_create_project ?? false,
      crews: crewMap[u.id] || [],
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="mb-2">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">회원 관리</h1>
        <p className="text-nu-gray text-sm mt-1">
          {usersWithCrews.length}명의 회원이 등록되어 있습니다
        </p>
      </div>

      {/* ── SQL 마이그레이션 필요 배너 ───────────────────────── */}
      {!migrationDone && (
        <div className="mt-4 mb-6 border-[2px] border-nu-amber/60 bg-nu-amber/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-nu-amber shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-head text-sm font-bold text-nu-ink mb-1">
                등급 기능 활성화가 필요합니다
              </p>
              <p className="text-sm text-nu-gray mb-3">
                Supabase SQL Editor에서 아래 SQL을 실행하면 등급이 영구 저장됩니다.
                실행 전까지 <strong>소모임/프로젝트 권한(can_create_crew)</strong>은 정상 저장되나,
                등급 선택은 새로고침 시 초기화됩니다.
              </p>
              <details className="cursor-pointer">
                <summary className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-amber hover:text-nu-ink transition-colors">
                  SQL 보기 (클릭하여 펼치기)
                </summary>
                <pre className="mt-2 p-4 bg-nu-ink text-nu-paper text-[11px] overflow-x-auto leading-relaxed font-mono">{`-- 등급 컬럼 추가
alter table profiles add column if not exists grade text not null default 'bronze';
-- 프로젝트 권한 컬럼 추가
alter table profiles add column if not exists can_create_project boolean not null default false;
-- 기존 권한 유저 자동 업그레이드
update profiles set grade = 'silver' where can_create_crew = true and role != 'admin';
update profiles set grade = 'vip', can_create_project = true where role = 'admin';
-- 인덱스
create index if not exists idx_profiles_grade on profiles(grade);`}</pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Grade Guide */}
      <div className="mb-8 mt-4">
        <h2 className="font-head text-base font-extrabold text-nu-ink mb-4 flex items-center gap-2">
          <Shield size={16} className="text-nu-pink" />
          등급별 권한 안내
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {GRADE_GUIDE.map((g) => (
            <div key={g.grade} className={`border p-4 ${g.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <g.icon size={14} className={g.iconColor} />
                <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 font-bold ${g.badgeColor}`}>
                  {g.grade}
                </span>
              </div>
              <p className="text-[11px] text-nu-muted mb-2.5">{g.desc}</p>
              <ul className="space-y-1">
                {g.perms.map((p) => (
                  <li key={p} className="text-[11px] text-nu-ink flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0">✓</span>{p}
                  </li>
                ))}
                {g.noperms.map((p) => (
                  <li key={p} className="text-[11px] text-nu-muted/50 flex items-start gap-1.5">
                    <span className="shrink-0">✗</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <AdminUserList users={usersWithCrews} migrationDone={migrationDone} />
    </div>
  );
}
