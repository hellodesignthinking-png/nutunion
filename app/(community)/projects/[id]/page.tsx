import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Settings, Calendar, MessageCircle, UserPlus, ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { TabsInner } from "./tabs-inner";
import { PageHero } from "@/components/shared/page-hero";
import { SquadRecommender } from "@/components/projects/squad-recommender";
import { MilestoneSettlement } from "@/components/projects/milestone-settlement";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("title, description").eq("id", id).single();
  return {
    title: project ? `${project.title} — nutunion` : "프로젝트 — nutunion",
    description: project?.description || "nutunion 프로젝트",
  };
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const statusColors: Record<string, string> = {
  draft: "bg-nu-gray text-white",
  active: "bg-green-600 text-white",
  completed: "bg-nu-blue text-white",
  archived: "bg-nu-muted text-white",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  // ── 필수 데이터 조회 (헤더를 즉시 보여주기 위함) ─────────────────────────
  const [
    { data: project },
    { data: profile },
    { data: application },
  ] = await Promise.all([
    supabase.from("projects").select("*, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url)").eq("id", id).single(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("project_applications").select("status").eq("project_id", id).eq("applicant_id", user.id).maybeSingle(),
  ]);

  if (!project) notFound();

  const isAdmin = profile?.role === "admin";
  const applicationStatus = application?.status as "pending" | "approved" | "rejected" | "withdrawn" | null;
  const dateRange = project.start_date ? `${new Date(project.start_date).toLocaleDateString("ko")} — ${project.end_date ? new Date(project.end_date).toLocaleDateString("ko") : ""}` : "";

  return (
    <>
      <PageHero 
        category={project.category}
        title={project.title}
        description={project.description || ""}
      />

      <div className="max-w-6xl mx-auto px-8 py-12 pb-24">
        {/* Detail Meta & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-nu-ink/5 pb-8">
          <div className="flex flex-wrap items-center gap-6 font-mono-nu text-[11px]">
            <span className="flex items-center gap-1.5 text-nu-muted">
              <Clock size={12} /> {project.status.toUpperCase()}
            </span>
            {dateRange && (
              <span className="flex items-center gap-1.5 text-nu-muted">
                <Calendar size={12} /> {dateRange}
              </span>
            )}
            <span className="text-nu-muted">진행자: <span className="text-nu-ink font-bold">{project.creator?.nickname || "—"}</span></span>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isAdmin && applicationStatus === "pending" && (
              <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-amber text-white inline-flex items-center gap-2">
                <Clock size={14} /> 승인 대기 중
              </span>
            )}
            {!isAdmin && !applicationStatus && project.status === "active" && (
              <Link href={`/projects/${id}/apply`} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-8 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-all inline-flex items-center gap-2 shadow-lg shadow-nu-pink/20">
                <UserPlus size={14} /> 프로젝트 참여하기
              </Link>
            )}
            {isAdmin && (
              <Link href={`/projects/${id}/settings`} className="font-mono-nu text-[11px] uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all inline-flex items-center gap-2">
                <Settings size={14} /> 프로젝트 설정
              </Link>
            )}
          </div>
        </div>

        <Suspense fallback={
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-4">
              <div className="h-64 bg-nu-ink/5 animate-pulse" />
            </div>
            <div className="h-64 bg-nu-ink/5 animate-pulse" />
          </div>
        }>
          <ProjectTabsWrapper id={id} userId={user.id} isAdmin={isAdmin} project={project} />
        </Suspense>

        {/* AI Squad & Settlement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
          <SquadRecommender projectId={id} projectTitle={project.title} />
          <MilestoneSettlement projectTitle={project.title} />
        </div>
      </div>
    </>
  );
}

async function ProjectTabsWrapper({ id, userId, isAdmin, project }: any) {
  const supabase = await createClient();
  
  const [
    { data: milestones },
    { data: members },
    { data: updates },
    { data: events },
  ] = await Promise.all([
    supabase.from("project_milestones").select("*, tasks:project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url))").eq("project_id", id).order("sort_order"),
    supabase.from("project_members").select("*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url, email), crew:groups!project_members_crew_id_fkey(id, name, category, image_url)").eq("project_id", id).order("joined_at"),
    supabase.from("project_updates").select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("events").select("*, group:groups(name)").eq("project_id", id).order("start_at").limit(10),
  ]);

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
