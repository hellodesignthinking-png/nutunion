/**
 * GET /api/cron/cleanup-leases
 *
 * resource_leases (마이그레이션 136) 의 좀비 lock 청소.
 *
 * 정상 흐름은 release_lease 가 lock 을 즉시 풀지만, 함수 timeout/crash 로
 * release 를 못 부른 케이스가 누적될 수 있다. cleanup_stale_leases RPC 가
 * 60분 넘은 lock 을 모두 삭제 — 보수적 TTL.
 *
 * 인증: Bearer ${CRON_SECRET}
 *
 * 마이그레이션 136 미적용 환경에서는 RPC 부재로 graceful no-op.
 */

import { tryAdminClient } from "@/lib/supabase/admin";
import { cronHandler } from "@/lib/observability/route-handler";
import { log } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STALE_AFTER_MINUTES = 60;

// cronHandler 가 Bearer 인증 + log.span + try/catch 일체화. 본문은 결과 객체만 반환.
export const GET = cronHandler("cron.cleanup_leases", async () => {
  const supabase = tryAdminClient();
  if (!supabase) throw new Error("Supabase admin not configured");

  const t0 = Date.now();
  const { data, error } = await supabase.rpc("cleanup_stale_leases", {
    p_max_age_minutes: STALE_AFTER_MINUTES,
  });
  const duration = Date.now() - t0;

  if (error) {
    // RPC 미존재(42883) 또는 테이블 미존재(42P01) → 마이그레이션 136 미적용. 200 + skipped.
    if ((error as any).code === "42883" || (error as any).code === "42P01") {
      log.info("cron.cleanup_leases.skipped", { reason: "migration_136_missing" });
      return { ok: true, skipped: true, reason: "migration_136_missing" };
    }
    throw new Error(error.message);
  }

  const deleted = typeof data === "number" ? data : 0;
  return { ok: true, deleted, duration_ms: duration };
});
