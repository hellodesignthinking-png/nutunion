// Google API 라우트용 공용 에러 shape.
// googleapis 클라이언트가 throw 하는 에러를 타입 가드로 안전하게 분해.

export interface GoogleApiError {
  message?: string;
  code?: number;
  errors?: { message?: string; domain?: string; reason?: string }[];
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
        code?: number;
        status?: string;
        errors?: { message?: string; reason?: string }[];
      };
    };
  };
}

/** unknown → GoogleApiError (safe cast with shape hints) */
export function asGoogleErr(err: unknown): GoogleApiError {
  if (err && typeof err === "object") return err as GoogleApiError;
  return { message: typeof err === "string" ? err : "unknown error" };
}

/** 내부 원인 한 줄 요약 — 로그/detail 용 */
export function googleErrDetail(err: unknown): string {
  const e = asGoogleErr(err);
  return (
    e.response?.data?.error?.message ||
    e.errors?.[0]?.message ||
    e.message ||
    "Unknown error"
  );
}
