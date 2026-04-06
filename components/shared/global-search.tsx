"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, X, Users, Briefcase, Layers, Loader2 } from "lucide-react";

interface SearchResult {
  type: "crew" | "project" | "member";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => searchAll(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function searchAll(q: string) {
    setLoading(true);
    const supabase = createClient();
    const searchQ = `%${q}%`;

    const [groupsRes, projectsRes, membersRes] = await Promise.all([
      supabase.from("groups").select("id, name, category, description").ilike("name", searchQ).eq("is_active", true).limit(5),
      supabase.from("projects").select("id, title, description, status").ilike("title", searchQ).neq("status", "draft").limit(5),
      supabase.from("profiles").select("id, nickname, name, specialty").or(`nickname.ilike.${searchQ},name.ilike.${searchQ}`).limit(5),
    ]);

    const items: SearchResult[] = [
      ...(groupsRes.data || []).map((g) => ({
        type: "crew" as const,
        id: g.id,
        title: g.name,
        subtitle: g.category || "",
        href: `/groups/${g.id}`,
      })),
      ...(projectsRes.data || []).map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.title,
        subtitle: p.status,
        href: `/projects/${p.id}`,
      })),
      ...(membersRes.data || []).map((m) => ({
        type: "member" as const,
        id: m.id,
        title: m.nickname || m.name,
        subtitle: m.specialty || "",
        href: `/members`,
      })),
    ];

    setResults(items);
    setLoading(false);
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const typeIcons = {
    crew: { icon: Layers, color: "text-nu-blue", label: "크루" },
    project: { icon: Briefcase, color: "text-green-600", label: "프로젝트" },
    member: { icon: Users, color: "text-nu-pink", label: "멤버" },
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-nu-muted hover:text-nu-ink transition-colors"
        title="검색 (⌘K)"
      >
        <Search size={16} />
        <span className="hidden lg:inline font-mono-nu text-[10px] bg-nu-cream px-1.5 py-0.5">⌘K</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-nu-ink/40 z-[600]" onClick={() => setOpen(false)} />

      {/* Search modal */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[601] px-4">
        <div className="bg-nu-white border border-nu-ink/10 shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-nu-ink/[0.06]">
            <Search size={18} className="text-nu-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="크루, 프로젝트, 멤버 검색..."
              className="flex-1 text-sm bg-transparent focus:outline-none"
            />
            {loading && <Loader2 size={16} className="animate-spin text-nu-muted" />}
            <button onClick={() => setOpen(false)} className="p-1 text-nu-muted hover:text-nu-ink">
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto py-2">
              {results.map((r) => {
                const t = typeIcons[r.type];
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => navigate(r.href)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-nu-cream/50 transition-colors text-left"
                  >
                    <t.icon size={16} className={t.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate">{r.title}</p>
                      <p className="text-[10px] text-nu-muted capitalize">{r.subtitle}</p>
                    </div>
                    <span className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted shrink-0">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-nu-muted">검색 결과가 없습니다</p>
            </div>
          )}

          {!query && (
            <div className="py-6 px-5 text-center">
              <p className="text-xs text-nu-muted">크루, 프로젝트, 멤버를 검색하세요</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
