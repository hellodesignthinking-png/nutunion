"use client";

/**
 * UnifiedTasks — 개인 할일 + 내 볼트 할일 + 미배정 리더 할일을 하나로 통합.
 * TODAY / OVERDUE / UPCOMING 섹션. 체크박스로 완료 토글.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckSquare,
  Square,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar as CalIcon,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Source = "personal" | "bolt" | "bolt_leader";

interface Row {
  key: string;
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  source: Source;
  projectTitle?: string | null;
  projectId?: string | null;
  projectHref?: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function UnifiedTasks() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);

  // add form state
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [memo, setMemo] = useState("");
  const [link, setLink] = useState<"personal" | string>("personal"); // projectId or "personal"
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const combined: Row[] = [];

      // 1) personal_tasks
      const personalRes = await fetch("/api/personal/tasks?limit=100", { cache: "no-store" });
      if (personalRes.ok) {
        const j = await personalRes.json();
        for (const t of j.rows || []) {
          if (t.status === "done") continue;
          combined.push({
            key: `p-${t.id}`,
            id: t.id,
            title: t.title,
            status: t.status,
            due_date: t.due_date,
            source: "personal",
          });
        }
      }

      // 2) 내 볼트 — 할당된 task
      const { data: boltTasks } = await supabase
        .from("project_tasks")
        .select("id, title, status, due_date, assigned_to, milestone:project_milestones(project:projects(id, title))")
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(50);
      for (const t of (boltTasks as any[]) || []) {
        const p = t.milestone?.project;
        combined.push({
          key: `b-${t.id}`,
          id: t.id,
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          source: "bolt",
          projectTitle: p?.title,
          projectId: p?.id,
          projectHref: p?.id ? `/projects/${p.id}` : null,
        });
      }

      // 3) 내가 만든 볼트의 미배정 태스크 (리더)
      const { data: myProjects } = await supabase
        .from("projects")
        .select("id, title")
        .eq("created_by", user.id);
      setProjects([
        ...((myProjects as any[]) || []).map((p) => ({ id: p.id, title: p.title })),
      ]);
      const myProjectIds = ((myProjects as any[]) || []).map((p) => p.id);
      if (myProjectIds.length > 0) {
        const { data: unassigned } = await supabase
          .from("project_tasks")
          .select("id, title, status, due_date, project_id")
          .in("project_id", myProjectIds)
          .is("assigned_to", null)
          .in("status", ["todo", "in_progress"])
          .order("due_date", { ascending: true })
          .limit(30);
        for (const t of (unassigned as any[]) || []) {
          const proj = (myProjects as any[]).find((p) => p.id === t.project_id);
          combined.push({
            key: `bl-${t.id}`,
            id: t.id,
            title: t.title,
            status: t.status,
            due_date: t.due_date,
            source: "bolt_leader",
            projectTitle: proj?.title,
            projectId: proj?.id,
            projectHref: proj?.id ? `/projects/${proj.id}` : null,
          });
        }
      }

      setRows(combined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { overdue, today, upcoming } = useMemo(() => {
    const t = todayStr();
    const o: Row[] = [];
    const td: Row[] = [];
    const up: Row[] = [];
    for (const r of rows) {
      if (!r.due_date) { up.push(r); continue; }
      if (r.due_date < t) o.push(r);
      else if (r.due_date === t) td.push(r);
      else if (r.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) up.push(r);
      else up.push(r);
    }
    const byDue = (a: Row, b: Row) =>
      (a.due_date || "9999").localeCompare(b.due_date || "9999");
    o.sort(byDue); td.sort(byDue); up.sort(byDue);
    return { overdue: o, today: td, upcoming: up };
  }, [rows]);

  async function toggle(r: Row) {
    // optimistic remove (완료)
    setRows((prev) => prev.filter((x) => x.key !== r.key));
    try {
      if (r.source === "personal") {
        await fetch("/api/personal/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.id, patch: { status: "done" } }),
        });
      } else {
        const supabase = createClient();
        const { error } = await supabase.from("project_tasks").update({ status: "done" }).eq("id", r.id);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error("완료 실패: " + (err?.message || err));
      load();
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      if (link === "personal") {
        const res = await fetch("/api/personal/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            due_date: due || null,
            description: memo.trim() || null,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      } else {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("로그인 필요");
        // 첫 milestone 찾거나 생성
        const { data: ms } = await supabase
          .from("project_milestones")
          .select("id")
          .eq("project_id", link)
          .order("sort_order")
          .limit(1)
          .maybeSingle();
        let milestoneId = (ms as { id: string } | null)?.id;
        if (!milestoneId) {
          const { data: newMs } = await supabase
            .from("project_milestones")
            .insert({ project_id: link, title: "기본 마일스톤", status: "in_progress", sort_order: 1 })
            .select("id").single();
          milestoneId = (newMs as { id: string } | null)?.id;
        }
        if (!milestoneId) throw new Error("마일스톤 생성 실패");
        const { error } = await supabase.from("project_tasks").insert({
          milestone_id: milestoneId,
          title: title.trim(),
          status: "todo",
          assigned_to: user.id,
          due_date: due || null,
        });
        if (error) throw error;
      }
      setTitle(""); setDue(""); setMemo(""); setLink("personal");
      setFormOpen(false);
      await load();
      toast.success("할 일 추가됨");
    } catch (err: any) {
      toast.error(err?.message || "추가 실패");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="border-[2px] border-nu-ink bg-nu-paper">
      <header className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[11px] uppercase tracking-[0.25em] text-nu-ink font-bold">
            통합 할 일
          </span>
          {rows.length > 0 && (
            <span className="font-mono-nu text-[10px] text-nu-graphite">({rows.length})</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="h-7 px-2 border-[1.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1"
        >
          {formOpen ? <X size={11} /> : <Plus size={11} />}
          {formOpen ? "닫기" : "할 일 추가"}
        </button>
      </header>

      {formOpen && (
        <form onSubmit={addTask} className="p-3 border-b-[2px] border-nu-ink/10 bg-nu-cream/20 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일 제목"
            className="w-full px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[13px]"
            required
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[11px] font-mono-nu tabular-nums"
              title="마감일"
            />
            <select
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[11px] font-mono-nu"
            >
              <option value="personal">개인</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>볼트: {p.title}</option>
              ))}
            </select>
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            className="w-full px-2 py-1.5 border-[1.5px] border-nu-ink bg-nu-paper text-[12px]"
          />
          <button
            type="submit"
            disabled={adding || !title.trim()}
            className="h-8 px-3 bg-nu-pink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-40 inline-flex items-center gap-1"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            등록
          </button>
        </form>
      )}

      <div className="p-3 space-y-3 max-h-[440px] overflow-auto">
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 size={16} className="animate-spin inline-block text-nu-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-nu-graphite">
            <p>남은 할 일이 없어요 ✨</p>
            <p className="mt-1 text-[11px] text-nu-muted">위의 AI 비서에게 자유롭게 말해보세요</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <Section title="지연" accent="red" count={overdue.length}>
                {overdue.map((r) => (
                  <TaskRow key={r.key} row={r} onToggle={toggle} overdue />
                ))}
              </Section>
            )}
            {today.length > 0 && (
              <Section title="오늘" accent="pink" count={today.length}>
                {today.map((r) => (
                  <TaskRow key={r.key} row={r} onToggle={toggle} today />
                ))}
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section title="앞으로" accent="ink" count={upcoming.length}>
                {upcoming.map((r) => (
                  <TaskRow key={r.key} row={r} onToggle={toggle} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Section({
  title, count, accent, children,
}: { title: string; count: number; accent: "red" | "pink" | "ink"; children: React.ReactNode }) {
  const cls = accent === "red"
    ? "text-red-600 border-red-300"
    : accent === "pink"
    ? "text-nu-pink border-nu-pink/40"
    : "text-nu-graphite border-nu-ink/20";
  return (
    <div>
      <div className={`font-mono-nu text-[9px] uppercase tracking-[0.25em] font-bold ${cls} border-b pb-1 mb-1.5 flex items-center gap-1`}>
        <span>{title}</span>
        <span className="text-nu-muted">({count})</span>
      </div>
      <ul className="space-y-0.5 list-none p-0 m-0">{children}</ul>
    </div>
  );
}

function TaskRow({
  row, onToggle, overdue, today,
}: { row: Row; onToggle: (r: Row) => void; overdue?: boolean; today?: boolean }) {
  const srcLabel = row.source === "personal" ? "개인"
    : row.source === "bolt_leader" ? "리더"
    : row.projectTitle ? `볼트:${row.projectTitle}` : "볼트";
  const srcCls = row.source === "personal"
    ? "bg-nu-ink/5 text-nu-graphite"
    : row.source === "bolt_leader"
    ? "bg-amber-50 text-amber-700"
    : "bg-purple-50 text-purple-600";
  return (
    <li className="group flex items-start gap-2 px-2 py-1.5 hover:bg-nu-cream/30">
      <button
        onClick={() => onToggle(row)}
        className="mt-0.5 shrink-0 text-nu-ink/40 hover:text-green-500"
        aria-label="완료"
      >
        <Square size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-nu-ink truncate">{row.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`font-mono-nu text-[9px] uppercase px-1 py-px truncate max-w-[140px] ${srcCls}`}>
            {srcLabel}
          </span>
          {row.projectHref && row.source !== "personal" && (
            <Link href={row.projectHref} className="font-mono-nu text-[9px] text-indigo-500 hover:underline no-underline truncate max-w-[100px]">
              {row.projectTitle}
            </Link>
          )}
          {row.due_date && (
            <span className={`font-mono-nu text-[10px] tabular-nums inline-flex items-center gap-0.5 ${
              overdue ? "text-red-600 font-bold" : today ? "text-nu-pink font-bold" : "text-nu-muted"
            }`}>
              {overdue && <AlertTriangle size={9} />}
              <CalIcon size={9} />
              {new Date(row.due_date + "T00:00:00").toLocaleDateString("ko", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
