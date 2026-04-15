"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Circle, Loader2, RefreshCw, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  source: "google" | "bolt";
  projectTitle?: string;
  projectHref?: string;
  _listId?: string;
}

export function MyTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const combined: Task[] = [];

    // Bolt tasks assigned to me
    const { data: boltTasks } = await supabase
      .from("project_tasks")
      .select("id, title, status, due_date, milestone:project_milestones(project:projects(id, title))")
      .eq("assigned_to", user.id)
      .in("status", ["todo", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(10);

    (boltTasks || []).forEach((t: any) => {
      const proj = t.milestone?.project;
      combined.push({
        id: t.id,
        title: t.title,
        status: t.status === "in_progress" ? "in_progress" : "todo",
        due_date: t.due_date,
        source: "bolt",
        projectTitle: proj?.title,
        projectHref: proj?.id ? `/projects/${proj.id}` : undefined,
      });
    });

    // Google Tasks
    try {
      const res = await fetch("/api/google/tasks?listId=@default&showCompleted=false");
      if (res.ok) {
        const data = await res.json();
        (data.tasks || []).filter((t: any) => t.title && t.status === "needsAction").slice(0, 10).forEach((t: any) => {
          combined.push({
            id: t.id,
            title: t.title,
            status: "todo",
            due_date: t.due || null,
            source: "google",
            _listId: "@default",
          });
        });
      }
    } catch { /* Google not connected, skip */ }

    // Sort: overdue first, then by due date
    combined.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    setTasks(combined.slice(0, 8));
    setLoading(false);
  }

  async function toggleTask(task: Task) {
    if (task.source === "google") {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      try {
        await fetch("/api/google/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId: task._listId || "@default", taskId: task.id, status: "completed" }),
        });
      } catch {
        setTasks(prev => [...prev, task]);
        toast.error("Google Task 완료 실패");
      }
    } else {
      const supabase = createClient();
      const { error } = await supabase.from("project_tasks").update({ status: "done" }).eq("id", task.id);
      if (error) toast.error("할일 완료 실패");
      else setTasks(prev => prev.filter(t => t.id !== task.id));
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getDueLabel(d: string | null) {
    if (!d) return null;
    const due = new Date(d);
    due.setHours(0, 0, 0, 0);
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return { text: "지연", cls: "text-red-600 font-bold" };
    if (diff === 0) return { text: "오늘", cls: "text-orange-600 font-bold" };
    if (diff <= 3) return { text: `${Math.ceil(diff)}일 후`, cls: "text-yellow-700" };
    return { text: new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }), cls: "text-nu-muted" };
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2">
          <CheckCircle2 size={14} className="text-indigo-600" /> 오늘의 할일
        </h3>
        <button onClick={load} className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600 transition-colors">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
          <p className="text-xs text-nu-muted">모든 할일을 완료했습니다!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(t => {
            const due = getDueLabel(t.due_date);
            return (
              <div key={`${t.source}-${t.id}`} className="flex items-center gap-2.5 py-2 px-2 hover:bg-indigo-50/30 transition-colors -mx-2 group">
                <button onClick={() => toggleTask(t)}
                  className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 group/check">
                  <Circle size={16} className={`${t.source === "google" ? "text-blue-300" : "text-indigo-300"} group-hover/check:text-green-400 transition-colors`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nu-ink truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`font-mono-nu text-[7px] uppercase px-1 py-px ${
                      t.source === "google" ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"
                    }`}>
                      {t.source === "google" ? "Google" : "볼트"}
                    </span>
                    {t.projectTitle && (
                      <Link href={t.projectHref || "#"} className="font-mono-nu text-[7px] text-indigo-500 no-underline hover:underline truncate max-w-[80px]"
                        onClick={e => e.stopPropagation()}>
                        {t.projectTitle}
                      </Link>
                    )}
                  </div>
                </div>
                {due && (
                  <span className={`font-mono-nu text-[8px] flex items-center gap-0.5 shrink-0 ${due.cls}`}>
                    {due.text === "지연" && <AlertTriangle size={8} />}
                    {due.text === "오늘" && <Clock size={8} />}
                    {due.text}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
