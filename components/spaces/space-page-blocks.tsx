"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, GripVertical, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { SpaceBlock, BlockType } from "./space-pages-types";
import { SLASH_COMMANDS } from "./space-pages-types";
import { SpaceBlockRenderer } from "./space-block-renderer";
import { BlockComments } from "./block-comments";

interface Props {
  pageId: string;
  /** L1 의 page.content (단일 마크다운). 블록이 0개일 때 자동으로 첫 text 블록으로 마이그레이션. */
  legacyContent?: string;
  /** mention 자동완성에 owner 정보 전달용 */
  ownerType?: "nut" | "bolt";
  ownerId?: string;
  /** 현재 사용자 id — 댓글 본인 표시 */
  currentUserId?: string;
  /** 부모(에디터)에 저장 상태 보고 — saving/saved 인디케이터 */
  onSaveStateChange?: (state: "saving" | "saved" | "idle") => void;
}

const SAVE_DEBOUNCE = 600;

/**
 * 한 페이지의 블록 리스트 — 노션 스타일 슬래시 명령 에디터.
 *
 * - 각 블록은 type 별 다른 렌더 (text/h1-3/todo/code/divider 등)
 * - "/" 입력 시 슬래시 메뉴 노출 (블록 type 선택)
 * - Enter = 새 블록 / Backspace at empty = 삭제
 * - "+" 버튼 = 블록 사이 삽입
 * - 드래그-드롭 순서 변경
 */
