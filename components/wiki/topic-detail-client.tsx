"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Edit3, GitBranch, FileText,
  BookOpen, Trash2, ChevronRight, Settings,
  Loader2, Save, X, AlertTriangle, Globe, Lock, Copy, ExternalLink
} from "lucide-react";
import { WikiPageEditor } from "@/components/wiki/wiki-page-editor";

interface WikiPage {
  id: string;
  title: string;
  content: string;
  version: number;
  updated_at: string;
  created_at: string;
  last_updated_by: string;
  created_by: string;
  updater?: { nickname: string };
  author?: { nickname: string };
}

interface TopicDetailClientProps {
  groupId: string;
  topicId: string;
  topicName: string;
  topicDescription: string;
  initialPages: WikiPage[];
  isHost: boolean;
  isPublic?: boolean;
  publicSlug?: string | null;
}

export function TopicDetailClient({
  groupId,
  topicId,
  topicName,
  topicDescription,
  initialPages,
  isHost,
  isPublic: initialIsPublic = false,
  publicSlug: initialSlug = null,
}: TopicDetailClientProps) {
  const router = useRouter();
  const [pages, setPages] = useState<WikiPage[]>(initialPages);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "alpha" | "version">("newest");

  // Publish state
  const [isPublished, setIsPublished] = useState(initialIsPublic);
  const [publishSlug, setPublishSlug] = useState<string | null>(initialSlug);
  const [publishing, setPublishing] = useState(false);

  // Topic editing
  const [editingTopic, setEditingTopic] = useState(false);
  const [editName, setEditName] = useState(topicName);
  const [editDesc, setEditDesc] = useState(topicDescription);
  const [savingTopic, setSavingTopic] = useState(false);

  // Delete confirmations
  const [deletingTopicConfirm, setDeletingTopicConfirm] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

  const filteredPages = pages
    .filter(p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.content || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      if (sortBy === "version") return b.version - a.version;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // ── Topic CRUD ──
  const handleUpdateTopic = async () => {
    if (!editName.trim()) { toast.error("주제 이름을 입력해주세요"); return; }
    setSavingTopic(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("wiki_topics")
        .update({ name: editName.trim(), description: editDesc.trim() || null })
        .eq("id", topicId);
      if (error) throw error;
      toast.success("주제가 수정되었습니다");
      setEditingTopic(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "수정 실패");
    } finally {
      setSavingTopic(false);
    }
  };

  const handleDeleteTopic = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("wiki_topics")
        .delete()
        .eq("id", topicId);
      if (error) throw error;
      toast.success("주제가 삭제되었습니다");
      router.push(`/groups/${groupId}/wiki`);
    } catch (err: any) {
      toast.error(err.message || "삭제 실패");
    }
  };

  // ── Page CRUD ──
  const handleDeletePage = async (pageId: string) => {
    try {
      const supabase = createClient();
      // Delete contributions first (cascading should handle this, but be safe)
      await supabase.from("wiki_contributions").delete().eq("page_id", pageId);
      await supabase.from("wiki_page_versions").delete().eq("page_id", pageId);

      const { error } = await supabase.from("wiki_pages").delete().eq("id", pageId);
      if (error) throw error;
      setPages(prev => prev.filter(p => p.id !== pageId));
      setDeletingPageId(null);
      toast.success("문서가 삭제되었습니다");
    } catch (err: any) {
      toast.error(err.message || "삭제 실패");
    }
  };

  // ── Publish/Unpublish ──
  const handleTogglePublish = async () => {
    setPublishing(true);
    try {
      if (isPublished) {
        const res = await fetch("/api/wiki/publish", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        setIsPublished(false);
        setPublishSlug(null);
        toast.success("탭이 비공개로 전환되었습니다");
      } else {
        const res = await fetch("/api/wiki/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        const data = await res.json();
        setIsPublished(true);
        setPublishSlug(data.slug);
        toast.success("탭이 공개되었습니다!");
      }
    } catch (e: any) {
      toast.error(e.message || "공개 설정 실패");
    } finally {
      setPublishing(false);
    }
  };

  const copyPublicUrl = () => {
    if (!publishSlug) return;
    const url = `${window.location.origin}/wiki/${publishSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("공개 URL이 복사되었습니다");
  };

  const handlePageCreated = () => {
    setShowEditor(false);
    router.refresh();
    // Also reload pages client-side
    reloadPages();
  };

  const reloadPages = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wiki_pages")
      .select(`
        id, title, content, version, updated_at, created_at,
        last_updated_by, created_by,
        updater:profiles!wiki_pages_last_updated_by_fkey(nickname),
        author:profiles!wiki_pages_created_by_fkey(nickname)
      `)
      .eq("topic_id", topicId)
      .order("updated_at", { ascending: false });
    if (data) setPages(data as any);
  };

  return (
    <div className="space-y-8">
      {/* Topic Settings (host only) */}
      {isHost && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditingTopic(!editingTopic)}
            className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink flex items-center gap-1 uppercase tracking-widest transition-colors"
          >
            <Settings size={12} /> 주제 관리
          </button>
          <button
            onClick={handleTogglePublish}
            disabled={publishing}
            className={`font-mono-nu text-[10px] flex items-center gap-1 uppercase tracking-widest transition-colors ${
              isPublished ? "text-green-600 hover:text-nu-ink" : "text-nu-muted hover:text-nu-blue"
            }`}
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : isPublished ? <Globe size={12} /> : <Lock size={12} />}
            {isPublished ? "공개 중" : "공개하기"}
          </button>
          {isPublished && publishSlug && (
            <>
              <button
                onClick={copyPublicUrl}
                className="font-mono-nu text-[10px] text-nu-blue hover:text-nu-pink flex items-center gap-1 uppercase tracking-widest transition-colors"
              >
                <Copy size={12} /> URL 복사
              </button>
              <a
                href={`/wiki/${publishSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono-nu text-[10px] text-nu-blue hover:text-nu-pink flex items-center gap-1 uppercase tracking-widest transition-colors no-underline"
              >
                <ExternalLink size={12} /> 공개 페이지
              </a>
            </>
          )}
          <button
            onClick={() => setDeletingTopicConfirm(true)}
            className="font-mono-nu text-[10px] text-red-400 hover:text-red-600 flex items-center gap-1 uppercase tracking-widest transition-colors"
          >
            <Trash2 size={12} /> 주제 삭제
          </button>
        </div>
      )}

      {/* Topic Edit Form */}
      {editingTopic && (
        <div className="bg-white border-[2px] border-nu-ink p-6 animate-in slide-in-from-top-2">
          <h3 className="font-head text-lg font-bold text-nu-ink mb-4 flex items-center gap-2">
            <Edit3 size={18} /> 주제 수정
          </h3>
          <div className="space-y-3">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full border-[2px] border-nu-ink px-4 py-3 font-head text-base font-bold focus:outline-none focus:border-nu-pink transition-colors"
              placeholder="주제 이름"
            />
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              className="w-full border-[2px] border-nu-ink/20 px-4 py-3 text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
              placeholder="설명"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingTopic(false)} className="px-4 py-2 border border-nu-ink/20 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-cream transition-colors">
                취소
              </button>
              <button
                onClick={handleUpdateTopic}
                disabled={savingTopic}
                className="px-5 py-2 bg-nu-ink text-white font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-nu-pink transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {savingTopic ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Delete Confirmation */}
      {deletingTopicConfirm && (
        <div className="bg-red-50 border-[2px] border-red-400 p-6 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-head text-base font-bold text-red-600 mb-1">주제 삭제 확인</h4>
              <p className="text-sm text-red-500 mb-4">
                이 주제와 하위 모든 문서({pages.length}개)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeletingTopicConfirm(false)} className="px-4 py-2 border border-red-300 text-red-500 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors">
                  취소
                </button>
                <button
                  onClick={handleDeleteTopic}
                  className="px-5 py-2 bg-red-500 text-white font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-1"
                >
                  <Trash2 size={12} /> 영구 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="페이지 검색..."
            className="w-full bg-white border-[2px] border-nu-ink pl-9 pr-4 py-2.5 font-mono-nu text-xs focus:outline-none focus:border-nu-pink transition-all"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
        </div>
        <div className="flex items-center gap-1 bg-white border-[2px] border-nu-ink/15 p-1">
          {(["newest", "alpha", "version"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 font-mono-nu text-[9px] font-bold uppercase tracking-widest transition-all ${
                sortBy === s ? "bg-nu-ink text-white" : "text-nu-muted hover:text-nu-ink"
              }`}
            >
              {s === "newest" ? "최신순" : s === "alpha" ? "이름순" : "v높은순"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="bg-nu-ink text-white px-5 py-2.5 font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-nu-pink transition-all flex items-center gap-2 shrink-0"
        >
          {showEditor ? <X size={14} /> : <Plus size={14} />}
          {showEditor ? "닫기" : "새 문서"}
        </button>
      </div>

      {/* Editor Panel */}
      {showEditor && (
        <div className="bg-white border-[2px] border-nu-ink p-8 animate-in slide-in-from-top-3">
          <WikiPageEditor
            topicId={topicId}
            groupId={groupId}
            mode="create"
            onSave={handlePageCreated}
          />
        </div>
      )}

      {/* Page List */}
      <div className="space-y-3">
        {filteredPages.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/15 p-16 text-center bg-white/50">
            <FileText size={40} className="mx-auto mb-4 text-nu-ink/15" />
            <p className="text-nu-muted text-sm font-medium mb-2">
              {searchQuery ? `"${searchQuery}"에 대한 검색 결과가 없습니다` : "이 주제에 등록된 문서가 없습니다"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowEditor(true)}
                className="font-mono-nu text-[10px] text-nu-pink font-bold uppercase hover:underline mt-2"
              >
                첫 번째 문서 작성하기
              </button>
            )}
          </div>
        ) : (
          filteredPages.map(page => (
            <div key={page.id} className="group relative">
              <Link
                href={`/groups/${groupId}/wiki/pages/${page.id}`}
                className="block bg-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all p-6 no-underline"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-nu-cream flex items-center justify-center shrink-0 group-hover:bg-nu-pink/10 transition-colors">
                    <BookOpen size={20} className="text-nu-ink/30 group-hover:text-nu-pink transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-head text-base font-bold text-nu-ink group-hover:text-nu-pink transition-colors mb-1">
                      {page.title}
                    </h3>
                    <p className="text-xs text-nu-muted line-clamp-2 leading-relaxed mb-2">
                      {(page.content || "").replace(/[#*`\-\[\]]/g, "").slice(0, 160)}
                    </p>
                    <div className="flex items-center gap-4 font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
                      <span className="flex items-center gap-1">
                        <GitBranch size={10} /> v{page.version}
                      </span>
                      <span>by {page.updater?.nickname || "Unknown"}</span>
                      <span>{new Date(page.updated_at).toLocaleDateString("ko")}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-nu-ink/20 group-hover:text-nu-pink group-hover:translate-x-1 transition-all shrink-0 mt-2" />
                </div>
              </Link>

              {/* Delete button (host/admin) */}
              {isHost && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {deletingPageId === page.id ? (
                    <div className="flex items-center gap-1 bg-white border border-red-300 p-1">
                      <button
                        onClick={(e) => { e.preventDefault(); handleDeletePage(page.id); }}
                        className="px-2 py-1 bg-red-500 text-white font-mono-nu text-[8px] font-bold uppercase hover:bg-red-600 transition-colors"
                      >
                        삭제
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); setDeletingPageId(null); }}
                        className="px-2 py-1 text-nu-muted font-mono-nu text-[8px] uppercase hover:text-nu-ink"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); setDeletingPageId(page.id); }}
                      className="p-1.5 bg-white border border-nu-ink/10 text-nu-muted hover:text-red-500 hover:border-red-300 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
