"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckSquare, Clock, Plus, AlertTriangle, X, Square, CheckCircle2, Circle, Users, Link2, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface StaffProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
}

export default function StaffTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [boltTasks, setBoltTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [boltProjects, setBoltProjects] = useState<any[]>([]);
  const [nutGroups, setNutGroups] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine">("mine");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "staff" | "bolt" | "google">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortBy, setSortBy] = useState<"default" | "due_date" | "priority">("default");
  const [userId, setUserId] = useState("");

  // Quick-add task
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickAssignee, setQuickAssignee] = useState("");
  const [quickSource, setQuickSource] = useState<"staff" | "bolt">("staff");
  const [adding, setAdding] = useState(false);
  // Google Tasks
  const [googleTasks, setGoogleTasks] = useState<any[]>([]);
  const [googleTasksLoaded, setGoogleTasksLoaded] = useState(false);
  const [googleTasksLoading, setGoogleTasksLoading] = useState(false);
  const [googleTasksError, setGoogleTasksError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [
        { data: taskData },
        { data: projData },
        { data: boltTaskData },
        { data: boltProjData },
        { data: staffData },
        { data: nutData },
      ] = await Promise.all([
        supabase
          .from("staff_tasks")
          .select("*, project:staff_projects(id, title), assignee:profiles!staff_tasks_assigned_to_fkey(id, nickname, avatar_url)")
          .order("created_at", { ascending: false }),
        supabase.from("staff_projects").select("id, title").eq("status", "active").order("title"),
        // 볼트 태스크 — 모든 스태프가 볼 수 있게
        supabase
          .from("project_tasks")
          .select("id, title, status, due_date, assigned_to, milestone:project_milestones(title, project_id, project:projects(id, title))")
          .in("status", ["todo", "in_progress", "done"])
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("projects").select("id, title").eq("status", "active").order("title"),
        // 모든 스태프 프로필
        supabase.from("profiles").select("id, nickname, avatar_url").in("role", ["staff", "admin"]),
        // 너트(소모임)
        supabase.from("crews").select("id, name").eq("status", "active").order("name"),
      ]);

      setTasks(taskData || []);
      setProjects(projData || []);
      setBoltTasks(boltTaskData || []);
      setBoltProjects(boltProjData || []);
      setStaffMembers(staffData || []);
      setNutGroups(nutData || []);
      setQuickAssignee(user.id);
      setLoading(false);
    }
    load();
  }, []);

  // Load Google Tasks
  async function loadGoogleTasks() {
    setGoogleTasksLoading(true);
    setGoogleTasksError(null);
    try {
      const listsRes = await fetch("/api/google/tasks");
      if (!listsRes.ok) {
        const d = await listsRes.json();
        setGoogleTasksError(d.detail || "Google Tasks 로드 실패");
        setGoogleTasksLoading(false);
        return;
      }
      const { taskLists } = await listsRes.json();
      const allTasks: any[] = [];
      for (const list of (taskLists || []).slice(0, 5)) {
        const res = await fetch(`/api/google/tasks?listId=${encodeURIComponent(list.id)}`);
        if (res.ok) {
          const data = await res.json();
          (data.tasks || []).forEach((t: any) => {
            if (t.title) {
              allTasks.push({ ...t, _listId: list.id, _listTitle: list.title });
            }
          });
        }
      }
      setGoogleTasks(allTasks);
      setGoogleTasksLoaded(true);
    } catch {
      setGoogleTasksError("Google Tasks 연결 오류");
    }
    setGoogleTasksLoading(false);
  }

  useEffect(() => {
    if (!loading && !googleTasksLoaded) loadGoogleTasks();
  }, [loading]);

  async function toggleGoogleTask(taskId: string, listId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "needsAction" : "completed";
    setGoogleTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch("/api/google/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, taskId, status: newStatus }),
      });
      if (!res.ok) {
        setGoogleTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t));
        toast.error("Google Task 상태 변경 실패");
      }
    } catch {
      setGoogleTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t));
      toast.error("Google Task 연결 오류");
    }
  }

  async function toggleStatus(taskId: string, currentStatus: string, isBolt: boolean = false) {
    if (isBolt) {
      // 볼트 태스크 상태 변경
      const next = currentStatus === "done" ? "todo" : "done";
      const supabase = createClient();
      const { error } = await supabase.from("project_tasks").update({
        status: next,
      }).eq("id", taskId);
      if (error) { toast.error("상태 변경 실패"); return; }
      setBoltTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
      return;
    }

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

    if (quickSource === "bolt") {
      // 볼트 프로젝트에 태스크 추가 — milestone 필요
      const { data: milestones } = await supabase
        .from("project_milestones")
        .select("id")
        .eq("project_id", quickProjectId)
        .limit(1);

      if (!milestones || milestones.length === 0) {
        toast.error("볼트 프로젝트에 마일스톤이 필요합니다");
        setAdding(false);
        return;
      }

      const { error } = await supabase.from("project_tasks").insert({
        milestone_id: milestones[0].id,
        title: quickTitle.trim(),
        assigned_to: quickAssignee || userId,
      });
      if (error) toast.error("할일 추가 실패");
      else {
        toast.success("볼트 할일이 추가되었습니다");
        setQuickTitle("");
        // Reload bolt tasks
        const { data } = await supabase
          .from("project_tasks")
          .select("id, title, status, due_date, assigned_to, milestone:project_milestones(title, project_id, project:projects(id, title))")
          .in("status", ["todo", "in_progress", "done"])
          .order("created_at", { ascending: false })
          .limit(100);
        setBoltTasks(data || []);
        setShowQuickAdd(false);
      }
    } else {
      const { error } = await supabase.from("staff_tasks").insert({
        project_id: quickProjectId,
        title: quickTitle.trim(),
        created_by: userId,
        assigned_to: quickAssignee || userId,
      });
      if (error) toast.error("할일 추가 실패");
      else {
        toast.success("할일이 추가되었습니다");
        setQuickTitle("");
        const { data } = await supabase
          .from("staff_tasks")
          .select("*, project:staff_projects(id, title), assignee:profiles!staff_tasks_assigned_to_fkey(id, nickname, avatar_url)")
          .order("created_at", { ascending: false });
        setTasks(data || []);
        setShowQuickAdd(false);
      }
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

  // Checkbox component
  function StatusCheckbox({ status, taskId, isBolt }: { status: string; taskId: string; isBolt?: boolean }) {
    if (status === "done") {
      return (
        <button
          onClick={() => toggleStatus(taskId, status, isBolt)}
          className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 group/check"
          aria-label="완료 해제"
        >
          <CheckCircle2 size={20} className="text-green-500 group-hover/check:text-green-300 transition-colors" />
        </button>
      );
    }
    if (status === "in_progress") {
      return (
        <button
          onClick={() => toggleStatus(taskId, status, isBolt)}
          className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 group/check"
          aria-label="완료로 변경"
        >
          <div className="relative">
            <Circle size={20} className="text-indigo-400 group-hover/check:text-green-400 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-indigo-400 group-hover/check:bg-green-400 transition-colors" />
            </div>
          </div>
        </button>
      );
    }
    return (
      <button
        onClick={() => toggleStatus(taskId, status, isBolt)}
        className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 group/check"
        aria-label="진행중으로 변경"
      >
        <Circle size={20} className="text-nu-muted/40 group-hover/check:text-indigo-400 transition-colors" />
      </button>
    );
  }

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  // Normalize bolt tasks to common format
  const normalizedBoltTasks = useMemo(() => {
    return boltTasks.map(bt => ({
      ...bt,
      _source: "bolt" as const,
      _projectTitle: (bt.milestone as any)?.project?.title || "",
      _projectId: (bt.milestone as any)?.project_id || (bt.milestone as any)?.project?.id || "",
      _projectHref: `/projects/${(bt.milestone as any)?.project?.id}`,
      priority: "medium",
    }));
  }, [boltTasks]);

  // Combined & filtered tasks
  const allFilteredTasks = useMemo(() => {
    let staffResult = tasks.map(t => ({
      ...t,
      _source: "staff" as const,
      _projectTitle: t.project?.title || "",
      _projectId: t.project_id,
      _projectHref: `/staff/workspace/${t.project?.id || t.project_id}`,
    }));

    let boltResult = normalizedBoltTasks;

    // Google Tasks normalized
    let googleResult = googleTasks.map(t => ({
      ...t,
      _source: "google" as const,
      _projectTitle: t._listTitle || "Google Tasks",
      _projectId: t._listId || "",
      _projectHref: "",
      status: t.status === "completed" ? "done" : "todo",
      due_date: t.due || null,
      assigned_to: userId,
      priority: "medium",
      title: t.title,
    }));

    // Source filter
    if (sourceFilter === "staff") { boltResult = []; googleResult = []; }
    if (sourceFilter === "bolt") { staffResult = []; googleResult = []; }
    if (sourceFilter === "google") { staffResult = []; boltResult = []; }

    let result = [...staffResult, ...boltResult, ...googleResult];

    // Mine / All / Member filter
    if (filter === "mine") {
      result = result.filter(t => t.assigned_to === userId);
    } else if (memberFilter !== "all") {
      result = result.filter(t => t.assigned_to === memberFilter);
    }

    if (projectFilter !== "all") {
      result = result.filter(t => t._projectId === projectFilter);
    }
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    if (statusFilter === "active") result = result.filter(t => t.status !== "done");
    else if (statusFilter === "done") result = result.filter(t => t.status === "done");

    if (sortBy === "due_date") {
      result = [...result].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    } else if (sortBy === "priority") {
      const pOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      result = [...result].sort((a, b) => (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4));
    }

    return result;
  }, [tasks, normalizedBoltTasks, googleTasks, filter, userId, memberFilter, projectFilter, priorityFilter, statusFilter, sortBy, sourceFilter]);

  const grouped = useMemo(() => ({
    inProgress: allFilteredTasks.filter(t => t.status === "in_progress"),
    todo: allFilteredTasks.filter(t => t.status === "todo"),
    done: allFilteredTasks.filter(t => t.status === "done"),
  }), [allFilteredTasks]);

  const overdueCount = allFilteredTasks.filter(t => t.status !== "done" && getDueDateStatus(t.due_date) === "overdue").length;

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
            스태프 + 볼트 + Google Tasks · {allFilteredTasks.length}개
            {overdueCount > 0 && (
              <span className="ml-2 text-red-600">· {overdueCount}개 지연</span>
            )}
            {googleTasksLoading && <span className="ml-2 text-blue-500">Google Tasks 로딩...</span>}
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

      {/* Quick add form - enhanced with assignee & source */}
      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className="bg-white border border-indigo-200 p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Input
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="할일 제목..."
                className="border-nu-ink/15 bg-transparent"
              />
            </div>
            {/* Source type */}
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">연결</label>
              <select
                value={quickSource}
                onChange={e => { setQuickSource(e.target.value as any); setQuickProjectId(""); }}
                className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm"
              >
                <option value="staff">스태프 프로젝트</option>
                <option value="bolt">볼트 프로젝트</option>
              </select>
            </div>
            {/* Project select */}
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">프로젝트</label>
              <select
                value={quickProjectId}
                onChange={e => setQuickProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm"
              >
                <option value="">프로젝트 선택</option>
                {(quickSource === "staff" ? projects : boltProjects).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            {/* Assignee */}
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">담당자</label>
              <select
                value={quickAssignee}
                onChange={e => setQuickAssignee(e.target.value)}
                className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm"
              >
                {staffMembers.map(s => (
                  <option key={s.id} value={s.id}>{s.nickname || "Unknown"} {s.id === userId ? "(나)" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={adding || !quickTitle.trim() || !quickProjectId} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
            {adding ? "추가 중..." : "추가"}
          </Button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Mine / All / Team member */}
        <div className="flex gap-1">
          {(["mine", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setMemberFilter("all"); }}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors cursor-pointer ${
                filter === f && memberFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
              }`}
            >
              {f === "mine" ? "내 할일" : "전체"}
            </button>
          ))}
        </div>

        {/* Team member filter */}
        {filter === "all" && (
          <select
            value={memberFilter}
            onChange={e => setMemberFilter(e.target.value)}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
          >
            <option value="all">모든 멤버</option>
            {staffMembers.map(s => (
              <option key={s.id} value={s.id}>
                {s.nickname || "Unknown"} {s.id === userId ? "(나)" : ""}
              </option>
            ))}
          </select>
        )}

        {/* Source filter (staff/bolt) */}
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value as any)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="all">전체 (스태프+볼트+Google)</option>
          <option value="staff">스태프만</option>
          <option value="bolt">볼트만</option>
          <option value="google">Google Tasks</option>
        </select>

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="all">모든 프로젝트</option>
          <optgroup label="스태프">
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </optgroup>
          <optgroup label="볼트">
            {boltProjects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </optgroup>
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

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="active">미완료</option>
          <option value="all">전체</option>
          <option value="done">완료만</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="default">기본 정렬</option>
          <option value="due_date">마감일순</option>
          <option value="priority">우선순위순</option>
        </select>

        {(projectFilter !== "all" || priorityFilter !== "all" || statusFilter !== "active" || sourceFilter !== "all" || memberFilter !== "all") && (
          <button
            onClick={() => { setProjectFilter("all"); setPriorityFilter("all"); setStatusFilter("active"); setSourceFilter("all"); setMemberFilter("all"); }}
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
                  const isBolt = t._source === "bolt";
                  return (
                    <div key={`${t._source}-${t.id}`} className={`flex items-center gap-3 px-4 py-3 bg-white border transition-colors ${
                      dueStatus === "overdue" ? "border-red-200 bg-red-50/30" :
                      dueStatus === "today" ? "border-orange-200 bg-orange-50/20" :
                      isBolt ? "border-purple-100 hover:border-purple-200" :
                      "border-nu-ink/[0.06] hover:border-indigo-200"
                    }`}>
                      {t._source === "google" ? (
                        <button
                          onClick={() => toggleGoogleTask(t.id, t._listId, t.status === "done" ? "completed" : "needsAction")}
                          className="flex-shrink-0 bg-transparent border-none cursor-pointer p-0 group/check"
                        >
                          {t.status === "done"
                            ? <CheckCircle2 size={20} className="text-green-500 group-hover/check:text-green-300 transition-colors" />
                            : <Circle size={20} className="text-blue-400 group-hover/check:text-green-400 transition-colors" />}
                        </button>
                      ) : (
                        <StatusCheckbox status={t.status} taskId={t.id} isBolt={isBolt} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-head text-sm font-bold truncate ${t.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Source badge */}
                          <span className={`font-mono-nu text-[7px] uppercase px-1.5 py-px ${
                            t._source === "google" ? "bg-blue-100 text-blue-600" :
                            isBolt ? "bg-purple-100 text-purple-600" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {t._source === "google" ? "Google" : isBolt ? "볼트" : "스태프"}
                          </span>

                          {/* Project link */}
                          {t._projectTitle && (
                            <Link
                              href={t._projectHref}
                              className={`font-mono-nu text-[8px] no-underline hover:underline flex items-center gap-0.5 ${
                                isBolt ? "text-purple-600" : "text-indigo-600"
                              }`}
                              onClick={e => e.stopPropagation()}
                            >
                              <Link2 size={7} />
                              {t._projectTitle}
                            </Link>
                          )}

                          {/* Assignee */}
                          {t.assignee ? (
                            <span className="font-mono-nu text-[8px] text-nu-muted flex items-center gap-0.5">
                              <Users size={7} />
                              {t.assignee.nickname}
                              {t.assignee.id === userId && " (나)"}
                            </span>
                          ) : isBolt && t.assigned_to ? (
                            <span className="font-mono-nu text-[8px] text-nu-muted flex items-center gap-0.5">
                              <Users size={7} />
                              {staffMembers.find(s => s.id === t.assigned_to)?.nickname || ""}
                            </span>
                          ) : null}

                          {t.completed_at && t.status === "done" && (
                            <span className="font-mono-nu text-[8px] text-green-600">
                              {new Date(t.completed_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 완료
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
