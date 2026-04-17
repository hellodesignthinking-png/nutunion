import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * 공개 헬스 체크 엔드포인트.
 * - DB 연결 상태
 * - 응답 시간
 *
 * 업타임 모니터 (UptimeRobot, BetterUptime 등) 에서 주기 호출.
 * 민감 정보 비노출.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; duration_ms?: number; error?: string }> = {};

  // 1. DB 연결 ping (profiles 테이블 head count)
  try {
    const t0 = Date.now();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .limit(0);
    checks.database = error
      ? { ok: false, duration_ms: Date.now() - t0, error: error.message.slice(0, 100) }
      : { ok: true, duration_ms: Date.now() - t0 };
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message.slice(0, 100) : "unknown" };
  }

  // 2. 환경변수 체크 (값은 노출 안 함, 존재 여부만)
  checks.env = {
    ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      duration_ms: totalMs,
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
