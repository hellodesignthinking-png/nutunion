"use client";

import { useEffect, useState } from "react";
import { X, Layers, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Snippet {
  id: string;
  title: string;
  icon: string | null;
  blocks: Array<{ type: string; content: string; data: Record<string, unknown> }>;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 현재 편집 중인 페이지 — 스니펫 삽입 대상. */
  currentPageId: string | null;
}

/**
 * 스니펫 패널 — 자주 쓰는 블록 묶음을 저장하고 다른 페이지에 빠르게 삽입.
 *
 * - 본인 스니펫만 보임 (RLS).
 * - 현재 페이지의 모든 블록을 한 번에 스니펫으로 저장.
 * - 스니펫 클릭 → 현재 페이지 끝에 삽입.
 */
export function SnippetsPanel({ open, onClose, currentPageId }: Props) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inserting, setInserting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/spaces/snippets")
      .then((r) => r.json())
      .then((j: { snippets: Snippet[] }) => setSnippets(j.snippets ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open]);

  async function saveCurrentPage() {
    if (!currentPageId) {
      toast.error("저장할 페이지를 먼저 선택하세요");
      return;
    }
    setSaving(true);
    try {
      // 현재 페이지의 블록 fetch
      const r = await fetch(`/api/spaces/pages/${currentPageId}/blocks`);
      const j = await r.json();
      const blocks = (j.blocks ?? []) as Array<{ type: string; content: string; data: Record<string, unknown> }>;
      if (blocks.length === 0) {
        toast.error("저장할 블록이 없어요");
        return;
      }
      const title = window.prompt("스니펫 제목", "스니펫");
      if (!title) return;
      const blocksClean = blocks.map((b) => ({ type: b.type, content: b.content, data: b.data }));
      const res = await fetch("/api/spaces/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks: blocksClean }),
      });
      const sj = await res.json();
      if (!res.ok) throw new Error(sj?.error || "저장 실패");
      setSnippets((prev) => [sj.snippet, ...prev]);
      toast.success(`스니펫 "${title}" 저장됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function insertSnippet(snippet: Snippet) {
    if (!currentPageId) {
      toast.error("삽입할 페이지를 먼저 선택하세요");
      return;
    }
    setInserting(snippet.id);
    try {
      // 각 블록을 순차 POST — position 은 서버가 마지막+1 로 자동
      for (const b of snippet.blocks) {
        await fetch(`/api/spaces/pages/${currentPageId}/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: b.type, content: b.content, data: b.data }),
        });
      }
      toast.success(`${snippet.blocks.length}개 블록 삽입 — 페이지 새로고침 필요`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삽입 실패");
    } finally {
      setInserting(null);
    }
  }

  async function remove(id: string) {
    const ok = window.confirm("이 스니펫을 삭제할까요?");
    if (!ok) return;
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/spaces/snippets/${id}`, { method: "DELETE" });
    } catch {
      toast.error("삭제 실패");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink flex items-center gap-1.5">
            <Layers size={11} /> 스니펫
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="px-3 py-2 border-b-[2px] border-nu-ink/10 bg-nu-cream/30">
          <button
            type="button"
            onClick={saveCurrentPage}
            disabled={saving || !currentPageId}
            className="w-full font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            현재 페이지 → 새 스니펫
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {loading ? (
            <div className="px-2 py-4 flex items-center gap-1.5 text-[12px] text-nu-muted justify-center">
              <Loader2 size={12} className="animate-spin" /> 불러오는 중…
            </div>
          ) : snippets.length === 0 ? (
            <div className="px-2 py-4 text-[12px] text-nu-muted text-center">
              저장된 스니펫 없음
            </div>
          ) : (
            snippets.map((s) => (
              <div key={s.id} className="border-[2px] border-nu-ink/15 bg-white px-2 py-1.5 flex items-start gap-2 hover:border-nu-ink">
                <span className="text-[16px]">{s.icon || "🧩"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-nu-ink truncate">{s.title}</div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5">
                    블록 {s.blocks.length}개
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => insertSnippet(s)}
                    disabled={inserting === s.id || !currentPageId}
                    className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30"
                    title="현재 페이지에 삽입"
                  >
                    {inserting === s.id ? "…" : "삽입"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="p-0.5 text-nu-muted hover:text-red-600"
                    title="삭제"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
