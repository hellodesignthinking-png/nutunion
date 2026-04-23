/**
 * POST /api/insights/generate
 *
 * User-facing endpoint for manually triggering an insight report for the
 * currently authenticated user only. Wraps the shared `runInsights` helper
 * (same logic as the cron) but scoped to `[user.id]`.
 *
 * Body: { period: "weekly" | "monthly" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runInsights } from "@/app/api/cron/insights-weekly/route";
import { log } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let period: "weekly" | "monthly" = "weekly";
    try {
      const body = await req.json();
      if (body?.period === "monthly") period = "monthly";
    } catch { /* empty body → default weekly */ }

    log.info("insights.generate.invoked", { user_id: user.id, period });
    return await runInsights(period, [user.id]);
  } catch (e: any) {
    log.error(e, "insights.generate.failed", {});
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
