/**
 * POST /api/profile/push-token
 *
 * Expo Push Token 등록 — 모바일(Expo) 앱이 발급받은 토큰을 서버에 저장.
 * 기존 expo_push_tokens 테이블(migration 057) 에 upsert.
 *
 * Body: { token: string, platform?: "ios" | "android" }
 *
 * DELETE /api/profile/push-token?token=...
 *   해당 토큰만 삭제 (로그아웃/디바이스 해제 시).
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role 미설정");
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const POST = withRouteLog("profile.push-token.post", async (req: NextRequest) => {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      platform?: string;
    };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token_required" }, { status: 400 });
    }

    const platform =
      body.platform === "ios" || body.platform === "android"
        ? body.platform
        : "unknown";

    const a = admin();
    const { error } = await a.from("expo_push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    log.error(err, "profile.push-token.failed");
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});

export const DELETE = withRouteLog("profile.push-token.delete", async (req: NextRequest) => {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const token = req.nextUrl.searchParams.get("token");
    const a = admin();
    if (token) {
      await a
        .from("expo_push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("token", token);
    } else {
      // 모든 디바이스 해제
      await a.from("expo_push_tokens").delete().eq("user_id", user.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    log.error(err, "profile.push-token.failed");
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
