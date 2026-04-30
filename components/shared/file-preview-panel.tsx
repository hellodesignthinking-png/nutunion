"use client";

/**
 * FilePreviewPanel — 유니버설 R2 파일 미리보기 + 텍스트 편집 패널.
 *
 * - 우측 시트 형태 (데스크탑 50% / 모바일 풀스크린)
 * - MIME 타입 자동 감지 → pdf / image / video / audio / text / office / other
 * - 텍스트 파일은 편집 모드 지원 (overwrite presign + PUT → 같은 R2 key 재업로드)
 * - Office 는 Microsoft Office Online Viewer 사용 (R2 public URL 전제)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Edit3,
  Save,
  Loader2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode2,
  File as FileIcon,
  AlertCircle,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
// highlight.js is heavy (~hundreds of kB). Lazy-load on demand only when a
// text/html preview actually renders, so it stays out of the initial bundle
// for every page that imports FilePreviewPanel.
type Hljs = typeof import("highlight.js")["default"];
let _hljsPromise: Promise<Hljs> | null = null;
function loadHljs(): Promise<Hljs> {
  if (!_hljsPromise) {
    _hljsPromise = (async () => {
      const [mod] = await Promise.all([
        import("highlight.js"),
        import("highlight.js/styles/github.css" as any),
      ]);
      return mod.default;
    })();
  }
  return _hljsPromise;
}
import { createClient } from "@/lib/supabase/client";
import { ImageAnnotator } from "./image-annotator";
// PDF 주석은 pdfjs/pdf-lib 가 무거워서 lazy load
const PdfAnnotator = (() => {
  let cache: any = null;
  return function PdfAnnotatorLazy(props: any) {
    const [Comp, setComp] = useState<any>(cache);
    useEffect(() => {
      if (cache) return;
      import("./pdf-annotator").then((m) => { cache = m.PdfAnnotator; setComp(() => m.PdfAnnotator); });
    }, []);
    if (!Comp) {
      return (
        <div className="fixed inset-0 z-[70] bg-nu-ink/85 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-nu-paper" />
        </div>
      );
    }
    return <Comp {...props} />;
  };
})();

type FileKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "html"
  | "office"
  | "hwp"
  | "youtube"
  | "gdrive"
  | "vimeo"
  | "loom"
  | "figma"
  | "tweet"
  | "spotify"
  | "soundcloud"
  | "gist"
  | "codepen"
  | "tiktok"
  | "instagram"
  | "miro"
  | "slideshare"
  | "notion"
  | "github"
  | "other";

/** Google Docs/Sheets/Slides/Drawing URL 을 임베드 가능한 /preview URL 로 변환.
 *  편집(`/edit`) URL → 미리보기(`/preview`) URL — 인증 없는 iframe 임베드 가능. */
function toGdriveEmbed(url: string): string | null {
  // docs.google.com/document/d/{ID}/edit → /preview
  // docs.google.com/spreadsheets/d/{ID}/edit → /preview
  // docs.google.com/presentation/d/{ID}/edit → /preview
  // docs.google.com/drawings/d/{ID}/edit → /preview
  const m = url.match(/docs\.google\.com\/(document|spreadsheets|presentation|drawings)\/d\/([\w-]+)/);
  if (m) {
    return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  }
  // drive.google.com/file/d/{ID}/view → /preview
  const f = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (f) {
    return `https://drive.google.com/file/d/${f[1]}/preview`;
  }
  return null;
}

/** YouTube 채널/플레이리스트는 embed 불가 — 영상 URL 만 embed 변환 가능. */
function toYoutubeEmbed(url: string): string | null {
  const watch = url.match(/youtube\.com\/watch\?[^#]*v=([^&#]+)/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const short = url.match(/youtu\.be\/([^?#]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const shorts = url.match(/youtube\.com\/shorts\/([^?#]+)/);
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
  return null;
}

export interface FilePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  file: {
    id: string;
    name: string;
    url: string;
    mime?: string | null;
    size?: number | null;
    storage_type?: string | null;
    storage_key?: string | null;
  };
  targetTable: "file_attachments" | "project_resources";
  canEdit?: boolean;
  onUpdated?: (f: { url?: string; name?: string }) => void;
}

function detectKind(url: string, mime?: string | null): FileKind {
  const lowerUrl = (url || "").toLowerCase();
  if (
    lowerUrl.includes("youtube.com/watch") ||
    lowerUrl.includes("youtu.be/") ||
    lowerUrl.includes("youtube.com/@") ||
    lowerUrl.includes("youtube.com/channel/") ||
    lowerUrl.includes("youtube.com/c/") ||
    lowerUrl.includes("youtube.com/shorts/") ||
    lowerUrl.includes("youtube.com/playlist")
  ) {
    return "youtube";
  }
  // Google Docs/Sheets/Slides/Drawing/Drive 파일 → /preview iframe 임베드
  if (
    lowerUrl.includes("docs.google.com/document/") ||
    lowerUrl.includes("docs.google.com/spreadsheets/") ||
    lowerUrl.includes("docs.google.com/presentation/") ||
    lowerUrl.includes("docs.google.com/drawings/") ||
    lowerUrl.includes("drive.google.com/file/d/")
  ) {
    return "gdrive";
  }
  // Vimeo — embed via player.vimeo.com
  if (lowerUrl.includes("vimeo.com/") && !lowerUrl.includes("player.vimeo.com")) return "vimeo";
  if (lowerUrl.includes("player.vimeo.com/video/")) return "vimeo";
  // Loom — /share/{ID} → /embed/{ID}
  if (lowerUrl.includes("loom.com/share/") || lowerUrl.includes("loom.com/embed/")) return "loom";
  // Figma — file/proto/design URLs embeddable via figma.com/embed
  if (
    lowerUrl.includes("figma.com/file/") ||
    lowerUrl.includes("figma.com/proto/") ||
    lowerUrl.includes("figma.com/design/") ||
    lowerUrl.includes("figma.com/board/")
  ) {
    return "figma";
  }
  // Twitter / X status — twitframe.com embed
  if (/^https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/status\/\d+/.test(url)) return "tweet";
  // Spotify — open.spotify.com/{type}/{id} → embed
  if (lowerUrl.includes("open.spotify.com/")) return "spotify";
  // Notion — public pages typically block iframes; show OG card
  if (lowerUrl.includes("notion.so/") || lowerUrl.includes("notion.site/")) return "notion";
  // SoundCloud — w.soundcloud.com/player iframe
  if (lowerUrl.includes("soundcloud.com/")) return "soundcloud";
  // GitHub Gist — raw text fetch (script-only embed 대안)
  if (lowerUrl.includes("gist.github.com/")) return "gist";
  // CodePen — pen embed
  if (lowerUrl.includes("codepen.io/") && (lowerUrl.includes("/pen/") || lowerUrl.includes("/embed/"))) return "codepen";
  // TikTok — embed
  if (lowerUrl.includes("tiktok.com/") && (lowerUrl.includes("/video/") || lowerUrl.includes("/@"))) return "tiktok";
  // Instagram — embed
  if (lowerUrl.match(/instagram\.com\/(p|reel|tv)\//)) return "instagram";
  // Miro board — embed
  if (lowerUrl.includes("miro.com/app/board/")) return "miro";
  // SlideShare — embed
  if (lowerUrl.includes("slideshare.net/")) return "slideshare";
  // GitHub blob/repo (gist 제외) — link card
  if (lowerUrl.includes("github.com/")) return "github";
  const cleanUrl = url.split("?")[0];
  const ext = cleanUrl.split(".").pop()?.toLowerCase() || "";
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm" || m === "text/html") return "html";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext)) return "image";
  if (m.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(ext)) return "audio";
  const textExts = [
    "md", "markdown", "txt", "json", "yml", "yaml", "csv", "tsv", "log",
    "xml", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "go",
    "rs", "java", "rb", "sh", "sql", "env", "toml", "ini",
  ];
  if (m.startsWith("text/") || textExts.includes(ext)) return "text";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["hwp", "hwpx"].includes(ext) || m === "application/x-hwp" || m === "application/haansofthwp" || m === "application/vnd.hancom.hwp") return "hwp";
  return "other";
}

function guessMime(name: string, fallback?: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    md: "text/markdown", markdown: "text/markdown",
    txt: "text/plain", log: "text/plain",
    json: "application/json",
    yml: "application/yaml", yaml: "application/yaml",
    csv: "text/csv", tsv: "text/tab-separated-values",
    xml: "application/xml",
    html: "text/html", htm: "text/html",
    css: "text/css",
    js: "application/javascript", jsx: "text/jsx",
    ts: "application/typescript", tsx: "text/tsx",
    py: "text/x-python", go: "text/x-go", rs: "text/x-rust",
    java: "text/x-java", rb: "text/x-ruby", sh: "text/x-sh",
    sql: "application/sql", env: "text/plain",
    toml: "application/toml", ini: "text/plain",
  };
  return map[ext] || fallback || "text/plain";
}

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust",
  java: "java", rb: "ruby", php: "php",
  sh: "bash", sql: "sql",
  json: "json", yaml: "yaml", yml: "yaml",
  html: "html", htm: "html", css: "css",
  md: "markdown", markdown: "markdown",
  xml: "xml", toml: "ini", ini: "ini",
  csv: "plaintext", tsv: "plaintext", txt: "plaintext", log: "plaintext",
};

