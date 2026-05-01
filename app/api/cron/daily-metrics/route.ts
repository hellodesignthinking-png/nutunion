import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily metrics 집계 — pg_cron 부재 환경 fallback.
 * Vercel Cron (매일 00:05 UTC = 09:05 KST) 에서 호출.
 * pg_cron 이 이미 활성이면 중복 upsert 되지만 on conflict 처리로 안전.
 */
export const GET = withRouteLog("cron.daily-metrics", async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  // 어제 날짜 (KST 기준 — UTC +9h 보정)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCHours(0, 0, 0, 0);
  kstNow.setUTCDate(kstNow.getUTCDate() - 1);
  const targetDate = kstNow.toISOString().slice(0, 10);

  try {
    const { error } = await db.rpc("compute_daily_metrics", { target_date: targetDate });
    if (error) {
      log.warn("cron.daily_metrics.rpc_failed", { target_date: targetDate, error_message: error.message });
      return NextResponse.json({ error: error.message, targetDate }, { status: 500 });
    }
    log.info("cron.daily_metrics.ok", { target_date: targetDate });
    return NextResponse.json({ ok: true, targetDate });
  } catch (err: any) {
    log.error(err, "cron.daily_metrics.failed", { target_date: targetDate });
    return NextResponse.json({ error: err.message || "unknown", targetDate }, { status: 500 });
  }
});
