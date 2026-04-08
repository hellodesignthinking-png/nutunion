"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Send, Loader2, MessageSquare, Megaphone, Calendar, Trash2, FolderOpen, Sparkles, CheckCircle2, User, Award, Zap, Lightbulb, Users } from "lucide-react";
import type { CrewPost } from "@/lib/types";
import { ReactionsBar } from "@/components/community/reactions-bar";
import { CommentThread } from "@/components/community/comment-thread";
import { FileUploadButton, AttachedFiles } from "@/components/community/file-upload-button";

const typeIcons: Record<string, { icon: any; color: string; label: string; bgColor: string }> = {
  post: { icon: MessageSquare, color: "text-nu-blue", bgColor: "bg-nu-blue/5", label: "POST" },
  announcement: { icon: Megaphone, color: "text-nu-pink", bgColor: "bg-nu-pink/5", label: "NOTICE" },
  event_recap: { icon: Calendar, color: "text-nu-amber", bgColor: "bg-nu-amber/5", label: "RECAP" },
  system: { icon: Zap, color: "text-nu-ink", bgColor: "bg-nu-cream/50", label: "ACTIVITY" },
};

const userBadges: Record<string, { label: string; icon: any; color: string }[]> = {
  "홍길동": [{ label: "정리의 달인", icon: <Award size={10} />, color: "bg-blue-100 text-blue-600" }],
  "김철수": [{ label: "아이디어 뱅크", icon: <Lightbulb size={10} />, color: "bg-amber-100 text-amber-600" }],
  "이영희": [{ label: "최고의 서기", icon: <Award size={10} />, color: "bg-pink-100 text-pink-600" }],
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko");
}

