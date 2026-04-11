import { createClient } from "@/lib/supabase/server";
import {
  Users, Layers, Calendar, FileText, Briefcase,
  UserPlus, FolderGit2, MessageSquare, Pencil, Upload,
  UserCog, ExternalLink, Clock, Shield, Star, Crown, Award,
  AlertTriangle, CheckCircle2, TrendingUp, ArrowUpRight, Send,
} from "lucide-react";
import Link from "next/link";

// ─── helpers ────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const GRADE_ICON: Record<string, { Icon: any; color: string; bg: string }> = {
  admin:  { Icon: Shield, color: "text-nu-pink",   bg: "bg-nu-pink/10" },
  vip:    { Icon: Crown,  color: "text-nu-pink",   bg: "bg-nu-pink/5" },
  gold:   { Icon: Star,   color: "text-yellow-500",bg: "bg-yellow-50" },
  silver: { Icon: Star,   color: "text-slate-400", bg: "bg-slate-50" },
  bronze: { Icon: Award,  color: "text-amber-500", bg: "bg-amber-50" },
};

// ─── Page ────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  const supabase = await createClient();

  // ── 통계 병렬 조회 ─────────────────────────────────────────────────
  const [
    { count: userCount },
    { count: groupCount },
    { count: eventCount },
    { count: contentCount },
    { count: projectCount },
    { count: pendingMembersCount },
    { count: proposalCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("groups").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("events").select("*", { count: "exact", head: true }).gte("start_at", new Date().toISOString()),
    supabase.from("page_content").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("group_members").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("challenge_proposals").select("*", { count: "exact", head: true }).eq("status", "submitted"),
  ]);

  // ── 등급 분포 ─────────────────────────────────────────────────────
  const { data: gradeData } = await supabase
    .from("profiles")
    .select("grade, role, can_create_crew");

  const gradeCounts: Record<string, number> = { admin: 0, vip: 0, gold: 0, silver: 0, bronze: 0 };
  (gradeData || []).forEach((p: any) => {
    if (p.role === "admin") { gradeCounts.admin++; return; }
    const g = p.grade || (p.can_create_crew ? "silver" : "bronze");
    gradeCounts[g] = (gradeCounts[g] || 0) + 1;
  });
  const totalUsers = userCount || 1;

  // ── 최근 가입 + 대기 ──────────────────────────────────────────────
  const [
    { data: recentUsers },
    { data: pendingRequests },
    { data: recentProjectUpdates },
    { data: recentCrewPosts },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id, nickname, email, avatar_url, role, grade, can_create_crew, created_at")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("group_members")
      .select("id, user_id, group_id, joined_at, profile:profiles!group_members_user_id_fkey(nickname, email), group:groups!group_members_group_id_fkey(name)")
      .eq("status", "pending")
      .order("joined_at", { ascending: false })
      .limit(8),
    supabase.from("project_updates")
      .select("id, content, type, created_at, author:profiles!project_updates_author_id_fkey(nickname), project:projects!project_updates_project_id_fkey(id, title)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("crew_posts")
      .select("id, content, type, created_at, author:profiles!crew_posts_author_id_fkey(nickname), group:groups!crew_posts_group_id_fkey(id, name)")
      .order("created_at", { ascending: false }).limit(5),
  ]);

  // ── SQL 마이그레이션 상태 확인 ────────────────────────────────────
  const hasGradeColumn = (gradeData || []).some((p: any) => p.grade !== undefined && p.grade !== null);
  const gradeMigrationDone = hasGradeColumn;

  const stats = [
    { label: "총 회원",     count: userCount    || 0, icon: Users,    color: "bg-nu-blue/10 text-nu-blue",        href: "/admin/users" },
    { label: "활성 소모임", count: groupCount   || 0, icon: Layers,   color: "bg-nu-pink/10 text-nu-pink",        href: "/admin/groups" },
    { label: "예정 일정",   count: eventCount   || 0, icon: Calendar, color: "bg-nu-amber/10 text-nu-amber",      href: "/admin" },
    { label: "활성 프로젝트",count: projectCount || 0, icon: Briefcase,color: "bg-green-50 text-green-600",       href: "/admin/projects" },
    { label: "가입 대기",   count: pendingMembersCount || 0, icon: Clock, color: "bg-orange-50 text-orange-500", href: "/admin/groups", urgent: (pendingMembersCount || 0) > 0 },
    { label: "새 의뢰",    count: proposalCount || 0, icon: Send, color: "bg-nu-pink/10 text-nu-pink",   href: "/admin/proposals", urgent: (proposalCount || 0) > 0 },
  ];

  const updateTypeLabels: Record<string, string> = {
    post: "게시글", milestone_update: "마일스톤", status_change: "상태변경",
    member_joined: "멤버합류", announcement: "공지", event_recap: "일정정리",
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">관리자 대시보드</h1>
          <p className="text-nu-gray text-sm mt-1">nutunion 플랫폼 현황</p>
        </div>
        <Link href="/" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink flex items-center gap-1.5 px-3 py-2 border border-nu-ink/10 hover:border-nu-ink/30 transition-colors no-underline">
          <ExternalLink size={12} /> 사이트 보기
        </Link>
      </div>

      {/* ── SQL 마이그레이션 경고 ─────────────────────────────────── */}
      {!gradeMigrationDone && (
        <div className="bg-orange-50 border-[2px] border-orange-300 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-head text-sm font-bold text-orange-800">SQL 마이그레이션 필요</p>
            <p className="text-xs text-orange-700 mt-1">
              <code>grade</code> 컬럼이 없습니다. Supabase SQL Editor에서 migration_member_grades.sql을 실행하세요.
            </p>
            <pre className="bg-orange-100 text-orange-900 text-[10px] px-3 py-2 mt-2 font-mono overflow-x-auto">
              alter table profiles add column if not exists grade text default &apos;bronze&apos;;{"\n"}
              alter table profiles add column if not exists can_create_project boolean default false;
            </pre>
          </div>
        </div>
      )}

      {/* ── KPI Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className={`bg-nu-white border p-5 hover:shadow-sm transition-all no-underline group ${s.urgent ? "border-orange-300 bg-orange-50" : "border-nu-ink/[0.08] hover:border-nu-ink/20"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{s.label}</p>
                <p className={`font-head text-2xl font-extrabold ${s.urgent ? "text-orange-600" : "text-nu-ink"}`}>{s.count}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* ── 등급 분포 ─────────────────────────────────────────── */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
          <h2 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2 mb-4">
            <TrendingUp size={15} /> 회원 등급 분포
          </h2>
          <div className="space-y-3">
            {(["vip", "gold", "silver", "bronze", "admin"] as const).map((g) => {
              const cnt = gradeCounts[g] || 0;
              const pct = Math.round((cnt / totalUsers) * 100);
              const { Icon, color, bg } = GRADE_ICON[g];
              const LABELS: Record<string, string> = { admin: "관리자", vip: "VIP", gold: "골드", silver: "실버", bronze: "브론즈" };
              if (cnt === 0) return null;
              return (
                <div key={g}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${bg} ${color}`}>
                      <Icon size={9} /> {LABELS[g]}
                    </span>
                    <span className="font-head text-sm font-bold text-nu-ink">{cnt}명</span>
                  </div>
                  <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                    <div className={`h-full ${bg.replace("bg-", "bg-").replace("/5", "").replace("/10", "")}`}
                      style={{ width: `${pct}%`, backgroundColor: g === "admin" ? "#FF1F5A" : g === "vip" ? "#FF1F5A" : g === "gold" ? "#EAB308" : g === "silver" ? "#94A3B8" : "#F59E0B" }} />
                  </div>
                  <p className="font-mono-nu text-[9px] text-nu-muted mt-0.5">{pct}%</p>
                </div>
              );
            })}
          </div>
          <Link href="/admin/users"
            className="block text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline mt-4 no-underline">
            등급 관리 →
          </Link>
        </div>

        {/* ── 가입 대기 ─────────────────────────────────────────── */}
        <div className={`bg-nu-white border p-5 ${(pendingMembersCount || 0) > 0 ? "border-orange-300" : "border-nu-ink/[0.08]"}`}>
          <h2 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2 mb-4">
            <Clock size={15} className={(pendingMembersCount || 0) > 0 ? "text-orange-500" : "text-nu-muted"} />
            가입 승인 대기 ({pendingMembersCount || 0})
          </h2>
          {(pendingRequests || []).length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
              <p className="text-xs text-nu-muted">대기 중인 가입 신청이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(pendingRequests || []).map((r: any) => {
                const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
                const group = Array.isArray(r.group) ? r.group[0] : r.group;
                return (
                  <div key={r.id} className="flex items-center gap-2.5 py-2 border-b border-nu-ink/[0.04] last:border-0">
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center font-head text-[10px] font-bold text-orange-600 shrink-0">
                      {(profile?.nickname || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate">{profile?.nickname || "Unknown"}</p>
                      <p className="text-[10px] text-nu-muted truncate">→ {group?.name}</p>
                    </div>
                    <Link href={`/groups/${r.group_id}/settings`}
                      className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue hover:underline no-underline shrink-0">
                      승인
                    </Link>
                  </div>
                );
              })}
              {(pendingMembersCount || 0) > 8 && (
                <p className="font-mono-nu text-[10px] text-nu-muted text-center pt-1">
                  +{(pendingMembersCount || 0) - 8}개 더
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 빠른 작업 ────────────────────────────────────────── */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
          <h2 className="font-head text-sm font-bold text-nu-ink mb-4">빠른 이동</h2>
          <div className="space-y-1">
            {[
              { label: "회원 등급 관리", href: "/admin/users",    icon: UserCog,    color: "text-nu-pink" },
              { label: "소모임 관리",   href: "/admin/groups",   icon: Layers,     color: "text-nu-blue" },
              { label: "프로젝트 관리", href: "/admin/projects", icon: Briefcase,  color: "text-green-600" },
              { label: "의뢰 관리",   href: "/admin/proposals",icon: Send,      color: "text-nu-pink" },
              { label: "콘텐츠 수정",  href: "/admin/content",  icon: Pencil,     color: "text-nu-amber" },
              { label: "미디어 업로드",href: "/admin/media",    icon: Upload,     color: "text-nu-graphite" },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-nu-cream/40 transition-colors no-underline group">
                <a.icon size={14} className={a.color} />
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite group-hover:text-nu-ink">{a.label}</span>
                <ArrowUpRight size={11} className="ml-auto text-nu-muted/30 group-hover:text-nu-pink transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 최근 활동 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 최근 가입 */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.06]">
            <UserPlus size={15} className="text-nu-blue" />
            <h2 className="font-head text-sm font-bold text-nu-ink">최근 가입</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentUsers || []).map((u: any) => {
              const g = u.role === "admin" ? "admin" : (u.grade || (u.can_create_crew ? "silver" : "bronze"));
              const gi = GRADE_ICON[g] || GRADE_ICON.bronze;
              const GI = gi.Icon;
              return (
                <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nu-ink/5 flex items-center justify-center shrink-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      : <span className="font-head text-xs text-nu-muted">{(u.nickname || "?").charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{u.nickname || "unnamed"}</span>
                      <span className={`inline-flex items-center gap-0.5 font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${gi.bg} ${gi.color}`}>
                        <GI size={7} />
                      </span>
                    </div>
                    <p className="text-[10px] text-nu-muted truncate">{u.email}</p>
                  </div>
                  <span className="font-mono-nu text-[9px] text-nu-muted shrink-0">{timeAgo(u.created_at)}</span>
                </div>
              );
            })}
          </div>
          <Link href="/admin/users"
            className="block text-center py-3 border-t border-nu-ink/[0.06] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors no-underline">
            전체 보기
          </Link>
        </div>

        {/* 최근 프로젝트 */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.06]">
            <FolderGit2 size={15} className="text-green-600" />
            <h2 className="font-head text-sm font-bold text-nu-ink">프로젝트 활동</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentProjectUpdates || []).length === 0 && (
              <p className="p-6 text-center text-nu-muted text-sm">프로젝트 활동이 없습니다</p>
            )}
            {(recentProjectUpdates || []).map((u: any) => {
              const au = Array.isArray(u.author) ? u.author[0] : u.author;
              const pr = Array.isArray(u.project) ? u.project[0] : u.project;
              return (
                <div key={u.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{au?.nickname || "unknown"}</span>
                    <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-green-50 text-green-600 px-1.5 py-0.5 shrink-0">
                      {updateTypeLabels[u.type] || u.type}
                    </span>
                  </div>
                  <Link href={pr?.id ? `/projects/${pr.id}` : "#"}
                    className="text-[10px] text-nu-blue hover:underline no-underline truncate block">{pr?.title}</Link>
                  <p className="text-[10px] text-nu-graphite truncate mt-0.5">{u.content}</p>
                  <p className="font-mono-nu text-[9px] text-nu-muted mt-1">{timeAgo(u.created_at)}</p>
                </div>
              );
            })}
          </div>
          <Link href="/admin/projects"
            className="block text-center py-3 border-t border-nu-ink/[0.06] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors no-underline">
            전체 보기
          </Link>
        </div>

        {/* 최근 크루 */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.06]">
            <MessageSquare size={15} className="text-nu-pink" />
            <h2 className="font-head text-sm font-bold text-nu-ink">크루 활동</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentCrewPosts || []).length === 0 && (
              <p className="p-6 text-center text-nu-muted text-sm">크루 활동이 없습니다</p>
            )}
            {(recentCrewPosts || []).map((p: any) => {
              const au = Array.isArray(p.author) ? p.author[0] : p.author;
              const gr = Array.isArray(p.group) ? p.group[0] : p.group;
              return (
                <div key={p.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{au?.nickname || "unknown"}</span>
                    <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-1.5 py-0.5 shrink-0">
                      {updateTypeLabels[p.type] || "게시"}
                    </span>
                  </div>
                  <Link href={gr?.id ? `/groups/${gr.id}` : "#"}
                    className="text-[10px] text-nu-pink hover:underline no-underline truncate block">{gr?.name}</Link>
                  <p className="text-[10px] text-nu-graphite truncate mt-0.5">{p.content}</p>
                  <p className="font-mono-nu text-[9px] text-nu-muted mt-1">{timeAgo(p.created_at)}</p>
                </div>
              );
            })}
          </div>
          <Link href="/admin/groups"
            className="block text-center py-3 border-t border-nu-ink/[0.06] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors no-underline">
            전체 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
