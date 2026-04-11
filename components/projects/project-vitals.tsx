"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp, Activity, Flame,
} from "lucide-react";

// ── 1. 프로젝트 역량 레이더 차트 ──
export function ProjectRadarChart({ projectId }: { projectId: string }) {
  const [memberCount, setMemberCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);
  const [resourceCount, setResourceCount] = useState(0);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const [taskDoneCount, setTaskDoneCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const results = await Promise.allSettled([
        supabase.from("project_members").select("user_id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("meetings").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("project_resources").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("project_milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("project_tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("project_updates").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      ]);

      const getCount = (i: number) => {
        const r = results[i];
        if (r.status === "fulfilled") return (r.value as any).count || 0;
        return 0;
      };

      setMemberCount(getCount(0));
      setMeetingCount(getCount(1));
      setResourceCount(getCount(2));
      setMilestoneCount(getCount(3));
      setTaskDoneCount(getCount(4));
      setPostCount(getCount(5));
    }
    load();
  }, [projectId]);

  const dimensions = [
    { label: "기획", key: "planning", score: Math.min(100, milestoneCount * 20 + meetingCount * 10) },
    { label: "실행", key: "execution", score: Math.min(100, taskDoneCount * 12 + meetingCount * 8) },
    { label: "정리", key: "docs", score: Math.min(100, resourceCount * 18 + postCount * 5) },
    { label: "소통", key: "communication", score: Math.min(100, meetingCount * 15 + postCount * 8) },
    { label: "전문", key: "expertise", score: Math.min(100, resourceCount * 12 + milestoneCount * 15) },
    { label: "협업", key: "collab", score: Math.min(100, memberCount * 15 + meetingCount * 6) },
  ];

  const radius = 52;
  const cx = 75;
  const cy = 75;

  const getPoint = (i: number, val: number) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return `${cx + (radius * val / 100) * Math.cos(angle)},${cy + (radius * val / 100) * Math.sin(angle)}`;
  };

  const poly = dimensions.map((d, i) => getPoint(i, d.score)).join(" ");
  const avgScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / 6);
  const sorted = [...dimensions].sort((a, b) => b.score - a.score);
  const identity = sorted[0].label + " & " + sorted[1].label + " 특화";

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2">
          <TrendingUp size={16} className="text-nu-pink" /> 프로젝트 역량 지표
        </h3>
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted bg-nu-cream/50 px-2 py-1 border border-nu-ink/5">
          AVG {avgScore}%
        </span>
      </div>

      <div className="flex flex-col items-center">
        <svg width="150" height="150" className="overflow-visible">
          {[20, 40, 60, 80, 100].map((v) => (
            <polygon
              key={v}
              points={Array.from({ length: 6 }).map((_, i) => getPoint(i, v)).join(" ")}
              className="fill-none stroke-nu-ink/5 stroke-[0.5]"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + radius * Math.cos((Math.PI * 2 * i) / 6 - Math.PI / 2)}
              y2={cy + radius * Math.sin((Math.PI * 2 * i) / 6 - Math.PI / 2)}
              className="stroke-nu-ink/5 stroke-[0.5]"
            />
          ))}
          <polygon
            points={poly}
            className="fill-nu-pink/15 stroke-nu-pink stroke-[1.5] transition-all duration-1000"
          />
          {dimensions.map((d, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const lx = cx + (radius + 16) * Math.cos(angle);
            const ly = cy + (radius + 16) * Math.sin(angle);
            return (
              <text key={d.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                className="font-mono-nu text-[7px] font-black uppercase fill-nu-muted">
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 text-center">
        <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold">
          {identity}
        </p>
        <p className="text-[10px] text-nu-muted mt-1">멤버 {memberCount} · 미팅 {meetingCount} · 자료 {resourceCount}</p>
      </div>
    </div>
  );
}

// ── 2. 프로젝트 활동 히트맵 ──
export function ProjectActivityHeatmap({ projectId }: { projectId: string }) {
  const [heatData, setHeatData] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 84);

      const results = await Promise.allSettled([
        supabase.from("project_updates").select("created_at").eq("project_id", projectId).gte("created_at", since.toISOString()),
        supabase.from("meetings").select("scheduled_at").eq("project_id", projectId).gte("scheduled_at", since.toISOString()),
        supabase.from("project_resources").select("created_at").eq("project_id", projectId).gte("created_at", since.toISOString()),
      ]);

      const counts: Record<string, number> = {};
      const addDate = (d: string) => {
        const key = d.slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
      };

      for (const r of results) {
        if (r.status === "fulfilled" && (r.value as any).data) {
          for (const item of (r.value as any).data) {
            addDate(item.created_at || item.scheduled_at);
          }
        }
      }

      setHeatData(counts);
    }
    load();
  }, [projectId]);

  const weeks: string[][] = [];
  const today = new Date();
  for (let w = 11; w >= 0; w--) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (w * 7 + (6 - d)));
      week.push(date.toISOString().slice(0, 10));
    }
    weeks.push(week);
  }

  const getColor = (count: number) => {
    if (count === 0) return "bg-nu-ink/[0.04]";
    if (count === 1) return "bg-nu-pink/20";
    if (count === 2) return "bg-nu-pink/40";
    if (count <= 4) return "bg-nu-pink/60";
    return "bg-nu-pink";
  };

  const totalActivity = Object.values(heatData).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2">
          <Activity size={16} className="text-nu-pink" /> 활동 히트맵
        </h3>
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center gap-1">
          <Flame size={10} className={totalActivity > 10 ? "text-nu-pink" : "text-nu-muted"} />
          {totalActivity} activities / 12w
        </span>
      </div>

      <div className="flex gap-[3px] justify-center overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => {
              const count = heatData[day] || 0;
              return (
                <div
                  key={day}
                  className={`w-[10px] h-[10px] rounded-[2px] transition-colors duration-300 ${getColor(count)}`}
                  title={`${day}: ${count}건`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1 mt-3">
        <span className="font-mono-nu text-[8px] text-nu-muted mr-1">Less</span>
        {[0, 1, 2, 3, 5].map((v) => (
          <div key={v} className={`w-[8px] h-[8px] rounded-[1px] ${getColor(v)}`} />
        ))}
        <span className="font-mono-nu text-[8px] text-nu-muted ml-1">More</span>
      </div>
    </div>
  );
}
