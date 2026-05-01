import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ ownerType: string; ownerId: string }>;
}

/** GET /api/spaces/{ownerType}/{ownerId}/activity?limit=50 */
export const GET = withRouteLog("spaces.activity", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }
  const limit = Math.min(200, Math.max(10, Number(new URL(req.url).searchParams.get("limit") || 50)));

  const { data, error } = await supabase
    .from("space_activity_log")
    .select("id, page_id, block_id, action, summary, created_at, actor_id, profiles:actor_id(nickname, avatar_url)")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
});
