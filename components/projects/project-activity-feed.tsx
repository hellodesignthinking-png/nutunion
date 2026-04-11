"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send, Loader2, MessageSquare, Milestone, RefreshCw, UserPlus, Filter, Hash, ChevronDown } from "lucide-react";
import type { ProjectUpdate } from "@/lib/types";
import { ReactionsBar } from "@/components/community/reactions-bar";
import { CommentThread } from "@/components/community/comment-thread";
import { FileUploadButton, AttachedFiles } from "@/components/community/file-upload-button";

const updateTypes = [
  { key: "all", label: "전체" },
  { key: "post", label: "포스트" },
  { key: "milestone_update", label: "마일스톤" },
  { key: "status_change", label: "상태 변경" },
] as const;

const typeIcons: Record<string, { icon: typeof MessageSquare; color: string; label: string }> = {
  post:             { icon: MessageSquare, color: "bg-nu-blue/10 text-nu-blue",    label: "포스트"    },
  milestone_update: { icon: Milestone,     color: "bg-nu-yellow/10 text-nu-amber", label: "마일스톤"  },
  status_change:    { icon: RefreshCw,     color: "bg-nu-pink/10 text-nu-pink",    label: "상태 변경" },
  member_joined:    { icon: UserPlus,      color: "bg-green-50 text-green-600",    label: "멤버 참여" },
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

export function ProjectActivityFeed({
  projectId,
  initialUpdates,
  canPost,
  userId,
}: {
  projectId: string;
  initialUpdates: ProjectUpdate[];
  canPost: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [updates, setUpdates] = useState<ProjectUpdate[]>(initialUpdates);
  const [loading, setLoading]   = useState(true);
  const [content, setContent]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [milestones, setMilestones] = useState<{ id: string; title: string }[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string>("");
  const [showMsSelect, setShowMsSelect] = useState(false);

  // ── 마운트 시 DB에서 업데이트 로드 ─────────────────────────────────
  const loadUpdates = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_updates")
      .select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setUpdates(data as any);
    } else {
      // Fallback without author join
      const { data: basicData } = await supabase
        .from("project_updates")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (basicData) setUpdates(basicData as any);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadUpdates();
    // Fetch milestones for tagging
    const supabase = createClient();
    supabase.from("project_milestones").select("id, title").eq("project_id", projectId).order("sort_order")
      .then(({ data }) => { if (data) setMilestones(data); });
    // ── 실시간 구독 ─────────────────────────────────────────────────
    const channel = supabase
      .channel(`project-updates-${projectId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "project_updates",
        filter: `project_id=eq.${projectId}`,
      }, () => { loadUpdates(); })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "project_updates",
        filter: `project_id=eq.${projectId}`,
      }, () => { loadUpdates(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, loadUpdates]);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const metadata: Record<string, any> = {};
      if (selectedMilestone) {
        const ms = milestones.find((m) => m.id === selectedMilestone);
        metadata.milestone_id = selectedMilestone;
        metadata.milestone_title = ms?.title;
      }
      const insertRes = await supabase
        .from("project_updates")
        .insert({ project_id: projectId, author_id: userId, content: content.trim(), type: selectedMilestone ? "milestone_update" : "post", metadata })
        .select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
        .single();
      if (insertRes.error) {
        // Retry without author join
        const { data: basicData, error: basicError } = await supabase
          .from("project_updates")
          .insert({ project_id: projectId, author_id: userId, content: content.trim(), type: selectedMilestone ? "milestone_update" : "post", metadata })
          .select("*")
          .single();
        if (basicError) throw basicError;
        setUpdates((prev) => [basicData, ...prev]);
      } else {
        setUpdates((prev) => [insertRes.data, ...prev]);
      }
      setContent("");
      setSelectedMilestone("");
      toast.success("글이 게시되었습니다");
    } catch (err: any) {
      toast.error(err.message || "게시 실패");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* 로드 중 스켈레톤 */}
      {loading && (
        <div className="space-y-3 mb-6">
          {[1,2].map(i => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.08] p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-nu-ink/8" />
                <div className="flex-1"><div className="h-4 bg-nu-ink/8 w-24 mb-2" /><div className="h-12 bg-nu-ink/5" /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post form */}
      {canPost && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-5 mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="프로젝트에 대한 업데이트를 공유하세요..."
            rows={3}
            className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.08] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none mb-3"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FileUploadButton targetType="project_update" targetId={projectId} userId={userId} />
              {/* Milestone tag */}
              {milestones.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowMsSelect(!showMsSelect)}
                    className={`font-mono-nu text-[9px] uppercase tracking-widest px-3 py-1.5 border transition-colors flex items-center gap-1 ${
                      selectedMilestone ? "border-nu-pink bg-nu-pink/10 text-nu-pink" : "border-nu-ink/15 text-nu-muted hover:text-nu-ink"
                    }`}>
                    <Hash size={10} />
                    {selectedMilestone ? milestones.find((m) => m.id === selectedMilestone)?.title : "마일스톤 태그"}
                    <ChevronDown size={10} />
                  </button>
                  {showMsSelect && (
                    <div className="absolute top-full left-0 mt-1 bg-nu-white border-2 border-nu-ink/10 shadow-lg z-20 min-w-[200px]">
                      <button onClick={() => { setSelectedMilestone(""); setShowMsSelect(false); }}
                        className="w-full text-left px-3 py-2 text-[11px] text-nu-muted hover:bg-nu-cream/30 transition-colors">
                        태그 없음
                      </button>
                      {milestones.map((ms) => (
                        <button key={ms.id} onClick={() => { setSelectedMilestone(ms.id); setShowMsSelect(false); }}
                          className={`w-full text-left px-3 py-2 text-[11px] hover:bg-nu-cream/30 transition-colors ${
                            selectedMilestone === ms.id ? "text-nu-pink font-bold" : "text-nu-ink"
                          }`}>
                          {ms.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={handlePost} disabled={posting || !content.trim()}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              게시
            </button>
          </div>
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={12} className="text-nu-muted" />
        {updateTypes.map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`font-mono-nu text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
              typeFilter === t.key
                ? "border-nu-pink bg-nu-pink/10 text-nu-pink"
                : "border-nu-ink/10 text-nu-muted hover:text-nu-ink hover:border-nu-ink/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed items */}
      <div className="space-y-4">
        {(typeFilter !== "all" ? updates.filter((u) => u.type === typeFilter) : updates).map((update) => {
          const typeInfo = typeIcons[update.type] || typeIcons.post;
          const Icon = typeInfo.icon;
          const milestoneTitle = (update.metadata as any)?.milestone_title;
          return (
            <div key={update.id} className="bg-nu-white border border-nu-ink/[0.08] p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold text-nu-ink shrink-0">
                  {(update.author?.nickname || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">{update.author?.nickname || "Unknown"}</span>
                    <span className={`inline-flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 ${typeInfo.color}`}>
                      <Icon size={9} /> {typeInfo.label}
                    </span>
                    {milestoneTitle && (
                      <span className="inline-flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 bg-nu-yellow/10 text-nu-amber">
                        <Hash size={8} /> {milestoneTitle}
                      </span>
                    )}
                    <span className="font-mono-nu text-[10px] text-nu-muted">{timeAgo(update.created_at)}</span>
                  </div>
                  <p className="text-sm text-nu-graphite leading-relaxed whitespace-pre-wrap">{update.content}</p>
                  <AttachedFiles targetType="project_update" targetId={update.id} />
                  <ReactionsBar targetType="project_update" targetId={update.id} userId={userId} />
                  <CommentThread targetType="project_update" targetId={update.id} userId={userId} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && updates.length === 0 && (
        <div className="text-center py-12 bg-nu-white border border-nu-ink/[0.08]">
          <p className="text-nu-gray text-sm">아직 활동이 없습니다</p>
        </div>
      )}
    </div>
  );
}
