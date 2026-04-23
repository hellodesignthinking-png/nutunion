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
  /** google=Google Tasks, bolt=내게 할당된 볼트 태스크, bolt_mine=내가 만든 볼트의 미배정 태스크, group_event=너트 호스트의 오늘/내일 이벤트 */
  source: "google" | "bolt" | "bolt_mine" | "group_event";
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

    // 1) 내게 할당된 볼트 태스크
    const { data: boltTasks } = await supabase
      .from("project_tasks")
      .select("id, title, status, due_date, project_id, milestone:project_milestones(project:projects(id, title))")
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

    // 2) 내가 만든 볼트의 미배정 태스크 (리더가 할 일)
    const assignedIds = new Set((boltTasks || []).map((t: any) => t.id));
    const { data: myProjects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("created_by", user.id);
    const myProjectIds = ((myProjects as any[]) || []).map((p) => p.id);
    if (myProjectIds.length > 0) {
      const { data: unassigned } = await supabase
        .from("project_tasks")
        .select("id, title, status, due_date, project_id")
        .in("project_id", myProjectIds)
        .is("assigned_to", null)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(5);
      (unassigned || []).forEach((t: any) => {
        if (assignedIds.has(t.id)) return;
        const proj = (myProjects as any[])?.find((p) => p.id === t.project_id);
        combined.push({
          id: t.id,
          title: t.title,
          status: t.status === "in_progress" ? "in_progress" : "todo",
          due_date: t.due_date,
          source: "bolt_mine",
          projectTitle: proj?.title,
          projectHref: proj?.id ? `/projects/${proj.id}` : undefined,
        });
      });
    }

    // 3) 내 너트(호스팅)의 오늘/내일 events (task-like)
    const { data: hostedGroups } = await supabase
      .from("groups")
      .select("id, name")
      .eq("host_id", user.id)
      .eq("is_active", true);
    const hostedIds = ((hostedGroups as any[]) || []).map((g) => g.id);
    if (hostedIds.length > 0) {
      const nowIso = new Date().toISOString();
      const in2daysIso = new Date(Date.now() + 2 * 86400000).toISOString();
      const { data: upcomingEvents } = await supabase
        .from("events")
        .select("id, title, start_at, group_id")
        .in("group_id", hostedIds)
        .gte("start_at", nowIso)
        .lte("start_at", in2daysIso)
        .limit(5);
      (upcomingEvents || []).forEach((e: any) => {
        const g = (hostedGroups as any[])?.find((x) => x.id === e.group_id);
        combined.push({
          id: `event-${e.id}`,
          title: e.title,
          status: "todo",
          due_date: e.start_at,
          source: "group_event",
          projectTitle: g?.name,
          projectHref: g?.id ? `/groups/${g.id}/events/${e.id}` : undefined,
        });
      });
    }

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
    // 이벤트는 완료 개념 X — 해당 페이지로 이동만
    if (task.source === "group_event") {
      if (task.projectHref) {
        window.location.href = task.projectHref;
      } else {
        toast.info("이벤트는 완료 체크가 아닙니다. 상세 페이지에서 확인하세요.");
      }
      return;
    }

    // Google Tasks — API 경유
    if (task.source === "google") {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      try {
        const res = await fetch("/api/google/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId: task._listId || "@default", taskId: task.id, status: "completed" }),
        });
        if (!res.ok) throw new Error("google update failed");
      } catch {
        setTasks(prev => [...prev, task]);
        toast.error("Google Task 완료 실패");
      }
      return;
    }

    // 볼트 태스크 — 내가 할당받은 것(bolt) + 내가 만든 볼트의 미배정(bolt_mine) 모두 project_tasks 테이블 업데이트
    const supabase = createClient();
    const { error } = await supabase.from("project_tasks").update({ status: "done" }).eq("id", task.id);
    if (error) {
      // RLS 차단 메시지를 명확히
      if (/row-level security|permission|rls/i.test(error.message)) {
        toast.error("완료 권한이 없어요 (리더 또는 할당자만 가능)");
      } else {
        toast.error("할일 완료 실패: " + error.message);
      }
    } else {
      setTasks(prev => prev.filter(t => t.id !== task.id));
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
                    {(() => {
                      const badge = {
                        google:      { cls: "bg-blue-50 text-blue-500",   label: "Google" },
                        bolt:        { cls: "bg-purple-50 text-purple-500", label: "내 볼트" },
                        bolt_mine:   { cls: "bg-amber-50 text-amber-700",   label: "리더 Todo" },
                        group_event: { cls: "bg-pink-50 text-nu-pink",      label: "너트 이벤트" },
                      }[t.source];
                      return (
                        <span className={`font-mono-nu text-[9px] uppercase px-1 py-px ${badge.cls}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {t.projectTitle && (
                      <Link href={t.projectHref || "#"} className="font-mono-nu text-[9px] text-indigo-500 no-underline hover:underline truncate max-w-[80px]"
                        onClick={e => e.stopPropagation()}>
                        {t.projectTitle}
                      </Link>
                    )}
                  </div>
                </div>
                {due && (
                  <span className={`font-mono-nu text-[10px] flex items-center gap-0.5 shrink-0 ${due.cls}`}>
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
