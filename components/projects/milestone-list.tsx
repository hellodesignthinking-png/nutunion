"use client";

import { useState, useEffect, useCallback } from "react";
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
  Link2,
  MessageSquare,
  Heart,
  Send,
  Trash2,
  ExternalLink,
  Edit3,
} from "lucide-react";
import type { ProjectMilestone, ProjectTask, MilestoneStatus, TaskStatus } from "@/lib/types";
import { ResourceInteractions } from "@/components/shared/resource-interactions";

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

interface MilestoneComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  author?: { nickname: string; avatar_url: string | null };
  replies?: MilestoneComment[];
}

interface MilestoneLink {
  id: string;
  milestone_id: string;
  url: string;
  title: string;
  created_by: string;
  created_at: string;
}

export function MilestoneList({
  projectId,
  initialMilestones,
  canEdit,
  onTaskChange,
}: {
  projectId: string;
  initialMilestones: ProjectMilestone[];
  canEdit: boolean;
  onTaskChange?: () => void;
}) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(initialMilestones);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMsTitle, setNewMsTitle] = useState("");
  const [newMsDueDate, setNewMsDueDate] = useState("");
  const [newMsReward, setNewMsReward] = useState(0);
  const [savingMs, setSavingMs] = useState(false);
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [editingMs, setEditingMs] = useState<string | null>(null);
  const [editMsTitle, setEditMsTitle] = useState("");
  const [editMsDueDate, setEditMsDueDate] = useState("");
  const [editMsReward, setEditMsReward] = useState(0);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskAssignee, setEditTaskAssignee] = useState("");

  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [projectMembers, setProjectMembers] = useState<{id: string; nickname: string}[]>([]);

  // Per-milestone comments & links
  const [msComments, setMsComments] = useState<Record<string, MilestoneComment[]>>({});
  const [msLinks, setMsLinks] = useState<Record<string, MilestoneLink[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [msLikes, setMsLikes] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [activeSection, setActiveSection] = useState<Record<string, "tasks" | "links" | "comments">>({});
  const [userId, setUserId] = useState<string | null>(null);

  // Available resources for linking (unlinked resources)
  const [availableResources, setAvailableResources] = useState<any[]>([]);
  const [showResourceSelector, setShowResourceSelector] = useState<string | null>(null);
  const [savingResourceLink, setSavingResourceLink] = useState(false);

  // ─── Fetch FRESH milestones from DB on mount ───
  const fetchMilestones = useCallback(async () => {
    const supabase = createClient();
    // Simple query first (always works if table exists)
    const { data: basicData, error: basicError } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");

    if (basicError || !basicData) {
      setMilestones([]);
      return;
    }

    // Now try to fetch tasks separately for each milestone
    try {
      const { data: fullData, error: fullError } = await supabase
        .from("project_milestones")
        .select("*, tasks:project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url))")
        .eq("project_id", projectId)
        .order("sort_order");

      if (!fullError && fullData) {
        setMilestones(fullData);
        return;
      }
    } catch { /* FK join not available */ }

    // Use basic data with empty tasks
    setMilestones(basicData.map((m: any) => ({ ...m, tasks: [] })));
  }, [projectId]);

  useEffect(() => {
    // Always fetch fresh from DB to prevent stale data after navigation
    fetchMilestones();

    // Get current user
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    
    // Fetch project members for assignment
    supabase.from("project_members")
      .select("user_id, member:profiles!project_members_user_id_fkey(id, nickname)")
      .eq("project_id", projectId)
      .then(({ data }) => {
        if (data) {
          const membersList = data.map((d: any) => d.member).filter(Boolean);
          setProjectMembers(membersList);
        }
      });
  }, [fetchMilestones, projectId]);

  // ─── Fetch comments & likes for expanded milestones ───
  async function fetchMilestoneInteractions(milestoneId: string) {
    const supabase = createClient();

    // Fetch comments
    const { data: comments } = await supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(nickname, avatar_url)")
      .eq("target_type", "milestone")
      .eq("target_id", milestoneId)
      .order("created_at");

    if (comments) {
      // Thread replies
      const topLevel = comments.filter((c: any) => !c.parent_id);
      const replies = comments.filter((c: any) => c.parent_id);
      const threaded = topLevel.map((c: any) => ({
        ...c,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
        replies: replies
          .filter((r: any) => r.parent_id === c.id)
          .map((r: any) => ({ ...r, author: Array.isArray(r.author) ? r.author[0] : r.author })),
      }));
      setMsComments((prev) => ({ ...prev, [milestoneId]: threaded }));
    }

    // Fetch likes
    const { count: likeCount } = await supabase
      .from("reactions")
      .select("*", { count: "exact", head: true })
      .eq("target_type", "milestone")
      .eq("target_id", milestoneId);

    let liked = false;
    if (userId) {
      const { data: myLike } = await supabase
        .from("reactions")
        .select("id")
        .eq("target_type", "milestone")
        .eq("target_id", milestoneId)
        .eq("user_id", userId)
        .maybeSingle();
      liked = !!myLike;
    }
    setMsLikes((prev) => ({ ...prev, [milestoneId]: { count: likeCount || 0, liked } }));

    // Fetch links (from project_resources linked to milestone)
    try {
      const { data: links, error: linksError } = await supabase
        .from("project_resources")
        .select("*")
        .eq("project_id", projectId)
        .eq("milestone_id", milestoneId)
        .order("created_at", { ascending: false });

      if (!linksError && links) {
        setMsLinks((prev) => ({ ...prev, [milestoneId]: links as any }));
      }

      // Fetch available resources (not yet linked to any milestone)
      const { data: resources, error: resError } = await supabase
        .from("project_resources")
        .select("*")
        .eq("project_id", projectId)
        .is("milestone_id", null)
        .order("created_at", { ascending: false });

      if (!resError && resources) {
        setAvailableResources(resources);
      }
    } catch { /* project_resources table or milestone_id column may not exist */ }
  }

  function toggleExpand(id: string) {
    const next = !expanded[id];
    setExpanded((prev) => ({ ...prev, [id]: next }));
    if (next) {
      fetchMilestoneInteractions(id);
      if (!activeSection[id]) setActiveSection((prev) => ({ ...prev, [id]: "tasks" }));
    }
  }

  // ─── CRUD: Milestones ───
  async function addMilestone() {
    if (!newMsTitle.trim()) return;
    setSavingMs(true);
    try {
      const supabase = createClient();
      const insertPayload: Record<string, any> = {
        project_id: projectId,
        title: newMsTitle.trim(),
        due_date: newMsDueDate || null,
        status: "pending",
        sort_order: milestones.length,
      };
      if (newMsReward > 0) insertPayload.reward_percentage = newMsReward;

      const { data, error } = await supabase
        .from("project_milestones")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;

      setMilestones((prev) => [...prev, { ...data, tasks: [] }]);
      setNewMsTitle("");
      setNewMsDueDate("");
      setNewMsReward(0);
      setAddingMilestone(false);
      toast.success("마일스톤이 추가되었습니다");
      // Refresh server data so Overview, Roadmap see the new milestone
      router.refresh();
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

      const insertPayload: any = {
        milestone_id: milestoneId,
        project_id: projectId,
        title: newTaskTitle.trim(),
        status: "todo",
        sort_order: taskCount,
      };
      if (newTaskAssignee) insertPayload.assigned_to = newTaskAssignee;
      if (newTaskDueDate) insertPayload.due_date = newTaskDueDate;

      const { data, error } = await supabase
        .from("project_tasks")
        .insert(insertPayload)
        .select("*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url)")
        .single();

      if (error) throw error;

      setMilestones((prev) =>
        prev.map((ms) =>
          ms.id === milestoneId ? { ...ms, tasks: [...(ms.tasks || []), data] } : ms
        )
      );
      setNewTaskTitle("");
      setNewTaskAssignee("");
      setNewTaskDueDate("");
      setAddingTaskFor(null);
      toast.success("태스크가 추가되었습니다");
      onTaskChange?.();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "태스크 추가 실패");
    } finally {
      setSavingTask(false);
    }
  }

  // ─── Edit / Delete: Milestones ───
  function startEditMilestone(ms: ProjectMilestone) {
    setEditingMs(ms.id);
    setEditMsTitle(ms.title);
    setEditMsDueDate(ms.due_date || "");
    setEditMsReward((ms as any).reward_percentage || 0);
  }

  async function saveMilestoneEdit(msId: string) {
    if (!editMsTitle.trim()) return;
    const supabase = createClient();
    const updatePayload: Record<string, any> = {
      title: editMsTitle.trim(),
      due_date: editMsDueDate || null,
    };
    if (editMsReward > 0) updatePayload.reward_percentage = editMsReward;

    const { error } = await supabase.from("project_milestones").update(updatePayload).eq("id", msId);
    if (error) { toast.error("마일스톤 수정 실패: " + error.message); return; }

    setMilestones(prev => prev.map(m => m.id === msId ? { ...m, title: editMsTitle.trim(), due_date: editMsDueDate || null, reward_percentage: editMsReward } as any : m));
    setEditingMs(null);
    toast.success("마일스톤이 수정되었습니다");
    router.refresh();
  }

  async function deleteMilestone(msId: string) {
    if (!confirm("이 마일스톤과 관련된 모든 태스크가 삭제됩니다. 계속하시겠습니까?")) return;
    const supabase = createClient();

    // Delete tasks first (cascade should handle but be explicit)
    await supabase.from("project_tasks").delete().eq("milestone_id", msId);
    const { error } = await supabase.from("project_milestones").delete().eq("id", msId);
    if (error) { toast.error("마일스톤 삭제 실패: " + error.message); return; }

    setMilestones(prev => prev.filter(m => m.id !== msId));
    toast.success("마일스톤이 삭제되었습니다");
    onTaskChange?.();
    router.refresh();
  }

  // ─── Edit / Delete: Tasks ───
  async function saveTaskEdit(milestoneId: string, taskId: string) {
    if (!editTaskTitle.trim()) return;
    const supabase = createClient();
    const updatePayload: any = { title: editTaskTitle.trim() };
    updatePayload.due_date = editTaskDueDate || null;
    updatePayload.assigned_to = editTaskAssignee || null;

    const { data, error } = await supabase
      .from("project_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url)")
      .single();

    if (error) { toast.error("태스크 수정 실패"); return; }

    setMilestones(prev => prev.map(ms => ms.id === milestoneId
      ? { ...ms, tasks: (ms.tasks || []).map(t => t.id === taskId ? data : t) }
      : ms));
    setEditingTask(null);
    toast.success("태스크가 수정되었습니다");
  }

  async function deleteTask(milestoneId: string, taskId: string) {
    if (!confirm("이 태스크를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) { toast.error("태스크 삭제 실패"); return; }

    setMilestones(prev => prev.map(ms => ms.id === milestoneId
      ? { ...ms, tasks: (ms.tasks || []).filter(t => t.id !== taskId) }
      : ms));
    toast.success("태스크가 삭제되었습니다");
    onTaskChange?.();
    router.refresh();
  }

  async function toggleTaskStatus(milestoneId: string, task: ProjectTask) {
    if (!canEdit) return;
    const next = taskStatusIcons[task.status]?.next || "todo";
    const supabase = createClient();

    const { error } = await supabase.from("project_tasks").update({ status: next }).eq("id", task.id);
    if (error) { toast.error(error.message); return; }

    setMilestones((prev) =>
      prev.map((ms) =>
        ms.id === milestoneId
          ? { ...ms, tasks: (ms.tasks || []).map((t) => (t.id === task.id ? { ...t, status: next } : t)) }
          : ms
      )
    );

    // Auto-update milestone status based on tasks
    const milestone = milestones.find((m) => m.id === milestoneId);
    if (milestone) {
      const updatedTasks = (milestone.tasks || []).map((t) => (t.id === task.id ? { ...t, status: next } : t));
      const allDone = updatedTasks.length > 0 && updatedTasks.every((t) => t.status === "done");
      const anyInProgress = updatedTasks.some((t) => t.status === "in_progress" || t.status === "done");

      let newMsStatus: MilestoneStatus | null = null;
      if (allDone && milestone.status !== "completed") newMsStatus = "completed";
      else if (anyInProgress && milestone.status === "pending") newMsStatus = "in_progress";

      if (newMsStatus) {
        await supabase.from("project_milestones").update({ status: newMsStatus }).eq("id", milestoneId);
        setMilestones((prev) =>
          prev.map((ms) => (ms.id === milestoneId ? { ...ms, status: newMsStatus! } : ms))
        );
        if (newMsStatus === "completed") toast.success(`🎉 마일스톤 "${milestone.title}" 완료!`);
      }
    }
    onTaskChange?.();
    router.refresh();
  }

  // ─── Comments ───
  async function postComment(milestoneId: string, parentId?: string) {
    const text = parentId ? replyInput[parentId] : commentInput[milestoneId];
    if (!text?.trim() || !userId) return;

    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      target_type: "milestone",
      target_id: milestoneId,
      author_id: userId,
      content: text.trim(),
      parent_id: parentId || null,
    });

    if (error) {
      // Check if it's a CHECK constraint error (migration 019 not run)
      if (error.message?.includes("check_violation") || error.message?.includes("CHECK constraint")) {
        toast.error("댓글 기능을 사용하려면 DB 마이그레이션이 필요합니다");
      } else {
        toast.error("댓글 등록 실패");
      }
      return;
    }

    if (parentId) {
      setReplyInput((prev) => ({ ...prev, [parentId]: "" }));
      setReplyingTo(null);
    } else {
      setCommentInput((prev) => ({ ...prev, [milestoneId]: "" }));
    }
    fetchMilestoneInteractions(milestoneId);
  }

  // ─── Likes ───
  async function toggleLike(milestoneId: string) {
    if (!userId) return;
    const supabase = createClient();
    const current = msLikes[milestoneId];

    if (current?.liked) {
      const { error } = await supabase.from("reactions")
        .delete()
        .eq("target_type", "milestone").eq("target_id", milestoneId).eq("user_id", userId);
      if (!error) {
        setMsLikes((prev) => ({ ...prev, [milestoneId]: { count: (prev[milestoneId]?.count || 1) - 1, liked: false } }));
      }
    } else {
      const { error } = await supabase.from("reactions").insert({
        target_type: "milestone", target_id: milestoneId, user_id: userId, emoji: "❤️",
      });
      if (error) {
        if (error.message?.includes("check_violation") || error.message?.includes("CHECK constraint")) {
          toast.error("댓글 기능을 사용하려면 DB 마이그레이션이 필요합니다");
        } else {
          toast.error("좋아요 기능을 사용할 수 없습니다");
        }
        return;
      }
      setMsLikes((prev) => ({ ...prev, [milestoneId]: { count: (prev[milestoneId]?.count || 0) + 1, liked: true } }));
    }
  }

  // ─── Links ───
  // Link existing resource to milestone
  async function linkExistingResource(milestoneId: string, resourceId: string) {
    setSavingResourceLink(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_resources")
        .update({ milestone_id: milestoneId })
        .eq("id", resourceId);

      if (error) throw error;

      setShowResourceSelector(null);
      toast.success("자료가 마일스톤에 연결되었습니다");
      fetchMilestoneInteractions(milestoneId);
    } catch (err: any) {
      toast.error(err.message || "자료 연결 실패");
    } finally {
      setSavingResourceLink(false);
    }
  }

  // Add new external link
  async function addLink(milestoneId: string) {
    if (!linkUrl.trim() || !userId) return;
    const supabase = createClient();

    // Auto-detect type from URL
    let detectedType = "link";
    if (linkUrl.includes("docs.google.com/document")) detectedType = "google_doc";
    else if (linkUrl.includes("docs.google.com/spreadsheets")) detectedType = "google_sheet";
    else if (linkUrl.includes("notion.so")) detectedType = "notion";
    else if (linkUrl.includes("github.com")) detectedType = "link";

    const { error } = await supabase.from("project_resources").insert({
      project_id: projectId,
      milestone_id: milestoneId,
      name: linkTitle.trim() || linkUrl.trim(),
      url: linkUrl.trim(),
      type: detectedType,
      stage: "planning",
      uploaded_by: userId,
    });
    if (error) { toast.error("링크 추가 실패"); return; }
    setLinkTitle("");
    setLinkUrl("");
    setShowLinkForm(null);
    toast.success("자료 링크가 추가되었습니다");
    fetchMilestoneInteractions(milestoneId);
  }

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  }

  return (
    <div className="space-y-4">
      {milestones.map((ms) => {
        const isExpanded = expanded[ms.id] ?? false;
        const tasks = ms.tasks || [];
        const doneCount = tasks.filter((t) => t.status === "done").length;
        const statusStyle = msStatusColors[ms.status] || msStatusColors.pending;
        const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
        const section = activeSection[ms.id] || "tasks";
        const comments = msComments[ms.id] || [];
        const links = msLinks[ms.id] || [];
        const likes = msLikes[ms.id] || { count: 0, liked: false };

        return (
          <div key={ms.id} className="bg-nu-white border-2 border-nu-ink/[0.08] overflow-hidden">
            {/* ── Milestone Header ── */}
            {editingMs === ms.id ? (
              <div className="p-5 space-y-3">
                <input value={editMsTitle} onChange={e => setEditMsTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm font-bold focus:outline-none focus:border-nu-pink"
                  autoFocus onKeyDown={e => { if (e.key === "Enter") saveMilestoneEdit(ms.id); if (e.key === "Escape") setEditingMs(null); }} />
                <div className="flex gap-3">
                  <input type="date" value={editMsDueDate} onChange={e => setEditMsDueDate(e.target.value)}
                    className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
                  <input type="number" value={editMsReward} onChange={e => setEditMsReward(parseInt(e.target.value) || 0)} min={0} max={100}
                    placeholder="보상 %" className="w-24 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveMilestoneEdit(ms.id)}
                    className="font-mono-nu text-[12px] font-bold uppercase px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors">저장</button>
                  <button onClick={() => setEditingMs(null)}
                    className="font-mono-nu text-[12px] uppercase px-4 py-2 text-nu-muted hover:text-nu-ink transition-colors">취소</button>
                </div>
              </div>
            ) : (
            <button
              onClick={() => toggleExpand(ms.id)}
              className="w-full flex items-center gap-3 p-5 text-left hover:bg-nu-cream/20 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-nu-muted shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-nu-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-head text-base font-extrabold text-nu-ink">{ms.title}</h3>
                  <span className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                  {(ms as any).reward_percentage > 0 && (
                    <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20">
                      REWARD {(ms as any).reward_percentage}%
                    </span>
                  )}
                  {/* Edit/Delete buttons */}
                  {canEdit && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); startEditMilestone(ms); }}
                        className="p-1 text-nu-muted hover:text-indigo-600 transition-colors" title="수정">
                        <Edit3 size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteMilestone(ms.id); }}
                        className="p-1 text-nu-muted hover:text-red-500 transition-colors" title="삭제">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-nu-muted">
                  <span>{doneCount}/{tasks.length} tasks</span>
                  {ms.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(ms.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {/* Quick stats */}
                  <span className="flex items-center gap-1">
                    <Heart size={10} className={likes.liked ? "fill-nu-pink text-nu-pink" : ""} /> {likes.count}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={10} /> {comments.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Link2 size={10} /> {links.length}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {tasks.length > 0 && (
                <div className="w-24 shrink-0 text-right">
                  <span className="font-mono-nu text-[12px] font-bold text-nu-ink">{progressPct}%</span>
                  <div className="h-1.5 bg-nu-cream rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              {/* Settlement */}
              {canEdit && ms.status === "completed" && !(ms as any).is_settled && (ms as any).reward_percentage > 0 && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm("이 마일스톤의 보상을 정산하시겠습니까?")) return;
                    const supabase = createClient();
                    const { error } = await supabase.from("project_milestones")
                      .update({ is_settled: true, settled_at: new Date().toISOString() }).eq("id", ms.id);
                    if (error) toast.error("정산 실패: " + error.message);
                    else {
                      toast.success("마일스톤 정산이 확정되었습니다");
                      setMilestones((prev) => prev.map((m) => (m.id === ms.id ? { ...m, is_settled: true } as any : m)));
                      router.refresh();
                    }
                  }}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors shrink-0"
                >
                  SETTLE
                </button>
              )}
            </button>
            )}

            {/* ── Expanded Content ── */}
            {isExpanded && (
              <div className="border-t-2 border-nu-ink/[0.06]">
                {/* Sub-tabs: 태스크 / 자료 / 댓글 */}
                <div className="flex bg-nu-cream/30 border-b border-nu-ink/[0.06]">
                  {([
                    { key: "tasks" as const, label: `태스크 (${tasks.length})`, icon: CheckCircle2 },
                    { key: "links" as const, label: `자료 (${links.length})`, icon: Link2 },
                    { key: "comments" as const, label: `댓글 (${comments.length})`, icon: MessageSquare },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveSection((prev) => ({ ...prev, [ms.id]: tab.key }))}
                      className={`flex items-center gap-1.5 px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest border-b-2 transition-colors ${
                        section === tab.key
                          ? "border-nu-pink text-nu-pink font-bold"
                          : "border-transparent text-nu-muted hover:text-nu-ink"
                      }`}
                    >
                      <tab.icon size={11} /> {tab.label}
                    </button>
                  ))}

                  {/* Like button in tab bar */}
                  <button
                    onClick={() => toggleLike(ms.id)}
                    className={`ml-auto flex items-center gap-1 px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest transition-colors ${
                      likes.liked ? "text-nu-pink" : "text-nu-muted hover:text-nu-pink"
                    }`}
                  >
                    <Heart size={11} className={likes.liked ? "fill-current" : ""} /> {likes.count}
                  </button>
                </div>

                {/* ─── Tasks Section ─── */}
                {section === "tasks" && (
                  <div>
                    {tasks.length === 0 && (
                      <p className="px-5 py-4 text-nu-gray text-sm">아직 태스크가 없습니다</p>
                    )}
                    {tasks.map((task) => {
                      const statusInfo = taskStatusIcons[task.status] || taskStatusIcons.todo;
                      const Icon = statusInfo.icon;

                      if (editingTask === task.id) {
                        return (
                          <div key={task.id} className="flex flex-col gap-2 px-5 py-3 border-b border-nu-ink/[0.04]">
                            <div className="flex items-center gap-2">
                              <input value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)}
                                className="flex-1 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                                autoFocus onKeyDown={e => { if (e.key === "Enter") saveTaskEdit(ms.id, task.id); if (e.key === "Escape") setEditingTask(null); }} />
                            </div>
                            <div className="flex items-center gap-2">
                              {projectMembers.length > 0 && (
                                <select 
                                  value={editTaskAssignee} 
                                  onChange={e => setEditTaskAssignee(e.target.value)}
                                  className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink flex-1"
                                >
                                  <option value="">담당자 없음</option>
                                  {projectMembers.map(member => (
                                    <option key={member.id} value={member.id}>{member.nickname}</option>
                                  ))}
                                </select>
                              )}
                              <input 
                                type="date" 
                                value={editTaskDueDate} 
                                onChange={e => setEditTaskDueDate(e.target.value)}
                                className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink flex-1"
                              />
                              <button onClick={() => saveTaskEdit(ms.id, task.id)}
                                className="font-mono-nu text-[12px] font-bold uppercase px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors">저장</button>
                              <button onClick={() => setEditingTask(null)}
                                className="text-nu-muted hover:text-nu-ink text-sm px-2">취소</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={task.id} className="flex items-center gap-3 px-5 py-3 border-b border-nu-ink/[0.04] last:border-0 hover:bg-nu-cream/10 group/task">
                          <button
                            onClick={() => toggleTaskStatus(ms.id, task)}
                            disabled={!canEdit}
                            className={`shrink-0 ${statusInfo.color} ${canEdit ? "cursor-pointer hover:opacity-70" : "cursor-default"}`}
                          >
                            <Icon size={18} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${task.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
                              {task.title}
                            </p>
                          </div>
                          {task.assignee && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold">
                                {(task.assignee.nickname || "U").charAt(0).toUpperCase()}
                              </div>
                              <span className="font-mono-nu text-[11px] text-nu-muted">{task.assignee.nickname}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <span className="font-mono-nu text-[11px] text-nu-muted shrink-0 flex items-center gap-1">
                              <Calendar size={9} />
                              {new Date(task.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          {canEdit && (
                            <div className="hidden group-hover/task:flex items-center gap-0.5 shrink-0">
                              <button onClick={() => { 
                                setEditingTask(task.id); 
                                setEditTaskTitle(task.title); 
                                setEditTaskDueDate(task.due_date || "");
                                setEditTaskAssignee(task.assigned_to || "");
                              }}
                                className="p-1 text-nu-muted hover:text-indigo-600 transition-colors" title="수정">
                                <Edit3 size={11} />
                              </button>
                              <button onClick={() => deleteTask(ms.id, task.id)}
                                className="p-1 text-nu-muted hover:text-red-500 transition-colors" title="삭제">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add task */}
                    {canEdit && (
                      <div className="px-5 py-3 border-t border-nu-ink/[0.06]">
                        {addingTaskFor === ms.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="태스크 제목"
                                className="flex-1 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); addTask(ms.id); }
                                  if (e.key === "Escape") { setAddingTaskFor(null); setNewTaskTitle(""); setNewTaskDueDate(""); setNewTaskAssignee(""); }
                                }}
                                autoFocus
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              {projectMembers.length > 0 && (
                                <select
                                  value={newTaskAssignee}
                                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                                  className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink flex-1"
                                >
                                  <option value="">담당자 지정 (선택)</option>
                                  {projectMembers.map(member => (
                                    <option key={member.id} value={member.id}>{member.nickname}</option>
                                  ))}
                                </select>
                              )}
                              <input
                                type="date"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink flex-1"
                              />
                              <button onClick={() => addTask(ms.id)} disabled={savingTask}
                                className="font-mono-nu text-[12px] font-bold uppercase px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50">
                                {savingTask ? <Loader2 size={12} className="animate-spin" /> : "추가"}
                              </button>
                              <button onClick={() => { setAddingTaskFor(null); setNewTaskTitle(""); setNewTaskDueDate(""); setNewTaskAssignee(""); }}
                                className="text-nu-muted hover:text-nu-ink text-sm px-2">취소</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingTaskFor(ms.id); setNewTaskTitle(""); }}
                            className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-1">
                            <Plus size={12} /> 태스크 추가
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Links Section ─── */}
                {section === "links" && (
                  <div>
                    {links.length === 0 && !showLinkForm && (
                      <p className="px-5 py-4 text-nu-gray text-sm">아직 등록된 자료가 없습니다</p>
                    )}
                    {links.map((link: any) => (
                      <div key={link.id} className="flex items-center gap-3 px-5 py-3 border-b border-nu-ink/[0.04] last:border-0 hover:bg-nu-cream/10">
                        <Link2 size={14} className="text-nu-blue shrink-0" />
                        <div className="flex-1 min-w-0">
                          <a href={link.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-bold text-nu-ink hover:text-nu-pink transition-colors no-underline truncate block">
                            {link.name || link.url}
                          </a>
                          <span className="font-mono-nu text-[10px] text-nu-muted">{timeAgo(link.created_at)}</span>
                        </div>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 p-1.5 text-nu-muted hover:text-nu-blue transition-colors">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}

                    {/* Add link form & resource selector */}
                    {canEdit && (
                      <div className="px-5 py-3 border-t border-nu-ink/[0.06]">
                        {showLinkForm === ms.id ? (
                          <div className="space-y-2">
                            {/* Tab: Link existing or add new */}
                            <div className="flex gap-2 text-xs mb-3 border-b border-nu-ink/[0.12]">
                              <button
                                onClick={() => setShowResourceSelector(showResourceSelector === ms.id ? null : ms.id)}
                                className={`pb-2 px-2 font-mono-nu uppercase tracking-widest ${
                                  showResourceSelector === ms.id
                                    ? "text-nu-pink border-b-2 border-nu-pink font-bold"
                                    : "text-nu-muted hover:text-nu-ink"
                                }`}
                              >
                                기존 자료 연결
                              </button>
                              <button
                                onClick={() => setShowResourceSelector(null)}
                                className={`pb-2 px-2 font-mono-nu uppercase tracking-widest ${
                                  showResourceSelector !== ms.id
                                    ? "text-nu-pink border-b-2 border-nu-pink font-bold"
                                    : "text-nu-muted hover:text-nu-ink"
                                }`}
                              >
                                새 링크 추가
                              </button>
                            </div>

                            {/* Resource selector for linking existing */}
                            {showResourceSelector === ms.id ? (
                              <div className="space-y-2">
                                {availableResources.length === 0 ? (
                                  <p className="text-xs text-nu-gray italic">연결 가능한 자료가 없습니다</p>
                                ) : (
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {availableResources.map((res: any) => (
                                      <button
                                        key={res.id}
                                        onClick={() => linkExistingResource(ms.id, res.id)}
                                        disabled={savingResourceLink}
                                        className="w-full flex items-start gap-2 p-2 text-left bg-nu-paper hover:bg-nu-cream border border-nu-ink/[0.08] hover:border-nu-pink transition-colors disabled:opacity-50"
                                      >
                                        <span className="text-xs font-bold text-nu-ink flex-1 min-w-0 truncate">{res.name}</span>
                                        {savingResourceLink ? <Loader2 size={12} className="animate-spin shrink-0" /> : <Plus size={12} className="text-nu-pink shrink-0" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  onClick={() => setShowResourceSelector(null)}
                                  className="text-nu-muted hover:text-nu-ink text-sm px-2 py-1"
                                >
                                  닫기
                                </button>
                              </div>
                            ) : (
                              <>
                                <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
                                  placeholder="자료 제목 (선택)" className="w-full px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
                                <div className="flex gap-2">
                                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="URL (https://...)" className="flex-1 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(ms.id); } }} autoFocus />
                                  <button onClick={() => addLink(ms.id)}
                                    className="font-mono-nu text-[12px] font-bold uppercase px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors">추가</button>
                                  <button onClick={() => { setShowLinkForm(null); setLinkTitle(""); setLinkUrl(""); }}
                                    className="text-nu-muted hover:text-nu-ink text-sm px-2">취소</button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => setShowLinkForm(ms.id)}
                            className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-1">
                            <Plus size={12} /> 자료 링크 추가
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Comments Section ─── */}
                {section === "comments" && (
                  <div>
                    {comments.length === 0 && (
                      <p className="px-5 py-4 text-nu-gray text-sm">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="px-5 py-3 border-b border-nu-ink/[0.04] last:border-0">
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[11px] font-bold shrink-0 mt-0.5">
                            {(c.author?.nickname || "?").charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-nu-ink">{c.author?.nickname || "멤버"}</span>
                              <span className="font-mono-nu text-[10px] text-nu-muted">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-nu-ink mt-0.5 leading-relaxed">{c.content}</p>
                            <button
                              onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                              className="font-mono-nu text-[11px] text-nu-muted hover:text-nu-pink mt-1 transition-colors"
                            >
                              답글
                            </button>

                            {/* Replies */}
                            {c.replies && c.replies.length > 0 && (
                              <div className="mt-2 ml-3 border-l-2 border-nu-ink/[0.06] pl-3 space-y-2">
                                {c.replies.map((r) => (
                                  <div key={r.id} className="flex items-start gap-2">
                                    <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold shrink-0">
                                      {(r.author?.nickname || "?").charAt(0)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] font-bold text-nu-ink">{r.author?.nickname}</span>
                                        <span className="font-mono-nu text-[9px] text-nu-muted">{timeAgo(r.created_at)}</span>
                                      </div>
                                      <p className="text-[12px] text-nu-ink mt-0.5">{r.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply input */}
                            {replyingTo === c.id && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  value={replyInput[c.id] || ""}
                                  onChange={(e) => setReplyInput((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                  placeholder="답글 작성..."
                                  className="flex-1 px-3 py-1.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); postComment(ms.id, c.id); } }}
                                  autoFocus
                                />
                                <button onClick={() => postComment(ms.id, c.id)}
                                  className="p-1.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors">
                                  <Send size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* New comment input */}
                    {userId && (
                      <div className="px-5 py-3 border-t border-nu-ink/[0.06]">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentInput[ms.id] || ""}
                            onChange={(e) => setCommentInput((prev) => ({ ...prev, [ms.id]: e.target.value }))}
                            placeholder="댓글을 작성하세요..."
                            className="flex-1 px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); postComment(ms.id); } }}
                          />
                          <button onClick={() => postComment(ms.id)}
                            className="px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors">
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add milestone form ── */}
      {canEdit && (
        <div className="mt-4">
          {addingMilestone ? (
            <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-5 space-y-3">
              <input type="text" value={newMsTitle} onChange={(e) => setNewMsTitle(e.target.value)}
                placeholder="마일스톤 제목"
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addMilestone(); }
                  if (e.key === "Escape") { setAddingMilestone(false); setNewMsTitle(""); setNewMsDueDate(""); }
                }}
                autoFocus
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-1 block">목표 날짜</label>
                  <input type="date" value={newMsDueDate} onChange={(e) => setNewMsDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
                </div>
                <div className="w-32">
                  <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-1 block">보상 비율 (%)</label>
                  <input type="number" min="0" max="100" value={newMsReward}
                    onChange={(e) => setNewMsReward(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addMilestone} disabled={savingMs}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1">
                  {savingMs ? <Loader2 size={12} className="animate-spin" /> : "마일스톤 추가"}
                </button>
                <button onClick={() => { setAddingMilestone(false); setNewMsTitle(""); setNewMsDueDate(""); }}
                  className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink px-3">취소</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingMilestone(true)}
              className="w-full font-mono-nu text-[13px] uppercase tracking-widest py-4 border-2 border-dashed border-nu-ink/20 text-nu-muted hover:text-nu-ink hover:border-nu-ink/40 transition-colors flex items-center justify-center gap-2">
              <Plus size={14} /> 마일스톤 추가
            </button>
          )}
        </div>
      )}

      {milestones.length === 0 && !canEdit && (
        <div className="text-center py-12 bg-nu-white border-2 border-nu-ink/[0.08]">
          <p className="text-nu-gray text-sm">아직 마일스톤이 없습니다</p>
        </div>
      )}
    </div>
  );
}
