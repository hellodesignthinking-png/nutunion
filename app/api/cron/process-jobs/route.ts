import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { claimPendingJobs, completeJob, failJob, type WorkflowJob } from "@/lib/workflow/queue";
import { log } from "@/lib/observability/logger";
import { runWikiSynthesis } from "@/lib/ai/wiki-synthesis-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/process-jobs — 5분마다 실행
 *
 * workflow_jobs 의 pending 잡을 클레임 후 task_type 별로 처리.
 * 실제 처리 로직은 프로세서 함수에 등록.
 * 단일 실행 내 최대 5건. 완료되지 못한 잡은 다음 크론에서 재시도.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase admin 미설정" }, { status: 500 });
  }
  const admin = createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const jobs = await claimPendingJobs(admin, 5);
  const results: { jobId: string; status: string; error?: string }[] = [];
  const processors = buildProcessors(admin);

  for (const job of jobs) {
    try {
      const processor = processors[job.task_type] ?? PROCESSORS[job.task_type];
      if (!processor) {
        await failJob(admin, job.id, `unknown task_type: ${job.task_type}`, false);
        results.push({ jobId: job.id, status: "failed", error: "unknown task" });
        continue;
      }
      const output = await processor(job);
      await completeJob(admin, job.id, output);
      results.push({ jobId: job.id, status: "completed" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const willRetry = job.attempts < job.max_attempts;
      await failJob(admin, job.id, msg, willRetry);
      results.push({ jobId: job.id, status: willRetry ? "retry" : "failed", error: msg });
      log.warn("cron.process_jobs.job_failed", { job_id: job.id, will_retry: willRetry, error_message: msg });
    }
  }

  return NextResponse.json({ processed: jobs.length, results });
}

// ── 프로세서 레지스트리 ──────────────────────────────────────
// 각 task_type 별로 실제 로직을 등록. 여기서는 스텁만 — 실제 이식 시
// AI routes 의 핵심 로직을 분리해 import.

type Processor = (job: WorkflowJob) => Promise<Record<string, unknown>>;

// 프로세서는 admin supabase client 를 받아야 RLS 를 우회해 작성 가능.
// GET 핸들러에서 admin 을 전역으로 만들 수 없으니 closure 패턴.
function buildProcessors(
  admin: import("@supabase/supabase-js").SupabaseClient
): Partial<Record<string, Processor>> {
  return {
    "wiki-synthesis": async (job) => {
      const input = job.input as { groupId?: string };
      if (!input.groupId) throw new Error("missing groupId");
      if (!job.created_by) throw new Error("missing created_by");
      const output = await runWikiSynthesis(admin, input.groupId, job.created_by);
      return output as Record<string, unknown>;
    },
    // 추후 이식 예정: weekly-digest, meeting-summary-long, venture-plan-generate
  };
}

const PROCESSORS: Partial<Record<string, Processor>> = {}; // compat placeholder