export function SpacePageBlocks({ pageId, legacyContent, ownerType, ownerId, currentUserId, onSaveStateChange }: Props) {
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<SpaceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 페이지 변경 시 — 블록 fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBlocks([]);
    fetch(`/api/spaces/pages/${pageId}/blocks`)
      .then((r) => r.json())
      .then(async (j: { blocks?: SpaceBlock[] }) => {
        if (cancelled) return;
        const list = j.blocks ?? [];
        // legacyContent 가 있고 블록이 비어있으면 첫 text 블록으로 자동 마이그레이션
        if (list.length === 0 && legacyContent && legacyContent.trim()) {
          const res = await fetch(`/api/spaces/pages/${pageId}/blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "text", content: legacyContent, position: 0 }),
          }).then((r) => r.json());
          if (res.block) list.push(res.block);
        }
        setBlocks(list);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageId, legacyContent]);

  const queueSave = useCallback((id: string, patch: Partial<SpaceBlock>) => {
    const prev = saveTimers.current.get(id);
    if (prev) clearTimeout(prev);
    onSaveStateChange?.("saving");
    const t = setTimeout(() => {
      fetch(`/api/spaces/blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then(() => {
          onSaveStateChange?.("saved");
          setTimeout(() => onSaveStateChange?.("idle"), 1500);
        })
        .catch(() => onSaveStateChange?.("idle"));
      saveTimers.current.delete(id);
    }, SAVE_DEBOUNCE);
    saveTimers.current.set(id, t);
  }, [onSaveStateChange]);

  const updateBlock = useCallback((id: string, patch: Partial<SpaceBlock>) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
    queueSave(id, patch);
  }, [queueSave]);

  const insertBlock = useCallback(async (type: BlockType, afterId: string | null) => {
    let position: number;
    if (afterId === null) {
      position = blocks.length > 0 ? blocks[0].position - 1 : 0;
    } else {
      const idx = blocks.findIndex((b) => b.id === afterId);
      const next = blocks[idx + 1];
      if (next) position = (blocks[idx].position + next.position) / 2;
      else position = blocks[idx].position + 1;
    }
    try {
      const res = await fetch(`/api/spaces/pages/${pageId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: "", position }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "블록 추가 실패");
      setBlocks((prev) => [...prev, json.block].sort((a, b) => a.position - b.position));
      // 새 블록에 포커스
      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${json.block.id}"] textarea, [data-block-id="${json.block.id}"] input`) as HTMLElement | null;
        el?.focus();
      }, 30);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "블록 추가 실패");
    }
  }, [pageId, blocks]);

  const deleteBlock = useCallback(async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    try {
      const res = await fetch(`/api/spaces/blocks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  }, []);

  const reorder = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setBlocks((prev) => {
      const src = prev.find((b) => b.id === sourceId);
      const tgt = prev.find((b) => b.id === targetId);
      if (!src || !tgt) return prev;
      const filtered = prev.filter((b) => b.id !== sourceId);
      const tgtIdx = filtered.findIndex((b) => b.id === targetId);
      const next = filtered[tgtIdx + 1];
      const prevBlock = filtered[tgtIdx];
      const newPos = next ? (prevBlock.position + next.position) / 2 : prevBlock.position + 1;
      const updated = { ...src, position: newPos };
      queueSave(src.id, { position: newPos });
      return [...filtered.slice(0, tgtIdx + 1), updated, ...filtered.slice(tgtIdx + 1)];
    });
  }, [queueSave]);

  if (loading) {
    return (
      <div className="px-6 py-6 text-[13px] text-nu-muted">불러오는 중…</div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4">
      {blocks.length === 0 ? (
        <div className="space-y-2">
          <div className="text-[13px] text-nu-muted">
            빈 페이지입니다. 블록을 추가해 시작하세요.
          </div>
          <BlockTypePicker onPick={(type) => insertBlock(type, null)} />
        </div>
      ) : (
        <div className="space-y-1">
          {blocks.map((b) => (
            <div
              key={b.id}
              data-block-id={b.id}
              draggable
              onDragStart={(e) => {
                setDraggingId(b.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/block-id", b.id);
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData("text/block-id");
                if (sourceId) reorder(sourceId, b.id);
                setDraggingId(null);
              }}
              onDragEnd={() => setDraggingId(null)}
              className={`group flex items-start gap-1 ${draggingId === b.id ? "opacity-40" : ""}`}
            >
              <div className="flex flex-col items-center pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing text-nu-muted hover:text-nu-ink"
                  title="드래그하여 순서 변경"
                  aria-label="블록 순서 변경"
                >
                  <GripVertical size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => insertBlock("text", b.id)}
                  className="text-nu-muted hover:text-nu-pink"
                  title="아래에 새 블록"
                  aria-label="아래에 텍스트 블록 추가"
                >
                  <Plus size={11} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <SpaceBlockRenderer
                  block={b}
                  onChange={(patch) => updateBlock(b.id, patch)}
                  onEnter={() => insertBlock("text", b.id)}
                  onBackspaceEmpty={() => deleteBlock(b.id)}
                  onSlashSelect={(type) => updateBlock(b.id, { type, content: "" })}
                  ownerType={ownerType}
                  ownerId={ownerId}
                />
                {openCommentsFor === b.id && (
                  <BlockComments blockId={b.id} currentUserId={currentUserId} />
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenCommentsFor(openCommentsFor === b.id ? null : b.id)}
                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0 ${openCommentsFor === b.id ? "text-nu-pink !opacity-100" : "text-nu-muted hover:text-nu-pink"}`}
                title="댓글"
                aria-label="블록 댓글 토글"
              >
                <MessageSquare size={11} />
              </button>
              <button
                type="button"
                onClick={() => deleteBlock(b.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-nu-muted hover:text-red-600 p-1 shrink-0"
                title="블록 삭제"
                aria-label="블록 삭제"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <div className="pt-2 opacity-0 hover:opacity-100 transition-opacity">
            <BlockTypePicker onPick={(type) => insertBlock(type, blocks[blocks.length - 1]?.id ?? null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function BlockTypePicker({ onPick }: { onPick: (type: BlockType) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SLASH_COMMANDS.map((cmd) => (
        <button
          key={cmd.type}
          type="button"
          onClick={() => onPick(cmd.type)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/20 hover:border-nu-ink hover:bg-nu-cream"
          title={cmd.sub}
        >
          + {cmd.label}
        </button>
      ))}
    </div>
  );
}
