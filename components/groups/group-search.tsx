"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Tag, X, ChevronDown, ChevronUp } from "lucide-react";

interface SearchResult {
  type: "meeting" | "resource" | "post";
  id: string;
  title: string;
  excerpt?: string;
  date: string;
  tags: string[];
  url: string;
}

export function GroupSearch({ groupId }: { groupId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Load all tags for quick filter
  useEffect(() => {
    async function loadTags() {
      const supabase = createClient();
      // meetings table doesn't have a tags column, so we skip tag loading for now
      const tags = new Set<string>();
      setAllTags(Array.from(tags).slice(0, 12));
    }
    loadTags();
  }, [groupId]);

  const doSearch = useCallback(async (q: string, tag?: string | null) => {
    if (!q.trim() && !tag) { setResults([]); return; }
    setLoading(true);
    const supabase = createClient();

    // Search meetings
    let meetingQuery = supabase.from("meetings")
      .select("id, title, summary, scheduled_at")
      .eq("group_id", groupId);
    if (q) meetingQuery = meetingQuery.ilike("title", `%${q}%`);
    const { data: meetings } = await meetingQuery.limit(5);

    // Search resources
    let resQuery = supabase.from("meeting_resources")
      .select("id, title, description, url, created_at, meeting_id");
    if (q) resQuery = resQuery.ilike("title", `%${q}%`);
    // Resource tag support through meeting
    const { data: resources } = await resQuery.limit(5);

    // Search crew posts
    let postQuery = supabase.from("crew_posts")
      .select("id, content, created_at")
      .eq("group_id", groupId);
    if (q) postQuery = postQuery.ilike("content", `%${q}%`);
    const { data: posts } = await postQuery.limit(5);

    const combined: SearchResult[] = [
      ...(meetings || []).map((m: any) => ({
        type: "meeting" as const,
        id: m.id,
        title: m.title,
        excerpt: m.summary,
        date: m.scheduled_at,
        tags: [],
        url: `/groups/${groupId}/meetings/${m.id}`,
      })),
      ...(resources || []).map((r: any) => ({
        type: "resource" as const,
        id: r.id,
        title: r.title,
        excerpt: r.description,
        date: r.created_at,
        tags: [],
        url: `/groups/${groupId}/meetings/${r.meeting_id}?tab=resources`,
      })),
      ...(posts || []).map((p: any) => ({
        type: "post" as const,
        id: p.id,
        title: p.content.slice(0, 60) + (p.content.length > 60 ? "..." : ""),
        excerpt: undefined,
        date: p.created_at,
        tags: [],
        url: `/groups/${groupId}#activity`,
      })),
    ];

    setResults(combined);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query, selectedTag), 300);
    return () => clearTimeout(t);
  }, [query, selectedTag, doSearch]);

  const typeLabel: Record<string, string> = { meeting: "미팅", resource: "자료", post: "활동" };
  const typeColor: Record<string, string> = { meeting: "bg-nu-blue/10 text-nu-blue", resource: "bg-nu-amber/10 text-nu-amber", post: "bg-nu-pink/10 text-nu-pink" };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-nu-ink/15 bg-nu-white px-3 py-2.5">
        <Search size={15} className="text-nu-muted shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="미팅, 자료, 활동 검색..."
          className="flex-1 bg-transparent text-sm focus:outline-none"
          id="group-search-input"
        />
        {(query || selectedTag) && (
          <button onClick={() => { setQuery(""); setSelectedTag(null); setResults([]); }} className="text-nu-muted hover:text-nu-ink">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tag quick filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {allTags.map(t => (
            <button key={t} onClick={() => { setSelectedTag(selectedTag === t ? null : t); setOpen(true); }}
              className={`font-mono-nu text-[11px] uppercase tracking-widest px-2 py-1 flex items-center gap-1 transition-all ${selectedTag === t ? "bg-nu-ink text-nu-paper" : "bg-nu-cream text-nu-muted hover:bg-nu-ink/10"}`}>
              <Tag size={9} />{t}
            </button>
          ))}
        </div>
      )}

      {/* Results dropdown */}
      {open && (query || selectedTag) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-nu-white border border-nu-ink/[0.1] shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-nu-muted text-sm">검색 중...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-nu-muted text-sm">결과가 없습니다</div>
          ) : (
            results.map(r => (
              <a key={`${r.type}-${r.id}`} href={r.url} onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-nu-cream/30 transition-colors no-underline border-b border-nu-ink/[0.05] last:border-b-0">
                <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 mt-0.5 ${typeColor[r.type]}`}>
                  {typeLabel[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-nu-ink font-medium truncate">{r.title}</p>
                  {r.excerpt && <p className="text-xs text-nu-muted truncate">{r.excerpt}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.tags.map(t => (
                      <span key={t} className="font-mono-nu text-[10px] text-nu-blue"># {t}</span>
                    ))}
                  </div>
                </div>
                <span className="font-mono-nu text-[11px] text-nu-muted shrink-0">
                  {new Date(r.date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
