"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  MessageSquare,
  CheckSquare,
  Plus,
  ExternalLink,
  Maximize2,
  Minimize2,
  Send,
  AlertCircle,
  Clock,
  User,
  ChevronDown,
  Loader2,
} from "lucide-react";

interface ProjectResource {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}

interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
  author?: {
    id: string;
    nickname: string;
    avatar_url?: string;
  };
}

interface ProjectActionItem {
  id: string;
  project_id: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done";
  assigned_to?: string;
  due_date?: string;
  source_url?: string;
  created_at: string;
  assignee?: {
    id: string;
    nickname: string;
    avatar_url?: string;
  };
}

const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-nu-gray/10", text: "text-nu-gray", label: "낮음" },
  medium: { bg: "bg-nu-blue/10", text: "text-nu-blue", label: "중간" },
  high: { bg: "bg-nu-amber/10", text: "text-nu-amber", label: "높음" },
  urgent: { bg: "bg-nu-red/10", text: "text-nu-red", label: "긴급" },
};

const statusLabels: Record<string, string> = {
  open: "미시작",
  in_progress: "진행 중",
  done: "완료",
};

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

function getEmbedUrl(url: string): string {
  if (url.includes("docs.google.com")) {
    return url.includes("?") ? `${url}&embedded=true` : `${url}?embedded=true`;
  }
  return url;
}

