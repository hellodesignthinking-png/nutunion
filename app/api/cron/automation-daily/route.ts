/**
 * GET /api/cron/automation-daily
 *
 * Vercel cron — 매일 KST 09:00 (UTC 00:00) 실행.
 * schedule.daily_9am trigger 룰들을 호출한다.
 *
 * 보안: Authorization: Bearer CRON_SECRET 헤더 필수 (env 설정 시).
 */
import { NextRequest, NextResponse } from "next/server";
import { dispatchEvent } from "@/lib/automation/engine";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withRouteLog("cron.automation-daily", async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") || "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const startedAt = new Date().toISOString();
  try {
    await dispatchEvent("schedule.daily_9am", { fired_at: startedAt });
    return NextResponse.json({ ok: true, fired_at: startedAt });
  } catch (e: any) {
    log.error(e, "cron.automation_daily.failed", { fired_at: startedAt });
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
});
