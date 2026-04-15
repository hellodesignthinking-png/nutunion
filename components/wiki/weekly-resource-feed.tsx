"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Link2, Plus, Loader2, FileText, CirclePlay, Globe,
  BookOpen, ExternalLink, Trash2, ChevronDown, ChevronUp,
  Sparkles, Calendar, Brain, Upload, FolderOpen, X,
  Check, Search, FileUp, HardDrive, Sheet,
  Presentation, File,
} from "lucide-react";

interface Resource {
  id: string;
  title: string;
  url: string;
  resource_type: string;
  description: string | null;
  auto_summary: string | null;
  metadata: Record<string, string>;
  created_at: string;
  week_start: string;
  sharer?: { id: string; nickname: string | null; avatar_url: string | null } | null;
  linked_page?: { id: string; title: string } | null;
}

interface FileAttachmentRow {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploader?: { nickname: string | null } | null;
}

interface WikiPageOption {
  id: string;
  title: string;
}

/* ── Type config with extended icon set ────────────────────── */
const typeConfig: Record<string, { icon: typeof Link2; color: string; bg: string; label: string }> = {
  youtube:  { icon: CirclePlay,   color: "text-red-500",     bg: "bg-red-50",       label: "YouTube" },
  pdf:      { icon: FileText,     color: "text-red-600",     bg: "bg-red-50",       label: "PDF" },
  docs:     { icon: FileText,     color: "text-blue-600",    bg: "bg-blue-50",      label: "Google Docs" },
  sheet:    { icon: Sheet,        color: "text-green-600",   bg: "bg-green-50",     label: "Google Sheets" },
  slide:    { icon: Presentation, color: "text-amber-500",   bg: "bg-amber-50",     label: "Google Slides" },
  notion:   { icon: Globe,        color: "text-nu-ink",      bg: "bg-nu-cream",     label: "Notion" },
  article:  { icon: BookOpen,     color: "text-green-600",   bg: "bg-green-50",     label: "Article" },
  drive:    { icon: HardDrive,    color: "text-blue-500",    bg: "bg-blue-50",      label: "Google Drive" },
  link:     { icon: Link2,        color: "text-nu-muted",    bg: "bg-nu-ink/5",     label: "Link" },
  other:    { icon: File,         color: "text-nu-muted",    bg: "bg-nu-ink/5",     label: "Other" },
};

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko", { month: "short", day: "numeric" });
}

/** Detect resource type from URL */
function detectResourceType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.endsWith(".pdf") || lower.includes("/pdf")) return "pdf";
  if (lower.includes("docs.google.com/document")) return "docs";
  if (lower.includes("docs.google.com/spreadsheets")) return "sheet";
  if (lower.includes("docs.google.com/presentation")) return "slide";
  if (lower.includes("drive.google.com")) return "drive";
  if (lower.includes("notion.so") || lower.includes("notion.site")) return "notion";
  if (lower.includes("news") || lower.includes("blog") || lower.includes("medium.com") || lower.includes("velog.io")) return "article";
  return "link";
}

