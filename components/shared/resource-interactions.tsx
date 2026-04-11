"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Heart, MessageCircle, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  author: { id: string; nickname: string } | null;
  replies?: Comment[];
}

/**
 * Like + Comment component for resource files.
 * Works with both `project_resource` and `file_attachment` target types.
 */
export function ResourceInteractions({
  targetType,
  targetId,
  compact,
}: {
  targetType: "project_resource" | "file_attachment";
  targetId: string;
  compact?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    // Load like count + user's like status
    const [{ count: likes }, { data: myLike }] = await Promise.all([
      supabase.from("reactions").select("*", { count: "exact", head: true })
        .eq("target_type", targetType).eq("target_id", targetId),
      user ? supabase.from("reactions").select("id")
        .eq("target_type", targetType).eq("target_id", targetId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setLikeCount(likes || 0);
    setLiked(!!myLike);

    // Load comment count
    const { count: cCount } = await supabase.from("comments").select("*", { count: "exact", head: true })
      .eq("target_type", targetType).eq("target_id", targetId);
    setCommentCount(cCount || 0);
  }, [targetType, targetId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function loadComments() {
    const supabase = createClient();
    const { data } = await supabase.from("comments")
      .select("*, author:profiles!author_id(id, nickname)")
      .eq("target_type", targetType).eq("target_id", targetId)
      .is("parent_id", null)
      .order("created_at", { ascending: true });

    if (!data) return;

    // Load replies for each comment
    const withReplies: Comment[] = [];
    for (const c of data) {
      const { data: replies } = await supabase.from("comments")
        .select("*, author:profiles!author_id(id, nickname)")
        .eq("parent_id", c.id)
        .order("created_at", { ascending: true });
      withReplies.push({ ...c, replies: replies || [] } as Comment);
    }
    setComments(withReplies);
  }

  async function toggleLike() {
    if (!userId) { toast.error("로그인이 필요합니다"); return; }
    const supabase = createClient();

    if (liked) {
      await supabase.from("reactions")
        .delete().eq("target_type", targetType).eq("target_id", targetId).eq("user_id", userId);
      setLiked(false);
      setLikeCount((p) => Math.max(0, p - 1));
    } else {
      const { error } = await supabase.from("reactions").insert({
        target_type: targetType, target_id: targetId, user_id: userId, emoji: "👍",
      });
      if (error && error.code === "23505") { setLiked(true); return; } // already exists
      if (error) { toast.error("좋아요 실패"); return; }
      setLiked(true);
      setLikeCount((p) => p + 1);
    }
  }

  async function postComment(content: string, parentId?: string) {
    if (!content.trim() || !userId) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("comments").insert({
        target_type: targetType, target_id: targetId,
        author_id: userId, content: content.trim(),
        parent_id: parentId || null,
      });
      if (error) throw error;
      if (parentId) { setReplyText(""); setReplyTo(null); }
      else setNewComment("");
      setCommentCount((p) => p + 1);
      await loadComments();
      toast.success("댓글이 등록되었습니다");
    } catch (err: any) {
      toast.error(err.message || "댓글 등록 실패");
    } finally { setPosting(false); }
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간`;
    return `${Math.floor(hrs / 24)}일`;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={toggleLike}
          className={`flex items-center gap-1 text-[11px] transition-colors ${liked ? "text-red-500" : "text-nu-muted hover:text-red-400"}`}>
          <Heart size={13} fill={liked ? "currentColor" : "none"} /> {likeCount > 0 && likeCount}
        </button>
        <button onClick={() => { setShowComments(!showComments); if (!showComments) loadComments(); }}
          className="flex items-center gap-1 text-[11px] text-nu-muted hover:text-nu-ink transition-colors">
          <MessageCircle size={13} /> {commentCount > 0 && commentCount}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {/* Action buttons */}
      <div className="flex items-center gap-4 py-2">
        <button onClick={toggleLike}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${liked ? "text-red-500" : "text-nu-muted hover:text-red-400"}`}>
          <Heart size={14} fill={liked ? "currentColor" : "none"} />
          {likeCount > 0 ? `좋아요 ${likeCount}` : "좋아요"}
        </button>
        <button onClick={() => { setShowComments(!showComments); if (!showComments) loadComments(); }}
          className="flex items-center gap-1.5 text-xs font-medium text-nu-muted hover:text-nu-ink transition-colors">
          <MessageCircle size={14} />
          {commentCount > 0 ? `댓글 ${commentCount}` : "댓글"}
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-nu-ink/[0.06] pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Comment list */}
          {comments.map((c) => (
            <div key={c.id}>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[9px] font-bold shrink-0 mt-0.5">
                  {(c.author?.nickname || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">{c.author?.nickname}</span>
                    <span className="text-[9px] text-nu-muted">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-nu-graphite mt-0.5 leading-relaxed">{c.content}</p>
                  <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                    className="text-[9px] text-nu-muted hover:text-nu-pink mt-1 font-medium">
                    답글
                  </button>
                </div>
              </div>

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="ml-8 mt-2 space-y-2 border-l-2 border-nu-ink/5 pl-3">
                  {c.replies.map((r) => (
                    <div key={r.id} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center font-head text-[8px] font-bold shrink-0 mt-0.5">
                        {(r.author?.nickname || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold">{r.author?.nickname}</span>
                          <span className="text-[8px] text-nu-muted">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-nu-graphite mt-0.5">{r.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {replyTo === c.id && (
                <div className="ml-8 mt-2 flex gap-2">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder="답글 입력..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(replyText, c.id); } }}
                    className="flex-1 h-7 px-2 bg-nu-cream/30 border border-nu-ink/10 text-[10px] focus:outline-none focus:border-nu-pink" />
                  <button onClick={() => postComment(replyText, c.id)} disabled={posting || !replyText.trim()}
                    className="px-2 h-7 bg-nu-ink text-white text-[9px] disabled:opacity-40"><Send size={10} /></button>
                </div>
              )}
            </div>
          ))}

          {/* New comment form */}
          {userId && (
            <div className="flex gap-2 pt-1">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글 입력..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(newComment); } }}
                className="flex-1 h-8 px-3 bg-nu-cream/20 border border-nu-ink/10 text-xs focus:outline-none focus:border-nu-pink" />
              <button onClick={() => postComment(newComment)} disabled={posting || !newComment.trim()}
                className="px-3 h-8 bg-nu-pink text-white font-mono-nu text-[9px] uppercase tracking-widest disabled:opacity-40 flex items-center gap-1">
                {posting ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} 등록
              </button>
            </div>
          )}

          {comments.length === 0 && !userId && (
            <p className="text-[10px] text-nu-muted text-center py-2">로그인하면 댓글을 남길 수 있습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
