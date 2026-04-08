"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Check,
  Clock,
  ChevronDown,
  Users,
  Target,
  TrendingUp,
  Circle,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import type { ProjectMilestone, ProjectTask, TaskStatus } from "@/lib/types";

interface ProjectRoadmapProps {
  projectId: string;
  milestones?: ProjectMilestone[];
  isLead: boolean;
}

const taskStatusIcons: Record<
  string,
  { icon: typeof Circle; color: string; next: TaskStatus; label: string }
> = {
  todo: {
    icon: Circle,
    color: "text-nu-gray",
    next: "in_progress",
    label: "할 일",
  },
  in_progress: {
    icon: Clock,
    color: "text-nu-amber",
    next: "done",
    label: "진행 중",
  },
  done: {
    icon: CheckCircle2,
    color: "text-green-600",
    next: "todo",
    label: "완료",
  },
};

export function ProjectRoadmap({
  projectId,
  milestones: initialMilestones,
  isLead,
}: ProjectRoadmapProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(
    initialMilestones || []
  );
  const [loading, setLoading] = useState(!initialMilestones);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Fetch milestones and tasks if not provided
  useEffect(() => {
    if (initialMilestones) return;

    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch milestones with tasks
        const { data: milestonesData, error: msError } = await supabase
          .from("project_milestones")
          .select(
            `
            *,
            tasks:project_tasks(*)
          `
          )
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });

        if (msError) throw msError;

        // Fetch assignee profiles for all tasks
        if (milestonesData) {
          const enrichedMilestones = await Promise.all(
            milestonesData.map(async (ms) => {
              if (!ms.tasks || ms.tasks.length === 0) return ms;

              const tasksWithAssignees = await Promise.all(
                (ms.tasks as any[]).map(async (task) => {
                  if (!task.assigned_to) return task;

                  const { data: assignee } = await supabase
                    .from("profiles")
                    .select("id, nickname, avatar_url")
                    .eq("id", task.assigned_to)
                    .single();

                  return { ...task, assignee };
                })
              );

              return { ...ms, tasks: tasksWithAssignees };
            })
          );

          setMilestones(enrichedMilestones);
        }
      } catch (err: any) {
        toast.error(err.message || "마일스톤을 로드할 수 없습니다");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId, initialMilestones]);

  const calculateProgress = (tasks: ProjectTask[] | undefined): number => {
    if (!tasks || tasks.length === 0) return 0;
    const completedCount = tasks.filter((t) => t.status === "done").length;
    return Math.round((completedCount / tasks.length) * 100);
  };

  const getCompletedMilestones = (): number => {
    return milestones.filter((m) => m.status === "completed").length;
  };

  const getTotalProgress = (): number => {
    if (milestones.length === 0) return 0;
    const totalTasks = milestones.reduce(
      (sum, m) => sum + (m.tasks?.length || 0),
      0
    );
    if (totalTasks === 0) return 0;
    const completedTasks = milestones.reduce(
      (sum, m) => sum + (m.tasks?.filter((t) => t.status === "done").length || 0),
      0
    );
    return Math.round((completedTasks / totalTasks) * 100);
  };

  async function toggleTaskStatus(task: ProjectTask) {
    if (!isLead) return;

    const nextStatus: TaskStatus =
      taskStatusIcons[task.status]?.next || "todo";
    setTogglingTaskId(task.id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: nextStatus })
        .eq("id", task.id);

      if (error) throw error;

      // Update local state
      setMilestones((prev) =>
        prev.map((ms) => ({
          ...ms,
          tasks: (ms.tasks || []).map((t) =>
            t.id === task.id ? { ...t, status: nextStatus } : t
          ),
        }))
      );

      toast.success("태스크 상태가 변경되었습니다");
    } catch (err: any) {
      toast.error(err.message || "상태 변경 실패");
    } finally {
      setTogglingTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-nu-white border-2 border-nu-ink flex items-center justify-center h-96">
        <Loader2 size={24} className="animate-spin text-nu-pink" />
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="bg-nu-white border-2 border-nu-ink p-8 text-center">
        <AlertCircle size={32} className="mx-auto text-nu-gray mb-3" />
        <p className="text-nu-muted">마일스톤이 없습니다</p>
      </div>
    );
  }

  const totalProgress = getTotalProgress();
  const completedMilestones = getCompletedMilestones();

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-nu-ink text-nu-paper px-6 py-5 border-2 border-nu-ink relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-nu-pink" />
              <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
                Project_Roadmap
              </span>
            </div>
            <span className="font-head text-2xl font-extrabold">
              {completedMilestones}/{milestones.length}
            </span>
          </div>

          {/* Main Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/70">
                전체 진행률
              </span>
              <span className="font-head font-bold text-lg text-nu-pink">
                {totalProgress}%
              </span>
            </div>
            <div className="h-3 bg-nu-paper/20 border border-nu-paper/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nu-pink to-nu-pink/80 transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Timeline */}
      <div className="bg-nu-white border-2 border-nu-ink overflow-x-auto">
        <div className="px-6 py-5 min-w-max">
          {/* Timeline phases */}
          <div className="flex items-end gap-8 mb-8">
            {milestones.map((ms, idx) => {
              const isLast = idx === milestones.length - 1;
              const progress = calculateProgress(ms.tasks);
              const isActive =
                ms.status === "in_progress" ||
                (idx > 0 &&
                  milestones[idx - 1].status === "completed" &&
                  ms.status === "pending");
              const isCompleted = ms.status === "completed";

              return (
                <div key={ms.id} className="flex items-end gap-4">
                  {/* Phase Node */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center transition-all cursor-pointer hover:shadow-lg ${
                        isCompleted
                          ? "bg-nu-pink border-nu-pink text-nu-paper"
                          : isActive
                            ? "bg-nu-amber/10 border-nu-amber text-nu-amber animate-pulse"
                            : "bg-nu-ink/5 border-nu-ink/10 text-nu-muted"
                      }`}
                      onClick={() =>
                        setExpandedMilestone(
                          expandedMilestone === ms.id ? null : ms.id
                        )
                      }
                    >
                      {isCompleted ? (
                        <Check size={20} />
                      ) : isActive ? (
                        <TrendingUp size={20} />
                      ) : (
                        <Circle size={20} />
                      )}
                      <span className="font-mono-nu text-[7px] font-bold mt-1 text-center">
                        {progress}%
                      </span>
                    </div>

                    {/* Node Label */}
                    <div className="mt-3 text-center max-w-20">
                      <p className="font-head text-xs font-bold text-nu-ink truncate">
                        {ms.title}
                      </p>
                      {ms.due_date && (
                        <p className="font-mono-nu text-[7px] text-nu-muted mt-1 flex items-center justify-center gap-0.5">
                          <Calendar size={8} />
                          {new Date(ms.due_date).toLocaleDateString("ko", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      {ms.tasks && ms.tasks.length > 0 && (
                        <p className="font-mono-nu text-[7px] text-nu-muted mt-0.5">
                          {ms.tasks.filter((t) => t.status === "done").length}/
                          {ms.tasks.length} tasks
                        </p>
                      )}
                    </div>

                    {/* Connecting Line */}
                    {!isLast && (
                      <div
                        className={`w-8 h-1 mt-4 ${
                          isCompleted ? "bg-nu-pink" : "bg-nu-ink/10"
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expanded Milestone Details */}
      {expandedMilestone && (
        <div className="bg-nu-white border-2 border-nu-ink overflow-hidden">
          <button
            onClick={() => setExpandedMilestone(null)}
            className="w-full flex items-center gap-3 p-5 bg-nu-cream/20 hover:bg-nu-cream/30 transition-colors"
          >
            <ChevronDown size={16} className="text-nu-pink" />
            <span className="font-head text-sm font-bold text-nu-ink flex-1 text-left">
              {milestones.find((m) => m.id === expandedMilestone)?.title}
            </span>
            <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
              {calculateProgress(
                milestones.find((m) => m.id === expandedMilestone)?.tasks
              )}
              %
            </span>
          </button>

          {/* Tasks List */}
          <div className="border-t border-nu-ink/[0.06]">
            {(() => {
              const expandedMs = milestones.find((m) => m.id === expandedMilestone);
              const tasks = expandedMs?.tasks || [];

              if (tasks.length === 0) {
                return (
                  <p className="px-5 py-4 text-nu-muted text-sm">
                    아직 태스크가 없습니다
                  </p>
                );
              }

              return (
                <>
                  {tasks.map((task) => {
                    const statusInfo = taskStatusIcons[task.status];
                    const Icon = statusInfo.icon;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-5 py-4 border-b border-nu-ink/[0.04] last:border-0 hover:bg-nu-cream/10 transition-colors"
                      >
                        {/* Status Toggle */}
                        <button
                          onClick={() => toggleTaskStatus(task)}
                          disabled={!isLead || togglingTaskId === task.id}
                          className={`shrink-0 transition-opacity ${
                            statusInfo.color
                          } ${isLead ? "cursor-pointer hover:opacity-70" : "cursor-default opacity-50"}`}
                        >
                          {togglingTaskId === task.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Icon size={18} />
                          )}
                        </button>

                        {/* Task Title */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              task.status === "done"
                                ? "line-through text-nu-muted"
                                : "text-nu-ink"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-nu-muted mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`font-mono-nu text-[8px] font-bold uppercase px-1.5 py-0.5 shrink-0 ${
                            task.status === "done"
                              ? "bg-green-50 text-green-600"
                              : task.status === "in_progress"
                                ? "bg-nu-amber/10 text-nu-amber"
                                : "bg-nu-gray/10 text-nu-gray"
                          }`}
                        >
                          {statusInfo.label}
                        </span>

                        {/* Assignee */}
                        {task.assignee && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-6 h-6 rounded-full bg-nu-pink/20 flex items-center justify-center font-head text-[9px] font-bold text-nu-pink">
                              {(task.assignee.nickname || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span className="font-mono-nu text-[8px] text-nu-muted">
                              {task.assignee.nickname}
                            </span>
                          </div>
                        )}

                        {/* Due Date */}
                        {task.due_date && (
                          <span className="font-mono-nu text-[8px] text-nu-muted shrink-0 flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(task.due_date).toLocaleDateString("ko", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Settlement Badges */}
      <div className="space-y-3">
        {milestones
          .filter((ms) => ms.status === "completed" && (ms as any).reward_percentage > 0)
          .map((ms) => (
            <div
              key={ms.id}
              className="bg-nu-pink/10 border border-nu-pink/20 px-4 py-3 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-nu-pink shrink-0" />
              <div className="flex-1">
                <p className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-pink mb-0.5">
                  {ms.title} - 정산 활성화
                </p>
                <p className="text-xs text-nu-muted">
                  {(ms as any).reward_percentage}% 보상 · 마일스톤 완료
                </p>
              </div>
              {(ms as any).is_settled ? (
                <span className="font-mono-nu text-[9px] font-bold uppercase px-2 py-1 bg-nu-ink text-nu-paper">
                  SETTLED
                </span>
              ) : isLead ? (
                <span className="font-mono-nu text-[9px] font-bold uppercase px-2 py-1 bg-nu-pink text-white">
                  PENDING
                </span>
              ) : null}
            </div>
          ))}
      </div>
    </div>
  );
}
