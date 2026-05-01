"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { SpaceBlock } from "../space-pages-types";

type EmbedKind = "youtube" | "drive" | "figma" | "link";

interface EmbedData {
  url?: string;
  kind?: EmbedKind;
  title?: string;
}

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
}

/** URL 패턴으로 종류 추론 + iframe 임베드 URL 생성. */
function parseEmbed(url: string): { kind: EmbedKind; embedUrl?: string } {
  if (!url) return { kind: "link" };
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  // Google Drive (file or doc)
  const drive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (drive) return { kind: "drive", embedUrl: `https://drive.google.com/file/d/${drive[1]}/preview` };
  if (/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url)) {
    return { kind: "drive", embedUrl: url.replace(/\/edit.*$/, "/preview") };
  }
  // Figma
  if (/figma\.com\/(file|design|board|proto)\//.test(url)) {
    return {
      kind: "figma",
      embedUrl: `https://www.figma.com/embed?embed_host=nutunion&url=${encodeURIComponent(url)}`,
    };
  }
  return { kind: "link" };
}

/**
 * 임베드 블록 — YouTube/Drive/Figma/일반 링크 미리보기.
 * URL 만 붙여넣으면 자동으로 종류 인식 + iframe.
 */
export function EmbedBlock({ block, onChange }: Props) {
  const data = (block.data as EmbedData | undefined) ?? {};
  const [draftUrl, setDraftUrl] = useState(data.url ?? "");
  const url = data.url || "";
  const parsed = url ? parseEmbed(url) : { kind: "link" as EmbedKind };
  const KIND_LABEL: Record<EmbedKind, string> = {
    youtube: "YouTube", drive: "Google Drive", figma: "Figma", link: "링크",
  };

  function applyUrl() {
    const trimmed = draftUrl.trim();
    if (!trimmed) return;
    const { kind } = parseEmbed(trimmed);
    onChange({ data: { ...(block.data || {}), url: trimmed, kind } });
  }

  if (!url) {
    return (
      <div className="my-1 border-[2px] border-dashed border-nu-ink/30 bg-nu-cream/20 px-3 py-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">
          🔗 임베드 — URL 붙여넣기
        </div>
        <div className="flex gap-1">
          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyUrl(); } }}
            placeholder="https://youtube.com/... | drive.google.com/... | figma.com/..."
            className="flex-1 px-2 py-1 text-[12px] border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none bg-white"
          />
          <button
            type="button"
            onClick={applyUrl}
            disabled={!draftUrl.trim()}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30"
          >
            임베드
          </button>
        </div>
        <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-1.5">
          YouTube · Drive · Figma 자동 인식
        </p>
      </div>
    );
  }

  return (
    <div className="my-1 border-[2px] border-nu-ink overflow-hidden bg-nu-ink/5">
      <div className="flex items-center justify-between px-2 py-1 border-b border-nu-ink/10 bg-white">
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center gap-1">
          🔗 {KIND_LABEL[parsed.kind]}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink hover:text-nu-ink flex items-center gap-1"
          title="새 탭으로 열기"
        >
          <ExternalLink size={9} /> 열기
        </a>
      </div>
      {parsed.embedUrl ? (
        <div className="relative" style={{ paddingBottom: parsed.kind === "youtube" ? "56.25%" : parsed.kind === "figma" ? "60%" : "70%" }}>
          <iframe
            src={parsed.embedUrl}
            title={data.title || url}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="px-3 py-3 bg-white">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-nu-pink underline break-all"
          >
            {data.title || url}
          </a>
        </div>
      )}
    </div>
  );
}
