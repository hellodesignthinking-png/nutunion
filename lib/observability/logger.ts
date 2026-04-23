/**
 * lib/observability/logger — 경량 구조화 JSON 로거.
 *
 * Vercel runtime logs 에서 검색/필터 가능한 JSON 포맷으로 출력.
 * Sentry/OTel 미도입 상태에서도 production debugging 이 가능하도록 기본 제공.
 *
 * 사용:
 *   import { log } from "@/lib/observability/logger";
 *
 *   // 정보
 *   log.info("chat.message.sent", { room_id, sender_id });
 *
 *   // 경고
 *   log.warn("ai.fallback.triggered", { from: "google", to: "openai", reason: err.message });
 *
 *   // 에러 — stack trace 자동 포함
 *   log.error(err, "db.insert.failed", { table: "polls", poll_id });
 *
 *   // 요청 scope 타이머
 *   const span = log.span("drive.upload");
 *   await doUpload();
 *   span.end({ bytes: file.size }); // level=info + duration_ms
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogRecord {
  level: LogLevel;
  ts: string;
  event: string;
  env?: string;
  app?: string;
  [key: string]: unknown;
}

const APP = "nutunion";
const ENV = process.env.VERCEL_ENV || process.env.NODE_ENV || "dev";

/** 에러 안전 직렬화 (순환참조/민감정보 필터) — WeakSet 기반 circular 방어 */
function safe(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (depth > 6) return "[truncated:depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && value !== null) {
    if (seen.has(value as object)) return "[circular]";
    seen.add(value as object);
  }
  if (value instanceof Error) {
    return {
      _error: true,
      name: value.name,
      message: value.message,
      stack: (value.stack || "").split("\n").slice(0, 10).join("\n"),
      cause: (value as any).cause ? safe((value as any).cause, depth + 1, seen) : undefined,
    };
  }
  if (typeof value === "string") {
    // 민감정보로 보이는 긴 토큰류 부분 마스킹 (bearer 패턴)
    if (value.length > 100 && /^(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,})/.test(value)) {
      return value.slice(0, 8) + "…[redacted]";
    }
    return value.length > 4000 ? value.slice(0, 4000) + "…[truncated]" : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => safe(v, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // 민감 키 마스킹
    if (/^(password|token|secret|authorization|cookie|api_key)$/i.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = safe(v, depth + 1, seen);
  }
  return out;
}

function emit(level: LogLevel, event: string, extra: Record<string, unknown> = {}) {
  const rec: LogRecord = {
    level,
    ts: new Date().toISOString(),
    app: APP,
    env: ENV,
    event,
    ...(safe(extra) as Record<string, unknown>),
  };
  const line = JSON.stringify(rec);
  // level 별 console 라우팅 — Vercel runtime logs 에서 색상/필터 유용
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, data: Record<string, unknown> = {}) => emit("debug", event, data),
  info:  (event: string, data: Record<string, unknown> = {}) => emit("info",  event, data),
  warn:  (event: string, data: Record<string, unknown> = {}) => emit("warn",  event, data),

  /** 에러 로깅 — Error 객체 + context */
  error: (err: unknown, event: string, data: Record<string, unknown> = {}) => {
    emit("error", event, { ...data, error: err instanceof Error ? err : { message: String(err) } });
  },

  /** 스팬 측정 — start → end 간격을 duration_ms 로 기록 */
  span: (event: string, data: Record<string, unknown> = {}) => {
    const start = Date.now();
    return {
      end: (extra: Record<string, unknown> = {}) => {
        emit("info", event, { ...data, ...extra, duration_ms: Date.now() - start });
      },
      fail: (err: unknown, extra: Record<string, unknown> = {}) => {
        emit("error", event, {
          ...data,
          ...extra,
          duration_ms: Date.now() - start,
          error: err instanceof Error ? err : { message: String(err) },
        });
      },
    };
  },
};

/**
 * Route handler 래퍼 — 자동으로 duration/status 로깅.
 *
 * 사용:
 *   export const GET = withRouteLog("profile.get", async (req) => { ... });
 */
export function withRouteLog<T extends (...args: any[]) => Promise<any>>(
  event: string,
  handler: T,
): T {
  return (async (...args: any[]) => {
    const span = log.span(event);
    try {
      const res = await handler(...args);
      span.end({ status: (res as any)?.status ?? 200 });
      return res;
    } catch (err) {
      span.fail(err);
      throw err;
    }
  }) as T;
}
