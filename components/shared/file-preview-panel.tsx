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
} from "lucide-react";
import { toast } from "sonner";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import { createClient } from "@/lib/supabase/client";
import { ImageAnnotator } from "./image-annotator";

type FileKind = "pdf" | "image" | "video" | "audio" | "text" | "html" | "office" | "other";

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

  // Text content state
  const [textContent, setTextContent] = useState<string>("");
  const [originalText, setOriginalText] = useState<string>("");
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Image zoom
  const [zoomed, setZoomed] = useState(false);

  // HTML preview — toggle between rendered iframe and source
  const [showHtmlSource, setShowHtmlSource] = useState(false);

  // Image annotator overlay
  const [annotating, setAnnotating] = useState(false);

  // Office → personal Drive
  const [officeOpening, setOfficeOpening] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    if (kind !== "pdf") return;
    loadComments();
    createClient().auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, [open, kind, loadComments]);

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

  async function openInGoogleDocs() {
    setOfficeOpening(true);
    try {
      const r = await fetch("/api/google/drive/upload-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: file.url, file_name: file.name, convert: true }),
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
      window.open(json.web_view_link, "_blank", "noopener,noreferrer");
      toast.success("내 Drive 에 복사해서 열었어요. 편집 완료 후 내려받아 자료실에 다시 올려주세요.");
    } catch (e: unknown) {
      toast.error((e as Error).message || "실패");
    } finally {
      setOfficeOpening(false);
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
    setLoadingText(true);
    setTextError(null);
    fetch(displayUrl, { cache: "no-store" })
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
  }, [open, kind, displayUrl, showHtmlSource]);

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
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink hover:bg-nu-cream/40 text-left"
                  >
                    <Copy size={12} /> 링크 복사
                  </button>
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
                <iframe src={displayUrl} title={file.name} className="w-full flex-1 border-0" />
                <p className="text-[11px] text-nu-muted text-center py-2 border-t border-nu-ink/10 bg-nu-cream/20">
                  브라우저에서 열 수 없으면 상단의 [다운로드] 버튼을 눌러주세요
                </p>
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
                  src={displayUrl}
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
              <video src={displayUrl} controls className="w-full max-h-full">
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
              <audio src={displayUrl} controls className="w-full max-w-md" />
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
                try {
                  if (lang && lang !== "plaintext" && hljs.getLanguage(lang)) {
                    html = hljs.highlight(textContent, { language: lang, ignoreIllegals: true }).value;
                  } else {
                    const auto = hljs.highlightAuto(textContent);
                    html = auto.value;
                  }
                } catch {
                  html = textContent
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
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
                    src={displayUrl}
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
                    try {
                      html = hljs.highlight(textContent, { language: "html", ignoreIllegals: true }).value;
                    } catch {
                      html = textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
                  편집하려면 Google Docs 로 복사해서 여세요
                </p>
                <button
                  onClick={openInGoogleDocs}
                  disabled={officeOpening}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {officeOpening ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                  Google Docs 에서 편집
                </button>
              </div>
            </div>
          )}

          {kind === "other" && (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center">
              <div className="w-20 h-20 border-[3px] border-nu-ink bg-nu-cream/40 flex items-center justify-center">
                <FileIcon size={40} className="text-nu-muted" />
              </div>
              <p className="text-sm font-bold text-nu-ink">브라우저에서 미리볼 수 없는 형식입니다</p>
              <p className="text-[12px] text-nu-muted break-all max-w-md">{file.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={file.url}
                  download={file.name}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-all flex items-center gap-2"
                >
                  <Download size={12} /> 다운로드
                </a>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-2"
                >
                  <ExternalLink size={12} /> 새 탭에서 열기
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {annotating && kind === "image" && (
        <ImageAnnotator
          imageUrl={displayUrl}
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
    </div>
  );
}

/** Helper: 해당 파일이 텍스트 편집 가능한지 판단 (리스트 UI 에서 ✏️ 뱃지용) */
export function isTextEditableFile(name: string, mime?: string | null, storage_type?: string | null): boolean {
  if (storage_type !== "r2") return false;
  return detectKind(name, mime) === "text";
}
