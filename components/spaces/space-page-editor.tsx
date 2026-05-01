"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SpacePage } from "./space-pages-types";
import { SpacePageBlocks } from "./space-page-blocks";
import { BacklinksPanel } from "./backlinks-panel";
import { exportPageAsMarkdown } from "./export-markdown";

interface Props {
  page: SpacePage;
  /** 트리 검색용 — 모든 페이지 (브레드크럼 부모 체인 계산) */
  allPages?: SpacePage[];
  onUpdateTitle: (title: string) => void;
  onUpdateIcon: (icon: string) => void;
  onUpdateContent: (content: string) => void;
  /** 브레드크럼에서 부모 페이지 클릭 시 jump */
  onJumpToPage?: (pageId: string) => void;
  ownerType?: "nut" | "bolt";
  ownerId?: string;
  currentUserId?: string;
}

const TITLE_DEBOUNCE = 500;
type SaveState = "idle" | "saving" | "saved";

/**
 * 한 페이지의 에디터.
 *
 * 헤더: 브레드크럼 + 큰 아이콘 + 제목 (인라인 편집) + 저장 상태 + 내보내기.
 * 본문: SpacePageBlocks — 블록 기반.
 */
export function SpacePageEditor({
  page,
  allPages,
  onUpdateTitle,
  onUpdateIcon,
  onJumpToPage,
  ownerType,
  ownerId,
  currentUserId,
}: Props) {
  const [titleDraft, setTitleDraft] = useState(page.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [exporting, setExporting] = useState(false);

  // page 가 바뀌면 (다른 페이지로 jump) draft 초기화
  useEffect(() => {
    setTitleDraft(page.title);
    setSaveState("idle");
  }, [page.id, page.title]);

  // 디바운스 저장 + 상태 표시
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTitleChange = useCallback((v: string) => {
    setTitleDraft(v);
    setSaveState("saving");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      if (v.trim() && v.trim() !== page.title) {
        onUpdateTitle(v.trim());
      }
      setSaveState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 2000);
    }, TITLE_DEBOUNCE);
  }, [page.title, onUpdateTitle]);

  // 브레드크럼 — 부모 체인 계산
  const breadcrumb = useMemo<SpacePage[]>(() => {
    if (!allPages || !page.parent_page_id) return [];
    const chain: SpacePage[] = [];
    let cur: string | null = page.parent_page_id;
    const map = new Map(allPages.map((p) => [p.id, p]));
    let safety = 0;
    while (cur && safety++ < 30) {
      const parent = map.get(cur);
      if (!parent) break;
      chain.unshift(parent);
      cur = parent.parent_page_id;
    }
    return chain;
  }, [allPages, page.parent_page_id]);

  async function exportMarkdown() {
    setExporting(true);
    try {
      const md = await exportPageAsMarkdown(page);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${page.title || "page"}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("마크다운 다운로드");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "내보내기 실패");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="border-b-[2px] border-nu-ink/10 px-6 py-3 bg-white">
        {/* 브레드크럼 */}
        {breadcrumb.length > 0 && (
          <nav className="flex items-center gap-0.5 text-[11px] text-nu-muted mb-2 flex-wrap" aria-label="브레드크럼">
            {breadcrumb.map((p, i) => (
              <span key={p.id} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onJumpToPage?.(p.id)}
                  className="hover:text-nu-pink hover:underline flex items-center gap-0.5"
                >
                  <span>{p.icon || "📄"}</span>
                  <span className="truncate max-w-[120px]">{p.title}</span>
                </button>
                <ChevronRight size={10} className="opacity-50" />
              </span>
            ))}
            <span className="text-nu-ink font-bold flex items-center gap-0.5">
              <span>{page.icon || "📄"}</span>
              <span className="truncate max-w-[160px]">{page.title}</span>
            </span>
          </nav>
        )}

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              const newIcon = window.prompt("아이콘 (이모지 1자)", page.icon || "📄");
              if (newIcon != null) onUpdateIcon(newIcon.slice(0, 4) || "📄");
            }}
            className="text-3xl leading-none hover:bg-nu-cream rounded p-1 -m-1"
            title="아이콘 변경"
          >
            {page.icon || "📄"}
          </button>
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="제목 없음"
            maxLength={200}
            className="flex-1 text-[28px] font-head font-extrabold text-nu-ink outline-none bg-transparent border-0 focus:border-0"
            aria-label="페이지 제목"
          />
          <div className="flex flex-col items-end gap-1 shrink-0 pt-2">
            <SaveStateBadge state={saveState} updatedAt={page.updated_at} />
            <button
              type="button"
              onClick={exportMarkdown}
              disabled={exporting}
              title="마크다운 다운로드"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-nu-ink/30 hover:bg-nu-cream flex items-center gap-1"
            >
              {exporting ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
              .md
            </button>
          </div>
        </div>
      </div>

      {/* 블록 본문 */}
      <div className="flex-1 overflow-auto">
        <SpacePageBlocks
          pageId={page.id}
          legacyContent={page.content}
          ownerType={ownerType}
          ownerId={ownerId}
          currentUserId={currentUserId}
          onSaveStateChange={setSaveState}
        />
        <BacklinksPanel kind="page" id={page.id} />
      </div>
    </div>
  );
}

function SaveStateBadge({ state, updatedAt }: { state: SaveState; updatedAt: string }) {
  if (state === "saving") {
    return (
      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center gap-1">
        <Loader2 size={9} className="animate-spin" /> 저장 중
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-emerald-700 flex items-center gap-1">
        <Check size={9} /> 저장됨
      </span>
    );
  }
  // idle — 마지막 저장 시각
  const ms = Date.now() - new Date(updatedAt).getTime();
  const m = Math.round(ms / 60_000);
  let label: string;
  if (m < 1) label = "방금";
  else if (m < 60) label = `${m}분 전`;
  else if (m < 1440) label = `${Math.round(m / 60)}시간 전`;
  else label = `${Math.round(m / 1440)}일 전`;
  return (
    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
      {label} 저장
    </span>
  );
}
