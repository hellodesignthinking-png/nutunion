import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ ownerType: string; ownerId: string }>;
}

/**
 * GET /api/spaces/{ownerType}/{ownerId}/analytics
 *   → { totals, daily, top_contributors, top_pages }
 *
 * 활동 로그를 30일 윈도우로 집계.
 */
export const GET = withRouteLog("spaces.analytics", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1) totals — 페이지/블록/공유 카운트
  const [pagesRes, blocksRes, sharedRes, activityRes] = await Promise.all([
    supabase.from("space_pages").select("id", { count: "exact", head: true })
      .eq("owner_type", ownerType).eq("owner_id", ownerId),
    supabase.from("space_pages").select("id, space_page_blocks(count)")
      .eq("owner_type", ownerType).eq("owner_id", ownerId),
    supabase.from("space_pages").select("id", { count: "exact", head: true })
      .eq("owner_type", ownerType).eq("owner_id", ownerId).not("share_token", "is", null),
    supabase.from("space_activity_log")
      .select("action, actor_id, page_id, created_at, profiles:actor_id(nickname)")
      .eq("owner_type", ownerType).eq("owner_id", ownerId)
      .gte("created_at", since)
      .limit(2000),
  ]);

  const blockCount = (blocksRes.data ?? []).reduce((sum: number, p: any) => {
    const c = p.space_page_blocks?.[0]?.count ?? 0;
    return sum + c;
  }, 0);

  type RawActivity = {
    action: string;
    actor_id: string | null;
    page_id: string | null;
    created_at: string;
    profiles: { nickname: string } | { nickname: string }[] | null;
  };
  const rawActivities = (activityRes.data ?? []) as unknown as RawActivity[];
  const activities = rawActivities.map((a) => ({
    action: a.action,
    actor_id: a.actor_id,
    page_id: a.page_id,
    created_at: a.created_at,
    profiles: Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : a.profiles,
  }));

  // 2) daily — 30일 활동 카운트
  const dailyMap = new Map<string, number>();
  for (const a of activities) {
    const day = a.created_at.slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3) top contributors
  const contribMap = new Map<string, { actor_id: string; nickname: string; count: number }>();
  for (const a of activities) {
    if (!a.actor_id) continue;
    const cur = contribMap.get(a.actor_id) ?? {
      actor_id: a.actor_id,
      nickname: a.profiles?.nickname ?? "익명",
      count: 0,
    };
    cur.count++;
    contribMap.set(a.actor_id, cur);
  }
  const top_contributors = Array.from(contribMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4) top pages — 활동 많은 페이지
  const pageMap = new Map<string, number>();
  for (const a of activities) {
    if (!a.page_id) continue;
    pageMap.set(a.page_id, (pageMap.get(a.page_id) ?? 0) + 1);
  }
  const topPageIds = Array.from(pageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let top_pages: Array<{ id: string; title: string; icon: string; count: number }> = [];
  if (topPageIds.length > 0) {
    const { data: pageRows } = await supabase
      .from("space_pages")
      .select("id, title, icon")
      .in("id", topPageIds);
    top_pages = (pageRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      icon: p.icon || "📄",
      count: pageMap.get(p.id) ?? 0,
    })).sort((a, b) => b.count - a.count);
  }

  // 5) action 분포
  const actionMap = new Map<string, number>();
  for (const a of activities) {
    actionMap.set(a.action, (actionMap.get(a.action) ?? 0) + 1);
  }

  return NextResponse.json({
    totals: {
      pages: pagesRes.count ?? 0,
      blocks: blockCount,
      shared: sharedRes.count ?? 0,
      activities_30d: activities.length,
    },
    daily,
    top_contributors,
    top_pages,
    actions: Array.from(actionMap.entries()).map(([action, count]) => ({ action, count })),
    window_days: 30,
  });
});
