/**
 * GET /api/cron/insights-monthly
 *
 * 월간 AI 인사이트 리포트 — 매월 1일 10:00 KST (UTC 01:00).
 * 활성 사용자마다 지난 1달 활동을 집계, AI 3~5문장 + 트렌드(지난달 대비)를 저장.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { runInsights } from "../insights-weekly/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  log.info("cron.insights-monthly.invoked", { method: "GET" });
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      log.warn("cron.insights-monthly.unauthorized", {});
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    return await runInsights("monthly");
  } catch (e: any) {
    log.error(e, "cron.insights-monthly.failed", {});
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  log.info("cron.insights-monthly.invoked", { method: "POST" });
  return GET(req);
}
