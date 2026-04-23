"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Users,
  Target,
  TrendingUp,
  Circle,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { ProjectMilestone, ProjectTask, TaskStatus } from "@/lib/types";

interface ProjectRoadmapProps {
  projectId: string;
  milestones?: ProjectMilestone[];
  isLead: boolean;
}

const taskStatusOptions: {
  value: TaskStatus;
  label: string;
  color: string;
  bg: string;
  icon: typeof Circle;
}[] = [
  {
    value: "todo",
    label: "할일",
    color: "text-nu-gray",
    bg: "bg-nu-gray/10",
    icon: Circle,
  },
  {
    value: "in_progress",
    label: "진행 중",
    color: "text-nu-amber",
    bg: "bg-nu-amber/10",
    icon: Clock,
  },
  {
    value: "done",
    label: "완료",
    color: "text-green-600",
    bg: "bg-green-50",
    icon: CheckCircle2,
  },
];

const taskStatusMap: Record<
  string,
  { icon: typeof Circle; color: string; label: string }
> = {
  todo: { icon: Circle, color: "text-nu-gray", label: "할일" },
  in_progress: { icon: Clock, color: "text-nu-amber", label: "진행 중" },
  done: { icon: CheckCircle2, color: "text-green-600", label: "완료" },
};

function isOverdue(dueDateStr: string | null | undefined, status: string): boolean {
  if (!dueDateStr || status === "completed") return false;
  return new Date(dueDateStr) < new Date();
}

