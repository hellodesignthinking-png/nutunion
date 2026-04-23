"use client";

/**
 * UnifiedPreviewPanel (exported as LinkPreviewPanel for backward compatibility)
 *
 * 사이드패널 내부에서 모든 자료 타입을 인라인 미리보기:
 *  - 이미지 (jpg/png/gif/webp/svg…)   → <img>
 *  - 동영상 (mp4/webm/mov…)           → <video>
 *  - 오디오 (mp3/wav/ogg…)            → <audio>
 *  - PDF                              → Google Docs Viewer iframe (or native <embed>)
 *  - Google Docs/Sheets/Slides/Drive  → 임베드 URL iframe
 *  - YouTube                         → embed iframe
 *  - Notion                          → iframe
 *  - 일반 외부 링크·기사              → iframe 시도 + OG 카드 폴백
 */

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, X, RefreshCw, Loader2, FileText, Music, Film, Image as ImageIcon } from "lucide-react";

interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  url?: string;
}

type MediaKind = "image" | "video" | "audio" | "pdf" | "embed" | "link";

interface Props {
  url: string;
  name: string;
  mime?: string | null;
  onClose: () => void;
}

/* ── helpers ─────────────────────────────────────────── */

function detectKind(url: string, mime?: string | null): MediaKind {
  const u = url.toLowerCase().split("?")[0];
  const m = (mime || "").toLowerCase();

  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)$/.test(u)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|ogv)$/.test(u)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|wav|ogg|aac|flac|m4a)$/.test(u)) return "audio";
  if (m.includes("pdf") || u.endsWith(".pdf")) return "pdf";

  // Google embeddable
  if (
    u.includes("docs.google.com") ||
    u.includes("drive.google.com") ||
    u.includes("youtube.com") ||
    u.includes("youtu.be") ||
    u.includes("notion.so") ||
    u.includes("notion.site")
  )
    return "embed";

  return "link";
}

