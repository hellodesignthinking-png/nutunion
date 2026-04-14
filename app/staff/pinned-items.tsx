"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pin, X, Plus, FolderOpen, CheckSquare, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

interface PinnedItem {
  id: string;
  type: "project" | "task" | "file" | "link";
  title: string;
  href: string;
  subtitle?: string;
}

const STORAGE_KEY = "nutunion-staff-pinned";

export function PinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch { /* */ }
  }, []);

  // Save to localStorage
  function save(newItems: PinnedItem[]) {
    setItems(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  }

  function removeItem(id: string) {
    save(items.filter(i => i.id !== id));
  }

  async function loadSuggestions() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: proj }, { data: taskData }] = await Promise.all([
      supabase.from("staff_projects").select("id, title, category").eq("status", "active").order("updated_at", { ascending: false }).limit(10),
      supabase.from("staff_tasks").select("id, title, project:staff_projects(title)").eq("assigned_to", user.id).in("status", ["todo", "in_progress"]).order("created_at", { ascending: false }).limit(10),
    ]);
    setProjects(proj || []);
    setTasks(taskData || []);
    setShowAdd(true);
  }

  function addProject(p: any) {
    const item: PinnedItem = {
      id: `proj-${p.id}`,
      type: "project",
      title: p.title,
      href: `/staff/workspace/${p.id}`,
      subtitle: p.category,
    };
    if (!items.some(i => i.id === item.id)) save([...items, item]);
    setShowAdd(false);
  }

  function addTask(t: any) {
    const item: PinnedItem = {
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      href: "/staff/tasks",
      subtitle: (t.project as any)?.title,
    };
    if (!items.some(i => i.id === item.id)) save([...items, item]);
    setShowAdd(false);
  }

  const typeIcon: Record<string, React.ReactNode> = {
    project: <FolderOpen size={12} className="text-indigo-500" />,
    task: <CheckSquare size={12} className="text-green-500" />,
    file: <FileText size={12} className="text-amber-500" />,
    link: <ExternalLink size={12} className="text-blue-500" />,
  };

  if (items.length === 0 && !showAdd) {
    return (
      <section className="bg-white border border-nu-ink/[0.06]">
        <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
          <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
            <Pin size={14} className="text-amber-500" /> 즐겨찾기
          </h3>
          <button
            onClick={loadSuggestions}
            className="text-nu-muted hover:text-indigo-600 bg-transparent border-none cursor-pointer p-0"
            aria-label="추가"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="p-5 text-center">
          <p className="font-mono-nu text-[10px] text-nu-muted">자주 사용하는 항목을 고정하세요</p>
          <button
            onClick={loadSuggestions}
            className="font-mono-nu text-[9px] text-indigo-600 mt-1 bg-transparent border-none cursor-pointer underline"
          >
            추가하기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-nu-ink/[0.06]">
      <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
        <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
          <Pin size={14} className="text-amber-500" /> 즐겨찾기
        </h3>
        <button
          onClick={loadSuggestions}
          className="text-nu-muted hover:text-indigo-600 bg-transparent border-none cursor-pointer p-0"
          aria-label="추가"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Pinned list */}
      <div className="divide-y divide-nu-ink/5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 group hover:bg-indigo-50/30 transition-colors">
            {typeIcon[item.type]}
            <Link href={item.href} className="flex-1 min-w-0 no-underline">
              <p className="font-head text-xs font-bold text-nu-ink truncate group-hover:text-indigo-600 transition-colors">{item.title}</p>
              {item.subtitle && (
                <p className="font-mono-nu text-[7px] text-nu-muted truncate">{item.subtitle}</p>
              )}
            </Link>
            <button
              onClick={() => removeItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-nu-muted hover:text-red-500 bg-transparent border-none cursor-pointer p-0 transition-all"
              aria-label="제거"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Add picker */}
      {showAdd && (
        <div className="border-t border-indigo-200 bg-indigo-50/30 p-3 max-h-48 overflow-y-auto">
          <p className="font-mono-nu text-[8px] uppercase tracking-widest text-indigo-600 font-bold mb-2">프로젝트</p>
          {projects.filter(p => !items.some(i => i.id === `proj-${p.id}`)).map(p => (
            <button
              key={p.id}
              onClick={() => addProject(p)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-indigo-100 transition-colors bg-transparent border-none cursor-pointer"
            >
              <FolderOpen size={11} className="text-indigo-400" />
              <span className="text-xs text-nu-ink truncate">{p.title}</span>
            </button>
          ))}
          <p className="font-mono-nu text-[8px] uppercase tracking-widest text-indigo-600 font-bold mb-2 mt-3">할일</p>
          {tasks.filter(t => !items.some(i => i.id === `task-${t.id}`)).slice(0, 5).map(t => (
            <button
              key={t.id}
              onClick={() => addTask(t)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-indigo-100 transition-colors bg-transparent border-none cursor-pointer"
            >
              <CheckSquare size={11} className="text-green-400" />
              <span className="text-xs text-nu-ink truncate">{t.title}</span>
            </button>
          ))}
          <button
            onClick={() => setShowAdd(false)}
            className="font-mono-nu text-[9px] text-nu-muted mt-2 bg-transparent border-none cursor-pointer underline"
          >
            닫기
          </button>
        </div>
      )}
    </section>
  );
}
