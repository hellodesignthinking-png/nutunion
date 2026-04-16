"use client";

import { useState, useEffect, useCallback } from "react";
import { HardDrive, Loader2, Search, FileText, Image, Film, Table, File, X, ExternalLink, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface DriveFile {
  name: string;
  url: string;
  mimeType: string;
}

interface DrivePickerProps {
  onFilePicked: (file: DriveFile) => void;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime: string;
  size?: string;
}

function getMimeIcon(mime: string) {
  if (mime.includes("spreadsheet") || mime.includes("excel")) return <Table size={18} className="text-green-600" />;
  if (mime.includes("document") || mime.includes("word") || mime.includes("pdf")) return <FileText size={18} className="text-nu-blue" />;
  if (mime.includes("presentation") || mime.includes("slide")) return <FileText size={18} className="text-nu-amber" />;
  if (mime.startsWith("image/")) return <Image size={18} className="text-nu-pink" />;
  if (mime.startsWith("video/")) return <Film size={18} className="text-purple-500" />;
  if (mime === "application/vnd.google-apps.folder") return <HardDrive size={18} className="text-nu-muted" />;
  return <File size={18} className="text-nu-graphite" />;
}

function formatSize(bytes?: string) {
  if (!bytes) return "";
  const n = parseInt(bytes);
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

export function DrivePicker({ onFilePicked }: DrivePickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Check Google connection status
  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  const loadFiles = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const url = query
        ? `/api/google/drive?q=${encodeURIComponent(query)}`
        : "/api/google/drive";
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        if (data.code === "NOT_CONNECTED" || data.code === "TOKEN_EXPIRED") {
          setConnected(false);
        }
        toast.error(data.error);
        return;
      }

      // Filter out symlinks and show only real files
      const realFiles = (data.files || []).filter(
        (f: DriveItem) => f.mimeType !== "inode/symlink"
      );
      setFiles(realFiles);
    } catch {
      toast.error("Drive 파일을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpen() {
    if (!connected) {
      // Redirect to Google OAuth
      window.location.href = "/api/auth/google";
      return;
    }
    setOpen(true);
    loadFiles();
  }

  function handleSearch() {
    if (!search.trim()) {
      loadFiles();
      return;
    }
    setSearching(true);
    loadFiles(search.trim()).finally(() => setSearching(false));
  }

  function handlePick(file: DriveItem) {
    onFilePicked({
      name: file.name,
      url: file.webViewLink,
      mimeType: file.mimeType,
    });
    setOpen(false);
    toast.success(`"${file.name}" 추가됨`);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-4 py-2.5 bg-green-600 text-white hover:bg-green-700 transition-colors inline-flex items-center gap-2"
      >
        <HardDrive size={13} />
        {connected === false ? "Drive 연결" : "Drive 연결"}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-nu-paper w-full max-w-2xl max-h-[80vh] flex flex-col border-2 border-nu-ink shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/10">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-green-600" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">Google Drive</h3>
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">파일 선택</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-nu-muted hover:text-nu-ink transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-nu-ink/5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="파일명 검색..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-nu-ink/10 bg-nu-white focus:outline-none focus:border-nu-pink"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 py-2 bg-nu-ink text-white text-xs font-mono-nu uppercase tracking-widest hover:bg-nu-pink transition-colors"
                >
                  {searching ? <Loader2 size={12} className="animate-spin" /> : "검색"}
                </button>
              </div>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-nu-muted" />
                  <span className="ml-3 text-sm text-nu-muted">파일 불러오는 중...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-16">
                  <HardDrive size={40} className="text-nu-muted/20 mx-auto mb-3" />
                  <p className="text-nu-gray text-sm">
                    {search ? "검색 결과가 없습니다" : "Drive에 파일이 없습니다"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handlePick(file)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-nu-cream/50 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 flex items-center justify-center bg-nu-cream/50 border border-nu-ink/5 shrink-0">
                        {getMimeIcon(file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nu-ink truncate group-hover:text-nu-pink transition-colors">
                          {file.name}
                        </p>
                        <p className="text-[12px] text-nu-muted font-mono-nu">
                          {new Date(file.modifiedTime).toLocaleDateString("ko-KR")}
                          {file.size ? ` · ${formatSize(file.size)}` : ""}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-nu-muted/30 group-hover:text-nu-pink transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-nu-ink/10 flex items-center justify-between">
              <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
                {files.length}개 파일
              </span>
              <button
                onClick={() => setOpen(false)}
                className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-1.5 border border-nu-ink/15 hover:bg-nu-cream transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
