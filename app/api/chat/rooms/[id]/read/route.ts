/**
 * POST /api/chat/rooms/[id]/read
 *  — 본인의 chat_members.last_read_at 을 now() 로 갱신. debounce 된 클라이언트에서 호출.
 *  — service_role 로 RLS 우회.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
type Ctx = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const POST = withRouteLog("chat.rooms.id.read", async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminClient() || supabase;
  const { error } = await db
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", id)
    .eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
