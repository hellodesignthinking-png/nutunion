"use client";

import { useEffect, useState } from "react";

type Locale = "ko" | "en";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return "ko";
  const m = document.cookie.match(/(?:^|;\s*)nu_locale=(ko|en)/);
  return m ? (m[1] as Locale) : "ko";
}

/**
 * 쿠키 기반 로케일 스위처. 초기값을 동기적으로 쿠키에서 읽어 flash 방지.
 * 변경 시 1년 유효 쿠키 저장 + 페이지 새로고침.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<Locale>(() => readCookieLocale());

  // hydration 후에도 동기화 (SSR 초기 렌더는 document 미접근)
  useEffect(() => {
    const cur = readCookieLocale();
    if (cur !== locale) setLocale(cur);
  }, [locale]);

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `nu_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocale(next);
    // 서버 컴포넌트는 쿠키 변화 감지 못함 → router.refresh() 로 충분하지만
    // 간단히 reload (scroll 유지 위해 pushState 후 reload)
    window.location.reload();
  };

  return (
    <div className={`inline-flex border-[2px] border-nu-ink ${className ?? ""}`} role="group" aria-label="언어 선택">
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={`px-2 py-1 font-mono-nu text-[10px] uppercase tracking-widest ${
            locale === l ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/10"
          }`}
          aria-pressed={locale === l}
          aria-label={l === "ko" ? "한국어" : "English"}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
