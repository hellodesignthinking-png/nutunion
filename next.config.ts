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

  // ── 정적/API 캐싱 헤더 ───────────────────────────────────────
  async headers() {
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
          { key: "X-Frame-Options",         value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
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
};

export default nextConfig;
