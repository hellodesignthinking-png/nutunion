/**
 * GET /api/profiles/[id] — 공개 프로필 카드 정보 (nickname, avatar_url) 조회.
 *
 * RLS 우회 목적:
 *   채팅 Realtime INSERT 이벤트에서 새 발신자의 프로필을 가져올 때
 *   클라이언트의 SELECT RLS 가 엄격하면 null 반환.
 *   여기서 service_role 로 안전하게 조회 (민감 정보 제외).
 *
 * 응답은 Edge CDN 에 30초 캐시.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
type Ctx = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const GET = withRouteLog("profiles.id", async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // 인증 사용자만 호출 가능 (spam 방지)
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminClient() || supabase;
  const { data, error } = await db
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=30",
    },
  });
});
