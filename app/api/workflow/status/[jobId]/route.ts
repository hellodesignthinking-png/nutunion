import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { fetchJob } from "@/lib/workflow/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/workflow/status/[jobId] — 잡 상태 폴링 (본인 잡만) */
export const GET = withRouteLog("workflow.status.jobId", async (
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) => {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await fetchJob(supabase, jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RLS 가 이미 접근 가능 여부를 걸러주지만 방어선 하나 더
  return NextResponse.json({
    id: job.id,
    taskType: job.task_type,
    status: job.status,
    output: job.status === "completed" ? job.output : null,
    error: job.status === "failed" ? job.error_message : null,
    progress: {
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
    },
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  });
});
