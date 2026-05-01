"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SpacePage, SpaceBlock, BlockType } from "./space-pages-types";
import { SpacePageBlocks } from "./space-page-blocks";

interface Props {
  page: SpacePage;
  onUpdateTitle: (title: string) => void;
  onUpdateIcon: (icon: string) => void;
  onUpdateContent: (content: string) => void;
}

const TITLE_DEBOUNCE = 500;

/**
 * 한 페이지의 에디터.
 *
 * 헤더: 큰 아이콘 + 제목 (인라인 편집)
 * 본문: SpacePageBlocks — 블록 기반 (text/h1-3/todo/code 등 슬래시 명령)
 *
 * 페이지가 처음엔 비어있고 (블록 0개), 첫 키 입력 시 자동으로 text 블록 1개 생성.
 */
export function SpacePageEditor({ page, onUpdateTitle, onUpdateIcon }: Props) {
  const [titleDraft, setTitleDraft] = useState(page.title);

  // page 가 바뀌면 (다른 페이지로 jump) draft 초기화
  useEffect(() => { setTitleDraft(page.title); }, [page.id, page.title]);

  // 디바운스 저장
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTitleChange = useCallback((v: string) => {
    setTitleDraft(v);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      if (v.trim() && v.trim() !== page.title) onUpdateTitle(v.trim());
    }, TITLE_DEBOUNCE);
  }, [page.title, onUpdateTitle]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 — 아이콘 + 제목 */}
      <div className="border-b-[2px] border-nu-ink/10 px-6 py-4 bg-white flex items-start gap-3">
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
      </div>

      {/* 블록 본문 */}
      <div className="flex-1 overflow-auto">
        <SpacePageBlocks pageId={page.id} legacyContent={page.content} />
      </div>
    </div>
  );
}
