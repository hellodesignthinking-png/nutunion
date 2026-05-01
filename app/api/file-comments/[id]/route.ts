/**
 * /api/file-comments/[id]
 *   DELETE → 작성자 본인만 삭제 가능 (RLS 정책 + 안전 체크)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";

export const DELETE = withRouteLog("file-comments.id", async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("file_comments")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    log.error(error, "file_comments.delete.failed", { id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
