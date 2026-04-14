"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Target, ChevronRight, CheckCircle2, Circle, Loader2,
  Plus, Save, X, Edit3, ArrowRight, Heart, MessageCircle,
  Send, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

/* ───────────────── Types ───────────────── */

interface RoadmapPhase {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "active" | "done";
  order: number;
}

interface PhaseComment {
  id: string;
  target_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  author?: { nickname: string; avatar_url?: string };
  replies?: PhaseComment[];
}

interface PhaseReaction {
  id: string;
  target_id: string;
  user_id: string;
  emoji: string;
}

interface GroupRoadmapProps {
  groupId: string;
  groupTopic?: string;
  canEdit: boolean;
  userId?: string;
}

/* ───────────────── Helpers ───────────────── */

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  return `${days}일 전`;
}

/* ───────────────── Phase Reactions (Likes) ───────────────── */

function PhaseLikes({ phaseId, userId }: { phaseId: string; userId?: string }) {
  const [likes, setLikes] = useState<PhaseReaction[]>([]);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("reactions")
        .select("id, target_id, user_id, emoji")
        .eq("target_type", "roadmap_phase")
        .eq("target_id", phaseId)
        .eq("emoji", "👍");
      if (data) {
        setLikes(data);
        setLiked(!!data.find((r: any) => r.user_id === userId));
      }
    }
    load();
  }, [phaseId, userId]);

  async function toggle() {
    if (!userId) return;
    const supabase = createClient();
    if (liked) {
      const mine = likes.find((r) => r.user_id === userId);
      if (mine) {
        await supabase.from("reactions").delete().eq("id", mine.id);
        setLikes((prev) => prev.filter((r) => r.id !== mine.id));
        setLiked(false);
      }
    } else {
      const { data } = await supabase
        .from("reactions")
        .insert({ target_type: "roadmap_phase", target_id: phaseId, user_id: userId, emoji: "👍" })
        .select()
        .single();
      if (data) {
        setLikes((prev) => [...prev, data]);
        setLiked(true);
      }
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className={`inline-flex items-center gap-1 text-[10px] font-mono-nu transition-colors ${
        liked ? "text-nu-pink" : "text-nu-muted hover:text-nu-pink"
      }`}
    >
      <Heart size={11} className={liked ? "fill-nu-pink" : ""} />
      {likes.length > 0 && <span>{likes.length}</span>}
    </button>
  );
}

/* ───────────────── Phase Comments (Replies) ───────────────── */

