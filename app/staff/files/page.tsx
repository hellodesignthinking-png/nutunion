"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, ExternalLink, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function StaffFilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size">("newest");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: fileData }, { data: projData }] = await Promise.all([
        supabase
          .from("staff_files")
          .select("*, project:staff_projects(id, title), creator:profiles!staff_files_created_by_fkey(nickname)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("staff_projects").select("id, title").order("title"),
      ]);
      setFiles(fileData || []);
      setProjects(projData || []);
      setLoading(false);
    }
    load();
  }, []);

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
    if (!mime) return "📄";
    if (mime.includes("document")) return "📝";
    if (mime.includes("spreadsheet")) return "📊";
    if (mime.includes("presentation")) return "📽️";
    if (mime.includes("pdf")) return "📕";
    if (mime.includes("image")) return "🖼️";
    if (mime.includes("folder")) return "📁";
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
      <div className="mb-6">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">파일</h1>
        <p className="font-mono-nu text-[11px] text-nu-muted mt-1 uppercase tracking-widest">
          All Workspace Files · {filtered.length}개
        </p>
      </div>

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
              {/* Thumbnail or icon */}
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
              <p className="text-xs text-nu-muted mt-1">프로젝트에서 Google Drive 파일을 연결하세요</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
