"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckSquare, Clock, Plus, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function StaffTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine">("mine");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [userId, setUserId] = useState("");

  // Quick-add task
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: taskData }, { data: projData }] = await Promise.all([
        supabase
          .from("staff_tasks")
          .select("*, project:staff_projects(id, title), assignee:profiles!staff_tasks_assigned_to_fkey(id, nickname, avatar_url)")
          .order("created_at", { ascending: false }),
        supabase.from("staff_projects").select("id, title").eq("status", "active").order("title"),
      ]);

      setTasks(taskData || []);
      setProjects(projData || []);
      setLoading(false);
    }
    load();
  }, []);

  async function toggleStatus(taskId: string, currentStatus: string) {
    const next = currentStatus === "done" ? "todo" : currentStatus === "todo" ? "in_progress" : "done";
    const supabase = createClient();
    const { error } = await supabase.from("staff_tasks").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) { toast.error("상태 변경 실패"); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
    if (next === "done") {
      const task = tasks.find(t => t.id === taskId);
      if (task?.project_id && userId) {
        supabase.from("staff_activity").insert({
          project_id: task.project_id,
          user_id: userId,
          action: "task_completed",
          target_type: "task",
          target_id: taskId,
        }).then(({ error: logErr }) => { if (logErr) console.error("Activity log failed:", logErr.message); });
      }
    }
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim() || !quickProjectId) return;
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.from("staff_tasks").insert({
      project_id: quickProjectId,
      title: quickTitle.trim(),
      created_by: userId,
      assigned_to: userId,
    });
    if (error) toast.error("할일 추가 실패");
    else {
      toast.success("할일이 추가되었습니다");
      setQuickTitle("");
      // Reload
      const { data } = await supabase
        .from("staff_tasks")
        .select("*, project:staff_projects(id, title), assignee:profiles!staff_tasks_assigned_to_fkey(id, nickname, avatar_url)")
        .order("created_at", { ascending: false });
      setTasks(data || []);
      setShowQuickAdd(false);
    }
    setAdding(false);
  }

  // Due date helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getDueDateStatus(dueDate: string | null): "overdue" | "today" | "soon" | "normal" | null {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff <= 3) return "soon";
    return "normal";
  }

  const dueDateStyle: Record<string, string> = {
    overdue: "text-red-600 font-bold",
    today: "text-orange-600 font-bold",
    soon: "text-yellow-700",
    normal: "text-nu-muted",
  };

  const dueDateIcon: Record<string, any> = {
    overdue: <AlertTriangle size={10} className="text-red-500" />,
    today: <Clock size={10} className="text-orange-500" />,
    soon: <Clock size={10} className="text-yellow-600" />,
    normal: <Clock size={10} />,
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filter === "mine") result = result.filter(t => t.assigned_to === userId);
    if (projectFilter !== "all") result = result.filter(t => t.project_id === projectFilter);
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    return result;
  }, [tasks, filter, userId, projectFilter, priorityFilter]);

  const grouped = useMemo(() => ({
    inProgress: filteredTasks.filter(t => t.status === "in_progress"),
    todo: filteredTasks.filter(t => t.status === "todo"),
    done: filteredTasks.filter(t => t.status === "done"),
  }), [filteredTasks]);

  const statusIcon: Record<string, string> = { todo: "○", in_progress: "◐", done: "●" };
  const priorityColor: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  const overdueCount = tasks.filter(t => t.status !== "done" && getDueDateStatus(t.due_date) === "overdue" && (filter === "all" || t.assigned_to === userId)).length;

  const sections = [
    { key: "inProgress", label: "진행중", tasks: grouped.inProgress, color: "text-indigo-600" },
    { key: "todo", label: "할 일", tasks: grouped.todo, color: "text-nu-ink" },
    { key: "done", label: "완료", tasks: grouped.done, color: "text-green-600" },
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        <div className="h-8 w-32 bg-nu-ink/8 animate-pulse mb-8" />
        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-white border border-nu-ink/[0.06] animate-pulse mb-2" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">할일</h1>
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">
            All Tasks
            {overdueCount > 0 && (
              <span className="ml-2 text-red-600">· {overdueCount}개 지연</span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest gap-1.5"
        >
          {showQuickAdd ? <X size={12} /> : <Plus size={12} />}
          {showQuickAdd ? "닫기" : "새 할일"}
        </Button>
      </div>

      {/* Quick add form */}
      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className="bg-white border border-indigo-200 p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="할일 제목..."
                className="border-nu-ink/15 bg-transparent"
              />
            </div>
            <select
              value={quickProjectId}
              onChange={e => setQuickProjectId(e.target.value)}
              className="px-3 py-2 border border-nu-ink/15 bg-transparent text-sm"
            >
              <option value="">프로젝트 선택</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={adding || !quickTitle.trim() || !quickProjectId} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
            {adding ? "추가 중..." : "추가"}
          </Button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Mine / All */}
        <div className="flex gap-1">
          {(["mine", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors cursor-pointer ${
                filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
              }`}
            >
              {f === "mine" ? "내 할일" : "전체"}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="all">모든 프로젝트</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="all">모든 우선순위</option>
          <option value="urgent">긴급</option>
          <option value="high">높음</option>
          <option value="medium">보통</option>
          <option value="low">낮음</option>
        </select>

        {(projectFilter !== "all" || priorityFilter !== "all") && (
          <button
            onClick={() => { setProjectFilter("all"); setPriorityFilter("all"); }}
            className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="space-y-8">
        {sections.map(section => (
          <div key={section.key}>
            <h2 className={`font-mono-nu text-[11px] uppercase tracking-widest font-bold mb-3 ${section.color}`}>
              {section.label} ({section.tasks.length})
            </h2>
            {section.tasks.length > 0 ? (
              <div className="space-y-2">
                {section.tasks.map((t: any) => {
                  const dueStatus = t.status !== "done" ? getDueDateStatus(t.due_date) : null;
                  return (
                    <div key={t.id} className={`flex items-center gap-3 px-4 py-3 bg-white border transition-colors ${
                      dueStatus === "overdue" ? "border-red-200 bg-red-50/30" :
                      dueStatus === "today" ? "border-orange-200 bg-orange-50/20" :
                      "border-nu-ink/[0.06] hover:border-indigo-200"
                    }`}>
                      <button
                        onClick={() => toggleStatus(t.id, t.status)}
                        className="text-lg bg-transparent border-none cursor-pointer p-0"
                        aria-label="상태 변경"
                      >
                        {statusIcon[t.status] || "○"}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-head text-sm font-bold truncate ${t.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.project?.title && (
                            <Link href={`/staff/workspace/${t.project.id}`} className="font-mono-nu text-[8px] text-indigo-600 no-underline hover:underline" onClick={e => e.stopPropagation()}>
                              {t.project.title}
                            </Link>
                          )}
                          {t.assignee && (
                            <span className="font-mono-nu text-[8px] text-nu-muted">· {t.assignee.nickname}</span>
                          )}
                          {t.completed_at && t.status === "done" && (
                            <span className="font-mono-nu text-[8px] text-green-600">
                              · {new Date(t.completed_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 완료
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-mono-nu text-[9px] uppercase px-2 py-0.5 ${priorityColor[t.priority] || ""}`}>
                        {t.priority}
                      </span>
                      {t.due_date && (
                        <span className={`font-mono-nu text-[9px] flex items-center gap-1 ${dueStatus ? dueDateStyle[dueStatus] : "text-nu-muted"}`}>
                          {dueStatus ? dueDateIcon[dueStatus] : <Clock size={10} />}
                          {dueStatus === "overdue" ? "지연" : ""}
                          {new Date(t.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="font-mono-nu text-[10px] text-nu-muted pl-4 py-2">해당하는 할일이 없습니다</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
