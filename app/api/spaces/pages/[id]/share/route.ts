import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/spaces/pages/{id}/share — 공유 토큰 발급/회전
 *   body: { rotate?: boolean }  (기존 토큰 유지면 그대로, rotate 면 새 토큰)
 *   → { share_token, share_url }
 *
 * DELETE 동일 — 공유 해제 (token null).
 *
 * GET 동일 — 현재 공유 상태.
 */
function newToken(): string {
  return randomBytes(16).toString("base64url");
}

export const GET = withRouteLog("spaces.pages.share.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("space_pages")
    .select("share_token, shared_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    share_token: data?.share_token ?? null,
    shared_at: data?.shared_at ?? null,
  });
});

export const POST = withRouteLog("spaces.pages.share.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { rotate?: boolean } | null;

  const { data: existing } = await supabase
    .from("space_pages")
    .select("share_token")
    .eq("id", id)
    .maybeSingle();

  let token = existing?.share_token as string | null;
  if (!token || body?.rotate) {
    token = newToken();
  }

  const { data, error } = await supabase
    .from("space_pages")
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq("id", id)
    .select("share_token, shared_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    share_token: data.share_token,
    shared_at: data.shared_at,
  });
});

export const DELETE = withRouteLog("spaces.pages.share.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { error } = await supabase
    .from("space_pages")
    .update({ share_token: null, shared_at: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
