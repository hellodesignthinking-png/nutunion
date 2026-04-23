"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName: string }[];
}

interface Props {
  projectId: string;
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  onImported: () => void;
}

function mimeIcon(mime: string): string {
  if (mime.includes("folder")) return "📁";
  if (mime.includes("document")) return "📝";
  if (mime.includes("spreadsheet")) return "📊";
  if (mime.includes("presentation")) return "🎞";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("image")) return "🖼";
  if (mime.includes("video")) return "🎬";
  return "📄";
}

function humanSize(bytes?: string): string {
  if (!bytes) return "";
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/**
 * Venture Drive Importer — 프로젝트의 Drive 폴더에서 파일을 browse 하고,
 * 선택한 파일들을 venture_sources 로 일괄 import.
 */
export function VentureDriveImporter({ projectId, driveFolderId, driveFolderUrl, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [notConnected, setNotConnected] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : driveFolderId;

  // loadFolder — pageToken 을 명시적으로 파라미터로 받아 stale closure 회피
  const loadFolder = useCallback(async (folderId: string | null, pageToken: string | null = null) => {
    if (!folderId) {
      setError("프로젝트에 Drive 폴더가 연결되지 않았습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const res = await fetch(`/api/google/drive?folderId=${encodeURIComponent(folderId)}${pageParam}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NOT_CONNECTED" || data.code === "TOKEN_EXPIRED") {
          setNotConnected(true);
          return;
        }
        throw new Error(data.error ?? "Drive 파일 로드 실패");
      }
      const newFiles = (data.files ?? []) as DriveFile[];
      setFiles((prev) => (pageToken ? [...prev, ...newFiles] : newFiles));
      setNextPageToken(data.nextPageToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive 파일 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFolderStack([]);
      setSelected(new Set());
      setNextPageToken(null);
      loadFolder(driveFolderId, null);
    }
  }, [open, driveFolderId, loadFolder]);

  // ESC 키 닫기 + 포커스 관리
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // 스크롤 락
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
      prevFocusRef.current?.focus();
    };
  }, [open]);

  const enterFolder = (f: DriveFile) => {
    setFolderStack((prev) => [...prev, { id: f.id, name: f.name }]);
    setNextPageToken(null);
    loadFolder(f.id, null);
  };

  const goBack = () => {
    setFolderStack((prev) => {
      const next = prev.slice(0, -1);
      const newFolderId = next.length > 0 ? next[next.length - 1].id : driveFolderId;
      setNextPageToken(null);
      loadFolder(newFolderId, null);
      return next;
    });
  };

  const toggleFile = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = async () => {
    if (selected.size === 0) {
      toast.error("import 할 파일을 선택하세요");
      return;
    }
    setImporting(true);
    try {
      const picked = files.filter((f) => selected.has(f.id) && !f.mimeType.includes("folder"));
      const payload = {
        files: picked.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink,
          modifiedTime: f.modifiedTime,
          ownerName: f.owners?.[0]?.displayName,
        })),
      };
      const res = await fetch(`/api/venture/${projectId}/sources/import-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import 실패");
      toast.success(`${data.imported}건 import 완료 — AI 요약 버튼으로 분석 시작 가능`);
      setOpen(false);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import 실패");
    } finally {
      setImporting(false);
    }
  };

  if (!driveFolderId) {
    return (
      <div className="text-[11px] font-mono-nu text-nu-graphite">
        Drive 폴더 미연결 — 볼트 설정에서 Google Drive 폴더를 먼저 생성해주세요.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 border-[2px] border-nu-blue bg-nu-blue/10 text-nu-blue font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-blue hover:text-nu-paper"
      >
        📁 Drive 자료 가져오기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-nu-ink/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Google Drive 파일 가져오기"
            className="max-w-3xl w-full max-h-[85vh] bg-nu-paper border-[2.5px] border-nu-ink flex flex-col outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
                  📁 Google Drive Import
                </div>
                <div className="font-bold text-[14px] text-nu-ink mt-0.5 flex items-center gap-1 flex-wrap">
                  <span>프로젝트 드라이브 폴더</span>
                  {folderStack.map((f, i) => (
                    <span key={i} className="font-mono-nu text-[11px] text-nu-graphite">
                      / {f.name}
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink">
                ✕ 닫기
              </button>
            </div>

            {/* Breadcrumb + back */}
            {folderStack.length > 0 && (
              <div className="px-4 py-2 border-b-[1px] border-nu-ink/20 bg-nu-cream/20">
                <button type="button" onClick={goBack} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink">
                  ← 상위 폴더
                </button>
              </div>
            )}

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto">
              {notConnected ? (
                <div className="p-8 text-center">
                  <div className="text-[36px] mb-2">🔗</div>
                  <p className="text-[13px] text-nu-graphite mb-3">Google 계정이 연결되지 않았습니다.</p>
                  <a
                    href="/api/auth/google"
                    className="inline-block h-10 px-4 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-pink hover:border-nu-pink"
                  >
                    Google 계정 연결
                  </a>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <div className="text-[13px] text-red-700 mb-2">{error}</div>
                  {driveFolderUrl && (
                    <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline">
                      Drive 에서 직접 열기 →
                    </a>
                  )}
                </div>
              ) : loading && files.length === 0 ? (
                <div className="p-8 text-center font-mono-nu text-[11px] text-nu-graphite">
                  불러오는 중...
                </div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-[36px] mb-2">📭</div>
                  <p className="text-[12px] text-nu-graphite">이 폴더에 파일이 없습니다.</p>
                </div>
              ) : (
                <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
                  {files.map((f) => {
                    const isFolder = f.mimeType.includes("folder");
                    const isSelected = selected.has(f.id);
                    return (
                      <li key={f.id}>
                        <div
                          className={`flex items-center gap-3 p-3 hover:bg-nu-cream/20 ${isSelected ? "bg-nu-pink/5" : ""}`}
                        >
                          {!isFolder && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFile(f.id)}
                              className="w-4 h-4 accent-nu-pink"
                            />
                          )}
                          <div
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                            onClick={() => (isFolder ? enterFolder(f) : toggleFile(f.id))}
                          >
                            <span className="text-[20px]">{mimeIcon(f.mimeType)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[13px] text-nu-ink truncate">{f.name}</div>
                              <div className="font-mono-nu text-[10px] text-nu-graphite flex items-center gap-2 flex-wrap">
                                {f.owners?.[0]?.displayName && <span>👤 {f.owners[0].displayName}</span>}
                                {f.modifiedTime && <span>{new Date(f.modifiedTime).toLocaleDateString("ko-KR")}</span>}
                                {f.size && <span>{humanSize(f.size)}</span>}
                              </div>
                            </div>
                          </div>
                          <a
                            href={f.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite hover:text-nu-blue shrink-0"
                          >
                            열기 ↗
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {nextPageToken && !loading && (
                <div className="p-3 text-center border-t-[1px] border-nu-ink/10">
                  <button
                    type="button"
                    onClick={() => loadFolder(currentFolderId, nextPageToken)}
                    className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink"
                  >
                    더 보기 →
                  </button>
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-4 py-3 border-t-[2px] border-nu-ink bg-nu-cream/20 flex items-center justify-between gap-2">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
                {selected.size > 0 ? `${selected.size}건 선택됨` : "파일을 선택하세요 (최대 20)"}
              </div>
              <button
                type="button"
                onClick={importSelected}
                disabled={importing || selected.size === 0 || selected.size > 20}
                className="h-10 px-4 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink disabled:opacity-50"
              >
                {importing ? "Import 중..." : `Source 로 가져오기 →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
