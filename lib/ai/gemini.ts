// Gemini API 호출 헬퍼 — 키를 URL 쿼리파라미터 대신 헤더로 전송해 로그 유출 차단.

const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiCallOptions {
  model?: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
}

export interface GeminiCallResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

/**
 * 키를 `x-goog-api-key` 헤더로 전송. URL에는 모델만 포함 → 로그/스택트레이스에 키 누출 방지.
 * 호출자는 GEMINI_API_KEY 존재를 사전 확인해야 함.
 */
export async function callGemini(opts: GeminiCallOptions): Promise<GeminiCallResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, status: 500, error: "GEMINI_API_KEY not configured" };
  }
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: errText.slice(0, 500) };
    }
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * meeting-summary에서 Supabase Storage 서명 URL을 서버사이드 fetch 할 때 SSRF 방어.
 * 환경의 SUPABASE_URL 도메인만 허용.
 */
export function isAllowedAudioUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supa) return false;
    const allowedHost = new URL(supa).host;
    return u.host === allowedHost;
  } catch {
    return false;
  }
}
