import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH  body: { body?, resolved?: boolean }  /  DELETE */
export const PATCH = withRouteLog("spaces.comments.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { body?: string; resolved?: boolean } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.body === "string") {
    if (body.body.length > 2000) return NextResponse.json({ error: "body_too_long" }, { status: 413 });
    update.body = body.body.trim();
  }
  if (body.resolved !== undefined) {
    update.resolved_at = body.resolved ? new Date().toISOString() : null;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("space_block_comments")
    .update(update)
    .eq("id", id)
    .select("id, body, author_id, resolved_at, created_at, updated_at, profiles:author_id(nickname, avatar_url)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
});

export const DELETE = withRouteLog("spaces.comments.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { error } = await supabase.from("space_block_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
