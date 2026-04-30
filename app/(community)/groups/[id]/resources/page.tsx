"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { FileAttachment } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Search,
  FileText,
  Image,
  Film,
  File,
  Trash2,
  ExternalLink,
  Link2,
  FolderOpen,
  HardDrive,
  Plus,
  ArrowLeft,
  ChevronRight,
  Eye,
  Columns,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  MessageCircle,
  Send,
  Tag,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal";
// Lazy-load FilePreviewPanel — defers highlight.js (~100kb) until user opens a preview.
const FilePreviewPanel = dynamic(
  () => import("@/components/shared/file-preview-panel").then((m) => ({ default: m.FilePreviewPanel })),
  { ssr: false },
);
import { WikiPagePreviewPanel } from "@/components/shared/wiki-preview-panel";
import { ResourceInteractions } from "@/components/shared/resource-interactions";
import { ResourceEditor } from "@/components/shared/resource-editor";
import { resolveTemplateContent } from "@/lib/template-resolver";
import { NewDocumentModal } from "@/components/shared/new-document-modal";
import { DriveLinkBanner } from "@/components/shared/drive-link-banner";
import { DriveImportButton } from "@/components/shared/drive-import-button";
import { DriveDirectUploadButton } from "@/components/shared/drive-direct-upload-button";
import { DriveSyncBadge } from "@/components/shared/drive-sync-badge";
import { FileAiSummary } from "@/components/shared/file-ai-summary";
import { DropZoneUpload } from "@/components/shared/drop-zone-upload";
import { NewDocDropdown } from "@/components/shared/new-doc-dropdown";
import { LinkPreviewPanel } from "@/components/shared/link-preview-panel";

function getFileIcon(fileType: string | null, url?: string | null) {
  if (!fileType) return <File size={20} />;
  // Template document types
  if (fileType === "meeting_notes") return <BookOpen size={20} className="text-nu-pink" />;
  if (fileType === "spreadsheet" || fileType === "table_doc") return <FileText size={20} className="text-green-600" />;
  if (fileType === "presentation") return <FileText size={20} className="text-nu-amber" />;
  if (fileType === "checklist") return <FileText size={20} className="text-green-500" />;
  if (fileType === "document") return <FileText size={20} className="text-nu-blue" />;
  // Google Drive native document types
  if (fileType === "drive-doc") return <FileText size={20} className="text-blue-600" />;
  if (fileType === "drive-sheet") return <FileText size={20} className="text-green-600" />;
  if (fileType === "drive-slide") return <FileText size={20} className="text-amber-600" />;
  if (fileType === "drive-drawing") return <FileText size={20} className="text-purple-600" />;
  // Standard file types
  if (fileType.startsWith("image/")) return <Image size={20} className="text-nu-pink" />;
  if (fileType.startsWith("video/")) return <Film size={20} className="text-nu-blue" />;
  if (fileType.includes("pdf") || fileType.includes("document")) return <FileText size={20} className="text-nu-amber" />;
  if (fileType === "drive-link") return <HardDrive size={20} className="text-green-600" />;
  if (fileType === "url-link") {
    // Recognize popular link platforms by URL pattern
    const u = (url || "").toLowerCase();
    if (u.includes("youtube.com") || u.includes("youtu.be")) return <Film size={20} className="text-red-600" />;
    if (u.includes("vimeo.com")) return <Film size={20} className="text-cyan-600" />;
    if (u.includes("loom.com")) return <Film size={20} className="text-purple-600" />;
    if (u.includes("figma.com")) return <FileText size={20} className="text-fuchsia-600" />;
    if (u.includes("notion.so") || u.includes("notion.site")) return <BookOpen size={20} className="text-nu-ink" />;
    if (u.includes("github.com") || u.includes("gist.github.com")) return <FileText size={20} className="text-nu-ink" />;
    if (u.includes("twitter.com") || u.includes("x.com")) return <Link2 size={20} className="text-sky-500" />;
    if (u.includes("open.spotify.com")) return <Link2 size={20} className="text-green-500" />;
    return <Link2 size={20} className="text-nu-blue" />;
  }
  return <File size={20} className="text-nu-graphite" />;
}

function getDocTypeLabel(fileType: string | null): string | null {
  const labels: Record<string, string> = {
    meeting_notes: "회의록",
    spreadsheet: "시트",
    presentation: "슬라이드",
    checklist: "체크리스트",
    table_doc: "테이블",
    document: "문서",
    "drive-doc": "Google 문서",
    "drive-sheet": "Google 시트",
    "drive-slide": "Google 슬라이드",
    "drive-drawing": "Google 드로잉",
  };
  return fileType ? labels[fileType] || null : null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MeetingResource {
  name: string;
  url: string;
  meetingTitle: string;
}

interface ResourceComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: { nickname: string; avatar_url: string | null } | null;
}

interface ResourceTag {
  id: string;
  tag: string;
  user_id: string;
}

const TAG_OPTIONS = [
  { label: "유용함", emoji: "👍", color: "bg-green-100 text-green-700 border-green-200" },
  { label: "참고", emoji: "📌", color: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  { label: "필독", emoji: "🔥", color: "bg-red-100 text-red-700 border-red-200" },
] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko");
}

