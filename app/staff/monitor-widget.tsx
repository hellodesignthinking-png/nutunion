"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown,
  Users, FolderOpen, Zap, ChevronRight, Clock
} from "lucide-react";
import Link from "next/link";

interface ProjectHealth {
  id: string;
  title: string;
  type: "staff" | "bolt" | "nut"; // bolt=커뮤니티 프로젝트, nut=소모임
  status: string;
  memberCount: number;
  taskTotal: number;
  taskDone: number;
  taskOverdue: number;
  recentActivityCount: number; // 최근 7일 활동수
  lastActivityAt: string | null;
  href: string;
}

type HealthLevel = "healthy" | "warning" | "danger" | "inactive";

function getHealthLevel(p: ProjectHealth): HealthLevel {
  // 7일간 활동 없으면 inactive
  if (p.recentActivityCount === 0 && p.lastActivityAt) {
    const daysSince = (Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000;
    if (daysSince > 14) return "danger";
    if (daysSince > 7) return "warning";
  }
  if (p.recentActivityCount === 0) return "inactive";
  if (p.taskOverdue > 2) return "danger";
  if (p.taskOverdue > 0) return "warning";
  return "healthy";
}

const healthConfig: Record<HealthLevel, { color: string; bg: string; border: string; label: string; icon: any }> = {
  healthy: { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "활발", icon: TrendingUp },
  warning: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", label: "주의", icon: AlertTriangle },
  danger: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "위험", icon: AlertTriangle },
  inactive: { color: "text-nu-muted", bg: "bg-nu-ink/[0.02]", border: "border-nu-ink/10", label: "비활성", icon: TrendingDown },
};

