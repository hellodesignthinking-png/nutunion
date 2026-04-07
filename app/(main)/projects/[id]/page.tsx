import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings, Calendar, MessageCircle, UserPlus, ClipboardList, CheckCircle2, Clock } from "lucide-react";
import type {
  Project,
  ProjectMember,
  ProjectMilestone,
  ProjectUpdate,
  Profile,
} from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description")
    .eq("id", id)
    .single();
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

import { TabsInner } from "./tabs-inner";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url)"
    )
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Fetch profile for admin check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch milestones with tasks
  const { data: milestones } = await supabase
    .from("project_milestones")
    .select(
      "*, tasks:project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url))"
    )
    .eq("project_id", id)
    .order("sort_order");

  // Fetch members
  const { data: members } = await supabase
    .from("project_members")
    .select(
      "*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url, email), crew:groups!project_members_crew_id_fkey(id, name, category, image_url)"
    )
    .eq("project_id", id)
    .order("joined_at");

  // Fetch updates
  const { data: updates } = await supabase
    .from("project_updates")
    .select(
      "*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)"
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch linked events
  const { data: events } = await supabase
    .from("events")
    .select("*, group:groups(name)")
    .eq("project_id", id)
    .order("start_at")
    .limit(10);

  // Fetch application status
  const { data: application } = await supabase
    .from("project_applications")
    .select("status")
    .eq("project_id", id)
    .eq("applicant_id", user.id)
    .maybeSingle();

  const applicationStatus = application?.status as "pending" | "approved" | "rejected" | "withdrawn" | null;

  const membersList = members || [];
  const userMembers = membersList.filter((m: any) => m.user_id && m.profile);
  const crewMembers = membersList.filter((m: any) => m.crew_id && m.crew);
  const isMember = membersList.some((m: any) => m.user_id === user.id);
  const isLead = membersList.some(
    (m: any) => m.user_id === user.id && m.role === "lead"
  );
  const canEdit = isLead || isAdmin;

  // Calculate task stats
  const allTasks = (milestones || []).flatMap((m: any) => m.tasks || []);
  const taskStats = {
    todo: allTasks.filter((t: any) => t.status === "todo").length,
    in_progress: allTasks.filter((t: any) => t.status === "in_progress").length,
    done: allTasks.filter((t: any) => t.status === "done").length,
  };
  const totalTasks = taskStats.todo + taskStats.in_progress + taskStats.done;
  const progressPct = totalTasks > 0 ? Math.round((taskStats.done / totalTasks) * 100) : 0;

  const dateRange = (() => {
    if (!project.start_date) return "";
    const s = new Date(project.start_date).toLocaleDateString("ko", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!project.end_date) return s + " ~";
    const e = new Date(project.end_date).toLocaleDateString("ko", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `${s} — ${e}`;
  })();

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            {project.category && (
              <span
                className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-white ${catColors[project.category] || "bg-nu-gray"}`}
              >
                {project.category}
              </span>
            )}
            <span
              className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 ${statusColors[project.status] || "bg-nu-gray text-white"}`}
            >
              {project.status}
            </span>
          </div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            {project.title}
          </h1>
          <p className="text-nu-gray mt-2 max-w-xl">{project.description}</p>
          {dateRange && (
            <p className="font-mono-nu text-[10px] text-nu-muted mt-3 flex items-center gap-1.5">
              <Calendar size={12} /> {dateRange}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isMember && (
            <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-green-600 text-white inline-flex items-center gap-2">
              <CheckCircle2 size={14} /> 참여중
            </span>
          )}
          {!isMember && applicationStatus === "pending" && (
            <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-amber text-white inline-flex items-center gap-2">
              <Clock size={14} /> 승인중
            </span>
          )}
          {!isMember && !applicationStatus && project.status === "active" && (
            <Link
              href={`/projects/${id}/apply`}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
            >
              <UserPlus size={14} /> 참여 지원
            </Link>
          )}
          {!isMember && applicationStatus === "rejected" && project.status === "active" && (
            <Link
              href={`/projects/${id}/apply`}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
            >
              <UserPlus size={14} /> 다시 지원
            </Link>
          )}
          {isMember && (
            <Link
              href={`/projects/${id}/chat`}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2"
            >
              <MessageCircle size={14} /> 채팅
            </Link>
          )}
          {canEdit && (
            <>
              <Link
                href={`/projects/${id}/applications`}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-3 border border-nu-pink/30 text-nu-pink no-underline hover:bg-nu-pink/10 transition-colors inline-flex items-center gap-2"
              >
                <ClipboardList size={14} /> 지원자
              </Link>
              <Link
                href={`/projects/${id}/settings`}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-3 border border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
              >
                <Settings size={14} /> 설정
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs - inline client component */}
      <TabsInner
        projectId={id}
        milestonesData={JSON.stringify(milestones || [])}
        updatesData={JSON.stringify(updates || [])}
        userMembersData={JSON.stringify(userMembers)}
        crewMembersData={JSON.stringify(crewMembers)}
        eventsData={JSON.stringify(events || [])}
        canEdit={canEdit}
        userId={user.id}
        isMember={isMember}
        taskStats={taskStats}
        progressPct={progressPct}
        totalTasks={totalTasks}
        projectData={JSON.stringify(project)}
      />
    </div>
  );
}
