"use client";

import Script from "next/script";

/**
 * Kakao JavaScript SDK 로더 — 전역 1회 등록.
 *
 * 환경변수 NEXT_PUBLIC_KAKAO_JS_KEY 가 설정되어 있을 때만 SDK 로드.
 * 로드 후 window.Kakao.init() 으로 초기화 → ShareDialog 등에서 즉시 사용 가능.
 *
 * Layout 의 <body> 안에 <KakaoSdkLoader /> 한 번만 배치.
 */
export function KakaoSdkLoader() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;

  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka"
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        const Kakao = (window as any).Kakao;
        if (Kakao && !Kakao.isInitialized?.()) {
          try {
            Kakao.init(key);
          } catch (e) {
            console.warn("[Kakao SDK] init failed:", e);
          }
        }
      }}
    />
  );
}
