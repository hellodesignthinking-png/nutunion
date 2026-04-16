"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FileText, ExternalLink, Search, X, Plus, FolderOpen,
  MessageSquare, Send, ChevronRight, Loader2, RefreshCw,
  ArrowLeft, Star, StarOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

type ViewTab = "files" | "drive";

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
  parents?: string[];
}

interface FileComment {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export default function StaffFilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [boltProjects, setBoltProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size">("newest");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [tab, setTab] = useState<ViewTab>("files");

  // Create file states
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"doc" | "sheet" | "link">("doc");
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Google Drive browser
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [drivePath, setDrivePath] = useState<{ id: string; name: string }[]>([]);
  const [driveSearch, setDriveSearch] = useState("");

  // File detail / comments
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [comments, setComments] = useState<FileComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", user.id)
          .single();
        setUserName(profile?.nickname || "Staff");
      }

      const [{ data: fileData }, { data: projData }, { data: boltData }] = await Promise.all([
        supabase
          .from("staff_files")
          .select("*, project:staff_projects(id, title), creator:profiles!staff_files_created_by_fkey(nickname)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("staff_projects").select("id, title").order("title"),
        supabase.from("projects").select("id, title").eq("status", "active").order("title"),
      ]);
      setFiles(fileData || []);
      setProjects(projData || []);
      setBoltProjects(boltData || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Google Drive Browser ──
  const loadDriveFiles = useCallback(async (folderId?: string) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const res = await fetch(`/api/google/drive${query}`);
      if (!res.ok) {
        const d = await res.json();
        setDriveError(d.detail || d.error || "Google Drive 로드 실패");
        setDriveLoading(false);
        return;
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch {
      setDriveError("Google Drive 연결 오류");
    }
    setDriveLoading(false);
  }, []);

  function openDriveFolder(folderId: string, folderName: string) {
    setDrivePath(prev => [...prev, { id: folderId, name: folderName }]);
    loadDriveFiles(folderId);
  }

  function navigateDriveTo(index: number) {
    if (index < 0) {
      setDrivePath([]);
      loadDriveFiles();
    } else {
      const path = drivePath.slice(0, index + 1);
      setDrivePath(path);
      loadDriveFiles(path[path.length - 1].id);
    }
  }

  // ── Comments ──
  async function loadComments(fileId: string) {
    setCommentLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("staff_file_comments")
      .select("id, content, created_at, user:profiles!staff_file_comments_user_id_fkey(id, nickname)")
      .eq("file_id", fileId)
      .order("created_at", { ascending: true });

    setComments((data || []).map((c: any) => ({
      id: c.id,
      user_id: c.user?.id || "",
      user_name: c.user?.nickname || "Unknown",
      content: c.content,
      created_at: c.created_at,
    })));
    setCommentLoading(false);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim() || !selectedFile) return;
    setSendingComment(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("staff_file_comments").insert({
      file_id: selectedFile.id,
      user_id: userId,
      content: commentInput.trim(),
    }).select("id, created_at").single();

    if (error) {
      // Table might not exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        toast.error("댓글 테이블이 없습니다. SQL 마이그레이션을 실행해주세요.");
      } else {
        toast.error("댓글 등록 실패");
      }
    } else {
      setComments(prev => [...prev, {
        id: data.id,
        user_id: userId,
        user_name: userName,
        content: commentInput.trim(),
        created_at: data.created_at,
      }]);
      setCommentInput("");
    }
    setSendingComment(false);
  }

  function openFileDetail(file: any) {
    setSelectedFile(file);
    setComments([]);
    setCommentInput("");
    loadComments(file.id);
  }

  // ── Drive file → staff_files 연결 ──
  async function linkDriveFile(driveFile: DriveFile) {
    const supabase = createClient();
    // Check if already linked
    const { data: existing } = await supabase
      .from("staff_files")
      .select("id")
      .eq("drive_file_id", driveFile.id)
      .maybeSingle();

    if (existing) {
      toast("이미 등록된 파일입니다");
      return;
    }

    const { error } = await supabase.from("staff_files").insert({
      drive_file_id: driveFile.id,
      title: driveFile.name,
      mime_type: driveFile.mimeType,
      drive_url: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
      file_size: driveFile.size ? parseInt(driveFile.size) : null,
      thumbnail_url: driveFile.thumbnailLink || null,
      created_by: userId,
    });

    if (error) {
      toast.error("파일 연결 실패");
    } else {
      toast.success(`"${driveFile.name}" 자료실에 등록됨`);
      // Reload files
      const { data } = await supabase
        .from("staff_files")
        .select("*, project:staff_projects(id, title), creator:profiles!staff_files_created_by_fkey(nickname)")
        .order("created_at", { ascending: false })
        .limit(200);
      setFiles(data || []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      if (createMode === "link") {
        if (!linkUrl.trim()) { toast.error("URL을 입력하세요"); setCreating(false); return; }
        const match = linkUrl.match(/(?:\/d\/|\/folders\/|id=)([a-zA-Z0-9_-]+)/);
        if (!match) { toast.error("올바른 Google Drive URL이 아닙니다"); setCreating(false); return; }
        const driveFileId = match[1];

        const res = await fetch(`/api/google/drive?fileId=${driveFileId}`);
        if (!res.ok) { toast.error("파일 정보를 가져올 수 없습니다"); setCreating(false); return; }
        const { file: fileInfo } = await res.json();

        const supabase = createClient();
        const { error } = await supabase.from("staff_files").insert({
          project_id: newProjectId || null,
          drive_file_id: driveFileId,
          title: fileInfo?.name || newTitle.trim(),
          mime_type: fileInfo?.mimeType || null,
          drive_url: fileInfo?.webViewLink || linkUrl,
          file_size: fileInfo?.size ? parseInt(fileInfo.size) : null,
          thumbnail_url: fileInfo?.thumbnailLink || null,
          created_by: userId,
        });
        if (error) { toast.error("파일 연결 실패"); setCreating(false); return; }
        toast.success("파일이 연결되었습니다");
      } else {
        const res = await fetch("/api/google/docs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `[Staff] ${newTitle.trim()}` }),
        });
        if (!res.ok) { toast.error("문서 생성 실패. Google 계정 연결을 확인해주세요."); setCreating(false); return; }
        const doc = await res.json();

        const supabase = createClient();
        const mimeType = createMode === "doc" ? "application/vnd.google-apps.document" : "application/vnd.google-apps.spreadsheet";
        const driveUrl = createMode === "doc"
          ? `https://docs.google.com/document/d/${doc.documentId}/edit`
          : `https://docs.google.com/spreadsheets/d/${doc.documentId}/edit`;

        const { error } = await supabase.from("staff_files").insert({
          project_id: newProjectId || null,
          drive_file_id: doc.documentId,
          title: newTitle.trim(),
          mime_type: mimeType,
          drive_url: driveUrl,
          created_by: userId,
        });
        if (error) { toast.error("파일 등록 실패"); setCreating(false); return; }
        toast.success(`${createMode === "doc" ? "문서" : "스프레드시트"}가 생성되었습니다`);
      }

      setNewTitle("");
      setLinkUrl("");
      setShowCreate(false);
      const supabase = createClient();
      const { data } = await supabase
        .from("staff_files")
        .select("*, project:staff_projects(id, title), creator:profiles!staff_files_created_by_fkey(nickname)")
        .order("created_at", { ascending: false })
        .limit(200);
      setFiles(data || []);
    } catch {
      toast.error("파일 작업 중 오류가 발생했습니다");
    }
    setCreating(false);
  }

  const filtered = useMemo(() => {
    let result = files;
    if (projectFilter !== "all") result = result.filter(f => f.project_id === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.title?.toLowerCase().includes(q) ||
        f.ai_tags?.some((t: string) => t.toLowerCase().includes(q)) ||
        f.ai_summary?.toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") result = [...result].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sortBy === "size") result = [...result].sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
    return result;
  }, [files, projectFilter, search, sortBy]);

  const filteredDrive = useMemo(() => {
    if (!driveSearch.trim()) return driveFiles;
    const q = driveSearch.toLowerCase();
    return driveFiles.filter(f => f.name.toLowerCase().includes(q));
  }, [driveFiles, driveSearch]);

  const mimeIcon = (mime: string | null) => {
    if (!mime) return "📄";
    if (mime.includes("folder")) return "📁";
    if (mime.includes("document")) return "📝";
    if (mime.includes("spreadsheet")) return "📊";
    if (mime.includes("presentation")) return "📽";
    if (mime.includes("pdf")) return "📕";
    if (mime.includes("image")) return "🖼️";
    if (mime.includes("video")) return "🎬";
    if (mime.includes("audio")) return "🎵";
    return "📄";
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
        <div className="h-8 w-32 bg-nu-ink/8 animate-pulse mb-8" />
        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-white border border-nu-ink/[0.06] animate-pulse mb-2" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">파일</h1>
          <p className="font-mono-nu text-[13px] text-nu-muted mt-1 uppercase tracking-widest">
            자료실 + Google Drive · {tab === "files" ? `${filtered.length}개` : `Drive 탐색`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[12px] uppercase tracking-widest gap-1.5"
          >
            {showCreate ? <X size={12} /> : <Plus size={12} />}
            {showCreate ? "닫기" : "새 파일"}
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("files")}
          className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 border cursor-pointer transition-colors ${
            tab === "files" ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
          }`}
        >
          📚 자료실 ({files.length})
        </button>
        <button
          onClick={() => { setTab("drive"); if (driveFiles.length === 0 && !driveLoading) loadDriveFiles(); }}
          className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 border cursor-pointer transition-colors ${
            tab === "drive" ? "bg-blue-600 text-white border-blue-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-blue-300"
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <FolderOpen size={12} /> Google Drive
          </span>
        </button>
      </div>

      {/* Create file form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-indigo-200 p-5 mb-6 space-y-3">
          <div className="flex gap-1 mb-3">
            {([
              { key: "doc", label: "문서", icon: "📝" },
              { key: "sheet", label: "스프레드시트", icon: "📊" },
              { key: "link", label: "URL 연결", icon: "🔗" },
            ] as const).map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setCreateMode(m.key)}
                className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 border cursor-pointer transition-colors ${
                  createMode === m.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={createMode === "link" ? "" : "sm:col-span-2"}>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">
                {createMode === "link" ? "파일명" : "제목"}
              </label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder={createMode === "doc" ? "문서 제목..." : createMode === "sheet" ? "시트 제목..." : "파일명..."}
                className="border-nu-ink/15 bg-transparent" />
            </div>
            {createMode === "link" && (
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">Google Drive URL</label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/..." className="border-nu-ink/15 bg-transparent" />
              </div>
            )}
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray block mb-1">프로젝트 (선택)</label>
              <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm">
                <option value="">프로젝트 미연결</option>
                <optgroup label="스태프">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={creating || !newTitle.trim() || (createMode === "link" && !linkUrl.trim())}
            className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[12px] uppercase tracking-widest">
            {creating ? "처리 중..." : createMode === "link" ? "연결" : "생성"}
          </Button>
        </form>
      )}

      {/* ── 자료실 탭 ── */}
      {tab === "files" && (
        <>
          {/* Search & Filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="파일명, 태그, 요약 검색..." className="pl-9 border-nu-ink/15 bg-transparent" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer p-0">
                  <X size={14} />
                </button>
              )}
            </div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 bg-transparent cursor-pointer">
              <option value="all">모든 프로젝트</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 bg-transparent cursor-pointer">
              <option value="newest">최신순</option>
              <option value="name">이름순</option>
              <option value="size">크기순</option>
            </select>
          </div>

          {/* File detail panel */}
          {selectedFile && (
            <div className="bg-white border border-indigo-200 mb-6 overflow-hidden">
              <div className="px-5 py-4 border-b border-nu-ink/[0.06] flex items-center justify-between bg-indigo-50/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{mimeIcon(selectedFile.mime_type)}</span>
                  <div>
                    <h3 className="font-head text-sm font-bold text-nu-ink">{selectedFile.title}</h3>
                    <p className="font-mono-nu text-[11px] text-nu-muted">
                      {selectedFile.creator?.nickname} · {new Date(selectedFile.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={selectedFile.drive_url} target="_blank" rel="noopener noreferrer"
                    className="font-mono-nu text-[11px] text-indigo-600 hover:underline flex items-center gap-1 no-underline">
                    <ExternalLink size={10} /> 열기
                  </a>
                  <button onClick={() => setSelectedFile(null)} className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-nu-ink">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Comments */}
              <div className="px-5 py-4">
                <h4 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted font-bold mb-3">
                  리뷰 · 답글 ({comments.length})
                </h4>
                {commentLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-indigo-400" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-nu-muted py-2">아직 리뷰가 없습니다</p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center font-head text-[11px] font-bold text-indigo-600 shrink-0 mt-0.5">
                          {c.user_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-head text-xs font-bold text-nu-ink">{c.user_name}</span>
                            <span className="font-mono-nu text-[10px] text-nu-muted">
                              {new Date(c.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm text-nu-graphite mt-0.5 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleComment} className="flex gap-2">
                  <input
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    placeholder="리뷰 또는 답글 작성..."
                    className="flex-1 px-3 py-2 text-sm border border-nu-ink/10 bg-transparent outline-none focus:border-indigo-300"
                  />
                  <button type="submit" disabled={sendingComment || !commentInput.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors group">
                  {f.thumbnail_url ? (
                    <img src={f.thumbnail_url} alt="" className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <span className="text-lg w-8 text-center">{mimeIcon(f.mime_type)}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={f.drive_url || "#"} target="_blank" rel="noopener noreferrer"
                      className="font-head text-sm font-bold text-nu-ink no-underline hover:text-indigo-600 truncate block">
                      {f.title}
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      {f.project?.title && (
                        <Link href={`/staff/workspace/${f.project.id}`} className="font-mono-nu text-[10px] text-indigo-600 no-underline hover:underline" onClick={e => e.stopPropagation()}>
                          {f.project.title}
                        </Link>
                      )}
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        · {f.creator?.nickname || "Unknown"} · {new Date(f.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        {formatSize(f.file_size) && ` · ${formatSize(f.file_size)}`}
                      </span>
                    </div>
                  </div>
                  {f.ai_tags && f.ai_tags.length > 0 && (
                    <div className="hidden sm:flex gap-1">
                      {f.ai_tags.slice(0, 3).map((tag: string) => (
                        <button key={tag} onClick={() => setSearch(tag)}
                          className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border-none cursor-pointer hover:bg-indigo-100 transition-colors">
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => openFileDetail(f)}
                    className="p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600 transition-colors shrink-0" title="리뷰/답글">
                    <MessageSquare size={14} />
                  </button>
                  <a href={f.drive_url || "#"} target="_blank" rel="noopener noreferrer" className="text-nu-muted hover:text-indigo-600 transition-colors shrink-0">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
              <FileText size={48} className="mx-auto mb-4 text-nu-ink/15" />
              {search || projectFilter !== "all" ? (
                <>
                  <p className="text-sm text-nu-muted mb-2">검색 결과가 없습니다</p>
                  <button onClick={() => { setSearch(""); setProjectFilter("all"); }}
                    className="font-mono-nu text-[12px] text-indigo-600 underline bg-transparent border-none cursor-pointer">
                    필터 초기화
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-nu-muted">아직 파일이 없습니다</p>
                  <p className="text-xs text-nu-muted mt-1">새 문서를 생성하거나 Google Drive에서 파일을 가져오세요</p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Google Drive 탐색 탭 ── */}
      {tab === "drive" && (
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            <button onClick={() => navigateDriveTo(-1)}
              className={`font-mono-nu text-[12px] uppercase tracking-widest px-2 py-1 border-none bg-transparent cursor-pointer ${
                drivePath.length === 0 ? "text-indigo-600 font-bold" : "text-nu-muted hover:text-indigo-600"
              }`}>
              내 드라이브
            </button>
            {drivePath.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                <ChevronRight size={10} className="text-nu-muted" />
                <button onClick={() => navigateDriveTo(i)}
                  className={`font-mono-nu text-[12px] uppercase tracking-widest px-2 py-1 border-none bg-transparent cursor-pointer ${
                    i === drivePath.length - 1 ? "text-indigo-600 font-bold" : "text-nu-muted hover:text-indigo-600"
                  }`}>
                  {p.name}
                </button>
              </span>
            ))}
            <button onClick={() => loadDriveFiles(drivePath.length > 0 ? drivePath[drivePath.length - 1].id : undefined)}
              className="ml-auto p-1.5 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600" title="새로고침">
              <RefreshCw size={13} className={driveLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Drive search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <Input value={driveSearch} onChange={e => setDriveSearch(e.target.value)}
              placeholder="현재 폴더에서 검색..." className="pl-9 border-nu-ink/15 bg-transparent" />
          </div>

          {driveError && (
            <div className="bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm text-red-600">{driveError}</p>
            </div>
          )}

          {driveLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          ) : filteredDrive.length > 0 ? (
            <div className="space-y-1">
              {filteredDrive.map(f => {
                const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-nu-ink/[0.06] hover:border-blue-200 transition-colors group">
                    <span className="text-lg w-8 text-center">{mimeIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      {isFolder ? (
                        <button onClick={() => openDriveFolder(f.id, f.name)}
                          className="font-head text-sm font-bold text-nu-ink hover:text-blue-600 bg-transparent border-none cursor-pointer p-0 text-left truncate block w-full">
                          {f.name}
                        </button>
                      ) : (
                        <a href={f.webViewLink || "#"} target="_blank" rel="noopener noreferrer"
                          className="font-head text-sm font-bold text-nu-ink no-underline hover:text-blue-600 truncate block">
                          {f.name}
                        </a>
                      )}
                      <p className="font-mono-nu text-[10px] text-nu-muted mt-0.5">
                        {f.owners?.[0]?.displayName || ""}
                        {f.modifiedTime && ` · ${new Date(f.modifiedTime).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}`}
                        {f.size && ` · ${formatSize(parseInt(f.size))}`}
                      </p>
                    </div>
                    {!isFolder && (
                      <button onClick={() => linkDriveFile(f)}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-transparent border border-indigo-200 text-indigo-600 cursor-pointer hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                        + 자료실
                      </button>
                    )}
                    {isFolder ? (
                      <button onClick={() => openDriveFolder(f.id, f.name)}
                        className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-blue-600 shrink-0">
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <a href={f.webViewLink || "#"} target="_blank" rel="noopener noreferrer"
                        className="text-nu-muted hover:text-blue-600 transition-colors shrink-0">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
              <FolderOpen size={48} className="mx-auto mb-4 text-nu-ink/15" />
              <p className="text-sm text-nu-muted">이 폴더에 파일이 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
