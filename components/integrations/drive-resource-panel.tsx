"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderOpen, FileText, Upload, Loader2, ExternalLink,
  Search, ChevronRight, ArrowLeft, RefreshCw, Plus,
  Image as ImageIcon, Film, Music, Table2, Presentation,
} from "lucide-react";
import { toast } from "sonner";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName: string }[];
}

interface Props {
  /** Main Drive folder ID for this nut or bolt */
  folderId: string | null;
  /** Subfolder map (e.g. { "자료": "abc", "회의록": "def" }) */
  subFolders?: Record<string, string>;
  /** nut (group) or bolt (project) */
  context: "nut" | "bolt";
  /** Group or Project ID for upload auto-registration */
  targetId: string;
  /** Can the current user upload? (host/lead) */
  canManage?: boolean;
  /** Drive folder web link for "Open in Drive" button */
  driveUrl?: string | null;
  /** Callback to create Drive folder if one doesn't exist */
  onCreateFolder?: () => void;
}

const MIME_ICON: Record<string, { icon: any; color: string }> = {
  "application/vnd.google-apps.folder": { icon: FolderOpen, color: "text-yellow-600" },
  "application/vnd.google-apps.document": { icon: FileText, color: "text-blue-600" },
  "application/vnd.google-apps.spreadsheet": { icon: Table2, color: "text-green-600" },
  "application/vnd.google-apps.presentation": { icon: Presentation, color: "text-amber-600" },
  "application/pdf": { icon: FileText, color: "text-red-500" },
  "image/": { icon: ImageIcon, color: "text-pink-500" },
  "video/": { icon: Film, color: "text-purple-500" },
  "audio/": { icon: Music, color: "text-indigo-500" },
};

function getFileIcon(mime: string) {
  if (MIME_ICON[mime]) return MIME_ICON[mime];
  for (const [prefix, val] of Object.entries(MIME_ICON)) {
    if (prefix.endsWith("/") && mime.startsWith(prefix)) return val;
  }
  return { icon: FileText, color: "text-nu-muted" };
}

