import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Settings, Calendar, UserPlus, Clock, CheckCircle2, AlertCircle, TrendingUp, Users } from "lucide-react";
import { TabsInner } from "./tabs-inner";
import { PageHero } from "@/components/shared/page-hero";
import { SquadRecommender } from "@/components/projects/squad-recommender";
import { MilestoneSettlement } from "@/components/projects/milestone-settlement";
import { CancelApplicationButton } from "@/components/projects/cancel-application-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("title, description").eq("id", id).single();
    if (error || !project) {
      return { title: "볼트 — nutunion", description: "nutunion 볼트" };
    }
    return {
      title: `${project.title} — nutunion`,
      description: project.description || "nutunion 볼트",
    };
  } catch {
    return { title: "볼트 — nutunion", description: "nutunion 볼트" };
  }
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const statusConfig: Record<string, { bg: string; label: string; icon: "clock" | "check" | "pencil" | "archive" }> = {
  draft: { bg: "bg-nu-gray text-white", label: "준비중", icon: "pencil" },
  active: { bg: "bg-green-600 text-white", label: "진행중", icon: "clock" },
  completed: { bg: "bg-nu-blue text-white", label: "완료", icon: "check" },
  archived: { bg: "bg-nu-muted text-white", label: "보관", icon: "archive" },
};

