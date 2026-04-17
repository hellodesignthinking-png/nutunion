import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/cleanup-audit-logs
 *
 * Vercel Cron 전용 엔드포인트.
 * - 인증: `Authorization: Bearer <CRON_SECRET>`
 * - service_role key 로 RLS 우회 (크론은 사용자 세션 없음)
 * - 삭제:
 *   · finance_audit_logs: 90일 이상
 *   · ai_usage_logs: 180일 이상
 *   · rate_limits: 1일 이상 (updated_at 기준, 만료된 카운터만)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron] CRON_SECRET 미설정");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error("[cron] Supabase service role 미설정");
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const supabase = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const results: Record<string, { deleted: number; error?: string }> = {};

  // 1) finance_audit_logs — 90일 이상
  {
    const { error, count } = await supabase
      .from("finance_audit_logs")
      .delete({ count: "exact" })
      .lt("created_at", ninetyDaysAgo);
    results.finance_audit_logs = { deleted: count ?? 0, error: error?.message };
  }

  // 2) ai_usage_logs — 180일 이상
  {
    const { error, count } = await supabase
      .from("ai_usage_logs")
      .delete({ count: "exact" })
      .lt("created_at", oneEightyDaysAgo);
    results.ai_usage_logs = { deleted: count ?? 0, error: error?.message };
  }

  // 3) rate_limits — updated_at 1일 이상 (만료된 카운터)
  {
    const { error, count } = await supabase
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("updated_at", oneDayAgo);
    results.rate_limits = { deleted: count ?? 0, error: error?.message };
  }

  const durationMs = Date.now() - startedAt;
  const totalDeleted = Object.values(results).reduce((s, r) => s + r.deleted, 0);

  console.log("[cron] cleanup-audit-logs", { results, durationMs, totalDeleted });

  return NextResponse.json({
    success: true,
    duration_ms: durationMs,
    total_deleted: totalDeleted,
    results,
  });
}