export function ProjectSplitView({
  projectId,
  isMember,
  userId,
}: {
  projectId: string;
  isMember: boolean;
  userId: string | undefined;
}) {
  // ── State ─────────────────────────────────────────────────────────
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(null);
  const [fullscreenDoc, setFullscreenDoc] = useState(false);

  const [feedbackUpdates, setFeedbackUpdates] = useState<ProjectUpdate[]>([]);
  const [actionItems, setActionItems] = useState<ProjectActionItem[]>([]);
  const [activeTab, setActiveTab] = useState<"feedback" | "actions">("feedback");
  const [feedbackFilter, setFeedbackFilter] = useState<"current" | "all">("all");

  const [newFeedback, setNewFeedback] = useState("");
  const [postingFeedback, setPostingFeedback] = useState(false);

  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<ProjectActionItem["priority"]>("medium");
  const [newActionAssignee, setNewActionAssignee] = useState<string>("");
  const [savingAction, setSavingAction] = useState(false);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);

  // ── Load resources on mount ───────────────────────────────────────
  const loadResources = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_resources")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setResources(data as ProjectResource[]);
      if (data.length > 0 && !selectedResourceId) {
        setSelectedResourceId(data[0].id);
        setSelectedResource(data[0] as ProjectResource);
      }
    }
  }, [projectId, selectedResourceId]);

  const loadFeedback = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_updates")
      .select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setFeedbackUpdates(data as ProjectUpdate[]);
    }
  }, [projectId]);

  const loadActionItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_action_items")
      .select("*, assignee:profiles!project_action_items_assigned_to_fkey(id, nickname, avatar_url)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setActionItems(data as ProjectActionItem[]);
    }
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, profiles!project_members_user_id_fkey(id, nickname, avatar_url)")
      .eq("project_id", projectId);

    if (!error && data) {
      setMembers(data.map((m: any) => m.profiles).filter(Boolean));
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([loadResources(), loadFeedback(), loadActionItems(), loadMembers()]).then(
      () => setLoading(false)
    );
  }, [loadResources, loadFeedback, loadActionItems, loadMembers]);

  useEffect(() => {
    if (selectedResourceId) {
      const resource = resources.find((r) => r.id === selectedResourceId);
      setSelectedResource(resource || null);
    }
  }, [selectedResourceId, resources]);

  // ── Post feedback ─────────────────────────────────────────────────
  async function handlePostFeedback() {
    if (!newFeedback.trim() || !userId) return;
    setPostingFeedback(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_updates")
        .insert({
          project_id: projectId,
          author_id: userId,
          content: newFeedback.trim(),
          type: "post",
          metadata: {
            resource_id: selectedResourceId,
            is_feedback: true,
          },
        })
        .select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
        .single();

      if (error) throw error;
      setFeedbackUpdates((prev) => [data as ProjectUpdate, ...prev]);
      setNewFeedback("");
      toast.success("피드백이 게시되었습니다");
    } catch (err: any) {
      toast.error(err.message || "피드백 게시 실패");
    } finally {
      setPostingFeedback(false);
    }
  }

  // ── Add action item ───────────────────────────────────────────────
  async function handleAddActionItem() {
    if (!newActionTitle.trim()) return;
    setSavingAction(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_action_items")
        .insert({
          project_id: projectId,
          title: newActionTitle.trim(),
          priority: newActionPriority,
          status: "open",
          assigned_to: newActionAssignee || null,
          source_url: selectedResource?.url || null,
        })
        .select("*, assignee:profiles!project_action_items_assigned_to_fkey(id, nickname, avatar_url)")
        .single();

      if (error) throw error;
      setActionItems((prev) => [data as ProjectActionItem, ...prev]);
      setNewActionTitle("");
      setNewActionAssignee("");
      setNewActionPriority("medium");
      toast.success("액션 아이템이 추가되었습니다");
    } catch (err: any) {
      toast.error(err.message || "액션 아이템 추가 실패");
    } finally {
      setSavingAction(false);
    }
  }

  // ── Toggle action item status ─────────────────────────────────────
  async function toggleActionStatus(item: ProjectActionItem) {
    const statusSequence: Array<ProjectActionItem["status"]> = ["open", "in_progress", "done"];
    const currentIndex = statusSequence.indexOf(item.status);
    const nextStatus = statusSequence[(currentIndex + 1) % statusSequence.length];

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_action_items")
        .update({ status: nextStatus })
        .eq("id", item.id);

      if (error) throw error;
      setActionItems((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a))
      );
      toast.success("액션 아이템 상태가 업데이트되었습니다");
    } catch (err: any) {
      toast.error(err.message || "상태 업데이트 실패");
    }
  }

  // ── Filtered feedback ─────────────────────────────────────────────
  const filteredFeedback =
    feedbackFilter === "current" && selectedResource
      ? feedbackUpdates.filter(
          (u) =>
            u.metadata?.resource_id === selectedResource.id ||
            u.metadata?.is_feedback === true
        )
      : feedbackUpdates;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-96">
        <div className="lg:col-span-3 bg-nu-white border border-nu-ink/[0.08] animate-pulse p-6">
          <div className="h-8 bg-nu-ink/8 w-32 mb-4" />
        </div>
        <div className="lg:col-span-2 bg-nu-white border border-nu-ink/[0.08] animate-pulse p-6">
          <div className="h-8 bg-nu-ink/8 w-32 mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${fullscreenDoc ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-5"}`}>
      {/* ── LEFT PANEL: Document Viewer ────────────────────────────── */}
      <div
        className={`bg-nu-white border border-nu-ink/[0.08] overflow-hidden flex flex-col ${
          fullscreenDoc ? "fixed inset-4 z-50" : "lg:col-span-3"
        }`}
      >
        {/* Header */}
        <div className="bg-nu-ink px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-white/60 block mb-1">
              리소스 선택
            </label>
            <div className="relative">
              <select
                value={selectedResourceId || ""}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="w-full appearance-none bg-nu-white text-nu-ink px-3 py-2 pr-7 text-sm font-medium border border-nu-ink/[0.12] focus:outline-none focus:border-nu-pink"
              >
                <option value="">리소스를 선택하세요</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-nu-ink/60"
              />
            </div>
          </div>

          {selectedResource && (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={selectedResource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-nu-white/10 transition-colors text-nu-white"
                title="새 탭에서 열기"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setFullscreenDoc(!fullscreenDoc)}
                className="p-2 hover:bg-nu-white/10 transition-colors text-nu-white"
                title={fullscreenDoc ? "전체화면 해제" : "전체화면"}
              >
                {fullscreenDoc ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* Document iframe */}
        <div className="flex-1 overflow-hidden bg-nu-paper">
          {selectedResource ? (
            <iframe
              src={getEmbedUrl(selectedResource.url)}
              className="w-full h-full border-0"
              title={selectedResource.name}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-nu-gray">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">리소스를 선택하면 여기에 표시됩니다</p>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen close button */}
        {fullscreenDoc && (
          <button
            onClick={() => setFullscreenDoc(false)}
            className="absolute top-6 right-6 z-50 bg-nu-ink text-nu-white px-4 py-2 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink/90"
          >
            닫기
          </button>
        )}
      </div>

      {/* ── RIGHT PANEL: Feedback & Actions ────────────────────────── */}
      {!fullscreenDoc && (
        <div className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden flex flex-col lg:col-span-2">
          {/* Tab header */}
          <div className="bg-nu-ink flex border-b border-nu-ink/[0.1]">
            <button
              onClick={() => setActiveTab("feedback")}
              className={`flex-1 px-4 py-3 font-mono-nu text-[10px] uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === "feedback"
                  ? "border-nu-pink text-nu-pink"
                  : "border-transparent text-nu-white/60 hover:text-nu-white"
              }`}
            >
              <MessageSquare size={12} className="inline mr-2" />
              피드백
            </button>
            <button
              onClick={() => setActiveTab("actions")}
              className={`flex-1 px-4 py-3 font-mono-nu text-[10px] uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === "actions"
                  ? "border-nu-pink text-nu-pink"
                  : "border-transparent text-nu-white/60 hover:text-nu-white"
              }`}
            >
              <CheckSquare size={12} className="inline mr-2" />
              액션 아이템
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "feedback" && (
              <div className="p-4 space-y-4">
                {/* Filter */}
                {selectedResource && (
                  <div className="flex gap-2 border-b border-nu-ink/[0.08] pb-3">
                    <button
                      onClick={() => setFeedbackFilter("all")}
                      className={`px-3 py-1.5 font-mono-nu text-[8px] uppercase tracking-widest transition-colors ${
                        feedbackFilter === "all"
                          ? "bg-nu-ink text-nu-white"
                          : "bg-nu-cream text-nu-ink hover:bg-nu-cream/70"
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => setFeedbackFilter("current")}
                      className={`px-3 py-1.5 font-mono-nu text-[8px] uppercase tracking-widest transition-colors ${
                        feedbackFilter === "current"
                          ? "bg-nu-ink text-nu-white"
                          : "bg-nu-cream text-nu-ink hover:bg-nu-cream/70"
                      }`}
                    >
                      이 문서
                    </button>
                  </div>
                )}

                {/* Feedback list */}
                <div className="space-y-3">
                  {filteredFeedback.slice(0, 20).map((update) => (
                    <div key={update.id} className="border border-nu-ink/[0.08] p-3 bg-nu-cream/20">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold shrink-0">
                          {(update.author?.nickname || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 gap-1">
                            <span className="font-medium text-xs">
                              {update.author?.nickname || "Unknown"}
                            </span>
                            <span className="font-mono-nu text-[7px] text-nu-muted">
                              {timeAgo(update.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-nu-graphite mt-1 leading-relaxed whitespace-pre-wrap break-words">
                            {update.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Post feedback form */}
                {isMember && userId && (
                  <div className="border-t border-nu-ink/[0.08] pt-3 mt-4">
                    <textarea
                      value={newFeedback}
                      onChange={(e) => setNewFeedback(e.target.value)}
                      placeholder="피드백을 입력하세요..."
                      rows={2}
                      className="w-full px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink resize-none mb-2"
                    />
                    <button
                      onClick={handlePostFeedback}
                      disabled={postingFeedback || !newFeedback.trim()}
                      className="w-full font-mono-nu text-[9px] uppercase tracking-widest py-2 bg-nu-pink text-nu-white hover:bg-nu-pink/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {postingFeedback ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Send size={11} />
                      )}
                      게시
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "actions" && (
              <div className="p-4 space-y-4">
                {/* Action items list */}
                <div className="space-y-2">
                  {actionItems.length === 0 ? (
                    <div className="text-center py-6 text-nu-gray text-xs">
                      아직 액션 아이템이 없습니다
                    </div>
                  ) : (
                    actionItems.map((item) => {
                      const priorityStyle = priorityColors[item.priority] || priorityColors.medium;
                      return (
                        <div
                          key={item.id}
                          className="border border-nu-ink/[0.08] p-3 bg-nu-cream/20 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleActionStatus(item)}
                              className={`shrink-0 mt-0.5 ${item.status === "done" ? "text-green-600" : "text-nu-muted hover:text-nu-ink"}`}
                              title={`상태: ${statusLabels[item.status]}`}
                            >
                              <CheckSquare size={16} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-medium ${
                                  item.status === "done"
                                    ? "line-through text-nu-muted"
                                    : "text-nu-ink"
                                }`}
                              >
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <span
                                  className={`font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 ${priorityStyle.bg} ${priorityStyle.text}`}
                                >
                                  {priorityStyle.label}
                                </span>
                                <span className="font-mono-nu text-[7px] text-nu-muted">
                                  {statusLabels[item.status]}
                                </span>
                                {item.due_date && (
                                  <span className="font-mono-nu text-[7px] text-nu-muted flex items-center gap-0.5">
                                    <Clock size={8} />
                                    {new Date(item.due_date).toLocaleDateString("ko", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.assignee && (
                              <div
                                className="w-6 h-6 rounded-full bg-nu-blue/20 flex items-center justify-center font-head text-[7px] font-bold text-nu-blue shrink-0"
                                title={item.assignee.nickname}
                              >
                                {item.assignee.nickname.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add action item form */}
                {isMember && userId && (
                  <div className="border-t border-nu-ink/[0.08] pt-3 mt-4 space-y-2">
                    <input
                      type="text"
                      value={newActionTitle}
                      onChange={(e) => setNewActionTitle(e.target.value)}
                      placeholder="액션 아이템 제목"
                      className="w-full px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newActionPriority}
                        onChange={(e) =>
                          setNewActionPriority(
                            e.target.value as ProjectActionItem["priority"]
                          )
                        }
                        className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink"
                      >
                        <option value="low">낮음</option>
                        <option value="medium">중간</option>
                        <option value="high">높음</option>
                        <option value="urgent">긴급</option>
                      </select>
                      <select
                        value={newActionAssignee}
                        onChange={(e) => setNewActionAssignee(e.target.value)}
                        className="px-3 py-2 bg-nu-paper border border-nu-ink/[0.12] text-xs focus:outline-none focus:border-nu-pink"
                      >
                        <option value="">담당자 선택</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nickname}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddActionItem}
                      disabled={savingAction || !newActionTitle.trim()}
                      className="w-full font-mono-nu text-[9px] uppercase tracking-widest py-2 bg-nu-ink text-nu-white hover:bg-nu-ink/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {savingAction ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Plus size={11} />
                      )}
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
  );
}
