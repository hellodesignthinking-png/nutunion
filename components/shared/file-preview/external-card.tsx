"use client";

import { ExternalLink, Download } from "lucide-react";

/** Reusable card for non-embeddable URLs (notion, github, other, fallback).
 *  Shows OG metadata (title, description, image) when available — otherwise
 *  the file name + icon + open/download buttons. */
export function ExternalCard({
  url,
  name,
  icon,
  label,
  og,
  ogLoading,
  note,
  showDownload,
}: {
  url: string;
  name: string;
  icon: string;
  label: string;
  og?: { title?: string; description?: string; image?: string; site_name?: string } | null;
  ogLoading?: boolean;
  note?: string;
  showDownload?: boolean;
}) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "";
  const title = og?.title || name;
  const desc = og?.description;
  const image = og?.image;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-4 text-center bg-nu-cream/10 overflow-auto">
      <div className="w-full max-w-md border-[3px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_#0D0F14] overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-full aspect-video object-cover border-b-[3px] border-nu-ink" />
        ) : (
          <div className="w-full aspect-video bg-nu-cream/40 border-b-[3px] border-nu-ink flex items-center justify-center text-5xl">
            {icon}
          </div>
        )}
        <div className="p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            {favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={favicon} alt="" className="w-4 h-4" />
            ) : null}
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              {og?.site_name || label} {host ? `· ${host}` : ""}
            </span>
          </div>
          <p className="font-head text-sm font-black text-nu-ink line-clamp-2 break-words">{title}</p>
          {ogLoading && !desc && (
            <p className="text-[11px] text-nu-muted mt-1">메타 정보 불러오는 중…</p>
          )}
          {desc && (
            <p className="text-[12px] text-nu-muted mt-2 line-clamp-3 break-words leading-snug">{desc}</p>
          )}
          {note && (
            <p className="text-[11px] text-nu-muted mt-3 italic">{note}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
        >
          <ExternalLink size={12} /> 새 탭에서 열기
        </a>
        {showDownload && (
          <a
            href={url}
            download={name}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
          >
            <Download size={12} /> 다운로드
          </a>
        )}
      </div>
    </div>
  );
}
