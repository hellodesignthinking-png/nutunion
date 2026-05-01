/**
 * GET /api/google/auth/status
 *
 * 현재 로그인 유저의 Google 계정 연결 여부 확인.
 * 응답: { connected: boolean, scopes?: string[] }
 */

import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const GET = withRouteLog("google.auth.status", async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  // google_connections 테이블 또는 유사한 곳에서 access/refresh 토큰 있는지 확인
  const { data } = await supabase
    .from("google_connections")
    .select("user_id, scopes, expires_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    scopes: (data as any).scopes || null,
  });
});
