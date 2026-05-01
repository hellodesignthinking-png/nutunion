"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Check, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  body: string;
  author_id: string;
  resolved_at: string | null;
  created_at: string;
  profiles: { nickname: string; avatar_url: string | null } | null;
}

interface Props {
  blockId: string;
  currentUserId?: string;
  onCountChange?: (n: number) => void;
}

/**
 * 블록별 댓글 — 노션의 페이지-수준 댓글보다 한 단계 깊은 단위 (블록).
 * 호버 시 작은 말풍선 아이콘 (개수) → 클릭하면 펼침.
 */
export function BlockComments({ blockId, currentUserId, onCountChange }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spaces/blocks/${blockId}/comments`)
      .then((r) => r.json())
      .then((j: { comments: Comment[] }) => {
        setComments(j.comments ?? []);
        onCountChange?.((j.comments ?? []).filter((c) => !c.resolved_at).length);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/spaces/blocks/${blockId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "댓글 작성 실패");
      const next = [...comments, json.comment];
      setComments(next);
      onCountChange?.(next.filter((c) => !c.resolved_at).length);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "댓글 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleResolve(id: string, resolved: boolean) {
    const prev = comments;
    setComments((cs) => cs.map((c) => c.id === id ? { ...c, resolved_at: resolved ? new Date().toISOString() : null } : c));
    try {
      const res = await fetch(`/api/spaces/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) throw new Error();
      const next = prev.map((c) => c.id === id ? { ...c, resolved_at: resolved ? new Date().toISOString() : null } : c);
      onCountChange?.(next.filter((c) => !c.resolved_at).length);
    } catch {
      setComments(prev);
      toast.error("상태 변경 실패");
    }
  }

  async function remove(id: string) {
    const prev = comments;
    const next = prev.filter((c) => c.id !== id);
    setComments(next);
    onCountChange?.(next.filter((c) => !c.resolved_at).length);
    try {
      const res = await fetch(`/api/spaces/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setComments(prev);
      toast.error("삭제 실패");
    }
  }

  return (
    <div className="border-l-[3px] border-nu-pink/40 bg-yellow-50/40 px-2 py-1.5 my-1 space-y-1.5">
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center gap-1">
        <MessageSquare size={10} /> 댓글
        {loading && <Loader2 size={9} className="animate-spin" />}
      </div>
      {comments.length === 0 && !loading && (
        <div className="text-[11px] text-nu-muted italic">아직 댓글 없음</div>
      )}
      <ul className="space-y-1">
        {comments.map((c) => {
          const resolved = !!c.resolved_at;
          const isMine = currentUserId && c.author_id === currentUserId;
          return (
            <li key={c.id} className={`bg-white border border-nu-ink/15 px-2 py-1 ${resolved ? "opacity-50 line-through" : ""}`}>
              <div className="flex items-start gap-2">
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink shrink-0 mt-0.5">
                  {c.profiles?.nickname || "익명"}
                </span>
                <p className="flex-1 text-[12px] text-nu-ink whitespace-pre-wrap break-words">{c.body}</p>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleResolve(c.id, !resolved)}
                    className="p-0.5 text-nu-muted hover:text-emerald-700"
                    title={resolved ? "다시 열기" : "해결됨으로 표시"}
                  >
                    <Check size={10} />
                  </button>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="p-0.5 text-nu-muted hover:text-red-600"
                      title="삭제"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { e.preventDefault(); void add(); } }}
          placeholder="댓글 추가… (Enter)"
          maxLength={2000}
          className="flex-1 px-1.5 py-0.5 text-[11px] border border-nu-ink/20 focus:border-nu-ink outline-none bg-white"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!draft.trim() || submitting}
          className="font-mono-nu text-[9px] uppercase tracking-widest px-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30"
        >
          작성
        </button>
      </div>
    </div>
  );
}
