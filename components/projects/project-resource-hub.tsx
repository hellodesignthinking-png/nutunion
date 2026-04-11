"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  FileEdit,
  FileClock,
  FileCheck,
  FileBadge,
  FileText,
  Sheet,
  BookOpen,
  Link,
  Link2,
  Search,
  Plus,
  X,
  ExternalLink,
  Loader2,
  HardDrive,
  Presentation,
  Trash2,
  Eye,
  Columns,
  Maximize2,
  Send,
  CheckSquare,
  MessageSquare,
  Clock,
  ChevronDown,
} from "lucide-react";
import { DrivePicker } from "@/components/integrations/drive-picker";
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal";
import { ResourceInteractions } from "@/components/shared/resource-interactions";
import { ResourceEditor } from "@/components/shared/resource-editor";
import { resolveTemplateContent } from "@/lib/template-resolver";
import { NewDocumentModal } from "@/components/shared/new-document-modal";
import { DriveUploader } from "@/components/integrations/drive-uploader";

type ResourceStage = "planning" | "interim" | "evidence" | "final";
type ResourceType = "google_doc" | "google_sheet" | "google_slide" | "drive" | "notion" | "link";

interface ProjectResource {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: ResourceType;
  stage: ResourceStage;
  description: string | null;
  content: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { nickname: string | null };
}

interface ProjectUpdate {
  id: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
  author?: { id: string; nickname: string };
}

interface ProjectActionItem {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done";
  assigned_to?: string;
  created_at: string;
  assignee?: { id: string; nickname: string };
}

const stageConfig: Record<
  ResourceStage,
  { icon: typeof FileEdit; label: string; badge: string }
