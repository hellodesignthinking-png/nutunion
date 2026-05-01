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
        leadNickname: null as string | null,
        leadAvatarUrl: null as string | null,
      };
    });

  // ── 볼트 담당자 (lead) — 카드 칩에 사용. 한 번의 IN 쿼리로 N+1 방지.
  if (bolts.length > 0) {
    const { data: leads } = await supabase
      .from("project_members")
      .select("project_id, user_id, profile:profiles(nickname, avatar_url)")
      .in("project_id", bolts.map((b) => b.id))
      .eq("role", "lead")
      .limit(50);
    const byProject = new Map<string, { nickname: string | null; avatar: string | null }>();
    for (const row of (leads ?? []) as any[]) {
      if (!byProject.has(row.project_id) && row.profile) {
        byProject.set(row.project_id, {
          nickname: row.profile.nickname ?? null,
          avatar: row.profile.avatar_url ?? null,
        });
      }
    }
    for (const b of bolts) {
      const lead = byProject.get(b.id);
      if (lead) {
        b.leadNickname = lead.nickname;
        b.leadAvatarUrl = lead.avatar;
      }
    }
  }

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

  // ── 와셔(동료) — 같은 너트·볼트에 속한 다른 사용자 (자기 자신 제외, 최대 12명)
  const nutIds = nuts.map((n) => n.id);
  const boltIds = bolts.map((b) => b.id);
  const washerMap = new Map<string, { nickname: string; avatar_url?: string | null; nutIds: Set<string>; boltIds: Set<string> }>();

  if (nutIds.length > 0) {
    const { data: nutCoMembers } = await supabase
      .from("group_members")
      .select("group_id, user_id, profile:profiles(id, nickname, avatar_url)")
      .in("group_id", nutIds)
      .eq("status", "active")
      .neq("user_id", userId)
      .limit(50);
    for (const m of (nutCoMembers ?? []) as any[]) {
      if (!m.profile) continue;
      const w = washerMap.get(m.user_id) ?? {
        nickname: m.profile.nickname,
        avatar_url: m.profile.avatar_url,
        nutIds: new Set<string>(),
        boltIds: new Set<string>(),
      };
      w.nutIds.add(m.group_id);
      washerMap.set(m.user_id, w);
    }
  }

  if (boltIds.length > 0) {
    const { data: boltCoMembers } = await supabase
      .from("project_members")
      .select("project_id, user_id, profile:profiles(id, nickname, avatar_url)")
      .in("project_id", boltIds)
      .neq("user_id", userId)
      .limit(50);
    for (const m of (boltCoMembers ?? []) as any[]) {
      if (!m.profile) continue;
      const w = washerMap.get(m.user_id) ?? {
        nickname: m.profile.nickname,
        avatar_url: m.profile.avatar_url,
        nutIds: new Set<string>(),
        boltIds: new Set<string>(),
      };
      w.boltIds.add(m.project_id);
      washerMap.set(m.user_id, w);
    }
  }

  // 가장 많이 겹치는 사람 우선 — 12명 상한 (그래프 가독성)
  const washers = Array.from(washerMap.entries())
    .map(([id, w]) => ({
      id,
      nickname: w.nickname,
      avatar_url: w.avatar_url,
      nutIds: Array.from(w.nutIds),
      boltIds: Array.from(w.boltIds),
    }))
    .sort((a, b) => (b.nutIds.length + b.boltIds.length) - (a.nutIds.length + a.boltIds.length))
    .slice(0, 12);

  // ── 파일 — 사용자가 속한 볼트의 최근 첨부 (최대 6개)
  let files: MindMapData["files"] = [];
  if (boltIds.length > 0) {
    const { data: fileRows } = await supabase
      .from("file_attachments")
      .select("id, file_name, file_type, file_url, target_id, storage_type, file_size")
      .eq("target_type", "project")
      .in("target_id", boltIds)
      .order("created_at", { ascending: false })
      .limit(6);
    files = (fileRows ?? []).map((f: any) => ({
      id: f.id as string,
      name: f.file_name as string,
      fileType: f.file_type as string | null,
      url: f.file_url as string | null,
      projectId: f.target_id as string | null,
      storageType: f.storage_type as MindMapData["files"][number]["storageType"],
      sizeBytes: f.file_size as number | null,
    }));
  }

  // ── 탭(wiki_topics) — 사용자 너트들의 토픽 (최대 8개)
  let topics: MindMapData["topics"] = [];
  if (nutIds.length > 0) {
    const { data: topicRows } = await supabase
      .from("wiki_topics")
      .select("id, name, group_id")
      .in("group_id", nutIds)
      .order("created_at", { ascending: false })
      .limit(8);
    topics = (topicRows ?? []).map((t: any) => ({
      id: t.id as string,
      name: t.name as string,
      groupId: t.group_id as string,
    }));
  }

  return { nuts, bolts, schedule, issues, washers, topics, files };
}
