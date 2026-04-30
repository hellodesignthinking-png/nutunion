import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Skip auth/session refresh for API + static-ish paths — every API route
  // creates its own supabase client and calls getUser() when needed, so the
  // middleware roundtrip on top of that is pure overhead. This roughly halves
  // first-byte latency on API calls.
  const p = request.nextUrl.pathname;
  if (
    p.startsWith("/api/") ||
    p.startsWith("/_next/") ||
    p.startsWith("/.well-known/") ||
    p === "/sw.js" ||
    p === "/manifest.json" ||
    p === "/robots.txt" ||
    p === "/sitemap.xml" ||
    p.startsWith("/icon") ||
    p.startsWith("/apple-icon") ||
    p === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|ico)$).*)",
  ],
};