export function ProjectRoadmap({
  projectId,
  milestones: initialMilestones,
  isLead,
}: ProjectRoadmapProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(
    initialMilestones || []
  );
  const [loading, setLoading] = useState(!initialMilestones);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(
    null
  );
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [statusDropdownTaskId, setStatusDropdownTaskId] = useState<
    string | null
  >(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Set<string>
  >(new Set());
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressRef = useRef(false);

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
      } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
        toast.error(__err.message || "마일스톤을 로드할 수 없습니다");
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
      (sum, m) =>
        sum + (m.tasks?.filter((t) => t.status === "done").length || 0),
      0
    );
    return Math.round((completedTasks / totalTasks) * 100);
  };

  // Animate progress bar on mount
  const totalProgress = getTotalProgress();
  useEffect(() => {
    if (progressRef.current) return;
    progressRef.current = true;
    const timer = setTimeout(() => {
      setAnimatedProgress(totalProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [totalProgress]);

  // Keep animated in sync after initial animation
  useEffect(() => {
    if (progressRef.current) {
      setAnimatedProgress(totalProgress);
    }
  }, [totalProgress]);

  async function setTaskStatus(task: ProjectTask, newStatus: TaskStatus) {
    if (!isLead) return;
    setTogglingTaskId(task.id);
    setStatusDropdownTaskId(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (error) throw error;

      // Update local state
      setMilestones((prev) =>
        prev.map((ms) => ({
          ...ms,
          tasks: (ms.tasks || []).map((t) =>
            t.id === task.id ? { ...t, status: newStatus } : t
          ),
        }))
      );

      toast.success("태스크 상태가 변경되었습니다");
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error(__err.message || "상태 변경 실패");
    } finally {
      setTogglingTaskId(null);
    }
  }

  function toggleDescription(msId: string) {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(msId)) {
        next.delete(msId);
      } else {
        next.add(msId);
      }
      return next;
    });
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
              <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.25em] text-nu-pink">
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
              <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-paper/70">
                전체 진행률
              </span>
              <span className="font-head font-bold text-lg text-nu-pink">
                {totalProgress}%
              </span>
            </div>
            <div className="h-3 bg-nu-ink/50 border border-nu-paper/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nu-pink to-nu-pink/80 transition-all duration-700 ease-out"
                style={{ width: `${animatedProgress}%` }}
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
              const overdue = isOverdue(ms.due_date, ms.status);

              return (
                <div key={ms.id} className="flex items-end gap-4">
                  {/* Phase Node */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full border-[2px] flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                        isCompleted
                          ? "bg-nu-pink border-nu-pink text-nu-paper"
                          : isActive
                            ? "bg-nu-amber/10 border-nu-amber text-nu-amber"
                            : "bg-nu-ink/5 border-nu-ink/20 text-nu-muted"
                      }`}
                      onClick={() =>
                        setExpandedMilestone(
                          expandedMilestone === ms.id ? null : ms.id
                        )
                      }
                    >
                      {isCompleted ? (
                        <Check size={18} strokeWidth={3} />
                      ) : isActive ? (
                        <>
                          <TrendingUp size={18} />
                          <span className="absolute w-10 h-10 rounded-full border-2 border-nu-amber animate-ping opacity-30" />
                        </>
                      ) : (
                        <Circle size={18} />
                      )}
                    </div>

                    {/* Node Label */}
                    <div className="mt-3 text-center max-w-24">
                      <p className="font-head text-xs font-bold text-nu-ink truncate">
                        {ms.title}
                      </p>
                      {overdue && (
                        <span className="inline-flex items-center gap-0.5 font-mono-nu text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-200 mt-1">
                          <AlertTriangle size={8} />
                          지연
                        </span>
                      )}
                      {ms.due_date && (
                        <p
                          className={`font-mono-nu text-[9px] mt-1 flex items-center justify-center gap-0.5 ${overdue ? "text-red-500 font-bold" : "text-nu-muted"}`}
                        >
                          <Calendar size={8} />
                          {new Date(ms.due_date).toLocaleDateString("ko", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      {ms.tasks && ms.tasks.length > 0 && (
                        <p className="font-mono-nu text-[9px] text-nu-muted mt-0.5">
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
          {(() => {
            const expandedMs = milestones.find(
              (m) => m.id === expandedMilestone
            );
            if (!expandedMs) return null;
            const msProgress = calculateProgress(expandedMs.tasks);
            const tasks = expandedMs.tasks || [];
            const descExpanded = expandedDescriptions.has(expandedMs.id);

            return (
              <>
                <button
                  onClick={() => setExpandedMilestone(null)}
                  className="w-full flex items-center gap-3 p-5 bg-nu-cream/20 hover:bg-nu-cream/30 transition-colors"
                >
                  <ChevronDown size={16} className="text-nu-pink" />
                  <span className="font-head text-sm font-bold text-nu-ink flex-1 text-left">
                    {expandedMs.title}
                  </span>
                  {isOverdue(expandedMs.due_date, expandedMs.status) && (
                    <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-red-100 text-red-600 border border-red-200 mr-2">
                      지연
                    </span>
                  )}
                  <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
                    {msProgress}%
                  </span>
                </button>

                {/* Milestone progress bar */}
                <div className="px-5 pt-2 pb-0">
                  <div className="h-1.5 bg-nu-ink/10 overflow-hidden">
                    <div
                      className="h-full bg-nu-pink transition-all duration-500 ease-out"
                      style={{ width: `${msProgress}%` }}
                    />
                  </div>
                </div>

                {/* Milestone description collapsible */}
                {expandedMs.description && (
                  <div className="px-5 pt-3">
                    <button
                      onClick={() => toggleDescription(expandedMs.id)}
                      className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
                    >
                      {descExpanded ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                      설명 보기
                    </button>
                    {descExpanded && (
                      <p className="text-sm text-nu-graphite leading-relaxed mt-2 pl-4 border-l-2 border-nu-pink/20">
                        {expandedMs.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Tasks List */}
                <div className="border-t border-nu-ink/[0.06] mt-3">
                  {tasks.length === 0 ? (
                    <p className="px-5 py-4 text-nu-muted text-sm">
                      아직 태스크가 없습니다
                    </p>
                  ) : (
                    tasks.map((task) => {
                      const statusInfo = taskStatusMap[task.status];
                      const Icon = statusInfo?.icon ?? Circle;
                      const isDropdownOpen = statusDropdownTaskId === task.id;
                      const taskOverdue =
                        task.status !== "done" &&
                        task.due_date &&
                        new Date(task.due_date) < new Date();

                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-5 py-4 border-b border-nu-ink/[0.04] last:border-0 hover:bg-nu-cream/10 transition-colors"
                        >
                          {/* Status Toggle / Dropdown */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => {
                                if (!isLead) return;
                                setStatusDropdownTaskId(
                                  isDropdownOpen ? null : task.id
                                );
                              }}
                              disabled={
                                !isLead || togglingTaskId === task.id
                              }
                              className={`transition-opacity ${
                                statusInfo?.color ?? "text-nu-gray"
                              } ${isLead ? "cursor-pointer hover:opacity-70" : "cursor-default opacity-50"}`}
                            >
                              {togglingTaskId === task.id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Icon size={18} />
                              )}
                            </button>

                            {/* Status dropdown */}
                            {isDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() =>
                                    setStatusDropdownTaskId(null)
                                  }
                                />
                                <div className="absolute left-0 top-full mt-1 z-20 bg-nu-paper border-[2px] border-nu-ink/[0.15] shadow-lg min-w-[120px]">
                                  {taskStatusOptions.map((opt) => {
                                    const OptIcon = opt.icon;
                                    return (
                                      <button
                                        key={opt.value}
                                        onClick={() =>
                                          setTaskStatus(task, opt.value)
                                        }
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-cream/30 transition-colors ${
                                          task.status === opt.value
                                            ? "bg-nu-cream/20 font-bold"
                                            : ""
                                        } ${opt.color}`}
                                      >
                                        <OptIcon size={12} />
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>

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

                          {/* Priority badge */}
                          {(task as any).priority && (
                            <span
                              className={`font-mono-nu text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border shrink-0 ${
                                (task as any).priority === "high"
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : (task as any).priority === "medium"
                                    ? "bg-nu-amber/10 text-nu-amber border-nu-amber/20"
                                    : "bg-nu-gray/10 text-nu-gray border-nu-gray/20"
                              }`}
                            >
                              {(task as any).priority === "high"
                                ? "높음"
                                : (task as any).priority === "medium"
                                  ? "보통"
                                  : "낮음"}
                            </span>
                          )}

                          {/* Status Badge */}
                          <span
                            className={`font-mono-nu text-[10px] font-bold uppercase px-1.5 py-0.5 shrink-0 ${
                              task.status === "done"
                                ? "bg-green-50 text-green-600"
                                : task.status === "in_progress"
                                  ? "bg-nu-amber/10 text-nu-amber"
                                  : "bg-nu-gray/10 text-nu-gray"
                            }`}
                          >
                            {statusInfo?.label ?? "할일"}
                          </span>

                          {/* Assignee - more prominent */}
                          {task.assignee && (
                            <div className="flex items-center gap-2 shrink-0 bg-nu-cream/30 px-2 py-1 border border-nu-ink/[0.06]">
                              {task.assignee.avatar_url ? (
                                <img
                                  src={task.assignee.avatar_url}
                                  alt={task.assignee.nickname || ""}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-nu-pink/20 flex items-center justify-center font-head text-[11px] font-bold text-nu-pink">
                                  {(task.assignee.nickname || "U")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                              )}
                              <span className="font-mono-nu text-[11px] text-nu-ink font-medium">
                                {task.assignee.nickname}
                              </span>
                            </div>
                          )}

                          {/* Due Date */}
                          {task.due_date && (
                            <span
                              className={`font-mono-nu text-[10px] shrink-0 flex items-center gap-1 ${taskOverdue ? "text-red-600 font-bold" : "text-nu-muted"}`}
                            >
                              <Calendar size={10} />
                              {new Date(task.due_date).toLocaleDateString(
                                "ko",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                              {taskOverdue && (
                                <AlertTriangle
                                  size={10}
                                  className="text-red-500"
                                />
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Settlement Badges */}
      <div className="space-y-3">
        {milestones
          .filter(
            (ms) =>
              ms.status === "completed" && (ms as any).reward_percentage > 0
          )
          .map((ms) => (
            <div
              key={ms.id}
              className="bg-nu-pink/10 border border-nu-pink/20 px-4 py-3 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-nu-pink shrink-0" />
              <div className="flex-1">
                <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-pink mb-0.5">
                  {ms.title} - 정산 활성화
                </p>
                <p className="text-xs text-nu-muted">
                  {(ms as any).reward_percentage}% 보상 · 마일스톤 완료
                </p>
              </div>
              {(ms as any).is_settled ? (
                <span className="font-mono-nu text-[11px] font-bold uppercase px-2 py-1 bg-nu-ink text-nu-paper">
                  SETTLED
                </span>
              ) : isLead ? (
                <span className="font-mono-nu text-[11px] font-bold uppercase px-2 py-1 bg-nu-pink text-white">
                  PENDING
                </span>
              ) : null}
            </div>
          ))}
      </div>
    </div>
  );
}