function formatBytes(bytes: string | undefined) {
  if (!bytes) return "";
  const b = parseInt(bytes);
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

export function DriveResourcePanel({
  folderId, subFolders, context, targetId,
  canManage, driveUrl, onCreateFolder,
}: Props) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const activeFolderId = currentFolder || folderId;

  const loadFiles = useCallback(async (fId?: string, searchQ?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fId) params.set("folderId", fId);
      else if (searchQ) params.set("q", searchQ);
      const res = await fetch(`/api/google/drive?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      } else {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (folderId) loadFiles(folderId);
  }, [folderId, loadFiles]);

  function navigateToFolder(folder: DriveFile) {
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolder(folder.id);
    loadFiles(folder.id);
  }

  function goBack() {
    const newCrumb = [...breadcrumb];
    newCrumb.pop();
    setBreadcrumb(newCrumb);
    const parentId = newCrumb.length > 0 ? newCrumb[newCrumb.length - 1].id : folderId;
    setCurrentFolder(parentId);
    loadFiles(parentId || undefined);
  }

  function goToRoot() {
    setBreadcrumb([]);
    setCurrentFolder(null);
    if (folderId) loadFiles(folderId);
  }

  function handleSearch() {
    if (!search.trim()) {
      if (folderId) loadFiles(activeFolderId || undefined);
      return;
    }
    setBreadcrumb([]);
    setCurrentFolder(null);
    loadFiles(undefined, search.trim());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeFolderId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", activeFolderId);
      form.append("targetType", context === "nut" ? "group" : "project");
      form.append("targetId", targetId);
      const res = await fetch("/api/google/drive/upload", { method: "POST", body: form });
      if (res.ok) {
        toast.success(`"${file.name}" 업로드 완료`);
        loadFiles(activeFolderId);
      } else {
        const data = await res.json();
        toast.error(data.error || "업로드 실패");
      }
    } catch {
      toast.error("업로드 중 오류 발생");
    }
    setUploading(false);
    e.target.value = "";
  }

  // No folder set up yet
  if (!folderId) {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
        <FolderOpen size={32} className="text-nu-muted/30 mx-auto mb-3" />
        <p className="text-sm text-nu-muted mb-3">
          {context === "nut" ? "너트" : "볼트"} Google Drive 폴더가 아직 없습니다
        </p>
        {canManage && onCreateFolder && (
          <button onClick={onCreateFolder}
            className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors border-none cursor-pointer">
            <Plus size={12} className="inline mr-1" /> Drive 폴더 만들기
          </button>
        )}
      </div>
    );
  }

  // Sub-folder quick tabs for bolts (stages) or nuts
  const tabs = subFolders ? Object.entries(subFolders) : [];

  return (
    <div className="space-y-3">
      {/* Header: search + actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-nu-white border border-nu-ink/[0.08] px-3 py-1.5">
          <Search size={12} className="text-nu-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="파일 검색..."
            className="flex-1 text-xs bg-transparent outline-none border-none"
          />
        </div>
        <button onClick={() => loadFiles(activeFolderId || undefined)}
          className="p-2 bg-nu-white border border-nu-ink/[0.08] cursor-pointer hover:bg-nu-cream/30 transition-colors">
          <RefreshCw size={12} className={loading ? "animate-spin text-nu-muted" : "text-nu-muted"} />
        </button>
        {driveUrl && (
          <a href={driveUrl} target="_blank" rel="noopener noreferrer"
            className="p-2 bg-nu-white border border-nu-ink/[0.08] hover:bg-nu-cream/30 transition-colors">
            <ExternalLink size={12} className="text-nu-muted" />
          </a>
        )}
        {canManage && (
          <label className="p-2 bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 transition-colors">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {/* Sub-folder tabs */}
      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={goToRoot}
            className={`font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1 border cursor-pointer transition-colors ${
              !currentFolder ? "bg-nu-ink text-white border-nu-ink" : "bg-white text-nu-muted border-nu-ink/10 hover:bg-nu-cream/30"
            }`}>
            전체
          </button>
          {tabs.map(([name, id]) => (
            <button key={id} onClick={() => { setBreadcrumb([{ id, name }]); setCurrentFolder(id); loadFiles(id); }}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1 border cursor-pointer transition-colors ${
                currentFolder === id ? "bg-nu-ink text-white border-nu-ink" : "bg-white text-nu-muted border-nu-ink/10 hover:bg-nu-cream/30"
              }`}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-[12px] text-nu-muted">
          <button onClick={goToRoot} className="bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink p-0">
            <ArrowLeft size={10} />
          </button>
          <button onClick={goToRoot} className="bg-transparent border-none cursor-pointer text-indigo-500 hover:underline p-0">루트</button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight size={8} />
              <button
                onClick={() => {
                  const newCrumb = breadcrumb.slice(0, i + 1);
                  setBreadcrumb(newCrumb);
                  setCurrentFolder(b.id);
                  loadFiles(b.id);
                }}
                className="bg-transparent border-none cursor-pointer text-indigo-500 hover:underline p-0">
                {b.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 text-center">
          <FolderOpen size={24} className="text-nu-muted/30 mx-auto mb-2" />
          <p className="text-xs text-nu-muted">파일이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Folders first */}
          {files.filter(f => f.mimeType === "application/vnd.google-apps.folder").map(f => {
            const { icon: Icon, color } = getFileIcon(f.mimeType);
            return (
              <button key={f.id} onClick={() => navigateToFolder(f)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-nu-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors cursor-pointer text-left">
                <Icon size={16} className={color} />
                <span className="flex-1 text-xs font-medium text-nu-ink truncate">{f.name}</span>
                <ChevronRight size={12} className="text-nu-muted/40" />
              </button>
            );
          })}
          {/* Then files */}
          {files.filter(f => f.mimeType !== "application/vnd.google-apps.folder").map(f => {
            const { icon: Icon, color } = getFileIcon(f.mimeType);
            return (
              <a key={f.id} href={f.webViewLink || "#"} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 bg-nu-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors no-underline group">
                {f.thumbnailLink ? (
                  <img src={f.thumbnailLink} alt="" className="w-8 h-8 object-cover border border-nu-ink/5 shrink-0" />
                ) : (
                  <Icon size={16} className={`${color} shrink-0`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nu-ink truncate group-hover:text-indigo-600 transition-colors">{f.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {f.owners?.[0]?.displayName && (
                      <span className="text-[11px] text-nu-muted">{f.owners[0].displayName}</span>
                    )}
                    {f.modifiedTime && (
                      <span className="text-[11px] text-nu-muted">
                        {new Date(f.modifiedTime).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {f.size && <span className="text-[11px] text-nu-muted">{formatBytes(f.size)}</span>}
                  </div>
                </div>
                <ExternalLink size={10} className="text-nu-muted/30 group-hover:text-indigo-400 shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
