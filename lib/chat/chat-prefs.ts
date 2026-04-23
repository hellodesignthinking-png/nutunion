/**
 * lib/chat/chat-prefs — 채팅 사용자 설정 (폰트 크기 등) localStorage 기반.
 *
 * SSR 안전: 서버에서 호출 시 기본값 반환.
 */

export type ChatFontSize = "small" | "medium" | "large" | "xlarge";

const FONT_KEY = "nu_chat_font_size";
const DEFAULT: ChatFontSize = "medium";

/** 버블 본문 폰트 크기 (px) */
export const FONT_PX: Record<ChatFontSize, number> = {
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 18,
};

/** 보조 텍스트 크기 (닉네임/시간) */
export const META_PX: Record<ChatFontSize, number> = {
  small: 10,
  medium: 11,
  large: 12,
  xlarge: 13,
};

export const FONT_LABEL: Record<ChatFontSize, string> = {
  small: "작게",
  medium: "보통",
  large: "크게",
  xlarge: "매우 크게",
};

export function getFontSize(): ChatFontSize {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === "small" || v === "medium" || v === "large" || v === "xlarge") return v;
  } catch {}
  return DEFAULT;
}

export function setFontSize(v: ChatFontSize): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FONT_KEY, v);
    // 다른 탭/인스턴스에도 알림
    window.dispatchEvent(new CustomEvent("nu-chat-font-change", { detail: v }));
  } catch {}
}

/** React hook — 변경 이벤트 구독 (SSR 안전, hydration mismatch 회피) */
import { useEffect, useState, useLayoutEffect } from "react";

// SSR 환경에선 useEffect, 브라우저에선 useLayoutEffect 를 써서 paint 전에 초기값 세팅
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useChatFontSize(): [ChatFontSize, (v: ChatFontSize) => void] {
  const [size, setSize] = useState<ChatFontSize>(DEFAULT);

  // paint 전에 localStorage 값으로 초기화 → 깜빡임 최소화
  useIsoLayoutEffect(() => {
    const v = getFontSize();
    if (v !== size) setSize(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const v = (e as CustomEvent).detail as ChatFontSize;
      if (v) setSize(v);
    };
    window.addEventListener("nu-chat-font-change", handler);
    return () => window.removeEventListener("nu-chat-font-change", handler);
  }, []);

  return [size, (v: ChatFontSize) => { setFontSize(v); setSize(v); }];
}
