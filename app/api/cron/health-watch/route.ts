import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/cron/health-watch
 *
 * Vercel Hobby 플랜: 일 1회 (00:00 UTC) 자동 호출 — 장기 장애 포착용.
 * Pro 플랜 업그레이드 시 vercel.json 의 schedule 을 */5 * * * * 로 변경
 * 하면 5분 간격 감시 가능.
 *
 * /api/health 를 체크해서 실패하면 ALERT_WEBHOOK_URL (Slack/Discord 웹훅)
 * 으로 알림 발송.
 *
 * 자기 자신을 호출하므로 Vercel edge/lambda 가 완전히 다운되면 감지 불가.
 * → 외부 UptimeRobot 과 중복 운영 권장 (docs/uptime-monitoring.md).
 *    이 크론은 앱은 살아있지만 DB 만 다운된 케이스 (절반 장애) 를 잡기 위한 것.
 *
 * 환경변수:
 *   · CRON_SECRET (필수)
 *   · ALERT_WEBHOOK_URL (선택 — 없으면 console.log 만)
 *   · ALERT_MENTION (선택 — Slack 의 <!channel> 등 prefix)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutunion.co.kr";
  const healthUrl = `${siteUrl}/api/health`;

  let status = 0;
  let body: Record<string, unknown> = {};
  let error: string | undefined;
  const t0 = Date.now();

  try {
    const res = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    try {
      body = await res.json();
    } catch {
      body = { raw: (await res.text()).slice(0, 200) };
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const duration_ms = Date.now() - t0;
  const healthy = status === 200 && (body as { status?: string }).status === "healthy";

  // 실패 시 웹훅 발송
  if (!healthy && process.env.ALERT_WEBHOOK_URL) {
    const mention = process.env.ALERT_MENTION ? `${process.env.ALERT_MENTION} ` : "";
    const text = `${mention}⚠️ *nutunion health check FAILED*
• URL: ${healthUrl}
• HTTP: ${status}
• Duration: ${duration_ms}ms
• Error: ${error ?? "(status not healthy)"}
• Details: \`${JSON.stringify(body).slice(0, 300)}\``;

    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Slack 과 Discord 양쪽 호환: text + content
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (whErr) {
      console.error("[health-watch] webhook failed:", whErr);
    }
  }

  return NextResponse.json({
    healthy,
    status,
    duration_ms,
    alerted: !healthy && !!process.env.ALERT_WEBHOOK_URL,
    body,
    error,
  });
}
