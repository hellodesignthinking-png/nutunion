"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Trash2, Search, Filter, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ProjectStatus } from "@/lib/types";

interface ProjectItem {
  id: string;
  title: string;
  category: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  creator_nickname: string;
  member_count: number;
  crew_count: number;
  milestone_count: number;
  milestone_completed: number;
  task_total: number;
  task_done: number;
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const catLabels: Record<string, string> = {
  space: "공간",
  culture: "문화",
  platform: "플랫폼",
  vibe: "바이브",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-nu-gray" },
  active: { label: "Active", color: "text-green-600" },
  completed: { label: "Completed", color: "text-nu-blue" },
  archived: { label: "Archived", color: "text-nu-muted" },
};

const allStatuses: ProjectStatus[] = ["draft", "active", "completed", "archived"];

export function AdminProjectList({ projects }: { projects: ProjectItem[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.creator_nickname.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [projects, searchQuery, statusFilter, categoryFilter]);

  async function changeStatus(projectId: string, newStatus: ProjectStatus) {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`상태가 ${newStatus}로 변경되었습니다`);
    router.refresh();
  }

  async function handleDelete(projectId: string, title: string) {
    if (!confirm(`"${title}" 프로젝트를 완전히 삭제하시겠습니까?\n\n모든 마일스톤, 태스크, 회의, 자료, 멤버 데이터가 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;

    const supabase = createClient();

    // Delete meeting notes for project meetings
    try {
      const { data: meetings } = await supabase.from("meetings").select("id").eq("project_id", projectId);
      const meetingIds = (meetings || []).map((m: any) => m.id);
      if (meetingIds.length > 0) {
        await supabase.from("meeting_notes").delete().in("meeting_id", meetingIds);
        await supabase.from("meeting_agendas").delete().in("meeting_id", meetingIds);
      }
    } catch { /* tables may not exist */ }

    // Delete related tables — each in try/catch for resilience
    const tablesToClean = [
      "project_tasks",
      "project_resources",
      "project_milestones",
      "project_updates",
      "project_action_items",
      "project_applications",
      "project_members",
      "project_financial_records",
    ];

    for (const table of tablesToClean) {
      try {
        await supabase.from(table).delete().eq("project_id", projectId);
      } catch { /* table may not exist */ }
    }

    // Delete project meetings
    try {
      await supabase.from("meetings").delete().eq("project_id", projectId);
    } catch { /* project_id column may not exist on meetings */ }

    // Finally delete the project
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }
    toast.success("프로젝트가 완전히 삭제되었습니다");
    router.refresh();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ko", {
      month: "short",
      day: "numeric",
    });
  }

  function progressBar(done: number, total: number) {
    if (total === 0) return null;
    const pct = Math.round((done / total) * 100);
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-nu-ink/5 overflow-hidden">
          <div
            className="h-full bg-nu-blue transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono-nu text-[12px] text-nu-muted">{pct}%</span>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            placeholder="프로젝트 이름 또는 생성자로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 appearance-none cursor-pointer"
          >
            <option value="all">전체 상태</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{statusLabels[s].label}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 appearance-none cursor-pointer"
          >
            <option value="all">전체 카테고리</option>
            {["space", "culture", "platform", "vibe"].map((c) => (
              <option key={c} value={c}>{catLabels[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-3">
        {filteredProjects.length}개 표시 / 전체 {projects.length}개
      </p>

      <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
        {/* Desktop table */}
        <table className="w-full hidden md:table" role="table">
          <thead>
            <tr className="border-b border-nu-ink/[0.08]">
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">프로젝트</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">카테고리</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">상태</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">생성자</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">멤버</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">진행률</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">기간</th>
              <th className="text-left px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => {
              const statusInfo = statusLabels[p.status] || statusLabels.draft;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-nu-ink/[0.04] last:border-0 text-sm ${p.status === "archived" ? "opacity-50" : ""}`}
                >
                  <td className="px-5 py-3 font-medium truncate max-w-[200px]">{p.title}</td>
                  <td className="px-5 py-3">
                    {p.category ? (
                      <span className={`inline-block font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${catColors[p.category] || "bg-nu-gray"}`}>
                        {catLabels[p.category] || p.category}
                      </span>
                    ) : (
                      <span className="text-nu-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p.id, e.target.value as ProjectStatus)}
                      className={`font-mono-nu text-[12px] uppercase tracking-widest bg-transparent border-none focus:outline-none cursor-pointer ${statusInfo.color}`}
                    >
                      {allStatuses.map((s) => (
                        <option key={s} value={s}>{statusLabels[s].label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-nu-muted truncate max-w-[120px]">{p.creator_nickname}</td>
                  <td className="px-5 py-3">
                    <div className="font-mono-nu text-[13px]">
                      <span>{p.member_count}명</span>
                      {p.crew_count > 0 && (
                        <span className="text-nu-muted ml-1">+{p.crew_count}크루</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-1">
                      {p.milestone_count > 0 && (
                        <div className="font-mono-nu text-[12px] text-nu-muted">
                          MS {p.milestone_completed}/{p.milestone_count}
                        </div>
                      )}
                      {progressBar(p.task_done, p.task_total)}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono-nu text-[12px] text-nu-muted">
                    {formatDate(p.start_date)} ~ {formatDate(p.end_date)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-nu-muted hover:text-nu-ink transition-colors p-1"
                        title="상세보기"
                      >
                        <ExternalLink size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.title)}
                        className="text-nu-red hover:text-red-700 transition-colors p-1"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-nu-ink/[0.06]">
          {filteredProjects.map((p) => {
            const statusInfo = statusLabels[p.status] || statusLabels.draft;
            return (
              <div
                key={p.id}
                className={`p-4 ${p.status === "archived" ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.category && (
                      <span className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 text-white shrink-0 ${catColors[p.category] || "bg-nu-gray"}`}>
                        {catLabels[p.category] || p.category}
                      </span>
                    )}
                    <span className="font-medium text-sm truncate">{p.title}</span>
                  </div>
                  <span className={`font-mono-nu text-[11px] uppercase tracking-widest shrink-0 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="text-xs text-nu-muted mb-2">
                  {p.creator_nickname} | {p.member_count}명{p.crew_count > 0 ? ` +${p.crew_count}크루` : ""} | {formatDate(p.start_date)} ~ {formatDate(p.end_date)}
                </div>
                {p.task_total > 0 && (
                  <div className="mb-2">{progressBar(p.task_done, p.task_total)}</div>
                )}
                <div className="flex items-center justify-between">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink"
                  >
                    상세보기
                  </Link>
                  <div className="flex items-center gap-2">
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p.id, e.target.value as ProjectStatus)}
                      className="font-mono-nu text-[11px] uppercase tracking-widest bg-transparent border border-nu-ink/10 px-2 py-1 focus:outline-none"
                    >
                      {allStatuses.map((s) => (
                        <option key={s} value={s}>{statusLabels[s].label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDelete(p.id, p.title)}
                      className="text-nu-red hover:text-red-700 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
