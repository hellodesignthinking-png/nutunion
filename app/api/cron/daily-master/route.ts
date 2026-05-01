/**
 * GET /api/cron/daily-master
 *
 * Hobby 플랜 cron 한도 대응 — 단일 마스터 스케줄러.
 * Vercel.json 에는 이 cron 만 매일 UTC 00:00(09:00 KST) 등록.
 *
 * 내부적으로 KST 기반 요일/일자 조건에 따라 분기:
 *   - 매일       → automation-daily   (schedule.daily_9am 트리거)
 *   - 월요일     → insights-weekly    (지난 주 인사이트)
 *   - 1일        → insights-monthly   (지난 달 인사이트)
 *   - 일요일     → automation-log-cleanup
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { dispatchEvent } from "@/lib/automation/engine";
import { runInsights } from "../insights-weekly/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withRouteLog("cron.daily-master.get", async (req: NextRequest) => {
  log.info("cron.daily-master.invoked", {});
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      log.warn("cron.daily-master.unauthorized", {});
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  // KST = UTC + 9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstDow = kst.getUTCDay(); // 0=Sun, 1=Mon
  const kstDate = kst.getUTCDate();

  const summary: Record<string, any> = { kst_dow: kstDow, kst_date: kstDate, ran: [] };

  // 1) Automation daily (every day)
  try {
    await dispatchEvent("schedule.daily_9am", { fired_at: now.toISOString() });
    summary.ran.push("automation-daily");
    log.info("cron.daily-master.automation-daily.ok", {});
  } catch (e: any) {
    log.warn("cron.daily-master.automation-daily.failed", { error: e?.message });
    summary.automation_daily_error = e?.message;
  }

  // 2) Weekly insights on Monday (KST)
  if (kstDow === 1) {
    try {
      const res = await runInsights("weekly");
      const body = await res.json().catch(() => ({}));
      summary.ran.push("insights-weekly");
      summary.insights_weekly = body;
    } catch (e: any) {
      log.warn("cron.daily-master.insights-weekly.failed", { error: e?.message });
      summary.insights_weekly_error = e?.message;
    }
  }

  // 3) Monthly insights on 1st of month (KST)
  if (kstDate === 1) {
    try {
      const res = await runInsights("monthly");
      const body = await res.json().catch(() => ({}));
      summary.ran.push("insights-monthly");
      summary.insights_monthly = body;
    } catch (e: any) {
      log.warn("cron.daily-master.insights-monthly.failed", { error: e?.message });
      summary.insights_monthly_error = e?.message;
    }
  }

  // 4) Automation log cleanup on Sunday (KST)
  if (kstDow === 0) {
    try {
      const origin = req.nextUrl.origin;
      const r = await fetch(`${origin}/api/cron/automation-log-cleanup`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
      summary.ran.push("automation-log-cleanup");
      summary.automation_log_cleanup_status = r.status;
    } catch (e: any) {
      log.warn("cron.daily-master.log-cleanup.failed", { error: e?.message });
      summary.log_cleanup_error = e?.message;
    }
  }

  log.info("cron.daily-master.completed", summary);
  return NextResponse.json({ ok: true, ...summary });
});

export const POST = withRouteLog("cron.daily-master.post", async (req: NextRequest) => {
  return GET(req);
});