export default function ResourcesPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [files, setFiles] = useState<(FileAttachment & { uploader?: { nickname: string | null } })[]>([]);
  const [meetingResources, setMeetingResources] = useState<MeetingResource[]>([]);
  const [wikiPages, setWikiPages] = useState<{id: string; title: string; content: string; updated_at: string; topic_name: string; google_doc_url?: string; author_nickname?: string}[]>([]);
  // wiki_weekly_resources — links/articles shared via wiki tab gap analysis or synthesis
  const [wikiResources, setWikiResources] = useState<{id: string; title: string; url: string; resource_type: string; auto_summary: string | null; contributor: string | null; created_at: string; linked_wiki_page_id: string | null; linked_page_title: string | null}[]>([]);
  // set of file_attachment IDs that are linked to a wiki page
  const [wikiLinkedIds, setWikiLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "size">("newest");
  const [driveOnly, setDriveOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [bulkMoving, setBulkMoving] = useState(false);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  async function bulkMove() {
    if (selectedIds.size === 0) return;
    const target = window.prompt(
      "이동할 폴더 경로를 입력하세요 (빈 칸 = 루트, 예: 'design' 또는 'clients/2026')",
      currentFolder,
    );
    if (target === null) return;
    setBulkMoving(true);
    try {
      const r = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "file_attachments",
          ids: Array.from(selectedIds),
          folder_path: target,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (json?.code === "MIGRATION_MISSING") {
          toast.error("폴더 기능이 활성화되지 않았어요 (마이그레이션 133 필요)");
        } else {
          toast.error(json?.error || "이동 실패");
        }
        return;
      }
      const skipped = json.skipped > 0 ? ` (${json.skipped}개는 권한 없어 건너뜀)` : "";
      toast.success(`${json.moved}개 이동 완료${skipped}`);
      clearSelection();
      await loadData();
    } finally {
      setBulkMoving(false);
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 자료를 삭제할까요? Drive 사본도 같이 정리됩니다.`)) return;
    setBulkDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const r = await fetch("/api/files/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, table: "file_attachments" }),
        });
        if (r.ok) okCount++;
        else failCount++;
      } catch { failCount++; }
    }
    setBulkDeleting(false);
    clearSelection();
    if (failCount > 0) toast.error(`${okCount}개 삭제 / ${failCount}개 실패`);
    else toast.success(`${okCount}개 삭제 완료`);
    await loadData();
  }
  const [userId, setUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "files" | "drive" | "links" | "meetings" | "wiki" | "wiki-resources">("all");
  const [groupName, setGroupName] = useState("");
  const [previewData, setPreviewData] = useState<{
    url: string;
    name: string;
    id?: string;
    content?: string | null;
    mime?: string | null;
    size?: number | null;
    storage_type?: string | null;
    storage_key?: string | null;
    uploaded_by?: string | null;
  } | null>(null);
  const [wikiPreviewPage, setWikiPreviewPage] = useState<null | {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    topic_name?: string | null;
    author_nickname?: string | null;
    google_doc_url?: string | null;
  }>(null);
  const [isSplitView, setIsSplitView] = useState(true);
  const [showAiSummary, setShowAiSummary] = useState(true);
  // isDragging removed — server upload deprecated
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByResource, setCommentsByResource] = useState<Record<string, ResourceComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<string | null>(null);
  const [tagsByResource, setTagsByResource] = useState<Record<string, ResourceTag[]>>({});
  const [addingWikiResource, setAddingWikiResource] = useState<string | null>(null);
  const [sharedFolder, setSharedFolder] = useState<{ id: string; url: string } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock AI summary generator
  const getAiSummary = (fileName: string) => {
    if (fileName.includes("기획")) return ["본 문서는 볼트의 핵심 타겟과 시장 분석 데이터를 포함하고 있습니다.", "경쟁사 분석을 통해 도출된 3가지 차별화 전략이 명시되어 있습니다.", "Q3까지의 단계별 실행 로드맵과 예상 리소스를 요약하고 있습니다."];
    if (fileName.includes("커피") || fileName.includes("영수증")) return ["2026년 4월 6일 스타벅스에서 결제된 다과비 지출 내역입니다.", "팀 미팅 중 발생한 비용으로 총 8잔의 아메리카노가 포함되었습니다.", "정산 규정에 따라 운영비 카테고리로 분류되어 검토 대기 중입니다."];
    return ["해당 문서는 너트 활동 중 생성된 지식 자산입니다.", "핵심 키워드와 실행 액션 아이템이 상세히 기록되어 있습니다.", "전체 맥락을 파악하기 위해 문서 전문 확인을 권장합니다."];
  };

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: grp }, { data: membership }] = await Promise.all([
      supabase.from("groups").select("name, host_id").eq("id", groupId).single(),
      supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    ]);
    if (grp) {
      setGroupName(grp.name || "너트");
      setHostId(grp.host_id || null);
      setIsManager(grp.host_id === user.id || membership?.role === "moderator" || membership?.role === "host");
      setDriveUrl((grp as any).google_drive_url || null);
    }

    // Fetch shared Google Drive folder info
    try {
      const folderRes = await fetch(`/api/google/drive/shared-folder?targetType=group&targetId=${groupId}`);
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        setSharedFolder(folderData.folder || null);
      }
    } catch { /* ignore */ }

    const { data: filesData } = await supabase
      .from("file_attachments")
      .select("*, uploader:profiles!file_attachments_uploaded_by_fkey(nickname)")
      .eq("target_type", "group")
      .eq("target_id", groupId)
      .order("created_at", { ascending: false });

    if (filesData) setFiles(filesData as any);

    // Fetch meeting resources from agendas AND meeting_resources table
    const allMeetingResources: MeetingResource[] = [];

    try {
      const { data: agendas } = await supabase
        .from("meeting_agendas")
        .select("resources, meeting:meetings!meeting_agendas_meeting_id_fkey(title, group_id)")
        .not("resources", "eq", "[]");

      if (agendas) {
        for (const agenda of agendas) {
          const meeting = agenda.meeting as any;
          if (meeting?.group_id !== groupId) continue;
          if (!agenda.resources || !Array.isArray(agenda.resources)) continue;
          for (const r of agenda.resources as { name: string; url: string }[]) {
            allMeetingResources.push({ name: r.name, url: r.url, meetingTitle: meeting.title });
          }
        }
      }
    } catch { /* agendas may not have resources */ }

    try {
      const { data: mtgRes } = await supabase
        .from("meeting_resources")
        .select("title, url, meeting:meetings!meeting_resources_meeting_id_fkey(title, group_id)")
        .order("created_at", { ascending: false });

      if (mtgRes) {
        for (const r of mtgRes) {
          const meeting = r.meeting as any;
          if (meeting?.group_id !== groupId) continue;
          // Avoid duplicates already in file_attachments
          if (!allMeetingResources.some(m => m.url === r.url)) {
            allMeetingResources.push({ name: r.title, url: r.url, meetingTitle: meeting.title });
          }
        }
      }
    } catch { /* meeting_resources table may not exist */ }

    setMeetingResources(allMeetingResources);

    // Fetch wiki pages
    const { data: wikiData } = await supabase
      .from("wiki_pages")
      .select("id, title, content, updated_at, google_doc_id, google_doc_url, topic:wiki_topics!wiki_pages_topic_id_fkey(name, group_id), author:profiles!wiki_pages_created_by_fkey(nickname)")
      .eq("topic.group_id", groupId)
      .order("updated_at", { ascending: false });

    if (wikiData) {
      setWikiPages(
        (wikiData as any[])
          .filter((w: any) => w.topic?.group_id === groupId)
          .map((w: any) => ({
            id: w.id,
            title: w.title,
            content: w.content?.substring(0, 200) || "",
            updated_at: w.updated_at,
            topic_name: w.topic?.name || "",
            google_doc_url: w.google_doc_url || null,
            author_nickname: w.author?.nickname || "",
          }))
      );
    }

    // Fetch wiki_weekly_resources — all links/articles shared via wiki
    try {
      const { data: wikiRes } = await supabase
        .from("wiki_weekly_resources")
        .select("id, title, url, resource_type, auto_summary, created_at, linked_wiki_page_id, contributor:profiles!wiki_weekly_resources_shared_by_fkey(nickname), linked_page:wiki_pages!wiki_weekly_resources_linked_wiki_page_id_fkey(title)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (wikiRes) {
        const mapped = (wikiRes as any[]).map((r: any) => ({
          id: r.id,
          title: r.title,
          url: r.url || "",
          resource_type: r.resource_type || "link",
          auto_summary: r.auto_summary || null,
          contributor: r.contributor?.nickname || null,
          created_at: r.created_at,
          linked_wiki_page_id: r.linked_wiki_page_id || null,
          linked_page_title: r.linked_page?.title || null,
        }));
        setWikiResources(mapped);

        // Build a set of file_attachment URLs that are in wiki resources
        // Cross-reference by URL to find linked ones
        const wikiUrls = new Set(mapped.map((r: any) => r.url).filter(Boolean));
        if (filesData) {
          const linkedFileIds = new Set(
            (filesData as any[])
              .filter((f: any) => f.file_url && wikiUrls.has(f.file_url))
              .map((f: any) => f.id)
          );
          setWikiLinkedIds(linkedFileIds);
        }
      }
    } catch { /* wiki_weekly_resources table may not exist */ }

    setLoading(false);
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Shared Folder ──
  const createSharedFolder = useCallback(async () => {
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/google/drive/shared-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "group", targetId: groupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "폴더 생성 실패");
      setSharedFolder({ id: data.folderId, url: data.folderUrl });
      toast.success(`공유 폴더 "${data.folderName}" 생성 완료!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingFolder(false);
    }
  }, [groupId]);

  // ── Comments ──
  const loadComments = useCallback(async (resourceId: string) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("resource_comments")
        .select("id, content, created_at, user_id, author:profiles!resource_comments_user_id_fkey(nickname, avatar_url)")
        .eq("resource_id", resourceId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setCommentsByResource((prev) => ({ ...prev, [resourceId]: data as any }));
      }
    } catch {
      // resource_comments table may not exist yet
      setCommentsByResource((prev) => ({ ...prev, [resourceId]: [] }));
    }
  }, []);

  const postComment = useCallback(async (resourceId: string) => {
    const content = (commentInputs[resourceId] || "").trim();
    if (!content || !userId) return;
    setPostingComment(resourceId);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("resource_comments").insert({
        resource_id: resourceId,
        resource_type: "file",
        group_id: groupId,
        user_id: userId,
        content,
      });
      if (error) {
        toast.error("댓글 등록에 실패했습니다");
      } else {
        setCommentInputs((prev) => ({ ...prev, [resourceId]: "" }));
        await loadComments(resourceId);
      }
    } catch {
      toast.error("댓글 기능을 사용할 수 없습니다");
    }
    setPostingComment(null);
  }, [commentInputs, userId, loadComments]);

  const deleteComment = useCallback(async (resourceId: string, commentId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("resource_comments").delete().eq("id", commentId).eq("user_id", userId);
      if (error) {
        toast.error("댓글 삭제에 실패했습니다");
      } else {
        await loadComments(resourceId);
        toast.success("댓글이 삭제되었습니다");
      }
    } catch {
      toast.error("댓글 삭제에 실패했습니다");
    }
  }, [userId, loadComments]);

  const toggleComments = useCallback((resourceId: string) => {
    setExpandedComments((prev) => {
      const next = { ...prev, [resourceId]: !prev[resourceId] };
      if (next[resourceId] && !commentsByResource[resourceId]) {
        loadComments(resourceId);
      }
      return next;
    });
  }, [commentsByResource, loadComments]);

  // ── Tags ──
  const loadTags = useCallback(async (resourceId: string) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("resource_tags")
        .select("id, tag, user_id")
        .eq("resource_id", resourceId);
      if (!error && data) {
        setTagsByResource((prev) => ({ ...prev, [resourceId]: data }));
      }
    } catch {
      // resource_tags table may not exist yet
    }
  }, []);

  const toggleTag = useCallback(async (resourceId: string, tag: string) => {
    if (!userId) return;
    const supabase = createClient();
    const existing = (tagsByResource[resourceId] || []).find(
      (t) => t.tag === tag && t.user_id === userId
    );
    try {
      if (existing) {
        await supabase.from("resource_tags").delete().eq("id", existing.id);
      } else {
        await supabase.from("resource_tags").insert({ resource_id: resourceId, user_id: userId, tag });
      }
      await loadTags(resourceId);
    } catch {
      toast.error("태그 기능을 사용할 수 없습니다");
    }
  }, [userId, tagsByResource, loadTags]);

  // Load tags for visible files
  useEffect(() => {
    for (const f of files) {
      if (!tagsByResource[f.id]) {
        loadTags(f.id);
      }
    }
  }, [files, tagsByResource, loadTags]);

  // ── Add to Wiki Resource Feed ──
  const addToWikiResources = useCallback(async (file: { id: string; file_name: string; file_url: string; file_type: string | null }) => {
    if (!userId) return;
    setAddingWikiResource(file.id);
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: file.file_name,
          url: file.file_url,
          resourceType: undefined, // let auto-detection work
          description: null,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("탭 주간 리소스 피드에 추가되었습니다!");
      } else {
        toast.error(result.error || "추가에 실패했습니다");
      }
    } catch {
      toast.error("탭 리소스 추가에 실패했습니다");
    }
    setAddingWikiResource(null);
  }, [groupId, userId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // [Drive migration Phase 3a] R2 canonical 업로드 — 클라에서 직접 R2 로 PUT 후
      // 서버 API 에는 메타만 전달 (RLS 우회용 DB insert 만 수행).
      const { uploadFile } = await import("@/lib/storage/upload-client");
      const up = await uploadFile(file, { prefix: "resources", scopeId: groupId });

      const res = await fetch("/api/resources/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          file_name: up.name,
          file_url: up.url,
          file_size: up.size,
          file_type: up.mime,
          storage_type: up.storage,
          storage_key: up.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      toast.success(`파일이 업로드되었습니다 · ${up.storage.toUpperCase()}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "업로드 실패");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }



  async function handleDriveFilePicked(driveFile: { name: string; url: string; mimeType: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); return; }

    const { error } = await supabase.from("file_attachments").insert({
      target_type: "group",
      target_id: groupId,
      uploaded_by: user.id,
      file_name: driveFile.name,
      file_url: driveFile.url,
      file_size: null,
      file_type: "drive-link",
    });

    if (error) {
      toast.error("드라이브 파일 등록에 실패했습니다");
    } else {
      toast.success(`"${driveFile.name}" 을(를) 자료실에 추가했습니다`);
      await loadData();
    }
  }

  async function handleDelete(fileId: string, _fileUrl: string, _fileType: string | null) {
    // 통합 삭제 API — DB row + 스토리지(R2/Supabase) 같이 제거.
    const r = await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fileId, table: "file_attachments" }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast.error(json?.error || "삭제에 실패했습니다");
      return;
    }
    if (Array.isArray(json.storage_warnings) && json.storage_warnings.length > 0) {
      console.warn("[delete] storage cleanup warnings", json.storage_warnings);
    }
    toast.success("파일이 삭제되었습니다");
    await loadData();
  }

  async function handleRename(fileId: string, newName: string) {
    const supabase = createClient();
    const { error } = await supabase.from("file_attachments").update({ file_name: newName }).eq("id", fileId);
    if (error) {
      toast.error("이름 변경에 실패했습니다");
    } else {
      toast.success("이름이 변경되었습니다");
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, file_name: newName } : f));
    }
  }

  // Genesis R2 folder placeholders — 자료실 상단 "폴더" 섹션에 별도 표시
  const genesisFolders = files.filter((f) => f.file_type === "folder-placeholder" || (f.file_name || "").startsWith("📁 "));
  const normalFiles = files.filter((f) => f.file_type !== "folder-placeholder" && !(f.file_name || "").startsWith("📁 "));
  const isDriveFile = (ft: string | null | undefined) =>
    ft === "drive-link" || ft === "drive-doc" || ft === "drive-sheet" || ft === "drive-slide" || ft === "drive-drawing";
  const uploadedFiles = normalFiles.filter((f) => !isDriveFile(f.file_type) && f.file_type !== "url-link");
  const driveFiles = normalFiles.filter((f) => isDriveFile(f.file_type));
  const externalLinks = normalFiles.filter((f) => f.file_type === "url-link");

  // 정렬 + Drive-only 필터
  const sortFn = (a: any, b: any): number => {
    switch (sortBy) {
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return (a.file_name || "").localeCompare(b.file_name || "", "ko");
      case "size":
        return (b.file_size || 0) - (a.file_size || 0);
      case "newest":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  };
  const driveFilterFn = (f: any) => !driveOnly || !!f.drive_edit_file_id;

  const folderFilterFn = (f: any) => ((f.folder_path || "") === currentFolder);
  const filteredUploadedFiles = uploadedFiles
    .filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(folderFilterFn)
    .filter(driveFilterFn)
    .sort(sortFn);

  // 현재 그룹에서 발견된 모든 폴더 (루트 제외)
  const folderList: string[] = Array.from(
    new Set(uploadedFiles.map((f) => (f as any).folder_path).filter((p: any) => typeof p === "string" && p.length > 0)),
  ).sort();
  const filteredDriveFiles = driveFiles
    .filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(sortFn);
  const filteredExternalLinks = externalLinks
    .filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(sortFn);
  const filteredMeetingResources = meetingResources.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredWikiPages = wikiPages.filter((w) => w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.topic_name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-nu-cream/50 w-48" />
          <div className="h-10 bg-nu-cream/50" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-nu-cream/50" />
            <div className="h-24 bg-nu-cream/50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto px-4 md:px-8 py-10 transition-all duration-500 ${isSplitView ? "max-w-full" : "max-w-5xl"}`}>
      <div className={`flex flex-col lg:flex-row gap-8 ${isSplitView ? "lg:items-start" : ""}`}>
        
        <div className={`transition-all duration-500 ${isSplitView ? "lg:w-[60%] xl:w-[55%] shrink-0" : "w-full"}`}>
          <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[13px] uppercase tracking-widest">
            <Link href={`/groups/${groupId}`}
              className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
              <ArrowLeft size={12} /> {groupName || "너트"}
            </Link>
            <ChevronRight size={12} className="text-nu-muted/40" />
            <span className="text-nu-ink">자료실</span>
          </nav>

          {/* Google Drive 연결 상태 배너 */}
          {groupId && (
            <DriveLinkBanner
              targetType="group"
              targetId={String(groupId)}
              canManage={!!(userId && hostId && userId === hostId)}
              driveUrl={driveUrl}
            />
          )}

          {/* 미리보기 힌트 */}
          <ResourcePreviewHint />


          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <div className="px-2 py-0.5 bg-nu-blue text-nu-paper font-mono-nu text-[11px] font-black uppercase tracking-[0.2em] rounded">Unified_Atlas</div>
                 <div className="px-2 py-0.5 bg-nu-pink/10 text-nu-pink font-mono-nu text-[11px] font-black uppercase tracking-[0.2em] rounded flex items-center gap-1">
                   <Sparkles size={8} /> AI_Enabled
                 </div>
              </div>
              <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight">Knowledge Atlas</h1>
              <p className="text-nu-gray text-sm mt-1">분산된 지식을 AI로 통합하고 3줄로 요약된 인사이트를 확인하세요.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setShowAiSummary(!showAiSummary)}
                className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] transition-all flex items-center gap-2 ${
                  showAiSummary ? "bg-nu-blue text-nu-paper border-nu-blue" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
                }`}
              >
                <Sparkles size={13} /> AI 요약 {showAiSummary ? "ON" : "OFF"}
              </button>
              
              <button
                onClick={() => setIsSplitView(!isSplitView)}
                className={`p-2.5 border-[2px] transition-all ${
                  isSplitView ? "bg-nu-ink text-nu-paper border-nu-ink" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
                }`}
              >
                {isSplitView ? <Maximize2 size={16} /> : <Columns size={16} />}
              </button>
            </div>
          </div>

          {/* Storage Stats — R2 사용량 + Drive 사본 수 (그룹 전체 기준) */}
          <ResourceStatsPanel files={files} />

          {/* Search Enhancement */}
          <div className="relative mb-3">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="파일 이름, 태그, 또는 문서 본문의 내용을 지능적으로 검색합니다..."
              className="w-full pl-12 pr-4 py-4 bg-nu-white border-2 border-nu-ink shadow-[4px_4px_0px_0px_#0d0d0d] focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all outline-none font-medium text-nu-ink"
            />
          </div>

          {/* Sort + Filter row */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mr-1">정렬</span>
            {([
              { v: "newest", label: "최신순" },
              { v: "oldest", label: "오래된순" },
              { v: "name", label: "이름" },
              { v: "size", label: "크기" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setSortBy(opt.v)}
                className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] transition-all ${
                  sortBy === opt.v
                    ? "border-nu-ink bg-nu-ink text-nu-paper"
                    : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="w-px h-4 bg-nu-ink/15 mx-2" />
            <button
              onClick={() => setDriveOnly((v) => !v)}
              className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] transition-all flex items-center gap-1.5 ${
                driveOnly
                  ? "border-nu-pink bg-nu-pink/10 text-nu-pink"
                  : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
              }`}
              title="Drive 사본 연결된 파일만"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${driveOnly ? "bg-nu-pink" : "bg-nu-ink/20"}`} />
              Drive 편집중만
            </button>
          </div>

          {/* ── Quick Upload Hub (3-button consolidated) ── */}
          <div className="mb-6 border-[2px] border-dashed border-nu-ink/15 bg-nu-white">
            <div className="px-5 py-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-nu-muted flex-shrink-0">
                <Upload size={16} />
                <span className="font-mono-nu text-[12px] uppercase tracking-widest font-bold">Quick Add</span>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                {/* 1. 새 문서 — Google Docs/Sheets/Slides 자동 생성 */}
                <NewDocDropdown
                  scope="group"
                  scopeId={groupId}
                  onCreated={() => loadData()}
                />
                {/* 위키 문서 (legacy) */}
                <button
                  onClick={() => setShowNewDocModal(true)}
                  className="flex items-center justify-center gap-2 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] border-nu-ink/20 hover:border-nu-ink text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-all cursor-pointer"
                  title="위키 페이지 형식으로 작성"
                >
                  <FileText size={13} /> 위키 문서
                </button>

                {/* 2. 파일 업로드 (R2) */}
                <label className={`flex items-center justify-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink bg-nu-white text-nu-ink transition-all cursor-pointer hover:bg-nu-ink hover:text-white ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  📎 {uploading ? "업로드 중..." : "파일 업로드"}
                  <input type="file" className="hidden" onChange={handleUpload} multiple={false} />
                </label>

                {/* 3a. Drive 에 직접 업로드 — 편집 가능한 사본을 바로 자료실에 등록 */}
                <DriveDirectUploadButton
                  targetType="group"
                  targetId={groupId}
                  onUploaded={() => loadData()}
                />

                {/* 3b. 기존 Drive 파일을 R2 로 가져오기 */}
                <DriveImportButton
                  prefix="resources"
                  scopeId={groupId}
                  onImported={async (fi) => {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) { toast.error("로그인이 필요합니다"); return; }
                    const { error } = await supabase.from("file_attachments").insert({
                      target_type: "group",
                      target_id: groupId,
                      uploaded_by: user.id,
                      file_name: fi.name,
                      file_url: fi.url,
                      file_size: fi.size,
                      file_type: fi.mime,
                    });
                    if (error) toast.error("자료실 등록 실패: " + error.message);
                    else await loadData();
                  }}
                />

                {/* Link Add (secondary) */}
                <button
                  onClick={() => setShowLinkInput(!showLinkInput)}
                  className={`flex items-center justify-center gap-2 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2.5 border-[2px] transition-all ${
                    showLinkInput ? "bg-nu-blue text-white border-nu-blue" : "border-nu-ink/10 text-nu-muted hover:border-nu-ink"
                  }`}
                >
                  <Link2 size={12} /> 링크
                </button>
              </div>
            </div>

            {/* Inline Link Input */}
            {showLinkInput && (
              <div className="px-5 pb-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex gap-2">
                  <input
                    value={linkName} onChange={e => setLinkName(e.target.value)}
                    placeholder="링크 이름 (예: 노션 기획안)"
                    className="flex-1 h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue"
                  />
                  <input
                    value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-[2] h-9 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-blue"
                  />
                  <button
                    disabled={addingLink || !linkName.trim() || !linkUrl.trim()}
                    onClick={async () => {
                      if (!linkUrl.startsWith("http")) { toast.error("올바른 URL을 입력해주세요"); return; }
                      setAddingLink(true);
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { setAddingLink(false); return; }
                      const { error } = await supabase.from("file_attachments").insert({
                        target_type: "group", target_id: groupId, uploaded_by: user.id,
                        file_name: linkName, file_url: linkUrl, file_size: null, file_type: "url-link",
                      });
                      if (error) toast.error("링크 등록 실패");
                      else { toast.success("✅ 링크가 추가되었습니다!"); setLinkName(""); setLinkUrl(""); setShowLinkInput(false); await loadData(); }
                      setAddingLink(false);
                    }}
                    className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-blue text-white hover:bg-nu-blue/80 transition-all disabled:opacity-30"
                  >
                    {addingLink ? "저장 중..." : "등록"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b-[2px] border-nu-ink/[0.08] mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <button
              onClick={() => setActiveTab("all")}
              className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-3 border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === "all" ? "border-nu-ink text-nu-ink" : "border-transparent text-nu-muted hover:text-nu-ink"
              }`}
            >
              전체 ({files.length + wikiPages.length + meetingResources.length + wikiResources.length})
            </button>
            {([
              { key: "files", label: "파일", icon: <Upload size={13} />, count: filteredUploadedFiles.length },
              { key: "drive", label: "드라이브", icon: <HardDrive size={13} />, count: filteredDriveFiles.length },
              { key: "links", label: "공유 링크", icon: <Link2 size={13} />, count: filteredExternalLinks.length },
              { key: "meetings", label: "미팅 자료", icon: <FileText size={13} />, count: filteredMeetingResources.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 font-mono-nu text-[13px] uppercase tracking-widest px-5 py-3 border-b-[3px] transition-all ${
                  activeTab === tab.key
                    ? "border-nu-pink text-nu-ink font-bold"
                    : "border-transparent text-nu-muted hover:text-nu-graphite"
                }`}
              >
                {tab.icon} {tab.label}
                <span className={`ml-1 px-1.5 py-0.5 text-[11px] rounded ${activeTab === tab.key ? "bg-nu-pink/10 text-nu-pink" : "bg-nu-ink/5 text-nu-muted"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
            <button
              onClick={() => setActiveTab("wiki")}
              className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-3 border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === "wiki" ? "border-nu-pink text-nu-pink" : "border-transparent text-nu-muted hover:text-nu-ink"
              }`}
            >
              <span className="flex items-center gap-1.5">탭 ({wikiPages.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("wiki-resources")}
              className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-3 border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === "wiki-resources" ? "border-nu-blue text-nu-blue" : "border-transparent text-nu-muted hover:text-nu-ink"
              }`}
            >
              <span className="flex items-center gap-1.5">
                탭 자료 ({wikiResources.length})
              </span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="relative min-h-[400px]">
            {activeTab === "all" && (
              <div className="space-y-3">
                {/* Wiki pages */}
                {filteredWikiPages.slice(0, 5).map((page) => (
                  <div key={`wiki-${page.id}`}
                    className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all p-4 flex items-center gap-3 group">
                    <div className="w-9 h-9 bg-nu-pink/10 flex items-center justify-center shrink-0">
                      <Sparkles size={16} className="text-nu-pink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink">탭</span>
                        <button
                          onClick={() => { setWikiPreviewPage({ id: page.id, title: page.title, content: page.content, updated_at: page.updated_at, topic_name: page.topic_name, author_nickname: page.author_nickname, google_doc_url: page.google_doc_url }); setPreviewData(null); if (!isSplitView) setIsSplitView(true); }}
                          className="text-sm font-medium text-nu-ink truncate group-hover:text-nu-pink transition-colors bg-transparent border-none p-0 text-left cursor-pointer"
                        >
                          {page.title}
                        </button>
                      </div>
                      <span className="font-mono-nu text-[11px] text-nu-muted/60">{new Date(page.updated_at).toLocaleDateString("ko")}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setWikiPreviewPage({ id: page.id, title: page.title, content: page.content, updated_at: page.updated_at, topic_name: page.topic_name, author_nickname: page.author_nickname, google_doc_url: page.google_doc_url }); setPreviewData(null); if (!isSplitView) setIsSplitView(true); }}
                        className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors"
                        title="미리보기"
                      >
                        <Eye size={14} />
                      </button>
                      <Link href={`/groups/${groupId}/wiki/pages/${page.id}`} className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors" title="페이지로 이동">
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
                {/* Recent files with source labels */}
                {files.slice(0, 10).map((f) => (
                  <div key={`file-${f.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-blue/40 transition-all group">
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 bg-nu-blue/10 flex items-center justify-center shrink-0">
                        {getFileIcon(f.file_type, f.file_url)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue">
                            {f.file_type === "drive-link" ? "드라이브" : f.file_type === "url-link" ? "링크" : "파일"}
                          </span>
                          {resolveTemplateContent(f.file_url, f.content) ? (
                            <button
                              onClick={() => setPreviewData({ url: f.file_url, name: f.file_name, id: f.id, content: resolveTemplateContent(f.file_url, f.content), mime: f.file_type, size: f.file_size, storage_type: (f as any).storage_type, storage_key: (f as any).storage_key, uploaded_by: f.uploaded_by })}
                              className="text-sm font-medium text-nu-ink truncate hover:text-nu-pink transition-colors text-left bg-transparent border-none cursor-pointer p-0"
                            >
                              {f.file_name}
                            </button>
                          ) : (
                            <a
                              href={f.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-nu-ink truncate hover:text-nu-pink transition-colors no-underline"
                            >
                              {f.file_name}
                            </a>
                          )}
                          {/* Tag badges */}
                          {(tagsByResource[f.id] || []).length > 0 && (
                            <div className="flex items-center gap-1">
                              {Array.from(new Set((tagsByResource[f.id] || []).map(t => t.tag))).map((tag) => {
                                const opt = TAG_OPTIONS.find(o => o.label === tag);
                                return opt ? (
                                  <span key={tag} className={`font-mono-nu text-[9px] font-bold px-1.5 py-0.5 border rounded-sm ${opt.color}`}>
                                    {opt.emoji} {opt.label}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                          {/* 탭 사용됨 badge */}
                          {wikiLinkedIds.has(f.id) && (
                            <span className="inline-flex items-center gap-0.5 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20 shrink-0">
                              <Check size={7} /> 탭에서 사용됨
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-nu text-[11px] text-nu-muted/60">{f.uploader?.nickname || ""} · {timeAgo(f.created_at)}</span>
                          <DriveSyncBadge
                            driveFileId={(f as any).drive_edit_file_id}
                            syncedAt={(f as any).drive_edit_synced_at}
                            ownerUserId={(f as any).drive_edit_user_id}
                            currentUserId={userId}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleComments(f.id)}
                          className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors"
                          title="댓글"
                        >
                          <MessageCircle size={14} />
                        </button>
                        <button
                          onClick={() => addToWikiResources(f)}
                          disabled={addingWikiResource === f.id}
                          className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors disabled:opacity-40"
                          title="탭 리소스에 추가"
                        >
                          {addingWikiResource === f.id ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                        </button>
                        {f.file_url && (
                          <button
                            onClick={() => setPreviewData({ url: f.file_url, name: f.file_name, id: f.id, content: resolveTemplateContent(f.file_url, f.content), mime: f.file_type, size: f.file_size, storage_type: (f as any).storage_type, storage_key: (f as any).storage_key, uploaded_by: f.uploaded_by })}
                            className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors"
                            title="미리보기"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {f.file_url && (
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {(f.uploaded_by === userId || isManager || (hostId && userId === hostId)) && (
                          <button
                            onClick={() => {
                              if (confirm("이 자료를 삭제하시겠습니까?")) {
                                handleDelete(f.id, f.file_url, f.file_type);
                              }
                            }}
                            className="p-1.5 text-nu-muted/40 hover:text-red-500 transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Inline comments */}
                    {expandedComments[f.id] && (
                      <InlineComments
                        resourceId={f.id}
                        comments={commentsByResource[f.id] || []}
                        commentInput={commentInputs[f.id] || ""}
                        onInputChange={(val) => setCommentInputs(prev => ({ ...prev, [f.id]: val }))}
                        onPost={() => postComment(f.id)}
                        onDelete={(commentId) => deleteComment(f.id, commentId)}
                        posting={postingComment === f.id}
                        tags={tagsByResource[f.id] || []}
                        userId={userId}
                        onToggleTag={(tag) => toggleTag(f.id, tag)}
                      />
                    )}
                  </div>
                ))}
                {/* Meeting resources */}
                {filteredMeetingResources.slice(0, 5).map((r, i) => (
                  <a key={`meeting-${i}`} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-amber/40 transition-all p-4 flex items-center gap-3 no-underline group">
                    <div className="w-9 h-9 bg-nu-amber/10 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-nu-amber" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-amber/10 text-nu-amber">미팅</span>
                        <span className="text-sm font-medium text-nu-ink truncate group-hover:text-nu-amber transition-colors">{r.name}</span>
                      </div>
                      <span className="font-mono-nu text-[11px] text-nu-muted/60">{r.meetingTitle}</span>
                    </div>
                  </a>
                ))}
                {/* 탭 자료공유(wiki_weekly_resources) — 전체 탭에 포함 */}
                {wikiResources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.url.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8).map((r) => (
                  <div key={`wr-${r.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-blue/40 transition-all p-4 flex items-center gap-3 group">
                    <div className="w-9 h-9 bg-nu-blue/10 flex items-center justify-center shrink-0">
                      <Link2 size={16} className="text-nu-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue">탭 자료</span>
                        <button
                          onClick={() => { setPreviewData({ url: r.url, name: r.title }); if (!isSplitView) setIsSplitView(true); }}
                          className="text-sm font-medium text-nu-ink truncate hover:text-nu-blue transition-colors text-left bg-transparent border-none cursor-pointer p-0"
                        >
                          {r.title}
                        </button>
                      </div>
                      {r.auto_summary && <p className="text-[11px] text-nu-muted mt-0.5 line-clamp-1">{r.auto_summary}</p>}
                      <span className="font-mono-nu text-[11px] text-nu-muted/60">{r.contributor || ""} · {timeAgo(r.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setPreviewData({ url: r.url, name: r.title }); if (!isSplitView) setIsSplitView(true); }}
                        className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors"
                        title="미리보기"
                      >
                        <Eye size={14} />
                      </button>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
                {files.length === 0 && wikiPages.length === 0 && meetingResources.length === 0 && wikiResources.length === 0 && (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
                    <FolderOpen size={32} className="text-nu-muted/30 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-2">아직 자료가 없습니다</p>
                    <p className="text-nu-muted text-xs">파일을 업로드하거나, 탭을 작성하거나, 미팅을 기록해보세요</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "wiki" && (
              <div className="space-y-3">
                {filteredWikiPages.length === 0 ? (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-8 text-center">
                    <FileText size={28} className="text-nu-muted/30 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-2">아직 탭 페이지가 없습니다</p>
                    <Link href={`/groups/${groupId}/wiki`}
                      className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink hover:underline no-underline">
                      탭에서 페이지 만들기 →
                    </Link>
                  </div>
                ) : (
                  filteredWikiPages.map((page) => (
                    <div key={page.id} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all group">
                      <div className="p-5 flex items-start gap-4">
                        <div className="w-12 h-12 bg-nu-pink/10 flex items-center justify-center shrink-0">
                          <Sparkles size={20} className="text-nu-pink" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 bg-nu-pink/10 text-nu-pink">탭</span>
                            {page.topic_name && (
                              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{page.topic_name}</span>
                            )}
                          </div>
                          <button
                            onClick={() => setWikiPreviewPage({ id: page.id, title: page.title, content: page.content, updated_at: page.updated_at, topic_name: page.topic_name, author_nickname: page.author_nickname, google_doc_url: page.google_doc_url })}
                            className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors block truncate bg-transparent border-none p-0 text-left cursor-pointer w-full"
                          >
                            {page.title}
                          </button>
                          <p className="text-xs text-nu-muted mt-1 line-clamp-2">{page.content}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {page.author_nickname && (
                              <span className="font-mono-nu text-[11px] text-nu-muted">by {page.author_nickname}</span>
                            )}
                            <span className="font-mono-nu text-[11px] text-nu-muted/60">
                              {new Date(page.updated_at).toLocaleDateString("ko")}
                            </span>
                            {page.google_doc_url && (
                              <a href={page.google_doc_url} target="_blank" rel="noopener noreferrer"
                                className="font-mono-nu text-[11px] text-green-600 hover:underline flex items-center gap-1 no-underline">
                                <HardDrive size={10} /> Google Docs
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setWikiPreviewPage({ id: page.id, title: page.title, content: page.content, updated_at: page.updated_at, topic_name: page.topic_name, author_nickname: page.author_nickname, google_doc_url: page.google_doc_url })}
                            className="px-2.5 py-1.5 border-2 border-nu-ink/20 hover:border-nu-pink hover:bg-nu-pink/5 transition-colors font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink inline-flex items-center gap-1"
                            title="미리보기"
                          >
                            <Eye size={12} /> 미리보기
                          </button>
                          <Link
                            href={`/groups/${groupId}/wiki/pages/${page.id}`}
                            className="px-2.5 py-1.5 border-2 border-nu-ink bg-nu-cream hover:bg-nu-pink hover:text-nu-paper transition-colors font-mono-nu text-[11px] uppercase tracking-widest no-underline text-nu-ink inline-flex items-center gap-1"
                            title="편집"
                          >
                            <Pencil size={12} /> 편집
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "files" && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-4">
                  <DropZoneUpload
                    prefix="resources"
                    scopeId={groupId}
                    multiple
                    onUploaded={async (up) => {
                      try {
                        const res = await fetch("/api/resources/group", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            group_id: groupId,
                            file_name: up.name,
                            file_url: up.url,
                            file_size: up.size,
                            file_type: up.mime,
                            storage_type: up.storage,
                            storage_key: up.key,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error || "등록 실패");
                        toast.success(`등록 완료 · ${up.storage.toUpperCase()}`);
                        await loadData();
                      } catch (e: any) {
                        toast.error(e?.message || "등록 실패");
                      }
                    }}
                  />
                </div>
                {filteredUploadedFiles.length === 0 ? (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center overflow-hidden relative">
                    <Upload size={48} className="text-nu-muted/20 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-2">{searchQuery ? "검색 결과가 없습니다" : "업로드된 파일이 없습니다"}</p>
                    <div className="absolute -bottom-4 -right-4 opacity-5">
                       <HardDrive size={120} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 폴더 바 — 루트 + 발견된 폴더들 + 새 폴더 만들기 */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mr-1">
                        폴더
                      </span>
                      <button
                        onClick={() => setCurrentFolder("")}
                        className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] transition-all ${
                          currentFolder === ""
                            ? "border-nu-ink bg-nu-ink text-nu-paper"
                            : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
                        }`}
                      >
                        루트
                      </button>
                      {folderList.map((p) => (
                        <button
                          key={p}
                          onClick={() => setCurrentFolder(p)}
                          className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] transition-all ${
                            currentFolder === p
                              ? "border-nu-ink bg-nu-ink text-nu-paper"
                              : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
                          }`}
                          title={p}
                        >
                          📁 {p}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const name = window.prompt("새 폴더 이름 (예: 'clients/2026')");
                          if (name && name.trim()) setCurrentFolder(name.trim());
                        }}
                        className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] border-dashed border-nu-ink/20 text-nu-muted hover:border-nu-ink hover:text-nu-ink"
                        title="새 폴더로 전환 — 파일 이동 시 자동으로 생성됩니다"
                      >
                        + 새 폴더
                      </button>
                    </div>

                    {/* 벌크 액션 바 — 선택된 항목이 있을 때만 노출 */}
                    {selectedIds.size > 0 && (
                      <div className="mb-3 px-4 py-2 bg-nu-ink text-nu-paper border-2 border-nu-ink flex items-center justify-between gap-3 sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                          <span className="font-mono-nu text-[12px] uppercase tracking-widest font-bold">
                            {selectedIds.size}개 선택됨
                          </span>
                          <button
                            onClick={clearSelection}
                            className="font-mono-nu text-[10px] uppercase tracking-widest underline opacity-70 hover:opacity-100"
                          >
                            해제
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={bulkMove}
                            disabled={bulkMoving}
                            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 border-nu-paper/30 bg-nu-paper/10 text-nu-paper hover:bg-nu-paper/20 transition-all flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {bulkMoving ? <Loader2 size={12} className="animate-spin" /> : "📁"}
                            폴더 이동
                          </button>
                          <button
                            onClick={bulkDelete}
                            disabled={bulkDeleting}
                            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 border-red-400 bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            일괄 삭제
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                      {filteredUploadedFiles.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          userId={userId}
                          hostId={hostId}
                          isManager={isManager}
                          onDelete={handleDelete}
                          onRename={handleRename}
                          onPreview={(url, name) => setPreviewData({ url, name, id: file.id, content: resolveTemplateContent(url, file.content), mime: file.file_type, size: file.file_size, storage_type: (file as any).storage_type, storage_key: (file as any).storage_key, uploaded_by: file.uploaded_by })}
                          showAiSummary={showAiSummary}
                          aiSummary={getAiSummary(file.file_name)}
                          onToggleComments={() => toggleComments(file.id)}
                          commentsExpanded={!!expandedComments[file.id]}
                          comments={commentsByResource[file.id] || []}
                          commentInput={commentInputs[file.id] || ""}
                          onCommentInputChange={(val) => setCommentInputs(prev => ({ ...prev, [file.id]: val }))}
                          onPostComment={() => postComment(file.id)}
                          onDeleteComment={(commentId) => deleteComment(file.id, commentId)}
                          postingComment={postingComment === file.id}
                          tags={tagsByResource[file.id] || []}
                          onToggleTag={(tag) => toggleTag(file.id, tag)}
                          onAddToWiki={() => addToWikiResources(file)}
                          addingWiki={addingWikiResource === file.id}
                          isWikiLinked={wikiLinkedIds.has(file.id)}
                          selectable
                          selected={selectedIds.has(file.id)}
                          onToggleSelect={() => toggleSelected(file.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === "drive" && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {filteredDriveFiles.length === 0 ? (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
                    <HardDrive size={32} className="text-green-400 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-2">{searchQuery ? "검색 결과가 없습니다" : "구글 드라이브 파일이 없습니다"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredDriveFiles.map((file) => (
                      <FileCard
                        key={file.id} file={file} userId={userId} hostId={hostId} isManager={isManager} onDelete={handleDelete} onRename={handleRename} isDrive isWikiLinked={wikiLinkedIds.has(file.id)}
                        onPreview={(url, name) => setPreviewData({ url, name, id: file.id, content: resolveTemplateContent(url, file.content), mime: file.file_type, size: file.file_size, storage_type: (file as any).storage_type, storage_key: (file as any).storage_key, uploaded_by: file.uploaded_by })}
                        onToggleComments={() => toggleComments(file.id)}
                        commentsExpanded={!!expandedComments[file.id]}
                        comments={commentsByResource[file.id] || []}
                        commentInput={commentInputs[file.id] || ""}
                        onCommentInputChange={(val) => setCommentInputs(prev => ({ ...prev, [file.id]: val }))}
                        onPostComment={() => postComment(file.id)}
                        onDeleteComment={(commentId) => deleteComment(file.id, commentId)}
                        postingComment={postingComment === file.id}
                        tags={tagsByResource[file.id] || []}
                        onToggleTag={(tag) => toggleTag(file.id, tag)}
                        onAddToWiki={() => addToWikiResources(file)}
                        addingWiki={addingWikiResource === file.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "links" && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {filteredExternalLinks.length === 0 ? (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
                    <Link2 size={32} className="text-nu-blue mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-2">{searchQuery ? "검색 결과가 없습니다" : "등록된 외부 링크가 없습니다"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredExternalLinks.map((file) => (
                      <FileCard
                        key={file.id} file={file} userId={userId} hostId={hostId} isManager={isManager} onDelete={handleDelete} onRename={handleRename} isLink isWikiLinked={wikiLinkedIds.has(file.id)}
                        onPreview={(url, name) => setPreviewData({ url, name, id: file.id, content: resolveTemplateContent(url, file.content), mime: file.file_type, size: file.file_size, storage_type: (file as any).storage_type, storage_key: (file as any).storage_key, uploaded_by: file.uploaded_by })}
                        onToggleComments={() => toggleComments(file.id)}
                        commentsExpanded={!!expandedComments[file.id]}
                        comments={commentsByResource[file.id] || []}
                        commentInput={commentInputs[file.id] || ""}
                        onCommentInputChange={(val) => setCommentInputs(prev => ({ ...prev, [file.id]: val }))}
                        onPostComment={() => postComment(file.id)}
                        onDeleteComment={(commentId) => deleteComment(file.id, commentId)}
                        postingComment={postingComment === file.id}
                        tags={tagsByResource[file.id] || []}
                        onToggleTag={(tag) => toggleTag(file.id, tag)}
                        onAddToWiki={() => addToWikiResources(file)}
                        addingWiki={addingWikiResource === file.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "meetings" && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {filteredMeetingResources.length === 0 ? (
                  <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
                    <FileText size={32} className="text-nu-pink mx-auto mb-3" />
                    <p className="text-nu-gray text-sm">{searchQuery ? "검색 결과가 없습니다" : "미팅 안건에 등록된 자료가 없습니다"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredMeetingResources.map((resource, i) => (
                      <div
                        key={i}
                        className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4 flex items-center gap-4 hover:border-nu-pink/40 transition-colors group"
                      >
                        <div className="w-10 h-10 bg-nu-pink/10 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-nu-pink" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-nu-ink truncate block no-underline hover:text-nu-pink">
                            {resource.name}
                          </a>
                          <p className="font-mono-nu text-[12px] text-nu-muted mt-0.5 truncate">
                            {resource.meetingTitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setPreviewData({ url: resource.url, name: resource.name })}
                            className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors"
                            title="미리보기"
                          >
                            <Eye size={14} />
                          </button>
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors">
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "wiki-resources" && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header info */}
                <div className="mb-4 p-3 bg-nu-blue/5 border border-nu-blue/20 flex items-start gap-2">
                  <Sparkles size={14} className="text-nu-blue mt-0.5 shrink-0" />
                  <p className="text-[12px] text-nu-graphite leading-relaxed">
                    AI 지식 통합 엔진이 탭(위키) 작성 중 참고한 자료들이 자동으로 아카이브됩니다.
                    <span className="font-bold text-nu-pink"> 사용됨</span> 표시가 있는 항목은 실제 탭 페이지에 반영된 자료입니다.
                  </p>
                </div>
                {wikiResources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.url || "").toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <div className="border-2 border-dashed border-nu-ink/10 p-12 text-center">
                    <BookOpen size={32} className="text-nu-blue/30 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm mb-1">탭에서 참고된 자료가 없습니다</p>
                    <p className="text-nu-muted text-xs">AI 지식 통합 엔진으로 탭 페이지를 작성하면 자료가 자동으로 여기에 추가됩니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wikiResources
                      .filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.url || "").toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((r) => {
                        const typeIcon = getWikiResourceTypeIcon(r.resource_type, r.url);
                        return (
                          <div key={r.id} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-blue/40 transition-all p-4 flex items-start gap-3 group">
                            <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-nu-blue/5 border border-nu-blue/10 text-base">
                              {typeIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                {r.url ? (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-nu-ink hover:text-nu-blue truncate no-underline transition-colors"
                                  >
                                    {r.title}
                                  </a>
                                ) : (
                                  <span className="text-sm font-medium text-nu-ink truncate">{r.title}</span>
                                )}
                                {/* 사용됨 badge */}
                                {r.linked_wiki_page_id && (
                                  <span className="inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20 shrink-0">
                                    <Check size={8} /> 사용됨
                                    {r.linked_page_title && (
                                      <span className="text-nu-pink/70"> · {r.linked_page_title}</span>
                                    )}
                                  </span>
                                )}
                                {/* Resource type badge */}
                                <span className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue/70 border border-nu-blue/10 shrink-0">
                                  {getWikiResourceTypeLabel(r.resource_type, r.url)}
                                </span>
                              </div>
                              {/* AI summary */}
                              {r.auto_summary && (
                                <p className="text-[11px] text-nu-muted line-clamp-2 mt-0.5 leading-relaxed">{r.auto_summary}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {r.contributor && (
                                  <span className="font-mono-nu text-[10px] text-nu-muted/60">by {r.contributor}</span>
                                )}
                                <span className="font-mono-nu text-[10px] text-nu-muted/40">{timeAgo(r.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {r.url && (
                                <>
                                  <button
                                    onClick={() => setPreviewData({ url: r.url, name: r.title })}
                                    className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors"
                                    title="미리보기"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors">
                                    <ExternalLink size={14} />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {isSplitView && (
          <div className="lg:flex-1 lg:sticky lg:top-8 w-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="bg-nu-paper border-2 border-nu-ink shadow-2xl flex flex-col h-[80vh] lg:h-[calc(100vh-80px)]">
              {/* 위키 페이지 콘텐츠 사이드패널 인라인 렌더링 */}
              {wikiPreviewPage ? (
                <WikiSidePanel
                  page={wikiPreviewPage}
                  groupId={groupId}
                  onClose={() => setWikiPreviewPage(null)}
                />
              ) : previewData ? (
                previewData.content ? (
                  /* ─── 인라인 문서 에디터 (template / wiki 노트 전용) ─── */
                  <ResourceEditor
                    targetType="file_attachment"
                    resourceId={previewData.id || ""}
                    name={previewData.name}
                    initialContent={previewData.content}
                    canEdit={!!userId}
                    onSave={(newContent) => {
                      setFiles((prev) => prev.map((f) => f.id === previewData.id ? { ...f, content: newContent } : f));
                      setPreviewData((prev) => prev ? { ...prev, content: newContent } : prev);
                    }}
                    onClose={() => setPreviewData(null)}
                  />
                ) : (
                  /* ─── 모든 파일 타입 통합 미리보기 (이미지·동영상·오디오·PDF·링크·기사) ─── */
                  <LinkPreviewPanel
                    url={previewData.url}
                    name={previewData.name}
                    mime={previewData.mime}
                    onClose={() => setPreviewData(null)}
                  />
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-nu-muted">
                  <div className="w-20 h-20 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-4">
                    <Eye size={32} className="opacity-20" />
                  </div>
                  <p className="font-head text-sm font-bold text-nu-ink/40 uppercase tracking-widest">Select a document to preview</p>
                  <p className="text-[13px] mt-2 max-w-[200px]">자료를 선택하면 이 사이드 패널에서 실시간으로 확인하면서 작업할 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* !isSplitView 상태에서 미리보기: 파일/PDF는 FilePreviewPanel, 템플릿은 에디터 모달, 나머지는 LinkPreviewPanel 모달 */}
      {!isSplitView && previewData && (
        isDirectPreviewable(previewData.url, previewData.storage_type) ? (
          <FilePreviewPanel
            open={!!previewData}
            onClose={() => setPreviewData(null)}
            file={{
              id: previewData.id || "",
              name: previewData.name,
              url: previewData.url,
              mime: previewData.mime,
              size: previewData.size,
              storage_type: previewData.storage_type,
              storage_key: previewData.storage_key,
            }}
            targetTable="file_attachments"
            canEdit={previewData.uploaded_by === userId || isManager || (hostId !== null && userId === hostId)}
            onUpdated={() => { loadData(); }}
          />
        ) : previewData.content ? (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-nu-white w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border-2 border-nu-ink">
              <ResourceEditor
                targetType="file_attachment"
                resourceId={previewData.id || ""}
                name={previewData.name}
                initialContent={previewData.content}
                canEdit={!!userId}
                onSave={(newContent) => {
                  setFiles((prev) => prev.map((f) => f.id === previewData.id ? { ...f, content: newContent } : f));
                  setPreviewData((prev) => prev ? { ...prev, content: newContent } : prev);
                }}
                onClose={() => setPreviewData(null)}
              />
            </div>
          </div>
        ) : (
          /* 외부 링크·기사 → 오버레이 패널로 미리보기 */
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPreviewData(null)}>
            <div
              className="bg-nu-white w-full sm:max-w-2xl h-[85vh] sm:h-[80vh] overflow-hidden flex flex-col border-2 border-nu-ink sm:shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <LinkPreviewPanel
                url={previewData.url}
                name={previewData.name}
                onClose={() => setPreviewData(null)}
              />
            </div>
          </div>
        )
      )}

      {/* New Document Modal */}
      {showNewDocModal && (
        <NewDocumentModal
          targetType="group"
          targetId={groupId}
          onCreated={loadData}
          onClose={() => setShowNewDocModal(false)}
        />
      )}

      {/* 위키 페이지: 사이드패널에서 직접 렌더링되므로 WikiPagePreviewPanel 오버레이 사용 안 함 */}
    </div>
  );
}

function InlineComments({
  resourceId,
  comments,
  commentInput,
  onInputChange,
  onPost,
  onDelete,
  posting,
  tags,
  userId,
  onToggleTag,
}: {
  resourceId: string;
  comments: ResourceComment[];
  commentInput: string;
  onInputChange: (val: string) => void;
  onPost: () => void;
  onDelete?: (commentId: string) => void;
  posting: boolean;
  tags: ResourceTag[];
  userId: string | null;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div className="px-4 pb-4 border-t border-nu-ink/[0.06] animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Tag buttons */}
      <div className="flex items-center gap-2 py-3 border-b border-nu-ink/[0.04]">
        <Tag size={12} className="text-nu-muted" />
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mr-1">리뷰:</span>
        {TAG_OPTIONS.map((opt) => {
          const count = tags.filter(t => t.tag === opt.label).length;
          const isActive = userId ? tags.some(t => t.tag === opt.label && t.user_id === userId) : false;
          return (
            <button
              key={opt.label}
              onClick={() => onToggleTag(opt.label)}
              className={`font-mono-nu text-[11px] font-bold px-2 py-1 border rounded-sm transition-all ${
                isActive ? opt.color + " ring-1 ring-offset-1" : "border-nu-ink/10 text-nu-muted hover:border-nu-ink/30"
              }`}
            >
              {opt.emoji} {opt.label} {count > 0 && <span className="ml-0.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>
      {/* Comments */}
      <div className="mt-3 space-y-2.5 max-h-[200px] overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-[13px] text-nu-muted/50 text-center py-2">아직 댓글이 없습니다</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className="w-6 h-6 bg-nu-cream rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold text-nu-muted">
              {c.author?.avatar_url ? (
                <img src={c.author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                (c.author?.nickname || "?")[0]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-nu text-[12px] font-bold text-nu-ink">{c.author?.nickname || "익명"}</span>
                <span className="font-mono-nu text-[11px] text-nu-muted/50">{timeAgo(c.created_at)}</span>
                {userId && c.user_id === userId && onDelete && (
                  <button
                    onClick={() => onDelete(c.id)}
                    className="font-mono-nu text-[11px] text-nu-muted/40 hover:text-nu-red transition-colors"
                    title="삭제"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[12px] text-nu-graphite leading-relaxed mt-0.5">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Comment input */}
      <div className="flex items-center gap-2 mt-3">
        <input
          value={commentInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onPost(); } }}
          placeholder="댓글을 입력하세요..."
          className="flex-1 h-8 text-[12px] bg-nu-cream/30 border border-nu-ink/10 px-3 focus:outline-none focus:border-nu-blue transition-colors"
        />
        <button
          onClick={onPost}
          disabled={posting || !commentInput.trim()}
          className="p-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-30"
        >
          {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}

function ResourceStatsPanel({ files }: { files: Array<FileAttachment & { drive_edit_file_id?: string | null; storage_type?: string | null; file_size?: number | null }> }) {
  const r2Bytes = files
    .filter((f) => (f as any).storage_type === "r2")
    .reduce((sum, f) => sum + ((f as any).file_size || 0), 0);
  const supabaseBytes = files
    .filter((f) => (f as any).storage_type === "supabase")
    .reduce((sum, f) => sum + ((f as any).file_size || 0), 0);
  const driveCopies = files.filter((f) => !!(f as any).drive_edit_file_id).length;
  const totalFiles = files.length;

  function fmt(b: number): string {
    if (!b) return "0 B";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (totalFiles === 0) return null;

  return (
    <div className="mb-4 px-4 py-3 bg-nu-cream/20 border-2 border-nu-ink/10 flex flex-wrap items-center gap-4 text-[12px]">
      <div className="flex items-center gap-1.5">
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">파일</span>
        <span className="font-bold text-nu-ink">{totalFiles}</span>
      </div>
      <span className="w-px h-4 bg-nu-ink/15" />
      <div className="flex items-center gap-1.5">
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">R2</span>
        <span className="font-bold text-nu-ink">{fmt(r2Bytes)}</span>
      </div>
      {supabaseBytes > 0 && (
        <>
          <span className="w-px h-4 bg-nu-ink/15" />
          <div className="flex items-center gap-1.5">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Supabase (legacy)</span>
            <span className="font-bold text-nu-ink">{fmt(supabaseBytes)}</span>
          </div>
        </>
      )}
      {driveCopies > 0 && (
        <>
          <span className="w-px h-4 bg-nu-ink/15" />
          <div className="flex items-center gap-1.5">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Drive 편집 사본</span>
            <span className="font-bold text-nu-pink">{driveCopies}</span>
          </div>
        </>
      )}
    </div>
  );
}

function FileCard({
  file, userId, hostId, isManager, onDelete, onRename, isDrive, isLink, onPreview, showAiSummary, aiSummary,
  onToggleComments, commentsExpanded, comments, commentInput, onCommentInputChange, onPostComment, onDeleteComment, postingComment,
  tags, onToggleTag, onAddToWiki, addingWiki, isWikiLinked,
  selectable, selected, onToggleSelect,
}: {
  file: FileAttachment & { uploader?: { nickname: string | null } };
  userId: string | null;
  hostId?: string | null;
  isManager?: boolean;
  onDelete: (id: string, url: string, type: string | null) => void;
  onRename?: (id: string, newName: string) => void;
  isDrive?: boolean;
  isLink?: boolean;
  onPreview: (url: string, name: string) => void;
  showAiSummary?: boolean;
  aiSummary?: string[];
  onToggleComments?: () => void;
  commentsExpanded?: boolean;
  comments?: ResourceComment[];
  commentInput?: string;
  onCommentInputChange?: (val: string) => void;
  onPostComment?: () => void;
  onDeleteComment?: (commentId: string) => void;
  postingComment?: boolean;
  tags?: ResourceTag[];
  onToggleTag?: (tag: string) => void;
  onAddToWiki?: () => void;
  addingWiki?: boolean;
  isWikiLinked?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [status, setStatus] = useState<"draft" | "review" | "asset">("draft");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(file.file_name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isOwner = file.uploaded_by === userId;
  const canManage = isOwner || isManager || (hostId != null && userId === hostId);
  
  const statusConfig = {
    draft: { label: "DRAFT", color: "bg-nu-muted/10 text-nu-muted border-nu-muted/20", icon: "✏️" },
    review: { label: "REVIEW", color: "bg-nu-amber/10 text-nu-amber border-nu-amber/30", icon: "👀" },
    asset: { label: "ASSET", color: "bg-nu-blue/10 text-nu-blue border-nu-blue/30", icon: "💎" },
  };
  const st = statusConfig[status];
  
  const fireConfetti = () => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
    document.body.appendChild(container);
    const colors = ["#FF2E97", "#2E6FFF", "#FFB800", "#0d0d0d", "#10B981"];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("div");
      const c = colors[Math.floor(Math.random() * colors.length)];
      const x = Math.random() * 100;
      const d = Math.random() * 2 + 1;
      const r = Math.random() * 360;
      p.style.cssText = `position:absolute;left:${x}%;top:-10px;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;background:${c};transform:rotate(${r}deg);animation:confetti-fall ${d}s ease-in forwards;animation-delay:${Math.random()*0.5}s;opacity:0.9;`;
      container.appendChild(p);
    }
    if (!document.getElementById("confetti-style")) {
      const s = document.createElement("style");
      s.id = "confetti-style";
      s.textContent = `@keyframes confetti-fall{0%{top:-10px;opacity:1;transform:rotate(0deg)translateX(0)}100%{top:110vh;opacity:0;transform:rotate(720deg)translateX(${Math.random()>0.5?'':'-'}80px)}}`;
      document.head.appendChild(s);
    }
    setTimeout(() => container.remove(), 3000);
  };

  const cycleStatus = () => {
    if (!isOwner) return;
    const next = { draft: "review" as const, review: "asset" as const, asset: "draft" as const };
    const newStatus = next[status];
    setStatus(newStatus);
    
    if (newStatus === "review") {
      toast.info("📋 문서가 Review 상태로 전환되었습니다. 동료들의 피드백을 받아보세요!");
    } else if (newStatus === "asset") {
      fireConfetti();
      toast.success("🎉 축하합니다! 이 자료가 공식 Asset으로 승격되었습니다. Professionalism 지수가 +5 상승합니다!", { duration: 5000 });
    } else {
      toast("✏️ Draft 상태로 되돌렸습니다.");
    }
  };

  // Detect resource age for "hot" badge
  const ageHours = (Date.now() - new Date(file.created_at).getTime()) / 3600000;
  const isNew = ageHours < 48;

  // ?focus=<id> 로 진입 시 해당 카드로 스크롤 + 2초간 핑크 하이라이트
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get("focus");
    if (focusId === file.id) {
      setTimeout(() => {
        document.getElementById(`resource-${file.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        setFocused(true);
        setTimeout(() => setFocused(false), 2400);
      }, 100);
    }
  }, [file.id]);

  return (
    <div
      id={`resource-${file.id}`}
      className={`group bg-nu-white border-2 border-nu-ink transition-all hover:bg-nu-cream/10 overflow-hidden ${
        focused ? "ring-4 ring-nu-pink ring-offset-2 animate-pulse" : ""
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {selectable && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.()}
            className="w-4 h-4 accent-nu-pink shrink-0"
            title="선택"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className={`w-12 h-12 flex items-center justify-center shrink-0 border-2 border-nu-ink/5 ${isDrive ? "bg-green-50" : isLink ? "bg-nu-blue/5" : "bg-nu-cream/50"}`}>
          {isDrive ? <HardDrive size={20} className="text-green-600" /> : isLink ? getFileIcon(file.file_type, file.file_url) : getFileIcon(file.file_type, file.file_url)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {isEditing ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = editName.trim();
                      if (trimmed && trimmed !== file.file_name && onRename) {
                        onRename(file.id, trimmed);
                      }
                      setIsEditing(false);
                    }
                    if (e.key === "Escape") { setEditName(file.file_name); setIsEditing(false); }
                  }}
                  autoFocus
                  className="flex-1 h-7 text-[13px] font-black text-nu-ink uppercase tracking-tight bg-nu-cream/30 border-2 border-nu-pink px-2 outline-none font-mono-nu"
                />
                <button
                  onClick={() => {
                    const trimmed = editName.trim();
                    if (trimmed && trimmed !== file.file_name && onRename) {
                      onRename(file.id, trimmed);
                    }
                    setIsEditing(false);
                  }}
                  className="p-1 text-green-600 hover:bg-green-50 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setEditName(file.file_name); setIsEditing(false); }}
                  className="p-1 text-nu-muted hover:text-nu-ink transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                {resolveTemplateContent(file.file_url, file.content) ? (
                  <button
                    onClick={() => onPreview(file.file_url, file.file_name)}
                    className="text-[13px] font-black text-nu-ink truncate hover:text-nu-pink transition-colors uppercase tracking-tight text-left bg-transparent border-none cursor-pointer p-0"
                  >
                    {file.file_name}
                  </button>
                ) : (
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-black text-nu-ink truncate hover:text-nu-pink transition-colors no-underline uppercase tracking-tight"
                  >
                    {file.file_name}
                  </a>
                )}
              </>
            )}
            {!isEditing && getDocTypeLabel(file.file_type) && (
              <span className="shrink-0 font-mono-nu text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-nu-ink/5 text-nu-graphite border border-nu-ink/10">
                {getDocTypeLabel(file.file_type)}
              </span>
            )}
            {!isEditing && resolveTemplateContent(file.file_url, file.content) && (
              <span className="shrink-0 font-mono-nu text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue border border-nu-blue/20">편집</span>
            )}
            {!isEditing && isNew && (
              <span className="shrink-0 font-mono-nu text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink text-white animate-pulse">
                NEW
              </span>
            )}
            {!isEditing && isWikiLinked && (
              <span className="inline-flex items-center gap-0.5 shrink-0 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20">
                <Check size={8} /> 탭에서 사용됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {/* Status Badge */}
            <button
              onClick={cycleStatus}
              className={`inline-flex items-center gap-1 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm transition-all ${st.color} ${isOwner ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
              title={isOwner ? "클릭하여 상태 변경" : ""}
            >
              <span>{st.icon}</span> {st.label}
            </button>
            <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">{(file as any).uploader?.nickname || "MEMBER"}</span>
            <span className="w-1 h-1 bg-nu-ink/10 rounded-full" />
            <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">{new Date(file.created_at).toLocaleDateString("ko")}</span>
            <DriveSyncBadge
              driveFileId={(file as any).drive_edit_file_id}
              syncedAt={(file as any).drive_edit_synced_at}
              ownerUserId={(file as any).drive_edit_user_id}
              currentUserId={userId}
            />
            <FileAiSummary
              table="file_attachments"
              fileId={file.id}
              initial={(file as any).ai_summary || null}
              fileExt={(file.file_name || "").split(".").pop()}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Primary: 미리보기 button — prominent for discoverability */}
          <button
            onClick={() => onPreview(file.file_url, file.file_name)}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink transition-all flex items-center gap-1.5"
            title="미리보기"
          >
            👁️ 미리보기
          </button>
          {onToggleComments && (
            <button
              onClick={onToggleComments}
              className={`p-2 transition-colors bg-nu-paper border border-nu-ink/10 ${commentsExpanded ? "text-nu-blue" : "text-nu-muted hover:text-nu-blue"}`}
              title="댓글"
            >
              <MessageCircle size={16} />
            </button>
          )}
          {onAddToWiki && (
            <button
              onClick={onAddToWiki}
              disabled={addingWiki}
              className="p-2 text-nu-muted hover:text-nu-pink transition-colors bg-nu-paper border border-nu-ink/10 disabled:opacity-40"
              title="탭 리소스에 추가"
            >
              {addingWiki ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
            </button>
          )}
          {!resolveTemplateContent(file.file_url, file.content) && (
            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-nu-muted hover:text-nu-blue transition-colors bg-nu-paper border border-nu-ink/10">
              <ExternalLink size={16} />
            </a>
          )}
          {canManage && (
            <button
              onClick={() => { setEditName(file.file_name); setIsEditing(true); }}
              className="p-2 text-nu-muted hover:text-nu-blue transition-colors bg-nu-paper border border-nu-ink/10"
              title="이름 수정"
            >
              <Pencil size={16} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-nu-muted/40 hover:text-red-500 hover:bg-red-50 transition-colors bg-nu-paper border border-nu-ink/10"
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 pb-3 border-t-2 border-red-200 bg-red-50/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between py-2.5">
            <p className="font-mono-nu text-[13px] text-red-600 font-bold">
              이 자료를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/10 text-nu-muted hover:border-nu-ink transition-all"
              >
                취소
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete(file.id, file.file_url, file.file_type); }}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-1.5 bg-red-500 text-white border-[2px] border-red-500 hover:bg-red-600 hover:border-red-600 transition-all"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag badges row */}
      {tags && tags.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
          {Array.from(new Set(tags.map(t => t.tag))).map((tag) => {
            const opt = TAG_OPTIONS.find(o => o.label === tag);
            const count = tags.filter(t => t.tag === tag).length;
            return opt ? (
              <span key={tag} className={`font-mono-nu text-[10px] font-bold px-1.5 py-0.5 border rounded-sm ${opt.color}`}>
                {opt.emoji} {opt.label} ({count})
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* AI Summary Section */}
      {showAiSummary && aiSummary && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-500">
           <div className="bg-nu-ink text-nu-paper p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12">
                 <Sparkles size={48} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                 <Sparkles size={12} className="text-nu-pink" />
                 <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.2em] text-nu-pink">AI_Insight_Summary</span>
              </div>
              <ul className="space-y-1.5">
                 {aiSummary.map((line, i) => (
                   <li key={i} className="text-[13px] font-medium leading-relaxed opacity-90 flex items-start gap-2">
                     <span className="text-nu-pink mt-1">∙</span> {line}
                   </li>
                 ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-nu-paper/10 flex items-center justify-between">
                 <span className="font-mono-nu text-[10px] text-nu-paper/30 uppercase tracking-widest">Model: Gemini-1.5-Pro</span>
                 <button className="text-[10px] font-black uppercase tracking-widest text-nu-blue hover:text-nu-paper transition-colors">자세히 보기 →</button>
              </div>
           </div>
        </div>
      )}
      {/* Like & Comment interactions */}
      <div className="px-4 pb-3 border-t border-nu-ink/[0.04]">
        <ResourceInteractions targetType="file_attachment" targetId={file.id} compact />
      </div>

      {/* Expandable comments & tags */}
      {commentsExpanded && onCommentInputChange && onPostComment && onToggleTag && (
        <InlineComments
          resourceId={file.id}
          comments={comments || []}
          commentInput={commentInput || ""}
          onInputChange={onCommentInputChange}
          onPost={onPostComment}
          onDelete={onDeleteComment}
          posting={!!postingComment}
          tags={tags || []}
          userId={userId}
          onToggleTag={onToggleTag}
        />
      )}
    </div>
  );
}
function getWikiResourceTypeIcon(resourceType: string, url: string): string {
  if (url?.includes("youtube.com") || url?.includes("youtu.be")) return "▶";
  if (url?.includes("notion.so")) return "N";
  if (url?.includes("github.com")) return "⌥";
  if (url?.includes("figma.com")) return "◈";
  if (resourceType === "video") return "▶";
  if (resourceType === "notion") return "N";
  if (resourceType === "article") return "✦";
  if (resourceType === "blog") return "✐";
  if (resourceType === "pdf") return "P";
  return "⊕";
}

function getWikiResourceTypeLabel(resourceType: string, url: string): string {
  if (url?.includes("youtube.com") || url?.includes("youtu.be")) return "YouTube";
  if (url?.includes("notion.so")) return "Notion";
  if (url?.includes("github.com")) return "GitHub";
  if (url?.includes("figma.com")) return "Figma";
  if (resourceType === "video") return "동영상";
  if (resourceType === "article") return "아티클";
  if (resourceType === "blog") return "블로그";
  if (resourceType === "pdf") return "PDF";
  if (resourceType === "link") return "링크";
  return resourceType || "링크";
}

// 미리보기 패널(FilePreviewPanel) 로 바로 랜더 가능한 URL 인지 판정.
// 과거 storage_type === 'r2' 게이트는 마이그레이션 이전 파일(null/supabase) 을 전부
// 미리보기 불가 상태로 만들었기 때문에, public URL 이기만 하면 모두 허용한다.
// Google Drive / Docs / Notion / Sheets 는 iframe embed 로 별도 처리.
function isDirectPreviewable(url?: string | null, storageType?: string | null): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.includes("docs.google.com")) return false;
  if (u.includes("drive.google.com")) return false;
  if (u.includes("notion.so") || u.includes("notion.site")) return false;
  if (u.includes("sheets.google.com")) return false;
  // r2 / supabase storage / 기타 직접 다운로드 가능한 public URL 은 모두 OK
  if (storageType === "r2" || storageType === "supabase") return true;
  // storage_type 이 null 이어도 R2/Supabase public URL 패턴이면 허용
  if (u.includes(".r2.dev") || u.includes(".r2.cloudflarestorage.com")) return true;
  if (u.includes("/storage/v1/object/")) return true;
  if (u.includes("supabase.co/storage")) return true;
  // URL 에 확장자가 포함된 http(s) 파일이면 허용 (보수적)
  if (/^https?:\/\/.+\.(pdf|png|jpe?g|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg|txt|md|csv|json|docx?|xlsx?|pptx?)(\?|#|$)/i.test(url)) return true;
  return false;
}

function getEmbedUrl(url: string | null) {
  if (!url) return "";
  if (url.includes("notion.so")) {
    try {
      const notionUrl = new URL(url);
      if (!notionUrl.searchParams.has("pvs")) notionUrl.searchParams.set("pvs", "4");
      return notionUrl.toString();
    } catch { return url; }
  }
  if (url.includes("docs.google.com")) {
    if (url.includes("/edit")) return url.replace("/edit", "/preview");
    if (url.includes("/view")) return url.replace("/view", "/preview");
    return url;
  }
  if (url.includes("drive.google.com/file/d/")) {
    return url.replace(/\/view.*$/, "/preview");
  }
  if (url.includes("drive.google.com/drive/folders/")) {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/embeddedfolderview?id=${match[1]}#grid`;
    }
  }
  return url;
}

function ResourcePreviewHint() {
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("nu:hint:resources-preview");
    setDismissed(stored === "1");
    setLoaded(true);
  }, []);
  if (!loaded || dismissed) return null;
  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-nu-blue/5 border-[2px] border-nu-blue/30">
      <span className="text-lg">💡</span>
      <p className="flex-1 text-sm text-nu-ink">
        <span className="font-bold">파일을 클릭하면 미리보기와 편집이 가능합니다.</span>
        <span className="text-nu-muted ml-2">각 자료 행의 <span className="font-mono-nu text-[12px] font-bold">👁️ 미리보기</span> 버튼으로도 열 수 있습니다.</span>
      </p>
      <button
        onClick={() => {
          try { window.localStorage.setItem("nu:hint:resources-preview", "1"); } catch {}
          setDismissed(true);
        }}
        className="p-1.5 text-nu-muted hover:text-nu-ink"
        title="닫기"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ── WikiSidePanel: 사이드패널 안에서 위키 페이지 인라인 표시 ───────────────── */
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false, loading: () => <span className="text-xs text-nu-muted">불러오는 중…</span> });

function WikiSidePanel({
  page,
  groupId,
  onClose,
}: {
  page: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    topic_name?: string | null;
    author_nickname?: string | null;
    google_doc_url?: string | null;
  };
  groupId: string;
  onClose: () => void;
}) {
  const editHref = `/groups/${groupId}/wiki/pages/${page.id}`;
  const updatedLabel = (() => {
    try { return new Date(page.updated_at).toLocaleString("ko"); } catch { return page.updated_at; }
  })();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 border-b-2 border-nu-ink bg-nu-cream/30 shrink-0 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 bg-nu-pink/10 border border-nu-pink/20 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={14} className="text-nu-pink" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/20">탭 페이지</span>
              {page.topic_name && (
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{page.topic_name}</span>
              )}
            </div>
            <h3 className="font-head text-[14px] font-bold text-nu-ink leading-snug break-words">{page.title}</h3>
            <div className="flex items-center gap-2 mt-0.5 font-mono-nu text-[10px] text-nu-muted">
              {page.author_nickname && <span>by {page.author_nickname}</span>}
              <span className="text-nu-muted/60">{updatedLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 px-2 py-1 border-2 border-nu-ink bg-nu-white hover:bg-nu-ink hover:text-nu-paper transition-colors font-mono-nu text-[10px] uppercase tracking-widest no-underline text-nu-ink"
            title="편집 페이지로 이동"
          >
            <ExternalLink size={11} /> 편집
          </Link>
          <button onClick={onClose} className="p-1.5 text-nu-muted hover:text-nu-ink transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {page.google_doc_url && (
          <a
            href={page.google_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1.5 border-2 border-green-600/30 bg-green-50 text-green-700 font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-green-600 hover:text-white transition-colors"
          >
            <ExternalLink size={11} /> Google Docs 원본
          </a>
        )}
        {page.content ? (
          <article className="prose prose-sm max-w-none text-nu-ink prose-headings:font-head prose-headings:text-nu-ink prose-a:text-nu-pink prose-strong:text-nu-ink prose-code:text-nu-pink prose-code:bg-nu-pink/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-none prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-nu-ink prose-pre:text-nu-paper">
            <ReactMarkdown>{page.content}</ReactMarkdown>
          </article>
        ) : (
          <p className="font-mono-nu text-[12px] text-nu-muted">(내용이 비어 있는 페이지입니다)</p>
        )}
      </div>

      {/* 푸터 */}
      <div className="border-t-2 border-nu-ink px-4 py-2.5 bg-nu-cream/50 flex items-center justify-between shrink-0">
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Read-only preview</span>
        <Link
          href={editHref}
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline no-underline"
        >
          페이지로 이동 →
        </Link>
      </div>
    </div>
  );
}

