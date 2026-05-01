"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2 } from "lucide-react";
import type { SpacePage } from "./space-pages-types";

interface Props {
  page: SpacePage;
  tree: Map<string | null, SpacePage[]>;
  selectedId: string | null;
  depth: number;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<SpacePage, "title" | "icon" | "parent_page_id" | "position">>) => void;
  onDelete: (id: string) => void;
}

/**
 * 페이지 트리의 한 노드 — 재귀 렌더.
 *
 * - 클릭 = select
 * - 호버 시 우측에 + (자식 추가) / ⋯ (메뉴)
 * - 자식 있으면 chevron 으로 펼침/접기
 * - HTML5 drag — 다른 노드 위에 drop 하면 그 노드의 자식으로 이동
 */
export function SpacePageTreeNode({
  page,
  tree,
  selectedId,
  depth,
  onSelect,
  onAddChild,
  onUpdate,
  onDelete,
}: Props) {
  const children = tree.get(page.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isSelected = selectedId === page.id;

  return (
    <div className="space-y-0.5">
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/page-id", page.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const sourceId = e.dataTransfer.getData("text/page-id");
          if (sourceId && sourceId !== page.id) {
            // 새 부모 = 이 노드, position 은 마지막
            onUpdate(sourceId, { parent_page_id: page.id });
          }
        }}
        className={`group flex items-center gap-0.5 px-1 py-1 cursor-pointer ${
          isSelected ? "bg-nu-ink text-nu-paper" : dragOver ? "bg-nu-pink/15" : "hover:bg-white"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onSelect(page.id)}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className={`p-0.5 ${isSelected ? "text-nu-paper/70" : "text-nu-muted"} hover:text-nu-pink shrink-0`}
            aria-label={expanded ? "접기" : "펼치기"}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-[15px]" aria-hidden />
        )}
        <span className="text-[13px] shrink-0">{page.icon || "📄"}</span>
        <span className="flex-1 truncate text-[12px]" title={page.title}>
          {page.title}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddChild(page.id); }}
          title="하위 페이지 추가"
          className={`opacity-0 group-hover:opacity-100 p-0.5 ${isSelected ? "hover:bg-nu-paper/10 text-nu-paper" : "hover:bg-nu-cream"}`}
        >
          <Plus size={11} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            title="더보기"
            className={`opacity-0 group-hover:opacity-100 p-0.5 ${isSelected ? "hover:bg-nu-paper/10 text-nu-paper" : "hover:bg-nu-cream"} ${menuOpen ? "!opacity-100" : ""}`}
          >
            <MoreHorizontal size={11} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-0.5 z-20 bg-white border-[2px] border-nu-ink shadow-[2px_2px_0_0_#0D0F14] min-w-[140px]"
              onClick={(e) => e.stopPropagation()}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  const newTitle = window.prompt("새 제목", page.title);
                  if (newTitle != null && newTitle.trim()) onUpdate(page.id, { title: newTitle.trim() });
                }}
                className="w-full text-left font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream text-nu-ink"
              >
                이름 변경
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  const newIcon = window.prompt("아이콘 (이모지 1자)", page.icon || "📄");
                  if (newIcon != null) onUpdate(page.id, { icon: newIcon.slice(0, 4) || "📄" });
                }}
                className="w-full text-left font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream text-nu-ink"
              >
                아이콘 변경
              </button>
              {page.parent_page_id && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onUpdate(page.id, { parent_page_id: null });
                  }}
                  className="w-full text-left font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream text-nu-ink"
                >
                  최상위로 이동
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(page.id); }}
                className="w-full text-left flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-red-50 text-red-700 border-t border-nu-ink/10"
              >
                <Trash2 size={10} /> 삭제
              </button>
            </div>
          )}
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((c) => (
            <SpacePageTreeNode
              key={c.id}
              page={c}
              tree={tree}
              selectedId={selectedId}
              depth={depth + 1}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
