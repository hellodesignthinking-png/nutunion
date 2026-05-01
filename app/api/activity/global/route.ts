import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/activity/global
 *
 * 사용자가 권한을 가진 모든 너트(group) + 볼트(project) 의 최근 활동을
 * 단일 타임라인으로 반환.
 *
 * 통합 소스
 *   - space_activity_log (page/block CRUD, share, mention)
 *   - crew_posts        (너트 새 글)
 *   - project_updates   (볼트 활동 글)
 *   - group_members     (신규 합류)
 *   - project_milestones(완료 마일스톤)
 *   - project_applications (신규 지원자, 본인이 lead/pm 인 경우만)
 *
 * Query
 *   ?since=ISO        — 이 시각 이후만
 *   ?limit=20         — 기본 30, 최대 100
 *   ?owner_type=nut|bolt&owner_id=uuid  — 특정 owner 만
 *   ?summary=1        — 노드별 미확인 건수 sumary 도 동봉
 */

type ActivityItem = {
  id: string;
  source_kind: "space" | "post" | "join" | "milestone" | "application" | "tap";
  owner_type: "nut" | "bolt";
  owner_id: string;
  owner_name: string;
  actor_id: string | null;
  actor_nickname: string | null;
  actor_avatar: string | null;
  action: string;
  summary: string;
  href: string;
  importance: 0 | 1 | 2;
  created_at: string;
};

type Row = Record<string, unknown>;

function pickOne<T = unknown>(v: unknown): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return v as T;
}

