// 경량 Workflow 대체 — 장시간 AI 파이프라인용 Supabase-backed 잡 큐.
//
// 용법:
//   1) 클라이언트가 POST /api/workflow/trigger 로 잡 enqueue
//   2) 즉시 { jobId, status: "pending" } 반환 (202)
//   3) 크론 /api/cron/process-jobs 가 5분마다 처리
//   4) 클라이언트는 GET /api/workflow/status/[jobId] 폴링
//
// Vercel Workflow 정식 출시 시 이 파일만 교체하면 됨.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskType =
  | "wiki-synthesis"
  | "weekly-digest"
  | "venture-plan-generate"
  | "meeting-summary-long";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface WorkflowJob {
  id: string;
  task_type: TaskType;
  status: JobStatus;
  created_by: string | null;
  group_id: string | null;
  project_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface EnqueueInput {
  taskType: TaskType;
  input: Record<string, unknown>;
  userId: string;
  groupId?: string | null;
  projectId?: string | null;
  maxAttempts?: number;
}

export async function enqueue(
  supabase: SupabaseClient,
  args: EnqueueInput
): Promise<{ jobId: string } | { error: string }> {
  const { data, error } = await supabase
    .from("workflow_jobs")
    .insert({
      task_type: args.taskType,
      status: "pending",
      created_by: args.userId,
      group_id: args.groupId ?? null,
      project_id: args.projectId ?? null,
      input: args.input,
      max_attempts: args.maxAttempts ?? 3,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "enqueue failed" };
  return { jobId: data.id as string };
}

export async function fetchJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<WorkflowJob | null> {
  const { data } = await supabase
    .from("workflow_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  return (data as WorkflowJob | null) ?? null;
}

/**
 * 프로세서(service_role 만)가 호출.
 * pending 잡 N개를 running 으로 클레임 후 배열 반환.
 */
export async function claimPendingJobs(
  adminSupabase: SupabaseClient,
  limit = 5
): Promise<WorkflowJob[]> {
  // 단순 락 — running 으로 바꿔서 클레임. 동시성 높으면 advisory lock 필요.
  const { data: pending } = await adminSupabase
    .from("workflow_jobs")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(limit);

  const jobs = (pending as WorkflowJob[] | null) ?? [];
  if (jobs.length === 0) return [];

  const ids = jobs.map((j) => j.id);
  await adminSupabase
    .from("workflow_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), attempts: jobs[0].attempts + 1 })
    .in("id", ids);

  return jobs.map((j) => ({ ...j, status: "running", attempts: j.attempts + 1 }));
}

export async function completeJob(
  adminSupabase: SupabaseClient,
  jobId: string,
  output: Record<string, unknown>
): Promise<void> {
  await adminSupabase
    .from("workflow_jobs")
    .update({
      status: "completed",
      output,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);
}

export async function failJob(
  adminSupabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
  willRetry: boolean
): Promise<void> {
  await adminSupabase
    .from("workflow_jobs")
    .update({
      status: willRetry ? "pending" : "failed",
      error_message: errorMessage.slice(0, 500),
      completed_at: willRetry ? null : new Date().toISOString(),
    })
    .eq("id", jobId);
}
