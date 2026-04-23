"use client";

/**
 * ResourcePreviewModal — 자료실 파일 인-앱 미리보기.
 *
 * 지원:
 *  - Google Docs/Sheets/Slides → /preview URL 변환
 *  - Google Drive HTML 파일 → /api/google/drive/render (인증 + Content-Type 교정)
 *  - 일반 URL (Supabase Storage, R2, CDN 등) 의 .html/.htm 파일 → srcdoc 으로 직접 렌더 (실제 HTML 로 보임)
 *  - 이미지 / 동영상 → 전용 태그
 *  - 기타 → iframe 직접 임베드 (Google/Notion 등)
 */

import { useEffect, useState } from "react";
import { X, ExternalLink, Maximize2, Loader2, AlertCircle, Download } from "lucide-react";

interface ResourcePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  name: string;
}

type RenderMode = "iframe-src" | "iframe-srcdoc" | "image" | "video" | "audio" | "text";

export function ResourcePreviewModal({ isOpen, onClose, url, name }: ResourcePreviewModalProps) {
  const [embedUrl, setEmbedUrl] = useState("");
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNotion, setIsNotion] = useState(false);
  const [mode, setMode] = useState<RenderMode>("iframe-src");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setError(null);
    setSrcDoc(null);
    setLoading(true);

    const lower = name.toLowerCase();
    const isHtml = lower.endsWith(".html") || lower.endsWith(".htm");
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(lower);
    const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(lower);
    const isAudio = /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(lower);
    const isMarkdown = lower.endsWith(".md") || lower.endsWith(".markdown");
    const isText = /\.(txt|log|csv|json|xml|yaml|yml|js|ts|tsx|jsx|py|rb|go|java|c|cpp|cs|html|htm|css|scss|md|markdown)$/i.test(lower);

    setIsNotion(url.includes("notion.so"));

    // 1) Google Docs / Slides
    if (url.includes("docs.google.com/document") || url.includes("docs.google.com/presentation")) {
      setEmbedUrl(url.replace(/\/edit.*$/, "/preview"));
      setMode("iframe-src");
      return;
    }

    // 2) Google Sheets
    if (url.includes("docs.google.com/spreadsheets")) {
      const base = url.replace(/\/edit.*$/, "/preview");
      setEmbedUrl(`${base}?widget=true&headers=false&rm=minimal`);
      setMode("iframe-src");
      return;
    }

    // 3) Google Drive 파일
    if (url.includes("drive.google.com/file/d/")) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (isHtml && match) {
        setEmbedUrl(`/api/google/drive/render?fileId=${match[1]}`);
      } else {
        setEmbedUrl(url.replace(/\/view.*$/, "/preview"));
      }
      setMode("iframe-src");
      return;
    }

    // 4) 외부 URL (Supabase Storage, R2, CDN 등)

    // 4-a) 이미지 → <img>
    if (isImage) {
      setEmbedUrl(url);
      setMode("image");
      setLoading(false);
      return;
    }

    // 4-b) 동영상 → <video>
    if (isVideo) {
      setEmbedUrl(url);
      setMode("video");
      setLoading(false);
      return;
    }

    // 4-c) 오디오 → <audio>
    if (isAudio) {
      setEmbedUrl(url);
      setMode("audio");
      setLoading(false);
      return;
    }

    // 4-d) HTML 파일 → srcdoc 으로 직접 렌더
    //   보안: sanitize + 응답의 X-Frame-Options/CSP 확인 + srcdoc 에 엄격한 meta CSP 삽입
    if (isHtml) {
      (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status}`);

          // 원저 서버가 프레임 임베드를 금지했는지 확인 (Drive 등)
          const xfo = res.headers.get("x-frame-options")?.toLowerCase() || "";
          const csp = res.headers.get("content-security-policy") || "";
          const blocksFraming =
            xfo.includes("deny") ||
            xfo.includes("sameorigin") ||
            /frame-ancestors\s+[^;]*'none'/.test(csp) ||
            /frame-ancestors\s+['"]self['"]/.test(csp);

          if (blocksFraming) {
            if (!cancelled) {
              setError("원저 서버가 프레임 임베드를 차단했습니다 — 원본에서 열어주세요");
              setMode("iframe-src");
              setEmbedUrl(url);
              setLoading(false);
            }
            return;
          }

          const rawHtml = await res.text();
          const sanitized = sanitizeHtmlForPreview(rawHtml);
          if (!cancelled) {
            setSrcDoc(sanitized);
            setMode("iframe-srcdoc");
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            setError("HTML 불러오기 실패 — 원본 링크에서 열어주세요");
            setMode("iframe-src");
            setEmbedUrl(url);
            setLoading(false);
          }
        }
      })();
      return;
    }

    // 4-e) Markdown → fetch + 간단 렌더 (plain text 로 표시)
    if (isMarkdown) {
      (async () => {
        try {
          const res = await fetch(url);
          const md = await res.text();
          if (cancelled) return;
          const html = markdownToHtml(md);
          setSrcDoc(html);
          setMode("iframe-srcdoc");
          setLoading(false);
        } catch {
          if (!cancelled) {
            setEmbedUrl(url);
            setMode("iframe-src");
            setLoading(false);
          }
        }
      })();
      return;
    }

    // 4-f) 일반 텍스트 코드 → 구문 강조 없는 pre 블록
    if (isText) {
      (async () => {
        try {
          const res = await fetch(url);
          const txt = await res.text();
          if (cancelled) return;
          const html = textToPreHtml(txt);
          setSrcDoc(html);
          setMode("iframe-srcdoc");
          setLoading(false);
        } catch {
          if (!cancelled) {
            setEmbedUrl(url);
            setMode("iframe-src");
            setLoading(false);
          }
        }
      })();
      return;
    }

    // 4-g) 나머지 — 그냥 iframe 임베드 (PDF 등은 브라우저가 처리)
    setEmbedUrl(url);
    setMode("iframe-src");

    return () => {
      cancelled = true;
    };
  }, [url, name]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-nu-ink/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full h-full md:max-w-7xl bg-nu-paper border-0 md:border-2 border-nu-ink shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b-2 border-nu-ink bg-nu-cream/30 z-20">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-head text-sm md:text-lg font-extrabold text-nu-ink truncate">{name}</h3>
            <p className="font-mono-nu text-[11px] md:text-[12px] text-nu-muted truncate uppercase tracking-widest">{url}</p>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] md:text-[13px] font-bold uppercase tracking-widest px-3 md:px-4 py-1.5 md:py-2 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
            >
              <ExternalLink size={12} /> <span className="hidden sm:inline">ORIGINAL</span>
            </a>
            <a
              href={url}
              download={name}
              className="font-mono-nu text-[11px] md:text-[13px] font-bold uppercase tracking-widest px-3 md:px-4 py-1.5 md:py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
              title="다운로드"
            >
              <Download size={12} /> <span className="hidden sm:inline">DOWNLOAD</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 text-nu-muted hover:text-nu-ink transition-colors"
              aria-label="닫기"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-nu-white relative z-10 overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-nu-white z-20">
              <div className="w-full h-full p-8 space-y-6">
                <div className="h-8 bg-nu-ink/5 w-1/3 animate-pulse" />
                <div className="h-4 bg-nu-ink/5 w-full animate-pulse" />
                <div className="h-4 bg-nu-ink/5 w-full animate-pulse" />
                <div className="h-64 bg-nu-ink/5 w-full animate-pulse flex items-center justify-center">
                  <Loader2 size={32} className="text-nu-pink animate-spin" />
                </div>
                <div className="h-4 bg-nu-ink/5 w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-6 text-center text-nu-graphite">
              <AlertCircle size={24} className="mx-auto mb-2 text-nu-pink" />
              <p className="text-[14px] font-semibold">{error}</p>
            </div>
          )}

          {/* Image */}
          {mode === "image" && !error && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={embedUrl} alt={name} className="w-full h-full object-contain bg-nu-ink/5" />
          )}

          {/* Video */}
          {mode === "video" && !error && (
            <video src={embedUrl} controls className="w-full h-full bg-nu-ink">
              <track kind="captions" />
            </video>
          )}

          {/* Audio */}
          {mode === "audio" && !error && (
            <div className="p-8 flex items-center justify-center h-full">
              <audio src={embedUrl} controls className="w-full max-w-md" />
            </div>
          )}

          {/* iframe with srcdoc (HTML 직접 렌더) — allow-same-origin 제외로 보안 강화 */}
          {mode === "iframe-srcdoc" && srcDoc && !error && (
            <iframe
              srcDoc={srcDoc}
              className="w-full h-full border-0 bg-white"
              onLoad={() => setLoading(false)}
              allow="fullscreen"
              sandbox="allow-scripts allow-popups"
              title={name}
            />
          )}

          {/* iframe with src (Google Docs 등) */}
          {mode === "iframe-src" && !error && (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              onLoad={() => setLoading(false)}
              allow="autoplay; encrypted-media; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title={name}
            />
          )}

          {/* Notion Alert Overlay */}
          {isNotion && !loading && (
            <div className="absolute bottom-6 left-6 right-6 bg-nu-pink/5 border border-nu-pink/20 p-4 rounded backdrop-blur-md flex items-start gap-3 pointer-events-none">
              <AlertCircle size={18} className="text-nu-pink shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-nu-ink">노션 임베드 안내</p>
                <p className="text-[13px] text-nu-graphite leading-relaxed mt-1">
                  노션 페이지가 보이지 않는다면 해당 페이지의 <b>[Share] - [Publish to web]</b> 설정이 활성화되어 있는지 확인해 주세요.
                  보안 정책으로 차단된 경우 상단의 &apos;원본 보기&apos; 버튼을 이용해 주세요.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2 border-t border-nu-ink/5 bg-nu-cream/10 flex items-center justify-between">
          <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
            {mode === "iframe-srcdoc" ? "HTML Preview (In-App)" :
              isNotion ? "Notion Workspaces" :
                url.includes("google.com") ? "Google Workspace Integration" :
                  "In-App Private Viewer"}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
              <Maximize2 size={10} /> 정식 임베드 모드 활성
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** HTML escape */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 최소 Markdown → HTML (외부 deps 없이). heading/bold/italic/code/list/link 수준. */
function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else { out.push('<pre><code>'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`);
      continue;
    }

    const li = line.match(/^[-*]\s+(.+)$/);
    if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineMd(li[1])}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }

    if (line.trim() === "") { out.push("<br/>"); continue; }
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Pretendard,sans-serif;line-height:1.6;color:#1a1a1a;max-width:860px;margin:32px auto;padding:0 24px}
h1,h2,h3,h4{font-weight:700;margin-top:1.5em}
h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.2em}
code{background:#f3f4f6;padding:2px 6px;border-radius:3px;font-family:ui-monospace,monospace;font-size:0.9em}
pre{background:#111;color:#ddd;padding:16px;border-radius:6px;overflow:auto}
pre code{background:none;color:inherit;padding:0}
a{color:#E44C7F}
ul{padding-left:24px}
blockquote{border-left:4px solid #E44C7F;padding-left:16px;color:#555}
</style></head><body>${out.join("\n")}</body></html>`;
}

function inlineMd(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

function textToPreHtml(txt: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;background:#fafafa;color:#1a1a1a}
pre{white-space:pre-wrap;word-wrap:break-word;padding:24px;line-height:1.5;font-size:13px;margin:0}
</style></head><body><pre>${escapeHtml(txt)}</pre></body></html>`;
}

/**
 * HTML 샌드박스화 — 업로드된 HTML 을 안전하게 프리뷰하기 위한 1차 방어선.
 *
 * 제거 대상:
 *  - 외부 origin <script src=...> (same-origin 인라인 스크립트는 sandbox 로 격리되므로 유지)
 *  - <iframe>, <object>, <embed> (중첩 프레임 악용 차단)
 *  - <form action=외부> (피싱 차단)
 *  - on* 인라인 이벤트 핸들러 (onerror, onload, onclick 등 — 가장 흔한 XSS 벡터)
 *  - javascript: / data:text/html 프로토콜 링크
 *  - <meta http-equiv="refresh"> (자동 리다이렉트)
 *
 * 참고: iframe sandbox 에서 allow-same-origin 을 제외했으므로 쿠키/스토리지 접근 자체가 막힘.
 *       하지만 user-perception 적으로도 깨끗하게 정리하는 것이 UX 안전.
 */
/** 내장 CSP — 외부 origin 리소스 로드를 기본 차단하고 기본 data/inline 만 허용. */
const PREVIEW_CSP =
  "default-src 'none'; " +
  "img-src 'self' data: blob: https:; " +          // 이미지는 외부 https 허용 (프리뷰 유용성)
  "media-src 'self' data: blob: https:; " +         // 동영상/오디오도 동일
  "font-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; " +            // 인라인 스타일 허용 (디자인 일반)
  "script-src 'unsafe-inline'; " +                  // srcdoc 안 인라인 스크립트는 sandbox 로 격리됨
  "form-action 'none'; " +                          // 폼 submit 차단
  "base-uri 'none'; " +                             // base 태그 차단
  "frame-ancestors 'none'; " +                      // 다른 사이트의 프레임 재임베드 차단
  "connect-src 'none';";                            // fetch/XHR 원천 차단 (추적 방지)

function sanitizeHtmlForPreview(html: string): string {
  let out = html;

  // 1) 외부 origin <script src=...> 제거 (src 가 http/https/// 으로 시작)
  out = out.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']?(https?:|\/\/)[^>]*>[\s\S]*?<\/script>/gi,
    "<!-- external script removed -->",
  );
  // 2) <iframe>, <object>, <embed> 제거
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "<!-- iframe removed -->");
  out = out.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "<!-- object removed -->");
  out = out.replace(/<embed\b[^>]*\/?>/gi, "<!-- embed removed -->");

  // 3) form action 이 외부 URL 이면 제거 (피싱 방지)
  out = out.replace(/\saction\s*=\s*["']?(https?:|\/\/)[^"'\s>]+["']?/gi, ' action="#"');

  // 4) on* 인라인 이벤트 핸들러 제거 (onclick/onerror/onload 등)
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");

  // 5) javascript: / data:text/html 프로토콜 제거
  out = out.replace(/\shref\s*=\s*["']?\s*(javascript|data):[^"'\s>]*["']?/gi, ' href="#"');
  out = out.replace(/\ssrc\s*=\s*["']?\s*(javascript|data):[^"'\s>]*["']?/gi, ' src=""');

  // 6) meta refresh 제거
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "");

  // 7) <base href> 제거 (relative URL 악용)
  out = out.replace(/<base\b[^>]*>/gi, "");

  // 8) 문서에 원저 <meta http-equiv="Content-Security-Policy"> 가 있으면 제거 (우리가 주입한 것만 효력)
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");

  // 9) 엄격한 CSP meta 주입 (head 가 있으면 그 안에, 없으면 새로 생성)
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;

  // 10) 5초 타이머 — 외부 origin 이미지는 로드 완료되면 그대로 유지, 5초 이후 신규 로드/교체는 차단
  //     구현: inline 스크립트로 5초 후 (a) 아직 로드 안 된 <img> 제거 (b) MutationObserver 로 신규 삽입 차단
  const tickerScript = `
<script>
(function(){
  var LIMIT_MS = 5000;
  var start = Date.now();
  var blocked = false;
  var banner = document.getElementById('__nu_preview_timer');
  function tick(){
    var remain = Math.max(0, LIMIT_MS - (Date.now() - start));
    if (banner) banner.textContent = remain > 0 ? '⏰ 외부 이미지 로드 허용: ' + Math.ceil(remain/1000) + '초 남음' : '🛑 외부 이미지 로드 차단 — 허용된 것만 표시';
    if (remain > 0) { requestAnimationFrame(tick); return; }
    if (blocked) return;
    blocked = true;
    // 로드 완료 안 된 <img> 제거
    document.querySelectorAll('img').forEach(function(img){
      var src = img.getAttribute('src') || '';
      var isExternal = /^(https?:|\\/\\/)/i.test(src);
      var loaded = img.complete && img.naturalWidth > 0;
      if (isExternal && !loaded) {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    });
    // 신규 외부 이미지 삽입 차단
    var obs = new MutationObserver(function(muts){
      for (var i=0; i<muts.length; i++) {
        var m = muts[i];
        for (var j=0; j<m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) {
            if (n.tagName === 'IMG' && /^(https?:|\\/\\/)/i.test(n.getAttribute('src')||'')) {
              n.removeAttribute('src');
              n.style.display = 'none';
            }
            // src 속성 변경도 감시
            if (n.querySelectorAll) n.querySelectorAll('img').forEach(function(img){
              if (/^(https?:|\\/\\/)/i.test(img.getAttribute('src')||'')) {
                img.removeAttribute('src');
                img.style.display = 'none';
              }
            });
          }
        }
        if (m.type === 'attributes' && m.target.tagName === 'IMG') {
          var src = m.target.getAttribute('src')||'';
          if (/^(https?:|\\/\\/)/i.test(src)) {
            m.target.removeAttribute('src');
            m.target.style.display = 'none';
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
})();
</script>`;

  // 11) 프리뷰 경고 배너 (타이머 표시용 id 포함)
  const bannerHtml = `<div style="position:sticky;top:0;left:0;right:0;z-index:999;padding:6px 12px;background:#fff3cd;border-bottom:1px solid #ffc107;font:11px/1.3 -apple-system,sans-serif;color:#856404;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>⚠ CSP 격리 프리뷰 모드</span><span id="__nu_preview_timer">⏰ 외부 이미지 로드 허용: 5초 남음</span></div>`;

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${cspMeta}</head>`);
  } else {
    out = `<!DOCTYPE html><html><head>${cspMeta}</head>${out}`;
  }

  out = out.replace(/<body([^>]*)>/i, `<body$1>${bannerHtml}${tickerScript}`);
  if (!/<body/i.test(out)) {
    out = `<!DOCTYPE html><html><head>${cspMeta}</head><body>${bannerHtml}${tickerScript}${out}</body></html>`;
  }

  return out;
}