export const GET = withRouteLog("activity.global.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const limitRaw = parseInt(url.searchParams.get("limit") || "30", 10);
  const limit = Math.min(Math.max(limitRaw, 1), 100);
  const wantSummary = url.searchParams.get("summary") === "1";
  const filterOwnerType = url.searchParams.get("owner_type") as "nut" | "bolt" | null;
  const filterOwnerId = url.searchParams.get("owner_id");

  // ── 1) 멤버십 ─────────────────────────────────────────
  const [{ data: myGroups }, { data: myBolts }] = await Promise.all([
    supabase.from("group_members")
      .select("group_id, role").eq("user_id", user.id).eq("status", "active"),
    supabase.from("project_members")
      .select("project_id, role").eq("user_id", user.id),
  ]);

  let groupIds = (myGroups || []).map((m) => m.group_id as string);
  let boltIds  = (myBolts  || []).map((m) => m.project_id as string);
  if (filterOwnerType === "nut" && filterOwnerId) groupIds = groupIds.filter((g) => g === filterOwnerId);
  if (filterOwnerType === "bolt" && filterOwnerId) boltIds = boltIds.filter((b) => b === filterOwnerId);
  if (filterOwnerType === "nut" && !filterOwnerId) boltIds = [];
  if (filterOwnerType === "bolt" && !filterOwnerId) groupIds = [];

  const iAmPm = new Set(
    (myBolts || []).filter((m) => (m.role as string) === "lead" || (m.role as string) === "pm")
      .map((m) => m.project_id as string)
  );

  // ── 2) 이름 캐시 (group/project) ───────────────────────
  const [{ data: groupRows }, { data: projectRows }] = await Promise.all([
    groupIds.length > 0
      ? supabase.from("groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as Row[] }),
    boltIds.length > 0
      ? supabase.from("projects").select("id, title").in("id", boltIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const groupNames = new Map<string, string>();
  for (const g of groupRows || []) groupNames.set(g.id as string, (g.name as string) || "너트");
  const projectNames = new Map<string, string>();
  for (const p of projectRows || []) projectNames.set(p.id as string, (p.title as string) || "볼트");

  // ── 3) 통합 fetch (병렬) ────────────────────────────────
  const groupIn = groupIds.length > 0;
  const boltIn  = boltIds.length > 0;

  const [
    spaceRes,
    postsRes,
    updatesRes,
    joinsRes,
    msRes,
    appsRes,
  ] = await Promise.all([
    (groupIn || boltIn)
      ? supabase.from("space_activity_log")
          .select("id, owner_type, owner_id, page_id, action, summary, created_at, actor:profiles!space_activity_log_actor_id_fkey(id, nickname, avatar_url)")
          .or(
            [
              groupIn ? `and(owner_type.eq.nut,owner_id.in.(${groupIds.join(",")}))` : null,
              boltIn  ? `and(owner_type.eq.bolt,owner_id.in.(${boltIds.join(",")}))` : null,
            ].filter(Boolean).join(",")
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Row[] }),
    groupIn
      ? supabase.from("crew_posts")
          .select("id, content, type, created_at, group_id, author:profiles!crew_posts_author_id_fkey(id, nickname, avatar_url)")
          .in("group_id", groupIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Row[] }),
    boltIn
      ? supabase.from("project_updates")
          .select("id, content, type, created_at, project_id, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
          .in("project_id", boltIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Row[] }),
    groupIn
      ? supabase.from("group_members")
          .select("user_id, group_id, joined_at, profile:profiles!group_members_user_id_fkey(id, nickname, avatar_url)")
          .in("group_id", groupIds)
          .eq("status", "active")
          .gte("joined_at", since)
          .order("joined_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Row[] }),
    boltIn
      ? supabase.from("project_milestones")
          .select("id, title, status, project_id, updated_at")
          .in("project_id", boltIds)
          .eq("status", "completed")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Row[] }),
    iAmPm.size > 0
      ? supabase.from("project_applications")
          .select("id, project_id, status, created_at, applicant:profiles!project_applications_applicant_id_fkey(id, nickname, avatar_url)")
          .in("project_id", [...iAmPm])
          .eq("status", "pending")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const items: ActivityItem[] = [];

  // 3-1) space_activity_log
  for (const r of (spaceRes.data || []) as Row[]) {
    const actor = pickOne<{ id: string; nickname: string; avatar_url: string | null }>(r.actor);
    const ownerType = r.owner_type as "nut" | "bolt";
    const ownerId = r.owner_id as string;
    const ownerName = ownerType === "nut" ? (groupNames.get(ownerId) || "너트") : (projectNames.get(ownerId) || "볼트");
    const action = r.action as string;
    const baseHref = ownerType === "nut" ? `/groups/${ownerId}` : `/projects/${ownerId}`;
    items.push({
      id: `space-${r.id as string}`,
      source_kind: "space",
      owner_type: ownerType,
      owner_id: ownerId,
      owner_name: ownerName,
      actor_id: actor?.id ?? null,
      actor_nickname: actor?.nickname ?? null,
      actor_avatar: actor?.avatar_url ?? null,
      action,
      summary: (r.summary as string) || actionLabel(action),
      href: r.page_id ? `${baseHref}?page=${r.page_id as string}` : baseHref,
      importance: action === "page.shared" || action === "page.deleted" ? 2 : 1,
      created_at: r.created_at as string,
    });
  }

  // 3-2) crew_posts (너트)
  for (const r of (postsRes.data || []) as Row[]) {
    const a = pickOne<{ id: string; nickname: string; avatar_url: string | null }>(r.author);
    const gid = r.group_id as string;
    items.push({
      id: `post-${r.id as string}`,
      source_kind: "post",
      owner_type: "nut",
      owner_id: gid,
      owner_name: groupNames.get(gid) || "너트",
      actor_id: a?.id ?? null,
      actor_nickname: a?.nickname ?? null,
      actor_avatar: a?.avatar_url ?? null,
      action: "nut.post",
      summary: ((r.content as string) || "").slice(0, 120),
      href: `/groups/${gid}`,
      importance: r.type === "announcement" ? 2 : 1,
      created_at: r.created_at as string,
    });
  }

  // 3-3) project_updates (볼트)
  for (const r of (updatesRes.data || []) as Row[]) {
    const a = pickOne<{ id: string; nickname: string; avatar_url: string | null }>(r.author);
    const pid = r.project_id as string;
    const t = (r.type as string) || "post";
    items.push({
      id: `update-${r.id as string}`,
      source_kind: "post",
      owner_type: "bolt",
      owner_id: pid,
      owner_name: projectNames.get(pid) || "볼트",
      actor_id: a?.id ?? null,
      actor_nickname: a?.nickname ?? null,
      actor_avatar: a?.avatar_url ?? null,
      action: t === "milestone_update" ? "bolt.milestone_update" : t === "status_change" ? "bolt.status_change" : "bolt.post",
      summary: ((r.content as string) || "").slice(0, 120),
      href: `/projects/${pid}?tab=activity`,
      importance: t === "status_change" ? 2 : 1,
      created_at: r.created_at as string,
    });
  }

  // 3-4) joins
  for (const r of (joinsRes.data || []) as Row[]) {
    if ((r.user_id as string) === user.id) continue;
    const p = pickOne<{ id: string; nickname: string; avatar_url: string | null }>(r.profile);
    const gid = r.group_id as string;
    items.push({
      id: `join-${r.user_id as string}-${gid}`,
      source_kind: "join",
      owner_type: "nut",
      owner_id: gid,
      owner_name: groupNames.get(gid) || "너트",
      actor_id: p?.id ?? null,
      actor_nickname: p?.nickname ?? null,
      actor_avatar: p?.avatar_url ?? null,
      action: "nut.join",
      summary: `${p?.nickname || "새 와셔"} 합류`,
      href: `/groups/${gid}/members`,
      importance: 1,
      created_at: r.joined_at as string,
    });
  }

  // 3-5) milestones
  for (const r of (msRes.data || []) as Row[]) {
    const pid = r.project_id as string;
    items.push({
      id: `ms-${r.id as string}`,
      source_kind: "milestone",
      owner_type: "bolt",
      owner_id: pid,
      owner_name: projectNames.get(pid) || "볼트",
      actor_id: null,
      actor_nickname: null,
      actor_avatar: null,
      action: "bolt.milestone_done",
      summary: `마일스톤 완료 — ${r.title as string}`,
      href: `/projects/${pid}`,
      importance: 2,
      created_at: r.updated_at as string,
    });
  }

  // 3-6) applications (lead 만)
  for (const r of (appsRes.data || []) as Row[]) {
    const a = pickOne<{ id: string; nickname: string; avatar_url: string | null }>(r.applicant);
    const pid = r.project_id as string;
    items.push({
      id: `app-${r.id as string}`,
      source_kind: "application",
      owner_type: "bolt",
      owner_id: pid,
      owner_name: projectNames.get(pid) || "볼트",
      actor_id: a?.id ?? null,
      actor_nickname: a?.nickname ?? null,
      actor_avatar: a?.avatar_url ?? null,
      action: "bolt.application",
      summary: `신규 지원 — ${a?.nickname || "와셔"}`,
      href: `/projects/${pid}/applications`,
      importance: 2,
      created_at: r.created_at as string,
    });
  }

  // ── 4) sort + limit ──────────────────────────────────
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sliced = items.slice(0, limit);

  // ── 5) summary (선택) — owner 별 미확인 카운트 ────────
  let summary: { unread: Record<string, number>; cursors: Record<string, string> } | undefined;
  if (wantSummary) {
    const { data: cursors } = await supabase
      .from("activity_read_cursors")
      .select("owner_type, owner_id, last_read_at")
      .eq("user_id", user.id);
    const cursorMap = new Map<string, string>();
    for (const c of cursors || []) cursorMap.set(`${c.owner_type}:${c.owner_id}`, c.last_read_at as string);

    const unread: Record<string, number> = {};
    for (const it of items) {
      const key = `${it.owner_type}:${it.owner_id}`;
      const cursor = cursorMap.get(key);
      if (!cursor || new Date(it.created_at) > new Date(cursor)) {
        unread[key] = (unread[key] || 0) + 1;
      }
    }
    summary = { unread, cursors: Object.fromEntries(cursorMap) };
  }

  return NextResponse.json({
    items: sliced,
    total: items.length,
    since,
    summary,
  });
});

function actionLabel(a: string): string {
  switch (a) {
    case "page.created": return "페이지 생성";
    case "page.updated": return "페이지 편집";
    case "page.deleted": return "페이지 삭제";
    case "page.shared":  return "외부 공유 활성";
    case "page.unshared":return "외부 공유 해제";
    case "block.created":return "블록 추가";
    case "block.updated":return "블록 편집";
    case "block.deleted":return "블록 삭제";
    default: return a;
  }
}
