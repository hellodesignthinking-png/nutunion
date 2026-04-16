"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, CheckCircle2, Circle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";

interface StaffMemberActivity {
  id: string;
  nickname: string;
  avatar_url: string | null;
  tasksTotal: number;
  tasksDone: number;
  tasksOverdue: number;
  tasksInProgress: number;
  recentCompletions: number; // 최근 7일 완료수
  lastActive: string | null;
}

export function TeamActivityWidget() {
  const [members, setMembers] = useState<StaffMemberActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const todayStr = new Date().toISOString().split("T")[0];

      // 모든 스태프 멤버
      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("role", ["staff", "admin"]);

      if (!staffProfiles || staffProfiles.length === 0) {
        setLoading(false);
        return;
      }

      // 모든 스태프 할일 (전체)
      const { data: allTasks } = await supabase
        .from("staff_tasks")
        .select("id, assigned_to, status, due_date, completed_at");

      const result: StaffMemberActivity[] = [];

      for (const profile of staffProfiles) {
        const myTasks = (allTasks || []).filter(t => t.assigned_to === profile.id);
        const done = myTasks.filter(t => t.status === "done");
        const overdue = myTasks.filter(t => t.status !== "done" && t.due_date && t.due_date < todayStr);
        const inProgress = myTasks.filter(t => t.status === "in_progress");
        const recentCompletions = done.filter(t =>
          t.completed_at && t.completed_at >= sevenDaysAgo
        ).length;

        // 마지막 활동 시간
        const latestCompletion = done
          .filter(t => t.completed_at)
          .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""))[0];

        result.push({
          id: profile.id,
          nickname: profile.nickname || "Unknown",
          avatar_url: profile.avatar_url,
          tasksTotal: myTasks.length,
          tasksDone: done.length,
          tasksOverdue: overdue.length,
          tasksInProgress: inProgress.length,
          recentCompletions,
          lastActive: latestCompletion?.completed_at || null,
        });
      }

      // 활동량 많은 순 정렬
      result.sort((a, b) => b.recentCompletions - a.recentCompletions || b.tasksInProgress - a.tasksInProgress);
      setMembers(result);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <section className="bg-white border border-nu-ink/[0.06]">
        <div className="p-4 border-b border-nu-ink/5">
          <div className="h-4 w-32 bg-nu-ink/8 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-nu-ink/5 animate-pulse" />)}
        </div>
      </section>
    );
  }

  if (members.length === 0) return null;

  return (
    <section className="bg-white border border-nu-ink/[0.06]">
      <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
        <h3 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
          <Users size={14} className="text-indigo-600" /> 팀 현황
        </h3>
        <Link href="/staff/tasks" className="font-mono-nu text-[11px] text-indigo-600 no-underline hover:underline uppercase tracking-widest">
          전체
        </Link>
      </div>
      <div className="divide-y divide-nu-ink/5">
        {members.map(m => {
          const progress = m.tasksTotal > 0 ? Math.round((m.tasksDone / m.tasksTotal) * 100) : 0;
          return (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-head text-xs font-bold text-indigo-600 shrink-0">
                  {m.nickname.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-head text-xs font-bold text-nu-ink truncate">{m.nickname}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.tasksInProgress > 0 && (
                      <span className="font-mono-nu text-[10px] text-indigo-600 flex items-center gap-0.5">
                        <Circle size={7} /> {m.tasksInProgress} 진행중
                      </span>
                    )}
                    {m.tasksOverdue > 0 && (
                      <span className="font-mono-nu text-[10px] text-red-600 font-bold">
                        {m.tasksOverdue} 지연
                      </span>
                    )}
                    {m.recentCompletions > 0 && (
                      <span className="font-mono-nu text-[10px] text-green-600 flex items-center gap-0.5">
                        <CheckCircle2 size={7} /> 이번주 {m.recentCompletions}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini progress */}
                {m.tasksTotal > 0 && (
                  <div className="w-12 shrink-0">
                    <div className="h-1 bg-nu-ink/5 w-full">
                      <div className="h-1 bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="font-mono-nu text-[9px] text-nu-muted text-right mt-0.5">{m.tasksDone}/{m.tasksTotal}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