export function MonitorWidget() {
  const [projects, setProjects] = useState<ProjectHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "staff" | "bolt" | "nut">("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // 스태프 프로젝트
      const [
        { data: staffProjects },
        { data: staffTasks },
        { data: staffActivity },
        { data: staffMembers },
      ] = await Promise.all([
        supabase.from("staff_projects").select("id, title, status, updated_at").eq("status", "active"),
        supabase.from("staff_tasks").select("id, project_id, status, due_date"),
        supabase.from("staff_activity").select("id, project_id, created_at").gte("created_at", sevenDaysAgo),
        supabase.from("staff_project_members").select("id, project_id"),
      ]);

      // 볼트(커뮤니티 프로젝트)
      const [
        { data: boltProjects },
        { data: boltTasks },
        { data: boltMembers },
      ] = await Promise.all([
        supabase.from("projects").select("id, title, status, updated_at").eq("status", "active"),
        supabase.from("project_tasks").select("id, project_id, status, due_date, milestone:project_milestones(project_id)"),
        supabase.from("project_members").select("id, project_id"),
      ]);

      // 너트(소모임)
      const [
        { data: nutGroups },
        { data: nutMembers },
      ] = await Promise.all([
        supabase.from("crews").select("id, name, status, updated_at").eq("status", "active"),
        supabase.from("crew_members").select("id, crew_id"),
      ]);

      const todayStr = new Date().toISOString().split("T")[0];
      const result: ProjectHealth[] = [];

      // 스태프 프로젝트 건강 데이터
      for (const sp of (staffProjects || [])) {
        const tasks = (staffTasks || []).filter(t => t.project_id === sp.id);
        const done = tasks.filter(t => t.status === "done").length;
        const overdue = tasks.filter(t => t.status !== "done" && t.due_date && t.due_date < todayStr).length;
        const activities = (staffActivity || []).filter(a => a.project_id === sp.id);
        const members = (staffMembers || []).filter(m => m.project_id === sp.id);
        const lastAct = activities.length > 0
          ? activities.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
          : sp.updated_at;

        result.push({
          id: sp.id, title: sp.title, type: "staff", status: sp.status,
          memberCount: members.length, taskTotal: tasks.length, taskDone: done,
          taskOverdue: overdue, recentActivityCount: activities.length,
          lastActivityAt: lastAct, href: `/staff/workspace/${sp.id}`,
        });
      }

      // 볼트 프로젝트 건강 데이터
      for (const bp of (boltProjects || [])) {
        const tasks = (boltTasks || []).filter(t => {
          const pid = (t.milestone as any)?.project_id || t.project_id;
          return pid === bp.id;
        });
        const done = tasks.filter(t => t.status === "done").length;
        const overdue = tasks.filter(t => t.status !== "done" && t.due_date && t.due_date < todayStr).length;
        const members = (boltMembers || []).filter(m => m.project_id === bp.id);

        result.push({
          id: bp.id, title: bp.title, type: "bolt", status: bp.status,
          memberCount: members.length, taskTotal: tasks.length, taskDone: done,
          taskOverdue: overdue, recentActivityCount: 0, // 볼트는 별도 활동 로그 없음
          lastActivityAt: bp.updated_at, href: `/projects/${bp.id}`,
        });
      }

      // 너트(소모임) 건강 데이터
      for (const ng of (nutGroups || [])) {
        const members = (nutMembers || []).filter(m => m.crew_id === ng.id);

        result.push({
          id: ng.id, title: ng.name, type: "nut", status: ng.status,
          memberCount: members.length, taskTotal: 0, taskDone: 0,
          taskOverdue: 0, recentActivityCount: 0,
          lastActivityAt: ng.updated_at, href: `/groups/${ng.id}`,
        });
      }

      // 건강 수준 기준 정렬: danger > warning > inactive > healthy
      const healthOrder: Record<HealthLevel, number> = { danger: 0, warning: 1, inactive: 2, healthy: 3 };
      result.sort((a, b) => healthOrder[getHealthLevel(a)] - healthOrder[getHealthLevel(b)]);

      setProjects(result);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? projects : projects.filter(p => p.type === filter);

  const summary = {
    total: projects.length,
    healthy: projects.filter(p => getHealthLevel(p) === "healthy").length,
    warning: projects.filter(p => getHealthLevel(p) === "warning").length,
    danger: projects.filter(p => getHealthLevel(p) === "danger").length,
    inactive: projects.filter(p => getHealthLevel(p) === "inactive").length,
  };

  if (loading) {
    return (
      <section className="bg-white border border-nu-ink/[0.06]">
        <div className="p-4 border-b border-nu-ink/5">
          <div className="h-4 w-32 bg-nu-ink/8 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-nu-ink/5 animate-pulse" />)}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
          <Activity size={18} className="text-indigo-600" /> 프로젝트 모니터링
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-green-50 border border-green-200 p-3 text-center">
          <p className="font-head text-xl font-extrabold text-green-600">{summary.healthy}</p>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-green-600">활발</p>
        </div>
        <div className={`border p-3 text-center ${summary.warning > 0 ? "bg-yellow-50 border-yellow-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className={`font-head text-xl font-extrabold ${summary.warning > 0 ? "text-yellow-600" : "text-nu-muted"}`}>{summary.warning}</p>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">주의</p>
        </div>
        <div className={`border p-3 text-center ${summary.danger > 0 ? "bg-red-50 border-red-200" : "bg-white border-nu-ink/[0.06]"}`}>
          <p className={`font-head text-xl font-extrabold ${summary.danger > 0 ? "text-red-600" : "text-nu-muted"}`}>{summary.danger}</p>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">위험</p>
        </div>
        <div className="bg-white border border-nu-ink/[0.06] p-3 text-center">
          <p className="font-head text-xl font-extrabold text-nu-muted">{summary.inactive}</p>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">비활성</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-3">
        {([
          { key: "all", label: "전체" },
          { key: "staff", label: "스태프" },
          { key: "bolt", label: "볼트" },
          { key: "nut", label: "너트" },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 border cursor-pointer transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-transparent text-nu-muted border-nu-ink/15 hover:border-indigo-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Project list */}
      <div className="space-y-2">
        {filtered.map(p => {
          const health = getHealthLevel(p);
          const config = healthConfig[health];
          const progress = p.taskTotal > 0 ? Math.round((p.taskDone / p.taskTotal) * 100) : 0;
          const daysSinceActivity = p.lastActivityAt
            ? Math.floor((Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000)
            : null;

          return (
            <Link
              key={`${p.type}-${p.id}`}
              href={p.href}
              className={`block px-4 py-3 border transition-colors no-underline ${config.border} ${config.bg} hover:opacity-80`}
            >
              <div className="flex items-center gap-3">
                {/* Health indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  health === "healthy" ? "bg-green-500" :
                  health === "warning" ? "bg-yellow-500" :
                  health === "danger" ? "bg-red-500 animate-pulse" :
                  "bg-nu-muted/30"
                }`} />

                {/* Type badge */}
                <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${
                  p.type === "staff" ? "bg-indigo-100 text-indigo-600" :
                  p.type === "bolt" ? "bg-purple-100 text-purple-600" :
                  "bg-amber-100 text-amber-600"
                }`}>
                  {p.type === "staff" ? "스태프" : p.type === "bolt" ? "볼트" : "너트"}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-head text-sm font-bold text-nu-ink truncate">{p.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-0.5">
                      <Users size={9} /> {p.memberCount}
                    </span>
                    {p.taskTotal > 0 && (
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        {p.taskDone}/{p.taskTotal} 완료
                      </span>
                    )}
                    {p.taskOverdue > 0 && (
                      <span className="font-mono-nu text-[10px] text-red-600 font-bold flex items-center gap-0.5">
                        <AlertTriangle size={8} /> {p.taskOverdue} 지연
                      </span>
                    )}
                    {daysSinceActivity !== null && daysSinceActivity > 3 && (
                      <span className="font-mono-nu text-[10px] text-nu-muted/60 flex items-center gap-0.5">
                        <Clock size={8} /> {daysSinceActivity}일 전
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {p.taskTotal > 0 && (
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 bg-nu-ink/5 w-full">
                      <div className={`h-1.5 transition-all ${
                        health === "danger" ? "bg-red-500" :
                        health === "warning" ? "bg-yellow-500" :
                        "bg-green-500"
                      }`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className="font-mono-nu text-[9px] text-nu-muted text-right mt-0.5">{progress}%</p>
                  </div>
                )}

                {/* Health badge */}
                <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 shrink-0 ${config.color} ${config.bg}`}>
                  {config.label}
                </span>

                <ChevronRight size={12} className="text-nu-muted shrink-0" />
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="border-2 border-dashed border-nu-ink/10 p-8 text-center bg-white/50">
            <p className="font-mono-nu text-[12px] text-nu-muted">해당하는 프로젝트가 없습니다</p>
          </div>
        )}
      </div>
    </section>
  );
}
