import { NextResponse } from "next/server";
import { log } from "./logger";

/**
 * 라우트 핸들러 표준 에러 응답 — log.error 후 동일 형태의 JSON NextResponse 반환.
 *
 * 사용 패턴:
 *   try {
 *     ... main work ...
 *     return NextResponse.json({ ok: true, ... });
 *   } catch (err) {
 *     return errorResponse("module.action", err, { user_id });
 *   }
 *
 * status 기본값 500. 4xx 의도적 거부는 errorResponse 보다 NextResponse.json 직접 사용.
 *
 * 왜 헬퍼:
 *   - 200+ 라우트가 try/catch 후 NextResponse.json({ error: e.message }, { status: 500 })
 *     로 에러를 삼키고 console 만 남김 → 운영 추적 불가.
 *   - 하나의 진입점으로 묶어 두면 향후 Sentry/OTel 통합도 한 군데서 처리.
 */
export function errorResponse(
  event: string,
  err: unknown,
  context: Record<string, unknown> = {},
  status = 500,
): NextResponse {
  log.error(err, event, context);
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json(
    { error: message, code: status === 500 ? "INTERNAL_ERROR" : `HTTP_${status}` },
    { status },
  );
}

/**
 * cron 라우트용 — Bearer ${CRON_SECRET} 인증 + try/catch + log.span 일체화.
 *
 * 사용:
 *   export const GET = cronHandler("cron.cleanup-leases", async () => {
 *     // 본문 — 응답 객체 반환
 *     return { ok: true, deleted: 42 };
 *   });
 */
import type { NextRequest } from "next/server";

export function cronHandler<T extends Record<string, unknown>>(
  event: string,
  fn: (req: NextRequest) => Promise<T>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = req.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      log.warn(`${event}.unauthorized`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const span = log.span(event);
    try {
      const result = await fn(req);
      span.end({ status: 200 });
      return NextResponse.json(result);
    } catch (err) {
      span.end({ status: 500 });
      log.error(err, `${event}.failed`);
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
