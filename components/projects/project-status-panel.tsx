import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Flame } from "lucide-react";

interface Props {
  projectId: string;
  userId: string;
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

/**
 * 볼트 진행 + 이슈 + 내 기여도 패널.
 * - 마일스톤 진척률
 * - 이슈 (지난 할일 / 오늘 마감 / 임박 마감) 자동 추출
 * - 내 기여도: 전체 활동 중 내가 차지하는 %
 */
export async function ProjectStatusPanel({ projectId, userId }: Props) {
  const supabase = await createClient();

  // 쿼리 최소화 — count/head 로 총계만, author_id 내 값만 개별 카운트
  const [msRes, tasksRes, postsTotalRes, postsMineRes, myVentureRes, totalVentureRes, projectRes, membersRes] = await Promise.all([
    supabase.from("project_milestones").select("id, title, status, due_date").eq("project_id", projectId),
    supabase.from("project_tasks").select("id, title, status, due_date, assigned_to").eq("project_id", projectId),
    // crew_posts 는 group_id 만 보유 — 볼트 단위는 project_updates 로 집계
    supabase.from("project_updates").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("project_updates").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("author_id", userId),
    // venture 활동 카운트 — venture_insights/problems/ideas/feedback 의 author_id 기반
    supabase.from("venture_insights").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("author_id", userId).then(
      (r) => ({ count: r.count ?? 0 }), () => ({ count: 0 })
    ),
    supabase.from("venture_insights").select("id", { count: "exact", head: true }).eq("project_id", projectId).then(
      (r) => ({ count: r.count ?? 0 }), () => ({ count: 0 })
    ),
    supabase.from("projects").select("end_date").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("user_id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);

  const milestones = (msRes.data as Array<{ id: string; title: string; status: string; due_date: string | null }> | null) ?? [];
  const tasks = (tasksRes.data as Array<{ id: string; title: string; status: string; due_date: string | null; assigned_to: string | null }> | null) ?? [];
  const totalPosts = postsTotalRes.count ?? 0;
  const myPosts = postsMineRes.count ?? 0;
  const myVenture = (myVentureRes as { count?: number }).count ?? 0;
  const totalVenture = (totalVentureRes as { count?: number }).count ?? 0;
  const endDate = (projectRes.data as { end_date?: string | null } | null)?.end_date ?? null;
  const totalMembers = membersRes.count ?? 0;

  // 진척률
  const msTotal = milestones.length;
  const msDone = milestones.filter((m) => m.status === "completed").length;
  const msPct = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;

  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

  // 이슈: 지난 할일 / 오늘 마감 / 오래된 진행중
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < todayStr);
  const todayTasks = tasks.filter((t) => t.status !== "done" && t.due_date === todayStr);
  const overdueMs = milestones.filter((m) => m.status !== "completed" && m.due_date && m.due_date < todayStr);
  const daysToProjectEnd = daysUntil(endDate);

  const myTasks = tasks.filter((t) => t.assigned_to === userId).length;
  const myDoneTasks = tasks.filter((t) => t.assigned_to === userId && t.status === "done").length;

  const myTotal = myPosts + myTasks + myVenture;
  const grandTotal = totalPosts + taskTotal + totalVenture;
  const myPct = grandTotal > 0 ? Math.round((myTotal / grandTotal) * 100) : 0;

  const avgPerMember = totalMembers > 0 ? Math.round(grandTotal / totalMembers) : 0;

  const issues: { level: "critical" | "warn" | "info"; label: string; detail: string; href?: string }[] = [];
  if (overdueTasks.length > 0) {
    issues.push({
      level: "critical",
      label: `🔴 지난 할일 ${overdueTasks.length}건`,
      detail: overdueTasks.slice(0, 2).map((t) => t.title).join(" · ") + (overdueTasks.length > 2 ? " 외" : ""),
    });
  }
  if (todayTasks.length > 0) {
    issues.push({
      level: "warn",
      label: `⏰ 오늘 마감 ${todayTasks.length}건`,
      detail: todayTasks.slice(0, 2).map((t) => t.title).join(" · "),
    });
  }
  if (overdueMs.length > 0) {
    issues.push({
      level: "critical",
      label: `⚠ 지난 마일스톤 ${overdueMs.length}건`,
      detail: overdueMs.slice(0, 2).map((m) => m.title).join(" · "),
    });
  }
  if (daysToProjectEnd !== null && daysToProjectEnd >= 0 && daysToProjectEnd <= 14) {
    issues.push({
      level: daysToProjectEnd <= 3 ? "critical" : "warn",
      label: `📅 볼트 마감 ${daysToProjectEnd === 0 ? "D-DAY" : `D-${daysToProjectEnd}`}`,
      detail: `${endDate}`,
    });
  }
  if (issues.length === 0 && (taskTotal > 0 || msTotal > 0)) {
    issues.push({ level: "info", label: "✅ 이슈 없음", detail: "모든 할일이 일정 내 진행 중" });
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x-[2px] divide-nu-ink/10">
        {/* 진행률 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <TrendingUp size={11} /> 진행 현황
          </div>
          <div className="space-y-2.5">
            <div>
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">마일스톤</span>
                <span className="font-mono-nu text-[14px] font-bold text-nu-ink tabular-nums">
                  {msDone}/{msTotal} <span className="text-nu-pink">{msPct}%</span>
                </span>
              </div>
              <div className="h-2 bg-nu-ink/10 overflow-hidden">
                <div className="h-full bg-nu-pink" style={{ width: `${msPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">할일</span>
                <span className="font-mono-nu text-[14px] font-bold text-nu-ink tabular-nums">
                  {taskDone}/{taskTotal} <span className="text-nu-blue">{taskPct}%</span>
                </span>
              </div>
              <div className="h-2 bg-nu-ink/10 overflow-hidden">
                <div className="h-full bg-nu-blue" style={{ width: `${taskPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 이슈 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <AlertTriangle size={11} /> 이슈 사항
          </div>
          <ul className="space-y-1.5 list-none m-0 p-0">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className={`shrink-0 w-1 h-1 rounded-full mt-[7px] ${
                  i.level === "critical" ? "bg-red-600" : i.level === "warn" ? "bg-orange-500" : "bg-green-600"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-mono-nu text-[11px] font-bold ${
                    i.level === "critical" ? "text-red-700" : i.level === "warn" ? "text-orange-700" : "text-green-700"
                  }`}>
                    {i.label}
                  </div>
                  <div className="text-[11px] text-nu-graphite truncate">{i.detail}</div>
                </div>
              </li>
            ))}
            {taskTotal === 0 && msTotal === 0 && (
              <li className="text-[11px] text-nu-graphite italic">마일스톤/할일 등록 전</li>
            )}
          </ul>
        </div>

        {/* 내 기여도 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <Flame size={11} /> 내 기여도
          </div>
          {grandTotal === 0 ? (
            <p className="text-[11px] text-nu-graphite italic">아직 활동 없음</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-head text-[36px] font-extrabold text-nu-pink tabular-nums leading-none">{myPct}%</span>
                <span className="font-mono-nu text-[10px] text-nu-graphite">
                  전체 {grandTotal}건 중 {myTotal}건
                </span>
              </div>
              <div className="h-2 bg-nu-ink/10 overflow-hidden mb-2">
                <div className="h-full bg-nu-pink" style={{ width: `${Math.min(100, myPct)}%` }} />
              </div>
              <div className="font-mono-nu text-[10px] text-nu-graphite space-y-0.5">
                <div>📝 글 {myPosts} / {totalPosts}</div>
                <div>✅ 내 할일 {myDoneTasks}/{myTasks} 완료</div>
                {totalVenture > 0 && <div>🚀 Venture 활동 {myVenture} / {totalVenture}</div>}
                {avgPerMember > 0 && (
                  <div className="pt-1 border-t border-nu-ink/10 mt-1">
                    팀 평균 {avgPerMember}건 {myTotal >= avgPerMember ? "· 👑 상회" : "· 분발 필요"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 빠른 링크 */}
      {(msTotal > 0 || taskTotal > 0) && (
        <div className="border-t-[2px] border-nu-ink/10 bg-nu-cream/20 px-4 py-2 flex items-center gap-3 flex-wrap font-mono-nu text-[10px] uppercase tracking-widest">
          {overdueTasks.length > 0 && (
            <Link href={`/projects/${projectId}#activity`} className="text-red-700 no-underline hover:underline inline-flex items-center gap-1">
              <AlertTriangle size={10} /> 지난 할일 처리
            </Link>
          )}
          {msTotal > msDone && (
            <Link href={`/projects/${projectId}#milestones`} className="text-nu-ink no-underline hover:underline inline-flex items-center gap-1">
              <Clock size={10} /> 진행 중 마일스톤 {msTotal - msDone}
            </Link>
          )}
          {msPct === 100 && taskPct === 100 && (
            <span className="text-green-700 inline-flex items-center gap-1">
              <CheckCircle2 size={10} /> 모든 목표 달성
            </span>
          )}
        </div>
      )}
    </section>
  );
}
