"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  GripVertical,
  Plus,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Edit3,
  Trash2,
  ArrowRight,
  Filter,
  X,
  Search,
  Layers,
  Tag,
} from "lucide-react";

/* ─── Types ─── */
interface Task {
  id: string;
  milestone_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  assigned_to: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  assignee?: { id: string; nickname: string | null; avatar_url: string | null } | null;
  milestone?: { id: string; title: string } | null;
}

interface Member {
  user_id: string;
  profile?: { id: string; nickname: string | null; avatar_url: string | null };
}

interface KanbanColumn {
  key: "todo" | "in_progress" | "done";
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Clock;
}

const COLUMNS: KanbanColumn[] = [
  {
    key: "todo",
    label: "대기",
    color: "text-nu-muted",
    bgColor: "bg-nu-cream/40",
    borderColor: "border-nu-ink/10",
    icon: Clock,
  },
  {
    key: "in_progress",
    label: "진행 중",
    color: "text-nu-amber",
    bgColor: "bg-amber-50/60",
    borderColor: "border-amber-200",
    icon: Loader2,
  },
  {
    key: "done",
    label: "완료",
    color: "text-green-600",
    bgColor: "bg-green-50/60",
    borderColor: "border-green-200",
    icon: CheckCircle2,
  },
];

/* ─── Main Component ─── */
export function ProjectKanbanBoard({
  projectId,
  canEdit,
  onTaskChange,
}: {
  projectId: string;
  canEdit: boolean;
  onTaskChange?: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [milestones, setMilestones] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterMilestone, setFilterMilestone] = useState<string | null>(null);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // New task inline
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [tasksRes, membersRes, msRes] = await Promise.allSettled([
      supabase
        .from("project_tasks")
        .select("*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url), milestone:project_milestones!project_tasks_milestone_id_fkey(id, title)")
        .eq("project_id", projectId)
        .order("sort_order"),
      supabase
        .from("project_members")
        .select("user_id, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url)")
        .eq("project_id", projectId),
      supabase
        .from("project_milestones")
        .select("id, title")
        .eq("project_id", projectId)
        .order("sort_order"),
    ]);

    if (tasksRes.status === "fulfilled" && tasksRes.value.data) {
      setTasks(tasksRes.value.data as Task[]);
    }
    if (membersRes.status === "fulfilled" && membersRes.value.data) {
      setMembers(membersRes.value.data as unknown as Member[]);
    }
    if (msRes.status === "fulfilled" && msRes.value.data) {
      setMilestones(msRes.value.data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filter logic ───────────────────────────────────────────────────
  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee && t.assigned_to !== filterAssignee) return false;
    if (filterMilestone && t.milestone_id !== filterMilestone) return false;
    if (filterOverdue && t.status !== "done" && t.due_date) {
      if (new Date(t.due_date) >= new Date()) return false;
    }
    if (filterOverdue && !t.due_date) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeFilters = [filterAssignee, filterMilestone, filterOverdue, searchQuery].filter(Boolean).length;

  // ── Drag & Drop ────────────────────────────────────────────────────
  function handleDragStart(taskId: string) {
    if (!canEdit) return;
    setDraggingId(taskId);
  }

  function handleDragOver(e: React.DragEvent, columnKey: string) {
    e.preventDefault();
    setDragOverColumn(columnKey);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: React.DragEvent, newStatus: "todo" | "in_progress" | "done") {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggingId || !canEdit) return;

    const task = tasks.find((t) => t.id === draggingId);
    if (!task || task.status === newStatus) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === draggingId ? { ...t, status: newStatus } : t))
    );
    setDraggingId(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: newStatus })
      .eq("id", draggingId);

    if (error) {
      toast.error("상태 변경 실패");
      loadData(); // Revert
    } else {
      onTaskChange?.();
    }
  }

  // ── Quick status change (click) ────────────────────────────────────
  async function moveTask(taskId: string, newStatus: "todo" | "in_progress" | "done") {
    if (!canEdit) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      toast.error("상태 변경 실패");
      loadData();
    } else {
      onTaskChange?.();
    }
  }

  // ── Add task inline ────────────────────────────────────────────────
  async function handleAddTask(status: "todo" | "in_progress" | "done") {
    if (!newTaskTitle.trim() || addingTask) return;
    setAddingTask(true);

    const supabase = createClient();

    // Use first milestone if exists, or create without
    const milestoneId = milestones[0]?.id;
    if (!milestoneId) {
      toast.error("마일스톤을 먼저 생성해주세요");
      setAddingTask(false);
      return;
    }

    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        milestone_id: milestoneId,
        title: newTaskTitle.trim(),
        status,
        sort_order: filteredTasks.filter((t) => t.status === status).length,
      })
      .select("*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url), milestone:project_milestones!project_tasks_milestone_id_fkey(id, title)")
      .single();

    if (error) {
      toast.error("태스크 추가 실패: " + error.message);
    } else if (data) {
      setTasks((prev) => [...prev, data as Task]);
      setNewTaskTitle("");
      setAddingInColumn(null);
      onTaskChange?.();
    }
    setAddingTask(false);
  }

  // ── Delete task ────────────────────────────────────────────────────
  async function handleDeleteTask(taskId: string) {
    if (!confirm("이 태스크를 삭제하시겠습니까?")) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const supabase = createClient();
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("삭제 실패");
      loadData();
    } else {
      onTaskChange?.();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-nu-pink" />
      </div>
    );
  }

  const isOverdue = (task: Task) =>
    task.status !== "done" && task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Header + Filters ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-head text-lg font-extrabold flex items-center gap-2">
            <Layers size={20} className="text-nu-pink" />
            칸반 보드
          </h2>
          <span className="font-mono-nu text-xs text-nu-muted">
            {filteredTasks.length}개 태스크
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="태스크 검색..."
              className="pl-8 pr-3 py-1.5 text-sm border border-nu-ink/10 bg-white focus:border-nu-pink focus:outline-none w-48"
            />
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-sm transition-colors ${
              activeFilters > 0
                ? "border-nu-pink bg-nu-pink/5 text-nu-pink font-bold"
                : "border-nu-ink/10 text-nu-muted hover:text-nu-ink"
            }`}
          >
            <Filter size={14} />
            필터
            {activeFilters > 0 && (
              <span className="text-[11px] bg-nu-pink text-white px-1.5 py-0.5 font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="bg-white border-2 border-nu-ink/10 p-4 mb-6 flex flex-wrap gap-4 items-end">
          {/* Assignee */}
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1">
              <User size={10} className="inline mr-1" />담당자
            </label>
            <select
              value={filterAssignee || ""}
              onChange={(e) => setFilterAssignee(e.target.value || null)}
              className="text-sm border border-nu-ink/10 px-3 py-1.5 bg-white focus:outline-none focus:border-nu-pink"
            >
              <option value="">전체</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.nickname || "알 수 없음"}
                </option>
              ))}
              <option value="__unassigned__">미배정</option>
            </select>
          </div>

          {/* Milestone */}
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1">
              <Tag size={10} className="inline mr-1" />마일스톤
            </label>
            <select
              value={filterMilestone || ""}
              onChange={(e) => setFilterMilestone(e.target.value || null)}
              className="text-sm border border-nu-ink/10 px-3 py-1.5 bg-white focus:outline-none focus:border-nu-pink"
            >
              <option value="">전체</option>
              {milestones.map((ms) => (
                <option key={ms.id} value={ms.id}>
                  {ms.title}
                </option>
              ))}
            </select>
          </div>

          {/* Overdue only */}
          <label className="flex items-center gap-2 text-sm cursor-pointer py-1.5">
            <input
              type="checkbox"
              checked={filterOverdue}
              onChange={(e) => setFilterOverdue(e.target.checked)}
              className="accent-nu-pink"
            />
            <AlertTriangle size={13} className="text-red-500" />
            기한 초과만
          </label>

          {/* Clear all */}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setFilterAssignee(null);
                setFilterMilestone(null);
                setFilterOverdue(false);
                setSearchQuery("");
              }}
              className="text-sm text-nu-muted hover:text-red-500 transition-colors flex items-center gap-1 py-1.5"
            >
              <X size={12} /> 필터 초기화
            </button>
          )}
        </div>
      )}

      {/* ── Kanban Columns ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.key);
          const isDragOver = dragOverColumn === col.key;

          return (
            <div
              key={col.key}
              className={`flex flex-col border-2 transition-all ${
                isDragOver
                  ? "border-nu-pink bg-nu-pink/5 scale-[1.01]"
                  : col.borderColor + " " + col.bgColor
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-nu-ink/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <col.icon
                    size={14}
                    className={`${col.color} ${col.key === "in_progress" ? "animate-spin" : ""}`}
                  />
                  <span className={`font-head text-sm font-bold ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="font-mono-nu text-[12px] bg-white/60 px-2 py-0.5 text-nu-muted font-bold">
                    {colTasks.length}
                  </span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setAddingInColumn(addingInColumn === col.key ? null : col.key);
                      setNewTaskTitle("");
                    }}
                    className="text-nu-muted hover:text-nu-pink transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Task Cards */}
              <div className="flex-1 p-3 space-y-2 min-h-[200px]">
                {/* Inline add */}
                {addingInColumn === col.key && canEdit && (
                  <div className="bg-white border-2 border-nu-pink/30 p-3 shadow-sm">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTask(col.key);
                        if (e.key === "Escape") { setAddingInColumn(null); setNewTaskTitle(""); }
                      }}
                      placeholder="태스크 제목 입력..."
                      className="w-full text-sm border-0 focus:outline-none bg-transparent mb-2"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddTask(col.key)}
                        disabled={addingTask || !newTaskTitle.trim()}
                        className="px-3 py-1 bg-nu-ink text-white text-xs font-bold hover:bg-nu-pink transition-colors disabled:opacity-40"
                      >
                        {addingTask ? <Loader2 size={12} className="animate-spin" /> : "추가"}
                      </button>
                      <button
                        onClick={() => { setAddingInColumn(null); setNewTaskTitle(""); }}
                        className="text-xs text-nu-muted hover:text-nu-ink"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* Task cards */}
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEdit}
                    isOverdue={!!isOverdue(task)}
                    isDragging={draggingId === task.id}
                    onDragStart={() => handleDragStart(task.id)}
                    onMove={moveTask}
                    onDelete={handleDeleteTask}
                    columns={COLUMNS}
                  />
                ))}

                {/* Empty state */}
                {colTasks.length === 0 && addingInColumn !== col.key && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <col.icon size={24} className="text-nu-ink/10 mb-2" />
                    <p className="text-xs text-nu-muted">
                      {col.key === "todo" && "대기 중인 태스크가 없습니다"}
                      {col.key === "in_progress" && "진행 중인 태스크가 없습니다"}
                      {col.key === "done" && "완료된 태스크가 없습니다"}
                    </p>
                  </div>
                )}
              </div>

              {/* Column Footer Stats */}
              <div className="px-4 py-2 border-t border-nu-ink/5 bg-white/40">
                <div className="flex items-center justify-between">
                  <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
                    {colTasks.length}개
                  </span>
                  {col.key !== "done" && colTasks.filter((t) => isOverdue(t)).length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-red-500 font-bold">
                      <AlertTriangle size={10} />
                      {colTasks.filter((t) => isOverdue(t)).length} 지연
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Task Card Component ─── */
function TaskCard({
  task,
  canEdit,
  isOverdue,
  isDragging,
  onDragStart,
  onMove,
  onDelete,
  columns,
}: {
  task: Task;
  canEdit: boolean;
  isOverdue: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onMove: (taskId: string, newStatus: "todo" | "in_progress" | "done") => void;
  onDelete: (taskId: string) => void;
  columns: KanbanColumn[];
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      className={`group bg-white border p-3 transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${
        isDragging
          ? "opacity-40 border-nu-pink"
          : isOverdue
          ? "border-red-200 hover:border-red-400"
          : "border-nu-ink/10 hover:border-nu-ink/30"
      }`}
    >
      {/* Title row */}
      <div className="flex items-start gap-2 mb-2">
        {canEdit && (
          <GripVertical size={14} className="text-nu-ink/20 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <p className={`text-sm font-medium flex-1 leading-snug ${task.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
          {task.title}
        </p>
        {canEdit && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-nu-ink/20 hover:text-nu-ink transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-6 z-50 bg-white border-2 border-nu-ink shadow-lg py-1 min-w-[140px]">
                  {columns
                    .filter((c) => c.key !== task.status)
                    .map((c) => (
                      <button
                        key={c.key}
                        onClick={() => {
                          onMove(task.id, c.key);
                          setShowMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-nu-cream/50 flex items-center gap-2 ${c.color}`}
                      >
                        <ArrowRight size={11} /> {c.label}로 이동
                      </button>
                    ))}
                  <hr className="my-1 border-nu-ink/10" />
                  <button
                    onClick={() => {
                      onDelete(task.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 size={11} /> 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Milestone tag */}
        {task.milestone?.title && (
          <span className="font-mono-nu text-[10px] bg-nu-ink/5 text-nu-muted px-1.5 py-0.5 truncate max-w-[120px]">
            {task.milestone.title}
          </span>
        )}

        {/* Due date */}
        {task.due_date && (
          <span
            className={`font-mono-nu text-[10px] flex items-center gap-0.5 ${
              isOverdue ? "text-red-500 font-bold" : "text-nu-muted"
            }`}
          >
            <Calendar size={9} />
            {new Date(task.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Assignee avatar */}
        {task.assignee?.nickname && (
          <div
            className="w-5 h-5 rounded-full bg-nu-pink/15 flex items-center justify-center shrink-0"
            title={task.assignee.nickname}
          >
            <span className="text-[10px] font-bold text-nu-pink">
              {task.assignee.nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Overdue badge */}
        {isOverdue && (
          <AlertTriangle size={12} className="text-red-500 shrink-0" />
        )}
      </div>
    </div>
  );
}
