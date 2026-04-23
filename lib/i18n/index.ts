// 경량 i18n 스캐폴드 — next-intl 정식 도입 전 최소 구현.
// 쿠키 `nu_locale` 로 ko/en 선택. 서버/클라이언트 양쪽에서 dict 조회 가능.

import ko from "@/messages/ko.json";
import en from "@/messages/en.json";

export type Locale = "ko" | "en";
export const LOCALES: Locale[] = ["ko", "en"];
export const DEFAULT_LOCALE: Locale = "ko";

const DICTS: Record<Locale, Record<string, unknown>> = { ko, en };

export function getDict(locale: Locale): Record<string, unknown> {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

/** "nav.home" 같은 점 경로로 값 추출. 없으면 key 그대로. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = getDict(locale);
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  if (typeof cur !== "string") return key;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** 서버 컴포넌트용 — cookies() 에서 locale 추출 */
export async function getServerLocale(): Promise<Locale> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const v = store.get("nu_locale")?.value;
  return v === "en" || v === "ko" ? v : DEFAULT_LOCALE;
}
