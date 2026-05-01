import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/read-all
 *  — 본인의 모든 미독 알림 read 처리.
 */
export const POST = withRouteLog("notifications.read-all", async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error, count } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", auth.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[notifications.read-all POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: count || 0 });
});
