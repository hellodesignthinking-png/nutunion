"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, FolderOpen, CheckSquare, FileText, Calendar,
  Home, Plus, Users, Zap, ArrowRight, Hash
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      loadData();
    }
  }, [isOpen]);

  async function loadData() {
    const supabase = createClient();
    const [{ data: proj }, { data: taskData }] = await Promise.all([
      supabase.from("staff_projects").select("id, title, category").eq("status", "active").order("title").limit(20),
      supabase.from("staff_tasks").select("id, title, status, project:staff_projects(title)").in("status", ["todo", "in_progress"]).order("created_at", { ascending: false }).limit(15),
    ]);
    setProjects(proj || []);
    setTasks(taskData || []);
  }

  function closeAndRun(fn: () => void) {
    setIsOpen(false);
    setQuery("");
    fn();
  }

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Navigation
    items.push(
      { id: "nav-home", label: "대시보드", description: "홈으로 이동", icon: <Home size={16} />, action: () => closeAndRun(() => router.push("/staff")), category: "이동", keywords: ["home", "dashboard"] },
      { id: "nav-projects", label: "프로젝트", description: "프로젝트 목록", icon: <FolderOpen size={16} />, action: () => closeAndRun(() => router.push("/staff/workspace")), category: "이동", keywords: ["project"] },
      { id: "nav-tasks", label: "할일", description: "할일 목록", icon: <CheckSquare size={16} />, action: () => closeAndRun(() => router.push("/staff/tasks")), category: "이동", keywords: ["task", "todo"] },
      { id: "nav-files", label: "파일", description: "파일 관리", icon: <FileText size={16} />, action: () => closeAndRun(() => router.push("/staff/files")), category: "이동", keywords: ["file"] },
      { id: "nav-calendar", label: "캘린더", description: "일정 관리", icon: <Calendar size={16} />, action: () => closeAndRun(() => router.push("/staff/calendar")), category: "이동", keywords: ["calendar", "schedule"] },
    );

    // Actions
    items.push(
      { id: "act-new-project", label: "새 프로젝트", description: "새 프로젝트 생성", icon: <Plus size={16} className="text-indigo-600" />, action: () => closeAndRun(() => router.push("/staff/workspace/create")), category: "액션", keywords: ["create", "new"] },
      { id: "act-site", label: "사이트로 이동", description: "메인 사이트", icon: <ArrowRight size={16} />, action: () => closeAndRun(() => router.push("/dashboard")), category: "액션", keywords: ["site", "main"] },
    );

    // Projects
    for (const p of projects) {
      items.push({
        id: `proj-${p.id}`,
        label: p.title,
        description: p.category || "프로젝트",
        icon: <Hash size={16} className="text-green-500" />,
        action: () => closeAndRun(() => router.push(`/staff/workspace/${p.id}`)),
        category: "프로젝트",
        keywords: [p.title.toLowerCase(), p.category?.toLowerCase()].filter(Boolean),
      });
    }

    // Tasks
    for (const t of tasks.slice(0, 8)) {
      items.push({
        id: `task-${t.id}`,
        label: t.title,
        description: (t.project as any)?.title || "할일",
        icon: <CheckSquare size={16} className="text-orange-500" />,
        action: () => closeAndRun(() => router.push("/staff/tasks")),
        category: "할일",
        keywords: [t.title.toLowerCase()],
      });
    }

    return items;
  }, [projects, tasks, router]);

  // Filtered commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.some(k => k.includes(q))
    );
  }, [commands, query]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [filtered]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  // Reset index on query change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white border border-nu-ink/15 shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-nu-ink/[0.08]">
          <Search size={18} className="text-nu-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="검색하거나 명령어 입력... (이동, 프로젝트, 할일)"
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-nu-muted/60"
          />
          <span className="font-mono-nu text-[8px] text-nu-muted/50 uppercase shrink-0">ESC</span>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="font-mono-nu text-[10px] text-nu-muted">결과가 없습니다</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted px-4 py-1 font-bold">
                  {category}
                </p>
                {items.map(item => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left border-none cursor-pointer transition-colors ${
                        isSelected ? "bg-indigo-50 text-indigo-600" : "bg-transparent text-nu-ink hover:bg-nu-ink/[0.02]"
                      }`}
                    >
                      <span className={isSelected ? "text-indigo-600" : "text-nu-muted"}>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.label}</p>
                        {item.description && (
                          <p className="font-mono-nu text-[8px] text-nu-muted truncate">{item.description}</p>
                        )}
                      </div>
                      {isSelected && <ArrowRight size={12} className="text-indigo-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-nu-ink/[0.06] bg-nu-ink/[0.02] flex items-center gap-4">
          <span className="font-mono-nu text-[8px] text-nu-muted/50">↑↓ 이동</span>
          <span className="font-mono-nu text-[8px] text-nu-muted/50">Enter 선택</span>
          <span className="font-mono-nu text-[8px] text-nu-muted/50">Esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
