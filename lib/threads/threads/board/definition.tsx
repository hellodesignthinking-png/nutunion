"use client";
import { useEffect, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

const REACTIONS = ["👍", "❤️", "🎉"] as const;

interface BoardPost {
  title: string;
  body: string;
  pinned?: boolean;
  reactions?: Record<string, string[]>; // emoji -> user_ids
  parent_id?: string | null; // null/absent = top-level post; set = comment
}

function BoardComponent({ installation, canEdit, currentUserId }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 100 });
      setRows(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installation.id]);

  const posts = rows
    .filter((r) => !(r.data as BoardPost)?.parent_id)
    .sort((a, b) => {
      const ap = (a.data as BoardPost).pinned ? 1 : 0;
      const bp = (b.data as BoardPost).pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const commentsFor = (postId: string) =>
    rows.filter((r) => (r.data as BoardPost)?.parent_id === postId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await createThreadData(installation.id, { title: title.trim(), body: body.trim(), pinned, reactions: {} });
      setTitle(""); setBody(""); setPinned(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReaction = async (row: ThreadDataRow, emoji: string) => {
    const data = row.data as BoardPost;
    const reactions = { ...(data.reactions || {}) };
    const list = reactions[emoji] || [];
    const idx = list.indexOf(currentUserId);
    if (idx >= 0) list.splice(idx, 1); else list.push(currentUserId);
    reactions[emoji] = list;
    try {
      await updateThreadData(row.id, { ...data, reactions });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const submitComment = async (postId: string) => {
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    try {
      await createThreadData(installation.id, { body: text, parent_id: postId, title: "" });
      setCommentText({ ...commentText, [postId]: "" });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const removeRow = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">📋 게시판</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{posts.length} posts</span>
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {canEdit && (
        <form onSubmit={submitPost} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            maxLength={200}
            className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용 (markdown 지원 예정)"
            rows={3}
            className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-[11px] font-mono">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              📌 고정
            </label>
            <button
              disabled={submitting}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition disabled:opacity-50"
            >
              {submitting ? "..." : "+ 작성"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : posts.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">아직 게시글이 없어요.</div>
      ) : (
        <ul className="space-y-3">
          {posts.map((row) => {
            const post = row.data as BoardPost;
            const comments = commentsFor(row.id);
            const isOwner = row.created_by === currentUserId;
            return (
              <li key={row.id} className="border-[2px] border-nu-ink p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-head text-base font-bold text-nu-ink">
                      {post.pinned && <span className="mr-1">📌</span>}
                      {post.title}
                    </h4>
                    <p className="text-sm text-nu-ink/80 whitespace-pre-wrap mt-1">{post.body}</p>
                    <div className="text-[10px] font-mono text-nu-muted mt-1">
                      {new Date(row.created_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  {isOwner && (
                    <button onClick={() => removeRow(row.id)} className="text-[10px] font-mono text-nu-muted hover:text-nu-pink">
                      삭제
                    </button>
                  )}
                </div>
                <div className="flex gap-1 mt-2">
                  {REACTIONS.map((emoji) => {
                    const users = post.reactions?.[emoji] || [];
                    const mine = users.includes(currentUserId);
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(row, emoji)}
                        className={`text-[11px] font-mono border-[2px] px-2 py-0.5 ${mine ? "border-nu-pink bg-nu-pink/10" : "border-nu-ink/30 bg-white"}`}
                      >
                        {emoji} {users.length || ""}
                      </button>
                    );
                  })}
                </div>
                {comments.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l-[2px] border-nu-ink/20 pl-2">
                    {comments.map((c) => (
                      <li key={c.id} className="text-[12px] font-mono text-nu-ink/80">
                        <span className="text-nu-muted">↳</span> {(c.data as BoardPost).body}
                        {c.created_by === currentUserId && (
                          <button onClick={() => removeRow(c.id)} className="ml-2 text-[10px] text-nu-muted hover:text-nu-pink">삭제</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1 mt-2">
                  <input
                    value={commentText[row.id] || ""}
                    onChange={(e) => setCommentText({ ...commentText, [row.id]: e.target.value })}
                    placeholder="댓글..."
                    className="flex-1 border-[2px] border-nu-ink/30 px-2 py-0.5 text-[11px] font-mono"
                  />
                  <button
                    onClick={() => submitComment(row.id)}
                    className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

registry.register({
  slug: "board",
  name: "📋 게시판",
  description: "공지·토론·자유 글쓰기. 고정·반응·댓글 지원.",
  icon: "📋",
  category: "communication",
  scope: ["nut"],
  schema: {
    type: "object",
    properties: {
      title: { type: "string", maxLength: 200 },
      body: { type: "string" },
      pinned: { type: "boolean", default: false },
    },
    required: ["title", "body"],
  },
  Component: BoardComponent,
  isCore: true,
  version: "1.0.0",
});
