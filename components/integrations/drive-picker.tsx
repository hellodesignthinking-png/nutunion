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
  
  // Folder navigation state
  const [folderStack, setFolderStack] = useState<{id: string; name: string}[]>([]);
  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  const loadFiles = useCallback(async (query: string = "", folderId?: string) => {
    setLoading(true);
    try {
      let url = `/api/google/drive?`;
      if (query) url += `q=${encodeURIComponent(query)}&`;
      if (folderId) url += `folderId=${encodeURIComponent(folderId)}&`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        if (data.code === "NOT_CONNECTED" || data.code === "TOKEN_EXPIRED") {
          setConnected(false);
        }
        toast.error(data.error);
        return;
      }

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
      window.location.href = "/api/auth/google?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    setOpen(true);
    setFolderStack([]);
    setSearch("");
    loadFiles();
  }

  function handleSearch() {
    setSearching(true);
    loadFiles(search.trim(), search.trim() ? undefined : currentFolder?.id).finally(() => setSearching(false));
  }

  function handlePick(file: DriveItem) {
    onFilePicked({
      name: file.name,
      url: file.webViewLink,
      mimeType: file.mimeType,
    });
    setOpen(false);
  }

  function handleItemClick(file: DriveItem) {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      setFolderStack(prev => [...prev, { id: file.id, name: file.name }]);
      setSearch("");
      loadFiles("", file.id);
    } else {
      handlePick(file);
    }
  }

  function handleBack() {
    if (folderStack.length === 0) return;
    const newStack = [...folderStack];
    newStack.pop();
    setFolderStack(newStack);
    const parent = newStack.length > 0 ? newStack[newStack.length - 1].id : undefined;
    loadFiles("", parent);
  }

  function handleSelectCurrentFolder() {
    if (!currentFolder) return;
    // We need webViewLink, but we only have id and name. 
    // Drive API builds it like this:
    const webViewLink = `https://drive.google.com/drive/folders/${currentFolder.id}`;
    onFilePicked({
      name: currentFolder.name,
      url: webViewLink,
      mimeType: "application/vnd.google-apps.folder",
    });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-green-600 bg-white text-green-700 hover:bg-green-50 transition-colors inline-flex items-center gap-2"
      >
        <HardDrive size={13} />
        {connected === false ? "Drive 연결" : "Drive 파일/폴더 선택"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-nu-paper w-full max-w-2xl max-h-[85vh] flex flex-col border-2 border-nu-ink shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/10">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-green-600" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">
                  {currentFolder ? currentFolder.name : "Google Drive"}
                </h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-nu-muted hover:text-nu-ink transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Path / Toolbar */}
            <div className="px-5 py-3 border-b border-nu-ink/5 bg-nu-cream/30 flex items-center gap-3">
              {folderStack.length > 0 && (
                <button
                  onClick={handleBack}
                  className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/20 hover:bg-nu-white transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={12} className="rotate-180" /> 뒤로
                </button>
              )}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={currentFolder ? "현재 폴더 내 검색..." : "내 드라이브 검색..."}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-nu-ink/10 bg-nu-white focus:outline-none focus:border-nu-pink"
                />
              </div>
              {currentFolder && !search && (
                <button
                  onClick={handleSelectCurrentFolder}
                  className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-1.5 bg-nu-ink text-white hover:bg-nu-pink transition-colors"
                >
                  이 폴더 공유하기
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 bg-nu-white">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-nu-muted" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-16">
                  <HardDrive size={40} className="text-nu-muted/20 mx-auto mb-3" />
                  <p className="text-nu-gray text-sm">
                    {search ? "검색 결과가 없습니다" : "폴더가 비어 있습니다"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-nu-cream/50 transition-colors group border border-transparent hover:border-nu-ink/10 cursor-pointer"
                      onClick={() => handleItemClick(file)}
                    >
                      <div className="w-8 h-8 flex items-center justify-center bg-white border border-nu-ink/10 shrink-0">
                        {getMimeIcon(file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nu-ink truncate group-hover:text-nu-blue transition-colors">
                          {file.name}
                        </p>
                        <p className="text-[12px] text-nu-muted/70 font-mono-nu">
                          {new Date(file.modifiedTime).toLocaleDateString("ko-KR")}
                          {file.size ? ` · ${formatSize(file.size)}` : ""}
                        </p>
                      </div>
                      {file.mimeType === "application/vnd.google-apps.folder" ? (
                        <ChevronRight size={14} className="text-nu-muted/30 group-hover:text-nu-pink transition-colors shrink-0" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePick(file); }}
                          className="opacity-0 group-hover:opacity-100 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-blue text-white hover:bg-nu-pink transition-all shrink-0"
                        >
                          선택
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-nu-ink/10 bg-nu-paper flex items-center justify-between">
              <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
                {files.length}개 항목
              </span>
              <button
                onClick={() => setOpen(false)}
                className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 text-nu-muted hover:text-nu-ink transition-colors"
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
