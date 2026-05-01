/**
 * POST /api/admin/threads/approve
 *
 * Admin 이 code-mode Thread 의 approval_status 를 변경.
 * Body: { thread_id: string; status: "approved" | "rejected"; reason?: string }
 *
 * 모든 변경은 thread_approval_audit 에 기록.
 * 마이그레이션 138 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { log } from "@/lib/observability/logger";

export const POST = withRouteLog("admin.threads.approve", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") {
    log.warn("admin.threads.approve.forbidden", { user_id: user.id });
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const threadId: string | undefined = body?.thread_id;
  const status: string | undefined = body?.status;
  const reason: string | undefined = body?.reason;

  if (!threadId || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json({ error: "thread_id + status(approved|rejected) required" }, { status: 400 });
  }

  // 현재 status 조회
  const { data: thread, error: getErr } = await supabase
    .from("threads")
    .select("id, approval_status, ui_component")
    .eq("id", threadId)
    .maybeSingle();
  if (getErr) {
    if (/approval_status|column .* does not exist/i.test(getErr.message)) {
      return NextResponse.json({ error: "마이그 138 미적용", code: "MIGRATION_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!thread) return NextResponse.json({ error: "thread_not_found" }, { status: 404 });

  const fromStatus = (thread as any).approval_status as string | null;

  // 업데이트
  const { error: updErr } = await supabase
    .from("threads")
    .update({ approval_status: status })
    .eq("id", threadId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // audit
  await supabase.from("thread_approval_audit").insert({
    thread_id: threadId,
    from_status: fromStatus,
    to_status: status,
    changed_by: user.id,
    reason: reason || null,
  });

  log.info("admin.threads.approve.ok", {
    thread_id: threadId,
    from: fromStatus,
    to: status,
    by: user.id,
  });

  return NextResponse.json({ ok: true, thread_id: threadId, status });
});
