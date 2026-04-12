"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Edit3, History, Users, GitBranch, Clock,
  ThumbsUp, Eye, ChevronDown, ChevronUp,
  Sparkles, Tag, ArrowLeft, BookOpen, Loader2, Trash2,
  Link2, Plus, Search, X, List, FileText, ArrowUpDown
} from "lucide-react";
import { WikiPageEditor } from "@/components/wiki/wiki-page-editor";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";

interface WikiPageViewerProps {
  page: {
    id: string;
    title: string;
    content: string;
    version: number;
    updated_at: string;
    created_at: string;
    topic_id: string;
    topic?: { id: string; name: string };
    updater?: { nickname: string };
    author?: { nickname: string };
  };
  groupId: string;
  versions: any[];
  contributions: any[];
}

const REACTIONS = ["👍", "🔥", "💡", "🎯", "📌"];

export function WikiPageViewer({ page, groupId, versions, contributions }: WikiPageViewerProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showContribs, setShowContribs] = useState(false);
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [loadingReaction, setLoadingReaction] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [pageTags, setPageTags] = useState<{ name: string; color: string }[]>([]);
  const [linkedPages, setLinkedPages] = useState<{ id: string; title: string; direction: 'outgoing' | 'incoming' }[]>([]);
  const [showLinkCreator, setShowLinkCreator] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<{ id: string; title: string }[]>([]);
  const [searchingLinks, setSearchingLinks] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [diffVersion, setDiffVersion] = useState<{ version: number; content: string; title: string } | null>(null);
  const linkSearchTimer = useRef<NodeJS.Timeout | null>(null);

  // Reading time (Korean ~500 chars/min, English ~200 words/min)
  const readingStats = useMemo(() => {
    const text = page.content || "";
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(charCount / 500));
    return { charCount, wordCount, readingMinutes };
  }, [page.content]);

  // Extract headings for TOC
  const tocItems = useMemo(() => {
    const lines = (page.content || "").split("\n");
    return lines
      .filter(l => /^#{1,3} /.test(l))
      .map((l, i) => {
        const level = l.match(/^(#+)/)?.[1].length || 1;
        const text = l.replace(/^#{1,3} /, "");
        const id = `toc-${i}`;
        return { level, text, id };
      });
  }, [page.content]);

  // Debounced link search
  const handleLinkSearch = useCallback((q: string) => {
    setLinkSearch(q);
    if (linkSearchTimer.current) clearTimeout(linkSearchTimer.current);
    if (!q.trim()) { setLinkSearchResults([]); return; }
    setSearchingLinks(true);
    linkSearchTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const { data: topics } = await supabase.from("wiki_topics").select("id").eq("group_id", groupId);
      const topicIds = (topics || []).map(t => t.id);
      if (topicIds.length > 0) {
        const { data: results } = await supabase
          .from("wiki_pages")
          .select("id, title")
          .in("topic_id", topicIds)
          .neq("id", page.id)
          .ilike("title", `%${q}%`)
          .limit(6);
        setLinkSearchResults((results || []).filter(r => !linkedPages.some(l => l.id === r.id)));
      }
      setSearchingLinks(false);
    }, 300);
  }, [groupId, page.id, linkedPages]);

  // Load existing reactions from DB
  useEffect(() => {
    async function loadReactions() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Get all reaction counts
      const { data: allReactions } = await supabase
        .from("wiki_page_reactions")
        .select("reaction, user_id")
        .eq("page_id", page.id);

      const counts: Record<string, number> = {};
      const userReactions = new Set<string>();
      (allReactions || []).forEach(r => {
        counts[r.reaction] = (counts[r.reaction] || 0) + 1;
        if (user && r.user_id === user.id) {
          userReactions.add(r.reaction);
        }
      });
      setReactionCounts(counts);
      setActiveReactions(userReactions);

      // Get view count
      const { count } = await supabase
        .from("wiki_page_views")
        .select("id", { count: "exact", head: true })
        .eq("page_id", page.id);
      setViewCount(count || 0);

      // Load tags
      const { data: tagData } = await supabase
        .from("wiki_page_tags")
        .select("tag:wiki_tags(name, color)")
        .eq("page_id", page.id);
      setPageTags((tagData || []).map((t: any) => t.tag).filter(Boolean));

      // Load linked pages
      const { data: outLinks } = await supabase
        .from("wiki_page_links")
        .select("target_page_id, target:wiki_pages!wiki_page_links_target_page_id_fkey(id, title)")
        .eq("source_page_id", page.id);
      const { data: inLinks } = await supabase
        .from("wiki_page_links")
        .select("source_page_id, source:wiki_pages!wiki_page_links_source_page_id_fkey(id, title)")
        .eq("target_page_id", page.id);
      
      const links: { id: string; title: string; direction: 'outgoing' | 'incoming' }[] = [];
      (outLinks || []).forEach((l: any) => { if (l.target) links.push({ id: l.target.id, title: l.target.title, direction: 'outgoing' }); });
      (inLinks || []).forEach((l: any) => { if (l.source) links.push({ id: l.source.id, title: l.source.title, direction: 'incoming' }); });
      setLinkedPages(links);
    }
    loadReactions();
  }, [page.id]);

  const toggleReaction = async (r: string) => {
    setLoadingReaction(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("로그인이 필요합니다"); return; }

      if (activeReactions.has(r)) {
        // Remove reaction
        await supabase
          .from("wiki_page_reactions")
          .delete()
          .eq("page_id", page.id)
          .eq("user_id", user.id)
          .eq("reaction", r);

        const next = new Set(activeReactions);
        next.delete(r);
        setActiveReactions(next);
        setReactionCounts(prev => ({ ...prev, [r]: Math.max((prev[r] || 1) - 1, 0) }));
      } else {
        // Add reaction
        await supabase
          .from("wiki_page_reactions")
          .upsert({ page_id: page.id, user_id: user.id, reaction: r });

        const next = new Set(activeReactions);
        next.add(r);
        setActiveReactions(next);
        setReactionCounts(prev => ({ ...prev, [r]: (prev[r] || 0) + 1 }));
      }
    } catch (err: any) {
      toast.error("리액션 저장 실패");
    } finally {
      setLoadingReaction(false);
    }
  };

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const renderMarkdown = (md: string) => {
    return escapeHtml(md)
      .replace(/### (.+)/g, '<h3 class="font-head text-base font-bold mt-5 mb-2 text-nu-ink">$1</h3>')
      .replace(/## (.+)/g, '<h2 class="font-head text-lg font-extrabold mt-7 mb-3 text-nu-ink border-b border-nu-ink/10 pb-2">$1</h2>')
      .replace(/# (.+)/g, '<h1 class="font-head text-2xl font-extrabold mt-8 mb-4 text-nu-ink">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-nu-ink">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-nu-cream/50 px-1.5 py-0.5 text-nu-pink font-mono-nu text-xs border border-nu-ink/10 rounded">$1</code>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm text-nu-graphite leading-relaxed">$1</li>')
      .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal text-sm text-nu-graphite leading-relaxed">$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-nu-blue hover:text-nu-pink underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '<div class="h-3"></div>')
      .replace(/\n/g, '<br/>');
  };

  // Render markdown with TOC anchor IDs on headings
  const renderMarkdownWithIds = (md: string) => {
    let headingIndex = 0;
    return escapeHtml(md)
      .replace(/### (.+)/g, (_m, p1) => { const id = `toc-${headingIndex++}`; return `<h3 id="${id}" class="font-head text-base font-bold mt-5 mb-2 text-nu-ink scroll-mt-20">${p1}</h3>`; })
      .replace(/## (.+)/g, (_m, p1) => { const id = `toc-${headingIndex++}`; return `<h2 id="${id}" class="font-head text-lg font-extrabold mt-7 mb-3 text-nu-ink border-b border-nu-ink/10 pb-2 scroll-mt-20">${p1}</h2>`; })
      .replace(/# (.+)/g, (_m, p1) => { const id = `toc-${headingIndex++}`; return `<h1 id="${id}" class="font-head text-2xl font-extrabold mt-8 mb-4 text-nu-ink scroll-mt-20">${p1}</h1>`; })
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-nu-ink">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-nu-cream/50 px-1.5 py-0.5 text-nu-pink font-mono-nu text-xs border border-nu-ink/10 rounded">$1</code>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm text-nu-graphite leading-relaxed">$1</li>')
      .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal text-sm text-nu-graphite leading-relaxed">$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-nu-blue hover:text-nu-pink underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '<div class="h-3"></div>')
      .replace(/\n/g, '<br/>');
  };

  if (isEditing) {
    return (
      <div>
        <button
          onClick={() => setIsEditing(false)}
          className="mb-6 font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink flex items-center gap-1 uppercase tracking-widest"
        >
          <ArrowLeft size={12} /> 취소
        </button>
        <WikiPageEditor
          pageId={page.id}
          topicId={page.topic_id}
          groupId={groupId}
          initialTitle={page.title}
          initialContent={page.content || ""}
          mode="edit"
          onSave={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <article className="space-y-6">
      {/* Title & Meta */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight mb-3">
            {page.title}
          </h1>
          <div className="flex items-center gap-4 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest flex-wrap">
            <span className="flex items-center gap-1">
              <GitBranch size={12} /> v{page.version}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {page.updater?.nickname || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {new Date(page.updated_at).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} /> {viewCount} views
            </span>
            <span className="flex items-center gap-1">
              <FileText size={12} /> {readingStats.readingMinutes}분 읽기 · {readingStats.charCount.toLocaleString()}자
            </span>
            {page.topic && (
              <Link
                href={`/groups/${groupId}/wiki/topics/${page.topic.id}`}
                className="flex items-center gap-1 text-nu-pink no-underline hover:underline"
              >
                <BookOpen size={12} /> {page.topic.name}
              </Link>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="px-5 py-2.5 bg-nu-ink text-white font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-nu-pink transition-all flex items-center gap-2 shrink-0"
        >
          <Edit3 size={12} /> Edit
        </button>
      </div>

      {/* Table of Contents */}
      {tocItems.length > 2 && (
        <div className="border-[2px] border-nu-ink/[0.08] bg-white">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="w-full flex items-center justify-between p-4 hover:bg-nu-cream/30 transition-colors"
          >
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
              <List size={14} className="text-nu-blue" /> Table of Contents ({tocItems.length})
            </span>
            {showTOC ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTOC && (
            <div className="border-t border-nu-ink/5 p-4 space-y-1">
              {tocItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = document.getElementById(item.id);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`block w-full text-left text-xs hover:text-nu-pink transition-colors py-1 ${
                    item.level === 1 ? "font-bold text-nu-ink" :
                    item.level === 2 ? "pl-4 text-nu-graphite" :
                    "pl-8 text-nu-muted"
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="bg-white border-[2px] border-nu-ink/[0.08] p-8 md:p-12 text-sm text-nu-graphite leading-relaxed min-h-[300px]"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdownWithIds(page.content || "")) }}
      />

      {/* Reactions — now DB-backed with counts */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mr-2">React:</span>
        {REACTIONS.map(r => {
          const count = reactionCounts[r] || 0;
          const isActive = activeReactions.has(r);
          return (
            <button
              key={r}
              onClick={() => toggleReaction(r)}
              disabled={loadingReaction}
              className={`px-3 py-1.5 border text-sm transition-all hover:scale-110 active:scale-95 flex items-center gap-1.5 disabled:opacity-50 ${
                isActive
                  ? "border-nu-pink bg-nu-pink/10 shadow-sm"
                  : "border-nu-ink/10 bg-white hover:border-nu-ink/30"
              }`}
            >
              {r}
              {count > 0 && (
                <span className={`font-mono-nu text-[9px] font-bold ${isActive ? "text-nu-pink" : "text-nu-muted"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tags */}
      {pageTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag size={12} className="text-nu-muted" />
          {pageTags.map((t, i) => (
            <span
              key={i}
              className="font-mono-nu text-[9px] px-2 py-0.5 border flex items-center gap-1"
              style={{ borderColor: (t.color || '#e91e63') + '40', backgroundColor: (t.color || '#e91e63') + '10', color: t.color || '#e91e63' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color || '#e91e63' }} />
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Linked Pages (Knowledge Graph Connections) */}
      <div className="border-[2px] border-nu-ink/[0.08]">
        <div className="flex items-center justify-between p-4 bg-white">
          <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
            <Link2 size={14} className="text-nu-blue" /> Linked Pages ({linkedPages.length})
          </span>
          <button
            onClick={() => setShowLinkCreator(!showLinkCreator)}
            className="font-mono-nu text-[9px] text-nu-pink font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
          >
            {showLinkCreator ? <X size={12} /> : <Plus size={12} />}
            {showLinkCreator ? "닫기" : "연결 추가"}
          </button>
        </div>

        {/* Link creator */}
        {showLinkCreator && (
          <div className="border-t border-nu-ink/5 p-4 bg-nu-cream/20">
            <div className="relative">
              <input
                value={linkSearch}
                onChange={(e) => handleLinkSearch(e.target.value)}
                placeholder="연결할 페이지 검색..."
                className="w-full pl-9 pr-4 py-2 border border-nu-ink/10 bg-white font-mono-nu text-xs focus:outline-none focus:border-nu-pink transition-colors"
              />
              {searchingLinks ? (
                <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-pink animate-spin" />
              ) : (
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
              )}
            </div>
            {linkSearchResults.length > 0 && (
              <div className="mt-1 bg-white border border-nu-ink/10 max-h-40 overflow-auto">
                {linkSearchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.from("wiki_page_links").insert({
                        source_page_id: page.id,
                        target_page_id: r.id,
                        link_type: "reference",
                      });
                      setLinkedPages(prev => [...prev, { id: r.id, title: r.title, direction: 'outgoing' }]);
                      setLinkSearch("");
                      setLinkSearchResults([]);
                      toast.success(`"${r.title}" 페이지와 연결되었습니다`);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-nu-cream/50 transition-colors flex items-center gap-2 border-b border-nu-ink/5 last:border-0"
                  >
                    <BookOpen size={12} className="text-nu-blue shrink-0" />
                    <span className="font-head text-sm font-bold text-nu-ink">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Linked page list */}
        {linkedPages.length > 0 && (
          <div className="border-t border-nu-ink/5 bg-white p-3 space-y-1">
            {linkedPages.map((lp, i) => (
              <Link
                key={`${lp.id}-${i}`}
                href={`/groups/${groupId}/wiki/pages/${lp.id}`}
                className="flex items-center gap-2 px-3 py-2 no-underline hover:bg-nu-cream/30 transition-colors group"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${lp.direction === 'outgoing' ? 'bg-nu-blue' : 'bg-nu-pink'}`} />
                <span className="text-xs text-nu-graphite group-hover:text-nu-pink transition-colors font-medium">{lp.title}</span>
                <span className="font-mono-nu text-[7px] text-nu-muted uppercase tracking-widest ml-auto">
                  {lp.direction === 'outgoing' ? '→ outgoing' : '← incoming'}
                </span>
              </Link>
            ))}
          </div>
        )}
        {linkedPages.length === 0 && !showLinkCreator && (
          <div className="border-t border-nu-ink/5 p-4 text-center">
            <p className="text-[11px] text-nu-muted">연결된 페이지가 없습니다. "연결 추가"로 지식 그래프를 확장하세요.</p>
          </div>
        )}
      </div>

      {/* Collapsible panels */}
      <div className="space-y-3">
        {/* Version History with Diff Viewer */}
        <div className="border-[2px] border-nu-ink/[0.08]">
          <button
            onClick={() => { setShowVersions(!showVersions); setDiffVersion(null); }}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-nu-cream/30 transition-colors"
          >
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
              <History size={14} className="text-nu-blue" /> Version History ({versions.length})
            </span>
            {showVersions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showVersions && (
            <div className="border-t border-nu-ink/[0.05] bg-nu-cream/10 p-4 space-y-2 max-h-64 overflow-auto">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-nu-ink/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-nu text-[10px] font-bold text-nu-pink w-8">v{v.version}</span>
                    <span className="text-xs text-nu-graphite">{v.change_summary || "변경 내용"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-nu text-[9px] text-nu-muted">
                      {v.editor?.nickname} · {new Date(v.created_at).toLocaleDateString("ko")}
                    </span>
                    {v.content && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDiffVersion(diffVersion?.version === v.version ? null : { version: v.version, content: v.content, title: v.title });
                        }}
                        className={`px-2 py-1 font-mono-nu text-[8px] font-bold uppercase tracking-widest transition-all ${
                          diffVersion?.version === v.version
                            ? "bg-nu-pink text-white"
                            : "bg-white border border-nu-ink/10 text-nu-muted hover:text-nu-ink hover:border-nu-ink/30"
                        }`}
                      >
                        <ArrowUpDown size={10} className="inline mr-1" />
                        {diffVersion?.version === v.version ? "닫기" : "비교"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {versions.length === 0 && (
                <p className="text-xs text-nu-muted italic py-2">버전 이력이 없습니다.</p>
              )}
            </div>
          )}
          {/* Diff Viewer */}
          {diffVersion && (
            <div className="border-t-[2px] border-nu-pink/30 bg-nu-cream/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                  <ArrowUpDown size={14} className="text-nu-pink" />
                  v{diffVersion.version} vs v{page.version} (현재)
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mb-2 text-center">v{diffVersion.version} (이전)</p>
                  <div className="bg-white border border-nu-ink/10 p-4 text-xs text-nu-graphite leading-relaxed max-h-64 overflow-auto font-mono-nu whitespace-pre-wrap">
                    {diffVersion.content.split("\n").map((line, i) => {
                      const currentLines = (page.content || "").split("\n");
                      const isRemoved = !currentLines.includes(line) && line.trim();
                      return (
                        <div key={i} className={`${isRemoved ? "bg-red-50 text-red-600 border-l-2 border-red-300 pl-2 -ml-2" : ""}`}>
                          {line || "\u00A0"}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mb-2 text-center">v{page.version} (현재)</p>
                  <div className="bg-white border border-nu-ink/10 p-4 text-xs text-nu-graphite leading-relaxed max-h-64 overflow-auto font-mono-nu whitespace-pre-wrap">
                    {(page.content || "").split("\n").map((line, i) => {
                      const oldLines = diffVersion.content.split("\n");
                      const isAdded = !oldLines.includes(line) && line.trim();
                      return (
                        <div key={i} className={`${isAdded ? "bg-green-50 text-green-600 border-l-2 border-green-300 pl-2 -ml-2" : ""}`}>
                          {line || "\u00A0"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contributions */}
        <div className="border-[2px] border-nu-ink/[0.08]">
          <button
            onClick={() => setShowContribs(!showContribs)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-nu-cream/30 transition-colors"
          >
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
              <Users size={14} className="text-nu-pink" /> Contributors ({contributions.length})
            </span>
            {showContribs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showContribs && (
            <div className="border-t border-nu-ink/[0.05] bg-nu-cream/10 p-4 space-y-2 max-h-64 overflow-auto">
              {contributions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-nu-ink/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-nu-pink/10 rounded-full flex items-center justify-center font-head text-[10px] font-bold text-nu-pink shrink-0">
                      {(c.contributor?.nickname || "U").charAt(0)}
                    </div>
                    <span className="text-xs text-nu-graphite">{c.change_summary || "기여"}</span>
                  </div>
                  <span className="font-mono-nu text-[9px] text-nu-muted">
                    {c.contributor?.nickname} · {new Date(c.created_at).toLocaleDateString("ko")}
                  </span>
                </div>
              ))}
              {contributions.length === 0 && (
                <p className="text-xs text-nu-muted italic py-2">기여 이력이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t-[2px] border-nu-ink/10 flex items-center justify-between">
        <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={10} className="text-nu-pink" /> Last updated by <span className="text-nu-ink font-bold">@{page.updater?.nickname}</span>
        </p>
        {page.topic && (
          <Link
            href={`/groups/${groupId}/wiki/topics/${page.topic.id}`}
            className="font-mono-nu text-[10px] text-nu-pink font-bold uppercase tracking-widest hover:underline flex items-center gap-1 no-underline"
          >
            <ArrowLeft size={12} /> {page.topic.name}으로 돌아가기
          </Link>
        )}
      </div>
    </article>
  );
}