> = {
  planning: { icon: FileEdit, label: "기획안", badge: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  interim: { icon: FileClock, label: "중간 결과물", badge: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  evidence: { icon: FileCheck, label: "증빙 자료", badge: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  final: { icon: FileBadge, label: "최종 결과물", badge: "bg-green-50 text-green-600 border-green-200" },
};

const typeConfig: Record<ResourceType, { icon: typeof FileText; label: string; color: string }> = {
  google_doc: { icon: FileText, label: "Docs", color: "text-blue-600" },
  google_sheet: { icon: Sheet, label: "Sheets", color: "text-green-600" },
  google_slide: { icon: Presentation, label: "Slides", color: "text-amber-600" },
  drive: { icon: HardDrive, label: "Drive", color: "text-green-600" },
  notion: { icon: BookOpen, label: "Notion", color: "text-nu-ink" },
  link: { icon: Link, label: "링크", color: "text-nu-blue" },
};

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-nu-gray/10", text: "text-nu-gray", label: "낮음" },
  medium: { bg: "bg-nu-blue/10", text: "text-nu-blue", label: "중간" },
  high: { bg: "bg-nu-amber/10", text: "text-nu-amber", label: "높음" },
  urgent: { bg: "bg-red-50", text: "text-red-600", label: "긴급" },
};

function detectType(url: string): ResourceType {
  if (url.includes("docs.google.com/document")) return "google_doc";
  if (url.includes("docs.google.com/spreadsheets")) return "google_sheet";
  if (url.includes("docs.google.com/presentation")) return "google_slide";
  if (url.includes("drive.google.com")) return "drive";
  if (url.includes("notion.so") || url.includes("notion.site")) return "notion";
  return "link";
}

function getEmbedUrl(url: string | null): string {
  if (!url) return "";
  if (url.includes("notion.so")) {
    try {
      const notionUrl = new URL(url);
      if (!notionUrl.searchParams.has("pvs")) notionUrl.searchParams.set("pvs", "4");
      return notionUrl.toString();
    } catch { return url; }
  }
  if (url.includes("docs.google.com")) {
    if (url.includes("/edit")) return url.replace("/edit", "/preview");
    if (url.includes("/view")) return url.replace("/view", "/preview");
    return url;
  }
  if (url.includes("drive.google.com/file/d/")) return url.replace(/\/view.*$/, "/preview");
  return url;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko");
}

export function ProjectResourceHub({
  projectId,
  isLead,
  isMember,
  userId,
}: {
  projectId: string;
  isLead: boolean;
  isMember: boolean;
  userId?: string;
}) {
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStage, setActiveStage] = useState<ResourceStage | "all">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [previewData, setPreviewData] = useState<{ url: string; name: string; id?: string; content?: string | null } | null>(null);
  const [isSplitView, setIsSplitView] = useState(true);

  // Right panel sub-tabs: preview / feedback / actions
  const [rightTab, setRightTab] = useState<"preview" | "feedback" | "actions">("preview");

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<ProjectUpdate[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [postingFeedback, setPostingFeedback] = useState(false);

  // Action items state
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>([]);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [savingAction, setSavingAction] = useState(false);
  const [members, setMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [newActionAssignee, setNewActionAssignee] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "", url: "", stage: "planning" as ResourceStage, description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isLead || isMember;

  // ── Load data ──
  useEffect(() => { loadResources(); }, [projectId]);

  useEffect(() => {
    loadFeedback();
    loadActionItems();
    loadMembers();
  }, [projectId]);

  async function loadResources() {
    setLoading(true);
    try {
      const supabase = createClient();
      // Try full query with uploader join
      const { data, error } = await supabase
        .from("project_resources")
        .select("*, uploader:profiles!uploaded_by(nickname)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback: without uploader join (FK may not exist in schema cache)
        const { data: basicData, error: basicError } = await supabase
          .from("project_resources")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        if (basicError) {
          console.warn("project_resources not available:", basicError.message);
          setResources([]);
        } else {
          setResources((basicData || []) as ProjectResource[]);
        }
      } else {
        setResources(data as ProjectResource[]);
      }
    } catch { setResources([]); }
    finally { setLoading(false); }
  }

  async function loadFeedback() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_updates")
        .select("*, author:profiles!project_updates_author_id_fkey(id, nickname)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) {
        setFeedbackList(data as ProjectUpdate[]);
      } else {
        const { data: basicData } = await supabase.from("project_updates").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
        if (basicData) setFeedbackList(basicData as ProjectUpdate[]);
      }
    } catch {}
  }

  async function loadActionItems() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_action_items")
        .select("*, assignee:profiles!assigned_to(id, nickname)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) {
        setActionItems(data as ProjectActionItem[]);
      } else {
        // Fallback without assignee join
        const { data: basicData } = await supabase
          .from("project_action_items")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (basicData) setActionItems(basicData as ProjectActionItem[]);
      }
    } catch {}
  }

  async function loadMembers() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, profiles!project_members_user_id_fkey(id, nickname)")
        .eq("project_id", projectId);
      if (!error && data) {
        setMembers(data.map((m: any) => m.profiles).filter(Boolean));
      } else {
        const { data: basicData } = await supabase.from("project_members").select("user_id").eq("project_id", projectId);
        if (basicData) setMembers(basicData.map((m: any) => ({ id: m.user_id, nickname: "멤버" })));
      }
    } catch {}
  }

  // Filter
  const filtered = resources.filter((r) => {
    const stageOk = activeStage === "all" || r.stage === activeStage;
    const searchOk = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return stageOk && searchOk;
  });

  const byStage = {
    planning: filtered.filter((r) => r.stage === "planning"),
    interim: filtered.filter((r) => r.stage === "interim"),
    evidence: filtered.filter((r) => r.stage === "evidence"),
    final: filtered.filter((r) => r.stage === "final"),
  };

  // Drive picker
  async function handleDriveFile(driveFile: { name: string; url: string; mimeType: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    const type = detectType(driveFile.url);
    const { error } = await supabase.from("project_resources").insert({
      project_id: projectId, name: driveFile.name, url: driveFile.url,
      type, stage: "planning", description: null, uploaded_by: user.id,
    });
    if (error) toast.error("자료 등록에 실패했습니다");
    else { toast.success(`"${driveFile.name}" 추가됨`); await loadResources(); }
  }

  // Link form
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) { toast.error("이름과 URL을 입력해주세요"); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");
      const autoType = detectType(formData.url);
      const { error } = await supabase.from("project_resources").insert({
        project_id: projectId, name: formData.name.trim(), url: formData.url.trim(),
        type: autoType, stage: formData.stage, description: formData.description.trim() || null, uploaded_by: user.id,
      });
      if (error) throw error;
      toast.success("자료가 추가되었습니다");
      setFormData({ name: "", url: "", stage: "planning", description: "" });
      setShowAddForm(false);
      await loadResources();
    } catch (err: any) { toast.error(err.message || "자료 추가에 실패했습니다"); }
    finally { setSubmitting(false); }
  }

  // Delete
  async function handleDelete(id: string) {
    if (!confirm("이 자료를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("project_resources").delete().eq("id", id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    toast.success("삭제되었습니다");
    setResources((prev) => prev.filter((r) => r.id !== id));
    if (previewData) {
      const deleted = resources.find(r => r.id === id);
      if (deleted && deleted.url === previewData.url) setPreviewData(null);
    }
  }

  // Post feedback
  async function handlePostFeedback() {
    if (!newFeedback.trim() || !userId) return;
    setPostingFeedback(true);
    try {
      const supabase = createClient();
      const payload = {
        project_id: projectId, author_id: userId, content: newFeedback.trim(), type: "post",
        metadata: { resource_id: previewData?.id || null, is_feedback: true },
      };
      const { data, error } = await supabase
        .from("project_updates")
        .insert(payload)
        .select("*, author:profiles!project_updates_author_id_fkey(id, nickname)")
        .single();
      if (error) {
        const { data: basicData, error: basicError } = await supabase.from("project_updates").insert(payload).select("*").single();
        if (basicError) throw basicError;
        setFeedbackList((prev) => [basicData as ProjectUpdate, ...prev]);
      } else {
        setFeedbackList((prev) => [data as ProjectUpdate, ...prev]);
      }
      setNewFeedback("");
      toast.success("피드백이 게시되었습니다");
    } catch (err: any) { toast.error(err.message || "피드백 게시 실패"); }
    finally { setPostingFeedback(false); }
  }

  // Add action item
  async function handleAddActionItem() {
    if (!newActionTitle.trim()) return;
    setSavingAction(true);
    try {
      const supabase = createClient();
      const actionPayload = {
        project_id: projectId, title: newActionTitle.trim(), priority: newActionPriority,
        status: "open", assigned_to: newActionAssignee || null,
        source_url: previewData?.url || null,
      };
      const { data, error } = await supabase
        .from("project_action_items")
        .insert(actionPayload)
        .select("*, assignee:profiles!assigned_to(id, nickname)")
        .single();
      if (error) {
        const { data: basicData, error: basicError } = await supabase.from("project_action_items").insert(actionPayload).select("*").single();
        if (basicError) throw basicError;
        setActionItems((prev) => [basicData as ProjectActionItem, ...prev]);
      } else {
        setActionItems((prev) => [data as ProjectActionItem, ...prev]);
      }
      setNewActionTitle(""); setNewActionAssignee(""); setNewActionPriority("medium");
      toast.success("액션 아이템이 추가되었습니다");
    } catch (err: any) { toast.error(err.message || "액션 아이템 추가 실패"); }
    finally { setSavingAction(false); }
  }

  // Toggle action status
  async function toggleActionStatus(item: ProjectActionItem) {
    const seq: Array<ProjectActionItem["status"]> = ["open", "in_progress", "done"];
    const next = seq[(seq.indexOf(item.status) + 1) % seq.length];
    try {
      const supabase = createClient();
      const { error } = await supabase.from("project_action_items").update({ status: next }).eq("id", item.id);
      if (error) throw error;
      setActionItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, status: next } : a)));
    } catch (err: any) { toast.error(err.message || "상태 업데이트 실패"); }
  }

  // Filtered feedback for current resource
  const currentFeedback = previewData?.id
    ? feedbackList.filter((u) => u.metadata?.resource_id === previewData.id)
    : feedbackList;

  return (
    <div className={`transition-all duration-500 ${isSplitView ? "w-full" : ""}`}>
      <div className={`flex flex-col lg:flex-row gap-6 ${isSplitView ? "lg:items-start" : ""}`}>

        {/* ─── Left Panel: Resource List ─── */}
        <div className={`transition-all duration-500 ${isSplitView ? "lg:w-[55%] xl:w-[50%] shrink-0" : "w-full"}`}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="px-2 py-0.5 bg-nu-blue text-nu-paper font-mono-nu text-[9px] font-black uppercase tracking-[0.2em]">Resource_Hub</div>
                <div className="px-2 py-0.5 bg-green-50 text-green-600 font-mono-nu text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1">
                  <HardDrive size={8} /> Zero_Storage
                </div>
              </div>
              <p className="text-nu-gray text-sm mt-1">자료 관리 · 문서 미리보기 · 피드백 · 액션아이템을 한 곳에서</p>
            </div>
            <button
              onClick={() => setIsSplitView(!isSplitView)}
              className={`p-2.5 border-[2px] transition-all shrink-0 ${
                isSplitView ? "bg-nu-ink text-nu-paper border-nu-ink" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
              }`}
              title={isSplitView ? "전체 보기" : "분할 보기"}
            >
              {isSplitView ? <Maximize2 size={16} /> : <Columns size={16} />}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="자료 검색..."
              className="w-full pl-11 pr-4 py-3 bg-nu-white border-2 border-nu-ink shadow-[3px_3px_0px_0px_#0d0d0d] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-none transition-all outline-none text-sm text-nu-ink"
            />
          </div>

          {/* Quick Add */}
          {canEdit && (
            <div className="mb-5 border-[2px] border-dashed border-nu-ink/15 bg-nu-white">
              <div className="px-4 py-3 flex flex-col sm:flex-row items-center gap-2">
                <div className="flex items-center gap-2 text-nu-muted flex-shrink-0">
                  <Plus size={14} />
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest font-bold">Quick Add</span>
                </div>
                <div className="flex-1 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* New Document */}
                  <button
                    onClick={() => setShowNewDocModal(true)}
                    className="flex items-center gap-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-all cursor-pointer border-none"
                  >
                    <FileText size={13} /> 새 문서
                  </button>
                  <DrivePicker onFilePicked={handleDriveFile} />
                  <DriveUploader
                    onUploaded={() => {
                      // DB insert done in API route; just refresh
                      loadResources();
                    }}
                    targetType="project"
                    targetId={projectId}
                    stage={activeStage === "all" ? "evidence" : activeStage}
                  />
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] transition-all ${
                      showAddForm ? "bg-nu-blue text-white border-nu-blue" : "border-nu-ink/10 text-nu-muted hover:border-nu-ink"
                    }`}
                  >
                    <Link2 size={13} /> 링크 추가
                  </button>
                </div>
              </div>

              {showAddForm && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                  <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="자료 이름" className="flex-1 h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue" />
                      <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value as ResourceStage })}
                        className="h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue">
                        <option value="planning">기획안</option>
                        <option value="interim">중간 결과물</option>
                        <option value="evidence">증빙 자료</option>
                        <option value="final">최종 결과물</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://docs.google.com/..." className="flex-[2] h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue" />
                      <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="설명 (선택)" className="flex-1 h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={submitting}
                        className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-ink text-white hover:bg-nu-pink transition-all disabled:opacity-30 flex items-center gap-2">
                        {submitting ? <><Loader2 size={12} className="animate-spin" /> 저장 중...</> : "등록"}
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 text-nu-muted hover:text-nu-ink transition-colors">취소</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Stage filter */}
          <div className="bg-gradient-to-r from-nu-ink to-nu-graphite p-3 mb-5">
            <div className="grid grid-cols-5 gap-1.5">
              <button onClick={() => setActiveStage("all")}
                className={`px-2 py-2 transition-all text-center ${activeStage === "all" ? "bg-nu-white text-nu-ink font-bold" : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"}`}>
                <div className="font-head text-xs font-bold">전체</div>
                <div className="font-mono-nu text-[9px] opacity-70">{resources.length}</div>
              </button>
              {(Object.keys(stageConfig) as ResourceStage[]).map((stage) => {
                const cfg = stageConfig[stage];
                const StageIcon = cfg.icon;
                return (
                  <button key={stage} onClick={() => setActiveStage(stage)}
                    className={`px-2 py-2 transition-all text-center ${activeStage === stage ? "bg-nu-white text-nu-ink font-bold" : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"}`}>
                    <div className="flex items-center justify-center gap-1">
                      <StageIcon size={11} />
                      <span className="font-head text-xs font-bold">{cfg.label}</span>
                    </div>
                    <div className="font-mono-nu text-[9px] opacity-70">{byStage[stage].length}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resources List */}
          <div className="relative min-h-[250px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-nu-gray" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-10 text-center">
                <FileText size={36} className="text-nu-gray/20 mx-auto mb-3" />
                <p className="text-nu-gray text-sm mb-1">{searchQuery ? "검색 결과가 없습니다" : "아직 자료가 없습니다"}</p>
                {canEdit && !searchQuery && <p className="text-[10px] text-nu-muted">Drive 연결 또는 링크 추가로 자료를 등록해보세요</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filtered.map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    canEdit={canEdit}
                    isSelected={previewData?.url === r.url}
                    onPreview={() => { setPreviewData({ url: r.url, name: r.name, id: r.id, content: resolveTemplateContent(r.url, r.content) }); setRightTab("preview"); }}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Panel: Preview + Feedback + Actions ─── */}
        {isSplitView && (
          <div className="lg:flex-1 lg:sticky lg:top-8 w-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="bg-nu-paper border-2 border-nu-ink shadow-2xl flex flex-col h-[80vh] lg:h-[calc(100vh-80px)]">

              {/* Right panel tabs */}
              <div className="bg-nu-ink flex border-b border-nu-ink/[0.1] shrink-0">
                {([
                  { key: "preview" as const, icon: Eye, label: "미리보기" },
                  { key: "feedback" as const, icon: MessageSquare, label: "피드백" },
                  { key: "actions" as const, icon: CheckSquare, label: "액션" },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRightTab(tab.key)}
                    className={`flex-1 px-3 py-2.5 font-mono-nu text-[9px] uppercase tracking-widest border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                      rightTab === tab.key
                        ? "border-nu-pink text-nu-pink"
                        : "border-transparent text-nu-white/50 hover:text-nu-white"
                    }`}
                  >
                    <tab.icon size={12} /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Preview Tab */}
              {rightTab === "preview" && (
                previewData ? (
                  previewData.content ? (
                    /* ─── Inline Editor for template resources ─── */
                    <ResourceEditor
                      targetType="project_resource"
                      resourceId={previewData.id || ""}
                      name={previewData.name}
                      initialContent={previewData.content}
                      canEdit={isMember}
                      onSave={(newContent) => {
                        // Update local state so re-clicking shows saved content
                        setResources((prev) => prev.map((r) => r.id === previewData.id ? { ...r, content: newContent } : r));
                        setPreviewData((prev) => prev ? { ...prev, content: newContent } : prev);
                      }}
                      onClose={() => setPreviewData(null)}
                    />
                  ) : (
                    /* ─── iframe preview for external links ─── */
                    <div className="flex-1 flex flex-col h-full">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-nu-ink bg-nu-cream/30 shrink-0">
                        <div className="min-w-0 pr-3">
                          <p className="font-head text-[12px] font-black text-nu-ink truncate uppercase tracking-tight">{previewData.name}</p>
                          <p className="font-mono-nu text-[8px] text-nu-muted truncate uppercase tracking-widest mt-0.5">Live Preview</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a href={previewData.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-ink" title="원본 보기">
                            <ExternalLink size={13} />
                          </a>
                          <button onClick={() => setPreviewData(null)} className="p-1.5 text-nu-muted hover:text-nu-ink">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-nu-white overflow-hidden relative">
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-nu-paper/95 opacity-0 pointer-events-none transition-opacity" id="project-perm-guard">
                          <div className="text-center px-6 max-w-xs">
                            <div className="w-12 h-12 bg-nu-amber/10 rounded-full flex items-center justify-center mx-auto mb-3">
                              <span className="text-xl">🔒</span>
                            </div>
                            <p className="font-head text-sm font-bold text-nu-ink mb-2">공유 설정을 확인해주세요</p>
                            <p className="text-[10px] text-nu-muted leading-relaxed mb-3">
                              원본 문서의 공유 설정에서 <span className="font-bold text-nu-ink">&quot;링크가 있는 모든 사용자에게 공개&quot;</span>로 변경해 주세요.
                            </p>
                            <a href={previewData.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper no-underline">
                              <ExternalLink size={11} /> 원본에서 열기
                            </a>
                          </div>
                        </div>
                        <iframe
                          src={getEmbedUrl(previewData.url)}
                          className="w-full h-full border-0"
                          allow="autoplay; encrypted-media; fullscreen"
                          onError={() => {
                            const guard = document.getElementById("project-perm-guard");
                            if (guard) { guard.style.opacity = "1"; guard.style.pointerEvents = "auto"; }
                          }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-nu-muted">
                    <div className="w-16 h-16 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-4">
                      <Eye size={28} className="opacity-20" />
                    </div>
                    <p className="font-head text-sm font-bold text-nu-ink/40 uppercase tracking-widest">Select a document</p>
                    <p className="text-[11px] mt-2 max-w-[200px]">자료를 선택하면 여기서 실시간 미리보기가 표시됩니다.</p>
                  </div>
                )
              )}

              {/* Feedback Tab */}
              {rightTab === "feedback" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {previewData && (
                      <div className="bg-nu-blue/5 border border-nu-blue/20 px-3 py-2 mb-2">
                        <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-blue">현재 문서에 대한 피드백</p>
                        <p className="text-xs font-bold text-nu-ink truncate">{previewData.name}</p>
                      </div>
                    )}
                    {currentFeedback.length === 0 ? (
                      <div className="text-center py-8 text-nu-muted">
                        <MessageSquare size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs">아직 피드백이 없습니다</p>
                      </div>
                    ) : (
                      currentFeedback.slice(0, 30).map((fb) => (
                        <div key={fb.id} className="border border-nu-ink/[0.08] p-3 bg-nu-cream/20">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[9px] font-bold shrink-0">
                              {(fb.author?.nickname || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[11px]">{fb.author?.nickname || "Unknown"}</span>
                                <span className="font-mono-nu text-[7px] text-nu-muted">{timeAgo(fb.created_at)}</span>
                              </div>
                              <p className="text-[11px] text-nu-graphite mt-1 leading-relaxed whitespace-pre-wrap break-words">{fb.content}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {isMember && userId && (
                    <div className="border-t-2 border-nu-ink p-3 bg-nu-cream/20 shrink-0">
                      <textarea
                        value={newFeedback}
                        onChange={(e) => setNewFeedback(e.target.value)}
                        placeholder="피드백을 입력하세요..."
                        rows={2}
                        className="w-full px-3 py-2 bg-nu-white border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink resize-none mb-2"
                      />
                      <button
                        onClick={handlePostFeedback}
                        disabled={postingFeedback || !newFeedback.trim()}
                        className="w-full font-mono-nu text-[9px] uppercase tracking-widest py-2 bg-nu-pink text-white hover:bg-nu-pink/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {postingFeedback ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        게시
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions Tab */}
              {rightTab === "actions" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {actionItems.length === 0 ? (
                      <div className="text-center py-8 text-nu-muted">
                        <CheckSquare size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-xs">아직 액션 아이템이 없습니다</p>
                      </div>
                    ) : (
                      actionItems.map((item) => {
                        const ps = priorityConfig[item.priority] || priorityConfig.medium;
                        const statusLabel = { open: "미시작", in_progress: "진행 중", done: "완료" }[item.status];
                        return (
                          <div key={item.id} className="border border-nu-ink/[0.08] p-3 bg-nu-cream/20">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => toggleActionStatus(item)}
                                className={`shrink-0 mt-0.5 ${item.status === "done" ? "text-green-600" : "text-nu-muted hover:text-nu-ink"}`}
                              >
                                <CheckSquare size={15} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-medium ${item.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
                                  {item.title}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <span className={`font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 ${ps.bg} ${ps.text}`}>{ps.label}</span>
                                  <span className="font-mono-nu text-[7px] text-nu-muted">{statusLabel}</span>
                                </div>
                              </div>
                              {item.assignee && (
                                <div className="w-5 h-5 rounded-full bg-nu-blue/20 flex items-center justify-center font-head text-[7px] font-bold text-nu-blue shrink-0" title={item.assignee.nickname}>
                                  {item.assignee.nickname.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {isMember && userId && (
                    <div className="border-t-2 border-nu-ink p-3 bg-nu-cream/20 shrink-0 space-y-2">
                      <input
                        type="text" value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)}
                        placeholder="액션 아이템 제목"
                        className="w-full px-3 py-2 bg-nu-white border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={newActionPriority} onChange={(e) => setNewActionPriority(e.target.value as any)}
                          className="px-2 py-1.5 bg-nu-white border border-nu-ink/[0.12] text-[11px] focus:outline-none focus:border-nu-pink">
                          <option value="low">낮음</option>
                          <option value="medium">중간</option>
                          <option value="high">높음</option>
                          <option value="urgent">긴급</option>
                        </select>
                        <select value={newActionAssignee} onChange={(e) => setNewActionAssignee(e.target.value)}
                          className="px-2 py-1.5 bg-nu-white border border-nu-ink/[0.12] text-[11px] focus:outline-none focus:border-nu-pink">
                          <option value="">담당자 선택</option>
                          {members.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={handleAddActionItem}
                        disabled={savingAction || !newActionTitle.trim()}
                        className="w-full font-mono-nu text-[9px] uppercase tracking-widest py-2 bg-nu-ink text-white hover:bg-nu-ink/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {savingAction ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        액션 아이템 추가
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fallback Modal for non-split mode */}
      {!isSplitView && previewData && (
        previewData.content ? (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-nu-white w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border-2 border-nu-ink">
              <ResourceEditor
                targetType="project_resource"
                resourceId={previewData.id || ""}
                name={previewData.name}
                initialContent={previewData.content}
                canEdit={isMember}
                onSave={(newContent) => {
                  setResources((prev) => prev.map((r) => r.id === previewData.id ? { ...r, content: newContent } : r));
                  setPreviewData((prev) => prev ? { ...prev, content: newContent } : prev);
                }}
                onClose={() => setPreviewData(null)}
              />
            </div>
          </div>
        ) : (
          <ResourcePreviewModal
            isOpen={!!previewData}
            onClose={() => setPreviewData(null)}
            url={previewData.url}
            name={previewData.name}
          />
        )
      )}

      {/* New Document Modal */}
      {showNewDocModal && (
        <NewDocumentModal
          targetType="project"
          targetId={projectId}
          stage={activeStage === "all" ? "planning" : activeStage}
          onCreated={loadResources}
          onClose={() => setShowNewDocModal(false)}
        />
      )}
    </div>
  );
}

// ─── Resource Card ───
function ResourceCard({ resource, canEdit, isSelected, onPreview, onDelete }: {
  resource: ProjectResource;
  canEdit: boolean;
  isSelected: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const stageCfg = stageConfig[resource.stage];
  const typeCfg = typeConfig[resource.type] || typeConfig.link;
  const TypeIcon = typeCfg.icon;
  const ageHours = (Date.now() - new Date(resource.created_at).getTime()) / 3600000;
  const isNew = ageHours < 48;

  return (
    <div
      className={`group bg-nu-white border-2 transition-all hover:bg-nu-cream/10 overflow-hidden cursor-pointer ${
        isSelected ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink/[0.08] hover:border-nu-pink/40"
      }`}
      onClick={onPreview}
    >
      <div className="p-3.5 flex items-center gap-3">
        <div className={`w-10 h-10 flex items-center justify-center shrink-0 border-2 border-nu-ink/5 ${
          resource.type === "drive" ? "bg-green-50" : resource.type === "notion" ? "bg-nu-ink/5" : "bg-nu-cream/50"
        }`}>
          <TypeIcon size={18} className={typeCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[12px] font-black text-nu-ink truncate uppercase tracking-tight">{resource.name}</h3>
            {resolveTemplateContent(resource.url, resource.content) && <span className="shrink-0 font-mono-nu text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue border border-nu-blue/20">편집</span>}
            {isNew && <span className="shrink-0 font-mono-nu text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink text-white animate-pulse">NEW</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`font-mono-nu text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${stageCfg.badge}`}>{stageCfg.label}</span>
            <span className={`font-mono-nu text-[8px] uppercase tracking-widest ${typeCfg.color}`}>{typeCfg.label}</span>
            {resource.uploader?.nickname && (
              <>
                <span className="w-0.5 h-0.5 bg-nu-ink/10 rounded-full" />
                <span className="font-mono-nu text-[8px] text-nu-muted">{resource.uploader.nickname}</span>
              </>
            )}
            <span className="w-0.5 h-0.5 bg-nu-ink/10 rounded-full" />
            <span className="font-mono-nu text-[8px] text-nu-muted">
              {new Date(resource.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onPreview} className={`p-1.5 transition-colors ${isSelected ? "text-nu-pink" : "text-nu-muted hover:text-nu-pink"}`} title="미리보기">
            <Eye size={14} />
          </button>
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors">
            <ExternalLink size={14} />
          </a>
          {canEdit && (
            <button onClick={onDelete} className="p-1.5 text-nu-muted/30 hover:text-red-500 transition-colors" title="삭제">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {/* Like & Comment interactions */}
      <div className="px-3.5 pb-2.5 border-t border-nu-ink/[0.04]">
        <ResourceInteractions targetType="project_resource" targetId={resource.id} compact />
      </div>
    </div>
  );
}
