"use client";

/**
 * PersonalTodos — 개인 대시보드용 할일 위젯.
 * 빠른 추가 + 체크박스 토글 + 기한 표시 + 오늘/내일/기한 임박 필터.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckSquare,
  Square,
  Plus,
  Calendar as CalendarIcon,
  Loader2,
  Trash2,
  ChevronRight,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project_id?: string | null;
  group_id?: string | null;
}

export function PersonalTodos({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"active" | "today" | "all">("active");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/personal/tasks?limit=50`, { cache: "no-store" });
      const json = await res.json();
      setTasks(json.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/personal/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), due_date: dueDate || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      setTitle("");
      setDueDate("");
      inputRef.current?.focus();
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(t: Task) {
    const next = t.status === "done" ? "todo" : "done";
    // optimistic
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await fetch("/api/personal/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, patch: { status: next } }),
      });
    } catch {
      // rollback
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
      toast.error("상태 변경 실패");
    }
  }

  async function removeTask(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    try {
      await fetch(`/api/personal/tasks?id=${id}`, { method: "DELETE" });
    } catch {
      toast.error("삭제 실패");
      load();
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (filter === "active") return t.status !== "done";
    if (filter === "today") return t.due_date === today && t.status !== "done";
    return true;
  });
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <section className="border border-nu-ink/[0.08] bg-white rounded-[var(--ds-radius-lg)] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/[0.08] bg-nu-cream/10">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-ink font-bold">
            My Todos
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["active", "today", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono-nu uppercase tracking-widest px-1.5 py-0.5 rounded ${
                filter === f ? "bg-nu-ink text-white" : "text-nu-graphite hover:bg-nu-ink/5"
              }`}
            >
              {f === "active" ? "진행" : f === "today" ? "오늘" : "전체"}
            </button>
          ))}
        </div>
      </header>

      {/* 빠른 추가 */}
      <form onSubmit={addTask} className="flex items-center gap-1.5 p-3 border-b border-nu-ink/[0.05]">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할일을 빠르게 추가…"
          className="flex-1 px-2 py-1.5 border border-nu-ink/10 rounded text-[13px] focus:border-nu-pink outline-none"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="px-2 py-1.5 border border-nu-ink/10 rounded text-[11px] font-mono-nu tabular-nums"
          title="기한"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="p-1.5 bg-nu-ink text-white rounded hover:bg-nu-pink disabled:opacity-40"
          aria-label="추가"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </form>

      {/* 리스트 */}
      <ul className="divide-y divide-nu-ink/[0.05] max-h-[360px] overflow-auto">
        {loading ? (
          <li className="p-4 text-center">
            <Loader2 size={14} className="animate-spin inline-block text-nu-muted" />
          </li>
        ) : filtered.length === 0 ? (
          <li className="p-6 text-center text-[12px] text-nu-graphite">
            {filter === "today"
              ? "오늘 기한 할일이 없어요 ☕"
              : filter === "active"
                ? "남은 할일이 없어요 ✨"
                : "할일이 없어요"}
          </li>
        ) : (
          filtered.map((t) => (
            <li key={t.id} className="group flex items-start gap-2 p-2.5 hover:bg-nu-cream/20">
              <button
                onClick={() => toggle(t)}
                aria-label={t.status === "done" ? "완료 해제" : "완료"}
                className="mt-0.5 shrink-0 text-nu-pink hover:scale-110 transition-transform"
              >
                {t.status === "done" ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] leading-[1.4] ${
                    t.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"
                  }`}
                >
                  {t.title}
                </div>
                {t.due_date && (
                  <div
                    className={`inline-flex items-center gap-1 text-[10px] font-mono-nu tabular-nums mt-0.5 ${
                      t.due_date < today && t.status !== "done"
                        ? "text-nu-pink font-bold"
                        : "text-nu-muted"
                    }`}
                  >
                    <CalendarIcon size={9} />
                    {new Date(t.due_date + "T00:00:00").toLocaleDateString("ko", {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    })}
                    {t.due_date < today && t.status !== "done" && <span>· 지남</span>}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeTask(t.id)}
                className="opacity-0 group-hover:opacity-100 text-nu-muted hover:text-red-500 p-1"
                aria-label="삭제"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* Footer */}
      {!compact && tasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-nu-ink/[0.05] text-[10px] font-mono-nu text-nu-muted tabular-nums">
          <span>
            진행 {tasks.filter((t) => t.status !== "done").length} · 완료 {doneCount}
          </span>
          <a href="/tasks" className="inline-flex items-center gap-0.5 hover:text-nu-ink">
            전체 보기 <ChevronRight size={10} />
          </a>
        </div>
      )}
    </section>
  );
}
