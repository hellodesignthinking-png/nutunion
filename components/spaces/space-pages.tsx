"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import type { SpacePage } from "./space-pages-types";
import { SpacePageTreeNode } from "./space-page-tree-node";
import { SpacePageEditor } from "./space-page-editor";

interface Props {
  ownerType: "nut" | "bolt";
  ownerId: string;
  /** 사용자 닉네임 — created_by 표시 등 */
  currentUserId?: string;
}

/**
 * 노션 스타일 자유 페이지 관리자.
 *
 * - 좌측: 페이지 트리 (사이드바). 제목·아이콘 인라인 편집, "+" 자식 추가, ⋯ 메뉴.
 * - 우측: 선택된 페이지 에디터 (블록 기반 — text/h1-3/todo/code 등 슬래시 명령).
 * - 모든 멤버가 추가/편집/삭제 가능 (RLS).
 */
export function SpacePages({ ownerType, ownerId }: Props) {
  const [pages, setPages] = useState<SpacePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/pages`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "로드 실패");
      setPages(json.pages || []);
      // 선택 페이지가 없거나 삭제됐으면 첫 root 페이지 선택
      const list = (json.pages || []) as SpacePage[];
      if (list.length > 0 && (!selectedId || !list.find((p) => p.id === selectedId))) {
        const firstRoot = list.find((p) => p.parent_page_id === null) || list[0];
        setSelectedId(firstRoot.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, SpacePage[]>();
    for (const p of pages) {
      const arr = byParent.get(p.parent_page_id) ?? [];
      arr.push(p);
      byParent.set(p.parent_page_id, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    }
    return byParent;
  }, [pages]);

  const selected = useMemo(() => pages.find((p) => p.id === selectedId) ?? null, [pages, selectedId]);

  const addPage = useCallback(async (parentId: string | null) => {
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_page_id: parentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "생성 실패");
      setPages((prev) => [...prev, json.page]);
      setSelectedId(json.page.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "페이지 생성 실패");
    }
  }, [ownerType, ownerId]);

  const updatePage = useCallback(async (id: string, patch: Partial<Pick<SpacePage, "title" | "icon" | "content" | "parent_page_id" | "position">>) => {
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    try {
      const res = await fetch(`/api/spaces/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "저장 실패");
      // 서버 응답으로 동기화 (updated_at 등)
      setPages((prev) => prev.map((p) => p.id === id ? { ...p, ...json.page } : p));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
      // 롤백 — 원본 다시 가져오기
      load();
    }
  }, [load]);

  const deletePage = useCallback(async (id: string) => {
    const target = pages.find((p) => p.id === id);
    if (!target) return;
    const childCount = pages.filter((p) => p.parent_page_id === id).length;
    if (childCount > 0) {
      const ok = window.confirm(`이 페이지에 하위 페이지 ${childCount}개가 있어요. 모두 함께 삭제할까요?`);
      if (!ok) return;
    } else {
      const ok = window.confirm(`"${target.title}" 페이지를 삭제할까요?`);
      if (!ok) return;
    }
    setPages((prev) => {
      // 자손 모두 제거
      const toRemove = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        for (const p of prev) {
          if (p.parent_page_id && toRemove.has(p.parent_page_id) && !toRemove.has(p.id)) {
            toRemove.add(p.id);
            added = true;
          }
        }
      }
      return prev.filter((p) => !toRemove.has(p.id));
    });
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/spaces/pages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "삭제 실패");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
      load();
    }
  }, [pages, selectedId, load]);

  return (
    <div className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14] flex flex-col md:flex-row" style={{ minHeight: 480 }}>
      {/* 사이드바 — 페이지 트리 */}
      <aside className="md:w-[280px] shrink-0 border-b-[2px] md:border-b-0 md:border-r-[2px] border-nu-ink/15 bg-nu-cream/20 flex flex-col">
        <div className="px-3 py-2 border-b-[2px] border-nu-ink/15 flex items-center justify-between bg-white">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted flex items-center gap-1.5">
            <FileText size={11} />
            페이지 {pages.length}
          </div>
          <button
            type="button"
            onClick={() => addPage(null)}
            title="새 페이지 추가"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border-[2px] border-nu-ink hover:bg-nu-cream flex items-center gap-1"
          >
            <Plus size={10} /> 새 페이지
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-[12px] text-nu-muted">
              <Loader2 size={12} className="animate-spin" /> 불러오는 중…
            </div>
          ) : error ? (
            <div className="px-2 py-2 text-[11px] text-red-700">{error}</div>
          ) : pages.length === 0 ? (
            <button
              type="button"
              onClick={() => addPage(null)}
              className="w-full text-left px-3 py-3 border-[2px] border-dashed border-nu-ink/30 hover:border-nu-ink hover:bg-white text-[12px] text-nu-muted hover:text-nu-ink"
            >
              + 첫 페이지 만들기
            </button>
          ) : (
            (tree.get(null) ?? []).map((p) => (
              <SpacePageTreeNode
                key={p.id}
                page={p}
                tree={tree}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddChild={(parentId) => addPage(parentId)}
                onUpdate={updatePage}
                onDelete={deletePage}
                depth={0}
              />
            ))
          )}
        </div>
      </aside>

      {/* 에디터 영역 */}
      <main className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <SpacePageEditor
            page={selected}
            onUpdateTitle={(title) => updatePage(selected.id, { title })}
            onUpdateIcon={(icon) => updatePage(selected.id, { icon })}
            onUpdateContent={(content) => updatePage(selected.id, { content })}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-nu-muted">
            <FileText size={32} className="mb-3 opacity-40" />
            <p className="text-[13px]">왼쪽 페이지를 선택하거나 새 페이지를 만드세요.</p>
            <button
              type="button"
              onClick={() => addPage(null)}
              className="mt-3 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-cream"
            >
              + 새 페이지
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
