import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/activity/cursor
 *   body: { owner_type: 'nut'|'bolt', owner_id: uuid, at?: ISO }
 *   → upsert activity_read_cursors. at 미지정 시 now().
 *
 * GET /api/activity/cursor
 *   → 사용자 전체 커서 맵 반환
 */

export const POST = withRouteLog("activity.cursor.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    owner_type?: "nut" | "bolt";
    owner_id?: string;
    at?: string;
  } | null;
  if (!body?.owner_type || !body.owner_id) {
    return NextResponse.json({ error: "owner_type and owner_id required" }, { status: 400 });
  }
  if (body.owner_type !== "nut" && body.owner_type !== "bolt") {
    return NextResponse.json({ error: "invalid owner_type" }, { status: 400 });
  }

  const at = body.at && !Number.isNaN(new Date(body.at).getTime()) ? body.at : new Date().toISOString();
  const { error } = await supabase
    .from("activity_read_cursors")
    .upsert({ user_id: user.id, owner_type: body.owner_type, owner_id: body.owner_id, last_read_at: at },
      { onConflict: "user_id,owner_type,owner_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, last_read_at: at });
});

export const GET = withRouteLog("activity.cursor.get", async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("activity_read_cursors")
    .select("owner_type, owner_id, last_read_at")
    .eq("user_id", user.id);
  return NextResponse.json({ cursors: data ?? [] });
});