function PhaseComments({ phaseId, userId }: { phaseId: string; userId?: string }) {
  const [comments, setComments] = useState<PhaseComment[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [count, setCount] = useState(0);

  const loadComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("comments")
      .select("id, target_id, user_id, content, parent_id, created_at, author:profiles!comments_user_id_fkey(nickname, avatar_url)")
      .eq("target_type", "roadmap_phase")
      .eq("target_id", phaseId)
      .order("created_at", { ascending: true });
    if (data) {
      const normalized = data.map((c: any) => ({
        ...c,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
      }));
      // Build threaded structure
      const roots: PhaseComment[] = [];
      const replyMap: Record<string, PhaseComment[]> = {};
      normalized.forEach((c: PhaseComment) => {
        if (c.parent_id) {
          if (!replyMap[c.parent_id]) replyMap[c.parent_id] = [];
          replyMap[c.parent_id].push(c);
        } else {
          roots.push(c);
        }
      });
      roots.forEach((r) => { r.replies = replyMap[r.id] || []; });
      setComments(roots);
      setCount(normalized.length);
    }
  }, [phaseId]);

  useEffect(() => {
    // Just get the count initially
    async function getCount() {
      const supabase = createClient();
      const { count: c } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("target_type", "roadmap_phase")
        .eq("target_id", phaseId);
      setCount(c || 0);
    }
    getCount();
  }, [phaseId]);

  useEffect(() => {
    if (expanded) loadComments();
  }, [expanded, loadComments]);

  async function submitComment(parentId: string | null, text: string) {
    if (!userId || !text.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("comments")
      .insert({
        target_type: "roadmap_phase",
        target_id: phaseId,
        user_id: userId,
        content: text.trim(),
        parent_id: parentId,
      });
    if (!error) {
      if (parentId) { setReplyText(""); setReplyTo(null); }
      else { setNewComment(""); }
      setCount((p) => p + 1);
      loadComments();
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-nu-muted hover:text-nu-blue transition-colors"
      >
        <MessageCircle size={11} />
        {count > 0 && <span>{count}</span>}
        {expanded ? <ChevronDown size={9} className="rotate-180" /> : <ChevronDown size={9} />}
      </button>

      {expanded && (
        <div className="mt-2 ml-1 border-l-2 border-nu-ink/5 pl-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Comment list */}
          {comments.map((c) => (
            <div key={c.id}>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center text-[8px] font-head font-bold text-nu-ink shrink-0 mt-0.5">
                  {(c.author?.nickname || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-nu-ink">{c.author?.nickname || "Unknown"}</span>
                    <span className="text-[9px] font-mono-nu text-nu-muted">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-nu-graphite leading-relaxed">{c.content}</p>
                  {userId && (
                    <button
                      onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                      className="text-[9px] font-mono-nu text-nu-muted hover:text-nu-blue mt-0.5"
                    >
                      답글
                    </button>
                  )}
                </div>
              </div>

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="ml-7 mt-1 space-y-1.5">
                  {c.replies.map((r) => (
                    <div key={r.id} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-nu-cream/70 flex items-center justify-center text-[7px] font-head font-bold text-nu-ink shrink-0 mt-0.5">
                        {(r.author?.nickname || "U")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-nu-ink">{r.author?.nickname || "Unknown"}</span>
                          <span className="text-[8px] font-mono-nu text-nu-muted">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-nu-graphite">{r.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {replyTo === c.id && (
                <div className="ml-7 mt-1 flex gap-1">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="답글 작성..."
                    className="flex-1 px-2 py-1 text-[10px] border border-nu-ink/10 bg-transparent focus:outline-none focus:border-nu-pink"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") submitComment(c.id, replyText); }}
                  />
                  <button
                    onClick={() => submitComment(c.id, replyText)}
                    className="px-2 py-1 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
                  >
                    <Send size={9} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* New comment input */}
          {userId && (
            <div className="flex gap-1 pt-1">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글 작성..."
                className="flex-1 px-2 py-1 text-[10px] border border-nu-ink/10 bg-transparent focus:outline-none focus:border-nu-pink"
                onKeyDown={(e) => { if (e.key === "Enter") submitComment(null, newComment); }}
              />
              <button
                onClick={() => submitComment(null, newComment)}
                className="px-2 py-1 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
              >
                <Send size={9} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────── Main Component ───────────────── */

export function GroupRoadmap({ groupId, groupTopic: initialTopic, canEdit, userId }: GroupRoadmapProps) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic || "");
  const [editingTopic, setEditingTopic] = useState(false);
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({ title: "", description: "" });
  const [collapsed, setCollapsed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(userId || "");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get current user if not provided
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      }

      try {
        const { data, error } = await supabase
          .from("group_roadmap_phases")
          .select("*")
          .eq("group_id", groupId)
          .order("order");
        if (error) {
          console.warn("Roadmap feature not available:", error.message);
        } else {
          setPhases(data || []);
        }
      } catch (err) {
        console.warn("Roadmap feature not available");
      }
      setLoading(false);
    }
    load();
  }, [groupId, currentUserId]);

  async function saveTopic() {
    setSavingTopic(true);
    const supabase = createClient();
    try {
      await supabase.from("groups").update({ topic: topic.trim() }).eq("id", groupId);
      router.refresh();
      setEditingTopic(false);
      toast.success("주제가 저장되었습니다");
    } catch (err) {
      console.warn("Failed to save topic:", err);
      toast.error("주제 저장에 실패했습니다");
    }
    setSavingTopic(false);
  }

  async function addPhase() {
    if (!newPhase.title.trim()) return;
    const supabase = createClient();
    try {
      const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.order)) + 1 : 0;
      const { data, error } = await supabase
        .from("group_roadmap_phases")
        .insert({
          group_id: groupId,
          title: newPhase.title.trim(),
          description: newPhase.description || null,
          status: "pending",
          order: maxOrder,
        })
        .select()
        .single();
      if (error) {
        console.warn("Failed to add phase:", error);
        toast.error("단계 추가에 실패했습니다. 권한을 확인해주세요.");
        return;
      }
      setPhases((prev) => [...prev, data as RoadmapPhase]);
      setNewPhase({ title: "", description: "" });
      setAddingPhase(false);
      router.refresh();
      toast.success("단계가 추가되었습니다");
    } catch (err) {
      console.warn("Failed to add phase:", err);
      toast.error("단계 추가에 실패했습니다");
    }
  }

  async function updatePhaseStatus(id: string, status: RoadmapPhase["status"]) {
    if (!canEdit) return;
    const next: RoadmapPhase["status"] = status === "pending" ? "active" : status === "active" ? "done" : "pending";
    const supabase = createClient();
    try {
      await supabase.from("group_roadmap_phases").update({ status: next }).eq("id", id);
      setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
      router.refresh();
    } catch (err) {
      console.warn("Failed to update phase status:", err);
    }
  }

  async function deletePhase(id: string) {
    if (!confirm("이 단계를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    try {
      await supabase.from("group_roadmap_phases").delete().eq("id", id);
      setPhases((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err) {
      console.warn("Failed to delete phase:", err);
      toast.error("단계 삭제에 실패했습니다");
    }
  }

  const doneCount   = phases.filter((p) => p.status === "done").length;
  const progress    = phases.length > 0 ? Math.round((doneCount / phases.length) * 100) : 0;
  const activePhase = phases.find((p) => p.status === "active");

  const statusIcon = (s: RoadmapPhase["status"]) => {
    if (s === "done")   return <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
    if (s === "active") return <Circle size={16} className="text-nu-blue shrink-0 fill-nu-blue/20" />;
    return <Circle size={16} className="text-nu-muted/40 shrink-0" />;
  };

  const statusColor = (s: RoadmapPhase["status"]) => ({
    done:    "border-l-green-400 bg-green-50/50",
    active:  "border-l-nu-blue bg-nu-blue/5",
    pending: "border-l-transparent",
  }[s]);

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/[0.06]">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-nu-pink" />
          <h3 className="font-head text-base font-extrabold text-nu-ink">너트 로드맵</h3>
          {phases.length > 0 && (
            <span className="font-mono-nu text-[10px] text-nu-muted">{doneCount}/{phases.length} 완료</span>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-nu-muted hover:text-nu-ink">
          {collapsed ? <ChevronRight size={16} /> : <ChevronRight size={16} className="rotate-90" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-5">
          {/* Topic */}
          <div className="mb-5">
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">주제 / 목표</p>
            {editingTopic ? (
              <div className="flex gap-2">
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="이 너트의 핵심 주제나 목표를 입력하세요"
                  className="flex-1 px-3 py-2 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink"
                  autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveTopic(); }}
                />
                <button onClick={saveTopic} disabled={savingTopic}
                  className="px-3 py-2 bg-nu-ink text-nu-paper text-xs hover:bg-nu-pink transition-colors">
                  {savingTopic ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                </button>
                <button onClick={() => setEditingTopic(false)} className="px-3 py-2 border border-nu-ink/15 text-xs hover:bg-nu-cream transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <p className={`text-sm ${topic ? "text-nu-ink font-medium" : "text-nu-muted italic"}`}>
                  {topic || "주제가 설정되지 않았습니다"}
                </p>
                {canEdit && (
                  <button onClick={() => setEditingTopic(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-nu-muted hover:text-nu-pink">
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {phases.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-mono-nu text-nu-muted mb-1.5">
                <span>진행률</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-nu-ink/10 rounded-full overflow-hidden">
                <div className="h-full bg-nu-pink rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              {activePhase && (
                <p className="text-[10px] text-nu-blue mt-1.5 flex items-center gap-1">
                  <ArrowRight size={10} /> 현재: {activePhase.title}
                </p>
              )}
            </div>
          )}

          {/* Phases */}
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-10 bg-nu-cream/50" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {phases.map((phase, i) => (
                <div key={phase.id}
                  className={`border-l-[3px] px-3 py-2.5 transition-all ${statusColor(phase.status)}`}>
                  <div className="flex items-start gap-2.5 group">
                    <button onClick={() => updatePhaseStatus(phase.id, phase.status)}
                      className={`mt-0.5 shrink-0 ${canEdit ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}>
                      {statusIcon(phase.status)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-nu text-[9px] text-nu-muted">{String(i + 1).padStart(2, "0")}.</span>
                        <p className={`text-sm font-medium ${phase.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
                          {phase.title}
                        </p>
                        {phase.status === "active" && (
                          <span className="font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/15 text-nu-blue">진행중</span>
                        )}
                      </div>
                      {phase.description && (
                        <p className="text-xs text-nu-muted mt-0.5">{phase.description}</p>
                      )}

                      {/* Interactions: Likes + Comments */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <PhaseLikes phaseId={phase.id} userId={currentUserId} />
                        <PhaseComments phaseId={phase.id} userId={currentUserId} />
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => deletePhase(phase.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-nu-muted hover:text-nu-red shrink-0 mt-0.5">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add phase — available to all members */}
          <div className="mt-3">
            {addingPhase ? (
              <div className="border border-dashed border-nu-ink/20 p-3 flex flex-col gap-2">
                <input value={newPhase.title} onChange={(e) => setNewPhase((p) => ({ ...p, title: e.target.value }))}
                  placeholder="단계 제목" autoFocus
                  className="px-2 py-1.5 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink w-full"
                  onKeyDown={(e) => { if (e.key === "Enter") addPhase(); }}
                />
                <input value={newPhase.description} onChange={(e) => setNewPhase((p) => ({ ...p, description: e.target.value }))}
                  placeholder="설명 (선택)"
                  className="px-2 py-1.5 border border-nu-ink/15 bg-transparent text-xs focus:outline-none focus:border-nu-pink w-full"
                />
                <div className="flex gap-2">
                  <button onClick={addPhase} className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors">추가</button>
                  <button onClick={() => setAddingPhase(false)} className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 hover:bg-nu-cream transition-colors">취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingPhase(true)}
                className="w-full flex items-center gap-1.5 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors">
                <Plus size={12} /> 단계 추가
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
