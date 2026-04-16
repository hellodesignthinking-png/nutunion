import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, CheckSquare, FileText, Calendar, Plus, ArrowRight, Clock, Activity, Zap, ExternalLink, Circle, CheckCircle2 } from "lucide-react";
import { TodayCalendarWidget } from "./today-calendar-widget";
import { AICommandBar } from "./ai-command-bar";
import { MonitorWidget } from "./monitor-widget";
import { TeamActivityWidget } from "./team-activity-widget";
import { PinnedItems } from "./pinned-items";

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split("T")[0];

  // Parallel data fetching — 스태프 + 볼트(커뮤니티) 프로젝트
  const [projectsRes, tasksRes, filesRes, activityRes, boltProjectsRes, boltTasksRes] = await Promise.allSettled([
    supabase.from("staff_projects").select("id, title, status, category, created_at, updated_at").eq("status", "active").order("updated_at", { ascending: false }).limit(6),
    supabase.from("staff_tasks").select("id, title, status, priority, due_date, project:staff_projects(title)").eq("assigned_to", user!.id).in("status", ["todo", "in_progress"]).order("due_date", { ascending: true }).limit(12),
    supabase.from("staff_files").select("id, title, mime_type, drive_url, created_at, creator:profiles!staff_files_created_by_fkey(nickname)").order("created_at", { ascending: false }).limit(5),
    supabase.from("staff_activity").select("id, action, target_type, metadata, created_at, user:profiles!staff_activity_user_id_fkey(nickname, avatar_url)").order("created_at", { ascending: false }).limit(8),
    // 볼트 프로젝트 — 내가 멤버인 커뮤니티 프로젝트
    supabase.from("project_members").select("project:projects(id, title, status, category, updated_at)").eq("user_id", user!.id).limit(10),
    // 볼트 태스크 — 내가 배정된 커뮤니티 태스크
    supabase.from("project_tasks").select("id, title, status, milestone:project_milestones(title, project:projects(id, title))").eq("assigned_to", user!.id).in("status", ["todo", "in_progress"]).limit(6),
  ]);

  const projects = projectsRes.status === "fulfilled" ? projectsRes.value.data : null;
  const myTasks = tasksRes.status === "fulfilled" ? tasksRes.value.data : null;
  const recentFiles = filesRes.status === "fulfilled" ? filesRes.value.data : null;
  const recentActivity = activityRes.status === "fulfilled" ? activityRes.value.data : null;
  const boltMemberships = boltProjectsRes.status === "fulfilled" ? boltProjectsRes.value.data : null;
  const boltTasks = boltTasksRes.status === "fulfilled" ? boltTasksRes.value.data : null;

  // 볼트 프로젝트 추출
  const boltProjects = (boltMemberships || [])
    .map((m: any) => m.project)
    .filter((p: any) => p && p.status === "active");

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  function StatusDot({ status }: { status: string }) {
    if (status === "done") return <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
    if (status === "in_progress") return (
      <div className="relative shrink-0">
        <Circle size={16} className="text-indigo-400" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        </div>
      </div>
    );
    return <Circle size={16} className="text-nu-muted/40 shrink-0" />;
  }

  const mimeIcon = (mime: string | null) => {
    if (!mime) return "\uD83D\uDCC4";
    if (mime.includes("document") || mime.includes("doc")) return "\uD83D\uDCDD";
    if (mime.includes("spreadsheet") || mime.includes("sheet")) return "\uD83D\uDCCA";
    if (mime.includes("presentation") || mime.includes("slide")) return "\uD83D\uDCBD";
    if (mime.includes("pdf")) return "\uD83D\uDCD5";
    if (mime.includes("image")) return "\uD83D\uDDBC\uFE0F";
    return "\uD83D\uDCC4";
  };

  const actionLabel: Record<string, string> = {
    file_added: "\uD30C\uC77C \uCD94\uAC00",
    task_created: "\uD560\uC77C \uC0DD\uC131",
    task_completed: "\uD560\uC77C \uC644\uB8CC",
    comment_added: "\uCF54\uBA58\uD2B8 \uC791\uC131",
    member_joined: "\uBA64\uBC84 \uCC38\uC5EC",
    project_created: "\uD504\uB85C\uC81D\uD2B8 \uC0DD\uC131",
  };

  // 오늘 할일 / 지연 할일 계산
  const activeTasks = (myTasks || []).filter((t: any) => t.status !== "done");
  const overdueTasks = activeTasks.filter((t: any) => {
    if (!t.due_date) return false;
    return t.due_date < todayISO;
  });
  const todayTasks = activeTasks.filter((t: any) => t.due_date === todayISO);
  const upcomingTasks = activeTasks.filter((t: any) => {
    if (!t.due_date) return true; // 마감일 없는 것도 표시
    return t.due_date > todayISO;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">오늘의 워크스페이스</h1>
          <p className="font-mono-nu text-[13px] text-nu-muted mt-1 uppercase tracking-widest">
            {today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <Link
          href="/staff/workspace/create"
          className="inline-flex items-center gap-2 font-mono-nu text-[13px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white no-underline hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> <span className="hidden sm:inline">새 프로젝트</span><span className="sm:hidden">추가</span>
        </Link>
      </div>

      {/* AI Command Bar */}
      <AICommandBar />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <div className="bg-white border border-nu-ink/[0.06] p-4">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">스태프 프로젝트</p>
          <p className="font-head text-2xl font-extrabold text-indigo-600">{(projects || []).length}</p>
        </div>
        <div className="bg-white border border-nu-ink/[0.06] p-4">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">볼트 프로젝트</p>
          <p className="font-head text-2xl font-extrabold text-purple-600">{boltProjects.length}</p>
        </div>
        <div className="bg-white border border-nu-ink/[0.06] p-4">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">내 할일</p>
          <p className="font-head text-2xl font-extrabold text-nu-ink">{activeTasks.length}</p>
        </div>
        <div className={`border p-4 ${overdueTasks.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">지연</p>
          <p className={`font-head text-2xl font-extrabold ${overdueTasks.length > 0 ? "text-red-600" : "text-nu-ink"}`}>{overdueTasks.length}</p>
        </div>
        <div className={`border p-4 ${todayTasks.length > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-1">오늘 마감</p>
          <p className={`font-head text-2xl font-extrabold ${todayTasks.length > 0 ? "text-orange-600" : "text-nu-ink"}`}>{todayTasks.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Main Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* 오늘 집중 할일 (지연 + 오늘 마감) */}
          {(overdueTasks.length > 0 || todayTasks.length > 0) && (
            <section>
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2 mb-4">
                <Zap size={18} className="text-red-500" /> 지금 집중
              </h2>
              <div className="space-y-2">
                {[...overdueTasks, ...todayTasks].map((task: any) => {
                  const isOverdue = task.due_date && task.due_date < todayISO;
                  return (
                    <div key={task.id} className={`flex items-center gap-3 px-4 py-3 border transition-colors ${
                      isOverdue ? "bg-red-50/50 border-red-200" : "bg-orange-50/30 border-orange-200"
                    }`}>
                      <StatusDot status={task.status} />
                      <div className="flex-1 min-w-0">
                        <p className="font-head text-sm font-bold text-nu-ink truncate">{task.title}</p>
                        {task.project && (
                          <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">{(task.project as any).title}</p>
                        )}
                      </div>
                      <span className={`font-mono-nu text-[11px] uppercase px-2 py-0.5 ${priorityColor[task.priority] || ""}`}>
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className={`font-mono-nu text-[11px] flex items-center gap-1 ${isOverdue ? "text-red-600 font-bold" : "text-orange-600 font-bold"}`}>
                          <Clock size={10} />
                          {isOverdue ? "지연 " : "오늘 "}{new Date(task.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 할일 목록 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <CheckSquare size={18} className="text-indigo-600" /> 할일
              </h2>
              <Link href="/staff/tasks" className="font-mono-nu text-[12px] text-indigo-600 no-underline uppercase tracking-widest hover:underline flex items-center gap-1">
                전체 보기 <ArrowRight size={10} />
              </Link>
            </div>
            {upcomingTasks.length > 0 ? (
              <div className="space-y-2">
                {upcomingTasks.slice(0, 6).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors">
                    <StatusDot status={task.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{task.title}</p>
                      {task.project && (
                        <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">{(task.project as any).title}</p>
                      )}
                    </div>
                    <span className={`font-mono-nu text-[11px] uppercase px-2 py-0.5 ${priorityColor[task.priority] || ""}`}>
                      {task.priority}
                    </span>
                    {task.due_date && (
                      <span className="font-mono-nu text-[11px] text-nu-muted flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(task.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-nu-ink/10 p-10 text-center bg-white/50">
                <CheckSquare size={32} className="mx-auto mb-3 text-nu-ink/15" />
                <p className="text-sm text-nu-muted">할당된 할일이 없습니다</p>
              </div>
            )}
          </section>

          {/* 볼트 태스크 (커뮤니티 프로젝트 할일) */}
          {boltTasks && (boltTasks as any[]).length > 0 && (
            <section>
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2 mb-4">
                <Zap size={18} className="text-purple-600" /> 볼트 태스크
              </h2>
              <div className="space-y-2">
                {(boltTasks as any[]).map((bt: any) => (
                  <Link
                    key={bt.id}
                    href={`/projects/${bt.milestone?.project?.id}`}
                    className="flex items-center gap-3 px-4 py-3 bg-white border border-purple-100 hover:border-purple-300 transition-colors no-underline"
                  >
                    <StatusDot status={bt.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{bt.title}</p>
                      <p className="font-mono-nu text-[11px] text-purple-600 uppercase tracking-widest">
                        {bt.milestone?.project?.title} · {bt.milestone?.title}
                      </p>
                    </div>
                    <span className="font-mono-nu text-[11px] px-2 py-0.5 bg-purple-100 text-purple-700 uppercase">볼트</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 프로젝트 모니터링 */}
          <MonitorWidget />

          {/* 프로젝트 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                <FolderOpen size={18} className="text-indigo-600" /> 프로젝트
              </h2>
              <Link href="/staff/workspace" className="font-mono-nu text-[12px] text-indigo-600 no-underline uppercase tracking-widest hover:underline flex items-center gap-1">
                전체 보기 <ArrowRight size={10} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 스태프 프로젝트 */}
              {(projects || []).slice(0, 4).map((p: any) => (
                <Link
                  key={p.id}
                  href={`/staff/workspace/${p.id}`}
                  className="block p-5 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-all no-underline group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600">
                      {p.category || "general"}
                    </span>
                  </div>
                  <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-indigo-600 transition-colors truncate">{p.title}</h3>
                  <p className="font-mono-nu text-[11px] text-nu-muted mt-1">
                    {new Date(p.updated_at || p.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 업데이트
                  </p>
                </Link>
              ))}
              {/* 볼트 프로젝트 */}
              {boltProjects.slice(0, 2).map((p: any) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block p-5 bg-white border border-purple-100 hover:border-purple-300 transition-all no-underline group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 bg-purple-50 text-purple-600">
                      볼트 · {p.category || "general"}
                    </span>
                  </div>
                  <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-purple-600 transition-colors truncate">{p.title}</h3>
                  <p className="font-mono-nu text-[11px] text-nu-muted mt-1">
                    {new Date(p.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 업데이트
                  </p>
                </Link>
              ))}
            </div>
            {(projects || []).length === 0 && boltProjects.length === 0 && (
              <div className="border-2 border-dashed border-nu-ink/10 p-10 text-center bg-white/50">
                <FolderOpen size={32} className="mx-auto mb-3 text-nu-ink/15" />
                <p className="text-sm text-nu-muted mb-3">아직 프로젝트가 없습니다</p>
                <Link href="/staff/workspace/create" className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-indigo-600 text-white no-underline hover:bg-indigo-700 inline-flex items-center gap-1.5">
                  <Plus size={12} /> 첫 프로젝트 만들기
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Right: Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "프로젝트", href: "/staff/workspace", icon: <FolderOpen size={16} /> },
              { label: "할일", href: "/staff/tasks", icon: <CheckSquare size={16} /> },
              { label: "파일", href: "/staff/files", icon: <FileText size={16} /> },
              { label: "캘린더", href: "/staff/calendar", icon: <Calendar size={16} /> },
            ].map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex items-center gap-2 py-3 px-3 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 hover:bg-indigo-50/30 transition-all no-underline group"
              >
                <span className="text-nu-muted group-hover:text-indigo-600 transition-colors">{q.icon}</span>
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite group-hover:text-indigo-600">{q.label}</span>
              </Link>
            ))}
          </div>

          {/* Pinned Items */}
          <PinnedItems />

          {/* Team Activity */}
          <TeamActivityWidget />

          {/* Today's Calendar */}
          <TodayCalendarWidget />

          {/* Recent Files */}
          <section className="bg-white border border-nu-ink/[0.06]">
            <div className="p-4 border-b border-nu-ink/5">
              <h3 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                <FileText size={14} className="text-indigo-600" /> 최근 파일
              </h3>
            </div>
            {recentFiles && recentFiles.length > 0 ? (
              <div className="divide-y divide-nu-ink/5">
                {recentFiles.map((f: any) => (
                  <a
                    key={f.id}
                    href={f.drive_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 hover:bg-indigo-50/50 transition-colors no-underline"
                  >
                    <div className="flex items-center gap-2">
                      <span>{mimeIcon(f.mime_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-head text-xs font-bold text-nu-ink truncate">{f.title}</p>
                        <p className="font-mono-nu text-[10px] text-nu-muted">
                          {(f.creator as any)?.nickname || "Unknown"} · {new Date(f.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="font-mono-nu text-[12px] text-nu-muted">아직 파일이 없습니다</p>
              </div>
            )}
          </section>

          {/* Activity Feed */}
          <section className="bg-white border border-nu-ink/[0.06]">
            <div className="p-4 border-b border-nu-ink/5">
              <h3 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                <Activity size={14} className="text-indigo-600" /> 최근 활동
              </h3>
            </div>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="divide-y divide-nu-ink/5">
                {recentActivity.map((a: any) => (
                  <div key={a.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-head text-[13px] font-bold text-nu-ink">{(a.user as any)?.nickname || "System"}</span>
                      <span className="font-mono-nu text-[11px] text-indigo-600">{actionLabel[a.action] || a.action}</span>
                    </div>
                    <p className="font-mono-nu text-[10px] text-nu-muted">
                      {new Date(a.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="font-mono-nu text-[12px] text-nu-muted">최근 활동이 없습니다</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
