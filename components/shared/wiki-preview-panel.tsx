"use client";

/**
 * WikiPagePreviewPanel — 자료실에서 탭(위키) 페이지를 빠르게 미리보기.
 *
 * - 브루탈리스트 우측 시트 (데스크탑 절반 / 모바일 풀스크린)
 * - 마크다운 렌더링 (react-markdown)
 * - 편집 버튼 → /groups/:groupId/wiki/pages/:pageId 로 이동
 */

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { X, Pencil, ExternalLink, Sparkles } from "lucide-react";

// Lazy-load react-markdown — only when a wiki page is actually previewed.
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

export interface WikiPagePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  page: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    topic_name?: string | null;
    author_nickname?: string | null;
    google_doc_url?: string | null;
  } | null;
  groupId: string;
  canEdit?: boolean;
}

export function WikiPagePreviewPanel({
  open,
  onClose,
  page,
  groupId,
  canEdit = true,
}: WikiPagePreviewPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !page) return null;

  const editHref = `/groups/${groupId}/wiki/pages/${page.id}`;
  const updatedLabel = (() => {
    try {
      return new Date(page.updated_at).toLocaleString("ko");
    } catch {
      return page.updated_at;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        aria-label="닫기"
        onClick={onClose}
        className="flex-1 bg-nu-ink/40 backdrop-blur-[2px] cursor-pointer border-0 p-0"
      />
      {/* Panel */}
      <aside className="w-full md:w-[min(640px,60vw)] bg-nu-paper border-l-[3px] border-nu-ink shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="border-b-[3px] border-nu-ink px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-nu-pink/10 border-2 border-nu-pink/30 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-nu-pink" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20">
                탭 페이지
              </span>
              {page.topic_name && (
                <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                  {page.topic_name}
                </span>
              )}
            </div>
            <h2 className="font-head text-lg font-bold text-nu-ink leading-tight break-words">
              {page.title}
            </h2>
            <div className="mt-1 flex items-center gap-2 flex-wrap font-mono-nu text-[11px] text-nu-muted">
              {page.author_nickname && <span>by {page.author_nickname}</span>}
              <span className="text-nu-muted/60">{updatedLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border-2 border-nu-ink bg-nu-cream hover:bg-nu-pink hover:text-nu-paper transition-colors font-mono-nu text-[11px] uppercase tracking-widest no-underline text-nu-ink"
              >
                <Pencil size={12} /> 편집
              </Link>
            )}
            <button
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {page.google_doc_url && (
            <a
              href={page.google_doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1.5 border-2 border-green-600/30 bg-green-50 text-green-700 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-green-600 hover:text-white transition-colors"
            >
              <ExternalLink size={12} /> Google Docs 원본
            </a>
          )}
          {page.content ? (
            <article className="prose prose-sm max-w-none text-nu-ink prose-headings:font-head prose-headings:text-nu-ink prose-a:text-nu-pink prose-strong:text-nu-ink prose-code:text-nu-pink prose-code:bg-nu-pink/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-none prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-nu-ink prose-pre:text-nu-paper">
              <ReactMarkdown>{page.content}</ReactMarkdown>
            </article>
          ) : (
            <p className="font-mono-nu text-[12px] text-nu-muted">
              (내용이 비어 있는 페이지입니다)
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-[3px] border-nu-ink px-5 py-3 bg-nu-cream flex items-center justify-between">
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            Read-only preview
          </span>
          <Link
            href={editHref}
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline no-underline"
          >
            페이지로 이동 →
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default WikiPagePreviewPanel;
