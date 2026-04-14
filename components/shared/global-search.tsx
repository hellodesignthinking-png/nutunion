"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Search, Command, Users, Briefcase, FileText, Calendar,
  ArrowRight, X, Zap, BookOpen, MessageSquare, Hash
} from "lucide-react";

type ResultType = "member" | "group" | "project" | "resource";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
}

const typeConfig: Record<ResultType, { icon: any; color: string; label: string }> = {
  member: { icon: Users, color: "text-nu-pink", label: "와셔" },
  group: { icon: Hash, color: "text-nu-blue", label: "너트" },
  project: { icon: Briefcase, color: "text-nu-amber", label: "볼트" },
  resource: { icon: FileText, color: "text-green-600", label: "자료" },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Search logic with abort to prevent race conditions
  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const supabase = createClient();
      const all: SearchResult[] = [];

      const [
        { data: profiles },
        { data: groups },
        { data: projects },
      ] = await Promise.all([
        supabase.from("profiles").select("id, nickname, bio").ilike("nickname", `%${q}%`).limit(5).abortSignal(controller.signal),
        supabase.from("groups").select("id, name, category, description").ilike("name", `%${q}%`).eq("is_active", true).limit(5).abortSignal(controller.signal),
        supabase.from("projects").select("id, title, description, category").ilike("title", `%${q}%`).neq("status", "draft").limit(5).abortSignal(controller.signal),
      ]);

      (profiles || []).forEach((p: any) => all.push({
        id: p.id, type: "member", title: p.nickname || "와셔",
        subtitle: p.bio || "넛유니온 와셔", href: `/portfolio/${p.id}`
      }));
      (groups || []).forEach((g: any) => all.push({
        id: g.id, type: "group", title: g.name,
        subtitle: g.description?.slice(0, 60) || g.category, href: `/groups/${g.id}`
      }));
      (projects || []).forEach((p: any) => all.push({
        id: p.id, type: "project", title: p.title,
        subtitle: p.description?.slice(0, 60) || p.category, href: `/projects/${p.id}`
      }));

      setResults(all);
      setSelectedIdx(0);
      setLoading(false);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    router.push(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      aria-label="검색 열기 (⌘K)"
      className="flex items-center gap-2 px-3 py-1.5 text-nu-muted hover:text-nu-ink bg-nu-ink/[0.03] hover:bg-nu-ink/[0.06] border border-nu-ink/10 transition-colors"
    >
      <Search size={14} />
      <span className="font-mono-nu text-[10px] tracking-wider hidden sm:inline">검색</span>
      <kbd className="font-mono-nu text-[8px] text-nu-muted/60 bg-nu-ink/5 border border-nu-ink/10 px-1.5 py-0.5 hidden sm:inline">⌘K</kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-nu-ink/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative max-w-xl mx-auto mt-[15vh] animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-nu-white border-[2px] border-nu-ink shadow-2xl shadow-nu-ink/20 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-nu-ink/5">
            <Search size={20} className="text-nu-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="와셔, 너트, 볼트 검색..."
              className="flex-1 bg-transparent text-nu-ink text-sm font-medium placeholder:text-nu-muted/50 focus:outline-none"
            />
            <kbd className="font-mono-nu text-[9px] text-nu-muted bg-nu-cream/50 border border-nu-ink/10 px-2 py-1">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="px-5 py-8 text-center">
                <div className="w-5 h-5 border-2 border-nu-pink border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">Searching...</p>
              </div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="px-5 py-8 text-center">
                <Search size={24} className="text-nu-muted/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-nu-ink mb-1">"{query}"에 대한 검색 결과가 없습니다</p>
                <p className="text-[11px] text-nu-muted mb-4">다른 키워드로 검색하거나, 아래 바로가기를 이용해보세요</p>
                <div className="flex justify-center gap-2">
                  {[
                    { label: "너트 탐색", href: "/groups" },
                    { label: "볼트 찾기", href: "/projects" },
                    { label: "와셔 검색", href: "/talents" },
                  ].map(a => (
                    <button
                      key={a.href}
                      onClick={() => { setOpen(false); router.push(a.href); }}
                      className="font-mono-nu text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-nu-ink/10 text-nu-muted hover:text-nu-ink hover:border-nu-ink/20 transition-colors"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map((r, idx) => {
                  const cfg = typeConfig[r.type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                        idx === selectedIdx ? "bg-nu-cream/40" : "hover:bg-nu-cream/20"
                      }`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center bg-nu-ink/[0.03] border border-nu-ink/5 ${cfg.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-nu-ink truncate">{r.title}</p>
                        <p className="text-[10px] text-nu-muted truncate">{r.subtitle}</p>
                      </div>
                      <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 border ${cfg.color} bg-current/5`}>
                        {cfg.label}
                      </span>
                      <ArrowRight size={12} className="text-nu-muted/30" />
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && query.length < 2 && (
              <div className="px-5 py-6">
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "너트 탐색", href: "/groups", icon: Hash },
                    { label: "볼트 찾기", href: "/projects", icon: Briefcase },
                    { label: "와셔 검색", href: "/talents", icon: Users },
                    { label: "내 프로필", href: "/profile", icon: Zap },
                  ].map(a => (
                    <button
                      key={a.href}
                      onClick={() => { setOpen(false); router.push(a.href); }}
                      className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-medium text-nu-muted hover:text-nu-ink bg-nu-cream/20 hover:bg-nu-cream/40 transition-colors"
                    >
                      <a.icon size={14} /> {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-nu-ink/5 flex items-center justify-between bg-nu-cream/10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono-nu text-[8px] text-nu-muted">
                <kbd className="px-1 py-0.5 bg-nu-ink/5 border border-nu-ink/10 text-[7px]">↑↓</kbd> 이동
              </span>
              <span className="flex items-center gap-1 font-mono-nu text-[8px] text-nu-muted">
                <kbd className="px-1 py-0.5 bg-nu-ink/5 border border-nu-ink/10 text-[7px]">↵</kbd> 선택
              </span>
            </div>
            <span className="font-mono-nu text-[7px] text-nu-muted uppercase tracking-widest">
              Powered by nutunion
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
