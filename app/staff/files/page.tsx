"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, ExternalLink, Search, X, Plus, Upload, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

export default function StaffFilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [boltProjects, setBoltProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size">("newest");
  const [userId, setUserId] = useState("");

  // Create file states
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"doc" | "sheet" | "link">("doc");
  const [newTitle, setNewTitle] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      if (createMode === "link") {
        // Drive URL 연결
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
        // Google Docs/Sheets 생성
        const endpoint = createMode === "doc" ? "/api/google/docs/create" : "/api/google/docs/create";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `[Staff] ${newTitle.trim()}`,
          }),
        });
        if (!res.ok) { toast.error("문서 생성 실패. Google 계정 연결을 확인해주세요."); setCreating(false); return; }
        const doc = await res.json();

        const supabase = createClient();
        const mimeType = createMode === "doc"
          ? "application/vnd.google-apps.document"
          : "application/vnd.google-apps.spreadsheet";
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

      // Reload
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

  const mimeIcon = (mime: string | null) => {
    if (!mime) return "\uD83D\uDCC4";
    if (mime.includes("document")) return "\uD83D\uDCDD";
    if (mime.includes("spreadsheet")) return "\uD83D\uDCCA";
    if (mime.includes("presentation")) return "\uD83D\uDCBD";
    if (mime.includes("pdf")) return "\uD83D\uDCD5";
    if (mime.includes("image")) return "\uD83D\uDDBC\uFE0F";
    if (mime.includes("folder")) return "\uD83D\uDCC1";
    return "\uD83D\uDCC4";
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
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">
            All Workspace Files · {filtered.length}개
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest gap-1.5"
        >
          {showCreate ? <X size={12} /> : <Plus size={12} />}
          {showCreate ? "닫기" : "새 파일"}
        </Button>
      </div>

      {/* Create file form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-indigo-200 p-5 mb-6 space-y-3">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-3">
            {([
              { key: "doc", label: "문서", icon: "\uD83D\uDCDD" },
              { key: "sheet", label: "스프레드시트", icon: "\uD83D\uDCCA" },
              { key: "link", label: "URL 연결", icon: "\uD83D\uDD17" },
            ] as const).map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setCreateMode(m.key)}
                className={`font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border cursor-pointer transition-colors ${
                  createMode === m.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={createMode === "link" ? "" : "sm:col-span-2"}>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">
                {createMode === "link" ? "파일명" : "제목"}
              </label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder={createMode === "doc" ? "문서 제목..." : createMode === "sheet" ? "시트 제목..." : "파일명..."}
                className="border-nu-ink/15 bg-transparent"
              />
            </div>
            {createMode === "link" && (
              <div>
                <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">Google Drive URL</label>
                <Input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="border-nu-ink/15 bg-transparent"
                />
              </div>
            )}
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-gray block mb-1">프로젝트 (선택)</label>
              <select
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm"
              >
                <option value="">프로젝트 미연결</option>
                <optgroup label="스태프">
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={creating || !newTitle.trim() || (createMode === "link" && !linkUrl.trim())}
            className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[10px] uppercase tracking-widest"
          >
            {creating ? "처리 중..." : createMode === "link" ? "연결" : "생성"}
          </Button>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="파일명, 태그, 요약 검색..."
            className="pl-9 border-nu-ink/15 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer p-0" aria-label="검색 초기화">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="all">모든 프로젝트</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 bg-transparent cursor-pointer"
        >
          <option value="newest">최신순</option>
          <option value="name">이름순</option>
          <option value="size">크기순</option>
        </select>
      </div>

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
                <a
                  href={f.drive_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-head text-sm font-bold text-nu-ink no-underline hover:text-indigo-600 truncate block"
                >
                  {f.title}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  {f.project?.title && (
                    <Link href={`/staff/workspace/${f.project.id}`} className="font-mono-nu text-[8px] text-indigo-600 no-underline hover:underline" onClick={e => e.stopPropagation()}>
                      {f.project.title}
                    </Link>
                  )}
                  <span className="font-mono-nu text-[8px] text-nu-muted">
                    · {f.creator?.nickname || "Unknown"} · {new Date(f.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    {formatSize(f.file_size) && ` · ${formatSize(f.file_size)}`}
                  </span>
                </div>
                {f.ai_summary && (
                  <p className="font-mono-nu text-[8px] text-nu-muted/60 mt-0.5 truncate">{f.ai_summary}</p>
                )}
              </div>
              {f.ai_tags && f.ai_tags.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {f.ai_tags.slice(0, 3).map((tag: string) => (
                    <button
                      key={tag}
                      onClick={() => setSearch(tag)}
                      className="font-mono-nu text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border-none cursor-pointer hover:bg-indigo-100 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              <a href={f.drive_url || "#"} target="_blank" rel="noopener noreferrer" className="text-nu-muted hover:text-indigo-600 transition-colors shrink-0" aria-label="파일 열기">
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
              <button
                onClick={() => { setSearch(""); setProjectFilter("all"); }}
                className="font-mono-nu text-[10px] text-indigo-600 underline bg-transparent border-none cursor-pointer"
              >
                필터 초기화
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-nu-muted">아직 파일이 없습니다</p>
              <p className="text-xs text-nu-muted mt-1">새 문서를 생성하거나 Google Drive 파일을 연결하세요</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