function detectLang(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return LANG_MAP[ext] || "plaintext";
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString("ko");
}

interface FileComment {
  id: string;
  user_id: string;
  page: number | null;
  content: string;
  created_at: string;
  author?: { nickname?: string | null; avatar_url?: string | null } | null;
}

function prettySize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(kind: FileKind) {
  switch (kind) {
    case "image": return <FileImage size={18} />;
    case "video": return <FileVideo size={18} />;
    case "audio": return <FileAudio size={18} />;
    case "text": return <FileCode2 size={18} />;
    case "pdf":
    case "office":
    case "hwp":
    case "other":
    default: return <FileText size={18} />;
  }
}

export function FilePreviewPanel({
  open,
  onClose,
  file,
  targetTable,
  canEdit = false,
  onUpdated,
}: FilePreviewPanelProps) {
  const kind = useMemo(() => detectKind(file.url, file.mime), [file.url, file.mime]);
  const isR2 = file.storage_type === "r2" && !!file.storage_key;
  const canTextEdit = isR2 && kind === "text" && canEdit;

  // Cache-buster for post-save refresh
  const [version, setVersion] = useState<number>(0);
  const displayUrl = useMemo(() => {
    if (!version) return file.url;
    const sep = file.url.includes("?") ? "&" : "?";
    return `${file.url}${sep}v=${version}`;
  }, [file.url, version]);

  // 인라인 미리보기용 프록시 URL — R2 / Supabase 파일이 브라우저에서 다운로드로 떨어지지 않도록
  // Content-Disposition: inline + 확장자 기반 Content-Type 보정해서 다시 스트림.
  // Office Online Viewer 처럼 외부 서버가 fetch 해야 하는 경우는 원본 URL 그대로 써야 함.
  const inlineUrl = useMemo(() => {
    if (!file.url) return file.url;
    if (!/^https?:\/\//i.test(file.url)) return file.url;
    return `/api/files/preview-proxy?url=${encodeURIComponent(displayUrl)}`;
  }, [file.url, displayUrl]);

  // Text content state
  const [textContent, setTextContent] = useState<string>("");
  const [originalText, setOriginalText] = useState<string>("");
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 버전 히스토리 모달
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [pdfAnnotating, setPdfAnnotating] = useState(false);
  const [versions, setVersions] = useState<Array<{
    id: string;
    backup_storage_key: string;
    bytes: number | null;
    content_type: string | null;
    created_by: string | null;
    created_at: string;
    label: string | null;
  }>>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Image zoom
  const [zoomed, setZoomed] = useState(false);

  // HTML preview — toggle between rendered iframe and source
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const [hljsLib, setHljsLib] = useState<Hljs | null>(null);

  // Image annotator overlay
  const [annotating, setAnnotating] = useState(false);

  // Office → personal Drive
  const [officeOpening, setOfficeOpening] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // 자료실 행에 이미 Drive 편집 사본이 연결돼 있는지 — sync-back 버튼 노출 결정
  const [hasDriveCopy, setHasDriveCopy] = useState(false);
  // HWP 인라인 미리보기를 위한 Drive Preview URL
  const [hwpPreviewUrl, setHwpPreviewUrl] = useState<string | null>(null);
  const [hwpPreviewLoading, setHwpPreviewLoading] = useState(false);
  const [hwpPreviewError, setHwpPreviewError] = useState<string | null>(null);

  // OG metadata for "other" / "notion" / "github" link cards
  const [ogMeta, setOgMeta] = useState<{ title?: string; description?: string; image?: string; site_name?: string } | null>(null);
  const [ogLoading, setOgLoading] = useState(false);

  // PDF comments
  const [comments, setComments] = useState<FileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsDegraded, setCommentsDegraded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newPage, setNewPage] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (kind !== "pdf") return;
    setCommentsLoading(true);
    setCommentsDegraded(false);
    try {
      const r = await fetch(
        `/api/file-comments?file_id=${encodeURIComponent(file.id)}&file_table=${encodeURIComponent(targetTable)}`,
        { cache: "no-store" },
      );
      if (r.status === 404 || r.status === 500) {
        // migration maybe not applied
        setCommentsDegraded(true);
        setComments([]);
        return;
      }
      const json = await r.json();
      if (!r.ok) {
        // Probably missing table
        setCommentsDegraded(true);
        setComments([]);
        return;
      }
      setComments(Array.isArray(json.items) ? json.items : []);
    } catch {
      setCommentsDegraded(true);
    } finally {
      setCommentsLoading(false);
    }
  }, [kind, file.id, targetTable]);

  // Fetch OG metadata for link-card kinds (notion, github, other) with HTTP(S) URL
  useEffect(() => {
    if (!open) return;
    // OG 메타가 유의미한 모든 카드형 kind 에서 페치 (gist/codepen/tiktok/instagram/miro/slideshare 등은 임베드 실패 시 ExternalCard 폴백 → og 표시).
    const ogKinds: FileKind[] = ["notion", "github", "other", "gist", "codepen", "tiktok", "instagram", "miro", "slideshare"];
    if (!ogKinds.includes(kind)) return;
    if (!/^https?:\/\//i.test(file.url)) return;

    // 세션 캐시 (브라우저 HTTP 캐시 외에 client-side dedup)
    const cacheKey = `nu:og:${file.url}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setOgMeta(JSON.parse(cached));
        return;
      }
    } catch {}

    let cancelled = false;
    setOgLoading(true);
    setOgMeta(null);
    fetch(`/api/og?url=${encodeURIComponent(file.url)}`, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || data.error) return;
        const meta = {
          title: data.title || undefined,
          description: data.description || undefined,
          image: data.image || undefined,
          site_name: data.site_name || undefined,
        };
        setOgMeta(meta);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(meta)); } catch {}
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOgLoading(false); });
    return () => { cancelled = true; };
  }, [open, kind, file.url]);

  useEffect(() => {
    if (!open) return;
    if (kind !== "pdf") return;
    loadComments();
    createClient().auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, [open, kind, loadComments]);

  // Office/HWP/PDF 파일에 본인의 Drive 사본이 이미 있는지 확인 — sync-back 버튼 노출용
  // Migration 131 (file_drive_edits) 우선, 130 폴백.
  useEffect(() => {
    if (!open) return;
    if (kind !== "office" && kind !== "hwp" && kind !== "pdf") return;
    if (!file.id) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const myUserId = auth.user?.id || null;
      if (!myUserId) return;

      // a) 131
      const { data: fde } = await supabase
        .from("file_drive_edits")
        .select("drive_file_id")
        .eq("resource_table", targetTable)
        .eq("resource_id", file.id)
        .eq("user_id", myUserId)
        .maybeSingle();
      if (cancelled) return;
      if (fde?.drive_file_id) {
        setHasDriveCopy(true);
        return;
      }

      // b) 130 폴백
      const { data: legacy } = await supabase
        .from(targetTable)
        .select("drive_edit_file_id, drive_edit_user_id")
        .eq("id", file.id)
        .maybeSingle();
      if (cancelled) return;
      setHasDriveCopy(
        !!(legacy as any)?.drive_edit_file_id && (legacy as any)?.drive_edit_user_id === myUserId,
      );
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [open, kind, file.id, targetTable]);

  async function postComment() {
    const content = newComment.trim();
    if (!content) return;
    setPosting(true);
    try {
      const r = await fetch("/api/file-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: file.id,
          file_table: targetTable,
          content,
          page: newPage ? Number(newPage) : undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "전송 실패");
      setNewComment("");
      setNewPage("");
      await loadComments();
    } catch (e: unknown) {
      toast.error((e as Error).message || "코멘트 추가 실패");
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(id: string) {
    if (!confirm("이 코멘트를 삭제할까요?")) return;
    try {
      const r = await fetch(`/api/file-comments/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
      setComments((list) => list.filter((c) => c.id !== id));
    } catch (e: unknown) {
      toast.error((e as Error).message || "삭제 실패");
    }
  }

  /** HWP 변환 — POST 로 사전 변환(캐시 워밍) → 성공 시 GET URL 을 iframe src 로.
   *  same-origin GET URL 이라 브라우저 PDF 뷰어가 안정적으로 인라인 렌더 (blob URL 다운로드 우회).
   *  실패 시 명확한 에러 + 토스트 (silent fallback to download 안 함). */
  async function loadHwpPreview() {
    if (hwpPreviewUrl || hwpPreviewLoading) return;
    setHwpPreviewLoading(true);
    setHwpPreviewError(null);
    try {
      // 1) POST 로 변환 + 서버 캐시 적재
      const r = await fetch("/api/personal/hwp-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: file.url, file_name: file.name }),
      });
      if (!r.ok) {
        let errMsg = `변환 실패 (${r.status})`;
        try {
          const json = await r.json();
          if (json.code === "NOT_CONNECTED") {
            errMsg = "Google 계정 연결이 필요합니다. /settings/integrations 에서 연결 후 다시 시도하세요.";
          } else if (json.code === "TOKEN_EXPIRED") {
            errMsg = "Google 토큰이 만료됐어요. /settings/integrations 에서 다시 연결해주세요.";
          } else {
            errMsg = json.error || errMsg;
          }
        } catch {}
        console.error("[hwp-preview] POST failed", { status: r.status, errMsg });
        setHwpPreviewError(errMsg);
        toast.error("HWP 미리보기 실패: " + errMsg);
        return;
      }

      // 2) PDF 응답 검증 — Content-Type 이 application/pdf 인지 확인
      const ct = r.headers.get("content-type") || "";
      if (!ct.toLowerCase().includes("pdf")) {
        const errMsg = `예상한 PDF 응답이 아닙니다 (Content-Type: ${ct})`;
        console.error("[hwp-preview] unexpected content-type", { ct });
        setHwpPreviewError(errMsg);
        toast.error(errMsg);
        return;
      }
      // 응답 본문은 폐기 (iframe 이 GET 으로 다시 받을 것)
      await r.arrayBuffer().catch(() => null);

      // 3) iframe src = same-origin GET URL → 캐시된 PDF 즉시 인라인 렌더
      const params = new URLSearchParams({ file_url: file.url, file_name: file.name });
      setHwpPreviewUrl(`/api/personal/hwp-preview?${params.toString()}`);
    } catch (e: unknown) {
      const msg = (e as Error).message || "변환 중 오류";
      console.error("[hwp-preview] exception", e);
      setHwpPreviewError(msg);
      toast.error("HWP 미리보기 실패: " + msg);
    } finally {
      setHwpPreviewLoading(false);
    }
  }

  async function openInGoogleDocs() {
    setOfficeOpening(true);
    try {
      const r = await fetch("/api/google/drive/upload-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: file.url,
          file_name: file.name,
          convert: true,
          // 같은 자료실 행에 대해 두 번째 클릭부터는 기존 사본 재사용
          link_table: targetTable,
          link_id: file.id,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.web_view_link) {
        if (json.code === "NOT_CONNECTED") {
          toast.error("Google 계정을 먼저 연결해주세요 (설정)");
        } else {
          toast.error(json.error || "Drive 업로드 실패");
        }
        return;
      }
      setHasDriveCopy(true);
      window.open(json.web_view_link, "_blank", "noopener,noreferrer");
      if (json.reused) {
        toast.success("기존 Drive 사본을 다시 열었어요. 편집 후 [R2 로 동기화] 누르면 원본이 갱신됩니다.");
      } else {
        toast.success("Drive 사본을 만들었어요. 편집 후 [R2 로 동기화] 누르면 원본이 갱신됩니다.");
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || "실패");
    } finally {
      setOfficeOpening(false);
    }
  }

  /** 버전 목록 조회 — 모달 열 때 호출 */
  async function loadVersions() {
    if (!file.id) return;
    setVersionsLoading(true);
    try {
      const r = await fetch(
        `/api/files/versions?table=${encodeURIComponent(targetTable)}&id=${encodeURIComponent(file.id)}`,
        { cache: "no-store" },
      );
      const json = await r.json();
      if (!r.ok) {
        if (json?.code === "MIGRATION_MISSING") {
          toast.error("버전 기능이 활성화되지 않았어요 (마이그레이션 132 필요)");
        } else {
          toast.error(json?.error || "버전 조회 실패");
        }
        setVersions([]);
        return;
      }
      setVersions(json.versions || []);
    } catch (e: unknown) {
      toast.error((e as Error).message || "버전 조회 실패");
    } finally {
      setVersionsLoading(false);
    }
  }

  async function restoreVersion(versionId: string) {
    if (!confirm("이 백업본으로 되돌릴까요? 현재 콘텐츠는 새 백업으로 보관돼요.")) return;
    setRestoring(versionId);
    try {
      const r = await fetch("/api/files/versions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      const json = await r.json();
      if (!r.ok) {
        toast.error(json?.error || "복원 실패");
        return;
      }
      toast.success("이전 버전으로 복원했어요");
      setVersion(Date.now()); // iframe/이미지 캐시 버스트
      setVersionsOpen(false);
      onUpdated?.({ url: file.url });
      // 목록 새로고침 (복원 직전 자동 백업이 추가됨)
      await loadVersions();
    } catch (e: unknown) {
      toast.error((e as Error).message || "복원 실패");
    } finally {
      setRestoring(null);
    }
  }

  /** Drive 에서 편집한 변경사항을 같은 R2 키에 덮어쓰기 — 자료실 카드 그대로 갱신.
   *  Drive 변경 없으면 no-op + 안내 토스트. R2 PUT 실패 시 명확한 에러 (Drive 사본은 보존됨). */
  async function syncFromDrive(opts: { force?: boolean } = {}) {
    setSyncing(true);
    try {
      const r = await fetch("/api/files/sync-from-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_table: targetTable, link_id: file.id, force: !!opts.force }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json?.code === "R2_PUT_FAILED") {
          toast.error(`R2 업로드 실패 — Drive 사본은 보존돼 있습니다. 잠시 후 다시 시도해 주세요.`);
        } else {
          toast.error(json?.error || "동기화 실패");
        }
        return;
      }
      if (json.unchanged) {
        toast(json.message || "Drive 사본에 변경사항이 없어요");
        return;
      }
      toast.success("Drive 변경사항을 자료실에 반영했어요");
      // 캐시 버스터로 iframe / 이미지 새로고침
      setVersion(Date.now());
      onUpdated?.({ url: file.url });
    } catch (e: unknown) {
      toast.error((e as Error).message || "동기화 실패");
    } finally {
      setSyncing(false);
    }
  }

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) return;
        onClose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, editing]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  // Fetch text content when text kind
  useEffect(() => {
    if (!open) return;
    if (kind !== "text" && !(kind === "html" && showHtmlSource)) return;
    let cancelled = false;
    // Kick off lazy hljs load alongside text fetch.
    if (!hljsLib) {
      loadHljs().then((lib) => { if (!cancelled) setHljsLib(lib); }).catch(() => {});
    }
    setLoadingText(true);
    setTextError(null);
    fetch(inlineUrl, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        if (cancelled) return;
        setTextContent(t);
        setOriginalText(t);
      })
      .catch((e) => {
        if (cancelled) return;
        setTextError(e?.message || "불러오기 실패");
      })
      .finally(() => !cancelled && setLoadingText(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, inlineUrl, showHtmlSource]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(file.url);
      toast.success("링크가 복사되었습니다");
    } catch {
      toast.error("복사 실패");
    }
    setMenuOpen(false);
  }

  async function handleSaveText() {
    if (!isR2 || !file.storage_key) {
      toast.error("R2 파일만 편집할 수 있습니다");
      return;
    }
    setSaving(true);
    try {
      const mime = guessMime(file.name, file.mime);
      const bytes = new TextEncoder().encode(textContent);
      // 1) presign with overwrite_key
      const presignRes = await fetch("/api/storage/r2/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: "resources",
          fileName: file.name,
          contentType: mime,
          size: bytes.byteLength,
          overwrite_key: file.storage_key,
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok || !presign.configured || !presign.url) {
        throw new Error(presign.error || "presign 실패");
      }
      // 2) PUT
      const putRes = await fetch(presign.url, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: bytes,
      });
      if (!putRes.ok) throw new Error(`PUT 실패 ${putRes.status}`);

      // 3) Update DB row updated_at + file_size
      const supabase = createClient();
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (targetTable === "file_attachments") {
        updates.file_size = bytes.byteLength;
      }
      const { error } = await supabase.from(targetTable).update(updates).eq("id", file.id);
      if (error) {
        // Not fatal — file saved to R2 already
        console.warn("[FilePreviewPanel] DB update failed:", error.message);
      }

      setOriginalText(textContent);
      setEditing(false);
      setVersion(Date.now());
      toast.success("저장 완료");
      onUpdated?.({ url: file.url });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const dirty = editing && textContent !== originalText;

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-nu-ink/70 backdrop-blur-sm"
        onClick={() => {
          if (dirty) {
            if (!confirm("저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?")) return;
          }
          onClose();
        }}
      />

      {/* Sheet — right side on desktop, full on mobile */}
      <div
        className="relative ml-auto w-full md:w-1/2 h-full bg-nu-paper border-0 md:border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-nu-ink bg-nu-cream/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0 text-nu-ink">{iconFor(kind)}</div>
            <div className="min-w-0">
              <p className="font-head text-sm font-black text-nu-ink truncate">{file.name}</p>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted truncate">
                {kind.toUpperCase()}
                {file.size ? ` · ${prettySize(file.size)}` : ""}
                {isR2 ? " · R2" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canTextEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5"
                title="편집"
              >
                <Edit3 size={12} /> 편집
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleSaveText}
                  disabled={saving || !dirty}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  저장
                </button>
                <button
                  onClick={() => {
                    if (dirty && !confirm("변경사항이 사라집니다. 취소하시겠습니까?")) return;
                    setTextContent(originalText);
                    setEditing(false);
                  }}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink/10 transition-all"
                >
                  취소
                </button>
              </>
            )}

            {/* Actions menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all"
                title="작업"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-nu-paper border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] z-10">
                  <a
                    href={file.url}
                    download={file.name}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink hover:bg-nu-cream/40 no-underline border-b border-nu-ink/10"
                  >
                    <Download size={12} /> 다운로드
                  </a>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink hover:bg-nu-cream/40 no-underline border-b border-nu-ink/10"
                  >
                    <ExternalLink size={12} /> 새 탭에서 열기
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink hover:bg-nu-cream/40 text-left border-b border-nu-ink/10"
                  >
                    <Copy size={12} /> 링크 복사
                  </button>
                  {isR2 && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setVersionsOpen(true);
                        loadVersions();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink hover:bg-nu-cream/40 text-left"
                    >
                      <History size={12} /> 이전 버전
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (dirty && !confirm("저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?")) return;
                onClose();
              }}
              className="p-1.5 text-nu-muted hover:text-nu-ink"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-nu-white">
          {kind === "pdf" && (
            <div className="w-full h-full flex flex-col md:flex-row">
              {/* PDF viewer */}
              <div className="flex-1 min-h-[40vh] md:min-h-0 flex flex-col">
                <iframe src={inlineUrl} title={file.name} className="w-full flex-1 border-0" />
                <div className="border-t border-nu-ink/10 bg-nu-cream/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-nu-muted">
                    {hasDriveCopy
                      ? "Drive 사본이 연결돼 있어요 — 편집 후 [R2 로 동기화]"
                      : "주석/마크업이 필요하면 Drive 로 보내서 편집하세요"}
                  </p>
                  <div className="flex items-center gap-2">
                    {hasDriveCopy && (
                      <button
                        onClick={() => syncFromDrive()}
                        disabled={syncing}
                        className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Drive 변경사항을 R2 원본에 덮어쓰기"
                      >
                        {syncing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        R2 로 동기화
                      </button>
                    )}
                    <button
                      onClick={() => setPdfAnnotating(true)}
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-pink text-nu-pink hover:bg-nu-pink hover:text-white transition-all flex items-center gap-1.5"
                      title="형광·펜·텍스트로 직접 주석 — 새 PDF 로 저장"
                    >
                      <Pencil size={12} />
                      직접 주석
                    </button>
                    <button
                      onClick={openInGoogleDocs}
                      disabled={officeOpening}
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {officeOpening ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      {hasDriveCopy ? "Drive 에서 계속 편집" : "Drive 에서 주석"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments sidebar */}
              <aside className="w-full md:w-[30%] md:min-w-[260px] md:max-w-[360px] border-t-[3px] md:border-t-0 md:border-l-[3px] border-nu-ink bg-nu-cream/30 flex flex-col">
                <div className="px-3 py-2 border-b-[2px] border-nu-ink bg-nu-paper shrink-0 flex items-center gap-2">
                  <MessageSquare size={14} className="text-nu-pink" />
                  <span className="font-head text-[13px] font-black text-nu-ink">
                    코멘트 {commentsDegraded ? "" : comments.length}
                  </span>
                </div>

                <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
                  {commentsDegraded ? (
                    <div className="text-center py-6">
                      <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
                        코멘트 기능 준비 중
                      </p>
                      <p className="text-[11px] text-nu-muted mt-1">
                        (migration 108 적용 필요)
                      </p>
                    </div>
                  ) : commentsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={16} className="animate-spin text-nu-muted" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-[12px] text-nu-muted text-center py-6">
                      첫 코멘트를 남겨보세요
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="bg-nu-paper border-[2px] border-nu-ink p-2">
                        <div className="flex items-center gap-2 mb-1">
                          {c.author?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.author.avatar_url} alt="" className="w-6 h-6 border border-nu-ink/30" />
                          ) : (
                            <div className="w-6 h-6 border border-nu-ink/30 bg-nu-cream flex items-center justify-center text-[10px] font-bold">
                              {(c.author?.nickname || "?").slice(0, 1)}
                            </div>
                          )}
                          <span className="text-[12px] font-bold text-nu-ink truncate">
                            {c.author?.nickname || "사용자"}
                          </span>
                          <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
                            {relTime(c.created_at)}
                          </span>
                          {c.page && (
                            <span className="font-mono-nu text-[10px] text-nu-pink ml-auto">
                              p.{c.page}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-nu-ink whitespace-pre-wrap break-words leading-snug">
                          {c.content}
                        </p>
                        {currentUserId === c.user_id && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="mt-1 text-nu-muted hover:text-nu-red flex items-center gap-1 text-[10px]"
                          >
                            <Trash2 size={10} /> 삭제
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!commentsDegraded && (
                  <div className="border-t-[2px] border-nu-ink bg-nu-paper p-2 shrink-0 space-y-1.5">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="코멘트를 입력하세요"
                      rows={2}
                      className="w-full border-[2px] border-nu-ink px-2 py-1.5 text-[12px] outline-none focus:border-nu-pink resize-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        placeholder="페이지"
                        value={newPage}
                        onChange={(e) => setNewPage(e.target.value)}
                        className="w-20 border-[2px] border-nu-ink px-2 py-1 text-[12px] outline-none focus:border-nu-pink"
                      />
                      <button
                        onClick={postComment}
                        disabled={posting || !newComment.trim()}
                        className="ml-auto font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        추가
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}

          {kind === "image" && (
            <div className="w-full h-full flex flex-col">
              <div
                className={`flex-1 flex items-center justify-center p-4 bg-nu-ink/5 ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
                onClick={() => setZoomed((z) => !z)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inlineUrl}
                  alt={file.name}
                  className={zoomed ? "max-w-none cursor-zoom-out" : "max-w-full max-h-full object-contain cursor-zoom-in"}
                />
              </div>
              {canEdit && (
                <div className="border-t border-nu-ink/10 bg-nu-cream/20 px-3 py-2 flex items-center justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAnnotating(true); }}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5"
                  >
                    <Pencil size={12} /> 주석 추가
                  </button>
                </div>
              )}
            </div>
          )}

          {kind === "video" && (
            <div className="w-full h-full flex items-center justify-center bg-nu-ink">
              <video src={inlineUrl} controls className="w-full max-h-full">
                <track kind="captions" />
              </video>
            </div>
          )}

          {kind === "audio" && (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-6 bg-nu-cream/20">
              <div className="w-32 h-32 border-[3px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_#0D0F14] flex items-center justify-center">
                <FileAudio size={56} className="text-nu-pink" />
              </div>
              <p className="font-head text-sm font-bold text-nu-ink truncate max-w-full">{file.name}</p>
              <audio src={inlineUrl} controls className="w-full max-w-md" />
            </div>
          )}

          {kind === "text" && (
            <div className="w-full h-full flex flex-col">
              {loadingText && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-nu-muted" />
                </div>
              )}
              {textError && !loadingText && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <AlertCircle size={24} className="text-nu-pink" />
                  <p className="text-sm font-bold text-nu-ink">불러오기 실패</p>
                  <p className="text-[12px] text-nu-muted">{textError}</p>
                </div>
              )}
              {!loadingText && !textError && editing && (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  spellCheck={false}
                  className="w-full flex-1 p-4 font-mono-nu text-[12px] leading-6 text-nu-ink bg-nu-white border-0 outline-none resize-none"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                />
              )}
              {!loadingText && !textError && !editing && (() => {
                const lang = detectLang(file.name);
                let html = "";
                const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                if (!hljsLib) {
                  // hljs still loading — render escaped plain text as a graceful fallback.
                  html = escape(textContent);
                } else {
                  try {
                    if (lang && lang !== "plaintext" && hljsLib.getLanguage(lang)) {
                      html = hljsLib.highlight(textContent, { language: lang, ignoreIllegals: true }).value;
                    } else {
                      html = hljsLib.highlightAuto(textContent).value;
                    }
                  } catch {
                    html = escape(textContent);
                  }
                }
                return (
                  <pre className="w-full flex-1 overflow-auto p-4 text-[12px] leading-6 bg-nu-cream/10 m-0">
                    <code
                      className={`hljs language-${lang}`}
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", background: "transparent" }}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </pre>
                );
              })()}
              {editing && (
                <div className="px-4 py-2 border-t-[2px] border-nu-ink bg-nu-amber/10 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono-nu uppercase tracking-widest text-nu-ink">
                    {dirty ? "• 변경사항 있음" : "저장됨"}
                  </span>
                  <span className="font-mono-nu text-nu-muted">{textContent.length} chars · {new Blob([textContent]).size} bytes</span>
                </div>
              )}
            </div>
          )}

          {kind === "html" && (
            <div className="w-full h-full flex flex-col">
              {!showHtmlSource ? (
                <div className="flex-1 min-h-0">
                  <iframe
                    src={inlineUrl}
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    className="w-full h-full border-0"
                    title={file.name}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-auto">
                  {loadingText && (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={20} className="animate-spin text-nu-muted" />
                    </div>
                  )}
                  {textError && !loadingText && (
                    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <AlertCircle size={24} className="text-nu-pink" />
                      <p className="text-sm font-bold text-nu-ink">불러오기 실패</p>
                      <p className="text-[12px] text-nu-muted">{textError}</p>
                    </div>
                  )}
                  {!loadingText && !textError && (() => {
                    let html = "";
                    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    if (!hljsLib) {
                      html = escape(textContent);
                    } else {
                      try {
                        html = hljsLib.highlight(textContent, { language: "html", ignoreIllegals: true }).value;
                      } catch {
                        html = escape(textContent);
                      }
                    }
                    return (
                      <pre className="w-full p-4 text-[12px] leading-6 bg-nu-cream/10 m-0">
                        <code
                          className="hljs language-html"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", background: "transparent" }}
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      </pre>
                    );
                  })()}
                </div>
              )}
              <div className="border-t-[2px] border-nu-ink/10 p-2 flex justify-end bg-nu-cream/20 shrink-0">
                <button
                  onClick={() => setShowHtmlSource((s) => !s)}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all"
                >
                  {showHtmlSource ? "🖥️ 렌더링 보기" : "🔍 원본 코드 보기"}
                </button>
              </div>
            </div>
          )}

          {kind === "office" && (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`}
                title={file.name}
                className="w-full flex-1 border-0"
              />
              <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-nu-muted">
                  {hasDriveCopy ? "Drive 사본이 연결돼 있어요 — 편집 후 [R2 로 동기화] 누르면 원본 갱신" : "편집하려면 Google Docs 로 복사해서 여세요"}
                </p>
                <div className="flex items-center gap-2">
                  {hasDriveCopy && (
                    <button
                      onClick={() => syncFromDrive()}
                      disabled={syncing}
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Drive 변경사항을 R2 원본에 덮어쓰기"
                    >
                      {syncing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      R2 로 동기화
                    </button>
                  )}
                  <button
                    onClick={openInGoogleDocs}
                    disabled={officeOpening}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {officeOpening ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                    {hasDriveCopy ? "Drive 에서 계속 편집" : "Google Docs 에서 편집"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {kind === "hwp" && (
            <div className="w-full h-full flex flex-col">
              {/* HWP 인라인 미리보기 — Google Drive 자동 변환 → Doc /preview 임베드.
                  이유: Google Docs Viewer (?url=) 는 HWP 인라인 렌더가 불안정 (다운로드 폴백).
                  Drive 변환 경로는 사용자 OAuth 필요하지만 정확하고 편집까지 1클릭. */}
              {hwpPreviewUrl ? (
                <iframe
                  src={hwpPreviewUrl}
                  title={file.name}
                  className="w-full flex-1 border-0"
                  allow="autoplay"
                  onError={() => {
                    const msg = "PDF 뷰어 로드 실패 — 변환은 됐지만 브라우저가 표시하지 못했습니다";
                    console.error("[hwp-preview] iframe onError", { url: hwpPreviewUrl });
                    setHwpPreviewError(msg);
                    setHwpPreviewUrl(null);
                    toast.error(msg);
                  }}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-cream/40 flex items-center justify-center text-3xl">
                    📄
                  </div>
                  <div>
                    <p className="text-sm font-bold text-nu-ink mb-1">한글(HWP) 파일</p>
                    <p className="text-[12px] text-nu-muted max-w-md">
                      미리보기를 위해 Google Drive 로 자동 변환합니다 (한 번 변환 후 Doc 으로 저장).
                    </p>
                  </div>
                  {hwpPreviewError ? (
                    <div className="w-full max-w-md border-[2px] border-red-400 bg-red-50 p-3 text-left">
                      <p className="text-[12px] font-bold text-red-700 mb-1">변환 실패</p>
                      <p className="text-[11px] text-red-600 break-words">{hwpPreviewError}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      onClick={loadHwpPreview}
                      disabled={hwpPreviewLoading}
                      className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {hwpPreviewLoading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                      {hwpPreviewLoading ? "변환 중..." : (hwpPreviewError ? "다시 시도" : "🔍 미리보기 변환")}
                    </button>
                    <a
                      href={file.url}
                      download={file.name}
                      className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
                    >
                      <Download size={13} /> 다운로드
                    </a>
                  </div>
                </div>
              )}
              <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-nu-muted">
                  {hasDriveCopy
                    ? "Drive 사본이 연결돼 있어요 — 편집 후 [R2 로 동기화] 누르면 원본 갱신"
                    : (hwpPreviewUrl ? "Google Drive 로 변환된 미리보기 (서식 일부 차이 가능)" : "변환 시 내 Google Drive 에 사본 생성")}
                </p>
                <div className="flex items-center gap-2">
                  {hasDriveCopy && (
                    <button
                      onClick={() => syncFromDrive()}
                      disabled={syncing}
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Drive 변경사항을 R2 원본에 덮어쓰기"
                    >
                      {syncing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      R2 로 동기화
                    </button>
                  )}
                  <button
                    onClick={openInGoogleDocs}
                    disabled={officeOpening}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
                    aria-label="Google Drive 로 가져와 편집"
                  >
                    {officeOpening ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                    {hasDriveCopy ? "Drive 에서 계속 편집" : "Drive 로 편집"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {kind === "youtube" && (() => {
            const embed = toYoutubeEmbed(file.url);
            if (embed) {
              return (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <iframe
                    src={embed}
                    title={file.name}
                    className="w-full h-full border-0"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              );
            }
            return (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center bg-nu-cream/20">
                <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-paper flex items-center justify-center text-3xl">
                  ▶️
                </div>
                <div>
                  <p className="text-sm font-bold text-nu-ink mb-1">YouTube 채널 / 플레이리스트</p>
                  <p className="text-[12px] text-nu-muted max-w-md break-all">
                    이 URL 은 YouTube 정책상 사이트 내 미리보기를 차단합니다 (X-Frame-Options).
                  </p>
                </div>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
                >
                  <ExternalLink size={13} /> YouTube 에서 열기
                </a>
              </div>
            );
          })()}

          {kind === "gdrive" && (() => {
            const embed = toGdriveEmbed(file.url);
            if (embed) {
              return (
                <div className="w-full h-full flex flex-col">
                  <iframe
                    src={embed}
                    title={file.name}
                    className="w-full flex-1 border-0"
                    allow="autoplay"
                  />
                  <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-nu-muted">
                      Google Drive 미리보기 — 편집은 새 탭에서
                    </p>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} /> Drive 에서 편집
                    </a>
                  </div>
                </div>
              );
            }
            // fallback — embed 변환 실패
            return (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center">
                <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-cream/40 flex items-center justify-center text-3xl">📁</div>
                <p className="text-sm font-bold text-nu-ink">Google Drive 파일</p>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
                >
                  <ExternalLink size={13} /> Drive 에서 열기
                </a>
              </div>
            );
          })()}

          {kind === "vimeo" && (() => {
            const m = file.url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || file.url.match(/player\.vimeo\.com\/video\/(\d+)/);
            if (!m) {
              return (
                <ExternalCard url={file.url} name={file.name} icon="🎬" label="Vimeo" />
              );
            }
            return (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <iframe
                  src={`https://player.vimeo.com/video/${m[1]}`}
                  title={file.name}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          })()}

          {kind === "loom" && (() => {
            const m = file.url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="📹" label="Loom" />;
            return (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <iframe
                  src={`https://www.loom.com/embed/${m[1]}`}
                  title={file.name}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            );
          })()}

          {kind === "figma" && (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`https://www.figma.com/embed?embed_host=nutunion&url=${encodeURIComponent(file.url)}`}
                title={file.name}
                className="w-full flex-1 border-0"
                allow="fullscreen"
                allowFullScreen
              />
              <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-nu-muted">Figma 미리보기 — 편집은 새 탭에서</p>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> Figma 에서 열기
                </a>
              </div>
            </div>
          )}

          {kind === "tweet" && (
            <div className="w-full h-full flex flex-col bg-nu-cream/20">
              <iframe
                src={`https://twitframe.com/show?url=${encodeURIComponent(file.url)}`}
                title={file.name}
                className="w-full flex-1 border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
              />
              <div className="border-t-[2px] border-nu-ink bg-nu-paper px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-nu-muted">트윗 미리보기 (twitframe)</p>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> X 에서 열기
                </a>
              </div>
            </div>
          )}

          {kind === "spotify" && (() => {
            // /track/X /album/X /playlist/X /episode/X /show/X /artist/X → /embed/{type}/{id}
            const m = file.url.match(/open\.spotify\.com\/(?:embed\/)?(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="🎵" label="Spotify" />;
            const isTrack = m[1] === "track" || m[1] === "episode";
            return (
              <div className={`w-full h-full ${isTrack ? "flex items-center justify-center p-4 bg-nu-cream/20" : ""}`}>
                <iframe
                  src={`https://open.spotify.com/embed/${m[1]}/${m[2]}`}
                  title={file.name}
                  className={isTrack ? "w-full max-w-2xl border-0" : "w-full h-full border-0"}
                  style={isTrack ? { height: 232 } : undefined}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            );
          })()}

          {kind === "soundcloud" && (
            <div className="w-full h-full p-4 bg-nu-cream/20 flex items-center justify-center">
              <iframe
                src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(file.url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                title={file.name}
                className="w-full max-w-3xl border-0"
                style={{ height: 166 }}
                allow="autoplay"
                loading="lazy"
              />
            </div>
          )}

          {kind === "gist" && (() => {
            // gist.github.com/{user}/{id} → raw 콘텐츠 fetch + hljs 하이라이트.
            // gist 는 공식 임베드가 <script> 태그 의존이라 iframe 비호환 → text 모드 재사용.
            const m = file.url.match(/gist\.github\.com\/([^/]+)\/([\w]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="📝" label="GitHub Gist" og={ogMeta} ogLoading={ogLoading} />;
            const rawUrl = `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`;
            return (
              <div className="w-full h-full flex flex-col">
                <iframe
                  src={`https://gist.github.com/${m[1]}/${m[2]}.pibb`}
                  title={file.name}
                  className="w-full flex-1 border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin"
                  loading="lazy"
                />
                <div className="border-t-[2px] border-nu-ink bg-nu-cream/30 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-nu-muted">GitHub Gist · 코드 임베드</p>
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} /> Raw 보기
                  </a>
                </div>
              </div>
            );
          })()}

          {kind === "codepen" && (() => {
            // codepen.io/{user}/pen/{slug} → /embed/{slug}
            const m = file.url.match(/codepen\.io\/([^/]+)\/(?:pen|embed)\/([^/?#]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="✨" label="CodePen" og={ogMeta} ogLoading={ogLoading} />;
            return (
              <iframe
                src={`https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result&theme-id=light`}
                title={file.name}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
              />
            );
          })()}

          {kind === "tiktok" && (() => {
            // tiktok.com/@user/video/{id} → tiktok.com/embed/v2/{id}
            const m = file.url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/) || file.url.match(/tiktok\.com\/v\/(\d+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="🎬" label="TikTok" og={ogMeta} ogLoading={ogLoading} />;
            return (
              <div className="w-full h-full flex items-center justify-center bg-black p-4">
                <iframe
                  src={`https://www.tiktok.com/embed/v2/${m[1]}`}
                  title={file.name}
                  className="w-full max-w-md h-full border-0"
                  allow="encrypted-media; fullscreen"
                  loading="lazy"
                />
              </div>
            );
          })()}

          {kind === "instagram" && (() => {
            // instagram.com/p/{shortcode}/ → /p/{shortcode}/embed/captioned/
            const m = file.url.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="📸" label="Instagram" og={ogMeta} ogLoading={ogLoading} />;
            return (
              <div className="w-full h-full flex items-center justify-center bg-nu-cream/20 p-4 overflow-y-auto">
                <iframe
                  src={`https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`}
                  title={file.name}
                  className="w-full max-w-md border-0 bg-white"
                  style={{ height: 700 }}
                  scrolling="no"
                  loading="lazy"
                />
              </div>
            );
          })()}

          {kind === "miro" && (() => {
            // miro.com/app/board/{id}=/?... → embed
            const m = file.url.match(/miro\.com\/app\/board\/([^/?#=]+)/);
            if (!m) return <ExternalCard url={file.url} name={file.name} icon="🧩" label="Miro" og={ogMeta} ogLoading={ogLoading} />;
            return (
              <iframe
                src={`https://miro.com/app/live-embed/${m[1]}/?embedMode=view_only_without_ui`}
                title={file.name}
                className="w-full h-full border-0"
                allow="fullscreen; clipboard-read; clipboard-write"
                loading="lazy"
              />
            );
          })()}

          {kind === "slideshare" && (
            <div className="w-full h-full">
              {/* SlideShare 는 oEmbed 가 필요해서 정확한 embed URL 추출이 어려움 →
                  OG 카드 + 새 탭 열기로 폴백 (대부분 사례 충분). */}
              <ExternalCard url={file.url} name={file.name} icon="🖼️" label="SlideShare" og={ogMeta} ogLoading={ogLoading} />
            </div>
          )}

          {(kind === "notion" || kind === "github") && (
            <ExternalCard
              url={file.url}
              name={file.name}
              icon={kind === "notion" ? "📓" : "🐙"}
              label={kind === "notion" ? "Notion" : "GitHub"}
              og={ogMeta}
              ogLoading={ogLoading}
              note={kind === "notion"
                ? "Notion 페이지는 보안 정책상 임베드 미리보기를 차단합니다"
                : "GitHub 페이지는 임베드를 차단합니다"}
            />
          )}

          {kind === "other" && (
            <ExternalCard
              url={file.url}
              name={file.name}
              icon="📎"
              label={(() => {
                const ext = file.name.split(".").pop()?.toUpperCase() || "";
                return ext.length <= 8 && ext !== file.name.toUpperCase() ? ext : "파일";
              })()}
              og={ogMeta}
              ogLoading={ogLoading}
              showDownload
            />
          )}
        </div>
      </div>

      {annotating && kind === "image" && (
        <ImageAnnotator
          imageUrl={inlineUrl}
          originalName={file.name}
          scopeId={file.id}
          onClose={() => setAnnotating(false)}
          onSaved={(newUrl) => {
            setAnnotating(false);
            setVersion(Date.now());
            onUpdated?.({ url: newUrl });
          }}
        />
      )}

      {pdfAnnotating && kind === "pdf" && (
        <PdfAnnotator
          pdfUrl={inlineUrl}
          fileName={file.name}
          onSaved={(newUrl: string) => {
            setPdfAnnotating(false);
            toast.success("주석본이 새 자료로 등록됐어요. 자료실 새로고침해 주세요.");
            onUpdated?.({ url: newUrl });
          }}
          onClose={() => setPdfAnnotating(false)}
        />
      )}

      {versionsOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setVersionsOpen(false)}
        >
          <div
            className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between bg-nu-cream/30">
              <div className="flex items-center gap-2">
                <History size={14} className="text-nu-pink" />
                <span className="font-head text-[13px] font-black text-nu-ink">이전 버전</span>
              </div>
              <button
                onClick={() => setVersionsOpen(false)}
                className="p-1 text-nu-muted hover:text-nu-ink"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {versionsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-nu-muted" />
                </div>
              ) : versions.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-nu-muted">
                  아직 백업된 버전이 없어요. Drive 동기화 시점에 자동으로 백업됩니다.
                </div>
              ) : (
                <ul className="divide-y divide-nu-ink/10">
                  {versions.map((v) => (
                    <li key={v.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-nu-ink truncate">
                          {v.label || "백업"}
                        </p>
                        <p className="font-mono-nu text-[10px] text-nu-muted">
                          {new Date(v.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreVersion(v.id)}
                        disabled={restoring === v.id}
                        className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {restoring === v.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RotateCcw size={11} />
                        )}
                        복원
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 py-2 border-t-[2px] border-nu-ink bg-nu-cream/20">
              <p className="text-[10px] text-nu-muted">
                자료당 최대 5개 보관 · Drive 동기화 직전·복원 직전 자동 백업
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Reusable card for non-embeddable URLs (notion, github, other, fallback).
 *  Shows OG metadata (title, description, image) when available — otherwise
 *  the file name + icon + open/download buttons. */
function ExternalCard({
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

/** Helper: 해당 파일이 텍스트 편집 가능한지 판단 (리스트 UI 에서 ✏️ 뱃지용) */
export function isTextEditableFile(name: string, mime?: string | null, storage_type?: string | null): boolean {
  if (storage_type !== "r2") return false;
  return detectKind(name, mime) === "text";
}
