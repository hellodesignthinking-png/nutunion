import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: ALWAYS call getUser() so that the auth token is refreshed
  // even on public pages like the landing page.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /groups/[id] and /projects/[id] detail pages are public for SEO — only
  // protect mutating routes (create, settings, finance, etc.) and the
  // genuinely-private prefixes.
  const path = request.nextUrl.pathname;
  const isProtectedPrefix =
    path === "/dashboard" || path.startsWith("/dashboard/") ||
    path === "/admin" || path.startsWith("/admin/") ||
    path === "/staff" || path.startsWith("/staff/") ||
    path === "/notes" || path.startsWith("/notes/") ||
    path === "/profile" || path.startsWith("/profile/") ||
    path === "/settings" || path.startsWith("/settings/") ||
    path === "/finance" || path.startsWith("/finance/");
  const isProtectedAction =
    path === "/groups/create" ||
    path === "/projects/create" ||
    /^\/(?:groups|projects)\/[^/]+\/(settings|meetings\/create|events\/create|finance|genesis|dev-plan|venture)/.test(path);

  if ((isProtectedPrefix || isProtectedAction) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
