import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth / Magic Link 콜백 — `?code=` 를 세션으로 교환.
 *
 * 중요: Next.js 16 App Router / proxy 환경에서 쿠키 누락으로 로그인 루프가 발생할 수 있어
 * `NextResponse` 에 쿠키를 **직접** 심는 패턴으로 작성 (next/headers 경유 X).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  // 성공 시 보낼 응답을 먼저 만들어두고, setAll 에서 이 응답의 쿠키를 업데이트
  const response = NextResponse.redirect(`${origin}${redirectTo}`);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth&reason=${encodeURIComponent(error.message)}`);
  }

  return response;
}
