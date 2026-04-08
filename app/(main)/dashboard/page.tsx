import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, Calendar, Bell, ChevronRight, MapPin, Clock,
  Briefcase, Activity, Plus, Layers, ArrowUpRight,
  Star, Crown, Award, Shield, TrendingUp, Zap,
  FileText, MessageSquare, CheckCircle2,
} from "lucide-react";

// ─── Grade helper ────────────────────────────────────────────────
const GRADE = {
  bronze: { label: "브론즈", color: "text-amber-500 bg-amber-50 border-amber-200", icon: Award },
  silver: { label: "실버",  color: "text-slate-500 bg-slate-50 border-slate-200", icon: Star   },
  gold:   { label: "골드",  color: "text-yellow-500 bg-yellow-50 border-yellow-200", icon: Star },
  vip:    { label: "VIP",   color: "text-nu-pink bg-nu-pink/5 border-nu-pink/20", icon: Crown  },
  admin:  { label: "관리자", color: "text-nu-pink bg-nu-pink text-white border-nu-pink", icon: Shield },
};
const CAT = {
  space:    { color: "bg-nu-blue",   dot: "bg-nu-blue",   label: "공간"   },
  culture:  { color: "bg-nu-amber",  dot: "bg-nu-amber",  label: "문화"   },
  platform: { color: "bg-nu-ink",    dot: "bg-nu-ink",    label: "플랫폼" },
  vibe:     { color: "bg-nu-pink",   dot: "bg-nu-pink",   label: "바이브" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fetch all data in parallel ──────────────────────────────────
  const [
    { data: profile },
    { data: memberships },
    { data: projectMemberships },
    { count: notifCount },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("group_members")
      .select("group_id, role, groups(id, name, category, description, max_members)")
      .eq("user_id", user.id).eq("status", "active").eq("groups.is_active", true),
    supabase.from("project_members")
      .select("project_id, role, reward_ratio, projects(id, title, description, status, category)")
      .eq("user_id", user.id)
      .in("projects.status", ["active", "draft"]),
    supabase.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_read", false),
    supabase.from("crew_posts")
      .select("id, content, type, created_at, author:profiles!crew_posts_author_id_fkey(nickname, avatar_url), group:groups!crew_posts_group_id_fkey(id, name, is_active)")
      .eq("group.is_active", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const groupIds = memberships?.map((m) => m.group_id) || [];

  const { data: events } = groupIds.length
    ? await supabase.from("events")
        .select("*")
        .in("group_id", groupIds)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(3)
    : { data: [] };

  // ── Pending group join requests (host only) ─────────────────────
  const hostGroups = (memberships || []).filter((m: any) => m.role === "host").map((m: any) => m.group_id);
  const { data: pendingRequests, count: pendingCount } = hostGroups.length
    ? await supabase.from("group_members")
        .select("id, group_id, user_id, groups(name), profile:profiles!group_members_user_id_fkey(nickname)", { count: "exact" })
        .in("group_id", hostGroups)
        .eq("status", "pending")
        .limit(3)
    : { data: [], count: 0 };

  const nickname    = profile?.nickname || "멤버";
  const grade       = profile?.role === "admin" ? "admin" : (profile?.grade || "bronze");
  const gradeInfo   = GRADE[grade as keyof typeof GRADE] || GRADE.bronze;
  const GradeIcon   = gradeInfo.icon;
  const groupCount  = memberships?.length || 0;
  const projectCount = projectMemberships?.length || 0;
  const eventCount  = events?.length || 0;

  // ── KPI stats ────────────────────────────────────────────────
  const nutPoints = profile?.points || 0;
  const activityScore = profile?.activity_score || 0;
  const skills = profile?.skill_tags || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">

      {/* ── Hero greeting ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-1 border ${gradeInfo.color}`}>
              <GradeIcon size={10} /> {gradeInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-white">
              <Zap size={10} className="text-nu-yellow" /> {nutPoints} NUT
            </span>
          </div>
          <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight">
            안녕하세요, {nickname}님 👋
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skills.map((s: string) => (
              <span key={s} className="font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 bg-nu-cream border border-nu-ink/10 text-nu-muted">
                #{s}
              </span>
            ))}
            {skills.length === 0 && (
              <p className="text-nu-gray text-[11px]">프로필에서 관심 스킬을 추가해보세요</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
          <Link href="/groups/create"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-5 py-3 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all no-underline flex items-center gap-2">
            <Plus size={14} /> 소모임
          </Link>
          <Link href="/projects/create"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-5 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline flex items-center gap-2">
            <Plus size={14} /> 프로젝트
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "내 소모임",   val: groupCount,   href: "/groups",       icon: Layers,    accent: "text-nu-blue",   bg: "bg-nu-blue/8" },
          { label: "활동 지수",   val: activityScore, href: "/profile",     icon: TrendingUp, accent: "text-green-600", bg: "bg-green-50" },
          { label: "다가오는 일정", val: eventCount, href: "/dashboard",     icon: Calendar,  accent: "text-nu-pink",   bg: "bg-nu-pink/8" },
          { label: "넛 포인트",   val: nutPoints,    href: "/profile",     icon: Zap,       accent: "text-nu-amber",  bg: "bg-nu-amber/10" },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-nu-white border-[2px] border-nu-ink/[0.06] p-6 flex flex-col gap-3 no-underline hover:border-nu-pink/30 hover:shadow-md transition-all group">
            <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${s.bg} border border-nu-ink/5`}>
              <s.icon size={20} className={s.accent} />
            </div>
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">{s.label}</p>
              <p className="font-head text-3xl font-extrabold text-nu-ink group-hover:text-nu-pink transition-colors">{s.val}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: 소모임 + 프로젝트 ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* 가입 승인 대기 */}
          {(pendingCount || 0) > 0 && (
            <div className="bg-nu-amber/5 border-[2px] border-nu-amber/40 p-5">
              <h2 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
                <Users size={14} className="text-nu-amber" /> 가입 승인 대기 ({pendingCount})
              </h2>
              <div className="space-y-2">
                {(pendingRequests || []).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-nu-white px-4 py-2.5 border border-nu-ink/[0.06]">
                    <div>
                      <span className="text-sm font-medium">{r.profile?.nickname}</span>
                      <span className="font-mono-nu text-[10px] text-nu-muted ml-2">→ {r.groups?.name}</span>
                    </div>
                    <Link href={`/groups/${r.group_id}/settings`}
                      className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:underline no-underline">
                      승인하기
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 내 소모임 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Layers size={16} /> 내 소모임
              </h2>
              <Link href="/groups" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            {groupCount === 0 ? (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
                <Layers size={28} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-nu-gray text-sm mb-3">아직 소모임이 없습니다</p>
                <Link href="/groups"
                  className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-5 py-2.5 no-underline hover:bg-nu-pink transition-colors inline-block">
                  소모임 탐색하기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {memberships?.slice(0, 4).map((m: any) => {
                  const g = m.groups;
                  if (!g || g.is_active === false) return null;
                  const cat = CAT[g.category as keyof typeof CAT];
                  return (
                    <Link key={g.id} href={`/groups/${g.id}`}
                      className="bg-nu-white border border-nu-ink/[0.08] p-4 no-underline hover:border-nu-pink/40 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 text-white font-bold ${cat?.color || "bg-nu-gray"}`}>
                          {cat?.label || g.category}
                        </span>
                        {m.role === "host" && (
                          <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">Host</span>
                        )}
                      </div>
                      <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">{g.name}</h3>
                      <p className="text-[11px] text-nu-muted mt-1 line-clamp-1">{g.description || "-"}</p>
                      <div className="flex items-center justify-end mt-2">
                        <ArrowUpRight size={13} className="text-nu-muted/40 group-hover:text-nu-pink transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내 프로젝트 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Briefcase size={16} /> 내 프로젝트
              </h2>
              <Link href="/projects" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            {projectCount === 0 ? (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
                <Briefcase size={28} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-nu-gray text-sm mb-3">참여 중인 프로젝트가 없습니다</p>
                <Link href="/projects"
                  className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-5 py-2.5 no-underline hover:bg-nu-pink transition-colors inline-block">
                  프로젝트 탐색하기
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {projectMemberships?.slice(0, 4).map((pm: any) => {
                  const p = pm.projects;
                  if (!p || !["active", "draft"].includes(p.status)) return null;
                  const cat = CAT[p.category as keyof typeof CAT];
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-4 no-underline hover:border-nu-pink/40 hover:shadow-sm transition-all group">
                      <div className={`w-1.5 h-10 shrink-0 ${p.status === "active" ? "bg-green-500" : "bg-nu-muted/20"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">{p.title}</h3>
                          {pm.role === "lead" && (
                            <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-green-50 text-green-600 px-1.5 py-0.5 shrink-0">PM</span>
                          )}
                          {cat && (
                            <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 text-white shrink-0 ${cat.color}`}>{cat.label}</span>
                          )}
                        </div>
                        <span className={`font-mono-nu text-[10px] uppercase tracking-widest ${p.status === "active" ? "text-green-600" : "text-nu-muted"}`}>
                          {p.status === "active" ? "● 진행중" : p.status === "completed" ? "완료" : p.status}
                        </span>
                      </div>
                      {pm.reward_ratio && (
                        <div className="shrink-0 text-right">
                          <p className="font-head text-sm font-bold text-green-600">{pm.reward_ratio}%</p>
                          <p className="font-mono-nu text-[9px] text-nu-muted">배분율</p>
                        </div>
                      )}
                      <ArrowUpRight size={13} className="text-nu-muted/40 group-hover:text-nu-pink transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 최근 커뮤니티 활동 */}
          <div>
            <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2 mb-3">
              <Activity size={16} /> 최근 활동
            </h2>
            {(!recentActivity || recentActivity.length === 0) ? (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-6 text-center">
                <p className="text-nu-gray text-sm">최근 활동이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a: any) => {
                  const group = Array.isArray(a.group) ? a.group[0] : a.group;
                  if (!group || group.is_active === false) return null;
                  return (
                    <div key={a.id} className="bg-nu-white border border-nu-ink/[0.06] px-4 py-3 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-nu-ink/5 flex items-center justify-center font-head text-[10px] font-bold text-nu-ink shrink-0">
                        {(a.author?.nickname || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-nu-ink">{a.author?.nickname}</span>
                          {group && (
                            <Link href={`/groups/${group.id}`}
                              className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue hover:underline no-underline">
                              #{group.name}
                            </Link>
                          )}
                          <span className="font-mono-nu text-[9px] text-nu-muted/60 ml-auto">{timeAgo(a.created_at)}</span>
                        </div>
                        <p className="text-xs text-nu-gray mt-0.5 line-clamp-2">{a.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT sidebar ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* 빠른 이동 */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">빠른 이동</h3>
            <div className="space-y-1">
              {[
                { href: "/groups",       label: "소모임 탐색",   icon: Layers,    color: "text-nu-blue" },
                { href: "/projects",     label: "프로젝트 탐색", icon: Briefcase, color: "text-green-600" },
                { href: "/members",      label: "멤버 탐색",     icon: Users,     color: "text-nu-pink" },
                { href: "/profile",      label: "내 아카이브",   icon: Star,      color: "text-nu-amber" },
                { href: "/notifications",label: "알림",          icon: Bell,      color: "text-nu-muted" },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-nu-cream/30 transition-colors no-underline group">
                  <item.icon size={13} className={item.color} />
                  <span className="text-sm text-nu-graphite group-hover:text-nu-ink">{item.label}</span>
                  <ChevronRight size={11} className="ml-auto text-nu-muted/30 group-hover:text-nu-pink transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* 다가오는 일정 */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
              <Calendar size={14} /> 다가오는 일정
            </h3>
            {eventCount === 0 ? (
              <p className="text-xs text-nu-muted text-center py-4">예정된 일정이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {events?.map((evt: any) => (
                  <Link key={evt.id} href={`/groups/${evt.group_id}/events/${evt.id}`}
                    className="flex items-center gap-3 py-1 no-underline hover:bg-nu-cream/20 transition-colors -mx-2 px-2 group">
                    <div className="w-10 h-10 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                      <span className="font-head text-sm font-extrabold text-nu-pink leading-none">
                        {new Date(evt.start_at).getDate()}
                      </span>
                      <span className="font-mono-nu text-[8px] uppercase text-nu-pink/70">
                        {new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate group-hover:text-nu-pink transition-colors">{evt.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-nu-muted">
                          <Clock size={10} />
                          {new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1 text-[10px] text-nu-muted truncate">
                            <MapPin size={10} /> {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 성장 현황 */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
              <TrendingUp size={14} /> 성장 현황
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">소모임 활동</span>
                  <span className="font-head text-sm font-bold text-nu-ink">{groupCount}개</span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div className="h-full bg-nu-blue" style={{ width: `${Math.min((groupCount / 5) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">프로젝트 참여</span>
                  <span className="font-head text-sm font-bold text-nu-ink">{projectCount}개</span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${Math.min((projectCount / 3) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-nu-ink/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">현재 등급</span>
                  <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 border ${gradeInfo.color}`}>
                    <GradeIcon size={9} /> {gradeInfo.label}
                  </span>
                </div>
                {grade === "bronze" && (
                  <p className="text-[10px] text-nu-muted mt-1.5">소모임에 더 참여하면 실버로 승급됩니다</p>
                )}
                {grade === "silver" && (
                  <p className="text-[10px] text-nu-muted mt-1.5">프로젝트에 참여하면 골드로 승급 가능합니다</p>
                )}
                {(grade === "gold" || grade === "vip") && (
                  <p className="text-[10px] text-green-600 mt-1.5">✓ 소모임과 프로젝트를 개설할 수 있습니다</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
