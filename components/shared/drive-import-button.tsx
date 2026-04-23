"use client";

// [Phase 4] DriveImportButton
// Lets the user pick a file from their Google Drive and import it into R2.
// The parent receives the final R2 public URL + metadata via `onImported`.

import { useState } from "react";
import { Loader2, X, HardDrive, FileText, Check } from "lucide-react";
import { toast } from "sonner";

export interface DriveImportedFile {
  url: string;
  name: string;
  size: number;
  mime: string;
  storage_key: string;
}

export interface DriveImportButtonProps {
  onImported: (file: DriveImportedFile) => void;
  prefix?: "chat" | "resources" | "avatars" | "uploads";
  scopeId?: string;
  label?: string;
  className?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | null;
  size: number | null;
  webViewLink?: string | null;
  thumbnailLink?: string | null;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(s?: string | null): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function DriveImportButton({
  onImported,
  prefix = "uploads",
  scopeId,
  label = "📁 Google Drive 에서 가져오기",
  className = "",
}: DriveImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setError(null);
    setFiles(null);
    setLoading(true);
    try {
      const res = await fetch("/api/google/drive/list");
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "GOOGLE_NOT_CONNECTED") {
          setError("Google 계정이 연결되지 않았습니다. 설정 → Integrations 에서 연결해주세요.");
        } else {
          setError(data.error || "Drive 목록 조회 실패");
        }
        return;
      }
      setFiles(data.files || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  async function importFile(f: DriveFile) {
    setImportingId(f.id);
    setError(null);
    try {
      const res = await fetch("/api/google/drive/import-to-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileId: f.id, prefix, scopeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "가져오기 실패");
        return;
      }
      toast.success(`"${data.name}" 을(를) 가져왔습니다`);
      onImported({
        url: data.url,
        name: data.name,
        size: data.size,
        mime: data.mime,
        storage_key: data.storage_key || data.key,
      });
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          className ||
          "flex items-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink/20 text-nu-ink bg-white hover:bg-nu-ink hover:text-white transition-colors"
        }
      >
        <HardDrive size={14} /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] bg-white border-[3px] border-nu-ink flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b-[2px] border-nu-ink/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-head text-lg font-bold text-nu-ink flex items-center gap-2">
                  <HardDrive size={18} className="text-blue-500" /> Google Drive → R2
                </h3>
                <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mt-1">
                  최근 파일 · 최대 100MB
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-nu-muted hover:text-nu-ink transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading && (
                <div className="flex items-center justify-center py-10 gap-2 text-nu-muted">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Drive 목록 조회 중...</span>
                </div>
              )}
              {error && (
                <div className="p-3 mb-3 border-[2px] border-red-500 bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {!loading && files && files.length === 0 && (
                <div className="text-center py-8 text-nu-muted text-sm">
                  Drive 에 파일이 없습니다
                </div>
              )}
              {!loading && files && files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f) => {
                    const isNative = f.mimeType?.startsWith(
                      "application/vnd.google-apps.",
                    );
                    const busy = importingId === f.id;
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 px-3 py-2.5 border-[2px] border-nu-ink/10 hover:border-nu-ink/30 bg-white transition-colors"
                      >
                        <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-nu-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-nu-ink truncate">
                            {f.name}
                          </p>
                          <div className="font-mono-nu text-[10px] text-nu-muted/70 flex items-center gap-2 mt-0.5">
                            <span>{fmtDate(f.modifiedTime)}</span>
                            {f.size != null && (
                              <>
                                <span>·</span>
                                <span>{fmtSize(f.size)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          disabled={busy || isNative}
                          onClick={() => importFile(f)}
                          title={
                            isNative
                              ? "Google Docs/Sheets/Slides 는 가져올 수 없습니다"
                              : "R2로 가져오기"
                          }
                          className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink bg-white hover:bg-nu-ink hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                        >
                          {busy ? (
                            <>
                              <Loader2 size={10} className="animate-spin" /> 가져오는 중
                            </>
                          ) : isNative ? (
                            "네이티브"
                          ) : (
                            <>
                              <Check size={10} /> 가져오기
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