export function CrewActivityFeed({
  groupId,
  initialPosts,
  canPost,
  userId,
  isHost,
  isAdmin,
}: {
  groupId: string;
  initialPosts: CrewPost[];
  canPost: boolean;
  userId: string;
  isHost: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<CrewPost[]>(initialPosts);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [showDriveInput, setShowDriveInput] = useState(false);

  // ── 마운트 시 DB에서 게시글 로드 (새로고침 후에도 유지) ─────────
  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("crew_posts")
      .select("*, author:profiles!crew_posts_author_id_fkey(id, nickname, avatar_url)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setPosts(data as any);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadPosts();
    // ── 실시간 구독 ────────────────────────────────
    const supabase = createClient();
    const channel = supabase
      .channel(`crew-posts-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "crew_posts",
        filter: `group_id=eq.${groupId}`,
      }, () => { loadPosts(); })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "crew_posts",
        filter: `group_id=eq.${groupId}`,
      }, () => { loadPosts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadPosts]);

  async function handlePost() {
    if (!content.trim() && !driveLink.trim()) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const fullContent = driveLink.trim()
        ? `${content.trim()}\n\n📁 Google Drive: ${driveLink.trim()}`
        : content.trim();

      const { data, error } = await supabase
        .from("crew_posts")
        .insert({
          group_id: groupId,
          author_id: userId,
          content: fullContent,
          type: "post",
          metadata: driveLink.trim() ? { drive_url: driveLink.trim() } : {},
        })
        .select(
          "*, author:profiles!crew_posts_author_id_fkey(id, nickname, avatar_url)"
        )
        .single();

      if (error) throw error;

      setPosts((prev) => [data, ...prev]);
      setContent("");
      setDriveLink("");
      setShowDriveInput(false);
      toast.success("글이 게시되었습니다");
    } catch (err: any) {
      toast.error(err.message || "게시 실패");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("이 글을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("crew_posts")
      .delete()
      .eq("id", postId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast.success("글이 삭제되었습니다");
  }

  function canDelete(post: CrewPost) {
    return post.author_id === userId || isHost || isAdmin;
  }

  return (
    <div className="max-w-2xl">
      {/* 로드 중 */}
      {loading && (
        <div className="space-y-3 mb-6">
          {[1,2,3].map(i => (
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
            placeholder="크루에게 공유할 내용을 작성하세요..."
            rows={3}
            className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.08] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none mb-3"
          />
          {showDriveInput && (
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen size={14} className="text-nu-blue shrink-0" />
              <input
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="Google Drive 링크를 붙여넣으세요"
                className="flex-1 px-3 py-1.5 bg-nu-paper border border-nu-ink/[0.08] text-xs focus:outline-none focus:border-nu-blue transition-colors"
              />
              <button onClick={() => { setShowDriveInput(false); setDriveLink(""); }} className="text-nu-muted hover:text-nu-ink text-xs">✕</button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <FileUploadButton targetType="crew_post" targetId={groupId} userId={userId} />
              <button
                onClick={() => setShowDriveInput(!showDriveInput)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-nu-muted hover:text-nu-blue hover:bg-nu-blue/5 transition-colors font-mono-nu text-[10px]"
              >
                <FolderOpen size={12} />
                Drive 링크
              </button>
            </div>
            <button
              onClick={handlePost}
              disabled={posting || (!content.trim() && !driveLink.trim())}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              게시
            </button>
          </div>
        </div>
      )}

      {/* Feed items */}
      <div className="space-y-4">
        {posts.map((post) => {
          const isSystem = post.type === "system" || post.content.startsWith("SYSTEM:");
          const typeInfo = isSystem ? typeIcons.system : (typeIcons[post.type] || typeIcons.post);
          const Icon = typeInfo.icon;
          const badges = userBadges[post.author?.nickname || ""] || [];

          return (
            <div
              key={post.id}
              className={`group transition-all duration-500 border-2 active:scale-[0.99] ${
                isSystem 
                ? "bg-nu-paper/30 border-dashed border-nu-ink/10 p-4" 
                : "bg-nu-white border-nu-ink/[0.08] p-6 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Author avatar */}
                <div className={`relative shrink-0`}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-head text-sm font-black border-2 transition-transform group-hover:rotate-6 ${
                     isSystem ? "bg-nu-white border-nu-ink/5 text-nu-muted" : "bg-nu-cream border-nu-ink/10 text-nu-ink"
                   }`}>
                      {(post.author?.nickname || "U").charAt(0).toUpperCase()}
                   </div>
                   {!isSystem && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-nu-pink rounded-full border-2 border-nu-white flex items-center justify-center text-[8px] text-white">
                      <Sparkles size={8} />
                   </div>}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-bold text-nu-ink">
                      {isSystem ? "Community Discovery" : (post.author?.nickname || "Manager")}
                    </span>
                    
                    {/* Badges */}
                    {!isSystem && badges.map((b, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${b.color}`}>
                        {b.icon} {b.label}
                      </span>
                    ))}

                    <span className={`inline-flex items-center gap-1 font-mono-nu text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded ${typeInfo.bgColor} ${typeInfo.color}`}>
                      <Icon size={9} />
                      {typeInfo.label}
                    </span>
                    <span className="font-mono-nu text-[9px] text-nu-muted/60">
                      {timeAgo(post.created_at)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className={`text-sm leading-relaxed ${isSystem ? "text-nu-muted italic font-medium" : "text-nu-graphite font-medium"} whitespace-pre-wrap`}>
                    {post.content.replace("SYSTEM:", "").split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                      /^https?:\/\//.test(part) ? (
                        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-nu-blue hover:text-nu-pink no-underline font-bold inline-flex items-center gap-1 border-b-[2px] border-nu-blue/10 hover:border-nu-pink/30 pb-0.5 transition-all">
                          {part.includes("drive.google.com") && <FolderOpen size={13} className="shrink-0" />}
                          {part.includes("notion.so") && <span className="shrink-0">📄</span>}
                          {part.includes("github.com") && <span className="shrink-0">🐙</span>}
                          LINK REFERENCE
                        </a>
                      ) : part
                    )}
                  </div>

                  {/* System Context Footer */}
                  {isSystem && (
                    <div className="mt-3 py-1.5 px-3 bg-nu-ink/5 border-l-2 border-nu-ink/20 inline-flex items-center gap-2">
                       <Zap size={10} className="text-nu-ink/40" />
                       <span className="font-mono-nu text-[8px] text-nu-ink/40 uppercase tracking-widest">Autonomous Activity Log</span>
                    </div>
                  )}

                  {!isSystem && (
                    <>
                      {/* Attached files */}
                      <AttachedFiles targetType="crew_post" targetId={post.id} />

                      {/* Reactions & Interaction Bar */}
                      <div className="mt-4 pt-4 border-t border-nu-ink/5">
                        <ReactionsBar targetType="crew_post" targetId={post.id} userId={userId} />
                        <CommentThread targetType="crew_post" targetId={post.id} userId={userId} />
                      </div>
                    </>
                  )}
                </div>

                {/* Delete button */}
                {canDelete(post) && !isSystem && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-nu-muted/40 hover:text-nu-red transition-all p-1.5 opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 bg-nu-white border border-nu-ink/[0.08]">
          <p className="text-nu-gray text-sm">아직 활동이 없습니다</p>
        </div>
      )}
    </div>
  );
}
