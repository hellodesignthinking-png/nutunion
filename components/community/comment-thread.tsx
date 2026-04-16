"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import type { Comment } from "@/lib/types";

interface CommentThreadProps {
  targetType: "project_update" | "crew_post";
  targetId: string;
  userId: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function CommentThread({ targetType, targetId, userId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    loadComments();
  }, [targetId]);

  async function loadComments() {
    const supabase = createClient();
    const { data, count: total } = await supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(nickname, avatar_url)", { count: "exact" })
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true });
    setComments((data as any[]) || []);
    setCount(total || 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      target_type: targetType,
      target_id: targetId,
      author_id: userId,
      content: input.trim(),
    });

    if (error) { toast.error("댓글 작성 실패"); }
    else { setInput(""); loadComments(); }
    setLoading(false);
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient();
    await supabase.from("comments").delete().eq("id", commentId);
    loadComments();
  }

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-nu-muted hover:text-nu-pink transition-colors font-mono-nu text-[12px]"
      >
        <MessageSquare size={12} />
        {count > 0 ? `댓글 ${count}개` : "댓글"}
      </button>

      {expanded && (
        <div className="mt-2 ml-4 border-l-2 border-nu-ink/[0.06] pl-4">
          {/* Comments list */}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 mb-3 group">
              <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[11px] font-bold text-nu-ink shrink-0">
                {((c.author as any)?.nickname || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-nu text-[12px] font-bold text-nu-graphite">
                    {(c.author as any)?.nickname || "익명"}
                  </span>
                  <span className="font-mono-nu text-[10px] text-nu-muted">
                    {timeAgo(c.created_at)}
                  </span>
                  {c.author_id === userId && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-nu-muted hover:text-nu-red"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-nu-graphite leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}

          {/* Comment form */}
          <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="댓글 작성..."
              className="flex-1 text-xs bg-nu-cream/30 border border-nu-ink/[0.06] px-3 py-1.5 focus:outline-none focus:border-nu-pink/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-1.5 text-nu-muted hover:text-nu-pink disabled:opacity-30 transition-colors"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
