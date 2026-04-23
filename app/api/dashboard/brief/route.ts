import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/brief
 *
 * 오늘의 나의 요약:
 *   - 오늘 일정 (events, meetings)
 *   - 오늘/지난 할일 (staff_tasks, project_tasks)
 *   - 가입/관리 중인 너트/볼트 진행 상황
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // KST 기준 날짜 경계 — 서버 타임존(UTC)과 무관
  const { kstTodayStartISO, kstDaysLaterISO } = await import("@/lib/time-kst");
  const today = new Date();
  const todayStart = kstTodayStartISO();
  const tomorrowStart = kstDaysLaterISO(1);
  const weekFromNow = kstDaysLaterISO(7);

  // 1) 내가 속한 너트/볼트
  const [{ data: groupMembers }, { data: hostedGroups }, { data: projectMembers }, { data: createdProjects }] = await Promise.all([
    supabase.from("group_members").select("group_id, role").eq("user_id", user.id).eq("status", "active"),
    supabase.from("groups").select("id").eq("host_id", user.id),
    supabase.from("project_members").select("project_id, role").eq("user_id", user.id),
    supabase.from("projects").select("id").eq("created_by", user.id),
  ]);

  const groupIds = [
    ...new Set([
      ...((groupMembers as { group_id: string }[] | null) ?? []).map((m) => m.group_id),
      ...((hostedGroups as { id: string }[] | null) ?? []).map((g) => g.id),
    ]),
  ];
  const projectIds = [
    ...new Set([
      ...((projectMembers as { project_id: string }[] | null) ?? []).map((m) => m.project_id),
      ...((createdProjects as { id: string }[] | null) ?? []).map((p) => p.id),
    ]),
  ];

  // 2) 오늘 일정
  const [eventsRes, meetingsRes] = await Promise.all([
    groupIds.length > 0
      ? supabase.from("events").select("id, group_id, title, start_at, location, groups(name)")
          .in("group_id", groupIds)
          .gte("start_at", todayStart)
          .lt("start_at", tomorrowStart)
          .order("start_at")
      : Promise.resolve({ data: [] as unknown[] }),
    groupIds.length > 0
      ? supabase.from("meetings").select("id, group_id, title, scheduled_at, duration_min, groups(name)")
          .in("group_id", groupIds)
          .gte("scheduled_at", todayStart)
          .lt("scheduled_at", tomorrowStart)
          .neq("status", "cancelled")
          .order("scheduled_at")
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  // 3) 오늘/지난 할일 (할당된)
  const todayStr = todayStart.slice(0, 10);
  const [staffTasksRes, boltTasksRes] = await Promise.all([
    supabase.from("staff_tasks")
      .select("id, title, due_date, status, priority, project:staff_projects(title)")
      .eq("assigned_to", user.id)
      .in("status", ["todo", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", weekFromNow.slice(0, 10))
      .order("due_date", { ascending: true }),
    supabase.from("project_tasks")
      .select("id, title, due_date, status, project_id, milestone:project_milestones(title, project:projects(id, title))")
      .eq("assigned_to", user.id)
      .in("status", ["todo", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(20),
  ]);

  const staffTasks = (staffTasksRes.data as Array<{ id: string; title: string; due_date: string | null; status: string; priority: string | null; project?: { title: string } | null }> | null) ?? [];
  const boltTasks = (boltTasksRes.data as Array<{ id: string; title: string; due_date: string | null; status: string; milestone?: { title?: string; project?: { id: string; title: string } | null } | null }> | null) ?? [];

  const overdue = [...staffTasks, ...boltTasks.map((t) => ({
    ...t,
    priority: null as string | null,
    project: t.milestone?.project ? { title: t.milestone.project.title } : null,
  }))].filter((t) => t.due_date && t.due_date < todayStr);

  const dueToday = [...staffTasks, ...boltTasks.map((t) => ({
    ...t,
    priority: null as string | null,
    project: t.milestone?.project ? { title: t.milestone.project.title } : null,
  }))].filter((t) => t.due_date === todayStr);

  // "이번 주 (dueSoon)" — 기한 내 + 기한 없는 진행중 태스크 모두 포함
  const dueSoon = [...staffTasks, ...boltTasks.map((t) => ({
    ...t,
    priority: null as string | null,
    project: t.milestone?.project ? { title: t.milestone.project.title } : null,
  }))].filter((t) => {
    if (!t.due_date) return true; // 기한 미정 — 여기 포함 (사용자 가시성)
    return t.due_date > todayStr && t.due_date <= weekFromNow.slice(0, 10);
  });

  // 4) 볼트 마감 임박 (D-30 이내)
  let upcomingBoltDeadlines: Array<{ id: string; title: string; end_date: string; days_left: number }> = [];
  if (projectIds.length > 0) {
    const { data: projs } = await supabase
      .from("projects")
      .select("id, title, end_date, status")
      .in("id", projectIds)
      .neq("status", "completed")
      .not("end_date", "is", null);
    const rows = (projs as { id: string; title: string; end_date: string; status: string }[] | null) ?? [];
    upcomingBoltDeadlines = rows
      .map((p) => {
        const end = new Date(p.end_date);
        const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        return { id: p.id, title: p.title, end_date: p.end_date, days_left: days };
      })
      .filter((p) => p.days_left <= 30 && p.days_left >= -7)
      .sort((a, b) => a.days_left - b.days_left);
  }

  // 5) 진행 중 볼트 요약 (venture_stage + milestone 진척)
  let activeBolts: Array<{ id: string; title: string; venture_stage: string | null; milestone_progress: string }> = [];
  if (projectIds.length > 0) {
    const { data: bolts } = await supabase
      .from("projects")
      .select("id, title, venture_stage, project_milestones(status)")
      .in("id", projectIds)
      .eq("status", "active")
      .limit(10);
    activeBolts = ((bolts as { id: string; title: string; venture_stage?: string | null; project_milestones?: { status: string }[] }[] | null) ?? [])
      .map((b) => {
        const ms = b.project_milestones ?? [];
        const done = ms.filter((m) => m.status === "completed").length;
        return {
          id: b.id,
          title: b.title,
          venture_stage: b.venture_stage ?? null,
          milestone_progress: ms.length > 0 ? `${done}/${ms.length}` : "마일스톤 없음",
        };
      });
  }

  return NextResponse.json({
    events: eventsRes.data ?? [],
    meetings: meetingsRes.data ?? [],
    overdue: overdue.slice(0, 8),
    dueToday: dueToday.slice(0, 8),
    dueSoon: dueSoon.slice(0, 8),
    upcomingBoltDeadlines: upcomingBoltDeadlines.slice(0, 6),
    activeBolts: activeBolts.slice(0, 6),
    counts: {
      groups: groupIds.length,
      projects: projectIds.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueSoon: dueSoon.length,
    },
  });
}
