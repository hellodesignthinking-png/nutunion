import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/groups", "/projects", "/wiki"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/profile",
          "/settings",
          "/notifications",
          "/chat",
          "/finance",
          "/staff",
          "/onboarding",
          "/threads",
          "/talents",
          "/portfolio",
          "/people",
          "/members",
          "/calendar",
          "/notes",
          "/insights",
          "/challenges",
          "/tracks",
          "/ventures",
          "/chapters",
          "/protocol",
          "/stiffness",
          "/tap-store",
          "/b2b",
          "/offline",
        ],
      },
    ],
    sitemap: "https://nutunion.co.kr/sitemap.xml",
    host: "https://nutunion.co.kr",
  };
}
