import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Users, Calendar, Bell, ChevronRight, MapPin, Clock,
  Briefcase, Activity, Plus, Layers, ArrowUpRight,
  Star, TrendingUp, Zap, CheckSquare, AlertTriangle,
  FileText, MessageSquare, CheckCircle2, Circle, FolderOpen,
} from "lucide-react";
import { getGrade, getCategory, timeAgo, GRADE_CONFIG, CATEGORY_CONFIG } from "@/lib/constants";
import { AICommandBar } from "@/app/staff/ai-command-bar";

const MyTasksWidget = dynamic(() => import("@/components/dashboard/my-tasks-widget").then(m => ({ default: m.MyTasksWidget })), {
  loading: () => <div className="bg-white border border-nu-ink/[0.08] p-5 h-48 animate-pulse" />,
});
const MyCalendarWidget = dynamic(() => import("@/components/dashboard/my-calendar-widget").then(m => ({ default: m.MyCalendarWidget })), {
  loading: () => <div className="bg-white border border-nu-ink/[0.08] p-5 h-48 animate-pulse" />,
});

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fetch all data in parallel ──────────────────────────────────
  let profile: any = null;
  let memberships: any[] | null = null;
  let projectMemberships: any[] | null = null;
  let recentActivity: any[] | null = null;
  let events: any[] | null = [];
  let pendingRequests: any[] | null = [];
  let pendingCount: number | null = 0;
  let staffTasks: any[] = [];
  let boltTasks: any[] = [];

  try {
    const [
      { data: profileData },
      { data: membershipsData },
      { data: projectMembershipsData },
      ,
      { data: recentActivityData },
      { data: staffTasksData },
      { data: boltTasksData },
    ] = await Promise.all([
      supabase.from("profiles").select("id, nickname, avatar_url, bio, grade, role, interests, points, activity_score, skill_tags, created_at, updated_at").eq("id", user.id).single(),
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
        .order("created_at", { ascending: false })
        .limit(8),
      // Staff tasks
      supabase.from("staff_tasks")
        .select("id, title, status, priority, due_date, project:staff_projects(title)")
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(10),
      // Bolt tasks
      supabase.from("project_tasks")
        .select("id, title, status, due_date, milestone:milestones(title, project:projects(id, title))")
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(6),
    ]);

    profile = profileData;
    memberships = membershipsData;
    projectMemberships = projectMembershipsData;
    recentActivity = recentActivityData;
    staffTasks = staffTasksData || [];
    boltTasks = boltTasksData || [];

    const groupIds = memberships?.map((m) => m.group_id) || [];

    const { data: eventsData } = groupIds.length
      ? await supabase.from("events")
          .select("*")
          .in("group_id", groupIds)
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(5)
      : { data: [] };
    events = eventsData;

    // ── Pending group join requests (host only) ─────────────────────
    const hostGroups = (memberships || []).filter((m: any) => m.role === "host").map((m: any) => m.group_id);
    const { data: pendingRequestsData, count: pendingCountData } = hostGroups.length
      ? await supabase.from("group_members")
          .select("id, group_id, user_id, groups(name), profile:profiles!group_members_user_id_fkey(nickname)", { count: "exact" })
          .in("group_id", hostGroups)
          .eq("status", "pending")
          .limit(3)
      : { data: [], count: 0 };
    pendingRequests = pendingRequestsData;
    pendingCount = pendingCountData;
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
  }

  const nickname    = profile?.nickname || "와셔";
  const gradeInfo   = profile ? getGrade(profile) : GRADE_CONFIG.bronze;
  const grade       = profile?.role === "admin" ? "admin" : (profile?.grade || "bronze");
  const GradeIcon   = gradeInfo.icon;
  const groupCount  = memberships?.length || 0;
  const projectCount = projectMemberships?.length || 0;
  const eventCount  = events?.length || 0;

  const nutPoints = profile?.points || 0;
  const activityScore = profile?.activity_score || 0;
  const skills = profile?.skill_tags || [];

  // ── Task categorization ─────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const allTasks = [...staffTasks, ...boltTasks.map((t: any) => ({
    ...t,
    _bolt: true,
    project: t.milestone?.project ? { title: t.milestone.project.title } : null,
  }))];

  const overdueTasks = allTasks.filter(t => t.due_date && t.due_date < todayStr);
  const todayTasks = allTasks.filter(t => t.due_date === todayStr);
  const upcomingTasks = allTasks.filter(t => !t.due_date || t.due_date > todayStr);

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-nu-ink/5 text-nu-graphite border-nu-ink/10",
    low: "bg-blue-50 text-blue-600 border-blue-200",
  };

  function StatusDot({ status }: { status: string }) {
    if (status === "in_progress") return <Circle size={10} className="text-indigo-500 fill-indigo-500/20" />;
    return <Circle size={10} className="text-nu-muted" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">

      {/* ── Hero Header ───────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2 py-1 border ${gradeInfo.cls}`}>
              <GradeIcon size={10} /> {gradeInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-white">
              <Zap size={10} className="text-nu-yellow" /> {nutPoints} NUT
            </span>
          </div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight">
            오늘의 대시보드
          </h1>
          <p className="font-mono-nu text-[13px] text-nu-muted uppercase tracking-widest mt-1">
            {new Date().toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            {" · "}안녕하세요, {nickname}님
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/groups/create"
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all no-underline flex items-center gap-1.5">
            <Plus size={12} /> 너트
          </Link>
          <Link href="/projects/create"
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline flex items-center gap-1.5">
            <Plus size={12} /> 볼트
          </Link>
        </div>
      </div>

      {/* ── AI Command Bar (상단 크게) ─────────────────────────────── */}
      <AICommandBar />

      {/* ── Stats Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Link href="/groups" className="bg-white border border-nu-ink/[0.06] p-4 no-underline hover:border-indigo-300 transition-colors">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">내 너트</p>
          <p className="font-head text-2xl font-extrabold text-indigo-600">{groupCount}</p>
        </Link>
        <Link href="/projects" className="bg-white border border-nu-ink/[0.06] p-4 no-underline hover:border-purple-300 transition-colors">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">내 볼트</p>
          <p className="font-head text-2xl font-extrabold text-purple-600">{projectCount}</p>
        </Link>
        <div className="bg-white border border-nu-ink/[0.06] p-4">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">내 할일</p>
          <p className="font-head text-2xl font-extrabold text-nu-ink">{allTasks.length}</p>
        </div>
        <div className={`p-4 border ${overdueTasks.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">지연</p>
          <p className={`font-head text-2xl font-extrabold ${overdueTasks.length > 0 ? "text-red-600" : "text-nu-ink"}`}>{overdueTasks.length}</p>
        </div>
        <div className={`p-4 border ${todayTasks.length > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">오늘 마감</p>
          <p className={`font-head text-2xl font-extrabold ${todayTasks.length > 0 ? "text-orange-600" : "text-nu-ink"}`}>{todayTasks.length}</p>
        </div>
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT COLUMN (8) ──────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">

          {/* 가입 승인 대기 */}
          {(pendingCount || 0) > 0 && (
            <div className="bg-amber-50/50 border-[2px] border-amber-300/50 p-5">
              <h2 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
                <Users size={14} className="text-amber-500" /> 가입 승인 대기 ({pendingCount})
              </h2>
              <div className="space-y-2">
                {(pendingRequests || []).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-white px-4 py-2.5 border border-nu-ink/[0.06]">
                    <div>
                      <span className="text-sm font-medium">{r.profile?.nickname}</span>
                      <span className="font-mono-nu text-[12px] text-nu-muted ml-2">→ {r.groups?.name}</span>
                    </div>
                    <Link href={`/groups/${r.group_id}/settings`}
                      className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink hover:underline no-underline">
                      승인하기
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 지금 집중 (overdue + today) */}
          {(overdueTasks.length > 0 || todayTasks.length > 0) && (
            <div className="bg-white border-[2px] border-nu-ink/[0.08] p-5">
              <h2 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-4">
                <Zap size={14} className="text-red-500" /> 지금 집중
              </h2>
              <div className="space-y-2">
                {[...overdueTasks, ...todayTasks].map((t: any) => {
                  const isOverdue = t.due_date && t.due_date < todayStr;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 border border-nu-ink/5 hover:bg-nu-cream/20 transition-colors">
                      <StatusDot status={t.status} />
                      <span className="text-sm font-medium text-nu-ink flex-1 truncate">{t.title}</span>
                      {t.project?.title && (
                        <span className="font-mono-nu text-[10px] text-indigo-600 uppercase tracking-widest hidden sm:block">{t.project.title}</span>
                      )}
                      {(t as any)._bolt && (
                        <span className="font-mono-nu text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 border border-purple-200 uppercase tracking-widest">볼트</span>
                      )}
                      {t.priority && (
                        <span className={`font-mono-nu text-[10px] px-1.5 py-0.5 border uppercase tracking-widest ${priorityColors[t.priority] || priorityColors.medium}`}>
                          {t.priority === "urgent" ? "긴급" : t.priority === "high" ? "높음" : ""}
                        </span>
                      )}
                      {t.due_date && (
                        <span className={`font-mono-nu text-[11px] flex items-center gap-0.5 ${isOverdue ? "text-red-600 font-bold" : "text-orange-600"}`}>
                          <Clock size={9} /> {isOverdue ? "지연" : "오늘"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 할일 */}
          <div className="bg-white border-[2px] border-nu-ink/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2">
                <CheckSquare size={14} className="text-indigo-500" /> 할일
              </h2>
              <Link href="/staff/tasks" className="font-mono-nu text-[11px] uppercase tracking-widest text-indigo-500 no-underline hover:underline flex items-center gap-1">
                전체 보기 <ChevronRight size={10} />
              </Link>
            </div>
            {upcomingTasks.length === 0 && overdueTasks.length === 0 && todayTasks.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-nu-ink/10">
                <CheckSquare size={24} className="text-nu-muted/30 mx-auto mb-2" />
                <p className="text-sm text-nu-muted">할당된 할일이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingTasks.slice(0, 6).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-nu-cream/20 transition-colors border border-transparent hover:border-nu-ink/5">
                    <StatusDot status={t.status} />
                    <span className="text-sm text-nu-ink flex-1 truncate">{t.title}</span>
                    {t.project?.title && (
                      <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest hidden sm:block">{t.project.title}</span>
                    )}
                    {(t as any)._bolt && (
                      <span className="font-mono-nu text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 border border-purple-200 uppercase tracking-widest">볼트</span>
                    )}
                    {t.priority && t.priority !== "medium" && (
                      <span className={`font-mono-nu text-[10px] px-1.5 py-0.5 border uppercase tracking-widest ${priorityColors[t.priority] || ""}`}>
                        {t.priority === "urgent" ? "긴급" : t.priority === "high" ? "높음" : t.priority === "low" ? "낮음" : ""}
                      </span>
                    )}
                    {t.due_date && (
                      <span className="font-mono-nu text-[11px] text-nu-muted flex items-center gap-0.5">
                        <Clock size={9} /> {new Date(t.due_date + "T00:00:00").toLocaleDateString("ko", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 내 너트 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Layers size={16} /> 내 너트
              </h2>
              <Link href="/groups" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            {groupCount === 0 ? (
              <div className="bg-white border border-nu-ink/[0.08] p-8 text-center">
                <Layers size={28} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-nu-muted text-sm mb-3">아직 너트가 없습니다</p>
                <Link href="/groups"
                  className="font-mono-nu text-[13px] uppercase tracking-widest bg-nu-ink text-nu-paper px-5 py-2.5 no-underline hover:bg-nu-pink transition-colors inline-block">
                  너트 탐색하기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {memberships?.slice(0, 4).map((m: any) => {
                  const g = m.groups;
                  if (!g || g.is_active === false) return null;
                  const cat = getCategory(g.category);
                  return (
                    <Link key={g.id} href={`/groups/${g.id}`}
                      className="bg-white border border-nu-ink/[0.08] p-4 no-underline hover:border-indigo-300 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 text-white font-bold ${cat?.color || "bg-nu-ink/30"}`}>
                          {cat?.label || g.category}
                        </span>
                        {m.role === "host" && (
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">Host</span>
                        )}
                      </div>
                      <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-indigo-600 transition-colors truncate">{g.name}</h3>
                      <p className="text-[13px] text-nu-muted mt-1 line-clamp-1">{g.description || "-"}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내 볼트 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <Briefcase size={16} /> 내 볼트
              </h2>
              <Link href="/projects" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-1">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            {projectCount === 0 ? (
              <div className="bg-white border border-nu-ink/[0.08] p-8 text-center">
                <Briefcase size={28} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-nu-muted text-sm mb-3">참여 중인 볼트가 없습니다</p>
                <Link href="/projects"
                  className="font-mono-nu text-[13px] uppercase tracking-widest bg-nu-ink text-nu-paper px-5 py-2.5 no-underline hover:bg-nu-pink transition-colors inline-block">
                  볼트 탐색하기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectMemberships?.slice(0, 4).map((pm: any) => {
                  const p = pm.projects;
                  if (!p || !["active", "draft"].includes(p.status)) return null;
                  const cat = getCategory(p.category);
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="bg-white border border-nu-ink/[0.08] p-4 no-underline hover:border-purple-300 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 ${p.status === "active" ? "bg-green-500 text-white" : "bg-nu-muted/20 text-nu-muted"}`}>
                          {p.status === "active" ? "진행중" : p.status}
                        </span>
                        {pm.role === "lead" && (
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-purple-50 text-purple-600 px-1.5 py-0.5">PM</span>
                        )}
                        {cat && (
                          <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 text-white ${cat.color}`}>{cat.label}</span>
                        )}
                      </div>
                      <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-purple-600 transition-colors truncate">{p.title}</h3>
                      <p className="text-[13px] text-nu-muted mt-1 line-clamp-1">{p.description || "-"}</p>
                      <div className="flex items-center justify-between mt-2">
                        {pm.reward_ratio ? (
                          <span className="font-mono-nu text-[12px] font-bold text-green-600">{pm.reward_ratio}% 배분</span>
                        ) : <span />}
                        <ArrowUpRight size={13} className="text-nu-muted/40 group-hover:text-purple-600 transition-colors" />
                      </div>
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
              <div className="bg-white border border-nu-ink/[0.08] p-8 text-center">
                <Activity size={28} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-nu-muted text-sm mb-3">아직 커뮤니티 활동이 없습니다</p>
                <Link href="/groups"
                  className="font-mono-nu text-[13px] uppercase tracking-widest bg-nu-ink text-nu-paper px-5 py-2.5 no-underline hover:bg-nu-pink transition-colors inline-block">
                  너트에서 대화 시작하기
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a: any) => {
                  const group = Array.isArray(a.group) ? a.group[0] : a.group;
                  if (!group || group.is_active === false) return null;
                  return (
                    <div key={a.id} className="bg-white border border-nu-ink/[0.06] px-4 py-3 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-nu-ink/5 flex items-center justify-center font-head text-[12px] font-bold text-nu-ink shrink-0">
                        {(a.author?.nickname || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-nu-ink">{a.author?.nickname}</span>
                          <Link href={`/groups/${group.id}`}
                            className="font-mono-nu text-[11px] uppercase tracking-widest text-indigo-500 hover:underline no-underline">
                            #{group.name}
                          </Link>
                          <span className="font-mono-nu text-[11px] text-nu-muted/60 ml-auto">{timeAgo(a.created_at)}</span>
                        </div>
                        <p className="text-xs text-nu-muted mt-0.5 line-clamp-2">{a.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR (4) ────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-5">

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/groups", label: "너트", icon: Layers, color: "text-indigo-600" },
              { href: "/projects", label: "볼트", icon: Briefcase, color: "text-purple-600" },
              { href: "/staff/tasks", label: "할일", icon: CheckSquare, color: "text-green-600" },
              { href: "/staff/calendar", label: "캘린더", icon: Calendar, color: "text-nu-pink" },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2 bg-white border border-nu-ink/[0.06] px-3 py-3 no-underline hover:border-indigo-200 transition-colors group">
                <item.icon size={14} className={item.color} />
                <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite group-hover:text-nu-ink">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* 스킬 태그 */}
          {skills.length > 0 && (
            <div className="bg-white border border-nu-ink/[0.08] p-4">
              <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-2">내 스킬</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s: string) => (
                  <span key={s} className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600">
                    #{s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Google 할일 (Google Tasks) */}
          <MyTasksWidget />

          {/* Google 캘린더 */}
          <MyCalendarWidget />

          {/* 너트 일정 */}
          {eventCount > 0 && (
            <div className="bg-white border border-nu-ink/[0.08] p-5">
              <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-indigo-500" /> 너트 일정
              </h3>
              <div className="space-y-3">
                {events?.map((evt: any) => (
                  <Link key={evt.id} href={`/groups/${evt.group_id}/events/${evt.id}`}
                    className="flex items-center gap-3 py-1 no-underline hover:bg-nu-cream/20 transition-colors -mx-2 px-2 group">
                    <div className="w-10 h-10 bg-indigo-50 flex flex-col items-center justify-center shrink-0 border border-indigo-200">
                      <span className="font-head text-sm font-extrabold text-indigo-600 leading-none">
                        {new Date(evt.start_at).getDate()}
                      </span>
                      <span className="font-mono-nu text-[10px] uppercase text-indigo-400">
                        {new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate group-hover:text-indigo-600 transition-colors">{evt.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[12px] text-nu-muted">
                          <Clock size={10} />
                          {new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1 text-[12px] text-nu-muted truncate">
                            <MapPin size={10} /> {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 성장 현황 */}
          <div className="bg-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2 mb-3">
              <TrendingUp size={14} /> 성장 현황
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">너트 활동</span>
                  <span className="font-head text-sm font-bold text-nu-ink">{groupCount}/5</span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min((groupCount / 5) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">볼트 참여</span>
                  <span className="font-head text-sm font-bold text-nu-ink">{projectCount}/3</span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min((projectCount / 3) * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">강성 점수</span>
                  <span className="font-head text-sm font-bold text-nu-ink">{activityScore}</span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(activityScore, 100)}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-nu-ink/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">현재 등급</span>
                  <span className={`inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 border ${gradeInfo.cls}`}>
                    <GradeIcon size={9} /> {gradeInfo.label}
                  </span>
                </div>
                {grade === "bronze" && (
                  <p className="text-[12px] text-nu-muted mt-1.5">너트에 더 참여하면 실버로 승급됩니다</p>
                )}
                {grade === "silver" && (
                  <p className="text-[12px] text-nu-muted mt-1.5">볼트에 참여하면 골드로 승급 가능합니다</p>
                )}
                {(grade === "gold" || grade === "vip") && (
                  <p className="text-[12px] text-green-600 mt-1.5">✓ 너트와 볼트를 개설할 수 있습니다</p>
                )}
              </div>
            </div>
          </div>

          {/* 빠른 이동 */}
          <div className="bg-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-3">빠른 이동</h3>
            <div className="space-y-1">
              {[
                { href: "/groups",       label: "너트 탐색",     icon: Layers,    color: "text-indigo-500" },
                { href: "/projects",     label: "볼트 탐색",     icon: Briefcase, color: "text-purple-500" },
                { href: "/members",      label: "와셔 탐색",     icon: Users,     color: "text-nu-pink" },
                { href: "/profile",      label: "내 프로필",     icon: Star,      color: "text-amber-500" },
                { href: "/notifications",label: "알림",          icon: Bell,      color: "text-nu-muted" },
              ].map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-nu-cream/30 transition-colors no-underline group">
                  <item.icon size={13} className={item.color} />
                  <span className="text-sm text-nu-graphite group-hover:text-nu-ink">{item.label}</span>
                  <ChevronRight size={11} className="ml-auto text-nu-muted/30 group-hover:text-indigo-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
