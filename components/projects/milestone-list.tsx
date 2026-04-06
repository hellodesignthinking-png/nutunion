"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Circle,
  Clock,
  CheckCircle2,
  Calendar,
  Loader2,
} from "lucide-react";
import type { ProjectMilestone, ProjectTask, MilestoneStatus, TaskStatus } from "@/lib/types";

const msStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-nu-gray/10", text: "text-nu-gray", label: "대기" },
  in_progress: { bg: "bg-nu-yellow/10", text: "text-nu-amber", label: "진행 중" },
  completed: { bg: "bg-green-50", text: "text-green-600", label: "완료" },
};

const taskStatusIcons: Record<string, { icon: typeof Circle; color: string; next: TaskStatus }> = {
  todo: { icon: Circle, color: "text-nu-gray", next: "in_progress" },
  in_progress: { icon: Clock, color: "text-nu-amber", next: "done" },
  done: { icon: CheckCircle2, color: "text-green-600", next: "todo" },
};

export function MilestoneList({
  projectId,
  initialMilestones,
  canEdit,
}: {
  projectId: string;
  initialMilestones: ProjectMilestone[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(initialMilestones);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMsTitle, setNewMsTitle] = useState("");
  const [newMsDueDate, setNewMsDueDate] = useState("");
  const [savingMs, setSavingMs] = useState(false);
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function addMilestone() {
    if (!newMsTitle.trim()) return;
    setSavingMs(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_milestones")
        .insert({
          project_id: projectId,
          title: newMsTitle.trim(),
          due_date: newMsDueDate || null,
          status: "pending",
          sort_order: milestones.length,
        })
        .select("*")
        .single();

      if (error) throw error;

      setMilestones((prev) => [...prev, { ...data, tasks: [] }]);
      setNewMsTitle("");
      setNewMsDueDate("");
      setAddingMilestone(false);
      toast.success("마일스톤이 추가되었습니다");
    } catch (err: any) {
      toast.error(err.message || "마일스톤 추가 실패");
    } finally {
      setSavingMs(false);
    }
  }

  async function addTask(milestoneId: string) {
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    try {
      const supabase = createClient();
      const milestone = milestones.find((m) => m.id === milestoneId);
      const taskCount = milestone?.tasks?.length || 0;

      const { data, error } = await supabase
        .from("project_tasks")
        .insert({
          milestone_id: milestoneId,
          project_id: projectId,
          title: newTaskTitle.trim(),
          status: "todo",
          sort_order: taskCount,
        })
        .select("*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url)")
        .single();

      if (error) throw error;

      setMilestones((prev) =>
        prev.map((ms) =>
          ms.id === milestoneId
            ? { ...ms, tasks: [...(ms.tasks || []), data] }
            : ms
        )
      );
      setNewTaskTitle("");
      setAddingTaskFor(null);
      toast.success("태스크가 추가되었습니다");
    } catch (err: any) {
      toast.error(err.message || "태스크 추가 실패");
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTaskStatus(milestoneId: string, task: ProjectTask) {
    if (!canEdit) return;
    const next = taskStatusIcons[task.status]?.next || "todo";
    const supabase = createClient();

    const { error } = await supabase
      .from("project_tasks")
      .update({ status: next })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMilestones((prev) =>
      prev.map((ms) =>
        ms.id === milestoneId
          ? {
              ...ms,
              tasks: (ms.tasks || []).map((t) =>
                t.id === task.id ? { ...t, status: next } : t
              ),
            }
          : ms
      )
    );
  }

  return (
    <div className="space-y-4">
      {milestones.map((ms) => {
        const isExpanded = expanded[ms.id] ?? false;
        const tasks = ms.tasks || [];
        const doneCount = tasks.filter((t) => t.status === "done").length;
        const statusStyle = msStatusColors[ms.status] || msStatusColors.pending;

        return (
          <div
            key={ms.id}
            className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden"
          >
            {/* Milestone header */}
            <button
              onClick={() => toggleExpand(ms.id)}
              className="w-full flex items-center gap-3 p-5 text-left hover:bg-nu-cream/20 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-nu-muted shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-nu-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-head text-base font-extrabold text-nu-ink">
                    {ms.title}
                  </h3>
                  <span
                    className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-nu-muted">
                  <span>
                    {doneCount}/{tasks.length} tasks
                  </span>
                  {ms.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(ms.due_date).toLocaleDateString("ko", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
              {tasks.length > 0 && (
                <div className="w-20 shrink-0">
                  <div className="h-1.5 bg-nu-cream rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full transition-all"
                      style={{
                        width: `${tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </button>

            {/* Tasks */}
            {isExpanded && (
              <div className="border-t border-nu-ink/[0.06]">
                {tasks.length === 0 && (
                  <p className="px-5 py-4 text-nu-gray text-sm">
                    아직 태스크가 없습니다
                  </p>
                )}
                {tasks.map((task) => {
                  const statusInfo = taskStatusIcons[task.status] || taskStatusIcons.todo;
                  const Icon = statusInfo.icon;

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-nu-ink/[0.04] last:border-0 hover:bg-nu-cream/10"
                    >
                      <button
                        onClick={() => toggleTaskStatus(ms.id, task)}
                        disabled={!canEdit}
                        className={`shrink-0 ${statusInfo.color} ${canEdit ? "cursor-pointer hover:opacity-70" : "cursor-default"}`}
                      >
                        <Icon size={18} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${task.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}
                        >
                          {task.title}
                        </p>
                      </div>
                      {task.assignee && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center font-head text-[8px] font-bold">
                            {(task.assignee.nickname || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span className="font-mono-nu text-[9px] text-nu-muted">
                            {task.assignee.nickname}
                          </span>
                        </div>
                      )}
                      {task.due_date && (
                        <span className="font-mono-nu text-[9px] text-nu-muted shrink-0 flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(task.due_date).toLocaleDateString("ko", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Add task inline form */}
                {canEdit && (
                  <div className="px-5 py-3 border-t border-nu-ink/[0.06]">
                    {addingTaskFor === ms.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="태스크 제목"
                          className="flex-1 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTask(ms.id);
                            }
                            if (e.key === "Escape") {
                              setAddingTaskFor(null);
                              setNewTaskTitle("");
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => addTask(ms.id)}
                          disabled={savingTask}
                          className="font-mono-nu text-[10px] font-bold uppercase px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50"
                        >
                          {savingTask ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            "추가"
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setAddingTaskFor(null);
                            setNewTaskTitle("");
                          }}
                          className="text-nu-muted hover:text-nu-ink text-sm px-2"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingTaskFor(ms.id);
                          setNewTaskTitle("");
                        }}
                        className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-1"
                      >
                        <Plus size={12} /> 태스크 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add milestone */}
      {canEdit && (
        <div className="mt-4">
          {addingMilestone ? (
            <div className="bg-nu-white border border-nu-ink/[0.08] p-5 space-y-3">
              <input
                type="text"
                value={newMsTitle}
                onChange={(e) => setNewMsTitle(e.target.value)}
                placeholder="마일스톤 제목"
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMilestone();
                  }
                  if (e.key === "Escape") {
                    setAddingMilestone(false);
                    setNewMsTitle("");
                    setNewMsDueDate("");
                  }
                }}
                autoFocus
              />
              <input
                type="date"
                value={newMsDueDate}
                onChange={(e) => setNewMsDueDate(e.target.value)}
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
              />
              <div className="flex gap-2">
                <button
                  onClick={addMilestone}
                  disabled={savingMs}
                  className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {savingMs ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    "마일스톤 추가"
                  )}
                </button>
                <button
                  onClick={() => {
                    setAddingMilestone(false);
                    setNewMsTitle("");
                    setNewMsDueDate("");
                  }}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink px-3"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingMilestone(true)}
              className="w-full font-mono-nu text-[11px] uppercase tracking-widest py-4 border border-dashed border-nu-ink/20 text-nu-muted hover:text-nu-ink hover:border-nu-ink/40 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} /> 마일스톤 추가
            </button>
          )}
        </div>
      )}

      {milestones.length === 0 && !canEdit && (
        <div className="text-center py-12 bg-nu-white border border-nu-ink/[0.08]">
          <p className="text-nu-gray text-sm">아직 마일스톤이 없습니다</p>
        </div>
      )}
    </div>
  );
}
