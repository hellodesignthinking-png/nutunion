"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { toast } from "sonner";
import {
  FolderOpen, FileText, CheckSquare, Users, Plus, ExternalLink,
  ArrowLeft, Upload, Trash2, Clock, MessageSquare, Settings,
  UserPlus, UserMinus, Edit3, X, Send, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StaffProject, StaffFile, StaffTask, StaffProjectMember, StaffComment } from "@/lib/types";

type Tab = "files" | "tasks" | "members" | "activity" | "settings";

// --- Activity logging helper ---
function logActivity(projectId: string, userId: string, action: string, targetType: string, targetId: string, metadata: Record<string, any> = {}) {
  const supabase = createClient();
  supabase.from("staff_activity").insert({
    project_id: projectId,
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  }).then(({ error }) => {
    if (error) console.error("Activity log failed:", error.message);
  });
}

export default function StaffProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<StaffProject | null>(null);
  const [files, setFiles] = useState<StaffFile[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [members, setMembers] = useState<StaffProjectMember[]>([]);
  const [comments, setComments] = useState<StaffComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("files");
  const [userId, setUserId] = useState<string>("");

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: "", description: "", priority: "medium", due_date: "", assigned_to: "" });

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // File modal state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkingFile, setLinkingFile] = useState(false);
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);

  // Member state
  const [allStaff, setAllStaff] = useState<{ id: string; nickname: string | null; avatar_url: string | null }[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  // Settings state
  const [editingProject, setEditingProject] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", status: "" });

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [
      { data: proj },
      { data: fileData },
      { data: taskData },
      { data: memberData },
      { data: commentData },
    ] = await Promise.all([
      supabase.from("staff_projects").select("*").eq("id", id).single(),
      supabase.from("staff_files").select("*, creator:profiles!staff_files_created_by_fkey(nickname, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("staff_tasks").select("*, assignee:profiles!staff_tasks_assigned_to_fkey(id, nickname, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("staff_project_members").select("*, profile:profiles!staff_project_members_user_id_fkey(id, nickname, avatar_url)").eq("project_id", id),
      supabase.from("staff_comments").select("*, author:profiles!staff_comments_author_id_fkey(nickname, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    ]);

    if (proj) setProject(proj as any);
    setFiles((fileData || []) as any);
    setTasks((taskData || []) as any);
    setMembers((memberData || []) as any);
    setComments((commentData || []) as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Task handlers ────────────────────────────────

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("staff_tasks").insert({
      project_id: id,
      title: newTaskTitle.trim(),
      created_by: userId,
      assigned_to: userId,
    }).select("id").single();
    if (error) toast.error("할일 추가 실패");
    else {
      toast.success("할일이 추가되었습니다");
      setNewTaskTitle("");
      if (data) logActivity(id, userId, "task_created", "task", data.id, { title: newTaskTitle.trim() });
      await loadData();
    }
    setAddingTask(false);
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const next = currentStatus === "done" ? "todo" : currentStatus === "todo" ? "in_progress" : "done";
    const supabase = createClient();
    const { error } = await supabase.from("staff_tasks").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) { toast.error("상태 변경 실패"); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next as any } : t));
    if (next === "done") logActivity(id, userId, "task_completed", "task", taskId);
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm("이 할일을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("staff_tasks").delete().eq("id", taskId);
    if (error) { toast.error("삭제 실패"); return; }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast.success("삭제되었습니다");
  }

  function startEditTask(task: StaffTask) {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date || "",
      assigned_to: task.assigned_to || "",
    });
  }

  async function handleSaveTask() {
    if (!editingTaskId) return;
    const supabase = createClient();
    const { error } = await supabase.from("staff_tasks").update({
      title: editTaskForm.title.trim(),
      description: editTaskForm.description.trim() || null,
      priority: editTaskForm.priority,
      due_date: editTaskForm.due_date || null,
      assigned_to: editTaskForm.assigned_to || null,
    }).eq("id", editingTaskId);
    if (error) { toast.error("수정 실패"); return; }
    toast.success("할일이 수정되었습니다");
    setEditingTaskId(null);
    await loadData();
  }

  // ─── File handlers ────────────────────────────────

  async function handleLinkDriveFile(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const match = linkUrl.match(/(?:\/d\/|\/folders\/|id=)([a-zA-Z0-9_-]+)/);
    if (!match) { toast.error("올바른 Google Drive URL이 아닙니다"); return; }
    const driveFileId = match[1];
    setLinkingFile(true);

    try {
      const res = await fetch(`/api/google/drive?fileId=${driveFileId}`);
      if (!res.ok) { toast.error("파일 정보를 가져올 수 없습니다. Google 계정 연결을 확인해주세요."); setLinkingFile(false); return; }
      const { file: fileInfo } = await res.json();

      const supabase = createClient();
      const { data, error } = await supabase.from("staff_files").insert({
        project_id: id,
        drive_file_id: driveFileId,
        title: fileInfo?.name || "제목 없음",
        mime_type: fileInfo?.mimeType || null,
        drive_url: fileInfo?.webViewLink || linkUrl,
        file_size: fileInfo?.size ? parseInt(fileInfo.size) : null,
        thumbnail_url: fileInfo?.thumbnailLink || null,
        created_by: userId,
      }).select("id").single();
      if (error) toast.error("파일 연결 실패");
      else {
        toast.success("파일이 연결되었습니다");
        setLinkUrl(""); setShowLinkForm(false);
        if (data) logActivity(id, userId, "file_added", "file", data.id, { title: fileInfo?.name });
        await loadData();
      }
    } catch {
      toast.error("파일 연결 중 오류가 발생했습니다");
    }
    setLinkingFile(false);
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    setCreatingDoc(true);
    try {
      const res = await fetch("/api/google/docs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[Staff] ${newDocTitle.trim()}`,
          folderId: project?.drive_folder_id || undefined,
        }),
      });
      if (!res.ok) { toast.error("문서 생성 실패. Google 계정 연결을 확인해주세요."); setCreatingDoc(false); return; }
      const doc = await res.json();

      const supabase = createClient();
      const { data } = await supabase.from("staff_files").insert({
        project_id: id,
        drive_file_id: doc.documentId,
        title: newDocTitle.trim(),
        mime_type: "application/vnd.google-apps.document",
        drive_url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        created_by: userId,
      }).select("id").single();
      toast.success("새 문서가 생성되었습니다");
      setNewDocTitle(""); setShowNewDocForm(false);
      if (data) logActivity(id, userId, "file_added", "file", data.id, { title: newDocTitle.trim() });
      await loadData();
    } catch {
      toast.error("문서 생성 중 오류가 발생했습니다");
    }
    setCreatingDoc(false);
  }

  // ─── Comment handlers ─────────────────────────────

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("staff_comments").insert({
      project_id: id,
      target_type: "project",
      target_id: id,
      author_id: userId,
      content: newComment.trim(),
    }).select("id").single();
    if (error) toast.error("댓글 작성 실패");
    else {
      setNewComment("");
      if (data) logActivity(id, userId, "comment_added", "comment", data.id);
      await loadData();
    }
    setSubmittingComment(false);
  }

  // ─── Member handlers ─────────────────────────────

  async function loadAllStaff() {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("id, nickname, avatar_url").in("role", ["staff", "admin"]);
    setAllStaff(data || []);
    setShowAddMember(true);
  }

  async function handleAddMember(staffUserId: string) {
    const already = members.some(m => m.user_id === staffUserId);
    if (already) { toast.error("이미 프로젝트 멤버입니다"); return; }
    const supabase = createClient();
    const { error } = await supabase.from("staff_project_members").insert({
      project_id: id,
      user_id: staffUserId,
      role: "member",
    });
    if (error) toast.error("멤버 추가 실패");
    else {
      toast.success("멤버가 추가되었습니다");
      logActivity(id, userId, "member_joined", "project", id);
      setShowAddMember(false);
      await loadData();
    }
  }

  async function handleRemoveMember(memberId: string, memberUserId: string | null) {
    if (memberUserId === userId) { toast.error("자기 자신은 제거할 수 없습니다"); return; }
    if (!confirm("이 멤버를 프로젝트에서 제거하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("staff_project_members").delete().eq("id", memberId);
    if (error) toast.error("멤버 제거 실패");
    else { toast.success("멤버가 제거되었습니다"); await loadData(); }
  }

  async function handleToggleRole(memberId: string, currentRole: string) {
    const newRole = currentRole === "lead" ? "member" : "lead";
    const supabase = createClient();
    const { error } = await supabase.from("staff_project_members").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error("역할 변경 실패");
    else { toast.success(`역할이 ${newRole === "lead" ? "리드" : "멤버"}로 변경되었습니다`); await loadData(); }
  }

  // ─── Project settings handlers ────────────────────

  function startEditProject() {
    if (!project) return;
    setEditForm({
      title: project.title,
      description: project.description || "",
      category: project.category || "general",
      status: project.status,
    });
    setEditingProject(true);
  }

  async function handleSaveProject() {
    const supabase = createClient();
    const { error } = await supabase.from("staff_projects").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      category: editForm.category,
      status: editForm.status,
    }).eq("id", id);
    if (error) { toast.error("프로젝트 수정 실패"); return; }
    toast.success("프로젝트가 수정되었습니다");
    setEditingProject(false);
    await loadData();
  }

  async function handleDeleteProject() {
    if (!confirm("이 프로젝트를 삭제하시겠습니까? 모든 파일, 할일, 멤버 데이터가 삭제됩니다.")) return;
    if (!confirm("정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("staff_projects").delete().eq("id", id);
    if (error) { toast.error("프로젝트 삭제 실패"); return; }
    toast.success("프로젝트가 삭제되었습니다");
    router.push("/staff/workspace");
  }

  // ─── UI helpers ───────────────────────────────────

  const mimeIcon = (mime: string | null) => {
    if (!mime) return "📄";
    if (mime.includes("document")) return "📝";
    if (mime.includes("spreadsheet")) return "📊";
    if (mime.includes("presentation")) return "📽️";
    if (mime.includes("pdf")) return "📕";
    if (mime.includes("image")) return "🖼️";
    return "📄";
  };

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-green-100 text-green-700 border-green-200",
  };

  const statusIcon: Record<string, string> = { todo: "○", in_progress: "◐", done: "●" };

  // Due date helpers
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  function getDueDateStatus(dueDate: string | null, status: string): string | null {
    if (!dueDate || status === "done") return null;
    const d = new Date(dueDate); d.setHours(0, 0, 0, 0);
    const diff = (d.getTime() - todayDate.getTime()) / 86400000;
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff <= 3) return "soon";
    return "normal";
  }
  const dueDateCls: Record<string, string> = { overdue: "text-red-600 font-bold", today: "text-orange-600 font-bold", soon: "text-yellow-700", normal: "text-nu-muted" };

  const isLead = members.some(m => m.user_id === userId && m.role === "lead");

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-nu-ink/5 w-32" />
          <div className="h-8 bg-nu-ink/8 w-64" />
          <div className="h-64 bg-nu-ink/5" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-20 text-center">
        <p className="text-nu-muted">프로젝트를 찾을 수 없습니다</p>
        <Link href="/staff/workspace" className="text-indigo-600 no-underline mt-4 inline-block">프로젝트 목록으로</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "files", label: "파일", icon: FileText, count: files.length },
    { key: "tasks", label: "할일", icon: CheckSquare, count: tasks.filter(t => t.status !== "done").length },
    { key: "members", label: "멤버", icon: Users, count: members.length },
    { key: "activity", label: "토론", icon: MessageSquare, count: comments.length },
    ...(isLead ? [{ key: "settings" as Tab, label: "설정", icon: Settings, count: 0 }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      {/* Breadcrumb */}
      <Link href="/staff/workspace" className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest no-underline hover:text-nu-ink flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> 프로젝트 목록
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600">
              {project.category || "general"}
            </span>
            <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${
              project.status === "active" ? "bg-green-100 text-green-700" :
              project.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
            }`}>
              {project.status === "active" ? "진행중" : project.status === "completed" ? "완료" : "보관"}
            </span>
          </div>
          <h1 className="font-head text-2xl font-extrabold text-nu-ink">{project.title}</h1>
          {project.description && <p className="text-sm text-nu-muted mt-1">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {project.drive_folder_url && (
            <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer"
              className="font-mono-nu text-[10px] uppercase tracking-widest text-indigo-600 no-underline hover:underline flex items-center gap-1">
              <FolderOpen size={14} /> Drive <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-nu-ink/[0.08] mb-8 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 font-mono-nu text-[11px] uppercase tracking-widest border-b-2 transition-all bg-transparent cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-nu-muted hover:text-nu-ink"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && <span className="text-[9px] ml-1 opacity-60">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ FILES TAB ═══ */}
      {activeTab === "files" && (
        <div>
          <div className="flex gap-2 mb-4">
            <Button onClick={() => { setShowNewDocForm(!showNewDocForm); setShowLinkForm(false); }} variant="outline" className="font-mono-nu text-[10px] uppercase tracking-widest gap-1.5">
              {showNewDocForm ? <X size={12} /> : <Plus size={12} />} 새 문서
            </Button>
            <Button onClick={() => { setShowLinkForm(!showLinkForm); setShowNewDocForm(false); }} variant="outline" className="font-mono-nu text-[10px] uppercase tracking-widest gap-1.5">
              {showLinkForm ? <X size={12} /> : <Upload size={12} />} 파일 연결
            </Button>
          </div>

          {/* New doc form */}
          {showNewDocForm && (
            <form onSubmit={handleCreateDoc} className="bg-white border border-indigo-200 p-4 mb-4 flex gap-2">
              <Input value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} placeholder="새 문서 제목..." className="flex-1 border-nu-ink/15 bg-transparent" />
              <Button type="submit" disabled={creatingDoc || !newDocTitle.trim()} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
                {creatingDoc ? "생성 중..." : "생성"}
              </Button>
            </form>
          )}

          {/* Link file form */}
          {showLinkForm && (
            <form onSubmit={handleLinkDriveFile} className="bg-white border border-indigo-200 p-4 mb-4 flex gap-2">
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="Google Drive URL을 붙여넣으세요..." className="flex-1 border-nu-ink/15 bg-transparent" />
              <Button type="submit" disabled={linkingFile || !linkUrl.trim()} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
                {linkingFile ? "연결 중..." : "연결"}
              </Button>
            </form>
          )}
          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors group">
                  {(f as any).thumbnail_url ? (
                    <img src={(f as any).thumbnail_url} alt="" className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <span className="text-lg w-8 text-center">{mimeIcon(f.mime_type)}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={f.drive_url || "#"} target="_blank" rel="noopener noreferrer" className="font-head text-sm font-bold text-nu-ink no-underline hover:text-indigo-600 truncate block">
                      {f.title}
                    </a>
                    <p className="font-mono-nu text-[8px] text-nu-muted">
                      {(f.creator as any)?.nickname || "Unknown"} · {new Date(f.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      {f.ai_summary && ` · ${f.ai_summary.slice(0, 40)}...`}
                    </p>
                  </div>
                  {f.ai_tags && f.ai_tags.length > 0 && (
                    <div className="hidden sm:flex gap-1">
                      {f.ai_tags.slice(0, 3).map(tag => (
                        <span key={tag} className="font-mono-nu text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-nu-ink/10 p-12 text-center bg-white/50">
              <FileText size={32} className="mx-auto mb-3 text-nu-ink/15" />
              <p className="text-sm text-nu-muted mb-3">아직 연결된 파일이 없습니다</p>
              <p className="text-xs text-nu-muted">Google Drive 파일을 연결하거나 새 문서를 생성하세요</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TASKS TAB ═══ */}
      {activeTab === "tasks" && (
        <div>
          <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
            <Input
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="새 할일 입력..."
              className="flex-1 border-nu-ink/15 bg-transparent"
            />
            <Button type="submit" disabled={addingTask} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">
              {addingTask ? "..." : "추가"}
            </Button>
          </form>
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(t => {
                const dueStatus = getDueDateStatus(t.due_date, t.status);
                return (
                <div key={t.id}>
                  <div className={`flex items-center gap-3 px-4 py-3 bg-white border transition-colors ${
                    dueStatus === "overdue" ? "border-red-200 bg-red-50/30" :
                    dueStatus === "today" ? "border-orange-200 bg-orange-50/20" :
                    "border-nu-ink/[0.06] hover:border-indigo-200"
                  }`}>
                    <button
                      onClick={() => handleToggleTask(t.id, t.status)}
                      className="text-lg bg-transparent border-none cursor-pointer p-0"
                      aria-label="상태 변경"
                    >
                      {statusIcon[t.status] || "○"}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-head text-sm font-bold truncate ${t.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.assignee && (
                          <span className="font-mono-nu text-[8px] text-nu-muted">{(t.assignee as any).nickname}</span>
                        )}
                        {t.source_type && t.source_type !== "manual" && (
                          <span className="font-mono-nu text-[7px] uppercase px-1 py-px bg-indigo-50 text-indigo-500">
                            {t.source_type === "meeting" ? "미팅" : t.source_type === "ai" ? "AI" : t.source_type === "comment" ? "코멘트" : t.source_type}
                          </span>
                        )}
                        {t.description && (
                          <span className="font-mono-nu text-[8px] text-nu-muted/50">| {t.description.slice(0, 30)}{t.description.length > 30 ? "..." : ""}</span>
                        )}
                      </div>
                    </div>
                    <span className={`font-mono-nu text-[9px] uppercase px-2 py-0.5 ${priorityColor[t.priority] || ""}`}>
                      {t.priority}
                    </span>
                    {t.due_date && (
                      <span className={`font-mono-nu text-[9px] flex items-center gap-1 ${dueStatus ? dueDateCls[dueStatus] : "text-nu-muted"}`}>
                        <Clock size={10} />
                        {dueStatus === "overdue" && "지연 "}
                        {new Date(t.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <button
                      onClick={() => editingTaskId === t.id ? setEditingTaskId(null) : startEditTask(t)}
                      className="text-nu-muted hover:text-indigo-600 transition-colors bg-transparent border-none cursor-pointer p-1"
                      aria-label="할일 편집"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="text-nu-muted hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer p-1"
                      aria-label="할일 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {/* Inline edit form */}
                  {editingTaskId === t.id && (
                    <div className="border border-indigo-200 border-t-0 bg-indigo-50/30 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">제목</label>
                          <Input value={editTaskForm.title} onChange={e => setEditTaskForm(f => ({ ...f, title: e.target.value }))} className="border-nu-ink/15 bg-white text-sm" />
                        </div>
                        <div>
                          <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">우선순위</label>
                          <select value={editTaskForm.priority} onChange={e => setEditTaskForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 border border-nu-ink/15 bg-white text-sm">
                            <option value="low">낮음</option>
                            <option value="medium">보통</option>
                            <option value="high">높음</option>
                            <option value="urgent">긴급</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">마감일</label>
                          <Input type="date" value={editTaskForm.due_date} onChange={e => setEditTaskForm(f => ({ ...f, due_date: e.target.value }))} className="border-nu-ink/15 bg-white text-sm" />
                        </div>
                        <div>
                          <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">담당자</label>
                          <select value={editTaskForm.assigned_to} onChange={e => setEditTaskForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full px-3 py-2 border border-nu-ink/15 bg-white text-sm">
                            <option value="">미지정</option>
                            {members.map(m => (
                              <option key={m.user_id} value={m.user_id || ""}>{(m.profile as any)?.nickname || "Unknown"}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">설명</label>
                        <Textarea value={editTaskForm.description} onChange={e => setEditTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} className="border-nu-ink/15 bg-white text-sm resize-none" placeholder="상세 설명 (선택)" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveTask} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest px-4 py-1.5">저장</Button>
                        <Button variant="outline" onClick={() => setEditingTaskId(null)} className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-1.5">취소</Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-nu-ink/10 p-12 text-center bg-white/50">
              <CheckSquare size={32} className="mx-auto mb-3 text-nu-ink/15" />
              <p className="text-sm text-nu-muted">아직 할일이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ MEMBERS TAB ═══ */}
      {activeTab === "members" && (
        <div>
          {isLead && (
            <div className="mb-6">
              {showAddMember ? (
                <div className="bg-white border border-indigo-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-indigo-600">스태프 멤버 추가</h3>
                    <button onClick={() => setShowAddMember(false)} className="p-1 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer" aria-label="닫기"><X size={14} /></button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {allStaff
                      .filter(s => !members.some(m => m.user_id === s.id))
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleAddMember(s.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors bg-transparent border-none cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center font-head text-[10px] font-bold text-indigo-600">
                            {(s.nickname || "U").charAt(0)}
                          </div>
                          <span className="font-head text-sm text-nu-ink">{s.nickname || "Unknown"}</span>
                        </button>
                      ))}
                    {allStaff.filter(s => !members.some(m => m.user_id === s.id)).length === 0 && (
                      <p className="text-xs text-nu-muted p-2">추가할 수 있는 스태프가 없습니다</p>
                    )}
                  </div>
                </div>
              ) : (
                <Button onClick={loadAllStaff} variant="outline" className="font-mono-nu text-[10px] uppercase tracking-widest gap-1.5">
                  <UserPlus size={12} /> 멤버 추가
                </Button>
              )}
            </div>
          )}
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06]">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-head text-xs font-bold text-indigo-600">
                  {((m.profile as any)?.nickname || "U").charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-head text-sm font-bold text-nu-ink">{(m.profile as any)?.nickname || "Unknown"}</p>
                </div>
                {isLead && (
                  <button
                    onClick={() => handleToggleRole(m.id, m.role)}
                    className="font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 cursor-pointer bg-transparent border border-nu-ink/15 hover:border-indigo-300 transition-colors"
                    title="역할 변경"
                  >
                    {m.role === "lead" ? "리드" : "멤버"} <ChevronDown size={8} className="inline" />
                  </button>
                )}
                {!isLead && (
                  <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${m.role === "lead" ? "bg-indigo-100 text-indigo-700" : "bg-nu-ink/5 text-nu-muted"}`}>
                    {m.role === "lead" ? "리드" : "멤버"}
                  </span>
                )}
                {isLead && m.user_id !== userId && (
                  <button
                    onClick={() => handleRemoveMember(m.id, m.user_id)}
                    className="text-nu-muted hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer p-1"
                    aria-label="멤버 제거"
                  >
                    <UserMinus size={13} />
                  </button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="border-2 border-dashed border-nu-ink/10 p-12 text-center bg-white/50">
                <Users size={32} className="mx-auto mb-3 text-nu-ink/15" />
                <p className="text-sm text-nu-muted">아직 멤버가 없습니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ACTIVITY / DISCUSSION TAB ═══ */}
      {activeTab === "activity" && (
        <div>
          {/* Comment input */}
          <form onSubmit={handleAddComment} className="mb-6">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="팀에게 메시지를 남겨주세요..."
                rows={2}
                className="flex-1 border-nu-ink/15 bg-white resize-none"
              />
              <Button type="submit" disabled={submittingComment || !newComment.trim()} className="bg-indigo-600 text-white hover:bg-indigo-700 self-end px-3">
                <Send size={14} />
              </Button>
            </div>
          </form>

          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="px-4 py-3 bg-white border border-nu-ink/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center font-head text-[10px] font-bold text-indigo-600">
                      {((c.author as any)?.nickname || "U").charAt(0)}
                    </div>
                    <span className="font-head text-xs font-bold text-nu-ink">{(c.author as any)?.nickname || "Unknown"}</span>
                    <span className="font-mono-nu text-[8px] text-nu-muted">
                      {new Date(c.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-nu-ink whitespace-pre-wrap pl-8">{c.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-nu-ink/10 p-12 text-center bg-white/50">
              <MessageSquare size={32} className="mx-auto mb-3 text-nu-ink/15" />
              <p className="text-sm text-nu-muted">아직 토론이 없습니다</p>
              <p className="text-xs text-nu-muted mt-1">팀원들과 의견을 나눠보세요</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {activeTab === "settings" && isLead && (
        <div className="max-w-xl space-y-8">
          {/* Edit project */}
          <section className="bg-white border border-nu-ink/[0.06] p-6">
            <h3 className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-ink mb-4">프로젝트 정보</h3>
            {editingProject ? (
              <div className="space-y-4">
                <div>
                  <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">프로젝트명</label>
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="border-nu-ink/15 bg-transparent" />
                </div>
                <div>
                  <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">설명</label>
                  <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="border-nu-ink/15 bg-transparent resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">카테고리</label>
                    <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm">
                      {["general","development","design","marketing","operations","research","lh"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">상태</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm">
                      <option value="active">진행중</option>
                      <option value="completed">완료</option>
                      <option value="archived">보관</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProject} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest">저장</Button>
                  <Button variant="outline" onClick={() => setEditingProject(false)} className="font-mono-nu text-[10px] uppercase tracking-widest">취소</Button>
                </div>
              </div>
            ) : (
              <div>
                <dl className="space-y-2 text-sm">
                  <div className="flex"><dt className="w-20 text-nu-muted">제목</dt><dd className="font-bold">{project.title}</dd></div>
                  <div className="flex"><dt className="w-20 text-nu-muted">설명</dt><dd>{project.description || "—"}</dd></div>
                  <div className="flex"><dt className="w-20 text-nu-muted">카테고리</dt><dd>{project.category || "general"}</dd></div>
                  <div className="flex"><dt className="w-20 text-nu-muted">상태</dt><dd>{project.status}</dd></div>
                </dl>
                <Button onClick={startEditProject} variant="outline" className="mt-4 font-mono-nu text-[10px] uppercase tracking-widest gap-1.5">
                  <Edit3 size={12} /> 수정
                </Button>
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="border border-red-200 bg-red-50/30 p-6">
            <h3 className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-red-600 mb-2">위험 구역</h3>
            <p className="text-xs text-nu-muted mb-4">프로젝트를 삭제하면 모든 파일, 할일, 멤버 데이터가 영구 삭제됩니다.</p>
            <Button onClick={handleDeleteProject} variant="outline" className="border-red-300 text-red-600 hover:bg-red-100 font-mono-nu text-[10px] uppercase tracking-widest gap-1.5">
              <Trash2 size={12} /> 프로젝트 삭제
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
