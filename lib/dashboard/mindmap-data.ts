import type { SupabaseClient } from "@supabase/supabase-js";
import type { MindMapData } from "./mindmap-types";

/**
 * 사용자별 마인드맵 데이터 한 번에 fetch.
 * page.tsx 의 server component 에서 호출 — 4개 쿼리 병렬.
 */
export async function fetchMindMapData(
  supabase: SupabaseClient,
  userId: string,
): Promise<MindMapData> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString();

  const [nutsRes, boltsRes, meetingsRes, eventsRes, overdueRes, mentionsRes] = await Promise.all([
    // 너트 — 사용자가 속한 활성 그룹 (최대 10)
    supabase
      .from("group_members")
      .select("role, groups(id, name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(10),

    // 볼트 — 사용자가 속한 active/draft 프로젝트 (최대 10)
    supabase
      .from("project_members")
      .select("projects(id, title, status, end_date)")
      .eq("user_id", userId)
      .in("projects.status", ["active", "draft"])
      .limit(10),

    // 일정 — 다가오는 미팅 (최대 5)
    supabase
      .from("meetings")
      .select("id, title, scheduled_at")
      .gte("scheduled_at", today)
      .lte("scheduled_at", sevenDaysFromNow)
      .order("scheduled_at", { ascending: true })
      .limit(5),

    // 일정 — 다가오는 이벤트 (최대 5)
    supabase
      .from("events")
      .select("id, title, start_at")
      .gte("start_at", today)
      .lte("start_at", sevenDaysFromNow)
      .order("start_at", { ascending: true })
      .limit(5),

    // 이슈 — 사용자가 담당인 마감 지난 태스크 (최대 5)
    supabase
      .from("project_tasks")
      .select("id, title, due_date")
      .eq("assigned_to", userId)
      .neq("status", "done")
      .lt("due_date", today.slice(0, 10))
      .limit(5),

    // 이슈 — 미읽음 멘션 알림 (최대 3)
    supabase
      .from("notifications")
      .select("id, title")
      .eq("user_id", userId)
      .eq("category", "mention")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const nuts = (nutsRes.data ?? [])
    .filter((m: any) => m.groups)
    .map((m: any) => ({
      id: m.groups.id as string,
      name: m.groups.name as string,
      role: m.role as string,
    }));

  const bolts = (boltsRes.data ?? [])
    .filter((m: any) => m.projects)
    .map((m: any) => {
      const p = m.projects;
      const daysLeft = p.end_date
        ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;
      return {
        id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        daysLeft,
      };
    });

  const meetings = (meetingsRes.data ?? []).map((m: any) => ({
    id: m.id as string,
    title: m.title as string,
    at: m.scheduled_at as string,
    source: "meeting" as const,
  }));
  const events = (eventsRes.data ?? []).map((e: any) => ({
    id: e.id as string,
    title: e.title as string,
    at: e.start_at as string,
    source: "event" as const,
  }));
  const schedule = [...meetings, ...events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);

  const overdue = (overdueRes.data ?? []).map((t: any) => ({
    id: t.id as string,
    title: t.title as string,
    kind: "overdue_task" as const,
  }));
  const mentions = (mentionsRes.data ?? []).map((n: any) => ({
    id: n.id as string,
    title: n.title as string,
    kind: "mention" as const,
  }));
  const issues = [...overdue, ...mentions].slice(0, 5);

  return { nuts, bolts, schedule, issues };
}
