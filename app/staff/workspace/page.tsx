import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Plus, Users, CheckSquare, Clock } from "lucide-react";

export default async function StaffProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("staff_projects")
    .select("*, creator:profiles!staff_projects_created_by_fkey(nickname, avatar_url)")
    .order("updated_at", { ascending: false });

  // Fetch member and task counts in bulk
  const projectIds = (projects || []).map(p => p.id);

  let memberCounts: Record<string, number> = {};
  let taskCounts: Record<string, { todo: number; in_progress: number; done: number }> = {};

  if (projectIds.length > 0) {
    const { data: members } = await supabase
      .from("staff_project_members")
      .select("project_id")
      .in("project_id", projectIds);

    (members || []).forEach((m: any) => {
      memberCounts[m.project_id] = (memberCounts[m.project_id] || 0) + 1;
    });

    const { data: tasks } = await supabase
      .from("staff_tasks")
      .select("project_id, status")
      .in("project_id", projectIds);

    (tasks || []).forEach((t: any) => {
      if (!taskCounts[t.project_id]) taskCounts[t.project_id] = { todo: 0, in_progress: 0, done: 0 };
      if (t.status in taskCounts[t.project_id]) {
        (taskCounts[t.project_id] as any)[t.status]++;
      }
    });
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    active: { text: "진행중", color: "bg-green-100 text-green-700" },
    completed: { text: "완료", color: "bg-blue-100 text-blue-700" },
    archived: { text: "보관", color: "bg-gray-100 text-gray-500" },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">프로젝트</h1>
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">Internal Projects</p>
        </div>
        <Link
          href="/staff/workspace/create"
          className="inline-flex items-center gap-2 font-mono-nu text-[11px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white no-underline hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> 새 프로젝트
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p: any) => {
            const sl = statusLabel[p.status] || statusLabel.active;
            const tc = taskCounts[p.id] || { todo: 0, in_progress: 0, done: 0 };
            const totalTasks = tc.todo + tc.in_progress + tc.done;
            const progress = totalTasks > 0 ? Math.round((tc.done / totalTasks) * 100) : 0;

            return (
              <Link
                key={p.id}
                href={`/staff/workspace/${p.id}`}
                className="block bg-white border border-nu-ink/[0.06] p-6 hover:border-indigo-200 hover:shadow-sm transition-all no-underline group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${sl.color}`}>
                    {sl.text}
                  </span>
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600">
                    {p.category || "general"}
                  </span>
                </div>
                <h3 className="font-head text-base font-bold text-nu-ink group-hover:text-indigo-600 transition-colors mb-2">{p.title}</h3>
                {p.description && (
                  <p className="text-xs text-nu-muted line-clamp-2 mb-4">{p.description}</p>
                )}
                {/* Progress bar */}
                {totalTasks > 0 && (
                  <div className="mb-3">
                    <div className="h-1 bg-nu-ink/5 w-full">
                      <div className="h-1 bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="font-mono-nu text-[8px] text-nu-muted mt-1">{progress}% 완료 ({tc.done}/{totalTasks})</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-nu-muted">
                  <span className="flex items-center gap-1 font-mono-nu text-[9px]">
                    <Users size={11} /> {memberCounts[p.id] || 0}
                  </span>
                  <span className="flex items-center gap-1 font-mono-nu text-[9px]">
                    <CheckSquare size={11} /> {totalTasks}
                  </span>
                  <span className="flex items-center gap-1 font-mono-nu text-[9px]">
                    <Clock size={11} /> {new Date(p.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
          <FolderOpen size={48} className="mx-auto mb-4 text-nu-ink/15" />
          <p className="text-nu-muted text-sm mb-4">아직 내부 프로젝트가 없습니다</p>
          <Link href="/staff/workspace/create" className="font-mono-nu text-[10px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white no-underline hover:bg-indigo-700 inline-flex items-center gap-1.5">
            <Plus size={12} /> 첫 프로젝트 만들기
          </Link>
        </div>
      )}
    </div>
  );
}
