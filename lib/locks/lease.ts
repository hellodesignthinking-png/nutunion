import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TTL 기반 분산 lock — 같은 자원에 대해 cron + 사용자 호출이 겹쳐 R2 PUT/Drive export 를
 * 중복 수행하는 것을 막는다.
 *
 * 마이그레이션 136 의 try_acquire_lease/release_lease RPC 를 호출. 마이그레이션이 아직
 * 적용되지 않았으면 RPC 부재로 lock 없이 진행 (graceful degrade).
 */
export async function tryAcquireLease(
  supabase: SupabaseClient,
  key: string,
  userId: string,
  ttlSeconds = 90,
): Promise<{ acquired: boolean; degraded: boolean }> {
  try {
    const { data, error } = await supabase.rpc("try_acquire_lease", {
      p_key: key,
      p_user: userId,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) {
      // RPC 미존재(42883) 또는 lease 테이블 미존재(42P01) → 마이그레이션 136 미적용. lock 없이 통과.
      if ((error as any).code === "42883" || (error as any).code === "42P01") {
        return { acquired: true, degraded: true };
      }
      // 그 외 오류 — lock 으로 막기보다 통과시켜 작업 진행 (lock 자체가 부수적 보호)
      return { acquired: true, degraded: true };
    }
    return { acquired: data === true, degraded: false };
  } catch {
    return { acquired: true, degraded: true };
  }
}

export async function releaseLease(
  supabase: SupabaseClient,
  key: string,
  userId: string,
): Promise<void> {
  try {
    await supabase.rpc("release_lease", { p_key: key, p_user: userId });
  } catch {
    // best-effort; TTL이 받쳐주므로 안전
  }
}