function getEmbedUrl(url: string, kind: MediaKind): string {
  if (kind === "pdf") {
    // Prefer native embed for URLs that are direct storage links; otherwise GDocs viewer
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  if (url.includes("docs.google.com/document")) return url.replace(/\/(edit|view).*$/, "/preview");
  if (url.includes("docs.google.com/spreadsheets")) return url.replace(/\/(edit|view).*$/, "/preview");
  if (url.includes("docs.google.com/presentation")) return url.replace(/\/(edit|view).*$/, "/preview");
  if (url.includes("drive.google.com/file/d/")) return url.replace(/\/view.*$/, "/preview");
  if (url.includes("drive.google.com/drive/folders/")) {
    const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (m?.[1]) return `https://drive.google.com/embeddedfolderview?id=${m[1]}#grid`;
  }
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;
  // Notion / generic
  return url;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/* ── component ───────────────────────────────────────── */

export function LinkPreviewPanel({ url, name, mime, onClose }: Props) {
  const kind = detectKind(url, mime);

  const [ogMeta, setOgMeta] = useState<OgMeta | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const domain = getDomain(url);
  const embedUrl = (kind === "embed" || kind === "pdf" || kind === "link") ? getEmbedUrl(url, kind) : url;

  // OG fetch — only for external links/articles
  useEffect(() => {
    setOgMeta(null);
    if (!url || kind !== "link") return;
    setOgLoading(true);
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && (d.title || d.description || d.image)) setOgMeta(d); })
      .catch(() => {})
      .finally(() => setOgLoading(false));
  }, [url, kind]);

  // iframe 차단 타이머 (embed/pdf/link 에만 적용)
  useEffect(() => {
    if (kind === "image" || kind === "video" || kind === "audio") return;
    setIframeBlocked(false);
    setIframeLoaded(false);
    blockTimerRef.current = setTimeout(() => {
      setIframeBlocked(true);
    }, 9000);
    return () => { if (blockTimerRef.current) clearTimeout(blockTimerRef.current); };
  }, [url, kind]);

  const handleIframeLoad = () => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    setIframeLoaded(true);
    setIframeBlocked(false);
  };

  /* ── sub‑renders ─────────────────────────────────────── */

  function renderContent() {
    // 1) 이미지
    if (kind === "image") {
      return (
        <div className="flex-1 overflow-auto flex items-center justify-center bg-nu-ink/5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-full object-contain shadow-lg"
            onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
          />
        </div>
      );
    }

    // 2) 동영상
    if (kind === "video") {
      return (
        <div className="flex-1 flex items-center justify-center bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={url}
            controls
            className="max-w-full max-h-full"
            style={{ maxHeight: "calc(100% - 8px)" }}
          />
        </div>
      );
    }

    // 3) 오디오
    if (kind === "audio") {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-nu-paper">
          <div className="w-24 h-24 rounded-full bg-nu-ink/5 flex items-center justify-center">
            <Music size={40} className="text-nu-muted opacity-50" />
          </div>
          <p className="font-head text-sm font-bold text-nu-ink text-center truncate max-w-xs">{name}</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full max-w-xs" />
        </div>
      );
    }

    // 4) iframe 계열 (pdf / embed / link)
    return (
      <>
        {/* OG 카드 — 로딩 중이거나 iframe 차단 시 */}
        {kind === "link" && (iframeBlocked || (!iframeLoaded && (ogMeta || ogLoading))) && (
          <OgCard url={url} name={name} domain={domain} ogMeta={ogMeta} ogLoading={ogLoading} />
        )}

        {/* iframe */}
        {!iframeBlocked && (
          <div className="flex-1 overflow-hidden relative">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-nu-paper/80 z-10">
                <div className="text-center">
                  <Loader2 size={20} className="animate-spin text-nu-muted mx-auto mb-2" />
                  <p className="text-[12px] text-nu-muted">
                    {kind === "pdf" ? "PDF 불러오는 중…" : "페이지 로딩 중…"}
                  </p>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen; clipboard-write"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={() => setIframeBlocked(true)}
            />
          </div>
        )}

        {/* 차단 폴백 */}
        {iframeBlocked && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {kind === "pdf" ? (
              <>
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <FileText size={28} className="text-red-400" />
                </div>
                <p className="font-head text-sm font-bold text-nu-ink mb-1">PDF 미리보기 불가</p>
                <p className="text-[12px] text-nu-muted mb-4 max-w-xs leading-relaxed">
                  보안 설정으로 인라인 미리보기가 차단되었습니다.<br />
                  원본 링크에서 직접 다운로드해보세요.
                </p>
              </>
            ) : kind === "link" && ogMeta ? (
              <OgCard url={url} name={name} domain={domain} ogMeta={ogMeta} ogLoading={false} fullMode />
            ) : (
              <>
                <div className="w-16 h-16 bg-nu-ink/5 rounded-full flex items-center justify-center mb-4">
                  <Globe size={24} className="text-nu-muted opacity-40" />
                </div>
                <p className="font-head text-sm font-bold text-nu-ink mb-1">미리보기가 제한된 페이지예요</p>
                <p className="text-[12px] text-nu-muted mb-4 max-w-xs leading-relaxed">
                  일부 사이트는 보안상 iframe 임베드를 차단합니다.<br />
                  원본 링크에서 직접 확인해보세요.
                </p>
              </>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-blue transition-colors no-underline"
            >
              <ExternalLink size={13} /> 원본에서 열기
            </a>
          </div>
        )}
      </>
    );
  }

  /* ── 타입 아이콘 ────────────────────────────────────── */
  function KindIcon() {
    if (kind === "image") return <ImageIcon size={12} className="text-nu-blue opacity-60" />;
    if (kind === "video") return <Film size={12} className="text-nu-pink opacity-60" />;
    if (kind === "audio") return <Music size={12} className="text-nu-amber opacity-60" />;
    if (kind === "pdf") return <FileText size={12} className="text-red-400 opacity-70" />;
    return <Globe size={12} className="text-nu-muted opacity-60" />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-nu-ink bg-nu-cream/30 shrink-0">
        <div className="min-w-0 pr-3 flex items-center gap-2">
          <KindIcon />
          <div className="min-w-0">
            <p className="font-head text-[12px] font-black text-nu-ink truncate">{name}</p>
            {domain && (
              <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted truncate">{domain}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(kind === "embed" || kind === "pdf" || kind === "link") && iframeBlocked && (
            <button
              onClick={() => { setIframeBlocked(false); setIframeLoaded(false); }}
              className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors"
              title="재시도"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors"
            title="원본에서 열기"
          >
            <ExternalLink size={13} />
          </a>
          <button onClick={onClose} className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-nu-white">
        {renderContent()}
      </div>
    </div>
  );
}

/* ── OG 카드 서브컴포넌트 ─────────────────────────────── */
function OgCard({
  url, name, domain, ogMeta, ogLoading, fullMode = false,
}: {
  url: string; name: string; domain: string;
  ogMeta: OgMeta | null; ogLoading: boolean; fullMode?: boolean;
}) {
  const cls = fullMode
    ? "flex-1 flex flex-col items-center justify-center p-8 text-center"
    : "shrink-0 border-b border-nu-ink/10 bg-nu-paper p-4";

  if (ogLoading) {
    return (
      <div className={cls}>
        <div className="flex items-center gap-2 text-nu-muted">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">링크 정보 불러오는 중…</span>
        </div>
      </div>
    );
  }

  if (!ogMeta) return null;

  return (
    <div className={cls}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex gap-3 no-underline group max-w-sm w-full">
        {ogMeta.image && (
          <div className="w-20 h-20 shrink-0 overflow-hidden rounded border border-nu-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogMeta.image}
              alt={ogMeta.title || ""}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          {ogMeta.site_name && (
            <div className="flex items-center gap-1 mb-0.5">
              <Globe size={10} className="text-nu-muted" />
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{ogMeta.site_name}</span>
            </div>
          )}
          <p className="font-head text-[13px] font-bold text-nu-ink line-clamp-2 group-hover:text-nu-blue transition-colors">
            {ogMeta.title || name}
          </p>
          {ogMeta.description && (
            <p className="text-[11px] text-nu-muted mt-0.5 line-clamp-2 leading-relaxed">{ogMeta.description}</p>
          )}
          <span className="inline-flex items-center gap-1 mt-1 font-mono-nu text-[10px] text-nu-blue">
            <ExternalLink size={9} /> {domain}에서 읽기
          </span>
        </div>
      </a>
    </div>
  );
}
