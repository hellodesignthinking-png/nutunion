/**
 * GET /api/cron/automation-log-cleanup
 *
 * Weekly cron — deletes:
 *   - automation_logs:       executed_at < now() - 30 days
 *   - automation_approvals:  status in ('approved','rejected','expired')
 *                            AND decided_at < now() - 30 days
 *
 * Schedule: `0 3 * * 0` (UTC Sun 03:00 = KST Sun noon).
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withRouteLog("cron.automation-log-cleanup", async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count: deleted_logs, error: logErr } = await admin
    .from("automation_logs")
    .delete({ count: "exact" })
    .lt("executed_at", cutoff);

  const { count: deleted_approvals, error: aprErr } = await admin
    .from("automation_approvals")
    .delete({ count: "exact" })
    .in("status", ["approved", "rejected", "expired"])
    .lt("decided_at", cutoff);

  const errors: string[] = [];
  if (logErr && !/relation .* does not exist/i.test(logErr.message)) errors.push(`logs: ${logErr.message}`);
  if (aprErr && !/relation .* does not exist/i.test(aprErr.message)) errors.push(`approvals: ${aprErr.message}`);

  return NextResponse.json({
    ok: errors.length === 0,
    deleted_logs: deleted_logs ?? 0,
    deleted_approvals: deleted_approvals ?? 0,
    cutoff,
    errors: errors.length ? errors : undefined,
  });
});
