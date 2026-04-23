"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingDown,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import type { ProjectMilestone, ProjectTask } from "@/lib/types";

interface ProjectBurndownChartProps {
  projectId: string;
}

interface BurndownDataPoint {
  date: string;
  timestamp: number;
  remainingTasks: number;
}

interface ChartData {
  startDate: Date;
  deadline: Date;
  totalTasks: number;
  completedTasks: number;
  idealLine: BurndownDataPoint[];
  actualLine: BurndownDataPoint[];
  estimatedCompletionDate: Date | null;
}

type BurndownTask = ProjectTask & { updated_at?: string; marked_done_at?: string; completed_at?: string | null };

export function ProjectBurndownChart({
  projectId,
}: ProjectBurndownChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAndCalculateBurndown() {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();

        // Fetch project details
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, created_at, start_date")
          .eq("id", projectId)
          .single();

        if (projectError) throw projectError;
        if (!project) {
          setError("볼트를 찾을 수 없습니다");
          return;
        }

        // Fetch milestones (completed_at 컬럼은 migration 083 이후 존재 — 없으면 graceful fallback)
        let milestones: any[] = [];
        const taskCols = `id, status, created_at, completed_at`;
        const { data: fullMilestones, error: fErr } = await supabase
          .from("project_milestones")
          .select(`id, title, due_date, tasks:project_tasks(${taskCols})`)
          .eq("project_id", projectId)
          .order("due_date", { ascending: true });

        if (fErr) {
          // completed_at 이 없는 환경 또는 join 실패 → 기본 컬럼만
          const { data: basicMs, error: msErr } = await supabase
            .from("project_milestones")
            .select("id, title, due_date")
            .eq("project_id", projectId)
            .order("due_date", { ascending: true });
          if (msErr) throw msErr;

          const { data: basicTasks } = await supabase
            .from("project_tasks")
            .select("id, milestone_id, status, created_at")
            .eq("project_id", projectId);

          milestones = (basicMs || []).map((m: any) => ({
            ...m,
            tasks: (basicTasks || []).filter((t: any) => t.milestone_id === m.id)
          }));
        } else {
          milestones = fullMilestones || [];
        }

        if (!milestones || milestones.length === 0) {
          setError("마일스톤이 없습니다");
          return;
        }

        // Flatten all tasks
        const allTasks: BurndownTask[] = [];
        milestones.forEach((milestone) => {
          const tasks = milestone.tasks;
          if (tasks?.length) {
            allTasks.push(...tasks);
          }
        });

        if (allTasks.length === 0) {
          setError("태스크를 추가하면 번다운 차트가 생성됩니다");
          return;
        }

        // Calculate dates
        const startDate = new Date(
          project.start_date || project.created_at
        );
        // 마지막 마일스톤의 due_date 우선, 없으면 due_date가 있는 것 중 최대값, 그도 없으면 시작+30일
        const dueDates = milestones.map((m: any) => m.due_date).filter(Boolean);
        const latestDueDate = dueDates.length > 0
          ? new Date(dueDates.sort().at(-1))
          : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const rawDeadline = latestDueDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Extend timeline to whichever is later: deadline or today
        const deadline = rawDeadline > today ? rawDeadline : today;

        // Build a map of completed tasks with estimated completion dates
        // Since we don't have a `completed_at` column, we use `updated_at` if available,
        // otherwise distribute completions evenly from start to today
        const doneTasks = allTasks.filter(t => t.status === "done");
        const doneCompletionDates = new Map<string, Date>();

        doneTasks.forEach((task) => {
          // 우선순위: completed_at (정확) > updated_at > created_at (생성과 동시 완료 가정)
          const raw = task.completed_at || task.updated_at || task.created_at;
          const completedAt = new Date(raw);
          completedAt.setHours(0, 0, 0, 0);
          doneCompletionDates.set(task.id, completedAt);
        });

        // Create timeline array
        const timelinePoints: BurndownDataPoint[] = [];
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate <= deadline) {
          const timestamp = currentDate.getTime();

          // Count remaining tasks at this point in time
          let remainingCount = 0;
          allTasks.forEach((task) => {
            const createdDate = new Date(task.created_at);
            createdDate.setHours(0, 0, 0, 0);

            // Task exists at this point if it was created before or on this date
            if (createdDate <= currentDate) {
              if (task.status === "done") {
                // Task completed — only count as remaining if this date is before completion
                const completedDate = doneCompletionDates.get(task.id);
                if (completedDate && currentDate < completedDate) {
                  remainingCount++;
                }
              } else {
                // Task not done — always remaining
                remainingCount++;
              }
            }
          });

          timelinePoints.push({
            date: currentDate.toISOString().split("T")[0],
            timestamp,
            remainingTasks: remainingCount,
          });

          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Create ideal line (straight diagonal from total to 0, based on original deadline)
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(
          (t) => t.status === "done"
        ).length;
        const idealDays = Math.ceil(
          (rawDeadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const idealLine = timelinePoints.map((point) => {
          const daysElapsed = Math.ceil(
            (point.timestamp - startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const tasksBurnedIdeal =
            (daysElapsed / Math.max(idealDays, 1)) * totalTasks;
          const remainingIdeal = Math.max(0, totalTasks - tasksBurnedIdeal);

          return {
            ...point,
            remainingTasks: remainingIdeal,
          };
        });

        // Calculate estimated completion date
        let estimatedCompletionDate: Date | null = null;
        if (completedTasks > 0 && completedTasks < totalTasks) {
          // Calculate burn rate (tasks per day)
          const tasksCompleted = allTasks.filter(
            (t) => t.status === "done"
          );
          const earliestTaskDate = new Date(
            Math.min(...allTasks.map((t) => new Date(t.created_at).getTime()))
          );

          let latestCompletionDate = new Date(earliestTaskDate);
          tasksCompleted.forEach((task) => {
            const taskDate = new Date(task.created_at);
            if (taskDate > latestCompletionDate) {
              latestCompletionDate = taskDate;
            }
          });

          const daysToComplete = Math.ceil(
            (latestCompletionDate.getTime() - earliestTaskDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          const burnRate =
            completedTasks / Math.max(daysToComplete, 1);
          const remainingTasks = totalTasks - completedTasks;
          const daysToFinish = Math.ceil(remainingTasks / Math.max(burnRate, 0.1));

          estimatedCompletionDate = new Date(latestCompletionDate);
          estimatedCompletionDate.setDate(
            estimatedCompletionDate.getDate() + daysToFinish
          );
        } else if (completedTasks === totalTasks) {
          estimatedCompletionDate = new Date();
        }

        setChartData({
          startDate,
          deadline,
          totalTasks,
          completedTasks,
          idealLine,
          actualLine: timelinePoints,
          estimatedCompletionDate,
        });
      } catch (err) {
        console.error("Burndown chart error:", err);
        setError(
          err instanceof Error ? err.message : "데이터를 불러올 수 없습니다"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAndCalculateBurndown();
  }, [projectId]);

  if (loading) {
    return (
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-8 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-nu-pink" />
        <span className="text-sm font-mono-nu text-nu-ink/60">
          차트 생성 중...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-3.5 h-3.5 text-nu-pink" />
          <h2 className="text-[11px] font-black uppercase tracking-widest text-nu-ink">
            번다운 차트 · Burndown
          </h2>
        </div>
        <div className="flex items-start gap-2 p-3 bg-nu-cream/40 border-l-[3px] border-nu-pink/40">
          <Info size={13} className="text-nu-pink mt-0.5 shrink-0" />
          <div className="text-[12px] text-nu-graphite leading-[1.6]">
            <p className="font-bold text-nu-ink mb-1">{error}</p>
            <p>
              마일스톤과 그 안의 <strong>태스크(할 일)</strong>를 추가하면, 시간에 따른 진도가 여기에 그려져요.
              <br />
              이상적 속도(파란 점선) vs 실제 완료 속도(분홍 실선) 를 비교할 수 있어요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-8">
        <p className="text-sm text-nu-gray">데이터가 없습니다</p>
      </div>
    );
  }

  const {
    startDate,
    deadline,
    totalTasks,
    completedTasks,
    idealLine,
    actualLine,
    estimatedCompletionDate,
  } = chartData;

  const remainingTasks = totalTasks - completedTasks;
  const isOnTrack = estimatedCompletionDate
    ? estimatedCompletionDate <= deadline
    : false;
  const delayDays = estimatedCompletionDate
    ? Math.ceil(
        (estimatedCompletionDate.getTime() - deadline.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  // Format dates for display
  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  };

  // SVG Chart rendering
  const chartHeight = 300;
  const chartWidth = 600;
  const padding = 40;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const maxTaskCount = Math.max(
    totalTasks,
    Math.max(...idealLine.map((p) => p.remainingTasks))
  );

  // Scale functions
  const scaleX = (timestamp: number) => {
    const range = deadline.getTime() - startDate.getTime();
    const position = (timestamp - startDate.getTime()) / range;
    return padding + position * graphWidth;
  };

  const scaleY = (tasks: number) => {
    const position = tasks / maxTaskCount;
    return padding + graphHeight - position * graphHeight;
  };

  // Generate paths — polyline "points" is space-separated x,y pairs (NOT SVG path M/L syntax)
  const safePoint = (x: number, y: number) =>
    Number.isFinite(x) && Number.isFinite(y) ? `${x},${y}` : null;

  const idealPath = idealLine
    .map((p) => safePoint(scaleX(p.timestamp), scaleY(p.remainingTasks)))
    .filter((s): s is string => s !== null)
    .join(" ");

  const actualPath = actualLine
    .map((p) => safePoint(scaleX(p.timestamp), scaleY(p.remainingTasks)))
    .filter((s): s is string => s !== null)
    .join(" ");

  // Generate grid lines and labels
  const dayCount = Math.ceil(
    (deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const gridInterval = Math.max(1, Math.floor(dayCount / 5));

  const gridLines = [];
  for (let i = 0; i <= dayCount; i += gridInterval) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const x = scaleX(date.getTime());
    gridLines.push({
      x,
      date: formatDate(date),
    });
  }

  const yGridLines = [];
  for (let i = 0; i <= maxTaskCount; i += Math.max(1, Math.ceil(maxTaskCount / 5))) {
    const y = scaleY(i);
    yGridLines.push({ y, count: i });
  }

  // Completion percentage
  const completionPercentage = Math.round(
    (completedTasks / totalTasks) * 100
  );

  return (
    <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-3.5 h-3.5 text-nu-pink" />
          <h2 className="text-[11px] font-black uppercase tracking-widest text-nu-ink">
            번다운 차트 · Burndown
          </h2>
        </div>
        {/* 설명 — "뭘 의미하는지" 명시 */}
        <div className="flex items-start gap-2 mb-6 p-3 bg-nu-cream/40 border-l-[3px] border-nu-pink/40">
          <Info size={13} className="text-nu-pink mt-0.5 shrink-0" />
          <p className="text-[12px] text-nu-graphite leading-[1.6]">
            마감일까지 <strong className="text-nu-ink">남은 태스크 수</strong>가 시간에 따라 어떻게 줄어드는지를 보여줍니다.
            <br />
            <span className="text-nu-pink font-bold">분홍 실선 (실제)</span>이
            <span className="text-nu-blue font-bold"> 파란 점선 (이상적 속도)</span> 아래면 순조로움,
            위면 지연 중입니다.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-nu-ink/20"></div>
              <span className="text-[11px] font-mono-nu text-nu-gray">
                전체 태스크
              </span>
            </div>
            <p className="text-2xl font-head font-black text-nu-ink">
              {totalTasks}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              <span className="text-[11px] font-mono-nu text-nu-gray">
                완료된 태스크
              </span>
            </div>
            <p className="text-2xl font-head font-black text-green-600">
              {completedTasks} ({completionPercentage}%)
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3 h-3 text-nu-pink" />
              <span className="text-[11px] font-mono-nu text-nu-gray">
                남은 태스크
              </span>
            </div>
            <p className="text-2xl font-head font-black text-nu-pink">
              {remainingTasks}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3 text-nu-blue" />
              <span className="text-[11px] font-mono-nu text-nu-gray">
                마감일
              </span>
            </div>
            <p className="text-sm font-head font-black text-nu-blue">
              {formatDate(deadline)}
            </p>
          </div>
        </div>

        {/* Status Message */}
        {remainingTasks === 0 ? (
          <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-none">
            <p className="text-sm font-head font-black text-green-700">
              축하합니다! 모든 태스크가 완료되었습니다 🎉
            </p>
          </div>
        ) : estimatedCompletionDate ? (
          <div
            className={`border px-4 py-3 rounded-none ${
              isOnTrack
                ? "bg-green-50 border-green-200"
                : "bg-orange-50 border-orange-200"
            }`}
          >
            <p
              className={`text-sm font-mono-nu font-black ${
                isOnTrack ? "text-green-700" : "text-orange-700"
              }`}
            >
              {isOnTrack ? (
                <>이 속도라면 {formatDate(estimatedCompletionDate)}까지 완료 예상입니다</>
              ) : (
                <>마감일보다 약 {delayDays}일 지연될 수 있습니다</>
              )}
            </p>
          </div>
        ) : null}
      </div>

      {/* 범례 (차트 밖으로) */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] font-mono-nu">
        <div className="flex items-center gap-2">
          <svg width="24" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#FF48B0" strokeWidth="2.5" />
          </svg>
          <span className="text-nu-pink font-bold">실제 진도</span>
          <span className="text-nu-muted">(남은 태스크)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="3" className="shrink-0">
            <line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#0055FF" strokeWidth="2" strokeDasharray="4,4" opacity="0.6" />
          </svg>
          <span className="text-nu-blue font-bold">이상적 속도</span>
          <span className="text-nu-muted">(마감까지 균등 소진)</span>
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto mb-2 relative">
        {/* Y축 레이블 */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-[9px] font-mono-nu uppercase tracking-widest text-nu-muted pointer-events-none" style={{ marginLeft: "-8px" }}>
          남은 태스크
        </div>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="min-w-full bg-white"
        >
          {/* Grid lines (Y-axis) */}
          {yGridLines.map((line, i) => (
            <g key={`y-grid-${i}`}>
              <line
                x1={padding}
                y1={line.y}
                x2={chartWidth - padding}
                y2={line.y}
                stroke="#0D0D0D"
                strokeWidth="0.5"
                opacity="0.1"
                strokeDasharray="2,2"
              />
              <text
                x={padding - 8}
                y={line.y + 4}
                fontSize="9"
                fontWeight="700"
                fontFamily="var(--font-mono-nu)"
                textAnchor="end"
                fill="#6B6860"
              >
                {line.count}
              </text>
            </g>
          ))}

          {/* Grid lines (X-axis) */}
          {gridLines.map((line, i) => (
            <g key={`x-grid-${i}`}>
              <line
                x1={line.x}
                y1={padding}
                x2={line.x}
                y2={chartHeight - padding}
                stroke="#0D0D0D"
                strokeWidth="0.5"
                opacity="0.1"
              />
              <text
                x={line.x}
                y={chartHeight - padding + 20}
                fontSize="9"
                fontWeight="700"
                fontFamily="var(--font-mono-nu)"
                textAnchor="middle"
                fill="#6B6860"
              >
                {line.date}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="#0D0D0D"
            strokeWidth="2"
          />
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#0D0D0D"
            strokeWidth="2"
          />

          {/* Ideal line (blue) */}
          <polyline
            points={idealPath}
            fill="none"
            stroke="#0055FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
            strokeDasharray="4,4"
          />

          {/* Actual line (pink) */}
          <polyline
            points={actualPath}
            fill="none"
            stroke="#FF48B0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

        </svg>
      </div>

      {/* X축 레이블 + 시작/마감 */}
      <div className="text-center text-[9px] font-mono-nu uppercase tracking-widest text-nu-muted mb-1">
        날짜
      </div>
      <div className="flex justify-between text-[11px] font-mono-nu text-nu-gray">
        <span>시작 · {formatDate(startDate)}</span>
        <span>마감 · {formatDate(deadline)}</span>
      </div>
    </div>
  );
}
