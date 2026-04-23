"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, ArrowRight, Users, Rocket, BookOpen, Target, LayoutDashboard, Sparkles, Briefcase, Settings, Bell, FileText, MessageSquare, Calendar, CheckSquare, Paperclip, User as UserIcon } from "lucide-react";

type GKind = "note" | "task" | "track" | "wiki" | "meeting" | "file" | "person" | "group" | "project";

interface GlobalResult {
  kind: GKind;
  id: string;
  title: string;
  snippet: string;
  href: string;
  icon: string;
  updated_at: string;
}

const KIND_LABELS: Record<GKind | "all", string> = {
  all: "모두",
  note: "노트",
  task: "할일",
  track: "트랙",
  wiki: "위키",
  meeting: "회의",
  file: "파일",
  person: "인맥",
  group: "너트",
  project: "볼트",
};

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords: string[];
  group: "페이지" | "빠른 액션" | "현재 컨텍스트" | "관리";
}

const COMMANDS: CommandItem[] = [
  { id: "dashboard", label: "대시보드", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "dashboard", "대시보드", "홈"], group: "페이지" },
  { id: "groups", label: "너트 (Nut)", description: "관심사별 그룹 탐색", href: "/groups", icon: Users, keywords: ["nut", "너트", "group", "그룹"], group: "페이지" },
  { id: "projects", label: "볼트 (Bolt)", description: "프로젝트 탐색", href: "/projects", icon: Rocket, keywords: ["bolt", "볼트", "project", "프로젝트"], group: "페이지" },
  { id: "wiki", label: "탭 (Tab)", description: "지식 아카이브", href: "/wiki", icon: BookOpen, keywords: ["wiki", "tab", "탭", "위키", "지식"], group: "페이지" },
  { id: "talents", label: "와셔 (Washer)", description: "인재 풀", href: "/talents", icon: Briefcase, keywords: ["washer", "talent", "와셔", "인재"], group: "페이지" },
  { id: "challenges", label: "의뢰 (Challenge)", description: "외부 프로젝트 등록", href: "/challenges", icon: Target, keywords: ["challenge", "의뢰", "비즈니스"], group: "페이지" },
  { id: "showcase", label: "성공 사례", href: "/ventures/showcase", icon: Sparkles, keywords: ["showcase", "success", "사례", "venture"], group: "페이지" },
  { id: "notifications", label: "알림", href: "/notifications", icon: Bell, keywords: ["notifications", "알림"], group: "페이지" },

  { id: "create-group", label: "새 너트 만들기", href: "/groups/create", icon: Users, keywords: ["create", "새", "너트 만들기", "new"], group: "빠른 액션" },
  { id: "create-project", label: "새 볼트 만들기", href: "/projects/create", icon: Rocket, keywords: ["create", "새", "볼트 만들기", "new"], group: "빠른 액션" },
  { id: "profile", label: "내 프로필", href: "/profile", icon: FileText, keywords: ["profile", "프로필", "me"], group: "빠른 액션" },
  { id: "portfolio", label: "포트폴리오", href: "/profile/portfolio", icon: FileText, keywords: ["portfolio", "포트폴리오"], group: "빠른 액션" },
  { id: "profile-digests", label: "내 카톡 회의록", description: "전체 회의록 보관함", href: "/profile/digests", icon: MessageSquare, keywords: ["digest", "회의록", "카톡", "chat", "minutes"], group: "빠른 액션" },
];

const ADMIN_COMMANDS: CommandItem[] = [
  { id: "admin-dashboard", label: "관리자 대시보드", href: "/admin", icon: Settings, keywords: ["admin", "관리"], group: "관리" },
  { id: "admin-health", label: "시스템 상태", description: "마이그레이션 체크", href: "/admin/health", icon: Settings, keywords: ["health", "migration", "마이그레이션", "상태"], group: "관리" },
  { id: "admin-users", label: "사용자 관리", href: "/admin/users", icon: Users, keywords: ["users", "사용자"], group: "관리" },
];

