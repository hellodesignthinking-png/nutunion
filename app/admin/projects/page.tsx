import { createClient } from "@/lib/supabase/server";
import { AdminProjectList } from "@/components/admin/project-list";

export default async function AdminProjectsPage() {
  const supabase = await createClient();

  // Resilient query: try FK join first, fallback to basic select
  let projects: any[] = [];
  try {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "*, creator:profiles!projects_created_by_fkey(nickname), project_members(count)"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    projects = data || [];
  } catch {
    // Fallback: basic query without FK joins
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    projects = data || [];
  }

  // Fetch creator profiles separately for fallback
  const creatorIds = [...new Set(projects.map((p: any) => p.created_by).filter(Boolean))];
  let creatorMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", creatorIds);
    (creators || []).forEach((c: any) => {
      creatorMap[c.id] = c.nickname || "unknown";
    });
  }

  // Fetch member counts separately (more resilient)
  const projectIds = projects.map((p: any) => p.id);
  let memberCountMap: Record<string, number> = {};
  if (projectIds.length > 0) {
    const { data: members } = await supabase
      .from("project_members")
      .select("project_id");
    (members || []).forEach((m: any) => {
      memberCountMap[m.project_id] = (memberCountMap[m.project_id] || 0) + 1;
    });
  }

  // Fetch milestones with status
  const [
    milestoneResult,
    taskResult,
    crewResult,
  ] = await Promise.allSettled([
    supabase.from("project_milestones").select("project_id, status"),
    supabase.from("project_tasks").select("project_id, status"),
    supabase.from("project_members").select("project_id, crew_id").not("crew_id", "is", null),
  ]);

  const milestones = milestoneResult.status === "fulfilled" ? milestoneResult.value.data || [] : [];
  const tasks = taskResult.status === "fulfilled" ? taskResult.value.data || [] : [];
  const crewMembers = crewResult.status === "fulfilled" ? crewResult.value.data || [] : [];

  // Build maps
  const milestoneMap: Record<string, { total: number; completed: number }> = {};
  milestones.forEach((m: any) => {
    if (!milestoneMap[m.project_id]) milestoneMap[m.project_id] = { total: 0, completed: 0 };
    milestoneMap[m.project_id].total++;
    if (m.status === "completed") milestoneMap[m.project_id].completed++;
  });

  const taskMap: Record<string, { total: number; done: number }> = {};
  tasks.forEach((t: any) => {
    if (!taskMap[t.project_id]) taskMap[t.project_id] = { total: 0, done: 0 };
    taskMap[t.project_id].total++;
    if (t.status === "done") taskMap[t.project_id].done++;
  });

  const crewCountMap: Record<string, number> = {};
  crewMembers.forEach((cm: any) => {
    if (!crewCountMap[cm.project_id]) crewCountMap[cm.project_id] = 0;
    crewCountMap[cm.project_id]++;
  });

  const formatted = projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    status: p.status,
    start_date: p.start_date,
    end_date: p.end_date,
    created_at: p.created_at,
    creator_nickname: p.creator?.nickname || creatorMap[p.created_by] || "unknown",
    member_count: p.project_members?.[0]?.count || memberCountMap[p.id] || 0,
    crew_count: crewCountMap[p.id] || 0,
    milestone_count: milestoneMap[p.id]?.total || 0,
    milestone_completed: milestoneMap[p.id]?.completed || 0,
    task_total: taskMap[p.id]?.total || 0,
    task_done: taskMap[p.id]?.done || 0,
  }));

  // Status breakdown
  const statusBreakdown: Record<string, number> = { draft: 0, active: 0, completed: 0, archived: 0 };
  formatted.forEach((p: any) => {
    statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    draft: "text-nu-gray",
    active: "text-green-600",
    completed: "text-nu-blue",
    archived: "text-nu-muted",
  };
  const statusLabels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    archived: "Archived",
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        프로젝트 관리
      </h1>
      <p className="text-nu-gray text-sm mb-6">
        {formatted.length}개의 프로젝트가 등록되어 있습니다
      </p>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">전체</p>
          <p className="font-head text-2xl font-extrabold">{formatted.length}</p>
        </div>
        {Object.entries(statusBreakdown).map(([status, count]) => (
          <div key={status} className="bg-nu-white border border-nu-ink/[0.08] p-4">
            <p className={`font-mono-nu text-[10px] uppercase tracking-widest mb-1 ${statusColors[status]}`}>
              {statusLabels[status]}
            </p>
            <p className="font-head text-2xl font-extrabold">{count}</p>
          </div>
        ))}
      </div>

      <AdminProjectList projects={formatted} />
    </div>
  );
}
