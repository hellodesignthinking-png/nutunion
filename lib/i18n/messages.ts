/**
 * 경량 i18n 스캐폴드 — 초기 3개 언어 (ko / en / ja)
 * 완전한 next-intl 도입 전 static 메시지 딕셔너리.
 *
 * 사용:
 *   import { t } from '@/lib/i18n/messages';
 *   const label = t(locale, 'nav.groups');   // "너트" | "Nut" | "ナット"
 */

export const LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

export const MESSAGES = {
  "nav.groups":    { ko: "너트 (Nut)",    en: "Nuts",    ja: "ナット" },
  "nav.projects":  { ko: "볼트 (Bolt)",   en: "Bolts",   ja: "ボルト" },
  "nav.wiki":      { ko: "탭 (Tab)",      en: "Tap",     ja: "タップ" },
  "nav.talents":   { ko: "와셔 (Washer)", en: "Washers", ja: "ワッシャー" },
  "nav.challenges":{ ko: "의뢰",          en: "Requests",ja: "リクエスト" },

  "hero.cta_primary":   { ko: "시작하기",   en: "Get Started",   ja: "はじめる" },
  "hero.cta_secondary": { ko: "Scene 둘러보기", en: "Browse Scenes", ja: "シーンを見る" },

  "stiffness.label":     { ko: "강성",      en: "Stiffness",     ja: "スティフネス" },
  "stiffness.formula":   { ko: "공개 산식", en: "Open Formula",  ja: "公開式" },

  "availability.looking":   { ko: "🔍 찾는 중", en: "🔍 Open to join",   ja: "🔍 募集中" },
  "availability.focused":   { ko: "🔥 집중 중", en: "🔥 Focused",        ja: "🔥 集中中" },
  "availability.observing": { ko: "👀 관망",    en: "👀 Observing",      ja: "👀 観察中" },

  "roles.pm":       { ko: "🎯 PM",       en: "🎯 PM",       ja: "🎯 PM" },
  "roles.lead":     { ko: "⚡ Lead",     en: "⚡ Lead",     ja: "⚡ Lead" },
  "roles.member":   { ko: "🛠 Member",    en: "🛠 Member",    ja: "🛠 Member" },
  "roles.mentor":   { ko: "🎓 Mentor",   en: "🎓 Mentor",   ja: "🎓 Mentor" },
} as const;

export function t(locale: string | undefined, key: keyof typeof MESSAGES): string {
  const loc = (LOCALES as readonly string[]).includes(locale || "") ? (locale as Locale) : DEFAULT_LOCALE;
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[loc] || entry[DEFAULT_LOCALE];
}

export function detectLocaleFromAccept(accept: string | null | undefined): Locale {
  if (!accept) return DEFAULT_LOCALE;
  const langs = accept.split(",").map((s) => s.split(";")[0].trim().toLowerCase());
  for (const l of langs) {
    if (l.startsWith("ko")) return "ko";
    if (l.startsWith("ja")) return "ja";
    if (l.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
