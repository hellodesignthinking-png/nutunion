"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Brain, ArrowRight, Loader2, Command } from "lucide-react";
import Link from "next/link";

export function WikiSearchBar({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const supabase = createClient();

      // Get topics for this group
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name, description")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);
      if (topicIds.length === 0) { setResults([]); return; }

      // Search pages by title or content (ilike) — sanitize query to prevent PostgREST filter injection
      const safeQ = q.replace(/[%_\\(),.*]/g, "");
      if (!safeQ.trim()) { setResults([]); return; }
      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title, content, topic:wiki_topics(name)")
        .in("topic_id", topicIds)
        .or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
        .limit(8);

      // Also search topic names that match
      const matchingTopics = (topics || [])
        .filter(t =>
          t.name.toLowerCase().includes(q.toLowerCase()) ||
          (t.description || "").toLowerCase().includes(q.toLowerCase())
        )
        .map(t => ({ id: t.id, title: t.name, type: "topic", snippet: t.description || "" }));

      const pageResults = (pages || []).map(p => ({
        ...p,
        type: "page",
        snippet: (p.content || "").replace(/[#*`\-\[\]]/g, "").slice(0, 100),
      }));

      setResults([...matchingTopics, ...pageResults]);
      setSelectedIdx(-1);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [groupId]);

  const handleChange = (value: string) => {
    setQuery(value);
    setShowResults(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIdx >= 0 && results[selectedIdx]) {
      e.preventDefault();
      const r = results[selectedIdx];
      const href = r.type === "topic"
        ? `/groups/${groupId}/wiki/topics/${r.id}`
        : `/groups/${groupId}/wiki/pages/${r.id}`;
      router.push(href);
      setShowResults(false);
      setQuery("");
    } else if (e.key === "Escape") {
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  const getHref = (r: any) =>
    r.type === "topic"
      ? `/groups/${groupId}/wiki/topics/${r.id}`
      : `/groups/${groupId}/wiki/pages/${r.id}`;

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-xl">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="지식 검색 — 주제, 페이지, 개념..."
          className="w-full bg-white border-[2px] border-nu-ink pl-11 pr-20 py-3 font-mono-nu text-xs focus:outline-none focus:border-nu-pink transition-all"
        />
        {searching ? (
          <Loader2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nu-pink animate-spin" />
        ) : (
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nu-muted" />
        )}
        {/* Keyboard shortcut hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-nu-muted pointer-events-none">
          <kbd className="font-mono-nu text-[11px] bg-nu-ink/5 border border-nu-ink/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Command size={9} /> K
          </kbd>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[2px] border-nu-ink shadow-lg z-50 max-h-80 overflow-auto">
          {results.map((r, i) => (
            <Link
              key={`${r.type}-${r.id}-${i}`}
              href={getHref(r)}
              onClick={() => { setShowResults(false); setQuery(""); }}
              className={`flex items-start gap-3 p-4 no-underline transition-colors border-b border-nu-ink/5 last:border-0 group ${
                i === selectedIdx ? "bg-nu-cream/70" : "hover:bg-nu-cream/50"
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${r.type === "topic" ? "bg-nu-pink/10" : "bg-nu-blue/10"}`}>
                {r.type === "topic" ? <Brain size={14} className="text-nu-pink" /> : <BookOpen size={14} className="text-nu-blue" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">
                  {r.title}
                </p>
                {r.type === "page" && (
                  <p className="text-[13px] text-nu-muted line-clamp-1 mt-0.5">
                    {r.topic?.name && <span className="text-nu-pink">{r.topic.name} · </span>}
                    {r.snippet}
                  </p>
                )}
                {r.type === "topic" && (
                  <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mt-0.5">Topic{r.snippet ? ` · ${r.snippet.slice(0, 50)}` : ""}</p>
                )}
              </div>
              <ArrowRight size={14} className="text-nu-ink/20 group-hover:text-nu-pink shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
          <div className="px-4 py-2 bg-nu-cream/30 border-t border-nu-ink/5">
            <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest flex items-center gap-2">
              <span>↑↓ 이동</span> · <span>Enter 선택</span> · <span>Esc 닫기</span>
            </p>
          </div>
        </div>
      )}

      {showResults && query && results.length === 0 && !searching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-[2px] border-nu-ink shadow-lg z-50 p-6 text-center">
          <Search size={20} className="mx-auto mb-2 text-nu-ink/15" />
          <p className="text-xs text-nu-muted">"{query}"에 대한 결과가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
