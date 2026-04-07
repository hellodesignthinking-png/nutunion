"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  Search, Filter, ChevronDown, ChevronUp,
  Shield, Crown, Star, Award, UserX, Check,
  Layers, Briefcase, Edit3, X
} from "lucide-react";
import type { Profile } from "@/lib/types";

interface UserWithCrews extends Profile {
  grade?: string;
  can_create_project?: boolean;
  crews?: { group_id: string; group_name: string; role: string }[];
}

// ── 등급 정의 ──────────────────────────────────────────────────────────
const GRADES = [
  {
    value: "bronze",
    label: "브론즈",
    labelEn: "Bronze",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
    icon: Award,
    desc: "기본 회원",
    canCreateCrew: false,
    canCreateProject: false,
  },
  {
    value: "silver",
    label: "실버",
    labelEn: "Silver",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: Star,
    desc: "소모임 개설 가능",
    canCreateCrew: true,
    canCreateProject: false,
  },
  {
    value: "gold",
    label: "골드",
    labelEn: "Gold",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-400",
    icon: Star,
    desc: "소모임 + 프로젝트 개설",
    canCreateCrew: true,
    canCreateProject: true,
  },
  {
    value: "vip",
    label: "VIP",
    labelEn: "VIP",
    color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20",
    dot: "bg-nu-pink",
    icon: Crown,
    desc: "VIP 멤버",
    canCreateCrew: true,
    canCreateProject: true,
  },
];

const GRADE_MAP = Object.fromEntries(GRADES.map(g => [g.value, g]));

function GradeBadge({ grade, role }: { grade?: string; role?: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 border border-nu-pink">
        <Shield size={9} /> 최고관리자
      </span>
    );
  }
  const g = GRADE_MAP[grade || "bronze"] || GRADE_MAP.bronze;
  return (
    <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 border ${g.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />
      {g.label}
    </span>
  );
}

