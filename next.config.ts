import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── 이미지 최적화 ──────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,               // 1시간 CDN 캐시
    remotePatterns: [
      {
        protocol: "https",
        hostname: "htmrdefcbslgwttjayxt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
      // Cloudflare R2 — public bucket (avatars, group/project images, resources)
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      // 커스텀 도메인 R2 (env 로 설정한 경우)
      {
        protocol: "https",
        hostname: "cdn.nutunion.co.kr",
      },
    ],
  },

  // ── 정적/API 캐싱 + 보안 헤더 ─────────────────────────────────
  async headers() {
    // CSP — Next.js 16 + Vercel Analytics + Supabase 호환
    // 주의: inline style/script 는 Next.js 런타임에 필요 (우선 enforce)
    //       필요 시 nonce 방식으로 업그레이드
    // CSP — 실사용 중 외부 폰트/이미지/CDN 차단 피드백 반영해 완화.
    // Next.js 런타임은 unsafe-inline/eval 필요. 외부 HTTPS 리소스는 광범위 허용.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:",
      "style-src 'self' 'unsafe-inline' https:",
      "style-src-elem 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      // 정적 에셋 (JS, CSS, 이미지) — 1년
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // 보안 헤더 (전체)
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",          value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          // HSTS — HTTPS 강제 (1년, 서브도메인 포함, preload 가능)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // 기능 권한 — 회의 녹음을 위해 microphone=self 허용, 나머지는 차단
          // camera=self 도 허용 (향후 영상 녹화/아바타 기능 대비)
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
          },
          // DNS prefetch 허용 (성능)
          { key: "X-DNS-Prefetch-Control",   value: "on" },
          // CSP — Enforce 모드
          // 운영 중 위반 발생 시 아래를 "Content-Security-Policy-Report-Only"
          // 로 잠시 되돌리고 violation report 로 원인 확인 후 규칙 조정
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      // API 응답 기본 — 캐싱 금지
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      // Service Worker — 절대 캐싱하지 말고 매번 새로 받기 (구 SW 교체 즉시 반영)
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  // ── 리다이렉트 (Legacy 대응) ───────────────────────────────────
  async redirects() {
    return [
      // www → apex 영구 리다이렉트 (SEO canonical)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.nutunion.co.kr" }],
        destination: "https://nutunion.co.kr/:path*",
        permanent: true,
      },
      // Legacy
      {
        source: "/crews",
        destination: "/groups",
        permanent: true,
      },
      {
        source: "/crews/:id",
        destination: "/groups/:id",
        permanent: true,
      },
    ];
  },

  // ── 빌드 최적화 ──────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  // esbuild는 native 바이너리를 포함하므로 서버 번들에서 제외 (코드 모드 Thread 컴파일용)
  serverExternalPackages: ["esbuild"],

  // ── 번들 분석 + 패키지 최적화 ────────────────────────────────
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
      "date-fns",
    ],
    // Next 16: PPR 은 cacheComponents 로 통합됨 — 점진 활성화는 별도 refactor 필요.
    // 현재는 force-dynamic 유지. 인덱스/컬럼 최소화/쿼리 병렬화만으로 큰 체감.
  },

  // ── 서버 에러 로깅 ────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