export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 현재 경로에서 group/project id 추출해 컨텍스트 명령 주입
  const contextCommands = useMemo<CommandItem[]>(() => {
    if (!pathname) return [];
    const groupMatch = pathname.match(/^\/groups\/([0-9a-f-]{36})/i);
    const projectMatch = pathname.match(/^\/projects\/([0-9a-f-]{36})/i);
    const items: CommandItem[] = [];
    if (groupMatch) {
      const id = groupMatch[1];
      items.push(
        { id: "ctx-group-home",     label: "← 너트 홈",      href: `/groups/${id}`,          icon: Users,         keywords: ["home", "홈"],           group: "현재 컨텍스트" },
        { id: "ctx-group-schedule", label: "📅 캘린더",      href: `/groups/${id}/schedule`, icon: Calendar,      keywords: ["calendar", "캘린더", "일정"], group: "현재 컨텍스트" },
        { id: "ctx-group-digests",  label: "💬 카톡 회의록", href: `/groups/${id}/digests`,  icon: MessageSquare, keywords: ["digest", "카톡", "회의록", "chat"], group: "현재 컨텍스트" },
        { id: "ctx-group-wiki",     label: "📚 위키",        href: `/groups/${id}/wiki`,     icon: BookOpen,      keywords: ["wiki", "위키"],         group: "현재 컨텍스트" },
      );
    }
    if (projectMatch) {
      const id = projectMatch[1];
      items.push(
        { id: "ctx-proj-home",     label: "← 볼트 홈",      href: `/projects/${id}`,         icon: Rocket,        keywords: ["home", "홈"],            group: "현재 컨텍스트" },
        { id: "ctx-proj-venture",  label: "🚀 Venture",     href: `/projects/${id}/venture`, icon: Sparkles,      keywords: ["venture", "벤처"],      group: "현재 컨텍스트" },
        { id: "ctx-proj-digests",  label: "💬 카톡 회의록", href: `/projects/${id}/digests`, icon: MessageSquare, keywords: ["digest", "카톡", "회의록"], group: "현재 컨텍스트" },
      );
    }
    return items;
  }, [pathname]);

  const allCommands = useMemo(
    () => [
      ...contextCommands,
      ...COMMANDS,
      ...(isAdmin ? ADMIN_COMMANDS : []),
    ],
    [contextCommands, isAdmin]
  );

  const [serverResults, setServerResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [globalResults, setGlobalResults] = useState<GlobalResult[]>([]);
  const [globalCounts, setGlobalCounts] = useState<Record<string, number>>({});
  const [kindFilter, setKindFilter] = useState<GKind | "all">("all");

  // 서버 통합 검색 (너트/볼트/와셔/탭) — 150ms debounce
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) { setServerResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/universal?q=${encodeURIComponent(q)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const items: CommandItem[] = [
          ...(data.nuts ?? []).map((n: any) => ({
            id: `nut-${n.id}`, label: n.name, description: n.description?.slice(0, 80),
            href: `/groups/${n.id}`, icon: Users, keywords: [n.category].filter(Boolean),
            group: "페이지" as const,
          })),
          ...(data.bolts ?? []).map((b: any) => ({
            id: `bolt-${b.id}`, label: b.title, description: b.description?.slice(0, 80),
            href: `/projects/${b.id}`, icon: Rocket, keywords: [b.category, b.status].filter(Boolean),
            group: "페이지" as const,
          })),
          ...(data.washers ?? []).map((w: any) => ({
            id: `washer-${w.id}`, label: w.nickname, description: w.bio?.slice(0, 80),
            href: `/portfolio/${w.id}`, icon: Briefcase, keywords: [w.specialty].filter(Boolean),
            group: "페이지" as const,
          })),
          ...(data.taps ?? []).map((t: any) => ({
            id: `tap-${t.id}`, label: t.title,
            href: `/projects/${t.project_id}/tap`, icon: BookOpen, keywords: ["tap", "탭"],
            group: "페이지" as const,
          })),
        ];
        if (!cancelled) setServerResults(items);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  // Global cross-table search — 250ms debounce
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) { setGlobalResults([]); setGlobalCounts({}); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/search/global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, limit: 5 }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setGlobalResults(data.results || []);
          setGlobalCounts(data.counts || {});
        }
      } catch {}
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    const localMatches = allCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    );
    // 서버 결과를 상단으로, 로컬 명령을 하단으로
    const seen = new Set(localMatches.map((m) => m.id));
    const dedupedServer = serverResults.filter((r) => !seen.has(r.id));
    return [...dedupedServer, ...localMatches];
  }, [query, allCommands, serverResults]);

  // Cmd+K / Ctrl+K 전역 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // 열릴 때 input focus + reset
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Combined list of all selectable items (global results + commands) for keyboard nav
  const visibleGlobal = useMemo(() => {
    if (kindFilter === "all") return globalResults;
    return globalResults.filter((r) => r.kind === kindFilter);
  }, [globalResults, kindFilter]);

  const combinedCount = visibleGlobal.length + filtered.length;

  // activeIdx 경계 보정
  useEffect(() => {
    if (activeIdx >= combinedCount) setActiveIdx(Math.max(0, combinedCount - 1));
  }, [combinedCount, activeIdx]);

  // Reset filter when closing
  useEffect(() => { if (!open) setKindFilter("all"); }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, combinedCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < visibleGlobal.length) {
        const r = visibleGlobal[activeIdx];
        if (r) navigate(r.href);
      } else {
        const cmd = filtered[activeIdx - visibleGlobal.length];
        if (cmd) navigate(cmd.href);
      }
    }
  };

  // 그룹별 렌더 준비
  const grouped = useMemo(() => {
    const map = new Map<CommandItem["group"], CommandItem[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!open) return null;

  let runningIdx = visibleGlobal.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="명령 팔레트"
        className="w-full max-w-xl bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b-[2px] border-nu-ink">
          <Search size={16} className="text-nu-graphite" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="어디로 갈까요? (너트, 볼트, 탭...)"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-nu-graphite"
          />
          <kbd className="font-mono-nu text-[10px] border border-nu-ink/20 px-1.5 py-0.5 bg-nu-cream/40">ESC</kbd>
        </div>

        {/* Kind filter chips */}
        {query.trim().length >= 2 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-nu-ink/10 bg-nu-cream/10">
            {(["all","note","task","track","wiki","meeting","file","person","group","project"] as (GKind|"all")[]).map((k) => {
              const count = k === "all" ? globalResults.length : (globalCounts[k] || 0);
              const active = kindFilter === k;
              if (k !== "all" && count === 0) return null;
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border ${active ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/20 text-nu-graphite hover:border-nu-ink"}`}
                >
                  {KIND_LABELS[k]} {count > 0 && <span className="opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Global search results */}
          {visibleGlobal.length > 0 && (
            <div>
              <div className="px-3 py-1.5 font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-graphite bg-nu-cream/30 border-b border-nu-ink/10">
                🔍 통합 검색
              </div>
              <ul className="list-none m-0 p-0">
                {visibleGlobal.map((r, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <li key={`${r.kind}-${r.id}`}>
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 no-underline transition-colors ${isActive ? "bg-nu-pink/10" : "hover:bg-nu-ink/5"}`}
                      >
                        <span className="text-lg shrink-0">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-bold truncate ${isActive ? "text-nu-pink" : "text-nu-ink"}`}>
                            {r.title}
                          </div>
                          {r.snippet && (
                            <div className="text-[11px] text-nu-graphite truncate">{r.snippet}</div>
                          )}
                        </div>
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-nu-ink/20 text-nu-graphite shrink-0">
                          {KIND_LABELS[r.kind]}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {visibleGlobal.length === 0 && filtered.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-nu-graphite">
              {query.trim() ? "검색 결과 없음" : (
                <div>
                  <div className="font-head text-sm font-extrabold text-nu-ink mb-2">무엇을 찾으시나요?</div>
                  <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">노트 · 할일 · 트랙 · 위키 · 파일 · 인맥</div>
                </div>
              )}
            </div>
          ) : filtered.length === 0 ? null : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-1.5 font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-graphite bg-nu-cream/30 border-b border-nu-ink/10">
                  {group}
                </div>
                <ul className="list-none m-0 p-0">
                  {items.map((c) => {
                    runningIdx += 1;
                    const isActive = runningIdx === activeIdx;
                    const Icon = c.icon;
                    return (
                      <li key={c.id}>
                        <Link
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 no-underline transition-colors ${
                            isActive ? "bg-nu-pink/10" : "hover:bg-nu-ink/5"
                          }`}
                        >
                          <Icon size={15} className={isActive ? "text-nu-pink" : "text-nu-graphite"} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-[13px] font-bold ${isActive ? "text-nu-pink" : "text-nu-ink"}`}>
                              {c.label}
                            </div>
                            {c.description && (
                              <div className="text-[11px] text-nu-graphite truncate">{c.description}</div>
                            )}
                          </div>
                          <ArrowRight size={12} className={isActive ? "text-nu-pink" : "text-nu-graphite/40"} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t-[2px] border-nu-ink/10 bg-nu-cream/20 flex items-center gap-3 font-mono-nu text-[10px] text-nu-graphite">
          <span className="inline-flex items-center gap-1"><kbd className="border border-nu-ink/20 px-1 bg-white">↑↓</kbd> 이동</span>
          <span className="inline-flex items-center gap-1"><kbd className="border border-nu-ink/20 px-1 bg-white">⏎</kbd> 열기</span>
          <span className="ml-auto">
            <kbd className="border border-nu-ink/20 px-1 bg-white">⌘K</kbd> 또는 <kbd className="border border-nu-ink/20 px-1 bg-white">Ctrl+K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
