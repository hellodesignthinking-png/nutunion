/**
 * POST /api/chat/messages/[id]/thread/read
 *  → upsert chat_thread_reads (current user, parent_message_id=id).
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = withRouteLog("chat.messages.id.thread.read", async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("chat_thread_reads")
    .upsert(
      { user_id: auth.user.id, parent_message_id: id, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,parent_message_id" },
    );
  if (error) {
    // 119 미적용
    return NextResponse.json({ ok: false, hint: "migration 119 needed" }, { status: 501 });
  }
  return NextResponse.json({ ok: true });
});