function formatDateClean(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  // ── 필수 데이터 조회 (헤더를 즉시 보여주기 위함) ─────────────────────────
  const [projectRes, profileRes, applicationRes, milestoneCountRes, memberCountRes] = await Promise.all([
    supabase.from("projects").select("*, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url)").eq("id", id).single(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("project_applications").select("status").eq("project_id", id).eq("applicant_id", user.id).maybeSingle(),
    supabase.from("project_milestones").select("id, status").eq("project_id", id),
    supabase.from("project_members").select("id", { count: "exact" }).eq("project_id", id),
  ]);

  const project = projectRes.data;
  const profile = profileRes.data;
  const application = applicationRes.data;

  if (projectRes.error || !project) notFound();

  const isAdmin = profile?.role === "admin";
  const applicationStatus = application?.status as "pending" | "approved" | "rejected" | "withdrawn" | null;

  // Milestone quick stats for sidebar
  const allMilestones = milestoneCountRes.data || [];
  const totalMilestones = allMilestones.length;
  const completedMilestones = allMilestones.filter((m: any) => m.status === "completed").length;
  const milestoneProgressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const memberCount = memberCountRes.count || 0;

  const statusCfg = statusConfig[project.status] || statusConfig.draft;

  return (
    <>
      <PageHero
        category={project.category}
        title={project.title}
        description={project.description || ""}
      />

      {/* Detail Meta & Actions — constrained width */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-0 border-b border-nu-ink/5 pb-6">
          <div className="flex flex-wrap items-center gap-4 font-mono-nu text-[11px]">
            {/* Prominent status badge */}
            <span className={`font-mono-nu text-[11px] font-black uppercase tracking-[0.12em] px-4 py-2 inline-flex items-center gap-2 ${statusCfg.bg}`}>
              {statusCfg.icon === "clock" && <Clock size={14} />}
              {statusCfg.icon === "check" && <CheckCircle2 size={14} />}
              {statusCfg.icon === "pencil" && <AlertCircle size={14} />}
              {statusCfg.icon === "archive" && <AlertCircle size={14} />}
              {statusCfg.label}
            </span>
            {project.start_date && (
              <span className="flex items-center gap-1.5 text-nu-muted">
                <Calendar size={13} />
                <span>{formatDateClean(project.start_date)}</span>
                {project.end_date && (
                  <>
                    <span className="text-nu-ink/20 mx-1">—</span>
                    <span>{formatDateClean(project.end_date)}</span>
                  </>
                )}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-nu-muted">
              <Users size={13} /> {memberCount}명
            </span>
            <span className="text-nu-muted">진행자: <span className="text-nu-ink font-bold">{project.creator?.nickname || "—"}</span></span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Milestone quick progress (visible without entering tabs) */}
            {totalMilestones > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-[2px] border-nu-ink/10 font-mono-nu text-[10px] uppercase tracking-widest">
                <TrendingUp size={13} className="text-nu-pink" />
                <span className="text-nu-ink font-bold">진행률 {milestoneProgressPct}%</span>
                <span className="text-nu-muted">· 마일스톤 {completedMilestones}/{totalMilestones}</span>
              </div>
            )}

            {/* Application button states */}
            {!isAdmin && applicationStatus === "pending" && (
              <div className="flex items-center gap-2">
                <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-amber-500 text-white inline-flex items-center gap-2">
                  <Clock size={14} /> 승인 대기 중
                </span>
                <CancelApplicationButton projectId={id} userId={user.id} />
              </div>
            )}
            {!isAdmin && applicationStatus === "approved" && (
              <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-green-600 text-white inline-flex items-center gap-2">
                <CheckCircle2 size={14} /> 참여중
              </span>
            )}
            {!isAdmin && applicationStatus === "rejected" && (
              <Link href={`/projects/${id}/apply`} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all inline-flex items-center gap-2">
                다시 지원하기
              </Link>
            )}
            {!isAdmin && !applicationStatus && project.status === "active" && (
              <Link href={`/projects/${id}/apply`} className="font-mono-nu text-[12px] font-black uppercase tracking-widest px-8 py-3.5 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-all inline-flex items-center gap-2 shadow-lg shadow-nu-pink/20 border-[2px] border-nu-pink">
                <UserPlus size={16} /> 볼트 참여하기
              </Link>
            )}
            {isAdmin && (
              <Link href={`/projects/${id}/settings`} className="font-mono-nu text-[11px] uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all inline-flex items-center gap-2">
                <Settings size={14} /> 볼트 설정
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — full-width container for split-view panels */}
      <div className="mx-auto px-4 md:px-8 pb-24">
        <Suspense fallback={
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <div className="h-64 bg-nu-ink/5 animate-pulse" />
            </div>
            <div className="h-64 bg-nu-ink/5 animate-pulse" />
          </div>
        }>
          <ProjectTabsWrapper id={id} userId={user.id} isAdmin={isAdmin} project={project} />
        </Suspense>

        {/* AI Squad & Settlement */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
          <SquadRecommender projectId={id} projectTitle={project.title} />
          <MilestoneSettlement projectId={id} userId={user.id} />
        </div>
      </div>
    </>
  );
}

async function ProjectTabsWrapper({ id, userId, isAdmin, project }: any) {
  const supabase = await createClient();

  // Run queries with individual fallbacks for resilience
  let milestones: any[] = [];
  let members: any[] = [];
  let updates: any[] = [];
  let events: any[] = [];

  // Milestones — basic query first, then try enriched
  const msBasic = await supabase.from("project_milestones").select("*").eq("project_id", id).order("sort_order");
  if (msBasic.data) {
    // Try to enrich with tasks
    const msRich = await supabase.from("project_milestones").select("*, tasks:project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url))").eq("project_id", id).order("sort_order");
    if (!msRich.error && msRich.data) {
      milestones = msRich.data;
    } else {
      milestones = msBasic.data.map((m: any) => ({ ...m, tasks: [] }));
    }
  }

  // Members — try with profile+crew join, fallback to basic
  const memRes = await supabase.from("project_members").select("*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url, email), crew:groups!project_members_crew_id_fkey(id, name, category, image_url)").eq("project_id", id).order("joined_at");
  if (!memRes.error && memRes.data) {
    members = memRes.data;
  } else {
    const memBasic = await supabase.from("project_members").select("*").eq("project_id", id).order("joined_at");
    members = memBasic.data || [];
  }

  // Updates — try with author join, fallback to basic
  const updRes = await supabase.from("project_updates").select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
  if (!updRes.error && updRes.data) {
    updates = updRes.data;
  } else {
    const updBasic = await supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
    updates = updBasic.data || [];
  }

  // Events
  const evtRes = await supabase.from("events").select("*, group:groups(name)").eq("project_id", id).order("start_at").limit(10);
  events = evtRes.data || [];

  const membersList = members || [];
  const userMembers = membersList.filter((m: any) => m.user_id && m.profile);
  const crewMembers = membersList.filter((m: any) => m.crew_id && m.crew);
  const isMember  = membersList.some((m: any) => m.user_id === userId);
  const isLead    = membersList.some((m: any) => m.user_id === userId && m.role === "lead");
  const isManager = membersList.some((m: any) => m.user_id === userId && (m.role === "manager" || m.role === "lead"));
  const canEdit   = isLead || isAdmin;

  const allTasks = (milestones || []).flatMap((m: any) => m.tasks || []);
  const taskStats = {
    todo: allTasks.filter((t: any) => t.status === "todo").length,
    in_progress: allTasks.filter((t: any) => t.status === "in_progress").length,
    done: allTasks.filter((t: any) => t.status === "done").length,
  };
  const totalTasks = taskStats.todo + taskStats.in_progress + taskStats.done;
  const progressPct = totalTasks > 0 ? Math.round((taskStats.done / totalTasks) * 100) : 0;

  return (
    <TabsInner
      projectId={id}
      milestonesData={JSON.stringify(milestones || [])}
      updatesData={JSON.stringify(updates || [])}
      userMembersData={JSON.stringify(userMembers)}
      crewMembersData={JSON.stringify(crewMembers)}
      eventsData={JSON.stringify(events || [])}
      canEdit={canEdit}
      userId={userId}
      isMember={isMember}
      taskStats={taskStats}
      progressPct={progressPct}
      totalTasks={totalTasks}
      projectData={JSON.stringify(project)}
    />
  );
}
