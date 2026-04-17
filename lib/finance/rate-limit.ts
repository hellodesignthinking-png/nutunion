// Supabase 기반 rate limit — 다중 인스턴스 공유 슬라이딩 윈도우
//
// 사용:
//   const limited = await checkRateLimit(supabase, `${user.id}:tx-create`, 10, 60);
//   if (!limited.allowed) {
//     return NextResponse.json(
//       { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
//       { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
//     );
//   }

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;  // ISO
  retryAfterSec: number;
}

/**
 * Supabase check_rate_limit RPC 호출.
 * @param key   제한 키. "<userId>:<routeName>" 또는 "<ip>:<routeName>" 형태 권장.
 * @param limit 허용 건수
 * @param windowSeconds 윈도우 길이 (초)
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] RPC error:", error.message);
      // 실패 시 fail-open — rate limit 장애가 본 기능을 막지 않게
      return { allowed: true, remaining: limit, resetAt: new Date().toISOString(), retryAfterSec: 0 };
    }
    const resetAt = (data as { reset_at: string }).reset_at;
    const now = Date.now();
    const retryMs = Math.max(0, new Date(resetAt).getTime() - now);
    return {
      allowed: (data as { allowed: boolean }).allowed,
      remaining: (data as { remaining: number }).remaining,
      resetAt,
      retryAfterSec: Math.ceil(retryMs / 1000),
    };
  } catch (err) {
    console.error("[rate-limit] unexpected:", err);
    return { allowed: true, remaining: limit, resetAt: new Date().toISOString(), retryAfterSec: 0 };
  }
}

/** Next.js Request 에서 IP 추출 (rate limit 키 생성용). */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** 429 응답 빌더. */
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: `요청이 너무 많습니다. ${result.retryAfterSec}초 후 다시 시도해주세요.`,
      retry_after: result.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt,
      },
    }
  );
}
