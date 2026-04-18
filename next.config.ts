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
    ],
  },

  // ── 정적/API 캐싱 + 보안 헤더 ─────────────────────────────────
  async headers() {
    // CSP — Next.js 16 + Vercel Analytics + Supabase 호환
    // 주의: inline style/script 는 Next.js 런타임에 필요 (우선 enforce)
    //       필요 시 nonce 방식으로 업그레이드
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://vercel.live",
      "font-src 'self' data:",
      "connect-src 'self' https://htmrdefcbslgwttjayxt.supabase.co wss://htmrdefcbslgwttjayxt.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://vercel.live",
      "frame-src 'self' https://vercel.live",
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
          // 기능 권한 — 불필요 센서 접근 차단
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
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
    ];
  },

  // ── 리다이렉트 (Legacy 대응) ───────────────────────────────────
  async redirects() {
    return [
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

  // ── 번들 분석 (선택적) ────────────────────────────────────────
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
    ],
  },

  // ── 서버 에러 로깅 ────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
