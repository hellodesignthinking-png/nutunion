"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Layers,
  Zap,
  Target,
  Activity,
  Loader2,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

/* ─── Types ─── */
interface InsightsData {
  // Task metrics
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  overdueTasks: number;
  completionRate: number;
  // Milestone metrics
  totalMilestones: number;
  completedMilestones: number;
  activeMilestones: number;
  milestoneCompletionRate: number;
  // Team metrics
  totalMembers: number;
  activeMembersThisWeek: number;
  topContributors: { nickname: string; tasksDone: number }[];
  unassignedTasks: number;
  // Velocity
  tasksCompletedThisWeek: number;
  tasksCompletedLastWeek: number;
  avgTasksPerWeek: number;
  velocityTrend: "up" | "down" | "stable";
  // Health
  healthScore: number;
  riskFactors: string[];
  // Timeline
  daysLeft: number | null;
  daysElapsed: number | null;
  estimatedCompletion: string | null;
  // Resources & Finance
  totalResources: number;
  totalBudgetUsed: number;
  totalBudget: number;
}

/* ─── Main Component ─── */
export function ProjectInsights({
  projectId,
  totalBudget = 0,
}: {
  projectId: string;
  totalBudget?: number;
}) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    const supabase = createClient();

    const [
      tasksRes,
      msRes,
      membersRes,
      resourcesRes,
      financeRes,
      projectRes,
      updatesRes,
    ] = await Promise.allSettled([
      supabase.from("project_tasks").select("id, status, assigned_to, due_date, created_at").eq("project_id", projectId),
      supabase.from("project_milestones").select("id, status, due_date").eq("project_id", projectId),
      supabase.from("project_members").select("user_id, crew_id, profile:profiles!project_members_user_id_fkey(nickname)").eq("project_id", projectId),
      supabase.from("project_resources").select("id").eq("project_id", projectId),
      supabase.from("project_finance").select("amount, type").eq("project_id", projectId),
      supabase.from("projects").select("start_date, end_date, total_budget").eq("id", projectId).single(),
      supabase.from("project_updates").select("id, author_id, created_at").eq("project_id", projectId),
    ]);

    const tasks = tasksRes.status === "fulfilled" ? tasksRes.value.data || [] : [];
    const milestones = msRes.status === "fulfilled" ? msRes.value.data || [] : [];
    const resources = resourcesRes.status === "fulfilled" ? resourcesRes.value.data || [] : [];
    const finance = financeRes.status === "fulfilled" ? financeRes.value.data || [] : [];
    const project = projectRes.status === "fulfilled" ? projectRes.value.data : null;
    const updates = updatesRes.status === "fulfilled" ? updatesRes.value.data || [] : [];

    // 멤버: 직접 등록 + crew(너트) 멤버 포함
    let members: any[] = [];
    if (membersRes.status === "fulfilled" && membersRes.value.data) {
      const pmData = membersRes.value.data as any[];
      members = pmData.filter((m: any) => m.user_id && m.profile);
      const crewIds = pmData.filter((m: any) => m.crew_id).map((m: any) => m.crew_id);
      if (crewIds.length > 0) {
        try {
          const { data: gmData } = await supabase
            .from("group_members")
            .select("user_id, profiles!group_members_user_id_fkey(nickname)")
            .in("group_id", crewIds)
            .eq("status", "active");
          if (gmData) {
            const existingIds = new Set(members.map((m: any) => m.user_id));
            for (const gm of gmData as any[]) {
              if (gm.user_id && gm.profiles && !existingIds.has(gm.user_id)) {
                members.push({ user_id: gm.user_id, profile: gm.profiles });
                existingIds.add(gm.user_id);
              }
            }
          }
        } catch { /* 무시 */ }
      }
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Task counts
    const todoTasks = tasks.filter((t: any) => t.status === "todo").length;
    const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;
    const doneTasks = tasks.filter((t: any) => t.status === "done").length;
    const overdueTasks = tasks.filter(
      (t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < now
    ).length;
    const unassignedTasks = tasks.filter((t: any) => !t.assigned_to && t.status !== "done").length;

    // Velocity (tasks completed this week vs last week)
    const tasksCompletedThisWeek = tasks.filter(
      (t: any) => t.status === "done" && new Date(t.created_at) >= oneWeekAgo
    ).length;
    const tasksCompletedLastWeek = tasks.filter(
      (t: any) =>
        t.status === "done" &&
        new Date(t.created_at) >= twoWeeksAgo &&
        new Date(t.created_at) < oneWeekAgo
    ).length;

    // Active members this week (anyone who created an update)
    const activeMembersThisWeek = new Set(
      updates
        .filter((u: any) => new Date(u.created_at) >= oneWeekAgo)
        .map((u: any) => u.author_id)
    ).size;

    // Top contributors
    const contributorMap: Record<string, number> = {};
    tasks.forEach((t: any) => {
      if (t.status === "done" && t.assigned_to) {
        contributorMap[t.assigned_to] = (contributorMap[t.assigned_to] || 0) + 1;
      }
    });
    const memberMap = Object.fromEntries(
      members.map((m: any) => [m.user_id, m.profile?.nickname || "알 수 없음"])
    );
    const topContributors = Object.entries(contributorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, count]) => ({ nickname: memberMap[uid] || "알 수 없음", tasksDone: count }));

    // Milestone stats
    const completedMilestones = milestones.filter((m: any) => m.status === "completed").length;
    const activeMilestones = milestones.filter((m: any) => m.status === "in_progress").length;

    // Finance
    const totalBudgetUsed = finance
      .filter((f: any) => f.type === "expense")
      .reduce((sum: number, f: any) => sum + Math.abs(f.amount), 0);

    // Timeline
    const startDate = project?.start_date ? new Date(project.start_date) : null;
    const endDate = project?.end_date ? new Date(project.end_date) : null;
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const daysElapsed = startDate ? Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    // Avg tasks per week
    const projectAgeWeeks = daysElapsed ? Math.max(1, Math.ceil(daysElapsed / 7)) : 1;
    const avgTasksPerWeek = Math.round((doneTasks / projectAgeWeeks) * 10) / 10;

    // Velocity trend
    let velocityTrend: "up" | "down" | "stable" = "stable";
    if (tasksCompletedThisWeek > tasksCompletedLastWeek + 1) velocityTrend = "up";
    else if (tasksCompletedThisWeek < tasksCompletedLastWeek - 1) velocityTrend = "down";

    // Estimated completion
    let estimatedCompletion: string | null = null;
    if (avgTasksPerWeek > 0 && todoTasks + inProgressTasks > 0) {
      const weeksLeft = Math.ceil((todoTasks + inProgressTasks) / avgTasksPerWeek);
      const estDate = new Date(now.getTime() + weeksLeft * 7 * 24 * 60 * 60 * 1000);
      estimatedCompletion = estDate.toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" });
    }

    // Health score (0-100)
    let healthScore = 50;
    const riskFactors: string[] = [];

    // Completion rate contributes up to 30
    const completionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
    healthScore += Math.round(completionRate * 0.3);

    // Overdue penalty
    if (overdueTasks > 0) {
      const overdueRatio = overdueTasks / Math.max(1, tasks.length - doneTasks);
      healthScore -= Math.round(overdueRatio * 20);
      riskFactors.push(`${overdueTasks}개 태스크가 기한을 초과했습니다`);
    }

    // Unassigned penalty
    if (unassignedTasks > 2) {
      healthScore -= 5;
      riskFactors.push(`${unassignedTasks}개 태스크에 담당자가 없습니다`);
    }

    // Velocity trend bonus/penalty
    if (velocityTrend === "up") healthScore += 5;
    else if (velocityTrend === "down") {
      healthScore -= 10;
      riskFactors.push("이번 주 완료 속도가 저번 주보다 낮습니다");
    }

    // Timeline pressure
    if (daysLeft !== null && daysLeft < 7 && completionRate < 80) {
      healthScore -= 15;
      riskFactors.push(`마감까지 ${Math.max(0, daysLeft)}일 남았으나 진행률이 ${completionRate}%입니다`);
    }

    // Budget overrun
    if (totalBudget > 0 && totalBudgetUsed > totalBudget * 0.9) {
      healthScore -= 10;
      riskFactors.push("예산의 90% 이상을 사용했습니다");
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    setData({
      totalTasks: tasks.length,
      todoTasks,
      inProgressTasks,
      doneTasks,
      overdueTasks,
      completionRate,
      totalMilestones: milestones.length,
      completedMilestones,
      activeMilestones,
      milestoneCompletionRate: milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0,
      totalMembers: members.length,
      activeMembersThisWeek,
      topContributors,
      unassignedTasks,
      tasksCompletedThisWeek,
      tasksCompletedLastWeek,
      avgTasksPerWeek,
      velocityTrend,
      healthScore,
      riskFactors,
      daysLeft,
      daysElapsed,
      estimatedCompletion,
      totalResources: resources.length,
      totalBudgetUsed,
      totalBudget: totalBudget || (project?.total_budget ? parseInt(project.total_budget) : 0),
    });

    setLoading(false);
  }, [projectId, totalBudget]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-nu-pink" />
      </div>
    );
  }

  if (!data) return null;

  const healthColor =
    data.healthScore >= 70 ? "text-green-600" : data.healthScore >= 40 ? "text-amber-500" : "text-red-500";
  const healthBg =
    data.healthScore >= 70 ? "bg-green-600" : data.healthScore >= 40 ? "bg-amber-500" : "bg-red-500";
  const healthLabel =
    data.healthScore >= 70 ? "양호" : data.healthScore >= 40 ? "주의" : "위험";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Health Score */}
        <div className="col-span-2 bg-white border-2 border-nu-ink p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0ede6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={data.healthScore >= 70 ? "#16a34a" : data.healthScore >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="3"
                strokeDasharray={`${data.healthScore * 0.974} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`font-head text-lg font-extrabold ${healthColor}`}>
                {data.healthScore}
              </span>
            </div>
          </div>
          <div>
            <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">프로젝트 건강도</p>
            <p className={`font-head text-lg font-extrabold ${healthColor}`}>{healthLabel}</p>
            {data.riskFactors.length > 0 && (
              <p className="text-[11px] text-red-500 mt-1 line-clamp-1">
                <AlertTriangle size={10} className="inline mr-0.5" />
                {data.riskFactors[0]}
              </p>
            )}
          </div>
        </div>

        {/* Completion Rate */}
        <KpiCard
          label="태스크 완료율"
          value={`${data.completionRate}%`}
          icon={CheckCircle2}
          iconColor="text-green-600"
          sub={`${data.doneTasks}/${data.totalTasks}`}
        />

        {/* Velocity */}
        <KpiCard
          label="주간 속도"
          value={`${data.tasksCompletedThisWeek}개`}
          icon={data.velocityTrend === "up" ? TrendingUp : data.velocityTrend === "down" ? TrendingDown : Activity}
          iconColor={data.velocityTrend === "up" ? "text-green-600" : data.velocityTrend === "down" ? "text-red-500" : "text-nu-muted"}
          sub={`평균 ${data.avgTasksPerWeek}/주`}
          trend={data.velocityTrend}
        />

        {/* Overdue */}
        <KpiCard
          label="기한 초과"
          value={`${data.overdueTasks}개`}
          icon={AlertTriangle}
          iconColor={data.overdueTasks > 0 ? "text-red-500" : "text-green-600"}
          sub={data.overdueTasks > 0 ? "조치 필요" : "없음"}
          alert={data.overdueTasks > 0}
        />

        {/* Days Left */}
        <KpiCard
          label="남은 기간"
          value={data.daysLeft !== null ? `${Math.max(0, data.daysLeft)}일` : "—"}
          icon={Calendar}
          iconColor="text-nu-blue"
          sub={data.estimatedCompletion ? `예상 완료: ${data.estimatedCompletion}` : undefined}
        />
      </div>

      {/* ── Status Distribution + Velocity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task Distribution Bar */}
        <div className="bg-white border border-nu-ink/10 p-5">
          <h3 className="font-head text-base font-extrabold mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-nu-pink" /> 태스크 분포
          </h3>

          {/* Stacked bar */}
          <div className="h-8 flex overflow-hidden mb-4 border border-nu-ink/10">
            {data.totalTasks > 0 ? (
              <>
                <div
                  className="bg-green-500 transition-all flex items-center justify-center"
                  style={{ width: `${(data.doneTasks / data.totalTasks) * 100}%` }}
                >
                  {data.doneTasks > 0 && (
                    <span className="text-[10px] font-bold text-white">{data.doneTasks}</span>
                  )}
                </div>
                <div
                  className="bg-amber-400 transition-all flex items-center justify-center"
                  style={{ width: `${(data.inProgressTasks / data.totalTasks) * 100}%` }}
                >
                  {data.inProgressTasks > 0 && (
                    <span className="text-[10px] font-bold text-white">{data.inProgressTasks}</span>
                  )}
                </div>
                <div
                  className="bg-nu-cream transition-all flex items-center justify-center"
                  style={{ width: `${(data.todoTasks / data.totalTasks) * 100}%` }}
                >
                  {data.todoTasks > 0 && (
                    <span className="text-[10px] font-bold text-nu-muted">{data.todoTasks}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full bg-nu-cream" />
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500" /> 완료 {data.doneTasks}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-400" /> 진행 중 {data.inProgressTasks}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-nu-cream border border-nu-ink/10" /> 대기 {data.todoTasks}</span>
          </div>

          {/* Milestone progress */}
          <div className="mt-5 pt-4 border-t border-nu-ink/5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">마일스톤 진행률</span>
              <span className="font-mono-nu text-[12px] font-bold">{data.completedMilestones}/{data.totalMilestones}</span>
            </div>
            <div className="h-2 bg-nu-cream overflow-hidden">
              <div
                className="h-full bg-nu-pink transition-all"
                style={{ width: `${data.milestoneCompletionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Team & Velocity */}
        <div className="bg-white border border-nu-ink/10 p-5">
          <h3 className="font-head text-base font-extrabold mb-4 flex items-center gap-2">
            <Users size={16} className="text-nu-blue" /> 팀 현황
          </h3>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-nu-cream/30 border border-nu-ink/5">
              <p className="font-head text-2xl font-extrabold text-nu-ink">{data.totalMembers}</p>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">전체</p>
            </div>
            <div className="text-center p-3 bg-green-50 border border-green-200">
              <p className="font-head text-2xl font-extrabold text-green-600">{data.activeMembersThisWeek}</p>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">활동 중</p>
            </div>
            <div className={`text-center p-3 border ${data.unassignedTasks > 0 ? "bg-red-50 border-red-200" : "bg-nu-cream/30 border-nu-ink/5"}`}>
              <p className={`font-head text-2xl font-extrabold ${data.unassignedTasks > 0 ? "text-red-500" : "text-nu-ink"}`}>
                {data.unassignedTasks}
              </p>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">미배정</p>
            </div>
          </div>

          {/* Top Contributors */}
          {data.topContributors.length > 0 && (
            <div>
              <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-2">기여도 TOP</p>
              <div className="space-y-1.5">
                {data.topContributors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-nu-pink/15 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-nu-pink">
                        {c.nickname.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm flex-1 truncate">{c.nickname}</span>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${Math.min(80, c.tasksDone * 16)}px` }} />
                      <span className="font-mono-nu text-[11px] text-nu-muted">{c.tasksDone}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Risk Factors ── */}
      {data.riskFactors.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 p-5">
          <h3 className="font-head text-base font-extrabold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> 위험 요소
          </h3>
          <div className="space-y-2">
            {data.riskFactors.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="font-mono-nu text-[11px] bg-red-200 text-red-800 px-1.5 py-0.5 font-bold shrink-0">
                  {i + 1}
                </span>
                {risk}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Budget Overview (if budget exists) ── */}
      {data.totalBudget > 0 && (
        <div className="bg-white border border-nu-ink/10 p-5">
          <h3 className="font-head text-base font-extrabold mb-3 flex items-center gap-2">
            <Zap size={16} className="text-nu-amber" /> 예산 현황
          </h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-nu-muted">사용</span>
                <span className="font-mono-nu text-[12px] font-bold">
                  {data.totalBudgetUsed.toLocaleString("ko-KR")} / {data.totalBudget.toLocaleString("ko-KR")} 원
                </span>
              </div>
              <div className="h-3 bg-nu-cream overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    data.totalBudgetUsed / data.totalBudget > 0.9 ? "bg-red-500" : "bg-nu-blue"
                  }`}
                  style={{ width: `${Math.min(100, (data.totalBudgetUsed / data.totalBudget) * 100)}%` }}
                />
              </div>
            </div>
            <span className={`font-head text-xl font-extrabold ${
              data.totalBudgetUsed / data.totalBudget > 0.9 ? "text-red-500" : "text-nu-ink"
            }`}>
              {Math.round((data.totalBudgetUsed / data.totalBudget) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor,
  sub,
  trend,
  alert,
}: {
  label: string;
  value: string;
  icon: any;
  iconColor: string;
  sub?: string;
  trend?: "up" | "down" | "stable";
  alert?: boolean;
}) {
  return (
    <div className={`bg-white border p-4 ${alert ? "border-red-200 bg-red-50/30" : "border-nu-ink/10"}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} className={iconColor} />
        {trend && (
          <span className={`text-[11px] flex items-center gap-0.5 font-bold ${
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-nu-muted"
          }`}>
            {trend === "up" && <ArrowUpRight size={12} />}
            {trend === "down" && <ArrowDownRight size={12} />}
            {trend === "stable" && <Minus size={12} />}
          </span>
        )}
      </div>
      <p className="font-head text-xl font-extrabold text-nu-ink">{value}</p>
      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-nu-muted mt-1 truncate">{sub}</p>}
    </div>
  );
}
