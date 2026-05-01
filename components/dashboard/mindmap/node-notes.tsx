"use client";

import { useEffect, useState } from "react";
import { Loader2, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/**
 * 노드별 사적 메모 (스티키 노트). 마인드맵 워크스페이스 위에 붙이는 1인용 주석.
 * 도메인 댓글(너트/볼트의 코멘트)과 별개 — 그건 도메인 페이지에서.
 */
export function NodeNotes({ nodeId }: { nodeId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/mindmap/notes?node_id=${encodeURIComponent(nodeId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("load_failed")))
      .then((j: { notes: Note[] }) => setNotes(j.notes ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [nodeId]);

  async function add() {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/mindmap/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "save_failed");
      setNotes((prev) => [...(prev ?? []), json.note]);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    const prev = notes;
    setNotes((p) => (p ?? []).filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/dashboard/mindmap/notes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
    } catch {
      // 롤백
      setNotes(prev ?? []);
      toast.error("삭제 실패");
    }
  }

  return (
    <div className="border-t-[2px] border-nu-ink/10 px-4 py-3 bg-yellow-50/40 space-y-2">
      <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
        <StickyNote size={11} />
        <span>나의 메모{notes ? ` · ${notes.length}` : ""}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-1.5 text-[11px] text-nu-muted">
          <Loader2 size={11} className="animate-spin" /> 불러오는 중…
        </div>
      ) : (
        <ul className="space-y-1.5">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="bg-yellow-100/70 border-[2px] border-yellow-700/60 px-2.5 py-1.5 flex items-start gap-2">
              <p className="text-[12px] text-yellow-950 whitespace-pre-wrap break-words flex-1">{n.body}</p>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className="text-yellow-800/60 hover:text-red-700 shrink-0 p-0.5"
                aria-label="메모 삭제"
                title="메모 삭제"
              >
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5 items-stretch">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 노드에 대한 메모… (Cmd/Ctrl+Enter 로 저장)"
          rows={2}
          maxLength={2000}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          className="flex-1 px-2 py-1.5 border-[2px] border-nu-ink/30 focus:border-nu-ink outline-none text-[12px] resize-y bg-white"
          aria-label="새 메모"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!draft.trim() || submitting}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30"
        >
          {submitting ? "…" : "추가"}
        </button>
      </div>
    </div>
  );
}
