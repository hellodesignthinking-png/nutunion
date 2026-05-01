import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT = 20_000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/spaces/blocks/{id}
 *   body: { content?, data?, type?, position? }
 * DELETE 동일
 */
export const PATCH = withRouteLog("spaces.blocks.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    type?: string;
    content?: string;
    data?: Record<string, unknown>;
    position?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.type !== undefined) update.type = body.type;
  if (body.content !== undefined) {
    if (body.content.length > MAX_CONTENT) {
      return NextResponse.json({ error: "content_too_long" }, { status: 413 });
    }
    update.content = body.content;
  }
  if (body.data !== undefined) update.data = body.data;
  if (typeof body.position === "number") update.position = body.position;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("space_page_blocks")
    .update(update)
    .eq("id", id)
    .select("id, type, content, data, position, created_by, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ block: data });
});

export const DELETE = withRouteLog("spaces.blocks.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { error } = await supabase.from("space_page_blocks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
