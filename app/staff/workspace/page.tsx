"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FolderOpen, Plus, Users, CheckSquare, Clock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function StaffProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, { todo: number; in_progress: number; done: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: projData } = await supabase
        .from("staff_projects")
        .select("*, creator:profiles!staff_projects_created_by_fkey(nickname, avatar_url)")
        .order("updated_at", { ascending: false });

      const projects = projData || [];
      setProjects(projects);

      const projectIds = projects.map(p => p.id);
      if (projectIds.length > 0) {
        const [{ data: members }, { data: tasks }] = await Promise.all([
          supabase.from("staff_project_members").select("project_id").in("project_id", projectIds),
          supabase.from("staff_tasks").select("project_id, status").in("project_id", projectIds),
        ]);

        const mc: Record<string, number> = {};
        (members || []).forEach((m: any) => { mc[m.project_id] = (mc[m.project_id] || 0) + 1; });
        setMemberCounts(mc);

        const tc: Record<string, { todo: number; in_progress: number; done: number }> = {};
        (tasks || []).forEach((t: any) => {
          if (!tc[t.project_id]) tc[t.project_id] = { todo: 0, in_progress: 0, done: 0 };
          if (t.status in tc[t.project_id]) (tc[t.project_id] as any)[t.status]++;
        });
        setTaskCounts(tc);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") result = result.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, statusFilter, search]);

  const statusLabel: Record<string, { text: string; color: string }> = {
    active: { text: "진행중", color: "bg-green-100 text-green-700" },
    completed: { text: "완료", color: "bg-blue-100 text-blue-700" },
    archived: { text: "보관", color: "bg-gray-100 text-gray-500" },
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="h-8 w-40 bg-nu-ink/8 animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white border border-nu-ink/[0.06] animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">프로젝트</h1>
          <p className="font-mono-nu text-[13px] text-nu-muted mt-1 uppercase tracking-widest">
            Internal Projects · {filtered.length}개
          </p>
        </div>
        <Link
          href="/staff/workspace/create"
          className="inline-flex items-center gap-2 font-mono-nu text-[13px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white no-underline hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> <span className="hidden sm:inline">새 프로젝트</span><span className="sm:hidden">추가</span>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="프로젝트명, 설명 검색..."
            className="pl-9 border-nu-ink/15 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer p-0" aria-label="검색 초기화">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(["active", "completed", "archived", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 border transition-colors cursor-pointer ${
                statusFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
              }`}
            >
              {s === "active" ? "진행중" : s === "completed" ? "완료" : s === "archived" ? "보관" : "전체"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p: any) => {
            const sl = statusLabel[p.status] || statusLabel.active;
            const tc = taskCounts[p.id] || { todo: 0, in_progress: 0, done: 0 };
            const totalTasks = tc.todo + tc.in_progress + tc.done;
            const progress = totalTasks > 0 ? Math.round((tc.done / totalTasks) * 100) : 0;

            return (
              <Link
                key={p.id}
                href={`/staff/workspace/${p.id}`}
                className="block bg-white border border-nu-ink/[0.06] p-6 hover:border-indigo-200 hover:shadow-sm transition-all no-underline group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 ${sl.color}`}>
                    {sl.text}
                  </span>
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 bg-indigo-50 text-indigo-600">
                    {p.category || "general"}
                  </span>
                </div>
                <h3 className="font-head text-base font-bold text-nu-ink group-hover:text-indigo-600 transition-colors mb-2">{p.title}</h3>
                {p.description && (
                  <p className="text-xs text-nu-muted line-clamp-2 mb-4">{p.description}</p>
                )}
                {totalTasks > 0 && (
                  <div className="mb-3">
                    <div className="h-1 bg-nu-ink/5 w-full">
                      <div className="h-1 bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="font-mono-nu text-[10px] text-nu-muted mt-1">{progress}% 완료 ({tc.done}/{totalTasks})</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-nu-muted">
                  <span className="flex items-center gap-1 font-mono-nu text-[11px]">
                    <Users size={11} /> {memberCounts[p.id] || 0}
                  </span>
                  <span className="flex items-center gap-1 font-mono-nu text-[11px]">
                    <CheckSquare size={11} /> {totalTasks}
                  </span>
                  <span className="flex items-center gap-1 font-mono-nu text-[11px]">
                    <Clock size={11} /> {new Date(p.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-nu-ink/10 p-16 text-center bg-white/50">
          <FolderOpen size={48} className="mx-auto mb-4 text-nu-ink/15" />
          {search || statusFilter !== "active" ? (
            <>
              <p className="text-sm text-nu-muted mb-2">검색 결과가 없습니다</p>
              <button
                onClick={() => { setSearch(""); setStatusFilter("active"); }}
                className="font-mono-nu text-[12px] text-indigo-600 underline bg-transparent border-none cursor-pointer"
              >
                필터 초기화
              </button>
            </>
          ) : (
            <>
              <p className="text-nu-muted text-sm mb-4">아직 내부 프로젝트가 없습니다</p>
              <Link href="/staff/workspace/create" className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 bg-indigo-600 text-white no-underline hover:bg-indigo-700 inline-flex items-center gap-1.5">
                <Plus size={12} /> 첫 프로젝트 만들기
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
