// AI route 공통 에러 처리 — 내부 메시지를 클라이언트에 누출하지 않도록 일관화.
// 서버 로그에는 상세 기록, 클라이언트에는 안전한 일반 메시지.

import { NextResponse } from "next/server";

type ErrorCode =
  | "ai_unavailable"      // Gemini API 자체 실패 (rate limit, 5xx)
  | "ai_timeout"
  | "ai_bad_response"     // JSON 파싱 실패 등
  | "auth"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "bad_input"
  | "server_error";

const CLIENT_MESSAGES_KO: Record<ErrorCode, string> = {
  ai_unavailable: "AI 서비스 일시적 오류입니다. 잠시 후 다시 시도해주세요.",
  ai_timeout: "AI 응답 시간 초과. 다시 시도해주세요.",
  ai_bad_response: "AI 응답을 해석할 수 없습니다. 다시 시도해주세요.",
  auth: "로그인이 필요합니다.",
  forbidden: "권한이 없습니다.",
  not_found: "찾을 수 없습니다.",
  rate_limit: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  bad_input: "잘못된 입력입니다.",
  server_error: "서버 오류가 발생했습니다.",
};

const HTTP_STATUS: Record<ErrorCode, number> = {
  ai_unavailable: 502,
  ai_timeout: 504,
  ai_bad_response: 502,
  auth: 401,
  forbidden: 403,
  not_found: 404,
  rate_limit: 429,
  bad_input: 400,
  server_error: 500,
};

interface ErrorOptions {
  /** 서버 로그용 내부 메시지 — 클라이언트에 노출되지 않음 */
  internal?: unknown;
  /** 구조화 로그에 포함할 추가 컨텍스트 */
  context?: Record<string, unknown>;
}

/**
 * AI route 에러 응답.
 * - 클라이언트: 안전한 코드 + 일반 메시지
 * - 서버 로그: 구조화 JSON (code, internal, context, route)
 */
export function aiError(
  code: ErrorCode,
  route: string,
  opts: ErrorOptions = {}
): NextResponse {
  const status = HTTP_STATUS[code];
  const msg = CLIENT_MESSAGES_KO[code];

  const internal = opts.internal;
  const internalMsg =
    internal instanceof Error
      ? internal.message
      : typeof internal === "string"
        ? internal
        : internal
          ? JSON.stringify(internal).slice(0, 500)
          : undefined;

  // 구조화 로그
  console.error(
    JSON.stringify({
      level: "error",
      source: "ai",
      route,
      code,
      status,
      internal: internalMsg,
      context: opts.context,
      ts: new Date().toISOString(),
    })
  );

  return NextResponse.json({ error: msg, code }, { status });
}

/**
 * Gemini 호출 결과를 해석해 적절한 에러 코드로 매핑.
 */
export function mapGeminiError(
  httpStatus: number,
  body: string
): ErrorCode {
  if (httpStatus === 429) return "rate_limit";
  if (httpStatus >= 500) return "ai_unavailable";
  if (httpStatus === 408) return "ai_timeout";
  // 4xx 기타 — body 확인
  if (/quota|exceeded/i.test(body)) return "rate_limit";
  if (/invalid|schema|parse/i.test(body)) return "ai_bad_response";
  return "ai_unavailable";
}
