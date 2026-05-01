import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/spaces/blocks/{id}/comments → { comments: [...] } */
export const GET = withRouteLog("spaces.blocks.comments.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: blockId } = await ctx.params;
  const { data, error } = await supabase
    .from("space_block_comments")
    .select("id, body, author_id, resolved_at, created_at, updated_at, profiles:author_id(nickname, avatar_url)")
    .eq("block_id", blockId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
});

/** POST  body: { body: string } */
export const POST = withRouteLog("spaces.blocks.comments.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: blockId } = await ctx.params;
  const body = await req.json().catch(() => null) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: "body_required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "body_too_long" }, { status: 413 });

  const { data, error } = await supabase
    .from("space_block_comments")
    .insert({ block_id: blockId, author_id: user.id, body: text })
    .select("id, body, author_id, resolved_at, created_at, updated_at, profiles:author_id(nickname, avatar_url)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
});