export function WeeklyResourceFeed({ groupId, userId }: { groupId: string; userId: string }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>(getWeekStart());
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  // 자료실 browser modal
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<FileAttachmentRow[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // File upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wiki page linking
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [wikiPages, setWikiPages] = useState<WikiPageOption[]>([]);
  const [wikiPagesLoaded, setWikiPagesLoaded] = useState(false);

  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wiki/resources?groupId=${groupId}&weekStart=${selectedWeek}&limit=50`);
      const data = await res.json();
      if (data.resources) setResources(data.resources);
    } catch {
      toast.error("리소스를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedWeek]);

  useEffect(() => { loadResources(); }, [loadResources]);

  // Realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`wiki-resources-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wiki_weekly_resources", filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            loadResources();
            toast.info("새 리소스가 공유되었습니다");
          } else if (payload.eventType === "DELETE") {
            setResources(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadResources]);

  /* ── Submit URL resource ────────────────────────────── */
  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, title: title.trim() || undefined, url: url.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "등록 실패");
      }
      toast.success("리소스가 등록되었습니다");
      setUrl(""); setTitle(""); setDescription(""); setShowForm(false);
      loadResources();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 리소스를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "삭제 실패");
      }
      setResources(prev => prev.filter(r => r.id !== id));
      toast.success("삭제되었습니다");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSummarize(id: string) {
    setSummarizingId(id);
    try {
      const res = await fetch("/api/ai/resource-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: id }),
      });
      if (!res.ok) throw new Error("요약 생성 실패");
      const { summary } = await res.json();
      setResources(prev => prev.map(r => r.id === id ? { ...r, auto_summary: summary } : r));
      toast.success("AI 요약이 생성되었습니다");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSummarizingId(null);
    }
  }

  // Week navigation
  function prevWeek() {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() - 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  }
  function nextWeek() {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + 7);
    const now = getWeekStart();
    if (d.toISOString().split("T")[0] <= now) {
      setSelectedWeek(d.toISOString().split("T")[0]);
    }
  }

  const isCurrentWeek = selectedWeek === getWeekStart();

  // Group by type
  const grouped = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    const type = r.resource_type || "link";
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {});

  /* ── 자료실 browser ─────────────────────────────────── */
  async function openLibrary() {
    setShowLibrary(true);
    setLibraryLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("file_attachments")
        .select("id, file_name, file_url, file_type, file_size, created_at, uploader:profiles!file_attachments_uploaded_by_fkey(nickname)")
        .eq("target_type", "group")
        .eq("target_id", groupId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setLibraryFiles((data as any[]) || []);
    } catch {
      toast.error("자료실을 불러올 수 없습니다");
      setLibraryFiles([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function importFromLibrary(file: FileAttachmentRow) {
    setImportingIds(prev => new Set(prev).add(file.id));
    try {
      // Check if this URL already exists in current week's resources to prevent duplicates
      const existing = resources.find(r => r.url === file.file_url);
      if (existing) {
        toast.info("이미 이번 주 리소스에 등록된 자료입니다");
        return;
      }

      const detectedType = detectResourceType(file.file_url);
      const finalType = file.file_type === "drive-link" ? "drive"
        : file.file_type === "url-link" ? detectedType
        : file.file_type?.includes("pdf") ? "pdf"
        : detectedType;

      const res = await fetch("/api/wiki/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: file.file_name,
          url: file.file_url,
          resourceType: finalType,
          description: `자료실에서 가져옴`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "등록 실패");
      }
      toast.success(`"${file.file_name}" 추가됨`);
      loadResources();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }

  const filteredLibraryFiles = librarySearch
    ? libraryFiles.filter(f => f.file_name.toLowerCase().includes(librarySearch.toLowerCase()))
    : libraryFiles;

  /* ── File Upload to Drive + wiki resources ──────────── */
  async function handleFileUpload() {
    if (!uploadFile && !uploadUrl.trim()) return;
    setUploadSubmitting(true);
    try {
      let fileUrl = "";
      let fileName = uploadTitle.trim() || "";
      let resourceType = "link";

      if (uploadFile) {
        // Upload to Google Drive
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("targetType", "group");
        formData.append("targetId", groupId);

        const driveRes = await fetch("/api/google/drive/upload", {
          method: "POST",
          body: formData,
        });

        if (!driveRes.ok) {
          const err = await driveRes.json();
          throw new Error(err.error || "업로드 실패");
        }

        const driveData = await driveRes.json();
        fileUrl = driveData.file.webViewLink;
        fileName = fileName || driveData.file.name;
        resourceType = "drive";

        // Detect more specific type from mimeType
        const mime = driveData.file.mimeType || "";
        if (mime.includes("pdf")) resourceType = "pdf";
        else if (mime.includes("document") || mime.includes("word")) resourceType = "docs";
        else if (mime.includes("spreadsheet") || mime.includes("excel")) resourceType = "sheet";
        else if (mime.includes("presentation") || mime.includes("slide")) resourceType = "slide";
      } else {
        // URL-based upload — wiki_weekly_resources only (GET merges file_attachments separately)
        fileUrl = uploadUrl.trim();
        fileName = fileName || fileUrl;
        resourceType = detectResourceType(fileUrl);
      }

      // Save to wiki_weekly_resources
      const res = await fetch("/api/wiki/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: fileName,
          url: fileUrl,
          resourceType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "등록 실패");
      }

      toast.success("자료가 업로드되었습니다");
      setUploadFile(null);
      setUploadUrl("");
      setUploadTitle("");
      setShowUpload(false);
      loadResources();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadSubmitting(false);
    }
  }

  /* ── Wiki page linking ──────────────────────────────── */
  async function loadWikiPages() {
    if (wikiPagesLoaded) return;
    try {
      const supabase = createClient();
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id")
        .eq("group_id", groupId);

      if (!topics || topics.length === 0) { setWikiPagesLoaded(true); return; }

      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title")
        .in("topic_id", topics.map(t => t.id))
        .order("title")
        .limit(100);

      setWikiPages(pages || []);
      setWikiPagesLoaded(true);
    } catch {
      // Graceful fallback
      setWikiPagesLoaded(true);
    }
  }

  async function linkToWikiPage(resourceId: string, wikiPageId: string) {
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, wikiPageId }),
      });
      if (!res.ok) throw new Error("연결 실패");
      setResources(prev => prev.map(r =>
        r.id === resourceId
          ? { ...r, linked_page: wikiPages.find(p => p.id === wikiPageId) || null }
          : r
      ));
      setLinkingId(null);
      toast.success("탭 페이지에 연결되었습니다");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="bg-white border-[2px] border-nu-ink">
      {/* Header */}
      <div className="p-5 border-b-[2px] border-nu-ink/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
              <Link2 size={18} className="text-nu-blue" />
              주간 리소스 피드
            </h3>
            <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mt-1">
              Shared Resources · {resources.length} items
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1.5"
          >
            <Plus size={12} /> 리소스 공유
          </button>
        </div>
        {/* Action buttons row */}
        <div className="flex gap-2">
          <button
            onClick={openLibrary}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/15 text-nu-ink hover:border-nu-blue hover:text-nu-blue transition-colors flex items-center gap-1.5 bg-white"
          >
            <FolderOpen size={12} /> 자료실에서 가져오기
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/15 text-nu-ink hover:border-nu-pink hover:text-nu-pink transition-colors flex items-center gap-1.5 bg-white"
          >
            <Upload size={12} /> 자료 업로드
          </button>
        </div>
      </div>

      {/* Add Form (URL) */}
      {showForm && (
        <div className="p-5 border-b border-nu-ink/10 bg-nu-cream/30">
          <div className="space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL을 붙여넣으세요 (YouTube, PDF, 블로그, Notion 등)"
              className="w-full px-4 py-2.5 bg-white border-[2px] border-nu-ink/15 text-sm focus:outline-none focus:border-nu-blue transition-colors"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비워두면 URL에서 자동 추출)"
              className="w-full px-4 py-2 bg-white border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="간단한 설명이나 메모 (선택)"
              rows={2}
              className="w-full px-4 py-2 bg-white border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-nu-muted hover:text-nu-ink transition-colors">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !url.trim()}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-ink text-white hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Form (File or URL to Drive) */}
      {showUpload && (
        <div className="p-5 border-b border-nu-ink/10 bg-nu-cream/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2">
              <FileUp size={14} className="text-nu-pink" /> 자료 업로드
            </h4>
            <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadUrl(""); setUploadTitle(""); }} className="text-nu-muted hover:text-nu-ink transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {/* File or URL toggle */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => { setUploadFile(null); fileInputRef.current?.click(); }}
                className={`flex-1 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] transition-colors flex items-center justify-center gap-1.5 ${
                  uploadFile ? "border-nu-pink text-nu-pink bg-nu-pink/5" : "border-nu-ink/15 text-nu-ink hover:border-nu-pink"
                }`}
              >
                <Upload size={12} /> 파일 선택
              </button>
              <span className="font-mono-nu text-[9px] text-nu-muted self-center px-1">또는</span>
              <div className="flex-1">
                <input
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="URL 입력 (Drive, YouTube, Notion...)"
                  className="w-full px-3 py-2 bg-white border-[2px] border-nu-ink/15 text-[11px] focus:outline-none focus:border-nu-blue transition-colors"
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setUploadFile(f);
                  if (!uploadTitle) setUploadTitle(f.name);
                }
              }}
            />
            {uploadFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-nu-ink/10 text-xs">
                <FileText size={14} className="text-nu-blue shrink-0" />
                <span className="truncate flex-1 text-nu-ink font-medium">{uploadFile.name}</span>
                <span className="text-nu-muted font-mono-nu text-[9px]">
                  {(uploadFile.size / 1024).toFixed(0)} KB
                </span>
                <button onClick={() => setUploadFile(null)} className="text-nu-muted hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="제목 (선택)"
              className="w-full px-3 py-2 bg-white border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors"
            />
            <div className="flex justify-end">
              <button
                onClick={handleFileUpload}
                disabled={uploadSubmitting || (!uploadFile && !uploadUrl.trim())}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {uploadSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                업로드 & 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="px-5 py-3 border-b border-nu-ink/5 flex items-center justify-between bg-nu-paper/50">
        <button onClick={prevWeek} className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink transition-colors">
          ← 이전 주
        </button>
        <span className="font-mono-nu text-[10px] font-bold text-nu-ink flex items-center gap-1.5">
          <Calendar size={11} />
          {new Date(selectedWeek).toLocaleDateString("ko", { month: "long", day: "numeric" })} 주
          {isCurrentWeek && <span className="text-nu-pink ml-1">· 이번 주</span>}
        </span>
        <button
          onClick={nextWeek}
          disabled={isCurrentWeek}
          className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink transition-colors disabled:opacity-30"
        >
          다음 주 →
        </button>
      </div>

      {/* Resources */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-nu-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">로딩 중...</span>
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-10">
            <Link2 size={32} className="mx-auto mb-3 text-nu-ink/10" />
            <p className="text-sm text-nu-muted font-medium mb-1">이번 주에 공유된 리소스가 없습니다</p>
            <p className="text-xs text-nu-muted/60 mb-4">YouTube, PDF, 블로그 등 학습 자료를 공유해보세요</p>
            <div className="flex justify-center gap-2 flex-wrap">
              <button
                onClick={() => setShowForm(true)}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors inline-flex items-center gap-1.5"
              >
                <Plus size={12} /> URL 공유하기
              </button>
              <button
                onClick={openLibrary}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink/15 text-nu-ink hover:border-nu-blue transition-colors inline-flex items-center gap-1.5"
              >
                <FolderOpen size={12} /> 자료실에서 가져오기
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, items]) => {
              const cfg = typeConfig[type] || typeConfig.link;
              const Icon = cfg.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} className={cfg.color} />
                    <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-muted">
                      {cfg.label} ({items.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => {
                      const rCfg = typeConfig[r.resource_type] || typeConfig.link;
                      const RIcon = rCfg.icon;
                      const isYoutube = r.resource_type === "youtube";
                      return (
                        <div key={r.id} className="group flex items-start gap-3 p-3 border border-nu-ink/[0.06] hover:border-nu-blue/30 transition-colors bg-white relative">
                          {/* Thumbnail / Icon */}
                          {r.metadata?.thumbnail_url ? (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 relative block">
                              <img
                                src={r.metadata.thumbnail_url}
                                alt=""
                                className="w-20 h-14 object-cover border border-nu-ink/10"
                              />
                              {isYoutube && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <CirclePlay size={22} className="text-white drop-shadow-md" />
                                </div>
                              )}
                            </a>
                          ) : (
                            <div className={`w-10 h-10 ${rCfg.bg} flex items-center justify-center shrink-0`}>
                              <RIcon size={16} className={rCfg.color} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-nu-ink hover:text-nu-blue transition-colors no-underline flex items-center gap-1"
                            >
                              <span className="truncate">{r.title}</span>
                              <ExternalLink size={11} className="shrink-0 text-nu-muted" />
                            </a>
                            {r.description && (
                              <p className="text-xs text-nu-muted mt-0.5 line-clamp-1">{r.description}</p>
                            )}
                            {r.auto_summary && (
                              <p className="text-xs text-nu-blue/70 mt-1 flex items-center gap-1">
                                <Sparkles size={9} /> {r.auto_summary.slice(0, 80)}...
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 font-mono-nu text-[8px] text-nu-muted/60">
                              <span>{r.sharer?.nickname || "멤버"}</span>
                              <span>·</span>
                              <span>{relativeTime(r.created_at)}</span>
                              {r.linked_page && (
                                <>
                                  <span>·</span>
                                  <span className="text-nu-pink flex items-center gap-0.5">
                                    <BookOpen size={8} /> {r.linked_page.title}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {!r.linked_page && (
                              <button
                                onClick={() => { loadWikiPages(); setLinkingId(linkingId === r.id ? null : r.id); }}
                                className="text-nu-muted/40 hover:text-nu-pink transition-colors p-1"
                                title="탭에 연결"
                              >
                                <BookOpen size={13} />
                              </button>
                            )}
                            {!r.auto_summary && (
                              <button
                                onClick={() => handleSummarize(r.id)}
                                disabled={summarizingId === r.id}
                                className="text-nu-muted/40 hover:text-nu-blue transition-colors p-1"
                                title="AI 요약 생성"
                              >
                                {summarizingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
                              </button>
                            )}
                            {r.sharer?.id === userId && (
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="text-nu-muted/30 hover:text-red-500 transition-colors p-1"
                                title="삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {/* Wiki Page Linker dropdown */}
                          {linkingId === r.id && (
                            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border-[2px] border-nu-ink shadow-lg max-h-48 overflow-y-auto">
                              {!wikiPagesLoaded ? (
                                <div className="p-3 flex items-center gap-2 text-xs text-nu-muted">
                                  <Loader2 size={12} className="animate-spin" /> 로딩 중...
                                </div>
                              ) : wikiPages.length === 0 ? (
                                <div className="p-3 text-xs text-nu-muted">탭 페이지가 없습니다</div>
                              ) : (
                                <>
                                  <div className="px-3 py-2 border-b border-nu-ink/10 font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
                                    탭 페이지 선택
                                  </div>
                                  {wikiPages.map(page => (
                                    <button
                                      key={page.id}
                                      onClick={() => linkToWikiPage(r.id, page.id)}
                                      className="w-full text-left px-3 py-2 text-xs text-nu-ink hover:bg-nu-cream transition-colors flex items-center gap-2"
                                    >
                                      <BookOpen size={10} className="text-nu-pink shrink-0" />
                                      <span className="truncate">{page.title}</span>
                                    </button>
                                  ))}
                                </>
                              )}
                              <button
                                onClick={() => setLinkingId(null)}
                                className="w-full px-3 py-2 text-xs text-nu-muted border-t border-nu-ink/10 hover:bg-nu-cream/50 transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 자료실 Browser Modal ────────────────────────── */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowLibrary(false)}>
          <div
            className="bg-white border-[3px] border-nu-ink w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b-[2px] border-nu-ink/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-head text-lg font-bold text-nu-ink flex items-center gap-2">
                  <FolderOpen size={18} className="text-nu-blue" />
                  자료실에서 가져오기
                </h3>
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mt-1">
                  그룹 자료실 · {libraryFiles.length} files
                </p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="text-nu-muted hover:text-nu-ink transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-nu-ink/5 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
                <input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="파일명으로 검색..."
                  className="w-full pl-9 pr-4 py-2 bg-nu-paper border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors"
                />
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-3">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-nu-muted">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs">로딩 중...</span>
                </div>
              ) : filteredLibraryFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen size={28} className="mx-auto mb-2 text-nu-ink/10" />
                  <p className="text-xs text-nu-muted">
                    {librarySearch ? "검색 결과가 없습니다" : "자료실에 파일이 없습니다"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLibraryFiles.map((file) => {
                    const isImporting = importingIds.has(file.id);
                    // Check if already in resources
                    const alreadyAdded = resources.some(r => r.url === file.file_url);
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 px-3 py-2.5 border border-nu-ink/[0.06] hover:border-nu-blue/20 transition-colors ${
                          alreadyAdded ? "bg-green-50/50" : "bg-white"
                        }`}
                      >
                        <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0">
                          {file.file_type === "drive-link" ? (
                            <HardDrive size={14} className="text-blue-500" />
                          ) : file.file_type?.includes("pdf") ? (
                            <FileText size={14} className="text-red-600" />
                          ) : file.file_type === "url-link" ? (
                            <Link2 size={14} className="text-nu-blue" />
                          ) : (
                            <File size={14} className="text-nu-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-nu-ink truncate">{file.file_name}</p>
                          <div className="font-mono-nu text-[8px] text-nu-muted/60 flex items-center gap-2 mt-0.5">
                            <span>{file.uploader?.nickname || "멤버"}</span>
                            <span>·</span>
                            <span>{relativeTime(file.created_at)}</span>
                            {file.file_size && (
                              <>
                                <span>·</span>
                                <span>{(file.file_size / 1024).toFixed(0)} KB</span>
                              </>
                            )}
                          </div>
                        </div>
                        {alreadyAdded ? (
                          <span className="font-mono-nu text-[9px] text-green-600 flex items-center gap-1 px-2 py-1">
                            <Check size={10} /> 추가됨
                          </span>
                        ) : (
                          <button
                            onClick={() => importFromLibrary(file)}
                            disabled={isImporting}
                            className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                          >
                            {isImporting ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                            추가
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
