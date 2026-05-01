import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { enqueue } from "@/lib/workflow/queue";
import { aiError } from "@/lib/ai/error";

export const runtime = "nodejs";

/**
 * POST /api/ai/wiki-synthesis/trigger — 비동기 통합.
 * 즉시 202 + jobId 반환. 실제 실행은 /api/cron/process-jobs 에서.
 * 클라이언트는 /api/workflow/status/[jobId] 를 폴링.
 */
export const POST = withRouteLog("ai.wiki-synthesis.trigger", async (request: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "ai/wiki-synthesis/trigger");

  const body = await request.json().catch(() => ({}));
  const groupId = typeof body.groupId === "string" ? body.groupId : null;
  if (!groupId) return aiError("bad_input", "ai/wiki-synthesis/trigger");

  // 호스트 확인
  const { data: group } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return aiError("not_found", "ai/wiki-synthesis/trigger");
  if ((group as { host_id: string }).host_id !== user.id) {
    return aiError("forbidden", "ai/wiki-synthesis/trigger");
  }

  const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
  if (!success) return aiError("rate_limit", "ai/wiki-synthesis/trigger");

  // 이미 pending/running 잡이 있는지 확인 — 중복 방지
  const { data: existing } = await supabase
    .from("workflow_jobs")
    .select("id, status")
    .eq("task_type", "wiki-synthesis")
    .eq("group_id", groupId)
    .in("status", ["pending", "running"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { jobId: (existing[0] as { id: string }).id, status: "already_running" },
      { status: 202 }
    );
  }

  const result = await enqueue(supabase, {
    taskType: "wiki-synthesis",
    input: { groupId },
    userId: user.id,
    groupId,
  });

  if ("error" in result) {
    return aiError("server_error", "ai/wiki-synthesis/trigger", { internal: result.error });
  }

  return NextResponse.json({ jobId: result.jobId, status: "pending" }, { status: 202 });
});