export function AdminUserList({ users }: { users: UserWithCrews[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery]     = useState("");
  const [gradeFilter, setGradeFilter]     = useState("all");
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [savingId, setSavingId]           = useState<string | null>(null);
  const [editGrade, setEditGrade]         = useState("bronze");
  const [editCrewPerm, setEditCrewPerm]   = useState(false);
  const [editProjectPerm, setEditProjectPerm] = useState(false);
  const [editRole, setEditRole]           = useState("member");
  const [localUsers, setLocalUsers]       = useState(users);

  const filtered = useMemo(() => localUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q
      || (u.nickname || "").toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q);
    const matchGrade = gradeFilter === "all"
      || (gradeFilter === "admin" ? u.role === "admin" : u.grade === gradeFilter);
    return matchQ && matchGrade;
  }), [localUsers, searchQuery, gradeFilter]);

  function openEdit(u: UserWithCrews) {
    setEditingId(u.id);
    setEditGrade(u.grade || "bronze");
    setEditCrewPerm(u.can_create_crew ?? false);
    setEditProjectPerm(u.can_create_project ?? false);
    setEditRole(u.role || "member");
    setExpandedId(u.id);
  }

  async function saveUser(userId: string) {
    setSavingId(userId);
    const supabase = createClient();

    const gradeConfig      = GRADE_MAP[editGrade];
    const finalCrewPerm    = editCrewPerm    || gradeConfig?.canCreateCrew    || editRole === "admin";
    const finalProjectPerm = editProjectPerm || gradeConfig?.canCreateProject || editRole === "admin";

    // ① 항상 존재하는 컬럼만 먼저 업데이트
    const { error: baseError } = await supabase.from("profiles").update({
      role: editRole,
      can_create_crew: finalCrewPerm,
    }).eq("id", userId);

    if (baseError) {
      toast.error("저장에 실패했습니다: " + baseError.message);
      setSavingId(null);
      return;
    }

    // ② grade / can_create_project — SQL 마이그레이션 실행 후에만 존재
    //    컬럼 없으면 400 에러 발생 → 무시하고 경고만 표시
    let gradeWarning = false;
    const { error: gradeError } = await supabase.from("profiles").update({
      grade: editGrade,
      can_create_project: finalProjectPerm,
    }).eq("id", userId);

    if (gradeError) {
      // 컬럼 미존재 (400) 또는 다른 에러
      gradeWarning = true;
    }

    // 로컬 상태 업데이트
    setLocalUsers(prev => prev.map(u => u.id === userId ? {
      ...u,
      role: editRole as any,
      can_create_crew: finalCrewPerm,
      ...(gradeWarning ? {} : {
        grade: editGrade,
        can_create_project: finalProjectPerm,
      }),
    } as UserWithCrews : u));

    if (gradeWarning) {
      toast.success("역할/소모임 권한이 저장되었습니다");
      toast("등급 저장을 위해 Supabase SQL 마이그레이션이 필요합니다", {
        description: "migration_member_grades.sql 을 실행하면 등급/프로젝트 권한도 저장됩니다",
        duration: 6000,
      });
    } else {
      toast.success("회원 정보가 업데이트되었습니다");
    }
    setEditingId(null);
    setSavingId(null);
  }


  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" });
  }

  // Grade 분포 통계
  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { bronze: 0, silver: 0, gold: 0, vip: 0, admin: 0 };
    localUsers.forEach(u => {
      if (u.role === "admin") counts.admin++;
      else counts[u.grade || "bronze"] = (counts[u.grade || "bronze"] || 0) + 1;
    });
    return counts;
  }, [localUsers]);

  return (
    <div>
      {/* Grade Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[...GRADES, { value: "admin", label: "관리자", color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20", dot: "bg-nu-pink", icon: Shield }].map(g => (
          <button key={g.value}
            onClick={() => setGradeFilter(gradeFilter === g.value ? "all" : g.value)}
            className={`p-3 border-[2px] text-left transition-all ${gradeFilter === g.value ? "border-nu-ink" : "border-nu-ink/[0.08] hover:border-nu-ink/20"} bg-nu-white`}>
            <div className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border mb-2 ${g.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />
              {g.label}
            </div>
            <p className="font-head text-2xl font-extrabold text-nu-ink">{gradeCounts[g.value] || 0}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="닉네임 또는 이메일로 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 transition-colors" />
        </div>
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center">
          {filtered.length}/{localUsers.length}명
        </p>
      </div>

      {/* Table */}
      <div className="bg-nu-white border border-nu-ink/[0.08]">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-0 border-b border-nu-ink/[0.08]">
          {["회원", "이메일", "등급", "소모임", "프로젝트", "관리"].map(h => (
            <div key={h} className="px-4 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map(u => (
          <div key={u.id} className="border-b border-nu-ink/[0.04] last:border-0">
            {/* Main row */}
            <div
              className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-0 items-center hover:bg-nu-ink/[0.02] transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>

              {/* 회원 */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold shrink-0">
                  {(u.nickname || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.nickname || "unnamed"}</p>
                  <p className="text-[11px] text-nu-muted truncate">{u.name}</p>
                </div>
                {expandedId === u.id ? <ChevronUp size={12} className="text-nu-muted ml-auto" /> : <ChevronDown size={12} className="text-nu-muted ml-auto" />}
              </div>

              {/* 이메일 */}
              <div className="px-4 py-3 text-sm text-nu-muted truncate">{u.email}</div>

              {/* 등급 */}
              <div className="px-4 py-3"><GradeBadge grade={u.grade} role={u.role} /></div>

              {/* 소모임 */}
              <div className="px-4 py-3">
                {u.can_create_crew
                  ? <span className="text-green-600"><Check size={14} /></span>
                  : <span className="text-nu-muted/40 text-xs">—</span>}
              </div>

              {/* 프로젝트 */}
              <div className="px-4 py-3">
                {u.can_create_project
                  ? <span className="text-green-600"><Check size={14} /></span>
                  : <span className="text-nu-muted/40 text-xs">—</span>}
              </div>

              {/* 관리 */}
              <div className="px-4 py-3" onClick={e => e.stopPropagation()}>
                <button onClick={() => editingId === u.id ? setEditingId(null) : openEdit(u)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink/5 hover:bg-nu-pink hover:text-white transition-colors flex items-center gap-1">
                  <Edit3 size={11} /> 편집
                </button>
              </div>
            </div>

            {/* Mobile card */}
            <div className="md:hidden p-4 flex items-center justify-between gap-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold shrink-0">
                  {(u.nickname || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.nickname || "unnamed"}</p>
                    <GradeBadge grade={u.grade} role={u.role} />
                  </div>
                  <p className="text-xs text-nu-muted truncate">{u.email}</p>
                </div>
              </div>
              {expandedId === u.id ? <ChevronUp size={14} className="shrink-0 text-nu-muted" /> : <ChevronDown size={14} className="shrink-0 text-nu-muted" />}
            </div>

            {/* Expanded edit panel */}
            {expandedId === u.id && (
              <div className="border-t border-nu-ink/[0.06] bg-nu-cream/20 px-5 py-5">
                <div className="max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* 기본 정보 */}
                  <div className="space-y-2 text-sm">
                    <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">기본 정보</p>
                    <div className="flex gap-2"><span className="text-nu-muted w-16 shrink-0">가입일</span><span>{formatDate(u.created_at)}</span></div>
                    <div className="flex gap-2"><span className="text-nu-muted w-16 shrink-0">분야</span><span>{u.specialty || "-"}</span></div>
                    <div className="flex gap-2 items-start"><span className="text-nu-muted w-16 shrink-0">소속</span>
                      <div className="flex flex-wrap gap-1">
                        {(u.crews || []).length === 0 ? <span className="text-nu-muted">없음</span> : (u.crews!).map(c => (
                          <span key={c.group_id} className="font-mono-nu text-[9px] uppercase bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">{c.group_name}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 등급 / 권한 편집 */}
                  {editingId === u.id ? (
                    <div className="space-y-3">
                      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-3">권한 편집</p>

                      {/* Grade select */}
                      <div>
                        <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">등급</label>
                        <div className="grid grid-cols-2 gap-2">
                          {GRADES.map(g => (
                            <button key={g.value} type="button"
                              onClick={() => {
                                setEditGrade(g.value);
                                setEditCrewPerm(g.canCreateCrew);
                                setEditProjectPerm(g.canCreateProject);
                              }}
                              className={`px-3 py-2 border-[2px] text-left transition-all ${editGrade === g.value ? "border-nu-ink" : "border-nu-ink/10 hover:border-nu-ink/30"}`}>
                              <div className={`inline-flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 border mb-1 ${g.color}`}>
                                <span className={`w-1 h-1 rounded-full ${g.dot}`} />{g.label}
                              </div>
                              <p className="text-[10px] text-nu-muted">{g.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom permission toggles */}
                      <div className="flex flex-col gap-2">
                        <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1">개별 권한 (등급 override)</label>
                        <button type="button" onClick={() => setEditCrewPerm(!editCrewPerm)}
                          className={`flex items-center gap-2 px-3 py-2 border-[2px] transition-all text-sm ${editCrewPerm ? "border-nu-blue bg-nu-blue/5 text-nu-blue" : "border-nu-ink/10 text-nu-muted"}`}>
                          <Layers size={13} />
                          소모임 개설 {editCrewPerm ? "허용" : "불가"}
                        </button>
                        <button type="button" onClick={() => setEditProjectPerm(!editProjectPerm)}
                          className={`flex items-center gap-2 px-3 py-2 border-[2px] transition-all text-sm ${editProjectPerm ? "border-green-500 bg-green-50 text-green-700" : "border-nu-ink/10 text-nu-muted"}`}>
                          <Briefcase size={13} />
                          프로젝트 개설 {editProjectPerm ? "허용" : "불가"}
                        </button>
                      </div>

                      {/* Role */}
                      <div>
                        <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">역할</label>
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}
                          className="w-full px-3 py-2 border border-nu-ink/15 bg-nu-white text-sm focus:outline-none focus:border-nu-pink">
                          <option value="member">일반 회원</option>
                          <option value="admin">최고관리자</option>
                        </select>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveUser(u.id)} disabled={!!savingId}
                          className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50 flex-1">
                          {savingId === u.id ? "저장 중..." : "저장"}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 hover:bg-nu-cream transition-colors flex items-center gap-1">
                          <X size={11} /> 취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">현재 권한</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Layers size={13} className={u.can_create_crew ? "text-nu-blue" : "text-nu-muted/40"} />
                          <span className={u.can_create_crew ? "text-nu-blue" : "text-nu-muted"}>소모임 개설 {u.can_create_crew ? "가능" : "불가"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase size={13} className={u.can_create_project ? "text-green-600" : "text-nu-muted/40"} />
                          <span className={u.can_create_project ? "text-green-600" : "text-nu-muted"}>프로젝트 개설 {u.can_create_project ? "가능" : "불가"}</span>
                        </div>
                      </div>
                      <button onClick={() => openEdit(u)}
                        className="mt-4 font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors flex items-center gap-1.5">
                        <Edit3 size={11} /> 권한 편집
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
